import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-perf-save-preparation.js',(s,r)=>{
 s=r(s,'const h = saveBuilder(root), fixture = controlledWorld(s.data, long); h.c.GM = fixture.gm; h.c.P = fixture.p;','const h = saveBuilder(root), fixture = controlledWorld(s.data, long); h.c.GM = fixture.gm; h.c.P = fixture.p;\n  s.data = null; collectComparisonGarbage(); // The complete detached fixture already owns all source data.');
 s=r(s,"savedIdb = { actual: actualText, expected: expectedText };", "const bytes = Buffer.from(actualText, 'utf8'); savedIdb = { actual: bytes, expected: bytes };");
 s=r(s,"JSON.parse(typeof value === 'string' ? value : JSON.stringify(value))", "JSON.parse(Buffer.isBuffer(value) ? value.toString('utf8') : typeof value === 'string' ? value : JSON.stringify(value))");
 s=r(s,"    if (child.status !== 0 || !result) failed++;", "    if (child.status !== 0 || !result) { failed++; console.error('CASE_PROCESS_FAILURE', JSON.stringify({ index: i, status: child.status, signal: child.signal, error: child.error && child.error.message })); }");
 return s;
});
edit('web/scripts/smoke-start-game-data-integrity.js',(s,r)=>{
 s=r(s,'    return { map: hasRegions(sc.map) ? sc.map : null, mapData: hasRegions(sc.mapData) ? sc.mapData : null };','    return { mapJSON: hasRegions(sc.map) ? JSON.stringify(sc.map) : null, mapDataJSON: hasRegions(sc.mapData) ? JSON.stringify(sc.mapData) : null };');
 s=r(s,'  if (!TIANQI_MAP_SOURCE || !TIANQI_MAP_SOURCE.map) return false;','  if (!TIANQI_MAP_SOURCE || !TIANQI_MAP_SOURCE.mapJSON) return false;');
 s=r(s,'  sandbox.__tianqiMapJSON = JSON.stringify(TIANQI_MAP_SOURCE.map);','  sandbox.__tianqiMapJSON = TIANQI_MAP_SOURCE.mapJSON;');
 return r(s,'  sandbox.__tianqiMapDataJSON = TIANQI_MAP_SOURCE.mapData ? JSON.stringify(TIANQI_MAP_SOURCE.mapData) : sandbox.__tianqiMapJSON;','  sandbox.__tianqiMapDataJSON = TIANQI_MAP_SOURCE.mapDataJSON || sandbox.__tianqiMapJSON;');
});
