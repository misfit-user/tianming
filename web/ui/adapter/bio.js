// 列传：一人的全卷。字段与派生取现行人物图志的适配（tm-renwu-tuzhi.js adaptChar，经 TMZhi.__parts 借来），
// 分卷照它：总览、身份、心绪、关系、纪传、家族、记忆、文事、视角、史料。
// 可见之律（照现行图志，另收一处）：
//   · 心声（innerThought）、隐秘（secret / hidden）、私财（privateWealth）不列——现行图志本不列，只有被覆盖的旧六页还直读；
//   · 「君上之疑」只对他人；问对里当面识破的，才写出所隐之事，只隐隐觉出的不写——现行图志两样都写出所隐之事，新界面收紧；
//   · 忠诚、才具等不走奏报失真层（现行图志亦然）。
// 写口一处：对此人的批注，存本机 localStorage「tm_zhubi_<名>」，与现行图志同键，不入存档。
const w = window;
const G = () => w.GM || {};
const n0 = (v, fb = null) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) ? fb : n; };
const r0 = (v) => { const n = n0(v); return n == null ? null : Math.round(n); };
const str = (v) => (v == null ? '' : String(v).trim());
const charOf = (name) => (G().chars || []).find((c) => c && c.name === name) || (G().allCharacters || []).find((c) => c && c.name === name) || null;
const known = (name) => !!charOf(name);
const playerName = () => { try { return (w.P && w.P.playerInfo && w.P.playerInfo.characterName) || ''; } catch (_e) { return ''; } };
const parts = () => (w.TMZhi && w.TMZhi.__parts) || null;

const MOOD = { 喜: '心情愉悦', 怒: '满腔怒火', 忧: '忧心忡忡', 惧: '惴惴不安', 恨: '满怀怨恨', 敬: '心怀敬意', 平: '心境平和' };
const TIER = { imperial: '皇族', noble: '世家', gentry: '士族', common: '寒门' };
const ROLE = { civil: '公职身份', mili: '军中职掌', harem: '内廷与宗室', bu: '生计与身份' };
const SPOUSE = { empress: '皇后', consort: '妃', concubine: '嫔' };
const relWord = (v) => (v == null ? '往来' : v >= 50 ? '莫逆' : v >= 25 ? '亲近' : v <= -50 ? '死敌' : v <= -25 ? '不睦' : '一般');
const toneOf = (v) => (v == null ? '' : v >= 25 ? 'good' : v <= -25 ? 'bad' : '');
const genOf = (rel) => { rel = String(rel || ''); return /祖/.test(rel) ? -2 : /父|母/.test(rel) ? -1 : /孙/.test(rel) ? 2 : /子|女|嗣|儿/.test(rel) ? 1 : 0; };

function banner(p) {
  const turn = n0(G().turn, 0);
  if (p.alive === false) return { glyph: '殁', title: '已殁', note: [str(p.deathReason), p.deathTurn ? `T${p.deathTurn}` : ''].filter(Boolean).join(' · ') };
  if (p._imprisoned) return { glyph: '狱', title: `下诏狱${p._imprisonedTurn != null ? `·已系${Math.max(0, turn - n0(p._imprisonedTurn, 0))}回合` : ''}`, note: str(p._imprisonReason) || '系于狴犴' };
  if (p._exiled) return { glyph: '谪', title: '流放在外', note: str(p._exileReason) || '谪戍边方' };
  if (p._travelTo) return { glyph: '行', title: '赴任途中', note: `${str(p.location)} → ${str(p._travelTo.toLocation || p._travelTo)}` };
  if (p._scheming) return { glyph: '谋', title: '密谋异动', note: '察其交结，谨防其变' };
  return null;
}
function rosterRole(p) {
  const d = p.rosterRole || (p._ref && p._ref.rosterRole);
  if (ROLE[d]) return d;
  if (p.faction === '后宫' || p.faction === '阉党') return 'harem';
  if (!p.officialTitle && !p.title) return 'bu';
  if ((p.military || 0) >= (p.administration || 0) && (p.military || 0) >= 40) return 'mili';
  return 'civil';
}

export function person(name) {
  const c = charOf(name);
  if (!c) throw new Error('此人不在名册');
  const z = parts();
  if (!z || typeof z.adaptChar !== 'function') throw new Error('人物适配未就绪');
  const p = z.adaptChar(c);
  const arcCN = (t) => (z.arcTypeCN ? z.arcTypeCN(t) : t || '纪事');
  const me = playerName();
  const isLord = (n) => n && (n === me || n === '玩家');
  const office = Array.isArray(p.officeTitles) && p.officeTitles.length ? p.officeTitles : [p.officialTitle || p.title || '布衣'].filter(Boolean);
  const wc = p.wuchang || {};
  const go = p.gongmingOrigin || null;
  const relations = (p.relationships || []).map((r) => ({ name: r.name, label: r.label || relWord(r.strength), strength: r.strength, tone: toneOf(r.strength), desc: str(r.description), known: known(r.name) }));
  const impressions = (p.impressions || []).map((x) => ({ name: x.name, favor: x.favor, label: x.label, known: known(x.name) }));
  const blood = (p.bloodRelatives || []).filter((m) => !m.self).map((m) => ({ name: m.name, relation: str(m.relation), generation: m.generation != null ? m.generation : genOf(m.relation), dead: !!m.dead, inLaw: !!m.inLaw, known: known(m.name) }));
  const tk = !p.isPlayer ? impressions.find((x) => isLord(x.name)) : null;
  const doubts = p.isPlayer ? [] : (G()._wdSuspicions || []).filter((s) => s && s.who === p.name).slice().sort((a, b) => (b.turn || 0) - (a.turn || 0))
    .map((s) => ({ turn: s.turn || 0, caught: !!s.caught, hiding: s.caught ? str(s.hiding) : '' }));
  const memory = (p.memory || []).slice().reverse().map((m) => ({ turn: m.turn, emotion: m.emotion || '平', event: str(m.event), who: str(m.who) }));
  const lifeExp = (p.lifeExp || []).filter(Boolean).map((e) => ({ domain: str(e.domain) || '杂', desc: str(e.desc) }));
  const domains = {};
  for (const e of lifeExp) domains[e.domain] = (domains[e.domain] || 0) + 1;
  // 视角：「视某人」——对君上的一条放前头
  const lordRel = !p.isPlayer ? relations.find((r) => isLord(r.name)) : null;
  const eyes = [];
  if (!p.isPlayer && (lordRel || tk)) {
    const sc = (lordRel && lordRel.strength) || (tk && tk.favor) || 0;
    eyes.push({ lord: true, name: me, label: (lordRel && lordRel.label) || (tk && tk.label) || '', tone: sc > 0 ? 'good' : sc < 0 ? 'bad' : '' });
  }
  for (const r of relations) if (!isLord(r.name)) eyes.push({ name: r.name, label: r.label, lean: r.strength == null ? '' : r.strength > 0 ? '亲' : r.strength < 0 ? '疏' : '平', tone: r.tone, known: r.known });
  const consortHouse = p.spouseRank === 'empress' || p.faction === '后宫' || p.isPlayer;
  const children = (p.children || []).filter((x) => x && x !== '—');
  return {
    name: p.name, zi: str(p.zi), isPlayer: !!p.isPlayer, alive: p.alive !== false, portrait: str(p.portrait) || (w.TM && w.TM.WorkshopAssets && w.TM.WorkshopAssets.portraitFor ? str(w.TM.WorkshopAssets.portraitFor(p.name)) : ''),
    age: r0(p.age), gender: str(p.gender), office, rank: str(p.rank), faction: str(p.faction), party: str(p.party), partyRank: str(p.partyRank),
    honorary: Array.isArray(c.honoraryTitles) ? [...new Set(c.honoraryTitles.filter((t) => typeof t === 'string' && t.trim()))] : [],
    location: str(p.location), travelTo: p._travelTo ? str(p._travelTo.toLocation || p._travelTo) : '', banner: banner(p),
    heart: [['忠诚', r0(p.loyalty)], ['野心', r0(p.ambition)], ['压力', r0(p.stress)], ['康健', r0(p.health)], ['廉介', r0(p.integrity)], ['名望', r0(p.mingwang)]],
    eight: [['智', p.intelligence], ['武', p.valor], ['军', p.military], ['政', p.administration], ['管', p.management], ['交', p.diplomacy], ['魅', p.charisma], ['仁', p.benevolence]].map(([k, v]) => [k, r0(v) ?? 0]),
    wuchang: ['仁', '义', '礼', '智', '信'].map((k) => [k, r0(wc[k])]),
    gongming: { merit: p.gongming, tier: str(p.gongmingTier), log: (p.meritLog || []).map((m) => ({ turn: m.turn || 0, delta: n0(m.delta, 0), reason: str(m.reason) })) },
    goal: str(p.personalGoal), traits: (p.traits || []).map((t) => ({ name: t.n, tone: t.c || '' })), personality: str(p.personality),
    identity: [['姓名', p.name], ['字号', p.zi], ['性别', [p.age ? `${p.age}岁` : '', p.gender].filter(Boolean).join('·')], ['籍贯', p.birthplace], ['民族', p.ethnicity], ['信仰', p.faith],
      ['文化', p.culture], ['学识', p.learning], ['立场', p.stance], ['家族', [p.family, TIER[p.familyTier]].filter(Boolean).join('·')], ['辞令', p.speechStyle], ['当前所在', p.location]]
      .map(([k, v]) => [k, str(v)]),
    origin: go ? { title: str(go.title) || '布衣', honors: (go.honors || []).map(str).filter(Boolean), zhengtu: !!go.zhengtu, liupin: go.liupin || 'mid', liupinLabel: str(go.liupinLabel) || '中流',
      ceiling: str(go.ceilingLabel) || '—', youmian: n0(go.youmian, 0), inferred: go.source === 'inferred',
      note: go.qing ? '清要之选·名望素著·阁部储望所归。' : go.yi ? '出身异途·循资有限·易为清议所讥。' : go.wu ? '武职军功·别为一途。' : '科第正途·循资而进。' } : null,
    role: ROLE[rosterRole(p)], appearance: str(p.appearance), bio: str(p.bio),
    mind: { mood: str(p._mood) || '平', moodText: MOOD[p._mood] || '', stress: r0(p.stress) || 0,
      stressLabel: p.stress >= 80 ? '濒于崩溃' : p.stress >= 60 ? '重压在身' : p.stress >= 35 ? '略有焦劳' : '从容自持' },
    toLord: tk ? { favor: tk.favor, label: tk.label } : null, doubts,
    relations, wuwei: p.isPlayer ? [] : (p.wuweiRels || []).map((x) => ({ name: x.name, affinity: x.affinity, trust: x.trust, respect: x.respect, fear: x.fear, hostility: x.hostility, known: known(x.name) })),
    impressions, blood,
    career: [...(p.career || []).map((x) => ({ when: str(x.year), title: str(x.title), desc: str(x.desc), key: !!x.milestone, tag: '履历' })),
      ...(p.arcs || []).slice().sort((a, b) => (a.turn || 0) - (b.turn || 0)).map((a) => ({ when: `T${a.turn}`, title: arcCN(a.type), desc: str(a.desc), tag: '近事' }))],
    post: [['现职', p.officialTitle || p.title || '未仕'], ['品秩', p.rank || '未记'], ['出身', p.learning || '未记'], ['任所', [str(p.location) || '未记', p._travelTo ? str(p._travelTo.toLocation || p._travelTo) : ''].filter(Boolean).join(' → ')]],
    domains: Object.entries(domains), lifeExp,
    family: { tier: TIER[p.familyTier] || '', members: blood.length, fame: r0(p.mingwang), family: str(p.family) },
    house: consortHouse && (p.spouse || children.length) ? { spouse: typeof p.spouse === 'string' ? p.spouse : '', spouseRank: SPOUSE[p.spouseRank] || '', children } : null,
    memory, archive: (p.memArchive || []).map((a) => ({ period: str(a.period), summary: str(a.summary) })),
    arcs: (p.arcs || []).map((a) => ({ turn: a.turn, type: arcCN(a.type), desc: str(a.desc) })),
    works: (p.works || []).map((x) => ({ title: str(x.title), genre: str(x.genre), mood: str(x.mood), turn: x.turn || 0, quality: x.quality || 0, preserved: !!x.preserved })),
    pov: { lead: str(p.personalGoal || p.bio), eyes, stance: str(p.stance) || '未明', side: str(p.party || p.faction) || '无', goal: str(p.personalGoal).slice(0, 26) },
    sourceKey: typeof c.historicalSourceRef === 'string' && /^assets\/reference\/[a-zA-Z0-9_-]+\.json$/.test(c.historicalSourceRef) ? c.historicalSourceRef : '',
    recorded: [['表字', c.zi], ['家族', c.family], ['父', c.father], ['母', c.mother], ['生年', c.birthYear], ['生辰记载', c.birthTime], ['籍贯／出生地', c.birthplace], ['学业', c.learning],
      ['外貌依据', c.appearance], ['爱好', c.hobbies], ['技能说明', Array.isArray(c.skills) ? c.skills.join('、') : c.skills]].filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)]),
    kin: (c.familyMembers || []).filter((m) => m && m.name).map((m) => `${m.relation || '亲属'}：${m.name}${m.note ? '；' + m.note : ''}`),
    fictional: c.isFictional === true || c.type === 'fictional', fictionalNotes: (c.fictionalSources || []).map(String),
    looseSources: [...new Set(['sourceNotes', 'sources', 'historicalSources'].flatMap((k) => (Array.isArray(c[k]) ? c[k] : [])).filter((x) => typeof x === 'string' && x.trim()))],
    officeNote: str(c.officeEvidenceNote)
  };
}

// 史料：独立参考文件（assets/reference/*.json），与现行图志同一读法与校验；逐人条目、五常评定依据
const refCache = new Map();
function loadRef(key) {
  if (!refCache.has(key)) refCache.set(key, fetch(key).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }));
  return refCache.get(key);
}
export async function sources(name) {
  const c = charOf(name);
  if (!c) throw new Error('此人不在名册');
  const out = { entry: null, error: '', wuchang: null, wuchangError: '' };
  const key = typeof c.historicalSourceRef === 'string' && /^assets\/reference\/[a-zA-Z0-9_-]+\.json$/.test(c.historicalSourceRef) ? c.historicalSourceRef : '';
  if (key) {
    try {
      const data = await loadRef(key);
      if (!data || data.schemaVersion !== 1 || data.scenarioId !== c.sid || !data.characters) throw new Error('史料文件与剧本不匹配');
      const e = data.characters[c.historicalSourceKey || c.id];
      if (e) out.entry = { pending: e.status === 'original-pending', quotes: (e.quotes || []).map((q) => ({ book: str(q.book), text: str(q.text), url: /^https:\/\/\S+$/.test(q.url || '') ? q.url : '' })),
        note: str(e.note), refs: (e.references || []).map((q) => ({ book: str(q.book), url: /^https:\/\/\S+$/.test(q.url || '') ? q.url : '' })) };
    } catch (err) { out.error = `史料参考文件读取失败：${err && err.message ? err.message : err}`; }
  }
  const a = c.wuchangAssessment;
  const wkey = a && a.version === 1 && typeof a.reference === 'string' && /^assets\/reference\/[a-zA-Z0-9_-]+\.json$/.test(a.reference) ? a.reference : '';
  if (wkey) {
    try {
      const data = await loadRef(wkey);
      const e = data && data.scenarioId === c.sid && data.characters && data.characters[a.key || c.id];
      const conf = { H: '证据较直接', M: '有解释空间', L: '证据有限／人设估值', F: '虚构设定' };
      if (e) out.wuchang = { rows: ['仁', '义', '礼', '智', '信'].map((k) => [k, `开局 ${e.initialScores ? e.initialScores[k] : '?'} · ${conf[e.confidence && e.confidence[k]] || '未注明'}`]), note: str(e.note),
        refs: (e.sources || []).map((s) => ({ book: str(s.book), url: /^https:\/\/\S+$/.test(s.url || '') ? s.url : '' })) };
      else out.wuchangError = '尚未读取到本人的评定条目。';
    } catch (err) { out.wuchangError = `史料参考文件读取失败：${err && err.message ? err.message : err}。人物的五常数值仍然保留。`; }
  }
  return out;
}

// 对此人的批注（本机）
export function note(name) { try { return w.localStorage.getItem(`tm_zhubi_${name}`) || ''; } catch (_e) { return ''; } }
export function setNote(name, text) {
  const v = String(text || '').trim();
  try { if (v) w.localStorage.setItem(`tm_zhubi_${name}`, v); else w.localStorage.removeItem(`tm_zhubi_${name}`); } catch (_e) { /* 本机存不下就算了 */ }
  return v;
}
