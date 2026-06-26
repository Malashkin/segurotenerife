# TEST_RESULTS — Red Ranger

Последний прогон — по изменениям сессии (чат-хендофф, прокси PostHog, блог,
аналитика, админ-таблица). App type: **Web UI (Astro/React) + Rust API** →
Testing Trophy + e2e.

## Сводка (per-layer)

| Слой | Команда | Результат |
|---|---|---|
| Unit (frontend) | `pnpm -s test` (vitest) | **19 passed** (3 файла) |
| Unit/integration (backend) | `cargo test` | **40 passed** |
| E2E (web UI) | `pnpm exec playwright test web-chat` | **3 passed** (приветствие, история+очистка, connect-кнопка, copy-панель, имя обязательно) |

## Что добавлено в этом прогоне

**`libs/features/src/chat/model/handoff.test.ts`** (новый, 8 тестов) — покрыл
ранее НЕпокрытую чистую логику deep-link'ов хендоффа (`buildHandoffLink`,
`continueLabelKey`, `getOfficeContacts`). Ассерты — по СПЕЦИФИКАЦИИ:
- WhatsApp/Viber несут URL-кодированный текст; Viber — номер через `%2B`;
- **Telegram — чистый `t.me/<username>` без текста/query** (ключевое недавнее
  изменение: предзаполнить нельзя, клиент копирует заготовку сам);
- кодирование защищает от `& = #`, ломающих ссылку;
- `getOfficeContacts`: дефолты, срез ведущего `@`, фолбэк Viber→WhatsApp.

Существующее покрытие (зелёное): backend `wants_manager` (manager/price/buy +
укр. апострофы), `telegram::lead_text`/`recipients`, `detectTrafficChannel`
(GEO ai/search/social/direct), e2e чата.

## Мутационный гейт (вручную — Stryker не установлен)

Stryker отсутствует, добавление в монорепо — тяжело; провёл ручной анализ
мутантов по изменённой логике `handoff.ts`. Каждый — убит тестом:

| Мутант | Чем убит |
|---|---|
| Telegram-ссылка получает `?text=…` | `not.toContain('?')`, `not.toContain('text=')` |
| Viber: `+` вместо `%2B` | `toContain('number=%2B…')`, `not.toContain('number=+')` |
| WhatsApp: без `encodeURIComponent` | `toContain('%20')`/`%0A` + точное `toBe` |
| Перепутан хост (`wa.me`↔`t.me`) | точное `toBe(...)` |
| `continueLabelKey`: своп Tg/Vb/Wa | точные `toBe('contTg'/'contVb'/'contWa')` |
| `getOfficeContacts`: не срезает `@` | `telegramUsername === 'office'` |
| Viber-фолбэк удалён | `viberNumber === whatsappNumber` |

Выживших значимых мутантов нет; эквивалентных — нет.

## Coverage (диагностика)

Numeric-coverage отдельно не гонял; цель Red Ranger — покрыть риск, а не число.
Новый файл закрывает все ветки `buildHandoffLink`/`continueLabelKey`/
`getOfficeContacts` (3 мессенджера × кодирование + 3 ветки env).
