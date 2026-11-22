// smoke-captive-court.js — 悬朝演绎层·北狩残局朝廷侧（批七·2026-07-21）
//
// owner 三拍板：①立新君交 AI(朝臣自行酝酿·玩家失控才是北狩之痛) ②玩家继续演太上皇
// ③夺门=复辟旨即谋划(诏令管线·AI 断成败)。本 smoke 不经真 AI：canned 决断直灌
// _applyCourtOutcome 验宪法闸——立新君三验(须真被虏/人选活人非俘非玩家/不重复立)·
// 太上皇称号迁转·夺门三闸(君已归+新君在位+归后下过诏令)·谋泄冷却·兜底轨(被虏6回合自立储君)。
// 11-22「破京之后」（同志「按你推荐来」甲）：归来后所下诏令全交 AI 判（不按「复辟」几个字筛）；
//   放还写口 release（主推演 captive_release：验在俘、执者、国库付得起赎银；解除、回朝廷、监国撤、一朝二主）；
//   执者那一家灭了放回（releaseOrphans，悬朝 tick 先跑）；主推演落账那段真代码原样抽出来跑。
// 11-22 收尾（同志「去完成剩下这部分」）：赎金银粮布三样、国库或内帑出（不够整笔不动）、入执者的库；
//   档里没记执者的按所在之地认执者（inferCaptor/fillCaptors）；君上回来「乘舆蒙尘」时政了结；
//   执者那家的决策材料里有本方所执之人（tm-political-actions.js heldCaptives），可走通用外交索赎、议放；
//   主推演【被俘之人】照录执者与朝廷为此人往来的文书（tm-endturn-prompt.js，原样抽出来跑）。
// 赎金的国库、内帑写口用替身（真身 tm-fiscal-engine.js trySpendFromGuoku：全额扣成或一文不扣；spendFromNeitang：有多少扣多少，
//   所以放还写口先核内帑存数）；认地块归属用替身（真身 tm-faction-membership.js regionInfo）。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

function freshSandbox() {
  var sb = { console: console };
  sb.window = sb; sb.global = sb;
  sb._ebs = [];
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb.GM = {
    turn: 30,
    eraName: '社稷非常',
    huangwei: { index: 40 },
    chars: [
      { name: '朱祁镇', isPlayer: true, alive: true, officialTitle: '大明皇帝', family: '朱', childrenIds: ['朱见深'] },
      { name: '朱见深', alive: true, family: '朱', officialTitle: '皇太子' },
      { name: '朱祁钰', alive: true, family: '朱', officialTitle: '亲王' },
      { name: '于谦', alive: true, faction: '朝廷', officialTitle: '兵部尚书', loyalty: 90 }
    ],
    _edictTracker: [],
    _chronicle: []
  };
  sb.P = { conf: { revoltEntityEnabled: true } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-captive-court.js'), 'utf8'), sb, { filename: 'tm-captive-court.js' });
  return sb;
}

console.log('① 立新君宪法三验');
var sb = freshSandbox();
var CC = sb.TM.CaptiveCourt;
var GM = sb.GM;
var player = GM.chars[0];
var r0 = CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱祁钰' });
assert(r0.ok === false, '君上未被虏 → 不得另立(闸)');
player._captured = true; player._capturedBy = '瓦剌'; player._capturedLocation = '瓦剌军中';
assert(CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '不存在的人' }).ok === false, '人选不在档 → 拦');
assert(CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱祁镇' }).ok === false, '不得立被虏的玩家自己');
var r1 = CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱祁钰', narrative: '主战派定策·奉亲王践祚' });
assert(r1.ok === true && GM._rivalEmperor && GM._rivalEmperor.name === '朱祁钰', '立新君落账 _rivalEmperor');
assert(GM.chars[2]._enthroned === true, '新君 _enthroned 竖旗');
assert(player.officialTitle === '太上皇' && player._preCaptureTitle === '大明皇帝', '拍板②：玩家尊为太上皇·原号留档');
assert(CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱见深' }).ok === false, '已立新君 → 不重复立');
assert(sb._ebs.some(function (e) { return e.indexOf('一朝二主') >= 0; }), '立新君落起居注');
assert(GM._chronicle.some(function (c) { return c.text.indexOf('主战派定策') >= 0; }), 'AI 叙事入史');

console.log('② 夺门三闸：君在虏营拦·无复辟旨拦·齐备则复位');
assert(CC._applyCourtOutcome(GM, { type: 'restoration' }).ok === false, '君犹被虏 → 夺门无从谈起');
player._captured = false; delete player._capturedBy; delete player._capturedLocation;  // 赎驾归銮
assert(CC._applyCourtOutcome(GM, { type: 'restoration' }).ok === false, '无复辟旨 → 未见其谋(须玩家真下旨)');
GM._edictTracker.push({ turn: 31, category: '密', content: '密结旧臣·图谋复辟正位' });
GM.turn = 32;
var r2 = CC._applyCourtOutcome(GM, { type: 'restoration', demotedTitle: '郕王' });
assert(r2.ok === true && !GM._rivalEmperor, '夺门成 → 新君清位');
assert(GM.chars[2]._enthroned === false && GM.chars[2]._dethroned === true && GM.chars[2].officialTitle === '郕王', '逊位降号(AI 定号)');
assert(player.officialTitle === '大明皇帝' && player._preCaptureTitle === undefined, '太上皇复位·原号复还');
assert(sb._ebs.some(function (e) { return e.indexOf('夺门之变成') >= 0; }), '复辟落起居注');

console.log('③ 谋泄冷却');
var sb3 = freshSandbox();
var GM3 = sb3.GM, CC3 = sb3.TM.CaptiveCourt;
GM3.chars[0]._captured = true;
CC3._applyCourtOutcome(GM3, { type: 'proclaim_new', name: '朱祁钰' });
GM3.chars[0]._captured = false;
GM3._edictTracker.push({ turn: 31, content: '谋夺门复位' });
GM3.turn = 32;
assert(CC3._applyCourtOutcome(GM3, { type: 'crackdown' }).ok === true, '谋泄落账');
assert(CC3._applyCourtOutcome(GM3, { type: 'restoration' }).ok === false, '冷却内 → 夺门拦(党羽星散须蛰伏)');
GM3.turn = 32 + CC3.CRACKDOWN_COOLDOWN;
assert(CC3._applyCourtOutcome(GM3, { type: 'restoration' }).ok === true, '冷却满 → 可再谋(蛰伏待时)');

console.log('④ 监国');
var sb4 = freshSandbox();
sb4.GM.chars[0]._captured = true;
assert(sb4.TM.CaptiveCourt._applyCourtOutcome(sb4.GM, { type: 'regent', name: '于谦' }).ok === true && sb4.GM._regent.name === '于谦', '立监国落账');
assert(sb4.TM.CaptiveCourt._applyCourtOutcome(sb4.GM, { type: 'regent', name: '朱祁钰' }).ok === false, '已有监国 → 不重复');

console.log('⑤ 兜底轨(双轨)：无 AI·被虏满 6 回合朝廷自立储君');
var sb5 = freshSandbox();
var GM5 = sb5.GM, CC5 = sb5.TM.CaptiveCourt;
GM5.chars[0]._captured = true;
GM5.turn = 40;
CC5.tick(GM5);
assert(!GM5._rivalEmperor && GM5.chars[0]._capturedSince === 40, '首 tick 记被虏起点·不立即立');
GM5.turn = 43; CC5.tick(GM5);
assert(!GM5._rivalEmperor, '未满 6 回合 → 观望');
GM5.turn = 46; CC5.tick(GM5);
assert(GM5._rivalEmperor && GM5._rivalEmperor.name === '朱见深', '满 6 回合 → 自立储君(childrenIds 候选优先)');
assert(GM5.chars[0].officialTitle === '太上皇', '兜底轨同走宪法落账(太上皇)');

console.log('⑥ flag OFF / 常态朝局零行为');
var sb6 = freshSandbox();
sb6.P.conf.revoltEntityEnabled = false;
sb6.GM.chars[0]._captured = true;
sb6.GM.turn = 99; sb6.TM.CaptiveCourt.tick(sb6.GM);
assert(!sb6.GM._rivalEmperor && sb6.GM.chars[0]._capturedSince === 99, '旧关闭值不阻断悬朝链，仍先记录被俘反应窗');
var sb7 = freshSandbox();
sb7.TM.CaptiveCourt.tick(sb7.GM);
assert(!sb7.GM._courtInferTurn && !sb7.GM._rivalEmperor, '君安在位 → 本层不插手');

console.log('⑦ 太上皇归来后所下诏令全交 AI 判（不按「复辟」几个字筛，11-22）');
var sb8 = freshSandbox();
var p8 = sb8.GM.chars[0];
sb8.GM._edictTracker.push({ turn: 5, content: '蒙尘前旧诏·整饬边备' });
p8._releasedTurn = 10;
sb8.GM._edictTracker.push({ turn: 11, content: '召石亨、徐有贞入南宫议事' }, { turn: 12, content: '着人暗通南宫·候机反正' });
var re8 = sb8.TM.CaptiveCourt._recentEdicts(sb8.GM, p8);
assert(re8.length === 2 && re8[0].indexOf('石亨') >= 0 && re8.join('').indexOf('整饬边备') < 0, '归来后两道都算（字面没有「复辟」的也算），蒙尘前的不算');

// ── 放还写口 ──
function releaseSandbox() {
  var s = freshSandbox();
  s.__spent = [];
  s.GM.guoku = { money: 50000 };
  s.FiscalEngine = { trySpendFromGuoku: function (spec) {
    var need = spec.amounts.money;
    if (s.GM.guoku.money < need) return { ok: false, code: 'insufficient-guoku-money', required: need, available: s.GM.guoku.money };
    s.GM.guoku.money -= need; s.__spent.push(spec.sinkTag + ':' + need);
    return { ok: true, deducted: { money: need } };
  } };
  s.GM._capital = '北京';
  var pl = s.GM.chars[0];
  pl._captured = true; pl._capturedBy = '瓦剌'; pl._capturedLocation = '瓦剌军中'; pl._capturedTurn = 20;
  return s;
}

console.log('⑧ 放还写口：验在俘、执者、赎银；回来了解除被俘、回京城、监国撤');
var s9 = releaseSandbox(), CC9 = s9.TM.CaptiveCourt, G9 = s9.GM, p9 = G9.chars[0];
assert(CC9.release(G9, { name: '于谦', how: 'release' }).ok === false, '没被俘的人：拦');
assert(CC9.release(G9, { name: '朱祁镇', how: '飞走' }).ok === false, '怎么回来不明：拦');
assert(/执者对不上/.test(CC9.release(G9, { name: '朱祁镇', how: 'release', by: '鞑靼' }).why), '执者对不上：拦');
var r9 = CC9.release(G9, { name: '朱祁镇', how: 'ransom', by: '瓦剌', ransom: 80000 });
assert(r9.ok === false && /国库付不起/.test(r9.why) && p9._captured === true && G9.guoku.money === 50000, '国库付不起赎银：不放、一文不扣');
G9._regent = { name: '于谦', sinceTurn: 21 }; G9.chars[3]._regent = true;
G9._playerCaptive = { name: '朱祁镇', by: '瓦剌', turn: 20 };
G9.currentIssues = [{ id: 'iss_captive_20', title: '乘舆蒙尘 · 天子蒙难', status: 'pending', _captive: true }, { id: 'iss_flood', title: '河决', status: 'pending' }];
G9.turn = 25;
var r9b = CC9.release(G9, { name: '朱祁镇', how: 'ransom', by: '瓦剌军', ransom: 30000, narrative: '遣使携金帛往瓦剌营迎驾' });
assert(r9b.ok === true && G9.guoku.money === 20000 && s9.__spent[0] === '赎还·朱祁镇:30000', '赎还：赎银从国库出（执者写「瓦剌军」也认）');
assert(!p9._captured && !p9._capturedBy && p9._releasedTurn === 25 && p9.location === '北京', '解除被俘、回京城');
var h9 = p9._captivityHistory && p9._captivityHistory[0];
assert(h9 && h9.by === '瓦剌' && h9.fromTurn === 20 && h9.toTurn === 25 && h9.how === 'ransom' && h9.ransom.money === 30000 && h9.ransom.cloth === 0
  && h9.ransomFrom === 'guoku' && h9.ransomTo === '', '经过记一笔（赎金写一个数即银两；执者不在势力表里，赎金不入谁的库）');
assert(G9._regent === null && !G9.chars[3]._regent && G9._playerCaptive === null, '君上回来：监国撤、御驾被俘的信号撤');
assert(G9.currentIssues[0].status === 'resolved' && G9.currentIssues[0].resolvedTurn === 25 && G9.currentIssues[1].status === 'pending',
  '「乘舆蒙尘」时政了结，别的时政不动');
assert(s9._ebs.some(function (e) { return e.indexOf('国变·★乘舆还朝！朝廷以银 30000 两自「瓦剌」处赎还朱祁镇·归于北京·监国撤，君上复亲政') === 0; }), '事件写明怎么回来、回到哪');
assert(G9._chronicle.some(function (c) { return c.text.indexOf('迎驾') >= 0; }), '推演写的经过入史');

console.log('⑨ 新君在位时君上回来：一朝二主，夺门从此走得到');
var s10 = releaseSandbox(), CC10 = s10.TM.CaptiveCourt, G10 = s10.GM, p10 = G10.chars[0];
CC10._applyCourtOutcome(G10, { type: 'proclaim_new', name: '朱祁钰' });
G10._capitalFallen = true; G10.chars[2].location = '南京';
G10.turn = 40;
assert(CC10.release(G10, { name: '朱祁镇', how: 'release', by: '瓦剌' }).ok === true && p10.location === '南京', '京城陷着：回新君所在（南京）');
assert(s10._ebs.some(function (e) { return e.indexOf('一朝二主之局自此始') >= 0; }), '事件写一朝二主');
assert(CC10._applyCourtOutcome(G10, { type: 'restoration' }).ok === false, '归来后还没下诏：夺门拦');
G10._edictTracker.push({ turn: 41, content: '密召旧臣入南宫' });
G10.turn = 42;
assert(CC10._applyCourtOutcome(G10, { type: 'restoration', demotedTitle: '郕王' }).ok === true && p10.officialTitle === '大明皇帝', '归来后下过诏（字面没有「复辟」）：闸放行，成否交 AI 判');

console.log('⑩ 执者那一家灭了：它手里的人放回；执者没记或只是一句话的不动；开局北狩的由推演放还');
var s11 = releaseSandbox(), CC11 = s11.TM.CaptiveCourt, G11 = s11.GM, p11 = G11.chars[0];
G11.facs = [{ name: '大明', isPlayer: true }, { name: '瓦剌' }];
G11.chars.push({ name: '赵佶', alive: true, presenceState: '北狩', _captured: true, _capturedLocation: '北狩·金国' });
G11.chars.push({ name: '杨洪', alive: true, _captured: true, _capturedBy: '敌军' });
CC11.releaseOrphans(G11);
assert(p11._captured === true && p11._captorSeen === true, '瓦剌还在：不放，记下见过这个执者');
G11.facs = G11.facs.filter(function (f) { return f.name !== '瓦剌'; });
G11.turn = 50;
var out11 = CC11.releaseOrphans(G11);
assert(out11.length === 1 && out11[0] === '朱祁镇' && !p11._captured && p11._captivityHistory[0].how === 'captorGone', '瓦剌除档：君上得脱');
assert(G11.chars[4]._captured === true && G11.chars[5]._captured === true, '没记执者的（开局北狩）、执者只是一句「敌军」的：不动，交推演判');
assert(s11._ebs.some(function (e) { return e.indexOf('「瓦剌」既亡，朱祁镇得脱归来') >= 0; }), '事件写执者既亡');
var r11 = CC11.release(G11, { name: '赵佶', how: 'release', by: '金', to: '临安' });
assert(r11.ok === true && G11.chars[4].presenceState === 'present' && G11.chars[4].location === '临安' && G11.chars[4]._captivityHistory[0].by === '金'
  && s11._ebs.some(function (e) { return e.indexOf('人事·「金」放还赵佶·归于临安') === 0; }),
  '开局北狩的由推演放还：档里没记执者用推演说的，在场状态改回、到推演说的去处');
var s12 = releaseSandbox(), G12 = s12.GM;
G12.facs = [{ name: '瓦剌' }];
s12.TM.CaptiveCourt.tick(G12);
G12.facs[0]._dissolvedTurn = 30;
s12.TM.CaptiveCourt.tick(G12);
assert(!G12.chars[0]._captured, '推演 faction_dissolve 记了亡：每回合悬朝 tick 先放回');

console.log('⑪ 赎金：银粮布三样，国库或内帑出（不够整笔不动），入执者的库（11-22 收尾）');
// 国库替身照真身全额扣成或一文不扣；内帑替身照真身有多少扣多少（所以放还写口要先核存数）
function ransomSandbox(guoku, neitang) {
  var s = releaseSandbox();
  s.GM.guoku = guoku;
  s.GM.neitang = neitang;
  s.GM.facs = [{ name: '大明', isPlayer: true }, { name: '瓦剌', treasury: { money: 100 } }];
  s.FiscalEngine = {
    trySpendFromGuoku: function (spec) {
      var a = spec.amounts, g = s.GM.guoku, ks = ['money', 'grain', 'cloth'];
      for (var i = 0; i < ks.length; i++) {
        if ((a[ks[i]] || 0) > (g[ks[i]] || 0)) return { ok: false, code: 'insufficient-guoku-' + ks[i], resource: ks[i], required: a[ks[i]], available: g[ks[i]] || 0 };
      }
      ks.forEach(function (k) { g[k] = (g[k] || 0) - (a[k] || 0); });
      s.__spent.push('国库:' + spec.sinkTag);
      return { ok: true };
    },
    spendFromNeitang: function (a, tag) {
      ['money', 'grain', 'cloth'].forEach(function (k) { s.GM.neitang[k] = (s.GM.neitang[k] || 0) - (a[k] || 0); });
      s.__spent.push('内帑:' + tag);
      return { ok: true };
    }
  };
  return s;
}
var s13 = ransomSandbox({ money: 50000, grain: 1000, cloth: 0 }, { money: 30000, grain: 0, cloth: 8000 }), G13 = s13.GM, CC13 = s13.TM.CaptiveCourt, p13 = G13.chars[0];
var r13a = CC13.release(G13, { name: '朱祁镇', how: 'ransom', by: '瓦剌', ransom: { money: 20000, cloth: 5000 } });
assert(r13a.ok === false && /国库付不起赎金/.test(r13a.why) && /库存布 0 匹/.test(r13a.why) && p13._captured === true && G13.guoku.money === 50000 && !s13.__spent.length,
  '国库布不够：整笔不动、不放（实得 ' + r13a.why + '）');
G13.turn = 33;
var r13b = CC13.release(G13, { name: '朱祁镇', how: 'ransom', by: '瓦剌', ransom: { money: 20000, cloth: 5000 }, from: 'neitang' });
assert(r13b.ok === true && G13.neitang.money === 10000 && G13.neitang.cloth === 3000 && G13.guoku.money === 50000 && s13.__spent[0] === '内帑:赎还·朱祁镇',
  '内帑出赎金：银布都从内帑扣，国库不动');
assert(G13.facs[1].treasury.money === 20100 && G13.facs[1].treasury.cloth === 5000, '赎金入执者「瓦剌」的库（两头对得上账）');
var h13 = p13._captivityHistory[0];
assert(h13.ransom.money === 20000 && h13.ransom.cloth === 5000 && h13.ransomFrom === 'neitang' && h13.ransomTo === '瓦剌', '经过记下赎金几样、从哪出、交给谁');
assert(s13._ebs.some(function (e) { return e.indexOf('国变·★乘舆还朝！朝廷出内帑银 20000 两、布 5000 匹自「瓦剌」处赎还朱祁镇') === 0; }), '事件写明赎金几样、出内帑');
var s14b = ransomSandbox({ money: 0 }, { money: 1000, grain: 0, cloth: 0 }), G14b = s14b.GM;
var r14b = s14b.TM.CaptiveCourt.release(G14b, { name: '朱祁镇', how: 'ransom', by: '瓦剌', ransom: 20000, from: 'neitang' });
assert(r14b.ok === false && /内帑付不起赎金/.test(r14b.why) && /内帑银只有 1000 两/.test(r14b.why) && G14b.neitang.money === 1000 && !s14b.__spent.length && G14b.chars[0]._captured === true,
  '内帑不够：先核存数，一文不扣、不放（实得 ' + r14b.why + '）');
var s14c = ransomSandbox({ money: 50000, grain: 0, cloth: 0 }, { money: 0 }), G14c = s14c.GM;
G14c.facs[1]._dissolvedTurn = 31;
assert(s14c.TM.CaptiveCourt.release(G14c, { name: '朱祁镇', how: 'ransom', by: '瓦剌', ransom: 30000 }).ok === true && G14c.guoku.money === 20000
  && G14c.facs[1].treasury.money === 100 && G14c.chars[0]._captivityHistory[0].ransomTo === '', '执者那家已亡：赎金照付，不入它的库');
var s14d = ransomSandbox({ money: 50000, grain: 0, cloth: 0 }, { money: 0 }), G14d = s14d.GM;
G14d.facs[1].id = 'fac_wala';
G14d.chars[0]._capturedBy = 'fac_wala';   // 御驾亲征被俘记的是得胜那家，可能是编号
var r14d = s14d.TM.CaptiveCourt.release(G14d, { name: '朱祁镇', how: 'ransom', by: '瓦剌', ransom: 10000 });
assert(r14d.ok === true && G14d.facs[1].treasury.money === 10100 && G14d.chars[0]._captivityHistory[0].by === '瓦剌'
  && s14d._ebs.some(function (e) { return e.indexOf('朝廷以银 10000 两自「瓦剌」处赎还朱祁镇') >= 0; }),
  '执者记的是编号：推演写名号也认，事件、经过按名号写，赎金入它的库（实得 ' + JSON.stringify(r14d.why || '') + '）');

console.log('⑫ 档里没记执者的，按所在之地认执者；认出后执者灭了照样放回（11-22 收尾）');
var s15 = releaseSandbox(), G15 = s15.GM, CC15 = s15.TM.CaptiveCourt;
s15.TM.FactionMembership = { regionInfo: function (ref) {
  if (ref === '燕京') return { id: 'ssr-0324', name: '燕京', owner: '大金' };
  if (ref === '临安') return { id: 'ssr-0900', name: '临安', owner: '大宋' };
  if (ref === '两可之地') throw new Error('引用不唯一');
  return null;
} };
G15.facs = [{ name: '大宋', isPlayer: true }, { name: '大金' }, { name: '西夏' }];
G15.chars = [
  { name: '赵构', isPlayer: true, alive: true, faction: '大宋' },
  { name: '赵桓', alive: true, faction: '大宋', presenceState: '北狩', _captured: true, _capturedLocation: '金国·燕京（北狩中）' },
  { name: '韦氏', alive: true, faction: '大宋', _captured: true, _capturedLocation: '金国·上京（北狩中）' },
  { name: '某甲', alive: true, faction: '大宋', _captured: true, _capturedLocation: '临安·西湖' },
  { name: '某乙', alive: true, faction: '大宋', _captured: true, _capturedLocation: '两可之地' },
  { name: '某丙', alive: true, faction: '大宋', _captured: true, _capturedBy: '伪齐', _capturedLocation: '燕京' }
];
assert(CC15.inferCaptor(G15, G15.chars[1]) === '大金', '「金国·燕京」：燕京这块地归大金');
assert(CC15.inferCaptor(G15, G15.chars[2]) === '大金', '「金国·上京」：上京不在图上，国号「金国」与「大金」相合');
assert(CC15.inferCaptor(G15, G15.chars[3]) === '', '所在之地归本朝：不猜');
assert(CC15.inferCaptor(G15, G15.chars[4]) === '', '地名两可、认不出：不猜');
G15.facs.push({ name: '金国' });
assert(CC15.inferCaptor(G15, G15.chars[2]) === '', '国号同时合上两家（大金、金国）：不猜');
G15.facs.pop();
var filled15 = CC15.fillCaptors(G15);
assert(filled15.join('、') === '赵桓、韦氏' && G15.chars[1]._capturedBy === '大金' && G15.chars[1]._captorInferred === true && G15.chars[5]._capturedBy === '伪齐',
  '补记执者：认得出的两人记上，已记了执者的不动（实得 ' + filled15.join('、') + '）');
G15.chars.push({ name: '邢秉懿', alive: true, faction: '大宋', _captured: true, _capturedLocation: '金国·燕京（北狩中）' });   // 旧档里开局时没补记上的
CC15.tick(G15);
assert(G15.chars[1]._captured === true && G15.chars[1]._captorSeen === true, '大金还在：不放，记下见过');
assert(G15.chars[6]._capturedBy === '大金' && G15.chars[6]._captorSeen === true, '旧档开局时没补上的：每回合悬朝 tick 先补记');
G15.facs = G15.facs.filter(function (f) { return f.name !== '大金'; });
G15.turn = 40;
CC15.tick(G15);
assert(!G15.chars[1]._captured && !G15.chars[2]._captured && !G15.chars[6]._captured && G15.chars[1]._captivityHistory[0].by === '大金' && G15.chars[1]._captivityHistory[0].how === 'captorGone'
  && !('_captorInferred' in G15.chars[1]) && G15.chars[1].presenceState === 'present', '认出的执者灭了：赵桓、韦氏得脱，在场状态改回');

console.log('⑬ 主推演落账那段真代码（tm-endturn-apply.js 原样抽出）：落成的解除，落不成的记写回落空');
// 从整份文件里抽出两个标记之间那段真代码（标记找不到就算败，抽出空段）
function between(whole, from, to) {
  var a = whole.indexOf(from), b = whole.indexOf(to, a + 1);
  assert(a >= 0 && b > a, '抽得出那段：' + from + ' … ' + to);
  return a >= 0 && b > a ? whole.slice(a, b) : '';
}
var applyBlock = between(fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8'), '// ── 被俘之人放还', '// ── 新群体形成');
var s14 = releaseSandbox(), fails14 = [];
s14._tmRecordSemanticFailure = function (kind, ref, why) { fails14.push(kind + '|' + ref + '|' + why); return false; };
vm.runInContext('this.__run = function (p1) {\n' + applyBlock + '\n};', s14);
s14.__run({ captive_release: [{ name: '朱祁镇', how: 'escape', by: '瓦剌' }, { name: '于谦', how: 'release' }, null] });
assert(!s14.GM.chars[0]._captured && s14.GM.chars[0]._captivityHistory[0].how === 'escape', '逃归落成');
assert(fails14.length === 1 && fails14[0].indexOf('captive_release|于谦|此人并未被俘') === 0, '没被俘的记写回落空、写明为什么（实得 ' + JSON.stringify(fails14) + '）');

console.log('⑭ 主推演【被俘之人】那段真代码（tm-endturn-prompt.js 原样抽出）：执者与朝廷为此人往来的文书照录（11-22 收尾）');
var promptBlock = between(fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8'), '// 被俘之人（11-22 放还写口）', '// 季节/时令');
function promptOf(GMx) {
  var sbp = { GM: GMx, P: { playerInfo: {} }, TM: { FactionDiplomacy: { TYPE_CN: { deal: '交易', peace: '媾和', ultimatum: '最后通牒' } } } };
  vm.createContext(sbp);
  vm.runInContext('var tp = "";\n' + promptBlock + '\nthis.__tp = tp;', sbp);
  return sbp.__tp;
}
var deal = { schemaVersion: 2, id: 'dp:1', from: '瓦剌', to: '大明', type: 'deal', status: 'pending', terms: '以银十万两、布二万匹赎还朱祁镇' };
var oldPeace = { schemaVersion: 2, id: 'dp:2', from: '大明', to: '瓦剌', type: 'peace', status: 'accepted', effectiveTurn: 31, terms: '罢兵，瓦剌送还朱祁镇，大明岁赐银五万',
  obligations: [{ kind: 'public_transfer', status: 'fulfilled' }] };
var refused = { schemaVersion: 2, id: 'dp:3', from: '瓦剌', to: '大明', type: 'ultimatum', status: 'rejected', terms: '割大同以赎朱祁镇' };
var other = { schemaVersion: 2, id: 'dp:4', from: '鞑靼', to: '大明', type: 'deal', status: 'pending', terms: '互市，并送还朱祁镇' };
var unrelated = { schemaVersion: 2, id: 'dp:5', from: '瓦剌', to: '大明', type: 'deal', status: 'pending', terms: '开马市于宣府' };
var dealAgain = Object.assign({}, deal, { id: 'dp:6' });   // 同一家同一份条款又递了一回
var G16 = { turn: 33, facs: [{ name: '大明', isPlayer: true, _incomingProposals: [deal, refused, other, unrelated, dealAgain] }, { name: '瓦剌', _incomingProposals: [oldPeace] }],
  chars: [{ name: '朱祁镇', isPlayer: true, faction: '大明', alive: true, _captured: true, _capturedBy: '瓦剌', _capturedLocation: '瓦剌军中', _capturedTurn: 30 }] };
var tp16 = promptOf(G16);
assert(/【被俘之人】朱祁镇（执者瓦剌·陷于瓦剌军中·已3回合）/.test(tp16) && /写 captive_release/.test(tp16), '照旧列人与写法');
assert(tp16.indexOf('「瓦剌」来议（交易·待答复）：以银十万两、布二万匹赎还朱祁镇') >= 0, '执者来议索赎：照录');
assert(tp16.split('「瓦剌」来议（交易·待答复）').length === 2, '同一份条款递了两回：只列一行');
assert(tp16.indexOf('朝廷去议「瓦剌」（媾和·已生效·第31回合起·约定的赎金已交付）：罢兵，瓦剌送还朱祁镇') >= 0, '朝廷去议、已生效、约定的赎金已交付：照录');
assert(tp16.indexOf('割大同') < 0 && tp16.indexOf('鞑靼') < 0 && tp16.indexOf('马市') < 0, '见拒的、别家的、不提此人的不列');
assert(/约定已生效的，执者照不照约放人、朝廷照不照约付赎由你按局势判/.test(tp16), '约定生效后放不放仍交推演判');
G16.facs[1].id = 'fac_wala';
G16.chars[0]._capturedBy = 'fac_wala';
var tp16c = promptOf(G16);
assert(/【被俘之人】朱祁镇（执者瓦剌·/.test(tp16c) && tp16c.indexOf('「瓦剌」来议（交易·待答复）') >= 0 && tp16c.indexOf('fac_wala') < 0, '执者记的是编号：按名号写、按名号比对文书');
G16.facs[0]._incomingProposals = []; G16.facs[1]._incomingProposals = [];
var tp16b = promptOf(G16);
assert(tp16b.indexOf('往来的文书') < 0 && /【被俘之人】朱祁镇/.test(tp16b), '没有往来文书：不多出这一段');
G16.chars[0]._captured = false;
assert(promptOf(G16) === '', '没人在俘：整段不写');

console.log('⑮ 执者那家的决策材料：本方所执之人（tm-political-actions.js heldCaptives 原样抽出）');
var heldBlock = between(fs.readFileSync(path.join(ROOT, 'tm-political-actions.js'), 'utf8'), 'function heldCaptives(fac, g) {', '  function view(fac,context){');
var sbh = {};
vm.createContext(sbh);
vm.runInContext('function A(x){return Array.isArray(x)?x:[];}\nfunction S(x){return x==null?"":String(x);}\n' + heldBlock + '\nthis.heldCaptives = heldCaptives;', sbh);
var G17 = { turn: 40, chars: [
  { id: 'c1', name: '朱祁镇', isPlayer: true, faction: '大明', officialTitle: '太上皇', alive: true, _captured: true, _capturedBy: '瓦剌', _capturedTurn: 30, _capturedLocation: '瓦剌军中' },
  { id: 'c2', name: '杨善', faction: '大明', alive: true, _captured: true, _capturedBy: 'fac_wala', _capturedTurn: 38 },
  { id: 'c3', name: '赵佶', faction: '大宋', alive: true, _captured: true, _capturedBy: '大金' },
  { id: 'c4', name: '死者', faction: '大明', alive: false, _captured: true, _capturedBy: '瓦剌' },
  { id: 'c5', name: '已回', faction: '大明', alive: true, _capturedBy: '瓦剌' }
] };
var held17 = sbh.heldCaptives({ id: 'fac_wala', name: '瓦剌' }, G17);
assert(held17.length === 2 && held17[0].name === '朱祁镇' && held17[0].rulerOfOrganization === true && held17[0].heldTurns === 10 && held17[0].title === '太上皇'
  && held17[0].place === '瓦剌军中' && held17[1].name === '杨善', '执者记本方名号或编号的才算，死了的、已回来的不算（实得 ' + JSON.stringify(held17.map(function (h) { return h.name; })) + '）');
assert(sbh.heldCaptives({ id: 'fac_jin', name: '金' }, G17).length === 0 && sbh.heldCaptives({ id: 'fac_houjin', name: '后金' }, G17).length === 0,
  '不按字面包含认：「金」「后金」都不算「大金」所执');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-captive-court: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-captive-court (立新君三验/太上皇迁转/夺门三闸/谋泄冷却/监国/兜底轨/flag门/常态零行为/诏令全交AI判/放还写口/执者亡放回/赎金三样内帑入执者库/按地认执者/时政了结/落账真代码/提示词照录往来文书/执者知所执之人)');
