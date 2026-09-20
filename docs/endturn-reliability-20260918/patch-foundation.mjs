import { edit } from './patch-utils.mjs';
edit('web/index.html', (s, r) => {
  for (const name of ['tm-memory-adaptive.js','tm-memory-long-term.js','tm-memory-hybrid.js']) {
    const tag = s.match(new RegExp('<script src="' + name.replaceAll('.', '\\.') + '[^"]*"><\\/script>'));
    if (!tag) throw Error('Missing memory loader: ' + name);
    s = r(s, tag[0] + '\n', '');
  }
  const json = s.match(/<script src="tm-ai-infra-json\.js[^\"]*"><\/script>/)[0];
  s = r(s, json, ['tm-memory-adaptive.js','tm-memory-long-term.js','tm-memory-hybrid.js'].map(f=>'<script src="'+f+'?v=20260918-memory-r2"></script>').join('\n') + '\n' + json);
  const infra = s.match(/<script src="tm-ai-infra\.js[^\"]*"><\/script>/)[0];
  if (!s.includes('src="tm-ai-infra-retry.js')) s = r(s, infra, '<script src="tm-ai-infra-retry.js?v=20260823-auditfix18-context"></script>\n' + infra);
  const save = s.match(/<script src="tm-save-lifecycle\.js[^\"]*"><\/script>/)[0];
  if (!s.includes('src="tm-save-world-validation.js')) s = r(s, save, '<script src="tm-save-world-validation.js?v=20260918-reliability"></script>\n' + save);
  const military = s.match(/<script src="tm-military\.js[^\"]*"><\/script>/)[0];
  if (!s.includes('src="tm-battle-contract.js')) s = r(s, military, '<script src="tm-battle-contract.js?v=20260918-reliability"></script>\n' + military);
  const core = s.match(/<script src="tm-endturn-core\.js[^\"]*"><\/script>/)[0];
  s = r(s, core, '<script src="tm-endturn-reliability.js?v=20260918-reliability"></script>\n' + core);
  return s;
});
edit('web/tm-endturn-core.js', (s, r) => {
  s = r(s, '  var _turnTxn = null;', '  var _turnTxn = null;\n  var _reliability = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.Reliability;\n  var _turnScope = null;');
  s = r(s, '  if(GM.busy)return;\n  _turnTxn =', '  if(GM.busy)return;\n  if (_reliability) { _turnScope = _reliability.begin(); _reliability.assertReady(P); _reliability.mark(_turnScope, "prepare"); }\n  _turnTxn =');
  s = r(s, '  _obsCtx.meta.transaction = _turnTxn;', '  _obsCtx.meta.transaction = _turnTxn;\n  if (_reliability) { _obsCtx.meta.reliabilityScope = _turnScope; _reliability.mark(_turnScope, "pipeline"); }');
  s = r(s, "    console.error('endTurn error:', error);", "    if (_reliability) _reliability.finish(_turnScope, 'failed', error);\n    console.error('endTurn error:', error);");
  return s;
});
edit('web/tm-endturn-core.js', (s, r) => {
  s = r(s, '  var saved = await ctx.meta.endTurnSavePromise;', '  var reliability = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.Reliability;\n  if (reliability) reliability.mark(ctx.meta.reliabilityScope, "save");\n  var saved = await ctx.meta.endTurnSavePromise;');
  const start = s.indexOf('async function _tmFinalizeEndTurnTransaction('), end = s.indexOf('\nif (typeof window', start);
  const fn = s.slice(start, end), tail = '  return true;';
  if (fn.split(tail).length !== 2) throw Error('Finalizer completion point must be unique');
  return r(s, fn, fn.replace(tail, '  if (reliability) reliability.finish(ctx.meta.reliabilityScope, ctx.results && ctx.results.renderError ? "committed_display_pending" : "committed");\n' + tail));
});
