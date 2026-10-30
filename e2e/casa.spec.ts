/**
 * Casa de dois andares: piso, paredes, porta que abre, escada, piso do
 * segundo andar e móveis lá em cima. Tudo continua igual depois de carregar.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

/** Valida e constrói uma peça como o jogador faria (mesmas regras do fantasma). */
function construir(page: Page, tipo: string, x: number, z: number, rot = 0) {
  return noJogo(
    page,
    (g, a) => {
      const check = g.building.validate(a.tipo as never, a.x, a.z, a.rot);
      if (!check.ok) return { ok: false, reason: check.reason };
      const s = g.building.place(a.tipo as never, a.x, a.z, a.rot, false, undefined, check.y, check.upper ? { upper: 1 } : undefined);
      return { ok: true, y: s.y, upper: !!s.upper };
    },
    { tipo, x, z, rot },
  );
}

test('casa de dois andares com porta, escada e móveis', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);
  await noJogo(page, (g) => {
    g.progression.addXP(400);
    g.inventory.addAll({ madeira: 200, corda: 10, pedra: 20, fibra: 20 });
    // Fica longe da obra para não atrapalhar as paredes.
    g.player.teleport(32, g.world.terrain.getHeight(32, 74), 74, Math.PI);
  });

  // Térreo: três pisos em fila e paredes em volta (com uma porta na frente).
  for (const x of [31, 33, 35]) expect((await construir(page, 'piso', x, 67)).ok).toBe(true);
  const paredes: Array<[string, number, number, number]> = [
    ['parede', 31, 66, 0],
    ['parede', 33, 66, 0],
    ['parede', 35, 66, 0],
    ['parede_porta', 31, 68, 0],
    ['parede_janela', 33, 68, 0],
    ['parede', 35, 68, 0],
    ['parede', 30, 67, Math.PI / 2],
    ['parede', 36, 67, Math.PI / 2],
  ];
  for (const [tipo, x, z, rot] of paredes) expect((await construir(page, tipo, x, z, rot)).ok, `${tipo} ${x},${z}`).toBe(true);

  // Escada no meio subindo para +X e piso do segundo andar no fim dela.
  const escada = await construir(page, 'escada', 33, 67, Math.PI / 2);
  expect(escada.ok).toBe(true);
  const cima = await construir(page, 'piso', 35, 67);
  expect(cima).toMatchObject({ ok: true, upper: true });
  const terreo = await noJogo(page, (g) => g.building.structures.find((s) => s.type === 'piso' && !s.upper)!.y);
  expect(cima.y!).toBeCloseTo(terreo + 0.15 + 2.6, 2);
  // Em cima da escada não dá para pôr piso.
  expect((await construir(page, 'piso', 33, 67)).ok).toBe(false);

  // A porta abre e fecha.
  await noJogo(page, (g) => {
    g.player.teleport(31, g.world.terrain.getHeight(31, 69.5) + 0.3, 69.5, Math.PI);
    g.cameraCtl.snapBehind(Math.PI);
  });
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Abrir porta');
  await expect
    .poll(async () => {
      if (!(await noJogo(page, (g) => g.building.structures.find((s) => s.type === 'parede_porta')!.doorOpen))) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(600);
      }
      return noJogo(page, (g) => g.building.structures.find((s) => s.type === 'parede_porta')!.doorOpen);
    })
    .toBe(true);
  expect(await noJogo(page, (g) => g.building.structures.find((s) => s.type === 'parede_porta')!.doorCollider)).toBeNull();

  // Embaixo do segundo andar, o andar de cima some para a câmera enxergar.
  await noJogo(page, (g, y) => g.player.teleport(35, y + 0.2, 67, Math.PI), terreo + 0.15);
  await expect
    .poll(() => noJogo(page, (g) => g.building.structures.find((s) => s.upper)!.model.root.visible))
    .toBe(false);

  // Sobe a escada andando.
  await noJogo(page, (g, y) => {
    g.player.teleport(31.2, y + 0.1, 67, Math.PI / 2);
    g.cameraCtl.snapBehind(Math.PI / 2);
  }, terreo + 0.15);
  await page.keyboard.down('KeyW');
  await expect
    .poll(() => noJogo(page, (g) => g.player.position.y), { timeout: 60_000 })
    .toBeGreaterThan(cima.y! + 0.1);
  // Continua andando até sair da escada e pisar no segundo andar.
  await expect.poll(() => noJogo(page, (g) => g.player.position.x), { timeout: 60_000 }).toBeGreaterThan(34.4);
  await page.keyboard.up('KeyW');
  expect(await noJogo(page, (g) => g.building.structures.find((s) => s.upper)!.model.root.visible)).toBe(true);

  // Móveis no segundo andar.
  await noJogo(page, (g) => g.player.teleport(33.9, g.player.position.y, 67, Math.PI / 2));
  const mesa = await construir(page, 'mesa', 35.2, 67.3, 0);
  expect(mesa.ok, JSON.stringify(mesa)).toBe(true);
  expect(mesa.y!).toBeCloseTo(cima.y! + 0.15, 2);
  expect((await construir(page, 'vaso', 35.6, 66.5)).ok).toBe(true);

  // Telhado na altura do piso de cima: não pode (já tem piso ali).
  expect((await construir(page, 'telhado', 35, 67)).ok).toBe(false);

  await noJogo(page, (g) => g.player.teleport(40, g.world.terrain.getHeight(40, 74) + 0.3, 74, -2.4));
  await noJogo(page, (g) => g.cameraCtl.snapBehind(-2.4));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/casa.png' });

  // Salva e carrega.
  await noJogo(page, (g) => g.saveGame(false));
  await noJogo(page, (g) => g.continueGame());
  const depois = await noJogo(page, (g) => ({
    upper: g.building.structures.filter((s) => s.upper).length,
    porta: g.building.structures.find((s) => s.type === 'parede_porta')!.doorOpen,
    mesa: g.building.structures.find((s) => s.type === 'mesa')!.y,
    escada: g.building.count('escada'),
  }));
  expect(depois.upper).toBe(1);
  expect(depois.porta).toBe(true);
  expect(depois.mesa).toBeCloseTo(mesa.y!, 2);
  expect(depois.escada).toBe(1);
  expect(erros).toEqual([]);
});
