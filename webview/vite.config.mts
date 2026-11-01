import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Builds the panel UI into dist/webview (arch §9). Fixed file names so the host can
// reference them from the webview HTML with a CSP nonce.
export default defineConfig({
  root,
  base: './',
  plugins: [svelte()],
  build: {
    outDir: fileURLToPath(new URL('../dist/webview', import.meta.url)),
    emptyOutDir: true,
    // One CSS file loaded by <link>; no inline styles under the CSP.
    cssCodeSplit: false,
    rollupOptions: {
      input: fileURLToPath(new URL('src/main.ts', import.meta.url)),
      output: {
        entryFileNames: 'main.js',
        assetFileNames: (asset) =>
          asset.names.some((n) => n.endsWith('.css')) ? 'main.css' : '[name][extname]',
      },
    },
  },
});
