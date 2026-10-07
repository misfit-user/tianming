// 科举（书目「科」）：制度概况、历届、特科与学派，以及正在办的一科从地方举送到金榜放榜的每一步。
// 老界面在 tm-keju.js（openKejuPanel 制度面板）、tm-keju-runtime.js（showKejuModal → renderKejuStage 分阶段，按天推进
// advanceKejuByDays）、tm-keju-runtime-keyi.js（放榜、阅卷、纳入人物志、授官、finishKeju）、tm-keju-question-ui.js（题旨契合）。
// 阶段与名目一律问内核（_kejuStagePlan / _kejuStageName / _kejuStageDays / _kejuHasImperialExam），动作调内核原函数——
// 老科举弹层不开，那些函数找不到 #huishi-topic、#dianshi-question 便读写 exam 上的字段，正合用。
// 认领的老浮层：#keju-modal / #keju-panel-modal（改开新册）、#keju-urgent-banner（待办浮条 → keju:urgent，书目「科」亮起）、
// #dianshi-progress-modal（殿试进度，照建挪画外，读成 keju:progress）、制度激活的结果卷（→ keju:outcome）。
// 答卷：内核 viewAnswer 生成后会自开老卷，这里临时把 showAnswerModal 换成空，由新前端自画。
import { bus } from '../core/bus.js';
import { claimOverlays, legacyMutation } from './kernel.js';

const w = window;
const G = () => w.GM || {};
const K = () => (w.P && w.P.keju) || {};
const $ = (id) => document.getElementById(id);
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
function call(name, ...args) {
  const f = fn(name);
  if (!f) throw new Error('内核缺 ' + name);
  return f(...args);
}
const n0 = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const findChar = (name) => (fn('findCharByName') ? w.findCharByName(name) : (G().chars || []).find((c) => c && c.name === name)) || null;
const changed = () => bus.emit('game:changed', { what: 'keju' });
const fmtDate = (d) => (fn('_kejuFmtDate') ? w._kejuFmtDate(d) : d && d.year != null ? `${d.year}年${d.month != null ? d.month + '月' : ''}` : String(d || ''));

// ---------- 老浮层 ----------
const outcomeModal = (n) => n.classList && n.classList.contains('modal-bg') && /keju-panel-modal/.test(n.innerHTML || '') && /确认/.test(n.textContent || '');
claimOverlays((n) => {
  if (n.id === 'keju-modal' || n.id === 'keju-panel-modal') { n.remove(); bus.emit('ui:keju', {}); return true; }
  if (n.id === 'keju-urgent-banner') {
    const parts = [...n.querySelectorAll('div')].map((d) => clean(d.textContent));
    n.remove();
    bus.emit('keju:urgent', { title: parts[3] || '科举待办', note: parts[4] || '' });
    changed();
    return true;
  }
  if (n.id === 'dianshi-progress-modal') { watchProgress(); return true; }
  if (outcomeModal(n)) {
    const box = n.firstElementChild;
    const rows = box ? [...box.children].filter((d) => d.tagName === 'DIV') : [];
    const title = clean(rows[0] && rows[0].textContent).replace(/^\S\s+/, '');
    const lines = rows.slice(1, -1).map((d) => clean(d.textContent)).filter(Boolean);
    n.remove();
    bus.emit('keju:outcome', { title, lines });
    changed();
    return true;
  }
  return false;
});
let pmo = null;
function watchProgress() {
  if (pmo) return;
  const read = () => {
    const m = $('dianshi-progress-modal');
    if (!m) { pmo.disconnect(); pmo = null; bus.emit('keju:progress', { open: false }); return; }
    const bar = $('dianshi-progress-bar');
    bus.emit('keju:progress', { open: true, status: clean(($('dianshi-progress-status') || {}).textContent), sub: clean(($('dianshi-progress-subtitle') || {}).textContent),
      pct: bar ? n0(parseFloat(bar.style.width), 0) : 0 });
  };
  pmo = new MutationObserver((list) => { if (legacyMutation(list)) read(); });
  pmo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
  setTimeout(read, 0);
}
// 老入口改开新册（老右栏「入科举主面板」、待办浮条的「即刻……」）
function redirect() {
  for (const name of ['openKejuPanel', 'showKejuModal']) {
    const f = w[name];
    if (typeof f !== 'function' || f.__newui) continue;
    const r = function () { bus.emit('ui:keju', {}); };
    r.__newui = true;
    w[name] = r;
  }
}
redirect();
bus.on('kernel:ready', redirect);

// ---------- 读：制度 ----------
function histRows(arr, kind) {
  const reason = fn('_kjExamReasonCN');
  return (Array.isArray(arr) ? arr : []).slice().reverse().map((h) => ({
    year: h.year != null ? `${h.year}年` : '', reason: reason ? reason(h) : '', examiner: h.examiner || '',
    count: kind === 'enke' ? h.jinshiCount : kind === 'wuju' ? h.wujinshiCount : h.poolSize,
    names: (kind === 'enke' ? h.jinshiNames : kind === 'wuju' ? h.wujinshiNames : null) || []
  }));
}
function top3Of(h) {
  if (Array.isArray(h.topThree) && h.topThree.length) return h.topThree;
  if (h.finalRanking) return [h.finalRanking.zhuangyuan, h.finalRanking.bangyan, h.finalRanking.tanhua];
  return (h.results || []).slice(0, 3).map((c) => c && c.name);
}
export function overview() {
  const k = K(), g = G();
  const sc = (w.P && Array.isArray(w.P.scenarios) ? w.P.scenarios : []).find((s) => s.id === g.sid);
  const era = (sc && (sc.era || sc.dynasty)) || '';
  const net = g._schoolNetwork || {};
  return {
    enabled: !!k.enabled, preKeju: fn('isKejuEra') ? !w.isKejuEra(era) : false, reformed: !!k.reformed,
    interval: k.examIntervalNote || '由朝廷决定', subjects: k.examSubjects || '', quota: k.quotaPerExam || '', rules: k.specialRules || '',
    last: fmtDate(k.lastExamDate) || '', preparing: !!(g.keju && g.keju.preparingExam),
    restrictions: k.restrictions && k.restrictions.provinces && k.restrictions.provinces.length ? k.restrictions : null,
    cooldown: k._reformCooldown || null, graduateTitle: fn('_kejuGraduateTitle') ? w._kejuGraduateTitle() : '',
    history: (Array.isArray(k.history) ? k.history : []).filter(Boolean).slice().reverse().map((h) => ({
      date: fmtDate(h.date) || (h.turn != null ? `第${h.turn}回合` : '时间不详'), passed: h.passedCount, quality: h.quality || '',
      top3: top3Of(h).filter(Boolean), question: h.question || '', examiner: h.chiefExaminer || '', party: h.examinerParty || '',
      enke: h.type === 'enke', national: h.terminalLevel === 'national'
    })),
    ecology: {
      enke: histRows(g._enkeHistory, 'enke'), wuju: histRows(g._wujuHistory, 'wuju'), tongzi: histRows(g._tongziHistory, 'tongzi'),
      academies: (net.academies || net.schools || []).length, lineages: (net.lineages || net.parties || []).length
    },
    exam: k.currentExam ? exam(k.currentExam) : null,
    enke: k.currentEnke ? { stage: stageName(k.currentEnke, k.currentEnke.stage) } : null,
    canPropose: !!k.enabled && !k.currentExam && !(g.keju && g.keju.preparingExam)
  };
}

// ---------- 读：本科 ----------
function stageName(ex, s) { return fn('_kejuStageName') ? w._kejuStageName(ex, s) : s; }
function ratio(raw) {
  const r = fn('_normalizeRatio') ? w._normalizeRatio(raw) : raw || {};
  return Object.keys(r).map((k) => [k, Math.round(n0(r[k]) * 100)]).filter(([, v]) => v > 0);
}
function examinerView(name) {
  const ch = name && findChar(name);
  if (!ch || !fn('_kejuExaminerView')) return null;
  try {
    const v = w._kejuExaminerView(ch);
    const PREFER = { classics: '经史', classics_practical: '经世致用', policy: '策论', eight_legged: '八股经义', poetry: '诗赋', philosophy_zhuxi: '理学' };
    return { summary: v._summary || '', prefer: PREFER[v.preferContent] || v.preferContent || '', region: v.preferRegion || '',
      strict: Math.round(v.strictness), strictLabel: v.strictness >= 70 ? '严' : v.strictness <= 30 ? '宽' : '中',
      bias: v.factionBias, biasLabel: v.factionBias >= 0.6 ? '高' : v.factionBias <= 0.3 ? '低' : '中' };
  } catch (_e) { return null; }
}
// 题旨契合：与老框 oninput 同算（_kjCalcTopicAlignment × _kejuExaminerView）
export function alignment(text) {
  const ex = K().currentExam;
  const ch = ex && ex.chiefExaminer && findChar(ex.chiefExaminer);
  if (!ch || !fn('_kjCalcTopicAlignment') || !fn('_kejuExaminerView')) return null;
  const score = w._kjCalcTopicAlignment(String(text || ''), w._kejuExaminerView(ch));
  return { score, tone: score >= 70 ? 'good' : score >= 40 ? 'mid' : 'bad',
    text: score >= 70 ? '题目契合主考偏好·开榜评价加成' : score >= 40 ? '题目无明显偏向·中性' : `题目偏离主考偏好·${ex.chiefExaminer}可能私议偏题` };
}
function examinerCands() {
  const g = G();
  const recs = {};
  (g.parties || []).filter((p) => (p.influence || 0) > 20).forEach((p) => {
    const best = (g.chars || []).filter((c) => c.alive !== false && !c.isPlayer && c.party === p.name && (c.intelligence || 0) >= 55).sort((a, b) => (b.intelligence || 0) - (a.intelligence || 0))[0];
    if (best) recs[best.name] = p.name;
  });
  const ok = fn('_kejuIsEligibleChiefExaminer') || ((c) => !!(c && c.alive !== false && !c.isPlayer && (c.intelligence || 0) >= 60 && (c.officialTitle || c.title)));
  return (g.chars || []).filter((c) => ok(c)).sort((a, b) => (b.intelligence || 0) - (a.intelligence || 0)).slice(0, 12)
    .map((c) => ({ name: c.name, title: c.officialTitle || c.title || '', int: n0(c.intelligence), adm: n0(c.administration), party: c.party && c.party !== '无党派' ? c.party : '',
      rec: recs[c.name] || '', portrait: c.portrait || '', view: examinerView(c.name) }));
}
function needOf(ex) {
  const palace = fn('_kejuHasImperialExam') ? w._kejuHasImperialExam(ex) : true;
  if (ex.stage === 'examiner_select') return ex.chiefExaminer ? '' : 'examiner';
  if (ex.stage === 'huishi_draft') return ex.huishiTopic ? '' : 'topic';
  if (ex.stage === 'huishi') return 'open';
  if (ex.stage === 'dianshi_draft' || ex.stage === 'dianshi') return (ex.dianshiResults || []).length ? '' : ex.playerQuestion ? 'start' : 'question';
  if (ex.stage === 'finished') {
    const rs = ex.dianshiResults || [];
    if (palace && rs.length >= 3 && !ex.finalRanking) return 'rank';
    if (rs.length) return 'publish';
  }
  return '';
}
function exam(ex) {
  const k = K(), g = G();
  settleOrder(ex);
  const palace = fn('_kejuHasImperialExam') ? w._kejuHasImperialExam(ex) : true;
  const plan = fn('_kejuStagePlan') ? w._kejuStagePlan(ex) : [ex.stage];
  const need = fn('_kejuStageDays') ? w._kejuStageDays(ex, ex.stage) : 30;
  const ps = ex.preliminaryStats;
  const st = ex.statistics || {};
  const cp = ex.costsPaid || {};
  const sugs = ex.examinerSuggestions || {};
  const fr = ex.finalRanking;
  const pr = ex._pendingRanking || {};
  const slotOf = (name) => (fr ? (fr.zhuangyuan === name ? 'zhuangyuan' : fr.bangyan === name ? 'bangyan' : fr.tanhua === name ? 'tanhua' : '')
    : pr.zhuangyuan === name ? 'zhuangyuan' : pr.bangyan === name ? 'bangyan' : pr.tanhua === name ? 'tanhua' : '');
  return {
    id: ex.id, type: ex.type === 'enke' ? 'enke' : 'zhengke', stage: ex.stage, stageName: stageName(ex, ex.stage), palace,
    plan: plan.map((s) => ({ key: s, name: stageName(ex, s), days: fn('_kejuStageDays') ? w._kejuStageDays(ex, s) : 0 })),
    elapsed: n0(ex.stageElapsedDays), need, start: fmtDate(ex.startDate), method: ex.launchMethod || '',
    tierNote: (fn('_kejuStageTiers') ? w._kejuStageTiers(ex, ex.stage) : []).map((t) => t.desc || '').filter(Boolean).join(' '),
    costs: { local: n0(cp.local), provincial: n0(cp.provincial), central: n0(cp.central), shortfall: !!ex.costShortfall },
    treasury: n0(g.guoku && g.guoku.money), privy: n0(g.neitang && g.neitang.money),
    prelim: ps ? { total: n0(ps.totalApplicants), passed: n0(ps.passedToNational), narrative: ps.narrative || '', classes: ratio(ps.classBreakdown), parties: ratio(ps.partyBreakdown) } : null,
    examiner: ex.chiefExaminer ? { name: ex.chiefExaminer, party: ex.examinerParty || '', stance: ex.examinerStance || '', view: examinerView(ex.chiefExaminer) } : null,
    candidates: ex.stage === 'examiner_select' ? examinerCands() : [],
    topic: ex.huishiTopic || '', memorial: ex.chiefExaminerMemorial ? { text: ex.chiefExaminerMemorial.memorial || '', hint: ex.chiefExaminerMemorial.styleHint || '' } : null,
    topicCands: (ex.huishiTopicCandidates || []).map((c) => (typeof c === 'string' ? { topic: c } : { topic: c.topic || '', rationale: c.rationale || '', style: c.style || '' })),
    question: ex.playerQuestion || '', align: ex._topicAlignment != null ? Math.round(ex._topicAlignment) : null,
    subjects: k.examSubjects || '', rules: k.specialRules || '',
    stats: ex.statistics ? { passed: n0(st.passedCount), quality: st.quality || '', note: st.note || '', local: st.localEffect || '',
      ethnic: ratio(st.ethnicRatio), classes: ratio(st.classRatio), parties: ratio(st.partyRatio) } : null,
    dianshiCount: (ex.dianshiCandidates || []).length,
    results: (ex.dianshiResults || []).map((c, i) => ({ i, name: c.name, age: c.age, origin: c.origin || '', klass: c.class || '', party: c.party || '', score: n0(c.score),
      rank: c.rank || i + 1, historical: !!c.isHistorical, evaluation: c.evaluation || '', comment: c.chiefExaminerComment || '', style: c.style || '', hint: c.personalityHint || '',
      hasAnswer: !!c.fullAnswer, slot: slotOf(c.name), inChars: !!findChar(c.name), office: (findChar(c.name) || {}).officialTitle || '' })),
    suggestions: Object.keys(sugs).map((k2) => ({ who: k2, names: (sugs[k2] || []).slice(0, 5).map((s) => s.name) })),
    pending: { zhuangyuan: pr.zhuangyuan || '', bangyan: pr.bangyan || '', tanhua: pr.tanhua || '' },
    ranking: fr ? { zhuangyuan: fr.zhuangyuan, bangyan: fr.bangyan, tanhua: fr.tanhua, auto: !!fr.autoAssigned } : null,
    graduateTitle: fn('_kejuGraduateTitle') ? w._kejuGraduateTitle() : '',
    need: needOf(ex)
  };
}
// 书目上「科」亮不亮：有待陛下定夺之事
export function pending() {
  const ex = K().currentExam;
  return ex ? needOf(ex) : '';
}

// ---------- 动作 ----------
// 钦定之后二十卷照钦定重排、名次重编（同老 renderFinishedStage 画金榜前那一步；内核收科、纳入人物志都按此次序取三甲）
function settleOrder(ex) {
  const fr = ex && ex.finalRanking;
  const rs = ex && ex.dianshiResults;
  if (!fr || !Array.isArray(rs) || rs.length < 3) return;
  const rest = rs.slice();
  const top = [];
  for (const nm of [fr.zhuangyuan, fr.bangyan, fr.tanhua]) { const i = rest.findIndex((r) => r.name === nm); if (i >= 0) top.push(rest.splice(i, 1)[0]); }
  const out = top.concat(rest);
  out.forEach((r, i) => { r.rank = i + 1; });
  ex.dianshiResults = out;
}
function cur() {
  const ex = K().currentExam;
  if (!ex) throw new Error('今无开科');
  settleOrder(ex);
  return ex;
}
function needAi() {
  if (!(w.P && w.P.ai && w.P.ai.key)) throw new Error('未配 AI 密钥，此事须 AI 推演');
}
export function selectExaminer(name) { cur(); call('selectExaminer', name); changed(); }
export function toHuishi() { const ex = cur(); if (!ex.chiefExaminer) throw new Error('请先选主考官'); call('proceedToHuishi'); changed(); }
export function setTopic(text) { const ex = cur(); ex.huishiTopic = String(text || '').trim(); const a = alignment(ex.huishiTopic); if (a) ex._topicAlignment = a.score; }
export function setQuestion(text) { const ex = cur(); ex.playerQuestion = String(text || '').trim(); const a = alignment(ex.playerQuestion); if (a) ex._topicAlignment = a.score; }
export async function genMemorial() { const ex = cur(); needAi(); await call('_kejuGenChiefExaminerMemorial', ex); changed(); }
export async function proposeTopic() { cur(); needAi(); await call('examinerProposeTopic'); changed(); }
export async function openHuishi() { cur(); needAi(); await call('generateHuishiResults'); changed(); }
export async function genQuestion() { cur(); needAi(); await call('generateDianshiQuestion'); changed(); }
export async function startDianshi() { const ex = cur(); needAi(); if (!ex.playerQuestion) throw new Error('请先拟定策问'); await call('startDianshi'); changed(); }
export function libuReview() { cur(); call('_kjOpenLibuKeyi'); }
export function pick(name, slot) { cur(); call('_qinDianPick', name, slot); changed(); }
export function confirmRanking() { const ex = cur(); call('confirmFinalRanking'); settleOrder(ex); changed(); }
// 阅卷：答卷未生时请内核生成（它会自开老卷，临时换掉）
export async function answer(i) {
  const ex = cur();
  const c = (ex.dianshiResults || [])[i];
  if (!c) throw new Error('无此卷');
  if (!c.fullAnswer) {
    needAi();
    const show = w.showAnswerModal;
    w.showAnswerModal = () => {};
    try { await call('viewAnswer', i); } finally { w.showAnswerModal = show; }
  }
  const view = examinerView(ex.chiefExaminer);
  return { name: c.name, age: c.age, origin: c.origin || '', rank: c.rank || i + 1, style: c.style || '', hint: c.personalityHint || '', score: n0(c.score),
    comment: c.chiefExaminerComment || '', evaluation: c.evaluation || '', text: c.fullAnswer || '', historical: !!c.isHistorical, shiliao: c.shiliao || '',
    examiner: ex.chiefExaminer || '', estimate: view ? { summary: view.summary, region: view.region, fit: !!(view.region && (c.birthplace || c.origin || '').includes(view.region)) } : null };
}
export function recruit(i) {
  const ex = cur();
  const c = (ex.dianshiResults || [])[i];
  if (!c) throw new Error('无此卷');
  if (findChar(c.name)) throw new Error(`${c.name}已在人物志`);
  const r = call('recruitCandidate', i);
  changed();
  return r !== false && !!findChar(c.name);
}
// 授官：空缺之职（同老授官卷：官制树里有缺额的职位），任命走官制页同一写口
export function vacancies() {
  const out = [];
  const stats = fn('_offPositionStats');
  (function walk(nodes, prefix) {
    (nodes || []).forEach((n) => {
      (n.positions || []).forEach((p) => {
        const vac = stats ? n0(stats(p).vacant) > 0 : !p.holder;
        if (vac) out.push(Object.defineProperty({ dept: n.name, name: p.name, rank: p.rank || '', label: (prefix ? prefix + '·' : '') + n.name + p.name }, 'ref', { value: p }));
      });
      if (n.subs) walk(n.subs, (prefix ? prefix + '·' : '') + n.name);
    });
  })(G().officeTree, '');
  return out;
}
export function assign(i, post) {
  const ex = cur();
  const c = (ex.dianshiResults || [])[i];
  if (!c) throw new Error('无此卷');
  if (!findChar(c.name)) throw new Error('请先将此人纳入人物志');
  const p = post && post.ref;
  if (!p) throw new Error('无此职');
  const stats = fn('_offPositionStats');
  if (stats && !(n0(stats(p).vacant) > 0)) throw new Error('此职已无缺额');
  if (fn('_offSeatPersonInPosition')) w._offSeatPersonInPosition(p, c.name, { replace: false });
  else if (fn('_offAppointPerson')) w._offAppointPerson(p, c.name);
  else p.holder = c.name;
  const ch = findChar(c.name);
  ch.title = post.name;
  ch.officialTitle = post.dept + post.name;
  if (fn('addEB')) w.addEB('任命', `${c.name}任${post.label}（科举授职）`);
  if (w.NpcMemorySystem && typeof w.NpcMemorySystem.addMemory === 'function') w.NpcMemorySystem.addMemory(c.name, `科举入仕，初授${post.name}，踏上仕途`, 7, 'career');
  changed();
}
export function finish() { cur(); if (!Array.isArray(K().history)) K().history = []; call('finishKeju'); changed(); }

// 筹办、启用、改制
export function propose() {
  if (!K().enabled) throw new Error('科举制度未启用');
  if (K().currentExam) throw new Error('本科尚在进行');
  return call('proposeKejuPreparation');
}
export async function enable(mode) {
  if (K().enabled) throw new Error('科举已在行');
  await call('_kjActivateRun', { mode: mode === 'reform' ? 'reform' : 'enable' });
  changed();
}
export const STAGES_NEED = { examiner: '选任本科主考', topic: '阅定会试题目', open: '开榜阅卷', question: '亲拟殿试策问', start: '开殿试', rank: '钦定三甲', publish: '张榜收科' };
