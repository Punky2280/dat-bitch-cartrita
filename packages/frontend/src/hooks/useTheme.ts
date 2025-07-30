import { useState, useEffect } from 'react';
type Theme = 'light' | 'dark';
export const useTheme = (): [Theme, () => void] => {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'dark'
  );
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () =>
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  return [theme, toggleTheme];
};
