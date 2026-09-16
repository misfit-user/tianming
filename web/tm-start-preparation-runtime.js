// Only installed by the trusted opaque preparation document, never the live entry.
(function (root) {
  'use strict';
  var cfg = root.__tmNativePreparation,
    state = root.__tmNativePreparationState;
  if (!cfg || !state || root.parent === root || typeof root.tianming !== 'undefined' || typeof require !== 'undefined')
    return;
  var parentDenied = false;
  try {
    void root.parent.document;
  } catch (e) {
    parentDenied = e.name === 'SecurityError';
  }
  if (!parentDenied) return; // Refuse a same-origin/privileged installation even if called by mistake.
  var connected = false,
    used = false,
    port;
  function message(type, extra) {
    return Object.assign(
      { type: type, requestId: cfg.requestId, token: cfg.token, runtimeHash: cfg.runtimeHash },
      extra,
    );
  }
  function fail(code, reason) {
    if (port) port.postMessage(message('failed', { code: code, message: String(reason).slice(0, 512) }));
  }
  async function renderNativeMap() {
    // Offscreen/hidden frames may suspend rAF indefinitely. Invoke the same production renderer
    // synchronously; geometry serialization and image decoding do not need a compositor frame.
    var nativeMap = root.TMPhase8FormalBridge && root.TMPhase8FormalBridge.map;
    if (!nativeMap) throw Error('正式地图模块未加载');
    nativeMap.ensureMainShell();
    nativeMap.invalidateFormalMap();
    nativeMap.renderFormalMap();
    var svg = root.document.querySelector('#tmf-map-stage svg') || root.document.querySelector('.tmf-map-svg');
    if (!svg)
      svg = Array.from(root.document.querySelectorAll('svg')).find(function (s) {
        return s.querySelector('path.tmf-region');
      });
    if (!svg || !svg.querySelectorAll('path.tmf-region').length) throw Error('正式地图渲染器没有生成可点击地块');
    var copy = svg.cloneNode(true),
      originals = [svg].concat(Array.from(svg.querySelectorAll('*'))),
      nodes = [copy].concat(Array.from(copy.querySelectorAll('*')));
    if (copy.querySelector('script,foreignObject')) throw Error('原生地图含不可导出的活动内容');
    function localPaint(value) {
      return value.replace(/url\(["']?[^)"']*#([^"')]+)["']?\)/g, function (all, id) {
        if (!svg.querySelector('[id="' + CSS.escape(id) + '"]')) throw Error('地图绘制引用缺失：' + id);
        return 'url(#' + id + ')';
      });
    }
    originals.forEach(function (el, i) {
      var css = root.getComputedStyle(el),
        style = [
          'fill',
          'fill-opacity',
          'stroke',
          'stroke-width',
          'stroke-opacity',
          'stroke-linecap',
          'stroke-linejoin',
          'stroke-dasharray',
          'font-size',
          'font-family',
          'font-weight',
          'text-anchor',
          'dominant-baseline',
          'paint-order',
          'opacity',
          'display',
          'filter',
          'mask',
          'clip-path',
          'mix-blend-mode',
        ]
          .map(function (k) {
            return k + ':' + localPaint(css.getPropertyValue(k));
          })
          .join(';');
      nodes[i].setAttribute('style', style);
    });
    Array.from(copy.querySelectorAll('image')).forEach(function (img) {
      var href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
      if (href && !/^data:image\//.test(href)) throw Error('地图预览依赖尚未获准读取的外部图像');
    });
    var width = cfg.sandbox.width,
      height = cfg.sandbox.height;
    copy.setAttribute('width', width);
    copy.setAttribute('height', height);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('style', 'display:block;visibility:visible');
    var encoded = new TextEncoder().encode(new XMLSerializer().serializeToString(copy)),
      binary = '';
    for (var i = 0; i < encoded.length; i += 32768)
      binary += String.fromCharCode.apply(null, encoded.subarray(i, i + 32768));
    var img = new Image();
    await new Promise(function (resolve, reject) {
      img.onload = resolve;
      img.onerror = function () {
        reject(Error('原生 SVG 栅格化失败'));
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(binary);
    });
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ebe3ca';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    var pixels = ctx.getImageData(0, 0, width, height).data,
      black = 0,
      colors = new Set();
    for (var n = 0; n < pixels.length; n += 16) {
      if (pixels[n] < 8 && pixels[n + 1] < 8 && pixels[n + 2] < 8) black++;
      colors.add((pixels[n] << 16) | (pixels[n + 1] << 8) | pixels[n + 2]);
    }
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: width,
      height: height,
      pixelSummary: { sampledColors: colors.size, nearBlackFraction: black / (pixels.length / 16) },
      renderer: 'phase8-formal-map',
      host: 'opaque-native-initializer',
      hitRegions: Array.from(svg.querySelectorAll('path.tmf-region')).map(function (p) {
        return p.getAttribute('data-region-id');
      }),
      realModel: false,
    };
  }
  async function initialize(event) {
    var data = event.data;
    if (used) return;
    if (
      !data ||
      data.type !== 'initialize' ||
      data.token !== cfg.token ||
      data.requestId !== cfg.requestId ||
      data.runtimeHash !== cfg.runtimeHash
    )
      return;
    used = true;
    try {
      var compiler = root.TM && root.TM.StartCompiler;
      if (!compiler) throw Error('当前隔离环境缺少纯数据校验器');
      if (
        !(data.bytes instanceof ArrayBuffer) ||
        data.bytes.byteLength < 2 ||
        data.bytes.byteLength > compiler.maxBytes
      )
        throw Error('原生输入字节超限');
      // Opaque origins intentionally lack WebCrypto. The secure parent hashes its
      // owned input before transfer and hashes the actual returned bytes again.
      // This echo is correlation only, not a fabricated child-computed digest.
      if (!/^[a-f0-9]{64}$/.test(data.sourceHash)) throw Error('原生输入缺少父端锁定指纹');
      var bytes = new Uint8Array(data.bytes);
      var sourceText = new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        source = JSON.parse(sourceText);
      compiler.assertData(source);
      if (
        !data.expected ||
        source.id !== data.expected.scenarioId ||
        !source.characters.some(function (c) {
          return c.id === data.expected.characterId;
        })
      )
        throw Error('所选身份不在锁定剧本中');
      if (state.errors.length) throw Error('原生加载期间存在脚本错误');
      if (typeof root.doActualStart !== 'function' || typeof root._buildSaveState !== 'function' || !root.P)
        throw Error('原生初始化器未加载');
      root.P.scenarios = [source]; // arch-ok: one-shot opaque preparation owner; the guards above exclude the live renderer
      root.P.ai = { key: '', url: '', model: '' }; // arch-ok: private initializer has no credentials or paid-provider access
      var play = source.startContext && source.startContext.playOptions;
      if (play) {
        if (
          Object.keys(play).some(function (k) {
            return ['gameMode', 'difficulty'].indexOf(k) < 0;
          }) ||
          ['yanyi', 'light_hist', 'strict_hist'].indexOf(play.gameMode) < 0 ||
          ['narrative', 'standard', 'hardcore'].indexOf(play.difficulty) < 0
        )
          throw Error('开局模式或难度无效');
        root.P.conf = Object.assign({}, root.P.conf, play); // arch-ok: opaque initialization accepts only the two validated game-specific choices
      }
      port.postMessage(message('progress', { stage: 'initializing' }));
      root.doActualStart(source.id);
      if (
        !root.GM ||
        !root.GM.running ||
        root.GM.sid !== source.id ||
        root.GM.playerCharacterId !== data.expected.characterId
      )
        throw Error('原生初始化后的身份与本次选择不符');
      if (JSON.stringify(source) !== sourceText) throw Error('原生初始化修改了锁定源剧本');
      var periods = [];
      if (cfg.sandbox && cfg.sandbox.fiscalPeriods) {
        if (!root.TM.NativeFiscal || !root.TM.NativeWorld.enabled(root.GM)) throw Error('此开局未实现原生财政测试能力');
        for (var step = 0; step < cfg.sandbox.fiscalPeriods; step++) {
          root.GM.turn++; // arch-ok: actual deterministic consumers in the opaque no-storage/no-provider host only
          root.CascadeTax.collect();
          root.GuokuEngine.tick();
          root.NeitangEngine.tick();
          root.FixedExpense.collect();
          root.TM.FactionNpcGuoku.generate();
          if (typeof root.checkHistoryEvents === 'function') root.checkHistoryEvents();
          periods.push({
            turn: root.GM.turn,
            accounts: root.GM.nativeWorld.accounts.map(function (a) {
              return { id: a.id, balance: a.balance, unit: a.unit };
            }),
          });
        }
      }
      var preview = cfg.sandbox && cfg.sandbox.preview ? await renderNativeMap() : null;
      var snapshot = root._buildSaveState({ format: 'idb', detach: true });
      if (
        !snapshot ||
        !snapshot.GM ||
        !snapshot.P ||
        snapshot.GM.playerCharacterId !== data.expected.characterId ||
        (snapshot.P.ai && snapshot.P.ai.key)
      )
        throw Error('原生快照读回校验失败');
      if (state.errors.length) throw Error('原生初始化期间存在脚本错误');
      var output = new TextEncoder().encode(JSON.stringify(snapshot));
      if (output.byteLength > 192 * 1024 * 1024) throw Error('原生快照超过准备预算');
      port.postMessage(
        message('prepared', {
          sourceHash: data.sourceHash,
          hashAuthority: 'parent-webcrypto-readback',
          bytes: output.buffer,
          preview: preview,
          observation: {
            characters: snapshot.GM.chars.length,
            factions: snapshot.GM.facs.length,
            turn: snapshot.GM.turn,
            storage: state.storage,
            errors: state.errors.slice(),
            fiscalPeriods: periods,
            scope: 'actual-initialization-and-deterministic-consumers; not a full paid end-turn',
          },
        }),
        [output.buffer],
      );
    } catch (error) {
      fail('native-initialization-failed', error.message);
    }
  }
  function connect(event) {
    var data = event.data;
    if (
      connected ||
      event.source !== root.parent ||
      !data ||
      data.type !== 'tm-start-connect' ||
      data.token !== cfg.token ||
      data.requestId !== cfg.requestId ||
      data.runtimeHash !== cfg.runtimeHash ||
      event.ports.length !== 1
    )
      return;
    connected = true;
    root.removeEventListener('message', connect);
    port = event.ports[0];
    port.onmessage = initialize;
    port.start();
  }
  root.addEventListener('message', connect);
  root.addEventListener(
    'DOMContentLoaded',
    function () {
      root.parent.postMessage(message('tm-start-ready'), '*');
    },
    { once: true },
  );
  root.addEventListener(
    'pagehide',
    function () {
      root.removeEventListener('message', connect);
      if (port) port.close();
    },
    { once: true },
  );
})(typeof window !== 'undefined' ? window : globalThis);
