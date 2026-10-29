/**
 * Modelos low-poly dos elementos da natureza (árvores, pedras, arbustos...).
 * Todos são geometrias com cor nos vértices, prontas para `InstancedMesh`.
 */
import * as THREE from 'three';
import { createRandom } from '../../core/math';
import { jitter, merge, paint, part } from './geometry';

const BARK = '#7a5232';
const BARK_DARK = '#5e3d24';

export function makeBroadleafTree(variant: number): THREE.BufferGeometry {
  const r = createRandom(100 + variant);
  const greens = ['#58b947', '#4aa84a', '#6cc24a'];
  const leaf = greens[variant % greens.length];
  const parts = [part(new THREE.CylinderGeometry(0.2, 0.34, 2.9, 6), BARK, { pos: [0, 1.45, 0], seed: 3 })];
  // Galho curto para dar personalidade.
  parts.push(part(new THREE.CylinderGeometry(0.07, 0.11, 1.1, 5), BARK, { pos: [0.35, 2.3, 0], rot: [0, 0, -0.8] }));
  const blobs: Array<[number, number, number, number]> = [
    [0, 3.5, 0, 1.75],
    [0.95, 3.95, 0.35, 1.15],
    [-0.85, 3.75, -0.45, 1.1],
    [0.1, 4.6, -0.2, 0.95],
  ];
  blobs.forEach(([x, y, z, s], i) => {
    const g = jitter(new THREE.IcosahedronGeometry(s, 0), s * 0.28, variant * 10 + i);
    g.scale(1, 0.85, 1);
    g.translate(x + (r() - 0.5) * 0.3, y, z + (r() - 0.5) * 0.3);
    parts.push(paint(g, leaf, 0.07, variant * 7 + i));
  });
  return merge(parts);
}

export function makePineTree(variant: number): THREE.BufferGeometry {
  const green = variant % 2 === 0 ? '#2f8a57' : '#3a9a5c';
  const parts = [part(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6), BARK_DARK, { pos: [0, 1.1, 0] })];
  const layers: Array<[number, number, number]> = [
    [1.7, 2.4, 2.4],
    [1.3, 2.1, 3.6],
    [0.9, 1.8, 4.7],
  ];
  layers.forEach(([radius, height, y], i) => {
    parts.push(part(new THREE.ConeGeometry(radius, height, 7), green, { pos: [0, y, 0], rot: [0, i * 0.5, 0], seed: i + variant }));
  });
  return merge(parts);
}

export function makePalmTree(variant: number): THREE.BufferGeometry {
  const r = createRandom(300 + variant);
  const parts: THREE.BufferGeometry[] = [];
  // Tronco curvado: segmentos empilhados que se inclinam aos poucos.
  let x = 0;
  let y = 0;
  let angle = 0;
  const lean = 0.07 + r() * 0.05;
  for (let i = 0; i < 7; i++) {
    const len = 0.85;
    const seg = new THREE.CylinderGeometry(0.17 - i * 0.008, 0.21 - i * 0.008, len, 6);
    seg.translate(0, len / 2, 0);
    seg.rotateZ(-angle);
    seg.translate(x, y, 0);
    parts.push(paint(seg, i % 2 === 0 ? '#a07a4f' : '#8c6a43', 0.03, i));
    x += Math.sin(angle) * len;
    y += Math.cos(angle) * len;
    angle += lean;
  }
  // Folhas: duas partes por folha (subindo e caindo), em volta do topo.
  const leafCount = 8;
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2 + r() * 0.3;
    const inner = new THREE.BoxGeometry(0.42, 0.05, 1.5);
    inner.translate(0, 0, 0.75);
    inner.rotateX(-0.25);
    const outer = new THREE.BoxGeometry(0.34, 0.05, 1.6);
    outer.translate(0, 0, 0.8);
    outer.rotateX(0.55);
    outer.translate(0, 0.36, 1.42);
    for (const leaf of [inner, outer]) {
      leaf.rotateY(a);
      leaf.translate(x, y + 0.05, 0);
      parts.push(paint(leaf, i % 2 === 0 ? '#3fae4f' : '#57c254', 0.06, i + 20));
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push(
      part(new THREE.IcosahedronGeometry(0.17, 0), '#6b4a2a', {
        pos: [x + Math.cos(a) * 0.22, y - 0.15, Math.sin(a) * 0.22],
      }),
    );
  }
  return merge(parts);
}

export function makeRock(variant: number): THREE.BufferGeometry {
  const g = jitter(new THREE.DodecahedronGeometry(1, 0), 0.38, 500 + variant);
  g.scale(1.1, 0.72, 0.95);
  g.translate(0, 0.42, 0);
  const tones = ['#9c978e', '#8f8b84', '#a7a196'];
  return paint(g, tones[variant % tones.length], 0.08, variant);
}

export function makeBush(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.55, 0, 0.78],
    [0.5, 0.45, 0.2, 0.55],
    [-0.45, 0.42, -0.15, 0.55],
    [0.05, 0.5, -0.45, 0.5],
  ];
  blobs.forEach(([x, y, z, s], i) => {
    const g = jitter(new THREE.IcosahedronGeometry(s, 0), s * 0.25, 40 + i);
    g.scale(1, 0.8, 1);
    g.translate(x, y, z);
    parts.push(paint(g, '#3f9e47', 0.07, i));
  });
  return merge(parts);
}

/** Frutinhas do arbusto (malha separada para sumirem quando colhidas). */
export function makeBerries(): THREE.BufferGeometry {
  const r = createRandom(77);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const theta = r() * Math.PI * 2;
    const phi = 0.3 + r() * 1.0;
    const rad = 0.78;
    const x = Math.cos(theta) * Math.sin(phi) * rad;
    const y = 0.5 + Math.cos(phi) * rad * 0.8;
    const z = Math.sin(theta) * Math.sin(phi) * rad;
    parts.push(part(new THREE.IcosahedronGeometry(0.12, 0), i % 3 === 0 ? '#ffb02e' : '#ff4f5e', { pos: [x, y, z] }));
  }
  return merge(parts);
}

export function makeGrassClump(): THREE.BufferGeometry {
  const r = createRandom(12);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const h = 0.9 + r() * 0.7;
    const blade = new THREE.ConeGeometry(0.07, h, 3);
    blade.translate(0, h / 2, 0);
    blade.rotateZ((r() - 0.5) * 0.6);
    blade.rotateX((r() - 0.5) * 0.6);
    const a = r() * Math.PI * 2;
    const d = r() * 0.35;
    blade.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    parts.push(paint(blade, r() > 0.5 ? '#c7d36a' : '#a5c957', 0.05, i));
  }
  // Pendões com sementes no topo.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push(part(new THREE.ConeGeometry(0.06, 0.3, 4), '#e2c97a', { pos: [Math.cos(a) * 0.15, 1.6 + i * 0.08, Math.sin(a) * 0.15] }));
  }
  return merge(parts);
}

export function makeCrystalCluster(): THREE.BufferGeometry {
  const r = createRandom(808);
  const parts: THREE.BufferGeometry[] = [];
  const shards: Array<[number, number, number, number]> = [
    [0, 0, 0, 1.25],
    [0.35, 0, 0.15, 0.85],
    [-0.3, 0, 0.2, 0.75],
    [0.1, 0, -0.35, 0.9],
    [-0.2, 0, -0.2, 0.6],
  ];
  shards.forEach(([x, , z, s], i) => {
    const g = new THREE.OctahedronGeometry(0.32, 0);
    g.scale(1, 2.6 * s, 1);
    g.rotateZ((r() - 0.5) * 0.7);
    g.rotateX((r() - 0.5) * 0.7);
    g.translate(x, 0.65 * s, z);
    parts.push(paint(g, i % 2 === 0 ? '#7ef4ff' : '#b896ff', 0.08, i));
  });
  parts.push(part(new THREE.DodecahedronGeometry(0.45, 0), '#6d6a72', { pos: [0, 0.1, 0], scale: [1.2, 0.5, 1.2] }));
  return merge(parts);
}

export function makeStump(): THREE.BufferGeometry {
  return merge([
    part(new THREE.CylinderGeometry(0.3, 0.38, 0.45, 7), BARK, { pos: [0, 0.22, 0] }),
    part(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 7), '#d9b07a', { pos: [0, 0.46, 0] }),
  ]);
}

// --- Decorações (sem interação) ---

export function makeGrassTuft(): THREE.BufferGeometry {
  const r = createRandom(5);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const h = 0.35 + r() * 0.25;
    const blade = new THREE.ConeGeometry(0.05, h, 3);
    blade.translate(0, h / 2, 0);
    blade.rotateZ((r() - 0.5) * 0.8);
    blade.translate((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25);
    parts.push(paint(blade, '#79c94f', 0.08, i));
  }
  return merge(parts);
}

export function makeFlower(): THREE.BufferGeometry {
  const parts = [part(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 3), '#ffffff', { pos: [0, 0.2, 0] })];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(
      part(new THREE.OctahedronGeometry(0.07, 0), '#ffffff', {
        pos: [Math.cos(a) * 0.08, 0.42, Math.sin(a) * 0.08],
        scale: [1, 0.5, 1],
      }),
    );
  }
  parts.push(part(new THREE.OctahedronGeometry(0.05, 0), '#ffe066', { pos: [0, 0.44, 0] }));
  return merge(parts);
}

export function makeFern(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const frond = new THREE.BoxGeometry(0.22, 0.03, 0.9);
    frond.translate(0, 0, 0.45);
    frond.rotateX(-0.6);
    frond.rotateY(a);
    frond.translate(0, 0.1, 0);
    parts.push(paint(frond, '#2f8f4a', 0.08, i));
  }
  return merge(parts);
}

export function makeShell(): THREE.BufferGeometry {
  return merge([part(new THREE.ConeGeometry(0.2, 0.07, 5), '#ffffff', { pos: [0, 0.03, 0] })]);
}

export function makeDriftwood(): THREE.BufferGeometry {
  return merge([
    part(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 6), '#b49a7c', { rot: [0, 0, Math.PI / 2], pos: [0, 0.12, 0] }),
    part(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 5), '#b49a7c', { rot: [0.9, 0, Math.PI / 2], pos: [0.4, 0.2, 0.25] }),
  ]);
}
