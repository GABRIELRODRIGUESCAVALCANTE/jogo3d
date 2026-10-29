/**
 * Controles de toque (celular deitado): joystick, câmera por arraste e
 * botão de interagir.
 */
import { expect, test } from '@playwright/test';
import { abrirJogo, noJogo } from './ajuda';

test('joystick, câmera e botão de interagir', async ({ page, context }) => {
  await abrirJogo(page);
  expect(await noJogo(page, (g) => g.controlMode)).toBe('touch');
  await page.locator('[data-menu="novo"]').tap();
  await page.locator('.dialog [data-r="1"]').tap();
  await expect(page.locator('.touch-layer')).toBeVisible();

  const cdp = await context.newCDPSession(page);
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pontos: Array<[number, number, number]>) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pontos.map(([x, y, id]) => ({ x, y, id })) });

  const antes = await noJogo(page, (g) => ({ x: g.player.position.x, z: g.player.position.z, yaw: g.cameraCtl.yaw }));
  await toque('touchStart', [[140, 300, 1]]);
  await toque('touchMove', [[140, 240, 1]]);
  await toque('touchStart', [[140, 240, 1], [620, 200, 2]]);
  for (let i = 1; i <= 5; i++) {
    await toque('touchMove', [[140, 240, 1], [620 - i * 20, 200, 2]]);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1500);
  await toque('touchEnd', []);
  const depois = await noJogo(page, (g) => ({ x: g.player.position.x, z: g.player.position.z, yaw: g.cameraCtl.yaw }));
  expect(Math.hypot(depois.x - antes.x, depois.z - antes.z)).toBeGreaterThan(1);
  expect(depois.yaw).not.toBeCloseTo(antes.yaw, 2);

  // Perto de uma palmeira, o botão mostra a ação e coleta ao ser segurado.
  await noJogo(page, (g) => {
    const n = g.world.resources.nodes.find((n) => n.kind === 'palmeira')!;
    g.player.teleport(n.x, g.world.terrain.getHeight(n.x, n.z + 1.6), n.z + 1.6, Math.PI);
  });
  await expect(page.locator('.tbtn-interact .tlabel')).toHaveText('Cortar palmeira');
  const caixa = (await page.locator('.tbtn-interact').boundingBox())!;
  await toque('touchStart', [[caixa.x + caixa.width / 2, caixa.y + caixa.height / 2, 3]]);
  await expect.poll(() => noJogo(page, (g) => g.inventory.count('madeira')), { timeout: 60_000 }).toBeGreaterThan(0);
  await toque('touchEnd', []);

  // Os painéis abrem pelos botões do topo.
  await page.locator('.hud-btn[data-panel="inventario"]').tap();
  await expect(page.locator('.panel-inventario')).toBeVisible();
});
