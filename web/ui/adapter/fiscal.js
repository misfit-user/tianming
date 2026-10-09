// 财计（书目「财」）：帑廪（国库）与内帑的银粮布三账——库存、本期收支、收支名目分项、欠项；户口（全国与各省，汇总叶子）；
// 户部条陈与借贷。规矩照现行老面板：加派、开仓赈济拟入议事清册，下旨方生效（「户部财计·诏书驱动」）；
// 借贷、减重改铸、财政改革由引擎当场办（GuokuEngine）。两库互拨、大典也拟入清册。
// 可见之律：奏报失真层开着时，帑廪三库存与银的本期收支照顶栏同一口径据奏（内核 _barReported：库藏、岁入报多，岁支报少），
// 收支名目按比例随之缩放，免得分项之和露出真数；内帑是天子私账，不设失真。历年收支（history）是真账，失真层开着时不列。
import { bus } from '../core/bus.js';

const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
function call(name, ...args) {
  const f = fn(name);
  if (!f) throw new Error('内核缺 ' + name);
  return f(...args);
}
const changed = (what) => bus.emit('game:changed', { what });
export const RES = [['money', '银'], ['grain', '粮'], ['cloth', '布']];

// ---------- 账 ----------
function labels() {
  const FS = w.FiscalStatement;
  try { return FS && FS.labels ? { inn: FS.labels('central', 'in') || {}, out: FS.labels('central', 'out') || {} } : { inn: {}, out: {} }; } catch (_e) { return { inn: {}, out: {} }; }
}
function rows(map, names) {
  return Object.entries(map || {}).map(([k, v]) => ({ key: k, label: names[k] || k, amount: num(v) })).filter((r) => r.amount).sort((a, b) => b.amount - a.amount);
}
function ledgerView(l, L) {
  l = l || {};
  const deficits = [];
  for (const [k, list] of Object.entries(l.deficitDetails || {})) for (const d of Array.isArray(list) ? list : []) deficits.push({ kind: L.out[k] || k, name: String(d.name || ''), amount: num(d.amount) });
  deficits.sort((a, b) => b.amount - a.amount);
  return {
    stock: num(l.stock, num(l.available)), inn: num(l.thisTurnIn), out: num(l.thisTurnOut), lastIn: num(l.lastTurnIn), lastOut: num(l.lastTurnOut), quota: num(l.quota) || null,
    sources: rows(l.sources, L.inn), sinks: rows(l.sinks, L.out), deficit: num(l.deficit), deficits
  };
}
function reported(key, val, dir) {
  const f = fn('_barReported');
  if (!f) return { shown: val, distorted: false };
  try { const r = f(key, val, dir); return { shown: num(Number(r && r.shown), val), distorted: !!(r && r.distorted) }; } catch (_e) { return { shown: val, distorted: false }; }
}
function scaleRows(list, k) { return k === 1 ? list : list.map((x) => ({ ...x, amount: x.amount * k })); }
// 帑廪据奏：库存三项；银的本期收支与名目、上期收支同比例
function reportGuoku(res) {
  let distorted = false;
  const out = res.map((r) => {
    const st = reported(`guoku.${r.key}`, r.stock, 'good');
    distorted = distorted || st.distorted;
    if (r.key !== 'money') return { ...r, stock: st.shown };
    const ri = reported('fiscal.turnIncome', r.inn, 'good'), ro = reported('fiscal.turnExpense', r.out, 'bad');
    distorted = distorted || ri.distorted || ro.distorted;
    const ki = r.inn ? ri.shown / r.inn : 1, ko = r.out ? ro.shown / r.out : 1;
    return { ...r, stock: st.shown, inn: ri.shown, out: ro.shown, lastIn: r.lastIn * ki, lastOut: r.lastOut * ko, sources: scaleRows(r.sources, ki), sinks: scaleRows(r.sinks, ko) };
  });
  return { res: out, distorted };
}
// kind：guoku 帑廪 ／ neitang 内帑
export function account(kind) {
  const g = G();
  const L = labels();
  let acc = kind === 'neitang' ? g.neitang : g.guoku;
  let forecast = false, unit = null;
  if (kind === 'guoku' && fn('_guokuReadDisplayModel') && acc) {
    try { const m = w._guokuReadDisplayModel(g, acc); acc = m.account || acc; forecast = !!m.forecast; unit = m.unit || null; } catch (_e) { /* 读数模型出错就读原账 */ }
  }
  if (!acc) return null;
  unit = unit || acc.unit || { money: '两', grain: '石', cloth: '匹' };
  const led = acc.ledgers || {};
  const res = RES.map(([k, label]) => ({ key: k, label, unit: unit[k] || '', ...ledgerView(led[k], L) }));
  if (kind !== 'guoku') return { kind, forecast, unit, res, distorted: false };
  const rv = reportGuoku(res);
  return { kind, forecast, unit, res: rv.res, distorted: rv.distorted };
}
// 帑廪收支史：近十二期（每期收、支、净、期末库银）与近五年决算。失真层开着则封存（sealed）
export function history() {
  const g = G();
  const hist = (g.guoku && g.guoku.history) || {};
  const RV = w.TM && w.TM.ReportedView;
  let sealed = false;
  try { sealed = !!(RV && RV.active(w.P || null) && !RV.revealed('fiscal', 'history')); } catch (_e) { sealed = false; }
  if (sealed) return { sealed: true, months: [], years: [] };
  const months = (Array.isArray(hist.monthly) ? hist.monthly : []).slice(-12).map((m) => {
    const inn = num(m.periodIncome, num(m.income)), out = num(m.periodExpense, num(m.expense));
    return { turn: num(m.turn), inn, out, net: inn - out, balance: num(m.balance) };
  });
  const years = (Array.isArray(hist.yearly) ? hist.yearly : []).slice(-5).reverse().map((y) => ({
    year: num(y.year), inn: num(y.totalIncome), out: num(y.totalExpense), net: num(y.netChange), balance: num(y.finalBalance), bankrupt: num(y.bankruptcyMonths),
    regions: y.byRegion && typeof y.byRegion === 'object' ? Object.keys(y.byRegion).map((k) => ({ name: String(y.byRegion[k].name || k), inn: num(y.byRegion[k].cumIn), out: num(y.byRegion[k].cumOut), net: num(y.byRegion[k].net) })).sort((a, b) => b.net - a.net).slice(0, 8) : []
  }));
  return { sealed: false, months, years };
}
// 在借款项与可借之源
export function loans() {
  const g = G();
  const list = ((g.guoku && g.guoku.emergency && g.guoku.emergency.loans) || []).map((x) => ({
    source: x.sourceName || '', principal: num(x.principal), rate: num(x.interestRate), monthly: num(x.principal) * (1 / (num(x.totalTerm) || 12) + num(x.interestRate)),
    left: Math.round(num(x.monthsLeft)), term: num(x.totalTerm)
  }));
  const S = (w.GuokuEngine && w.GuokuEngine.LOAN_SOURCES) || {};
  const sources = Object.entries(S).map(([id, s]) => ({ id, name: s.name || id, rate: num(s.interest), max: num(s.maxAmount), note: String(s.historical || ''), foreign: id === 'foreignLoan' }));
  return { list, sources };
}
export function takeLoan(sourceId, amount, term) {
  const A = w.GuokuEngine && w.GuokuEngine.Actions;
  if (!A || typeof A.takeLoanBySource !== 'function') throw new Error('内核缺 GuokuEngine.Actions.takeLoanBySource');
  const r = A.takeLoanBySource(sourceId, amount, term);
  changed('fiscal');
  return r || { success: false };
}

// ---------- 户口 ----------
export function census() {
  const g = G();
  let nat = null;
  try { nat = w.HujiEngine && typeof w.HujiEngine.getPopulationView === 'function' ? w.HujiEngine.getPopulationView({ root: g }) : null; } catch (_e) { nat = null; }
  const n = (nat && (nat.national || nat)) || (g.population && g.population.national) || {};
  const meta = (g.population && g.population.meta) || (nat && nat.meta) || {};
  // 各省：顶层区划下所有叶子的户口相加（省级自带的数往往是开局旧账）
  const ah = (g.adminHierarchy && g.adminHierarchy.player) || null;
  const provinces = [];
  const leafSum = (d, acc) => {
    const kids = d.children || d.divisions || [];
    if (kids.length) { kids.forEach((k) => leafSum(k, acc)); return acc; }
    const pd = d.populationDetail || {};
    acc.households += num(pd.households); acc.mouths += num(pd.mouths, typeof d.population === 'number' ? d.population : 0); acc.ding += num(pd.ding);
    acc.fugitives += num(pd.fugitives); acc.hidden += num(pd.hiddenCount); acc.leaves++;
    const mx = typeof d.minxinLocal === 'object' && d.minxinLocal ? num(d.minxinLocal.value) : num(d.minxinLocal, NaN);
    const co = typeof d.corruptionLocal === 'object' && d.corruptionLocal ? num(d.corruptionLocal.value) : num(d.corruptionLocal, NaN);
    if (Number.isFinite(mx)) { acc.mx += mx * num(pd.mouths, 1); acc.mxW += num(pd.mouths, 1); }
    if (Number.isFinite(co)) { acc.co += co * num(pd.mouths, 1); acc.coW += num(pd.mouths, 1); }
    return acc;
  };
  for (const d of (ah && ah.divisions) || []) {
    if (!d) continue;
    const a = leafSum(d, { households: 0, mouths: 0, ding: 0, fugitives: 0, hidden: 0, leaves: 0, mx: 0, mxW: 0, co: 0, coW: 0 });
    provinces.push({ name: d.name || '', households: a.households, mouths: a.mouths, ding: a.ding, fugitives: a.fugitives, hidden: a.hidden, leaves: a.leaves,
      minxin: a.mxW ? Math.round(a.mx / a.mxW) : null, lizhi: a.coW ? Math.round(100 - a.co / a.coW) : null });
  }
  provinces.sort((a, b) => b.mouths - a.mouths);
  return {
    households: num(n.households), mouths: num(n.mouths), ding: num(n.ding), fugitives: num(n.fugitives), hidden: num(n.hiddenCount),
    accuracy: meta.registrationAccuracy != null ? num(meta.registrationAccuracy) : null, provinces
  };
}

// ---------- 条陈 ----------
// 拟入议事清册（同老面板 _guoku_draftFiscalEdict：source 户部；顺带记一笔玩家意向信号）
export function draftEdict(text) {
  call('_guoku_draftFiscalEdict', text);
  changed('edict-suggestion');
}
export const MEASURES = {
  extraTax: [[0.2, '薄赋加派（二成）', '民心 -3 · 腐败 +2'], [0.5, '五成加派', '民心 -7 · 腐败 +5'], [1.0, '三饷式加派（十成）', '民心 -15 · 末世之兆']],
  granary: [['county', '州县赈济', '约五万两 · 民心 +3'], ['regional', '一省大赈', '约十五万两 · 民心 +8'], ['national', '普天大赈', '约五十万两 · 民心 +15']],
  coin: [[0.1, '减重一成（小调）', '获二至四月之入 · 通胀 +0.05 · 皇威 -1'], [0.2, '减重二成（常策）', '获五至八月之入 · 通胀 +0.1 · 皇威 -3 · 民心 -2'], [0.4, '减重四成（险策）', '获十至十五月之入 · 通胀 +0.2 · 皇威 -6 · 民心 -4']]
};
export function extraTax(rate) { call('_guoku_doExtraTax', rate); changed('edict-suggestion'); }
export function granary(scale) { call('_guoku_doOpenGranary', scale); changed('edict-suggestion'); }
export function lightCoin(rate) {
  const M = w.GuokuEngine && w.GuokuEngine.MintingActions;
  if (!M || typeof M.lightCoining !== 'function') throw new Error('内核缺 GuokuEngine.MintingActions.lightCoining');
  const r = M.lightCoining(rate);
  changed('fiscal');
  return r;
}
// 财政改革：两税、方田均税、一条鞭、摊丁入亩……
export function reforms() {
  const R = (w.GuokuEngine && w.GuokuEngine.FISCAL_REFORMS) || {};
  const done = (G().guoku && (G().guoku.reforms || G().guoku.enactedReforms)) || {};
  return Object.entries(R).map(([id, r]) => {
    const eff = r.effects || {};
    return { id, name: r.name || id, desc: String(r.desc || r.description || ''), era: r.dynasty || r.era || '', enacted: !!(done[id] || (Array.isArray(done) && done.includes(id))),
      effects: Object.entries(eff).map(([k, v]) => `${k} ${typeof v === 'number' && v > 0 ? '+' : ''}${v}`).slice(0, 6) };
  });
}
export function enactReform(id) {
  if (!w.GuokuEngine || typeof w.GuokuEngine.enactReform !== 'function') throw new Error('内核缺 GuokuEngine.enactReform');
  const r = w.GuokuEngine.enactReform(id);
  changed('fiscal');
  return r || { success: false };
}

// 宫中条陈：两库互拨、大典（老内帑面板已改为写诏，这里拟入议事清册）
export const TRANSFER_AMOUNTS = [50000, 100000, 300000, 500000];
export const CEREMONIES = [['minor', '郊祀常礼'], ['middle', '千叟宴·大飨'], ['major', '封禅·万寿']];
const wan = (n) => `${n >= 10000 ? n / 10000 + '万' : n}两`;
export function transferDraft(direction, amount) {
  draftEdict(direction === 'toPalace'
    ? `着户部自帑廪拨银${wan(amount)}入内帑，以备宫中支用。`
    : `发内帑银${wan(amount)}充国用，以济军需，户部依数收讫。`);
}
export function ceremonyDraft(type) {
  const name = (CEREMONIES.find(([k]) => k === type) || [, '大典'])[1];
  draftEdict(`择吉举行${name}，所需由内帑支给，礼部会同内府具仪以闻。`);
}
