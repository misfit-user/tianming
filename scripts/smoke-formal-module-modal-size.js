#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const formal = fs.readFileSync(path.join(ROOT, 'phase8-formal-bridge.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed += 1;
}

['edict', 'memorial', 'letter', 'records'].forEach((kind) => {
  assert(formal.includes(`tmf-module-overlay-${kind} .tmf-module`),
    `${kind} module overlay should have a targeted larger modal rule`);
  assert(formal.includes(`tmf-module-overlay-${kind} .tmf-module-body`),
    `${kind} module body should have a targeted wider column rule`);
});

assert(formal.includes('width:min(1560px,96vw);height:min(920px,92vh);'),
  'formal action modules should be wider and taller than the default 1360x820 shell');
assert(formal.includes('grid-template-columns:340px minmax(0,1fr) 320px;'),
  'formal action modules should give side columns and main content more room');
assert(formal.includes('@media(max-width:1080px)'),
  'larger formal action modules should keep a narrower viewport fallback');
assert(styles.includes('.tr-modal-wrap{width:min(1280px,96vw);height:min(900px,92vh);max-height:92vh;'),
  'turn-result / shiji detail modal should be enlarged');

console.log(`[smoke-formal-module-modal-size] PASS ${passed} assertions`);
