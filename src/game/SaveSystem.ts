/**
 * Salvamento e carregamento do progresso.
 */
import { levelForXp } from './Progression';
import { validateSave, type SaveData, type SaveSummary } from './save/SaveData';
import type { StorageProvider } from './save/StorageProvider';

const DEFAULT_KEY = 'alem-do-horizonte:salvamento:1';

export class SaveSystem {
  /** Último erro ocorrido (exibido ao jogador se necessário). */
  lastError: string | null = null;

  constructor(
    private readonly provider: StorageProvider,
    private readonly key = DEFAULT_KEY,
  ) {}

  get persistent(): boolean {
    return this.provider.persistent;
  }

  async hasSave(): Promise<boolean> {
    return (await this.load()) !== null;
  }

  async load(): Promise<SaveData | null> {
    try {
      const raw = await this.provider.load(this.key);
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

  async save(data: SaveData): Promise<boolean> {
    try {
      await this.provider.save(this.key, JSON.stringify(data));
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = 'Não foi possível salvar o progresso.';
      console.warn('[SaveSystem] erro ao salvar', err);
      return false;
    }
  }

  async delete(): Promise<void> {
    await this.provider.remove(this.key);
  }

  async summary(): Promise<SaveSummary | null> {
    const data = await this.load();
    if (!data) return null;
    return {
      savedAt: data.savedAt,
      playTime: data.playTime,
      level: levelForXp(data.progression.xp),
      day: data.world.day,
      questsDone: data.quests.completed.length,
    };
  }
}
