#!/usr/bin/env node
// smoke-shiji-volumes.js — 史记弹窗「御览分卷」重做契约（2026-07-06）
//   ① 七卷结构齐整·总览默认展开·各板块归卷正确
//   ② 空数据不抛·空卷显空态雅句
//   ③ emoji 表情退役（无代理对码点·单字印代之）
//   ④ 兼容 alias（_renderUnifiedChanges/_renderPersonnelChanges）存在
//   ⑤ 静态：index.html 加载序（compose 先于 render）·styles.css 新旧类并存（旧存档 html 回放兼容）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let n = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); n++; }
function escHtml(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function mkSandbox(gm, p) {
  const sb = {
    console, Math, Date, JSON, RegExp, Error, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
    escHtml,
    getTSText(turn) { return 'T' + turn; },
    TM: { errors: { capture() {}, captureSilent() {} } },
    CORE_METRIC_LABELS: { minxin: '民心', huangwei: '皇威' },
    AccountingSystem: {
      getLedger() {
        return gm._mockLedger || { items: [], totalIncome: 0, totalExpense: 0, netChange: 0 };
      }
    },
    GM: gm, P: p
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-shiji-compose.js'), 'utf8'), sb, { filename: 'tm-endturn-shiji-compose.js' });
  return sb;
}

// ── 丰满数据：全板块着床 ──
const fullGM = {
  turn: 12,
  minxin: 52, _prev_minxin: 55, huangwei: 72, _prev_huangwei: 70,
  _metricHistory: [
    { turn: 8, minxin: 57, huangwei: 69 }, { turn: 9, minxin: 55, huangwei: 68 },
    { turn: 10, minxin: 54, huangwei: 69 }, { turn: 11, minxin: 55, huangwei: 70 }, { turn: 12, minxin: 52, huangwei: 72 }
  ],
  chars: [{ name: '孙承宗', faction: '明军', alive: true, loyalty: 80 }],
  facs: [{ name: '明军', color: '#c9a84c' }],
  vars: { 民心: { value: 55 } },
  evtLog: [{ type: 'NPC自主', turn: 11, text: '孙承宗巡视蓟辽防务' }],
  factionEvents: [{ turn: 11, actor: '后金', target: '察哈尔', action: '遣使结好', result: '未成' }],
  activeSchemes: [{ schemer: '客氏', target: '东林', startTurn: 11, goal: '构陷' }],
  activeWars: [],
  battleHistory: [],
  marchOrders: [],
  _turnBattleResults: [{
    turn: 11, attacker: '明军', defender: '后金', attackerSoldiers: 30000, defenderSoldiers: 20000,
    attackerLoss: 1000, defenderLoss: 3000, winner: '明军', verdict: '小胜',
    affectedArmies: [{ armyId: 'a1', side: 'attacker', loss: 1000, commanderFate: { name: '孙承宗', outcome: 'survived' } }]
  }],
  armies: [{ id: 'a1', name: '关宁军', faction: '明军', commander: '孙承宗', soldiers: 29000, state: 'garrison', morale: 70, supply: 60 }],
  turnChanges: {
    variables: [{ name: '皇威', label: '皇威', path: 'huangwei.index', oldValue: 70, newValue: 72, reasons: [{ desc: '大婚颁赏', delta: 2 }] }],
    characters: [{ name: '孙承宗', changes: [{ field: 'loyalty', oldValue: 74, newValue: 80, reason: '御批嘉勉' }] }],
    factions: [{ name: '后金', changes: [{ field: 'strength', oldValue: 60, newValue: 64, reason: '整军经武' }] }],
    parties: [{ name: '东林', changes: [{ field: 'influence', oldValue: 50, newValue: 52, reason: 'court feedback approved' }] }],
    classes: [{ name: '士绅', changes: [{ field: 'satisfaction', oldValue: 40, newValue: 42, reason: 'player-action tax' }] }],
    military: [{ name: '关宁军', changes: [{ field: 'soldiers', oldValue: 30000, newValue: 29000, reason: '战损' }] }],
    map: [], population_changes: [{ region: '陕西', kind: 'flee', amount: 4000, reason: '苛役无度' }]
  },
  guoku: { money: 315000, grain: 900000, cloth: 12000, turnIncome: 80000, turnExpense: 60000 },
  _prevGuoku: { money: 300000, grain: 880000, cloth: 12500 },
  neitang: { money: 90000, grain: 10000, cloth: 3000 },
  _prevNeitang: { money: 88000, grain: 11000, cloth: 3000 },
  population: { national: { households: 9000000, mouths: 51000000, ding: 14000000 }, fugitives: 120000, hiddenCount: 800000 },
  _prevPopulation: { national: { households: 9010000, mouths: 51050000, ding: 14010000 }, fugitives: 116000, hiddenCount: 790000 },
  _turnReport: [
    { type: 'fiscal_adj', target: 'guoku', resource: 'money', kind: 'expense', amount: 5000, name: '赈济陕西', reason: '灾荒' },
    { type: 'tinyi_review', turn: 11, outcome: 'fulfilled', histLabel: '廷议·清丈田亩', venueType: '廷议', edictContent: '清丈北直隶田亩', proposerParty: '东林', delayTurns: 3 }
  ],
  _edictEfficacyReport: {
    turn: 11,
    skipped: false, total: 1, overallEfficacy: 72,
    efficacyByDimension: { military: 80, fiscal: 60 },
    reports: [{ status: 'partial', executionLevel: 60, content: '整饬蓟辽边备', evidence: '兵部覆奏', outcomeShortTerm: '边备稍振', nextAdvice: '续拨军饷' }],
    unexpectedEvents: [{ severity: '中', category: '边事', title: '哨骑遇袭', detail: '广宁外哨骑折损十余' }],
    courtReaction: { clearFaction: '称善' }, popularReaction: '未闻',
    oppositionSummary: ['户部诉帑绌'], strategicInsight: '以守为攻', topPriority: '补关宁军饷'
  },
  _reconcileLog: [{ turn: 11, total: 4, fiscalW: 2, personW: 2 }],
  _reconcilePatchLog: [{ turn: 11, mode: 'tool_use', patch: { personnel_changes: [{ name: '王在晋', change: '罢任', reason: '叙事补录' }] } }],
  _tyrantHistory: [1, 2],
  _tyrantDecadence: 20,
  _mockLedger: { items: [{ type: 'income', name: '两税', amount: 80000 }, { type: 'expense', name: '军饷', amount: 52000 }], totalIncome: 80000, totalExpense: 52000, netChange: 28000 },
  shijiHistory: [], qijuHistory: [], jishiRecords: []
};
const fullP = {
  time: { year: 1626, startMonth: 1, perTurn: '1m' },
  adminHierarchy: {},
  playerInfo: { factionName: '明军' },
  variables: [], conf: {}
};

const sb = mkSandbox(fullGM, fullP);
assert(typeof sb._composeShijiHtml === 'function', '① _composeShijiHtml 可调');
const html = sb._composeShijiHtml({
  shizhengji: '辽东整军，朝议清丈。\n\n陕西苛役，民多走逃。',
  playerStatus: '朝局暂稳', playerInner: '朕心难安',
  oldVars: {}, tyrantResult: { flavorTexts: [{ name: '夜宴', text: '灯火达旦' }], totalStress: -2, costLog: [], gainLog: [] },
  shiluText: '上御经筵，问蓟辽军务。', szjTitle: '整军清丈', szjSummary: '边备与田政并举',
  personnelChanges: [{ name: '王在晋', change: '罢任', reason: '经略无功' }, { name: '袁可立', change: '病殁', reason: '积劳' }],
  hourenXishuo: '后人有诗云：辽海风霜满戍楼。'
});

// ① 七卷结构
assert(/class="sjc-frame"/.test(html) && /class="sjc-spine"/.test(html) && /class="sjc-pages"/.test(html), '② 分卷骨架 frame/spine/pages 齐');
['overview', 'annals', 'military', 'ledger', 'audit', 'personnel', 'misc'].forEach(function(v) {
  assert((html.match(new RegExp('class="sjc-tab[^"]*" data-vol="' + v + '"', 'g')) || []).length === 1, '③ 卷签唯一·' + v);
  assert((html.match(new RegExp('<section class="sjc-vol[^"]*"[^>]*data-vol="' + v + '"', 'g')) || []).length === 1, '④ 卷体唯一·' + v);
});
assert(/class="sjc-tab on[^"]*" data-vol="overview"/.test(html) && /<section class="sjc-vol on"[^>]*data-vol="overview"/.test(html), '⑤ 总览默认展开');

// ② 板块归卷
function vol(id) {
  const m = html.match(new RegExp('<section class="sjc-vol[^"]*"[^>]*data-vol="' + id + '"[^>]*>([\\s\\S]*?)</section>'));
  return m ? m[1] : '';
}
assert(/tr-shilu/.test(vol('annals')) && /tr-szj-content/.test(vol('annals')), '⑥ 实录+时政记归实录卷');
assert(/battle-card/.test(vol('military')) && /军卷入/.test(vol('military')), '⑦ 战况归军务卷(含 affectedArmies details)');
assert(/tr-cg-guoku/.test(vol('ledger')) && /tr-cg-politic/.test(vol('ledger')) && /岁 计 流 水/.test(vol('ledger')), '⑧ 帑廪/政治核心/岁计流水归数值卷');
assert(/御 批 回 听/.test(vol('audit')) && /前 议 追 责/.test(vol('audit')), '⑨ 御批回听+前议追责归问责卷');
assert(/tr-person-row/.test(vol('personnel')) && /袁可立/.test(vol('personnel')), '⑩ 人事变动归人事卷');
assert(/tr-houren-box/.test(vol('misc')) && /sjc-status-row/.test(vol('misc')) && /sjc-cnst/.test(vol('misc')), '⑪ 后人戏说/角色状态/一致性归杂录卷');
assert(/sjc-ov-chip/.test(vol('overview')) && /sjc-ov-nav/.test(vol('overview')), '⑫ 总览卷有大势 chips+卷目提要');
assert(/data-vol-go="military"/.test(vol('overview')), '⑬ 提要卡可跳卷(data-vol-go)');
assert(/sjc-ov-title/.test(vol('overview')) && /整军清丈/.test(vol('overview')), '⑬a 头版大题(szjTitle 升总览)');
assert(/sjc-core-bars/.test(vol('overview')) && /sjc-core-row/.test(vol('overview')), '⑬b 国势水位条在场');
assert(/sjc-spark/.test(vol('overview')), '⑬c 近势 sparkline 在场(_metricHistory 有账)');
assert(/sjc-vol-head/.test(vol('military')) && /卷之二/.test(vol('military')), '⑬d 卷首行(卷之N)在非总览卷');
// a11y/交互契约（ui-ux-pro-max 过堂·2026-07-06）
assert((html.match(/role="tab" aria-selected="true"/g) || []).length === 1 && (html.match(/role="tab"/g) || []).length === 7, '⑬e 卷签 role=tab·aria-selected 唯一真值');
assert((html.match(/role="tabpanel"/g) || []).length === 7, '⑬f 卷体 role=tabpanel×7');
assert(/<button type="button" class="sjc-ov-nav/.test(html), '⑬g 提要卡为真按钮(键盘可达)');
assert(/class="d (good|bad)">[+−]/.test(vol('overview')), '⑬h 水位涨跌带正负号(形状编码不独赖颜色)');
assert(typeof sb._sjcRestoreVol === 'function', '⑬i 翻历史恢复卷函数导出');
assert(!/[❗⚠⚡⚙⏳✓✗★◐◔◑⇒▲▼◈▸✕]/.test(html), '⑬j 符号图标清零(去 emoji·汉字印/正负号/纯文字代之)');
assert(/sjc-spark[\s\S]{0,400}?<circle/.test(vol('overview')), '⑬k sparkline 末端点(当前期强调·dataviz 规格)');

// ③ emoji 表情退役（无 U+1F000+ 代理对·符号区 ⚠⚡⏳⚙✓ 允许）
assert(!/[\uD83C-\uD83E][\uDC00-\uDFFF]/.test(html), '⑭ 输出无 emoji 代理对(单字印代之)');
assert(/sjc-glyph/.test(html), '⑮ 单字印 sjc-glyph 在场');

// ④ 空数据：空壳 GM 不抛·空态雅句
const sbEmpty = mkSandbox({ turn: 2, chars: [], facs: [], vars: {}, evtLog: [], factionEvents: [], armies: [], battleHistory: [], activeWars: [], turnChanges: {}, shijiHistory: [], _turnReport: [] }, { time: {}, variables: [], conf: {} });
const emptyHtml = sbEmpty._composeShijiHtml({ shizhengji: '', playerStatus: '', playerInner: '', oldVars: {}, tyrantResult: null, shiluText: '', szjTitle: '', szjSummary: '', personnelChanges: [], hourenXishuo: '' });
assert(/sjc-frame/.test(emptyHtml), '⑯ 空数据仍出分卷骨架(不抛)');
assert(/sjc-empty/.test(emptyHtml) && /四海晏然/.test(emptyHtml) && /铨曹无事/.test(emptyHtml), '⑰ 空卷显空态雅句');
assert(/sjc-tab hollow|sjc-tab on hollow|class="sjc-tab[^"]*hollow/.test(emptyHtml), '⑱ 空卷卷签 hollow 降暗');

// ⑤ alias 与内核导出
assert(typeof sb._renderUnifiedChanges === 'function' && typeof sb._renderPersonnelChanges === 'function', '⑲ 兼容 alias 存在(pipeline typeof 开关不倒退)');
assert(sb.TM.Endturn && sb.TM.Endturn.ShijiCompose && typeof sb.TM.Endturn.ShijiCompose.compose === 'function' && typeof sb.TM.Endturn.ShijiCompose.switchVol === 'function', '⑳ TM.Endturn.ShijiCompose 命名空间导出');

// ⑥ 静态契约
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const posCompose = idx.indexOf('tm-endturn-shiji-compose.js');
const posRender = idx.indexOf('tm-endturn-render.js');
assert(posCompose > 0 && posRender > 0 && posCompose < posRender, '㉑ index.html 加载序：compose 先于 render');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
assert(/\.sjc-frame\{/.test(css) && /\.sjc-spine\{/.test(css) && /\.sjc-tab\{/.test(css), '㉒ styles.css 分卷样式在场');
assert(/\.tr-detail-toggle\{/.test(css) && /\.turn-section h3\{/.test(css), '㉓ 旧结构类保留(旧存档 html 历史回放兼容)');
assert(/max-width:900px[\s\S]{0,400}\.sjc-spine\{flex-direction:row/.test(css), '㉔ 移动端卷目转横滚签媒查在场');
const renderSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-render.js'), 'utf8');
assert(/_composeShijiHtml\(\{/.test(renderSrc), '㉕ render 已接组装函数');
assert(!/tr-detail-toggle/.test(renderSrc), '㉖ render 旧 toggle 组装已除(结构一体化)');

console.log('[smoke-shiji-volumes] PASS assertions=' + n);
