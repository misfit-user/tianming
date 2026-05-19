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

assert(formal.includes('width:min(1680px,98vw);height:min(980px,94vh);'),
  'formal action modules should be wider and taller than the default 1360x820 shell');
assert(formal.includes('grid-template-columns:340px minmax(0,1fr) 320px;'),
  'formal action modules should give side columns and main content more room');
assert(formal.includes('@media(max-width:1080px)'),
  'larger formal action modules should keep a narrower viewport fallback');
assert(formal.includes('tm-action-panel.edict-shell{left:50%;top:58px;width:min(1360px,calc(100vw - 72px));height:min(840px,calc(100vh - 86px));'),
  'edict action shell should be expanded');
assert(formal.includes('tm-action-panel.memorial-shell{left:40px;right:40px;top:64px;width:auto;height:min(820px,calc(100vh - 94px));'),
  'memorial action shell should be viewport-anchored and expanded');
assert(formal.includes('tm-bridge-overlay.show .tm-action-panel.memorial-shell{transform:none;}'),
  'memorial action shell should not be shifted by the generic show transform');
assert(formal.includes('tm-action-panel.letter-shell{left:50%;top:60px;width:min(1440px,calc(100vw - 64px));height:min(860px,calc(100vh - 90px));'),
  'letter action shell should be expanded');
assert(formal.includes('tm-action-panel.records-shell{left:40px;right:40px;top:64px;width:auto;height:min(830px,calc(100vh - 96px));'),
  'records action shell should be viewport-anchored and expanded');
assert(formal.includes('tm-bridge-overlay.show .tm-action-panel.records-shell{transform:none;}'),
  'records action shell should not be shifted by the generic show transform');
assert(formal.includes('tmf-module-overlay-renwu .renwu-atlas{width:min(1340px,calc(100vw - 54px));height:calc(100vh - 68px);'),
  'renwu atlas should be slightly taller');
assert(formal.includes('top:44px!important;transform:translateX(-50%)!important;margin:0!important;max-height:calc(100vh - 68px)!important;'),
  'renwu fixed overlay should keep the taller atlas anchored');
assert(styles.includes('.tr-modal-wrap{width:min(1480px,98vw);height:min(980px,94vh);max-height:94vh;'),
  'turn-result / shiji detail modal should be enlarged');

console.log(`[smoke-formal-module-modal-size] PASS ${passed} assertions`);
