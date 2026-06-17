/**
 * SEO-копия <title>/<description> по локалям (пишем под поиск, не из UI-словаря).
 */
import type { AppLocale } from '@shared/i18n';

export const SEO_META: Record<AppLocale, { title: string; description: string }> = {
  ru: {
    title: 'Seguro Tenerife — подбор страховки на Тенерифе',
    description:
      'Независимый мультиязычный сервис подбора страховки на Тенерифе: медицинская для визы и ВНЖ, семейная, стоматология и другое. Бесплатно, без обязательств, на вашем языке.',
  },
  en: {
    title: 'Seguro Tenerife — insurance finder for Tenerife',
    description:
      'Independent multilingual insurance-matching for Tenerife: health cover for visa and residency, family, dental and more. Free, no obligation, in your language.',
  },
  es: {
    title: 'Seguro Tenerife — buscador de seguros en Tenerife',
    description:
      'Servicio independiente y multilingüe para encontrar seguros en Tenerife: salud para visado y residencia, familiar, dental y más. Gratis y sin compromiso.',
  },
  uk: {
    title: 'Seguro Tenerife — підбір страхування на Тенерифе',
    description:
      "Незалежний багатомовний сервіс підбору страхування на Тенерифе: медичне для візи та ВНЖ, сімейне, стоматологія тощо. Безкоштовно, без зобов'язань.",
  },
};
