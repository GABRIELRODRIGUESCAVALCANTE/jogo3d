/**
 * Inventário: guarda a quantidade de cada item.
 * Não tem limite de espaços para manter o jogo simples para iniciantes.
 */
import { ITEM_ORDER, ITEMS, isItemId, type ItemBundle, type ItemId } from './data/items';
import type { GameEventBus } from './events';

export const MAX_STACK = 999;

export class Inventory {
  private counts = new Map<ItemId, number>();
  /** Durabilidade restante de cada ferramenta possuída. */
  private durability = new Map<ItemId, number>();

  constructor(private readonly bus?: GameEventBus) {}

  count(id: ItemId): number {
    return this.counts.get(id) ?? 0;
  }

  has(id: ItemId, amount = 1): boolean {
    return this.count(id) >= amount;
  }

  /** Adiciona itens. Retorna quanto realmente foi adicionado (limite de pilha). */
  add(id: ItemId, amount = 1): number {
    if (amount <= 0) return 0;
    const current = this.count(id);
    const max = ITEMS[id].tool ? Math.max(current, 1) : MAX_STACK;
    const next = Math.min(max, current + amount);
    const added = next - current;
    if (added > 0) {
      this.counts.set(id, next);
      const maxDurability = ITEMS[id].durability;
      if (maxDurability && current === 0) this.durability.set(id, maxDurability);
      this.bus?.emit('inventory:changed', { itemId: id, delta: added, total: next });
    }
    return added;
  }

  /** Remove itens. Retorna falso (sem remover nada) se não houver o suficiente. */
  remove(id: ItemId, amount = 1): boolean {
    const current = this.count(id);
    if (amount <= 0) return true;
    if (current < amount) return false;
    const next = current - amount;
    if (next === 0) {
      this.counts.delete(id);
      this.durability.delete(id);
    }
    else this.counts.set(id, next);
    this.bus?.emit('inventory:changed', { itemId: id, delta: -amount, total: next });
    return true;
  }

  /** Durabilidade restante (null se o item não se desgasta ou não está no inventário). */
  durabilityOf(id: ItemId): number | null {
    return this.durability.get(id) ?? null;
  }

  /** Durabilidade de 0 a 1 (1 = nova). */
  durabilityFraction(id: ItemId): number | null {
    const left = this.durability.get(id);
    const max = ITEMS[id].durability;
    return left === undefined || !max ? null : left / max;
  }

  /**
   * Desgasta uma ferramenta. Quando a durabilidade acaba, ela quebra e some
   * do inventário. Retorna verdadeiro se quebrou.
   */
  wearTool(id: ItemId, amount = 1): boolean {
    const left = this.durability.get(id);
    if (left === undefined) return false;
    const next = left - amount;
    if (next > 0) {
      this.durability.set(id, next);
      const max = ITEMS[id].durability ?? next;
      // Aviso uma única vez, quando passa de 20% para menos.
      if (left / max > 0.2 && next / max <= 0.2) this.bus?.emit('tool:worn', { itemId: id });
      return false;
    }
    this.remove(id, this.count(id));
    this.bus?.emit('tool:broken', { itemId: id });
    return true;
  }

  durabilityToJSON(): Record<string, number> {
    return Object.fromEntries(this.durability);
  }

  /** Verifica se há todos os itens de um custo. */
  hasAll(bundle: ItemBundle): boolean {
    return Object.entries(bundle).every(([id, n]) => this.count(id as ItemId) >= (n ?? 0));
  }

  /** Itens que faltam para pagar um custo. */
  missing(bundle: ItemBundle): ItemBundle {
    const result: ItemBundle = {};
    for (const [id, n] of Object.entries(bundle)) {
      const lack = (n ?? 0) - this.count(id as ItemId);
      if (lack > 0) result[id as ItemId] = lack;
    }
    return result;
  }

  /** Remove todos os itens de um custo de uma vez (ou nenhum). */
  removeAll(bundle: ItemBundle): boolean {
    if (!this.hasAll(bundle)) return false;
    for (const [id, n] of Object.entries(bundle)) this.remove(id as ItemId, n ?? 0);
    return true;
  }

  addAll(bundle: ItemBundle): void {
    for (const [id, n] of Object.entries(bundle)) this.add(id as ItemId, n ?? 0);
  }

  /** Lista de itens possuídos, na ordem de exibição. */
  entries(): Array<{ id: ItemId; count: number }> {
    return ITEM_ORDER.filter((id) => this.count(id) > 0).map((id) => ({ id, count: this.count(id) }));
  }

  get totalItems(): number {
    let total = 0;
    for (const n of this.counts.values()) total += n;
    return total;
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  /**
   * Carrega dados salvos, ignorando itens desconhecidos ou valores inválidos.
   * Ferramentas sem durabilidade salva (salvamentos antigos) começam novas.
   */
  load(data: Record<string, number> | undefined, durability?: Record<string, number>): void {
    this.counts.clear();
    this.durability.clear();
    if (!data) return;
    for (const [id, n] of Object.entries(data)) {
      if (isItemId(id) && Number.isFinite(n) && n > 0) {
        this.counts.set(id, Math.min(MAX_STACK, Math.floor(n)));
        const max = ITEMS[id].durability;
        if (max) {
          const saved = durability?.[id];
          this.durability.set(id, Number.isFinite(saved) && saved! > 0 ? Math.min(max, saved!) : max);
        }
      }
    }
  }
}
