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
      // Add error handling for failed requests
      parse: (data: string) => {
        try {
          return JSON.parse(data);
        } catch (error) {
          console.error('i18n: Failed to parse translation data:', error);
          return {};
        }
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
    // Add error handling
    missingKeyHandler: (lng, _ns, key) => {
      console.debug(
        `i18n: Missing translation key "${key}" for language "${lng}"`
      );
    },
  })
  .catch(error => {
    console.error('i18n initialization failed:', error);
    // Continue with default English
  });

export default i18n;
