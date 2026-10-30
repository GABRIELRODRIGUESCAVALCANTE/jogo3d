/**
 * Marcos especiais do mundo: destroços do barco, baús, árvore gigante,
 * ruínas (monólito, altar e portal), caverna com entulho e o farol do pico.
 * Eles conduzem a história e as missões principais.
 */
import * as THREE from 'three';
import type { SoundName } from '../../core/AudioManager';
import { createRandom } from '../../core/math';
import type { CollisionWorld, Collider } from '../Collision';
import type { ItemBundle } from '../data/items';
import type { NotifyKind } from '../events';
import type { InteractionSystem } from '../InteractionSystem';
import type { LightManager, LightSource } from '../LightManager';
import { createFlatMaterial, jitter, merge, paint, part } from '../models/geometry';
import { makeBroadleafTree } from '../models/props';
import type { HeightField } from './Terrain';
import { PLACES, type Place } from './layout';

export interface LandmarkHooks {
  hasFlag(flag: string): boolean;
  setFlag(flag: string): void;
  hasItems(bundle: ItemBundle): boolean;
  takeItems(bundle: ItemBundle): boolean;
  giveItems(bundle: ItemBundle): void;
  showLore(key: string): void;
  sound(name: SoundName): void;
  burst(position: THREE.Vector3, color: string, count: number): void;
  notify(text: string, kind?: NotifyKind): void;
  addXP(amount: number): void;
  shake(amount: number): void;
  onEnding(): void;
}

/** Área onde a câmera fica mais perto (caverna, cabana). */
export interface CameraZone {
  x: number;
  z: number;
  radius: number;
  maxDistance: number;
  /** Objetos escondidos enquanto o jogador está dentro (tetos). */
  hide?: THREE.Object3D[];
  /** Só vale com o jogador abaixo desta altura (ex.: embaixo do segundo andar). */
  below?: number;
}

interface ChestState {
  lid: THREE.Group;
  sparkle: THREE.Mesh;
  openAmount: number;
}

const CHEST_LOOT: Record<string, ItemBundle> = {
  bau_praia: { reliquia: 1, corda: 2, fruta: 3 },
  bau_floresta: { reliquia: 1, tocha: 1, pedra: 4 },
  bau_caverna: { reliquia: 1, cristal: 2 },
};

const STONE = '#b9b1a1';
const STONE_DARK = '#8e877b';
const ALTAR_COST: ItemBundle = { reliquia: 3, cristal: 5 };

export class Landmarks {
  readonly group = new THREE.Group();
  readonly cameraZones: CameraZone[] = [];

  private readonly material = createFlatMaterial();
  private readonly glyphMaterial = new THREE.MeshLambertMaterial({
    color: '#5ee8ff',
    emissive: new THREE.Color('#2fc6ff'),
    emissiveIntensity: 0.8,
  });
  private readonly chests = new Map<string, ChestState>();
  private rubble!: THREE.Group;
  private rubbleCollider: Collider | null = null;
  private rubbleShrink = 1;
  private portalSurface!: THREE.Mesh;
  private portalBeam!: THREE.Mesh;
  private portalLight!: LightSource;
  private altarGems: THREE.Mesh[] = [];
  private portalActive = 0;
  private beaconFire!: THREE.Group;
  private beaconBeam!: THREE.Mesh;
  private beaconLight!: LightSource;
  private beaconLit = 0;
  private readonly portalUniforms = { uTime: { value: 0 }, uActive: { value: 0 } };

  constructor(
    private readonly terrain: HeightField,
    private readonly collision: CollisionWorld,
    private readonly interaction: InteractionSystem,
    private readonly lights: LightManager,
    private readonly hooks: LandmarkHooks,
  ) {
    this.group.name = 'Marcos';
  }

  build(): void {
    this.buildShipwreck();
    this.buildChest('bau_praia', PLACES.chestBeach, 0.6);
    this.buildGiantTree();
    this.buildChest('bau_floresta', PLACES.chestForest, -2.4);
    this.buildRuins();
    this.buildCave();
    this.buildChest('bau_caverna', PLACES.chestCave, Math.PI);
    this.buildPeak();
  }

  /** Ajusta o visual conforme os marcadores salvos (baús abertos etc.). */
  applyFlags(): void {
    for (const [id, chest] of this.chests) {
      const opened = this.hooks.hasFlag(id);
      chest.openAmount = opened ? 1 : 0;
      chest.lid.rotation.x = opened ? -1.9 : 0;
      chest.sparkle.visible = !opened;
    }
    const cleared = this.hooks.hasFlag('entulho');
    this.rubble.visible = !cleared;
    this.rubbleShrink = cleared ? 0 : 1;
    this.rubble.scale.setScalar(1);
    if (cleared && this.rubbleCollider) {
      this.collision.remove(this.rubbleCollider);
      this.rubbleCollider = null;
    } else if (!cleared && !this.rubbleCollider) {
      this.addRubbleCollider();
    }
    this.portalActive = this.hooks.hasFlag('portal') ? 1 : 0;
    this.beaconLit = this.hooks.hasFlag('farol') ? 1 : 0;
    this.updatePortalVisuals();
    this.updateBeaconVisuals();
  }

  update(dt: number, elapsed: number): void {
    // Baús: tampa abrindo e brilho flutuante.
    for (const chest of this.chests.values()) {
      if (chest.sparkle.visible) {
        chest.sparkle.rotation.y += dt * 2;
        chest.sparkle.position.y = 1.35 + Math.sin(elapsed * 2.5) * 0.12;
      }
      if (chest.openAmount > 0 && chest.lid.rotation.x > -1.9) {
        chest.lid.rotation.x = Math.max(-1.9, chest.lid.rotation.x - dt * 4);
      }
    }
    // Entulho encolhendo depois de quebrado.
    if (this.rubble.visible && this.hooks.hasFlag('entulho')) {
      this.rubbleShrink = Math.max(0, this.rubbleShrink - dt * 2.5);
      this.rubble.scale.setScalar(this.rubbleShrink);
      if (this.rubbleShrink <= 0) this.rubble.visible = false;
    }
    // Símbolos pulsando.
    this.glyphMaterial.emissiveIntensity = 0.55 + Math.sin(elapsed * 1.6) * 0.25 + this.portalActive * 0.4;
    this.portalUniforms.uTime.value = elapsed;
    if (this.portalActive > 0 && this.portalActive < 1) {
      this.portalActive = Math.min(1, this.portalActive + dt * 0.4);
      this.updatePortalVisuals();
    }
    if (this.beaconLit > 0 && this.beaconLit < 1) {
      this.beaconLit = Math.min(1, this.beaconLit + dt * 0.5);
      this.updateBeaconVisuals();
    }
    if (this.beaconLit > 0) {
      const flick = 1 + Math.sin(elapsed * 9) * 0.08 + Math.sin(elapsed * 15.3) * 0.05;
      this.beaconFire.scale.set(this.beaconLit, this.beaconLit * flick, this.beaconLit);
      this.beaconFire.rotation.y += dt * 0.6;
    }
    if (this.portalActive > 0) this.portalBeam.rotation.y += dt * 0.3;
  }

  // ---------------------------------------------------------------------------
  // Construção dos marcos
  // ---------------------------------------------------------------------------

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material = this.material): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  private ground(p: Place): number {
    return this.terrain.getHeight(p.x, p.z);
  }

  private buildShipwreck(): void {
    const p = PLACES.shipwreck;
    const y = this.ground(p);
    const group = new THREE.Group();
    const hull = merge([
      part(new THREE.BoxGeometry(2.2, 0.3, 6), '#7b5434', { pos: [0, 0.15, 0] }),
      part(new THREE.BoxGeometry(0.22, 1.3, 5.4), '#8d6240', { pos: [1.15, 0.7, 0], rot: [0, 0, -0.25] }),
      part(new THREE.BoxGeometry(0.22, 1.1, 4.2), '#8d6240', { pos: [-1.15, 0.55, 0.6], rot: [0, 0, 0.3] }),
      part(new THREE.BoxGeometry(1.6, 1.2, 0.22), '#6e4a2d', { pos: [0, 0.7, -2.9] }),
      part(new THREE.BoxGeometry(2.0, 0.12, 0.3), '#a07550', { pos: [0, 0.9, -1] }),
      part(new THREE.CylinderGeometry(0.12, 0.15, 4.6, 6), '#9c7a52', { pos: [2.2, 0.25, 1.8], rot: [0, 0.4, Math.PI / 2] }),
      part(new THREE.PlaneGeometry(2.2, 1.6), '#efe6cf', { pos: [2.6, 0.12, 3.3], rot: [-Math.PI / 2 + 0.15, 0, 0.3] }),
      part(new THREE.BoxGeometry(0.6, 0.6, 0.6), '#8a6a45', { pos: [-2.4, 0.3, -1.2], rot: [0, 0.5, 0] }),
    ]);
    group.add(this.mesh(hull, createFlatMaterial({ side: THREE.DoubleSide })));
    group.position.set(p.x, y - 0.25, p.z);
    group.rotation.set(0.05, 0.9, 0.12);
    this.group.add(group);
    this.collision.add({ kind: 'box', x: p.x, z: p.z, hw: 1.3, hd: 3, rot: 0.9, top: y + 1.2 });

    this.interaction.register({
      id: 'destrocos',
      position: new THREE.Vector3(p.x, y + 1, p.z),
      radius: 3.2,
      getAction: () => ({ label: 'Examinar destroços', enabled: true }),
      interact: () => {
        if (!this.hooks.hasFlag('destrocos')) {
          this.hooks.setFlag('destrocos');
          this.hooks.addXP(10);
        }
        this.hooks.showLore('destrocos');
      },
    });
  }

  private buildChest(id: string, p: Place, rot: number): void {
    const y = this.ground(p);
    const group = new THREE.Group();
    group.position.set(p.x, y, p.z);
    group.rotation.y = rot;
    const gold = '#e0b44c';
    group.add(
      this.mesh(
        merge([
          part(new THREE.BoxGeometry(1.1, 0.6, 0.7), '#8b5a2b', { pos: [0, 0.3, 0] }),
          part(new THREE.BoxGeometry(1.14, 0.08, 0.74), gold, { pos: [0, 0.12, 0] }),
          part(new THREE.BoxGeometry(0.08, 0.62, 0.74), gold, { pos: [-0.4, 0.31, 0] }),
          part(new THREE.BoxGeometry(0.08, 0.62, 0.74), gold, { pos: [0.4, 0.31, 0] }),
        ]),
      ),
    );
    const lid = new THREE.Group();
    lid.position.set(0, 0.6, -0.35);
    lid.add(
      this.mesh(
        merge([
          part(new THREE.BoxGeometry(1.12, 0.28, 0.72), '#9c6633', { pos: [0, 0.14, 0.36] }),
          part(new THREE.BoxGeometry(1.16, 0.06, 0.76), gold, { pos: [0, 0.29, 0.36] }),
          part(new THREE.BoxGeometry(0.16, 0.2, 0.06), gold, { pos: [0, 0.02, 0.74] }),
        ]),
      ),
    );
    group.add(lid);
    const sparkle = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.9 }),
    );
    sparkle.position.y = 1.35;
    group.add(sparkle);
    this.group.add(group);
    this.chests.set(id, { lid, sparkle, openAmount: 0 });
    this.collision.add({ kind: 'box', x: p.x, z: p.z, hw: 0.6, hd: 0.4, rot, top: y + 0.9 });

    this.interaction.register({
      id,
      position: new THREE.Vector3(p.x, y + 0.5, p.z),
      radius: 0.9,
      getAction: () => (this.hooks.hasFlag(id) ? null : { label: 'Abrir baú', enabled: true }),
      interact: () => {
        if (this.hooks.hasFlag(id)) return;
        const chest = this.chests.get(id)!;
        chest.openAmount = 1;
        chest.sparkle.visible = false;
        this.hooks.sound('chest');
        this.hooks.burst(new THREE.Vector3(p.x, y + 1, p.z), '#ffd65c', 18);
        this.hooks.giveItems(CHEST_LOOT[id] ?? {});
        this.hooks.addXP(15);
        this.hooks.setFlag(id);
        this.hooks.showLore(id);
      },
    });
  }

  private buildGiantTree(): void {
    const p = PLACES.giantTree;
    const y = this.ground(p);
    const tree = this.mesh(makeBroadleafTree(1), createFlatMaterial());
    tree.scale.setScalar(3.3);
    tree.position.set(p.x, y - 0.3, p.z);
    this.group.add(tree);
    // Raízes aparentes.
    const roots: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      roots.push(
        part(new THREE.BoxGeometry(0.5, 0.5, 2.6), '#6b4528', {
          pos: [Math.sin(a) * 1.6, 0.15, Math.cos(a) * 1.6],
          rot: [0.25, a, 0],
        }),
      );
    }
    const rootMesh = this.mesh(merge(roots));
    rootMesh.position.set(p.x, y, p.z);
    this.group.add(rootMesh);
    this.collision.add({ kind: 'circle', x: p.x, z: p.z, r: 1.3, top: y + 20, camera: true });
  }

  private buildRuins(): void {
    const c = PLACES.ruins;
    const y = this.ground(c);
    const random = createRandom(31);

    // Piso octogonal e plataforma central (dá para subir).
    const floor = this.mesh(part(new THREE.CylinderGeometry(11, 11.6, 0.8, 8), STONE, { variation: 0.08 }));
    floor.position.set(c.x, y - 0.05, c.z);
    this.group.add(floor);
    this.collision.add({ kind: 'circle', x: c.x, z: c.z, r: 11, top: y + 0.35 });
    const dais = this.mesh(part(new THREE.CylinderGeometry(5.2, 5.6, 0.5, 8), STONE_DARK, { variation: 0.08 }));
    dais.position.set(c.x, y + 0.6, c.z);
    this.group.add(dais);
    this.collision.add({ kind: 'circle', x: c.x, z: c.z, r: 5.3, top: y + 0.85 });

    // Anel de pilares, alguns quebrados. Aberturas a oeste e ao sul.
    const pillarParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const px = Math.sin(a) * 9.6;
      const pz = Math.cos(a) * 9.6;
      if (Math.abs(px + 9.6) < 3 || (pz > 8 && Math.abs(px) < 3.5)) continue;
      const h = random() < 0.4 ? 1.2 + random() * 1.5 : 3.6 + random() * 1.8;
      pillarParts.push(part(new THREE.CylinderGeometry(0.55, 0.65, h, 7), STONE, { pos: [px, h / 2 + 0.3, pz], seed: i }));
      if (h > 3) pillarParts.push(part(new THREE.BoxGeometry(1.5, 0.4, 1.5), STONE_DARK, { pos: [px, h + 0.5, pz], rot: [0, a, 0] }));
      this.collision.add({ kind: 'circle', x: c.x + px, z: c.z + pz, r: 0.7, top: y + h + 0.3, camera: h > 3 });
    }
    // Pedaços caídos.
    for (let i = 0; i < 5; i++) {
      const a = random() * Math.PI * 2;
      const d = 6 + random() * 3;
      pillarParts.push(
        part(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 7), STONE_DARK, {
          pos: [Math.sin(a) * d, 0.75, Math.cos(a) * d],
          rot: [0, a, Math.PI / 2],
          seed: 50 + i,
        }),
      );
    }
    const pillars = this.mesh(merge(pillarParts));
    pillars.position.set(c.x, y, c.z);
    this.group.add(pillars);

    // Monólito com símbolos luminosos.
    const m = PLACES.monolith;
    const my = y + 0.85;
    const monolith = this.mesh(
      merge([
        part(new THREE.BoxGeometry(1.8, 4.4, 0.7), '#4c5260', { pos: [0, 2.2, 0], variation: 0.05 }),
        part(new THREE.BoxGeometry(2.2, 0.4, 1.1), '#5d6372', { pos: [0, 0.2, 0] }),
        part(new THREE.ConeGeometry(0.95, 0.8, 4), '#4c5260', { pos: [0, 4.75, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, 0.45] }),
      ]),
    );
    monolith.position.set(m.x, my, m.z);
    this.group.add(monolith);
    const glyphs: THREE.BufferGeometry[] = [];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 3; col++) {
        if (random() < 0.25) continue;
        glyphs.push(
          part(new THREE.BoxGeometry(0.28 + random() * 0.2, 0.12, 0.04), '#ffffff', {
            pos: [-0.45 + col * 0.45, 1.0 + row * 0.5, 0.37],
          }),
        );
      }
    }
    const glyphMesh = new THREE.Mesh(merge(glyphs), this.glyphMaterial);
    glyphMesh.position.copy(monolith.position);
    this.group.add(glyphMesh);
    this.collision.add({ kind: 'box', x: m.x, z: m.z, hw: 1.0, hd: 0.45, rot: 0, top: my + 4.4, camera: true });
    this.interaction.register({
      id: 'monolito',
      position: new THREE.Vector3(m.x, my + 1, m.z + 0.6),
      radius: 1.6,
      getAction: () => ({ label: 'Examinar monólito', enabled: true }),
      interact: () => {
        this.hooks.sound('discover');
        if (!this.hooks.hasFlag('monolito')) this.hooks.addXP(20);
        this.hooks.setFlag('monolito');
        this.hooks.showLore('monolito');
      },
    });

    // Altar com encaixes para fragmentos e cristais.
    const al = PLACES.altar;
    const altar = this.mesh(
      merge([
        part(new THREE.BoxGeometry(2.2, 1.0, 1.2), STONE_DARK, { pos: [0, 0.5, 0] }),
        part(new THREE.BoxGeometry(2.5, 0.18, 1.45), STONE, { pos: [0, 1.05, 0] }),
      ]),
    );
    altar.position.set(al.x, y + 0.85, al.z);
    this.group.add(altar);
    const gemMat = new THREE.MeshLambertMaterial({ color: '#3b4250', emissive: new THREE.Color('#000000') });
    for (let i = 0; i < 8; i++) {
      const isRelic = i < 3;
      const gem = new THREE.Mesh(
        isRelic ? new THREE.BoxGeometry(0.3, 0.06, 0.4) : new THREE.OctahedronGeometry(0.1, 0),
        gemMat.clone(),
      );
      gem.position.set(al.x - 0.8 + (isRelic ? i * 0.8 : (i - 3) * 0.4), y + 1.98, al.z + (isRelic ? -0.2 : 0.35));
      this.altarGems.push(gem);
      this.group.add(gem);
    }
    this.collision.add({ kind: 'box', x: al.x, z: al.z, hw: 1.2, hd: 0.7, rot: 0, top: y + 2 });
    this.interaction.register({
      id: 'altar',
      position: new THREE.Vector3(al.x, y + 1.6, al.z),
      radius: 1.5,
      getAction: () => {
        if (this.hooks.hasFlag('portal')) return null;
        if (this.hooks.hasItems(ALTAR_COST)) return { label: 'Ativar o altar', enabled: true };
        return { label: 'Examinar altar', enabled: true };
      },
      interact: () => {
        if (this.hooks.hasFlag('portal')) return;
        if (!this.hooks.takeItems(ALTAR_COST)) {
          this.hooks.showLore('altar_inativo');
          return;
        }
        this.hooks.sound('portal');
        this.hooks.shake(0.8);
        this.hooks.burst(new THREE.Vector3(al.x, y + 2.2, al.z), '#7ff3ff', 30);
        this.portalActive = 0.01;
        this.hooks.setFlag('altar');
        this.hooks.setFlag('portal');
        this.hooks.showLore('portal');
      },
    });

    // Arco do portal.
    const po = PLACES.portal;
    const arch = this.mesh(
      merge([
        part(new THREE.BoxGeometry(1, 5.2, 1), STONE, { pos: [-2.3, 2.6, 0] }),
        part(new THREE.BoxGeometry(1, 5.2, 1), STONE, { pos: [2.3, 2.6, 0] }),
        part(new THREE.BoxGeometry(6, 0.9, 1.3), STONE_DARK, { pos: [0, 5.6, 0] }),
        part(new THREE.BoxGeometry(1.3, 0.5, 1.3), STONE_DARK, { pos: [-2.3, 0.25, 0] }),
        part(new THREE.BoxGeometry(1.3, 0.5, 1.3), STONE_DARK, { pos: [2.3, 0.25, 0] }),
      ]),
    );
    arch.position.set(po.x, y + 0.3, po.z);
    this.group.add(arch);
    this.collision.add({ kind: 'circle', x: po.x - 2.3, z: po.z, r: 0.75, top: y + 6 });
    this.collision.add({ kind: 'circle', x: po.x + 2.3, z: po.z, r: 0.75, top: y + 6 });

    this.portalSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 4.6),
      new THREE.ShaderMaterial({
        uniforms: this.portalUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uActive;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            p.x *= 0.8;
            float r = length(p);
            float a = atan(p.y, p.x);
            float swirl = sin(a * 4.0 + r * 22.0 - uTime * 3.0) * 0.5 + 0.5;
            vec3 col = mix(vec3(0.15, 0.55, 1.0), vec3(0.8, 0.97, 1.0), swirl);
            float alpha = smoothstep(0.52, 0.15, r) * uActive * (0.55 + 0.45 * swirl);
            gl_FragColor = vec4(col * alpha, alpha);
          }
        `,
      }),
    );
    this.portalSurface.position.set(po.x, y + 2.8, po.z);
    this.group.add(this.portalSurface);

    this.portalBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.5, 220, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#8fe9ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.portalBeam.position.set(po.x, y + 110, po.z);
    this.group.add(this.portalBeam);
    this.portalLight = this.lights.add({
      position: new THREE.Vector3(po.x, y + 3, po.z - 1),
      color: new THREE.Color('#7fd8ff'),
      intensity: 30,
      distance: 22,
      flicker: false,
      nightOnly: false,
      enabled: false,
    });
  }

  private buildCave(): void {
    const c = PLACES.cave;
    const y = this.ground(c);
    const random = createRandom(77);
    const rocks: THREE.BufferGeometry[] = [];
    const R = 7.2;
    // Paredes: pedras grandes em anel, com abertura ao sul (+Z).
    for (let i = 0; i <= 12; i++) {
      const deg = 40 + i * (280 / 12);
      const a = (deg * Math.PI) / 180;
      const x = Math.sin(a) * R;
      const z = Math.cos(a) * R;
      const g = jitter(new THREE.DodecahedronGeometry(2.6, 0), 0.9, 900 + deg);
      g.scale(1, 1.75, 1.05);
      g.rotateY(a);
      g.translate(x, 1.2, z);
      rocks.push(paint(g, random() > 0.5 ? '#7c7872' : '#6c6863', 0.08, deg));
      this.collision.add({ kind: 'circle', x: c.x + x, z: c.z + z, r: 2.3, top: y + 6, camera: true });
    }
    // Pedras do arco da entrada.
    for (const side of [-1, 1]) {
      const a = (side * 30 * Math.PI) / 180;
      const g = jitter(new THREE.DodecahedronGeometry(1.8, 0), 0.6, 950 + side);
      g.scale(1, 2.2, 1);
      g.translate(Math.sin(a) * (R + 0.4), 1.6, Math.cos(a) * (R + 0.4));
      rocks.push(paint(g, '#7c7872', 0.08, 960 + side));
      this.collision.add({ kind: 'circle', x: c.x + Math.sin(a) * (R + 0.4), z: c.z + Math.cos(a) * (R + 0.4), r: 1.6, top: y + 6, camera: true });
    }
    const walls = this.mesh(merge(rocks));
    walls.position.set(c.x, y, c.z);
    this.group.add(walls);

    // Teto: some quando o jogador entra (para a câmera enxergar).
    const roofParts: THREE.BufferGeometry[] = [];
    const roofRock = jitter(new THREE.DodecahedronGeometry(6.2, 1), 1.2, 999);
    roofRock.scale(1.35, 0.32, 1.25);
    roofRock.translate(0, 6.6, -0.6);
    roofParts.push(paint(roofRock, '#6f6b66', 0.08, 5));
    const lintel = jitter(new THREE.DodecahedronGeometry(2.2, 0), 0.5, 998);
    lintel.scale(2.1, 0.75, 1);
    lintel.translate(0, 5.4, R + 0.3);
    roofParts.push(paint(lintel, '#7c7872', 0.08, 6));
    const roof = this.mesh(merge(roofParts));
    roof.position.set(c.x, y, c.z);
    this.group.add(roof);

    this.cameraZones.push({ x: c.x, z: c.z, radius: 6.2, maxDistance: 3, hide: [roof] });

    // Luz roxa/azulada dos cristais.
    this.lights.add({
      position: new THREE.Vector3(c.x, y + 3, c.z - 1),
      color: new THREE.Color('#9f8cff'),
      intensity: 26,
      distance: 14,
      flicker: false,
      nightOnly: false,
    });

    // Entulho bloqueando a entrada (precisa de picareta).
    this.rubble = new THREE.Group();
    const rubbleParts: THREE.BufferGeometry[] = [];
    [
      [-1.9, 0.6, 1.3],
      [0, 0.8, 1.5],
      [1.9, 0.6, 1.3],
      [-0.9, 1.9, 1.0],
      [1.0, 1.9, 1.05],
    ].forEach(([x, yy, s], i) => {
      const g = jitter(new THREE.DodecahedronGeometry(s, 0), 0.35, 1200 + i);
      g.translate(x, yy, 0);
      rubbleParts.push(paint(g, '#8f877c', 0.1, i));
    });
    this.rubble.add(this.mesh(merge(rubbleParts)));
    this.rubble.position.set(c.x, y, c.z + R - 0.2);
    this.group.add(this.rubble);
    this.addRubbleCollider();

    this.interaction.register({
      id: 'entulho',
      position: new THREE.Vector3(c.x, y + 1.2, c.z + R + 0.6),
      radius: 2.6,
      getAction: (ctx) => {
        if (this.hooks.hasFlag('entulho')) return null;
        if (!ctx.hasItem('picareta')) {
          return { label: 'Remover entulho', enabled: false, reason: 'Requer Picareta de Pedra' };
        }
        return { label: 'Remover entulho', enabled: true };
      },
      interact: (ctx) => {
        if (this.hooks.hasFlag('entulho')) return;
        ctx.player.playAction('picareta');
        this.hooks.sound('break');
        this.hooks.shake(0.5);
        this.hooks.burst(new THREE.Vector3(c.x, y + 1.5, c.z + R), '#9c978e', 30);
        this.hooks.addXP(25);
        this.hooks.giveItems({ pedra: 5 });
        this.hooks.setFlag('entulho');
        if (this.rubbleCollider) {
          this.collision.remove(this.rubbleCollider);
          this.rubbleCollider = null;
        }
        this.hooks.notify('O caminho para a caverna está livre!', 'success');
      },
    });
  }

  private addRubbleCollider(): void {
    const c = PLACES.cave;
    const y = this.ground(c);
    this.rubbleCollider = this.collision.add({ kind: 'box', x: c.x, z: c.z + 7.2, hw: 3.4, hd: 1.4, rot: 0, top: y + 2.8 });
  }

  private buildPeak(): void {
    const p = PLACES.peak;
    const y = this.ground(p);
    const base = this.mesh(
      merge([
        part(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 10), STONE, { pos: [0, 0.1, 0] }),
        part(new THREE.CylinderGeometry(0.7, 0.9, 2.4, 8), STONE_DARK, { pos: [0, 1.6, 0] }),
        part(new THREE.CylinderGeometry(1.25, 0.7, 0.7, 8, 1, true), '#7d6a4d', { pos: [0, 3.1, 0] }),
        part(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 8), '#3a3330', { pos: [0, 2.8, 0] }),
      ]),
    );
    base.position.set(p.x, y, p.z);
    this.group.add(base);
    this.collision.add({ kind: 'circle', x: p.x, z: p.z, r: 4.2, top: y + 0.4 });
    this.collision.add({ kind: 'circle', x: p.x, z: p.z, r: 1.2, top: y + 3.5 });

    // Pedras eretas ao redor.
    const stones: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      stones.push(part(new THREE.BoxGeometry(0.7, 2.4, 0.5), STONE_DARK, { pos: [Math.sin(a) * 6, 1, Math.cos(a) * 6], rot: [0.05, a, 0.04] }));
      this.collision.add({ kind: 'circle', x: p.x + Math.sin(a) * 6, z: p.z + Math.cos(a) * 6, r: 0.55, top: y + 2.2 });
    }
    const ring = this.mesh(merge(stones));
    ring.position.set(p.x, y, p.z);
    this.group.add(ring);

    // Chama azul do farol (aparece quando aceso).
    this.beaconFire = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.9, fog: false });
    const flameMat2 = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, fog: false });
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45 - i * 0.07, 1.6 + i * 0.25, 6), i === 3 ? flameMat2 : flameMat);
      cone.position.set(Math.sin(i * 2) * 0.25, 0.8, Math.cos(i * 2) * 0.25);
      this.beaconFire.add(cone);
    }
    this.beaconFire.position.set(p.x, y + 3.1, p.z);
    this.beaconFire.visible = false;
    this.group.add(this.beaconFire);
    this.beaconBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.2, 260, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#b8f6ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.beaconBeam.position.set(p.x, y + 133, p.z);
    this.group.add(this.beaconBeam);
    this.beaconLight = this.lights.add({
      position: new THREE.Vector3(p.x, y + 4.5, p.z),
      color: new THREE.Color('#8fe9ff'),
      intensity: 60,
      distance: 30,
      flicker: true,
      nightOnly: false,
      enabled: false,
    });

    this.interaction.register({
      id: 'farol',
      position: new THREE.Vector3(p.x, y + 2, p.z),
      radius: 1.8,
      getAction: () => {
        if (this.hooks.hasFlag('farol')) return null;
        if (!this.hooks.hasFlag('portal')) {
          return { label: 'Acender o farol', enabled: false, reason: 'O farol não reage… ative o portal das ruínas primeiro' };
        }
        return { label: 'Acender o farol', enabled: true };
      },
      interact: () => {
        if (this.hooks.hasFlag('farol') || !this.hooks.hasFlag('portal')) return;
        this.beaconLit = 0.01;
        this.updateBeaconVisuals();
        this.hooks.sound('portal');
        this.hooks.shake(0.6);
        this.hooks.burst(new THREE.Vector3(p.x, y + 3.6, p.z), '#8ff0ff', 40);
        this.hooks.setFlag('farol');
        this.hooks.onEnding();
      },
    });
  }

  private updatePortalVisuals(): void {
    const k = this.portalActive;
    this.portalUniforms.uActive.value = k;
    this.portalSurface.visible = k > 0;
    (this.portalBeam.material as THREE.MeshBasicMaterial).opacity = k * 0.22;
    this.portalBeam.visible = k > 0;
    this.portalLight.enabled = k > 0;
    for (const gem of this.altarGems) {
      const mat = gem.material as THREE.MeshLambertMaterial;
      mat.color.set(k > 0 ? '#9ff6ff' : '#3b4250');
      mat.emissive.set(k > 0 ? '#3fbfff' : '#000000');
    }
  }

  private updateBeaconVisuals(): void {
    const k = this.beaconLit;
    this.beaconFire.visible = k > 0;
    this.beaconFire.scale.setScalar(Math.max(0.01, k));
    (this.beaconBeam.material as THREE.MeshBasicMaterial).opacity = k * 0.25;
    this.beaconBeam.visible = k > 0;
    this.beaconLight.enabled = k > 0;
  }
}
