/**
 * AskAssistant — свободный вопрос ассистенту по базе знаний ASISA (Волна C).
 *
 * Показывается на экране хендоффа: пока пользователь ждёт менеджера, он может
 * задать вопрос («какой полис для ВНЖ?», «есть ли семейная стоматология?») и
 * получить ответ из каталога ASISA (бот отвечает фактами, цены не выдумывает).
 *
 * Деградация: если ассистент не настроен на сервере (503) или произошла ошибка,
 * показываем мягкий фолбэк («ответит менеджер») — пользователь ничего не теряет.
 */
import { useRef, useState, type FormEvent } from 'react';
import { askQuestion } from '@shared/api';
import { Button } from '@shared/ui';

/** Одна реплика в мини-диалоге с ассистентом. */
interface QA {
  id: number;
  author: 'user' | 'bot';
  text: string;
}

export function AskAssistant({
  ct,
  lang,
}: {
  ct: (key: string) => string;
  lang: string;
}): JSX.Element {
  const [value, setValue] = useState('');
  const [items, setItems] = useState<QA[]>([]);
  const [pending, setPending] = useState(false);
  const nextId = useRef(0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const q = value.trim();
    if (!q || pending) return;
    setValue('');
    setItems((prev) => [...prev, { id: nextId.current++, author: 'user', text: q }]);
    setPending(true);
    try {
      const answer = await askQuestion(q, lang);
      // null → ассистент недоступен (503): мягкий фолбэк на менеджера.
      const text = answer ?? ct('here');
      setItems((prev) => [...prev, { id: nextId.current++, author: 'bot', text }]);
    } catch {
      setItems((prev) => [...prev, { id: nextId.current++, author: 'bot', text: ct('here') }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <p className="mb-2 text-[0.86rem] font-semibold text-ink">{ct('ask_title')}</p>

      {items.length > 0 && (
        <div className="mb-3 flex max-h-[180px] flex-col gap-2 overflow-y-auto">
          {items.map((m) => (
            <div
              key={m.id}
              className={
                m.author === 'user' ? 'max-w-[88%] self-end' : 'max-w-[88%] self-start'
              }
            >
              <div
                className={
                  m.author === 'user'
                    ? 'rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-[0.9rem] text-white'
                    : 'rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2 text-[0.9rem] text-ink'
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {pending && (
            <span className="self-start text-[0.82rem] text-muted">{ct('ask_thinking')}</span>
          )}
        </div>
      )}

      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={ct('ask_ph')}
          aria-label={ct('ask_title')}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border-[1.5px] border-slate-200 px-3.5 py-2.5 text-[0.92rem] focus:border-brand focus:outline-none"
        />
        <Button type="submit" disabled={pending || value.trim().length === 0} className="shrink-0 px-4 py-2.5">
          {ct('ask_send')}
        </Button>
      </form>
    </div>
  );
}
