//! Пересылка лида менеджеру в Telegram через бота.
//!
//! Когда клиент выбирает Telegram на экране передачи менеджеру, фронт зовёт
//! `POST /api/handoff`, и бот отправляет менеджеру сообщение с именем/вопросом/
//! языком. Telegram-бот может писать пользователю ТОЛЬКО после того, как тот
//! нажал Start (поэтому нужен заранее известный `chat_id` менеджера).
//!
//! Без токена/chat_id функция выключена (no-op) — фронт просто откроет t.me-чат.

use serde_json::json;

use crate::config::Config;

/// Экранирование под HTML parse_mode Telegram.
fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

/// Лид для пересылки менеджеру.
pub struct Lead<'a> {
    pub name: Option<&'a str>,
    pub question: Option<&'a str>,
    /// Вид страховки (интент: med|dental|travel…).
    pub topic: Option<&'a str>,
    /// Выбранный клиентом мессенджер (где ждать клиента).
    pub messenger: Option<&'a str>,
    pub lang: &'a str,
}

/// Собирает HTML-текст уведомления менеджеру (пустые поля → «—»).
fn lead_text(lead: &Lead<'_>) -> String {
    let dash = |s: Option<&str>| esc(s.map(str::trim).filter(|s| !s.is_empty()).unwrap_or("—"));
    format!(
        "🆕 <b>Новый лид · Seguro Tenerife</b>\n\n👤 Имя: {}\n📨 Мессенджер: {}\n🛡 Страховка: {}\n🌐 Язык: {}\n💬 Вопрос: {}",
        dash(lead.name),
        dash(lead.messenger),
        dash(lead.topic),
        esc(lead.lang),
        dash(lead.question),
    )
}

/// Шлёт менеджеру лид. Возвращает true при успешной доставке.
pub async fn send_lead(http: &reqwest::Client, cfg: &Config, lead: &Lead<'_>) -> bool {
    let (Some(token), Some(chat_id)) = (&cfg.telegram_bot_token, &cfg.telegram_manager_chat_id)
    else {
        return false;
    };

    let text = lead_text(lead);

    let url = format!("https://api.telegram.org/bot{token}/sendMessage");
    match http
        .post(&url)
        .json(&json!({ "chat_id": chat_id, "text": text, "parse_mode": "HTML" }))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => true,
        Ok(resp) => {
            tracing::warn!(status = %resp.status(), "telegram sendMessage non-success");
            false
        }
        Err(e) => {
            tracing::warn!(error = %e, "telegram sendMessage failed");
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn esc_handles_html() {
        assert_eq!(esc("a<b>&c"), "a&lt;b&gt;&amp;c");
    }

    #[test]
    fn lead_text_includes_all_fields() {
        let text = lead_text(&Lead {
            name: Some("Анна"),
            question: Some("Какой полис для ВНЖ?"),
            topic: Some("med"),
            messenger: Some("WhatsApp"),
            lang: "ru",
        });
        assert!(text.contains("Имя: Анна"));
        assert!(text.contains("Мессенджер: WhatsApp"));
        assert!(text.contains("Страховка: med"));
        assert!(text.contains("Язык: ru"));
        assert!(text.contains("Вопрос: Какой полис для ВНЖ?"));
    }

    #[test]
    fn lead_text_uses_dash_for_empty_and_escapes() {
        let text = lead_text(&Lead {
            name: Some("  "),
            question: None,
            topic: None,
            messenger: Some("<b>"),
            lang: "en",
        });
        assert!(text.contains("Имя: —"));
        assert!(text.contains("Вопрос: —"));
        assert!(text.contains("Страховка: —"));
        assert!(text.contains("Мессенджер: &lt;b&gt;"));
    }
}
