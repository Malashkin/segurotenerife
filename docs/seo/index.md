---
audience: [product, frontend]
owner: seguro-tenerife
updated: 2026-06-25
---

# SEO

Цель: попасть в выдачу Google по запросам про страховку на Тенерифе / для ВНЖ и
визы в Испании на 4 языках (ru/uk/en/es).

## Что уже настроено (в коде)

- **robots.txt** (`public/robots.txt`) — `Allow: /` + ссылка на sitemap.
- **sitemap** — `@astrojs/sitemap` → `sitemap-index.xml` с i18n-альтернативами.
- **canonical + hreflang** на все 4 локали + `x-default` (Layout.astro).
- **per-locale `<title>`/`<description>`/`<keywords>`** — `src/i18n/seo.ts`
  (запрос впереди, бренд в конце; keywords включают варианты написания и опечатки).
- **OG/Twitter** + og-image 1200×630.
- **JSON-LD**: `InsuranceAgency`+`Organization` (areaServed = Tenerife/Canarias/
  Spain — локальный сигнал), `WebSite`, `FAQPage` (rich-результаты).
- **meta robots** `index, follow, max-image-preview:large`.
- **Google-верификация** — опциональный `<meta google-site-verification>` из env
  `PUBLIC_GOOGLE_SITE_VERIFICATION` (без правки кода).

## Ключевые слова (целевые запросы)

В `src/i18n/seo.ts` (title/description/keywords). Примеры:
- **ru:** страховка Тенерифе, медицинская страховка для ВНЖ, страховка для визы в
  Испанию, медстраховка для консульства, + варианты «страховка тенериф».
- **en:** tenerife health insurance, spain residency / non-lucrative visa
  insurance, expat insurance tenerife.
- **es:** seguro residencia tenerife, seguro médico para visado España.
- **uk:** страхування для ВНЖ Іспанія, страхування Тенерифе.

> Опечатки/варианты держим в `keywords` (тег невидим). В видимый текст спам не
> выносим — Google и сам исправляет опечатки в запросах.

## Чтобы проиндексироваться в Google (действия владельца)

1. **Google Search Console** → добавить ресурс `segurotenerife.com`.
2. **Подтвердить владение** одним из способов:
   - **DNS (рекомендуется):** GSC даст TXT-запись → добавить в Cloudflare DNS
     (домен уже там). Подтверждает весь домен.
   - **HTML-тег:** GSC даст код → прислать его, проставим в env
     `PUBLIC_GOOGLE_SITE_VERIFICATION` и передеплоим.
3. **Отправить sitemap:** в GSC → Sitemaps → `https://segurotenerife.com/sitemap-index.xml`.
4. **Запросить индексацию:** URL Inspection → ввести URL главной → Request Indexing
   (повторить для `/es/`, `/uk/`, `/en/`).
5. (Опц.) **Bing Webmaster Tools** — можно импортировать из GSC.

Индексация занимает от нескольких дней до 1–2 недель. Ранжирование растёт по мере
накопления контента/ссылок.
