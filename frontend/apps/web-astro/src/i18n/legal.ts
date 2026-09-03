/**
 * SEO-метаданные правовых страниц (/privacy/, /terms/, /cookies/).
 *
 * Сами тексты живут в `@widgets` (`legalContent.ts`) и общие с модалкой в
 * футере — здесь только title/description/keywords, которых у модалки нет,
 * потому что у неё нет собственного URL.
 */
import type { AppLocale } from '@shared/i18n';
import type { LegalDocId } from '@widgets';

interface LegalMeta {
  title: string;
  description: string;
  keywords: string;
}

export const LEGAL_META: Record<AppLocale, Record<LegalDocId, LegalMeta>> = {
  ru: {
    privacy: {
      title: 'Политика конфиденциальности | Seguro Tenerife',
      description:
        'Какие данные собирает Seguro Tenerife, зачем и на каком основании, кому передаются заявки и какие права есть у пользователя по GDPR.',
      keywords: 'политика конфиденциальности Seguro Tenerife, обработка персональных данных, GDPR права пользователя',
    },
    terms: {
      title: 'Условия использования | Seguro Tenerife',
      description:
        'Условия пользования сервисом Seguro Tenerife: мы информационный сервис подбора, не страховщик и не брокер. Ответственность, применимое право.',
      keywords: 'условия использования Seguro Tenerife, правила сервиса подбора страховки',
    },
    cookies: {
      title: 'Политика cookies | Seguro Tenerife',
      description:
        'Какое хранилище браузера использует Seguro Tenerife, почему нет рекламных и межсайтовых трекеров и как этим управлять.',
      keywords: 'политика cookies Seguro Tenerife, хранилище браузера, аналитика без трекинга',
    },
  },
  en: {
    privacy: {
      title: 'Privacy Policy | Seguro Tenerife',
      description:
        'What data Seguro Tenerife collects, why and on what legal basis, who requests are shared with, and your rights under GDPR.',
      keywords: 'Seguro Tenerife privacy policy, personal data processing, GDPR rights',
    },
    terms: {
      title: 'Terms of Use | Seguro Tenerife',
      description:
        'Terms of using Seguro Tenerife: we are an information and matching service, not an insurer or a broker. Liability and governing law.',
      keywords: 'Seguro Tenerife terms of use, insurance matching service rules',
    },
    cookies: {
      title: 'Cookie Policy | Seguro Tenerife',
      description:
        'Which browser storage Seguro Tenerife uses, why there is no advertising or cross-site tracking, and how to manage it.',
      keywords: 'Seguro Tenerife cookie policy, browser storage, tracking-free analytics',
    },
  },
  es: {
    privacy: {
      title: 'Política de Privacidad | Seguro Tenerife',
      description:
        'Qué datos recoge Seguro Tenerife, con qué finalidad y base legal, con quién se comparten las solicitudes y qué derechos tienes según el RGPD.',
      keywords: 'política de privacidad Seguro Tenerife, tratamiento de datos personales, derechos RGPD',
    },
    terms: {
      title: 'Condiciones de Uso | Seguro Tenerife',
      description:
        'Condiciones de uso de Seguro Tenerife: somos un servicio de información y comparación, no una aseguradora ni un corredor. Responsabilidad y ley aplicable.',
      keywords: 'condiciones de uso Seguro Tenerife, normas del servicio de comparación de seguros',
    },
    cookies: {
      title: 'Política de Cookies | Seguro Tenerife',
      description:
        'Qué almacenamiento del navegador utiliza Seguro Tenerife, por qué no hay cookies publicitarias ni de seguimiento entre sitios y cómo gestionarlo.',
      keywords: 'política de cookies Seguro Tenerife, almacenamiento del navegador, analítica sin seguimiento',
    },
  },
  uk: {
    privacy: {
      title: 'Політика конфіденційності | Seguro Tenerife',
      description:
        'Які дані збирає Seguro Tenerife, навіщо і на якій підставі, кому передаються заявки та які права має користувач за GDPR.',
      keywords: 'політика конфіденційності Seguro Tenerife, обробка персональних даних, права GDPR',
    },
    terms: {
      title: 'Умови використання | Seguro Tenerife',
      description:
        'Умови користування сервісом Seguro Tenerife: ми інформаційний сервіс підбору, не страховик і не брокер. Відповідальність, застосовне право.',
      keywords: 'умови використання Seguro Tenerife, правила сервісу підбору страховки',
    },
    cookies: {
      title: 'Політика cookies | Seguro Tenerife',
      description:
        'Яке сховище браузера використовує Seguro Tenerife, чому немає рекламних і міжсайтових трекерів і як цим керувати.',
      keywords: 'політика cookies Seguro Tenerife, сховище браузера, аналітика без трекінгу',
    },
  },
};
