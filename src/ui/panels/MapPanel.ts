/**
 * Mapa de exploração: mostra as áreas descobertas, regiões, construções
 * e o objetivo da missão atual.
 */
import type { Game } from '../../game/Game';
import { REGIONS } from '../../game/data/regions';
import { PIN_COLORS } from '../MapRenderer';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

export class MapPanel extends Panel {
  private canvas: HTMLCanvasElement | null = null;
  private timer = 0;
  /** Cor escolhida para os próximos marcadores. */
  private pinColor = 0;

  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'mapa', 'Mapa da Ilha', 'mapa', 'wide');
  }

  render(): void {
    const ws = this.game.worldState;
    const regions = REGIONS.map((r) => {
      const found = ws.discovered.has(r.id);
      return `<li class="${found ? 'found' : ''}">${found ? icon('check') : icon('info')}<span>${found ? escapeHtml(r.name) : '???'}</span></li>`;
    }).join('');
    this.body.innerHTML = `
      <div class="map-layout">
        <div class="map-canvas-wrap"><canvas class="map-canvas"></canvas></div>
        <aside class="map-side">
          <h3>Regiões descobertas</h3>
          <ul class="region-list">${regions}</ul>
          ${this.game.world.weather.misty ? `<div class="map-stat map-mist">${icon('nuvem')} Névoa densa: você não sabe onde está. Siga a trilha ou espere o amanhecer.</div>` : ''}
          <div class="map-stat">${icon('bussola')} Ilha explorada: <b>${Math.round(ws.exploredFraction(this.game.currentMap.island) * 100)}%</b></div>
          <h3>Seus marcadores</h3>
          <p class="map-hint">Toque ou clique no mapa para marcar um lugar; toque num marcador para tirar.</p>
          <div class="pin-colors" role="radiogroup" aria-label="Cor do marcador">
            ${PIN_COLORS.map(
              (c, i) =>
                `<button class="pin-color ${i === this.pinColor ? 'active' : ''}" data-pin-color="${i}" style="--pin:${c}" role="radio" aria-checked="${i === this.pinColor}" aria-label="Cor ${i + 1}"></button>`,
            ).join('')}
            <button class="btn btn-ghost btn-small" data-pin-clear ${this.game.pins.length ? '' : 'disabled'}>Limpar (${this.game.pins.length})</button>
          </div>
          <div class="map-legend">
            <span><i class="lg lg-player"></i>Você</span>
            <span><i class="lg lg-quest"></i>Objetivo</span>
            <span><i class="lg lg-structure"></i>Construção</span>
            <span><i class="lg lg-landmark"></i>Local antigo</span>
            <span><i class="lg lg-chest"></i>Baú</span>
            <span><i class="lg lg-pin"></i>Seu marcador</span>
          </div>
        </aside>
      </div>`;
    this.canvas = this.body.querySelector('canvas');
    this.canvas!.addEventListener('click', (e) => this.onMapClick(e));
    this.body.querySelectorAll<HTMLElement>('[data-pin-color]').forEach((b) =>
      b.addEventListener('click', () => {
        this.pinColor = Number(b.dataset.pinColor);
        this.render();
      }),
    );
    this.body.querySelector('[data-pin-clear]')?.addEventListener('click', () => {
      this.game.clearMapPins();
      this.render();
    });
    this.draw();
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      this.draw();
    }
  }

  private onMapClick(e: MouseEvent): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const map = this.game.currentMap;
    const { x, z } = map.screenToWorld(canvas, px, py);
    if (!map.covers(x, z)) return;
    // Raio de toque: uns 14 pixels de tela (fácil de acertar no celular).
    const radius = map.metersPerPixel(canvas) * (canvas.width / rect.width) * 14;
    this.game.toggleMapPin(x, z, this.pinColor, radius);
    // Só atualiza o botão e o desenho: refazer o painel inteiro poderia mexer
    // no tamanho do mapa entre um toque e outro.
    const clear = this.body.querySelector<HTMLButtonElement>('[data-pin-clear]');
    if (clear) {
      clear.textContent = `Limpar (${this.game.pins.length})`;
      clear.disabled = this.game.pins.length === 0;
    }
    this.draw();
  }

  private draw(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const size = Math.max(200, Math.floor(Math.min(rect.width, rect.height || rect.width)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    }
    const ws = this.game.worldState;
    const map = this.game.currentMap;
    const labels = REGIONS.filter((r) => ws.discovered.has(r.id) && map.covers(r.x, r.z)).map((r) => ({ x: r.x, z: r.z, text: r.name }));
    map.drawFull(canvas, ws, this.game.mapView(true), labels);
  }
}
