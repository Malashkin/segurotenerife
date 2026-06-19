//! Langfuse — трассировка диалогов RAG-агента (вопрос → ответ) для наблюдаемости.
//!
//! У Langfuse нет официального Rust SDK → как с Claude, ходим прямым HTTP на
//! ingestion-API (`POST /api/public/ingestion`, Basic-auth public:secret).
//! На каждый ответ агента шлём `trace` (диалоговый ход) + вложенный `generation`
//! (LLM-вызов: модель, токены, латентность). Группировка по `sessionId` даёт в
//! дашборде Langfuse цепочку Q&A одного посетителя как «сессию».
//!
//! Fire-and-forget: вызывается из tokio::spawn после ответа пользователю — на
//! скорость/надёжность чата не влияет, ошибки глотаются. Без ключей — no-op.

use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::config::Config;

/// Данные одного хода диалога для трассировки.
pub struct ChatTrace {
    pub session_id: Option<String>,
    pub intent: Option<String>,
    pub lang: String,
    pub question: String,
    pub answer: String,
    pub model: String,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub retrieved_ids: Vec<String>,
    pub brand_leaked: bool,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

/// Собирает batch-payload ingestion API (trace + generation). Чистая функция —
/// без сети, поэтому покрыта юнит-тестом.
pub fn build_batch(t: &ChatTrace) -> Value {
    let trace_id = Uuid::new_v4().to_string();
    let now = t.end.to_rfc3339();

    let metadata = json!({
        "intent": t.intent,
        "lang": t.lang,
        "retrieved": t.retrieved_ids,
        "brand_leaked": t.brand_leaked,
    });

    let mut usage = json!({ "unit": "TOKENS" });
    if let Some(i) = t.input_tokens {
        usage["input"] = json!(i);
    }
    if let Some(o) = t.output_tokens {
        usage["output"] = json!(o);
    }

    let mut trace_body = json!({
        "id": trace_id,
        "name": "chat",
        "input": t.question,
        "output": t.answer,
        "metadata": metadata,
        "tags": ["chat-agent"],
        "timestamp": now,
    });
    if let Some(sid) = t.session_id.as_deref().filter(|s| !s.is_empty()) {
        trace_body["sessionId"] = json!(sid);
    }

    let gen_body = json!({
        "id": Uuid::new_v4().to_string(),
        "traceId": trace_id,
        "type": "GENERATION",
        "name": "claude",
        "model": t.model,
        "input": t.question,
        "output": t.answer,
        "usage": usage,
        "metadata": metadata,
        "startTime": t.start.to_rfc3339(),
        "endTime": now,
    });

    json!({
        "batch": [
            { "id": Uuid::new_v4().to_string(), "type": "trace-create", "timestamp": now, "body": trace_body },
            { "id": Uuid::new_v4().to_string(), "type": "generation-create", "timestamp": now, "body": gen_body },
        ]
    })
}

/// Включена ли трассировка (есть оба ключа).
pub fn enabled(cfg: &Config) -> bool {
    cfg.langfuse_public_key.is_some() && cfg.langfuse_secret_key.is_some()
}

/// Шлёт трассировку в Langfuse, если настроена. Fire-and-forget: ошибки глотаем.
pub async fn log_chat(http: &reqwest::Client, cfg: &Config, t: ChatTrace) {
    let (Some(pk), Some(sk)) = (&cfg.langfuse_public_key, &cfg.langfuse_secret_key) else {
        return;
    };
    let url = format!(
        "{}/api/public/ingestion",
        cfg.langfuse_base_url.trim_end_matches('/')
    );
    let payload = build_batch(&t);
    match http.post(&url).basic_auth(pk, Some(sk)).json(&payload).send().await {
        Ok(resp) if !resp.status().is_success() && resp.status().as_u16() != 207 => {
            tracing::debug!(status = %resp.status(), "langfuse ingest non-success");
        }
        Err(e) => tracing::debug!(error = %e, "langfuse ingest failed"),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> ChatTrace {
        let t0 = Utc::now();
        ChatTrace {
            session_id: Some("sess-1".into()),
            intent: Some("dental".into()),
            lang: "ru".into(),
            question: "Что покрывает стоматология?".into(),
            answer: "Покрывает чистки и осмотры.".into(),
            model: "claude-haiku-4-5".into(),
            input_tokens: Some(1200),
            output_tokens: Some(300),
            retrieved_ids: vec!["dental".into()],
            brand_leaked: false,
            start: t0,
            end: t0,
        }
    }

    #[test]
    fn batch_has_trace_and_generation_with_qa() {
        let b = build_batch(&sample());
        let items = b["batch"].as_array().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["type"], "trace-create");
        assert_eq!(items[1]["type"], "generation-create");
        // Вопрос/ответ присутствуют (это и есть «диалог»).
        assert_eq!(items[0]["body"]["input"], "Что покрывает стоматология?");
        assert_eq!(items[0]["body"]["output"], "Покрывает чистки и осмотры.");
    }

    #[test]
    fn generation_links_trace_and_carries_model_and_usage() {
        let b = build_batch(&sample());
        let trace_id = b["batch"][0]["body"]["id"].as_str().unwrap();
        let gen = &b["batch"][1]["body"];
        assert_eq!(gen["traceId"], trace_id); // generation вложен в trace
        assert_eq!(gen["model"], "claude-haiku-4-5");
        assert_eq!(gen["usage"]["input"], 1200);
        assert_eq!(gen["usage"]["output"], 300);
    }

    #[test]
    fn session_id_groups_dialogue_when_present() {
        let b = build_batch(&sample());
        assert_eq!(b["batch"][0]["body"]["sessionId"], "sess-1");
    }

    #[test]
    fn empty_session_id_is_omitted() {
        let mut t = sample();
        t.session_id = Some(String::new());
        let b = build_batch(&t);
        assert!(b["batch"][0]["body"].get("sessionId").is_none());
    }

    #[test]
    fn metadata_carries_intent_lang_and_brand_flag() {
        let b = build_batch(&sample());
        let md = &b["batch"][0]["body"]["metadata"];
        assert_eq!(md["intent"], "dental");
        assert_eq!(md["lang"], "ru");
        assert_eq!(md["brand_leaked"], false);
    }
}
