/**
 * Onde o progresso é guardado.
 *
 * O jogo conversa apenas com esta interface. Hoje usamos o localStorage do
 * navegador, mas no futuro basta criar outra classe (por exemplo, uma que
 * envia o salvamento para um servidor com contas de usuário) sem mudar o
 * resto do código. Os métodos são assíncronos justamente para permitir isso.
 */
import { isStorageAvailable, safeStorage } from '../../core/storage';

export interface StorageProvider {
  /** Identificador legível (ex.: "local", "nuvem"). */
  readonly id: string;
  /** Verdadeiro se os dados sobrevivem a um recarregamento da página. */
  readonly persistent: boolean;
  load(key: string): Promise<string | null>;
  save(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Salvamento local no navegador (localStorage, com reserva em memória). */
export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local';

  get persistent(): boolean {
    return isStorageAvailable();
  }

  async load(key: string): Promise<string | null> {
    return safeStorage.getItem(key);
  }

  async save(key: string, value: string): Promise<void> {
    safeStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    safeStorage.removeItem(key);
  }
}

/*
 * Exemplo de como seria um salvamento em nuvem no futuro (NÃO usado agora):
 *
 * export class CloudStorageProvider implements StorageProvider {
 *   readonly id = 'nuvem';
 *   readonly persistent = true;
 *   constructor(private apiUrl: string, private getToken: () => Promise<string>) {}
 *   async load(key: string) {
 *     const res = await fetch(`${this.apiUrl}/saves/${key}`, {
 *       headers: { Authorization: `Bearer ${await this.getToken()}` },
 *     });
 *     return res.ok ? await res.text() : null;
 *   }
 *   async save(key: string, value: string) { ...PUT... }
 *   async remove(key: string) { ...DELETE... }
 * }
 */
