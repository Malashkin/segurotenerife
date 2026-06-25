/**
 * Коллекция статей блога (Content Layer, Astro 6). Markdown в
 * `src/content/articles/{locale}/{slug}.md`. Локаль/slug — из frontmatter;
 * по ним строятся per-locale URL (/blog/<slug>, /uk/blog/<slug>, …) и sitemap.
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    locale: z.enum(['ru', 'uk', 'en', 'es']),
    // НЕ `slug` — это зарезервированное имя у Astro (коллизия между локалями).
    urlSlug: z.string(),
    title: z.string(),
    description: z.string(),
    tag: z.string(),
    keywords: z.string().optional(),
    /** Дата публикации/обновления (для Article schema + сортировки). */
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** Мини-FAQ статьи → FAQPage schema (GEO: AI-движки любят Q&A). */
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    /** Порядок в листинге. */
    order: z.number().default(0),
  }),
});

export const collections = { articles };
