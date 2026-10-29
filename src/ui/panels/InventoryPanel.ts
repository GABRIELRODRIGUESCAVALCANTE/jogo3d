/**
 * Inventário: grade com todos os itens, detalhes do item selecionado e
 * ações (comer, acender tocha).
 */
import type { Game } from '../../game/Game';
import { ITEMS, ITEM_ORDER, type ItemId } from '../../game/data/items';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

const CATEGORY: Record<string, string> = {
  recurso: 'Recurso',
  material: 'Material',
  ferramenta: 'Ferramenta',
  comida: 'Comida',
  especial: 'Item especial',
};

export class InventoryPanel extends Panel {
  private selected: ItemId | null = null;

  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'inventario', 'Inventário', 'mochila', 'wide');
    this.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const slot = target.closest<HTMLElement>('[data-item]');
      if (slot) {
        this.selected = slot.dataset.item as ItemId;
        this.ui.click();
        this.render();
        return;
      }
      const action = target.closest<HTMLElement>('[data-use]');
      if (action) {
        const id = action.dataset.use as ItemId;
        if (id === 'tocha') this.game.toggleTorch();
        else this.game.useItem(id);
        this.render();
      }
    });
  }

  render(): void {
    const inv = this.game.inventory;
    const entries = inv.entries();
    if (this.selected && inv.count(this.selected) === 0) this.selected = null;
    if (!this.selected && entries.length > 0) this.selected = entries[0].id;

    const slots: string[] = [];
    for (const id of ITEM_ORDER) {
      const n = inv.count(id);
      if (n === 0) continue;
      const def = ITEMS[id];
      slots.push(`
        <button class="slot ${this.selected === id ? 'selected' : ''}" data-item="${id}" aria-label="${escapeHtml(def.name)}: ${n}">
          ${icon(def.icon)}
          ${def.tool ? '' : `<span class="slot-count">${n}</span>`}
          <span class="slot-name">${escapeHtml(def.name)}</span>
        </button>`);
    }
    // Espaços vazios completam a grade (visual de mochila).
    const empty = Math.max(0, 15 - slots.length);
    for (let i = 0; i < empty; i++) slots.push('<div class="slot slot-empty"></div>');

    let detail = `<div class="item-detail empty"><p>Sua mochila está vazia. Colete recursos pela ilha!</p></div>`;
    if (this.selected) {
      const def = ITEMS[this.selected];
      const n = inv.count(this.selected);
      const actions: string[] = [];
      if (def.food) {
        actions.push(`<button class="btn btn-primary" data-use="${def.id}">${icon(def.icon)} Comer (+${def.food.energy} energia)</button>`);
      }
      if (def.id === 'tocha') {
        actions.push(`<button class="btn btn-primary" data-use="tocha">${icon('tocha')} ${this.game.player.torchOn ? 'Apagar tocha' : 'Acender tocha'} <kbd>T</kbd></button>`);
      }
      detail = `
        <div class="item-detail">
          <div class="item-big">${icon(def.icon)}</div>
          <h3>${escapeHtml(def.name)}</h3>
          <div class="item-meta"><span class="tag">${CATEGORY[def.category]}</span>${def.tool ? '<span class="tag tag-tool">Permanente</span>' : `<span class="tag">Quantidade: ${n}</span>`}</div>
          <p>${escapeHtml(def.description)}</p>
          <div class="item-actions">${actions.join('')}</div>
        </div>`;
    }

    const p = this.game.player;
    this.body.innerHTML = `
      <div class="inventory-layout">
        <div class="slot-grid">${slots.join('')}</div>
        ${detail}
      </div>
      <div class="inventory-footer">
        <span>${icon('raio')} Energia: <b>${Math.round(p.energy)}/${p.maxEnergy}</b></span>
        <span>${icon('mochila')} Itens: <b>${inv.totalItems}</b></span>
      </div>`;
  }
}
