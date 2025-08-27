import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  contrast: 'normal' | 'high' | 'low';
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  focus: boolean;
}

interface AccessibilityStore {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  resetToDefaults: () => void;
}

const defaultSettings: AccessibilitySettings = {
  fontSize: 'medium',
  contrast: 'normal',
  reducedMotion: false,
  screenReader: false,
  keyboardNavigation: true,
  focus: true,
};

export const useAccessibilityStore = create<AccessibilityStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      resetToDefaults: () =>
        set({
          settings: defaultSettings,
        }),
    }),
    {
      name: 'accessibility-store',
    }
  )
);