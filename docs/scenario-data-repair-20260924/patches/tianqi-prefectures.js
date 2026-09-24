#!/usr/bin/env node
// 天启剧本·府州地块重写补丁（阶段一）
//
// 把一个省的省级总数按史料权重重新分给下辖府州地块，定性字段按数据模块逐块改写。省总数一律不动。
// 同时改三处副本：行政树叶子（adminHierarchy.player 下）、地图地块的 data、地图地块本身的读数字段；
// mapData 与 map 原本逐字节相同，改完后整份从 map 复制过去。
//
// 用法（在仓库根目录）：
//   node docs/scenario-data-repair-20260924/patches/tianqi-prefectures.js <数据模块> [--write] [--report <文件>]
//   不带 --write 只算不写，报告照出。
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '天启七年·九月（官方）.json');

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
function sum(values) { return values.reduce((a, b) => a + b, 0); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

// 按权重把整数总数分成若干份，最大余数法保证加总恰好等于总数
function splitInteger(total, weights) {
  const w = weights.map((x) => Math.max(0, Number(x) || 0));
  const ws = sum(w);
  if (!ws) return w.map(() => 0);
  const raw = w.map((x) => (total * x) / ws);
  const out = raw.map(Math.floor);
  let rest = Math.round(total - sum(out));
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k][1]] += 1;
  return out;
}

// 小数总数（如 0.2 这类比例量）按权重分，不取整
function splitReal(total, weights) {
  const ws = sum(weights);
  return weights.map((x) => (ws ? (total * x) / ws : 0));
}

// 把一组指数拉到给定的人口加权均值：整体平移，夹在 [lo, hi]，夹住后再补差，迭代几轮
function shiftToMean(values, popWeights, target, lo, hi) {
  let v = values.slice();
  for (let round = 0; round < 8; round++) {
    const mean = sum(v.map((x, i) => x * popWeights[i])) / sum(popWeights);
    const delta = target - mean;
    if (Math.abs(delta) < 0.05) break;
    v = v.map((x) => clamp(x + delta, lo, hi));
  }
  return v;
}

function parsePath(pathText) {
  return String(pathText || '').split(/Z/i).map((ring) => {
    const pts = [];
    const re = /[ML]\s*([-\d.]+)[ ,]([-\d.]+)/g;
    let m;
    while ((m = re.exec(ring))) pts.push([+m[1], +m[2]]);
    return pts;
  }).filter((ring) => ring.length > 2);
}

function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// 用地图自带的经纬参照点拟合投影（经实测为等距圆柱投影，x、y 各自线性）
function fitProjection(refs) {
  function fit(xs, ys) {
    const n = xs.length;
    const mx = sum(xs) / n;
    const my = sum(ys) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const a = sxy / sxx;
    return [a, my - a * mx];
  }
  const usable = refs.filter((r) => Array.isArray(r.lonLat) && Array.isArray(r.xy));
  const [ax, bx] = fit(usable.map((r) => r.lonLat[0]), usable.map((r) => r.xy[0]));
  const [ay, by] = fit(usable.map((r) => r.lonLat[1]), usable.map((r) => r.xy[1]));
  let maxErr = 0;
  usable.forEach((r) => {
    maxErr = Math.max(maxErr, Math.abs(ax * r.lonLat[0] + bx - r.xy[0]), Math.abs(ay * r.lonLat[1] + by - r.xy[1]));
  });
  return { project: (lon, lat) => [ax * lon + bx, ay * lat + by], maxErr };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const modulePath = args.find((a) => !a.startsWith('--'));
  if (!modulePath) {
    console.error('用法：node tianqi-prefectures.js <数据模块> [--write] [--report <文件>]');
    process.exit(2);
  }
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;
  const data = require(path.resolve(modulePath));

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  if (JSON.stringify(scenario.map) !== JSON.stringify(scenario.mapData)) throw new Error('map 与 mapData 已不一致，先查清再改');

  const province = scenario.adminHierarchy.player.divisions.find((d) => d.name === data.province);
  if (!province) throw new Error('行政树里找不到 ' + data.province);
  const regions = scenario.map.regions;
  const regionById = new Map(regions.map((r) => [r.id, r]));
  // 数据模块的 BLOCKS 可以按地图 id 写，也可以按省下叶子的名字写；统一换成地图 id
  const leafByName = new Map(province.children.map((leaf) => [leaf.name, leaf]));
  const normalizedBlocks = {};
  Object.entries(data.BLOCKS).forEach(([key, b]) => {
    const id = regionById.has(key) ? key : (leafByName.has(key) ? leafByName.get(key).mapRegionId : null);
    if (!id) throw new Error('数据模块的地块对不上地图或省下叶子：' + key);
    normalizedBlocks[id] = b;
  });
  data.BLOCKS = normalizedBlocks;
  const blockIds = Object.keys(data.BLOCKS);
  const leafByRegion = new Map();
  province.children.forEach((leaf) => leafByRegion.set(leaf.mapRegionId, leaf));
  blockIds.forEach((id) => {
    if (!regionById.has(id)) throw new Error('地图上没有 ' + id);
    if (!leafByRegion.has(id)) throw new Error('行政树叶子没有绑定 ' + id);
  });
  if (province.children.length !== blockIds.length) throw new Error('省下叶子数 ' + province.children.length + ' 与数据模块块数 ' + blockIds.length + ' 不符');

  // ---- 县治落块 ----
  // 有同名地块的府州，所辖县一律归本府地块（地图边界是概化的，不让边境县把数字带到邻府）；
  // 地图上没有自己地块的府州（如庐州、滁州），按县治坐标落到所在地块。
  const projection = fitProjection(scenario.map.geographicReferences || []);
  if (projection.maxErr > 0.5) throw new Error('经纬投影拟合误差过大：' + projection.maxErr);
  const blockRings = blockIds.map((id) => ({ id, rings: parsePath(regionById.get(id).path || regionById.get(id).d) }));
  const blockCenter = new Map(blockIds.map((id) => [id, regionById.get(id).center || regionById.get(id).centroid]));
  const blockByUnitName = new Map(blockIds.map((id) => [data.BLOCKS[id].name, id]));
  // 数据模块可以用地块 id 或地块名指定某府州归哪块
  function resolveBlock(ref) {
    if (data.BLOCKS[ref]) return ref;
    if (blockByUnitName.has(ref)) return blockByUnitName.get(ref);
    throw new Error('数据模块指定的地块不存在：' + ref);
  }
  const assignments = [];
  data.UNITS.forEach((unit) => {
    const growth = unit.wanliMouths ? Math.sqrt(unit.wanliMouths / unit.mouths) : 1;
    unit.growth = growth;
    // 四项权重：数据模块直接给出（没有分府户口的省份），或由洪武户口、税粮、田亩与增长系数算出
    const weights = unit.weights || {
      pop: unit.mouths * growth,
      households: unit.households * growth,
      grain: unit.grain,
      land: unit.land
    };
    unit.weightsUsed = weights;
    const homeBlock = unit.block ? resolveBlock(unit.block) : blockByUnitName.get(unit.name);
    const counties = unit.counties && unit.counties.length ? unit.counties : [[unit.name, null, null]];
    if (!homeBlock && counties.some(([, lon]) => lon == null)) throw new Error(unit.name + ' 没有同名地块，也没有县治坐标');
    const n = counties.length;
    counties.forEach(([county, lon, lat]) => {
      const pt = homeBlock ? null : projection.project(lon, lat);
      let hit = homeBlock ? { id: homeBlock } : blockRings.find((b) => b.rings.some((ring) => pointInRing(pt, ring)));
      let method = homeBlock ? '归本府地块' : '县治落在块内';
      if (!hit) {
        // 县治落在本省各块之外（地图边界是概化的），归最近的本省地块
        let best = null;
        blockIds.forEach((id) => {
          const c = blockCenter.get(id);
          const d = Math.hypot(c[0] - pt[0], c[1] - pt[1]);
          if (!best || d < best.d) best = { id, d };
        });
        hit = { id: best.id };
        method = '县治在本省各块之外，归最近地块';
      }
      assignments.push({
        unit: unit.name, county, block: hit.id, method,
        pop: weights.pop / n,
        households: weights.households / n,
        grain: weights.grain / n,
        land: weights.land / n,
        // 驿站按所辖县数加权：数据模块给了 countyCount（没有县治坐标的省份）就按它，否则每县计一
        countyShare: unit.countyCount != null ? unit.countyCount / n : 1
      });
    });
  });

  // ---- 地块权重 ----
  const W = {};
  blockIds.forEach((id) => { W[id] = { pop: 0, households: 0, grain: 0, land: 0, counties: 0 }; });
  assignments.forEach((a) => {
    const w = W[a.block];
    w.pop += a.pop; w.households += a.households; w.grain += a.grain; w.land += a.land; w.counties += a.countyShare;
  });
  blockIds.forEach((id) => { if (!W[id].counties) throw new Error(data.BLOCKS[id].name + ' 没有落到任何县，检查坐标'); });

  // ---- 分配 ----
  const P = province;
  const pd = P.populationDetail;
  const B = blockIds.map((id) => data.BLOCKS[id]);
  const col = (key) => blockIds.map((id) => W[id][key]);

  const mouths = splitInteger(pd.mouths, col('pop'));
  const households = splitInteger(pd.households, col('households'));
  const ding = splitInteger(pd.ding, mouths);
  const fugitives = splitInteger(pd.fugitives, mouths.map((m, i) => m * B[i].flee));
  const hidden = splitInteger(pd.hiddenCount, mouths.map((m, i) => m * B[i].hide));

  // 省里缺哪一项结构（个别都司、宣慰司没有），这一项就不分，叶子保留原值
  const male = P.byGender ? splitInteger(P.byGender.male, mouths) : null;
  const female = male ? mouths.map((m, i) => m - male[i]) : null;
  const ageKeys = P.byAge ? Object.keys(P.byAge) : [];
  const ageCounts = {};
  ageKeys.forEach((k) => { ageCounts[k] = splitInteger(P.byAge[k].count, mouths); });

  // 坊市镇村：行和=各块人口，列和=省里各类人口，按城镇先验比例做迭代比例拟合。
  // 省里写的是比例而不是人数（朵甘的寺院庄园、牧帐、山谷村寨）时不拟合，各块照抄省里的比例。
  const settleKeys = P.bySettlement ? Object.keys(P.bySettlement) : [];
  const settleIsRatio = settleKeys.length > 0 && settleKeys.every((k) => typeof P.bySettlement[k] === 'number');
  let settlement = null;
  if (settleIsRatio) {
    settlement = B.map(() => clone(P.bySettlement));
  } else if (settleKeys.length) {
    let matrix = B.map((b, i) => settleKeys.map((k) => mouths[i] * (b.urban[k] || 0.01)));
    for (let round = 0; round < 60; round++) {
      matrix = matrix.map((row, i) => { const s = sum(row); return row.map((x) => (x * mouths[i]) / s); });
      settleKeys.forEach((k, j) => {
        const s = sum(matrix.map((row) => row[j]));
        const target = P.bySettlement[k].mouths;
        matrix.forEach((row) => { row[j] = (row[j] * target) / s; });
      });
    }
    settlement = B.map((b, i) => {
      const rowInt = splitInteger(mouths[i], matrix[i]);
      const perHousehold = mouths[i] / households[i];
      const out = {};
      settleKeys.forEach((k, j) => { out[k] = { mouths: rowInt[j], households: Math.round(rowInt[j] / perHousehold) }; });
      return out;
    });
  }

  const yieldLand = blockIds.map((id, i) => W[id].land * B[i].yieldFactor);
  const cc = P.carryingCapacity || null;
  const arable = cc ? splitInteger(cc.arable, yieldLand) : null;
  const water = cc ? splitInteger(cc.water, yieldLand) : null;
  const historicalCap = cc ? splitInteger(cc.historicalCap, yieldLand) : null;
  const capShare = yieldLand.map((x) => x / sum(yieldLand));
  const load = cc ? mouths.map((m, i) => clamp(cc.currentLoad * (m / pd.mouths) / capShare[i], 0.5, 1.2)) : null;
  function regimeOf(l) {
    if (l < 0.55) return 'abundant';
    if (l < 0.75) return 'sustainable';
    if (l < 0.97) return 'strained';
    return 'overload';
  }

  const popW = mouths;
  const minxin = shiftToMean(B.map((b) => b.minxin), popW, P.minxinLocal, 5, 95).map(Math.round);
  const corruption = shiftToMean(B.map((b) => b.corruption), popW, P.corruptionLocal, 5, 95).map(Math.round);
  const prosperity = shiftToMean(B.map((b) => b.prosperity), popW, P.prosperity, 5, 97).map(Math.round);

  // 地块读数层：改之前各块同值，这个原值就是人口加权均值的目标。
  // 原值必须写在数据模块的 regionMeans 里——从当前值现算的话，补丁重跑时会从已改过的值出发而漂移。
  const REGION_KEYS = ['development', 'unrest', 'taxPressure', 'armyPressure', 'officeRisk'];
  if (!data.regionMeans) {
    const seen = {};
    REGION_KEYS.forEach((k) => { seen[k] = [...new Set(blockIds.map((id) => regionById.get(id)[k]))]; });
    throw new Error('数据模块缺 regionMeans。改之前各块的原值：' + JSON.stringify(seen));
  }
  const regionTargets = {};
  REGION_KEYS.forEach((k) => {
    regionTargets[k] = shiftToMean(B.map((b) => b[k]), popW, data.regionMeans[k], 5, 99).map(Math.round);
  });

  // 钱粮：应征按「税粮七成五、商贸二成五」，截留率平移到省实征总数，征到比例拉回省均值
  const fd = P.fiscalDetail;
  const grainShare = col('grain').map((g) => g / sum(col('grain')));
  const commerceWeight = mouths.map((m, i) => m * B[i].commerce);
  const commerceShare = commerceWeight.map((c) => c / sum(commerceWeight));
  const claimed = splitInteger(fd.claimedRevenue, grainShare.map((g, i) => 0.75 * g + 0.25 * commerceShare[i]));
  let actual;
  let compliance;
  let skimRounded;
  if (data.fiscalRates === 'province') {
    // 羁縻之地（乌思藏、朵甘）剧本记的实征与征到比例、截留率并不按「应征×(1−截留率)」相扣，
    // 各块沿用省里的两项比率（与改前各叶子相同），实征按应征比例分
    actual = splitInteger(fd.actualRevenue, claimed);
    compliance = B.map(() => fd.compliance);
    skimRounded = B.map(() => fd.skimmingRate);
  } else {
    let skim = B.map((b) => b.skimmingRate);
    for (let round = 0; round < 40; round++) {
      const actualSum = sum(claimed.map((c, i) => c * (1 - skim[i])));
      const gap = (actualSum - fd.actualRevenue) / fd.claimedRevenue;
      if (Math.abs(gap) < 1e-7) break;
      skim = skim.map((s) => clamp(s + gap, 0.02, 0.6));
    }
    actual = splitInteger(fd.actualRevenue, claimed.map((c, i) => c * (1 - skim[i])));
    compliance = shiftToMean(B.map((b) => b.compliance * 100), claimed, fd.compliance * 100, 30, 98).map((x) => Math.round(x) / 100);
    skimRounded = claimed.map((c, i) => Math.round((1 - actual[i] / c) * 1000) / 1000);
  }
  const remitRatio = fd.remittedToCenter / fd.actualRevenue;
  const remitted = splitInteger(fd.remittedToCenter, actual.map((a) => a * remitRatio));
  // 朵甘剧本里起运加留用不等于实征（原账如此），羁縻之地留用也按实征比例单独分，省总数才守得住
  const retained = data.fiscalRates === 'province'
    ? splitInteger(fd.retainedBudget, actual)
    : actual.map((a, i) => a - remitted[i]);

  const pt = P.publicTreasuryInit || null;
  const treasury = !pt ? null : {
    money: splitInteger(pt.money, retained),
    grain: splitInteger(pt.grain, col('grain')),
    cloth: splitInteger(pt.cloth, mouths.map((m, i) => m * B[i].textile))
  };

  const eb = P.economyBase || null;
  const economy = !eb ? null : {
    farmland: splitInteger(Number(eb.farmland) || 0, col('land')),
    commerceVolume: splitInteger(Number(eb.commerceVolume) || 0, commerceWeight),
    maritimeTradeVolume: splitInteger(Number(eb.maritimeTradeVolume) || 0, B.map((b) => b.maritime)),
    saltProduction: splitInteger(Number(eb.saltProduction) || 0, B.map((b) => b.salt)),
    mineralProduction: splitInteger(Number(eb.mineralProduction) || 0, B.map((b) => b.mineral || 0)),
    horseProduction: splitInteger(Number(eb.horseProduction) || 0, B.map((b) => b.horse || 0)),
    fishingProduction: splitInteger(Number(eb.fishingProduction) || 0, B.map((b) => b.fishing)),
    imperialFarmland: splitInteger(Number(eb.imperialFarmland) || 0, B.map((b) => b.imperial)),
    postRelays: splitInteger(Number(eb.postRelays) || 0, blockIds.map((id, i) => W[id].counties * B[i].corridor)),
    kejuQuota: splitInteger(Number(eb.kejuQuota) || 0, B.map((b) => b.keju)),
    landsAnnexed: splitInteger(Number(eb.landsAnnexed) || 0, col('land').map((l, i) => l * B[i].gentry)),
    // 垦荒、清丈的累计亩数多数省份为 0；有数的（朵甘）按田亩权重分
    landsReclaimed: splitInteger(Number(eb.landsReclaimed) || 0, col('land')),
    landsSurveyed: splitInteger(Number(eb.landsSurveyed) || 0, col('land'))
  };
  if (eb) ['mineralProduction', 'horseProduction'].forEach((k) => {
    if (eb[k] > 0 && sum(economy[k]) !== eb[k]) throw new Error(k + ' 省里有数，但数据模块没给任何地块权重');
  });
  if (eb) ['zhizao', 'kuangchang', 'yuyao'].forEach((k) => {
    const want = Number(eb.imperialAssets && eb.imperialAssets[k]) || 0;
    const got = sum(B.map((b) => b[k] || 0));
    if (got !== want) throw new Error('官府资产 ' + k + ' 各块合计 ' + got + '，省里是 ' + want);
  });
  const baojiaAccuracy = P.baojia ? B.map((b) => Math.round(clamp(P.baojia.registerAccuracy - 0.1 * (b.hide - 1), 0.4, 0.85) * 100) / 100) : null;
  const baojia = !P.baojia ? null : {
    baoCount: splitInteger(P.baojia.baoCount, households),
    jiaCount: splitInteger(P.baojia.jiaCount, households),
    paiCount: splitInteger(P.baojia.paiCount, households)
  };
  const fiscalWeight = claimed.map((c) => c / fd.claimedRevenue);

  // ---- 写入 ----
  // 核算组节点本身不存数据，「前」取地图上这块的汇总数据
  const before = blockIds.map((id, i) => clone(B[i].accounts ? regionById.get(id).data : leafByRegion.get(id)));
  const beforeRegion = blockIds.map((id) => clone(regionById.get(id)));
  const DEAD_KEYS = ['_codexGenerated', 'sourceMapRegionId'];

  function fillDivision(target, i) {
    const b = B[i];
    target.divisionType = b.divisionType;
    target.officialPosition = b.officialPosition;
    target.description = b.description;
    target.regionType = b.regionType;
    target.terrain = b.terrain;
    target.specialResources = b.specialResources;
    target.taxLevel = b.taxLevel;
    target.prosperity = prosperity[i];
    target.tags = clone(b.tags);
    if (settlement) target.bySettlement = settlement[i];
    target.populationDetail = { mouths: mouths[i], fugitives: fugitives[i], hiddenCount: hidden[i], households: households[i], ding: ding[i] };
    target.population = mouths[i];
    if (male) target.byGender = { male: male[i], female: female[i], sexRatio: P.byGender.sexRatio };
    if (ageKeys.length) {
      const age = {};
      ageKeys.forEach((k) => { age[k] = { count: ageCounts[k][i], ratio: P.byAge[k].ratio }; });
      target.byAge = age;
    }
    if (baojia) target.baojia = { baoCount: baojia.baoCount[i], jiaCount: baojia.jiaCount[i], paiCount: baojia.paiCount[i], registerAccuracy: baojiaAccuracy[i] };
    if (cc) target.carryingCapacity = {
      arable: arable[i], water: water[i], climate: cc.climate, historicalCap: historicalCap[i],
      currentLoad: Math.round(load[i] * 100) / 100, carryingRegime: regimeOf(load[i])
    };
    target.minxinLocal = minxin[i];
    target.corruptionLocal = corruption[i];
    target.minxin = minxin[i];
    target.corruption = corruption[i];
    target.fiscalDetail = {
      claimedRevenue: claimed[i], actualRevenue: actual[i], remittedToCenter: remitted[i], retainedBudget: retained[i],
      compliance: compliance[i], skimmingRate: skimRounded[i], autonomyLevel: fd.autonomyLevel
    };
    target.fiscal = clone(target.fiscalDetail);
    if (treasury) target.publicTreasuryInit = { money: treasury.money[i], grain: treasury.grain[i], cloth: treasury.cloth[i] };
    if (economy) target.economyBase = {
      farmland: economy.farmland[i], commerceCoefficient: b.commerceCoefficient, commerceVolume: economy.commerceVolume[i],
      maritimeTradeVolume: economy.maritimeTradeVolume[i], saltProduction: economy.saltProduction[i],
      mineralProduction: economy.mineralProduction[i], horseProduction: economy.horseProduction[i],
      fishingProduction: economy.fishingProduction[i], imperialFarmland: economy.imperialFarmland[i],
      imperialAssets: { zhizao: b.zhizao || 0, kuangchang: b.kuangchang || 0, yuyao: b.yuyao || 0 },
      postRelays: economy.postRelays[i], kejuQuota: economy.kejuQuota[i], roadQuality: b.roadQuality,
      // 灾异按块写在数据模块（省级灾情只落到实际受灾的府州）；没写的块为空
      landsAnnexed: economy.landsAnnexed[i], landsReclaimed: economy.landsReclaimed[i], landsSurveyed: economy.landsSurveyed[i],
      disasterRecord: clone(b.disasterRecord || [])
    };
    // 掌官姓名考得出、且在人物表里的才写（宪法：考不出不写，界面显示「任官未详」）
    if (b.governor) target.governor = b.governor;
    DEAD_KEYS.forEach((k) => { delete target[k]; });
  }

  // 地域核算组（如「皮岛·原账分项」）：一块地图分成几本账，组节点只有 id、名字与子账，本身不存数据。
  // 先按整块算出一份，再按数据模块 accounts 里的权重拆给各账：人口、钱粮、田亩这类可加的数按权重分，
  // 比例与读数照抄整块；各账自己的描述、地形、官称等写在 accounts 里。
  const ACCOUNT_ADDITIVE = [
    'population', 'populationDetail.mouths', 'populationDetail.fugitives', 'populationDetail.hiddenCount',
    'populationDetail.households', 'populationDetail.ding', 'byGender.male',
    'baojia.baoCount', 'baojia.jiaCount', 'baojia.paiCount',
    'carryingCapacity.arable', 'carryingCapacity.water', 'carryingCapacity.historicalCap',
    'fiscalDetail.claimedRevenue', 'fiscalDetail.actualRevenue', 'fiscalDetail.remittedToCenter',
    'publicTreasuryInit.money', 'publicTreasuryInit.grain', 'publicTreasuryInit.cloth',
    'economyBase.farmland', 'economyBase.commerceVolume', 'economyBase.maritimeTradeVolume',
    'economyBase.saltProduction', 'economyBase.mineralProduction', 'economyBase.horseProduction',
    'economyBase.fishingProduction', 'economyBase.imperialFarmland', 'economyBase.postRelays',
    'economyBase.kejuQuota', 'economyBase.landsAnnexed', 'economyBase.landsReclaimed', 'economyBase.landsSurveyed'
  ];
  const ACCOUNT_OWN_KEYS = ['divisionType', 'officialPosition', 'description', 'terrain', 'specialResources', 'regionType', 'governor'];
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = value;
  }

  function fillAccounts(group, i) {
    const specs = B[i].accounts;
    const children = group.children || [];
    if (children.length !== specs.length) throw new Error(group.name + ' 有 ' + children.length + ' 本账，数据模块写了 ' + specs.length + ' 本');
    const nodes = specs.map((spec) => {
      const node = children.find((c) => c.name === spec.name);
      if (!node) throw new Error(group.name + ' 下没有账目 ' + spec.name);
      return node;
    });
    const whole = {};
    fillDivision(whole, i);
    const weights = specs.map((spec) => spec.weight);
    const parts = specs.map(() => clone(whole));
    const paths = ACCOUNT_ADDITIVE.slice();
    Object.keys(whole.byAge || {}).forEach((k) => paths.push('byAge.' + k + '.count'));
    Object.keys(whole.bySettlement || {}).forEach((k) => {
      if (typeof whole.bySettlement[k] === 'object') paths.push('bySettlement.' + k + '.mouths', 'bySettlement.' + k + '.households');
    });
    paths.forEach((path) => {
      const total = getPath(whole, path);
      if (typeof total !== 'number') return;
      const split = splitInteger(total, weights);
      parts.forEach((part, j) => setPath(part, path, split[j]));
    });
    parts.forEach((part, j) => {
      // 女口、留用由同账的总数减出来，保证每本账自身相加相符
      if (part.byGender) part.byGender.female = part.populationDetail.mouths - part.byGender.male;
      part.fiscalDetail.retainedBudget = part.fiscalDetail.actualRevenue - part.fiscalDetail.remittedToCenter;
      part.fiscal = clone(part.fiscalDetail);
      ACCOUNT_OWN_KEYS.forEach((k) => { if (specs[j][k] !== undefined) part[k] = clone(specs[j][k]); });
      // 整块的掌官只属于写明的那本账，其余各账不继承
      if (specs[j].governor === undefined && whole.governor !== undefined) {
        delete part.governor;
        if (nodes[j].governor === whole.governor) delete nodes[j].governor;
      }
      if (specs[j].tags) part.tags = Object.assign({}, whole.tags, specs[j].tags);
      Object.assign(nodes[j], part);
      DEAD_KEYS.forEach((k) => { delete nodes[j][k]; });
    });
  }

  blockIds.forEach((id, i) => {
    const leaf = leafByRegion.get(id);
    if (B[i].accounts) fillAccounts(leaf, i);
    else fillDivision(leaf, i);
    const region = regionById.get(id);
    fillDivision(region.data, i);
    region.data.legacyFiscalWeight = fiscalWeight[i];
    region.terrain = B[i].terrain;
    region.resources = B[i].specialResources.split('·');
    region.population = mouths[i];
    region.prosperity = prosperity[i];
    region.mood = minxin[i];
    ['development', 'unrest', 'taxPressure', 'armyPressure', 'officeRisk'].forEach((k) => { region[k] = regionTargets[k][i]; });
  });

  // 省节点：下辖名录摘要与描述同步
  // 存数据的节点：普通块是叶子本身，核算组是组下各账
  const leaves = [].concat(...blockIds.map((id, i) => (B[i].accounts ? leafByRegion.get(id).children : [leafByRegion.get(id)])));
  if (Array.isArray(P.prefectures)) {
    P.prefectures.forEach((row) => {
      const node = leaves.find((l) => l.id === row.id);
      if (!node) return;
      row.divisionType = node.divisionType;
      row.officialPosition = node.officialPosition;
      row.description = node.description;
    });
  }
  if (data.provinceDescription) P.description = data.provinceDescription;
  scenario.mapData = clone(scenario.map);

  // ---- 自检：省总数守恒 ----
  const checks = [
    ['人口', pd.mouths, sum(leaves.map((l) => l.population))],
    ['户', pd.households, sum(leaves.map((l) => l.populationDetail.households))],
    ['丁', pd.ding, sum(leaves.map((l) => l.populationDetail.ding))],
    ['逃户', pd.fugitives, sum(leaves.map((l) => l.populationDetail.fugitives))],
    ['隐户', pd.hiddenCount, sum(leaves.map((l) => l.populationDetail.hiddenCount))],
    ['应征', fd.claimedRevenue, sum(leaves.map((l) => l.fiscalDetail.claimedRevenue))],
    ['实征', fd.actualRevenue, sum(leaves.map((l) => l.fiscalDetail.actualRevenue))],
    ['起运', fd.remittedToCenter, sum(leaves.map((l) => l.fiscalDetail.remittedToCenter))],
    ['留用', fd.retainedBudget, sum(leaves.map((l) => l.fiscalDetail.retainedBudget))]
  ];
  if (pt) {
    checks.push(['库钱', pt.money, sum(leaves.map((l) => l.publicTreasuryInit.money))]);
    checks.push(['库粮', pt.grain, sum(leaves.map((l) => l.publicTreasuryInit.grain))]);
    checks.push(['库帛', pt.cloth, sum(leaves.map((l) => l.publicTreasuryInit.cloth))]);
  }
  if (eb) {
    [['耕地', 'farmland'], ['商贸', 'commerceVolume'], ['盐产', 'saltProduction'], ['驿站', 'postRelays'], ['解额', 'kejuQuota']].forEach(([label, k]) => {
      checks.push([label, Number(eb[k]) || 0, sum(leaves.map((l) => l.economyBase[k]))]);
    });
  }
  if (cc) checks.push(['承载·可耕', cc.arable, sum(leaves.map((l) => l.carryingCapacity.arable))]);
  checks.push(['分账权重', 1, Math.round(sum(fiscalWeight) * 1e9) / 1e9]);
  const broken = checks.filter(([, want, got]) => want !== got);
  if (broken.length) throw new Error('省总数不守恒：' + broken.map((c) => c.join(' ')).join('；'));

  // ---- 报告 ----
  const lines = [];
  lines.push('# ' + data.province + ' 府州重写报告', '');
  lines.push('省总数守恒自检：' + checks.map(([k]) => k).join('、') + ' 全部与省级原值相等。', '');
  lines.push('经纬投影拟合误差 ' + projection.maxErr.toFixed(3) + ' 像素。', '');
  lines.push('## 逐块对照（前 → 后）', '');
  lines.push('| 地块 | 人口 | 户 | 应征 | 耕地（亩） | 商贸 | 民心 | 吏治 | 繁荣 | 地形 | 特产 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  blockIds.forEach((id, i) => {
    const o = before[i];
    const n = B[i].accounts ? regionById.get(id).data : leafByRegion.get(id);
    const f = (a, b) => (a === b ? String(b) : a + ' → ' + b);
    const oe = o.economyBase || {};
    const ne = n.economyBase || {};
    lines.push('| ' + [
      leafByRegion.get(id).name,
      f(o.population, n.population),
      f(o.populationDetail.households, n.populationDetail.households),
      f(o.fiscalDetail.claimedRevenue, n.fiscalDetail.claimedRevenue),
      f(oe.farmland, ne.farmland),
      f(oe.commerceVolume, ne.commerceVolume),
      f(o.minxinLocal, n.minxinLocal),
      f(o.corruptionLocal, n.corruptionLocal),
      f(o.prosperity, n.prosperity),
      f(o.terrain, n.terrain),
      f(o.specialResources, n.specialResources)
    ].join(' | ') + ' |');
  });
  blockIds.forEach((id, i) => {
    if (!B[i].accounts) return;
    const group = leafByRegion.get(id);
    lines.push('', '### ' + group.name + '：各账拆分', '');
    lines.push('| 账目 | 权重 | 人口 | 应征 | 耕地（亩） | 地形 | 官称 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    B[i].accounts.forEach((spec) => {
      const node = group.children.find((c) => c.name === spec.name);
      lines.push('| ' + [node.name, spec.weight, node.population, node.fiscalDetail.claimedRevenue,
        (node.economyBase || {}).farmland, node.terrain, node.officialPosition].join(' | ') + ' |');
    });
  });
  lines.push('', '## 县治落块', '');
  lines.push('| 地块 | 所含县（按历史府州） | 人口权重 | 税粮权重 | 田亩权重 |');
  lines.push('| --- | --- | --- | --- | --- |');
  blockIds.forEach((id) => {
    const rows = assignments.filter((a) => a.block === id);
    const byUnit = {};
    rows.forEach((a) => { (byUnit[a.unit] = byUnit[a.unit] || []).push(a.county + (a.method.startsWith('县治在本省各块之外') ? '＊' : '')); });
    const w = W[id];
    lines.push('| ' + data.BLOCKS[id].name + ' | ' + Object.entries(byUnit).map(([u, cs]) => u + '：' + cs.join('、')).join('；') +
      ' | ' + Math.round(w.pop) + ' | ' + Math.round(w.grain) + ' | ' + Math.round(w.land) + ' |');
  });
  lines.push('', '＊县治落在本省各块之外（地图边界为概化），归入最近的本省地块。', '');
  lines.push('## 各府州权重来源', '');
  data.UNITS.forEach((u) => {
    if (u.weights) {
      const w = u.weights;
      lines.push('- ' + u.name + '：人口 ' + Math.round(w.pop) + '、税粮 ' + Math.round(w.grain) + '、田亩 ' + Math.round(w.land) + '。' + (u.basis || ''));
    } else {
      lines.push('- ' + u.name + '：' + u.growthRule + '，系数 ' + u.growth.toFixed(3) + (u.wanliMouths ? '（万历册口 ' + u.wanliMouths + ' / 洪武册口 ' + u.mouths + '）' : '') + '；田亩来源 ' + u.landSource + ' ' + u.land);
    }
  });
  lines.push('', '## 每块依据', '');
  blockIds.forEach((id) => { lines.push('- ' + data.BLOCKS[id].name + '：' + data.BLOCKS[id].notes); });
  const report = lines.join('\n') + '\n';
  if (reportFile) {
    fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true });
    fs.writeFileSync(reportFile, report);
  }
  console.log(report.split('\n').slice(0, 24).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('\n已写入 ' + path.relative(REPO, SCENARIO_FILE));
  } else {
    console.log('\n（试算，未写入；加 --write 写入）');
  }
}

main();
