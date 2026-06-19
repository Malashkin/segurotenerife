# TEST_RESULTS — Red Ranger

Тестовый прогон по новому коду Волны D (RAG-агент, DDoS/инъекшн-харднинг, PostHog).
Стек: **Rust** (`cargo`) + **TS** (`vitest` для чистых хелперов; Playwright — e2e).
Покрытый код: `backend/src/{knowledge,rate_limit}.rs`,
`frontend/.../{posthog.ts, i18n/t.ts}`.

## Статус: 🟢 PASS

| Слой | Кол-во | Команда |
|---|---|---|
| Backend unit | **28 passed** (knowledge 14 · rate_limit 8 · langfuse 6) | `cargo test` |
| Backend integration (router/oneshot + mock-сервер) | **3 passed** (rate-limit ×2 · langfuse log_chat) | `cargo test` |
| Frontend unit (vitest) | **8 passed** | `pnpm test` |
| E2E (web) | 15 passed | `pnpm e2e` |
| Lint | 0 warnings | `cargo clippy` |

Всего backend: **31 cargo-теста.**

### knowledge.rs (ретривал + бренд-гейт) — 14 тестов
Интент важнее лексики; кросс-язычный матч (ru/uk/en→es); интент-only запрос;
top-k; фолбэк-подборка (порядок/дедуп/непустота); рендер несёт факты покрытия
(заземление); `strip_brand` — вырезание/флаг, регистронезависимость, мультибренд,
no-op на чистом тексте; `len`/`is_empty`.

### rate_limit.rs (защита от DDoS/cost-DoS) — 8 тестов
Лимит до порога → блок; per-IP изоляция; **сброс окна** (детерминированно через
инъекцию `now`); **граница окна эксклюзивна** (ровно 60с ещё лимит); **эвикция**
протухших IP; `client_ip` из XFF/CF-заголовков при доверии прокси и игнор без;
ответ лимита = **429**.

> Рефактор для тестируемости: `RateLimiter::allow` → тонкая обёртка над
> `allow_at(ip, now)` с инъектируемыми часами (детерминизм окна/эвикции без `sleep`).

### langfuse.rs (трассировка диалогов агента) — 7 тестов
`build_batch` (5): trace+generation с вопросом/ответом; generation вложен в trace
и несёт model+usage(токены); sessionId группирует диалог / пустой — опускается;
metadata (intent/lang/brand_leaked). `enabled` (1): требует ОБА ключа. Интеграция
(1): `log_chat` реально POST'ит batch на `/api/public/ingestion` с Basic-auth и
вопросом в теле (mock-сервер на axum, эфемерный порт).

> Хелпер `Config::test()` (#[cfg(test)]) + struct-update `..Config::test()` —
> убрал дублирование 17-полевых литералов в тестах rate_limit/langfuse.

### Frontend (vitest) — 8 тестов
- `@shared/api/posthog.ts` (4): no-op без ключа; **GDPR — init с
  `opt_out_capturing_by_default` и маскировкой инпутов**; согласие→opt_in /
  отказ→opt_out / проксирование события; admin-режим без autocapture/recording.
- `apps/web-astro/src/i18n/t.ts` (4): перевод по локали; разные локали ≠; фоллбэк
  на сам ключ; `dictFor` непустой.

## Mutation (quality gate) — `cargo-mutants`, на изменённых файлах

Финал (после интеграционных middleware-тестов): **middleware-мутанты убиты.**
```
rate_limit.rs: 16 caught · 1 missed · 1 unviable   (было 3 missed)
knowledge.rs:  ~44 caught · 4 missed · ~timeout/unviable
overall ≈ 92% killed (viable); прогресс caught: 44 → 51 → 54 → 56
```

### Оставшиеся выжившие — обоснование (эквивалентные / низкий риск)
- `knowledge.rs:121 > → >=` (граница `any_positive`) — **эквивалентный**: счёты
  дискретны, наблюдаемый исход не меняется.
- `knowledge.rs:137 || → &&` (keyword `==` vs `contains`) — отличие лишь в
  подстрочном матче; страхует haystack-сигнал (+2). Низкий риск.
- `knowledge.rs:141 += → -=/*=` — слабый haystack-сигнал (+2); поведение
  доминируется протестированными keyword (+10) и intent (+100).
- `knowledge.rs:216 strip_brand + → *` — **TIMEOUT**: мутация даёт panic
  (выход за границы среза) → фактически детектится.
- `rate_limit.rs:63 > → >=` (триггер свипа эвикции) — **эквивалентный**: свип —
  best-effort GC, момент срабатывания не влияет на allow/deny.
- ✅ `rate_limit.rs:129/145 middleware → Default` — **УБИТЫ** интеграционными
  тестами `chat/general_middleware_*` (router + `tower::oneshot`, 429 сверх лимита).

**langfuse.rs** (после интеграционного теста: 6 caught · 4 missed; было 2/10):
- ✅ `enabled` (×3) и `log_chat → ()` — **УБИТЫ** (тесты `enabled_requires_both_keys`
  + `log_chat_posts_batch_with_auth` через mock-сервер).
- `log_chat:108/111` (`!is_success()` guard ×3 + `Err`-arm) — **обоснованы**: эти
  ветки лишь решают, писать ли `tracing::debug!`-строку; на поведение
  (fire-and-forget, всегда `()`) не влияют. Убирать их = ловить лог-вывод ради
  нулевого функционального эффекта. Заодно упрощён избыточный `&& != 207` (207 уже
  входит в `is_success()`).

## Coverage
Инструмент покрытия не устанавливался — как **диагностику** использован
mutation-гейт (сильнее % покрытия по качеству ассертов).

## Заметки
- Live `/api/chat` (вызов Claude) — за фиче-флагом ключа; интеграционно покрыт
  стаб-e2e фронта; юнит-логика (ретривал/гейт) — здесь.
- Остальные `.astro`-компоненты и Overlays-мост покрыты Playwright-e2e (трофей).
