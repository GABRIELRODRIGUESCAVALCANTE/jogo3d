/**
 * Receitas de fabricação.
 * `station` indica que é preciso estar perto de uma construção (bancada ou fogueira).
 */
import type { ItemBundle, ItemId } from './items';

export type StationId = 'bancada' | 'fogueira';

export interface RecipeDef {
  id: string;
  result: ItemId;
  amount: number;
  cost: ItemBundle;
  station?: StationId;
  minLevel?: number;
  xp: number;
}

export const STATION_NAMES: Record<StationId, string> = {
  bancada: 'Bancada de Trabalho',
  fogueira: 'Fogueira',
};

export const RECIPES: RecipeDef[] = [
  { id: 'corda', result: 'corda', amount: 1, cost: { fibra: 3 }, xp: 5 },
  { id: 'machado', result: 'machado', amount: 1, cost: { madeira: 3, pedra: 2, corda: 1 }, xp: 15 },
  { id: 'tocha', result: 'tocha', amount: 1, cost: { madeira: 2, fibra: 2 }, xp: 8 },
  {
    id: 'picareta',
    result: 'picareta',
    amount: 1,
    cost: { madeira: 4, pedra: 4, corda: 2 },
    station: 'bancada',
    minLevel: 3,
    xp: 25,
  },
  { id: 'fruta_assada', result: 'fruta_assada', amount: 1, cost: { fruta: 2 }, station: 'fogueira', xp: 4 },
];

export function getRecipe(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}
