// 书房视图：屋子＋案上器物＋窗光空气，挂到舞台上。按身份取房间（地基只有皇帝的御书房）。
// 对外：setShot、flyTo、pickMap、screenOf、mapToScreen、sheetPose、setSheetGlow、setMapSheet、memorialPaper、anchors……
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildWindow, loadRoom, buildCouplets, plaqueMap, coupletMap, sunVector, SUN_UNIFORM, WIN, DESK, ROOM, ROOMS, LIGHTMAP_GAIN } from './room.js';
import { createPost, createDust, createSmoke } from './fx.js';
import { loadProps, PLACE } from './props.js';
import { SHOTS } from './shots.js';
import { damaskTexture, paperTexture, silkScrollTexture, wrapCanvas } from './textures.js';
import { titleScrollCanvases } from '../../kit/brush.js';
import { quality } from '../../core/quality.js';
import { cachedCanvases } from '../../core/texcache.js';
import { SHEET_EXTENT } from '../world.js';

// 舆图绢本在案上的位置与大小（毫米）；绢心比例与舆图世界（2100×1540）一致
export const MAP_SHEET = { x: -10, z: -60, w: 1300 };
MAP_SHEET.h = MAP_SHEET.w * 1540 / 2100;
const SHEET_Y = 1.6;

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// 反射用的环境（没烘光照贴图时用）：暖暗的屋子，三面门窗亮、顶上一片柔光
function fallbackEnv(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({ color: 0x3a2a1e, side: THREE.BackSide })));
  for (const [x, w, h, y, k] of [[-6, 5, 4, 3, 6], [0, 5, 6, 2, 3.2], [6, 5, 4, 3, 2.6]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.88, k * 0.72) }));
    win.position.set(x, y, -9.9);
    env.add(win);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.85, 0.78) }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 4.9;
  env.add(ceil);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}

// 太阳阴影的正交相机：把书案与整扇窗都框进光的视野
function fitSunShadow(sun) {
  const pts = [];
  for (const x of [-DESK.w / 2, DESK.w / 2]) for (const z of [-DESK.d / 2, DESK.d / 2]) for (const y of [-40, 320]) pts.push(new THREE.Vector3(x, y, z));
  for (const x of [WIN.cx - WIN.w / 2 - 100, WIN.cx + WIN.w / 2 + 100]) for (const y of [WIN.cy - WIN.h / 2 - 100, WIN.cy + WIN.h / 2 + 100]) pts.push(new THREE.Vector3(x, y, WIN.z));
  for (const x of [-ROOM.x, 0]) for (const z of [WIN.z, 0]) pts.push(new THREE.Vector3(x, DESK.floor, z));
  sun.updateMatrixWorld();
  sun.target.updateMatrixWorld();
  const view = new THREE.Matrix4().lookAt(sun.position, sun.target.position, new THREE.Vector3(0, 1, 0));
  view.setPosition(sun.position);
  const inv = view.clone().invert();
  const box = new THREE.Box3();
  pts.forEach((p) => box.expandByPoint(p.clone().applyMatrix4(inv)));
  const cam = sun.shadow.camera;
  cam.left = box.min.x;
  cam.right = box.max.x;
  cam.bottom = box.min.y;
  cam.top = box.max.y;
  cam.near = Math.max(10, -box.max.z - 100);
  cam.far = -box.min.z + 100;
  cam.updateProjectionMatrix();
}

// 中堂立轴：西山墙正中。画心微有起伏，天杆系绳挂墙钉，地杆两头白玉轴头
async function buildHangingScroll(scene, opts) {
  const key = 'scroll:' + JSON.stringify(opts);
  const [cMap, cRough, cMetal] = await cachedCanvases([key + ':map', key + ':rough', key + ':metal'], async () => {
    const cv = await titleScrollCanvases(opts);
    return [cv.map, cv.roughness, cv.metalness];
  });
  const cv = { aspect: cMap.width / cMap.height };
  const map = wrapCanvas(cMap), roughnessMap = wrapCanvas(cRough, { srgb: false }), metalnessMap = wrapCanvas(cMetal, { srgb: false });
  const scroll = new THREE.Group();
  const sw = 860, sh = sw / cv.aspect;
  const geo = new THREE.PlaneGeometry(sw, sh, 12, 40);
  const gp = geo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const u = gp.getX(i) / sw + 0.5, v = gp.getY(i) / sh + 0.5;
    const hold = Math.min(1, v * 12) * Math.min(1, (1 - v) * 20);           // 天杆、地杆处压平
    gp.setZ(i, hold * (Math.sin(u * Math.PI) * 4 + Math.sin(v * 23 + u * 2) * 1.6 + Math.sin(v * 7.3) * 2.2));
  }
  geo.computeVertexNormals();
  const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughnessMap, metalnessMap, roughness: 1, metalness: 1, envMapIntensity: 1.2 }));
  scroll.add(face);
  const wood = new THREE.MeshStandardMaterial({ color: 0x2e1a12, roughness: 0.45 });
  const jade = new THREE.MeshStandardMaterial({ color: 0xe9e3cf, roughness: 0.22, envMapIntensity: 1.4 });
  const cord = new THREE.MeshStandardMaterial({ color: 0x5b4a33, roughness: 0.9 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, sw + 30, 24), wood);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, -sh / 2 - 4, 10);
  scroll.add(rod);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [21, 0], [24, 6], [24, 30], [21, 38], [14, 42], [0, 42]].map(([x, y]) => new THREE.Vector2(x, y)), 28), jade);
    cap.rotation.z = -s * Math.PI / 2;
    cap.position.set(s * (sw / 2 + 15), -sh / 2 - 4, 10);
    scroll.add(cap);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, sw + 6, 16, 1, false, 0, Math.PI), wood);
  top.rotation.z = Math.PI / 2;
  top.position.set(0, sh / 2 + 2, 2);
  scroll.add(top);
  const nail = new THREE.Vector3(0, sh / 2 + 150, 0);
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * sw * 0.36, sh / 2 + 6, 6);
    const len = a.distanceTo(nail);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, len, 6), cord);
    seg.position.copy(a).add(nail).multiplyScalar(0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nail.clone().sub(a).normalize());
    scroll.add(seg);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(5, 1.4, 6, 12), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 1, roughness: 0.4 }));
    eye.position.copy(a);
    scroll.add(eye);
  }
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 24, 8), new THREE.MeshStandardMaterial({ color: 0x6a5234, metalness: 1, roughness: 0.4 }));
  peg.rotation.x = Math.PI / 2;
  peg.position.copy(nail).add(new THREE.Vector3(0, 0, -6));
  scroll.add(peg);
  scroll.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scroll.position.set(-ROOM.x + 20, 1420, -1250);
  scroll.rotation.y = Math.PI / 2;
  scene.add(scroll);
  return scroll;
}

// 案上舆图：绫边、绢心（略有折痕起伏）、两根镇尺。绢心贴图先用素绢，舆图画好后 setMapSheet 换上
function buildMapSheet(group, props) {
  const border = 46;
  const mount = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SHEET.w + border * 2, MAP_SHEET.h + border * 2), new THREE.MeshStandardMaterial({ map: damaskTexture('#b9ab86'), roughness: 0.7 }));
  mount.material.map.repeat.set(8, 6);
  mount.rotation.x = -Math.PI / 2;
  mount.position.set(MAP_SHEET.x, 0.8, MAP_SHEET.z);
  mount.receiveShadow = true;
  const geo = new THREE.PlaneGeometry(MAP_SHEET.w, MAP_SHEET.h, 120, 88);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (MAP_SHEET.w / 2), y = pos.getY(i) / (MAP_SHEET.h / 2);
    const crease = Math.exp(-Math.pow(x * 7, 2)) * 1.2 + Math.exp(-Math.pow(y * 9, 2)) * 0.6;
    pos.setZ(i, crease + Math.sin(x * 9 + y * 4) * 0.4);
  }
  geo.computeVertexNormals();
  const blank = paperTexture('#d9cca8', 77);
  const sheet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: blank, roughness: 0.82, emissive: 0xffffff, emissiveMap: blank, emissiveIntensity: 0 }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(MAP_SHEET.x, SHEET_Y, MAP_SHEET.z);
  sheet.receiveShadow = true;
  group.add(mount, sheet);
  props.add(group, 'weight', [MAP_SHEET.x - 330, MAP_SHEET.z - MAP_SHEET.h / 2 - border / 2, 0], 1);
  props.add(group, 'weight', [MAP_SHEET.x + 330, MAP_SHEET.z + MAP_SHEET.h / 2 + border / 2, 0], 1);
  return sheet;
}

export async function createStudyView(stage, {
  identity = 'sovereign', shot = 'desk', notes = [], scroll = {}, onProgress = () => {}
} = {}) {
  const q = quality();
  const renderer = stage.renderer;
  const preset = ROOMS[identity] || ROOMS.sovereign;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1d14);
  scene.environment = fallbackEnv(renderer);
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(32, stage.size.w / stage.size.h, 20, 30000);

  onProgress('屋宇', 0.1);
  await buildWindow(scene);
  const room = await loadRoom(scene, preset);
  onProgress('陈设', 0.45);
  const boards = await buildCouplets(scene, preset);
  const sun = new THREE.DirectionalLight(0xffecd0, 3.9);
  sun.target.position.set(-600, 0, -300);
  sun.position.copy(sun.target.position).addScaledVector(SUN_UNIFORM.value, 7000);
  sun.castShadow = true;
  sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 6;
  scene.add(sun, sun.target);
  fitSunShadow(sun);
  // 天光与糊纸门窗的柔光已烘进光照贴图；没烘时退回半球光＋三面门窗的面光
  const hemiBase = room.lightmap ? 0.35 : 0.55;
  const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x6b4a33, hemiBase);
  scene.add(hemi);
  if (!room.lightmap) {
    RectAreaLightUniformsLib.init();
    for (const [x, y, w, h, k] of [[WIN.cx, WIN.cy, WIN.w, WIN.h, 9], [0, DESK.floor + 1500, 2620, 3000, 4.5], [3000, WIN.cy, 2620, 2020, 3.6]]) {
      const glow = new THREE.RectAreaLight(0xfff0da, k, w, h);
      glow.position.set(x, y, WIN.z + WIN.wallT / 2 + 40);
      glow.lookAt(x + 200, y - 400, 3000);
      scene.add(glow);
    }
  }
  await buildHangingScroll(scene, scroll);
  onProgress('案上器物', 0.7);
  const props = await loadProps(scene, { notes });
  const sheet = buildMapSheet(props.groups.map, props);

  // 空气
  const post = createPost(renderer);
  const dust = q.dust ? createDust(q.dust) : null;
  if (dust) scene.add(dust.object);
  const smoke = createSmoke(new THREE.Vector3(), { height: 760, width: 120, seed: 2 });
  const steam = createSmoke(new THREE.Vector3(), { height: 180, width: 30, seed: 7 });
  scene.add(smoke.object, steam.object);
  const throneSmokes = [-1, 1].map((sx, i) => {        // 宝座前两只三足炉各一缕
    const sm = createSmoke(new THREE.Vector3(sx * 1100, 335, 1760), { height: 1400, width: 220, seed: 11 + i });
    scene.add(sm.object);
    return sm;
  });
  const smokes = [smoke, steam, ...throneSmokes];
  const followSmoke = () => {
    smoke.uniforms.uOrigin.value.set(8, 212, 4).applyMatrix4(props.groups.censer.matrixWorld);
    steam.uniforms.uOrigin.value.set(0, 58, 0).applyMatrix4(props.groups.tea.matrixWorld);
  };

  // 环境球：从案面上方拍一圈这间屋（光照贴图＋此刻的太阳），给没烘光照的细件当环境光与反光
  const cubeRT = new THREE.WebGLCubeRenderTarget(q.envCubeSize, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(40, 20000, cubeRT);
  cubeCam.position.set(0, 520, 150);
  scene.add(cubeCam);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function captureEnv() {
    if (!room.lightmap) return;
    cubeCam.update(renderer, scene);
    const next = pmrem.fromCubemap(cubeRT.texture);
    scene.environment = next.texture;
    scene.environmentIntensity = 1.5;
    envRT?.dispose();
    envRT = next;
  }

  // ---------- 镜头 ----------
  let current = null;
  let time = 0;
  function setShot(name) {
    const s = typeof name === 'string' ? SHOTS[name] : name;
    current = s;
    camera.fov = s.fov;
    camera.position.set(...s.pos);
    camera.lookAt(...s.look);
    camera.updateProjectionMatrix();
    SUN_UNIFORM.value.copy(sunVector(...(s.sun || [32, 30])));
    sun.position.copy(sun.target.position).addScaledVector(SUN_UNIFORM.value, 7000);
    fitSunShadow(sun);
    props.place({ ...PLACE, ...(s.place || {}) });
    scene.updateMatrixWorld();
    followSmoke();
    captureEnv();
    if (dust) {
      dust.uniforms.uPx.value = stage.size.h / (2 * Math.tan(THREE.MathUtils.degToRad(s.fov / 2)));
      dust.uniforms.uAmount.value = s.dust ?? 1;
    }
    post.uniforms.uStrength.value = s.shafts ?? 1.2;
    post.uniforms.uG.value = s.g ?? 0.6;
    const fill = s.fill ?? 1;                        // 补光按镜头调：要明暗对比强的镜头调低
    room.root.traverse((o) => { if (o.isMesh && o.material.lightMap) o.material.lightMapIntensity = Math.PI * LIGHTMAP_GAIN * fill; });
    hemi.intensity = hemiBase * fill;
  }
  setShot(shot);

  function currentPose() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone();
    const t = dir.y < -0.05 ? -pos.y / dir.y : 1500;     // 看点取视线与案面（y=0）的交点
    return { pos: pos.toArray(), look: pos.clone().addScaledVector(dir, t).toArray(), fov: camera.fov };
  }
  let flight = null;
  function flyTo(to, duration = 1.2) {
    flight?.resolve();
    const from = currentPose();
    return new Promise((resolve) => { flight = { from, to, t0: time, duration, resolve }; });
  }
  function stepFlight() {
    if (!flight) return;
    const k = Math.min(1, (time - flight.t0) / flight.duration);
    const e = ease(k);
    const lerp3 = (a, b) => a.map((v, i) => v + (b[i] - v) * e);
    camera.position.set(...lerp3(flight.from.pos, flight.to.pos));
    camera.lookAt(...lerp3(flight.from.look, flight.to.look));
    camera.fov = flight.from.fov + (flight.to.fov - flight.from.fov) * e;
    camera.updateProjectionMatrix();
    if (k >= 1) { const r = flight.resolve; flight = null; r(); }
  }

  // ---------- 屏幕与案面换算 ----------
  function screenOf(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return [(v.x * 0.5 + 0.5) * stage.size.w, (-v.y * 0.5 + 0.5) * stage.size.h];
  }
  // 舆图世界坐标 → 屏幕：给府州小笺、钉子定位（绢图画的是 SHEET_EXTENT 那一块）
  const E = SHEET_EXTENT;
  function mapToScreen(wx, wy) {
    const o = props.groups.map.position;
    return screenOf(o.x + MAP_SHEET.x + ((wx - E.x0) / E.w - 0.5) * MAP_SHEET.w, 3, o.z + MAP_SHEET.z + ((wy - E.y0) / E.h - 0.5) * MAP_SHEET.h);
  }
  // 正俯视绢图、绢心横向撑满屏幕的机位（与立体舆图接缝处的俯视机位一一对应）
  function sheetPose(fov = 30) {
    const o = props.groups.map.position;
    const cx = o.x + MAP_SHEET.x, cz = o.z + MAP_SHEET.z;
    const h = (MAP_SHEET.w / 2) / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * camera.aspect);
    return { pos: [cx, h + SHEET_Y, cz + h * 1e-4], look: [cx, SHEET_Y, cz], fov, height: h };
  }
  // 屏幕上一点落在绢图上的舆图坐标；不在图上返回 null
  const ray = new THREE.Raycaster();
  function pickMap(clientX, clientY) {
    const rect = stage.canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
    const t = (SHEET_Y - ray.ray.origin.y) / ray.ray.direction.y;
    if (!(t > 0)) return null;
    const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
    const o = props.groups.map.position;
    const u = (p.x - o.x - MAP_SHEET.x) / MAP_SHEET.w + 0.5, v = (p.z - o.z - MAP_SHEET.z) / MAP_SHEET.h + 0.5;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [E.x0 + u * E.w, E.y0 + v * E.h] : null;
  }
  // 屏幕上一点落在哪组案上器物上（器物即功能：点奏折批阅、点笔砚拟诏……）；没点中返回 null。names 限定只认哪几组
  function pickProp(clientX, clientY, names) {
    const rect = stage.canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
    const groups = (names || Object.keys(props.groups)).map((n) => props.groups[n]).filter((g) => g && g.visible);
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };   // 射线不管显隐，换陈设藏起来的件要自己剔掉
    const hit = ray.intersectObjects(groups, true).find((x) => x.object.isMesh && !x.object.material.transparent && shown(x.object));
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) if (o.parent && o.parent.isScene) return o.name || null;
    return null;
  }
  // 入图的最后一段：绢图渐渐「自己发光」、屋里的光斑光柱浮尘淡去；k=1 时连色调映射也关掉，画面就是那张绢图原样
  const sheetBase = sheet.material.color.clone();
  function setSheetGlow(k) {
    sheet.material.color.copy(sheetBase).multiplyScalar(1 - k);
    sheet.material.emissiveIntensity = k;
    post.uniforms.uStrength.value = (current?.shafts ?? 1.2) * (1 - k);
    if (dust) dust.uniforms.uAmount.value = (current?.dust ?? 1) * (1 - k);
    post.uniforms.uTone.value = k >= 0.999 ? 0 : 1;
  }
  function setMapSheet(canvas) {
    const tex = wrapCanvas(canvas, { aniso: 8 });
    const old = sheet.material.map;
    sheet.material.map = tex;
    sheet.material.emissiveMap = tex;
    sheet.material.needsUpdate = true;
    old?.dispose();
  }

  // 案上摊开的一件：奏折（素纸面，经折装折痕一峰一谷交替）或诏卷（surface:'silk'，黄绫平展、两端卷轴）；字由页面 DOM 叠上去
  let paper = null, paperSpec = null;
  function setMemorialPaper(spec) {
    if (paper) {
      scene.remove(paper);
      paper.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
      paper = null;
    }
    paperSpec = spec;
    if (!spec) return;
    const { w, h, x = 0, z = 0, rot = 0, panels = 6, surface = 'paper' } = spec;
    const silk = surface === 'silk';
    const g = new THREE.PlaneGeometry(w, h, silk ? 1 : panels * 4, 1);
    const pp = g.attributes.position;
    if (!silk) {
      for (let i = 0; i < pp.count; i++) {
        const u = (pp.getX(i) / w + 0.5) * panels;
        pp.setZ(i, Math.abs((u % 2) - 1) * 7);
      }
    }
    g.computeVertexNormals();
    paper = new THREE.Mesh(g, new THREE.MeshStandardMaterial(silk ? { map: silkScrollTexture(), roughness: 0.48, metalness: 0.05 } : { map: paperTexture('#e2d0a8', 17), roughness: 0.9 }));
    if (!silk) paper.material.map.repeat.set(3, 2);
    if (silk) {
      // 卷轴：深色木杆，两头青玉轴头；挂在绫的局部坐标里（绫面在 XY，杆顺 Y）
      const wood = new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.38 });
      const jade = new THREE.MeshStandardMaterial({ color: 0x9fb89a, roughness: 0.25 });
      for (const sx of [-1, 1]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, h + 30, 24), wood);
        rod.position.set(sx * (w / 2 + 12), 0, 15);
        for (const sy of [-1, 1]) {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 26, 24), jade);
          cap.position.set(0, sy * (h / 2 + 28), 0);
          rod.add(cap);
        }
        rod.traverse((o) => { o.castShadow = o.receiveShadow = true; });
        paper.add(rod);
      }
    }
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = rot;
    paper.position.set(x, 4, z);
    paper.castShadow = true;
    paper.receiveShadow = true;
    scene.add(paper);
  }
  // 摊开的奏折四角在屏幕上的位置（左上、右上、右下、左下），页面据此把字贴上纸面
  function paperCorners() {
    if (!paper) return null;
    paper.updateMatrixWorld();
    const { w, h } = paperSpec;
    return [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]].map(([x, y]) => {
      const p = new THREE.Vector3(x, y, 0).applyMatrix4(paper.matrixWorld);
      return screenOf(p.x, p.y, p.z);
    });
  }

  // 按身份换陈设：匾、联、案上器物（ui/model/identity.js 各档的 room 与 props）。
  // 另起一间屋（dir 不同）的要等那几间建好（页面期 P5），眼下几档都借御书房的骨架
  let dressed = preset;
  async function dress(roomKey, look = {}) {
    const next = ROOMS[roomKey] || ROOMS.sovereign;
    if ((next.dir || '') !== (preset.dir || '')) console.warn('[study] 另起一间屋尚未接上，先借本屋陈设：', roomKey);
    if (next.plaque !== dressed.plaque) {
      const map = await plaqueMap(next.plaque);
      for (const m of room.plaques) { const old = m.map; m.map = map; m.needsUpdate = true; if (old && old !== map) old.dispose(); }
    }
    for (let i = 0; i < boards.length; i++) {
      const text = next.couplets[i] && next.couplets[i][0];
      if (!text || (dressed.couplets[i] && dressed.couplets[i][0] === text)) continue;
      const old = boards[i].material.map;
      boards[i].material.map = await coupletMap(text);
      boards[i].material.needsUpdate = true;
      old?.dispose();
    }
    props.dress(look);
    dressed = next;
    captureEnv();
  }

  onProgress('落座', 1);
  const hooks = new Set();
  const view = {
    name: 'study',
    scene, camera, props, anchors: props.anchors, groups: props.groups, post, MAP_SHEET,
    update(t, dt) {
      time += dt;
      if (dust) dust.uniforms.uTime.value = time;
      for (const sm of smokes) sm.uniforms.uTime.value = time;
      stepFlight();
      for (const fn of hooks) fn(time, camera, dt);
    },
    render(r, target) {
      post.render(scene, camera, time, target);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      post.setSize();
      if (dust && current) dust.uniforms.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(current.fov / 2)));
    },
    onFrame(fn) { hooks.add(fn); return () => hooks.delete(fn); },
    setShot, currentPose, flyTo, screenOf, mapToScreen, sheetPose, pickMap, pickProp, setSheetGlow, setMapSheet, setMemorialPaper, paperCorners, dress, setNotes: (list) => props.setNotes(list),
    get room() { return dressed; },
    get flightProgress() { return flight ? Math.min(1, (time - flight.t0) / flight.duration) : null; },
    get shot() { return current; },
    dispose() {
      post.dispose();
      cubeRT.dispose();
      envRT?.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        if (!o.isMesh && !o.isPoints) return;
        o.geometry?.dispose();
        for (const m of [].concat(o.material || [])) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        }
      });
    }
  };
  return view;
}
