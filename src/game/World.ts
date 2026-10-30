/**
 * Monta o mundo 3D: céu, luzes, terreno, oceano, recursos, decorações e
 * marcos. Também controla a distância de renderização e as sombras.
 */
import * as THREE from 'three';
import type { CollisionWorld } from './Collision';
import { DayNight } from './DayNight';
import type { InteractionSystem } from './InteractionSystem';
import type { LightManager } from './LightManager';
import { Decorations } from './world/Decorations';
import { Landmarks, type LandmarkHooks } from './world/Landmarks';
import { ResourceManager } from './world/ResourceNodes';
import { Sky } from './world/Sky';
import { TerrainSet } from './world/Terrain';
import { AURORA_CENTER, ISLAND_SHAPES } from './world/islands';
import { AuroraLandmarks } from './world/AuroraLandmarks';
import { WeatherSystem } from './Weather';
import { Water } from './world/Water';

export type ProgressCallback = (fraction: number, label: string) => Promise<void>;

export class World {
  readonly scene = new THREE.Scene();
  readonly fog = new THREE.Fog('#cdeaf7', 60, 260);
  readonly sun = new THREE.DirectionalLight('#fff4dc', 3);
  readonly hemi = new THREE.HemisphereLight('#d8efff', '#7d8f5c', 1.2);
  readonly windTime = { value: 0 };
  readonly terrain = new TerrainSet(ISLAND_SHAPES);
  readonly sky = new Sky();
  readonly dayNight: DayNight;
  readonly weather = new WeatherSystem();
  water!: Water;
  resources!: ResourceManager;
  decorations!: Decorations;
  landmarks!: Landmarks;
  /** Conteúdo da Ilha da Aurora (criado só quando o jogador se aproxima). */
  auroraResources: ResourceManager | null = null;
  auroraDecorations: Decorations | null = null;
  auroraLandmarks: AuroraLandmarks | null = null;
  /** Avisado quando a Aurora começa a ser montada (o jogo cria a fauna dela). */
  onAuroraCreated: (() => void) | null = null;

  /** Feixe de luz que marca o objetivo da missão. */
  readonly questBeacon: THREE.Mesh;
  /** Anel + seta sobre o objeto interativo selecionado. */
  readonly targetMarker = new THREE.Group();

  private renderDistance = 260;
  private menuView = false;
  private shadowExtent = 40;

  constructor(
    private readonly collision: CollisionWorld,
    private readonly interaction: InteractionSystem,
    private readonly lights: LightManager,
    private readonly landmarkHooks: LandmarkHooks,
  ) {
    this.scene.fog = this.fog;
    this.scene.background = null;
    this.scene.add(this.sky.group);
    this.scene.add(this.hemi);

    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(lights.group);

    this.dayNight = new DayNight(this.sky, this.sun, this.hemi, this.fog);
    this.scene.add(this.weather.rainMesh);

    this.questBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 90, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffd166',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.questBeacon.visible = false;
    this.questBeacon.renderOrder = 5;
    this.scene.add(this.questBeacon);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.05, 6, 28),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2;
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.36, 4),
      new THREE.MeshBasicMaterial({ color: '#ffd166', depthWrite: false }),
    );
    arrow.rotation.x = Math.PI;
    arrow.name = 'seta';
    this.targetMarker.add(ring, arrow);
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);
  }

  /** Gera tudo, informando o progresso para a tela de carregamento. */
  async generate(progress: ProgressCallback): Promise<void> {
    await progress(0.05, 'Moldando a ilha…');
    const main = this.terrain.get('principal');
    main.generateHeights();
    await progress(0.2, 'Esculpindo montanhas e praias…');
    main.buildMeshes();
    this.scene.add(this.terrain.group);

    await progress(0.35, 'Enchendo o oceano…');
    this.water = new Water((x, z) => this.terrain.getHeight(x, z));
    this.scene.add(this.water.mesh);

    await progress(0.5, 'Plantando florestas…');
    this.resources = new ResourceManager(this.terrain, this.collision, this.windTime);
    this.resources.generate();
    this.scene.add(this.resources.group);
    this.interaction.addProvider(this.resources);

    await progress(0.7, 'Espalhando flores e conchas…');
    this.decorations = new Decorations(this.terrain, this.windTime);
    this.decorations.generate();
    this.scene.add(this.decorations.group);

    await progress(0.85, 'Despertando ruínas antigas…');
    this.landmarks = new Landmarks(this.terrain, this.collision, this.interaction, this.lights, this.landmarkHooks);
    this.landmarks.build();
    this.scene.add(this.landmarks.group);
    await progress(0.95, 'Quase lá…');
  }

  /** Todos os gerenciadores de recursos (uma ilha cada). */
  get resourceManagers(): ResourceManager[] {
    return this.auroraResources ? [this.resources, this.auroraResources] : [this.resources];
  }

  get auroraCreated(): boolean {
    return this.auroraLandmarks !== null;
  }

  /**
   * Cria a Ilha da Aurora: alturas, recursos, decorações e marcos agora; a
   * malha do terreno vai aparecendo aos poucos (um pedaço por quadro).
   */
  createAurora(density: number): void {
    if (this.auroraLandmarks) return;
    this.terrain.get('aurora').generateHeights();
    this.auroraResources = new ResourceManager(this.terrain, this.collision, this.windTime);
    this.auroraResources.generate('aurora');
    this.auroraResources.onHit = this.resources.onHit;
    this.scene.add(this.auroraResources.group);
    this.interaction.addProvider(this.auroraResources);
    this.auroraDecorations = new Decorations(this.terrain, this.windTime);
    this.auroraDecorations.generate({ x: AURORA_CENTER.x, z: AURORA_CENTER.z, extent: 130, seed: 5 });
    this.auroraDecorations.setDensity(density);
    this.scene.add(this.auroraDecorations.group);
    this.auroraLandmarks = new AuroraLandmarks(this.terrain, this.collision, this.interaction, this.lights, this.landmarkHooks);
    this.auroraLandmarks.build();
    this.auroraLandmarks.applyFlags();
    this.scene.add(this.auroraLandmarks.group);
    this.onAuroraCreated?.();
  }

  setRenderDistance(distance: number): void {
    this.renderDistance = distance;
    this.applyFog();
  }

  /** No menu, a câmera fica alta e longe: a névoa é afastada para mostrar a ilha. */
  setMenuView(menu: boolean): void {
    if (menu === this.menuView) return;
    this.menuView = menu;
    this.applyFog();
  }

  private applyFog(): void {
    const distance = this.menuView ? Math.max(this.renderDistance, 340) : this.renderDistance;
    // Chuva, tempestade e noites de névoa fecham a visão.
    const factor = this.menuView ? 1 : this.weather.fogMultiplier;
    this.fog.near = distance * 0.3 * factor;
    this.fog.far = distance * factor;
  }

  setShadows(enabled: boolean, mapSize: number): void {
    this.sun.castShadow = enabled;
    if (enabled && this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.shadowExtent = mapSize >= 2048 ? 48 : 36;
    const cam = this.sun.shadow.camera;
    cam.left = -this.shadowExtent;
    cam.right = this.shadowExtent;
    cam.top = this.shadowExtent;
    cam.bottom = -this.shadowExtent;
    cam.updateProjectionMatrix();
  }

  update(dt: number, elapsed: number, focus: THREE.Vector3, camera: THREE.Camera, simulate: boolean): void {
    this.windTime.value = elapsed;
    this.water.update(elapsed);
    this.sky.update(dt);
    this.sky.follow(camera.position);
    if (simulate) this.dayNight.update(dt);
    else this.dayNight.apply();
    // Clima por cima das cores do dia/noite.
    this.weather.update(dt, elapsed, camera.position, simulate);
    this.weather.applyVisuals({ sky: this.sky.uniforms, sun: this.sun, hemi: this.hemi, fog: this.fog });
    this.water.setWaves(this.weather.waves);
    this.sky.setCloudCover(this.weather.cover);
    this.applyFog();
    this.landmarks.update(dt, elapsed);

    // Sol/lua acompanham o jogador para que as sombras fiquem sempre por perto.
    const dir = this.dayNight.lightDir;
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(dir, 100);
    this.sun.target.updateMatrixWorld();

    // Esconde pedaços do terreno muito distantes (economiza GPU).
    // Ilha da Aurora: monta um pedaço do terreno por quadro até terminar.
    const aurora = this.terrain.get('aurora');
    if (this.auroraLandmarks && !aurora.chunksDone) aurora.buildNextChunk();
    this.auroraLandmarks?.update(dt, elapsed, this.dayNight.night);

    for (const mesh of this.terrain.chunks) {
      const sphere = mesh.geometry.boundingSphere!;
      const d = Math.hypot(sphere.center.x - camera.position.x, sphere.center.z - camera.position.z);
      mesh.visible = this.menuView || d - sphere.radius < this.renderDistance + 20;
    }
  }

  /** Posiciona o feixe de luz do objetivo atual (ou esconde). */
  updateBeacon(target: { x: number; z: number } | null, player: THREE.Vector3, elapsed: number): void {
    if (!target) {
      this.questBeacon.visible = false;
      return;
    }
    const d = Math.hypot(target.x - player.x, target.z - player.z);
    this.questBeacon.visible = d > 6;
    const y = this.terrain.getHeight(target.x, target.z);
    this.questBeacon.position.set(target.x, y + 45, target.z);
    const mat = this.questBeacon.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.min(0.28, (d - 6) / 60) * (0.8 + Math.sin(elapsed * 2) * 0.2);
  }

  updateTargetMarker(position: THREE.Vector3 | null, enabled: boolean, elapsed: number): void {
    if (!position) {
      this.targetMarker.visible = false;
      return;
    }
    this.targetMarker.visible = true;
    const ground = this.terrain.getHeight(position.x, position.z);
    this.targetMarker.position.set(position.x, Math.max(ground, position.y - 1) + 0.08, position.z);
    const arrow = this.targetMarker.getObjectByName('seta')!;
    arrow.position.y = position.y - this.targetMarker.position.y + 1.6 + Math.sin(elapsed * 4) * 0.12;
    arrow.rotation.y = elapsed * 2;
    const ring = this.targetMarker.children[0] as THREE.Mesh;
    (ring.material as THREE.MeshBasicMaterial).color.set(enabled ? '#ffffff' : '#ff7b7b');
    ring.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.06);
  }
}
