/**
 * Carregamento de modelos 3D no formato glTF (.glb) com animações.
 *
 * Os arquivos ficam em public/assets/models. Cada arquivo é baixado uma única
 * vez; cada uso recebe uma cópia independente (com seu próprio esqueleto),
 * então várias raposas podem andar ao mesmo tempo com animações diferentes.
 *
 * Se um arquivo não carregar (sem internet, arquivo ausente), quem pediu o
 * modelo recebe `null` e usa uma alternativa — o jogo nunca trava por isso.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export interface ModelInstance {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
}

const MODELS_URL = `${import.meta.env.BASE_URL}assets/models/`;

export class ModelLibrary {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF | null>>();

  /** Baixa (ou reaproveita) um arquivo .glb da pasta de modelos. */
  private load(file: string): Promise<GLTF | null> {
    let promise = this.cache.get(file);
    if (!promise) {
      promise = this.loader.loadAsync(MODELS_URL + file).catch((err) => {
        console.warn(`[Modelos] não foi possível carregar ${file}; usando alternativa.`, err);
        return null;
      });
      this.cache.set(file, promise);
    }
    return promise;
  }

  /** Cria uma cópia animável do modelo (ou null se o arquivo falhou). */
  async instance(file: string): Promise<ModelInstance | null> {
    const gltf = await this.load(file);
    if (!gltf) return null;
    const root = cloneSkinned(gltf.scene);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false; // malhas com esqueleto se deformam além da caixa original
      }
    });
    return { root, clips: gltf.animations };
  }
}

/**
 * Controla as animações de um modelo: troca suave entre "parado", "andando",
 * "correndo" etc. e gestos que tocam uma vez (acenar, golpear).
 */
export class Animator {
  readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private currentName = '';
  private oneShot: THREE.AnimationAction | null = null;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.oneShot) {
        this.oneShot = null;
        e.action.fadeOut(0.2);
        this.current?.reset().fadeIn(0.2).play();
      }
    });
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  /** Animação em repetição (troca com transição suave). */
  play(name: string, fade = 0.25, speed = 1): void {
    const action = this.actions.get(name);
    if (!action) return;
    action.timeScale = speed;
    if (this.currentName === name) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    if (this.current && !this.oneShot) this.current.fadeOut(fade);
    this.current = action;
    this.currentName = name;
  }

  /** Gesto que toca uma vez e depois volta à animação anterior. */
  playOnce(name: string, fade = 0.12, speed = 1): void {
    const action = this.actions.get(name);
    if (!action) return;
    if (this.oneShot) this.oneShot.stop();
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = speed;
    action.fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.oneShot = action;
  }

  get busy(): boolean {
    return this.oneShot !== null;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}
