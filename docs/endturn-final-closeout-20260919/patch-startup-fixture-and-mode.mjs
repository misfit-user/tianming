import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-full-turn-flow.js',(s,r)=>{
 s=r(s,'  const scripts = helpers.parseIndexHtmlScripts();',"  const scripts = helpers.parseIndexHtmlScripts({ includeLazyScenarios: false });");
 return r(s,'  const loadScripts = cutoff >= 0 ? scripts.slice(0, cutoff) : scripts;',`  const loadScripts = cutoff >= 0 ? scripts.slice(0, cutoff) : scripts;
  // Match the production lazy-loading path: load the entire selected scenario, not two unrelated worlds.
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'bundled-scenarios/manifest.json'), 'utf8'));
  const selected = catalog.entries.find(entry => entry.id === SID);
  assert(selected && selected.scriptUrl, 'full selected scenario must be present in the canonical catalog');
  assert(selected.counts.characters >= 100 && selected.counts.factions >= 10, 'selected fixture must retain its complete official population');
  if (!loadScripts.includes(selected.scriptUrl)) loadScripts.push(selected.scriptUrl);`);
});
edit('web/phase8-formal-map.js',(s,r)=>r(s,'  function getMapData(){','  function getMapData(){\n    if (window.GM && GM._useAIGeo === true) return null; // Explicit geography mode must not be changed by a read-only map panel.'));
