---
audience: [backend, frontend, testing]
owner: seguro-tenerife
updated: 2026-06-19
---

# Testing

Стратегия — «трофей»: вес на интеграции + e2e (UI-проект), плюс unit на чистой
логике. **Mutation-тесты — главный quality-гейт** (сильнее % покрытия). Сводка
последнего прогона: [`../../TEST_RESULTS.md`](../../TEST_RESULTS.md).

## Команды

### Backend (Rust, `backend/`)
```bash
cargo test            # unit + интеграционные (router/oneshot, mock-серверы)
cargo clippy          # линт (держим 0 warnings)
cargo build
cargo mutants -f src/<file>.rs   # mutation-гейт на изменённом файле
```

### Frontend (`frontend/`)
```bash
pnpm install
pnpm typecheck        # tsc по всем пакетам (вкл. *.test.ts)
pnpm test             # vitest (юнит-тесты чистых хелперов; *.test.ts)
pnpm e2e              # Playwright (web на Astro + admin; *.spec.ts)
```

## Что где
| Слой | Где | Чем |
|---|---|---|
| Backend unit/integration | `backend/src/**` (`#[cfg(test)] mod tests`) | `cargo test` |
| Backend mutation | изменённые `.rs` | `cargo-mutants` |
| Frontend unit | `**/src/**/*.test.ts` | `vitest` |
| Frontend e2e | `frontend/e2e/tests/*.spec.ts` | `playwright` |

- **`*.test.ts` = vitest, `*.spec.ts` = Playwright** (раздельные include-паттерны).
- E2E **герметичен**: `playwright.config` обнуляет PostHog-ключ в тест-сборке
  (`webServer.env`), чтобы не слать тестовый трафик в реальную аналитику.
- Внешние вызовы (Claude, Langfuse) в тестах не делаются: логика покрыта unit +
  интеграцией с mock-серверами; контракт `/api/chat` — стаб-e2e на фронте.

## Принципы (Red Ranger)
- Тестируем **риск и поведение**, не квоту; ассертим спецификацию, не реализацию.
- Багфикс → сначала падающий регресс-тест.
- Mutation: выжившие мутанты **убить или обосновать** (равноценные/лог-только) —
  обоснования в `TEST_RESULTS.md`.
- Без флака: детерминизм (инъекция часов в rate-limit вместо `sleep`).
