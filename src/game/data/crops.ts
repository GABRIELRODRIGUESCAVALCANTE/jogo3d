/**
 * Plantas da horta. Cada uma nasce de uma semente (ou muda), leva um tempo
 * para crescer e dá uma colheita. Parte das sementes volta na colheita.
 */
import type { ItemId } from './items';

export type CropId = 'batata' | 'milho' | 'abacaxi';

export interface CropDef {
  id: CropId;
  seed: ItemId;
  produce: ItemId;
  amount: number;
  /** Chance de devolver uma semente a mais (sempre devolve uma). */
  extraSeedChance: number;
  /** Segundos de jogo até ficar pronta. */
  growSeconds: number;
  /** Texto da ação de colher. */
  harvestLabel: string;
}

export const CROPS: Record<CropId, CropDef> = {
  batata: {
    id: 'batata',
    seed: 'semente',
    produce: 'batata_doce',
    amount: 3,
    extraSeedChance: 0.4,
    growSeconds: 240,
    harvestLabel: 'Colher batatas-doces',
  },
  milho: {
    id: 'milho',
    seed: 'semente_milho',
    produce: 'milho',
    amount: 4,
    extraSeedChance: 0.5,
    growSeconds: 300,
    harvestLabel: 'Colher milho',
  },
  abacaxi: {
    id: 'abacaxi',
    seed: 'muda_abacaxi',
    produce: 'abacaxi',
    amount: 2,
    extraSeedChance: 0.2,
    growSeconds: 420,
    harvestLabel: 'Colher abacaxis',
  },
};

export const CROP_ORDER: CropId[] = ['batata', 'milho', 'abacaxi'];

export function isCropId(value: unknown): value is CropId {
  return typeof value === 'string' && value in CROPS;
}
