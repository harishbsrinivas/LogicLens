import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/integration/**/*.test.js',
  // Lowest supported engine (ADR-0017) so we catch API use above it.
  version: '1.90.0',
  launchArgs: ['--disable-extensions'],
  mocha: { ui: 'tdd', timeout: 20000 },
});
