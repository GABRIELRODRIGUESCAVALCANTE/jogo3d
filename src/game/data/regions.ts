/**
 * Regiões da ilha. Ao entrar em uma região pela primeira vez, ela é
 * "descoberta": aparece no mapa e o jogador ganha experiência.
 */
import { PLACES } from '../world/layout';

export type RegionId = 'praia' | 'floresta' | 'clareira' | 'ruinas' | 'montanhas' | 'caverna' | 'pico';

export interface RegionDef {
  id: RegionId;
  name: string;
  description: string;
  x: number;
  z: number;
  radius: number;
}

/** Ordenadas da menor para a maior: regiões pequenas têm prioridade. */
export const REGIONS: RegionDef[] = [
  {
    id: 'caverna',
    name: 'Caverna de Cristal',
    description: 'Uma gruta escondida onde cristais brilham no escuro.',
    x: PLACES.cave.x,
    z: PLACES.cave.z,
    radius: 6.5,
  },
  {
    id: 'pico',
    name: 'Pico do Horizonte',
    description: 'O ponto mais alto da ilha. Dizem que daqui se vê além do horizonte.',
    x: PLACES.peak.x,
    z: PLACES.peak.z,
    radius: 16,
  },
  {
    id: 'clareira',
    name: 'Clareira do Construtor',
    description: 'Um terreno plano e protegido, perfeito para erguer uma cabana.',
    x: PLACES.clearing.x,
    z: PLACES.clearing.z,
    radius: 15,
  },
  {
    id: 'ruinas',
    name: 'Ruínas Antigas',
    description: 'Restos de um templo dos Lumeni, tomados pelo tempo.',
    x: PLACES.ruins.x,
    z: PLACES.ruins.z,
    radius: 24,
  },
  {
    id: 'praia',
    name: 'Praia da Chegada',
    description: 'Areia branca e água cristalina. Foi aqui que você acordou.',
    x: 0,
    z: 122,
    radius: 46,
  },
  {
    id: 'montanhas',
    name: 'Montanhas Nebulosas',
    description: 'Encostas rochosas ao norte, varridas pelo vento.',
    x: 0,
    z: -95,
    radius: 62,
  },
  {
    id: 'floresta',
    name: 'Floresta Verdejante',
    description: 'Mata densa cheia de árvores, frutas e capim alto.',
    x: -8,
    z: 30,
    radius: 92,
  },
];

export function getRegion(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id)!;
}

/** Retorna a região em uma posição (ou null no mar / áreas sem nome). */
export function regionAt(x: number, z: number): RegionDef | null {
  for (const region of REGIONS) {
    if (Math.hypot(x - region.x, z - region.z) <= region.radius) return region;
  }
  return null;
}
