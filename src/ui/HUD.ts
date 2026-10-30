/**
 * HUD: tudo o que aparece por cima do jogo durante a exploração
 * (nível, experiência, energia, recursos, missão, relógio, minimapa,
 * botões de menu e o aviso de interação).
 */
import type { Game } from '../game/Game';
import { HUD_RESOURCES, ITEMS } from '../game/data/items';
import { STRUCTURES } from '../game/data/structures';
import { $, escapeHtml, html } from './dom';
import { keyLabel, type BindableAction, type KeyBindings } from '../core/KeyBindings';
import { icon } from './icons';
import { WEATHER_NAMES } from '../game/Weather';
import type { PanelId } from './UIManager';

const MENU_BUTTONS: Array<{ panel: PanelId; icon: string; label: string; key: string; action?: BindableAction }> = [
  { panel: 'inventario', icon: 'mochila', label: 'Inventário', key: 'I', action: 'inventario' },
  { panel: 'fabricacao', icon: 'martelo', label: 'Fabricar', key: 'C', action: 'fabricar' },
  { panel: 'construcao', icon: 'construir', label: 'Construir', key: 'B', action: 'construir' },
  { panel: 'mapa', icon: 'mapa', label: 'Mapa', key: 'M', action: 'mapa' },
  { panel: 'missoes', icon: 'missao', label: 'Missões', key: 'J', action: 'missoes' },
  { panel: 'pausa', icon: 'pausa', label: 'Pausa', key: 'Esc' },
];

export class HUD {
  readonly el: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly xpLabel: HTMLElement;
  private readonly energyFill: HTMLElement;
  private readonly energyLabel: HTMLElement;
  private readonly hungerFill: HTMLElement;
  private readonly hungerLabel: HTMLElement;
  private readonly buffEl: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly clockIcon: HTMLElement;
  private readonly weatherEl: HTMLElement;
  private lastWeather = 'limpo';
  private readonly regionEl: HTMLElement;
  private readonly trackerEl: HTMLElement;
  private readonly resourcesEl: HTMLElement;
  private readonly promptEl: HTMLElement;
  private readonly buildEl: HTMLElement;
  private readonly lockHint: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private readonly saveEl: HTMLElement;
  private readonly minimap: HTMLCanvasElement;
  private readonly minimapWrap: HTMLElement;

  private minimapTimer = 0;
  private slowTimer = 0;
  private questDirty = true;
  private resourcesDirty = true;
  private lastPrompt = '';
  private lastNight: boolean | null = null;
  private interactKey = 'E';
  private rotateKey = 'R';

  constructor(
    root: HTMLElement,
    private readonly game: Game,
    onMenu: (panel: PanelId) => void,
  ) {
    const menu = MENU_BUTTONS.map(
      (b) => `
        <button class="hud-btn" data-panel="${b.panel}" aria-label="${b.label}" title="${b.label} (${b.key})">
          ${icon(b.icon)}<kbd>${b.key}</kbd>
        </button>`,
    ).join('');
    this.el = html(`
      <div class="hud hidden">
        <div class="hud-status">
          <div class="level-badge" title="Nível">${icon('estrela')}<span class="lvl">1</span></div>
          <div class="bars">
            <div class="bar bar-xp"><div class="fill"></div><span class="bar-label">XP</span></div>
            <div class="bar bar-energy"><div class="fill"></div><span class="bar-label">Energia</span></div>
            <div class="bar bar-hunger"><div class="fill"></div><span class="bar-label">Saciedade</span></div>
            <div class="buff hidden">${icon('fruta_assada')}<span></span></div>
          </div>
        </div>
        <nav class="hud-menu" aria-label="Menus">${menu}</nav>
        <div class="hud-right">
          <div class="clock"><span class="clock-icon">${icon('sol')}</span><span class="clock-text">Dia 1 · 08:00</span><span class="weather-icon hidden"></span></div>
          <div class="minimap-wrap" title="Abrir mapa (M)">
            <canvas class="minimap" width="168" height="168"></canvas>
            <div class="minimap-fog">${icon('nuvem')}<span>Névoa</span></div>
          </div>
          <div class="region-name"></div>
          <div class="quest-tracker"></div>
        </div>
        <div class="hud-resources"></div>
        <div class="prompt hidden"></div>
        <div class="build-banner hidden"></div>
        <div class="lock-hint hidden">${icon('alvo')}<span>Clique na tela para controlar a câmera</span></div>
        <div class="fps hidden"></div>
        <div class="save-indicator">${icon('salvar')}<span>Salvando…</span></div>
      </div>`);
    root.append(this.el);

    this.levelEl = $(this.el, '.lvl');
    this.xpFill = $(this.el, '.bar-xp .fill');
    this.xpLabel = $(this.el, '.bar-xp .bar-label');
    this.energyFill = $(this.el, '.bar-energy .fill');
    this.energyLabel = $(this.el, '.bar-energy .bar-label');
    this.hungerFill = $(this.el, '.bar-hunger .fill');
    this.hungerLabel = $(this.el, '.bar-hunger .bar-label');
    this.buffEl = $(this.el, '.buff');
    this.clockEl = $(this.el, '.clock-text');
    this.clockIcon = $(this.el, '.clock-icon');
    this.weatherEl = $(this.el, '.weather-icon');
    this.regionEl = $(this.el, '.region-name');
    this.trackerEl = $(this.el, '.quest-tracker');
    this.resourcesEl = $(this.el, '.hud-resources');
    this.promptEl = $(this.el, '.prompt');
    this.buildEl = $(this.el, '.build-banner');
    this.lockHint = $(this.el, '.lock-hint');
    this.fpsEl = $(this.el, '.fps');
    this.saveEl = $(this.el, '.save-indicator');
    this.minimap = $(this.el, '.minimap');
    this.minimapWrap = $(this.el, '.minimap-wrap');

    this.el.querySelectorAll<HTMLElement>('.hud-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onMenu(btn.dataset.panel as PanelId);
      });
    });
    $(this.el, '.minimap-wrap').addEventListener('click', () => onMenu('mapa'));
    this.trackerEl.addEventListener('click', () => onMenu('missoes'));
  }

  /** Atualiza as letras das teclas nos botões (o jogador pode trocar as teclas). */
  refreshKeys(bindings: KeyBindings): void {
    this.interactKey = keyLabel(bindings.primary('interagir'));
    this.rotateKey = keyLabel(bindings.primary('girar'));
    this.lastPrompt = '';
    for (const b of MENU_BUTTONS) {
      if (!b.action) continue;
      const btn = this.el.querySelector<HTMLElement>(`.hud-btn[data-panel="${b.panel}"]`);
      const label = keyLabel(bindings.primary(b.action));
      btn?.querySelector('kbd')?.replaceChildren(label);
      btn?.setAttribute('title', `${b.label} (${label})`);
    }
  }

  setVisible(visible: boolean): void {
    this.el.classList.toggle('hidden', !visible);
    if (visible) {
      this.questDirty = true;
      this.resourcesDirty = true;
    }
  }

  markQuestsDirty(): void {
    this.questDirty = true;
  }

  markResourcesDirty(): void {
    this.resourcesDirty = true;
  }

  showSaving(): void {
    this.saveEl.classList.remove('show');
    void this.saveEl.offsetWidth;
    this.saveEl.classList.add('show');
  }

  setLockHint(visible: boolean): void {
    this.lockHint.classList.toggle('hidden', !visible);
  }

  update(dt: number): void {
    const g = this.game;

    // Barras (todo quadro: são baratas).
    const prog = g.progression;
    this.levelEl.textContent = String(prog.level);
    this.xpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, prog.progress))})`;
    this.xpLabel.textContent = `XP ${prog.xpIntoLevel}/${prog.xpForNext}`;
    const p = g.player;
    this.energyFill.style.transform = `scaleX(${p.energy / p.maxEnergy})`;
    this.energyLabel.textContent = `Energia ${Math.round(p.energy)}`;
    this.hungerFill.style.transform = `scaleX(${p.hunger / 100})`;
    this.hungerLabel.textContent = p.hunger <= 0 ? 'Faminto!' : `Saciedade ${Math.round(p.hunger)}`;
    this.hungerFill.parentElement!.classList.toggle('low', p.hunger < 25);
    this.energyFill.parentElement!.classList.toggle('low', p.energy < 20);

    // Atualizações mais lentas (4x por segundo).
    this.slowTimer -= dt;
    if (this.slowTimer <= 0) {
      this.slowTimer = 0.25;
      const dn = g.world.dayNight;
      this.clockEl.textContent = `Dia ${dn.day} · ${dn.clockText()}`;
      const night = dn.isNight;
      if (night !== this.lastNight) {
        this.clockIcon.innerHTML = icon(night ? 'lua' : 'sol');
        this.lastNight = night;
      }
      const weather = g.world.weather.kind;
      if (weather !== this.lastWeather) {
        this.lastWeather = weather;
        this.weatherEl.classList.toggle('hidden', weather === 'limpo');
        if (weather !== 'limpo') this.weatherEl.innerHTML = icon(weather === 'nublado' ? 'nuvem' : weather);
        this.weatherEl.title = WEATHER_NAMES[weather];
        this.weatherEl.setAttribute('aria-label', WEATHER_NAMES[weather]);
      }
      this.regionEl.textContent = g.currentRegionName;
      this.regionEl.classList.toggle('hidden', !g.currentRegionName);
      if (p.buffTime > 0) {
        this.buffEl.classList.remove('hidden');
        const s = Math.ceil(p.buffTime);
        this.buffEl.querySelector('span')!.textContent = `Bem alimentado ${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
      } else {
        this.buffEl.classList.add('hidden');
      }
      this.updateTrackerDistance();
      this.fpsEl.classList.toggle('hidden', !g.settings.data.showFps);
      if (g.settings.data.showFps) this.fpsEl.textContent = `${Math.round(g.fps)} FPS`;
    }

    if (this.resourcesDirty) {
      this.resourcesDirty = false;
      this.renderResources();
    }
    if (this.questDirty) {
      this.questDirty = false;
      this.renderTracker();
    }

    this.updatePrompt();

    // Minimapa (10x por segundo).
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.1;
      // Na névoa o minimapa fica encoberto.
      const misty = g.world.weather.misty;
      this.minimapWrap.classList.toggle('fogged', misty);
      if (!misty) g.currentMap.drawMinimap(this.minimap, g.worldState, g.mapView());
    }
  }

  private renderResources(): void {
    const inv = this.game.inventory;
    this.resourcesEl.innerHTML = HUD_RESOURCES.map((id) => {
      const n = inv.count(id);
      return `<div class="res-chip ${n === 0 ? 'empty' : ''}" title="${ITEMS[id].name}">${icon(ITEMS[id].icon)}<span>${n}</span></div>`;
    }).join('');
  }

  private renderTracker(): void {
    const quests = this.game.quests;
    const quest = quests.tracked;
    if (!quest) {
      this.trackerEl.innerHTML = quests.allCompleted
        ? `<div class="qt-title">${icon('estrela')} Todas as missões concluídas!</div>`
        : '';
      return;
    }
    const objectives = quests
      .objectives(quest)
      .map(
        (o) => `
        <li class="${o.done ? 'done' : ''}">
          <span class="qt-check">${o.done ? icon('check') : ''}</span>
          <span class="qt-text">${escapeHtml(o.text)}</span>
          ${o.required > 1 ? `<span class="qt-count">${o.current}/${o.required}</span>` : ''}
        </li>`,
      )
      .join('');
    this.trackerEl.innerHTML = `
      <div class="qt-title">${icon('missao')}<span>${escapeHtml(quest.title)}</span></div>
      <ul>${objectives}</ul>
      <div class="qt-distance hidden">${icon('alvo')}<span></span></div>`;
    this.updateTrackerDistance();
  }

  private updateTrackerDistance(): void {
    const el = this.trackerEl.querySelector('.qt-distance');
    if (!el) return;
    const target = this.game.questTarget();
    if (!target) {
      el.classList.add('hidden');
      return;
    }
    const p = this.game.player.position;
    const d = Math.round(Math.hypot(target.x - p.x, target.z - p.z));
    el.classList.toggle('hidden', d < 4);
    el.querySelector('span')!.textContent = `${d} m`;
  }

  private updatePrompt(): void {
    const g = this.game;
    let text = '';
    let cls = '';
    const touch = g.controlMode === 'touch';
    if (g.building.mode === 'place' && g.building.placingType) {
      const def = STRUCTURES[g.building.placingType];
      const check = g.building.ghostCheck;
      this.buildEl.classList.remove('hidden');
      const keys = touch
        ? ''
        : `<span class="keys"><kbd>${escapeHtml(this.rotateKey)}</kbd> girar · <kbd>${escapeHtml(this.interactKey)}</kbd>/clique construir · <kbd>Esc</kbd> cancelar</span>`;
      this.buildEl.innerHTML = `${icon(def.icon)}<b>${escapeHtml(def.name)}</b>${keys}`;
      text = check.ok ? 'Local válido' : (check.reason ?? 'Local inválido');
      cls = check.ok ? 'ok' : 'blocked';
    } else if (g.building.mode === 'remove') {
      this.buildEl.classList.remove('hidden');
      this.buildEl.innerHTML = `${icon('remover')}<b>Remover construções</b>${touch ? '' : '<span class="keys"><kbd>Esc</kbd> sair</span>'}`;
      const action = g.interaction.currentAction;
      text = action ? `${touch ? '' : '[E] '}${action.label}` : 'Aponte para uma construção';
      cls = action ? '' : 'muted';
    } else {
      this.buildEl.classList.add('hidden');
      const action = g.interaction.currentAction;
      if (g.boatCtl.active && g.isPlaying) {
        text = touch ? 'Joystick conduz o barco' : '[E] Desembarcar · frente/trás: velocidade · lados: direção';
        cls = 'muted';
      } else if (g.fishing.active && g.isPlaying) {
        const bite = g.fishing.state === 'bite';
        text = bite && !touch ? '[E] Puxe agora!' : g.fishing.prompt;
        cls = bite ? 'ok' : 'muted';
      } else if (action && g.isPlaying) {
        if (action.enabled) {
          text = touch ? action.label : `[E] ${action.label}`;
        } else {
          text = `${action.label} — ${action.reason ?? 'indisponível'}`;
          cls = 'blocked';
        }
      }
    }
    const key = `${text}|${cls}`;
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    const hideOnTouch = touch && g.building.mode === 'none' && !g.fishing.active && !g.boatCtl.active;
    this.promptEl.className = `prompt ${cls} ${!text || hideOnTouch ? 'hidden' : ''}`;
    // "[E] " marca o lugar da tecla de interagir (que o jogador pode ter trocado).
    this.promptEl.innerHTML = text.startsWith('[E] ') ? `<kbd>${escapeHtml(this.interactKey)}</kbd>${escapeHtml(text.slice(4))}` : escapeHtml(text);
  }
}
