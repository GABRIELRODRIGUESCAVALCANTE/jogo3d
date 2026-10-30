/**
 * Sistema de interação: encontra o objeto mais próximo à frente do jogador
 * (árvore, baú, cama...) e executa a ação quando o jogador aperta E ou o
 * botão de interagir. Segurar o botão repete a ação (coleta contínua).
 */
import * as THREE from 'three';
import type { ItemId } from './data/items';
import type { Player } from './Player';

export interface InteractionContext {
  hasItem(id: ItemId, amount?: number): boolean;
  readonly player: Player;
}

export interface InteractAction {
  label: string;
  enabled: boolean;
  /** Motivo exibido quando a ação está bloqueada. */
  reason?: string;
  /** Pode ser repetida segurando o botão. */
  repeat?: boolean;
}

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  /** Distância extra (objetos grandes podem ser alcançados de mais longe). */
  radius: number;
  /** Penalidade na escolha (maior = perde para outros objetos próximos). */
  priority?: number;
  getAction(ctx: InteractionContext): InteractAction | null;
  interact(ctx: InteractionContext): void;
}

/** Qualquer sistema que oferece objetos interativos (recursos, construções...). */
export interface InteractableProvider {
  queryInteractables(x: number, z: number, range: number, out: Interactable[]): void;
}

const BASE_RANGE = 2.1;
/** Intervalo entre ações ao SEGURAR o botão (coleta contínua). */
const REPEAT_DELAY = 0.5;
/** Intervalo mínimo entre APERTOS separados (evita cliques acelerados demais). */
const PRESS_DELAY = 0.22;

export class InteractionSystem {
  current: Interactable | null = null;
  currentAction: InteractAction | null = null;
  /** Chamado quando uma ação bloqueada é tentada (para mostrar o motivo). */
  onBlocked: ((reason: string) => void) | null = null;

  private providers: InteractableProvider[] = [];
  private staticItems: Interactable[] = [];
  /** Segundos desde a última ação executada. */
  private sinceAction = 10;
  private blockedCooldown = 0;
  private candidates: Interactable[] = [];
  /** Filtro opcional (ex.: modo de remover construções). */
  filter: ((item: Interactable) => boolean) | null = null;

  addProvider(provider: InteractableProvider): void {
    this.providers.push(provider);
  }

  /** Registra um objeto interativo fixo (baús, monólito...). */
  register(item: Interactable): void {
    this.staticItems.push(item);
  }

  unregister(id: string): void {
    this.staticItems = this.staticItems.filter((i) => i.id !== id);
    if (this.current?.id === id) this.current = null;
  }

  clearStatic(): void {
    this.staticItems = [];
    this.current = null;
  }

  /**
   * Atualiza o alvo atual e executa a ação se o jogador pediu.
   * `pressed` = apertou neste quadro; `held` = está segurando.
   */
  update(dt: number, ctx: InteractionContext, pressed: boolean, held: boolean): void {
    this.sinceAction += dt;
    this.blockedCooldown = Math.max(0, this.blockedCooldown - dt);
    const p = ctx.player.position;

    // Junta candidatos próximos de todas as fontes.
    this.candidates.length = 0;
    const range = BASE_RANGE + 3;
    for (const provider of this.providers) provider.queryInteractables(p.x, p.z, range, this.candidates);
    for (const item of this.staticItems) {
      if (Math.abs(item.position.x - p.x) < range + item.radius && Math.abs(item.position.z - p.z) < range + item.radius) {
        this.candidates.push(item);
      }
    }

    // Escolhe o melhor: perto e na frente do personagem.
    const fx = Math.sin(ctx.player.yaw);
    const fz = Math.cos(ctx.player.yaw);
    let best: Interactable | null = null;
    let bestAction: InteractAction | null = null;
    let bestScore = Infinity;
    for (const item of this.candidates) {
      if (this.filter && !this.filter(item)) continue;
      const dx = item.position.x - p.x;
      const dz = item.position.z - p.z;
      const dy = Math.abs(item.position.y - (p.y + 1));
      if (dy > 3.5) continue;
      const dist = Math.hypot(dx, dz);
      const reach = BASE_RANGE + item.radius;
      if (dist > reach) continue;
      const action = item.getAction(ctx);
      if (!action) continue;
      const facing = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1; // 1 = bem na frente
      const score = dist / reach + (1 - facing) * 0.6 + (action.enabled ? 0 : 0.5) + (item.priority ?? 0);
      if (score < bestScore) {
        bestScore = score;
        best = item;
        bestAction = action;
      }
    }
    this.current = best;
    this.currentAction = bestAction;

    if (!best || !bestAction) return;
    const pressOk = pressed && this.sinceAction >= PRESS_DELAY;
    const holdOk = held && !!bestAction.repeat && this.sinceAction >= REPEAT_DELAY;
    if (!pressOk && !holdOk) return;

    if (!bestAction.enabled) {
      if (pressed && this.blockedCooldown <= 0) {
        this.onBlocked?.(bestAction.reason ?? 'Não é possível agora');
        this.blockedCooldown = 0.6;
      }
      return;
    }
    ctx.player.faceTowards(best.position.x, best.position.z);
    best.interact(ctx);
    this.sinceAction = 0;
  }
}
