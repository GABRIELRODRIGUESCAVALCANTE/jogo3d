/**
 * Decorações sem interação: tufos de grama, flores, samambaias, conchas e
 * troncos na praia. A quantidade exibida muda conforme a qualidade gráfica
 * (usando `InstancedMesh.count`), sem recriar nada.
 */
import * as THREE from 'three';
import { createRandom, randRange } from '../../core/math';
import { addWind, createFlatMaterial } from '../models/geometry';
import { makeDriftwood, makeFern, makeFlower, makeGrassTuft, makeShell } from '../models/props';
import type { HeightField } from './Terrain';
import { PLACES, WORLD_SEED, distanceToPaths } from './layout';

interface DecoLayer {
  mesh: THREE.InstancedMesh;
  max: number;
}

export class Decorations {
  readonly group = new THREE.Group();
  private layers: DecoLayer[] = [];

  constructor(
    private readonly terrain: HeightField,
    private readonly windTime: { value: number },
  ) {
    this.group.name = 'Decorações';
  }

  /** Centro e meia-largura da área onde as decorações são espalhadas. */
  private center = { x: 0, z: 0 };
  private extent = 168;

  generate(area?: { x: number; z: number; extent: number; seed: number }): void {
    if (area) {
      this.center = { x: area.x, z: area.z };
      this.extent = area.extent;
    }
    const random = createRandom(WORLD_SEED + 2 + (area?.seed ?? 0));
    const grassMat = createFlatMaterial({ side: THREE.DoubleSide });
    addWind(grassMat, this.windTime, 0.15, 0.05);

    const nearRuinsOrCave = (x: number, z: number) =>
      Math.hypot(x - PLACES.ruins.x, z - PLACES.ruins.z) < 14 || Math.hypot(x - PLACES.cave.x, z - PLACES.cave.z) < 9;

    this.addLayer(makeGrassTuft(), grassMat, 1800, random, (x, z, h, slope) => h > 1.6 && h < 20 && slope < 0.8 && !nearRuinsOrCave(x, z), [0.8, 1.5], (c) =>
      c.setHSL(0.27 + random() * 0.06, 0.35, 0.9 + random() * 0.15),
    );
    const flowerColors = ['#ff7eb6', '#ffd54f', '#ffffff', '#b388ff', '#ff8a65', '#80d8ff'];
    this.addLayer(makeFlower(), createFlatMaterial(), 420, random, (x, z, h, slope) => h > 1.8 && h < 14 && slope < 0.6 && distanceToPaths(x, z) > 1.5, [0.8, 1.3], (c) =>
      c.set(flowerColors[Math.floor(random() * flowerColors.length)]),
    );
    this.addLayer(makeFern(), createFlatMaterial(), 320, random, (x, z, h, slope) => h > 2.5 && h < 16 && slope < 0.7 && distanceToPaths(x, z) > 2 && !nearRuinsOrCave(x, z), [0.8, 1.5], (c) =>
      c.setHSL(0.33, 0.2, 0.85 + random() * 0.2),
    );
    const shellColors = ['#ffb4a2', '#ffd6a5', '#fdffb6', '#ffc6ff'];
    this.addLayer(makeShell(), createFlatMaterial(), 90, random, (_x, _z, h) => h > 0.1 && h < 1.2, [0.8, 1.4], (c) =>
      c.set(shellColors[Math.floor(random() * shellColors.length)]),
    );
    this.addLayer(makeDriftwood(), createFlatMaterial(), 16, random, (x, z, h) => h > 0.2 && h < 1.1 && Math.hypot(x - PLACES.spawn.x, z - PLACES.spawn.z) > 6, [0.8, 1.2], (c) =>
      c.setHSL(0.08, 0.2, 0.9),
    );
  }

  /** Aplica a densidade (0 a 1) definida pela qualidade gráfica. */
  setDensity(density: number): void {
    for (const layer of this.layers) {
      layer.mesh.count = Math.max(1, Math.floor(layer.max * density));
    }
  }

  private addLayer(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    random: () => number,
    accept: (x: number, z: number, h: number, slope: number) => boolean,
    scaleRange: [number, number],
    colorize: (c: THREE.Color) => void,
  ): void {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 40) {
      attempts++;
      const x = this.center.x + randRange(random, -this.extent, this.extent);
      const z = this.center.z + randRange(random, -this.extent, this.extent);
      const h = this.terrain.getHeight(x, z);
      const slope = this.terrain.getSlope(x, z);
      if (!accept(x, z, h, slope)) continue;
      dummy.position.set(x, h - 0.02, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.setScalar(randRange(random, ...scaleRange));
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      colorize(color);
      mesh.setColorAt(placed, color);
      placed++;
    }
    mesh.count = placed;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = false;
    this.layers.push({ mesh, max: placed });
    this.group.add(mesh);
  }
}
