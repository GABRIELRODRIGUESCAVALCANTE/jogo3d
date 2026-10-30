/**
 * Navegação de barco.
 *
 * A bordo: W/S (ou joystick) controlam a velocidade, A/D viram e E (ou o
 * botão de interagir) desembarca quando há praia por perto. O barco não sobe
 * na areia: ao encostar no fundo raso, ele para. Com chuva o mar fica
 * agitado: o barco balança mais, anda mais devagar e, na tempestade, é
 * empurrado pelo vento.
 */
import * as THREE from 'three';
import type { SoundName } from '../core/AudioManager';
import { damp } from '../core/math';
import type { PlacedStructure } from './Building';
import type { Player } from './Player';
import type { HeightField } from './world/Terrain';
import { WATER_LEVEL } from './world/layout';

export interface BoatHooks {
  splash(position: THREE.Vector3): void;
  sound(name: SoundName): void;
  notify(text: string): void;
}

/** Centro e raio do "mundo navegável" (cobre as duas ilhas com folga). */
const SEA_CENTER = { x: 280, z: -130 };
const SEA_RADIUS = 980;
const BOW = 2.4;

export class BoatController {
  boat: PlacedStructure | null = null;
  speed = 0;
  private wakeTimer = 0;
  private bumpCooldown = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly player: Player,
    private readonly terrain: HeightField,
    private readonly hooks: BoatHooks,
  ) {}

  get active(): boolean {
    return this.boat !== null;
  }

  board(boat: PlacedStructure): void {
    this.boat = boat;
    boat.boarded = true;
    this.speed = 0;
    this.player.fishing = false;
    this.hooks.sound('splash');
  }

  /** Tenta descer em terra firme perto do barco. Retorna falso se não houver praia. */
  disembark(): boolean {
    const b = this.boat;
    if (!b) return false;
    let best: { x: number; z: number; d: number } | null = null;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      for (const r of [2.5, 3.5, 4.5, 5.5, 6.5]) {
        const x = b.x + Math.sin(a) * r;
        const z = b.z + Math.cos(a) * r;
        const h = this.terrain.getHeight(x, z);
        if (h > 0.25 && h < 8 && this.terrain.getSlope(x, z) < 0.8 && (!best || r < best.d)) best = { x, z, d: r };
      }
    }
    if (!best) {
      this.hooks.notify('Aproxime o barco da praia para desembarcar.');
      return false;
    }
    this.player.teleport(best.x, this.terrain.getHeight(best.x, best.z) + 0.2, best.z, Math.atan2(best.x - b.x, best.z - b.z));
    b.boarded = false;
    this.boat = null;
    this.speed = 0;
    return true;
  }

  /** `waves`: agitação do mar (1 = calmo, ~2.8 = tempestade). */
  update(dt: number, move: { x: number; y: number }, sprint: boolean, elapsed: number, waves = 1): void {
    const b = this.boat;
    if (!b) return;
    this.bumpCooldown -= dt;

    // Velocidade (ré é lenta) e direção.
    const rough = Math.max(0, waves - 1);
    const slow = 1 - rough * 0.16;
    const target = (move.y >= 0 ? move.y * (sprint ? 18 : 12) : move.y * 4) * slow;
    this.speed = damp(this.speed, target, 1.3, dt);
    const steer = 0.35 + Math.min(1, Math.abs(this.speed) / 6) * 0.75;
    b.rot -= move.x * steer * dt * (this.speed < 0 ? -1 : 1);

    const fx = Math.sin(b.rot);
    const fz = Math.cos(b.rot);
    // Vento da tempestade: empurra o barco numa direção que muda devagar.
    const gust = Math.max(0, waves - 1.9) * 1.6;
    const windAngle = elapsed * 0.05;
    const nx = b.x + fx * this.speed * dt + Math.cos(windAngle) * gust * dt;
    const nz = b.z + fz * this.speed * dt + Math.sin(windAngle) * gust * dt;
    const dir = this.speed >= 0 ? 1 : -1;
    const probe = this.terrain.getHeight(nx + fx * BOW * dir, nz + fz * BOW * dir);
    const inSea = Math.hypot(nx - SEA_CENTER.x, nz - SEA_CENTER.z) < SEA_RADIUS;
    if (probe > WATER_LEVEL - 0.3 || !inSea) {
      // Encalhou (ou chegou ao limite do mar): para.
      if (Math.abs(this.speed) > 3 && this.bumpCooldown <= 0) {
        this.hooks.sound('land');
        this.bumpCooldown = 1;
        if (!inSea) this.hooks.notify('O mar é vasto demais além daqui. Volte para perto das ilhas.');
      }
      this.speed = 0;
    } else {
      b.x = nx;
      b.z = nz;
    }

    // Balanço na água e inclinação nas curvas.
    const root = b.model.root;
    const bob = 0.07 + rough * 0.16;
    root.position.set(b.x, WATER_LEVEL + Math.sin(elapsed * (1.6 + rough * 0.5)) * bob, b.z);
    root.rotation.set(
      Math.sin(elapsed * 1.1) * (0.03 + rough * 0.06),
      b.rot,
      -move.x * 0.1 * Math.min(1, Math.abs(this.speed) / 10) + Math.sin(elapsed * 0.8 + 1) * rough * 0.07,
    );
    b.use?.position.set(b.x, WATER_LEVEL + 0.6, b.z);
    b.removal.position.set(b.x, WATER_LEVEL + 1, b.z);

    // Jogador sentado no banco.
    this.tmp.set(0, 0.25, -1.1).applyEuler(root.rotation).add(root.position);
    this.player.sit(this.tmp, b.rot, dt);

    // Esteira de espuma atrás do barco.
    this.wakeTimer -= dt;
    if (Math.abs(this.speed) > 3 && this.wakeTimer <= 0) {
      this.wakeTimer = 0.1;
      this.hooks.splash(this.tmp.set(b.x - fx * 2, WATER_LEVEL + 0.05, b.z - fz * 2));
    }
  }
}
