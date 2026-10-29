import { describe, expect, it } from 'vitest';
import { createEventBus } from '../src/game/events';
import { QuestSystem } from '../src/game/Quests';
import type { RegionId } from '../src/game/data/regions';

function setup() {
  const bus = createEventBus();
  const flags = new Set<string>();
  const regions = new Set<RegionId>();
  const structures: Record<string, number> = {};
  const rewards: number[] = [];
  const quests = new QuestSystem(bus, {
    level: () => 1,
    isRegionDiscovered: (id) => regions.has(id),
    structureCount: (t) => structures[t] ?? 0,
    hasFlag: (f) => flags.has(f),
  });
  quests.onReward = (r) => rewards.push(r.xp);
  quests.reset();
  return { bus, flags, regions, structures, rewards, quests };
}

describe('Missões', () => {
  it('começa com as primeiras missões ativas', () => {
    const { quests } = setup();
    expect(quests.active).toEqual(['q_madeira', 'q_bau']);
    expect(quests.tracked?.id).toBe('q_madeira');
  });

  it('conta coletas e libera as próximas missões', () => {
    const { bus, quests, rewards } = setup();
    bus.emit('resource:gathered', { itemId: 'madeira', amount: 3 });
    expect(quests.objectives(quests.getDef('q_madeira')!)[0].current).toBe(3);
    bus.emit('resource:gathered', { itemId: 'madeira', amount: 2 });
    expect(quests.isCompleted('q_madeira')).toBe(true);
    expect(rewards).toEqual([30]);
    expect(quests.active).toContain('q_recursos');
    expect(quests.active).toContain('q_frutas');
  });

  it('objetivos de estado contam mesmo se feitos antes', () => {
    const { bus, flags, quests } = setup();
    flags.add('bau_praia');
    flags.add('monolito');
    bus.emit('flag:set', { flag: 'bau_praia' });
    expect(quests.isCompleted('q_bau')).toBe(true);
    // q_ruinas precisa visitar a região e do monólito: o monólito já foi lido.
    const ruinas = quests.getDef('q_ruinas')!;
    expect(quests.objectives(ruinas).map((o) => o.done)).toEqual([false, true]);
  });

  it('salva e carrega o progresso', () => {
    const { bus, quests } = setup();
    bus.emit('resource:gathered', { itemId: 'madeira', amount: 2 });
    const saved = quests.toJSON();
    const other = setup();
    other.quests.load(saved);
    expect(other.quests.objectives(other.quests.getDef('q_madeira')!)[0].current).toBe(2);
    expect(other.quests.active).toEqual(quests.active);
  });
});
