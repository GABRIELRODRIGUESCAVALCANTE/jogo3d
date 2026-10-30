/**
 * Testes de ponta a ponta no computador: menu, coleta com o teclado,
 * fabricação, construção, salvamento e a história completa.
 */
import { expect, test, type Page } from '@playwright/test';
import { abrirJogo, apertarE, fecharDialogos, golpear, interagirAte, irPara, missoesConcluidas, noJogo, novoJogo } from './ajuda';

// Nenhum erro de JavaScript pode acontecer durante os testes.
const errosPorPagina = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const erros: string[] = [];
  errosPorPagina.set(page, erros);
  page.on('pageerror', (e) => erros.push(e.message));
});
test.afterEach(({ page }) => {
  expect(errosPorPagina.get(page), 'erros de JavaScript na página').toEqual([]);
});

test('menu inicial, novo jogo e primeira região', async ({ page }) => {
  await abrirJogo(page);
  await expect(page.locator('.game-title').first()).toContainText('Horizonte');
  await expect(page.locator('[data-menu="continuar"]')).toBeHidden();
  await novoJogo(page);
  await expect(page.locator('.quest-tracker')).toContainText('Primeiros Passos');
  await expect.poll(() => noJogo(page, (g) => g.currentRegionName)).toBe('Praia da Chegada');
});

test('coleta com E, fabricação, construção e salvamento', async ({ page }) => {
  await abrirJogo(page);
  await novoJogo(page);

  // Coleta de verdade: segurar E perto de uma palmeira.
  const palmeira = await noJogo(page, (g) => {
    const n = g.world.resources.nodes.find((n) => n.kind === 'palmeira')!;
    return { x: n.x, z: n.z };
  });
  await irPara(page, palmeira.x, palmeira.z, 1.6, 0);
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Cortar palmeira');
  await page.keyboard.down('KeyE');
  await expect.poll(() => noJogo(page, (g) => g.inventory.count('madeira')), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.keyboard.up('KeyE');
  await expect(page.locator('.res-chip').first()).not.toHaveText('0');

  // Fabricação pelo menu.
  await noJogo(page, (g) => g.inventory.addAll({ fibra: 3, madeira: 20, pedra: 10 }));
  await page.keyboard.press('KeyC');
  await page.locator('[data-craft="corda"]').click();
  await page.locator('[data-craft="machado"]').click();
  await expect.poll(() => noJogo(page, (g) => g.inventory.count('machado'))).toBe(1);
  await page.keyboard.press('KeyC');

  // Construção da bancada na clareira.
  await noJogo(page, (g) => {
    g.player.teleport(22, g.world.terrain.getHeight(22, 60), 60, Math.PI / 2);
    g.cameraCtl.snapBehind(Math.PI / 2);
  });
  await page.keyboard.press('KeyB');
  await page.locator('[data-build="bancada"]').click();
  await expect.poll(() => noJogo(page, (g) => g.building.ghostCheck.ok)).toBe(true);
  await apertarE(page);
  await expect.poll(() => noJogo(page, (g) => g.building.count('bancada'))).toBe(1);

  // Salvar pelo menu de pausa, recarregar e continuar.
  await page.keyboard.press('Escape');
  await page.locator('[data-act="salvar"]').click();
  await page.reload();
  await expect(page.locator('[data-menu="continuar"]')).toBeVisible({ timeout: 120_000 });
  await page.locator('[data-menu="continuar"]').click();
  await expect.poll(() => noJogo(page, (g) => g.building.count('bancada'))).toBe(1);
  expect(await noJogo(page, (g) => g.inventory.count('machado'))).toBe(1);
});

test('apagar salvamento pede confirmação', async ({ page }) => {
  await abrirJogo(page);
  await novoJogo(page);
  await page.keyboard.press('Escape');
  await page.locator('[data-act="apagar"]').click();
  await expect(page.locator('.dialog-danger')).toBeVisible();
  await page.locator('.dialog-danger [data-r="1"]').click();
  await expect(page.locator('.main-menu')).toBeVisible();
  await expect(page.locator('[data-menu="continuar"]')).toBeHidden();
});

test('história completa: missões principais até o farol', async ({ page }) => {
  test.slow();
  await abrirJogo(page);
  await novoJogo(page);

  await golpear(page, 'palmeira', 5);
  await irPara(page, -21, 123, 1.7, Math.PI * 0.3);
  await interagirAte(page, 'bau_praia');
  await golpear(page, 'rocha', 4);
  await golpear(page, 'capim', 6);
  await golpear(page, 'arbusto', 3);
  await noJogo(page, (g) => {
    g.player.energy = 30;
    g.useItem('fruta');
    g.inventory.addAll({ fibra: 3 });
    g.craft('corda');
    g.craft('machado');
  });
  expect(await missoesConcluidas(page)).toEqual(
    expect.arrayContaining(['q_madeira', 'q_bau', 'q_recursos', 'q_frutas', 'q_ferramentas']),
  );

  // Construções na clareira (pelo modo de construção, confirmando com E).
  await noJogo(page, (g) => g.inventory.addAll({ madeira: 60, pedra: 30, corda: 6 }));
  for (const [tipo, x, z, yaw] of [
    ['bancada', 22, 60, Math.PI / 2],
    ['fogueira', 30, 72, Math.PI],
    ['cabana', 36, 58, Math.PI],
  ] as const) {
    await noJogo(page, (g, a) => {
      g.player.teleport(a.x, g.world.terrain.getHeight(a.x, a.z), a.z, a.yaw);
      g.startBuild(a.tipo);
    }, { tipo, x, z, yaw });
    await expect.poll(() => noJogo(page, (g) => g.building.ghostCheck.ok)).toBe(true);
    await apertarE(page);
  }
  await expect.poll(() => missoesConcluidas(page)).toEqual(expect.arrayContaining(['q_bancada', 'q_fogueira', 'q_cabana']));

  // Ruínas, picareta, caverna, baús e portal.
  await irPara(page, 96, -1.9, 1.6, 0);
  await interagirAte(page, 'monolito');
  await noJogo(page, (g) => {
    if (g.progression.level < 3) g.progression.addXP(200);
    const b = g.building.structures.find((s) => s.type === 'bancada')!;
    g.player.teleport(b.x, b.y, b.z + 2.2, Math.PI);
  });
  await page.waitForTimeout(800);
  await noJogo(page, (g) => g.craft('picareta'));
  await irPara(page, 40, -42.7, 2, 0);
  await interagirAte(page, 'entulho');
  await noJogo(page, (g) => g.player.teleport(40, g.world.terrain.getHeight(40, -47) + 1, -47, Math.PI));
  await page.waitForTimeout(1500);
  await golpear(page, 'cristal', 6);
  await irPara(page, 40, -53.3, 1.6, 0);
  await interagirAte(page, 'bau_caverna');
  await irPara(page, -59, 26.5, 1.7, 0.3);
  await interagirAte(page, 'bau_floresta');
  await irPara(page, 96, 9.5, 1.9, Math.PI);
  await interagirAte(page, 'portal');
  await expect.poll(() => missoesConcluidas(page)).toContain('q_portal');

  // Final: acender o farol no pico.
  await irPara(page, -12, -104, 2.4, Math.PI * 0.8);
  await interagirAte(page, 'farol');
  await fecharDialogos(page);
  await expect.poll(() => noJogo(page, (g) => g.quests.isCompleted('q_horizonte'))).toBe(true);
});
