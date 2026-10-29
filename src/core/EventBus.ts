/**
 * Barramento de eventos tipado.
 * Os sistemas do jogo conversam por eventos em vez de dependerem diretamente
 * uns dos outros. Ex.: o inventário avisa "item adicionado" e as missões,
 * o HUD e o áudio reagem — sem que o inventário conheça nenhum deles.
 */
export class EventBus<Events extends object> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Registra um ouvinte. Retorna uma função para cancelar o registro. */
  on<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as (payload: never) => void);
    return () => set?.delete(listener as (payload: never) => void);
  }

  /** Dispara um evento para todos os ouvintes registrados. */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as (p: Events[K]) => void)(payload);
      } catch (err) {
        // Um ouvinte com erro não deve derrubar os outros.
        console.error(`[EventBus] erro no ouvinte de "${String(type)}"`, err);
      }
    }
  }

  /** Remove todos os ouvintes (útil ao reiniciar o jogo). */
  clear(): void {
    this.listeners.clear();
  }
}
