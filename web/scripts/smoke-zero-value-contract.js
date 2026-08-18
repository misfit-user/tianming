#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
let assertions = 0;
function ok(value, label) {
  if (!value) throw new Error('[smoke-zero-value-contract] ' + label);
  assertions++;
}

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing function ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
}

const utilsSource = fs.readFileSync(path.join(WEB, 'tm-utils.js'), 'utf8');
const finiteContext = {};
vm.createContext(finiteContext);
vm.runInContext(extractFunction(utilsSource, 'finiteNumberOr'), finiteContext);
const finiteNumberOr = finiteContext.finiteNumberOr;
ok(finiteNumberOr(0, 50) === 0 && finiteNumberOr(-0, 50) === 0, '共享数值读取器保留显式 0');
ok(finiteNumberOr(NaN, 7) === 7 && finiteNumberOr(Infinity, 7) === 7, '共享数值读取器拒绝 NaN/Infinity');
ok(finiteNumberOr('0', 7) === 7 && finiteNumberOr(null, 7) === 7, '共享数值读取器拒绝错误类型');

const workerSource = fs.readFileSync(path.join(WEB, 'tm-worker.js'), 'utf8');
const workerContext = { console };
workerContext.self = workerContext;
workerContext.postMessage = function() {};
vm.createContext(workerContext);
vm.runInContext(workerSource, workerContext);
const economy = workerContext._calcProvinceEconomyBatch({
  zero: { population: 0, prosperity: 0, corruption: 0, taxRate: 0 }
}, {}, 1 / 12);
ok(economy.zero.taxRevenue === 0 && economy.zero.population === 0, 'Worker 经济计算不复活零人口/零税率');
const battle = workerContext._calcBattleResult(
  { soldiers: 100, morale: 0, training: 100 },
  { soldiers: 100, morale: 100, training: 100 }, {}
);
ok(battle.ratio === 0 && battle.verdict === 'defeat', 'Worker 战斗计算不把零士气恢复为 50');

const economySource = fs.readFileSync(path.join(WEB, 'tm-economy.js'), 'utf8');
const inheritanceContext = { finiteNumberOr };
vm.createContext(inheritanceContext);
vm.runInContext(extractFunction(economySource, 'calculateInheritanceScore'), inheritanceContext);
ok(inheritanceContext.calculateInheritanceScore({ legitimacy: 0, ability: 0 }, {
  centralControl: 0, legitimacySource: '功绩', dynastyPhase: '初创期'
}) === 0, '继承评分保留零资格、零能力和零集权');

const guardedFiles = [
  'editor.js', 'tm-economy.js', 'tm-guoku-engine.js', 'tm-player-core.js',
  'tm-world.js', 'tm-worker.js', 'tm-map-system.js', 'map-display.js'
];
const stateFields = [
  'morale', 'strength', 'loyalty', 'ambition', 'population', 'prosperity', 'development',
  'taxRate', 'tributeRate', 'levyRate', 'redistributionRate', 'centralControl',
  'economicProsperity', 'politicalUnity', 'socialStability', 'culturalVibrancy',
  'bureaucracyStrength', 'militaryProfessionalism', 'legitimacy', 'ability',
  'satisfaction', 'influence', 'intelligence', 'administration', 'management',
  'charisma', 'diplomacy', 'benevolence', 'baseIncome', 'privateIncomeRatio',
  'tributeMultiplier', 'actualTaxRate', 'grainPrice', 'tombsCount', 'registeredTotal',
  'criticalThreshold', 'warningThreshold', 'maxLevel', 'baseCost', 'buildTime', 'startYear'
];
const fieldPattern = new RegExp('(?:' + stateFields.join('|') + ')[^\\r\\n]{0,80}\\|\\|\\s*-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)');
const violations = [];
guardedFiles.forEach(file => {
  fs.readFileSync(path.join(WEB, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (fieldPattern.test(line) && !/^\s*(?:\/\/|\*)/.test(line)) violations.push(file + ':' + (index + 1) + ':' + line.trim());
  });
});
ok(violations.length === 0, '关键数值状态不再使用 || numericDefault' + (violations.length ? '\n' + violations.join('\n') : ''));

console.log('[smoke-zero-value-contract] PASS assertions=' + assertions);
