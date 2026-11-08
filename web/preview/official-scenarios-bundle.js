/* GENERATED FILE. Source: ../scenarios/*.js（须先装载）. Run `node web/scripts/sync-official-scenarios.js`. */
(function(global){
  var KEY_BY_ID = {"sc-tianqi7-1627":"tianqi7","sc-jianyan1-1127-shaosong":"shaosong","sc-tang840-840":"tang840"};
  var registry = global.TMOfficialScenarioBuiltins;
  var out = {};
  Object.keys(KEY_BY_ID).forEach(function(id){
    if (!registry || !registry[id]) throw new Error("official-scenarios-bundle.js: 须先装载 ../scenarios/*.js（缺 " + id + "）");
    out[KEY_BY_ID[id]] = registry[id];
  });
  global.TM_OFFICIAL_SCENARIOS = out;
})(typeof window !== "undefined" ? window : globalThis);
