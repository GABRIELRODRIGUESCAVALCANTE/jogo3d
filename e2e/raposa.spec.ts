/**
 * Raposa de estimação: domesticar com frutas, ela segue o jogador, fareja um
 * tesouro enterrado e o jogador escava. Tudo continua depois de carregar.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

test('domesticar a raposa e escavar um tesouro', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);
  await expect.poll(() => noJogo(page, (g) => g.wildlife.foxCount), { timeout: 60_000 }).toBeGreaterThan(0);

  // Perto de uma raposa, andando devagar com frutas: ela não foge e aceita a fruta.
  await noJogo(page, (g) => g.inventory.add('fruta', 5));
  const daFruta = async () => {
    await noJogo(page, (g) => {
      const f = g.wildlife.foxPosition(0)!;
      const yaw = g.player.yaw;
      g.player.teleport(f.x - Math.sin(yaw) * 1.6, g.world.terrain.getHeight(f.x, f.z) + 0.3, f.z - Math.cos(yaw) * 1.6, yaw);
      g.cameraCtl.snapBehind(yaw);
    });
    await page.waitForTimeout(500);
  };
  await expect
    .poll(
      async () => {
        await daFruta();
        const label = await noJogo(page, (g) => g.interaction.currentAction?.label ?? '');
        if (label.startsWith('Dar fruta')) await page.keyboard.press('KeyE');
        await page.waitForTimeout(500);
        return noJogo(page, (g) => g.worldState.hasFlag('raposa_domesticada'));
      },
      { timeout: 120_000, intervals: [200] },
    )
    .toBe(true);
  expect(await noJogo(page, (g) => g.inventory.count('fruta'))).toBe(2);
  await expect.poll(() => noJogo(page, (g) => g.pet['root'] !== null)).toBe(true);

  // Ela segue o jogador.
  await noJogo(page, (g) => {
    const p = g.player.position;
    g.player.teleport(p.x + 12, g.world.terrain.getHeight(p.x + 12, p.z) + 0.3, p.z, g.player.yaw);
  });
  await expect
    .poll(() => noJogo(page, (g) => g.pet.position.distanceTo(g.player.position)), { timeout: 60_000 })
    .toBeLessThan(4);
  await page.screenshot({ path: 'test-results/raposa.png' });

  // Perto de um tesouro, ela fareja e cava; o jogador escava.
  const t = await noJogo(page, (g) => {
    const t = g.pet.treasures[0];
    g.player.teleport(t.x + 8, g.world.terrain.getHeight(t.x + 8, t.z) + 0.5, t.z, -Math.PI / 2);
    g.pet.position.set(t.x + 9, g.world.terrain.getHeight(t.x + 9, t.z), t.z);
    return { id: t.id, x: t.x, z: t.z };
  });
  await expect.poll(() => noJogo(page, (g) => g.pet.foundTreasures.length), { timeout: 60_000 }).toBe(1);
  expect(await noJogo(page, (g) => g.mapView(true).markers.filter((m) => m.type === 'chest').length)).toBeGreaterThan(0);

  // Salva e carrega: a raposa continua amiga e o montinho continua lá para escavar.
  await noJogo(page, (g) => g.saveGame(false));
  await noJogo(page, (g) => g.continueGame());
  await expect.poll(() => noJogo(page, (g) => g.pet.tamed && g.pet['root'] !== null)).toBe(true);
  await noJogo(
    page,
    (g, a) => {
      g.player.teleport(a.x + 1.6, g.world.terrain.getHeight(a.x + 1.6, a.z) + 0.3, a.z, -Math.PI / 2);
      g.cameraCtl.snapBehind(-Math.PI / 2);
    },
    t,
  );
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label), { timeout: 60_000 }).toBe('Escavar o tesouro');
  await expect
    .poll(async () => {
      if (!(await noJogo(page, (g, id) => g.worldState.hasFlag(`${id}_cavado`), t.id))) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(600);
      }
      return noJogo(page, (g, id) => g.worldState.hasFlag(`${id}_cavado`), t.id);
    })
    .toBe(true);
  expect(await noJogo(page, (g) => g.pet.dugCount)).toBe(1);
  expect(erros).toEqual([]);
});
