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
  { id: 'vara_de_pesca', result: 'vara_de_pesca', amount: 1, cost: { madeira: 2, corda: 1, fibra: 2 }, xp: 10 },
  { id: 'peixe_assado', result: 'peixe_assado', amount: 1, cost: { peixe: 1 }, station: 'fogueira', xp: 4 },
  { id: 'batata_assada', result: 'batata_assada', amount: 1, cost: { batata_doce: 2 }, station: 'fogueira', xp: 4 },
  { id: 'milho_assado', result: 'milho_assado', amount: 1, cost: { milho: 1 }, station: 'fogueira', xp: 4 },
  { id: 'salada_tropical', result: 'salada_tropical', amount: 1, cost: { fruta: 2, abacaxi: 1 }, xp: 6 },
  {
    id: 'ensopado',
    result: 'ensopado',
    amount: 1,
    cost: { peixe: 1, batata_doce: 1, milho: 1 },
    station: 'fogueira',
    minLevel: 4,
    xp: 12,
  },
  { id: 'dourado_grelhado', result: 'dourado_grelhado', amount: 1, cost: { peixe_dourado: 1 }, station: 'fogueira', xp: 10 },
];

export function getRecipe(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}
