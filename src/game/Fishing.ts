/**
 * Pesca.
 *
 * Perto da água, com um cardume por perto e uma vara de pesca, aparece a
 * ação "Pescar". O minijogo:
 *   1. a linha é lançada e a boia cai na água;
 *   2. depois de alguns segundos, a boia afunda: "Puxe agora!";
 *   3. apertar E (ou o botão de interagir) a tempo pega o peixe.
 * Andar cancela a pesca.
 */
import * as THREE from 'three';
import type { SoundName } from '../core/AudioManager';
import type { ItemId } from './data/items';
import type { GameEventBus } from './events';
import type { Interactable, InteractableProvider, InteractionContext } from './InteractionSystem';
import type { Player } from './Player';
import type { HeightField } from './world/Terrain';
import type { FishSchool, Wildlife } from './world/Wildlife';
import { WATER_LEVEL } from './world/layout';

export type FishingState = 'idle' | 'casting' | 'waiting' | 'bite';

export interface FishingHooks {
  hasRod(): boolean;
  wearRod(): void;
  give(item: ItemId, amount: number): void;
  notify(text: string): void;
  sound(name: SoundName): void;
  splash(position: THREE.Vector3): void;
  addXP(amount: number): void;
}

/** Tempo para reagir quando o peixe morde. */
const BITE_WINDOW = 1.3;

export class FishingSystem implements InteractableProvider {
  state: FishingState = 'idle';
  readonly group = new THREE.Group();
  private timer = 0;
  private school: FishSchool | null = null;
  private readonly start = new THREE.Vector3();
  private readonly bobberTarget = new THREE.Vector3();
  private readonly bobber: THREE.Mesh;
  private readonly line: THREE.Line;
  private readonly linePositions = new Float32Array(6);
  private readonly tip = new THREE.Vector3();
  private readonly interactable: Interactable;
  private time = 0;

  constructor(
    private readonly player: Player,
    private readonly wildlife: Wildlife,
    private readonly terrain: HeightField,
    private readonly bus: GameEventBus,
    private readonly hooks: FishingHooks,
  ) {
    this.group.name = 'Pesca';
    this.bobber = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshLambertMaterial({ color: '#ff4f4f', emissive: new THREE.Color('#401010') }),
    );
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false;
    this.group.add(this.bobber, this.line);
    this.group.visible = false;

    this.interactable = {
      id: 'pescar',
      position: new THREE.Vector3(),
      radius: 9,
      priority: 0.6,
      getAction: () => {
        if (!this.hooks.hasRod()) return { label: 'Pescar', enabled: false, reason: 'Requer Vara de Pesca (fabrique no menu C)' };
        return { label: 'Pescar', enabled: true };
      },
      interact: (ctx: InteractionContext) => this.begin(ctx.player),
    };
  }

  get active(): boolean {
    return this.state !== 'idle';
  }

  /** Texto exibido enquanto pesca (aviso na tela e botão de toque). */
  get prompt(): string {
    switch (this.state) {
      case 'casting':
        return 'Lançando a linha…';
      case 'waiting':
        return 'Aguarde o peixe morder…';
      case 'bite':
        return 'Puxe agora!';
      default:
        return '';
    }
  }

  /** A ação "Pescar" aparece perto de um cardume, fora da água funda. */
  queryInteractables(x: number, z: number, _range: number, out: Interactable[]): void {
    if (this.active || this.player.swimming) return;
    const school = this.wildlife.nearestSchool(x, z, 11);
    if (!school) return;
    this.interactable.position.set(school.x, WATER_LEVEL + 1, school.z);
    this.school = school;
    out.push(this.interactable);
  }

  private begin(player: Player): void {
    if (!this.school) return;
    this.state = 'casting';
    this.timer = 0.6;
    this.start.copy(player.position);
    player.fishing = true;
    player.faceTowards(this.school.x, this.school.z);
    // A boia cai na água entre o jogador e o cardume (no máximo a 8 m).
    const dx = this.school.x - player.position.x;
    const dz = this.school.z - player.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const reach = Math.min(8, Math.max(3, d - 1));
    this.bobberTarget.set(player.position.x + (dx / d) * reach, WATER_LEVEL, player.position.z + (dz / d) * reach);
    if (this.terrain.getHeight(this.bobberTarget.x, this.bobberTarget.z) > WATER_LEVEL - 0.2) {
      this.bobberTarget.set(this.school.x, WATER_LEVEL, this.school.z);
    }
    this.hooks.wearRod();
    this.hooks.sound('jump');
  }

  /** Jogador apertou interagir durante a pesca. */
  press(): void {
    if (this.state === 'bite') {
      const item: ItemId = 'peixe';
      this.hooks.give(item, 1);
      this.hooks.addXP(4);
      this.hooks.sound('pickup');
      this.hooks.splash(this.bobber.position);
      this.hooks.notify('Você pescou um peixe!');
      this.bus.emit('fish:caught', { itemId: item });
      this.bus.emit('resource:gathered', { itemId: item, amount: 1 });
      this.stop();
    } else if (this.state === 'waiting') {
      this.hooks.notify('Cedo demais! O peixe se assustou.');
      this.stop();
    }
  }

  stop(): void {
    this.state = 'idle';
    this.player.fishing = false;
    this.group.visible = false;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.time += dt;
    // Andar ou entrar na água cancela.
    if (this.player.position.distanceTo(this.start) > 0.8 || this.player.swimming) {
      this.stop();
      return;
    }
    this.timer -= dt;
    this.group.visible = true;
    this.player.rig.rodTip.getWorldPosition(this.tip);

    if (this.state === 'casting') {
      // Boia voando em arco até a água.
      const k = 1 - Math.max(0, this.timer) / 0.6;
      this.bobber.position.lerpVectors(this.tip, this.bobberTarget, k);
      this.bobber.position.y += Math.sin(k * Math.PI) * 1.5;
      if (this.timer <= 0) {
        this.state = 'waiting';
        this.timer = 2 + Math.random() * 4;
        this.hooks.splash(this.bobberTarget);
      }
    } else if (this.state === 'waiting') {
      this.bobber.position.copy(this.bobberTarget);
      this.bobber.position.y = WATER_LEVEL + 0.05 + Math.sin(this.time * 3) * 0.04;
      if (this.timer <= 0) {
        this.state = 'bite';
        this.timer = BITE_WINDOW;
        this.hooks.sound('splash');
        this.hooks.splash(this.bobberTarget);
      }
    } else if (this.state === 'bite') {
      this.bobber.position.copy(this.bobberTarget);
      this.bobber.position.y = WATER_LEVEL - 0.15 + Math.sin(this.time * 30) * 0.05;
      if (this.timer <= 0) {
        this.hooks.notify('O peixe escapou! Tente de novo.');
        this.stop();
        return;
      }
    }
    this.linePositions.set([this.tip.x, this.tip.y, this.tip.z, this.bobber.position.x, this.bobber.position.y, this.bobber.position.z]);
    (this.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
