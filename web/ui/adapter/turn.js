// 推演幕：过回合时内核 TM.Endturn.Progress（tm-endturn-progress.js）按「拍表」逐拍报进度——start（带生效拍表）、beat（第几拍）、
// label（横插事项，如科举、廷推）、done（到末拍）、pause（朝会等横插，回合仍忙）、abort（中止）。
// 老界面的电影化加载层 #tm-etl（tm-endturn-loading.js）订阅同一事件画全屏影像；新前端认领它、藏起来，由 screens/turnveil.js 另画。
// 这里把拍事件转成纯数据（拍 id、组、序号）发 turn:progress；kernel.js 那条 game:advance-progress 只剩数值，拍与组都丢了。
// 场景图沿用老加载层那三十四幅（web/assets/etl-scenes，随发版资产走，不进仓库）；缺图时幕后只是暗底。
import { bus } from '../core/bus.js';
import { claimOverlays } from './kernel.js';

const w = window;
claimOverlays((n) => n.id === 'tm-etl');

// 老加载层的场景名目（tm-endturn-loading.js 的 SCENES，闭包里不外露，照抄）
const SCENES = [['etl-01', '内苑传闻'], ['etl-02', '阁臣夜议'], ['etl-03', '朝议成案'], ['etl-04', '边关急牍'], ['etl-05', '廷议复核'], ['etl-06', '守城来报'],
  ['etl-07', '漕路回传'], ['etl-08', '驿路入京'], ['etl-09', '户部清册'], ['etl-10', '廷臣聚议'], ['etl-11', '军情火急'], ['etl-12', '边镇日暮'],
  ['etl-13', '水驿邸报'], ['etl-14', '案牍封奏'], ['etl-15', '边野侦骑'], ['etl-16', '营门传令'], ['etl-17', '内殿会审'], ['etl-18', '殿中奏对'],
  ['etl-19', '禁中夜雨'], ['etl-20', '百官朝参'], ['etl-21', '兵部急报'], ['etl-22', '烽火边警'], ['etl-23', '关津税报'], ['etl-24', '驿路星驰'],
  ['etl-25', '地方灾报'], ['etl-26', '民夫调运'], ['etl-27', '城下军报'], ['etl-28', '乡堡点验'], ['etl-29', '市井征收'], ['etl-30', '内廷收束'],
  ['etl-31', '百官候旨'], ['etl-32', '夜殿密奏'], ['etl-33', '史馆校书'], ['etl-34', '帘内议政']];
export function scenes() { return SCENES.map(([f, tone]) => ({ src: `assets/etl-scenes/${f}.jpg`, tone })); }

const beatOf = (b) => (b ? { id: String(b.id || ''), group: String(b.group || ''), stream: !!b.stream } : null);
function install() {
  const P = w.TM && w.TM.Endturn && w.TM.Endturn.Progress;
  if (!P || typeof P.on !== 'function' || P.__newuiTurn) return;
  P.__newuiTurn = true;
  P.on((type, p) => {
    p = p || {};
    const out = { type, index: Number.isFinite(p.index) ? p.index : -1, total: Number(p.total) || 0, pct: Number(p.pct) || 0, label: String(p.label || '') };
    if (type === 'start') out.beats = (p.beats || []).map(beatOf);
    if (p.beat) out.beat = beatOf(p.beat);
    bus.emit('turn:progress', out);
  });
}
install();
bus.on('kernel:ready', install);

// ---------- 回合复核与应急恢复（tm-emergency-recovery-*.js）----------
// 每回合主推演后，内核固定起一场「回合复核」（kind turn-review，回合已存档后在后台续跑）；主推演某一调用重试用尽时另起「应急恢复」。
// 二者都在 window 上发 tm-emergency-recovery（detail 是状态行），老界面 tm-emergency-recovery-settings.js 据此在右下角挂 #tm-recovery-progress。
// 新前端认领它、藏起来，转成 turn:review 由推演幕与书案角上的小签画；「失败后询问」一式的问话（TM.RecoverySettings.ask）也换成新前端的卷。
claimOverlays((n) => n.id === 'tm-recovery-progress');
const PHASE = { starting: '起', awaiting_permission: '候准', investigating: '查证', prepared: '拟修', verifying: '核验', verified: '已毕', stopped: '已止', pending: '候', applying: '施行', applied: '已行', deferred: '暂缓' };
const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
w.addEventListener('tm-emergency-recovery', (e) => {
  const r = (e && e.detail) || {};
  const b = r.budget || {};
  bus.emit('turn:review', {
    id: String(r.id || ''), kind: r.kind === 'turn-review' ? 'review' : 'recovery', phase: String(r.phase || ''), phaseName: PHASE[r.phase] || '进行',
    over: r.phase === 'verified' || r.phase === 'stopped', calls: n0(r.calls), maxCalls: n0(b.maxCalls), steps: n0(r.steps), repairs: n0(r.repairs),
    tokens: n0(r.estimatedTokens), maxTokens: n0(b.maxTokens), detail: String(r.detail || '')
  });
});
export function cancelReview(id, kind) {
  const TM = w.TM || {};
  if (kind === 'review' && TM.RecoveryReview && TM.RecoveryReview.cancel) return TM.RecoveryReview.cancel(id);
  if (TM.EmergencyRecovery && TM.EmergencyRecovery.cancel) return TM.EmergencyRecovery.cancel(id);
  throw new Error('无从取消');
}
// 「失败后询问」：内核在调用处现取 TM.RecoverySettings.ask(summary, signal)，要一个 Promise<boolean>；回合中止（signal）即作罢
function installAsk() {
  const RS = w.TM && w.TM.RecoverySettings;
  if (!RS || RS.__newui) return;
  RS.__newui = true;
  RS.ask = (summary, signal) => new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(!!v); bus.emit('turn:recovery-asked', {}); };
    if (signal && signal.aborted) { finish(false); return; }
    if (signal) signal.addEventListener('abort', () => finish(false), { once: true });
    bus.emit('turn:recovery-ask', { call: String((summary && summary.call) || ''), answer: finish });
  });
}
installAsk();
bus.on('kernel:ready', installAsk);

// 回合中朝会（推演后召集朝会）在开时，推演幕让开（照老加载层的 courtBlocked）
export function courtHeld() {
  const g = w.GM;
  return !!(g && g._isPostTurnCourt && (!g._pendingShijiModal || g._pendingShijiModal.courtDone === false));
}
// 当下进度（幕中途打开时补画）
export function current() {
  const P = w.TM && w.TM.Endturn && w.TM.Endturn.Progress;
  if (!P || !P.isActive || !P.isActive()) return null;
  const c = P.current && P.current();
  return { beats: (P.activeBeats ? P.activeBeats() : []).map(beatOf), index: c ? c.index : -1, total: c ? c.total : 0 };
}
