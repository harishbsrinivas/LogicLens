import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Svelte's browser build, so components mount in the jsdom tests.
  resolve: { conditions: ['browser'] },
  test: {
    include: ['test/unit/**/*.test.ts'],
  },
});
