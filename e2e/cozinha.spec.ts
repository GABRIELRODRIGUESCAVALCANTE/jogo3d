/**
 * Horta com milho e abacaxi (escolha do que plantar), novas receitas e o
 * Peixe Dourado, que só aparece à noite.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

test('milho, abacaxi, receitas novas e peixe dourado', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);
  await noJogo(page, (g) => {
    g.progression.addXP(400);
    g.inventory.addAll({ semente: 1, semente_milho: 1, muda_abacaxi: 2 });
    g.building.place('canteiro', 19, 77, Math.PI, false, 'horta_1');
    g.building.place('fogueira', 24, 77, 0, false, 'fogo_1');
    g.player.teleport(19, g.world.terrain.getHeight(19, 79), 79, Math.PI);
    g.cameraCtl.snapBehind(Math.PI);
  });

  // Com várias sementes, o jogo pergunta o que plantar.
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Plantar…');
  await page.keyboard.press('KeyE');
  await expect(page.locator('.dialog-choice .choice-btn')).toHaveCount(3);
  await page.locator('.dialog-choice [data-r="c:milho"]').click();
  await expect.poll(() => noJogo(page, (g) => g.building.structures.find((s) => s.id === 'horta_1')!.crop)).toBe('milho');
  expect(await noJogo(page, (g) => g.inventory.count('semente_milho'))).toBe(0);

  // Milho leva 5 minutos de jogo: adianta o tempo e colhe.
  await noJogo(page, (g) => (g.playTime += 310));
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Colher milho');
  await expect
    .poll(async () => {
      if ((await noJogo(page, (g) => g.inventory.count('milho'))) === 0) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(600);
      }
      return noJogo(page, (g) => g.inventory.count('milho'));
    })
    .toBe(4);

  // Dois canteiros prontos (abacaxi e batata) só para ver as plantas.
  await noJogo(page, (g) => {
    g.playTime += 1000;
    for (const [id, x, crop] of [
      ['horta_2', 15, 'abacaxi'],
      ['horta_3', 23, 'batata'],
    ] as const) {
      const s = g.building.place('canteiro', x, 72, Math.PI, false, id, undefined, { plantedAt: g.playTime - 900, crop });
      g.building['updateGardenVisual'](s, g.playTime);
    }
    g.player.teleport(19, g.world.terrain.getHeight(19, 81), 81, Math.PI);
    g.cameraCtl.snapBehind(Math.PI);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/horta.png' });

  // Receitas novas.
  await noJogo(page, (g) => {
    g.player.teleport(24, g.world.terrain.getHeight(24, 79), 79, Math.PI);
    g.inventory.addAll({ abacaxi: 1, fruta: 2, peixe: 1, batata_doce: 1 });
  });
  await page.waitForTimeout(600);
  await noJogo(page, (g) => {
    g.craft('milho_assado');
    g.craft('salada_tropical');
    g.craft('ensopado');
  });
  expect(
    await noJogo(page, (g) => [g.inventory.count('milho_assado'), g.inventory.count('salada_tropical'), g.inventory.count('ensopado')]),
  ).toEqual([1, 1, 1]);

  // Peixe Dourado: só à noite.
  const chance = await noJogo(page, (g) => {
    const dia = g.fishing['hooks'].rareChance();
    g.world.dayNight.setTime(23);
    return [dia, g.fishing['hooks'].rareChance()];
  });
  expect(chance[0]).toBe(0);
  expect(chance[1]).toBeGreaterThan(0.2);
  await noJogo(page, (g) => {
    const random = Math.random;
    Math.random = () => 0.01;
    g.fishing.state = 'bite';
    g.fishing.press();
    Math.random = random;
  });
  expect(await noJogo(page, (g) => g.inventory.count('peixe_dourado'))).toBe(1);
  await noJogo(page, (g) => g.craft('dourado_grelhado'));
  expect(await noJogo(page, (g) => g.inventory.count('dourado_grelhado'))).toBe(1);
  expect(erros).toEqual([]);
});
