// 军务：诸军名册、单军详情、战事、流寇。读法与现行右栏（phase8-formal-rightrail.js rightArmy*）一致——
// 只列本朝之军（找不到本朝之军时列全部）；兵额走奏报失真层（名册显据奏名员，核饷点验才掀实额）；军心走内核 _armyMorale。
// 动作照现行右栏：核饷点验、补饷（MilitarySystems 实付）、整训与调防入议事清册、易将（内核拜帅，候选为在世将才）、
// 付廷议（屏幕层开朝议并带上议题）、接战预勾三态。老军务面板的「犒军」（白给士气）与 prompt 调兵现行界面已不用，这里也不接。
import { bus } from '../core/bus.js';
import { suggest } from './edict.js';

const w = window;
const G = () => w.GM || {};
const changed = (what) => bus.emit('game:changed', { what });
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);

const first = (a, keys, fb) => { for (const k of keys) { const v = a && a[k]; if (v != null && v !== '') return v; } return fb; };
const numOf = (a, keys, fb) => { let v = first(a, keys, null); if (typeof v === 'string') v = v.replace(/,/g, ''); const n = Number(v); return v != null && Number.isFinite(n) ? n : fb; };
const pct = (a, keys, fb) => Math.max(0, Math.min(100, numOf(a, keys, fb)));
const COMMANDER = ['commander', 'commanderName', 'commanderDisplayName', 'commander_name', 'general', 'generalName', 'leader', 'leaderName', 'commandingOfficer', 'chiefCommander', 'chiefGeneral', 'mainGeneral'];
const FACTION = ['faction', 'factionName', 'owner', 'camp', 'force', 'realm', 'country', 'polity'];
const dateOf = (turn) => { const f = fn('getTSText'); return f && turn != null ? f(turn) : turn != null ? `第${turn}回合` : ''; };

// ---------- 本朝之军 ----------
const cleanFac = (v) => String(v || '').replace(/[\s·\-—_]/g, '').replace(/^大/, '').replace(/(朝廷|王朝|政权|汗国|幕府|朝)$/g, '');
const facMatch = (v, names) => { const c = cleanFac(v); return !!c && names.some((n) => { const m = cleanFac(n); return m && (c === m || c.includes(m) || m.includes(c)); }); };
const genericCourt = (v) => /^(朝廷|本朝|官府|内廷|宫廷|皇室|王室|帝室|朝中|中枢)$/.test(String(v || '').trim());
function playerFactions() {
  const g = G(), p = w.P || {}, out = [];
  const add = (v) => { if (!v) return; if (typeof v === 'object') return add(v.name || v.factionName || v.id || v.key); v = String(v).trim(); if (v && !out.includes(v)) out.push(v); };
  const pi = p.playerInfo || {};
  add(pi.factionName); add(pi.characterFaction); add(g.playerFaction);
  const pc = Array.isArray(g.chars) ? g.chars.find((c) => c && c.isPlayer) : null;
  add(pc && (pc.faction || pc.factionName));
  [g.facs, g.factions].forEach((list) => (Array.isArray(list) ? list : []).forEach((f) => { if (f && (f.isPlayer || f.player || f.isPlayerFaction || (g.playerFaction && f.name === g.playerFaction))) add(f.name || f.id); }));
  return out;
}
function knownFactions() {
  const g = G(), out = [];
  [g.facs, g.factions].forEach((list) => (Array.isArray(list) ? list : []).forEach((f) => { if (f) [f.name, f.id].forEach((v) => { v = String(v || '').trim(); if (v && !out.includes(v)) out.push(v); }); }));
  return out;
}
function mine(a, ctx) {
  if (!a || a.destroyed || a.disbanded || a.active === false) return false;
  const explicit = FACTION.map((k) => a[k]).filter((x) => x != null && String(x).trim());
  if (!explicit.length || explicit.some(genericCourt) || !ctx.player.length) return true;
  if (explicit.some((x) => facMatch(x, ctx.player))) return true;
  if (ctx.known.length && explicit.some((x) => facMatch(x, ctx.known))) return false;
  return true;
}
function armies() {
  const g = G();
  const raw = (Array.isArray(g.armies) && g.armies.length ? g.armies : (w.P && Array.isArray(w.P.armies) ? w.P.armies : [])).filter((a) => a && !a.destroyed && !a.disbanded && a.active !== false);
  const ctx = { player: playerFactions(), known: knownFactions() };
  const own = raw.filter((a) => mine(a, ctx));
  return own.length || !raw.length ? own : raw;
}
const keyOf = (a, i) => String(first(a, ['id', 'name'], 'army-' + i));
function find(key) {
  const list = armies();
  const i = list.findIndex((a, k) => keyOf(a, k) === key || a.name === key || String(a.id || '') === key);
  if (i < 0) throw new Error('此军已不在册');
  return list[i];
}

// ---------- 读数 ----------
// 兵额：奏报失真层开着时显据奏名员（吃空饷虚增），核饷点验揭实额
function soldiers(a) {
  const t = Math.max(0, Math.round(numOf(a, ['soldiers', 'size', 'strength', 'troops', 'initialTroops'], 0)));
  const RV = w.TM && w.TM.ReportedView;
  if (!RV || !RV.active(w.P || null)) return t;
  let handler = null;
  try { const cn = a.commander || a.commanderName || a.general; if (cn && fn('findCharByName')) handler = w.findCharByName(cn); } catch (_e) { /* 无主帅 */ }
  return RV.value('army', 'soldiers.' + String(a.name || a.id || ''), t, { direction: 'good', dept: 'military', handler }).shown;
}
function morale(a) {
  let v = null;
  if (fn('_armyMorale')) { try { v = w._armyMorale(a); } catch (_e) { v = null; } }
  if (v == null) v = a.morale != null ? a.morale : a.moraleValue != null ? a.moraleValue : 60;
  const n = Number(v);
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 60));
}
function supply(a) {
  if (a.supplyRatio != null) { const r = Number(a.supplyRatio); if (Number.isFinite(r)) return Math.max(0, Math.min(100, r * 100)); }
  return pct(a, ['supply', 'supplies'], 70);
}
const typeOf = (a) => String(first(a, ['armyType', 'type', 'branch', 'category', 'kind'], '其他'));
const commanderOf = (a) => String(first(a, COMMANDER, ''));
function locationOf(a) {
  const v = first(a, ['location', 'garrison', 'station', 'theater', 'region'], '');
  const regions = (G().mapData && G().mapData.regions) || [];
  const r = regions.find((x) => x && (x.id === v || x.name === v));
  return String((r && r.name) || first(a, ['locationName', 'garrisonName'], v) || '');
}
const ACTIVITY = { garrison: '驻防', stationed: '驻防', idle: '待命', marching: '行军', march: '行军', moving: '行军', siege: '围城', sieging: '围城', battle: '交战', fighting: '交战', training: '操练', patrol: '巡防', routed: '溃散', disbanded: '裁撤' };
const activityText = (v) => { const raw = String(v || '').trim(); return raw ? ACTIVITY[raw.toLowerCase()] || raw : '驻防'; };
function marchOf(a) {
  const mo = (G().marchOrders || []).find((o) => o && o.status === 'marching' && (o.armyId === a.id || o.armyName === a.name));
  return mo ? { to: mo.to || '', progress: mo.progress || 0, total: mo.totalTurns || 0 } : null;
}
const hotOf = (a) => morale(a) < 45 || supply(a) < 35 || pct(a, ['mutinyRisk', 'rebellionRisk'], 0) >= 55;
function commanderState(name) {
  if (!name) return 'vacant';
  const ch = fn('findCharByName') ? w.findCharByName(name) : null;
  return ch && (ch.alive === false || ch.dead === true) ? 'dead' : 'ok';
}

// 名册：按兵种分组（同右栏），附总额
export function roster() {
  const groups = new Map();
  let total = 0, hot = 0, arrears = 0, marching = 0;
  armies().forEach((a, i) => {
    const row = { key: keyOf(a, i), name: String(first(a, ['name', 'id'], '未名部队')), commander: commanderOf(a), location: locationOf(a), soldiers: soldiers(a),
      hot: hotOf(a), arrears: Math.max(0, Math.round(Number(a.payArrearsMonths) || 0)), march: marchOf(a), vacant: commanderState(commanderOf(a)) !== 'ok' };
    const t = typeOf(a);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(row);
    total += row.soldiers; hot += row.hot ? 1 : 0; arrears += row.arrears ? 1 : 0; marching += row.march ? 1 : 0;
  });
  return { groups: [...groups].map(([type, rows]) => ({ type, rows, soldiers: rows.reduce((s, r) => s + r.soldiers, 0) })), count: [...groups.values()].reduce((s, r) => s + r.length, 0), total, hot, arrears, marching };
}

const TAC = { 'step/spear': '长枪', 'step/sword': '刀盾', 'step/halberd': '镋钯', 'bow/bow': '弓手', 'bow/crossbow': '弩手', 'bow/musket': '火铳', 'art/cannon': '火炮', 'cav/horse': '骑', 'cav/heavy': '重骑', 'cav/shock': '突骑', 'guard/guard': '亲军' };
function units(a) {
  const us = w.TMArmyUnits ? w.TMArmyUnits.ensureArmyUnits(a) : a.units || [];
  const groups = [];
  let cur = null;
  for (const u of us || []) {
    const tac = TAC[`${u.arm || ''}/${u.sub || ''}`] || '杂兵';
    if (!cur || cur.name !== u['番号'] || cur.tac !== tac) { cur = { name: String(u['番号'] || ''), tac, sizes: [], vet: Math.round(u['历练'] || 0) }; groups.push(cur); }
    cur.sizes.push(u.men);
  }
  return groups;
}
function composition(v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? { type: x, count: 0 } : x ? { type: String(x.type || x.name || x.kind || x.unit || '兵种'), count: Number(x.count || x.soldiers || x.size || x.strength || 0) } : null)).filter(Boolean);
  if (v && typeof v === 'object') return Object.keys(v).map((k) => ({ type: k, count: Number(v[k]) || 0 }));
  return [];
}
const PAY = { money: '钱', grain: '粮', cloth: '帛', silver: '银' };
function pay(a) {
  const v = first(a, ['salary', 'annualSalary', 'yearlySalary', 'upkeep', 'cost', 'monthlyCost'], '');
  if (Array.isArray(v)) return v.filter((r) => r && typeof r === 'object').map((r) => { const k = r.resource || r.type || r.name || r.currency || ''; return { label: PAY[k] || k, amount: Number(r.amount != null ? r.amount : r.value) || 0, unit: r.unit || '', period: r.period || '' }; });
  if (v && typeof v === 'object') return Object.keys(v).map((k) => ({ label: PAY[k] || k, amount: Number(v[k]) || 0, unit: '', period: '' }));
  return v !== '' ? [{ label: '', amount: Number(v) || 0, unit: '', period: '' }] : [];
}
function equipment(a) {
  const eq = a.equipment;
  const list = Array.isArray(eq) ? eq.map((x) => (typeof x === 'string' ? { name: x, count: 0, condition: '' } : x ? { name: String(x.name || x.type || '装备'), count: Number(x.count) || 0, condition: String(x.condition || '') } : null)).filter(Boolean) : [];
  return { condition: String(first(a, ['equipmentCondition', 'equipmentStatus', 'equipmentLevel'], '') || (typeof eq === 'string' ? eq : '')), list };
}

export const STANCES = { ask: '若接战·问我', always: '若接战·必亲征', delegate: '若接战·必委之' };
export function detail(key) {
  const a = find(key);
  const cmd = commanderOf(a);
  const CA = w.TM && w.TM.CommandAuthority;
  let command = '';
  try { if (CA && CA.enabled(a)) command = String(CA.describe(a) || ''); } catch (_e) { command = ''; }
  const ctx = { player: playerFactions(), known: knownFactions() };
  return {
    key, name: String(first(a, ['name', 'id'], '未名部队')), type: typeOf(a), soldiers: soldiers(a),
    commander: cmd, commanderTitle: String(a.commanderTitle || ''), commanderState: commanderState(cmd),
    location: locationOf(a), quality: String(first(a, ['quality', 'grade', 'eliteLevel'], '') || ''), equipment: equipment(a),
    activity: activityText(first(a, ['activity', 'state', 'status', 'currentAction'], '')), march: marchOf(a),
    desc: String(first(a, ['description', 'desc', 'note', 'memo', 'reason'], '') || ''), faction: String(first(a, FACTION, '') || ''),
    morale: morale(a), training: pct(a, ['training', 'trainingValue'], 50), loyalty: pct(a, ['loyalty', 'cohesion'], 50), control: pct(a, ['control', 'discipline', 'commandControl'], 50),
    supply: supply(a), mutiny: pct(a, ['mutinyRisk', 'rebellionRisk'], 0), hot: hotOf(a),
    composition: composition(a.composition || a.unitsComposition || a.units), units: units(a), pay: pay(a),
    logistics: String(first(a, ['logistics', 'supplyState', 'supplyDepotId'], '') || ''), arrears: Math.max(0, Math.round(Number(a.payArrearsMonths) || 0)),
    command, own: mine(a, ctx), stance: a._battleStance === 'always' ? 'always' : a._battleStance === 'delegate' ? 'delegate' : 'ask'
  };
}

// ---------- 战事、流寇 ----------
const PHASE = { march: '行军接敌', 'awaiting-command': '候旨临阵', battle: '交锋', siege: '围城' };
export function battles() {
  const g = G();
  const active = (g.activeBattles || []).filter((b) => b && b.phase !== 'resolved').map((b) => ({
    id: String(b.id || ''), attacker: String(b.attackerArmy || b.attacker || ''), defender: String(b.defenderArmy || b.defender || ''), location: String(b.location || ''), phase: PHASE[b.phase] || String(b.phase || '')
  }));
  const history = (g.battleHistory || []).slice(-12).reverse().map((r) => ({
    when: dateOf(r.turn), attacker: String(r.attacker || r.attackerFaction || ''), defender: String(r.defender || r.defenderFaction || ''), winner: String(r.winner || ''), loser: String(r.loser || ''),
    attackerLoss: Math.round(Number(r.attackerLoss) || 0), defenderLoss: Math.round(Number(r.defenderLoss) || 0), location: String(r.location || r.terrain || '')
  }));
  return { active, history };
}
export function rebels() {
  return (Array.isArray(G().rovingRebels) ? G().rovingRebels : []).filter((r) => r && !r.disbanded && (Number(r.strength) || 0) > 0).map((r) => {
    const n = Number(r.strength) || 0;
    return { name: String(r.name || '流寇'), strength: n, regions: (r.regions || []).slice(0, 4).map(String), tier: n >= 100000 ? '燎原' : n >= 30000 ? '势盛' : '啸聚' };
  });
}

// ---------- 动作 ----------
// 核饷：失真层开着则点验名册、掀出实额（数回合后重蒙尘）；没开则只是去看度支
export function inspect(key) {
  const a = find(key);
  const name = String(a.name || a.id || '');
  const RV = w.TM && w.TM.ReportedView;
  if (RV && RV.active(w.P || null)) {
    RV.reveal('army', 'soldiers.' + name, 'hexiang');
    changed('army');
    return { revealed: true, text: `核饷点验：${name} 实额已掀见` };
  }
  return { revealed: false, text: '' };
}
// 补饷：内核按欠饷月数、军力与饷率自国库实付（有欠才可补）
export function settle(key) {
  const a = find(key);
  if (!fn('_tsSettleArrears')) throw new Error('内核缺 _tsSettleArrears');
  w._tsSettleArrears(a.name);
  changed('army');
}
// 整训、调防：照右栏原文入议事清册
export function train(key) {
  const name = String(find(key).name || key);
  suggest('军务边防', name, '整训军队', '命 ' + name + ' 整饬营伍、核实兵额、补足器械，并回奏训练成效。');
  changed('edict-suggestion');
  return '已纳入诏书建议库：整训 ' + name;
}
export function redeploy(key) {
  const name = String(find(key).name || key);
  suggest('军务边防', name, '调防军队', '议定 ' + name + ' 调防路线、粮饷供给与接防期限，不得擅离驻地。');
  changed('edict-suggestion');
  return '已纳入诏书建议库：调防 ' + name;
}
// 易将：候选为在世将才（同朝优先、武略为序，内核所排），至多六十名
export function candidates(key) {
  const a = find(key);
  const f = fn('_tsLivingCommanderCandidates');
  return f ? f(a).slice(0, 60).map((c) => ({ name: c.name, mil: c.mil, intel: c.intel, faction: c.faction, title: c.title, same: !!c.sameFac })) : [];
}
// 拜将走内核 _tsConfirmAppoint（防死人、有军令交接则发令候回报）；它读 #ts_appoint_sel，确认后还会去开老军务面板——临时代填、临时按住
export function appoint(key, name) {
  const a = find(key);
  if (!fn('_tsConfirmAppoint')) throw new Error('内核缺 _tsConfirmAppoint');
  const sel = document.createElement('select');
  sel.id = 'ts_appoint_sel';
  sel.style.display = 'none';
  sel.append(new Option(name, name, true, true));
  document.body.append(sel);
  const legacyPanel = w.openMilitaryDetailPanel;
  w.openMilitaryDetailPanel = () => {};
  try {
    w._tsConfirmAppoint(a.name);
  } finally {
    w.openMilitaryDetailPanel = legacyPanel;
    sel.remove();
  }
  changed('army');
}
// 接战预勾：问我 → 必亲征 → 必委之 → 问我（存在军上，随档）
export function cycleStance(key) {
  const a = find(key);
  const cur = a._battleStance;
  a._battleStance = cur === 'always' ? 'delegate' : cur === 'delegate' ? undefined : 'always';
  changed('army');
  const name = String(a.name || key);
  return name + '·' + (a._battleStance === 'always' ? '若接战必御驾亲征（免临场请旨）' : a._battleStance === 'delegate' ? '若接战必委之偏裨（庙算决之）' : '若接战临场请旨（会战阶段弹窗）');
}
// 付廷议的议题（同右栏）
export const courtTopic = (key) => String(find(key).name || key) + ' 军务处置';
