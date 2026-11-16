#!/usr/bin/env node
'use strict';
// smoke-fake-numbers-fix — 验证「假数字治理」(#6·2026-06-15)
//   ① 征兵效率成真：_conscriptEffMult 真 scale 募兵池上限（capRecruitDelta）·缺省=1 不改旧行为
//   ② 征税效率撤显示：var-drawers 不再渲染「征税效率」假数字·「征兵效率」（现已真）保留
// 用 require 真模块实跑 capRecruitDelta（非重新实现）

const fs = require('fs');
const path = require('path');
const WEB = path.resolve(__dirname, '..');
const FP = require(path.join(WEB, 'tm-field-pipelines.js'));

let passed = 0;
function assert(c, m){ if(!c) throw new Error('[assert] ' + m); passed++; }

function mk(pool, minxin){ return { name: '陕西', minxin: minxin == null ? 60 : minxin, militaryDetail: { availableRecruits: pool }, populationDetail: { ding: 100000 } }; }
// 区划只留游戏里那份（GM·2026-11-15）：征兵池读 GM 的区划；助手把这块地挂到传进来的 gm 上，P 只是空壳
function P(div, gm){ if (gm) gm.adminHierarchy = { player: { divisions: [div] } }; return {}; }

// ① 缺省（_conscriptEffMult undefined）→ effCap === rawCap（零行为变化·防回归）
{
  const div = mk(3000), gm = { turn: 5 };
  const r = FP.capRecruitDelta(gm, P(div, gm), '陕西', 2000);
  assert(r && r.cap === 3000 && r.rawCap === 3000, '缺省效率→池上限不变（3000）');
  assert(r.conscriptEff === 1, '缺省效率=1');
  assert(r.approved === 2000 && r.overdraft === 0, '池内足额募 2000');
}

// ② 低征兵效率（民心崩）→ 池上限真缩水
{
  const div = mk(2000), gm = { turn: 5, _conscriptEffMult: 0.5 };
  const r = FP.capRecruitDelta(gm, P(div, gm), '陕西', 2000);
  assert(r.cap === 1000, '效率 0.5→有效池 2000×0.5=1000（实 ' + r.cap + '）');
  assert(r.approved === 1000 && r.overdraft === 1000, '只募满 1000·超额 1000');
  assert(r.conscriptEff === 0.5, '效率值回传 0.5');
}

// ③ 高征兵效率（民心盛）→ 池上限真扩
{
  const div = mk(1000), gm = { turn: 5, _conscriptEffMult: 1.25 };
  const r = FP.capRecruitDelta(gm, P(div, gm), '陕西', 2000);
  assert(r.cap === 1250, '效率 1.25→有效池 1000×1.25=1250（实 ' + r.cap + '）');
  assert(r.approved === 1250, '可募至 1250（>原池 1000·民心盛则踊跃应募）');
}

// ④ clamp：极端值被夹（0.3~1.3）
{
  const divLo = mk(1000), gmLo = { turn: 5, _conscriptEffMult: 0.05 };
  const rLo = FP.capRecruitDelta(gmLo, P(divLo, gmLo), '陕西', 2000);
  assert(rLo.conscriptEff === 0.3, '过低效率夹到地板 0.3');
  const divHi = mk(1000), gmHi = { turn: 5, _conscriptEffMult: 5 };
  const rHi = FP.capRecruitDelta(gmHi, P(divHi, gmHi), '陕西', 2000);
  assert(rHi.conscriptEff === 1.3, '过高效率夹到天花板 1.3');
}

// ⑤ 低效率 → 超额募兵 → 民心叶账立扣（既有强征机制照常·基于缩水后的池）
{
  const div = mk(2000, 60), gm = { turn: 5, _conscriptEffMult: 0.5 };
  FP.capRecruitDelta(gm, P(div, gm), '陕西', 2000); // effCap 1000·overdraft 1000
  assert(div.minxin < 60, '低效率致超额→强征扰民·民心叶账下扣（' + div.minxin + '<60）');
}

// ⑥ 源契约：假数字治理落地
{
  const vd = fs.readFileSync(path.join(WEB, 'tm-var-drawers.js'), 'utf8');
  assert(!/vd-ov-label">征税效率</.test(vd), '「征税效率」假显示已撤（无安全 income hook·避免假反馈）');
  assert(/vd-ov-label">征兵效率</.test(vd), '「征兵效率」保留（已接 capRecruitDelta 成真）');
  const fp = fs.readFileSync(path.join(WEB, 'tm-field-pipelines.js'), 'utf8');
  assert(/_conscriptEffMult/.test(fp) && /effCap/.test(fp), 'capRecruitDelta 真读 _conscriptEffMult');
}

console.log('PASS smoke-fake-numbers-fix · ' + passed + ' 断言');
