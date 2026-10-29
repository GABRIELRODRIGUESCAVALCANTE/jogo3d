/**
 * Personagem do jogador: um explorador low-poly montado com caixas.
 * As partes (pernas, braços, cabeça) ficam em "pivôs" para que possam ser
 * animadas por código, sem arquivos de animação.
 */
import * as THREE from 'three';
import { createFlatMaterial, merge, part } from './geometry';

export type HeldTool = 'none' | 'machado' | 'picareta' | 'tocha';

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  tools: Record<Exclude<HeldTool, 'none'>, THREE.Object3D>;
  /** Ponta da tocha (onde fica a luz). */
  torchTip: THREE.Object3D;
  flame: THREE.Mesh;
}

const SKIN = '#f1c27d';
const SHIRT = '#2ec4b6';
const SHIRT_DARK = '#23a597';
const PANTS = '#35506b';
const BOOTS = '#5a3b26';
const HAT = '#c8955a';
const HAT_BAND = '#7a4e2a';
const PACK = '#a0643a';

export function createCharacter(): CharacterRig {
  const material = createFlatMaterial();
  const mesh = (geo: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    return m;
  };

  const root = new THREE.Group();
  root.name = 'Jogador';
  const body = new THREE.Group();
  root.add(body);

  // Tronco + mochila
  body.add(
    mesh(
      merge([
        part(new THREE.BoxGeometry(0.62, 0.7, 0.36), SHIRT, { pos: [0, 1.27, 0] }),
        part(new THREE.BoxGeometry(0.64, 0.12, 0.38), SHIRT_DARK, { pos: [0, 0.96, 0] }),
        part(new THREE.BoxGeometry(0.5, 0.56, 0.24), PACK, { pos: [0, 1.28, -0.29] }),
        part(new THREE.BoxGeometry(0.52, 0.16, 0.27), '#8a5330', { pos: [0, 1.5, -0.3] }),
        part(new THREE.BoxGeometry(0.62, 0.1, 0.38), '#4a3322', { pos: [0, 0.91, 0] }),
      ]),
    ),
  );

  // Cabeça com chapéu de explorador e olhos (mostram para onde ele olha).
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  head.add(
    mesh(
      merge([
        part(new THREE.BoxGeometry(0.44, 0.42, 0.42), SKIN, { pos: [0, 0.21, 0] }),
        part(new THREE.BoxGeometry(0.07, 0.08, 0.02), '#2b2b2b', { pos: [-0.1, 0.24, 0.215] }),
        part(new THREE.BoxGeometry(0.07, 0.08, 0.02), '#2b2b2b', { pos: [0.1, 0.24, 0.215] }),
        part(new THREE.BoxGeometry(0.46, 0.12, 0.2), '#5b3a1e', { pos: [0, 0.3, -0.13] }),
        part(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 10), HAT, { pos: [0, 0.44, 0] }),
        part(new THREE.CylinderGeometry(0.25, 0.27, 0.22, 10), HAT, { pos: [0, 0.56, 0] }),
        part(new THREE.CylinderGeometry(0.275, 0.275, 0.06, 10), HAT_BAND, { pos: [0, 0.49, 0] }),
      ]),
    ),
  );
  body.add(head);

  // Braços (pivô no ombro).
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(0.41 * side, 1.56, 0);
    arm.add(
      mesh(
        merge([
          part(new THREE.BoxGeometry(0.18, 0.36, 0.2), SHIRT, { pos: [0, -0.16, 0] }),
          part(new THREE.BoxGeometry(0.16, 0.3, 0.17), SKIN, { pos: [0, -0.48, 0] }),
        ]),
      ),
    );
    body.add(arm);
    return arm;
  };
  const leftArm = makeArm(1);
  const rightArm = makeArm(-1);

  // Pernas (pivô no quadril).
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.16 * side, 0.88, 0);
    leg.add(
      mesh(
        merge([
          part(new THREE.BoxGeometry(0.22, 0.66, 0.24), PANTS, { pos: [0, -0.33, 0] }),
          part(new THREE.BoxGeometry(0.24, 0.2, 0.32), BOOTS, { pos: [0, -0.78, 0.04] }),
        ]),
      ),
    );
    root.add(leg);
    return leg;
  };
  const leftLeg = makeLeg(1);
  const rightLeg = makeLeg(-1);

  // Ferramentas na mão direita (só uma visível por vez).
  const hand = new THREE.Group();
  hand.position.set(0, -0.6, 0.05);
  rightArm.add(hand);

  const axe = mesh(
    merge([
      part(new THREE.CylinderGeometry(0.035, 0.04, 0.8, 5), '#8b5a2b', { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.25] }),
      part(new THREE.BoxGeometry(0.05, 0.28, 0.2), '#9aa0a6', { pos: [0, 0.1, 0.58] }),
      part(new THREE.BoxGeometry(0.06, 0.06, 0.1), '#c9a26b', { pos: [0, -0.02, 0.56] }),
    ]),
  );
  const pickaxe = mesh(
    merge([
      part(new THREE.CylinderGeometry(0.035, 0.04, 0.85, 5), '#8b5a2b', { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.27] }),
      part(new THREE.BoxGeometry(0.06, 0.07, 0.62), '#8d9196', { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.66] }),
    ]),
  );
  const torch = new THREE.Group();
  torch.add(mesh(part(new THREE.CylinderGeometry(0.035, 0.045, 0.6, 5), '#6b4423', { rot: [Math.PI / 2.6, 0, 0], pos: [0, 0.08, 0.16] })));
  const torchTip = new THREE.Object3D();
  torchTip.position.set(0, 0.22, 0.42);
  torch.add(torchTip);
  const flame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.1, 0),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.95, fog: false }),
  );
  flame.position.copy(torchTip.position);
  flame.scale.set(1, 1.6, 1);
  torch.add(flame);

  for (const tool of [axe, pickaxe, torch]) {
    tool.visible = false;
    hand.add(tool);
  }

  return {
    root,
    body,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    tools: { machado: axe, picareta: pickaxe, tocha: torch },
    torchTip,
    flame,
  };
}
