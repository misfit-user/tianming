'use strict';
// 通志册页真机用例（通志一期 S2）：真实窗口里从府州方志进北直隶通志，逐卷截图，
// 并核对 VM 模拟 DOM 测不到的行为：真点击、册页宽度、动作后册页不被覆盖、回合刷新重画、关闭清标记、点州跳方志。
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

  await check('从顺天府方志页头的「道」签真点击进入北直隶通志', async () => {
    const d = await js(`(async()=>{
      var parts = TMPhase8FormalBridge.__p8MapParts, r = GM.mapData.regions.filter(function(x){ return /顺天/.test(x.name || ''); })[0];
      parts.openRegionDossier(r);
      await new Promise(res => setTimeout(res, 100));
      var regionWidth = ${book}.offsetWidth;
      var pill = ${book}.querySelector('[data-bk-open-circuit]');
      if (!pill) return { pill: false };
      pill.click();
      await new Promise(res => setTimeout(res, 150));
      var pop = ${book};
      // 正式界面整体按窗口缩放，量布局宽度 offsetWidth，不量缩放后的屏幕像素
      return { pill: true, kind: pop.dataset.panelKind, cls: pop.className, width: pop.offsetWidth, regionWidth: regionWidth, rows: pop.querySelectorAll('.bk-circuit-table tbody tr').length,
        common: !!pop.querySelector('.bk-circuit-common'), acts: pop.querySelectorAll('[data-bk-circuit-act]').length, title: (pop.querySelector('.bk-name') || {}).textContent };
    })()`);
    assert.equal(d.pill, true, '方志页头有「道 北直隶」签');
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
};
