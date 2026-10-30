/**
 * Marcos da Ilha do Eco (capítulo 3):
 * - acampamento da capitã Iara (barraca, fogueira e a própria Iara);
 * - três sinos antigos, cada um com uma nota (grave, média e aguda);
 * - o Templo do Eco: um anel de pedras com um altar de cristal. Depois que
 *   os três sinos tocam, a Guardiã dos Lumeni aparece no meio do templo.
 */
import * as THREE from 'three';
import type { CollisionWorld } from '../Collision';
import type { InteractionSystem } from '../InteractionSystem';
import type { LightManager, LightSource } from '../LightManager';
import { createFlatMaterial, merge, part } from '../models/geometry';
import { ECO_PLACES } from './islands';
import type { Place } from './layout';
import type { HeightField } from './Terrain';

export type BellId = 'oeste' | 'sul' | 'leste';

export interface BellDef {
  id: BellId;
  name: string;
  /** Altura da nota: grave, média, aguda. */
  pitch: 'grave' | 'média' | 'aguda';
  /** Frequência da nota (Hz). */
  freq: number;
  place: Place;
}

export const BELLS: BellDef[] = [
  { id: 'oeste', name: 'Sino do Oeste', pitch: 'grave', freq: 196, place: ECO_PLACES.bellWest },
  { id: 'sul', name: 'Sino do Sul', pitch: 'média', freq: 262, place: ECO_PLACES.bellSouth },
  { id: 'leste', name: 'Sino do Leste', pitch: 'aguda', freq: 392, place: ECO_PLACES.bellEast },
];

/** A canção dos Lumeni: do mais grave ao mais agudo, "como o sol que sobe". */
export const LUMENI_SONG: BellId[] = ['oeste', 'sul', 'leste'];

export interface EcoHooks {
  hasFlag(flag: string): boolean;
  setFlag(flag: string): void;
  ringBell(bell: BellDef): void;
  talkToIara(): void;
  talkToGuardian(): void;
}

interface BellState {
  def: BellDef;
  bell: THREE.Object3D;
  swing: number;
}

export class EcoLandmarks {
  readonly group = new THREE.Group();
  private readonly material = createFlatMaterial();
  private readonly bells: BellState[] = [];
  private iara!: THREE.Group;
  private iaraHead!: THREE.Object3D;
  private guardian!: THREE.Group;
  private guardianMat!: THREE.MeshBasicMaterial;
  private altarCrystal!: THREE.Mesh;
  private beam!: THREE.Mesh;
  private templeLight!: LightSource;
  private guardianShown = 0;

  constructor(
    private readonly terrain: HeightField,
    private readonly collision: CollisionWorld,
    private readonly interaction: InteractionSystem,
    private readonly lights: LightManager,
    private readonly hooks: EcoHooks,
  ) {
    this.group.name = 'Marcos do Eco';
  }

  build(): void {
    this.buildCamp();
    for (const def of BELLS) this.buildBell(def);
    this.buildTemple();
  }

  /** Todos os sinos já tocaram? (a guardiã aparece) */
  get allBellsRung(): boolean {
    return BELLS.every((b) => this.hooks.hasFlag(`sino_${b.id}`));
  }

  applyFlags(): void {
    const awake = this.hooks.hasFlag('eco_cancao');
    this.beam.visible = awake;
    (this.altarCrystal.material as THREE.MeshLambertMaterial).emissiveIntensity = awake ? 1.6 : 0.4;
    this.templeLight.intensity = awake ? 22 : 8;
    if (!this.allBellsRung) this.guardianShown = 0;
  }

  update(dt: number, elapsed: number, player: THREE.Vector3): void {
    for (const b of this.bells) {
      b.swing = Math.max(0, b.swing - dt * 0.6);
      b.bell.rotation.x = Math.sin(elapsed * 9) * 0.5 * b.swing;
    }
    // Iara olha para o jogador quando ele chega perto.
    const camp = this.iara.position;
    if (Math.hypot(player.x - camp.x, player.z - camp.z) < 10) {
      const target = Math.atan2(player.x - camp.x, player.z - camp.z) - this.iara.rotation.y;
      this.iaraHead.rotation.y += (Math.atan2(Math.sin(target), Math.cos(target)) * 0.8 - this.iaraHead.rotation.y) * Math.min(1, dt * 4);
    } else {
      this.iaraHead.rotation.y = Math.sin(elapsed * 0.4) * 0.4;
    }
    this.iara.children[0].scale.y = 1 + Math.sin(elapsed * 2) * 0.015;

    // A guardiã surge aos poucos depois dos três sinos e flutua no templo.
    const target = this.allBellsRung ? 1 : 0;
    this.guardianShown += (target - this.guardianShown) * Math.min(1, dt * 0.8);
    this.guardian.visible = this.guardianShown > 0.02;
    this.guardianMat.opacity = this.guardianShown * (0.7 + Math.sin(elapsed * 2.2) * 0.1);
    const t = this.terrain.getHeight(ECO_PLACES.temple.x, ECO_PLACES.temple.z);
    this.guardian.position.y = t + 1.2 + Math.sin(elapsed * 1.3) * 0.15;
    this.guardian.rotation.y = Math.atan2(player.x - this.guardian.position.x, player.z - this.guardian.position.z);
    this.altarCrystal.rotation.y = elapsed * 0.5;
    if (this.beam.visible) (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.32 + Math.sin(elapsed * 1.5) * 0.08;
  }

  // ---------------------------------------------------------------------------

  private mesh(geometry: THREE.BufferGeometry): THREE.Mesh {
    const m = new THREE.Mesh(geometry, this.material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  private buildCamp(): void {
    const c = ECO_PLACES.camp;
    const y = this.terrain.getHeight(c.x, c.z);
    // Barraca de lona, fogueira de pedras e caixotes.
    const tent = this.mesh(
      merge([
        part(new THREE.ConeGeometry(2.2, 2.4, 4), '#d9c9a3', { pos: [0, 1.2, 0], rot: [0, Math.PI / 4, 0] }),
        part(new THREE.BoxGeometry(0.9, 1.3, 0.05), '#5a4630', { pos: [0, 0.65, 1.56] }),
        part(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5), '#7a5232', { pos: [0, 1.4, 0] }),
        part(new THREE.BoxGeometry(0.8, 0.6, 0.6), '#9a6a3f', { pos: [2.4, 0.3, -0.6], rot: [0, 0.4, 0] }),
        part(new THREE.BoxGeometry(0.6, 0.5, 0.5), '#8a5a2e', { pos: [2.6, 0.85, -0.5], rot: [0, -0.3, 0] }),
      ]),
    );
    tent.position.set(c.x - 2, y, c.z - 2);
    this.group.add(tent);
    this.collision.add({ kind: 'circle', x: c.x - 2, z: c.z - 2, r: 1.7, top: y + 2.4 });
    this.collision.add({ kind: 'box', x: c.x + 0.4, z: c.z - 2.6, hw: 0.6, hd: 0.5, rot: 0.4, top: y + 1.1 });

    const fire = this.mesh(
      merge([
        ...[0, 1, 2, 3, 4, 5, 6].map((i) =>
          part(new THREE.DodecahedronGeometry(0.18, 0), '#7d7a74', { pos: [Math.cos(i * 0.9) * 0.55, 0.1, Math.sin(i * 0.9) * 0.55] }),
        ),
        part(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), '#5a3c24', { pos: [0, 0.15, 0], rot: [0, 0, Math.PI / 2] }),
        part(new THREE.ConeGeometry(0.25, 0.6, 5), '#ff9b3d', { pos: [0, 0.4, 0] }),
        part(new THREE.ConeGeometry(0.14, 0.45, 5), '#ffe066', { pos: [0, 0.4, 0] }),
      ]),
    );
    fire.position.set(c.x + 2, y, c.z + 1.5);
    this.group.add(fire);
    this.lights.add({
      position: new THREE.Vector3(c.x + 2, y + 1, c.z + 1.5),
      color: new THREE.Color('#ff9b4a'),
      intensity: 14,
      distance: 14,
      flicker: true,
      nightOnly: false,
    });

    // Iara: casaco azul, chapéu de capitã e cachecol vermelho.
    const iara = new THREE.Group();
    const body = this.mesh(
      merge([
        part(new THREE.BoxGeometry(0.16, 0.8, 0.18), '#3b3b46', { pos: [-0.12, 0.4, 0] }),
        part(new THREE.BoxGeometry(0.16, 0.8, 0.18), '#3b3b46', { pos: [0.12, 0.4, 0] }),
        part(new THREE.BoxGeometry(0.52, 0.7, 0.3), '#2f6fb0', { pos: [0, 1.15, 0] }),
        part(new THREE.BoxGeometry(0.14, 0.62, 0.14), '#2f6fb0', { pos: [-0.33, 1.15, 0], rot: [0, 0, 0.12] }),
        part(new THREE.BoxGeometry(0.14, 0.62, 0.14), '#2f6fb0', { pos: [0.33, 1.15, 0], rot: [0, 0, -0.12] }),
        part(new THREE.BoxGeometry(0.54, 0.12, 0.32), '#d62828', { pos: [0, 1.5, 0] }),
        part(new THREE.BoxGeometry(0.12, 0.3, 0.05), '#d62828', { pos: [0.15, 1.32, 0.17] }),
      ]),
    );
    iara.add(body);
    const head = new THREE.Group();
    head.position.y = 1.56;
    head.add(
      this.mesh(
        merge([
          part(new THREE.BoxGeometry(0.34, 0.36, 0.32), '#c68b59', { pos: [0, 0.2, 0] }),
          part(new THREE.BoxGeometry(0.38, 0.14, 0.36), '#3d2b1f', { pos: [0, 0.36, -0.03] }),
          part(new THREE.BoxGeometry(0.36, 0.3, 0.12), '#3d2b1f', { pos: [0, 0.22, -0.18] }),
          part(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 8), '#1f2a44', { pos: [0, 0.42, 0] }),
          part(new THREE.CylinderGeometry(0.2, 0.22, 0.18, 8), '#1f2a44', { pos: [0, 0.52, 0] }),
          part(new THREE.BoxGeometry(0.05, 0.05, 0.02), '#ffd166', { pos: [0, 0.53, 0.21] }),
          part(new THREE.BoxGeometry(0.05, 0.05, 0.02), '#111111', { pos: [0.08, 0.24, 0.165] }),
          part(new THREE.BoxGeometry(0.05, 0.05, 0.02), '#111111', { pos: [-0.08, 0.24, 0.165] }),
        ]),
      ),
    );
    iara.add(head);
    iara.position.set(c.x + 1, y, c.z + 3.5);
    iara.rotation.y = Math.PI * 0.85;
    this.group.add(iara);
    this.collision.add({ kind: 'circle', x: c.x + 1, z: c.z + 3.5, r: 0.35, top: y + 2 });
    this.iara = iara;
    this.iaraHead = head;

    this.interaction.register({
      id: 'iara',
      position: new THREE.Vector3(c.x + 1, y + 1.2, c.z + 3.5),
      radius: 1.6,
      getAction: () => ({ label: 'Conversar com Iara', enabled: true }),
      interact: () => this.hooks.talkToIara(),
    });
  }

  private buildBell(def: BellDef): void {
    const { x, z } = def.place;
    const y = this.terrain.getHeight(x, z);
    const frame = this.mesh(
      merge([
        part(new THREE.BoxGeometry(0.22, 2.8, 0.22), '#6b4a2f', { pos: [-0.9, 1.4, 0] }),
        part(new THREE.BoxGeometry(0.22, 2.8, 0.22), '#6b4a2f', { pos: [0.9, 1.4, 0] }),
        part(new THREE.BoxGeometry(2.3, 0.24, 0.3), '#7a5232', { pos: [0, 2.85, 0] }),
        part(new THREE.CylinderGeometry(1.1, 1.3, 0.25, 8), '#8d8a84', { pos: [0, 0.12, 0] }),
      ]),
    );
    frame.position.set(x, y, z);
    frame.rotation.y = Math.atan2(ECO_PLACES.temple.x - x, ECO_PLACES.temple.z - z);
    this.group.add(frame);
    this.collision.add({ kind: 'circle', x, z, r: 1.15, top: y + 0.25 });

    // O sino balança preso na viga (o pivô fica no topo).
    const bell = new THREE.Group();
    bell.position.set(0, 2.72, 0);
    const size = def.pitch === 'grave' ? 1.15 : def.pitch === 'média' ? 0.95 : 0.78;
    const shape = [
      new THREE.Vector2(0.05, 0),
      new THREE.Vector2(0.22, -0.05),
      new THREE.Vector2(0.3, -0.35),
      new THREE.Vector2(0.36, -0.7),
      new THREE.Vector2(0.48, -0.85),
      new THREE.Vector2(0.46, -0.9),
      new THREE.Vector2(0.0, -0.9),
    ].map((v) => v.multiplyScalar(size));
    bell.add(
      this.mesh(
        merge([
          part(new THREE.LatheGeometry(shape, 10), '#c9953a', {}),
          part(new THREE.SphereGeometry(0.09 * size, 6, 4), '#7a5a2a', { pos: [0, -0.92 * size, 0] }),
        ]),
      ),
    );
    frame.add(bell);
    this.bells.push({ def, bell, swing: 0 });

    this.interaction.register({
      id: `sino_${def.id}`,
      position: new THREE.Vector3(x, y + 1.6, z),
      radius: 2,
      getAction: () => ({ label: `Tocar o ${def.name}`, enabled: true }),
      interact: () => {
        const state = this.bells.find((b) => b.def === def)!;
        state.swing = 1;
        this.hooks.ringBell(def);
      },
    });
  }

  /** Faz o sino balançar (também usado quando a guardiã "canta" uma nota). */
  swingBell(id: BellId): void {
    const state = this.bells.find((b) => b.def.id === id);
    if (state) state.swing = 1;
  }

  private buildTemple(): void {
    const t = ECO_PLACES.temple;
    const y = this.terrain.getHeight(t.x, t.z);
    // Anel de pedras em pé com um altar no meio.
    const stones: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sx = Math.cos(a) * 9;
      const sz = Math.sin(a) * 9;
      const h = 3 + (i % 3) * 0.6;
      stones.push(part(new THREE.BoxGeometry(1, h, 0.7), '#8e9aa3', { pos: [sx, h / 2, sz], rot: [0, -a, 0.04 * (i % 2 ? 1 : -1)], variation: 0.08, seed: i }));
      stones.push(part(new THREE.BoxGeometry(0.5, 0.08, 0.72), '#9fe8ff', { pos: [sx, h * 0.7, sz], rot: [0, -a, 0] }));
      this.collision.add({ kind: 'box', x: t.x + sx, z: t.z + sz, hw: 0.5, hd: 0.35, rot: a, top: y + h });
    }
    stones.push(part(new THREE.CylinderGeometry(1.3, 1.6, 0.9, 8), '#8e9aa3', { pos: [0, 0.45, 0] }));
    stones.push(part(new THREE.CylinderGeometry(4, 4.2, 0.15, 16), '#a7b0b6', { pos: [0, 0.07, 0], variation: 0.06 }));
    const ring = this.mesh(merge(stones));
    ring.position.set(t.x, y, t.z);
    this.group.add(ring);
    this.collision.add({ kind: 'circle', x: t.x, z: t.z, r: 1.4, top: y + 0.9 });

    this.altarCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshLambertMaterial({ color: '#9fe8ff', emissive: new THREE.Color('#58c8ff'), emissiveIntensity: 0.4, flatShading: true }),
    );
    this.altarCrystal.scale.set(1, 1.6, 1);
    this.altarCrystal.position.set(t.x, y + 1.8, t.z);
    this.group.add(this.altarCrystal);
    this.templeLight = this.lights.add({
      position: new THREE.Vector3(t.x, y + 2.5, t.z),
      color: new THREE.Color('#7fd8ff'),
      intensity: 8,
      distance: 18,
      flicker: false,
      nightOnly: false,
    });

    // Feixe de luz até o céu (depois da canção).
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.2, 120, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#bff3ff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.beam.position.set(t.x, y + 60, t.z);
    this.beam.visible = false;
    this.group.add(this.beam);

    // A Guardiã: uma figura de luz, translúcida, de manto longo.
    this.guardianMat = new THREE.MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0, depthWrite: false, fog: false });
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        merge([
          part(new THREE.ConeGeometry(0.55, 1.8, 8), '#ffffff', { pos: [0, 0.9, 0] }),
          part(new THREE.SphereGeometry(0.26, 8, 6), '#ffffff', { pos: [0, 2, 0] }),
          part(new THREE.TorusGeometry(0.34, 0.03, 4, 16), '#ffffff', { pos: [0, 2.35, 0], rot: [Math.PI / 2, 0, 0] }),
          part(new THREE.BoxGeometry(1.6, 0.12, 0.1), '#ffffff', { pos: [0, 1.4, 0] }),
        ]),
        this.guardianMat,
      ),
    );
    g.position.set(t.x, y + 1.2, t.z + 2.6);
    g.scale.setScalar(1.4);
    g.visible = false;
    this.group.add(g);
    this.guardian = g;

    this.interaction.register({
      id: 'guardia',
      position: new THREE.Vector3(t.x, y + 1.5, t.z + 2.6),
      radius: 2.6,
      getAction: () =>
        this.allBellsRung
          ? { label: 'Falar com a Guardiã do Eco', enabled: true }
          : { label: 'Altar do Eco', enabled: false, reason: 'O altar está em silêncio. Toque os três sinos da ilha.' },
      interact: () => this.hooks.talkToGuardian(),
    });
  }
}
