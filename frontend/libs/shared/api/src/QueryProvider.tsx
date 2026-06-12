/**
 * Провайдер TanStack Query для приложений.
 *
 * Оборачивает дерево приложения и предоставляет общий QueryClient всем хукам
 * useQuery/useMutation. Подключается один раз в app-слое каждого приложения
 * (web и admin), как правило вместе с инициализацией i18n.
 *
 * Клиент создаётся через useRef-подобный паттерн (useState-инициализатор),
 * чтобы инстанс был стабильным между ре-рендерами и не пересоздавался.
 */
import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './queryClient';

/** Пропсы провайдера. */
export interface QueryProviderProps {
  /** Дерево приложения, которому нужен доступ к серверным данным. */
  children: ReactNode;
}

/**
 * Оборачивает children в QueryClientProvider со стабильным клиентом.
 * @param props.children - поддерево приложения
 */
export function QueryProvider({ children }: QueryProviderProps): JSX.Element {
  // Ленивая инициализация: клиент создаётся один раз при первом рендере.
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
