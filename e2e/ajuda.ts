/**
 * Funções auxiliares dos testes de ponta a ponta.
 * O jogo fica acessível em `window.alemDoHorizonte` (usado só para preparar
 * situações e conferir resultados; as ações principais usam teclado, mouse e toque).
 */
import { expect, type Page } from '@playwright/test';
import type { Game } from '../src/game/Game';

declare global {
  interface Window {
    alemDoHorizonte?: Game;
  }
}

/** Abre o jogo com qualidade baixa (rápido no navegador sem GPU) e espera o menu. */
export async function abrirJogo(page: Page, opcoes: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((o) => {
    if (!localStorage.getItem('alem-do-horizonte:opcoes')) {
      localStorage.setItem('alem-do-horizonte:opcoes', JSON.stringify({ quality: 'baixa', autoQuality: false, ...o }));
    }
  }, opcoes);
  await page.goto('/');
  await expect(page.locator('.main-menu')).toBeVisible({ timeout: 120_000 });
}

/** Começa um novo jogo e fecha a janela de boas-vindas. */
export async function novoJogo(page: Page): Promise<void> {
  await page.locator('[data-menu="novo"]').click();
  await fecharDialogos(page);
  await expect(page.locator('.hud')).toBeVisible();
}

/** Fecha todas as caixas de diálogo abertas (boas-vindas, história...). */
export async function fecharDialogos(page: Page, maximo = 4): Promise<void> {
  for (let i = 0; i < maximo; i++) {
    const botao = page.locator('.dialog-backdrop:not(.leaving) .dialog [data-r="1"]').last();
    if (!(await botao.isVisible().catch(() => false))) {
      await page.waitForTimeout(400);
      if (!(await botao.isVisible().catch(() => false))) return;
    }
    await botao.click();
    await page.waitForTimeout(500);
  }
}

/** Executa uma função dentro da página com acesso ao jogo. */
export function noJogo<T, A = undefined>(page: Page, fn: (g: Game, arg: A) => T, arg?: A): Promise<T> {
  return page.evaluate(
    ([src, a]) => {
      // eslint-disable-next-line no-new-func
      const f = new Function('g', 'arg', `return (${src})(g, arg);`);
      return f(window.alemDoHorizonte, a);
    },
    [fn.toString(), arg] as const,
  ) as Promise<T>;
}

/** Leva o jogador para perto de um ponto, olhando para ele (cai de leve para pousar em pisos). */
export async function irPara(page: Page, x: number, z: number, distancia = 1.6, angulo = 0): Promise<void> {
  await noJogo(
    page,
    (g, a) => {
      const px = a.x + Math.sin(a.angulo) * a.distancia;
      const pz = a.z + Math.cos(a.angulo) * a.distancia;
      const yaw = Math.atan2(a.x - px, a.z - pz);
      g.player.teleport(px, g.world.terrain.getHeight(px, pz) + 1.2, pz, yaw);
      g.cameraCtl.snapBehind(yaw);
    },
    { x, z, distancia, angulo },
  );
  await page.waitForTimeout(900);
}

/** Aperta E e dá tempo para o jogo processar (alguns quadros no navegador sem GPU). */
export async function apertarE(page: Page): Promise<void> {
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1000);
}

/** Golpeia recursos de um tipo diretamente (acelera a coleta nos testes longos). */
export function golpear(page: Page, tipo: string, vezes: number): Promise<number> {
  return noJogo(
    page,
    (g, a) => {
      let n = 0;
      const ctx = { hasItem: (id: string, q = 1) => g.inventory.has(id as never, q), player: g.player };
      for (const node of g.world.resources.nodes) {
        if (node.kind !== a.tipo) continue;
        while (node.remaining > 0 && n < a.vezes) {
          node.interactable.interact(ctx);
          n++;
        }
        if (n >= a.vezes) break;
      }
      return n;
    },
    { tipo, vezes },
  );
}

export function missoesConcluidas(page: Page): Promise<string[]> {
  return noJogo(page, (g) => [...g.quests.completed]);
}

/**
 * Aperta E até um marcador da história ser ativado (ex.: baú aberto).
 * No navegador sem GPU os quadros são lentos, então às vezes é preciso insistir.
 */
export async function interagirAte(page: Page, marcador: string, tentativas = 5): Promise<void> {
  for (let i = 0; i < tentativas; i++) {
    if (await noJogo(page, (g, f) => g.worldState.hasFlag(f), marcador)) return;
    await apertarE(page);
    await fecharDialogos(page);
  }
  expect(await noJogo(page, (g, f) => g.worldState.hasFlag(f), marcador), `marcador "${marcador}"`).toBe(true);
}
