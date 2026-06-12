/**
 * Конфигурация доступа к backend REST API.
 *
 * Базовый URL берётся из Vite-переменной окружения VITE_API_URL.
 * Если переменная не задана (локальная разработка) — используем дефолт
 * http://localhost:8080, как договорено с backend.
 *
 * import.meta.env типизируется через `vite/client` (см. tsconfig types).
 */

/** Дефолтный базовый URL backend для локальной разработки. */
const DEFAULT_API_URL = 'http://localhost:8080';

/**
 * Возвращает базовый URL API без завершающего слэша.
 * Endpoint'ы строятся как `${getApiBaseUrl()}/api/leads`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env?.VITE_API_URL as string | undefined;
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_API_URL;
  // Убираем хвостовой слэш, чтобы не получить двойной `//` при склейке путей.
  return base.replace(/\/+$/, '');
}
