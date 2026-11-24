#!/usr/bin/env node
// 新界面舆图的立体城郭与营造地标（web/ui/scene/map/towns3d.js）：各样模型都搭得出、顶点没有坏数、远看那份比近看省面；
// 聚落等第（web/ui/model/settlement.js）会给的每样营造地标都有立体模型；各地标的名义半宽罩得住模型本身（摆放、占地、多远开始显都按它）；
// 林木、村舍的立体版省面，分块挑着画：近看只画镜头里那一片、远了不画；日本、朝鲜（towns3d-east.js）与大越、南洋、西洋据点（towns3d-south.js）诸样各档都有、越档越大；
// 那几处的城外诸样（市镇、港、河埠与寺、祠庙、教堂、书院、堡、官署）照地域换了样子，占地不比舆图留的大，港贴海面、河埠随地面，其余各处一样。
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
    for (const f of ['towns3d.js', 'towns3d-east.js', 'towns3d-south.js', 'shaders.js']) fs.copyFileSync(path.join(WEB, 'ui', 'scene', 'map', f), path.join(dir, f));
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
    // 日本、朝鲜诸样（towns3d-east.js）、大越南洋西洋据点诸样（towns3d-south.js）：聚落等第给的每个地域，四档两种、都城都有模型，都有远看那份；档越高占地越大；
    // 日本天守越档越高（最高处是天守顶），安土以前那一路（不筑城）比同档城下町矮
    const east = await import(pathToFileURL(path.join(dir, 'towns3d-east.js')).href);
    const south = await import(pathToFileURL(path.join(dir, 'towns3d-south.js')).href);
    for (const c of Object.values(s.CULTURE)) {
      const pre = east.EAST_KIND[c] || south.SOUTH_KIND[c];
      check(!!pre, `地域 ${c} 有模型前缀`);
      for (const kind of [`${pre}Cap`, ...[0, 1, 2, 3].flatMap((tier) => [`${pre}${tier}0`, `${pre}${tier}1`])]) {
        check(t.TOWN_KINDS.includes(kind) && !!t.townModel(kind).far, `${kind} 有，且有远看那份`);
      }
      const hw = [0, 1, 2, 3].map((tier) => t.townModel(`${pre}${tier}0`).hw).concat(t.townModel(`${pre}Cap`).hw);
      check(hw.every((x, i) => i === 0 || x > hw[i - 1]), `${c} 档越高占地越大：${hw.join(' < ')}`);
    }
    // 城郭的名义半宽（摆放、留地、多远开始显都按它）与实际搭出来的相符：东西半宽不少于它的九成，也不出它的一倍六（护城河、关厢在墙外）
    const CITY = /^(town|city|grand|metro)\d$|^(jp|jo|ko|vn|sea|we)\d\d$|^(capital|ruin|jpCap|joCap|koCap|vnCap|seaCap|weCap)$/;
    for (const kind of t.TOWN_KINDS.filter((k) => CITY.test(k))) {
      const md = t.townModel(kind), bb = md.geometry.boundingBox, ew = Math.max(-bb.min.x, bb.max.x);
      check(ew >= md.hw * 0.9 && ew <= md.hw * 1.6, `${kind} 实际东西半宽 ${ew.toFixed(2)} 与名义 ${md.hw} 相符`);
    }
    const top = (kind) => t.townModel(kind).geometry.boundingBox.max.y;
    const jpTop = [0, 1, 2, 3].map((tier) => top(`jp${tier}0`));
    check(jpTop.every((y, i) => i === 0 || y > jpTop[i - 1]), `天守越档越高：${jpTop.map((y) => y.toFixed(2)).join(' < ')}`);
    for (const tier of [1, 2, 3]) check(top(`jo${tier}0`) < top(`jp${tier}0`), `安土以前不筑天守，比同档城下町矮（第 ${tier} 档）`);
    // 城外诸样照地域（towns3d-east.js EAST_LOCAL、towns3d-south.js SOUTH_LOCAL，舆图按 localKind 取）：每个地域的市镇、港、河埠都换了样子；
    // 换成的模型都有、省面、不另做远看那份。市镇、港、河埠占地不出舆图给它留的地（市镇半宽 1.3、港 1.1，index.js 记占地按这个），
    // 北沿南沿不比中原那份远；港有贴海面的顶点（栈、船贴海面），河埠一个也没有（随地面）。地标名义半宽罩得住、比最小的城郭小。
    const seaCount = (g) => { const c = g.getAttribute('aColor').array; let n = 0; for (let i = 3; i < c.length; i += 4) if (c[i] === 0) n++; return n; };
    const span = (md) => { const bb = md.geometry.boundingBox; return [Math.max(-bb.min.x, bb.max.x), md.north, md.south]; };
    const RESERVE = { market: 1.3, port: 1.1, wharf: 1.1 };
    const local = { ...east.EAST_LOCAL, ...south.SOUTH_LOCAL };
    for (const c of Object.values(s.CULTURE)) {
      const table = local[c];
      check(!!table, `地域 ${c} 有城外诸样表`);
      for (const base of ['market', 'port', 'wharf']) check(t.localKind(base, c) !== base, `${c} 的 ${base} 换了样子：${t.localKind(base, c)}`);
      for (const [base, kind] of Object.entries(table)) {
        check(t.localKind(base, c) === kind && t.TOWN_KINDS.includes(kind), `${c} ${base} → ${kind}`);
        const md = t.townModel(kind), [ew, n, so] = span(md);
        check(md.far === null && md.tris <= 2000, `${kind} 省面（${md.tris} 面，不另做远看那份）`);
        if (RESERVE[base]) {
          const [, rn, rso] = span(t.townModel(base));
          check(ew <= RESERVE[base] && n <= Math.max(RESERVE[base], rn + 0.05) && so <= rso + 0.05, `${kind} 占地不出留的地（东西 ${ew.toFixed(2)}，北 ${n.toFixed(2)}，南 ${so.toFixed(2)}）`);
          if (base !== 'market') check(base === 'port' ? seaCount(md.geometry) > 0 : seaCount(md.geometry) === 0, `${kind} ${base === 'port' ? '栈、船贴海面' : '随地面，没有贴海面的'}`);
        } else {
          check(ew <= md.hw * 1.08 + 0.05 && Math.max(n, so) <= md.hw * 1.25 + 0.1 && md.hw < t.townModel('town0').hw, `${kind} 东西 ${ew.toFixed(2)}、南北 ${Math.max(n, so).toFixed(2)} 在半宽 ${md.hw} 之内，比最小的城郭小`);
        }
      }
    }
    for (const base of ['granary', 'waterworks', 'workshop', 'beacon', 'relay', 'bridge', 'scaffold', 'ruinS']) check(Object.values(s.CULTURE).every((c) => t.localKind(base, c) === base), `${base} 各处一样`);
    check(['market', 'port', 'temple', 'church'].every((b) => t.localKind(b, null) === b && t.localKind(b, '') === b), '没给地域（中原）照原样');
    check(t.LANDMARK_MODEL.church === 'church' && t.localKind('church', 'west') !== 'church' && t.localKind('church', 'japan') === 'church', '教堂：西洋据点画西式的，别处照中原画殿');
    check(t.localKind('temple', 'west') === 'temple' && t.localKind('shrine', 'west') === 'shrine', '西洋据点的寺、祠庙照中原（华人的庙）');
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
