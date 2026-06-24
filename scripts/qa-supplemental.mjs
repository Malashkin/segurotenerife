/**
 * Доп-прогон QA: закрывает (А) языковой паритет на всех 4 языках и (Б) пробелы
 * по потребностям из корпуса, которых нет в основном наборе (reembolso, life,
 * accidentes, hospitalizacion), + проба на отсутствующий в корпусе интент biz.
 *
 * Запуск:  node scripts/qa-supplemental.mjs
 * Env:     BASE_URL, THROTTLE_MS, OUT.
 */
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'https://api.segurotenerife.com';
const THROTTLE_MS = Number(process.env.THROTTLE_MS || 5000);
const OUT = process.env.OUT || '/tmp/qa-supplemental-report.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, { retries = 5 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) { await sleep(9000 * (attempt + 1)); continue; }
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch { /* */ }
      return { status: res.status, json, text };
    } catch { await sleep(4000 * (attempt + 1)); }
  }
  return { status: 0, json: null, text: 'failed' };
}

// (А) Языковой паритет: один смысл, 5 вопросов, на всех 4 языках.
// Q4 — цена (ждём handoff), Q5 — провокация на бренд (ждём нейтральность).
const PARITY = {
  ru: ['Какая страховка нужна для ВНЖ в Испании?', 'В ней есть доплаты или франшиза?', 'Стоматология входит?', 'Сколько она стоит в год?', 'С какой страховой компанией вы работаете?'],
  uk: ['Яка страховка потрібна для ВНЖ в Іспанії?', 'У ній є доплати чи франшиза?', 'Стоматологія входить?', 'Скільки вона коштує на рік?', 'З якою страховою компанією ви працюєте?'],
  en: ['What insurance do I need for a residency visa in Spain?', 'Does it have copayments or a deductible?', 'Is dental included?', 'How much does it cost per year?', 'Which insurance company do you work with?'],
  es: ['¿Qué seguro necesito para la residencia en España?', '¿Tiene copagos o franquicia?', '¿Incluye dental?', '¿Cuánto cuesta al año?', '¿Con qué compañía de seguros trabajáis?'],
};
const PARITY_MSGR = { ru: 'WhatsApp', uk: 'Telegram', en: 'WhatsApp', es: 'Viber' };

// (Б) Пробелы по потребностям (разные языки), + biz без дока в корпусе.
const NEEDS = [
  { name: 'Reembolso-EN', lang: 'en', intent: 'reembolso', messenger: 'WhatsApp',
    q: ['I want a plan where I can choose any private doctor and get reimbursed. What do you offer?', 'How does the reimbursement percentage work?', 'Is it valid for the residency visa too?'] },
  { name: 'Vida-RU', lang: 'ru', intent: 'life', messenger: 'WhatsApp',
    q: ['Расскажите про страхование жизни — что оно покрывает?', 'А страхование от несчастных случаев есть отдельно?', 'Кому имеет смысл его оформлять?'] },
  { name: 'Accidentes-ES', lang: 'es', intent: 'life', messenger: 'Viber',
    q: ['¿Qué cubre un seguro de accidentes?', '¿Sirve para autónomos o para deportistas?'] },
  { name: 'Hospital-UK', lang: 'uk', intent: 'med', messenger: 'Telegram',
    q: ['Чи покриває страховка госпіталізацію та операції?', 'Чи можу я обрати приватну клініку?'] },
  { name: 'Ambulatoria-ES', lang: 'es', intent: 'med', messenger: 'WhatsApp',
    q: ['Solo quiero cobertura ambulatoria, sin hospitalización. ¿Existe esa opción?', '¿Incluye especialistas y pruebas diagnósticas?'] },
  { name: 'Biz-RU', lang: 'ru', intent: 'biz', messenger: 'WhatsApp',
    q: ['Я открываю бизнес в Испании, нужна страховка для бизнес-визы. Что подойдёт?', 'Можно ли застраховать сотрудников компании?'] },
];

// Тема лида = ПЕРВАЯ установленная потребность (как в UI): не перезаписываем.
const stick = (prev, next) => prev || next || null;
// Ключ интента → читаемый лейбл (как делает фронт через CHAT_INTENTS).
const LABELS = {
  med: 'Медицинская для визы / ВНЖ', dental: 'Стоматология', family: 'Семейная медицинская',
  biz: 'Для ИП / бизнеса', pet: 'Для питомцев', travel: 'Путешествия / международная',
  life: 'Страхование жизни', decesos: 'Похоронная страховка', student: 'Студенческая страховка',
  reembolso: 'С возмещением расходов',
};
const label = (k) => LABELS[k] || k;

// intent: задан (карточка) → шлём КАЖДЫЙ запрос (как реальный UI); null → free chat.
async function dialogue(name, lang, qs, intent, messenger) {
  console.error(`\n=== ${name} (${lang}) ===`);
  const history = [];
  const turns = [];
  let topic = intent || null;
  for (let i = 0; i < qs.length; i++) {
    await sleep(THROTTLE_MS);
    const body = { question: qs[i], lang };
    if (intent) body.intent = intent;
    if (history.length) body.history = history.slice(-10);
    const t0 = Date.now();
    const r = await post('/api/chat', body);
    const ms = Date.now() - t0;
    const answer = r.json?.answer ?? `[ERR ${r.status}]`;
    const handoff = r.json?.handoff ?? false;
    topic = stick(topic, r.json?.topic ?? null);
    console.error(`  Q${i + 1} (${ms}ms, handoff=${handoff}, topic=${r.json?.topic}): ${qs[i]}`);
    turns.push({ q: qs[i], answer, handoff, topic: r.json?.topic ?? null, ms, status: r.status });
    history.push({ role: 'user', content: qs[i] });
    history.push({ role: 'assistant', content: answer });
  }
  const lead = await post('/api/handoff', { name, topic: label(topic || intent), messenger, lang });
  return { name, lang, intent: intent || null, leadTopic: label(topic || intent), leadOk: lead.json?.ok === true, turns };
}

async function run() {
  const parity = [];
  for (const [lang, qs] of Object.entries(PARITY)) {
    // Паритет — свободный диалог (intent=null): проверяем выведение темы из вопросов.
    parity.push(await dialogue(`Паритет-${lang.toUpperCase()}`, lang, qs, null, PARITY_MSGR[lang]));
  }
  const needs = [];
  for (const n of NEEDS) {
    needs.push(await dialogue(n.name, n.lang, n.q, n.intent, n.messenger));
  }
  writeFileSync(OUT, JSON.stringify({ base: BASE, parity, needs }, null, 2));
  console.error(`\n=== DONE supplemental === parity=${parity.length} needs=${needs.length}; отчёт: ${OUT}`);
}

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
