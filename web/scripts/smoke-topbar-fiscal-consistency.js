#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-topbar-vars.js'), 'utf8');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed += 1;
}

const sandbox = {
  console,
  setInterval() { return 1; },
  clearInterval() {},
  document: {
    readyState: 'complete',
    addEventListener() {},
    getElementById() { return null; },
    createElement() {
      return {
        className: '',
        innerHTML: '',
        style: {},
        appendChild() {},
        addEventListener() {},
        classList: { add() {}, remove() {}, contains() { return false; } }
      };
    },
    body: { appendChild() {} }
  },
  CurrencyUnit: {
    getUnit() { return { money: 'liang', grain: 'shi', cloth: 'pi' }; }
  },
  GM: {
    running: true,
    _prevGuoku: { money: 496000, grain: 12164000, cloth: 756000 },
    guoku: {
      money: 315000,
      balance: 315000,
      grain: 11439000,
      cloth: 807000,
      turnIncome: 1071000,
      turnExpense: 1174000,
      turnGrainIncome: 408000,
      turnGrainExpense: 596000,
      turnClothIncome: 0,
      turnClothExpense: 0,
      ledgers: {
        money: { stock: 220000 },
        grain: { stock: 11850000, turnDelta: -82000 },
        cloth: { stock: 910000, turnDelta: -106000 }
      }
    },
    _prevNeitang: { money: 1968000, grain: 19000, cloth: 255000 },
    neitang: {
      money: 3403000,
      balance: 3403000,
      grain: 0,
      cloth: 250000,
      turnIncome: 120000,
      turnExpense: 20000,
      ledgers: {
        money: { stock: 3300000 },
        grain: { stock: 19000, turnDelta: -19000 },
        cloth: { stock: 250000, turnDelta: -5040 }
      }
    },
    corruption: {},
    minxin: {},
    huangquan: {},
    huangwei: {}
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'tm-topbar-vars.js' });

const guoku = sandbox._renderGuoku();
assert(guoku.value === sandbox._barFmtNum(sandbox.GM.guoku.money), 'guoku main value must use scalar stock');
assert(guoku.subItems[0].v === sandbox._barFmtNum(sandbox.GM.guoku.money), 'guoku money stock must match scalar used by end-turn modal');
assert(guoku.subItems[0].d === sandbox.GM.guoku.money - sandbox.GM._prevGuoku.money, 'guoku money delta must match modal old-to-new delta');
assert(guoku.subItems[1].v === sandbox._barFmtNum(sandbox.GM.guoku.grain), 'guoku grain stock must match scalar used by end-turn modal');
assert(guoku.subItems[1].d === sandbox.GM.guoku.grain - sandbox.GM._prevGuoku.grain, 'guoku grain delta must match modal old-to-new delta');
assert(guoku.subItems[2].v === sandbox._barFmtNum(sandbox.GM.guoku.cloth), 'guoku cloth stock must match scalar used by end-turn modal');
assert(guoku.subItems[2].d === sandbox.GM.guoku.cloth - sandbox.GM._prevGuoku.cloth, 'guoku cloth delta must match modal old-to-new delta');

const neitang = sandbox._renderNeitang();
assert(neitang.value === sandbox._barFmtNum(sandbox.GM.neitang.money), 'neitang main value must use scalar stock');
assert(neitang.subItems[0].v === sandbox._barFmtNum(sandbox.GM.neitang.money), 'neitang money stock must match scalar used by end-turn modal');
assert(neitang.subItems[0].d === sandbox.GM.neitang.money - sandbox.GM._prevNeitang.money, 'neitang money delta must match modal old-to-new delta');
assert(neitang.subItems[1].v === sandbox._barFmtNum(sandbox.GM.neitang.grain), 'neitang grain stock must match scalar used by end-turn modal');
assert(neitang.subItems[1].d === sandbox.GM.neitang.grain - sandbox.GM._prevNeitang.grain, 'neitang grain delta must match modal old-to-new delta');
assert(neitang.subItems[2].v === sandbox._barFmtNum(sandbox.GM.neitang.cloth), 'neitang cloth stock must match scalar used by end-turn modal');
assert(neitang.subItems[2].d === sandbox.GM.neitang.cloth - sandbox.GM._prevNeitang.cloth, 'neitang cloth delta must match modal old-to-new delta');

// ── 回归·治"史记弹窗(_renderUnifiedChanges)与顶栏帑廪数值不一致" ──
//   病灶:弹窗原裸读 GM.guoku.money(且 typeof==='number' 守卫·money 缺失时整行跳过)·
//         顶栏走 _barAccountStock(.money 缺失→回落 .balance→回落账本 stock)→ 二者分歧。
//   修复:弹窗已改走同一 _barAccountStock(tm-endturn-render.js)。此处锚定该取数器的回落语义·
//         弹窗与顶栏从此同源同函数·缺失时不再跳过/分歧。
assert(typeof sandbox._barAccountStock === 'function', '_barAccountStock 取数器存在(弹窗与顶栏共用)');
assert(sandbox._barAccountStock({ money: 315000, balance: 999 }, 'money') === 315000, 'money 有值 → 优先 .money(与弹窗旧裸读同值·零回归)');
assert(sandbox._barAccountStock({ balance: 850000 }, 'money') === 850000, 'money 缺失 → 回落 .balance(顶栏/弹窗同源·开局 money 未定义时不再跳过银两行)');
assert(sandbox._barAccountStock({ ledgers: { money: { stock: 720000 } } }, 'money') === 720000, 'money+balance 缺失 → 回落账本 stock');
assert(sandbox._barAccountStock({ grain: 13000000 }, 'grain') === 13000000, 'grain 标量取数一致');
assert(sandbox._barAccountStock({}, 'money') === 0, '三源皆缺 → 0(不抛/不 NaN)');

vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-fiscal-statements.js'), 'utf8'), sandbox, { filename:'tm-fiscal-statements.js' });
sandbox.GM.turn=2;sandbox.GM._lastCascadeTurn=1;
Object.assign(sandbox.GM.guoku,{turnDays:10,turnIncome:17463000,monthlyIncome:17463000,turnExpense:2606000,monthlyExpense:2606000});
Object.assign(sandbox.GM.guoku.ledgers.money,{thisTurnIn:915557,thisTurnOut:1100000,sources:{tax:915557},sinks:{military:1100000}});
let fiscalBefore=JSON.stringify(sandbox.GM),actualTip=sandbox._renderGuoku().tip;
assert(actualTip.flows[0].val===sandbox._barFmtNum(915557),'old polluted save tooltip uses actual ledger income');
assert(actualTip.flows[1].val===sandbox._barFmtNum(1100000),'old polluted save tooltip uses actual ledger expenses');
assert(actualTip.flows[0].label==='上期回合入','tooltip records the actual ten-day previous period');
assert(actualTip.flows[2].val===sandbox._barFmtNum(915557*365/10),'annualization uses the recorded period');
assert(JSON.stringify(sandbox.GM)===fiscalBefore,'reading financial tooltip leaves save and stocks unchanged');
Object.assign(sandbox.GM.guoku.ledgers.money,{thisTurnIn:0,thisTurnOut:0,lastTurnIn:99999,lastTurnOut:88888});
actualTip=sandbox._renderGuoku().tip;assert(actualTip.flows[0].val==='0'&&actualTip.flows[1].val==='0','actual zero does not fall back to old monthly/previous income');
delete sandbox.GM._lastCascadeTurn;sandbox.GM.guoku={turnDays:10,monthlyIncome:300,monthlyExpense:150};
actualTip=sandbox._renderGuoku().tip;assert(actualTip.flows[0].label==='预计回合入'&&actualTip.flows[0].val==='100','unsettled monthly estimate is clearly forecast and prorated');
sandbox.GM._lastCascadeTurn=1;sandbox.GM.guoku={turnDays:10,turnIncome:17463000,monthlyIncome:17463000,turnExpense:2606000,ledgers:{money:{thisTurnOut:5}}};
actualTip=sandbox._renderGuoku().tip;assert(actualTip.flows[0].val==='待核'&&actualTip.flows[2].val==='待核','missing actual income direction stays unknown instead of fake income or zero');
assert(actualTip.flows[1].val==='5','known actual expenses remain visible beside unknown income');
console.log(`[smoke-topbar-fiscal-consistency] PASS ${passed} assertions`);
