// 舆图地形场：在显卡上算（原先在 CPU 上逐像素算，载入要十几秒）。
// 入料只有两样：真实高程 dem.png（4200×3080，R 高字节 G 低字节，值 = 海拔米 + 11000）与山河境矢量（海岸、河湖）。
// 出：一组半浮点贴图（与旧 CPU 版同一算法：盒式模糊三遍近似高斯、滑窗极值、有符号海岸距离），
//     外加 CPU 上要用的几张小场（拾取、题名落点、点叶筛选），从显卡读回一次。
import * as THREE from 'three';
import { W, H } from './terrain.js';

const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function makeRunner(renderer) {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const scene = new THREE.Scene().add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const materials = new Map();
  const free = new Map();                       // 用完的离屏按规格回池，下一道复用，免得显存堆到几百兆
  const live = new Set();
  const keyOf = new WeakMap();                  // 离屏 → 规格键（RenderTarget 没有 userData）
  const FORMAT = { 1: THREE.RedFormat, 2: THREE.RGFormat, 4: THREE.RGBAFormat };
  function target(w, h, { channels = 1, type = THREE.HalfFloatType, filter = THREE.LinearFilter } = {}) {
    const key = [w, h, channels, type, filter].join(':');
    const pool = free.get(key);
    let rt = pool && pool.pop();
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(w, h, { type, format: FORMAT[channels], depthBuffer: false, magFilter: filter, minFilter: filter, generateMipmaps: false });
      rt.texture.wrapS = rt.texture.wrapT = THREE.ClampToEdgeWrapping;
      keyOf.set(rt, key);
    }
    live.add(rt);
    return rt;
  }
  function release(...rts) {
    for (const rt of rts) {
      if (!rt || !live.has(rt)) continue;
      live.delete(rt);
      const k = keyOf.get(rt);
      if (!free.has(k)) free.set(k, []);
      free.get(k).push(rt);
    }
  }
  // 跑一道：frag 片元着色器，uniforms 入料，写进 out
  function run(key, frag, uniforms, out) {
    let m = materials.get(key);
    if (!m) {
      const u = {};
      for (const [k, v] of Object.entries(uniforms)) u[k] = { value: v };
      m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false });
      materials.set(key, m);
    } else {
      // 着色器编好后渲染器只认最初那个 uniforms 对象：就地改值，别换对象
      for (const [k, v] of Object.entries(uniforms)) m.uniforms[k].value = v;
    }
    quad.material = m;
    renderer.setRenderTarget(out);
    renderer.render(scene, cam);
    return out;
  }
  function dispose(keep = []) {
    for (const rt of live) if (!keep.includes(rt)) rt.dispose();
    for (const list of free.values()) for (const rt of list) if (!keep.includes(rt)) rt.dispose();
    for (const m of materials.values()) m.dispose();
    quad.geometry.dispose();
  }
  // 交出一帧：把已提交的活儿先送出去，免得几十道攒成一大批、超过系统的显卡超时
  async function breathe() {
    renderer.getContext().flush();
    await new Promise((r) => setTimeout(r, 0));     // 不等整帧：舞台此时多半在画书房，等一帧就白搭一帧
  }
  return { target, release, run, dispose, breathe };
}

// ---------- 着色器 ----------
// 真实高程解码：R 高字节、G 低字节 → 海拔/6000（海里为负）
const DECODE = /* glsl */`
uniform sampler2D tDem;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDem, vUv);
  float v = (floor(c.r * 255.0 + 0.5) * 256.0 + floor(c.g * 255.0 + 0.5) - 11000.0) / 6000.0;
  gl_FragColor = vec4(v, max(v, 0.0), 0.0, 1.0);
}`;
// 2×2 平均降到世界网格：R 陆高（夹到 0 以上）、G 海深（夹到 0 以上）
const DOWN = /* glsl */`
uniform sampler2D tHi;
uniform vec2 uHiTexel;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5 * uHiTexel;
  float s = texture2D(tHi, p).r + texture2D(tHi, p + vec2(uHiTexel.x, 0.0)).r + texture2D(tHi, p + vec2(0.0, uHiTexel.y)).r + texture2D(tHi, p + uHiTexel).r;
  float lo = s * 0.25;
  gl_FragColor = vec4(max(lo, 0.0), max(-lo, 0.0), 0.0, 1.0);
}`;
// 一维盒式模糊（边缘夹取），四个通道一起走
// 半径做成编译期常数（每个半径一个着色器）：循环次数固定，核显上不至于一道跑太久
const BOX = (r) => /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec4 s = vec4(0.0);
  vec2 lo = uStep * 0.5 * sign(uStep), hi = vec2(1.0) - abs(uStep) * 0.5;
  for (int i = -${r}; i <= ${r}; i++) s += texture2D(tSrc, clamp(vUv + uStep * float(i), lo, hi));
  gl_FragColor = s / ${(2 * r + 1).toFixed(1)};
}`;
// 一维滑窗极值：R 取最小、G 取最大（入料 R、G 都是同一高度）
const EXTREME = (r) => /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  float lo = 1e9, hi = -1e9;
  for (int i = -${r}; i <= ${r}; i++) {
    vec2 q = vUv + uStep * float(i);
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) continue;
    vec4 c = texture2D(tSrc, q);
    lo = min(lo, c.r);
    hi = max(hi, c.g);
  }
  gl_FragColor = vec4(lo, hi, 0.0, 1.0);
}`;
const PICK = /* glsl */`
uniform sampler2D tA;
uniform vec4 uMask;
uniform sampler2D tB;
uniform vec4 uMaskB;
varying vec2 vUv;
void main() {
  // 两张场各取一个通道拼成 RG
  gl_FragColor = vec4(dot(texture2D(tA, vUv), uMask), dot(texture2D(tB, vUv), uMaskB), 0.0, 1.0);
}`;
// 山系场原料：高出大半径模糊多少（夹到 0~1）
const MASSIF = /* glsl */`
uniform sampler2D tTerrain;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tTerrain, vUv);
  gl_FragColor = vec4(clamp((t.r - t.b) / 0.10, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;
// 跳跃泛洪（JFA）：种子是「另一侧」的像素，求每点到最近种子的距离
const JFA_INIT = /* glsl */`
uniform sampler2D tMask;
uniform float uWant;
varying vec2 vUv;
void main() {
  float land = step(0.5, texture2D(tMask, vUv).r);
  // 种子：不属于本侧的像素（land != uWant）
  gl_FragColor = abs(land - uWant) > 0.5 ? vec4(vUv, 0.0, 1.0) : vec4(-1.0, -1.0, 0.0, 1.0);
}`;
const JFA_STEP = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uJump;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vec2 best = texture2D(tSrc, vUv).xy;
  float bd = best.x < 0.0 ? 1e20 : dot((best - vUv) * uSize, (best - vUv) * uSize);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 q = vUv + vec2(float(x), float(y)) * uTexel * uJump;
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) continue;
    vec2 s = texture2D(tSrc, q).xy;
    if (s.x < 0.0) continue;
    float d = dot((s - vUv) * uSize, (s - vUv) * uSize);
    if (d < bd) { bd = d; best = s; }
  }
  gl_FragColor = vec4(best, 0.0, 1.0);
}`;
// 有符号海岸距离：陆上为正、海里为负（世界像素），半像素修正让 0 等值线落在两像素之间
const COAST = /* glsl */`
uniform sampler2D tMask;
uniform sampler2D tIn;
uniform sampler2D tOut;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  float land = step(0.5, texture2D(tMask, vUv).r);
  vec2 a = texture2D(tIn, vUv).xy, b = texture2D(tOut, vUv).xy;
  float dIn = a.x < 0.0 ? 1e4 : length((a - vUv) * uSize);
  float dOut = b.x < 0.0 ? 1e4 : length((b - vUv) * uSize);
  gl_FragColor = vec4(land > 0.5 ? dIn - 0.5 : -(dOut - 0.5), 0.0, 0.0, 1.0);
}`;

function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.flipY = false;                                   // 画布第 0 行（世界 y=0）对 v=0，与其余场同向
  t.premultiplyAlpha = false;
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 海岸面：陆地轮廓按奇偶规则填白（不透明黑底，覆盖率直接在 RGB 里）
function landCanvas(env) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  for (const p of env.landPaths) g.fill(new Path2D(p.d), 'evenodd');
  return c;
}

// 河湖：2 倍分辨率画线。R 干流与湖、G 支流；黑底不透明，RGB 即覆盖率（等于原先「去预乘后乘回 alpha」）
export function riverCanvas(env, scale = 2) {
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighter';           // 两色相叠时通道各自累加（与旧版分通道取值一致）
  g.scale(scale, scale);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgb(0,255,0)';
  g.lineWidth = 0.6;
  for (const r of env.rivers) if (!r.major) g.stroke(new Path2D(r.d));
  g.strokeStyle = 'rgb(255,0,0)';
  g.lineWidth = 1.3;
  for (const r of env.rivers) if (r.major) g.stroke(new Path2D(r.d));
  g.fillStyle = 'rgb(255,0,0)';
  g.beginPath();
  for (const lake of env.lakeFaces) {
    const f = lake.f;
    for (let i = 0; i + 5 < f.length; i += 6) {
      g.moveTo(f[i], f[i + 1]);
      g.lineTo(f[i + 2], f[i + 3]);
      g.lineTo(f[i + 4], f[i + 5]);
      g.closePath();
    }
  }
  g.fill();
  return c;
}

// 主入口：demImage 为已载入的 dem.png，env 为山河境矢量。返回贴图与 CPU 小场
export async function buildFieldsGPU(renderer, demImage, env, { hiRes = true } = {}) {
  const R = makeRunner(renderer);
  const prevTarget = renderer.getRenderTarget();
  // 调试：window.__tmFieldsDebug 为真时逐步打耗时（每步先 finish 等显卡做完，所以打开时会慢一些）
  const debug = typeof window !== 'undefined' && window.__tmFieldsDebug;
  let tPrev = performance.now();
  const step = (name) => {
    if (!debug) return;
    renderer.getContext().finish();
    const now = performance.now();
    console.log(`[fields] ${name} ${(now - tPrev).toFixed(0)}ms`);
    tPrev = now;
  };
  const hiW = demImage.width, hiH = demImage.height;
  const dem = new THREE.Texture(demImage);
  dem.colorSpace = THREE.NoColorSpace;
  dem.premultiplyAlpha = false;
  dem.flipY = false;
  dem.generateMipmaps = false;
  dem.minFilter = dem.magFilter = THREE.NearestFilter;
  dem.needsUpdate = true;

  // 1) 解码原分辨率高程：R 原值（含海里负值）、G 陆高
  const hi = R.run('decode', DECODE, { tDem: dem }, R.target(hiW, hiH, { channels: 2, filter: THREE.NearestFilter }));
  // 2) 降到世界网格：R 陆高、G 海深
  step('decode');
  const base = R.run('down', DOWN, { tHi: hi.texture, uHiTexel: new THREE.Vector2(1 / hiW, 1 / hiH) }, R.target(W, H, { channels: 2 }));
  const tx = new THREE.Vector2(1 / W, 0), ty = new THREE.Vector2(0, 1 / H);
  // 盒式模糊若干遍（横、竖各一道为一遍）；入料不动，返回新离屏
  const blur = async (src, r, passes, channels = 1) => {
    let a = src;
    for (let p = 0; p < passes; p++) {
      const b = R.run('box' + r, BOX(r), { tSrc: a.texture, uStep: tx }, R.target(W, H, { channels }));
      if (a !== src) R.release(a);
      a = R.run('box' + r, BOX(r), { tSrc: b.texture, uStep: ty }, R.target(W, H, { channels }));
      R.release(b);
      await R.breathe();
    }
    return a;
  };
  const extreme = async (src, r) => {
    const b = R.run('ext' + r, EXTREME(r), { tSrc: src.texture, uStep: tx }, R.target(W, H, { channels: 2, filter: THREE.NearestFilter }));
    await R.breathe();
    const out = R.run('ext' + r, EXTREME(r), { tSrc: b.texture, uStep: ty }, R.target(W, H, { channels: 2, filter: THREE.NearestFilter }));
    R.release(b);
    await R.breathe();
    return out;
  };
  const pick = (a, ma, b, mb, channels) => R.run('pick', PICK, { tA: a.texture, uMask: ma, tB: (b || a).texture, uMaskB: mb || new THREE.Vector4() }, R.target(W, H, { channels }));
  const RX = new THREE.Vector4(1, 0, 0, 0), GX = new THREE.Vector4(0, 1, 0, 0);

  step('down');
  const height = pick(base, RX, null, null, 1);                  // 陆高
  const depthRaw = pick(base, GX, null, null, 1);
  R.release(base);
  const small = await blur(height, 1, 2);
  step('small');
  const wide = await blur(height, 28, 3);
  step('wide');
  const depth = await blur(depthRaw, 6, 3);
  R.release(depthRaw);
  // 地形 RGBA：R 高、G 微糊、B 大半径糊
  const terrain = R.run('pack3', /* glsl */`
    uniform sampler2D tH; uniform sampler2D tS; uniform sampler2D tW; varying vec2 vUv;
    void main() { gl_FragColor = vec4(texture2D(tH, vUv).r, texture2D(tS, vUv).r, texture2D(tW, vUv).r, 0.0); }`,
  { tH: height.texture, tS: small.texture, tW: wide.texture }, R.target(W, H, { channels: 4 }));
  R.release(small, wide);
  step('depth+terrain');
  const massifRaw = R.run('massif', MASSIF, { tTerrain: terrain.texture }, R.target(W, H));
  const massif = await blur(massifRaw, 2, 2);
  R.release(massifRaw);
  const aux = pick(massif, RX, depth, RX, 2);                    // R 山系、G 海深
  R.release(massif, depth);
  // 局部起伏范围：滑窗极值再糊开
  const hh = pick(height, RX, height, RX, 2);
  R.release(height);
  const r12 = await extreme(hh, 12), r30 = await extreme(hh, 30);
  R.release(hh);
  step('extremes');
  const r12b = await blur(r12, 6, 3, 2), r30b = await blur(r30, 14, 3, 2);
  step('range blur');
  R.release(r12, r30);
  const range = R.run('pack4', /* glsl */`
    uniform sampler2D tA; uniform sampler2D tB; varying vec2 vUv;
    void main() { vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv); gl_FragColor = vec4(a.r, a.g, b.r, b.g); }`,
  { tA: r12b.texture, tB: r30b.texture }, R.target(W, H, { channels: 4 }));
  R.release(r12b, r30b);

  // 3) 海岸：陆面 → 两侧 JFA → 有符号距离
  const landTex = canvasTexture(landCanvas(env));
  step('land canvas');
  const jfa = async (want) => {
    const spec = { channels: 2, type: THREE.FloatType, filter: THREE.NearestFilter };
    let a = R.run('jfaInit', JFA_INIT, { tMask: landTex, uWant: want }, R.target(W, H, spec));
    let b = R.target(W, H, spec);
    for (let jump = 1024; jump >= 1; jump >>= 1) {
      R.run('jfaStep', JFA_STEP, { tSrc: a.texture, uTexel: new THREE.Vector2(1 / W, 1 / H), uJump: jump, uSize: new THREE.Vector2(W, H) }, b);
      [a, b] = [b, a];
      if (jump % 8 === 0) await R.breathe();
    }
    R.release(b);
    return a;
  };
  const dIn = await jfa(1), dOut = await jfa(0);
  step('jfa');
  const coast = R.run('coast', COAST, { tMask: landTex, tIn: dIn.texture, tOut: dOut.texture, uSize: new THREE.Vector2(W, H) }, R.target(W, H));
  R.release(dIn, dOut);

  // 4) 河湖：画布直接上传
  step('coast');
  const rivers = new THREE.CanvasTexture(riverCanvas(env, 2));
  step('rivers');
  rivers.colorSpace = THREE.NoColorSpace;
  rivers.flipY = false;
  rivers.generateMipmaps = false;
  rivers.minFilter = rivers.magFilter = THREE.LinearFilter;

  // 5) CPU 上要用的小场：R 微糊高（拾取、题名落点）、G 山系、B 大半径起伏幅、A 陆高（点叶筛选）
  const cpuRT = R.target(W, H, { channels: 4, type: THREE.FloatType, filter: THREE.NearestFilter });
  R.run('cpu', /* glsl */`
    uniform sampler2D tT; uniform sampler2D tAux; uniform sampler2D tRange; varying vec2 vUv;
    void main() { vec4 t = texture2D(tT, vUv), r = texture2D(tRange, vUv); gl_FragColor = vec4(t.g, texture2D(tAux, vUv).r, r.a - r.b, t.r); }`,
  { tT: terrain.texture, tAux: aux.texture, tRange: range.texture }, cpuRT);
  step('cpu pack');
  const px = new Float32Array(W * H * 4);
  renderer.readRenderTargetPixels(cpuRT, 0, 0, W, H, px);
  step('readback');
  const heightSmall = new Float32Array(W * H), massifF = new Float32Array(W * H), relief = new Float32Array(W * H), heightF = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {               // 读回的行与贴图同序（uv 原点在左下，世界 y 向下）：这里的 v 即世界 y
    heightSmall[i] = px[i * 4];
    massifF[i] = px[i * 4 + 1];
    relief[i] = px[i * 4 + 2];
    heightF[i] = px[i * 4 + 3];
  }
  renderer.setRenderTarget(prevTarget);

  // 原分辨率陆高：低档不要
  let hiLand = null;
  if (hiRes) {
    hiLand = R.run('hiLand', /* glsl */`uniform sampler2D tHi; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tHi, vUv).g, 0.0, 0.0, 1.0); }`,
      { tHi: hi.texture }, R.target(hiW, hiH));
  }
  R.release(hi, cpuRT);
  step('hiLand');
  const keep = [terrain, aux, range, coast, hiLand].filter(Boolean);
  R.dispose(keep);
  dem.dispose();
  landTex.dispose();
  renderer.setRenderTarget(prevTarget);
  return {
    textures: {
      terrain: terrain.texture, aux: aux.texture, range: range.texture, coast: coast.texture, rivers,
      heightHi: hiLand ? hiLand.texture : terrain.texture, hiW: hiLand ? hiW : W, hiH: hiLand ? hiH : H
    },
    cpu: { heightSmall, massif: massifF, relief, height: heightF },
    targets: keep
  };
}
