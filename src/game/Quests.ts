/**
 * Sistema de missões.
 *
 * Objetivos de "contagem" (coletar, fabricar, usar) somam progresso a partir
 * do momento em que a missão fica ativa. Objetivos de "estado" (visitar,
 * construir, interagir, nível) são conferidos direto no mundo — assim, se o
 * jogador já abriu um baú antes de a missão começar, ela conta mesmo assim.
 */
import { ITEMS, type ItemBundle, type ItemId } from './data/items';
import { QUESTS, type ObjectiveDef, type QuestDef } from './data/quests';
import { getRegion, type RegionId } from './data/regions';
import { STRUCTURES, type StructureId } from './data/structures';
import type { GameEventBus } from './events';

export interface QuestContext {
  level(): number;
  isRegionDiscovered(id: RegionId): boolean;
  structureCount(type: StructureId): number;
  hasFlag(flag: string): boolean;
}

export interface QuestSaveState {
  active: string[];
  completed: string[];
  progress: Record<string, number[]>;
  tracked: string | null;
}

export interface ObjectiveStatus {
  text: string;
  current: number;
  required: number;
  done: boolean;
}

type CountType = 'collect' | 'craft' | 'use';

export class QuestSystem {
  active: string[] = [];
  readonly completed = new Set<string>();
  private progress: Record<string, number[]> = {};
  private trackedId: string | null = null;

  /** Chamado ao concluir uma missão para entregar as recompensas. */
  onReward: ((rewards: { xp: number; items?: ItemBundle }, quest: QuestDef) => void) | null = null;

  constructor(
    private readonly bus: GameEventBus,
    private readonly ctx: QuestContext,
    private readonly defs: QuestDef[] = QUESTS,
  ) {
    bus.on('resource:gathered', ({ itemId, amount }) => this.count('collect', itemId, amount));
    bus.on('item:crafted', ({ itemId, amount }) => this.count('craft', itemId, amount));
    bus.on('item:used', ({ itemId }) => this.count('use', itemId, 1));
    bus.on('structure:built', () => this.evaluateAll());
    bus.on('region:discovered', () => this.evaluateAll());
    bus.on('flag:set', () => this.evaluateAll());
    bus.on('level:up', () => this.evaluateAll());
  }

  /** Começa do zero (novo jogo). */
  reset(): void {
    this.active = [];
    this.completed.clear();
    this.progress = {};
    this.trackedId = null;
    this.activateAvailable(true);
    this.evaluateAll();
  }

  getDef(id: string): QuestDef | undefined {
    return this.defs.find((q) => q.id === id);
  }

  isCompleted(id: string): boolean {
    return this.completed.has(id);
  }

  get allCompleted(): boolean {
    return this.completed.size === this.defs.length;
  }

  get totalQuests(): number {
    return this.defs.length;
  }

  /** Missão exibida no HUD. */
  get tracked(): QuestDef | null {
    if (this.trackedId && this.active.includes(this.trackedId)) return this.getDef(this.trackedId) ?? null;
    const first = this.active[0];
    return first ? (this.getDef(first) ?? null) : null;
  }

  track(id: string): void {
    if (this.active.includes(id)) {
      this.trackedId = id;
      this.bus.emit('quest:progress', { questId: id });
    }
  }

  /** Lista de objetivos com progresso atual. */
  objectives(quest: QuestDef): ObjectiveStatus[] {
    return quest.objectives.map((obj, i) => this.objectiveStatus(quest, obj, i));
  }

  isQuestReady(quest: QuestDef): boolean {
    return this.objectives(quest).every((o) => o.done);
  }

  // ---------------------------------------------------------------------------

  private objectiveStatus(quest: QuestDef, obj: ObjectiveDef, index: number): ObjectiveStatus {
    const counter = this.progress[quest.id]?.[index] ?? 0;
    switch (obj.type) {
      case 'collect':
        return this.status(`Colete ${obj.amount} ${ITEMS[obj.item].name}`, counter, obj.amount);
      case 'craft':
        return this.status(`Fabrique: ${ITEMS[obj.item].name}`, counter, obj.amount);
      case 'use':
        return this.status(`Coma ${obj.amount} ${ITEMS[obj.item].name}`, counter, obj.amount);
      case 'build':
        return this.status(
          `Construa: ${STRUCTURES[obj.structure].name}`,
          this.ctx.structureCount(obj.structure),
          obj.amount,
        );
      case 'visit':
        return this.status(
          `Descubra: ${getRegion(obj.region).name}`,
          this.ctx.isRegionDiscovered(obj.region) ? 1 : 0,
          1,
        );
      case 'interact':
        return this.status(obj.label, this.ctx.hasFlag(obj.target) ? 1 : 0, 1);
      case 'level':
        return this.status(`Alcance o nível ${obj.level}`, this.ctx.level(), obj.level);
    }
  }

  private status(text: string, current: number, required: number): ObjectiveStatus {
    const c = Math.min(current, required);
    return { text, current: c, required, done: c >= required };
  }

  private count(type: CountType, item: ItemId, amount: number): void {
    let changedAny = false;
    for (const id of this.active) {
      const quest = this.getDef(id);
      if (!quest) continue;
      let changed = false;
      quest.objectives.forEach((obj, i) => {
        if (obj.type === type && obj.item === item) {
          const arr = (this.progress[id] ??= quest.objectives.map(() => 0));
          arr[i] = Math.min(obj.amount, (arr[i] ?? 0) + amount);
          changed = true;
        }
      });
      if (changed) {
        changedAny = true;
        this.bus.emit('quest:progress', { questId: id });
      }
    }
    if (changedAny) this.evaluateAll();
  }

  /** Confere todas as missões ativas e conclui as que estiverem prontas. */
  evaluateAll(): void {
    let guard = 0;
    let completedSomething = true;
    while (completedSomething && guard++ < 50) {
      completedSomething = false;
      for (const id of [...this.active]) {
        const quest = this.getDef(id);
        if (quest && this.isQuestReady(quest)) {
          this.complete(quest);
          completedSomething = true;
        }
      }
    }
  }

  private complete(quest: QuestDef): void {
    this.active = this.active.filter((id) => id !== quest.id);
    this.completed.add(quest.id);
    delete this.progress[quest.id];
    if (this.trackedId === quest.id) this.trackedId = null;
    this.onReward?.(quest.rewards, quest);
    this.bus.emit('quest:completed', { questId: quest.id });
    this.activateAvailable(false);
  }

  /** Ativa missões cujos pré-requisitos já foram concluídos. */
  private activateAvailable(silent: boolean): void {
    for (const quest of this.defs) {
      if (this.completed.has(quest.id) || this.active.includes(quest.id)) continue;
      if (quest.requires.every((r) => this.completed.has(r))) {
        this.active.push(quest.id);
        this.progress[quest.id] = quest.objectives.map(() => 0);
        if (!silent) this.bus.emit('quest:started', { questId: quest.id });
      }
    }
  }

  toJSON(): QuestSaveState {
    return {
      active: [...this.active],
      completed: [...this.completed],
      progress: structuredClone(this.progress),
      tracked: this.trackedId,
    };
  }

  load(data: QuestSaveState | undefined): void {
    if (!data) {
      this.reset();
      return;
    }
    this.completed.clear();
    for (const id of data.completed ?? []) if (this.getDef(id)) this.completed.add(id);
    this.active = (data.active ?? []).filter((id) => this.getDef(id) && !this.completed.has(id));
    this.progress = {};
    for (const id of this.active) {
      const quest = this.getDef(id)!;
      const saved = data.progress?.[id] ?? [];
      this.progress[id] = quest.objectives.map((_, i) => Number(saved[i]) || 0);
    }
    this.trackedId = data.tracked ?? null;
    // Missões novas adicionadas em versões futuras do jogo entram aqui.
    this.activateAvailable(true);
  }
}
