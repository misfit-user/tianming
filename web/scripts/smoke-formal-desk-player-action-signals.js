#!/usr/bin/env node
// smoke-formal-desk-player-action-signals.js - formal desk operations must feed real content into party/class signals.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeEl(overrides) {
  const attrs = Object.create(null);
  return Object.assign({
    id: '',
    className: '',
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: { cssText: '' },
    classList: { add(){}, remove(){}, toggle(){ return false; }, contains(){ return false; } },
    appendChild(child){ return child; },
    removeChild(child){ return child; },
    insertBefore(child){ return child; },
    addEventListener(){},
    removeEventListener(){},
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    closest(){ return null; },
    focus(){},
    remove(){},
    setAttribute(name, value){ attrs[name] = String(value); this[name] = value; },
    getAttribute(name){ return attrs[name] || null; },
    hasAttribute(name){ return Object.prototype.hasOwnProperty.call(attrs, name); }
  }, overrides || {});
}

const selectorValues = new Map();
const idValues = new Map();
const appended = [];
const overlayRoot = makeEl({
  querySelector(selector) {
    if (!selectorValues.has(selector)) return null;
    return makeEl({ value: selectorValues.get(selector) });
  },
  querySelectorAll() { return []; }
});

const documentStub = {
  body: makeEl({ appendChild(el){ appended.push(el); return el; } }),
  head: makeEl({ appendChild(el){ appended.push(el); return el; } }),
  readyState: 'complete',
  createElement(tag) { return makeEl({ tagName: String(tag || '').toUpperCase() }); },
  getElementById(id) {
    if (idValues.has(id)) return makeEl({ id, value: idValues.get(id) });
    return null;
  },
  querySelector(selector) {
    if (selector === '.tm-desk-overlay') return overlayRoot;
    if (selectorValues.has(selector)) return makeEl({ value: selectorValues.get(selector) });
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '[data-desk-edict-cat]') return [];
    if (selector === '.tm-desk-overlay') return [];
    return [];
  },
  addEventListener(){},
  removeEventListener(){}
};

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout(){},
  document: documentStub,
  window: {},
  navigator: { userAgent: 'node' },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  performance: { now: () => Date.now() },
  alert(){},
  confirm: () => true,
  prompt: () => null,
  addEB(){},
  renderEventFeed(){},
  renderMemorials(){},
  renderLetterPanel(){},
  renderJishi(){},
  renderQiju(){},
  renderBiannian(){},
  renderGameState(){}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.P = {
  playerInfo: { characterName: 'The Throne' },
  conf: { partyClassLlmEnabled: true }
};
sandbox.GM = {
  turn: 30,
  qijuHistory: [],
  _chronicle: [],
  currentIssues: [
    {
      id: 'issue-levy',
      title: 'Canal levy relief',
      text: 'Reduce levy and rent arrears for Canal Tenants.',
      category: 'finance',
      status: 'pending',
      choices: [
        { text: 'Approve remission', desc: 'reduce levy pressure for Canal Tenants and let Relief League sponsor it' },
        { text: 'Press arrears', desc: 'defend collection despite tenant complaints' }
      ]
    }
  ],
  memorials: [
    {
      id: 'mem-tenant',
      title: 'Canal levy relief memorial',
      from: 'Censor Xu',
      dept: 'Finance',
      type: 'finance',
      content: 'Canal Tenants ask to reduce levy and rent arrears. Relief League supports remission.',
      text: 'Canal Tenants ask to reduce levy and rent arrears. Relief League supports remission.',
      status: 'pending',
      turn: 30,
      _fromIssueId: 'issue-levy'
    }
  ],
  letters: [],
  classes: [
    {
      name: 'Canal Tenants',
      tags: ['tenant', 'tax', 'land'],
      satisfaction: 40,
      influence: 55,
      demands: 'reduce levy and rent arrears',
      unrestLevels: { grievance: 60, petition: 52 }
    }
  ],
  parties: [
    {
      name: 'Relief League',
      tags: ['relief', 'tax'],
      influence: 50,
      cohesion: 50,
      currentAgenda: 'carry tenant levy relief',
      socialBase: ['Canal Tenants']
    },
    {
      name: 'Revenue Clique',
      tags: ['tax'],
      influence: 60,
      cohesion: 60,
      currentAgenda: 'defend levy collection and arrears'
    }
  ],
  chars: [
    { name: 'Censor Xu', party: 'Relief League', officialTitle: 'Censor', alive: true, location: 'Capital' }
  ]
};
sandbox.scriptData = sandbox.GM;
sandbox.findCharByName = name => (sandbox.GM.chars || []).find(c => c && c.name === name) || null;
sandbox.getTSText = turn => 'T' + turn;
sandbox._chooseIssueOption = function(id, choiceIndex) {
  const issue = sandbox.GM.currentIssues.find(x => x && x.id === id);
  if (!issue) return;
  issue.status = 'chosen';
  issue.chosenIndex = choiceIndex;
  issue.chosenText = issue.choices[choiceIndex] && issue.choices[choiceIndex].text;
};
// 生产恒由 tm-memorials.js 提供的奏疏决定 mutator(此 smoke 不装载该大文件·补等价桩)·
// deskStageMemorial 走此正路落状态·再下沉 recordDeskActionSignal 喂党争/阶层信号(本 smoke 主题)。
// 2026-07-19：phase8-formal-drafts.js 删除了 mutator 缺席时的 m.status 裸写降级(伪批·丢皇权/EB/回传)·
// 故此桩须显式提供·与生产装载一致。
sandbox._stageMemorialDecision = function(m, action, reply){
  if (!m) return;
  m.status = action;
  m.reply = reply || '';
  m._commitApplied = false;
  if (!sandbox.GM._approvedMemorials) sandbox.GM._approvedMemorials = [];
  sandbox.GM._approvedMemorials.push({ from: m.from, type: m.type, content: m.content || '', turn: sandbox.GM.turn, reply: m.reply, action: action });
};

const bridge = {
  _state: { activePanel: 'desk', letterDraft: {}, edictDrafts: {} },
  _esc: esc,
  _attr: esc,
  _asset: v => v,
  _fmtNum: v => String(v),
  _miniRows: () => '',
  _actionButton: () => '',
  _moduleShell: () => '',
  _dossierRows: () => '',
  _ownerKey: () => '',
  _ownerName: () => '',
  _findFaction: () => null,
  _findPerson: name => sandbox.findCharByName(name) || { name, alive: true },
  _personKey: p => p && (p.name || p.id) || '',
  _personNameKey: p => String(p && (p.name || p.id) || '').replace(/\s+/g, ''),
  _getPeople: () => sandbox.GM.chars,
  _getMapData: () => ({ regions: [] }),
  _getParties: () => sandbox.GM.parties,
  _getClasses: () => sandbox.GM.classes,
  _collectRecentEvents: () => [],
  _getTurnText: turn => 'T' + (turn || sandbox.GM.turn || 1),
  _firstArray: (...args) => args.find(Array.isArray) || [],
  _compactText: (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n || 160),
  _getMemorials: () => sandbox.GM.memorials.map((m, i) => Object.assign({ rawIndex: i, raw: m }, m)),
  _getIssues: () => sandbox.GM.currentIssues,
  _getLetters: () => sandbox.GM.letters.map((l, i) => Object.assign({ rawIndex: i, raw: l }, l)),
  _getActiveScenario: () => ({}),
  _getArmies: () => [],
  _issueIsResolved: issue => /done|chosen|resolved/.test(String(issue && issue.status || '')),
  _tmfRenwuPortrait: () => '',
  _fullHongyanText: l => l && (l.content || l.body || ''),
  _toast(){},
  _cssEscape: v => String(v || '').replace(/"/g, '\\"'),
  _clearFormalDraftStore(){},
  _openChaoyiMode(){},
  _openShizhengPreviewPanel(){},
  _closeModule(){},
  _returnFormalHomeSoon(){},
  _saveFormalDraftsToGM(){},
  _restoreFormalDraftsFromGM(){},
  _handleModuleAction(){},
  _updateRailBadges(){},
  _renderEventFeed(){},
  openPanel(){},
  openModule(){},
  openGuoku(){}
};
sandbox.TMPhase8FormalBridge = bridge;

vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

(function main() {
  load('tm-engine-constants.js');
  load('tm-class-engine.js');
  load('tm-party-goals.js');
  load('tm-party-class-ecology.js');
  load('tm-social-political-signals.js');
  load('tm-player-action-signals.js');
  load('phase8-formal-drafts.js');
  load('phase8-formal-drafts-message-panels.js'); // 第二十六拆：奏疏/鸿雁面板迁出·须紧随 origin 装载(origin-first 双向 bucket)

  assert(bridge.drafts && typeof bridge.drafts.handleDeskAction === 'function', 'formal desk should expose handleDeskAction for integration and smoke coverage');

  idValues.set('mem-reply', 'Approved: remit Canal Tenants levy and rent arrears; ask Relief League to supervise relief.');
  bridge.drafts.handleDeskAction('memorial-decision-desk', { id: 'mem-tenant', decision: 'approved', replyid: 'mem-reply' });

  let playerItems = sandbox.GM._playerActionSignals && sandbox.GM._playerActionSignals.items || [];
  assert(playerItems.some(s => s && s.source === 'phase8-desk' && s.action === 'memorial-decision-desk' && /Approved: remit Canal Tenants levy/.test(s.text)), 'memorial decision should record actual reply and memorial content');
  let socialItems = sandbox.GM._socialPoliticalSignals && sandbox.GM._socialPoliticalSignals.items || [];
  const memorialSocial = socialItems.find(s => s && s.kind === 'player-memorial' && /Approved: remit Canal Tenants levy/.test(s.reason || ''));
  assert(memorialSocial, 'memorial decision should mirror as a player-memorial social/political signal');
  assert(memorialSocial.tags.includes('tax') && memorialSocial.tags.includes('relief'), 'formal memorial signal should preserve inferred fiscal relief tags');
  assert(memorialSocial.affectedClasses.some(x => x && x.name === 'Canal Tenants' && x.satisfactionDelta > 0), 'formal approval should generate a deterministic positive class impact');
  assert(memorialSocial.affectedParties.some(x => x && x.name === 'Relief League' && x.shortGoal), 'formal approval should update matched party agenda/goal context');

  const beforeSatisfaction = sandbox.GM.classes[0].satisfaction;
  const applied = sandbox.TM.SocialPoliticalSignals.applyPending(sandbox.GM, { turn: 30, source: 'smoke-formal-desk' });
  assert(applied.signals >= 1 && applied.classes >= 1, 'formal desk signal should be consumable by PartyClassSignalBridge');
  assert(sandbox.GM.classes[0].satisfaction > beforeSatisfaction, 'formal approval should raise affected class satisfaction after bridge apply');
  const edge = Object.values(sandbox.GM.partyClassRelations.edges || {}).find(e => e && e.className === 'Canal Tenants' && e.partyName === 'Relief League');
  assert(edge && edge.affinity > 50, 'formal approval should strengthen emergent party/class relation through ecology');

  selectorValues.set('[data-desk-letter-to]', 'Censor Xu');
  selectorValues.set('[data-desk-letter-body]', 'Please continue levy remission inquiries for Canal Tenants and coordinate with Relief League.');
  selectorValues.set('[data-desk-letter-type]', 'formal_edict');
  selectorValues.set('[data-desk-letter-urgency]', 'urgent');
  selectorValues.set('[data-desk-letter-cipher]', 'none');
  selectorValues.set('[data-desk-letter-sendmode]', 'multi_courier');
  bridge.drafts.handleDeskAction('letter-send-desk', {});
  playerItems = sandbox.GM._playerActionSignals.items;
  assert(playerItems.some(s => s && s.action === 'letter-send-desk' && /Please continue levy remission/.test(s.text) && /Censor Xu/.test(s.target)), 'sent letter should record recipient and actual body');
  assert(sandbox.GM.letters.some(l => l && l.to === 'Censor Xu' && /levy remission/.test(l.body || l.content || '')), 'letter desk action should still create GM.letters entry');

  idValues.set('edict-pol', 'Issue an edict to remit Canal Tenants levy arrears and protect tenant fields.');
  selectorValues.set('[data-desk-edict-type]', 'policy edict');
  selectorValues.set('[data-desk-edict-receiver]', 'Finance Ministry');
  bridge.drafts.handleDeskAction('publish-edict-desk', {});
  playerItems = sandbox.GM._playerActionSignals.items;
  assert(playerItems.some(s => s && s.action === 'publish-edict-desk' && /Issue an edict to remit Canal Tenants/.test(s.text)), 'published edict should record actual edict text');

  bridge.drafts.handleDeskAction('shizheng-choice-desk', { id: 'issue-levy', choice: '0' });
  playerItems = sandbox.GM._playerActionSignals.items;
  socialItems = sandbox.GM._socialPoliticalSignals.items;
  assert(playerItems.some(s => s && s.action === 'shizheng-choice-desk' && /Approve remission/.test(s.text)), 'court issue choice should record chosen option text');
  assert(socialItems.some(s => s && s.sourceSystem === 'player-action' && s.linkedIssue === 'issue-levy' && /Approve remission/.test(s.reason || '')), 'court issue choice should preserve linked issue in social/political ledger');

  console.log('[smoke-formal-desk-player-action-signals] PASS formal desk player action signals');
})()
