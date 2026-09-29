#!/usr/bin/env node
// smoke-p6-inline-namespaces.js - Phase 6 HTML inline namespace migration gate.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed++;
}

function mustContain(text, needle, label) {
  assert(text.includes(needle), label + ' should contain ' + needle);
}

function mustNotContain(text, needle, label) {
  assert(!text.includes(needle), label + ' should not contain ' + needle);
}

const indexHtml = read('index.html');
const editorHtml = read('editor.html');

[
  'TM.UI.topbar.openAllVarsModal()',
  "TM.UI.shell.openSideDrawer('left','fac')",
  "TM.UI.shell.openSideDrawer('right','fin')",
  "TM.UI.shell.closeSideDrawer('left')",
  'TM.UI.turnResult.closeTurnResult()',
  'TM.UI.turnResult.navTurn(-1)',
  'TM.UI.turnResult.exportCurrent()',
  'TM.Save.openManager()',
  "TM.UI.tabs.switchGameTab(null,'gt-edict')",
  "TM.UI.tabs.switchGameTab(null,'gt-chaoyi')",
  'TM.Endturn.run.confirmEndTurn()'
].forEach(function(needle) { mustContain(indexHtml, needle, 'index.html'); });

[
  'onclick="openAllVarsModal()',
  'onclick="openSideDrawer(',
  'onclick="closeSideDrawer(',
  'onclick="closeTurnResult()',
  'onclick="_trNavTurn(',
  'onclick="_trExportCurrent()',
  'onclick="openSaveManager()',
  'switchGTab&&switchGTab',
  'onclick="confirmEndTurn()'
].forEach(function(needle) { mustNotContain(indexHtml, needle, 'index.html'); });

[
  'TM.Editor.core.cloneScript()',
  'TM.Editor.core.openFullGenModal()',
  'TM.Editor.core.quickTestScenario()',
  'TM.Editor.core.saveScript()',
  "TM.Editor.ai.openAIGenModal('playerOverview')",
  "TM.Editor.ai.openAIGenModal('characters')",
  "TM.Editor.ai.openAIGenModal('haremConfig')",
  "TM.Editor.ai.openAIGenModal('government')",
  'TM.Editor.ai.aiGeneratePlayerFaction()',
  'TM.Editor.ai.aiGeneratePlayerCharacter()',
  'TM.Editor.ai.aiGenerateGoals()',
  'TM.Editor.forms.addGoalEntry()',
  'TM.Editor.domain.renderMilitaryNew()',
  'TM.Editor.ai.closeAIGenModal()',
  'TM.Editor.ai.doAIGenerate()',
  'TM.Editor.core.closeFullGenModal()',
  'TM.Editor.crud.openTraitSelectorModal()',
  'TM.Editor.core.closeGenericModal()',
  "TM.Editor.map.updateMapSystemConfig('enabled'",
  '<script src="tm-namespaces.js" defer="" data-tm-no-auto-verify="1"></script>'
].forEach(function(needle) { mustContain(editorHtml, needle, 'editor.html'); });

const editorAdminScript = editorHtml.indexOf('<script src="editor-administration.js" defer=""></script>');
const scenarioTags=Array.from(editorHtml.matchAll(/<script src="scenarios\/tianqi7-1627\.js(?:\?v=[^"]*)?" defer=""><\/script>/g));assert(scenarioTags.length===1,'one actual versioned scenario provider');const scenarioScript=scenarioTags[0].index;
const namespaceScript = editorHtml.indexOf('<script src="tm-namespaces.js" defer="" data-tm-no-auto-verify="1"></script>');
assert(editorAdminScript >= 0, 'editor-administration.js script should be present');
assert(scenarioScript >= 0, 'scenario script should be present');
assert(namespaceScript > editorAdminScript, 'tm-namespaces.js should load after editor modules');
assert(namespaceScript > scenarioScript, 'tm-namespaces.js should load after the default scenario');

[
  'onclick="cloneScript()"',
  'onclick="openFullGenModal()"',
  'onclick="quickTestScenario()"',
  'onclick="saveScript()"',
  'onclick="openAIGenModal(',
  'onclick="closeAIGenModal()"',
  'onclick="doAIGenerate()"',
  'onclick="closeFullGenModal()"',
  'onclick="openTraitSelectorModal()"',
  'onclick="closeGenericModal()"',
  'onchange="updateMapSystemConfig(',
  'onclick="renderMilitaryNew()"',
  'onclick="aiGenerateGoals()"',
  'onclick="addGoalEntry()"'
].forEach(function(needle) { mustNotContain(editorHtml, needle, 'editor.html'); });

console.log('[smoke-p6-inline-namespaces] pass assertions=' + passed);
