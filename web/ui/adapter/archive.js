// 史馆：四库旧档合成一份目录——史记（GM.shijiHistory，每回合全景）、起居注（GM.qijuHistory）、纪事（GM.jishiRecords，
// 议政与问对的对话）、编年（进行中的事势 ChronicleTracker.getVisible / GM.biannianItems，与永久编年 GM._chronicle）。
// 归类、来源、权威级（信史／存疑／风闻）、人物与势力地域的回填，照老史馆（phase8-formal-records.js shiBuildArchive）。
// 可见之律：史记的「国势升降」取自核心指标快照（GM._metricHistory），是真值之差；奏报失真层开着时不列。
// 写口两处，与老史馆同：起居注可加批注（_annotation），纪事可标要事（_starred）。
const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const str = (v) => (v == null ? '' : typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const arr = (v) => (!v ? [] : Array.isArray(v) ? v.filter(Boolean) : [v]);
const joinArr = (v) => arr(v).map(str).filter(Boolean).join('、');

export const CATS = [
  { key: 'shiji', label: '史记', sub: '回合全景', glyph: '记' },
  { key: 'qiju', label: '起居注', sub: '政务日志', glyph: '居' },
  { key: 'jishi', label: '纪事', sub: '议政对话', glyph: '纪' },
  { key: 'biannian', label: '编年', sub: '事势·年史', glyph: '编' }
];
export const AUTH = { faith: '信史', doubt: '存疑', rumor: '风闻' };

function when(turn, raw) {
  const ts = fn('getTSText');
  if (raw && str(raw.date)) return str(raw.date);
  if (raw && str(raw.time)) return str(raw.time);
  try { if (ts && turn) return String(ts(turn)); } catch (_e) { /* 纪年取不到就只写回合 */ }
  return turn ? `第${turn}回合` : '';
}
// 权威级：authorityLevel / confidence；泄出、机密者存疑
function authority(raw) {
  if (!raw) return 'faith';
  const lv = String(raw.authorityLevel || raw.authority || '');
  const conf = typeof raw.confidence === 'number' ? raw.confidence : null;
  if (/rumor|风闻|fengwen|hearsay/i.test(lv)) return 'rumor';
  if (/doubt|存疑|unverified/i.test(lv)) return 'doubt';
  if (raw.leaked || raw.secret) return 'doubt';
  if (conf != null) { if (conf < 0.6) return 'rumor'; if (conf < 0.72) return 'doubt'; }
  return 'faith';
}
const EDICT_KEYS = ['political', 'military', 'diplomatic', 'economic', 'personnel', 'other'];
const EDICT_SHORT = { political: '政', military: '军', diplomatic: '外', economic: '经', personnel: '人', other: '余' };
function edictList(e) {
  if (Array.isArray(e)) return e.filter(Boolean).map((x) => [x.k || x.type || 'other', str(x.t || x.text || x.content || x)]).filter(([, t]) => t);
  if (e && typeof e === 'object') return EDICT_KEYS.filter((k) => str(e[k])).map((k) => [k, str(e[k])]);
  return [];
}
function lineOf(x) {
  if (!x) return '';
  if (typeof x !== 'object') return String(x);
  const who = x.name || x.character || x.who || x.target || '';
  const what = x.change || x.action || x.desc || x.description || x.content || x.text || x.summary || x.result || '';
  const tail = x.status || x.outcome || x.feedback || '';
  return [who, what, tail].filter(Boolean).join('　');
}

// 史记：国势升降（本回与上回核心指标快照之差，取变动最大前四）
function delta(turn) {
  const RV = w.TM && w.TM.ReportedView;
  try { if (RV && RV.active && RV.active(w.P)) return []; } catch (_e) { /* 判定失败按不失真 */ }
  const hist = G()._metricHistory || [];
  const snap = (t) => { for (let i = hist.length - 1; i >= 0; i--) if (Number(hist[i].turn) === Number(t)) return hist[i]; return null; };
  const cur = snap(turn), prev = snap(turn - 1);
  const labels = (typeof w.CORE_METRIC_LABELS === 'object' && w.CORE_METRIC_LABELS) || {};
  if (!cur || !prev) return [];
  return Object.keys(labels).filter((k) => typeof cur[k] === 'number' && typeof prev[k] === 'number' && Math.abs(cur[k] - prev[k]) >= 1)
    .map((k) => ({ label: labels[k] || k, d: cur[k] - prev[k] }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 4);
}

// 起居注：三种旧式（回合结算的诏令与行止、AI 叙事、实时事件），类目从正文前缀推
function qijuOf(r) {
  const full = str(r.fullText || r.rawText || r.sourceText);
  const out = { cat: str(r.category || r.type), text: '', edicts: [], conduct: '', draft: '' };
  if (full) { out.text = full; out.cat = out.cat || '叙事'; return out; }
  if (r.edicts) {
    out.edicts = edictList(r.edicts).filter(([k]) => k !== 'personnel');
    out.conduct = str(r.xinglu);
    out.draft = r.edictsSource === 'promulgated' ? '颁行稿·已润色' : r.edictsSource === 'original' ? '原文·未润色' : '';
    if (out.edicts.length) out.cat = out.cat || '诏令';
    else if (out.conduct) out.cat = out.cat || '行止';
  }
  if (!out.edicts.length && !out.conduct) out.text = str(r.zhengwen) || str(r.content) || str(r.text) || str(r.summary);
  const t = out.text;
  if (!out.cat) {
    if (/【鸿雁|【驿递|书信/.test(t)) out.cat = '鸿雁';
    else if (/【朝议|【常朝|廷议|经筵/.test(t)) out.cat = '朝议';
    else if (/【奏疏|批复|朱批/.test(t)) out.cat = '奏疏';
    else if (/【诏令|【敕令|诏曰/.test(t)) out.cat = '诏令';
    else if (/【行止|起居/.test(t)) out.cat = '行止';
    else if (/【入京|【任命|【启程|【赴任|任命|罢免|召见/.test(t)) out.cat = '人事';
    else out.cat = '叙事';
  }
  return out;
}
// 纪事来源：mode 为主，没有则从上言里认
function jishiSource(r) {
  const m = r.mode || '', ps = String(r.playerSaid || '');
  if (m === 'changchao') return ['常朝', '朝'];
  if (m === 'yuqian') return ['御前会议', '御'];
  if (m === 'tinyi' || m === 'tingyi' || m === 'tingyi2') return ['廷议', '廷'];
  if (m === 'keyi' || m === 'keju_event') return ['科议', '科'];
  if (m === 'jingyan') return ['经筵', '经'];
  if (m === 'private') return ['问对·私下', '私'];
  if (m === 'formal') return ['问对·正式', '殿'];
  if (m === 'memorial') return ['奏疏', '奏'];
  if (m === 'record') return ['史官归档', '录'];
  if (/抗疏/.test(ps)) return ['抗疏', '抗'];
  if (/奏疏/.test(ps)) return ['奏疏', '奏'];
  if (/鸿雁|书函|来函|书信/.test(ps)) return ['鸿雁', '雁'];
  if (/密报|东厂|侦询/.test(ps)) return ['密报', '密'];
  if (/求见/.test(ps)) return ['求见', '见'];
  if (/朝议/.test(ps)) return ['廷议', '廷'];
  return ['杂录', '录'];
}
const CHRONICLE_TYPE = { keju: '科举', edict: '诏令', scheme: '阴谋', project: '工程', pending_memorial: '奏疏留中', faction_treaty: '势力约期', npc_action: '长期行动',
  tingyi_pending: '廷议待落实', chaoyi_pending: '朝议待执行', changchao_pending: '常朝待落实', dynasty_event: '朝代大事', other: '长期事势' };

// ---------- 合目 ----------
export function catalog() {
  const g = G();
  const chars = Array.isArray(g.chars) ? g.chars : [];
  const byName = new Map(chars.filter((c) => c && c.name).map((c) => [c.name, c]));
  const names = chars.map((c) => c && c.name).filter((n) => n && String(n).length >= 2);
  const personsIn = (text) => { const out = []; const t = String(text || ''); if (!t) return out; for (const n of names) { if (out.length >= 6) break; if (t.includes(n)) out.push(n); } return out; };
  const out = [];
  const push = (e) => out.push(Object.assign({ factions: [], regions: [], persons: [], starred: false, note: '', auth: 'faith' }, e));

  (Array.isArray(g.shijiHistory) ? g.shijiHistory : []).forEach((s, i) => {
    if (!s) return;
    const turn = Number(s.turn || i + 1);
    const personnel = (Array.isArray(s.personnel) ? s.personnel : []);
    const vols = [['实录', s.shilu], ['时政记', s.shizhengji], ['正文', s.zhengwen && s.zhengwen !== s.shizhengji ? s.zhengwen : ''], ['后人戏说', s.houren],
      ['续时政记', s.shizhengji2], ['起居', s.qijuHistory], ['御批回听', s.yupiHuiting]].map(([k, v]) => [k, str(v)]).filter(([, v]) => v);
    push({
      id: `shiji-${i}`, cat: 'shiji', turn, seq: i, when: when(turn, s), type: str(s.szjType || s.type) || '时政', auth: authority(s), starred: !!s._starred,
      title: str(s.szjTitle) || str(s.turnSummary) || `第${turn}回合史记`, summary: str(s.turnSummary || s.szjSummary),
      persons: [...new Set([...personnel.map((p) => p && p.name).filter(Boolean), ...personsIn([s.shilu, s.shizhengji].map(str).join('\n'))])].slice(0, 8), factions: arr(s.factions || s.faction).map(str), regions: arr(s.regions || s.region).map(str),
      vols, personnel: personnel.map(lineOf).filter(Boolean), edicts: edictList(s.edicts), reports: (Array.isArray(s.edictReports) ? s.edictReports : []).map(lineOf).filter(Boolean),
      delta: delta(turn), text: vols.map(([, v]) => v).join('\n')
    });
  });
  (Array.isArray(g.qijuHistory) ? g.qijuHistory : []).forEach((r, i) => {
    if (!r) return;
    const q = qijuOf(r);
    const turn = Number(r.turn || 0);
    const text = q.text || [...q.edicts.map(([k, t]) => `${EDICT_SHORT[k] || '令'}：${t}`), q.conduct && `【行止】${q.conduct}`].filter(Boolean).join('\n');
    push({
      id: `qiju-${i}`, cat: 'qiju', turn, seq: i, when: when(turn, r), type: q.cat, auth: authority(r), starred: !!r._starred, note: str(r._annotation),
      title: text.replace(/^【[^】]{1,16}】/, '').split('\n')[0].slice(0, 40) || q.cat, body: q.text, edicts: q.edicts, conduct: q.conduct, draft: q.draft,
      persons: personsIn(text), factions: arr(r.factions || r.faction).map(str), regions: arr(r.regions || r.region).map(str), text
    });
  });
  (Array.isArray(g.jishiRecords) ? g.jishiRecords : []).forEach((r, i) => {
    if (!r) return;
    const [label, glyph] = jishiSource(r);
    const turn = Number(r.turn || 0);
    const who = str(r.char || r.from);
    const outcome = str(r.outcome || r.finalRuling || r.decree || r.approval);
    push({
      id: `jishi-${i}`, cat: 'jishi', turn, seq: i, when: when(turn, r), type: label, glyph, auth: authority(r), starred: !!r._starred,
      title: (who || '纪事') + (str(r.topic) ? ` · ${str(r.topic)}` : ''), who, topic: str(r.topic), said: str(r.playerSaid), reply: str(r.npcSaid), outcome,
      persons: [...new Set([who, ...personsIn([r.topic, r.playerSaid, r.npcSaid].map(str).join('\n'))].filter(Boolean))].slice(0, 6), factions: arr(r.factions || r.faction).map(str), regions: arr(r.regions || r.region).map(str),
      text: [r.topic, r.playerSaid, r.npcSaid, outcome].map(str).filter(Boolean).join('\n')
    });
  });
  // 编年·进行中的事势
  try {
    const CT = w.ChronicleTracker;
    const vis = CT && typeof CT.getVisible === 'function' ? CT.getVisible() || [] : [];
    vis.forEach((t, i) => {
      if (!t) return;
      const turn = Number(t.startTurn || t.turn || 0);
      const type = str(t.category) || CHRONICLE_TYPE[t.type] || str(t.type) || '长期事势';
      const text = str(t.narrative || t.content || t.desc);
      push({
        id: `affair-${t.id || i}`, cat: 'biannian', sub: 'affair', turn, seq: i, when: when(turn, t), type, auth: authority(t),
        title: str(t.title || t.name) || '长期事势', body: text, actor: str(t.actor || t.owner), status: str(t.currentStage || t.stage || t.status) || '推进中',
        progress: Math.max(0, Math.min(100, Number(t.progress || t.progressPercent || 0) || 0)), endTurn: Number(t.endTurn || 0),
        persons: arr(t.persons).length ? arr(t.persons).map(str) : personsIn(text), factions: arr(t.factions || t.faction).map(str), regions: arr(t.regions || t.region).map(str), text
      });
    });
  } catch (_e) { /* 事势追踪取不到就只列旧事 */ }
  (Array.isArray(g.biannianItems) ? g.biannianItems : []).forEach((it, i) => {
    if (!it) return;
    const start = Number(it.startTurn || it.turn || g.turn || 1);
    const dur = Number(it.duration || it.expectedTurns || 1) || 1;
    const elapsed = Math.max(0, Number(g.turn || start) - start);
    if (it._resolved || it.completed || elapsed >= dur) return;
    const text = str(it.content || it.desc || it.description);
    push({
      id: `item-${it.id || i}`, cat: 'biannian', sub: 'affair', turn: start, seq: i, when: when(start, it), type: str(it.type || it.category) || '长期事项', auth: authority(it),
      title: str(it.title || it.name) || '长期事项', body: text, actor: str(it.actor || it.owner || it.assignee), status: str(it.stage || it.status) || '进行中',
      progress: Math.max(0, Math.min(100, Number(it.progress || it.progressPercent || Math.round((elapsed / dur) * 100)) || 0)), endTurn: start + dur,
      persons: arr(it.persons).length ? arr(it.persons).map(str) : personsIn(text), text
    });
  });
  // 编年·永久编年与年度正史
  (Array.isArray(g._chronicle) ? g._chronicle : []).forEach((c, i) => {
    if (!c || /paradigm|scenario|^system/i.test(String(c.type || ''))) return;   // 系统记账类不入馆（邸报同此）
    const turn = Number(c.turn || 0);
    const title = str(c.title || c.name);
    const text = str(c.content || c.text || c.desc);
    const m = !title && text.match(/^【([^】]{1,30})】/);
    push({
      id: `chron-${i}`, cat: 'biannian', sub: c.afterword || c.annal || /编年|年正史|岁纪/.test(title) ? 'annal' : 'chronicle', turn, seq: i, when: when(turn, c),
      type: str(c.category || c.type) || '史册', auth: authority(c), starred: !!c._starred, title: title || (m ? m[1] : text.slice(0, 30)) || '编年条目',
      body: str(c.annal) || (m ? text.replace(m[0], '').trim() : text), afterword: str(c.afterword), year: str(c.year),
      persons: arr(c.persons).length ? arr(c.persons).map(str) : personsIn(text), factions: arr(c.factions || c.faction).map(str), regions: arr(c.regions || c.region).map(str), text
    });
  });
  // 势力地域回填：旧档多不写，按涉及人物的所属与所在补
  for (const x of out) {
    if (x.factions.length && x.regions.length) continue;
    const fs = new Set(), rs = new Set();
    for (const n of x.persons) { const c = byName.get(n); if (!c) continue; if (c.faction) fs.add(String(c.faction)); const rg = c.location || c.region; if (rg) rs.add(String(rg)); }
    if (!x.factions.length) x.factions = [...fs];
    if (!x.regions.length) x.regions = [...rs];
  }
  // 起居注不存诏令的，借同回合史记的本回诏令
  const sj = new Map(out.filter((x) => x.cat === 'shiji' && x.edicts.length).map((x) => [x.turn, x.edicts]));
  for (const x of out) if (x.cat === 'qiju' && !x.edicts.length && !x.body && sj.has(x.turn)) x.edicts = sj.get(x.turn);
  for (const x of out) x.needle = [x.title, x.type, x.text, x.persons.join(' '), x.factions.join(' '), x.regions.join(' '), x.note].join(' ');
  return out.sort((a, b) => (b.turn || 0) - (a.turn || 0) || (b.seq || 0) - (a.seq || 0));
}

// ---------- 写口 ----------
function rawOf(id) {
  const m = String(id || '').match(/^(qiju|jishi)-(\d+)$/);
  if (!m) return null;
  const list = G()[m[1] === 'qiju' ? 'qijuHistory' : 'jishiRecords'];
  return Array.isArray(list) ? list[Number(m[2])] || null : null;
}
export function annotate(id, text) {
  if (!/^qiju-/.test(String(id))) throw new Error('只有起居注可加批注');
  const r = rawOf(id);
  if (!r) throw new Error('此条已不在起居注中');
  r._annotation = String(text || '').trim();
  return r._annotation;
}
export function star(id) {
  if (!/^jishi-/.test(String(id))) throw new Error('只有纪事可标要事');
  const r = rawOf(id);
  if (!r) throw new Error('此条已不在纪事中');
  r._starred = !r._starred;
  return r._starred;
}
