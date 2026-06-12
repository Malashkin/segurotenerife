/**
 * React-хелперы для языка интерфейса: useLang() и changeLang().
 *
 * Тонкая обёртка над инстансом i18next (init.ts). Даёт компонентам (например
 * переключателю языков в шапке) реактивный доступ к текущему языку и удобный
 * сеттер, который сохраняет выбор в localStorage. Под капотом подписывается на
 * событие i18next `languageChanged`, поэтому при смене языка все потребители
 * useLang() перерисуются.
 *
 * Почему отдельный хук, а не только useTranslation().i18n.language:
 *   - даёт узкий тип AppLocale (а не string);
 *   - инкапсулирует персист (changeLocale уже пишет в localStorage);
 *   - отдаёт готовый список языков в порядке EN, ES, UA, RU для рендера кнопок.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { FALLBACK_LOCALE, LOCALE_ORDER, type AppLocale } from './config';
import { changeLocale, getCurrentLocale, i18n } from './init';

/**
 * Подписка на смену языка для useSyncExternalStore.
 * Возвращает функцию отписки. Вызывается React при монтировании потребителя.
 */
function subscribe(onChange: () => void): () => void {
  i18n.on('languageChanged', onChange);
  return () => {
    i18n.off('languageChanged', onChange);
  };
}

/** Снимок текущего языка (узкий тип). Используется и на клиенте, и при SSR. */
function getSnapshot(): AppLocale {
  return getCurrentLocale();
}

/** Серверный снимок (нет инстанса языка) — отдаём базовый язык. */
function getServerSnapshot(): AppLocale {
  return FALLBACK_LOCALE;
}

/**
 * Результат useLang(): текущий язык, сеттер и список языков для переключателя.
 */
export interface UseLangResult {
  /** Текущий активный язык приложения. */
  lang: AppLocale;
  /**
   * Переключить язык и сохранить выбор в localStorage.
   * Идентичен changeLang ниже — продублирован в объекте для удобства вызова.
   */
  changeLang: (locale: AppLocale) => Promise<void>;
  /** Список языков в фиксированном порядке EN, ES, UA, RU (для рендера кнопок). */
  locales: readonly AppLocale[];
}

/**
 * Хук текущего языка. Перерисовывает компонент при смене языка.
 *
 * @example
 * const { lang, changeLang, locales } = useLang();
 * return locales.map(l => (
 *   <button key={l} aria-pressed={l === lang} onClick={() => changeLang(l)}>
 *     {LOCALE_LABELS[l]}
 *   </button>
 * ));
 */
export function useLang(): UseLangResult {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const change = useCallback((locale: AppLocale) => changeLocale(locale), []);
  return { lang, changeLang: change, locales: LOCALE_ORDER };
}

/**
 * Императивная смена языка вне React-дерева (или из обработчиков).
 * Сохраняет выбор в localStorage и переключает i18next. Совпадает с
 * changeLocale из init.ts — экспортируется под именем changeLang, как просит
 * задача (useLang()/changeLang()).
 *
 * @param locale - целевой язык (en | es | uk | ru)
 */
export function changeLang(locale: AppLocale): Promise<void> {
  return changeLocale(locale);
}
