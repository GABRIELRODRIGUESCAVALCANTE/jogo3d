/**
 * Terreno da ilha.
 *
 * 1. Um mapa de alturas (heightfield) é calculado com ruído + formas fixas
 *    (praia ao sul, montanha ao norte, áreas aplainadas).
 * 2. A malha 3D é montada em pedaços (chunks) para que o Three.js descarte
 *    os pedaços fora da tela. No futuro, os chunks também permitem carregar
 *    o mundo aos poucos.
 * 3. `getHeight(x, z)` usa exatamente os mesmos triângulos da malha, então o
 *    personagem pisa sempre no chão visível.
 */
import * as THREE from 'three';
import { SimplexNoise2D } from '../../core/noise';
import { clamp, createRandom, lerp, smoothstep } from '../../core/math';
import { WATER_LEVEL, type FlattenZone } from './layout';
import { MAIN_ISLAND } from './islands';

/** Interface mínima de "altura do chão" usada por quase todos os sistemas. */
export interface HeightField {
  getHeight(x: number, z: number): number;
  getSlope(x: number, z: number): number;
}

export type IslandId = 'principal' | 'aurora';

/**
 * Descrição de uma ilha: onde fica, tamanho, resolução e a função que dá a
 * altura natural do terreno. Para criar uma ilha nova, basta outra IslandShape.
 */
export interface IslandShape {
  id: IslandId;
  name: string;
  /** Centro da ilha no mundo. */
  cx: number;
  cz: number;
  /** Lado do quadrado do terreno (metros) e número de células por lado. */
  size: number;
  segments: number;
  seed: number;
  /** Altura natural (coordenadas do mundo). */
  raw: (x: number, z: number, noise: SimplexNoise2D) => number;
  flatten: FlattenZone[];
  /** Distância até a trilha mais próxima (para pintar o chão de terra). */
  pathDistance?: (x: number, z: number) => number;
  /** Cor especial de um ponto (ex.: chão de pedra da caverna). */
  specialColor?: (x: number, z: number, out: THREE.Color) => boolean;
  /** Tons de grama próprios (ilhas com outra vegetação). */
  grass?: { light: string; mid: string; dark: string };
}

const CHUNKS_PER_SIDE = 4;

// Paleta do terreno (cores no espaço sRGB, como em um editor de imagem).
export const COLORS = {
  seabed: new THREE.Color('#d9c48f'),
  sandWet: new THREE.Color('#e3cf95'),
  sand: new THREE.Color('#f2dfa7'),
  grassLight: new THREE.Color('#8fd14f'),
  grass: new THREE.Color('#5cb848'),
  grassDark: new THREE.Color('#3f9a43'),
  path: new THREE.Color('#c9a46a'),
  rock: new THREE.Color('#8d8a84'),
  rockDark: new THREE.Color('#6f6c69'),
  snow: new THREE.Color('#f4f7fb'),
  plaza: new THREE.Color('#b8b0a0'),
};

export class Terrain implements HeightField {
  /** Alturas nos vértices da grade: (SEGMENTS + 1)². */
  readonly heights: Float32Array;
  readonly group = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  /** Verdadeiro depois que o mapa de alturas foi calculado. */
  ready = false;
  private readonly n: number;
  private readonly cell: number;
  private readonly half: number;
  private readonly noise: SimplexNoise2D;
  private readonly grass: { light: THREE.Color; mid: THREE.Color; dark: THREE.Color };
  private nextChunk = 0;

  constructor(readonly shape: IslandShape = MAIN_ISLAND) {
    this.n = shape.segments;
    this.cell = shape.size / shape.segments;
    this.half = shape.size / 2;
    this.noise = new SimplexNoise2D(createRandom(shape.seed));
    this.heights = new Float32Array((this.n + 1) * (this.n + 1));
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.group.name = `Terreno: ${shape.name}`;
    const g = shape.grass;
    this.grass = g
      ? { light: new THREE.Color(g.light), mid: new THREE.Color(g.mid), dark: new THREE.Color(g.dark) }
      : { light: COLORS.grassLight, mid: COLORS.grass, dark: COLORS.grassDark };
  }

  private get minX(): number {
    return this.shape.cx - this.half;
  }

  private get minZ(): number {
    return this.shape.cz - this.half;
  }

  /** O ponto está dentro do quadrado coberto por este terreno? */
  contains(x: number, z: number): boolean {
    return Math.abs(x - this.shape.cx) < this.half && Math.abs(z - this.shape.cz) < this.half;
  }

  /** Calcula o mapa de alturas (rápido; chamado uma vez). */
  generateHeights(): void {
    if (this.ready) return;
    const n = this.n;
    for (let iz = 0; iz <= n; iz++) {
      for (let ix = 0; ix <= n; ix++) {
        const x = this.minX + ix * this.cell;
        const z = this.minZ + iz * this.cell;
        this.heights[iz * (n + 1) + ix] = this.shapeHeight(x, z);
      }
    }
    this.ready = true;
  }

  /** Monta todas as malhas 3D de uma vez. */
  buildMeshes(): void {
    while (!this.buildNextChunk()) {
      /* continua */
    }
  }

  /**
   * Monta um único pedaço (chunk) da malha. Retorna verdadeiro quando todos
   * já foram montados. Chamado um por quadro, o terreno "aparece" aos poucos
   * sem travar o jogo — é assim que a segunda ilha é carregada sob demanda.
   */
  buildNextChunk(): boolean {
    const total = CHUNKS_PER_SIDE * CHUNKS_PER_SIDE;
    if (this.nextChunk >= total) return true;
    this.generateHeights();
    const per = this.n / CHUNKS_PER_SIDE;
    const cx = this.nextChunk % CHUNKS_PER_SIDE;
    const cz = Math.floor(this.nextChunk / CHUNKS_PER_SIDE);
    const geometry = this.buildChunkGeometry(cx * per, cz * per, per);
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.receiveShadow = true;
    mesh.name = `chunk_${cx}_${cz}`;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    this.nextChunk++;
    return this.nextChunk >= total;
  }

  get chunksDone(): boolean {
    return this.nextChunk >= CHUNKS_PER_SIDE * CHUNKS_PER_SIDE;
  }

  /** Altura do chão em qualquer ponto (interpolada nos triângulos da malha). */
  getHeight(x: number, z: number): number {
    const fx = (x - this.minX) / this.cell;
    const fz = (z - this.minZ) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.n || fz >= this.n) return -12;
    if (!this.ready) return this.shapeHeight(x, z);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const row = this.n + 1;
    const h00 = this.heights[iz * row + ix];
    const h10 = this.heights[iz * row + ix + 1];
    const h01 = this.heights[(iz + 1) * row + ix];
    const h11 = this.heights[(iz + 1) * row + ix + 1];
    // Cada célula tem dois triângulos divididos pela diagonal (00 -> 11).
    if (tx >= tz) return h00 + (h10 - h00) * tx + (h11 - h10) * tz;
    return h00 + (h11 - h01) * tx + (h01 - h00) * tz;
  }

  /** Inclinação aproximada (variação de altura por metro) em um ponto. */
  getSlope(x: number, z: number): number {
    const e = 0.8;
    const dx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const dz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  /** Vetor normal aproximado do terreno. */
  getNormal(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
    const e = 0.8;
    const dx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const dz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return target.set(-dx, 2 * e, -dz).normalize();
  }

  // ---------------------------------------------------------------------------
  // Forma da ilha
  // ---------------------------------------------------------------------------

  /** Altura final: forma natural + áreas aplainadas. */
  shapeHeight(x: number, z: number): number {
    const raw = (px: number, pz: number) => this.shape.raw(px, pz, this.noise);
    let h = raw(x, z);
    for (const zone of this.shape.flatten) {
      const dist = Math.hypot(x - zone.x, z - zone.z);
      if (dist >= zone.radius) continue;
      const target = zone.height ?? raw(zone.x, zone.z) + (zone.raise ?? 0);
      const w = 1 - smoothstep(zone.radius * 0.55, zone.radius, dist);
      h = lerp(h, target, w);
    }
    return h;
  }

  // ---------------------------------------------------------------------------
  // Malha
  // ---------------------------------------------------------------------------

  private buildChunkGeometry(startX: number, startZ: number, size: number): THREE.BufferGeometry {
    const row = this.n + 1;
    const triCount = size * size * 2;
    const positions = new Float32Array(triCount * 9);
    const colors = new Float32Array(triCount * 9);
    const random = createRandom(startX * 1000 + startZ + 7);
    const color = new THREE.Color();
    let p = 0;

    const pushTri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
      const ha = this.heights[az * row + ax];
      const hb = this.heights[bz * row + bx];
      const hc = this.heights[cz * row + cx];
      const verts = [
        [ax, az, ha],
        [bx, bz, hb],
        [cx, cz, hc],
      ];
      // Cor do triângulo inteiro (visual low-poly).
      const wx = this.minX + ((ax + bx + cx) / 3) * this.cell;
      const wz = this.minZ + ((az + bz + cz) / 3) * this.cell;
      const avgH = (ha + hb + hc) / 3;
      const slope = (Math.max(ha, hb, hc) - Math.min(ha, hb, hc)) / this.cell;
      this.colorFor(wx, wz, avgH, slope, random(), color);
      for (const [vx, vz, vh] of verts) {
        positions[p] = this.minX + vx * this.cell;
        positions[p + 1] = vh;
        positions[p + 2] = this.minZ + vz * this.cell;
        colors[p] = color.r;
        colors[p + 1] = color.g;
        colors[p + 2] = color.b;
        p += 3;
      }
    };

    for (let iz = startZ; iz < startZ + size; iz++) {
      for (let ix = startX; ix < startX + size; ix++) {
        // Mesma divisão usada em getHeight: diagonal de (ix,iz) até (ix+1,iz+1).
        pushTri(ix, iz, ix + 1, iz + 1, ix + 1, iz);
        pushTri(ix, iz, ix, iz + 1, ix + 1, iz + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }

  /** Escolhe a cor de um triângulo pela altura, inclinação e trilhas. */
  private colorFor(x: number, z: number, h: number, slope: number, rnd: number, out: THREE.Color): void {
    const variation = (rnd - 0.5) * 0.06;
    if (this.shape.specialColor?.(x, z, out)) {
      // Cor definida pela própria ilha (ex.: chão de pedra da caverna).
    } else if (h < WATER_LEVEL - 0.6) {
      out.copy(COLORS.seabed);
    } else if (h < WATER_LEVEL + 0.25) {
      out.copy(COLORS.sandWet);
    } else if (h < 1.5 && slope < 0.7) {
      out.copy(COLORS.sand);
    } else if (h > 34 && slope < 1.1) {
      out.copy(COLORS.snow);
    } else if (slope > 0.85 || h > 22) {
      out.copy(rnd > 0.5 ? COLORS.rock : COLORS.rockDark);
    } else {
      // Grama: mistura de tons conforme o ruído.
      const n = this.noise.noise(x * 0.05, z * 0.05) * 0.5 + 0.5;
      if (n > 0.62) out.copy(this.grass.dark);
      else if (n < 0.3) out.copy(this.grass.light);
      else out.copy(this.grass.mid);
      if (h < 1.9) out.lerp(COLORS.sand, 0.45);
      // Trilhas de terra.
      const dPath = this.shape.pathDistance?.(x, z) ?? Infinity;
      if (dPath < 2.2) out.lerp(COLORS.path, clamp(1.3 - dPath / 2.2, 0, 1));
    }
    out.offsetHSL(0, 0, variation);
  }
}

/**
 * Conjunto de todas as ilhas: responde a altura do chão em qualquer ponto do
 * mundo, perguntando à ilha certa. Uma ilha ainda não carregada responde com
 * a fórmula da forma (mais lenta, mas permite colorir o mar antes da visita).
 */
export class TerrainSet implements HeightField {
  readonly group = new THREE.Group();
  readonly islands: Terrain[];

  constructor(shapes: IslandShape[]) {
    this.islands = shapes.map((shape) => new Terrain(shape));
    for (const t of this.islands) this.group.add(t.group);
    this.group.name = 'Terrenos';
  }

  get(id: IslandId): Terrain {
    return this.islands.find((t) => t.shape.id === id)!;
  }

  /** Terreno que cobre o ponto (ou null em mar aberto). */
  terrainAt(x: number, z: number): Terrain | null {
    for (const t of this.islands) if (t.contains(x, z)) return t;
    return null;
  }

  getHeight(x: number, z: number): number {
    return this.terrainAt(x, z)?.getHeight(x, z) ?? -12;
  }

  getSlope(x: number, z: number): number {
    const e = 0.8;
    const dx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const dz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  getNormal(x: number, z: number, target = new THREE.Vector3()): THREE.Vector3 {
    const e = 0.8;
    const dx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const dz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return target.set(-dx, 2 * e, -dz).normalize();
  }

  /** Todos os pedaços de terreno já montados (para esconder os distantes). */
  get chunks(): THREE.Mesh[] {
    return this.islands.flatMap((t) => t.group.children as THREE.Mesh[]);
  }
}
