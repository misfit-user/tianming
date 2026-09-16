// Pure, bounded geometry operations. Geometry is neutral; ownership lives in the scenario binding.
(function (root) {
  'use strict';
  var clip = root.polygonClipping;
  if (!clip && typeof module !== 'undefined' && module.exports) clip = require('./libs/polygon-clipping-0.15.7.min.js');
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
  function cells(map) {
    var rows = map && (map.cells || map.regions);
    if (!Array.isArray(rows) || !rows.length || rows.length > 20000) fail('map-cells', '底图需要 1–20000 个逻辑地块');
    return rows;
  }
  function polys(g) {
    if (!g || ['Polygon', 'MultiPolygon'].indexOf(g.type) < 0 || !Array.isArray(g.coordinates))
      fail('map-geometry', '仅接受明确的 Polygon/MultiPolygon');
    return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  }
  function shape(p) {
    return { type: 'MultiPolygon', coordinates: p };
  }
  function ringArea(r) {
    var a = 0;
    for (var i = 1; i < r.length; i++) a += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1];
    return Math.abs(a) / 2;
  }
  function area(g) {
    return polys(g).reduce(function (n, p) {
      return (
        n +
        ringArea(p[0]) -
        p.slice(1).reduce(function (a, r) {
          return a + ringArea(r);
        }, 0)
      );
    }, 0);
  }
  function bbox(g) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    polys(g).forEach(function (p) {
      p.forEach(function (r) {
        r.forEach(function (v) {
          b[0] = Math.min(b[0], v[0]);
          b[1] = Math.min(b[1], v[1]);
          b[2] = Math.max(b[2], v[0]);
          b[3] = Math.max(b[3], v[1]);
        });
      });
    });
    return b;
  }
  function overlaps(a, b, t) {
    return a[0] <= b[2] + t && a[2] + t >= b[0] && a[1] <= b[3] + t && a[3] + t >= b[1];
  }
  function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  function same(a, b, t) {
    return distance(a, b) <= t;
  }
  function cross(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }
  function pointRing(pt, r) {
    var hit = false;
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
      var a = r[i],
        b = r[j];
      if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  function contains(g, p) {
    return polys(g).some(function (poly) {
      return (
        pointRing(p, poly[0]) &&
        !poly.slice(1).some(function (h) {
          return pointRing(p, h);
        })
      );
    });
  }
  function hit(map, pt) {
    return cells(map)
      .filter(function (c) {
        return contains(c.geometry, pt);
      })
      .map(function (c) {
        return c.id;
      });
  }
  function limits(map, options) {
    var bs = cells(map).map(function (c) {
        return bbox(c.geometry);
      }),
      b = bs.reduce(function (a, b) {
        return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
      }),
      scale = Math.max(1, ...b.map(Math.abs));
    var meta = map.topologyParameters || {},
      t = options && options.coordinateTolerance;
    if (t == null) t = meta.coordinateTolerance;
    if (t == null) t = scale * Number.EPSILON * 64;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > scale / 100000)
      fail('map-tolerance', '容差无效或超过图幅尺度的十万分之一；不能扩大容差掩盖错误');
    var edge = options && options.minSharedLength;
    if (edge == null) edge = meta.minSharedLength;
    if (edge == null) edge = t * 4;
    if (typeof edge !== 'number' || !Number.isFinite(edge) || edge < 0)
      fail('map-adjacency-length', '最短陆地共享边须为非负长度');
    return {
      coordinateTolerance: t,
      minSharedLength: edge,
      areaTolerance: Math.max(Number.EPSILON, t * (b[2] - b[0] + b[3] - b[1]) * 2),
      bbox: b,
      areaUnit: map.coordinateSystemId === 'wgs84' ? 'square-degrees-not-geographic-area' : 'coordinate-units²',
      maxComparisons: 2000000,
    };
  }
  function validate(map) {
    if (!clip) fail('map-engine-missing', '几何引擎未加载');
    if (!map.id || !map.version || !map.coordinateSystemId) fail('map-identity', '底图须声明 ID、版本和坐标系统');
    var seen = new Set(),
      points = 0,
      comparisons = 0;
    cells(map).forEach(function (c) {
      if (typeof c.id !== 'string' || !c.id || seen.has(c.id)) fail('map-region-id', '逻辑地块 ID 缺失或重复');
      seen.add(c.id);
      var p = polys(c.geometry);
      if (!p.length) fail('map-empty', '不能删除逻辑地块的全部岛屿');
      p.forEach(function (poly) {
        if (!poly.length) fail('map-ring', '缺外环');
        poly.forEach(function (r) {
          if (!Array.isArray(r) || r.length < 4 || !same(r[0], r[r.length - 1], 0))
            fail('map-ring-open', '环须闭合且至少有三个顶点：' + c.id);
          points += r.length;
          if (points > 500000) fail('map-complexity', '超过 50 万顶点预算，未宣称全图通过');
          r.forEach(function (v) {
            if (
              !Array.isArray(v) ||
              v.length !== 2 ||
              !v.every(Number.isFinite) ||
              v.some(function (n) {
                return Math.abs(n) > 1e9;
              })
            )
              fail('map-coordinate', '坐标无效');
            if (map.coordinateSystemId === 'wgs84' && (Math.abs(v[0]) > 180 || Math.abs(v[1]) > 90))
              fail('map-wgs84-range', '经纬度超范围，不能将游戏像素声称为 WGS84');
          });
          var edges = r
              .slice(1)
              .map(function (v, i) {
                return {
                  a: r[i],
                  b: v,
                  i: i,
                  box: [
                    Math.min(v[0], r[i][0]),
                    Math.min(v[1], r[i][1]),
                    Math.max(v[0], r[i][0]),
                    Math.max(v[1], r[i][1]),
                  ],
                };
              })
              .sort(function (a, b) {
                return a.box[0] - b.box[0];
              }),
            active = [];
          edges.forEach(function (e) {
            active = active.filter(function (x) {
              return x.box[2] >= e.box[0];
            });
            active.forEach(function (x) {
              if (!overlaps(x.box, e.box, 0) || Math.abs(x.i - e.i) === 1 || Math.abs(x.i - e.i) === r.length - 2)
                return;
              if (++comparisons > 2000000) fail('map-complexity', '自交扫描预算已用尽，结果为未完成');
              if (cross(x.a, x.b, e.a) * cross(x.a, x.b, e.b) < 0 && cross(e.a, e.b, x.a) * cross(e.a, e.b, x.b) < 0)
                fail('map-self-intersection', '多边形边界自交：' + c.id);
            });
            active.push(e);
          });
        });
        if (
          ringArea(poly[0]) <= 0 ||
          poly.slice(1).some(function (h) {
            return area(shape(clip.difference([h], [poly[0]]))) > 0;
          })
        )
          fail('map-invalid-hole', '内环越过外环或面积无效：' + c.id);
      });
      if (area(c.geometry) <= 0) fail('map-area', '地块面积非正：' + c.id);
    });
    return { points: points, regions: seen.size };
  }
  function segments(g) {
    var out = [];
    polys(g).forEach(function (p) {
      p.forEach(function (ring) {
        for (var i = 1; i < ring.length; i++) {
          var a = ring[i - 1],
            b = ring[i];
          out.push({
            index: out.length,
            a: a,
            b: b,
            box: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])],
          });
        }
      });
    });
    return out;
  }
  // Per-inspection bounding-volume tree: prunes only disjoint segment boxes.
  // No simplified geometry, stale cross-request cache, or widened tolerance.
  function segmentTree(items) {
    var box = [Infinity, Infinity, -Infinity, -Infinity];
    items.forEach(function (s) {
      box[0] = Math.min(box[0], s.box[0]);
      box[1] = Math.min(box[1], s.box[1]);
      box[2] = Math.max(box[2], s.box[2]);
      box[3] = Math.max(box[3], s.box[3]);
    });
    if (items.length <= 12) return { box: box, items: items };
    var axis = box[2] - box[0] >= box[3] - box[1] ? 0 : 1;
    var sorted = items.slice().sort(function (a, b) {
        return a.box[axis] + a.box[axis + 2] - (b.box[axis] + b.box[axis + 2]) || a.index - b.index;
      }),
      mid = Math.floor(sorted.length / 2);
    return { box: box, left: segmentTree(sorted.slice(0, mid)), right: segmentTree(sorted.slice(mid)) };
  }
  function segmentCandidates(tree, box, t) {
    var stack = [tree],
      found = [];
    while (stack.length) {
      var node = stack.pop();
      if (!overlaps(box, node.box, t)) continue;
      if (node.items)
        node.items.forEach(function (s) {
          if (overlaps(box, s.box, t)) found.push(s);
        });
      else {
        stack.push(node.right);
        stack.push(node.left);
      }
    }
    // Preserve the old ring/edge accumulation order, including floating-point rounding.
    return found.sort(function (a, b) {
      return a.index - b.index;
    });
  }
  function sharedLength(a, b, t, counter) {
    var total = 0;
    a.forEach(function (edge) {
      var x = edge.a,
        y = edge.b,
        len = distance(x, y);
      if (!len) return;
      segmentCandidates(b, edge.box, t).forEach(function (other) {
        if (++counter.value > counter.max) fail('map-complexity', '邻接比较预算已用尽，未宣称全图完成');
        var u = other.a,
          v = other.b;
        if (Math.abs(cross(x, y, u)) > t * len || Math.abs(cross(x, y, v)) > t * len) return;
        var ax = (y[0] - x[0]) / len,
          ay = (y[1] - x[1]) / len,
          du = (u[0] - x[0]) * ax + (u[1] - x[1]) * ay,
          dv = (v[0] - x[0]) * ax + (v[1] - x[1]) * ay;
        total += Math.max(0, Math.min(len, Math.max(du, dv)) - Math.max(0, Math.min(du, dv)));
      });
    });
    return total;
  }
  function inspect(map, options) {
    var basic = validate(map),
      lim = limits(map, options),
      rows = cells(map),
      boxes = rows.map(function (c) {
        return bbox(c.geometry);
      }),
      boundaries = rows.map(function (c) {
        return segments(c.geometry);
      }),
      segmentTrees = boundaries.map(segmentTree),
      diagnostics = [],
      edges = [],
      holes = [],
      neighbors = {};
    rows.forEach(function (c) {
      neighbors[c.id] = [];
    });
    var counter = { value: 0, max: lim.maxComparisons };
    for (var i = 0; i < rows.length; i++)
      for (var j = i + 1; j < rows.length; j++) {
        if (!overlaps(boxes[i], boxes[j], lim.coordinateTolerance)) continue;
        var interior =
          Math.min(boxes[i][2], boxes[j][2]) > Math.max(boxes[i][0], boxes[j][0]) &&
          Math.min(boxes[i][3], boxes[j][3]) > Math.max(boxes[i][1], boxes[j][1]);
        var common = interior ? area(shape(clip.intersection(polys(rows[i].geometry), polys(rows[j].geometry)))) : 0;
        if (common > lim.areaTolerance)
          diagnostics.push({
            code: 'map-overlap',
            severity: 'error',
            regionIds: [rows[i].id, rows[j].id],
            area: common,
            unit: lim.areaUnit,
          });
        var length = sharedLength(boundaries[i], segmentTrees[j], lim.coordinateTolerance, counter);
        if (length > lim.minSharedLength) {
          edges.push({
            from: rows[i].id,
            to: rows[j].id,
            length: length,
            kind: 'physical-land-border',
            passable: 'requires-scenario-rule',
          });
          neighbors[rows[i].id].push(rows[j].id);
          neighbors[rows[j].id].push(rows[i].id);
        }
      }
    rows.forEach(function (c) {
      polys(c.geometry).forEach(function (p, pi) {
        p.slice(1).forEach(function (h, hi) {
          var holeGeom = shape([[h]]),
            holeBox = bbox(holeGeom),
            occupied = [];
          rows.forEach(function (other, otherIndex) {
            if (
              other.id !== c.id &&
              overlaps(holeBox, boxes[otherIndex], 0) &&
              area(shape(clip.intersection([[h]], polys(other.geometry)))) > lim.areaTolerance
            )
              occupied.push(other.id);
          });
          var declared = arr(c.holeClassifications).find(function (x) {
            return x.component === pi && x.ring === hi + 1;
          });
          holes.push({
            regionId: c.id,
            component: pi,
            ring: hi + 1,
            bbox: holeBox,
            area: ringArea(h),
            unit: lim.areaUnit,
            occupiedRegionIds: occupied,
            classification: occupied.length ? 'enclave' : declared ? declared.classification : 'unknown',
            sourceRef: (declared && declared.sourceRef) || null,
            physicalLandEvidence: !!map.physicalLandGeometry,
            confidence: occupied.length ? 'geometry-confirmed' : declared ? 'author-declared' : 'unknown',
          });
        });
      });
    });
    var union = clip.union.apply(
      null,
      rows.map(function (c) {
        return polys(c.geometry);
      }),
    );
    return {
      ok: !diagnostics.length,
      complete: true,
      regions: rows.length,
      components: rows.reduce(function (n, c) {
        return n + polys(c.geometry).length;
      }, 0),
      points: basic.points,
      holes: holes,
      diagnostics: diagnostics,
      adjacency: edges,
      neighbors: neighbors,
      isolated: rows
        .filter(function (c) {
          return !neighbors[c.id].length;
        })
        .map(function (c) {
          return c.id;
        }),
      unionArea: area(shape(union)),
      parameters: lim,
      landUnion: union,
    };
  }
  function anchor(g) {
    var components = polys(g)
      .slice()
      .sort(function (a, b) {
        return area(shape([b])) - area(shape([a]));
      });
    for (var k = 0; k < components.length; k++) {
      var p = shape([components[k]]),
        b = bbox(p);
      for (var n = 1; n <= 32; n *= 2)
        for (var i = 0; i < n; i++)
          for (var j = 0; j < n; j++) {
            var pt = [b[0] + ((i + 0.5) * (b[2] - b[0])) / n, b[1] + ((j + 0.5) * (b[3] - b[1])) / n];
            if (contains(p, pt)) return pt;
          }
    }
    fail('map-label-anchor', '未找到有效面内标签点，需明确外置标签规则');
  }
  function replaceChain(r, from, to, t) {
    var n = r.length - 1,
      m = from.length;
    for (var start = 0; start < n; start++) {
      var match = true;
      for (var k = 0; k < m; k++)
        if (!same(r[(start + k) % n], from[k], t)) {
          match = false;
          break;
        }
      if (match) {
        var rotated = [];
        for (var z = 0; z < n; z++) rotated.push(r[(start + z) % n]);
        var next = clone(to).concat(rotated.slice(m));
        next.push(clone(next[0]));
        return next;
      }
    }
    return null;
  }
  function operations(map, ops, options) {
    validate(map);
    if (!Array.isArray(ops) || !ops.length || ops.length > 100) fail('map-operations', '操作包须含 1–100 项明确操作');
    var next = clone(map),
      mapping = [],
      lim = limits(map, options),
      before = inspect(map, options),
      control = [],
      changed = false;
    function find(rid) {
      var r = cells(next).find(function (c) {
        return c.id === rid;
      });
      if (!r) fail('map-region-missing', '底图没有地块：' + rid);
      return r;
    }
    ops.forEach(function (op) {
      var r, ps;
      if (!op || typeof op.type !== 'string') fail('map-operation', '操作类型缺失');
      switch (op.type) {
        case 'renameDisplay':
          r = find(op.regionId);
          if (typeof op.name !== 'string' || !op.name.trim() || op.name.length > 120) fail('map-label', '显示名称无效');
          r.name = op.name;
          break;
        case 'moveLabel':
          r = find(op.regionId);
          if (
            !Array.isArray(op.point) ||
            op.point.length !== 2 ||
            !op.point.every(Number.isFinite) ||
            !contains(r.geometry, op.point)
          )
            fail('map-label-hole', '标签须位于有效面内，不能落在孔洞');
          r.labelPoint = clone(op.point);
          break;
        case 'adjustSharedBoundary':
          if (
            !Array.isArray(op.from) ||
            !Array.isArray(op.to) ||
            op.from.length < 2 ||
            op.to.length < 2 ||
            !same(op.from[0], op.to[0], lim.coordinateTolerance) ||
            !same(op.from[op.from.length - 1], op.to[op.to.length - 1], lim.coordinateTolerance)
          )
            fail('map-shared-endpoints', '共享边端点必须保留');
          var touched = [];
          cells(next).forEach(function (c) {
            var found = false;
            ps = polys(c.geometry).map(function (p) {
              return p.map(function (ring) {
                var replaced =
                  replaceChain(ring, op.from, op.to, lim.coordinateTolerance) ||
                  replaceChain(ring, op.from.slice().reverse(), op.to.slice().reverse(), lim.coordinateTolerance);
                if (replaced) found = true;
                return replaced || ring;
              });
            });
            if (found) {
              touched.push(c.id);
              c.geometry = shape(ps);
            }
          });
          if (
            touched.length !== 2 ||
            touched.some(function (x) {
              return arr(op.regionIds).indexOf(x) < 0;
            })
          )
            fail('map-shared-boundary', '操作必须精确覆盖共享边两侧');
          break;
        case 'splitLogicalRegion':
          r = find(op.regionId);
          var parts = arr(op.parts);
          if (parts.length < 2 || parts.length > 100 || !op.reason)
            fail('map-split', '拆分须有新地块、原因与后续绑定迁移');
          var used = new Set();
          parts.forEach(function (p) {
            if (
              !p.id ||
              used.has(p.id) ||
              cells(next).some(function (c) {
                return c.id === p.id;
              })
            )
              fail('map-split-id', '拆分目标须使用不同的新 ID');
            used.add(p.id);
            polys(p.geometry);
          });
          var union = clip.union.apply(
            null,
            parts.map(function (p) {
              return polys(p.geometry);
            }),
          );
          if (area(shape(clip.xor(union, polys(r.geometry)))) > lim.areaTolerance)
            fail('map-split-conservation', '拆分轮廓不能增减原有陆地或吞掉孔洞');
          if (
            parts.reduce(function (n, p) {
              return n + area(p.geometry);
            }, 0) -
              area(r.geometry) >
            lim.areaTolerance
          )
            fail('map-split-overlap', '拆分目标互相重叠');
          var at = cells(next).indexOf(r);
          cells(next).splice.apply(
            cells(next),
            [at, 1].concat(
              parts.map(function (p) {
                return Object.assign({}, clone(r), {
                  id: p.id,
                  name: p.name || p.id,
                  geometry: clone(p.geometry),
                  labelPoint: anchor(p.geometry),
                  holeClassifications: [],
                });
              }),
            ),
          );
          mapping.push({
            oldId: r.id,
            targetIds: parts.map(function (p) {
              return p.id;
            }),
            reason: op.reason,
            allocation: op.allocation || 'area-largest-remainder',
            sourceRef: op.sourceRef || null,
          });
          break;
        case 'mergeLogicalRegions':
          var ids = arr(op.regionIds);
          if (
            ids.length < 2 ||
            new Set(ids).size !== ids.length ||
            !op.newId ||
            cells(next).some(function (c) {
              return c.id === op.newId;
            }) ||
            !op.reason
          )
            fail('map-merge', '合并须明确原 ID、新 ID 和原因');
          var members = ids.map(find),
            geom = shape(
              clip.union.apply(
                null,
                members.map(function (c) {
                  return polys(c.geometry);
                }),
              ),
            ),
            all = cells(next);
          var merged = Object.assign({}, clone(members[0]), {
            id: op.newId,
            name: op.name || op.newId,
            geometry: geom,
            labelPoint: anchor(geom),
            holeClassifications: [],
          });
          ids.forEach(function (old) {
            all.splice(
              all.findIndex(function (c) {
                return c.id === old;
              }),
              1,
            );
            mapping.push({
              oldId: old,
              targetIds: [op.newId],
              reason: op.reason,
              allocation: 'sum',
              sourceRef: op.sourceRef || null,
              ownerPolicy: op.ownerPolicy || null,
            });
          });
          all.push(merged);
          break;
        case 'classifyHole':
          r = find(op.regionId);
          var hole = before.holes.find(function (h) {
            return h.regionId === r.id && h.component === op.component && h.ring === op.ring;
          });
          if (
            !hole ||
            !op.sourceRef ||
            ['water', 'enclave', 'legal-inner-ring', 'unopened-land', 'accidental-gap', 'quantization-tail'].indexOf(
              op.classification,
            ) < 0
          )
            fail('map-hole-classification', '须指向已诊断的孔洞并注明依据');
          if (hole.occupiedRegionIds.length && op.classification !== 'enclave')
            fail('map-enclave-protected', '孔洞中有独立地块，不允许涂掉或误标漏缝');
          r.holeClassifications = arr(r.holeClassifications).filter(function (h) {
            return h.component !== op.component || h.ring !== op.ring;
          });
          r.holeClassifications.push({
            component: op.component,
            ring: op.ring,
            classification: op.classification,
            sourceRef: op.sourceRef,
          });
          break;
        case 'repairGap':
          r = find(op.regionId);
          if (!next.physicalLandGeometry || !op.sourceRef || op.classification !== 'accidental-gap')
            fail('map-gap-evidence', '缺物理陆地与漏缝证据，不能自动补洞');
          var gap = polys(op.geometry);
          if (
            area(shape(clip.intersection(gap, before.landUnion))) > lim.areaTolerance ||
            area(shape(clip.difference(gap, polys(next.physicalLandGeometry)))) > lim.areaTolerance
          )
            fail('map-gap-occupied', '补缝会覆盖既有地块或真实水域');
          r.geometry = shape(clip.union(polys(r.geometry), gap));
          break;
        case 'simplifyTopology':
          cells(next).forEach(function (c) {
            c.geometry = shape(
              polys(c.geometry).map(function (p) {
                return p.map(function (r) {
                  var v = r.slice(0, -1),
                    out = v.filter(function (pt, i) {
                      var a = v[(i + v.length - 1) % v.length],
                        b = v[(i + 1) % v.length];
                      return (
                        cross(a, pt, b) !== 0 ||
                        distance(a, pt) + distance(pt, b) > distance(a, b) + lim.coordinateTolerance
                      );
                    });
                  if (out.length < 3) return r;
                  return out.concat([clone(out[0])]);
                });
              }),
            );
          });
          break;
        case 'rebuildLandAdjacency':
          break;
        case 'assignScenarioControl':
          find(op.regionId);
          if (!op.controllerFactionId) fail('map-control', '控制归属必须引用显式势力 ID');
          control.push(clone(op));
          break;
        default:
          fail('map-operation-unsupported', '未实现的地图操作：' + op.type);
      }
    });
    var after = inspect(next, options);
    if (!after.ok) fail('map-candidate-invalid', '候选几何未通过整包检查', after.diagnostics);
    var gapOps = ops.some(function (o) {
      return o.type === 'repairGap';
    });
    if (!gapOps && area(shape(clip.xor(before.landUnion, after.landUnion))) > lim.areaTolerance)
      fail('map-land-conservation', '操作改变了整图陆地并集');
    next.landAdjacency = after.adjacency;
    changed = JSON.stringify(next) !== JSON.stringify(map);
    if (changed) next.version = String(map.version) + '-edit';
    return {
      map: next,
      mapping: mapping,
      control: control,
      changed: changed,
      before: summary(before),
      after: summary(after),
      requiresBindingMigration: mapping.length > 0,
    };
  }
  function summary(r) {
    return {
      ok: r.ok,
      complete: r.complete,
      regions: r.regions,
      components: r.components,
      points: r.points,
      holes: r.holes,
      diagnostics: r.diagnostics,
      isolated: r.isolated,
      unionArea: r.unionArea,
      parameters: r.parameters,
      adjacencyEdges: r.adjacency.length,
    };
  }
  function projection(map) {
    validate(map);
    if (map.coordinateSystemId === 'wgs84')
      fail('map-projection-required', '标准经纬度底图必须先明确投影变换，不能按游戏像素导入');
    return {
      id: map.id,
      version: map.version,
      coordinateSystemId: map.coordinateSystemId,
      width:
        map.width ||
        bbox(
          shape(
            cells(map).flatMap(function (c) {
              return polys(c.geometry);
            }),
          ),
        )[2],
      height:
        map.height ||
        bbox(
          shape(
            cells(map).flatMap(function (c) {
              return polys(c.geometry);
            }),
          ),
        )[3],
      divisions: cells(map).map(function (c) {
        var p = polys(c.geometry);
        return {
          id: c.id,
          name: c.name || c.id,
          polygon: clone(p[0][0]),
          extraPolygons: p.slice(1).map(function (x) {
            return clone(x[0]);
          }),
          holes: clone(p[0].slice(1)),
          extraPolygonHoles: p.slice(1).map(function (x) {
            return clone(x.slice(1));
          }),
          geometry: clone(c.geometry),
          labelPoint: c.labelPoint || anchor(c.geometry),
        };
      }),
    };
  }
  root.TM = root.TM || {};
  root.TM.MapWorkbench = {
    validate: validate,
    inspect: inspect,
    summary: summary,
    operations: operations,
    area: area,
    bbox: bbox,
    contains: contains,
    hit: hit,
    anchor: anchor,
    projection: projection,
    polys: polys,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.MapWorkbench;
})(typeof window !== 'undefined' ? window : globalThis);
