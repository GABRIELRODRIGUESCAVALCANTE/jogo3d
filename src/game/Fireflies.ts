/**
 * Vagalumes ladrões: o risco leve da noite.
 *
 * De vez em quando, à noite e ao relento, um enxame de vagalumes aparece e
 * voa até o jogador. Se ficar perto por um instante, leva algumas frutas e
 * some. A luz da tocha os espanta, e um abrigo (telhado, cabana ou caverna)
 * protege. Dá para fugir correndo: eles voam um pouco mais devagar que você.
 */
import * as THREE from 'three';
import { createRandom } from '../core/math';
import type { ItemId } from './data/items';
import type { GameEventBus } from './events';
import type { LightManager, LightSource } from './LightManager';
import type { Player } from './Player';
import type { HeightField } from './world/Terrain';

export type SwarmState = 'idle' | 'approach' | 'flee';

export interface FireflyHooks {
  count(item: ItemId): number;
  take(item: ItemId, amount: number): void;
  /** O jogador está protegido (abrigo, barco, caverna...). */
  safe(): boolean;
  notify(text: string, kind: 'info' | 'warning' | 'success'): void;
  addXP(amount: number): void;
}

const COUNT = 14;
/** Frutas que os vagalumes gostam, da preferida para a menos preferida. */
const LOOT: ItemId[] = ['fruta', 'fruta_assada'];
const APPROACH_SPEED = 4.2;
const TORCH_RADIUS = 7.5;
const STEAL_SECONDS = 1.4;

export class FireflyThieves {
  readonly group = new THREE.Group();
  state: SwarmState = 'idle';
  /** Segundos até o próximo enxame poder aparecer. */
  cooldown = 90;
  readonly position = new THREE.Vector3();

  private readonly points: THREE.Points;
  private readonly offsets: Float32Array;
  private readonly material: THREE.PointsMaterial;
  private readonly light: LightSource;
  private readonly random = createRandom(9001);
  private readonly away = new THREE.Vector3();
  private stateTime = 0;
  private stealTimer = 0;
  private opacity = 0;
  private time = 0;

  constructor(
    private readonly player: Player,
    private readonly terrain: HeightField,
    lights: LightManager,
    private readonly bus: GameEventBus,
    private readonly hooks: FireflyHooks,
  ) {
    this.group.name = 'Vagalumes';
    const positions = new Float32Array(COUNT * 3);
    this.offsets = new Float32Array(COUNT * 4);
    const r = createRandom(31);
    for (let i = 0; i < COUNT; i++) {
      this.offsets.set([r() * Math.PI * 2, 0.6 + r() * 1.4, 0.8 + r() * 1.6, r() * 0.8 - 0.4], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.material = new THREE.PointsMaterial({
      color: '#e4ff7a',
      size: 0.42,
      map: glowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.group.visible = false;
    this.light = lights.add({
      position: new THREE.Vector3(),
      color: new THREE.Color('#d6ff6a'),
      intensity: 0,
      distance: 7,
      flicker: true,
      nightOnly: false,
      enabled: false,
    });
  }

  get active(): boolean {
    return this.state !== 'idle';
  }

  /** Faz um enxame aparecer perto de um ponto (usado também nos testes). */
  spawn(x: number, z: number): void {
    this.state = 'approach';
    this.stateTime = 0;
    this.stealTimer = 0;
    this.position.set(x, this.terrain.getHeight(x, z) + 1.6, z);
    this.group.visible = true;
    this.light.enabled = true;
    this.hooks.notify('Luzinhas se aproximam… São vagalumes ladrões de frutas! Acenda a tocha para espantá-los ou corra.', 'warning');
  }

  /** Some na hora (novo jogo, carregar, amanhecer). */
  reset(): void {
    this.state = 'idle';
    this.opacity = 0;
    this.material.opacity = 0;
    this.group.visible = false;
    this.light.enabled = false;
    this.cooldown = 60 + this.random() * 60;
  }

  /** `night`: 0 (dia) a 1 (noite fechada). `canSpawn`: jogo rodando e jogador em terra. */
  update(dt: number, night: number, canSpawn: boolean): void {
    this.time += dt;
    const p = this.player.position;

    if (this.state === 'idle') {
      if (!canSpawn || night < 0.7 || this.hooks.safe()) return;
      this.cooldown -= dt;
      if (this.cooldown > 0) return;
      this.cooldown = 70 + this.random() * 80;
      // Só vêm se você tiver frutas na bolsa.
      if (!LOOT.some((id) => this.hooks.count(id) > 0)) return;
      const a = this.random() * Math.PI * 2;
      const x = p.x + Math.sin(a) * 18;
      const z = p.z + Math.cos(a) * 18;
      if (this.terrain.getHeight(x, z) < 0.3) return;
      this.spawn(x, z);
    }

    this.stateTime += dt;
    if (this.state === 'approach') {
      const dx = p.x - this.position.x;
      const dz = p.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (this.player.torchOn && dist < TORCH_RADIUS) {
        this.flee();
        this.hooks.notify('A luz da tocha espantou os vagalumes ladrões!', 'success');
        this.hooks.addXP(3);
        this.bus.emit('fireflies:repelled', {});
      } else if (this.hooks.safe() || night < 0.4) {
        this.flee();
      } else if (this.stateTime > 45) {
        // Cansaram de perseguir.
        this.flee();
      } else if (dist < 1.7) {
        this.stealTimer += dt;
        if (this.stealTimer >= STEAL_SECONDS) this.steal();
      } else {
        this.stealTimer = Math.max(0, this.stealTimer - dt);
        const step = Math.min(dist, APPROACH_SPEED * dt);
        this.position.x += (dx / dist) * step;
        this.position.z += (dz / dist) * step;
      }
      const ground = this.terrain.getHeight(this.position.x, this.position.z);
      this.position.y += (Math.max(ground, p.y) + 1.5 - this.position.y) * Math.min(1, dt * 2);
      this.opacity = Math.min(1, this.opacity + dt * 1.5);
    } else if (this.state === 'flee') {
      this.position.addScaledVector(this.away, dt * 7);
      this.position.y += dt * 1.5;
      this.opacity = Math.max(0, this.opacity - dt * 0.4);
      if (this.opacity <= 0 || this.stateTime > 6) {
        this.state = 'idle';
        this.group.visible = false;
        this.light.enabled = false;
      }
    }
    this.animate();
  }

  private steal(): void {
    let stolen = 0;
    let name = '';
    for (const id of LOOT) {
      const n = Math.min(2 - stolen, this.hooks.count(id));
      if (n <= 0) continue;
      this.hooks.take(id, n);
      stolen += n;
      name = id === 'fruta' ? (n > 1 ? 'Frutas' : 'Fruta') : n > 1 ? 'Frutas Assadas' : 'Fruta Assada';
      if (stolen >= 2) break;
    }
    if (stolen > 0) {
      this.hooks.notify(
        `Os vagalumes levaram ${stolen === 1 ? 'uma' : stolen} ${name}! Da próxima vez, acenda a tocha.`,
        'warning',
      );
      this.bus.emit('fireflies:stole', { amount: stolen });
    }
    this.flee();
  }

  private flee(): void {
    this.state = 'flee';
    this.stateTime = 0;
    const p = this.player.position;
    this.away.set(this.position.x - p.x, 0, this.position.z - p.z);
    if (this.away.lengthSq() < 0.01) this.away.set(1, 0, 0);
    this.away.normalize();
  }

  /** Cada vagalume gira em volta do centro do enxame e pisca. */
  private animate(): void {
    const attr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = this.time;
    for (let i = 0; i < COUNT; i++) {
      const [phase, radius, speed, height] = this.offsets.subarray(i * 4, i * 4 + 4);
      const a = phase + t * speed;
      arr[i * 3] = this.position.x + Math.cos(a) * radius;
      arr[i * 3 + 1] = this.position.y + height + Math.sin(t * speed * 1.7 + phase) * 0.35;
      arr[i * 3 + 2] = this.position.z + Math.sin(a) * radius;
    }
    attr.needsUpdate = true;
    this.material.opacity = this.opacity * (0.75 + Math.sin(t * 9) * 0.25);
    this.light.position.copy(this.position);
    this.light.intensity = 2.2 * this.opacity;
  }
}

/** Pontinho de luz redondo e suave. */
function glowTexture(): THREE.Texture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,220,0.8)');
    g.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
