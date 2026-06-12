/**
 * Локальная декларация переменных окружения Vite для библиотеки shared/api.
 *
 * shared/api читает import.meta.env.VITE_API_URL (см. config.ts), но сама не
 * зависит от пакета `vite` (code-weight.md — минимум зависимостей в библиотеках).
 * Поэтому объявляем нужную часть типа import.meta здесь, чтобы strict-typecheck
 * библиотеки проходил без установки vite в её devDependencies.
 *
 * В приложениях (web/admin) полный тип берётся из `vite/client`.
 */
interface ImportMetaEnv {
  /** Базовый URL backend REST API. Может быть не задан (используется дефолт). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
