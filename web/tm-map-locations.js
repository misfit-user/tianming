// Live entity locations. Map-specific names stay in the scenario, not in engine code.
(function (global) {
  'use strict';
  var cache = new WeakMap();
  var SCHEMA = 'source-text-location-v2';
  // 写的是去向，不是人在哪
  var GOING = /待赴任|路上|途中|往来/;
  function norm(value) { return typeof value === 'string' ? value.trim().replace(/（/g, '(').replace(/）/g, ')') : ''; }
  // 有地块的地图都绑定。写了契约的（天启、绍宋）另有别名、粗区和行在口径；没写的（晚唐、工坊剧本）只认地块的名
  function enabled(map) { return !!(map && Array.isArray(map.regions) && map.regions.length); }
  function index(map) {
    var old = cache.get(map);
    if (old && old.rows === map.regions && old.aliases === map.locationAliases && old.areas === map.locationAreas) return old;
    var idx = { rows: map.regions, aliases: map.locationAliases, areas: map.locationAreas, ids: new Map(), names: new Map(), areaNames: new Map(), keysOf: new Map() };
    function add(text, id, factionId) {
      var key = norm(text); if (!key || !idx.ids.has(id)) return;
      var rows = idx.names.get(key) || [];
      if (!rows.some(function (r) { return r.id === id && r.factionId === factionId; })) rows.push({ id: id, factionId: factionId || '' });
      idx.names.set(key, rows);
      // 反查：这块地叫过哪些名（排「文字里先写哪处」用）
      var keys = idx.keysOf.get(id) || [];
      if (keys.indexOf(key) < 0) keys.push(key);
      idx.keysOf.set(id, keys);
    }
    (map.regions || []).forEach(function (r) { if (r && r.id) idx.ids.set(String(r.id), r); });
    idx.ids.forEach(function (r, id) {
      add(id, id); add(r.name, id); (r.aliases || []).forEach(function (a) { if (typeof a === 'string') add(a, id); });
      // 没写契约的地图没有别名表：「京兆府·长安」拆开的每一段都认
      if (!map.locationBindingContract) [r.name, r.title].forEach(function (n) { add(n, id); String(n || '').split(/[·・]/).forEach(function (part) { add(part, id); }); });
    });
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
    // A future biography or extinct character is not a present location.
    if (kind === 'character' && /已殁|已故|已卒|已死|\d{4}.*(?:归后|年后)/.test(raw)) return result('unresolved', [], 'not-a-current-point');
    // 「札布让·往来玛域道」：去向之前的才是人在哪；整段都是去向（「北上路上」「往来大理」）就没有落点
    var place = raw;
    if (kind === 'character' && GOING.test(raw)) {
      var clauses = [];
      raw.split(/[·・]/).some(function (part) { if (GOING.test(part)) return true; clauses.push(part); return false; });
      place = clauses.join('·');
      if (!place) return result('unresolved', [], 'not-a-current-point');
    }
    var direct = idsFor(place);
    // 地块本名压过别块的别名：「庆州」是宋的庆州，不和别名叫庆州的契丹庆州两可
    if (unique(direct).length > 1) {
      var named = unique(direct).filter(function (id) { return idx.ids.get(id).name === place; });
      if (named.length === 1) direct = named;
    }
    if (direct.length) return result(unique(direct).length === 1 ? 'resolved' : 'ambiguous', direct, 'exact-name-or-alias');
    var exactArea = idx.areaNames.get(place);
    if ((map.locationBindingContract || {}).exactAreaPriority && exactArea) return result('area', exactArea, 'explicit-area-not-exact-point');
    // Parentheses describe alternatives or plans; do not let a longer future place win.
    var head = place.split('(')[0].trim();
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
  function readPlace(text, map, game) {
    var idsOf = function (hit) { return hit.regionId ? [hit.regionId] : (hit.candidateRegionIds || []); };
    var ids = idsOf(resolveText(text, map, null, 'character', game, true));
    if (ids.length) return ids;
    // 势力专属的别名（日本的「京」）要带上人才认得：找一个写着这个地名的人
    var who = (game.chars || game.characters || []).find(function (c) { return c && c.location === text; });
    return who ? idsOf(resolveText(text, map, who, 'character', game, true)) : [];
  }
  function placeIds(text, map, game) {
    var idx = index(map), cache = idx.places || (idx.places = new Map());
    if (cache.has(text)) return cache.get(text);
    var ids = readPlace(text, map, game);
    if (!ids.length && typeof _locAliasOf === 'function' && typeof _LOC_ALIASES !== 'undefined') {
      // 同一处的别称挨个认：京城写「北京」，地图上这块叫顺天府
      var group = _locAliasOf(String(text).split(/[·・]/)[0].trim());
      var names = group ? Object.keys(_LOC_ALIASES) : [];
      for (var i = 0; i < names.length && !ids.length; i++) {
        if (_LOC_ALIASES[names[i]] === group) ids = readPlace(names[i], map, game);
      }
    }
    cache.set(text, ids);
    return ids;
  }
  // 一段地名落在哪些地块。通称先换成实地（京师是当朝京城，行在是天子此刻所在）；粗区（「河北」）和两可（「徐州／邳州」）给多个候选，认不出给空
  function placeRegionIds(text, game) {
    game = game || global.GM; var map = game && (game.mapData || game.map);
    if (!text || !enabled(map)) return [];
    var raw = String(text), real = typeof _locRealPlaceText === 'function' ? _locRealPlaceText(raw) : raw;
    var ids = placeIds(real, map, game);
    return (ids.length || real === raw) ? ids : placeIds(raw, map, game);
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
  // ── 一支军总在一块地上（11-23 同志定：地块编号做根，文字只作说明）──
  // 文字认出唯一一块就落那块。认出几处（「宁远-锦州」「福建沿海」）就在这几处里取一块当代表点：原来就在其中的不动，
  // 原来在别处的取离原驻地最近的，开局还没有驻地的取文字里先写的那处（粗区照剧本列的次序取头一块，即首府）。
  // 一处也认不出：有原驻地就留在原驻地；没有就落主将所在，再不然落本家治所，最后落本家疆域当中那块。
  // 剧本写明散驻各地的总账（dispersed，如「全国卫所军·总览」）不是驻在某处的一支军，不落地块。
  function centerOf(r) {
    var c = r && (r.center || r.centroid);
    if (Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1])) return [Number(c[0]), Number(c[1])];
    if (c && isFinite(c.x) && isFinite(c.y)) return [Number(c.x), Number(c.y)];
    return null;
  }
  function nearest(ids, point, idx) {
    if (!point) return ids[0];
    var best = ids[0], bestD = Infinity;
    ids.forEach(function (id) {
      var c = centerOf(idx.ids.get(id)); if (!c) return;
      var d = (c[0] - point[0]) * (c[0] - point[0]) + (c[1] - point[1]) * (c[1] - point[1]);
      if (d < bestD) { bestD = d; best = id; }
    });
    return best;
  }
  // 文字里先写的那处排前（「宁远-锦州」宁远在前）；文字里一处也没写到的（粗区）照原来的次序
  function byMention(ids, text, idx) {
    var at = function (id) {
      var first = Infinity;
      (idx.keysOf.get(id) || []).forEach(function (k) { var i = k.length >= 2 ? text.indexOf(k) : -1; if (i >= 0 && i < first) first = i; });
      return first;
    };
    return ids.map(function (id, n) { return { id: id, at: at(id), n: n }; })
      .sort(function (a, b) { return (a.at === b.at ? 0 : a.at < b.at ? -1 : 1) || a.n - b.n; })
      .map(function (x) { return x.id; });
  }
  function liveChar(game, id, name) {
    return (game.chars || game.characters || []).find(function (c) { return c && ((id && c.id === id) || (name && c.name === name)); }) || null;
  }
  function commanderRegion(entity, game, map) {
    var ch = liveChar(game, entity.commanderId, norm(entity.commander));
    if (!ch || ch.alive === false || ch.dead === true) return '';
    var b = ch.mapLocationBinding || {};
    if (b.regionId && index(map).ids.has(String(b.regionId))) return String(b.regionId);
    return resolveText(ch.location, map, ch, 'character', game, true).regionId || '';
  }
  function factionSeat(entity, game, map) {
    var fid = entityFaction(entity, game), name = entity.faction || entity.factionName || entity.owner;
    var f = (game.facs || game.factions || []).find(function (x) { return x && ((fid && String(x.id) === fid) || (name && x.name === name)); });
    if (!f) return null;
    var idx = index(map), cap = norm(f.capital || f.capitalName || '');
    if (cap) {
      var hit = resolveText(cap, map, entity, 'army', game, true);
      var ids = (hit.regionId ? [hit.regionId] : hit.candidateRegionIds || []).filter(function (id) { return idx.ids.has(id); });
      if (ids.length) return { id: byMention(ids, hit.sourceText, idx)[0], method: 'faction-seat' };
    }
    var keys = [f.id, f.name].filter(Boolean).map(String);
    var own = (map.regions || []).filter(function (r) {
      var owner = r && (r.currentOwner != null && r.currentOwner !== '' ? r.currentOwner : r.owner);
      return r && r.id && owner != null && keys.indexOf(String(owner)) >= 0;
    }).map(function (r) { return String(r.id); });
    if (!own.length) return null;
    var pts = own.map(function (id) { return centerOf(idx.ids.get(id)); }).filter(Boolean);
    var mid = pts.length ? [pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length] : null;
    return { id: nearest(own, mid, idx), method: 'faction-territory' };
  }
  function settleArmy(out, entity, game, map, b) {
    var idx = index(map);
    var prev = [b.regionId, entity.garrisonRegionId, entity.regionId, entity.mapRegionId]
      .map(function (v) { return v == null ? '' : String(v); }).filter(function (id) { return id && idx.ids.has(id); })[0] || '';
    var cands = (out.candidateRegionIds || []).filter(function (id) { return idx.ids.has(id); });
    var pick = null;
    if (cands.length) {
      if (prev && cands.indexOf(prev) >= 0) pick = { id: prev, method: 'kept-within-named-places' };
      else if (prev) pick = { id: nearest(cands, centerOf(idx.ids.get(prev)), idx), method: 'nearest-named-place' };
      else pick = { id: byMention(cands, out.sourceText, idx)[0], method: out.status === 'area' ? 'area-first-region' : 'first-named-place' };
    } else if (prev) {
      pick = { id: prev, method: 'kept-previous-region', keep: true };
    } else {
      var cmd = commanderRegion(entity, game, map);
      pick = cmd ? { id: cmd, method: 'commander-region' } : factionSeat(entity, game, map);
    }
    if (!pick || !pick.id) return out;
    out.regionId = pick.id; out.regionName = idx.ids.get(pick.id).name; out.method = pick.method;
    if (pick.keep && b.regionId === prev && out.sourceText === norm(b.sourceText) && b.method) {
      // 文字没变：上回怎么落的照旧（开局落在主将所在的，不会下一回改口成「沿用原地」）
      out.status = b.status || 'kept'; out.method = b.method; out.precision = b.precision || 'representative';
    } else if (pick.keep) {
      out.status = 'kept'; out.precision = b.precision === 'region' ? 'region' : 'representative';
    } else {
      out.status = 'representative'; out.precision = 'representative';
    }
    if (pick.keep && out.sourceText) out.unreadText = out.sourceText;
    if (out.candidateRegionIds.indexOf(pick.id) < 0) out.candidateRegionIds = out.candidateRegionIds.concat([pick.id]);
    return out;
  }
  // 写口用：这段文字落不落得到地图上（认出一块或几块都算；一处也认不出才算落不了）。没有地块的剧本一概放行
  function readable(text, entity, kind, game) {
    game = game || global.GM; var map = game && (game.mapData || game.map);
    if (!enabled(map)) return true;
    var raw = norm(String(text == null ? '' : text)); if (!raw) return false;
    var out = resolveText(raw, map, entity || null, kind || 'army', game);
    return !!(out.regionId || (out.candidateRegionIds || []).length || placeRegionIds(raw, game).length);
  }
  function read(entity, kind, game, text) {
    game = game || global.GM; var map = game && (game.mapData || game.map);
    if (!entity || !enabled(map)) return null;
    var raw = typeof text === 'string' ? norm(text) : currentText(entity, kind);
    if (kind === 'army' && entity.dispersed === true) return { status: 'dispersed', candidateRegionIds: [], sourceText: raw, method: 'dispersed-not-one-camp' };
    var out = resolveText(raw, map, entity, kind, game), b = entity.mapLocationBinding || {};
    if (out.status === 'unresolved' && raw) {
      // 写「京师」「行在」的：通称换成实地再认。人只认唯一一块；军认出几块就交给下面取代表点
      var place = placeRegionIds(raw, game);
      if (place.length === 1) {
        out.status = 'resolved'; out.regionId = place[0]; out.regionName = index(map).ids.get(place[0]).name;
        out.precision = 'region'; out.method = 'place-text'; out.candidateRegionIds = place;
      } else if (place.length > 1 && kind === 'army') {
        out.status = 'ambiguous'; out.method = 'place-text'; out.candidateRegionIds = place;
      }
    }
    // Broad original deployments retain their explicitly documented operational anchor; it is not an exact camp claim.
    // 文字改了就不再按这个参考点认新文字；新文字一处也认不出时军留在原地（settleArmy），仍只记作代表点。
    var representative = b.precision === 'representative' || b.method === 'explicit-regional-representative-not-exact-camp';
    var sameText = raw === norm(b.sourceText || b.originalText);
    var oldId = b.regionId || entity.garrisonRegionId || entity.regionId || entity.mapRegionId;
    if (!out.regionId && kind === 'army' && representative && sameText && index(map).ids.has(oldId)) {
      // 上回就落在这块的，状态与来由照旧（开局落在本家治所的，不会下一回改口成「原部署参考点」）
      var sameSpot = String(b.regionId || '') === String(oldId);
      out.regionId = oldId; out.regionName = index(map).ids.get(oldId).name;
      out.status = (sameSpot && b.status) || 'representative'; out.precision = 'representative'; out.method = (sameSpot && b.method) || 'original-deployment-reference';
      out.candidateRegionIds = unique(out.candidateRegionIds.concat([oldId]));
    }
    if (!raw && index(map).ids.has(oldId)) {
      out.regionId = oldId; out.regionName = index(map).ids.get(oldId).name; out.status = 'resolved'; out.precision = 'region'; out.method = 'explicit-id-without-text';
    }
    if (kind === 'army' && !out.regionId) settleArmy(out, entity, game, map, b);
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
    if (!out.unreadText) delete binding.unreadText;
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
  // 每回合对齐人物的地块绑定：不是每个写所在地的地方都记得同步
  function syncCharacters(game) {
    game = game || global.GM; if (!game || !enabled(game.mapData || game.map)) return 0;
    var n = 0;
    (game.chars || game.characters || []).forEach(function (entity) { if (entity) { sync(entity, 'character', game); n++; } });
    return n;
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
  global.TMMapLocations = { schema: SCHEMA, enabled: enabled, read: read, sync: sync, syncWorld: syncWorld, syncDestination: syncDestination, resolveText: resolveText, placeRegionIds: placeRegionIds, syncCharacters: syncCharacters, readable: readable };
})(typeof window !== 'undefined' ? window : globalThis);
