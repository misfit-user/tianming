import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
let direct = '';
edit('web/tm-ai-infra.js', (s, r) => {
  const start = s.indexOf('async function _callAIMessagesStreamDirect('), end = s.indexOf('async function callAIMessagesStream(', start);
  if (start < 0 || end < start) throw Error('Stream function boundaries missing');
  direct = s.slice(start, end);
  return r(s, direct, '// Stream transport implementation is owned by the preceding tm-ai-infra-retry.js.\n');
});
edit('web/tm-ai-infra-retry.js', s => s + '\n// Stream transport shares the timeout and cancellation owner.\n' + direct);
edit('web/index.html', (s, r) => {
  for (const [child, parent] of [['tm-save-world-validation.js','tm-save-lifecycle.js'],['tm-battle-contract.js','tm-military.js']]) {
    const find = name => s.match(new RegExp('<script src="' + name.replaceAll('.', '\\.') + '\\?v=([^\"]+)"[^>]*><\\/script>'));
    const a = find(child), b = find(parent); if (!a || !b) throw Error('Script family tag missing');
    if (a[1] !== b[1]) s = r(s, a[0], a[0].replace('?v=' + a[1], '?v=' + b[1]));
  }
  return s;
});
console.log('Relocated stream transport:',direct.split('\n').length,'lines');
