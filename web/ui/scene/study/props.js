// 案上器物：Blender 程序化建模的 props.glb（tools/ui-art/blender/build_props.py），十几件一组一组摆在案上。
// 「一处一组」：组在毫米世界里摆，组里的 glb 件放大 1000 倍；每组可就某个镜头改摆（shots.js 的 place）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { paperTexture, paperEdgeTexture, clothTexture, brocadeTexture, gildTexture, slipTexture, noteTexture, imageTexture } from './textures.js';
import { loadFonts } from '../../kit/brush.js';

const ASSETS = new URL('../../assets/study/', import.meta.url).href;

// 案上各处（一处一组）：[x, z, 绕竖轴转角]，单位毫米
export const PLACE = {
  tray: [905, -440, -0.06],
  memorials: [915, -70, Math.PI / 2 - 0.04],
  seal: [890, 320, 0.1],
  letterbox: [-1480, -470, 0.08],
  map: [0, 0, 0],
  censer: [-1480, -880, 0],
  writing: [-800, 640, 0.06],
  books: [790, 690, 0.16],
  tea: [1500, 900, 0],
  redbrush: [2600, 300, 0]
};
// 各处小签的锚点高度（毫米）
const ANCHOR_Y = { tray: 40, memorials: 130, seal: 150, letterbox: 90, writing: 40, books: 70, censer: 180, tea: 80 };

// 给没有 UV 的网格补 UV：tile 给毫米数就按那么大一格平铺（模型是米制）；top 取顶面包围盒 0~1（题签、纸笺、描金盖面）
function addUV(geo, { tile = 0, top = false } = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (top) {
      u = (x - bb.min.x) / (bb.max.x - bb.min.x);
      v = 1 - (z - bb.min.z) / (bb.max.z - bb.min.z);
    } else if (ay >= ax && ay >= az) { u = x * 1000 / tile; v = z * 1000 / tile; }
    else if (ax >= az) { u = z * 1000 / tile; v = y * 1000 / tile; }
    else { u = x * 1000 / tile; v = y * 1000 / tile; }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// 器物脚下一团软影（窗光是面光，照不出贴地的接触阴影，补一层）
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.filter = 'blur(22px)';
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(56, 56, 144, 144, 30);
  g.fill();
  return new THREE.CanvasTexture(c);
}

// notes：三张花笺 [[题, [行…]], …]（案头时政摘要，开局由内核数据填）
export async function loadProps(scene, { notes }) {
  const gltf = await new GLTFLoader().loadAsync(ASSETS + 'props.glb');
  const lib = gltf.scene;
  await loadFonts({ 'TM-Syuku': '起居注實錄', 'TM-WenKai': notes.flat(2).join('') });
  const zitanTex = await imageTexture('zitan.jpg');
  const tex = {
    paper: paperTexture('#e9dfc6', 11), letter: paperTexture('#ebe0c5', 12), edge: paperEdgeTexture(),
    indigo: clothTexture('#4b5d7c', 3), brown: clothTexture('#4a3322', 4), yellow: clothTexture('#c8a246', 5),
    brocade: brocadeTexture(), gilt: gildTexture(), bamboo: clothTexture('#b48c52', 12),
    slipA: slipTexture('起居注'), slipB: slipTexture('實錄'),
    notes: notes.map(([t, lines], i) => noteTexture(t, lines, i + 1))
  };
  const upgrade = {
    memorial_cover: (m, g) => { addUV(g, { tile: 120 }); m.map = tex.paper; m.color.set(0xffffff); },
    letter_paper: (m, g) => { addUV(g, { tile: 120 }); m.map = tex.letter; m.color.set(0xffffff); },
    paper_edge: (m, g) => { addUV(g, { tile: 60 }); m.map = tex.edge; },
    cloth_indigo: (m, g) => { addUV(g, { tile: 40 }); m.map = tex.indigo; m.color.set(0xffffff); },
    cloth_brown: (m, g) => { addUV(g, { tile: 40 }); m.map = tex.brown; m.color.set(0xffffff); },
    memorial_yellow: (m, g) => { addUV(g, { tile: 40 }); m.map = tex.yellow; m.color.set(0xffffff); m.roughness = 0.55; },
    brocade_red: (m, g) => { addUV(g, { tile: 120 }); m.map = tex.brocade; m.color.set(0xffffff); },
    lacquer_gilt: (m, g) => { addUV(g, { top: true }); m.map = tex.gilt; m.color.set(0xffffff); },
    book_a_slip: (m, g) => { addUV(g, { top: true }); m.map = tex.slipA; m.color.set(0xffffff); },
    book_b_slip: (m, g) => { addUV(g, { top: true }); m.map = tex.slipB; m.color.set(0xffffff); },
    note_0: (m, g) => { addUV(g, { top: true }); m.map = tex.notes[0]; m.color.set(0xffffff); },
    note_1: (m, g) => { addUV(g, { top: true }); m.map = tex.notes[1]; m.color.set(0xffffff); },
    note_2: (m, g) => { addUV(g, { top: true }); m.map = tex.notes[2]; m.color.set(0xffffff); },
    jade: (m) => { m.transmission = 0.18; m.thickness = 40; m.roughness = 0.24; m.attenuationColor = new THREE.Color(0x9fbf90); m.attenuationDistance = 80; },
    ember: (m) => { m.emissive = new THREE.Color(0xff6a20); m.emissiveIntensity = 3; },
    wood_zitan: (m, g) => { addUV(g, { tile: 260 }); m.map = zitanTex; m.color.set(0xb8a298); m.roughness = 0.34; },
    bamboo_old: (m, g) => { addUV(g, { tile: 90 }); m.map = tex.bamboo; m.color.set(0xffffff); }
  };
  lib.traverse((o) => {
    if (!o.isMesh || !upgrade[o.material.name]) return;
    o.geometry = o.geometry.clone();
    o.material = o.material.clone();
    upgrade[o.material.name](o.material, o.geometry);
    o.material.needsUpdate = true;
  });

  const groups = {};
  const shadowed = (m) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };
  const take = (name) => shadowed(lib.getObjectByName(name).clone());
  const group = (name) => { const g = new THREE.Group(); g.name = name; scene.add(g); groups[name] = g; return g; };
  const add = (g, name, [x, z, rot = 0], y = 0) => {
    const o = take(name);
    o.scale.setScalar(1000);
    o.position.set(x, y, z);
    o.rotation.y = rot;
    g.add(o);
    return o;
  };
  // 奏折一摞：素纸为主，夹两本黄绫，第五本抽出一截
  const mem = group('memorials');
  for (let i = 0; i < 9; i++) add(mem, i === 2 || i === 6 ? 'memorial_yellow' : 'memorial_plain', [Math.sin(i * 2.1) * 6 + (i === 4 ? 26 : 0), Math.cos(i * 1.7) * 8, Math.sin(i * 1.3) * 0.04], i * 13.2);
  add(group('tray'), 'tray', [0, 0]);
  const sealG = group('seal');
  add(sealG, 'cushion', [0, 0]);
  add(sealG, 'seal', [0, 0], 26);
  add(sealG, 'paste_box', [-150, 150, 0]);
  add(group('letterbox'), 'letterbox', [0, 0]);
  add(group('censer'), 'censer', [0, 0]);
  // 笔砚：砚居中，右侧笔山横搁两支笔（笔与笔山长轴垂直），左下墨锭，右下水盂
  const wr = group('writing');
  add(wr, 'inkstone', [0, 0]);
  const rest = [235, -40, 1.45];
  add(wr, 'brush_rest', rest);
  const axis = [Math.cos(rest[2]), -Math.sin(rest[2])];
  [[-26, 'brush_ink', 0.04], [26, 'brush_red', -0.06]].forEach(([along, name, wobble]) => {
    const rot = rest[2] - Math.PI / 2 + wobble;
    const dir = [Math.cos(rot), -Math.sin(rot)];
    add(wr, name, [rest[0] + axis[0] * along - dir[0] * 70, rest[1] + axis[1] * along - dir[1] * 70, rot], 29);
  });
  add(wr, 'ink_stick', [-150, 110, 0.5]);
  add(wr, 'dropper', [180, 125]);
  add(wr, 'brush_pot', [-235, -70, 0.4]);
  const books = group('books');
  for (let i = 0; i < 3; i++) add(books, i === 1 ? 'book_b' : 'book_a', [Math.sin(i * 1.9) * 8, Math.cos(i * 1.3) * 6, Math.sin(i) * 0.05], i * 17.5);
  add(group('tea'), 'tea', [0, 0]);
  add(group('redbrush'), 'brush_red', [0, 0], 6);   // 批奏疏时那支朱笔，平放案上（平时不在镜头里）
  group('map');                                     // 舆图那一处由 index.js 填（绫边、绢心、镇尺）

  const blobTex = blobTexture();
  const blob = (name, w, d, opacity = 0.5, [x, z] = [0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, d * 1.6), new THREE.MeshBasicMaterial({ color: 0x140a04, alphaMap: blobTex, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.4, z);
    m.renderOrder = -1;
    groups[name].add(m);
  };
  blob('memorials', 190, 380, 0.55);
  blob('tray', 330, 240, 0.5);
  blob('seal', 185, 185, 0.6);
  blob('seal', 90, 90, 0.4, [-150, 150]);
  blob('letterbox', 320, 230, 0.55);
  blob('censer', 130, 130, 0.5);
  blob('writing', 235, 165, 0.5);
  blob('writing', 120, 120, 0.45, [-235, -70]);
  blob('books', 280, 200, 0.55);
  blob('tea', 120, 120, 0.4);

  const anchors = {};
  function place(map) {
    for (const [name, [x, z, rot = 0]] of Object.entries(map)) {
      if (!groups[name]) continue;
      groups[name].position.set(x, 0, z);
      groups[name].rotation.y = rot;
    }
    for (const name of Object.keys(ANCHOR_Y)) anchors[name] = [groups[name].position.x, ANCHOR_Y[name], groups[name].position.z];
  }
  place(PLACE);
  return { groups, anchors, place, add, take, lib, notesTextures: tex.notes };
}
