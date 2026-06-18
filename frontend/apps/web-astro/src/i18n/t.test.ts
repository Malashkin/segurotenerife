/**
 * Юнит-тесты билд-тайм переводчика getT: перевод по локали и фоллбэк на ключ.
 */
import { describe, it, expect } from 'vitest';
import { getT, dictFor } from './t';

describe('getT (build-time i18n)', () => {
  it('возвращает строку перевода для локали', () => {
    const t = getT('ru');
    const v = t('hero_cta2');
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toBe('hero_cta2'); // ключ присутствует → не сам ключ
  });

  it('разные локали дают разный текст для одного ключа', () => {
    expect(getT('ru')('hero_cta2')).not.toBe(getT('es')('hero_cta2'));
  });

  it('отсутствующий ключ → возвращается сам ключ (последний фоллбэк)', () => {
    expect(getT('ru')('__no_such_key__')).toBe('__no_such_key__');
  });

  it('dictFor отдаёт непустой словарь локали', () => {
    expect(Object.keys(dictFor('es')).length).toBeGreaterThan(0);
  });
});
