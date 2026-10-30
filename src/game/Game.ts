/**
 * Game: o "maestro" do jogo.
 *
 * Cria o renderizador, o mundo e todos os sistemas, conecta os eventos entre
 * eles e roda o laço principal (atualizar → desenhar) a cada quadro.
 */
import * as THREE from 'three';
import { AudioManager } from '../core/AudioManager';
import { Input } from '../core/Input';
import { clamp, smoothstep } from '../core/math';
import { DAY_LENGTH_SECONDS, QUALITY_PRESETS, Settings } from '../core/Settings';
import { BuildingSystem, type PlacedStructure } from './Building';
import { FishingSystem } from './Fishing';
import { FireflyThieves } from './Fireflies';
import { PetSystem } from './Pet';
import { runDialogue } from './Dialogue';
import { GUARDIAN, IARA, PARROT, type DialogueContext, type EcoDialogueContext } from './data/dialogues';
import { DIARY_PAGES, diaryCount, type DiaryPage } from './data/diary';
import { StoryProps } from './world/StoryProps';
import { BoatController } from './Boat';
import { AURORA_CENTER, ECO_CENTER, ECO_PLACES, ecoPathDistance } from './world/islands';
import { BELLS, LUMENI_SONG, type BellDef } from './world/EcoLandmarks';
import { WORLD_LIMIT_RADIUS, distanceToPaths } from './world/layout';
import { AURORA_PLACES, auroraPathDistance } from './world/islands';
import type { NodeSave } from './save/SaveData';
import { CameraController } from './CameraController';
import { CollisionWorld } from './Collision';
import { CraftingSystem } from './Crafting';
import { ITEMS, type ItemBundle, type ItemId } from './data/items';
import { CROPS, isCropId, type CropId } from './data/crops';
import { LORE } from './data/lore';
import { getRecipe, RECIPES } from './data/recipes';
import { getRegion, regionAt } from './data/regions';
import { STRUCTURES, type StructureId } from './data/structures';
import { createEventBus, type GameEventBus } from './events';
import { InteractionSystem, type InteractionContext } from './InteractionSystem';
import { Inventory } from './Inventory';
import { LightManager, type LightSource } from './LightManager';
import { Particles } from './Particles';
import { Player } from './Player';
import { Progression } from './Progression';
import { QuestSystem } from './Quests';
import { MAX_PINS, SAVE_VERSION, type SaveData } from './save/SaveData';
import { LocalStorageProvider } from './save/StorageProvider';
import { SaveSystem } from './SaveSystem';
import { World } from './World';
import { WorldState } from './WorldState';
import { type WeatherKind, WEATHER_NAMES } from './Weather';
import { PLACES } from './world/layout';
import { Wildlife } from './world/Wildlife';
import { ModelLibrary } from './models/ModelLibrary';
import type { MapMarker, MapView } from '../ui/MapRenderer';
import { MapRenderer, PIN_COLORS } from '../ui/MapRenderer';
import { UIManager } from '../ui/UIManager';
import { nextFrame } from '../ui/dom';
import { icon } from '../ui/icons';

export type GameState = 'loading' | 'menu' | 'playing';

const AUTOSAVE_SECONDS = 60;
/** Chance de uma noite ter névoa densa. */
const MIST_CHANCE = 0.35;

const PIN_POLE = new THREE.CylinderGeometry(0.06, 0.06, 4, 5);
const PIN_POLE_MAT = new THREE.MeshLambertMaterial({ color: '#6b4a2f' });
const PIN_CLOTH = new THREE.BoxGeometry(0.9, 0.55, 0.04);
const pinMaterials: THREE.MeshBasicMaterial[] = [];
/** Material da bandeirinha (sem sombra: aparece bem até de noite). */
function pinMaterial(c: number): THREE.MeshBasicMaterial {
  pinMaterials[c] ??= new THREE.MeshBasicMaterial({ color: PIN_COLORS[c] ?? PIN_COLORS[0] });
  return pinMaterials[c];
}
/** Altura do modelo robo.glb nas unidades do próprio arquivo. */
const ROBOT_HEIGHT = 4.79;
const MENU_FOCUS = new THREE.Vector3(10, 4, 30);

export class Game {
  // --- Núcleo ---
  readonly settings = new Settings();
  readonly audio = new AudioManager();
  readonly bus: GameEventBus = createEventBus();
  readonly canvas: HTMLCanvasElement;
  readonly input: Input;
  renderer!: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
  readonly cameraCtl = new CameraController(this.camera);

  // --- Sistemas ---
  readonly collision = new CollisionWorld();
  readonly interaction = new InteractionSystem();
  readonly lights: LightManager;
  readonly inventory: Inventory;
  readonly progression: Progression;
  readonly worldState: WorldState;
  readonly crafting: CraftingSystem;
  readonly quests: QuestSystem;
  readonly saveSystem = new SaveSystem(new LocalStorageProvider());
  readonly particles = new Particles();
  readonly models = new ModelLibrary();
  wildlife!: Wildlife;
  fishing!: FishingSystem;
  fireflies!: FireflyThieves;
  pet!: PetSystem;
  story!: StoryProps;
  boatCtl!: BoatController;
  auroraWildlife: Wildlife | null = null;
  readonly player = new Player();
  world!: World;
  building!: BuildingSystem;
  mapRenderer!: MapRenderer;
  auroraMap: MapRenderer | null = null;
  ecoMap: MapRenderer | null = null;
  ecoWildlife: Wildlife | null = null;
  ui!: UIManager;

  // --- Estado ---
  state: GameState = 'loading';
  playTime = 0;
  fps = 60;
  hasSave = false;
  currentRegionName = '';
  stats = { gathered: 0, crafted: 0, built: 0 };

  private elapsed = 0;
  private lastTime = performance.now();
  private contextLost = false;
  private regionTimer = 0;
  private ambienceTimer = 0;
  private autosaveTimer = AUTOSAVE_SECONDS;
  private fpsFrames = 0;
  private fpsTime = 0;
  private lowFpsTime = 0;
  private perfWarned = false;
  private qualityCooldown = 0;
  private gpuName: string | null = null;
  private boundaryCooldown = 0;
  private blockedCooldown = 0;
  private torchLight!: LightSource;
  private hiddenByZone = new Set<THREE.Object3D>();
  private inCave = false;
  private unlockIntent = false;
  private lastUnexpectedUnlock = 0;
  private lastBuildMode = 'none';
  private frameErrors = 0;
  private readonly shadowBlob: THREE.Mesh;
  private readonly tmpVec = new THREE.Vector3();
  private readonly interactionCtx: InteractionContext;
  private dustTimer = 0;
  private cameraDistanceBeforeBoat = 7.5;
  /** Estado salvo dos recursos (inclui os da Aurora antes de ela ser criada). */
  private pendingNodes: Record<string, NodeSave> | undefined;
  /** Mantém quem nada perto de alguma ilha (o mar aberto só se cruza de barco). */
  private readonly clampToWorld = (pos: THREE.Vector3): boolean => {
    const islands = [
      { x: 0, z: 0, r: WORLD_LIMIT_RADIUS },
      { x: AURORA_CENTER.x, z: AURORA_CENTER.z, r: 132 },
      { x: ECO_CENTER.x, z: ECO_CENTER.z, r: 122 },
    ];
    let nearest = islands[0];
    let bestGap = Infinity;
    for (const isl of islands) {
      const gap = Math.hypot(pos.x - isl.x, pos.z - isl.z) - isl.r;
      if (gap <= 0) return false;
      if (gap < bestGap) {
        bestGap = gap;
        nearest = isl;
      }
    }
    const d = Math.hypot(pos.x - nearest.x, pos.z - nearest.z);
    pos.x = nearest.x + ((pos.x - nearest.x) / d) * nearest.r;
    pos.z = nearest.z + ((pos.z - nearest.z) / d) * nearest.r;
    return true;
  };
  /** 0 = sem aviso; 1 = avisou "com fome"; 2 = avisou "faminto". */
  private hungerWarned = 0;
  /** Trovões esperando para tocar (segundos até o som). */
  private thunders: number[] = [];
  /** Era noite no quadro anterior (para perceber anoitecer e amanhecer). */
  private wasNight = false;
  /** Marcadores que o jogador colocou no mapa (c = índice da cor). */
  pins: Array<{ x: number; z: number; c: number }> = [];
  /** Bandeirinhas no mundo 3D, uma por marcador. */
  private readonly pinFlags = new THREE.Group();
  private characterLoaded = '';
  /** A câmera não atravessa paredes de construções, rochas da caverna e pilares. */
  private readonly cameraBlocked = (x: number, y: number, z: number) => this.collision.blocksCamera(x, y, z);

  constructor(private readonly container: HTMLElement, private readonly uiRoot: HTMLElement) {
    this.settings.load();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    this.canvas.setAttribute('aria-label', 'Mundo 3D do jogo');
    this.container.prepend(this.canvas);
    this.input = new Input(this.canvas);

    this.lights = new LightManager(this.settings.preset.maxPointLights);
    this.inventory = new Inventory(this.bus);
    this.progression = new Progression(this.bus);
    this.worldState = new WorldState(this.bus);
    this.crafting = new CraftingSystem(this.bus, () => ({
      inventory: this.inventory,
      level: this.progression.level,
      isNearStation: (s) => this.building.isNearStation(s, this.player.position),
    }));
    this.quests = new QuestSystem(this.bus, {
      level: () => this.progression.level,
      isRegionDiscovered: (id) => this.worldState.discovered.has(id),
      structureCount: (t) => this.building?.count(t) ?? 0,
      hasFlag: (f) => this.worldState.hasFlag(f),
    });
    this.interactionCtx = {
      hasItem: (id: ItemId, amount = 1) => this.inventory.has(id, amount),
      player: this.player,
    };

    this.shadowBlob = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 18),
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.shadowBlob.rotation.x = -Math.PI / 2;
  }

  get controlMode(): 'desktop' | 'touch' {
    return this.settings.effectiveControlMode;
  }

  get isPlaying(): boolean {
    return this.state === 'playing' && !this.ui.isBlocking();
  }

  // ===========================================================================
  // Inicialização
  // ===========================================================================

  async init(): Promise<void> {
    this.ui = new UIManager(this.uiRoot, this, this.input);
    this.ui.setLoading(0.02, 'Iniciando gráficos…');
    await nextFrame();

    this.createRenderer();
    this.world = new World(this.collision, this.interaction, this.lights, this.createLandmarkHooks());
    await this.world.generate(async (fraction, label) => {
      this.ui.setLoading(fraction, label);
      await nextFrame();
    });

    this.building = new BuildingSystem(
      this.world.terrain,
      this.collision,
      this.world.resources,
      this.lights,
      this.bus,
      this.createBuildingHooks(),
    );
    this.world.scene.add(this.building.group);
    this.interaction.addProvider(this.building);
    this.world.scene.add(this.player.object);
    this.world.scene.add(this.particles.mesh);
    this.world.scene.add(this.shadowBlob);
    this.mapRenderer = new MapRenderer(this.world.terrain, this.worldState.grids.principal, distanceToPaths);
    this.wildlife = new Wildlife(this.world.terrain, this.collision, this.models);
    this.wildlife.build();
    this.wildlife.onSplash = (x, z) => this.particles.burst(this.tmpVec.set(x, 0.05, z), '#d8f6ff', 6, { up: 2.5, speed: 1.2, size: 0.1, life: 0.5 });
    this.world.scene.add(this.wildlife.group);
    this.fishing = new FishingSystem(this.player, this.wildlife, this.world.terrain, this.bus, {
      hasRod: () => this.inventory.has('vara_de_pesca'),
      wearRod: () => this.inventory.wearTool('vara_de_pesca'),
      give: (item, amount) => {
        this.inventory.add(item, amount);
        this.ui.notify.itemPopup(item, amount);
      },
      notify: (text) => this.ui.notify.toast(text, 'info', 'vara_de_pesca'),
      sound: (name) => this.audio.play(name),
      splash: (pos) => this.particles.burst(this.tmpVec.copy(pos).setY(0.05), '#d8f6ff', 8, { up: 2.5, speed: 1.4, size: 0.1, life: 0.5 }),
      addXP: (n) => this.progression.addXP(n),
      rareChance: () => (this.world.dayNight.isNight ? 0.25 : 0) + (this.world.weather.raining ? 0.08 : 0),
    });
    this.interaction.addProvider(this.fishing);
    this.boatCtl = new BoatController(this.player, this.world.terrain, {
      splash: (pos) => this.particles.burst(pos, '#e8fbff', 3, { up: 1.5, speed: 1.2, size: 0.12, life: 0.6 }),
      sound: (name) => this.audio.play(name),
      notify: (text) => this.ui.notify.toast(text, 'info', 'barco'),
    });
    this.world.onAuroraCreated = () => {
      this.auroraWildlife = new Wildlife(this.world.terrain, this.collision, this.models, {
        x: AURORA_CENTER.x,
        z: AURORA_CENTER.z,
        scale: 0.7,
        seed: 3,
      });
      this.auroraWildlife.onSplash = this.wildlife.onSplash;
      this.auroraWildlife.build();
      this.auroraWildlife.setDensity(this.settings.preset.decorationDensity);
      this.world.scene.add(this.auroraWildlife.group);
      this.world.auroraResources!.load(this.pendingNodes);
      this.auroraMap = new MapRenderer(this.world.terrain, this.worldState.grids.aurora, auroraPathDistance);
    };
    this.world.scene.add(this.fishing.group);
    this.world.onEcoCreated = () => {
      this.ecoWildlife = new Wildlife(this.world.terrain, this.collision, this.models, { x: ECO_CENTER.x, z: ECO_CENTER.z, scale: 0.65, seed: 7 });
      this.ecoWildlife.onSplash = this.wildlife.onSplash;
      this.ecoWildlife.build();
      this.ecoWildlife.setDensity(this.settings.preset.decorationDensity);
      this.world.scene.add(this.ecoWildlife.group);
      this.world.ecoResources!.load(this.pendingNodes);
      this.ecoMap = new MapRenderer(this.world.terrain, this.worldState.grids.eco, ecoPathDistance);
    };
    this.fireflies = new FireflyThieves(this.player, this.world.terrain, this.lights, this.bus, {
      count: (item) => this.inventory.count(item),
      take: (item, amount) => this.inventory.remove(item, amount),
      safe: () => this.sheltered() || this.boatCtl.active || this.player.swimming,
      notify: (text, kind) => this.ui.notify.toast(text, kind, kind === 'success' ? 'tocha' : 'fruta'),
      addXP: (n) => this.progression.addXP(n),
    });
    this.world.scene.add(this.fireflies.group);
    this.bus.on('fireflies:repelled', () => this.worldState.setFlag('vagalumes_espantados'));
    this.pet = new PetSystem(this.player, this.world.terrain, this.wildlife, this.models, this.bus, {
      fruitCount: () => this.inventory.count('fruta'),
      takeFruit: () => this.inventory.remove('fruta', 1),
      give: (bundle) => this.giveItems(bundle),
      notify: (text, kind) => this.ui.notify.toast(text, kind ?? 'info', 'raposa'),
      sound: (name) => this.audio.play(name),
      burst: (pos, color, count) => this.particles.burst(pos, color, count, { up: 3, speed: 1.5 }),
      addXP: (n) => this.progression.addXP(n),
      hasFlag: (f) => this.worldState.hasFlag(f),
      setFlag: (f) => this.worldState.setFlag(f),
      closedChests: () => this.closedChests(),
      boatSeat: () => {
        const b = this.boatCtl.boat;
        if (!b) return null;
        const root = b.model.root;
        return { x: root.position.x + Math.sin(b.rot) * 1.2, y: root.position.y + 0.3, z: root.position.z + Math.cos(b.rot) * 1.2, yaw: b.rot };
      },
    });
    this.world.scene.add(this.pet.group);
    this.story = new StoryProps(this.world.terrain, this.collision, this.interaction, {
      hasFlag: (f) => this.worldState.hasFlag(f),
      readPage: (page) => void this.readDiaryPage(page),
      talkToParrot: () => void this.talkToParrot(),
    });
    this.world.scene.add(this.story.group);
    this.pinFlags.name = 'Marcadores do mapa';
    this.world.scene.add(this.pinFlags);
    this.interaction.addProvider(this.pet);
    this.bus.on('treasure:dug', ({ total }) => {
      if (total >= 3) this.worldState.setFlag('tesouros_3');
    });
    this.wireWeather();

    this.torchLight = this.lights.add({
      position: new THREE.Vector3(),
      color: new THREE.Color('#ffb066'),
      intensity: 14,
      distance: 15,
      flicker: true,
      nightOnly: false,
      enabled: false,
    });

    this.wireEvents();
    this.wirePlayer();
    this.wireBrowser();
    this.applySettings();
    this.resetWorld();

    this.ui.setLoading(1, 'Pronto!');
    // Compila os shaders antes de mostrar o menu (evita travadas no início).
    this.renderer.compile(this.world.scene, this.camera);
    await nextFrame();
    this.ui.hideLoading();
    await this.showMenu();
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  private createRenderer(): void {
    const preset = this.settings.preset;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: preset.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.onResize();
  }

  // ===========================================================================
  // Laço principal
  // ===========================================================================

  private frame = (now: number): void => {
    if (this.contextLost) return;
    const rawDt = Math.max(0, (now - this.lastTime) / 1000);
    const dt = Math.min(0.1, rawDt);
    this.lastTime = now;
    this.elapsed += dt;
    this.measureFps(rawDt);

    try {
      const blocking = this.ui.isBlocking();
      const simulate = this.state === 'playing' && !blocking;
      this.input.enabled = simulate;

      let focus: THREE.Vector3;
      if (this.state === 'playing') {
        this.updatePlaying(dt, simulate);
        focus = this.player.position;
      } else {
        this.cameraCtl.orbit(this.elapsed, MENU_FOCUS, 120, 55);
        focus = MENU_FOCUS;
      }
      this.world.setMenuView(this.state !== 'playing');

      this.world.update(dt, this.elapsed, focus, this.camera, simulate);
      this.particles.update(dt);
      this.story?.update(dt, this.elapsed);
      const running = this.state === 'playing' && this.player.speed > 6.5;
      this.wildlife.update(dt, this.elapsed, focus, running, this.world.dayNight.night);
      this.auroraWildlife?.update(dt, this.elapsed, focus, running, this.world.dayNight.night);
      this.ecoWildlife?.update(dt, this.elapsed, focus, running, this.world.dayNight.night);
      this.lights.update(dt, focus, this.world.dayNight.night);
      this.audio.update(dt);
      if (this.state === 'playing') this.ui.update(dt);
      this.renderer.render(this.world.scene, this.camera);
      this.frameErrors = 0;
    } catch (err) {
      // Um erro isolado não deve congelar o jogo; erros seguidos são avisados.
      this.frameErrors++;
      console.error('[Game] erro no quadro', err);
      if (this.frameErrors === 30) {
        this.ui.notify.toast('Ocorreu um erro inesperado. Se o jogo travar, recarregue a página.', 'warning');
      }
    }
    this.input.endFrame();
  };

  private updatePlaying(dt: number, simulate: boolean): void {
    const input = this.input;
    const terrain = this.world.terrain;
    const getHeight = (x: number, z: number) => terrain.getHeight(x, z);

    if (simulate) {
      this.playTime += dt;
      const look = input.consumeLook();
      this.cameraCtl.rotate(look.dx, look.dy);
      this.cameraCtl.zoom(input.consumeWheel());

      if (input.actionPressed('torch')) this.toggleTorch();
      // Guardado antes: o mesmo aperto de E que confirma a construção
      // não deve também usar a construção recém-criada.
      const placing = this.building.mode === 'place';
      if (placing) {
        if (input.actionPressed('rotate')) this.building.rotateGhost();
        if (input.actionPressed('interact')) this.building.confirmPlacement();
      }

      const sailing = this.boatCtl.active;
      if (sailing) {
        // A bordo: o movimento controla o barco; E desembarca.
        this.boatCtl.update(dt, input.getMove(), input.isSprinting(), this.elapsed, this.world.weather.waves);
        if (input.actionPressed('interact') && this.boatCtl.disembark()) {
          this.player.stand();
          this.cameraCtl.distance = this.cameraDistanceBeforeBoat;
          this.ui.notify.toast('Você desembarcou.', 'info', 'barco');
        }
      } else {
        this.player.update(
          dt,
          {
            move: input.getMove(),
            sprint: input.isSprinting(),
            jump: input.actionPressed('jump'),
            jumpHeld: input.actionHeld('jump'),
          },
          this.cameraCtl.yaw,
          { getHeight, collision: this.collision, clampToWorld: this.clampToWorld },
        );
      }

      if (sailing) {
        this.interaction.current = null;
        this.interaction.currentAction = null;
      } else if (this.fishing.active) {
        if (input.actionPressed('interact')) this.fishing.press();
        this.interaction.current = null;
        this.interaction.currentAction = null;
      } else if (!placing && this.building.mode !== 'place') {
        this.interaction.update(dt, this.interactionCtx, input.actionPressed('interact'), input.actionHeld('interact'));
      } else {
        this.interaction.current = null;
        this.interaction.currentAction = null;
      }
      for (const rm of this.world.resourceManagers) rm.update(dt, this.playTime, this.player.position);
      this.checkAurora();
      this.checkEco();
      this.fishing.update(dt);
      this.fireflies.update(dt, this.world.dayNight.night, !this.boatCtl.active && !this.inCave);
      // A Ilha do Eco vive coberta de névoa (até a Canção dos Lumeni).
      const ecoDistance = Math.hypot(this.player.position.x - ECO_CENTER.x, this.player.position.z - ECO_CENTER.z);
      this.world.weather.zoneMist = this.worldState.hasFlag('eco_cancao') ? 0 : 1 - smoothstep(150, 320, ecoDistance);
      this.wildlife.lure = !this.pet.tamed && this.player.speed < 6.5 && this.inventory.has('fruta');
      this.pet.update(dt);
      this.updateSurvival(dt);
      this.updateNight();

      // Poeira nos pés ao correr.
      this.dustTimer -= dt;
      if (this.player.speed > 6.5 && this.player.grounded && !this.player.swimming && this.dustTimer <= 0) {
        this.dustTimer = 0.18;
        const p = this.player.position;
        const sand = this.world.terrain.getHeight(p.x, p.z) < 1.6;
        this.particles.burst(this.tmpVec.set(p.x, p.y + 0.1, p.z), sand ? '#e8d6a0' : '#b9a27a', 2, {
          up: 1,
          speed: 0.8,
          size: 0.16,
          life: 0.45,
          gravity: 2,
        });
      }
      this.updateTimers(dt);
    } else {
      input.consumeLook();
      input.consumeWheel();
    }

    this.building.update(dt);
    this.syncBuildMode();
    this.updateCameraZones();
    this.cameraCtl.update(dt, this.player.position, getHeight, this.cameraBlocked);

    // Marcadores visuais.
    const target = this.interaction.current;
    this.world.updateTargetMarker(
      simulate && target ? target.position : null,
      this.interaction.currentAction?.enabled ?? true,
      this.elapsed,
    );
    this.world.updateBeacon(this.questTarget(), this.player.position, this.elapsed);

    // Luz da tocha acompanha a mão do personagem.
    this.torchLight.enabled = this.player.torchOn;
    if (this.player.torchOn) this.player.rig.torchTip.getWorldPosition(this.torchLight.position);

    // Sombra simples quando as sombras reais estão desligadas.
    if (this.shadowBlob.visible) {
      const p = this.player.position;
      this.shadowBlob.position.set(p.x, terrain.getHeight(p.x, p.z) + 0.04, p.z);
    }

    // Botão de interação no celular.
    if (this.controlMode === 'touch') {
      const action = this.interaction.currentAction;
      if (this.boatCtl.active) this.ui.touch.setInteraction('Desembarcar', true);
      else if (this.fishing.active) this.ui.touch.setInteraction(this.fishing.state === 'bite' ? 'Puxar!' : 'Pescando…', this.fishing.state === 'bite');
      else this.ui.touch.setInteraction(action?.label ?? null, action?.enabled ?? false);
    }

    const lockHint =
      this.controlMode === 'desktop' && !this.input.pointerLocked && !this.ui.isBlocking() && this.state === 'playing';
    this.ui.hud.setLockHint(lockHint);
  }

  /** Tarefas periódicas: regiões, névoa do mapa, áudio ambiente e salvamento automático. */
  private updateTimers(dt: number): void {
    const p = this.player.position;
    this.boundaryCooldown -= dt;
    this.blockedCooldown -= dt;

    this.regionTimer -= dt;
    if (this.regionTimer <= 0) {
      this.regionTimer = 0.4;
      const region = regionAt(p.x, p.z);
      const ground = this.world.terrain.getHeight(p.x, p.z);
      this.currentRegionName = region?.name ?? (ground < -0.5 ? 'Mar aberto' : 'Ilha');
      if (region && !this.worldState.discovered.has(region.id)) this.worldState.discover(region.id);
      this.worldState.reveal(p.x, p.z, 24);
    }

    this.ambienceTimer -= dt;
    if (this.ambienceTimer <= 0) {
      this.ambienceTimer = 0.5;
      const ground = this.world.terrain.getHeight(p.x, p.z);
      const coast = 1 - smoothstep(1.5, 9, ground);
      const altitude = smoothstep(10, 40, p.y);
      this.audio.setAmbience(1 - this.world.dayNight.night, coast, altitude, this.inCave);
      this.audio.setRain(this.world.weather.rain, this.sheltered());
    }

    this.autosaveTimer -= dt;
    if (this.autosaveTimer <= 0) void this.saveGame(false);
  }

  /**
   * Mede o FPS real. Se o jogo ficar lento por vários segundos, baixa a
   * qualidade sozinho (ou apenas sugere, se o ajuste automático estiver desligado).
   */
  private measureFps(frameSeconds: number): void {
    // Pausas longas (aba em segundo plano) não contam.
    if (frameSeconds > 1) return;
    this.fpsFrames++;
    this.fpsTime += frameSeconds;
    if (this.fpsTime < 0.5) return;
    this.fps = this.fpsFrames / this.fpsTime;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.qualityCooldown = Math.max(0, this.qualityCooldown - 0.5);

    const s = this.settings;
    if (this.state !== 'playing' || this.ui.isBlocking() || s.data.quality === 'baixa' || this.qualityCooldown > 0) {
      this.lowFpsTime = 0;
      return;
    }
    this.lowFpsTime = this.fps < 24 ? this.lowFpsTime + 0.5 : Math.max(0, this.lowFpsTime - 1);
    if (this.lowFpsTime < 6) return;
    this.lowFpsTime = 0;
    if (s.data.autoQuality) {
      const next = s.data.quality === 'alta' ? 'media' : 'baixa';
      s.set('quality', next);
      this.qualityCooldown = 20;
      this.ui.notify.toast(`O jogo estava lento: qualidade ajustada para "${QUALITY_PRESETS[next].label}".`, 'info', 'tela');
    } else if (!this.perfWarned) {
      this.perfWarned = true;
      this.ui.notify.toast('O jogo parece lento neste aparelho. Experimente a qualidade "Baixa" em Opções.', 'warning');
    }
  }

  /** Números de desempenho exibidos em Opções → Desempenho. */
  diagnostics(): { fps: number; gpu: string; width: number; height: number; pixelRatio: number; calls: number; triangles: number } {
    if (this.gpuName === null) {
      this.gpuName = 'desconhecida';
      try {
        const gl = this.renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        this.gpuName = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      } catch {
        /* alguns navegadores escondem essa informação */
      }
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return {
      fps: this.fps,
      gpu: this.gpuName,
      width: size.x,
      height: size.y,
      pixelRatio: this.renderer.getPixelRatio(),
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  /** Câmera mais próxima e teto escondido dentro da caverna e das cabanas. */
  private updateCameraZones(): void {
    const p = this.player.position;
    let limit = Infinity;
    const toHide = new Set<THREE.Object3D>();
    this.inCave = false;
    for (const zone of [...this.world.landmarks.cameraZones, ...this.building.cameraZones]) {
      if (zone.below !== undefined && p.y >= zone.below) continue;
      if (Math.hypot(p.x - zone.x, p.z - zone.z) < zone.radius) {
        limit = Math.min(limit, zone.maxDistance);
        for (const o of zone.hide ?? []) toHide.add(o);
        if (zone.x === PLACES.cave.x && zone.z === PLACES.cave.z) this.inCave = true;
      }
    }
    for (const o of this.hiddenByZone) if (!toHide.has(o)) o.visible = true;
    for (const o of toHide) o.visible = false;
    this.hiddenByZone = toHide;
    this.cameraCtl.distanceLimit = limit;
  }

  private syncBuildMode(): void {
    const mode = this.building.mode;
    if (mode === this.lastBuildMode) return;
    this.lastBuildMode = mode;
    this.interaction.filter = mode === 'remove' ? (item) => item.id.startsWith('remover:') : null;
    this.ui.touch.setBuildMode(mode !== 'none', mode === 'remove');
  }

  // ===========================================================================
  // Eventos
  // ===========================================================================

  private wireEvents(): void {
    const bus = this.bus;
    const ui = this.ui;

    bus.on('inventory:changed', ({ itemId }) => {
      ui.hud.markResourcesDirty();
      ui.refresh('inventario');
      ui.refresh('fabricacao');
      ui.refresh('construcao');
      if (itemId === 'tocha') this.ui.touch.setTorchAvailable(this.inventory.has('tocha'), this.player.torchOn);
    });
    bus.on('resource:gathered', ({ amount }) => (this.stats.gathered += amount));
    bus.on('tool:worn', ({ itemId }) => ui.notify.toast(`${ITEMS[itemId].name} está quase quebrando. Prepare outro!`, 'warning', ITEMS[itemId].icon));
    bus.on('tool:broken', ({ itemId }) => {
      if (itemId === 'tocha') this.player.torchOn = false;
      if (itemId === 'vara_de_pesca') this.fishing.stop();
      this.audio.play('break');
      ui.notify.toast(`${ITEMS[itemId].name} quebrou! Fabrique outro no menu de fabricação.`, 'warning', ITEMS[itemId].icon);
      this.ui.touch.setTorchAvailable(this.inventory.has('tocha'), this.player.torchOn);
    });
    bus.on('item:crafted', () => this.stats.crafted++);
    bus.on('level:up', ({ level }) => {
      this.player.maxEnergy = this.progression.maxEnergy;
      this.player.energy = this.player.maxEnergy;
      this.audio.play('levelup');
      this.player.emote('comemorar');
      this.cameraCtl.shake(0.25);
      this.levelUpBurst();
      ui.notify.banner(`Nível ${level}`, 'Você subiu de nível! Energia máxima aumentou.', 'estrela', 'level');
      const unlocked = [
        ...RECIPES.filter((r) => r.minLevel === level).map((r) => ITEMS[r.result].name),
        ...Object.values(STRUCTURES)
          .filter((s) => s.minLevel === level)
          .map((s) => s.name),
      ];
      if (unlocked.length) ui.notify.toast(`Desbloqueado: ${unlocked.join(', ')}`, 'success', 'estrela');
    });
    bus.on('quest:started', ({ questId }) => {
      const q = this.quests.getDef(questId);
      if (q) ui.notify.toast(`Nova missão: ${q.title}`, 'quest');
      ui.hud.markQuestsDirty();
      ui.refresh('missoes');
    });
    bus.on('quest:progress', () => {
      ui.hud.markQuestsDirty();
      ui.refresh('missoes');
    });
    bus.on('quest:completed', ({ questId }) => {
      const q = this.quests.getDef(questId);
      if (!q) return;
      this.audio.play('quest');
      if (!this.player.isActing) this.player.emote('acenar');
      ui.notify.banner(q.title, 'Missão concluída!', 'missao', 'quest');
      if (q.completeText) ui.notify.toast(q.completeText, 'info', 'estrela');
      if (questId === 'q_observatorio') void this.showChapter2Ending();
      if (questId === 'q_cancao') void this.showChapter3Ending();
      ui.hud.markQuestsDirty();
      ui.refresh('missoes');
      this.autosaveTimer = Math.min(this.autosaveTimer, 2);
    });
    bus.on('region:discovered', ({ regionId }) => {
      const region = getRegion(regionId);
      this.audio.play('discover');
      ui.notify.banner(region.name, 'Região descoberta', 'mapa', 'region');
      this.progression.addXP(25);
    });
    bus.on('structure:built', () => {
      this.stats.built++;
      this.player.emote('positivo');
      this.cameraCtl.shake(0.18);
      ui.hud.markQuestsDirty();
      this.autosaveTimer = Math.min(this.autosaveTimer, 2);
    });
    bus.on('flag:set', () => ui.hud.markQuestsDirty());
    bus.on('notify', ({ text, kind, icon: ic }) => ui.notify.toast(text, kind, ic));

    this.quests.onReward = (rewards) => {
      this.progression.addXP(rewards.xp);
      if (rewards.items) this.giveItems(rewards.items, true);
    };

    this.world.resources.onHit = (r) => {
      this.inventory.add(r.item, r.amount);
      this.bus.emit('resource:gathered', { itemId: r.item, amount: r.amount });
      this.ui.notify.itemPopup(r.item, r.amount);
      if (r.bonus) {
        this.inventory.add(r.bonus, 1);
        this.bus.emit('resource:gathered', { itemId: r.bonus, amount: 1 });
        this.ui.notify.itemPopup(r.bonus, 1);
      }
      this.progression.addXP(r.node.def.xp);
      const tall = r.node.stumpIndex >= 0;
      this.particles.burst(
        this.tmpVec.set(r.node.x, r.node.y + (tall ? 1.3 : 0.6), r.node.z),
        r.node.def.particleColor,
        r.depleted ? 16 : 7,
      );
      this.audio.play(r.node.def.sound, 0.9 + Math.random() * 0.2);
      this.player.playAction(r.toolUsed);
      if (r.toolUsed !== 'none') this.inventory.wearTool(r.toolUsed);
      if (r.depleted && tall) {
        // A árvore cai: baque, tremor e poeira.
        window.setTimeout(() => {
          this.audio.play('fall');
          const near = Math.hypot(r.node.x - this.player.position.x, r.node.z - this.player.position.z) < 12;
          if (near) this.cameraCtl.shake(0.35);
          this.particles.burst(new THREE.Vector3(r.node.x, r.node.y + 0.3, r.node.z), '#c9b48a', 14, { up: 2, speed: 3 });
        }, 1150);
      } else if (r.depleted && r.node.kind === 'rocha') {
        this.audio.play('break');
        this.cameraCtl.shake(0.12);
      }
    };

    this.interaction.onBlocked = (reason) => {
      if (this.blockedCooldown > 0) return;
      this.blockedCooldown = 1;
      this.audio.play('error');
      ui.notify.toast(reason, 'warning');
    };

    this.ui.onBlockingChange = () => this.onBlockingChange();
  }

  private wirePlayer(): void {
    const p = this.player;
    p.onStep = (surface) => {
      const pitch = { sand: 0.8, grass: 1, rock: 1.5, water: 0.55 }[surface];
      this.audio.play('step', pitch * (0.9 + Math.random() * 0.2));
    };
    p.onJump = () => this.audio.play('jump');
    p.onLand = (impact) => {
      this.audio.play('land');
      if (impact > 0.45) this.cameraCtl.shake(impact * 0.4);
      if (impact > 0.35) this.particles.burst(this.tmpVec.copy(p.position).setY(p.position.y + 0.1), '#d8c7a0', 8, { up: 1.5, speed: 2 });
    };
    p.onSplash = () => {
      this.audio.play('splash');
      this.particles.burst(this.tmpVec.copy(p.position), '#bff4ff', 14, { up: 4, speed: 2.5 });
    };
    p.onBoundary = () => {
      if (this.boundaryCooldown > 0) return;
      this.boundaryCooldown = 5;
      this.ui.notify.toast('O oceano é vasto demais para nadar. Volte para a ilha!', 'warning');
    };
  }

  private wireBrowser(): void {
    // Atalhos de teclado.
    this.input.onKeyDown = (code) => this.handleKey(code);

    // Captura do mouse (Pointer Lock) ao clicar no jogo.
    this.canvas.addEventListener('click', () => {
      this.audio.unlock();
      if (this.state === 'playing' && this.controlMode === 'desktop' && !this.ui.isBlocking()) this.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      // A captura é assíncrona: se um menu abriu enquanto ela era concedida, solta de novo.
      if (locked && (this.state !== 'playing' || this.ui.isBlocking() || this.controlMode !== 'desktop')) {
        this.unlockIntent = true;
        document.exitPointerLock();
        return;
      }
      this.input.pointerLocked = locked;
      // Alguns navegadores geram um "salto" de movimento logo após capturar o mouse.
      if (locked) this.input.ignoreLookFor(150);
      if (!locked && !this.unlockIntent && this.state === 'playing' && !this.ui.isBlocking()) {
        // O jogador apertou Esc (o navegador libera o mouse): abre a pausa.
        this.lastUnexpectedUnlock = performance.now();
        this.ui.openPanel('pausa');
      }
      this.unlockIntent = false;
    });
    document.addEventListener('pointerlockerror', () => {
      this.input.pointerLocked = false;
    });

    // Redimensionamento e orientação.
    window.addEventListener('resize', () => this.onResize());
    window.visualViewport?.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.onResize(), 250));

    // Aba em segundo plano: pausa o áudio e salva.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.suspend();
        this.input.reset();
        this.ui.touch.releaseAll();
        if (this.state === 'playing') void this.saveGame(false);
      } else {
        this.audio.resume();
        this.lastTime = performance.now();
      }
    });
    window.addEventListener('pagehide', () => {
      if (this.state === 'playing') void this.saveGame(false);
    });

    // Perda do contexto WebGL (comum em celulares com pouca memória).
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.ui.showContextLost(true);
      if (this.state === 'playing') void this.saveGame(false);
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.ui.showContextLost(false);
      this.applySettings();
      this.lastTime = performance.now();
      this.ui.notify.toast('Gráficos restaurados!', 'success');
    });

    // Áudio só pode começar depois de um toque/clique.
    const unlockAudio = () => {
      this.audio.unlock();
      this.audio.loadSamples(`${import.meta.env.BASE_URL}assets/sounds/`);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // Configurações alteradas no menu de opções.
    this.settings.onChange((_data, key) => {
      if (key === 'quality') this.applyGraphics();
      else this.applyGameplaySettings();
    });
  }

  private handleKey(code: string): void {
    if (this.state !== 'playing') {
      if (code === 'Escape' && this.ui.activePanel) this.ui.closePanel();
      return;
    }
    if (this.ui.dialogs.isOpen) return;
    if (code === 'Escape') {
      // Ignora o Esc que o navegador usou para liberar o mouse.
      if (performance.now() - this.lastUnexpectedUnlock < 250) return;
      if (this.ui.activePanel) this.ui.closePanel();
      else if (this.fishing.active) this.fishing.stop();
      else if (this.building.mode !== 'none') this.cancelBuild();
      else this.ui.openPanel('pausa');
      return;
    }
    const keys = this.input.bindings;
    if (keys.matches('inventario', code)) this.ui.togglePanel('inventario');
    else if (keys.matches('fabricar', code)) this.ui.togglePanel('fabricacao');
    else if (keys.matches('construir', code)) {
      if (this.building.mode !== 'none') this.cancelBuild();
      this.ui.togglePanel('construcao');
    } else if (keys.matches('mapa', code)) this.ui.togglePanel('mapa');
    else if (keys.matches('missoes', code)) this.ui.togglePanel('missoes');
    else if (code === 'KeyP') this.ui.togglePanel('pausa');
  }

  /** Painéis abrem/fecham: solta o mouse ou tenta capturá-lo de novo. */
  private onBlockingChange(): void {
    const blocking = this.ui.isBlocking();
    if (blocking) {
      this.input.reset();
      this.ui.touch.releaseAll();
      if (document.pointerLockElement === this.canvas) {
        this.unlockIntent = true;
        document.exitPointerLock();
      }
    } else if (this.state === 'playing' && this.controlMode === 'desktop') {
      this.requestLock();
    }
  }

  private requestLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    try {
      const result = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      // Alguns navegadores retornam uma Promise que pode falhar (sem gesto do usuário).
      result?.catch?.(() => undefined);
    } catch {
      /* sem suporte: o jogador pode arrastar com o mouse */
    }
  }

  private onResize(): void {
    if (!this.renderer) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.preset.pixelRatioCap));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // Telas em pé: campo de visão maior para enxergar os lados.
    this.camera.fov = this.camera.aspect < 1 ? 72 : 60;
    this.camera.updateProjectionMatrix();
    this.ui?.updatePortraitHint(this.state === 'playing');
  }

  /** Aplica todas as opções (gráficos, controles, áudio e duração do dia). */
  applySettings(): void {
    this.applyGraphics();
    this.applyGameplaySettings();
  }

  /** Qualidade gráfica: sombras, resolução, distância de visão, vegetação e luzes. */
  private applyGraphics(): void {
    const preset = this.settings.preset;
    this.renderer.shadowMap.enabled = preset.shadows;
    this.world.setShadows(preset.shadows, preset.shadowMapSize);
    this.world.setRenderDistance(preset.renderDistance);
    this.world.decorations.setDensity(preset.decorationDensity);
    this.world.auroraDecorations?.setDensity(preset.decorationDensity);
    this.wildlife?.setDensity(preset.decorationDensity);
    this.auroraWildlife?.setDensity(preset.decorationDensity);
    this.ecoWildlife?.setDensity(preset.decorationDensity);
    this.world.ecoDecorations?.setDensity(preset.decorationDensity);
    this.lights.setCount(preset.maxPointLights);
    this.shadowBlob.visible = !preset.shadows;
    // Materiais precisam ser recompilados quando as sombras mudam.
    this.world.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.needsUpdate = true;
      }
    });
    this.onResize();
  }

  /** Controles, áudio e duração do dia (não exigem recompilar materiais). */
  private applyGameplaySettings(): void {
    const s = this.settings.data;
    // Acessibilidade e teclas.
    this.input.bindings.custom = { ...s.keys } as typeof this.input.bindings.custom;
    this.cameraCtl.shakeEnabled = !s.reduceMotion;
    this.building?.setColorblind(s.colorblind);
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(s.uiScale || 1));
    root.classList.toggle('colorblind', s.colorblind);
    root.classList.toggle('reduce-motion', s.reduceMotion);
    this.ui.hud.refreshKeys(this.input.bindings);
    if (s.character !== this.characterLoaded) void this.applyCharacter();
    this.cameraCtl.sensitivity = s.sensitivity;
    this.cameraCtl.invertY = s.invertY;
    this.audio.setVolumes(s);
    this.world.dayNight.dayLengthSeconds = DAY_LENGTH_SECONDS[s.dayLength];
    this.ui.setControlMode(this.controlMode, this.state === 'playing');
    if (this.controlMode === 'touch' && document.pointerLockElement) {
      this.unlockIntent = true;
      document.exitPointerLock();
    }
  }

  /** Troca a aparência do personagem (o robô é um modelo glTF baixado na hora). */
  private async applyCharacter(): Promise<void> {
    const look = this.settings.data.character;
    this.characterLoaded = look;
    if (look === 'explorador') {
      this.player.setAvatar(null);
      return;
    }
    const model = await this.models.instance('robo.glb');
    if (this.settings.data.character !== look) return; // mudou de ideia enquanto carregava
    if (!model) {
      this.ui.notify.toast('Não foi possível carregar o personagem Robô. Usando o Explorador.', 'warning');
      this.player.setAvatar(null);
      return;
    }
    this.player.setAvatar(model, ROBOT_HEIGHT);
  }

  /** Cria a Ilha da Aurora quando o jogador chega perto (carregamento sob demanda). */
  private checkAurora(): void {
    if (this.world.auroraCreated) return;
    const p = this.player.position;
    if (Math.hypot(p.x - AURORA_CENTER.x, p.z - AURORA_CENTER.z) < 340) {
      this.createAurora(false);
      this.ui.notify.toast('Terra à vista! A Ilha da Aurora surge no horizonte.', 'quest', 'barco');
    }
  }

  /** `immediate`: monta todo o terreno de uma vez (ao carregar um jogo salvo lá). */
  private createAurora(immediate: boolean): void {
    this.world.createAurora(this.settings.preset.decorationDensity);
    if (immediate) this.world.terrain.get('aurora').buildMeshes();
  }

  /** Cria a Ilha do Eco quando o jogador chega perto (névoa e tudo). */
  private checkEco(): void {
    if (this.world.ecoCreated) return;
    const p = this.player.position;
    if (Math.hypot(p.x - ECO_CENTER.x, p.z - ECO_CENTER.z) < 330) {
      this.createEco(false);
      this.ui.notify.toast('Sinos ao longe… Uma ilha surge no meio da névoa: a Ilha do Eco!', 'quest', 'barco');
    }
  }

  private createEco(immediate: boolean): void {
    this.world.createEco(this.settings.preset.decorationDensity, {
      hasFlag: (f) => this.worldState.hasFlag(f),
      setFlag: (f) => this.worldState.setFlag(f),
      ringBell: (bell) => this.ringBell(bell),
      talkToIara: () => void this.talkOnEco('iara'),
      talkToGuardian: () => void this.talkOnEco('guardia'),
    });
    if (immediate) this.world.terrain.get('eco').buildMeshes();
  }

  /** Estados dos recursos de todas as ilhas (os ainda não criados vêm do salvamento). */
  private saveNodes(): Record<string, NodeSave> {
    const out: Record<string, NodeSave> = {};
    if (this.pendingNodes) {
      for (const [id, n] of Object.entries(this.pendingNodes)) {
        if ((!this.world.auroraResources && id.startsWith('aurora:')) || (!this.world.ecoResources && id.startsWith('eco:'))) out[id] = n;
      }
    }
    for (const rm of this.world.resourceManagers) Object.assign(out, rm.toJSON());
    return out;
  }

  /** Avisos de mudança do clima e trovões depois dos relâmpagos. */
  private wireWeather(): void {
    const weather = this.world.weather;
    weather.onChange = (kind) => {
      if (this.state !== 'playing') return;
      const fires = this.building.count('fogueira') > 0 ? ' Fogueiras ao relento vão apagar.' : '';
      switch (kind) {
        case 'nublado':
          this.ui.notify.toast('O céu está ficando nublado…', 'info', 'nuvem');
          break;
        case 'chuva':
          this.ui.notify.toast(`Começou a chover. Procure um abrigo.${fires}`, 'info', 'chuva');
          break;
        case 'tempestade':
          this.ui.notify.toast(`Tempestade chegando! O mar fica agitado e o barco, difícil de controlar.${fires}`, 'warning', 'tempestade');
          break;
        case 'limpo':
          this.ui.notify.toast('O céu abriu. Que dia bonito!', 'success', 'sol');
          break;
      }
    };
    weather.onLightning = (distance) => {
      if (this.state !== 'playing') return;
      // O som chega depois do clarão (velocidade do som, um pouco acelerada).
      this.thunders.push(distance / 500);
      if (distance < 400) this.cameraCtl.shake(0.15);
    };
  }

  /** Ao anoitecer, às vezes uma névoa densa cobre a ilha (e some ao amanhecer). */
  private updateNight(): void {
    const dn = this.world.dayNight;
    const night = dn.isNight;
    if (night === this.wasNight) return;
    this.wasNight = night;
    const weather = this.world.weather;
    if (night) {
      // Nunca na primeira noite: o jogador ainda está aprendendo.
      if (dn.day > 1 && Math.random() < MIST_CHANCE) {
        weather.setMist(true);
        this.ui.notify.toast('Uma névoa densa cobre a ilha. O minimapa não funciona na névoa: cuidado para não se perder!', 'warning', 'nuvem');
      }
    } else if (weather.mistNight) {
      weather.setMist(false);
      this.ui.notify.toast('O sol nasceu e a névoa se dissipou.', 'success', 'sol');
    }
  }

  /** Abrigado da chuva: sob um telhado, na cabana, na caverna ou a bordo? */
  private sheltered(): boolean {
    const p = this.player.position;
    return this.inCave || this.building.isSheltered(p.x, p.z, p.y);
  }

  /** Fome, desgaste da tocha acesa, chuva sobre o jogador e trovões. */
  private updateSurvival(dt: number): void {
    const p = this.player;
    if (p.torchOn) this.inventory.wearTool('tocha', dt);
    const weather = this.world.weather;
    const sheltered = this.sheltered();
    p.exposure = sheltered ? 0 : Math.max(0, (weather.rain - 0.3) / 0.7);
    // A chuva também gasta a tocha mais rápido.
    if (p.torchOn && p.exposure > 0) this.inventory.wearTool('tocha', dt * p.exposure);
    for (let i = this.thunders.length - 1; i >= 0; i--) {
      this.thunders[i] -= dt;
      if (this.thunders[i] <= 0) {
        this.thunders.splice(i, 1);
        this.audio.play('thunder');
      }
    }
    if (p.hunger <= 0 && this.hungerWarned < 2) {
      this.hungerWarned = 2;
      this.audio.play('error');
      this.ui.notify.toast('Você está faminto! Sua energia não se recupera. Coma alguma coisa.', 'warning', 'fome');
    } else if (p.hunger < 25 && this.hungerWarned < 1) {
      this.hungerWarned = 1;
      this.ui.notify.toast('Você está com fome. Coma frutas, peixe ou batata-doce.', 'warning', 'fome');
    } else if (p.hunger >= 25) {
      this.hungerWarned = 0;
    }
  }

  /** Anel de faíscas douradas ao subir de nível. */
  private levelUpBurst(): void {
    const p = this.player.position;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.particles.burst(this.tmpVec.set(p.x + Math.cos(a) * 0.8, p.y + 0.4, p.z + Math.sin(a) * 0.8), '#ffd166', 3, {
        up: 6,
        speed: 1.5,
        gravity: 6,
        life: 1.1,
      });
    }
  }

  // ===========================================================================
  // Fluxo do jogo (menu, novo jogo, continuar, salvar)
  // ===========================================================================

  private async showMenu(): Promise<void> {
    this.state = 'menu';
    await this.saveSystem.restoreLastSlot();
    const summary = await this.saveSystem.summary();
    this.hasSave = summary !== null;
    this.world.dayNight.setTime(16.8);
    this.world.weather.set('limpo', undefined, true);
    this.world.weather.setMist(false, true);
    this.world.weather.zoneMist = 0;
    this.audio.setRain(0, false);
    this.world.questBeacon.visible = false;
    this.world.targetMarker.visible = false;
    this.ui.setControlMode(this.controlMode, false);
    this.ui.showMainMenu(summary, this.saveSystem.persistent);
    if (this.saveSystem.lastError && !summary) this.ui.notify.toast(this.saveSystem.lastError, 'warning');
  }

  /** "Novo jogo" no menu: usa o espaço atual se estiver vazio; senão, deixa escolher. */
  async newGameFromMenu(): Promise<void> {
    if (!this.hasSave) {
      await this.startNewGame();
      return;
    }
    this.ui.openPanel('salvamentos');
  }

  /** Começa um jogo novo num espaço (pede confirmação se ele tiver progresso). */
  async newGameInSlot(slot: number): Promise<void> {
    if (await this.saveSystem.hasSave(slot)) {
      const ok = await this.ui.dialogs.confirm({
        title: `Começar um novo jogo no espaço ${slot}?`,
        message: 'Já existe um progresso salvo neste espaço. Ao começar de novo, ele será substituído.',
        confirmText: 'Começar do zero',
        danger: true,
      });
      if (!ok) return;
    }
    if (this.state === 'playing') await this.saveGame(false);
    await this.saveSystem.useSlot(slot);
    this.hasSave = false;
    await this.startNewGame();
  }

  /** Baixa o salvamento de um espaço como arquivo .json. */
  async exportSlot(slot: number): Promise<void> {
    if (this.state === 'playing' && slot === this.saveSystem.slot) await this.saveGame(false);
    const text = await this.saveSystem.exportText(slot);
    if (!text) return;
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alem-do-horizonte-espaco${slot}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      this.ui.notify.toast('Arquivo do salvamento baixado.', 'success', 'salvar');
    } catch {
      this.ui.notify.toast('Este navegador não permitiu baixar o arquivo.', 'warning');
    }
  }

  /** Escolhe um arquivo .json e grava no espaço (pede confirmação se ocupado). */
  async importSlot(slot: number): Promise<void> {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
    if (!file) return;
    if (await this.saveSystem.hasSave(slot)) {
      const ok = await this.ui.dialogs.confirm({
        title: `Substituir o espaço ${slot}?`,
        message: 'O progresso atual deste espaço será trocado pelo do arquivo.',
        confirmText: 'Substituir',
        danger: true,
      });
      if (!ok) return;
    }
    const error = await this.saveSystem.importText(await file.text(), slot);
    if (error) this.ui.notify.toast(error, 'warning');
    else this.ui.notify.toast(`Salvamento importado no espaço ${slot}.`, 'success', 'salvar');
    if (this.state !== 'playing') await this.showMenu();
  }

  async startNewGame(): Promise<void> {
    this.resetWorld();
    this.enterPlaying();
    await this.saveGame(false);
    const touch = this.controlMode === 'touch';
    await this.ui.dialogs.custom(
      `
      <div class="welcome">
        <div class="welcome-icon">${icon('bussola')}</div>
        <h2>Bem-vindo(a) à ilha!</h2>
        <p>Uma tempestade misteriosa destruiu seu barco. Você acordou numa praia desconhecida, com nada além da roupa do corpo.
        Explore, colete recursos, construa um abrigo e descubra os segredos dos <b>Lumeni</b>, a civilização que desapareceu daqui.</p>
        <ul class="welcome-controls">
          ${
            touch
              ? `<li><b>Joystick esquerdo</b> andar (na borda, corre)</li>
                 <li><b>Arraste à direita</b> girar a câmera</li>
                 <li><b>Botão de mão</b> coletar e interagir</li>
                 <li><b>Ícones no topo</b> inventário, fabricação, construção, mapa</li>`
              : `<li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar · <kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular</li>
                 <li><b>Clique na tela</b> e use o mouse para girar a câmera</li>
                 <li><kbd>E</kbd> coletar e interagir (segure para repetir)</li>
                 <li><kbd>I</kbd> inventário · <kbd>C</kbd> fabricar · <kbd>B</kbd> construir · <kbd>M</kbd> mapa</li>`
          }
        </ul>
        <p class="muted">Siga o <b>feixe de luz dourado</b> para encontrar o objetivo da missão.</p>
      </div>`,
      'Começar a aventura',
    );
  }

  async continueGame(slot?: number): Promise<void> {
    if (slot !== undefined && slot !== this.saveSystem.slot) {
      if (this.state === 'playing') await this.saveGame(false);
      await this.saveSystem.useSlot(slot);
    }
    const data = await this.saveSystem.load();
    if (!data) {
      this.ui.notify.toast(this.saveSystem.lastError ?? 'Nenhum salvamento encontrado.', 'warning');
      await this.showMenu();
      return;
    }
    this.resetWorld();
    this.applySave(data);
    this.enterPlaying();
    this.ui.notify.toast('Bem-vindo(a) de volta à ilha!', 'success', 'bussola');
  }

  private enterPlaying(): void {
    this.state = 'playing';
    this.ui.closeAll();
    this.ui.notify.clear();
    this.ui.hideMainMenu();
    this.ui.hud.setVisible(true);
    this.ui.setControlMode(this.controlMode, true);
    this.ui.touch.setTorchAvailable(this.inventory.has('tocha'), this.player.torchOn);
    this.cameraCtl.snapBehind(this.player.yaw);
    this.cameraCtl.pitch = 0.32;
    this.autosaveTimer = AUTOSAVE_SECONDS;
    this.regionTimer = 0.6;
    this.lastBuildMode = '';
    this.ui.updatePortraitHint(true);
  }

  /** Coloca o mundo no estado inicial (novo jogo). */
  private resetWorld(): void {
    this.building.cancel();
    this.interaction.filter = null;
    this.worldState.reset();
    this.inventory.load({});
    this.progression.load({ xp: 0 });
    this.building.clear();
    for (const rm of this.world.resourceManagers) rm.load(undefined);
    this.world.auroraLandmarks?.applyFlags();
    this.world.ecoLandmarks?.applyFlags();
    if (this.boatCtl.active) {
      this.boatCtl.boat!.boarded = false;
      this.boatCtl.boat = null;
      this.player.stand();
    }
    this.world.landmarks.applyFlags();
    this.quests.reset();
    this.world.dayNight.day = 1;
    this.world.dayNight.setTime(8);
    // O primeiro dia começa sempre com céu limpo.
    this.world.weather.set('limpo', 600, true);
    this.world.weather.setMist(false, true);
    this.fireflies?.reset();
    this.pet?.reset();
    this.story?.applyFlags();
    this.setPins([]);
    this.wasNight = this.world.dayNight.isNight;
    this.thunders = [];
    this.playTime = 0;
    this.stats = { gathered: 0, crafted: 0, built: 0 };
    const spawn = PLACES.spawn;
    this.player.maxEnergy = this.progression.maxEnergy;
    this.player.energy = this.player.maxEnergy;
    this.player.torchOn = false;
    this.player.buffTime = 0;
    this.player.hunger = 100;
    this.fishing?.stop();
    this.player.teleport(spawn.x, this.world.terrain.getHeight(spawn.x, spawn.z), spawn.z, Math.PI);
    this.currentRegionName = '';
    this.ui.hud.markQuestsDirty();
    this.ui.hud.markResourcesDirty();
  }

  private applySave(data: SaveData): void {
    this.worldState.load({
      flags: data.world.flags,
      regions: data.world.regions,
      explored: data.world.explored,
      exploredAurora: data.world.exploredAurora,
      exploredEco: data.world.exploredEco,
    });
    this.inventory.load(data.inventory, data.durability);
    this.progression.load(data.progression);
    // A Aurora é criada já no carregamento se o jogador estava lá ou tem algo construído lá.
    const nearAurora = (x: number, z: number) => Math.hypot(x - AURORA_CENTER.x, z - AURORA_CENTER.z) < 360;
    if (nearAurora(data.player.x, data.player.z) || data.structures.some((st) => nearAurora(st.x, st.z))) {
      this.createAurora(true);
    }
    const nearEco = (x: number, z: number) => Math.hypot(x - ECO_CENTER.x, z - ECO_CENTER.z) < 340;
    if (nearEco(data.player.x, data.player.z) || data.structures.some((st) => nearEco(st.x, st.z))) this.createEco(true);
    this.building.load(data.structures);
    this.pendingNodes = data.world.nodes;
    for (const rm of this.world.resourceManagers) rm.load(data.world.nodes);
    this.world.auroraLandmarks?.applyFlags();
    this.world.ecoLandmarks?.applyFlags();
    this.world.landmarks.applyFlags();
    this.quests.load(data.quests);
    this.quests.evaluateAll();
    this.world.dayNight.day = Math.max(1, Math.floor(data.world.day));
    this.world.dayNight.setTime(data.world.time);
    const w = data.world.weather;
    this.world.weather.set(w && w.kind in WEATHER_NAMES ? (w.kind as WeatherKind) : 'limpo', w ? Math.max(5, w.timer) : undefined, true);
    this.world.weather.setMist(!!w?.mist && this.world.dayNight.isNight, true);
    this.fireflies.reset();
    this.wasNight = this.world.dayNight.isNight;
    this.thunders = [];
    this.playTime = data.playTime;
    this.stats = { ...data.stats };
    const p = data.player;
    this.player.maxEnergy = this.progression.maxEnergy;
    const ground = this.world.terrain.getHeight(p.x, p.z);
    this.player.teleport(p.x, Math.max(p.y, ground), p.z, p.yaw);
    this.player.energy = clamp(p.energy, 0, this.player.maxEnergy);
    this.player.torchOn = p.torch && this.inventory.has('tocha');
    this.player.buffTime = p.buffTime;
    this.player.hunger = clamp(p.hunger, 0, 100);
    this.pet.load(data.pet, data.pet?.tameProgress ?? 0);
    this.story.applyFlags();
    this.setPins(data.world.pins ?? []);
  }

  private createSaveData(): SaveData {
    const p = this.player;
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      playTime: this.playTime,
      player: {
        x: p.position.x,
        y: p.position.y,
        z: p.position.z,
        yaw: p.yaw,
        energy: p.energy,
        torch: p.torchOn,
        buffTime: p.buffTime,
        hunger: p.hunger,
      },
      inventory: this.inventory.toJSON(),
      durability: this.inventory.durabilityToJSON(),
      progression: this.progression.toJSON(),
      quests: this.quests.toJSON(),
      structures: this.building.toJSON(),
      world: {
        time: this.world.dayNight.hour,
        day: this.world.dayNight.day,
        flags: [...this.worldState.flags],
        regions: [...this.worldState.discovered],
        explored: this.worldState.exploredToBase64('principal'),
        exploredAurora: this.worldState.exploredToBase64('aurora'),
        exploredEco: this.worldState.exploredToBase64('eco'),
        nodes: this.saveNodes(),
        weather: this.world.weather.toJSON(),
        pins: this.pins.map((p) => ({ ...p })),
      },
      stats: { ...this.stats },
      pet: { ...this.pet.toJSON(), tameProgress: this.pet.tameProgress },
    };
  }

  async saveGame(manual: boolean): Promise<boolean> {
    if (this.state !== 'playing') return false;
    this.autosaveTimer = AUTOSAVE_SECONDS;
    const ok = await this.saveSystem.save(this.createSaveData());
    if (ok) this.hasSave = true;
    this.ui.hud.showSaving();
    if (manual) {
      this.audio.play(ok ? 'craft' : 'error');
      this.ui.notify.toast(ok ? 'Jogo salvo!' : (this.saveSystem.lastError ?? 'Falha ao salvar.'), ok ? 'success' : 'warning', 'salvar');
    }
    return ok;
  }

  async returnToMenu(): Promise<void> {
    await this.saveGame(false);
    this.leaveToMenu();
  }

  private leaveToMenu(): void {
    this.building.cancel();
    this.ui.closeAll();
    this.ui.notify.clear();
    this.state = 'menu';
    if (document.pointerLockElement) {
      this.unlockIntent = true;
      document.exitPointerLock();
    }
    void this.showMenu();
  }

  async confirmDeleteSave(slot = this.saveSystem.slot): Promise<void> {
    const ok = await this.ui.dialogs.confirm({
      title: `Apagar o salvamento do espaço ${slot}?`,
      message:
        'Todo o progresso (inventário, construções, missões e mapa explorado) será apagado permanentemente. Esta ação não pode ser desfeita.',
      confirmText: 'Apagar tudo',
      danger: true,
    });
    if (!ok) return;
    await this.saveSystem.delete(slot);
    if (slot === this.saveSystem.slot) this.hasSave = false;
    this.ui.notify.toast('Salvamento apagado.', 'info', 'lixeira');
    if (this.state === 'playing' && slot === this.saveSystem.slot) {
      this.leaveToMenu();
    } else if (this.state !== 'playing') {
      this.ui.refresh('opcoes');
      await this.showMenu();
    }
  }

  // ===========================================================================
  // Ações usadas pela interface
  // ===========================================================================

  craft(recipeId: string): void {
    const result = this.crafting.craft(recipeId);
    const recipe = getRecipe(recipeId);
    if (result.ok && recipe) {
      this.audio.play('craft');
      this.player.emote('positivo');
      this.progression.addXP(recipe.xp);
      this.ui.notify.toast(`Fabricado: ${ITEMS[recipe.result].name}`, 'success', ITEMS[recipe.result].icon);
      this.particles.burst(this.tmpVec.copy(this.player.position).setY(this.player.position.y + 1.2), '#ffd166', 10);
    } else {
      this.audio.play('error');
      this.ui.notify.toast(result.reason ?? 'Não foi possível fabricar.', 'warning');
    }
  }

  useItem(id: ItemId): void {
    const def = ITEMS[id];
    if (!def.food) return;
    const full = this.player.energy >= this.player.maxEnergy - 0.5 && this.player.hunger >= 99;
    if (full && !def.food.buffSeconds) {
      this.ui.notify.toast('Você está satisfeito e com energia cheia.', 'info', 'raio');
      return;
    }
    if (!this.inventory.remove(id, 1)) return;
    this.player.eat(def.food.energy, def.food.buffSeconds, def.food.hunger);
    this.hungerWarned = this.player.hunger < 25 ? this.hungerWarned : 0;
    this.bus.emit('item:used', { itemId: id });
    this.audio.play('eat');
    const extra = def.food.buffSeconds ? ' Você está bem alimentado!' : '';
    this.ui.notify.toast(`Você comeu: ${def.name} (+${def.food.hunger} saciedade, +${def.food.energy} energia).${extra}`, 'success', def.icon);
  }

  toggleTorch(): void {
    if (!this.inventory.has('tocha')) {
      this.ui.notify.toast('Você ainda não tem uma tocha. Fabrique uma no menu de fabricação.', 'info', 'tocha');
      return;
    }
    this.player.torchOn = !this.player.torchOn;
    this.audio.play('equip');
    this.ui.touch.setTorchAvailable(true, this.player.torchOn);
    this.ui.refresh('inventario');
  }

  startBuild(type: StructureId): void {
    this.ui.closeAll();
    if (this.building.startPlacement(type)) {
      const hint =
        this.controlMode === 'touch'
          ? 'Ande para posicionar. Use Girar e Construir.'
          : 'Ande para posicionar · R gira · E constrói · Esc cancela';
      this.ui.notify.toast(hint, 'info', STRUCTURES[type].icon);
    }
  }

  startRemoval(): void {
    this.ui.closeAll();
    this.building.startRemoval();
    this.ui.notify.toast('Aponte para uma construção e interaja para removê-la.', 'info', 'remover');
  }

  cancelBuild(): void {
    this.building.cancel();
  }

  /** Mapa da ilha em que o jogador está (ou da mais próxima). */
  get currentMap(): MapRenderer {
    const p = this.player.position;
    const options: Array<[MapRenderer | null, number]> = [
      [this.mapRenderer, Math.hypot(p.x, p.z)],
      [this.auroraMap, Math.hypot(p.x - AURORA_CENTER.x, p.z - AURORA_CENTER.z)],
      [this.ecoMap, Math.hypot(p.x - ECO_CENTER.x, p.z - ECO_CENTER.z)],
    ];
    let best = this.mapRenderer;
    let bestD = Infinity;
    for (const [map, d] of options) {
      if (map && d < bestD) {
        best = map;
        bestD = d;
      }
    }
    return best;
  }

  /** Objetivo da missão acompanhada (para o feixe de luz e o mapa). */
  questTarget(): { x: number; z: number } | null {
    const quest = this.quests.tracked;
    return quest?.target ?? null;
  }

  // ===========================================================================
  // História: diário de Iara e conversas
  // ===========================================================================

  /** Toca um sino do Eco: nota musical, aviso da altura e marcador da missão. */
  private ringBell(bell: BellDef): void {
    this.audio.playBell(bell.freq);
    const first = !this.worldState.hasFlag(`sino_${bell.id}`);
    this.worldState.setFlag(`sino_${bell.id}`);
    if (first) {
      this.progression.addXP(20);
      const rung = BELLS.filter((b) => this.worldState.hasFlag(`sino_${b.id}`)).length;
      this.ui.notify.toast(
        `O ${bell.name} soa ${bell.pitch === 'média' ? 'numa nota média' : `numa nota ${bell.pitch}`}. (${rung}/3 sinos)` +
          (rung === 3 ? ' Algo desperta no templo!' : ''),
        rung === 3 ? 'quest' : 'info',
        'sino',
      );
    } else {
      this.ui.notify.toast(`O ${bell.name}: nota ${bell.pitch}.`, 'info', 'sino');
    }
  }

  private async talkOnEco(who: 'iara' | 'guardia'): Promise<void> {
    this.audio.play('open');
    const ctx: EcoDialogueContext = {
      hasFlag: (f) => this.worldState.hasFlag(f),
      setFlag: (f) => this.worldState.setFlag(f),
      bellsRung: () => BELLS.filter((b) => this.worldState.hasFlag(`sino_${b.id}`)).length,
      song: [],
      playNote: (id) => {
        const bell = BELLS.find((b) => b.id === id);
        if (bell) this.audio.playBell(bell.freq);
        this.world.ecoLandmarks?.swingBell(bell?.id ?? 'sul');
      },
      songCorrect: () => ctx.song.length === LUMENI_SONG.length && ctx.song.every((n, i) => n === LUMENI_SONG[i]),
    };
    await runDialogue(who === 'iara' ? IARA : GUARDIAN, ctx, (opts) => this.ui.dialogs.choose(opts));
    // Só depois da despedida da guardiã: a missão conclui e o final do capítulo aparece.
    if (who === 'guardia' && ctx.songCorrect() && !this.worldState.hasFlag('eco_cancao')) {
      this.worldState.setFlag('eco_cancao');
      this.world.ecoLandmarks?.applyFlags();
      this.audio.play('portal');
    }
  }

  private async readDiaryPage(page: DiaryPage): Promise<void> {
    const first = !this.worldState.hasFlag(page.id);
    if (first) {
      this.worldState.setFlag(page.id);
      this.progression.addXP(10);
      this.audio.play('discover');
      const count = diaryCount((f) => this.worldState.hasFlag(f));
      if (count >= 5) this.worldState.setFlag('diario_5');
      if (count >= DIARY_PAGES.length) this.worldState.setFlag('diario_completo');
    }
    await this.ui.dialogs.lore(page);
    if (first) {
      const count = diaryCount((f) => this.worldState.hasFlag(f));
      this.ui.notify.toast(`Página do diário encontrada (${count}/${DIARY_PAGES.length}). Releia no menu Missões (J).`, 'success', 'diario');
    }
  }

  async talkToParrot(): Promise<void> {
    this.audio.play('open');
    const ctx: DialogueContext = {
      hasFlag: (f) => this.worldState.hasFlag(f),
      setFlag: (f) => this.worldState.setFlag(f),
      fruitCount: () => this.inventory.count('fruta'),
      takeFruit: () => this.inventory.remove('fruta', 1),
      questHint: () => {
        const quest = this.quests.tracked;
        if (!quest) return null;
        const next = this.quests.objectives(quest).find((o) => !o.done);
        return next ? `Na missão "${quest.title}", o próximo passo é: ${next.text}. ${quest.description}` : quest.description;
      },
      revealTreasure: () => {
        const t = this.pet.revealNext();
        if (!t) return null;
        this.toggleMapPin(t.x, t.z, 3, 0);
        return regionAt(t.x, t.z)?.name ?? (t.id.startsWith('tesouro_a') ? 'a Ilha da Aurora' : 'um canto escondido da ilha');
      },
      diaryCount: () => diaryCount((f) => this.worldState.hasFlag(f)),
      diaryTotal: () => DIARY_PAGES.length,
      sound: (name) => this.audio.play(name),
    };
    await runDialogue(PARROT, ctx, (opts) => this.ui.dialogs.choose(opts));
  }

  // ===========================================================================
  // Marcadores do mapa
  // ===========================================================================

  /**
   * Toque no mapa: tira o marcador que estiver perto (dentro de `radius`
   * metros) ou coloca um novo com a cor escolhida. Retorna o que aconteceu.
   */
  toggleMapPin(x: number, z: number, color: number, radius: number): 'added' | 'removed' | 'full' {
    const i = this.pins.findIndex((p) => Math.hypot(p.x - x, p.z - z) <= radius);
    if (i >= 0) {
      this.setPins(this.pins.filter((_, k) => k !== i));
      this.audio.play('remove');
      return 'removed';
    }
    if (this.pins.length >= MAX_PINS) {
      this.ui.notify.toast(`Você já colocou ${MAX_PINS} marcadores. Tire algum para marcar outro lugar.`, 'warning', 'mapa');
      return 'full';
    }
    this.setPins([...this.pins, { x, z, c: color }]);
    this.audio.play('click');
    return 'added';
  }

  clearMapPins(): void {
    this.setPins([]);
  }

  private setPins(pins: Array<{ x: number; z: number; c: number }>): void {
    this.pins = pins;
    // Bandeirinhas no mundo: um mastro alto com a cor do marcador.
    for (const child of [...this.pinFlags.children]) this.pinFlags.remove(child);
    for (const p of pins) {
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(PIN_POLE, PIN_POLE_MAT);
      pole.position.y = 2;
      const cloth = new THREE.Mesh(PIN_CLOTH, pinMaterial(p.c));
      cloth.position.set(0.45, 3.5, 0);
      flag.add(pole, cloth);
      flag.position.set(p.x, this.world.terrain.getHeight(p.x, p.z), p.z);
      this.pinFlags.add(flag);
    }
  }

  /** Baús da história ainda fechados. */
  closedChests(): Array<{ x: number; z: number }> {
    const chests: Array<[string, { x: number; z: number }]> = [
      ['bau_praia', PLACES.chestBeach],
      ['bau_floresta', PLACES.chestForest],
      ['bau_caverna', PLACES.chestCave],
    ];
    return chests.filter(([flag]) => !this.worldState.hasFlag(flag)).map(([, pos]) => pos);
  }

  /** Dados para desenhar o mapa e o minimapa. */
  mapView(full = false): MapView {
    const markers: MapMarker[] = [];
    for (const s of this.building.structures) markers.push({ x: s.x, z: s.z, type: 'structure' });
    const ws = this.worldState;
    const landmarks = [
      PLACES.monolith,
      PLACES.cave,
      PLACES.peak,
      PLACES.giantTree,
      PLACES.shipwreck,
      AURORA_PLACES.observatory,
      AURORA_PLACES.loreStone,
      AURORA_PLACES.pylonWest,
      AURORA_PLACES.pylonEast,
      AURORA_PLACES.pylonSouth,
      ECO_PLACES.temple,
      ECO_PLACES.bellWest,
      ECO_PLACES.bellEast,
      ECO_PLACES.bellSouth,
    ];
    for (const l of landmarks) if (ws.isExplored(l.x, l.z)) markers.push({ x: l.x, z: l.z, type: 'landmark' });
    for (const pos of this.closedChests()) {
      if (ws.isExplored(pos.x, pos.z)) markers.push({ x: pos.x, z: pos.z, type: 'chest' });
    }
    for (const p of this.pins) markers.push({ x: p.x, z: p.z, type: 'pin', color: PIN_COLORS[p.c] });
    // Tesouros que a raposa achou e ainda não foram escavados.
    for (const t of this.pet.foundTreasures) markers.push({ x: t.x, z: t.z, type: 'chest' });
    const target = this.questTarget();
    if (target) markers.push({ x: target.x, z: target.z, type: 'quest' });
    return {
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      playerYaw: this.player.yaw,
      cameraYaw: full ? 0 : this.cameraCtl.yaw,
      markers,
      hidePlayer: this.world.weather.misty,
    };
  }

  // ===========================================================================
  // Ganchos (callbacks) para os marcos do mundo e as construções
  // ===========================================================================

  private giveItems(bundle: ItemBundle, asReward = false): void {
    this.inventory.addAll(bundle);
    const parts = Object.entries(bundle).map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`);
    if (parts.length) this.ui.notify.toast(`${asReward ? 'Recompensa' : 'Você recebeu'}: ${parts.join(', ')}`, 'item', 'mochila');
  }

  private createLandmarkHooks() {
    return {
      hasFlag: (f: string) => this.worldState.hasFlag(f),
      setFlag: (f: string) => this.worldState.setFlag(f),
      hasItems: (b: ItemBundle) => this.inventory.hasAll(b),
      takeItems: (b: ItemBundle) => this.inventory.removeAll(b),
      giveItems: (b: ItemBundle) => this.giveItems(b),
      showLore: (key: string) => {
        const entry = LORE[key];
        if (entry) void this.ui.dialogs.lore(entry);
      },
      sound: (name: Parameters<AudioManager['play']>[0]) => this.audio.play(name),
      burst: (pos: THREE.Vector3, color: string, count: number) => this.particles.burst(pos, color, count, { up: 4, speed: 3 }),
      notify: (text: string, kind?: Parameters<UIManager['notify']['toast']>[1]) => this.ui.notify.toast(text, kind),
      addXP: (n: number) => this.progression.addXP(n),
      shake: (amount: number) => this.cameraCtl.shake(amount),
      onEnding: () => void this.showEnding(),
    };
  }

  private createBuildingHooks() {
    return {
      inventory: this.inventory,
      level: () => this.progression.level,
      addXP: (n: number) => this.progression.addXP(n),
      notify: (text: string, kind?: Parameters<UIManager['notify']['toast']>[1]) => this.ui.notify.toast(text, kind),
      sound: (name: Parameters<AudioManager['play']>[0]) => this.audio.play(name),
      burst: (pos: THREE.Vector3, color: string, count: number) => this.particles.burst(pos, color, count),
      isNight: () => this.world.dayNight.isNight,
      sleep: () => void this.sleep(),
      rest: () => this.rest(),
      openCrafting: (station: 'bancada' | 'fogueira') => {
        this.ui.panels.fabricacao.focusStation = station;
        this.ui.openPanel('fabricacao');
      },
      openStorage: (structure: PlacedStructure) => this.ui.openStorage(structure),
      hasFlag: (flag: string) => this.worldState.hasFlag(flag),
      boardBoat: (structure: PlacedStructure) => {
        this.boatCtl.board(structure);
        this.cameraDistanceBeforeBoat = this.cameraCtl.distance;
        this.cameraCtl.distance = Math.max(this.cameraCtl.distance, 10);
        this.worldState.setFlag('navegou');
        this.ui.notify.toast(
          this.controlMode === 'touch' ? 'A bordo! Use o joystick para navegar e o botão para desembarcar.' : 'A bordo! W/S velocidade, A/D direção, E desembarca.',
          'info',
          'barco',
        );
      },
      playerPosition: () => this.player.position,
      playerYaw: () => this.player.yaw,
      playTime: () => this.playTime,
      raining: () => this.world.weather.raining,
      chooseCrop: async (options: CropId[]) => {
        const answer = await this.ui.dialogs.choose({
          title: 'O que plantar?',
          options: options.map((id) => {
            const seed = ITEMS[CROPS[id].seed];
            return { label: `${seed.name} (${this.inventory.count(seed.id)})`, value: id, icon: seed.icon };
          }),
        });
        return isCropId(answer) ? answer : null;
      },
    };
  }

  private async sleep(): Promise<void> {
    await this.ui.fade(() => {
      const nextDay = this.world.dayNight.hour >= 7;
      this.world.dayNight.setTime(7, nextDay);
      this.world.weather.setMist(false, true);
      this.fireflies.reset();
      this.player.energy = this.player.maxEnergy;
      this.player.hunger = Math.max(0, this.player.hunger - 15);
    }, 900);
    await this.saveGame(false);
    this.ui.notify.toast(`Você dormiu bem. Bom dia! (Dia ${this.world.dayNight.day})`, 'success', 'sol');
  }

  private rest(): void {
    this.player.energy = this.player.maxEnergy;
    void this.saveGame(true);
    this.ui.notify.toast('Você descansou: energia restaurada. (À noite, a cama permite dormir até o amanhecer.)', 'success', 'raio');
  }

  private async showChapter3Ending(): Promise<void> {
    await this.ui.dialogs.custom(
      `
      <div class="ending">
        <div class="welcome-icon">${icon('estrela')}</div>
        <h2>Fim do Capítulo 3: O Eco das Estrelas</h2>
        <p>Você encontrou a capitã Iara, tocou os sinos antigos e cantou a Canção dos Lumeni. A névoa se abriu e as três ilhas brilham juntas no céu: a constelação dos Lumeni está completa.</p>
        <p>Iara vai voltar para casa — e o Pipoca, finalmente, vai rever a sua capitã.</p>
        <div class="pause-stats">
          <div><span>Nível</span><b>${this.progression.level}</b></div>
          <div><span>Dias</span><b>${this.world.dayNight.day}</b></div>
          <div><span>Missões</span><b>${this.quests.completed.size}/${this.quests.totalQuests}</b></div>
          <div><span>Páginas do diário</span><b>${diaryCount((f) => this.worldState.hasFlag(f))}/${DIARY_PAGES.length}</b></div>
        </div>
        <p class="muted">O mundo continua aberto: termine as missões opcionais, decore sua casa e explore as três ilhas.</p>
      </div>`,
      'Continuar explorando',
    );
    await this.saveGame(false);
  }

  private async showChapter2Ending(): Promise<void> {
    await this.ui.dialogs.custom(
      `
      <div class="ending">
        <div class="welcome-icon">${icon('estrela')}</div>
        <h2>Fim do Capítulo 2: A Aurora</h2>
        <p>Você atravessou o mar, despertou os pilares e reacendeu o Observatório dos Lumeni. Volte à Aurora à noite para ver o céu iluminado!</p>
        <div class="pause-stats">
          <div><span>Nível</span><b>${this.progression.level}</b></div>
          <div><span>Dias</span><b>${this.world.dayNight.day}</b></div>
          <div><span>Missões</span><b>${this.quests.completed.size}/${this.quests.totalQuests}</b></div>
          <div><span>Construções</span><b>${this.stats.built}</b></div>
        </div>
        <p class="muted">O Mapa de Estrelas ainda guarda uma terceira ilha, ao sul, escondida na névoa… Pergunte ao Pipoca!</p>
      </div>`,
      'Continuar explorando',
    );
    await this.saveGame(false);
  }

  private async showEnding(): Promise<void> {
    await this.ui.dialogs.lore(LORE.farol);
    await this.ui.dialogs.custom(
      `
      <div class="ending">
        <div class="welcome-icon">${icon('estrela')}</div>
        <h2>Fim da primeira jornada</h2>
        <p>Você reacendeu o farol dos Lumeni e desvendou o segredo da ilha. Obrigado por jogar <b>Além do Horizonte</b>!</p>
        <div class="pause-stats">
          <div><span>Nível</span><b>${this.progression.level}</b></div>
          <div><span>Dias</span><b>${this.world.dayNight.day}</b></div>
          <div><span>Recursos coletados</span><b>${this.stats.gathered}</b></div>
          <div><span>Construções</span><b>${this.stats.built}</b></div>
          <div><span>Ilha explorada</span><b>${Math.round(this.worldState.exploredPercent * 100)}%</b></div>
        </div>
        <p class="muted">Novas regiões além do horizonte chegarão em futuras atualizações. Você pode continuar explorando e construindo!</p>
      </div>`,
      'Continuar explorando',
    );
    await this.saveGame(false);
  }
}
