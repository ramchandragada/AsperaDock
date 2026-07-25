import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // Keep Sentry external so its native/main entry resolves at runtime.
      external: ['electron', /^@sentry\//],
    },
  },
});
