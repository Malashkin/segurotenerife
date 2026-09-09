---
audience: [backend, frontend, devops]
owner: seguro-tenerife
updated: 2026-09-09
---

# Monitoring & Observability

Как мы видим, что происходит в проде: диалоги AI-агента и продуктовую воронку.

- [chat-sessions.md](chat-sessions.md) — разбор живых диалогов с чат-агентом:
  что считается находкой, вердикты «сломано / сорвался / здоров», где лежат
  тексты вопросов и чего эта проверка пока не видит.
- [observability.md](observability.md) — **Langfuse** (трассировка диалогов
  чат-агента: вопрос/ответ/токены/латентность) и **PostHog** (продуктовая
  аналитика: autocapture, воронка, события), включая consent/PII-модель.

Смежное:
- AI-агент и его конвейер — [../ai/rag-agent.md](../ai/rag-agent.md).
- ENV-переменные для прода — [../deploy.md](../deploy.md).
