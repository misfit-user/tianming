#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const lifecycleSource = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const edictSource = fs.readFileSync(path.join(ROOT, 'tm-edict-parser.js'), 'utf8');
const authoritySource = fs.readFileSync(path.join(ROOT, 'tm-authority-complete.js'), 'utf8');

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error('[smoke-population-transfer-invariants] ' + message);
  passed++;
}

const hujiSource = fs.readFileSync(path.join(ROOT, 'tm-huji-engine.js'), 'utf8');
const schemaStart = hujiSource.indexOf('function _populationSchemaFailure');
const schemaEnd = hujiSource.indexOf('\n  // ═══════════════════════════════════════════════════════════════════\n  //  朝代默认参数', schemaStart);
assert(schemaStart >= 0 && schemaEnd > schemaStart, 'population schema owner is locatable in huji engine');

const context = {
  console,
  Number,
  Math,
  Date,
  Array,
  Object,
  String,
  Error,
  JSON,
  RegExp,
  Promise,
  setTimeout,
  clearTimeout,
  TM: {}
};
context.window = context;
context.global = context;
vm.createContext(context);
vm.runInContext(hujiSource.slice(schemaStart, schemaEnd), context, {
  filename: 'tm-huji-population-schema.js'
});

const schema = context.TM.PopulationSchema;
assert(schema && typeof schema.normalize === 'function' && typeof schema.transferCategory === 'function', 'central population schema API is installed');

const unchanged = {
  turn: 2,
  population: {
    national: { mouths: 300, households: 60 },
    hiddenCount: 4,
    fugitives: 5,
    byCategory: { bianhu: { mouths: 200 }, junhu: { mouths: 100 } }
  }
};
schema.normalize(unchanged, { source: 'smoke', allowLegacyNumericStrings: true });
assert(unchanged.population.national.mouths === 300 && unchanged.population.national.households === 60, 'normal save population values remain unchanged');

const missing = { turn: 3 };
schema.normalize(missing, {
  source: 'smoke-missing',
  allowLegacyNumericStrings: true,
  defaults: { nationalMouths: 5200, nationalHouseholds: 1000, hiddenPopulation: 12, nationalFugitives: 7 }
});
assert(missing.population.national.mouths === 5200 && missing.population.national.households === 1000, 'missing population receives scenario-backed national defaults');
assert(missing.population.hiddenCount === 12 && missing.population.fugitives === 7, 'missing hidden and fugitive counters receive explicit defaults');
assert(Array.isArray(missing._schemaNormalizationDiagnostics) && missing._schemaNormalizationDiagnostics.length > 0, 'safe population repairs remain diagnosable');

const missingNational = {
  population: {
    hiddenCount: 0,
    fugitives: 0,
    byCategory: { a: { mouths: 70, households: 14 }, b: { mouths: 30, households: 6 } }
  }
};
schema.normalize(missingNational, { source: 'smoke-derived', allowLegacyNumericStrings: true });
assert(missingNational.population.national.mouths === 100 && missingNational.population.national.households === 20, 'missing national summary is safely derived from category rows');

const legacyStrings = {
  population: {
    national: { mouths: '100000', households: '20000' },
    hiddenCount: '300',
    fugitives: '400',
    byCategory: { bianhu: { mouths: '90000' }, junhu: { mouths: '10000' } }
  }
};
schema.normalize(legacyStrings, { source: 'smoke-legacy', allowLegacyNumericStrings: true });
assert(legacyStrings.population.national.mouths === 100000 && legacyStrings.population.byCategory.junhu.mouths === 10000, 'legacy numeric strings migrate to finite numbers');

const legacyCategoryHouseholds = {
  population: {
    national: { mouths: 100, households: 20 },
    hiddenCount: 0,
    fugitives: 0,
    byCategory: { bianhu: { mouths: '100', households: '20.9' } }
  }
};
schema.normalize(legacyCategoryHouseholds, {
  source: 'smoke-category-households',
  allowLegacyNumericStrings: true
});
assert(legacyCategoryHouseholds.population.byCategory.bianhu.households === 20, 'category household numeric strings normalize in place under the integer population contract');
assert(legacyCategoryHouseholds._schemaNormalizationDiagnostics.some(function(row) {
  return row.field === 'population.byCategory.bianhu.households' && row.action === 'normalize-number';
}), 'category household normalization remains diagnosable');
assert(schema.validate(legacyCategoryHouseholds).ok === true, 'normalized category household values pass strict runtime validation');

for (const [label, value] of [
  ['NaN category households', NaN],
  ['negative category households', -1],
  ['invalid category household string', 'bad']
]) {
  const invalidHouseholds = {
    population: {
      national: { mouths: 100, households: 20 },
      hiddenCount: 0,
      fugitives: 0,
      byCategory: { bianhu: { mouths: 100, households: value } }
    }
  };
  assert(schema.validate(invalidHouseholds, { allowLegacyNumericStrings: true }).ok === false, label + ' fail validation');
  let normalizeFailed = false;
  try {
    schema.normalize(invalidHouseholds, { source: 'smoke-invalid-households', allowLegacyNumericStrings: true });
  } catch (error) {
    normalizeFailed = error && error.code === 'invalid-population-value';
  }
  assert(normalizeFailed, label + ' are rejected at the normalization boundary');
}

for (const [label, value] of [
  ['undefined', undefined],
  ['NaN', NaN],
  ['nonnumeric string', 'not-a-number'],
  ['negative', -1]
]) {
  const result = schema.finiteNonNegative(value, 'count', { allowLegacyNumericStrings: true });
  assert(result.ok === false && result.code === 'invalid-population-value', label + ' is rejected instead of becoming zero or NaN');
}

let transferWorld = {
  national: { mouths: 150, households: 30 },
  hiddenCount: 0,
  fugitives: 0,
  byCategory: { source: { mouths: 100 }, target: { mouths: 50 } }
};
const beforeTotal = transferWorld.byCategory.source.mouths + transferWorld.byCategory.target.mouths;
const limited = schema.transferCategory(transferWorld, {
  from: 'source', to: 'target', count: 1000, allowLegacyNumericStrings: true
});
assert(limited.ok && limited.actual === 100 && limited.requested === 1000 && limited.limitedBySource === true, 'over-large transfer is source-limited with a structured result');
assert(transferWorld.byCategory.source.mouths === 0 && transferWorld.byCategory.target.mouths === 150, 'source-limited transfer moves only available people');
assert(transferWorld.byCategory.source.mouths + transferWorld.byCategory.target.mouths === beforeTotal, 'category transfer conserves total population exactly');

const sameRow = { byCategory: { source: { mouths: 100 } } };
const same = schema.transferCategory(sameRow, {
  from: 'source', to: 'source', count: 50, allowLegacyNumericStrings: true
});
assert(same.ok && same.changed === false && same.actual === 0 && sameRow.byCategory.source.mouths === 100, 'same-category transfer is an explicit no-op');

const numericStrings = { byCategory: { source: { mouths: '20' }, target: { mouths: '5' } } };
const migratedTransfer = schema.transferCategory(numericStrings, {
  from: 'source', to: 'target', count: '7', allowLegacyNumericStrings: true
});
assert(migratedTransfer.ok && migratedTransfer.actual === 7 && numericStrings.byCategory.source.mouths === 13 && numericStrings.byCategory.target.mouths === 12, 'legacy numeric-string transfer is normalized and conserved');

for (const [label, sourceValue, targetValue, count] of [
  ['undefined source', undefined, 10, 1],
  ['NaN target', 10, NaN, 1],
  ['invalid request string', 10, 10, 'bad'],
  ['negative request', 10, 10, -2]
]) {
  const population = { byCategory: { source: { mouths: sourceValue }, target: { mouths: targetValue } } };
  const sourceBefore = population.byCategory.source.mouths;
  const targetBefore = population.byCategory.target.mouths;
  const result = schema.transferCategory(population, {
    from: 'source', to: 'target', count, allowLegacyNumericStrings: true
  });
  assert(result.ok === false && result.code === 'invalid-category-transfer-data', label + ' returns a structured failure');
  assert(Object.is(population.byCategory.source.mouths, sourceBefore) && Object.is(population.byCategory.target.mouths, targetBefore), label + ' does not partially mutate either category');
}

context.addEB = function() {};
context.GM = {
  population: {
    national: { mouths: 100, households: 20 },
    hiddenCount: 0,
    fugitives: 0,
    byCategory: { bianhu: { mouths: 80 }, junhu: { mouths: 20 } },
    meta: {}
  }
};
vm.runInContext(edictSource, context, { filename: 'tm-edict-parser.js' });
const edictTransfer = context.EdictParser.EDICT_TYPES.huji_reform.aiEntry({
  action: 'change_category', fromCategory: 'bianhu', toCategory: 'junhu', count: 1000
});
assert(edictTransfer.ok && edictTransfer.actual === 80 && edictTransfer.limitedBySource, 'edict category change returns the canonical structured transfer result');
assert(context.GM.population.byCategory.bianhu.mouths + context.GM.population.byCategory.junhu.mouths === 100, 'edict category change preserves the category total');

const linkageStart = authoritySource.indexOf('function _linkageFiscalFlow');
const linkageEnd = authoritySource.indexOf('\n  // ═══════════════════════════════════════════════════════════════════\n  //  P2-16', linkageStart);
assert(linkageStart >= 0 && linkageEnd > linkageStart, 'authority population linkage is locatable');
context._corrIndex = function() { return 30; };
context._addCorrIndex = function() {};
context._allowPassiveAuthorityLinkage = function() { return false; };
let capturedSchemaErrors = 0;
context.TM.errors = { capture() { capturedSchemaErrors++; } };
vm.runInContext(authoritySource.slice(linkageStart, linkageEnd), context, {
  filename: 'tm-authority-population-linkage.js'
});

context.GM = {
  turn: 4,
  neitang: { money: 4000000, balance: 4000000, ledgers: { money: { stock: 4000000, sources: {}, sinks: {}, thisTurnIn: 0, thisTurnOut: 0 } } },
  population: { national: { mouths: NaN, households: 20 }, hiddenCount: 0, fugitives: 0, byCategory: {} },
  huangquan: { index: 30 }
};
const purseBeforeInvalid = context.GM.neitang.money;
context._tickFullLinkage({}, 1);
assert(context.GM.neitang.money === purseBeforeInvalid && Number.isNaN(context.GM.population.national.mouths), 'invalid mouths skip grain-gift fiscal and population writes instead of propagating NaN');
assert(context.GM._populationSchemaDiagnostics.length === 1 && capturedSchemaErrors === 1, 'runtime population corruption emits bounded diagnostics');

context.GM = {
  turn: 5,
  neitang: { money: 4000000, balance: 4000000, ledgers: { money: { stock: 4000000, sources: {}, sinks: {}, thisTurnIn: 0, thisTurnOut: 0 } } },
  population: { hiddenCount: 7, fugitives: 0, byCategory: {} },
  huangquan: { index: 30 }
};
context._tickFullLinkage({}, 1);
assert(context.GM.population.hiddenCount === 7, 'missing national object does not crash or update weak-authority population linkage');

context.GM = {
  turn: 6,
  neitang: { money: 4000000, balance: 4000000, ledgers: { money: { stock: 4000000, sources: {}, sinks: {}, thisTurnIn: 0, thisTurnOut: 0 } } },
  population: { national: { mouths: 100000, households: 20000 }, hiddenCount: 0, fugitives: 0, byCategory: {} },
  huangquan: { index: 30 }
};
context._tickFullLinkage({}, 1);
assert(Number.isFinite(context.GM.population.national.mouths) && context.GM.population.national.mouths > 100000, 'valid grain gift adds a finite population amount');
assert(context.GM.neitang.money < 4000000 && context.GM.population.hiddenCount > 0, 'valid linkage updates both grain-gift spending and weak-authority hidden population');

assert(/populationSchema\.normalize\(GM,/.test(lifecycleSource), 'load/save default boundary invokes population normalization');
assert(/_normalizePopulationBoundary\(G, 'huji-new-game'/.test(hujiSource), 'new-game huji initialization invokes the same population schema');

console.log('[smoke-population-transfer-invariants] pass assertions=' + passed);
