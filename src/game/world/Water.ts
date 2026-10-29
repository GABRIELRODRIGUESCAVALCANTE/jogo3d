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
  private readonly uniforms = { uTime: { value: 0 } };

  constructor(getHeight: (x: number, z: number) => number) {
    // Grade não uniforme: vértices densos perto da ilha (onde a cor muda
    // conforme a profundidade) e espaçados no mar aberto, coberto pela névoa.
    const segments = 120;
    const geometry = new THREE.PlaneGeometry(2, 2, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const remap = (c: number) => {
      const a = Math.abs(c);
      const inner = 0.75; // 75% dos vértices cobrem ±190 m
      const v = a <= inner ? (a / inner) * 190 : 190 + ((a - inner) / (1 - inner)) ** 2 * 520;
      return Math.sign(c) * v;
    };
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, remap(pos.getX(i)), 0, remap(pos.getZ(i)));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

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
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 wPos = modelMatrix * vec4(position, 1.0);
          transformed.y += sin(wPos.x * 0.16 + uTime * 1.1) * 0.12
                         + cos(wPos.z * 0.13 + uTime * 0.9) * 0.1
                         + sin((wPos.x + wPos.z) * 0.35 + uTime * 1.7) * 0.04;`,
        );
    };

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.name = 'Oceano';
    this.mesh.renderOrder = 1;
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}
