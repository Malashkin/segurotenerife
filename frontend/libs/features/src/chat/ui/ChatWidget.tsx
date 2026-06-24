/**
 * ChatWidget — чат-консультант: ответить на вопросы и передать менеджеру.
 *
 * Флоу (по продукту):
 *  1. Приветствие «расскажите, какая нужна страховка».
 *  2. Свободный диалог: пользователь спрашивает → агент отвечает (бренд-нейтрально,
 *     без упоминания, что это ИИ).
 *  3. Когда агент понимает, что вопросов больше нет / человек хочет менеджера
 *     (флаг `handoff` из ответа) ИЛИ по кнопке «Связаться с менеджером» —
 *     короткая анимация «подбираем менеджера» (~3с) → контакты в мессенджерах.
 *
 * НЕТ: пошагового опросника, контактной формы, индикатора ИИ. Лид-капча идёт
 * через мессенджер (deep-link с предзаполненным сообщением менеджеру).
 *
 * Все строки — через @shared/i18n (словарь чата), смена языка перерисовывает
 * чат без перезагрузки.
 */
import { useEffect, useRef, useState } from 'react';
import { useUiStore, DEFAULT_MESSENGER, type ChatMessenger } from '@shared/store';
import { trackEvent, askQuestion, captureEvent } from '@shared/api';
import { FreeAsk } from './FreeAsk';
import { useChatI18n } from '../model/useChatI18n';
import { CHAT_INTENTS } from '../model/intents';
import { buildHandoffLink, continueLabelKey, getOfficeContacts } from '../model/handoff';

/** Длительность анимации «подбираем менеджера» перед показом контактов (мс). */
const MATCHING_MS = 3000;
/** Стартовые вопросы-подсказки на первом экране (ключи словаря `chat`). */
const STARTER_KEYS = ['starter_visa', 'starter_price', 'starter_dental'] as const;
/** Мессенджеры на хендоффе (Instagram не предлагаем). */
const MESSENGERS: readonly ChatMessenger[] = ['WhatsApp', 'Telegram', 'Viber'];

type Msg = { id: number; author: 'user' | 'bot'; text: string };
type Phase = 'chat' | 'matching' | 'handoff';

export function ChatWidget(): JSX.Element {
  const { ct, lang } = useChatI18n();
  const chatIntent = useUiStore((s) => s.chatIntent);
  const clearChatIntent = useUiStore((s) => s.clearChatIntent);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [asking, setAsking] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const idRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const matchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);
  // Последний вопрос пользователя — добавим в предзаполненное сообщение менеджеру.
  const lastQuestionRef = useRef<string>('');

  const push = (author: Msg['author'], text: string) =>
    setMessages((prev) => [...prev, { id: idRef.current++, author, text }]);

  /** Запустить передачу менеджеру: анимация → экран контактов. */
  function goHandoff(source: 'agent' | 'button'): void {
    setPhase((p) => {
      if (p !== 'chat') return p; // уже идёт/завершено
      captureEvent('chat_handoff_started', { source, lang });
      void trackEvent('chat_completed', { lang, meta: { source } });
      if (matchTimer.current) clearTimeout(matchTimer.current);
      matchTimer.current = setTimeout(() => setPhase('handoff'), MATCHING_MS);
      return 'matching';
    });
  }

  /** Вопрос агенту: реплика пользователя → ответ; при handoff — к менеджеру. */
  async function handleAsk(question: string): Promise<void> {
    const q = question.trim();
    if (!q || asking || phase !== 'chat') return;
    lastQuestionRef.current = q;
    push('user', q);
    setAsking(true);
    void trackEvent('question_asked', { lang });
    try {
      const reply = await askQuestion(q, lang, chatIntentKeyRef.current ?? undefined);
      if (reply === null) {
        // Ассистент недоступен (503) — сразу к менеджеру.
        push('bot', ct('assist_off'));
        setAsking(false);
        goHandoff('agent');
        return;
      }
      push('bot', reply.answer);
      setAsking(false);
      if (reply.handoff) goHandoff('agent');
    } catch {
      push('bot', ct('assist_off'));
      setAsking(false);
      goHandoff('agent');
    }
  }

  // Ключ интента карточки (med|dental|pet…) — для RAG-ретривала. Фиксируем в ref,
  // чтобы handleAsk видел его и при авто-вопросе на монтировании.
  const chatIntentKeyRef = useRef<string | null>(null);

  // Старт: приветствие; если открыто из карточки «Виды страховок» — авто-вопрос
  // по выбранному типу (агент сразу объяснит). Один раз на монтирование.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void trackEvent('chat_started', { lang });
    push('bot', ct('greeting'));
    if (chatIntent && CHAT_INTENTS[chatIntent]) {
      chatIntentKeyRef.current = chatIntent;
      void handleAsk(ct(CHAT_INTENTS[chatIntent].goalKey));
      clearChatIntent();
    }
    return () => {
      if (matchTimer.current) clearTimeout(matchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автоскролл ленты вниз.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, asking, phase]);

  function restart(): void {
    if (matchTimer.current) clearTimeout(matchTimer.current);
    chatIntentKeyRef.current = null;
    lastQuestionRef.current = '';
    idRef.current = 0;
    setMessages([{ id: idRef.current++, author: 'bot', text: ct('greeting') }]);
    setAsking(false);
    setPhase('chat');
  }

  const showStarters = phase === 'chat' && messages.length <= 1 && !asking;

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-xl"
      role="region"
      aria-label={ct('title')}
    >
      {/* Шапка. pr-14 — место под ✕ из ChatLauncher (абсолют в правом углу). */}
      <div className="relative flex items-center gap-3 bg-gradient-to-br from-brand-dark to-brand py-[14px] pl-[18px] pr-14 text-white">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 font-extrabold">
          ST
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <b className="truncate text-[0.98rem]">{ct('title')}</b>
          <span className="text-[0.78rem] opacity-90">{ct('status')}</span>
        </div>
      </div>

      {/* Лента */}
      <div
        ref={bodyRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f5f8f8] px-[18px] py-5"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((m) => (
          <div key={m.id} className={m.author === 'user' ? 'max-w-[84%] self-end' : 'max-w-[84%] self-start'}>
            <div
              className={
                m.author === 'user'
                  ? 'rounded-2xl rounded-br-sm bg-brand px-[15px] py-[11px] text-[0.96rem] leading-normal text-white'
                  : 'whitespace-pre-line rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-[11px] text-[0.96rem] leading-relaxed text-ink'
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Индикатор «печатает» */}
        {asking && (
          <div className="max-w-[84%] self-start" role="status" aria-label="…">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-[13px]">
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 motion-safe:animate-pulse" />
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 [animation-delay:0.2s] motion-safe:animate-pulse" />
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 [animation-delay:0.4s] motion-safe:animate-pulse" />
            </div>
          </div>
        )}

        {/* Анимация «подбираем менеджера» */}
        {phase === 'matching' && (
          <div className="my-auto flex flex-col items-center gap-3 py-6 text-center" role="status">
            <span className="inline-block h-9 w-9 animate-spin rounded-full border-[3px] border-brand-tint border-t-brand" />
            <b className="text-[0.98rem] text-ink">{ct('load_h')}</b>
            <span className="text-[0.85rem] text-muted">{ct('load_p')}</span>
          </div>
        )}
      </div>

      {/* Подвал */}
      <div className="border-t border-slate-200 bg-white px-4 py-[14px]">
        {phase === 'chat' && (
          <>
            {showStarters && (
              <div className="mb-3">
                <p className="mb-2 text-[0.78rem] font-medium text-muted">{ct('starters_label')}</p>
                <div className="flex flex-wrap gap-2">
                  {STARTER_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      data-testid="chat-starter"
                      onClick={() => {
                        captureEvent('chat_starter_clicked', { key });
                        void handleAsk(ct(key));
                      }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-left text-[0.85rem] font-medium text-slate-600 transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {ct(key)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <FreeAsk ct={ct} onAsk={handleAsk} pending={asking} />

            <button
              type="button"
              data-testid="chat-to-manager"
              onClick={() => goHandoff('button')}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[0.88rem] font-semibold text-brand-dark transition-colors hover:border-brand hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {ct('to_manager')}
            </button>
          </>
        )}

        {phase === 'handoff' && (
          <HandoffActions ct={ct} lang={lang} lastQuestion={lastQuestionRef.current} onRestart={restart} />
        )}
      </div>
    </div>
  );
}

/** Экран контактов менеджера: deep-link'и на мессенджеры + рестарт. */
function HandoffActions({
  ct,
  lang,
  lastQuestion,
  onRestart,
}: {
  ct: (key: string) => string;
  lang: string;
  lastQuestion: string;
  onRestart: () => void;
}): JSX.Element {
  const contacts = getOfficeContacts();
  // Предзаполненное сообщение менеджеру: приветствие + последний вопрос (контекст).
  const message = lastQuestion ? `${ct('lead_msg')}\n\n${lastQuestion}` : ct('lead_msg');
  const ordered: ChatMessenger[] = [
    DEFAULT_MESSENGER,
    ...MESSENGERS.filter((m) => m !== DEFAULT_MESSENGER),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {ordered.map((m, idx) => (
        <a
          key={m}
          href={buildHandoffLink(m, contacts, message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void trackEvent('handoff_clicked', { lang, meta: { messenger: m } })}
          className={
            idx === 0
              ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
              : 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-ink transition-colors hover:border-brand hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          }
        >
          {ct(continueLabelKey(m))}
        </a>
      ))}

      <p className="flex items-center justify-center gap-1.5 text-center text-[0.84rem] font-medium text-brand-dark">
        <span aria-hidden>⏱️</span>
        {ct('reply_time')}
      </p>

      <button
        type="button"
        onClick={onRestart}
        className="mt-1 text-[0.85rem] text-slate-500 underline hover:text-ink"
      >
        {ct('done_restart')}
      </button>
    </div>
  );
}
