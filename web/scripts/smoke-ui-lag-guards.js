#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) {
    console.error('ASSERT FAIL:', msg);
    process.exit(1);
  }
}

function sliceBetween(src, start, end) {
  const a = src.indexOf(start);
  assert(a >= 0, `missing start marker: ${start}`);
  const b = src.indexOf(end, a + start.length);
  assert(b > a, `missing end marker: ${end}`);
  return src.slice(a, b);
}

const gameLoop = (read('tm-game-loop.js') + read('tm-game-loop-wentian-hardchange.js'));
const renwuUi = read('tm-renwu-ui.js');
const playerCore = read('tm-player-core.js');
const formalModules = read('phase8-formal-modules.js');
const calibrator = read('tm-party-class-llm-calibrator.js');

const afterHardChange = sliceBetween(
  gameLoop,
  'function _wtAfterHardChange',
  'function _wtCleanHardChangeToken'
);
assert(afterHardChange.includes('_wtScheduleHardChangeRefresh'), 'wentian hardChange must schedule a coalesced refresh');
[
  'renderGameState',
  'renderRenwu',
  'renderWenduiPanel',
  'renderShizhengPanel'
].forEach((name) => {
  assert(!new RegExp(`\\b${name}\\s*\\(`).test(afterHardChange), `_wtAfterHardChange must not synchronously call ${name}`);
});

assert(renwuUi.includes('function _rwAppendCardsChunked'), 'old renwu roster must append cards in chunks');
assert(renwuUi.includes('_rwRenderInitialLimit'), 'old renwu roster must cap initial synchronous cards');
assert(/requestIdleCallback|requestAnimationFrame/.test(renwuUi), 'old renwu roster chunking must yield between batches');

// 原先这里有三条守「人物详情页首屏不一次画完」的断言，对着的是 tm-player-core.js 里的旧 openCharRenwuPage。
// 那一页从来没被打开过：tm-renwu-tuzhi.js 后装载，把入口整个换掉。旧页 2026-11-16 已删，这三条跟着撤。
// 现行人物图志页目前没有对应的防卡守卫。
assert(!/function\s+openCharRenwuPage\s*\(/.test(playerCore), 'tm-player-core.js 不再带作废的旧人物志页');
assert(/window\.openCharRenwuPage\s*=\s*function/.test(read('tm-renwu-tuzhi.js')), '人物志入口由 tm-renwu-tuzhi.js 提供');

assert(formalModules.includes('function shouldCalibrateUiAction'), 'formal module UI action calibration must be gated');
assert(/shouldCalibrateUiAction\s*\(\s*action\s*,\s*data/.test(formalModules), 'recordUiActionSignal must consult the calibration gate');
assert(/partyClassLlmObserveUiClicks\s*===\s*true/.test(calibrator), 'global player-action observer must be opt-in');

console.log('smoke-ui-lag-guards OK');
