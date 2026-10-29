/**
 * Avisos na tela: mensagens rápidas (toasts), "+2 Madeira" ao coletar e
 * faixas grandes para descobertas, missões e novos níveis.
 */
import { ITEMS, type ItemId } from '../game/data/items';
import type { NotifyKind } from '../game/events';
import { escapeHtml, html } from './dom';
import { icon } from './icons';

interface BannerRequest {
  title: string;
  subtitle: string;
  iconName: string;
  kind: string;
}

export class Notifications {
  readonly toastsEl: HTMLElement;
  readonly popupsEl: HTMLElement;
  readonly bannerEl: HTMLElement;
  private bannerQueue: BannerRequest[] = [];
  private bannerBusy = false;
  private popupMap = new Map<ItemId, { el: HTMLElement; amount: number; timer: number }>();

  constructor(root: HTMLElement) {
    this.toastsEl = html('<div class="toasts" aria-live="polite"></div>');
    this.popupsEl = html('<div class="item-popups"></div>');
    this.bannerEl = html('<div class="banner hidden" aria-live="polite"></div>');
    root.append(this.toastsEl, this.popupsEl, this.bannerEl);
  }

  toast(text: string, kind: NotifyKind = 'info', iconName?: string): void {
    const defaultIcons: Partial<Record<NotifyKind, string>> = {
      success: 'check',
      warning: 'info',
      quest: 'missao',
      xp: 'estrela',
      region: 'mapa',
      info: 'info',
    };
    const name = iconName ?? defaultIcons[kind] ?? 'info';
    const el = html(`<div class="toast toast-${kind}"><span class="toast-icon">${icon(name)}</span><span>${escapeHtml(text)}</span></div>`);
    this.toastsEl.prepend(el);
    while (this.toastsEl.children.length > 4) this.toastsEl.lastElementChild?.remove();
    window.setTimeout(() => {
      el.classList.add('leaving');
      window.setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  /** "+2 Madeira" (agrupa coletas seguidas do mesmo item). */
  itemPopup(itemId: ItemId, amount: number): void {
    const existing = this.popupMap.get(itemId);
    if (existing) {
      existing.amount += amount;
      existing.el.querySelector('.amount')!.textContent = `+${existing.amount}`;
      existing.el.classList.remove('bump');
      void existing.el.offsetWidth; // reinicia a animação
      existing.el.classList.add('bump');
      window.clearTimeout(existing.timer);
      existing.timer = window.setTimeout(() => this.removePopup(itemId), 1800);
      return;
    }
    const el = html(
      `<div class="item-popup bump"><span class="amount">+${amount}</span><span class="pi">${icon(ITEMS[itemId].icon)}</span><span>${escapeHtml(ITEMS[itemId].name)}</span></div>`,
    );
    this.popupsEl.append(el);
    const timer = window.setTimeout(() => this.removePopup(itemId), 1800);
    this.popupMap.set(itemId, { el, amount, timer });
  }

  private removePopup(itemId: ItemId): void {
    const entry = this.popupMap.get(itemId);
    if (!entry) return;
    this.popupMap.delete(itemId);
    entry.el.classList.add('leaving');
    window.setTimeout(() => entry.el.remove(), 350);
  }

  /** Faixa grande no centro superior (fila: uma de cada vez). */
  banner(title: string, subtitle: string, iconName: string, kind = 'region'): void {
    this.bannerQueue.push({ title, subtitle, iconName, kind });
    if (!this.bannerBusy) this.nextBanner();
  }

  private nextBanner(): void {
    const req = this.bannerQueue.shift();
    if (!req) {
      this.bannerBusy = false;
      return;
    }
    this.bannerBusy = true;
    this.bannerEl.className = `banner banner-${req.kind}`;
    this.bannerEl.innerHTML = `
      <div class="banner-icon">${icon(req.iconName)}</div>
      <div class="banner-text">
        <div class="banner-sub">${escapeHtml(req.subtitle)}</div>
        <div class="banner-title">${escapeHtml(req.title)}</div>
      </div>`;
    window.setTimeout(() => {
      this.bannerEl.classList.add('leaving');
      window.setTimeout(() => this.nextBanner(), 450);
    }, 3000);
  }

  clear(): void {
    this.toastsEl.innerHTML = '';
    this.popupsEl.innerHTML = '';
    this.popupMap.clear();
    this.bannerQueue = [];
    this.bannerEl.className = 'banner hidden';
    this.bannerBusy = false;
  }
}
