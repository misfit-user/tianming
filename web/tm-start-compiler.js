// @ts-check
// 锁定源 -> 验证一个选择 -> detached 候选。此模块没有 live 世界/存储/网络写口。
(function (root) {
  'use strict';
  var C = root.TM && root.TM.StartContracts;
  if (!C && typeof module !== 'undefined' && module.exports) C = require('./tm-start-contracts.js');
  var sources = new WeakMap(),
    MAX_BYTES = 96 * 1024 * 1024;
  function failure(code, message, diagnostics) {
    var e = new Error(message);
    e.code = code;
    e.diagnostics = diagnostics || [];
    return e;
  }
  function checkSignal(signal) {
    if (signal && signal.aborted) throw failure('start-cancelled', '本次开局已取消');
  }
  function bounded(operation, signal, timeoutMs) {
    checkSignal(signal);
    return new Promise(function (resolve, reject) {
      var finished = false,
        timer;
      function done(error, value) {
        if (finished) return;
        finished = true;
        root.clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else resolve(value);
      }
      function onAbort() {
        done(failure('start-cancelled', '本次开局已取消'));
      }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      timer = root.setTimeout(function () {
        done(failure('start-prepare-timeout', '准备步骤超过本地时限，未启动'));
      }, timeoutMs);
      Promise.resolve()
        .then(function () {
          if (!finished) return operation();
        })
        .then(
          function (value) {
            done(null, value);
          },
          function (error) {
            done(error);
          },
        );
    });
  }
  // 拒绝 JSON 不能如实表达的数据以及有副作用的 getter/toJSON。不要把作者字段当代码执行。
  function assertData(value) {
    var ancestors = new Set(),
      nodes = 0,
      stringUnits = 0;
    function walk(v, depth) {
      if (++nodes > 3000000 || depth > 128) throw failure('source-complexity', '源数据超过本地准备器的结构预算');
      if (typeof v === 'string') {
        stringUnits += v.length;
        if (stringUnits > MAX_BYTES) throw failure('source-size', '源文本超过准备预算');
        return;
      }
      if (v === null || typeof v === 'boolean') return;
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) throw failure('source-number', '源数据包含非有限数');
        return;
      }
      if (typeof v !== 'object') throw failure('source-json', '源数据必须是纯 JSON');
      if (ancestors.has(v)) throw failure('source-cycle', '源数据存在循环引用');
      var proto = Object.getPrototypeOf(v);
      if (Array.isArray(v) ? proto !== Array.prototype : proto !== null && proto !== Object.prototype)
        throw failure('source-object', '源数据包含非普通对象；跨上下文输入须先经结构化导入');
      if (Object.getOwnPropertySymbols(v).length) throw failure('source-symbol', '源数据包含不能保存的 Symbol 字段');
      ancestors.add(v);
      Object.getOwnPropertyNames(v).forEach(function (key) {
        if (Array.isArray(v) && key === 'length') return;
        if (['__proto__', 'prototype', 'constructor', 'toJSON'].indexOf(key) >= 0)
          throw failure('source-key', '源数据包含保留字段：' + key);
        var d = Object.getOwnPropertyDescriptor(v, key);
        if (!d || !d.enumerable || d.get || d.set) throw failure('source-accessor', '源数据包含不可直接保存的属性');
        if (Array.isArray(v) && !/^(0|[1-9][0-9]*)$/.test(key))
          throw failure('source-array-property', '数组包含额外属性');
        walk(d.value, depth + 1);
      });
      if (Array.isArray(v) && Object.keys(v).length !== v.length) throw failure('source-array-hole', '数组存在空槽');
      ancestors.delete(v);
    }
    walk(value, 0);
  }
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) {
        freeze(value[k]);
      });
      Object.freeze(value);
    }
    return value;
  }
  function bytesOf(text) {
    if (!root.TextEncoder) throw failure('encoding-unavailable', '当前环境缺少安全文本编码能力');
    return new root.TextEncoder().encode(text);
  }
  async function sha256(bytes) {
    if (!root.crypto || !root.crypto.subtle)
      throw failure('hash-unavailable', '当前环境无法验证 SHA-256；不能伪报源已锁定');
    var buffer = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buffer))
      .map(function (b) {
        return b.toString(16).padStart(2, '0');
      })
      .join('');
  }
  async function createSource(scenario, options) {
    options = options || {};
    checkSignal(options.signal);
    assertData(scenario);
    var json = JSON.stringify(scenario),
      bytes = bytesOf(json);
    var maxBytes = options.maxBytes == null ? MAX_BYTES : options.maxBytes;
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_BYTES)
      throw failure('source-budget', '源预算须为不超过 96 MiB 的正整数');
    if (bytes.byteLength > maxBytes) throw failure('source-size', '源剧本超过当前准备预算，未克隆世界');
    // catalog 只含摘要；预览切换不解析/克隆整个 json，也不引用作者的可变数组。
    var capabilities = Array.isArray(options.capabilities) ? options.capabilities.slice() : [];
    var catalog = freeze(C.clone(C.inspect(scenario, { capabilities: capabilities })));
    var hash = await bounded(
      function () {
        return sha256(bytes);
      },
      options.signal,
      30000,
    );
    checkSignal(options.signal);
    var handle = Object.freeze({
      schemaVersion: 'tm-start-source/1',
      sourceScenarioId: catalog.sourceScenarioId,
      hash: hash,
      algorithm: 'sha256-json-v1',
      byteLength: bytes.byteLength,
      catalog: catalog,
    });
    sources.set(handle, { json: json, compiling: false, compiled: false, disposed: false, cloneCount: 0 });
    return handle;
  }
  function sourceState(handle) {
    var state = sources.get(handle);
    if (!state || state.disposed) throw failure('source-expired', '源快照不存在或已取消，请重新打开选择');
    return state;
  }
  function cancel(handle) {
    var state = sources.get(handle);
    if (!state) return false;
    state.disposed = true;
    state.json = '';
    if (state.controller) state.controller.abort();
    sources.delete(handle);
    return true;
  }
  function previews(handle, query) {
    sourceState(handle);
    var q = String(query || '')
      .trim()
      .toLocaleLowerCase();
    return handle.catalog.profiles.filter(function (p) {
      var s = p.summary || {};
      return (
        !q ||
        [p.id, s.factionId, s.factionName, s.characterId, s.characterName]
          .concat(s.aliases || [])
          .join('\n')
          .toLocaleLowerCase()
          .indexOf(q) >= 0
      );
    });
  }
  function stats(handle) {
    var state = sourceState(handle);
    return { cloneCount: state.cloneCount, compiling: state.compiling, compiled: state.compiled };
  }
  async function verifyMap(ref, resolver, signal) {
    if (typeof resolver !== 'function')
      throw failure('map-asset-unavailable', '没有可读取的锁定地图资产；不能静默改用最新版');
    checkSignal(signal);
    var data = await resolver(Object.freeze(C.clone(ref)), signal);
    checkSignal(signal);
    if (!ArrayBuffer.isView(data) && Object.prototype.toString.call(data) !== '[object ArrayBuffer]')
      throw failure('map-asset-bytes', '地图服务必须返回真实字节');
    var view = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    if (view.byteLength !== ref.byteLength || view.byteLength > MAX_BYTES)
      throw failure('map-asset-size', '地图资产字节数不符或超过预算');
    // 只用自己持有的字节；异步散列期间上游改 buffer 不得替换验收对象。
    var bytes = view.slice(),
      hash = await sha256(bytes);
    checkSignal(signal);
    if (hash !== ref.contentHash) throw failure('map-asset-hash', '地图资产摘要不符，未启动');
    var body;
    try {
      body = JSON.parse(new root.TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (_) {
      throw failure('map-asset-json', '地图资产不是有效 UTF-8 JSON');
    }
    assertData(body);
    if (
      body.id !== ref.mapId ||
      body.version !== ref.mapVersion ||
      body.schemaVersion !== ref.schemaVersion ||
      body.coordinateSystemId !== ref.coordinateSystemId
    ) {
      throw failure('map-asset-contract', '地图资产 ID、版本、schema 或坐标系不符');
    }
    var ids = Object.create(null),
      rows = Array.isArray(body.cells) ? body.cells : body.regions;
    if (!Array.isArray(rows) || !rows.length) throw failure('map-asset-regions', '地图资产没有逻辑地块');
    rows.forEach(function (r) {
      if (!r || !C.isId(r.id) || Object.prototype.hasOwnProperty.call(ids, r.id))
        throw failure('map-asset-region-id', '地图逻辑地块 ID 缺失或重复');
      ids[r.id] = true;
    });
    var geometry;
    if (root.TM && root.TM.MapWorkbenchClient)
      geometry = await root.TM.MapWorkbenchClient.run('inspect', { map: body, options: {} }, { signal: signal });
    else if (root.TM && root.TM.MapWorkbench)
      geometry = root.TM.MapWorkbench.inspect(body); // standalone pure-module/unit host; production loads the worker client
    else if (typeof module !== 'undefined' && module.exports) geometry = require('./tm-map-workbench.js').inspect(body);
    else throw failure('geometry-capability-missing', '当前环境缺少几何核验能力，未启动');
    checkSignal(signal);
    if (!geometry || !geometry.complete || !geometry.ok)
      throw failure('map-geometry-invalid', '地图几何未通过完整校验，未启动', (geometry && geometry.diagnostics) || []);
    return {
      ref: C.clone(ref),
      ids: ids,
      asset: body,
      assetText: new root.TextDecoder().decode(bytes),
      verified: true,
      geometryValidated: true,
      geometryWitness: {
        engine: 'tm-map-workbench/1',
        regions: geometry.regions,
        components: geometry.components,
        holes: geometry.holes.length,
        parameters: geometry.parameters,
      },
    };
  }
  function playerInfo(c, f, p) {
    var out = {
      characterId: c.id,
      characterName: c.name,
      factionId: f.id,
      factionName: f.name,
      characterFaction: f.name,
      playerRole: p.roleKind,
      leaderIsPlayer: p.roleKind === 'headOfState',
    };
    [
      ['title', 'characterTitle'],
      ['age', 'characterAge'],
      ['gender', 'characterGender'],
      ['personality', 'characterPersonality'],
      ['faith', 'characterFaith'],
      ['culture', 'characterCulture'],
      ['bio', 'characterBio'],
      ['desc', 'characterDesc'],
      ['appearance', 'characterAppearance'],
    ].forEach(function (pair) {
      if (Object.prototype.hasOwnProperty.call(c, pair[0])) out[pair[1]] = C.clone(c[pair[0]]);
    });
    [
      ['type', 'factionType'],
      ['desc', 'factionDesc'],
      ['culture', 'factionCulture'],
      ['goal', 'factionGoal'],
    ].forEach(function (pair) {
      if (Object.prototype.hasOwnProperty.call(f, pair[0])) out[pair[1]] = C.clone(f[pair[0]]);
    });
    return out;
  }
  async function compile(handle, profileId, options) {
    options = options || {};
    checkSignal(options.signal);
    var state = sourceState(handle);
    if (state.compiling || state.compiled) throw failure('start-reentry', '同一源快照只准备一个候选；不得重复确认');
    if (!C.isId(options.sessionId)) throw failure('session-id', '需要本次开局的会话标识');
    var stepTimeout = options.timeoutMs == null ? 30000 : options.timeoutMs;
    if (!Number.isSafeInteger(stepTimeout) || stepTimeout < 1 || stepTimeout > 30000)
      throw failure('prepare-timeout-budget', '准备时限须为不超过 30 秒的正整数');
    if (handle.catalog.mode !== 'native')
      throw failure('legacy-entry', '旧单主角剧本继续使用原入口，不重新激活 profile');
    var selected = handle.catalog.profiles.find(function (p) {
      return p.id === profileId;
    });
    if (!selected || !selected.enabled || handle.catalog.errors.length)
      throw failure(
        'profile-disabled',
        '所选开局不可用',
        handle.catalog.errors.concat(selected ? selected.errors : []),
      );
    if (typeof root.AbortController !== 'function')
      throw failure('cancellation-unavailable', '当前环境不能安全取消准备任务');
    var controller = new root.AbortController(),
      signal = controller.signal;
    var forwardAbort = function () {
      controller.abort();
    };
    if (options.signal) options.signal.addEventListener('abort', forwardAbort, { once: true });
    state.controller = controller;
    state.compiling = true;
    try {
      // 单一候选深拷贝；后续视图均引用这里的同一对象，而非再复制世界集合。
      var candidate = JSON.parse(state.json);
      state.cloneCount++;
      var n = candidate.nativeStart,
        p = n.profiles.find(function (x) {
          return x.id === profileId;
        });
      var proof = await bounded(
        function () {
          return verifyMap(n.mapRef, options.resolveMapAsset, signal);
        },
        signal,
        stepTimeout,
      );
      sourceState(handle);
      checkSignal(signal);
      var regionIds = C.regionRows(candidate).map(function (r) {
        return r.id;
      });
      if (
        regionIds.length !== Object.keys(proof.ids).length ||
        regionIds.some(function (id) {
          return !proof.ids[id];
        })
      )
        throw failure('map-binding-coverage', '年代绑定须逐一对应同版本逻辑地块');
      var character = candidate.characters.find(function (c) {
        return c.id === p.playerCharacterId;
      });
      var faction = candidate.factions.find(function (f) {
        return f.id === p.factionId;
      });
      var rules = n.rulesets.find(function (r) {
        return r.id === p.rulesetRef;
      });
      var scope = n.contentScopes.find(function (r) {
        return r.id === p.contentScopeRef;
      });
      var authority = n.authorities.find(function (r) {
        return r.id === p.authorityRef;
      });
      var rulesetHash = await bounded(
        function () {
          return sha256(bytesOf(JSON.stringify(rules)));
        },
        signal,
        stepTimeout,
      );
      sourceState(handle);
      checkSignal(signal);
      candidate.characters.forEach(function (c) {
        c.isPlayer = c === character;
      });
      candidate.factions.forEach(function (f) {
        f.isPlayer = f === faction;
      });
      candidate.playerInfo = playerInfo(character, faction, p);
      candidate.opening = selected.summary.openingText;
      var context = {
        schemaVersion: 'tm-start-context/1',
        sessionId: options.sessionId,
        sourceScenarioId: candidate.id,
        sourceScenarioVersion: String(candidate.version || ''),
        sourceScenarioHash: handle.hash,
        sourceHashAlgorithm: handle.algorithm,
        startProfileId: p.id,
        playerCharacterId: character.id,
        playerFactionId: faction.id,
        startRegionId: p.startRegionId,
        roleKind: p.roleKind,
        authorityRef: p.authorityRef,
        mapRef: C.clone(n.mapRef),
        rulesetRef: rules.id,
        rulesetVersion: rules.version,
        rulesetHash: rulesetHash,
      };
      candidate.startContext = context;
      // worldRegistry 是候选所有权图的索引，不是第二份运行态；提交适配器须维持同一引用。
      var worldRegistry = {
        characters: candidate.characters,
        factions: candidate.factions,
        classes: candidate.classes || [],
        parties: candidate.parties || [],
        events: C.eventRows(candidate),
        armies: (candidate.military && candidate.military.initialTroops) || [],
        officeTree: candidate.officeTree || [],
        officeRegistryByFaction: candidate.officeRegistryByFaction || {},
        accounts: n.accounts,
      };
      var playerView = {
        classes: worldRegistry.classes.filter(function (r) {
          return scope.classIds.indexOf(r.id) >= 0;
        }),
        parties: worldRegistry.parties.filter(function (r) {
          return scope.partyIds.indexOf(r.id) >= 0;
        }),
        accounts: worldRegistry.accounts.filter(function (r) {
          return scope.accountIds.indexOf(r.id) >= 0;
        }),
        openingEvents: worldRegistry.events.filter(function (r) {
          return scope.openingEventIds.indexOf(r.id) >= 0;
        }),
      };
      state.compiled = true;
      state.json = ''; // 一个候选已移交后无需保留第二份大源正文；轻量目录/指纹继续可用。
      return {
        schemaVersion: 'tm-start-candidate/1',
        status: 'prepared-not-started',
        scenario: candidate,
        startContext: context,
        character: character,
        faction: faction,
        authority: authority,
        ruleset: rules,
        scope: scope,
        worldRegistry: worldRegistry,
        playerView: playerView,
        summary: C.clone(selected.summary),
        mapProof: proof,
        diagnostics: [
          { code: 'runtime-commit-required', message: '仅已准备候选；尚未切换世界、存档或运行时订阅' },
          { code: 'geometry-validated', message: '已核对地图字节、逻辑地块覆盖和完整几何；原生渲染仍须独立验收' },
        ],
      };
    } catch (error) {
      controller.abort();
      throw error;
    } finally {
      state.compiling = false;
      state.controller = null;
      if (options.signal) options.signal.removeEventListener('abort', forwardAbort);
    }
  }
  var api = {
    createSource: createSource,
    previews: previews,
    compile: compile,
    cancel: cancel,
    stats: stats,
    assertData: assertData,
    sha256: sha256,
    maxBytes: MAX_BYTES,
  };
  root.TM = root.TM || {};
  root.TM.StartCompiler = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
