/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Lista os arquivos da pasta public/ (eles não passam pelo empacotador). */
function publicFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? publicFiles(full, base) : [relative(base, full).split('\\').join('/')];
  });
}

/**
 * Gera o service worker (sw.js) com a lista de arquivos da versão atual.
 * Assim o jogo funciona offline e pode ser instalado como app (PWA).
 */
function serviceWorker(): Plugin {
  return {
    name: 'alem-do-horizonte:service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff'));
      const extra = publicFiles('public').filter((f) => f !== 'sw.js');
      const files = ['./', ...built.filter((f) => f !== 'index.html'), ...extra].sort();
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12);
      const template = readFileSync('src/pwa/service-worker.template.js', 'utf8');
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Configuração do Vite.
// - base './' faz os caminhos dos arquivos serem relativos. Assim o jogo funciona
//   em qualquer subpasta de hospedagem estática (GitHub Pages, Netlify...) e
//   também dentro de um APK gerado com Capacitor.
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
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
