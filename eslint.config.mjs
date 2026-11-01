import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'out/', '.vscode-test/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['shared/**/*.ts'],
    rules: {
      // shared/ is types and constants only, so the webview never pulls in Node code (arch §3).
      'no-restricted-imports': [
        'error',
        { patterns: ['vscode', 'node:*', '../src/*', '../webview/*'] },
      ],
    },
  },
  {
    files: ['webview/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': ['error', { patterns: ['vscode', 'node:*', '../../src/*'] }],
    },
  },
);
