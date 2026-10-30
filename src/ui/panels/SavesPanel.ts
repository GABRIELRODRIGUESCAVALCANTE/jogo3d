/**
 * Salvamentos: três espaços independentes. Cada um pode ser jogado,
 * exportado como arquivo (.json), substituído por um arquivo importado ou apagado.
 */
import { formatDuration } from '../../core/math';
import type { Game } from '../../game/Game';
import type { SaveSummary } from '../../game/save/SaveData';
import { SLOT_COUNT } from '../../game/SaveSystem';
import { formatDate } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

export class SavesPanel extends Panel {
  private summaries: Array<SaveSummary | null> = [];

  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'salvamentos', 'Salvamentos', 'salvar', 'normal');
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-slot-act]');
      if (!btn) return;
      const slot = Number(btn.dataset.slot);
      this.ui.click();
      switch (btn.dataset.slotAct) {
        case 'jogar':
          void this.game.continueGame(slot);
          break;
        case 'novo':
          void this.game.newGameInSlot(slot);
          break;
        case 'exportar':
          void this.game.exportSlot(slot);
          break;
        case 'importar':
          void this.game.importSlot(slot).then(() => this.reload());
          break;
        case 'apagar':
          void this.game.confirmDeleteSave(slot).then(() => this.reload());
          break;
      }
    });
  }

  protected onOpen(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.summaries = await this.game.saveSystem.summaries();
    if (this.isOpen) this.render();
  }

  render(): void {
    const playing = this.game.state === 'playing';
    const current = this.game.saveSystem.slot;
    const cards: string[] = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const s = this.summaries[slot - 1] ?? null;
      const isCurrent = playing && slot === current;
      const info = s
        ? `Nível ${s.level} · Dia ${s.day} · ${s.questsDone} missões · ${formatDuration(s.playTime)}<br><small>Salvo em ${formatDate(s.savedAt)}</small>`
        : '<span class="muted">Vazio</span>';
      const actions = [
        s && !isCurrent ? `<button class="btn btn-primary btn-small" data-slot-act="jogar" data-slot="${slot}">${icon('play')} Jogar</button>` : '',
        !isCurrent ? `<button class="btn btn-small" data-slot-act="novo" data-slot="${slot}">${icon('estrela')} Novo jogo</button>` : '',
        s ? `<button class="btn btn-ghost btn-small" data-slot-act="exportar" data-slot="${slot}">${icon('salvar')} Exportar</button>` : '',
        !isCurrent ? `<button class="btn btn-ghost btn-small" data-slot-act="importar" data-slot="${slot}">${icon('mochila')} Importar</button>` : '',
        s ? `<button class="btn btn-ghost btn-small btn-danger-text" data-slot-act="apagar" data-slot="${slot}">${icon('lixeira')} Apagar</button>` : '',
      ].join('');
      cards.push(`
        <article class="save-slot ${isCurrent ? 'current' : ''}">
          <header><h3>Espaço ${slot}</h3>${isCurrent ? '<span class="tag tag-gold">Jogando agora</span>' : ''}</header>
          <p>${info}</p>
          <div class="save-actions">${actions}</div>
        </article>`);
    }
    this.body.innerHTML = `
      <p class="panel-hint">Exporte um salvamento para guardar uma cópia ou continuar em outro aparelho (abra o jogo lá e use "Importar").</p>
      <div class="save-slots">${cards.join('')}</div>`;
  }
}
