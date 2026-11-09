#!/usr/bin/env node
'use strict';
// 人物记忆里的「天下大势」与「铭记」（getMemoryContext 读的这几段只进人物记忆）：写朝中能知道的、写中文（2026-11-09）
//   · 民心写呈报上来的数，不写真值、不点破虚报；皇威不写「感知 X — 可能被扭曲」这句旁白。
//   · 本位制、海外银流、纸币状态、气候、户口的朝代、兵种：英文代号写中文，认不出的不写；严重疤痕写区划名。
//   · 铭记：开局前的事写「开局前」（原来写 T-1800，0 回合的还写成当前回合）；类型写中文，general 不写。
// 天启真档原来写的是「本位制：silver_copper_paper」「海外银流：restrictive」「朝代：default」「气候：normal」
// 「【民心】真实 47 (民疑) 感知 54（虚报）」「①T-1800 类型:general ……」。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; console.log('  ✓ ' + m); };
function load(files) {
  const c = { console: { log() {}, warn() {}, error() {} }, Math, Date, JSON };
  c.window = c; c.globalThis = c; c.global = c;
  vm.createContext(c);
  files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), c, { filename: f }));
  return c;
}
const ENGLISH = /[a-z]{4,}/;  // 英文代号（这几段里本该一个都没有）

// ── 1. 皇威、民心 ──
{
  const c = load(['tm-authority-engines.js']);
  c.GM = { huangwei: { index: 70, perceivedIndex: 86 }, huangquan: { index: 75 }, minxin: { trueIndex: 47, perceivedIndex: 54, phase: 'uneasy' } };
  const t = c.AuthorityEngines.getAuthorityAIContext();
  ok(t.includes('【民心】54 (民疑)') && !/真实|虚报|感知/.test(t), '民心写呈报上来的数，不写真值、不点破虚报');
  ok(t.includes('【皇威】70') && !t.includes('扭曲'), '皇威不写「可能被扭曲」的旁白');
  c.GM.minxin = { trueIndex: 38, perceivedIndex: 45, phase: 'angry' };
  ok(c.AuthorityEngines.getAuthorityAIContext().includes('【民心】45 (民疑)'), '民心的档也按呈报的数定（真值 38 是民怨，报上来 45 是民疑）');
  c.GM.minxin = { trueIndex: 47, phase: 'uneasy' };
  ok(c.AuthorityEngines.getAuthorityAIContext().includes('【民心】47 (民疑)'), '还没有呈报的数时写真值');
}

// ── 2. 货币 ──
{
  const c = load(['tm-economy-engine-currency.js']);
  const cur = { currentStandard: 'silver_copper_paper', dynasty: '明', market: { grainPrice: 95, inflation: 0, yearFortune: 1.05 }, coins: {},
    paper: { issuances: [{ name: '大明宝钞', state: 'depreciate', reserveRatio: 0.1, creditLevel: 20 }, { name: '某钞', state: 'odd_state', reserveRatio: 0.2, creditLevel: 50 }] },
    foreignFlow: { enabled: true, tradeMode: 'restrictive', cumulativeNet: 0 } };
  c.GM = { currency: cur };
  const t = c.CurrencyEngine.getAIContext();
  ok(t.includes('本位制：白银、铜钱、纸钞并行；朝代：明'), '本位制写中文');
  ok(t.includes('海外银流：限制通商，累计净流 0 两'), '海外银流写中文');
  ok(t.includes('大明宝钞（贬值，准备金 10%') && t.includes('某钞（准备金 20%'), '纸币状态写中文，认不出的不写');
  ok(!ENGLISH.test(t), '货币一段没有英文代号');
  cur.currentStandard = 'shell_money'; cur.dynasty = 'default'; cur.foreignFlow.tradeMode = 'odd_mode';
  const t2 = c.CurrencyEngine.getAIContext();
  ok(!/本位制|朝代/.test(t2) && t2.includes('海外银流：累计净流 0 两') && !ENGLISH.test(t2), '认不出的本位制、通商方式、非中文朝代不写');
}

// ── 3. 环境承载力（严重疤痕借央地的 regionLabel 写区划名） ──
{
  const c = load(['tm-economy-engine-currency.js', 'tm-economy-engine.js', 'tm-central-local-engine.js']);
  c.GM = { turn: 5, adminHierarchy: { player: { divisions: [{ id: 'circuit-aa', name: '关内道' }] } },
    environment: { nationalLoad: 0.5, climatePhase: 'little_ice_age', crisisHistory: [], activePolicies: [],
      byRegion: { 'circuit-aa': { ecoScars: { deforestation: 0.6 } }, 'circuit-bb': { ecoScars: { soilErosion: 0.7 } } } } };
  const t = c.EnvCapacityEngine.getAIContext();
  ok(t.includes('全国加载比：50% · 气候：偏寒'), '气候写中文');
  ok(t.includes('严重疤痕：关内道 森林退化 60%') && !t.includes('circuit'), '严重疤痕写区划名，查不到名字的不写编号');
  c.GM.adminHierarchy = null;
  c.GM.environment.climatePhase = 'odd_phase';
  const t2 = c.EnvCapacityEngine.getAIContext();
  ok(!t2.includes('严重疤痕') && !t2.includes('气候') && !ENGLISH.test(t2), '查不到名字、只剩编号的疤痕不写；认不出的气候不写');
}

// ── 4. 户口 ──
{
  const c = load(['tm-huji-engine.js']);
  c.GM = { turn: 5, population: { dynasty: 'default', national: { households: 18106000, mouths: 94150000, ding: 24479000 },
    military: { types: { odd_troop: { enabled: true, strength: 5000 } } } } };
  const t = c.HujiEngine.getAIContext();
  ok(t.startsWith('【户口】\n全国：户 ') && !t.includes('朝代') && !ENGLISH.test(t), '户口的朝代、兵种是英文代号就不写');
}

// ── 5. 铭记 ──
{
  const c = load(['tm-mechanics-memory.js']);
  c.GM = { turn: 5, chars: [{ name: '魏忠贤', alive: true, _memory: [
    { event: '诱帝赐姓', turn: -1800, importance: 9, type: 'general', emotion: '喜' },
    { event: '客氏被逐', turn: 0, importance: 8, emotion: '恐' },
    { event: '乾清宫密对', turn: 3, importance: 7, type: 'dialogue', emotion: '敬', who: '朱由检' },
    { event: '某事', turn: 2, importance: 6, type: 'odd_code' }] }] };
  const t = c.NpcMemorySystem.getMemoryContext('魏忠贤');
  ok(t.includes('铭记：①开局前 诱帝赐姓(喜,重9) ②开局前 客氏被逐(恐,重8) ③T3〔对谈〕乾清宫密对(朱由检)(敬,重7) ④T2 某事(平,重6)'),
    '铭记：开局前的事写「开局前」（0 回合的不再写成当前回合），类型写中文，general 和认不出的不写');
  ok(!/T-|T5|类型|general|odd/.test(t), '铭记里没有负回合、没有英文类型');
}

console.log('[smoke-memory-world-context] pass assertions=' + checks);
