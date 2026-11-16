const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const code = (fs.readFileSync(path.join(root, 'tm-wendui.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'tm-wendui-persona-views.js'), 'utf8'));

const sandbox = {
  console,
  window: {},
  document: {},
  GM: { wenduiHistory: {}, chars: [], turn: 1 },
  P: { playerInfo: {}, ai: {} },
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  escHtml: (s) => String(s == null ? '' : s),
  _$: () => null,
  findCharByName: () => null,
  toast: () => {},
};
sandbox.globalThis = sandbox;

vm.runInNewContext(code, sandbox, { filename: 'tm-wendui.js' });

function assert(name, ok) {
  if (!ok) {
    console.error('[wendui-json-leak-guard] FAIL:', name);
    process.exit(1);
  }
  console.log('[wendui-json-leak-guard] PASS:', name);
}

const brokenJsonWithReply =
  '{"reply":"臣以为东江不可骤乱，应先稳军心，再分其兵柄。","loyaltyDelta":0,' +
  '"suggestions":[{"topic":"针对毛文龙兵权","content":"可联络旧部称\\"海上豪杰\\"者，先行分权。"}],' +
  '"toneEffect":"语重心长且透着杀伐果断","memoryImpact":{"event":"我意识到陛下猜忌已深","emotion":"焦虑","importance":9},"emotionState":"从容"}';

const parsedFallback = { zhengwen: brokenJsonWithReply };
const resolved = sandbox._wdResolveAudienceReplyText('袁崇焕', {}, parsedFallback, brokenJsonWithReply);
assert('malformed JSON fallback extracts reply only', resolved === '臣以为东江不可骤乱，应先稳军心，再分其兵柄。');
assert('resolved reply does not leak control fields', !/toneEffect|memoryImpact|emotionState|suggestions/.test(resolved));

assert('stream preview sanitizer exists', typeof sandbox._wdVisibleReplyPreview === 'function');
const preview = sandbox._wdVisibleReplyPreview(brokenJsonWithReply);
assert('stream preview hides JSON control fields', !/toneEffect|memoryImpact|emotionState|suggestions/.test(preview));
assert('stream preview keeps visible dialogue', preview.includes('东江不可骤乱'));

const brokenJsonWithoutReply =
  '{"content":"臣请陛下缓图其事，先安军心，再择亲信分领东江兵马。","loyaltyDelta":0,' +
  '"toneEffect":"语重心长","memoryImpact":{"event":"我感到陛下已有决断","emotion":"敬","importance":7}}';
const readableFallback = sandbox._wdSanitizeDialogueReplyText('袁崇焕', {}, null, brokenJsonWithoutReply);
assert('malformed JSON without reply preserves readable content', readableFallback.includes('臣请陛下缓图其事'));
assert('readable fallback strips control fields', !/loyaltyDelta|toneEffect|memoryImpact/.test(readableFallback));

const previewUseCount = (code.match(/_wdVisibleReplyPreview\(txt\)/g) || []).length;
assert('both wendui streaming paths use visible preview sanitizer', previewUseCount >= 2);
