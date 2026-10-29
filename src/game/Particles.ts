/**
 * Partículas simples (lascas de madeira, poeira, faíscas).
 * Usa um único InstancedMesh com um número fixo de cubinhos reaproveitados.
 */
import * as THREE from 'three';

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
  gravity: number;
}

const MAX = 220;

export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly pool: Particle[] = [];
  private next = 0;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();

  constructor() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'Partículas';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) {
      this.pool.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.1, spin: 0, gravity: 9 });
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, this.color.set('#ffffff'));
    }
  }

  /** Solta um punhado de partículas a partir de um ponto. */
  burst(
    position: THREE.Vector3,
    color: THREE.ColorRepresentation,
    count = 8,
    opts: { speed?: number; up?: number; size?: number; life?: number; gravity?: number; spread?: number } = {},
  ): void {
    const speed = opts.speed ?? 3;
    const up = opts.up ?? 3;
    const spread = opts.spread ?? 0.3;
    this.color.set(color);
    for (let i = 0; i < count; i++) {
      const index = this.next;
      this.next = (this.next + 1) % MAX;
      const p = this.pool[index];
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.alive = true;
      p.x = position.x + (Math.random() - 0.5) * spread;
      p.y = position.y + (Math.random() - 0.5) * spread;
      p.z = position.z + (Math.random() - 0.5) * spread;
      p.vx = Math.cos(angle) * s;
      p.vz = Math.sin(angle) * s;
      p.vy = up * (0.5 + Math.random() * 0.8);
      p.maxLife = (opts.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = (opts.size ?? 0.12) * (0.6 + Math.random() * 0.8);
      p.spin = Math.random() * 10;
      p.gravity = opts.gravity ?? 12;
      const c = this.color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      this.mesh.setColorAt(index, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let any = false;
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.dummy.scale.setScalar(0);
      } else {
        alive++;
        p.vy -= p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 0.98;
        p.vz *= 0.98;
        const k = p.life / p.maxLife;
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.rotation.set(p.spin * k, p.spin * 0.7 * k, 0);
        this.dummy.scale.setScalar(p.size * Math.min(1, k * 2));
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = alive > 0 || any;
  }
}
