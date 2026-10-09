// 兴造：在本方府州拟一件营造案，录入诏书建议库（不扣款、不计工期；纳入诏书颁行后由回合推演核办）。
// 老界面的兴造弹层（tm-player-core.js _dfBuildModal）凭弹层上记下的世界租约判断「局势未变」，自拟三栏、有司核议也都读写它里头的输入框——
// 故照旧建它、认领下来隐着；新前端画自己的卷，工籍点选、自拟录入转给内核原函数（_dfSubmitBuild），
// 有司核议转 _dfAppraiseCustomBuild，结果读回 window._dfPendingAppraisal。录入成功内核自撤弹层，以此判成。
import { claimOverlays } from './kernel.js';
import { account } from './fiscal.js';

const w = window;
const CAT = { economic: '经济', military: '军事', cultural: '文化', administrative: '行政', religious: '宗教', infrastructure: '基础设施' };
export const CATEGORIES = Object.entries(CAT).map(([key, label]) => ({ key, label }));

claimOverlays((n) => n.id === '_dfBuildModal');

let divName = '';
const modal = () => document.getElementById('_dfBuildModal');
const enc = () => encodeURIComponent(divName);
const catLabel = (cat) => CAT[cat] || (cat && !/^[a-z_\- ]+$/i.test(cat) ? String(cat) : '工');
const fin = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);

export function ready() {
  return typeof w._dfBuildModal === 'function' && typeof w._dfSubmitBuild === 'function';
}
// 有司核议（自拟营造当场核定可行、造价、工期、效用）：开关开、配了模型才有
export function agentOn() {
  const A = w.TM && w.TM.CustomBuildAgent;
  const P = w.P || {};
  try { return !!(A && typeof A.enabled === 'function' && A.enabled() && typeof w._dfAppraiseCustomBuild === 'function' && P.ai && P.ai.key); } catch (_e) { return false; }
}

// 国是·风气：营建立下的全局之制（持续生效，扎根深浅，所向与阻力）
function rules() {
  const GR = w.GlobalRules;
  if (!GR || typeof GR.cards !== 'function') return [];
  let cards = [];
  try { cards = GR.cards() || []; } catch (_e) { return []; }
  return cards.map((c) => ({
    name: String(c.name || ''), status: String(c.statusLabel || ''), strength: fin(c.strength, 0),
    tends: (c.tends || []).map((t) => `${t.label}·${t.magLabel}`),
    resist: c.resist && c.resist.from && c.resist.from.length ? `${c.resist.from.join('、')}${c.resist.intensityLabel || ''}议${c.resist.label ? `（${c.resist.label}）` : ''}` : ''
  }));
}
// 人才与风气：新式学堂育才、渐渗学统（关着或无新学则空）
function talent() {
  const TC = w.TM && w.TM.TalentCohorts;
  if (!TC || typeof TC.cards !== 'function') return null;
  let d = null;
  try { d = TC.cards(w.GM, w.P); } catch (_e) { return null; }
  if (!d || !d.paradigms || !d.paradigms.length) return null;
  return {
    emergent: d.paradigms.filter((p) => p.kind === 'emergent').map((p) => ({
      label: String(p.label || ''), tier: String(p.tier || ''), pct: Math.round(fin(p.penetration, 0) * 1000) / 10,
      stock: fin(p.effectiveStock, 0), mature: fin(p.stock, 0), training: fin(p.training, 0), idle: fin(p.unemployed, 0), intake: fin(p.intake, 0), quality: Math.round(fin(p.quality, 0) * 100)
    })),
    established: d.paradigms.filter((p) => p.kind === 'established').map((p) => ({ label: String(p.label || ''), stock: fin(p.stock, 0) })),
    tends: (d.tendencies || []).map((t) => ({ key: String(t.key || ''), pct: Math.round(fin(t.value, 0) * 1000) / 10 }))
  };
}

// 开拟：建好老弹层（隐着），给出剧本工籍、可否核议、国是风气、人才风气；内核未就绪时它自以提示告知，返回 null
export function open(name) {
  if (!ready()) throw new Error('营造入口未就绪');
  divName = String(name || '');
  w._dfBuildModal(divName);
  if (!modal()) return null;
  const P = w.P || {};
  const BW = w.TM && w.TM.BuildingWorks;
  const types = (P.buildingSystem && P.buildingSystem.buildingTypes) || [];
  const catalogue = types.map((b, i) => {
    let fx = [];
    try { if (BW && BW.fxLabels) fx = BW.fxLabels({ name: b.name, category: b.category || '' }, b) || []; } catch (_e) { /* 无效用签 */ }
    return {
      index: i, name: String(b.name || ''), cat: catLabel(b.category || ''), desc: String(b.description || ''),
      fx: fx.slice(0, 4), cost: fin(b.baseCost, 0), time: fin(b.buildTime, 3), maxLevel: fin(b.maxLevel, 5)
    };
  }).filter((b) => b.name);
  let unit = '两';
  try { const acc = account('guoku'); if (acc && acc.unit && acc.unit.money) unit = acc.unit.money; } catch (_e) { /* 照旧 */ }
  return { divName, catalogue, unit, agent: agentOn(), rules: rules(), talent: talent(), ticket: modal() };
}

function fill(req) {
  const m = modal();
  if (!m) return false;
  req = norm(req);
  const set = (id, v) => { const el = m.querySelector('#' + id); if (el) el.value = String(v || ''); };
  set('_bmCustName', req.name);
  set('_bmCustCat', req.category);
  set('_bmCustDesc', req.description);
  return true;
}
// 规制末尾的句号去掉（内核拼案文时自会加「。」）
const norm = (req) => ({ name: String(req.name || '').trim(), category: CAT[req.category] ? req.category : 'economic', description: String(req.description || '').trim().replace(/[。．.]+$/, '') });
const sameReq = (a, b) => a && b && a.name === b.name && a.category === b.category && a.description === b.description;

// 剧本工籍：点一件即录入（成则内核自撤弹层）
export function submitCatalogue(index) {
  if (!modal()) throw new Error('营造拟案已收，请重开');
  w._dfSubmitBuild(enc(), Number(index), null);
  return !modal();
}
// 请有司核议：{ ok, appraisal } 或 { ok:false, reason }。核议中改了规制或收了卷，结果作废（返回 stale）
export async function appraise(req) {
  if (!fill(req)) return { ok: false, reason: '营造拟案已收，请重开' };
  const want = norm(req);
  w._dfPendingAppraisal = null;
  try { await w._dfAppraiseCustomBuild(enc()); } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
  const m = modal();
  if (!m) return { ok: false, stale: true };
  const pend = w._dfPendingAppraisal;
  if (pend && pend.appraisal && pend.divName === divName && sameReq(pend.req, want)) {
    const a = pend.appraisal;
    return { ok: true, appraisal: {
      feasibility: String(a.feasibility || ''), cost: fin(a.costActual, null), time: fin(a.timeActual, null),
      labels: Array.isArray(a.effectLabels) ? a.effectLabels.map(String) : [], trimmed: !!(a.effectsRaw && !a.effectsStructured),
      effects: String(a.judgedEffects || ''), reason: String(a.reason || ''), upkeep: typeof a.upkeep === 'number' ? a.upkeep : null
    } };
  }
  const box = m.querySelector('#_bmAppraiseResult');
  const text = box ? box.textContent.trim() : '';
  const why = /有司未能核议（(.+)）——/.exec(text);
  return { ok: false, reason: why ? why[1] : (text || '有司未能核议') };
}
// 录入自拟营造：内核若有当前有效、非「不合理」的核议，自会附进案文
export function submitCustom(req) {
  if (!fill(req)) throw new Error('营造拟案已收，请重开');
  w._dfSubmitBuild(enc(), -1, true);
  return !modal();
}
// 收卷：ticket 为开拟时的那层（收卷有动画，迟到的收卷别把新开的一层撤了）
export function close(ticket) {
  if (ticket && modal() !== ticket) return;
  if (typeof w._dfCloseBuildModal === 'function') w._dfCloseBuildModal();
  else { const m = modal(); if (m) m.remove(); }
}
