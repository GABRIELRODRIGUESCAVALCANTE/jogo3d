/**
 * Elementos de história espalhados pelo mundo: as páginas do diário de Iara
 * (livrinhos abertos com um brilho em cima) e o papagaio Pipoca, empoleirado
 * num poleiro perto dos destroços.
 */
import * as THREE from 'three';
import type { CollisionWorld } from '../Collision';
import { DIARY_PAGES, type DiaryPage } from '../data/diary';
import type { InteractionSystem } from '../InteractionSystem';
import { createFlatMaterial, merge, part } from '../models/geometry';
import type { HeightField } from './Terrain';
import { PLACES, type Place } from './layout';

export interface StoryHooks {
  hasFlag(flag: string): boolean;
  readPage(page: DiaryPage): void;
  talkToParrot(): void;
}

/** Poleiro do papagaio, ao lado dos destroços (longe do caminho da praia). */
export const PARROT_PLACE: Place = { x: PLACES.shipwreck.x + 4, z: PLACES.shipwreck.z - 5 };

interface PageProp {
  page: DiaryPage;
  sparkle: THREE.Mesh;
}

export class StoryProps {
  readonly group = new THREE.Group();
  private readonly pages: PageProp[] = [];
  private parrot!: THREE.Group;
  private parrotHead!: THREE.Object3D;
  private parrotWings: THREE.Object3D[] = [];
  private flapTimer = 3;
  private flap = 0;
  private readonly material = createFlatMaterial();

  constructor(
    private readonly terrain: HeightField,
    private readonly collision: CollisionWorld,
    private readonly interaction: InteractionSystem,
    private readonly hooks: StoryHooks,
  ) {
    this.group.name = 'História';
    for (const page of DIARY_PAGES) this.buildPage(page);
    this.buildParrot();
  }

  /** Esconde o brilho das páginas já lidas (ao carregar um jogo). */
  applyFlags(): void {
    for (const p of this.pages) p.sparkle.visible = !this.hooks.hasFlag(p.page.id);
  }

  update(dt: number, elapsed: number): void {
    for (const p of this.pages) {
      if (!p.sparkle.visible) continue;
      p.sparkle.rotation.y = elapsed * 1.8;
      p.sparkle.position.y = 0.95 + Math.sin(elapsed * 2.4 + p.page.number) * 0.08;
    }
    // Papagaio: balança a cabeça e, de vez em quando, bate as asas.
    this.parrotHead.rotation.z = Math.sin(elapsed * 1.7) * 0.25;
    this.parrotHead.rotation.y = Math.sin(elapsed * 0.6) * 0.5;
    this.flapTimer -= dt;
    if (this.flapTimer <= 0) {
      this.flapTimer = 3 + Math.random() * 5;
      this.flap = 1.2;
    }
    this.flap = Math.max(0, this.flap - dt);
    const wing = this.flap > 0 ? Math.sin(this.flap * 30) * 0.9 : 0;
    this.parrotWings.forEach((w, i) => (w.rotation.z = (i === 0 ? 1 : -1) * Math.abs(wing)));
    this.parrot.position.y = this.parrotBaseY + (this.flap > 0 ? 0.08 : Math.sin(elapsed * 2) * 0.015);
  }

  private parrotBaseY = 0;

  private buildPage(page: DiaryPage): void {
    const { x, z } = page.place;
    const y = this.terrain.getHeight(x, z);
    const root = new THREE.Group();
    // Pedra com um livrinho aberto em cima.
    const geo = merge([
      part(new THREE.DodecahedronGeometry(0.42, 0), '#8f8a80', { pos: [0, 0.18, 0], scale: [1.2, 0.6, 1] }),
      part(new THREE.BoxGeometry(0.26, 0.04, 0.34), '#f1e6c8', { pos: [-0.13, 0.48, 0], rot: [0, 0, 0.18] }),
      part(new THREE.BoxGeometry(0.26, 0.04, 0.34), '#f6ecd2', { pos: [0.13, 0.48, 0], rot: [0, 0, -0.18] }),
      part(new THREE.BoxGeometry(0.56, 0.03, 0.38), '#7a3f2a', { pos: [0, 0.44, 0] }),
    ]);
    const book = new THREE.Mesh(geo, this.material);
    book.castShadow = true;
    root.add(book);
    const sparkle = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.9 }),
    );
    sparkle.position.y = 0.95;
    root.add(sparkle);
    root.position.set(x, y, z);
    root.rotation.y = page.number * 1.3;
    this.group.add(root);
    this.collision.add({ kind: 'circle', x, z, r: 0.45, top: y + 0.5 });
    this.pages.push({ page, sparkle });

    this.interaction.register({
      id: page.id,
      position: new THREE.Vector3(x, y + 0.6, z),
      radius: 1.4,
      getAction: () => ({
        label: this.hooks.hasFlag(page.id) ? `Reler página ${page.number} do diário` : 'Ler página do diário',
        enabled: true,
      }),
      interact: () => {
        this.hooks.readPage(page);
        sparkle.visible = false;
      },
    });
  }

  private buildParrot(): void {
    const { x, z } = PARROT_PLACE;
    const y = this.terrain.getHeight(x, z);
    // Poleiro: mastro de madeira com uma travessa.
    const perch = new THREE.Mesh(
      merge([
        part(new THREE.CylinderGeometry(0.08, 0.1, 1.7, 6), '#7a5232', { pos: [0, 0.85, 0] }),
        part(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5), '#9a6a3f', { pos: [0, 1.65, 0], rot: [0, 0, Math.PI / 2] }),
        part(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 7), '#7a5232', { pos: [0, 0.06, 0] }),
      ]),
      this.material,
    );
    perch.castShadow = true;
    perch.position.set(x, y, z);
    this.group.add(perch);
    this.collision.add({ kind: 'circle', x, z, r: 0.3, top: y + 1.7 });

    // Papagaio: corpo verde, cabeça vermelha, bico amarelo e asas azuis.
    const bird = new THREE.Group();
    const body = new THREE.Mesh(
      merge([
        part(new THREE.SphereGeometry(0.16, 7, 5), '#3fbf4a', { scale: [1, 1.35, 0.95], pos: [0, 0.2, 0] }),
        part(new THREE.BoxGeometry(0.1, 0.32, 0.05), '#2f8fdc', { pos: [0, -0.02, -0.12], rot: [-0.5, 0, 0] }),
        part(new THREE.BoxGeometry(0.03, 0.1, 0.03), '#5a4630', { pos: [-0.05, 0.02, 0.04] }),
        part(new THREE.BoxGeometry(0.03, 0.1, 0.03), '#5a4630', { pos: [0.05, 0.02, 0.04] }),
      ]),
      this.material,
    );
    bird.add(body);
    const head = new THREE.Group();
    head.position.set(0, 0.42, 0.02);
    head.add(
      new THREE.Mesh(
        merge([
          part(new THREE.SphereGeometry(0.11, 7, 5), '#e63946', {}),
          part(new THREE.ConeGeometry(0.045, 0.12, 5), '#ffd166', { pos: [0, -0.02, 0.12], rot: [Math.PI / 2 + 0.4, 0, 0] }),
          part(new THREE.SphereGeometry(0.025, 5, 4), '#ffffff', { pos: [0.07, 0.03, 0.06] }),
          part(new THREE.SphereGeometry(0.025, 5, 4), '#ffffff', { pos: [-0.07, 0.03, 0.06] }),
          part(new THREE.SphereGeometry(0.013, 4, 3), '#111111', { pos: [0.085, 0.035, 0.075] }),
          part(new THREE.SphereGeometry(0.013, 4, 3), '#111111', { pos: [-0.085, 0.035, 0.075] }),
        ]),
        this.material,
      ),
    );
    bird.add(head);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.14, 0.3, 0);
      const mesh = new THREE.Mesh(part(new THREE.BoxGeometry(0.05, 0.26, 0.2), '#2f8fdc', { pos: [side * 0.02, -0.1, -0.02] }), this.material);
      wing.add(mesh);
      bird.add(wing);
      this.parrotWings.push(wing);
    }
    bird.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
    // Um pouco maior que um papagaio de verdade, para ser visto de longe.
    bird.scale.setScalar(1.7);
    this.parrotBaseY = y + 1.7;
    bird.position.set(x, this.parrotBaseY, z);
    // Olha para a praia (de onde o jogador vem).
    bird.rotation.y = Math.atan2(PLACES.spawn.x - x, PLACES.spawn.z - z);
    this.group.add(bird);
    this.parrot = bird;
    this.parrotHead = head;

    this.interaction.register({
      id: 'papagaio',
      position: new THREE.Vector3(x, y + 1.2, z),
      radius: 1.8,
      getAction: () => ({ label: 'Conversar com o papagaio', enabled: true }),
      interact: () => this.hooks.talkToParrot(),
    });
  }
}
