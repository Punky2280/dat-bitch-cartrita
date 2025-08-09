import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  available: boolean;
}

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([
    "en",
  ]);

  // Check which translation files are available by testing HTTP requests
  useEffect(() => {
    const checkLanguageAvailability = async () => {
      const languagesToCheck = ["en", "es", "en-US"];
      const available: string[] = [];

      for (const lang of languagesToCheck) {
        try {
          const response = await fetch(`/locales/${lang}/translation.json`);
          if (response.ok) {
            available.push(lang);
          }
        } catch (error) {
          console.debug(`Language ${lang} not available:`, error);
        }
      }

      setAvailableLanguages(available.length > 0 ? available : ["en"]);
    };

    checkLanguageAvailability().catch((error) => {
      console.error("Error checking language availability:", error);
      setAvailableLanguages(["en"]); // Fallback to English
    });
  }, []);

  const allLanguages: Language[] = [
    {
      code: "en",
      name: "English",
      nativeName: "English",
      flag: "🇺🇸",
      available: true,
    },
    {
      code: "en-US",
      name: "English (US)",
      nativeName: "English (US)",
      flag: "🇺🇸",
      available: true,
    },
    {
      code: "es",
      name: "Spanish",
      nativeName: "Español",
      flag: "🇪🇸",
      available: true,
    },
    {
      code: "fr",
      name: "French",
      nativeName: "Français",
      flag: "🇫🇷",
      available: false,
    },
    {
      code: "de",
      name: "German",
      nativeName: "Deutsch",
      flag: "🇩🇪",
      available: false,
    },
    {
      code: "it",
      name: "Italian",
      nativeName: "Italiano",
      flag: "🇮🇹",
      available: false,
    },
    {
      code: "pt",
      name: "Portuguese",
      nativeName: "Português",
      flag: "🇵🇹",
      available: false,
    },
    {
      code: "ru",
      name: "Russian",
      nativeName: "Русский",
      flag: "🇷🇺",
      available: false,
    },
    {
      code: "ja",
      name: "Japanese",
      nativeName: "日本語",
      flag: "🇯🇵",
      available: false,
    },
    {
      code: "ko",
      name: "Korean",
      nativeName: "한국어",
      flag: "🇰🇷",
      available: false,
    },
    {
      code: "zh-CN",
      name: "Chinese (Simplified)",
      nativeName: "简体中文",
      flag: "🇨🇳",
      available: false,
    },
    {
      code: "ar",
      name: "Arabic",
      nativeName: "العربية",
      flag: "🇸🇦",
      available: false,
    },
    {
      code: "hi",
      name: "Hindi",
      nativeName: "हिन्दी",
      flag: "🇮🇳",
      available: false,
    },
  ];

  // Filter languages based on what's actually available
  const languages = allLanguages.map((lang) => ({
    ...lang,
    available: availableLanguages.includes(lang.code),
  }));

  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = async (languageCode: string) => {
    const selectedLanguage = languages.find(
      (lang) => lang.code === languageCode,
    );

    if (!selectedLanguage?.available) {
      console.warn(`Language ${languageCode} is not available`);
      return;
    }

    try {
      await i18n.changeLanguage(languageCode);
      localStorage.setItem("preferredLanguage", languageCode);
      setIsOpen(false);

      // Optional: Show success notification
      console.log(`Language changed to ${selectedLanguage.nativeName}`);
    } catch (error) {
      console.error("Failed to change language:", error);
      // Optional: Show error notification
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-600/50 bg-gray-800/20 hover:bg-gray-800/40 transition-all duration-200"
      >
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{currentLanguage.flag}</span>
          <div className="text-left">
            <div className="font-medium text-white">
              {currentLanguage.nativeName}
            </div>
            <div className="text-xs text-gray-400">{currentLanguage.name}</div>
          </div>
        </div>
        <div
          className={`transform transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-card border border-gray-600/50 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              disabled={!language.available}
              className={`w-full flex items-center space-x-3 p-3 text-left transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg ${
                language.code === currentLanguage.code
                  ? "bg-blue-600/20 text-blue-300"
                  : language.available
                    ? "hover:bg-gray-800/50 text-white"
                    : "text-gray-500 cursor-not-allowed"
              }`}
            >
              <span className="text-2xl">{language.flag}</span>
              <div className="flex-1">
                <div
                  className={`font-medium ${
                    language.available ? "text-white" : "text-gray-500"
                  }`}
                >
                  {language.nativeName}
                </div>
                <div className="text-xs text-gray-400 flex items-center space-x-2">
                  <span>{language.name}</span>
                  {!language.available && (
                    <span className="px-2 py-0.5 bg-gray-700/50 rounded text-xs">
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>
              {language.code === currentLanguage.code && (
                <div className="text-blue-400">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default LanguageSelector;
