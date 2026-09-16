// One bounded worker per request; cancellation/timeout terminate it before any asset can commit.
(function (root) {
  'use strict';
  var script = root.document && root.document.currentScript && root.document.currentScript.src,
    workerURL = script ? new URL('tm-map-workbench-worker.js', script).href : null,
    active = null;
  function run(method, args, options) {
    options = options || {};
    if (active) return Promise.reject(new Error('已有地图计算，请完成或取消后重试'));
    if (!workerURL || !root.Worker) return Promise.reject(new Error('此环境不支持安全地图 Worker'));
    if (options.signal && options.signal.aborted) return Promise.reject(new Error('地图任务已取消'));
    return new Promise(function (resolve, reject) {
      var requestId = root.crypto.randomUUID(),
        worker = new Worker(workerURL),
        timer,
        done = false;
      active = worker;
      function finish(error, result) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener('abort', abort);
        worker.terminate();
        if (active === worker) active = null;
        error ? reject(error) : resolve(result);
      }
      function abort() {
        var e = new Error('地图计算已取消；未写入案卷');
        e.code = 'map-cancelled';
        finish(e);
      }
      worker.onmessage = function (event) {
        var m = event.data;
        if (!m || m.requestId !== requestId) return;
        if (!m.ok) {
          var e = new Error(m.error.message);
          e.code = m.error.code;
          e.details = m.error.details;
          finish(e);
        } else finish(null, m.result);
      };
      worker.onerror = function (e) {
        finish(new Error(e.message || '地图 Worker 失败'));
      };
      if (options.signal) options.signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(function () {
        finish(new Error('地图计算超过 60 秒预算，未写入案卷'));
      }, 60000);
      worker.postMessage(Object.assign({}, args, { method: method, requestId: requestId }));
    });
  }
  root.TM = root.TM || {};
  root.TM.MapWorkbenchClient = { run: run };
})(typeof window !== 'undefined' ? window : globalThis);
