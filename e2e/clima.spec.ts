/**
 * Clima: a tempestade apaga a fogueira ao relento (a coberta continua acesa),
 * o HUD mostra o clima, dá para reacender quando a chuva passa e tudo é salvo.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

test('chuva apaga fogueiras ao relento e o clima é salvo', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);

  // Duas fogueiras: uma ao relento e outra embaixo de um telhado.
  await noJogo(page, (g) => {
    const h = (x: number, z: number) => g.world.terrain.getHeight(x, z);
    g.building.place('fogueira', 20, 70, 0, false, 'fogo_relento');
    g.building.place('fogueira', 31, 67, 0, false, 'fogo_coberto');
    g.building.place('telhado', 31, 67, 0, false, 'telhado_1', h(31, 67) + 2.75);
    g.inventory.add('madeira', 3);
  });
  expect(await noJogo(page, (g) => g.building.isSheltered(31, 67))).toBe(true);
  expect(await noJogo(page, (g) => g.building.isSheltered(20, 70))).toBe(false);

  await noJogo(page, (g) => g.world.weather.set('tempestade', 600, true));
  await expect(page.locator('.clock .weather-icon')).toHaveAttribute('title', 'Tempestade');
  await page.screenshot({ path: 'test-results/clima-tempestade.png' });

  const acesa = (id: string) => noJogo(page, (g, i) => g.building.structures.find((s) => s.id === i)!.lit, id);
  await expect.poll(() => acesa('fogo_relento'), { timeout: 60_000 }).toBe(false);
  expect(await acesa('fogo_coberto')).toBe(true);

  // Na chuva não dá para reacender.
  await noJogo(page, (g) => g.player.teleport(20, g.world.terrain.getHeight(20, 71.6), 71.6, Math.PI));
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Reacender fogueira');
  expect(await noJogo(page, (g) => g.interaction.currentAction?.enabled)).toBe(false);

  // Salva no meio da tempestade e carrega de novo.
  await noJogo(page, (g) => g.saveGame(false));
  await noJogo(page, (g) => g.world.weather.set('limpo', 600, true));
  await noJogo(page, (g) => g.continueGame());
  await expect.poll(() => noJogo(page, (g) => g.world.weather.kind)).toBe('tempestade');
  await expect.poll(() => acesa('fogo_relento')).toBe(false);
  expect(await acesa('fogo_coberto')).toBe(true);

  // O céu abre: reacende com 1 madeira.
  await noJogo(page, (g) => {
    g.world.weather.set('limpo', 600, true);
    g.player.teleport(20, g.world.terrain.getHeight(20, 71.6), 71.6, Math.PI);
  });
  await expect(page.locator('.clock .weather-icon')).toBeHidden();
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Reacender fogueira (1 madeira)');
  const madeira = await noJogo(page, (g) => g.inventory.count('madeira'));
  await expect
    .poll(async () => {
      if (!(await acesa('fogo_relento'))) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(600);
      }
      return acesa('fogo_relento');
    })
    .toBe(true);
  expect(await noJogo(page, (g) => g.inventory.count('madeira'))).toBe(madeira - 1);
  expect(erros).toEqual([]);
});
