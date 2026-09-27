#!/usr/bin/env node
// 晚唐只开一局，核当前数据绑定与一回合本道效果；不补剧本缺位。
'use strict';
const assert = require('node:assert/strict');
const { runSuite, assertReadOnly } = require('./lib-circuit-governance-harness');

runSuite('sc-tang840-840', 'smoke-circuit-governor-effects-tang', (world, check) => {
  check('全图本方与各道长官一致，读口不写状态', () => assertReadOnly(world));
  check('一回合履职效果只落本方叶子；缺绑定只记状态', () => {
    const { gm, context } = world, effects = context.TM.CircuitGovernorEffects;
    const result = effects.tick(gm, context.P), rows = Object.values(gm.circuitGovernance.byCircuit);
    const distribution = rows.reduce((out, row) => { out[row.status] = (out[row.status] || 0) + 1; return out; }, {});
    console.log('[tang-effects] ' + JSON.stringify({ result, distribution }));
    if (rows.every(row => row.status === 'unbound')) {
      assert.equal(Object.keys(gm.circuitGovernance.byLeaf).length, 0);
      rows.forEach(row => assert.deepEqual(Object.keys(row).sort(), ['status', 'turn']));
      console.log('[tang-effects] 数据尚未绑定：无效果，账本只记 status');
    } else {
      assert(rows.some(row => row.status === 'serving'));
      assert(Object.values(gm.circuitGovernance.byLeaf).some(row => row.exec !== 0));
    }
  });
});
