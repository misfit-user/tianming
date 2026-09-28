#!/usr/bin/env node
// 天启单局核对本道落账、衰减、设置、旧履职等价与两种册页。
'use strict';
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const { runSuite, withFields, assertReadOnly, officialCard } = require('./lib-circuit-governance-harness');

// f204d924 已验收的按经过时间 tick 函数全文；仅作为对照，不跟随新实现修改。
const LEGACY_TICK = String.raw`  function tickOfficeDutyState(GM, opts) {
    opts = opts || {};
    var F = Object.assign({}, DEFAULT_FORCE, opts.force || {});
    var agg = { compliance: 0, corruption: 0, details: [] };
    if (!GM || !GM.officeTree || !GM.officeTree.length || !HS) return agg;
    var turn = (GM.turn != null) ? GM.turn : 0;
    var days=_days(GM,opts);
    if(!days) return agg;
    var rows=[];
    HS.walk(GM.officeTree, function(p,n,path) {
      var powers=_powersOf(p); if(!powers.length && !_isHead(p))return;
      var state=HS.read(GM,p);
      rows.push({p:p,dept:n.name || '',path:path,state:state,powers:powers,regionId:p.jurisdictionId || p.regionId || n.jurisdictionId || n.regionId,regionName:p.jurisdiction || n.jurisdiction,faction:p.factionId || n.factionId});
    });
    var start=HS.number(opts.startDay,rows.reduce(function(v,row){return Math.max(v,HS.number(row.p._dutyState && row.p._dutyState.elapsedDays,0));},0));
    var boundaries=[start,start+days];
    rows.forEach(function(row){row.state.characters.forEach(function(h){
      var leave=row.p.officeLeave || row.p.leave || h.char.officeLeave || h.char.leave || {};
      [leave.startDay,leave.endDay].forEach(function(day){if(day!=null && Number(day)>start && Number(day)<start+days && boundaries.indexOf(Number(day))<0)boundaries.push(Number(day));});
    });});
    boundaries.sort(function(a,b){return a-b;});
    function actorsAt(row,day) {return row.state.characters.map(function(h){return HS.availability(GM,h.char,row.p,day);});}
    var segments=boundaries.slice(1).map(function(end,i) {
      var day=(end+boundaries[i])/2,loads=new Map(),actors=rows.map(function(row){return actorsAt(row,day);});
      actors.forEach(function(list){list.forEach(function(a){loads.set(a.char,(loads.get(a.char)||0)+1);});});
      return {days:end-boundaries[i],actors:actors,shares:actors.map(function(list){return list.length?list.reduce(function(sum,a){return sum+1/loads.get(a.char);},0)/list.length:1;})};
    });
    rows.forEach(function(row,rowIndex) {
      var p=row.p,deptName=row.dept;
      var pwKeys = _powersOf(p);
      if (!pwKeys.length && !_isHead(p)) return;     // 同舆图过滤：只主官/掌权
      var ds = p._dutyState || (p._dutyState = { fulfillment: 50, trend: 'stable', lastTurn: null });
      if (ds.lastTurn === turn) return;              // 本回合已 tick·防重复施加

      var prev = (typeof ds.fulfillment === 'number') ? ds.fulfillment : 50;
      if(!ds.byPower) ds.byPower={};
      var keys=pwKeys.length?pwKeys:['general'], results={};
      keys.forEach(function(power) {
        var current=HS.number(ds.byPower[power],prev), result={next:current,low:0,high:0};
        for(var bi=0;bi<segments.length;bi++) {
          var segment=segments[bi], actors=segment.actors[rowIndex], target=current;
          if(actors.length) target=actors.reduce(function(sum,a){return sum+_capacity(a.char,power)*a.capacity;},0)/actors.length;
          var step=_advance(current,target,!row.state.occupied,segment.days,F), share=segment.shares[rowIndex];
          result.low+=step.low*share;result.high+=step.high*share;current=step.next;
        }
        result.next=current; results[power]=result;
        ds.byPower[power]=results[power].next;
      });
      var next=keys.reduce(function(sum,k){return sum+ds.byPower[k];},0)/keys.length;
      ds.fulfillment = next;
      ds.trend = next > prev + 0.5 ? 'rising' : next < prev - 0.5 ? 'falling' : 'stable';
      ds.lastTurn = turn;
      ds.elapsedDays = start+days;

      // 域效果（带 × power·仅 v1 已接杠杆）
      var did = {};   // 每杠杆每官最多记一次（防 supervise+impeach 同署双扣腐败）
      pwKeys.forEach(function (k) {
        var r=results[k];
        var band=r.next<F.lowBand?'low':r.next>F.highBand?'high':'mid';
        if (k === 'taxCollect' && !did.compliance) {
          did.compliance = 1;
          var d = -r.low*F.compLow+r.high*F.compHigh;
          if(!d) return;
          agg.compliance += d;
          agg.details.push({ dept: deptName, pos: p.name || '', positionId:p.id, jurisdiction:p.jurisdictionId || row.path, regionId:row.regionId,regionName:row.regionName,faction:row.faction, lever: 'compliance', delta: d, fulfillment: Math.round(r.next), band: band });
        } else if ((k === 'supervise' || k === 'impeach') && !did.corruption) {
          did.corruption = 1;
          var c = r.low*F.corrLow-r.high*F.corrHigh;
          if(!c) return;
          agg.corruption += c;
          agg.details.push({ dept: deptName, pos: p.name || '', positionId:p.id, jurisdiction:p.jurisdictionId || row.path, regionId:row.regionId,regionName:row.regionName,faction:row.faction, lever: 'corruption', delta: c, fulfillment: Math.round(r.next), band: band });
        }
      });
    });
    return agg;
  }

`;

// 数值逐项比较，容纳浮点计算的末位误差。
function near(actual, expected, label) { assert(Math.abs(actual - expected) < 1e-10, label + ': ' + actual + ' != ' + expected); }
// JSON 往返与存档口径一致，不复制函数或缓存。
function copy(value) { return JSON.parse(JSON.stringify(value)); }
// 测试独立枚举行政节点，按地块各绑定 id 找到全部叶子。
function allLeaves(node) {
  const key = ['children', 'divisions', 'subDivisions', 'subs'].find(key => Array.isArray(node[key]));
  const children = key ? node[key] : [];
  return children.length ? children.flatMap(allLeaves) : [node];
}
// 遍历原职位对象，供 reset 和旧算法等价检查使用。
function positions(nodes) { return nodes.flatMap(node => [...(node.positions || []), ...positions(node.subs || [])]); }

runSuite('sc-tianqi7-1627', 'smoke-circuit-governor-effects-tianqi', (world, check) => {
  const { gm, context, api, division, circuits, owner, parts } = world;
  const effects = context.TM.CircuitGovernorEffects, route = context.TM.MapRouteDays;
  const circuit = circuits.find(row => row.label === '北直隶'), node = division.circuitAdminNode(gm, circuit.key, owner);
  const position = api.resolveGovernorPosition(gm, node).position, character = gm.chars.find(ch => ch.name === position.holder);
  const seat = gm.mapData.regions.find(r => r.id === api.governorOf(gm, circuit, owner).seatRegionId);
  const leaves = allLeaves(gm.adminHierarchy.player), offices = positions(gm.officeTree);
  const oldDuty = offices.map(p => [p, p._dutyState && copy(p._dutyState), p.holder]);
  const holderKeys=['holder','holderId','actualHolders','actualCount','vacancyCount','occupancyStatus','unrecordedCount','additionalHolders','additionalHolderIds'];
  const oldHolders=offices.map(p=>[p,holderKeys.map(key=>[key,Object.getOwnPropertyDescriptor(p,key)])]);
  const oldCorruption = leaves.map(leaf => [leaf, leaf.corruption]);
  const own = circuit.members.map(row => row.region).filter(r => api.isPlayerRegion(gm, r));
  const targets = own.flatMap(region => {
    const ids = [region.adminBinding, ...(region.accountingLeafIds || []), region.id];
    let matches = leaves.filter(leaf => ids.includes(leaf.id));
    if (!matches.length) matches = leaves.filter(leaf => leaf.name === region.name);
    return matches.map(leaf => ({ leaf, region }));
  });
  assert(targets.length >= own.length, '本道每州有记账叶子');
  const sorted = targets.slice().sort((a, b) => route.daysBetween(gm.mapData, seat, a.region).days - route.daysBetween(gm.mapData, seat, b.region).days);
  const closest = sorted[0], farthest = sorted[sorted.length - 1];
  const m = context._getDaysPerTurn() / 30, table = [];
  const dutyAssignments=context.TM.OfficeHolderState.assignments(gm,character).filter(r=>Object.values(r.pos.powers||{}).some(Boolean)||context.getRankLevel(r.pos.rank)<=6);
  assert(dutyAssignments.length>0);
  const workloadShare=1/dutyAssignments.length;

  // 每组恢复原履职与腐败，回合递增，避免上组影响下组。
  function reset(strength = 'normal') {
    oldDuty.forEach(([p, duty, holder]) => { p.holder = holder; if (duty) p._dutyState = copy(duty); else delete p._dutyState; });
    oldHolders.forEach(([p,fields])=>fields.forEach(([key,descriptor])=>{if(descriptor)Object.defineProperty(p,key,descriptor);else delete p[key];}));
    oldCorruption.forEach(([leaf, corruption]) => { leaf.corruption = corruption; });
    delete gm.circuitGovernance;
    gm.turn++;
    context.P.conf.circuitGovernorEffects = true; context.P.conf.circuitGovernorStrength = strength;
    position._dutyState = { fulfillment: 80, trend: 'stable', lastTurn: null };
  }

  check('本方全图与各道长官对象逐项对齐，读口无写入', () => assertReadOnly(world));
  check('F=80 起步：按经过天数漂移并积分，再逐叶按驿程公式落账', () => {
    reset();
    const before = new Map(leaves.map(leaf => [leaf.id, leaf.corruption]));
    const capacity = context.officeDutyView(gm, position).capacity;
    const taxCapacity=context.officeDutyView(gm,position,{power:'taxCollect'}).capacity;
    const supervisionCapacity=context.officeDutyView(gm,position,{power:'supervise'}).capacity;
    const exposure=target=>((target-50)*m+(80-target)*(1-Math.pow(0.7,m))/-Math.log(0.7))/50;
    const result = effects.tick(gm, context.P), F = capacity+(80-capacity)*Math.pow(0.7,m), E = (F - 50) / 50;
    near(position._dutyState.fulfillment, F, '原漂移'); assert(result.serving >= 1);
    targets.forEach(({ leaf, region }) => {
      const trip = route.daysBetween(gm.mapData, seat, region), R = 1 / (1 + trip.days / 15);
      const row = gm.circuitGovernance.byLeaf[leaf.id]; assert(row.exec > 0);
      near(row.exec, 0.03 * exposure(taxCapacity) * workloadShare * R, leaf.name + ' exec');
      near(leaf.corruption, Math.max(0, before.get(leaf.id) - 0.8 * exposure(supervisionCapacity) * workloadShare * R), leaf.name + ' corruption');
      near(row.R, R, 'R'); near(row.E, E, 'E'); assert.equal(row.days, trip.days); assert.equal(row.estimated, trip.estimated);
    });
    assert(gm.circuitGovernance.byLeaf[closest.leaf.id].exec > gm.circuitGovernance.byLeaf[farthest.leaf.id].exec);
    assert(before.get(closest.leaf.id) - closest.leaf.corruption > before.get(farthest.leaf.id) - farthest.leaf.corruption);
    for (const item of [closest, farthest]) table.push({ phase: '实际漂移首回合', region: item.region.name, F, days: gm.circuitGovernance.byLeaf[item.leaf.id].days,
      exec: gm.circuitGovernance.byLeaf[item.leaf.id].exec, corruptionDelta: item.leaf.corruption - before.get(item.leaf.id) });
    const ledger = JSON.stringify(gm.circuitGovernance), corr = leaves.map(leaf => leaf.corruption);
    assert.equal(effects.tick(gm, context.P).skipped, 'alreadyTicked'); assert.equal(JSON.stringify(gm.circuitGovernance), ledger); assert.deepEqual(leaves.map(leaf => leaf.corruption), corr);
  });
  check('轻中强步长与封顶分别为 0.5、1、2 倍；逐回合夹边界', () => {
    const steps = [];
    for (const [strength, s] of [['light', 0.5], ['normal', 1], ['strong', 2]]) {
      reset(strength); effects.tick(gm, context.P); steps.push(gm.circuitGovernance.byLeaf[closest.leaf.id].exec);
      for (let i = 0; i < 30; i++) { gm.turn++; effects.tick(gm, context.P); targets.forEach(({ leaf }) => assert(gm.circuitGovernance.byLeaf[leaf.id].exec <= 0.06 * s)); }
      near(gm.circuitGovernance.byLeaf[closest.leaf.id].exec, 0.06 * s, strength + ' cap');
    }
    near(steps[0], steps[1] * 0.5, 'light'); near(steps[2], steps[1] * 2, 'strong');
    reset();
    // 固定 F=80 的效果量级表：本回合履职已由上游推进过，tick 不再漂移。
    for (let i = 1; i <= 6; i++) {
      if (i > 1) gm.turn++;
      position._dutyState = { fulfillment: 80, trend: 'stable', lastTurn: gm.turn };
      const before = new Map(targets.map(({ leaf }) => [leaf.id, leaf.corruption]));
      effects.tick(gm, context.P);
      for (const item of [closest, farthest]) table.push({ phase: '固定F80第' + i + '回合', region: item.region.name, F: 80,
        days: gm.circuitGovernance.byLeaf[item.leaf.id].days, exec: gm.circuitGovernance.byLeaf[item.leaf.id].exec, corruptionDelta: item.leaf.corruption - before.get(item.leaf.id) });
    }
    console.log('[F80-table] ' + JSON.stringify({ monthsPerTurn: m, rows: table }));
  });
  check('出缺每三十日衰减 12，赴任冻结 F 与既有 exec', () => {
    reset(); effects.tick(gm, context.P); Object.assign(position,{holder:'',holderId:null,actualHolders:[],actualCount:0,vacancyCount:1,unrecordedCount:0,additionalHolders:[],additionalHolderIds:[],occupancyStatus:'vacant'});
    let negative = false;
    for (let i = 0; i < 8; i++) {
      const F = position._dutyState.fulfillment, exec = gm.circuitGovernance.byLeaf[closest.leaf.id].exec;
      gm.turn++; effects.tick(gm, context.P); near(position._dutyState.fulfillment, Math.max(0, F - 12*m), 'vacancy F per elapsed month');
      if ((F+position._dutyState.fulfillment)/2 < 50) {
        negative = true;
        const next = gm.circuitGovernance.byLeaf[closest.leaf.id].exec;
        assert(exec > -0.06 ? next < exec : next === -0.06, '失职向下至负封顶');
      }
    }
    assert(negative); assert.equal(gm.circuitGovernance.byCircuit[circuit.key].status, 'vacant');
    reset(); effects.tick(gm, context.P);
    const F = position._dutyState.fulfillment, exec = gm.circuitGovernance.byLeaf[closest.leaf.id].exec, corruption = closest.leaf.corruption;
    withFields(character, { _travelTo: seat.name, _travelRemainingDays: 7 }, () => {
      gm.turn++; effects.tick(gm, context.P); near(position._dutyState.fulfillment, F, 'frozen F');
      near(gm.circuitGovernance.byLeaf[closest.leaf.id].exec, exec, 'frozen exec'); near(closest.leaf.corruption, corruption, 'frozen corruption');
      assert(officialCard(world, circuit).includes('赴任未到，暂无长官之效'));
      parts.openRegionDossier(farthest.region); assert(context.document.getElementById('ppop').innerHTML.includes(' · 赴任中'));
    });
  });
  check('首府失守无新效果，旧修正退潮；未绑定道只记状态', () => {
    reset(); effects.tick(gm, context.P); const corruption = closest.leaf.corruption;
    withFields(seat, { currentOwner: '不属本方' }, () => {
      gm.turn++; effects.tick(gm, context.P); assert.equal(gm.circuitGovernance.byCircuit[circuit.key].status, 'seatLost');
      near(closest.leaf.corruption, corruption, 'seatLost corruption'); assert(!gm.circuitGovernance.byLeaf[closest.leaf.id], '小于退潮步长则删账');
      assert(officialCard(world, circuit).includes('首府不在本方，暂无长官之效'));
      parts.openRegionDossier(farthest.region); assert(context.document.getElementById('ppop').innerHTML.includes(' · 首府失守'));
    });
    let unbound = Object.values(gm.circuitGovernance.byCircuit).filter(row => row.status === 'unbound');
    // 数据补齐主官后本方可能已无未绑定道：临时拿掉北直隶的显式路径与官衔，造出一道来核
    if (!unbound.length) withFields(node, { governorOffice: undefined, officialPosition: '不存在的官衔' }, () => {
      gm.turn++; effects.tick(gm, context.P);
      unbound = Object.values(gm.circuitGovernance.byCircuit).filter(row => row.status === 'unbound');
    });
    assert(unbound.length);
    unbound.forEach(row => assert.deepEqual(Object.keys(row).sort(), ['status', 'turn']));
    reset(); effects.tick(gm, context.P); const outside = leaves.find(leaf => !gm.circuitGovernance.byLeaf[leaf.id]);
    assert(outside); gm.circuitGovernance.byLeaf[outside.id] = { exec: -0.06, circuitKey: '旧辖区' };
    gm.turn++; effects.tick(gm, context.P); near(gm.circuitGovernance.byLeaf[outside.id].exec, -Math.max(0, 0.06 - 0.03 * m), '负修正向零');
  });
  check('执行率在原算法 clamp 前合成；关闭不写账且不显示修正', () => {
    reset(); effects.tick(gm, context.P);
    const FP = context.TM.FieldPipes, ledger = JSON.stringify(gm.circuitGovernance);
    const raw = fs.readFileSync(path.join(__dirname, '../tm-field-pipelines.js'), 'utf8');
    const baseline = { window: null, TM: {} }; baseline.window = baseline; vm.runInNewContext(raw, baseline);
    const exec = gm.circuitGovernance.byLeaf[closest.leaf.id].exec;
    // 无舍入分歧的底数，另覆盖两个 clamp 边界。
    for (const rate of [0.60, 0.299, 0.99]) {
      const div = { id: closest.leaf.id, localExecutionRate: rate };
      near(FP.policyExecRate(div).rate, Math.round(Math.max(0.3, Math.min(1, rate + exec)) * 100) / 100, 'policy rate');
      assert(FP.policyExecRate(div).parts.some(part => part.startsWith('上官修正 ')));
    }
    context.P.conf.circuitGovernorEffects = false; gm.turn++;
    assert.equal(effects.tick(gm, context.P).skipped, 'disabled'); assert.equal(JSON.stringify(gm.circuitGovernance), ledger);
    assert.equal(JSON.stringify(FP.policyExecRate(closest.leaf)), JSON.stringify(baseline.TM.FieldPipes.policyExecRate(closest.leaf)));
    assert(!FP.policyExecRate(closest.leaf).parts.some(part => part.includes('上官修正')));
    assert(officialCard(world, circuit).includes('设置中已关闭'));
    parts.openRegionDossier(farthest.region); assert(context.document.getElementById('ppop').innerHTML.includes(' · 长官之效已关'));
  });
  check('全国结算跳过省道写入，并保留兼任长官的共同工作量', () => {
    reset(); context.P.conf.officeDutyStateEnabled = true;
    const source = fs.readFileSync(path.join(__dirname, '../tm-office-dutystate.js'), 'utf8');
    const original = { getRankLevel: context.getRankLevel, _getDaysPerTurn: context._getDaysPerTurn, TM:{OfficeHolderState:context.TM.OfficeHolderState,OfficeActionEvidence:context.TM.OfficeActionEvidence} }; vm.runInNewContext(source.replace('global.tickOfficeDutyState = tickOfficeDutyState;', 'global.tickOfficeDutyState = ' + LEGACY_TICK + ';'), original);
    const modern = { getRankLevel: context.getRankLevel, _getDaysPerTurn: context._getDaysPerTurn, TM: original.TM }; vm.runInNewContext(source, modern);
    const fixture = { chars: copy(gm.chars), officeTree: copy(gm.officeTree), turn: gm.turn + 1 };
    const old = copy(fixture), now = copy(fixture);
    assert.equal(JSON.stringify(modern.tickOfficeDutyState(now)), JSON.stringify(original.tickOfficeDutyState(old)), '不传 skip 的全国算法逐字等价');
    assert.equal(JSON.stringify(now), JSON.stringify(old), '全部履职态一致');
    const governors = api.governorPositions(gm), names = new Set(Array.from(governors, p => p.name));
    let aggregate, skipCalls = 0;
    const realTick = context.tickOfficeDutyState;
    withFields(context, { tickOfficeDutyState: (G, opts) => {
      assert.equal(typeof opts.skip, 'function'); governors.forEach(p => assert(opts.skip(p))); skipCalls++;
      aggregate = realTick(G, opts); return aggregate;
    } }, () => context._applyOfficeDutyTick(gm));
    assert.equal(skipCalls, 1); assert(aggregate.details.every(row => !names.has(row.pos)));
    governors.forEach(p => assert(!p._dutyState || p._dutyState.lastTurn !== gm.turn));
    // 对照仍包含所有任职以计算共享工作量；仅从结算结果中剔除省道贡献。
    const expected = copy(fixture); expected.turn = gm.turn;
    const reference = original.tickOfficeDutyState(expected);
    const nonGovernorDetails = reference.details.filter(row => !names.has(row.pos));
    near(aggregate.compliance, nonGovernorDetails.filter(row => row.lever === 'compliance').reduce((sum,row) => sum+row.delta,0), '非省道实征率');
    near(aggregate.corruption, nonGovernorDetails.filter(row => row.lever === 'corruption').reduce((sum,row) => sum+row.delta,0), '非省道腐败');
    assert.equal(JSON.stringify(aggregate.details), JSON.stringify(nonGovernorDetails));
    const currentNon = positions(gm.officeTree).filter(p => !governors.has(p));
    const expectedNon = positions(expected.officeTree).filter(p => !names.has(p.name));
    assert.equal(JSON.stringify(currentNon.map(p => p._dutyState)), JSON.stringify(expectedNon.map(p => p._dutyState)));
  });
  check('通志与非首府方志的标记、数值和转义；设置 setter 三档校验', () => {
    reset(); effects.tick(gm, context.P);
    const card = officialCard(world, circuit); assert(card.includes('class="bk-gov-eff"')); assert(card.includes('本道之效')); assert(card.includes('吏治 每月 −'));
    assert.notEqual(farthest.region, seat); parts.openRegionDossier(farthest.region);
    let html = context.document.getElementById('ppop').innerHTML; assert(html.includes('class="bk-pill sup"')); assert(html.includes('上官')); assert(html.includes('距驻地')); assert(html.includes('腐败每月'));
    withFields(position, { name: '<官&衔>', holder: '' }, () => {
      withFields(node, { governorOffice: '地方督抚/<官&衔>' }, () => {
        parts.openRegionDossier(farthest.region); html = context.document.getElementById('ppop').innerHTML;
        assert(html.includes('&lt;官&amp;衔&gt;')); assert(!html.includes('<官&衔>'));
      });
    });
    withFields(context, { saveP: () => {}, toast: () => {} }, () => {
      context._tmSetCircuitGovernor(false); assert.equal(effects.enabled(), false); context._tmSetCircuitGovernor(true); assert.equal(effects.enabled(), true);
      for (const strength of ['light', 'normal', 'strong']) { context._tmSetCircuitGovernorStrength(strength); assert.equal(effects.strength(), strength); }
      context._tmSetCircuitGovernorStrength('bad'); assert.equal(effects.strength(), 'strong');
    });
  });
  check('单职位不作主官过滤，冻结不初始化；账本存档往返不改下一回合结果', () => {
    const clerk = { name: '书手', holder: '' }, mini = { turn: 1, officeTree: [], chars: [] };
    assert.equal(context.tickDutyPosition(mini, clerk, { frozen: true }).ticked, false); assert(!clerk._dutyState);
    assert.equal(context.tickDutyPosition(mini, clerk).next, 50-12*m); assert.equal(context.tickDutyPosition(mini, clerk).ticked, false);
    reset(); effects.tick(gm, context.P);
    const saved = copy(gm.circuitGovernance), duty = offices.map(p => p._dutyState && copy(p._dutyState)), corr = leaves.map(leaf => leaf.corruption);
    gm.turn++; effects.tick(gm, context.P); const expected = JSON.stringify({ ledger: gm.circuitGovernance, corruption: leaves.map(leaf => leaf.corruption) });
    gm.circuitGovernance = copy(saved); offices.forEach((p, i) => { if (duty[i]) p._dutyState = copy(duty[i]); else delete p._dutyState; }); leaves.forEach((leaf, i) => { leaf.corruption = corr[i]; });
    effects.tick(gm, context.P); assert.equal(JSON.stringify({ ledger: gm.circuitGovernance, corruption: leaves.map(leaf => leaf.corruption) }), expected);
  });
  check('多叶地块、按名兜底、十日估程、非数腐败和半月回合', () => {
    const faction = api.playerFactionName(gm);
    const a = { id: 'mini-a', name: '甲州', corruption: 50 }, b = { id: 'mini-b', name: '乙县', corruption: '50' };
    const c = { id: 'mini-c', name: '丙州', corruption: 0 }, enemy = { id: 'mini-enemy', name: '敌州', corruption: 50 };
    const shadow = { id: 'mini-a', name: '兼容影子', corruption: 77 };
    const map = { regions: [
      { id: 'mini-seat', name: '甲州', currentOwner: faction, adminBinding: a.id, accountingLeafIds: [a.id, b.id], geographicCenter: [110, 35], neighbors: ['mini-far'] },
      { id: 'mini-far', name: '丙州', currentOwner: faction, neighbors: [] },
      { id: enemy.id, name: enemy.name, currentOwner: '敌方' }
    ], circuitRegistry: [{ key: 'mini-circuit', name: '测试道', sourceAdminId: 'mini-province', memberRegionIds: ['mini-seat', 'mini-far', enemy.id] }] };
    const p = { id: 'mini-office', name: '测试长官', holder: character.name, _dutyState: { fulfillment: 80, lastTurn: 1000 } };
    const mini = { turn: 1000, chars: [character], facs: gm.facs, mapData: map, officeTree: [{ name: '测试官署', positions: [p] }],
      adminHierarchy: { player: { factionName: faction, divisions: [{ id: 'mini-province', level: 'province', name: '测试道', governorOffice: p.id,
        capitalChildId: 'mini-seat', children: [a, b, c, enemy], divisions: [shadow] }] } } };
    const events = [];
    withFields(context, { _getDaysPerTurn: () => 15, addEB: (kind, text) => events.push([kind, text]) }, () => {
      const result = effects.tick(mini, context.P); assert.equal(result.leaves, 3);
      near(mini.circuitGovernance.byLeaf[a.id].exec, 0.009, '半月步长'); near(mini.circuitGovernance.byLeaf[b.id].exec, 0.009, '同块第二叶');
      near(a.corruption, 49.76, '半月腐败'); assert.equal(b.corruption, '50', '非数不改'); assert.equal(c.corruption, 0, '腐败下界');
      assert.equal(mini.circuitGovernance.byLeaf[c.id].days, 10); assert.equal(mini.circuitGovernance.byLeaf[c.id].estimated, true);
      near(mini.circuitGovernance.byLeaf[c.id].exec, 0.0054, '名称兜底与估程'); assert.equal(shadow.corruption, 77);
      assert(!mini.circuitGovernance.byLeaf[enemy.id]); assert.equal(enemy.corruption, 50);
      assert.deepEqual(events, [['官制', '省道长官·称职：测试道']]);
      effects.tick(mini, context.P); assert.equal(events.length, 1, '同回合不重记事件');
      mini.turn++; map.regions[1].currentOwner = '敌方'; effects.tick(mini, context.P);
      assert(!mini.circuitGovernance.byLeaf[c.id], '离开本方的旧修正退潮至零删除');
    });
    const core = fs.readFileSync(path.join(__dirname, '../tm-endturn-core.js'), 'utf8');
    const ordered = ['endTurn] office fallback tick', 'endTurn] circuit governor tick', 'endTurn] final aggregate'].map(label => core.indexOf(label));
    assert(ordered[0] >= 0 && ordered[0] < ordered[1] && ordered[1] < ordered[2], '回合尾严格位于 fallback 与 aggregate 之间');
  });
});
