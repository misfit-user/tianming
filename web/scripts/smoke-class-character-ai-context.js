#!/usr/bin/env node
// smoke-class-character-ai-context.js - class backing reaches NPC/persona AI context.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  window: {},
  TM: {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-prompt-composer.js'), 'utf8'), sandbox, { filename: 'tm-prompt-composer.js' });

const Composer = sandbox.TM && sandbox.TM.PromptComposer;
assert(Composer && typeof Composer.buildAiPersonaText === 'function', 'PromptComposer.buildAiPersonaText should exist');

const text = Composer.buildAiPersonaText({
  id: 'char-qian',
  name: '\u94b1\u8c26\u76ca',
  socialCapital: 71,
  classPressure: 38,
  classSupportSummary: '\u58eb\u7ec5(\u4ee3\u8868/\u4fe176)',
  classOppositionSummary: '\u519b\u6237(\u538b\u529b/\u602861)',
  classBackings: [
    {
      className: '\u58eb\u7ec5',
      role: 'spokesperson',
      trust: 0.76,
      grievance: 0.08,
      evidence: ['\u79d1\u4e3e\u5ef7\u8bae\u4ee3\u58eb\u6797\u53d1\u58f0']
    },
    {
      className: '\u519b\u6237',
      role: 'suppressor',
      trust: 0.22,
      grievance: 0.61,
      evidence: ['\u963b\u6320\u6b20\u9977\u8bae\u9898']
    }
  ]
}, { maxLen: 400 });

assert(text && text.indexOf('\u9636\u5c42\u653f\u6cbb\u5173\u7cfb') >= 0, 'AI persona context should include class-political relation heading');
assert(text.indexOf('\u793e\u4f1a\u8d44\u672c') >= 0 && text.indexOf('71') >= 0, 'AI persona context should include social capital');
assert(text.indexOf('\u9636\u5c42\u538b\u529b') >= 0 && text.indexOf('38') >= 0, 'AI persona context should include class pressure');
assert(text.indexOf('\u58eb\u7ec5') >= 0 && text.indexOf('\u519b\u6237') >= 0, 'AI persona context should name backing and hostile classes');
assert(text.indexOf('\u79d1\u4e3e\u5ef7\u8bae') >= 0, 'AI persona context should keep evidence');

console.log('[smoke-class-character-ai-context] PASS class-character context reaches AI persona text');
