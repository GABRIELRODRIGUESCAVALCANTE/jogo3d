/**
 * Fabricação: lista de receitas com custos, requisitos e botão de fabricar.
 */
import type { Game } from '../../game/Game';
import { ITEMS, type ItemId } from '../../game/data/items';
import { STATION_NAMES, type StationId } from '../../game/data/recipes';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel, costChips } from './Panel';

export class CraftingPanel extends Panel {
  /** Estação usada para abrir o painel (destaca as receitas dela). */
  focusStation: StationId | null = null;

  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'fabricacao', 'Fabricação', 'martelo', 'wide');
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-craft]');
      if (btn && !btn.hasAttribute('disabled')) {
        this.game.craft(btn.dataset.craft!);
        this.render();
      }
    });
  }

  protected onClose(): void {
    this.focusStation = null;
  }

  render(): void {
    const g = this.game;
    const inv = g.inventory;
    const stations = (['bancada', 'fogueira'] as StationId[])
      .map((s) => {
        const near = g.building.isNearStation(s, g.player.position);
        return `<span class="station ${near ? 'near' : ''}">${icon(s)}${STATION_NAMES[s]}: <b>${near ? 'por perto' : 'longe'}</b></span>`;
      })
      .join('');

    const recipes = [...g.crafting.recipes].sort((a, b) => {
      if (!this.focusStation) return 0;
      return Number(b.station === this.focusStation) - Number(a.station === this.focusStation);
    });

    const cards = recipes
      .map((r) => {
        const def = ITEMS[r.result];
        const check = g.crafting.check(r.id);
        const reqs: string[] = [];
        if (r.station) reqs.push(`<span class="req">${icon(r.station)}${STATION_NAMES[r.station]}</span>`);
        if (r.minLevel) reqs.push(`<span class="req ${g.progression.level >= r.minLevel ? '' : 'missing'}">${icon('estrela')}Nível ${r.minLevel}</span>`);
        return `
          <article class="recipe ${check.ok ? 'can' : ''} ${this.focusStation && r.station === this.focusStation ? 'focus' : ''}">
            <div class="recipe-icon">${icon(def.icon)}${r.amount > 1 ? `<span class="slot-count">${r.amount}</span>` : ''}</div>
            <div class="recipe-info">
              <h3>${escapeHtml(def.name)}</h3>
              <p>${escapeHtml(def.description)}</p>
              <div class="costs">${costChips(r.cost, (id) => inv.count(id as ItemId), (id) => ITEMS[id as ItemId])}</div>
              ${reqs.length ? `<div class="reqs">${reqs.join('')}</div>` : ''}
            </div>
            <div class="recipe-action">
              <button class="btn ${check.ok ? 'btn-primary' : 'btn-disabled'}" data-craft="${r.id}" ${check.ok ? '' : 'disabled'}>Fabricar</button>
              ${check.ok ? '' : `<small>${escapeHtml(check.reason ?? '')}</small>`}
            </div>
          </article>`;
      })
      .join('');

    this.body.innerHTML = `<div class="stations">${stations}</div><div class="recipe-list">${cards}</div>`;
  }
}
