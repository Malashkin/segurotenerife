/**
 * Построение deep-link'ов на мессенджеры для экрана хендоффа.
 *
 * После успешной отправки лида показываем кнопки «продолжить в WhatsApp /
 * Telegram / Viber» с предзаполненным сообщением — зеркало buildLink()/renderDone()
 * прототипа. Пользователь может написать менеджеру сам, чтобы ускорить, либо
 * просто дождаться ответа (текст `here`).
 *
 * Контакты офиса-партнёра берутся из Vite-переменных окружения (с дефолтами из
 * прототипа), чтобы их можно было сконфигурировать без правки кода:
 *   VITE_WHATSAPP_NUMBER   — номер WhatsApp в формате wa.me (только цифры);
 *   VITE_TELEGRAM_USERNAME — username Telegram-аккаунта офиса (без @);
 *   VITE_VIBER_NUMBER      — номер Viber (по умолчанию = номер WhatsApp).
 */
import type { ChatMessenger } from '@shared/store';

/** Контакты офиса-партнёра для deep-link'ов. */
export interface OfficeContacts {
  whatsappNumber: string;
  telegramUsername: string;
  viberNumber: string;
}

/**
 * Читает контакты офиса из env с дефолтами из прототипа.
 * import.meta.env типизируется через vite/client в приложениях; здесь читаем
 * мягко (optional chaining), чтобы код был безопасен и вне Vite (тесты).
 */
export function getOfficeContacts(): OfficeContacts {
  const env = import.meta.env;
  const whatsappNumber = env?.VITE_WHATSAPP_NUMBER || '34600000000';
  const telegramUsername = (env?.VITE_TELEGRAM_USERNAME || 'your_office').replace(/^@/, '');
  const viberNumber = env?.VITE_VIBER_NUMBER || whatsappNumber;
  return { whatsappNumber, telegramUsername, viberNumber };
}

/**
 * Строит deep-link на выбранный мессенджер с предзаполненным сообщением.
 *
 *  - WhatsApp: https://wa.me/<number>?text=<msg>
 *  - Telegram: https://t.me/<username>  (Telegram не принимает text для t.me/username)
 *  - Viber:    viber://chat?number=%2B<number>&text=<msg>
 *
 * @param messenger - целевой мессенджер
 * @param contacts  - контакты офиса
 * @param message   - текст предзаполненного сообщения менеджеру
 */
export function buildHandoffLink(
  messenger: ChatMessenger,
  contacts: OfficeContacts,
  message: string,
): string {
  const text = encodeURIComponent(message);
  switch (messenger) {
    case 'Telegram':
      return `https://t.me/${contacts.telegramUsername}`;
    case 'Viber':
      // Viber требует номер в международном формате с ведущим «+» (кодируется как %2B).
      return `viber://chat?number=%2B${contacts.viberNumber}&text=${text}`;
    case 'WhatsApp':
    default:
      return `https://wa.me/${contacts.whatsappNumber}?text=${text}`;
  }
}

/** Ключ перевода кнопки «продолжить в <мессенджер>» (contWa/contTg/contVb). */
export function continueLabelKey(messenger: ChatMessenger): string {
  switch (messenger) {
    case 'Telegram':
      return 'contTg';
    case 'Viber':
      return 'contVb';
    case 'WhatsApp':
    default:
      return 'contWa';
  }
}
