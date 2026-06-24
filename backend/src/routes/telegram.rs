//! `POST /api/telegram/webhook` — апдейты Telegram-бота @seguro_tenerife_bot.
//!
//! Сценарий: клиент в чате выбрал Telegram → открыл `t.me/<bot>?start=<lead_id>`
//! → нажал Start. Telegram шлёт боту `/start <lead_id>` ВМЕСТЕ с @ником клиента.
//! Здесь мы: (1) дозахватываем ник в лид (`leads.contact`), (2) шлём карточку
//! лида получателям (владелец + менеджер(ы)) уже С НИКОМ, (3) отвечаем клиенту,
//! что менеджер скоро напишет.
//!
//! Эндпойнт публичный (его дёргает Telegram). Защита — секрет из
//! `setWebhook(secret_token=…)`, который Telegram присылает в заголовке
//! `X-Telegram-Bot-Api-Secret-Token`; сверяем с `TELEGRAM_WEBHOOK_SECRET`.
//! Всегда отвечаем 200 (иначе Telegram будет ретраить).

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;

use crate::{telegram, AppState};

#[derive(Debug, Deserialize)]
pub struct TgUpdate {
    pub message: Option<TgMessage>,
}

#[derive(Debug, Deserialize)]
pub struct TgMessage {
    #[serde(default)]
    pub text: Option<String>,
    pub from: Option<TgUser>,
    pub chat: TgChat,
}

#[derive(Debug, Deserialize)]
pub struct TgUser {
    pub id: i64,
    #[serde(default)]
    pub username: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TgChat {
    pub id: i64,
}

/// Контекст лида, поднятый при дозахвате ника (для карточки + ответа клиенту).
#[derive(sqlx::FromRow)]
struct LeadCtx {
    name: String,
    goal: Option<String>,
    comm_lang: Option<String>,
}

pub async fn webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(update): Json<TgUpdate>,
) -> StatusCode {
    // Проверяем секрет вебхука, если он настроен.
    if let Some(secret) = state.config.telegram_webhook_secret.as_deref() {
        let got = headers
            .get("x-telegram-bot-api-secret-token")
            .and_then(|v| v.to_str().ok());
        if got != Some(secret) {
            tracing::warn!("telegram webhook: bad secret token");
            return StatusCode::OK; // не подсказываем боту-сканеру, что эндпойнт жив
        }
    }

    let Some(msg) = update.message else {
        return StatusCode::OK;
    };
    let text = msg.text.unwrap_or_default();
    let token = match &state.config.telegram_bot_token {
        Some(t) => t.clone(),
        None => return StatusCode::OK,
    };
    let chat_id = msg.chat.id.to_string();

    // Команда /start <lead_id> — основной путь (deep-link из чата).
    if let Some(arg) = text.strip_prefix("/start ").map(str::trim) {
        if let Ok(lead_id) = uuid::Uuid::parse_str(arg) {
            // Ник клиента: @username, иначе технический id:<tg_id>.
            let nick = msg
                .from
                .as_ref()
                .and_then(|u| u.username.as_deref())
                .map(|u| format!("@{u}"))
                .unwrap_or_else(|| format!("id:{}", msg.from.as_ref().map(|u| u.id).unwrap_or(0)));

            // Дозахватываем ник в лид — только если контакт ещё пуст (идемпотентно:
            // повторный Start не дублирует карточку менеджеру).
            let ctx: Option<LeadCtx> = sqlx::query_as::<_, LeadCtx>(
                "UPDATE leads SET contact = $1 \
                 WHERE id = $2 AND (contact IS NULL OR contact = '') \
                 RETURNING name, goal, comm_lang",
            )
            .bind(&nick)
            .bind(lead_id)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or_else(|e| {
                tracing::warn!(error = %e, "telegram webhook: lead update failed");
                None
            });

            if let Some(lead) = ctx {
                let lang = lead.comm_lang.as_deref().unwrap_or("ru");
                // Карточка менеджеру/владельцу — уже с ником клиента.
                telegram::send_lead(
                    &state.http,
                    &state.config,
                    &telegram::Lead {
                        name: Some(&lead.name),
                        question: None,
                        topic: lead.goal.as_deref(),
                        messenger: Some("Telegram"),
                        contact: Some(&nick),
                        lang,
                    },
                )
                .await;
                // Ответ клиенту.
                let reply = thanks_text(lang, &lead.name);
                telegram::send_to_chat(&state.http, &token, &chat_id, &reply).await;
            } else {
                // Лид не найден или ник уже захвачен — нейтральный ответ.
                telegram::send_to_chat(&state.http, &token, &chat_id, ack_text("ru")).await;
            }
            return StatusCode::OK;
        }
    }

    // /start без аргумента или иное сообщение — приветствие.
    telegram::send_to_chat(&state.http, &token, &chat_id, greeting_text("ru")).await;
    StatusCode::OK
}

/// Благодарность клиенту после захвата заявки (по языку диалога).
fn thanks_text(lang: &str, name: &str) -> String {
    match lang {
        "en" => format!(
            "Thank you, {name}! 🙌 I've passed your request to a manager — they'll message you here on Telegram soon."
        ),
        "es" => format!(
            "¡Gracias, {name}! 🙌 He pasado tu solicitud a un gestor — te escribirá aquí en Telegram en breve."
        ),
        "uk" => format!(
            "Дякую, {name}! 🙌 Передав вашу заявку менеджеру — він скоро напише вам тут, у Telegram."
        ),
        _ => format!(
            "Спасибо, {name}! 🙌 Передал вашу заявку менеджеру — он скоро напишет вам здесь, в Telegram."
        ),
    }
}

/// Нейтральное подтверждение (лид уже обработан/не найден).
fn ack_text(lang: &str) -> &'static str {
    match lang {
        "en" => "Got it — a manager will contact you shortly. 🙌",
        "es" => "Recibido — un gestor te contactará en breve. 🙌",
        "uk" => "Прийнято — менеджер скоро зв’яжеться з вами. 🙌",
        _ => "Принято — менеджер скоро свяжется с вами. 🙌",
    }
}

/// Приветствие на голый /start (без lead_id).
fn greeting_text(lang: &str) -> &'static str {
    match lang {
        "en" => "Hello! 👋 This is the Seguro Tenerife bot. Open the chat on our website to leave a request — a manager will get back to you.",
        "es" => "¡Hola! 👋 Soy el bot de Seguro Tenerife. Abre el chat en nuestra web para dejar tu solicitud — un gestor te contactará.",
        "uk" => "Вітаю! 👋 Це бот Seguro Tenerife. Відкрийте чат на нашому сайті, щоб залишити заявку — менеджер зв’яжеться з вами.",
        _ => "Здравствуйте! 👋 Это бот Seguro Tenerife. Откройте чат на нашем сайте, чтобы оставить заявку — менеджер свяжется с вами.",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thanks_text_localized_and_named() {
        assert!(thanks_text("ru", "Анна").contains("Спасибо, Анна"));
        assert!(thanks_text("en", "Anna").contains("Thank you, Anna"));
        assert!(thanks_text("es", "Ana").contains("Gracias, Ana"));
        assert!(thanks_text("uk", "Анна").contains("Дякую, Анна"));
        // Неизвестный язык → русский фолбэк.
        assert!(thanks_text("de", "Max").contains("Спасибо, Max"));
    }

    #[test]
    fn greeting_and_ack_differ_by_lang() {
        assert!(greeting_text("en").contains("Seguro Tenerife bot"));
        assert!(ack_text("es").contains("gestor"));
    }
}
