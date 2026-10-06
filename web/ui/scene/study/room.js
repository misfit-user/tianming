// 书房的屋子：整间屋（柱、梁枋彩画、井口天花、槅扇、糊纸槛窗、书格、宝座屏风、宫灯、画案）是 Blender 建的 room.glb
// （tools/ui-art/blender/build_room.py），配一张 Cycles 烘的光照贴图。
// 西间那扇敞开的三交六椀菱花窗在这里建：窗格既是真几何（投真影子），又写成一段着色器函数（算光柱、浮尘），两边同一组尺寸。
// 单位一律毫米；案面为 y=0。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { imageTexture, dadoTexture, clothTexture, paperTexture, paperEdgeTexture, brocadeTexture, bambooTexture, deskTopTexture, wrapCanvas } from './textures.js';
import { plaqueCanvas, coupletCanvas } from '../../kit/brush.js';
import { quality } from '../../core/quality.js';
import { cachedCanvas } from '../../core/texcache.js';

const ASSETS = new URL('../../assets/study/', import.meta.url).href;

// 太阳方向（指向太阳）：仰角 elev、方位 az（自正后方往左偏的角度，单位度）。各着色器共用同一个 uniform
export function sunVector(elev, az) {
  const e = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(az);
  return new THREE.Vector3(-Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}
export const SUN_UNIFORM = { value: sunVector(32, 30) };

// 窗（毫米）：中心、宽高、墙面位置与厚度、外框、中槛、三扇、仔边；菱花：线距、棂条宽、菱花外接半径
// 西间槛窗：柱间净宽 2620、窗台以上 200 到中槛 2220（案面为 0；地面在 -780）
export const WIN = {
  cx: -3000, cy: 1210, w: 2620, h: 2020, z: -2000, wallT: 160,
  frame: 74, mullion: 60, panels: 3, inner: 28, spacing: 74, bar: 11, flower: 21, depth: 24,
  blind: 40            // 竹帘放到窗心以上 40 毫米处：只有下半截进直射光
};
const IW = WIN.w / 2 - WIN.frame;                                   // 外框内半宽
const IH = WIN.h / 2 - WIN.frame;
const PW = (IW * 2 - WIN.mullion * (WIN.panels - 1)) / WIN.panels;  // 一扇宽
const PITCH = PW + WIN.mullion;
const N2 = [-0.5, Math.sqrt(3) / 2], N3 = [0.5, Math.sqrt(3) / 2];

export const DESK = { w: 3800, d: 2200, t: 70, floor: -780 };
// 屋子：南面门窗在 z=-2000，北墙 z=3600，东西山墙 x=±4500，天花离地 4400
export const ROOM = { x: 4500, south: -2000, north: 3600, ceil: 4400 - 780 };

// 着色器里的同一扇窗：windowOpen(世界坐标点) → 沿太阳方向能否穿过窗（0 挡住、1 透光，边缘略软）
export const WINDOW_GLSL = /* glsl */`
uniform vec3 uSunDir;
float latticeGap(vec2 w) {
  float s = min(${IW.toFixed(1)} - abs(w.x), ${IH.toFixed(1)} - abs(w.y));
  float pc = clamp(floor(w.x / ${PITCH.toFixed(3)} + 0.5), ${(-(WIN.panels - 1) / 2).toFixed(1)}, ${((WIN.panels - 1) / 2).toFixed(1)}) * ${PITCH.toFixed(3)};
  vec2 p = vec2(w.x - pc, w.y);
  float inner = min(${(PW / 2 - WIN.inner).toFixed(2)} - abs(p.x), ${(IH - WIN.inner).toFixed(2)} - abs(p.y));
  float D = ${WIN.spacing.toFixed(2)};
  float d1 = abs(fract(p.x / D + 0.5) - 0.5) * D;
  float d2 = abs(fract(dot(p, vec2(${N2[0]}, ${N2[1].toFixed(6)})) / D + 0.5) - 0.5) * D;
  float d3 = abs(fract(dot(p, vec2(${N3[0]}, ${N3[1].toFixed(6)})) / D + 0.5) - 0.5) * D;
  float bars = min(min(d1, d2), d3) - ${(WIN.bar / 2).toFixed(2)};
  float flower = max(max(d1, d2), d3) - ${(WIN.flower * 0.866).toFixed(2)};
  return min(min(s, inner), max(bars, flower));
}
float windowOpen(vec3 q, float soft) {
  float t0 = (${(WIN.z + WIN.wallT / 2).toFixed(1)} - q.z) / uSunDir.z;
  float t1 = (${(WIN.z - WIN.wallT / 2).toFixed(1)} - q.z) / uSunDir.z;
  if (t0 < 0.0) return 0.0;
  vec2 a = (q + uSunDir * t0).xy - vec2(${WIN.cx.toFixed(1)}, ${WIN.cy.toFixed(1)});
  vec2 b = (q + uSunDir * t1).xy - vec2(${WIN.cx.toFixed(1)}, ${WIN.cy.toFixed(1)});
  vec2 m = (q + uSunDir * (t0 + t1) * 0.5).xy - vec2(${WIN.cx.toFixed(1)}, ${WIN.cy.toFixed(1)});
  float hole = min(min(${(WIN.w / 2).toFixed(1)} - abs(a.x), ${(WIN.h / 2).toFixed(1)} - abs(a.y)), min(${(WIN.w / 2).toFixed(1)} - abs(b.x), ${(WIN.h / 2).toFixed(1)} - abs(b.y)));
  float blind = ${WIN.blind.toFixed(1)} - m.y;
  return smoothstep(-soft, soft, min(min(hole, latticeGap(m)), blind));
}`;

function boxAt(w, h, d, x, y, z, rotZ = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return g;
}

// 菱花窗格：外框、中槛、每扇仔边、三向棂条、每个交点一朵六角菱花，花心一颗描金菱花钉
function windowGeometry() {
  const { cx, cy, z, frame, mullion, inner, spacing: D, bar, flower, depth } = WIN;
  const frames = [], lattice = [], gilt = [];
  const shape = new THREE.Shape();
  for (let k = 0; k <= 24; k++) {
    const ang = (k / 24) * Math.PI * 2, rr = flower * (0.72 + 0.28 * Math.abs(Math.cos(3 * ang)));
    k ? shape.lineTo(rr * Math.cos(ang), rr * Math.sin(ang)) : shape.moveTo(rr * Math.cos(ang), rr * Math.sin(ang));
  }
  const rosette = new THREE.ExtrudeGeometry(shape, { depth: depth + 6, bevelEnabled: false });
  rosette.translate(0, 0, -(depth + 6) / 2);
  frames.push(boxAt(WIN.w, frame, 110, cx, cy + WIN.h / 2 - frame / 2, z));
  frames.push(boxAt(WIN.w, frame, 110, cx, cy - WIN.h / 2 + frame / 2, z));
  frames.push(boxAt(frame, WIN.h, 110, cx - WIN.w / 2 + frame / 2, cy, z));
  frames.push(boxAt(frame, WIN.h, 110, cx + WIN.w / 2 - frame / 2, cy, z));
  for (let i = 1; i < WIN.panels; i++) frames.push(boxAt(mullion, IH * 2, 90, cx - IW + i * PITCH - mullion / 2, cy, z));
  for (let i = 0; i < WIN.panels; i++) {
    const pcx = cx - IW + PW / 2 + i * PITCH;
    frames.push(boxAt(PW, inner, 44, pcx, cy + IH - inner / 2, z));
    frames.push(boxAt(PW, inner, 44, pcx, cy - IH + inner / 2, z));
    frames.push(boxAt(inner, IH * 2, 44, pcx - PW / 2 + inner / 2, cy, z));
    frames.push(boxAt(inner, IH * 2, 44, pcx + PW / 2 - inner / 2, cy, z));
    const hw = PW / 2 - inner, hh = IH - inner;
    for (const n of [[1, 0], N2, N3]) {                 // 三族平行线，每条线裁到格心矩形里
      const t = [-n[1], n[0]];
      const K = Math.ceil(Math.hypot(hw, hh) / D) + 1;
      for (let k = -K; k <= K; k++) {
        const o = [n[0] * k * D, n[1] * k * D];
        let s0 = -1e9, s1 = 1e9;
        for (const [oc, tc, lim] of [[o[0], t[0], hw], [o[1], t[1], hh]]) {
          if (Math.abs(tc) < 1e-9) { if (Math.abs(oc) > lim) { s0 = 1; s1 = 0; } continue; }
          const a = (-lim - oc) / tc, b = (lim - oc) / tc;
          s0 = Math.max(s0, Math.min(a, b));
          s1 = Math.min(s1, Math.max(a, b));
        }
        if (s1 - s0 < 2) continue;
        const sm = (s0 + s1) / 2;
        lattice.push(boxAt(s1 - s0, bar, depth, pcx + o[0] + t[0] * sm, cy + o[1] + t[1] * sm, z, Math.atan2(t[1], t[0])));
      }
    }
    const a = D / 0.866;
    for (let j = -Math.ceil(hw / D); j <= Math.ceil(hw / D); j++) {
      for (let i = -Math.ceil(hh / a) - 1; i <= Math.ceil(hh / a) + 1; i++) {
        const px = j * D, py = i * a + j * a / 2;
        if (Math.abs(px) > hw - flower * 0.5 || Math.abs(py) > hh - flower * 0.5) continue;
        const f = rosette.clone();
        f.translate(pcx + px, cy + py, z);
        lattice.push(f);
        const nail = new THREE.CylinderGeometry(flower * 0.18, flower * 0.3, 6, 10);
        nail.rotateX(Math.PI / 2);
        nail.translate(pcx + px, cy + py, z + (depth + 6) / 2 + 3);
        gilt.push(nail);
      }
    }
  }
  const flat = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));   // 挤出件不带索引，统一拆开再并
  return { frames: mergeGeometries(frames), lattice: flat(lattice), gilt: mergeGeometries(gilt) };
}

// 西间敞窗：朱漆褪色的木框与菱花格，内侧放下半幅竹帘，窗外一幅晨光院景（自发光）
export async function buildWindow(scene) {
  const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const { frames, lattice, gilt } = windowGeometry();
  scene.add(shadowed(new THREE.Mesh(frames, new THREE.MeshStandardMaterial({ color: 0x6a2a1a, roughness: 0.55 }))));
  scene.add(shadowed(new THREE.Mesh(lattice, new THREE.MeshStandardMaterial({ color: 0x7a3a22, roughness: 0.6 }))));
  scene.add(new THREE.Mesh(gilt, new THREE.MeshStandardMaterial({ color: 0xd8b26a, metalness: 0.9, roughness: 0.34 })));
  const bw = WIN.w - WIN.frame * 2, top = WIN.h / 2 - WIN.frame, bh = top - WIN.blind;
  const bamboo = bambooTexture();
  bamboo.repeat.set(bw / 1000, bh / 1000);
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh),
    new THREE.MeshStandardMaterial({ map: bamboo, emissiveMap: bamboo, emissive: 0xffe4b8, emissiveIntensity: 0.55, roughness: 0.8, side: THREE.DoubleSide }));
  blind.position.set(WIN.cx, WIN.cy + WIN.blind + bh / 2, WIN.z + WIN.wallT / 2 + 30);
  blind.castShadow = true;
  scene.add(blind);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, bw + 60, 12), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.5 }));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(WIN.cx, WIN.cy + WIN.blind + 4, WIN.z + WIN.wallT / 2 + 36);
  rod.castShadow = true;
  scene.add(rod);
  const court = await imageTexture('window-court.jpg');
  court.wrapS = court.wrapT = THREE.ClampToEdgeWrapping;
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(9200, 6600), new THREE.MeshBasicMaterial({ map: court, toneMapped: false }));
  outside.position.set(WIN.cx + 300, WIN.cy + 900, WIN.z - 3800);
  outside.material.color.setScalar(1.15);
  scene.add(outside);
  return { outside };
}

// 光照贴图总增益（与实时太阳的相对亮度，按眼睛调）
export const LIGHTMAP_GAIN = 0.85;

// 房间陈设按身份取（键即 ui/model/identity.js 各档的 room）。
// 只有元首的御书房是自己的屋；部院直房、签押房、书斋三间还没建（页面期 P5），先借御书房的骨架（dir 相同），只换匾、联与案上器物。
// 匾联只取唐以前的经典，免得在早期剧本里时代错乱。
export const ROOMS = {
  sovereign: {
    dir: '',
    plaque: '允執厥中',                      // 《尚书·大禹谟》十六字心传的末句
    couplets: [['惟以一人治天下', -1500], ['豈為天下奉一人', 1500]]   // 语出唐张蕴古《大宝箴》，上联在面对宝座时的右手
  },
  ministry: {                                // 京官：部院直房
    dir: '', interim: true,
    plaque: '夙夜在公',                      // 《诗经·召南·小星》
    couplets: [['居之無倦', -1500], ['行之以忠', 1500]]                // 《论语·颜渊》子张问政
  },
  yamen: {                                   // 地方官：签押房
    dir: '', interim: true,
    plaque: '清慎勤',                        // 晋李秉《家诫》引司马昭语「为官长当清、当慎、当勤」，后世官箴之本
    couplets: [['道之以德', -1500], ['齊之以禮', 1500]]                // 《论语·为政》
  },
  study: {                                   // 不在官：书斋
    dir: '', interim: true,
    plaque: '慎獨',                          // 《礼记·中庸》《大学》
    couplets: [['學而不厭', -1500], ['誨人不倦', 1500]]                // 《论语·述而》
  }
};

// 匾心与联板的贴图（按字缓存）；换陈设时用
export async function plaqueMap(text) {
  const t = wrapCanvas(await cachedCanvas(`plaque:${text}`, () => plaqueCanvas(text)));
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}
export async function coupletMap(text) {
  return wrapCanvas(await cachedCanvas(`couplet:${text}`, () => coupletCanvas(text)));
}

// 整间屋：按材质名换上贴图与质感；烘了光照贴图的面挂上光照贴图
export async function loadRoom(scene, preset = ROOMS.sovereign) {
  const dir = ASSETS + (preset.dir ? preset.dir + '/' : '');
  const [gltf, lightmap] = await Promise.all([
    new GLTFLoader().loadAsync(dir + 'room.glb'),
    new RGBELoader().loadAsync(dir + 'room-lightmap.hdr').catch((err) => {
      console.warn('[study] 没有光照贴图，退回面光', err);
      return null;
    })
  ]);
  if (lightmap) {
    lightmap.channel = 1;                     // 光照贴图走第二套 UV（Blender 里的 lightmap 层）
    lightmap.flipY = false;
    lightmap.colorSpace = THREE.LinearSRGBColorSpace;
    lightmap.minFilter = THREE.LinearFilter;
    lightmap.generateMipmaps = false;
    lightmap.needsUpdate = true;
  }
  const root = gltf.scene;
  root.scale.setScalar(1000);
  root.position.y = DESK.floor;
  const [zitan, cinnabar, floorTiles, carpet, ceiling, caihua, screen, dado, huanghuali, deskTop, wallpaper, throneBack, carvedClouds, doorSkirt, plaqueFrame,
    fanFace, lanternPaint, porcelain] = await Promise.all([
    imageTexture('zitan.jpg'), imageTexture('cinnabar.jpg'), imageTexture('floor-tiles.jpg'), imageTexture('carpet.jpg'),
    imageTexture('ceiling.jpg'), imageTexture('caihua.jpg'), imageTexture('screen-qianli.jpg'), dadoTexture(), imageTexture('huanghuali.jpg'), deskTopTexture(),
    imageTexture('wallpaper.jpg'), imageTexture('throne-back.jpg'), imageTexture('carved-clouds.jpg'), imageTexture('door-skirt.jpg'), imageTexture('plaque-frame.jpg'),
    imageTexture('fan-face.jpg'), imageTexture('lantern-painting.jpg'), imageTexture('porcelain-wrap.jpg')
  ]);
  for (const t of [carpet, ceiling, caihua, screen, throneBack, doorSkirt, fanFace, lanternPaint]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  plaqueFrame.wrapT = THREE.ClampToEdgeWrapping;
  const paper = paperTexture('#f4ecd8', 31);
  paper.repeat.set(3, 3);
  const plaque = await plaqueMap(preset.plaque);
  const cloths = {
    case_indigo: clothTexture('#2a3654', 6), case_blue: clothTexture('#3c4c64', 7), case_camel: clothTexture('#86694a', 8), case_brown: clothTexture('#5e3e2a', 9),
    scroll_silk: clothTexture('#cdbd98', 10), scroll_blue: clothTexture('#61738a', 11), book_case: clothTexture('#2c3c5c', 6)
  };
  const edge = paperEdgeTexture('#e0d3b2');
  const satin = brocadeTexture('#c28f2c', '#f0d488');          // 黄缎团云
  // glTF 的 UV 原点在左上：整图类贴图不翻转
  for (const t of [carpet, ceiling, caihua, screen, dado, paper, plaque, zitan, cinnabar, floorTiles, huanghuali, deskTop, wallpaper, throneBack, carvedClouds, doorSkirt,
    plaqueFrame, fanFace, lanternPaint, porcelain, edge, satin, ...Object.values(cloths)]) { t.flipY = false; t.needsUpdate = true; }
  const tiled = (t, perMeter) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(perMeter, perMeter); return c; };
  const gold = { color: 0xd8b26a, metalness: 0.9, roughness: 0.34 };
  const carved = (t, k = 1) => ({ map: t, bumpMap: t, bumpScale: 6 * k, color: 0xffffff });   // 雕花：同一张图既当颜色又当起伏
  // 材质名 → 换法。UV：平铺类是「米 × Blender 里的 uv_scale」，整图类是 0~1
  const looks = {
    floor_jinzhuan: { map: tiled(floorTiles, 1 / 1.28), color: 0xe6e2dc, roughness: 0.3, metalness: 0.0 },
    column_lacquer: { map: tiled(cinnabar, 1.5), color: 0xa06a60, roughness: 0.38 },
    window_frame: { color: 0x4e1d13, roughness: 0.5 },
    lattice_wood: { color: 0x5c2617, roughness: 0.55 },
    lattice_gilt: gold,
    carpet: { map: carpet, roughness: 1.0, color: 0xf2eee6 },
    ceiling_panel: { map: ceiling, roughness: 0.8, color: 0xffffff },
    caihua: { map: caihua, roughness: 0.8, color: 0xffffff },
    plaster: { map: tiled(wallpaper, 2.2), roughness: 0.9, color: 0xf2e8d8 },          // 银花糊墙纸：一张图管 0.45 米
    dado_wood: { map: dado, roughness: 0.42, color: 0xffffff },
    zitan: { map: tiled(zitan, 1.2), roughness: 0.36, color: 0xb09a90 },
    desk_wood: { map: tiled(huanghuali, 3.2), roughness: 0.42, color: 0xb89c88 },
    desk_top: { map: deskTop, roughness: 0.44, color: 0xffffff, clearcoat: 0.22, clearcoatRoughness: 0.55 },
    door_panel: { map: tiled(zitan, 1.0), roughness: 0.4, color: 0xd09078 },
    door_skirt: { ...carved(doorSkirt, 0.6), roughness: 0.42 },
    door_band: { ...carved(doorSkirt, 0.6), roughness: 0.42 },
    screen_painting: { map: screen, roughness: 0.85, color: 0xffffff },
    throne_zitan: { map: tiled(zitan, 1.6), roughness: 0.32, color: 0xa08a82, clearcoat: 0.35, clearcoatRoughness: 0.4 },
    throne_carved: { ...carved(carvedClouds), roughness: 0.4, color: 0xd8cac4 },
    throne_panel: { ...carved(throneBack), roughness: 0.38 },
    throne_gilt: gold,
    gilt_line: gold,
    plaque_frame: { ...carved(plaqueFrame, 1.2), metalness: 0.75, roughness: 0.36 },
    cushion_yellow: { map: tiled(satin, 3), roughness: 0.6, color: 0xffffff, sheen: 1, sheenColor: 0xfff0c0, sheenRoughness: 0.5, clearcoat: 0 },
    book_case: { map: tiled(cloths.book_case, 3), roughness: 0.95, color: 0xffffff },
    case_indigo: { map: cloths.case_indigo, roughness: 0.95, color: 0xffffff },
    case_blue: { map: cloths.case_blue, roughness: 0.95, color: 0xffffff },
    case_camel: { map: cloths.case_camel, roughness: 0.9, color: 0xffffff },
    case_brown: { map: cloths.case_brown, roughness: 0.95, color: 0xffffff },
    scroll_silk: { map: cloths.scroll_silk, roughness: 0.8, color: 0xffffff },
    scroll_blue: { map: cloths.scroll_blue, roughness: 0.8, color: 0xffffff },
    book_edge: { map: edge, roughness: 0.95, color: 0xffffff },
    box_nanmu: { map: tiled(huanghuali, 3), roughness: 0.45, color: 0xf0d8b0 },
    brass: { color: 0xc49a4a, metalness: 1, roughness: 0.38 },
    tassel_gold: gold,
    jade_white: { color: 0xece6d2, roughness: 0.22 },
    porcelain_lotus: { map: porcelain, roughness: 0.1, color: 0xffffff, clearcoat: 0.9, clearcoatRoughness: 0.08 },
    fan_face: { map: fanFace, roughness: 0.7, color: 0xffffff, sheen: 0.6, sheenColor: 0xfff2d0, clearcoat: 0 },
    lantern_paint: { map: lanternPaint, emissiveMap: lanternPaint, emissive: 0xffe6c0, emissiveIntensity: 0.22, roughness: 0.85, color: 0xffffff },
    lantern_wood: { map: tiled(zitan, 4), roughness: 0.35, color: 0x9a7a70 },
    tassel_red: { color: 0xa0281c, roughness: 0.75 },
    window_paper: { map: paper, roughness: 0.95, color: 0xf6eedc, emissive: 0xfff1dc, emissiveIntensity: 1.35, emissiveMap: paper },
    lantern_silk: { map: paper, roughness: 0.9, color: 0xf2e6c8, emissive: 0x3a2c18, emissiveIntensity: 0.3 },
    plaque: { map: plaque, roughness: 0.3, color: 0xffffff }
  };
  const physicalOk = quality().tier !== 'low';
  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name;
    const look = looks[name];
    const baked = lightmap && o.geometry.attributes.uv1;
    if (look || baked) {
      const physical = physicalOk && !!look && (look.clearcoat != null || look.sheen != null);
      const m = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
      m.name = name;
      m.color.copy(o.material.color);
      m.roughness = o.material.roughness;
      m.metalness = o.material.metalness;
      for (const [k, v] of Object.entries(look || {})) {
        if (!physical && /^(clearcoat|sheen)/.test(k)) continue;
        if (k === 'color' || k === 'emissive' || k === 'sheenColor') m[k].set(v);
        else m[k] = v;
      }
      if (baked) {
        // Cycles 烘的是「漫射光照」（最终色 = 底色 × 它），Three.js 的光照贴图按辐照度算（再乘 1/π），所以乘 π
        m.lightMap = lightmap;
        m.lightMapIntensity = Math.PI * LIGHTMAP_GAIN;
        m.envMapIntensity = 0.22;            // 天光已在光照贴图里，环境图只留一点高光
      }
      o.material = m;
    }
    o.castShadow = true;
    o.receiveShadow = true;
  });
  scene.add(root);
  const plaques = [];
  root.traverse((o) => { if (o.isMesh && o.material.name === 'plaque') plaques.push(o.material); });
  return { root, lightmap, plaques };
}

// 抱柱联：北面两根金柱朝南一面，黑漆金字
export async function buildCouplets(scene, preset = ROOMS.sovereign) {
  const y0 = 950 - 780, y1 = 3050 - 780;                  // 离地 0.95~3.05 米
  const colR = (y) => 190 - 12 * ((y + 780) / 1000 - 0.2) / 3.55;
  const theta = 1.9;
  const boards = [];
  for (const [text, x] of preset.couplets) {
    const tex = await coupletMap(text);
    const geo = new THREE.CylinderGeometry(colR(y1) + 11, colR(y0) + 11, y1 - y0, 40, 1, true, Math.PI - theta / 2, theta);
    const board = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, envMapIntensity: 1.1 }));
    board.position.set(x, (y0 + y1) / 2, ROOM.north);
    board.castShadow = true;
    board.receiveShadow = true;
    scene.add(board);
    boards.push(board);
    for (const s of [-1, 1]) {                             // 板两边的厚度：两条细木边
      const a = Math.PI + s * theta / 2;
      const r = colR((y0 + y1) / 2) + 6;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(10, y1 - y0, 12), new THREE.MeshStandardMaterial({ color: 0x1a110c, roughness: 0.4 }));
      edge.position.set(x + Math.sin(a) * r, (y0 + y1) / 2, ROOM.north + Math.cos(a) * r);
      edge.rotation.y = a;
      scene.add(edge);
    }
  }
  return boards;
}
