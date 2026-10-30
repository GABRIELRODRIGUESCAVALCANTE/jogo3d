/**
 * Vida selvagem da ilha.
 *
 * - Raposas (modelo glTF animado): passeiam pela floresta, param para farejar
 *   e fogem correndo quando o jogador chega perto.
 * - Caranguejos (modelo feito por código): andam de lado na areia.
 * - Gaivotas: voam em círculos sobre a praia, a montanha e as ruínas.
 * - Peixes: cardumes na água rasa (onde dá para pescar).
 *
 * Caranguejos, gaivotas e peixes usam InstancedMesh: dezenas de animais em
 * poucas chamadas de desenho.
 */
import * as THREE from 'three';
import { createRandom, dampAngle, randRange } from '../../core/math';
import type { CollisionWorld } from '../Collision';
import { createFlatMaterial, merge, part } from '../models/geometry';
import { Animator, type ModelLibrary } from '../models/ModelLibrary';
import type { HeightField } from './Terrain';
import { PLACES, WATER_LEVEL, WORLD_SEED } from './layout';

interface Fox {
  root: THREE.Object3D;
  animator: Animator;
  x: number;
  z: number;
  yaw: number;
  targetYaw: number;
  state: 'idle' | 'walk' | 'run';
  timer: number;
}

interface Crab {
  x: number;
  z: number;
  yaw: number;
  dir: number;
  speed: number;
  timer: number;
  phase: number;
}

interface Bird {
  cx: number;
  cz: number;
  radius: number;
  height: number;
  angle: number;
  speed: number;
  flap: number;
}

interface FishJump {
  t: number;
}

interface Fish {
  school: number;
  angle: number;
  radius: number;
  speed: number;
  depth: number;
  phase: number;
  jump: FishJump | null;
}

export interface FishSchool {
  x: number;
  z: number;
  /** Quanto o cardume se espalha (cresce quando assustado). */
  scatter: number;
  /** Segundos até um peixe saltar para fora da água. */
  jumpTimer: number;
}

const FOX_FILE = 'raposa.glb';
const FOX_LENGTH = 155;
const UP = new THREE.Vector3(0, 1, 0);

export class Wildlife {
  readonly group = new THREE.Group();
  readonly schools: FishSchool[] = [];
  /** Chamado quando um peixe entra ou sai da água (respingo). */
  onSplash: ((x: number, z: number) => void) | null = null;
  private foxes: Fox[] = [];
  private crabs: Crab[] = [];
  private birds: Bird[] = [];
  private fish: Fish[] = [];
  private crabMesh!: THREE.InstancedMesh;
  private birdBody!: THREE.InstancedMesh;
  private birdWings!: THREE.InstancedMesh;
  private fishMesh!: THREE.InstancedMesh;
  private density = 1;
  private readonly random: () => number;
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();
  private readonly wingFlip = new THREE.Matrix4().makeRotationY(Math.PI);
  private readonly wingOffset = new THREE.Matrix4();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);

  /** Centro da ilha onde estes animais vivem e o fator de tamanho da ilha. */
  private readonly cx: number;
  private readonly cz: number;
  private readonly k: number;

  constructor(
    private readonly terrain: HeightField,
    private readonly collision: CollisionWorld,
    private readonly models: ModelLibrary,
    area: { x: number; z: number; scale: number; seed: number } = { x: 0, z: 0, scale: 1, seed: 0 },
  ) {
    this.group.name = 'Fauna';
    this.cx = area.x;
    this.cz = area.z;
    this.k = area.scale;
    this.random = createRandom(WORLD_SEED + 7 + area.seed);
  }

  /** Cria os animais. As raposas chegam depois (o modelo é baixado). */
  build(): void {
    this.buildCrabs(16);
    this.buildBirds(16);
    this.buildFish();
    void this.spawnFoxes(5);
  }

  /** Menos animais visíveis em qualidade baixa. */
  setDensity(density: number): void {
    this.density = density;
    this.crabMesh.count = Math.max(1, Math.round(this.crabs.length * Math.max(0.5, density)));
    const birds = Math.max(1, Math.round(this.birds.length * Math.max(0.5, density)));
    this.birdBody.count = birds;
    this.birdWings.count = birds * 2;
    this.fishMesh.count = Math.max(1, Math.round(this.fish.length * Math.max(0.5, density)));
    this.foxes.forEach((f, i) => (f.root.visible = i < Math.max(2, Math.round(this.foxes.length * density))));
  }

  // ---------------------------------------------------------------------------
  // Raposas (glTF)
  // ---------------------------------------------------------------------------

  private async spawnFoxes(count: number): Promise<void> {
    const spots: Array<[number, number]> = [];
    let attempts = 0;
    while (spots.length < count && attempts++ < 400) {
      const x = this.cx + randRange(this.random, -110, 110) * this.k;
      const z = this.cz + randRange(this.random, -40, 80) * this.k;
      const h = this.terrain.getHeight(x, z);
      if (h < 2.5 || h > 14 || this.terrain.getSlope(x, z) > 0.5) continue;
      if (Math.hypot(x - PLACES.clearing.x, z - PLACES.clearing.z) < 22) continue;
      spots.push([x, z]);
    }
    for (const [x, z] of spots) {
      const model = await this.models.instance(FOX_FILE);
      if (!model) return; // sem o arquivo, a ilha fica sem raposas
      const root = model.root;
      // O modelo original tem ~155 unidades de comprimento: vira ~1,1 m.
      root.scale.setScalar(1.1 / FOX_LENGTH);
      const holder = new THREE.Group();
      holder.add(root);
      this.group.add(holder);
      const fox: Fox = {
        root: holder,
        animator: new Animator(root, model.clips),
        x,
        z,
        yaw: this.random() * Math.PI * 2,
        targetYaw: 0,
        state: 'idle',
        timer: 1 + this.random() * 3,
      };
      fox.targetYaw = fox.yaw;
      fox.animator.play('Survey', 0);
      this.foxes.push(fox);
    }
    this.setDensity(this.density);
  }

  private updateFoxes(dt: number, player: THREE.Vector3, playerRunning: boolean): void {
    for (const fox of this.foxes) {
      if (!fox.root.visible) continue;
      const dx = fox.x - player.x;
      const dz = fox.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 140) continue; // longe demais: nem anima

      const fear = playerRunning ? 11 : 6.5;
      if (dist < fear) {
        fox.state = 'run';
        fox.targetYaw = Math.atan2(dx, dz) + (this.random() - 0.5) * 0.6;
        fox.timer = 2.5;
      } else {
        fox.timer -= dt;
        if (fox.timer <= 0) {
          if (this.random() < 0.4) {
            fox.state = 'idle';
            fox.timer = 2 + this.random() * 4;
          } else {
            fox.state = 'walk';
            fox.targetYaw = fox.yaw + (this.random() - 0.5) * 2.4;
            fox.timer = 3 + this.random() * 5;
          }
        }
      }

      const speed = fox.state === 'run' ? 6.5 : fox.state === 'walk' ? 1.4 : 0;
      fox.yaw = dampAngle(fox.yaw, fox.targetYaw, fox.state === 'run' ? 6 : 3, dt);
      if (speed > 0) {
        const nx = fox.x + Math.sin(fox.yaw) * speed * dt;
        const nz = fox.z + Math.cos(fox.yaw) * speed * dt;
        if (this.canWalk(nx, nz, 0.4)) {
          fox.x = nx;
          fox.z = nz;
        } else {
          // Obstáculo, água ou ladeira: vira para outro lado.
          fox.targetYaw = fox.yaw + Math.PI * (0.6 + this.random() * 0.8);
        }
      }
      fox.root.position.set(fox.x, this.terrain.getHeight(fox.x, fox.z), fox.z);
      fox.root.rotation.y = fox.yaw;
      fox.animator.play(fox.state === 'run' ? 'Run' : fox.state === 'walk' ? 'Walk' : 'Survey', 0.3, fox.state === 'walk' ? 0.8 : 1);
      fox.animator.update(dt);
    }
  }

  /** Terra firme, sem ladeira forte e sem tronco/pedra no caminho. */
  private canWalk(x: number, z: number, radius: number): boolean {
    const h = this.terrain.getHeight(x, z);
    if (h < 1.6 || h > 20 || this.terrain.getSlope(x, z) > 0.75) return false;
    for (const c of this.collision.query(x, z, radius + 2)) {
      if (c.kind === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r + radius) return false;
      if (c.kind === 'box' && Math.abs(x - c.x) < c.hw + c.hd + radius && Math.abs(z - c.z) < c.hw + c.hd + radius) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Caranguejos
  // ---------------------------------------------------------------------------

  private buildCrabs(count: number): void {
    const shell = '#e8553d';
    const parts = [
      part(new THREE.IcosahedronGeometry(0.22, 0), shell, { scale: [1.3, 0.55, 1], pos: [0, 0.14, 0] }),
      part(new THREE.BoxGeometry(0.16, 0.08, 0.12), '#ff7a5c', { pos: [0.3, 0.14, 0.12], rot: [0, -0.5, 0] }),
      part(new THREE.BoxGeometry(0.16, 0.08, 0.12), '#ff7a5c', { pos: [-0.3, 0.14, 0.12], rot: [0, 0.5, 0] }),
      part(new THREE.OctahedronGeometry(0.035, 0), '#ffffff', { pos: [0.07, 0.25, 0.12] }),
      part(new THREE.OctahedronGeometry(0.035, 0), '#ffffff', { pos: [-0.07, 0.25, 0.12] }),
    ];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        parts.push(part(new THREE.BoxGeometry(0.2, 0.03, 0.03), '#c9452f', { pos: [side * 0.25, 0.07, -0.08 + i * 0.08], rot: [0, 0, side * 0.5] }));
      }
    }
    this.crabMesh = new THREE.InstancedMesh(merge(parts), createFlatMaterial(), count);
    this.crabMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crabMesh.frustumCulled = false;
    this.crabMesh.castShadow = true;
    let attempts = 0;
    while (this.crabs.length < count && attempts++ < 3000) {
      const x = this.cx + randRange(this.random, -150, 150) * this.k;
      const z = this.cz + randRange(this.random, -150, 160) * this.k;
      const h = this.terrain.getHeight(x, z);
      if (h < 0.15 || h > 1.3) continue;
      this.crabs.push({ x, z, yaw: this.random() * Math.PI * 2, dir: 1, speed: 0, timer: this.random() * 3, phase: this.random() * 10 });
    }
    this.crabMesh.count = this.crabs.length;
    this.group.add(this.crabMesh);
  }

  private updateCrabs(dt: number, elapsed: number, player: THREE.Vector3): void {
    const n = this.crabMesh.count;
    for (let i = 0; i < n; i++) {
      const c = this.crabs[i];
      const dx = c.x - player.x;
      const dz = c.z - player.z;
      const dist = Math.hypot(dx, dz);
      c.timer -= dt;
      if (dist < 4) {
        // Foge de lado (caranguejo anda de lado!).
        c.yaw = Math.atan2(dx, dz) + Math.PI / 2;
        c.dir = 1;
        c.speed = 3.2;
        c.timer = 1.2;
      } else if (c.timer <= 0) {
        c.timer = 1 + this.random() * 4;
        c.speed = this.random() < 0.5 ? 0 : 0.6 + this.random() * 0.5;
        c.dir = this.random() < 0.5 ? -1 : 1;
        if (this.random() < 0.3) c.yaw += (this.random() - 0.5) * 1.5;
      }
      if (c.speed > 0 && dist < 120) {
        // "Para o lado" = eixo X local do caranguejo.
        const nx = c.x + Math.cos(c.yaw) * c.speed * c.dir * dt;
        const nz = c.z - Math.sin(c.yaw) * c.speed * c.dir * dt;
        const h = this.terrain.getHeight(nx, nz);
        if (h > 0.05 && h < 1.6) {
          c.x = nx;
          c.z = nz;
        } else {
          c.dir *= -1;
        }
      }
      const walking = c.speed > 0;
      const y = this.terrain.getHeight(c.x, c.z) + (walking ? Math.abs(Math.sin(elapsed * 18 + c.phase)) * 0.03 : 0);
      this.q.setFromAxisAngle(UP, c.yaw + (walking ? Math.sin(elapsed * 20 + c.phase) * 0.08 : 0));
      this.p.set(c.x, y, c.z);
      this.s.setScalar(1.4);
      this.m.compose(this.p, this.q, this.s);
      this.crabMesh.setMatrixAt(i, this.m);
    }
    this.crabMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Gaivotas
  // ---------------------------------------------------------------------------

  private buildBirds(count: number): void {
    const body = merge([
      part(new THREE.OctahedronGeometry(0.22, 0), '#ffffff', { scale: [0.8, 0.8, 2.2] }),
      part(new THREE.ConeGeometry(0.05, 0.16, 4), '#ffb02e', { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.52] }),
      part(new THREE.BoxGeometry(0.22, 0.03, 0.2), '#d9dde3', { pos: [0, 0, -0.5] }),
    ]);
    // Asa com o "ombro" na origem, estendida para +X.
    const wing = new THREE.BoxGeometry(0.9, 0.03, 0.3);
    wing.translate(0.45, 0, 0);
    const wingGeo = merge([part(wing, '#f2f4f7'), part(new THREE.BoxGeometry(0.25, 0.031, 0.3).translate(0.78, 0, 0), '#3a3f47')]);
    const mat = createFlatMaterial();
    this.birdBody = new THREE.InstancedMesh(body, mat, count);
    this.birdWings = new THREE.InstancedMesh(wingGeo, mat, count * 2);
    for (const mesh of [this.birdBody, this.birdWings]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
    }
    const centers: Array<[number, number, number]> = [
      [0, 135, 18],
      [-60, 110, 22],
      [96, 6, 28],
      [-12, -100, 62],
      [120, 70, 20],
    ].map(([x, z, h]) => [this.cx + x * this.k, this.cz + z * this.k, h]);
    for (let i = 0; i < count; i++) {
      const [cx, cz, h] = centers[i % centers.length];
      this.birds.push({
        cx: cx + randRange(this.random, -12, 12),
        cz: cz + randRange(this.random, -12, 12),
        radius: randRange(this.random, 14, 38),
        height: h + randRange(this.random, -3, 8),
        angle: this.random() * Math.PI * 2,
        speed: randRange(this.random, 0.18, 0.32) * (this.random() < 0.5 ? -1 : 1),
        flap: this.random() * 10,
      });
    }
    this.group.add(this.birdBody, this.birdWings);
  }

  private updateBirds(dt: number, elapsed: number, night: number): void {
    // À noite as gaivotas vão dormir.
    const visible = night < 0.6;
    this.birdBody.visible = visible;
    this.birdWings.visible = visible;
    if (!visible) return;
    const n = this.birdBody.count;
    for (let i = 0; i < n; i++) {
      const b = this.birds[i];
      b.angle += b.speed * dt;
      const x = b.cx + Math.cos(b.angle) * b.radius;
      const z = b.cz + Math.sin(b.angle) * b.radius;
      const y = b.height + Math.sin(elapsed * 0.6 + i) * 1.5;
      // Direção do voo = tangente do círculo.
      const yaw = Math.atan2(-Math.sin(b.angle) * Math.sign(b.speed), Math.cos(b.angle) * Math.sign(b.speed));
      const bank = Math.sign(b.speed) * 0.35;
      this.q.setFromEuler(this.euler.set(0, yaw, bank, 'YXZ'));
      this.p.set(x, y, z);
      this.s.setScalar(1);
      this.m.compose(this.p, this.q, this.s);
      this.birdBody.setMatrixAt(i, this.m);
      // Bate as asas em ciclos, alternando com planeio.
      const flapping = Math.sin(elapsed * 0.5 + b.flap) > -0.2;
      const wingAngle = flapping ? Math.sin(elapsed * 9 + b.flap) * 0.6 : 0.1;
      for (const side of [1, -1]) {
        // Asa esquerda = asa direita girada 180° (sem espelhar a malha).
        this.m2.makeRotationZ(wingAngle);
        if (side < 0) this.m2.premultiply(this.wingFlip);
        this.wingOffset.makeTranslation(side * 0.12, 0.05, 0);
        this.m2.premultiply(this.wingOffset).premultiply(this.m);
        this.birdWings.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), this.m2);
      }
    }
    this.birdBody.instanceMatrix.needsUpdate = true;
    this.birdWings.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Peixes
  // ---------------------------------------------------------------------------

  private buildFish(): void {
    const geo = merge([
      part(new THREE.OctahedronGeometry(0.2, 0), '#ffffff', { scale: [0.6, 0.9, 2] }),
      part(new THREE.ConeGeometry(0.17, 0.28, 3), '#ffffff', { rot: [-Math.PI / 2, 0, 0], pos: [0, 0, -0.48], scale: [0.3, 1, 1] }),
    ]);
    // Cardumes na água rasa, perto das praias.
    let attempts = 0;
    while (this.schools.length < 9 && attempts++ < 5000) {
      const a = this.random() * Math.PI * 2;
      const r = randRange(this.random, 120, 165) * this.k;
      const x = this.cx + Math.sin(a) * r;
      const z = this.cz + Math.cos(a) * r + 6;
      const depth = WATER_LEVEL - this.terrain.getHeight(x, z);
      if (depth < 0.9 || depth > 3.2) continue;
      if (this.schools.some((s) => Math.hypot(s.x - x, s.z - z) < 25)) continue;
      this.schools.push({ x, z, scatter: 0, jumpTimer: 2 + this.random() * 6 });
    }
    const perSchool = 5;
    const colors = ['#ff9f2e', '#3fd0ff', '#ff5fa8', '#ffe94a'];
    this.fishMesh = new THREE.InstancedMesh(geo, createFlatMaterial(), Math.max(1, this.schools.length * perSchool));
    this.fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fishMesh.frustumCulled = false;
    const color = new THREE.Color();
    this.schools.forEach((_, s) => {
      for (let i = 0; i < perSchool; i++) {
        this.fishMesh.setColorAt(this.fish.length, color.set(colors[s % colors.length]));
        this.fish.push({
          school: s,
          angle: this.random() * Math.PI * 2,
          radius: randRange(this.random, 1.2, 3.2),
          speed: randRange(this.random, 0.6, 1.2) * (i % 2 ? 1 : -1),
          depth: randRange(this.random, 0.18, 0.35),
          phase: this.random() * 10,
          jump: null,
        });
      }
    });
    this.fishMesh.count = this.fish.length;
    this.group.add(this.fishMesh);
  }

  private updateFish(dt: number, elapsed: number, player: THREE.Vector3): void {
    const n = this.fishMesh.count;
    this.schools.forEach((school, si) => {
      const dist = Math.hypot(school.x - player.x, school.z - player.z);
      const near = dist < 5;
      school.scatter = near ? Math.min(1, school.scatter + dt * 2) : Math.max(0, school.scatter - dt * 0.3);
      // De vez em quando um peixe salta (mostra onde há cardume para pescar).
      school.jumpTimer -= dt;
      if (school.jumpTimer <= 0 && dist < 90) {
        school.jumpTimer = 3 + this.random() * 7;
        const candidates = this.fish.filter((f, i) => f.school === si && i < n && !f.jump);
        const f = candidates[Math.floor(this.random() * candidates.length)];
        if (f) f.jump = { t: 0 };
      }
    });
    for (let i = 0; i < n; i++) {
      const f = this.fish[i];
      const school = this.schools[f.school];
      f.angle += f.speed * dt * (1 + school.scatter * 2);
      const r = f.radius * (1 + school.scatter * 2.5);
      const x = school.x + Math.cos(f.angle) * r;
      const z = school.z + Math.sin(f.angle) * r;
      let y = WATER_LEVEL - f.depth + Math.sin(elapsed * 2 + f.phase) * 0.08;
      const yaw = Math.atan2(-Math.sin(f.angle) * Math.sign(f.speed), Math.cos(f.angle) * Math.sign(f.speed));
      let pitch = 0;
      if (f.jump) {
        f.jump.t += dt;
        const k = f.jump.t / 0.9;
        if (k >= 1) {
          f.jump = null;
          this.onSplash?.(x, z);
        } else {
          if (f.jump.t - dt <= 0) this.onSplash?.(x, z);
          y = WATER_LEVEL + Math.sin(k * Math.PI) * 1.1 - 0.2;
          pitch = (k - 0.5) * 2.2;
        }
      }
      this.euler.set(pitch, yaw + Math.sin(elapsed * 12 + f.phase) * 0.15, 0, 'YXZ');
      this.q.setFromEuler(this.euler);
      this.p.set(x, y, z);
      this.s.setScalar(1);
      this.m.compose(this.p, this.q, this.s);
      this.fishMesh.setMatrixAt(i, this.m);
    }
    this.fishMesh.instanceMatrix.needsUpdate = true;
  }

  /** Cardume mais próximo de um ponto (para a pesca). */
  nearestSchool(x: number, z: number, maxDistance: number): FishSchool | null {
    let best: FishSchool | null = null;
    let bestD = maxDistance;
    for (const s of this.schools) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  update(dt: number, elapsed: number, player: THREE.Vector3, playerRunning: boolean, night: number): void {
    this.updateFoxes(dt, player, playerRunning);
    this.updateCrabs(dt, elapsed, player);
    this.updateBirds(dt, elapsed, night);
    this.updateFish(dt, elapsed, player);
  }
}
