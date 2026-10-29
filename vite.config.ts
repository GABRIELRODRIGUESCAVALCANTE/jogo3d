/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Configuração do Vite.
// - base './' faz os caminhos dos arquivos serem relativos. Assim o jogo funciona
//   em qualquer subpasta de hospedagem estática (GitHub Pages, Netlify...) e
//   também dentro de um APK gerado com Capacitor.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
