// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-edict-complete.js — 诏令系统补完
 *
 * 实施：
 *  - 设计方案-诏令识别补完.md P1 次级虚空（改土归流/迁都/边疆开发/户口清查）
 *  - 设计方案-诏令识别补完.md 11 类奏疏反向触发规则引擎
 *  - 设计方案-制度设计与演化.md Help 页面"诏书问对"6 主题
 *  - 设计方案-制度设计与演化.md 自动分流（tryExecute → 自动调 submitToMemorial/askForClarification）
 *  - 补完各子系统 aiEntry 执行逻辑
 *  - 抗疏 UI 处理选项
 *  - 游戏模式 × 贪腐提示三模式
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  11 类奏疏反向触发规则
  // ═══════════════════════════════════════════════════════════════════

  var MEMORIAL_TRIGGERS = [
    { id:'flood_relief',    name:'水灾赈济疏',     test:function(G){ return G.vars && G.vars.disasterLevel > 0.35 && G.vars.disasterType === 'flood'; },
      drafter:'工部尚书', typeKey:'corvee_reform', subject:'请发银赈济水灾' },
    { id:'drought_relief',  name:'旱荒赈济疏',     test:function(G){ return G.vars && G.vars.disasterLevel > 0.35 && G.vars.disasterType === 'drought'; },
      drafter:'户部尚书', typeKey:'corvee_reform', subject:'请蠲免旱区赋役' },
    { id:'fugitive_clean',  name:'清查逃户疏',     test:function(G){ return G.population && G.population.fugitives > G.population.national.mouths * 0.05; },
      drafter:'户部尚书', typeKey:'huji_reform', subject:'请整饬黄册清查逃户' },
    { id:'border_alert',    name:'边警告急疏',     test:function(G){ return G.activeWars && G.activeWars.length > 0; },
      drafter:'兵部尚书', typeKey:'military_reform', subject:'请拨饷增兵以御边' },
    { id:'corruption_clean',name:'整饬吏治疏',     test:function(G){ return G.corruption && G.corruption.overall > 55; },
      drafter:'御史大夫', typeKey:'office_reform', subject:'请严惩墨吏正肃纲纪' },
    { id:'annex_critical',  name:'均田抑兼并疏',   test:function(G){ return G.landAnnexation && G.landAnnexation.concentration > 0.6; },
      drafter:'户部尚书', typeKey:'huji_reform', subject:'请均田以抑兼并' },
    { id:'currency_crisis', name:'钱荒救急疏',     test:function(G){ return G.currency && G.currency.market && G.currency.market.moneySupplyRatio && G.currency.market.moneySupplyRatio < 0.5; },
      drafter:'户部尚书', typeKey:'currency_reform', subject:'请铸新钱解钱荒' },
    { id:'eco_overload',    name:'减徭安民疏',     test:function(G){ return G.environment && G.environment.nationalLoad > 1.25; },
      drafter:'工部尚书', typeKey:'corvee_reform', subject:'请减大役以息民' },
    { id:'warlord_rise',    name:'削藩奏',         test:function(G){ return G.fiscal && G.fiscal.regions && Object.values(G.fiscal.regions).some(function(r){return r.autonomyLevel>0.7;}); },
      drafter:'宰相', typeKey:'office_reform', subject:'请削藩镇之权' },
    { id:'famine_migration',name:'招抚流民疏',     test:function(G){ return G.population && G.population.byLegalStatus.taoohu && G.population.byLegalStatus.taoohu.mouths > 300000; },
      drafter:'户部尚书', typeKey:'huji_reform', subject:'请招抚流民复业' },
    { id:'annual_fu_yi',    name:'年度赋役总纲',   test:function(G){ return (G.month || 1) === 1 && G.turn > 1; },
      drafter:'户部尚书', typeKey:'tax_reform', subject:'本年赋役总纲奏' }
  ];

  function _checkMemorialTriggers(ctx) {
    var G = global.GM;
    if (!G._pendingMemorials) G._pendingMemorials = [];
    MEMORIAL_TRIGGERS.forEach(function(t) {
      try {
        if (!t.test(G)) return;
        // 避免 30 回合内重复
        var recent = G._pendingMemorials.some(function(m) { return m.triggerId === t.id && (ctx.turn - m.turn) < 30; });
        if (recent) return;
        var memo = {
          id: 'trig_' + ctx.turn + '_' + Math.floor(Math.random()*10000),
          typeKey: t.typeKey,
          typeName: t.name,
          subject: t.subject,
          drafter: t.drafter,
          turn: ctx.turn,
          expectedReturnTurn: ctx.turn,
          status: 'drafted',
          draftText: t.drafter + '奏：' + t.subject + '。事急，伏乞圣裁速决。',
          triggerId: t.id,
          _autoTrigger: true
        };
        G._pendingMemorials.push(memo);
        if (global.addEB) global.addEB('反奏', '【反触】' + t.drafter + '急奏：' + t.name);
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'trigger') : console.error('[trigger]', t.id, e); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  P1 次级虚空 — 改土归流/迁都/边疆开发/户口清查
  // ═══════════════════════════════════════════════════════════════════

  var P1_EDICT_TYPES = {
    gaitu_guiliu: {
      name: '改土归流',
      drafter: '兵部尚书',
      requiredFields: ['targetTusi', 'replacementOfficial'],
      keywords: /改土归流|废.*土司|流官|裁土/,
      aiEntry: function(params) {
        var G = global.GM;
        if (!G.population || !G.population.jimiHoldings) return false;
        var target = G.population.jimiHoldings.find(function(h) { return h.name === params.targetTusi || h.id === params.targetTusi; });
        if (!target) return false;
        // 转为普通 region
        G.population.jimiHoldings = G.population.jimiHoldings.filter(function(h) { return h !== target; });
        // 增加编户
        if (G.population.byCategory.bianhu) {
          G.population.byCategory.bianhu.mouths += 50000;
          G.population.byCategory.bianhu.households += 10000;
        }
        // 可能触发抗乱
        if (Math.random() < 0.3) {
          if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + 5);
        }
        if (global.addEB) global.addEB('改土归流', target.name + ' 改为流官管辖');
        return true;
      }
    },
    move_capital: {
      name: '迁都',
      drafter: '宰相',
      requiredFields: ['newCapital', 'timeline'],
      keywords: /迁都|徙都|建.*为都/,
      aiEntry: function(params) {
        var G = global.GM;
        if (!params.newCapital) return false;
        var oldCap = G._capital;
        G._capital = params.newCapital;
        // 京畿虹吸目标改变；大量人口流动
        if (G.population && G.population.byRegion) {
          if (G.population.byRegion[params.newCapital]) {
            G.population.byRegion[params.newCapital].mouths += 200000;
          }
        }
        if (global.addEB) global.addEB('迁都', '由 ' + oldCap + ' 迁都至 ' + params.newCapital);
        return true;
      }
    },
    frontier_dev: {
      name: '边疆开发',
      drafter: '户部尚书',
      requiredFields: ['frontierRegion', 'devType'],
      keywords: /开发.*边|垦.*边|屯田.*边|移民.*边/,
      aiEntry: function(params) {
        var G = global.GM;
        if (!G.population) return false;
        if (!G.population.militaryFarms) G.population.militaryFarms = [];
        G.population.militaryFarms.push({
          id: 'frontier_' + (G.turn||0),
          name: params.frontierRegion + '屯',
          region: params.frontierRegion,
          acres: params.acres || 200000,
          garrison: params.garrison || 10000,
          yieldAnnual: (params.acres || 200000) * 0.5
        });
        if (G.guoku) G.guoku.money = Math.max(0, G.guoku.money - 100000);
        if (global.addEB) global.addEB('边疆', '开发 ' + params.frontierRegion);
        return true;
      }
    },
    huji_cleanup: {
      name: '户口清查',
      drafter: '户部尚书',
      requiredFields: ['scope', 'method'],
      keywords: /清查.*户|大造黄册|核实.*口|编审/,
      aiEntry: function(params) {
        var G = global.GM;
        if (!G.population || !G.population.meta) return false;
        G.population.meta.lastRegistrationTurn = 0;
        // 提前准确度
        G.population.meta.registrationAccuracy = Math.min(1.0, G.population.meta.registrationAccuracy + 0.1);
        // 发现隐户
        var discovered = Math.round((G.population.hiddenCount || 0) * 0.5);
        G.population.hiddenCount = Math.max(0, G.population.hiddenCount - discovered);
        if (G.population.byLegalStatus.huangji) G.population.byLegalStatus.huangji.households += discovered;
        if (global.addEB) global.addEB('户口', '大清查发现隐户 ' + discovered + ' 户');
        return true;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  自动路由补丁 — 扩展 EdictParser.tryExecute
  // ═══════════════════════════════════════════════════════════════════

  function _enhancedTryExecute(text, params, ctx, origFn) {
    if (typeof global.EdictParser === 'undefined') return { ok: false, reason: 'EdictParser 未加载' };
    var P = global.EdictParser;
    // 先检测 P1 类型
    var p1Match = null;
    Object.keys(P1_EDICT_TYPES).forEach(function(k) {
      if (P1_EDICT_TYPES[k].keywords.test(text)) p1Match = k;
    });
    if (p1Match) {
      var exec = P1_EDICT_TYPES[p1Match].aiEntry(params || {});
      return { ok: exec, pathway: 'direct', typeKey: p1Match, isP1: true };
    }
    // 原路径·必须用 origFn 而非 P.tryExecute（后者已被包装为 enhanced·会死循环）
    var result = origFn ? origFn.call(P, text, params, ctx) : { ok: false, reason: 'orig unavailable' };
    if (result.ok) return result;
    if (result.classification && result.classification.pathway === 'memorial') {
      var memo = P.submitToMemorial(text, result.classification);
      return { ok: true, pathway: 'memorial', memo: memo };
    }
    if (result.classification && result.classification.pathway === 'ask') {
      var clar = P.askForClarification(text, result.classification);
      return { ok: true, pathway: 'ask', clarification: clar };
    }
    return result;
  }

  // 猴补 EdictParser.tryExecute
  function _patchTryExecute() {
    if (typeof global.EdictParser === 'undefined') return;
    if (global.EdictParser._enhanced) return;
    var orig = global.EdictParser.tryExecute;
    global.EdictParser.tryExecute = function(text, params, ctx) {
      return _enhancedTryExecute(text, params, ctx, orig);
    };
    global.EdictParser._enhanced = true;
    global.EdictParser.P1_EDICT_TYPES = P1_EDICT_TYPES;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Help 页面「诏书问对」6 主题 UI
  // ═══════════════════════════════════════════════════════════════════

  var HELP_TOPICS = {
    currency: {
      name: '货币改革',
      intro: '铸币、改制、发钞、废钞皆走此。必含币种/重量/成色/官铸机构四要素。',
      examples: [
        '铸五铢钱，重五铢，上林三官造',
        '发交子于蜀，十年一界，准备金足',
        '减铸小钱当千，以纾军用',
        '废宝钞，改行白银'
      ],
      tips: '成色低则民弃之，私铸兴。发钞无准备金必崩。历代铸币 → CurrencyEngine.REFORM_PRESETS 可参。'
    },
    tax: {
      name: '税种设立',
      intro: '新税种须含：税基（田/丁/商/关）+ 税率 + 豁免对象。',
      examples: [
        '立算赋，每丁岁一百二十钱',
        '置商税，百抽三，商户登记',
        '开市舶司，海商百抽十',
        '行两税法，夏秋两征'
      ],
      tips: '过高赋役 → 逃户 → 税基流失。参考「一条鞭法」折银改革。'
    },
    huji: {
      name: '户籍制度',
      intro: '编户/黄册/保甲/色目皆此类。',
      examples: [
        '编户齐民，什伍连坐',
        '造黄册，十年一大造',
        '推行保甲，十户一牌',
        '摊丁入亩，永不加赋'
      ],
      tips: '清查频率影响税基透明度。重造黄册费钱但扫隐户。'
    },
    corvee: {
      name: '徭役改革',
      intro: '三路径：均役（分摊）/折银（雇佣代役）/摊入田赋。',
      examples: [
        '立均徭，丁岁三十日',
        '行一条鞭法，役银合一',
        '摊丁入亩，役尽归田'
      ],
      tips: '大徭役死亡率 > 30% 必民变。折银仅宜商贸发达地。'
    },
    military: {
      name: '兵制改革',
      intro: '七类兵制各有条件：府兵需均田、募兵需军饷、卫所需世袭军户。',
      examples: [
        '立府兵，府兵轮番宿卫',
        '行募兵制，月饷二两',
        '建卫所，军户世袭',
        '立团练，绅士领兵'
      ],
      tips: '马政决定骑兵上限。兵权旁落 → 藩镇自立。'
    },
    office: {
      name: '官制设立',
      intro: '新设机构须含：名称/品级/职事/员额/上司。',
      examples: [
        '立三省六部',
        '置节度使',
        '设内阁大学士',
        '置总督巡抚'
      ],
      tips: '同职位多则政出多门。冗官冗费 → 帑廪压力。'
    }
  };

  function openEdictHelp(topicKey) {
    var topic = HELP_TOPICS[topicKey];
    var body = '<div style="max-width:680px;font-family:inherit;">';
    body += '<div style="font-size:1.1rem;color:var(--gold-300);margin-bottom:0.8rem;letter-spacing:0.1em;">诏书问对</div>';
    // Tab 导航
    body += '<div style="display:flex;gap:4px;margin-bottom:0.8rem;border-bottom:1px solid var(--bdr);">';
    Object.keys(HELP_TOPICS).forEach(function(k) {
      var active = k === topicKey ? 'background:var(--gold-d);color:#fff;' : 'background:var(--bg-2);color:var(--txt-s);';
      body += '<button onclick="openEdictHelp(\'' + k + '\');this.closest(\'div[style*=position]\').remove();" style="padding:6px 14px;cursor:pointer;border:1px solid var(--bdr);border-bottom:none;' + active + '">' + HELP_TOPICS[k].name + '</button>';
    });
    body += '</div>';
    if (topic) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.4rem;">' + topic.name + ' · 通则</div>';
      body += '<div style="font-size:0.82rem;color:var(--ink-200);padding:8px 12px;background:var(--bg-2);border-radius:4px;margin-bottom:0.6rem;">' + topic.intro + '</div>';
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.4rem;">诏书范例</div>';
      body += '<div style="font-size:0.78rem;line-height:1.8;padding:8px 12px;background:var(--bg-2);border-radius:4px;margin-bottom:0.6rem;">';
      topic.examples.forEach(function(e) { body += '· ' + e + '<br>'; });
      body += '</div>';
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:0.4rem;">要旨</div>';
      body += '<div style="font-size:0.78rem;color:var(--celadon-300);padding:8px 12px;background:var(--bg-2);border-radius:4px;font-style:italic;">' + topic.tips + '</div>';
    }
    // 30 典范索引（含剧本自定义覆盖）
    if (typeof global.EdictParser !== 'undefined' && (global.EdictParser.HISTORICAL_EDICT_PRESETS || typeof global.EdictParser.getHistoricalEdictPresets === 'function')) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:0.8rem 0 0.4rem;">历代典范</div>';
      body += '<div style="font-size:0.72rem;max-height:200px;overflow-y:auto;padding:8px 12px;background:var(--bg-2);border-radius:4px;">';
      var relevantType = topicKey === 'currency' ? 'currency_reform' : topicKey === 'tax' ? 'tax_reform' : topicKey === 'huji' ? 'huji_reform' : topicKey === 'corvee' ? 'corvee_reform' : topicKey === 'military' ? 'military_reform' : topicKey === 'office' ? 'office_reform' : null;
      var _presets = (typeof global.EdictParser.getHistoricalEdictPresets === 'function')
        ? global.EdictParser.getHistoricalEdictPresets()
        : (global.EdictParser.HISTORICAL_EDICT_PRESETS || []);
      _presets.filter(function(e) { return !relevantType || e.type === relevantType; }).forEach(function(e) {
        body += '· <b>[' + e.dynasty + ']</b> ' + e.text + '<br>';
      });
      body += '</div>';
    }
    body += '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19000;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;max-width:720px;width:92%;max-height:88vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.8rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  // 暴露到 global
  global.openEdictHelp = openEdictHelp;

  // ═══════════════════════════════════════════════════════════════════
  //  奏疏朱批 UI
  // ═══════════════════════════════════════════════════════════════════

  function openMemorialsPanel() {
    var G = global.GM;
    if (!G._pendingMemorials || G._pendingMemorials.length === 0) {
      if (global.toast) global.toast('无待批奏疏');
      return;
    }
    var body = '<div style="max-width:680px;font-family:inherit;">';
    body += '<div style="font-size:1.1rem;color:var(--gold-300);margin-bottom:0.8rem;letter-spacing:0.1em;">奏疏待朱批</div>';
    G._pendingMemorials.filter(function(m) { return m.status === 'drafted'; }).forEach(function(m) {
      body += '<div style="padding:10px;margin-bottom:8px;background:var(--bg-2);border-left:3px solid var(--gold-500);border-radius:4px;">';
      body += '<div style="font-size:0.82rem;color:var(--gold-300);margin-bottom:4px;">' + (m.subject || m.typeName) + ' · ' + m.drafter + '</div>';
      body += '<div style="font-size:0.76rem;color:var(--ink-200);margin-bottom:6px;">' + (m.draftText || '') + '</div>';
      body += '<div style="display:flex;gap:4px;">';
      body += '<button class="btn" style="font-size:0.7rem;padding:3px 10px;background:var(--celadon-500);" onclick="EdictParser.processImperialAssent(\'' + m.id + '\',\'approve\');this.parentNode.parentNode.remove();toast(\'准奏\');">准</button>';
      body += '<button class="btn" style="font-size:0.7rem;padding:3px 10px;background:var(--vermillion-400);" onclick="EdictParser.processImperialAssent(\'' + m.id + '\',\'reject\');this.parentNode.parentNode.remove();toast(\'驳回\');">驳</button>';
      body += '<button class="btn" style="font-size:0.7rem;padding:3px 10px;" onclick="EdictParser.processImperialAssent(\'' + m.id + '\',\'modify\',{});this.parentNode.parentNode.remove();toast(\'留待再议\');">留中</button>';
      body += '</div></div>';
    });
    // 抗疏
    if (G._abductions && G._abductions.length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--vermillion-400);margin:0.8rem 0 0.4rem;">抗疏</div>';
      G._abductions.filter(function(a) { return (G.turn - a.turn) < 6; }).forEach(function(a) {
        body += '<div style="padding:8px;margin-bottom:4px;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);border-radius:4px;font-size:0.78rem;">';
        body += '<b>' + a.objector + '</b>：' + a.content;
        body += '<div style="margin-top:4px;display:flex;gap:4px;">';
        body += '<button class="btn" style="font-size:0.68rem;padding:2px 8px;" onclick="_processAbduction(\'' + a.id + '\',\'accept\');this.parentNode.parentNode.parentNode.remove();">纳谏</button>';
        body += '<button class="btn" style="font-size:0.68rem;padding:2px 8px;" onclick="_processAbduction(\'' + a.id + '\',\'reject\');this.parentNode.parentNode.parentNode.remove();">斥</button>';
        body += '<button class="btn" style="font-size:0.68rem;padding:2px 8px;color:var(--vermillion-400);" onclick="_processAbduction(\'' + a.id + '\',\'punish\');this.parentNode.parentNode.parentNode.remove();">下狱</button>';
        body += '<button class="btn" style="font-size:0.68rem;padding:2px 8px;color:var(--vermillion-500);" onclick="_processAbduction(\'' + a.id + '\',\'execute\');this.parentNode.parentNode.parentNode.remove();">诛</button>';
        body += '<button class="btn" style="font-size:0.68rem;padding:2px 8px;" onclick="_processAbduction(\'' + a.id + '\',\'demote\');this.parentNode.parentNode.parentNode.remove();">贬</button>';
        body += '</div></div>';
      });
    }
    body += '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19000;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;max-width:720px;width:92%;max-height:88vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  global.openMemorialsPanel = openMemorialsPanel;

  // 抗疏五处理
  function _processAbduction(id, action) {
    var G = global.GM;
    if (!G._abductions) return;
    var ab = G._abductions.find(function(a) { return a.id === id; });
    if (!ab) return;
    ab.status = action;
    var objector = (G.chars || []).find(function(c) { return c.name === ab.objector; });
    if (action === 'accept') {
      if (global.addEB) global.addEB('抗疏', '纳 ' + ab.objector + ' 之谏');
      if (global._adjAuthority) global._adjAuthority('minxin', 2);
      if (objector) objector.loyalty = Math.min(100, (objector.loyalty || 50) + 5);
    } else if (action === 'reject') {
      if (global.addEB) global.addEB('抗疏', '斥 ' + ab.objector + ' 之谏');
      if (objector) objector.loyalty = Math.max(0, (objector.loyalty || 50) - 3);
    } else if (action === 'punish') {
      if (global.addEB) global.addEB('抗疏', '下 ' + ab.objector + ' 于狱');
      if (global._adjAuthority) { global._adjAuthority('minxin', -2); global._adjAuthority('huangwei', 3); }
      if (objector) { objector.loyalty = Math.max(0, (objector.loyalty || 50) - 10); objector.stress = Math.min(100, (objector.stress || 0) + 30); }
    } else if (action === 'execute') {
      if (global.addEB) global.addEB('抗疏', '诛 ' + ab.objector);
      if (global._adjAuthority) { global._adjAuthority('minxin', -6); global._adjAuthority('huangwei', 5); }
      if (objector) objector.alive = false;
    } else if (action === 'demote') {
      if (global.addEB) global.addEB('抗疏', '贬 ' + ab.objector);
      if (objector) { objector.loyalty = Math.max(0, (objector.loyalty || 50) - 5); objector.officialTitle = (objector.officialTitle || '') + '(贬)'; }
    }
  }

  global._processAbduction = _processAbduction;

  // ═══════════════════════════════════════════════════════════════════
  //  游戏模式 × 贪腐提示
  // ═══════════════════════════════════════════════════════════════════

  function getGameModeHint() {
    var G = global.GM;
    var mode = G._gameMode || 'standard'; // standard/historical/sandbox
    var hints = {
      standard: { corruptionVisibility: 0.7, aiObjectionThreshold: 0.6, memoryDepth: 10 },
      historical: { corruptionVisibility: 0.3, aiObjectionThreshold: 0.5, memoryDepth: 20, note: '史实模式：贪腐隐蔽，抗疏更激烈' },
      sandbox: { corruptionVisibility: 1.0, aiObjectionThreshold: 0.8, memoryDepth: 5, note: '沙盘模式：全透明，少抗疏' }
    };
    return hints[mode] || hints.standard;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    try { _patchTryExecute(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-edict-complete');}catch(_){}}
    try { _checkMemorialTriggers(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'edictC] triggers:') : console.error('[edictC] triggers:', e); }
  }

  function init() {
    _patchTryExecute();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.EdictComplete = {
    init: init,
    tick: tick,
    openEdictHelp: openEdictHelp,
    openMemorialsPanel: openMemorialsPanel,
    getGameModeHint: getGameModeHint,
    enhancedTryExecute: _enhancedTryExecute,
    MEMORIAL_TRIGGERS: MEMORIAL_TRIGGERS,
    P1_EDICT_TYPES: P1_EDICT_TYPES,
    HELP_TOPICS: HELP_TOPICS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
