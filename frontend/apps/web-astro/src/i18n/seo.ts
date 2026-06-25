/**
 * SEO-копия <title>/<description>/<keywords> по локалям (пишем под поиск, не из
 * UI-словаря). Заголовки — высокочастотный запрос ВПЕРЕДИ, бренд в конце.
 * keywords — целевые запросы + частые варианты написания и опечатки (тег
 * невидим пользователю; на видимый текст спам не выносим).
 */
import type { AppLocale } from '@shared/i18n';

export const SEO_META: Record<AppLocale, { title: string; description: string; keywords: string }> =
  {
    ru: {
      title: 'Страховка для ВНЖ и визы в Испании — Тенерифе | Seguro Tenerife',
      description:
        'Медицинская страховка для ВНЖ, визы и резиденции в Испании на Тенерифе: сертификат для консульства без доплат и периодов ожидания. Также семейная, стоматология, для студентов и путешествий. Бесплатный подбор на вашем языке, без обязательств.',
      keywords:
        'страховка Тенерифе, медицинская страховка для ВНЖ, страховка для визы в Испанию, медстраховка для консульства, страховка резиденция Испания, страховка Канарские острова, страховка для ВНЖ Испания цена, seguro tenerife на русском, страховка тенериф, страховка тенерифе, медстраховка испания, страховка для визы испания внж',
    },
    en: {
      title: 'Health Insurance for Spain Residency Visa — Tenerife | Seguro Tenerife',
      description:
        'Health insurance for the Spanish residency / non-lucrative visa on Tenerife: consulate-ready certificate with no co-payments and no waiting periods. Also family, dental, student and travel cover. Free matching in your language, no obligation.',
      keywords:
        'tenerife health insurance, spain residency visa insurance, non-lucrative visa insurance, expat insurance tenerife, canary islands health insurance, private health insurance spain, tenerife insurance, tennerife insurance, seguro tenerife english, medical insurance for spanish visa',
    },
    es: {
      title: 'Seguro médico para residencia y visado en Tenerife | Seguro Tenerife',
      description:
        'Seguro médico para la residencia y el visado en España, en Tenerife: certificado para el consulado sin copagos ni periodos de carencia. También salud familiar, dental, estudiantes y viaje. Asesoramiento gratuito y sin compromiso.',
      keywords:
        'seguro residencia tenerife, seguro médico tenerife, seguro para visado españa, seguro salud canarias, seguro sin copago residencia, seguro privado tenerife, seguro medico tenerife, seguro residencia españa, seguro para extranjeros tenerife',
    },
    uk: {
      title: 'Страхування для ВНЖ та візи в Іспанії — Тенерифе | Seguro Tenerife',
      description:
        'Медичне страхування для ВНЖ, візи та резиденції в Іспанії на Тенерифе: сертифікат для консульства без доплат і періодів очікування. Також сімейне, стоматологія, для студентів і подорожей. Безкоштовний підбір вашою мовою.',
      keywords:
        'страхування Тенерифе, медичне страхування для ВНЖ, страховка для візи в Іспанію, страховка резиденція Іспанія, страхування Канарські острови, медстраховка Іспанія, страхування тенеріфе, страховка для внж іспанія',
    },
  };
