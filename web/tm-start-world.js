// Opt-in runtime scope for a verified nativeStart. Legacy single-character worlds are unchanged.
(function (root) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports && !(root.TM && root.TM.FactionMembership))
    require('./tm-faction-membership.js');
  if (typeof module !== 'undefined' && module.exports && !(root.TM && root.TM.StartContracts))
    require('./tm-start-contracts.js');
  var clone = function (x) {
    return JSON.parse(JSON.stringify(x));
  };
  var list = function (x) {
    return Array.isArray(x) ? x : [];
  };
  var own = function (o, k) {
    return !!o && Object.prototype.hasOwnProperty.call(o, k);
  };
  var eventClaims = new WeakMap();
  function error(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }
  function enabled(g) {
    return !!(g && g.startContext && g.startContext.schemaVersion === 'tm-start-context/1');
  }
  function profile(s) {
    return list(s.nativeStart && s.nativeStart.profiles).find(function (p) {
      return p.id === s.startContext.startProfileId;
    });
  }
  function inspect(s) {
    var errors = [],
      n = s.nativeStart || {},
      resources = ['money', 'grain', 'cloth'],
      keys = new Set();
    list(n.accounts).forEach(function (a) {
      if (resources.indexOf(a.resource) < 0)
        errors.push({
          code: 'account-resource',
          message: '账户 ' + a.id + ' 须明确 money/grain/cloth 资源，不根据单位猜测',
        });
      var key = [a.ownerFactionId, a.kind, a.resource].join('\n');
      if (keys.has(key))
        errors.push({ code: 'account-resource-ambiguous', message: '同势力同类资源账户须先明确唯一支付汇总口' });
      keys.add(key);
    });
    list(n.rulesets).forEach(function (r) {
      var allowed = [
        'privateTreasuryEnabled',
        'government',
        'time',
        'gameSettings',
        'keju',
        'haremConfig',
        'fiscalConfig',
        'economyConfig',
        'neitangConfig',
      ];
      Object.keys(r.config || {}).forEach(function (k) {
        if (allowed.indexOf(k) < 0) errors.push({ code: 'rule-unsupported', message: '当前原生规则未实现：' + k });
      });
    });
    if (root.TM.NativeFiscal) errors = errors.concat(root.TM.NativeFiscal.inspect(s));
    return errors;
  }
  function prepareScenario(candidate) {
    var s = candidate.scenario,
      issues = inspect(s);
    if (issues.length)
      throw error(
        'native-runtime-contract',
        issues
          .map(function (x) {
            return x.message;
          })
          .join('；'),
      );
    var cfg = candidate.ruleset.config || {};
    [
      'government',
      'time',
      'gameSettings',
      'keju',
      'haremConfig',
      'fiscalConfig',
      'economyConfig',
      'neitangConfig',
    ].forEach(function (k) {
      if (own(cfg, k)) s[k] = clone(cfg[k]);
      else if (['government', 'keju', 'haremConfig', 'neitangConfig'].indexOf(k) >= 0) delete s[k];
    });
    s.keju = own(cfg, 'keju') ? clone(cfg.keju) : { enabled: false };
    s.haremConfig = own(cfg, 'haremConfig') ? clone(cfg.haremConfig) : { enabled: false };
    var asset = candidate.mapProof.asset;
    if (!asset) throw error('native-map-unavailable', '缺少已验证地图几何');
    var cells = new Map(
      list(asset.cells || asset.regions).map(function (c) {
        return [c.id, c];
      }),
    );
    if (asset.coordinateSystemId === 'wgs84')
      throw error('native-map-projection', '经纬度底图需要明确投影，不能当游戏像素直接显示');
    var minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    cells.forEach(function (cell) {
      var geom = cell.geometry;
      if (!geom) return;
      var components = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      components.forEach(function (poly) {
        poly.forEach(function (ring) {
          ring.forEach(function (p) {
            minX = Math.min(minX, p[0]);
            minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]);
            maxY = Math.max(maxY, p[1]);
          });
        });
      });
    });
    var rawWidth = Math.max(1, asset.width || maxX - minX),
      rawHeight = Math.max(1, asset.height || maxY - minY),
      width = Math.max(1200, rawWidth),
      height = Math.max(800, rawHeight);
    var scale = Math.min(width / rawWidth, height / rawHeight),
      offsetX = (width - rawWidth * scale) / 2 - (asset.width ? 0 : minX) * scale,
      offsetY = (height - rawHeight * scale) / 2 - (asset.height ? 0 : minY) * scale;
    function projectPoint(p) {
      return [p[0] * scale + offsetX, p[1] * scale + offsetY];
    }
    s.map = Object.assign({}, s.map, {
      enabled: true,
      id: asset.id,
      width: width,
      height: height,
      coordinateTransform: {
        sourceCoordinateSystemId: asset.coordinateSystemId,
        targetCoordinateSystemId: 'game-pixel',
        scale: scale,
        offset: [offsetX, offsetY],
      },
    });
    s.map.regions.forEach(function (r) {
      var cell = cells.get(r.id),
        g = cell && cell.geometry;
      if (!g || ['Polygon', 'MultiPolygon'].indexOf(g.type) < 0)
        throw error('native-map-geometry', '地图缺少可绘制的多边形：' + r.id);
      var polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(function (poly) {
        return poly.map(function (ring) {
          return ring.map(projectPoint);
        });
      });
      r.geometry = { type: 'MultiPolygon', coordinates: clone(polys) };
      r.coords = polys[0][0].reduce(function (a, p) {
        return a.concat(p);
      }, []);
      r.holes = clone(polys[0].slice(1));
      r.extraPolygons = polys.slice(1).map(function (p) {
        return p[0].reduce(function (a, v) {
          return a.concat(v);
        }, []);
      });
      r.geometryCoordinateSystem = 'game-pixel';
      var nativeGeo = root.TM.MapWorkbench;
      if (nativeGeo)
        r.center = projectPoint(
          cell.labelPoint && nativeGeo.contains(g, cell.labelPoint) ? cell.labelPoint : nativeGeo.anchor(g),
        );
      else if (cell.labelPoint) r.center = projectPoint(cell.labelPoint);
      else if (Array.isArray(r.center)) r.center = projectPoint(r.center);
      delete r.points;
      delete r.polygon;
      delete r.path;
      delete r.centroid;
      // The production SVG renderer consumes d first. Preserve every component and inner ring.
      r.d = polys
        .map(function (poly) {
          return poly
            .map(function (ring) {
              return (
                'M' +
                ring
                  .map(function (p) {
                    return p[0] + ' ' + p[1];
                  })
                  .join(' L') +
                ' Z'
              );
            })
            .join(' ');
        })
        .join(' ');
      var fac = s.factions.find(function (f) {
        return f.id === r.controllerFactionId || (!r.controllerFactionId && f.id === r.sovereignFactionId);
      });
      if (fac) root.TM.FactionMembership.projectLabels(r, fac, 'map-region');
    });
    s.startContext.mapAssetText = candidate.mapProof.assetText;
    return s;
  }
  function info(g) {
    if (!enabled(g)) return null;
    var ctx = g.startContext,
      id = ctx.currentPlayerCharacterId || ctx.playerCharacterId;
    var c = list(g.chars).find(function (c) {
        return c.id === id;
      }),
      f = list(g.facs).find(function (f) {
        return f.id === ctx.playerFactionId;
      });
    if (!c || !f) throw error('native-identity-missing', '存档中的当前人物或势力不存在');
    return { character: c, faction: f, context: ctx };
  }
  function resolveCharacter(g, ref) {
    return root.TM.StartContracts.resolveCharacter(g, ref);
  }
  function resolveHeir(g, dead) {
    var live = function (c) {
      return c && c.id !== dead.id && root.TM.StartContracts.isAlive(c);
    };
    if (dead.designatedHeirId) {
      var designated = resolveCharacter(g, { characterId: dead.designatedHeirId });
      return live(designated) ? designated : null;
    }
    var faction = list(g.facs).find(function (f) {
      return (
        f.id === (g.startContext.currentPlayerCharacterId === dead.id ? g.startContext.playerFactionId : dead.factionId)
      );
    });
    var refs = list(g.nativeWorld.ruleRefsByFaction && g.nativeWorld.ruleRefsByFaction[dead.factionId]);
    var rules =
      dead.id === g.startContext.currentPlayerCharacterId
        ? g.nativeWorld.ruleset
        : list(g.nativeWorld.rulesets).find(function (r) {
            return r.id === ((faction && faction.rulesetRef) || (refs.length === 1 ? refs[0] : null));
          });
    var gov = (rules && rules.config && rules.config.government) || {},
      law = dead.successionLaw || (faction && faction.successionLaw) || gov.successionLaw;
    var candidates = [];
    if (law === 'primogeniture')
      candidates = list(g.chars).filter(function (c) {
        return (
          live(c) && (c.fatherId === dead.id || c.motherId === dead.id || list(dead.childrenIds).indexOf(c.id) >= 0)
        );
      });
    else if (law === 'seniority' && dead.familyId)
      candidates = list(g.chars).filter(function (c) {
        return live(c) && c.familyId === dead.familyId;
      });
    else if (law === 'elective' && faction && faction.electedHeirId) {
      var elected = resolveCharacter(g, { characterId: faction.electedHeirId });
      return live(elected) ? elected : null;
    }
    var gender = dead.genderRestriction || gov.genderRestriction || 'none',
      genderNames = { 男: 'male', 男性: 'male', m: 'male', 女: 'female', 女性: 'female', f: 'female' };
    gender = genderNames[gender] || gender;
    if (gender !== 'none')
      candidates = candidates.filter(function (c) {
        return (genderNames[c.gender] || c.gender) === gender;
      });
    // Unspecified election procedures or unknown ages do not grant the strongest NPC a default throne.
    if (
      !candidates.length ||
      candidates.some(function (c) {
        return typeof c.age !== 'number' || !Number.isFinite(c.age);
      })
    )
      return null;
    return candidates.sort(function (a, b) {
      return b.age - a.age || String(a.id).localeCompare(String(b.id));
    })[0];
  }
  function eventVisible(g, e) {
    return (
      !enabled(g) ||
      !!(
        e &&
        (e.scope === 'world' ||
          e.factionId === g.startContext.playerFactionId ||
          e.characterId === (g.startContext.currentPlayerCharacterId || g.startContext.playerCharacterId) ||
          list(g.nativeWorld.scope.openingEventIds).indexOf(e.id) >= 0 ||
          list(e.observerFactionIds).indexOf(g.startContext.playerFactionId) >= 0)
      )
    );
  }
  function eventChoiceAllowed(g, e) {
    return (
      !enabled(g) ||
      !!(
        eventVisible(g, e) &&
        (!e.characterId ||
          e.characterId === (g.startContext.currentPlayerCharacterId || g.startContext.playerCharacterId)) &&
        allowed(
          g,
          e.requiredGrant || 'govern',
          e.decisionAuthorityFactionId || e.factionId || g.startContext.playerFactionId,
          e.regionId,
        )
      )
    );
  }
  function resolveEvent(g, ref) {
    var rows = list(g.nativeWorld && g.nativeWorld.events),
      id = ref.eventId || ref.id;
    if (id) {
      var exact = rows.filter(function (e) {
        return e.id === id;
      });
      return exact.length === 1 ? exact[0] : null;
    }
    var matched = rows.filter(function (e) {
      return eventVisible(g, e) && (e.name === ref.name || e.title === ref.name);
    });
    return matched.length === 1 ? matched[0] : null;
  }
  function claimEvent(g, id) {
    var claims = eventClaims.get(g);
    if (!claims) {
      claims = new Map();
      eventClaims.set(g, claims);
    }
    if (claims.has(id)) return null;
    var token = { id: id };
    claims.set(id, token);
    return token;
  }
  function releaseEvent(g, token) {
    var claims = eventClaims.get(g);
    if (claims && token && claims.get(token.id) === token) claims.delete(token.id);
  }
  function allowed(g, action, targetFactionId, targetRegionId, actorId) {
    if (!enabled(g)) return true;
    var who = actorId || g.startContext.currentPlayerCharacterId || g.startContext.playerCharacterId,
      n = g.nativeWorld;
    var actor = list(g.chars).find(function (c) {
      return c.id === who;
    });
    if (!actor || !root.TM.StartContracts.isAlive(actor) || list(n && n.revokedAuthorityCharacters).indexOf(who) >= 0)
      return false;
    var a =
        n &&
        (who === (g.startContext.currentPlayerCharacterId || g.startContext.playerCharacterId)
          ? n.authority
          : list(n.authorities).find(function (x) {
              return x.characterId === who && x.status === 'active' && list(x.grants).indexOf(action) >= 0;
            })),
      j = a && a.jurisdiction;
    return !!(
      a &&
      a.characterId === who &&
      a.status === 'active' &&
      list(a.grants).indexOf(action) >= 0 &&
      j &&
      (!targetFactionId || list(j.factionIds).indexOf(targetFactionId) >= 0) &&
      (!targetRegionId || list(j.regionIds).indexOf(targetRegionId) >= 0)
    );
  }
  function bindOffices(g) {
    if (!enabled(g) || !g.nativeWorld) return { ok: false };
    var n = g.nativeWorld;
    n.offices[g.startContext.playerFactionId] = g.officeTree;
    n.baseOfficeTree = list(n.baseOfficeTree).filter(function (d) {
      return d.authorityFactionId !== g.startContext.playerFactionId;
    });
    function walk(nodes) {
      list(nodes).forEach(function (d) {
        list(d.positions).forEach(function (p) {
          if (!Array.isArray(p.actualHolders))
            p.actualHolders =
              p.holderId == null || p.holderId === '' ? [] : [{ characterId: p.holderId, generated: true }];
          p.actualHolders.forEach(function (h) {
            if (h.generated === false) return;
            var c = list(g.chars).find(function (c) {
              return c.id === h.characterId;
            });
            if (!c) throw error('native-office-holder', '任职须引用存在的稳定人物 ID：' + p.id);
            h.name = c.name;
          });
          var occupied = p.actualHolders.filter(function (h) {
            return h.generated !== false;
          });
          p.holder = occupied.length ? occupied[0].name : '';
          p.holderId = occupied.length ? occupied[0].characterId : null;
          p.additionalHolders = occupied.slice(1).map(function (h) {
            return h.name;
          });
          p.additionalHolderIds = occupied.slice(1).map(function (h) {
            return h.characterId;
          });
        });
        walk(d.subs);
        walk(d.children);
      });
    }
    Object.keys(n.offices).forEach(function (k) {
      walk(n.offices[k]);
    });
    walk(n.baseOfficeTree);
    return { ok: true, native: true };
  }
  function officePermission(g, pos, actorId) {
    if (!enabled(g)) return true;
    var matches = [];
    function walk(nodes) {
      list(nodes).forEach(function (d) {
        if (
          list(d.positions).some(function (p) {
            return p === pos;
          })
        )
          matches.push(d);
        walk(d.subs);
        walk(d.children);
      });
    }
    walk(g.officeTree);
    Object.keys(g.nativeWorld.offices || {}).forEach(function (k) {
      if (k !== g.startContext.playerFactionId) walk(g.nativeWorld.offices[k]);
    });
    if (matches.length !== 1 || !matches[0].authorityFactionId) return false;
    var d = matches[0],
      regions = list(d.jurisdiction && d.jurisdiction.regionIds);
    return (
      allowed(g, 'appoint', d.authorityFactionId, null, actorId) &&
      regions.every(function (id) {
        return allowed(g, 'appoint', d.authorityFactionId, id, actorId);
      })
    );
  }
  function views(g) {
    if (!enabled(g) || !g.nativeWorld) return;
    if (root.TM.NativeScope) {
      root.TM.NativeScope.bind(g);
      return;
    }
    var n = g.nativeWorld,
      s = n.scope;
    g.classes = list(n.classes).filter(function (x) {
      return s.classIds.indexOf(x.id) >= 0;
    });
    g.parties = list(n.parties).filter(function (x) {
      return s.partyIds.indexOf(x.id) >= 0;
    });
    g.events = list(n.events).filter(function (x) {
      return (
        x.scope === 'world' || x.factionId === g.startContext.playerFactionId || s.openingEventIds.indexOf(x.id) >= 0
      );
    });
  }
  function initialize(g, p, s) {
    if (!s.startContext || !s.nativeStart) return false;
    var start = profile(s),
      n = s.nativeStart;
    if (!start) throw error('native-profile-missing', '原生开局配置不存在');
    g.startContext = clone(s.startContext);
    g.startContext.currentPlayerCharacterId = g.startContext.playerCharacterId;
    g.nativeWorld = {
      schemaVersion: 1,
      scope: clone(
        n.contentScopes.find(function (x) {
          return x.id === start.contentScopeRef;
        }),
      ),
      authority: clone(
        n.authorities.find(function (x) {
          return x.id === start.authorityRef;
        }),
      ),
      authorities: clone(n.authorities),
      ruleset: clone(
        n.rulesets.find(function (x) {
          return x.id === start.rulesetRef;
        }),
      ),
      accounts: clone(n.accounts),
      classes: g.classes,
      parties: g.parties,
      events: g.events,
      offices: clone(s.officeRegistryByFaction || {}),
      baseOfficeTree: clone(s.officeTree || []),
    };
    g.nativeWorld.rulesets = clone(n.rulesets);
    g.nativeWorld.ruleset = g.nativeWorld.rulesets.find(function (r) {
      return r.id === start.rulesetRef;
    });
    g.nativeWorld.ruleRefsByFaction = {};
    list(n.profiles).forEach(function (p) {
      var refs = g.nativeWorld.ruleRefsByFaction[p.factionId] || (g.nativeWorld.ruleRefsByFaction[p.factionId] = []);
      if (refs.indexOf(p.rulesetRef) < 0) refs.push(p.rulesetRef);
    });
    var selected = info(g);
    g.nativeWorld.authority.headTitle = selected.character.title || selected.character.officialTitle || '元首';
    g.chars.forEach(function (c) {
      c.isPlayer = c.id === selected.character.id;
      var f = g.facs.find(function (f) {
        return f.id === c.factionId;
      });
      if (f) root.TM.FactionMembership.projectLabels(c, f, 'character');
    });
    g.facs.forEach(function (f) {
      f.isPlayer = f.id === selected.faction.id;
    });
    list(g.armies).forEach(function (a) {
      var f = g.facs.find(function (f) {
        return f.id === a.ownerFactionId;
      });
      if (!f) throw error('native-army-owner', '部队缺少明确所有者：' + a.id);
      root.TM.FactionMembership.projectLabels(a, f, 'army');
    });
    g.playerCharacterId = selected.character.id;
    g.playerInfo = Object.assign({}, g.playerInfo, {
      characterId: selected.character.id,
      characterName: selected.character.name,
      factionId: selected.faction.id,
      factionName: selected.faction.name,
    });
    var region = list(s.map && s.map.regions).find(function (r) {
      return r.id === g.startContext.startRegionId;
    });
    if (region) {
      g._capital = region.name;
      g.playerInfo.location = region.name;
      selected.character.location = region.name;
      selected.character.regionId = region.id;
    }
    p.playerInfo = clone(g.playerInfo);
    var office = g.nativeWorld.offices[selected.faction.id];
    if (!Array.isArray(office))
      office = g.nativeWorld.baseOfficeTree.filter(function (d) {
        return d.authorityFactionId === selected.faction.id;
      });
    g.officeTree = office;
    bindOffices(g);
    views(g);
    return true;
  }
  function finishInitialization(g) {
    if (!enabled(g) || !g.nativeWorld) return;
    var n = g.nativeWorld,
      player = g.startContext.playerFactionId;
    if (n.financeReady) throw error('native-initialization-reentry', '初始库存只能在新局准备期间绑定一次');
    function stock(kind, resource) {
      var a = n.accounts.find(function (a) {
        return a.ownerFactionId === player && a.kind === kind && a.resource === resource;
      });
      return a ? a.balance : 0;
    }
    g.guoku = Object.assign({}, g.guoku, {
      money: stock('public', 'money'),
      grain: stock('public', 'grain'),
      cloth: stock('public', 'cloth'),
    });
    g.neitang = Object.assign({}, g.neitang, {
      money: stock('private', 'money'),
      balance: stock('private', 'money'),
      grain: stock('private', 'grain'),
      cloth: stock('private', 'cloth'),
      enabled: n.ruleset.config.privateTreasuryEnabled === true,
    });
    [
      ['guoku', 'public'],
      ['neitang', 'private'],
    ].forEach(function (pair) {
      var model = g[pair[0]];
      model.ledgers = model.ledgers || {};
      model.balance = stock(pair[1], 'money');
      ['money', 'grain', 'cloth'].forEach(function (resource) {
        model.ledgers[resource] = Object.assign({}, model.ledgers[resource], { stock: stock(pair[1], resource) });
      });
    });
    g.stateTreasury = g.guoku.money;
    g.privateTreasury = g.neitang.money;
    if (root.TM.NativeFiscal) root.TM.NativeFiscal.bind(g, true);
    views(g);
  }
  function rebind(g) {
    if (!enabled(g)) return;
    if (!g.nativeWorld || g.nativeWorld.schemaVersion !== 1)
      throw error('native-world-missing', '原生存档缺少完整世界注册表');
    var current = info(g);
    g.playerCharacterId = current.character.id;
    g.chars.forEach(function (c) {
      c.isPlayer = c.id === current.character.id;
    });
    g.playerInfo = Object.assign({}, g.playerInfo, {
      characterId: current.character.id,
      characterName: current.character.name,
      factionId: current.faction.id,
      factionName: current.faction.name,
    });
    views(g);
    bindOffices(g);
    if (root.TM.NativeFiscal) root.TM.NativeFiscal.bind(g, false);
  }
  async function validateSnapshot(g) {
    if (!enabled(g)) return true;
    info(g);
    if (!g.nativeWorld || g.nativeWorld.schemaVersion !== 1 || g.nativeWorld.financeReady !== true)
      throw error('native-save-incomplete', '原生存档缺少已初始化的世界与账目，不能当作完整游戏载入');
    var ctx = g.startContext,
      ref = ctx.mapRef,
      text = ctx.mapAssetText;
    if (!ref || typeof text !== 'string')
      throw error('native-save-map-missing', '存档缺少锁定版本的地图快照，不能替换成新图');
    var bytes = new root.TextEncoder().encode(text),
      hash = await root.TM.StartCompiler.sha256(bytes);
    if (bytes.byteLength !== ref.byteLength || hash !== ref.contentHash)
      throw error('native-save-map-hash', '存档地图版本摘要不符');
    var map = JSON.parse(text);
    if (map.id !== ref.mapId || map.version !== ref.mapVersion || map.coordinateSystemId !== ref.coordinateSystemId)
      throw error('native-save-map-version', '存档地图版本或坐标系统不符');
    return true;
  }
  root.TM = root.TM || {};
  root.TM.NativeWorld = {
    capabilities: ['tm-native-world/1'],
    inspect: inspect,
    prepareScenario: prepareScenario,
    enabled: enabled,
    info: info,
    allowed: allowed,
    resolveCharacter: resolveCharacter,
    resolveHeir: resolveHeir,
    eventVisible: eventVisible,
    eventChoiceAllowed: eventChoiceAllowed,
    resolveEvent: resolveEvent,
    claimEvent: claimEvent,
    releaseEvent: releaseEvent,
    initialize: initialize,
    finishInitialization: finishInitialization,
    rebind: rebind,
    views: views,
    bindOffices: bindOffices,
    officePermission: officePermission,
    validateSnapshot: validateSnapshot,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.NativeWorld;
})(typeof window !== 'undefined' ? window : globalThis);
