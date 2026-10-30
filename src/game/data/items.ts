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
  | 'tocha'
  | 'vara_de_pesca'
  | 'peixe'
  | 'peixe_assado'
  | 'semente'
  | 'batata_doce'
  | 'batata_assada'
  | 'semente_milho'
  | 'milho'
  | 'milho_assado'
  | 'muda_abacaxi'
  | 'abacaxi'
  | 'salada_tropical'
  | 'ensopado'
  | 'peixe_dourado'
  | 'dourado_grelhado';

export type ItemCategory = 'recurso' | 'material' | 'ferramenta' | 'comida' | 'especial';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  category: ItemCategory;
  /** Nome do ícone em `src/ui/icons.ts`. */
  icon: string;
  /** Ferramentas: o jogador tem no máximo uma de cada. */
  tool?: boolean;
  /**
   * Durabilidade da ferramenta: quantos usos ela aguenta (a tocha, quantos
   * segundos fica acesa). Ao chegar a zero, ela quebra.
   */
  durability?: number;
  /** Comida: restaura energia e mata a fome (saciedade). */
  food?: { energy: number; hunger: number; buffSeconds?: number };
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
    food: { energy: 30, hunger: 18 },
  },
  fruta_assada: {
    id: 'fruta_assada',
    name: 'Fruta Assada',
    description: 'Assada na fogueira. Restaura muita energia e deixa você "Bem alimentado".',
    category: 'comida',
    icon: 'fruta_assada',
    food: { energy: 70, hunger: 40, buffSeconds: 120 },
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
    description: 'Corta árvores mais rápido: o dobro de madeira por golpe. Desgasta com o uso.',
    category: 'ferramenta',
    icon: 'machado',
    tool: true,
    durability: 80,
  },
  picareta: {
    id: 'picareta',
    name: 'Picareta de Pedra',
    description: 'Quebra rochas com eficiência e permite minerar cristais. Desgasta com o uso.',
    category: 'ferramenta',
    icon: 'picareta',
    tool: true,
    durability: 80,
  },
  tocha: {
    id: 'tocha',
    name: 'Tocha',
    description: 'Ilumina o caminho à noite e nas cavernas. Acenda com a tecla T. Queima enquanto acesa.',
    category: 'ferramenta',
    icon: 'tocha',
    tool: true,
    durability: 420,
  },
  vara_de_pesca: {
    id: 'vara_de_pesca',
    name: 'Vara de Pesca',
    description: 'Fique na beira da água perto de um cardume e interaja para pescar.',
    category: 'ferramenta',
    icon: 'vara_de_pesca',
    tool: true,
    durability: 40,
  },
  peixe: {
    id: 'peixe',
    name: 'Peixe',
    description: 'Peixe fresco. Melhor ainda se assado na fogueira.',
    category: 'comida',
    icon: 'peixe',
    food: { energy: 15, hunger: 15 },
  },
  peixe_assado: {
    id: 'peixe_assado',
    name: 'Peixe Assado',
    description: 'Uma refeição de verdade: mata a fome e deixa você "Bem alimentado".',
    category: 'comida',
    icon: 'peixe_assado',
    food: { energy: 60, hunger: 55, buffSeconds: 150 },
  },
  semente: {
    id: 'semente',
    name: 'Semente',
    description: 'Encontrada no capim alto. Plante num canteiro para colher batatas-doces.',
    category: 'recurso',
    icon: 'semente',
  },
  batata_doce: {
    id: 'batata_doce',
    name: 'Batata-doce',
    description: 'Colhida na horta. Crua mata pouco a fome; assada é deliciosa.',
    category: 'comida',
    icon: 'batata_doce',
    food: { energy: 10, hunger: 15 },
  },
  batata_assada: {
    id: 'batata_assada',
    name: 'Batata Assada',
    description: 'Assada na fogueira: muito nutritiva.',
    category: 'comida',
    icon: 'batata_assada',
    food: { energy: 45, hunger: 45 },
  },
  semente_milho: {
    id: 'semente_milho',
    name: 'Semente de Milho',
    description: 'Grãos secos achados no capim (raros) ou em tesouros. Plante num canteiro.',
    category: 'recurso',
    icon: 'semente_milho',
  },
  milho: {
    id: 'milho',
    name: 'Milho',
    description: 'Espiga colhida na horta. Assada na fogueira fica muito melhor.',
    category: 'comida',
    icon: 'milho',
    food: { energy: 8, hunger: 12 },
  },
  milho_assado: {
    id: 'milho_assado',
    name: 'Milho Assado',
    description: 'Espiga tostadinha na brasa.',
    category: 'comida',
    icon: 'milho_assado',
    food: { energy: 30, hunger: 30 },
  },
  muda_abacaxi: {
    id: 'muda_abacaxi',
    name: 'Muda de Abacaxi',
    description: 'A coroa de um abacaxi. Às vezes cai dos arbustos de frutas; plante num canteiro.',
    category: 'recurso',
    icon: 'muda_abacaxi',
  },
  abacaxi: {
    id: 'abacaxi',
    name: 'Abacaxi',
    description: 'Doce e suculento. Demora a crescer, mas vale a pena.',
    category: 'comida',
    icon: 'abacaxi',
    food: { energy: 25, hunger: 22 },
  },
  salada_tropical: {
    id: 'salada_tropical',
    name: 'Salada Tropical',
    description: 'Frutas com abacaxi: refrescante, deixa você "Bem alimentado".',
    category: 'comida',
    icon: 'salada_tropical',
    food: { energy: 45, hunger: 40, buffSeconds: 120 },
  },
  ensopado: {
    id: 'ensopado',
    name: 'Ensopado da Ilha',
    description: 'Peixe, batata-doce e milho cozidos juntos. A refeição mais completa da ilha.',
    category: 'comida',
    icon: 'ensopado',
    food: { energy: 90, hunger: 85, buffSeconds: 300 },
  },
  peixe_dourado: {
    id: 'peixe_dourado',
    name: 'Peixe Dourado',
    description: 'Raro: só morde a isca à noite (e um pouco mais na chuva). Brilha como uma lanterna.',
    category: 'comida',
    icon: 'peixe_dourado',
    food: { energy: 30, hunger: 25 },
  },
  dourado_grelhado: {
    id: 'dourado_grelhado',
    name: 'Dourado Grelhado',
    description: 'Um banquete raro: energia cheia e "Bem alimentado" por muito tempo.',
    category: 'comida',
    icon: 'dourado_grelhado',
    food: { energy: 150, hunger: 80, buffSeconds: 480 },
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
  'peixe',
  'peixe_assado',
  'semente',
  'batata_doce',
  'batata_assada',
  'semente_milho',
  'milho',
  'milho_assado',
  'muda_abacaxi',
  'abacaxi',
  'salada_tropical',
  'ensopado',
  'peixe_dourado',
  'dourado_grelhado',
  'machado',
  'picareta',
  'tocha',
  'vara_de_pesca',
];

/** Recursos sempre visíveis na barra inferior do HUD. */
export const HUD_RESOURCES: ItemId[] = ['madeira', 'pedra', 'fibra', 'fruta', 'cristal'];

export function isItemId(value: string): value is ItemId {
  return value in ITEMS;
}
