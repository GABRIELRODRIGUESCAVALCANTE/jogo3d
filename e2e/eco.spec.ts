/**
 * Capítulo 3: a Ilha do Eco é criada ao se aproximar, a capitã Iara conversa,
 * os três sinos tocam, a Guardiã aparece e a Canção dos Lumeni (com um erro
 * no meio) encerra o capítulo e dissipa a névoa.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

const ativo = (page: Page) => page.locator('.dialog-backdrop:not(.leaving) .dialog-choice');

async function escolher(page: Page, texto: string) {
  await ativo(page).locator('.choice-btn', { hasText: texto }).click();
}

/** Fica de frente para um ponto e aperta E até a ação esperada acontecer. */
async function usar(page: Page, x: number, z: number, rotulo: string, pronto: () => Promise<boolean>) {
  await noJogo(
    page,
    (g, a) => {
      const px = a.x;
      const pz = a.z - 2;
      g.player.teleport(px, g.world.terrain.getHeight(px, pz) + 0.3, pz, 0);
      g.cameraCtl.snapBehind(0);
    },
    { x, z },
  );
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe(rotulo);
  await expect
    .poll(async () => {
      if (!(await pronto())) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(700);
      }
      return pronto();
    })
    .toBe(true);
}

test('Ilha do Eco: Iara, sinos e a Canção dos Lumeni', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);
  await noJogo(page, (g) => {
    g.progression.addXP(2000);
    g.quests.load({ active: [], completed: ['q_observatorio'], progress: {}, tracked: null });
    g.quests.evaluateAll();
    g.worldState.setFlag('pipoca_conheceu');
  });
  expect(await noJogo(page, (g) => g.world.ecoCreated)).toBe(false);

  // Chegando perto, a ilha é criada (com névoa).
  const praia = await noJogo(page, (g) => {
    const b = { x: -140, z: 440 };
    g.player.teleport(b.x, g.world.terrain.getHeight(b.x, b.z) + 0.5, b.z, 0);
    return b;
  });
  await expect.poll(() => noJogo(page, (g) => g.world.ecoCreated)).toBe(true);
  await expect.poll(() => noJogo(page, (g) => g.world.terrain.get('eco').chunksDone), { timeout: 60_000 }).toBe(true);
  await noJogo(page, (g, b) => g.player.teleport(b.x, g.world.terrain.getHeight(b.x, b.z) + 0.5, b.z, 0), praia);
  await expect.poll(() => noJogo(page, (g) => g.quests.isCompleted('q_eco')), { timeout: 60_000 }).toBe(true);
  expect(await noJogo(page, (g) => g.world.weather.zoneMist)).toBeGreaterThan(0.5);
  await page.screenshot({ path: 'test-results/eco-praia.png' });

  // Conversa com a Iara.
  const iara = await noJogo(page, (g) => {
    const c = g.world.ecoLandmarks!['iara'].position;
    return { x: c.x, z: c.z };
  });
  await usar(page, iara.x, iara.z, 'Conversar com Iara', async () => (await ativo(page).count()) > 0);
  await expect(ativo(page)).toContainText('Iara');
  await page.screenshot({ path: 'test-results/eco-iara.png' });
  await escolher(page, 'Pipoca mandou dizer');
  await escolher(page, 'O que é');
  await escolher(page, 'E depois?');
  await expect(ativo(page)).toContainText('do mais grave ao mais agudo');
  await escolher(page, 'Entendi');
  await expect.poll(() => noJogo(page, (g) => g.quests.isCompleted('q_iara'))).toBe(true);

  // O altar fica em silêncio até os sinos tocarem.
  const templo = await noJogo(page, (g) => {
    const t = g.world.ecoLandmarks!['guardian'].position;
    return { x: t.x, z: t.z };
  });
  await noJogo(page, (g, t) => {
    g.player.teleport(t.x, g.world.terrain.getHeight(t.x, t.z + 2.2) + 0.3, t.z + 2.2, Math.PI);
    g.cameraCtl.snapBehind(Math.PI);
  }, templo);
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Altar do Eco');
  expect(await noJogo(page, (g) => g.interaction.currentAction?.enabled)).toBe(false);

  // Os três sinos.
  const sinos: Array<[string, string, { x: number; z: number }]> = [
    ['oeste', 'Sino do Oeste', { x: -206, z: 528 }],
    ['sul', 'Sino do Sul', { x: -142, z: 580 }],
    ['leste', 'Sino do Leste', { x: -96, z: 506 }],
  ];
  for (const [id, nome, pos] of sinos) {
    await usar(page, pos.x, pos.z, `Tocar o ${nome}`, () => noJogo(page, (g, i) => g.worldState.hasFlag(`sino_${i}`), id));
  }
  await expect.poll(() => noJogo(page, (g) => g.quests.isCompleted('q_sinos'))).toBe(true);

  // A Guardiã aparece; primeiro uma canção errada, depois a certa.
  await noJogo(page, (g, t) => {
    g.player.teleport(t.x, g.world.terrain.getHeight(t.x, t.z + 2.2) + 0.3, t.z + 2.2, Math.PI);
    g.cameraCtl.snapBehind(Math.PI);
  }, templo);
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Falar com a Guardiã do Eco');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/eco-guardia.png' });
  await expect
    .poll(async () => {
      if ((await ativo(page).count()) === 0) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(700);
      }
      return ativo(page).count();
    })
    .toBeGreaterThan(0);
  await escolher(page, 'Vou cantar.');
  for (const nota of ['Leste', 'Sul', 'Oeste']) await escolher(page, `Sino do ${nota}`);
  await expect(ativo(page)).toContainText('não é a nossa canção');
  await escolher(page, 'Tentar de novo');
  for (const nota of ['Oeste', 'Sul', 'Leste']) await escolher(page, `Sino do ${nota}`);
  await expect(ativo(page)).toContainText('constelação dos Lumeni está completa');
  expect(await noJogo(page, (g) => g.worldState.hasFlag('eco_cancao'))).toBe(false);
  await escolher(page, 'Foi uma honra.');

  // Final do capítulo 3 e a névoa some.
  await expect(page.locator('.dialog-backdrop:not(.leaving) .ending')).toContainText('Fim do Capítulo 3');
  await page.locator('.dialog-backdrop:not(.leaving) [data-r="1"]').click();
  expect(await noJogo(page, (g) => g.quests.isCompleted('q_cancao'))).toBe(true);
  await expect.poll(() => noJogo(page, (g) => g.world.weather.zoneMist)).toBe(0);

  // Salvar e carregar perto do Eco recria a ilha com tudo no lugar.
  await noJogo(page, (g) => g.saveGame(false));
  await noJogo(page, (g) => g.continueGame());
  expect(await noJogo(page, (g) => g.world.ecoCreated && g.worldState.hasFlag('eco_cancao'))).toBe(true);
  expect(erros).toEqual([]);
});
