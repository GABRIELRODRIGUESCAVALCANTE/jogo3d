/**
 * Céu: cúpula com degradê, sol, lua, estrelas e nuvens low-poly.
 * As cores são controladas pelo ciclo de dia e noite (DayNight.ts).
 */
import * as THREE from 'three';
import { createRandom } from '../../core/math';

const SKY_RADIUS = 900;

export class Sky {
  readonly group = new THREE.Group();
  readonly uniforms = {
    topColor: { value: new THREE.Color('#3fa4ff') },
    horizonColor: { value: new THREE.Color('#bfe9ff') },
    bottomColor: { value: new THREE.Color('#8ecbe0') },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color('#fff2c4') },
    sunVisible: { value: 1 },
    moonDir: { value: new THREE.Vector3(0, -1, 0) },
    moonVisible: { value: 0 },
    starVisible: { value: 0 },
  };
  private readonly clouds: THREE.InstancedMesh;
  private readonly cloudMaterial: THREE.MeshLambertMaterial;
  private readonly cloudData: Array<{ x: number; z: number; y: number; s: number; speed: number; rot: number }> = [];
  private readonly dummy = new THREE.Object3D();

  constructor() {
    this.group.name = 'Céu';

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_RADIUS, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // sempre no fundo
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 bottomColor;
          uniform vec3 sunDir;
          uniform vec3 sunColor;
          uniform float sunVisible;
          uniform vec3 moonDir;
          uniform float moonVisible;
          uniform float starVisible;
          varying vec3 vDir;
          float hash13(vec3 p) {
            p = fract(p * 0.1031);
            p += dot(p, p.zyx + 31.32);
            return fract((p.x + p.y) * p.z);
          }
          void main() {
            vec3 dir = normalize(vDir);
            float h = dir.y;
            vec3 col = mix(horizonColor, topColor, pow(max(h, 0.0), 0.55));
            col = mix(col, bottomColor, smoothstep(0.0, -0.2, h));
            float sd = max(dot(dir, sunDir), 0.0);
            col += sunColor * (smoothstep(0.9975, 0.9988, sd) * 1.6 + pow(sd, 14.0) * 0.32 + pow(sd, 4.0) * 0.08) * sunVisible;
            float md = max(dot(dir, moonDir), 0.0);
            col += vec3(0.86, 0.9, 1.0) * (smoothstep(0.9988, 0.9993, md) * 1.1 + pow(md, 60.0) * 0.08) * moonVisible;
            // Estrelas procedurais: algumas células de uma grade 3D acendem um ponto.
            if (starVisible > 0.01 && h > 0.03) {
              vec3 sp = dir * 260.0;
              vec3 cellId = floor(sp);
              float r = hash13(cellId);
              if (r > 0.965) {
                vec3 center = cellId + 0.5;
                float d = length(sp - center);
                float bright = 0.45 + 0.55 * fract(r * 913.0);
                col += vec3(0.95, 0.97, 1.0) * smoothstep(0.42, 0.05, d) * bright * starVisible * smoothstep(0.03, 0.25, h);
              }
            }
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    const random = createRandom(99);

    // Nuvens: alguns "algodões" feitos de esferas facetadas.
    const parts: THREE.BufferGeometry[] = [];
    const puff = (x: number, y: number, z: number, s: number) => {
      const g = new THREE.IcosahedronGeometry(s, 0);
      g.translate(x, y, z);
      parts.push(g);
    };
    puff(0, 0, 0, 6);
    puff(6, -1, 1, 4.5);
    puff(-6, -1.2, -1, 4.8);
    puff(2.5, 2.5, 0, 4);
    puff(-3, 1.5, 2, 3.6);
    const cloudGeo = mergeSimple(parts);
    cloudGeo.scale(1, 0.62, 1);
    this.cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
      fog: false,
      emissive: new THREE.Color('#5d6f86'),
      emissiveIntensity: 0.35,
    });
    const cloudCount = 16;
    this.clouds = new THREE.InstancedMesh(cloudGeo, this.cloudMaterial, cloudCount);
    for (let i = 0; i < cloudCount; i++) {
      const angle = random() * Math.PI * 2;
      const dist = 90 + random() * 240;
      this.cloudData.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        y: 85 + random() * 45,
        s: 1 + random() * 1.6,
        speed: 0.6 + random() * 0.8,
        rot: random() * Math.PI,
      });
    }
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
    this.updateClouds(0);
  }

  /** Centraliza o céu na câmera para que ele pareça infinito. */
  follow(cameraPosition: THREE.Vector3): void {
    this.group.position.set(cameraPosition.x, 0, cameraPosition.z);
  }

  setStarsOpacity(opacity: number): void {
    this.uniforms.starVisible.value = opacity;
  }

  setCloudTint(color: THREE.Color, emissive: THREE.Color): void {
    this.cloudMaterial.color.copy(color);
    this.cloudMaterial.emissive.copy(emissive);
  }

  update(dt: number): void {
    this.updateClouds(dt);
  }

  private updateClouds(dt: number): void {
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      c.x += c.speed * dt;
      if (c.x > 420) c.x = -420;
      this.dummy.position.set(c.x, c.y, c.z);
      this.dummy.rotation.set(0, c.rot, 0);
      this.dummy.scale.setScalar(c.s);
      this.dummy.updateMatrix();
      this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }
}

/** Junta geometrias simples sem índice (apenas posição e normal). */
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  let offset = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array as Float32Array, offset);
    offset += g.attributes.position.count * 3;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.computeVertexNormals();
  return merged;
}
