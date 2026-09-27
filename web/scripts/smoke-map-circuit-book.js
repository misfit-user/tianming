#!/usr/bin/env node
// smoke-map-circuit-book.js — 通志册页（省道一级）在真实开局上的行为测试
//
// 在 VM 里完整开一局天启，打开北直隶的通志，核对：读数与数据层对下辖府州的实时汇总一致；
// 辖境表列全本方各州并做共性上提；页脚动作经右栏同一个写入口写诏书建议；他方省道不给动作；方志页头有进通志的入口。
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const helperFile = path.join(__dirname, 'smoke-start-game-data-integrity.js');
const helperText = fs.readFileSync(helperFile, 'utf8').replace(/^#![^\n]*\n/, '');
const helperEnd = helperText.indexOf('(async function main()');
if (helperEnd < 0) throw new Error('helper boundary missing');
const helpers = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
  helperText.slice(0, helperEnd) + '\nreturn { loadGame };')(require, process, __dirname, helperFile, { exports: {} }, {});

const SID = 'sc-tianqi7-1627';
const c = helpers.loadGame(SID);
vm.runInContext(`P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(${JSON.stringify(SID)})`, c, { timeout: 180000 });

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

setTimeout(() => {
  try {
    // 浏览器里省道分组来自按需加载的地名模块；VM 不跑按需加载，这里直接装入它的布局脚本
    vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-map-realm-layout.js'), 'utf8'), c, { filename: 'tm-map-realm-layout.js' });
    const run = (code) => vm.runInContext(code, c, { timeout: 60000 });

    run(`
      var __parts = TMPhase8FormalBridge.__p8MapParts;
      var __map = GM.mapData;
      var __shuntian = __map.regions.filter(function(r){ return /顺天/.test(r.name || ''); })[0];
      var __circuit = __parts.findCircuit(__shuntian);
      var __book = function(){ return document.getElementById('ppop'); };
    `);

    check('北直隶通志能从府州打开，页头有层级路径、长官与治所', () => {
      const d = JSON.parse(run(`(function(){
        var ok = TMPhase8FormalBridge.map.openCircuitDossier(__shuntian);
        var pop = __book();
        return JSON.stringify({ ok: ok, kind: pop.dataset.panelKind, key: pop.dataset.circuitKey, cls: pop.className, html: pop.innerHTML, circuitKey: __circuit && __circuit.key });
      })()`));
      assert.equal(d.ok, true);
      assert.equal(d.kind, 'circuit');
      assert.equal(d.key, d.circuitKey);
      assert.match(d.cls, /circuit-panel/);
      assert.ok(d.html.includes('通 志'), '册页种类是通志');
      assert.ok(d.html.includes('bk-crumbs') && d.html.includes('北直隶'), '页头有层级路径');
      assert.ok(d.html.includes('顺天巡抚') && d.html.includes('刘诏'), '长官卡取自省道档案');
      assert.ok(d.html.includes('治所 <b>顺天府</b>'), '治所可点开其方志');
    });

    check('五项读数等于数据层对下辖府州的实时汇总', () => {
      const d = JSON.parse(run(`(function(){
        var MC = TM.MapCircuits, own = MC.partitionByOwner(__circuit, __parts.canonicalOwnerKey(__shuntian)).own;
        var sum = MC.summarize(own, { bundle: __parts.regionBundle, mood: __parts.moodViewScore, office: __parts.officeViewScore });
        var stats = Array.prototype.slice.call(document.getElementById('ppop').innerHTML.match(/<div class="bk-stat[^"]*"[^>]*><span class="k">[^<]*<\\/span><span class="v">[^<]*<\\/span>/g) || []);
        return JSON.stringify({ count: own.length, sum: sum, stats: stats,
          expected: [__parts.ppValue(sum.population), __parts.ppValue(sum.actualRevenue), __parts.ppValue(sum.troops), String(sum.mood), String(sum.office)] });
      })()`));
      assert.equal(d.count, 11, '北直隶本方 11 州');
      assert.equal(d.sum.missing.population, 0);
      assert.equal(d.stats.length, 5, '读数带五项');
      const values = d.stats.map((s) => s.replace(/.*<span class="v">([^<]*)<\/span>$/, '$1'));
      assert.deepEqual(values, d.expected, '读数带逐项等于汇总值');
    });

    check('辖境表列全本方各州，全道共有的问题上提到道一级', () => {
      const html = run(`__book().innerHTML`);
      const table = html.slice(html.indexOf('bk-circuit-table'), html.indexOf('</table>'));
      const rows = table.match(/<tr class="[^"]*"><td class="nm">/g) || [];
      assert.equal(rows.length, 11, '11 州各占一行');
      assert.ok(html.includes('bk-circuit-common') && html.includes('全道共性（11/11 州）'), '开局各州同档的民心、吏治等问题上提');
      assert.ok((table.match(/data-bk-open-region="/g) || []).length >= 11, '每一州都能点开方志');
      assert.ok(html.includes('bk-circuit-xingshi') && html.includes('后金破宣府大同塞入塞；宣府镇守将叛变；京营兵变'), '形势卷完整列出边警，叙述文字不被换成势力名');
      // 合规与方志同口径：各州 fiscal.compliance 按应征加权，在 VM 里独立再算一遍
      const expected = JSON.parse(run(`(function(){
        var MC = TM.MapCircuits, own = MC.partitionByOwner(__circuit, __parts.canonicalOwnerKey(__shuntian)).own, w = 0, t = 0;
        own.forEach(function(r){ var f = __parts.regionBundle(r).fiscal || {}; var k = Number(f.claimedRevenue) > 0 ? Number(f.claimedRevenue) : 1; if (f.compliance != null) { t += Number(f.compliance) * k; w += k; } });
        return JSON.stringify(Math.round(t / w * 100));
      })()`));
      assert.ok(html.includes('bk-circuit-caiji') && html.includes('合规 ' + expected + '%'), '财计卷的合规 ' + expected + '% 与方志同口径');
      assert.ok(html.includes('bk-circuit-yingzao'), '营造卷在册（开局无工役时写明）');
    });

    check('页脚动作经右栏同一个写入口写诏书建议，范围写明本道各州', () => {
      // 先数按钮再动作：VM 的模拟 DOM 对所有 id 返回同一个节点，诏书建议栏重画会覆盖册页内容（真浏览器里是两个节点）
      const d = JSON.parse(run(`(function(){
        TMPhase8FormalBridge.map.openCircuitDossier(__shuntian);
        var buttons = (__book().innerHTML.match(/data-bk-circuit-act="/g) || []).length;
        var before = (GM._edictSuggestions || []).length;
        var ok = __parts.circuitAction(__circuit.key, '巡按');
        var list = GM._edictSuggestions || [];
        return JSON.stringify({ ok: ok, added: list.length - before, last: list[list.length - 1] || null, buttons: buttons });
      })()`));
      assert.equal(d.buttons, 4, '整饬吏治、蠲免、巡按、任免');
      assert.equal(d.ok, true);
      assert.equal(d.added, 1);
      assert.equal(d.last.source, '行政区划');
      assert.equal(d.last.from, '北直隶');
      assert.equal(d.last.topic, '通志·巡按');
      assert.ok(d.last.content.includes('顺天府') && d.last.content.includes('11 府州'), '文案写明范围');
      assert.equal(d.last.used, false, '只进建议库，不直接生效');
      assert.equal(run(`__parts.circuitAction(__circuit.key, '抄家')`), false, '不认识的动作不写');
    });

    check('他方省道只看不动：标「他方所辖」，不给诏书动作', () => {
      const d = JSON.parse(run(`(function(){
        var MC = TM.MapCircuits, names = TMPhase8FormalBridge.rightrail.playerFactionNames();
        var foreign = null;
        __map.regions.some(function(r){
          var c = __parts.findCircuit(r);
          var mine = function(m){ var f = __parts.findFaction(m.owner, ''); return names.indexOf(String(m.owner)) >= 0 || !!(f && names.indexOf(String(f.name)) >= 0); };
          if (c && !c.members.some(mine)) { foreign = { circuit: c, region: r }; return true; }
          return false;
        });
        if (!foreign) return JSON.stringify({ found: false });
        TMPhase8FormalBridge.map.openCircuitDossier(foreign.region);
        var html = __book().innerHTML;
        return JSON.stringify({ found: true, label: foreign.circuit.label, hostile: html.includes('他方所辖'),
          acts: (html.match(/data-bk-circuit-act="/g) || []).length, write: __parts.circuitAction(foreign.circuit.key, '巡按') });
      })()`));
      assert.equal(d.found, true, '天启开局有不含玩家州的省道');
      assert.equal(d.hostile, true, d.label + ' 标他方所辖');
      assert.equal(d.acts, 0);
      assert.equal(d.write, false, '他方省道的动作即便被调用也不写诏书');
    });

    // 第四片起，方志页头的「道」签换成层级路径（势力 › 省道 › 本州）
    check('方志页头有层级路径，可点进势力谱牒与本道通志', () => {
      const html = run(`(function(){ __parts.openRegionDossier(__shuntian); return __book().innerHTML; })()`);
      const crumbs = html.slice(html.indexOf('bk-crumbs'), html.indexOf('bk-title-row'));
      assert.ok(crumbs.includes('data-bk-open-faction="'), '势力可点');
      assert.ok(crumbs.includes('data-bk-open-circuit="' + run('__circuit.key') + '"') && crumbs.includes('>北直隶</button>'), '省道可点');
      assert.ok(crumbs.includes('<b>顺天府</b>'), '末级是本州');
      assert.ok(!html.includes('道 <b>北直隶</b>'), '旧的「道」签已由层级路径取代');
    });

    // 第四片：方志轻调加并卷
    check('方志八卷并六卷：役政并入户役志，状态收进页头', () => {
      const d = JSON.parse(run(`(function(){
        __parts.openRegionDossier(__shuntian);
        var html = __book().innerHTML;
        return JSON.stringify({ juans: (html.match(/<section class="bk-juan" id="[^"]+"/g) || []).map(function(s){ return s.replace(/.*id="([^"]+)"/, '$1'); }),
          titles: (html.match(/<span class="bk-jseal">[^<]*<\\/span><b>[^<]*<\\/b>/g) || []).map(function(s){ return s.replace(/<[^>]+>/g, ''); }),
          jq: (html.match(/data-bk-jq="[^"]+"/g) || []).length, yizheng: html.indexOf('id="bk-yizheng"') >= 0, huyi: html.indexOf('户役志') >= 0 });
      })()`));
      assert.ok(d.juans.every((id) => ['bk-hukou', 'bk-caifu', 'bk-junbei', 'bk-zhiguan', 'bk-fengwu', 'bk-yingzao'].includes(id)), '只剩六卷：' + d.juans.join(','));
      assert.ok(!d.juans.includes('bk-yizheng') && !d.juans.includes('bk-zhuangkuang'), '役政、状态不再单成一卷');
      assert.equal(d.jq, d.juans.length, '检签与卷一一对应');
      assert.equal(d.huyi, true, '户口卷改名户役志');
      assert.ok(d.titles[0].startsWith('一户役志'), '户役志居首：' + d.titles.join(' '));
      // 天启开局已行役政的州，役政一节并在户役志里（保留 bk-yizheng 锚点）；未行役政的州没有这一节
      const seeded = run(`(function(){ var ld = __parts.findLiveAdminDivision(__shuntian); return !!(ld && ld.renliSeed); })()`);
      assert.equal(d.yizheng, seeded, '役政一节随役政种子');
    });

    check('读数带下有本道排名，页脚四个诏书动作只写建议库', () => {
      const d = JSON.parse(run(`(function(){
        __parts.openRegionDossier(__shuntian);
        var html = __book().innerHTML;
        var rank = html.slice(html.indexOf('bk-rankline'), html.indexOf('bk-scroll'));
        var buttons = (html.match(/data-bk-region-act="[^"]+"/g) || []).map(function(s){ return s.replace(/.*="([^"]+)"/, '$1'); });
        var before = (GM._edictSuggestions || []).length;
        var ok = __parts.regionAction(String(__shuntian.id || __shuntian.name), '调粮');
        var list = GM._edictSuggestions || [], last = list[list.length - 1] || null;
        var bad = __parts.regionAction(String(__shuntian.id || __shuntian.name), '抄家');
        return JSON.stringify({ rank: rank, buttons: buttons, ok: ok, added: list.length - before, last: last, bad: bad });
      })()`));
      assert.ok(d.rank.includes('>北直隶</button>') && d.rank.includes('本方 11 州中'), '排名写明本道本方州数');
      for (const k of ['户口', '实征', '民心', '吏治']) assert.match(d.rank, new RegExp(k + ' 第 \\d+'), k + '有名次');
      assert.deepEqual(d.buttons, ['安民', '巡按', '调粮', '拟诏']);
      assert.equal(d.ok, true);
      assert.equal(d.added, 1);
      assert.equal(d.last.source, '行政区划');
      assert.equal(d.last.from, '顺天府');
      assert.equal(d.last.topic, '方志·调粮');
      assert.ok(d.last.content.includes('顺天府'), '文案写明本州');
      assert.equal(d.last.used, false, '只进建议库，不直接生效');
      assert.equal(d.bad, false, '不认识的动作不写');
    });

    check('他方州县的方志不给诏书动作', () => {
      const d = JSON.parse(run(`(function(){
        var names = TMPhase8FormalBridge.rightrail.playerFactionNames();
        var foreign = __map.regions.filter(function(r){
          var f = __parts.findFaction(__parts.ownerKey(r), '');
          return __parts.ownerKey(r) && names.indexOf(String(__parts.ownerKey(r))) < 0 && !(f && names.indexOf(String(f.name)) >= 0);
        })[0];
        if (!foreign) return JSON.stringify({ found: false });
        __parts.openRegionDossier(foreign);
        var html = __book().innerHTML;
        return JSON.stringify({ found: true, acts: (html.match(/data-bk-region-act="/g) || []).length, write: __parts.regionAction(String(foreign.id || foreign.name), '安民') });
      })()`));
      assert.equal(d.found, true);
      assert.equal(d.acts, 0);
      assert.equal(d.write, false);
    });

    // 第三片：左键随层级开册页，设置可切回「一律开方志」，点省名恒按省道级
    check('左键随层级：天下开谱牒、省道开通志、府州开方志；设置可切回一律方志', () => {
      const d = JSON.parse(run(`(function(){
        var st = __parts.state, keep = st.mapScale, conf = P.conf || (P.conf = {}), keepConf = conf.mapClickFollowTier, out = {};
        function kindAt(tier, region, pick){ st.mapScale = tier; __parts.openTierDossier(region, pick); return __book().dataset.panelKind; }
        out.realm = kindAt('realm', __shuntian);
        out.region = kindAt('region', __shuntian);
        out.prefecture = kindAt('prefecture', __shuntian);
        st.mapScale = 'region';
        out.tipRegion = __parts.mapTipHtml(__shuntian);
        conf.mapClickFollowTier = false;
        out.regionOff = kindAt('region', __shuntian);
        out.labelOff = kindAt('region', __shuntian, 'region');
        out.tipOff = __parts.mapTipHtml(__shuntian);
        if (keepConf === undefined) delete conf.mapClickFollowTier; else conf.mapClickFollowTier = keepConf;
        // 不属正式省道的孤块在省道级照旧开方志
        var lone = __map.regions.filter(function(r){ return !__parts.findCircuit(r) && __parts.ownerKey(r); })[0];
        out.lone = lone ? kindAt('region', lone) : 'none';
        st.mapScale = keep;
        return JSON.stringify(out);
      })()`));
      assert.equal(d.realm, 'faction', '天下级开势力谱牒');
      assert.equal(d.region, 'circuit', '省道级开通志');
      assert.equal(d.prefecture, 'region', '府州级开方志');
      assert.ok(d.tipRegion.includes('左键 开通志') && d.tipRegion.includes('右键 选册页'), '签注页脚写明省道级左键开通志');
      assert.equal(d.regionOff, 'region', '设置切回后，省道级左键也开方志');
      assert.equal(d.labelOff, 'circuit', '点省名恒开通志，不受设置影响');
      assert.ok(d.tipOff.includes('左键 翻方志'), '设置切回后签注页脚随之改');
      // 天启开局有归属的地块都在正式省道里，没有孤块时这一条不适用
      if (d.lone !== 'none') assert.equal(d.lone, 'region', '不属正式省道的孤块在省道级照旧开方志');
    });

    check('整道外沿轮廓：成员之间的共享边相消，只剩外沿', () => {
      const d = JSON.parse(run(`(function(){
        var G = TMMapRealmLayout;
        var outline = G.boundaryMesh(__circuit.members.map(function(m){ return { region: m.region, owner: 'circuit', group: 'circuit' }; }), 'circuit-outline');
        var apart = G.boundaryMesh(__circuit.members.map(function(m, i){ return { region: m.region, owner: 'circuit', group: 'g' + i }; }), 'circuit-apart');
        return JSON.stringify({ d: outline.major.length, hidden: outline.hidden, edges: outline.majorCount + outline.minorCount, apartEdges: apart.majorCount + apart.minorCount });
      })()`));
      assert.ok(d.d > 0, '外沿轮廓非空');
      assert.ok(d.hidden > 0, '州与州之间的共享边被消去');
      assert.ok(d.edges < d.apartEdges, '外沿边数少于各州分开描时的边数');
    });

    // VM 的模拟节点不实现 classList 与属性增删，关闭与刷新只能查源码；真浏览器里的行为由第五片的 Electron 验收覆盖
    check('源码约束：关闭册页清掉通志标记，回合刷新会重画通志', () => {
      const map = fs.readFileSync(path.join(WEB, 'phase8-formal-map.js'), 'utf8');
      const refresh = map.slice(map.indexOf('function refreshMapPpop'), map.indexOf('function refreshMapFromRuntime'));
      assert.match(refresh, /panelKind === 'circuit'[^\n]*openCircuitDossier\(pop\.dataset\.circuitKey/, '回合刷新时按省道 key 重画通志');
      const dossier = fs.readFileSync(path.join(WEB, 'phase8-formal-map-dossier.js'), 'utf8');
      const close = dossier.slice(dossier.indexOf('function closeMapDossier'), dossier.indexOf('function closeMapDossier') + 700);
      assert.match(close, /classList\.remove\([^)]*'circuit-panel'/, '关闭时去掉 circuit-panel');
      assert.match(close, /removeAttribute\('data-circuit-key'\)/, '关闭时清掉省道 key');
    });

    // 第六片：改隶。入口只生成诏书建议；落地经回合末写工具，三处同步后通志与地图分组随之改
    check('改隶入口：方志「改隶」列候选、首府只给说明，通志「调整辖区」列划出划入，选定只写建议库', () => {
      const d = JSON.parse(run(`(function(){
        var DR = TM.DivisionReassign, own = TM.MapCircuits.partitionByOwner(__circuit, __parts.canonicalOwnerKey(__shuntian)).own;
        var mover = own.filter(function(r){ return r !== __shuntian && DR.movable(r, {}).ok && DR.targetsFor(r, {}).some(function(t){ return t.adjacent; }); })[0];
        var target = mover && DR.targetsFor(mover, {}).filter(function(t){ return t.adjacent; })[0];
        __parts.openRegionDossier(mover);
        var foot = __book().innerHTML;
        var before = (GM._edictSuggestions || []).length;
        var ok = __parts.reassignSuggest(String(mover.id), target.key);
        var list = GM._edictSuggestions || [], last = list[list.length - 1] || null;
        return JSON.stringify({ mover: mover && mover.name, target: target, footHasBtn: foot.indexOf('data-bk-reassign-open="region"') >= 0, slot: foot.indexOf('bk-reassign-slot') >= 0,
          capitalPanel: __parts.regionReassignPanel(__shuntian), moverPanel: __parts.regionReassignPanel(mover), circuitPanel: __parts.circuitReassignPanel(__circuit),
          ok: ok, added: list.length - before, last: last, parent: String(mover.parentId) });
      })()`));
      assert.ok(d.mover && d.target, '北直隶有可改出的州与接壤的本方别道');
      assert.equal(d.footHasBtn, true, '方志页脚有「改隶」');
      assert.equal(d.slot, true, '候选面板插槽在页脚上方');
      assert.ok(d.capitalPanel.includes('首府') && !d.capitalPanel.includes('data-bk-reassign-to'), '首府只给说明，不给候选');
      assert.ok(d.moverPanel.includes('data-bk-reassign-to="' + d.target.key + '"'), '非首府之州列出候选省道');
      assert.ok(d.circuitPanel.includes('划出本道') && !d.circuitPanel.includes('data-bk-reassign-region="' + run('String(__shuntian.id)') + '"'), '通志「调整辖区」列划出，首府不在其中');
      assert.equal(d.ok, true);
      assert.equal(d.added, 1);
      assert.equal(d.last.source, '行政区划');
      assert.equal(d.last.from, d.mover);
      assert.equal(d.last.topic, '改隶·' + d.target.label);
      assert.ok(d.last.content.includes('改隶' + d.mover + '于' + d.target.label) && d.last.content.includes('原隶北直隶'), d.last.content);
      assert.equal(d.last.used, false, '只进建议库');
      assert.equal(d.parent, run('__circuit.key'), '录入建议不改世界');
    });

    check('改隶落地：回合末写工具经同一写口三处同步，通志与地图分组随之改', () => {
      const d = JSON.parse(run(`(function(){
        var DR = TM.DivisionReassign, WT = TM.Endturn.AgentWriteTools;
        var own = TM.MapCircuits.partitionByOwner(__circuit, __parts.canonicalOwnerKey(__shuntian)).own;
        var mover = own.filter(function(r){ return r !== __shuntian && DR.movable(r, {}).ok && DR.targetsFor(r, {}).some(function(t){ return t.adjacent; }); })[0];
        var target = DR.targetsFor(mover, {}).filter(function(t){ return t.adjacent; })[0];
        var toName = (GM.mapData.circuitRegistry.filter(function(e){ return (e.key || e.id) === target.key; })[0] || {}).name;
        var res = WT.handleSync('restructure_division', { action: 'modify', region: mover.name, fields: { parentId: toName }, reason: '奉旨改隶' }, { GM: GM });
        var after = __parts.findCircuit(mover), bei = __parts.findCircuit(__shuntian);
        return JSON.stringify({ ok: res.ok, text: res.text, adapter: res.result && res.result.adapter, mover: mover.name, target: target,
          newKey: after && after.key, beiCount: TM.MapCircuits.partitionByOwner(bei, __parts.canonicalOwnerKey(__shuntian)).own.length,
          inReg: GM.mapData.circuitRegistry.filter(function(e){ return (e.key || e.id) === target.key; })[0].memberRegionIds.indexOf(mover.id) >= 0,
          sameMap: GM.mapData === P.map });
      })()`));
      assert.equal(d.ok, true, d.text);
      assert.equal(d.adapter, 'TM.DivisionReassign');
      assert.equal(d.newKey, d.target.key, '通志按新省道取成员');
      assert.equal(d.beiCount, 10, '北直隶本方剩 10 州');
      assert.equal(d.inReg, true, '新道登记收入此州');
      assert.equal(d.sameMap, true, '改的是运行时唯一那份地图');
    });

    console.log('[smoke-map-circuit-book] ' + checks.length + ' 组检查全部通过');
    checks.forEach((name) => console.log('  ok · ' + name));
    process.exit(0);
  } catch (error) {
    console.error('[smoke-map-circuit-book] FAIL', error && error.stack || error);
    process.exit(1);
  }
}, 300);
