/**
 * Локальная декларация переменных окружения Vite для библиотеки entities.
 *
 * entities транзитивно тянет shared/api/config.ts, который обращается к
 * import.meta.env.VITE_API_URL. Сама библиотека не зависит от пакета `vite`
 * (code-weight.md — минимум зависимостей в библиотеках), поэтому объявляем
 * нужную часть типа здесь, чтобы strict-typecheck проходил без установки vite.
 *
 * В приложениях (web/admin) полный тип берётся из `vite/client`; ambient-слияние
 * с этим интерфейсом безопасно (поля только добавляются).
 */
interface ImportMetaEnv {
  /** Базовый URL backend REST API (см. shared/api). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
