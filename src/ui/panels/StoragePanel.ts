/**
 * Baú de armazenamento: duas colunas (mochila e baú). Clique num item para
 * mover 1 unidade; o botão "Tudo" move a pilha inteira.
 */
import type { Game } from '../../game/Game';
import type { PlacedStructure } from '../../game/Building';
import { ITEMS, ITEM_ORDER, type ItemId } from '../../game/data/items';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

export class StoragePanel extends Panel {
  chest: PlacedStructure | null = null;

  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'bau', 'Baú de Armazenamento', 'bau', 'wide');
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-move]');
      if (!btn || !this.chest) return;
      const item = btn.dataset.move as ItemId;
      const toChest = btn.dataset.to === 'bau';
      const amount = btn.dataset.all ? 999 : 1;
      const moved = this.game.building.transfer(this.chest, item, amount, toChest);
      if (moved > 0) this.ui.click();
      this.render();
    });
  }

  protected onClose(): void {
    this.chest = null;
  }

  render(): void {
    const chest = this.chest;
    if (!chest?.storage) {
      this.body.innerHTML = '<p class="muted">Nenhum baú aberto.</p>';
      return;
    }
    const inv = this.game.inventory;
    const list = (items: Array<[ItemId, number]>, to: 'bau' | 'mochila') =>
      items.length === 0
        ? `<p class="muted">${to === 'bau' ? 'Mochila vazia.' : 'Baú vazio.'}</p>`
        : items
            .map(
              ([id, n]) => `
          <div class="storage-row">
            <button class="storage-item" data-move="${id}" data-to="${to}" ${ITEMS[id].tool && to === 'bau' ? 'disabled title="Ferramentas ficam com você"' : ''}>
              ${icon(ITEMS[id].icon)}<span>${escapeHtml(ITEMS[id].name)}</span><b>${n}</b>
            </button>
            ${ITEMS[id].tool && to === 'bau' ? '' : `<button class="btn btn-small btn-ghost" data-move="${id}" data-to="${to}" data-all="1">Tudo</button>`}
          </div>`,
            )
            .join('');
    const mine = ITEM_ORDER.filter((id) => inv.count(id) > 0).map((id) => [id, inv.count(id)] as [ItemId, number]);
    const stored = ITEM_ORDER.filter((id) => (chest.storage!.get(id) ?? 0) > 0).map((id) => [id, chest.storage!.get(id)!] as [ItemId, number]);
    this.body.innerHTML = `
      <p class="panel-hint">Toque num item para mover 1 unidade. "Tudo" move a pilha inteira.</p>
      <div class="storage-layout">
        <section><h3>${icon('mochila')} Mochila</h3>${list(mine, 'bau')}</section>
        <section><h3>${icon('bau')} Baú</h3>${list(stored, 'mochila')}</section>
      </div>`;
  }
}
