/**
 * Локальная декларация переменных окружения Vite для библиотеки features.
 *
 * features читает import.meta.env (контакты офиса для deep-link'ов хендоффа в
 * chat/model/handoff.ts) и транзитивно тянет shared/api/config.ts, который тоже
 * обращается к import.meta.env.VITE_API_URL. Сама библиотека не зависит от пакета
 * `vite` (code-weight.md — минимум зависимостей в библиотеках), поэтому объявляем
 * нужную часть типа здесь, чтобы strict-typecheck проходил без установки vite.
 *
 * В приложениях (web/admin) полный тип берётся из `vite/client`; ambient-слияние
 * с этим интерфейсом безопасно (поля только добавляются).
 */
interface ImportMetaEnv {
  /** Базовый URL backend REST API (см. shared/api). */
  readonly VITE_API_URL?: string;
  /** Номер WhatsApp офиса-партнёра (формат wa.me, только цифры). */
  readonly VITE_WHATSAPP_NUMBER?: string;
  /** Username Telegram-аккаунта офиса-партнёра (без @). */
  readonly VITE_TELEGRAM_USERNAME?: string;
  /** Username Telegram-бота для захвата ника клиента (?start=<lead_id>), без @. */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  /** Номер Viber офиса-партнёра (по умолчанию = номер WhatsApp). */
  readonly VITE_VIBER_NUMBER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
