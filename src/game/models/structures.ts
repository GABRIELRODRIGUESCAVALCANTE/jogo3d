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
  /** Tampa (baú). */
  lid?: THREE.Object3D;
  /** Planta que cresce (canteiro): o jogo ajusta a escala conforme o estágio. */
  plant?: THREE.Object3D;
  /** Batatas aparecendo quando a planta está pronta para colher. */
  crop?: THREE.Object3D;
  /** Outras plantas da horta (milho, abacaxi): muda e colheita de cada uma. */
  variants?: Record<string, { plant: THREE.Object3D; crop: THREE.Object3D }>;
}

const WOOD = '#9a6a3f';
const WOOD_DARK = '#7a5232';
const WOOD_LIGHT = '#b98552';
const STONE = '#9d978d';
const ROOF = '#c9573c';
const ROOF_DARK = '#a8442f';
/** Altura das paredes modulares (igual a WALL_HEIGHT em data/structures.ts). */
const WALL_H = 2.6;

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
    case 'bau':
      return createChest();
    case 'canteiro':
      return createGardenBed();
    case 'piso':
      return createFloor();
    case 'parede':
      return createWall('lisa');
    case 'parede_porta':
      return createWall('porta');
    case 'parede_janela':
      return createWall('janela');
    case 'telhado':
      return createRoofTile();
    case 'barco':
      return createBoat();
  }
}

/** Barco a vela: a proa aponta para +Z. A origem fica na linha d'água. */
function createBoat(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(new THREE.BoxGeometry(1.4, 0.35, 3.6), WOOD_DARK, { pos: [0, -0.15, -0.1] }));
  for (const side of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.12, 0.6, 3.6), WOOD, { pos: [side * 0.75, 0.15, -0.1], rot: [0, 0, side * 0.25] }));
    parts.push(part(new THREE.BoxGeometry(0.12, 0.55, 1.2), WOOD, { pos: [side * 0.4, 0.15, 2.1], rot: [0, -side * 0.6, side * 0.25] }));
  }
  parts.push(part(new THREE.BoxGeometry(1.5, 0.6, 0.12), WOOD, { pos: [0, 0.15, -1.9] }));
  parts.push(part(new THREE.BoxGeometry(1.3, 0.08, 0.4), WOOD_LIGHT, { pos: [0, 0.2, -1.1] }));
  parts.push(part(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6), WOOD_DARK, { pos: [0, 2.2, 0.5] }));
  parts.push(part(new THREE.CylinderGeometry(0.04, 0.04, 2, 5), WOOD_DARK, { rot: [Math.PI / 2, 0, 0], pos: [0, 1.0, -0.4] }));
  root.add(mesh(merge(parts)));
  // Vela triangular (dos dois lados).
  const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 3.4), new THREE.Vector2(-1.9, 0)]);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshLambertMaterial({ color: '#f4ead2', side: THREE.DoubleSide }));
  sail.rotation.y = Math.PI / 2;
  sail.position.set(0, 1.05, 0.48);
  sail.castShadow = true;
  root.add(sail);
  return { root };
}

function createChest(): StructureModel {
  const root = new THREE.Group();
  const gold = '#d9b24c';
  root.add(
    mesh(
      merge([
        part(new THREE.BoxGeometry(1.2, 0.6, 0.75), WOOD, { pos: [0, 0.3, 0] }),
        part(new THREE.BoxGeometry(1.24, 0.08, 0.79), gold, { pos: [0, 0.12, 0] }),
        part(new THREE.BoxGeometry(0.08, 0.62, 0.79), gold, { pos: [-0.45, 0.31, 0] }),
        part(new THREE.BoxGeometry(0.08, 0.62, 0.79), gold, { pos: [0.45, 0.31, 0] }),
      ]),
    ),
  );
  const lid = new THREE.Group();
  lid.position.set(0, 0.6, -0.37);
  lid.add(
    mesh(
      merge([
        part(new THREE.BoxGeometry(1.22, 0.26, 0.77), WOOD_LIGHT, { pos: [0, 0.13, 0.385] }),
        part(new THREE.BoxGeometry(0.18, 0.2, 0.06), gold, { pos: [0, 0.02, 0.78] }),
      ]),
    ),
  );
  root.add(lid);
  return { root, lid };
}

function createGardenBed(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, z, w, d] of [
    [0, -0.95, 2, 0.12],
    [0, 0.95, 2, 0.12],
    [-0.95, 0, 0.12, 1.8],
    [0.95, 0, 0.12, 1.8],
  ]) {
    parts.push(part(new THREE.BoxGeometry(w, 0.3, d), WOOD_DARK, { pos: [x, 0.1, z] }));
  }
  parts.push(part(new THREE.BoxGeometry(1.8, 0.28, 1.8), '#6b4a2e', { pos: [0, 0.05, 0], variation: 0.1 }));
  for (let i = -1; i <= 1; i++) parts.push(part(new THREE.BoxGeometry(1.7, 0.06, 0.18), '#5a3c24', { pos: [0, 0.2, i * 0.55] }));
  root.add(mesh(merge(parts)));

  // Planta: três mudas em fileira (crescem com o tempo).
  const leaves: THREE.BufferGeometry[] = [];
  for (let i = -1; i <= 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const leaf = new THREE.ConeGeometry(0.12, 0.6, 4);
      leaf.translate(0, 0.3, 0);
      leaf.rotateZ(0.5);
      leaf.rotateY(a);
      leaf.translate(0, 0, i * 0.55);
      leaves.push(paintLeaf(leaf, k));
    }
  }
  const plant = mesh(merge(leaves));
  plant.position.y = 0.2;
  root.add(plant);
  const tubers: THREE.BufferGeometry[] = [];
  for (let i = -1; i <= 1; i++) {
    tubers.push(part(new THREE.IcosahedronGeometry(0.12, 0), '#c8573a', { pos: [0.18, 0.24, i * 0.55 + 0.1], scale: [1.4, 0.8, 1] }));
    tubers.push(part(new THREE.IcosahedronGeometry(0.1, 0), '#d8693f', { pos: [-0.16, 0.23, i * 0.55 - 0.08], scale: [1.4, 0.8, 1] }));
  }
  const crop = mesh(merge(tubers));
  root.add(crop);
  return { root, plant, crop, variants: { milho: createCornPlants(root), abacaxi: createPineapplePlants(root) } };
}

/** Pés de milho: talos altos com folhas compridas; espigas amarelas quando prontos. */
function createCornPlants(root: THREE.Group): { plant: THREE.Object3D; crop: THREE.Object3D } {
  const stalks: THREE.BufferGeometry[] = [];
  const cobs: THREE.BufferGeometry[] = [];
  for (const [x, z] of [
    [-0.45, -0.55],
    [0.4, -0.5],
    [-0.4, 0.05],
    [0.45, 0.05],
    [-0.42, 0.6],
    [0.4, 0.58],
  ]) {
    stalks.push(part(new THREE.CylinderGeometry(0.035, 0.05, 1.6, 5), '#7dbb4a', { pos: [x, 0.8, z] }));
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.BoxGeometry(0.06, 0.02, 0.7);
      leaf.translate(0, 0, 0.3);
      leaf.rotateX(-0.5);
      leaf.rotateY((k / 3) * Math.PI * 2 + x * 3);
      leaf.translate(x, 0.45 + k * 0.38, z);
      stalks.push(paintLeaf(leaf, k + 1));
    }
    stalks.push(part(new THREE.ConeGeometry(0.06, 0.25, 4), '#d9c27a', { pos: [x, 1.7, z] }));
    cobs.push(part(new THREE.CylinderGeometry(0.06, 0.05, 0.3, 6), '#f5c935', { pos: [x + 0.07, 0.95, z], rot: [0, 0, -0.4] }));
  }
  const plant = mesh(merge(stalks));
  plant.position.y = 0.2;
  const crop = mesh(merge(cobs));
  crop.position.y = 0.2;
  root.add(plant, crop);
  return { plant, crop };
}

/** Abacaxis: rosetas de folhas pontudas e, quando prontos, a fruta no meio. */
function createPineapplePlants(root: THREE.Group): { plant: THREE.Object3D; crop: THREE.Object3D } {
  const leaves: THREE.BufferGeometry[] = [];
  const fruits: THREE.BufferGeometry[] = [];
  for (const z of [-0.5, 0.5]) {
    for (let k = 0; k < 8; k++) {
      const leaf = new THREE.ConeGeometry(0.05, 0.7, 3);
      leaf.translate(0, 0.35, 0);
      leaf.rotateZ(0.7 + (k % 2) * 0.25);
      leaf.rotateY((k / 8) * Math.PI * 2);
      leaf.translate(0, 0, z);
      leaves.push(part(leaf, k % 2 ? '#3f8f5a' : '#4fa66a', { seed: k }));
    }
    fruits.push(part(new THREE.IcosahedronGeometry(0.17, 0), '#f2b632', { pos: [0, 0.32, z], scale: [1, 1.4, 1] }));
    fruits.push(part(new THREE.ConeGeometry(0.1, 0.25, 5), '#4caf50', { pos: [0, 0.65, z] }));
  }
  const plant = mesh(merge(leaves));
  plant.position.y = 0.2;
  const crop = mesh(merge(fruits));
  crop.position.y = 0.2;
  root.add(plant, crop);
  return { plant, crop };
}

function paintLeaf(geometry: THREE.BufferGeometry, seed: number): THREE.BufferGeometry {
  return part(geometry, seed % 2 ? '#4caf50' : '#66c95a', { seed });
}

function createFloor(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  // Estrutura que desce até o chão (esconde desníveis) e tábuas por cima.
  parts.push(part(new THREE.BoxGeometry(2, 1.4, 2), WOOD_DARK, { pos: [0, -0.62, 0] }));
  for (let i = 0; i < 5; i++) {
    parts.push(part(new THREE.BoxGeometry(2, 0.1, 0.38), i % 2 ? WOOD_LIGHT : '#c4925e', { pos: [0, 0.1, -0.8 + i * 0.4], seed: i }));
  }
  root.add(mesh(merge(parts)));
  return { root };
}

/** Parede modular de 2 m (centrada na origem, ao longo do eixo X). */
function createWall(kind: 'lisa' | 'porta' | 'janela'): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const logs = 6;
  const r = WALL_H / logs / 2;
  for (let i = 0; i < logs; i++) {
    const y = r + i * r * 2;
    const color = i % 2 === 0 ? WOOD : WOOD_DARK;
    const gapDoor = kind === 'porta' && i < 5;
    const gapWindow = kind === 'janela' && (i === 2 || i === 3);
    if (gapDoor || gapWindow) {
      const gap = gapDoor ? 1.0 : 0.9;
      const seg = (2.1 - gap) / 2;
      for (const side of [-1, 1]) {
        parts.push(part(new THREE.CylinderGeometry(r, r, seg, 6), color, { rot: [0, 0, Math.PI / 2], pos: [side * (gap / 2 + seg / 2), y, 0], seed: i }));
      }
    } else {
      parts.push(part(new THREE.CylinderGeometry(r, r, 2.1, 6), color, { rot: [0, 0, Math.PI / 2], pos: [0, y, 0], seed: i }));
    }
  }
  // Postes nas pontas (escondem as emendas) e viga de base que desce até o chão.
  for (const side of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.22, WALL_H + 0.1, 0.32), WOOD_DARK, { pos: [side * 1, WALL_H / 2, 0] }));
  parts.push(part(new THREE.BoxGeometry(2.1, 1.0, 0.3), STONE, { pos: [0, -0.5, 0], variation: 0.08 }));
  if (kind === 'porta') parts.push(part(new THREE.BoxGeometry(1.2, 0.14, 0.32), WOOD_DARK, { pos: [0, 2.2, 0] }));
  if (kind === 'janela') {
    parts.push(part(new THREE.BoxGeometry(1.0, 0.08, 0.36), WOOD_LIGHT, { pos: [0, 0.86, 0] }));
    parts.push(part(new THREE.BoxGeometry(0.06, 0.86, 0.06), WOOD_DARK, { pos: [0, 1.3, 0] }));
  }
  root.add(mesh(merge(parts)));
  return { root };
}

function createRoofTile(): StructureModel {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(new THREE.BoxGeometry(2.3, 0.12, 2.3), WOOD_DARK, { pos: [0, 0.06, 0] }));
  // Palha em camadas (com beiral).
  for (let i = 0; i < 4; i++) {
    parts.push(part(new THREE.BoxGeometry(2.4 - i * 0.25, 0.12, 2.4 - i * 0.25), i % 2 ? '#d9b45a' : '#c9a24a', { pos: [0, 0.16 + i * 0.1, 0], variation: 0.12, seed: i }));
  }
  const roof = mesh(merge(parts));
  root.add(roof);
  return { root, roof };
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
