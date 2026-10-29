/**
 * Pequenos utilitários para criar elementos da interface.
 */

/** Escapa texto para inserir com segurança em HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Cria um elemento a partir de um trecho de HTML. */
export function html<T extends HTMLElement = HTMLElement>(markup: string): T {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as T;
}

/** Busca um elemento obrigatório (lança erro claro se não existir). */
export function $<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Elemento da interface não encontrado: ${selector}`);
  return el;
}

/** Aguarda o próximo quadro (útil para a tela de carregamento atualizar). */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Formata uma data como "29/10 às 14:05". */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const mi = d.getMinutes().toString().padStart(2, '0');
  return `${dd}/${mm} às ${hh}:${mi}`;
}
