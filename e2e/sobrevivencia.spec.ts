/**
 * Sobrevivência e construção: casa modular, baú, horta, pesca, fome e
 * durabilidade das ferramentas.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

/**
 * Posiciona o jogador, escolhe a peça e confirma com E quando o fantasma
 * estiver no lugar esperado (ou só válido, se `alvo` não for informado).
 */
async function construir(page: Page, tipo: string, x: number, z: number, yaw: number, alvo?: { x: number; z: number }) {
  await noJogo(
    page,
    (g, a) => {
      g.player.teleport(a.x, g.world.terrain.getHeight(a.x, a.z) + 0.3, a.z, a.yaw);
      if (g.building.placingType !== a.tipo) g.startBuild(a.tipo as never);
    },
    { tipo, x, z, yaw },
  );
  const fantasma = () => noJogo(page, (g) => ({ x: g.building['ghostPos'].x, z: g.building['ghostPos'].z, ok: g.building.ghostCheck.ok }));
  if (alvo) await expect.poll(fantasma).toEqual({ ...alvo, ok: true });
  else await expect.poll(async () => (await fantasma()).ok).toBe(true);
  const antes = await noJogo(page, (g, t) => g.building.count(t as never), tipo);
  await page.keyboard.press('KeyE');
  await expect.poll(() => noJogo(page, (g, t) => g.building.count(t as never), tipo)).toBe(antes + 1);
}

test('casa modular, baú, horta, pesca e fome', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);
  await noJogo(page, (g) => {
    g.progression.addXP(300);
    g.inventory.addAll({ madeira: 120, pedra: 40, corda: 10, fibra: 30, semente: 1 });
  });

  // Casa modular: piso, parede apoiada nele e telhado apoiado na parede.
  await construir(page, 'piso', 31, 69.6, Math.PI, { x: 31, z: 67 });
  await construir(page, 'parede', 31, 68.6, Math.PI, { x: 31, z: 66 });
  await construir(page, 'telhado', 31, 69.6, Math.PI, { x: 31, z: 67 });
  const alturas = await noJogo(page, (g) => g.building.structures.map((s) => ({ t: s.type, y: s.y })));
  const piso = alturas.find((a) => a.t === 'piso')!.y;
  expect(alturas.find((a) => a.t === 'parede')!.y).toBeCloseTo(piso + 0.15, 2);
  expect(alturas.find((a) => a.t === 'telhado')!.y).toBeCloseTo(piso + 0.15 + 2.6, 2);
  await noJogo(page, (g) => g.cancelBuild());

  // Baú: guardar madeira.
  await construir(page, 'bau', 24, 76, Math.PI);
  await noJogo(page, (g) => {
    const b = g.building.structures.find((s) => s.type === 'bau')!;
    g.player.teleport(b.x, g.world.terrain.getHeight(b.x, b.z + 1.6), b.z + 1.6, Math.PI);
  });
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Abrir baú de armazenamento');
  await page.keyboard.press('KeyE');
  await page.locator('[data-move="madeira"][data-all="1"]').first().click();
  await expect.poll(() => noJogo(page, (g) => g.inventory.count('madeira'))).toBe(0);
  await page.keyboard.press('Escape');

  // Horta: plantar, esperar (adiantando o tempo) e colher.
  const bau = await noJogo(page, (g) => g.building.structures.find((s) => s.type === 'bau')!.storage!.get('madeira'));
  expect(bau).toBeGreaterThan(0);
  await noJogo(page, (g) => g.inventory.add('madeira', 10));
  await construir(page, 'canteiro', 19, 77, Math.PI);
  await noJogo(page, (g) => {
    const c = g.building.structures.find((s) => s.type === 'canteiro')!;
    g.player.teleport(c.x, g.world.terrain.getHeight(c.x, c.z + 2), c.z + 2, Math.PI);
  });
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Plantar semente');
  await page.keyboard.press('KeyE');
  await expect.poll(() => noJogo(page, (g) => g.inventory.count('semente'))).toBe(0);
  await noJogo(page, (g) => (g.playTime += 250));
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Colher batatas-doces');
  // Sem GPU os quadros são lentos: insiste no E até a colheita acontecer.
  await expect
    .poll(async () => {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(600);
      return noJogo(page, (g) => g.inventory.count('batata_doce'));
    })
    .toBe(3);

  // Pesca: perto de um cardume, lançar e puxar quando o peixe morder.
  await noJogo(page, (g) => {
    g.inventory.add('vara_de_pesca');
    const s = g.wildlife.schools[0];
    let best: { x: number; z: number; d: number } | null = null;
    for (let a = 0; a < 64; a++) {
      for (let d = 6; d <= 10; d++) {
        const x = s.x + Math.sin((a / 64) * Math.PI * 2) * d;
        const z = s.z + Math.cos((a / 64) * Math.PI * 2) * d;
        const h = g.world.terrain.getHeight(x, z);
        if (h > 0.2 && h < 2 && (!best || d < best.d)) best = { x, z, d };
      }
    }
    g.player.teleport(best!.x, g.world.terrain.getHeight(best!.x, best!.z), best!.z, Math.atan2(s.x - best!.x, s.z - best!.z));
  });
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Pescar');
  await page.keyboard.press('KeyE');
  await expect.poll(() => noJogo(page, (g) => g.fishing.state), { timeout: 60_000 }).toBe('bite');
  await page.keyboard.press('KeyE');
  await expect.poll(() => noJogo(page, (g) => g.inventory.count('peixe'))).toBe(1);
  expect(await noJogo(page, (g) => g.inventory.durabilityOf('vara_de_pesca'))).toBe(39);

  // Fome: com saciedade zero aparece o aviso; comer resolve.
  await noJogo(page, (g) => (g.player.hunger = 0.01));
  await expect(page.locator('.bar-hunger .bar-label')).toHaveText('Faminto!');
  await noJogo(page, (g) => g.useItem('batata_doce'));
  await expect.poll(() => noJogo(page, (g) => Math.round(g.player.hunger))).toBe(15);
  expect(erros).toEqual([]);
});
