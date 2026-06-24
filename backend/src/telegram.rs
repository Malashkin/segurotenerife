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

/// Шлёт менеджеру лид. Возвращает true при успешной доставке.
pub async fn send_lead(
    http: &reqwest::Client,
    cfg: &Config,
    name: Option<&str>,
    question: Option<&str>,
    lang: &str,
) -> bool {
    let (Some(token), Some(chat_id)) = (&cfg.telegram_bot_token, &cfg.telegram_manager_chat_id)
    else {
        return false;
    };

    let text = format!(
        "🆕 <b>Новый лид · Seguro Tenerife</b>\n\n👤 Имя: {}\n🌐 Язык: {}\n💬 Вопрос: {}",
        esc(name.map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("—")),
        esc(lang),
        esc(question.map(|s| s.trim()).filter(|s| !s.is_empty()).unwrap_or("—")),
    );

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
}
