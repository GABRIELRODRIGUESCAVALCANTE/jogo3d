/**
 * Gerencia toda a interface em HTML por cima do jogo 3D:
 * tela de carregamento, menu inicial, HUD, painéis, diálogos e avisos.
 */
import type { Input } from '../core/Input';
import { exitFullscreen, isFullscreen, isPortrait, requestFullscreen } from '../core/Device';
import { formatDuration } from '../core/math';
import type { Game } from '../game/Game';
import type { SaveSummary } from '../game/save/SaveData';
import { Dialogs } from './Dialogs';
import { $, formatDate, html } from './dom';
import { HUD } from './HUD';
import { icon } from './icons';
import { Notifications } from './Notifications';
import { BuildPanel } from './panels/BuildPanel';
import { CraftingPanel } from './panels/CraftingPanel';
import { HelpPanel } from './panels/HelpPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { MapPanel } from './panels/MapPanel';
import type { Panel } from './panels/Panel';
import { PauseMenu } from './panels/PauseMenu';
import { QuestPanel } from './panels/QuestPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { StoragePanel } from './panels/StoragePanel';
import type { PlacedStructure } from '../game/Building';
import { TouchControls } from './TouchControls';

export type PanelId = 'inventario' | 'fabricacao' | 'construcao' | 'mapa' | 'missoes' | 'pausa' | 'opcoes' | 'ajuda' | 'bau';

const TIPS = [
  'Dica: segure E (ou o botão de mão) para coletar sem parar.',
  'Dica: o feixe de luz dourado aponta para o objetivo da missão.',
  'Dica: frutas assadas na fogueira recuperam muita energia.',
  'Dica: a cabana tem uma cama para pular a noite.',
  'Dica: com a picareta você consegue minerar cristais.',
];

export class UIManager {
  readonly root: HTMLElement;
  readonly hud: HUD;
  readonly touch: TouchControls;
  readonly notify: Notifications;
  readonly dialogs: Dialogs;
  activePanel: Panel | null = null;
  /** Avisado quando painéis/diálogos abrem ou fecham. */
  onBlockingChange: (() => void) | null = null;

  readonly panels: {
    inventario: InventoryPanel;
    fabricacao: CraftingPanel;
    construcao: BuildPanel;
    mapa: MapPanel;
    missoes: QuestPanel;
    pausa: PauseMenu;
    opcoes: SettingsPanel;
    ajuda: HelpPanel;
    bau: StoragePanel;
  };
  private readonly panelLayer: HTMLElement;
  private readonly loadingEl: HTMLElement;
  private readonly menuEl: HTMLElement;
  private readonly contextEl: HTMLElement;
  private readonly fadeEl: HTMLElement;
  private readonly portraitEl: HTMLElement;
  private panelHistory: PanelId[] = [];
  private menuVisible = false;
  private portraitDismissed = false;

  constructor(
    root: HTMLElement,
    private readonly game: Game,
    input: Input,
  ) {
    this.root = root;
    this.root.classList.add('ui');

    this.hud = new HUD(root, game, (panel) => this.togglePanel(panel));
    this.touch = new TouchControls(root, input);
    this.touch.onCancelBuild = () => game.cancelBuild();

    this.panelLayer = html('<div class="panel-layer hidden"></div>');
    root.append(this.panelLayer);
    this.panelLayer.addEventListener('pointerdown', (e) => {
      // Clicar fora do painel fecha.
      if (e.target === this.panelLayer) this.closePanel();
    });
    this.panels = {
      inventario: new InventoryPanel(this, game),
      fabricacao: new CraftingPanel(this, game),
      construcao: new BuildPanel(this, game),
      mapa: new MapPanel(this, game),
      missoes: new QuestPanel(this, game),
      pausa: new PauseMenu(this, game),
      opcoes: new SettingsPanel(this, game),
      ajuda: new HelpPanel(this, game),
      bau: new StoragePanel(this, game),
    };
    for (const panel of Object.values(this.panels)) this.panelLayer.append(panel.el);

    this.notify = new Notifications(root);
    this.dialogs = new Dialogs(root, () => this.click());
    this.dialogs.onChange = () => this.onBlockingChange?.();

    this.menuEl = this.createMainMenu();
    root.append(this.menuEl);

    this.loadingEl = html(`
      <div class="screen loading">
        <div class="loading-box">
          <div class="title-small">uma aventura na ilha esquecida</div>
          <h1 class="game-title">Além do <span>Horizonte</span></h1>
          <div class="loading-bar"><div class="loading-fill"></div></div>
          <p class="loading-label">Preparando a aventura…</p>
          <p class="loading-tip">${TIPS[Math.floor(Math.random() * TIPS.length)]}</p>
        </div>
      </div>`);
    root.append(this.loadingEl);

    this.contextEl = html(`
      <div class="screen context-lost hidden">
        <div class="dialog">
          <h2>Gráficos interrompidos</h2>
          <p>O navegador pausou os gráficos 3D (isso pode acontecer quando o aparelho fica sem memória ou troca de aba). Estamos tentando restaurar…</p>
          <div class="dialog-actions"><button class="btn btn-primary" data-reload>${icon('girar')} Recarregar o jogo</button></div>
        </div>
      </div>`);
    root.append(this.contextEl);
    $(this.contextEl, '[data-reload]').addEventListener('click', () => window.location.reload());

    this.portraitEl = html(`
      <div class="portrait-hint hidden">
        <div class="phone-icon"></div>
        <p>Para uma experiência melhor, gire o aparelho e jogue na horizontal.</p>
        <button class="btn btn-small">Continuar assim</button>
      </div>`);
    root.append(this.portraitEl);
    $(this.portraitEl, 'button').addEventListener('click', () => {
      this.portraitDismissed = true;
      this.portraitEl.classList.add('hidden');
    });

    this.fadeEl = html('<div class="fade"></div>');
    root.append(this.fadeEl);
  }

  // ---------------------------------------------------------------------------
  // Telas
  // ---------------------------------------------------------------------------

  setLoading(fraction: number, label: string): void {
    $(this.loadingEl, '.loading-fill').style.transform = `scaleX(${fraction})`;
    $(this.loadingEl, '.loading-label').textContent = label;
  }

  hideLoading(): void {
    this.loadingEl.classList.add('leaving');
    window.setTimeout(() => this.loadingEl.remove(), 700);
  }

  showMainMenu(summary: SaveSummary | null, storageOk: boolean): void {
    this.menuVisible = true;
    this.menuEl.classList.remove('hidden', 'leaving');
    const cont = $(this.menuEl, '[data-menu="continuar"]');
    cont.classList.toggle('hidden', !summary);
    if (summary) {
      $(cont, 'small').textContent = `Nível ${summary.level} · Dia ${summary.day} · ${summary.questsDone} missões · ${formatDuration(summary.playTime)} · salvo em ${formatDate(summary.savedAt)}`;
    }
    $(this.menuEl, '[data-menu="novo"]').classList.toggle('btn-primary', !summary);
    $(this.menuEl, '.storage-warning').classList.toggle('hidden', storageOk);
    this.updateFullscreenButton();
    this.hud.setVisible(false);
    this.touch.setVisible(false);
    this.onBlockingChange?.();
  }

  hideMainMenu(): void {
    this.menuVisible = false;
    this.menuEl.classList.add('leaving');
    window.setTimeout(() => {
      if (!this.menuVisible) this.menuEl.classList.add('hidden');
    }, 500);
    this.onBlockingChange?.();
  }

  get isMenuVisible(): boolean {
    return this.menuVisible;
  }

  showContextLost(visible: boolean): void {
    this.contextEl.classList.toggle('hidden', !visible);
  }

  /** Escurece a tela, executa algo e clareia de novo. */
  async fade(during: () => void | Promise<void>, holdMs = 600): Promise<void> {
    this.fadeEl.classList.add('on');
    await new Promise((r) => window.setTimeout(r, 450));
    await during();
    await new Promise((r) => window.setTimeout(r, holdMs));
    this.fadeEl.classList.remove('on');
  }

  updatePortraitHint(playing: boolean): void {
    const show = playing && this.game.controlMode === 'touch' && isPortrait() && !this.portraitDismissed;
    this.portraitEl.classList.toggle('hidden', !show);
  }

  // ---------------------------------------------------------------------------
  // Painéis
  // ---------------------------------------------------------------------------

  openPanel(id: PanelId): void {
    const panel = this.panels[id];
    if (this.activePanel === panel) return;
    if (this.activePanel) {
      // Opções e ajuda abertas a partir da pausa voltam para a pausa.
      if (this.activePanel.id === 'pausa' && (id === 'opcoes' || id === 'ajuda')) this.panelHistory.push('pausa');
      this.activePanel.close();
    }
    this.activePanel = panel;
    this.panelLayer.classList.remove('hidden');
    panel.open();
    this.game.audio.play('open');
    this.onBlockingChange?.();
  }

  closePanel(): void {
    if (!this.activePanel) return;
    this.activePanel.close();
    this.activePanel = null;
    this.game.audio.play('close');
    const previous = this.panelHistory.pop();
    if (previous) {
      this.openPanel(previous);
      return;
    }
    this.panelLayer.classList.add('hidden');
    this.onBlockingChange?.();
  }

  togglePanel(id: PanelId): void {
    if (this.activePanel?.id === id) this.closePanel();
    else {
      this.panelHistory = [];
      this.openPanel(id);
    }
  }

  closeAll(): void {
    this.panelHistory = [];
    while (this.activePanel) this.closePanel();
  }

  /** Abre o painel de um baú de armazenamento. */
  openStorage(chest: PlacedStructure): void {
    this.panels.bau.chest = chest;
    this.panelHistory = [];
    if (this.activePanel?.id === 'bau') this.panels.bau.refresh();
    else this.openPanel('bau');
  }

  /** Redesenha um painel se ele estiver aberto. */
  refresh(id: PanelId): void {
    this.panels[id].refresh();
  }

  /** Verdadeiro quando algo da interface deve pausar o controle do jogador. */
  isBlocking(): boolean {
    return this.activePanel !== null || this.dialogs.isOpen || this.menuVisible;
  }

  click(): void {
    this.game.audio.play('click');
  }

  setControlMode(mode: 'desktop' | 'touch', playing: boolean): void {
    this.root.classList.toggle('touch-mode', mode === 'touch');
    this.root.classList.toggle('desktop-mode', mode === 'desktop');
    this.touch.setVisible(mode === 'touch' && playing);
  }

  async toggleFullscreen(): Promise<void> {
    if (isFullscreen()) await exitFullscreen();
    else await requestFullscreen();
    this.updateFullscreenButton();
  }

  update(dt: number): void {
    this.hud.update(dt);
    this.activePanel?.update(dt);
  }

  // ---------------------------------------------------------------------------

  private createMainMenu(): HTMLElement {
    const el = html(`
      <div class="screen main-menu hidden">
        <div class="menu-vignette"></div>
        <div class="menu-content">
          <div class="title-block">
            <div class="title-small">uma aventura na ilha esquecida</div>
            <h1 class="game-title">Além do <span>Horizonte</span></h1>
          </div>
          <div class="menu-buttons">
            <button class="btn btn-primary btn-big hidden" data-menu="continuar">${icon('play')}<span>Continuar<small></small></span></button>
            <button class="btn btn-big" data-menu="novo">${icon('estrela')}<span>Novo jogo</span></button>
            <div class="menu-row">
              <button class="btn" data-menu="opcoes">${icon('engrenagem')} Opções</button>
              <button class="btn" data-menu="ajuda">${icon('info')} Como jogar</button>
            </div>
            <button class="btn btn-ghost btn-small" data-menu="tela">${icon('tela')} <span>Tela cheia</span></button>
          </div>
          <p class="storage-warning hidden">Atenção: o navegador está bloqueando o armazenamento local; o progresso não será salvo ao fechar a página.</p>
          <footer class="menu-footer">Versão 0.2 · Seu progresso fica salvo neste navegador · Feito com Three.js</footer>
        </div>
      </div>`);
    el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
      if (!btn) return;
      this.game.audio.unlock();
      this.click();
      switch (btn.dataset.menu) {
        case 'continuar':
          void this.game.continueGame();
          break;
        case 'novo':
          void this.game.newGameFromMenu();
          break;
        case 'opcoes':
          this.openPanel('opcoes');
          break;
        case 'ajuda':
          this.openPanel('ajuda');
          break;
        case 'tela':
          void this.toggleFullscreen();
          break;
      }
    });
    return el;
  }

  private updateFullscreenButton(): void {
    const btn = this.menuEl.querySelector<HTMLElement>('[data-menu="tela"]');
    if (!btn) return;
    btn.classList.toggle('hidden', !document.fullscreenEnabled);
    btn.querySelector('span')!.textContent = isFullscreen() ? 'Sair da tela cheia' : 'Tela cheia';
  }
}
