/**
 * Fabricação de itens a partir de receitas.
 */
import { ITEMS, type ItemBundle } from './data/items';
import { RECIPES, STATION_NAMES, getRecipe, type RecipeDef, type StationId } from './data/recipes';
import type { GameEventBus } from './events';
import type { Inventory } from './Inventory';

export interface CraftContext {
  inventory: Inventory;
  level: number;
  /** Informa se o jogador está perto de uma estação (bancada, fogueira). */
  isNearStation: (station: StationId) => boolean;
}

export interface RecipeCheck {
  ok: boolean;
  reason?: string;
  missing: ItemBundle;
}

/** Verifica se uma receita pode ser fabricada agora e explica o motivo se não. */
export function checkRecipe(recipe: RecipeDef, ctx: CraftContext): RecipeCheck {
  const missing = ctx.inventory.missing(recipe.cost);
  const result = ITEMS[recipe.result];
  if (result.tool && ctx.inventory.has(recipe.result)) {
    return { ok: false, reason: 'Você já possui esta ferramenta', missing };
  }
  if (recipe.minLevel && ctx.level < recipe.minLevel) {
    return { ok: false, reason: `Requer nível ${recipe.minLevel}`, missing };
  }
  if (recipe.station && !ctx.isNearStation(recipe.station)) {
    return { ok: false, reason: `Fique perto de: ${STATION_NAMES[recipe.station]}`, missing };
  }
  if (Object.keys(missing).length > 0) {
    return { ok: false, reason: 'Materiais insuficientes', missing };
  }
  return { ok: true, missing };
}

export class CraftingSystem {
  constructor(
    private readonly bus: GameEventBus,
    private readonly getContext: () => CraftContext,
  ) {}

  get recipes(): RecipeDef[] {
    return RECIPES;
  }

  check(recipeId: string): RecipeCheck {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { ok: false, reason: 'Receita desconhecida', missing: {} };
    return checkRecipe(recipe, this.getContext());
  }

  /** Fabrica o item: consome os materiais e adiciona o resultado. */
  craft(recipeId: string): RecipeCheck {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { ok: false, reason: 'Receita desconhecida', missing: {} };
    const ctx = this.getContext();
    const check = checkRecipe(recipe, ctx);
    if (!check.ok) return check;
    ctx.inventory.removeAll(recipe.cost);
    ctx.inventory.add(recipe.result, recipe.amount);
    this.bus.emit('item:crafted', { itemId: recipe.result, amount: recipe.amount });
    return check;
  }
}
