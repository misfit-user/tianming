// 晚唐剧本·外藩人口重分（阶段三第六刀之四）
//
// 外藩各块人口原是按比例切的（契丹三块各 116667、南诏十二块各 91803），日本七十三国全是壹岐 5057 口的整倍或半倍。
// 同志 09-26 定：每家势力合计不动，家内重分；有史料的按史料，无史料的块间按面积与地形估。权重与依据在 data/tang-foreign-population.js：
//   - 日本按《和名抄》各国乡数（陆奥、出羽、大隅按郡落块分乡；平安京所在山城国与乡数未列的德丹城保持原值）；
//   - 新罗按景德王十六年各州郡县数，渤海按《新唐书》各府领州数，瞿折罗按《大唐西域记》各国周长；
//   - 吐蕃占据的河陇河西诸州直接取天宝口（原账约为天宝的 2.5 倍，兰州 7 倍、维州 12 倍），多出的归本部与青海诸地按面积估；
//   - 原账写了京户的都城保持原值，南诏王都取原账王城口数；
//   - 其余按地块面积乘地形系数（平原 1、丘陵 0.6、林地 0.3、草原山地 0.25、荒漠 0.03）估，碛地按荒漠，南诏王畿诸睑乘稠密系数。
// 随人口走的户口账、田亩、商贸额、府库、城市人口、地方开支与吏员按同一倍数重分，开局账用财政引擎重算（tang-redistribute.js）。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-foreign-population.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const P = require(path.join(DIR, 'data/tang-foreign-population.js'));
const { ECON_FIELDS, apportion, assertLedgersAreEnginePreview, ledgerIndex, redistributeGroup, refreshLedgers } = require(path.join(DIR, 'patches/tang-redistribute.js'));
const lib = require(path.join(DIR, 'patches/tang-foreign-lib.js'));
const WAMYOSHO_GO = require(path.join(DIR, 'sources/wamyosho-go.json'));
const XINTANGSHU = require(path.join(DIR, 'sources/xintangshu-dili-37-43.json'));

const TANG = /^唐/;

function foreignTrees(scenario) {
  return Object.keys(scenario.adminHierarchy).filter((k) => k !== 'player' && !TANG.test(k));
}

function leavesOf(scenario, key) {
  return scenario.adminHierarchy[key].divisions.reduce((out, c) => out.concat(c.children || []), []);
}

// 地块面积（平方公里）：地图是等距圆柱投影，像素面积按所在纬度折算
function areaKm2(scenario, region) {
  const proj = scenario.map.projection;
  const scale = proj.scale || proj.scaleX;
  const latMax = proj.bbox[3];
  const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
  const polys = region.geometry.type === 'MultiPolygon' ? region.geometry.coordinates : [region.geometry.coordinates];
  return polys.reduce((sum, rings) => {
    const ys = rings[0].map((p) => p[1]);
    const lat = latMax - ((Math.min(...ys) + Math.max(...ys)) / 2 - proj.offset[1]) / scale;
    const pixels = ringArea(rings[0]) - rings.slice(1).reduce((x, h) => x + ringArea(h), 0);
    return sum + (pixels / (scale * scale)) * 111.32 * 111.32 * Math.cos((lat * Math.PI) / 180);
  }, 0);
}

// 日本各块的乡数：一国一块的取国的乡数，一国分几块的按郡落块
function japanTownships() {
  const byKuni = new Map(WAMYOSHO_GO.map((r) => [r.name, r]));
  const out = {};
  Object.keys(P.JAPAN_KUNI_LEAVES).forEach((kuni) => {
    const row = byKuni.get(kuni);
    if (!row) throw new Error('和名抄乡数表里没有 ' + kuni);
    const leaves = P.JAPAN_KUNI_LEAVES[kuni];
    if (leaves.length === 1) { out[leaves[0]] = [row.townships, kuni + '乡 ' + row.townships]; return; }
    const split = P.JAPAN_SPLIT[kuni];
    if (!split) throw new Error(kuni + ' 分几块却没有按郡落块的表');
    const counted = new Set();
    Object.keys(split).forEach((leafId) => {
      const n = split[leafId].reduce((s, gun) => {
        if (!(gun in row.districts)) throw new Error(kuni + ' 没有 ' + gun);
        counted.add(gun);
        return s + row.districts[gun];
      }, 0);
      out[leafId] = [n, kuni + split[leafId].length + '郡乡 ' + n];
    });
    const missed = Object.keys(row.districts).filter((g) => !counted.has(g));
    if (missed.length) throw new Error(kuni + ' 有郡未落块：' + missed.join('、'));
  });
  return out;
}

function tianbaoMouths(name) {
  const rows = XINTANGSHU.filter((r) => r.nameS === name && r.mouths);
  if (rows.length !== 1) throw new Error('新唐书地理志里「' + name + '」天宝口应唯一，实得 ' + rows.length);
  return rows[0].mouths;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  const trees = foreignTrees(scenario);
  assertLedgersAreEnginePreview(scenario, trees);

  const regionById = new Map(scenario.map.regions.map((r) => [r.id, r]));
  const japan = japanTownships();
  const sections = [];
  let equalBefore = 0;
  let equalAfter = 0;
  const countEqual = (values) => { const c = {}; values.forEach((v) => { c[v] = (c[v] || 0) + 1; }); return Object.values(c).filter((n) => n >= 3).reduce((a, n) => a + n, 0); };

  trees.forEach((key) => {
    const leaves = leavesOf(scenario, key);
    if (leaves.length < 2) return;
    const spec = P.FACTIONS[key] || { method: '按面积估' };
    const faction = lib.factionByName(scenario, key);
    const old = new Map(leaves.map((l) => [l.id, l.populationDetail.mouths]));
    const total = leaves.reduce((s, l) => s + old.get(l.id), 0);
    leaves.forEach((l) => { if (!(old.get(l.id) > 0)) throw new Error(l.name + ' 原账人口为零，不能按倍数重分'); });
    const target = new Map();
    const basis = new Map();
    Object.keys(spec.fixed || {}).forEach((id) => { if (!old.has(id)) throw new Error(key + ' 没有地块 ' + id); target.set(id, old.get(id)); basis.set(id, spec.fixed[id]); });
    Object.keys(spec.absolute || {}).forEach((id) => { const [n, why] = spec.absolute[id]; target.set(id, n); basis.set(id, why); });
    Object.keys(spec.tianbao || {}).forEach((id) => {
      const [name, share] = spec.tianbao[id];
      const n = Math.round(tianbaoMouths(name) * share);
      target.set(id, n);
      basis.set(id, '天宝口 ' + tianbaoMouths(name) + (share === 1 ? '' : ' × ' + (share === 0.6 ? '3/5' : '1/5') + '（西州五县按县数）'));
    });
    const rest = leaves.filter((l) => !target.has(l.id));
    const weights = rest.map((l) => {
      if (key === '日本') {
        if (!japan[l.id]) throw new Error('日本地块 ' + l.name + ' 没有乡数');
        return japan[l.id];
      }
      if (spec.proportional) return [old.get(l.id), '原账口数 ' + old.get(l.id) + '（按原账比例分余额）'];
      if (spec.weights) {
        if (!spec.weights[l.id]) throw new Error(key + ' 的 ' + l.name + ' 没有权重');
        return spec.weights[l.id];
      }
      const override = P.ESTIMATE_TERRAIN[l.id];
      const terrain = override ? override[0] : (P.ESTIMATE_TERRAIN_BY_TYPE[l.regionType] || l.terrain);
      const factor = P.TERRAIN_FACTOR[terrain];
      if (factor === undefined) throw new Error(l.name + ' 的地形「' + terrain + '」没有系数');
      const density = (spec.density || {})[l.id];
      const area = areaKm2(scenario, regionById.get(l.mapRegionId));
      const w = area * factor * (density ? density[0] : 1);
      const why = '面积 ' + Math.round(area) + ' 平方公里 × ' + terrain + ' ' + factor + (density ? ' × 稠密 ' + density[0] : '') + (override ? '（' + override[1] + '）' : '');
      return [w, why];
    });
    // 同档微调：分档或按原账比例的估法会造出成组相同的数，同一权重的几块按「面积 × 地形系数」的平方根相对同档均值微调，同档合计大体不变
    if (spec.tieBreak) {
      const sizeOf = (l) => {
        const override = P.ESTIMATE_TERRAIN[l.id];
        const terrain = override ? override[0] : (P.ESTIMATE_TERRAIN_BY_TYPE[l.regionType] || l.terrain);
        return Math.sqrt(areaKm2(scenario, regionById.get(l.mapRegionId)) * P.TERRAIN_FACTOR[terrain]);
      };
      const groups = new Map();
      rest.forEach((l, i) => { const key = weights[i][0]; (groups.get(key) || groups.set(key, []).get(key)).push(i); });
      groups.forEach((idx) => {
        if (idx.length < 2) return;
        const sizes = idx.map((i) => sizeOf(rest[i]));
        const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
        idx.forEach((i, j) => { weights[i] = [weights[i][0] * sizes[j] / mean, weights[i][1] + '，同档按面积微调 ×' + (sizes[j] / mean).toFixed(2)]; });
      });
    }
    const remainder = total - [...target.values()].reduce((a, b) => a + b, 0);
    if (remainder <= 0) throw new Error(key + ' 保持原值与定额之后没有余额可分');
    const shares = apportion(remainder, weights.map((w) => w[0]));
    rest.forEach((l, i) => { target.set(l.id, shares[i]); basis.set(l.id, weights[i][1]); });
    leaves.forEach((l) => { if (!(target.get(l.id) > 0)) throw new Error(l.name + ' 重分后人口为零'); });

    equalBefore += countEqual(leaves.map((l) => old.get(l.id)));
    const factors = leaves.map((l) => target.get(l.id) / old.get(l.id));
    const index = ledgerIndex(scenario, [faction.fiscalConfig]);
    redistributeGroup(leaves, factors, index, ECON_FIELDS);
    const after = leaves.map((l) => l.populationDetail.mouths);
    equalAfter += countEqual(after);
    if (after.reduce((a, b) => a + b, 0) !== total) throw new Error(key + ' 重分后合计变了');
    faction.population = total;

    sections.push('### ' + key + '（' + spec.method + '，合计 ' + total + ' 口）\n\n' + (spec.quote ? spec.quote + '\n\n' : '') +
      '| 地块 | 原口 | 新口 | 依据 |\n| --- | --- | --- | --- |\n' +
      leaves.map((l) => '| ' + l.name + ' | ' + old.get(l.id) + ' | ' + l.populationDetail.mouths + ' | ' + basis.get(l.id) + ' |').join('\n'));
  });

  // 开局账按新人口用引擎重算，府州写回地块 data 与 mapData
  refreshLedgers(scenario, trees);

  const report = ['# 晚唐·外藩人口重分报告', '',
    '外藩每家合计不动，家内重分：日本按《和名抄》乡数，新罗按景德王十六年郡县数，渤海按各府领州数，瞿折罗按《大唐西域记》各国周长，吐蕃河陇河西诸州取天宝口；原账写了京户的都城保持原值；其余按地块面积乘地形系数估（可信度 L）。同一势力内三块以上人口相同的，' + equalBefore + '→' + equalAfter + ' 块次。',
    '随人口走的户口账、田亩、商贸额、府库开局存量、城市人口、地方开支与吏员按同一倍数重分；开局账用财政引擎按年预算重算。', '',
    '地形系数（估）：' + Object.keys(P.TERRAIN_FACTOR).map((k) => k + ' ' + P.TERRAIN_FACTOR[k]).join('、') + '；第六刀之一定为碛地的块按荒漠计。', '',
    ...sections.map((s) => s + '\n')];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
