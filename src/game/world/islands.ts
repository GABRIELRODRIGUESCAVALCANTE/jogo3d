/**
 * Formas das ilhas do mundo.
 *
 * - Ilha principal (centro do mundo): praia ao sul, floresta e montanhas.
 * - Ilha da Aurora (a nordeste, a ~600 m): vegetação azulada, colina central
 *   com o Observatório dos Lumeni e três pilares de cristal. Ela só é montada
 *   quando o jogador se aproxima (carregamento sob demanda).
 */
import * as THREE from 'three';
import { lerp, smoothstep } from '../../core/math';
import type { SimplexNoise2D } from '../../core/noise';
import type { IslandShape } from './Terrain';
import {
  FLATTEN_ZONES,
  PLACES,
  TERRAIN_SEGMENTS,
  WORLD_SEED,
  WORLD_SIZE,
  distanceToSegment,
  distanceToPaths,
  type Place,
} from './layout';

const ROCK = new THREE.Color('#8d8a84');
const ROCK_DARK = new THREE.Color('#6f6c69');
const PATH = new THREE.Color('#c9a46a');

/** Altura natural da ilha principal (a mesma fórmula desde a primeira versão). */
function mainRaw(x: number, z: number, noise: SimplexNoise2D): number {
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

export const MAIN_ISLAND: IslandShape = {
  id: 'principal',
  name: 'Ilha principal',
  cx: 0,
  cz: 0,
  size: WORLD_SIZE,
  segments: TERRAIN_SEGMENTS,
  seed: WORLD_SEED,
  raw: mainRaw,
  flatten: FLATTEN_ZONES,
  pathDistance: distanceToPaths,
  specialColor: (x, z, out) => {
    const caveDist = Math.hypot(x - PLACES.cave.x, z - PLACES.cave.z);
    if (caveDist >= 9.5) return false;
    // Chão de pedra dentro e na entrada da caverna.
    out.copy(caveDist < 6 ? ROCK_DARK : ROCK).lerp(PATH, caveDist < 6 ? 0.1 : 0.35);
    return true;
  },
};

// ---------------------------------------------------------------------------
// Ilha da Aurora
// ---------------------------------------------------------------------------

export const AURORA_CENTER: Place = { x: 560, z: -260 };
const A = AURORA_CENTER;

/** Lugares importantes da Ilha da Aurora (coordenadas do mundo). */
export const AURORA_PLACES = {
  center: A,
  beach: { x: A.x - 73, z: A.z + 34 },
  loreStone: { x: A.x - 63, z: A.z + 27 },
  observatory: { x: A.x + 6, z: A.z - 8 },
  pylonWest: { x: A.x - 48, z: A.z - 50 },
  pylonEast: { x: A.x + 56, z: A.z - 40 },
  pylonSouth: { x: A.x + 34, z: A.z + 58 },
} satisfies Record<string, Place>;

const AP = AURORA_PLACES;
const AURORA_PATHS: Place[][] = [
  [AP.beach, { x: A.x - 50, z: A.z + 22 }, { x: A.x - 18, z: A.z + 4 }, AP.observatory],
  [AP.observatory, AP.pylonWest],
  [AP.observatory, AP.pylonEast],
  [AP.observatory, AP.pylonSouth],
];

export function auroraPathDistance(x: number, z: number): number {
  let best = Infinity;
  for (const path of AURORA_PATHS) {
    for (let i = 0; i < path.length - 1; i++) best = Math.min(best, distanceToSegment(x, z, path[i], path[i + 1]));
  }
  return best;
}

function auroraRaw(x: number, z: number, noise: SimplexNoise2D): number {
  const lx = x - A.x;
  const lz = z - A.z;
  const nx = lx / 112;
  const nz = lz / 100;
  let d = Math.sqrt(nx * nx + nz * nz);
  d += noise.fbm(x * 0.012 + 3, z * 0.012 + 9, 3) * 0.14;
  const beachWidth = lerp(0.06, 0.16, smoothstep(0, 1, (-lx + lz) / 120));
  const c = 0.92 - d;
  let h: number;
  if (c < 0) h = Math.max(-11, c * 70);
  else if (c < beachWidth) h = (c / beachWidth) * 1.3;
  else {
    const inland = c - beachWidth;
    const hills = noise.fbm(x * 0.025, z * 0.025, 4) * 0.5 + 0.5;
    h = 1.3 + smoothstep(0, 0.2, inland) * 2.6 + hills * 5 * smoothstep(0.02, 0.24, inland);
  }
  // Colina central (onde fica o observatório) e três morros dos pilares.
  const hill = Math.exp(-((lx - 6) ** 2 + (lz + 8) ** 2) / (2 * 34 ** 2)) * 20;
  const mounds = [AP.pylonWest, AP.pylonEast, AP.pylonSouth].reduce(
    (sum, p) => sum + Math.exp(-((x - p.x) ** 2 + (z - p.z) ** 2) / (2 * 12 ** 2)) * 5,
    0,
  );
  return h + (hill + mounds) * smoothstep(-0.05, 0.08, c);
}

/** Onde nada nasce na Aurora (marcos e chegada pela praia). */
export const AURORA_KEEP_CLEAR: Array<Place & { radius: number }> = [
  { ...AP.observatory, radius: 22 },
  { ...AP.beach, radius: 10 },
  { ...AP.loreStone, radius: 4 },
  { ...AP.pylonWest, radius: 9 },
  { ...AP.pylonEast, radius: 9 },
  { ...AP.pylonSouth, radius: 9 },
];

export const AURORA_ISLAND: IslandShape = {
  id: 'aurora',
  name: 'Ilha da Aurora',
  cx: A.x,
  cz: A.z,
  size: 280,
  segments: 112,
  seed: WORLD_SEED + 101,
  raw: auroraRaw,
  flatten: [
    { x: AP.observatory.x, z: AP.observatory.z, radius: 20, raise: 0.5 },
    { x: AP.beach.x, z: AP.beach.z, radius: 12, height: 0.9 },
    { x: AP.pylonWest.x, z: AP.pylonWest.z, radius: 8 },
    { x: AP.pylonEast.x, z: AP.pylonEast.z, radius: 8 },
    { x: AP.pylonSouth.x, z: AP.pylonSouth.z, radius: 8 },
  ],
  pathDistance: auroraPathDistance,
  grass: { light: '#7fe0b0', mid: '#4fbf9a', dark: '#2f9a86' },
};

export const ISLAND_SHAPES: IslandShape[] = [MAIN_ISLAND, AURORA_ISLAND];
