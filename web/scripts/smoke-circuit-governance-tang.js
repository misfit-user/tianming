#!/usr/bin/env node
// 晚唐一局：本方正式省道分布守恒，并实际走通 regionId 或官衔兜底。
'use strict';
const assert = require('node:assert/strict');
const { runSuite, withFields, assertReadOnly } = require('./lib-circuit-governance-harness');

runSuite('sc-tang840-840', 'smoke-circuit-governance-tang', (world, check, views) => {
  check('本方省道总数守恒，至少一道按 regionId 或官衔绑定', () => {
    assert.equal(views.length, world.circuits.length);
    if (views.every(view => view.source === 'governorOffice')) {
      // 数据已逐道写明主官职位：拿掉某一道的显式路径，兜底仍须绑到同一位现任
      const { gm, api, division, circuits, owner } = world;
      const fallback = circuits.some(circuit => {
        const node = division.circuitAdminNode(gm, circuit.key, owner), explicit = api.governorOf(gm, circuit, owner);
        if (!node || !explicit.position) return false;
        return withFields(node, { governorOffice: undefined }, () => {
          const view = api.governorOf(gm, circuit, owner);
          return !!view.position && (view.source === 'regionId' || view.source === 'name') && view.holderName === explicit.holderName;
        });
      });
      assert(fallback, '去掉 governorOffice 后至少一道能按 regionId 或官衔兜底到同一现任');
    } else assert(views.some(view => view.position && (view.source === 'regionId' || view.source === 'name')));
    console.log('[tang-bound] ' + views.filter(view => view.position).slice(0,3).map(view => view.position.name + ':' + view.status + ':' + view.source).join(' / '));
  });
  check('所有公开读接口均不改变三棵运行态 JSON', () => assertReadOnly(world));
});
