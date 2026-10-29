/**
 * Menu de pausa: continuar, salvar, opções, ajuda, tela cheia, sair e
 * apagar salvamento.
 */
import { formatDuration } from '../../core/math';
import { isFullscreen } from '../../core/Device';
import type { Game } from '../../game/Game';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

export class PauseMenu extends Panel {
  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'pausa', 'Jogo pausado', 'pausa', 'small');
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!btn) return;
      this.ui.click();
      switch (btn.dataset.act) {
        case 'continuar':
          this.ui.closePanel();
          break;
        case 'salvar':
          void this.game.saveGame(true);
          break;
        case 'opcoes':
          this.ui.openPanel('opcoes');
          break;
        case 'ajuda':
          this.ui.openPanel('ajuda');
          break;
        case 'tela':
          void this.ui.toggleFullscreen().then(() => this.render());
          break;
        case 'sair':
          void this.game.returnToMenu();
          break;
        case 'apagar':
          void this.game.confirmDeleteSave();
          break;
      }
    });
  }

  render(): void {
    const g = this.game;
    this.body.innerHTML = `
      <div class="pause-stats">
        <div><span>Nível</span><b>${g.progression.level}</b></div>
        <div><span>Dia</span><b>${g.world.dayNight.day}</b></div>
        <div><span>Missões</span><b>${g.quests.completed.size}/${g.quests.totalQuests}</b></div>
        <div><span>Explorado</span><b>${Math.round(g.worldState.exploredPercent * 100)}%</b></div>
        <div><span>Tempo</span><b>${formatDuration(g.playTime)}</b></div>
      </div>
      <div class="menu-buttons">
        <button class="btn btn-primary btn-big" data-act="continuar">${icon('play')} Continuar</button>
        <button class="btn" data-act="salvar">${icon('salvar')} Salvar jogo</button>
        <button class="btn" data-act="opcoes">${icon('engrenagem')} Opções</button>
        <button class="btn" data-act="ajuda">${icon('info')} Como jogar</button>
        ${document.fullscreenEnabled ? `<button class="btn" data-act="tela">${icon('tela')} ${isFullscreen() ? 'Sair da tela cheia' : 'Tela cheia'}</button>` : ''}
        <button class="btn btn-ghost" data-act="sair">${icon('sair')} Salvar e sair para o menu</button>
        <button class="btn btn-ghost btn-danger-text" data-act="apagar">${icon('lixeira')} Apagar salvamento</button>
      </div>
      ${g.saveSystem.persistent ? '' : '<p class="warning-text">Atenção: este navegador está bloqueando o armazenamento local. O progresso será perdido ao fechar a página.</p>'}`;
  }
}
