import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The production build is emitted to ../public, which becomes the Cyon web root.
// During dev, /api is proxied to the local PHP built-in server.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: 'es',
  },
});
