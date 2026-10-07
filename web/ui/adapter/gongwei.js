// 宫闱（书目「宫」，元首档）：后妃、宫中尊长、皇嗣、宫苑。同志 10-07 拍板：只认人物志里的真后妃（_tmIsPlayerConsort），
// tm-houguong.js 那套随机生成后妃（王某氏·清制位分·选秀）不接。位分走剧本的 GM.harem.rankSystem（getHaremRanks）；
// 后妃的 spouseRank 常与位分表的 id 对不上（empress / consort_noble），对不上就按头衔里的位分名认。
// 有孕、诞育、晋封、宠爱、薨逝由推演 harem_events 写；新界面的晋封降位只拟入议事清册（以诏书为准），召幸＝私下叙谈（问对 private）。
// 立储：内核 designateHeir(本人, 皇子)（写 designatedHeirId，驾崩禅让时最先认）。
// 宫苑：内核只读 P.palaceSystem，而开局并不把剧本的宫殿名录抄进去（官方三剧本都写了名录，运行时却是空的）——
// 这里 P 里没有就读剧本里的那份来显示；修缮、移居、新建拟入议事清册，说法照老皇城面板（_palaceSubmitReno 等）。
import { suggest } from './edict.js';

const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const n0 = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const str = (v) => (v == null ? '' : String(v).trim());
const findChar = (name) => (fn('findCharByName') ? w.findCharByName(name) : (G().chars || []).find((c) => c && c.name === name)) || null;
const player = () => (G().chars || []).find((c) => c && c.isPlayer) || null;
const place = (loc) => { const parts = str(loc).split('·').filter(Boolean); return parts[parts.length - 1] || ''; };

// ---------- 位分 ----------
export function ranks() {
  const list = fn('getHaremRanks') ? w.getHaremRanks() : (G().harem && G().harem.rankSystem) || [];
  return (list || []).filter((r) => r && r.id).map((r) => ({ id: r.id, name: r.name || r.id, level: n0(r.level, 9) })).sort((a, b) => a.level - b.level);
}
function rankOf(c) {
  const rs = ranks();
  const byId = rs.find((r) => r.id === c.spouseRank);
  if (byId) return byId;
  const title = `${str(c.officialTitle)} ${str(c.title)}`;
  // 头衔里的位分名（长名先认：皇贵妃先于贵妃、贵妃先于妃）
  const hit = rs.flatMap((r) => r.name.split('/').map((nm) => ({ r, nm: nm.trim() }))).filter((x) => x.nm && title.includes(x.nm)).sort((a, b) => b.nm.length - a.nm.length)[0];
  if (hit) return hit.r;
  const name = fn('getHaremRankName') ? w.getHaremRankName(c.spouseRank) : '';
  return { id: c.spouseRank || '', name: name && !/^[a-z_]+$/i.test(name) ? name : str(c.officialTitle || c.title) || '侍御', level: fn('getHaremRankLevel') ? n0(w.getHaremRankLevel(c.spouseRank), 9) : 9 };
}

// ---------- 读 ----------
const isConsort = (c) => !!(c && c.alive !== false && !c.dead && (fn('_tmIsPlayerConsort') ? w._tmIsPlayerConsort(c) : c.spouse === true));
// 宫中尊长与先朝遗眷：住在宫里、带后妃名号、却不是今上的后妃（太后、太妃、先帝皇后、先朝选侍……）
const ELDER = /太后|太妃|太嫔|皇后|贵妃|妃|嫔|选侍|才人|婕妤|美人|昭仪|贵人|淑女/;
function isElder(c, cap) {
  if (!c || c.alive === false || c.dead || c.isPlayer || isConsort(c)) return false;
  const t = `${str(c.officialTitle)} ${str(c.title)}`;
  if (!ELDER.test(t)) return false;
  const loc = str(c.location);
  return !!(cap && loc.includes(cap)) || /宫/.test(place(loc));
}
function capitalKey() {
  const pal = palaceSystem();
  if (pal && pal.capitalName) return str(pal.capitalName).split(/[\s(（]/)[0];
  const pc = player();
  return pc ? str(pc.location).split('·').slice(0, 2).join('·') : '';
}
function pregnancyOf(name) {
  return (G().harem && G().harem.pregnancies || []).find((p) => p && p.mother === name) || null;
}
function childrenOf(c) {
  const ids = new Set((c.childrenIds || []).map(String));
  return (G().chars || []).filter((k) => k && k.alive !== false && (ids.has(String(k.id)) || k.mother === c.name)).map((k) => k.name);
}
function person(c, kind) {
  const r = kind === 'consort' ? rankOf(c) : null;
  const preg = pregnancyOf(c.name);
  const turn = n0(G().turn, 1);
  const last = c._lastEmperorVisitTurn != null ? n0(c._lastEmperorVisitTurn) : null;
  return {
    name: c.name, kind, rank: r ? r.name : '', level: r ? r.level : 99, title: str(c.officialTitle || c.title), age: c.age != null ? n0(c.age) : null,
    family: str(c.family || c.clan), residence: place(c.location), location: str(c.location), portrait: c.portrait || '',
    favor: c.favor != null ? Math.round(n0(c.favor)) : null, loyalty: c.loyalty != null ? Math.round(n0(c.loyalty)) : null,
    health: c.health != null ? Math.round(n0(c.health)) : null, relation: str(c.playerRelation || c.relationToPlayer), spouse: typeof c.spouse === 'string' ? c.spouse : '',
    children: childrenOf(c).concat(Array.isArray(c.children) ? c.children.filter((x) => typeof x === 'string') : []).filter((x, i, a) => a.indexOf(x) === i),
    pregnant: preg ? { since: n0(preg.startTurn), detail: str(preg.detail) } : null,
    lastVisit: last, idle: last != null ? turn - last : null,
    proposed: (G()._edictSuggestions || []).some((s) => s && !s.used && s.source === '后宫' && s.from === c.name),
    bio: str(c.bio || c.description || c.personality).slice(0, 200)
  };
}
export function court() {
  const g = G();
  const cap = capitalKey();
  const chars = (g.chars || []).filter(Boolean);
  const consorts = chars.filter(isConsort).map((c) => person(c, 'consort')).sort((a, b) => (a.level - b.level) || ((b.favor || 0) - (a.favor || 0)));
  const elders = chars.filter((c) => isElder(c, cap)).map((c) => person(c, 'elder'));
  const pc = player();
  const heirRef = pc && pc.designatedHeirId ? String(pc.designatedHeirId) : String((g.harem && (g.harem.crownPrinceId || g.harem.crownPrince)) || '');
  const kidIds = new Set(((pc && pc.childrenIds) || []).map(String));
  const heirs = chars.filter((c) => c.alive !== false && !c.isPlayer && (kidIds.has(String(c.id)) || (pc && c.father === pc.name) || c._royalChild)).map((c) => ({
    name: c.name, id: c.id, age: c.age != null ? n0(c.age) : null, male: /^(male|男)$/i.test(str(c.gender)) || /皇子|太子|世子/.test(str(c.title)),
    mother: str(c.mother), title: str(c.title), portrait: c.portrait || '', designated: !!heirRef && (String(c.id) === heirRef || c.name === heirRef)
  }));
  const pending = ((g.harem && g.harem.pregnancies) || []).filter((p) => p && p.mother).map((p) => ({ mother: p.mother, since: n0(p.startTurn) }));
  return {
    consorts, elders, heirs, pending, ranks: ranks(),
    succession: str(g.harem && g.harem.successionNote), description: str(g.harem && g.harem.haremDescription), clan: typeof (g.harem && g.harem.motherClanSystem) === 'string' ? g.harem.motherClanSystem : '',
    palaces: palaces()
  };
}

// ---------- 宫苑 ----------
function palaceSystem() {
  const p = w.P && w.P.palaceSystem;
  if (p && p.enabled && Array.isArray(p.palaces) && p.palaces.length) return p;
  const sc = fn('findScenarioById') ? w.findScenarioById(G().sid) : null;
  const s = sc && sc.palaceSystem;
  return s && Array.isArray(s.palaces) && s.palaces.length ? s : null;
}
// 类型键：老皇城面板九种之外，官方剧本还用 administration / library / residence / concubine / religious / official / temporary / lost
export const PALACE_TYPES = [['main_hall', '外朝主殿'], ['administration', '理政殿阁'], ['library', '文翰典藏'], ['ceremonial', '礼制建筑'],
  ['imperial_residence', '帝后寝宫'], ['residence', '帝后寝宫'], ['consort_residence', '后妃居所'], ['concubine', '后妃居所'], ['dowager', '太后太妃宫'], ['crown_prince', '太子宫'],
  ['office', '内廷办公'], ['official', '官署'], ['religious', '祭祀宗庙'], ['offering', '祭祀宗庙'], ['garden', '园林行宫'], ['temporary', '行在'], ['lost', '旧都']];
export const DWELLING = ['concubine', 'consort_residence', 'residence', 'imperial_residence', 'dowager', 'crown_prince'];
const typeIndex = (t) => { const i = PALACE_TYPES.findIndex(([k]) => k === t); return i < 0 ? 99 : i; };
const STATUS = { intact: '完好', damaged: '损坏', ruined: '荒废', underconstruction: '在建' };
const ROLE = { main: '主殿', side: '偏殿', attached: '附殿' };
function palaces() {
  const ps = palaceSystem();
  if (!ps) return null;
  const residents = (G().chars || []).filter((c) => c && c.alive !== false && c.location);
  return {
    capital: str(ps.capitalName) || '皇城', description: str(ps.capitalDescription || ps.description),
    list: ps.palaces.filter(Boolean).map((p, i) => ({
      i, id: p.id || `pal-${i}`, name: str(p.name), type: p.type || '', typeLabel: (PALACE_TYPES.find(([k]) => k === p.type) || [, '其他'])[1],
      status: p.status || 'intact', statusLabel: STATUS[p.status] || STATUS.intact, location: str(p.location), use: str(p.function), description: str(p.description),
      built: p.builtYear || '', cost: n0(p.maintainCost), level: p.level, lastRenovation: p.lastRenovation || null,
      halls: (p.subHalls || []).filter(Boolean).map((sh) => ({ name: str(sh.name), role: ROLE[sh.role] || str(sh.role), capacity: n0(sh.capacity, 1), occupants: (sh.occupants || []).map(str).filter(Boolean) })),
      residents: residents.filter((c) => p.name && str(c.location).includes(p.name)).map((c) => c.name), order: typeIndex(p.type)
    })).sort((a, b) => (a.order - b.order) || (a.i - b.i))
  };
}

// ---------- 动作 ----------
function need(name) {
  const c = findChar(name);
  if (!c) throw new Error('查无此人');
  return c;
}
// 晋封、降位：拟入议事清册，由推演落地（harem_events.rank_change）
export function proposeRank(name, rankName, reason) {
  const c = need(name);
  if (!isConsort(c)) throw new Error('非今上后妃');
  const cur = rankOf(c);
  const to = ranks().find((r) => r.name === rankName);
  if (!to) throw new Error('无此位分');
  const up = to.level < cur.level;
  const text = `${up ? '晋封' : '降'}${cur.name}${c.name}为${to.name}${reason ? '——' + reason : ''}`;
  suggest('后宫', c.name, `${up ? '晋封' : '降位'}·${c.name}`, text);
  return text;
}
export function designate(name) {
  const pc = player();
  const c = need(name);
  if (!pc) throw new Error('未找到本人');
  if (!c.id || !String(c.id).trim()) throw new Error('此人缺少稳定身份，不可立');
  if (fn('designateHeir')) { if (w.designateHeir(pc.name, c.name) === false) throw new Error('立储未成'); }
  else pc.designatedHeirId = c.id;
  const g = G();
  if (g.harem) g.harem.crownPrinceId = c.id;
  return true;
}
export function renovate(palName, desc) {
  const text = str(desc) || `修缮 ${palName}，恢复规制与威严`;
  suggest('宫建', palName, '', `修缮 ${palName}：${text}`);
}
export function move(who, toPalace, toHall, reason) {
  if (!who || !toPalace) throw new Error('请择迁出者与目标居所');
  suggest('宫建', toPalace, '', `调 ${who} 移居 ${toPalace}${toHall ? '·' + toHall : ''}${reason ? '——' + reason : ''}`);
}
export function build(name, desc) {
  if (!str(name) || !str(desc)) throw new Error('宫名与用途都要写');
  suggest('宫建', '皇城', '', `新建宫殿【${str(name)}】：${str(desc)}。——请AI判定建造合理性、成本、工期与威仪影响，纳入皇城。`);
}
