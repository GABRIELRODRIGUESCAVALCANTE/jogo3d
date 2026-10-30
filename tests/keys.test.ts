import { describe, expect, it } from 'vitest';
import { KeyBindings, keyLabel } from '../src/core/KeyBindings';

describe('Teclas configuráveis', () => {
  it('troca a tecla e mantém as setas como extras', () => {
    const k = new KeyBindings();
    expect(k.keys('frente')).toEqual(['KeyW', 'ArrowUp']);
    k.set('frente', 'KeyZ');
    expect(k.keys('frente')).toEqual(['KeyZ', 'ArrowUp']);
    expect(k.matches('frente', 'KeyW')).toBe(false);
  });

  it('se a tecla já era usada, as ações trocam entre si', () => {
    const k = new KeyBindings();
    k.set('interagir', 'KeyF');
    k.set('tocha', 'KeyF');
    expect(k.primary('tocha')).toBe('KeyF');
    expect(k.primary('interagir')).toBe('KeyT');
  });

  it('Esc é reservado e restaurar volta ao padrão', () => {
    const k = new KeyBindings();
    k.set('pular', 'Escape');
    expect(k.primary('pular')).toBe('Space');
    k.set('pular', 'KeyQ');
    k.reset();
    expect(k.primary('pular')).toBe('Space');
    expect(keyLabel('Space')).toBe('Espaço');
    expect(keyLabel('KeyQ')).toBe('Q');
  });
});
