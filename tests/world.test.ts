import { describe, expect, it } from 'vitest';
import { CollisionWorld, boxesOverlap } from '../src/game/Collision';
import { regionAt } from '../src/game/data/regions';
import { Terrain } from '../src/game/world/Terrain';
import { PLACES, TERRAIN_SEGMENTS, WORLD_HALF, WORLD_SIZE } from '../src/game/world/layout';

describe('Colisão', () => {
  it('empurra o jogador para fora de um tronco', () => {
    const world = new CollisionWorld();
    world.add({ kind: 'circle', x: 0, z: 0, r: 1, top: 10 });
    const pos = { x: 0.5, y: 0, z: 0 };
    world.resolve(pos, 0.4, 1.8, 0.5);
    expect(Math.hypot(pos.x, pos.z)).toBeCloseTo(1.4, 3);
  });

  it('permite subir em obstáculos baixos', () => {
    const world = new CollisionWorld();
    world.add({ kind: 'box', x: 0, z: 0, hw: 2, hd: 2, rot: 0.3, top: 0.3 });
    const pos = { x: 0.5, y: 0, z: 0.5 };
    const support = world.resolve(pos, 0.4, 1.8, 0.5);
    expect(support).toBe(0.3);
    expect(pos.x).toBe(0.5);
  });

  it('detecta caixas giradas sobrepostas', () => {
    const a = { x: 0, z: 0, hw: 1, hd: 1, rot: 0 };
    expect(boxesOverlap(a, { x: 1.9, z: 0, hw: 1, hd: 1, rot: Math.PI / 4 })).toBe(true);
    expect(boxesOverlap(a, { x: 3, z: 0, hw: 1, hd: 1, rot: Math.PI / 4 })).toBe(false);
  });
});

describe('Terreno', () => {
  const terrain = new Terrain();
  terrain.generateHeights();

  it('a altura consultada bate com os vértices da malha', () => {
    const cell = WORLD_SIZE / TERRAIN_SEGMENTS;
    for (const [ix, iz] of [
      [10, 10],
      [72, 72],
      [100, 30],
    ]) {
      const x = -WORLD_HALF + ix * cell;
      const z = -WORLD_HALF + iz * cell;
      expect(terrain.getHeight(x, z)).toBeCloseTo(terrain.heights[iz * (TERRAIN_SEGMENTS + 1) + ix], 4);
    }
  });

  it('a geografia faz sentido', () => {
    const spawn = terrain.getHeight(PLACES.spawn.x, PLACES.spawn.z);
    expect(spawn).toBeGreaterThan(0.2);
    expect(spawn).toBeLessThan(2);
    expect(terrain.getHeight(PLACES.peak.x, PLACES.peak.z)).toBeGreaterThan(35);
    expect(terrain.getHeight(0, 175)).toBeLessThan(0); // mar ao sul
    expect(regionAt(PLACES.spawn.x, PLACES.spawn.z)?.id).toBe('praia');
    expect(regionAt(PLACES.cave.x, PLACES.cave.z)?.id).toBe('caverna');
  });
});

describe('Ilha da Aurora', () => {
  it('tem praia, colina do observatório e mar entre as ilhas', async () => {
    const { TerrainSet } = await import('../src/game/world/Terrain');
    const { ISLAND_SHAPES, AURORA_PLACES } = await import('../src/game/world/islands');
    const set = new TerrainSet(ISLAND_SHAPES);
    // Antes de gerar, a altura vem da fórmula; depois, da malha (quase igual).
    const antes = set.getHeight(AURORA_PLACES.observatory.x, AURORA_PLACES.observatory.z);
    set.get('aurora').generateHeights();
    const depois = set.getHeight(AURORA_PLACES.observatory.x, AURORA_PLACES.observatory.z);
    expect(Math.abs(antes - depois)).toBeLessThan(0.5);
    expect(depois).toBeGreaterThan(15);
    const praia = set.getHeight(AURORA_PLACES.beach.x, AURORA_PLACES.beach.z);
    expect(praia).toBeGreaterThan(0);
    expect(praia).toBeLessThan(2.5);
    expect(set.getHeight(280, -130)).toBeLessThan(-5); // mar aberto no meio
    expect(regionAt(AURORA_PLACES.observatory.x, AURORA_PLACES.observatory.z)?.id).toBe('observatorio');
  });
});
