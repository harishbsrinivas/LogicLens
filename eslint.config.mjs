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
    files: ['src/**/*.ts'],
    ignores: ['src/providers/**', 'src/extension.ts'],
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
