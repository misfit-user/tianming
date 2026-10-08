// 科举改制（科举册里「更定取士之法」）：老面板是 tm-keju-paradigm-panel.js 的 #kjp-reform-modal（_kjpOpenReformProposal），
// 一张开发者表单，选项全是英文键。这里不开它：照它的 _kjpInitDraft 自建草稿（GM._kejuParadigm 各字段一份底本、一份草本），
// 差异、议题标签、各党预判走它暴露的纯函数（TM.Keju.ParadigmPanel.computeDiff / classifyTags / estimateStance / diffMagnitude）。
// 条陈与议题文字由这里按差异写成中文（内核 _kjpBuildTopicText 会把 high、avoid_kin、flowerRiding 这类键名直写进去）。
// AI 诸议照用 tm-keju-reform-llm.js 的 _kjpLlm*（幅度解读、荐试点、朝议揣度、私下召对、访求新科、自拟一科），
// 召对的代价与倾向照老面板落地（_kjpApplyAudienceCost、_kjpAccumReformLean、GM._kjpPrivateAudienceLog）。
// 付科议照 _kjpSubmitReform 组 topicData、调 openKeyiSession({topicType:'reform'})——新前端的科议场景（adapter/keyi.js）接手；议毕 L7 落地照旧。
// 召史策对借问对的 cedui 一式（新前端召对场景接手）；议废前番改制照 L11 的反向差异付科议；逐年所记读 L8 的 _reformChronicle。
import { bus } from '../core/bus.js';
import { claimOverlays } from './kernel.js';

const w = window;
const G = () => w.GM || {};
const fn = (name) => (typeof w[name] === 'function' ? w[name] : null);
const PP = () => (w.TM && w.TM.Keju && w.TM.Keju.ParadigmPanel) || null;
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const n0 = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const hasAI = () => typeof w.callAISmart === 'function' && !!(w.P && w.P.ai && w.P.ai.key);

claimOverlays((n) => {
  if (n.id !== 'kjp-reform-modal') return false;
  n.remove();
  bus.emit('ui:gaizhi', {});
  return true;
});

// ---------- 名目 ----------
export const INTENT = { reform: '更张', restoration: '复古' };
export const DYNASTIES = ['汉', '唐', '北宋', '南宋', '明', '清'];
export const MAGNITUDE = [
  { key: 'incremental', name: '缓改', descriptor: '缓改·徐徐图之', note: '徐徐图之，庆历新政之类' },
  { key: 'moderate', name: '中改', descriptor: '中改·循序渐进', note: '循序渐进，熙宁三经新义之类' },
  { key: 'radical', name: '急改', descriptor: '急除积弊·一旦决之', note: '一旦决之，商鞅、戊戌之类' },
  { key: 'restorative', name: '复古', descriptor: '复古·返本归源', note: '返本归源，洪武革元制之类' }
];
export const IDEOLOGY = { traditional: '守经', reformist: '变法', practical: '实学', modern: '新学' };
export const IDEOLOGY_NOTE = { traditional: '以经义取士', reformist: '重时务策论', practical: '重经世致用', modern: '兼采西学' };
export const RETAKE = { no: '不许再试', allow_3x: '许三试', unlimited: '不限再试' };
export const FEE = { self: '士子自备', state_subsidy: '官给津贴', waived: '免其考费' };
export const EXAMINER = { scholar: '文臣', military: '武臣', aristocrat: '勋戚', eunuch: '内臣', foreign: '外族之臣' };
export const INSPECTION = { low: '宽', medium: '中', high: '严' };
export const MENTOR = { strong: '座主谊重', weak: '座主谊轻', none: '不认座主', collective: '尽为天子门生' };
export const PENALTY = { demote: '降黜', whip: '笞杖', expel: '斥革功名', banish: '流放', death: '处斩', lingchi: '凌迟', individual: '罪止其身', kin_punishment: '株连亲族' };
export const RANKING = { by_score: '以文定第', by_origin: '以籍贯定第', by_party: '以党籍定第', by_recommendation: '以荐举定第' };
export const RATIO = { geo: '南北分卷', class: '阶层分额', party: '党籍分额', prefecture: '府州分额', minority: '诸族分额' };
export const COHORT = { strong: '同年谊重', weak: '同年谊轻', none: '不论同年' };
export const SCHOOL = { required: '必由学校', optional: '可由学校', none: '不由学校', alternative: '学校别为一途' };
export const SHADOW = { high: '荫叙宽', low: '荫叙严', none: '罢荫叙' };
export const TAX = { jinshi: '进士免赋', juren: '举人免赋', xiucai: '生员免役' };
export const AVOID = { avoid_kin: '避亲', avoid_native: '避籍', avoid_disciple: '避门生', avoid_recent: '避近任', avoid_party: '避同党', avoid_age: '避年齿' };
export const CEREMONY_FLAGS = { flowerRiding: '簪花跨马', nameStele: '进士题名碑', bondingBanquet: '琼林宴' };
export const CRIME = { cheating: '舞弊', leak: '泄题', taboo: '犯讳', bribery: '行贿' };
export const CLASSES = ['僧道', '商贾子', '女子', '倡优', '罪人', '匠户', '皂吏'];
export const ALLOC = { firstClass: '一甲', secondClass: '二甲', thirdClass: '三甲' };
export const AUDIENCE = { lure: '许以好处', pressure: '施以威压', probe: '探其口风' };
export const LANGUAGE = { classical_chinese: '文言', 'classical_chinese+manchu': '文言兼满文' };
export const languageName = (v) => LANGUAGE[v] || String(v || '');
const STATUS = { ramping: '推行中', active: '已行', matured: '已成定制', rejected: '议寝', rolled_back: '已废' };
const METHOD = { council: '依议推行', edict: '下诏强推', defy: '逆众议强推', shelve: '暂缓' };

// ---------- 能否开 ----------
export function available() {
  const k = (w.P && w.P.keju) || {};
  if (w.P && w.P.conf && w.P.conf.useNewKejuL === false) return { ok: false, why: '典章里关了科举改制' };
  if (!G()._kejuParadigm || !PP()) return { ok: false, why: '本局无科举成法可改' };
  if (!k.enabled) return { ok: false, why: '科举未行' };
  if (G().keju && G().keju.preparingExam) return { ok: false, why: '正在筹办本科，科毕再议' };
  return { ok: true, why: '' };
}

// ---------- 草稿（照 _kjpInitDraft）----------
const FIELDS = [['subjects', true], ['tiers', true], ['examInterval'], ['retakePolicy'], ['examinerRules', true], ['candidateRules', true], ['quota', true],
  ['rankingRule'], ['allocationRules', true], ['ideology'], ['graduateTitle'], ['cohortBondStrength'], ['mentorLineage'], ['schoolIntegration'],
  ['taxPrivilege', true], ['shadow'], ['clanPrivilege'], ['ceremony', true], ['penalties', true], ['language']];
export function draft() {
  const p = G()._kejuParadigm;
  if (!p) throw new Error('本局无科举成法可改');
  const d = {
    magnitudeDescriptor: '', magnitudeDescriptorPreset: '', magnitudeParsed: null,
    pilotScope: { name: '全国一举', reason: '默认·中枢直辖', source: 'default' }, pilotCandidates: [],
    courtMoodNarrative: '', courtMoodScale: 50, courtMoodKeyNpcs: [], courtMoodLastDiffHash: '', courtMoodStale: false,
    privateAudiences: [], isForced: false, intent: 'reform', restorationDynasty: '',
    l6Suggestions: [], _l10PresetId: null, _l10PresetCanonicalName: null, _l10PresetHistoricalEvaluation: null, _l10PresetBy: null
  };
  for (const [k, deep] of FIELDS) {
    d[k + 'Base'] = deep ? clone(p[k]) : p[k];
    d[k + 'Draft'] = deep ? clone(p[k]) : p[k];
  }
  return d;
}
// 动了科目、宗旨即不再是那条成例的原样：清去成例标记（照 _kjpL10MarkUserEdited），推演时由 AI 另行命名
export function edited(d) {
  d._l10PresetId = null; d._l10PresetCanonicalName = null; d._l10PresetHistoricalEvaluation = null; d._l10PresetBy = null;
}
export function era() {
  const p = G()._kejuParadigm || {};
  return { name: p.initEra || '', key: fn('_kjpL8EraToKey') ? w._kjpL8EraToKey(p.initEra) : '' };
}
export function tiers(d) { return (d.tiersDraft || []).map((t) => t.name || t.id).filter(Boolean); }
export function candidates(d) {
  const have = new Set((d.subjectsDraft || []).map((s) => s.name));
  return (PP().SUBJECT_CANDIDATES || []).filter((c) => !have.has(c.name));
}
export function addCandidate(d, id) {
  const c = (PP().SUBJECT_CANDIDATES || []).find((x) => x.id === id);
  if (!c || (d.subjectsDraft || []).some((s) => s.id === c.id || s.name === c.name)) return;
  d.subjectsDraft.push({ id: c.id, name: c.name, weight: c.defaultWeight, ideology: c.ideology, format: c.format, maxScore: 100, nameVariants: {},
    introducedYear: null, introducedBy: null, parentSubject: null, examinerBias: {}, candidateBias: {}, textbookRef: null, trainingCenterRef: null,
    cohortGen: 'g-new', regionalWeight: null, customFields: {} });
  edited(d);
}

// ---------- 差异与条陈 ----------
export function diffOf(d) { return PP().computeDiff(d); }
const yn = (v, yes, no) => (v ? yes : no);
const years = (v) => (n0(v) ? `${n0(v)}年一科` : '不定期');
const ratioText = (vals) => Object.keys(vals || {}).map((k) => `${k}${vals[k]}`).join('·');
// 十门：宗旨、科目、考期、考生、主考、录取、授官、身份联动、仪轨刑罚、筹议（字、名、注）
export const SECTIONS = { zhi: ['旨', '宗旨', '意向、其势、取士之本、文体'], ke: ['科', '科目', '所试诸科与所占'], qi: ['期', '考期', '几年一科、落第再试'],
  sheng: ['生', '考生', '应考之限'], kao: ['考', '主考', '主考资格、糊名誊录、回避'], qu: ['取', '录取', '取士之数、分卷、名次'],
  guan: ['官', '授官', '三甲授官、候选'], shen: ['身', '身份', '头衔、同年座主、学校、优免荫叙'], li: ['仪', '仪轨', '殿试放榜诸仪、科场刑罚'],
  yi: ['议', '筹议', '试点、私下召对'] };
// 按差异写成一条条中文（{sec, text}）；顺序照内核议题（宗旨在前，次科目、考期、主考、考生、录取、授官、身份、联动、仪轨、刑罚、文体）
export function items(d) {
  const x = diffOf(d);
  const out = [];
  const put = {};
  for (const k of Object.keys(SECTIONS)) put[k] = (text) => out.push({ sec: k, text });
  if (x.intent === 'restoration') put.zhi(x.restorationDynasty ? `复${x.restorationDynasty}旧章` : '复祖宗成法');
  if (x.ideology) put.zhi(`取士之本由${IDEOLOGY[x.ideology.old] || x.ideology.old}转${IDEOLOGY[x.ideology.new] || x.ideology.new}`);
  x.subjects.removed.forEach((s) => put.ke(`罢${s.name}一科`));
  x.subjects.added.forEach((s) => put.ke(`增${s.name}一科${s.format ? `（${s.format}）` : ''}，占${n0(s.weight)}%`));
  x.subjects.weightChanged.forEach((s) => put.ke(`${s.name}所占由${s.oldW}%改为${s.newW}%`));
  if (x.examInterval) put.qi(`考期由${years(x.examInterval.old)}改为${years(x.examInterval.new)}`);
  if (x.retakePolicy) put.qi(`落第者${RETAKE[x.retakePolicy.new] || x.retakePolicy.new}`);
  const er = x.examinerRules;
  if (er.type) put.kao(`主考许用${er.type.map((t) => EXAMINER[t] || t).join('、') || '（无）'}`);
  if (er.minYears !== undefined) put.kao(`主考须在官${n0(er.minYears)}年以上`);
  if (er.blindScoring !== undefined) put.kao(yn(er.blindScoring, '立糊名之制', '罢糊名之制'));
  if (er.blindCopying !== undefined) put.kao(yn(er.blindCopying, '立誊录之制', '罢誊录之制'));
  Object.keys(er.avoidanceRules || {}).forEach((k) => put.kao(`${yn(er.avoidanceRules[k], '立', '罢')}${AVOID[k] || k}之例`));
  if (er.inspectionLevel) put.kao(`考场监临从${INSPECTION[er.inspectionLevel] || er.inspectionLevel}`);
  if (er.mentorBondStrength) put.kao(`座主门生：${MENTOR[er.mentorBondStrength] || er.mentorBondStrength}`);
  if (er.leakPenalty) put.kao(`主考泄题者${PENALTY[er.leakPenalty] || er.leakPenalty}`);
  const cr = x.candidateRules;
  if (cr.allowForeigner !== undefined) put.sheng(yn(cr.allowForeigner, '许外国宾贡应考', '罢宾贡'));
  if (cr.allowMinority !== undefined) put.sheng(yn(cr.allowMinority, '许诸族应考', '禁诸族应考'));
  if (cr.requirePrefecture !== undefined) put.sheng(yn(cr.requirePrefecture, '应考须有本籍', '罢籍贯之限'));
  if (cr.requireRecommendation !== undefined) put.sheng(yn(cr.requireRecommendation, '应考须有保举', '罢保举之限'));
  if (cr.minAge !== undefined || cr.maxAge !== undefined) put.sheng(`应考年岁限${n0(d.candidateRulesDraft.minAge)}至${n0(d.candidateRulesDraft.maxAge)}岁`);
  if (cr.feeReimbursement) put.sheng(`考费${FEE[cr.feeReimbursement] || cr.feeReimbursement}`);
  if (cr.excludedClasses) {
    if (cr.excludedClasses.removed.length) put.sheng(`许${cr.excludedClasses.removed.join('、')}应考`);
    if (cr.excludedClasses.added.length) put.sheng(`禁${cr.excludedClasses.added.join('、')}应考`);
  }
  const q = x.quota;
  if (q.total) put.qu(`每科取士由${q.total.old}名改为${q.total.new}名`);
  Object.keys(q.ratios || {}).forEach((k) => { const r = q.ratios[k]; put.qu(r.enabled ? `行${RATIO[k] || k}${ratioText(r.values) ? `（${ratioText(r.values)}）` : ''}` : `罢${RATIO[k] || k}`); });
  if (x.rankingRule) put.qu(`名次${RANKING[x.rankingRule.new] || x.rankingRule.new}`);
  const a = x.allocationRules;
  Object.keys(ALLOC).forEach((k) => { if (a[k]) put.guan(`${ALLOC[k]}${n0(a[k].count)}人，授${(a[k].positions || []).join('、') || '（未定）'}`); });
  if (a.waitingYears) put.guan(`新科候选由${a.waitingYears.old}年改为${a.waitingYears.new}年`);
  if (a.imperialReviewRequired !== undefined) put.guan(yn(a.imperialReviewRequired, '授官须经亲审', '授官不必亲审'));
  if (a.posthumousAdjustment !== undefined) put.guan(yn(a.posthumousAdjustment, '许身后改定门生', '不许身后改定门生'));
  if (x.graduateTitle) put.shen(`登第者改称${x.graduateTitle.new || '（空）'}`);
  if (x.cohortBondStrength) put.shen(`同年之谊：${COHORT[x.cohortBondStrength.new] || x.cohortBondStrength.new}`);
  if (typeof x.mentorLineage === 'boolean') put.shen(yn(x.mentorLineage, '录座主门生谱系', '不录座主门生谱系'));
  if (x.schoolIntegration) put.shen(`学校之途：${SCHOOL[x.schoolIntegration.new] || x.schoolIntegration.new}`);
  Object.keys(x.taxPrivilege || {}).forEach((k) => put.shen(`${yn(x.taxPrivilege[k], '', '罢')}${TAX[k] || k}`));
  if (x.shadow) put.shen(SHADOW[x.shadow.new] || x.shadow.new);
  if (typeof x.clanPrivilege === 'boolean') put.shen(yn(x.clanPrivilege, '立宗族优免', '罢宗族优免'));
  const c = x.ceremony;
  if (c.palaceTest !== undefined) put.li(`殿试改为“${c.palaceTest || '（空）'}”`);
  if (c.rosterRelease !== undefined) put.li(`放榜改为“${c.rosterRelease || '（空）'}”`);
  Object.keys(CEREMONY_FLAGS).forEach((k) => { if (c[k] !== undefined) put.li(`${yn(c[k], '行', '罢')}${CEREMONY_FLAGS[k]}`); });
  if (c.kowtowRound !== undefined) put.li(`谢恩叩拜改为${n0(c.kowtowRound)}次`);
  Object.keys(x.penalties || {}).forEach((k) => put.li(`${CRIME[k] || k}者${PENALTY[x.penalties[k]] || x.penalties[k]}`));
  if (x.language) put.zhi(`试卷用${languageName(x.language.new) || '（空）'}`);
  return out;
}
// 付科议的议题：诸条以分号连，次其势、试点（议题标题已作「科举改革」，这里不再冠名；不用「」，科议问话里的议题名以之为界）
export function topic(d) {
  const list = items(d).map((x) => x.text);
  if (!list.length) return '';
  const pilot = d.pilotScope && d.pilotScope.name && !/^全国/.test(d.pilotScope.name) ? `先试于${d.pilotScope.name}。` : '';
  const mag = d.magnitudeDescriptor ? `其势“${d.magnitudeDescriptor}”。` : '';
  return `${list.join('；')}。${mag}${pilot}`;
}
// 改动之大小（内核 _kjpDiffMagnitude，0~100），与议题标签
export function weight(d) {
  const x = diffOf(d);
  let m = 0;
  try { m = n0(PP().diffMagnitude(x)); } catch (_e) { m = 0; }
  return { magnitude: m, tags: (() => { try { return PP().classifyTags(x); } catch (_e) { return []; } })() };
}

// ---------- 各党预判（内核 _kjpEstimateStanceDistribution：党中诸人按议题标签推立场，取众数）----------
export const STANCE = { support: '赞成', oppose: '反对', neutral: '观望' };
export function stance(d) {
  const x = diffOf(d);
  let map = {};
  try { map = PP().estimateStance(x, meta(d)) || {}; } catch (_e) { map = {}; }
  const parties = Array.isArray(G().parties) ? G().parties : [];
  return parties.map((p) => {
    const s = map[p.name] || {};
    const b = s._breakdown || {};
    return { party: p.name, influence: n0(p.influence, 50), stance: s.stance || 'neutral', intensity: n0(s.intensity), members: n0(s.memberCount),
      support: n0(b.support), oppose: n0(b.oppose), neutral: n0(b.neutral) };
  }).filter((r) => r.members > 0).sort((a, b) => b.members - a.members);
}
// 老面板的 l3Meta：幅度、试点、朝议揣度、召对、成例标记
export function meta(d) { return fn('_kjpExtractL3Meta') ? w._kjpExtractL3Meta(d) : null; }

// ---------- 历代成例（L10_PRESETS）----------
export function presets() {
  const list = Array.isArray(w.L10_PRESETS) ? w.L10_PRESETS : [];
  const key = era().key;
  const label = (k) => (fn('_kjpL10EraLabel') ? w._kjpL10EraLabel(k) : k);
  return list.filter((p) => !((p.magnitudeParsed && p.magnitudeParsed.tags) || []).includes('rollback'))
    .map((p) => ({ id: p.id, name: p.canonicalName, by: p.by, year: p.year, era: label(p.era), same: p.era === key, note: p.historicalEvaluation || '',
      context: p._l10HistoricalContext || '', descriptor: p.magnitudeDescriptor || '' }))
    .sort((a, b) => (a.same === b.same ? a.year - b.year : a.same ? -1 : 1));
}
// 援引成例：照 _kjpL10ApplyPreset 并入草稿（科目增删按名去重、宗旨、考期、再试、幅度、成例标记）
export function applyPreset(d, id) {
  const p = (w.L10_PRESETS || []).find((x) => x.id === id);
  if (!p) throw new Error('无此成例');
  const df = p.diff || {};
  (df.subjects && df.subjects.added || []).forEach((s) => { if (!d.subjectsDraft.some((x) => x.name === s.name)) d.subjectsDraft.push(Object.assign({}, s)); });
  (df.subjects && df.subjects.removed || []).forEach((s) => { d.subjectsDraft = d.subjectsDraft.filter((x) => (s.id ? x.id !== s.id : x.name !== s.name)); });
  if (df.ideology) d.ideologyDraft = df.ideology;
  if (df.examInterval != null) d.examIntervalDraft = df.examInterval;
  if (df.retakePolicy) d.retakePolicyDraft = df.retakePolicy;
  d.magnitudeDescriptor = p.magnitudeDescriptor || '';
  d.magnitudeDescriptorPreset = p.magnitudeDescriptorPreset || p.id;
  d.magnitudeParsed = p.magnitudeParsed || null;
  d._l10PresetId = p.id; d._l10PresetCanonicalName = p.canonicalName; d._l10PresetHistoricalEvaluation = p.historicalEvaluation; d._l10PresetBy = p.by;
  return p.canonicalName;
}
// 选幅度：复古之势连带把意向改作复古（_kjpApplyMagPresetIntent）
export function setMagnitude(d, key, descriptor) {
  const m = MAGNITUDE.find((x) => x.key === key);
  d.magnitudeDescriptorPreset = m ? m.key : '';
  d.magnitudeDescriptor = m ? m.descriptor : String(descriptor || '').trim();
  d.magnitudeParsed = null;
  if (m && m.key === 'restorative') d.intent = 'restoration';
  else if (m && d.intent === 'restoration') d.intent = 'reform';
}

// ---------- 改制沿革（GM._kejuParadigm.history；逐年所记在 _reformChronicle[条目id][年]，无 AI 时那句占位不显）----------
const reformName = (e) => e.canonicalName || e.reformName || (e.intent === 'rollback' ? '废前制之议' : e.intent === 'restoration' ? '复古之议' : '改制之议');
function yearly(e) {
  const c = ((G()._kejuParadigm || {})._reformChronicle || {})[e.id];
  if (!c || typeof c !== 'object') return [];
  return Object.keys(c).filter((y) => /^\d+$/.test(y)).sort((a, b) => a - b).map((y) => ({ year: Number(y), text: String((c[y] && (c[y].narrative || c[y].text)) || '') }))
    .filter((x) => x.text && !/^\(无 LLM/.test(x.text));
}
export function history() {
  const p = G()._kejuParadigm || {};
  return (Array.isArray(p.history) ? p.history : []).slice().reverse().map((e) => ({
    id: e.id, name: reformName(e),
    year: e.year, by: e.by || '', status: STATUS[e.status] || e.status || '', method: METHOD[e.method] || '',
    text: String(e.reason || e.paradigmDigest || '').slice(0, 140), ramping: e.status === 'ramping',
    yearly: yearly(e), canRollback: rollbackable(e)
  }));
}

// ---------- 议废前番改制（tm-keju-reform-rollback.js：_kjpL11BuildReverseDiff 算反向差异，_kjpL11SubmitRollback 付科议）----------
export const ROLLBACK = { partial: '罢其一部', full: '尽复旧制', pivot: '更化再造' };
// 内核的反向差异只管科目、所占、宗旨、考期、再试（_buildFromDiff）；主考、录取等他项议废也不复旧
export const ROLLBACK_NOTE = { partial: '罢去未勾留的新增科目，诸科所占复旧；宗旨、考期仍照新制',
  full: '新增之科尽罢、所罢之科复设，诸科所占、宗旨、考期、再试复旧；主考、录取等他项不在此列', pivot: '同尽复旧制，复后可另起新议' };
const conf = () => (w.P && w.P.conf) || {};
function rollbackable(e) {
  if (!e || !e.id || conf().useNewKejuL11 === false || conf().useNewKejuL7 === false || !fn('_kjpL11SubmitRollback')) return false;
  // 议废那一条本身不可再废：内核的防链闸看 tags 里的 rollback，而 L7 记沿革时并不写这个标签，故另以 intent 判
  return /^(ramping|active|matured)$/.test(e.status || '') && !(e.tags || []).includes('rollback') && e.intent !== 'rollback';
}
const entryOf = (id) => ((G()._kejuParadigm || {}).history || []).find((e) => e && e.id === id) || null;
// 改制所增之科：未修剪的 diff 优先，成定制后只剩 _reverseSnapshot（照 _kjpL11ReadAddedSubjects）
function addedOf(e) {
  if (e.diff && e.diff.subjects && Array.isArray(e.diff.subjects.added)) return e.diff.subjects.added.map((s) => ({ id: s.id || s.name, name: s.name }));
  const r = e._reverseSnapshot;
  if (r && Array.isArray(r.addedSubjectIds)) return r.addedSubjectIds.map((id, i) => ({ id, name: (r.addedSubjectNames || [])[i] || id }));
  return [];
}
function people(names) {
  return (names || []).map((n) => {
    const c = fn('findCharByName') ? w.findCharByName(n) : null;
    return { name: n, gone: !c || c.alive === false || !!c._retired };
  });
}
export function rollbackPlan(id) {
  const e = entryOf(id);
  if (!rollbackable(e)) throw new Error('此番改制不可议废');
  let stubs = [];
  try { const rev = w._kjpL11BuildReverseDiff(e, 'full', []); stubs = (rev && rev._warnStubRestores) || []; } catch (_e) { stubs = []; }
  const radical = n0(e.magnitudeParsed && e.magnitudeParsed.radical);
  return {
    id, name: reformName(e), year: e.year, by: e.by || '', status: STATUS[e.status] || e.status || '',
    added: addedOf(e), support: people(e.supportNpcs), oppose: people(e.opposeNpcs), radical,
    shake: radical >= 70 ? '朝野震动，根基或动' : radical >= 40 ? '反对沸然，须重臣坐镇' : '小有更张，阻力可控',
    degraded: !e.diff && !e._reverseSnapshot, stubs
  };
}
// 内核 L11 的反向差异只有 subjects（及 ideology、考期），而议毕 L7 记沿革时 _kjpClassifyDiffTags 对 examinerRules 等项直接 Object.keys——
// 缺项即抛：科目已改，沿革却不记、原改制不标「已废」、推行记录卡在 _beingRolledBack。这里在交科议时把缺的项补成空（空即「此项不改」）
const DIFF_OBJECTS = ['tiers', 'examinerRules', 'candidateRules', 'quota', 'allocationRules', 'taxPrivilege', 'ceremony', 'penalties'];
function padDiff(x) {
  if (!x || typeof x !== 'object') return x;
  x.subjects = Object.assign({ added: [], removed: [], weightChanged: [] }, x.subjects || {});
  for (const k of DIFF_OBJECTS) if (!x[k] || typeof x[k] !== 'object') x[k] = {};
  return x;
}
// 付科议：同改制一样先问人数与精力；开不起来（内核只弹一句、不发问）即算没交出。
// _kjpL11SubmitRollback 自组 topicData 后调 openKeyiSession——临时再套一层，在它交给科议之前补全差异
export function rollback(id, mode, keep) {
  const e = entryOf(id);
  if (!rollbackable(e)) throw new Error('此番改制不可议废');
  if (w.KEYI_STATE || document.getElementById('keyi-modal')) throw new Error('已有科议在开');
  let asked = false;
  const off = bus.on('keyi:ask', () => { asked = true; });
  const inner = w.openKeyiSession;
  w.openKeyiSession = function (opts, ...rest) {
    if (opts && opts.topicData) padDiff(opts.topicData.paradigmDiff);
    return inner.call(this, opts, ...rest);
  };
  try { w._kjpL11SubmitRollback(e, ROLLBACK[mode] ? mode : 'full', mode === 'partial' ? (keep || []).slice() : []); } finally { w.openKeyiSession = inner; off(); }
  if (!asked) throw new Error('科议未能开');
  return true;
}

// ---------- 召史策对（问对 cedui：密召史官、翰林、老臣，策此番改制数年之后的成效；结束时内核 _kjpOnCeduiClose 记其言、验其中否）----------
const STANDING = { new: '新进', unaudited: '未验', reliable: '言多中', mixed: '中否参半', unreliable: '言多不中' };
function lastCedui(name) {
  const hist = (G().wenduiHistory || {})[name] || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const m = hist[i];
    if (m && m.role === 'npc' && m.mode === 'cedui') return { text: String(m.content || '').replace(/\s+/g, ' ').slice(0, 220), turn: m.turn };
  }
  return null;
}
export function advisors() {
  const list = fn('_kjpListForecastAdvisors') ? w._kjpListForecastAdvisors() || [] : [];
  return list.map((c) => {
    const arch = fn('_kjpInferAdvisorArchetype') ? w._kjpInferAdvisorArchetype(c) : 'A3_pragmatic';
    const rep = c._forecastReputation;
    return { name: c.name, title: c.officialTitle || c.title || '', party: c.party || '', school: (w.ARCHETYPE_LABELS || {})[arch] || '务实派',
      record: rep && rep.totalForecasts > 0 ? `言中${n0(rep.accurateForecasts)}／${n0(rep.totalForecasts)}·${STANDING[rep.reputation] || ''}` : '',
      last: lastCedui(c.name) };
  });
}
// 首问由这里拟：内核 _kjpBuildCeduiPrefill 只写幅度数值（「LLM 解 30/100」）、不列所改诸条；AI 的背景另由全局草稿供给，不靠这句
function ceduiQuestion(d, school) {
  const list = items(d).map((x) => x.text);
  const head = list.slice(0, 6).join('；') + (list.length > 6 ? `，凡${list.length}条` : '');
  const pilot = d.pilotScope && d.pilotScope.name && !/^全国/.test(d.pilotScope.name) ? `，先试于${d.pilotScope.name}` : '';
  const mag = d.magnitudeDescriptor ? `其势“${d.magnitudeDescriptor}”` : '';
  return `卿素以${school}见称。朕欲更定取士之法，所议：${head}。${mag}${pilot}${mag || pilot ? '。' : ''}卿试如汉贤良对策：行之五年、十年，于士风、吏治、党局、钱粮各将如何？`;
}
// 照 _kjpInvokeCedui：草稿、差异、摘要、派别挂到全局供问对的提示词与收场钩子读，再以 cedui 开问对（新前端的召对场景接手）
export function cedui(d, name) {
  if (document.getElementById('wendui-modal')) throw new Error('问对未毕');
  if (typeof w.openWenduiModal !== 'function') throw new Error('问对不可开');
  const npc = fn('findCharByName') ? w.findCharByName(name) : null;
  if (!npc) throw new Error('查无此人');
  const arch = fn('_kjpInferAdvisorArchetype') ? w._kjpInferAdvisorArchetype(npc) : 'A3_pragmatic';
  const x = diffOf(d);
  w._kjpCurrentCeduiDraft = d;
  w._kjpCurrentCeduiDiff = x;
  w._kjpCurrentCeduiDigest = fn('_kjpSummarizeDiff') ? w._kjpSummarizeDiff(x) : '';
  w._kjpCurrentCeduiArchetype = arch;
  const prefill = ceduiQuestion(d, (w.ARCHETYPE_LABELS || {})[arch] || '务实派');
  w.openWenduiModal(name, 'cedui', prefill);
  return !!document.getElementById('wendui-modal');      // 精力不足、不在京等：内核已弹一句，问对未开
}
export function inProgress() {
  const r = (G()._kejuParadigm || {})._reformInProgress;
  return r ? { years: n0(G()._kejuParadigm._applyDelay), name: r.canonicalName || r.name || '' } : null;
}

// ---------- 诸臣（召对之选）：有党籍、在世、非本人 ----------
export function ministers() {
  const names = new Set((Array.isArray(G().parties) ? G().parties : []).map((p) => p.name));
  return (G().chars || []).filter((c) => c && c.alive !== false && !c.isPlayer && c.party && names.has(c.party))
    .map((c) => ({ name: c.name, party: c.party, title: c.officialTitle || c.title || '', lean: c._kjpReformLean ? n0(c._kjpReformLean.value) : 0, rank: n0(c.prestige) + n0(c.influence) }))
    .sort((a, b) => b.rank - a.rank).slice(0, 80);
}

// ---------- AI 诸议（无 AI 时内核各有退路，结果标 fallback）----------
const busy = new WeakMap();
async function guard(d, key, f) {
  const set = busy.get(d) || new Set();
  busy.set(d, set);
  if (set.has(key)) throw new Error('正在议，稍候');
  set.add(key);
  try { return await f(); } finally { set.delete(key); }
}
export function isBusy(d, key) { const s = busy.get(d); return !!(s && (key ? s.has(key) : s.size)); }
export const aiReady = hasAI;

export function parseMagnitude(d) {
  if (!d.magnitudeDescriptor) return Promise.reject(new Error('先定其势'));
  return guard(d, 'mag', async () => {
    const r = await w._kjpLlmParseMagnitudeDescriptor(d.magnitudeDescriptor);
    d.magnitudeParsed = r;
    return r;
  });
}
export function suggestPilots(d) {
  return guard(d, 'pilot', async () => {
    const r = await w._kjpLlmSuggestPilots({ era: era().name, paradigmDiff: diffOf(d), magnitudeDescriptor: d.magnitudeDescriptor });
    d.pilotCandidates = Array.isArray(r) ? r : [];
    return d.pilotCandidates;
  });
}
export function setPilot(d, c) {
  d.pilotScope = c.source === 'custom' ? { name: c.name, reason: '自定', source: 'custom' } : { name: c.name, reason: c.reason || '', source: 'llm', historicalParallel: c.historicalParallel || '' };
}
export function courtMood(d) {
  return guard(d, 'mood', async () => {
    const x = diffOf(d);
    const m = meta(d);
    const r = await w._kjpLlmAssessCourtMood({ stances: PP().estimateStance(x, m), parties: Array.isArray(G().parties) ? G().parties : [], paradigmDiff: x,
      topicText: topic(d), magnitudeTags: (d.magnitudeParsed && d.magnitudeParsed.tags) || ['moderate'], pilotScope: d.pilotScope });
    d.courtMoodNarrative = r.narrative; d.courtMoodScale = r.scale; d.courtMoodKeyNpcs = r.keyNpcs || [];
    try { d.courtMoodLastDiffHash = JSON.stringify(x); } catch (_e) { d.courtMoodLastDiffHash = ''; }
    d.courtMoodStale = false;
    return r;
  });
}
// 揣度之后又改了条款，旧揣度作废（照 _kjpRefreshPreview 的 stale 标记）
export function moodStale(d) {
  if (!d.courtMoodNarrative || !d.courtMoodLastDiffHash) return false;
  try { return JSON.stringify(diffOf(d)) !== d.courtMoodLastDiffHash; } catch (_e) { return false; }
}
// 私下召对：代价与倾向照老面板落地；成否都记入草稿，随议题付科议
export function audience(d, name, intent) {
  const npc = fn('findCharByName') ? w.findCharByName(name) : (G().chars || []).find((c) => c && c.name === name);
  if (!npc) return Promise.reject(new Error('查无此人'));
  return guard(d, 'aud', async () => {
    let res;
    try {
      res = await w._kjpLlmAudienceDialog({ npc, intent, paradigmDiff: diffOf(d), topicText: topic(d), courtMoodScale: d.courtMoodScale });
    } catch (_e) {
      d.privateAudiences.push({ npc: name, intent, speech: '（召对未成，稍后再试）', offerTerms: '', cost: {}, supportDelta: 0, willAccept: false, costApplied: false, failed: true, ts: G().turn || 0 });
      throw new Error('召对未成，稍后再试');
    }
    if (intent === 'probe' && res) res.supportDelta = 0;
    const sd = parseInt(res && res.supportDelta, 10) || 0;
    let costApplied = false;
    try { costApplied = w._kjpApplyAudienceCost(npc, res, intent); } catch (_e) { costApplied = false; }
    if (res && res.willAccept && sd) { try { w._kjpAccumReformLean(npc, sd, G().turn || 0); } catch (_e) { /* 倾向不记亦可 */ } }
    const g = G();
    if (!Array.isArray(g._kjpPrivateAudienceLog)) g._kjpPrivateAudienceLog = [];
    g._kjpPrivateAudienceLog.push({ turn: g.turn || 0, npc: name, intent, supportDelta: sd, willAccept: !!res.willAccept, offerTerms: String(res.offerTerms || ''), cost: res.cost || {}, ts: Date.now() });
    if (g._kjpPrivateAudienceLog.length > 50) g._kjpPrivateAudienceLog.splice(0, g._kjpPrivateAudienceLog.length - 50);
    const rec = { npc: name, intent, speech: res.speech, offerTerms: res.offerTerms, cost: res.cost, supportDelta: sd, willAccept: res.willAccept, costApplied, ts: g.turn || 0, fallback: res._source === 'fallback' };
    d.privateAudiences.push(rec);
    if (sd) d.courtMoodScale = Math.max(0, Math.min(100, n0(d.courtMoodScale, 50) + sd));
    bus.emit('game:changed', { what: 'gaizhi' });
    return rec;
  });
}
// 召对代价读成话：威望、国库、另许他人之事
export function costText(c) {
  if (!c) return '';
  return [n0(c.prestige) ? `威望${c.prestige > 0 ? '+' : ''}${c.prestige}` : '', n0(c.guoku) ? `国库${c.guoku > 0 ? '+' : ''}${c.guoku}两` : '', c.promiseToOthers ? `另许：${c.promiseToOthers}` : '']
    .filter(Boolean).join('；');
}
export function suggestSubjects(d) {
  return guard(d, 'l6', async () => {
    const r = await w._kjpL6LlmSuggestSubjects(5, '', d.subjectsDraft || []);
    d.l6Suggestions = Array.isArray(r) ? r : [];
    return d.l6Suggestions;
  });
}
export function acceptSubject(d, s) {
  if (d.subjectsDraft.some((x) => x.id === s.id || x.name === s.name)) throw new Error('此科已在草稿');
  d.subjectsDraft.push(s);
  edited(d);
}
export function customSubject(d, text) {
  const t = String(text || '').trim();
  if (!t) return Promise.reject(new Error('先写下所欲增之科'));
  return guard(d, 'l6', async () => {
    const s = await w._kjpL6LlmRationalizeSubject(t);
    if (!s) throw new Error('未能拟成');
    acceptSubject(d, s);
    return s;
  });
}

// ---------- 付科议 ----------
export function check(d, text) {
  const x = items(d);
  const t = String(text || '').trim();
  if (!x.length && !t) return { ok: false, why: '尚未更动一条' };
  if (!t) return { ok: false, why: '议题为空' };
  if (isBusy(d, 'aud')) return { ok: false, why: '召对未毕' };
  if (w.KEYI_STATE || document.getElementById('keyi-modal')) return { ok: false, why: '已有科议在开' };
  const sum = (d.subjectsDraft || []).reduce((s, v) => s + n0(v.weight), 0);
  return { ok: true, why: '', weightSum: sum };
}
// 照内核 _kjpSubmitReform 组 topicData、调 openKeyiSession（新前端的科议接手，先问人数与精力）。
// 内核那一版不论科议开没开成都记一笔「改革议」纪事，且文末缀着开发者的话；这里等科议真开了（KEYI_STATE 里正是这份 topicData）才记
let sent = null;
bus.on('keyi:changed', (s) => {
  if (!sent || !s || !s.open) return;
  const st = w.KEYI_STATE;
  if (st && st._pendingProposal && st._pendingProposal.topicData === sent.topicData) record(sent);
  sent = null;
});
function record(x) {
  const g = G();
  if (!Array.isArray(g._chronicle) || !(w.TM && w.TM.Chronicle)) return;
  try {
    w.TM.Chronicle.record({ turn: g.turn || 1, date: g._gameDate || '', type: 'keju-reform-proposed',
      text: `${x.intent === 'restoration' ? '复古议' : '改革议'}·${x.text.slice(0, 60)}·付科议`, tags: ['科举', 'paradigm', x.intent] });
  } catch (_e) { /* 纪事记不上不碍科议 */ }
}
export function submit(d, text) {
  const c = check(d, text);
  if (!c.ok) throw new Error(c.why);
  if (typeof w.openKeyiSession !== 'function') throw new Error('科议不可开');
  const t = String(text).trim();
  const m = meta(d) || {};
  const topicData = {
    topic: t, paradigmDiff: diffOf(d), intent: d.intent || 'reform', restorationDynasty: d.restorationDynasty || '', source: 'kj-paradigm-l3', sourceVersion: 3,
    magnitudeDescriptor: m.magnitudeDescriptor, magnitudeDescriptorPreset: m.magnitudeDescriptorPreset, magnitudeParsed: m.magnitudeParsed,
    pilotScope: m.pilotScope, pilotCandidates: m.pilotCandidates, courtMoodNarrative: m.courtMoodNarrative, courtMoodScale: m.courtMoodScale,
    courtMoodKeyNpcs: m.courtMoodKeyNpcs, privateAudiences: m.privateAudiences, isForced: !!m.isForced,
    l10PresetId: m.l10PresetId, l10PresetCanonicalName: m.l10PresetCanonicalName, l10PresetHistoricalEvaluation: m.l10PresetHistoricalEvaluation, l10PresetBy: m.l10PresetBy
  };
  // 科议开不起来（在京之臣不足三人等）时内核只弹一句、不发问——那就算没交出
  let asked = false;
  const off = bus.on('keyi:ask', () => { asked = true; });
  sent = { topicData, intent: topicData.intent, text: t };
  try { w.openKeyiSession({ topicType: 'reform', topicData }); } finally { off(); }
  if (!asked) { sent = null; throw new Error('科议未能开'); }
  return true;
}
