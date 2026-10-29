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
import {
  FLATTEN_ZONES,
  PLACES,
  TERRAIN_SEGMENTS,
  WATER_LEVEL,
  WORLD_HALF,
  WORLD_SEED,
  WORLD_SIZE,
  distanceToPaths,
} from './layout';

const CHUNKS_PER_SIDE = 4;

// Paleta do terreno (cores no espaço sRGB, como em um editor de imagem).
const COLORS = {
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

export class Terrain {
  /** Alturas nos vértices da grade: (SEGMENTS + 1)². */
  readonly heights: Float32Array;
  readonly group = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private readonly n = TERRAIN_SEGMENTS;
  private readonly cell = WORLD_SIZE / TERRAIN_SEGMENTS;
  private readonly noise: SimplexNoise2D;

  constructor() {
    this.noise = new SimplexNoise2D(createRandom(WORLD_SEED));
    this.heights = new Float32Array((this.n + 1) * (this.n + 1));
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.group.name = 'Terreno';
  }

  /** Calcula o mapa de alturas (rápido; chamado uma vez). */
  generateHeights(): void {
    const n = this.n;
    for (let iz = 0; iz <= n; iz++) {
      for (let ix = 0; ix <= n; ix++) {
        const x = -WORLD_HALF + ix * this.cell;
        const z = -WORLD_HALF + iz * this.cell;
        this.heights[iz * (n + 1) + ix] = this.shapeHeight(x, z);
      }
    }
  }

  /** Monta as malhas 3D dos chunks. */
  buildMeshes(): void {
    const per = this.n / CHUNKS_PER_SIDE;
    for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        const geometry = this.buildChunkGeometry(cx * per, cz * per, per);
        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.receiveShadow = true;
        mesh.name = `chunk_${cx}_${cz}`;
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
      }
    }
  }

  /** Altura do chão em qualquer ponto (interpolada nos triângulos da malha). */
  getHeight(x: number, z: number): number {
    const fx = (x + WORLD_HALF) / this.cell;
    const fz = (z + WORLD_HALF) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.n || fz >= this.n) return -12;
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

  /** Altura "natural" antes de aplainar áreas especiais. */
  private rawHeight(x: number, z: number): number {
    const noise = this.noise;
    // Distância elíptica ao centro, com litoral irregular.
    const nx = x / 158;
    const nz = (z - 4) / 150;
    let d = Math.sqrt(nx * nx + nz * nz);
    d += noise.fbm(x * 0.009 + 11, z * 0.009 - 7, 3) * 0.13;

    // A praia é mais larga ao sul, onde o jogador começa.
    const beachWidth = lerp(0.055, 0.15, smoothstep(20, 110, z));
    const c = 0.93 - d; // > 0 em terra firme

    let h: number;
    if (c < 0) {
      h = Math.max(-11, c * 70); // fundo do mar
    } else if (c < beachWidth) {
      h = (c / beachWidth) * 1.3; // areia em rampa suave
    } else {
      // Subida suave da areia para o interior (cerca de 30 m).
      const inland = c - beachWidth;
      const hills = noise.fbm(x * 0.021, z * 0.021, 4) * 0.5 + 0.5;
      h = 1.3 + smoothstep(0, 0.2, inland) * 2.4 + hills * 4.2 * smoothstep(0.02, 0.24, inland);
    }

    // Cordilheira ao norte (com cristas) — desce até o mar formando falésias.
    const ridge = 1 - Math.abs(noise.noise(x * 0.03 + 40, z * 0.03 - 9));
    const mountainMain = Math.exp(-(((x + 12) / 46) ** 2 + ((z + 104) / 33) ** 2));
    const mountainEast = Math.exp(-(((x - 48) / 26) ** 2 + ((z + 78) / 22) ** 2));
    const mountainWest = Math.exp(-(((x + 62) / 28) ** 2 + ((z + 76) / 24) ** 2));
    const mountain = mountainMain * 46 + mountainEast * 22 + mountainWest * 18;
    const landMask = smoothstep(-0.08, 0.06, c);
    h += mountain * (0.78 + ridge * 0.28) * landMask;

    return h;
  }

  /** Altura final: forma natural + áreas aplainadas. */
  private shapeHeight(x: number, z: number): number {
    let h = this.rawHeight(x, z);
    for (const zone of FLATTEN_ZONES) {
      const dist = Math.hypot(x - zone.x, z - zone.z);
      if (dist >= zone.radius) continue;
      const target = zone.height ?? this.rawHeight(zone.x, zone.z) + (zone.raise ?? 0);
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
      const wx = -WORLD_HALF + ((ax + bx + cx) / 3) * this.cell;
      const wz = -WORLD_HALF + ((az + bz + cz) / 3) * this.cell;
      const avgH = (ha + hb + hc) / 3;
      const slope = (Math.max(ha, hb, hc) - Math.min(ha, hb, hc)) / this.cell;
      this.colorFor(wx, wz, avgH, slope, random(), color);
      for (const [vx, vz, vh] of verts) {
        positions[p] = -WORLD_HALF + vx * this.cell;
        positions[p + 1] = vh;
        positions[p + 2] = -WORLD_HALF + vz * this.cell;
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
    const caveDist = Math.hypot(x - PLACES.cave.x, z - PLACES.cave.z);
    if (caveDist < 9.5) {
      // Chão de pedra dentro e na entrada da caverna.
      out.copy(caveDist < 6 ? COLORS.rockDark : COLORS.rock).lerp(COLORS.path, caveDist < 6 ? 0.1 : 0.35);
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
      if (n > 0.62) out.copy(COLORS.grassDark);
      else if (n < 0.3) out.copy(COLORS.grassLight);
      else out.copy(COLORS.grass);
      if (h < 1.9) out.lerp(COLORS.sand, 0.45);
      // Trilhas de terra.
      const dPath = distanceToPaths(x, z);
      if (dPath < 2.2) out.lerp(COLORS.path, clamp(1.3 - dPath / 2.2, 0, 1));
    }
    out.offsetHSL(0, 0, variation);
  }
}
