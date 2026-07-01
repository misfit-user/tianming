/*
 * smoke-s5-menyin.js — S5 门荫/荫补玩家杠杆（高官荫一子入仕·确定性生成荫生候选+授门荫出身）
 *   _offMenyin(officialName)：达三品(resolveRankLevel≤6)高官 → 确定性建荫生 char(复用 family·零 AI) →
 *   grantPreset(子,'menyin') 授门荫出身 → 入候选池(officialTitle='')待玩家任命。一官一荫(_menyinGranted)。
 *   ★测真代码：headless 加载 app → 调真 _offMenyin + 真 TMGongming.grantPreset。
 * node scripts/smoke-s5-menyin.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ 一·源契约 ════════
const panel = fs.readFileSync(path.join(ROOT, 'tm-office-panel.js'), 'utf8');
ok(/function _offMenyin\(officialName\)/.test(panel), '_offMenyin handler 已定义');
ok(/TMGongming\.grantPreset\(son, 'menyin'/.test(panel), '授门荫出身走 grantPreset(menyin)');
ok(/CharFullSchema[\s\S]{0,40}ensureFullFields\(son\)/.test(panel), '建角色走 ensureFullFields 补必填');
ok(/_menyinGranted/.test(panel), '一官一荫 _menyinGranted 守');
ok(/lv > 0 && lv <= 6/.test(panel), '品级门槛 level≤6(三品以上)');
ok(/window\._offMenyin = _offMenyin/.test(panel), '导出 window._offMenyin 供 onclick');
const runtime = fs.readFileSync(path.join(ROOT, 'tm-office-runtime.js'), 'utf8');
ok(/_offMenyin\(\\'' \+ _safeHolder/.test(runtime) || /_offMenyin\('/.test(runtime), '职位卡荫子按钮接 _offMenyin');
ok(/_menyinLv > 0 && _menyinLv <= 6/.test(runtime), '荫子按钮条件 level≤6');

// ════════ 二·真代码：headless → _offMenyin ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });
vm.runInContext('renderOfficeTree=function(){};toast=function(){};', sandbox);

ok(vm.runInContext('typeof _offMenyin === "function" && !!(typeof TMGongming !== "undefined" && TMGongming.grantPreset)', sandbox), 'boot 后 _offMenyin + TMGongming.grantPreset 可调');

function mkHuzhu(name, title, rankLevel, faction) { return { name: name, officialTitle: title, rankLevel: rankLevel, faction: faction || '明', intelligence: 80, administration: 76, military: 42, loyalty: 70, alive: true }; }
function run(chars) {
  sandbox.GM = { turn: 5, chars: chars, officeTree: [], _chronicle: [], evtLog: [], minxin: { byClass: { shi: { true: 50 } } }, _capital: '京师' };
  sandbox.P = { conf: {} };
  return chars;
}
function callMenyin(name) { sandbox.__nm = name; vm.runInContext('_offMenyin(__nm)', sandbox); }
const findSon = (chars, before) => chars.slice(before).find(c => c && c.familyRole === '荫子');

// (a) 高官荫子 → 生成荫生候选 + 门荫出身
let c1 = run([mkHuzhu('张谦', '吏部尚书', 3, '明')]);
callMenyin('张谦');
ok(c1.length === 2, '真码：高官(尚书·三品)荫子 → GM.chars +1（生成荫生）');
let son = findSon(c1, 1);
ok(!!son && son.familyOf === '张谦', '真码：荫生 familyOf=张谦（复用 family 关系）');
ok(son && son.officialTitle === '', '真码：荫生 officialTitle 空（入候选池·待任命·不直接授官）');
ok(son && son.faction === '明', '真码：荫生承袭荫主派系（入本派候选）');
ok(son && son.resources && son.resources.gongming && son.resources.gongming.path === 'menyin', '真码：荫生授门荫出身 gongming.path=menyin');
ok(son && son.intelligence < c1[0].intelligence && son.intelligence >= 25, '真码：荫生才略由父派生打折（' + (son && son.intelligence) + ' < 80·荫生才平）');
ok(!!c1[0]._menyinGranted, '真码：荫主 _menyinGranted 置位（一官一荫）');

// (b) 再荫 → 不重复（一官只荫一子）
let n2 = c1.length;
callMenyin('张谦');
ok(c1.length === n2, '真码：同官再荫 → 不再生成（一官一荫守）');

// (c) 低品官 → 不得荫子
let c3 = run([mkHuzhu('李吏', '主簿', 14, '明')]);
callMenyin('李吏');
ok(c3.length === 1, '真码：低品官(主簿·未达三品) → 不得荫子（品级门槛真生效）');

// (d) 荫生入候选池：身份完整(ensureFullFields)
let c4 = run([mkHuzhu('王公', '户部尚书', 2, '明')]);
callMenyin('王公');
let son4 = findSon(c4, 1);
ok(son4 && son4.alive === true && typeof son4.age === 'number' && son4.name, '真码：荫生身份完整(alive/age/name·ensureFullFields 补齐)');

// (e) 列表视图职位卡：eligible 高官渲染荫子按钮 / 空缺位不渲染
sandbox.GM = { turn: 5, chars: [mkHuzhu('赵公', '吏部尚书', 3, '明')], facs: [{ name: '明', isPlayer: true }], officeTree: [{ name: '吏部', positions: [{ name: '尚书', rank: '正二品', holder: '赵公' }] }], _capital: '京师' };
sandbox.P = { conf: {}, playerInfo: { factionName: '明' } };
const eligHtml = vm.runInContext('String(_ogpRenderPosCard(GM.officeTree[0].positions[0], "吏部", [0]) || "")', sandbox);
ok(/荫\s*子/.test(eligHtml) && /_offMenyin/.test(eligHtml), '列表卡：eligible 高官 → 渲染荫子按钮(接 _offMenyin)');
sandbox.GM.officeTree[0].positions[0].holder = null;
const vacHtml = vm.runInContext('String(_ogpRenderPosCard(GM.officeTree[0].positions[0], "吏部", [0]) || "")', sandbox);
ok(!/荫\s*子/.test(vacHtml), '列表卡：空缺位 → 无荫子按钮');
// 低品官 → 无荫子按钮
sandbox.GM.chars = [mkHuzhu('钱吏', '主簿', 14, '明')]; sandbox.GM.officeTree = [{ name: '县', positions: [{ name: '主簿', rank: '正九品', holder: '钱吏' }] }];
const lowHtml = vm.runInContext('String(_ogpRenderPosCard(GM.officeTree[0].positions[0], "县", [0]) || "")', sandbox);
ok(!/荫\s*子/.test(lowHtml), '列表卡：低品官(未达三品) → 无荫子按钮');

// ════════ 三·荐辟/荐贤(S5-2) ════════
ok(/function _offJianbi\(officialName\)/.test(panel), '_offJianbi handler 已定义');
ok(/TMGongming\.grant\(person, \{ path: 'jianxuan'/.test(panel), '荐辟授出身走 grant(path:jianxuan·无 preset)');
ok(vm.runInContext('typeof _offJianbi === "function"', sandbox), 'boot 后 _offJianbi 可调');
function callJianbi(name) { sandbox.__jn = name; vm.runInContext('_offJianbi(__jn)', sandbox); }
const findBuyi = (chars, before) => chars.slice(before).find(c => c && c.familyRole === '布衣');

let j1 = run([mkHuzhu('荐主', '都给事中', 7, '明')]);
callJianbi('荐主');
ok(j1.length === 2, '真码：五品官(level≤8)荐辟 → GM.chars +1（生成布衣贤才）');
let bw = findBuyi(j1, 1);
ok(bw && bw._recommendedBy === '荐主' && bw._mentorId === '荐主', '真码：布衣 _recommendedBy/_mentorId=荐主（结知遇·报恩）');
ok(bw && bw.resources && bw.resources.gongming && bw.resources.gongming.path === 'jianxuan', '真码：布衣授荐辟出身 gongming.path=jianxuan');
ok(bw && bw.officialTitle === '' && bw.faction === '明', '真码：布衣入本派候选池(officialTitle 空·待任命)');
ok(bw && bw.intelligence >= 55, '真码：布衣才略中上(' + (bw && bw.intelligence) + '≥55·野有遗贤·别于荫生)');
ok(!!j1[0]._jianbiGranted, '真码：荐主 _jianbiGranted（一官一荐）');
let n3 = j1.length; callJianbi('荐主');
ok(j1.length === n3, '真码：同官再荐 → 不重复（一官一荐守）');
// 低品(>8) → 不得荐
let j2 = run([mkHuzhu('微吏', '典史', 16, '明')]);
callJianbi('微吏');
ok(j2.length === 1, '真码：低品(未达五品 level>8) → 不得荐辟');
// 列表卡荐贤按钮
sandbox.GM = { turn: 5, chars: [mkHuzhu('某卿', '太常寺卿', 5, '明')], facs: [{ name: '明', isPlayer: true }], officeTree: [{ name: '太常寺', positions: [{ name: '卿', rank: '正三品', holder: '某卿' }] }], _capital: '京师' };
sandbox.P = { conf: {}, playerInfo: { factionName: '明' } };
const jHtml = vm.runInContext('String(_ogpRenderPosCard(GM.officeTree[0].positions[0], "太常寺", [0]) || "")', sandbox);
ok(/荐\s*贤/.test(jHtml) && /_offJianbi/.test(jHtml), '列表卡：eligible 官 → 渲染荐贤按钮(接 _offJianbi)');

// ════════ 四·独立罢免(S1d-UI) ════════
ok(/_offDismissToEdict\(/.test(runtime) && /罢\s*免/.test(runtime), '罢免按钮接 _offDismissToEdict + 文案「罢免」');
vm.runInContext('if(typeof _renderEdictSuggestions!=="function")_renderEdictSuggestions=function(){};', sandbox);
sandbox.GM = { turn: 5, chars: [mkHuzhu('某官', '侍郎', 7, '明')], facs: [{ name: '明', isPlayer: true }], officeTree: [{ name: '某部', positions: [{ name: '侍郎', rank: '正三品', holder: '某官' }] }], _edictSuggestions: [], _capital: '京师' };
sandbox.P = { conf: {}, playerInfo: { factionName: '明' } };
const dHtml = vm.runInContext('String(_ogpRenderPosCard(GM.officeTree[0].positions[0], "某部", [0]) || "")', sandbox);
ok(/罢\s*免/.test(dHtml) && /_offDismissToEdict/.test(dHtml), '列表卡：本朝自家官 → 渲染罢免按钮');
vm.runInContext('_offDismissToEdict("某官","某部","侍郎")', sandbox);
ok(vm.runInContext('(GM._edictSuggestions||[]).length', sandbox) >= 1, '真码：_offDismissToEdict → 录入诏书建议库(免职·待下旨)');
ok(/免去|免职|某官/.test(vm.runInContext('JSON.stringify((GM._edictSuggestions||[]).slice(-1)[0]||{})', sandbox)), '真码：诏书建议含免职某官');
sandbox.GM.chars.push({ name: '敌官', officialTitle: '侍郎', faction: '后金', alive: true });
sandbox.GM.officeTree[0].positions[0].holder = '敌官';
const fHtml = vm.runInContext('String(_ogpRenderPosCard(GM.officeTree[0].positions[0], "某部", [0]) || "")', sandbox);
ok(!/罢\s*免/.test(fHtml), '列表卡：异党官 → 无罢免按钮(走弹劾问罪·不走罢免)');

console.log('\nsmoke-s5-menyin: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
