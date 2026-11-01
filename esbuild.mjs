// Bundles the extension host into dist/extension.js (arch §9).
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
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

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
