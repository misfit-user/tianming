// @ts-check
// 原生开局的数据契约。只读源数据；不读写 GM/P、不生成君主、不启动游戏。
(function (root) {
  'use strict';
  var SCHEMA = 'tm-native-start/1';
  var ROLES = ['headOfState', 'regent', 'delegatedRepresentative'];
  var EVIDENCE = ['attested', 'reconstructed', 'fictional', 'unknown'];
  var ACTIONS = ['govern', 'appoint', 'tax', 'command', 'diplomacy', 'treasury'];
  var own = function (o, k) {
    return !!o && Object.prototype.hasOwnProperty.call(o, k);
  };
  var arr = function (x) {
    return Array.isArray(x) ? x : [];
  };
  var str = function (x) {
    return typeof x === 'string' ? x : '';
  };
  var idOK = function (x) {
    return typeof x === 'string' && x.length > 0 && x.length <= 256 && x.trim() === x && !/[\x00-\x1f\x7f]/.test(x);
  };
  var clone = function (x) {
    return JSON.parse(JSON.stringify(x));
  };
  function issue(code, path, message) {
    return { code: code, path: path, message: message };
  }
  function alive(c) {
    return !!c && c.alive !== false && !c.dead && c.status !== 'dead' && c.status !== '死亡';
  }
  function uniqueBy(rows, key, value) {
    var found = rows.filter(function (r) {
      return r && r[key] === value;
    });
    return found.length === 1 ? found[0] : null;
  }
  function index(rows, path, errors, allIds) {
    var out = Object.create(null);
    if (!Array.isArray(rows)) {
      errors.push(issue('collection-shape', path, '应为带稳定 ID 的数组'));
      return out;
    }
    if (rows.length > 50000) {
      errors.push(issue('collection-limit', path, '集合超过 50000 项'));
      return out;
    }
    rows.forEach(function (row, n) {
      var p = path + '.' + n;
      if (!row || !idOK(row.id)) {
        errors.push(issue('invalid-id', p + '.id', '缺少合法稳定 ID'));
        return;
      }
      if (own(out, row.id) || (allIds && own(allIds, row.id))) {
        errors.push(issue('duplicate-id', p + '.id', 'ID 重复：' + row.id));
        return;
      }
      out[row.id] = row;
      if (allIds) allIds[row.id] = p;
    });
    return out;
  }
  function regionRows(s) {
    if (s.map && Array.isArray(s.map.regions)) return s.map.regions;
    if (s.mapData && Array.isArray(s.mapData.regions)) return s.mapData.regions;
    return [];
  }
  function eventRows(s) {
    if (Array.isArray(s.events)) return s.events;
    var out = [];
    ['historical', 'random', 'conditional', 'story', 'chain'].forEach(function (key) {
      out = out.concat(arr(s.events && s.events[key]));
    });
    return out;
  }
  function idList(value, byId, path, errors, required) {
    if (!Array.isArray(value) || (required && !value.length)) {
      errors.push(issue('reference-list', path, '应为' + (required ? '非空' : '') + ' ID 数组'));
      return [];
    }
    var seen = Object.create(null);
    value.forEach(function (id, n) {
      if (!idOK(id) || !own(byId, id))
        errors.push(issue('missing-reference', path + '.' + n, '引用不存在：' + str(id)));
      else if (own(seen, id)) errors.push(issue('duplicate-reference', path + '.' + n, '重复引用：' + id));
      seen[id] = true;
    });
    return value;
  }
  function currentHead(faction, character, chars) {
    if (!faction || !character) return false;
    if (own(faction, 'headOfStateIds')) return arr(faction.headOfStateIds).indexOf(character.id) >= 0;
    if (own(faction, 'leaderCharacterId')) return faction.leaderCharacterId === character.id;
    if (faction.leader === character.id) return true;
    return !!faction.leader && uniqueBy(chars, 'name', faction.leader) === character;
  }
  function mapRefErrors(ref) {
    var errors = [],
      p = 'nativeStart.mapRef';
    if (!ref || typeof ref !== 'object') return [issue('map-ref', p, '缺少锁定版本的地图引用')];
    ['assetId', 'schemaVersion', 'mapId', 'mapVersion', 'coordinateSystemId'].forEach(function (key) {
      if (!idOK(ref[key])) errors.push(issue('map-ref', p + '.' + key, '地图引用字段缺失或非法'));
    });
    if (!/^[a-f0-9]{64}$/.test(str(ref.contentHash)))
      errors.push(issue('map-hash', p + '.contentHash', '需要原始字节 SHA-256'));
    if (!Number.isSafeInteger(ref.byteLength) || ref.byteLength <= 0)
      errors.push(issue('map-bytes', p + '.byteLength', '需要真实正整数字节数'));
    return errors;
  }
  function authorityErrors(a, p, idx, chars) {
    var errors = [],
      path = 'nativeStart.authorities.' + str(p.authorityRef);
    if (!a) return [issue('authority-missing', path, '缺少显式身份与授权关系')];
    if (
      a.characterId !== p.playerCharacterId ||
      a.factionId !== p.factionId ||
      a.roleKind !== p.roleKind ||
      a.status !== 'active'
    ) {
      errors.push(issue('authority-mismatch', path, '授权须对应所选人物、势力、角色且当前有效'));
    }
    var c = idx.characters[p.playerCharacterId],
      f = idx.factions[p.factionId],
      basis = a.basis || {};
    var modeled = basis.kind === 'author-modeled' && str(basis.note).trim() && idOK(basis.sourceRef);
    if (p.roleKind === 'headOfState' && !modeled && !(basis.kind === 'current-office' && currentHead(f, c, chars))) {
      errors.push(issue('head-unproven', path + '.basis', '未对应现任元首或明确作者建模依据'));
    }
    if (
      p.roleKind === 'regent' &&
      !modeled &&
      !(basis.kind === 'current-office' && f && arr(f.regentCharacterIds).indexOf(p.playerCharacterId) >= 0)
    ) {
      errors.push(issue('regent-unproven', path + '.basis', '未对应显式摄政关系'));
    }
    if (p.roleKind === 'delegatedRepresentative') {
      var issuer = idx.characters[basis.issuerCharacterId];
      if (
        !modeled &&
        !(basis.kind === 'delegation' && alive(issuer) && currentHead(f, issuer, chars) && idOK(basis.sourceRef))
      ) {
        errors.push(issue('delegation-unproven', path + '.basis', '代表须有现任授权者或明确作者建模依据'));
      }
    }
    if (
      !Array.isArray(a.grants) ||
      !a.grants.length ||
      a.grants.some(function (x, n) {
        return ACTIONS.indexOf(x) < 0 || a.grants.indexOf(x) !== n;
      })
    ) {
      errors.push(issue('authority-grants', path + '.grants', '须明确列出不重复的受支持权限；头衔不授予权限'));
    }
    var j = a.jurisdiction || {};
    idList(j.factionIds, idx.factions, path + '.jurisdiction.factionIds', errors, true);
    idList(j.regionIds, idx.regions, path + '.jurisdiction.regionIds', errors, false);
    if (arr(j.factionIds).indexOf(p.factionId) < 0)
      errors.push(issue('authority-scope', path + '.jurisdiction', '授权范围未包含所选势力'));
    return errors;
  }
  function scopeErrors(scope, p, idx) {
    var path = 'nativeStart.contentScopes.' + str(p.contentScopeRef),
      errors = [];
    if (!scope) return [issue('scope-missing', path, '缺少显式内容作用域')];
    if (scope.factionId !== p.factionId)
      errors.push(issue('scope-faction', path + '.factionId', '作用域与所选势力不一致'));
    [
      ['classIds', 'classes'],
      ['partyIds', 'parties'],
      ['officeFactionIds', 'factions'],
      ['openingEventIds', 'events'],
      ['accountIds', 'accounts'],
    ].forEach(function (pair) {
      idList(scope[pair[0]], idx[pair[1]], path + '.' + pair[0], errors, false);
    });
    arr(scope.accountIds).forEach(function (id) {
      var a = idx.accounts[id];
      if (a && a.ownerFactionId !== p.factionId)
        errors.push(issue('account-owner', path + '.accountIds', '开局账目不能借用其他势力的账户：' + id));
    });
    return errors;
  }
  function profileErrors(p, idx, chars, capabilities) {
    var errors = [],
      path = 'nativeStart.profiles.' + str(p && p.id);
    if (!p || typeof p !== 'object') return [issue('profile-shape', path, '开局配置应为对象')];
    ['factionId', 'playerCharacterId', 'authorityRef', 'startRegionId', 'rulesetRef', 'contentScopeRef'].forEach(
      function (key) {
        if (!idOK(p[key])) errors.push(issue('profile-field', path + '.' + key, '必须提供稳定引用 ID'));
      },
    );
    if (ROLES.indexOf(p.roleKind) < 0)
      errors.push(issue('role-kind', path + '.roleKind', '角色须为元首、摄政或受托代表'));
    if (EVIDENCE.indexOf(p.evidenceStatus) < 0)
      errors.push(issue('evidence-status', path + '.evidenceStatus', '须明确史实／重建／原创／未知'));
    if (typeof p.enabled !== 'boolean')
      errors.push(issue('enabled-required', path + '.enabled', '必须显式配置是否开放'));
    if (
      !Array.isArray(p.disabledReasons) ||
      p.disabledReasons.some(function (v) {
        return typeof v !== 'string';
      })
    )
      errors.push(issue('disabled-reasons', path + '.disabledReasons', '缺项说明应为文本数组'));
    if (
      p.enabled === false &&
      !arr(p.disabledReasons).some(function (v) {
        return str(v).trim();
      })
    )
      errors.push(issue('disabled-reason-missing', path + '.disabledReasons', '关闭的开局须说明原因'));
    var c = idx.characters[p.playerCharacterId],
      f = idx.factions[p.factionId];
    if (!c) errors.push(issue('character-missing', path + '.playerCharacterId', '所选人物不存在'));
    else if (!alive(c)) errors.push(issue('character-dead', path + '.playerCharacterId', '不能以已死亡人物重新开局'));
    else if (c.alive !== true)
      errors.push(
        issue(
          'character-status-unknown',
          path + '.playerCharacterId',
          '新开局配置须明确人物当前存活，不能把缺项视为存活',
        ),
      );
    if (!f) errors.push(issue('faction-missing', path + '.factionId', '所选势力不存在'));
    if (!idx.regions[p.startRegionId])
      errors.push(issue('region-missing', path + '.startRegionId', '驻点不存在，不能按模糊地名替换'));
    errors = errors.concat(
      authorityErrors(idx.authorities[p.authorityRef], p, idx, chars),
      scopeErrors(idx.contentScopes[p.contentScopeRef], p, idx),
    );
    var rules = idx.rulesets[p.rulesetRef];
    if (!rules) errors.push(issue('ruleset-missing', path + '.rulesetRef', '缺少本地规则，不能继承上一剧本制度'));
    else {
      if (!idOK(rules.version))
        errors.push(issue('ruleset-version', 'nativeStart.rulesets.' + rules.id, '规则须有版本'));
      if (
        !Array.isArray(rules.requiredCapabilities) ||
        !rules.requiredCapabilities.length ||
        rules.requiredCapabilities.some(function (x) {
          return !idOK(x);
        })
      ) {
        errors.push(issue('capabilities-required', 'nativeStart.rulesets.' + rules.id, '规则须声明实际所需运行能力'));
      } else
        rules.requiredCapabilities.forEach(function (cap) {
          if (capabilities.indexOf(cap) < 0)
            errors.push(issue('capability-unavailable', path + '.rulesetRef', '当前准备器未实现所需能力：' + cap));
        });
    }
    if (own(p, 'initialStateOverrides')) {
      var overrides = p.initialStateOverrides;
      if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides))
        errors.push(issue('overrides-shape', path + '.initialStateOverrides', '覆盖须为白名单对象'));
      else
        Object.keys(overrides).forEach(function (key) {
          if (
            ['openingText', 'startPressure'].indexOf(key) < 0 ||
            typeof overrides[key] !== 'string' ||
            overrides[key].length > 16000
          ) {
            errors.push(
              issue(
                'override-forbidden',
                path + '.initialStateOverrides.' + key,
                '仅允许有界开场文案，不允许覆盖身份或世界集合',
              ),
            );
          }
        });
    }
    return errors;
  }
  function summary(s, p, idx) {
    var c = idx.characters[p.playerCharacterId] || {},
      f = idx.factions[p.factionId] || {},
      scope = idx.contentScopes[p.contentScopeRef] || {};
    var owned = arr(s.military && s.military.initialTroops).filter(function (a) {
      return a && a.ownerFactionId === p.factionId;
    });
    var unknownSoldiers = owned.some(function (a) {
      return !Number.isSafeInteger(a.soldiers) || a.soldiers < 0;
    });
    var regionIds = Object.keys(idx.regions),
      territoryKnown = regionIds.every(function (id) {
        return own(idx.regions[id], 'sovereignFactionId');
      });
    var territoryCount = territoryKnown
      ? regionIds.filter(function (id) {
          return idx.regions[id].sovereignFactionId === p.factionId;
        }).length
      : null;
    var soldiers = unknownSoldiers
      ? null
      : owned.reduce(function (sum, a) {
          return sum + a.soldiers;
        }, 0);
    return {
      profileId: p.id,
      factionId: p.factionId,
      factionName: str(f.name),
      characterId: p.playerCharacterId,
      characterName: str(c.name),
      characterTitle: str(c.title),
      portrait: str(c.portrait || c.avatar),
      roleKind: p.roleKind,
      evidenceStatus: p.evidenceStatus,
      politicalType: str(f.governmentType || f.type),
      regionId: p.startRegionId,
      regionName: str((idx.regions[p.startRegionId] || {}).name),
      aliases: arr(f.aliases)
        .concat(arr(c.aliases))
        .filter(function (x) {
          return typeof x === 'string';
        }),
      territoryCount: territoryCount,
      armyCount: owned.length,
      soldiers: Number.isSafeInteger(soldiers) ? soldiers : null,
      accounts: arr(scope.accountIds)
        .map(function (id) {
          var a = idx.accounts[id];
          return a ? { id: a.id, kind: a.kind, balance: a.balance, unit: a.unit } : null;
        })
        .filter(Boolean),
      startPressure: str(p.initialStateOverrides && p.initialStateOverrides.startPressure),
      openingText:
        p.initialStateOverrides && own(p.initialStateOverrides, 'openingText')
          ? p.initialStateOverrides.openingText
          : '你将以' + str(c.name) + '的身份，进入' + str(f.name) + '的开局。' + str(f.desc),
    };
  }
  function worldReferenceErrors(s, idx, errors, ids) {
    var troops = s.military && s.military.initialTroops;
    if (troops == null) troops = [];
    var armies = index(troops, 'military.initialTroops', errors, ids);
    Object.keys(armies).forEach(function (id) {
      var a = armies[id],
        p = 'military.initialTroops.' + id;
      if (!idx.factions[a.ownerFactionId])
        errors.push(issue('army-owner', p + '.ownerFactionId', '部队须有明确所有者，不能按指挥者或当前玩家猜归属'));
      if (!Number.isSafeInteger(a.soldiers) || a.soldiers < 0)
        errors.push(issue('army-size', p + '.soldiers', '兵额须为非负安全整数，缺失不等于零'));
      if (!idx.regions[a.garrisonRegionId])
        errors.push(issue('army-garrison', p + '.garrisonRegionId', '部队驻点须引用实际地区'));
      if (a.commanderId != null && !idx.characters[a.commanderId])
        errors.push(issue('army-commander', p + '.commanderId', '指挥者引用不存在；空缺须显式为 null'));
      var shares = a.payerShares,
        sums = Object.create(null),
        seen = Object.create(null);
      if (!Array.isArray(shares) || !shares.length) {
        errors.push(issue('army-payers', p + '.payerShares', '部队须明确支付账户与份额'));
        return;
      }
      shares.forEach(function (share) {
        if (
          !share ||
          !idx.accounts[share.accountId] ||
          own(seen, share.accountId) ||
          typeof share.share !== 'number' ||
          !Number.isFinite(share.share) ||
          share.share < 0 ||
          share.share > 1
        ) {
          errors.push(issue('army-payer-share', p + '.payerShares', '支付账户须存在、不重复，份额须在 0 到 1 之间'));
          return;
        }
        seen[share.accountId] = true;
        var resource = idx.accounts[share.accountId].resource || 'legacy-unit';
        sums[resource] = (sums[resource] || 0) + share.share;
      });
      Object.keys(sums).forEach(function (resource) {
        if (Math.abs(sums[resource] - 1) > 1e-9)
          errors.push(issue('army-payer-total', p + '.payerShares', '每种资源的联合支付份额合计必须为 1'));
      });
    });
    Object.keys(idx.regions).forEach(function (id) {
      var r = idx.regions[id];
      ['sovereignFactionId', 'controllerFactionId', 'taxAuthorityFactionId'].forEach(function (key) {
        if (own(r, key) && r[key] !== null && !idx.factions[r[key]])
          errors.push(
            issue(
              'region-authority-reference',
              'regions.' + id + '.' + key,
              '地块权属引用不存在，不能由颜色或名称推断',
            ),
          );
      });
    });
  }
  function inspect(s, options) {
    options = options || {};
    if (!s || typeof s !== 'object')
      return {
        schemaVersion: SCHEMA,
        mode: 'invalid',
        valid: false,
        errors: [issue('source-shape', '', '剧本应为对象')],
        profiles: [],
      };
    if (!own(s, 'nativeStart')) return inspectLegacy(s);
    var n = s.nativeStart,
      errors = [],
      idx = {},
      ids = Object.create(null);
    if (!n || n.schemaVersion !== SCHEMA)
      return {
        schemaVersion: SCHEMA,
        mode: 'native',
        valid: false,
        errors: [issue('schema-version', 'nativeStart.schemaVersion', '不支持的原生开局契约')],
        profiles: [],
      };
    if (!idOK(s.id)) errors.push(issue('scenario-id', 'id', '源剧本须有稳定 ID'));
    [
      ['characters', arr(s.characters)],
      ['factions', arr(s.factions)],
      ['regions', regionRows(s)],
      ['classes', arr(s.classes)],
      ['parties', arr(s.parties)],
      ['events', eventRows(s)],
    ].forEach(function (pair) {
      idx[pair[0]] = index(pair[1], pair[0], errors, ids);
    });
    ['profiles', 'authorities', 'rulesets', 'contentScopes', 'accounts'].forEach(function (key) {
      idx[key] = index(n[key], 'nativeStart.' + key, errors, ids);
    });
    if (arr(n.profiles).length < 1 || n.profiles.length > 512)
      errors.push(issue('profile-count', 'nativeStart.profiles', '需要 1 至 512 项开局配置'));
    errors = errors.concat(mapRefErrors(n.mapRef));
    Object.keys(idx.accounts).forEach(function (id) {
      var a = idx.accounts[id],
        path = 'nativeStart.accounts.' + id;
      if (
        !idx.factions[a.ownerFactionId] ||
        ['public', 'private'].indexOf(a.kind) < 0 ||
        !idOK(a.unit) ||
        typeof a.balance !== 'number' ||
        !Number.isFinite(a.balance) ||
        a.balance < 0
      ) {
        errors.push(issue('account-invalid', path, '账户须有归属、种类、单位和有限非负余额（零有效）'));
      }
    });
    worldReferenceErrors(s, idx, errors, ids);
    var profiles = arr(n.profiles)
      .slice(0, 512)
      .map(function (p) {
        var diagnostics = profileErrors(p, idx, arr(s.characters), arr(options.capabilities));
        var row = {
          id: p && p.id,
          enabled: !!p && p.enabled === true && !errors.length && !diagnostics.length,
          valid:
            !errors.length &&
            !diagnostics.some(function (d) {
              return d.code !== 'capability-unavailable';
            }),
          errors: diagnostics,
          disabledReasons: arr(p && p.disabledReasons).slice(),
          summary: p ? summary(s, p, idx) : null,
        };
        return row;
      });
    return {
      schemaVersion: SCHEMA,
      mode: 'native',
      sourceScenarioId: s.id,
      valid:
        !errors.length &&
        profiles.every(function (p) {
          return p.valid;
        }),
      errors: errors,
      profiles: profiles,
      counts: {
        characters: Object.keys(idx.characters).length,
        factions: Object.keys(idx.factions).length,
        regions: Object.keys(idx.regions).length,
      },
    };
  }
  // 旧单主角入口不新增强制选择。此适配只报告身份；不能拿它重新初始化读档或生成新人物。
  function inspectLegacy(s) {
    var errors = [],
      warnings = [],
      pi = s.playerInfo || {},
      chars = arr(s.characters),
      factions = arr(s.factions),
      c = null,
      f = null;
    if (!idOK(s.id)) errors.push(issue('legacy-scenario-id', 'id', '旧剧本缺少稳定 ID，不能生成有效兼容目录'));
    if (pi.characterId) {
      c = uniqueBy(chars, 'id', pi.characterId);
      if (!c)
        errors.push(issue('legacy-character-id', 'playerInfo.characterId', '显式人物 ID 缺失或重复，不按名字替代'));
    } else {
      var flagged = chars.filter(function (x) {
        return x && x.isPlayer === true;
      });
      if (flagged.length === 1) c = flagged[0];
      else if (flagged.length > 1)
        errors.push(issue('legacy-player-ambiguous', 'characters', '多个玩家标记，不能猜第一个'));
      else c = uniqueBy(chars, 'name', pi.characterName);
    }
    if (!c) errors.push(issue('legacy-player-unresolved', 'playerInfo', '未能唯一识别旧主角；保留旧入口，需单独核对'));
    else {
      if (!alive(c)) errors.push(issue('character-dead', 'characters.' + str(c.id), '所选人物已死亡'));
      if (!idOK(c.id)) errors.push(issue('legacy-player-id', 'characters', '旧人物缺稳定 ID，需新局阶段显式迁移'));
      if (pi.factionId || c.factionId) f = uniqueBy(factions, 'id', pi.factionId || c.factionId);
      else f = uniqueBy(factions, 'name', pi.factionName || c.faction);
      if (!f || !idOK(f.id)) errors.push(issue('legacy-faction-unresolved', 'playerInfo', '未能唯一识别旧势力'));
    }
    var role = f && c && currentHead(f, c, chars) ? 'headOfState' : 'legacyRole';
    warnings.push(
      issue('legacy-derived', 'playerInfo', '仅适配旧单主角身份；旧入口、财政和规则保持不变，不据头衔新增权限'),
    );
    var id =
      c && idOK(c.id) && idOK(s.id)
        ? 'legacy-start:' + encodeURIComponent(s.id) + ':' + encodeURIComponent(c.id)
        : null;
    return {
      schemaVersion: SCHEMA,
      mode: 'legacy',
      sourceScenarioId: s.id,
      valid: !errors.length,
      errors: errors,
      warnings: warnings,
      profiles: id
        ? [
            {
              id: id,
              enabled: !errors.length,
              valid: !errors.length,
              errors: [],
              disabledReasons: [],
              legacy: true,
              summary: {
                profileId: id,
                factionId: f && f.id,
                factionName: f && f.name,
                characterId: c.id,
                characterName: c.name,
                roleKind: role,
              },
            },
          ]
        : [],
    };
  }
  function resolveCharacter(world, ref) {
    var rows = Array.isArray(world && world.chars) ? world.chars : [],
      explicit = ref && typeof ref === 'object',
      id = explicit ? ref.characterId || ref.id : ref;
    var exact = rows.filter(function (c) {
      return c.id === id;
    });
    if (exact.length === 1) return exact[0];
    if (explicit && (ref.characterId || ref.id)) return null;
    var name = explicit ? ref.name : ref,
      matches = rows.filter(function (c) {
        return c.name === name;
      });
    if (!matches.length)
      matches = rows.filter(function (c) {
        return [].concat(c.aliases || [], c.formerNames || [], c._aliases || [], c.zi || []).indexOf(name) >= 0;
      });
    return matches.length === 1 ? matches[0] : null;
  }
  var api = {
    schemaVersion: SCHEMA,
    inspect: inspect,
    inspectLegacy: inspectLegacy,
    regionRows: regionRows,
    eventRows: eventRows,
    resolveCharacter: resolveCharacter,
    isAlive: alive,
    isId: idOK,
    mapRefErrors: mapRefErrors,
    clone: clone,
  };
  root.TM = root.TM || {};
  root.TM.StartContracts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
