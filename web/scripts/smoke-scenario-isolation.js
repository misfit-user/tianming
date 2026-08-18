#!/usr/bin/env node
// smoke-scenario-isolation.js — 跨剧本数据隔离（防串台）回归
//
// 复现并锁死玩家报的两类 bug：
//   ① 载入绍宋剧本，却看到天启官方剧本的人物/势力/势力事件（P.characters/factions/events/
//      rigidHistoryEvents 是跨剧本累积表·官方天启快照常驻 + 玩过的剧本都按 sid 留在 P 里；
//      GM.chars 已按 sid 严格过滤·但多处 UI/引擎消费方在 GM 之外又「附加整份 P.xxx」漏进别的剧本）。
//   ② 先玩绍宋再开天启，天启局里混进绍宋内容（同根因·方向相反）。
// 同时锁死归去来兮黑屏修复（backToLaunch 还原启动页 hero）的源码契约。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; }
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

// ── 1. 取真助手（不重新实现·测的是 tm-data-model.js 里 shipped 的那份）──
const dmSrc = read('tm-data-model.js');
const helperMatch = dmSrc.match(/function _tmActiveScenarioRows\(arr\)\{[\s\S]*?\n\}/);
assert(helperMatch, 'tm-data-model.js 必须定义 _tmActiveScenarioRows 助手');
assert(/window\._tmActiveScenarioRows\s*=\s*_tmActiveScenarioRows/.test(dmSrc), '助手必须挂到 window（供各文件运行时取用）');
let GM = { sid: null };
(0, eval)(helperMatch[0].replace('function _tmActiveScenarioRows(arr){',
  'globalThis._tmActiveScenarioRows = function(arr){').replace(/\n\}$/, '\n};'));
const _tmActiveScenarioRows = globalThis._tmActiveScenarioRows;
assert(typeof _tmActiveScenarioRows === 'function', '助手可取');

// ── 2. 真官方剧本数据（天启 + 绍宋）──
globalThis.window = globalThis;
(0, eval)(read('tm-official-scenario-bundle.js'));
const B = globalThis.TMOfficialScenarioBundle;
const TQ = B.find(b => b.data.id === 'sc-tianqi7-1627').data;
const SS = B.find(b => b.data.id === 'sc-jianyan1-1127-shaosong').data;
const TQ_SID = 'sc-tianqi7-1627', SS_SID = 'sc-jianyan1-1127-shaosong';
assert(TQ && SS, '取到天启+绍宋官方数据');

// 运行时 P.characters：两剧本累积（doActualStart/desktopStartScn 会 force-set sid=激活剧本）
const tqChars = JSON.parse(JSON.stringify(TQ.characters)).map(c => { c.sid = TQ_SID; return c; });
const ssChars = JSON.parse(JSON.stringify(SS.characters)).map(c => { c.sid = SS_SID; return c; });
const P = { characters: ssChars.concat(tqChars) };
const tqNames = new Set(TQ.characters.map(c => c.name));
const ssNames = new Set(SS.characters.map(c => c.name));

// getPeople/loadPeople 范式：先加 GM.chars（严格 sid），再补 P.characters。
function roster(sid, useFix) {
  globalThis.GM = GM = { sid: sid };
  const gmChars = P.characters.filter(c => c.sid === sid);      // GM.chars 建法
  const seen = {}, out = [];
  const add = (c) => { if (!c || !c.name || seen[c.name]) return; seen[c.name] = true; out.push(c); };
  gmChars.forEach(add);
  const supplement = useFix ? _tmActiveScenarioRows(P.characters) : P.characters; // FIX vs OLD
  supplement.forEach(add);
  return out.map(c => c.name);
}

// ── 3. bug① 载入绍宋·名册不含天启 ──
const r1 = roster(SS_SID, true);
const leak1 = r1.filter(n => tqNames.has(n) && !ssNames.has(n));
assert(leak1.length === 0, 'bug①: 绍宋名册不得混入天启人物 (实际漏 ' + leak1.length + ')');
assert(r1.includes('赵构') && r1.includes('岳飞'), 'bug①: 绍宋名册仍含本剧本人物(赵构/岳飞)');

// ── 4. bug③ 先绍宋再天启·名册不含绍宋 ──
const r3 = roster(TQ_SID, true);
const leak3 = r3.filter(n => ssNames.has(n) && !tqNames.has(n));
assert(leak3.length === 0, 'bug③: 天启名册不得混入绍宋人物 (实际漏 ' + leak3.length + ')');
assert(r3.includes('朱由检'), 'bug③: 天启名册仍含本剧本人物(朱由检)');

// ── 5. swap-test：旧的「附加整份 P」范式必然串台（证明测试能抓到 bug）──
const oldLeak = roster(SS_SID, false).filter(n => tqNames.has(n) && !ssNames.has(n));
assert(oldLeak.length > 100, 'swap-test: 旧范式(不过滤)必然漏大量天启人物·才证明修复有效 (实际漏 ' + oldLeak.length + ')');

// ── 6. 预览/编辑（无激活剧本 GM.sid=null）→ 原样返回·不改既有行为 ──
globalThis.GM = { sid: null };
assert(_tmActiveScenarioRows(P.characters).length === P.characters.length, '无激活剧本时助手返回全部(预览/编辑不变)');
assert(_tmActiveScenarioRows('not-array').length === 0 && _tmActiveScenarioRows(null).length === 0, '助手对非数组安全');

// ── 7. 根治契约：刚性史事/事件有了 GM 单剧本之家·gameplay 读 GM 不读 P 库 ──
//   ① doActualStart 给当前局建 GM.rigidHistoryEvents(单剧本干净副本)——补上唯一缺 GM 之家的 gameplay 数组
const patchesSrc = (read('tm-patches.js') + '\n' + read('tm-patches-start.js'));
assert(/GM\.rigidHistoryEvents\s*=\s*\(P\.rigidHistoryEvents\s*\|\|\s*\[\]\)\.filter\([\s\S]{0,80}\.sid\s*===\s*sid/.test(patchesSrc),
  '根治: doActualStart 必须建当前剧本的 GM.rigidHistoryEvents 单一真相源');
//   ② rigidHistoryEvents/events 的 gameplay 消费方读 GM·不读 P 库
const gmContracts = [
  ['tm-history-events.js', /Array\.isArray\(GM\.rigidHistoryEvents\)\s*\)\s*\?\s*GM\.rigidHistoryEvents/, 'rigidHistoryEvents 处理器读 GM'],
  ['tm-ai-planning.js', /Array\.isArray\(GM\.rigidHistoryEvents\)\s*\)\s*\?\s*GM\.rigidHistoryEvents/, 'AI 预设史事提示读 GM'],
  ['tm-three-systems-ext.js', /Array\.isArray\(GM\.events\)\s*\)\s*\?\s*GM\.events/, '开局事件激活读 GM'],
  ['tm-endturn-prompt.js', /Array\.isArray\(GM\.events\)[\s\S]{0,40}\?\s*GM\.events/, 'endturn 提示 events 读 GM']
];
gmContracts.forEach(([f, re, why]) => assert(re.test(read(f)), '根治: ' + f + ' 必须 ' + why + '(不读多剧本 P 库)'));
//   ③ 防回归：gameplay 处理器不得再出现「裸读多剧本 P 库去 forEach/filter/find」而无 GM/sid 收口
const noRawLib = [
  ['tm-history-events.js', /P\.rigidHistoryEvents\.forEach/, '裸 P.rigidHistoryEvents.forEach'],
  ['tm-history-events.js', /=\s*P\.rigidHistoryEvents\.find\(/, '裸 P.rigidHistoryEvents.find(应走 GM)'],
  ['tm-three-systems-ext.js', /(?<!_tmActiveScenarioRows\()P\.events\.forEach/, '裸 P.events.forEach'],
  ['tm-char-autogen.js', /_tmCharListFromContainer\(P\.parties\)/, '裸 P.parties(党派应收口)'],
  ['tm-military-ui.js', /\(P\.factions\s*\|\|\s*P\.facs\s*\|\|\s*\[\]\)\.filter/, '裸 P.factions 势力下拉(应走 GM.facs)']
];
noRawLib.forEach(([f, re, what]) => assert(!re.test(read(f)), '根治防回归: ' + f + ' 不得再 ' + what));

// ── 7b. 全量剧本配置重置：A 有而 B 缺的字段不得残留，设备配置/剧本库不得误删 ──
const resetStart = patchesSrc.indexOf('function _tmResetScenarioScopedConfig');
const resetEnd = patchesSrc.indexOf('\nfunction doActualStart', resetStart);
assert(resetStart >= 0 && resetEnd > resetStart, '找到剧本作用域 P 重置器');
(0, eval)(patchesSrc.slice(resetStart, resetEnd).replace(
  'function _tmResetScenarioScopedConfig(target) {',
  'globalThis._tmResetScenarioScopedConfig = function(target) {'
).replace(/\n}\nif \(typeof window[\s\S]*$/, '\n};'));
const scopedP = {
  conf: { difficulty: 'hard' }, ai: { model: 'keep' }, scenarios: [{ id: 'keep' }],
  government: { stale: true }, mechanicsConfig: { stale: true }, goals: ['stale'],
  playerInfo: { characterName: '旧主角' }, time: { year: 999 }, officeTree: [{ stale: true }],
  factionRelations: [{ stale: true }], supplySystem: { enabled: true }
};
globalThis._tmResetScenarioScopedConfig(scopedP);
assert(scopedP.conf.difficulty === 'hard' && scopedP.ai.model === 'keep' && scopedP.scenarios.length === 1,
  '剧本重置不得删除设备配置/AI配置/剧本库');
assert(!scopedP.government && !scopedP.factionRelations && !scopedP.supplySystem,
  'B 缺失的世界/外交/补给配置不得继承 A');
assert(scopedP.goals.length === 0 && Object.keys(scopedP.playerInfo).length === 0 && scopedP.officeTree.length === 0,
  'B 缺失的目标/玩家/官制配置恢复为空');
assert(scopedP.time.year === -356 && scopedP.mechanicsConfig && Object.keys(scopedP.mechanicsConfig).length === 0,
  '时间和机制配置恢复确定默认值而非沿用 A');
//   ④ 这 3 处补漏确实改走 GM/收口
assert(/Array\.isArray\(GM\.facs\)\s*&&\s*GM\.facs\.length/.test(read('tm-military-ui.js')), '根治: 军务势力下拉读 GM.facs');
assert(/_rigids\s*=\s*\(GM\s*&&\s*Array\.isArray\(GM\.rigidHistoryEvents\)\)/.test(read('tm-history-events.js')) && /_rigids\.find\(/.test(read('tm-history-events.js')), '根治: applyEventBranch 从 GM.rigidHistoryEvents 查');
assert(/_tmActiveScenarioRows\(P\.parties\)/.test(read('tm-char-autogen.js')), '根治: autogen 党派收口');

// ── 8. 字符/势力消费方契约：GM 优先 + sid 收口的 P 兜底(预览/无局时)走 _tmActiveScenarioRows ──
const helperContracts = [
  ['phase8-formal-bridge.js', /_tmActiveScenarioRows\(P\.characters\)/],
  ['tm-renwu-tuzhi.js', /_tmActiveScenarioRows\(P\.characters\)/],
  ['tm-chaoyi.js', /_tmActiveScenarioRows\(P\.factions\)/],
  ['tm-char-autogen.js', /_tmActiveScenarioRows/],
  ['tm-wendui.js', /_tmActiveScenarioRows/]
];
helperContracts.forEach(([f, re]) => assert(re.test(read(f)), f + ' 人物/势力消费方必须按 sid 收口 P 兜底'));

// ── 9. 刚性史事按剧本隔离(GM 单一真相源)──
function buildGMRigid(sid, pRigid) { return (pRigid || []).filter(e => e && e.sid === sid).map(e => JSON.parse(JSON.stringify(e))); }
const pRigid = [{ id: 'wei', name: '魏忠贤自缢', sid: TQ_SID }, { id: 'ke', name: '客氏杖毙', sid: TQ_SID }]; // 快照常驻天启
assert(buildGMRigid(SS_SID, pRigid).length === 0, '根治: 绍宋局 GM.rigidHistoryEvents 不含天启刚性史事');
assert(buildGMRigid(TQ_SID, pRigid).length === 2, '根治: 天启局 GM.rigidHistoryEvents 含天启自己的 2 条');

// ── 9b. 变量定义(inversed 升降好坏/核心标签)按剧本隔离：读当前局 GM.vars·不读 set-once 的 P.variables ──
const varM = dmSrc.match(/function _tmActiveVars\(\)\{[\s\S]*?\n\}/);
assert(varM, 'tm-data-model.js 必须定义 _tmActiveVars 助手');
(0, eval)(varM[0].replace('function _tmActiveVars(){', 'globalThis._tmActiveVars = function(){').replace(/\n\}$/, '\n};'));
globalThis.GM = { sid: SS_SID, vars: { '民心': { name: '民心', inversed: false, sid: SS_SID }, '党争': { name: '党争', inversed: true, sid: SS_SID } } };
globalThis.P = { variables: [{ name: '阉党权势', inversed: true, sid: TQ_SID }] }; // 天启快照变量(set-once 库)
const av = globalThis._tmActiveVars().map(v => v.name);
assert(av.indexOf('阉党权势') === -1, '变量隔离: 绍宋局变量定义不得混入天启变量(阉党权势)');
assert(av.indexOf('民心') >= 0 && av.indexOf('党争') >= 0, '变量隔离: 仍取到当前局 GM.vars 变量');
globalThis.GM = { sid: null, vars: {} };
assert(globalThis._tmActiveVars().some(v => v.name === '阉党权势'), '无局时回退 P.variables(预览/编辑不变)');
const varContracts = [
  ['tm-utils.js', /_tmActiveVars\(\)/, 'buildCoreMetricLabels 读 GM.vars'],
  ['tm-endturn-shiji-compose.js', /_tmActiveVars\(\)/, 'inversed 升降方向读 GM.vars'],  // 2026-07-06 delta 判向迁 compose 总览卷
  ['tm-endturn-helpers.js', /_tmActiveVars\(\)/, '核心指标建议读 GM.vars']
];
varContracts.forEach(([f, re, why]) => assert(re.test(read(f)), '根治: ' + f + ' 必须 ' + why));

// ── 10. bug② 归去来兮黑屏：backToLaunch 必须还原启动页 hero + 收起 #main-view ──
const launchSrc = read('tm-launch.js');
const btl = launchSrc.match(/function backToLaunch\(\)\{[\s\S]*?GameHooks\.run\('backToLaunch:after'\);\}/);
assert(btl, '找到 backToLaunch');
assert(/\.home-stage[\s\S]*?\.style\.display\s*=\s*['"]['"]/.test(btl[0]) || /_hero[\s\S]*?display\s*=\s*['"]['"]/.test(btl[0]),
  'bug②: backToLaunch 必须把 hero(.home-stage) display 还原为可见');
assert(/main-view[\s\S]*?display\s*=\s*['"]none['"]/.test(btl[0]), 'bug②: backToLaunch 必须收起 #main-view');

console.log('✓ smoke-scenario-isolation PASS — ' + A + ' assertions');
console.log('  绍宋名册 ' + r1.length + ' 人(0 天启漏) · 天启名册 ' + r3.length + ' 人(0 绍宋漏) · 旧范式漏 ' + oldLeak.length + ' 天启人');
