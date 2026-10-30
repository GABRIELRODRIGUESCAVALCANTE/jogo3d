import { describe, expect, it } from 'vitest';
import { WeatherSystem, WEATHER_NAMES } from '../src/game/Weather';
import { SAVE_VERSION, validateSave } from '../src/game/save/SaveData';
import * as THREE from 'three';

describe('clima', () => {
  it('muda sozinho quando o tempo acaba e avisa a mudança', () => {
    const w = new WeatherSystem(10);
    const seen: string[] = [];
    w.onChange = (k) => seen.push(k);
    w.set('limpo', 1);
    const cam = new THREE.Vector3();
    // Simula 2 horas de jogo: o clima tem de passar por vários estados.
    for (let t = 0; t < 7200; t += 0.5) w.update(0.5, t, cam, true);
    expect(seen.length).toBeGreaterThan(3);
    for (const k of seen) expect(Object.keys(WEATHER_NAMES)).toContain(k);
    // Tempestade só vem depois de nuvens ou chuva (nunca direto do céu limpo).
    for (let i = 1; i < seen.length; i++) if (seen[i] === 'tempestade') expect(seen[i - 1]).not.toBe('limpo');
  });

  it('não muda enquanto o jogo está pausado', () => {
    const w = new WeatherSystem(10);
    w.set('chuva', 3, true);
    for (let t = 0; t < 100; t++) w.update(0.5, t, new THREE.Vector3(), false);
    expect(w.kind).toBe('chuva');
    expect(w.raining).toBe(true);
  });

  it('transição suave da chuva e relâmpagos só na tempestade', () => {
    const w = new WeatherSystem(10);
    let flashes = 0;
    w.onLightning = () => flashes++;
    w.set('chuva', 1000);
    expect(w.rain).toBe(0);
    for (let t = 0; t < 60; t += 0.1) w.update(0.1, t, new THREE.Vector3(), true);
    expect(w.rain).toBeGreaterThan(0.6);
    expect(flashes).toBe(0);
    w.set('tempestade', 1000);
    for (let t = 0; t < 60; t += 0.1) w.update(0.1, t, new THREE.Vector3(), true);
    expect(flashes).toBeGreaterThan(2);
    expect(w.waves).toBeGreaterThan(2.5);
  });

  it('o salvamento guarda o clima (e ignora um clima malformado)', () => {
    const base = {
      version: SAVE_VERSION,
      savedAt: 1,
      playTime: 1,
      player: { x: 0, y: 0, z: 0, yaw: 0, energy: 50, torch: false, buffTime: 0, hunger: 80 },
      inventory: {},
      progression: { xp: 0 },
      quests: { active: [], completed: [], progress: {}, tracked: null },
      structures: [],
      stats: { gathered: 0, crafted: 0, built: 0 },
    };
    const ok = validateSave({ ...base, world: { time: 8, day: 1, nodes: {}, weather: { kind: 'chuva', timer: 42 } } });
    expect(ok?.world.weather).toEqual({ kind: 'chuva', timer: 42 });
    const bad = validateSave({ ...base, world: { time: 8, day: 1, nodes: {}, weather: { kind: 3 } } });
    expect(bad?.world.weather).toBeUndefined();
  });
});
