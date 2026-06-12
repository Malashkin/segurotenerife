/**
 * Реестр ресурсов переводов (namespaces) для i18next.
 *
 * Используется ОДИН namespace `common` (требование задачи: «one namespace,
 * JSON per language»). В нём лежат ВСЕ строки приложения:
 *   - словарь I18N прототипа (лендинг: nav, hero, типы страховок, «как это
 *     работает», квиз с 6 шагами, статьи, FAQ, footer, валидация форм);
 *   - словарь CHAT_I18N прототипа (строки чат-виджета) под префиксом `chat_*`,
 *     чтобы избежать коллизий ключей внутри одного namespace.
 *
 * Контент портирован ВЕРБАТИМ из прототипа /Users/mike/Desktop/fun/index.html
 * и хранится в JSON-бандлах src/locales/<lng>/common.json — по одному файлу на
 * язык. Ключи совпадают с `data-i18n` / `data-i18n-ph` из прототипа, чтобы
 * виджеты могли обращаться через `t('hero_h1')`, `t('s1_h')`, `t('chat_title')`.
 *
 * ВАЖНО про интерполяцию и HTML (хранится дословно, как в прототипе):
 *   - `q_count_tpl` содержит плейсхолдер `%s` (НЕ `{{var}}`). Потребитель
 *     подставляет номер шага простой заменой: t('q_count_tpl').replace('%s', n).
 *   - `hero_h1` и `consent_text` содержат HTML (<span class="hl">…</span>,
 *     <a href="#privacy">…</a>). Рендерить через <Trans> или
 *     dangerouslySetInnerHTML на стороне UI. Доп. ключ `hero_h1_hl` отдаёт
 *     только выделенное слово для виджетов, которые собирают заголовок сами.
 *
 * Базовый язык — en (фоллбэк). Украинский — внутренний код `uk` (в UI «UA»).
 *
 * Как добавить ещё namespace (например выделить `chat` отдельно):
 *   1. Создать src/locales/<lng>/chat.json для каждого языка.
 *   2. Импортировать их сюда и добавить в `resources[lng].chat`.
 *   3. Добавить имя в NAMESPACES.
 */
import type { AppLocale } from './config';

// Бандлы переводов: один JSON `common` на язык.
// resolveJsonModule включён в tsconfig.base.json, поэтому импорт типобезопасен.
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import ukCommon from './locales/uk/common.json';
import ruCommon from './locales/ru/common.json';

/**
 * Тип одного словаря namespace.
 * Значение — строка (возможно с плейсхолдером `%s` или HTML, см. шапку файла).
 */
export type TranslationDict = Record<string, string>;

/**
 * Структура ресурсов одного языка: namespace -> словарь.
 * Индекс-сигнатура нужна для совместимости с типом `Resource` из i18next
 * (где значение языка — запись namespace -> ресурсы) и для добавления новых
 * namespaces без правки типа.
 */
export interface LocaleResources {
  /** Общие строки лендинга, квиза, чата, FAQ и т.д. */
  common: TranslationDict;
  [namespace: string]: TranslationDict;
}

/**
 * Полный набор ресурсов по всем языкам.
 * Базовый язык — en; при отсутствии перевода i18next отдаёт фоллбэк на en.
 */
export const resources: Record<AppLocale, LocaleResources> = {
  en: { common: enCommon },
  es: { common: esCommon },
  uk: { common: ukCommon },
  ru: { common: ruCommon },
};

/** Список namespaces, известных приложению (для типизации и предзагрузки). */
export const NAMESPACES = ['common'] as const;

/** Namespace по умолчанию, если в t() не указан явно. */
export const DEFAULT_NAMESPACE = 'common';
