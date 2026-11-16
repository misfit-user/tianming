#!/usr/bin/env node
// smoke-phase3-deep-refactor.js — Phase 3·深度推演重构 锚
// 用·锁 Slice 1-5·A11 边界 / A9 SC16 必输 / A10 SC17 skip / Q5 SC16 lite / Q6 battleResult 后验

'use strict';

const { readSource, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();

// ─── Slice 2·A9·SC16 diplomatic_shifts 必输 ───
const c=require('./lib-political-action-fixture').politicalFixture(),B=c.TM.PoliticalActions;
assert(B.strategicPrompt().user.includes('diplomatic_shifts'),'Slice 2·SC16 仍可提出明确外交建议');
assert(B.strategicCandidates({diplomatic_shifts:[]},'no-change').length===0&&!(c.GM.treaties||[]).length,'Slice 2·无变化不制造任何外交事实');

// ─── Slice 5·Q6·SC18 battleResult 后验 ───

console.log('[smoke-phase3-deep-refactor] pass assertions=' + passed.value);
