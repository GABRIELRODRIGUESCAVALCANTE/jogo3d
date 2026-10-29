/**
 * Estado geral do mundo: marcadores de eventos (baús abertos, portal ativo...),
 * regiões descobertas e a "névoa" do mapa de exploração.
 */
import type { GameEventBus } from './events';
import { REGIONS, type RegionId } from './data/regions';
import { WORLD_HALF, WORLD_SIZE } from './world/layout';

/** Resolução da grade de exploração (células por lado). */
export const EXPLORE_RES = 90;
const CELL = WORLD_SIZE / EXPLORE_RES;

export class WorldState {
  readonly flags = new Set<string>();
  readonly discovered = new Set<RegionId>();
  readonly explored = new Uint8Array(EXPLORE_RES * EXPLORE_RES);
  /** Incrementado sempre que a névoa muda (para o mapa redesenhar). */
  exploredVersion = 0;

  constructor(private readonly bus: GameEventBus) {}

  reset(): void {
    this.flags.clear();
    this.discovered.clear();
    this.explored.fill(0);
    this.exploredVersion++;
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  setFlag(flag: string): void {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    this.bus.emit('flag:set', { flag });
  }

  /** Marca uma região como descoberta. Retorna verdadeiro se era nova. */
  discover(id: RegionId): boolean {
    if (this.discovered.has(id)) return false;
    this.discovered.add(id);
    this.bus.emit('region:discovered', { regionId: id });
    return true;
  }

  /** Revela a névoa do mapa ao redor de um ponto. */
  reveal(x: number, z: number, radius: number): boolean {
    const r = Math.ceil(radius / CELL);
    const cx = Math.floor((x + WORLD_HALF) / CELL);
    const cz = Math.floor((z + WORLD_HALF) / CELL);
    let changed = false;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx;
        const gz = cz + dz;
        if (gx < 0 || gz < 0 || gx >= EXPLORE_RES || gz >= EXPLORE_RES) continue;
        if (dx * dx + dz * dz > r * r) continue;
        const idx = gz * EXPLORE_RES + gx;
        if (!this.explored[idx]) {
          this.explored[idx] = 1;
          changed = true;
        }
      }
    }
    if (changed) this.exploredVersion++;
    return changed;
  }

  isExplored(x: number, z: number): boolean {
    const gx = Math.floor((x + WORLD_HALF) / CELL);
    const gz = Math.floor((z + WORLD_HALF) / CELL);
    if (gx < 0 || gz < 0 || gx >= EXPLORE_RES || gz >= EXPLORE_RES) return false;
    return this.explored[gz * EXPLORE_RES + gx] === 1;
  }

  get exploredPercent(): number {
    let n = 0;
    for (const v of this.explored) n += v;
    return n / this.explored.length;
  }

  // --- Serialização: a grade vira texto base64 compacto (bits) ---

  exploredToBase64(): string {
    const bytes = new Uint8Array(Math.ceil(this.explored.length / 8));
    for (let i = 0; i < this.explored.length; i++) {
      if (this.explored[i]) bytes[i >> 3] |= 1 << (i & 7);
    }
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  exploredFromBase64(text: string | undefined): void {
    this.explored.fill(0);
    if (text) {
      try {
        const binary = atob(text);
        for (let i = 0; i < this.explored.length; i++) {
          const byte = binary.charCodeAt(i >> 3) || 0;
          this.explored[i] = (byte >> (i & 7)) & 1;
        }
      } catch {
        console.warn('[WorldState] mapa de exploração inválido; recomeçando a névoa.');
      }
    }
    this.exploredVersion++;
  }

  load(data: { flags?: string[]; regions?: string[]; explored?: string }): void {
    this.flags.clear();
    for (const f of data.flags ?? []) this.flags.add(f);
    this.discovered.clear();
    const valid = new Set(REGIONS.map((r) => r.id));
    for (const r of data.regions ?? []) if (valid.has(r as RegionId)) this.discovered.add(r as RegionId);
    this.exploredFromBase64(data.explored);
  }
}
