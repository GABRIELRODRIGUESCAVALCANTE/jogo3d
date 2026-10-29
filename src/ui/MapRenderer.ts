/**
 * Desenha o mapa da ilha em 2D a partir do relevo do terreno.
 * Áreas não exploradas ficam cobertas por uma "névoa" cor de pergaminho.
 * Usado tanto pelo minimapa do HUD quanto pelo mapa grande.
 */
import { EXPLORE_RES, type WorldState } from '../game/WorldState';
import type { Terrain } from '../game/world/Terrain';
import { WATER_LEVEL, WORLD_HALF, WORLD_SIZE, distanceToPaths } from '../game/world/layout';

export interface MapMarker {
  x: number;
  z: number;
  type: 'quest' | 'structure' | 'landmark' | 'chest';
  label?: string;
}

export interface MapView {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  cameraYaw: number;
  markers: MapMarker[];
}

const SIZE = WORLD_SIZE; // 1 pixel = 1 metro
const FOG = [233, 220, 192];

export class MapRenderer {
  private readonly base = document.createElement('canvas');
  private readonly composed = document.createElement('canvas');
  private readonly fog = document.createElement('canvas');
  private version = -1;

  constructor(terrain: Terrain) {
    for (const c of [this.base, this.composed]) {
      c.width = SIZE;
      c.height = SIZE;
    }
    this.fog.width = EXPLORE_RES;
    this.fog.height = EXPLORE_RES;
    this.renderBase(terrain);
  }

  /** Pinta o relevo uma única vez (com sombreamento para dar volume). */
  private renderBase(terrain: Terrain): void {
    const ctx = this.base.getContext('2d')!;
    const img = ctx.createImageData(SIZE, SIZE);
    const data = img.data;
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const x = px - WORLD_HALF + 0.5;
        const z = py - WORLD_HALF + 0.5;
        const h = terrain.getHeight(x, z);
        let r: number;
        let g: number;
        let b: number;
        if (h < WATER_LEVEL) {
          const depth = Math.min(1, (WATER_LEVEL - h) / 8);
          r = 95 - depth * 70;
          g = 210 - depth * 110;
          b = 220 - depth * 40;
        } else if (h < 1.5) {
          [r, g, b] = [240, 222, 168];
        } else if (h > 34) {
          [r, g, b] = [240, 244, 250];
        } else if (h > 20) {
          [r, g, b] = [150, 145, 138];
        } else {
          const t = Math.min(1, (h - 1.5) / 18);
          r = 120 - t * 50;
          g = 200 - t * 60;
          b = 85 - t * 20;
          if (distanceToPaths(x, z) < 1.8) [r, g, b] = [205, 170, 115];
        }
        // Sombreamento: compara com a altura a noroeste.
        const shade = h > WATER_LEVEL ? (h - terrain.getHeight(x - 1.5, z - 1.5)) * 18 : 0;
        const i = (py * SIZE + px) * 4;
        data[i] = Math.max(0, Math.min(255, r + shade));
        data[i + 1] = Math.max(0, Math.min(255, g + shade));
        data[i + 2] = Math.max(0, Math.min(255, b + shade));
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Recompõe mapa + névoa quando a exploração muda. */
  private compose(state: WorldState): void {
    if (state.exploredVersion === this.version) return;
    this.version = state.exploredVersion;
    const fctx = this.fog.getContext('2d')!;
    const img = fctx.createImageData(EXPLORE_RES, EXPLORE_RES);
    for (let i = 0; i < state.explored.length; i++) {
      img.data[i * 4] = FOG[0];
      img.data[i * 4 + 1] = FOG[1];
      img.data[i * 4 + 2] = FOG[2];
      // A névoa deixa ver levemente o contorno da ilha, mas esconde os detalhes.
      img.data[i * 4 + 3] = state.explored[i] ? 0 : 228;
    }
    fctx.putImageData(img, 0, 0);
    const ctx = this.composed.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this.base, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fog, 0, 0, SIZE, SIZE);
  }

  /** Minimapa circular que gira junto com a câmera. */
  drawMinimap(canvas: HTMLCanvasElement, state: WorldState, view: MapView, radiusMeters = 55): void {
    this.compose(state);
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const scale = w / 2 / radiusMeters;
    ctx.clearRect(0, 0, w, w);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = `rgb(${FOG.join(',')})`;
    ctx.fillRect(0, 0, w, w);
    ctx.translate(w / 2, w / 2);
    ctx.rotate(view.cameraYaw);
    ctx.scale(scale, scale);
    ctx.translate(-(view.playerX + WORLD_HALF), -(view.playerZ + WORLD_HALF));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.composed, 0, 0);
    // Marcadores (desenhados sem distorcer pelo zoom).
    for (const m of view.markers) {
      const mx = m.x + WORLD_HALF;
      const mz = m.z + WORLD_HALF;
      ctx.save();
      ctx.translate(mx, mz);
      ctx.rotate(-view.cameraYaw);
      ctx.scale(1 / scale, 1 / scale);
      this.drawMarker(ctx, m, w / 140);
      ctx.restore();
    }
    ctx.restore();

    // Objetivo fora do minimapa: seta na borda.
    const quest = view.markers.find((m) => m.type === 'quest');
    if (quest) {
      const dx = quest.x - view.playerX;
      const dz = quest.z - view.playerZ;
      const dist = Math.hypot(dx, dz);
      if (dist > radiusMeters * 0.92) {
        const c = Math.cos(view.cameraYaw);
        const s = Math.sin(view.cameraYaw);
        const rx = dx * c - dz * s;
        const rz = dx * s + dz * c;
        const a = Math.atan2(rz, rx);
        const edge = w / 2 - 9;
        ctx.save();
        ctx.translate(w / 2 + Math.cos(a) * edge, w / 2 + Math.sin(a) * edge);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#5a3d00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(6, 5);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // "N" na borda indicando o norte (o minimapa gira com a câmera).
    const nx = Math.sin(view.cameraYaw);
    const ny = -Math.cos(view.cameraYaw);
    ctx.save();
    ctx.font = `700 ${Math.round(w / 12)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = '#ff6b6b';
    const nr = w / 2 - w / 14;
    ctx.strokeText('N', w / 2 + nx * nr, w / 2 + ny * nr);
    ctx.fillText('N', w / 2 + nx * nr, w / 2 + ny * nr);
    ctx.restore();

    // Jogador no centro.
    ctx.save();
    ctx.translate(w / 2, w / 2);
    ctx.rotate(view.cameraYaw + Math.PI - view.playerYaw);
    this.drawPlayerArrow(ctx, w / 140);
    ctx.restore();
  }

  /** Mapa completo (norte para cima). */
  drawFull(
    canvas: HTMLCanvasElement,
    state: WorldState,
    view: MapView,
    labels: Array<{ x: number; z: number; text: string }>,
  ): void {
    this.compose(state);
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const scale = Math.min(w, h) / SIZE;
    const ox = (w - SIZE * scale) / 2;
    const oy = (h - SIZE * scale) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgb(${FOG.join(',')})`;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.composed, ox, oy, SIZE * scale, SIZE * scale);
    const unit = Math.max(1, w / 360);

    const toScreen = (x: number, z: number) => [ox + (x + WORLD_HALF) * scale, oy + (z + WORLD_HALF) * scale];

    ctx.font = `700 ${Math.round(11 * unit)}px Fredoka, Nunito, sans-serif`;
    ctx.textAlign = 'center';
    for (const l of labels) {
      const [sx, sy] = toScreen(l.x, l.z);
      ctx.lineWidth = 3 * unit;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText(l.text, sx, sy);
      ctx.fillStyle = '#3b2f1e';
      ctx.fillText(l.text, sx, sy);
    }
    for (const m of view.markers) {
      const [sx, sy] = toScreen(m.x, m.z);
      ctx.save();
      ctx.translate(sx, sy);
      this.drawMarker(ctx, m, unit * 1.2);
      ctx.restore();
    }
    const [px, py] = toScreen(view.playerX, view.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - view.playerYaw);
    this.drawPlayerArrow(ctx, unit * 1.3);
    ctx.restore();

    // Rosa dos ventos.
    ctx.save();
    ctx.translate(w - 28 * unit, 30 * unit);
    ctx.fillStyle = 'rgba(30,40,50,0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, 16 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(0, -12 * unit);
    ctx.lineTo(5 * unit, 0);
    ctx.lineTo(-5 * unit, 0);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(9 * unit)}px Fredoka, sans-serif`;
    ctx.fillText('N', 0, 10 * unit);
    ctx.restore();
  }

  private drawPlayerArrow(ctx: CanvasRenderingContext2D, unit: number): void {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff6b3d';
    ctx.lineWidth = 2.2 * unit;
    ctx.beginPath();
    ctx.moveTo(0, -8 * unit);
    ctx.lineTo(6 * unit, 6 * unit);
    ctx.lineTo(0, 3 * unit);
    ctx.lineTo(-6 * unit, 6 * unit);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  private drawMarker(ctx: CanvasRenderingContext2D, m: MapMarker, unit: number): void {
    switch (m.type) {
      case 'quest': {
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#7a5200';
        ctx.lineWidth = 1.5 * unit;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = (i % 2 === 0 ? 7 : 3) * unit;
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'structure':
        ctx.fillStyle = '#c9573c';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2 * unit;
        ctx.fillRect(-3.5 * unit, -3.5 * unit, 7 * unit, 7 * unit);
        ctx.strokeRect(-3.5 * unit, -3.5 * unit, 7 * unit, 7 * unit);
        break;
      case 'chest':
        ctx.fillStyle = '#e0b44c';
        ctx.strokeStyle = '#5a3b1e';
        ctx.lineWidth = 1.2 * unit;
        ctx.fillRect(-4 * unit, -3 * unit, 8 * unit, 6 * unit);
        ctx.strokeRect(-4 * unit, -3 * unit, 8 * unit, 6 * unit);
        break;
      case 'landmark':
        ctx.fillStyle = '#5ee8ff';
        ctx.strokeStyle = '#1b4b5c';
        ctx.lineWidth = 1.5 * unit;
        ctx.beginPath();
        ctx.moveTo(0, -6 * unit);
        ctx.lineTo(5 * unit, 0);
        ctx.lineTo(0, 6 * unit);
        ctx.lineTo(-5 * unit, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
  }
}
