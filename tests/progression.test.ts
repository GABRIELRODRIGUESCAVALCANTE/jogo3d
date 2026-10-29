import { describe, expect, it } from 'vitest';
import { createEventBus } from '../src/game/events';
import { Progression, levelForXp, xpForLevel } from '../src/game/Progression';

describe('Progressão', () => {
  it('tabela de níveis é crescente', () => {
    for (let l = 1; l < 20; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(59)).toBe(1);
    expect(levelForXp(60)).toBe(2);
    expect(levelForXp(150)).toBe(3);
  });

  it('ganha níveis e aumenta a energia máxima', () => {
    const bus = createEventBus();
    const levels: number[] = [];
    bus.on('level:up', (e) => levels.push(e.level));
    const p = new Progression(bus);
    expect(p.addXP(70)).toBe(1);
    expect(p.level).toBe(2);
    expect(p.maxEnergy).toBe(110);
    p.addXP(100);
    expect(levels).toEqual([2, 3]);
    expect(p.progress).toBeGreaterThanOrEqual(0);
    expect(p.progress).toBeLessThan(1);
  });
});
