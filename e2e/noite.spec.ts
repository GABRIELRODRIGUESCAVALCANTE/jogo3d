/**
 * Noite com risco leve: vagalumes ladrões (a tocha espanta) e noites de
 * névoa que escondem o minimapa.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

test('vagalumes ladrões e noite de névoa', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);

  // Noite, em campo aberto, com frutas na bolsa: o enxame chega e leva 2.
  await noJogo(page, (g) => {
    g.world.dayNight.setTime(23);
    g.inventory.add('fruta', 5);
    const p = g.player.position;
    g.fireflies.spawn(p.x + 6, p.z);
  });
  await expect(page.locator('.toast', { hasText: 'vagalumes ladrões' }).first()).toBeVisible();
  await expect.poll(() => noJogo(page, (g) => g.inventory.count('fruta')), { timeout: 60_000 }).toBe(3);
  expect(await noJogo(page, (g) => g.fireflies.state)).toBe('flee');
  await expect.poll(() => noJogo(page, (g) => g.fireflies.state), { timeout: 60_000 }).toBe('idle');

  // Com a tocha acesa eles fogem sem levar nada.
  await noJogo(page, (g) => {
    g.inventory.add('tocha', 1);
    g.player.torchOn = true;
    const p = g.player.position;
    g.fireflies.spawn(p.x + 14, p.z);
  });
  await page.screenshot({ path: 'test-results/noite-vagalumes.png' });
  await expect.poll(() => noJogo(page, (g) => g.worldState.hasFlag('vagalumes_espantados')), { timeout: 60_000 }).toBe(true);
  expect(await noJogo(page, (g) => g.inventory.count('fruta'))).toBe(3);

  // Noite de névoa: o minimapa fica encoberto e a seta some do mapa.
  await noJogo(page, (g) => g.world.weather.setMist(true, true));
  await expect(page.locator('.minimap-wrap.fogged .minimap-fog')).toBeVisible();
  expect(await noJogo(page, (g) => g.mapView(true).hidePlayer)).toBe(true);
  await page.screenshot({ path: 'test-results/noite-nevoa.png' });
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-mist')).toBeVisible();
  await page.keyboard.press('Escape');

  // A névoa é salva e some ao amanhecer.
  await noJogo(page, (g) => g.saveGame(false));
  await noJogo(page, (g) => g.continueGame());
  await expect.poll(() => noJogo(page, (g) => g.world.weather.mistNight)).toBe(true);
  await noJogo(page, (g) => g.world.dayNight.setTime(5.45));
  await expect.poll(() => noJogo(page, (g) => g.world.weather.mistNight), { timeout: 60_000 }).toBe(false);
  await expect(page.locator('.minimap-wrap.fogged')).toHaveCount(0, { timeout: 60_000 });
  expect(erros).toEqual([]);
});
