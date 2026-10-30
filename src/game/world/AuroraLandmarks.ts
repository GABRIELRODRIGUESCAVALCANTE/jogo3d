/**
 * Marcos da Ilha da Aurora (segundo capítulo):
 * - Pedra da chegada (história);
 * - três pilares de cristal que precisam ser despertados com cristais;
 * - o Observatório dos Lumeni, que, ativado, acende uma aurora no céu.
 */
import * as THREE from 'three';
import type { CollisionWorld } from '../Collision';
import type { InteractionSystem } from '../InteractionSystem';
import type { LightManager, LightSource } from '../LightManager';
import { createFlatMaterial, merge, part } from '../models/geometry';
import { AURORA_CENTER, AURORA_PLACES } from './islands';
import type { LandmarkHooks } from './Landmarks';
import type { HeightField } from './Terrain';
import type { Place } from './layout';

const STONE = '#c7c2d6';
const STONE_DARK = '#8f8aa3';
const PYLON_COST = { cristal: 2 };

interface Pylon {
  flag: string;
  place: Place;
  crystal: THREE.Mesh;
  beam: THREE.Mesh;
  light: LightSource;
  glow: number;
}

export const PYLON_FLAGS = ['pilar_oeste', 'pilar_leste', 'pilar_sul'];

export class AuroraLandmarks {
  readonly group = new THREE.Group();
  private readonly material = createFlatMaterial();
  private readonly pylons: Pylon[] = [];
  private aurora!: THREE.Mesh;
  private observatoryCrystal!: THREE.Mesh;
  private observatoryLight!: LightSource;
  private readonly auroraUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
  private observatoryOn = 0;

  constructor(
    private readonly terrain: HeightField,
    private readonly collision: CollisionWorld,
    private readonly interaction: InteractionSystem,
    private readonly lights: LightManager,
    private readonly hooks: LandmarkHooks,
  ) {
    this.group.name = 'Marcos da Aurora';
  }

  build(): void {
    this.buildLoreStone();
    const names: Array<[string, Place, string]> = [
      ['pilar_oeste', AURORA_PLACES.pylonWest, 'Pilar do Oeste'],
      ['pilar_leste', AURORA_PLACES.pylonEast, 'Pilar do Leste'],
      ['pilar_sul', AURORA_PLACES.pylonSouth, 'Pilar do Sul'],
    ];
    for (const [flag, place, name] of names) this.buildPylon(flag, place, name);
    this.buildObservatory();
    this.buildAuroraSky();
  }

  applyFlags(): void {
    for (const p of this.pylons) p.glow = this.hooks.hasFlag(p.flag) ? 1 : 0;
    this.observatoryOn = this.hooks.hasFlag('observatorio') ? 1 : 0;
    this.refreshVisuals();
  }

  /** Atualiza animações. `night` (0 a 1) controla a visibilidade da aurora. */
  update(dt: number, elapsed: number, night: number): void {
    for (const p of this.pylons) {
      p.crystal.rotation.y += dt * (0.3 + p.glow);
      p.crystal.position.y = p.crystal.userData.baseY + Math.sin(elapsed * 1.5 + p.place.x) * 0.1 * p.glow;
    }
    this.observatoryCrystal.rotation.y += dt * (0.2 + this.observatoryOn * 1.2);
    this.auroraUniforms.uTime.value = elapsed;
    // A aurora aparece à noite depois do observatório ativado (um pouco também ao entardecer).
    this.auroraUniforms.uOpacity.value = this.observatoryOn * Math.max(0.15, night);
    this.aurora.visible = this.auroraUniforms.uOpacity.value > 0.01;
  }

  private ground(p: Place): number {
    return this.terrain.getHeight(p.x, p.z);
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material = this.material): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  private buildLoreStone(): void {
    const p = AURORA_PLACES.loreStone;
    const y = this.ground(p);
    const stone = this.mesh(
      merge([
        part(new THREE.BoxGeometry(1.4, 2.4, 0.5), STONE_DARK, { pos: [0, 1.2, 0], rot: [0.05, 0.6, 0.04] }),
        part(new THREE.BoxGeometry(0.9, 0.1, 0.05), '#7ff3ff', { pos: [0, 1.6, 0.26], rot: [0, 0.6, 0] }),
        part(new THREE.BoxGeometry(0.6, 0.1, 0.05), '#7ff3ff', { pos: [0, 1.3, 0.26], rot: [0, 0.6, 0] }),
      ]),
    );
    stone.position.set(p.x, y, p.z);
    this.group.add(stone);
    this.collision.add({ kind: 'circle', x: p.x, z: p.z, r: 0.8, top: y + 2.4 });
    this.interaction.register({
      id: 'pedra_aurora',
      position: new THREE.Vector3(p.x, y + 1.2, p.z),
      radius: 1.2,
      getAction: () => ({ label: 'Ler a pedra gravada', enabled: true }),
      interact: () => {
        if (!this.hooks.hasFlag('pedra_aurora')) this.hooks.addXP(20);
        this.hooks.setFlag('pedra_aurora');
        this.hooks.sound('discover');
        this.hooks.showLore('pedra_aurora');
      },
    });
  }

  private buildPylon(flag: string, place: Place, name: string): void {
    const y = this.ground(place);
    const base = this.mesh(
      merge([
        part(new THREE.CylinderGeometry(2.2, 2.6, 0.5, 8), STONE, { pos: [0, 0.15, 0] }),
        part(new THREE.CylinderGeometry(0.7, 0.9, 3, 6), STONE_DARK, { pos: [0, 1.9, 0] }),
        part(new THREE.CylinderGeometry(1.0, 0.7, 0.4, 6), STONE, { pos: [0, 3.5, 0] }),
      ]),
    );
    base.position.set(place.x, y, place.z);
    this.group.add(base);
    this.collision.add({ kind: 'circle', x: place.x, z: place.z, r: 1.0, top: y + 3.7, camera: true });
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.6, 0),
      new THREE.MeshLambertMaterial({ color: '#7d7a90', emissive: new THREE.Color('#000000') }),
    );
    crystal.scale.set(1, 1.8, 1);
    crystal.position.set(place.x, y + 4.7, place.z);
    crystal.userData.baseY = y + 4.7;
    this.group.add(crystal);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.5, 60, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#9ff6ff',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    beam.position.set(place.x, y + 35, place.z);
    beam.visible = false;
    this.group.add(beam);
    const light = this.lights.add({
      position: new THREE.Vector3(place.x, y + 5, place.z),
      color: new THREE.Color('#7fe8ff'),
      intensity: 24,
      distance: 18,
      flicker: false,
      nightOnly: false,
      enabled: false,
    });
    const pylon: Pylon = { flag, place, crystal, beam, light, glow: 0 };
    this.pylons.push(pylon);
    this.interaction.register({
      id: flag,
      position: new THREE.Vector3(place.x, y + 1.5, place.z),
      radius: 1.6,
      getAction: () => {
        if (this.hooks.hasFlag(flag)) return null;
        if (!this.hooks.hasItems(PYLON_COST)) return { label: `Despertar o ${name}`, enabled: false, reason: 'Requer 2 Cristais' };
        return { label: `Despertar o ${name} (2 cristais)`, enabled: true };
      },
      interact: () => {
        if (this.hooks.hasFlag(flag) || !this.hooks.takeItems(PYLON_COST)) return;
        pylon.glow = 1;
        this.refreshVisuals();
        this.hooks.sound('crystal');
        this.hooks.shake(0.25);
        this.hooks.burst(new THREE.Vector3(place.x, y + 4.7, place.z), '#9ff6ff', 24);
        this.hooks.addXP(30);
        this.hooks.setFlag(flag);
        const awake = PYLON_FLAGS.filter((f) => this.hooks.hasFlag(f)).length;
        this.hooks.notify(`${name} desperto! (${awake}/3)`, 'success');
      },
    });
  }

  private buildObservatory(): void {
    const p = AURORA_PLACES.observatory;
    const y = this.ground(p);
    const parts: THREE.BufferGeometry[] = [
      part(new THREE.CylinderGeometry(9, 9.6, 0.8, 12), STONE, { pos: [0, 0, 0], variation: 0.06 }),
      part(new THREE.CylinderGeometry(5.5, 6, 0.6, 12), STONE_DARK, { pos: [0, 0.6, 0] }),
    ];
    // Colunas em anel com arcos.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (i === 5) continue; // entrada voltada para a praia
      parts.push(part(new THREE.CylinderGeometry(0.45, 0.55, 5, 7), STONE, { pos: [Math.sin(a) * 7.5, 2.9, Math.cos(a) * 7.5], seed: i }));
    }
    parts.push(part(new THREE.TorusGeometry(7.5, 0.45, 5, 20), STONE_DARK, { rot: [Math.PI / 2, 0, 0], pos: [0, 5.5, 0] }));
    // Telescópio de cristal sobre um pedestal.
    parts.push(part(new THREE.CylinderGeometry(1.2, 1.6, 1.6, 8), STONE_DARK, { pos: [0, 1.7, 0] }));
    parts.push(part(new THREE.CylinderGeometry(0.45, 0.6, 3.2, 8), '#d9b24c', { pos: [0, 3.6, 0.6], rot: [-0.7, 0, 0] }));
    const obs = this.mesh(merge(parts));
    obs.position.set(p.x, y, p.z);
    obs.rotation.y = -0.9; // entrada virada para sudoeste (praia)
    this.group.add(obs);
    this.collision.add({ kind: 'circle', x: p.x, z: p.z, r: 9, top: y + 0.4 });
    this.collision.add({ kind: 'circle', x: p.x, z: p.z, r: 5.6, top: y + 0.9 });
    this.collision.add({ kind: 'circle', x: p.x, z: p.z, r: 1.7, top: y + 2.6 });
    for (let i = 0; i < 10; i++) {
      if (i === 5) continue;
      const a = (i / 10) * Math.PI * 2 - 0.9;
      this.collision.add({ kind: 'circle', x: p.x + Math.sin(a) * 7.5, z: p.z + Math.cos(a) * 7.5, r: 0.6, top: y + 5.5, camera: true });
    }
    this.observatoryCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7, 0),
      new THREE.MeshLambertMaterial({ color: '#7d7a90', emissive: new THREE.Color('#000000') }),
    );
    this.observatoryCrystal.position.set(p.x, y + 3.4, p.z);
    this.group.add(this.observatoryCrystal);
    this.observatoryLight = this.lights.add({
      position: new THREE.Vector3(p.x, y + 4, p.z),
      color: new THREE.Color('#b8a0ff'),
      intensity: 40,
      distance: 26,
      flicker: false,
      nightOnly: false,
      enabled: false,
    });
    this.interaction.register({
      id: 'observatorio',
      position: new THREE.Vector3(p.x, y + 2, p.z),
      radius: 2.2,
      getAction: () => {
        if (this.hooks.hasFlag('observatorio')) return null;
        const awake = PYLON_FLAGS.filter((f) => this.hooks.hasFlag(f)).length;
        if (awake < 3) return { label: 'Ativar o observatório', enabled: false, reason: `Desperte os três pilares (${awake}/3)` };
        return { label: 'Ativar o observatório', enabled: true };
      },
      interact: () => {
        if (this.hooks.hasFlag('observatorio')) return;
        this.observatoryOn = 1;
        this.refreshVisuals();
        this.hooks.sound('portal');
        this.hooks.shake(0.7);
        this.hooks.burst(new THREE.Vector3(p.x, y + 4, p.z), '#c9b8ff', 40);
        this.hooks.setFlag('observatorio');
        this.hooks.showLore('observatorio');
      },
    });
  }

  /** Faixas de luz ondulantes no céu (shader com cores verde, ciano e lilás). */
  private buildAuroraSky(): void {
    const geo = new THREE.PlaneGeometry(520, 70, 64, 1);
    geo.translate(0, 35, 0);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      // Curva a cortina e a inclina como uma fita no céu.
      pos.setZ(i, Math.sin(x * 0.012) * 60);
    }
    this.aurora = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.auroraUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin(p.x * 0.03 + uTime * 0.4) * 12.0;
            p.y += sin(p.x * 0.02 + uTime * 0.25) * 6.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uOpacity;
          void main() {
            float bands = sin(vUv.x * 60.0 + uTime * 0.8) * 0.5 + 0.5;
            float fade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
            fade *= smoothstep(0.0, 0.1, vUv.x) * (1.0 - smoothstep(0.9, 1.0, vUv.x));
            vec3 green = vec3(0.3, 1.0, 0.6);
            vec3 violet = vec3(0.7, 0.4, 1.0);
            vec3 col = mix(green, violet, vUv.y) * (0.6 + bands * 0.6);
            float a = fade * (0.35 + bands * 0.4) * uOpacity;
            gl_FragColor = vec4(col * a, a);
          }
        `,
      }),
    );
    this.aurora.position.set(AURORA_CENTER.x - 40, 120, AURORA_CENTER.z - 140);
    this.aurora.rotation.y = 0.3;
    this.aurora.frustumCulled = false;
    this.aurora.visible = false;
    this.group.add(this.aurora);
  }

  private refreshVisuals(): void {
    for (const p of this.pylons) {
      const mat = p.crystal.material as THREE.MeshLambertMaterial;
      mat.color.set(p.glow ? '#9ff6ff' : '#7d7a90');
      mat.emissive.set(p.glow ? '#36c8ff' : '#000000');
      p.beam.visible = p.glow > 0;
      p.light.enabled = p.glow > 0;
    }
    const mat = this.observatoryCrystal.material as THREE.MeshLambertMaterial;
    mat.color.set(this.observatoryOn ? '#e0d4ff' : '#7d7a90');
    mat.emissive.set(this.observatoryOn ? '#8a6bff' : '#000000');
    this.observatoryLight.enabled = this.observatoryOn > 0;
  }
}
