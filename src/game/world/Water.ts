/**
 * Oceano: uma malha plana com ondas animadas na GPU.
 * A cor de cada vértice depende da profundidade (turquesa no raso,
 * azul-escuro no fundo), sem precisar de texturas.
 */
import * as THREE from 'three';
import { clamp, smoothstep } from '../../core/math';
import { WATER_LEVEL } from './layout';

const SHALLOW = new THREE.Color('#5fe3d6');
const MID = new THREE.Color('#25b3d1');
const DEEP = new THREE.Color('#1462a8');
const FOAM = new THREE.Color('#e9fbff');

export class Water {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = { uTime: { value: 0 }, uWave: { value: 1 } };

  constructor(getHeight: (x: number, z: number) => number) {
    // Grade com faixas: vértices densos (~4,5 m) perto das três ilhas, onde a
    // cor muda com a profundidade, e espaçados no mar aberto (coberto pela névoa).
    const xs = bands([
      [-950, -300, 5],
      [-300, 200, 112],
      [200, 410, 10],
      [410, 710, 70],
      [710, 1000, 6],
    ]);
    const zs = bands([
      [-950, -410, 8],
      [-410, 200, 136],
      [200, 380, 8],
      [380, 660, 62],
      [660, 950, 5],
    ]);
    const vertices = new Float32Array(xs.length * zs.length * 3);
    let v = 0;
    for (const z of zs) {
      for (const x of xs) {
        vertices[v++] = x;
        vertices[v++] = 0;
        vertices[v++] = z;
      }
    }
    const indices: number[] = [];
    const row = xs.length;
    for (let iz = 0; iz < zs.length - 1; iz++) {
      for (let ix = 0; ix < row - 1; ix++) {
        const a = iz * row + ix;
        const b = a + row;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 4);
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const depth = WATER_LEVEL - getHeight(x, z);
      if (depth < 0.35) color.copy(FOAM).lerp(SHALLOW, smoothstep(-0.2, 0.35, depth));
      else if (depth < 3) color.copy(SHALLOW).lerp(MID, smoothstep(0.35, 3, depth));
      else color.copy(MID).lerp(DEEP, smoothstep(3, 9, depth));
      colors[i * 4] = color.r;
      colors[i * 4 + 1] = color.g;
      colors[i * 4 + 2] = color.b;
      // Água rasa é mais transparente (dá para ver a areia).
      colors[i * 4 + 3] = clamp(0.5 + depth * 0.09, 0.5, 0.94);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      transparent: true,
      flatShading: true,
      shininess: 80,
      specular: new THREE.Color('#bfefff'),
      depthWrite: false,
    });
    // Injeta ondas no shader padrão do Three.js.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uWave = this.uniforms.uWave;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWave;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 wPos = modelMatrix * vec4(position, 1.0);
          transformed.y += (sin(wPos.x * 0.16 + uTime * 1.1) * 0.12
                         + cos(wPos.z * 0.13 + uTime * 0.9) * 0.1
                         + sin((wPos.x + wPos.z) * 0.35 + uTime * 1.7) * 0.04) * uWave;`,
        );
    };

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.name = 'Oceano';
    this.mesh.renderOrder = 1;
  }

  /** Altura das ondas (1 = normal; tempestade deixa o mar agitado). */
  setWaves(amount: number): void {
    this.uniforms.uWave.value = amount;
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}

/** Coordenadas de uma linha da grade a partir de faixas [início, fim, divisões]. */
function bands(list: Array<[number, number, number]>): number[] {
  const out: number[] = [];
  for (const [start, end, segments] of list) {
    for (let i = 0; i < segments; i++) out.push(start + ((end - start) * i) / segments);
  }
  out.push(list[list.length - 1][1]);
  return out;
}
