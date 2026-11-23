import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = dirname(fileURLToPath(import.meta.url));
const defaultProductionBase = basename(configDirectory) === 'frontend'
  ? `/${basename(dirname(configDirectory))}/`
  : '/';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? (process.env.VITE_BASE_PATH || defaultProductionBase) : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    testTimeout: 10000,
    maxWorkers: 1,
    minWorkers: 1
  }
}));