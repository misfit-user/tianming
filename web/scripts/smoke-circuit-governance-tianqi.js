#!/usr/bin/env node
// 天启一局：长官绑定、状态、履职口径与通志长官卡。
'use strict';
const assert = require('node:assert/strict');
const { runSuite, withFields, snapshot, assertReadOnly, officialCard } = require('./lib-circuit-governance-harness');

runSuite('sc-tianqi7-1627', 'smoke-circuit-governance-tianqi', (world, check) => {
  const { gm, api, division, circuits, owner, context } = world;
  const circuit = circuits.find(row => row.label === '北直隶');
  assert(circuit, '找到北直隶');
  const node = division.circuitAdminNode(gm, circuit.key, owner);
  const binding = api.resolveGovernorPosition(gm, node);
  assert(binding, '找到北直隶职位');
  const position = binding.position, character = gm.chars.find(ch => ch.name === position.holder);
  const before = snapshot(gm);

  // 数据线补 governorOffice 之前按官衔兜底绑到刘诏；补上之后按显式路径绑到数据写明的现任。两种状态都要成立。
  const authored = !!node.governorOffice;
  check('北直隶绑定：未补数据按官衔兜底，补了按显式路径；错误路径回落兜底', () => {
    const initial = api.governorOf(gm, circuit, owner);
    assert.equal(initial.status, 'serving');
    assert.equal(initial.source, authored ? 'governorOffice' : 'name');
    if (!authored) { assert.equal(initial.position.name, '顺天巡抚(北直隶)'); assert.equal(initial.holderName, '刘诏'); }
    assert.equal(initial.holderName, position.holder);
    assert(gm.chars.some(ch => ch.name === initial.holderName && ch.alive !== false), '现任在人物表里且在世');
    withFields(node, { governorOffice: binding.dept + '/' + position.name }, () => {
      const explicit = api.governorOf(gm, circuit, owner);
      assert.equal(explicit.source, 'governorOffice');
      assert.equal(JSON.stringify({ ...explicit, source: initial.source }), JSON.stringify(initial));
    });
    withFields(node, { governorOffice: '不存在的部门/不存在的职位' }, () => {
      const fallback = api.governorOf(gm, circuit, owner);
      assert.notEqual(fallback.source, 'governorOffice', '错误路径不算显式绑定');
      if (!authored) assert.equal(JSON.stringify(fallback), JSON.stringify(initial), '错误路径继续按名兜底');
      else if (fallback.position) assert.equal(fallback.holderName, initial.holderName, '兜底找到的仍是同一位现任');
    });
  });

  check('职位 id、regionId、直属部门路径与重名消歧严格按约定', () => {
    const one = { id: 'p1', name: '主官（甲）', holder: '甲', regionId: 'a1' };
    const two = { id: 'p2', name: '主官(乙)', holder: '乙', regionId: 'a2' };
    const fixture = { officeTree: [{ name: '上级', positions: [], subs: [{ name: '直属', positions: [one, two], subs: [] }] }] };
    assert.equal(api.resolveGovernorPosition(fixture, { governorOffice: 'p1', id: 'a2' }).position, one);
    assert.equal(api.resolveGovernorPosition(fixture, { governorOffice: '直属/主官(乙)', id: 'a1' }).position, two);
    assert.equal(api.resolveGovernorPosition(fixture, { governorOffice: '上级/主官(乙)', id: 'a1' }).source, 'regionId');
    assert.equal(api.resolveGovernorPosition(fixture, { officialPosition: '主官', governor: '乙' }).position, two);
    assert.equal(api.resolveGovernorPosition(fixture, { officialPosition: '主官', governor: '无名' }), null);
    withFields(two, { holder: '甲' }, () => assert.equal(api.resolveGovernorPosition(fixture, { officialPosition: '主官', governor: '甲' }), null));
    assert.equal(api.resolveGovernorPosition(fixture, { officialPosition: '主' }), null, '不放宽成任意前缀');
    assert.equal(api.resolveGovernorPosition(fixture, { id: 1 }), null, 'regionId 全等');
  });

  check('出缺、人物缺档与赴任七日的视图及卡片', () => {
    withFields(position, { holder: '' }, () => {
      const view = api.governorOf(gm, circuit, owner);
      assert.equal(view.status, 'vacant'); assert.equal(view.ability, null); assert.equal(view.travelDaysLeft, null);
      const card = officialCard(world, circuit);
      assert(card.includes('<b>出缺</b>')); assert(!card.includes('class="bk-gov"'));
    });
    withFields(position, { holder: '未建档人物' }, () => {
      assert.equal(api.governorOf(gm, circuit, owner).status, 'vacant');
      assert.equal(api.governorOf(gm, circuit, owner).ability, null);
    });
    withFields(character, { _travelTo: '顺天府', _travelRemainingDays: 7 }, () => {
      const view = api.governorOf(gm, circuit, owner);
      assert.equal(view.status, 'travelling'); assert.equal(view.travelDaysLeft, 7);
      assert(officialCard(world, circuit).includes('<span class="gv warn">赴任 · 余 7 日</span>'));
    });
    withFields(node, { officialPosition: '不存在的官衔' }, () => {
      assert.equal(api.governorOf(gm, circuit, owner).status, 'unbound');
      assert(officialCard(world, circuit).includes('<b>未设主官</b>'));
    });
  });

  check('亡故人物按出缺读取，不再显示能力', () => {
    [{ alive: false }, { dead: true }].forEach(fields => withFields(character, fields, () => {
      const view = api.governorOf(gm, circuit, owner);
      assert.equal(view.status, 'vacant'); assert.equal(view.ability, null);
    }));
  });

  check('分镇优先，说明转义，不显示能力与履职栏', () => {
    withFields(node, { governanceNote: '分镇', governanceDetail: '<各镇>&分治' }, () => {
      const view = api.governorOf(gm, circuit, owner), card = officialCard(world, circuit);
      assert.equal(view.status, 'note'); assert.equal(view.ability, null); assert.equal(view.position, null);
      assert(card.includes('<span class="role">分镇</span><b>&lt;各镇&gt;&amp;分治</b>'));
      assert(card.includes('本道无单一主官，不计长官之效'));
      assert(!card.includes('class="bk-gov"'));
    });
  });

  check('首府节点优先于旧首府旗标，缺失首府不猜测', () => {
    const original = api.governorOf(gm, circuit, owner);
    const seat = gm.mapData.regions.find(r => r.id === original.seatRegionId);
    assert(seat && seat.name === '顺天府');
    const other = world.MC.partitionByOwner(circuit, owner).own.find(r => r !== seat);
    withFields(node, { capitalChildId: other.id }, () => assert.equal(api.governorOf(gm, circuit, owner).seatRegionId, other.id));
    withFields(node, { capitalChildId: '不存在的首府' }, () => {
      assert.equal(api.governorOf(gm, circuit, owner).seatRegionId, '');
      assert(!officialCard(world, circuit).includes('驻 <b>'));
    });
  });

  check('通志卡结构、履职阈值与能力口径一致', () => {
    const view = api.governorOf(gm, circuit, owner), duty = context.officeDutyView(gm, position);
    assert.equal(view.ability, duty.capacity);
    const card = officialCard(world, circuit);
    assert(card.startsWith('<div class="bk-circuit-official"><span class="role">' + view.position.name + '</span><b>' + view.holderName + '</b><span class="bk-gov">'));
    assert(card.includes('<span class="gv">能力 <b>' + Math.round(duty.capacity) + '</b></span>'));
    assert(card.includes('<span class="gv">在任</span>'));
    assert(card.includes('<span class="gv">驻 <b>顺天府</b></span>'));
    assert(card.includes('<span class="line">统辖本道 11 府州；下辖各州主官'));
    assert(card.includes('本道之效'));
    assert(card.includes('下一回合起生效'));
    for (const [fulfillment, band, label] of [[34, 'low', '失职'], [35, 'mid', '平平'], [70, 'mid', '平平'], [71, 'high', '称职']]) {
      withFields(position, { _dutyState: { fulfillment } }, () => {
        const current = api.governorOf(gm, circuit, owner);
        assert.equal(current.fulfillment, fulfillment); assert.equal(current.band, band);
        assert(officialCard(world, circuit).includes('<span class="gv">履职 <b>' + label + '</b></span>'));
      });
    }
    withFields(position, { _dutyState: undefined }, () => {
      const current = api.governorOf(gm, circuit, owner);
      assert.equal(current.fulfillment, null); assert.equal(current.band, null);
      assert(!officialCard(world, circuit).includes('履职 <b>'));
    });
    withFields(context.TM, { CircuitGovernance: undefined }, () => {
      assert(officialCard(world, circuit).includes(node.governor), '缺模块退回原档案');
    });
  });

  check('非省道职位 tick 仍按原漂移公式，缺员衰减与重复 tick 不变', () => {
    const governors = new Set(circuits.map(row => api.resolveGovernorPosition(gm, division.circuitAdminNode(gm, row.key, owner))).filter(Boolean).map(row => row.position));
    const offices = [];
    // 遍历真实官制，只挑一个有掌权且在任的非省道职位作公式对照。
    function walk(nodes) { nodes.forEach(dept => { offices.push(...(dept.positions || [])); walk(dept.subs || []); }); }
    walk(gm.officeTree);
    const original = offices.find(p => !governors.has(p) && p.powers && Object.values(p.powers).some(Boolean) && gm.chars.some(ch => ch.name === p.holder));
    assert(original, '找到非省道职位');
    const p = JSON.parse(JSON.stringify(original)), ch = gm.chars.find(row => row.name === p.holder);
    const keys = ['taxCollect', 'militaryCommand', 'appointment', 'impeach', 'supervise', 'yinBu', 'judicial', 'works', 'drafting'];
    const domain = { militaryCommand: 'military', works: 'management', drafting: 'intelligence' }[keys.find(key => p.powers[key])] || 'administration';
    const morals = ch.wuchang || ch.wuchangOverride || ch.fiveConstants || ch.morals || {};
    const aliases = [['义', 'yi', 'righteousness'], ['信', 'xin', 'honesty', 'trust'], ['礼', 'li', 'propriety'], ['仁', 'ren', 'benevolence'], ['智', 'zhi', 'wisdom']];
    const weights = [0.28, 0.28, 0.20, 0.16, 0.08];
    const morality = aliases.reduce((sum, group, i) => {
      const key = group.find(name => morals[name] != null && !isNaN(Number(morals[name])));
      return sum + (key === undefined ? 50 : Number(morals[key])) * weights[i];
    }, 0);
    const capacity = (ch[domain] == null ? 50 : ch[domain]) * 0.6 + morality * 0.4;
    const prev = p._dutyState && typeof p._dutyState.fulfillment === 'number' ? p._dutyState.fulfillment : 50;
    const fixture = { officeTree: [{ name: '公式对照', positions: [p] }], chars: gm.chars, turn: (gm.turn || 0) + 1 };
    context.tickOfficeDutyState(fixture);
    assert(Math.abs(p._dutyState.fulfillment - Math.max(0, Math.min(100, prev + (capacity - prev) * 0.3))) < 1e-10);
    assert.equal(context.tickOfficeDutyState(fixture).details.length, 0, '同回合不重算');
    const serving = p._dutyState.fulfillment;
    p.holder = ''; fixture.turn++;
    context.tickOfficeDutyState(fixture);
    assert.equal(p._dutyState.fulfillment, Math.max(0, serving - 12));
  });

  check('批量只遍历一次官制树，读取与临时测试均不遗留写入', () => {
    let visits = 0;
    const fixture = { ...gm, get officeTree() { visits++; return gm.officeTree; } };
    api.listGovernors(fixture, circuits, owner);
    assert.equal(visits, 1, '批量只读一次官制树入口，和省道数无关');
    assert.equal(snapshot(gm), before, '所有临时字段恢复');
    assertReadOnly(world);
  });
});
