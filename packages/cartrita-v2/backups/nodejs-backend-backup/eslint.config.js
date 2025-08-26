import js from '@eslint/js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/backend/**', // Ignore OpenTelemetry upstream source
      '**/src/opentelemetry/upstream-source/**',
      '**/semantic-conventions/**',
      '**/.merge_backup_*/**',
      '**/logs/**',
      '**/uploads/**',
      '**/coverage/**',
      '**/tests/**',
      '**/scripts/debug/**',
      '**/scripts/migration/**',
      '**/scripts/tests/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'prefer-const': 'off',
      'no-var': 'off',
      'no-useless-escape': 'off',
      'no-redeclare': 'off',
      'no-unreachable': 'off',
      'no-constant-condition': 'off',
      'no-empty': 'off',
      'no-irregular-whitespace': 'off',
      'no-prototype-builtins': 'off',
      'no-fallthrough': 'off',
      'no-case-declarations': 'off',
      'no-self-assign': 'off',
      'no-global-assign': 'off',
      'no-unsafe-negation': 'off',
      'no-dupe-keys': 'error', // Keep this one enabled to catch real issues
    },
  },
];
