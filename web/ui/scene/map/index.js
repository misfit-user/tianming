// 舆图视图：同一份真地形、剧本府州，青绿山水画法，挂到舞台上。
// 输入的府州数据是纯数据（由适配层从内核取）：{ regions: [{ name, poly, center, faction, … }], factions: { id: { name, color, short } } }，
// 坐标为舆图世界坐标（2100×1540）。府州易主后调 setOwnership 重画疆界。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { W, H, loadImage, decodeDem, coastField, waterMask, landSampler, waterSampler, regionIdMap, realms as computeRealms, blur, realmBorderDistance, localRange } from './terrain.js';
import { buildFieldsGPU, waterTexture } from './fields.js';
import { createLines } from './lines.js';
import { terrainVertex, terrainFragment, spriteVertex, spriteFragment } from './shaders.js';
import { spriteAtlas, SPRITE } from './sprites.js';
import { createLabels } from './labels.js';
import { LOOK_QINGLV, LOOK_QINGLV_AGED, LOOK_COLORS, RELIEF, BACKGROUND, VIEWS, hexRgb } from './looks.js';
import { createPainter, noiseTex } from './paint.js';
import { adjacency, politicsOf } from './politics.js';
import { quality } from '../../core/quality.js';
import { SHEET_EXTENT } from '../world.js';

const ASSETS = new URL('../../assets/map/', import.meta.url).href;
const ENV_URL = new URL('../../../vendor/shanhe25d/environment.js', import.meta.url).href;
const INFO_W = 4096, PALETTE_W = 256;

// ---------- 层级（照 CK3）：随镜头远近，天下 → 省道 → 府州 ----------
// 天下：各势力整片设色、地势压平如纸图；省道：一国之内各省道一族深浅、题省道名；府州：设色褪去，露出沙盘地形与府州名。
// 中间都是渐变（交叉淡换），不跳。dist 为镜头到注视点的距离（世界单位）
const ramp = (d, a, b) => { const t = Math.min(1, Math.max(0, (d - a) / (b - a))); return t * t * (3 - 2 * t); };
export const TIERS = {
  realm: { name: '天下', dist: 2000 },
  circuit: { name: '省道', dist: 1000 },
  pref: { name: '府州', dist: 430 }
};
export function tierAt(dist) { return dist >= 1350 ? 'realm' : dist >= 680 ? 'circuit' : 'pref'; }
const fillAt = (dist) => ramp(dist, 560, 790);                  // 势力设色浓淡：府州档无、省道档起满
const circuitAt = (dist) => 1 - ramp(dist, 1250, 1450);         // 设色按省道（1）还是按势力（0）
const reliefAt = (dist) => 1.45 - 1.1 * ramp(dist, 260, 1500);  // 起伏倍率：近看沙盘拔高、远看压平

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
  const water = waterMask(env, 2);
  const relief = Float32Array.from(rangeWide.hi, (v, i) => v - rangeWide.lo[i]);
  return {
    textures: {
      terrain: halfTexture([height, heightSmall, heightWide, new Float32Array(W * H)], W, H, THREE.RGBAFormat),
      aux: halfTexture([massif, depth], W, H, THREE.RGFormat),
      coast: halfTexture([coastField(env)], W, H, THREE.RedFormat),
      range: halfTexture([range.lo, range.hi, rangeWide.lo, rangeWide.hi], W, H, THREE.RGBAFormat),
      water: waterTexture(water),
      heightHi: hiRes ? halfTexture([Float32Array.from(dem.hi, (v) => Math.max(v, 0))], dem.width, dem.height, THREE.RedFormat) : halfTexture([height], W, H, THREE.RedFormat),
      hiW: hiRes ? dem.width : W, hiH: hiRes ? dem.height : H
    },
    cpu: { heightSmall, massif, relief, height, water },
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

// 点景层：items 为 [x, 高度(0~1), y, 世界尺寸, 图集格号]
function spriteLayer(items, uniforms) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(items.length * 3), size = new Float32Array(items.length), type = new Float32Array(items.length);
  items.forEach(([x, h, y, s, t], i) => {
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = y;
    size[i] = s; type[i] = t;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aType', new THREE.BufferAttribute(type, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, vertexShader: spriteVertex, fragmentShader: spriteFragment,
    transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
  }));
  pts.frustumCulled = false;
  pts.renderOrder = 20;
  return pts;
}
let atlasTexture = null;
function atlas() {
  if (atlasTexture) return atlasTexture;
  atlasTexture = new THREE.CanvasTexture(spriteAtlas());
  atlasTexture.colorSpace = THREE.NoColorSpace;
  atlasTexture.flipY = false;
  atlasTexture.premultiplyAlpha = false;
  atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
  atlasTexture.generateMipmaps = true;
  atlasTexture.anisotropy = 4;
  return atlasTexture;
}


export async function createMapView(stage, { regions = [], factions = {}, labelLayer = null, view = 'world', fov = 30, primary } = {}) {
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
  // 照 CK3 的手感：左键拖动平移、滚轮朝指针处缩放、中键拖动转向；右键留给「可为」单。触屏单指平移、双指缩放转向
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: null };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.zoomToCursor = true;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 1.0;
  // 俯角随远近：拉远近乎正俯视（看大势），推近斜下来（看山川起伏）
  const tiltFor = (dist) => { const t = Math.min(1, Math.max(0, (dist - 150) / 1850)); return 0.95 - 0.6 * t * t * (3 - 2 * t); };
  const keysDown = new Set();
  const KEY_PAN = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const onKeyDown = (e) => { if (KEY_PAN[e.code] && !typing(e.target) && !e.ctrlKey && !e.altKey && !e.metaKey) keysDown.add(e.code); };
  const onKeyUp = (e) => keysDown.delete(e.code);
  const onBlur = () => keysDown.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  // 每帧：键盘平移（随远近定速）、俯角跟着远近缓缓走、镜头中心夹在图内
  const panTmp = new THREE.Vector3(), offTmp = new THREE.Vector3(), sph = new THREE.Spherical();
  function steer(dt) {
    const dist = camera.position.distanceTo(controls.target);
    if (keysDown.size && !document.querySelector('.q-juan-veil, .ce-ov.on, .q-kewei')) {
      let dx = 0, dz = 0;
      for (const k of keysDown) { dx += KEY_PAN[k][0]; dz += KEY_PAN[k][1]; }
      const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      const v = dist * 0.9 * dt;
      panTmp.set((dx * Math.cos(az) + dz * Math.sin(az)) * v, 0, (-dx * Math.sin(az) + dz * Math.cos(az)) * v);
      controls.target.add(panTmp);
      camera.position.add(panTmp);
    }
    // 夹住中心：别拖出图外
    const cx = Math.min(W - 60, Math.max(60, controls.target.x)), cz = Math.min(H - 60, Math.max(60, controls.target.z));
    if (cx !== controls.target.x || cz !== controls.target.z) {
      panTmp.set(cx - controls.target.x, 0, cz - controls.target.z);
      controls.target.add(panTmp);
      camera.position.add(panTmp);
    }
    offTmp.subVectors(camera.position, controls.target);
    sph.setFromVector3(offTmp);
    const want = tiltFor(sph.radius);
    if (Math.abs(sph.phi - want) > 1e-4) {
      sph.phi += (want - sph.phi) * Math.min(1, dt * 6);
      offTmp.setFromSpherical(sph);
      camera.position.copy(controls.target).add(offTmp);
      camera.lookAt(controls.target);
    }
  }

  // ---------- 府州与势力 ----------
  // 府州编号图（2 倍分辨率，编号写成两字节）。开局前没有剧本时为空，开局或读档后 setRegions 换上
  let ids = regionIdMap(regions, 2);
  // 落点校正：剧本给的治所（referenceSeat）常落在本府轮廓边上、甚至海里。不在本府陆上的，就近挪到本府陆上
  // （离岸两三像素，旗与城郭不压在海岸线上）。改的是传进来的府州对象的 center——题名、城郭、图上标记都按它落
  const landOf = landSampler(d.water);
  function settleCenters() {
    const own = (k, x, y) => {
      const ix = Math.floor(x * 2), iy = Math.floor(y * 2);
      return ix >= 0 && iy >= 0 && ix < ids.width && iy < ids.height && ids.data[iy * ids.width + ix] === k + 1;
    };
    const inland = (x, y, r) => landOf(x + r, y) > 0.5 && landOf(x - r, y) > 0.5 && landOf(x, y + r) > 0.5 && landOf(x, y - r) > 0.5;
    const ok = (k, x, y) => own(k, x, y) && landOf(x, y) > 0.5 && inland(x, y, 1.2) && inland(x, y, 2.4);
    regions.forEach((r, k) => {
      if (!r.center || ok(k, r.center[0], r.center[1])) return;
      const [cx, cy] = r.center;
      for (let rad = 0.5; rad <= 24; rad += 0.5) {
        let best = null;
        const n = Math.max(8, Math.round(rad * 12));
        for (let j = 0; j < n; j++) {
          const a = j / n * Math.PI * 2, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
          if (ok(k, x, y)) { best = [x, y]; break; }
        }
        if (best) { r.center = [Math.round(best[0] * 100) / 100, Math.round(best[1] * 100) / 100]; return; }
      }
    });
  }
  settleCenters();
  const idBytes = new Uint8Array(ids.data.length * 2);
  const writeIds = () => {
    for (let i = 0; i < ids.data.length; i++) { idBytes[i * 2] = ids.data[i] & 255; idBytes[i * 2 + 1] = ids.data[i] >> 8; }
  };
  writeIds();
  const regionTex = new THREE.DataTexture(idBytes, ids.width, ids.height, THREE.RGFormat, THREE.UnsignedByteType);
  regionTex.magFilter = THREE.NearestFilter;
  regionTex.minFilter = THREE.NearestFilter;
  regionTex.needsUpdate = true;
  // 府州信息表：R 势力下标、G 辖区、B 省道下标（255 无）
  const info = new Uint8Array(INFO_W * 4);
  const infoTex = new THREE.DataTexture(info, INFO_W, 1, THREE.RGBAFormat);
  // 省道设色：每府州一色（所属省道的色）
  const fillData = new Uint8Array(INFO_W * 4);
  const fillTex = new THREE.DataTexture(fillData, INFO_W, 1, THREE.RGBAFormat);
  // 看法设色（民情、财赋……）：每府州一色，A 为有无
  const layerData = new Uint8Array(INFO_W * 4);
  const layerTex = new THREE.DataTexture(layerData, INFO_W, 1, THREE.RGBAFormat);
  const paletteData = new Uint8Array(PALETTE_W * 4);
  const paletteTex = new THREE.DataTexture(paletteData, PALETTE_W, 1, THREE.RGBAFormat);
  // 到分界的距离：R 势力之间、G 省道之间；按四分之一世界像素记成一字节（六十多像素以外都算远）
  const borderTex = new THREE.DataTexture(new Uint8Array(W * H * 2), W, H, THREE.RGFormat, THREE.UnsignedByteType);
  borderTex.magFilter = THREE.LinearFilter;
  borderTex.minFilter = THREE.LinearFilter;
  // 世界坐标处是哪个府州（下标，-1 无）：取编号图
  const regionIndexAt = (x, y) => {
    const ix = Math.floor(x * 2), iy = Math.floor(y * 2);
    if (ix < 0 || iy < 0 || ix >= ids.width || iy >= ids.height) return -1;
    return ids.data[iy * ids.width + ix] - 1;
  };
  let realmList = [];
  let realmByRegion = [];                     // 府州下标 → 势力编号（线层分国界用）
  let realmColors = [];                       // 势力下标 → 设色
  let circuits = [], circuitOf = new Int16Array(0);
  let pairs = null;                           // 府州相邻对（换府州时重算）
  let colorMemo = { realm: new Map(), circuit: new Map() };   // 配过的色：易主后各国各道照旧（换府州时清）
  let lines = null;
  let focusSet = [];                          // 辖区（身份视野）：府州下标
  const primaryRe = primary ? new RegExp(primary) : undefined;
  function applyPolitics() {
    realmList = computeRealms(data);
    const realmIndex = new Map(realmList.map((r, i) => [r.id, i]));
    const regionRealm = new Int16Array(regions.length + 1).fill(-1);
    regions.forEach((r, i) => { regionRealm[i + 1] = realmIndex.has(r.faction) ? realmIndex.get(r.faction) : -1; });
    realmByRegion = regions.map((_, i) => regionRealm[i + 1]);
    if (!pairs) pairs = adjacency(ids, regions.length);
    ({ realmColors, circuits, circuitOf } = politicsOf({ regions, realmList, realmByRegion, pairs, memo: colorMemo, ...(primaryRe ? { primary: primaryRe } : {}) }));
    realmList.forEach((r, i) => { r.ink = realmColors[i]; r.circuits = circuits.filter((c) => c.realm === i).length; });
    info.fill(0);
    fillData.fill(0);
    for (let i = 1; i < regionRealm.length && i < INFO_W; i++) {
      info[i * 4] = regionRealm[i] >= 0 ? regionRealm[i] : 255;
      const c = circuitOf[i - 1];
      info[i * 4 + 2] = c >= 0 && c < 255 ? c : 255;
      if (c >= 0) fillData.set([...hexRgb(circuits[c].color), 255], i * 4);
    }
    for (const k of focusSet) if (k + 1 < INFO_W) info[(k + 1) * 4 + 1] = 255;
    infoTex.needsUpdate = true;
    fillTex.needsUpdate = true;
    paletteData.fill(0);
    realmList.forEach((r, i) => { if (i < PALETTE_W) paletteData.set([...hexRgb(realmColors[i]), 255], i * 4); });
    paletteTex.needsUpdate = true;
    lines?.setPolitics(realmByRegion);
    const border = realmBorderDistance(ids, regionRealm);
    const regionCircuit = new Int16Array(regions.length + 1).fill(-1);
    for (let i = 0; i < regions.length; i++) regionCircuit[i + 1] = circuitOf[i];
    const borderC = realmBorderDistance(ids, regionCircuit);
    const bytes = borderTex.image.data;
    for (let i = 0; i < W * H; i++) {
      bytes[i * 2] = Math.min(255, Math.round(border[i] * 4));
      bytes[i * 2 + 1] = Math.min(255, Math.round(borderC[i] * 4));
    }
    borderTex.needsUpdate = true;
  }
  applyPolitics();
  // 某府州所在的那一级（天下：整个势力；省道：整道；府州：本府州）：{ tier, key, name, regions: [下标] }
  function groupOf(index, tier) {
    if (index == null || index < 0 || !regions[index]) return null;
    if (tier === 'realm' && realmByRegion[index] >= 0) {
      const k = realmByRegion[index], r = realmList[k];
      return { tier, key: k, name: r.name, faction: r.id, color: realmColors[k], regions: regions.map((_, i) => i).filter((i) => realmByRegion[i] === k), circuits: r.circuits };
    }
    if (tier === 'circuit' && circuitOf[index] >= 0) {
      const k = circuitOf[index], c = circuits[k];
      return { tier, key: k, name: c.name, title: c.title, faction: realmList[c.realm].id, color: c.color, regions: c.regions.slice() };
    }
    return { tier: 'pref', key: index + 1, name: regions[index].name, faction: regions[index].faction, regions: [index] };
  }
  // 着色器里比的键：天下比势力下标、省道比省道下标、府州比编号（下标 + 1）
  const MODE = { pref: 0, circuit: 1, realm: 2 };

  const uniforms = {
    uTerrain: { value: F.textures.terrain },
    uBorder: { value: borderTex },
    uAux: { value: F.textures.aux },
    uCoast: { value: F.textures.coast },
    uWater: { value: F.textures.water },
    uRegion: { value: regionTex }, uRegionInfo: { value: infoTex }, uPalette: { value: paletteTex },
    uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
    // 低档不载原分辨率高程，用世界网格那一份代替
    uHeightHi: { value: F.textures.heightHi },
    uTexelHi: { value: new THREE.Vector2(1 / F.textures.hiW, 1 / F.textures.hiH) },
    uRelief: { value: RELIEF }, uTime: { value: 0 }, uZoom: { value: 0 },
    uHover: { value: -1 }, uSelected: { value: -1 }, uHoverMode: { value: 0 }, uSelMode: { value: 0 },
    uFocus: { value: 0 }, uLayer: { value: 0 }, uLayerTex: { value: layerTex }, uCam: { value: new THREE.Vector3() },
    uFill: { value: 1 }, uTierMid: { value: 0 }, uFillTex: { value: fillTex },
    uFogColor: { value: new THREE.Vector3(0.91, 0.87, 0.78) }, uFogNear: { value: 1e6 }, uFogFar: { value: 2e6 }, uPolitical: { value: 1 },
    uPx: { value: stage.size.h / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))) },
    uRange: { value: F.textures.range },
    uAmp: { value: new THREE.Vector4() }, uBand: { value: new THREE.Vector4() }, uShade: { value: new THREE.Vector4() }
  };
  for (const k of LOOK_COLORS) uniforms[k.u] = { value: new THREE.Vector3() };
  // 底色：今设色、案上旧绢各烘一张（paint.js）
  const painter = createPainter(renderer, F.textures, { hiRes: q.mapHiRes, relief: RELIEF, anisotropy: q.anisotropy });
  await painter.bakeFresh(LOOK_QINGLV);
  await painter.bakeAged(LOOK_QINGLV_AGED);
  await painter.bakeShade(LOOK_QINGLV);
  let bakedFresh = LOOK_QINGLV;
  uniforms.uPaint = { value: painter.fresh.texture };
  uniforms.uPaintAged = { value: painter.aged.texture };
  uniforms.uShadeTex = { value: painter.shade.texture };
  uniforms.uLookT = { value: 1 };
  uniforms.uNoise = { value: noiseTex() };
  const terrain = new THREE.Mesh(gridGeometry(...q.mapGrid), new THREE.ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: terrainFragment, uniforms }));
  terrain.frustumCulled = false;
  scene.add(terrain);

  const sample = (field) => (x, y) => field[Math.max(0, Math.min(H - 1, Math.round(y))) * W + Math.max(0, Math.min(W - 1, Math.round(x)))];
  const heightAt = sample(d.heightSmall);
  const massifAt = sample(d.massif);

  // ---------- 线：疆界、省界、府界、海岸、江河 ----------
  // 地面高（双线性，与地形网格取的同一张微糊高度），线与点景贴地用
  const groundAt = (x, y) => {
    const fx = Math.max(0, Math.min(W - 1.001, x - 0.5)), fy = Math.max(0, Math.min(H - 1.001, y - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, f = d.heightSmall, i = y0 * W + x0;
    return (f[i] * (1 - tx) + f[i + 1] * tx) * (1 - ty) + (f[i + W] * (1 - tx) + f[i + W + 1] * tx) * ty;
  };
  lines = createLines({ env: d.env, shared: uniforms, land: landSampler(d.water), water: waterSampler(d.water), heightAt: groundAt, size: stage.size });
  lines.setRegions(regions, regionIndexAt);
  lines.setPolitics(realmByRegion);
  scene.add(lines.group);
  // ---------- 点景：山上的树（山河境的树位）、平原湿润处的村舍 ----------
  const spriteUniforms = {
    uRelief: uniforms.uRelief, uPx: uniforms.uPx, uHalfView: uniforms.uHalfView, uCam: uniforms.uCam,
    uFogNear: uniforms.uFogNear, uFogFar: uniforms.uFogFar, uFogColor: uniforms.uFogColor,
    uDpr: { value: stage.size.dpr || 1 }, uFadePx: { value: new THREE.Vector2(7, 12) }, uMaxPx: { value: 34 }, uAtlas: { value: atlas() }
  };
  let trees = null;                           // 点景远看都小过数像素、淡尽了，整层不画
  if (q.trees) {
    let s = 41;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const forested = (x, y) => {
      const i = Math.max(0, Math.min(W - 1, Math.round(x))) + Math.max(0, Math.min(H - 1, Math.round(y))) * W;
      return d.relief[i] > 0.12 && d.height[i] < 0.6;
    };
    const KIND = [SPRITE.pine, SPRITE.dot, SPRITE.jia, SPRITE.grove];
    const items = d.env.trees.filter((t) => massifAt(t[0], t[1]) > 0.08 && forested(t[0], t[1]))
      .map((t) => [t[0], heightAt(t[0], t[1]), t[1], 1.5 * t[2] * (0.75 + 0.5 * rnd()), KIND[t[3] % 4]]);
    // 村舍：湿润低平处（北纬 20～40 度、海拔三四百米以下、不在水上）按网格抖动散布；
    // 成片聚落（低频噪声）与傍水处密，别处稀，免得撒成均匀的一层；近水处间以柳
    const landAt = landSampler(d.water), wetAt = waterSampler(d.water);
    const cluster = (x, y) => { const v = Math.sin(x * 0.031 + 1.7) * Math.sin(y * 0.027 + 0.4) + Math.sin(x * 0.011 - y * 0.013 + 2.2) * 0.6; return Math.max(0, Math.min(1, (v + 0.4) / 1.4)); };
    for (let y = 3; y < H; y += 5) {
      const lat = 67 - y / 20;
      if (lat < 20 || lat > 40.5) continue;
      for (let x = 3; x < W; x += 5) {
        const px = x + (rnd() - 0.5) * 4.5, py = y + (rnd() - 0.5) * 4.5;
        if (landAt(px, py) < 0.5 || wetAt(px, py) || heightAt(px, py) > 0.06 || massifAt(px, py) > 0.05) continue;
        const byRiver = lines.nearRiver(px, py);
        if (rnd() > 0.02 + 0.22 * cluster(px, py) ** 2 + (byRiver ? 0.22 : 0)) continue;
        const nearWater = byRiver || wetAt(px + 2, py) || wetAt(px - 2, py) || wetAt(px, py + 2) || wetAt(px, py - 2);
        items.push([px, heightAt(px, py), py, 1.5 + rnd() * 0.6, nearWater && rnd() < 0.3 ? SPRITE.willow : SPRITE.hamlet]);
      }
    }
    // 林：沙盘上一丛丛的树——丘陵山坡与湿润处成片（江南、西南、关东密，中原、塞外稀），树线以上、水上不长。
    // 成片与否看一张低频值噪声；格距二点六像素，各点抖开
    const lattice = Float32Array.from({ length: 66 * 50 }, rnd);
    const vnoise = (x, y) => {
      const gx = x / 34, gy = y / 34, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), at = (i, j) => lattice[(j % 50) * 66 + (i % 66)];
      return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v;
    };
    const wetOf = (x, y) => {
      const lat = 67 - y / 20, lon = 55 + x / 20;
      if (lat < 21 || lat > 54 || lon < 97) return 0;
      if (lat < 33.5) return 1;
      if (lon > 117 && lat > 39) return 0.85;
      if (lat < 37) return 0.55;
      return lon > 108 ? 0.28 : 0.08;
    };
    // 丘陵上看大片（格三十四像素的噪声），平地上只在小丛处（格约十像素）
    const ramp01 = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));
    const FOREST = [SPRITE.grove, SPRITE.dot, SPRITE.pine, SPRITE.jia];
    for (let gy = 2; gy < H - 2; gy += 2.1) {
      for (let gx = 2; gx < W - 2; gx += 2.1) {
        const px = gx + (rnd() - 0.5) * 2, py = gy + (rnd() - 0.5) * 2;
        const wet = wetOf(px, py);
        if (!wet) continue;
        const i = Math.round(px) + Math.round(py) * W;
        const h = d.height[i];
        if (h > 0.5) continue;
        const hilly = ramp01(d.massif[i], 0.03, 0.16);
        const k = wet * Math.max(hilly * ramp01(vnoise(px, py), 0.4, 0.6), (1 - hilly) * ramp01(vnoise(px * 3.4 + 911, py * 3.4 + 377), 0.72, 0.84) * 0.9);
        if (rnd() > k || landAt(px, py) < 0.5 || wetAt(px, py)) continue;
        const kind = h > 0.25 || (py < 520 && rnd() < 0.6) ? SPRITE.pine : FOREST[Math.floor(rnd() * 4)];
        items.push([px, heightAt(px, py), py, (hilly > 0.5 ? 1.25 : 1.05) + rnd() * 0.5, kind]);
      }
    }
    // 由北往南排（镜头多朝北看，远的先画、近的压上去）
    items.sort((a, b) => a[2] - b[2]);
    trees = spriteLayer(items, spriteUniforms);
    scene.add(trees);
  }

  // ---------- 城郭：府州治所（京城两重城楼）；近看才显 ----------
  const cityUniforms = { ...spriteUniforms, uFadePx: { value: new THREE.Vector2(9, 15) }, uMaxPx: { value: 46 } };
  let cities = null;
  function buildCities() {
    if (cities) { scene.remove(cities); cities.geometry.dispose(); cities.material.dispose(); cities = null; }
    if (!regions.length) return;
    const caps = labels.capitals, seats = labels.important;
    cities = spriteLayer(regions.map((r, i) => {
      const [x, y] = r.center;
      const k = caps.has(i) ? 2 : seats.has(i) ? 1 : 0;
      return [x, heightAt(x, y), y, k === 2 ? 4.2 : k === 1 ? 3.3 : 2.6, k === 2 ? SPRITE.capital : SPRITE.city];
    }), cityUniforms);
    cities.renderOrder = 21;
    scene.add(cities);
  }

  // ---------- 题名（写在地面上，见 labels.js） ----------
  const labels = createLabels({ shared: uniforms, landAt: landOf });
  scene.add(labels.group);
  const labelData = () => ({ regions, realms: realmList, circuits, realmByRegion, circuitOf, ids });
  labels.setData(labelData());
  buildCities();
  const tmp = new THREE.Vector3();

  // ---------- 层级：随镜头远近定设色浓淡、按势力还是省道设色、起伏倍率；跨档时通知 ----------
  let reliefBase = RELIEF;                    // 入图时由 0 升到 RELIEF（转场改的是它）；实际起伏再乘远近倍率
  let tier = null;
  const tierHooks = new Set();
  function applyZoom(dist, silent = false) {
    uniforms.uFill.value = fillAt(dist);
    uniforms.uTierMid.value = circuitAt(dist);
    uniforms.uRelief.value = reliefBase * reliefAt(dist);
    const t = tierAt(dist);
    if (t !== tier && !silent) { tier = t; for (const fn of tierHooks) fn(t); }
  }
  applyZoom(camera.position.distanceTo(controls.target) || 1500);

  let currentLook = LOOK_QINGLV;
  // 设色：烘好的两套之间按比例插（入图、起身时由旧转新）；别的设色（少用）重烘今设色那张
  function lookT(look) {
    if (look === bakedFresh) return 1;
    if (look === LOOK_QINGLV_AGED) return 0;
    const m = look.mix;
    if (m && m[0] === LOOK_QINGLV_AGED && m[1] === bakedFresh) return m[2];
    if (m && m[1] === LOOK_QINGLV_AGED && m[0] === bakedFresh) return 1 - m[2];
    return null;
  }
  function setLook(look) {
    currentLook = look;
    let t = lookT(look);
    if (t == null) { bakedFresh = look; painter.bakeFresh(look); t = 1; }
    uniforms.uLookT.value = t;
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
  // extent：画世界里的哪一块（默认案上那幅的范围），宽高比须与 width/height 一致。
  // 势力名就用图上那一套（地面上弯写的字），俯身入图时字不跳
  async function renderSheet({ look, width = 2100, height = 1540, names = true, extent = SHEET_EXTENT } = {}) {
    if (names) await labels.ready;
    const saved = { pose: pose(), fov: camera.fov, aspect: camera.aspect, px: uniforms.uPx.value, look: currentLook, focus: uniforms.uFocus.value };
    if (look) setLook(look);
    uniforms.uFocus.value = 0;                    // 案上绢图不描辖区：俯身入图之后才浮出来
    const fog = [uniforms.uFogNear.value, uniforms.uFogFar.value];
    uniforms.uFogNear.value = 1e6;                // 绢图正俯视，不要远雾
    uniforms.uFogFar.value = 2e6;
    camera.fov = 20;
    uniforms.uPx.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(10)));   // 点叶、线宽按这张图的像素算大小
    lines.setViewport(width, height);
    lines.transient(false);
    const dpr = spriteUniforms.uDpr.value;
    spriteUniforms.uDpr.value = 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    setPose({ target: [extent.x0 + extent.w / 2, 0, extent.y0 + extent.h / 2], dist: (extent.h / 2) / Math.tan(THREE.MathUtils.degToRad(10)), polar: 0.0001, az: 0 });
    applyZoom(Math.max(2000, pose().dist), true);     // 案上那幅是天下档：整片设色、地势压平
    labels.group.visible = names;
    labels.update(Math.max(2000, pose().dist));
    const m = 40 * extent.w / width;                  // 画框以内（框线在边上二十二像素处）
    labels.setClip([extent.x0 + m, extent.y0 + m, extent.x0 + extent.w - m, extent.y0 + extent.h - m]);
    uniforms.uCam.value.copy(camera.position);
    lines.update(pose().dist * 1.6);
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
    g.strokeStyle = 'rgba(40,24,14,0.7)';
    g.lineWidth = 3;
    g.strokeRect(22 * width / W, 22 * height / H, width - 44 * width / W, height - 44 * height / H);
    lines.setViewport(stage.size.w, stage.size.h);
    lines.transient(true);
    spriteUniforms.uDpr.value = dpr;
    camera.fov = saved.fov;
    camera.aspect = saved.aspect;
    camera.updateProjectionMatrix();
    setPose(saved.pose);
    applyZoom(saved.pose.dist, true);
    labels.group.visible = true;
    labels.setClip(null);
    uniforms.uPx.value = saved.px;
    uniforms.uFocus.value = saved.focus;
    [uniforms.uFogNear.value, uniforms.uFogFar.value] = fog;
    setLook(saved.look);
    return c;
  }

  let time = 0;
  const hooks = new Set();
  let hoverKey = '', pickKey = '';
  const pickTier = () => (uniforms.uLayer.value > 0 ? 'pref' : tier);
  // 镜头推拉到某个距离（注视点不动，俯角由 steer 跟着远近走），约 0.8 秒
  let zoomTween = null;
  function zoomTo(to, ms = 800) {
    const from = camera.position.distanceTo(controls.target), t0 = performance.now();
    zoomTween = () => {
      const k = Math.min(1, (performance.now() - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      offTmp.subVectors(camera.position, controls.target).setLength(from + (to - from) * e);
      camera.position.copy(controls.target).add(offTmp);
      if (k >= 1) zoomTween = null;
    };
  }
  const mapView = {
    name: 'map',
    scene, camera, controls, uniforms,
    get regions() { return regions; },
    get realms() { return realmList; },
    update(t, dt) {
      time += dt;
      uniforms.uTime.value = time;
      if (interactive) { controls.update(); steer(Math.min(dt, 0.05)); }
      uniforms.uCam.value.copy(camera.position);
      const dist = camera.position.distanceTo(controls.target);
      // 远雾：斜看时远处融进绢色（正俯视时各处离镜头差不多远，等于没有）
      uniforms.uFogNear.value = dist * 1.35;
      uniforms.uFogFar.value = dist * 3.6;
      uniforms.uZoom.value = 1 - Math.min(1, Math.max(0, (dist - 700) / 700));
      if (zoomTween) zoomTween(dist);
      applyZoom(dist);
      // 悬停随层级：天下档点亮整个势力、省道档整道、府州档本府州（看法设色时各档都按府州）
      const id = interactive ? pickAt(mouse) : -1;
      const g = id > 0 ? groupOf(id - 1, pickTier()) : null;
      const hk = g ? MODE[g.tier] + ':' + g.key : '';
      lines.update(dist, tier);
      if (trees) trees.visible = dist < 1100;
      if (hk !== hoverKey) {
        hoverKey = hk;
        uniforms.uHover.value = g ? g.key : -1;
        uniforms.uHoverMode.value = g ? MODE[g.tier] : 0;
        lines.setHover(g && hk !== pickKey ? g.regions : []);
        hoverCb?.(g ? { index: id - 1, ...regions[id - 1], tier: g.tier, group: g } : null);
      }
      for (const fn of hooks) fn(time, camera, dt);
      labels.update(dist);
    },
    render(r, target) {
      r.setRenderTarget(target);
      r.render(scene, camera);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      uniforms.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      lines.setViewport(w, h);
      spriteUniforms.uDpr.value = stage.size.dpr || 1;
    },
    onFrame(fn) { hooks.add(fn); return () => hooks.delete(fn); },
    onHover(fn) { hoverCb = fn; },
    setInteractive(on) { interactive = on; controls.enabled = on; if (!on) mouse.set(-9, -9); },
    setActive(on) { active = on; if (labelLayer) labelLayer.style.visibility = on ? '' : 'hidden'; },
    get active() { return active; },
    setLook, setPose, pose, renderSheet,
    setPolitical(on) { uniforms.uPolitical.value = on ? 1 : 0; },
    // 点选：index 府州下标；tier 定点亮哪一级（不给即当前层级）
    select(index, at = pickTier()) {
      const g = index == null ? null : groupOf(index, at);
      pickKey = g ? MODE[g.tier] + ':' + g.key : '';
      uniforms.uSelected.value = g ? g.key : -1;
      uniforms.uSelMode.value = g ? MODE[g.tier] : 0;
      lines.setPicked(g ? g.regions : []);
      if (g && hoverKey === pickKey) lines.setHover([]);
      return g;
    },
    // 层级：当前档、跨档通知、飞到某档、某府州所在的那一级
    get tier() { return tier; },
    onTier(fn) { tierHooks.add(fn); return () => tierHooks.delete(fn); },
    flyTier(name) { if (TIERS[name]) zoomTo(TIERS[name].dist); },
    zoomTo,
    groupOf,
    realmColorOf(factionId) { const k = realmList.findIndex((r) => r.id === factionId); return k >= 0 ? realmColors[k] : null; },
    // 起伏（入图、起身时由转场升降）；实际起伏再乘远近倍率
    get relief() { return reliefBase; },
    set relief(v) { reliefBase = v; applyZoom(camera.position.distanceTo(controls.target), true); },
    // 看法设色：colors[府州下标] = '#rrggbb' 或空（不染）；浓淡由 uniforms.uLayer（0～1）定，给空数组就撤
    setLayer(colors) {
      layerData.fill(0);
      (colors || []).forEach((c, k) => {
        if (!c || k + 1 >= INFO_W) return;
        const [r, g, b] = hexRgb(c);
        layerData.set([r, g, b, 255], (k + 1) * 4);
      });
      layerTex.needsUpdate = true;
    },
    // 辖区视野：一组府州描金边、其余褪色（府州信息表 G 通道）。浓淡由 uniforms.uFocus（0～1）定，调用方按镜头渐变；给空就撤
    setFocus(indices) {
      focusSet = (indices || []).filter((k) => k >= 0 && k < regions.length);
      for (let i = 1; i < INFO_W; i++) info[i * 4 + 1] = 0;
      for (const k of focusSet) if (k + 1 < INFO_W) info[(k + 1) * 4 + 1] = 255;
      infoTex.needsUpdate = true;
      lines.setFocus(focusSet);
      if (!focusSet.length) uniforms.uFocus.value = 0;
    },
    // 府州易主：changes = { 府州下标: 新势力 id }
    // 换一套府州（开局、读档、换剧本）：编号图、疆界、题名一并重做
    setRegions(next) {
      regions = (next && next.regions) || [];
      factions = (next && next.factions) || {};
      data.regions = regions;
      data.factions = factions;
      ids = regionIdMap(regions, 2);
      settleCenters();
      writeIds();
      regionTex.needsUpdate = true;
      uniforms.uHover.value = -1;
      uniforms.uSelected.value = -1;
      hoverKey = pickKey = '';
      pairs = null;
      colorMemo = { realm: new Map(), circuit: new Map() };
      focusSet = [];
      uniforms.uFocus.value = 0;
      lines.setRegions(regions, regionIndexAt);
      lines.setFocus([]);
      lines.setHover([]);
      lines.setPicked([]);
      applyPolitics();
      labels.setCapitals([]);
      labels.setImportant([]);
      labels.setData(labelData());
      buildCities();
    },
    setOwnership(changes) {
      for (const [i, fac] of Object.entries(changes)) if (regions[i]) regions[i].faction = fac;
      applyPolitics();
      labels.setData(labelData());
    },
    // 京城、要府（府州下标）：题名先占位、字大；城郭京城两重楼、要府大一号
    setCapitals(list) { labels.setCapitals(list); buildCities(); },
    setImportant(list) { labels.setImportant(list); buildCities(); },
    get labelsReady() { return labels.ready; },
    get labelStats() { return labels.stats; },
    get labelsPlaced() { return labels.placed; },
    // 舆图世界坐标落在屏幕上的位置（高度取地形）
    worldToScreen(x, y) {
      tmp.set(x, heightAt(x, y) * uniforms.uRelief.value + 2, y).project(camera);
      return [(tmp.x * 0.5 + 0.5) * stage.size.w, (-tmp.y * 0.5 + 0.5) * stage.size.h];
    },
    pickScreen(clientX, clientY) {
      const rect = stage.canvas.getBoundingClientRect();
      const id = pickAt(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1));
      if (id <= 0) return null;
      const g = groupOf(id - 1, pickTier());
      return { index: id - 1, ...regions[id - 1], tier: g.tier, group: g };
    },
    heightAt,
    dispose() {
      stage.canvas.removeEventListener('pointermove', onMove);
      stage.canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      controls.dispose();
      for (const t of [regionTex, infoTex, paletteTex, borderTex, layerTex, fillTex]) t.dispose();   // 地形场归渲染器共用，不在这里释放
      lines.dispose();
      painter.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      labels.dispose();
      if (cities) { cities.geometry.dispose(); cities.material.dispose(); }
    }
  };
  return mapView;
}
