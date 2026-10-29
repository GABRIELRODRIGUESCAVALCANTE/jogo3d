/**
 * Mapa "de papel" da ilha: coordenadas dos lugares importantes.
 *
 * Eixos: X cresce para o leste, Z cresce para o sul.
 * O jogador começa na praia ao sul e a montanha fica ao norte.
 * Para expandir o mundo no futuro, acrescente lugares aqui e regiões em
 * `data/regions.ts` — o resto do jogo lê estes dados.
 */

export const WORLD_SIZE = 360; // metros de lado do terreno
export const WORLD_HALF = WORLD_SIZE / 2;
export const TERRAIN_SEGMENTS = 144; // células por lado (2,5 m cada)
export const WATER_LEVEL = 0;
export const WORLD_SEED = 20240611;
/** Raio máximo que o jogador pode nadar a partir do centro. */
export const WORLD_LIMIT_RADIUS = 172;

export interface Place {
  x: number;
  z: number;
}

export const PLACES = {
  spawn: { x: 2, z: 128 },
  shipwreck: { x: 17, z: 134 },
  chestBeach: { x: -21, z: 123 },
  clearing: { x: 30, z: 66 },
  giantTree: { x: -62, z: 22 },
  chestForest: { x: -59, z: 26.5 },
  ruins: { x: 96, z: 6 },
  monolith: { x: 96, z: -2.5 },
  altar: { x: 96, z: 9.5 },
  portal: { x: 96, z: 13.5 },
  cave: { x: 40, z: -50 },
  caveEntrance: { x: 40, z: -43.5 },
  chestCave: { x: 40, z: -53.3 },
  peak: { x: -12, z: -104 },
} satisfies Record<string, Place>;

/** Áreas aplainadas do terreno (para ruínas, clareira etc.). */
export interface FlattenZone {
  x: number;
  z: number;
  radius: number;
  /** Altura fixa; se ausente, usa a altura natural do centro. */
  height?: number;
  /** Soma à altura natural do centro. */
  raise?: number;
}

export const FLATTEN_ZONES: FlattenZone[] = [
  { x: PLACES.clearing.x, z: PLACES.clearing.z, radius: 20 },
  { x: PLACES.ruins.x, z: PLACES.ruins.z, radius: 26, raise: 2.5 },
  { x: PLACES.cave.x, z: PLACES.cave.z + 2, radius: 15 },
  { x: PLACES.peak.x, z: PLACES.peak.z, radius: 9 },
  { x: PLACES.giantTree.x, z: PLACES.giantTree.z, radius: 12 },
];

/** Trilhas de terra (apenas cor do chão; árvores não nascem nelas). */
export const PATHS: Place[][] = [
  [PLACES.spawn, { x: 4, z: 110 }, { x: 8, z: 96 }, { x: 16, z: 84 }, PLACES.clearing],
  [PLACES.clearing, { x: 52, z: 48 }, { x: 74, z: 22 }, PLACES.ruins],
  [PLACES.clearing, { x: 34, z: 30 }, { x: 38, z: -10 }, PLACES.caveEntrance],
  [{ x: 8, z: 96 }, { x: -22, z: 78 }, { x: -46, z: 46 }, PLACES.giantTree],
  [PLACES.caveEntrance, { x: 18, z: -46 }, { x: 0, z: -66 }, { x: -6, z: -86 }, PLACES.peak],
];

/** Áreas onde não é permitido construir (marcos importantes). */
export const PROTECTED_ZONES: Array<Place & { radius: number }> = [
  { ...PLACES.ruins, radius: 20 },
  { ...PLACES.cave, radius: 13 },
  { ...PLACES.peak, radius: 7 },
  { ...PLACES.giantTree, radius: 7 },
  { ...PLACES.chestBeach, radius: 2.5 },
  { ...PLACES.shipwreck, radius: 6 },
];

/** Distância de um ponto até um segmento de reta (usada nas trilhas). */
export function distanceToSegment(px: number, pz: number, a: Place, b: Place): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (pz - a.z) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(px - (a.x + abx * t), pz - (a.z + abz * t));
}

/** Distância até a trilha mais próxima. */
export function distanceToPaths(x: number, z: number): number {
  let best = Infinity;
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      best = Math.min(best, distanceToSegment(x, z, path[i], path[i + 1]));
    }
  }
  return best;
}
