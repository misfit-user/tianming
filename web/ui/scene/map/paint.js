// 舆图底色：与镜头无关的那部分着色（青绿设色、气候、明暗、颜料颗粒、雪、远看的山脊）开图时烘成大贴图，
// 每帧着色器只取一下，再补近看细节与跟镜头、时间、局势走的东西（shaders.js）。核显上远景一帧原要四五十毫秒，烘后十毫秒内。
// 两张：今设色（高档 4200×3080、低档 2100×1540）与案上旧绢（2100×1540，只在入图、起身那两秒与案上绢图用）。
// 另烘一张明暗（两通道：受光、沟脊；与今设色同大），层级设色（天下、省道两档整片设色）时让山川透上来。
// 先烘一张投影（2100×1540，按高程朝光步进），底色、明暗两张都乘上。
// 入图时设色由旧转新，着色器按 uLookT 在两张之间插，不用每帧重烘。
import * as THREE from 'three';
import { W, H } from './terrain.js';
import { paintFragment } from './shaders.js';
import { LOOK_COLORS, hexRgb } from './looks.js';

const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 噪声贴图：64×64 格的值噪声（四通道各一张），每格四像素按平滑插值画好，可平铺
let noiseTexture = null;
export function noiseTex() {
  if (noiseTexture) return noiseTexture;
  const N = 64, S = 4, R = N * S;
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const lattice = [0, 1, 2, 3].map(() => Float32Array.from({ length: N * N }, rnd));
  const data = new Uint8Array(R * R * 4);
  const fade = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const gx = x / S, gy = y / S;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = fade(gx - x0), fy = fade(gy - y0);
      const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
      for (let c = 0; c < 4; c++) {
        const L = lattice[c];
        const a = L[y0 * N + x0], b = L[y0 * N + x1], d = L[y1 * N + x0], e = L[y1 * N + x1];
        data[(y * R + x) * 4 + c] = Math.round(255 * ((a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy));
      }
    }
  }
  const t = new THREE.DataTexture(data, R, R, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  noiseTexture = t;
  return t;
}

// fields：地形场贴图（fields.js）；relief：明暗按多大的起伏算（定值，与入图时地形升降无关）
export function createPainter(renderer, fields, { hiRes = true, relief = 20, anisotropy = 4 } = {}) {
  const uniforms = {
    uTerrain: { value: fields.terrain }, uHeightHi: { value: fields.heightHi }, uRange: { value: fields.range }, uCoast: { value: fields.coast },
    uTexelHi: { value: new THREE.Vector2(1 / fields.hiW, 1 / fields.hiH) }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
    uBake: { value: new THREE.Vector2() }, uRelief: { value: relief }, uMode: { value: 0 }, uShadow: { value: null },
    uAmp: { value: new THREE.Vector4() }, uBand: { value: new THREE.Vector4() }, uShade: { value: new THREE.Vector4() }
  };
  for (const k of LOOK_COLORS) uniforms[k.u] = { value: new THREE.Vector3() };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: paintFragment, uniforms, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene().add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const target = (w, h, format = THREE.RGBAFormat) => {
    const rt = new THREE.WebGLRenderTarget(w, h, { format, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    rt.texture.anisotropy = anisotropy;
    rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    return rt;
  };
  const fresh = hiRes ? target(W * 2, H * 2) : target(W, H);
  const aged = target(W, H);
  const shade = renderer.capabilities.isWebGL2 ? target(fresh.width, fresh.height, THREE.RGFormat) : target(W, H);
  const shadow = renderer.capabilities.isWebGL2 ? target(W, H, THREE.RedFormat) : target(W, H);
  let shadowReady = null;

  function setLook(look) {
    for (const k of LOOK_COLORS) {
      const c = look[k.key];
      if (c && uniforms[k.u]) uniforms[k.u].value.set(...(typeof c === 'string' ? hexRgb(c) : c).map((v) => v / 255));
    }
    uniforms.uAmp.value.set(...look.amp);
    uniforms.uBand.value.set(...look.band);
    uniforms.uShade.value.set(...look.shade);
  }
  // 烘一张：分条画（每条之间交出主线程、送出显卡命令），免得一大道超过系统的显卡超时
  async function bake(rt, look, mode = 0) {
    if (mode !== 2) await (shadowReady ||= bake(shadow, look, 2));
    uniforms.uShadow.value = mode === 2 ? null : shadow.texture;     // 烘投影那一道不能把自己当贴图挂着
    setLook(look);
    uniforms.uMode.value = mode;
    const w = rt.width, h = rt.height;
    uniforms.uBake.value.set(1 / w, 1 / h);
    const prev = renderer.getRenderTarget();
    const strips = Math.max(1, Math.ceil(h / 800));
    rt.scissorTest = true;                                // 离屏的剪裁归离屏自己管（setRenderTarget 时取用）
    for (let i = 0; i < strips; i++) {
      const y0 = Math.floor(h * i / strips), y1 = Math.floor(h * (i + 1) / strips);
      rt.scissor.set(0, y0, w, y1 - y0);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);                        // 每画一条 three 都重生成多级渐远，末一条之后即齐
      renderer.getContext().flush();
      await new Promise((r) => setTimeout(r, 0));
    }
    rt.scissorTest = false;
    rt.scissor.set(0, 0, w, h);
    renderer.setRenderTarget(prev);
    return rt.texture;
  }
  return {
    fresh, aged, shade,
    bakeFresh: (look) => bake(fresh, look),
    bakeAged: (look) => bake(aged, look),
    bakeShade: (look) => bake(shade, look, 1),
    dispose() { fresh.dispose(); aged.dispose(); shade.dispose(); shadow.dispose(); material.dispose(); quad.geometry.dispose(); }
  };
}
