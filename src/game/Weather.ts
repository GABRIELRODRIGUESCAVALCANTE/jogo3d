/**
 * Clima: tempo limpo, nublado, chuva e tempestade.
 *
 * O clima muda sozinho de tempos em tempos. A chuva é desenhada na GPU
 * (linhas que caem em volta da câmera), as nuvens ficam cinzentas, a névoa
 * fecha, o mar fica agitado e, na tempestade, caem relâmpagos com trovões.
 * Quem usa o clima (fogueiras, barco, energia) lê os valores `rain`, `cover`...
 */
import * as THREE from 'three';
import { createRandom, damp } from '../core/math';

export type WeatherKind = 'limpo' | 'nublado' | 'chuva' | 'tempestade';

export const WEATHER_NAMES: Record<WeatherKind, string> = {
  limpo: 'Céu limpo',
  nublado: 'Nublado',
  chuva: 'Chuva',
  tempestade: 'Tempestade',
};

interface WeatherTarget {
  cover: number;
  rain: number;
  waves: number;
  fog: number;
}

const TARGETS: Record<WeatherKind, WeatherTarget> = {
  limpo: { cover: 0, rain: 0, waves: 1, fog: 1 },
  nublado: { cover: 0.55, rain: 0, waves: 1.3, fog: 0.85 },
  chuva: { cover: 0.85, rain: 0.7, waves: 1.9, fog: 0.62 },
  tempestade: { cover: 1, rain: 1, waves: 2.8, fog: 0.48 },
};

/** Próximo clima possível e chance de cada um. */
const TRANSITIONS: Record<WeatherKind, Array<[WeatherKind, number]>> = {
  limpo: [
    ['limpo', 0.45],
    ['nublado', 0.55],
  ],
  nublado: [
    ['limpo', 0.4],
    ['chuva', 0.45],
    ['tempestade', 0.15],
  ],
  chuva: [
    ['nublado', 0.5],
    ['chuva', 0.25],
    ['tempestade', 0.25],
  ],
  tempestade: [
    ['chuva', 0.7],
    ['nublado', 0.3],
  ],
};

/** Duração (segundos de jogo) de cada clima: [mínimo, máximo]. */
const DURATION: Record<WeatherKind, [number, number]> = {
  limpo: [240, 480],
  nublado: [120, 240],
  chuva: [90, 180],
  tempestade: [60, 120],
};

const GREY = new THREE.Color('#7d8794');
const STORM = new THREE.Color('#4a525e');
const MIST = new THREE.Color('#8a97a3');

export interface WeatherVisualTargets {
  sky: { topColor: { value: THREE.Color }; horizonColor: { value: THREE.Color }; bottomColor: { value: THREE.Color }; sunVisible: { value: number } };
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fog: THREE.Fog;
}

export class WeatherSystem {
  kind: WeatherKind = 'limpo';
  /** Segundos até a próxima mudança. */
  timer = 300;
  /** Valores atuais (mudam suavemente). */
  cover = 0;
  rain = 0;
  waves = 1;
  fogFactor = 1;
  /** Brilho do relâmpago atual (0 a 1). */
  flash = 0;
  /** Noite de névoa densa (esconde o minimapa). */
  mistNight = false;
  /** Intensidade atual da névoa da noite (0 a 1). */
  mist = 0;
  /** Chamado quando o clima muda (para avisos). */
  onChange: ((kind: WeatherKind) => void) | null = null;
  /** Chamado a cada relâmpago (o som do trovão vem com atraso). */
  onLightning: ((distance: number) => void) | null = null;

  readonly rainMesh: THREE.LineSegments;
  private readonly rainUniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uOpacity: { value: 0 },
    uSlant: { value: 0 },
  };
  private lightningTimer = 6;
  private readonly random = createRandom(Date.now() & 0xffff);

  constructor(drops = 1600) {
    const positions = new Float32Array(drops * 6);
    const r = createRandom(77);
    for (let i = 0; i < drops; i++) {
      const x = (r() - 0.5) * 60;
      const y = r() * 26;
      const z = (r() - 0.5) * 60;
      const len = 0.5 + r() * 0.5;
      positions.set([x, y, z, x, y + len, z], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMesh = new THREE.LineSegments(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.rainUniforms,
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uCenter;
          uniform float uSlant;
          void main() {
            vec3 p = position;
            // Cai e recomeça no alto; acompanha a câmera em "blocos" para não piscar.
            p.y = mod(p.y - uTime * 18.0, 26.0) - 6.0;
            p.x = mod(p.x - uCenter.x + 30.0, 60.0) - 30.0 + uCenter.x + p.y * uSlant;
            p.z = mod(p.z - uCenter.z + 30.0, 60.0) - 30.0 + uCenter.z;
            p.y += uCenter.y;
            gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          void main() {
            gl_FragColor = vec4(0.75, 0.85, 0.95, uOpacity);
          }
        `,
      }),
    );
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.rainMesh.renderOrder = 6;
  }

  get raining(): boolean {
    return this.rain > 0.35;
  }

  get stormy(): boolean {
    return this.kind === 'tempestade';
  }

  /** Quanto a névoa do cenário fecha (1 = normal), somando chuva e névoa da noite. */
  get fogMultiplier(): number {
    return this.fogFactor * (1 - 0.7 * this.mist);
  }

  /** A névoa esconde o minimapa? */
  get misty(): boolean {
    return this.mist > 0.5;
  }

  setMist(on: boolean, instant = false): void {
    this.mistNight = on;
    if (instant) this.mist = on ? 1 : 0;
  }

  /** Força um clima (usado ao carregar e nos testes). */
  set(kind: WeatherKind, timer?: number, instant = false): void {
    this.kind = kind;
    this.timer = timer ?? this.durationFor(kind);
    if (instant) {
      const t = TARGETS[kind];
      this.cover = t.cover;
      this.rain = t.rain;
      this.waves = t.waves;
      this.fogFactor = t.fog;
    }
  }

  update(dt: number, elapsed: number, camera: THREE.Vector3, simulate: boolean): void {
    if (simulate) {
      this.timer -= dt;
      if (this.timer <= 0) this.change();
    }
    const t = TARGETS[this.kind];
    this.cover = damp(this.cover, t.cover, 0.25, dt);
    this.rain = damp(this.rain, t.rain, 0.3, dt);
    this.waves = damp(this.waves, t.waves, 0.25, dt);
    this.fogFactor = damp(this.fogFactor, t.fog, 0.25, dt);
    this.mist = damp(this.mist, this.mistNight ? 1 : 0, 0.2, dt);

    // Relâmpagos só na tempestade.
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.kind === 'tempestade' && simulate) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 4 + this.random() * 9;
        this.flash = 1;
        this.onLightning?.(200 + this.random() * 600);
      }
    }

    this.rainUniforms.uTime.value = elapsed;
    this.rainUniforms.uCenter.value.copy(camera);
    this.rainUniforms.uOpacity.value = this.rain * 0.55;
    this.rainUniforms.uSlant.value = this.kind === 'tempestade' ? 0.18 : 0.05;
    this.rainMesh.visible = this.rain > 0.02;
  }

  /** Escurece o céu, reduz o sol e fecha a névoa conforme o clima. */
  applyVisuals(v: WeatherVisualTargets): void {
    const c = this.cover;
    if (c > 0.001) {
      const tint = this.kind === 'tempestade' ? STORM : GREY;
      v.sky.topColor.value.lerp(tint, c * 0.7);
      v.sky.horizonColor.value.lerp(tint, c * 0.55);
      v.sky.bottomColor.value.lerp(tint, c * 0.5);
      v.sky.sunVisible.value *= 1 - c * 0.9;
      const storm = this.kind === 'tempestade' ? 1 : 0;
      v.fog.color.lerp(tint, c * 0.6);
      v.sun.intensity *= 1 - c * (0.65 + storm * 0.15);
      v.hemi.intensity *= 1 - c * (0.25 + storm * 0.2);
    }
    if (this.mist > 0.001) v.fog.color.lerp(MIST, this.mist * 0.6);
    if (this.flash > 0) {
      v.hemi.intensity += this.flash * 2.5;
      v.sky.horizonColor.value.lerp(new THREE.Color('#e8eeff'), this.flash * 0.6);
    }
  }

  private change(): void {
    const options = TRANSITIONS[this.kind];
    let roll = this.random();
    let next = options[options.length - 1][0];
    for (const [kind, chance] of options) {
      roll -= chance;
      if (roll <= 0) {
        next = kind;
        break;
      }
    }
    const changed = next !== this.kind;
    this.kind = next;
    this.timer = this.durationFor(next);
    if (changed) this.onChange?.(next);
  }

  private durationFor(kind: WeatherKind): number {
    const [a, b] = DURATION[kind];
    return a + this.random() * (b - a);
  }

  toJSON(): { kind: WeatherKind; timer: number; mist?: boolean } {
    return this.mistNight ? { kind: this.kind, timer: this.timer, mist: true } : { kind: this.kind, timer: this.timer };
  }
}
