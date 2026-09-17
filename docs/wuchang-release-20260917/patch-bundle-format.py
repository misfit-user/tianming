from pathlib import Path
r=Path('E:/tianming-wuchang-pages-20260917');p=r/'web/scripts/sync-official-scenarios.js';t=p.read_text(encoding='utf-8')
a="const path = require('path');";assert t.count(a)==1;t=t.replace(a,a+"\nconst { serializeScenarioExpression } = require('./official-scenario-expression.js');")
a=t.index('function serializeSeeder(entries) {');b=t.index('function serializeEditorResetData',a)
new='''function serializeSeeder(entries) {
  const bundle = '[' + entries.map((entry) => '{"filename":' + JSON.stringify(entry.filename.replace(/\\.json$/, ''))
    + ',"source":' + JSON.stringify('../' + entry.sourceRel)
    + ',"data":' + serializeScenarioExpression(entry.data) + '}').join(',') + ']';
  return '// GENERATED FILE. Source: ../scenarios/*（官方）.json. Run `node web/scripts/sync-official-scenarios.js`.\\n'
    + '(function(global){\\n'
    + '  global.TMOfficialScenarioBundle = ' + bundle + ';\\n'
    + '})(typeof window !== "undefined" ? window : globalThis);\\n';
}

function serializePreview(entries) {
  const bundle = '{' + entries.map((entry) => JSON.stringify(entry.key) + ':' + serializeScenarioExpression(entry.data)).join(',') + '}';
  return '/* GENERATED FILE. Source: ../../scenarios/*（官方）.json. Run `node web/scripts/sync-official-scenarios.js`. */\\n'
    + '(function(global){\\n'
    + '  global.TM_OFFICIAL_SCENARIOS = ' + bundle + ';\\n'
    + '})(typeof window !== "undefined" ? window : globalThis);\\n';
}

'''
t=t[:a]+new+t[b:];p.write_text(t,encoding='utf-8')
print('Aggregate serializer deduplicates only identical map data; canonical roots and per-scenario scripts unchanged.')
