/**
 * Acesso seguro ao localStorage.
 * Em modo privado, iframes restritos ou com cookies bloqueados o navegador
 * pode lançar erros ao acessar o localStorage. Aqui caímos para a memória.
 */
const memory = new Map<string, string>();
let available: boolean | null = null;

export function isStorageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const key = '__adh_teste__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (isStorageAvailable()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        /* cai para a memória */
      }
    }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): boolean {
    if (isStorageAvailable()) {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch {
        /* cota cheia ou bloqueado */
      }
    }
    memory.set(key, value);
    return false;
  },
  removeItem(key: string): void {
    if (isStorageAvailable()) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignorado */
      }
    }
    memory.delete(key);
  },
};
