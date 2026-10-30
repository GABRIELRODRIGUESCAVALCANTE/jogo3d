/**
 * Raposa de estimação e tesouros enterrados.
 *
 * Andando devagar com frutas na bolsa, as raposas selvagens ficam curiosas e
 * chegam perto. Dê 3 frutas a uma delas e ela vira sua amiga: a Brasa passa a
 * seguir você (até no barco) e fareja tesouros enterrados e baús esquecidos.
 * Quando sente o cheiro de algo, ela corre até o lugar e cava: aparece um
 * montinho de terra que você pode escavar.
 */
import * as THREE from 'three';
import { createRandom, dampAngle } from '../core/math';
import type { SoundName } from '../core/AudioManager';
import type { ItemBundle } from './data/items';
import type { GameEventBus } from './events';
import type { Interactable, InteractableProvider } from './InteractionSystem';
import { Animator, type ModelLibrary } from './models/ModelLibrary';
import type { Player } from './Player';
import type { HeightField } from './world/Terrain';
import { FOX_FILE, FOX_LENGTH, type Wildlife } from './world/Wildlife';
import { AURORA_CENTER } from './world/islands';
import { createFlatMaterial, part } from './models/geometry';

export const PET_NAME = 'Brasa';
/** Frutas para domesticar uma raposa. */
export const FRUITS_TO_TAME = 3;
const SNIFF_RADIUS = 28;
const FOLLOW_DISTANCE = 2.4;

export interface Treasure {
  id: string;
  x: number;
  z: number;
  loot: ItemBundle;
}

export interface PetHooks {
  fruitCount(): number;
  takeFruit(): void;
  give(bundle: ItemBundle): void;
  notify(text: string, kind?: 'info' | 'success' | 'warning'): void;
  sound(name: SoundName): void;
  burst(position: THREE.Vector3, color: string, count: number): void;
  addXP(amount: number): void;
  hasFlag(flag: string): boolean;
  setFlag(flag: string): void;
  /** Baús da história ainda fechados (a raposa também fareja). */
  closedChests(): Array<{ x: number; z: number }>;
  /** Barco em que o jogador está (a raposa vai junto). */
  boatSeat(): { x: number; y: number; z: number; yaw: number } | null;
}

export interface PetSave {
  x?: number;
  z?: number;
  stay?: boolean;
}

type PetState = 'follow' | 'stay' | 'sniff' | 'dig';

/** Recompensas possíveis dos tesouros (escolhidas por sorteio fixo). */
const LOOT_TABLE: ItemBundle[] = [
  { cristal: 2, corda: 1 },
  { semente: 3, fruta: 2 },
  { peixe_assado: 2, corda: 2 },
  { cristal: 3 },
  { batata_assada: 2, semente: 2 },
  { madeira: 8, pedra: 6 },
];

/** Lugares dos tesouros: sorteados uma vez, sempre iguais (dependem só do terreno). */
export function createTreasures(terrain: HeightField): Treasure[] {
  const out: Treasure[] = [];
  const pick = (prefix: string, cx: number, cz: number, rx: number, rz: number, count: number, seed: number) => {
    const r = createRandom(seed);
    let tries = 0;
    while (out.filter((t) => t.id.startsWith(prefix)).length < count && tries++ < 2000) {
      const x = cx + (r() * 2 - 1) * rx;
      const z = cz + (r() * 2 - 1) * rz;
      const h = terrain.getHeight(x, z);
      if (h < 1.2 || h > 16 || terrain.getSlope(x, z) > 0.45) continue;
      if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 45)) continue;
      const i = out.length;
      out.push({ id: `${prefix}${i}`, x, z, loot: LOOT_TABLE[Math.floor(r() * LOOT_TABLE.length)] });
    }
  };
  pick('tesouro_p', 0, 20, 130, 120, 8, 4242);
  pick('tesouro_a', AURORA_CENTER.x, AURORA_CENTER.z, 110, 110, 4, 777);
  return out;
}

export class PetSystem implements InteractableProvider {
  readonly group = new THREE.Group();
  readonly treasures: Treasure[];
  /** Frutas já dadas (a raposa vira amiga ao chegar a FRUITS_TO_TAME). */
  tameProgress = 0;
  state: PetState = 'follow';
  readonly position = new THREE.Vector3();
  yaw = 0;
  /** Tesouro ou baú que a raposa está farejando agora. */
  target: { x: number; z: number; treasure: Treasure | null } | null = null;

  private root: THREE.Object3D | null = null;
  private animator: Animator | null = null;
  private loading = false;
  private sniffTimer = 0;
  private digTimer = 0;
  private readonly mounds = new Map<string, THREE.Mesh>();
  private readonly announced = new Set<string>();
  private readonly tameInteractable: Interactable;
  private readonly petInteractable: Interactable;
  private readonly digInteractable: Interactable;
  private wildIndex = -1;
  private digTarget: Treasure | null = null;
  private readonly moundGeo: THREE.BufferGeometry;
  private readonly moundMat = createFlatMaterial();

  constructor(
    private readonly player: Player,
    private readonly terrain: HeightField,
    private readonly wildlife: Wildlife,
    private readonly models: ModelLibrary,
    private readonly bus: GameEventBus,
    private readonly hooks: PetHooks,
  ) {
    this.group.name = 'Raposa de estimação';
    this.treasures = createTreasures(terrain);
    this.moundGeo = part(new THREE.SphereGeometry(0.55, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#7a5533', {
      scale: [1.4, 0.45, 1.1],
    });

    this.tameInteractable = {
      id: 'raposa:fruta',
      position: new THREE.Vector3(),
      radius: 1.6,
      getAction: () =>
        this.hooks.fruitCount() > 0
          ? { label: `Dar fruta à raposa (${this.tameProgress}/${FRUITS_TO_TAME})`, enabled: true }
          : { label: 'Dar fruta à raposa', enabled: false, reason: 'Requer Fruta' },
      interact: () => this.feedWild(),
    };
    this.petInteractable = {
      id: 'raposa:carinho',
      position: new THREE.Vector3(),
      radius: 1.3,
      priority: 0.4,
      getAction: () => ({ label: this.state === 'stay' ? `${PET_NAME}: vem comigo!` : `${PET_NAME}: espere aqui`, enabled: true }),
      interact: () => this.toggleStay(),
    };
    this.digInteractable = {
      id: 'raposa:cavar',
      position: new THREE.Vector3(),
      radius: 1.4,
      getAction: () => ({ label: 'Escavar o tesouro', enabled: true }),
      interact: () => this.dig(),
    };
  }

  get tamed(): boolean {
    return this.hooks.hasFlag('raposa_domesticada');
  }

  /** Tesouros que a raposa já achou, mas ainda não foram escavados (aparecem no mapa). */
  get foundTreasures(): Treasure[] {
    return this.treasures.filter((t) => this.mounds.has(t.id));
  }

  get dugCount(): number {
    return this.treasures.filter((t) => this.hooks.hasFlag(`${t.id}_cavado`)).length;
  }

  queryInteractables(x: number, z: number, _range: number, out: Interactable[]): void {
    if (!this.tamed) {
      const i = this.wildlife.nearestFox(x, z, 3.2);
      this.wildIndex = i;
      if (i >= 0) {
        const f = this.wildlife.foxPosition(i)!;
        this.tameInteractable.position.set(f.x, this.terrain.getHeight(f.x, f.z) + 0.5, f.z);
        out.push(this.tameInteractable);
      }
      return;
    }
    if (this.root && this.position.distanceTo(this.player.position) < 3 && !this.hooks.boatSeat()) {
      this.petInteractable.position.copy(this.position).setY(this.position.y + 0.4);
      out.push(this.petInteractable);
    }
    this.digTarget = null;
    for (const t of this.foundTreasures) {
      if (Math.hypot(t.x - x, t.z - z) < 3) {
        this.digTarget = t;
        this.digInteractable.position.set(t.x, this.terrain.getHeight(t.x, t.z) + 0.3, t.z);
        out.push(this.digInteractable);
        break;
      }
    }
  }

  private feedWild(): void {
    if (this.wildIndex < 0 || this.hooks.fruitCount() <= 0) return;
    const f = this.wildlife.foxPosition(this.wildIndex);
    if (!f) return;
    this.hooks.takeFruit();
    this.tameProgress++;
    const at = new THREE.Vector3(f.x, this.terrain.getHeight(f.x, f.z) + 0.8, f.z);
    this.hooks.burst(at, '#ff8fa3', 6);
    this.hooks.sound('pickup');
    if (this.tameProgress < FRUITS_TO_TAME) {
      this.hooks.notify(`A raposa comeu a fruta e abanou o rabo. (${this.tameProgress}/${FRUITS_TO_TAME})`, 'info');
      return;
    }
    // Domesticada: sai da natureza e passa a seguir o jogador.
    this.wildlife.removeFox(this.wildIndex);
    this.wildIndex = -1;
    this.hooks.setFlag('raposa_domesticada');
    this.hooks.addXP(40);
    this.hooks.sound('quest');
    this.hooks.notify(
      `A raposa agora é sua amiga! O nome dela é ${PET_NAME}. Ela segue você e fareja tesouros enterrados e baús.`,
      'success',
    );
    this.bus.emit('pet:tamed', {});
    this.spawn(f.x, f.z, f.yaw);
  }

  private toggleStay(): void {
    this.state = this.state === 'stay' ? 'follow' : 'stay';
    this.hooks.burst(this.position.clone().setY(this.position.y + 1), '#ff8fa3', 5);
    this.hooks.notify(this.state === 'stay' ? `${PET_NAME} vai esperar aqui.` : `${PET_NAME} está seguindo você.`, 'info');
  }

  private dig(): void {
    const t = this.digTarget;
    if (!t) return;
    this.hooks.setFlag(`${t.id}_cavado`);
    const mound = this.mounds.get(t.id);
    if (mound) {
      this.group.remove(mound);
      this.mounds.delete(t.id);
    }
    const at = new THREE.Vector3(t.x, this.terrain.getHeight(t.x, t.z) + 0.3, t.z);
    this.hooks.burst(at, '#8a6440', 14);
    this.hooks.sound('chest');
    this.hooks.give(t.loot);
    this.hooks.addXP(15);
    this.bus.emit('treasure:dug', { id: t.id, total: this.dugCount });
    if (this.target?.treasure === t) this.target = null;
    if (this.state === 'dig' || this.state === 'sniff') this.state = 'follow';
  }

  /** Cria o modelo da raposa (o arquivo pode demorar um pouco). */
  private spawn(x: number, z: number, yaw: number): void {
    this.position.set(x, this.terrain.getHeight(x, z), z);
    this.yaw = yaw;
    if (this.root || this.loading) return;
    this.loading = true;
    void this.models.instance(FOX_FILE).then((model) => {
      this.loading = false;
      if (!model || this.root || !this.tamed) return;
      model.root.scale.setScalar(1.1 / FOX_LENGTH);
      const holder = new THREE.Group();
      holder.add(model.root);
      // Lencinho vermelho no pescoço: é a raposa de estimação.
      const scarf = new THREE.Mesh(
        part(new THREE.TorusGeometry(0.12, 0.04, 5, 10), '#d62828', { pos: [0, 0.42, 0.33], rot: [Math.PI / 2.4, 0, 0] }),
        createFlatMaterial(),
      );
      holder.add(scarf);
      this.group.add(holder);
      this.root = holder;
      this.animator = new Animator(model.root, model.clips);
      this.animator.play('Survey', 0);
    });
  }

  /** Mostra os montinhos de terra dos tesouros achados e não escavados. */
  private showMound(t: Treasure): void {
    if (this.mounds.has(t.id)) return;
    const mesh = new THREE.Mesh(this.moundGeo, this.moundMat);
    mesh.position.set(t.x, this.terrain.getHeight(t.x, t.z) - 0.05, t.z);
    mesh.castShadow = false;
    this.group.add(mesh);
    this.mounds.set(t.id, mesh);
  }

  update(dt: number): void {
    if (!this.tamed) return;
    if (!this.root) {
      if (!this.loading) this.spawn(this.player.position.x + 2, this.player.position.z + 2, 0);
      return;
    }
    const p = this.player.position;
    const seat = this.hooks.boatSeat();
    let anim: 'Survey' | 'Walk' | 'Run' = 'Survey';
    let speed = 0;
    let goal: { x: number; z: number } | null = null;

    if (seat) {
      // No barco: senta na proa.
      this.position.set(seat.x, seat.y, seat.z);
      this.yaw = seat.yaw;
      this.state = this.state === 'stay' ? 'follow' : this.state;
      this.target = null;
    } else {
      const toPlayer = Math.hypot(p.x - this.position.x, p.z - this.position.z);
      // Longe demais (viagem, teleporte): reaparece ao lado do jogador.
      if (toPlayer > 60 && this.state !== 'stay') {
        this.position.set(p.x - Math.sin(this.player.yaw) * 2, p.y, p.z - Math.cos(this.player.yaw) * 2);
        this.target = null;
        this.state = 'follow';
      }
      if (this.state === 'follow') this.sniff(dt);
      if (this.state === 'sniff' && this.target) {
        goal = this.target;
        const d = Math.hypot(goal.x - this.position.x, goal.z - this.position.z);
        if (d < 1.2) {
          this.state = 'dig';
          this.digTimer = 0;
        } else {
          speed = 6;
          anim = 'Run';
        }
        // Se o jogador se afastar muito, desiste e volta.
        if (toPlayer > 45) {
          this.state = 'follow';
          this.target = null;
        }
      } else if (this.state === 'dig' && this.target) {
        this.digTimer += dt;
        this.yaw = dampAngle(this.yaw, Math.atan2(this.target.x - this.position.x, this.target.z - this.position.z), 4, dt);
        if (this.digTimer % 0.5 < dt) {
          this.hooks.burst(new THREE.Vector3(this.target.x, this.position.y + 0.2, this.target.z), '#8a6440', 3);
        }
        if (this.target.treasure) this.showMound(this.target.treasure);
        // Fica esperando no lugar até o jogador chegar perto (ou se afastar demais).
        if (toPlayer < 2.5 && !this.target.treasure) {
          this.state = 'follow';
          this.target = null;
        } else if (toPlayer > 45 || (this.target.treasure && this.hooks.hasFlag(`${this.target.treasure.id}_cavado`))) {
          this.state = 'follow';
          this.target = null;
        }
      } else if (this.state === 'follow') {
        if (toPlayer > FOLLOW_DISTANCE) {
          goal = { x: p.x, z: p.z };
          speed = toPlayer > 7 ? 7.5 : 4.2;
          anim = toPlayer > 7 ? 'Run' : 'Walk';
        }
      }
      if (goal && speed > 0) {
        const dx = goal.x - this.position.x;
        const dz = goal.z - this.position.z;
        const d = Math.hypot(dx, dz) || 1;
        this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 6, dt);
        const step = Math.min(d, speed * dt);
        this.position.x += (dx / d) * step;
        this.position.z += (dz / d) * step;
      } else if (this.state === 'follow' || this.state === 'stay') {
        this.yaw = dampAngle(this.yaw, Math.atan2(p.x - this.position.x, p.z - this.position.z), 2, dt);
      }
      // Nada na água rasa: fica na altura da superfície.
      this.position.y = Math.max(this.terrain.getHeight(this.position.x, this.position.z), -0.35);
    }
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    this.animator?.play(anim, 0.25, anim === 'Walk' ? 1.1 : 1);
    this.animator?.update(dt);
  }

  /** Procura um tesouro (ou baú fechado) por perto. */
  private sniff(dt: number): void {
    this.sniffTimer -= dt;
    if (this.sniffTimer > 0) return;
    this.sniffTimer = 1;
    const p = this.player.position;
    let best: { x: number; z: number; treasure: Treasure | null; key: string } | null = null;
    let bestD = SNIFF_RADIUS;
    for (const t of this.treasures) {
      if (this.hooks.hasFlag(`${t.id}_cavado`)) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { x: t.x, z: t.z, treasure: t, key: t.id };
      }
    }
    for (const c of this.hooks.closedChests()) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bestD && d > 3) {
        bestD = d;
        best = { x: c.x, z: c.z, treasure: null, key: `bau:${c.x}:${c.z}` };
      }
    }
    if (!best) return;
    this.target = best;
    this.state = 'sniff';
    if (!this.announced.has(best.key)) {
      this.announced.add(best.key);
      this.hooks.sound('discover');
      this.hooks.notify(
        best.treasure ? `${PET_NAME} farejou alguma coisa enterrada! Siga-a.` : `${PET_NAME} sentiu o cheiro de um baú por perto! Siga-a.`,
        'info',
      );
    }
  }

  /** Restaura do salvamento (ou some, se a raposa ainda não foi domesticada). */
  load(data: PetSave | undefined, tameProgress: number): void {
    this.reset();
    this.tameProgress = tameProgress;
    if (!this.tamed) return;
    const x = data?.x ?? this.player.position.x + 2;
    const z = data?.z ?? this.player.position.z + 2;
    this.state = data?.stay ? 'stay' : 'follow';
    this.spawn(x, z, 0);
  }

  reset(): void {
    this.tameProgress = 0;
    this.state = 'follow';
    this.target = null;
    this.announced.clear();
    for (const m of this.mounds.values()) this.group.remove(m);
    this.mounds.clear();
    if (this.root) {
      this.group.remove(this.root);
      this.root = null;
      this.animator = null;
    }
  }

  toJSON(): PetSave | undefined {
    if (!this.tamed) return undefined;
    return { x: this.position.x, z: this.position.z, stay: this.state === 'stay' };
  }
}
