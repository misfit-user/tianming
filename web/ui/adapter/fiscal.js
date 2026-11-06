// 财计（书目「财」）：帑廪（国库）与内帑的银粮布三账——库存、本期收支、收支名目分项、欠项；户口（全国与各省，汇总叶子）；
// 户部条陈与借贷。规矩照现行老面板：加派、开仓赈济拟入议事清册，下旨方生效（「户部财计·诏书驱动」）；
// 借贷、减重改铸、财政改革由引擎当场办（GuokuEngine）。两库互拨、大典也拟入清册。
// 可见之律：奏报失真层开着时，帑廪三库存与银的本期收支照顶栏同一口径据奏（内核 _barReported：库藏、岁入报多，岁支报少），
// 收支名目按比例随之缩放，免得分项之和露出真数；内帑是天子私账，不设失真。历年收支（history）是真账，失真层开着时不列。
import { bus } from '../core/bus.js';
import { money } from './currency.js';

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
export { money };
const resources = () => [['money', money().noun], ['grain', '粮'], ['cloth', '布']];

// ---------- 账 ----------
function labels(kind) {
  const FS = w.FiscalStatement;
  const scope = kind === 'neitang' ? 'internal' : 'central';
  try { return FS && FS.labels ? { inn: FS.labels(scope, 'in') || {}, out: FS.labels(scope, 'out') || {} } : { inn: {}, out: {} }; } catch (_e) { return { inn: {}, out: {} }; }
}
// 名目下的细目（结账后才有）。开局那条「尚待具分目」是占位，不算细目
function detailRows(list) {
  return (Array.isArray(list) ? list : []).filter((d) => d && d.id !== 'unitemized').map((d) => ({ name: String(d.name || d.label || ''), amount: num(d.amount) })).filter((d) => d.name && d.amount).sort((a, b) => b.amount - a.amount);
}
// 支出账 sinks 按中文名记（军饷），细目却按键记（junxiang）：两边都认
function detailsOf(details, names, k) {
  if (!details) return [];
  if (details[k]) return detailRows(details[k]);
  const key = Object.keys(names).find((x) => names[x] === k);
  return key ? detailRows(details[key]) : [];
}
function rows(map, names, details) {
  // 「军饷_欠」是欠账记号，没有真花出去，不算进支用
  return Object.entries(map || {}).filter(([k]) => !/_欠$/.test(k)).map(([k, v]) => ({ key: k, label: names[k] || k, amount: num(v), details: detailsOf(details, names, k) })).filter((r) => r.amount).sort((a, b) => b.amount - a.amount);
}
function ledgerView(l, L) {
  l = l || {};
  const deficits = [];
  for (const [k, list] of Object.entries(l.deficitDetails || {})) for (const d of Array.isArray(list) ? list : []) deficits.push({ kind: L.out[k] || k, name: String(d.name || ''), amount: num(d.amount) });
  deficits.sort((a, b) => b.amount - a.amount);
  return {
    stock: num(l.stock, num(l.available)), inn: num(l.thisTurnIn), out: num(l.thisTurnOut), quota: num(l.quota) || null,
    sources: rows(l.sources, L.inn, l.sourceDetails), sinks: rows(l.sinks, L.out, l.sinkDetails), deficit: num(l.deficit), deficits
  };
}
function reported(key, val, dir, domain) {
  const f = fn('_barReported');
  if (!f) return { shown: val, distorted: false };
  try { const r = f(key, val, dir, domain); return { shown: num(Number(r && r.shown), val), distorted: !!(r && r.distorted) }; } catch (_e) { return { shown: val, distorted: false }; }
}
const flipped = (domain) => { const f = fn('_barFlipToPerceived'); try { return !!(f && f(domain, 'index')); } catch (_e) { return false; } };
// 细目一起缩放：分项之和、细目之和都不许露出真数
function scaleRows(list, k) { return k === 1 ? list : list.map((x) => ({ ...x, amount: x.amount * k, details: x.details.map((d) => ({ ...d, amount: d.amount * k })) })); }
// 帑廪据奏：库存三项；银的本期收支与名目同比例
// 不读 lastTurnIn/Out：内核各引擎写法不一（多半是刚结的这一期、且只记一部分），当「上期」会说错
function reportGuoku(res) {
  let distorted = false;
  const out = res.map((r) => {
    const st = reported(`guoku.${r.key}`, r.stock, 'good');
    distorted = distorted || st.distorted;
    if (r.key !== 'money') return { ...r, stock: st.shown };
    const ri = reported('fiscal.turnIncome', r.inn, 'good'), ro = reported('fiscal.turnExpense', r.out, 'bad');
    distorted = distorted || ri.distorted || ro.distorted;
    const ki = r.inn ? ri.shown / r.inn : 1, ko = r.out ? ro.shown / r.out : 1;
    return { ...r, stock: st.shown, inn: ri.shown, out: ro.shown, sources: scaleRows(r.sources, ki), sinks: scaleRows(r.sinks, ko) };
  });
  return { res: out, distorted };
}
// ---------- 细项 ----------
// 天启、绍宋不走统一预算，内核账上只有大类，这里补细项，都只读：
// 开局：税入读征收引擎的报价（只在副本上算），支出读内核写的本期预估（forecastFlow），都和账上总数同出一处。
// 结账后：账上有大类没细目。税读内核记的各州府实缴（_sourceContributors），一目多税的读报价；
//   军饷、俸禄读固定支出报价。差过千分之五就不列：不拿估算冒充实账。
const DRIFT = 0.005;
const LATIN = /^[\x00-\x7f]+$/;
const FLOW_NAME = { staticRemit: '定额上解' };
const clean = (t) => String(t).replace(/[（(].*$/, '').trim();
const sumOf = (list) => list.reduce((n, d) => n + d.amount, 0);
const agrees = (list, total) => list.length > 0 && Math.abs(sumOf(list) - total) <= Math.max(1, Math.abs(total) * DRIFT);
const ranked = (map) => Object.entries(map || {}).map(([name, v]) => ({ name, amount: num(v) })).filter((d) => d.amount >= 0.5).sort((a, b) => b.amount - a.amount);
const addTo = (map, key, v) => { map[key] = (map[key] || 0) + v; };

let quoted = null;
bus.on('game:changed', () => { quoted = null; });
// 报价一回合算一次（天启约 175 毫秒）；账动过就重算
function quotes() {
  const g = G();
  const key = [g.turn, g._lastCascadeTaxTurn, g._lastFixedExpenseTurn].join('|');
  if (quoted && quoted.g === g && quoted.key === key) return quoted;
  const perTurn = fn('_getDaysPerTurn');
  const days = perTurn ? perTurn() : 30;
  const tags = {};
  try {
    for (const region of w.CascadeTax.previewRevenue({ game: g, faction: 'player', turnDays: days }).regions) {
      for (const t of region.taxes) {
        const id = t.sourceTag || t.id;
        const k = `${t.resource}/${id}`;
        const tag = tags[k] || (tags[k] = { tag: id, resource: t.resource, amount: 0, taxes: {}, regions: {} });
        tag.amount += num(t.central);
        addTo(tag.taxes, t.name || t.id, num(t.central));
        addTo(tag.regions, region.name, num(t.central));
      }
    }
  } catch (err) { console.warn('[newui] 税入报价出错', err); }
  let fixed = null;
  try { fixed = w.FixedExpense.preview({ game: g, turnDays: days }); } catch (err) { console.warn('[newui] 固定支出报价出错', err); }
  quoted = { g, key, tags, fixed };
  return quoted;
}
// 内核认得的用内核的名；其余用这一目下的税名，多税同目写「某某等」，展开见全
function tagLabel(tag, resource, L, q) {
  if (L.inn[tag]) return L.inn[tag];
  const t = q.tags[`${resource}/${tag}`];
  if (t) {
    const names = Object.entries(t.taxes).sort((a, b) => b[1] - a[1]).map(([name]) => clean(name));
    if (names.length) return names.length > 1 ? `${names[0]}等` : names[0];
  }
  return LATIN.test(tag) ? FLOW_NAME[tag] || '其他名目' : tag;
}
function taxDetails(tag, resource, amount, q, settled) {
  const t = q.tags[`${resource}/${tag}`];
  const byTax = t ? ranked(t.taxes) : [];
  if (byTax.length > 1 && agrees(byTax, amount)) return byTax;
  const paid = settled && (G().guoku || {})._sourceContributors;
  const byPlace = paid && paid[tag] ? ranked(paid[tag]) : t ? ranked(t.regions) : [];
  return agrees(byPlace, amount) ? byPlace : [];
}
function fixedDetails(name, resource, amount, fixed) {
  if (!fixed) return [];
  const map = {};
  // override 是剧本写死的年额，没有逐军、逐署的数
  if (name === '军饷') for (const [k, v] of Object.entries(fixed._armyByArmy || {})) { if (k !== 'override') map[k] = v && v[resource]; }
  if (name === '俸禄' && resource === 'money') for (const [k, v] of Object.entries(fixed._salaryByDept || {})) { if (k !== 'override') map[k] = v; }
  const rows = ranked(map);
  return agrees(rows, amount) ? rows : [];
}
// 账户上常年分目是年额、钱粮合计，只拿比例分钱账这一本
function yearlyDetails(bag, key, amount, resource) {
  if (resource !== 'money') return [];
  const list = ((bag || {})[key] || []).filter((d) => d && d.id !== 'unitemized' && num(d.amount) > 0);
  const total = list.reduce((n, d) => n + num(d.amount), 0);
  return total ? list.map((d) => ({ name: String(d.name || d.label || ''), amount: amount * num(d.amount) / total })).filter((d) => d.name).sort((a, b) => b.amount - a.amount) : [];
}
const keyOfLabel = (names, label) => Object.keys(names).find((k) => names[k] === label);
function itemizeGuoku(r, forecast, acc, L) {
  const q = quotes();
  const withDetails = (x) => {
    if (x.details.length) return x;
    const own = fixedDetails(x.label, r.key, x.amount, q.fixed);
    return { ...x, details: own.length ? own : yearlyDetails(acc.expensesDetail, keyOfLabel(L.out, x.label), x.amount, r.key) };
  };
  if (!forecast) {
    r.sources = r.sources.map((x) => ({ ...x, label: tagLabel(x.key, r.key, L, q), details: x.details.length ? x.details : taxDetails(x.key, r.key, x.amount, q, true) }));
    r.sinks = r.sinks.map(withDetails);
    return;
  }
  const inn = Object.values(q.tags).filter((t) => t.resource === r.key && t.amount >= 0.5)
    .map((t) => ({ key: t.tag, label: tagLabel(t.tag, r.key, L, q), amount: t.amount, details: taxDetails(t.tag, r.key, t.amount, q, false) }))
    .sort((a, b) => b.amount - a.amount);
  if (agrees(inn, r.inn)) r.sources = inn;
  const flow = (acc.forecastFlow || {})[r.key];
  const out = flow ? rows(flow.out, {}).map(withDetails) : [];
  if (agrees(out, r.out)) r.sinks = out;
}
function itemizePrivy(r, acc, L, forecast) {
  const flow = forecast && acc.forecastFlow ? acc.forecastFlow[r.key] : null;
  if (flow) {
    r.sources = rows(flow.in, L.inn);
    r.sinks = rows(flow.out, L.out);
  } else if (forecast && w.FiscalEngine && w.FiscalEngine.readAccountStatement && w.CascadeTax.isUnified(G(), 'player')) {
    // 统一预算的内帑开局账本是空的，名目在内核报表里
    try {
      const led = (w.FiscalEngine.readAccountStatement({ game: G(), account: acc, scope: 'internal' }).account.ledgers || {})[r.key];
      if (led) { const v = ledgerView(led, L); r.sources = v.sources; r.sinks = v.sinks; }
    } catch (err) { console.warn('[newui] 内帑报表出错', err); }
  }
  r.sources = r.sources.map((x) => ({ ...x, details: x.details.length ? x.details : yearlyDetails(acc.sourcesDetail, x.key, x.amount, r.key) }));
  const names = labels('neitang').out;
  r.sinks = r.sinks.map((x) => ({ ...x, details: x.details.length ? x.details : yearlyDetails(acc.expensesDetail, keyOfLabel(names, x.label), x.amount, r.key) }));
}
// 开局拨存各署库待支钱物（晚唐有）：期初分割，不算收支，库中之数却要减这一笔。
// 还没拨，开局写「将拨存」；拨在哪一期，结账后那一期写「已拨存」；再往后不提
function heldOf(kind, forecast) {
  const api = w.TM && w.TM.PublicTreasury;
  let o = null;
  try { o = api && api.getOpeningAllocations ? api.getOpeningAllocations({ game: G() }) : null; } catch (_e) { o = null; }
  if (!o || !o.declared) return null;
  const rows = o.rows.filter((x) => x.from === kind);
  if (!rows.length) return null;
  const pending = rows.some((x) => !x.done);
  if (!pending && (forecast || o.turn == null || num(G().turn) !== num(o.turn) + 1)) return null;
  return { pending, names: rows.map((x) => x.name), amounts: pending ? o.pending[kind] : o.settled[kind] };
}
function withHeld(res, kind, forecast) {
  const h = heldOf(kind, forecast);
  return res.map((r) => ({ ...r, held: h ? num(h.amounts[r.key]) : 0, heldPending: !!(h && h.pending), heldNames: h ? h.names : [] }));
}
// kind：guoku 帑廪 ／ neitang 内帑
export function account(kind) {
  const g = G();
  const L = labels(kind);
  let acc = kind === 'neitang' ? g.neitang : g.guoku;
  let forecast = false, unit = null;
  if (kind === 'guoku' && fn('_guokuReadDisplayModel') && acc) {
    try { const m = w._guokuReadDisplayModel(g, acc); acc = m.account || acc; forecast = !!m.forecast; unit = m.unit || null; } catch (_e) { /* 读数模型出错就读原账 */ }
  }
  if (!acc) return null;
  unit = unit || acc.unit || { money: '两', grain: '石', cloth: '匹' };
  const led = acc.ledgers || {};
  const res = resources().map(([k, label]) => ({ key: k, label, unit: unit[k] || '', ...ledgerView(led[k], L) }));
  if (kind !== 'guoku') {
    // 内帑的账本结账才有本期收支；没结账时读预估，和顶栏（tm-topbar-vars）同一份数，不然顶栏说亏这里说零
    for (const r of res) {
      if (r.inn || r.out) continue;
      const s = r.key === 'money' ? '' : r.key === 'grain' ? 'Grain' : 'Cloth';
      const inn = num(acc[`turn${s}Income`]) || num(acc[`monthly${s}Income`]);
      const out = num(acc[`turn${s}Expense`]) || num(acc[`monthly${s}Expense`]);
      if (inn || out) { r.inn = inn; r.out = out; forecast = true; }
    }
    for (const r of res) itemizePrivy(r, acc, L, forecast);
    return { kind, forecast, unit, res: withHeld(res, kind, forecast), distorted: false };
  }
  if (!w.CascadeTax.isUnified(g, 'player')) for (const r of res) itemizeGuoku(r, forecast, acc, L);
  const rv = reportGuoku(res);
  return { kind, forecast, unit, res: withHeld(rv.res, kind, forecast), distorted: rv.distorted };
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
// 可见之律：失真层开着时，全国之数照顶栏同一口径据奏（renli 域 national.*，瞒减）；各省之数按全国据奏与真数之比缩放，
// 各省相加仍与全国对得上；各省民心、吏治是叶子真值加权，未揭时不列（据奏的分州民心、吏治见舆图）；黄册准确率亦不列
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
  // 逃户、隐户全国账上常是零而各州有数：全国没数就按各省合计，不然全国卡上没有逃户、下面各省却一片
  const sumOf = (key) => provinces.reduce((t, p) => t + p[key], 0);
  const raw = { households: num(n.households), mouths: num(n.mouths), ding: num(n.ding), fugitives: num(n.fugitives) || sumOf('fugitives'), hidden: num(n.hiddenCount) || sumOf('hidden') };
  const shown = {}, k = {};
  let distorted = false;
  for (const key of Object.keys(raw)) {
    const r = reported(`national.${key}`, raw[key], 'bad', 'renli');
    shown[key] = r.shown;
    k[key] = raw[key] ? r.shown / raw[key] : 1;
    distorted = distorted || r.distorted;
  }
  const mxHide = flipped('minxin'), coHide = flipped('corruption');
  const provs = provinces.map((p) => ({ ...p, households: p.households * k.households, mouths: p.mouths * k.mouths, ding: p.ding * k.ding, fugitives: p.fugitives * k.fugitives, hidden: p.hidden * k.hidden,
    minxin: mxHide ? null : p.minxin, lizhi: coHide ? null : p.lizhi }));
  return {
    ...shown, distorted, sealedMood: mxHide || coHide,
    accuracy: !distorted && meta.registrationAccuracy != null ? num(meta.registrationAccuracy) : null, provinces: provs
  };
}

// 一省落到地图上的哪一块（点省名翻通志用）：顺着下辖府州找第一个认得出的；认不出给 null
export function provinceRegion(name) {
  const L = w.TMMapLocations;
  const ah = G().adminHierarchy && G().adminHierarchy.player;
  const top = ((ah && ah.divisions) || []).find((d) => d && d.name === name);
  if (!L || !L.placeRegionIds || !top) return null;
  const walk = (d) => {
    for (const k of d.children || d.divisions || []) {
      const hit = k && walk(k);
      if (hit) return hit;
    }
    const ids = d.name ? L.placeRegionIds(d.name, G()) : [];
    return ids.length === 1 ? ids[0] : null;
  };
  return walk(top);
}

// ---------- 条陈 ----------
// 拟入议事清册（同老面板 _guoku_draftFiscalEdict：source 户部；顺带记一笔玩家意向信号）
export function draftEdict(text) {
  call('_guoku_draftFiscalEdict', text);
  changed('edict-suggestion');
}
export const MEASURES = {
  extraTax: [[0.2, '薄赋加派（二成）', '民心 -3 · 腐败 +2'], [0.5, '五成加派', '民心 -7 · 腐败 +5'], [1.0, '三饷式加派（十成）', '民心 -15 · 末世之兆']],
  // 单位跟朝代走，开局后才定得下来，所以现取
  get granary() {
    const { unit } = money();
    return [['county', '州县赈济', `约五万${unit} · 民心 +3`], ['regional', '一省大赈', `约十五万${unit} · 民心 +8`], ['national', '普天大赈', `约五十万${unit} · 民心 +15`]];
  },
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
// 第三项是约费，照 tm-neitang-engine 的 holdCeremony
export const CEREMONIES = [['minor', '郊祀常礼', 50000], ['middle', '千叟宴·大飨', 150000], ['major', '封禅·万寿', 500000]];
const wan = (n) => `${n >= 10000 ? n / 10000 + '万' : n}${money().unit}`;
export function transferDraft(direction, amount) {
  draftEdict(direction === 'toPalace'
    ? `着户部自帑廪拨${money().noun}${wan(amount)}入内帑，以备宫中支用。`
    : `发内帑${money().noun}${wan(amount)}充国用，以济军需，户部依数收讫。`);
}
export function ceremonyDraft(type) {
  const name = (CEREMONIES.find(([k]) => k === type) || [, '大典'])[1];
  draftEdict(`择吉举行${name}，所需由内帑支给，礼部会同内府具仪以闻。`);
}
