/**
 * Salvamento e carregamento do progresso, com 3 espaços (slots) e
 * exportação/importação para levar o jogo de um aparelho a outro.
 */
import { levelForXp } from './Progression';
import { validateSave, type SaveData, type SaveSummary } from './save/SaveData';
import type { StorageProvider } from './save/StorageProvider';

const KEY_PREFIX = 'alem-do-horizonte:salvamento:';
const LAST_SLOT_KEY = 'alem-do-horizonte:ultimo-espaco';

/** Número de espaços de salvamento. */
export const SLOT_COUNT = 3;

export class SaveSystem {
  /** Último erro ocorrido (exibido ao jogador se necessário). */
  lastError: string | null = null;
  /** Espaço em uso (1 a 3). */
  slot = 1;

  constructor(
    private readonly provider: StorageProvider,
    private readonly prefix = KEY_PREFIX,
  ) {}

  get persistent(): boolean {
    return this.provider.persistent;
  }

  private key(slot: number): string {
    return `${this.prefix}${slot}`;
  }

  /** Lembra qual espaço foi usado por último (para o botão "Continuar"). */
  async restoreLastSlot(): Promise<void> {
    const saved = Number(await this.provider.load(LAST_SLOT_KEY));
    if (saved >= 1 && saved <= SLOT_COUNT) this.slot = saved;
  }

  async useSlot(slot: number): Promise<void> {
    this.slot = slot;
    await this.provider.save(LAST_SLOT_KEY, String(slot));
  }

  async hasSave(slot = this.slot): Promise<boolean> {
    return (await this.load(slot)) !== null;
  }

  async load(slot = this.slot): Promise<SaveData | null> {
    try {
      const raw = await this.provider.load(this.key(slot));
      if (!raw) return null;
      const data = validateSave(JSON.parse(raw));
      if (!data) {
        this.lastError = 'O salvamento está corrompido ou incompleto.';
        console.warn('[SaveSystem]', this.lastError);
      }
      return data;
    } catch (err) {
      this.lastError = 'Não foi possível ler o salvamento.';
      console.warn('[SaveSystem] erro ao carregar', err);
      return null;
    }
  }

  async save(data: SaveData, slot = this.slot): Promise<boolean> {
    try {
      await this.provider.save(this.key(slot), JSON.stringify(data));
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = 'Não foi possível salvar o progresso.';
      console.warn('[SaveSystem] erro ao salvar', err);
      return false;
    }
  }

  async delete(slot = this.slot): Promise<void> {
    await this.provider.remove(this.key(slot));
  }

  async summary(slot = this.slot): Promise<SaveSummary | null> {
    const data = await this.load(slot);
    if (!data) return null;
    return {
      savedAt: data.savedAt,
      playTime: data.playTime,
      level: levelForXp(data.progression.xp),
      day: data.world.day,
      questsDone: data.quests.completed.length,
    };
  }

  /** Resumo dos 3 espaços (null = vazio). */
  async summaries(): Promise<Array<SaveSummary | null>> {
    const out: Array<SaveSummary | null> = [];
    for (let slot = 1; slot <= SLOT_COUNT; slot++) out.push(await this.summary(slot));
    return out;
  }

  /** Texto do salvamento para baixar como arquivo (ou null se vazio). */
  async exportText(slot = this.slot): Promise<string | null> {
    const data = await this.load(slot);
    return data ? JSON.stringify({ jogo: 'Além do Horizonte', ...data }, null, 2) : null;
  }

  /** Grava um salvamento vindo de um arquivo. Retorna o motivo se for inválido. */
  async importText(text: string, slot = this.slot): Promise<string | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return 'O arquivo não é um salvamento válido.';
    }
    const data = validateSave(parsed);
    if (!data) return 'O arquivo não é um salvamento do Além do Horizonte ou está corrompido.';
    return (await this.save(data, slot)) ? null : (this.lastError ?? 'Não foi possível gravar o salvamento.');
  }
}
