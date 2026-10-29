/**
 * Áudio sintetizado com a Web Audio API.
 *
 * Nenhum arquivo de som é necessário: todos os efeitos (machadadas, passos,
 * sinos de missão...) e o ambiente (ondas, vento, pássaros, grilos e uma
 * música suave) são gerados em tempo real. Isso deixa o jogo leve e evita
 * erros de carregamento de arquivos.
 */
import type { SettingsData } from './Settings';

export type SoundName =
  | 'chop'
  | 'mine'
  | 'pickup'
  | 'craft'
  | 'build'
  | 'levelup'
  | 'quest'
  | 'step'
  | 'jump'
  | 'land'
  | 'click'
  | 'open'
  | 'close'
  | 'error'
  | 'eat'
  | 'chest'
  | 'portal'
  | 'splash'
  | 'discover'
  | 'crystal'
  | 'leaves'
  | 'remove'
  | 'rotate'
  | 'equip'
  | 'fall'
  | 'break';

/**
 * Sons gravados (arquivos em public/assets/sounds, licença CC0 — Kenney).
 * Quando um arquivo existe e carregou, ele substitui o som sintetizado.
 * Vários arquivos para o mesmo som = variação aleatória.
 */
const SAMPLE_FILES: Partial<Record<SoundName, string[]>> = {
  jump: ['pulo'],
  land: ['aterrissar'],
  pickup: ['coletar'],
  build: ['construir-a', 'construir-b', 'construir-c', 'construir-d'],
  remove: ['remover-a', 'remover-b', 'remover-c', 'remover-d'],
  rotate: ['girar'],
  click: ['clique'],
  equip: ['equipar'],
  fall: ['impacto'],
  break: ['quebrar'],
};

/** Volume relativo de cada som gravado. */
const SAMPLE_GAIN: Partial<Record<SoundName, number>> = { pickup: 0.45, click: 0.5, land: 0.7, jump: 0.6, fall: 0.9 };

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  freqEnd?: number;
  delay?: number;
  dest?: AudioNode;
}

interface NoiseOptions {
  type?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  gain?: number;
  attack?: number;
  delay?: number;
  dest?: AudioNode;
}

/** Notas da escala pentatônica de Dó (música calma, sem notas "erradas"). */
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private ambient!: GainNode;
  private music!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private waveLevel!: GainNode;
  private windLevel!: GainNode;

  private samples = new Map<SoundName, AudioBuffer[]>();
  private samplesRequested = false;
  private ambience = { day: 1, coast: 0.5, altitude: 0, cave: false };
  private birdTimer = 3;
  private cricketTimer = 2;
  private musicTimer = 4;
  private dripTimer = 2;
  private volumes: Pick<SettingsData, 'volumeMaster' | 'volumeSfx' | 'volumeAmbient' | 'volumeMusic'> = {
    volumeMaster: 0.8,
    volumeSfx: 0.8,
    volumeAmbient: 0.6,
    volumeMusic: 0.4,
  };

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Os navegadores só permitem áudio depois de uma interação do usuário.
   * Chame este método dentro de um clique ou toque.
   */
  unlock(): void {
    try {
      if (!this.ctx) this.create();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      console.warn('[Áudio] indisponível neste navegador.', err);
      this.ctx = null;
    }
  }

  /**
   * Baixa e decodifica os sons gravados (uma única vez). Se algum falhar,
   * o jogo continua usando o som sintetizado correspondente.
   */
  loadSamples(baseUrl: string): void {
    if (!this.ctx || this.samplesRequested) return;
    this.samplesRequested = true;
    const ctx = this.ctx;
    for (const [name, files] of Object.entries(SAMPLE_FILES) as Array<[SoundName, string[]]>) {
      for (const file of files) {
        fetch(`${baseUrl}${file}.mp3`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => {
            const list = this.samples.get(name) ?? [];
            list.push(buffer);
            this.samples.set(name, list);
          })
          .catch(() => {
            /* sem o arquivo: fica o som sintetizado */
          });
      }
    }
  }

  /** Toca um som gravado. Retorna falso se ele não estiver disponível. */
  private playSample(name: SoundName, pitch: number): boolean {
    const list = this.samples.get(name);
    if (!list || list.length === 0) return false;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = pitch * (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    g.gain.value = SAMPLE_GAIN[name] ?? 0.8;
    src.connect(g).connect(this.sfx);
    src.start();
    return true;
  }

  /** Pausa todo o áudio (ex.: aba em segundo plano). */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(settings: SettingsData): void {
    this.volumes = {
      volumeMaster: settings.volumeMaster,
      volumeSfx: settings.volumeSfx,
      volumeAmbient: settings.volumeAmbient,
      volumeMusic: settings.volumeMusic,
    };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.volumeMaster, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.volumes.volumeSfx, t, 0.05);
    this.ambient.gain.setTargetAtTime(this.volumes.volumeAmbient, t, 0.05);
    this.music.gain.setTargetAtTime(this.volumes.volumeMusic, t, 0.05);
  }

  /** Informa o contexto do ambiente para ajustar ondas, vento e animais. */
  setAmbience(day: number, coast: number, altitude: number, cave: boolean): void {
    this.ambience = { day, coast, altitude, cave };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.waveLevel.gain.setTargetAtTime(cave ? 0.02 : 0.05 + coast * 0.35, t, 0.8);
    this.windLevel.gain.setTargetAtTime(cave ? 0.015 : 0.02 + altitude * 0.18, t, 0.8);
  }

  /** Chamado a cada quadro: agenda pássaros, grilos, gotas e música. */
  update(dt: number): void {
    if (!this.ready) return;
    const { day, cave } = this.ambience;

    if (cave) {
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) {
        this.dripTimer = 1.5 + Math.random() * 3;
        const f = 900 + Math.random() * 700;
        this.tone(f, 0.18, { freqEnd: f * 0.55, gain: 0.05, dest: this.ambient });
      }
    } else if (day > 0.45) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 2 + Math.random() * 5;
        this.birdChirp();
      }
    } else {
      this.cricketTimer -= dt;
      if (this.cricketTimer <= 0) {
        this.cricketTimer = 0.8 + Math.random() * 2.2;
        this.crickets();
      }
    }

    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = (day > 0.45 ? 2.4 : 3.6) + Math.random() * 2.5;
      if (this.volumes.volumeMusic > 0.001) this.musicNote(day);
    }
  }

  /** Toca um efeito sonoro pelo nome. */
  play(name: SoundName, pitch = 1): void {
    if (!this.ready) return;
    if (this.playSample(name, pitch)) return;
    const p = pitch;
    switch (name) {
      case 'chop':
        this.noiseBurst(0.14, { type: 'bandpass', freq: 900 * p, q: 1.2, gain: 0.5 });
        this.tone(150 * p, 0.12, { type: 'triangle', freqEnd: 80, gain: 0.35 });
        break;
      case 'mine':
        this.noiseBurst(0.07, { type: 'highpass', freq: 2200, gain: 0.35 });
        this.tone(1250 * p, 0.12, { type: 'square', freqEnd: 900, gain: 0.07 });
        this.tone(620 * p, 0.2, { type: 'triangle', gain: 0.12, delay: 0.01 });
        break;
      case 'crystal':
        this.tone(1568 * p, 0.6, { gain: 0.12 });
        this.tone(2093 * p, 0.8, { gain: 0.08, delay: 0.05 });
        this.tone(2637 * p, 0.5, { gain: 0.05, delay: 0.1 });
        break;
      case 'leaves':
        this.noiseBurst(0.25, { type: 'bandpass', freq: 3000, q: 0.6, gain: 0.18 });
        break;
      case 'pickup':
        this.tone(660 * p, 0.09, { gain: 0.16 });
        this.tone(990 * p, 0.14, { gain: 0.14, delay: 0.06 });
        break;
      case 'craft':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', gain: 0.16, delay: i * 0.08 }));
        break;
      case 'build':
        for (let i = 0; i < 3; i++) {
          this.noiseBurst(0.12, { type: 'lowpass', freq: 320, gain: 0.6, delay: i * 0.14 });
          this.tone(110, 0.1, { type: 'triangle', gain: 0.3, delay: i * 0.14 });
        }
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', gain: 0.15, delay: i * 0.09 }));
        this.tone(2093, 0.9, { gain: 0.05, delay: 0.45 });
        break;
      case 'quest':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.9, { gain: 0.11, delay: i * 0.12 }));
        break;
      case 'discover':
        [659, 880, 1319].forEach((f, i) => this.tone(f, 0.8, { gain: 0.1, delay: i * 0.15 }));
        break;
      case 'step':
        this.noiseBurst(0.06, { type: 'lowpass', freq: 500 * p, gain: 0.09 });
        break;
      case 'jump':
        this.tone(280, 0.12, { freqEnd: 480, gain: 0.07 });
        break;
      case 'land':
        this.noiseBurst(0.09, { type: 'lowpass', freq: 260, gain: 0.25 });
        break;
      case 'click':
        this.tone(880, 0.04, { gain: 0.08 });
        break;
      case 'open':
        this.tone(440, 0.09, { freqEnd: 660, gain: 0.08 });
        break;
      case 'close':
        this.tone(660, 0.09, { freqEnd: 440, gain: 0.07 });
        break;
      case 'error':
        this.tone(190, 0.12, { type: 'square', gain: 0.06 });
        this.tone(150, 0.16, { type: 'square', gain: 0.06, delay: 0.12 });
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) this.noiseBurst(0.06, { type: 'bandpass', freq: 1800, q: 2, gain: 0.25, delay: i * 0.11 });
        break;
      case 'chest':
        this.tone(120, 0.45, { type: 'sawtooth', freqEnd: 210, gain: 0.05 });
        [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, 0.5, { gain: 0.08, delay: 0.35 + i * 0.07 }));
        break;
      case 'portal':
        this.tone(160, 2.2, { freqEnd: 820, gain: 0.14, attack: 0.4 });
        this.tone(240, 2.2, { type: 'triangle', freqEnd: 1230, gain: 0.08, attack: 0.5 });
        this.noiseBurst(2, { type: 'bandpass', freq: 400, freqEnd: 3000, q: 0.8, gain: 0.2, attack: 0.6 });
        break;
      case 'remove':
        this.noiseBurst(0.2, { type: 'lowpass', freq: 600, freqEnd: 200, gain: 0.4 });
        break;
      case 'rotate':
        this.tone(700, 0.05, { type: 'triangle', gain: 0.08 });
        break;
      case 'equip':
        this.tone(520, 0.08, { type: 'triangle', freqEnd: 780, gain: 0.1 });
        break;
      case 'fall':
        this.noiseBurst(0.35, { type: 'lowpass', freq: 220, gain: 0.7 });
        this.tone(70, 0.3, { type: 'sine', freqEnd: 45, gain: 0.4 });
        break;
      case 'break':
        this.noiseBurst(0.25, { type: 'bandpass', freq: 1200, freqEnd: 400, q: 0.8, gain: 0.45 });
        break;
      case 'splash':
        this.noiseBurst(0.35, { type: 'bandpass', freq: 1400, freqEnd: 500, q: 0.9, gain: 0.3 });
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Implementação interna
  // ---------------------------------------------------------------------------

  private create(): void {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.ambient = ctx.createGain();
    this.ambient.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);

    // Ruído branco de 2 segundos, reaproveitado por vários sons.
    const length = ctx.sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    this.createAmbientLoops();
    this.setVolumes({ ...this.volumes } as SettingsData);
  }

  /** Ondas do mar (ruído filtrado com volume oscilante) e vento. */
  private createAmbientLoops(): void {
    const ctx = this.ctx!;
    const waves = ctx.createBufferSource();
    waves.buffer = this.noiseBuffer;
    waves.loop = true;
    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.value = 420;
    const waveMod = ctx.createGain();
    waveMod.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.4;
    lfo.connect(lfoDepth).connect(waveMod.gain);
    this.waveLevel = ctx.createGain();
    this.waveLevel.gain.value = 0.2;
    waves.connect(waveFilter).connect(waveMod).connect(this.waveLevel).connect(this.ambient);
    waves.start(0, 0);
    lfo.start();

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 650;
    windFilter.Q.value = 0.6;
    this.windLevel = ctx.createGain();
    this.windLevel.gain.value = 0.03;
    wind.connect(windFilter).connect(this.windLevel).connect(this.ambient);
    wind.start(0, 1);
  }

  private tone(freq: number, dur: number, opts: ToneOptions = {}): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + dur);
    const g = ctx.createGain();
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain ?? 0.2), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.01));
    osc.connect(g).connect(opts.dest ?? this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, opts: NoiseOptions = {}): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'lowpass';
    filter.frequency.setValueAtTime(opts.freq ?? 1000, t0);
    if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + dur);
    filter.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const attack = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain ?? 0.2), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.01));
    src.connect(filter).connect(g).connect(opts.dest ?? this.sfx);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  private birdChirp(): void {
    const base = 2400 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      this.tone(base * (0.9 + Math.random() * 0.25), 0.09, {
        freqEnd: base * (1.15 + Math.random() * 0.3),
        gain: 0.035,
        delay: i * 0.12,
        dest: this.ambient,
      });
    }
  }

  private crickets(): void {
    const pulses = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < pulses; i++) {
      this.tone(4300, 0.035, { type: 'square', gain: 0.006, delay: i * 0.06, dest: this.ambient });
    }
  }

  private musicNote(day: number): void {
    const ctx = this.ctx!;
    const low = day < 0.45;
    const idx = Math.floor(Math.random() * (low ? 6 : PENTATONIC.length));
    const freq = PENTATONIC[idx] * (low ? 0.5 : 1);
    const t0 = ctx.currentTime;
    const playPad = (f: number, gain: number) => {
      for (const [type, detune] of [
        ['sine', 0],
        ['triangle', 6],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = f;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.2);
        osc.connect(g).connect(this.music);
        osc.start(t0);
        osc.stop(t0 + 4.3);
      }
    };
    playPad(freq, 0.05);
    if (Math.random() < 0.35) playPad(freq * 0.75, 0.03);
  }
}
