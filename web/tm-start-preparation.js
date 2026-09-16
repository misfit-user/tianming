// Detached native initialization only. This service has no live-world or save commit API.
(function (root) {
  'use strict';
  if (root.TM && root.TM.StartPreparation) return; // Duplicate classic-script loading must not orphan an active job.
  var document = root.document,
    moduleURL = document && document.currentScript && document.currentScript.src;
  var base = moduleURL ? new URL('.', moduleURL) : null,
    active = null;
  function dependencies() {
    var tm = root.TM || {};
    if (
      !base ||
      !document ||
      !tm.StartCompiler ||
      !tm.StartPreparationDocument ||
      !root.crypto ||
      !root.crypto.subtle ||
      !root.crypto.getRandomValues ||
      !root.MessageChannel ||
      !root.AbortController
    ) {
      var e = new Error('当前环境缺少安全原生准备能力');
      e.code = 'native-preparation-unavailable';
      throw e;
    }
    return { compiler: tm.StartCompiler, doc: tm.StartPreparationDocument };
  }
  function random() {
    return Array.from(root.crypto.getRandomValues(new Uint8Array(24)))
      .map(function (n) {
        return n.toString(16).padStart(2, '0');
      })
      .join('');
  }
  function cancel() {
    if (!active) return false;
    active.controller.abort();
    return true;
  }
  function status() {
    return active ? { phase: active.phase, requestId: active.requestId } : { phase: 'idle' };
  }
  function prepare(scenario, options) {
    options = options || {};
    var deps, compiler, doc, source, bytes, expected, timeout;
    try {
      deps = dependencies();
      compiler = deps.compiler;
      doc = deps.doc;
      if (active) throw doc.error('native-preparation-busy', '已有准备任务；请先取消，不得重复确认');
      if (options.signal && options.signal.aborted) throw doc.error('start-cancelled', '本次开局已取消');
      timeout = options.timeoutMs == null ? 30000 : options.timeoutMs;
      if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000)
        throw doc.error('native-preparation-budget', '准备时限须为不超过 60 秒的正整数');
      compiler.assertData(scenario);
      compiler.assertData(options.expectedIdentity);
      if (options.sandbox) {
        compiler.assertData(options.sandbox);
        var sb = options.sandbox;
        if (
          !Number.isInteger(sb.fiscalPeriods) ||
          sb.fiscalPeriods < 0 ||
          sb.fiscalPeriods > 3 ||
          typeof sb.preview !== 'boolean' ||
          !Number.isInteger(sb.width) ||
          !Number.isInteger(sb.height) ||
          sb.width < 320 ||
          sb.width > 2048 ||
          sb.height < 240 ||
          sb.height > 1536
        )
          throw doc.error('native-sandbox-budget', '隔离测试参数超出实现预算');
      }
      expected = Object.freeze(JSON.parse(JSON.stringify(options.expectedIdentity)));
      if (
        !expected ||
        typeof expected.characterId !== 'string' ||
        !expected.characterId ||
        expected.scenarioId !== scenario.id ||
        !Array.isArray(scenario.characters) ||
        !scenario.characters.some(function (c) {
          return c.id === expected.characterId;
        })
      )
        throw doc.error('native-preparation-identity', '准备身份必须对应锁定源中的确切人物 ID');
      source = JSON.stringify(scenario);
      bytes = new root.TextEncoder().encode(source);
      source = '';
      if (bytes.byteLength > compiler.maxBytes) throw doc.error('source-size', '源剧本超过原生准备预算');
    } catch (error) {
      return Promise.reject(error);
    }
    var job = { controller: new root.AbortController(), requestId: random(), phase: 'resources' };
    active = job;
    return new Promise(function (resolve, reject) {
      var signal = job.controller.signal,
        finished = false,
        frame,
        port,
        port2,
        timer,
        onMessage,
        observer,
        connected = false,
        receiving = false;
      var sourceHash,
        cfg,
        frameLoaded = false;
      function finish(error, value) {
        if (finished) return;
        finished = true;
        root.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        if (options.signal) options.signal.removeEventListener('abort', externalAbort);
        if (onMessage) root.removeEventListener('message', onMessage);
        if (observer) observer.disconnect();
        if (port) {
          port.onmessage = null;
          port.onmessageerror = null;
          port.close();
        }
        if (port2) port2.close();
        if (frame) {
          frame.onload = null;
          frame.onerror = null;
          frame.remove();
        }
        bytes = null;
        source = null;
        if (active === job) active = null;
        job.controller.abort(); // Cancel in-flight reads even after a non-abort failure.
        if (error) reject(error);
        else resolve(value);
      }
      function live() {
        if (finished || signal.aborted || active !== job) throw doc.error('start-cancelled', '本次开局已取消');
      }
      function externalAbort() {
        job.controller.abort();
      }
      function onAbort() {
        finish(doc.error('start-cancelled', '本次开局已取消'));
      }
      function progress(phase, values) {
        live();
        job.phase = phase;
        if (typeof options.onProgress === 'function') {
          try {
            options.onProgress(Object.freeze(Object.assign({ phase: phase, requestId: job.requestId }, values)));
          } catch (_) {
            /* Observers do not own this operation. */
          }
        }
        live();
      }
      signal.addEventListener('abort', onAbort, { once: true });
      if (options.signal) options.signal.addEventListener('abort', externalAbort, { once: true });
      timer = root.setTimeout(function () {
        finish(doc.error('start-prepare-timeout', '原生准备超时，当前游戏未改动'));
      }, timeout);
      async function read(ref, limit) {
        live();
        var url = new URL(ref, base);
        if (
          url.origin !== base.origin ||
          !url.pathname.startsWith(base.pathname) ||
          url.username ||
          url.password ||
          url.hash
        )
          throw doc.error('runtime-resource-path', '资源离开固定应用目录');
        var response = await root.fetch(url.href, {
          method: 'GET',
          credentials: 'omit',
          redirect: 'error',
          mode: 'same-origin',
          cache: 'no-cache',
          signal: signal,
        });
        live();
        if (
          !response.ok ||
          response.status === 206 ||
          response.redirected ||
          !response.body ||
          !response.body.getReader
        )
          throw doc.error('runtime-resource-read', '无法读取完整原生资源：' + ref);
        var declared = response.headers.get('content-length');
        if (declared && Number(declared) > limit) throw doc.error('runtime-resource-size', '原生资源声明长度超出预算');
        var reader = response.body.getReader(),
          chunks = [],
          size = 0;
        function abortReader() {
          Promise.resolve(reader.cancel()).catch(function () {});
        }
        signal.addEventListener('abort', abortReader, { once: true });
        try {
          while (true) {
            var next = await reader.read();
            live();
            if (next.done) break;
            if (!(next.value instanceof Uint8Array))
              throw doc.error('runtime-resource-bytes', '原生资源返回非字节内容');
            size += next.value.byteLength;
            if (size > limit) throw doc.error('runtime-resource-size', '原生资源实际长度超出预算');
            chunks.push(next.value);
          }
          var result = new Uint8Array(size),
            offset = 0;
          chunks.forEach(function (chunk) {
            result.set(chunk, offset);
            offset += chunk.byteLength;
          });
          return result;
        } finally {
          signal.removeEventListener('abort', abortReader);
          abortReader();
          try {
            reader.releaseLock();
          } catch (_) {}
        }
      }
      async function verifiedText(row) {
        var content = row.file ? await read(row.request, row.byteLength) : new root.TextEncoder().encode(row.text);
        live();
        if (content.byteLength !== row.byteLength || (await compiler.sha256(content)) !== row.sha256)
          throw doc.error('runtime-resource-hash', '原生资源版本不符：' + (row.file || 'inline'));
        live();
        return new root.TextDecoder('utf-8', { fatal: true }).decode(content);
      }
      function matches(data) {
        return (
          data && data.requestId === cfg.requestId && data.token === cfg.token && data.runtimeHash === cfg.runtimeHash
        );
      }
      async function receive(event) {
        var data = event.data;
        if (finished || receiving || !matches(data)) return;
        try {
          live();
          if (data.type === 'progress' && data.stage === 'initializing') {
            progress('initializing');
            return;
          }
          if (data.type === 'failed')
            throw doc.error('native-initialization-failed', String(data.message || '原生初始化失败').slice(0, 512));
          if (data.type !== 'prepared') return;
          receiving = true;
          progress('verifying');
          if (
            !(data.bytes instanceof ArrayBuffer) ||
            data.bytes.byteLength < 2 ||
            data.bytes.byteLength > 192 * 1024 * 1024 ||
            data.sourceHash !== sourceHash ||
            data.hashAuthority !== 'parent-webcrypto-readback'
          )
            throw doc.error('native-result-contract', '原生准备回包不属于本次源或超出预算');
          var output = new Uint8Array(data.bytes),
            hash = await compiler.sha256(output);
          live();
          var snapshotText = new root.TextDecoder('utf-8', { fatal: true }).decode(output);
          // Read back real serialized identity. No promotion to committed state occurs here.
          var snapshot = JSON.parse(snapshotText);
          if (
            !snapshot.GM ||
            !snapshot.P ||
            !snapshot.GM.running ||
            snapshot.GM.sid !== expected.scenarioId ||
            snapshot.GM.playerCharacterId !== expected.characterId ||
            (snapshot.P.ai && snapshot.P.ai.key)
          )
            throw doc.error('native-result-identity', '原生快照身份校验不符');
          live();
          var preview = null;
          if (options.sandbox && options.sandbox.preview) {
            if (
              !data.preview ||
              typeof data.preview.dataUrl !== 'string' ||
              data.preview.dataUrl.length > 16 * 1024 * 1024 ||
              !/^data:image\/png;base64,/.test(data.preview.dataUrl)
            )
              throw doc.error('native-preview-missing', '原生地图未返回真实 PNG');
            var raw = root.atob(data.preview.dataUrl.split(',')[1]),
              pb = Uint8Array.from(raw, function (c) {
                return c.charCodeAt(0);
              });
            if (pb[0] !== 137 || pb[1] !== 80 || pb[2] !== 78 || pb[3] !== 71)
              throw doc.error('native-preview-invalid', '预览不是 PNG');
            preview = Object.assign({}, data.preview, {
              contentHash: await compiler.sha256(pb),
              byteLength: pb.length,
            });
          }
          finish(null, {
            schemaVersion: 'tm-native-preparation/1',
            status: 'initialized-not-committed',
            requestId: cfg.requestId,
            sourceHash: sourceHash,
            runtimeHash: cfg.runtimeHash,
            snapshotHash: hash,
            hashAuthority: 'parent-webcrypto-readback',
            byteLength: output.byteLength,
            snapshotText: snapshotText,
            identity: expected,
            observation: data.observation,
            preview: preview,
            diagnostics: [
              { code: 'native-commit-required', message: '隔离初始化通过；未切换当前世界、订阅或存档' },
              {
                code: 'consumer-validation-required',
                message: '身份以外的规则、作用域和几何仍需完整验收，不能仅凭此快照启动新契约剧本',
              },
            ],
          });
        } catch (error) {
          finish(error);
        }
      }
      async function run() {
        sourceHash = await compiler.sha256(bytes);
        live();
        progress('resources', { completed: 0 });
        var manifestBytes = await read('tm-start-runtime-manifest.json', 4 * 1024 * 1024);
        var manifest = JSON.parse(new root.TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
        var inputs = await doc.validate(manifest, compiler);
        live();
        var indexBytes = await read('index.html', 2 * 1024 * 1024);
        if ((await compiler.sha256(indexBytes)) !== manifest.indexHash)
          throw doc.error('runtime-index-hash', '原生入口与准备清单不是同一版本');
        var texts = new Map(),
          position = 0,
          completed = 0;
        async function worker() {
          while (position < inputs.length) {
            live();
            var row = inputs[position++];
            texts.set(row.file, await verifiedText(row));
            progress('resources', { completed: ++completed, total: inputs.length });
          }
        }
        await Promise.all(Array.from({ length: Math.min(4, inputs.length) }, worker));
        for (var i = 0; i < manifest.scripts.length; i++)
          if (!manifest.scripts[i].file) await verifiedText(manifest.scripts[i]);
        live();
        cfg = {
          nonce: random(),
          token: random(),
          requestId: job.requestId,
          runtimeHash: manifest.runtimeHash,
          sandbox: options.sandbox || null,
        };
        var html = doc.create(manifest, texts, cfg);
        texts.clear();
        frame = document.createElement('iframe');
        frame.name = 'tm-native-preparation-' + cfg.requestId;
        frame.dataset.tmNativePreparation = cfg.requestId;
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText =
          'position:fixed;left:-20000px;top:0;width:1280px;height:800px;border:0;visibility:hidden;pointer-events:none';
        if (options.sandbox) {
          frame.style.width = options.sandbox.width + 'px';
          frame.style.height = options.sandbox.height + 'px';
        }
        frame.onload = function () {
          if (frameLoaded) finish(doc.error('native-frame-navigation', '准备窗口发生了非预期导航'));
          frameLoaded = true;
        };
        frame.onerror = function () {
          finish(doc.error('native-frame-load', '原生准备窗口加载失败'));
        };
        onMessage = function (event) {
          if (
            finished ||
            connected ||
            event.source !== frame.contentWindow ||
            event.origin !== 'null' ||
            !matches(event.data) ||
            event.data.type !== 'tm-start-ready'
          )
            return;
          try {
            live();
            connected = true;
            root.removeEventListener('message', onMessage);
            var channel = new root.MessageChannel();
            port = channel.port1;
            port2 = channel.port2;
            port.onmessage = receive;
            port.onmessageerror = function () {
              finish(doc.error('native-channel-message', '原生准备回包无法读取'));
            };
            port.start();
            frame.contentWindow.postMessage(
              { type: 'tm-start-connect', requestId: cfg.requestId, token: cfg.token, runtimeHash: cfg.runtimeHash },
              '*',
              [port2],
            );
            port.postMessage(
              {
                type: 'initialize',
                requestId: cfg.requestId,
                token: cfg.token,
                runtimeHash: cfg.runtimeHash,
                sourceHash: sourceHash,
                expected: expected,
                bytes: bytes.buffer,
              },
              [bytes.buffer],
            );
            bytes = null;
          } catch (error) {
            finish(error);
          }
        };
        root.addEventListener('message', onMessage);
        progress('booting');
        live();
        frame.srcdoc = html;
        document.body.appendChild(frame);
        if (root.MutationObserver) {
          observer = new root.MutationObserver(function () {
            if (!frame.isConnected) finish(doc.error('start-cancelled', '准备窗口已关闭'));
          });
          observer.observe(document.body, { childList: true });
        }
      }
      Promise.resolve()
        .then(run)
        .catch(function (error) {
          finish(error);
        });
    });
  }
  root.TM = root.TM || {};
  root.TM.StartPreparation = { prepare: prepare, cancel: cancel, status: status };
})(typeof window !== 'undefined' ? window : globalThis);
