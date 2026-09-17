// Deterministic logical-ID migration. Never clone armies, money or people across split cells.
(function (root) {
  'use strict';
  var G = root.TM && root.TM.MapWorkbench;
  if (!G && typeof module !== 'undefined' && module.exports) G = require('./tm-map-workbench.js');
  var arr = function (x) {
      return Array.isArray(x) ? x : [];
    },
    clone = function (x) {
      return JSON.parse(JSON.stringify(x));
    };
  function fail(code, message, details) {
    var e = new Error(message);
    e.code = code;
    e.details = details || [];
    throw e;
  }
  var quantities = ['population', 'households', 'farmland', 'taxBase', 'money', 'grain', 'cloth'];
  function rows(s) {
    return arr(s.map && s.map.regions);
  }
  function totals(s) {
    var out = {
      regions: rows(s).length,
      armies: arr(s.military && s.military.initialTroops).length,
      soldiers: arr(s.military && s.military.initialTroops).reduce(function (n, a) {
        return n + (a.soldiers || 0);
      }, 0),
      characters: arr(s.characters).length,
    };
    quantities.forEach(function (k) {
      out[k] = rows(s).reduce(function (n, r) {
        return n + (typeof r[k] === 'number' ? r[k] : 0);
      }, 0);
    });
    return out;
  }
  function allocate(total, targets, map, integer) {
    if (!Number.isFinite(total) || total < 0 || (integer && !Number.isSafeInteger(total)))
      fail('binding-amount', '守恒量须为非负数，人口户数须为安全整数');
    var by = new Map(
        (map.cells || map.regions).map(function (c) {
          return [c.id, c];
        }),
      ),
      weights = targets.map(function (id) {
        return G.area(by.get(id).geometry);
      }),
      sum = weights.reduce(function (n, a) {
        return n + a;
      }, 0),
      values = weights.map(function (a) {
        return integer ? Math.floor((total * a) / sum) : (total * a) / sum;
      });
    var remainder =
      total -
      values.reduce(function (n, a) {
        return n + a;
      }, 0);
    if (integer) {
      targets
        .map(function (id, i) {
          return { id: id, index: i, fraction: (total * weights[i]) / sum - values[i] };
        })
        .sort(function (a, b) {
          return b.fraction - a.fraction || a.id.localeCompare(b.id);
        })
        .slice(0, remainder)
        .forEach(function (x) {
          values[x.index]++;
        });
    } else values[values.length - 1] += remainder;
    return values;
  }
  function inspect(s, map) {
    var issues = [],
      m = new Map(
        (map.cells || map.regions).map(function (c) {
          return [c.id, c];
        }),
      ),
      facs = new Set(
        arr(s.factions).map(function (f) {
          return f.id;
        }),
      ),
      seen = new Set();
    rows(s).forEach(function (r) {
      if (seen.has(r.id)) issues.push({ code: 'binding-duplicate', path: 'map.regions', id: r.id });
      seen.add(r.id);
      if (!m.has(r.id)) issues.push({ code: 'binding-map-missing', id: r.id });
      ['controllerFactionId', 'sovereignFactionId', 'taxAuthorityFactionId'].forEach(function (k) {
        if (r[k] && !facs.has(r[k])) issues.push({ code: 'binding-faction-missing', id: r.id, field: k, target: r[k] });
      });
    });
    function walk(o, path) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var v = o[k],
          p = path ? path + '.' + k : k;
        if (k === 'assets' || k === 'geometry' || k === 'coords') return;
        if (
          /^(regionId|mapRegionId|startRegionId|garrisonRegionId|capitalRegionId|sourceRegionId|targetRegionId)$/.test(
            k,
          ) &&
          v &&
          !m.has(v)
        )
          issues.push({ code: 'binding-reference-missing', path: p, target: v });
        if (['mappedRegions', 'regionIds'].indexOf(k) >= 0 && Array.isArray(v))
          v.forEach(function (id) {
            if (!m.has(id)) issues.push({ code: 'binding-reference-missing', path: p, target: id });
          });
        if (v && typeof v === 'object') walk(v, p);
      });
    }
    walk(s, '');
    return {
      ok: !issues.length,
      complete: true,
      diagnostics: issues,
      totals: totals(s),
      boundRegions: seen.size,
      unboundRegions: Array.from(m.keys()).filter(function (id) {
        return !seen.has(id);
      }),
    };
  }
  function rebind(s, oldMap, result, options) {
    options = options || {};
    var next = clone(s),
      map = result.map,
      rowsNext = [],
      mapping = new Map(
        arr(result.mapping).map(function (m) {
          return [m.oldId, m];
        }),
      ),
      by = new Map(
        (map.cells || map.regions).map(function (c) {
          return [c.id, c];
        }),
      ),
      acc = new Map(),
      unresolved = [];
    rows(s).forEach(function (r) {
      var change = mapping.get(r.id),
        targets = change ? change.targetIds : [r.id];
      if (
        targets.some(function (id) {
          return !by.has(id);
        })
      )
        fail('binding-mapping-target', 'ID 映射指向缺失地块');
      targets.forEach(function (id, i) {
        var out = acc.get(id),
          cell = by.get(id);
        if (!out) {
          out = clone(r);
          out.id = id;
          out.name = cell.name || r.name || id;
          delete out.coords;
          delete out.d;
          delete out.path;
          delete out.geometry;
          delete out.points;
          delete out.center;
          delete out.centroid;
          quantities.forEach(function (k) {
            if (typeof r[k] === 'number') out[k] = 0;
          });
          acc.set(id, out);
          rowsNext.push(out);
        }
        if (
          out.taxAuthorityFactionId !== r.taxAuthorityFactionId ||
          out.taxBaseResource !== r.taxBaseResource ||
          out.taxBaseUnit !== r.taxBaseUnit
        )
          fail('binding-tax-conflict', '不同税权或税基资源单位不能默认为同一税账；请先明确修订税收契约');
        if (out.controllerFactionId !== r.controllerFactionId || out.sovereignFactionId !== r.sovereignFactionId) {
          var policy = change && change.ownerPolicy;
          if (!policy || !policy.controllerFactionId || !policy.sovereignFactionId)
            fail('binding-owner-conflict', '不同控制或主权地块合并需要明确本年代政策，其他剧本仍保留旧图');
          out.controllerFactionId = policy.controllerFactionId;
          out.sovereignFactionId = policy.sovereignFactionId;
        }
        quantities.forEach(function (k) {
          if (typeof r[k] === 'number')
            out[k] = (out[k] || 0) + allocate(r[k], targets, map, k === 'population' || k === 'households')[i];
        });
      });
    });
    next.map = Object.assign({}, next.map, { id: map.id, regions: rowsNext });
    function target(old, obj, path) {
      var entry = mapping.get(old);
      if (!entry) return old;
      if (entry.targetIds.length === 1) return entry.targetIds[0];
      var explicit = options.referenceTargets && options.referenceTargets[path];
      if (explicit && entry.targetIds.indexOf(explicit) >= 0) return explicit;
      var p =
          obj.locationPoint || obj.point || (Number.isFinite(obj.x) && Number.isFinite(obj.y) ? [obj.x, obj.y] : null),
        hits = p
          ? entry.targetIds.filter(function (id) {
              return G.contains(by.get(id).geometry, p);
            })
          : [];
      if (hits.length === 1) return hits[0];
      unresolved.push({ path: path, oldId: old, targetIds: entry.targetIds, reason: '没有唯一驻点或明确迁移指令' });
      return old;
    }
    function walk(o, path) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var v = o[k],
          p = path ? path + '.' + k : k;
        if (k === 'assets' || k === 'geometry' || k === 'coords') return;
        if (
          /^(regionId|mapRegionId|startRegionId|garrisonRegionId|capitalRegionId|sourceRegionId|targetRegionId)$/.test(
            k,
          ) &&
          typeof v === 'string'
        )
          o[k] = target(v, o, p);
        else if (['mappedRegions', 'regionIds'].indexOf(k) >= 0 && Array.isArray(v))
          o[k] = Array.from(
            new Set(
              v.flatMap(function (id) {
                return mapping.has(id) ? mapping.get(id).targetIds : [id];
              }),
            ),
          );
        else if (v && typeof v === 'object') walk(v, p);
      });
    }
    walk(next, '');
    arr(result.control).forEach(function (op) {
      var r = rowsNext.find(function (r) {
        return r.id === op.regionId;
      });
      if (!r) fail('binding-control-region', '本剧本未绑定该地块');
      r.controllerFactionId = op.controllerFactionId;
    });
    if (unresolved.length) fail('binding-migration-unresolved', '迁移存在歧义；整包保留为候选，未应用', unresolved);
    var before = totals(s),
      after = totals(next);
    quantities.concat(['armies', 'soldiers', 'characters']).forEach(function (k) {
      if (Math.abs(before[k] - after[k]) > Math.max(1, Math.abs(before[k])) * 1e-12)
        fail('binding-conservation', '拆并未守恒：' + k);
    });
    var check = inspect(next, map);
    if (!check.ok) fail('binding-invalid', '迁移后的引用未通过校验', check.diagnostics);
    return {
      scenario: next,
      report: {
        schemaVersion: 'tm-map-id-mapping/1',
        mapping: clone(result.mapping),
        before: before,
        after: after,
        unresolved: [],
        otherBindings: '保留旧地图版本，未自动迁移',
        landAdjacency: result.after.adjacencyEdges,
      },
    };
  }
  root.TM = root.TM || {};
  root.TM.MapBindingWorkbench = { inspect: inspect, rebind: rebind, totals: totals, allocate: allocate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.MapBindingWorkbench;
})(typeof window !== 'undefined' ? window : globalThis);
