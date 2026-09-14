/**
 * Юнит-тесты воронки событий. Главный кейс — согласие на куки, данное ПОСЛЕ
 * того, как событие уже случилось: именно так терялся `chat_started`, и именно
 * поэтому недельный отчёт считал диалоги по событию, которого не было.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('./client', () => ({ apiRequest }));

const captureEvent = vi.hoisted(() => vi.fn());
vi.mock('./posthog', () => ({ captureEvent }));

const CONSENT_KEY = 'seguro_cookie_consent';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

/** Пути событий, ушедших на backend. */
function sentEvents(): string[] {
  return apiRequest.mock.calls.map((c) => (c[1] as { body: { event: string } }).body.event);
}

describe('воронка событий и согласие на куки', () => {
  it('при согласии событие уходит сразу', async () => {
    window.localStorage.setItem(CONSENT_KEY, 'accepted');
    const { trackEvent } = await import('./events');
    await trackEvent('chat_started', { lang: 'en' });
    expect(sentEvents()).toEqual(['chat_started']);
    expect(captureEvent).toHaveBeenCalledWith('chat_started', { lang: 'en' });
  });

  it('до решения по кукам событие придерживается, а не теряется', async () => {
    const { trackEvent } = await import('./events');
    await trackEvent('chat_started', { lang: 'en' });
    // Пока выбор не сделан — не отправляем ничего.
    expect(apiRequest).not.toHaveBeenCalled();
    expect(captureEvent).not.toHaveBeenCalled();
  });

  it('согласие после события — придержанное досылается', async () => {
    const { trackEvent, applyConsentToPendingEvents } = await import('./events');
    await trackEvent('chat_started', { lang: 'en' });
    await trackEvent('question_asked', { lang: 'en' });
    expect(apiRequest).not.toHaveBeenCalled();

    window.localStorage.setItem(CONSENT_KEY, 'accepted');
    applyConsentToPendingEvents(true);
    await vi.waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2));
    expect(sentEvents()).toEqual(['chat_started', 'question_asked']);
  });

  it('досланное событие помечено временем ожидания', async () => {
    const { trackEvent, applyConsentToPendingEvents } = await import('./events');
    await trackEvent('chat_started', { lang: 'en' });
    window.localStorage.setItem(CONSENT_KEY, 'accepted');
    applyConsentToPendingEvents(true);
    await vi.waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const body = apiRequest.mock.calls[0]![1] as { body: { meta: Record<string, unknown> } };
    // Backend штампует время на приёме, поэтому задержку несём в meta.
    expect(body.body.meta).toHaveProperty('queued_for_ms');
    expect(typeof body.body.meta.queued_for_ms).toBe('number');
  });

  it('отказ — придержанное выбрасывается и не уходит никогда', async () => {
    const { trackEvent, applyConsentToPendingEvents } = await import('./events');
    await trackEvent('chat_started', { lang: 'en' });
    window.localStorage.setItem(CONSENT_KEY, 'necessary');
    applyConsentToPendingEvents(false);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(captureEvent).not.toHaveBeenCalled();
  });

  it('после отказа новые события не копятся', async () => {
    window.localStorage.setItem(CONSENT_KEY, 'necessary');
    const { trackEvent, applyConsentToPendingEvents } = await import('./events');
    await trackEvent('chat_started', { lang: 'en' });
    // Выбор сделан (отказ) — придерживать нечего, даже если согласятся позже.
    window.localStorage.setItem(CONSENT_KEY, 'accepted');
    applyConsentToPendingEvents(true);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('очередь ограничена — на длинной странице память не растёт', async () => {
    const { trackEvent, applyConsentToPendingEvents } = await import('./events');
    for (let i = 0; i < 50; i++) await trackEvent('question_asked', { lang: 'en' });
    window.localStorage.setItem(CONSENT_KEY, 'accepted');
    applyConsentToPendingEvents(true);
    await vi.waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(apiRequest.mock.calls.length).toBeLessThanOrEqual(20);
  });
});
