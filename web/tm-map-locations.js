// Live entity locations. Map-specific names stay in the scenario, not in engine code.
(function (global) {
  'use strict';
  var cache = new WeakMap();
  var SCHEMA = 'source-text-location-v2';
  function norm(value) { return typeof value === 'string' ? value.trim().replace(/（/g, '(').replace(/）/g, ')') : ''; }
  function enabled(map) { return !!(map && map.locationBindingContract && map.locationBindingContract.schema === SCHEMA); }
  function index(map) {
    var old = cache.get(map);
    if (old && old.rows === map.regions && old.aliases === map.locationAliases && old.areas === map.locationAreas) return old;
    var idx = { rows: map.regions, aliases: map.locationAliases, areas: map.locationAreas, ids: new Map(), names: new Map(), areaNames: new Map() };
    function add(text, id, factionId) {
      var key = norm(text); if (!key || !idx.ids.has(id)) return;
      var rows = idx.names.get(key) || [];
      if (!rows.some(function (r) { return r.id === id && r.factionId === factionId; })) rows.push({ id: id, factionId: factionId || '' });
      idx.names.set(key, rows);
    }
    (map.regions || []).forEach(function (r) { if (r && r.id) idx.ids.set(String(r.id), r); });
    idx.ids.forEach(function (r, id) { add(id, id); add(r.name, id); (r.aliases || []).forEach(function (a) { if (typeof a === 'string') add(a, id); }); });
    (map.locationAliases || []).forEach(function (a) { if (a) add(a.text, a.regionId, a.factionId); });
    (map.locationAreas || []).forEach(function (a) { if (a && a.text) idx.areaNames.set(norm(a.text), (a.regionIds || []).filter(function (id) { return idx.ids.has(id); })); });
    cache.set(map, idx); return idx;
  }
  function entityFaction(entity, game) {
    if (entity && entity.factionId) return String(entity.factionId);
    var name = entity && (entity.faction || entity.factionName || entity.owner);
    var faction = game && (game.facs || game.factions || []).find(function (f) { return f && (f.name === name || f.id === name); });
    return faction ? String(faction.id) : '';
  }
  function unique(values) { return Array.from(new Set(values)); }
  function resolveText(text, map, entity, kind, game, noCourt) {
    var raw = norm(text), idx = index(map), factionId = entityFaction(entity, game);
    function result(status, ids, method) {
      ids = unique(ids || []);
      var out = { status: status, candidateRegionIds: ids, sourceText: raw, method: method || status };
      if (status === 'resolved' && ids.length === 1) { out.regionId = ids[0]; out.regionName = idx.ids.get(ids[0]).name; out.precision = 'region'; }
      return out;
    }
    function idsFor(key) { return (idx.names.get(key) || []).filter(function (r) { return !r.factionId || r.factionId === factionId; }).map(function (r) { return r.id; }); }
    if (!raw) return result('unresolved', [], 'no-location-text');
    if (idx.ids.has(raw)) return result('resolved', [raw], 'explicit-region-id');
    // A destination, future biography or extinct character is not a present location.
    if (kind === 'character' && /已殁|已故|已卒|已死|\d{4}.*(?:归后|年后)|待赴任|北上路上|北行途中|往来/.test(raw)) return result('unresolved', [], 'not-a-current-point');
    var direct = idsFor(raw);
    if (direct.length) return result(unique(direct).length === 1 ? 'resolved' : 'ambiguous', direct, 'exact-name-or-alias');
    var exactArea = idx.areaNames.get(raw);
    if (map.locationBindingContract.exactAreaPriority && exactArea) return result('area', exactArea, 'explicit-area-not-exact-point');
    // Parentheses describe alternatives or plans; do not let a longer future place win.
    var head = raw.split('(')[0].trim();
    var tokens = head.split(/[·／/、，,；;\s]+/).filter(Boolean), hits = [];
    tokens.forEach(function (token) { hits = hits.concat(idsFor(token)); });
    if (!hits.length) {
      var phrases = [];
      idx.names.forEach(function (_, key) { if (key.length >= 2 && head.indexOf(key) >= 0 && !/^ssr-/.test(key)) phrases.push(key); });
      phrases = phrases.filter(function (key) { return !phrases.some(function (larger) { return larger !== key && larger.indexOf(key) >= 0; }); });
      phrases.forEach(function (key) { hits = hits.concat(idsFor(key)); });
    }
    hits = unique(hits);
    if (hits.length) return result(hits.length === 1 && !/[／/]/.test(head) ? 'resolved' : 'ambiguous', hits, 'current-clause');
    var areas = [];
    idx.areaNames.forEach(function (ids, name) { if (tokens.indexOf(name) >= 0 || head === name) areas = areas.concat(ids); });
    if (areas.length) return result('area', areas, 'named-area-not-a-single-camp');
    var contract = map.locationBindingContract || {};
    if (!noCourt && /^(行在|随驾|行在·随驾)$/.test(head) && factionId === contract.courtFactionId) {
      var court = game && (game.chars || game.characters || []).find(function (c) { return c && c.id === contract.courtCharacterId; });
      if (court && court !== entity && norm(court.location)) {
        var live = resolveText(court.location, map, court, 'character', game, true);
        if (live.regionId) return result('resolved', [live.regionId], 'live-itinerant-court');
      }
      if ((!court || !norm(court.location)) && idx.ids.has(contract.courtStartRegionId)) return result('resolved', [contract.courtStartRegionId], 'scenario-itinerant-court');
    }
    return result('unresolved', [], 'no-unique-current-location');
  }
  function currentText(entity, kind) {
    if (kind !== 'army') return norm(entity.location);
    var b = entity.mapLocationBinding || {}, g = norm(entity.garrison), l = norm(entity.location);
    if (b.schema === SCHEMA) {
      var gChanged = g !== norm(b.observedGarrison), lChanged = l !== norm(b.observedLocation);
      if (lChanged && !gChanged && l) return l;
      if (gChanged && !lChanged && g) return g;
    } else if (l && l !== norm(b.originalText) && g === norm(b.originalText)) return l;
    return g || l;
  }
  function read(entity, kind, game, text) {
    game = game || global.GM; var map = game && (game.mapData || game.map);
    if (!entity || !enabled(map)) return null;
    var raw = typeof text === 'string' ? norm(text) : currentText(entity, kind);
    var out = resolveText(raw, map, entity, kind, game), b = entity.mapLocationBinding || {};
    // Broad original deployments retain their explicitly documented operational anchor.
    // A later text change may never reuse that anchor, and it is not an exact camp claim.
    var representative = b.precision === 'representative' || b.method === 'explicit-regional-representative-not-exact-camp';
    var sameText = raw === norm(b.sourceText || b.originalText);
    var oldId = b.regionId || entity.garrisonRegionId || entity.regionId || entity.mapRegionId;
    if (!out.regionId && kind === 'army' && representative && sameText && index(map).ids.has(oldId)) {
      out.regionId = oldId; out.regionName = index(map).ids.get(oldId).name;
      out.status = 'representative'; out.precision = 'representative'; out.method = 'original-deployment-reference';
      out.candidateRegionIds = unique(out.candidateRegionIds.concat([oldId]));
    }
    if (!raw && index(map).ids.has(oldId)) {
      out.regionId = oldId; out.regionName = index(map).ids.get(oldId).name; out.status = 'resolved'; out.precision = 'region'; out.method = 'explicit-id-without-text';
    }
    return out;
  }
  function sync(entity, kind, game, text) {
    game = game || global.GM; var out = read(entity, kind, game, text); if (!out) return null;
    var old = entity.mapLocationBinding || {};
    if (kind === 'army' && (typeof text === 'string' || (old.schema === SCHEMA && out.sourceText !== norm(old.sourceText)))) {
      entity.location = out.sourceText; entity.garrison = out.sourceText;
    }
    var binding = Object.assign({}, old, out, { schema: SCHEMA, originalText: old.originalText || out.sourceText, observedLocation: norm(entity.location), observedGarrison: norm(entity.garrison) });
    if (!out.regionId) { delete binding.regionId; delete binding.regionName; delete binding.precision; }
    entity.mapLocationBinding = binding;
    ['regionId', 'mapRegionId'].concat(kind === 'army' ? ['garrisonRegionId'] : []).forEach(function (key) {
      if (out.regionId) entity[key] = out.regionId; else delete entity[key];
    });
    if (kind === 'army') { if (out.regionId) entity.garrisonRegionName = out.regionName; else delete entity.garrisonRegionName; }
    syncDestination(entity, kind, game);
    var map = game && (game.mapData || game.map), contract = map && map.locationBindingContract;
    if (kind === 'character' && contract && entity.id === contract.courtCharacterId && old.sourceText !== out.sourceText) {
      ['chars', 'allCharacters', 'armies'].forEach(function (key) {
        (game[key] || []).forEach(function (follower) {
          var followerKind = key === 'armies' ? 'army' : 'character';
          if (follower && follower !== entity && /^(行在|随驾|行在·随驾)$/.test(currentText(follower, followerKind))) sync(follower, followerKind, game);
        });
      });
    }
    return out;
  }
  function syncDestination(entity, kind, game) {
    game = game || global.GM; var map = game && (game.mapData || game.map); if (!enabled(map) || !entity) return null;
    var text = kind === 'army' ? entity.destination : entity._travelTo;
    var out = resolveText(text, map, entity, kind, game);
    var key = kind === 'army' ? 'destinationRegionId' : 'travelTargetRegionId';
    if (out.regionId) entity[key] = out.regionId; else delete entity[key];
    return out;
  }
  function syncWorld(game) {
    game = game || global.GM; if (!game || !enabled(game.mapData || game.map)) return null;
    var summary = { characters: 0, armies: 0, unresolved: 0, representative: 0 };
    function run(rows, kind, key) {
      (rows || []).forEach(function (entity) {
        if (!entity) return; var out = sync(entity, kind, game); summary[key]++;
        if (!out.regionId) summary.unresolved++;
        if (out.precision === 'representative') summary.representative++;
      });
    }
    run(game.chars || game.characters, 'character', 'characters');
    run(game.armies || (game.military && game.military.initialTroops), 'army', 'armies');
    return summary;
  }
  global.TMMapLocations = { schema: SCHEMA, enabled: enabled, read: read, sync: sync, syncWorld: syncWorld, syncDestination: syncDestination, resolveText: resolveText };
})(typeof window !== 'undefined' ? window : globalThis);
