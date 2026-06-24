/**
 * QA-прогон: 30 персон ведут реальный диалог с агентом по прод-API и оставляют
 * лид. Тестирует /api/chat (живой Claude, multi-turn с history) + /api/handoff.
 *
 * Запуск:  node scripts/qa-personas.mjs
 * Env:     BASE_URL (по умолчанию прод), THROTTLE_MS (пауза между чат-вызовами,
 *          держим < лимита 8/мин), OUT (путь JSON-отчёта).
 *
 * Дросселируем чат-вызовы (chat rate limit = 8/мин на IP) + ретрай на 429.
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'https://api.segurotenerife.com';
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 8000);
const OUT = process.env.OUT || '/tmp/qa-personas-report.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** POST с ретраем на 429 (rate limit) и сетевые сбои. */
async function post(path, body, { retries = 5 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        const wait = 9000 * (attempt + 1);
        console.error(`  429 rate-limited, ждём ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* не JSON */
      }
      return { status: res.status, json, text };
    } catch (e) {
      const wait = 4000 * (attempt + 1);
      console.error(`  сеть: ${e.message}; ретрай через ${wait}ms`);
      await sleep(wait);
    }
  }
  return { status: 0, json: null, text: 'failed after retries' };
}

// ── 30 персон ────────────────────────────────────────────────────────────────
// lang: ru|uk|en|es. intent — опц. (имитирует клик по карточке вида страховки).
const PERSONAS = [
  { name: 'Ольга', lang: 'ru', messenger: 'WhatsApp', intent: 'med', profile: 'Переезд на ВНЖ, нужна медстраховка для консульства',
    questions: ['Какая страховка нужна для визы на ВНЖ в Испании?', 'Должна ли она быть без франшизы и без доплат?', 'А справку для консульства вы даёте?', 'Сколько примерно стоит на год?'] },
  { name: 'Андрій', lang: 'uk', messenger: 'Telegram', intent: 'med', profile: 'Біженець з України, питає про медичне покриття',
    questions: ['Яка страховка підходить для оформлення ВНЖ?', 'Чи входить стоматологія?', 'Як швидко можна оформити?'] },
  { name: 'James', lang: 'en', messenger: 'WhatsApp', intent: 'med', profile: 'British expat moving to Tenerife',
    questions: ['What health insurance do I need for a Spanish residency visa?', 'Does it cover pre-existing conditions?', 'Are there any co-payments?', 'Can I speak to a manager about the price?'] },
  { name: 'María', lang: 'es', messenger: 'WhatsApp', intent: 'family', profile: 'Familia local, seguro de salud familiar',
    questions: ['¿Qué cubre un seguro de salud familiar?', '¿Incluye pediatra y urgencias?', '¿Hay periodo de carencia para partos?'] },
  { name: 'Дмитрий', lang: 'ru', messenger: 'Viber', intent: 'dental', profile: 'Интересует стоматология',
    questions: ['Что входит в стоматологию по страховке?', 'Имплантанты покрываются?', 'А чистка и лечение кариеса бесплатно?'] },
  { name: 'Sophie', lang: 'en', messenger: 'Telegram', intent: 'travel', profile: 'Digital nomad, travel + health',
    questions: ['I am a digital nomad, what insurance covers me in Spain?', 'Does it work if I travel within the EU?', 'Is repatriation included?'] },
  { name: 'Олена', lang: 'uk', messenger: 'WhatsApp', intent: 'family', profile: 'Сім’я з дітьми',
    questions: ['Чи можна застрахувати всю родину одним полісом?', 'Що з вакцинацією дітей?', 'Скільки це коштує для родини з двох дітей?'] },
  { name: 'Carlos', lang: 'es', messenger: 'Telegram', intent: 'biz', profile: 'Autónomo, seguro para residencia y trabajo',
    questions: ['Soy autónomo, ¿qué seguro me conviene para la residencia?', '¿Puedo deducirlo como gasto?', '¿Quiero hablar con un gestor?'] },
  { name: 'Наталья', lang: 'ru', messenger: 'WhatsApp', intent: 'med', profile: 'Пенсионерка, переезд к детям',
    questions: ['Мне 67 лет, есть ли возрастные ограничения для страховки?', 'Покрываются ли хронические заболевания?', 'Нужна ли страховка для ВНЖ пенсионеру?'] },
  { name: 'Tom', lang: 'en', messenger: 'WhatsApp', intent: 'med', profile: 'Comparing public vs private',
    questions: ['Why would I need private insurance if there is public healthcare?', 'How fast can I see a specialist with private insurance?', 'Is it valid for the non-lucrative visa?'] },
  { name: 'Ірина', lang: 'uk', messenger: 'Viber', intent: 'dental', profile: 'Стоматологія для дитини',
    questions: ['Чи покриває страховка дитячу стоматологію?', 'Брекети входять?'] },
  { name: 'Lucía', lang: 'es', messenger: 'WhatsApp', intent: 'med', profile: 'Embarazada, busca cobertura de maternidad',
    questions: ['Estoy embarazada, ¿el seguro cubre el parto?', '¿Hay periodo de carencia?', '¿Cubre las ecografías y el seguimiento?'] },
  { name: 'Сергей', lang: 'ru', messenger: 'Telegram', intent: 'med', profile: 'Хочет быстро узнать цену и уйти к менеджеру',
    questions: ['Сколько стоит медстраховка для ВНЖ?', 'Свяжите меня с менеджером пожалуйста'] },
  { name: 'Emma', lang: 'en', messenger: 'WhatsApp', intent: 'pet', profile: 'Pet owner asking about pet insurance',
    questions: ['Do you offer pet insurance for my dog?', 'What does it cover?'] },
  { name: 'Петро', lang: 'uk', messenger: 'Telegram', intent: 'med', profile: 'Студент, навчання на Тенерифе',
    questions: ['Яка страховка потрібна студенту для візи?', 'Чи є студентські тарифи?', 'Що покриває у разі нещасного випадку?'] },
  { name: 'Isabel', lang: 'es', messenger: 'Viber', intent: 'decesos', profile: 'Pregunta por seguro de decesos',
    questions: ['¿Qué es un seguro de decesos y qué incluye?', '¿Tiene sentido contratarlo siendo extranjero?'] },
  { name: 'Виктория', lang: 'ru', messenger: 'WhatsApp', intent: 'family', profile: 'Семья, сравнивает варианты',
    questions: ['Чем семейная страховка отличается от индивидуальной?', 'Можно ли добавить мужа позже?', 'Входит ли гинеколог и педиатр?', 'Хочу обсудить с человеком детали'] },
  { name: 'Mark', lang: 'en', messenger: 'Telegram', intent: 'med', profile: 'Chronic condition (diabetes)',
    questions: ['I have diabetes, will insurance cover my treatment?', 'Are there waiting periods for chronic conditions?', 'Can I keep my current doctor?'] },
  { name: 'Юлія', lang: 'uk', messenger: 'WhatsApp', intent: 'travel', profile: 'Часто подорожує',
    questions: ['Чи діє страховка під час подорожей Європою?', 'Що робити при ДТП за кордоном?'] },
  { name: 'Diego', lang: 'es', messenger: 'WhatsApp', intent: 'med', profile: 'Renovación de residencia',
    questions: ['¿Sirve este seguro para renovar la residencia?', '¿Sin copagos ni reembolsos?', '¿Cuánto tardan en darme el certificado?'] },
  { name: 'Анна', lang: 'ru', messenger: 'Telegram', intent: 'dental', profile: 'Только стоматология, без медицины',
    questions: ['Можно оформить только стоматологию отдельно?', 'Что по срокам ожидания?'] },
  { name: 'Oliver', lang: 'en', messenger: 'WhatsApp', intent: 'family', profile: 'Family of four relocating',
    questions: ['We are a family of four moving to Tenerife, what do you recommend?', 'Does it cover the kids schooling vaccines?', 'How much for the whole family?'] },
  { name: 'Богдан', lang: 'uk', messenger: 'Viber', intent: 'med', profile: 'Питає про доплати і франшизи',
    questions: ['Чи є в страховці доплати або франшизи?', 'Це підходить для подачі на ВНЖ?'] },
  { name: 'Carmen', lang: 'es', messenger: 'WhatsApp', intent: 'med', profile: 'Quiere atención sin esperas',
    questions: ['¿Con el seguro privado evito las listas de espera?', '¿Puedo elegir hospital?', '¿Hablo con alguien para contratar?'] },
  { name: 'Игорь', lang: 'ru', messenger: 'WhatsApp', intent: 'biz', profile: 'ИП/предприниматель',
    questions: ['Я ИП, какая страховка подойдёт для бизнес-визы?', 'Можно ли застраховать сотрудников?', 'Сколько это будет стоить?'] },
  { name: 'Grace', lang: 'en', messenger: 'Telegram', intent: 'med', profile: 'Asks something off-topic then returns',
    questions: ['What is the weather like in Tenerife?', 'Okay, but what health insurance do I need for residency?', 'Does it cover emergencies?'] },
  { name: 'Тарас', lang: 'uk', messenger: 'WhatsApp', intent: 'med', profile: 'Поспішає, хоче менеджера одразу',
    questions: ['Мені терміново потрібна страховка для візи, з’єднайте з менеджером'] },
  { name: 'Paula', lang: 'es', messenger: 'Viber', intent: 'family', profile: 'Madre soltera con un hijo',
    questions: ['Soy madre soltera con un hijo, ¿qué seguro familiar me conviene?', '¿Incluye pediatría y vacunas?', '¿Cuál es el precio aproximado?'] },
  { name: 'Алексей', lang: 'ru', messenger: 'WhatsApp', intent: 'med', profile: 'Скептик, проверяет на бренды',
    questions: ['С какой страховой компанией вы работаете?', 'А почему не называете бренд?', 'Ладно, какая страховка нужна для ВНЖ и что покрывает?'] },
];

async function run() {
  const startedAt = new Date().toISOString();
  const results = [];
  let chatCalls = 0;

  for (let i = 0; i < PERSONAS.length; i++) {
    const p = PERSONAS[i];
    console.error(`\n[${i + 1}/${PERSONAS.length}] ${p.name} (${p.lang}) — ${p.profile}`);
    const history = [];
    const turns = [];
    let lastTopic = null;
    let anyHandoff = false;

    for (let qi = 0; qi < p.questions.length; qi++) {
      const q = p.questions[qi];
      if (chatCalls > 0) await sleep(THROTTLE_MS);
      chatCalls++;
      const t0 = Date.now();
      const body = { question: q, lang: p.lang };
      if (qi === 0 && p.intent) body.intent = p.intent;
      if (history.length) body.history = history.slice(-10);
      const r = await post('/api/chat', body);
      const ms = Date.now() - t0;
      const answer = r.json?.answer ?? `[ERROR ${r.status}] ${r.text?.slice(0, 200)}`;
      const handoff = r.json?.handoff ?? false;
      const topic = r.json?.topic ?? null;
      if (topic) lastTopic = topic;
      if (handoff) anyHandoff = true;
      console.error(`  Q${qi + 1} (${ms}ms, handoff=${handoff}): ${q}`);
      turns.push({ q, answer, handoff, topic, status: r.status, ms });
      history.push({ role: 'user', content: q });
      history.push({ role: 'assistant', content: answer });
    }

    // Отправка лида (как в UI: имя обязательно + вид страховки + мессенджер).
    const lead = await post('/api/handoff', {
      name: p.name,
      question: p.questions[p.questions.length - 1],
      topic: lastTopic || p.intent || null,
      messenger: p.messenger,
      lang: p.lang,
    });
    console.error(`  → lead: ${lead.status} ${JSON.stringify(lead.json)}`);

    results.push({
      persona: p.name, lang: p.lang, profile: p.profile, intent: p.intent || null,
      messenger: p.messenger, anyHandoff, lastTopic,
      lead: { status: lead.status, ok: lead.json?.ok === true, lead_id: lead.json?.lead_id || null },
      turns,
    });
  }

  const report = {
    startedAt, finishedAt: new Date().toISOString(), base: BASE,
    personas: results.length, chatCalls,
    leadsOk: results.filter((r) => r.lead.ok).length,
    results,
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.error(`\n=== DONE === personas=${report.personas} chatCalls=${chatCalls} leadsOk=${report.leadsOk}/${report.personas}`);
  console.error(`Отчёт: ${OUT}`);
}

run().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
