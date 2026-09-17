'use strict';
// Real production functions and lease; controlled DOM/network boundaries, no live saves/API.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const { functionSource } = require('./lib-perf-round1');
const web = path.resolve(__dirname, '..'), refAt = process.argv.indexOf('--source-ref');
const read = file => refAt < 0 ? fs.readFileSync(path.join(web, file), 'utf8') :
  require('child_process').execFileSync('git', ['show', process.argv[refAt + 1] + ':web/' + file], { cwd: path.dirname(web), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const core = read('tm-player-core.js');
const ui = core.slice(core.indexOf('var _DF_BUILD_CAT_CN'), core.indexOf('/** 非直辖区划'));
const lease = ['_tmCaptureWorldLease', '_tmWorldLeaseCurrent'].map(n => functionSource(read('tm-post-turn-jobs.js'), n)).join('\n');
const adopt = ['_showEdictAdoptMenu', '_closeEdictMenu'].map(n => functionSource(read('tm-hongyan-edict-ui.js'), n)).join('\n');
function world(id) {
  const div = { name: '同名府', buildings: [] };
  return { GM: { turn: 1, _campaignId: id, _timelineId: id, guoku: { money: 10000 }, _edictSuggestions: [] }, P: { ai: { key: 'controlled-only' }, buildingSystem: { buildingTypes: [{ name: '义仓', baseCost: 1000, buildTime: 3 }] }, adminHierarchy: { player: { divisions: [div] } } }, div };
}
function harness() {
  let nodes = {}, pending = [], signals = 0, approvals = 0;
  const notices = [], c = { ...world('A'), console, Date, Promise, AbortController, setTimeout, clearTimeout, innerHeight: 1000 };
  function node(id = '') {
    const n = { id, value: '', style: {}, classList: { toggle() {} }, children: [], isConnected: true, handlers: {}, disabled: false,
      addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
      fire(type, target) { (this.handlers[type] || []).forEach(fn => fn({ target: target || this })); },
      getBoundingClientRect() { return { left: 20, top: 20, bottom: 40 }; }, focus() {}, contains(t) { return this.children.includes(t); },
      appendChild(child) { this.children.push(child); if (child.id) nodes[child.id] = child; },
      remove() { this.isConnected = false; if (nodes[this.id] === this) delete nodes[this.id]; }, scrollIntoView() {}
    };
    let html = '';
    Object.defineProperty(n, 'innerHTML', { get: () => html, set(value) {
      html = value;
      if (value.includes('id="_dfBuildModal"')) {
        const m = node('_dfBuildModal'); n.firstChild = m;
        for (const match of value.matchAll(/id="([^"]+)"/g)) if (match[1] !== m.id) nodes[match[1]] = node(match[1]);
      }
    } });
    return n;
  }
  c.document = { getElementById: id => nodes[id] || null, createElement: () => node(), body: node(), addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  c.window = c; c.TM = { CustomBuildAgent: { enabled: () => true, appraise: () => new Promise(resolve => pending.push(resolve)), approveBuild() { approvals++; c.GM.guoku.money -= 5000; c.div.buildings.push({ name: 'direct' }); return { ok: true, spent: { money: 5000 } }; } } };
  c.escHtml = value => String(value).replace(/</g, '&lt;'); c.finiteNumberOr = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
  c._dfGlobalRulesHtml = c._dfTalentCohortsHtml = () => ''; c.toast = value => notices.push(value);
  c._recordPlayerActionSignal = () => { signals++; }; c.CustomEvent = function() {};
  c._$ = id => nodes[id]; vm.createContext(c); vm.runInContext(lease + '\n' + ui + '\n' + adopt, c, { filename: 'actual-building-ui-and-lease.js' });
  if (core.includes('orders.propose(')) vm.runInContext(read('tm-building-orders.js'), c, { filename: 'tm-building-orders.js' });
  function mount(name = '崇文馆') { c._dfBuildModal('同名府'); nodes._bmCustName.value = name; nodes._bmCustCat.value = 'cultural'; nodes._bmCustDesc.value = '召集学士修订典籍'; return nodes._dfBuildModal; }
  return { c, mount, notices, get nodes() { return nodes; }, get signals() { return signals; }, get approvals() { return approvals; },
    start: () => c._dfAppraiseCustomBuild(encodeURIComponent('同名府')),
    reply(i, label = '核议依据', ok = true) { pending[i](ok ? { ok: true, appraisal: { feasibility: '合理', costActual: 5000, timeActual: 3, upkeep: 60, effectLabels: ['解额 +1'], effectsStructured: { abs: { 'economyBase.kejuQuota': 1 } }, reason: label } } : { ok: false, reason: 'no-appraisal' }); }
  };
}
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + ': ' + e.stack); } }
(async () => {
  await test('appraisal adoption creates only an original edict suggestion, with preserved reference', async () => {
    const h = harness(); h.mount(); const task = h.start(); h.reply(0); await task;
    h.c._dfApproveBuild(); assert.equal(h.approvals, 0); assert.equal(h.c.GM.guoku.money, 10000); assert.equal(h.c.div.buildings.length, 0); assert.equal(h.signals, 0);
    const list = h.c.GM._edictSuggestions; assert.equal(list.length, 1); assert(list[0].content.includes('5000') && list[0].content.includes('3 回合') && list[0].content.includes('economyBase.kejuQuota'));
    // Existing adoption handler, not a replacement implementation; suggestion survives JSON save/load.
    h.c.GM._edictSuggestions = JSON.parse(JSON.stringify(list));
    const ta = { value: '' }; h.nodes['edict-eco'] = ta;
    h.c._showEdictAdoptMenu({ stopPropagation() {}, preventDefault() {}, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 1 }) } }, 0);
    h.nodes._edictAdoptMenu.children[3].onclick({ stopPropagation() {} });
    assert(ta.value.includes(list[0].content)); assert.equal(h.approvals, 0);
    h.c._dfApproveBuild(); assert.equal(list.length, 1);
  });
  await test('plain custom and catalogue proposals still work without AI and do not count as issued actions', () => {
    for (const custom of [true, false]) {
      const h = harness(); h.mount(); h.c._dfSubmitBuild(encodeURIComponent('同名府'), custom ? -1 : 0, custom);
      assert.equal(h.c.GM._edictSuggestions.length, 1); assert.equal(h.approvals, 0); assert.equal(h.signals, 0);
    }
  });
  await test('old A reply after B cannot replace visible or pending B appraisal', async () => {
    const h = harness(); h.mount('A工程'); const a = h.start(); Object.assign(h.c, world('B')); h.mount('B工程'); const b = h.start();
    h.reply(1, 'B依据'); await b; h.reply(0, 'A依据'); await a;
    assert.equal(h.c._dfPendingAppraisal.req.name, 'B工程'); assert(h.nodes._bmAppraiseResult.innerHTML.includes('B依据'));
    h.c._dfApproveBuild(); assert.equal(h.c.GM._edictSuggestions[0].content.includes('B工程'), true); assert.equal(h.approvals, 0);
  });
  await test('same-world reversed requests accept only newest intent', async () => {
    const h = harness(); h.mount(); const a = h.start(), b = h.start(); h.reply(1, 'new'); await b; h.reply(0, 'old'); await a;
    assert.equal(h.c._dfPendingAppraisal.appraisal.reason, 'new'); assert(h.nodes._bmAppraiseResult.innerHTML.includes('new'));
  });
  await test('close/reopen prevents an old result from becoming actionable', async () => {
    const h = harness(); h.mount(); const a = h.start(); h.nodes._dfBuildModal.remove(); h.mount('新工程'); h.reply(0); await a;
    h.c._dfApproveBuild(); assert.equal(h.c.GM._edictSuggestions.length, 0); assert.equal(h.approvals, 0);
  });
  for (const change of ['gm', 'p', 'timeline', 'load-generation', 'turn']) await test('world identity change (' + change + ') rejects even a same-turn/same-name stale form', async () => {
    const h = harness(); h.mount(); const a = h.start(); h.reply(0); await a;
    if (change === 'gm') h.c.GM = { ...h.c.GM };
    if (change === 'p') h.c.P = { ...h.c.P };
    if (change === 'timeline') h.c.GM._timelineId = 'fork';
    if (change === 'load-generation') h.c._tmLoadGen = 1;
    if (change === 'turn') h.c.GM.turn++;
    h.c._dfApproveBuild(); assert.equal(h.c.GM._edictSuggestions.length, 0); assert.equal(h.approvals, 0);
    h.c._dfSubmitBuild(encodeURIComponent('同名府'), -1, true); assert.equal(h.c.GM._edictSuggestions.length, 0);
  });
  await test('edited input cannot use an earlier appraisal even without a DOM input event', async () => {
    const h = harness(); h.mount(); const a = h.start(); h.reply(0); await a; h.nodes._bmCustDesc.value = '已改规制';
    h.c._dfApproveBuild(); assert.equal(h.c.GM._edictSuggestions.length, 0); assert.equal(h.approvals, 0);
  });
  await test('input change during request restores retry; late reply is discarded', async () => {
    const h = harness(), m = h.mount(); const a = h.start(); h.nodes._bmCustDesc.value = '新规制'; m.fire('input', h.nodes._bmCustDesc);
    assert.equal(h.nodes._bmAppraise.disabled, false); h.reply(0); await a; assert(!h.c._dfPendingAppraisal);
    const b = h.start(); h.reply(1); await b; assert.equal(h.c._dfPendingAppraisal.req.description, '新规制');
  });
  await test('new failed appraisal invalidates the previously successful one', async () => {
    const h = harness(); h.mount(); let a = h.start(); h.reply(0); await a; a = h.start(); h.reply(1, '', false); await a;
    h.c._dfApproveBuild(); assert.equal(h.c.GM._edictSuggestions.length, 0); assert.equal(h.approvals, 0); assert.equal(h.nodes._bmAppraise.disabled, false);
  });
  for (const phase of ['before-request', 'appraisal', 'critique']) await test('actual agent respects cancellation during ' + phase, async () => {
    const h = harness(), ctrl = new AbortController(), signals = []; let calls = 0;
    vm.runInContext(read('tm-custom-build-agent.js'), h.c, { filename: 'tm-custom-build-agent.js' });
    h.c.callAIWithTools = async (_prompt, _tools, opts) => {
      calls++; signals.push(opts.signal);
      if (phase === 'appraisal' || (phase === 'critique' && calls === 2)) ctrl.abort();
      return { toolCalls: [{ name: 'submit_appraisal', input: { feasibility: '合理', costActual: 5000, timeActual: 3 } }] };
    };
    if (phase === 'before-request') ctrl.abort();
    const r = await h.c.TM.CustomBuildAgent.appraise('同名府', { name: '书院' }, { P: h.c.P, GM: h.c.GM, signal: ctrl.signal });
    assert.equal(r.ok, false); assert.equal(r.reason, 'aborted'); assert.equal(calls, phase === 'before-request' ? 0 : phase === 'appraisal' ? 1 : 2);
    assert(signals.every(signal => signal === ctrl.signal));
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0 })); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
