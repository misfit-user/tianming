// 通用一套的「我」：元首以外的人坐下，界面按这个人长出来（同志 10-10：元首一套、通用一套；通用以 CK3 为主要参照，以人为本）。
// 按视角人物现算四样，不看身份档：
//   posts      职衔（官制在任记录，一身数职逐条）
//   charges    所掌：职交给他的那一块。辖区（方志、通志读数带，据奏口径同方志）、所统之兵、京官的本衙门、本家；首项即顶栏所读
//   superiors  上：谁管着他——辖区一路往上的主官、本衙门堂上官，末了是本朝元首
//   family     本家：家族、门第、族望、配偶子女之数
// 数据经各领域适配层（fangzhi、army、realm）取，本文件只拣选与排序。
import { region as regionOf, circuit as circuitOf, circuitsReady } from './fangzhi.js';
import { roster } from './army.js';
import { perspective, person } from './select.js';

const w = window;
const G = () => w.GM || {};
const str = (v) => (v == null ? '' : String(v));

const RANK_RE = /([正从])([一二三四五六七八九])品/;
const rankLevel = (s) => { const m = RANK_RE.exec(str(s)); return m ? '一二三四五六七八九'.indexOf(m[2]) * 2 + (m[1] === '正' ? 1 : 2) : 99; };
const MILITARY_POST = /总兵|副总兵|参将|游击|守备|都督|提督|镇守|宣抚使|宣慰使/;
// 实掌一地之职：职名里带上这些字，就去区划里找同名的那一块
const LOCAL_TITLE = /知府|知州|知县|府尹|巡抚|总督|布政|按察|兵备|节度|观察|刺史|太守|县令/;

function charOf(g, ref) {
  const chars = g.chars || [];
  return chars.find((c) => c && c.id != null && String(c.id) === String(ref)) || chars.find((c) => c && c.name === ref) || null;
}

// 区划树：带父链走一遍，按 id、名字都能找
function divisions(g) {
  const ah = g.adminHierarchy || (w.P && w.P.adminHierarchy) || {};
  const out = [];
  const walk = (list, parents) => {
    for (const d of list || []) {
      if (!d) continue;
      out.push({ d, parents });
      walk(d.children || d.divisions, parents.concat(d));
    }
  };
  for (const k of Object.keys(ah)) walk(ah[k] && ah[k].divisions, []);
  return out;
}
const governorOf = (d) => str(d && (d.governor || '')).trim();

// 职名里认区划：「大名府知府」认大名府，「顺天府尹」认顺天府；取最长的那个名
function divisionByTitle(all, title) {
  let hit = null;
  for (const x of all) {
    const name = str(x.d.name);
    if (name.length >= 2 && title.includes(name) && (!hit || name.length > str(hit.d.name).length)) hit = x;
  }
  return hit;
}
// 所在地认区划：「南直隶·苏州府太仓」从后往前认
function divisionByPlace(all, place) {
  const segs = str(place).split(/[·・,，\s]+/).filter(Boolean).reverse();
  for (const seg of segs) {
    let hit = null;
    for (const x of all) {
      const name = str(x.d.name);
      if (name.length >= 2 && (seg === name || seg.startsWith(name) || seg.includes(name)) && (!hit || name.length > str(hit.d.name).length)) hit = x;
    }
    if (hit) return hit;
  }
  return null;
}

// 辖区那一块：省一级读通志，府州读方志；取读数带（户口、实征、驻军、民心、吏治），据奏与否照方志
function regionCharge(x, viaTitle) {
  const d = x.d;
  const ids = [...new Set([d.mapRegionId || d.regionId, ...(Array.isArray(d.mappedRegions) ? d.mappedRegions : [])].filter(Boolean).map(String))];
  const province = d.level === 'province';
  const out = { kind: province ? 'circuit' : 'region', key: '', name: str(d.name), divisionId: d.id, mapRegionIds: ids, band: [], inferred: !!viaTitle };
  try {
    if (province) {
      if (!circuitsReady()) return out;
      const c = ids.length ? circuitOf(ids[0]) : null;
      if (c) { out.key = c.key; out.band = c.band || []; }
    } else if (ids[0]) {
      const r = regionOf(ids[0]);
      if (r) { out.key = r.id; out.band = r.band || []; }
    }
  } catch (err) {
    console.warn('[newui] 取所掌辖区出错', err);
  }
  return out;
}

// 衙门：官制树里此人所在的那一署，取堂上官（品级最高、不是本人的在任者）与本署在任、缺员之数
function officeTree(g) { return g.officeTree || (w.P && w.P.officeTree) || []; }
function holdersOf(pos) {
  const hs = Array.isArray(pos.actualHolders) ? pos.actualHolders.map((x) => x && x.name).filter(Boolean) : [];
  if (!hs.length && pos.holder) hs.push(str(pos.holder));
  return hs;
}
function deptOf(g, name, deptName) {
  let hit = null;
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (!n || hit) continue;
      if ((n.positions || []).some((p) => p && holdersOf(p).includes(name)) && (!deptName || str(n.name) === deptName || str(deptName).endsWith(str(n.name)))) { hit = n; return; }
      walk((n.subs || []).concat(n.children || []));
    }
  };
  walk(officeTree(g));
  return hit;
}
function officeCharge(g, name, post) {
  const n = deptOf(g, name, post.dept) || deptOf(g, name, '');
  const out = { kind: 'office', key: post.dept, name: post.dept || post.title, title: post.title, head: '', staff: 0, vacant: 0 };
  if (!n) return out;
  let best = null;
  for (const p of n.positions || []) {
    if (!p) continue;
    const hs = holdersOf(p);
    const cap = Math.max(1, Number(p.count || p.slots || p.establishment) || hs.length || 1);
    out.staff += hs.length;
    out.vacant += Math.max(0, cap - hs.length);
    const lv = rankLevel(p.rank);
    for (const h of hs) if (h !== name && (!best || lv < best.lv)) best = { lv, name: h, title: str(p.name) };
  }
  // 堂上官须比本人品高（同品同署是同僚，不算上）
  const mine = Math.min(...(n.positions || []).filter((p) => p && holdersOf(p).includes(name)).map((p) => rankLevel(p.rank)), 99);
  if (best && best.lv < mine) out.head = { name: best.name, title: best.title };
  return out;
}

function armyCharges(name) {
  let rows = [];
  try { rows = roster().groups.flatMap((x) => x.rows); } catch (_e) { return []; }
  return rows.filter((a) => a.commander === name).map((a) => ({ kind: 'army', key: a.key, name: a.name, soldiers: a.soldiers, arrears: a.arrears, hot: a.hot, location: a.location }));
}

function familyOf(g, ch) {
  const fams = g.families || {};
  const key = Object.keys(fams).find((k) => k === ch.family || (fams[k] && fams[k].name === ch.family)) || '';
  const f = key ? fams[key] : null;
  const kids = Array.isArray(ch.children) ? ch.children.length : 0;
  return { key, name: str((f && f.name) || ch.family), renown: f ? Math.round(Number(f.renown != null ? f.renown : f.prestige) || 0) : null, spouse: !!(ch.spouse || ch.spouseId), children: kids };
}

function rulerOf(g, ch) {
  const facs = g.facs || [];
  const f = facs.find((x) => x && ((ch.factionId && x.id === ch.factionId) || x.name === ch.faction));
  return f && f.leader ? { name: str(f.leader), title: '元首' } : null;
}

// as：借视角的人名；不给就是视角人物（玩家或借视角中的那位）
export function standing(as) {
  const g = G();
  const per = perspective(as);
  const ch = per.id != null ? charOf(g, per.id) : charOf(g, per.name);
  if (!ch) return null;
  const all = divisions(g);
  const charges = [];
  const seenDiv = new Set();
  const addRegion = (x, viaTitle) => { if (!x || seenDiv.has(x.d.id)) return; seenDiv.add(x.d.id); charges.push(regionCharge(x, viaTitle)); };
  for (const gv of per.governs) addRegion(all.find((x) => x.d.id === gv.id), false);
  // 区划上没挂主官的地方官（如知府）：从职名认
  for (const p of per.posts) if (p.local || LOCAL_TITLE.test(p.title)) addRegion(divisionByTitle(all, p.title), true);
  const armies = armyCharges(ch.name);
  const offices = per.posts.filter((p) => !p.local && !LOCAL_TITLE.test(p.title) && !MILITARY_POST.test(p.title))
    .filter((p, i, list) => list.findIndex((q) => q.dept === p.dept) === i)          // 同署两职（首辅兼文渊阁）只算一署
    .map((p) => officeCharge(g, ch.name, p));
  // 武职先兵后地，其余先地后兵；京官衙门在后；本家人人有，排末
  const military = per.posts.some((p) => MILITARY_POST.test(p.title));
  const regions = charges.splice(0);
  charges.push(...(military ? [...armies, ...regions] : [...regions, ...armies]), ...offices);
  const family = familyOf(g, ch);
  charges.push({ kind: 'household', key: family.key, name: family.name || '本家' });

  // 上：所掌辖区往上的主官（无官者按所在地），本衙门堂上官，末了元首；不列本人、不重出
  const ups = [];
  const push = (u) => { if (u && u.name && u.name !== ch.name && !ups.some((x) => x.name === u.name)) ups.push(u); };
  const firstRegion = charges.find((c) => c.kind === 'region' || c.kind === 'circuit');
  const anchor = firstRegion ? all.find((x) => x.d.id === firstRegion.divisionId) : divisionByPlace(all, ch.location);
  if (anchor) for (const d of anchor.parents.slice().reverse()) { const gv = governorOf(d); if (gv) push({ name: gv, title: `${str(d.name)}主官` }); }
  for (const o of offices) if (o.head) push(o.head);
  if (!per.ruler) push(rulerOf(g, ch));

  const me = person(ch.id);
  return {
    id: ch.id, name: ch.name, title: str(ch.officialTitle || ch.title), portrait: str(ch.portrait), age: ch.age != null ? Number(ch.age) : null,
    location: str(ch.location), faction: per.faction, ruler: per.ruler, previewing: per.previewing,
    posts: per.posts, charges, superiors: ups, family, gauges: me.gauges, wealth: me.wealth, purse: me.purse
  };
}
