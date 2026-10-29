/**
 * Inventário: guarda a quantidade de cada item.
 * Não tem limite de espaços para manter o jogo simples para iniciantes.
 */
import { ITEM_ORDER, ITEMS, isItemId, type ItemBundle, type ItemId } from './data/items';
import type { GameEventBus } from './events';

export const MAX_STACK = 999;

export class Inventory {
  private counts = new Map<ItemId, number>();

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
    if (next === 0) this.counts.delete(id);
    else this.counts.set(id, next);
    this.bus?.emit('inventory:changed', { itemId: id, delta: -amount, total: next });
    return true;
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

  /** Carrega dados salvos, ignorando itens desconhecidos ou valores inválidos. */
  load(data: Record<string, number> | undefined): void {
    this.counts.clear();
    if (!data) return;
    for (const [id, n] of Object.entries(data)) {
      if (isItemId(id) && Number.isFinite(n) && n > 0) {
        this.counts.set(id, Math.min(MAX_STACK, Math.floor(n)));
      }
    }
  }
}
