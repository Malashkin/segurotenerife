/**
 * Cloudflare Pages advanced-mode worker (кладётся как dist/_worker.js).
 *
 * Реверс-прокси PostHog: запросы на /ph/* идут «первой стороной» через наш домен
 * (обход блокировщиков рекламы и Safari ITP, которые режут i.posthog.com).
 *   /ph/static/* → eu-assets.i.posthog.com (array/config, surveys, recorder)
 *   /ph/*        → eu.i.posthog.com        (события /i/v0/e/, /flags и т.д.)
 * Все остальные пути отдаёт статика сайта через env.ASSETS.
 */
const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ph' || url.pathname.startsWith('/ph/')) {
      const rest = url.pathname.replace(/^\/ph/, '') || '/';
      const host = rest.startsWith('/static/') ? ASSET_HOST : API_HOST;
      const headers = new Headers(request.headers);
      headers.set('host', host);
      headers.delete('cookie'); // наши куки PostHog не нужны
      const init = { method: request.method, headers, redirect: 'follow' };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
        init.duplex = 'half';
      }
      return fetch(`https://${host}${rest}${url.search}`, init);
    }
    // Обычные страницы/ассеты сайта.
    return env.ASSETS.fetch(request);
  },
};
