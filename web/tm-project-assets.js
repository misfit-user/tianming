// Project persistence owner. Uses the editor's existing database/store and canonical project body.
// Blob preparation/readback precedes one IDB transaction for root + operation + journal.
(function (root) {
  'use strict';
  var DB = 'tm-scenario-editor-reset-projects',
    STORE = 'projectBodies',
    MAX = 96 * 1024 * 1024;
  var enc = new TextEncoder(),
    dec = new TextDecoder('utf-8', { fatal: true });
  function fail(code, message) {
    var e = new Error(message);
    e.code = code;
    throw e;
  }
  function id(v) {
    if (
      typeof v !== 'string' ||
      !v ||
      v.length > 160 ||
      !/^[-a-zA-Z0-9_:.]+$/.test(v) ||
      v.indexOf('..') >= 0 ||
      ['__proto__', 'prototype', 'constructor'].indexOf(v) >= 0 ||
      /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(v)
    )
      fail('project-id', '需要有效的项目内 ID，不能是文件路径');
    return v;
  }
  function uid(prefix) {
    return prefix + '-' + root.crypto.randomUUID();
  }
  function pure(v) {
    if (!root.TM || !root.TM.StartCompiler) fail('project-contract-missing', '缺少纯数据校验器');
    root.TM.StartCompiler.assertData(v);
    return v;
  }
  function clone(v) {
    return JSON.parse(JSON.stringify(pure(v)));
  }
  async function hash(bytes) {
    return root.TM.StartCompiler.sha256(bytes);
  }
  function bytes(value) {
    var b =
      typeof value === 'string'
        ? enc.encode(value)
        : value instanceof Uint8Array
          ? value
          : value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : null;
    if (!b || !b.length || b.length > MAX) fail('asset-size', '资产字节为空或超出 96 MiB 上限');
    return b.slice();
  }
  function check(options) {
    if (options && options.signal && options.signal.aborted) fail('project-cancelled', '任务已取消');
    if (options && options.guard && options.guard() !== true) fail('project-conflict', '案卷或加载实例已变化，未覆盖');
  }
  function open() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(new Error('本地 IndexedDB 不可用'));
      var r = root.indexedDB.open(DB, 1);
      r.onupgradeneeded = function () {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      r.onerror = function () {
        reject(r.error);
      };
      r.onblocked = function () {
        reject(new Error('案卷数据库被其他窗口占用'));
      };
      r.onsuccess = function () {
        r.result.onversionchange = function () {
          r.result.close();
        };
        resolve(r.result);
      };
    });
  }
  async function read(key) {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly'),
        r = tx.objectStore(STORE).get(key),
        value;
      r.onsuccess = function () {
        value = r.result || null;
      };
      tx.oncomplete = function () {
        db.close();
        resolve(value);
      };
      tx.onabort = tx.onerror = function () {
        db.close();
        reject(tx.error || r.error || new Error('读取案卷失败'));
      };
    });
  }
  async function scan(prefix) {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly'),
        out = [],
        r = tx.objectStore(STORE).openCursor(root.IDBKeyRange.bound(prefix, prefix + '\uffff'));
      r.onsuccess = function () {
        var c = r.result;
        if (c) {
          out.push(c.value);
          c.continue();
        }
      };
      tx.oncomplete = function () {
        db.close();
        resolve(out);
      };
      tx.onabort = tx.onerror = function () {
        db.close();
        reject(tx.error || new Error('读取项目索引失败'));
      };
    });
  }
  // No await in mutate: the CAS read and all pointer changes are in the same live IDB transaction.
  async function atomic(keys, mutate, options) {
    check(options);
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite'),
        st = tx.objectStore(STORE),
        values = {},
        pending = keys.length,
        result,
        exception;
      var onAbort = function () {
        exception = new Error('任务已取消，未提交案卷事务');
        exception.code = 'project-cancelled';
        try {
          tx.abort();
        } catch (_) {}
      };
      if (options && options.signal) options.signal.addEventListener('abort', onAbort, { once: true });
      tx.oncomplete = function () {
        if (options && options.signal) options.signal.removeEventListener('abort', onAbort);
        db.close();
        resolve(result);
      };
      tx.onabort = tx.onerror = function () {
        if (options && options.signal) options.signal.removeEventListener('abort', onAbort);
        db.close();
        reject(exception || tx.error || new Error('案卷事务未提交'));
      };
      function ready() {
        if (--pending) return;
        try {
          check(options);
          var decision = mutate(values);
          result = decision.result;
          (decision.put || []).forEach(function (v) {
            st.put(v);
          });
          (decision.remove || []).forEach(function (k) {
            st.delete(k);
          });
          if (options && options.fault === 'before-commit') fail('project-injected-abort', '注入事务中断');
        } catch (e) {
          exception = e;
          tx.abort();
        }
      }
      keys.forEach(function (k) {
        var r = st.get(k);
        r.onsuccess = function () {
          values[k] = r.result || null;
          ready();
        };
      });
    });
  }
  function assetKey(project, asset) {
    return 'wb:asset:' + id(project) + ':' + id(asset);
  }
  function opKey(project, operation) {
    return 'wb:op:' + id(project) + ':' + id(operation);
  }
  function rootMeta(snapshot) {
    return (snapshot && snapshot.workbenchRoot) || { schemaVersion: 1, revision: 0, worldHash: null, assets: [] };
  }
  function expect(snapshot, expected) {
    var m = rootMeta(snapshot);
    if (expected && (m.revision !== expected.revision || m.worldHash !== expected.worldHash))
      fail('project-conflict', '项目版本已变化，请重基或保留候选，不能覆盖');
    return m;
  }
  function operation(prior, fingerprint) {
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint) fail('operation-id-reused', '同一操作 ID 对应不同输入，拒绝重放');
    return Object.assign({}, prior.receipt, { replayed: true });
  }
  function receipt(tool, project, operationId, meta, extra) {
    return Object.assign(
      {
        tool: tool,
        operationId: operationId,
        projectId: project,
        inputRevision: meta.revision,
        inputSnapshotHash: meta.worldHash,
        status: 'ok',
        changedTargets: [],
        artifacts: [],
        diagnostics: [],
        unresolved: [],
        approvalRequired: false,
      },
      extra || {},
    );
  }
  async function prepareBlob(project, value, options) {
    id(project);
    check(options);
    var data = bytes(value),
      sha = await hash(data),
      key = 'wb:blob:' + sha,
      prepareId = 'wb:prepare:' + project + ':' + uid('blob');
    check(options);
    await atomic(
      [key],
      function (v) {
        if (v[key] && v[key].byteLength !== data.length) fail('blob-collision', '同摘要资产大小不符');
        return {
          put: (v[key] ? [] : [{ id: key, hash: sha, byteLength: data.length, bytes: data }]).concat([
            { id: prepareId, projectId: project, hash: sha, status: 'prepared', createdAt: new Date().toISOString() },
          ]),
          result: null,
        };
      },
      Object.assign({}, options, { fault: options && options.fault === 'blob-before-commit' ? 'before-commit' : null }),
    );
    if (options && options.fault === 'after-blob') fail('project-injected-prepare', '注入资产写后中断');
    var back = await read(key);
    if (!back || back.byteLength !== data.length || (await hash(back.bytes)) !== sha)
      fail('asset-readback', '资产写后回读摘要不符');
    check(options);
    return { hash: sha, byteLength: data.length, blobKey: key, prepareId: prepareId };
  }
  async function getProject(project) {
    id(project);
    var s = await read(project);
    if (!s || !s.scenario) fail('project-missing', '请先把当前案卷存入案卷库');
    return s;
  }
  async function saveProject(snapshot, options) {
    options = options || {};
    pure(snapshot);
    id(snapshot.id);
    if (!snapshot.scenario) fail('project-body', '案卷缺少剧本');
    var project = snapshot.id,
      op = options.operationId || uid('save'),
      key = opKey(project, op),
      input = clone(snapshot);
    delete input.workbenchRoot;
    var text = JSON.stringify(input.scenario),
      worldHash = await hash(enc.encode(text)),
      fingerprint = await hash(enc.encode(JSON.stringify({ snapshot: input, expected: options.expected || null }))),
      blob = await prepareBlob(project, text, options),
      taskKey = options.taskId ? 'wb:task:' + project + ':' + id(options.taskId) : null;
    return atomic(
      [project, key].concat(taskKey ? [taskKey] : []),
      function (v) {
        var replay = operation(v[key], fingerprint);
        if (replay) return { result: replay };
        if (taskKey) {
          var task = v[taskKey];
          if (
            !task ||
            task.generation !== options.taskGeneration ||
            ['cancelled', 'failed', 'completed'].indexOf(task.status) >= 0
          )
            fail('task-not-running', '取消、失败或换代的任务不能提交旧候选');
        }
        var meta = expect(v[project], options.expected),
          unchanged = meta.worldHash === worldHash && JSON.stringify(v[project] && v[project].scenario) === text;
        if (v[project] && meta.revision && options.expected == null)
          fail('project-expected-required', '已入库案卷写入必须带原版本');
        var next = Object.assign({}, input, {
          workbenchRoot: {
            schemaVersion: 1,
            revision: meta.revision + (unchanged ? 0 : 1),
            worldHash: worldHash,
            worldBlob: blob.hash,
            assets: meta.assets || [],
          },
        });
        var r = receipt('saveProject', project, op, meta, {
          status: unchanged ? 'no_change' : 'ok',
          outputRevision: next.workbenchRoot.revision,
          outputSnapshotHash: worldHash,
          changedTargets: unchanged ? [] : ['scenario'],
        });
        return {
          put: [
            next,
            { id: key, fingerprint: fingerprint, receipt: r },
            { id: blob.prepareId, projectId: project, hash: blob.hash, status: 'committed' },
          ],
          result: r,
        };
      },
      options,
    );
  }
  async function putAsset(project, value, meta, options) {
    options = options || {};
    id(project);
    meta = clone(meta || {});
    if (!meta.kind || !meta.mediaType) fail('asset-metadata', '资产须声明类型与媒体类型');
    var aid = options.assetId || uid('asset'),
      key = assetKey(project, aid),
      op = options.operationId || uid('asset-write'),
      okey = opKey(project, op),
      blob = await prepareBlob(project, value, options);
    if (!options.assetId) {
      aid = 'asset-' + (await hash(enc.encode(project + ':' + op))).slice(0, 32);
      key = assetKey(project, aid);
    }
    var fingerprint = await hash(
        enc.encode(JSON.stringify({ hash: blob.hash, meta: meta, assetId: aid, expected: options.expected || null })),
      ),
      taskKey = options.taskId ? 'wb:task:' + project + ':' + id(options.taskId) : null;
    return atomic(
      [project, key, okey].concat(taskKey ? [taskKey] : []),
      function (v) {
        var replay = operation(v[okey], fingerprint);
        if (replay) return { result: replay };
        if (!v[project] || !v[project].scenario) fail('project-missing', '项目未入库');
        var m = expect(v[project], options.expected);
        if (v[key]) fail('asset-immutable', '资产 ID 已存在，不覆盖原件');
        var task = taskKey && v[taskKey];
        if (taskKey && (!task || task.status !== 'running' || task.generation !== options.taskGeneration))
          fail('task-not-running', '任务已取消、暂停或换代，迟到结果未提交');
        if (task && task.used.artifactBytes + blob.byteLength > task.budget.artifactBytes)
          fail('task-budget', '制品预算不足，候选字节保留');
        var asset = Object.assign({}, meta, {
          id: key,
          assetId: aid,
          projectId: project,
          hash: blob.hash,
          byteLength: blob.byteLength,
          createdAt: new Date().toISOString(),
          inputRevision: m.revision,
          inputSnapshotHash: m.worldHash,
        });
        var r = receipt('putAsset', project, op, m, {
          changedTargets: ['assets:' + aid],
          artifacts: [{ assetId: aid, contentHash: blob.hash, byteLength: blob.byteLength, mediaType: meta.mediaType }],
        });
        var puts = [
          asset,
          { id: okey, fingerprint: fingerprint, receipt: r },
          { id: blob.prepareId, projectId: project, hash: blob.hash, status: 'committed' },
        ];
        if (task) {
          task.used.artifactBytes += blob.byteLength;
          task.artifacts.push(aid);
          puts.push(task);
        }
        return { put: puts, result: r };
      },
      options,
    );
  }
  async function getAsset(project, aid) {
    var a = await read(assetKey(project, aid));
    if (!a) fail('asset-missing', '本项目不存在该资产');
    var b = await read('wb:blob:' + a.hash);
    if (!b || b.byteLength !== a.byteLength || (await hash(b.bytes)) !== a.hash)
      fail('asset-readback', '资产原始字节缺失或损坏');
    return { meta: a, bytes: b.bytes };
  }
  async function listAssets(project) {
    await getProject(project);
    return scan('wb:asset:' + id(project) + ':');
  }
  async function journal(project) {
    await getProject(project);
    var records = await scan('wb:prepare:' + id(project) + ':');
    return {
      prepared: records.filter(function (r) {
        return r.status === 'prepared';
      }),
      committed: records.filter(function (r) {
        return r.status === 'committed';
      }).length,
      note: '未完成准备记录保留；不自动删除任何候选或已引用资产',
    };
  }
  async function createTask(project, options) {
    options = options || {};
    var s = await getProject(project),
      m = rootMeta(s),
      tid = uid('task'),
      budget = Object.assign(
        { calls: 0, inputBytes: MAX, artifactBytes: 128 * 1024 * 1024, concurrency: 1 },
        options.budget || {},
      );
    Object.keys(budget).forEach(function (k) {
      if (
        ['calls', 'inputBytes', 'artifactBytes', 'concurrency'].indexOf(k) < 0 ||
        !Number.isSafeInteger(budget[k]) ||
        budget[k] < 0
      )
        fail('task-budget', '预算无效');
    });
    if (
      budget.concurrency !== 1 ||
      budget.calls > 100 ||
      budget.inputBytes > MAX ||
      budget.artifactBytes > 512 * 1024 * 1024
    )
      fail('task-budget', '任务预算超出实现上限');
    var regionScope = options.allowedRegionIds == null ? null : clone(options.allowedRegionIds);
    if (
      regionScope !== null &&
      (!Array.isArray(regionScope) ||
        regionScope.length > 20000 ||
        regionScope.some(function (r) {
          return typeof r !== 'string' || !r || r.length > 256;
        }))
    )
      fail('task-scope', '地块范围必须是明确的 ID 数组');
    if (regionScope) regionScope = Array.from(new Set(regionScope));
    var t = {
      id: 'wb:task:' + project + ':' + tid,
      taskId: tid,
      projectId: project,
      sourceRevision: m.revision,
      sourceHash: m.worldHash,
      status: 'queued',
      generation: 0,
      budget: budget,
      allowedRegionIds: regionScope,
      used: { calls: 0, inputBytes: 0, artifactBytes: 0 },
      artifacts: [],
      steps: [],
      request: String(options.request || '').slice(0, 4000),
      createdAt: new Date().toISOString(),
    };
    await atomic(
      [project, t.id],
      function (v) {
        expect(v[project], m);
        return { put: [t], result: null };
      },
      options,
    );
    return t;
  }
  async function taskChange(project, tid, action, options) {
    options = options || {};
    var key = 'wb:task:' + id(project) + ':' + id(tid);
    return atomic(
      [project, key],
      function (v) {
        var t = v[key];
        if (!t) fail('task-missing', '项目内没有此任务');
        if (options.taskGeneration != null && t.generation !== options.taskGeneration)
          fail('task-generation-changed', '任务已有新租约，旧运行不能改状态');
        var m = rootMeta(v[project]);
        if (action === 'resume') {
          if (!options.authorized) fail('task-approval', '重新加载后须由玩家明确恢复');
          if (t.sourceRevision !== m.revision || t.sourceHash !== m.worldHash)
            fail('task-rebase-required', '案卷已变化，需要明确重基，未覆盖');
          if (['cancelled', 'completed', 'failed'].indexOf(t.status) >= 0) fail('task-terminal', '终态任务不能重放');
          t.status = 'running';
          t.generation++;
        } else if (action === 'cancel') {
          if (t.status !== 'completed') t.status = 'cancelled';
          t.generation++;
        } else if (['paused', 'partial', 'blocked', 'completed', 'failed', 'awaitingApproval'].indexOf(action) >= 0) {
          if (
            t.status !== 'running' &&
            !(action === 'completed' && t.status === 'awaitingApproval' && options.userApproved === true)
          )
            fail('task-not-running', '任务不在运行中');
          t.status = action;
          t.generation++;
        } else fail('task-action', '不支持的任务操作');
        t.updatedAt = new Date().toISOString();
        return { put: [t], result: t };
      },
      options,
    );
  }
  async function reserveCall(project, tid, operationId, inputBytes, options) {
    options = options || {};
    var key = 'wb:task:' + id(project) + ':' + id(tid),
      ck = 'wb:call:' + project + ':' + id(operationId);
    return atomic(
      [key, ck, project],
      function (v) {
        var t = v[key];
        if (v[ck]) fail('call-already-dispatched', '此调用已登记；未知外部结果不可自动重放');
        if (!t || t.status !== 'running' || t.generation !== options.taskGeneration)
          fail('task-not-running', '任务已停止');
        expect(v[project], { revision: t.sourceRevision, worldHash: t.sourceHash });
        if (
          !Number.isSafeInteger(inputBytes) ||
          inputBytes < 0 ||
          t.used.calls >= t.budget.calls ||
          t.used.inputBytes + inputBytes > t.budget.inputBytes
        )
          fail('task-budget', '调用或输入预算已用尽');
        t.used.calls++;
        t.used.inputBytes += inputBytes;
        var record = {
          id: ck,
          taskId: tid,
          operationId: operationId,
          status: 'reserved-result-unknown',
          inputBytes: inputBytes,
        };
        return { put: [t, record], result: record };
      },
      options,
    );
  }
  async function listTasks(project) {
    await getProject(project);
    return scan('wb:task:' + id(project) + ':');
  }
  async function getTask(project, tid) {
    var t = await read('wb:task:' + id(project) + ':' + id(tid));
    if (!t) fail('task-missing', '本案卷没有该任务');
    return t;
  }
  async function checkpoint(project, tid, generation, value, options) {
    options = options || {};
    pure(value);
    var key = 'wb:task:' + id(project) + ':' + id(tid),
      prior = await read(key),
      draftText = JSON.stringify(value.draft),
      draftHash = await hash(enc.encode(draftText));
    if (!prior || prior.status !== 'running' || prior.generation !== generation)
      fail('task-not-running', '任务已经停止，未保存新检查点');
    var draftAssetId = prior.draftHash === draftHash ? prior.draftAssetId : null;
    if (!draftAssetId) {
      var draftReceipt = await putAsset(
        project,
        draftText,
        { kind: 'task-draft', mediaType: 'application/json' },
        Object.assign({}, options, { taskId: tid, taskGeneration: generation }),
      );
      draftAssetId = draftReceipt.artifacts[0].assetId;
    }
    var state = Object.assign({}, value, { draftAssetId: draftAssetId, draftHash: draftHash });
    delete state.draft;
    var saved = await putAsset(
      project,
      JSON.stringify(state),
      { kind: 'task-checkpoint', mediaType: 'application/json' },
      Object.assign({}, options, { taskId: tid, taskGeneration: generation }),
    );
    return atomic(
      [key],
      function (v) {
        var t = v[key];
        if (!t || t.status !== 'running' || t.generation !== generation)
          fail('task-not-running', '取消后的检查点不能成为恢复指针');
        t.lastCheckpoint = saved.artifacts[0].assetId;
        t.draftHash = draftHash;
        t.draftAssetId = draftAssetId;
        t.steps.push({ checkpoint: t.lastCheckpoint, at: new Date().toISOString(), receipts: value.receipts || [] });
        t.steps = t.steps.slice(-40);
        return { put: [t], result: t };
      },
      options,
    );
  }
  root.TM = root.TM || {};
  root.TM.ProjectAssets = {
    open: open,
    id: id,
    uid: uid,
    clone: clone,
    hash: hash,
    bytes: bytes,
    decode: function (b) {
      return dec.decode(b);
    },
    maxBytes: MAX,
    read: read,
    atomic: atomic,
    getProject: getProject,
    saveProject: saveProject,
    rootMeta: rootMeta,
    putAsset: putAsset,
    getAsset: getAsset,
    listAssets: listAssets,
    journal: journal,
    createTask: createTask,
    taskChange: taskChange,
    reserveCall: reserveCall,
    listTasks: listTasks,
  };
  root.TM.ProjectAssets.checkpoint = checkpoint;
  root.TM.ProjectAssets.getTask = getTask;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.ProjectAssets;
})(typeof window !== 'undefined' ? window : globalThis);
