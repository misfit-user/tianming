// tm-division-reassign.js — 改隶写口（通志一期 S6）
//
// 把一个府州从本方一个省道划到本方另一个省道。三处一起改，玩家与 AI 走同一个写口：
//   ① 行政树：州节点从原省道节点下挪到新省道节点下，节点 parentId 随之改。
//      P.adminHierarchy 与 GM.adminHierarchy 若是两份（营造推进读 P 树，其余读 GM 树），两份都改。
//   ② 地图地块：parentId、circuitId（原来有才写）、circuitName、circuitTitle（新道成员有才写），
//      经 TMMapRuntime.updateRegion 写，记进地图变更账。地图分组、通志、描金边都按 parentId 走，写完即按新省道重画。
//   ③ 省道登记：从原条目的 memberRegionIds 删去，加进新条目。
//
// 规则（owner 09-24 定）：只许在本方省道之间改；首府暂不许改出（二期能更易首府后再放开）；
// 不相邻也允许，但提示将成飞地；改出后原道被隔成两片的也提示。
// 玩家一侧只生成诏书建议（通志「调整辖区」、方志「改隶」），下诏后由推演核定，再经回合末写工具
// restructure_division 调本写口落地；奏疏、朝会里大臣提议改隶也走这里。
//
// 本模块不调 AI、不碰 DOM；读 GM / P / 地图，写只经 apply。
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.TM = root.TM || {};
    root.TM.DivisionReassign = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  var CHILD_KEYS = ['children', 'divisions', 'subDivisions', 'subs'];

  function text(v) { return v == null ? '' : String(v); }

  function runtimeMap(opts) {
    if (opts && opts.map) return opts.map;
    var rt = root.TMMapRuntime;
    try { if (rt && typeof rt.getMap === 'function') { var m = rt.getMap(); if (m && Array.isArray(m.regions)) return m; } } catch (_) {}
    var gm = (opts && opts.gm) || root.GM;
    return (gm && gm.mapData) || null;
  }

  // 地块归属键：同一势力在各剧本里这几个字段写法一致，取最稳的一个
  function ownerOf(r) {
    return text(r && (r.currentOwnerKey || r.ownerKey || r.stableFactionId || r.currentOwner || r.owner));
  }

  function findRegion(map, ref) {
    if (!map || !Array.isArray(map.regions) || ref == null) return null;
    if (typeof ref === 'object') return map.regions.indexOf(ref) >= 0 ? ref : findRegion(map, ref.id || ref.name);
    var key = text(ref);
    return map.regions.filter(function (r) { return text(r.id) === key; })[0] ||
      map.regions.filter(function (r) { return text(r.name) === key || text(r.title) === key; })[0] || null;
  }

  function registry(map) {
    return (map && Array.isArray(map.circuitRegistry)) ? map.circuitRegistry : [];
  }
  function entryKey(e) { return text(e && (e.key || e.id)); }

  // 地块现隶哪一道：先看登记的成员名单，再看 parentId / circuitId
  function circuitOfRegion(map, r) {
    if (!r) return null;
    var id = text(r.id);
    var list = registry(map);
    return list.filter(function (e) { return (e.memberRegionIds || []).map(text).indexOf(id) >= 0; })[0] ||
      list.filter(function (e) { var k = entryKey(e); return k && (k === text(r.parentId) || k === text(r.circuitId)); })[0] || null;
  }

  function membersOf(map, entry) {
    var ids = (entry && entry.memberRegionIds || []).map(text);
    return (map.regions || []).filter(function (r) { return ids.indexOf(text(r.id)) >= 0; });
  }

  // 目标省道：按 key、id、名称逐字匹配；再在候选（本方省道）里按名称前缀唯一匹配（AI 常写「山东」指「山东布政使司」）
  function resolveCircuit(map, ref, candidates) {
    var key = text(ref && typeof ref === 'object' ? (ref.key || ref.id || ref.name) : ref).trim();
    if (!key) return null;
    var list = registry(map);
    var exact = list.filter(function (e) { return entryKey(e) === key || text(e.id) === key || text(e.name) === key || text(e.sourceAdminId) === key; })[0];
    if (exact) return exact;
    var pool = candidates || list;
    var prefixed = pool.filter(function (e) { var name = text(e.name); return !!name && (name.indexOf(key) === 0 || key.indexOf(name) === 0); });
    return prefixed.length === 1 ? prefixed[0] : null;
  }

  // 本方省道：成员里有该势力的州
  function ownCircuits(map, owner) {
    return registry(map).filter(function (e) {
      return membersOf(map, e).some(function (r) { return ownerOf(r) === owner; });
    });
  }

  // ── 行政树 ──
  function adminSources(gm) {
    var out = [];
    [root.P && root.P.adminHierarchy, gm && gm.adminHierarchy].forEach(function (ah) {
      if (ah && typeof ah === 'object' && Object.keys(ah).length && out.indexOf(ah) < 0) out.push(ah);
    });
    return out;
  }
  function kidsOf(node, create) {
    if (!node || typeof node !== 'object') return null;
    for (var i = 0; i < CHILD_KEYS.length; i++) if (Array.isArray(node[CHILD_KEYS[i]])) return node[CHILD_KEYS[i]];
    return create ? (node.children = []) : null;
  }
  // 在一棵行政树里找节点，返回 { node, parent, list, idx, root: 势力树根 }
  function findAdmin(ah, test) {
    var found = null;
    function walk(node, parent, list, idx, top) {
      if (found || !node || typeof node !== 'object') return;
      if (test(node)) { found = { node: node, parent: parent, list: list, idx: idx, root: top }; return; }
      var kids = kidsOf(node, false) || [];
      for (var i = 0; i < kids.length && !found; i++) walk(kids[i], node, kids, i, top);
    }
    Object.keys(ah).forEach(function (k) {
      var top = ah[k];
      if (found || !top || typeof top !== 'object') return;
      var kids = kidsOf(top, false) || [];
      for (var i = 0; i < kids.length && !found; i++) walk(kids[i], top, kids, i, top);
    });
    return found;
  }
  function regionAdminTest(r) {
    var ids = [text(r.adminBinding), text(r.id)].filter(Boolean);
    return function (n) { return ids.indexOf(text(n.id)) >= 0; };
  }
  function regionAdminByName(r) {
    return function (n) { return text(n.name) === text(r.name) && !isCircuitLevel(n); };
  }
  function isCircuitLevel(n) { return /province|circuit/.test(text(n.level || n.regionType)); }
  function circuitAdminTest(entry) {
    var ids = [text(entry.sourceAdminId), entryKey(entry), text(entry.id)].filter(Boolean);
    return function (n) { return ids.indexOf(text(n.id)) >= 0; };
  }
  // 省道节点：按登记的 sourceAdminId / key 找；找不到再在该州所在的势力树里按名称找
  function circuitAdmin(ah, entry, top) {
    var hit = findAdmin(ah, circuitAdminTest(entry));
    if (hit || !top) return hit;
    var byName = null;
    (function walk(node, parent, list, idx) {
      if (byName || !node || typeof node !== 'object') return;
      if (node !== top && text(node.name) === text(entry.name)) { byName = { node: node, parent: parent, list: list, idx: idx, root: top }; return; }
      var kids = kidsOf(node, false) || [];
      for (var i = 0; i < kids.length && !byName; i++) walk(kids[i], node, kids, i);
    })(top, null, null, -1);
    return byName;
  }

  // 首府：省道节点的 capitalChildId 对的是州节点 id（天启）或地块 id（晚唐、绍宋）。
  // 省道节点先按登记找，找不到就取行政树里这州的上级（绍宋的路节点 id 与登记 key 不同）
  function isCapital(gm, entry, r) {
    var ids = [text(r.adminBinding), text(r.id), text(r.name)];
    return adminSources(gm).some(function (ah) {
      var hit = findAdmin(ah, regionAdminTest(r)) || findAdmin(ah, regionAdminByName(r));
      var nodes = [circuitAdmin(ah, entry, hit && hit.root), hit && hit.parent && { node: hit.parent }];
      return nodes.some(function (c) {
        var cap = c && c.node && text(c.node.capitalChildId || c.node.capital);
        return !!cap && ids.indexOf(cap) >= 0;
      });
    }) || (entry.capitalRegionId != null && ids.indexOf(text(entry.capitalRegionId)) >= 0);
  }

  // 邻接：地块自带 neighbors（地块 id 或名称）；没有邻接数据时不下飞地结论
  function neighborIds(map, r) {
    var list = Array.isArray(r && r.neighbors) ? r.neighbors : null;
    if (!list) return null;
    return list.map(function (n) { var hit = findRegion(map, n); return hit ? text(hit.id) : text(n); });
  }
  function touches(map, r, regions) {
    var nb = neighborIds(map, r);
    if (!nb) return null;
    var ids = regions.map(function (x) { return text(x.id); });
    return nb.some(function (id) { return ids.indexOf(id) >= 0; });
  }
  // 原道剩下的州还连成一片吗（按邻接走一遍）
  function staysConnected(map, regions) {
    if (regions.length < 2) return true;
    var ids = regions.map(function (x) { return text(x.id); }), seen = {}, queue = [regions[0]];
    seen[ids[0]] = true;
    while (queue.length) {
      var nb = neighborIds(map, queue.shift());
      if (!nb) return true;
      nb.forEach(function (id) {
        var at = ids.indexOf(id);
        if (at >= 0 && !seen[id]) { seen[id] = true; queue.push(regions[at]); }
      });
    }
    return ids.every(function (id) { return seen[id]; });
  }

  // ── 校验：能不能改，改了会怎样（不写） ──
  // 返回 { applies, ok, reason, region, from, to, enclave, splitsOrigin, warnings }；
  // applies=false 表示这不是「府州在省道之间改隶」（例如地图上没有的县改隶到别的府），调用方照原办法处理。
  // 地图上隶于省道的州一律当省道改隶看：目标认不出就拒，免得只改行政树、地图与登记对不上。
  function plan(regionRef, targetRef, opts) {
    opts = opts || {};
    var gm = opts.gm || root.GM, map = runtimeMap(opts);
    var out = { applies: false, ok: false, reason: '', warnings: [] };
    var r = findRegion(map, regionRef);
    if (!r) { out.reason = '地图上没有此州：' + text(regionRef); return out; }
    var from = circuitOfRegion(map, r);
    if (!from) { out.reason = text(r.name) + '未隶任何省道'; return out; }
    out.applies = true;
    out.region = r;
    out.from = { key: entryKey(from), label: text(from.name) };
    var owner = ownerOf(r), acting = text(opts.faction || owner);
    var own = ownCircuits(map, owner);
    var to = resolveCircuit(map, targetRef, own);
    if (!to) { out.reason = '找不到目标省道：' + text(targetRef) + '（可填本方省道名，如 ' + own.slice(0, 3).map(function (e) { return text(e.name); }).join('、') + '）'; return out; }
    out.to = { key: entryKey(to), label: text(to.name) };
    if (entryKey(to) === entryKey(from)) { out.reason = text(r.name) + '本隶' + text(to.name); return out; }
    if (acting !== owner) { out.reason = text(r.name) + '不归本方，不能改隶'; return out; }
    if (own.indexOf(to) < 0) { out.reason = text(to.name) + '不是本方省道'; return out; }
    if (isCapital(gm, from, r)) { out.reason = text(r.name) + '是' + text(from.name) + '首府，暂不能改出'; return out; }
    var toMembers = membersOf(map, to).filter(function (x) { return x !== r; });
    var rest = membersOf(map, from).filter(function (x) { return x !== r && ownerOf(x) === owner; });
    var t = touches(map, r, toMembers);
    out.enclave = t === false;
    out.splitsOrigin = !staysConnected(map, rest);
    if (out.enclave) out.warnings.push(text(r.name) + '与' + text(to.name) + '不相接壤，改隶后成飞地');
    if (out.splitsOrigin) out.warnings.push('改出后' + text(from.name) + '余下各州不再连成一片');
    out.ok = true;
    return out;
  }

  // 这州能不能改出原道（不看目标）：界面上决定给不给候选
  function movable(regionRef, opts) {
    opts = opts || {};
    var gm = opts.gm || root.GM, map = runtimeMap(opts), r = findRegion(map, regionRef);
    if (!r) return { ok: false, reason: '地图上没有此州' };
    var from = circuitOfRegion(map, r);
    if (!from) return { ok: false, reason: text(r.name) + '未隶任何省道' };
    if (opts.faction && text(opts.faction) !== ownerOf(r)) return { ok: false, reason: text(r.name) + '不归本方' };
    if (isCapital(gm, from, r)) return { ok: false, reason: text(r.name) + '是' + text(from.name) + '首府，暂不能改出' };
    return { ok: true, from: { key: entryKey(from), label: text(from.name) } };
  }

  // 可改隶去的本方省道（接壤的排前）；方志「改隶」、通志「调整辖区」列候选用
  function targetsFor(regionRef, opts) {
    opts = opts || {};
    var map = runtimeMap(opts), r = findRegion(map, regionRef);
    if (!r) return [];
    var from = circuitOfRegion(map, r), owner = ownerOf(r);
    return ownCircuits(map, owner).filter(function (e) { return e !== from; }).map(function (e) {
      var t = touches(map, r, membersOf(map, e));
      return { key: entryKey(e), label: text(e.name), adjacent: t !== false };
    }).sort(function (a, b) { return (b.adjacent ? 1 : 0) - (a.adjacent ? 1 : 0) || a.label.localeCompare(b.label, 'zh'); });
  }

  // ── 落地：三处一起改，任一步失败整体撤回 ──
  function apply(regionRef, targetRef, opts) {
    opts = opts || {};
    var gm = opts.gm || root.GM, map = runtimeMap(opts);
    var p = plan(regionRef, targetRef, opts);
    if (!p.ok) return p;
    var r = p.region, from = circuitOfRegion(map, r), to = resolveCircuit(map, p.to.key);
    var undo = [];
    try {
      // ① 行政树：每一份树里都要找得到这州和目标省道节点，否则不动
      var trees = adminSources(gm).map(function (ah) {
        var hit = findAdmin(ah, regionAdminTest(r)) || findAdmin(ah, regionAdminByName(r));
        var dest = hit && circuitAdmin(ah, to, hit.root);
        return { ah: ah, hit: hit, dest: dest };
      }).filter(function (t) { return t.hit; });
      if (!trees.length) throw new Error('行政树里没有' + text(r.name));
      trees.forEach(function (t) { if (!t.dest) throw new Error('行政树里' + text(r.name) + '所在势力下没有' + text(to.name)); });
      trees.forEach(function (t) {
        var node = t.hit.node, list = t.hit.list, idx = list.indexOf(node), destKids = kidsOf(t.dest.node, true), oldParent = node.parentId;
        if (t.dest.node === t.hit.parent) return;
        // 两份树可能共用同一批节点：前一份已经挪过，这一份就不再动
        if (idx < 0) { if (destKids.indexOf(node) >= 0) return; throw new Error(text(r.name) + '在行政树里的位置变了'); }
        list.splice(idx, 1);
        if (destKids.indexOf(node) < 0) destKids.push(node);
        node.parentId = t.dest.node.id || t.dest.node.name;
        undo.push(function () {
          var at = destKids.indexOf(node);
          if (at >= 0) destKids.splice(at, 1);
          list.splice(Math.min(idx, list.length), 0, node);
          if (oldParent === undefined) delete node.parentId; else node.parentId = oldParent;
        });
      });
      // ③ 省道登记
      var id = text(r.id), fromIds = from.memberRegionIds || [], toIds = Array.isArray(to.memberRegionIds) ? to.memberRegionIds : (to.memberRegionIds = []);
      var fromAt = fromIds.map(text).indexOf(id);
      if (fromAt >= 0) fromIds.splice(fromAt, 1);
      if (toIds.map(text).indexOf(id) < 0) toIds.push(r.id);
      undo.push(function () {
        var at = toIds.map(text).indexOf(id);
        if (at >= 0) toIds.splice(at, 1);
        if (fromAt >= 0) fromIds.splice(Math.min(fromAt, fromIds.length), 0, r.id);
      });
      // ② 地图地块：只写原来就有的省道字段，parentId 恒写
      var patch = { parentId: entryKey(to) };
      if (r.circuitId !== undefined) patch.circuitId = entryKey(to);
      if (r.circuitName !== undefined) patch.circuitName = text(to.name);
      var title = membersOf(map, to).map(function (x) { return x.circuitTitle; }).filter(Boolean)[0];
      if (r.circuitTitle !== undefined && title) patch.circuitTitle = title;
      var before = {};
      Object.keys(patch).forEach(function (k) { before[k] = r[k]; });
      var rt = root.TMMapRuntime;
      var reason = text(opts.reason) || ('改隶' + text(r.name) + '于' + text(to.name));
      if (rt && typeof rt.updateRegion === 'function') rt.updateRegion(r.id, patch, { mapData: map, reason: reason });
      else Object.keys(patch).forEach(function (k) { r[k] = patch[k]; });
      undo.push(function () { Object.keys(before).forEach(function (k) { if (before[k] === undefined) delete r[k]; else r[k] = before[k]; }); });
      // 验收：三处都指向新省道
      if (circuitOfRegion(map, r) !== to) throw new Error('省道登记未落地');
      if (text(r.parentId) !== entryKey(to)) throw new Error('地块上级未落地');
      trees.forEach(function (t) { if ((kidsOf(t.dest.node, false) || []).indexOf(t.hit.node) < 0) throw new Error('行政树改隶未落地'); });
    } catch (e) {
      undo.reverse().forEach(function (fn) { try { fn(); } catch (_) {} });
      return { applies: true, ok: false, reason: '改隶撤回：' + ((e && e.message) || e), from: p.from, to: p.to };
    }
    return { applies: true, ok: true, region: text(r.name), regionId: text(r.id), from: p.from, to: p.to, enclave: p.enclave, splitsOrigin: p.splitsOrigin, warnings: p.warnings };
  }

  return {
    plan: plan,
    apply: apply,
    targetsFor: targetsFor,
    movable: movable,
    circuitOfRegion: function (regionRef, opts) {
      var map = runtimeMap(opts || {}), r = findRegion(map, regionRef), e = circuitOfRegion(map, r);
      return e ? { key: entryKey(e), label: text(e.name) } : null;
    }
  };
});
