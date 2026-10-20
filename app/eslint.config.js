import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'test-results', 'playwright-report', 'reports'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // The browser tests and their config run in Node (and partly in the page).
  {
    files: [
      'e2e/**/*.ts',
      'playwright.config.ts',
      'plugins/**/*.ts',
      'vite.config.ts',
      'scripts/**/*.mjs',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
