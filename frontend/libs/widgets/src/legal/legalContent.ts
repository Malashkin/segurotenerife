/**
 * Тексты правовых страниц (Privacy / Terms / Cookies) на 4 языках.
 *
 * Сервис — информационный подбор страховок (НЕ страховщик/брокер): данные
 * пользователя передаются лицензированному офису-партнёру. Тексты составлены
 * как разумный шаблон под этот контекст и GDPR. ⚠️ Перед продом проверить у юриста.
 *
 * Открываются в модалке из футера (LegalModal), без роутера. Контент структурный
 * (секции h/p), чтобы рендериться единообразно и переводиться целиком.
 */
import type { AppLocale } from '@shared/i18n';

/** id правового документа. */
export type LegalDocId = 'privacy' | 'terms' | 'cookies';

/** Секция документа: заголовок + абзацы. */
export interface LegalSection {
  h: string;
  p: readonly string[];
}

/** Документ: заголовок, строка обновления, секции. */
export interface LegalDoc {
  title: string;
  updated: string;
  sections: readonly LegalSection[];
}

/* ─────────────────────────── English ─────────────────────────── */
const EN: Record<LegalDocId, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: June 2026',
    sections: [
      { h: 'Who we are', p: ['Seguro Tenerife is an information service that helps you find insurance in Tenerife (Spain). We are not an insurance company or a broker. The data controller is the operator of Seguro Tenerife.'] },
      { h: 'What data we collect', p: ['Data you provide in the chat: your name, the messenger and contact you choose (phone or username), the language and the answers you give (insurance goal, who is insured, area, urgency).', 'Technical data: an anonymous session identifier and basic event analytics to measure how the service is used.'] },
      { h: 'Why we use it (legal basis)', p: ['We process your data on the basis of your consent, to pass your request to a licensed partner office so a manager can prepare a quote and contact you in your chosen messenger.'] },
      { h: 'Who we share it with', p: ['We share your request only with the licensed partner office that handles the quote and policy. We do not sell your data or share it for advertising.'] },
      { h: 'AI assistant', p: ['The on-site matching and answers are produced with the help of an AI assistant based on a public catalogue of insurance products. The AI does not make a binding offer; a human manager confirms details and the quote.'] },
      { h: 'Retention', p: ['We keep your request for as long as needed to process it and as required by law, then delete or anonymise it.'] },
      { h: 'Your rights', p: ['Under GDPR you can request access, correction, deletion, restriction or portability of your data, and withdraw consent at any time. To exercise these rights, contact the operator through the partner office handling your request.'] },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: 'Last updated: June 2026',
    sections: [
      { h: 'The service', p: ['Seguro Tenerife is a free information and matching service. We are not an insurance company or an insurance broker and do not issue policies. Requests are passed to a licensed partner office that prepares the quote and issues the policy.'] },
      { h: 'No guarantee', p: ['Information on the site is for general guidance only and may change. Prices are not published here and are calculated individually by the insurer or the partner office. Nothing on the site is a binding offer.'] },
      { h: 'How it works', p: ['You answer a few questions or ask the assistant, leave a contact, and a manager from the partner office reaches out in your chosen messenger to clarify and prepare a quote.'] },
      { h: 'Your responsibilities', p: ['Provide accurate information and use the service lawfully. You are responsible for the contact details you submit.'] },
      { h: 'Liability', p: ['To the extent permitted by law, we are not liable for decisions made by insurers, for the content of third-party products, or for indirect damages arising from use of the site.'] },
      { h: 'Governing law', p: ['These terms are governed by the law of Spain. Disputes are subject to the competent courts in Spain.'] },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    updated: 'Last updated: June 2026',
    sections: [
      { h: 'What we use', p: ['We use minimal browser storage to make the site work: your language choice is saved in localStorage, and an anonymous session identifier is kept in sessionStorage for funnel analytics.'] },
      { h: 'No third-party tracking', p: ['We do not use advertising or cross-site tracking cookies. Analytics are limited to anonymous, aggregated usage events.'] },
      { h: 'Managing storage', p: ['You can clear or block browser storage in your browser settings. Disabling it may reset your language preference but will not prevent you from using the service.'] },
    ],
  },
};

/* ─────────────────────────── Español ─────────────────────────── */
const ES: Record<LegalDocId, LegalDoc> = {
  privacy: {
    title: 'Política de Privacidad',
    updated: 'Última actualización: junio de 2026',
    sections: [
      { h: 'Quiénes somos', p: ['Seguro Tenerife es un servicio de información que ayuda a encontrar seguros en Tenerife (España). No somos una compañía de seguros ni un corredor. El responsable del tratamiento es el operador de Seguro Tenerife.'] },
      { h: 'Qué datos recogemos', p: ['Datos que facilitas en el chat: tu nombre, el mensajero y el contacto que elijas (teléfono o usuario), el idioma y tus respuestas (objetivo del seguro, a quién se asegura, zona, urgencia).', 'Datos técnicos: un identificador de sesión anónimo y analítica básica de eventos para medir el uso del servicio.'] },
      { h: 'Para qué los usamos (base legal)', p: ['Tratamos tus datos sobre la base de tu consentimiento, para trasladar tu solicitud a una oficina colaboradora con licencia para que un gestor prepare un presupuesto y te contacte en tu mensajero.'] },
      { h: 'Con quién los compartimos', p: ['Compartimos tu solicitud únicamente con la oficina colaboradora con licencia que gestiona el presupuesto y la póliza. No vendemos tus datos ni los compartimos con fines publicitarios.'] },
      { h: 'Asistente de IA', p: ['La orientación y las respuestas en el sitio se generan con ayuda de un asistente de inteligencia artificial a partir de un catálogo público de productos. La IA no realiza una oferta vinculante; un gestor humano confirma los detalles y el presupuesto.'] },
      { h: 'Conservación', p: ['Conservamos tu solicitud el tiempo necesario para gestionarla y el exigido por la ley, y después la eliminamos o anonimizamos.'] },
      { h: 'Tus derechos', p: ['Conforme al RGPD puedes solicitar acceso, rectificación, supresión, limitación o portabilidad de tus datos y retirar el consentimiento en cualquier momento. Para ejercerlos, contacta con el operador a través de la oficina colaboradora que gestiona tu solicitud.'] },
    ],
  },
  terms: {
    title: 'Términos de Uso',
    updated: 'Última actualización: junio de 2026',
    sections: [
      { h: 'El servicio', p: ['Seguro Tenerife es un servicio gratuito de información y orientación. No somos una compañía de seguros ni un corredor y no emitimos pólizas. Las solicitudes se trasladan a una oficina colaboradora con licencia que prepara el presupuesto y emite la póliza.'] },
      { h: 'Sin garantía', p: ['La información del sitio es orientativa y puede cambiar. Los precios no se publican aquí y se calculan de forma individual por la aseguradora o la oficina colaboradora. Nada en el sitio constituye una oferta vinculante.'] },
      { h: 'Cómo funciona', p: ['Respondes a unas preguntas o consultas al asistente, dejas un contacto y un gestor de la oficina colaboradora te escribe en tu mensajero para aclarar y preparar un presupuesto.'] },
      { h: 'Tus obligaciones', p: ['Facilita información veraz y usa el servicio de forma lícita. Eres responsable de los datos de contacto que envíes.'] },
      { h: 'Responsabilidad', p: ['En la medida permitida por la ley, no respondemos por las decisiones de las aseguradoras, por el contenido de productos de terceros ni por daños indirectos derivados del uso del sitio.'] },
      { h: 'Ley aplicable', p: ['Estos términos se rigen por la legislación de España. Los conflictos se someten a los tribunales competentes en España.'] },
    ],
  },
  cookies: {
    title: 'Política de Cookies',
    updated: 'Última actualización: junio de 2026',
    sections: [
      { h: 'Qué usamos', p: ['Usamos un almacenamiento mínimo del navegador para que el sitio funcione: tu idioma se guarda en localStorage y un identificador de sesión anónimo se mantiene en sessionStorage para la analítica del embudo.'] },
      { h: 'Sin rastreo de terceros', p: ['No usamos cookies de publicidad ni de rastreo entre sitios. La analítica se limita a eventos de uso anónimos y agregados.'] },
      { h: 'Gestión del almacenamiento', p: ['Puedes borrar o bloquear el almacenamiento del navegador en sus ajustes. Desactivarlo puede restablecer tu idioma, pero no impide usar el servicio.'] },
    ],
  },
};

/* ─────────────────────────── Українська ─────────────────────────── */
const UK: Record<LegalDocId, LegalDoc> = {
  privacy: {
    title: 'Політика конфіденційності',
    updated: 'Оновлено: червень 2026',
    sections: [
      { h: 'Хто ми', p: ['Seguro Tenerife — інформаційний сервіс підбору страхування на Тенерифе (Іспанія). Ми не є страховою компанією чи брокером. Розпорядник даних — оператор Seguro Tenerife.'] },
      { h: 'Які дані збираємо', p: ['Дані, які ви надаєте в чаті: імʼя, обраний месенджер і контакт (телефон або нік), мова та ваші відповіді (мета страхування, кого страхуємо, район, терміновість).', 'Технічні дані: анонімний ідентифікатор сесії та базова аналітика подій для вимірювання використання сервісу.'] },
      { h: 'Навіщо використовуємо (підстава)', p: ['Ми обробляємо дані на підставі вашої згоди, щоб передати запит ліцензованому офісу-партнеру — менеджер підготує розрахунок і звʼяжеться у вашому месенджері.'] },
      { h: 'Кому передаємо', p: ['Передаємо запит лише ліцензованому офісу-партнеру, який оформлює розрахунок і поліс. Ми не продаємо ваші дані й не передаємо їх для реклами.'] },
      { h: 'ШІ-асистент', p: ['Підбір і відповіді на сайті формуються за допомогою асистента зі штучним інтелектом на основі публічного каталогу продуктів. ШІ не робить обовʼязкової пропозиції; деталі та розрахунок підтверджує менеджер-людина.'] },
      { h: 'Зберігання', p: ['Зберігаємо запит стільки, скільки потрібно для обробки та згідно із законом, після чого видаляємо або знеособлюємо.'] },
      { h: 'Ваші права', p: ['За GDPR ви можете вимагати доступ, виправлення, видалення, обмеження чи перенесення даних і відкликати згоду будь-коли. Для цього звертайтеся до оператора через офіс-партнер, що опрацьовує ваш запит.'] },
    ],
  },
  terms: {
    title: 'Умови використання',
    updated: 'Оновлено: червень 2026',
    sections: [
      { h: 'Сервіс', p: ['Seguro Tenerife — безкоштовний інформаційний сервіс підбору. Ми не страхова компанія і не брокер, полісів не оформлюємо. Запити передаються ліцензованому офісу-партнеру, який готує розрахунок і оформлює поліс.'] },
      { h: 'Без гарантій', p: ['Інформація на сайті має орієнтовний характер і може змінюватися. Ціни тут не публікуються і розраховуються індивідуально страховиком або офісом-партнером. Ніщо на сайті не є обовʼязковою пропозицією.'] },
      { h: 'Як це працює', p: ['Ви відповідаєте на кілька питань або запитуєте асистента, лишаєте контакт — менеджер офісу-партнера пише у вашому месенджері, щоб уточнити й підготувати розрахунок.'] },
      { h: 'Ваші обовʼязки', p: ['Надавайте достовірну інформацію та користуйтеся сервісом законно. Ви відповідаєте за надані контактні дані.'] },
      { h: 'Відповідальність', p: ['У межах, дозволених законом, ми не відповідаємо за рішення страховиків, контент продуктів третіх осіб та непрямі збитки від використання сайту.'] },
      { h: 'Застосовне право', p: ['Ці умови регулюються правом Іспанії. Спори підлягають компетентним судам Іспанії.'] },
    ],
  },
  cookies: {
    title: 'Політика щодо cookies',
    updated: 'Оновлено: червень 2026',
    sections: [
      { h: 'Що використовуємо', p: ['Ми використовуємо мінімальне сховище браузера, щоб сайт працював: вибір мови зберігається в localStorage, а анонімний ідентифікатор сесії — у sessionStorage для аналітики воронки.'] },
      { h: 'Без стеження третіх сторін', p: ['Ми не використовуємо рекламні чи міжсайтові трекери. Аналітика обмежена анонімними агрегованими подіями.'] },
      { h: 'Керування сховищем', p: ['Ви можете очистити або заблокувати сховище браузера в його налаштуваннях. Вимкнення може скинути вибір мови, але не завадить користуватися сервісом.'] },
    ],
  },
};

/* ─────────────────────────── Русский ─────────────────────────── */
const RU: Record<LegalDocId, LegalDoc> = {
  privacy: {
    title: 'Политика конфиденциальности',
    updated: 'Обновлено: июнь 2026',
    sections: [
      { h: 'Кто мы', p: ['Seguro Tenerife — информационный сервис подбора страховок на Тенерифе (Испания). Мы не являемся страховой компанией или брокером. Оператор данных — владелец Seguro Tenerife.'] },
      { h: 'Какие данные собираем', p: ['Данные, которые вы вводите в чате: имя, выбранный мессенджер и контакт (телефон или ник), язык и ваши ответы (цель страхования, кого страхуем, район, срочность).', 'Технические данные: анонимный идентификатор сессии и базовая аналитика событий для измерения использования сервиса.'] },
      { h: 'Зачем используем (основание)', p: ['Мы обрабатываем данные на основании вашего согласия, чтобы передать заявку лицензированному офису-партнёру — менеджер подготовит расчёт и свяжется с вами в выбранном мессенджере.'] },
      { h: 'Кому передаём', p: ['Передаём заявку только лицензированному офису-партнёру, который оформляет расчёт и полис. Мы не продаём ваши данные и не передаём их для рекламы.'] },
      { h: 'ИИ-ассистент', p: ['Подбор и ответы на сайте формируются с помощью ассистента на основе искусственного интеллекта по публичному каталогу продуктов. ИИ не делает обязывающего предложения; детали и расчёт подтверждает менеджер-человек.'] },
      { h: 'Хранение', p: ['Храним заявку столько, сколько нужно для обработки и требуется по закону, затем удаляем или обезличиваем.'] },
      { h: 'Ваши права', p: ['По GDPR вы можете запросить доступ, исправление, удаление, ограничение или перенос данных и отозвать согласие в любой момент. Для этого обратитесь к оператору через офис-партнёр, обрабатывающий вашу заявку.'] },
    ],
  },
  terms: {
    title: 'Условия использования',
    updated: 'Обновлено: июнь 2026',
    sections: [
      { h: 'Сервис', p: ['Seguro Tenerife — бесплатный информационный сервис подбора. Мы не страховая компания и не брокер, полисы не оформляем. Заявки передаются лицензированному офису-партнёру, который готовит расчёт и оформляет полис.'] },
      { h: 'Без гарантий', p: ['Информация на сайте носит справочный характер и может меняться. Цены здесь не публикуются и рассчитываются индивидуально страховщиком или офисом-партнёром. Ничто на сайте не является обязывающим предложением.'] },
      { h: 'Как это работает', p: ['Вы отвечаете на несколько вопросов или спрашиваете ассистента, оставляете контакт — менеджер офиса-партнёра пишет в выбранном мессенджере, чтобы уточнить и подготовить расчёт.'] },
      { h: 'Ваши обязанности', p: ['Предоставляйте достоверную информацию и используйте сервис законно. Вы отвечаете за указанные контактные данные.'] },
      { h: 'Ответственность', p: ['В пределах, разрешённых законом, мы не отвечаем за решения страховщиков, за содержание продуктов третьих лиц и за косвенный ущерб от использования сайта.'] },
      { h: 'Применимое право', p: ['Эти условия регулируются правом Испании. Споры подлежат компетентным судам Испании.'] },
    ],
  },
  cookies: {
    title: 'Политика cookies',
    updated: 'Обновлено: июнь 2026',
    sections: [
      { h: 'Что используем', p: ['Мы используем минимальное хранилище браузера, чтобы сайт работал: выбор языка сохраняется в localStorage, а анонимный идентификатор сессии — в sessionStorage для аналитики воронки.'] },
      { h: 'Без стороннего трекинга', p: ['Мы не используем рекламные или межсайтовые трекинг-куки. Аналитика ограничена анонимными агрегированными событиями.'] },
      { h: 'Управление хранилищем', p: ['Вы можете очистить или заблокировать хранилище браузера в его настройках. Отключение может сбросить выбор языка, но не помешает пользоваться сервисом.'] },
    ],
  },
};

/** Все документы по локалям. */
export const LEGAL: Record<AppLocale, Record<LegalDocId, LegalDoc>> = {
  en: EN,
  es: ES,
  uk: UK,
  ru: RU,
};
