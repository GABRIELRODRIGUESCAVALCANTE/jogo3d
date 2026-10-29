import { describe, expect, it } from 'vitest';
import { CraftingSystem, checkRecipe } from '../src/game/Crafting';
import { getRecipe } from '../src/game/data/recipes';
import { createEventBus } from '../src/game/events';
import { Inventory } from '../src/game/Inventory';

function setup(level = 1, near = false) {
  const bus = createEventBus();
  const inv = new Inventory(bus);
  const crafted: string[] = [];
  bus.on('item:crafted', (e) => crafted.push(e.itemId));
  const crafting = new CraftingSystem(bus, () => ({ inventory: inv, level, isNearStation: () => near }));
  return { inv, crafting, crafted };
}

describe('Fabricação', () => {
  it('fabrica corda consumindo fibras', () => {
    const { inv, crafting, crafted } = setup();
    inv.add('fibra', 4);
    expect(crafting.craft('corda').ok).toBe(true);
    expect(inv.count('fibra')).toBe(1);
    expect(inv.count('corda')).toBe(1);
    expect(crafted).toEqual(['corda']);
  });

  it('explica por que não pode fabricar', () => {
    const { inv, crafting } = setup(1, false);
    expect(crafting.check('machado').reason).toBe('Materiais insuficientes');
    inv.addAll({ madeira: 10, pedra: 10, corda: 5 });
    expect(crafting.check('picareta').reason).toBe('Requer nível 3');
    const recipe = getRecipe('picareta')!;
    expect(checkRecipe(recipe, { inventory: inv, level: 3, isNearStation: () => false }).reason).toContain('Bancada');
    expect(checkRecipe(recipe, { inventory: inv, level: 3, isNearStation: () => true }).ok).toBe(true);
  });

  it('não fabrica ferramenta repetida', () => {
    const { inv, crafting } = setup();
    inv.addAll({ madeira: 10, pedra: 10, corda: 5, machado: 1 });
    expect(crafting.craft('machado').ok).toBe(false);
    expect(inv.count('madeira')).toBe(10);
  });
});
