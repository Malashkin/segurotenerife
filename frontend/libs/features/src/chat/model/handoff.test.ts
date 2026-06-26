/**
 * Юнит-тесты deep-link'ов хендоффа (чистая логика, поведение-определяющая).
 * Проверяем СПЕЦИФИКАЦИЮ:
 *  - WhatsApp/Viber несут предзаполненный текст (URL-кодированный);
 *  - Telegram НЕ несёт текст (t.me/username не принимает предзаполнение — клиент
 *    копирует заготовку сам); ссылка — чистая личка менеджера без query;
 *  - Viber требует номер с ведущим «+» (кодируется как %2B);
 *  - getOfficeContacts: дефолты, срезание ведущего @, фолбэк Viber→WhatsApp.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildHandoffLink, continueLabelKey, getOfficeContacts } from './handoff';

const CONTACTS = {
  whatsappNumber: '34658516901',
  telegramUsername: 'office_manager',
  viberNumber: '34600000001',
};

// Реальный формат сообщения менеджеру (с пробелами, точкой, двоеточием, переносами).
const MESSAGE = 'Меня зовут Анна. Мне нужно посчитать стоимость страховки: Стоматология.\n\nSeguro Tenerife';

describe('buildHandoffLink', () => {
  it('WhatsApp: wa.me/<номер> с URL-кодированным текстом', () => {
    const link = buildHandoffLink('WhatsApp', CONTACTS, MESSAGE);
    expect(link).toBe(`https://wa.me/34658516901?text=${encodeURIComponent(MESSAGE)}`);
    // Спец: текст реально закодирован (пробел → %20, перенос → %0A, нет «сырых» пробелов).
    expect(link).not.toMatch(/text=.*\s/);
    expect(link).toContain('%20');
    expect(link).toContain('%0A');
  });

  it('Viber: viber://chat с номером через %2B и кодированным текстом', () => {
    const link = buildHandoffLink('Viber', CONTACTS, MESSAGE);
    expect(link).toBe(
      `viber://chat?number=%2B34600000001&text=${encodeURIComponent(MESSAGE)}`,
    );
    // Спец: международный формат — ведущий «+» именно как %2B (не голый +).
    expect(link).toContain('number=%2B34600000001');
    expect(link).not.toContain('number=+');
  });

  it('Telegram: чистый t.me/<username> БЕЗ текста и query (нельзя предзаполнить)', () => {
    const link = buildHandoffLink('Telegram', CONTACTS, MESSAGE);
    expect(link).toBe('https://t.me/office_manager');
    // Ключевая спец-точка: ни текста, ни query-параметров, ни ?start=.
    expect(link).not.toContain('?');
    expect(link).not.toContain('text=');
    expect(link).not.toContain('start=');
    expect(link).not.toContain('Seguro');
  });

  it('кодирование защищает от спецсимволов, ломающих ссылку (&, =, #)', () => {
    const tricky = 'a & b = c # d';
    const wa = buildHandoffLink('WhatsApp', CONTACTS, tricky);
    // & внутри текста должен быть закодирован, иначе порвёт query.
    expect(wa.split('?text=')[1]).toBe(encodeURIComponent(tricky));
    expect(wa).not.toMatch(/text=.*&.*=/);
  });
});

describe('continueLabelKey', () => {
  it('мапит мессенджер на ключ перевода кнопки', () => {
    expect(continueLabelKey('WhatsApp')).toBe('contWa');
    expect(continueLabelKey('Telegram')).toBe('contTg');
    expect(continueLabelKey('Viber')).toBe('contVb');
  });
});

describe('getOfficeContacts', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('берёт значения из env и срезает ведущий @ у Telegram-username', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '34111111111');
    vi.stubEnv('VITE_TELEGRAM_USERNAME', '@office');
    vi.stubEnv('VITE_VIBER_NUMBER', '34222222222');
    expect(getOfficeContacts()).toEqual({
      whatsappNumber: '34111111111',
      telegramUsername: 'office', // @ срезан
      viberNumber: '34222222222',
    });
  });

  it('Viber по умолчанию = номеру WhatsApp, если VITE_VIBER_NUMBER не задан', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '34999999999');
    vi.stubEnv('VITE_VIBER_NUMBER', '');
    expect(getOfficeContacts().viberNumber).toBe('34999999999');
  });

  it('дефолты, когда переменные пустые', () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '');
    vi.stubEnv('VITE_TELEGRAM_USERNAME', '');
    vi.stubEnv('VITE_VIBER_NUMBER', '');
    const c = getOfficeContacts();
    expect(c.whatsappNumber).toBe('34600000000');
    expect(c.telegramUsername).toBe('your_office');
    expect(c.viberNumber).toBe('34600000000');
  });
});
