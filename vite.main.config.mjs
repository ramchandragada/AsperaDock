import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // Bundle @sentry into main.js — externalizing it left require() broken in
      // the packaged asar (OnlyLoadAppFromAsar + no node_modules/@sentry).
      external: ['electron'],
    },
  },
});
