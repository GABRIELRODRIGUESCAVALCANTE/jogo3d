/**
 * Tipos de recursos coletáveis espalhados pela ilha.
 * Altere aqui para deixar o jogo mais fácil ou mais difícil.
 */
import type { ItemId } from './items';
import type { SoundName } from '../../core/AudioManager';

export type NodeKind = 'arvore' | 'pinheiro' | 'palmeira' | 'rocha' | 'arbusto' | 'capim' | 'cristal';

export interface NodeKindDef {
  kind: NodeKind;
  /** Texto do botão de interação. */
  label: string;
  item: ItemId;
  /** Quantos golpes até esgotar. */
  hits: number;
  /** Itens por golpe sem ferramenta. */
  amount: number;
  /** Ferramenta que aumenta a coleta. */
  toolBonus?: { tool: ItemId; amount: number };
  /** Ferramenta obrigatória. */
  requiresTool?: ItemId;
  /** Chance de ganhar um item extra a cada golpe. */
  bonus?: { item: ItemId; chance: number };
  /** Segundo bônus, mais raro (sorteado só se o primeiro não sair). */
  rareBonus?: { item: ItemId; chance: number };
  /** Segundos de jogo até o recurso renascer. */
  respawn: number;
  xp: number;
  sound: SoundName;
  particleColor: string;
  /** Distância extra para interagir (objetos grandes). */
  interactRadius: number;
}

export const NODE_KINDS: Record<NodeKind, NodeKindDef> = {
  arvore: {
    kind: 'arvore',
    label: 'Cortar árvore',
    item: 'madeira',
    hits: 5,
    amount: 1,
    toolBonus: { tool: 'machado', amount: 2 },
    respawn: 240,
    xp: 2,
    sound: 'chop',
    particleColor: '#9a6a3c',
    interactRadius: 1.2,
  },
  pinheiro: {
    kind: 'pinheiro',
    label: 'Cortar pinheiro',
    item: 'madeira',
    hits: 5,
    amount: 1,
    toolBonus: { tool: 'machado', amount: 2 },
    respawn: 240,
    xp: 2,
    sound: 'chop',
    particleColor: '#7a5232',
    interactRadius: 1.2,
  },
  palmeira: {
    kind: 'palmeira',
    label: 'Cortar palmeira',
    item: 'madeira',
    hits: 3,
    amount: 1,
    toolBonus: { tool: 'machado', amount: 2 },
    bonus: { item: 'fruta', chance: 0.3 },
    respawn: 200,
    xp: 2,
    sound: 'chop',
    particleColor: '#b08a5a',
    interactRadius: 1.1,
  },
  rocha: {
    kind: 'rocha',
    label: 'Quebrar pedra',
    item: 'pedra',
    hits: 4,
    amount: 1,
    toolBonus: { tool: 'picareta', amount: 2 },
    respawn: 300,
    xp: 2,
    sound: 'mine',
    particleColor: '#9c978e',
    interactRadius: 1.3,
  },
  arbusto: {
    kind: 'arbusto',
    label: 'Colher frutas',
    item: 'fruta',
    hits: 3,
    amount: 1,
    respawn: 150,
    rareBonus: { item: 'muda_abacaxi', chance: 0.05 },
    xp: 1,
    sound: 'leaves',
    particleColor: '#ff5a4f',
    interactRadius: 1.0,
  },
  capim: {
    kind: 'capim',
    label: 'Arrancar fibras',
    item: 'fibra',
    hits: 3,
    amount: 1,
    toolBonus: { tool: 'machado', amount: 2 },
    bonus: { item: 'semente', chance: 0.18 },
    rareBonus: { item: 'semente_milho', chance: 0.07 },
    respawn: 120,
    xp: 1,
    sound: 'leaves',
    particleColor: '#c7d36a',
    interactRadius: 0.8,
  },
  cristal: {
    kind: 'cristal',
    label: 'Minerar cristal',
    item: 'cristal',
    hits: 3,
    amount: 1,
    requiresTool: 'picareta',
    respawn: 600,
    xp: 5,
    sound: 'crystal',
    particleColor: '#8ff4ff',
    interactRadius: 1.0,
  },
};
