/**
 * Estado geral do mundo: marcadores de eventos (baús abertos, portal ativo...),
 * regiões descobertas e a "névoa" do mapa de exploração (uma grade por ilha).
 */
import type { GameEventBus } from './events';
import { REGIONS, type RegionId } from './data/regions';
import { AURORA_ISLAND, ECO_ISLAND, MAIN_ISLAND } from './world/islands';
import type { IslandId, IslandShape } from './world/Terrain';

/** Resolução da grade de exploração da ilha principal (células por lado). */
export const EXPLORE_RES = 90;

/** Grade de exploração de uma ilha (cada célula: 0 = névoa, 1 = explorada). */
export interface ExploreGrid {
  island: IslandId;
  cx: number;
  cz: number;
  size: number;
  res: number;
  data: Uint8Array;
}

function grid(shape: IslandShape, res: number): ExploreGrid {
  return { island: shape.id, cx: shape.cx, cz: shape.cz, size: shape.size, res, data: new Uint8Array(res * res) };
}

export class WorldState {
  readonly flags = new Set<string>();
  readonly discovered = new Set<RegionId>();
  readonly grids: Record<IslandId, ExploreGrid> = {
    principal: grid(MAIN_ISLAND, EXPLORE_RES),
    aurora: grid(AURORA_ISLAND, 70),
    eco: grid(ECO_ISLAND, 64),
  };
  /** Incrementado sempre que a névoa muda (para o mapa redesenhar). */
  exploredVersion = 0;

  constructor(private readonly bus: GameEventBus) {}

  /** Grade da ilha principal (compatível com a primeira versão). */
  get explored(): Uint8Array {
    return this.grids.principal.data;
  }

  reset(): void {
    this.flags.clear();
    this.discovered.clear();
    for (const g of Object.values(this.grids)) g.data.fill(0);
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

  /** Grade que cobre um ponto (ou null em mar aberto). */
  gridAt(x: number, z: number): ExploreGrid | null {
    for (const g of Object.values(this.grids)) {
      if (Math.abs(x - g.cx) < g.size / 2 && Math.abs(z - g.cz) < g.size / 2) return g;
    }
    return null;
  }

  /** Revela a névoa do mapa ao redor de um ponto. */
  reveal(x: number, z: number, radius: number): boolean {
    const g = this.gridAt(x, z);
    if (!g) return false;
    const cell = g.size / g.res;
    const r = Math.ceil(radius / cell);
    const cx = Math.floor((x - g.cx + g.size / 2) / cell);
    const cz = Math.floor((z - g.cz + g.size / 2) / cell);
    let changed = false;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx;
        const gz = cz + dz;
        if (gx < 0 || gz < 0 || gx >= g.res || gz >= g.res) continue;
        if (dx * dx + dz * dz > r * r) continue;
        const idx = gz * g.res + gx;
        if (!g.data[idx]) {
          g.data[idx] = 1;
          changed = true;
        }
      }
    }
    if (changed) this.exploredVersion++;
    return changed;
  }

  isExplored(x: number, z: number): boolean {
    const g = this.gridAt(x, z);
    if (!g) return false;
    const cell = g.size / g.res;
    const gx = Math.floor((x - g.cx + g.size / 2) / cell);
    const gz = Math.floor((z - g.cz + g.size / 2) / cell);
    if (gx < 0 || gz < 0 || gx >= g.res || gz >= g.res) return false;
    return g.data[gz * g.res + gx] === 1;
  }

  /** Fração explorada de uma ilha (padrão: a principal). */
  exploredFraction(island: IslandId = 'principal'): number {
    const data = this.grids[island].data;
    let n = 0;
    for (const v of data) n += v;
    return n / data.length;
  }

  get exploredPercent(): number {
    return this.exploredFraction('principal');
  }

  // --- Serialização: cada grade vira texto base64 compacto (bits) ---

  exploredToBase64(island: IslandId = 'principal'): string {
    const data = this.grids[island].data;
    const bytes = new Uint8Array(Math.ceil(data.length / 8));
    for (let i = 0; i < data.length; i++) {
      if (data[i]) bytes[i >> 3] |= 1 << (i & 7);
    }
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  exploredFromBase64(text: string | undefined, island: IslandId = 'principal'): void {
    const data = this.grids[island].data;
    data.fill(0);
    if (text) {
      try {
        const binary = atob(text);
        for (let i = 0; i < data.length; i++) {
          const byte = binary.charCodeAt(i >> 3) || 0;
          data[i] = (byte >> (i & 7)) & 1;
        }
      } catch {
        console.warn('[WorldState] mapa de exploração inválido; recomeçando a névoa.');
      }
    }
    this.exploredVersion++;
  }

  load(data: { flags?: string[]; regions?: string[]; explored?: string; exploredAurora?: string; exploredEco?: string }): void {
    this.flags.clear();
    for (const f of data.flags ?? []) this.flags.add(f);
    this.discovered.clear();
    const valid = new Set(REGIONS.map((r) => r.id));
    for (const r of data.regions ?? []) if (valid.has(r as RegionId)) this.discovered.add(r as RegionId);
    this.exploredFromBase64(data.explored, 'principal');
    this.exploredFromBase64(data.exploredAurora, 'aurora');
    this.exploredFromBase64(data.exploredEco, 'eco');
  }
}
