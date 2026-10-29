import { describe, expect, it } from 'vitest';
import { createEventBus } from '../src/game/events';
import { Inventory } from '../src/game/Inventory';

describe('Inventário', () => {
  it('adiciona e remove itens, avisando por evento', () => {
    const bus = createEventBus();
    const events: number[] = [];
    bus.on('inventory:changed', (e) => events.push(e.total));
    const inv = new Inventory(bus);
    inv.add('madeira', 3);
    inv.add('madeira', 2);
    expect(inv.count('madeira')).toBe(5);
    expect(inv.remove('madeira', 4)).toBe(true);
    expect(inv.count('madeira')).toBe(1);
    expect(events).toEqual([3, 5, 1]);
  });

  it('não remove quando não há o suficiente', () => {
    const inv = new Inventory();
    inv.add('pedra', 1);
    expect(inv.remove('pedra', 2)).toBe(false);
    expect(inv.count('pedra')).toBe(1);
  });

  it('paga custos completos ou nada', () => {
    const inv = new Inventory();
    inv.addAll({ madeira: 3, pedra: 1 });
    expect(inv.hasAll({ madeira: 3, pedra: 2 })).toBe(false);
    expect(inv.missing({ madeira: 3, pedra: 2 })).toEqual({ pedra: 1 });
    expect(inv.removeAll({ madeira: 3, pedra: 2 })).toBe(false);
    expect(inv.count('madeira')).toBe(3);
    expect(inv.removeAll({ madeira: 2, pedra: 1 })).toBe(true);
    expect(inv.toJSON()).toEqual({ madeira: 1 });
  });

  it('ferramentas são únicas', () => {
    const inv = new Inventory();
    expect(inv.add('machado', 3)).toBe(1);
    expect(inv.add('machado')).toBe(0);
    expect(inv.count('machado')).toBe(1);
  });

  it('ignora dados salvos inválidos', () => {
    const inv = new Inventory();
    inv.load({ madeira: 4, inexistente: 9, pedra: -2, fibra: Number.NaN, cristal: 2.7 });
    expect(inv.toJSON()).toEqual({ madeira: 4, cristal: 2 });
  });
});
