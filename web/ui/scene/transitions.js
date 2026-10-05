// 转场：入图（俯身看案上绢图 → 绢图自己发光 → 与立体舆图同机位交叉淡换 → 起山、设色由旧转鲜）与起身回案（倒过来）。
// 两个视图同在一个舞台上：书房 study、舆图 map。云从镜头前掠过是 DOM 层（clouds.jpg）。
import { LOOK_QINGLV, LOOK_QINGLV_AGED, RELIEF, mixLook } from './map/looks.js';
import { SHOTS } from './study/shots.js';
import { SHEET_EXTENT } from './world.js';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createDive({ stage, study, map, clouds = [], fov = 30, onMode = () => {} }) {
  const E = SHEET_EXTENT;
  const S = E.w / study.MAP_SHEET.w;               // 绢图上一毫米 = 舆图多少单位
  let mode = 'desk', busy = false;
  const wait = (ms) => new Promise((r) => setTimeout(() => { if (!stage.frozen) r(); }, ms));
  const hold = () => (stage.frozen ? new Promise(() => {}) : Promise.resolve());

  // 与案上绢图正俯视时一一对齐的舆图机位
  function registerPose() {
    const sp = study.sheetPose(fov);
    return { target: [E.x0 + E.w / 2, 0, E.y0 + E.h / 2], dist: sp.height * S, polar: 0.0002, az: 0 };
  }
  // 舆图这边的补间：机位、起伏、设色一起走
  function mapTween(to, { relief, look, duration }) {
    const from = { pose: map.pose(), relief: map.uniforms.uRelief.value };
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        if (stage.frozen) return;
        const k = Math.min(1, (performance.now() - t0) / (duration * 1000));
        const e = ease(k);
        const lerp = (a, b) => a + (b - a) * e;
        map.setPose({
          target: from.pose.target.map((v, i) => lerp(v, to.target[i])),
          dist: lerp(from.pose.dist, to.dist), polar: lerp(from.pose.polar, to.polar), az: lerp(from.pose.az, to.az)
        });
        map.uniforms.uRelief.value = lerp(from.relief, relief);
        if (look) map.setLook(mixLook(look[0], look[1], e));
        if (k < 1) requestAnimationFrame(step); else resolve();
      };
      step();
    });
  }
  // 一片云从镜头前掠过：入图时由远及近、出图时由近及远
  function cloudPass(direction) {
    const [a, b] = clouds;
    if (!a) return;
    const near = 'scale(1.9) translateY(4%)', mid = 'scale(1.25) translateY(0)', far = 'scale(0.9) translateY(-6%)';
    const [p0, p2] = direction > 0 ? [near, far] : [far, near];
    a.animate([{ opacity: 0, transform: p0 }, { opacity: 0.85, transform: mid, offset: 0.45 }, { opacity: 0, transform: p2 }], { duration: 1700, easing: 'ease-in-out' });
    b?.animate([{ opacity: 0, transform: 'scaleX(-1) ' + p0 }, { opacity: 0.6, transform: 'scaleX(-1) ' + mid, offset: 0.5 }, { opacity: 0, transform: 'scaleX(-1) ' + p2 }], { duration: 1900, delay: 120, easing: 'ease-in-out' });
  }
  // 飞行途中按进度调绢图自发光
  function glowWith(promise, curve) {
    let done = false;
    promise.then(() => { done = true; });
    const step = () => {
      const p = study.flightProgress;
      if (p != null) study.setSheetGlow(curve(p));
      if (!done && !stage.frozen) requestAnimationFrame(step);
    };
    step();
  }

  async function dive(point) {
    if (busy || mode !== 'desk') return;
    busy = true;
    onMode('flying');
    map.setInteractive(false);
    map.controls.minPolarAngle = 0;
    map.controls.maxDistance = 1e5;
    map.camera.fov = fov;
    map.camera.updateProjectionMatrix();
    map.uniforms.uRelief.value = 0;
    map.setLook(LOOK_QINGLV_AGED);
    map.setPose(registerPose());
    // 1) 俯身：书房镜头落到绢图正上方；后半段绢图渐渐「自己发光」，屋里的光斑、光柱淡去
    const flight = study.flyTo(study.sheetPose(fov), 1.35);
    glowWith(flight, (p) => smooth(0.5, 1.0, p));
    await wait(950);
    cloudPass(+1);
    await flight;
    await hold();
    study.setSheetGlow(1);
    // 2) 换画：案上这幅绢图与立体舆图同一机位，交叉淡换
    map.setActive(true);
    await stage.fadeTo('map', 0.5);
    mode = 'map';
    onMode('map');
    // 3) 起山：地形由平而起，设色由旧转鲜，镜头斜倾到落点
    const end = point
      ? { target: [point[0], 0, point[1]], dist: 820, polar: 0.8, az: 0.04 }
      : { target: [1190, 0, 690], dist: 1500, polar: 0.52, az: 0 };
    await mapTween(end, { relief: RELIEF, look: [LOOK_QINGLV_AGED, LOOK_QINGLV], duration: 2.0 });
    map.controls.minPolarAngle = 0.12;
    map.controls.maxDistance = 2600;
    map.setInteractive(true);
    onMode('settled');
    busy = false;
  }

  async function rise() {
    if (busy || mode !== 'map') return;
    busy = true;
    onMode('flying');
    map.setInteractive(false);
    map.controls.minPolarAngle = 0;
    map.controls.maxDistance = 1e5;
    // 1) 落山：地形压平、设色转旧，镜头回到正俯视对齐位
    await mapTween(registerPose(), { relief: 0, look: [LOOK_QINGLV, LOOK_QINGLV_AGED], duration: 1.5 });
    // 2) 换回书房（书房一直停在绢图正上方那一帧）
    cloudPass(-1);
    await stage.fadeTo('study', 0.55);
    map.setActive(false);
    mode = 'desk';
    onMode('desk');
    // 3) 起身：镜头回到御案，前半段屋里的光回来
    const s = SHOTS.desk;
    const back = study.flyTo({ pos: s.pos, look: s.look, fov: s.fov }, 1.3);
    glowWith(back, (p) => 1 - smooth(0.0, 0.5, p));
    await back;
    study.setSheetGlow(0);
    onMode('desk-settled');
    busy = false;
  }

  return { dive, rise, get mode() { return mode; }, get busy() { return busy; } };
}
