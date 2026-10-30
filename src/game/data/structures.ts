/**
 * Construções disponíveis no menu de construção.
 */
import type { ItemBundle } from './items';
import type { StationId } from './recipes';

export type StructureId =
  | 'fogueira'
  | 'bancada'
  | 'cabana'
  | 'cerca'
  | 'caminho'
  | 'lanterna'
  | 'bau'
  | 'canteiro'
  | 'piso'
  | 'parede'
  | 'parede_porta'
  | 'parede_janela'
  | 'telhado'
  | 'barco';

/**
 * Peças modulares se encaixam numa grade de 2 m:
 * - piso: ocupa uma célula;
 * - parede: fica na borda entre duas células;
 * - telhado: ocupa uma célula, apoiado no topo das paredes.
 */
export type ModularKind = 'piso' | 'parede' | 'telhado';

/** Tamanho da célula da grade de construção modular (metros). */
export const GRID = 2;
/** Altura das paredes modulares. */
export const WALL_HEIGHT = 2.6;

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
  /** Peça modular (encaixa na grade). */
  modular?: ModularKind;
  /** Categoria no menu de construção. */
  group: 'basico' | 'modular' | 'decoracao';
  /** Só pode ser construído depois de um marcador da história (ex.: farol aceso). */
  requiresFlag?: { flag: string; reason: string };
  /** Construído sobre a água (barco). */
  onWater?: boolean;
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
    group: 'basico',
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
    group: 'basico',
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
    group: 'basico',
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
    group: 'decoracao',
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
    group: 'decoracao',
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
    group: 'decoracao',
  },
  bau: {
    id: 'bau',
    name: 'Baú de Armazenamento',
    description: 'Guarde itens para liberar espaço e organizar seus recursos.',
    icon: 'bau',
    cost: { madeira: 10, corda: 2 },
    minLevel: 2,
    footprint: { w: 1.3, d: 0.9 },
    maxSlope: 0.8,
    xp: 15,
    solid: true,
    group: 'basico',
  },
  canteiro: {
    id: 'canteiro',
    name: 'Canteiro',
    description: 'Plante sementes e colha batatas-doces depois de alguns minutos.',
    icon: 'canteiro',
    cost: { madeira: 4, pedra: 2 },
    minLevel: 2,
    footprint: { w: 2, d: 2 },
    maxSlope: 0.7,
    xp: 12,
    solid: false,
    group: 'basico',
  },
  piso: {
    id: 'piso',
    name: 'Piso de Madeira',
    description: 'Base de 2×2 m. Paredes e telhados se encaixam nele.',
    icon: 'piso',
    cost: { madeira: 3 },
    minLevel: 2,
    footprint: { w: 2, d: 2 },
    maxSlope: 1.6,
    xp: 3,
    solid: true,
    modular: 'piso',
    group: 'modular',
  },
  parede: {
    id: 'parede',
    name: 'Parede',
    description: 'Parede de toras que se encaixa nas bordas da grade.',
    icon: 'parede',
    cost: { madeira: 4 },
    minLevel: 2,
    footprint: { w: 2, d: 0.3 },
    maxSlope: 1.6,
    xp: 3,
    solid: true,
    modular: 'parede',
    group: 'modular',
  },
  parede_porta: {
    id: 'parede_porta',
    name: 'Parede com Porta',
    description: 'Parede com uma passagem no meio.',
    icon: 'parede_porta',
    cost: { madeira: 3 },
    minLevel: 2,
    footprint: { w: 2, d: 0.3 },
    maxSlope: 1.6,
    xp: 3,
    solid: true,
    modular: 'parede',
    group: 'modular',
  },
  parede_janela: {
    id: 'parede_janela',
    name: 'Parede com Janela',
    description: 'Parede com uma janela para ver o mar.',
    icon: 'parede_janela',
    cost: { madeira: 3, corda: 1 },
    minLevel: 2,
    footprint: { w: 2, d: 0.3 },
    maxSlope: 1.6,
    xp: 3,
    solid: true,
    modular: 'parede',
    group: 'modular',
  },
  telhado: {
    id: 'telhado',
    name: 'Telhado de Palha',
    description: 'Cobre uma célula de 2×2 m. Precisa de paredes por perto para se apoiar.',
    icon: 'telhado',
    cost: { madeira: 2, fibra: 3 },
    minLevel: 2,
    footprint: { w: 2, d: 2 },
    maxSlope: 99,
    xp: 3,
    solid: true,
    modular: 'telhado',
    group: 'modular',
  },
  barco: {
    id: 'barco',
    name: 'Barco a Vela',
    description: 'Construa na água rasa, perto da praia. Embarque e navegue até outras ilhas.',
    icon: 'barco',
    cost: { madeira: 30, corda: 8, fibra: 12 },
    minLevel: 5,
    footprint: { w: 1.8, d: 4.4 },
    maxSlope: 99,
    xp: 60,
    limit: 2,
    solid: false,
    group: 'basico',
    requiresFlag: { flag: 'farol', reason: 'Disponível depois de acender o Farol dos Lumeni' },
    onWater: true,
  },
};

export const STRUCTURE_ORDER: StructureId[] = [
  'fogueira',
  'bancada',
  'cabana',
  'bau',
  'canteiro',
  'barco',
  'piso',
  'parede',
  'parede_porta',
  'parede_janela',
  'telhado',
  'cerca',
  'caminho',
  'lanterna',
];

export function isStructureId(value: string): value is StructureId {
  return value in STRUCTURES;
}
