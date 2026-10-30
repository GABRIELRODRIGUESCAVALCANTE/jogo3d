/**
 * História: conversar com o papagaio Pipoca (com escolhas), ler páginas do
 * diário de Iara e relê-las no menu de missões. A fruta dada ao papagaio
 * revela um tesouro no mapa, que dá para escavar mesmo sem a raposa.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, noJogo, novoJogo } from './ajuda';

test('papagaio falante e diário de Iara', async ({ page }) => {
  test.slow();
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await abrirJogo(page);
  await novoJogo(page);
  await noJogo(page, (g) => g.inventory.add('fruta', 2));

  // Conversa com o papagaio.
  await noJogo(page, (g) => {
    g.player.teleport(21, g.world.terrain.getHeight(21, 130.8), 130.8, Math.PI);
    g.cameraCtl.snapBehind(Math.PI);
  });
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Conversar com o papagaio');
  await page.keyboard.press('KeyE');
  const conversa = page.locator('.dialog-backdrop:not(.leaving) .dialog-choice');
  await expect(conversa).toContainText('Pipoca');
  await conversa.locator('.choice-btn', { hasText: 'Prazer' }).click();
  await expect(conversa.locator('.choice-btn', { hasText: 'Quer uma fruta?' })).toBeVisible();
  await page.screenshot({ path: 'test-results/papagaio.png' });
  await conversa.locator('.choice-btn', { hasText: 'Quer uma fruta?' }).click();
  await expect(conversa).toContainText('marcou no seu mapa');
  expect(await noJogo(page, (g) => [g.inventory.count('fruta'), g.pins.length])).toEqual([1, 1]);
  await conversa.locator('.choice-btn', { hasText: 'Valeu' }).click();
  await conversa.locator('.choice-btn', { hasText: 'Tchau' }).click();
  await expect(page.locator('.dialog-choice')).toHaveCount(0);
  expect(await noJogo(page, (g) => g.worldState.hasFlag('pipoca_conheceu'))).toBe(true);

  // O tesouro revelado pode ser escavado mesmo sem a raposa.
  const t = await noJogo(page, (g) => {
    const t = g.pet.foundTreasures[0];
    g.player.teleport(t.x + 1.6, g.world.terrain.getHeight(t.x + 1.6, t.z) + 0.3, t.z, -Math.PI / 2);
    g.cameraCtl.snapBehind(-Math.PI / 2);
    return t.id;
  });
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Escavar o tesouro');
  await expect
    .poll(async () => {
      if (!(await noJogo(page, (g, id) => g.worldState.hasFlag(`${id}_cavado`), t))) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(600);
      }
      return noJogo(page, (g, id) => g.worldState.hasFlag(`${id}_cavado`), t);
    })
    .toBe(true);

  // Página 1 do diário, perto dos destroços.
  await noJogo(page, (g) => {
    g.player.teleport(9.6, g.world.terrain.getHeight(9.6, 126), 126, -Math.PI / 2);
    g.cameraCtl.snapBehind(-Math.PI / 2);
  });
  await expect.poll(() => noJogo(page, (g) => g.interaction.currentAction?.label)).toBe('Ler página do diário');
  await page.keyboard.press('KeyE');
  await expect(page.locator('.dialog-lore')).toContainText('Estrela do Sul');
  await page.locator('.dialog-backdrop:not(.leaving) .dialog-lore [data-r="1"]').click();
  expect(await noJogo(page, (g) => g.worldState.hasFlag('diario_1'))).toBe(true);

  // Lê mais 4 páginas (atalho) e a missão de 5 páginas fica pronta.
  await noJogo(page, (g) => {
    for (const id of ['diario_2', 'diario_3', 'diario_4', 'diario_5']) g.worldState.setFlag(id);
    g.worldState.setFlag('diario_5');
  });

  // Relê no menu de missões.
  await page.keyboard.press('KeyJ');
  await page.locator('details.diary summary').click();
  await page.locator('[data-diary="diario_1"]').click();
  await expect(page.locator('.dialog-lore')).toContainText('Estrela do Sul');
  await page.locator('.dialog-backdrop:not(.leaving) .dialog-lore [data-r="1"]').click();
  await page.keyboard.press('Escape');

  // Salvar e carregar mantém as páginas lidas (sem brilho) e a conversa.
  await noJogo(page, (g) => g.saveGame(false));
  await noJogo(page, (g) => g.continueGame());
  expect(await noJogo(page, (g) => g.worldState.hasFlag('diario_1') && g.worldState.hasFlag('pipoca_conheceu'))).toBe(true);
  expect(erros).toEqual([]);
});
