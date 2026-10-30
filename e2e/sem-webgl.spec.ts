/** Sem WebGL, o jogo mostra uma mensagem clara em vez de uma tela preta. */
import { expect, test } from '@playwright/test';

test('aviso quando o navegador não suporta gráficos 3D', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.fatal h2')).toHaveText('Gráficos 3D não suportados');
  await expect(page.locator('.fatal button')).toBeVisible();
});
