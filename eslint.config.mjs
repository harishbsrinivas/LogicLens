import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'out/', '.vscode-test/', 'node_modules/', 'test/eval/corpus/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // The settings page script runs in the webview (ADR-0031).
    files: ['src/webview/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.ts'],
    // ui/statusBar.ts, ui/providerPicker.ts, ui/settingsPanel.ts, and commands/provider.ts list
    // and select providers
    // through the registry (arch §3); they never send.
    ignores: [
      'src/providers/**',
      'src/extension.ts',
      'src/ui/statusBar.ts',
      'src/ui/providerPicker.ts',
      'src/ui/settingsPanel.ts',
      'src/commands/provider.ts',
    ],
    rules: {
      // Providers are reached only through RequestGate (ADR-0014, arch §3). extension.ts builds
      // the adapters and hands them to the gate; everything else may use the shared types only.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/providers/*', '!**/providers/types'],
              message: 'Call providers only through guard/RequestGate.',
            },
          ],
        },
      ],
    },
  },
);
