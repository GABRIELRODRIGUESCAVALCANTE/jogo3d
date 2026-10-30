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

// ---------------------------------------------------------------------------
// Capítulo 3: Ilha do Eco
// ---------------------------------------------------------------------------

/** Contexto das conversas na Ilha do Eco. */
export interface EcoDialogueContext {
  hasFlag(flag: string): boolean;
  setFlag(flag: string): void;
  /** Quantos sinos já tocaram (0 a 3). */
  bellsRung(): number;
  /** Notas escolhidas na canção, na ordem. */
  song: string[];
  /** Toca a nota de um sino (oeste, sul ou leste). */
  playNote(bell: string): void;
  /** A canção escolhida está certa? */
  songCorrect(): boolean;
}

export const IARA: DialogueDef<EcoDialogueContext> = {
  id: 'iara',
  speaker: 'Capitã Iara',
  portrait: 'iara',
  start: (c) => (c.hasFlag('iara_encontrada') ? 'oi' : 'encontro'),
  nodes: {
    encontro: {
      text: [
        'Uma pessoa! Depois de tanto tempo… Eu sou Iara, capitã do Estrela do Sul.',
        'Você encontrou o meu diário, não foi? Só alguém que leu as estrelas chegaria até a Ilha do Eco.',
      ],
      options: [
        {
          label: 'O Pipoca mandou dizer que ainda imita o machado!',
          show: (c) => c.hasFlag('pipoca_conheceu'),
          next: 'pipoca',
          action: (c) => c.setFlag('iara_encontrada'),
        },
        { label: 'Segui o Mapa de Estrelas até aqui.', next: 'historia', action: (c) => c.setFlag('iara_encontrada') },
      ],
    },
    pipoca: {
      text: [
        '(Iara cai na gargalhada.) Aquele papagaio teimoso! Ele morria de medo do barco… Que bom que ele está bem.',
        'Quando tudo isto acabar, vou buscá-lo. Prometo.',
      ],
      options: [{ label: 'O que é "tudo isto"?', next: 'historia' }],
    },
    historia: {
      text: [
        'Os Lumeni não desapareceram: viraram luz e som. A Guardiã do Eco dorme no templo, no alto da ilha.',
        'Para acordá-la, toque os três sinos antigos: um a oeste, um ao sul e um a leste. Cada um tem uma nota diferente. Preste atenção nelas!',
      ],
      options: [
        { label: 'E depois?', next: 'cancao' },
        { label: 'Vou procurar os sinos.' },
      ],
    },
    cancao: {
      text: [
        'A guardiã vai pedir a Canção dos Lumeni. Eu nunca consegui cantá-la sozinha…',
        'Nas pedras do templo está escrito: "do mais grave ao mais agudo, como o sol que sobe do mar".',
      ],
      options: [{ label: 'Entendi. Obrigado, capitã!' }],
    },
    oi: {
      text: (c) =>
        c.hasFlag('eco_cancao')
          ? ['Você conseguiu! A névoa se abriu e o céu inteiro está cantando. Os Lumeni ficariam orgulhosos.', 'Agora eu posso voltar para casa… e buscar o Pipoca!']
          : c.bellsRung() >= 3
            ? ['Os três sinos tocaram! Ouvi daqui. Vá ao templo: a guardiã está esperando.']
            : [`Você já tocou ${c.bellsRung()} de 3 sinos. Oeste, sul e leste… escute bem cada nota!`],
      options: [
        { label: 'Como é mesmo a canção?', next: 'cancao', show: (c) => !c.hasFlag('eco_cancao') },
        { label: 'Até mais, capitã!' },
      ],
    },
  },
};

/** As três respostas possíveis em cada nota da canção: um sino de cada. */
const NOTE_OPTIONS = (next: string) =>
  (
    [
      ['oeste', 'Sino do Oeste'],
      ['sul', 'Sino do Sul'],
      ['leste', 'Sino do Leste'],
    ] as const
  ).map(([bell, label]) => ({
    label,
    icon: 'sino',
    action: (c: EcoDialogueContext): string => {
      c.song.push(bell);
      c.playNote(bell);
      return next;
    },
  }));

export const GUARDIAN: DialogueDef<EcoDialogueContext> = {
  id: 'guardia',
  speaker: 'Guardiã do Eco',
  portrait: 'guardia',
  start: (c) => (c.hasFlag('eco_cancao') ? 'desperta' : 'inicio'),
  nodes: {
    inicio: {
      text: [
        'Viajante… os sinos me acordaram. Há muito tempo ninguém cantava conosco.',
        'Cante a Canção dos Lumeni e a névoa que esconde esta ilha vai se abrir. Escolha as três notas, na ordem certa.',
      ],
      options: [
        { label: 'Vou cantar.', next: 'nota1', action: (c) => void (c.song.length = 0) },
        { label: 'Ainda não estou pronto.' },
      ],
    },
    nota1: { text: ['Primeira nota…'], options: NOTE_OPTIONS('nota2') },
    nota2: { text: ['Segunda nota…'], options: NOTE_OPTIONS('nota3') },
    nota3: {
      text: ['E a última nota…'],
      options: NOTE_OPTIONS('fim').map((o) => ({
        ...o,
        action: (c: EcoDialogueContext) => {
          o.action(c);
          // O marcador da canção é gravado pelo jogo ao fim da conversa.
          return c.songCorrect() ? 'vitoria' : 'erro';
        },
      })),
    },
    erro: {
      text: ['O eco se desfaz no ar… Essa não é a nossa canção.', 'Toque os sinos de novo e escute: do mais grave ao mais agudo.'],
      options: [
        { label: 'Tentar de novo', next: 'nota1', action: (c) => void (c.song.length = 0) },
        { label: 'Depois eu volto.' },
      ],
    },
    vitoria: {
      text: [
        'Sim… essa é a canção! A luz das três ilhas se encontra outra vez.',
        'O Farol, a Aurora e o Eco: a constelação dos Lumeni está completa. Os navegantes nunca mais vão se perder neste mar.',
        'Obrigada, viajante. Você é, agora, um guardião da luz.',
      ],
      options: [{ label: 'Foi uma honra.' }],
    },
    desperta: {
      text: ['A névoa dorme e o céu canta. Volte sempre que quiser ouvir o eco das estrelas.'],
      options: [{ label: 'Até logo, Guardiã.' }],
    },
  },
};
