#!/usr/bin/env node
// 新界面舆图的立体城郭与营造地标（web/ui/scene/map/towns3d.js）：各样模型都搭得出、顶点没有坏数、远看那份比近看省面；
// 聚落等第（web/ui/model/settlement.js）会给的每样营造地标都有立体模型；各地标的名义半宽罩得住模型本身（摆放、占地、多远开始显都按它）；
// 林木、村舍的立体版省面，分块挑着画：近看只画镜头里那一片、远了不画。
// 模块是 ES 模块、引着 three：拷进临时目录（目录标成 ES 模块），three 取仓里 vendor 的那份放进临时目录的 node_modules。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB = path.resolve(__dirname, '..');
let passed = 0;
function check(cond, msg) {
  if (!cond) throw new Error('[smoke-newui-towns3d] FAIL ' + msg);
  passed++;
}
// 一份几何的顶点：坐标、法线、颜色都是有限数，法线是单位长，颜色在 0～1.2、透明位只有 0（贴海面）或 1
function badVertices(geometry) {
  const pos = geometry.getAttribute('position').array, nor = geometry.getAttribute('normal').array, col = geometry.getAttribute('aColor').array;
  if (!pos.length || pos.length / 3 !== nor.length / 3 || pos.length / 3 !== col.length / 4) return '顶点数对不上';
  for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i]) || !Number.isFinite(nor[i])) return `第 ${Math.floor(i / 3)} 个顶点有坏数`;
  for (let i = 0; i < nor.length; i += 3) if (Math.abs(Math.hypot(nor[i], nor[i + 1], nor[i + 2]) - 1) > 1e-4) return `第 ${i / 3} 个法线不是单位长`;
  for (let i = 0; i < col.length; i += 4) {
    if ([0, 1, 2].some((k) => !(col[i + k] >= 0 && col[i + k] <= 1.2))) return `第 ${i / 4} 个顶点颜色出界`;
    if (col[i + 3] !== 0 && col[i + 3] !== 1) return `第 ${i / 4} 个顶点透明位不是 0 或 1`;
  }
  return null;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-towns3d-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    for (const f of ['towns3d.js', 'shaders.js']) fs.copyFileSync(path.join(WEB, 'ui', 'scene', 'map', f), path.join(dir, f));
    fs.copyFileSync(path.join(WEB, 'ui', 'model', 'settlement.js'), path.join(dir, 'settlement.js'));
    const three = path.join(dir, 'node_modules', 'three');
    fs.mkdirSync(three, { recursive: true });
    fs.writeFileSync(path.join(three, 'package.json'), '{"name":"three","type":"module","main":"three.module.js"}');
    for (const f of ['three.module.js', 'three.core.js']) fs.copyFileSync(path.join(WEB, 'vendor', 'three', f), path.join(three, f));
    const t = await import(pathToFileURL(path.join(dir, 'towns3d.js')).href);
    const s = await import(pathToFileURL(path.join(dir, 'settlement.js')).href);

    // 各样模型都搭得出：有面、顶点没坏数、有名义半宽
    for (const kind of t.TOWN_KINDS) {
      const md = t.townModel(kind);
      const bad = badVertices(md.geometry);
      check(md.tris > 0 && md.hw > 0 && !bad, `${kind} 搭得出（${md.tris} 面，半宽 ${md.hw}）${bad ? '：' + bad : ''}`);
      if (md.far) {
        const badFar = badVertices(md.far.geometry);
        check(md.far.tris < md.tris && !badFar, `${kind} 远看那份比近看省面（${md.far.tris} < ${md.tris}）${badFar ? '：' + badFar : ''}`);
      }
    }
    // 城郭四档、京城、残城都有远看那份；帐、寨、市镇、港、地标没有
    for (const kind of ['town0', 'city1', 'grand0', 'metro1', 'capital', 'ruin']) check(!!t.townModel(kind).far, `${kind} 有远看那份`);
    for (const kind of ['yurtS', 'market', 'port', 'academy', 'fort']) check(t.townModel(kind).far === null, `${kind} 不另做远看那份`);
    let threw = false;
    try { t.townModel('没有这样'); } catch (e) { threw = /没有这样的城郭模型/.test(e.message); }
    check(threw, '要一样没有的模型就报错，不悄悄画空');

    // 聚落等第会给的每样地标都有立体模型（加四周那座河埠）
    check(s.LANDMARK_KINDS.length >= 13 && s.LANDMARK_KINDS.includes('scaffold') && s.LANDMARK_KINDS.includes('ruin'), `地标样数 ${s.LANDMARK_KINDS.length}，含在建、半损`);
    check(!s.LANDMARK_KINDS.includes('port') && !s.LANDMARK_KINDS.includes('market'), '港、市不算地标（另设港、添市镇）');
    for (const kind of s.LANDMARK_KINDS.concat(['port'])) {
      const model = t.LANDMARK_MODEL[kind];
      check(!!model && t.TOWN_KINDS.includes(model), `地标 ${kind} → 模型 ${model}`);
    }
    // 各色营造名经归类给出的地标都在那张表里
    const names = ['白鹿洞书院', '烽火台', '箭楼', '城隍庙', '开元寺', '市舶司', '钞关', '河工', '常平仓', '卫所', '织造局', '驿站', '石桥', '巡抚衙门', '药舍'];
    const works = s.worksOf(names.map((name) => ({ name, status: 'completed' })).concat([{ name: '新修贡院', status: 'building' }, { name: '城墙', status: 'damaged' }]));
    check(works.landmarks.length > 0 && works.landmarks.every((k) => s.LANDMARK_KINDS.includes(k)), `归类给出的地标都在表里：${works.landmarks.join('、')}`);
    const cats = ['economic', 'military', 'cultural', 'administrative', 'religious', 'infrastructure'].map((category) => s.landmarkOf({ name: '某处营造', category }));
    check(cats.every((k) => s.LANDMARK_KINDS.includes(k)), `按类别认出的地标都在表里：${cats.join('、')}`);

    // 地标的名义半宽罩得住模型（东西不出半宽一截，南北不出半宽的一倍二五）：舆图按它摆开、记占地、定多远开始显
    for (const kind of s.LANDMARK_KINDS) {
      const md = t.townModel(t.LANDMARK_MODEL[kind]), bb = md.geometry.boundingBox;
      const ew = Math.max(-bb.min.x, bb.max.x), ns = Math.max(md.north, md.south);
      check(ew <= md.hw * 1.08 + 0.05 && ns <= md.hw * 1.25 + 0.1, `${kind} 东西 ${ew.toFixed(2)}、南北 ${ns.toFixed(2)} 在半宽 ${md.hw} 之内`);
      check(md.hw < t.townModel('town0').hw, `${kind} 比最小的城郭小（半宽 ${md.hw}）`);
    }

    // 林木、村舍的立体版：每样都省面（几千处一起画）
    for (const kind of t.SCATTER_KINDS) {
      const md = t.townModel(kind);
      check(md.tris <= 80 && md.far === null, `${kind} 省面（${md.tris} 面，不另做远看那份）`);
    }
    // 分块挑着画：近看只画镜头里那一片（远处那片太小、镜头背后那片看不见都不画），远了一处不画，拉回来又画上；不认得的样子不收
    const THREE = await import(pathToFileURL(path.join(three, 'three.module.js')).href);
    const shared = {
      uRelief: { value: 20 }, uPx: { value: 900 / (2 * Math.tan(Math.PI / 12)) }, uCam: { value: new THREE.Vector3() }, uFogNear: { value: 1e6 },
      uFogFar: { value: 2e6 }, uFogColor: { value: new THREE.Vector3() }, uLookT: { value: 1 }, uFadePx: { value: new THREE.Vector2(16, 24) }
    };
    const sc = t.createScatter(shared, { pine: 0.8, hamlet: 1 });
    const spot = (x0, z0, kindOf) => Array.from({ length: 40 }, (_, i) => ({ kind: kindOf(i), x: x0 + (i % 8) * 2, z: z0 + Math.floor(i / 8) * 2, h: 0.05, yaw: 0, size: 1.5 }));
    sc.set(spot(1000, 800, (i) => (i % 2 ? 'pine' : 'hamlet')).concat(spot(1600, 300, () => 'pine'), spot(1000, 930, () => 'pine'), [{ kind: '不认得', x: 1000, z: 800, h: 0, yaw: 0, size: 1.5 }]));
    check(sc.stats.instances === 120, `收下 120 处（不认得的不收）：${sc.stats.instances}`);
    const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 4000);
    const look = (dist) => {
      cam.position.set(1008, 1 + dist * Math.cos(0.95), 804 + dist * Math.sin(0.95));
      cam.lookAt(1008, 1, 804);
      sc.update(cam);
      return sc.stats.drawn;
    };
    check(look(75) === 40, `近看只画镜头里那一片 40 处：${look(75)}`);
    check(look(2000) === 0, `远了一处也不画：${look(2000)}`);
    check(look(75) === 40, '拉回来又画上');
    sc.dispose();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`[smoke-newui-towns3d] PASS ${passed} 项`);
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
