// smoke-wentian-hardchange.js - guard Wentian console hard-change paths and Tianyi direct writes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-game-loop.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const start = src.indexOf('function _wtNormalizeHardChangePath');
const end = src.indexOf('function _wtReviseFromPending');
assert(start >= 0 && end > start, 'Wentian hard-change helper block missing');

const context = {
  console,
  GM: {
    guoku: { money: 100, balance: 100, ledgers: { money: { stock: 100 } } },
    neitang: { money: 50, balance: 50, ledgers: { money: { stock: 50 } } },
    huangquan: { index: 50 },
    huangwei: { index: 60, subDims: { court: { value: 60 }, military: { value: 60 } } },
    minxin: { trueIndex: 45 },
    corruption: {
      trueIndex: 70,
      overall: 70,
      perceivedIndex: 65,
      byDept: {},
      subDepts: {
        central: { true: 70, perceived: 64 },
        fiscal: { true: 72 }
      }
    },
    chars: [
      { name: '甲', loyalty: 20 },
      {
        name: '袁崇焕',
        loyalty: 55,
        location: '宁远',
        place: '宁远',
        currentLocation: '宁远',
        loc: '宁远',
        _travelTo: '京师',
        _travelRemainingDays: 8,
        _travelReason: '赴召'
      }
    ],
    allCharacters: [
      {
        name: '袁崇焕',
        loyalty: 55,
        location: '宁远',
        place: '宁远',
        currentLocation: '宁远',
        loc: '宁远',
        _travelTo: '京师',
        _travelRemainingDays: 8,
        _travelReason: '赴召'
      }
    ],
    _listeners: { varChange: [] }
  },
  P: {},
  renderLeftPanel() {},
  renderGameState() {},
  renderGuokuPanel() {},
  renderNeitangPanel() {},
  renderRenwu() {},
  addEB() {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(src.slice(start, end), context, { filename: 'wentian-hardchange-block.js' });

assert(context._wtNormalizeHardChangePath('vars.皇权.value') === 'huangquan.index', '皇权 vars alias should target real huangquan index');
assert(context._wtNormalizeHardChangePath('vars.皇威.value') === 'huangwei.index', '皇威 vars alias should target real huangwei index');
assert(context._wtNormalizeHardChangePath('vars.腐败.value') === 'corruption.trueIndex', '腐败 vars alias should target real corruption index');
assert(context._wtNormalizeHardChangePath('chars[0].loyalty') === 'chars.0.loyalty', 'bracket index path should normalize');
assert(context._wtNormalizeHardChangePath('人物.袁崇焕.所在地') === 'chars.袁崇焕.location', 'Chinese character location path should normalize');
assert(context._wtNormalizeHardChangePath('characters.袁崇焕.currentLocation') === 'chars.袁崇焕.location', 'character currentLocation path should normalize');
assert(context._wtNormalizeHardChangePath('guoku.balance') === 'guoku.money', 'guoku balance alias should target money');
assert(context._wtNormalizeHardChangePath('neicang.money') === 'neitang.money', 'legacy neicang alias should target neitang money');

assert(context._wtApplyHardChange('vars.皇权.value', 'set', '88') === true, '皇权 alias hard change should apply');
assert(context.GM.huangquan.index === 88, '皇权 should write GM.huangquan.index');
assert(!context.GM.vars, 'Wentian should not create shadow GM.vars for core variables');

assert(context._wtApplyHardChange('vars.皇威.value', 'add', 5) === true, '皇威 alias hard change should apply');
assert(context.GM.huangwei.index === 65, '皇威 add should write GM.huangwei.index');
assert(context.GM.huangwei.subDims.court.value === 65, '皇威 direct set should sync sub dim values');

assert(context._wtApplyHardChange('vars.腐败.value', 'set', 25) === true, '腐败 alias hard change should apply');
assert(context.GM.corruption.trueIndex === 25, '腐败 should write trueIndex');
assert(context.GM.corruption.overall === 25, '腐败 should sync overall compatibility field');
assert(context.GM.corruption.subDepts.central.true === 25, '腐败 global direct set should sync sub dept true value');
assert(context.GM.corruption.subDepts.fiscal.true === 25, '腐败 global direct set should sync all sub dept true values');

assert(context._wtApplyHardChange('guoku.balance', 'add', 900) === true, 'guoku balance alias hard change should apply');
assert(context.GM.guoku.money === 1000 && context.GM.guoku.balance === 1000 && context.GM.guoku.ledgers.money.stock === 1000, 'guoku hard change should sync money/balance/ledger');

assert(context._wtApplyHardChange('neicang.money', 'set', 1200) === true, 'neicang alias hard change should apply');
assert(context.GM.neitang.money === 1200 && context.GM.neitang.balance === 1200 && context.GM.neitang.ledgers.money.stock === 1200, 'neitang hard change should sync money/balance/ledger');

assert(context._wtApplyHardChange('corruption.byDept.palace', 'set', 80) === true, 'legacy byDept hard change should apply');
assert(context.GM.corruption.subDepts.imperial.true === 80, 'byDept palace hard change should mirror to imperial subdept');
assert(Math.abs(context.GM.corruption.trueIndex - (130 / 3)) < 0.000001, 'byDept hard change should resync corruption trueIndex without engine');

assert(context._wtApplyHardChange('chars[0].loyalty', 'set', 99) === true, 'character bracket path should apply');
assert(context.GM.chars[0].loyalty === 99, 'character bracket path should write the indexed character');

assert(context._wtApplyHardChange('人物.袁崇焕.所在地', 'set', '京师') === true, 'character location by Chinese name should apply');
assert(context.GM.chars[1].location === '京师', 'character location should update real GM.chars item');
assert(context.GM.chars[1].place === '京师' && context.GM.chars[1].currentLocation === '京师' && context.GM.chars[1].loc === '京师', 'character location mirrors should sync');
assert(context.GM.allCharacters[0].location === '京师' && context.GM.allCharacters[0].place === '京师', 'allCharacters mirror should sync');
assert(!('_travelTo' in context.GM.chars[1]) && !('_travelRemainingDays' in context.GM.chars[1]), 'direct location set should clear stale travel state');
assert(!Object.prototype.hasOwnProperty.call(context.GM.chars, '袁崇焕'), 'name path should not create shadow property on chars array');

assert(context._wtApplyHardChange('chars.袁崇焕.location', 'set', '顺天府') === true, 'character location by chars.name path should apply');
assert(context.GM.chars[1].location === '顺天府', 'chars.name.location should write real character');

const inferred = context._wtAugmentParsedHardChange('天意让袁崇焕所在地改为京师', { category: 'absolute', structured: {} }, 'absolute');
assert(inferred.hardChange && inferred.hardChange.path === 'chars.袁崇焕.location' && inferred.hardChange.value === '京师', 'Tianyi location text should infer hardChange payload');

assert(src.includes("p.category === 'absolute'") && src.includes('p.hardChange && p.hardChange.path') && src.includes('_wtApplyHardChange(ahc.path'), 'Tianyi branch should immediately apply hardChange payloads');
assert(src.includes('category":"narrative|setting|hardChange|edictSubstitute|absolute"'), 'Wentian parser JSON schema should allow absolute category');

console.log('[smoke-wentian-hardchange] PASS');
