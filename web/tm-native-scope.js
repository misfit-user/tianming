// Native social compatibility views share authoritative objects with the world registry.
(function (root) {
  'use strict';
  var arr = function (v) {
      return Array.isArray(v) ? v : [];
    },
    installed = new WeakMap();
  function failure(message) {
    var e = new Error(message);
    e.code = 'native-social-scope';
    throw e;
  }
  function bind(g) {
    var n = g.nativeWorld,
      s = n.scope,
      prior = installed.get(g);
    if (prior === n) return;
    installed.set(g, n);
    ['classes', 'parties', 'events'].forEach(function (field) {
      var idField = field === 'classes' ? 'classIds' : field === 'parties' ? 'partyIds' : 'openingEventIds';
      var cache = null,
        last = [];
      function visible(row) {
        return field === 'events' ? root.TM.NativeWorld.eventVisible(g, row) : arr(s[idField]).indexOf(row.id) >= 0;
      }
      function replace(rows) {
        if (!Array.isArray(rows)) failure(field + ' 必须为数组');
        rows = rows.slice();
        var ids = new Set(),
          all = arr(n[field]),
          oldIds = new Set(
            last.map(function (x) {
              return x.id;
            }),
          );
        rows.forEach(function (row) {
          if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id))
            failure(field + ' 视图存在无 ID 或重复项目');
          var existing = all.find(function (x) {
            return x.id === row.id;
          });
          if (existing && !visible(existing)) failure('不能通过当前视图改写外国 ' + row.id);
          if (!existing && row.factionId !== s.factionId && !(field === 'events' && row.scope === 'world'))
            failure('新项目须明确当前势力作用域：' + row.id);
          ids.add(row.id);
        });
        var byId = new Map(
            rows.map(function (x) {
              return [x.id, x];
            }),
          ),
          next = [];
        all.forEach(function (row) {
          if (!oldIds.has(row.id)) next.push(row);
          else if (byId.has(row.id)) {
            next.push(byId.get(row.id));
            byId.delete(row.id);
          }
        });
        byId.forEach(function (row) {
          next.push(row);
        });
        all.length = 0;
        Array.prototype.push.apply(all, next);
        n[field] = all;
        if (field !== 'events')
          s[idField] = rows.map(function (row) {
            return row.id;
          });
        if (!cache) cache = [];
        cache.length = 0;
        Array.prototype.push.apply(cache, rows);
        last = cache.slice();
        decorate(cache);
      }
      function flush() {
        if (
          cache &&
          (cache.length !== last.length ||
            cache.some(function (x, i) {
              return x !== last[i];
            }))
        )
          replace(cache);
      }
      function decorate(view) {
        ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'].forEach(function (name) {
          Object.defineProperty(view, name, {
            enumerable: false,
            configurable: true,
            value: function () {
              flush();
              var work = cache.slice(),
                result = Array.prototype[name].apply(work, arguments);
              replace(work);
              return result === work ? cache : result;
            },
          });
        });
      }
      Object.defineProperty(g, field, {
        enumerable: true,
        configurable: true,
        get: function () {
          flush();
          var now = arr(n[field]).filter(visible);
          if (
            !cache ||
            now.length !== last.length ||
            now.some(function (x, i) {
              return x !== last[i];
            })
          ) {
            cache = now;
            last = now.slice();
            decorate(cache);
          }
          return cache;
        },
        set: replace,
      });
      void g[field];
    });
  }
  function coupleClass(g, cls, delta, options) {
    var n = g.nativeWorld,
      changes = [],
      total = 0;
    options = options || {};
    arr(cls.supportingParties).forEach(function (edge) {
      var exact = edge && typeof edge === 'object' && edge.partyId;
      var name = typeof edge === 'string' ? edge : String((edge && (edge.party || edge.name || edge.partyName)) || '');
      var matches = arr(n.parties).filter(function (p) {
        return exact ? p.id === exact : p.name === name && p.factionId === cls.factionId;
      });
      if (matches.length !== 1) return;
      var party = matches[0],
        raw = edge && typeof edge === 'object' ? (edge.affinity == null ? edge.weight : edge.affinity) : null;
      var affinity = raw == null ? options.defaultAffinity : Number(raw),
        change = delta * affinity * options.weight;
      if (!Number.isFinite(change) || !change) return;
      var before = party.cohesion == null ? 50 : Number(party.cohesion);
      if (!Number.isFinite(before)) failure('党派凝聚力不是有限数：' + party.id);
      var after = Math.max(0, Math.min(100, before + change));
      party.cohesion = after;
      var ps = g.partyState && g.partyState[party.name];
      if (
        ps &&
        arr(g.parties).filter(function (p) {
          return p.name === party.name;
        }).length === 1 &&
        arr(g.parties).some(function (p) {
          return p.id === party.id;
        })
      ) {
        ps.cohesion = after;
        ps._synced_cohesion = after;
      }
      changes.push({
        classId: cls.id,
        partyId: party.id,
        partyName: party.name,
        oldCohesion: before,
        newCohesion: after,
        delta: after - before,
        affinity: affinity,
      });
      total += after - before;
    });
    g._classPartyCouplingLog = arr(g._classPartyCouplingLog)
      .concat(
        changes.map(function (c) {
          return Object.assign({ turn: g.turn, reason: options.reason || '阶层满意度变化' }, c);
        }),
      )
      .slice(-200);
    return { ok: changes.length > 0, classId: cls.id, className: cls.name, applied: changes, totalDelta: total };
  }
  function coupleParty(g, outcome, options) {
    var n = g.nativeWorld,
      partyDeltas = new Map(),
      applied = [],
      total = 0,
      faction = outcome.sourceFactionId || outcome.factionId || g.startContext.playerFactionId;
    Object.keys(options.deltas).forEach(function (key) {
      var id = outcome.sourcePartyId && key === (outcome.sourceParty || outcome.party) ? outcome.sourcePartyId : key;
      var rows = arr(n.parties).filter(function (p) {
        return p.id === id;
      });
      if (!rows.length)
        rows = arr(n.parties).filter(function (p) {
          return p.name === key && p.factionId === faction;
        });
      if (rows.length === 1) partyDeltas.set(rows[0].id, { party: rows[0], delta: options.deltas[key] });
    });
    arr(n.classes).forEach(function (cls) {
      var sum = 0,
        refs = [];
      arr(cls.supportingParties).forEach(function (edge) {
        var exact = edge && typeof edge === 'object' && edge.partyId,
          name = typeof edge === 'string' ? edge : edge && (edge.party || edge.name || edge.partyName),
          matches = arr(n.parties).filter(function (p) {
            return exact ? p.id === exact : p.name === name && p.factionId === cls.factionId;
          });
        if (matches.length !== 1) return;
        var change = partyDeltas.get(matches[0].id);
        if (!change) return;
        var raw = edge && typeof edge === 'object' ? (edge.affinity == null ? edge.weight : edge.affinity) : null,
          affinity = raw == null ? options.defaultAffinity : Number(raw),
          d = Number(change.delta) * affinity * options.weight;
        if (!Number.isFinite(d) || !d) return;
        sum += d;
        refs.push({ partyId: change.party.id, partyName: change.party.name, delta: d });
      });
      if (!sum) return;
      var gate = options.gate(g, cls, Math.max(-4, Math.min(4, sum)), {
        turn: g.turn,
        source: options.source || 'party-outcome',
        reason: outcome.reason || '党派胜负',
      });
      cls.lastPartyOutcomeRef = refs;
      cls.lastPartyOutcomeTurn = g.turn;
      cls.partyOutcomeHistory = arr(cls.partyOutcomeHistory)
        .concat([{ turn: g.turn, satisfactionDelta: gate.approved, refs: refs }])
        .slice(-80);
      // Foreign networks update their own objects, never the player's minxin feedback or alerts.
      if (cls.factionId === g.startContext.playerFactionId) options.refresh(g, cls);
      applied.push({
        classId: cls.id,
        className: cls.name,
        oldSatisfaction: gate.before,
        newSatisfaction: gate.after,
        delta: gate.approved,
        refs: refs,
      });
      total += gate.approved;
    });
    g._partyClassCouplingLog = arr(g._partyClassCouplingLog)
      .concat(
        applied.map(function (x) {
          return Object.assign({ turn: g.turn }, x);
        }),
      )
      .slice(-200);
    return { ok: applied.length > 0, applied: applied, totalDelta: total, weight: options.weight };
  }
  root.TM = root.TM || {};
  root.TM.NativeScope = { bind: bind, coupleClass: coupleClass, coupleParty: coupleParty };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.NativeScope;
})(typeof window !== 'undefined' ? window : globalThis);
