/**
 * Câmera em terceira pessoa que orbita o jogador.
 * - Mouse/arrasto giram a câmera (yaw = horizontal, pitch = vertical).
 * - Roda do mouse aproxima/afasta.
 * - A câmera não entra no terreno nem embaixo d'água.
 */
import * as THREE from 'three';
import { clamp, damp } from '../core/math';
import { WATER_LEVEL } from './world/layout';

export class CameraController {
  yaw = 0;
  pitch = 0.35;
  distance = 7.5;
  minDistance = 3;
  maxDistance = 14;
  /** Limite temporário de distância (ex.: dentro da caverna ou da cabana). */
  distanceLimit = Infinity;
  sensitivity = 1;
  invertY = false;

  private readonly target = new THREE.Vector3();
  private currentDistance = 7.5;
  private initialized = false;
  private readonly tmp = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Aplica o movimento do mouse/toque (em pixels). */
  rotate(dx: number, dy: number): void {
    const k = 0.0032 * this.sensitivity;
    this.yaw -= dx * k;
    this.pitch += dy * k * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -0.35, 1.25);
  }

  zoom(steps: number): void {
    this.distance = clamp(this.distance + steps * 0.9, this.minDistance, this.maxDistance);
  }

  /** Posiciona a câmera atrás de um ângulo, sem suavização. */
  snapBehind(yaw: number): void {
    this.yaw = yaw + Math.PI;
    this.initialized = false;
  }

  update(dt: number, focus: THREE.Vector3, getHeight: (x: number, z: number) => number): void {
    // Alvo: um pouco acima da cabeça do jogador.
    this.tmp.set(focus.x, focus.y + 1.55, focus.z);
    if (!this.initialized) {
      this.target.copy(this.tmp);
      this.currentDistance = Math.min(this.distance, this.distanceLimit);
      this.initialized = true;
    } else {
      this.target.x = damp(this.target.x, this.tmp.x, 14, dt);
      this.target.y = damp(this.target.y, this.tmp.y, 9, dt);
      this.target.z = damp(this.target.z, this.tmp.z, 14, dt);
    }

    const wanted = Math.min(this.distance, this.distanceLimit);
    // Afasta suavemente, mas aproxima rápido (evita atravessar paredes).
    this.currentDistance = damp(this.currentDistance, wanted, wanted < this.currentDistance ? 12 : 3, dt);

    // Encurta a distância se o terreno estiver no caminho.
    const dirX = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dirY = Math.sin(this.pitch);
    const dirZ = Math.cos(this.yaw) * Math.cos(this.pitch);
    let dist = this.currentDistance;
    const samples = 10;
    for (let i = 1; i <= samples; i++) {
      const d = (i / samples) * dist;
      const px = this.target.x + dirX * d;
      const py = this.target.y + dirY * d;
      const pz = this.target.z + dirZ * d;
      if (py < getHeight(px, pz) + 0.45) {
        dist = Math.max(0.8, d - 0.4);
        break;
      }
    }
    if (dist < this.currentDistance) this.currentDistance = dist;

    const camX = this.target.x + dirX * this.currentDistance;
    let camY = this.target.y + dirY * this.currentDistance;
    const camZ = this.target.z + dirZ * this.currentDistance;
    camY = Math.max(camY, getHeight(camX, camZ) + 0.45, WATER_LEVEL + 0.35);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.target);
  }

  /** Câmera cinematográfica do menu: gira devagar em volta de um ponto. */
  orbit(time: number, center: THREE.Vector3, radius: number, height: number): void {
    const a = time * 0.03;
    this.camera.position.set(center.x + Math.sin(a) * radius, center.y + height, center.z + Math.cos(a) * radius);
    this.camera.lookAt(center);
    this.initialized = false;
  }
}
