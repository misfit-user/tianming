'use strict';
// Build-time only: avoid embedding the same complete map twice in aggregate
// bundles. Each consumer still receives independent map and mapData objects.
function serializeScenarioExpression(data) {
  if (!data || typeof data !== 'object' || !data.map || !data.mapData) return JSON.stringify(data);
  const map = JSON.stringify(data.map);
  if (map !== JSON.stringify(data.mapData)) return JSON.stringify(data);
  // Keep original property order so JSON roundtrip hashes remain stable.
  const entries = Object.keys(data).map(function(key) {
    const value = key === 'map' ? '_map' : key === 'mapData'
      ? 'JSON.parse(JSON.stringify(_map))' : JSON.stringify(data[key]);
    return JSON.stringify(key) + ':' + value;
  });
  return '(function(){var _map=' + map + ';return {' + entries.join(',') + '};})()';
}
module.exports = { serializeScenarioExpression };
