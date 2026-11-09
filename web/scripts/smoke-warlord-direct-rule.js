#!/usr/bin/env node
'use strict';
// 央地「抗命／自专」只对朝廷直辖之地；开局（或旧档头一回）原样的不当新事（11-09）。
// 病根：天启开局乌思藏都指挥使司（羁縻，作者定自主 0.9、征收 0.15）第一回合就被台账（tm-ledger-paper）判「藩镇自立」，
// 扣皇权 8、皇威 10，安了个「某节度」；央地（tm-central-local-engine）同回合又报它「抗命」「坐大成藩镇」。
// 同日二改（同志定）：「藩镇自立」整个撤掉、并入民变重做那条线——直辖之地征收跌穿也不再判自立、不扣、不安「某节度」、
// 不记「示意」的封建领地、不凭空进贡；旧档里按旧规则记下的一律撤掉。征收低本身照旧在征税里少收。
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

function world(GM, files) {
  const c = { GM, P: {}, eb: [], auth: [], errs: [] };
  c.console = { log() {}, warn() {}, info() {}, error: (...a) => c.errs.push(a.map(String).join(' ')) };
  c.window = c; c.global = c; c.globalThis = c;
  c.addEB = (t, m) => c.eb.push(t + '：' + m);
  c._adjAuthority = (key, delta, reason) => c.auth.push({ key, delta, reason });
  c.EventBus = { emit() {} };
  vm.createContext(c);
  for (const f of files || ['tm-central-local-engine.js', 'tm-ledger-paper.js']) {
    vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), c, { filename: f });
  }
  return c;
}
function gm(regions, divisions) {
  const auditSystem = { lastAuditedByRegion: {}, activeCensors: [], standingPositions: [], ongoingInspections: [] };
  return { turn: 2, month: 3, fiscal: { _centralLocalInited: true, auditSystem, regions }, adminHierarchy: { player: { divisions } } };
}
const DIVS = [
  { id: 'wsz', name: '乌思藏都指挥使司', regionType: 'jimi' },
  { id: 'gz', name: '贵州布政使司', regionType: 'tusi' },
  { id: 'hebei', name: '魏博', autonomy: { type: 'fanzhen' } },
  { id: 'sx', name: '陕西布政使司', regionType: 'normal', children: [{ id: 'yanan', name: '延安府', regionType: 'normal' }] }
];
const centralEvents = (c) => c.eb.filter((m) => /^央地/.test(m));
const warlordHits = (c) => c.auth.filter((a) => (a.key === 'huangquan' && a.delta === -8) || (a.key === 'huangwei' && a.delta === -10));

console.log('== 直辖与否 ==');
{
  const c = world(gm({}, DIVS));
  const CL = c.CentralLocalEngine;
  ok(CL.isDirectlyGoverned('wsz') === false, '羁縻（乌思藏）不算直辖');
  ok(CL.isDirectlyGoverned('gz') === false, '土司不算直辖');
  ok(CL.isDirectlyGoverned('hebei') === false, '剧本定为藩镇的不算直辖');
  ok(CL.isDirectlyGoverned('sx') === true && CL.isDirectlyGoverned('yanan') === true, '布政使司及其下府算直辖');
  ok(CL.isDirectlyGoverned('nowhere') === true, '找不到区划的按直辖算（旧行为）');
}

console.log('== 央地：抗命／自专，不再判自立 ==');
{
  const c = world(gm({ wsz: { compliance: 0.15, autonomyLevel: 0.9 } }, DIVS));
  c.CentralLocalEngine.tick({ turn: 2 }); c.CentralLocalEngine.tick({ turn: 3 });
  ok(centralEvents(c).length === 0, '乌思藏（羁縻）两回合都不报抗命、自专、自立（' + centralEvents(c).join(' / ') + '）');
  ok(!(c.GM.fiscal.feudalHoldings || []).length, '也不记「自立」');
  ok(c.errs.length === 0, '无报错' + (c.errs.length ? '：' + c.errs[0] : ''));
}
{
  const c = world(gm({ sx: { compliance: 0.05, autonomyLevel: 0.95 } }, DIVS));
  c.CentralLocalEngine.tick({ turn: 2 });
  ok(centralEvents(c).length === 0, '直辖之地开局就已越线：头一回只记下、不报');
  const s = c.GM.fiscal.regions.sx._signals || {};
  ok(s.seen && s.defiance && s.warlord && !s.selfDeclare, '抗命、自专两个信号记上，不再有自立信号');
  c.CentralLocalEngine.tick({ turn: 3 });
  ok(centralEvents(c).length === 0 && !(c.GM.fiscal.feudalHoldings || []).length, '第二回合仍不报、不记自立');
}
{
  const c = world(gm({ yanan: { compliance: 0.9, autonomyLevel: 0.2 } }, DIVS));
  c.CentralLocalEngine.tick({ turn: 2 });
  Object.assign(c.GM.fiscal.regions.yanan, { compliance: 0.05, autonomyLevel: 0.95 });
  c.CentralLocalEngine.tick({ turn: 3 });
  const ev = centralEvents(c);
  ok(ev.some((m) => m.indexOf('抗命') >= 0) && ev.some((m) => m.indexOf('自专日甚') >= 0 && m.indexOf('合规率') >= 0), '直辖之地本局征收跌穿一成：报抗命、自专（带合规率）（' + ev.join(' / ') + '）');
  ok(!ev.some((m) => /自立|藩镇/.test(m)) && !(c.GM.fiscal.feudalHoldings || []).length, '不再报「实质自立」「坐大成藩镇」，不记「示意」的封建领地');
}
{
  const c = world(gm({ yanan: { compliance: 0.9, autonomyLevel: 0.2 } }, DIVS));
  c.CentralLocalEngine.tick({ turn: 2 });
  ok(centralEvents(c).length === 0, '直辖之地开局安好：不报');
  c.GM.fiscal.regions.yanan.compliance = 0.45;
  c.CentralLocalEngine.tick({ turn: 3 });
  const ev = centralEvents(c);
  ok(ev.length === 1 && ev[0].indexOf('延安府') >= 0 && ev[0].indexOf('抗命') >= 0, '本局里越线才报抗命，写区划名字（' + ev.join(' / ') + '）');
}
{
  const g = gm({
    wsz: { compliance: 0.05, autonomyLevel: 0.95, _signals: { seen: true, defiance: true, warlord: true, selfDeclare: true } },
    sx: { compliance: 0.05, autonomyLevel: 0.95, _signals: { seen: true, defiance: true, warlord: true, selfDeclare: true } }
  }, DIVS);
  g.fiscal.feudalHoldings = [{ id: 'f1', regionId: 'wsz', type: 'autonomous_warlord' }, { id: 'f2', regionId: 'sx', type: 'autonomous_warlord' }, { id: 'f3', regionId: 'gz', type: 'jimi_prefecture' }];
  const c = world(g);
  c.CentralLocalEngine.tick({ turn: 9 });
  const ids = c.GM.fiscal.feudalHoldings.map((h) => h.id).join(',');
  ok(ids === 'f3', '旧档里按旧规则记下的「自立」（羁縻的、直辖的）都撤掉，别的封建不动（剩 ' + ids + '）');
  ok(c.GM.fiscal.regions.wsz._signals.selfDeclare === false && c.GM.fiscal.regions.sx._signals.selfDeclare === false, '自立信号也清掉');
  ok(!centralEvents(c).some((m) => /自立/.test(m)), '撤的时候不写事件');
}

console.log('== 台账：藩镇自立已撤 ==');
{
  const c = world(gm({ wsz: { compliance: 0.15, autonomyLevel: 0.9 } }, DIVS));
  c.PhaseF6.tick({ turn: 1, monthRatio: 1 }); c.PhaseF6.tick({ turn: 2, monthRatio: 1 });
  ok(warlordHits(c).length === 0, '乌思藏（羁縻）不判自立，不扣皇权、皇威');
  ok(!(c.GM.feudalHoldings || []).length && !c.eb.some((m) => /^藩镇/.test(m)), '不记藩镇、不写事件');
  ok(c.errs.length === 0, '无报错' + (c.errs.length ? '：' + c.errs[0] : ''));
}
{
  const c = world(gm({ sx: { compliance: 0.1, autonomyLevel: 0.9 } }, DIVS));
  c.PhaseF6.tick({ turn: 1, monthRatio: 1 });
  c.PhaseF6.tick({ turn: 2, monthRatio: 1 });
  c.GM.fiscal.regions.sx.compliance = 0.5;
  c.PhaseF6.tick({ turn: 3, monthRatio: 1 });
  c.GM.fiscal.regions.sx.compliance = 0.1;
  c.PhaseF6.tick({ turn: 4, monthRatio: 1 });
  ok(warlordHits(c).length === 0 && !(c.GM.feudalHoldings || []).length, '直辖之地开局过线、回落、再越线：都不判自立、不扣、不记藩镇');
}
{
  const c = world(gm({ yanan: { compliance: 0.5, autonomyLevel: 0.8 } }, DIVS));
  c.PhaseF6.tick({ turn: 1, monthRatio: 1 });
  Object.assign(c.GM.fiscal.regions.yanan, { compliance: 0.15, autonomyLevel: 0.9 });
  c.PhaseF6.tick({ turn: 2, monthRatio: 1 });
  c.PhaseF6.tick({ turn: 3, monthRatio: 1 });
  ok(warlordHits(c).length === 0 && !(c.GM.feudalHoldings || []).length, '直辖之地本局征收跌穿：不判自立（并入民变重做）');
  ok(!c.eb.some((m) => /某节度|自立/.test(m)), '不安「某节度」、不写「自立」事件');
}
{
  const g = gm({
    wsz: { compliance: 0.1, autonomyLevel: 0.95, _elevatedToFeudal: true },
    yanan: { compliance: 0.1, autonomyLevel: 0.95, _elevatedToFeudal: true }
  }, DIVS);
  g.feudalHoldings = [
    { id: 'feudal_1_wsz', type: 'warlord', originalRegionId: 'wsz', ruler: '某节度', tribute: { annual: 150000 } },
    { id: 'feudal_5_yanan', type: 'warlord', originalRegionId: 'yanan', ruler: '某节度', tribute: { annual: 150000 } },
    { id: 'clan', type: 'imperial_clan', originalRegionId: 'wsz' }
  ];
  const c = world(g);
  c.PhaseF6.tick({ turn: 7, monthRatio: 1 });
  const left = c.GM.feudalHoldings.map((h) => h.id).join(',');
  ok(left === 'clan', '旧档里按旧规则判出的「藩镇」（羁縻的、直辖的）连同进贡都撤掉，别的封建不动（剩 ' + left + '）');
  ok(c.GM.fiscal.regions.wsz._elevatedToFeudal === undefined && c.GM.fiscal.regions.yanan._elevatedToFeudal === undefined && warlordHits(c).length === 0, '升格记号清掉，不再扣');
}

console.log('\n[smoke-warlord-direct-rule] ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
