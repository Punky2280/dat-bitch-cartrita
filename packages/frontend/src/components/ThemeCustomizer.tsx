import React, { useState } from "react";
import { colors } from "@/theme/tokens";
import { useTranslation } from "react-i18next";
import { useThemeContext } from "@/context/ThemeContext";

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    theme,
    setTheme,
    themeSettings,
    updateCustomSettings,
    resetToPreset,
    isCustomized,
  } = useThemeContext();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"presets" | "colors" | "effects">(
    "presets",
  );

  const themePresets = [
    { key: "dark", name: "Dark", description: "Classic dark theme with blue accents", preview: colors.gray900 },
    { key: "light", name: "Light", description: "Clean light theme for day usage", preview: colors.white },
    { key: "cyberpunk", name: "Cyberpunk", description: "Matrix-inspired green glow", preview: colors.gray800 },
    { key: "neon", name: "Neon", description: "Vibrant neon with purple hues", preview: colors.accentPurple },
    { key: "minimal", name: "Minimal", description: "Clean and distraction-free", preview: colors.gray100 },
  ];

  const handleColorChange = (property: string, value: string) => {
    updateCustomSettings({ [property]: value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-600/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gradient">
                {t("theme.themeCustomizer")}
              </h2>
              <p className="text-gray-400 mt-1">
                {t("theme.personalizeExperience")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="p-6 border-b border-gray-600/50">
          <nav className="flex space-x-1 glass-card p-1 rounded-xl w-fit">
            {[
              { key: "presets", label: t("theme.presets"), icon: "🎨" },
              { key: "colors", label: t("theme.colors"), icon: "🌈" },
              { key: "effects", label: t("theme.effects"), icon: "✨" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "presets" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  {t("theme.themePresets")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {themePresets.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => setTheme(preset.key as any)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        theme === preset.key
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div
                          className="w-8 h-8 rounded-full border-2 border-gray-600"
                          style={{ backgroundColor: preset.preview }}
                        ></div>
                        <div>
                          <h4 className="font-semibold">{preset.name}</h4>
                          {theme === preset.key && (
                            <span className="text-xs text-blue-400">
                              {t("dashboard.active")}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {isCustomized && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-yellow-400">
                        {t("theme.customThemeActive")}
                      </h4>
                      <p className="text-sm text-yellow-300/80">
                        {t("theme.customizedTheme")}
                      </p>
                    </div>
                    <button
                      onClick={resetToPreset}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors text-sm font-medium"
                    >
                      {t("theme.resetToPreset")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "colors" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4">
                {t("theme.colorCustomization")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.primaryColor")}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={themeSettings.primaryColor}
                        onChange={(e) =>
                          handleColorChange("primaryColor", e.target.value)
                        }
                        className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={themeSettings.primaryColor}
                        onChange={(e) =>
                          handleColorChange("primaryColor", e.target.value)
                        }
                        className="flex-1 input-enhanced px-3 py-2 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.accentColor")}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={themeSettings.accentColor}
                        onChange={(e) =>
                          handleColorChange("accentColor", e.target.value)
                        }
                        className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={themeSettings.accentColor}
                        onChange={(e) =>
                          handleColorChange("accentColor", e.target.value)
                        }
                        className="flex-1 input-enhanced px-3 py-2 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.backgroundColor")}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={themeSettings.backgroundColor}
                        onChange={(e) =>
                          handleColorChange("backgroundColor", e.target.value)
                        }
                        className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={themeSettings.backgroundColor}
                        onChange={(e) =>
                          handleColorChange("backgroundColor", e.target.value)
                        }
                        className="flex-1 input-enhanced px-3 py-2 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.textColor")}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={themeSettings.textColor}
                        onChange={(e) =>
                          handleColorChange("textColor", e.target.value)
                        }
                        className="w-12 h-12 rounded-lg border border-gray-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={themeSettings.textColor}
                        onChange={(e) =>
                          handleColorChange("textColor", e.target.value)
                        }
                        className="flex-1 input-enhanced px-3 py-2 rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.surfaceColor")}
                    </label>
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-12 h-12 rounded-lg border border-gray-600"
                        style={{ backgroundColor: themeSettings.surfaceColor }}
                      ></div>
                      <input
                        type="text"
                        value={themeSettings.surfaceColor}
                        onChange={(e) =>
                          handleColorChange("surfaceColor", e.target.value)
                        }
                        className="flex-1 input-enhanced px-3 py-2 rounded-lg text-sm font-mono"
                        placeholder="rgba(17, 24, 39, 0.8)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Card */}
              <div className="mt-8">
                <h4 className="text-md font-semibold mb-3">
                  {t("theme.preview")}
                </h4>
                <div className="glass-card p-6 space-y-4">
                  <h5 className="text-lg font-semibold">
                    {t("theme.sampleCard")}
                  </h5>
                  <p className="text-gray-400">
                    This is how cards will look with your custom colors.
                  </p>
                  <button className="btn-skittles px-4 py-2 rounded-lg font-semibold">
                    {t("theme.sampleButton")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "effects" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4">
                {t("theme.visualEffects")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.glassOpacity")}
                    </label>
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={themeSettings.glassOpacity}
                        onChange={(e) =>
                          handleColorChange("glassOpacity", e.target.value)
                        }
                        className="w-full accent-blue-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{t("theme.transparent")}</span>
                        <span>{themeSettings.glassOpacity}</span>
                        <span>{t("theme.opaque")}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.animationSpeed")}
                    </label>
                    <select
                      value={themeSettings.animationSpeed}
                      onChange={(e) =>
                        handleColorChange("animationSpeed", e.target.value)
                      }
                      className="w-full input-enhanced px-3 py-2 rounded-lg"
                    >
                      <option value="100ms">{t("theme.fast")} (100ms)</option>
                      <option value="200ms">{t("theme.quick")} (200ms)</option>
                      <option value="300ms">{t("theme.normal")} (300ms)</option>
                      <option value="500ms">{t("theme.slow")} (500ms)</option>
                      <option value="800ms">{t("theme.smooth")} (800ms)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.borderRadius")}
                    </label>
                    <select
                      value={themeSettings.borderRadius}
                      onChange={(e) =>
                        handleColorChange("borderRadius", e.target.value)
                      }
                      className="w-full input-enhanced px-3 py-2 rounded-lg"
                    >
                      <option value="4px">{t("theme.sharp")} (4px)</option>
                      <option value="8px">{t("theme.subtle")} (8px)</option>
                      <option value="12px">{t("theme.normal")} (12px)</option>
                      <option value="16px">{t("theme.rounded")} (16px)</option>
                      <option value="24px">
                        {t("theme.veryRounded")} (24px)
                      </option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t("theme.fontSize")}
                    </label>
                    <select
                      value={themeSettings.fontSize}
                      onChange={(e) =>
                        handleColorChange("fontSize", e.target.value)
                      }
                      className="w-full input-enhanced px-3 py-2 rounded-lg"
                    >
                      <option value="14px">{t("theme.small")} (14px)</option>
                      <option value="15px">{t("theme.compact")} (15px)</option>
                      <option value="16px">{t("theme.normal")} (16px)</option>
                      <option value="17px">{t("theme.large")} (17px)</option>
                      <option value="18px">
                        {t("theme.extraLarge")} (18px)
                      </option>
                    </select>
                  </div>

                  {/* Effect Toggles */}
                  <div className="p-4 border border-gray-600/50 rounded-lg">
                    <h5 className="font-medium mb-3">
                      {t("theme.specialEffects")}
                    </h5>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm">
                          {t("theme.blurEffects")}
                        </span>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-sm">
                          {t("theme.glowEffects")}
                        </span>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-sm">
                          {t("theme.backgroundAnimation")}
                        </span>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-sm">
                          {t("theme.hoverAnimations")}
                        </span>
                        <input
                          type="checkbox"
                          defaultChecked
                          className="toggle"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-600/50 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {t("theme.changesSavedAuto")}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={resetToPreset}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              {t("theme.resetAll")}
            </button>
            <button
              onClick={onClose}
              className="btn-skittles px-6 py-2 rounded-lg font-semibold"
            >
              {t("theme.done")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
