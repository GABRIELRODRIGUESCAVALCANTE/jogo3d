/**
 * Construções disponíveis no menu de construção.
 */
import type { ItemBundle } from './items';
import type { StationId } from './recipes';

export type StructureId = 'fogueira' | 'bancada' | 'cabana' | 'cerca' | 'caminho' | 'lanterna';

export interface StructureDef {
  id: StructureId;
  name: string;
  description: string;
  icon: string;
  cost: ItemBundle;
  minLevel: number;
  /** Tamanho da base em metros (largura x profundidade). */
  footprint: { w: number; d: number };
  /** Diferença máxima de altura do terreno sob a base. */
  maxSlope: number;
  xp: number;
  /** Funciona como estação de fabricação. */
  station?: StationId;
  /** Quantidade máxima permitida no mundo. */
  limit?: number;
  /** Emite luz à noite. */
  light?: { color: number; intensity: number; distance: number; height: number; flicker: boolean };
  /** Possui colisão (o jogador não atravessa). */
  solid: boolean;
}

export const STRUCTURES: Record<StructureId, StructureDef> = {
  fogueira: {
    id: 'fogueira',
    name: 'Fogueira',
    description: 'Ilumina a noite e permite assar frutas.',
    icon: 'fogueira',
    cost: { madeira: 5, pedra: 3 },
    minLevel: 1,
    footprint: { w: 1.8, d: 1.8 },
    maxSlope: 0.9,
    xp: 20,
    station: 'fogueira',
    light: { color: 0xff8a3d, intensity: 18, distance: 16, height: 1.1, flicker: true },
    solid: true,
  },
  bancada: {
    id: 'bancada',
    name: 'Bancada de Trabalho',
    description: 'Permite fabricar ferramentas avançadas, como a picareta.',
    icon: 'bancada',
    cost: { madeira: 8, pedra: 4 },
    minLevel: 1,
    footprint: { w: 2.2, d: 1.2 },
    maxSlope: 0.8,
    xp: 30,
    station: 'bancada',
    solid: true,
  },
  cabana: {
    id: 'cabana',
    name: 'Cabana',
    description: 'Seu lar na ilha. Tem uma cama para descansar e dormir até o amanhecer.',
    icon: 'cabana',
    cost: { madeira: 30, pedra: 12, corda: 4 },
    minLevel: 2,
    footprint: { w: 6.4, d: 5.4 },
    maxSlope: 1.6,
    xp: 80,
    limit: 3,
    solid: true,
  },
  cerca: {
    id: 'cerca',
    name: 'Cerca',
    description: 'Um trecho de cerca de madeira para delimitar seu terreno.',
    icon: 'cerca',
    cost: { madeira: 3 },
    minLevel: 1,
    footprint: { w: 2.4, d: 0.4 },
    maxSlope: 1.2,
    xp: 4,
    solid: true,
  },
  caminho: {
    id: 'caminho',
    name: 'Caminho de Pedra',
    description: 'Placas de pedra para marcar trilhas.',
    icon: 'caminho',
    cost: { pedra: 2 },
    minLevel: 1,
    footprint: { w: 2, d: 2 },
    maxSlope: 0.6,
    xp: 3,
    solid: false,
  },
  lanterna: {
    id: 'lanterna',
    name: 'Lanterna de Cristal',
    description: 'Um poste com um cristal que brilha durante a noite.',
    icon: 'lanterna',
    cost: { madeira: 2, cristal: 1 },
    minLevel: 4,
    footprint: { w: 0.8, d: 0.8 },
    maxSlope: 1,
    xp: 12,
    light: { color: 0x7ff3ff, intensity: 14, distance: 14, height: 2.5, flicker: false },
    solid: true,
  },
};

export const STRUCTURE_ORDER: StructureId[] = ['fogueira', 'bancada', 'cabana', 'cerca', 'caminho', 'lanterna'];

export function isStructureId(value: string): value is StructureId {
  return value in STRUCTURES;
}
