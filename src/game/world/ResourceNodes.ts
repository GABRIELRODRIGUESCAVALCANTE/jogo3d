/**
 * Recursos coletáveis (árvores, pedras, arbustos, capim e cristais).
 *
 * Para economizar desempenho, cada tipo usa um `InstancedMesh`: centenas de
 * árvores são desenhadas em uma única chamada à GPU. Cada recurso guarda o
 * índice da sua instância para poder balançar, cair, sumir e renascer.
 */
import * as THREE from 'three';
import { createRandom, randRange } from '../../core/math';
import { circleOverlapsBox, type Collider, type CollisionWorld } from '../Collision';
import { ITEMS, type ItemId } from '../data/items';
import { NODE_KINDS, type NodeKind, type NodeKindDef } from '../data/resources';
import type { Interactable, InteractableProvider, InteractionContext } from '../InteractionSystem';
import { addWind, createFlatMaterial } from '../models/geometry';
import {
  makeBerries,
  makeBroadleafTree,
  makeBush,
  makeCrystalCluster,
  makeGrassClump,
  makePalmTree,
  makePineTree,
  makeRock,
  makeStump,
} from '../models/props';
import type { NodeSave } from '../save/SaveData';
import type { HeightField, IslandId } from './Terrain';
import { AURORA_CENTER, AURORA_KEEP_CLEAR, AURORA_PLACES, auroraPathDistance } from './islands';
import { PLACES, WORLD_SEED, distanceToPaths, type Place } from './layout';

export interface ResourceNode {
  id: string;
  kind: NodeKind;
  def: NodeKindDef;
  variant: number;
  index: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  remaining: number;
  /** Momento (tempo de jogo) em que renasce; 0 = disponível. */
  respawnAt: number;
  collider: Collider | null;
  anim: { type: 'shake' | 'fall' | 'shrink' | 'grow'; t: number; dirX: number; dirZ: number } | null;
  interactable: Interactable;
  stumpIndex: number;
}

export interface HitResult {
  node: ResourceNode;
  item: ItemId;
  amount: number;
  bonus: ItemId | null;
  toolUsed: 'machado' | 'picareta' | 'none';
  depleted: boolean;
}

/** Áreas onde nada nasce (marcos, trilhas largas, clareira de construção). */
const KEEP_CLEAR: Array<Place & { radius: number }> = [
  { ...PLACES.spawn, radius: 7 },
  { ...PLACES.clearing, radius: 16 },
  { ...PLACES.ruins, radius: 24 },
  { ...PLACES.cave, radius: 13 },
  { ...PLACES.caveEntrance, radius: 8 },
  { ...PLACES.peak, radius: 8 },
  { ...PLACES.giantTree, radius: 9 },
  { ...PLACES.chestBeach, radius: 3 },
  { ...PLACES.shipwreck, radius: 6 },
];

const CELL = 8;

export class ResourceManager implements InteractableProvider {
  readonly group = new THREE.Group();
  readonly nodes: ResourceNode[] = [];
  /** Chamado a cada golpe bem-sucedido. */
  onHit: ((result: HitResult) => void) | null = null;

  private meshes = new Map<string, THREE.InstancedMesh>(); // chave: tipo:variante
  private stumps!: THREE.InstancedMesh;
  private berries!: THREE.InstancedMesh;
  private grid = new Map<number, ResourceNode[]>();
  private byId = new Map<string, ResourceNode>();
  private animating = new Set<ResourceNode>();
  private respawnTimer = 0;
  /** Prefixo dos ids (ilhas diferentes não podem repetir ids no salvamento). */
  private idPrefix = '';
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly quatYaw = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly posV = new THREE.Vector3();
  private readonly scaleV = new THREE.Vector3();
  private readonly zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(
    private readonly terrain: HeightField,
    private readonly collision: CollisionWorld,
    private readonly windTime: { value: number },
  ) {
    this.group.name = 'Recursos';
  }

  // ---------------------------------------------------------------------------
  // Geração
  // ---------------------------------------------------------------------------

  /** Espalha os recursos de uma ilha (cada ilha tem seu próprio gerenciador). */
  generate(island: IslandId = 'principal'): void {
    const aurora = island === 'aurora';
    this.idPrefix = aurora ? 'aurora:' : '';
    const center = aurora ? AURORA_CENTER : { x: 0, z: 0 };
    const extent = aurora ? 125 : 165;
    const keepClear = aurora ? AURORA_KEEP_CLEAR : KEEP_CLEAR;
    const pathDistance = aurora ? auroraPathDistance : distanceToPaths;
    const random = createRandom(WORLD_SEED + (aurora ? 41 : 1));
    const placed: Array<{ x: number; z: number; r: number }> = [];

    const tooClose = (x: number, z: number, spacing: number) => {
      for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < Math.max(spacing, p.r)) return true;
      return false;
    };
    const blocked = (x: number, z: number, pathClear: number) => {
      for (const zone of keepClear) if (Math.hypot(x - zone.x, z - zone.z) < zone.radius) return true;
      return pathDistance(x, z) < pathClear;
    };

    const scatter = (
      kind: NodeKind,
      count: number,
      opts: { minH: number; maxH: number; maxSlope: number; spacing: number; pathClear: number; area?: (x: number, z: number) => boolean },
      variants: number,
      scaleRange: [number, number],
    ) => {
      let made = 0;
      let attempts = 0;
      while (made < count && attempts < count * 60) {
        attempts++;
        const x = center.x + randRange(random, -extent, extent);
        const z = center.z + randRange(random, -extent, extent);
        if (opts.area && !opts.area(x, z)) continue;
        const h = this.terrain.getHeight(x, z);
        if (h < opts.minH || h > opts.maxH) continue;
        if (this.terrain.getSlope(x, z) > opts.maxSlope) continue;
        if (blocked(x, z, opts.pathClear)) continue;
        if (tooClose(x, z, opts.spacing)) continue;
        placed.push({ x, z, r: opts.spacing * 0.6 });
        this.addNode(kind, Math.floor(random() * variants), x, z, random() * Math.PI * 2, randRange(random, ...scaleRange));
        made++;
      }
    };

    const fixed = (kind: NodeKind, points: Array<[number, number]>, scale = 1, variants = 1) => {
      points.forEach(([x, z], i) => {
        placed.push({ x, z, r: 2.5 });
        this.addNode(kind, i % variants, x, z, random() * Math.PI * 2, scale);
      });
    };

    if (aurora) {
      // Aurora: floresta azulada, muitos cristais perto dos pilares.
      const crystalRing = [AURORA_PLACES.pylonWest, AURORA_PLACES.pylonEast, AURORA_PLACES.pylonSouth].flatMap((p) =>
        [0, 1, 2].map((i): [number, number] => [p.x + Math.cos(i * 2.1) * 10.5, p.z + Math.sin(i * 2.1) * 10.5]),
      );
      fixed('cristal', crystalRing);
      scatter('palmeira', 18, { minH: 0.35, maxH: 2.3, maxSlope: 0.5, spacing: 6, pathClear: 2 }, 3, [0.85, 1.2]);
      scatter('arvore', 70, { minH: 2, maxH: 18, maxSlope: 0.65, spacing: 4.6, pathClear: 3.2 }, 3, [0.8, 1.4]);
      scatter('rocha', 34, { minH: 0.6, maxH: 30, maxSlope: 1.2, spacing: 4, pathClear: 2 }, 3, [0.6, 1.3]);
      scatter('arbusto', 22, { minH: 2, maxH: 14, maxSlope: 0.6, spacing: 4, pathClear: 2 }, 1, [0.85, 1.2]);
      scatter('capim', 40, { minH: 1.3, maxH: 12, maxSlope: 0.7, spacing: 3, pathClear: 1.5 }, 1, [0.85, 1.25]);
      scatter('cristal', 8, { minH: 6, maxH: 30, maxSlope: 0.8, spacing: 8, pathClear: 2 }, 1, [0.8, 1.1]);
      this.buildMeshes();
      return;
    }

    // Recursos garantidos perto do início (para as primeiras missões).
    fixed('palmeira', [[-8, 119], [-14, 113], [-3, 112], [12, 117], [-27, 127], [21, 123], [-12, 131]], 1, 3);
    fixed('rocha', [[12, 103], [17, 97], [6, 99], [22, 106]], 0.85, 3);
    fixed('capim', [[9, 101], [2, 104], [15, 108], [19, 93], [-4, 100], [25, 100]]);
    fixed('arbusto', [[-12, 96], [-20, 92], [27, 90]]);
    fixed('arvore', [[-10, 92], [4, 86], [-26, 100], [30, 96]], 1, 3);

    // Cristais: dentro da caverna e alguns perto das ruínas e da montanha.
    const cave = PLACES.cave;
    fixed(
      'cristal',
      [
        // Ao redor da parede interna da caverna (ângulos medidos a partir do sul).
        ...[75, 110, 145, -75, -110, -145].map((deg): [number, number] => {
          const a = (deg * Math.PI) / 180;
          return [cave.x + Math.sin(a) * 3.8, cave.z + Math.cos(a) * 3.8];
        }),
        [PLACES.ruins.x - 20, PLACES.ruins.z - 14],
        [PLACES.ruins.x + 18, PLACES.ruins.z + 16],
        [-40, -74],
      ],
      1,
    );

    scatter('palmeira', 26, { minH: 0.35, maxH: 2.3, maxSlope: 0.5, spacing: 6, pathClear: 2 }, 3, [0.85, 1.2]);
    scatter('arvore', 125, { minH: 2, maxH: 17, maxSlope: 0.65, spacing: 4.6, pathClear: 3.2 }, 3, [0.8, 1.35]);
    scatter('pinheiro', 50, { minH: 10, maxH: 32, maxSlope: 1.0, spacing: 5, pathClear: 3 }, 2, [0.9, 1.4]);
    scatter('rocha', 60, { minH: 0.6, maxH: 34, maxSlope: 1.2, spacing: 4, pathClear: 2 }, 3, [0.6, 1.3]);
    scatter('arbusto', 34, { minH: 2, maxH: 12, maxSlope: 0.6, spacing: 4, pathClear: 2 }, 1, [0.85, 1.2]);
    scatter('capim', 70, { minH: 1.3, maxH: 11, maxSlope: 0.7, spacing: 3, pathClear: 1.5 }, 1, [0.85, 1.25]);

    this.buildMeshes();
  }

  private addNode(kind: NodeKind, variant: number, x: number, z: number, rot: number, scale: number): void {
    const def = NODE_KINDS[kind];
    const y = this.terrain.getHeight(x, z) - 0.05;
    const node: ResourceNode = {
      id: `${this.idPrefix}${kind}_${this.nodes.length}`,
      kind,
      def,
      variant,
      index: -1,
      x,
      y,
      z,
      rot,
      scale,
      remaining: def.hits,
      respawnAt: 0,
      collider: null,
      anim: null,
      interactable: null as unknown as Interactable,
      stumpIndex: -1,
    };
    node.interactable = this.createInteractable(node);
    this.nodes.push(node);
    this.byId.set(node.id, node);
    const key = this.cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
    let list = this.grid.get(key);
    if (!list) {
      list = [];
      this.grid.set(key, list);
    }
    list.push(node);
    this.addCollider(node);
  }

  private addCollider(node: ResourceNode): void {
    const s = node.scale;
    switch (node.kind) {
      case 'arvore':
      case 'pinheiro':
        node.collider = this.collision.add({ kind: 'circle', x: node.x, z: node.z, r: 0.38 * s, top: node.y + 6 * s });
        break;
      case 'palmeira':
        node.collider = this.collision.add({ kind: 'circle', x: node.x, z: node.z, r: 0.3 * s, top: node.y + 6 });
        break;
      case 'rocha':
        // Pedras são baixas: dá para subir em cima pulando.
        node.collider = this.collision.add({ kind: 'circle', x: node.x, z: node.z, r: 0.95 * s, top: node.y + 0.95 * s });
        break;
      default:
        node.collider = null;
    }
  }

  private removeCollider(node: ResourceNode): void {
    if (node.collider) this.collision.remove(node.collider);
    node.collider = null;
  }

  private buildMeshes(): void {
    const leafMat = createFlatMaterial();
    addWind(leafMat, this.windTime, 0.035, 2.2);
    const palmMat = createFlatMaterial();
    addWind(palmMat, this.windTime, 0.04, 3.5);
    const pineMat = createFlatMaterial();
    addWind(pineMat, this.windTime, 0.02, 2.5);
    const rockMat = createFlatMaterial();
    const bushMat = createFlatMaterial();
    const grassMat = createFlatMaterial({ side: THREE.DoubleSide });
    addWind(grassMat, this.windTime, 0.12, 0.2);
    const crystalMat = createFlatMaterial({ emissive: new THREE.Color('#3f7dff'), emissiveIntensity: 0.6 });

    const geometryFor = (kind: NodeKind, variant: number): [THREE.BufferGeometry, THREE.Material] => {
      switch (kind) {
        case 'arvore':
          return [makeBroadleafTree(variant), leafMat];
        case 'pinheiro':
          return [makePineTree(variant), pineMat];
        case 'palmeira':
          return [makePalmTree(variant), palmMat];
        case 'rocha':
          return [makeRock(variant), rockMat];
        case 'arbusto':
          return [makeBush(), bushMat];
        case 'capim':
          return [makeGrassClump(), grassMat];
        case 'cristal':
          return [makeCrystalCluster(), crystalMat];
      }
    };

    // Agrupa os recursos por tipo e variante.
    const groups = new Map<string, ResourceNode[]>();
    for (const node of this.nodes) {
      const key = `${node.kind}:${node.variant}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    }

    const color = new THREE.Color();
    const random = createRandom(4242);
    for (const [key, list] of groups) {
      const [kind, variantStr] = key.split(':') as [NodeKind, string];
      const [geometry, material] = geometryFor(kind, Number(variantStr));
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      mesh.name = key;
      mesh.castShadow = kind !== 'capim' && kind !== 'cristal';
      mesh.receiveShadow = kind === 'rocha';
      list.forEach((node, i) => {
        node.index = i;
        // Pequena variação de cor por instância.
        color.setHSL(0.1 + random() * 0.15, 0.25, 0.86 + random() * 0.14);
        if (kind === 'cristal') color.set('#ffffff');
        mesh.setColorAt(i, color);
      });
      this.meshes.set(key, mesh);
      this.group.add(mesh);
    }

    // Tocos das árvores (aparecem quando a árvore cai).
    const trees = this.nodes.filter((n) => n.kind === 'arvore' || n.kind === 'pinheiro' || n.kind === 'palmeira');
    this.stumps = new THREE.InstancedMesh(makeStump(), createFlatMaterial(), trees.length);
    this.stumps.name = 'tocos';
    trees.forEach((n, i) => (n.stumpIndex = i));
    this.group.add(this.stumps);

    // Frutinhas dos arbustos.
    const bushes = this.nodes.filter((n) => n.kind === 'arbusto');
    this.berries = new THREE.InstancedMesh(makeBerries(), createFlatMaterial(), bushes.length);
    this.berries.name = 'frutinhas';
    this.group.add(this.berries);

    this.refreshAll();
    for (const mesh of [...this.meshes.values(), this.stumps, this.berries]) {
      mesh.computeBoundingSphere();
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }

  // ---------------------------------------------------------------------------
  // Interação
  // ---------------------------------------------------------------------------

  private createInteractable(node: ResourceNode): Interactable {
    return {
      id: node.id,
      position: new THREE.Vector3(node.x, node.y + 1, node.z),
      radius: node.def.interactRadius * Math.max(0.8, node.scale),
      getAction: (ctx: InteractionContext) => {
        if (node.remaining <= 0) return null;
        const def = node.def;
        if (def.requiresTool && !ctx.hasItem(def.requiresTool)) {
          return { label: def.label, enabled: false, reason: `Requer ${ITEMS[def.requiresTool].name}` };
        }
        return { label: def.label, enabled: true, repeat: true };
      },
      interact: (ctx: InteractionContext) => this.hit(node, ctx),
    };
  }

  queryInteractables(x: number, z: number, range: number, out: Interactable[]): void {
    const minX = Math.floor((x - range) / CELL);
    const maxX = Math.floor((x + range) / CELL);
    const minZ = Math.floor((z - range) / CELL);
    const maxZ = Math.floor((z + range) / CELL);
    for (let gz = minZ; gz <= maxZ; gz++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const list = this.grid.get(this.cellKey(gx, gz));
        if (!list) continue;
        for (const node of list) if (node.remaining > 0) out.push(node.interactable);
      }
    }
  }

  /** Recursos vivos dentro de uma área (para validar construções). */
  anyInBox(x: number, z: number, hw: number, hd: number, rot: number): boolean {
    const r = Math.hypot(hw, hd) + 2;
    const out: Interactable[] = [];
    this.queryInteractables(x, z, r, out);
    for (const item of out) {
      const node = this.byId.get(item.id);
      if (node && circleOverlapsBox(node.x, node.z, 0.5 * node.scale, x, z, hw, hd, rot)) return true;
    }
    return false;
  }

  private hit(node: ResourceNode, ctx: InteractionContext): void {
    if (node.remaining <= 0) return;
    const def = node.def;
    const hasBonusTool = def.toolBonus ? ctx.hasItem(def.toolBonus.tool) : false;
    const amount = hasBonusTool && def.toolBonus ? def.toolBonus.amount : def.amount;
    const bonus = def.bonus && Math.random() < def.bonus.chance ? def.bonus.item : null;
    node.remaining--;

    // Direção do golpe (do jogador para o recurso) para a árvore cair "para longe".
    const p = ctx.player.position;
    let dirX = node.x - p.x;
    let dirZ = node.z - p.z;
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;

    const depleted = node.remaining <= 0;
    if (depleted) {
      node.respawnAt = -1; // definido em markDepleted com o tempo de jogo
      const isTree = node.stumpIndex >= 0;
      if (node.kind === 'arbusto') {
        this.berries.setMatrixAt(node.index, this.zeroMatrix);
        this.berries.instanceMatrix.needsUpdate = true;
        node.anim = { type: 'shake', t: 0, dirX, dirZ };
      } else {
        node.anim = { type: isTree ? 'fall' : 'shrink', t: 0, dirX, dirZ };
      }
      this.removeCollider(node);
    } else {
      node.anim = { type: 'shake', t: 0, dirX, dirZ };
    }
    this.animating.add(node);

    let toolUsed: HitResult['toolUsed'] = 'none';
    if (def.requiresTool === 'picareta' || (def.toolBonus?.tool === 'picareta' && hasBonusTool)) toolUsed = 'picareta';
    else if (def.toolBonus?.tool === 'machado' && hasBonusTool && node.kind !== 'capim') toolUsed = 'machado';

    this.onHit?.({ node, item: def.item, amount, bonus, toolUsed, depleted });
  }

  /** Marca o momento de renascer (chamado pelo jogo com o tempo atual). */
  setRespawnTimes(playTime: number): void {
    for (const node of this.nodes) {
      if (node.respawnAt === -1) node.respawnAt = playTime + node.def.respawn;
    }
  }

  // ---------------------------------------------------------------------------
  // Atualização por quadro
  // ---------------------------------------------------------------------------

  update(dt: number, playTime: number, playerPos: THREE.Vector3): void {
    this.setRespawnTimes(playTime);

    // Animações ativas.
    for (const node of this.animating) {
      const anim = node.anim!;
      anim.t += dt;
      let done = false;
      switch (anim.type) {
        case 'shake':
          done = anim.t > 0.35;
          break;
        case 'fall':
          done = anim.t > 1.6;
          break;
        case 'shrink':
          done = anim.t > 0.35;
          break;
        case 'grow':
          done = anim.t > 1;
          break;
      }
      if (done) {
        node.anim = null;
        this.animating.delete(node);
      }
      this.writeMatrix(node);
    }
    if (this.animating.size > 0) this.markDirty();

    // Renascimento (verificado uma vez por segundo).
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = 1;
      for (const node of this.nodes) {
        if (node.remaining > 0 || node.respawnAt <= 0 || node.respawnAt > playTime) continue;
        // Não renasce em cima do jogador.
        if (Math.hypot(playerPos.x - node.x, playerPos.z - node.z) < 2.5) continue;
        this.restore(node, true);
      }
    }
  }

  private restore(node: ResourceNode, animate: boolean): void {
    node.remaining = node.def.hits;
    node.respawnAt = 0;
    if (!node.collider) this.addCollider(node);
    if (animate) {
      node.anim = { type: 'grow', t: 0, dirX: 0, dirZ: 1 };
      this.animating.add(node);
    }
    this.writeMatrix(node);
    this.markDirty();
  }

  private markDirty(): void {
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
    this.stumps.instanceMatrix.needsUpdate = true;
    this.berries.instanceMatrix.needsUpdate = true;
  }

  private refreshAll(): void {
    for (const node of this.nodes) this.writeMatrix(node);
    this.markDirty();
  }

  /** Calcula a matriz (posição/rotação/escala) de um recurso conforme o estado. */
  private writeMatrix(node: ResourceNode): void {
    const mesh = this.meshes.get(`${node.kind}:${node.variant}`);
    if (!mesh) return;
    const anim = node.anim;
    let scale = node.scale;
    let tilt = 0;
    let visible = node.remaining > 0 || (anim !== null && anim.type !== 'grow');
    if (node.kind === 'arbusto') visible = true; // o arbusto fica, só as frutas somem

    if (anim) {
      const t = anim.t;
      switch (anim.type) {
        case 'shake':
          tilt = Math.sin(t * 40) * 0.07 * (1 - t / 0.35);
          break;
        case 'fall': {
          const k = Math.min(1, t / 1.2);
          tilt = k * k * (Math.PI / 2 - 0.15);
          if (t > 1.2) scale = node.scale * Math.max(0, 1 - (t - 1.2) / 0.4);
          break;
        }
        case 'shrink':
          scale = node.scale * Math.max(0, 1 - t / 0.35);
          break;
        case 'grow': {
          const k = Math.min(1, t / 1);
          scale = node.scale * (1 - (1 - k) * (1 - k));
          visible = true;
          break;
        }
      }
    }

    if (!visible || scale <= 0.001) {
      mesh.setMatrixAt(node.index, this.zeroMatrix);
    } else {
      this.quatYaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, node.rot);
      if (tilt !== 0 && anim) {
        // Eixo horizontal perpendicular à direção do golpe.
        this.axis.set(anim.dirZ, 0, -anim.dirX).normalize();
        this.quat.setFromAxisAngle(this.axis, tilt).multiply(this.quatYaw);
      } else {
        this.quat.copy(this.quatYaw);
      }
      this.posV.set(node.x, node.y, node.z);
      this.scaleV.setScalar(scale);
      this.matrix.compose(this.posV, this.quat, this.scaleV);
      mesh.setMatrixAt(node.index, this.matrix);
    }

    // Toco: visível quando a árvore está esgotada (depois de cair).
    if (node.stumpIndex >= 0) {
      const showStump = node.remaining <= 0 && !(anim && anim.type === 'fall' && anim.t < 1.2);
      if (showStump) {
        this.quatYaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, node.rot);
        this.posV.set(node.x, node.y, node.z);
        this.scaleV.setScalar(node.scale);
        this.matrix.compose(this.posV, this.quatYaw, this.scaleV);
        this.stumps.setMatrixAt(node.stumpIndex, this.matrix);
      } else {
        this.stumps.setMatrixAt(node.stumpIndex, this.zeroMatrix);
      }
    }

    // Frutinhas acompanham o arbusto.
    if (node.kind === 'arbusto') {
      if (node.remaining > 0) {
        this.berries.setMatrixAt(node.index, this.matrix);
      } else {
        this.berries.setMatrixAt(node.index, this.zeroMatrix);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Salvamento
  // ---------------------------------------------------------------------------

  /** Apenas recursos alterados são salvos. */
  toJSON(): Record<string, NodeSave> {
    const out: Record<string, NodeSave> = {};
    for (const node of this.nodes) {
      if (node.remaining < node.def.hits) out[node.id] = { r: node.remaining, t: Math.max(0, node.respawnAt) };
    }
    return out;
  }

  load(data: Record<string, NodeSave> | undefined): void {
    this.animating.clear();
    for (const node of this.nodes) {
      node.anim = null;
      const saved = data?.[node.id];
      if (!saved) {
        this.restore(node, false);
        continue;
      }
      node.remaining = Math.max(0, Math.min(node.def.hits, Math.floor(saved.r)));
      node.respawnAt = node.remaining > 0 ? 0 : saved.t;
      if (node.remaining > 0) {
        if (!node.collider) this.addCollider(node);
      } else {
        this.removeCollider(node);
      }
      this.writeMatrix(node);
    }
    this.markDirty();
  }

  private cellKey(gx: number, gz: number): number {
    return (gx + 1000) * 4000 + (gz + 1000);
  }
}
