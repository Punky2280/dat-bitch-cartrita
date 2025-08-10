// Design tokens for Cartrita theme system
// Semantic tokens preferred over raw hex usage in components.
export const colors = {
  // Base palette
  gray900: '#0d0d0f',
  gray800: '#1a1c1f',
  gray700: '#26292d',
  gray600: '#32353a',
  gray500: '#4a4f57',
  gray400: '#6a7079',
  gray300: '#8b929c',
  gray200: '#b1b7c0',
  gray100: '#d8dce2',
  white: '#ffffff',
  black: '#000000',
  // Accents
  accentPrimary: '#6366f1',
  accentPrimaryHover: '#4f46e5',
  accentSecondary: '#ec4899',
  accentTertiary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',
  success: '#10b981',
  // Extended accents / specials
  accentPurple: '#8b5cf6',
  accentBlue: '#3b82f6',
  accentGreen: '#43e97b',
  accentTeal: '#38f9d7',
  accentPink: '#fa709a',
  accentYellow: '#fee140',
  accentAqua: '#4facfe',
  accentCyan: '#00f2fe',
  accentRose: '#f5576c',
  accentMagenta: '#f093fb',
  accentPeachLight: '#ffecd2',
  accentPeach: '#fcb69f',
  accentMint: '#00ff88', // neon success accent used in visualizers
};

export const semantic = {
  bg: colors.gray900,
  bgAlt: colors.gray800,
  surface: colors.gray700,
  surfaceAlt: colors.gray600,
  border: colors.gray600,
  borderSubtle: colors.gray500,
  textPrimary: colors.gray100,
  textSecondary: colors.gray300,
  textMuted: colors.gray400,
  textInverted: colors.white,
  focus: colors.accentPrimary,
  link: colors.accentPrimary,
  linkHover: colors.accentPrimaryHover,
  critical: colors.danger,
  warn: colors.warning,
  success: colors.success,
  info: colors.info,
  accent: colors.accentSecondary,
  accentAlt: colors.accentPurple,
  graphTrigger: colors.accentBlue,
  graphAI: colors.accentMagenta,
  graphRAG: colors.accentAqua,
  graphMCP: colors.accentGreen,
  graphHTTP: colors.accentPink,
  graphLogic: colors.accentPeachLight,
  graphData: colors.accentPeach,
};

// Common gradient tokens used across workflow nodes (avoid raw hex in components)
export const gradients = {
  trigger: `linear-gradient(135deg, ${colors.accentBlue} 0%, ${colors.accentPurple} 100%)`,
  ai: `linear-gradient(135deg, ${colors.accentMagenta} 0%, ${colors.accentRose} 100%)`,
  rag: `linear-gradient(135deg, ${colors.accentAqua} 0%, ${colors.accentCyan} 100%)`,
  mcp: `linear-gradient(135deg, ${colors.accentGreen} 0%, ${colors.accentTeal} 100%)`,
  http: `linear-gradient(135deg, ${colors.accentPink} 0%, ${colors.accentYellow} 100%)`,
  logic: `linear-gradient(135deg, ${colors.accentPeachLight} 0%, ${colors.accentPurple} 100%)`,
  data: `linear-gradient(135deg, ${colors.accentPeachLight} 0%, ${colors.accentPeach} 100%)`,
  // generic fallback
  fallback: `linear-gradient(135deg, ${colors.accentBlue} 0%, ${colors.accentPurple} 100%)`,
};

export const radii = { xs:2, sm:4, md:6, lg:10, full:999 };
export const spacing = { xs:4, sm:8, md:12, lg:20, xl:32 };
export const typography = {
  fontFamily: `'Inter', system-ui, sans-serif`,
  sizes: { xs:12, sm:14, md:16, lg:20, xl:24, xxl:32 },
  weights: { regular:400, medium:500, semibold:600, bold:700 },
};

export const lightOverrides = {
  bg: colors.gray100,
  bgAlt: colors.gray200,
  surface: colors.white,
  surfaceAlt: colors.gray100,
  border: colors.gray300,
  borderSubtle: colors.gray200,
  textPrimary: colors.gray900,
  textSecondary: colors.gray700,
  textMuted: colors.gray600,
  textInverted: colors.black,
};

export const buildTheme = (mode: 'dark' | 'light' = 'dark') => ({
  mode,
  colors: { ...semantic, ...(mode === 'light' ? lightOverrides : {}) },
  gradients,
  radii,
  spacing,
  typography,
});

export type Theme = ReturnType<typeof buildTheme>;

export default buildTheme;
