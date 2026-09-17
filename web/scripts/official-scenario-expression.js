'use strict';
// Build-time serializer. Large data are JSON text, not millions of JavaScript
// AST nodes. Parsing keeps values/property order and does not alias map copies.
function jsonExpression(value) {
  const raw = JSON.stringify(value);
  return raw.length < 32768 ? raw : 'JSON.parse(' + JSON.stringify(raw) + ')';
}
function serializeScenarioExpression(data) {
  if (!data || typeof data !== 'object' || !data.map || !data.mapData) return jsonExpression(data);
  const map = JSON.stringify(data.map);
  if (map !== JSON.stringify(data.mapData)) return jsonExpression(data);
  const entries = Object.keys(data).map(function(key) {
    const value = key === 'map' ? '_map' : key === 'mapData'
      ? 'JSON.parse(JSON.stringify(_map))' : jsonExpression(data[key]);
    return JSON.stringify(key) + ':' + value;
  });
  return '(function(){var _map=' + jsonExpression(data.map) + ';return {' + entries.join(',') + '};})()';
}
module.exports = { serializeScenarioExpression };
