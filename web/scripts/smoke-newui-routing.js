#!/usr/bin/env node
'use strict';
/* smoke-newui-routing — 新UI「假入口/泄真值/交互缝」修缮验收(fix/newui-routing-fix)
 * ①地图警示条/人物三按钮改接真面板(源码锚+可行处功能断言)
 * ②四官印(吏/民)+户口丁走奏报失真层口径(fixture 失真开→显据奏值·带 ReportedView 真桩执行)
 * ③批红裸写降级删除(缺 mutator 不裸写 m.status)
 * ④右栏只作导航，不以其他模块的统计数伪装待办 + 刷新签名保留 memorials/_pendingAudiences
 * ⑤window.openZhao/… 单点导出收口(真源=drafts)
 * ⑥切换双真相源经单一 setLegacyView 收敛 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function ok(c, m){ if (c){ A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function read(f){ return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function count(s, sub){ return s.split(sub).length - 1; }
console.log('smoke-newui-routing');

const mapSrc = read('phase8-formal-map.js');
const bridgeSrc = read('phase8-formal-bridge.js');
const topbarSrc = read('phase8-formal-topbar.js');
const modulesSrc = read('phase8-formal-modules.js');
const draftsSrc = read('phase8-formal-drafts.js');

// ── ① 假入口改接真面板 ──
ok(count(mapSrc, "TMPhase8FormalBridge.openAction(\\'memorial\\')") === 2, '① 地图待批奏疏警示条(动态版+静态版)改走 openAction(memorial)·2处');
ok(count(mapSrc, "TMPhase8FormalBridge.openModule(\\'memorial\\')") === 0, '① 地图不再残留 openModule(memorial) 假入口');
ok(/kind === 'memorial'[\s\S]{0,40}openYueZouPreviewPanel/.test(bridgeSrc) || /openAction[\s\S]{0,120}openYueZouPreviewPanel/.test(bridgeSrc), '① openAction(memorial) 落真朱批面板 openYueZouPreviewPanel');
const paSlice = bridgeSrc.slice(bridgeSrc.indexOf('personAction: function'), bridgeSrc.indexOf('refresh: function'));
ok(paSlice.length > 0 && /action === 'wendui'/.test(paSlice) && /window\.openWenduiModal\(name, 'formal'\)/.test(paSlice), '① 召入问对→真 window.openWenduiModal(name,formal)(右栏同款)');
ok(/GM\._pendingLetterTo = name/.test(paSlice) && /openHongyanPreviewPanel\(\)/.test(paSlice), '① 鸿雁传书→openHongyanPreviewPanel 且消费 GM._pendingLetterTo 预填收信人');
ok(/action === 'office'[\s\S]*?openOfficeStandalone\(\)/.test(paSlice), '① 官制任免→openOfficeStandalone 真官制树');
ok(count(paSlice, "openModule('letter');") === 0 && count(paSlice, "openModule('office');") === 0, '① personAction 不再残留 letter/office 假 openModule 调用(注释中的旧名不计)');

// ── ② 顶栏泄真值·接回失真层(真桩执行) ──
global.window = global;
const RV = require('../tm-reported-view.js');
function slc(src, mark, end){ const a = src.indexOf(mark), b = src.indexOf(end, a + 1); if (a < 0 || b <= a) throw new Error('slice miss: ' + mark); return src.slice(a, b); }
const varsSrc = read('tm-topbar-vars.js');
const flipBody = slc(varsSrc, 'function _barFlipToPerceived', 'function _renderLizhi');
const reportedBody = slc(varsSrc, 'function _barReported', 'function _renderGuoku');
const psBody = slc(topbarSrc, 'function powerSealData', 'function _hukouDingHtml');
const hukouBody = slc(topbarSrc, 'function _hukouDingHtml', 'var _TB_CORNER');
const P_OFF = { conf: {} };
const P_ON = { conf: { gameMode: 'strict_hist', reportedViewEnabled: true } };

function makePowerSeal(GM, P){
  const win = { GM: GM };
  const fn = new Function('TM', 'P', 'window',
    flipBody + '\n' + psBody + '\nwindow._barFlipToPerceived = _barFlipToPerceived;\nreturn powerSealData;');
  return fn({ ReportedView: RV }, P, win);
}
const GM_D = { corruption: { trueIndex: 88, perceivedIndex: 30 }, minxin: { trueIndex: 18, perceivedIndex: 72 }, turn: 3, sid: 's' };

// 失真 off：条 fill 显真值(零回归)
global.GM = JSON.parse(JSON.stringify(GM_D));
let ps = makePowerSeal(global.GM, P_OFF);
let lz = ps('lizhi'), mx = ps('minxin');
ok(lz.trueV === Math.round(100 - 88), '② 失真off·吏治印 trueV=真清明度(100-88=12)');
ok(mx.trueV === 18, '② 失真off·民心印 trueV=真值18');

// 失真 on 未揭真：条 fill 掉头据奏·真值不泄
global.GM = JSON.parse(JSON.stringify(GM_D));
ps = makePowerSeal(global.GM, P_ON);
lz = ps('lizhi'); mx = ps('minxin');
ok(lz.trueV === Math.round(100 - 30) && lz.trueV === lz.seenV, '② 失真on未揭真·吏治印 trueV=据奏(100-30=70)=seenV');
ok(lz.trueV !== Math.round(100 - 88), '② 失真on·吏治真浊度88从条 fill 消失(不泄真值)');
ok(mx.trueV === 72 && mx.trueV === mx.seenV, '② 失真on未揭真·民心印 trueV=据奏72=seenV(真值18不泄)');

// 户口丁：经 _barReported 走据奏口径
function makeHukouDing(GM, P){
  const win = { GM: GM, _barFmtNum: function(n){ return String(n); } };
  const fn = new Function('TM', 'P', 'window', 'esc',
    reportedBody + '\n' + hukouBody + '\nwindow._barReported = _barReported;\nreturn _hukouDingHtml;');
  return fn({ ReportedView: RV }, P, win, function(s){ return String(s); });
}
const rawDing = 12345;
const gmH = { population: { national: { ding: rawDing } }, turn: 3, sid: 's' };
global.GM = gmH;
const expected = RV.value('renli', 'national.ding', rawDing, { direction: 'bad', dept: undefined }).shown;
const htmlOn = makeHukouDing(gmH, P_ON)();
ok(htmlOn.indexOf(String(expected)) >= 0, '② 户口丁经 _barReported 据奏口径(HTML值==RV据奏值 ' + expected + ')');
const htmlOff = makeHukouDing(gmH, P_OFF)();
ok(htmlOff.indexOf(String(rawDing)) >= 0, '② 失真off·户口丁=真值12345直通');

// 财计模块：经 _VAR_RENDERERS 据奏访问器·不再裸读 stockMoney||money
ok(/_VAR_RENDERERS/.test(modulesSrc) && /_stockView\(/.test(modulesSrc), '② 财计模块库藏经 _VAR_RENDERERS.guoku()/neitang() 访问器');
ok(count(modulesSrc, "['太仓银', g.stockMoney || g.money]") === 0, '② 财计模块删除 stockMoney||money 模糊回退');

// ── ③ 批红裸写降级删除 ──
ok(count(draftsSrc, 'm.status = decision;') === 0, '③ deskStageMemorial 删除裸写 m.status=decision 降级分支');
ok(/批红通道未就绪/.test(draftsSrc), '③ 缺 mutator 改 toast「批红通道未就绪」并 return 不改状态');
ok(/window\._stageMemorialDecision === 'function'/.test(draftsSrc), '③ 保留 _stageMemorialDecision mutator 正路');

// ── ④ 导航不再挂错位红泡；真实数量留在各自业务面板 ──
ok(!/RAIL_DYNAMIC_BADGE_SLOTS|function railDynamicBadgeCount/.test(bridgeSrc), '④ 删除退役的跨模块角标计数器，而非继续读完数据再隐藏');
ok((bridgeSrc.match(/data-phase8-badge="audience"/g)||[]).length===2, '④ 两条 rail 均仅生成对应真实请见的角标');
ok(/function updateRailBadges/.test(bridgeSrc) && /_updateRailBadges: updateRailBadges/.test(bridgeSrc), '④ 保留旧刷新调用的兼容清理入口');
ok(/listSig\(gm\.memorials\)/.test(bridgeSrc) && /_pendingAudiences/.test(bridgeSrc), '④ 刷新签名并入 memorials 长度摘要 + _pendingAudiences 长度');

// ── ⑤ 全局名双设收口(单点导出=drafts) ──
ok(count(bridgeSrc, 'window.openZhao = openZhaoPreviewPanel') === 0, '⑤ bridge 删除 window.openZhao 重复导出');
ok(/唯一 owner/.test(bridgeSrc) && /phase8-formal-drafts\.js/.test(bridgeSrc), '⑤ bridge 注释注明唯一 owner=drafts');
ok(/openZhao: openZhaoPreviewPanel/.test(bridgeSrc), '⑤ bridge 命名空间导出 bridge.openZhao 保留(内部仍可用)');
ok(count(draftsSrc, 'window.openZhao = openZhaoPreviewPanel') === 1, '⑤ drafts 保留 window.openZhao 单点真源');
ok(/window\.openYueZou = openYueZouPreviewPanel/.test(draftsSrc) && /window\.openHongyan = openHongyanPreviewPanel/.test(draftsSrc) && /window\.openShilu = openShiluPreviewPanel/.test(draftsSrc), '⑤ drafts 单点导出四名齐(YueZou/Hongyan/Shilu)');

// ── ⑥ 切换双真相源经单一 setter 收敛 ──
ok(/function setLegacyView\(v\)/.test(bridgeSrc), '⑥ 新增单一 setter setLegacyView(v)');
ok(/document\.body\.classList\.toggle\('tm-phase8-legacy'/.test(bridgeSrc), '⑥ setter 派生 body class tm-phase8-legacy(flag+class 成对)');
ok(count(bridgeSrc, 'state.legacyView = true') === 0, '⑥ 无 state.legacyView=true 裸置(全走 setter)');
ok(count(bridgeSrc, 'state.legacyView = false') <= 1, '⑥ state.legacyView=false 仅剩顶部 init(转换点走 setter)');
ok(count(bridgeSrc, 'setLegacyView(false)') >= 2 && count(bridgeSrc, 'setLegacyView(true)') === 1, '⑥ showHome/leaveFormalRuntime→setLegacyView(false)·openLegacyTab→setLegacyView(true)');

// ══ Codex 复审返工四条·各配红绿(死rail探针/缺drafts降级/徽标口径/签名状态敏感) ══

// 返① 闻徽标挂生效 rail(死rail探针)：ensureRail=ensurePreviewRail 是生效者·须含 rumor 槽
ok(/ensureRail = ensurePreviewRail/.test(bridgeSrc), '返①ㆍensurePreviewRail 为生效 rail(ensureRail 被其覆盖)');
const previewRailFn = bridgeSrc.slice(bridgeSrc.indexOf('function ensurePreviewRail'), bridgeSrc.indexOf('ensureRail = ensurePreviewRail'));
ok(/\['rumor',SVG_RUMOR,'风闻情报'/.test(previewRailFn) && /var SVG_RUMOR =/.test(previewRailFn), '返①ㆍ生效 rail 补 rumor(闻)槽+SVG_RUMOR·闻入口在生效 DOM 存在(非死rail)');
ok(!previewRailFn.includes('data-phase8-badge="rumor"'), '返①ㆍ风闻入口保留，但近事总数不冒充未读提醒');

// 返② drafts 缺席=死按钮 → 降级 toast+回退 openModule(真跑包装器)
function runWrapper(name){
  const line = bridgeSrc.match(new RegExp('function ' + name + '\\(\\)\\{[^\\n]*\\}'))[0];
  let toasted = null, opened = null;
  const w = new Function('window', 'toast', 'openModule', line + '\nreturn ' + name + ';')(
    { TMPhase8FormalBridge: {} }, function(t){ toasted = t; }, function(k){ opened = k; return 'MOD:' + k; });
  w();
  return { toasted, opened };
}
const r2a = runWrapper('openYueZouPreviewPanel');
ok(!!r2a.toasted && r2a.opened === 'memorial', '返②ㆍdrafts 缺席·openYueZou(朱批)→toast+回退 openModule(memorial)·非死按钮');
const r2b = runWrapper('openHongyanPreviewPanel');
ok(!!r2b.toasted && r2b.opened === 'letter', '返②ㆍdrafts 缺席·openHongyan(人物传书)→toast+回退 openModule(letter)');

// 返③ 退役仅限右侧导航，不能误删其他面板的真实待批/未读提醒。
const { functionSource } = require('./lib-perf-round1');
const oldBadges = [{ removed:false, getAttribute(){return 'ol';}, remove(){this.removed=true;} }, { removed:false, getAttribute(){return 'pinned';}, remove(){this.removed=true;} }];
let cleanedSelector = '';
const clean = new Function('document', 'railAudienceCount', functionSource(bridgeSrc, 'updateRailBadges') + '\nreturn updateRailBadges;')({querySelectorAll(selector){cleanedSelector=selector;return oldBadges;}},()=>0);
clean();clean();
ok(oldBadges.every(b=>b.removed) && cleanedSelector === '#tm-right-rail .tm-rc-count, #tm-phase8-formal-rail .tmf-rail-count', '返③ㆍ兼容清理幂等且仅限两种右栏；不清真实奏疏/信件提醒');

// 返④ listSig 状态敏感：原地改末条 status → 签名变；无 status 数组零回归
const lsStart = bridgeSrc.indexOf('function listSig');
const lsBody = bridgeSrc.slice(lsStart, bridgeSrc.indexOf('return [', lsStart));
const listSig = new Function('compactText', lsBody + '\nreturn listSig;')(function(s, n){ return String(s).slice(0, n); });
const sigA = listSig([{ title: 'a', status: 'pending' }, { title: 'b', status: 'pending' }]);
const sigB = listSig([{ title: 'a', status: 'pending' }, { title: 'b', status: 'approved' }]);
ok(sigA !== sigB, '返④ㆍlistSig 状态敏感·末条 pending→approved 签名变(原不变=漏刷)');
ok(listSig([{ title: 'x' }, { title: 'y' }]) === listSig([{ title: 'x' }, { title: 'y' }]), '返④ㆍ无 status 数组零回归');

console.log('\nsmoke-newui-routing ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
