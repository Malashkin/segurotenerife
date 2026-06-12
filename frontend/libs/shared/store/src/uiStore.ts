/**
 * UI-стор (Zustand) — пример доменного стора для клиентского состояния.
 *
 * По frontend.md SOUL клиентское состояние держим в Zustand (а серверное — в
 * TanStack Query, не смешиваем). Сторы группируются по доменам; это заготовка
 * домена `ui`. Контентные агенты добавят домены (например `chat` для прогресса
 * шагов чат-подбора) рядом, отдельными файлами.
 *
 * Обновления только через set() (иммутабельность по frontend.md) — никаких
 * прямых мутаций объекта состояния.
 */
import { create } from 'zustand';

/** Состояние и действия UI-домена. */
interface UiState {
  /** Открыто ли мобильное меню навигации. */
  mobileMenuOpen: boolean;
  /** Переключает мобильное меню. */
  toggleMobileMenu: () => void;
  /** Явно задаёт состояние мобильного меню. */
  setMobileMenuOpen: (open: boolean) => void;

  /** Открыт ли плавающий чат-виджет (попап чат-подбора). */
  chatOpen: boolean;
  /** Открыть чат-виджет. */
  openChat: () => void;
  /** Закрыть чат-виджет (свернуть к кнопке-лончеру). */
  closeChat: () => void;
  /** Переключить чат-виджет. */
  toggleChat: () => void;
}

/**
 * Хук доступа к UI-стору.
 * Подписывайтесь на конкретные поля через селектор (frontend.md), например:
 *   const open = useUiStore((s) => s.mobileMenuOpen);
 * чтобы избежать лишних ре-рендеров.
 */
export const useUiStore = create<UiState>((set) => ({
  mobileMenuOpen: false,
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  setMobileMenuOpen: (open: boolean) => set({ mobileMenuOpen: open }),

  chatOpen: false,
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
}));
