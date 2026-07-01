'use strict';
/* smoke-talent-s4.js — S4 有司核验增维自测（11 检查）
 * 验证：① inspectRegion 增勘「学统格局」(既有范式/旧学存量/新学渗透) + 本地士绅
 *       ② APPRAISAL_TOOL 加 talentSource 字段（范式判定）
 *       ③ _normalizeTalentSource 校验/规整（新范式/归入已有/influenceProfile 夹紧）
 *       ④ appraise 把 talentSource 并入 effectsStructured（mock cawt）
 *       ⑤ 端到端：approveBuild 学校 → applyCompletion → 经 S2 bridge 路由进 talent-cohorts。
 */
var TC = require('../tm-talent-cohorts.js');
var TBB = require('../tm-talent-building-bridge.js');
var BW = require('../tm-building-works.js');
var CBA = require('../tm-custom-build-agent.js');

var passed = 0, failed = 0;
function ok(desc, cond) { if (cond) { passed++; console.log('  PASS ' + desc); } else { failed++; console.log('  FAIL ' + desc); } }

// ── ① inspectRegion 勘学统格局 + 士绅 ──
var GMi = { turn: 5 }, Pi = { conf: { talentCohortEnabled: true } };
TC.init(GMi, Pi);
TC.registerParadigm(GMi, { label: '科举经义', kind: 'established', stock: 800000 });
var e = TC.registerParadigm(GMi, { label: '格致之学', kind: 'emergent' });
TC.registerSource(GMi, 's', e.id, 8000);
var divI = { name: '江南府', leadingGentry: '东林士绅', specialCulture: '文教昌盛', economyBase: {}, populationDetail: {} };
var insp = CBA.inspectRegion('江南府', { P: Pi, GM: GMi, div: divI });
ok('inspectRegion 含「学统」段 + 旧学正统存量', insp.text.indexOf('学统') >= 0 && insp.text.indexOf('科举经义') >= 0 && insp.text.indexOf('800000') >= 0);
ok('inspectRegion 含新学范式（供「是否新范式」判定）', insp.text.indexOf('格致之学') >= 0 && insp.data.talentScene.emergent.length === 1);
ok('inspectRegion 含本地士绅/风土（供「变革阻力」）', insp.text.indexOf('东林士绅') >= 0);
// 无范式空局 → 提示可首倡新范式
var insp0 = CBA.inspectRegion('荒县', { P: { conf: {} }, GM: { turn: 1 }, div: { name: '荒县', economyBase: {}, populationDetail: {} } });
ok('inspectRegion 空局 → 提示「尚无新学范式立籍·可立新范式」', insp0.text.indexOf('尚无新学范式立籍') >= 0);

// ── ② APPRAISAL_TOOL 加 talentSource 字段 ──
var props = CBA.APPRAISAL_TOOL.parameters.properties;
ok('APPRAISAL_TOOL 含 talentSource 字段（paradigm/newParadigm/graduates）', !!props.talentSource && !!props.talentSource.properties.newParadigm && !!props.talentSource.properties.paradigm && !!props.talentSource.properties.graduates);

// ── ③ _normalizeTalentSource 校验 ──
var ns1 = CBA._normalizeTalentSource({ newParadigm: { label: '格致之学', influenceProfile: { techPromotion: 0.8, industry: 0.6, 越界: 5 }, absorptionKind: ['industry', 'craft'] }, graduates: 12000 });
ok('新范式：label/absorptionKind/graduates 保留', ns1 && ns1.newParadigm.label === '格致之学' && ns1.newParadigm.absorptionKind.length === 2 && ns1.graduates === 12000);
ok('新范式：influenceProfile 夹紧 [-1,1]（5→1）', ns1.newParadigm.influenceProfile['越界'] === 1 && ns1.newParadigm.influenceProfile.techPromotion === 0.8);
ok('归入已有范式（paradigm ref）', (function () { var n = CBA._normalizeTalentSource({ paradigm: '格致之学', graduates: 2000 }); return n && n.paradigm === '格致之学' && !n.newParadigm; })());
ok('既无 ref 也无新范式名 → null（非有效人才源）', CBA._normalizeTalentSource({ graduates: 999 }) === null && CBA._normalizeTalentSource(null) === null);

// ── ④ appraise 把 talentSource 并入 effectsStructured（mock cawt）──
(async function () {
  global.P = { conf: { customBuildAgentEnabled: true, customBuildCriticEnabled: false, talentCohortEnabled: true }, ai: { key: 'x' } };
  global.GM = GMi;
  global.callAIWithTools = async function () {
    return { toolCalls: [{ name: 'submit_appraisal', input: {
      feasibility: '合理', costActual: 100000, timeActual: 3, judgedEffects: '育格致之才', reason: '此地宜兴格致',
      talentSource: { newParadigm: { label: '格致之学', influenceProfile: { techPromotion: 0.8 }, absorptionKind: ['industry'] }, graduates: 12000 }
    } }] };
  };
  var out = await CBA.appraise('江南府', { name: '格致学堂', category: 'institutional', description: '习格致' }, { P: global.P, GM: GMi, div: divI });
  ok('appraise：talentSource 并入 effectsStructured + out.appraisal.talentSource', out.ok && out.appraisal.effectsStructured && out.appraisal.effectsStructured.talentSource && out.appraisal.talentSource && out.appraisal.talentSource.newParadigm.label === '格致之学');

  // ── ⑤ 端到端：approveBuild 学校 → applyCompletion → talent-cohorts 注册 ──
  var GMe = { turn: 5 }, Pe = { conf: { talentCohortEnabled: true } };
  var divE = { name: '武昌', buildings: [] };
  var appraisal = { feasibility: '合理', costActual: 100000, timeActual: 1, effectsStructured: { talentSource: { newParadigm: { label: '船政之学', absorptionKind: ['military'] }, graduates: 4000 } }, judgedEffects: '', reason: '' };
  var ab = CBA.approveBuild('武昌', appraisal, { name: '船政学堂', category: 'institutional' }, { P: Pe, GM: GMe, div: divE });
  var bld = ab.building;
  var booked = BW.applyCompletion(divE, bld, Pe, GMe);
  var p = TC.findParadigm(GMe, '船政之学');
  ok('端到端：approveBuild 学校 → applyCompletion → talent-cohorts 注册范式 + 源(费效封顶 4000)',
    ab.ok && booked === true && p && p.kind === 'emergent' && p.sources[bld._talentSrcId] === 4000);

  console.log('\n[smoke-talent-s4] ' + (failed === 0 ? 'ALL PASS ' : 'FAIL ') + passed + (failed ? ' / ' + failed + ' failed' : ' (11 checks)'));
  process.exit(failed === 0 ? 0 : 1);
})();
