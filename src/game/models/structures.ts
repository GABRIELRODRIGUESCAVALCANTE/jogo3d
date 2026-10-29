/**
 * Modelos das construções que o jogador pode erguer.
 * A frente de cada construção aponta para +Z (a porta da cabana fica lá).
 */
import * as THREE from 'three';
import type { StructureId } from '../data/structures';
import { createFlatMaterial, merge, part } from './geometry';

export interface StructureModel {
  root: THREE.Group;
  /** Teto (escondido quando o jogador entra). */
  roof?: THREE.Object3D;
  /** Chamas animadas (fogueira). */
  flames?: THREE.Object3D;
}

const WOOD = '#9a6a3f';
const WOOD_DARK = '#7a5232';
const WOOD_LIGHT = '#b98552';
const STONE = '#9d978d';
const ROOF = '#c9573c';
const ROOF_DARK = '#a8442f';

let sharedMaterial: THREE.MeshLambertMaterial | null = null;
function material(): THREE.MeshLambertMaterial {
  sharedMaterial ??= createFlatMaterial();
  return sharedMaterial;
}

function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material = material()): THREE.Mesh {
  const m = new THREE.Mesh(geometry, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createStructureModel(type: StructureId): StructureModel {
  switch (type) {
    case 'cabana':
      return createCabin();
    case 'fogueira':
      return createCampfire();
    case 'bancada':
      return createWorkbench();
    case 'cerca':
      return createFence();
    case 'caminho':
      return createPath();
    case 'lanterna':
      return createLantern();
  }
}

/** Cabana de toras: piso, paredes com porta e janelas, telhado e cama. */
function createCabin(): StructureModel {
  const root = new THREE.Group();
  const W = 6;
  const D = 5;
  const H = 2.7;
  const parts: THREE.BufferGeometry[] = [];

  // Fundação de pedra (desce abaixo do chão para esconder desníveis) e piso.
  parts.push(part(new THREE.BoxGeometry(W + 0.4, 1.6, D + 0.4), STONE, { pos: [0, -0.6, 0], variation: 0.08 }));
  parts.push(part(new THREE.BoxGeometry(W, 0.12, D), WOOD_LIGHT, { pos: [0, 0.26, 0] }));
  // Degrau da porta.
  parts.push(part(new THREE.BoxGeometry(1.6, 0.25, 0.7), STONE, { pos: [0, 0.0, D / 2 + 0.5] }));

  // Paredes de toras empilhadas.
  const logs = 6;
  const logR = H / logs / 2;
  for (let i = 0; i < logs; i++) {
    const y = 0.32 + logR + i * logR * 2;
    const color = i % 2 === 0 ? WOOD : WOOD_DARK;
    // Fundo
    parts.push(part(new THREE.CylinderGeometry(logR, logR, W + 0.5, 6), color, { pos: [0, y, -D / 2], rot: [0, 0, Math.PI / 2], seed: i }));
    // Laterais (com janela no meio, nas toras 2 e 3)
    for (const side of [-1, 1]) {
      if (i === 2 || i === 3) {
        parts.push(part(new THREE.CylinderGeometry(logR, logR, 1.6, 6), color, { pos: [side * W / 2, y, -D / 2 + 0.8], rot: [Math.PI / 2, 0, 0] }));
        parts.push(part(new THREE.CylinderGeometry(logR, logR, 1.6, 6), color, { pos: [side * W / 2, y, D / 2 - 0.8], rot: [Math.PI / 2, 0, 0] }));
      } else {
        parts.push(part(new THREE.CylinderGeometry(logR, logR, D + 0.5, 6), color, { pos: [side * W / 2, y, 0], rot: [Math.PI / 2, 0, 0] }));
      }
    }
    // Frente com porta (abertura de 1,4 m no centro, até a 5ª tora).
    if (i < 5) {
      const seg = (W + 0.5 - 1.4) / 2;
      for (const side of [-1, 1]) {
        parts.push(part(new THREE.CylinderGeometry(logR, logR, seg, 6), color, { pos: [side * (0.7 + seg / 2), y, D / 2], rot: [0, 0, Math.PI / 2] }));
      }
    } else {
      parts.push(part(new THREE.CylinderGeometry(logR, logR, W + 0.5, 6), color, { pos: [0, y, D / 2], rot: [0, 0, Math.PI / 2] }));
    }
  }
  // Batentes da porta e moldura das janelas.
  for (const side of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.14, 2.3, 0.3), WOOD_DARK, { pos: [side * 0.72, 1.45, D / 2] }));
    parts.push(part(new THREE.BoxGeometry(0.2, 0.1, 1.5), WOOD_LIGHT, { pos: [side * W / 2, 1.3, 0] }));
  }
  parts.push(part(new THREE.BoxGeometry(1.6, 0.14, 0.3), WOOD_DARK, { pos: [0, 2.55, D / 2] }));

  // Cama e mesinha dentro.
  parts.push(part(new THREE.BoxGeometry(1.3, 0.45, 2.2), WOOD_DARK, { pos: [-1.9, 0.55, -1.15] }));
  parts.push(part(new THREE.BoxGeometry(1.2, 0.2, 2.1), '#f0e6d2', { pos: [-1.9, 0.86, -1.15] }));
  parts.push(part(new THREE.BoxGeometry(1.22, 0.22, 1.2), '#4f8fd6', { pos: [-1.9, 0.9, -0.6] }));
  parts.push(part(new THREE.BoxGeometry(0.8, 0.16, 0.45), '#ffffff', { pos: [-1.9, 1.02, -1.95] }));
  parts.push(part(new THREE.BoxGeometry(0.9, 0.08, 0.9), WOOD_LIGHT, { pos: [1.8, 1.0, -1.5] }));
  parts.push(part(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5), WOOD_DARK, { pos: [1.8, 0.62, -1.5] }));
  parts.push(part(new THREE.BoxGeometry(1.4, 0.04, 1.0), '#c94f4f', { pos: [0.2, 0.33, 0.6] }));

  root.add(mesh(merge(parts)));

  // Telhado (grupo separado para poder esconder).
  const roofParts: THREE.BufferGeometry[] = [];
  const roofW = W + 1.2;
  const slope = Math.atan2(1.5, D / 2 + 0.5);
  const panelLen = Math.hypot(1.5, D / 2 + 0.5) + 0.2;
  for (const side of [-1, 1]) {
    roofParts.push(
      part(new THREE.BoxGeometry(roofW, 0.18, panelLen), side > 0 ? ROOF : ROOF_DARK, {
        rot: [side * slope, 0, 0],
        pos: [0, H + 0.32 + 0.75, (side * (D / 2 + 0.5)) / 2],
        variation: 0.06,
      }),
    );
  }
  // Empenas triangulares nas laterais (triângulo extrudado).
  const half = D / 2 + 0.3;
  const triangle = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, 1.5)]);
  for (const side of [-1, 1]) {
    const gable = new THREE.ExtrudeGeometry(triangle, { depth: 0.16, bevelEnabled: false });
    gable.translate(0, 0, -0.08);
    gable.rotateY(Math.PI / 2);
    roofParts.push(part(gable, WOOD, { pos: [side * (W / 2), H + 0.32, 0] }));
  }
  roofParts.push(part(new THREE.BoxGeometry(0.6, 1.6, 0.6), STONE, { pos: [1.6, H + 1.6, -1.2] }));
  const roof = mesh(merge(roofParts));
  root.add(roof);

  return { root, roof };
}

function createCampfire(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push(part(new THREE.DodecahedronGeometry(0.22, 0), i % 2 ? '#8e8a84' : '#a39e96', { pos: [Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7], seed: i }));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    parts.push(
      part(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 5), i % 2 ? WOOD : WOOD_DARK, {
        rot: [0.9, a, 0],
        pos: [Math.cos(a) * 0.18, 0.28, Math.sin(a) * 0.18],
      }),
    );
  }
  parts.push(part(new THREE.CylinderGeometry(0.45, 0.5, 0.06, 8), '#3a302a', { pos: [0, 0.03, 0] }));
  root.add(mesh(merge(parts)));

  const flames = new THREE.Group();
  const colors = ['#ff6b2d', '#ffa733', '#ffe066'];
  colors.forEach((c, i) => {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.3 - i * 0.07, 0.9 - i * 0.18, 6),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 - i * 0.05 }),
    );
    flame.position.y = 0.55 + i * 0.05;
    flames.add(flame);
  });
  root.add(flames);
  return { root, flames };
}

function createWorkbench(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(new THREE.BoxGeometry(2.0, 0.14, 1.0), WOOD_LIGHT, { pos: [0, 0.95, 0] }));
  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.38, 0.38]) {
      parts.push(part(new THREE.BoxGeometry(0.14, 0.9, 0.14), WOOD_DARK, { pos: [x, 0.45, z] }));
    }
  }
  parts.push(part(new THREE.BoxGeometry(1.8, 0.08, 0.8), WOOD, { pos: [0, 0.3, 0] }));
  // Ferramentas sobre a bancada.
  parts.push(part(new THREE.BoxGeometry(0.5, 0.08, 0.08), WOOD_DARK, { pos: [-0.4, 1.06, 0.1], rot: [0, 0.4, 0] }));
  parts.push(part(new THREE.BoxGeometry(0.12, 0.12, 0.2), '#8d9196', { pos: [-0.2, 1.08, 0.2], rot: [0, 0.4, 0] }));
  parts.push(part(new THREE.CylinderGeometry(0.15, 0.15, 0.25, 6), STONE, { pos: [0.5, 1.15, -0.15] }));
  parts.push(part(new THREE.BoxGeometry(0.4, 0.3, 0.3), '#c9a26b', { pos: [0.55, 0.47, 0.05] }));
  // Placa traseira com ganchos.
  parts.push(part(new THREE.BoxGeometry(2.0, 0.8, 0.08), WOOD, { pos: [0, 1.4, -0.48] }));
  root.add(mesh(merge(parts)));
  return { root };
}

function createFence(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-1.1, 0, 1.1]) {
    parts.push(part(new THREE.BoxGeometry(0.16, 1.3, 0.16), WOOD_DARK, { pos: [x, 0.45, 0] }));
    parts.push(part(new THREE.ConeGeometry(0.12, 0.2, 4), WOOD_DARK, { pos: [x, 1.2, 0], rot: [0, Math.PI / 4, 0] }));
  }
  parts.push(part(new THREE.BoxGeometry(2.4, 0.12, 0.08), WOOD, { pos: [0, 0.85, 0.08] }));
  parts.push(part(new THREE.BoxGeometry(2.4, 0.12, 0.08), WOOD, { pos: [0, 0.45, 0.08] }));
  root.add(mesh(merge(parts)));
  return { root };
}

function createPath(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const stones: Array<[number, number, number]> = [
    [-0.5, -0.5, 0.48],
    [0.5, -0.45, 0.42],
    [-0.45, 0.5, 0.44],
    [0.52, 0.5, 0.46],
    [0, 0, 0.3],
  ];
  stones.forEach(([x, z, r], i) => {
    parts.push(part(new THREE.CylinderGeometry(r, r + 0.04, 0.5, 6), i % 2 ? '#b3ada3' : '#c2bcb1', { pos: [x, -0.15, z], rot: [0, i, 0], seed: i }));
  });
  root.add(mesh(merge(parts)));
  return { root };
}

function createLantern(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(new THREE.BoxGeometry(0.5, 0.2, 0.5), STONE, { pos: [0, 0.1, 0] }));
  parts.push(part(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), WOOD_DARK, { pos: [0, 1.2, 0] }));
  parts.push(part(new THREE.BoxGeometry(0.6, 0.08, 0.6), WOOD, { pos: [0, 2.25, 0] }));
  parts.push(part(new THREE.ConeGeometry(0.45, 0.35, 4), WOOD_DARK, { pos: [0, 2.95, 0], rot: [0, Math.PI / 4, 0] }));
  for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
    parts.push(part(new THREE.BoxGeometry(0.05, 0.6, 0.05), WOOD_DARK, { pos: [x, 2.55, z] }));
  }
  root.add(mesh(merge(parts)));
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshLambertMaterial({ color: '#9ff6ff', emissive: new THREE.Color('#47d8ff'), emissiveIntensity: 1.2 }),
  );
  crystal.scale.set(1, 1.6, 1);
  crystal.position.y = 2.55;
  root.add(crystal);
  return { root, flames: crystal };
}
