import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de ponta a ponta: abrem o jogo de verdade num navegador e jogam.
 * Rodam contra a versão de produção (`vite preview`).
 *
 * Sem placa de vídeo (como no CI), o Chromium desenha com o SwiftShader
 * (software): funciona, mas é lento — por isso os tempos limite são longos.
 */
const GPU_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 8 * 60_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 960, height: 540 },
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: GPU_ARGS },
  },
  projects: [
    { name: 'computador', testIgnore: /toque|sem-webgl/ },
    {
      name: 'celular',
      testMatch: /toque/,
      use: { ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, launchOptions: { args: GPU_ARGS } },
    },
    { name: 'sem-webgl', testMatch: /sem-webgl/, use: { launchOptions: { args: ['--disable-webgl', '--disable-webgl2'] } } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
