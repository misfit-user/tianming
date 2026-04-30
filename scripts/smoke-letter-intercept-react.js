// scripts/smoke-letter-intercept-react.js
// 验证截获事件的完整反应链：
//   反应链 1：_undeliveredLetters 注入（AI prompt 让 NPC 按"未收到"行事）
//   反应链 2：UI 状态条显示截获方
//   反应链 3：伪造回信路径（30% 概率）
//   反应链 4：起居注 + 编年史 + 风闻多渠道记账
//   反应链 5：被截 N 回合后 NPC 自动续问
//   反应链 6：玩家可重发（_ltResend secret_agent / multi_courier）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let ASSERTS = 0;

function assert(cond, msg) {
  ASSERTS++;
  if (!cond) throw new Error('[assert] ' + msg);
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, msg + ' expected=' + expected + ' actual=' + actual);
}

function assertOneOf(actual, expected, msg) {
  assert(expected.indexOf(actual) >= 0, msg + ' expected one of ' + expected.join(',') + ' actual=' + actual);
}

function assertIncludes(text, needle, msg) {
  assert(String(text || '').indexOf(needle) >= 0, msg + ' expected to include=' + needle + ' actual=' + text);
}

function fakeEl() {
  return {classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{},appendChild(c){return c},removeChild(c){return c},setAttribute(){},getAttribute(){return null},addEventListener(){},removeEventListener(){},querySelector(){return fakeEl()},querySelectorAll(){return[]},children:[],childNodes:[],innerHTML:'',textContent:'',value:'',dataset:{}};
}
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  document: { getElementById:()=>fakeEl(), querySelector:()=>fakeEl(), querySelectorAll:()=>[], addEventListener(){}, createElement:()=>fakeEl(), body:fakeEl(), readyState:'complete' },
  window: {}, localStorage: {getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  navigator: {userAgent:'node'}, performance: {now:()=>Date.now()},
  fetch:()=>Promise.reject(new Error('no fetch')),
  alert:()=>{}, confirm:()=>true, prompt:()=>null,
  HTMLElement:function(){}, Event:function(){}, requestAnimationFrame:cb=>setTimeout(cb,16)
};
sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
sandbox.addEventListener = ()=>{}; sandbox.removeEventListener = ()=>{};
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const re = /<script[^>]+src="([^"]+\.js)/g;
let m;
while ((m = re.exec(html))) {
  const fp = path.join(ROOT, m[1].split('?')[0]);
  if (!fs.existsSync(fp)) continue;
  try { vm.runInContext(fs.readFileSync(fp,'utf8'), sandbox, { filename: m[1] }); } catch(e) {}
}
try { vm.runInContext(fs.readFileSync(path.join(ROOT,'scenarios/tianqi7-1627.js'),'utf8'), sandbox); } catch(e) {}

setTimeout(() => {
  try {
    const sc = sandbox.P.scenarios.find(s=>s.id==='sc-tianqi7-1627');
    assert(sc, 'official runtime scenario must be registered');
    const sid = sc.id;
    const GM = sandbox.GM = {
      running:true, sid, turn:5, busy:false,
      vars:{}, rels:{}, evtLog:[], officeChanges:[], qijuHistory:[],
      _chronicle:[],
      facs:(sandbox.P.factions||[]).filter(f=>f.sid===sid).map(f=>Object.assign({},f)),
      chars:(sandbox.P.characters||[]).filter(c=>c.sid===sid).map(c=>Object.assign({},c)),
      letters:[], _pendingNpcLetters:[], _letterSuspects:[], _courierStatus:{},
      _routeDisruptions:[], _capital:'京师',
      _interceptedIntel:[], _undeliveredLetters:[],
      adminHierarchy: sc.adminHierarchy || sandbox.P.adminHierarchy,
      _edictTracker:[]
    };
    sandbox.P.conf = { gameMode: 'strict_hist' };

    // 把后金设为强敌·让 hostileFacs 包含
    const houjin = GM.facs.find(f=>f.name && f.name.indexOf('后金')>=0);
    assert(houjin, 'hostile Houjin faction must exist');
    if (houjin) {
      houjin.playerRelation = -100;
      if (!Array.isArray(houjin.territories)) houjin.territories = [];
      // 让"沈阳/盛京"在敌占区
      if (houjin.territories.indexOf('沈阳') < 0) houjin.territories.push('沈阳');
    }

    // 模拟一封玩家→孙承宗的 formal_edict 被截获
    const sun = GM.chars.find(c=>c.name==='孙承宗');
    assert(sun, 'intercept target Sun Chengzong must exist');
    const interceptedLetter = {
      id: 'lt_intercept_test',
      from: '玩家', to: sun.name,
      fromLocation: '京师', toLocation: sun.location,
      content: '令孙承宗为辽东经略·总督关宁·速整军备·防虏入寇',
      sentTurn: 5, deliveryTurn: 6, replyTurn: 7,
      reply: '', status: 'traveling',
      urgency: 'normal', letterType: 'formal_edict',
      _cipher: 'none'
    };
    GM.letters.push(interceptedLetter);

    console.log('========== 反应链 1-4：截获事件全方位记账 ==========');
    const hostileFacs = (GM.facs||[]).filter(f=>!f.isPlayer && (f.playerRelation||0)<-50);
    const qijuBefore = GM.qijuHistory.length;
    const chronBefore = GM._chronicle.length;
    const intelBefore = GM._interceptedIntel.length;
    const undelBefore = GM._undeliveredLetters.length;

    // 强制截获
    sandbox._ltDoIntercept(interceptedLetter, hostileFacs);
    assertOneOf(interceptedLetter.status, ['intercepted', 'intercepted_forging'], 'intercept should set an intercepted status');
    assert(interceptedLetter.interceptedBy, 'intercept should record interceptor');
    assertEq(interceptedLetter._interceptedTurn, GM.turn, 'intercept should record current turn');
    assert(GM._courierStatus[interceptedLetter.id], 'intercept should record courier status');
    assertEq(GM._undeliveredLetters.length - undelBefore, 1, 'intercept should add undelivered order');
    assertEq(GM._interceptedIntel.length - intelBefore, 1, 'intercept should add intercepted intel');
    assertEq(GM.qijuHistory.length - qijuBefore, 1, 'intercept should write qiju record');
    assertEq(GM._chronicle.length - chronBefore, 1, 'formal edict intercept should write chronicle record');

    console.log('  letter.status:', interceptedLetter.status);
    console.log('  letter.interceptedBy:', interceptedLetter.interceptedBy);
    console.log('  letter._interceptedTurn:', interceptedLetter._interceptedTurn);
    console.log('  letter._interceptedDay:', interceptedLetter._interceptedDay);
    console.log('  GM._courierStatus:', GM._courierStatus[interceptedLetter.id]);
    console.log('  _undeliveredLetters 增加:', GM._undeliveredLetters.length - undelBefore, '(应 1)');
    console.log('  _interceptedIntel 增加:', GM._interceptedIntel.length - intelBefore, '(应 1)');
    console.log('  qijuHistory 增加:', GM.qijuHistory.length - qijuBefore, '(应 1)');
    console.log('  qiju 头条:', GM.qijuHistory[0] && GM.qijuHistory[0].content);
    console.log('  _chronicle 增加:', GM._chronicle.length - chronBefore, '(应 1·因 formal_edict)');
    console.log('  chronicle 头条:', GM._chronicle[0] && (GM._chronicle[0].title + ' / ' + GM._chronicle[0].content));

    console.log('\n========== 反应链 5：N 天后 NPC 自动续问 ==========');
    var _dpvSC = sandbox._getDaysPerTurn();
    // 阈值缩短后：续问 15 天 / 自愈 60 天·窗口 [15,60]·跨剧本统一
    // 不论 dpv 多少·直接改 letter 日字段让 _waited=20 天·_arr 在 nowDay-30 处（不被自愈）
    var _nowD = (sandbox.getCurrentGameDay && sandbox.getCurrentGameDay()) || 0;
    interceptedLetter._interceptedDay = _nowD - 20; // 已截获 20 天 ≥ 15 ✓
    interceptedLetter._deliveryDay = _nowD - 30;    // 距 nowDay 30 天·< 60 自愈阈值 ✓
    console.log('  覆盖 _interceptedDay=' + interceptedLetter._interceptedDay + '·_deliveryDay=' + interceptedLetter._deliveryDay + '·dpv=' + _dpvSC + '·_waited=20 天');
    console.log('  letter pre-settle: status=' + interceptedLetter.status + ' _interceptedTurn=' + interceptedLetter._interceptedTurn + ' _npcInitiated=' + interceptedLetter._npcInitiated + ' _followupSent=' + interceptedLetter._followupSent + ' _interceptedDay=' + interceptedLetter._interceptedDay);
    console.log('  letters 总数:', GM.letters.length, '·nowDay:', _nowD);
    // 直接调 _settleLettersAndTravel·避免 SubTickRunner 中其他步骤干扰
    sandbox._settleLettersAndTravel();
    console.log('  settle 跑完无异常');
    const followup = GM._pendingNpcLetters.find(nl => nl._triggeredByIntercept);
    const inflighted = GM.letters.find(l => l._npcInitiated && l.from === sun.name);
    assert(followup, 'intercepted outbound order should create NPC follow-up');
    assertEq(interceptedLetter._followupSent, true, 'intercepted letter should be marked follow-up sent');
    assertEq(followup.from, sun.name, 'follow-up should come from original target');
    assertEq(followup.type, 'plea', 'follow-up should be a plea');
    console.log('  GM._pendingNpcLetters 续问条目:', followup ? '✓ 存在' : '✗ 缺失');
    console.log('  letter._followupSent:', interceptedLetter._followupSent);
    if (followup) {
      console.log('  续问内容(前60字):', followup.content.slice(0,60));
      console.log('  续问 type/urgency:', followup.type, '/', followup.urgency);
    }
    if (inflighted) console.log('  入队后 letters 中 NPC 续问信:', inflighted.from, 'status=' + inflighted.status);

    console.log('\n========== 反应链 6：玩家可重发 (_ltResend) ==========');
    GM.turn = 8;
    interceptedLetter._followupSent = false; // reset 不影响
    const beforeLetters = GM.letters.length;
    sandbox._ltResend(interceptedLetter.id, 'multi_courier');
    const afterLetters = GM.letters.length;
    console.log('  letters +' + (afterLetters - beforeLetters) + ' (应 1)');
    const resent = GM.letters.find(l => l._resentFrom === interceptedLetter.id);
    assertEq(afterLetters, beforeLetters + 1, 'resend should append one replacement letter');
    assert(resent, 'resend should create replacement letter');
    assertEq(resent._sendMode, 'multi_courier', 'resend should preserve selected mode');
    assertEq(resent.urgency, 'extreme', 'multi-courier resend should be extreme urgency');
    assertEq(resent.status, 'traveling', 'resent letter should enter traveling status');
    assertEq(interceptedLetter._resendIssued, true, 'original letter should be marked resend issued');
    if (resent) {
      console.log('  重发信 _sendMode:', resent._sendMode);
      console.log('  重发信 urgency:', resent.urgency);
      console.log('  重发信 _cipher:', resent._cipher);
      console.log('  重发信 status:', resent.status, 'deliveryTurn:', resent.deliveryTurn);
    }
    console.log('  原信 _resendIssued:', interceptedLetter._resendIssued);

    console.log('\n========== 反应链 6b：重发后再点重发应被拒绝（防双发） ==========');
    const cnt1 = GM.letters.length;
    sandbox._ltResend(interceptedLetter.id, 'secret_agent');
    console.log('  letters 数量是否未变:', GM.letters.length === cnt1, '(应 true)');
    assertEq(GM.letters.length, cnt1, 'second resend should be rejected');

    console.log('\n========== 反应链 7：续问完整生命周期 ==========');
    GM.letters = []; GM._pendingNpcLetters = [];
    var _dpv7 = sandbox._getDaysPerTurn();
    // 截获在 turn=1 (day 0)·阈值 30 天·跨 1 回合 = dpv 天·dpv>=30 即可触发
    GM.letters.push({
      id:'old_intercept', from:'玩家', to:sun.name,
      fromLocation:'京师', toLocation:sun.location,
      content:'测试旧截获信',
      sentTurn:1, deliveryTurn:2, _sentDay:0, _deliveryDay:_dpv7, status:'intercepted',
      _interceptedTurn:1, _interceptedDay:0, interceptedBy:'后金',
      letterType:'formal_edict'
    });
    GM.turn = 2;
    sandbox._settleLettersAndTravel();
    console.log('  T2 settle 后·pendingNpcLetters:', GM._pendingNpcLetters.length, '·letters:', GM.letters.length);
    assertEq(GM._pendingNpcLetters.length, 1, 'old intercepted letter should create one follow-up pending letter');
    // 把 pending NPC 信注入 letters（_processPendingNpcLetters 由 settle 内部完成）
    GM.turn = 3;
    sandbox._settleLettersAndTravel();
    let followup2 = GM.letters.find(l => l._npcInitiated && l.from === sun.name);
    console.log('  T3 settle 后·NPC 续问信入队 letters·status:', followup2 && followup2.status, '·deliveryTurn:', followup2 && followup2.deliveryTurn);
    assert(followup2, 'pending follow-up should be converted into a letter');
    assertEq(followup2.status, 'traveling', 'converted follow-up should start traveling');
    GM.turn = 5;
    sandbox._settleLettersAndTravel();
    followup2 = GM.letters.find(l => l._npcInitiated && l.from === sun.name);
    console.log('  T5 settle 后·续问信 status:', followup2 && followup2.status);
    assertEq(followup2.status, 'returned', 'follow-up letter should return by T5');

    console.log('\n========== 反应链 8：UI 状态文本 显示截获方 ==========');
    const txt1 = sandbox._ltGetStatusText({status:'intercepted', interceptedBy:'后金'});
    console.log('  intercepted 文本:', txt1, '(应含"后金")');
    assertIncludes(txt1, '后金', 'intercepted status text should show interceptor');
    const txt2 = sandbox._ltGetStatusText({status:'intercepted_forging', interceptedBy:'察哈尔'});
    console.log('  intercepted_forging 文本:', txt2, '(应含"察哈尔" + "存疑")');
    assertIncludes(txt2, '察哈尔', 'forged-reply status text should show interceptor');
    assertIncludes(txt2, '存疑', 'forged-reply status text should show suspicion');

    console.log('[smoke-letter-intercept-react] pass assertions=' + ASSERTS);
    process.exit(0);
  } catch (e) {
    console.error('SIM ERROR:', e.message, '\n', e.stack);
    process.exit(1);
  }
}, 250);
