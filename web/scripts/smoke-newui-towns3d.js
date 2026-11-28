#!/usr/bin/env node
// 新界面舆图的立体城郭与营造地标（web/ui/scene/map/towns3d.js）：各样模型都搭得出、顶点没有坏数、远看那份比近看省面；
// 聚落等第（web/ui/model/settlement.js）会给的每样营造地标都有立体模型；各地标的名义半宽罩得住模型本身（摆放、占地、多远开始显都按它）；
// 林木、村舍的立体版省面，分块挑着画：近看只画镜头里那一片、远了不画；日本、朝鲜（towns3d-east.js）与大越、南洋、西洋据点（towns3d-south.js）诸样各档都有、越档越大；
// 那几处的城外诸样（市镇、港、河埠与寺、祠庙、教堂、书院、堡、官署）与四郊村舍照地域换了样子，占地不比舆图留的大，港贴海面、河埠随地面，其余各处一样；
// 治所画哪一样（seatKind）：中原照四档、京城、残城，那几处照当地的四档、都城，残破的画那里的残城（与府城一般大）。
// 城郭近看、远看两份按舆图的钟换，显出、收掉也按钟淡（createTowns）：镜头停下来每座城只画一份、全显，不停在半抖点。
// 林木、村舍小图换立体也按钟换（createScatter，小图那层的 aOut 随着写）：镜头停下来每处只是小图或只是立体；镜头停着一处不算。
// 治所挨得太近的让开（fitSeats）：先摆的不动，后摆的缩、挪着让开，摆完不叠；寻常的实在摆不下就不画，也不占地。
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
      for (const kind of [`${pre}Cap`, `${pre}Ruin`, ...[0, 1, 2, 3].flatMap((tier) => [`${pre}${tier}0`, `${pre}${tier}1`])]) {
        check(t.TOWN_KINDS.includes(kind) && !!t.townModel(kind).far, `${kind} 有，且有远看那份`);
      }
      // 残城与那里的府城一般大（中原的残城也照府城画）
      check(Math.abs(t.townModel(`${pre}Ruin`).hw - t.townModel(`${pre}10`).hw) < 0.06, `${pre}Ruin 与 ${pre}10 一般大：${t.townModel(`${pre}Ruin`).hw}、${t.townModel(`${pre}10`).hw}`);
      const hw = [0, 1, 2, 3].map((tier) => t.townModel(`${pre}${tier}0`).hw).concat(t.townModel(`${pre}Cap`).hw);
      check(hw.every((x, i) => i === 0 || x > hw[i - 1]), `${c} 档越高占地越大：${hw.join(' < ')}`);
    }
    // 城郭的名义半宽（摆放、留地、多远开始显都按它）与实际搭出来的相符：东西半宽不少于它的九成，也不出它的一倍六（护城河、关厢在墙外）
    const CITY = /^(town|city|grand|metro)\d$|^(jp|jo|ko|vn|sea|we)(\d\d|Cap|Ruin)$|^(capital|ruin)$/;
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
    // 四郊村舍也照地域换（换成的在林木村舍那层里，省面那条见下）；林木各处一样
    for (const c of Object.values(s.CULTURE)) {
      check(['hamlet', 'hamletB'].every((b) => t.localKind(b, c) !== b && t.SCATTER_KINDS.includes(t.localKind(b, c))), `${c} 的村舍换当地的样子：${t.localKind('hamlet', c)}、${t.localKind('hamletB', c)}`);
      check(['pine', 'dot', 'jia', 'grove', 'willow'].every((b) => t.localKind(b, c) === b), `${c} 的林木照原样`);
    }
    check(['market', 'port', 'temple', 'church'].every((b) => t.localKind(b, null) === b && t.localKind(b, '') === b), '没给地域（中原）照原样');
    check(t.LANDMARK_MODEL.church === 'church' && t.localKind('church', 'west') !== 'church' && t.localKind('church', 'japan') === 'church', '教堂：西洋据点画西式的，别处照中原画殿');
    check(t.localKind('temple', 'west') === 'temple' && t.localKind('shrine', 'west') === 'shrine', '西洋据点的寺、祠庙照中原（华人的庙）');
    let threw = false;
    try { t.townModel('没有这样'); } catch (e) { threw = /没有这样的城郭模型/.test(e.message); }
    check(threw, '要一样没有的模型就报错，不悄悄画空');

    // 治所画哪一样（seatKind，舆图按它摆）：中原四档、京城、残城、帐、寨照旧；日本、朝鲜、大越、南洋、西洋据点照当地，残破的画那里的残城
    const CITY_KIND = ['town', 'city', 'grand', 'metro'];
    const city = (tier, culture = null, ruined = false) => ({ style: 'city', culture, tier, ruined });
    check(t.seatKind(null, 2, 0) === 'capital' && t.seatKind(null, 1, 1) === 'city1' && t.seatKind(null, 0, 0) === 'town0', '没给分档：京城、要府画府城、其余小城');
    for (let tier = 0; tier < 4; tier++) for (const v of [0, 1]) check(t.seatKind(city(tier), 0, v) === `${CITY_KIND[tier]}${v}`, `中原第 ${tier} 档 → ${CITY_KIND[tier]}${v}`);
    check(t.seatKind(city(2), 2, 0) === 'capital' && t.seatKind(city(1), 2, 1) === 'city1', '京城：大府以上画京城，小国的都城照它自己的档');
    check(t.seatKind(city(2, null, true), 0, 0) === 'ruin' && t.seatKind(city(3, null, true), 1, 1) === 'ruin', '中原残破的画残城');
    check(t.seatKind({ style: 'nomad', tier: 1 }, 0, 0) === 'yurtL' && t.seatKind({ style: 'tribal', tier: 0 }, 0, 0) === 'stockS', '牧地画帐、山寨之地画寨');
    check(t.seatKind({ style: 'tribal', culture: 'japan', tier: 1 }, 0, 0) === 'stockL', '地域只认城郭：山寨之地照画寨');
    for (const c of Object.values(s.CULTURE)) {
      const pre = east.EAST_KIND[c] || south.SOUTH_KIND[c];
      for (let tier = 0; tier < 4; tier++) check(t.seatKind(city(tier, c), 1, 1) === `${pre}${tier}1`, `${c} 第 ${tier} 档 → ${pre}${tier}1`);
      check(t.seatKind(city(2, c), 2, 0) === `${pre}Cap` && t.seatKind(city(1, c), 2, 0) === `${pre}10`, `${c} 的都城：大府以上画都城，小国的照它自己的档`);
      check(t.seatKind(city(1, c, true), 0, 0) === `${pre}Ruin` && t.seatKind(city(3, c, true), 1, 1) === `${pre}Ruin`, `${c} 残破的画那里的残城 ${pre}Ruin`);
      for (const st of [city(0, c), city(3, c), city(2, c, true)]) for (const k of [0, 1, 2]) check(t.TOWN_KINDS.includes(t.seatKind(st, k, 0)), `${c} 给的模型都有：${t.seatKind(st, k, 0)}`);
    }
    // 聚落等第算出来的：日本的令制国凋敝到底 → 落城
    const jpRuined = s.settlementOf({ prosperity: 5, commerce: 1e5, mouths: 1e5, kind: '令制国', dejure: '日本', regionType: 'foreign_shogunate', year: 1621 });
    check(jpRuined.culture === 'japan' && jpRuined.ruined && t.seatKind(jpRuined, 0, 0) === 'jpRuin', `日本的府州残破了画落城：${JSON.stringify({ culture: jpRuined.culture, ruined: jpRuined.ruined })}`);

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
    check(sc.stats.kinds.pine === 100 && sc.stats.kinds.hamlet === 20 && !('不认得' in sc.stats.kinds), `各样几处照收下的数：${JSON.stringify(sc.stats.kinds)}`);
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

    // 林木、村舍小图换立体也按舆图的钟换（SCATTER_PX 两道门槛、LOD_FADE 秒）：换的那一会儿立体以几成画，小图那层（aOut）按同一个数淡出；
    // 镜头停下来每处只是小图或只是立体，不停在半透明、半抖点；两道门槛之间照上一帧；镜头停着一处不算、不重传，之后接着照记着的换；
    // 出了镜头、一下拉远的，小图全显；拍一张（不给钟）按门槛正中直接取，不动活舆图记着的；换过一批都重取
    const [Q0, Q1] = t.SCATTER_PX, SF = t.LOD_FADE, QM = (Q0 + Q1) / 2;
    const sv = t.createScatter(shared, { pine: 0.8 });
    const aOut = new THREE.BufferAttribute(new Uint8Array(3), 1, true);
    sv.set([{ kind: 'pine', x: 500, z: 500, h: 0.05, yaw: 0, size: 1.5, si: 0 }, { kind: 'pine', x: 2500, z: 500, h: 0.05, yaw: 0, size: 1.5, si: 2 }], aOut);
    const pineMesh = sv.group.children[0], sFade = pineMesh.geometry.getAttribute('aFade');
    const aimAt = (px) => {
      const d = 1.5 * shared.uPx.value / px;
      cam.position.set(500, 1 + d * Math.cos(0.8), 500 + d * Math.sin(0.8));
      cam.lookAt(500, 1, 500);
    };
    const step = (px, now) => {
      aimAt(px);
      sv.update(cam, now);
      const n = pineMesh.geometry.instanceCount;
      return { n, t: n ? sFade.array[1] : 0, out: aOut.array[0] / 255, fading: sv.stats.fading };
    };
    const said = (r) => `立体 ${r.n} 成数 ${r.t.toFixed(3)} 小图淡出 ${r.out.toFixed(3)} 正换着 ${r.fading}`;
    let q = step(30, 10);
    check(q.n === 1 && q.t === 1 && q.out === 1 && q.fading === 0, `头一帧大过门槛：直接画立体、小图淡尽（${said(q)}）`);
    q = step(QM, 10.016);
    check(q.n === 1 && q.t === 1 && q.out === 1, `退到两道门槛之间：仍画立体（${said(q)}）`);
    q = step(Q0 - 2, 10.032);
    check(q.n === 1 && q.t === 1, `刚窄过 ${Q0} 像素：这一帧起换（${said(q)}）`);
    let sv0 = sFade.version, ov0 = aOut.version;
    aOut.clearUpdateRanges();
    q = step(Q0 - 2, 10.032 + SF / 2);
    check(q.n === 1 && Math.abs(q.t - 0.5) < 0.01 && Math.abs(q.out - 0.5) < 0.01 && q.fading === 1, `换到一半：立体画五成、小图显五成（${said(q)}）`);
    check(sFade.version > sv0 && aOut.version > ov0 && aOut.updateRanges.length === 1 && aOut.updateRanges[0].start === 0 && aOut.updateRanges[0].count === 1,
      `换着的那一会儿：立体的成数、小图那层都重传（小图只传改了的那一个：${JSON.stringify(aOut.updateRanges)}）`);
    sv0 = sFade.version; ov0 = aOut.version;
    step(Q0 - 2, 10.032 + SF / 2);
    check(sFade.version === sv0 && aOut.version === ov0, '镜头不动、钟也没走：不重传');
    q = step(30, 10.032 + SF * 2 / 3);
    check(q.n === 1 && Math.abs(q.t - 1 / 3) < 0.01 && Math.abs(q.out - 1 / 3) < 0.01, `正换着又拉近：从换到的三成三往回走，不跳（${said(q)}）`);
    q = step(30, 10.032 + SF * 2 / 3 + SF + 0.01);
    check(q.n === 1 && q.t === 1 && q.out === 1 && q.fading === 0, `换回去了：只画立体、小图淡尽（${said(q)}）`);
    // 停在各样远近：停下来过了 LOD_FADE 秒，只是立体（小图淡尽）或只是小图（全显）
    let tq = 20;
    const rested = [];
    for (const px of [30, 23, QM, Q0 + 0.5, 17, 15, 12, 15, 17, Q0 + 0.5, QM, Q1 - 0.5, 23, 30]) {
      step(px, tq);
      q = step(px, tq + SF + 0.01);
      rested.push(`${px}:${q.n}`);
      tq += 1;
      check(q.fading === 0 && ((q.n === 1 && q.t === 1 && q.out === 1) || (q.n === 0 && q.out === 0)), `停在 ${px} 像素：只是立体或只是小图（${said(q)}）`);
    }
    check(rested[2] === `${QM}:1` && rested[3] === `${Q0 + 0.5}:1` && rested[4] === '17:0' && rested[9] === `${Q0 + 0.5}:0` && rested[10] === `${QM}:0` && rested[12] === '23:1',
      `近了画立体、远了画小图，两道门槛之间照上一回：${rested.join(' ')}`);
    // 镜头停着、没有正换着的：一处不算、不重传；停过几帧再挪，仍照记着的（不当成刚进镜头按门槛正中取）
    step(QM, tq);
    sv0 = sFade.version; ov0 = aOut.version;
    for (let i = 1; i <= 4; i++) step(QM, tq + i * 0.016);
    check(sv.stats.checked === 0 && sFade.version === sv0 && aOut.version === ov0, `镜头停着：一处不算（${sv.stats.checked}）、不重传`);
    q = step(Q0 + 0.5, tq + 0.2);
    check(sv.stats.checked > 0 && q.n === 1 && q.t === 1, `停过几帧再挪到 ${Q0 + 0.5} 像素：仍画立体（${said(q)}）`);
    // 镜头转开：立体不画、小图全显；转回来在两道门槛之间，按门槛正中直接取
    cam.position.set(3000, 60, 3000);
    cam.lookAt(3100, 0, 3100);
    sv.update(cam, tq + 0.3);
    check(pineMesh.geometry.instanceCount === 0 && aOut.array[0] === 0 && sv.stats.out === 0, '镜头转开：立体不画，小图全显');
    q = step(Q0 + 0.5, tq + 0.4);
    check(q.n === 0 && q.out === 0 && q.fading === 0, `再转回来、在两道门槛之间：直接是小图（${said(q)}）`);
    // 一下拉得很远（那一块最近处也窄过门槛八成，整块不算）：直接换回小图
    step(30, tq + 1);
    step(30, tq + 1 + SF + 0.01);
    q = step(8, tq + 2);
    check(q.n === 0 && q.out === 0, `一下拉到 8 像素：直接换回小图（${said(q)}）`);
    // 拍一张（不给钟）：照门槛正中取；拍完回到活舆图仍照记着的画
    q = step(Q0 + 0.5, tq + 3);
    aimAt(30);
    sv.update(cam);
    check(pineMesh.geometry.instanceCount === 1 && aOut.array[0] === 255 && sv.stats.fading === 0, '拍一张：大过门槛正中直接画立体，小图淡尽');
    q = step(Q0 + 0.5, tq + 3.016);
    check(q.n === 0 && q.out === 0 && q.fading === 0, `拍完回到活舆图：仍是小图，没有换（${said(q)}）`);
    check(aOut.array[2] === 0, '镜头里从没有过的那处：小图一直全显');
    // 换过一批：小图那层先全显，头一帧都按门槛正中取
    step(30, tq + 4);
    q = step(30, tq + 4 + SF / 2);
    check(q.out > 0.4 && q.out < 0.6, `换过一批之前正换着（${said(q)}）`);
    sv.set([{ kind: 'pine', x: 500, z: 500, h: 0.05, yaw: 0, size: 1.5, si: 0 }], aOut);
    check(aOut.array[0] === 0, '换过一批：小图那层先全显');
    q = step(Q0 + 0.5, tq + 4.016);
    check(q.n === 0 && q.out === 0 && q.fading === 0, `换过一批：头一帧按门槛正中取（${said(q)}）`);
    sv.dispose();

    // 城郭近看、远看两份按舆图的钟换：过了门槛才换，换的那一会儿（LOD_FADE 秒）两份都画，近看那份的成数由 1 走到 0（或反过来）；
    // 显出、收掉也一样按钟淡入淡出。镜头停下来每座城只画一份、全显，没有停在半抖点的；两道门槛之间照上一帧；
    // 正换着又折回去，成数接着往回走，不跳；刚进镜头的按门槛正中直接取，不交替；拍一张的（不给钟）也直接取，且不动活舆图记着的
    const [S0, S1] = [11, 18];
    const towns = t.createTowns({ ...shared, uFadePx: { value: new THREE.Vector2(S0, S1) } });
    const md0 = t.townModel('town0'), [P0, P1] = t.LOD_PX, FADE = t.LOD_FADE;
    // 市镇摆得远远的，镜头里只有那座城（正换着的几座只算它）
    towns.set([{ kind: 'town0', x: 500, z: 500, h: 0.05, yaw: 0, scale: 0.85 }, { kind: 'market', x: 1500, z: 500, h: 0.05, yaw: 0, scale: 0.85 }]);
    const [nearMesh, farMesh] = [1, 2].map((mode) => towns.group.children.find((m) => m.material.uniforms.uPart.value === mode));
    check(!!nearMesh && !!farMesh && towns.group.children.some((m) => m.material.uniforms.uPart.value === 0), '有远看那份的城一近一远两层，市镇只一层');
    const aim = (px) => {
      const d = 2 * md0.hw * 0.85 * shared.uPx.value / px;
      cam.position.set(500, 1 + d * Math.cos(0.8), 500 + d * Math.sin(0.8));
      cam.lookAt(500, 1, 500);
    };
    const frameAt = (px, now) => {
      aim(px);
      towns.update(cam, now);
      const n = nearMesh.geometry.instanceCount, f = farMesh.geometry.instanceCount;
      const a = n ? nearMesh.geometry.getAttribute('aFade').array : f ? farMesh.geometry.getAttribute('aFade').array : [NaN, NaN];
      return { n, f, lod: a[0], vis: a[1], fading: towns.stats.fading };
    };
    const show = (r) => `近 ${r.n} 远 ${r.f} 成数 ${Number.isNaN(r.lod) ? '-' : r.lod.toFixed(3)} 显 ${Number.isNaN(r.vis) ? '-' : r.vis.toFixed(3)} 正换着 ${r.fading}`;
    let r = frameAt(80, 10);
    check(r.n === 1 && r.f === 0 && r.lod === 1 && r.vis === 1 && r.fading === 0, `头一帧大过门槛：只画近看那份、全显（${show(r)}）`);
    r = frameAt((P0 + P1) / 2, 10.016);
    check(r.n === 1 && r.f === 0 && r.fading === 0, `退到两道门槛之间：仍画近看那份（${show(r)}）`);
    r = frameAt(P0 - 6, 10.032);
    check(r.n === 1 && r.f === 0, `刚窄过 ${P0} 像素：这一帧起换（${show(r)}）`);
    const fadeAttr = nearMesh.geometry.getAttribute('aFade');
    let v0 = fadeAttr.version;
    r = frameAt(P0 - 6, 10.032 + FADE / 2);
    check(r.n === 1 && r.f === 1 && Math.abs(r.lod - 0.5) < 0.01 && r.fading === 1, `换到一半：两份都画，近看那份占五成（${show(r)}）`);
    check(fadeAttr.version > v0, '换着的那一会儿：成数变了就重传');
    v0 = fadeAttr.version;
    r = frameAt(P0 - 6, 10.032 + FADE / 2);
    check(fadeAttr.version === v0, '镜头不动、钟也没走：不重传');
    r = frameAt(80, 10.032 + FADE * 2 / 3);
    check(r.n === 1 && r.f === 1 && Math.abs(r.lod - 1 / 3) < 0.01, `正换着又拉近：从换到的三成三往回走，不跳（${show(r)}）`);
    r = frameAt(80, 10.032 + FADE * 2 / 3 + FADE + 0.01);
    check(r.n === 1 && r.f === 0 && r.lod === 1 && r.fading === 0, `换回去了：只画近看那份（${show(r)}）`);
    // 镜头停在各样远近（换份那一段、显出那一段也在内），停下来过了 LOD_FADE 秒：显着的只画一份、全显，收着的一份不画
    let now = 20;
    const rest = [];
    for (const px of [30, 40, 48, P0 + 1, (P0 + P1) / 2, P1 - 1, 62, 66, 90, 62, P1 - 1, P0 + 1, 48, 30, 20, (S0 + S1) / 2, S0 + 0.5, 8, S0 + 0.5, (S0 + S1) / 2, 20]) {
      frameAt(px, now);
      r = frameAt(px, now + FADE + 0.01);
      rest.push(`${px}:${r.n}${r.f}`);
      now += 1;
      check(r.fading === 0 && (r.n + r.f === 0 || (r.n + r.f === 1 && r.vis === 1)), `停在 ${px} 像素：只画一份、全显，或一份不画（${show(r)}）`);
    }
    check(rest[6] === '62:10' && rest[13] === '30:01' && rest[17] === '8:00' && rest[16] === `${S0 + 0.5}:01` && rest[18] === `${S0 + 0.5}:00` && rest[20] === '20:01',
      `大了画近看那份、小了画远看那份，再小收掉；显出、收掉的门槛之间照上一回：${rest.join(' ')}`);
    // 收掉、显出都按钟淡：窄过收掉的门槛，这一帧起淡出，一半时显五成；宽过显出的门槛再淡入
    r = frameAt(5, now);
    check(r.f === 1 && r.vis === 1, `刚窄过 ${S0} 像素：这一帧起淡出（${show(r)}）`);
    r = frameAt(5, now + FADE / 2);
    check(r.f === 1 && Math.abs(r.vis - 0.5) < 0.01 && r.fading === 1, `淡出一半：显五成（${show(r)}）`);
    r = frameAt(5, now + FADE + 0.01);
    check(r.n === 0 && r.f === 0 && r.fading === 0, `淡完：一份也不画（${show(r)}）`);
    r = frameAt(30, now + FADE + 0.02);
    r = frameAt(30, now + FADE + 0.02 + FADE / 2);
    check(r.f === 1 && Math.abs(r.vis - 0.5) < 0.01 && r.fading === 1, `再拉近宽过 ${S1} 像素：淡入一半显五成（${show(r)}）`);
    now += 5;
    // 镜头转开（城不在镜头里，不记它），再转回换份那一段：按门槛正中直接取，不交替
    cam.position.set(2000, 60, 2000);
    cam.lookAt(2100, 0, 2100);
    towns.update(cam, now);
    check(nearMesh.geometry.instanceCount + farMesh.geometry.instanceCount === 0, '镜头转开：这座城不画');
    r = frameAt(P0 - 4, now + 0.016);
    check(r.n === 0 && r.f === 1 && r.lod === 0 && r.vis === 1 && r.fading === 0, `再转回来：直接画远看那份、全显（${show(r)}）`);
    // 拍一张（不给钟）：照门槛正中取；之后活舆图接着照它记着的画，不因这一张换份
    aim(80);
    towns.update(cam);
    check(nearMesh.geometry.instanceCount === 1 && farMesh.geometry.instanceCount === 0 && towns.stats.fading === 0, '拍一张：大过门槛直接画近看那份');
    aim(S0 + 0.5);
    towns.update(cam);
    check(nearMesh.geometry.instanceCount + farMesh.geometry.instanceCount === 0, `拍一张：窄过显出那两道门槛正中（${(S0 + S1) / 2} 像素）就不画`);
    r = frameAt(P0 - 4, now + 0.032);
    check(r.n === 0 && r.f === 1 && r.vis === 1 && r.fading === 0, `拍完回到活舆图：仍是远看那份、全显，没有换份（${show(r)}）`);
    // 换过一批城：都按门槛正中重取
    towns.set([{ kind: 'town0', x: 500, z: 500, h: 0.05, yaw: 0, scale: 0.85 }]);
    r = frameAt(P1 - 1, now + 0.048);
    check(r.n === 1 && r.f === 0 && r.fading === 0, `换过一批城：头一帧按门槛正中取（${show(r)}）`);
    towns.dispose();

    // 治所挨得太近的让开（fitSeats）：京城、要府、城郭先于寨帐、大的先摆，先摆的不动；后摆的先在原处缩，
    // 还叠着就在本府州里挪（free 说行才挪），挪不开再在原处缩，不小过 FIT.min；摆完彼此不叠
    const FIT = t.FIT;
    const rectOf = (s, a) => [a.x - s.hw * a.f, a.y - s.depth * a.f, a.x + s.hw * a.f, a.y];
    // 叠着（或贴得不到一成五个单位，看着就连成一片）的有几对（不画的不算）
    const overlaps = (seats, at) => {
      let n = 0;
      for (let a = 0; a < seats.length; a++) {
        for (let b = a + 1; b < seats.length; b++) {
          if (!at[a].f || !at[b].f) continue;
          const p = rectOf(seats[a], at[a]), q = rectOf(seats[b], at[b]);
          if (Math.max(q[0] - p[2], p[0] - q[2], q[1] - p[3], p[1] - q[3]) < 0.15) n++;
        }
      }
      return n;
    };
    const apart = [{ x: 0, y: 0, hw: 1, depth: 2, rank: 1 }, { x: 10, y: 0, hw: 1, depth: 2, rank: 1 }];
    check(t.fitSeats(apart, () => true).every((a, j) => a.f === 1 && a.x === apart[j].x && a.y === apart[j].y), '隔得开的照原样摆');
    const pair = [{ x: 0, y: 0, hw: 1.2, depth: 2.4, rank: 4 }, { x: 2.3, y: 0, hw: 1.2, depth: 2.4, rank: 1 }];
    for (const seats of [pair, [pair[1], pair[0]]]) {
      const at = t.fitSeats(seats, () => true), cap = seats.indexOf(pair[0]), other = 1 - cap;
      check(at[cap].f === 1 && at[cap].x === 0 && at[other].f < 1 && at[other].f >= FIT.shrink && at[other].x === 2.3 && overlaps(seats, at) === 0,
        `京城不动，挨着的那座在原处缩到 ${at[other].f} 就放得下（京城排第 ${cap + 1}）`);
    }
    const close = [{ x: 0, y: 0, hw: 1.4, depth: 2.6, rank: 0 }, { x: 0.5, y: 0.3, hw: 1.2, depth: 2.4, rank: 1 }];
    const calls = [];
    const ca = t.fitSeats(close, (j, x, y, f) => { calls.push([j, f]); return true; });
    const moved = Math.hypot(ca[0].x - close[0].x, ca[0].y - close[0].y);
    check(ca[1].f === 1 && ca[1].x === 0.5 && ca[1].y === 0.3 && moved > 0 && moved <= FIT.reach + 1e-9 && ca[0].f === FIT.move && overlaps(close, ca) === 0,
      `城郭先摆不动（寨子虽大），寨子挪开 ${moved.toFixed(2)}、缩到 ${ca[0].f}`);
    check(calls.length > 0 && calls.every(([j, f]) => j === 0 && f === FIT.move), '问挪处行不行时给的是寨子那座、挪时的比例');
    // 挪不开：寻常的（这里是寨子）就不画（f 为 0）；要府照旧在原处缩到最小
    for (const free of [() => false, null]) {
      const at = t.fitSeats(close, free);
      check(at[1].f === 1 && at[0].x === 0 && at[0].y === 0 && at[0].f === 0, `挪不开（${free ? '不许挪' : '没给挪处'}）：寻常的不画（${at[0].f}）`);
      const big = [{ ...close[0], rank: FIT.keep }, { ...close[1], rank: FIT.keep + 1 }], bt = t.fitSeats(big, free);
      check(bt[1].f === 1 && bt[0].x === 0 && bt[0].y === 0 && bt[0].f === FIT.min, `挪不开（${free ? '不许挪' : '没给挪处'}）：要府在原处缩到 ${bt[0].f}`);
    }
    // 不画的不占地：后摆的照原样摆，不为它缩（它若缩到最小摆着，后摆这座就得缩）
    const skip = [{ x: 0, y: 0, hw: 1.2, depth: 2.4, rank: 3 }, { x: 0.5, y: 0.3, hw: 1.4, depth: 2.6, rank: 1 }, { x: 0.5, y: 0.9, hw: 0.3, depth: 0.5, rank: 0 }];
    const sk = t.fitSeats(skip, () => false);
    check(sk[0].f === 1 && sk[1].f === 0 && sk[2].f === 1 && sk[2].x === 0.5 && sk[2].y === 0.9, `摆不下的不画、也不挡后摆的：${sk.map((a) => a.f).join(' ')}`);
    check(t.fitSeats([skip[0], { ...skip[1], rank: FIT.keep }, skip[2]], () => false)[2].f < 1, '那座若是要府、缩到最小摆着，后摆这座就得缩（上一项不是白测）');
    const ranked = [{ x: 0, y: 0, hw: 1.2, depth: 2.4, rank: 1 }, { x: 0.6, y: 0, hw: 1, depth: 2, rank: 3 }];
    const ra = t.fitSeats(ranked, () => true);
    check(ra[1].f === 1 && ra[1].x === 0.6 && (ra[0].f < 1 || ra[0].x !== 0 || ra[0].y !== 0), '要府先摆不动，寻常的让开');
    // 镇江、扬州那样：先摆的大城往北伸过了后摆那座的治所，后摆的又挪不出那么远（只许挪两个半单位）——先摆的一并缩到八成（不挪），后摆的往北挪开；
    // 离得近却不挡着的那座缩过又还原；先摆的若是京城就不缩，后摆的只好缩到最小叠着
    const zy = [{ x: 0, y: 3.8, hw: 2.8, depth: 7.4, rank: 3 }, { x: -0.4, y: 0, hw: 2.76, depth: 7.4, rank: 3 }, { x: 8, y: 0, hw: 2.78, depth: 2, rank: 3 }];
    const within = (seats, d) => (j, x, y) => Math.hypot(x - seats[j].x, y - seats[j].y) <= d + 1e-9;
    const za = t.fitSeats(zy, within(zy, 2.5));
    const zMoved = Math.hypot(za[1].x - zy[1].x, za[1].y - zy[1].y);
    check(za[0].f === 0.8 && za[0].x === 0 && za[0].y === 3.8 && za[1].f === 0.8 && za[1].y < zy[1].y && zMoved <= 2.5 + 1e-9 && za[2].f === 1 && overlaps(zy, za) === 0,
      `先摆的缩到 ${za[0].f} 不挪、后摆的缩到 ${za[1].f} 往北挪 ${zMoved.toFixed(2)}、不挡着的那座还原成 ${za[2].f}，摆完不叠`);
    const zc = zy.map((s, j) => (j === 0 ? { ...s, rank: 4 } : s)), zca = t.fitSeats(zc, within(zc, 2.5));
    check(zca[0].f === 1 && zca[1].f === FIT.min && zca[1].x === zc[1].x && zca[1].y === zc[1].y, `先摆的是京城：京城不缩，后摆的缩到 ${zca[1].f} 摆在原处`);
    const far = t.fitSeats(zy, within(zy, 9));
    check(far[0].f === 1 && far[1].f === FIT.move && far[1].y <= zy[0].y - zy[0].depth - FIT.gap + 1e-9 && overlaps(zy, far) === 0,
      `挪得远（大城挪的远近随城大小放宽）：先摆的不缩，后摆的往北挪过它的北沿（${far[1].y.toFixed(2)}）`);
    // 台湾大员一带那样：三城三社相去一两个单位，摆完一处不叠；挪处只许在附近（像本府州那样有边）
    const tw = [[0, 0, 1.19, 2.4, 1], [-0.4, -1.2, 1.19, 2.4, 1], [1.6, 0.2, 1.19, 2.4, 1], [2.6, -0.8, 1.38, 2.7, 0], [1.8, -2.4, 1.38, 2.7, 0], [1.2, -3.6, 1.38, 2.7, 0]]
      .map(([x, y, hw, depth, rank]) => ({ x, y, hw, depth, rank }));
    const twAt = t.fitSeats(tw, (j, x, y) => Math.abs(x - 1) < 6 && Math.abs(y + 1.5) < 6);
    check(overlaps(tw, twAt) === 0 && twAt.every((a, j) => a.f >= FIT.min && Math.hypot(a.x - tw[j].x, a.y - tw[j].y) <= FIT.reach + 1e-9),
      `三城三社挤在一处：摆完不叠（${twAt.map((a) => `${a.f}@${a.x.toFixed(1)},${a.y.toFixed(1)}`).join(' ')}）`);
    check(overlaps(tw, tw.map((s) => ({ x: s.x, y: s.y, f: 1 }))) > 0, '照原样摆是叠着的（上一项不是白测）');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`[smoke-newui-towns3d] PASS ${passed} 项`);
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
