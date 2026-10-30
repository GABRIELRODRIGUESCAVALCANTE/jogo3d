/**
 * Entrada do jogador (teclado, mouse e toque) reunida em um só lugar.
 *
 * Os sistemas do jogo não leem eventos do navegador diretamente: eles
 * perguntam ao Input "o jogador quer andar para frente?" ou "apertou pular?".
 * Assim, teclado e controles de toque funcionam da mesma forma.
 */

/** Ações que podem vir tanto do teclado quanto dos botões de toque. */
export type InputAction = 'jump' | 'interact' | 'rotate' | 'torch';

import { KeyBindings, type BindableAction } from './KeyBindings';

/** Teclas que não devem rolar a página nem acionar atalhos do navegador. */
const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  /** Quando falso, o jogador não se move (ex.: menu aberto). */
  enabled = true;
  /** Verdadeiro enquanto o mouse está "capturado" pelo jogo (Pointer Lock). */
  pointerLocked = false;

  /** Teclas configuráveis (Opções → Teclado). */
  readonly bindings = new KeyBindings();

  /** Chamado para atalhos de interface (I, M, Esc...). */
  onKeyDown: ((code: string, event: KeyboardEvent) => void) | null = null;

  private keys = new Set<string>();
  private pressed = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private wheelDelta = 0;
  private dragging = false;
  private ignoreLookUntil = 0;

  // Valores vindos dos controles de toque.
  private touchMove = { x: 0, y: 0 };
  private touchRun = false;
  private touchPressed = new Set<InputAction>();
  private touchHeld = new Set<InputAction>();
  private mousePressed = false;
  private mouseHeld = false;

  private readonly disposers: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.listen(window, 'keydown', (e) => this.handleKeyDown(e as KeyboardEvent));
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    this.listen(window, 'blur', () => this.reset());

    this.listen(canvas, 'mousedown', (e) => {
      const me = e as MouseEvent;
      if (me.button === 0) {
        if (this.pointerLocked) {
          this.mousePressed = true;
          this.mouseHeld = true;
        } else {
          this.dragging = true;
        }
      } else if (me.button === 2) {
        this.dragging = true;
      }
    });
    this.listen(window, 'mouseup', (e) => {
      const me = e as MouseEvent;
      if (me.button === 0) this.mouseHeld = false;
      this.dragging = false;
    });
    this.listen(window, 'mousemove', (e) => {
      const me = e as MouseEvent;
      if (this.pointerLocked || this.dragging) {
        // Ignora saltos absurdos que alguns navegadores geram ao capturar o mouse.
        if (performance.now() < this.ignoreLookUntil) return;
        if (Math.abs(me.movementX) > 300 || Math.abs(me.movementY) > 300) return;
        this.lookDX += me.movementX;
        this.lookDY += me.movementY;
      }
    });
    this.listen(canvas, 'wheel', (e) => {
      const we = e as WheelEvent;
      this.wheelDelta += Math.sign(we.deltaY);
      we.preventDefault();
    }, { passive: false });
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------------------
  // Consultas usadas pelo jogo
  // ---------------------------------------------------------------------------

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /**
   * Vetor de movimento desejado. x = direita, y = frente.
   * Valores entre -1 e 1 (o joystick permite andar devagar).
   */
  getMove(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (this.down('frente')) y += 1;
    if (this.down('tras')) y -= 1;
    if (this.down('direita')) x += 1;
    if (this.down('esquerda')) x -= 1;
    x += this.touchMove.x;
    y += this.touchMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  isSprinting(): boolean {
    if (!this.enabled) return false;
    return this.down('correr') || this.touchRun;
  }

  /** Verdadeiro apenas no quadro em que a ação foi acionada. */
  actionPressed(action: InputAction): boolean {
    if (!this.enabled) return false;
    if (this.touchPressed.has(action)) return true;
    switch (action) {
      case 'jump':
        return this.justPressed('pular');
      case 'interact':
        return this.justPressed('interagir') || this.mousePressed;
      case 'rotate':
        return this.justPressed('girar');
      case 'torch':
        return this.justPressed('tocha');
    }
  }

  /** Verdadeiro enquanto a ação estiver pressionada (para coletar segurando). */
  actionHeld(action: InputAction): boolean {
    if (!this.enabled) return false;
    if (this.touchHeld.has(action)) return true;
    if (action === 'interact') return this.down('interagir') || this.mouseHeld;
    if (action === 'jump') return this.down('pular');
    return false;
  }

  /** Alguma tecla da ação está pressionada? */
  private down(action: BindableAction): boolean {
    return this.bindings.keys(action).some((k) => this.keys.has(k));
  }

  /** Alguma tecla da ação foi apertada neste quadro? */
  private justPressed(action: BindableAction): boolean {
    return this.bindings.keys(action).some((k) => this.pressed.has(k));
  }

  /** Descarta o movimento do mouse por alguns milissegundos. */
  ignoreLookFor(ms: number): void {
    this.ignoreLookUntil = performance.now() + ms;
    this.lookDX = 0;
    this.lookDY = 0;
  }

  /** Retorna e zera o movimento acumulado da câmera. */
  consumeLook(): { dx: number; dy: number } {
    const result = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return result;
  }

  consumeWheel(): number {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  /** Limpa os estados de "pressionado neste quadro". Chamado no fim do quadro. */
  endFrame(): void {
    this.pressed.clear();
    this.touchPressed.clear();
    this.mousePressed = false;
  }

  /** Solta todas as teclas (ex.: ao abrir um menu ou trocar de aba). */
  reset(): void {
    this.keys.clear();
    this.pressed.clear();
    this.touchPressed.clear();
    this.touchHeld.clear();
    this.touchMove = { x: 0, y: 0 };
    this.touchRun = false;
    this.mouseHeld = false;
    this.mousePressed = false;
    this.dragging = false;
    this.lookDX = 0;
    this.lookDY = 0;
  }

  // ---------------------------------------------------------------------------
  // Métodos usados pelos controles de toque
  // ---------------------------------------------------------------------------

  setTouchMove(x: number, y: number, run: boolean): void {
    this.touchMove = { x, y };
    this.touchRun = run;
  }

  addLook(dx: number, dy: number): void {
    this.lookDX += dx;
    this.lookDY += dy;
  }

  pressTouch(action: InputAction): void {
    this.touchPressed.add(action);
  }

  setTouchHeld(action: InputAction, held: boolean): void {
    if (held) this.touchHeld.add(action);
    else this.touchHeld.delete(action);
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  // ---------------------------------------------------------------------------

  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    // Não captura teclas enquanto o jogador digita em campos de texto.
    if (target && (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text')) return;
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
    this.onKeyDown?.(e.code, e);
  }

  private listen(
    target: EventTarget,
    type: string,
    handler: (e: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.disposers.push(() => target.removeEventListener(type, handler, options));
  }

  /** Elemento de desenho associado (útil para o Pointer Lock). */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }
}
