'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), acorn = require('acorn');
const root = path.resolve(__dirname, '..');
function functions(file, wanted) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const found = {};
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && wanted.includes(node.id.name)) found[node.id.name] = source.slice(node.start, node.end);
    for (const value of Object.values(node)) if (value && typeof value === 'object') {
      if (Array.isArray(value)) value.forEach(visit); else visit(value);
    }
  }
  visit(acorn.parse(source, { ecmaVersion: 'latest' }));
  wanted.forEach(name => assert(found[name], file + ': ' + name));
  return wanted.map(name => found[name]).join('\n');
}
const context = vm.createContext({ fieldLabel: value => value });
vm.runInContext(functions('phase8-formal-map.js', ['firstValue', 'mapNum']), context);
vm.runInContext(functions('phase8-formal-map-dossier.js', ['bkTerrainText', 'bkDemographicBreakdown', 'bkPopulationGroup', 'fmtByAge']), context);
let cases = 0;
function check(value, message) { assert(value, message); cases++; }
check(context.bkTerrainText('plains') === '平原', 'terrain code becomes player language');
check(context.bkTerrainText('unknown_code') === '', 'unknown terrain is not invented');
check(context.bkTerrainText('LIVE terrain field 901') === 'LIVE terrain field 901', 'authored free text remains available in any language');
check(context.bkTerrainText(['山间谷地', 'coast']) === '山间谷地、滨海', 'authored terrain retained');
const ages = context.fmtByAge({ age_0_10: 26936, age_71_plus: 6734 });
check(ages.includes('0—10岁') && ages.includes('71岁以上') && !ages.includes('age_'), 'distinct age bands displayed');
check(context.bkPopulationGroup({ han: 0.98, other: 0.02 }, 'ethnicity') === '汉人 98% / 其他族属 2%', 'fractions cannot round to one and zero people');
check(context.bkPopulationGroup({ folk: 0.6, buddhist: 0.2 }, 'faith') === '民间祠祀 60% / 佛教 20%', 'faith labels and percentage units');
check(context.bkPopulationGroup({ 汉人: 13500, 回回: 40 }, 'ethnicity') === '汉人 1.4万 / 回回 40', 'absolute population stays a count');
const data = { byFaith: { folk: 0.6 }, demographicAccounting: { unverifiedBreakdowns: ['byFaith'] } };
const original = JSON.stringify(data);
check(context.bkDemographicBreakdown(data, 'byFaith') === null, 'unverified automatic details are hidden');
check(JSON.stringify(data) === original, 'presentation does not erase simulation data');
check(context.bkDemographicBreakdown({ byFaith: { 佛教: 0.2 } }, 'byFaith').佛教 === 0.2, 'explicit details in other scenarios remain available');
console.log('PASS map-demographic-display ' + cases + ' cases');
