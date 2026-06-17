/**
 * TrustBar — узкая полоса доверия под Hero.
 *
 * Закрывает разрыв «нет сигналов доверия» из UX-обзора честными фактами о самом
 * сервисе (а не фичами полиса, которые уже перечислены в карточке Hero, и не
 * выдуманными отзывами): независимость, источник данных (официальный каталог
 * ASISA), бесплатность и конфиденциальность. Все тексты — @shared/i18n.
 */
import { useTranslation } from 'react-i18next';

/** Пункт доверия: эмодзи-иконка (декоративная) + i18n-ключ подписи. */
const TRUST_ITEMS: ReadonlyArray<{ icon: string; key: string }> = [
  { icon: '⚖️', key: 'tb_independent' },
  { icon: '📋', key: 'tb_source' },
  { icon: '🔒', key: 'tb_privacy' },
];

/** Полоса доверия: 3 факта о сервисе, в строку на десктопе и в столбик на мобиле. */
export function TrustBar() {
  const { t } = useTranslation();

  return (
    <section aria-label={t('tb_aria')} className="border-y border-slate-200 bg-brand-tint2">
      <ul className="mx-auto flex w-[min(1160px,calc(100vw-40px))] flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 sm:gap-y-2">
        {TRUST_ITEMS.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2.5 text-[0.92rem] font-medium text-slate"
          >
            <span aria-hidden className="text-base">
              {item.icon}
            </span>
            {t(item.key)}
          </li>
        ))}
      </ul>
    </section>
  );
}
