import { createI18n } from 'vue-i18n';
import { en } from './locales/en';
import { ru } from './locales/ru';

export const messages = {
  en,
  ru,
};

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'ru',
  fallbackLocale: 'en',
  messages,
});

export function setLocale(locale: 'ru' | 'en') {
  i18n.global.locale.value = locale;
}
