/**
 * FreeAsk — строка ввода вопроса в чате.
 *
 * Кнопка отправки — иконка (без текста). Пока поле пустое, плейсхолдер циклично
 * меняется по фразам-подсказкам (`placeholders`), чтобы подсказать темы вопросов
 * без отдельного блока чипсов. Шрифт поля — 16px (text-base): при меньшем iOS
 * Safari зумит страницу при фокусе.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';

export interface FreeAskProps {
  ct: (key: string) => string;
  /** Отправить вопрос (ChatWidget сходит к агенту и добавит ответ). */
  onAsk: (question: string) => void;
  /** Идёт ли сейчас ответ/анимация (блокируем повторную отправку). */
  pending: boolean;
  /** Фразы для циклящегося плейсхолдера (пока поле пустое). */
  placeholders?: string[];
}

/** Интервал смены фразы-плейсхолдера (мс). */
const ROTATE_MS = 2200;

export function FreeAsk({ ct, onAsk, pending, placeholders }: FreeAskProps): JSX.Element {
  const [value, setValue] = useState('');
  const [phIdx, setPhIdx] = useState(0);
  const list = placeholders && placeholders.length > 0 ? placeholders : [ct('ask_ph')];
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Циклим плейсхолдер только когда поле пустое.
  useEffect(() => {
    if (value !== '' || list.length <= 1) return;
    timer.current = setInterval(() => setPhIdx((i) => (i + 1) % list.length), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [value, list.length]);

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const q = value.trim();
    if (!q || pending) return;
    setValue('');
    onAsk(q);
  }

  const placeholder = value === '' ? list[phIdx % list.length] : '';

  return (
    <form className="flex items-center gap-2" onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={ct('ask_title')}
        autoComplete="off"
        enterKeyHint="send"
        // text-base (16px) обязателен: при меньшем шрифте iOS Safari зумит
        // страницу при фокусе на input → ломается вёрстка/скролл.
        className="min-w-0 flex-1 rounded-xl border-[1.5px] border-slate-200 px-3.5 py-2.5 text-base focus:border-brand focus:outline-none"
      />
      <button
        type="submit"
        aria-label={ct('ask_send')}
        title={ct('ask_send')}
        disabled={pending || value.trim().length === 0}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Иконка «отправить» (бумажный самолётик). */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7z" />
        </svg>
      </button>
    </form>
  );
}
