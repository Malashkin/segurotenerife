/**
 * ChatWidget — встроенный в страницу чат-подбор страховки.
 *
 * Порт виджета из прототипа /Users/mike/Desktop/fun/index.html (пузырьки бота/
 * пользователя, индикатор «печатает», кнопки быстрых ответов, 6-шаговый сценарий,
 * контактная форма, экран «подбираем менеджера» → «менеджер получил заявку» с
 * deep-link'ами на WhatsApp/Telegram/Viber).
 *
 * Архитектура (FSD/SOUL):
 *  - Состояние сценария — в @shared/store (useChatStore: stepIndex/phase/answers/picked).
 *  - Все строки — через @shared/i18n (+ самодостаточный namespace `chat` фичи),
 *    поэтому смена языка переключателем перерисовывает чат БЕЗ перезагрузки.
 *  - Отправка лида — через @shared/api useCreateLead (POST /api/leads). «Голый
 *    fetch» в компоненте запрещён (api.md) — только хук-мутация.
 *  - Примитивы (кнопка) — из @shared/ui.
 *
 * Тайминг «печати»: фаза 'thinking' держится короткой паузой, затем переходит в
 * 'quick'/'form' (зеркало addBot()→setTimeout 650мс прототипа). Таймеры чистятся
 * при размонтировании и при смене шага, чтобы не было гонок.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CHAT_FLOW,
  CHAT_STEP_COUNT,
  DEFAULT_MESSENGER,
  useChatStore,
  useUiStore,
  type ChatMessenger,
} from '@shared/store';
import { useCreateLead, type CreateLeadRequest } from '@entities';
import { trackEvent, askQuestion } from '@shared/api';
import { Button } from '@shared/ui';
import { FreeAsk } from './FreeAsk';
import { useChatI18n } from '../model/useChatI18n';
import { useChatMessages } from '../model/useChatMessages';
import { STEP_OPTIONS, toPicked, type StepOption } from '../model/options';
import { CHAT_INTENTS, type ChatIntent } from '../model/intents';
import {
  buildHandoffLink,
  continueLabelKey,
  getOfficeContacts,
  type HandoffMessageParts,
} from '../model/handoff';

/** Пауза «печати» бота перед показом вопроса (мс), как в прототипе (650). */
const TYPING_MS = 650;

/** Мессенджеры, предлагаемые на хендоффе (Instagram НЕ предлагаем). */
const MESSENGERS: readonly ChatMessenger[] = ['WhatsApp', 'Telegram', 'Viber'];

export function ChatWidget(): JSX.Element {
  const { ct, lang } = useChatI18n();

  // --- Доменное состояние чата (селекторы, чтобы не ловить лишние ре-рендеры) ---
  const phase = useChatStore((s) => s.phase);
  const stepIndex = useChatStore((s) => s.stepIndex);
  const answers = useChatStore((s) => s.answers);
  const start = useChatStore((s) => s.start);
  const pick = useChatStore((s) => s.pick);
  const setPhase = useChatStore((s) => s.setPhase);
  const setName = useChatStore((s) => s.setName);
  const setContactValue = useChatStore((s) => s.setContact);
  const setMessenger = useChatStore((s) => s.setMessenger);
  const setConsent = useChatStore((s) => s.setConsent);
  const complete = useChatStore((s) => s.complete);
  const reset = useChatStore((s) => s.reset);
  const back = useChatStore((s) => s.back);
  const startWithGoal = useChatStore((s) => s.startWithGoal);

  // --- Интент карточки «Виды страховок»: предвыбранный тип + релевантный вопрос ---
  const chatIntent = useUiStore((s) => s.chatIntent);
  const clearChatIntent = useUiStore((s) => s.clearChatIntent);
  const [activeIntent, setActiveIntent] = useState<ChatIntent | null>(null);

  // Индекс шага 'who' и override его вопроса для активного интента (напр. питомцы:
  // «какой у вас питомец?» вместо «кого страхуем»).
  const whoIndex = CHAT_FLOW.findIndex((s) => s.key === 'who');
  const questionOverrides =
    activeIntent?.customWho && whoIndex >= 0
      ? { [whoIndex]: ct(activeIntent.customWho.askKey) }
      : undefined;
  const messages = useChatMessages(ct, questionOverrides);

  // --- Локальное UI-состояние формы (только ввод; «истина» по сабмиту в сторе) ---
  const [name, setNameLocal] = useState('');
  const [contact, setContactLocal] = useState('');
  const [messenger, setMessengerLocal] = useState<ChatMessenger>(DEFAULT_MESSENGER);
  const [consent, setConsentLocal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Поповер «ⓘ»: пометка, что подбор выполняет ИИ.
  const [aiNoteOpen, setAiNoteOpen] = useState(false);
  // Свободные вопросы ассистенту (инлайн, рядом с чипсами) и индикатор ответа.
  const [freeItems, setFreeItems] = useState<
    { id: number; author: 'user' | 'bot'; text: string }[]
  >([]);
  const [asking, setAsking] = useState(false);
  const freeIdRef = useRef(0);

  /** Свободный вопрос: добавляем реплику пользователя, спрашиваем ИИ, добавляем ответ. */
  async function handleAsk(question: string): Promise<void> {
    setFreeItems((prev) => [...prev, { id: freeIdRef.current++, author: 'user', text: question }]);
    setAsking(true);
    void trackEvent('question_asked', { lang });
    try {
      const answer = await askQuestion(question, lang);
      // null → ассистент недоступен (503): мягкий фолбэк на менеджера.
      const text = answer ?? ct('here');
      setFreeItems((prev) => [...prev, { id: freeIdRef.current++, author: 'bot', text }]);
    } catch {
      setFreeItems((prev) => [...prev, { id: freeIdRef.current++, author: 'bot', text: ct('here') }]);
    } finally {
      setAsking(false);
    }
  }

  const createLead = useCreateLead();

  // Контейнер ленты — для автоскролла вниз (как scrollDown() прототипа).
  const bodyRef = useRef<HTMLDivElement>(null);
  // Таймер «печати» — чистим при смене шага/размонтировании.
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Гард, чтобы событие `chat_started` ушло ровно один раз за монтирование
  // (в т.ч. при двойном вызове эффектов в StrictMode на dev).
  const startedRef = useRef(false);

  // 1. Старт чата при монтировании попапа. Если открыт из карточки «Виды
  //    страховок» (chatIntent) — стартуем с предвыбранным типом и релевантным
  //    вопросом; иначе обычный старт (если чат ещё не идёт).
  useEffect(() => {
    const intent = chatIntent ? CHAT_INTENTS[chatIntent] : undefined;
    if (intent) {
      setActiveIntent(intent);
      startWithGoal(ct(intent.goalKey));
      clearChatIntent();
    } else if (useChatStore.getState().phase === 'idle') {
      start();
    }
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
    // Запуск один раз при монтировании (интент читается на момент открытия).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1b. Аналитика: фиксируем начало воронки один раз (вершина воронки —
  //     с ним сравнивается handoff rate).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void trackEvent('chat_started', { lang });
  }, [lang]);

  // 2. Тайминг «печати»: когда фаза 'thinking', выждать паузу и раскрыть
  //    интерактив текущего шага (quick/form). Зеркало addBot()→cb прототипа.
  useEffect(() => {
    if (phase !== 'thinking') return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      const cur = CHAT_FLOW[useChatStore.getState().stepIndex];
      setPhase(cur?.kind === 'form' ? 'form' : 'quick');
    }, TYPING_MS);
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [phase, stepIndex, setPhase]);

  // 3. Автоскролл ленты вниз при появлении новых сообщений/фазы/свободных Q&A.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, phase, freeItems.length, asking]);

  // --- Обработчики ---

  /** Выбор быстрого ответа на текущем шаге. */
  function handlePick(opt: StepOption): void {
    // Ключ шага фиксируем ДО pick() — после него stepIndex уже сдвинется.
    const stepKey = CHAT_FLOW[useChatStore.getState().stepIndex]?.key;
    pick(toPicked(opt, ct));
    void trackEvent('step_completed', {
      lang,
      ...(stepKey ? { meta: { step: stepKey } } : {}),
    });
  }

  /** Сабмит контактной формы: валидация → POST лида → экран хендоффа. */
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedContact = contact.trim();

    if (!trimmedName) {
      setFormError(ct('val_name'));
      return;
    }
    if (!trimmedContact) {
      setFormError(ct('val_contact'));
      return;
    }
    if (!consent) {
      setFormError(ct('val_consent'));
      return;
    }
    setFormError(null);

    // Зафиксировать данные формы в сторе (для перерисовки истории/хендоффа).
    setName(trimmedName);
    setContactValue(trimmedContact);
    setMessenger(messenger);
    setConsent(true);

    // Перейти на экран «подбираем менеджера» (load_h) сразу.
    setPhase('done');

    // Собрать payload по контракту лида и отправить.
    const payload: CreateLeadRequest = {
      name: trimmedName,
      contact: trimmedContact,
      messenger,
      consent: true,
      comm_lang: answers.lang ?? lang,
      ui_lang: lang,
    };
    if (answers.goal) payload.goal = answers.goal;
    if (answers.who) payload.who = answers.who;
    if (answers.city) payload.city = answers.city;
    if (answers.urgency) payload.urgency = answers.urgency;

    try {
      const res = await createLead.mutateAsync(payload);
      complete(); // фаза остаётся 'done'; фиксируем факт успеха
      // Аналитика: лид доехал до backend (низ воронки до хендоффа).
      void trackEvent('chat_completed', { lang, meta: { messenger } });
      void res;
    } catch {
      // Даже при сетевой ошибке показываем экран хендоффа: пользователь может
      // написать менеджеру сам по deep-link. Контекст лида не теряется.
      complete();
    }
  }

  /** Полный перезапуск чата (кнопка «пройти заново») — сбрасывает и интент. */
  function handleRestart(): void {
    setNameLocal('');
    setContactLocal('');
    setMessengerLocal(DEFAULT_MESSENGER);
    setConsentLocal(false);
    setFormError(null);
    setActiveIntent(null);
    reset();
    start();
  }

  // --- Производное для рендера ---
  // Прогресс подбора: «шаг N из M» + ширина полосы. Снимает неизвестность —
  // пользователь видит, сколько осталось (US-38). На экране 'done' — 100%.
  const totalSteps = CHAT_STEP_COUNT;
  const stepNumber = phase === 'done' ? totalSteps : Math.min(stepIndex + 1, totalSteps);
  const progressPct = Math.round((stepNumber / totalSteps) * 100);
  const currentStep = CHAT_FLOW[stepIndex];
  const showTyping = phase === 'thinking';
  const showQuick = phase === 'quick' && currentStep?.kind === 'quick';
  const showForm = phase === 'form' && currentStep?.kind === 'form';
  const showDone = phase === 'done';
  // Опции текущего шага. Для интента с кастомным шагом 'who' (питомцы) — свои
  // быстрые ответы (собака/кошка/другой) вместо общих «один/пара/семья».
  const quickOptions: readonly StepOption[] =
    activeIntent?.customWho && currentStep?.key === 'who'
      ? activeIntent.customWho.options
      : currentStep
        ? (STEP_OPTIONS[currentStep.key] ?? [])
        : [];

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-xl sm:h-auto"
      role="region"
      aria-label={ct('title')}
    >
      {/* Шапка чата. Справа зарезервировано место (pr-14) под кнопку закрытия
          попапа (✕ из ChatLauncher — абсолют в правом верхнем углу). Плашку
          «бесплатно/ни к чему не обязывает» в шапке не показываем: на узком
          попапе она наслаивалась на ✕, а сам месседж уже есть на лендинге
          (trust-чипы в hero и подпись под секцией подбора). */}
      <div className="relative flex items-center gap-3 bg-gradient-to-br from-brand-dark to-brand py-[14px] pl-[18px] pr-14 text-white">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 font-extrabold">
          ST
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <b className="text-[0.98rem]">{ct('title')}</b>
          <span className="text-[0.78rem] opacity-90">{ct('status')}</span>
        </div>

        {/* «ⓘ» — пометка, что подбор выполняет ИИ (по клику — поясняющий поповер). */}
        <button
          type="button"
          onClick={() => setAiNoteOpen((v) => !v)}
          aria-label={ct('ai_label')}
          aria-expanded={aiNoteOpen}
          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
        {aiNoteOpen && (
          <div
            role="status"
            className="absolute right-2 top-full z-20 mt-1 w-[min(300px,calc(100%-1rem))] rounded-xl border border-slate-200 bg-white p-3 text-[0.8rem] leading-snug text-ink shadow-lg motion-safe:animate-fadeIn"
          >
            🤖 {ct('ai_note')}
          </div>
        )}
      </div>

      {/* Индикатор прогресса подбора (шаг N из M). Скрыт на завершающем экране. */}
      {phase !== 'idle' && phase !== 'done' && (
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-white px-[18px] py-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[0.72rem] font-semibold tabular-nums text-muted">
            {stepNumber}/{totalSteps}
          </span>
        </div>
      )}

      {/* Лента сообщений */}
      <div
        ref={bodyRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f5f8f8] px-[18px] py-5 sm:h-[360px] sm:max-h-[56vh] sm:flex-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.author === 'user'
                ? 'max-w-[84%] self-end'
                : 'max-w-[84%] self-start'
            }
          >
            <div
              className={
                m.author === 'user'
                  ? 'rounded-2xl rounded-br-sm bg-brand px-[15px] py-[11px] text-[0.96rem] leading-normal text-white'
                  : 'rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-[11px] text-[0.96rem] leading-normal text-ink'
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Свободные вопросы ассистенту (инлайн, помимо гайдового сценария). */}
        {freeItems.map((m) => (
          <div key={`free-${m.id}`} className={m.author === 'user' ? 'max-w-[84%] self-end' : 'max-w-[84%] self-start'}>
            <div
              className={
                m.author === 'user'
                  ? 'rounded-2xl rounded-br-sm bg-brand px-[15px] py-[11px] text-[0.96rem] leading-normal text-white'
                  : 'rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-[11px] text-[0.96rem] leading-normal text-ink'
              }
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Индикатор «печатает»: гайдовый шаг (thinking) ИЛИ ответ ассистента (asking). */}
        {(showTyping || asking) && (
          <div className="max-w-[84%] self-start" aria-label="…" role="status">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-[15px] py-[13px]">
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 motion-safe:animate-pulse" />
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 [animation-delay:0.2s] motion-safe:animate-pulse" />
              <span className="h-[7px] w-[7px] rounded-full bg-slate-300 [animation-delay:0.4s] motion-safe:animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Подвал: интерактив текущей фазы (кнопки / форма / хендофф) */}
      <div className="border-t border-slate-200 bg-white px-4 py-[14px]">
        {/* Шаг назад: поправить предыдущий ответ, не начиная заново (US-40). */}
        {(showQuick || showForm) && stepIndex > 0 && (
          <button
            type="button"
            onClick={() => back()}
            className="mb-3 inline-flex items-center gap-1 text-[0.82rem] font-medium text-muted transition-colors hover:text-brand-dark"
          >
            {ct('q_back')}
          </button>
        )}

        {/* Быстрые ответы */}
        {showQuick && (
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((opt, i) => {
              const label = opt.optionKey ? ct(opt.optionKey) : (opt.value ?? '');
              return (
                <button
                  key={opt.optionKey ?? opt.value ?? i}
                  type="button"
                  data-testid="chat-option"
                  onClick={() => handlePick(opt)}
                  className="rounded-full border-[1.5px] border-brand bg-white px-[15px] py-[9px] text-[0.92rem] font-semibold text-brand-dark transition-colors hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Контактная форма (последний шаг) */}
        {showForm && (
          <form className="flex flex-col" onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="chat-name" className="mb-[7px] block text-[0.9rem] font-semibold">
                {ct('f_name_l')}
              </label>
              <input
                id="chat-name"
                type="text"
                value={name}
                onChange={(e) => setNameLocal(e.target.value)}
                placeholder={ct('f_name_ph')}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                className="w-full rounded-xl border-[1.5px] border-slate-200 px-[15px] py-[14px] text-base focus:border-brand focus:outline-none"
              />
            </div>

            <div className="mb-3">
              <span className="mb-[7px] block text-[0.9rem] font-semibold">{ct('f_msgr_l')}</span>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={ct('f_msgr_l')}>
                {MESSENGERS.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-slate-200 px-3.5 py-3 font-medium hover:border-brand"
                  >
                    <input
                      type="radio"
                      name="chat-messenger"
                      value={m}
                      checked={messenger === m}
                      onChange={() => setMessengerLocal(m)}
                      className="accent-brand"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="chat-contact" className="mb-[7px] block text-[0.9rem] font-semibold">
                {ct('f_contact_l')}
              </label>
              <input
                id="chat-contact"
                type="text"
                value={contact}
                onChange={(e) => setContactLocal(e.target.value)}
                placeholder={ct('f_contact_ph')}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                className="w-full rounded-xl border-[1.5px] border-slate-200 px-[15px] py-[14px] text-base focus:border-brand focus:outline-none"
              />
            </div>

            <label className="mb-[18px] mt-1.5 flex items-start gap-2.5 text-[0.85rem] text-slate-500">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsentLocal(e.target.checked)}
                className="mt-[3px] accent-brand"
              />
              <span>{ct('consent_text')}</span>
            </label>

            {formError && (
              <p role="alert" className="mb-3 text-[0.85rem] font-medium text-red-600">
                {formError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={createLead.isPending}>
              {ct('btn_send')}
            </Button>
          </form>
        )}

        {/* Экран хендоффа (после отправки) */}
        {showDone && <HandoffActions ct={ct} lang={lang} onRestart={handleRestart} />}

        {/* Свободный ввод вопроса — рядом с чипсами на шагах подбора и на хендоффе.
            Пользователь может тапнуть чипс (вести сценарий) ИЛИ спросить своё (ИИ
            ответит инлайн). На шаге контактной формы не показываем, чтобы не мешать. */}
        {(showQuick || showDone) && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-center text-[0.78rem] text-muted">{ct('ask_or')}</p>
            <FreeAsk ct={ct} onAsk={handleAsk} pending={asking} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Блок действий после отправки лида: deep-link'и на предпочтённый и
 * альтернативные мессенджеры + текст «можете продолжить здесь» + рестарт.
 */
function HandoffActions({
  ct,
  lang,
  onRestart,
}: {
  ct: (key: string) => string;
  lang: string;
  onRestart: () => void;
}): JSX.Element {
  const answers = useChatStore((s) => s.answers);
  const contacts = getOfficeContacts();

  const preferred: ChatMessenger = answers.messenger ?? DEFAULT_MESSENGER;
  // Порядок кнопок: предпочтённый мессенджер первым, затем остальные.
  const ordered: ChatMessenger[] = [
    preferred,
    ...MESSENGERS.filter((m) => m !== preferred),
  ];

  const parts: HandoffMessageParts = {
    intro: ct('lead_msg'),
    goalLine: `${ct('s2_h')} ${answers.goal ?? '-'}`,
    whoLine: `${ct('s3_h')} ${answers.who ?? '-'}`,
    cityLine: `${ct('s4_h')} ${answers.city ?? '-'}`,
    urgencyLine: `${ct('s5_h')} ${answers.urgency ?? '-'}`,
    nameLine: `${ct('f_name_l')}: ${answers.name ?? '-'}`,
  };

  return (
    <div className="flex flex-col gap-2.5">
      {ordered.map((m, idx) => (
        <a
          key={m}
          href={buildHandoffLink(m, contacts, parts)}
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

      <span className="text-center text-[0.84rem] text-slate-500">{ct('here')}</span>

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
