/**
 * Capítulo 2: construir o barco, navegar, a Ilha da Aurora ser criada sob
 * demanda, desembarcar, despertar os pilares e ativar o observatório.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, fecharDialogos, irPara, noJogo, novoJogo } from './ajuda';

test('barco, Ilha da Aurora, pilares e observatório', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);
  await noJogo(page, (g) => {
    g.progression.addXP(1500);
    g.inventory.addAll({ madeira: 60, corda: 20, fibra: 30, cristal: 6 });
    g.worldState.setFlag('farol');
    g.player.teleport(2, g.world.terrain.getHeight(2, 140), 140, 0);
    g.startBuild('barco');
  });
  expect(await noJogo(page, (g) => g.world.auroraCreated)).toBe(false);
  await expect.poll(() => noJogo(page, (g) => g.building.ghostCheck.ok)).toBe(true);
  await page.keyboard.press('KeyE');
  await expect.poll(() => noJogo(page, (g) => g.building.count('barco'))).toBe(1);

  // Embarcar e navegar um pouco com W.
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Embarcar no barco');
  await page.keyboard.press('KeyE');
  await expect.poll(() => noJogo(page, (g) => g.boatCtl.active)).toBe(true);
  const z0 = await noJogo(page, (g) => g.boatCtl.boat!.z);
  await page.keyboard.down('KeyW');
  await expect.poll(() => noJogo(page, (g) => g.boatCtl.boat!.z), { timeout: 60_000 }).toBeGreaterThan(z0 + 3);
  await page.keyboard.up('KeyW');

  // A viagem real leva quase um minuto: o teste leva o barco até perto da Aurora.
  await noJogo(page, (g) => {
    const b = g.boatCtl.boat!;
    b.x = 478;
    b.z = -219;
  });
  await expect.poll(() => noJogo(page, (g) => g.world.auroraCreated)).toBe(true);
  await expect.poll(() => noJogo(page, (g) => g.world.terrain.get('aurora').chunksDone), { timeout: 60_000 }).toBe(true);
  await expect
    .poll(async () => {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(500);
      return noJogo(page, (g) => g.boatCtl.active);
    })
    .toBe(false);
  await expect.poll(() => noJogo(page, (g) => g.currentRegionName)).toBe('Ilha da Aurora');

  // Pedra, três pilares e observatório.
  const interagir = async (x: number, z: number, d: number, ang: number, flag: string) => {
    await irPara(page, x, z, d, ang);
    await expect
      .poll(async () => {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(600);
        await fecharDialogos(page);
        return noJogo(page, (g, f) => g.worldState.hasFlag(f), flag);
      })
      .toBe(true);
  };
  await interagir(497, -233, 1.6, 0.5, 'pedra_aurora');
  await interagir(512, -310, 2.6, 0.8, 'pilar_oeste');
  await interagir(616, -300, 2.6, 0.8, 'pilar_leste');
  await interagir(594, -202, 2.6, 0.8, 'pilar_sul');
  await interagir(566, -268, 2.8, Math.PI * 1.3, 'observatorio');
  expect(await noJogo(page, (g) => g.inventory.count('cristal'))).toBe(0);

  // Salvar e carregar: a Aurora é recriada já no carregamento.
  await noJogo(page, (g) => g.saveGame(false));
  await page.reload();
  await page.locator('[data-menu="continuar"]').click();
  await expect.poll(() => noJogo(page, (g) => g.world.auroraCreated && g.worldState.hasFlag('observatorio'))).toBe(true);
  expect(erros).toEqual([]);
});
