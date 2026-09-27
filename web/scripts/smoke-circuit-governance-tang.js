#!/usr/bin/env node
// 晚唐一局：本方正式省道分布守恒，并实际走通 regionId 或官衔兜底。
'use strict';
const assert = require('node:assert/strict');
const { runSuite, assertReadOnly } = require('./lib-circuit-governance-harness');

runSuite('sc-tang840-840', 'smoke-circuit-governance-tang', (world, check, views) => {
  check('本方省道总数守恒，至少一道按 regionId 或官衔绑定', () => {
    assert.equal(views.length, world.circuits.length);
    assert(views.some(view => view.position && (view.source === 'regionId' || view.source === 'name')));
    console.log('[tang-bound] ' + views.filter(view => view.position).slice(0,3).map(view => view.position.name + ':' + view.status + ':' + view.source).join(' / '));
  });
  check('所有公开读接口均不改变三棵运行态 JSON', () => assertReadOnly(world));
});
