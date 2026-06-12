/**
 * Хук локализации чата.
 *
 * Делает три вещи:
 *  1. Один раз регистрирует самодостаточный словарь чата (CHAT_DICT) в i18next
 *     как namespace `chat` через addResourceBundle (idempotent-проверка через
 *     hasResourceBundle). Это гарантирует, что чат полностью переведён даже до
 *     того, как i18n-агент наполнит общий namespace `common`.
 *  2. Возвращает функцию-переводчик `ct(key)` с фоллбэком namespace
 *     [common, chat]: сначала ищем перевод в общем словаре приложения, затем —
 *     в нашем бандле. Так чат уважает общий контент, но никогда не «ломается».
 *  3. Возвращает текущий язык (`lang`), на который завязан ре-рендер: при смене
 *     языка переключателем в шапке react-i18next ре-рендерит подписчиков
 *     useTranslation, и чат перерисовывается на новом языке без перезагрузки.
 *
 * Все строки чата читаются через `ct`, поэтому смена языка моментально меняет
 * вопросы, опции, форму и экран хендоффа (зеркало applyLang→chatOnLang прототипа).
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n, type AppLocale, SUPPORTED_LOCALES } from '@shared/i18n';
import { CHAT_DICT, CHAT_NS } from './chatDict';

/** Регистрирует CHAT_DICT в i18next (один раз на язык). Безопасно повторно. */
function ensureChatBundle(): void {
  for (const lng of SUPPORTED_LOCALES) {
    if (!i18n.hasResourceBundle(lng, CHAT_NS)) {
      // deep=true/overwrite=false: не затираем, если кто-то уже добавил namespace.
      i18n.addResourceBundle(lng, CHAT_NS, CHAT_DICT[lng], true, false);
    }
  }
}

/** Тип возвращаемого переводчика чата. */
export interface ChatI18n {
  /**
   * Переводит ключ чата. Порядок поиска: namespace `common` (общий контент
   * приложения) → namespace `chat` (наш бандл). Возвращает строку всегда.
   */
  ct: (key: string) => string;
  /** Текущий активный язык (для завязки ре-рендера и записи comm_lang в лид). */
  lang: AppLocale;
}

/**
 * Хук локализации чата. Вызывать в компоненте чата.
 * @returns { ct, lang } — переводчик и текущий язык.
 */
export function useChatI18n(): ChatI18n {
  // Подписка на i18next: re-render при смене языка (реактивность к переключателю).
  const { t, i18n: inst } = useTranslation();

  // Регистрируем бандл синхронно при первом рендере (до первого ct),
  // и повторно проверяем в effect на случай ленивой инициализации i18n.
  ensureChatBundle();
  useEffect(() => {
    ensureChatBundle();
  }, []);

  const ct = (key: string): string =>
    // t с массивом namespace: первый, где есть ключ, побеждает.
    // defaultValue=key, чтобы при полном отсутствии перевода показать сам ключ,
    // а не пустую строку (диагностируемо в dev).
    t(key, { ns: ['common', CHAT_NS], defaultValue: key });

  const lang = (inst.language as AppLocale) ?? 'en';
  return { ct, lang };
}
