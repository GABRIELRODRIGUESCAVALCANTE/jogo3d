/**
 * Opções do jogador (qualidade gráfica, controles e áudio).
 * Ficam salvas separadamente do progresso do jogo.
 */
import { isLowEndDevice, isTouchDevice } from './Device';
import { safeStorage } from './storage';

export type Quality = 'baixa' | 'media' | 'alta';
export type ControlMode = 'auto' | 'desktop' | 'touch';
export type DayLength = 'curto' | 'normal' | 'longo';

export interface SettingsData {
  quality: Quality;
  controlMode: ControlMode;
  sensitivity: number; // 0.3 a 2.0
  invertY: boolean;
  showFps: boolean;
  volumeMaster: number; // 0 a 1
  volumeSfx: number;
  volumeAmbient: number;
  volumeMusic: number;
  dayLength: DayLength;
}

/** Parâmetros técnicos de cada nível de qualidade. */
export interface QualityPreset {
  label: string;
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  renderDistance: number; // metros
  decorationDensity: number; // 0 a 1
  maxPointLights: number;
  antialias: boolean;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  baixa: {
    label: 'Baixa',
    pixelRatioCap: 1,
    shadows: false,
    shadowMapSize: 512,
    renderDistance: 170,
    decorationDensity: 0.35,
    maxPointLights: 2,
    antialias: false,
  },
  media: {
    label: 'Média',
    pixelRatioCap: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    renderDistance: 260,
    decorationDensity: 0.7,
    maxPointLights: 3,
    antialias: true,
  },
  alta: {
    label: 'Alta',
    pixelRatioCap: 2,
    shadows: true,
    shadowMapSize: 2048,
    renderDistance: 400,
    decorationDensity: 1,
    maxPointLights: 4,
    antialias: true,
  },
};

/** Duração de um dia completo do jogo, em segundos reais. */
export const DAY_LENGTH_SECONDS: Record<DayLength, number> = {
  curto: 360,
  normal: 720,
  longo: 1440,
};

const STORAGE_KEY = 'alem-do-horizonte:opcoes';

function defaultSettings(): SettingsData {
  const touch = isTouchDevice();
  const lowEnd = isLowEndDevice();
  let quality: Quality = 'media';
  if (touch && lowEnd) quality = 'baixa';
  else if (!touch && !lowEnd) quality = 'alta';
  return {
    quality,
    controlMode: 'auto',
    sensitivity: 1,
    invertY: false,
    showFps: false,
    volumeMaster: 0.8,
    volumeSfx: 0.8,
    volumeAmbient: 0.6,
    volumeMusic: 0.4,
    dayLength: 'normal',
  };
}

type Listener = (data: SettingsData, key: keyof SettingsData) => void;

export class Settings {
  data: SettingsData = defaultSettings();
  private listeners = new Set<Listener>();

  load(): void {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      // Mescla com os padrões para aceitar arquivos antigos/incompletos.
      this.data = { ...defaultSettings(), ...parsed };
      if (!(this.data.quality in QUALITY_PRESETS)) this.data.quality = 'media';
    } catch {
      console.warn('[Settings] opções inválidas, usando padrões.');
    }
  }

  save(): void {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    if (this.data[key] === value) return;
    this.data[key] = value;
    this.save();
    for (const l of this.listeners) l(this.data, key);
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get preset(): QualityPreset {
    return QUALITY_PRESETS[this.data.quality];
  }

  /** Resolve o modo "automático" para o modo real de controle. */
  get effectiveControlMode(): 'desktop' | 'touch' {
    if (this.data.controlMode === 'auto') return isTouchDevice() ? 'touch' : 'desktop';
    return this.data.controlMode;
  }
}
