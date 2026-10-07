// 朝野·党派与阶层。内容与次序照老右栏的党派、阶层两页（phase8-formal-rightrail-social.js：rightSocialPartyDetail /
// rightSocialClassDetail 及其后的近账、近因、生态、事链、行动诸节）；文字本地化、近因、阶层代表人物借老右栏导出的
// TM.__p8RailParts（rightSocialLocalizeText / rightSocialNearCauses / rightClassCharacterDelegateName），取不到时用本文件的退路。
// 可见之律：
//   · 阶层满意走奏报失真层（键 minxin / class.<名>，与老右栏 rightSocSatReported 同）；据奏未揭真时，由真满意推出的
//     趋势、结构压力、乱民、势位、地域分账、满意近账、近因、阶层民心一概封存——老右栏在这些地方仍露真值，新界面不露；
//   · 党派的「方略」（strategy）、阶层与党派的「触怒阈」（offendThresholds）、民变阈（unrestLevels）、阶层民变状态机
//     （revoltState）是推演用的规则与内部钟，不列（老右栏也不列）。
// 动作三样同老右栏：召党魁／召代表（问对）、付廷议（写入 GM._pendingTinyiTopics 再开廷议）、拟平衡诏／拟安抚诏（议事清册）。
import { suggest } from './edict.js';

const w = window;
const G = () => w.GM || {};
const rail = () => (w.TM && w.TM.__p8RailParts) || {};
const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '') : v == null || v === '' ? [] : [v]);
const n0 = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const numOf = (o, keys, fb) => { for (const k of keys) { const n = Number(o && o[k]); if (o && o[k] !== '' && o[k] != null && Number.isFinite(n)) return Math.max(0, Math.min(100, n)); } return fb; };
const nameOf = (r) => String((r && (r.name || r.label || r.id || r.className || r.partyName)) || '').trim();
const same = (a, b) => { a = String(a || '').replace(/\s+/g, '').toLowerCase(); b = String(b || '').replace(/\s+/g, '').toLowerCase(); return !!(a && b && a === b); };
function loc(v) {
  const f = rail().rightSocialLocalizeText;
  if (f) { try { return String(f(v) || ''); } catch (_e) { /* 本地化失败就原样 */ } }
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(loc).filter(Boolean).join(' / ');
  if (typeof v === 'object') return String(v.display || v.text || v.name || v.topic || v.title || v.goalText || v.demandText || v.goal || v.agenda || v.demand || v.reason || '');
  return String(v).trim();
}
const brief = (v) => loc(Array.isArray(v) ? v.find(Boolean) : v);
const text = (v) => (v == null ? '' : Array.isArray(v) ? v.map(text).filter(Boolean).join('、') : typeof v === 'object' ? loc(v) : String(v).trim());
const charByName = (n) => (G().chars || []).find((c) => c && c.name === n) || null;
const alive = (n) => { const c = charByName(n); return !!(c && c.alive !== false && !c.dead); };
const nameHead = (s) => String(s || '').split(/[（(]/)[0].trim();
const flipped = (domain) => { const f = typeof w._barFlipToPerceived === 'function' ? w._barFlipToPerceived : null; try { return !!(f && f(domain, 'index')); } catch (_e) { return false; } };
export const SEALED_NOTE = '据奏之数——实情须厂卫、推问、查案方得掀见';

// ---------- 共用：近因、议题、裁决、生态、行动 ----------
function causes(type, row) {
  const f = rail().rightSocialNearCauses;
  let list = [];
  if (f) { try { list = f(type, row) || []; } catch (_e) { list = []; } }
  return list.slice(0, 4).map((c) => ({ turn: c.turn, source: loc(c.source), text: loc(c.text) })).filter((c) => c.text);
}
function issueLinks(type, name) {
  const g = G(), out = [];
  const add = (raw) => {
    if (!raw) return;
    const topic = raw.topic || raw.title || raw.goalText || raw.reason || '';
    if (!topic) return;
    const id = String(raw.issueId || raw.id || raw.topicId || raw.chaoyiTrackId || topic);
    if (out.some((x) => x.id === id)) return;
    out.push({ id, topic: loc(topic) });
  };
  for (const x of arr(g._partyClassCourtIssueLinks)) if (type === 'party' ? same(x.party, name) : same(x.className, name)) add(x);
  for (const x of arr(g._pendingTinyiTopics)) if (type === 'party' ? same(x.party, name) || same(x.sourceParty, name) : same(x.className, name) || same(x.sourceClass, name)) add(x);
  return out.slice(0, 3);
}
function recentRuling(type, name, issues) {
  const g = G();
  const topics = issues.map((x) => x.topic);
  const rows = [...arr(g.tinyiSeals), ...arr(g._courtRecords)];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i] || {};
    const topic = String(r.topic || r.title || '');
    const hit = type === 'party' ? same(r.sourceParty, name) || same(r.party, name) : same(r.sourceClass, name) || same(r.className, name);
    const ih = topic && topics.some((t) => t && (topic.includes(t) || t.includes(topic)));
    if (hit || ih) return [loc(r.sealStatus || r.status || r.result || r.decision) || '裁决', r.grade || ''].filter(Boolean).join(' ');
  }
  return '';
}
function ecology(type, name) {
  const g = G();
  const key = type === 'party' ? 'partyName' : 'className';
  const edges = arr(g.partyClassRelations && g.partyClassRelations.edges).filter((e) => e && same(e[key], name));
  for (const e of arr(g._partyGoalRelationIndex && g._partyGoalRelationIndex.evidence)) {
    if (!e || !same(e[key], name)) continue;
    if (edges.some((x) => same(x.className, e.className) && same(x.partyName, e.partyName))) continue;
    edges.push(e);
  }
  const pct = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : '—');
  const list = edges.sort((a, b) => n0(b.affinity) - n0(a.affinity)).slice(0, 4).map((e) => ({
    peer: String(type === 'party' ? e.className : e.partyName || ''), status: loc(e.status || 'latent'), affinity: pct(e.affinity), trust: pct(e.trust), grievance: pct(e.grievance),
    note: loc([e.lastSource || e.source, e.lastReason || e.reason].filter(Boolean).join(' · '))
  }));
  const field = type === 'party' ? 'affectedParties' : 'affectedClasses';
  const signals = arr(g._partyClassEcology && g._partyClassEcology.signalHistory).filter((s) => s && arr(s[field]).some((x) => same(x, name)))
    .slice(-3).reverse().map((s) => ({ turn: s.turn, kind: loc(s.kind), note: loc([s.source, arr(s.categories).join('、')].filter(Boolean).join(' · ')) }));
  return { edges: list, signals };
}
const ROLE = { patron: '庇护', broker: '调停', suppressor: '压制', symbol: '象征', debtor: '亏欠', enemy: '仇怨' };
function actorActions(type, row) {
  const g = G(), name = nameOf(row), seen = new Set();
  const src = [...arr(type === 'party' ? g.party_actions : g.class_actions), ...arr(row && (type === 'party' ? row.party_actions : row.class_actions))];
  return src.filter((a) => {
    if (!a || a.actorType !== type || !same(a.actorId, name)) return false;
    if (/expired|resolved|cancelled|canceled/i.test(String(a.status || ''))) return false;
    const k = a.id || [a.actorType, a.actorId, a.actionType, a.linkedIssue, a.turn].join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(-4).reverse().map((a) => {
    const pend = arr(g._pendingTinyiTopics).find((t) => a.linkedIssue && String(t.issueId || t.id || t.topicId || t.linkedIssue || '') === String(a.linkedIssue));
    return {
      head: loc([a.turn != null ? `T${a.turn}` : '', a.actionType || a.action || 'action', a.status || 'planned'].filter(Boolean).join(' · ')),
      body: loc([a.agenda || a.grievance || '', a.delegateCharacter ? `代理人物：${a.delegateCharacter}${a.delegateRole ? `（${ROLE[String(a.delegateRole).toLowerCase()] || '代表'}）` : ''}` : '',
        a.delegateEvidence ? `近因：${loc(a.delegateEvidence)}` : '', pend && pend.topic ? `廷议 ${pend.topic}` : a.linkedIssue ? `议题 ${a.linkedIssue}` : '', a.source || ''].filter(Boolean).join(' · ')) || '自主压力'
    };
  });
}

// ---------- 党派 ----------
const STANDING = { governing: '秉政', opposition: '在野', marginal: '边缘' };
const LEADERSHIP = { chief: '党魁', deputy: '副手', spokesman: '喉舌', enforcer: '爪牙', strategist: '谋主', financier: '金主', scholar: '学宗', patron: '奥援', former: '前魁', field: '疆吏', legacy: '遗风' };
// 「韩爌(蒲州)」「沈一贯(已死)」：名与括注分开；名不在人物册里的（如「汤宾尹遗风」「(空缺)」）只作文字
const who = (s) => { const m = String(s || '').trim().match(/^([^（(]*)[（(]([^）)]*)[）)]?/); const name = (m ? m[1] : String(s || '')).trim(); return { name, note: m ? m[2].trim() : '', known: !!charByName(name) }; };
const partyState = (name) => (G().partyState || {})[name] || {};
const partyList = () => arr(G().parties).length ? arr(G().parties) : arr(w.P && w.P.parties);
function relOf(p) {
  const st = partyState(p.name);
  return { allies: arr(st.alliedWith || p.allies).map(String), foes: arr(st.conflictWith || p.enemies || p.rivals).map(String), neutrals: arr(st.neutralWith || p.neutrals).map(String) };
}
function standingOf(p) { return STANDING[p.standing || partyState(nameOf(p)).standing] || ''; }
function membersOf(p) {
  const list = arr(p._memberChars).length ? arr(p._memberChars) : String(text(p.members) || '').split(/[·、,，\s]+/);
  return [...new Set(list.map((x) => nameHead(typeof x === 'object' ? x.name : x)).filter(Boolean))];
}
export function parties() {
  return partyList().filter((p) => p && nameOf(p)).map((p) => {
    const r = relOf(p);
    const status = String(p.status || p.state || '');
    return { key: nameOf(p), name: nameOf(p), standing: standingOf(p), status: loc(status), influence: Math.round(numOf(p, ['influence', 'power', 'weight'], 0)),
      cohesion: Math.round(numOf(p, ['cohesion', 'unity'], 50)), allies: r.allies.length, foes: r.foes.length, hot: /活跃|active/i.test(status),
      brief: brief(p.currentAgenda || p.agenda || p.shortGoal).slice(0, 44), leader: nameHead(p.leader || p.head) };
  }).sort((a, b) => b.influence - a.influence);
}
export function party(key) {
  const p = partyList().find((x) => x && same(nameOf(x), key));
  if (!p) throw new Error('此党已不在');
  const name = nameOf(p);
  const r = relOf(p);
  const influence = Math.round(numOf(p, ['influence', 'power', 'weight'], 0));
  const cohesion = Math.round(numOf(p, ['cohesion', 'unity'], 50));
  const issues = issueLinks('party', name);
  const demand = brief(p.shortGoal || p.currentAgenda || p.agenda);
  const risk = cohesion < 45 ? '凝聚偏低，易分裂' : influence > 70 ? '党势偏盛，易阻挠' : p.shortGoal || p.currentAgenda ? '目标推进中' : '暂无明显风险';
  const st = partyState(name);
  const ledger = arr(st.historyLog).slice(-4).reverse().map((e) => {
    const d = n0(e.delta != null ? e.delta : e.influenceDelta);
    if (!d && !e.reason) return null;
    return { turn: e.turn, label: e.field === 'cohesion' ? '凝聚' : '影响', d: Math.round(d * 10) / 10, why: loc(e.reason).slice(0, 44) };
  }).filter(Boolean);
  const years = [['立', p.foundYear], ['盛', p.peakYear], ['衰', p.declineYear]].filter(([, y]) => y).map(([k, y]) => `${k}于${y}`).join('　');
  const lead = p.leadership && typeof p.leadership === 'object' ? Object.keys(p.leadership).filter((k) => p.leadership[k])
    .map((k) => ({ role: LEADERSHIP[k] || k, people: String(text(p.leadership[k])).split(/[·、,，]+/).map(who).filter((x) => x.name || x.note) })).filter((l) => l.people.length) : [];
  return {
    name, short: name.charAt(0), status: loc(p.status || p.state || ''), standing: standingOf(p), influence, cohesion, hot: /活跃|active/i.test(String(p.status || '')),
    faction: text(p.faction), desc: text(p.description || p.desc),
    leader: who(p.leader || p.head), lead, members: membersOf(p).map(who), memberCount: n0(p.memberCount, 0),
    rows: [['立场', loc(p.ideology || p.stance)], ['支持群体', loc(p.base || p.supportBase)], ['当前议程', brief(p.currentAgenda || p.agenda)], ['短期目标', brief(p.shortGoal)],
      ['长期追求', brief(p.longGoal)], ['组织', text(p.org)], ['势力凭借', text(p.influenceDesc)], ['宿敌', text(p.rivalParty)], ['兴衰', years],
      ['分自', text(p.splinterFrom)], ['并入', text(p.mergedWith)]].filter(([, v]) => v),
    stances: arr(p.policyStance || p.stances).map(loc).filter(Boolean),
    offices: arr(p.officePositions).map(text).filter(Boolean),
    base: arr(p.socialBase || p.social_base || p.baseClasses).map((b) => (typeof b === 'object' ? { cls: String(b.class || b.className || b.name || ''), affinity: n0(b.affinity, NaN) } : { cls: String(b), affinity: NaN })).filter((b) => b.cls),
    allies: r.allies, foes: r.foes, neutrals: r.neutrals,
    strengths: arr(p.strengths).map(text).filter(Boolean), weaknesses: arr(p.weaknesses).map(text).filter(Boolean),
    disputes: arr(p.focal_disputes).filter((d) => d && d.topic).map((d) => ({ topic: text(d.topic), rival: text(d.rival), stakes: text(d.stakes) })),
    agendaHistory: arr(p.agenda_history).slice(-6).reverse().map((a) => ({ turn: a.turn, agenda: loc(a.agenda || a.currentAgenda || a.text), outcome: loc(a.outcome || a.reason) })).filter((a) => a.agenda),
    history: text(p.history), ledger, causes: causes('party', p), ecology: ecology('party', name),
    chain: { demand: demand || '近期目标', party: name, issue: issues[0] ? issues[0].topic : '', ruling: recentRuling('party', name, issues), risk },
    actions: actorActions('party', p), audience: audienceOf('party', p)
  };
}

// ---------- 阶层 ----------
const classList = () => [arr(G().classes), arr(w.P && w.P.classes), arr(w.P && w.P.socialClasses)].find((l) => l.length) || [];
function satOf(c) {
  const t = numOf(c, ['satisfaction', 'support', 'mood', 'loyalty'], 50);
  const RV = w.TM && w.TM.ReportedView;
  if (!RV || typeof RV.value !== 'function') return { shown: t, sealed: false };
  try {
    const r = RV.value('minxin', `class.${nameOf(c)}`, t, { direction: 'good' });
    return { shown: n0(r.shown, t), sealed: r.basis === 'reported' };
  } catch (_e) { return { shown: t, sealed: false }; }
}
function trendOf(c) {
  const turn = n0(G().turn, 0);
  const t = arr(c._satLedger).filter((e) => n0(e.t, -1) >= turn - 1).reduce((s, e) => s + n0(e.d), 0);
  return Math.round(t * 10) / 10;
}
function pressureOf(c) {
  const base = Number(c._structBaseline);
  if (!Number.isFinite(base)) return '';
  const sat = numOf(c, ['satisfaction', 'support', 'mood', 'loyalty'], 50);
  return base - sat >= 8 ? '回升中' : sat - base >= 8 ? '承压' : '';
}
function radicalOf(c) {
  const rf = Number(c._radicalFrac);
  if (!Number.isFinite(rf) || rf < 0.2) return '';
  return `乱民${Math.round(rf * 10)}成·${rf < 0.4 ? '不稳' : rf < 0.6 ? '汹汹' : '鼎沸'}`;
}
const AGENDA_KIND = { seed: '本位诉求', ai: '时局诉求' };
const EI_LABEL = { wealth: '家资', taxBurden: '赋负', landHolding: '田产' };
function classParties(c, name) {
  const g = G();
  const list = [...arr(c.supportingParties), ...arr(c.supporting_parties), ...arr(c.parties), ...arr(c.linkedParties),
    ...arr(g._partyGoalRelationIndex && g._partyGoalRelationIndex.classParties && g._partyGoalRelationIndex.classParties[name]),
    ...arr(g._partyClassCourtIssueLinks).filter((x) => x && same(x.className, name)).map((x) => x.party)];
  return [...new Set(list.map((x) => text(x)).filter(Boolean))].slice(0, 3);
}
function classEdges(c, name) {
  const seen = new Set(), out = [];
  const add = (e) => {
    if (!e || !same(e.className, name)) return;
    const k = `${e.characterId || e.characterName || ''}|${e.role || ''}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };
  arr(c.classCharacterRelations).forEach(add);
  arr(G().classCharacterRelations && G().classCharacterRelations.edges).forEach(add);
  const score = (e) => n0(e.affinity) + n0(e.legitimacy) + n0(e.trust) + n0(e.mobilization) * 0.4 - n0(e.grievance) * 0.7;
  return out.sort((a, b) => score(b) - score(a)).slice(0, 8);
}
function minxinOf(c, name) {
  const g = G();
  const by = (g.minxin && g.minxin.byClass) || {};
  let key = '';
  try { key = w.TM && w.TM.ClassMinxinBridge && w.TM.ClassMinxinBridge._classKeyOf ? w.TM.ClassMinxinBridge._classKeyOf(c) : ''; } catch (_e) { key = ''; }
  key = key || c.classKey || c.key || c.id || c.classId || name.replace(/[\s·、，,]/g, '').toLowerCase();
  let mx = by[key];
  if (!mx) for (const k of Object.keys(by)) { const v = by[k]; if (v && (same(v.className, name) || k === key)) { mx = v; break; } }
  const ledger = arr(g._classMinxinBridgeLedger).filter((x) => x && (String(x.classKey) === String(key) || same(x.className, name))).slice(-3).reverse()
    .map((x) => ({ turn: x.turn, source: loc(x.sourceSystem || 'class-minxin'), note: loc([x.linkedIssue, x.region, x.reason].filter(Boolean).join(' · ')) }));
  if (!mx && !ledger.length) return null;
  const tv = mx ? n0(mx.true != null ? mx.true : mx.index, NaN) : NaN;
  return { true: Number.isFinite(tv) ? Math.round(tv) : null, perceived: mx ? Math.round(n0(mx.perceived, tv)) : null, phase: mx ? loc(mx.unrestPhase || 'calm') : '',
    pressure: mx && mx.lastPressure ? loc(mx.lastPressure.reason) : '', ledger };
}
export function classes() {
  const list = classList().filter((c) => c && nameOf(c));
  return list.map((c) => {
    const s = satOf(c);
    return { key: nameOf(c), name: nameOf(c), sat: Math.round(s.shown), sealed: s.sealed, influence: Math.round(numOf(c, ['influence', 'power', 'weight'], 0)),
      trend: s.sealed ? 0 : trendOf(c), pressure: s.sealed ? '' : pressureOf(c), radical: s.sealed ? '' : radicalOf(c),
      brief: brief(c.demands || c.currentDemand).slice(0, 44) };
  }).sort((a, b) => b.influence - a.influence);
}
// 阶层总览：平均满意（据奏）、天命权重（权贵满意与民心之差，民心失真未揭时封存）
export function classOverview() {
  const list = classes();
  const lg = G()._legitimacy;
  return { avg: list.length ? Math.round(list.reduce((s, c) => s + c.sat, 0) / list.length) : 0, sealedAny: list.some((c) => c.sealed),
    legitimacy: lg && lg.flag ? (flipped('minxin') ? { sealed: true } : { clout: Math.round(n0(lg.clout)), pop: Math.round(n0(lg.pop)), flag: String(lg.flag) }) : null };
}
export function klass(key) {
  const c = classList().find((x) => x && same(nameOf(x), key));
  if (!c) throw new Error('此阶层已不在');
  const name = nameOf(c);
  const s = satOf(c);
  const sealed = s.sealed;
  const influence = Math.round(numOf(c, ['influence', 'power', 'weight'], 0));
  const issues = issueLinks('class', name);
  const sat = numOf(c, ['satisfaction', 'support', 'mood', 'loyalty'], 50);
  const unrest = c.unrestLevels || {};
  const risk = sat < 30 || n0(unrest.revolt) >= 70 ? '民变苗头' : n0(unrest.strike) >= 60 ? '罢工/聚众风险' : sat < 45 ? '请愿升温' : '风险平稳';
  const edges = classEdges(c, name);
  const pct = (v) => { const n = Number(v); if (!Number.isFinite(n)) return '—'; return Math.round(Math.max(0, Math.min(100, Math.abs(n) <= 1 ? n * 100 : n))); };
  const person = (e) => ({ name: String(e.characterName || e.characterId), role: ROLE[String(e.role || '').toLowerCase()] || '代表', affinity: pct(e.affinity), trust: pct(e.trust), grievance: pct(e.grievance),
    note: loc(arr(e.evidence).slice(-2).join(' / ') || e.reason || e.source) });
  const isFoe = (e) => /suppressor|enemy/i.test(String(e.role || '')) || n0(e.grievance) >= 0.45;
  const reps = edges.filter((e) => !isFoe(e)).slice(0, 3);
  const bene = edges.filter((e) => !reps.includes(e) && !isFoe(e) && n0(e.affinity) >= 0.45).slice(0, 3);
  const foes = edges.filter(isFoe).slice(0, 3);
  const del = actorActions('class', c).length ? arr(G().class_actions).concat(arr(c.class_actions)).find((a) => a && same(a.actorId, name) && a.delegateCharacter) : null;
  const delegate = (del && del.delegateCharacter) || (edges.find((e) => !/suppressor|enemy/i.test(String(e.role || '')) && n0(e.grievance) < 0.5) || {}).characterName || '';
  const ei = c.economicIndicators && typeof c.economicIndicators === 'object' ? Object.keys(c.economicIndicators).filter((k) => Number.isFinite(Number(c.economicIndicators[k])))
    .map((k) => ({ label: EI_LABEL[k] || k, value: Math.round(Number(c.economicIndicators[k])) })) : [];
  const parties = classParties(c, name);
  const size = [text(c.size || c.population || c.scale), c.populationEstimate ? `约${Math.round(n0(c.populationEstimate))}口` : ''].filter(Boolean).join('　');
  return {
    name, short: name.charAt(0), sat: Math.round(s.shown), sealed, sealedNote: sealed ? SEALED_NOTE : '', influence,
    trend: sealed ? 0 : trendOf(c), pressure: sealed ? '' : pressureOf(c), radical: sealed ? '' : radicalOf(c),
    desc: text(c.description || c.desc),
    rows: [['规模', size], ['经济角色', text(c.economicRole || c.role)], ['法律地位', text(c.status)], ['流动性', text(c.mobility)], ['特权', text(c.privileges)], ['义务', text(c.obligations)],
      ['诉求', brief(c.demands || c.currentDemand)],
      ['势位(应然)', sealed || !Number.isFinite(Number(c._structBaseline)) ? '' : [Math.round(Number(c._structBaseline)), ...arr(c._structParts).slice(0, 2).map(loc)].join(' · ')]].filter(([, v]) => v),
    indicators: ei,
    factions: arr(c.internalFaction).filter((f) => f && f.name).map((f) => ({ name: text(f.name), size: text(f.size), stance: text(f.stance) })),
    agenda: arr(c._agenda && c._agenda.items).slice().sort((a, b) => n0(b.urgency, 1) - n0(a.urgency, 1)).slice(0, 6).map((it) => {
      const dur = it.sinceTurn != null ? Math.max(0, n0(G().turn) - n0(it.sinceTurn)) : 0;
      return { text: String(it.text || '').slice(0, 20) + (dur >= 2 ? `·${dur}回合` : ''), kind: AGENDA_KIND[it.kind] || '结构诉求', urgency: Math.max(1, Math.min(3, n0(it.urgency, 1))) };
    }),
    movements: arr(G()._politicalMovements).filter((m) => m && m.className === name).slice(0, 3).map((m) => ({ label: `运动·${loc(m.label || m.kind)}·${loc(m.phase)}${Math.round(n0(m.support))}`, level: n0(m.support) >= 70 ? 3 : n0(m.support) >= 40 ? 2 : 1 })),
    regions: sealed ? [] : arr(c.regionalVariants).filter((v) => v && v.region && Number.isFinite(Number(v.satisfaction))).sort((a, b) => a.satisfaction - b.satisfaction).slice(0, 4)
      .map((v) => ({ region: String(v.region), sat: Math.round(v.satisfaction), base: Number.isFinite(Number(v._structBaseline)) ? Math.round(v._structBaseline) : null, note: text(v.distinguishing).slice(0, 22) })),
    ledger: sealed ? [] : arr(c._satLedger).slice(-4).reverse().map((e) => ({ turn: e.t, d: n0(e.d), why: loc(e.why || e.src).slice(0, 44) })),
    causes: sealed ? [] : causes('class', c), minxin: sealed ? null : minxinOf(c, name),
    representatives: [...arr(c.representativeNpcs), ...arr(c.leaders)].map((x) => who(typeof x === 'object' ? x.name : x)).filter((x, i, a) => x.name && a.findIndex((y) => y.name === x.name) === i),
    people: { reps: reps.map(person), bene: bene.map(person), foes: foes.map(person) },
    ecology: ecology('class', name), parties,
    chain: { demand: brief(c.currentDemand || c.demands) || '阶层诉求', delegate, party: parties[0] || '', issue: issues[0] ? issues[0].topic : '', ruling: recentRuling('class', name, issues), risk },
    actions: actorActions('class', c), audience: audienceOf('class', c)
  };
}

// ---------- 动作 ----------
// 召党魁／召代表：只给在世、在册的人；老右栏查不到人时会把「某党中主事」这类虚名递给问对，新界面不递
function audienceOf(type, row) {
  const name = nameOf(row);
  const cands = [];
  if (type === 'party') {
    cands.push(nameHead(row.leader || row.head));
    for (const c of G().chars || []) if (c && (same(c.party, name) || same(c.faction, name) || same(c.group, name))) cands.push(c.name);
  } else {
    const f = rail().rightClassCharacterDelegateName;
    if (f) { try { cands.push(String(f(row) || '')); } catch (_e) { /* 取不到就看代表名册 */ } }
    for (const e of classEdges(row, name)) if (!/suppressor|enemy/i.test(String(e.role || '')) && n0(e.grievance) < 0.55) cands.push(e.characterName || e.characterId);
    cands.push(...arr(row.representativeNpcs).map(nameHead), ...arr(row.leaders).map((x) => nameHead(typeof x === 'object' ? x.name : x)));
  }
  return cands.find((n) => n && alive(n)) || '';
}
function findRow(type, key) {
  const list = type === 'party' ? partyList() : classList();
  const r = list.find((x) => x && same(nameOf(x), key));
  if (!r) throw new Error(type === 'party' ? '此党已不在' : '此阶层已不在');
  return r;
}
function summary(type, row) {
  const c = causes(type, row)[0];
  const head = type === 'party' ? brief(row.shortGoal || row.currentAgenda || row.agenda) : brief(row.currentDemand || row.demands);
  return [head, c ? c.text : ''].filter(Boolean).join('；');
}
// 付廷议：照老右栏 rightPushSocialCourtTopic 写一条待议，返回议题，屏幕随即开廷议
export function courtTopic(type, key) {
  const g = w.GM;
  if (!g) throw new Error('尚未开局');
  const row = findRow(type, key);
  const name = nameOf(row);
  const party = type === 'party';
  const goalText = party ? brief(row.shortGoal || row.currentAgenda || row.agenda) : '';
  const demandText = party ? '' : brief(row.currentDemand || row.demands);
  const delegate = party ? nameHead(row.leader || row.head) : audienceOf('class', row);
  const ch = delegate ? charByName(delegate) : null;
  const topic = party ? `党议·${name}·${goalText || '近期目标'}·请付廷议` : `民情·${name}·${demandText || '阶层诉求'}·请付廷议`;
  const item = { topic, from: 'phase8-social-action', sourceType: party ? 'party_goal' : 'class_pressure', turn: g.turn || 1, status: 'pending', priority: party ? 74 : 78,
    reason: loc(summary(type, row) || topic), delegateCharacter: delegate || '', delegateCharacterId: ch ? ch.id || ch.name : delegate || '', linkedCharacters: delegate ? [delegate] : [] };
  if (party) Object.assign(item, { party: name, sourceParty: name, goalText, linkedParties: [name] });
  else Object.assign(item, { className: name, sourceClass: name, demandText, linkedClasses: [name] });
  if (!Array.isArray(g._pendingTinyiTopics)) g._pendingTinyiTopics = [];
  g._pendingTinyiTopics.unshift(item);
  if (g._pendingTinyiTopics.length > 80) g._pendingTinyiTopics = g._pendingTinyiTopics.slice(0, 80);
  return topic;
}
// 拟平衡诏／拟安抚诏：文字照老右栏 rightSocialEdict
export function edictDraft(type, key) {
  const row = findRow(type, key);
  const name = nameOf(row);
  const party = type === 'party';
  const sum = summary(type, row);
  const topic = party ? `${name}党势调停` : `${name}阶层安抚`;
  const content = (party ? `命内阁核议${name}近来议程与朋党动向，分别安抚其合理诉求、约束其过激营私，并回奏可行章程。`
    : `命有司核实${name}近来诉求与地方影响，酌拟安抚、减负、申禁侵扰之策，并限期回奏。`) + (sum ? `近因：${sum}` : '');
  suggest(party ? '党派纲纪' : '阶层民情', name, topic, content);
  return `已纳入议事清册：${name}`;
}
