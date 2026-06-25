/**
 * Контент страницы «О нас» по локалям (E-E-A-T-сигнал: кто мы, что делаем,
 * языки, зона работы). Бренд-нейтрально. Держим тут, чтобы не раздувать словарь.
 */
import type { AppLocale } from '@shared/i18n';

interface AboutContent {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  lead: string;
  blocks: { h: string; p: string }[];
}

export const ABOUT: Record<AppLocale, AboutContent> = {
  ru: {
    title: 'О нас — независимый подбор страховки на Тенерифе | Seguro Tenerife',
    description:
      'Seguro Tenerife — независимый мультиязычный сервис подбора страховки на Тенерифе для приезжих и экспатов. Бесплатно, без обязательств, на вашем языке.',
    keywords: 'Seguro Tenerife о нас, подбор страховки Тенерифе, независимый сервис страховки Испания',
    h1: 'О сервисе Seguro Tenerife',
    lead: 'Мы помогаем приезжим и экспатам на Тенерифе разобраться со страховкой и подобрать подходящий вариант — просто, на вашем языке и без давления.',
    blocks: [
      {
        h: 'Кто мы',
        p: 'Независимый сервис подбора страховки на Тенерифе (Канарские острова, Испания). Мы не привязаны к одной страховой компании — подбираем вариант под вашу ситуацию из нескольких партнёров.',
      },
      {
        h: 'Чем помогаем',
        p: 'Медицинская страховка для визы и ВНЖ с сертификатом для консульства, семейная, стоматология, для студентов, путешествий и бизнеса (autónomo). Отвечаем на вопросы и бесплатно считаем стоимость с менеджером.',
      },
      {
        h: 'На каких языках',
        p: 'Консультируем на русском, украинском, английском и испанском — на том, на котором вам удобно.',
      },
      {
        h: 'Как это работает',
        p: 'Задайте вопрос в чате — поможем разобраться, какой полис подходит. Когда будете готовы, менеджер бесплатно рассчитает точную стоимость под вашу ситуацию. Без обязательств.',
      },
      {
        h: 'Почему нам можно доверять',
        p: 'Мы честно объясняем типы покрытия, ничего не навязываем и не называем «единственно верный» бренд — конкретную компанию и цену менеджер подбирает под вас.',
      },
    ],
  },
  uk: {
    title: 'Про нас — незалежний підбір страхування на Тенерифе | Seguro Tenerife',
    description:
      'Seguro Tenerife — незалежний багатомовний сервіс підбору страхування на Тенерифе для приїжджих та експатів. Безкоштовно, без зобовʼязань, вашою мовою.',
    keywords: 'Seguro Tenerife про нас, підбір страхування Тенерифе, незалежний сервіс страхування Іспанія',
    h1: 'Про сервіс Seguro Tenerife',
    lead: 'Ми допомагаємо приїжджим та експатам на Тенерифе розібратися зі страхуванням і підібрати відповідний варіант — просто, вашою мовою і без тиску.',
    blocks: [
      {
        h: 'Хто ми',
        p: 'Незалежний сервіс підбору страхування на Тенерифе (Канарські острови, Іспанія). Ми не привʼязані до однієї страхової компанії — підбираємо варіант під вашу ситуацію з кількох партнерів.',
      },
      {
        h: 'Чим допомагаємо',
        p: 'Медичне страхування для візи та ВНЖ із сертифікатом для консульства, сімейне, стоматологія, для студентів, подорожей і бізнесу (autónomo). Відповідаємо на питання та безкоштовно рахуємо вартість з менеджером.',
      },
      {
        h: 'Якими мовами',
        p: 'Консультуємо українською, російською, англійською та іспанською — тією, якою вам зручно.',
      },
      {
        h: 'Як це працює',
        p: 'Поставте питання в чаті — допоможемо розібратися, який поліс підходить. Коли будете готові, менеджер безкоштовно розрахує точну вартість під вашу ситуацію. Без зобовʼязань.',
      },
      {
        h: 'Чому нам можна довіряти',
        p: 'Ми чесно пояснюємо типи покриття, нічого не навʼязуємо і не називаємо «єдино правильний» бренд — конкретну компанію та ціну менеджер підбирає під вас.',
      },
    ],
  },
  en: {
    title: 'About us — independent insurance matching on Tenerife | Seguro Tenerife',
    description:
      'Seguro Tenerife is an independent multilingual insurance-matching service on Tenerife for newcomers and expats. Free, no obligation, in your language.',
    keywords: 'Seguro Tenerife about, insurance matching Tenerife, independent insurance service Spain',
    h1: 'About Seguro Tenerife',
    lead: 'We help newcomers and expats on Tenerife understand insurance and find the right policy — simply, in your language and with no pressure.',
    blocks: [
      {
        h: 'Who we are',
        p: 'An independent insurance-matching service on Tenerife (Canary Islands, Spain). We are not tied to a single insurer — we match an option to your situation from several partners.',
      },
      {
        h: 'How we help',
        p: 'Health insurance for visa and residency with a consulate certificate, family, dental, student, travel and business (autónomo) cover. We answer your questions and a manager calculates the cost for free.',
      },
      {
        h: 'Languages',
        p: 'We advise in English, Spanish, Russian and Ukrainian — whichever is comfortable for you.',
      },
      {
        h: 'How it works',
        p: 'Ask in the chat — we help you work out which policy fits. When you are ready, a manager calculates the exact cost for your situation, free of charge. No obligation.',
      },
      {
        h: 'Why you can trust us',
        p: 'We explain coverage types honestly, push nothing, and never name a single "right" brand — a manager matches the specific company and price to you.',
      },
    ],
  },
  es: {
    title: 'Sobre nosotros — comparador independiente de seguros en Tenerife | Seguro Tenerife',
    description:
      'Seguro Tenerife es un servicio independiente y multilingüe de comparación de seguros en Tenerife para recién llegados y extranjeros. Gratis, sin compromiso, en tu idioma.',
    keywords: 'Seguro Tenerife sobre nosotros, comparador de seguros Tenerife, servicio independiente de seguros España',
    h1: 'Sobre Seguro Tenerife',
    lead: 'Ayudamos a recién llegados y extranjeros en Tenerife a entender los seguros y encontrar la póliza adecuada — de forma sencilla, en tu idioma y sin presión.',
    blocks: [
      {
        h: 'Quiénes somos',
        p: 'Un servicio independiente de comparación de seguros en Tenerife (Islas Canarias, España). No estamos atados a una sola aseguradora — buscamos una opción para tu caso entre varios colaboradores.',
      },
      {
        h: 'Cómo ayudamos',
        p: 'Seguro médico para visado y residencia con certificado para el consulado, familiar, dental, estudiantes, viaje y negocio (autónomo). Respondemos tus preguntas y un gestor calcula el coste gratis.',
      },
      {
        h: 'Idiomas',
        p: 'Asesoramos en español, inglés, ruso y ucraniano — en el que te resulte cómodo.',
      },
      {
        h: 'Cómo funciona',
        p: 'Pregunta en el chat — te ayudamos a ver qué póliza encaja. Cuando estés listo, un gestor calcula el coste exacto para tu caso, gratis. Sin compromiso.',
      },
      {
        h: 'Por qué confiar en nosotros',
        p: 'Explicamos los tipos de cobertura con honestidad, no presionamos y no nombramos una única marca "correcta" — el gestor adapta la compañía y el precio a ti.',
      },
    ],
  },
};
