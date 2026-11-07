#!/usr/bin/env node
// 事的容器（甲1a）smoke：适配器、并案、显著度、只读、幂等、收界、来源结了或没了、存读档往返、开关与接线。
// 夹具里每类来源各一两条；并案和显著度的期望值按 tm-matters.js 的规则手算（见各断言旁的算式）。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const clone = (v) => JSON.parse(JSON.stringify(v));
// 沙箱里造的数组、对象原型和外面不同，严格深比较会判不等；比较前两边都走一遍 JSON
const norm = (v) => (v === undefined ? v : clone(v));
const ok = (v, m) => { assert(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(norm(a), norm(b), m); checks++; };
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
const sha = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const withoutMatters = (gm) => { const c = Object.assign({}, gm); delete c.matters; return c; };

function sandbox() {
  const c = { console: { log() {}, warn() {}, error() {} }, TM: {} };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(read('tm-matters.js'), c, { filename: 'tm-matters.js' });
  return c;
}

// 第 5 回合的一个小世界
function world() {
  return {
    turn: 5,
    chars: [
      { id: 'c1', name: '朱由检', isPlayer: true }, { id: 'c2', name: '王承恩' }, { id: 'c3', name: '王承' },
      { id: 'c4', name: '杨鹤' }, { id: 'c5', name: '毛文龙' }, { id: 'c6', name: '魏忠贤' }, { id: 'c7', name: '崔呈秀' }, { id: 'c8', name: '袁崇焕' }
    ],
    _edictTracker: [
      { id: 'e-now', content: '「陕西赈务」命杨鹤总理陕西赈务，发银十万两赈济饥民。', category: '政令', turn: 5, lastSubmittedTurn: 5, status: 'pending', assignee: '杨鹤、户部' },
      { id: 'e-old', content: '命毛文龙清核东江兵马钱粮，三月具奏。', category: '军令', turn: 4, status: 'pending_delivery' },
      { id: 'e-done', content: '命礼部议开科取士。', category: '其他', turn: 3, status: 'completed' },
      { id: 'e-now2', content: '命袁崇焕专管宁锦。', category: '军令', turn: 5, lastSubmittedTurn: 5, status: 'pending' }
    ],
    _npcCommitments: { '毛文龙': [{ id: 'order-4-1', task: '命毛文龙清核东江兵马钱粮，三月具奏。', status: 'pending' }] },
    _wdRewardPunish: [{ target: '王承恩', type: 'reward', detail: 'gold', turn: 5 }, { target: '崔呈秀', type: 'punish', detail: 'fine', turn: 4 }],
    currentIssues: [
      { id: 'iss-shaanxi', title: '陕西大饥荒', description: '陕西连年大旱，饥民遍野，杨鹤奏请发银赈济饥民。', severity: 'urgent', status: 'pending' },
      { id: 'iss-wei', title: '魏忠贤阉党', description: '魏忠贤党羽盘踞，崔呈秀握京营。', severity: 'high', status: 'linked' },
      { id: 'iss-closed', title: '旧案已结', description: '已结之事。', status: 'resolved' },
      { id: 'iss-info', title: '边报 · 天下军情', category: '军情', status: 'pending', _info: true },
      { id: 'iss-key', title: '行在何所', category: '关键决策', description: '行在定于何处，群臣争论未决。', status: 'pending' }
    ],
    _pendingTinyiTopics: [
      { id: 'ty-linked', title: '民情·陕西饥民请赈', linkedIssue: 'iss-shaanxi', priority: 80 },
      { id: 'ty-free', title: '清议·开海与否', priority: 40 }
    ],
    memorials: [
      { id: 'mem-pending', from: '崔呈秀', title: '京营防务', content: '臣崔呈秀谨奏京营防务。', status: 'pending' },
      { id: 'mem-replied', from: '魏忠贤', title: '请修生祠', content: '奴婢魏忠贤请修生祠。', status: 'pending_review', reply: '著礼部议' }
    ],
    activeWars: [{ id: 'war-1', attacker: '后金', defender: '明', status: 'ongoing' }],
    activeSchemes: [
      { id: 'sch-due', schemer: '魏忠贤', target: '王承恩', plan: '谋夺宫禁', status: 'active', progressPct: 100 },
      { id: 'sch-slow', schemer: '崔呈秀', target: '朱由检', plan: '握兵自固', status: 'active', progressPct: 40 }
    ],
    _routeDisruptions: [{ id: 'rd-1', route: '潼关', text: '潼关驿道为流民所阻', severity: 'urgent' }],
    _foreshadows: [
      { turn: 3, content: '魏忠贤党羽盘踞京营，崔呈秀或图反噬', type: 'threat', resolveBy: 5 },
      { turn: 4, content: '林丹汗西掠，边衅将开', type: 'threat', resolveBy: 8 },
      { turn: 2, content: '海外有异船来泊', type: 'opportunity', resolveBy: 4 }
    ],
    _candidateEvents: [
      { id: 'ev-auto', title: '九千岁表忠', presenter: '魏忠贤', triggerCondition: 'T4-T6 自动触发', payload: '奴婢魏忠贤叩见。', _fired: false },
      { id: 'ev-cond', title: '皇后劝谏', triggerCondition: 'T5 若玩家亲近阉党', _fired: false },
      { id: 'ev-past', title: '首辅疏言', triggerCondition: 'T2 自动触发', _fired: false },
      { id: 'ev-fired', title: '已触发', triggerCondition: 'T5 自动触发', _fired: true }
    ],
    evtLog: [
      { turn: 4, type: '兵变', text: '宁塞卫兵欠饷哗变，三千众溃散' },
      { turn: 5, type: '成就', text: '达成：陕北民变控制' },
      { turn: 5, type: '边闻', text: '塞外雪灾，牧户急售马匹' },
      { turn: 5, type: '财政', text: '太仓亏空二十万两' },
      { turn: 2, type: '民变', text: '旧日民变，不在这段时日' }
    ],
    _hiddenMoves: [{ text: '暗流', turn: 5 }],
    _npcActionLedger: [{}, {}]
  };
}

const c = sandbox();
const M = c.TM.Matters;
const P = { conf: { mattersLedgerEnabled: false } };

// ── 1. 适配器：每类来源立出期望的候选 ──
{
  const gm = world();
  const cands = M.collect(gm, { periodDays: 30 });
  const by = (key) => cands.filter((x) => x.key === key)[0];
  ok(by('edictTracker:e-now').must && by('edictTracker:e-now').status === 'open', '本回合的诏令是必办');
  ok(!by('edictTracker:e-old').must && by('edictTracker:e-old').status === 'open', '此前没办完的诏令先当择办候选');
  eq(by('edictTracker:e-done').status, 'settled', '办完的诏令是已结候选（用来结掉旧的事）');
  ok(by('npcCommitment:order-4-1').must, '待办的承诺是必办');
  ok(by('wdRewardPunish:T5') && by('wdRewardPunish:T5').must, '本回合的问对赏罚合成一件必办');
  ok(by('wdRewardPunish:T5').title.indexOf('1 人') >= 0, '只算本回合的赏罚（上回合那条不算）');
  eq(by('currentIssue:iss-closed').status, 'settled', 'resolved 的要务是已结候选');
  ok(by('tinyiTopic:ty-free').deskOnly, '没议的待议留案头');
  ok(by('memorial:mem-pending').deskOnly && !by('memorial:mem-replied').deskOnly, '没批的奏疏留案头，批过的进案');
  ok(by('activeWar:war-1'), '进行中的战事立案');
  ok(by('activeScheme:sch-due') && !by('activeScheme:sch-slow'), '到期的阴谋立案，没到期的不立');
  ok(by('routeDisruption:rd-1'), '驿路阻断进候选');
  ok(by('candidateEvent:ev-auto') && !by('candidateEvent:ev-cond') && !by('candidateEvent:ev-past') && !by('candidateEvent:ev-fired'), '剧本事件只立在触发回合内、自动触发、没触发过的');
  ok(cands.some((x) => x.origin.source === 'evtLog' && x.title.indexOf('哗变') >= 0), '兵变信号进候选');
  ok(!cands.some((x) => x.origin.source === 'evtLog' && x.title.indexOf('达成') >= 0), '成就提示不算信号');
  ok(!cands.some((x) => x.origin.source === 'evtLog' && x._text.indexOf('旧日民变') >= 0), '太早的日志不看');
  const rumor = cands.filter((x) => x.origin.source === 'evtLog' && x._text.indexOf('雪灾') >= 0)[0];
  ok(rumor && rumor.verification === 'rumor' && rumor._severity === 'normal', '传闻标风闻并降一级');
  const info = M.inspect(gm, {});
  ok(info.notFiled.some((x) => x.source === 'activeScheme' && /未到期/.test(x.reason)), '没到期的阴谋记原因');
  ok(info.notFiled.some((x) => x.source === 'candidateEvent' && /条件触发/.test(x.reason)), '条件触发的剧本事件记原因');
  ok(info.notFiled.some((x) => x.source === 'candidateEvent' && /过了触发回合/.test(x.reason)), '过了触发回合的剧本事件记原因');
  ok(info.notFiled.some((x) => x.source === 'foreshadow' && /未到期/.test(x.reason)), '没到期的伏笔记原因');
  ok(!by('currentIssue:iss-info') && info.notFiled.some((x) => x.ref === 'iss-info' && /说明性/.test(x.reason)), '说明性要务（_info）不立案并记原因');
  eq(info.countOnly._hiddenMoves, 1, '暗流只计数');
  eq(info.countOnly._npcActionLedger, 2, 'NPC 行动账只计数');
  eq(by('edictTracker:e-now').stakeholders.map((s) => s.ref), ['杨鹤'], '经手人拆开，衙门不算利害人');
}

// ── 2. 草稿：诏令还没登记时，按类各立一件必办；某类全文包在另一类里的，从长的那件扣掉 ──
{
  const gm = world();
  gm._edictTracker = [];
  gm._savedEdictDrafts = { 'edict-pol': '命杨鹤赈陕。命毛文龙清核东江。', 'edict-mil': '命毛文龙清核东江。', 'xinglu-pub': '朕夜读奏疏。' };
  const drafts = M.collect(gm, {}).filter((x) => x.origin.source === 'edictDraft');
  eq(drafts.map((x) => x.origin.ref), ['T5:political', 'T5:military', 'T5:xinglu'], '草稿按类立案，行止单立');
  ok(drafts.every((x) => x.must), '草稿都是必办');
  eq(drafts[0]._text, '命杨鹤赈陕。', '政令里包着的军令原文被扣掉');
  gm._edictTracker = [{ id: 'x', content: '命杨鹤赈陕。', turn: 5, lastSubmittedTurn: 5, status: 'pending' }];
  ok(!M.collect(gm, {}).some((x) => x.origin.source === 'edictDraft' && x.origin.ref !== 'T5:xinglu'), '诏令登记后不再从草稿重复立案');
}

// ── 3. 并案 + 显著度 + 案单 ──
{
  const gm = world();
  const before = sha(withoutMatters(gm));
  const stats = M.file(gm, { periodDays: 30 });
  eq(sha(withoutMatters(gm)), before, 'file 除 GM.matters 外一个字节不改');
  const store = gm.matters;
  const get = (key) => store.byId[M._idOf(key)];
  const shaanxi = get('edictTracker:e-now');
  ok(shaanxi.materials.some((x) => x.source === 'currentIssue' && x.ref === 'iss-shaanxi'), '陕西要务并进陕西赈务那道诏（杨鹤 3 分 + 陕西、杨鹤、发银、赈济、济饥、饥民 6 分 = 9）');
  ok(shaanxi.materials.some((x) => x.source === 'tinyiTopic' && x.ref === 'ty-linked'), '挂在要务上的待议随要务一起并过来');
  ok(!get('currentIssue:iss-shaanxi'), '被并走的要务不单立');
  const old = get('edictTracker:e-old');
  ok(old && old.must, '上回合没办完的诏，因有待办的承诺升为必办');
  ok(old.materials.some((x) => x.source === 'npcCommitment'), '承诺挂到它那道诏上');
  ok(!get('npcCommitment:order-4-1'), '承诺不单立');
  ok(!shaanxi.materials.some((x) => x.source === 'edictTracker') && !old.materials.some((x) => x.source === 'edictTracker'), '两道诏永不相并');
  const wei = get('currentIssue:iss-wei');
  ok(wei.materials.some((x) => x.source === 'foreshadow' && /到期伏笔/.test(x.why)), '到期伏笔并进相关的要务');
  ok(stats.skippedItems.some((x) => x.source === 'foreshadow' && /没有可并/.test(x.reason)), '没处可并的到期伏笔不立并记下');
  ok(stats.skippedItems.some((x) => x.source === 'evtLog' && /不过线/.test(x.reason)), '风闻信号显著度不过线不立');
  // 显著度：紧迫取缺省 0.3 × 3 = 0.9，交办 4，新异 1
  eq(shaanxi.salience.total, 5.9, '本回合诏令的显著度 = 0.9 + 4 + 1');
  eq(get('edictTracker:e-now2').salience.total, 4.9, '同类第二道诏没有新异分（0.9 + 4）');
  eq(get('currentIssue:iss-wei').salience.parts.urgency.score, 1.8, '严重度 high → 紧迫 0.6 × 3');
  eq(get('currentIssue:iss-key').salience.parts.urgency.value, 0.6, '没写严重度的「关键决策」按高算');
  eq(get('candidateEvent:ev-auto').salience.parts.urgency.value, 1, '剧本事件触发窗还剩 1 回合 → 紧迫 1');
  eq(get('routeDisruption:rd-1').salience.total, 4, '驿路阻断：urgent 3 + 新异 1，过线');
  ok(Object.keys(shaanxi.salience.parts).every((k) => typeof shaanxi.salience.parts[k].note === 'string'), '各项都带说明');
  const dk = M.docket(gm, { periodDays: 30 });
  eq(dk.must.map((m) => m.origin.ref), ['e-now', 'e-old', 'e-now2', 'T5'], '必办按诏令顺序，赏罚在后');
  eq(dk.quota, 8, '30 日的择办名额是 8');
  eq(dk.optional.length, 8, '择办选满');
  ok(dk.desk.some((m) => m.origin.ref === 'ty-free') && dk.desk.some((m) => m.origin.ref === 'mem-pending'), '案头放没议的待议和没批的奏疏');
  ok(dk.optional.filter((m) => m.origin.source === 'evtLog').length <= 4, '信号至多占择办一半');
  eq(store.byDocket['c1'].length, Object.keys(store.byId).length, '玩家案头挂全部未结的事');
  ok(Object.keys(store.byId).every((id) => store.byId[id].status === 'open'), '存下的都是未结');
  ok(!JSON.stringify(store).includes('"_text"'), '临时字段不进存档');
}

// ── 4. 只读：collect、docket、salience 不写任何东西，P 不动 ──
{
  const gm = world();
  M.file(gm, {});
  const b = sha(gm), pb = sha(P);
  M.collect(gm, {});
  M.inspect(gm, {});
  M.docket(gm, {});
  M.salience(M.collect(gm, {})[0], gm);
  eq(sha(gm), b, 'collect / inspect / docket / salience 不改 GM');
  eq(sha(P), pb, '不改 P');
}

// ── 5. 幂等 ──
{
  const gm = world();
  M.file(gm, {});
  const ids = Object.keys(gm.matters.byId).sort();
  const s2 = M.file(gm, {});
  eq(Object.keys(gm.matters.byId).sort(), ids, '连跑两遍 id 不变');
  eq(s2.filed, 0, '第二遍不新立');
  eq(s2.updated, ids.length, '第二遍全是更新');
  eq(s2.closed, 0, '第二遍不结');
}

// ── 6. 来源结了、没了 ──
{
  const gm = world();
  M.file(gm, {});
  gm.activeWars[0].status = 'ended';
  gm.currentIssues = gm.currentIssues.filter((x) => x.id !== 'iss-wei');
  M.file(gm, {});
  const closed = (key) => gm.matters.closed.filter((x) => x.id === M._idOf(key))[0];
  eq(closed('activeWar:war-1').closedBy, 'source-closed', '战事结束，对应的事结掉');
  eq(closed('currentIssue:iss-wei').closedBy, 'source-gone', '要务没了，对应的事结掉');
  ok(!gm.matters.byId[M._idOf('activeWar:war-1')], '结掉的事从未结里拿走');
  gm.activeWars[0].status = 'ongoing';
  M.file(gm, {});
  ok(gm.matters.byId[M._idOf('activeWar:war-1')] && !closed('activeWar:war-1'), '战事重开，重新立案并从已结摘要里拿掉');
}

// ── 7. 收界 ──
{
  const gm = { turn: 1, chars: [], currentIssues: [] };
  for (let i = 0; i < 350; i++) gm.currentIssues.push({ id: 'i' + i, title: '要务' + i, description: '第' + i + '件', priority: i % 100 });
  const s = M.file(gm, {});
  eq(Object.keys(gm.matters.byId).length, 300, '未结至多 300 件');
  ok(s.skipped >= 50 && s.skippedItems.some((x) => /超出未结上限/.test(x.reason)), '超出的记下');
  gm.matters.closed = [];
  for (let i = 0; i < 250; i++) gm.matters.closed.push({ id: 'old' + i, title: '', domain: 'court', kind: 'x', closedTurn: 0, closedBy: 'x' });
  gm.currentIssues = gm.currentIssues.slice(0, 10);
  M.file(gm, {});
  eq(gm.matters.closed.length, 200, '已结摘要至多 200 条');
  ok(gm.matters.closed[gm.matters.closed.length - 1].id !== 'old249', '新结的排在最后');
}

// ── 8. 小工具 ──
{
  eq(clone(M._triggerWindow('T1 自动触发')), { from: 1, to: 1 }, '「T1 自动触发」只管第 1 回合');
  eq(clone(M._triggerWindow('T2-T3 自动触发')), { from: 2, to: 3 }, '「T2-T3 自动触发」管第 2 到 3 回合');
  eq(M._triggerWindow('T1 若未处理辽饷财政'), null, '带条件的不认');
  eq(clone(M._namesIn('王承恩奉旨见王承', world())), ['王承恩', '王承'], '长名字先占位，「王承恩」里的「王承」不重复算');
  eq(M._titleOf('「陕西粮饷非常事」胡廷宴即刻停掌赈务'), '陕西粮饷非常事', '「」里的标题优先');
  eq(M._titleOf('孙承宗统筹、袁崇焕专管关宁前线。上层负责财政'), '孙承宗统筹、袁崇焕专管关宁前线', '取第一句');
  ok(M._idOf('currentIssue:甲') !== M._idOf('currentIssue:乙'), '中文 ref 不撞 id');
  ok(M.ensure(null) === null && M.file(null) === null, '没有 GM 不抛错');
  const broken = { turn: 1, _edictTracker: 'oops', currentIssues: [null, { id: 'x' }], memorials: [{}], activeSchemes: [null] };
  ok(M.file(broken, {}) && broken.matters, '来源形状坏了不抛错');
}

// ── 9. 存读档往返：用游戏真实的快照函数 ──
{
  const src = read('tm-save-lifecycle.js');
  const pick = (name) => {
    const m = src.match(new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}\\n'));
    assert(m, '在 tm-save-lifecycle.js 里找不到 ' + name);
    return m[0];
  };
  const s = { TM: {}, deepClone: clone, JSON };
  vm.createContext(s);
  vm.runInContext(pick('_tmSaveSnapshotSkipKeys') + pick('_autoSaveSnapshotGM'), s, { filename: 'tm-save-lifecycle.js(节选)' });
  ok(!s._tmSaveSnapshotSkipKeys().matters, '存档跳过表里没有 matters');
  const gm = world();
  M.file(gm, {});
  const snap = s._autoSaveSnapshotGM(gm, {});
  const loaded = JSON.parse(JSON.stringify(snap));   // 读档时 GM 整份换成存档里的 gameState（tm-save-lifecycle.js 读档路径 GM = _incomingGM）
  eq(loaded.matters, clone(gm.matters), 'GM.matters 存读往返无损');
  const old = world();
  ok(M.docket(old, {}).must.length === 0 && !old.matters, '没有 GM.matters 的旧档读进来不报错、不自动建');
}

// ── 10. 开关与接线 ──
{
  const html = read('index.html');
  const iOut = html.indexOf('tm-edict-outcomes.js'), iMat = html.indexOf('tm-matters.js');
  ok(iMat > iOut && html.slice(iOut, iMat).split('<script').length === 2, 'index.html 里 tm-matters.js 紧跟 tm-edict-outcomes.js');
  const prep = read('tm-endturn-prep.js');
  const hook = prep.match(/ {2}\/\/ 事的容器（甲1a[\s\S]*?\n {2}\}\n/);
  ok(hook && prep.indexOf(hook[0]) > prep.indexOf('TM.EdictOutcomes.collect(GM, edicts, GM.turn)'), '过回合挂点在诏令登记之后');
  const run = (enabled, file) => {
    const s = { TM: { Matters: file ? { file } : M }, P: { conf: { mattersLedgerEnabled: enabled } }, GM: world(), console: { warn() {} } };
    vm.createContext(s);
    vm.runInContext('(function(edicts, xinglu){\n' + hook[0] + '\n})({}, "")', s);
    return s.GM;
  };
  ok(!run(false).matters, '开关关着：过回合不建 GM.matters');
  ok(run(true).matters && Object.keys(run(true).matters.byId).length > 0, '开关打开：过回合立案');
  let threw = false;
  try { run(true, () => { throw new Error('boom'); }); } catch (_) { threw = true; }
  ok(!threw, '立案出错不挡回合');
  const patches = read('tm-patches.js');
  ok(patches.includes('id="s-matters-ledger"') && patches.includes("_togglePConf(\\'mattersLedgerEnabled\\',this.checked)"), '设置面板有开关');
  ok(/mattersLedgerEnabled:\s*\{\s*on:/.test(read('tm-player-settings.js')), '开关切换有提示语');
}

console.log('[smoke-matters-ledger] pass assertions=' + checks);
