// Bundles the extension host into dist/extension.js and the settings page script into
// dist/webview/settings.js (arch §9, ADR-0031).
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const host = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  // Node of the extension host at the minimum engine (ADR-0017).
  target: 'node20',
  external: ['vscode'],
  outfile: 'dist/extension.js',
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
});

// Runs in the webview: browser platform, no Node or vscode modules.
const webview = await esbuild.context({
  entryPoints: ['src/webview/settings.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/webview/settings.js',
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
});

for (const ctx of [host, webview]) {
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}
