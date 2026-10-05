// 舞台：全前端唯一一个 WebGL 渲染器。场景以「视图」挂上来（书房、舆图……），同一时刻画一个视图，
// 转场时画两个、按比例交叉淡换。视图各管各的场景、镜头与后期，交给舞台的只有这几样：
//   view = { name, update(t, dt), render(renderer, target), resize(w, h, dpr), alwaysUpdate?, dispose() }
//   render 往 target 里画「可直接上屏」的颜色（已做色调映射与 sRGB 编码）；target 为 null 即上屏。
import * as THREE from 'three';
import { quality } from '../core/quality.js';
import { bus } from '../core/bus.js';

const COMPOSITE = {
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tA;
    uniform sampler2D tB;
    uniform float uMix;
    varying vec2 vUv;
    void main() { gl_FragColor = mix(texture2D(tA, vUv), texture2D(tB, vUv), uMix); }`
};

export function createStage(container, { preserve = false } = {}) {
  const q = quality();
  const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;          // 各视图自己做色调映射
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = 'stage-canvas';
  container.append(renderer.domElement);

  const size = { w: 1, h: 1, dpr: renderer.getPixelRatio() };
  const views = new Map();
  const mix = { a: null, b: null, k: 0 };
  const hooks = new Set();
  let rtA = null, rtB = null;
  const composite = new THREE.ShaderMaterial({ uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 } }, ...COMPOSITE, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene().add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function ensureTargets() {
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    for (const key of ['A', 'B']) {
      const rt = key === 'A' ? rtA : rtB;
      if (rt && rt.width === buf.x && rt.height === buf.y) continue;
      rt?.dispose();
      const next = new THREE.WebGLRenderTarget(buf.x, buf.y, { depthBuffer: false });
      if (key === 'A') rtA = next; else rtB = next;
    }
  }

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    if (w === size.w && h === size.h) return;
    size.w = w;
    size.h = h;
    renderer.setSize(w, h);
    for (const v of views.values()) v.resize?.(w, h, size.dpr);
    bus.emit('stage:resize', { ...size });
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ---------- 循环 ----------
  const clock = new THREE.Clock();
  let running = true, frozen = false, frames = 0;
  const frameWaiters = [];
  function visible() {
    const out = [];
    if (mix.a && (mix.k < 1 || !mix.b)) out.push(views.get(mix.a));
    if (mix.b && mix.k > 0) out.push(views.get(mix.b));
    return out.filter(Boolean);
  }
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (frozen) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    const live = visible();
    for (const v of views.values()) if (live.includes(v) || v.alwaysUpdate) v.update?.(t, dt);
    if (live.length === 1) {
      live[0].render(renderer, null);
    } else if (live.length === 2) {
      ensureTargets();
      live[0].render(renderer, rtA);
      live[1].render(renderer, rtB);
      composite.uniforms.tA.value = rtA.texture;
      composite.uniforms.tB.value = rtB.texture;
      composite.uniforms.uMix.value = mix.k;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    }
    for (const fn of hooks) fn(t, dt);
    frames++;
    while (frameWaiters.length && frameWaiters[0].at <= frames) frameWaiters.shift().resolve();
  }
  requestAnimationFrame(tick);

  // 渐变：fadeTo(视图名, 秒) 从当前视图交叉淡到另一个
  let fadeToken = 0;
  function fadeTo(name, seconds = 0.6, ease = (x) => x * x * (3 - 2 * x)) {
    if (!views.has(name)) return Promise.reject(new Error(`舞台上没有视图 ${name}`));
    if (!mix.a || mix.a === name || seconds <= 0) {
      mix.a = name;
      mix.b = null;
      mix.k = 0;
      return Promise.resolve();
    }
    const token = ++fadeToken;
    mix.b = name;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        if (token !== fadeToken) return resolve();
        const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
        mix.k = ease(k);
        if (k < 1 && !frozen) requestAnimationFrame(step);
        else if (k >= 1) { mix.a = name; mix.b = null; mix.k = 0; resolve(); }
      };
      step();
    });
  }

  return {
    renderer,
    canvas: renderer.domElement,
    size,
    quality: q,
    add(view) {
      views.set(view.name, view);
      view.resize?.(size.w, size.h, size.dpr);
      if (!mix.a) mix.a = view.name;
      return view;
    },
    remove(name) {
      const v = views.get(name);
      if (!v) return;
      views.delete(name);
      if (mix.a === name) mix.a = mix.b || [...views.keys()][0] || null;
      if (mix.b === name) mix.b = null;
      v.dispose?.();
    },
    view: (name) => views.get(name),
    get current() { return mix.b && mix.k >= 0.5 ? mix.b : mix.a; },
    show(name) { return fadeTo(name, 0); },
    fadeTo,
    // 手动指定交叉比例（转场编排自己掌握节奏时用）
    setMix(a, b, k) { fadeToken++; mix.a = a; mix.b = b; mix.k = k; },
    onFrame(fn) { hooks.add(fn); return () => hooks.delete(fn); },
    nextFrames(n = 1) { return new Promise((resolve) => frameWaiters.push({ at: frames + n, resolve })); },
    // 截图定格：停在当前这一帧
    freeze() { frozen = true; },
    thaw() { frozen = false; clock.getDelta(); },
    get frozen() { return frozen; },
    dispose() {
      running = false;
      ro.disconnect();
      for (const v of views.values()) v.dispose?.();
      views.clear();
      rtA?.dispose();
      rtB?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
