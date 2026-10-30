/**
 * Construção: escolha o que construir. Ao escolher, o painel fecha e o
 * fantasma da construção aparece à frente do personagem.
 */
import type { Game } from '../../game/Game';
import { ITEMS, type ItemId } from '../../game/data/items';
import { STRUCTURES, STRUCTURE_ORDER, type StructureDef, type StructureId } from '../../game/data/structures';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel, costChips } from './Panel';

export class BuildPanel extends Panel {
  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'construcao', 'Construção', 'construir', 'wide');
    this.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-build]');
      if (btn && !btn.hasAttribute('disabled')) {
        this.game.startBuild(btn.dataset.build as StructureId);
        return;
      }
      if (target.closest('[data-remove]')) this.game.startRemoval();
    });
  }

  render(): void {
    const g = this.game;
    const inv = g.inventory;
    const groups: Array<[StructureDef['group'], string]> = [
      ['basico', 'Essenciais'],
      ['modular', 'Casa modular (encaixa numa grade de 2 m)'],
      ['decoracao', 'Decoração'],
    ];
    const card = (id: StructureId) => {
      const def = STRUCTURES[id];
      const reason = g.building.canStart(id);
      const count = g.building.count(id);
      return `
        <article class="recipe ${reason ? '' : 'can'}">
          <div class="recipe-icon">${icon(def.icon)}</div>
          <div class="recipe-info">
            <h3>${escapeHtml(def.name)} ${count > 0 ? `<span class="tag">Construídas: ${count}${def.limit ? `/${def.limit}` : ''}</span>` : ''}</h3>
            <p>${escapeHtml(def.description)}</p>
            <div class="costs">${costChips(def.cost, (i) => inv.count(i as ItemId), (i) => ITEMS[i as ItemId])}</div>
            ${def.minLevel > 1 ? `<div class="reqs"><span class="req ${g.progression.level >= def.minLevel ? '' : 'missing'}">${icon('estrela')}Nível ${def.minLevel}</span></div>` : ''}
          </div>
          <div class="recipe-action">
            <button class="btn ${reason ? 'btn-disabled' : 'btn-primary'}" data-build="${id}" ${reason ? 'disabled' : ''}>Posicionar</button>
            ${reason ? `<small>${escapeHtml(reason)}</small>` : ''}
          </div>
        </article>`;
    };
    const cards = groups
      .map(([group, title]) => {
        const items = STRUCTURE_ORDER.filter((id) => STRUCTURES[id].group === group).map(card).join('');
        return `<h3 class="build-group">${escapeHtml(title)}</h3>${items}`;
      })
      .join('');

    const hint =
      g.controlMode === 'touch'
        ? 'Depois de escolher, use os botões Girar e Construir. O fantasma fica verde quando o local é válido.'
        : 'Depois de escolher: <kbd>R</kbd> gira, <kbd>E</kbd> ou clique constrói, <kbd>Esc</kbd> cancela. Verde = local válido. Peças modulares continuam selecionadas para você construir várias seguidas.';
    this.body.innerHTML = `
      <p class="panel-hint">${hint}</p>
      <div class="recipe-list">${cards}</div>
      <div class="panel-footer-actions">
        <button class="btn btn-ghost" data-remove="1" ${g.building.structures.length ? '' : 'disabled'}>${icon('remover')} Remover construções</button>
      </div>`;
  }
}
