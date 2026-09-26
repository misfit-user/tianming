'use strict';
// 通志册页真机用例（通志一期 S2）：真实窗口里从府州方志进北直隶通志，逐卷截图，
// 并核对 VM 模拟 DOM 测不到的行为：真点击、册页宽度、动作后册页不被覆盖、回合刷新重画、关闭清标记、点州跳方志。
// 第三片起另核：左键随层级（天下谱牒、省道通志、府州方志）、右键小菜单与键盘、整道描金边（山河境与 SVG 两种画法）、
// 可点的省名、设置里的「舆图点击」开关。
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');

module.exports = async function ({ win, check }) {
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const dir = path.dirname(process.env.TM_BRIDGE_TEST_REPORT);
  const scenario = process.env.TM_RELIEF_SCENARIO || 'sc-tianqi7-1627';
  const frame = () => js('new Promise(r=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(r)),250))');
  const shot = async (name) => { await frame(); fs.writeFileSync(path.join(dir, name), (await win.webContents.capturePage()).toPNG()); };
  win.show(); win.focus();

  // 开局方式与 strategic-map 用例相同：官方剧本、不接 AI、关掉开局引导
  const init = await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,600));TM_Changelog.markRead();TM_Changelog.close();await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure(${JSON.stringify(scenario)});P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;doActualStart(${JSON.stringify(scenario)});await _tmAwaitLoadBarrier();await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();await document.fonts.ready;for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();})().catch(e=>({initializationError:String(e.stack||e)}))`);
  assert(!init?.initializationError, JSON.stringify(init));
  // 通志的省道分组来自地名模块，要等三层地图准备好
  await js(`(async()=>{const end=Date.now()+60000;while(!(TMPhase8FormalBridge.map.preparationStatus()?.ready&&window.TMMapRealmLayout)){if(Date.now()>end)throw Error('prepared map layers not ready');await new Promise(r=>setTimeout(r,100));}})()`);
  const book = `document.getElementById('ppop')`;

  // 第四片：方志轻调加并卷
  await check('方志：页头层级路径与本道排名，页脚四个诏书动作与地方账本分两行，只剩六卷（截图）', async () => {
    const d = await js(`(async()=>{
      var parts = TMPhase8FormalBridge.__p8MapParts, r = GM.mapData.regions.filter(function(x){ return /顺天/.test(x.name || ''); })[0];
      parts.openRegionDossier(r);
      await new Promise(res => setTimeout(res, 150));
      var pop = ${book}, rank = pop.querySelector('.bk-rankline'), acts = pop.querySelectorAll('.bk-foot-acts [data-bk-region-act]'), more = pop.querySelector('.bk-foot-more');
      return { crumbs: (pop.querySelector('.bk-crumbs') || {}).textContent, rank: rank ? rank.textContent : '', rankH: rank ? rank.offsetHeight : 0,
        acts: Array.prototype.map.call(acts, function(b){ return b.dataset.bkRegionAct; }), twoRows: !!(acts[0] && more && more.getBoundingClientRect().top > acts[0].getBoundingClientRect().bottom - 1),
        juans: Array.prototype.map.call(pop.querySelectorAll('.bk-scroll > .bk-juan'), function(s){ return s.id; }), jq: pop.querySelectorAll('.bk-jq').length };
    })()`);
    assert.match(d.crumbs, /明朝廷›北直隶›顺天府/);
    assert(d.rankH > 0 && /本方 11 州中/.test(d.rank), '排名一行可见：' + d.rank);
    assert.deepEqual(d.acts, ['安民', '巡按', '调粮', '拟诏']);
    assert.equal(d.twoRows, true, '四个动作一行，地方账本另起一行');
    assert(d.juans.length <= 6 && d.juans[0] === 'bk-hukou' && !d.juans.includes('bk-yizheng') && !d.juans.includes('bk-zhuangkuang'), d.juans.join(','));
    assert.equal(d.jq, d.juans.length, '检签与卷一一对应');
    await shot('region-book-top.png');
    const hasYizheng = await js(`(()=>{ var el = ${book}.querySelector('#bk-yizheng'); if (!el) return false; el.scrollIntoView({ block: 'start' }); return true; })()`);
    if (hasYizheng) await shot('region-book-huyi.png');
  });

  await check('方志页脚「安民」真点击写进诏书建议库，册页不被覆盖', async () => {
    const d = await js(`(async()=>{
      var before = (GM._edictSuggestions || []).length;
      ${book}.querySelector('[data-bk-region-act="安民"]').click();
      await new Promise(res => setTimeout(res, 150));
      var list = GM._edictSuggestions || [], last = list[list.length - 1] || {};
      return { added: list.length - before, topic: last.topic, from: last.from, used: last.used, kind: ${book}.dataset.panelKind, acts: ${book}.querySelectorAll('[data-bk-region-act]').length };
    })()`);
    assert.equal(d.added, 1);
    assert.equal(d.topic, '方志·安民');
    assert.equal(d.from, '顺天府');
    assert.equal(d.used, false);
    assert.equal(d.kind, 'region');
    assert.equal(d.acts, 4);
  });

  await check('从顺天府方志页头的层级路径真点击进入北直隶通志', async () => {
    const d = await js(`(async()=>{
      var parts = TMPhase8FormalBridge.__p8MapParts, r = GM.mapData.regions.filter(function(x){ return /顺天/.test(x.name || ''); })[0];
      parts.openRegionDossier(r);
      await new Promise(res => setTimeout(res, 100));
      var regionWidth = ${book}.offsetWidth;
      var pill = ${book}.querySelector('.bk-crumbs [data-bk-open-circuit]');
      if (!pill) return { pill: false };
      pill.click();
      await new Promise(res => setTimeout(res, 150));
      var pop = ${book};
      // 正式界面整体按窗口缩放，量布局宽度 offsetWidth，不量缩放后的屏幕像素
      return { pill: true, kind: pop.dataset.panelKind, cls: pop.className, width: pop.offsetWidth, regionWidth: regionWidth, rows: pop.querySelectorAll('.bk-circuit-table tbody tr').length,
        common: !!pop.querySelector('.bk-circuit-common'), acts: pop.querySelectorAll('[data-bk-circuit-act]').length, title: (pop.querySelector('.bk-name') || {}).textContent };
    })()`);
    assert.equal(d.pill, true, '方志页头层级路径里有北直隶');
    assert.equal(d.kind, 'circuit');
    assert.match(d.cls, /circuit-panel/);
    assert.equal(d.title, '北直隶');
    assert(d.width >= d.regionWidth + 100, '通志比方志宽，放得下七列辖境表：通志 ' + d.width + 'px，方志 ' + d.regionWidth + 'px');
    assert.equal(d.rows, 11);
    assert.equal(d.common, true);
    assert.equal(d.acts, 4);
    await shot('circuit-book-top.png');
  });

  await check('四卷逐一可达（截图：辖境、形势、财计、营造）', async () => {
    for (const [id, name] of [['bk-circuit-xiajing', 'xiajing'], ['bk-circuit-xingshi', 'xingshi'], ['bk-circuit-caiji', 'caiji'], ['bk-circuit-yingzao', 'yingzao']]) {
      const ok = await js(`(()=>{ var el = ${book}.querySelector('#${id}'); if (!el) return false; el.scrollIntoView({ block: 'start' }); return true; })()`);
      assert.equal(ok, true, id + ' 在册');
      await shot('circuit-book-' + name + '.png');
    }
  });

  await check('页脚「巡按」真点击写进诏书建议库，册页不被覆盖', async () => {
    const d = await js(`(async()=>{
      var before = (GM._edictSuggestions || []).length;
      ${book}.querySelector('[data-bk-circuit-act="巡按"]').click();
      await new Promise(res => setTimeout(res, 150));
      var list = GM._edictSuggestions || [], last = list[list.length - 1] || {};
      return { added: list.length - before, topic: last.topic, from: last.from, used: last.used, stillCircuit: ${book}.dataset.panelKind === 'circuit', acts: ${book}.querySelectorAll('[data-bk-circuit-act]').length };
    })()`);
    assert.equal(d.added, 1);
    assert.equal(d.topic, '通志·巡按');
    assert.equal(d.from, '北直隶');
    assert.equal(d.used, false);
    assert.equal(d.stillCircuit, true);
    assert.equal(d.acts, 4, '真浏览器里诏书建议栏与册页是两个节点');
  });

  await check('局面刷新后通志按省道 key 重画，仍停在通志', async () => {
    const d = await js(`(async()=>{
      var key = ${book}.dataset.circuitKey;
      window.dispatchEvent(new Event('tm-state-updated'));
      await new Promise(res => setTimeout(res, 400));
      return { key: key, after: ${book}.dataset.circuitKey, kind: ${book}.dataset.panelKind, shown: ${book}.classList.contains('show') };
    })()`);
    assert.equal(d.kind, 'circuit');
    assert.equal(d.after, d.key);
    assert.equal(d.shown, true);
  });

  await check('点辖境表里的州跳到该州方志', async () => {
    const d = await js(`(async()=>{
      var link = ${book}.querySelector('.bk-circuit-table .bk-circuit-link');
      var name = link.textContent;
      link.click();
      await new Promise(res => setTimeout(res, 150));
      return { name: name, kind: ${book}.dataset.panelKind, region: ${book}.dataset.regionId, title: (${book}.querySelector('.bk-name') || {}).textContent };
    })()`);
    assert.equal(d.kind, 'region');
    assert(d.region, '方志带上地块 id');
    assert.equal(d.title, d.name);
  });

  await check('关闭册页清掉通志标记', async () => {
    const d = await js(`(async()=>{
      var r = GM.mapData.regions.filter(function(x){ return /顺天/.test(x.name || ''); })[0];
      TMPhase8FormalBridge.map.openCircuitDossier(r);
      await new Promise(res => setTimeout(res, 100));
      ${book}.querySelector('[data-pp-close]').click();
      await new Promise(res => setTimeout(res, 100));
      return { cls: ${book}.className, key: ${book}.getAttribute('data-circuit-key'), kind: ${book}.getAttribute('data-panel-kind') };
    })()`);
    assert.doesNotMatch(d.cls, /circuit-panel|\bshow\b/);
    assert.equal(d.key, null);
    assert.equal(d.kind, null);
  });

  // ── 第三片：点击随层级、右键小菜单、整道描金边、可点的省名、设置开关（全用原生鼠标键盘事件）──
  const send = (type, extra) => win.webContents.sendInputEvent(Object.assign({ type }, extra));
  const click = async (pt, button = 'left') => {
    send('mouseMove', { x: pt.x, y: pt.y });
    send('mouseDown', { x: pt.x, y: pt.y, button, clickCount: 1 });
    send('mouseUp', { x: pt.x, y: pt.y, button, clickCount: 1 });
    await frame();
  };
  // 原生按钮靠字符事件响应回车：真键盘三件事都会发，模拟时也要补上 char
  const key = async (keyCode) => {
    send('keyDown', { keyCode });
    if (keyCode === 'Enter') send('char', { keyCode: '\r' });
    send('keyUp', { keyCode });
    await frame();
  };
  // 把视图对准顺天府、切到指定层级，再找一个真能点中顺天府（且上面没压着地名、按钮）的屏幕点。
  // 天下级顺天府只剩一小块，中心又压着势力名，改为点中与顺天府同属一国的任一州（谱牒按国开，结果相同）
  const aimAt = (tier) => js(`(async()=>{
    var bridge = TMPhase8FormalBridge, r = GM.mapData.regions.filter(function(x){ return /顺天/.test(x.name || ''); })[0], id = String(r.id || r.name);
    var owner = bridge.map.ownerKey(r), sameRealm = ${JSON.stringify(tier)} === 'realm';
    bridge.map.closeMapDossier();
    bridge.map.focusRegion(id, false);
    document.querySelector('.map-scale[data-map-scale="${tier}"]').click();
    await new Promise(res => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(res)), 400));
    var stage = document.getElementById('ming-map-layer'), b = stage.getBoundingClientRect();
    var shanhe = !!(window.TMShanheRuntime && TMShanheRuntime.active());
    function hitId(x, y){
      var top = document.elementFromPoint(x, y);
      if (!top || !stage.contains(top) || (top.closest && top.closest('.tmf-realm-fit,.tmf-circuit-fit,button'))) return null;
      var path = shanhe ? TMShanheRuntime.pick({ clientX: x, clientY: y }) : top.closest && top.closest('.tmf-region');
      var hit = path && (path.dataset.regionId || path.dataset.id);
      if (!hit) return null;
      if (hit === id) return hit;
      return sameRealm && bridge.map.ownerKey(bridge.map.findRegion(hit)) === owner ? hit : null;
    }
    var cx = b.left + b.width * .52, cy = b.top + b.height * .48;
    for (var rad = 0; rad < 360; rad += 6) {
      for (var a = 0; a < 24; a++) {
        var x = Math.round(cx + Math.cos(a / 24 * 2 * Math.PI) * rad), y = Math.round(cy + Math.sin(a / 24 * 2 * Math.PI) * rad);
        var hit = hitId(x, y);
        if (hit) return { x: x, y: y, tier: bridge._state.mapScale, shanhe: shanhe, id: hit };
        if (rad === 0) break;
      }
    }
    throw Error('no hit-testable point inside 顺天府 at tier ${tier}');
  })()`);
  const bookState = () => js(`(()=>{
    var pop = document.getElementById('ppop'), line = document.querySelector('#ming-map-layer #tmf-formal-map .tmf-circuit-outline path.line');
    var diag = window.TMShanheRuntime ? TMShanheRuntime.diagnostics().selection : null;
    return { kind: pop && pop.classList.contains('show') ? pop.dataset.panelKind : null, circuitKey: pop && pop.dataset.circuitKey, region: pop && pop.dataset.regionId,
      title: ((pop && pop.querySelector('.bk-name')) || {}).textContent, svgOutline: line ? line.getAttribute('d').length : 0,
      shanheOutline: diag ? diag.outlineLength : 0, menu: !!document.getElementById('tmf-map-ctx') };
  })()`);
  const shuntianOwner = () => js(`TMPhase8FormalBridge.map.ownerName(GM.mapData.regions.filter(function(x){ return /顺天/.test(x.name || ''); })[0])`);

  await check('省道级真点击顺天府开北直隶通志，整道描金边（山河境焦点层与 SVG 图各收到外沿轮廓）', async () => {
    const pt = await aimAt('region');
    assert.equal(pt.tier, 'region');
    await click(pt);
    const s = await bookState();
    assert.equal(s.kind, 'circuit', JSON.stringify({ pt, s }));
    assert.equal(s.title, '北直隶');
    assert(s.svgOutline > 0, 'SVG 图上挂了整道外沿');
    if (pt.shanhe) assert.equal(s.shanheOutline, s.svgOutline, '山河境焦点层收到同一条外沿');
    await shot('circuit-outline-region.png');
  });

  await check('府州级真点击开方志，整道描金边随之撤掉', async () => {
    const pt = await aimAt('prefecture');
    await click(pt);
    const s = await bookState();
    assert.equal(s.kind, 'region', JSON.stringify({ pt, s }));
    assert.equal(s.region, pt.id);
    assert.equal(s.svgOutline, 0);
    assert.equal(s.shanheOutline, 0);
  });

  await check('天下级真点击开势力谱牒', async () => {
    const pt = await aimAt('realm');
    await click(pt);
    const s = await bookState();
    assert.equal(s.kind, 'faction', JSON.stringify({ pt, s }));
  });

  await check('右键小菜单：三项齐全、焦点在第一项，下键加回车选「本道通志」', async () => {
    const pt = await aimAt('prefecture');
    await click(pt, 'right');
    const m = await js(`(()=>{
      var menu = document.getElementById('tmf-map-ctx');
      if (!menu) return { menu: false };
      return { menu: true, items: Array.prototype.map.call(menu.querySelectorAll('[data-map-ctx]'), function(b){ return b.textContent; }),
        focused: document.activeElement && document.activeElement.getAttribute('data-map-ctx'), tip: document.getElementById('tmf-map-tip').classList.contains('show') };
    })()`);
    assert.equal(m.menu, true, '右键弹出小菜单');
    assert.deepEqual(m.items, ['本州方志顺天府', '本道通志北直隶', '本国谱牒' + (await shuntianOwner())]);
    assert.equal(m.focused, 'region', '打开即聚焦第一项');
    assert.equal(m.tip, false, '签注让位');
    await shot('circuit-context-menu.png');
    await key('Down');
    assert.equal(await js(`document.activeElement && document.activeElement.getAttribute('data-map-ctx')`), 'circuit');
    await key('Enter');
    const s = await bookState();
    assert.equal(s.kind, 'circuit');
    assert.equal(s.title, '北直隶');
    assert.equal(s.menu, false, '选中后菜单关闭');
  });

  await check('小菜单按 Esc 关闭，滚轮也关闭', async () => {
    const pt = await aimAt('prefecture');
    await click(pt, 'right');
    assert.equal((await bookState()).menu, true);
    await key('Escape');
    assert.equal((await bookState()).menu, false, 'Esc 关闭');
    await click(pt, 'right');
    assert.equal((await bookState()).menu, true);
    send('mouseWheel', { x: pt.x, y: pt.y, deltaX: 0, deltaY: -40, canScroll: true });
    await frame();
    assert.equal((await bookState()).menu, false, '滚轮关闭');
  });

  await check('省道级的省名「北直隶」真点击开通志', async () => {
    await aimAt('region');
    const target = await js(`(()=>{
      for (const g of document.querySelectorAll('.tmf-circuit-fit:not(.tmf-collide-hidden)')) {
        if (g.dataset.fullName !== '北直隶') continue;
        const b = g.getBoundingClientRect();
        for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) {
          const x = Math.round(b.x + b.width * i / 5), y = Math.round(b.y + b.height * j / 5);
          if (document.elementFromPoint(x, y)?.closest('.tmf-circuit-fit') === g) return { x, y, role: g.getAttribute('role') };
        }
      }
      return null;
    })()`);
    assert(target, '北直隶省名可见且可点中');
    assert.equal(target.role, 'button');
    await click(target);
    const s = await bookState();
    assert.equal(s.kind, 'circuit');
    assert.equal(s.title, '北直隶');
  });

  await check('设置「舆图点击」切到一律方志后省道级左键开方志，切回随层级', async () => {
    const pick = (want) => js(`(async()=>{
      openSettings();
      await new Promise(res => setTimeout(res, 300));
      var btn = Array.prototype.find.call(document.querySelectorAll('button'), function(b){ return (b.getAttribute('onclick') || '').indexOf('_tmSetMapClickTier(${want}') === 0; });
      if (!btn) { closeSettings(); return { found: false }; }
      btn.click();
      var on = btn.classList.contains('bp');
      closeSettings();
      return { found: true, on: on, conf: P.conf.mapClickFollowTier };
    })()`);
    const off = await pick(false);
    assert.equal(off.found, true, '设置里有舆图点击开关');
    assert.equal(off.on, true);
    assert.equal(off.conf, false);
    await click(await aimAt('region'));
    assert.equal((await bookState()).kind, 'region', '一律方志：省道级左键也开方志');
    const on = await pick(true);
    assert.equal(on.conf, true);
    await click(await aimAt('region'));
    assert.equal((await bookState()).kind, 'circuit', '切回随层级');
  });

  await check('关掉山河境用 SVG 图时，整道描金边画在图上且可见', async () => {
    await js(`(async()=>{
      if (window.TMShanheRuntime) TMShanheRuntime.setEnabled(false);
      TMPhase8FormalBridge.map.invalidateFormalMap();
      TMPhase8FormalBridge.map.renderFormalMap();
      const end = Date.now() + 60000;
      while (!TMPhase8FormalBridge.map.preparationStatus()?.ready) { if (Date.now() > end) throw Error('layers not ready'); await new Promise(r => setTimeout(r, 100)); }
    })()`);
    const pt = await aimAt('region');
    assert.equal(pt.shanhe, false);
    await click(pt);
    const v = await js(`(()=>{
      var line = document.querySelector('#ming-map-layer #tmf-formal-map .tmf-circuit-outline path.line'), b = line && line.getBoundingClientRect();
      return { kind: document.getElementById('ppop').dataset.panelKind, has: !!line, display: line ? getComputedStyle(line.parentNode).display : '', w: b ? b.width : 0, h: b ? b.height : 0 };
    })()`);
    assert.equal(v.kind, 'circuit');
    assert.equal(v.has, true);
    assert.notEqual(v.display, 'none');
    assert(v.w > 20 && v.h > 20, '外沿轮廓有实际大小：' + JSON.stringify(v));
    await shot('circuit-outline-svg.png');
  });
};
