// 官制（书目「官」）：三廷（外朝、内朝、地方）分组的衙署、职位、员额、在任者；任命、改换、撤销、罢免、弹劾、廷推、门荫、荐贤。
// 结构权威 GM.officeTree（部门 { name, desc, positions[], subs[] }），路径同内核 getOffNode：[部门序, 's', 子部门序, …, 'p', 职位序]。
// 分廷分组用内核 _officeClassifyDept / _officeGetSubtabs；在任者用 _offAllHolderEntries / _offPositionStats。
// 任命、撤销、弹劾会往老诏书框 #edict-pol 加减一行（命某为某官……），新前端的诏书草稿推演前才写进那个框——
// 所以调这三件时先把草稿放进框里，调完再收回草稿，两边一致（withPolBox）。
import { bus } from '../core/bus.js';
import * as edict from './edict.js';

const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
function call(name, ...args) {
  const f = fn(name);
  if (!f) throw new Error('内核缺 ' + name);
  return f(...args);
}
const findChar = (name) => (fn('findCharByName') ? w.findCharByName(name) : (G().chars || []).find((c) => c && c.name === name)) || null;
const changed = (what) => bus.emit('game:changed', { what });

export const COURTS = [['central', '外朝'], ['inner', '内朝'], ['region', '地方']];
const classify = (d) => { const f = fn('_officeClassifyDept'); return f ? f(d) : { court: 'central', group: 'all' }; };
export function groups(court) {
  const f = fn('_officeGetSubtabs');
  const list = f ? f(court) : [{ key: 'all', name: '全部' }];
  return list.map((g) => ({ key: g.key, name: String(g.name || '').replace(/\s+/g, ''), note: g.desc || '' }));   // 老界面为排版在字间加了空格
}
const rankLevel = (r) => { const f = fn('getRankLevel'); return f && r ? f(r) : 99; };

// ---------- 读 ----------
function holderView(entry, pos) {
  const c = findChar(entry.name) || {};
  const travel = !!(c._travelTo && (c._travelAssignPost === pos.name || !c._travelAssignPost));
  return {
    name: entry.name, age: c.age || null, loyalty: Math.round(Number(c.loyalty) || 50),
    int: Math.round(Number(c.intelligence) || 0), adm: Math.round(Number(c.administration) || 0), mil: Math.round(Number(c.military) || 0),
    party: c.party || '', location: c.location || '', portrait: c.portrait || '', travel, dead: c.alive === false
  };
}
function positionView(pos, path, deptName) {
  const stats = fn('_offPositionStats') ? w._offPositionStats(pos) : { headCount: 1, actualCount: 0, vacant: 1 };
  const entries = fn('_offAllHolderEntries') ? w._offAllHolderEntries(pos) : (pos.holder ? [{ name: pos.holder }] : []);
  const pe = pos._pendingEdict && pos._pendingEdict.turn === G().turn ? pos._pendingEdict : null;
  return {
    path, dept: deptName, name: pos.name || '', rank: pos.rank || '', level: rankLevel(pos.rank), duties: String(pos.desc || pos.duties || ''),
    head: stats.headCount, actual: stats.actualCount, vacant: stats.vacant, unnamed: Math.max(0, stats.actualCount - entries.length),
    holders: entries.map((e) => holderView(e, pos)),
    pending: pe ? { line: pe.edictLine || '', from: pe.prevHolder || '', to: pe.newHolder || '' } : null
  };
}
function deptView(d, path) {
  const positions = (d.positions || []).map((p, j) => positionView(p, path.concat(['p', j]), d.name || ''));
  const subs = (d.subs || []).map((s, k) => deptView(s, path.concat(['s', k])));
  const sum = (key) => positions.reduce((n, p) => n + p[key], 0) + subs.reduce((n, s) => n + s.total[key], 0);
  return { path, name: d.name || '', desc: String(d.desc || ''), positions, subs, total: { head: sum('head'), actual: sum('actual'), vacant: sum('vacant') } };
}
// 某廷某组的衙署（顶层部门），附员额总数
export function departments(court, group = 'all') {
  const tree = G().officeTree || [];
  const out = [];
  tree.forEach((d, i) => {
    if (!d) return;
    const c = classify(d);
    if (c.court !== court || (group !== 'all' && c.group !== group)) return;
    const v = deptView(d, [i]);
    out.push({ path: [i], name: v.name, desc: v.desc, total: v.total });
  });
  return out;
}
export function department(path) {
  const d = (G().officeTree || [])[path[0]];
  return d ? deptView(d, [path[0]]) : null;
}

// ---------- 任官参考 ----------
// 照老图志 officeRecommendations（TM.OfficeFit.list）：按此人基础能力六成、五常四成，对官制树各职打适配分，取前三十。
// 分数只作参考，不是任命资格或履职保证；每职附 pos（与官制册同形），任命仍走 candidates / appoint
export function fitFor(name, vacantOnly = false) {
  const fit = w.TM && w.TM.OfficeFit;
  const ch = findChar(name);
  if (!fit || typeof fit.list !== 'function') throw new Error('任官参考未就绪');
  if (!ch) throw new Error('查无此人');
  const rows = fit.list(G(), ch, { vacantOnly: !!vacantOnly }) || [];
  return rows.slice(0, 30).map((r) => ({
    score: Math.round(Number(r.score) * 10) / 10, deptPath: String(r.deptPath || ''), profile: String(r.profile || ''), basis: String(r.basis || ''), missing: (r.missing || []).map(String),
    held: !!(r.stats && (r.stats.holders || []).includes(name)), pos: positionView(r.position, r.path, r.deptName || '')
  }));
}

// ---------- 任命 ----------
// 候选：内核 _offOpenPicker 先算好（存在全局 _OFF_PICKER）再拼弹窗；这里取算好的名单，弹窗摘掉不用
export function candidates(pos) {
  call('_offOpenPicker', pos.path, pos.dept, pos.name, (pos.holders[0] && pos.holders[0].name) || '');
  const modal = document.getElementById('off-picker-modal');
  if (modal) modal.remove();
  const P = w._OFF_PICKER || {};
  const req = P.req || {};
  return {
    need: { label: req.label || '', primary: req.primaryLabel || '', secondary: req.secondaryLabel || '', loyalty: req.loyNeeded || 0 },
    list: (P.cands || []).map((c) => ({
      name: c.name, title: c.officialTitle || c.title || '', age: c.age || null, loyalty: Math.round(Number(c.loyalty) || 50), match: c._pickerMatch || 0,
      int: Math.round(Number(c.intelligence) || 0), adm: Math.round(Number(c.administration) || 0), mil: Math.round(Number(c.military) || 0),
      party: c.party || '', location: c.location || '', portrait: c.portrait || '', travelDays: c._pickerTravelDays || 0, top: c._pickerRank || 0,
      tags: (c._pickerTags || []).slice(), warnings: (c._pickerWarnings || []).slice(), holdsPost: c.officialTitle || ''
    }))
  };
}
// 先把诏书草稿放进老诏书框，调完收回（内核在那里加减「命某为某官」一行）
function withPolBox(f) {
  const box = edict.legacyInput('edict-pol');
  box.value = edict.draft().political || '';
  try {
    return f();
  } finally {
    edict.setDraft({ political: box.value });
  }
}
// mode：resign 辞旧就新（默认）／ concurrent 兼任
export function appoint(pos, name, mode = 'resign') {
  const old = (pos.holders[0] && pos.holders[0].name) || '';
  const r = withPolBox(() => call('_offPickerConfirm', name, pos.dept, pos.name, old, mode));
  changed('office');
  return r;
}
export function undo(pos) {
  const r = withPolBox(() => call('_offUndoAppointment', pos.dept, pos.name));
  changed('office');
  return r;
}
// 罢免：只录入议事清册，下旨方生效
export function dismiss(pos, holder) {
  call('_offDismissToEdict', holder, pos.dept, pos.name);
  changed('edict-suggestion');
}
// 弹劾：预估成算照老面板的算法；递上则写进诏书政令段，本回合推演判定
export function impeachOdds(name) {
  const c = findChar(name);
  if (!c) return 0;
  const g = G();
  const pf = (g.facs || []).find((f) => f && f.isPlayer);
  const pfName = pf ? pf.name : ((w.P && w.P.playerInfo && w.P.playerInfo.factionName) || '');
  const foreign = !!(pfName && c.faction && c.faction !== pfName);
  const loy = c.loyalty != null ? c.loyalty : 50;
  const adm = c.administration || 50;
  let p = Math.max(10, Math.min(85, 100 - loy - Math.floor(adm / 3)));
  if (foreign) p += 15;
  return Math.max(10, Math.min(90, p));
}
export function impeach(pos, name) {
  const r = withPolBox(() => call('_offImpeachSubmit', name, pos.dept, pos.name, impeachOdds(name)));
  changed('office');
  return r;
}
// 廷推：在京从四品以上诸臣各推一人（同势力、同党、交情、智政），按票数排；照老面板 _offTingTui 的算法
export function tingtui(pos) {
  const g = G();
  const cap = g._capital || '京城';
  const same = fn('_isSameLocation');
  const recs = [];
  const walk = (nodes) => (nodes || []).forEach((n) => {
    (n.positions || []).forEach((p) => {
      if (!p.holder || rankLevel(p.rank) > 8) return;
      const c = findChar(p.holder);
      if (c && c.alive !== false && (!c.location || (same ? same(c.location, cap) : true))) recs.push({ name: p.holder, c });
    });
    walk(n.subs);
  });
  walk(g.officeTree);
  const current = (pos.holders[0] && pos.holders[0].name) || '';
  const pool = (g.chars || []).filter((c) => c && c.alive !== false && !c.isPlayer && c.name !== current);
  const aff = w.AffinityMap && typeof w.AffinityMap.get === 'function' ? w.AffinityMap : null;
  const votes = new Map();
  for (const r of recs) {
    let best = null, bestScore = -999;
    for (const c of pool) {
      let s = (c.intelligence || 50) + (c.administration || 50);
      if (r.c.faction && c.faction === r.c.faction) s += 40;
      if (r.c.party && c.party === r.c.party) s += 25;
      if (aff) { const a = aff.get(r.name, c.name); if (a > 0) s += a; }
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (!best) continue;
    if (!votes.has(best.name)) votes.set(best.name, { c: best, from: [] });
    votes.get(best.name).from.push(r.name);
  }
  return [...votes.values()].sort((a, b) => b.from.length - a.from.length).slice(0, 5).map(({ c, from }) => ({
    name: c.name, title: c.officialTitle || c.title || '', votes: from.length, from,
    int: Math.round(Number(c.intelligence) || 0), adm: Math.round(Number(c.administration) || 0), mil: Math.round(Number(c.military) || 0)
  }));
}
// 廷推所举，录入议事清册
export function nominate(pos, name) {
  const r = call('_offSelectCandidate', name, pos.dept, pos.name);
  changed('edict-suggestion');
  return r;
}
// 门荫（三品以上荫一子为候选）、荐贤（五品以上荐一布衣为候选）
export function menyin(name) { const r = call('_offMenyin', name); changed('people'); return r; }
export function jianbi(name) { const r = call('_offJianbi', name); changed('people'); return r; }
