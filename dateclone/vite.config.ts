import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Proxy all /api requests to the Express backend.
    // This eliminates CORS issues completely in development —
    // the browser only ever talks to localhost:5174.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // Rewrite is NOT needed since the backend already mounts routes at /api
      },
    },
  },
});
