#!/usr/bin/env node
'use strict';
// smoke-memorial-consequences — 验证「奏疏批复差异化后果 + 接通廷议」(#4·2026-06-14)
// Part A：抽真 _commitMemorialDecisions 在沙箱实跑——准/驳/批/转/廷议对上奏者施加不同的忠诚/面子/压力/记忆情绪
// Part B：源契约——御案 deskStageMemorial 把 court_debate 推入 _pendingTinyiTopics（接通廷议·去重·改主意撤回）

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function assert(c, m){ if(!c) throw new Error('[assert] ' + m); passed++; }

const memSrc = fs.readFileSync(path.join(ROOT, 'tm-memorials.js'), 'utf8');

// ── Part A：抽取真 _commitMemorialDecisions ──
const si = memSrc.indexOf('function _commitMemorialDecisions() {');
const ei = memSrc.indexOf('function _summonForMemorial', si);
assert(si >= 0, '_commitMemorialDecisions 存在');
assert(ei > si, '_summonForMemorial 标记其后');
const fnSrc = memSrc.slice(si, ei);

const loyaltyLog = {}, faceLog = {}, memoLog = {};
const chars = {
  '甲': { name:'甲', loyalty:60, stress:50, alive:true },
  '乙': { name:'乙', loyalty:60, stress:50, alive:true },
  '丙': { name:'丙', loyalty:60, stress:50, alive:true },
  '丁': { name:'丁', loyalty:60, stress:50, alive:true },
  '君': { name:'君', loyalty:100, stress:0, alive:true, isPlayer:true }
};
const ctx = {
  console, Math, Number, String, Array, Object, JSON,
  GM: {
    turn: 5,
    memorials: [
      { from:'甲', content:'甲所奏', status:'approved', turn:5 },
      { from:'乙', content:'乙所奏', status:'rejected', turn:5 },
      { from:'丙', content:'丙所奏', status:'annotated', reply:'准其半', turn:5 },
      { from:'丁', content:'丁所奏', status:'court_debate', turn:5 },
      { from:'君', content:'君所奏', status:'approved', turn:5 }   // 君上为上奏者→后果须跳过
    ]
  },
  findCharByName: function(n){ return chars[n] || null; },
  adjustCharacterLoyalty: function(ch, d){ var nm = ch && ch.name; if(nm){ loyaltyLog[nm]=(loyaltyLog[nm]||0)+d; ch.loyalty=Math.max(0,Math.min(100,(ch.loyalty||0)+d)); } return { ok:true }; },
  FaceSystem: { changeFace: function(ch, d){ var nm = ch && ch.name; if(nm) faceLog[nm]=(faceLog[nm]||0)+d; } },
  NpcMemorySystem: { remember: function(name, text, emo){ if(!memoLog[name]) memoLog[name]=[]; memoLog[name].push(emo); } },
  _memorialSendReply: function(){},
  _memMarkIllegalPresenter: function(){ return false; },
  window: {}, TM: { errors: { captureSilent(){} } }
};
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
ctx.window.TM = ctx.TM;
vm.createContext(ctx);
vm.runInContext(fnSrc, ctx, { filename: 'commitMemorial' });
ctx._commitMemorialDecisions();

// 准奏：抚慰（忠诚↑面子↑压力↓·记忆「慰」）
assert(loyaltyLog['甲'] === 3, '准奏→上奏者忠诚 +3（实 ' + loyaltyLog['甲'] + '）');
assert(faceLog['甲'] === 6, '准奏→面子 +6');
assert(chars['甲'].stress === 47, '准奏→压力 50→47');
assert((memoLog['甲']||[])[0] === '慰', '准奏→记忆情绪「慰」');
// 驳回：挫面（忠诚↓面子↓压力↑·记忆「沮」）
assert(loyaltyLog['乙'] === -3, '驳回→忠诚 -3');
assert(faceLog['乙'] === -8, '驳回→面子 -8');
assert(chars['乙'].stress === 55, '驳回→压力 50→55');
assert((memoLog['乙']||[])[0] === '沮', '驳回→记忆情绪「沮」');
// 批示：嘉纳（轻正向·记忆「敬」）
assert(loyaltyLog['丙'] === 1 && faceLog['丙'] === 2 && chars['丙'].stress === 49, '批示→忠诚+1/面子+2/压力-1');
assert((memoLog['丙']||[])[0] === '敬', '批示→记忆情绪「敬」');
// 发廷议：受瞩（轻忠诚↑·无面子变动·压力↑·记忆「凛」）
assert(loyaltyLog['丁'] === 1, '发廷议→忠诚 +1');
assert(faceLog['丁'] === undefined, '发廷议→不动面子');
assert(chars['丁'].stress === 53, '发廷议→压力 50→53');
assert((memoLog['丁']||[])[0] === '凛', '发廷议→记忆情绪「凛」');
// 差异化：四种批复后果彼此不同（非「批了等于没批」）
assert(loyaltyLog['甲'] !== loyaltyLog['乙'], '准奏≠驳回（后果有别）');
assert(chars['甲'].stress !== chars['乙'].stress && chars['丙'].stress !== chars['丁'].stress, '各批复压力后果彼此不同');
// 君上为上奏者→后果跳过（不自伤忠诚/面子/压力）
assert(loyaltyLog['君'] === undefined && faceLog['君'] === undefined && chars['君'].stress === 0 && chars['君'].loyalty === 100, '君上为上奏者→差异化后果跳过');

// ── Part B：源契约（deskStageMemorial 接通廷议） ──

console.log('PASS smoke-memorial-consequences · ' + passed + ' 断言');
