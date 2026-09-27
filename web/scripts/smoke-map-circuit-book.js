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

const { bantuSnapshot, bantuMarkup, assertBantuConservation } = require('./lib-map-circuit-bantu.js');

setTimeout(async () => {
  try {
    // 浏览器里省道分组来自按需加载的地名模块；VM 不跑按需加载，这里直接装入它的布局脚本
    vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-map-realm-layout.js'), 'utf8'), c, { filename: 'tm-map-realm-layout.js' });
    const run = (code) => vm.runInContext(code, c, { timeout: 60000 });

    run(`
      // 默认 VM 把各 id 共用一个节点；单独隔离册页，让点击只到达实际册页委托。
      var __bookNode = document.createElement('div'), __oldGetById = document.getElementById;
      document.getElementById = function(id){ return id === 'ppop' ? __bookNode : __oldGetById.call(document, id); };
      var __parts = TMPhase8FormalBridge.__p8MapParts;
      var __map = GM.mapData;
      var __shuntian = __map.regions.filter(function(r){ return /顺天/.test(r.name || ''); })[0];
      var __circuit = __parts.findCircuit(__shuntian);
      var __book = function(){ return document.getElementById('ppop'); };
    `);

    check('开册批次内外：明朝廷全部地块的装配值与户籍视图逐块全等', () => {
      const d = JSON.parse(run(`(function(){
        var f = __parts.findFaction('明朝廷', '');
        var regions = __map.regions.filter(function(r){ return __parts.factionOwnsRegion(r, '明朝廷', f); });
        function populationOptions(r){ return { root: GM, region: __parts.findLiveAdminDivision(r) || r.id, factionId: __parts.ownerKey(r) }; }
        var outside = regions.map(function(r){ return {
          id: r.id, bundle: JSON.stringify(__parts.regionBundle(r)), population: JSON.stringify(HujiEngine.getPopulationView(populationOptions(r)))
        }; });
        var reused = true;
        var inside = __parts.withRenderBatch(function(){
          var groups = HujiEngine.factionLeafGroups(GM);
          return regions.map(function(r){
            var bundle = __parts.regionBundle(r), options = populationOptions(r);
            reused = reused && bundle === __parts.regionBundle(r);
            options.leafGroups = groups;
            return { id: r.id, bundle: JSON.stringify(bundle), population: JSON.stringify(HujiEngine.getPopulationView(options)) };
          });
        });
        return JSON.stringify({ outside: outside, inside: inside, reused: reused });
      })()`));
      assert.ok(d.outside.length > 0, '确有明朝廷地块，逐块对比不空跑');
      assert.equal(d.inside.length, d.outside.length);
      d.outside.forEach((row, i) => {
        assert.equal(d.inside[i].id, row.id);
        assert.equal(d.inside[i].bundle, row.bundle, row.id + ' regionBundle 的 JSON.stringify 全等');
        assert.equal(d.inside[i].population, row.population, row.id + ' 同 region、同 factionId 的人口视图全等');
      });
      assert.equal(d.reused, true, '同批次按地块对象身份复用装配值');
      console.log('[render-batch] 明朝廷逐块全等 regions=' + d.outside.length);
    });

    check('跨次开册不吃旧数：同回合改现行户口，谱牒读数随之变化并可恢复', () => {
      const d = JSON.parse(run(`(function(){
        // 天启沿用旧户口口径，现行省账的数值 population 覆盖 populationDetail.mouths。
        // findLiveProvinceStats 返回浅副本，须改 GM 中同键的原记录，验完恢复。
        var stats = __parts.findLiveProvinceStats(__shuntian), current = GM.provinceStats[stats._provinceKey];
        var keep = current.population, delta = 1000000, out = { field: 'GM.provinceStats[' + stats._provinceKey + '].population', delta: delta };
        if (typeof keep !== 'number' || !isFinite(keep)) throw new Error('顺天府现行户口字段缺失');
        function readBook(){
          __parts.openFactionDossier('明朝廷', null);
          var value = __book().innerHTML.split('<span class="k">户口</span><span class="v">')[1];
          if (!value) throw new Error('谱牒户口读数缺失');
          return value.split('<')[0];
        }
        try {
          out.before = readBook();
          out.regionBefore = Number(__parts.regionBundle(__shuntian).data.population);
          current.population = keep + delta;
          out.after = readBook();
          out.regionAfter = Number(__parts.regionBundle(__shuntian).data.population);
        } finally {
          current.population = keep;
        }
        out.restored = readBook();
        out.regionRestored = Number(__parts.regionBundle(__shuntian).data.population);
        return JSON.stringify(out);
      })()`));
      assert.equal(d.regionAfter - d.regionBefore, d.delta, '现行户口变化进入下一次开册');
      assert.notEqual(d.after, d.before, '谱牒户口读数同步变化');
      assert.equal(d.restored, d.before, '恢复户口后谱牒读数复原');
      assert.equal(d.regionRestored, d.regionBefore);
      console.log('[render-batch] 户口字段=' + d.field + ' 谱牒=' + d.before + ' -> ' + d.after + ' -> ' + d.restored);
    });

    check('批次不外泄：三类册页、嵌套与异常结束后均恢复现算和军队签名检查', () => {
      const d = JSON.parse(run(`(function(){
        var originalView = HujiEngine.getPopulationView, originalGroups = HujiEngine.factionLeafGroups;
        var locations = TMMapLocations, originalRead = locations.read;
        var reads = 0, groupCalls = 0, views = [], out = { after: [] };
        HujiEngine.getPopulationView = function(options){
          views.push({ supplied: Object.prototype.hasOwnProperty.call(options, 'leafGroups'), groups: options.leafGroups });
          return originalView.apply(this, arguments);
        };
        HujiEngine.factionLeafGroups = function(){ groupCalls += 1; return originalGroups.apply(this, arguments); };
        locations.read = function(entity, kind){ if (kind === 'army') reads += 1; return originalRead.apply(this, arguments); };
        function outside(label){
          reads = 0; views = [];
          var first = __parts.regionBundle(__shuntian), second = __parts.regionBundle(__shuntian);
          out.after.push({ label: label, distinct: first !== second, reads: reads, views: views.length,
            supplied: views.some(function(v){ return v.supplied; }) });
        }
        try {
          out.strict = locations.enabled(__map);
          out.armies = GM.armies.length;
          __parts.openRegionDossier(__shuntian); outside('方志');
          __parts.openFactionDossier('明朝廷', null); outside('谱牒');
          __parts.openCircuitDossier(__circuit.key, __shuntian); outside('通志');
          // 前面的开册已暖好旧军队缓存；命中旧签名时也必须将它放进本批次。
          reads = 0; views = []; groupCalls = 0;
          var firstBatch;
          __parts.withRenderBatch(function(){
            firstBatch = __parts.regionBundle(__shuntian);
            out.nested = __parts.withRenderBatch(function(){ return __parts.regionBundle(__shuntian); }) === firstBatch;
            var other = __circuit.members.map(function(m){ return m.region; }).filter(function(r){ return r !== __shuntian; })[0];
            __parts.regionBundle(other);
            // 同 id 的另一个对象不能误命中对象身份缓存。
            out.identity = __parts.regionBundle(Object.assign({}, __shuntian)) !== firstBatch;
          });
          out.batch = { reads: reads, groupCalls: groupCalls, views: views.length,
            shared: views.every(function(v){ return v.supplied && Array.isArray(v.groups) && v.groups === views[0].groups; }) };
          out.nextFresh = __parts.withRenderBatch(function(){ return __parts.regionBundle(__shuntian); }) !== firstBatch;
          outside('显式批次');
          var marker = new Error('批次清理探针');
          try { __parts.withRenderBatch(function(){ __parts.regionBundle(__shuntian); throw marker; }); }
          catch (error) { out.rethrown = error === marker; }
          outside('异常批次');
        } finally {
          HujiEngine.getPopulationView = originalView;
          HujiEngine.factionLeafGroups = originalGroups;
          locations.read = originalRead;
        }
        return JSON.stringify(out);
      })()`));
      assert.equal(d.strict, true, '真实天启启用军队地名解析');
      assert.ok(d.armies > 0, '有军队，签名检查不空跑');
      for (const row of d.after) {
        assert.equal(row.distinct, true, row.label + '结束后两次装配互不复用');
        assert.equal(row.views, 2, row.label + '结束后两次均重取户籍视图');
        assert.equal(row.supplied, false, row.label + '结束后不再传 leafGroups');
        assert.equal(row.reads, d.armies * 2, row.label + '结束后仍每次重算全图军队签名');
      }
      assert.equal(d.nested, true, '嵌套批次复用外层缓存');
      assert.equal(d.identity, true, '按对象身份缓存，不按 id 缓存');
      assert.equal(d.batch.reads, d.armies, '旧军队缓存命中后，本批次只算一次签名');
      assert.equal(d.batch.groupCalls, 1, '本批次只走一次户籍叶子分组');
      assert.equal(d.batch.views, 3, '三个不同地块对象各装配一次');
      assert.equal(d.batch.shared, true, '批次内传同一份叶子分组');
      assert.equal(d.nextFresh, true, '下一批次重新装配');
      assert.equal(d.rethrown, true, '异常原样抛出且清理批次');
    });

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
      // 先数按钮再动作；册页已用独立节点，建议栏重画不会覆盖本次读数。
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
        // 全图逐州查省道时先建一次索引，免得每州都重算全图归属签名
        var index = MC.indexCircuits(__map, { layout: TMMapRealmLayout, ownerOf: __parts.canonicalOwnerKey });
        __map.regions.some(function(r){
          var c = __parts.findCircuit(r, index);
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

    // 通志一期补：谱牒版图按省道分组，先验真实天启开局，再验证委托与旧地图退化。
    const mingBantu = bantuSnapshot(run, '明朝廷');
    const mingMarkup = bantuMarkup(mingBantu);
    check('天启明朝廷版图：省道组数、州签集合守恒，各组链接与叶子汇总相符并按户口排序', () => {
      assertBantuConservation(mingBantu, mingMarkup);
      const expected = [...mingBantu.groups].sort((a, b) => b.population - a.population || a.label.localeCompare(b.label, 'zh-CN'));
      assert.deepEqual(mingMarkup.groups.filter((g) => g.key).map((g) => g.key), expected.map((g) => g.key), '户口降序，同户口按省道名');
      const summary = '省道 ' + expected.length + ' 个' + (mingBantu.none.length ? ' · 未设省道 ' + mingBantu.none.length + ' 块' : '');
      assert.ok(mingMarkup.html.includes('<div class="bk-bantu-sum">' + summary + '</div>'), '概数文案准确');
      for (const group of mingMarkup.groups) {
        assert.doesNotMatch(group.attrs, /\bopen(?:\s|=|$)/, '分组默认收起');
        if (!group.key) {
          assert.equal(group, mingMarkup.groups[mingMarkup.groups.length - 1], '未设省道永远最后');
          assert.deepEqual([...group.ids].sort(), [...mingBantu.none].sort());
          continue;
        }
        const row = expected.find((g) => g.key === group.key);
        assert(row, '分组来自正式省道');
        assert.deepEqual([...group.html.matchAll(/data-bk-open-circuit="([^"]+)"/g)].map((m) => m[1]), [group.key], '行首省名打开本组通志');
        assert.deepEqual([...group.ids].sort(), [...row.ids].sort(), '每组只含本方府州');
        assert.ok(group.html.includes('<span class="bd-n">' + row.count + '/' + row.total + ' 州</span>'), '本方/全道计数');
        assert.deepEqual([...group.html.matchAll(/<span class="bd-v">([\s\S]*?)<\/span>/g)].map((m) => m[1]), row.values, '汇总读数、等级、警色与通志同口径');
      }
    });

    check('谱牒版图省名沿用现有点击委托，打开同 key 通志', () => {
      const key = mingMarkup.groups[0].key;
      const d = JSON.parse(run(`(function(){
        var pop = __book(), key = ${JSON.stringify(key)};
        var button = { dataset: { bkOpenCircuit: key }, closest: function(sel){ return sel === '[data-bk-open-circuit]' ? this : null; } };
        var event = { target: button, preventDefault: function(){}, stopPropagation: function(){} };
        (pop._listeners.click || []).slice().forEach(function(fn){ fn.call(pop, event); });
        return JSON.stringify({ kind: pop.dataset.panelKind, key: pop.dataset.circuitKey, html: pop.innerHTML });
      })()`));
      assert.equal(d.kind, 'circuit');
      assert.equal(d.key, key);
      assert.ok(d.html.includes('通 志'));
    });

    check('无正式省道的势力保持原平铺：没有省道概数和 details', () => {
      // 天启有归属地块已全登记：在同一真实开局中保留一个他方州、暂去登记，构成缺层级旧地图；验完恢复。
      run(`var __keepBantuRegions = __map.regions, __keepBantuRegistry = __map.circuitRegistry;
        var __loneBantuRegion = __map.regions.filter(function(r){ return !__parts.factionOwnsRegion(r, '明朝廷', __parts.findFaction('明朝廷', '')); })[0];
        __map.regions = [__loneBantuRegion]; __map.circuitRegistry = [];`);
      try {
        const key = run('__parts.canonicalOwnerKey(__loneBantuRegion)');
        const snapshot = bantuSnapshot(run, key), parsed = bantuMarkup(snapshot);
        assert.equal(snapshot.groups.length, 0, '该势力确实没有正式省道');
        assert.equal(snapshot.ids.length, 1, '该势力有地块，退化断言不空跑');
        assert.doesNotMatch(parsed.html, /bk-bantu-sum|bk-bantu-dao|<details/);
        assert.deepEqual(parsed.ids, snapshot.ids);
        const expected = run(`'<div class="bk-qian-links"><button type="button" class="bk-qian" data-bk-open-region="' + __loneBantuRegion.id + '">' + __parts.esc(__parts.regionTitle(__loneBantuRegion)) + '</button></div>'`);
        assert.ok(parsed.html.includes(expected), '平铺州签保持原标记');
      } finally {
        run('__map.regions = __keepBantuRegions; __map.circuitRegistry = __keepBantuRegistry;');
      }
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
        var index = TM.MapCircuits.indexCircuits(__map, { layout: TMMapRealmLayout, ownerOf: __parts.canonicalOwnerKey });
        var lone = __map.regions.filter(function(r){ return !__parts.findCircuit(r, index) && __parts.ownerKey(r); })[0];
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

    // 绍宋大宋的版图守恒拆到 smoke-map-circuit-book-shaosong.js：一个文件只开一局，免得全量测试里超 120 秒
    console.log('[smoke-map-circuit-book] ' + checks.length + ' 组检查全部通过');
    checks.forEach((name) => console.log('  ok · ' + name));
    process.exit(0);
  } catch (error) {
    console.error('[smoke-map-circuit-book] FAIL', error && error.stack || error);
    process.exit(1);
  }
}, 300);
