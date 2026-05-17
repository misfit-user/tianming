'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const validityPath = path.join(ROOT, 'tm-endturn-validity.js');
const stepsPath = path.join(ROOT, 'tm-endturn-pipeline-steps.js');
const indexPath = path.join(ROOT, 'index.html');

assert(fs.existsSync(validityPath), 'tm-endturn-validity.js exists');

const validitySrc = fs.readFileSync(validityPath, 'utf8');
const stepsSrc = fs.readFileSync(stepsPath, 'utf8');
const indexSrc = fs.readFileSync(indexPath, 'utf8');

assert(/TM\.Endturn\.Validity/.test(validitySrc), 'TM.Endturn.Validity namespace exists');
assert(/validateBeforeCommit\s*[:=]\s*function/.test(validitySrc), 'validateBeforeCommit exported');
assert(/EndturnInvalidResultError/.test(validitySrc), 'invalid result error type exported or named');
assert(/status\s*:\s*['"]ok['"]/.test(validitySrc) && /status\s*:\s*['"]failed['"]/.test(validitySrc), 'validity returns ok/failed statuses');
assert(/sc1/.test(validitySrc) && /shizhengji/.test(validitySrc) && /zhengwen/.test(validitySrc), 'validity checks critical structured and narrative fields');

const loadValidity = indexSrc.indexOf('tm-endturn-validity.js');
const loadSteps = indexSrc.indexOf('tm-endturn-pipeline-steps.js');
assert(loadValidity >= 0 && loadValidity < loadSteps, 'validity module loads before pipeline steps');

const validateCall = stepsSrc.indexOf('TM.Endturn.Validity.validateBeforeCommit');
const systemsStep = stepsSrc.indexOf("name: 'systems'");
assert(validateCall >= 0, 'pipeline calls validateBeforeCommit');
assert(systemsStep >= 0 && validateCall < systemsStep, 'validity gate runs before systems step');
assert(/_lastEndturnValidity/.test(stepsSrc), 'pipeline stores last endturn validity diagnostics');
assert(/throw\s+/.test(stepsSrc.slice(validateCall, validateCall + 900)), 'pipeline aborts when validity gate fails');

console.log('[smoke-endturn-validity-gate] pass assertions=' + passed.value);
