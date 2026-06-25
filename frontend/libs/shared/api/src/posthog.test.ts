/**
 * Юнит-тесты PostHog-обёртки — критично по приватности (GDPR-гейт) и
 * безопасности (no-op без ключа). Мокаем posthog-js, проверяем поведение
 * init/consent/capture. `initialized` — модульное состояние, поэтому каждый
 * тест берёт свежий модуль через resetModules + динамический import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: ph }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('analytics (PostHog)', () => {
  it('без ключа в env — no-op: init/capture/consent не вызывают posthog', async () => {
    vi.stubEnv('PUBLIC_POSTHOG_KEY', '');
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { initAnalytics, captureEvent, setAnalyticsConsent } = await import('./posthog');
    initAnalytics();
    captureEvent('whatever');
    setAnalyticsConsent(true);
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
    expect(ph.opt_in_capturing).not.toHaveBeenCalled();
  });

  it('GDPR: init с opt_out_capturing_by_default=true (не трекаем до согласия)', async () => {
    vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
    const { initAnalytics } = await import('./posthog');
    initAnalytics();
    expect(ph.init).toHaveBeenCalledTimes(1);
    const cfg = ph.init.mock.calls[0]![1] as Record<string, unknown>;
    expect(cfg.opt_out_capturing_by_default).toBe(true);
    expect((cfg.session_recording as Record<string, unknown>).maskAllInputs).toBe(true);
  });

  it('согласие → opt_in; отказ → opt_out; событие проксируется', async () => {
    vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
    const { initAnalytics, setAnalyticsConsent, captureEvent } = await import('./posthog');
    initAnalytics();
    setAnalyticsConsent(true);
    expect(ph.opt_in_capturing).toHaveBeenCalledTimes(1);
    setAnalyticsConsent(false);
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1);
    captureEvent('insurance_intent_selected', { intent: 'dental' });
    expect(ph.capture).toHaveBeenCalledWith('insurance_intent_selected', { intent: 'dental' });
  });

  it('admin-режим: autocapture и запись сессий выключаются (PII лидов)', async () => {
    vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
    const { initAnalytics } = await import('./posthog');
    initAnalytics({ autocapture: false, sessionRecording: false });
    const cfg = ph.init.mock.calls[0]![1] as Record<string, unknown>;
    expect(cfg.autocapture).toBe(false);
    expect(cfg.disable_session_recording).toBe(true);
  });
});

describe('detectTrafficChannel (GEO vs обычный трафик)', () => {
  const setEnv = (referrer: string, search = '') => {
    Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
    Object.defineProperty(window, 'location', {
      value: { search, hostname: 'segurotenerife.com' },
      configurable: true,
    });
  };

  it('AI-движки (ChatGPT/Perplexity/Gemini/Claude) → channel=ai + ai_engine', async () => {
    const { detectTrafficChannel } = await import('./posthog');
    setEnv('https://chatgpt.com/');
    expect(detectTrafficChannel()).toMatchObject({ traffic_channel: 'ai', ai_engine: 'ChatGPT' });
    setEnv('https://www.perplexity.ai/search');
    expect(detectTrafficChannel()).toMatchObject({ traffic_channel: 'ai', ai_engine: 'Perplexity' });
    setEnv('https://gemini.google.com/');
    expect(detectTrafficChannel()).toMatchObject({ traffic_channel: 'ai', ai_engine: 'Gemini' });
  });

  it('AI по utm_source (Perplexity) → channel=ai', async () => {
    const { detectTrafficChannel } = await import('./posthog');
    setEnv('', '?utm_source=perplexity');
    expect(detectTrafficChannel()).toMatchObject({ traffic_channel: 'ai', ai_engine: 'Perplexity' });
  });

  it('поисковики/соцсети/прямой — НЕ ai', async () => {
    const { detectTrafficChannel } = await import('./posthog');
    setEnv('https://www.google.com/search');
    expect(detectTrafficChannel().traffic_channel).toBe('search');
    setEnv('https://t.me/somechannel');
    expect(detectTrafficChannel().traffic_channel).toBe('social');
    setEnv('');
    expect(detectTrafficChannel().traffic_channel).toBe('direct');
  });
});
