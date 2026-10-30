import { describe, expect, it } from 'vitest';
import { DIARY_PAGES, diaryCount } from '../src/game/data/diary';
import { TerrainSet } from '../src/game/world/Terrain';
import { ISLAND_SHAPES } from '../src/game/world/islands';

describe('diário de Iara', () => {
  const terrain = new TerrainSet(ISLAND_SHAPES);

  it('todas as páginas ficam em terra firme e pouco inclinada', () => {
    for (const page of DIARY_PAGES) {
      const h = terrain.getHeight(page.place.x, page.place.z);
      expect(h, `${page.id} altura`).toBeGreaterThan(0.8);
      expect(terrain.getSlope(page.place.x, page.place.z), `${page.id} inclinação`).toBeLessThan(0.7);
    }
  });

  it('cada página tem um marcador e um número únicos', () => {
    expect(new Set(DIARY_PAGES.map((p) => p.id)).size).toBe(DIARY_PAGES.length);
    expect(DIARY_PAGES.map((p) => p.number)).toEqual(DIARY_PAGES.map((_, i) => i + 1));
  });

  it('conta as páginas lidas', () => {
    const lidas = new Set(['diario_1', 'diario_3']);
    expect(diaryCount((f) => lidas.has(f))).toBe(2);
  });
});
