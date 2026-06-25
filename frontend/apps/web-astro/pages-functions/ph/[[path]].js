/**
 * Реверс-прокси PostHog через наш домен: segurotenerife.com/ph/* → PostHog EU.
 * Зачем: блокировщики рекламы и Safari ITP режут запросы к i.posthog.com и теряют
 * аналитику. Через первый-сторонний путь /ph/* запросы не блокируются.
 *
 * Маршрутизация (как в офиц. рекомендации PostHog):
 *   /ph/static/*  → eu-assets.i.posthog.com (статика: array/config, surveys, recorder)
 *   /ph/*         → eu.i.posthog.com         (события /i/v0/e/, /flags и т.д.)
 *
 * Cloudflare Pages Function: файл functions/ph/[[path]].js обрабатывает /ph/*.
 */
const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';

export const onRequest = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  // /ph/<rest> → /<rest>
  const rest = url.pathname.replace(/^\/ph/, '') || '/';
  const host = rest.startsWith('/static/') ? ASSET_HOST : API_HOST;
  const target = `https://${host}${rest}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('host', host);
  // Не передаём наши куки в PostHog (приватность; ему они не нужны).
  headers.delete('cookie');

  const init = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  };
  if (init.body) init.duplex = 'half'; // потоковое тело в Workers fetch

  return fetch(target, init);
};
