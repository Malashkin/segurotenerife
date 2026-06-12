/**
 * Локальная декларация переменных окружения Vite для библиотеки pages.
 *
 * Pages импортирует <ChatWidget/> из @features, который транзитивно тянет
 * features/chat/model/handoff.ts и @shared/api/config.ts — оба обращаются к
 * import.meta.env (VITE_API_URL и контакты офиса для deep-link'ов хендоффа).
 * При изолированном `tsc --noEmit` в этой библиотеке tsc компилирует и эти
 * исходники, но ambient-декларации `import.meta.env` из их собственных env.d.ts
 * не попадают в область компиляции pages. Поэтому объявляем нужную часть типа
 * здесь (как это уже сделано в shared/api и features). Без зависимости от пакета
 * `vite` — библиотеки держим лёгкими (code-weight.md).
 *
 * В приложениях (web/admin) полный тип берётся из `vite/client`; ambient-слияние
 * безопасно (поля только добавляются).
 */
interface ImportMetaEnv {
  /** Базовый URL backend REST API (см. shared/api). */
  readonly VITE_API_URL?: string;
  /** Номер WhatsApp офиса-партнёра (формат wa.me, только цифры). */
  readonly VITE_WHATSAPP_NUMBER?: string;
  /** Username Telegram-аккаунта офиса-партнёра (без @). */
  readonly VITE_TELEGRAM_USERNAME?: string;
  /** Номер Viber офиса-партнёра (по умолчанию = номер WhatsApp). */
  readonly VITE_VIBER_NUMBER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
