/**
 * Missões. Cada missão tem objetivos, recompensas e pré-requisitos
 * (`requires`). Quando todos os pré-requisitos são concluídos, a missão
 * fica ativa automaticamente.
 */
import type { ItemBundle, ItemId } from './items';
import type { RegionId } from './regions';
import type { StructureId } from './structures';
import { PLACES, type Place } from '../world/layout';
import { AURORA_PLACES } from '../world/islands';

export type ObjectiveDef =
  | { type: 'collect'; item: ItemId; amount: number }
  | { type: 'craft'; item: ItemId; amount: number }
  | { type: 'use'; item: ItemId; amount: number }
  | { type: 'build'; structure: StructureId; amount: number }
  | { type: 'visit'; region: RegionId }
  | { type: 'interact'; target: string; label: string }
  | { type: 'level'; level: number };

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  objectives: ObjectiveDef[];
  requires: string[];
  rewards: { xp: number; items?: ItemBundle };
  /** Local sugerido (aparece no mapa e como um feixe de luz no mundo). */
  target?: Place;
  /** Texto exibido ao concluir. */
  completeText?: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'q_madeira',
    title: 'Primeiros Passos',
    description: 'Você acordou numa praia desconhecida. Corte árvores para juntar madeira.',
    objectives: [{ type: 'collect', item: 'madeira', amount: 5 }],
    requires: [],
    rewards: { xp: 30, items: { fruta: 2 } },
    target: { x: -6, z: 116 },
    completeText: 'Com madeira em mãos, a ilha parece um pouco menos hostil.',
  },
  {
    id: 'q_bau',
    title: 'O Baú na Areia',
    description: 'Algo brilha perto das palmeiras a oeste da praia. Vá conferir!',
    objectives: [{ type: 'interact', target: 'bau_praia', label: 'Abra o baú da praia' }],
    requires: [],
    rewards: { xp: 25 },
    target: PLACES.chestBeach,
  },
  {
    id: 'q_recursos',
    title: 'Recursos da Ilha',
    description: 'Pedras soltas e capim alto estão por toda parte. Junte o necessário para suas primeiras ferramentas.',
    objectives: [
      { type: 'collect', item: 'pedra', amount: 4 },
      { type: 'collect', item: 'fibra', amount: 6 },
    ],
    requires: ['q_madeira'],
    rewards: { xp: 40 },
    target: { x: 12, z: 102 },
  },
  {
    id: 'q_frutas',
    title: 'Sabor Tropical',
    description: 'Os arbustos da floresta estão carregados de frutas. Colha algumas e coma uma para recuperar energia.',
    objectives: [
      { type: 'collect', item: 'fruta', amount: 3 },
      { type: 'use', item: 'fruta', amount: 1 },
    ],
    requires: ['q_madeira'],
    rewards: { xp: 30 },
  },
  {
    id: 'q_ferramentas',
    title: 'Ferramentas Primitivas',
    description: 'Abra o menu de fabricação (tecla C) e transforme fibras em corda. Depois, faça um machado.',
    objectives: [
      { type: 'craft', item: 'corda', amount: 1 },
      { type: 'craft', item: 'machado', amount: 1 },
    ],
    requires: ['q_recursos'],
    rewards: { xp: 60, items: { corda: 1 } },
  },
  {
    id: 'q_bancada',
    title: 'Oficina ao Ar Livre',
    description: 'Abra o menu de construção (tecla B) e construa uma Bancada de Trabalho na clareira.',
    objectives: [{ type: 'build', structure: 'bancada', amount: 1 }],
    requires: ['q_ferramentas'],
    rewards: { xp: 60 },
    target: PLACES.clearing,
  },
  {
    id: 'q_fogueira',
    title: 'Luz na Escuridão',
    description: 'As noites na ilha são longas. Construa uma fogueira para se aquecer e assar frutas.',
    objectives: [{ type: 'build', structure: 'fogueira', amount: 1 }],
    requires: ['q_ferramentas'],
    rewards: { xp: 50, items: { fruta: 2 } },
    target: PLACES.clearing,
  },
  {
    id: 'q_cabana',
    title: 'Um Lar na Ilha',
    description: 'Junte 30 madeiras, 12 pedras e 4 cordas e construa sua cabana na Clareira do Construtor.',
    objectives: [{ type: 'build', structure: 'cabana', amount: 1 }],
    requires: ['q_bancada'],
    rewards: { xp: 120 },
    target: PLACES.clearing,
    completeText: 'Você agora tem um lar. Use a cama da cabana para dormir até o amanhecer.',
  },
  {
    id: 'q_pesca',
    title: 'Pescador da Ilha',
    description: 'Fabrique uma vara de pesca. Na beira da água, perto de onde os peixes saltam, interaja para pescar e puxe na hora certa!',
    objectives: [
      { type: 'craft', item: 'vara_de_pesca', amount: 1 },
      { type: 'collect', item: 'peixe', amount: 3 },
    ],
    requires: ['q_ferramentas'],
    rewards: { xp: 70, items: { corda: 1 } },
    target: { x: 0, z: 140 },
  },
  {
    id: 'q_cozinha',
    title: 'Chef da Ilha',
    description:
      'Plante milho (as sementes são raras no capim) e abacaxi (as mudas caem dos arbustos de frutas). Depois prepare uma Salada Tropical e um Ensopado da Ilha.',
    objectives: [
      { type: 'craft', item: 'salada_tropical', amount: 1 },
      { type: 'craft', item: 'ensopado', amount: 1 },
    ],
    requires: ['q_horta'],
    rewards: { xp: 120, items: { semente_milho: 1, muda_abacaxi: 1 } },
  },
  {
    id: 'q_dourado',
    title: 'Brilho na Água Escura',
    description: 'Dizem que um peixe dourado morde a isca só à noite. Pesque um (na chuva, a sorte é maior).',
    objectives: [{ type: 'collect', item: 'peixe_dourado', amount: 1 }],
    requires: ['q_pesca'],
    rewards: { xp: 80 },
  },
  {
    id: 'q_vagalumes',
    title: 'Luz Contra os Ladrões',
    description:
      'À noite, vagalumes ladrões tentam levar suas frutas. Fabrique uma tocha e acenda-a (tecla T ou o botão da tocha) quando eles chegarem perto para espantá-los.',
    objectives: [{ type: 'interact', target: 'vagalumes_espantados', label: 'Espante os vagalumes com a tocha' }],
    requires: ['q_ferramentas'],
    rewards: { xp: 50, items: { fruta: 3 } },
    completeText: 'Os vagalumes aprenderam a lição: frutas, só com licença!',
  },
  {
    id: 'q_raposa',
    title: 'Uma Amiga Peluda',
    description:
      'As raposas da ilha fogem de quem corre, mas ficam curiosas com quem anda devagar levando frutas. Chegue perto de uma e ofereça 3 frutas.',
    objectives: [{ type: 'interact', target: 'raposa_domesticada', label: 'Domestique uma raposa com frutas' }],
    requires: ['q_madeira'],
    rewards: { xp: 40 },
    completeText: 'A Brasa agora vai aonde você for — e o faro dela é ótimo!',
  },
  {
    id: 'q_tesouros',
    title: 'Faro de Tesouro',
    description: 'Explore a ilha com a Brasa. Quando ela farejar algo e cavar, chegue perto e escave o tesouro.',
    objectives: [{ type: 'interact', target: 'tesouros_3', label: 'Escave 3 tesouros enterrados' }],
    requires: ['q_raposa'],
    rewards: { xp: 90, items: { cristal: 2 } },
  },
  {
    id: 'q_horta',
    title: 'Mãos na Terra',
    description: 'Arranque capim para achar sementes, construa um canteiro, plante e espere crescer para colher batatas-doces.',
    objectives: [
      { type: 'build', structure: 'canteiro', amount: 1 },
      { type: 'collect', item: 'batata_doce', amount: 3 },
    ],
    requires: ['q_fogueira'],
    rewards: { xp: 70 },
  },
  {
    id: 'q_casa',
    title: 'Casa do Seu Jeito',
    description: 'Use as peças modulares: pisos, paredes e telhados de palha se encaixam numa grade. Monte uma casa do seu jeito!',
    objectives: [
      { type: 'build', structure: 'piso', amount: 4 },
      { type: 'build', structure: 'parede', amount: 3 },
      { type: 'build', structure: 'telhado', amount: 2 },
    ],
    requires: ['q_cabana'],
    rewards: { xp: 120, items: { corda: 2 } },
    target: PLACES.clearing,
  },
  {
    id: 'q_ruinas',
    title: 'Ecos do Passado',
    description: 'O fragmento do baú tem símbolos estranhos. Siga a trilha a leste até as ruínas e examine o monólito.',
    objectives: [
      { type: 'visit', region: 'ruinas' },
      { type: 'interact', target: 'monolito', label: 'Examine o monólito' },
    ],
    requires: ['q_bau'],
    rewards: { xp: 80 },
    target: PLACES.monolith,
  },
  {
    id: 'q_floresta',
    title: 'Sob a Grande Árvore',
    description: 'O monólito fala de um fragmento guardado "aos pés da árvore mais antiga". Procure a árvore gigante a oeste.',
    objectives: [{ type: 'interact', target: 'bau_floresta', label: 'Encontre o baú da árvore gigante' }],
    requires: ['q_ruinas'],
    rewards: { xp: 70 },
    target: PLACES.chestForest,
  },
  {
    id: 'q_picareta',
    title: 'Força Bruta',
    description: 'Para abrir caminho pelas rochas, você precisa de uma picareta. Fabrique-a na bancada (nível 3).',
    objectives: [{ type: 'craft', item: 'picareta', amount: 1 }],
    requires: ['q_ruinas', 'q_bancada'],
    rewards: { xp: 70 },
  },
  {
    id: 'q_caverna',
    title: 'A Caverna Selada',
    description: 'Ao norte, no pé da montanha, uma caverna está bloqueada por entulho. Use a picareta e entre.',
    objectives: [
      { type: 'interact', target: 'entulho', label: 'Remova o entulho da entrada' },
      { type: 'visit', region: 'caverna' },
    ],
    requires: ['q_picareta'],
    rewards: { xp: 90 },
    target: PLACES.caveEntrance,
  },
  {
    id: 'q_cristais',
    title: 'Cristais Luminosos',
    description: 'Minere cristais com a picareta e pegue o fragmento guardado no fundo da caverna.',
    objectives: [
      { type: 'collect', item: 'cristal', amount: 5 },
      { type: 'interact', target: 'bau_caverna', label: 'Abra o baú da caverna' },
    ],
    requires: ['q_caverna'],
    rewards: { xp: 100 },
    target: PLACES.chestCave,
  },
  {
    id: 'q_portal',
    title: 'O Portal dos Lumeni',
    description: 'Leve 3 Fragmentos Antigos e 5 Cristais ao altar das ruínas para despertar o portal.',
    objectives: [{ type: 'interact', target: 'altar', label: 'Ative o altar das ruínas' }],
    requires: ['q_cristais', 'q_floresta'],
    rewards: { xp: 150 },
    target: PLACES.altar,
  },
  {
    id: 'q_horizonte',
    title: 'Além do Horizonte',
    description: 'O feixe do portal aponta para o pico ao norte. Suba a montanha e acenda o Farol dos Lumeni.',
    objectives: [
      { type: 'visit', region: 'pico' },
      { type: 'interact', target: 'farol', label: 'Acenda o farol do pico' },
    ],
    requires: ['q_portal'],
    rewards: { xp: 200 },
    target: PLACES.peak,
    completeText: 'O farol brilha outra vez. Muito além do horizonte, outra luz responde...',
  },
  // ----- Capítulo 2: a Ilha da Aurora -----
  {
    id: 'q_barco',
    title: 'Rumo ao Desconhecido',
    description: 'A luz que respondeu ao farol vem do nordeste. Construa um barco a vela na água rasa, perto da praia.',
    objectives: [{ type: 'build', structure: 'barco', amount: 1 }],
    requires: ['q_horizonte'],
    rewards: { xp: 120 },
    target: { x: 2, z: 141 },
  },
  {
    id: 'q_aurora',
    title: 'Terra à Vista',
    description: 'Embarque e navegue para o nordeste, seguindo o feixe de luz, até a Ilha da Aurora. Leia a pedra gravada na praia.',
    objectives: [
      { type: 'visit', region: 'aurora' },
      { type: 'interact', target: 'pedra_aurora', label: 'Leia a pedra gravada da praia' },
    ],
    requires: ['q_barco'],
    rewards: { xp: 150 },
    target: AURORA_PLACES.loreStone,
  },
  {
    id: 'q_pilares',
    title: 'As Três Luzes',
    description: 'Desperte os três pilares de cristal da Aurora. Cada um precisa de 2 cristais (há cristais perto deles).',
    objectives: [
      { type: 'interact', target: 'pilar_oeste', label: 'Desperte o Pilar do Oeste' },
      { type: 'interact', target: 'pilar_leste', label: 'Desperte o Pilar do Leste' },
      { type: 'interact', target: 'pilar_sul', label: 'Desperte o Pilar do Sul' },
    ],
    requires: ['q_aurora'],
    rewards: { xp: 180 },
    target: AURORA_PLACES.pylonWest,
  },
  {
    id: 'q_observatorio',
    title: 'O Observatório dos Lumeni',
    description: 'Com os três pilares acesos, suba a colina e ative o observatório.',
    objectives: [{ type: 'interact', target: 'observatorio', label: 'Ative o observatório' }],
    requires: ['q_pilares'],
    rewards: { xp: 250 },
    target: AURORA_PLACES.observatory,
    completeText: 'O céu da Aurora se enche de luz. Os Lumeni deixaram um caminho entre as estrelas...',
  },
];

export function getQuest(id: string): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}
