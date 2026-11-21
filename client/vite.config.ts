import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      // Socket.IO handshake and WebSocket upgrade share the same cookie session.
      '/socket.io': {
        target: API_TARGET,
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
