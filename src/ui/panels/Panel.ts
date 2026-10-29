/**
 * Base dos painéis (inventário, fabricação, mapa...).
 * Cada painel tem cabeçalho com título e botão de fechar, e um corpo que
 * é redesenhado pelo método `render()`.
 */
import type { Game } from '../../game/Game';
import { $, escapeHtml, html } from '../dom';
import { icon } from '../icons';
import type { PanelId, UIManager } from '../UIManager';

export abstract class Panel {
  readonly el: HTMLElement;
  protected readonly body: HTMLElement;
  isOpen = false;

  constructor(
    protected readonly ui: UIManager,
    protected readonly game: Game,
    readonly id: PanelId,
    title: string,
    iconName: string,
    size: 'normal' | 'wide' | 'small' = 'normal',
  ) {
    this.el = html(`
      <section class="panel panel-${size} panel-${id} hidden" role="dialog" aria-label="${escapeHtml(title)}">
        <header class="panel-header">
          <span class="panel-icon">${icon(iconName)}</span>
          <h2>${escapeHtml(title)}</h2>
          <button class="icon-btn panel-close" aria-label="Fechar">${icon('fechar')}</button>
        </header>
        <div class="panel-body"></div>
      </section>`);
    this.body = $(this.el, '.panel-body');
    $(this.el, '.panel-close').addEventListener('click', () => this.ui.closePanel());
  }

  open(): void {
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.render();
    this.onOpen();
  }

  close(): void {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.onClose();
  }

  /** Redesenha o conteúdo se o painel estiver aberto. */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  abstract render(): void;
  protected onOpen(): void {}
  protected onClose(): void {}
  /** Chamado a cada quadro enquanto aberto (opcional). */
  update(_dt: number): void {}
}

/** Lista de custos como "chips" com ícone e quantidade (vermelho se faltar). */
export function costChips(cost: Partial<Record<string, number>>, have: (id: string) => number, names: (id: string) => { name: string; icon: string }): string {
  return Object.entries(cost)
    .map(([id, n]) => {
      const owned = have(id);
      const ok = owned >= (n ?? 0);
      const info = names(id);
      return `<span class="cost-chip ${ok ? 'ok' : 'missing'}" title="${escapeHtml(info.name)}">${icon(info.icon)}<span>${owned}/${n}</span></span>`;
    })
    .join('');
}
