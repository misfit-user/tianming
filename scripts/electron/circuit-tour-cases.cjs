'use strict';
// 三部剧本巡检（通志一期 S5 验收）：不认死某一州，挑玩家本方州数最多的正式省道，逐项核对并截图——
// 方志（层级路径、本道排名、页脚动作、至多六卷）、通志（辖境列全本方各州、四个动作）、
// 省道级真点击开通志并描金边、右键小菜单三项、改隶候选面板。用 --scenario 选剧本。
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');

module.exports = async function ({ win, check }) {
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const dir = path.dirname(process.env.TM_BRIDGE_TEST_REPORT);
  const scenario = process.env.TM_RELIEF_SCENARIO || 'sc-tianqi7-1627';
  const tag = scenario.replace(/^sc-/, '');
  const frame = () => js('new Promise(r=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(r)),250))');
  const shot = async (name) => { await frame(); fs.writeFileSync(path.join(dir, tag + '-' + name), (await win.webContents.capturePage()).toPNG()); };
  const send = (type, extra) => win.webContents.sendInputEvent(Object.assign({ type }, extra));
  const click = async (pt, button = 'left') => {
    send('mouseMove', { x: pt.x, y: pt.y });
    send('mouseDown', { x: pt.x, y: pt.y, button, clickCount: 1 });
    send('mouseUp', { x: pt.x, y: pt.y, button, clickCount: 1 });
    await frame();
  };
  win.show(); win.focus();

  const init = await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,600));TM_Changelog.markRead();TM_Changelog.close();await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure(${JSON.stringify(scenario)});P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;doActualStart(${JSON.stringify(scenario)});await _tmAwaitLoadBarrier();await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();await document.fonts.ready;for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();})().catch(e=>({initializationError:String(e.stack||e)}))`);
  assert(!init?.initializationError, JSON.stringify(init));
  await js(`(async()=>{const end=Date.now()+90000;while(!(TMPhase8FormalBridge.map.preparationStatus()?.ready&&window.TMMapRealmLayout)){if(Date.now()>end)throw Error('prepared map layers not ready');await new Promise(r=>setTimeout(r,100));}})()`);
  const book = `document.getElementById('ppop')`;

  // 巡检对象：本方州数最多的正式省道（至少两州）。各剧本的都城字段写法不一，不拿它认治所。
  const pick = await js(`(()=>{
    var parts = TMPhase8FormalBridge.__p8MapParts, names = TMPhase8FormalBridge.rightrail.playerFactionNames();
    var mine = function(r){ var k = parts.canonicalOwnerKey(r), f = parts.findFaction(k, ''); return names.indexOf(String(k)) >= 0 || !!(f && names.indexOf(String(f.name)) >= 0); };
    var regions = GM.mapData.regions.filter(mine), best = null;
    regions.forEach(function(r){
      var c = parts.findCircuit(r);
      if (!c) return;
      var own = TM.MapCircuits.partitionByOwner(c, parts.canonicalOwnerKey(r)).own;
      if (own.length < 2) return;
      if (!best || own.length > best.count) best = { id: String(r.id || r.name), name: r.name, circuit: c.label, key: c.key, count: own.length };
    });
    return best;
  })()`);
  assert(pick, '找到玩家的正式省道');

  await check(tag + '：方志层级路径、本道排名、页脚动作，至多六卷（截图）', async () => {
    const d = await js(`(async()=>{
      TMPhase8FormalBridge.map.openRegionDossier(TMPhase8FormalBridge.map.findRegion(${JSON.stringify(pick.id)}));
      await new Promise(res => setTimeout(res, 150));
      var pop = ${book};
      return { crumbs: (pop.querySelector('.bk-crumbs') || {}).textContent || '', rank: (pop.querySelector('.bk-rankline') || {}).textContent || '',
        acts: pop.querySelectorAll('[data-bk-region-act]').length, juans: pop.querySelectorAll('.bk-scroll > .bk-juan').length, reassign: !!pop.querySelector('[data-bk-reassign-open="region"]') };
    })()`);
    assert.ok(d.crumbs.indexOf(pick.circuit) >= 0, d.crumbs);
    assert.ok(/本方 \d+ 州中/.test(d.rank), d.rank);
    assert.equal(d.acts, 4);
    assert.ok(d.juans > 0 && d.juans <= 6, String(d.juans));
    assert.equal(d.reassign, true);
    await shot('region.png');
  });

  await check(tag + '：从层级路径进通志，辖境列全本方各州（截图）', async () => {
    const d = await js(`(async()=>{
      ${book}.querySelector('.bk-crumbs [data-bk-open-circuit]').click();
      await new Promise(res => setTimeout(res, 150));
      var pop = ${book};
      return { kind: pop.dataset.panelKind, title: (pop.querySelector('.bk-name') || {}).textContent, rows: pop.querySelectorAll('.bk-circuit-table tbody tr').length,
        stats: pop.querySelectorAll('.bk-stats .bk-stat').length, acts: pop.querySelectorAll('[data-bk-circuit-act]').length };
    })()`);
    assert.equal(d.kind, 'circuit');
    assert.equal(d.title, pick.circuit);
    assert.equal(d.rows, pick.count, '辖境表列全本方 ' + pick.count + ' 州');
    assert.equal(d.acts, 4);
    await shot('circuit.png');
  });

  // 对准这一州、切到指定层级，找一个真能点中它的屏幕点
  const aimAt = (tier) => js(`(async()=>{
    var bridge = TMPhase8FormalBridge, id = ${JSON.stringify(pick.id)};
    bridge.map.closeMapDossier();
    bridge.map.focusRegion(id, false);
    document.querySelector('.map-scale[data-map-scale="${tier}"]').click();
    await new Promise(res => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(res)), 500));
    var stage = document.getElementById('ming-map-layer'), b = stage.getBoundingClientRect();
    var shanhe = !!(window.TMShanheRuntime && TMShanheRuntime.active());
    var cx = b.left + b.width * .52, cy = b.top + b.height * .48;
    for (var rad = 0; rad < 360; rad += 6) for (var a = 0; a < 24; a++) {
      var x = Math.round(cx + Math.cos(a / 24 * 2 * Math.PI) * rad), y = Math.round(cy + Math.sin(a / 24 * 2 * Math.PI) * rad);
      var top = document.elementFromPoint(x, y);
      if (top && stage.contains(top) && !(top.closest && top.closest('.tmf-realm-fit,.tmf-circuit-fit,button'))) {
        var path = shanhe ? TMShanheRuntime.pick({ clientX: x, clientY: y }) : top.closest && top.closest('.tmf-region');
        if (path && (path.dataset.regionId || path.dataset.id) === id) return { x: x, y: y };
      }
      if (rad === 0) break;
    }
    throw Error('no hit-testable point for ' + id);
  })()`);

  await check(tag + '：省道级真点击开通志并整道描金边（截图）', async () => {
    await click(await aimAt('region'));
    const d = await js(`(()=>({ kind: ${book}.dataset.panelKind, key: ${book}.dataset.circuitKey,
      outline: (document.querySelector('#ming-map-layer .tmf-circuit-outline path.line') || { getAttribute: function(){ return ''; } }).getAttribute('d').length,
      shanhe: window.TMShanheRuntime ? TMShanheRuntime.diagnostics().selection.outlineLength : 0 }))()`);
    assert.equal(d.kind, 'circuit');
    assert.equal(d.key, pick.key);
    assert.ok(d.outline > 0, '描金边已挂');
    await shot('outline.png');
  });

  await check(tag + '：右键小菜单三项（截图）', async () => {
    await click(await aimAt('prefecture'), 'right');
    const items = await js(`Array.prototype.map.call(document.querySelectorAll('#tmf-map-ctx [data-map-ctx]'), function(b){ return b.dataset.mapCtx; })`);
    assert.deepEqual(items, ['region', 'circuit', 'faction']);
    await shot('menu.png');
    send('keyDown', { keyCode: 'Escape' }); send('keyUp', { keyCode: 'Escape' });
    await frame();
  });

  await check(tag + '：方志「改隶」候选面板（截图）', async () => {
    const d = await js(`(async()=>{
      var DR = TM.DivisionReassign, parts = TMPhase8FormalBridge.__p8MapParts, c = parts.findCircuit(${JSON.stringify(pick.key)});
      var own = TM.MapCircuits.partitionByOwner(c, parts.canonicalOwnerKey(c.members[0].region)).own;
      var mover = own.filter(function(r){ return DR.movable(r, {}).ok; })[0] || own[0];
      TMPhase8FormalBridge.map.openRegionDossier(mover);
      await new Promise(res => setTimeout(res, 150));
      ${book}.querySelector('[data-bk-reassign-open="region"]').click();
      await new Promise(res => setTimeout(res, 150));
      var panel = ${book}.querySelector('.bk-reassign');
      return { panel: !!panel, text: panel ? panel.textContent.slice(0, 120) : '' };
    })()`);
    assert.equal(d.panel, true, d.text);
    await shot('reassign.png');
  });
};
