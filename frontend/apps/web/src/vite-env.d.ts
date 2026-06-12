/// <reference types="vite/client" />

/**
 * Типы переменных окружения Vite для web-приложения.
 * VITE_API_URL — базовый URL backend (по умолчанию http://localhost:8080).
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
