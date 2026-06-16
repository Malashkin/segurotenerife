/**
 * CookieConsent — баннер согласия на куки/аналитику.
 *
 * Аналитика воронки необязательна и включается ТОЛЬКО при «Принять все»
 * (localStorage `seguro_cookie_consent='accepted'`). «Только необходимые»
 * (`'necessary'`) оставляет сайт полностью рабочим, но без аналитики — отказ
 * НЕ блокирует функциональность (требование GDPR/ePrivacy). Само хранение выбора
 * — необходимое (функциональное), согласия не требует.
 *
 * Гейтинг аналитики читает этот ключ в shared/api/events (trackEvent/getSessionId).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@shared/store';
import { Button } from '@shared/ui';

const CONSENT_KEY = 'seguro_cookie_consent';

/** Безопасно читает сохранённый выбор (SSR/приватный режим → null). */
function readConsent(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function CookieConsent(): JSX.Element | null {
  const { t } = useTranslation();
  const openLegal = useUiStore((s) => s.openLegal);
  // Показываем баннер, пока выбор не сделан.
  const [visible, setVisible] = useState<boolean>(() => readConsent() === null);

  if (!visible) return null;

  const decide = (value: 'accepted' | 'necessary'): void => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* приватный режим — выбор не сохранится, но баннер скроем */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/95 px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur motion-safe:animate-[slideUp_260ms_ease-out] sm:px-6"
    >
      <div className="mx-auto flex w-[min(1160px,calc(100vw-32px))] flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <p className="flex-1 text-[0.86rem] leading-snug text-slate">
          {t('cookie_msg')}{' '}
          <button
            type="button"
            onClick={() => openLegal('cookies')}
            className="font-semibold text-brand-dark underline underline-offset-2 hover:text-brand"
          >
            {t('cookie_more')}
          </button>
        </p>
        <div className="flex shrink-0 gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => decide('necessary')}
            className="px-4 py-2.5 text-[0.9rem]"
          >
            {t('cookie_necessary')}
          </Button>
          <Button
            type="button"
            onClick={() => decide('accepted')}
            className="px-4 py-2.5 text-[0.9rem]"
          >
            {t('cookie_accept')}
          </Button>
        </div>
      </div>
    </div>
  );
}
