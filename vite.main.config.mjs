import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // Bundle @sentry into main.js — externalizing it left require() broken in
      // the packaged asar (OnlyLoadAppFromAsar + no node_modules/@sentry).
      // Keep pdfjs out of the bundle so workerSrc can resolve from node_modules/asar.
      external: ['electron', 'pdfjs-dist', /^pdfjs-dist\//],
    },
  },
});
