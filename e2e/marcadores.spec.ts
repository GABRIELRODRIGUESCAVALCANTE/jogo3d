/**
 * Marcadores no mapa: clicar no mapa coloca um alfinete (com a cor escolhida),
 * clicar nele de novo tira. Os marcadores aparecem no minimapa e são salvos.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

test('colocar, tirar e salvar marcadores no mapa', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);

  await page.keyboard.press('KeyM');
  const mapa = page.locator('.map-canvas');
  await expect(mapa).toBeVisible();
  const caixa = (await mapa.boundingBox())!;

  // Escolhe a cor azul e marca dois lugares.
  await page.locator('[data-pin-color="1"]').click();
  await page.mouse.click(caixa.x + caixa.width * 0.5, caixa.y + caixa.height * 0.5);
  await expect.poll(() => noJogo(page, (g) => g.pins.length)).toBe(1);
  await page.mouse.click(caixa.x + caixa.width * 0.3, caixa.y + caixa.height * 0.6);
  await expect.poll(() => noJogo(page, (g) => g.pins.length)).toBe(2);
  expect(await noJogo(page, (g) => g.pins.map((p) => p.c))).toEqual([1, 1]);
  await expect(page.locator('[data-pin-clear]')).toHaveText('Limpar (2)');
  await page.screenshot({ path: 'test-results/marcadores.png' });

  // Clicar de novo no primeiro tira ele.
  await page.mouse.click(caixa.x + caixa.width * 0.5 + 2, caixa.y + caixa.height * 0.5 + 1);
  await expect.poll(() => noJogo(page, (g) => g.pins.length)).toBe(1);
  await page.keyboard.press('Escape');

  // Aparece no minimapa (como marcador) e no mundo (bandeirinha).
  expect(await noJogo(page, (g) => g.mapView().markers.filter((m) => m.type === 'pin').length)).toBe(1);
  expect(await noJogo(page, (g) => g['pinFlags'].children.length)).toBe(1);

  // Salva e carrega.
  const antes = await noJogo(page, (g) => g.pins[0]);
  await noJogo(page, (g) => g.saveGame(false));
  await noJogo(page, (g) => g.continueGame());
  await expect.poll(() => noJogo(page, (g) => g.pins)).toEqual([antes]);
  expect(erros).toEqual([]);
});
