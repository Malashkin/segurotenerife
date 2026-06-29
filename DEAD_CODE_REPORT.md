# 🩷 Dead Code Report — Seguro Tenerife

Сканеры: backend `cargo build` (0 dead_code ✓), frontend — ripgrep
reference-counting (Knip не установлен). Git-дерево чистое. **Ничего не удалено —
жду твоего решения по ID.**

Общий вывод: backend чистый. На фронте остался **мёртвый кластер от убранного
чат-опросника** (степ-флоу заменён на свободный чат) + вестигиальные i18n-ключи.

## Сводка

| ID | Что | Риск | Размер |
|---|---|---|---|
| M1 | `chat/model/options.ts` — орфан, нигде не импортится | 🟡 | 91 строк |
| M2 | `chat/model/useChatMessages.ts` — орфан, нигде не импортится | 🟡 | 124 строки |
| M3 | `shared/store/src/chatStore.ts` — степ-стор, жив только через M1/M2 | 🟡 | 343 строки |
| L1 | 32 мёртвых ключа в `chatDict.ts` (×4 локали) | 🟢 | ~128 строк |
| L2 | `VITE_TELEGRAM_BOT_USERNAME` в 3× `env.d.ts` (откат бота) | 🟢 | 3 строки |
| L3 | мёртвые questionnaire-ключи в `common.json` (после M1) | 🟢 | ~25 ключей ×4 |

---

## 🟡 MEDIUM — кластер «старый опросник» (взаимосвязан, удалять вместе)

Опросник (язык/цель/семья/город/мессенджер) заменён на свободный чат
(`ChatWidget`). Остался изолированный мёртвый кластер: 3 файла ссылаются только
друг на друга, наружу не используются. Публичный API фичи (`chat/index.ts`)
отдаёт лишь `ChatWidget`.

**[M1] `libs/features/src/chat/model/options.ts`** (91 стр)
Опции шагов опросника. `grep` импортов — 0 (нигде не импортится).
`Your decision: DELETE / KEEP / DEPRECATE / UNSURE`

**[M2] `libs/features/src/chat/model/useChatMessages.ts`** (124 стр)
Хук степ-логики чата. Импортов — 0. Единственный потребитель `chatStore`.
`Your decision: DELETE / KEEP / DEPRECATE / UNSURE`

**[M3] `libs/shared/store/src/chatStore.ts`** (343 стр) + его экспорт в
`shared/store/src/index.ts` + степ-типы (`ChatStep`/`ChatStepKey`/`PickedOption`)
Степ-стор опросника. Используется ТОЛЬКО из M1 и M2 (оба мёртвые) → после их
удаления полностью мёртв. Новый чат работает на отдельном `useUiStore` (жив).
> ⚠️ Это shared-lib: удалять только вместе с M1+M2, и обновить `index.ts`-экспорт.
`Your decision: DELETE / KEEP / DEPRECATE / UNSURE`

---

## 🟢 LOW — вестигиальные строки/декларации

**[L1] 32 мёртвых ключа в `libs/features/src/chat/model/chatDict.ts`** (в каждой из 4 локалей)
0 ссылок вне словаря. Остатки опросника/контакт-формы/AI-подписей:
`ai_label, ai_note, ask_cta, ask_or, ask_thinking, btn_send, consent_text,
done_restart, f_contact_l, f_contact_ph, f_msgr_l, f_name_l, f_name_ph,
hand_hello, here, lead_msg, load_p, q_back, q_free, s1_hint…s6_hint,
starter_dental, starter_price, starter_visa, starters_label, val_consent,
val_contact, val_name`.
> `ai_label/ai_note` ещё и упоминают «ИИ-ассистента» — заодно чистим бренд/AI.
> `o_med…o_pet` НЕ трогаем — живы через `CHAT_INTENTS.goalKey`.
`Your decision: DELETE / KEEP / DEPRECATE / UNSURE`

**[L2] `VITE_TELEGRAM_BOT_USERNAME`** в `libs/{features,pages,widgets}/src/env.d.ts`
Тип-декларация под бот-подход к Telegram, который откатили (handoff на копирование).
Нигде не читается.
`Your decision: DELETE / KEEP / DEPRECATE / UNSURE`

**[L3] Мёртвые questionnaire-ключи в `common.json`** (4 локали)
После удаления M1 (`options.ts`) осиротеют ключи опросника в общем словаре
(`s1_h…s6_h`, `s*_hint`, `f_name_l/ph`, `f_msgr_l`, `f_contact_l/ph`,
`o_one/o_pair/o_familyk`, `o_othercity`, `o_urgent/o_soon/o_browsing`, `consent_text`,
`btn_send`, `q_back/q_free`, `done_*`, `val_*`, `starter*`, `ask_*` и т.п.).
Точный список соберу при удалении (тем же reference-scan по common.json).
> Зависит от M1/L1 — имеет смысл чистить вместе.
`Your decision: DELETE / KEEP / DEPRECATE / UNSURE`

---

## Не трогаю (живое / по делу)
- `scripts/qa-*.mjs` — QA-инструменты (переиспользуемые), не мёртвый код.
- `intents.ts`, `useChatI18n.ts`, `FreeAsk.tsx`, `handoff.ts` — используются `ChatWidget`.
- `console.log` в `chatStore.ts:28` — пример в JSDoc-комментарии (уйдёт с M3).
- backend — чисто (cargo 0 warnings).

## Вопросы
- M3 трогает `@shared/store` (shared-lib). Удаляем кластер целиком (M1+M2+M3) или
  пока оставляем стор «на будущее», убрав только орфан-файлы M1/M2?
