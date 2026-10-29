/**
 * Mapa de exploração: mostra as áreas descobertas, regiões, construções
 * e o objetivo da missão atual.
 */
import type { Game } from '../../game/Game';
import { REGIONS } from '../../game/data/regions';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

export class MapPanel extends Panel {
  private canvas: HTMLCanvasElement | null = null;
  private timer = 0;

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
          <div class="map-stat">${icon('bussola')} Ilha explorada: <b>${Math.round(ws.exploredPercent * 100)}%</b></div>
          <div class="map-legend">
            <span><i class="lg lg-player"></i>Você</span>
            <span><i class="lg lg-quest"></i>Objetivo</span>
            <span><i class="lg lg-structure"></i>Construção</span>
            <span><i class="lg lg-landmark"></i>Local antigo</span>
            <span><i class="lg lg-chest"></i>Baú</span>
          </div>
        </aside>
      </div>`;
    this.canvas = this.body.querySelector('canvas');
    this.draw();
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      this.draw();
    }
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
    const labels = REGIONS.filter((r) => ws.discovered.has(r.id)).map((r) => ({ x: r.x, z: r.z, text: r.name }));
    this.game.mapRenderer.drawFull(canvas, ws, this.game.mapView(true), labels);
  }
}
