/**
 * Caixas de diálogo: confirmação, textos de história e mensagens.
 * Todas retornam Promises, então o código pode "esperar" a resposta:
 *   if (await dialogs.confirm({...})) { ... }
 */
import type { LoreEntry } from '../game/data/lore';
import { escapeHtml, html } from './dom';
import { icon } from './icons';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export class Dialogs {
  readonly layer: HTMLElement;
  private stack = 0;
  onChange: (() => void) | null = null;

  constructor(root: HTMLElement, private readonly onClick: () => void) {
    this.layer = html('<div class="dialog-layer hidden"></div>');
    root.append(this.layer);
  }

  get isOpen(): boolean {
    return this.stack > 0;
  }

  confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const el = html(`
        <div class="dialog ${opts.danger ? 'dialog-danger' : ''}" role="alertdialog" aria-modal="true">
          <h2>${escapeHtml(opts.title)}</h2>
          <p>${escapeHtml(opts.message)}</p>
          <div class="dialog-actions">
            <button class="btn btn-ghost" data-r="0">${escapeHtml(opts.cancelText ?? 'Cancelar')}</button>
            <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${escapeHtml(opts.confirmText ?? 'Confirmar')}</button>
          </div>
        </div>`);
      this.show(el, (r) => resolve(r === '1'));
      (el.querySelector('[data-r="0"]') as HTMLElement).focus();
    });
  }

  lore(entry: LoreEntry, buttonText = 'Continuar'): Promise<void> {
    return new Promise((resolve) => {
      const paragraphs = entry.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
      const el = html(`
        <div class="dialog dialog-lore" role="dialog" aria-modal="true">
          <div class="lore-ornament">${icon('reliquia')}</div>
          <h2>${escapeHtml(entry.title)}</h2>
          <div class="lore-text">${paragraphs}</div>
          <div class="dialog-actions"><button class="btn btn-primary" data-r="1">${escapeHtml(buttonText)}</button></div>
        </div>`);
      this.show(el, () => resolve());
      (el.querySelector('[data-r="1"]') as HTMLElement).focus();
    });
  }

  message(title: string, text: string, buttonText = 'Entendi'): Promise<void> {
    return this.lore({ title, paragraphs: [text] }, buttonText);
  }

  /** Diálogo com conteúdo HTML livre (ex.: boas-vindas com controles). */
  custom(inner: string, buttonText = 'Começar'): Promise<void> {
    return new Promise((resolve) => {
      const el = html(`
        <div class="dialog dialog-wide" role="dialog" aria-modal="true">
          ${inner}
          <div class="dialog-actions"><button class="btn btn-primary" data-r="1">${escapeHtml(buttonText)}</button></div>
        </div>`);
      this.show(el, () => resolve());
      (el.querySelector('[data-r="1"]') as HTMLElement).focus();
    });
  }

  private show(el: HTMLElement, done: (r: string) => void): void {
    const backdrop = html('<div class="dialog-backdrop"></div>');
    backdrop.append(el);
    this.layer.append(backdrop);
    this.layer.classList.remove('hidden');
    this.stack++;
    this.onChange?.();
    const finish = (r: string) => {
      this.onClick();
      backdrop.classList.add('leaving');
      window.setTimeout(() => backdrop.remove(), 200);
      this.stack--;
      if (this.stack <= 0) {
        this.stack = 0;
        window.setTimeout(() => {
          if (this.stack === 0) this.layer.classList.add('hidden');
        }, 200);
      }
      window.removeEventListener('keydown', onKey, true);
      this.onChange?.();
      done(r);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        finish('0');
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        const focused = document.activeElement as HTMLElement | null;
        if (!focused || !el.contains(focused)) {
          e.preventDefault();
          finish('1');
        }
      }
      // Impede que teclas do jogo (WASD, E...) passem para o jogo.
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-r]') as HTMLElement | null;
      if (btn) finish(btn.dataset.r!);
    });
  }
}
