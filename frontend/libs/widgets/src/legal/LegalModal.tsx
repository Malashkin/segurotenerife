/**
 * LegalModal — модальное окно правовых страниц (Privacy / Terms / Cookies).
 *
 * Открывается из футера (useUiStore.openLegal). Контент — из legalContent.ts на
 * языке интерфейса. Без роутера: модалка поверх лендинга. Адаптивно: на мобиле
 * почти на весь экран, на десктопе — карточка по центру со скроллом.
 *
 * Доступность: role="dialog" aria-modal, Esc закрывает, фокус в окно при открытии,
 * клик по фону закрывает, уважение prefers-reduced-motion (без анимаций).
 */
import { useEffect, useRef } from 'react';
import { useLang } from '@shared/i18n';
import { useUiStore } from '@shared/store';
import { LEGAL, type LegalDocId } from './legalContent';

const DOC_IDS: readonly LegalDocId[] = ['privacy', 'terms', 'cookies'];

/** Узкий тип-гард: строка из стора → валидный id документа. */
function isLegalDocId(v: string | null): v is LegalDocId {
  return v !== null && (DOC_IDS as readonly string[]).includes(v);
}

export function LegalModal(): JSX.Element | null {
  const legalDoc = useUiStore((s) => s.legalDoc);
  const closeLegal = useUiStore((s) => s.closeLegal);
  const { lang } = useLang();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLegalDocId(legalDoc)) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeLegal();
    };
    document.addEventListener('keydown', onKey);
    // Блокируем прокрутку фона, пока открыта модалка.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [legalDoc, closeLegal]);

  if (!isLegalDocId(legalDoc)) return null;

  const doc = LEGAL[lang][legalDoc];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 motion-safe:animate-[fadeIn_150ms_ease-out] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // Клик именно по фону (не по содержимому) закрывает.
        if (e.target === e.currentTarget) closeLegal();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl"
      >
        {/* Шапка */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <h2 className="font-heading text-xl font-extrabold text-ink">{doc.title}</h2>
            <p className="mt-0.5 text-[0.78rem] text-muted">{doc.updated}</p>
          </div>
          <button
            type="button"
            onClick={closeLegal}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Прокручиваемый контент */}
        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          {doc.sections.map((section) => (
            <section key={section.h} className="mb-5 last:mb-0">
              <h3 className="mb-1.5 font-heading text-[1.02rem] font-bold text-ink">{section.h}</h3>
              {section.p.map((para, i) => (
                <p key={i} className="mb-2 text-[0.94rem] leading-relaxed text-slate last:mb-0">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
