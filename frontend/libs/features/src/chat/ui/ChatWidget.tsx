/**
 * ChatWidget — чат-консультант: сначала отвечаем на вопросы, затем (по запросу
 * или когда агент видит, что вопросов нет) мягко предлагаем менеджера.
 *
 * Принципы UX:
 *  - Чат всегда = шапка + лента сообщений + строка ввода. Ввод доступен ВСЕГДА —
 *    хендофф не «перехватывает» экран и не блокирует продолжение диалога.
 *  - Сначала ценность: на первом экране НЕТ кнопки «к менеджеру» — только
 *    приветствие, подсказки и ввод. Кнопка появляется ПОСЛЕ первого ответа.
 *  - Хендофф — это инлайн-карточка в ленте (контакты мессенджеров) с короткой
 *    анимацией «подбираем менеджера». После неё можно нажать мессенджер ИЛИ
 *    продолжать задавать вопросы (подсказка об этом — под карточкой).
 *  - Агент сам может предложить менеджера (флаг handoff) — тогда карточка
 *    появляется автоматически, но диалог не закрывается.
 *
 * НЕТ: опросника, контактной формы, любого упоминания, что это ИИ/бот.
 * Хендофф идёт через мессенджер (deep-link с предзаполненным сообщением).
 */
import { useEffect, useRef, useState } from 'react';
import { useUiStore, DEFAULT_MESSENGER, type ChatMessenger } from '@shared/store';
import { trackEvent, askQuestion, captureEvent, type ChatTurn } from '@shared/api';
import { FreeAsk } from './FreeAsk';
import { useChatI18n } from '../model/useChatI18n';
import { CHAT_INTENTS } from '../model/intents';
import { buildHandoffLink, continueLabelKey, getOfficeContacts } from '../model/handoff';

/** Длительность анимации «подбираем менеджера» перед показом контактов (мс). */
const MATCHING_MS = 2200;
/** Бездействие, после которого мягко предлагаем менеджера (мс). */
const IDLE_MS = 60_000;
/** Мессенджеры на хендоффе (Instagram не предлагаем). */
const MESSENGERS: readonly ChatMessenger[] = ['WhatsApp', 'Telegram', 'Viber'];

type Msg =
  | { id: number; kind: 'text'; author: 'user' | 'bot'; text: string }
  | { id: number; kind: 'handoff' };

/**
 * Чистит остаточную Markdown-разметку из ответа агента (пузырь рендерит обычный
 * текст, поэтому «звёздочки»/решётки показались бы буквально). Жирный/курсив →
 * без маркеров, заголовки/markdown-списки → обычные строки с «• ».
 */
function cleanReply(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1')
    .replace(/(^|\n)\s*[-*•]\s+/g, '$1• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function ChatWidget(): JSX.Element {
  const { ct, lang } = useChatI18n();
  const chatIntent = useUiStore((s) => s.chatIntent);
  const clearChatIntent = useUiStore((s) => s.clearChatIntent);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [asking, setAsking] = useState(false);
  const [matching, setMatching] = useState(false);
  const idRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const matchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);
  const intentKeyRef = useRef<string | null>(null);
  // Последний вопрос пользователя — добавим в предзаполненное сообщение менеджеру.
  const lastQuestionRef = useRef<string>('');
  // Зеркала состояний для таймера бездействия (читаем актуальное в колбэке).
  const askingRef = useRef(false);
  const matchingRef = useRef(false);
  askingRef.current = asking;
  matchingRef.current = matching;

  const pushText = (author: 'user' | 'bot', text: string) =>
    setMessages((prev) => [...prev, { id: idRef.current++, kind: 'text', author, text }]);

  /** Показать карточку контактов менеджера (инлайн, с короткой анимацией). */
  function offerHandoff(source: 'agent' | 'button' | 'idle'): void {
    if (matchingRef.current) return;
    setMessages((prev) => {
      // Не дублируем, если последняя реплика — уже карточка хендоффа.
      if (prev.at(-1)?.kind === 'handoff') return prev;
      captureEvent('chat_handoff_offered', { source, lang });
      void trackEvent('chat_completed', { lang, meta: { source } });
      setMatching(true);
      if (matchTimer.current) clearTimeout(matchTimer.current);
      matchTimer.current = setTimeout(() => {
        setMatching(false);
        setMessages((p) => [...p, { id: idRef.current++, kind: 'handoff' }]);
      }, MATCHING_MS);
      return prev;
    });
  }

  /** Вопрос агенту: реплика пользователя → ответ; при handoff — карточка менеджера. */
  async function handleAsk(question: string): Promise<void> {
    const q = question.trim();
    if (!q || asking || matching) return;
    // История диалога ДО текущего вопроса (без приветствия — первого bot-сообщения),
    // последние реплики, для удержания контекста на бэкенде.
    const history: ChatTurn[] = messages
      .filter((m): m is Extract<Msg, { kind: 'text' }> => m.kind === 'text')
      .slice(1)
      .slice(-10)
      .map((m) => ({ role: m.author === 'user' ? 'user' : 'assistant', content: m.text }));
    lastQuestionRef.current = q;
    pushText('user', q);
    setAsking(true);
    void trackEvent('question_asked', { lang });
    try {
      const reply = await askQuestion(q, lang, intentKeyRef.current ?? undefined, history);
      if (reply === null) {
        pushText('bot', ct('assist_off'));
        setAsking(false);
        offerHandoff('agent');
        return;
      }
      pushText('bot', reply.answer);
      setAsking(false);
      if (reply.handoff) offerHandoff('agent');
    } catch {
      pushText('bot', ct('assist_off'));
      setAsking(false);
      offerHandoff('agent');
    }
  }

  // Старт: приветствие; если открыто из карточки «Виды страховок» — авто-вопрос
  // по выбранному типу. Один раз на монтирование.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void trackEvent('chat_started', { lang });
    pushText('bot', ct('greeting'));
    if (chatIntent && CHAT_INTENTS[chatIntent]) {
      intentKeyRef.current = chatIntent;
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
  }, [messages.length, asking, matching]);

  /** Перезапустить таймер бездействия. По истечении — мягко предложить менеджера. */
  function armIdle(): void {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!askingRef.current && !matchingRef.current) offerHandoff('idle');
    }, IDLE_MS);
  }

  // Перезапускаем таймер бездействия при любой активности/смене состояния.
  useEffect(() => {
    armIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, asking, matching]);

  const userMsgCount = messages.filter((m) => m.kind === 'text' && m.author === 'user').length;
  const lastIsHandoff = messages.at(-1)?.kind === 'handoff';
  // Кнопку «к менеджеру» показываем только после первого ответа и не когда
  // карточка уже на экране / идёт анимация.
  const showToManager = userMsgCount > 0 && !asking && !matching && !lastIsHandoff;
  // Фразы для циклящегося плейсхолдера ввода (вместо блока чипсов).
  const rotatingPlaceholders = ct('rot_phrases').split('|').filter(Boolean);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-xl"
      role="region"
      aria-label={ct('title')}
    >
      {/* Шапка. pr-14 — место под ✕ из ChatLauncher (абсолют в правом углу). */}
      <div className="relative flex items-center gap-3 bg-gradient-to-br from-brand-dark to-brand py-[14px] pl-[18px] pr-14 text-white">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
          {/* Логотип-щит (белый, т.к. фон шапки цветной). */}
          <svg className="h-6 w-6" viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M16 2.5 L27 7 V15 C27 22.4 22.2 27.4 16 29.5 C9.8 27.4 5 22.4 5 15 V7 Z"
              fill="#fff"
            />
            <circle cx="11.6" cy="12.2" r="2" fill="#0f766e" />
            <path d="M7.5 21.8 L12.4 15.2 L15.4 19 L19 13.4 L24.5 21.8 Z" fill="#0f766e" />
          </svg>
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
        {messages.map((m) =>
          m.kind === 'handoff' ? (
            <HandoffCard
              key={m.id}
              ct={ct}
              lang={lang}
              message={
                lastQuestionRef.current
                  ? `${ct('lead_msg')}\n\n${lastQuestionRef.current}`
                  : ct('lead_msg')
              }
            />
          ) : (
            <div
              key={m.id}
              className={`max-w-[84%] motion-safe:animate-msgIn ${m.author === 'user' ? 'self-end' : 'self-start'}`}
            >
              <div
                className={
                  m.author === 'user'
                    ? 'rounded-2xl rounded-br-sm bg-brand px-[15px] py-[11px] text-[0.96rem] leading-normal text-white'
                    : 'whitespace-pre-line rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-[11px] text-[0.96rem] leading-relaxed text-ink'
                }
              >
                {m.author === 'bot' ? cleanReply(m.text) : m.text}
              </div>
            </div>
          ),
        )}

        {/* «печатает» / «подбираем менеджера» — компактные инлайн-индикаторы */}
        {asking && (
          <div className="max-w-[84%] self-start motion-safe:animate-fadeIn" role="status" aria-label="…">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-[13px]">
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 motion-safe:animate-pulse" />
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 [animation-delay:0.2s] motion-safe:animate-pulse" />
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 [animation-delay:0.4s] motion-safe:animate-pulse" />
            </div>
          </div>
        )}
        {matching && (
          <div className="self-start motion-safe:animate-msgIn" role="status">
            <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-tint border-t-brand" />
              <span className="text-[0.9rem] font-medium text-ink">{ct('load_h')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Подвал: ввод всегда доступен; над ним — кнопка «к менеджеру»
          (после первого ответа). Подсказки тем — в циклящемся плейсхолдере ввода. */}
      <div className="border-t border-slate-200 bg-white px-4 py-[14px]">
        {showToManager && (
          <button
            type="button"
            data-testid="chat-to-manager"
            onClick={() => offerHandoff('button')}
            className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[0.88rem] font-semibold text-brand-dark transition-colors hover:border-brand hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {ct('to_manager')}
          </button>
        )}

        <FreeAsk
          ct={ct}
          onAsk={handleAsk}
          pending={asking || matching}
          placeholders={rotatingPlaceholders}
          onActivity={armIdle}
        />
      </div>
    </div>
  );
}

/** Инлайн-карточка контактов менеджера в ленте. */
function HandoffCard({
  ct,
  lang,
  message,
}: {
  ct: (key: string) => string;
  lang: string;
  message: string;
}): JSX.Element {
  const contacts = getOfficeContacts();
  const ordered: ChatMessenger[] = [
    DEFAULT_MESSENGER,
    ...MESSENGERS.filter((m) => m !== DEFAULT_MESSENGER),
  ];

  return (
    <div className="self-stretch rounded-2xl border border-slate-200 bg-white p-3.5 motion-safe:animate-msgIn">
      <div className="flex flex-col gap-2">
        {ordered.map((m, idx) => (
          <a
            key={m}
            href={buildHandoffLink(m, contacts, message)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void trackEvent('handoff_clicked', { lang, meta: { messenger: m } })}
            className={
              idx === 0
                ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-[0.95rem] font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                : 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[0.95rem] font-semibold text-ink transition-colors hover:border-brand hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
            }
          >
            {ct(continueLabelKey(m))}
          </a>
        ))}
      </div>
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[0.82rem] font-medium text-brand-dark">
        <span aria-hidden>⏱️</span>
        {ct('reply_time')}
      </p>
      <p className="mt-1 text-center text-[0.8rem] text-muted">{ct('handoff_or_continue')}</p>
    </div>
  );
}
