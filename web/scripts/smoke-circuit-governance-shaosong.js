#!/usr/bin/env node
// 绍宋一局：同名路只查本方行政树，核对宗泽与只读契约。
'use strict';
const assert = require('node:assert/strict');
const { runSuite, assertReadOnly, withFields } = require('./lib-circuit-governance-harness');

runSuite('sc-jianyan1-1127-shaosong', 'smoke-circuit-governance-shaosong', (world, check, views) => {
  const { gm, api, division, circuits, owner, context } = world;
  check('京畿路属于大宋，其他树先出现同名节点也不会误取', () => {
    const circuit = circuits.find(row => row.label === '京畿路');
    assert(circuit, '本方有京畿路');
    const node = division.circuitAdminNode(gm, circuit.key, owner);
    assert(node && gm.adminHierarchy.player.divisions.includes(node), '节点位于大宋根下');
    assert.equal(node.governor, '宗泽');
    assert.equal(api.governorOf(gm, circuit, owner).adminNodeId, node.id);
    const reordered = Object.fromEntries(Object.entries(gm.adminHierarchy).filter(([key]) => key !== 'player').concat([['player', gm.adminHierarchy.player]]));
    withFields(gm, { adminHierarchy: reordered }, () => assert.equal(division.circuitAdminNode(gm, circuit.key, owner), node));
    withFields(context.P, { adminHierarchy: { player: { divisions: [{ ...node, governor: '旧树误导' }] } } }, () => {
      assert.equal(division.circuitAdminNode(gm, circuit.key, owner), node, '只认 GM 树');
    });
    assert.equal(division.circuitAdminNode(gm, circuit.key, '不存在的势力'), null);
  });
  check('所有公开读接口均不改变三棵运行态 JSON', () => assertReadOnly(world));
  check('至少一条本方路在任；京畿路按 governorOffice 绑到宗泽的真实职位', () => {
    assert(views.some(view => view.status === 'serving'), '本方至少一路在任');
    const circuit = circuits.find(row => row.label === '京畿路');
    const node = division.circuitAdminNode(gm, circuit.key, owner);
    const offices = [];
    // 保留宗泽所任职位的原始证据，便于与剧本数据修复线逐字段对账。
    function walk(nodes) { nodes.forEach(dept => { (dept.positions || []).forEach(position => { if (position.holder === '宗泽') offices.push({ dept: dept.name, name: position.name, regionId: position.regionId || null }); }); walk(dept.subs || []); }); }
    walk(gm.officeTree);
    console.log('[shaosong-binding] ' + JSON.stringify({ adminNodeId: node.id, officialPosition: node.officialPosition, governorOffice: node.governorOffice || null, offices }));
    // 官衔「东京留守」与职位「东京留守兼开封尹」不按名兜底，须由数据线补 governorOffice。
    // 已补：原样核在任；未补：临时写上宗泽的真实职位路径，核按 governorOffice 解析。
    // 宗泽在官制里另挂「东京留守司判官·参议官」（数据线待清），这里取官衔打头的正职
    const main = offices.filter(o => o.name === node.officialPosition || ['兼', '(', '（'].some(t => o.name.indexOf(node.officialPosition + t) === 0));
    assert(node.governorOffice || main.length === 1, '宗泽的正职路径唯一');
    const bind = node.governorOffice ? {} : { governorOffice: main[0].dept + '/' + main[0].name };
    withFields(node, bind, () => {
      const view = api.governorOf(gm, circuit, owner);
      assert.equal(view.status, 'serving');
      assert.equal(view.holderName, '宗泽');
      assert.equal(view.source, 'governorOffice');
    });
  });
});
