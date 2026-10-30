import { describe, expect, it } from 'vitest';
import { SaveSystem } from '../src/game/SaveSystem';
import { SAVE_VERSION, validateSave, type SaveData } from '../src/game/save/SaveData';
import type { StorageProvider } from '../src/game/save/StorageProvider';
import { WorldState } from '../src/game/WorldState';
import { createEventBus } from '../src/game/events';

class MemoryProvider implements StorageProvider {
  readonly id = 'memoria';
  readonly persistent = true;
  data = new Map<string, string>();
  async load(key: string) {
    return this.data.get(key) ?? null;
  }
  async save(key: string, value: string) {
    this.data.set(key, value);
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}

function sample(): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: 1000,
    playTime: 321,
    player: { x: 1, y: 2, z: 3, yaw: 0.5, energy: 80, torch: true, buffTime: 0, hunger: 64 },
    inventory: { madeira: 12, machado: 1 },
    durability: { machado: 40 },
    progression: { xp: 160 },
    quests: { active: ['q_recursos'], completed: ['q_madeira'], progress: { q_recursos: [1, 2] }, tracked: null },
    structures: [
      { id: 'cabana_1', type: 'cabana', x: 30, z: 60, rot: 0 },
      { id: 'bau_1', type: 'bau', x: 34, z: 60, rot: 0, data: { madeira: 5 } },
      { id: 'parede_1', type: 'parede', x: 31, z: 64, rot: 0, y: 6.2 },
    ],
    world: { time: 13.5, day: 2, flags: ['bau_praia'], regions: ['praia'], explored: '', nodes: { arvore_1: { r: 0, t: 500 } } },
    stats: { gathered: 20, crafted: 2, built: 1 },
  };
}

describe('Salvamento', () => {
  it('salva, carrega e apaga', async () => {
    const provider = new MemoryProvider();
    const saves = new SaveSystem(provider);
    expect(await saves.hasSave()).toBe(false);
    await saves.save(sample());
    const loaded = await saves.load();
    expect(loaded).toEqual(sample());
    const summary = await saves.summary();
    expect(summary).toMatchObject({ level: 3, day: 2, questsDone: 1, playTime: 321 });
    await saves.delete();
    expect(await saves.hasSave()).toBe(false);
  });

  it('rejeita dados corrompidos sem travar', async () => {
    const provider = new MemoryProvider();
    provider.data.set('alem-do-horizonte:salvamento:1', '{isso não é json');
    const saves = new SaveSystem(provider);
    expect(await saves.load()).toBeNull();
    expect(saves.lastError).toBeTruthy();
    expect(validateSave({ player: { x: 'a' } })).toBeNull();
    expect(validateSave(null)).toBeNull();
  });

  it('migra salvamentos antigos (versão 0 e 1)', () => {
    const old = { ...sample(), version: 0 } as Record<string, unknown>;
    delete old.stats;
    delete old.durability;
    const data = validateSave(old);
    expect(data?.version).toBe(SAVE_VERSION);
    expect(data?.stats).toEqual({ gathered: 0, crafted: 0, built: 0 });
    expect(data?.player.hunger).toBe(100);
    expect(data?.durability).toEqual({});
  });

  it('mapa explorado sobrevive à conversão em texto', () => {
    const ws = new WorldState(createEventBus());
    ws.reveal(10, 20, 30);
    ws.reveal(-100, -50, 12);
    const text = ws.exploredToBase64();
    const copy = new WorldState(createEventBus());
    copy.exploredFromBase64(text);
    expect([...copy.explored]).toEqual([...ws.explored]);
    expect(copy.isExplored(10, 20)).toBe(true);
    expect(copy.isExplored(150, 150)).toBe(false);
  });
});
