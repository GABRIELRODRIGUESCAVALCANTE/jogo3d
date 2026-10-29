/**
 * Definição de todos os itens do jogo.
 * Para criar um item novo, adicione o id em `ItemId` e uma entrada em `ITEMS`.
 */

export type ItemId =
  | 'madeira'
  | 'pedra'
  | 'fibra'
  | 'fruta'
  | 'fruta_assada'
  | 'cristal'
  | 'reliquia'
  | 'corda'
  | 'machado'
  | 'picareta'
  | 'tocha';

export type ItemCategory = 'recurso' | 'material' | 'ferramenta' | 'comida' | 'especial';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  category: ItemCategory;
  /** Nome do ícone em `src/ui/icons.ts`. */
  icon: string;
  /** Ferramentas são permanentes: basta ter uma. */
  tool?: boolean;
  /** Itens comestíveis restauram energia. */
  food?: { energy: number; buffSeconds?: number };
}

/** Conjunto de itens com quantidades (custos, recompensas...). */
export type ItemBundle = Partial<Record<ItemId, number>>;

export const ITEMS: Record<ItemId, ItemDef> = {
  madeira: {
    id: 'madeira',
    name: 'Madeira',
    description: 'Toras cortadas das árvores. Base de quase toda construção.',
    category: 'recurso',
    icon: 'madeira',
  },
  pedra: {
    id: 'pedra',
    name: 'Pedra',
    description: 'Pedras resistentes, ótimas para ferramentas e fundações.',
    category: 'recurso',
    icon: 'pedra',
  },
  fibra: {
    id: 'fibra',
    name: 'Fibra',
    description: 'Fibras vegetais do capim alto. Podem ser trançadas em cordas.',
    category: 'recurso',
    icon: 'fibra',
  },
  fruta: {
    id: 'fruta',
    name: 'Fruta',
    description: 'Fruta tropical suculenta. Restaura um pouco de energia.',
    category: 'comida',
    icon: 'fruta',
    food: { energy: 30 },
  },
  fruta_assada: {
    id: 'fruta_assada',
    name: 'Fruta Assada',
    description: 'Assada na fogueira. Restaura muita energia e deixa você "Bem alimentado".',
    category: 'comida',
    icon: 'fruta_assada',
    food: { energy: 70, buffSeconds: 120 },
  },
  cristal: {
    id: 'cristal',
    name: 'Cristal',
    description: 'Cristal luminoso que pulsa com uma energia antiga.',
    category: 'recurso',
    icon: 'cristal',
  },
  reliquia: {
    id: 'reliquia',
    name: 'Fragmento Antigo',
    description: 'Pedaço de uma placa gravada pelos Lumeni, a civilização desaparecida.',
    category: 'especial',
    icon: 'reliquia',
  },
  corda: {
    id: 'corda',
    name: 'Corda',
    description: 'Fibras trançadas. Prendem cabos de ferramentas e vigas.',
    category: 'material',
    icon: 'corda',
  },
  machado: {
    id: 'machado',
    name: 'Machado de Pedra',
    description: 'Corta árvores mais rápido: o dobro de madeira por golpe.',
    category: 'ferramenta',
    icon: 'machado',
    tool: true,
  },
  picareta: {
    id: 'picareta',
    name: 'Picareta de Pedra',
    description: 'Quebra rochas com eficiência e permite minerar cristais.',
    category: 'ferramenta',
    icon: 'picareta',
    tool: true,
  },
  tocha: {
    id: 'tocha',
    name: 'Tocha',
    description: 'Ilumina o caminho à noite e nas cavernas. Acenda com a tecla T.',
    category: 'ferramenta',
    icon: 'tocha',
    tool: true,
  },
};

/** Ordem de exibição no inventário. */
export const ITEM_ORDER: ItemId[] = [
  'madeira',
  'pedra',
  'fibra',
  'fruta',
  'cristal',
  'corda',
  'fruta_assada',
  'reliquia',
  'machado',
  'picareta',
  'tocha',
];

/** Recursos sempre visíveis na barra inferior do HUD. */
export const HUD_RESOURCES: ItemId[] = ['madeira', 'pedra', 'fibra', 'fruta', 'cristal'];

export function isItemId(value: string): value is ItemId {
  return value in ITEMS;
}
