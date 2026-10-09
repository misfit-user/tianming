// 策名：把历史人物纳入人物志（tm-ceming.js，玩家工具：零代价、即时生效、不授官）。老界面是一层 #ceming-overlay 对话框，
// 新前端不用它，直接调内核的四口：库内档案 summonByProfile、库外检索 aiSearchCard → summonByCard、疑非真人 addToBlacklist；
// 能否召某人由 canSummon 按游戏模式断代（演义跨时空皆可，轻度史实前后五十年，严格史实须当世）。
// 召入后照老对话框记一笔起居注（addEB「策名」）。档案的「历史结局」于当世之人是后事，不给看。
import { bus } from '../core/bus.js';

const w = window;
const G = () => w.GM || {};
const C = () => w.TM && w.TM.ceming;
const lib = () => w.HISTORICAL_CHAR_PROFILES || {};
const str = (v) => (v == null ? '' : String(v).trim());
export const ROLES = [['corrupt', '巨贪'], ['regent', '权臣'], ['military', '名将'], ['clean', '清官'], ['scholar', '文宗'], ['loyal', '忠臣'], ['reformer', '改革家'], ['usurper', '篡臣'], ['eunuch', '宦权']];
const ROLE = Object.fromEntries(ROLES);
const inRoster = (name) => !!(name && typeof w.findCharByName === 'function' && w.findCharByName(name));
const year = () => Number(G().year) || Number(w.P && w.P.time && w.P.time.year) || 0;
// 当世之人（生卒跨今年）：其「历史结局」是后事
const contemporary = (p) => { const y = year(), b = Number(p.birthYear), d = Number(p.deathYear); return !!(y && b && d && y >= b && y <= d); };

export function ready() {
  const c = C();
  return !!(c && typeof c.canSummon === 'function' && typeof c.summonByProfile === 'function');
}
// 档案库：朝代（按人数）、类型、筛后诸条（最多 lim 条）
export function library({ q = '', dynasty = '', role = '' } = {}, lim = 120) {
  const P = lib(), c = C();
  const ids = Object.keys(P);
  const dyn = new Map();
  ids.forEach((k) => { const d = str(P[k].dynasty); if (d) dyn.set(d, (dyn.get(d) || 0) + 1); });
  const kw = str(q).toLowerCase();
  const hits = ids.filter((k) => {
    const p = P[k];
    if (dynasty && p.dynasty !== dynasty) return false;
    if (role && p.role !== role) return false;
    if (!kw) return true;
    return [p.name, p.zi, p.title, p.officialTitle, p.era, p.dynasty, p.id, (p.alternateNames || []).join(' '), p.background, p.famousQuote].map(str).join('  ').toLowerCase().includes(kw);
  });
  return {
    total: ids.length, count: hits.length,
    dynasties: [...dyn.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
    rows: hits.slice(0, lim).map((k) => {
      const p = P[k];
      let chk = { ok: false, reason: '' };
      try { chk = c.canSummon(p) || chk; } catch (_e) { /* 判不了按不可 */ }
      const there = inRoster(p.name);
      return { id: k, name: str(p.name) || '佚名', zi: str(p.zi), dynasty: str(p.dynasty), era: str(p.era), title: str(p.officialTitle || p.title), role: ROLE[p.role] || '',
        ok: !!chk.ok && !there, reason: there ? '已在册' : chk.ok ? '' : str(chk.reason) };
    })
  };
}
// 一张身份卡（库内档案或检索所得）
function cardOf(d, kind) {
  return {
    kind, name: str(d.name) || '佚名', zi: str(d.zi), dynasty: str(d.dynasty), era: str(d.era), birth: d.birthYear || '', death: d.deathYear || '',
    title: str(d.officialTitle || d.title), role: ROLE[d.role] || str(d.role), background: str(d.background), quote: str(d.famousQuote),
    fate: contemporary(d) ? '' : str(d.historicalFate), doubtful: d.confidence === 'low', ambiguity: str(d.ambiguityNote),
    anchors: (d.anchors || []).filter(Boolean).map((a) => ({ dim: str(a.dimension) || '风格近', name: str(a.name), why: str(a.reason) }))
  };
}
export function profileCard(id) {
  const p = lib()[id];
  return p ? cardOf(p, 'profile') : null;
}
// 史官检索（须配模型）：{ ok, card } 或 { ok:false, message, inRoster }
let found = null;
export async function search(name) {
  const c = C();
  if (!c || typeof c.aiSearchCard !== 'function') return { ok: false, message: '史官检索未就绪' };
  const r = await c.aiSearchCard(str(name));
  if (!r || !r.ok) { found = null; return { ok: false, message: (r && (r.message || r.reason)) || '史官未察其人', inRoster: !!(r && r.reason === 'in_roster') }; }
  found = r.card;
  return { ok: true, card: cardOf(r.card, 'card') };
}
export function markFake(name) {
  const c = C();
  if (c && typeof c.addToBlacklist === 'function') c.addToBlacklist(str(name));
  found = null;
}
// 召入：库内按档案 id，检索所得用刚查到的那张卡。返回 { name, existed, note }
export async function summon(kind, id) {
  const c = C();
  let r = null, note = '';
  if (kind === 'profile') {
    const p = lib()[id];
    if (!p) throw new Error('档案已不在');
    r = await c.summonByProfile(id);
    note = (w.P && w.P.conf && w.P.conf.gameMode) === 'yanyi' && !contemporary(p) ? '破时空之障，应召而来' : '应召来朝';
  } else {
    if (!found) throw new Error('请先查得其人');
    r = await c.summonByCard(found);
    note = '应召而至';
    found = null;
  }
  const name = r && r.char ? r.char.name : '';
  if (!name) throw new Error('策名未成');
  try { if (typeof w.addEB === 'function') w.addEB('策名', `${name}${r.existed ? ' 已在人物志' : ` 入人物志·${note}`}`); } catch (_e) { /* 起居注未成不碍 */ }
  try { if (w.TMZhi && typeof w.TMZhi.invalidatePeople === 'function') w.TMZhi.invalidatePeople(); } catch (_e) { /* 老图志缓存 */ }
  bus.emit('game:changed', { what: 'people' });
  return { name, existed: !!r.existed, note };
}
