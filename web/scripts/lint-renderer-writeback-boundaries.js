#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const WEB = path.resolve(__dirname, '..');
const failures = [];
let checks = 0;
function check(condition, message) {
  checks++;
  if (!condition) failures.push(message);
}
function read(file) { return fs.readFileSync(path.join(WEB, file), 'utf8'); }
function parse(file) {
  const source = read(file);
  return { source, ast: acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, locations: true }) };
}
function traverse(node, visitors, ancestors) {
  if (!node || typeof node !== 'object') return;
  ancestors = (ancestors || []).concat(node);
  if (/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type) && visitors.Function) {
    visitors.Function(node, null, ancestors);
  }
  if (visitors[node.type]) visitors[node.type](node, null, ancestors);
  Object.keys(node).forEach((key) => {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') return;
    const child = node[key];
    if (Array.isArray(child)) child.forEach((entry) => { if (entry && typeof entry.type === 'string') traverse(entry, visitors, ancestors); });
    else if (child && typeof child.type === 'string') traverse(child, visitors, ancestors);
  });
}
function propertyName(member) {
  if (!member || member.type !== 'MemberExpression') return '';
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (member.computed && member.property.type === 'Literal') return String(member.property.value || '');
  return '';
}
function assignedName(node, ancestors) {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
  const parent = ancestors[ancestors.length - 2];
  if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
  if (parent && parent.type === 'AssignmentExpression') {
    if (parent.left.type === 'Identifier') return parent.left.name;
    return propertyName(parent.left);
  }
  return '';
}
function functionsByName(parsed) {
  const result = new Map();
  traverse(parsed.ast, {
    Function(node, _state, ancestors) {
      const name = assignedName(node, ancestors);
      if (name) result.set(name, node);
    }
  });
  return result;
}
function directCalls(functionNode, visitor) {
  traverse(functionNode.body, {
    CallExpression(node, _state, ancestors) {
      const owner = [...ancestors].reverse().find((ancestor) => /Function/.test(ancestor.type));
      if (!owner || owner === functionNode) visitor(node, ancestors);
    }
  });
}
function unsafeDomSinks(parsed, functionNode) {
  const hits = [];
  traverse(functionNode.body, {
    AssignmentExpression(node, _state, ancestors) {
      const owner = [...ancestors].reverse().find((ancestor) => /Function/.test(ancestor.type));
      if (owner && owner !== functionNode) return;
      const prop = propertyName(node.left);
      if (prop === 'innerHTML' || prop === 'outerHTML' || /^on(?:click|load|error|focus|change|input)$/i.test(prop)) hits.push({ node, kind: prop });
    },
    CallExpression(node, _state, ancestors) {
      const owner = [...ancestors].reverse().find((ancestor) => /Function/.test(ancestor.type));
      if (owner && owner !== functionNode) return;
      const prop = propertyName(node.callee);
      if (prop === 'insertAdjacentHTML' || (prop === 'write' && node.callee.object && node.callee.object.name === 'document')) hits.push({ node, kind: prop });
      if (prop === 'setAttribute' && node.arguments[0] && node.arguments[0].type === 'Literal' && /^on/i.test(String(node.arguments[0].value || ''))) hits.push({ node, kind: 'event-attribute' });
    }
  });
  return hits.map((hit) => hit.kind + '@' + parsed.source.slice(0, hit.node.start).split(/\r?\n/).length);
}

const domTargets = {
  'tm-electron.js': [
    '_desktopScenarioStartPanel', 'showPanel', 'showScnManage', 'showScnSelect',
    'desktopConfirmStart', 'desktopBackToStartPanel'
  ],
  'tm-ai-infra.js': ['renderEraNamesList', '_tmTimeDisplayParts', 'createTSElement', '_buildAICostPanelElement', 'showAICostPanel'],
  'tm-patches-start.js': ['_tmShowOpeningCeremony']
};
Object.entries(domTargets).forEach(([file, names]) => {
  const parsed = parse(file);
  const functions = functionsByName(parsed);
  names.forEach((name) => {
    const fn = functions.get(name);
    check(!!fn, file + ': missing guarded function ' + name);
    if (fn) check(unsafeDomSinks(parsed, fn).length === 0, file + ':' + name + ' contains unsafe DOM sinks: ' + unsafeDomSinks(parsed, fn).join(', '));
  });
});

const startSource = read('tm-patches-start.js');
check(!/\.innerHTML\s*=\s*[^;]*(?:sc|scenario)\.opening/.test(startSource), 'opening prose must never be assigned to innerHTML');

const indexSource = read('index.html');
const csp = (indexSource.match(/Content-Security-Policy[^>]+/i) || [''])[0];
check(/object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp), 'index CSP must retain object-src none and base-uri none');

const queueParsed = parse('tm-change-queue.js');
const queueFunctions = functionsByName(queueParsed);
const queueSource = queueParsed.source;
const changeQueueStart = queueSource.indexOf('var ChangeQueue = (function()');
const changeQueueEnd = queueSource.indexOf('var AccountingSystem = (function()', changeQueueStart);
check(changeQueueStart >= 0 && changeQueueEnd > changeQueueStart, 'internal ChangeQueue boundary is locatable');
const internalQueueSource = queueSource.slice(changeQueueStart, changeQueueEnd);
check(!/processChangeQueue\s*\(/.test(internalQueueSource), 'internal ChangeQueue must not consume the reactive GM._changeQueue');
const reactiveFn = queueFunctions.get('processChangeQueue');
check(!!reactiveFn && !/\bChangeQueue\b/.test(queueSource.slice(reactiveFn.start, reactiveFn.end)), 'reactive queue consumer must not call internal ChangeQueue');
if (reactiveFn) {
  const reactiveSource = queueSource.slice(reactiveFn.start, reactiveFn.end);
  check(/_abortReactiveCascade/.test(reactiveSource) && /REACTIVE_CASCADE_MAX_BATCHES/.test(reactiveSource)
    && /REACTIVE_CASCADE_MAX_EVENTS/.test(reactiveSource), 'reactive queue must terminate cross-microtask cascades with batch/event epochs');
  check(/REACTIVE_YIELD_EVERY_BATCHES/.test(reactiveSource) && /_scheduleReactiveQueue/.test(reactiveSource), 'reactive queue must yield long cascades to the macrotask queue');
}
check(/REACTIVE_CASCADE_DIAGNOSTIC_LIMIT\s*=\s*128/.test(queueSource) && /function getReactiveQueueDiagnostics/.test(queueSource),
  'reactive cascade abort diagnostics must remain bounded and inspectable');
check(!/Number\s*\([^)]*\)\s*\|\|\s*0/.test(internalQueueSource), 'internal ChangeQueue must not coerce invalid numbers to zero');
check(/_finalizeQueuedFailure\s*\(originalQueue,\s*change,\s*exceptionFailure/.test(internalQueueSource), 'ChangeQueue exception path must settle attempts through the shared retry/dead-letter boundary');
['_handlerTreasury', '_handlerVariable', '_handlerCharacter', '_handlerFaction', '_handlerProvince', '_handlerNation'].forEach((name) => {
  const fn = queueFunctions.get(name);
  check(!!fn, 'missing ChangeQueue handler ' + name);
  if (!fn) return;
  let bareReturn = false;
  traverse(fn.body, {
    ReturnStatement(node, _state, ancestors) {
      const owner = [...ancestors].reverse().find((ancestor) => /Function/.test(ancestor.type));
      if ((!owner || owner === fn) && !node.argument) bareReturn = true;
    }
  });
  check(!bareReturn, name + ' contains a bare return that can be counted as false success');
});

const writebackParsed = parse('tm-endturn-apply-stages.js');
const writebackFunctions = functionsByName(writebackParsed);
const coreApply = writebackFunctions.get('_applyCore_reconcile');
check(!!coreApply, 'main writeback stage is locatable');
if (coreApply) {
  const coreSource = writebackParsed.source.slice(coreApply.start, coreApply.end);
  check(coreSource.indexOf('_validateAndRepairMainWriteback') >= 0
    && coreSource.indexOf('_validateAndRepairMainWriteback') < coreSource.indexOf('applyAITurnChanges'), 'strict preflight must precede the atomic applier');
  check(/_strictValidation\s*:\s*true/.test(coreSource) && /throw\s+new Error\(['\"]AI 主写回未能原子提交/.test(coreSource), 'main writeback retains all-or-nothing rejection semantics');
  check(!/ignore(?:Failures?|Errors?)|partialCommit|continueOnError/i.test(coreSource), 'main writeback must not enable partial success');
}
const targetedRepair = writebackFunctions.get('_applyTargetedWritebackRepairs');
check(!!targetedRepair, 'targeted writeback repair boundary is locatable');
if (targetedRepair) {
  const repairSource = writebackParsed.source.slice(targetedRepair.start, targetedRepair.end);
  check(/repair-target-not-allowed/.test(repairSource) && /duplicate-repair-target/.test(repairSource), 'targeted repairs must enforce failure-slot allowlist and uniqueness');
  check(/_repairPreservesSemantics/.test(repairSource) && /repair-changed-business-semantics/.test(repairSource), 'targeted repairs must reject non-identity semantic changes in code');
}

const authoringUiParsed = parse('editor-authoring-agent-ui.js');
const authoringUiFunctions = functionsByName(authoringUiParsed);
['_commitUserWrite', 'rememberConvention', 'showConventionsUI', 'showMemoriesUI', 'showSkillsUI', 'showPacksUI'].forEach((name) => {
  const fn = authoringUiFunctions.get(name);
  check(!!fn, 'missing guarded authoring write function ' + name);
  if (!fn || name === '_commitUserWrite') return;
  const fnSource = authoringUiParsed.source.slice(fn.start, fn.end);
  check(/_commitUserWrite\s*\(/.test(fnSource), name + ' must route user-visible writes through the confirmed commit boundary');
});
const authoringUiSource = authoringUiParsed.source;
check(!/try\s*\{[^{}]*AA\.(?:memories\.remove|skills\.remove|packs\.(?:setEnabled|remove|importJSON))\s*\([^{}]*\)\s*;?\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}/.test(authoringUiSource),
  'authoring user writes must not return to empty-catch false-success handling');

const mapCoreParsed = parse('map-editor-core.js');
const mapCoreFunctions = functionsByName(mapCoreParsed);
const mapOn = mapCoreFunctions.get('on');
const mapOff = mapCoreFunctions.get('off');
const mapFire = mapCoreFunctions.get('fire');
check(!!mapOn && !!mapOff && !!mapFire, 'map editor event hub must expose on/off/fire lifecycle functions');
if (mapOn) check(/return function unsubscribe/.test(mapCoreParsed.source.slice(mapOn.start, mapOn.end)), 'map editor on() must return an unsubscribe disposer');
if (mapFire) check(/\.slice\s*\(\s*\)/.test(mapCoreParsed.source.slice(mapFire.start, mapFire.end)), 'map editor fire() must dispatch over a stable listener snapshot');
check(/\bon\s*:\s*on\s*,[\s\S]{0,80}\boff\s*:\s*off\s*,[\s\S]{0,80}\bfire\s*:\s*fire/.test(mapCoreParsed.source), 'map editor public event hub must publish off() alongside on()/fire()');

const bookmarksParsed = parse('map-editor-bookmarks.js');
const bookmarkFunctions = functionsByName(bookmarksParsed);
const bookmarkInit = bookmarkFunctions.get('init');
const bookmarkDispose = bookmarkFunctions.get('dispose');
const bookmarkBindKeys = bookmarkFunctions.get('bindKeys');
check(!!bookmarkInit && !!bookmarkDispose && !!bookmarkBindKeys, 'bookmark feature must expose explicit init/dispose/key binding boundaries');
if (bookmarkInit) {
  const source = bookmarksParsed.source.slice(bookmarkInit.start, bookmarkInit.end);
  check(/if\s*\(\s*_initialized\s*\)\s*return false/.test(source), 'bookmark init must be idempotent');
  check(/_cameraTimer\s*=\s*setInterval/.test(source) && /_offMapLoaded\s*=\s*ME\.on/.test(source), 'bookmark init must retain timer and map subscription handles');
}
if (bookmarkDispose) {
  const source = bookmarksParsed.source.slice(bookmarkDispose.start, bookmarkDispose.end);
  check(/clearInterval\s*\(\s*_cameraTimer\s*\)/.test(source), 'bookmark dispose must clear its camera timer');
  check(/removeEventListener\s*\(\s*['"]keydown['"]\s*,\s*_keydownHandler\s*\)/.test(source), 'bookmark dispose must remove its key listener');
  check(/_offMapLoaded\s*\(\s*\)/.test(source), 'bookmark dispose must unsubscribe from map-loaded');
}
check(/dispose\s*:\s*dispose/.test(bookmarksParsed.source) && /isInitialized\s*:/.test(bookmarksParsed.source), 'bookmark public API must expose lifecycle controls');

const runtimeFiles = fs.readdirSync(WEB).filter((name) => name.endsWith('.js'));
runtimeFiles.forEach((file) => {
  const parsed = parse(file);
  let adds = 0;
  let removes = 0;
  traverse(parsed.ast, {
    CallExpression(call) {
      const event = call.arguments[0];
      if (!event || event.type !== 'Literal' || event.value !== 'abort') return;
      const prop = propertyName(call.callee);
      if (prop === 'addEventListener') adds++;
      if (prop === 'removeEventListener') removes++;
    }
  });
  if (adds) check(removes >= adds, file + ' adds ' + adds + ' abort listeners but exposes only ' + removes + ' cleanup calls');
});

const infraParsed = parse('tm-ai-infra.js');
const infraFunctions = functionsByName(infraParsed);
['_aiFetchWithRetryInner', '_toolFetchQueued', '_callAIMessagesStreamDirect'].forEach((name) => {
  const fn = infraFunctions.get(name);
  check(!!fn, 'missing abort-cleanup guarded function ' + name);
  if (!fn) return;
  let adds = 0;
  let removes = 0;
  let finallyRemoves = 0;
  directCalls(fn, (call, callAncestors) => {
    const event = call.arguments[0];
    if (!event || event.type !== 'Literal' || event.value !== 'abort') return;
    const prop = propertyName(call.callee);
    if (prop === 'addEventListener') adds++;
    if (prop === 'removeEventListener') {
      removes++;
      if (callAncestors.some((ancestor) => ancestor.type === 'TryStatement' && ancestor.finalizer
        && call.start >= ancestor.finalizer.start && call.end <= ancestor.finalizer.end)) finallyRemoves++;
    }
  });
  check(adds === 1 && removes === 1 && finallyRemoves === 1, name + ' must pair its abort listener in finally');
});

const rootDir = path.resolve(WEB, '..');
const mainSource = fs.readFileSync(path.join(rootDir, 'main-impl.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(rootDir, 'preload-impl.js'), 'utf8');
const saveLifecycleSource = read('tm-save-lifecycle.js');
const saveCloseFlushSource = read('tm-save-close-flush.js');
const reconcileSource = read('generated/tm-ai-change-applier.bundle.js');
const endturnApplySource = read('tm-endturn-apply.js');
check(/ipcMain\.handle\('app-quit',\s*\(\)\s*=>\s*requestApplicationQuit\(/.test(mainSource),
  'renderer quit requests must pass through the background-save close handshake');
check(/mainWindow\.on\('close',\s*event\s*=>[\s\S]*?event\.preventDefault\(\)[\s\S]*?requestApplicationQuit\('window-close'\)/.test(mainSource),
  'native window close must be intercepted until the renderer flush acknowledgement completes');
check(/app-close-flush-request/.test(mainSource) && /app-close-flush-complete/.test(mainSource),
  'main process must retain the bounded close-flush request/ack protocol');
check(/onAppCloseFlushRequest[\s\S]*?_subscribeAppCloseFlush/.test(preloadSource)
  && /app-close-flush-complete/.test(preloadSource),
  'preload must expose only the bounded close-flush bridge and acknowledgement');
check(/_tmInstallDesktopCloseFlushBridge/.test(saveCloseFlushSource)
  && /_tmFlushBackgroundAutosavesForClose/.test(saveCloseFlushSource),
  'desktop save lifecycle must install the close-time background queue drain');
check(/ipcMain\.handle\('hot-update-reload',[\s\S]{0,800}requestApplicationRelaunch\('hot-update-reload'\)/.test(mainSource)
  && !/app\.exit\s*\(/.test(mainSource),
  'hot-update relaunch must use the save-aware lifecycle coordinator and never bypass it with app.exit');
check(/ipcMain\.handle\('update-install',[\s\S]{0,500}requestApplicationUpdateInstall\('installer-update'\)/.test(mainSource),
  'installer update must use the same renderer save handshake before quitAndInstall');
check(/_autoSaveInFlightPromise/.test(saveLifecycleSource)
  && /flushForClose[\s\S]{0,1200}awaitDesktopAutoSave\('application-close'\)/.test(saveCloseFlushSource),
  'close acknowledgement must await the tracked desktop autosave mirror after canonical saves drain');
check(/for \(var pass=1;pass<=4;pass\+\+\)/.test(saveCloseFlushSource)
  && /await Promise\.resolve\(\)/.test(saveCloseFlushSource)
  && /closeSaveQueuesQuiet\(\)/.test(saveCloseFlushSource)
  && /close-save-quiescence-limit/.test(saveCloseFlushSource),
  'close acknowledgement must prove bounded canonical and desktop queue quiescence');
check(/factionId\s*:\s*String\(fac\.id\)/.test(reconcileSource)
  && /newLeaderId\s*:\s*String\(leader\.id\)/.test(reconcileSource)
  && /_tmExactFaction\(sc\.factionId \|\| sc\.faction\)/.test(endturnApplySource)
  && /sc\.newLeaderId \|\| sc\.newLeader/.test(endturnApplySource),
  'faction succession must preserve stable faction and leader identities through the production consumer');

if (failures.length) {
  console.error('[lint-renderer-writeback-boundaries] FAIL ' + failures.length + '/' + checks);
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}
console.log('[lint-renderer-writeback-boundaries] PASS checks=' + checks);
