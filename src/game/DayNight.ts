/**
 * Ciclo de dia e noite.
 * Controla a posição do sol e da lua, as cores do céu, a névoa e as luzes.
 * As cores vêm de "quadros-chave" (amanhecer, meio-dia, pôr do sol, noite)
 * e são misturadas suavemente conforme a hora.
 */
import * as THREE from 'three';
import { smoothstep } from '../core/math';
import type { Sky } from './world/Sky';

interface SkyKey {
  t: number;
  top: string;
  horizon: string;
  bottom: string;
  fog: string;
  sun: string;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  cloud: string;
  cloudEmissive: string;
}

const NIGHT: Omit<SkyKey, 't'> = {
  top: '#0a1838',
  horizon: '#22406f',
  bottom: '#0e1e36',
  fog: '#1d345e',
  sun: '#a9bcff',
  hemiSky: '#6680c4',
  hemiGround: '#26354a',
  hemiI: 0.95,
  cloud: '#3a4a6e',
  cloudEmissive: '#0e1626',
};

const DAY: Omit<SkyKey, 't'> = {
  top: '#2d8cff',
  horizon: '#bfe8ff',
  bottom: '#93cfe5',
  fog: '#cdeaf7',
  sun: '#fff4dc',
  hemiSky: '#d8efff',
  hemiGround: '#7d8f5c',
  hemiI: 1.25,
  cloud: '#ffffff',
  cloudEmissive: '#6d7f96',
};

const KEYS: SkyKey[] = [
  { t: 0, ...NIGHT },
  { t: 4.6, ...NIGHT },
  {
    t: 5.9,
    top: '#3d5394',
    horizon: '#f5a27c',
    bottom: '#6f6a8c',
    fog: '#cf9f90',
    sun: '#ffb27a',
    hemiSky: '#a7aedb',
    hemiGround: '#5a4a4a',
    hemiI: 0.85,
    cloud: '#ffc4a8',
    cloudEmissive: '#6b4a4a',
  },
  {
    t: 7.2,
    top: '#4aa3ff',
    horizon: '#ffdcb0',
    bottom: '#9cc7d9',
    fog: '#dbe7e6',
    sun: '#ffe6b8',
    hemiSky: '#d0e8ff',
    hemiGround: '#72805a',
    hemiI: 1.1,
    cloud: '#ffffff',
    cloudEmissive: '#7a7f8a',
  },
  { t: 11, ...DAY },
  { t: 16, ...DAY },
  {
    t: 17.8,
    top: '#3f69c0',
    horizon: '#ffa36e',
    bottom: '#8c7090',
    fog: '#e6a88c',
    sun: '#ffa060',
    hemiSky: '#ffccaa',
    hemiGround: '#6a5040',
    hemiI: 1.0,
    cloud: '#ffb48a',
    cloudEmissive: '#7a4a3a',
  },
  {
    t: 19.1,
    top: '#1c2b5e',
    horizon: '#6d4c7d',
    bottom: '#2b2b4b',
    fog: '#3e3c60',
    sun: '#8fa4ff',
    hemiSky: '#6c74ba',
    hemiGround: '#2a2a3a',
    hemiI: 0.8,
    cloud: '#5a5a82',
    cloudEmissive: '#1a1a2e',
  },
  { t: 20.4, ...NIGHT },
  { t: 24, ...NIGHT },
];

// Converte as cores dos quadros-chave uma única vez.
const PARSED = KEYS.map((k) => ({
  t: k.t,
  top: new THREE.Color(k.top),
  horizon: new THREE.Color(k.horizon),
  bottom: new THREE.Color(k.bottom),
  fog: new THREE.Color(k.fog),
  sun: new THREE.Color(k.sun),
  hemiSky: new THREE.Color(k.hemiSky),
  hemiGround: new THREE.Color(k.hemiGround),
  hemiI: k.hemiI,
  cloud: new THREE.Color(k.cloud),
  cloudEmissive: new THREE.Color(k.cloudEmissive),
}));

export class DayNight {
  /** Hora do dia (0 a 24). */
  hour = 8;
  day = 1;
  dayLengthSeconds = 720;
  /** 0 = dia claro, 1 = noite fechada. */
  night = 0;
  /** Direção da luz principal (sol ou lua), normalizada. */
  readonly lightDir = new THREE.Vector3(0.5, 0.8, 0.3);
  readonly sunDir = new THREE.Vector3();
  readonly fogColor = new THREE.Color();

  private readonly tmpCloud = new THREE.Color();
  private readonly tmpEmissive = new THREE.Color();

  constructor(
    private readonly sky: Sky,
    private readonly sun: THREE.DirectionalLight,
    private readonly hemi: THREE.HemisphereLight,
    private readonly fog: THREE.Fog,
  ) {}

  /** Avança o tempo. A noite passa um pouco mais rápido que o dia. */
  update(dt: number): void {
    const isNightTime = this.hour >= 20 || this.hour < 5;
    const speed = (24 / this.dayLengthSeconds) * (isNightTime ? 1.6 : 1);
    this.hour += dt * speed;
    if (this.hour >= 24) {
      this.hour -= 24;
      this.day++;
    }
    this.apply();
  }

  /** Pula para uma hora (ex.: dormir até o amanhecer). */
  setTime(hour: number, nextDay = false): void {
    if (nextDay) this.day++;
    this.hour = ((hour % 24) + 24) % 24;
    this.apply();
  }

  get isNight(): boolean {
    return this.hour >= 19 || this.hour < 5.5;
  }

  /** Texto do relógio, ex.: "Dia 2 · 18:30". */
  clockText(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /** Aplica cores e luzes para a hora atual. */
  apply(): void {
    // Sol: nasce no leste (+X) às 6h, a pino ao meio-dia, se põe no oeste às 18h.
    const theta = ((this.hour - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(theta), Math.sin(theta) * 0.92, 0.38).normalize();
    const elevation = this.sunDir.y;

    // Mistura dos quadros-chave.
    let i = 0;
    while (i < PARSED.length - 2 && PARSED[i + 1].t <= this.hour) i++;
    const a = PARSED[i];
    const b = PARSED[i + 1];
    const k = (this.hour - a.t) / Math.max(0.0001, b.t - a.t);
    const u = this.sky.uniforms;
    u.topColor.value.copy(a.top).lerp(b.top, k);
    u.horizonColor.value.copy(a.horizon).lerp(b.horizon, k);
    u.bottomColor.value.copy(a.bottom).lerp(b.bottom, k);
    u.sunColor.value.copy(a.sun).lerp(b.sun, k);
    this.fogColor.copy(a.fog).lerp(b.fog, k);
    this.fog.color.copy(this.fogColor);
    this.hemi.color.copy(a.hemiSky).lerp(b.hemiSky, k);
    this.hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, k);
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
    this.sky.setCloudTint(this.tmpCloud.copy(a.cloud).lerp(b.cloud, k), this.tmpEmissive.copy(a.cloudEmissive).lerp(b.cloudEmissive, k));

    u.sunDir.value.copy(this.sunDir);
    u.moonDir.value.copy(this.sunDir).negate();
    u.sunVisible.value = smoothstep(-0.15, 0.05, elevation);
    u.moonVisible.value = smoothstep(0.0, -0.2, elevation);
    this.night = 1 - smoothstep(-0.18, 0.12, elevation);
    this.sky.setStarsOpacity(smoothstep(0.35, 0.9, this.night));

    // Luz direcional: sol de dia, lua de noite (troca quando ambos estão apagados).
    const sunIntensity = smoothstep(-0.12, 0.3, elevation) * 3.1;
    const moonIntensity = smoothstep(-0.14, -0.35, elevation) * 0.7;
    if (elevation > -0.13) {
      this.lightDir.copy(this.sunDir);
      this.sun.intensity = sunIntensity;
      this.sun.color.copy(u.sunColor.value);
    } else {
      this.lightDir.copy(this.sunDir).negate();
      this.sun.intensity = moonIntensity;
      this.sun.color.set('#9fb4ff');
    }
    // A luz sempre vem um pouco de cima (evita sombras gigantes no horizonte).
    if (this.lightDir.y < 0.22) {
      this.lightDir.y = 0.22;
      this.lightDir.normalize();
    }
  }

  toJSON(): { time: number; day: number } {
    return { time: this.hour, day: this.day };
  }
}
