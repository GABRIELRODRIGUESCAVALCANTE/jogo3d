/**
 * Colisão simples no plano horizontal (XZ).
 *
 * Os obstáculos são círculos (troncos, pedras, pilares) ou caixas giradas
 * (paredes, bancada). Cada um tem uma altura de topo: se o jogador estiver
 * acima do topo, ele pode ficar de pé em cima (pedras, pisos, degraus).
 * Uma grade espacial evita testar todos os obstáculos a cada quadro.
 */

export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  /** Altura do topo (o jogador pode subir em cima se estiver acima). */
  top: number;
  /** Base do obstáculo (abaixo disso ele não bloqueia; útil para tetos). */
  bottom?: number;
  tag?: string;
  /** Bloqueia a câmera (paredes e rochas grandes; árvores comuns não). */
  camera?: boolean;
}

export interface BoxCollider {
  kind: 'box';
  x: number;
  z: number;
  /** Metade da largura (eixo X local) e da profundidade (eixo Z local). */
  hw: number;
  hd: number;
  rot: number;
  top: number;
  bottom?: number;
  tag?: string;
  camera?: boolean;
}

export type Collider = CircleCollider | BoxCollider;

const CELL = 8;

export class CollisionWorld {
  private grid = new Map<number, Collider[]>();
  private cellsOf = new Map<Collider, number[]>();

  add(c: Collider): Collider {
    const keys = this.cellKeys(c);
    this.cellsOf.set(c, keys);
    for (const k of keys) {
      let list = this.grid.get(k);
      if (!list) {
        list = [];
        this.grid.set(k, list);
      }
      list.push(c);
    }
    return c;
  }

  remove(c: Collider): void {
    const keys = this.cellsOf.get(c);
    if (!keys) return;
    for (const k of keys) {
      const list = this.grid.get(k);
      if (!list) continue;
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    this.cellsOf.delete(c);
  }

  clear(): void {
    this.grid.clear();
    this.cellsOf.clear();
  }

  /** Obstáculos próximos de um ponto. */
  query(x: number, z: number, radius: number, out: Collider[] = []): Collider[] {
    out.length = 0;
    const seen = new Set<Collider>();
    const minX = Math.floor((x - radius) / CELL);
    const maxX = Math.floor((x + radius) / CELL);
    const minZ = Math.floor((z - radius) / CELL);
    const maxZ = Math.floor((z + radius) / CELL);
    for (let gz = minZ; gz <= maxZ; gz++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const list = this.grid.get(this.key(gx, gz));
        if (!list) continue;
        for (const c of list) {
          if (!seen.has(c)) {
            seen.add(c);
            out.push(c);
          }
        }
      }
    }
    return out;
  }

  /**
   * Empurra um círculo (o jogador) para fora dos obstáculos.
   * Retorna a altura do "chão" fornecida por obstáculos em que ele pode
   * pisar (ou -Infinity se nenhum).
   */
  resolve(pos: { x: number; y: number; z: number }, radius: number, height: number, stepHeight: number): number {
    let support = -Infinity;
    const nearby = this.query(pos.x, pos.z, radius + 6);
    for (let iteration = 0; iteration < 2; iteration++) {
      for (const c of nearby) {
        const bottom = c.bottom ?? -Infinity;
        if (pos.y + height < bottom) continue; // passa por baixo
        const canStand = pos.y >= c.top - stepHeight;
        if (c.kind === 'circle') {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const d = Math.hypot(dx, dz);
          if (canStand) {
            if (d < c.r) support = Math.max(support, c.top);
            continue;
          }
          const min = c.r + radius;
          if (d < min) {
            const nx = d > 1e-5 ? dx / d : 1;
            const nz = d > 1e-5 ? dz / d : 0;
            pos.x = c.x + nx * min;
            pos.z = c.z + nz * min;
          }
        } else {
          // Converte o ponto para o espaço local da caixa.
          const cos = Math.cos(c.rot);
          const sin = Math.sin(c.rot);
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const lx = dx * cos - dz * sin;
          const lz = dx * sin + dz * cos;
          if (canStand) {
            if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd) support = Math.max(support, c.top);
            continue;
          }
          const cx = Math.max(-c.hw, Math.min(c.hw, lx));
          const cz = Math.max(-c.hd, Math.min(c.hd, lz));
          let px = lx - cx;
          let pz = lz - cz;
          let d = Math.hypot(px, pz);
          let nlx: number;
          let nlz: number;
          if (d < 1e-5) {
            // Centro dentro da caixa: sai pelo lado mais próximo.
            const ex = c.hw - Math.abs(lx);
            const ez = c.hd - Math.abs(lz);
            if (ex < ez) {
              nlx = Math.sign(lx) || 1;
              nlz = 0;
              d = -ex;
            } else {
              nlx = 0;
              nlz = Math.sign(lz) || 1;
              d = -ez;
            }
            px = nlx;
            pz = nlz;
          } else {
            nlx = px / d;
            nlz = pz / d;
          }
          if (d < radius) {
            const push = radius - d;
            const fx = lx + nlx * push;
            const fz = lz + nlz * push;
            // Volta para o espaço do mundo (rotação inversa).
            pos.x = c.x + fx * cos + fz * sin;
            pos.z = c.z - fx * sin + fz * cos;
          }
        }
      }
    }
    return support;
  }

  /** Verifica se uma caixa girada encosta em algum obstáculo (para construções). */
  overlapsBox(x: number, z: number, hw: number, hd: number, rot: number, ignore?: (c: Collider) => boolean): boolean {
    const nearby = this.query(x, z, Math.hypot(hw, hd) + 4);
    for (const c of nearby) {
      if (ignore?.(c)) continue;
      if (c.kind === 'circle') {
        if (circleOverlapsBox(c.x, c.z, c.r, x, z, hw, hd, rot)) return true;
      } else if (boxesOverlap(c, { x, z, hw, hd, rot })) {
        return true;
      }
    }
    return false;
  }

  /** Verdadeiro se o ponto está dentro de um obstáculo que bloqueia a câmera. */
  blocksCamera(x: number, y: number, z: number): boolean {
    for (const c of this.query(x, z, 0.5, this.cameraScratch)) {
      if (!c.camera || y > c.top || y < (c.bottom ?? -Infinity)) continue;
      if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r : circleOverlapsBox(x, z, 0.15, c.x, c.z, c.hw, c.hd, c.rot)) {
        return true;
      }
    }
    return false;
  }

  private cameraScratch: Collider[] = [];

  /** Lança um "raio" horizontal e verifica se bate em algo (para a câmera). */
  segmentBlocked(ax: number, az: number, bx: number, bz: number, y: number): boolean {
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      for (const c of this.query(px, pz, 0.5)) {
        if (y > c.top || y < (c.bottom ?? -Infinity)) continue;
        if (c.kind === 'circle' && Math.hypot(px - c.x, pz - c.z) < c.r) return true;
        if (c.kind === 'box' && circleOverlapsBox(px, pz, 0.01, c.x, c.z, c.hw, c.hd, c.rot)) return true;
      }
    }
    return false;
  }

  private key(gx: number, gz: number): number {
    return (gx + 1000) * 4000 + (gz + 1000);
  }

  private cellKeys(c: Collider): number[] {
    const r = c.kind === 'circle' ? c.r : Math.hypot(c.hw, c.hd);
    const keys: number[] = [];
    for (let gz = Math.floor((c.z - r) / CELL); gz <= Math.floor((c.z + r) / CELL); gz++) {
      for (let gx = Math.floor((c.x - r) / CELL); gx <= Math.floor((c.x + r) / CELL); gx++) {
        keys.push(this.key(gx, gz));
      }
    }
    return keys;
  }
}

/** Círculo x caixa girada. */
export function circleOverlapsBox(
  px: number,
  pz: number,
  r: number,
  bx: number,
  bz: number,
  hw: number,
  hd: number,
  rot: number,
): boolean {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const dx = px - bx;
  const dz = pz - bz;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const cx = Math.max(-hw, Math.min(hw, lx));
  const cz = Math.max(-hd, Math.min(hd, lz));
  return Math.hypot(lx - cx, lz - cz) < r;
}

/** Caixa girada x caixa girada (teorema dos eixos separadores em 2D). */
export function boxesOverlap(
  a: { x: number; z: number; hw: number; hd: number; rot: number },
  b: { x: number; z: number; hw: number; hd: number; rot: number },
): boolean {
  const corners = (o: typeof a) => {
    const cos = Math.cos(o.rot);
    const sin = Math.sin(o.rot);
    // Eixos locais no mundo (inverso da rotação usada acima).
    const ax = { x: cos, z: -sin };
    const az = { x: sin, z: cos };
    return {
      axes: [ax, az],
      points: [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sz]) => ({
        x: o.x + ax.x * o.hw * sx + az.x * o.hd * sz,
        z: o.z + ax.z * o.hw * sx + az.z * o.hd * sz,
      })),
    };
  };
  const ca = corners(a);
  const cb = corners(b);
  for (const axis of [...ca.axes, ...cb.axes]) {
    const project = (pts: Array<{ x: number; z: number }>) => {
      let min = Infinity;
      let max = -Infinity;
      for (const p of pts) {
        const v = p.x * axis.x + p.z * axis.z;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      return [min, max];
    };
    const [aMin, aMax] = project(ca.points);
    const [bMin, bMax] = project(cb.points);
    if (aMax < bMin || bMax < aMin) return false;
  }
  return true;
}
