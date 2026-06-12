/**
 * ChatLauncher — плавающий чат-бот на странице (как Intercom/Drift).
 *
 * Классический паттерн: кнопка-«пузырь» закреплена внизу справа; клик открывает
 * всплывающее окно с чат-подбором (ChatWidget) над кнопкой. Та же кнопка служит
 * закрытием (иконка ✕, когда открыто). На мобильных окно занимает почти весь
 * экран, на десктопе — аккуратная карточка у нижнего правого угла.
 *
 * Состояние открыт/закрыт — в @shared/store (useUiStore.chatOpen), чтобы открывать
 * чат и из CTA-секции лендинга (#quiz), и из самой кнопки. Сам чат-сценарий —
 * в ChatWidget (@features), он стартует при монтировании (т.е. при открытии окна).
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@shared/store';
import { ChatWidget } from '@features';
import { cn } from '@shared/ui';

/** Иконка чата (пузырь) для кнопки-лончера. */
function ChatBubbleIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/** Иконка закрытия (✕). */
function CloseIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Плавающая кнопка-лончер + всплывающее окно чат-подбора. */
export function ChatLauncher(): JSX.Element {
  const { t } = useTranslation();
  const chatOpen = useUiStore((s) => s.chatOpen);
  const toggleChat = useUiStore((s) => s.toggleChat);
  const closeChat = useUiStore((s) => s.closeChat);

  // Доступность (US-34/88): при открытии переводим фокус в диалог, Esc закрывает,
  // при закрытии возвращаем фокус на кнопку-лончер.
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chatOpen) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeChat();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      launcherRef.current?.focus();
    };
  }, [chatOpen, closeChat]);

  return (
    <>
      {/* Всплывающее окно чата. Монтируется только когда открыто — чат стартует
          при открытии (ChatWidget сам инициирует сценарий на mount). */}
      {chatOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="false"
          aria-label={t('chat_fab')}
          tabIndex={-1}
          className={cn(
            'fixed z-[60] flex flex-col outline-none',
            // Мобильные: bottom-sheet почти на весь экран (US-76); десктоп: карточка у угла.
            'inset-x-2 top-16 bottom-2 sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-[6.5rem]',
            'sm:w-[400px] sm:max-w-[calc(100vw-3rem)]',
          )}
        >
          {/* Кнопка закрытия в углу окна (дублирует тоггл FAB — для наглядности). */}
          <button
            type="button"
            onClick={closeChat}
            aria-label={t('chat_close')}
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <CloseIcon />
          </button>
          <ChatWidget />
        </div>
      )}

      {/* Плавающая кнопка-лончер (FAB). Тоггл: пузырь ↔ ✕. */}
      <button
        ref={launcherRef}
        type="button"
        onClick={toggleChat}
        aria-expanded={chatOpen}
        aria-label={chatOpen ? t('chat_close') : t('chat_fab')}
        className={cn(
          'fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full shadow-xl transition-all',
          'bg-brand text-white hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30',
          chatOpen ? 'h-14 w-14 justify-center' : 'h-14 px-5',
        )}
      >
        {chatOpen ? <CloseIcon /> : <ChatBubbleIcon />}
        {!chatOpen && <span className="hidden font-semibold sm:inline">{t('chat_fab')}</span>}
      </button>
    </>
  );
}
