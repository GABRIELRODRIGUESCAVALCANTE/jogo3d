/**
 * Espaços de salvamento (exportar/importar) e acessibilidade (trocar tecla,
 * tamanho da interface e modo daltonismo).
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

test('trocar tecla, acessibilidade e exportar/importar salvamento', async ({ page }, info) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);

  // Opções → Teclado: interagir passa a ser F.
  await page.keyboard.press('Escape');
  await page.locator('[data-act="opcoes"]').click();
  await page.locator('[data-bind="interagir"]').click();
  await page.keyboard.press('KeyF');
  await expect(page.locator('[data-bind="interagir"] kbd')).toHaveText('F');
  await page.locator('[data-key="uiScale"][data-value="1.15"]').click();
  await page.locator('[data-toggle="colorblind"]').click();
  await expect(page.locator('html')).toHaveClass(/colorblind/);
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--ui-scale'))).toBe('1.15');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Coletar com F.
  await noJogo(page, (g) => {
    const n = g.world.resources.nodes.find((n) => n.kind === 'palmeira')!;
    g.player.teleport(n.x, g.world.terrain.getHeight(n.x, n.z + 1.6), n.z + 1.6, Math.PI);
  });
  await expect(page.locator('.prompt kbd')).toHaveText('F');
  await expect
    .poll(async () => {
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(400);
      return noJogo(page, (g) => g.inventory.count('madeira'));
    })
    .toBeGreaterThan(0);

  // Exportar o espaço 1 e importar no espaço 2.
  await noJogo(page, (g) => g.saveGame(false));
  await page.keyboard.press('Escape');
  await page.locator('[data-act="salvamentos"]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-slot-act="exportar"][data-slot="1"]').click()]);
  const arquivo = info.outputPath('salvamento.json');
  await download.saveAs(arquivo);
  expect(JSON.parse(readFileSync(arquivo, 'utf8')).jogo).toBe('Além do Horizonte');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-slot-act="importar"][data-slot="2"]').click()]);
  await chooser.setFiles(arquivo);
  await expect.poll(() => noJogo(page, async (g) => (await g.saveSystem.summaries())[1]?.level ?? null)).toBe(1);

  // Um arquivo inválido é recusado com aviso.
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-slot-act="importar"][data-slot="3"]').click()]);
  await chooser2.setFiles({ name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"nada": true}') });
  await expect(page.locator('.toast-warning').last()).toContainText('não é um salvamento');
  expect(erros).toEqual([]);
});
