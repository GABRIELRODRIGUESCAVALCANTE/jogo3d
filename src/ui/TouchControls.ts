/**
 * Controles de toque para celulares e tablets.
 *
 * - Lado esquerdo: joystick virtual (aparece onde o dedo toca).
 *   Empurrar até a borda faz o personagem correr.
 * - Lado direito: arrastar gira a câmera.
 * - Botões: pular, interagir (com o nome da ação), tocha e, no modo de
 *   construção, girar / construir / cancelar.
 *
 * Usamos Pointer Events com "captura": cada dedo é acompanhado pelo seu id,
 * então dá para andar e girar a câmera ao mesmo tempo.
 */
import type { Input, InputAction } from '../core/Input';
import { html } from './dom';
import { icon } from './icons';

const JOY_RADIUS = 56;

export class TouchControls {
  readonly el: HTMLElement;
  onCancelBuild: (() => void) | null = null;
  private readonly joyBase: HTMLElement;
  private readonly joyKnob: HTMLElement;
  private readonly interactBtn: HTMLElement;
  private readonly interactLabel: HTMLElement;
  private joyPointer: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private enabled = false;

  constructor(
    root: HTMLElement,
    private readonly input: Input,
  ) {
    this.el = html(`
      <div class="touch-layer hidden">
        <div class="touch-zone touch-joy-zone"></div>
        <div class="touch-zone touch-look-zone"></div>
        <div class="joystick idle"><div class="joy-knob"></div></div>
        <div class="touch-buttons">
          <button class="tbtn tbtn-torch hidden" data-action="torch" aria-label="Tocha">${icon('tocha')}</button>
          <button class="tbtn tbtn-jump" data-action="jump" aria-label="Pular">${icon('pular')}<span>Pular</span></button>
          <button class="tbtn tbtn-interact disabled" data-action="interact" aria-label="Interagir">${icon('mao')}<span class="tlabel">Interagir</span></button>
        </div>
        <div class="touch-build hidden">
          <button class="tbtn tbtn-small" data-action="rotate" aria-label="Girar">${icon('girar')}<span>Girar</span></button>
          <button class="tbtn tbtn-cancel" data-build="cancel" aria-label="Cancelar">${icon('fechar')}<span>Cancelar</span></button>
          <button class="tbtn tbtn-confirm" data-action="interact" aria-label="Construir">${icon('check')}<span>Construir</span></button>
        </div>
      </div>`);
    root.append(this.el);
    this.joyBase = this.el.querySelector('.joystick')!;
    this.joyKnob = this.el.querySelector('.joy-knob')!;
    this.interactBtn = this.el.querySelector('.tbtn-interact')!;
    this.interactLabel = this.el.querySelector('.tbtn-interact .tlabel')!;

    this.setupJoystick(this.el.querySelector('.touch-joy-zone')!);
    this.setupLook(this.el.querySelector('.touch-look-zone')!);
    this.el.querySelectorAll<HTMLElement>('[data-action]').forEach((btn) => this.setupButton(btn));
    this.el.querySelector('[data-build="cancel"]')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onCancelBuild?.();
    });
    // Evita o menu de contexto (toque longo) e gestos do navegador.
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setVisible(visible: boolean): void {
    this.enabled = visible;
    this.el.classList.toggle('hidden', !visible);
    if (!visible) this.releaseAll();
  }

  /** Atualiza o rótulo do botão de interagir (ex.: "Cortar árvore"). */
  setInteraction(label: string | null, enabled: boolean): void {
    this.interactLabel.textContent = label ?? 'Interagir';
    this.interactBtn.classList.toggle('disabled', !label);
    this.interactBtn.classList.toggle('blocked', !!label && !enabled);
  }

  setBuildMode(active: boolean, removing = false): void {
    this.el.querySelector('.touch-build')!.classList.toggle('hidden', !active || removing);
    this.el.querySelector('.touch-buttons')!.classList.toggle('build-active', active && !removing);
    const cancel = this.el.querySelector('.tbtn-cancel')!;
    // No modo remover, o cancelar aparece junto aos botões normais.
    if (removing) this.el.querySelector('.touch-buttons')!.prepend(cancel);
    else this.el.querySelector('.touch-build')!.insertBefore(cancel, this.el.querySelector('.tbtn-confirm'));
  }

  setTorchAvailable(available: boolean, lit: boolean): void {
    const btn = this.el.querySelector('.tbtn-torch')!;
    btn.classList.toggle('hidden', !available);
    btn.classList.toggle('active', lit);
  }

  /** Solta tudo (ex.: ao abrir um menu). */
  releaseAll(): void {
    this.joyPointer = null;
    this.lookPointer = null;
    this.input.setTouchMove(0, 0, false);
    for (const a of ['jump', 'interact', 'rotate', 'torch'] as InputAction[]) this.input.setTouchHeld(a, false);
    this.joyBase.classList.add('idle');
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
    this.el.querySelectorAll('.tbtn.pressed').forEach((b) => b.classList.remove('pressed'));
  }

  private setupJoystick(zone: HTMLElement): void {
    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joyPointer !== null) return;
      e.preventDefault();
      this.joyPointer = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.joyBase.classList.remove('idle');
      this.joyBase.style.left = `${e.clientX}px`;
      this.joyBase.style.top = `${e.clientY}px`;
      this.updateJoystick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      e.preventDefault();
      this.updateJoystick(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.input.setTouchMove(0, 0, false);
      this.joyBase.classList.add('idle');
      this.joyBase.style.left = '';
      this.joyBase.style.top = '';
      this.joyKnob.style.transform = 'translate(-50%, -50%)';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  private updateJoystick(x: number, y: number): void {
    let dx = x - this.joyOrigin.x;
    let dy = y - this.joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const mx = dx / JOY_RADIUS;
    const my = -dy / JOY_RADIUS;
    // Zona morta pequena para evitar tremidas.
    const mag = Math.hypot(mx, my);
    const run = mag > 0.93;
    this.joyBase.classList.toggle('running', run);
    if (mag < 0.12) this.input.setTouchMove(0, 0, false);
    else this.input.setTouchMove(mx, my, run);
  }

  private setupLook(zone: HTMLElement): void {
    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.lookPointer !== null) return;
      e.preventDefault();
      this.lookPointer = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      e.preventDefault();
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      // Telas de toque precisam de mais sensibilidade que o mouse.
      this.input.addLook(dx * 1.5, dy * 1.5);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  private setupButton(btn: HTMLElement): void {
    const action = btn.dataset.action as InputAction;
    let pointer: number | null = null;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pointer = e.pointerId;
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('pressed');
      this.input.pressTouch(action);
      this.input.setTouchHeld(action, true);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      btn.classList.remove('pressed');
      this.input.setTouchHeld(action, false);
    };
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('lostpointercapture', end);
  }
}
