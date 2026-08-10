/**
 * smoke-keju-indicators.js·Stage 2·Phase J·Slice J1·科举三指针 F1/F2/F3
 *
 * §A·F1 公式·备考/士人 ×500 + 私学冲击·clamp
 * §B·F2 公式·近9年新进士/总官员 ×400·clamp
 * §C·F3 公式·(0.6 偏远 + 0.4 解额公平 + 0.2 门生多样) ×100·clamp
 * §D·门生网络多样性·1 - HHI·从 GM._discipleGraph
 * §E·_kjUpdateIndicators 端到端·写 P.keju.indicators·不进 GM.vars·sparkline history
 * §F·signal 采集优先级·ctx > P.keju._indicatorSignals > reader > default
 * §G·keju 未启用 / 缺 P.keju·安全 no-op·公式纯性
 * §H·reader 真源采集·gongming(path/tier)/_cohortYear/_cc3 fallback (备考/士人/官员/新进士)
 * §I·解额公平·真源 adminHierarchy division.economyBase.kejuQuota 区划均匀度
 * §J·生产接线·index 注册 + normal/deferred 回合结算路径
 *
 * 运行·node web/scripts/smoke-keju-indicators.js   (本会话无 node·须回真仓跑)
 */

const fs = require('fs');
const path = require('path');

global.window = {};
require('../tm-keju-indicators.js');   // 模块挂 global.window

const I = global.window;
let pass = 0, fail = 0;
function check(label, ok) { if (ok) { pass++; console.log('  PASS', label); } else { fail++; console.log('  FAIL', label); } }
function approx(a, b) { return Math.abs(a - b) < 0.001; }

// ═══════════ §A·F1 ═══════════
console.log('=== §A·F1 备考/士人 ×500 + 私学冲击 ===');
check('A1·prep100/pool1000 → 50', I._kjCalcF1({ prepPool: 100, scholarPool: 1000 }) === 50);
check('A2·prep50/pool1000 → 25',  I._kjCalcF1({ prepPool: 50,  scholarPool: 1000 }) === 25);
check('A3·+私学冲击10 → 60',       I._kjCalcF1({ prepPool: 100, scholarPool: 1000, schoolImpact: 10 }) === 60);
check('A4·0.5×500=250 clamp→100',  I._kjCalcF1({ prepPool: 500, scholarPool: 1000 }) === 100);
check('A5·pool0 div-guard→100',    I._kjCalcF1({ prepPool: 10, scholarPool: 0 }) === 100);
check('A6·空 → 0',                 I._kjCalcF1({}) === 0);

// ═══════════ §B·F2 ═══════════
console.log('=== §B·F2 近9年新进士/总官员 ×400 ===');
check('B1·30/200 → 60',            I._kjCalcF2({ newJinshi9y: 30, totalOfficials: 200 }) === 60);
check('B2·10/200 → 20',            I._kjCalcF2({ newJinshi9y: 10, totalOfficials: 200 }) === 20);
check('B3·0.5×400=200 clamp→100',  I._kjCalcF2({ newJinshi9y: 100, totalOfficials: 200 }) === 100);
check('B4·官员0 div-guard→100',    I._kjCalcF2({ newJinshi9y: 5, totalOfficials: 0 }) === 100);
check('B5·空 → 0',                 I._kjCalcF2({}) === 0);

// ═══════════ §C·F3 ═══════════
console.log('=== §C·F3 0.6 偏远 + 0.4 解额公平 + 0.2 门生多样 ×100 ===');
check('C1·remote0.3/fair0.5/div0.4 → 46',
      I._kjCalcF3({ remoteJinshiRatio: 0.3, quotaFairness: 0.5, networkDiversity: 0.4 }) === 46);
check('C2·全1 → 1.2×100 clamp→100',
      I._kjCalcF3({ remoteJinshiRatio: 1, quotaFairness: 1, networkDiversity: 1 }) === 100);
check('C3·全0 → 0',
      I._kjCalcF3({ remoteJinshiRatio: 0, quotaFairness: 0, networkDiversity: 0 }) === 0);
check('C4·ratio>1 clamp到1 → 0.6×100=60',
      I._kjCalcF3({ remoteJinshiRatio: 5, quotaFairness: 0, networkDiversity: 0 }) === 60);
check('C5·空 → 0', I._kjCalcF3({}) === 0);

// ═══════════ §D·门生网络多样性 (1 - HHI) ═══════════
console.log('=== §D·networkDiversity 1 - HHI ===');
global.GM = { _discipleGraph: { byMentor: {} } };
check('D1·无 mentor → 0', I._kjIndicatorNetworkDiversity() === 0);
global.GM = { _discipleGraph: { byMentor: { A: { disciples: ['a', 'b', 'c', 'd'] } } } };
check('D2·单 mentor 独占 → 0', I._kjIndicatorNetworkDiversity() === 0);
global.GM = { _discipleGraph: { byMentor: { A: { disciples: ['a', 'b'] }, B: { disciples: ['c', 'd'] } } } };
check('D3·两 mentor 均分 → 0.5', approx(I._kjIndicatorNetworkDiversity(), 0.5));
global.GM = { _discipleGraph: { byMentor: {
  A: { disciples: ['a'] }, B: { disciples: ['b'] }, C: { disciples: ['c'] }, D: { disciples: ['d'] }
} } };
check('D4·四 mentor 均分 → 0.75', approx(I._kjIndicatorNetworkDiversity(), 0.75));
delete global.GM;

// ═══════════ §E·_kjUpdateIndicators 端到端 ═══════════
console.log('=== §E·_kjUpdateIndicators 写 P.keju.indicators ===');
global.GM = { year: 1600, _discipleGraph: { byMentor: { A: { disciples: ['a', 'b'] }, B: { disciples: ['c', 'd'] } } } };
global.P = { keju: { enabled: true, _indicatorSignals: {
  prepPool: 100, scholarPool: 1000, newJinshi9y: 30, totalOfficials: 200,
  remoteJinshiRatio: 0.3, quotaFairness: 0.5   // networkDiversity 留空·走真 reader (disciple graph=0.5)
} } };
const r = I._kjUpdateIndicators({});
check('E1·F1=50', global.P.keju.indicators.F1 === 50);
check('E2·F2=60', global.P.keju.indicators.F2 === 60);
// F3·remote0.3 fair0.5 div0.5(真reader) → 0.18+0.2+0.10=0.48 ×100=48
check('E3·F3=48 (div 走 disciple graph)', global.P.keju.indicators.F3 === 48);
check('E4·return 一致', !!r && r.F1 === 50 && r.F2 === 60 && r.F3 === 48);
check('E5·history 1 点·year=1600',
      global.P.keju.indicators.history.length === 1 && global.P.keju.indicators.history[0].year === 1600);
check('E6·不写 GM.vars 顶栏', !global.GM.vars);
// 同年重复调·history 不增·覆盖
I._kjUpdateIndicators({});
check('E7·同年重复·history 仍 1', global.P.keju.indicators.history.length === 1);
// 次年·history +1
global.GM.year = 1601;
I._kjUpdateIndicators({});
check('E8·次年·history=2', global.P.keju.indicators.history.length === 2);

// ═══════════ §F·signal 采集优先级 ═══════════
console.log('=== §F·ctx > P.keju._indicatorSignals > reader > default ===');
global.GM = { year: 1600 };
global.P = { keju: { enabled: true, _indicatorSignals: { prepPool: 100, scholarPool: 1000 } } };
const sig1 = I._kjGatherIndicatorSignals({ prepPool: 200 });   // ctx 覆盖 prepPool
check('F1·ctx 覆盖 prepPool=200', sig1.prepPool === 200);
check('F2·override scholarPool=1000', sig1.scholarPool === 1000);
check('F3·quotaFairness default 0.5', sig1.quotaFairness === 0.5);
check('F4·networkDiversity default 0 (无 graph)', sig1.networkDiversity === 0);

// ═══════════ §G·安全 no-op / 公式纯性 ═══════════
console.log('=== §G·未启用 / 缺 P.keju 安全 ===');
global.P = { keju: { enabled: false } };
check('G1·enabled=false → null', I._kjUpdateIndicators({}) === null);
global.P = {};
check('G2·缺 P.keju → null', I._kjUpdateIndicators({}) === null);
delete global.P; delete global.GM;
check('G3·缺 GM/P·公式仍纯 (F1=50)', I._kjCalcF1({ prepPool: 100, scholarPool: 1000 }) === 50);

// ═══════════ §H·reader 真源采集 (无 _indicatorSignals·走真 reader) ═══════════
// node 无 TMGongming/_cc3·_gongmingOf 直读 ch.resources.gongming·_isCourtOfficial 走通用词 fallback
console.log('=== §H·reader 真源·gongming/_cohortYear/官员判定 ===');
global.GM = { year: 1600, chars: [
  // 3 进士 (cohortYear 1600/1595 近科·1580 旧科)·均在朝
  { name: '甲', alive: true, resources: { gongming: { path: 'keju', tier: '进士' } }, _cohortYear: 1600, officialTitle: '翰林院编修' },
  { name: '乙', alive: true, resources: { gongming: { path: 'keju', tier: '进士' } }, _cohortYear: 1595, officialTitle: '主事' },
  { name: '丙', alive: true, resources: { gongming: { path: 'keju', tier: '进士' } }, _cohortYear: 1580, officialTitle: '尚书' },
  // 2 备考·举人/生员·未入仕 (无 officialTitle)
  { name: '丁', alive: true, resources: { gongming: { path: 'keju', tier: '举人' } } },
  { name: '戊', alive: true, resources: { gongming: { path: 'keju', tier: '生员' } } },
  // 举人已入仕 (知县)·计士人·不计备考·计官员
  { name: '己', alive: true, resources: { gongming: { path: 'keju', tier: '举人' } }, officialTitle: '知县' },
  // 武进士·特科 (cohort 近科)·计新进士 + 官员·不计 civil 备考/士人
  { name: '庚', alive: true, resources: { gongming: { path: 'junggong', tier: '武进士' } }, _cohortYear: 1599, _specialExamType: 'wuju', officialTitle: '参将' },
  // 布衣·无功名·全不计
  { name: '辛', alive: true, resources: { gongming: { path: 'buyi', tier: '' } } },
  // 死者·近科进士·alive=false 全不计
  { name: '壬', alive: false, resources: { gongming: { path: 'keju', tier: '进士' } }, _cohortYear: 1600, officialTitle: '侍郎' }
] };
global.P = { keju: { enabled: true } };   // 无 _indicatorSignals·走真 reader
const sigH = I._kjGatherIndicatorSignals({});
check('H1·总士人池=6 (进士甲乙丙 + 举人丁己 + 生员戊)', sigH.scholarPool === 6);
check('H2·备考池=2 (丁戊·己入仕排除·进士排除)',        sigH.prepPool === 2);
check('H3·总官员=5 (甲乙丙己庚·无衔丁戊辛排除·死者壬排除)', sigH.totalOfficials === 5);
check('H4·近9年新进士=3 (甲1600 乙1595 庚1599·丙1580超窗排除)', sigH.newJinshi9y === 3);

// ═══════════ §I·解额公平·真源 adminHierarchy economyBase.kejuQuota ═══════════
console.log('=== §I·解额公平·区划均匀度 ===');
global.GM = { year: 1600, adminHierarchy: { player: { divisions: [
  { name: '省甲', divisions: [ { economyBase: { kejuQuota: 30 } }, { economyBase: { kejuQuota: 30 } } ] },  // 60
  { name: '省乙', divisions: [ { economyBase: { kejuQuota: 60 } } ] }                                        // 60
] } } };
global.P = { keju: { enabled: true } };
check('I1·两省解额均分(60/60) → fairness=1', approx(I._kjGatherIndicatorSignals({}).quotaFairness, 1));
global.GM = { year: 1600, adminHierarchy: { player: { divisions: [
  { name: '省甲', divisions: [ { economyBase: { kejuQuota: 100 } } ] },   // 100
  { name: '省乙', divisions: [ { economyBase: { kejuQuota: 0 } } ] }       // 0
] } } };
check('I2·全集中一省(100/0) → fairness=0', approx(I._kjGatherIndicatorSignals({}).quotaFairness, 0));
global.GM = { year: 1600 };   // 无 adminHierarchy → 中性 0.5
check('I3·无解额数据 → fairness=0.5', I._kjGatherIndicatorSignals({}).quotaFairness === 0.5);
delete global.P; delete global.GM;

// ═══════════ §J·生产接线 ═══════════
console.log('=== §J·生产接线·index + normal/deferred endTurn ===');
const webRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(webRoot, 'index.html'), 'utf8');
const pipelineJs = fs.readFileSync(path.join(webRoot, 'tm-endturn-pipeline-steps.js'), 'utf8');
const indicatorsScriptPos = indexHtml.indexOf('tm-keju-indicators.js');
const kejuScriptPos = indexHtml.indexOf('tm-keju.js');
check('J1·index 注册 tm-keju-indicators.js', indicatorsScriptPos >= 0);
check('J2·指标模块先于 tm-keju.js 加载', indicatorsScriptPos >= 0 && kejuScriptPos >= 0 && indicatorsScriptPos < kejuScriptPos);
const indicatorCalls = pipelineJs.match(/_kjUpdateIndicators\s*\(/g) || [];
check('J3·回合管道恰有 normal/deferred 两个更新入口', indicatorCalls.length === 2);
check('J4·deferred 路径传入 deferred ctx 并有独立诊断',
      pipelineJs.includes('_kjUpdateIndicators(_dctx || ctx)') && pipelineJs.includes('[deferred·phase5] J1 indicators'));
check('J5·normal 路径传入 ctx 并有独立诊断',
      pipelineJs.includes('_kjUpdateIndicators(ctx)') && pipelineJs.includes('[pipeline.render-finalize] J1 indicators'));

// ═══════════ summary ═══════════
console.log('\n========================================');
console.log(`smoke-keju-indicators·${pass} PASS·${fail} FAIL`);
console.log('========================================');
process.exit(fail === 0 ? 0 : 1);
