/**
 * Opções: qualidade gráfica, controles, áudio e dados salvos.
 */
import { QUALITY_PRESETS, type ControlMode, type DayLength, type Quality, type SettingsData } from '../../core/Settings';
import type { Game } from '../../game/Game';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

type Option<T> = { value: T; label: string };

const QUALITY_OPTIONS: Option<Quality>[] = (Object.keys(QUALITY_PRESETS) as Quality[]).map((q) => ({
  value: q,
  label: QUALITY_PRESETS[q].label,
}));
const CONTROL_OPTIONS: Option<ControlMode>[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'desktop', label: 'Computador' },
  { value: 'touch', label: 'Toque' },
];
const DAY_OPTIONS: Option<DayLength>[] = [
  { value: 'curto', label: 'Curto (6 min)' },
  { value: 'normal', label: 'Normal (12 min)' },
  { value: 'longo', label: 'Longo (24 min)' },
];

export class SettingsPanel extends Panel {
  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'opcoes', 'Opções', 'engrenagem', 'normal');
    this.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const seg = target.closest<HTMLElement>('[data-key][data-value]');
      if (seg) {
        const key = seg.dataset.key as keyof SettingsData;
        this.game.settings.set(key, seg.dataset.value as never);
        this.ui.click();
        this.render();
        return;
      }
      const toggle = target.closest<HTMLElement>('[data-toggle]');
      if (toggle) {
        const key = toggle.dataset.toggle as 'invertY' | 'showFps' | 'autoQuality';
        this.game.settings.set(key, !this.game.settings.data[key]);
        this.ui.click();
        this.render();
        return;
      }
      if (target.closest('[data-delete]')) void this.game.confirmDeleteSave();
    });
    this.body.addEventListener('input', (e) => {
      const range = e.target as HTMLInputElement;
      if (range.type !== 'range') return;
      const key = range.dataset.range as keyof SettingsData;
      const value = Number(range.value);
      this.game.settings.set(key, value as never);
      const out = range.parentElement?.querySelector('output');
      if (out) out.textContent = this.formatRange(key, value);
    });
  }

  render(): void {
    const s = this.game.settings.data;
    const segmented = <T extends string>(key: keyof SettingsData, options: Option<T>[], current: T) =>
      `<div class="segmented" role="radiogroup">${options
        .map(
          (o) =>
            `<button role="radio" aria-checked="${o.value === current}" class="${o.value === current ? 'active' : ''}" data-key="${key}" data-value="${o.value}">${escapeHtml(o.label)}</button>`,
        )
        .join('')}</div>`;
    const toggle = (key: 'invertY' | 'showFps' | 'autoQuality', on: boolean) =>
      `<button class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-toggle="${key}"><span></span></button>`;
    const range = (key: keyof SettingsData, value: number, min: number, max: number, step: number) =>
      `<div class="range"><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-range="${key}"><output>${this.formatRange(key, value)}</output></div>`;

    this.body.innerHTML = `
      <div class="settings">
        <h3>${icon('tela')} Gráficos</h3>
        <label class="setting"><span>Qualidade gráfica</span>${segmented('quality', QUALITY_OPTIONS, s.quality)}</label>
        <p class="setting-hint">Baixa: sem sombras e menos vegetação (ideal para celulares simples). Alta: sombras nítidas e maior distância de visão.</p>
        <div class="setting"><span>Ajustar qualidade automaticamente</span>${toggle('autoQuality', s.autoQuality)}</div>
        <div class="setting"><span>Mostrar FPS</span>${toggle('showFps', s.showFps)}</div>
        <div class="diagnostics" aria-live="off"></div>

        <h3>${icon('mao')} Controles</h3>
        <label class="setting"><span>Tipo de controle</span>${segmented('controlMode', CONTROL_OPTIONS, s.controlMode)}</label>
        <label class="setting"><span>Sensibilidade da câmera</span>${range('sensitivity', s.sensitivity, 0.3, 2, 0.05)}</label>
        <div class="setting"><span>Inverter eixo vertical</span>${toggle('invertY', s.invertY)}</div>

        <h3>${icon('estrela')} Áudio</h3>
        <label class="setting"><span>Volume geral</span>${range('volumeMaster', s.volumeMaster, 0, 1, 0.05)}</label>
        <label class="setting"><span>Efeitos</span>${range('volumeSfx', s.volumeSfx, 0, 1, 0.05)}</label>
        <label class="setting"><span>Ambiente</span>${range('volumeAmbient', s.volumeAmbient, 0, 1, 0.05)}</label>
        <label class="setting"><span>Música</span>${range('volumeMusic', s.volumeMusic, 0, 1, 0.05)}</label>

        <h3>${icon('sol')} Jogo</h3>
        <label class="setting"><span>Duração do dia</span>${segmented('dayLength', DAY_OPTIONS, s.dayLength)}</label>

        <h3>${icon('salvar')} Dados</h3>
        <div class="setting"><span>Salvamento local ${this.game.hasSave ? '' : '(nenhum)'}</span>
          <button class="btn btn-small btn-danger" data-delete="1" ${this.game.hasSave ? '' : 'disabled'}>${icon('lixeira')} Apagar salvamento</button>
        </div>
      </div>`;
  }

  private diagTimer = 0;

  update(dt: number): void {
    this.diagTimer -= dt;
    if (this.diagTimer > 0) return;
    this.diagTimer = 0.5;
    const el = this.body.querySelector('.diagnostics');
    if (!el) return;
    const d = this.game.diagnostics();
    el.innerHTML = `
      <div><span>FPS</span><b>${Math.round(d.fps)}</b></div>
      <div><span>Resolução</span><b>${d.width}×${d.height}</b></div>
      <div><span>Chamadas de desenho</span><b>${d.calls}</b></div>
      <div><span>Triângulos</span><b>${(d.triangles / 1000).toFixed(0)} mil</b></div>
      <div class="diag-gpu"><span>Placa de vídeo</span><b>${escapeHtml(d.gpu)}</b></div>`;
  }

  private formatRange(key: keyof SettingsData, value: number): string {
    if (key === 'sensitivity') return `${value.toFixed(2)}x`;
    return `${Math.round(value * 100)}%`;
  }
}
