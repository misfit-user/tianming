#!/usr/bin/env node
'use strict';
// 「藩镇自立」与央地「抗命／坐大成藩镇／自立」只对朝廷直辖之地；开局（或旧档头一回）原样的不当新事（11-09）。
// 病根：天启开局乌思藏都指挥使司（羁縻，作者定自主 0.9、征收 0.15）第一回合就被台账（tm-ledger-paper）判「藩镇自立」，
// 扣皇权 8、皇威 10，安了个「某节度」；央地（tm-central-local-engine）同回合又报它「抗命」「坐大成藩镇」。
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

console.log('== 央地：抗命／坐大／自立 ==');
{
  const c = world(gm({ wsz: { compliance: 0.15, autonomyLevel: 0.9 } }, DIVS));
  c.CentralLocalEngine.tick({ turn: 2 }); c.CentralLocalEngine.tick({ turn: 3 });
  ok(centralEvents(c).length === 0, '乌思藏（羁縻）两回合都不报抗命、坐大、自立（' + centralEvents(c).join(' / ') + '）');
  ok(!(c.GM.fiscal.feudalHoldings || []).length, '也不记「自立」');
  ok(c.errs.length === 0, '无报错' + (c.errs.length ? '：' + c.errs[0] : ''));
}
{
  const c = world(gm({ sx: { compliance: 0.05, autonomyLevel: 0.95 } }, DIVS));
  c.CentralLocalEngine.tick({ turn: 2 });
  ok(centralEvents(c).length === 0, '直辖之地开局就已越线：头一回只记下、不报');
  const s = c.GM.fiscal.regions.sx._signals || {};
  ok(s.seen && s.defiance && s.warlord && s.selfDeclare, '三个信号都已记上');
  c.CentralLocalEngine.tick({ turn: 3 });
  ok(centralEvents(c).length === 0 && !(c.GM.fiscal.feudalHoldings || []).length, '第二回合仍不报、不记自立');
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
  const g = gm({ wsz: { compliance: 0.05, autonomyLevel: 0.95, _signals: { seen: true, defiance: true, warlord: true, selfDeclare: true } } }, DIVS);
  g.fiscal.feudalHoldings = [{ id: 'f1', regionId: 'wsz', type: 'autonomous_warlord' }, { id: 'f2', regionId: 'sx', type: 'autonomous_warlord' }];
  const c = world(g);
  c.CentralLocalEngine.tick({ turn: 9 });
  const ids = c.GM.fiscal.feudalHoldings.map((h) => h.id).join(',');
  ok(ids === 'f2', '旧档里乌思藏按旧规则记下的「自立」撤掉，别处的不动（剩 ' + ids + '）');
  ok(c.GM.fiscal.regions.wsz._signals.selfDeclare === false, '它的自立信号也清掉');
}

console.log('== 台账：藩镇自立升格 ==');
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
  ok(warlordHits(c).length === 0 && c.GM.fiscal.regions.sx._warlordAtStart === true, '直辖之地开局就已过线：头一回记下不报');
  c.PhaseF6.tick({ turn: 2, monthRatio: 1 });
  ok(warlordHits(c).length === 0, '第二回合仍不报');
  c.GM.fiscal.regions.sx.compliance = 0.5;
  c.PhaseF6.tick({ turn: 3, monthRatio: 1 });
  ok(c.GM.fiscal.regions.sx._warlordAtStart === undefined, '回落到线内，开局记号撤掉');
  c.GM.fiscal.regions.sx.compliance = 0.1;
  c.PhaseF6.tick({ turn: 4, monthRatio: 1 });
  const hits = warlordHits(c);
  ok(hits.length === 2 && (c.GM.feudalHoldings || []).length === 1, '再越线才算自立：扣皇权 8、皇威 10，记一处藩镇');
}
{
  const c = world(gm({ yanan: { compliance: 0.5, autonomyLevel: 0.8 } }, DIVS));
  c.PhaseF6.tick({ turn: 1, monthRatio: 1 });
  Object.assign(c.GM.fiscal.regions.yanan, { compliance: 0.15, autonomyLevel: 0.9 });
  c.PhaseF6.tick({ turn: 2, monthRatio: 1 });
  const fh = (c.GM.feudalHoldings || [])[0] || {};
  ok(warlordHits(c).length === 2 && fh.name === '延安府' && fh.type === 'warlord', '直辖之地本局越线照旧判自立（' + fh.name + '）');
  c.PhaseF6.tick({ turn: 3, monthRatio: 1 });
  ok(warlordHits(c).length === 2, '同一处不重复判');
}
{
  const g = gm({ wsz: { compliance: 0.1, autonomyLevel: 0.95, _elevatedToFeudal: true } }, DIVS);
  g.feudalHoldings =[{ id: 'feudal_1_wsz', type: 'warlord', originalRegionId: 'wsz', ruler: '某节度' }, { id: 'clan', type: 'imperial_clan', originalRegionId: 'wsz' }];
  const c = world(g);
  c.PhaseF6.tick({ turn: 7, monthRatio: 1 });
  const left = c.GM.feudalHoldings.map((h) => h.id).join(',');
  ok(left === 'clan', '旧档里乌思藏那条「藩镇」撤掉，别的封建不动（剩 ' + left + '）');
  ok(c.GM.fiscal.regions.wsz._elevatedToFeudal === undefined && warlordHits(c).length === 0, '升格记号清掉，不再扣');
}

console.log('\n[smoke-warlord-direct-rule] ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
