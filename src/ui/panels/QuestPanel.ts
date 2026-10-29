/**
 * Diário de missões: missões ativas (com objetivos e recompensas) e
 * missões concluídas.
 */
import type { Game } from '../../game/Game';
import { ITEMS, type ItemId } from '../../game/data/items';
import { escapeHtml } from '../dom';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

export class QuestPanel extends Panel {
  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'missoes', 'Missões', 'missao', 'wide');
    this.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-track]');
      if (btn) {
        this.game.quests.track(btn.dataset.track!);
        this.ui.click();
        this.render();
      }
    });
  }

  render(): void {
    const qs = this.game.quests;
    const tracked = qs.tracked;
    const active = qs.active
      .map((id) => qs.getDef(id)!)
      .map((q) => {
        const objectives = qs
          .objectives(q)
          .map(
            (o) => `
            <li class="${o.done ? 'done' : ''}">
              <span class="qt-check">${o.done ? icon('check') : ''}</span>
              <span>${escapeHtml(o.text)}</span>
              ${o.required > 1 ? `<span class="progress"><span style="width:${(o.current / o.required) * 100}%"></span></span><span class="qt-count">${o.current}/${o.required}</span>` : ''}
            </li>`,
          )
          .join('');
        const items = Object.entries(q.rewards.items ?? {})
          .map(([id, n]) => `<span class="reward">${icon(ITEMS[id as ItemId].icon)}${n} ${escapeHtml(ITEMS[id as ItemId].name)}</span>`)
          .join('');
        const isTracked = tracked?.id === q.id;
        return `
          <article class="quest ${isTracked ? 'tracked' : ''}">
            <header>
              <h3>${escapeHtml(q.title)}</h3>
              ${isTracked ? `<span class="tag tag-gold">${icon('alvo')} Acompanhando</span>` : `<button class="btn btn-small btn-ghost" data-track="${q.id}">${icon('alvo')} Acompanhar</button>`}
            </header>
            <p>${escapeHtml(q.description)}</p>
            <ul class="objectives">${objectives}</ul>
            <div class="rewards"><span class="reward">${icon('estrela')}${q.rewards.xp} XP</span>${items}</div>
          </article>`;
      })
      .join('');

    const done = [...qs.completed]
      .map((id) => qs.getDef(id))
      .filter((q) => q)
      .map((q) => `<li>${icon('check')}<span>${escapeHtml(q!.title)}</span></li>`)
      .join('');

    this.body.innerHTML = `
      <div class="quest-summary">${icon('estrela')} Concluídas: <b>${qs.completed.size}/${qs.totalQuests}</b></div>
      <div class="quest-list">${active || '<p class="muted">Nenhuma missão ativa no momento. Continue explorando!</p>'}</div>
      ${done ? `<details class="completed"><summary>Missões concluídas (${qs.completed.size})</summary><ul>${done}</ul></details>` : ''}`;
  }
}
