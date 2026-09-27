#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), acorn = require('acorn');
const ROOT = path.resolve(__dirname, '..');
const retired = ['factionLivingWorldDefault','agentLiveWorldEnabled','factionAgentEnabled','factionGoalStackEnabled','revoltEntityEnabled','useTinyiV3','deterministicCasualties','partyClassLlmEnabled','npcAiPrecision'];
let checks = 0;
function ok(v, name) { assert(v, name); checks++; }
function source(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function nodes(file, predicate) {
  const text = source(file), result = [], ast = acorn.parse(text, { ecmaVersion: 'latest' });
  function walk(n) { if (!n || typeof n !== 'object') return; if (predicate(n)) result.push(text.slice(n.start, n.end)); for (const [k,v] of Object.entries(n)) if (!['start','end'].includes(k)) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); } }
  walk(ast); return result;
}
function ctx(extra) {
  const c = Object.assign({ console, P: { conf: {}, ai: {} }, GM: {}, setTimeout() {}, clearTimeout() {}, fetch() { throw Error('No real API calls allowed'); } }, extra);
  c.window = c; c.global = c; c.globalThis = c; vm.createContext(c); return c;
}
function load(c, f) { vm.runInContext(source(f), c, { filename: f }); }
function flags(off) { return Object.fromEntries(retired.map(k => [k, off])); }
for (const mode of ['llm', 'agent']) {
  const c = ctx({ P: { conf: Object.assign(flags(false), { experimentalEnabled: true, experimentalMode: mode }), ai: flags(false) }, GM: { _factionLivingWorld: false, _factionLivingWorldSetByUser: true } });
  load(c, 'tm-agent-flags.js');
  ok(c.agentFlagOn('factionAgentEnabled') && c.agentFlagOn('factionGoalStackEnabled'), mode + ': saved off flags cannot disable faction world');
  ok(c.agentLiveWorldOn() === (mode === 'agent'), mode + ': agent-side ownership remains mode-specific');
  ok(!c.agentFlagOn('reflectionAgentEnabled'), mode + ': unrelated experimental agent remains optional');
  load(c, 'tm-revolt-entity.js'); load(c, 'tm-captive-court.js');
  ok(c.TM.RevoltEntity.enabled() && c.TM.CaptiveCourt.enabled(), mode + ': revolts and their consequences remain core');
  load(c, 'tm-faction-npc-settings.js');
  ok(!c.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'missing API still prevents AI calls');
  c.P.ai.key = 'offline-fixture';
  ok(c.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'configured NPC real decision ignores old off flag');
  c.TM.FactionNpcSettings.setEnabled(false);
  ok(c.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'obsolete NPC setter cannot stop formal decisions');
}
{
  const c = ctx({ P: { conf: { useTinyiV3: false } }, CY: {}, opened: [], _cy_pickMode(mode) { this.opened.push('other:' + mode); }, _ty3_open() { c.opened.push('eight-stage'); } });
  const code = nodes('tm-tinyi-v3.js', n => n.type === 'CallExpression' && n.callee.type === 'FunctionExpression' && n.callee.id?.name === '_ty3_overrideTinyiRoute')[0];
  vm.runInContext(code, c); c._cy_pickMode('tinyi'); c._cy_pickMode('changchao');
  ok(c.opened.join(',') === 'eight-stage,other:changchao', 'Tinyi always routes to eight stages, other court modes retained');
}
{
  const c = ctx({ P: { conf: Object.assign(flags(false), { _saveSchemaVersion: '1.3.0-ai-upgrade', marchSystemEnabled: false, reportedViewEnabled: false, npcAiPrecisionMaxPerTurn: 3 }), ai: flags(false), battleConfig: { deterministicCasualties: false } }, GM: { _factionLivingWorld: false, _factionLivingWorldSetByUser: true, guoku: { money: 123 } } });
  const file = 'tm-save-lifecycle.js';
  const declarations = nodes(file, n => n.type === 'VariableDeclaration' && n.declarations.some(d => ['SAVE_SCHEMA_VERSION','_MIGRATIONS'].includes(d.id.name)));
  const functions = nodes(file, n => n.type === 'FunctionDeclaration' && ['_tmReconcileFactionLivingWorld','runMigrations'].includes(n.id.name));
  vm.runInContext(declarations.join('\n') + '\n' + functions.join('\n'), c); c.runMigrations(c.P, c.GM);
  ok(retired.every(k => !(k in c.P.conf) && !(k in c.P.ai)), 'legacy settings removed from both namespaces');
  ok(c.GM._factionLivingWorld === true && !('_factionLivingWorldSetByUser' in c.GM), 'saved world flag migrates to formal rule');
  ok(c.P.conf.marchSystemEnabled === false && c.P.conf.reportedViewEnabled === false, 'optional opt-outs survive migration');
  ok(c.GM.guoku.money === 123 && c.P.conf.npcAiPrecisionMaxPerTurn === 3, 'migration preserves treasury and cost budgets');
  const before = JSON.stringify({ P:c.P, GM:c.GM }); c.runMigrations(c.P, c.GM);
  ok(JSON.stringify({ P:c.P, GM:c.GM }) === before, 'migration is idempotent');
}
{
  const c = ctx(); load(c, 'tm-office-flags.js');
  ok(c.TM.OfficeFlags.masterOn() && c.TM.OfficeFlags.LIST.every(k => c.officeFlagOn(k)), 'office activation defaults on for its declared components');
  c.P.conf.officeActivationEnabled = false; c.P.ai.officeActivationEnabled = true;
  ok(!c.TM.OfficeFlags.masterOn() && !c.officeFlagOn('officeDutyStateEnabled'), 'explicit settings opt-out wins over legacy AI namespace');
  load(c, 'tm-reported-view.js'); c.P.conf.gameMode = 'strict_hist';
  ok(c.TM.ReportedView.active(), 'reported view defaults on in strict history');
  c.P.conf.gameMode = 'yanyi'; ok(!c.TM.ReportedView.active(), 'reported view never activates in narrative mode');
  c.P.conf.gameMode = 'strict_hist'; c.P.conf.reportedViewEnabled = false; ok(!c.TM.ReportedView.active(), 'reported opt-out remains effective');
  load(c, 'tm-conspiracy.js'); ok(c.ConspiracyEngine._agencyWatchOn(), 'agency watch defaults on');
  c.P.conf.agencyWatchEnabled = false; ok(!c.ConspiracyEngine._agencyWatchOn(), 'agency opt-out retained');
  load(c, 'tm-keju-scandal.js'); c._kjInitScandalState(); ok(!!c.GM.keju?._scandal, 'scandal defaults on');
}
function settings(conf, overrides) {
  const elements = {}, element = () => ({ innerHTML:'', value:'', style:{}, classList:{add(){},remove(){}}, querySelectorAll(){return [];} });
  const c = ctx({ P: Object.assign({ conf: conf || {}, ai: {}, keju:{} }, overrides || {}), localStorage:{getItem(){return null;}}, document:{getElementById(id){return elements[id]||(elements[id]=element());}},
    _$(id){return elements[id]||(elements[id]=element());}, escHtml:v=>String(v==null?'':v), _tmUiFontScaleDefault:()=>1.2,
    _sProvOptions:()=>'', _sAiVirgin:()=>true, _renderSettingsAudioSection:()=>'', _renderSettingsThemeFontSection:()=>'', _renderModelProbePanel:()=>'', DEFAULT_PROMPT:'', DEFAULT_RULES:'' });
  load(c,'tm-office-flags.js'); load(c,'tm-agent-flags.js');
  const expression = nodes('tm-patches.js', n=>n.type==='AssignmentExpression' && n.left.type==='MemberExpression' && n.left.object.name==='b' && n.left.property.name==='innerHTML')[0];
  ok(!!expression, 'settings render expression found');
  vm.runInContext('var b = _$("sb2");' + expression + ';', c);
  return {html:elements.sb2.innerHTML,c};
}
for (const mode of ['none','llm','agent']) {
  const {html} = settings(Object.assign(flags(false), mode==='none'?{}:{experimentalEnabled:true,experimentalMode:mode}));
  for (const id of ['s-npc-ai','s-revolt-entity','s-tinyi-v3','s-det-cas','s-party-class-llm','s-agent-liveworld','s-livingworld-master']) ok(!html.includes('id="'+id+'"'), mode+': promoted control absent '+id);
  ok(!html.includes('data-slhs=') && !html.includes('势力活世界 · 实验'), mode+': faction world settings section removed');
  ok(html.includes('id="s-npc-polish"') && html.includes('id="s-party-inference"'), mode+': unselected polish and party actions remain optional');
  ok(/<input[^>]*id="s-office-activation"[^>]*checked/.test(html), mode+': office master visible and enabled without experimental gate');
  for (const key of ['marchSystemEnabled','disasterSimEnabled','agencyWatchEnabled','reportedViewEnabled','useNewKejuScandal']) {
    const input = (html.match(/<input\b[^>]*>/g)||[]).find(tag=>tag.includes(key));
    ok(input && /\schecked(?:\s|=|>)/.test(input), mode+': optional default checked '+key);
  }
}
{
  const optional = ['marchSystemEnabled','disasterSimEnabled','agencyWatchEnabled','reportedViewEnabled','useNewKejuScandal','officeActivationEnabled'];
  const {html} = settings(Object.fromEntries(optional.map(k=>[k,false])));
  const inputs = html.match(/<input\b[^>]*>/g)||[];
  for(const key of optional) ok(!/\schecked(?:\s|=|>)/.test(inputs.find(tag=>tag.includes(key))), 'explicit optional opt-out shown unchecked '+key);
  const old = settings({}, {ai:{agencyWatchEnabled:false},battleConfig:{marchConfig:{enabled:false}}}).html;
  for(const key of ['agencyWatchEnabled','marchSystemEnabled']) ok(!/\schecked(?:\s|=|>)/.test(old.match(/<input\b[^>]*>/g).find(tag=>tag.includes(key))), 'legacy preference or scenario restriction shown unchecked '+key);
}
{
  const view=settings({}), c=view.c; let reopened='';
  c.saveP=()=>{}; c.toast=()=>{}; c.closeSettings=()=>{};
  c.openSettings=()=>{reopened=settings(c.P.conf).html;};
  vm.runInContext(nodes('tm-player-settings.js',n=>n.type==='FunctionDeclaration'&&n.id.name==='_togglePConf')[0],c);
  const tag=view.html.match(/<input[^>]*id="s-office-activation"[^>]*>/)[0];
  const handler=tag.match(/onchange="([^"]+)"/)[1];
  vm.runInContext('(function(){'+handler+'}).call({checked:false})',c);
  ok(c.P.conf.officeActivationEnabled===false && reopened.length>0,'office master opt-out refreshes its dependent controls immediately');
  const child=reopened.match(/<input\b[^>]*>/g).find(x=>x.includes('officeDutyStateEnabled'));
  ok(!/\sdisabled(?:\s|=|>)/.test(child) && !/\schecked(?:\s|=|>)/.test(child),'office child becomes editable and reflects its own setting after master opt-out');
}
console.log('[smoke-gameplay-promotion] PASS ' + checks + ' assertions');
