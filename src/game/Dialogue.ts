/**
 * Conversas com personagens.
 *
 * Uma conversa é um conjunto de "nós": cada nó tem uma fala e opções de
 * resposta. Escolher uma opção pode executar uma ação (dar um item, marcar
 * algo no mapa...) e levar a outro nó, ou encerrar a conversa.
 */
import type { ChooseOptions } from '../ui/Dialogs';

export interface DialogueOption<C> {
  label: string;
  icon?: string;
  /** Próximo nó (sem `next` e sem ação que devolva um nó, a conversa acaba). */
  next?: string;
  /** Só aparece quando a condição é verdadeira. */
  show?: (ctx: C) => boolean;
  /** Executada ao escolher; pode devolver o nó seguinte. */
  action?: (ctx: C) => string | void;
}

export interface DialogueNode<C> {
  text: string[] | ((ctx: C) => string[]);
  options: DialogueOption<C>[];
}

export interface DialogueDef<C> {
  id: string;
  speaker: string;
  portrait: string;
  /** Nó inicial (pode depender do progresso). */
  start: string | ((ctx: C) => string);
  nodes: Record<string, DialogueNode<C>>;
}

/** Mostra a conversa até o jogador encerrar (ou fechar a janela). */
export async function runDialogue<C>(
  def: DialogueDef<C>,
  ctx: C,
  choose: (opts: ChooseOptions) => Promise<string | null>,
): Promise<void> {
  let nodeId = typeof def.start === 'function' ? def.start(ctx) : def.start;
  // Limite de segurança contra conversas em círculo infinito.
  for (let step = 0; step < 50; step++) {
    const node = def.nodes[nodeId];
    if (!node) return;
    const options = node.options.filter((o) => !o.show || o.show(ctx));
    const answer = await choose({
      title: def.speaker,
      speaker: 'Conversa',
      portrait: def.portrait,
      text: typeof node.text === 'function' ? node.text(ctx) : node.text,
      options: options.map((o, i) => ({ label: o.label, value: String(i), icon: o.icon })),
    });
    if (answer === null) return;
    const option = options[Number(answer)];
    if (!option) return;
    const redirect = option.action?.(ctx);
    const next = redirect ?? option.next;
    if (!next) return;
    nodeId = next;
  }
}
