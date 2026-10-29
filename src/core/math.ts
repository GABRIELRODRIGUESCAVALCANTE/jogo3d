/**
 * Funções matemáticas pequenas usadas em todo o jogo.
 * Mantidas sem dependência do Three.js para poderem ser testadas facilmente.
 */

/** Limita um valor entre um mínimo e um máximo. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Interpolação linear: t = 0 retorna a, t = 1 retorna b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Curva suave entre 0 e 1 (igual à função do GLSL). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Aproxima um valor de um alvo de forma suave e independente do FPS.
 * `lambda` maior = aproximação mais rápida.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Mantém um ângulo no intervalo [-PI, PI]. */
export function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Igual ao `damp`, mas pelo caminho mais curto entre dois ângulos. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = wrapAngle(target - current);
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/**
 * Gerador de números pseudoaleatórios com semente (mulberry32).
 * Com a mesma semente, a ilha é sempre gerada igual — isso permite salvar
 * apenas o estado de cada recurso, e não o mapa inteiro.
 */
export function createRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número aleatório entre min e max usando um gerador. */
export function randRange(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

/** Distância 2D (plano XZ). */
export function dist2(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

/** Formata segundos como "1h 05min" ou "12min". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  return `${m}min`;
}
