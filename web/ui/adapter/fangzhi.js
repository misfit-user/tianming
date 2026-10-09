// 方志：一府一州的志书。数据照老方志（phase8-formal-map-dossier.js renderRegionBookNow，契约见 E:/tianming-tmp/newui-survey/contract-fangzhi.md），
// 但不用其 HTML：经 TMPhase8FormalBridge.__p8MapParts 取 regionBundle 等现成算法，组成结构化的页头、读数带、本道排名与六卷，交书页去画。
// 可见之律（奏报失真层开着、该地未揭时）：民心、吏治一律据奏评分；丁口取据报之数并注明；贪腐取据奏；役政有据奏对应的役负、抛荒改显据奏，
// 不露瞒报之比。老方志在后几处会漏真值（职官志贪腐、户口小注丁、役政真值行、军备真兵数），新界面收紧。
// 动作：本方州县安民、巡按、调粮、拟诏（老 regionAction，记行为信号）、改隶（TM.DivisionReassign）；兴造见 adapter/yingzao.js。
// 第七卷「账本」点开才取（ledger）。
import { bus } from '../core/bus.js';

const w = window;
const G = () => w.GM || {};
const P8 = () => (w.TMPhase8FormalBridge && w.TMPhase8FormalBridge.__p8MapParts) || null;
const has = (v) => { const p = P8(); return p && p.hasDisplayValue ? p.hasDisplayValue(v) : v != null && v !== ''; };
const first = (...vs) => { for (const v of vs) if (has(v)) return v; return ''; };
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };

// 省道分组（TMMapRealmLayout）只在老正式地图渲染时才载；方志的省道、本道排名、上官都靠它
let circuitsAsked = null;
export const circuitsReady = () => !!w.TMMapRealmLayout;
export function ensureCircuits() {
  if (w.TMMapRealmLayout) return Promise.resolve(true);
  if (!circuitsAsked) {
    circuitsAsked = Promise.resolve().then(() => {
      if (w.TM && w.TM.Features && typeof w.TM.Features.ensure === 'function') return w.TM.Features.ensure('formalMapLabels');
      const m = w.TMPhase8FormalBridge && w.TMPhase8FormalBridge.map;
      if (m && typeof m.__requestMapLabelFeature === 'function') return m.__requestMapLabelFeature();
      return null;
    }).then(() => !!w.TMMapRealmLayout, () => false);
  }
  return circuitsAsked;
}

const RV = () => w.TM && w.TM.ReportedView;
function veiled(domain, r) {
  const rv = RV();
  try { return !!(rv && rv.active(w.P || null) && !rv.revealed(domain, 'region.' + String((r && (r.id || r.name)) || ''))); } catch (_e) { return false; }
}
const TERRAIN = { plains: '平原', plain: '平原', hills: '丘陵', hill: '丘陵', mountains: '山地', mountain: '山地', plateau: '高原', basin: '盆地', desert: '沙漠', steppe: '草原', grassland: '草原', forest: '林地', coast: '滨海', coastal: '滨海', river: '河谷', valley: '河谷', wetland: '泽地', marsh: '泽地', water: '水域', sea: '海域', ocean: '海域', island: '岛屿', tundra: '寒原' };
function terrainText(v) {
  if (Array.isArray(v)) return v.map(terrainText).filter(Boolean).join('、');
  if (v && typeof v === 'object') return terrainText(v.name || v.label || v.type || '');
  const t = String(v || '').trim();
  return TERRAIN[t] || (/^[a-z][a-z0-9_-]*$/i.test(t) ? '' : t);
}
// 值：数照原样交书页按记数设置写；对象、数组转成短文；英文枚举不显
function val(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  if (typeof v === 'string') { const t = v.trim(); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t; }
  const p = P8();
  return p && p.ppValue ? String(p.ppValue(v)) : String(v);
}
const row = (k, v, tone = '', extra = {}) => ({ k, v: val(v), tone, ...extra });
const keep = (rows) => rows.filter((x) => x && x.v !== '' && x.v != null);

const ZT_SEAL = { wonder: '观', disaster: '灾', player: '裁', event: '云', building: '营' };
const REGION_ACTS = ['安民', '巡按', '调粮', '拟诏'];

// 舆图拾取所得只是精简副本：按 id 换回地图原地块
function regionOf(id) {
  const p = P8();
  if (!p || typeof p.findRegion !== 'function') return null;
  return p.findRegion(id) || null;
}

export function region(id) {
  const p = P8();
  if (!p || typeof p.regionBundle !== 'function') throw new Error('舆图数据未就绪');
  const r = regionOf(id);
  if (!r) return null;
  const run = typeof p.withRenderBatch === 'function' ? p.withRenderBatch : (f) => f();
  return run(() => build(p, r));
}

function build(p, r) {
  const g = G();
  const b = p.regionBundle(r);
  const d = b.data || {};
  const econ = d.economyBase || {};
  const assets = econ.imperialAssets || {};
  const turn = Number(g.turn) || 0;
  const circuit = typeof p.findCircuit === 'function' ? p.findCircuit(r) : null;
  const mine = typeof p.isPlayerRegion === 'function' ? !!p.isPlayerRegion(r) : false;
  const mood = p.moodViewScore(r, b);
  const office = p.officeViewScore(r, b);
  const corr = first(d.corruptionLocal, d.corruption);
  const moodG = p.gradeOf ? p.gradeOf('mood', mood) || {} : {};
  const officeG = p.gradeOf ? p.gradeOf('office', office) || {} : {};
  const rp = typeof p._reportedPop === 'function' ? p._reportedPop(r) : null;
  const dingConceal = rp && rp.ding != null && Number(rp.conceal) > 0 && has(b.pop.ding);
  const renliVeiled = veiled('renli', r);

  // ---------- 页头 ----------
  const fx = (b.liveDivision && Array.isArray(b.liveDivision.statusEffects) ? b.liveDivision.statusEffects.filter(Boolean) : []).slice(0, 12).map((e) => {
    const ep = Number(e.econPct), mp = Number(e.minxinPerTurn);
    const effects = [Number.isFinite(ep) && ep ? `岁入${ep > 0 ? '+' : '−'}${Math.abs(Math.round(ep * 100))}%` : '', Number.isFinite(mp) && mp ? `民心每回合${mp > 0 ? '+' : '−'}${Math.abs(mp)}` : ''].filter(Boolean);
    const left = e.expiresTurn != null ? Math.max(0, Number(e.expiresTurn) - turn) : null;
    return { seal: ZT_SEAL[e.kind] || '云', name: String(e.name || ''), desc: String(e.desc || ''), effects, left, tone: ep < 0 || mp < 0 ? 'bad' : effects.length ? 'good' : '' };
  });
  const op = first(d.officialPosition, '主官');
  let governor;
  if (d.governorVacant) governor = { office: op, name: '空缺·待补', vacant: true };
  else if (d.governorUnrecorded) governor = { office: op, name: '任官未详' };
  else {
    const gn = first(d.governor, d.official);
    const gc = d.governorChar && typeof w.findCharByName === 'function' ? w.findCharByName(d.governorChar) : null;
    governor = gn ? { office: op, name: String(gn), adm: gc && has(gc.administration) ? n(gc.administration) : null, isChar: !!gc } : null;
  }
  const head = {
    name: p.regionTitle(r), level: typeof p.regionLevel === 'function' ? p.regionLevel(r) : '',
    owner: p.ownerName(r) || '', ownerKey: p.ownerKey ? p.ownerKey(r) : '',
    circuit: circuit ? { key: circuit.key, label: circuit.label } : null,
    desc: String(first(d.description, r.description) || ''), status: fx, governor,
    superior: superiorOf(r, b, circuit), terrain: terrainText(first(d.terrain, r.terrain)), tax: String(d.taxLevel || '')
  };

  // ---------- 读数带 ----------
  const band = [
    { k: '户口', v: n(first(d.population, b.pop.mouths)),
      subPre: '丁', subN: dingConceal && renliVeiled ? n(rp.ding) : n(b.pop.ding), subTag: dingConceal && renliVeiled ? '据报' : '' },
    { k: '实征', v: n(b.fiscal.actualRevenue), sub: has(b.fiscal.compliance) ? `合规${pct(b.fiscal.compliance)}` : '' },
    ((g) => ({ k: '驻军', v: g.v, reported: g.reported, sub: String(first(d.armyPressure) || '') }))(garrisonOf(r, b)),
    has(first(d.minxinLocal, r.mood, d.prosperity)) ? { k: '民心', v: n(mood), sub: moodG.mark || '', warn: p.gradeIsWarn ? !!p.gradeIsWarn('mood', moodG) : false, reported: veiled('minxin', r) } : null,
    has(corr) ? { k: '吏治', v: n(office), sub: officeG.mark || '', warn: p.gradeIsWarn ? !!p.gradeIsWarn('office', officeG) : false, reported: veiled('corruption', r) } : null
  ].filter((x) => x && x.v != null);

  // ---------- 六卷 ----------
  const da = d.demographicAccounting || {};
  const fullBasis = da.basis === 'existing-game-population-domain-with-legal-status-partitions';
  const mouthsUnit = da.hiddenCountUnit === 'mouths';
  const prosperity = first(d.prosperity, r.prosperity);
  const dingRow = dingConceal
    ? row('丁口', rp.ding, '', { tag: '据报', note: renliVeiled ? '地方奏报口径；真丁口须遣员核查、门生密报方得掀见' : `地方奏报口径；真丁口${fmtN(b.pop.ding)}，约瞒报${Math.round(Number(rp.conceal) * 100)}%` })
    : row('丁口', b.pop.ding);
  const cp = typeof p.classPressureForRegion === 'function' ? p.classPressureForRegion(r) : null;
  const huyi = keep([
    row(fullBasis ? '口数（含逃隐）' : '在册口数', first(d.population, b.pop.mouths)),
    row(fullBasis ? '户数' : '在册户', b.pop.households),
    dingRow,
    row(mouthsUnit ? '逃散人口（估）' : '逃户', b.pop.fugitives, 'bad'),
    row(mouthsUnit ? '隐匿人口（估）' : '隐户', b.pop.hiddenCount, 'bad'),
    b.pop.actualMouths != null ? row('居民估数', b.pop.actualMouths, '', { unit: '口' }) : null,
    b.pop.taxableHouseholds != null ? row('当前应税户', b.pop.taxableHouseholds) : null,
    row('承载上限', d.carryingCapacity), row('保甲', d.baojia), row('繁荣', prosperity),
    has(d.wealth) && String(d.wealth) !== String(prosperity) ? row('财富', d.wealth) : null,
    has(d.development) && String(d.development) !== String(prosperity) ? row('发展', d.development) : null,
    row('不稳', d.unrest, 'bad'),
    // 阶层压力由各阶层真满意推出：失真层开着且本地未揭时不列（阶层满意据奏见朝野册）
    !veiled('minxin', r) && cp && (cp.count > 0 || Number(cp.score) > 0) ? row('阶层压力', has(cp.score) ? Math.round(Number(cp.score)) : '', Number(cp.score) >= 50 ? 'bad' : '', { note: '满分一百' }) : null,
    !veiled('minxin', r) && cp && (cp.count > 0 || Number(cp.score) > 0) ? row('牵动阶层', (cp.classNames || []).join('、')) : null,
    !veiled('minxin', r) && cp && (cp.count > 0 || Number(cp.score) > 0) ? row('地方处境', cp.reason) : null
  ]);
  const yizheng = yizhengOf(p, r, renliVeiled);
  const fc = b.fiscal;
  const caifu = keep([
    row(fc.isForecast ? '岁计应征钱' : '应征', fc.claimedRevenue),
    row(fc.isForecast ? '岁计可入钱' : '实征', fc.actualRevenue),
    row(fc.isForecast ? '岁计解送钱' : '起运中枢', fc.remittedToCenter),
    row(fc.isForecast ? '岁计留用钱' : '留用地方', fc.retainedBudget),
    fc.resources && fc.resources.grain ? row('岁计可入粮', fc.resources.grain.actualRevenue, '', { unit: '石' }) : null,
    fc.resources && fc.resources.cloth ? row('岁计可入帛', fc.resources.cloth.actualRevenue, '', { unit: '匹' }) : null,
    has(fc.compliance) ? row('征到比例', pct(fc.compliance)) : null,
    has(fc.skimmingRate) ? row('截留率', pct(fc.skimmingRate), 'bad') : null,
    has(first(fc.autonomyLevel, fc.autonomy)) ? row('财政自主', pct(first(fc.autonomyLevel, fc.autonomy))) : null,
    row('税负', first(fc.taxBurden, d.taxBurden)), row('税级', d.taxLevel),
    row('库钱', b.treasury.money), row('掌藏记', d.custodyNote), row('库藏粮', b.treasury.grain), row('库帛', b.treasury.cloth),
    row('本回合银产', fc.moneyOutput, 'gold'), row('本回合粮产', fc.grainOutput, 'gold'),
    row('豪强', magnate(b.liveStats), 'bad')
  ]);
  const armies = armiesOf(b.army.liveArmies || []);
  const garrison = garrisonOf(r, b);
  const fortParts = [b.liveDivision && Number(b.liveDivision.fortLevel) > 0 ? `${b.liveDivision.fortLevel}档` : '', has(b.army.fortification) ? String(val(b.army.fortification)) : ''].filter(Boolean);
  const junbei = keep([
    row('驻军', garrison.v, '', garrison.reported ? { tag: '据奏' } : {}),
    armies.length ? row('在驻之师', (b.army.liveArmies || []).length, '', { unit: '支' }) : null,
    row('可募兵源', first(d.militaryRecruits, b.army.recruits)),
    row('军压', first(d.armyPressure, r.armyPressure), 'bad'),
    row('月军费', d.localMilitaryCost),
    row('净留用', d.retainedNet, Number(d.retainedNet) < 0 ? 'bad' : ''),
    fortParts.length ? row('城防', fortParts.join(' · '), 'gold') : null,
    row('主将', first(armies[0] && armies[0].commander, d.commander, b.army.commander)),
    row('边警', first(d.borderRisk, d.warRisk), 'bad'), row('补给', first(d.supply, b.army.supply)),
    row('水师 / 海防', first(d.navy, d.coastalDefense)), row('威胁', d.threats, 'bad'), row('战略价值', d.strategicValue)
  ]);
  const corrShown = has(corr) && typeof p.mapReported === 'function' ? p.mapReported('corruption', r, Number(corr), 'bad') : corr;
  const zhiguan = keep([
    row('主官', d.governorVacant ? '空缺·待补' : d.governorUnrecorded ? '任官未详' : first(d.governor, d.official), d.governorVacant ? 'bad' : ''),
    row('官职', d.officialPosition), row('官缺', first(d.officeVacancy, d.vacancy)),
    has(corr) ? row('贪腐', typeof corrShown === 'number' ? Math.round(corrShown) : corrShown, 'bad', veiled('corruption', r) ? { tag: '据奏' } : {}) : null,
    row('政令执行', first(d.policyExecution, d.execution)), row('地方派系', first(d.localFaction, d.party)),
    row('士绅', d.leadingGentry), row('书院', d.academies), row('科举解额', econ.kejuQuota), row('官府资产', econ.imperialAssets),
    row('备注', first(d.note, r.note))
  ]);
  const tags = typeof p.ppTagNames === 'function' ? p.ppTagNames(d.tags) : [];
  const children = Array.isArray(d.children) ? d.children : [];
  const fengwuGrid = keep([
    row('耕地', econ.farmland), row('商贸', econ.commerceVolume), row('商贸盛衰', econ.commerceCoefficient),
    row('盐课', econ.saltProduction), row('矿课', econ.mineralProduction), row('马政', econ.horseProduction),
    row('渔课', econ.fishingProduction), row('皇庄', econ.imperialFarmland), row('海贸', econ.maritimeTradeVolume),
    row('织造', assets.zhizao), row('矿场', assets.kuangchang), row('御窑', assets.yuyao),
    row('驿站', econ.postRelays), row('道路', econ.roadQuality)
  ]);
  const fengwu = keep([
    row('地势', terrainText(first(d.terrain, r.terrain))), row('特殊资源', first(d.specialResources, r.resources)),
    row('特殊文化', d.specialCulture), row('商路', d.tradeRoutes),
    row('近期灾异', first(d.recentDisasters, econ.disasterRecord), 'bad'),
    row('标签', tags.length ? tags.join('、') : ''), row('法理归属', first(d.dejureOwner, p.ownerName(r))),
    row('核心 / 边缘', first(d.coreStatus, d.borderStatus)), row('归属历史', d.ownerHistory),
    row('下辖子区', children.length ? children.map((x) => String(val(x && (x.name || x.title)) || val(x))).join('、') : '')
  ]);
  const vols = [
    { key: 'huyi', seal: '户', name: '户役志', sub: yizheng.length ? '户口簿籍 · 徭役丁田' : '户口簿籍', rows: huyi, sub2: yizheng.length ? { title: '役政', note: '徭役农政 · 丁田', rows: yizheng } : null,
      note: fullBasis ? '所列口数已含逃隐，实居之众尚未尽详。细分簿籍未备。' : '' },
    { key: 'caifu', seal: '赋', name: '财赋志', sub: '岁入库藏', rows: caifu },
    { key: 'junbei', seal: '军', name: '军备志', sub: '戎政边防', rows: junbei, armies },
    { key: 'zhiguan', seal: '官', name: '职官志', sub: '官守治理', rows: zhiguan },
    { key: 'fengwu', seal: '物', name: '风物志', sub: '物产设施', rows: fengwu, grid: fengwuGrid },
    { key: 'yingzao', seal: '营', name: '营造志', sub: '已建之业 · 工役', works: worksOf(r, b) },
    b.liveDivision ? { key: 'zhang', seal: '账', name: '账本', sub: '赋税核算 · 公库 · 实绩 · 灾异', ledger: true } : null   // 点开才算（ledger）
  ].filter((v) => v && ((v.rows && v.rows.length) || (v.grid && v.grid.length) || (v.works && v.works.length) || v.key === 'yingzao' || v.ledger));

  return {
    id: r.id, head, band, rank: rankOf(p, r, b, circuit), vols, mine,
    acts: mine ? REGION_ACTS : [],
    canReassign: mine && !!(w.TM && w.TM.DivisionReassign),
    liveName: b.liveDivision ? String(first(b.liveDivision.name, r.name)) : ''
  };
}

function fmtN(v) { const x = n(v); return x == null ? String(v) : (x >= 1e4 ? `${Math.round(x / 1e3) / 10}万` : String(Math.round(x))); }
function pct(v) { const x = Number(v); if (!Number.isFinite(x)) return String(v); return `${Math.round(x <= 1 ? x * 100 : x)}%`; }
function magnate(ls) {
  if (!ls || typeof ls.magnatePower !== 'number' || ls.magnatePower < 20) return '';
  const mp = ls.magnatePower;
  return `${Math.round(mp)} · ${mp >= 70 ? '势大难制' : mp >= 50 ? '坐大' : mp >= 35 ? '渐起' : '抬头'}${ls._magnateCollusion ? ' · 勾结州县' : ''}`;
}
// 驻军显示数：在驻之师逐军据奏相加；无师可指时，失真层开着则整数据奏（army:garrison.region.<id>，与兵额同向虚增）。
// 读数带、军备志、通志读数与辖境表都走这里，免得一处据奏、一处露真
function garrisonOf(r, b) {
  const d = b.data || {};
  const army = b.army || {};
  const live = armiesOf(army.liveArmies || []);
  if (live.length) return { v: live.reduce((s, a) => s + (a.soldiers || 0), 0), reported: live.some((a) => a.reported) };
  const raw = n(first(d.garrison, army.troops, r.troops));
  const rv = RV();
  let on = false;
  try { on = !!(rv && rv.active(w.P || null) && typeof rv.value === 'function'); } catch (_e) { on = false; }
  if (raw == null || !on) return { v: raw, reported: false };
  try { const res = rv.value('army', `garrison.region.${r.id || r.name}`, raw, { direction: 'good', dept: 'military' }); return { v: Math.round(Number(res.shown)), reported: true }; } catch (_e) { return { v: raw, reported: false }; }
}
// 在驻之师：兵数照新军务卷的失真口径（失真层开着则取据奏之数）
function armiesOf(list) {
  const rv = RV();
  const on = (() => { try { return !!(rv && rv.active(w.P || null)); } catch (_e) { return false; } })();
  return list.slice(0, 8).map((a) => {
    const t = Number(a.soldiers || a.size || a.strength) || 0;
    let shown = t;
    let reported = false;
    if (on && typeof rv.value === 'function') {
      try { const res = rv.value('army', 'soldiers.' + String(a.name || a.id || ''), t, { direction: 'good', dept: 'military' }); if (res && res.shown != null) { shown = Math.round(Number(res.shown)); reported = !!res.perceived || shown !== t; } } catch (_e) { /* 照真值 */ }
    }
    const mor = Number(a.morale);
    return { name: String(a.name || '无名之师'), soldiers: shown, reported, commander: a.commander ? String(a.commander) : '', morale: Number.isFinite(mor) ? Math.round(mor) : null };
  });
}
function yizhengOf(p, r, isVeiled) {
  const ld = typeof p.findLiveAdminDivision === 'function' ? p.findLiveAdminDivision(r) : null;
  if (!ld || !ld.renliSeed) return [];
  const g = G();
  const rid = String(r.id || r.name || '');
  const rg = w.TM && w.TM.Renli && typeof w.TM.Renli.forMapRegion === 'function' ? w.TM.Renli.forMapRegion(g, r) : (g.renli && g.renli.byRegion ? g.renli.byRegion[rid] : null);
  const pd = ld.populationDetail || null;
  const alloc = pd && pd.alloc ? pd.alloc : null;
  const pol = rg && rg.levyPolicy ? rg.levyPolicy : null;
  const rep = g.renli && g.renli.reported ? g.renli.reported[rid] || (r.name ? g.renli.reported[r.name] : null) : null;
  const explicit = ld.renliSeed.accounting === 'explicit-ding';
  const out = [];
  // 失真层开且未揭：役负、抛荒只显有司所奏，不显真值与瞒报之比
  if (isVeiled && rep) {
    out.push(row('役负率', `${Math.round((Number(rep.corveeRate) || 0) * 100)}%`, '', { tag: '据奏' }));
    out.push(row('抛荒之比', `${Math.round((Number(rep.fallowShare) || 0) * 100)}%`, '', { tag: '据奏', note: '诸数皆有司口径，实情须遣员核查' }));
  } else {
    out.push(row('役负率', rg && has(rg.corveeRate) ? `${Math.round(Number(rg.corveeRate) * 100)}%` : '', rg && Number(rg.corveeRate) > 0.35 ? 'bad' : ''));
    out.push(row('抛荒田亩', rg ? rg.fallowLand : '', 'bad'));
    if (rep) {
      const cz = Number(rep.conceal) || 0;
      out.push(row('地方奏报', `役负${Math.round((Number(rep.corveeRate) || 0) * 100)}% · 抛荒${Math.round((Number(rep.fallowShare) || 0) * 100)}%`, cz > 0.12 ? 'bad' : '', { note: cz > 0.12 ? `瞒报约${Math.round(cz * 100)}%` : '与实情相符' }));
    }
  }
  if (rg && rg.physicalRoleRate != null) out.push(row('全体劳力役占', `${Math.round(rg.physicalRoleRate * 100)}%`));
  out.push(row('地力', rg ? rg.soil : ''), row('水利', rg ? rg.waterworks : ''), row('在耕田亩', rg ? rg.cultivatedLand : ''));
  out.push(row(explicit ? '岁计粮产' : '本回合粮产', rg ? rg.grainOutput : '', 'gold'));
  if (rg && rg.otherFoodEquivalent != null) out.push(row('牧渔等食物当量', rg.otherFoodEquivalent, '', { unit: '石口粮' }));
  out.push(row(explicit ? '本地产食缺口' : '缺粮', rg ? rg.foodDeficit : '', 'bad'));
  if (alloc) out.push(row('丁分配', `务农${fmtN(alloc.farm)} · 应役${fmtN(alloc.corvee)} · 应征${fmtN(alloc.draft)} · 优免${fmtN(alloc.exempt)}`));
  if (pd) out.push(row('册载丁', pd.registeredDing), row('优免丁', pd.exemptDing, 'bad'), row('诡寄丁', pd.commendedDing, 'bad'));
  if (pol) out.push(row('现行则例', `${{ light: '轻役', normal: '常役', heavy: '重役' }[pol.strength] || '常役'}${Number(pol.remitTurns) > 0 ? ` · 蠲免余${pol.remitTurns}回合` : ''}`));
  return keep(out);
}
// 上官签（照老 regionSuperiorPill）：只本方州县；现任或出缺或赴任
function superiorOf(r, b, circuit) {
  const gv = w.TM && w.TM.CircuitGovernance, fxe = w.TM && w.TM.CircuitGovernorEffects, dr = w.TM && w.TM.DivisionReassign;
  const g = G();
  try {
    if (!gv || !dr || !circuit || !gv.isPlayerRegion(g, r)) return null;
    const gov = gv.governorOf(g, circuit, dr.ownerKeyOf(r));
    if (!['serving', 'vacant', 'travelling'].includes(gov.status)) return null;
    const ledger = g.circuitGovernance;
    const crow = ledger && ledger.byCircuit[circuit.key];
    const status = gov.status === 'travelling' ? 'travelling' : crow && crow.status === 'seatLost' ? 'seatLost' : gov.status;
    const ids = [r.adminBinding, ...(r.accountingLeafIds || []), r.id, b.liveDivision && b.liveDivision.id];
    let leaf = null;
    ids.some((id) => { const hit = ledger && ledger.byLeaf[id]; if (hit && hit.circuitKey === circuit.key) { leaf = hit; return true; } return false; });
    const who = gov.status === 'vacant' ? '出缺' : gov.holderName || '出缺';
    const signed = (v, percent) => `${v >= 0 ? '+' : '−'}${Math.abs(v * (percent ? 100 : 1)).toFixed(1)}${percent ? '%' : ''}`;
    let tail = '';
    if (fxe && !fxe.enabled()) tail = '长官之效已关';
    else if (status === 'travelling') tail = '赴任中';
    else if (status === 'seatLost') tail = '首府失守';
    else if (leaf) tail = `距驻地${leaf.days}日${leaf.estimated ? '（估程）' : ''} · 执行${signed(leaf.exec, true)}`;
    return { role: gov.position.name, who, tail, isChar: gov.status !== 'vacant' && !!gov.holderName };
  } catch (_e) { return null; }
}
// 本道排名（照老 regionCircuitRank）：本道本方诸州里户口、实征、民心、吏治的名次；民心、吏治落后三分之一的标出
function rankOf(p, r, b, circuit) {
  const MC = w.TM && w.TM.MapCircuits;
  if (!circuit || !MC || typeof MC.partitionByOwner !== 'function') return null;
  const own = MC.partitionByOwner(circuit, p.canonicalOwnerKey ? p.canonicalOwnerKey(r) : p.ownerKey(r)).own;
  const at = own.indexOf(r);
  if (own.length < 2 || at < 0) return null;
  const all = own.map((x) => {
    const bx = x === r ? b : p.regionBundle(x), dx = bx.data || {};
    return { pop: Number(first(dx.population, bx.pop.mouths)), tax: Number(bx.fiscal.actualRevenue), mood: Number(p.moodViewScore(x, bx)), office: Number(p.officeViewScore(x, bx)) };
  });
  const rank = (key, higher) => {
    const v = all[at][key];
    if (!Number.isFinite(v)) return null;
    return 1 + all.filter((m) => Number.isFinite(m[key]) && (higher ? m[key] > v : m[key] < v)).length;
  };
  const low = Math.ceil(own.length * 2 / 3);
  const items = [['户口', rank('pop', true), false], ['实征', rank('tax', true), false], ['民心', rank('mood', true), true], ['吏治', rank('office', false), true]]
    .filter(([, k]) => k != null).map(([label, k, watch]) => ({ label, rank: k, low: watch && k > low }));
  return items.length ? { circuit: { key: circuit.key, label: circuit.label }, of: own.length, items } : null;
}
// 营造：在册工役与候诏营造案（照老 bkYingzao）
function worksOf(r, b) {
  const live = b.liveDivision;
  const P = w.P || {};
  const g = G();
  const bw = w.TM && w.TM.BuildingWorks;
  const divName = String(first(live && live.name, r.name, r.title) || '');
  const seen = new Set();
  const out = [];
  const add = (bld) => {
    if (!bld) return;
    const k = `${bld.territory || bld._territory || divName}|${bld.type || bld.name}`;
    if (seen.has(k)) return;
    seen.add(k);
    const typeDef = bw && bw.typeDefFor ? bw.typeDefFor(bld.name, P) : null;
    const ledger = bw && bw.buildingLedger ? bw.buildingLedger(bld, typeDef) : null;
    const total = Number(bld.timeActual) || Number(typeDef && typeDef.buildTime) || Math.max(1, Number(bld.remainingTurns) || 1);
    const doing = bld.status === 'building';
    out.push({
      name: String(bld.name || ''), level: `${bld.isCustom ? '自拟 · ' : ''}${bld.level || 1}级`,
      status: doing ? '工役中' : bld.status === 'neglected' ? '失修' : bld.status === 'damaged' ? '半损' : '完好',
      tone: doing ? 'doing' : bld.status === 'neglected' || bld.status === 'damaged' ? 'bad' : 'good',
      desc: String(bld.description || '').slice(0, 90), fx: bw && bw.fxLabels ? bw.fxLabels(bld, typeDef) : [],
      applied: !doing && ledger && ledger.applied ? ledger.applied : [], flowPct: ledger ? ledger.flowPct : 0, upkeep: ledger ? ledger.upkeep : null,
      progress: doing ? Math.round(Math.max(0, Math.min(1, (total - (Number(bld.remainingTurns) || 0)) / total)) * 100) : null, left: doing ? Number(bld.remainingTurns) || 0 : null
    });
  };
  if (live && Array.isArray(live.buildings)) live.buildings.forEach(add);
  if (typeof w.getTerritoryBuildingsCompat === 'function') {
    [...new Set([divName, live && live.name, r.name, r.title, r.officialName].filter((x) => has(x)).map(String))]
      .forEach((nm) => { try { w.getTerritoryBuildingsCompat(nm).forEach(add); } catch (_e) { /* 无工籍 */ } });
  }
  const ST = { submitted: '待核办', unresolved: '未开工', rejected: '未准', deferred: '缓行', recovery_required: '待恢复' };
  (Array.isArray(g._edictSuggestions) ? g._edictSuggestions : []).forEach((s) => {
    if (!s || s.used || s.from !== divName || String(s.source || '') !== '工程') return;
    const order = w.TM && w.TM.BuildingOrders && w.TM.BuildingOrders.list(g).find((o) => o.id === s.buildingOrderId);
    out.push({ name: order ? order.req.name : String(s.content || '营造案').slice(0, 24), level: '营造案', status: (order && ST[order.status]) || '候诏', tone: 'doing', proposal: true, fx: [], applied: [],
      desc: order && order.receipt && order.receipt.reason ? String(order.receipt.reason) : '已入清册，候颁行后由有司核定造价、工期与效用。' });
  });
  return out;
}

// ---------- 动作 ----------
// 安民、巡按、调粮、拟诏：老 regionAction（写议事清册并记玩家行为信号；内部再判本方）
export function act(id, kind) {
  const p = P8();
  if (!p || typeof p.regionAction !== 'function') throw new Error('内核缺方志动作');
  const ok = p.regionAction(String(id), kind);
  if (ok) bus.emit('game:changed', { what: 'edict-suggestion' });
  return ok;
}
// 改隶：可否移出、候选省道（接壤者在前、不接壤者标飞地）
export function reassignOptions(id) {
  const dr = w.TM && w.TM.DivisionReassign;
  const r = regionOf(id);
  if (!dr || !r) return { ok: false, reason: '改隶未就绪' };
  const m = dr.movable(r, {});
  if (!m || !m.ok) return { ok: false, reason: (m && m.reason) || '此地不可改隶' };
  const targets = (dr.targetsFor(r, {}) || []).map((t) => ({ key: t.key, label: t.label, adjacent: !!t.adjacent }));
  return { ok: true, from: m.from ? m.from.label : '', targets };
}
export function reassign(id, key) {
  const p = P8();
  if (!p || typeof p.reassignSuggest !== 'function') throw new Error('内核缺改隶写口');
  const ok = p.reassignSuggest(String(id), key);
  if (ok) bus.emit('game:changed', { what: 'edict-suggestion' });
  return ok;
}

// ---------- 通志（一道之志；照老 renderCircuitBookNow，D:1948-2309） ----------
const CIRCUIT_ACTS = ['整饬吏治', '蠲免', '巡按', '任免'];
const BUILD_CAT = { military: '军事', economic: '经济', cultural: '文教', administrative: '政务', religious: '祠祀', infrastructure: '工程', social: '民生', other: '其他' };
function adminFinder() {
  const byId = new Map(), byName = new Map();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.id != null && !byId.has(node.id)) byId.set(node.id, node);
    if (node.name && !byName.has(node.name)) byName.set(node.name, node);
    ['divisions', 'children', 'prefectures'].forEach((k) => (Array.isArray(node[k]) ? node[k] : []).forEach(walk));
  };
  const roots = G().adminHierarchy || {};
  Object.keys(roots).forEach((k) => walk(roots[k]));
  return (ref) => (ref && ref.id ? byId.get(ref.id) : byName.get(ref && ref.name)) || null;
}
function playerNames() {
  const rail = w.TMPhase8FormalBridge && w.TMPhase8FormalBridge.rightrail;
  try { return rail && typeof rail.playerFactionNames === 'function' ? rail.playerFactionNames() : []; } catch (_e) { return []; }
}
// 视角：本道有玩家的州即以玩家为本方，否则以点开的那一州（或首州）之主为本方
function viewerOf(p, circuit, clicked) {
  const names = playerNames();
  const isPlayer = (owner) => { const f = p.findFaction ? p.findFaction(owner, '') : null; return names.includes(String(owner)) || !!(f && names.includes(String(f.name))); };
  const mine = circuit.members.find((m) => isPlayer(m.owner));
  if (mine) return { owner: mine.owner, player: true };
  const anchor = (clicked && circuit.members.find((m) => m.region === clicked)) || circuit.members[0];
  return { owner: anchor ? anchor.owner : '', player: false };
}
function regionBuildings(p, r) {
  const live = p.findLiveAdminDivision ? p.findLiveAdminDivision(r) : null;
  const divName = String(first(live && live.name, r.name) || '');
  const seen = new Set(), out = [];
  const add = (bld) => { if (!bld) return; const k = `${bld.territory || bld._territory || divName}|${bld.type || bld.name}`; if (seen.has(k)) return; seen.add(k); out.push(bld); };
  if (live && Array.isArray(live.buildings)) live.buildings.forEach(add);
  if (typeof w.getTerritoryBuildingsCompat === 'function' && divName) { try { w.getTerritoryBuildingsCompat(divName).forEach(add); } catch (_e) { /* 无工籍 */ } }
  return out;
}

export function circuit(keyOrRegionId) {
  const p = P8();
  const MC = w.TM && w.TM.MapCircuits;
  if (!p || !MC || typeof p.findCircuit !== 'function') throw new Error('省道分组未就绪');
  const clicked = regionOf(keyOrRegionId);
  const c = p.findCircuit(clicked || keyOrRegionId);
  if (!c) return null;
  const run = typeof p.withRenderBatch === 'function' ? p.withRenderBatch : (f) => f();
  return run(() => buildCircuit(p, MC, c, clicked));
}

function buildCircuit(p, MC, c, clicked) {
  const viewer = viewerOf(p, c, clicked);
  const split = MC.partitionByOwner(c, viewer.owner);
  const own = split.own;
  const profile = MC.profileOf(c, { findAdmin: adminFinder() });
  const sum = MC.summarize(own, { bundle: p.regionBundle, mood: p.moodViewScore, office: p.officeViewScore });
  const capRow = profile.capital ? c.members.find((m) => p.regionTitle(m.region) === profile.capital || m.region.name === profile.capital) : null;
  const capital = capRow ? capRow.region : null;
  const ownerLabel = String(first(own[0] && p.ownerName(own[0]), viewer.owner) || '');
  const moodG = p.gradeOf('mood', sum.mood) || {}, offG = p.gradeOf('office', sum.office) || {};
  const link = (r) => ({ id: r.id || r.name, name: p.regionTitle(r) });

  // 辖境：各州问题轻重，全道共性提出来
  let xiajing = null;
  if (own.length) {
    const ranked = MC.rankProblems(own, {
      score: p.modeScore, grade: p.gradeOf, isWarn: p.gradeIsWarn,
      statusOf: (r) => { const b = p.regionBundle(r); return (b.liveDivision && b.liveDivision.statusEffects) || []; },
      unrestOf: (r) => { const b = p.regionBundle(r), d = b.data || {}; return first(d.unrest, b.liveDivision && b.liveDivision.unrest); }
    });
    const lifted = MC.liftCommonProblems(ranked, { populationOf: (r) => { const b = p.regionBundle(r); return first((b.data || {}).population, b.pop && b.pop.mouths); } });
    xiajing = {
      common: lifted.common.length ? { count: lifted.common[0].count, of: own.length, items: lifted.common.map((x) => x.label + (x.mark ? ` ${x.mark}` : '')) } : null,
      rows: lifted.rows.map((rw) => {
        const r = rw.region, b = p.regionBundle(r), d = b.data || {};
        const ms = p.moodViewScore(r, b), os = p.officeViewScore(r, b);
        return { ...link(r), pop: n(first(d.population, b.pop && b.pop.mouths)), tax: n(b.fiscal && b.fiscal.actualRevenue), troops: garrisonOf(r, b).v,
          mood: n(ms), moodMark: (p.gradeOf('mood', ms) || {}).mark || '', office: n(os), officeMark: (p.gradeOf('office', os) || {}).mark || '', reasons: rw.reasons || [], warn: rw.score > 0 };
      }),
      others: split.others.map((o) => ({ owner: String(first(o.regions[0] && p.ownerName(o.regions[0]), o.owner) || ''), regions: o.regions.map(link) }))
    };
  }
  // 形势
  const disasters = own.filter((r) => { const b = p.regionBundle(r); return ((b.liveDivision && b.liveDivision.statusEffects) || []).some((e) => e && e.kind === 'disaster'); });
  const threats = profile.threats || [];
  const xingshi = keep([
    row('战略', profile.strategicValue), row('边警', threats.join('；'), threats.length ? 'bad' : ''),
    row('灾异', disasters.length ? disasters.map((r) => p.regionTitle(r)).join('、') : '本回合各州无灾异', disasters.length ? 'bad' : ''),
    row('士绅', (profile.gentry || []).join('、')), row('书院', (profile.academies || []).join('、'))
  ]);
  // 财计
  const caiji = own.length ? keep([
    row('实征', sum.actualRevenue, '', sum.compliance != null ? { note: `合规${Math.round(sum.compliance * 100)}%` } : {}),
    row('起运', sum.remittedToCenter), row('留用', sum.retainedBudget),
    row('公帑·银', sum.treasury && sum.treasury.money), row('公帑·粮', sum.treasury && sum.treasury.grain, '', { note: '各州库藏合计' }),
    row('掌藏记', profile.custodyNote)
  ]) : [];
  // 营造
  let yingzao = null;
  if (own.length) {
    const catOf = (bld) => { const bw = w.TM && w.TM.BuildingWorks; const td = bw && bw.typeDefFor ? bw.typeDefFor(bld && bld.name, w.P || {}) : null; return (td && td.category) || ''; };
    const bs = MC.summarizeBuildings(own, { buildingsOf: (r) => regionBuildings(p, r), categoryOf: catOf });
    const types = w.P && w.P.buildingSystem && (w.P.buildingSystem.buildingTypes || w.P.buildingSystem.types);
    yingzao = bs.total ? {
      total: bs.total, status: bs.byStatus, cats: Object.keys(bs.byCategory).map((k) => `${BUILD_CAT[k] || k}${bs.byCategory[k]}`),
      regions: bs.byRegion.map((x) => ({ ...link(x.region), capital: x.region === capital,
        items: x.buildings.map((bld) => `${bld.name}${bld.level > 1 ? `${bld.level}级` : ''}${bld.status === 'building' ? '（在建）' : bld.status === 'neglected' ? '（失修）' : bld.status === 'damaged' ? '（半损）' : ''}`) }))
    } : { empty: Array.isArray(types) && types.length ? '本道各州尚无在册工役。' : '本剧本未设营造。' };
  }
  return {
    key: c.key, name: c.label, owner: ownerLabel, ownerKey: viewer.owner, player: viewer.player,
    members: c.members.length, capital: capital ? link(capital) : null, held: own.length, of: c.members.length,
    desc: String(first(profile.description, profile.note) || ''),
    official: officialOf(p, profile, own, sum, c, viewer),
    band: [
      { k: '户口', v: n(sum.population), subPre: '丁', subN: n(sum.ding) },
      { k: '实征', v: n(sum.actualRevenue), subPre: '起运', subN: n(sum.remittedToCenter) },
      { k: '驻军', v: own.length ? own.reduce((s, r) => s + (garrisonOf(r, p.regionBundle(r)).v || 0), 0) : n(sum.troops), subPre: '', subN: n(sum.garrisoned), subPost: '州有驻' },
      sum.mood != null ? { k: '民心', v: n(sum.mood), sub: moodG.mark || '', warn: !!p.gradeIsWarn('mood', moodG) } : null,
      sum.office != null ? { k: '吏治', v: n(sum.office), sub: offG.mark || '', warn: !!p.gradeIsWarn('office', offG) } : null
    ].filter((x) => x && x.v != null),
    xiajing, xingshi, caiji, yingzao,
    acts: viewer.player ? CIRCUIT_ACTS : [],
    canReassign: viewer.player && !!(w.TM && w.TM.DivisionReassign)
  };
}
function officialOf(p, profile, own, sum, c, viewer) {
  const g = G();
  const gv = w.TM && w.TM.CircuitGovernance;
  const subs = own.every((r) => !!(p.regionBundle(r).data || {}).governorUnrecorded) ? '下辖各州主官均未载姓名' : '下辖各州主官见各州方志';
  const gov = gv && typeof gv.governorOf === 'function' ? gv.governorOf(g, c, viewer.owner) : null;
  if (!gov) {
    if (!has(profile.officialPosition) && !has(profile.title)) return null;
    return { role: String(first(profile.officialPosition, profile.title, '长官')), who: String(first(profile.governor, '未录')), count: sum.count, line: subs };
  }
  const dr = w.TM && w.TM.DivisionReassign;
  const admin = dr && typeof dr.circuitAdminNode === 'function' ? dr.circuitAdminNode(g, c.key, viewer.owner) : null;
  const role = gov.status === 'note' ? gov.note : String(first(gov.position && gov.position.name, admin ? admin.officialPosition : profile.officialPosition, '长官'));
  const who = gov.status === 'note' ? gov.noteDetail || gov.note : gov.status === 'vacant' ? '出缺' : gov.status === 'unbound' ? '未设主官' : gov.holderName;
  const out = { role, who: String(who || ''), isChar: ['serving', 'travelling'].includes(gov.status) && !!gov.holderName, count: gov.status === 'note' ? null : sum.count, line: gov.status === 'note' ? '本道无单一主官，不计长官之效' : subs };
  if (gov.status === 'serving' || gov.status === 'travelling') {
    const md = p.getMapData ? p.getMapData() : null;
    const seat = gov.seatRegionId && md && md.regions ? md.regions.find((r) => String(r.id) === gov.seatRegionId) : null;
    out.ability = Math.round(gov.ability);
    out.band = { high: '称职', mid: '平平', low: '失职' }[gov.band] || '';
    out.state = gov.status === 'travelling' ? `赴任·余${gov.travelDaysLeft}日` : '在任';
    out.seat = seat ? p.regionTitle(seat) : '';
  }
  if (gov.status !== 'note' && gov.status !== 'unbound') {
    const fxe = w.TM && w.TM.CircuitGovernorEffects;
    const crow = g.circuitGovernance && g.circuitGovernance.byCircuit[c.key];
    const signed = (v, percent) => `${v >= 0 ? '+' : '−'}${Math.abs(v * (percent ? 100 : 1)).toFixed(1)}${percent ? '%' : ''}`;
    out.effect = fxe && !fxe.enabled() ? '设置中已关闭' : gov.status === 'travelling' ? '赴任未到，暂无长官之效' : crow && crow.status === 'seatLost' ? '首府不在本方，暂无长官之效'
      : !crow ? '下一回合起生效' : `执行率均${signed(crow.execAvg || 0, true)} · 吏治每月${signed(crow.corrMonthly || 0, false)}（近驻地，远者递减）`;
  }
  return out;
}
// 调整辖区（照老 circuitReassignPanel）：划出——本道本方各州可改隶到接壤的本方别道（首府不可动，由 movable 判）；
// 划入——与本道接壤、同属本方、今隶别道且可动的州。选定一条即录入议事清册（reassign）
export function circuitReassignOptions(key) {
  const p = P8();
  const MC = w.TM && w.TM.MapCircuits;
  const dr = w.TM && w.TM.DivisionReassign;
  if (!p || !MC || !dr || typeof p.findCircuit !== 'function') return { ok: false, reason: '改隶未就绪' };
  const c = p.findCircuit(String(key));
  if (!c) return { ok: false, reason: '此道未在舆图上' };
  const run = typeof p.withRenderBatch === 'function' ? p.withRenderBatch : (fn) => fn();
  return run(() => {
    const viewer = viewerOf(p, c, null);
    if (!viewer.player) return { ok: false, reason: '他方之道，不可调整' };
    const own = MC.partitionByOwner(c, viewer.owner).own;
    const idOf = (r) => String(r.id || r.name || '');
    const ownIds = new Set(own.map(idOf));
    const out = own.map((r) => {
      const m = dr.movable(r, {});
      if (!m || !m.ok) return null;
      const targets = (dr.targetsFor(r, {}) || []).filter((t) => t.adjacent).map((t) => ({ key: t.key, label: t.label }));
      return targets.length ? { id: idOf(r), name: p.regionTitle(r), targets } : null;
    }).filter(Boolean);
    const seen = new Set(), into = [];
    own.forEach((r) => (Array.isArray(r.neighbors) ? r.neighbors : []).forEach((nb) => {
      const x = p.findRegion(nb);
      const xid = x ? idOf(x) : '';
      if (!x || seen.has(xid) || ownIds.has(xid) || p.canonicalOwnerKey(x) !== p.canonicalOwnerKey(r)) return;
      seen.add(xid);
      const m = dr.movable(x, {});
      if (!m || !m.ok || !m.from || m.from.key === c.key) return;
      into.push({ id: xid, name: p.regionTitle(x), from: m.from.label });
    }));
    return { ok: true, key: c.key, name: c.label, out, into };
  });
}
export function circuitAct(key, kind) {
  const p = P8();
  if (!p || typeof p.circuitAction !== 'function') throw new Error('内核缺通志动作');
  const ok = p.circuitAction(String(key), kind);
  if (ok) bus.emit('game:changed', { what: 'edict-suggestion' });
  return ok;
}

// ---------- 版图（谱牒版图卷） ----------
// 某势力已据的府州按正式省道收拢，每道汇总户口与民心、吏治（据奏评分），未设省道的另列——与老谱牒版图卷同法，
// 但省道索引自建一次（老 findCircuit 每查一州都重算索引签名，一百多州要一秒）。本方另出区划预警：
// 全境各州问题轻重（民心、吏治落警档、灾异、民变），通国皆有的提出来说一次，余者取最重的十州
export function bantu(f, key, withAlerts) {
  const p = P8();
  const MC = w.TM && w.TM.MapCircuits;
  const map = p && p.getMapData ? p.getMapData() : null;
  if (!p || !map || !Array.isArray(map.regions) || typeof p.factionOwnsRegion !== 'function') return null;
  const run = typeof p.withRenderBatch === 'function' ? p.withRenderBatch : (fn) => fn();
  return run(() => {
    const ownKey = f.stableOwnerKey || f.mapFactionId || f.id || key;
    const mine = map.regions.filter((r) => p.factionOwnsRegion(r, ownKey, f));
    if (!mine.length) return null;
    const link = (r) => ({ id: r.id || r.name, name: p.regionTitle(r) });
    let index = null;
    if (MC && w.TMMapRealmLayout) {
      const owners = new Map(), memo = new Map();
      map.regions.forEach((r) => {
        const k = JSON.stringify([p.ownerKey(r), (r && (r.factionName || r.ownerName)) || '']);
        if (!owners.has(k)) owners.set(k, p.canonicalOwnerKey(r));
        memo.set(r, owners.get(k));
      });
      index = MC.indexCircuits(map, { layout: w.TMMapRealmLayout, ownerOf: (r) => memo.get(r) });
    }
    const byKey = new Map(), none = [], circuitOfRegion = new Map();
    mine.forEach((r) => {
      const c = index ? MC.circuitOf(index, r) : null;
      if (!c || !MC.isRealCircuit(c)) { none.push(r); return; }
      if (!byKey.has(c.key)) byKey.set(c.key, { c, regions: [] });
      byKey.get(c.key).regions.push(r);
      circuitOfRegion.set(r, c.label);
    });
    const grade = (mode, v) => { const g = v == null ? null : p.gradeOf(mode, v) || {}; return { mark: (g && g.mark) || '', warn: !!(g && p.gradeIsWarn(mode, g)) }; };
    const groups = [...byKey.values()].map(({ c, regions }) => {
      const sum = MC.summarize(regions, { bundle: p.regionBundle, mood: p.moodViewScore, office: p.officeViewScore });
      const mg = grade('mood', sum.mood), og = grade('office', sum.office);
      return { key: c.key, label: c.label, held: regions.length, of: c.members.length, pop: n(sum.population), tax: n(sum.actualRevenue),
        mood: n(sum.mood), moodMark: mg.mark, moodWarn: mg.warn, office: n(sum.office), officeMark: og.mark, officeWarn: og.warn,
        regions: regions.map(link) };
    }).sort((a, b) => (b.pop || 0) - (a.pop || 0) || String(a.label).localeCompare(String(b.label), 'zh-CN'));
    let alerts = null;
    if (withAlerts && MC) {
      const ranked = MC.rankProblems(mine, {
        score: p.modeScore, grade: p.gradeOf, isWarn: p.gradeIsWarn,
        statusOf: (r) => { const b = p.regionBundle(r); return (b.liveDivision && b.liveDivision.statusEffects) || []; },
        unrestOf: (r) => { const b = p.regionBundle(r), d = b.data || {}; return first(d.unrest, b.liveDivision && b.liveDivision.unrest); }
      });
      const lifted = MC.liftCommonProblems(ranked, { populationOf: (r) => { const b = p.regionBundle(r); return first((b.data || {}).population, b.pop && b.pop.mouths); } });
      const rows = lifted.rows.filter((rw) => rw.score > 0 && rw.reasons && rw.reasons.length);
      alerts = {
        common: lifted.common.map((x) => x.label + (x.mark ? ` ${x.mark}` : '')),
        rows: rows.slice(0, 10).map((rw) => ({ ...link(rw.region), circuit: circuitOfRegion.get(rw.region) || '', reasons: rw.reasons })),
        more: Math.max(0, rows.length - 10)
      };
    }
    return { count: mine.length, groups, none: none.map(link), alerts };
  });
}

// ---------- 地方账本（方志「账」卷） ----------
// 照老「地方账本」（tm-endturn-province.js openDivisionDetail）取四段，不用其 HTML：
//   赋税核算——CascadeTax.previewRevenue 按现行税则与征收损耗预计本地各税一年的名义、上解、留用（钱粮布分计）；
//   公库三账——存、额、亏、本回合出入，掌库与交接；本回合实绩——在编田亩、名义已征、实征、上解与上回合比；在灾实录。
// 老账本另有户龄结构、承载力完整账、田亩诚实账（不经奏报的底账）与按粗估公式的经费核算（摆样的估数），新界面不列。
// 财赋诸数与财赋志同口径（奏报失真层不及地方钱粮）
const DISASTER = { drought: '旱', flood: '水', plague: '瘟', locust: '蝗', earthquake: '震', cold: '寒' };
export function ledger(id) {
  const p = P8();
  const r = regionOf(id);
  const div = r && p && typeof p.findLiveAdminDivision === 'function' ? p.findLiveAdminDivision(r) : null;
  if (!div) return null;
  const g = G();
  let U = { money: '两', grain: '石', cloth: '匹' };
  try { if (w.CurrencyUnit && w.CurrencyUnit.getUnit) U = { ...U, ...w.CurrencyUnit.getUnit() }; } catch (_e) { /* 照默认 */ }
  const num0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

  let taxes = null;
  const CT = w.CascadeTax;
  if (CT && typeof CT.previewRevenue === 'function' && g.fiscalConfig && g.fiscalConfig.productionTaxVersion) {
    let f = null;
    try { f = CT.previewRevenue({ game: g, division: div }); } catch (e) { console.warn('[newui] 赋税预计失败', e); }
    if (f && Array.isArray(f.regions)) {
      const by = new Map();
      f.regions.forEach((rg) => (rg.taxes || []).forEach((t) => {
        let x = by.get(t.id);
        if (!x) by.set(t.id, x = { name: String(t.name || t.id), resource: t.resource, nominal: 0, central: 0, local: 0, base: 0,
          baseUnit: t.productionTax && t.productionTax.quantityUnit, assessed: t.taxBasePolicy === 'retained-assessment' });
        x.nominal += num0(t.nominal); x.central += num0(t.central); x.local += num0(t.local); x.base += num0(t.baseValue);
      }));
      const rows = [...by.values()].filter((x) => x.nominal > 0 || x.central > 0 || x.local > 0).map((x) => {
        const baseUnit = x.baseUnit === '本位钱' ? U.money : x.baseUnit || (x.assessed ? U[x.resource] : '');
        return { name: x.name, unit: U[x.resource] || '', nominal: Math.round(x.nominal), central: Math.round(x.central), local: Math.round(x.local),
          base: baseUnit ? Math.round(x.base) : null, baseUnit, baseKind: x.baseUnit ? '税基' : '账额' };
      });
      const total = ['money', 'grain', 'cloth'].map((k) => ({ unit: U[k], central: Math.round([...by.values()].filter((x) => x.resource === k).reduce((s, x) => s + x.central, 0)) })).filter((x) => x.central > 0);
      if (rows.length) taxes = { rows, total };
    }
  }

  let treasury = null;
  const pt = div.publicTreasury;
  if (pt && typeof pt === 'object') {
    const books = [['money', '银账'], ['grain', '粮账'], ['cloth', '布账']].map(([k, label]) => {
      const led = pt[k];
      if (!led) return null;
      const stock = num0(led.stock), quota = num0(led.quota);
      return { label, unit: U[k], stock, quota: quota || null, fill: quota > 0 ? Math.min(100, Math.round(stock / quota * 100)) : null,
        deficit: num0(led.deficit) || null, inflow: num0(led.inflowThisTurn || led.inflow) || null, outflow: num0(led.outflowThisTurn || led.outflow) || null };
    }).filter(Boolean);
    if (books.length) treasury = { books, head: String(pt.currentHead || ''), prev: String(pt.previousHead || ''), handovers: Array.isArray(pt.handoverLog) ? pt.handoverLog.length : 0 };
  }

  const achieve = [];
  const land = div._thisTurnLandFlow;
  if (land && land.before !== land.after) {
    const d = num0(land.after) - num0(land.before);
    achieve.push({ label: '在编田亩', before: num0(land.before), after: num0(land.after), unit: '亩', note: num0(land.surveyed) > 0 ? '清丈复田' : d > 0 ? '开垦增田' : '兼并失田' });
  }
  const lt = div._lastTurnFiscal, fis = div.fiscal || {};
  if (lt) {
    [['claimedRevenue', '名义已征'], ['actualRevenue', '实征到账'], ['remittedToCenter', '上解中央']].forEach(([k, label]) => {
      if (fis[k] == null || num0(fis[k]) === num0(lt[k])) return;
      achieve.push({ label, before: num0(lt[k]), after: num0(fis[k]), unit: U.money, note: '' });
    });
  }
  achieve.forEach((a) => { a.delta = a.after - a.before; a.pct = a.before > 0 ? Math.round(a.delta / a.before * 1000) / 10 : null; });

  const eb = div.economyBase || {};
  const disasters = (Array.isArray(eb.disasterRecord) ? eb.disasterRecord : []).map((rec) => {
    const sev = num0(rec.severity) || 1;
    return { kind: DISASTER[rec.type] || String(rec.type || '灾'), sev: sev >= 3 ? '重' : sev >= 2 ? '中' : '轻', since: rec.startTurn != null ? num0(rec.startTurn) : null, note: String(rec.note || '') };
  });
  const der = div._disasterEconomyReduce;
  const loss = der && (num0(der.farmland) > 0 || num0(der.commerceVolume) > 0) ? { farm: Math.round(num0(der.farmland) * 100), trade: Math.round(num0(der.commerceVolume) * 100) } : null;

  return { taxes, treasury, achieve, disasters, loss, firstTurn: !lt && !land };
}
