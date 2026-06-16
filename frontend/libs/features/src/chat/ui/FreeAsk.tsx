/**
 * FreeAsk — строка свободного ввода вопроса в чате (рядом с чипсами).
 *
 * Пользователь может тапнуть готовый чипс (вести сценарий) ИЛИ напечатать свой
 * вопрос — ответ ассистента (ИИ) появится инлайн в ленте. Сам диалог свободных
 * вопросов хранит ChatWidget; здесь — только поле ввода + кнопка.
 */
import { useState, type FormEvent } from 'react';
import { Button } from '@shared/ui';

export interface FreeAskProps {
  ct: (key: string) => string;
  /** Отправить вопрос (ChatWidget сходит к ассистенту и добавит ответ). */
  onAsk: (question: string) => void;
  /** Идёт ли сейчас ответ (блокируем повторную отправку). */
  pending: boolean;
}

export function FreeAsk({ ct, onAsk, pending }: FreeAskProps): JSX.Element {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const q = value.trim();
    if (!q || pending) return;
    setValue('');
    onAsk(q);
  }

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={ct('ask_ph')}
        aria-label={ct('ask_title')}
        autoComplete="off"
        enterKeyHint="send"
        className="min-w-0 flex-1 rounded-xl border-[1.5px] border-slate-200 px-3.5 py-2.5 text-[0.92rem] focus:border-brand focus:outline-none"
      />
      <Button
        type="submit"
        disabled={pending || value.trim().length === 0}
        className="shrink-0 px-4 py-2.5"
      >
        {ct('ask_send')}
      </Button>
    </form>
  );
}
