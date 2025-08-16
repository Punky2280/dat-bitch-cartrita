import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import buildTheme, { Theme } from '@/theme/tokens';
import { applyCssVariables } from '@/theme/applyCssVariables';

type Mode = 'dark' | 'light';

export type ThemeOverrides = Partial<Theme['colors']> & { mode?: Mode };

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  overrides: ThemeOverrides;
  setMode: (mode: Mode) => void;
  updateOverrides: (patch: ThemeOverrides) => void;
  resetOverrides: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'cartrita:userTheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = safeRead();
    return (saved?.mode as Mode) || 'dark';
  });
  const [overrides, setOverrides] = useState<ThemeOverrides>(() => safeRead() || {});

  const theme = useMemo(() => {
    const base = buildTheme(mode);
    // Merge color overrides into semantic colors
    const merged: Theme = {
      ...base,
      colors: { ...base.colors, ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'mode')) },
    };
    return merged;
  }, [mode, overrides]);

  useEffect(() => {
    applyCssVariables(theme);
  }, [theme]);

  const updateOverrides = (patch: ThemeOverrides) => {
    setOverrides((prev) => {
      const next = { ...prev, ...patch };
      safeWrite({ ...next, mode });
      return next;
    });
    if (patch.mode && (patch.mode === 'dark' || patch.mode === 'light')) {
      setMode(patch.mode);
    }
  };

  const resetOverrides = () => {
    setOverrides({});
    safeWrite({ mode });
  };

  const value: ThemeContextValue = { theme, mode, overrides, setMode, updateOverrides, resetOverrides };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function safeRead(): ThemeOverrides | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeOverrides) : null;
  } catch {
    return null;
  }
}

function safeWrite(obj: ThemeOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage failures
  }
}
