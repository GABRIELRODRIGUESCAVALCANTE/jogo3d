/**
 * Diário da navegadora Iara: páginas espalhadas pelas ilhas contam a
 * história de quem chegou antes do jogador (e de para onde ela foi).
 */
import type { Place } from '../world/layout';
import { PLACES } from '../world/layout';
import { AURORA_PLACES, ECO_PLACES } from '../world/islands';
import type { LoreEntry } from './lore';

export interface DiaryPage extends LoreEntry {
  /** Marcador salvo ao ler (diario_1, diario_2...). */
  id: string;
  number: number;
  place: Place;
}

const at = (p: Place, dx: number, dz: number): Place => ({ x: p.x + dx, z: p.z + dz });

export const DIARY_PAGES: DiaryPage[] = [
  {
    id: 'diario_1',
    number: 1,
    place: at(PLACES.shipwreck, -9, -8),
    title: 'Diário de Iara — página 1',
    paragraphs: [
      '"Dia 1. O Estrela do Sul afundou na tempestade de relâmpagos azuis. Só eu e o Pipoca, meu papagaio, chegamos à praia."',
      '"Escrevo para não esquecer. Se alguém encontrar estas páginas: não tenha medo. Esta ilha é generosa com quem a respeita."',
    ],
  },
  {
    id: 'diario_2',
    number: 2,
    place: at(PLACES.clearing, 10, -10),
    title: 'Diário de Iara — página 2',
    paragraphs: [
      '"Dia 6. Construí um abrigo onde a mata se abre. O Pipoca aprendeu a imitar o barulho do machado e agora me acorda com ele."',
      '"À noite, vagalumes rondam as minhas frutas. Uma tocha acesa resolve: eles não gostam de luz forte."',
    ],
  },
  {
    id: 'diario_3',
    number: 3,
    place: at(PLACES.giantTree, 5, -6),
    title: 'Diário de Iara — página 3',
    paragraphs: [
      '"A árvore gigante tem marcas no tronco: círculos ligados por linhas, como constelações. Alguém viveu aqui muito antes de mim."',
      '"As raposas me seguem quando levo frutas. Uma delas dorme na minha porta. Dei a ela o nome de Faísca."',
    ],
  },
  {
    id: 'diario_4',
    number: 4,
    place: at(PLACES.ruins, -12, -6),
    title: 'Diário de Iara — página 4',
    paragraphs: [
      '"Os Lumeni! O monólito fala deles: um povo que lia as estrelas e acendia faróis para guiar os navegantes pelo mar sem fim."',
      '"Por que partiram? E para onde? Toda pedra aqui aponta para o mar."',
    ],
  },
  {
    id: 'diario_5',
    number: 5,
    place: at(PLACES.caveEntrance, 6, 4),
    title: 'Diário de Iara — página 5',
    paragraphs: [
      '"Na caverna, os cristais cantam baixinho quando a lua nasce. Acho que guardam luz, como uma lanterna guarda fogo."',
      '"Levei um cristal para o abrigo. O Pipoca passou a noite inteira conversando com ele."',
    ],
  },
  {
    id: 'diario_6',
    number: 6,
    place: at(PLACES.peak, 3, 3),
    title: 'Diário de Iara — página 6',
    paragraphs: [
      '"Do alto do pico vi uma luz a nordeste, piscando como se respondesse ao farol apagado. Outra ilha!"',
      '"Vou construir um barco. O Pipoca jura que não entra nele. Veremos."',
    ],
  },
  {
    id: 'diario_7',
    number: 7,
    place: at(AURORA_PLACES.loreStone, 4, -4),
    title: 'Diário de Iara — página 7',
    paragraphs: [
      '"Ilha da Aurora. As árvores são azuis e o céu dança à noite. O Pipoca ficou na outra ilha, emburrado. Sinto falta dele."',
      '"Três pilares de cristal cercam um observatório. Os Lumeni estudavam o céu daqui."',
    ],
  },
  {
    id: 'diario_8',
    number: 8,
    place: at(AURORA_PLACES.observatory, 5, 6),
    title: 'Diário de Iara — página 8',
    paragraphs: [
      '"No observatório encontrei o Mapa de Estrelas dos Lumeni. Três ilhas formam uma constelação: a do Farol, a da Aurora… e uma terceira, ao sul, escondida na névoa."',
      '"Eles a chamavam de Ilha do Eco. É para lá que eu vou. Se você chegou até aqui, siga as estrelas."',
    ],
  },
  {
    id: 'diario_9',
    number: 9,
    place: at(ECO_PLACES.beach, -6, 14),
    title: 'Diário de Iara — página 9',
    paragraphs: [
      '"Ilha do Eco. A névoa é tão grossa que só achei a praia seguindo o som das ondas. Aqui, tudo responde: grito o meu nome e a ilha grita de volta."',
      '"Montei acampamento perto da praia. Há sinos antigos espalhados pelos morros."',
    ],
  },
  {
    id: 'diario_10',
    number: 10,
    place: at(ECO_PLACES.temple, 4, -11),
    title: 'Diário de Iara — página 10',
    paragraphs: [
      '"Nas pedras do templo está gravada a Canção dos Lumeni: do mais grave ao mais agudo, como o sol que sobe do mar."',
      '"Toquei os sinos, mas a guardiã não acordou para mim. Talvez ela espere alguém que tenha atravessado as três ilhas."',
    ],
  },
];

/** Quantas páginas o jogador já leu. */
export function diaryCount(hasFlag: (flag: string) => boolean): number {
  return DIARY_PAGES.filter((p) => hasFlag(p.id)).length;
}
