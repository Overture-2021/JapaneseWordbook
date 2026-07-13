import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/JapaneseWordbook/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.js'],
  },
});
