// scripts/smoke-letter-full.js
// 全链路复现：startGame 路径 + 加载存档路径 + sendLetter() + edict 自动信 + 完整 SubTickRunner 推进
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

function fakeEl() {
  const el = {
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    style: {},
    children: [], childNodes: [],
    innerHTML: '', textContent: '', value: '',
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ return c; },
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return fakeEl(); },
    querySelectorAll(){ return []; },
    getBoundingClientRect(){ return {top:0,left:0,bottom:0,right:0,width:0,height:0}; },
    focus(){}, blur(){}, click(){}, scrollIntoView(){},
    insertBefore(c){ return c; },
    cloneNode(){ return fakeEl(); },
    contains(){ return false; },
    parentNode: null, parentElement: null, firstChild: null, lastChild: null,
    nextSibling: null, previousSibling: null,
    dataset: {},
    offsetWidth:0, offsetHeight:0, clientWidth:0, clientHeight:0,
    scrollTop:0, scrollLeft:0, scrollWidth:0, scrollHeight:0
  };
  return el;
}
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  document: {
    getElementById: () => fakeEl(),
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    createElement: () => fakeEl(),
    createTextNode: () => fakeEl(),
    body: fakeEl(),
    documentElement: fakeEl(),
    head: fakeEl(),
    readyState: 'complete'
  },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  navigator: { userAgent: 'node' },
  performance: { now: () => Date.now() },
  fetch: () => Promise.reject(new Error('no fetch')),
  alert: () => {}, confirm: () => true, prompt: () => null,
  HTMLElement: function(){}, Event: function(){}, CustomEvent: function(){},
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: () => {},
  indexedDB: undefined,
  location: { href: '', hash: '', search: '', pathname: '/' },
  history: { pushState(){}, replaceState(){}, back(){}, forward(){} },
  getComputedStyle: () => ({ getPropertyValue(){ return ''; } }),
  matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){} })
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.dispatchEvent = () => true;

vm.createContext(sandbox);

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptRe = /<script[^>]+src="([^"]+\.js)[^"]*"/g;
const scripts = [];
let m;
while ((m = scriptRe.exec(indexHtml)) !== null) scripts.push(m[1].split('?')[0]);

let loaded = 0, failed = 0;
for (const s of scripts) {
  const fp = path.join(ROOT, s);
  if (!fs.existsSync(fp)) continue;
  try { vm.runInContext(fs.readFileSync(fp, 'utf8'), sandbox, { filename: s }); loaded++; }
  catch (e) { failed++; if (failed < 5) console.warn('[load fail]', s, e.message.slice(0, 120)); }
}
console.log(`[smoke] loaded ${loaded}/${scripts.length} (${failed} failed)`);

try {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'scenarios/tianqi7-1627.js'), 'utf8'), sandbox);
} catch (e) { console.error('scenario load fail:', e.message); }

setTimeout(() => {
  try {
    const sc = sandbox.P.scenarios.find(s => s.id === 'sc-tianqi7-1627');
    if (!sc) { console.error('scenario not registered'); process.exit(1); }

    // ============ Path A: 模拟"加载存档"——不调 startGame ============
    console.log('\n========== Path A: 加载存档路径（不调 startGame） ==========');
    const GM = sandbox.GM = {
      running: true, sid: 'sc-tianqi7-1627', turn: 1, busy: false,
      vars: {}, rels: {}, evtLog: [], officeChanges: [], qijuHistory: [],
      facs: (sandbox.P.factions || []).filter(f => f.sid === sc.id).map(f => Object.assign({}, f)),
      chars: (sandbox.P.characters || []).filter(c => c.sid === sc.id).map(c => Object.assign({}, c)),
      letters: [],
      _pendingNpcLetters: [],
      _letterSuspects: [],
      _courierStatus: {},
      _routeDisruptions: [],
      _capital: (sc.playerInfo && sc.playerInfo.capital) || '京师',
      adminHierarchy: sc.adminHierarchy || sandbox.P.adminHierarchy || null,
      _edictTracker: []
    };
    sandbox.P.conf = sandbox.P.conf || {};
    sandbox.P.playerInfo = sandbox.P.playerInfo || {};
    console.log('[A] GM.turn=' + GM.turn + ' chars=' + GM.chars.length + ' capital=' + GM._capital);

    // 检查 SettlementPipeline 注册
    const steps = sandbox.SettlementPipeline.list();
    const hasLetters = steps.some(s => s.id === 'letters');
    console.log('[A] pipeline.letters registered =', hasLetters ? '✓' : '✗ MISSING (=> bug)');
    assert(hasLetters, 'letters settlement step must be registered');

    // 模拟 sendLetter：直接构造一封信，模拟玩家写信给孙承宗
    const sun = GM.chars.find(c => c.name === '孙承宗');
    console.log('[A] target 孙承宗:', sun ? sun.location : 'NOT FOUND');
    assert(sun, 'Sun Chengzong target must exist');

    const dpv = sandbox._getDaysPerTurn();
    const days = sandbox.calcLetterDays(GM._capital, sun.location, 'normal');
    const deliveryTurns = Math.max(1, Math.ceil(days / dpv));
    assert(Number.isFinite(dpv) && dpv > 0, 'days per turn must be positive');
    assert(Number.isFinite(days) && days > 0, 'letter travel days must be positive');
    const letter = {
      id: 'L_test_A', from: '玩家', to: sun.name,
      fromLocation: GM._capital, toLocation: sun.location,
      content: '令孙承宗为辽东经略·速整军备', sentTurn: GM.turn,
      deliveryTurn: GM.turn + deliveryTurns,
      replyTurn: GM.turn + deliveryTurns + 1,
      reply: '', status: 'traveling',
      urgency: 'normal', letterType: 'formal_edict'
    };
    GM.letters.push(letter);
    console.log('[A] letter pushed: sentTurn=' + letter.sentTurn + ' deliveryTurn=' + letter.deliveryTurn + ' (days=' + days + ' dpv=' + dpv + ')');

    function endTurnLite() {
      const ctx = { timeRatio: dpv/365, turn: GM.turn };
      sandbox.SubTickRunner.run(ctx);
      GM.turn++;
    }

    for (let i = 0; i < 3; i++) {
      endTurnLite();
      console.log(`[A] after endTurn ${i+1} → GM.turn=${GM.turn} status=${letter.status} reply=${(letter.reply||'').slice(0,30)}`);
    }
    assertEq(letter.status, 'returned', 'player letter should return after enough turns');
    assert((letter.reply || '').length > 0, 'player letter should have a reply');

    // ============ Path B: 模拟"NPC 来信" ============
    console.log('\n========== Path B: NPC 主动来信（_pendingNpcLetters） ==========');
    GM._pendingNpcLetters.push({
      from: '袁崇焕', type: 'report', urgency: 'urgent',
      content: '辽东捷报：我军坚守宁远·建虏退却',
      suggestion: '速发犒军银 30 万'
    });
    const turnBefore = GM.turn;
    endTurnLite();
    const npcLt = GM.letters.find(l => l._npcInitiated && l.from === '袁崇焕');
    console.log('[B] after endTurn → npcLt =', npcLt ? `created status=${npcLt.status} deliveryTurn=${npcLt.deliveryTurn}` : 'NOT CREATED');
    assert(npcLt, 'pending NPC letter should become an in-flight letter');
    assertOneOf(npcLt.status, ['traveling', 'delivered', 'returned'], 'NPC letter should enter a live status');
    for (let i = 0; i < 3; i++) {
      endTurnLite();
      console.log(`[B] endTurn ${i+1}: status=${npcLt && npcLt.status}`);
    }
    assertEq(npcLt.status, 'returned', 'NPC letter should arrive after enough turns');

    // ============ Path C: 模拟 sendLetter 真实调用 ============
    console.log('\n========== Path C: 通过 sendLetter() 真实创建 ==========');
    sandbox.GM._pendingLetterTo = '袁崇焕';
    const xiong = GM.chars.find(c => c.name === '袁崇焕');
    console.log('[C] target 袁崇焕:', xiong ? xiong.location : 'NOT FOUND');
    assert(xiong, 'real sendLetter target must exist');
    if (xiong) {
      // sendLetter 读 textarea。我们 stub document.getElementById 返回带 value 的 fake 元素
      const oldGetEl = sandbox.document.getElementById;
      sandbox.document.getElementById = (id) => {
        const el = fakeEl();
        if (id === 'letter-textarea') el.value = '问熊廷弼辽东战守之策';
        if (id === 'letter-urgency') el.value = 'normal';
        if (id === 'letter-type') el.value = 'inquiry';
        if (id === 'letter-cipher') el.value = 'none';
        if (id === 'letter-sendmode') el.value = 'normal';
        return el;
      };
      sandbox._$ = (id) => sandbox.document.getElementById(id);
      const before = GM.letters.length;
      try { sandbox.sendLetter(); } catch (e) { console.error('[C] sendLetter threw:', e.message.slice(0, 200)); }
      const after = GM.letters.length;
      console.log('[C] letters before/after sendLetter:', before, '→', after);
      const newLt = GM.letters[GM.letters.length - 1];
      console.log('[C] new letter:', newLt ? `status=${newLt.status} to=${newLt.to} deliveryTurn=${newLt.deliveryTurn} (now=${GM.turn})` : 'none');
      assertEq(after, before + 1, 'sendLetter should append one letter');
      assert(newLt, 'sendLetter should create a letter object');
      assertEq(newLt.to, xiong.name, 'sendLetter should target the selected person');
      assertOneOf(newLt.status, ['traveling', 'delivered', 'returned'], 'sendLetter should create a live letter status');
      sandbox.document.getElementById = oldGetEl;
      if (newLt) {
        for (let i = 0; i < 3; i++) {
          endTurnLite();
          console.log(`[C] endTurn ${i+1}: status=${newLt.status} reply=${(newLt.reply||'').slice(0,30)}`);
        }
        assertEq(newLt.status, 'returned', 'sendLetter-created letter should return after enough turns');
      }
    }

    console.log('[smoke-letter-full] pass assertions=' + ASSERTS);
    process.exit(0);
  } catch (e) {
    console.error('SIMULATION ERROR:', e.message, '\n', e.stack);
    process.exit(1);
  }
}, 250);
