/**
 * Jogador: movimento, corrida, pulo, gravidade, natação, energia e animação.
 */
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/math';
import type { CollisionWorld } from './Collision';
import { createCharacter, type CharacterRig, type HeldTool } from './models/Character';
import { WATER_LEVEL, WORLD_LIMIT_RADIUS } from './world/layout';

export interface PlayerInput {
  /** x = direita, y = frente (relativo à câmera). */
  move: { x: number; y: number };
  sprint: boolean;
  jump: boolean;
  jumpHeld: boolean;
}

export interface PlayerEnvironment {
  getHeight: (x: number, z: number) => number;
  collision: CollisionWorld;
}

const WALK_SPEED = 5;
const RUN_SPEED = 8.6;
const SWIM_SPEED = 3.2;
const GRAVITY = 26;
const JUMP_SPEED = 9.2;
const RADIUS = 0.38;
const HEIGHT = 1.8;
const STEP_HEIGHT = 0.5;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.14;

export class Player {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  /** Direção para onde o personagem olha (radianos). */
  yaw = Math.PI;
  grounded = true;
  swimming = false;
  energy = 100;
  maxEnergy = 100;
  /** Segundos restantes do bônus "Bem alimentado". */
  buffTime = 0;
  /** Velocidade horizontal atual (para animação e sons). */
  speed = 0;
  torchOn = false;

  readonly rig: CharacterRig;

  /** Eventos para sons e partículas. */
  onStep: ((surface: 'sand' | 'grass' | 'rock' | 'water') => void) | null = null;
  onJump: (() => void) | null = null;
  onLand: ((impact: number) => void) | null = null;
  onSplash: (() => void) | null = null;
  onBoundary: (() => void) | null = null;

  private coyote = 0;
  private jumpBuffer = 0;
  private walkPhase = 0;
  private lastStepSign = 0;
  private actionTime = 0;
  private actionDuration = 0.45;
  private actionTool: HeldTool = 'none';
  private energyRegenDelay = 0;
  private wasSwimming = false;
  private airTime = 0;
  private idleTime = 0;

  constructor() {
    this.rig = createCharacter();
  }

  get object(): THREE.Group {
    return this.rig.root;
  }

  /** Posiciona o jogador (ao começar ou carregar). */
  teleport(x: number, y: number, z: number, yaw = this.yaw): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = yaw;
  }

  /** Inicia a animação de golpe (cortar, minerar, colher). */
  playAction(tool: HeldTool): void {
    this.actionTime = this.actionDuration;
    this.actionTool = tool;
  }

  get isActing(): boolean {
    return this.actionTime > 0;
  }

  /** Come algo: recupera energia. */
  eat(energy: number, buffSeconds = 0): void {
    this.energy = Math.min(this.maxEnergy, this.energy + energy);
    if (buffSeconds > 0) this.buffTime = Math.max(this.buffTime, buffSeconds);
  }

  update(dt: number, input: PlayerInput, cameraYaw: number, env: PlayerEnvironment): void {
    const { getHeight, collision } = env;
    const pos = this.position;

    // --- Direção desejada (relativa à câmera) ---
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    let dirX = forwardX * input.move.y + rightX * input.move.x;
    let dirZ = forwardZ * input.move.y + rightZ * input.move.x;
    const dirLen = Math.hypot(dirX, dirZ);
    const inputMag = Math.min(1, dirLen);
    if (dirLen > 0.001) {
      dirX /= dirLen;
      dirZ /= dirLen;
    }

    // --- Energia e corrida ---
    const buffed = this.buffTime > 0;
    if (this.buffTime > 0) this.buffTime = Math.max(0, this.buffTime - dt);
    const wantsRun = input.sprint && inputMag > 0.1 && !this.swimming && this.energy > 1;
    if (wantsRun) {
      this.energy = Math.max(0, this.energy - dt * (buffed ? 7 : 14));
      this.energyRegenDelay = 1;
    } else {
      this.energyRegenDelay -= dt;
      if (this.energyRegenDelay <= 0) this.energy = Math.min(this.maxEnergy, this.energy + dt * (buffed ? 16 : 8));
    }

    // --- Água ---
    const groundH = getHeight(pos.x, pos.z);
    const waterDepth = WATER_LEVEL - groundH;
    this.swimming = waterDepth > 1.15;
    if (this.swimming && !this.wasSwimming) this.onSplash?.();
    this.wasSwimming = this.swimming;

    let targetSpeed = this.swimming ? SWIM_SPEED : wantsRun ? RUN_SPEED : WALK_SPEED;
    if (!this.swimming && waterDepth > 0.4) targetSpeed *= 0.7; // andando na água rasa
    if (this.isActing && this.grounded) targetSpeed *= 0.35;
    targetSpeed *= inputMag;

    // Rampas íngremes deixam o jogador mais lento ao subir.
    if (inputMag > 0.01 && !this.swimming) {
      const ahead = getHeight(pos.x + dirX * 0.8, pos.z + dirZ * 0.8);
      const rise = (ahead - groundH) / 0.8;
      if (rise > 0.45) targetSpeed *= clamp(1 - (rise - 0.45) * 0.9, 0.25, 1);
    }

    // --- Aceleração horizontal ---
    const control = this.grounded || this.swimming ? 14 : 4;
    this.velocity.x = damp(this.velocity.x, dirX * targetSpeed, control, dt);
    this.velocity.z = damp(this.velocity.z, dirZ * targetSpeed, control, dt);

    // --- Pulo (com tolerância de "coyote time" e buffer) ---
    this.coyote = this.grounded ? COYOTE_TIME : this.coyote - dt;
    this.jumpBuffer = input.jump ? JUMP_BUFFER : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0 && !this.swimming) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.energy = Math.max(0, this.energy - 3);
      this.onJump?.();
    }
    // Soltar o botão cedo faz um pulo mais baixo.
    if (!input.jumpHeld && this.velocity.y > 3) this.velocity.y -= GRAVITY * dt * 0.8;

    // --- Gravidade ---
    if (this.swimming) {
      const floatY = WATER_LEVEL - 1.05 + Math.sin(performance.now() * 0.003) * 0.05;
      this.velocity.y = damp(this.velocity.y, (floatY - pos.y) * 4, 6, dt);
    } else {
      this.velocity.y -= GRAVITY * dt;
    }

    // --- Integração ---
    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;
    pos.y += this.velocity.y * dt;

    // Limite do mundo: o oceano é grande demais para nadar.
    const distCenter = Math.hypot(pos.x, pos.z);
    if (distCenter > WORLD_LIMIT_RADIUS) {
      pos.x *= WORLD_LIMIT_RADIUS / distCenter;
      pos.z *= WORLD_LIMIT_RADIUS / distCenter;
      this.onBoundary?.();
    }

    // --- Colisões com obstáculos e chão ---
    const support = collision.resolve(pos, RADIUS, HEIGHT, STEP_HEIGHT);
    const terrain = getHeight(pos.x, pos.z);
    const floor = Math.max(terrain, support);
    const wasGrounded = this.grounded;
    if (pos.y <= floor + 0.02 && this.velocity.y <= 0.01) {
      // Sobe degraus pequenos suavemente; cai de verdade em degraus grandes.
      pos.y = floor;
      if (!wasGrounded) {
        if (this.airTime > 0.25) this.onLand?.(Math.min(1, -this.velocity.y / 20));
        this.airTime = 0;
      }
      this.velocity.y = 0;
      this.grounded = true;
    } else if (wasGrounded && this.velocity.y <= 0 && pos.y - floor < 0.45 && !this.swimming) {
      // Desce rampas sem "flutuar".
      pos.y = floor;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = this.swimming;
      if (!this.swimming) this.airTime += dt;
    }
    if (this.swimming && pos.y < floor) pos.y = floor;

    // --- Rotação do personagem para a direção do movimento ---
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speed = horizSpeed;
    if (horizSpeed > 0.4 && inputMag > 0.05) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.velocity.x, this.velocity.z), 12, dt);
    }

    this.animate(dt, horizSpeed, groundH, waterDepth);
  }

  /** Olha para um ponto (usado ao interagir com algo). */
  faceTowards(x: number, z: number): void {
    this.yaw = Math.atan2(x - this.position.x, z - this.position.z);
  }

  /** Animação procedural (balanço de braços e pernas). */
  private animate(dt: number, speed: number, groundH: number, waterDepth: number): void {
    const rig = this.rig;
    rig.root.position.copy(this.position);
    rig.root.rotation.y = this.yaw;

    const moving = speed > 0.3;
    const run = speed > 6.5;
    this.walkPhase += dt * speed * (this.swimming ? 1.2 : 1.9);
    const swing = moving ? Math.sin(this.walkPhase) * (run ? 0.85 : 0.6) : 0;
    this.idleTime = moving ? 0 : this.idleTime + dt;

    // Passos: um som a cada meia volta do ciclo.
    const sign = Math.sign(Math.sin(this.walkPhase));
    if (moving && this.grounded && sign !== this.lastStepSign && sign !== 0) {
      const surface: 'sand' | 'grass' | 'rock' | 'water' =
        waterDepth > 0.2 ? 'water' : groundH < 1.6 ? 'sand' : groundH > 20 ? 'rock' : 'grass';
      this.onStep?.(surface);
    }
    this.lastStepSign = sign;

    const legs = this.grounded ? swing : 0.5;
    rig.leftLeg.rotation.x = damp(rig.leftLeg.rotation.x, this.swimming ? Math.sin(this.walkPhase * 2) * 0.4 : legs, 18, dt);
    rig.rightLeg.rotation.x = damp(rig.rightLeg.rotation.x, this.swimming ? -Math.sin(this.walkPhase * 2) * 0.4 : this.grounded ? -swing : -0.3, 18, dt);

    // Corpo inclina para frente na corrida e balança ao respirar parado.
    const breathe = Math.sin(this.idleTime * 2.2) * 0.015;
    rig.body.rotation.x = damp(rig.body.rotation.x, this.swimming ? 0.9 : run ? 0.18 : 0.04, 8, dt);
    rig.body.position.y = moving && this.grounded ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : breathe;
    rig.head.rotation.x = this.swimming ? -0.7 : 0;

    // Braços: golpe tem prioridade sobre a caminhada.
    if (this.actionTime > 0) {
      this.actionTime = Math.max(0, this.actionTime - dt);
      const t = 1 - this.actionTime / this.actionDuration; // 0 → 1
      // Levanta rápido, desce com força e volta.
      const angle = t < 0.4 ? -0.6 - (t / 0.4) * 1.9 : t < 0.65 ? -2.5 + ((t - 0.4) / 0.25) * 2.1 : -0.4 + ((t - 0.65) / 0.35) * 0.4;
      rig.rightArm.rotation.x = angle;
      rig.rightArm.rotation.z = 0;
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, -0.3, 10, dt);
    } else {
      const torchHold = this.torchOn ? -0.9 : 0;
      rig.leftArm.rotation.x = damp(rig.leftArm.rotation.x, this.swimming ? -2.6 + Math.sin(this.walkPhase * 2) : -swing * 0.9, 14, dt);
      rig.rightArm.rotation.x = damp(rig.rightArm.rotation.x, this.swimming ? -2.6 - Math.sin(this.walkPhase * 2) : torchHold || swing * 0.9, 14, dt);
      rig.leftArm.rotation.z = damp(rig.leftArm.rotation.z, this.grounded ? 0.08 : 0.5, 10, dt);
      rig.rightArm.rotation.z = damp(rig.rightArm.rotation.z, this.grounded ? -0.08 : -0.5, 10, dt);
    }

    // Ferramenta visível: a do golpe atual, ou a tocha acesa.
    const shown: HeldTool = this.actionTime > 0 ? this.actionTool : this.torchOn ? 'tocha' : 'none';
    for (const [name, obj] of Object.entries(rig.tools)) obj.visible = name === shown;
    if (shown === 'tocha') {
      const flicker = 1 + Math.sin(performance.now() * 0.025) * 0.12 + Math.sin(performance.now() * 0.041) * 0.08;
      rig.flame.scale.set(flicker, 1.6 * flicker, flicker);
    }
  }
}
