import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: false,
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
      // Handle load failures gracefully
      requestOptions: {
        cache: 'no-cache',
      },
    },
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Check localStorage first, then navigator, then HTML tag
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Store selection in localStorage
      caches: ['localStorage'],
      // Use preferredLanguage key to match our component
      lookupLocalStorage: 'preferredLanguage',
    },
    // Preload fallback language
    preload: ['en'],
    // Handle load failures
    saveMissing: false,
    // Custom key separator
    keySeparator: '.',
    // Custom namespace separator
    nsSeparator: ':',
  });

export default i18n;
