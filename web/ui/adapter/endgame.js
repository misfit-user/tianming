// 终局：内核 _showEndgameScreen(type, failGoal) 照跑——记战绩（tm_playHistory）、修帝王本纪、请太史公评语都在里头——
// 它挂的 #_endgame（内联铺满，原会被兜底挪进来、露出老样式）认领下来藏着；新前端据结构化数据另画终局页：
//   标题与时日、败因或所成、史上国祚对照（内核 _histFallCompareHtml 去标签）、太史公曰（AI 回来时写进老层 #_taishigong，盯住转发）、
//   帝王本纪（GM._benji.sections 逐卷修成）、诸项升降（GM._metricHistory 与 CORE_METRIC_LABELS）、大事（GM.evtLog 择要）、人物结局（GM.chars）。
// 败局多半停局（GM.running=false）；亡国信号是软终局，不停局——页上据 running 给「续理残局」或「回启幕」。
import { bus } from '../core/bus.js';
import { claimOverlays } from './kernel.js';

const w = window;
const G = () => w.GM || {};
let cur = null;           // { type, failGoal, node, mo }

function install() {
  const f = w._showEndgameScreen;
  if (typeof f !== 'function' || f.__newui) return;
  const wrapped = function (type, failGoal) {
    cur = { type, failGoal: failGoal || null };
    const r = f.apply(this, arguments);
    bus.emit('game:endgame', { type });
    return r;
  };
  wrapped.__newui = true;
  w._showEndgameScreen = wrapped;
}
install();
bus.on('kernel:ready', install);

claimOverlays((n) => {
  if (n.id !== '_endgame') return false;
  if (cur) {
    cur.node = n;
    if (cur.mo) cur.mo.disconnect();
    cur.mo = new MutationObserver(() => bus.emit('endgame:changed', {}));     // 太史公评语、本纪逐卷都写进这层
    cur.mo.observe(n, { childList: true, subtree: true, characterData: true });
  }
  return true;
});

const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const KEY_EVENT = /战|叛|亡|篡|婚|改革|科举|继承|驾崩|成就|伏笔|转折|灭|宣战/;

export function data() {
  if (!cur) return null;
  const g = G();
  const p = w.P || {};
  const victory = cur.type === 'victory';
  const sc = typeof w.findScenarioById === 'function' ? w.findScenarioById(g.sid) : null;
  const fg = cur.failGoal;
  let fall = '';
  try { if (!victory && typeof w._histFallCompareHtml === 'function') fall = strip(w._histFallCompareHtml(sc)); } catch (_e) { fall = ''; }
  // 太史公：有推演之器才请得来；老层里先是「正在撰写」，回来后换成「太史公曰：」加三段【】
  const tsgNode = cur.node && cur.node.querySelector('#_taishigong');
  const tsgRaw = tsgNode ? tsgNode.innerText || tsgNode.textContent || '' : '';
  const hasAI = !!(p.ai && p.ai.key);
  const tsg = /太史公曰/.test(tsgRaw)
    ? tsgRaw.replace(/^太史公曰：?\s*/, '').split(/(?=【)/).map((s) => s.trim()).filter(Boolean).map((s) => {
        const m = /^【([^】]+)】\s*([\s\S]*)$/.exec(s);
        return m ? { head: m[1], text: m[2].trim() } : { head: '', text: s };
      })
    : null;
  // 本纪
  const benji = g._benji && Array.isArray(g._benji.sections) ? g._benji.sections.map((s) => ({
    from: typeof w.getTSText === 'function' ? w.getTSText(s.fromTurn) : `第${s.fromTurn}回合`,
    to: typeof w.getTSText === 'function' ? w.getTSText(s.toTurn) : `第${s.toTurn}回合`,
    text: String(s.text || '')
  })) : [];
  const benjiStatus = cur.node && cur.node.querySelector('#_benji_status') ? cur.node.querySelector('#_benji_status').textContent.trim() : '';
  // 诸项升降：每回合一份快照
  const hist = Array.isArray(g._metricHistory) ? g._metricHistory : [];
  const labels = (typeof w.CORE_METRIC_LABELS === 'object' && w.CORE_METRIC_LABELS) || {};
  const keys = Object.keys(labels);
  Object.entries(g.vars || {}).forEach(([k, v]) => { if (v && v.isCore && !keys.includes(k)) keys.push(k); });
  const metrics = hist.length > 1 ? keys.slice(0, 8).map((k) => ({ label: labels[k] || k, values: hist.map((s) => Number(s && s[k]) || 0) })) : [];
  // 终局国势：四项取真值——局已终，奏报失真的帘子可以揭了；朝廷所闻（perceived）与真值有出入的一并列出
  const n = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);
  const c = g.corruption || {}, mx = g.minxin || {}, hq = g.huangquan || {}, hw = g.huangwei || {};
  const ct = n(c.trueIndex, n(c.overall)), mt = n(mx.trueIndex, n(mx.index, n(mx.value)));
  const realm = [
    { label: '吏治', value: Math.round(100 - ct), seen: c.perceivedIndex !== undefined ? Math.round(100 - n(c.perceivedIndex)) : null },
    { label: '民心', value: Math.round(mt), seen: mx.perceivedIndex !== undefined ? Math.round(n(mx.perceivedIndex)) : null },
    { label: '皇权', value: Math.round(n(hq.index)), seen: hq.perceivedIndex !== undefined ? Math.round(n(hq.perceivedIndex)) : null },
    { label: '皇威', value: Math.round(n(hw.index)), seen: hw.perceivedIndex !== undefined ? Math.round(n(hw.perceivedIndex)) : null }
  ].map((x) => ({ ...x, seen: x.seen !== null && Math.abs(x.seen - x.value) >= 3 ? x.seen : null }));
  const events = (g.evtLog || []).filter((e) => KEY_EVENT.test(e && e.text || '')).slice(-30).map((e) => ({
    when: typeof w.getTSText === 'function' ? w.getTSText(e.turn) : `第${e.turn}回合`, text: String(e.text || ''),
    tone: /战|叛|亡|灭/.test(e.text) ? 'bad' : /婚|科举|成就/.test(e.text) ? 'good' : 'mid'
  }));
  const people = (g.chars || []).slice().sort((a, b) => (b.importance || 50) - (a.importance || 50)).slice(0, 60).map((c) => ({
    name: c.name, title: c.officialTitle || c.title || '', alive: c.alive !== false, death: c.alive === false ? String(c.deathReason || '') : '', loyalty: Math.round(c.loyalty || 0)
  }));
  return {
    victory, running: !!g.running,
    date: typeof w.getTSText === 'function' ? w.getTSText(g.turn) : '', turns: g.turn || 0,
    scenario: sc ? sc.name : '',
    goals: victory ? (p.goals || []).filter((x) => x && x.completed).map((x) => x.title || x.name) : [],
    fail: !victory && fg ? { title: fg.title || fg.name || '', desc: fg.description || '' } : null,
    fall, hasAI, tsg, benji, benjiStatus, realm, metrics, events, people
  };
}
// 收起终局页：老层随之撤掉（内核那颗「再来一局」也只是撤层）
export function dismiss() {
  if (cur && cur.mo) cur.mo.disconnect();
  if (cur && cur.node) cur.node.remove();
  cur = null;
}
export const active = () => !!cur;
