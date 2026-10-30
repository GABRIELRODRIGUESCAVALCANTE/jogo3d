/**
 * Falas dos personagens. O papagaio Pipoca mora perto dos destroços e dá
 * dicas conforme o progresso do jogador.
 */
import type { DialogueDef } from '../Dialogue';

/** O que as conversas podem consultar e fazer no jogo. */
export interface DialogueContext {
  hasFlag(flag: string): boolean;
  setFlag(flag: string): void;
  fruitCount(): number;
  takeFruit(): void;
  /** Dica sobre a missão acompanhada (ou null se não houver). */
  questHint(): string | null;
  /** Marca no mapa um tesouro ainda não escavado; devolve o nome da região (ou null). */
  revealTreasure(): string | null;
  diaryCount(): number;
  diaryTotal(): number;
  sound(name: 'pickup' | 'discover'): void;
}

export const PARROT: DialogueDef<DialogueContext> = {
  id: 'papagaio',
  speaker: 'Pipoca, o papagaio',
  portrait: 'papagaio',
  start: (c) => (c.hasFlag('pipoca_conheceu') ? 'oi' : 'primeira'),
  nodes: {
    primeira: {
      text: [
        'Rrraac! Visitante! Visitante! Pipoca é o nome, navegar é o jogo!',
        'Pipoca veio no Estrela do Sul, com a capitã Iara. Faz muitas luas… muitas!',
      ],
      options: [
        { label: 'Prazer, Pipoca!', next: 'oi', action: (c) => c.setFlag('pipoca_conheceu') },
      ],
    },
    oi: {
      text: (c) => [
        c.diaryCount() > 0
          ? `Rrraac! Você leu ${c.diaryCount()} de ${c.diaryTotal()} páginas da Iara! Pipoca está orgulhoso!`
          : 'Rrraac! O que vai ser hoje, marujo?',
      ],
      options: [
        { label: 'Quem é a Iara?', next: 'iara', icon: 'diario' },
        { label: 'Tem alguma dica para mim?', next: 'dica', icon: 'info' },
        {
          label: 'Quer uma fruta?',
          icon: 'fruta',
          show: (c) => c.fruitCount() > 0,
          action: (c) => {
            c.takeFruit();
            c.sound('pickup');
            return 'fruta';
          },
        },
        {
          label: 'Para onde a Iara foi?',
          icon: 'bussola',
          show: (c) => c.hasFlag('observatorio'),
          next: 'partiu',
          action: (c) => c.setFlag('pipoca_iara'),
        },
        { label: 'Tchau, Pipoca!' },
      ],
    },
    iara: {
      text: [
        'A capitã Iara! A melhor navegadora dos sete mares! Rrraac!',
        'Iara escrevia, escrevia, escrevia… e o vento levou as páginas do diário para a ilha toda! Perto da árvore gigante, nas ruínas, na caverna, lá no pico…',
        'Leia! Leia! Pipoca não sabe ler. Pipoca só sabe falar.',
      ],
      options: [
        { label: 'Vou procurar as páginas.', next: 'oi', action: (c) => c.setFlag('pipoca_paginas') },
        { label: 'Tchau, Pipoca!' },
      ],
    },
    dica: {
      text: (c) => {
        const hint = c.questHint();
        return hint
          ? ['Pipoca vê tudo lá de cima! Rrraac!', hint]
          : ['Pipoca acha que você já fez tudo! Explore, pesque, plante… e cuidado com os vagalumes à noite!'];
      },
      options: [
        { label: 'Obrigado!', next: 'oi' },
        { label: 'Tchau, Pipoca!' },
      ],
    },
    fruta: {
      text: (c) => {
        const region = c.revealTreasure();
        return region
          ? ['Nhac, nhac! Delícia! Pipoca conta um segredo…', `Tem coisa enterrada perto de ${region}! Pipoca marcou no seu mapa. Rrraac!`]
          : ['Nhac, nhac! Delícia! Pipoca não sabe de mais nenhum tesouro… mas aceita mais frutas!'];
      },
      options: [
        { label: 'Valeu, Pipoca!', next: 'oi' },
        { label: 'Tchau, Pipoca!' },
      ],
    },
    partiu: {
      text: [
        'A Iara achou o Mapa de Estrelas e seguiu para o sul, para dentro da névoa… para a Ilha do Eco!',
        'Pipoca ficou. Pipoca tem medo de água funda. Rrraac… Se encontrar a Iara, diga que o Pipoca ainda sabe imitar o machado!',
      ],
      options: [
        { label: 'Vou encontrá-la.', next: 'oi' },
        { label: 'Tchau, Pipoca!' },
      ],
    },
  },
};
