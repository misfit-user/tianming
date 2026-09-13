/* tm-battle-embed.js — 御驾亲征接入 · Phase 1「§13.1 iframe 嵌入」
 * 主游戏开全屏 iframe 载战术战斗原型(web/battle/index.html·已打包随 web/ 三端可达),
 * postMessage 握手:收 battleReady→发 startBattle(config);收 battleResult/Aborted/Error→关 iframe·resolve。
 * 隔离:原型零依赖单文件·全局不与主游戏 660 文件撞车(iframe 独立 window)。result 回填 GM 属 Phase 2。
 */
(function () {
  'use strict';
  var BATTLE_URL = 'battle/index.html?v=20260913-battle3'; // 带缓存戳，避免旧iframe协议配新主游戏
  var START_TIMEOUT = 12000;

  function launch(config) {
    return new Promise(function (resolve) {
      if (typeof document === 'undefined') { resolve(null); return; }
      if (document.getElementById && document.getElementById('tm-battle-overlay')) { resolve({ error: '已有战场正在进行', code: 'battle-busy' }); return; }
      var overlay = document.createElement('div');
      overlay.id = 'tm-battle-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#0a0907;';
      var iframe = document.createElement('iframe');
      iframe.setAttribute('title', '御驾亲征·战术战斗');
      iframe.setAttribute('allow', 'autoplay; fullscreen');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;';
      iframe.src = BATTLE_URL;
      var bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;top:8px;right:10px;z-index:10;';
      var abortBtn = document.createElement('button');
      abortBtn.type = 'button';
      abortBtn.textContent = '✕ 放弃·转庙算';
      abortBtn.style.cssText = 'font:13px/1 serif;color:#e8d6a8;background:rgba(20,14,8,.86);border:1px solid #8a6a2a;border-radius:4px;padding:6px 11px;cursor:pointer;';
      bar.appendChild(abortBtn);
      overlay.appendChild(iframe);
      overlay.appendChild(bar);
      var progress = document.createElement('div');
      progress.textContent = '正在准备战场…';
      progress.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e8d6a8;background:#0a0907;font:18px serif;pointer-events:none;';
      overlay.insertBefore(progress, bar);

      var done = false, started = false, retryTimer = null, deadline = null;
      var sessionId = 'battle-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      function finish(result) {
        if (done) return; done = true;
        clearTimeout(retryTimer); clearTimeout(deadline);
        try { window.removeEventListener('message', onMsg); } catch (e) {}
        try { overlay.remove(); } catch (e) {}
        resolve(result);
      }
      function sendStart() {
        if (done || started) return;
        clearTimeout(retryTimer);
        try { iframe.contentWindow.postMessage({ type: 'startBattle', sessionId: sessionId, config: config }, '*'); }
        catch (e) { finish({ error: '无法发送战场数据：' + e.message, code: 'battle-start-send' }); return; }
        retryTimer = setTimeout(sendStart, 500); // 同会战ID幂等重送，须收到子页确认才算启动
      }
      function onMsg(e) {
        if (iframe.contentWindow && e.source !== iframe.contentWindow) return;   // 只认本 iframe
        var d = e.data || {};
        if (d.sessionId && d.sessionId !== sessionId) return;
        if (d.type === 'battleReady') sendStart();
        else if (d.type === 'battleStarted' && d.sessionId === sessionId) { started = true; clearTimeout(retryTimer); clearTimeout(deadline); progress.remove(); }
        else if (d.type === 'battleResult' && started) finish(d.result || { error: '战场未返回有效战果', code: 'battle-empty-result' });
        else if (d.type === 'battleAborted') finish(null);
        else if (d.type === 'battleError') finish({ error: d.error || '战场运行失败', code: 'battle-runtime-error' });
      }
      window.addEventListener('message', onMsg);
      iframe.addEventListener('load', sendStart);
      iframe.addEventListener('error', function () { finish({ error: '战场页面加载失败', code: 'battle-load-error' }); });
      abortBtn.onclick = function () { try { iframe.contentWindow.postMessage({ type: 'abort', sessionId: sessionId }, '*'); } catch (e) {} finish(null); };

      document.body.appendChild(overlay);
      deadline = setTimeout(function () { finish({ error: '战场启动超时，已转庙算', code: 'battle-start-timeout' }); }, START_TIMEOUT);
    });
  }

  /* 便捷:从交战军群直接拉起(走 Phase1 适配器 buildBattleConfig) */
  function launchFromArmies(playerArmies, enemyArmies, opts) {
    if (typeof window === 'undefined' || !window.TMBattleAdapter) return Promise.resolve(null);
    var cfg = window.TMBattleAdapter.buildBattleConfig(playerArmies, enemyArmies, opts || {});
    return launch(cfg);
  }

  if (typeof window !== 'undefined') window.TMBattleEmbed = { launch: launch, launchFromArmies: launchFromArmies, BATTLE_URL: BATTLE_URL, START_TIMEOUT: START_TIMEOUT };
})();
