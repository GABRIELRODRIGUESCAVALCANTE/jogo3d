/**
 * Sistema de construção.
 *
 * Modo "posicionar": um fantasma verde/vermelho aparece à frente do jogador.
 * Verde = local válido. R gira, E (ou o botão Construir) confirma.
 * Modo "remover": aponte para uma construção e confirme para desmontá-la,
 * recuperando metade dos materiais.
 */
import * as THREE from 'three';
import type { SoundName } from '../core/AudioManager';
import { boxesOverlap, circleOverlapsBox, type Collider, type CollisionWorld } from './Collision';
import { ITEMS, type ItemBundle, type ItemId } from './data/items';
import type { StationId } from './data/recipes';
import { STRUCTURES, isStructureId, type StructureDef, type StructureId } from './data/structures';
import type { GameEventBus, NotifyKind } from './events';
import type { Interactable, InteractableProvider } from './InteractionSystem';
import type { Inventory } from './Inventory';
import type { LightManager, LightSource } from './LightManager';
import { createStructureModel, type StructureModel } from './models/structures';
import type { StructureSave } from './save/SaveData';
import type { CameraZone } from './world/Landmarks';
import { PROTECTED_ZONES, WATER_LEVEL } from './world/layout';
import type { ResourceManager } from './world/ResourceNodes';
import type { Terrain } from './world/Terrain';

export interface BuildingHooks {
  inventory: Inventory;
  level(): number;
  addXP(amount: number): void;
  notify(text: string, kind?: NotifyKind): void;
  sound(name: SoundName): void;
  burst(position: THREE.Vector3, color: string, count: number): void;
  isNight(): boolean;
  sleep(): void;
  rest(): void;
  openCrafting(station: StationId): void;
  playerPosition(): THREE.Vector3;
  playerYaw(): number;
}

export interface PlacedStructure {
  id: string;
  type: StructureId;
  def: StructureDef;
  x: number;
  y: number;
  z: number;
  rot: number;
  model: StructureModel;
  colliders: Collider[];
  light: LightSource | null;
  zone: CameraZone | null;
  use: Interactable | null;
  removal: Interactable;
  buildAnim: number;
}

export type BuildMode = 'none' | 'place' | 'remove';

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
  y: number;
}

let structureCounter = 0;

export class BuildingSystem implements InteractableProvider {
  readonly group = new THREE.Group();
  readonly structures: PlacedStructure[] = [];
  mode: BuildMode = 'none';
  placingType: StructureId | null = null;
  ghostCheck: PlacementCheck = { ok: false, y: 0 };

  private ghost: THREE.Group | null = null;
  private ghostRot = 0;
  private readonly ghostPos = new THREE.Vector3();
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    color: '#6dff8a',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private time = 0;

  constructor(
    private readonly terrain: Terrain,
    private readonly collision: CollisionWorld,
    private readonly resources: ResourceManager,
    private readonly lights: LightManager,
    private readonly bus: GameEventBus,
    private readonly hooks: BuildingHooks,
  ) {
    this.group.name = 'Construções';
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  count(type: StructureId): number {
    return this.structures.filter((s) => s.type === type).length;
  }

  isNearStation(station: StationId, pos: THREE.Vector3, radius = 6): boolean {
    return this.structures.some((s) => s.def.station === station && Math.hypot(s.x - pos.x, s.z - pos.z) <= radius);
  }

  /** Zonas de câmera das cabanas (para esconder o telhado lá dentro). */
  get cameraZones(): CameraZone[] {
    return this.structures.filter((s) => s.zone).map((s) => s.zone!);
  }

  /** Motivo pelo qual não é possível começar a construir (ou null se pode). */
  canStart(type: StructureId): string | null {
    const def = STRUCTURES[type];
    if (this.hooks.level() < def.minLevel) return `Requer nível ${def.minLevel}`;
    if (def.limit && this.count(type) >= def.limit) return `Limite de ${def.limit} atingido`;
    if (!this.hooks.inventory.hasAll(def.cost)) return 'Materiais insuficientes';
    return null;
  }

  // ---------------------------------------------------------------------------
  // Modos
  // ---------------------------------------------------------------------------

  startPlacement(type: StructureId): boolean {
    const reason = this.canStart(type);
    if (reason) {
      this.hooks.notify(reason, 'warning');
      this.hooks.sound('error');
      return false;
    }
    this.cancel();
    this.mode = 'place';
    this.placingType = type;
    const model = createStructureModel(type);
    model.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.material = this.ghostMaterial;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    this.ghost = model.root;
    this.ghostRot = this.snapAngle(this.hooks.playerYaw() + Math.PI);
    this.group.add(this.ghost);
    return true;
  }

  startRemoval(): void {
    this.cancel();
    this.mode = 'remove';
  }

  cancel(): void {
    if (this.ghost) {
      this.group.remove(this.ghost);
      this.ghost = null;
    }
    this.mode = 'none';
    this.placingType = null;
  }

  rotateGhost(): void {
    this.ghostRot = this.snapAngle(this.ghostRot + Math.PI / 4);
    this.hooks.sound('click');
  }

  /** Confirma a construção no local do fantasma. */
  confirmPlacement(): boolean {
    if (this.mode !== 'place' || !this.placingType) return false;
    const type = this.placingType;
    const check = this.ghostCheck;
    if (!check.ok) {
      this.hooks.notify(check.reason ?? 'Local inválido', 'warning');
      this.hooks.sound('error');
      return false;
    }
    const def = STRUCTURES[type];
    if (!this.hooks.inventory.removeAll(def.cost)) {
      this.hooks.notify('Materiais insuficientes', 'warning');
      return false;
    }
    const placed = this.place(type, this.ghostPos.x, this.ghostPos.z, this.ghostRot, true);
    this.hooks.sound('build');
    this.hooks.burst(new THREE.Vector3(placed.x, placed.y + 0.5, placed.z), '#d8c7a0', 24);
    this.hooks.addXP(def.xp);
    this.hooks.notify(`${def.name} construída!`, 'success');
    this.bus.emit('structure:built', { type, id: placed.id });
    // Cercas e caminhos: continua posicionando enquanto houver material.
    const repeatable = type === 'cerca' || type === 'caminho';
    if (!repeatable || this.canStart(type)) this.cancel();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Atualização
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    for (const s of this.structures) {
      if (s.buildAnim < 1) {
        s.buildAnim = Math.min(1, s.buildAnim + dt * 1.6);
        const k = 1 - (1 - s.buildAnim) ** 3;
        s.model.root.scale.set(1, Math.max(0.01, k), 1);
      }
      if (s.model.flames) {
        if (s.type === 'fogueira') {
          s.model.flames.children.forEach((f, i) => {
            const t = this.time * (8 + i * 3) + i;
            f.scale.set(1 + Math.sin(t) * 0.12, 1 + Math.sin(t * 1.3) * 0.22, 1 + Math.cos(t) * 0.12);
            f.rotation.y = this.time * (1 + i);
          });
        } else {
          s.model.flames.rotation.y += dt;
          s.model.flames.position.y = 2.55 + Math.sin(this.time * 2) * 0.05;
        }
      }
    }

    if (this.mode === 'place' && this.ghost && this.placingType) {
      const def = STRUCTURES[this.placingType];
      const p = this.hooks.playerPosition();
      const yaw = this.hooks.playerYaw();
      // À frente do jogador, longe o bastante para não ficar escondido atrás dele.
      const dist = def.footprint.d / 2 + Math.max(def.footprint.w, def.footprint.d) * 0.2 + 2.2;
      const x = Math.round((p.x + Math.sin(yaw) * dist) * 2) / 2;
      const z = Math.round((p.z + Math.cos(yaw) * dist) * 2) / 2;
      this.ghostCheck = this.validate(this.placingType, x, z, this.ghostRot);
      this.ghostPos.set(x, this.ghostCheck.y, z);
      this.ghost.position.copy(this.ghostPos);
      this.ghost.rotation.y = this.ghostRot;
      this.ghostMaterial.color.set(this.ghostCheck.ok ? '#6dff8a' : '#ff5d5d');
      this.ghostMaterial.opacity = 0.38 + Math.sin(this.time * 5) * 0.08;
    }
  }

  /** Verifica se é possível construir neste local. */
  validate(type: StructureId, x: number, z: number, rot: number): PlacementCheck {
    const def = STRUCTURES[type];
    const hw = def.footprint.w / 2;
    const hd = def.footprint.d / 2;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // Alturas do terreno em 9 pontos da base.
    let min = Infinity;
    let max = -Infinity;
    for (const sx of [-1, 0, 1]) {
      for (const sz of [-1, 0, 1]) {
        const lx = sx * hw;
        const lz = sz * hd;
        const h = this.terrain.getHeight(x + lx * cos + lz * sin, z - lx * sin + lz * cos);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    const y = type === 'cabana' ? max : this.terrain.getHeight(x, z);
    const fail = (reason: string): PlacementCheck => ({ ok: false, reason, y });

    const startReason = this.canStart(type);
    if (startReason) return fail(startReason);
    if (min < WATER_LEVEL + 0.3) return fail('Não é possível construir na água');
    if (max - min > def.maxSlope) return fail('Terreno muito inclinado');
    for (const zone of PROTECTED_ZONES) {
      if (circleOverlapsBox(zone.x, zone.z, zone.radius, x, z, hw, hd, rot)) return fail('Área protegida (marco antigo)');
    }
    const footprint = { x, z, hw, hd, rot };
    for (const s of this.structures) {
      const other = { x: s.x, z: s.z, hw: s.def.footprint.w / 2, hd: s.def.footprint.d / 2, rot: s.rot };
      if (boxesOverlap(footprint, other)) return fail('Espaço ocupado por outra construção');
    }
    if (this.collision.overlapsBox(x, z, hw, hd, rot)) return fail('Espaço ocupado');
    if (this.resources.anyInBox(x, z, hw, hd, rot)) return fail('Há plantas ou pedras no caminho');
    const p = this.hooks.playerPosition();
    if (circleOverlapsBox(p.x, p.z, 0.45, x, z, hw, hd, rot)) return fail('Saia de cima do local');
    return { ok: true, y };
  }

  // ---------------------------------------------------------------------------
  // Criar / remover
  // ---------------------------------------------------------------------------

  /** Cria a construção no mundo (usado ao construir e ao carregar). */
  place(type: StructureId, x: number, z: number, rot: number, animate: boolean, id?: string): PlacedStructure {
    const def = STRUCTURES[type];
    const check = this.validateHeightOnly(type, x, z, rot);
    const y = check;
    const model = createStructureModel(type);
    model.root.position.set(x, y, z);
    model.root.rotation.y = rot;
    if (animate) model.root.scale.set(1, 0.01, 1);
    this.group.add(model.root);

    const structure: PlacedStructure = {
      id: id ?? `${type}_${Date.now().toString(36)}_${structureCounter++}`,
      type,
      def,
      x,
      y,
      z,
      rot,
      model,
      colliders: [],
      light: null,
      zone: null,
      use: null,
      removal: null as unknown as Interactable,
      buildAnim: animate ? 0 : 1,
    };

    // Converte coordenadas locais da construção em coordenadas do mundo.
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const world = (lx: number, lz: number) => ({ x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos });
    const box = (lx: number, lz: number, hw: number, hd: number, top: number) => {
      const c = world(lx, lz);
      structure.colliders.push(this.collision.add({ kind: 'box', x: c.x, z: c.z, hw, hd, rot, top: y + top, tag: structure.id }));
    };
    const circle = (r: number, top: number) => {
      structure.colliders.push(this.collision.add({ kind: 'circle', x, z, r, top: y + top, tag: structure.id }));
    };

    switch (type) {
      case 'cabana': {
        const W = 6;
        const D = 5;
        const seg = (W + 0.5 - 1.4) / 2;
        box(0, 0, W / 2 + 0.2, D / 2 + 0.2, 0.32); // piso (dá para pisar)
        box(0, -D / 2, W / 2 + 0.25, 0.25, 3.2); // parede do fundo
        box(-W / 2, 0, 0.25, D / 2 + 0.25, 3.2); // laterais
        box(W / 2, 0, 0.25, D / 2 + 0.25, 3.2);
        box(-(0.7 + seg / 2), D / 2, seg / 2, 0.25, 3.2); // frente (com porta)
        box(0.7 + seg / 2, D / 2, seg / 2, 0.25, 3.2);
        box(-1.9, -1.15, 0.65, 1.1, 0.95); // cama
        box(1.8, -1.5, 0.45, 0.45, 1.05); // mesa
        box(0, D / 2 + 0.5, 0.8, 0.35, 0.12); // degrau
        // Ponto de uso ao lado da cama, do lado de dentro.
        const bed = world(-1.2, -1.0);
        structure.use = {
          id: `${structure.id}:cama`,
          position: new THREE.Vector3(bed.x, y + 1, bed.z),
          radius: 0.6,
          getAction: () =>
            this.hooks.isNight()
              ? { label: 'Dormir até o amanhecer', enabled: true }
              : { label: 'Descansar e salvar', enabled: true },
          interact: () => (this.hooks.isNight() ? this.hooks.sleep() : this.hooks.rest()),
        };
        structure.zone = { x, z, radius: 2.9, maxDistance: 3.2, hide: model.roof ? [model.roof] : [] };
        break;
      }
      case 'fogueira':
        circle(0.75, 0.9);
        structure.use = {
          id: `${structure.id}:usar`,
          position: new THREE.Vector3(x, y + 0.5, z),
          radius: 1,
          getAction: () => ({ label: 'Cozinhar na fogueira', enabled: true }),
          interact: () => this.hooks.openCrafting('fogueira'),
        };
        break;
      case 'bancada':
        box(0, 0, 1.05, 0.55, 1.5);
        structure.use = {
          id: `${structure.id}:usar`,
          position: new THREE.Vector3(x, y + 1, z),
          radius: 1.3,
          getAction: () => ({ label: 'Usar bancada', enabled: true }),
          interact: () => this.hooks.openCrafting('bancada'),
        };
        break;
      case 'cerca':
        box(0, 0, 1.2, 0.12, 1.3);
        break;
      case 'lanterna':
        circle(0.3, 3);
        break;
      case 'caminho':
        break;
    }

    if (def.light) {
      structure.light = this.lights.add({
        position: new THREE.Vector3(x, y + def.light.height, z),
        color: new THREE.Color(def.light.color),
        intensity: def.light.intensity,
        distance: def.light.distance,
        flicker: def.light.flicker,
        nightOnly: type === 'lanterna',
      });
    }

    structure.removal = {
      id: `remover:${structure.id}`,
      position: new THREE.Vector3(x, y + 1, z),
      radius: Math.max(def.footprint.w, def.footprint.d) / 2 + 0.5,
      getAction: () => ({ label: `Remover ${def.name} (devolve 50%)`, enabled: true }),
      interact: () => this.remove(structure, true),
    };

    this.structures.push(structure);
    return structure;
  }

  remove(structure: PlacedStructure, refund: boolean): void {
    const i = this.structures.indexOf(structure);
    if (i < 0) return;
    this.structures.splice(i, 1);
    this.group.remove(structure.model.root);
    for (const c of structure.colliders) this.collision.remove(c);
    if (structure.light) this.lights.remove(structure.light);
    for (const h of structure.zone?.hide ?? []) h.visible = true;
    if (refund) {
      const back: ItemBundle = {};
      for (const [id, n] of Object.entries(structure.def.cost)) {
        const amount = Math.floor((n ?? 0) / 2);
        if (amount > 0) back[id as ItemId] = amount;
      }
      this.hooks.inventory.addAll(back);
      const text = Object.entries(back)
        .map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`)
        .join(', ');
      this.hooks.notify(`${structure.def.name} removida${text ? ` (+${text})` : ''}`, 'info');
      this.hooks.sound('build');
      this.hooks.burst(new THREE.Vector3(structure.x, structure.y + 0.6, structure.z), '#c9a46a', 16);
      this.bus.emit('structure:removed', { type: structure.type, id: structure.id });
    }
  }

  clear(): void {
    for (const s of [...this.structures]) this.remove(s, false);
    this.cancel();
  }

  queryInteractables(x: number, z: number, range: number, out: Interactable[]): void {
    for (const s of this.structures) {
      if (Math.abs(s.x - x) > range + 6 || Math.abs(s.z - z) > range + 6) continue;
      if (this.mode === 'remove') out.push(s.removal);
      else if (s.use && this.mode === 'none') out.push(s.use);
    }
  }

  // ---------------------------------------------------------------------------
  // Salvamento
  // ---------------------------------------------------------------------------

  toJSON(): StructureSave[] {
    return this.structures.map((s) => ({ id: s.id, type: s.type, x: s.x, z: s.z, rot: s.rot }));
  }

  load(list: StructureSave[]): void {
    this.clear();
    for (const s of list) {
      if (isStructureId(s.type)) this.place(s.type, s.x, s.z, s.rot, false, s.id);
    }
  }

  // ---------------------------------------------------------------------------

  private validateHeightOnly(type: StructureId, x: number, z: number, rot: number): number {
    if (type !== 'cabana') return this.terrain.getHeight(x, z);
    const def = STRUCTURES[type];
    const hw = def.footprint.w / 2;
    const hd = def.footprint.d / 2;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    let max = -Infinity;
    for (const sx of [-1, 0, 1]) {
      for (const sz of [-1, 0, 1]) {
        const lx = sx * hw;
        const lz = sz * hd;
        max = Math.max(max, this.terrain.getHeight(x + lx * cos + lz * sin, z - lx * sin + lz * cos));
      }
    }
    return max;
  }

  private snapAngle(a: number): number {
    const step = Math.PI / 4;
    const full = Math.PI * 2;
    const snapped = Math.round(a / step) * step;
    return ((snapped % full) + full) % full;
  }
}
