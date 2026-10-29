/**
 * Experiência (XP) e níveis do jogador.
 */
import type { GameEventBus } from './events';

/** XP total necessário para alcançar cada nível (índice 0 = nível 1). */
const LEVEL_TABLE = [0, 60, 150, 280, 450, 670, 950, 1300, 1720, 2220];

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level - 1 < LEVEL_TABLE.length) return LEVEL_TABLE[level - 1];
  // Depois da tabela, cada nível pede 600 XP a mais que o anterior.
  const extra = level - LEVEL_TABLE.length;
  return LEVEL_TABLE[LEVEL_TABLE.length - 1] + extra * 600 + (extra * (extra - 1) * 50);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export class Progression {
  xp = 0;
  level = 1;

  constructor(private readonly bus?: GameEventBus) {}

  /** Adiciona XP e retorna quantos níveis foram ganhos. */
  addXP(amount: number): number {
    if (amount <= 0) return 0;
    this.xp += Math.round(amount);
    const newLevel = levelForXp(this.xp);
    const gained = newLevel - this.level;
    this.level = newLevel;
    this.bus?.emit('xp:changed', { xp: this.xp, level: this.level, gained: amount });
    if (gained > 0) this.bus?.emit('level:up', { level: this.level });
    return gained;
  }

  /** Progresso (0 a 1) dentro do nível atual. */
  get progress(): number {
    const start = xpForLevel(this.level);
    const end = xpForLevel(this.level + 1);
    return (this.xp - start) / (end - start);
  }

  get xpIntoLevel(): number {
    return this.xp - xpForLevel(this.level);
  }

  get xpForNext(): number {
    return xpForLevel(this.level + 1) - xpForLevel(this.level);
  }

  /** Energia máxima cresce com o nível. */
  get maxEnergy(): number {
    return 100 + (this.level - 1) * 10;
  }

  toJSON(): { xp: number } {
    return { xp: this.xp };
  }

  load(data: { xp: number } | undefined): void {
    this.xp = Math.max(0, Math.floor(data?.xp ?? 0));
    this.level = levelForXp(this.xp);
  }
}
