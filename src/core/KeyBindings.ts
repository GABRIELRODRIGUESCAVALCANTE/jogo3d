/**
 * Teclas configuráveis. Cada ação tem uma tecla principal (que o jogador pode
 * trocar em Opções → Teclado) e, às vezes, teclas extras fixas (as setas
 * continuam andando, por exemplo). Esc é sempre o menu de pausa.
 */

export type BindableAction =
  | 'frente'
  | 'tras'
  | 'esquerda'
  | 'direita'
  | 'correr'
  | 'pular'
  | 'interagir'
  | 'girar'
  | 'tocha'
  | 'inventario'
  | 'fabricar'
  | 'construir'
  | 'mapa'
  | 'missoes';

/** Ordem e nomes exibidos no menu de opções. */
export const BINDABLE_ACTIONS: Array<{ id: BindableAction; label: string }> = [
  { id: 'frente', label: 'Andar para frente' },
  { id: 'tras', label: 'Andar para trás' },
  { id: 'esquerda', label: 'Andar para a esquerda' },
  { id: 'direita', label: 'Andar para a direita' },
  { id: 'correr', label: 'Correr' },
  { id: 'pular', label: 'Pular' },
  { id: 'interagir', label: 'Interagir / coletar' },
  { id: 'girar', label: 'Girar construção' },
  { id: 'tocha', label: 'Acender a tocha' },
  { id: 'inventario', label: 'Inventário' },
  { id: 'fabricar', label: 'Fabricação' },
  { id: 'construir', label: 'Construção' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'missoes', label: 'Missões' },
];

/** Teclas padrão: a primeira é a principal; as demais são extras fixas. */
export const DEFAULT_KEYS: Record<BindableAction, string[]> = {
  frente: ['KeyW', 'ArrowUp'],
  tras: ['KeyS', 'ArrowDown'],
  esquerda: ['KeyA', 'ArrowLeft'],
  direita: ['KeyD', 'ArrowRight'],
  correr: ['ShiftLeft', 'ShiftRight'],
  pular: ['Space'],
  interagir: ['KeyE'],
  girar: ['KeyR'],
  tocha: ['KeyT'],
  inventario: ['KeyI', 'Tab'],
  fabricar: ['KeyC'],
  construir: ['KeyB'],
  mapa: ['KeyM'],
  missoes: ['KeyJ', 'KeyL'],
};

/** Teclas que não podem ser usadas (Esc abre a pausa). */
export const RESERVED_KEYS = new Set(['Escape']);

export class KeyBindings {
  /** Tecla principal escolhida pelo jogador (ausente = padrão). */
  custom: Partial<Record<BindableAction, string>> = {};

  primary(action: BindableAction): string {
    return this.custom[action] ?? DEFAULT_KEYS[action][0];
  }

  /** Todas as teclas que acionam a ação. */
  keys(action: BindableAction): string[] {
    const extras = DEFAULT_KEYS[action].slice(1).filter((k) => !Object.values(this.custom).includes(k) || k === this.custom[action]);
    return [this.primary(action), ...extras];
  }

  matches(action: BindableAction, code: string): boolean {
    return this.keys(action).includes(code);
  }

  /** Troca a tecla de uma ação. Se outra ação usava a tecla, elas trocam entre si. */
  set(action: BindableAction, code: string): void {
    if (RESERVED_KEYS.has(code)) return;
    const previous = this.primary(action);
    for (const other of Object.keys(DEFAULT_KEYS) as BindableAction[]) {
      if (other !== action && this.primary(other) === code) this.custom[other] = previous;
    }
    this.custom[action] = code;
    this.clean();
  }

  reset(): void {
    this.custom = {};
  }

  /** Remove entradas iguais ao padrão (mantém o salvamento das opções enxuto). */
  private clean(): void {
    for (const [action, code] of Object.entries(this.custom) as Array<[BindableAction, string]>) {
      if (code === DEFAULT_KEYS[action][0]) delete this.custom[action];
    }
  }
}

/** Nome amigável de uma tecla (ex.: "KeyW" → "W", "Space" → "Espaço"). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const names: Record<string, string> = {
    Space: 'Espaço',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift dir.',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl dir.',
    AltLeft: 'Alt',
    AltRight: 'Alt dir.',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: '⌫',
    CapsLock: 'Caps',
    Escape: 'Esc',
  };
  return names[code] ?? code;
}
