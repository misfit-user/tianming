// 读模型：从内核取数，返回纯数据快照（不带内核对象引用）。界面上显示的一律是「据奏」口径——
// 奏报失真层开着时玩家看到的是有司上报的数，这里调内核自己的 _barReported / _barFlipToPerceived，与老顶栏同源。
const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function reported(key, val, dir, domain) {
  const f = fn('_barReported');
  return f ? f(key, val, dir, domain).shown : val;
}
function stock(account, res) {
  const f = fn('_barAccountStock');
  if (f) return f(account, res);
  return num(account && account.ledgers && account.ledgers[res] && account.ledgers[res].stock);
}

// 日期：年号纪年（年号、在位第几年）、公历年、月日（剧本历法：农历剧本取农历月日）、干支、季、回合。
// 取内核 calcDateFromTurn：eraInfo = { era 年号, ry 年数, month, day }；gzYearStr / gzDayStr 年日干支
export function date() {
  const g = G();
  const turn = num(g.turn, 1);
  const out = { turn, running: !!g.running, busy: !!g.busy };
  const calc = fn('calcDateFromTurn');
  try {
    const c = calc ? calc(turn) : null;
    if (c) {
      const e = c.eraInfo || {};
      out.year = c.adYear;
      out.era = e.era || g.eraName || '';
      out.reignYear = num(e.ry, 0) || null;
      out.month = num(e.month, 0) || (c.calendar === 'lunar' ? c.lunarMonth : c.solarMonth);
      out.day = num(e.day, 0) || (c.calendar === 'lunar' ? c.lunarDay : c.solarDay);
      out.ganzhi = c.gzYearStr || '';
      out.dayGanzhi = c.gzDayStr || '';
      out.season = c.season || '';
    }
  } catch (err) {
    console.warn('[newui] 取日期出错', err);
  }
  const txt = fn('getTSText');
  out.text = txt ? String(txt(turn)) : '';
  out.daysPerTurn = num(w.P && w.P.time && w.P.time.daysPerTurn, 30);
  return out;
}

// 玩家身份
export function player() {
  const g = G();
  const pi = g.playerInfo || {};
  const id = pi.characterId || g.playerCharacterId;
  const ch = (g.chars || []).find((c) => c && (c.id === id || c.isPlayer)) || null;
  return {
    id: id || (ch && ch.id) || null,
    name: pi.characterName || (ch && ch.name) || '',
    title: pi.characterTitle || (ch && (ch.officialTitle || ch.title)) || '',
    faction: pi.factionName || (ch && ch.faction) || '',
    portrait: (ch && ch.portrait) || '',
    location: (ch && ch.location) || ''
  };
}

// 帑廪（国库）与内帑：库存（据奏）、本期增减、单位、状态；老顶栏的视图模型（_renderGuoku/_renderNeitang）提供增减与状态
function ledger(kind) {
  const g = G();
  const account = kind === 'guoku' ? g.guoku || {} : g.neitang || {};
  const view = (() => {
    const f = fn(kind === 'guoku' ? '_renderGuoku' : '_renderNeitang');
    try { return f ? f() : null; } catch (err) { console.warn(`[newui] ${kind} 视图模型出错`, err); return null; }
  })();
  const rows = ['money', 'grain', 'cloth'].map((res, i) => {
    const raw = stock(account, res);
    const shown = kind === 'guoku' ? reported(`guoku.${res}`, raw, 'good') : raw;
    const sub = view && view.subItems && view.subItems[i];
    const st = view && view.tip && view.tip.stocks && view.tip.stocks[i];
    return { key: res, label: sub ? sub.k : ['银', '粮', '布'][i], value: shown, delta: sub && typeof sub.d === 'number' ? sub.d : 0, unit: (st && st.unit) || ['两', '石', '匹'][i] };
  });
  return {
    rows,
    state: view && view.tip && view.tip.state ? { ...view.tip.state } : null,
    flows: view && view.tip && view.tip.flows ? view.tip.flows.map((f) => ({ label: f.label, text: f.val, unit: f.unit })) : [],
    distorted: !!(view && view.tip && /据奏/.test(view.tip.subtitle || ''))
  };
}
export const treasury = () => ledger('guoku');
export const privy = () => ledger('neitang');

// 户口（据奏：黄册口算历来少报）
export function census() {
  const g = G();
  let pop = (g.population && g.population.national) || {};
  const hj = w.HujiEngine;
  try { if (hj && typeof hj.getPopulationView === 'function') pop = hj.getPopulationView({ root: g }); } catch (_e) { pop = (g.population && g.population.national) || {}; }
  const legacy = g.hukou || {};
  const mouths = pop.displayBasis === 'registered' ? pop.mouths : (pop.mouths || legacy.registeredTotal || 0);
  return {
    mouths: reported('national.mouths', num(mouths), 'bad', 'renli'),
    households: reported('national.households', num(pop.households), 'bad', 'renli'),
    ding: reported('national.ding', num(pop.ding), 'bad', 'renli'),
    fugitives: reported('national.fugitives', num(g.population && g.population.fugitives), 'bad', 'renli'),
    registered: pop.displayBasis === 'registered'
  };
}

// 四项国势：吏治（清明度＝100−浊度）、民心、皇权、皇威。与老顶栏 powerSealData 同一取法：
// 失真层开着且未揭真时显示朝廷所见（perceived），否则真值；seen 是朝廷所见，供「真伪双值」用
export function gauges() {
  const g = G();
  const flip = fn('_barFlipToPerceived');
  const c = g.corruption || {};
  const ct = num(c.trueIndex, num(c.overall));
  const cp = c.perceivedIndex !== undefined ? c.perceivedIndex : ct;
  const lz = flip && flip('corruption', 'index') ? cp : ct;
  const m = g.minxin || {};
  const mt = num(m.trueIndex, num(m.index, num(m.value)));
  const mp = m.perceivedIndex !== undefined ? m.perceivedIndex : mt;
  const mx = flip && flip('minxin', 'index') ? mp : mt;
  const h = g.huangquan || {};
  const hi = num(h.index);
  const wv = g.huangwei || {};
  const wi = num(wv.index);
  return [
    { key: 'lizhi', label: '吏治', value: Math.round(100 - lz), seen: Math.round(100 - cp) },
    { key: 'minxin', label: '民心', value: Math.round(mx), seen: Math.round(mp) },
    { key: 'huangquan', label: '皇权', value: Math.round(hi), seen: Math.round(h.perceivedIndex !== undefined ? h.perceivedIndex : hi) },
    { key: 'huangwei', label: '皇威', value: Math.round(wi), seen: Math.round(wv.perceivedIndex !== undefined ? wv.perceivedIndex : wi) }
  ];
}

// 奏疏：本回合待批的（与老奏疏面板同口径：pending / pending_review）
export function memorials() {
  const g = G();
  const turn = num(g.turn, 1);
  return (g.memorials || []).filter((m) => m && (m.status === 'pending' || m.status === 'pending_review') && (m.turn == null || m.turn <= turn)).map((m) => ({
    id: m.id, from: m.from || '', title: m.title || m.subjectLine || '', body: String(m.content || m.body || ''),
    priority: m.priority || m.urgency || '', turn: m.turn, status: m.status, reply: m.reply || ''
  }));
}

// 人物（在世），供图志与小立轴
export function characters({ limit = 0 } = {}) {
  const list = (G().chars || []).filter((c) => c && c.alive !== false && !c.dead).map((c) => ({
    id: c.id, name: c.name, title: c.officialTitle || c.title || '', faction: c.faction || '', party: c.party || '',
    portrait: c.portrait || '', age: c.age, location: c.location || '', isPlayer: !!c.isPlayer
  }));
  return limit ? list.slice(0, limit) : list;
}

// ---------- 舆图府州：剧本地图坐标 → 舆图世界坐标（用内核山河境的同一套投影） ----------
export function mapRegions() {
  const g = G();
  const P = w.P || {};
  const map = (typeof w.peekMapSource === 'function' && w.peekMapSource()) || g.mapData || g.map || P.mapData || P.map;
  if (!map || !Array.isArray(map.regions) || !map.regions.length) return null;
  const rt = w.TMShanheRuntime;
  const prof = rt && typeof rt.projection === 'function' ? (() => { try { return rt.projection(map); } catch (err) { console.warn('[newui] 地图投影不可用', err); return null; } })() : null;
  if (!prof) return null;
  const m = prof.world;                         // DOMMatrix：地图坐标 → 世界坐标
  const toWorld = (p) => {
    const q = Array.isArray(p) ? { x: p[0], y: p[1] } : p;
    const r = m.transformPoint(new DOMPoint(q.x, q.y));
    return [Math.round(r.x * 100) / 100, Math.round(r.y * 100) / 100];
  };
  const ringOf = (r) => {
    if (Array.isArray(r.points) && r.points.length >= 3) return r.points;
    const geo = r.geometry;
    if (geo && geo.type === 'Polygon' && geo.coordinates && geo.coordinates[0]) return geo.coordinates[0];
    if (geo && geo.type === 'MultiPolygon' && geo.coordinates && geo.coordinates[0]) return geo.coordinates[0][0];
    return null;
  };
  const factions = {};
  const ownerOf = (r) => r.factionId || r.owner || '';
  const facInfo = map.factions || {};
  const regions = [];
  for (const r of map.regions) {
    const ring = ringOf(r);
    if (!ring || ring.length < 3) continue;
    const fid = ownerOf(r);
    if (fid && !factions[fid]) {
      const f = facInfo[fid] || {};
      factions[fid] = { name: f.name || r.factionName || r.ownerName || fid, color: f.color || r.factionColor || r.color || '#999999', short: f.shortName || f.short || '' };
    }
    const center = r.referenceSeat || r.center || r.centroid;
    regions.push({
      id: r.id, name: r.name || '', circuit: r.circuitName || '', parent: r.parentId || '', faction: fid,
      poly: ring.map(toWorld), center: center ? toWorld(center) : toWorld(ring[0])
    });
  }
  return { mapId: map.id, regions, factions };
}
