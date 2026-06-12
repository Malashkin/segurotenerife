/**
 * Конфигурация TanStack Query (React Query).
 *
 * По api.md SOUL TanStack Query — единственный способ работы с серверными данными.
 * Здесь создаётся QueryClient с разумными дефолтами; провайдер (QueryProvider)
 * оборачивает дерево приложения в app-слое.
 */
import { QueryClient } from '@tanstack/react-query';

/**
 * Создаёт новый QueryClient с дефолтами проекта.
 * Отдельная фабрика (а не синглтон) — чтобы в тестах можно было создать
 * чистый клиент, а каждое приложение держало свой инстанс.
 *
 * Дефолты:
 *   - retry: 1   — одна повторная попытка при сетевой ошибке (без агрессивных ретраев).
 *   - staleTime: 30s — данные считаются свежими 30 секунд, меньше лишних запросов.
 *   - refetchOnWindowFocus: false — не дёргаем сервер при каждом фокусе вкладки.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
