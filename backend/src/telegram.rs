//! Пересылка карточки лида получателям в Telegram через бота.
//!
//! Когда клиент на экране передачи менеджеру выбирает мессенджер, фронт зовёт
//! `POST /api/handoff`, и бот шлёт карточку лида (имя/мессенджер/вид страховки/
//! язык/вопрос) всем получателям из `TELEGRAM_MANAGER_CHAT_ID` (через запятую:
//! владелец для учёта + менеджер(ы)). Бот может писать пользователю ТОЛЬКО после
//! того, как тот нажал Start, поэтому chat_id получателей известны заранее.
//!
//! Без токена/chat_id функция выключена (no-op) — на воронку это не влияет.

use serde_json::json;

use crate::config::Config;

/// Экранирование под HTML parse_mode Telegram.
fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

/// Лид для пересылки получателям.
pub struct Lead<'a> {
    pub name: Option<&'a str>,
    pub question: Option<&'a str>,
    /// Вид страховки (человекочитаемый лейбл, как видит клиент).
    pub topic: Option<&'a str>,
    /// Выбранный клиентом мессенджер (где ждать клиента).
    pub messenger: Option<&'a str>,
    pub lang: &'a str,
}

/// Собирает HTML-текст карточки лида (пустые поля → «—»).
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

/// Разбирает список chat_id из конфигурации (через запятую): получателями могут
/// быть и владелец (учёт лидов), и менеджер(ы). Пустые/пробельные — отбрасываем.
fn recipients(raw: &str) -> Vec<&str> {
    raw.split(',').map(str::trim).filter(|s| !s.is_empty()).collect()
}

/// Шлёт карточку лида всем получателям (владелец + менеджер(ы)). Один общий текст
/// рассылается на каждый chat_id из `TELEGRAM_MANAGER_CHAT_ID`. Возвращает true,
/// если доставлено хотя бы одному.
pub async fn send_lead(http: &reqwest::Client, cfg: &Config, lead: &Lead<'_>) -> bool {
    let (Some(token), Some(chat_ids)) = (&cfg.telegram_bot_token, &cfg.telegram_manager_chat_id)
    else {
        return false;
    };
    let chats = recipients(chat_ids);
    if chats.is_empty() {
        return false;
    }

    let text = lead_text(lead);
    let url = format!("https://api.telegram.org/bot{token}/sendMessage");
    let mut any = false;
    for chat_id in chats {
        match http
            .post(&url)
            .json(&json!({ "chat_id": chat_id, "text": text, "parse_mode": "HTML" }))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => any = true,
            Ok(resp) => tracing::warn!(status = %resp.status(), chat_id, "telegram sendMessage non-success"),
            Err(e) => tracing::warn!(error = %e, chat_id, "telegram sendMessage failed"),
        }
    }
    any
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn esc_handles_html() {
        assert_eq!(esc("a<b>&c"), "a&lt;b&gt;&amp;c");
    }

    #[test]
    fn recipients_splits_trims_and_drops_empty() {
        assert_eq!(recipients("172373152"), vec!["172373152"]);
        assert_eq!(recipients(" 111 , 222 ,, 333 "), vec!["111", "222", "333"]);
        assert!(recipients("  ,  ").is_empty());
    }

    #[test]
    fn lead_text_includes_all_fields() {
        let text = lead_text(&Lead {
            name: Some("Анна"),
            question: Some("Какой полис для ВНЖ?"),
            topic: Some("Медицинская для визы / ВНЖ"),
            messenger: Some("Telegram"),
            lang: "ru",
        });
        assert!(text.contains("Имя: Анна"));
        assert!(text.contains("Мессенджер: Telegram"));
        assert!(text.contains("Страховка: Медицинская для визы / ВНЖ"));
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
