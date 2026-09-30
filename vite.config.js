import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the app with hot reload and forwards /api to the
// CMMS server started with `npm run server` (port 8080).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8080' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom'] }
      }
    }
  }
});
