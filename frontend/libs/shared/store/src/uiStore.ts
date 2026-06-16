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
  /**
   * Активный интент открытия чата (id карточки «Виды страховок»: med|pet|...).
   * Если задан — чат стартует с предвыбранным типом и релевантным вопросом.
   * null — обычный старт (вопрос «какая страховка нужна»). Сбрасывается чатом
   * после применения.
   */
  chatIntent: string | null;
  /** Открыть чат-виджет (обычный старт, без интента). */
  openChat: () => void;
  /** Открыть чат с интентом карточки (предвыбранный тип + релевантный вопрос). */
  openChatWithIntent: (intentId: string) => void;
  /** Сбросить интент (вызывает чат после старта). */
  clearChatIntent: () => void;
  /** Закрыть чат-виджет (свернуть к кнопке-лончеру). */
  closeChat: () => void;
  /** Переключить чат-виджет. */
  toggleChat: () => void;

  /** Открытая правовая страница в модалке (privacy|terms|cookies) или null. */
  legalDoc: string | null;
  /** Открыть правовую страницу в модалке. */
  openLegal: (id: string) => void;
  /** Закрыть правовую модалку. */
  closeLegal: () => void;
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
  chatIntent: null,
  openChat: () => set({ chatOpen: true, chatIntent: null }),
  openChatWithIntent: (intentId: string) => set({ chatOpen: true, chatIntent: intentId }),
  clearChatIntent: () => set({ chatIntent: null }),
  closeChat: () => set({ chatOpen: false }),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),

  legalDoc: null,
  openLegal: (id: string) => set({ legalDoc: id }),
  closeLegal: () => set({ legalDoc: null }),
}));
