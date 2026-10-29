/**
 * Utilitários para montar modelos low-poly a partir de formas simples.
 * Cada peça recebe uma cor nos vértices e depois as peças são unidas em
 * uma única geometria — assim um modelo inteiro é desenhado de uma vez.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRandom } from '../../core/math';

/**
 * Pinta uma geometria com uma cor. `variation` muda levemente o brilho de
 * cada face, criando o visual facetado.
 */
export function paint(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  variation = 0.04,
  seed = 1,
): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(color);
  const c = new THREE.Color();
  const random = createRandom(seed);
  for (let i = 0; i < count; i += 3) {
    c.copy(base).offsetHSL(0, 0, (random() - 0.5) * variation * 2);
    for (let v = 0; v < 3; v++) {
      colors[(i + v) * 3] = c.r;
      colors[(i + v) * 3 + 1] = c.g;
      colors[(i + v) * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/** Une várias geometrias pintadas em uma só. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('Falha ao unir geometrias do modelo.');
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/**
 * Desloca os vértices aleatoriamente (para pedras e copas parecerem naturais).
 * Vértices na mesma posição recebem o mesmo deslocamento, então as faces
 * continuam unidas.
 */
export function jitter(geometry: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const cache = new Map<string, [number, number, number]>();
  const random = createRandom(seed);
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let offset = cache.get(key);
    if (!offset) {
      offset = [(random() - 0.5) * amount, (random() - 0.5) * amount, (random() - 0.5) * amount];
      cache.set(key, offset);
    }
    pos.setXYZ(i, pos.getX(i) + offset[0], pos.getY(i) + offset[1], pos.getZ(i) + offset[2]);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Atalho: cria, posiciona, gira e pinta uma peça. */
export function part(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  opts: {
    pos?: [number, number, number];
    rot?: [number, number, number];
    scale?: [number, number, number];
    variation?: number;
    seed?: number;
  } = {},
): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (opts.scale) g.scale(...opts.scale);
  if (opts.rot) {
    g.rotateX(opts.rot[0]);
    g.rotateY(opts.rot[1]);
    g.rotateZ(opts.rot[2]);
  }
  if (opts.pos) g.translate(...opts.pos);
  return paint(g, color, opts.variation ?? 0.04, opts.seed ?? 1);
}

/** Material padrão dos modelos low-poly (cores nos vértices, faces planas). */
export function createFlatMaterial(extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra });
}

/**
 * Faz copas e capim balançarem com o vento, alterando o shader padrão.
 * A intensidade cresce com a altura do vértice (a base fica parada).
 */
export function addWind(material: THREE.Material, time: { value: number }, strength = 0.06, minHeight = 1): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float hw = max(position.y - ${minHeight.toFixed(2)}, 0.0);
          #ifdef USE_INSTANCING
            vec2 seedPos = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
          #else
            vec2 seedPos = vec2(0.0);
          #endif
          float phase = seedPos.x * 0.21 + seedPos.y * 0.17;
          transformed.x += sin(uWindTime * 1.3 + phase) * ${strength.toFixed(3)} * hw;
          transformed.z += cos(uWindTime * 1.1 + phase * 1.3) * ${(strength * 0.7).toFixed(3)} * hw;
        }`,
      );
  };
  // Chave de cache diferente para cada intensidade de vento.
  material.customProgramCacheKey = () => `wind_${strength}_${minHeight}`;
}
