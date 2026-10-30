/**
 * Sistema de construção.
 *
 * Modo "posicionar": um fantasma verde/vermelho aparece à frente do jogador.
 * Verde = local válido. R gira, E (ou o botão Construir) confirma.
 * Modo "remover": aponte para uma construção e confirme para desmontá-la,
 * recuperando metade dos materiais.
 *
 * Peças modulares (piso, paredes, telhado) se encaixam numa grade de 2 m:
 * - o piso ocupa uma célula;
 * - a parede fica na borda de uma célula (R troca a direção);
 * - o telhado precisa de pelo menos uma parede na borda da célula.
 */
import * as THREE from 'three';
import type { SoundName } from '../core/AudioManager';
import { boxesOverlap, circleOverlapsBox, type Collider, type CollisionWorld } from './Collision';
import { ITEMS, isItemId, type ItemBundle, type ItemId } from './data/items';
import type { StationId } from './data/recipes';
import { GRID, STRUCTURES, WALL_HEIGHT, isStructureId, type StructureDef, type StructureId } from './data/structures';
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

/** Segundos de jogo para a batata-doce crescer no canteiro. */
export const CROP_GROW_SECONDS = 240;

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
  openStorage(structure: PlacedStructure): void;
  playerPosition(): THREE.Vector3;
  playerYaw(): number;
  playTime(): number;
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
  /** Itens guardados (baú). */
  storage?: Map<ItemId, number>;
  /** Momento (tempo de jogo) em que algo foi plantado; -1 = canteiro vazio. */
  plantedAt?: number;
  /** Animação da tampa do baú (0 fechado, 1 aberto). */
  lidOpen?: number;
}

export type BuildMode = 'none' | 'place' | 'remove';

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
  y: number;
}

let structureCounter = 0;

/** Centro da célula da grade que contém a coordenada. */
const cellCenter = (v: number) => Math.floor(v / GRID) * GRID + GRID / 2;

export class BuildingSystem implements InteractableProvider {
  readonly group = new THREE.Group();
  readonly structures: PlacedStructure[] = [];
  mode: BuildMode = 'none';
  placingType: StructureId | null = null;
  ghostCheck: PlacementCheck = { ok: false, y: 0 };

  private ghost: THREE.Group | null = null;
  private ghostRot = 0;
  /** Verdadeiro depois que o jogador gira a peça com R (para de seguir o olhar). */
  private manualRotation = false;
  private readonly ghostPos = new THREE.Vector3();
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    color: '#6dff8a',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private time = 0;
  private roofZones: CameraZone[] = [];

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

  /** Zonas de câmera: cabanas e telhados modulares (escondem o teto lá dentro). */
  get cameraZones(): CameraZone[] {
    return [...this.structures.filter((s) => s.zone).map((s) => s.zone!), ...this.roofZones];
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
    if (model.crop) model.crop.visible = false;
    this.ghost = model.root;
    const yaw = this.hooks.playerYaw();
    this.manualRotation = false;
    if (STRUCTURES[type].modular === 'parede') {
      // A parede começa de frente para o jogador.
      this.ghostRot = Math.abs(Math.cos(yaw)) > Math.abs(Math.sin(yaw)) ? 0 : Math.PI / 2;
    } else if (STRUCTURES[type].modular) {
      this.ghostRot = 0;
    } else {
      this.ghostRot = this.snapAngle(yaw + Math.PI);
    }
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
    const modular = this.placingType ? STRUCTURES[this.placingType].modular : undefined;
    if (modular === 'parede') this.ghostRot = this.ghostRot === 0 ? Math.PI / 2 : 0;
    else if (!modular) this.ghostRot = this.snapAngle(this.ghostRot + Math.PI / 4);
    this.manualRotation = true;
    this.hooks.sound('rotate');
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
    const placed = this.place(type, this.ghostPos.x, this.ghostPos.z, this.ghostRot, true, undefined, def.modular ? check.y : undefined);
    this.hooks.sound('build');
    this.hooks.burst(new THREE.Vector3(placed.x, placed.y + 0.5, placed.z), '#d8c7a0', 24);
    this.hooks.addXP(def.xp);
    this.hooks.notify(`${def.name}: construído!`, 'success');
    this.bus.emit('structure:built', { type, id: placed.id });
    // Peças repetitivas: continua posicionando enquanto houver material.
    const repeatable = type === 'cerca' || type === 'caminho' || !!def.modular;
    if (!repeatable || this.canStart(type)) this.cancel();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Atualização
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    const now = this.hooks.playTime();
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
      if (s.type === 'canteiro') this.updateGardenVisual(s, now);
      if (s.model.lid && s.lidOpen !== undefined) {
        // A tampa abre ao usar o baú e fecha sozinha depois.
        s.lidOpen = Math.max(0, s.lidOpen - dt * 0.4);
        s.model.lid.rotation.x = -Math.min(1, s.lidOpen * 3) * 1.6;
      }
    }

    if (this.mode === 'place' && this.ghost && this.placingType) {
      const def = STRUCTURES[this.placingType];
      const p = this.hooks.playerPosition();
      const yaw = this.hooks.playerYaw();
      let x: number;
      let z: number;
      if (def.modular) {
        const tx = p.x + Math.sin(yaw) * 2.6;
        const tz = p.z + Math.cos(yaw) * 2.6;
        if (def.modular === 'parede') {
          // A parede fica de frente para o jogador, a menos que ele tenha girado com R.
          if (!this.manualRotation) this.ghostRot = Math.abs(Math.cos(yaw)) > Math.abs(Math.sin(yaw)) ? 0 : Math.PI / 2;
          // Paredes ficam nas bordas da grade (coordenadas pares).
          if (this.ghostRot === 0) {
            x = cellCenter(tx);
            z = Math.round(tz / GRID) * GRID;
          } else {
            x = Math.round(tx / GRID) * GRID;
            z = cellCenter(tz);
          }
        } else {
          x = cellCenter(tx);
          z = cellCenter(tz);
        }
      } else {
        // À frente do jogador, longe o bastante para não ficar escondido atrás dele.
        const dist = def.footprint.d / 2 + Math.max(def.footprint.w, def.footprint.d) * 0.2 + 2.2;
        x = Math.round((p.x + Math.sin(yaw) * dist) * 2) / 2;
        z = Math.round((p.z + Math.cos(yaw) * dist) * 2) / 2;
      }
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
    const { min, max } = this.heightRange(x, z, hw, hd, rot);
    let y = type === 'cabana' || def.modular === 'piso' ? max : this.terrain.getHeight(x, z);
    if (def.modular === 'parede') y = this.wallBase(x, z) ?? max;
    if (def.modular === 'telhado') y = this.roofBase(x, z) ?? max + WALL_HEIGHT;
    const fail = (reason: string): PlacementCheck => ({ ok: false, reason, y });

    const startReason = this.canStart(type);
    if (startReason) return fail(startReason);
    for (const zone of PROTECTED_ZONES) {
      if (circleOverlapsBox(zone.x, zone.z, zone.radius, x, z, hw, hd, rot)) return fail('Área protegida (marco antigo)');
    }

    if (def.modular) return this.validateModular(type, x, z, rot, y, min, max);

    if (min < WATER_LEVEL + 0.3) return fail('Não é possível construir na água');
    if (max - min > def.maxSlope) return fail('Terreno muito inclinado');
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

  private validateModular(type: StructureId, x: number, z: number, rot: number, y: number, min: number, max: number): PlacementCheck {
    const def = STRUCTURES[type];
    const kind = def.modular!;
    const hw = def.footprint.w / 2;
    const hd = def.footprint.d / 2;
    const fail = (reason: string): PlacementCheck => ({ ok: false, reason, y });

    // Uma peça de cada tipo por posição.
    if (this.structures.some((s) => s.def.modular === kind && Math.abs(s.x - x) < 0.1 && Math.abs(s.z - z) < 0.1)) {
      return fail('Já existe uma peça aqui');
    }
    if (kind === 'telhado') {
      if (this.roofBase(x, z) === null) return fail('O telhado precisa de uma parede na borda da célula');
      return { ok: true, y };
    }
    const onFloor = kind === 'parede' && this.wallBase(x, z) !== null;
    if (!onFloor) {
      if (min < WATER_LEVEL + 0.3) return fail('Não é possível construir na água');
      if (max - min > def.maxSlope) return fail('Terreno muito inclinado');
    }
    // Não pode invadir construções comuns (cabana, bancada...).
    const footprint = { x, z, hw, hd, rot };
    for (const s of this.structures) {
      if (s.def.modular) continue;
      const other = { x: s.x, z: s.z, hw: s.def.footprint.w / 2, hd: s.def.footprint.d / 2, rot: s.rot };
      if (boxesOverlap(footprint, other)) return fail('Espaço ocupado por outra construção');
    }
    const modularIds = new Set(this.structures.filter((s) => s.def.modular).map((s) => s.id));
    if (this.collision.overlapsBox(x, z, hw * 0.95, hd * 0.95, rot, (c) => !!c.tag && modularIds.has(c.tag))) {
      return fail('Espaço ocupado');
    }
    if (this.resources.anyInBox(x, z, hw, hd, rot)) return fail('Há plantas ou pedras no caminho');
    if (kind === 'parede') {
      const p = this.hooks.playerPosition();
      if (circleOverlapsBox(p.x, p.z, 0.45, x, z, hw, hd, rot)) return fail('Saia de cima do local');
    }
    return { ok: true, y };
  }

  /** Altura do topo do piso sob uma parede (ou null se não houver piso ao lado). */
  private wallBase(x: number, z: number): number | null {
    let best: number | null = null;
    for (const s of this.structures) {
      if (s.def.modular !== 'piso') continue;
      // A parede está na borda do piso: o centro dela fica a 1 m do centro do piso.
      if (Math.abs(s.x - x) <= GRID / 2 + 0.05 && Math.abs(s.z - z) <= GRID / 2 + 0.05) {
        best = Math.max(best ?? -Infinity, s.y + 0.15);
      }
    }
    return best;
  }

  /** Altura do topo das paredes nas bordas de uma célula (ou null se não houver). */
  private roofBase(x: number, z: number): number | null {
    let best: number | null = null;
    for (const s of this.structures) {
      if (s.def.modular !== 'parede') continue;
      const dx = Math.abs(s.x - x);
      const dz = Math.abs(s.z - z);
      if ((dx < 0.1 && Math.abs(dz - GRID / 2) < 0.1) || (dz < 0.1 && Math.abs(dx - GRID / 2) < 0.1)) {
        best = Math.max(best ?? -Infinity, s.y + WALL_HEIGHT);
      }
    }
    return best;
  }

  private heightRange(x: number, z: number, hw: number, hd: number, rot: number): { min: number; max: number } {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
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
    return { min, max };
  }

  // ---------------------------------------------------------------------------
  // Criar / remover
  // ---------------------------------------------------------------------------

  /** Cria a construção no mundo (usado ao construir e ao carregar). */
  place(
    type: StructureId,
    x: number,
    z: number,
    rot: number,
    animate: boolean,
    id?: string,
    fixedY?: number,
    data?: Record<string, number | string>,
  ): PlacedStructure {
    const def = STRUCTURES[type];
    const y = fixedY ?? this.baseHeight(type, x, z, rot);
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
    const box = (lx: number, lz: number, hw: number, hd: number, top: number, bottom?: number) => {
      const c = world(lx, lz);
      // Paredes altas também bloqueiam a câmera.
      structure.colliders.push(
        this.collision.add({
          kind: 'box',
          x: c.x,
          z: c.z,
          hw,
          hd,
          rot,
          top: y + top,
          bottom: bottom === undefined ? undefined : y + bottom,
          tag: structure.id,
          camera: top > 2 && bottom === undefined,
        }),
      );
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
      case 'bau':
        box(0, 0, 0.62, 0.4, 0.9);
        structure.storage = new Map();
        structure.lidOpen = 0;
        if (data) {
          for (const [item, n] of Object.entries(data)) {
            if (isItemId(item) && typeof n === 'number' && n > 0) structure.storage.set(item, Math.floor(n));
          }
        }
        structure.use = {
          id: `${structure.id}:abrir`,
          position: new THREE.Vector3(x, y + 0.5, z),
          radius: 0.9,
          getAction: () => ({ label: 'Abrir baú de armazenamento', enabled: true }),
          interact: () => {
            structure.lidOpen = 1;
            this.hooks.sound('chest');
            this.hooks.openStorage(structure);
          },
        };
        break;
      case 'canteiro':
        structure.plantedAt = typeof data?.plantedAt === 'number' ? data.plantedAt : -1;
        structure.use = {
          id: `${structure.id}:horta`,
          position: new THREE.Vector3(x, y + 0.4, z),
          radius: 1.2,
          getAction: () => this.gardenAction(structure),
          interact: () => this.useGarden(structure),
        };
        break;
      case 'piso':
        box(0, 0, 1, 1, 0.15);
        break;
      case 'parede':
      case 'parede_janela':
        box(0, 0, 1.05, 0.15, WALL_HEIGHT);
        break;
      case 'parede_porta':
        box(-0.775, 0, 0.275, 0.15, WALL_HEIGHT);
        box(0.775, 0, 0.275, 0.15, WALL_HEIGHT);
        box(0, 0, 0.5, 0.15, WALL_HEIGHT, 2.15); // verga acima da porta
        break;
      case 'telhado':
        box(0, 0, 1.15, 1.15, 0.55, -0.05); // dá para passar por baixo
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
      position: new THREE.Vector3(x, y + (def.modular === 'telhado' ? 0 : 1), z),
      radius: Math.max(def.footprint.w, def.footprint.d) / 2 + 0.5,
      getAction: () => ({ label: `Remover ${def.name} (devolve 50%)`, enabled: true }),
      interact: () => this.remove(structure, true),
    };

    this.structures.push(structure);
    if (type === 'canteiro') this.updateGardenVisual(structure, this.hooks.playTime());
    if (def.modular === 'telhado') this.rebuildRoofZones();
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
    if (structure.def.modular === 'telhado') {
      structure.model.root.visible = true;
      this.rebuildRoofZones();
    }
    if (refund) {
      const back: ItemBundle = {};
      for (const [id, n] of Object.entries(structure.def.cost)) {
        const amount = Math.floor((n ?? 0) / 2);
        if (amount > 0) back[id as ItemId] = amount;
      }
      // O conteúdo de um baú volta inteiro para o jogador.
      for (const [id, n] of structure.storage ?? []) back[id] = (back[id] ?? 0) + n;
      this.hooks.inventory.addAll(back);
      const text = Object.entries(back)
        .map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`)
        .join(', ');
      this.hooks.notify(`${structure.def.name} removido${text ? ` (+${text})` : ''}`, 'info');
      this.hooks.sound('remove');
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
  // Baú de armazenamento
  // ---------------------------------------------------------------------------

  /** Move itens entre o inventário e um baú. Retorna quanto foi movido. */
  transfer(structure: PlacedStructure, item: ItemId, amount: number, toChest: boolean): number {
    const storage = structure.storage;
    if (!storage) return 0;
    const inv = this.hooks.inventory;
    if (toChest) {
      // Ferramentas não vão para o baú (perderiam a durabilidade guardada).
      if (ITEMS[item].tool) return 0;
      const n = Math.min(amount, inv.count(item));
      if (n <= 0 || !inv.remove(item, n)) return 0;
      storage.set(item, (storage.get(item) ?? 0) + n);
      return n;
    }
    const n = Math.min(amount, storage.get(item) ?? 0);
    if (n <= 0) return 0;
    const added = inv.add(item, n);
    const left = (storage.get(item) ?? 0) - added;
    if (left > 0) storage.set(item, left);
    else storage.delete(item);
    return added;
  }

  // ---------------------------------------------------------------------------
  // Horta
  // ---------------------------------------------------------------------------

  /** Progresso do canteiro (0 a 1), ou -1 se estiver vazio. */
  gardenProgress(s: PlacedStructure, now = this.hooks.playTime()): number {
    if (s.plantedAt === undefined || s.plantedAt < 0) return -1;
    return Math.min(1, Math.max(0, (now - s.plantedAt) / CROP_GROW_SECONDS));
  }

  private gardenAction(s: PlacedStructure) {
    const k = this.gardenProgress(s);
    if (k < 0) {
      return this.hooks.inventory.has('semente')
        ? { label: 'Plantar semente', enabled: true }
        : { label: 'Plantar semente', enabled: false, reason: 'Precisa de Semente (às vezes vem do capim alto)' };
    }
    if (k < 1) return { label: `Crescendo… ${Math.floor(k * 100)}%`, enabled: false, reason: 'Ainda não está pronto para colher' };
    return { label: 'Colher batatas-doces', enabled: true };
  }

  private useGarden(s: PlacedStructure): void {
    const k = this.gardenProgress(s);
    const pos = new THREE.Vector3(s.x, s.y + 0.4, s.z);
    if (k < 0) {
      if (!this.hooks.inventory.remove('semente', 1)) return;
      s.plantedAt = this.hooks.playTime();
      this.hooks.sound('leaves');
      this.hooks.burst(pos, '#6b4a2e', 10);
      this.hooks.notify('Semente plantada! Volte em alguns minutos para colher.', 'success');
      return;
    }
    if (k < 1) return;
    s.plantedAt = -1;
    const seeds = 1 + (Math.random() < 0.4 ? 1 : 0);
    this.hooks.inventory.add('batata_doce', 3);
    this.hooks.inventory.add('semente', seeds);
    this.hooks.addXP(6);
    this.hooks.sound('pickup');
    this.hooks.burst(pos, '#c8573a', 14);
    this.hooks.notify(`Colheita: 3 Batata-doce e ${seeds} Semente${seeds > 1 ? 's' : ''}`, 'item');
    this.bus.emit('crop:harvested', { itemId: 'batata_doce', amount: 3 });
    this.bus.emit('resource:gathered', { itemId: 'batata_doce', amount: 3 });
  }

  private updateGardenVisual(s: PlacedStructure, now: number): void {
    const k = this.gardenProgress(s, now);
    const plant = s.model.plant;
    const crop = s.model.crop;
    if (plant) {
      plant.visible = k >= 0;
      const scale = k < 0 ? 0.01 : 0.15 + 0.85 * k;
      plant.scale.set(scale, scale, scale);
    }
    if (crop) crop.visible = k >= 1;
  }

  // ---------------------------------------------------------------------------
  // Telhados modulares
  // ---------------------------------------------------------------------------

  /** Cada telhado vira uma zona: ao entrar embaixo, os telhados próximos somem. */
  private rebuildRoofZones(): void {
    const roofs = this.structures.filter((s) => s.def.modular === 'telhado');
    this.roofZones = roofs.map((r) => ({
      x: r.x,
      z: r.z,
      radius: 1.3,
      maxDistance: 3.6,
      hide: roofs.filter((o) => Math.hypot(o.x - r.x, o.z - r.z) < 12).map((o) => o.model.root),
    }));
  }

  // ---------------------------------------------------------------------------
  // Salvamento
  // ---------------------------------------------------------------------------

  toJSON(): StructureSave[] {
    return this.structures.map((s) => {
      const save: StructureSave = { id: s.id, type: s.type, x: s.x, z: s.z, rot: s.rot };
      if (s.def.modular) save.y = s.y;
      if (s.storage) save.data = Object.fromEntries(s.storage);
      if (s.type === 'canteiro') save.data = { plantedAt: s.plantedAt ?? -1 };
      return save;
    });
  }

  load(list: StructureSave[]): void {
    this.clear();
    for (const s of list) {
      if (isStructureId(s.type)) this.place(s.type, s.x, s.z, s.rot, false, s.id, s.y, s.data);
    }
  }

  // ---------------------------------------------------------------------------

  private baseHeight(type: StructureId, x: number, z: number, rot: number): number {
    const def = STRUCTURES[type];
    if (type !== 'cabana' && !def.modular) return this.terrain.getHeight(x, z);
    return this.heightRange(x, z, def.footprint.w / 2, def.footprint.d / 2, rot).max;
  }

  private snapAngle(a: number): number {
    const step = Math.PI / 4;
    const full = Math.PI * 2;
    const snapped = Math.round(a / step) * step;
    return ((snapped % full) + full) % full;
  }
}
