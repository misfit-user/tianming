// 舆图视图：同一份真地形、剧本府州，青绿山水画法，挂到舞台上。
// 输入的府州数据是纯数据（由适配层从内核取）：{ regions: [{ name, poly, center, faction, … }], factions: { id: { name, color, short } } }，
// 坐标为舆图世界坐标（2100×1540）。府州易主后调 setOwnership 重画疆界。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { W, H, loadImage, decodeDem, coastField, riverMask, regionIdMap, realms as computeRealms, blur, realmBorderDistance, localRange } from './terrain.js';
import { buildFieldsGPU } from './fields.js';
import { terrainVertex, terrainFragment, treeFragment, pointsVertex } from './shaders.js';
import { LOOK_QINGLV, LOOK_COLORS, RELIEF, BACKGROUND, VIEWS, hexRgb, swatchFor } from './looks.js';
import { quality } from '../../core/quality.js';
import { SHEET_EXTENT } from '../world.js';

const ASSETS = new URL('../../assets/map/', import.meta.url).href;
const ENV_URL = new URL('../../../vendor/shanhe25d/environment.js', import.meta.url).href;
const INFO_W = 4096, PALETTE_W = 256;

// ---------- 地形场：与剧本无关 ----------
// 入料（dem.png、山河境矢量）全页只载一次；场在显卡上算（fields.js），不支持浮点离屏的设备退回 CPU 算。
let sourcePromise = null;
function loadEnvironment() {
  return new Promise((resolve, reject) => {
    if (window.TM_SHANHE_ENV) return resolve(window.TM_SHANHE_ENV);
    const s = document.createElement('script');
    s.src = ENV_URL;
    s.onload = () => resolve(window.TM_SHANHE_ENV);
    s.onerror = () => reject(new Error('山河境环境数据载入失败'));
    document.head.append(s);
  });
}
export function loadTerrainSource() {
  if (!sourcePromise) sourcePromise = Promise.all([loadImage(ASSETS + 'dem.png'), loadEnvironment()]).then(([dem, env]) => ({ dem, env }));
  return sourcePromise;
}

function halfTexture(channels, w, h, format) {
  const count = channels.length;
  const out = new Uint16Array(w * h * count);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < count; c++) out[i * count + c] = THREE.DataUtils.toHalfFloat(channels[c][i]);
  const t = new THREE.DataTexture(out, w, h, format, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// CPU 退路：与 fields.js 同一算法，逐像素在主线程算（慢，十秒上下）
function buildFieldsCPU(demImg, env, { hiRes }) {
  const dem = decodeDem(demImg);
  const height = Float32Array.from(dem.lo, (v) => Math.max(v, 0));
  const depth = blur(Float32Array.from(dem.lo, (v) => Math.max(-v, 0)), W, H, 6, 3);
  const heightSmall = blur(height, W, H, 1, 2);
  const heightWide = blur(height, W, H, 28, 3);
  const massifRaw = Float32Array.from(height, (v, i) => Math.min(1, Math.max(0, (v - heightWide[i]) / 0.10)));
  const massif = blur(massifRaw, W, H, 2, 2);
  const range = localRange(height, W, H, 12, 6), rangeWide = localRange(height, W, H, 30, 14);
  const rivers = riverMask(env, 2);
  const riverTex = new THREE.DataTexture(rivers.data, rivers.width, rivers.height, THREE.RGFormat, THREE.UnsignedByteType);
  riverTex.magFilter = riverTex.minFilter = THREE.LinearFilter;
  riverTex.needsUpdate = true;
  const relief = Float32Array.from(rangeWide.hi, (v, i) => v - rangeWide.lo[i]);
  return {
    textures: {
      terrain: halfTexture([height, heightSmall, heightWide, new Float32Array(W * H)], W, H, THREE.RGBAFormat),
      aux: halfTexture([massif, depth], W, H, THREE.RGFormat),
      coast: halfTexture([coastField(env)], W, H, THREE.RedFormat),
      range: halfTexture([range.lo, range.hi, rangeWide.lo, rangeWide.hi], W, H, THREE.RGBAFormat),
      rivers: riverTex,
      heightHi: hiRes ? halfTexture([Float32Array.from(dem.hi, (v) => Math.max(v, 0))], dem.width, dem.height, THREE.RedFormat) : halfTexture([height], W, H, THREE.RedFormat),
      hiW: hiRes ? dem.width : W, hiH: hiRes ? dem.height : H
    },
    cpu: { heightSmall, massif, relief, height },
    targets: []
  };
}

const fieldsByRenderer = new WeakMap();
export async function terrainFields(renderer, { hiRes = true } = {}) {
  if (!fieldsByRenderer.has(renderer)) {
    fieldsByRenderer.set(renderer, (async () => {
      const { dem, env } = await loadTerrainSource();
      const gpu = !window.__tmForceCpuFields && renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
      const fields = gpu ? await buildFieldsGPU(renderer, dem, env, { hiRes }) : buildFieldsCPU(dem, env, { hiRes });
      fields.env = env;
      fields.path = gpu ? 'gpu' : 'cpu';
      return fields;
    })());
  }
  return fieldsByRenderer.get(renderer);
}

function gridGeometry(cols, rows) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
  let p = 0, q = 0;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      pos[p++] = i / cols * W; pos[p++] = 0; pos[p++] = j / rows * H;
      uv[q++] = i / cols; uv[q++] = j / rows;
    }
  }
  const idx = new Uint32Array(cols * rows * 6);
  let k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, dd = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b;
      idx[k++] = b; idx[k++] = c; idx[k++] = dd;
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// 点层：items 经 map() 得 [x, 高度(0~1), y, 尺寸, 类型]
function pointsLayer(items, map, uniforms, fragmentShader, sizeMul, fade, clampPx = [0.0, 10.0]) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(items.length * 3), size = new Float32Array(items.length), type = new Float32Array(items.length);
  items.forEach((it, i) => {
    const [x, h, y, s, t] = map(it, i);
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = y;
    size[i] = s; type[i] = t;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aType', new THREE.BufferAttribute(type, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, fragmentShader, vertexShader: pointsVertex(sizeMul, fade, clampPx) }));
  pts.frustumCulled = false;
  return pts;
}

// 题名用的简称（剧本势力若带 short 字段就用它）
const SHORT = { '明朝廷': '大明', '荷兰·台海(东印度公司)': '荷兰', '西班牙·马尼拉': '西班牙', '大越黎郑阮格局': '大越', '虾夷地与松前氏': '虾夷', '吐鲁番诸伯克': '吐鲁番', '野人女真诸部': '野人女真', '葡萄牙·澳门': '澳门', '瓦刺诸部': '瓦剌' };

export async function createMapView(stage, { regions, factions, labelLayer = null, view = 'world', fov = 30, primary } = {}) {
  const q = quality();
  const renderer = stage.renderer;
  const F = await terrainFields(renderer, { hiRes: q.mapHiRes });
  const d = { env: F.env, ...F.cpu };
  const data = { regions, factions };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color().setRGB(...hexRgb(BACKGROUND).map((v) => v / 255), THREE.LinearSRGBColorSpace);
  const camera = new THREE.PerspectiveCamera(fov, stage.size.w / stage.size.h, 5, 20000);
  const controls = new OrbitControls(camera, stage.canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 120;
  controls.maxDistance = 2600;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.2;

  // ---------- 府州与势力 ----------
  const ids = regionIdMap(regions, 2);
  const idBytes = new Uint8Array(ids.data.length * 2);
  for (let i = 0; i < ids.data.length; i++) { idBytes[i * 2] = ids.data[i] & 255; idBytes[i * 2 + 1] = ids.data[i] >> 8; }
  const regionTex = new THREE.DataTexture(idBytes, ids.width, ids.height, THREE.RGFormat, THREE.UnsignedByteType);
  regionTex.magFilter = THREE.NearestFilter;
  regionTex.minFilter = THREE.NearestFilter;
  regionTex.needsUpdate = true;
  const info = new Uint8Array(INFO_W * 4);
  const infoTex = new THREE.DataTexture(info, INFO_W, 1, THREE.RGBAFormat);
  const paletteData = new Uint8Array(PALETTE_W * 4);
  const paletteTex = new THREE.DataTexture(paletteData, PALETTE_W, 1, THREE.RGBAFormat);
  const borderTex = new THREE.DataTexture(new Uint16Array(W * H), W, H, THREE.RedFormat, THREE.HalfFloatType);
  borderTex.magFilter = THREE.LinearFilter;
  borderTex.minFilter = THREE.LinearFilter;
  let realmList = [];
  const primaryRe = primary ? new RegExp(primary) : undefined;
  function applyPolitics() {
    realmList = computeRealms(data);
    const realmIndex = new Map(realmList.map((r, i) => [r.id, i]));
    const regionRealm = new Int16Array(regions.length + 1).fill(-1);
    regions.forEach((r, i) => { regionRealm[i + 1] = realmIndex.has(r.faction) ? realmIndex.get(r.faction) : -1; });
    info.fill(0);
    for (let i = 1; i < regionRealm.length && i < INFO_W; i++) info[i * 4] = regionRealm[i] >= 0 ? regionRealm[i] : 255;
    infoTex.needsUpdate = true;
    paletteData.fill(0);
    realmList.forEach((r, i) => { if (i < PALETTE_W) paletteData.set([...hexRgb(swatchFor(r.name, r.color, primaryRe ? { primary: primaryRe } : undefined)), 255], i * 4); });
    paletteTex.needsUpdate = true;
    const border = realmBorderDistance(ids, regionRealm);
    const half = borderTex.image.data;
    for (let i = 0; i < W * H; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(border[i], 200));
    borderTex.needsUpdate = true;
  }
  applyPolitics();

  const uniforms = {
    uTerrain: { value: F.textures.terrain },
    uBorder: { value: borderTex },
    uAux: { value: F.textures.aux },
    uCoast: { value: F.textures.coast },
    uRiver: { value: F.textures.rivers },
    uRegion: { value: regionTex }, uRegionInfo: { value: infoTex }, uPalette: { value: paletteTex },
    uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
    // 低档不载原分辨率高程，用世界网格那一份代替
    uHeightHi: { value: F.textures.heightHi },
    uTexelHi: { value: new THREE.Vector2(1 / F.textures.hiW, 1 / F.textures.hiH) },
    uRelief: { value: RELIEF }, uTime: { value: 0 }, uZoom: { value: 0 },
    uHover: { value: -1 }, uSelected: { value: -1 }, uCam: { value: new THREE.Vector3() },
    uFogColor: { value: new THREE.Vector3(0.91, 0.87, 0.78) }, uFogNear: { value: 1e6 }, uFogFar: { value: 2e6 }, uPolitical: { value: 1 },
    uPx: { value: stage.size.h / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))) },
    uRange: { value: F.textures.range },
    uAmp: { value: new THREE.Vector4() }, uBand: { value: new THREE.Vector4() }, uShade: { value: new THREE.Vector4() }
  };
  for (const k of LOOK_COLORS) uniforms[k.u] = { value: new THREE.Vector3() };
  const terrain = new THREE.Mesh(gridGeometry(...q.mapGrid), new THREE.ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: terrainFragment, uniforms }));
  terrain.frustumCulled = false;
  scene.add(terrain);

  const sample = (field) => (x, y) => field[Math.max(0, Math.min(H - 1, Math.round(y))) * W + Math.max(0, Math.min(W - 1, Math.round(x)))];
  const heightAt = sample(d.heightSmall);
  const massifAt = sample(d.massif);
  if (q.trees) {
    let s = 41;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const forested = (x, y) => {
      const i = Math.max(0, Math.min(W - 1, Math.round(x))) + Math.max(0, Math.min(H - 1, Math.round(y))) * W;
      return d.relief[i] > 0.12 && d.height[i] < 0.6;
    };
    const trees = d.env.trees.filter((t) => massifAt(t[0], t[1]) > 0.08 && forested(t[0], t[1]));
    scene.add(pointsLayer(trees, (t) => [t[0], heightAt(t[0], t[1]), t[1], t[2] * (0.7 + 0.5 * rnd()), t[3]], uniforms, treeFragment, 2.0, [2.4, 4.4]));
  }

  // ---------- 题名（DOM 层） ----------
  let labels = [];
  function buildLabels() {
    if (!labelLayer) return;
    labelLayer.replaceChildren();
    labels = [];
    realmList.forEach((r) => {
      if (r.area < 400) return;
      const el = document.createElement('div');
      el.className = 'm-lbl realm';
      el.textContent = factions[r.id]?.short || SHORT[r.name] || r.name;
      labelLayer.append(el);
      labels.push({ el, x: r.x, y: r.y, size: Math.max(16, Math.min(64, Math.sqrt(r.area) * 0.16)), kind: 'realm' });
    });
    regions.forEach((r) => {
      const el = document.createElement('div');
      el.className = 'm-lbl pref';
      el.textContent = r.name;
      labelLayer.append(el);
      labels.push({ el, x: r.center[0], y: r.center[1], size: 12, kind: 'pref' });
    });
  }
  buildLabels();
  const tmp = new THREE.Vector3();
  function placeLabels(dist) {
    const w = stage.size.w, h = stage.size.h;
    const showPref = dist < 900;
    const occupied = [];
    for (const l of labels) {
      if (l.kind === 'pref' && !showPref) { l.el.style.opacity = 0; continue; }
      tmp.set(l.x, heightAt(l.x, l.y) * uniforms.uRelief.value + (l.kind === 'realm' ? 6 : 2), l.y).project(camera);
      if (tmp.z > 1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) { l.el.style.opacity = 0; continue; }
      const sx = (tmp.x * 0.5 + 0.5) * w, sy = (-tmp.y * 0.5 + 0.5) * h;
      const scale = l.kind === 'realm' ? Math.max(0.45, Math.min(2.2, 1600 / dist)) : Math.max(0.8, Math.min(1.4, 520 / dist));
      const px = l.size * scale;
      const half = px * l.el.textContent.length * 0.55;
      const box = [sx - half, sy - px * 0.6, sx + half, sy + px * 0.6];
      if (l.kind === 'pref' && occupied.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) { l.el.style.opacity = 0; continue; }
      occupied.push(box);
      l.el.style.opacity = l.kind === 'realm' ? (showPref ? 0.55 : 0.92) : 0.95;
      l.el.style.fontSize = px.toFixed(1) + 'px';
      l.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }

  let currentLook = LOOK_QINGLV;
  function setLook(look) {
    currentLook = look;
    for (const k of LOOK_COLORS) {
      const c = look[k.key];
      if (c) uniforms[k.u].value.set(...(typeof c === 'string' ? hexRgb(c) : c).map((v) => v / 255));
    }
    if (look.amp) uniforms.uAmp.value.set(...look.amp);
    if (look.band) uniforms.uBand.value.set(...look.band);
    if (look.shade) uniforms.uShade.value.set(...look.shade);
  }
  setLook(LOOK_QINGLV);

  function spherical(p) {
    return [p.target[0] + p.dist * Math.sin(p.polar) * Math.sin(p.az), p.dist * Math.cos(p.polar), p.target[2] + p.dist * Math.sin(p.polar) * Math.cos(p.az)];
  }
  function setPose(p) {
    const def = typeof p === 'string' ? VIEWS[p] : p;
    controls.target.set(...def.target);
    camera.position.set(...spherical(def));
    camera.lookAt(...def.target);
  }
  function pose() {
    const off = new THREE.Vector3().subVectors(camera.position, controls.target);
    const dist = off.length();
    return { target: controls.target.toArray(), dist, polar: Math.acos(Math.min(1, off.y / dist)), az: Math.atan2(off.x, off.z) };
  }
  setPose(view);

  // ---------- 悬停与点选 ----------
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-9, -9);
  let interactive = false, hoverCb = null, active = false;
  const onMove = (ev) => {
    const rect = stage.canvas.getBoundingClientRect();
    mouse.set((ev.clientX - rect.left) / rect.width * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  };
  const onLeave = () => mouse.set(-9, -9);
  stage.canvas.addEventListener('pointermove', onMove);
  stage.canvas.addEventListener('pointerleave', onLeave);
  function pickAt(m) {
    if (m.x < -2) return -1;
    ray.setFromCamera(m, camera);
    const o = ray.ray.origin, dir = ray.ray.direction;
    let y = 0, p = null;
    for (let it = 0; it < 3; it++) {
      const t = (y - o.y) / dir.y;
      if (!(t > 0)) return -1;
      p = o.clone().addScaledVector(dir, t);
      y = heightAt(p.x, p.z) * uniforms.uRelief.value;
    }
    const ix = Math.floor(p.x * 2), iy = Math.floor(p.z * 2);
    if (ix < 0 || iy < 0 || ix >= ids.width || iy >= ids.height) return -1;
    return ids.data[iy * ids.width + ix] || -1;
  }

  // ---------- 案上那幅绢图：同一画法正俯视渲一张，题上势力名 ----------
  // extent：画世界里的哪一块（默认案上那幅的范围），宽高比须与 width/height 一致
  async function renderSheet({ look, width = 2100, height = 1540, names = true, extent = SHEET_EXTENT } = {}) {
    const saved = { pose: pose(), fov: camera.fov, aspect: camera.aspect, relief: uniforms.uRelief.value, px: uniforms.uPx.value, look: currentLook };
    if (look) setLook(look);
    camera.fov = 20;
    uniforms.uPx.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(10)));   // 点叶按这张图的像素算大小
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    setPose({ target: [extent.x0 + extent.w / 2, 0, extent.y0 + extent.h / 2], dist: (extent.h / 2) / Math.tan(THREE.MathUtils.degToRad(10)), polar: 0.0001, az: 0 });
    uniforms.uCam.value.copy(camera.position);
    uniforms.uZoom.value = 0;
    const rt = new THREE.WebGLRenderTarget(width, height, { samples: 4 });
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const resolve = new THREE.WebGLRenderTarget(width, height);
    renderer.setRenderTarget(resolve);
    const blitScene = new THREE.Scene();
    const blit = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { t: { value: rt.texture } }, depthTest: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }'
    }));
    blitScene.add(blit);
    renderer.render(blitScene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    const px = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(resolve, 0, 0, width, height, px);
    renderer.setRenderTarget(null);
    rt.dispose();
    resolve.dispose();
    blit.geometry.dispose();
    blit.material.dispose();
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d');
    const img = g.createImageData(width, height);
    for (let y = 0; y < height; y++) img.data.set(px.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);   // 读回的行是自下而上
    g.putImageData(img, 0, 0);
    if (names) {
      await document.fonts.load('48px "TM-MaShanZheng"', realmList.map((r) => r.name).join(''));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const k = width / extent.w;
      for (const r of realmList) {
        if (r.area < 600) continue;
        const px = (r.x - extent.x0) * k, py = (r.y - extent.y0) * k;
        if (px < 40 || py < 30 || px > width - 40 || py > height - 30) continue;
        const size = Math.max(26, Math.min(112, Math.sqrt(r.area) * 0.24)) * (width / W);
        g.font = `${size}px "TM-MaShanZheng"`;
        g.fillStyle = 'rgba(40,24,14,0.86)';
        g.fillText([...(factions[r.id]?.short || SHORT[r.name] || r.name)].join(' '), px, py);
      }
    }
    g.strokeStyle = 'rgba(40,24,14,0.7)';
    g.lineWidth = 3;
    g.strokeRect(22 * width / W, 22 * height / H, width - 44 * width / W, height - 44 * height / H);
    camera.fov = saved.fov;
    camera.aspect = saved.aspect;
    camera.updateProjectionMatrix();
    setPose(saved.pose);
    uniforms.uRelief.value = saved.relief;
    uniforms.uPx.value = saved.px;
    setLook(saved.look);
    return c;
  }

  let time = 0;
  const hooks = new Set();
  const mapView = {
    name: 'map',
    scene, camera, controls, uniforms,
    get regions() { return regions; },
    get realms() { return realmList; },
    update(t, dt) {
      time += dt;
      uniforms.uTime.value = time;
      if (interactive) controls.update();
      uniforms.uCam.value.copy(camera.position);
      const dist = camera.position.distanceTo(controls.target);
      uniforms.uZoom.value = 1 - Math.min(1, Math.max(0, (dist - 700) / 700));
      const id = interactive ? pickAt(mouse) : -1;
      if (id !== uniforms.uHover.value) {
        uniforms.uHover.value = id;
        hoverCb?.(id > 0 ? { index: id - 1, ...regions[id - 1] } : null);
      }
      for (const fn of hooks) fn(time, camera, dt);
      if (labelLayer) placeLabels(dist);
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.render(scene, camera);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      uniforms.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    },
    onFrame(fn) { hooks.add(fn); return () => hooks.delete(fn); },
    onHover(fn) { hoverCb = fn; },
    setInteractive(on) { interactive = on; controls.enabled = on; if (!on) mouse.set(-9, -9); },
    setActive(on) { active = on; if (labelLayer) labelLayer.style.visibility = on ? '' : 'hidden'; },
    get active() { return active; },
    setLook, setPose, pose, renderSheet,
    setPolitical(on) { uniforms.uPolitical.value = on ? 1 : 0; },
    select(index) { uniforms.uSelected.value = index == null ? -1 : index + 1; },
    // 府州易主：changes = { 府州下标: 新势力 id }
    setOwnership(changes) {
      for (const [i, fac] of Object.entries(changes)) if (regions[i]) regions[i].faction = fac;
      applyPolitics();
      buildLabels();
    },
    // 舆图世界坐标落在屏幕上的位置（高度取地形）
    worldToScreen(x, y) {
      tmp.set(x, heightAt(x, y) * uniforms.uRelief.value + 2, y).project(camera);
      return [(tmp.x * 0.5 + 0.5) * stage.size.w, (-tmp.y * 0.5 + 0.5) * stage.size.h];
    },
    pickScreen(clientX, clientY) {
      const rect = stage.canvas.getBoundingClientRect();
      const id = pickAt(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1));
      return id > 0 ? { index: id - 1, ...regions[id - 1] } : null;
    },
    heightAt,
    dispose() {
      stage.canvas.removeEventListener('pointermove', onMove);
      stage.canvas.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      for (const t of [regionTex, infoTex, paletteTex, borderTex]) t.dispose();   // 地形场归渲染器共用，不在这里释放
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      labelLayer?.replaceChildren();
    }
  };
  return mapView;
}
