// @ts-check
// ============================================================
// tm-rel-graph.js
// 6 系统翻新 phase 0: typed relation graph.
//
// 只承接新系统的实体引用关系，不重构 tm-relations.js 的人际关系网。
// 默认存储在 GM.relGraph.edges，边是幂等 upsert。
// ============================================================
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};

  function clone(v) {
    if (v === undefined || v === null) return v;
    try { return JSON.parse(JSON.stringify(v)); }
    catch (_) { return v; }
  }

  function currentTurn() {
    return global.GM && typeof global.GM.turn === 'number' ? global.GM.turn : 0;
  }

  function ensureStore(root) {
    root = root || global.GM || {};
    if (!root.relGraph || typeof root.relGraph !== 'object') root.relGraph = {};
    if (!Array.isArray(root.relGraph.edges)) root.relGraph.edges = [];
    return root.relGraph;
  }

  function nodeId(node) {
    if (node === undefined || node === null) return '';
    if (typeof node === 'string') return node;
    return String(node.id || node.name || node.label || '');
  }

  function nodeLabel(node) {
    if (node === undefined || node === null) return '';
    if (typeof node === 'string') return node;
    return String(node.label || node.name || node.id || '');
  }

  function normalizeNode(node, fallbackType) {
    if (typeof node === 'string') return { type: fallbackType || 'unknown', id: node, label: node };
    if (!node || typeof node !== 'object') return { type: fallbackType || 'unknown', id: '', label: '' };
    return {
      type: node.type || fallbackType || 'unknown',
      id: nodeId(node),
      label: nodeLabel(node)
    };
  }

  function edgeKey(from, to, kind) {
    return [from.type, from.id, kind || 'link', to.type, to.id].join('::');
  }

  function ensureEdge(from, to, kind, attrs, root) {
    var store = ensureStore(root);
    var f = normalizeNode(from);
    var t = normalizeNode(to);
    var k = kind || 'link';
    var id = edgeKey(f, t, k);
    var found = store.edges.find(function(e) { return e.id === id; });
    if (!found) {
      found = {
        id: id,
        from: f,
        to: t,
        kind: k,
        strength: 1,
        sinceTurn: currentTurn(),
        updatedTurn: currentTurn(),
        meta: {},
        history: []
      };
      store.edges.push(found);
    }
    attrs = attrs || {};
    Object.keys(attrs).forEach(function(key) {
      if (key === 'meta') {
        found.meta = Object.assign(found.meta || {}, attrs.meta || {});
      } else if (key === 'history') {
        found.history = found.history || [];
        [].concat(attrs.history || []).forEach(function(h) { found.history.push(h); });
      } else {
        found[key] = clone(attrs[key]);
      }
    });
    found.updatedTurn = currentTurn();
    return found;
  }

  function removeEdge(from, to, kind, root) {
    var store = ensureStore(root);
    var id = edgeKey(normalizeNode(from), normalizeNode(to), kind || 'link');
    var before = store.edges.length;
    store.edges = store.edges.filter(function(e) { return e.id !== id; });
    return before !== store.edges.length;
  }

  function findEdges(filter, root) {
    filter = filter || {};
    var store = ensureStore(root);
    return store.edges.filter(function(e) {
      if (filter.kind && e.kind !== filter.kind) return false;
      if (filter.fromType && (!e.from || e.from.type !== filter.fromType)) return false;
      if (filter.toType && (!e.to || e.to.type !== filter.toType)) return false;
      if (filter.fromId && (!e.from || e.from.id !== filter.fromId)) return false;
      if (filter.toId && (!e.to || e.to.id !== filter.toId)) return false;
      return true;
    }).map(clone);
  }

  function bindCharToParty(ch, party, meta, root) {
    if (!ch) return null;
    var partyNode = normalizeNode(party || ch.partyRef || ch.party, 'party');
    if (!partyNode.id) return null;
    ch.partyRef = Object.assign({ type:'party', id: partyNode.id, joinedTurn: currentTurn() }, ch.partyRef || {});
    if (!ch.partyRef.role && meta && meta.role) ch.partyRef.role = meta.role;
    return ensureEdge(normalizeNode(ch, 'char'), partyNode, 'char-party', { meta: meta || {} }, root);
  }

  function bindCharToFaction(ch, faction, meta, root) {
    if (!ch) return null;
    var factionNode = normalizeNode(faction || ch.factionRef || ch.faction, 'faction');
    if (!factionNode.id) return null;
    ch.factionRef = Object.assign({ type:'faction', id: factionNode.id, since: currentTurn() }, ch.factionRef || {});
    return ensureEdge(normalizeNode(ch, 'char'), factionNode, 'char-faction', { meta: meta || {} }, root);
  }

  function bindCharToOffice(ch, office, meta, root) {
    if (!ch) return null;
    var officeNode = normalizeNode(office || ch.officeRef || ch.officialTitle, 'office');
    if (!officeNode.id) return null;
    ch.officeRef = Object.assign({ type:'office', id: officeNode.id, since: currentTurn() }, ch.officeRef || {});
    return ensureEdge(normalizeNode(ch, 'char'), officeNode, 'char-office', { meta: meta || {} }, root);
  }

  function syncCharRefs(ch, root) {
    var out = [];
    if (!ch) return out;
    if (ch.partyRef || ch.party) out.push(bindCharToParty(ch, ch.partyRef || ch.party, {}, root));
    if (ch.factionRef || ch.faction) out.push(bindCharToFaction(ch, ch.factionRef || ch.faction, {}, root));
    if (ch.officeRef || ch.officialTitle) out.push(bindCharToOffice(ch, ch.officeRef || ch.officialTitle, {}, root));
    return out.filter(Boolean);
  }

  function applyCharInteraction(actor, target, interactionType, payload) {
    if (typeof global.applyNpcInteraction === 'function') {
      return global.applyNpcInteraction(actor, target, interactionType, payload || {});
    }
    return ensureEdge(
      normalizeNode(actor, 'char'),
      normalizeNode(target, 'char'),
      'char-interaction:' + (interactionType || 'generic'),
      { meta: payload || {}, history: [{ turn: currentTurn(), type: interactionType || 'generic' }] }
    );
  }

  var api = {
    currentVersion: 1,
    ensureStore: ensureStore,
    normalizeNode: normalizeNode,
    ensureEdge: ensureEdge,
    removeEdge: removeEdge,
    findEdges: findEdges,
    bindCharToParty: bindCharToParty,
    bindCharToFaction: bindCharToFaction,
    bindCharToOffice: bindCharToOffice,
    syncCharRefs: syncCharRefs,
    applyCharInteraction: applyCharInteraction
  };

  TM.RelGraph = api;
  global.RelGraph = api;
})(typeof window !== 'undefined' ? window : globalThis);

