/**
 * Gerenciador de luzes pontuais (fogueiras, tochas, cristais).
 *
 * Cada luz extra deixa a renderização mais pesada, e mudar o número de luzes
 * faz o Three.js recompilar shaders (causando travadas). Por isso usamos um
 * número FIXO de luzes e as entregamos às fontes mais próximas do jogador.
 */
import * as THREE from 'three';

export interface LightSource {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  distance: number;
  flicker: boolean;
  /** Só acende à noite (lanternas). */
  nightOnly: boolean;
  enabled: boolean;
}

export class LightManager {
  readonly group = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private sources = new Set<LightSource>();
  private time = 0;
  private sorted: LightSource[] = [];

  constructor(count: number) {
    this.group.name = 'Luzes';
    this.setCount(count);
  }

  /** Muda a quantidade de luzes (só quando a qualidade gráfica muda). */
  setCount(count: number): void {
    for (const l of this.lights) this.group.remove(l);
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      light.castShadow = false;
      this.lights.push(light);
      this.group.add(light);
    }
  }

  add(source: Omit<LightSource, 'enabled'> & { enabled?: boolean }): LightSource {
    const s: LightSource = { enabled: true, ...source };
    this.sources.add(s);
    return s;
  }

  remove(source: LightSource): void {
    this.sources.delete(source);
  }

  update(dt: number, focus: THREE.Vector3, night: number): void {
    this.time += dt;
    this.sorted.length = 0;
    for (const s of this.sources) {
      if (!s.enabled) continue;
      if (s.nightOnly && night < 0.05) continue;
      if (s.position.distanceToSquared(focus) > 70 * 70) continue;
      this.sorted.push(s);
    }
    this.sorted.sort((a, b) => a.position.distanceToSquared(focus) - b.position.distanceToSquared(focus));

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const s = this.sorted[i];
      // Importante: nunca usar `visible = false` (mudaria o número de luzes
      // no shader e causaria recompilação). Basta zerar a intensidade.
      if (!s) {
        light.intensity = 0;
        continue;
      }
      light.position.copy(s.position);
      light.color.copy(s.color);
      light.distance = s.distance;
      let intensity = s.intensity * (s.nightOnly ? night : 1);
      if (s.flicker) {
        const t = this.time + i * 3.1;
        intensity *= 0.85 + Math.sin(t * 13) * 0.07 + Math.sin(t * 23.7) * 0.05 + Math.sin(t * 7.3) * 0.05;
      }
      light.intensity = intensity;
    }
  }
}
