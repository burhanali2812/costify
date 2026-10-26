import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api calls are forwarded to the backend so the browser sees a single origin.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'https://costify-eight.vercel.app/' } },
});
