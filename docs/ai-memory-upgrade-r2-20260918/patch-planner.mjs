import { edit } from './patch-utils.mjs';
edit('web/tm-memory-adaptive.js', (s, r) => {
  s = r(s, "    var index = ['compact', 'balanced', 'deep'].indexOf(mode), reasons = [];", "    var plannerMode = tools === 'supported' ? 'native' : (json === 'supported' && recall === 'supported' && synthesis === 'supported' ? 'json' : 'local');\n    var index = ['compact', 'balanced', 'deep'].indexOf(mode), reasons = [];");
  s = r(s, 'verified: !!record, reasons: reasons, contextK: contextK,', "verified: !!(record && record.checks.some(function(c) { return c.state !== 'unavailable'; })), plannerMode: plannerMode, reasons: reasons, contextK: contextK,");
  s = r(s, "maxToolCalls: tools === 'supported' ? [2, 4, 6][index] : 0, maxRounds: tools === 'supported' && mode === 'deep' ? 2 : 1,", "maxToolCalls: plannerMode !== 'local' ? [2, 4, 6][index] : 0, maxRounds: plannerMode !== 'local' && mode === 'deep' ? 2 : 1,");
  return s;
});
edit('web/tm-memory-agent-tools.js', (s, r) => {
  const line = s.split('\n').find(line => line.includes("try { response = await root.callAIWithTools(prompt +"));
  if (!line) throw Error('Adaptive planner call missing');
  const newLine = line.trimEnd().replace('root.callAIWithTools(', '_requestRecallPlan(plan, ');
  s = r(s, line.trimEnd(), newLine);
  s = r(s, '  async function runAdaptiveRecall(GM, ctx) {', `  async function _requestRecallPlan(plan, prompt, definitions, options) {
    if (plan.plannerMode !== 'json') return root.callAIWithTools(prompt, definitions, options);
    if (typeof root.callAIMessages !== 'function') throw new Error('json_recall_planner_unavailable');
    var raw = await root.callAIMessages([{ role: 'system', content: 'Choose evidence retrieval tools. Return only strict JSON {"calls":[{"name":"tool_name","input":{}}]}. Do not fabricate evidence or return more than six calls. Tool definitions: ' + JSON.stringify(definitions) }, { role: 'user', content: prompt }], options.maxTok, options.signal || null, options.tier, options);
    var parsed = root.TM.MemoryAdaptive.strictJSON(raw);
    if (!parsed || !Array.isArray(parsed.calls)) throw new Error('invalid_json_recall_plan');
    return { toolCalls: parsed.calls.slice(0, 6), protocol: 'json' };
  }
  async function runAdaptiveRecall(GM, ctx) {`);
  s = r(s, '      for (var i = 0; i < calls.length; i++) {\n        var call = calls[i],', "      for (var i = 0; i < calls.length; i++) {\n        if (Date.now() >= deadline || (ctx.signal && ctx.signal.aborted)) break;\n        var call = calls[i],");
  return s;
});
