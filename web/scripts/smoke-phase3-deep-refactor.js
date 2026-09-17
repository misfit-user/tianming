#!/usr/bin/env node
// smoke-phase3-deep-refactor.js — Phase 3·深度推演重构 锚
// 用·锁 Slice 1-5·A11 边界 / A9 SC16 必输 / A10 SC17 skip / Q5 SC16 lite / Q6 battleResult 后验

'use strict';

const fs = require('fs');
const path = require('path');
const { readSource, makeAssert } = require('./smoke-endturn-baseline-helpers');

const ROOT = path.resolve(__dirname, '..');
const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();
const followupSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-followup.js'), 'utf8');

// ─── Slice 1·A11·SC15 边界明文 ───
assert(/Phase 3 A11/.test(followupSrc) || /hidden_moves=本回合发生/.test(followupSrc),
  'Slice 1·SC15 hidden_moves 边界明文 (本回合发生)');
assert(/npc_schemes=酝酿中跨回合/.test(followupSrc) || /酝酿中跨回合阴谋/.test(followupSrc),
  'Slice 1·SC15 npc_schemes 边界明文 (跨回合酝酿)');

// ─── Slice 2·A9·SC16 diplomatic_shifts 必输 ───
assert(/Phase 3 A9·SC16 唯一负责/.test(followupSrc),
  'Slice 2·SC16 diplomatic_shifts 唯一负责 hard rule');
assert(/必输此字段·无外交变化也必须返回 \[\]/.test(followupSrc),
  'Slice 2·SC16 prompt 必输 diplomatic_shifts·无则 []');

// ─── Slice 3·A10·SC17 skip + SC1 economic_advice ───
assert(/Phase 3 A10·SC17 默认 skip/.test(followupSrc),
  'Slice 3·SC17 default skip');
assert(/_sc17Skip\s*=\s*!\(P\.ai\s*&&\s*P\.ai\.sc17Skip\s*===\s*false\)/.test(followupSrc),
  'Slice 3·P.ai.sc17Skip=false 可回滚启用旧路径');
assert(/_sc17Skipped:\s*true/.test(followupSrc),
  'Slice 3·SC17 skip 标记写入 GM._turnAiResults');
assert(/SC1派生/.test(followupSrc),
  'Slice 3·_specialtySummary.sc17 从 SC1.economic_advice 派生');
assert(/economic_advice/.test(src),
  'Slice 3·SC1 prompt 加 economic_advice 字段');

// ─── Slice 4·Q5·SC16 lite variant ───
assert(/Phase 3 Q5·SC16 lite variant/.test(followupSrc),
  'Slice 4·SC16 lite variant');
assert(/_sc16Lite\s*=\s*!!\(P\.ai\s*&&\s*P\.ai\.sc16Lite\s*===\s*true\)/.test(followupSrc),
  'Slice 4·P.ai.sc16Lite flag 开关');
assert(/_liteVariant:\s*true/.test(followupSrc),
  'Slice 4·lite mode 标记写入 GM._turnAiResults.subcall16');

// ─── Slice 5·Q6·SC18 battleResult 后验 ───
const battleContract=fs.readFileSync(path.join(ROOT,'tm-battle-contract.js'),'utf8');
assert(/MilitarySystems\.consumeBattleResults\(p18, GM\)/.test(followupSrc) && /validateBattleResult\(br, G\)/.test(battleContract),
  'Slice 5·battleResult 后验走共享战果校验，不只锁旧注释');
assert(/_battleResultRejected/.test(battleContract),
  'Slice 5·荒诞战役 reject 标记');
assert(/br\.commanderFate/.test(battleContract) && /主将不存在或已故/.test(battleContract),
  'Slice 5·校验 commanderFate.name 存在');
assert(/参战军队不存在/.test(battleContract),
  'Slice 5·校验 affectedArmies.armyId 存在');
assert(/势力不存在/.test(battleContract),
  'Slice 5·校验 winnerFactionId 存在');

console.log('[smoke-phase3-deep-refactor] pass assertions=' + passed.value);
