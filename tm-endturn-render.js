// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// EndTurn 渲染模块（从 tm-endturn.js 拆分）
// 包含：_endTurn_render, Delta面板, 角色高亮, 信息源渲染
// Requires: tm-endturn.js (must load before this file)
// ============================================================

function _endTurn_render(shizhengji, zhengwen, playerStatus, playerInner, edicts, xinglu, oldVars, changeReportHtml, queueResult, suggestions, tyrantResult, turnSummary, shiluText, szjTitle, szjSummary, personnelChanges, hourenXishuo) {
  // 本地获取结束回合按钮（旧代码曾引用闭包外 btn，导致 ReferenceError）
  var btn = (typeof _$ === 'function' ? (_$("btn-end") || _$("btn-end-turn")) : null);
  if (!btn) btn = { textContent:'', style:{} };  // stub，防止 btn.textContent 抛错
  // 默认参数兼容（旧版调用者未传新参数时不崩）
  shiluText = shiluText || '';
  szjTitle = szjTitle || '';
  szjSummary = szjSummary || '';
  personnelChanges = personnelChanges || [];
  hourenXishuo = hourenXishuo || zhengwen || '';
  // 1.4 措施4: 死亡角色二次过滤——标记叙事中已死角色的主动行为
  if (GM.chars && zhengwen) {
    var _deadNames = GM.chars.filter(function(c) { return c.alive === false && c.dead; }).map(function(c) { return c.name; });
    _deadNames.forEach(function(dn) {
      if (dn.length < 2) return;
      // 匹配"死者+主动动词"模式并加注
      var _activePattern = new RegExp('(' + dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(说|曰|奏|上书|进言|率军|带领|发兵|下令|命令|宣布)', 'g');
      zhengwen = zhengwen.replace(_activePattern, '[$1(已故)]$2');
    });
    // 对后人戏说同样过滤
    if (hourenXishuo) {
      _deadNames.forEach(function(dn) {
        if (dn.length < 2) return;
        var _ap = new RegExp('(' + dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(说|曰|奏|上书|进言|率军|带领|发兵|下令|命令|宣布)', 'g');
        hourenXishuo = hourenXishuo.replace(_ap, '[$1(已故)]$2');
      });
    }
  }
  // 动态更新年号
  (function(){
    // 年号系统始终启用
    var t=P.time;var tpy=4;if(t.perTurn==="1y")tpy=1;else if(t.perTurn==="1m")tpy=12;
    var yo=Math.floor((GM.turn-1)/tpy);var y=t.year+yo;
    var mo=t.startMonth||1;
    var eraList=GM.eraNames||[];
    var best=null;
    eraList.forEach(function(e){
      if(!e||!e.name)return;
      var ey=e.startYear||0;var em=e.startMonth||1;
      if(y>ey||(y===ey&&mo>=em)){
        if(!best||ey>best.startYear||(ey===best.startYear&&em>best.startMonth))best=e;
      }
    });
    if(best)GM.eraName=best.name;
  })();

  // 7. 史记 + 财务报表
  // 生成财务报表 HTML
  var ledger = AccountingSystem.getLedger();
  var financeReportHtml = '';

  if (ledger.items.length > 0) {
    financeReportHtml = '<div class="turn-section"><h3>财务报表</h3><div class="turn-section-content">';

    // 收入部分
    var incomeItems = ledger.items.filter(function(item) { return item.type === 'income'; });
    if (incomeItems.length > 0) {
      financeReportHtml += '<div style="margin-bottom: 1rem;"><div style="color: var(--green); font-weight: 700; margin-bottom: 0.5rem;">收入</div>';
      incomeItems.forEach(function(item) {
        financeReportHtml += '<div style="display: flex; justify-content: space-between; padding: 0.2rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">';
        financeReportHtml += '<span style="color: var(--txt-s);">' + item.name + '</span>';
        financeReportHtml += '<span style="color: var(--green);">+' + item.amount.toFixed(1) + '</span>';
        financeReportHtml += '</div>';
      });
      financeReportHtml += '<div style="display: flex; justify-content: space-between; padding: 0.3rem 0; font-weight: 700; border-top: 2px solid var(--green);">';
      financeReportHtml += '<span>总收入</span><span style="color: var(--green);">+' + ledger.totalIncome.toFixed(1) + '</span>';
      financeReportHtml += '</div></div>';
    }

    // 支出部分
    var expenseItems = ledger.items.filter(function(item) { return item.type === 'expense'; });
    if (expenseItems.length > 0) {
      financeReportHtml += '<div style="margin-bottom: 1rem;"><div style="color: var(--red); font-weight: 700; margin-bottom: 0.5rem;">支出</div>';
      expenseItems.forEach(function(item) {
        financeReportHtml += '<div style="display: flex; justify-content: space-between; padding: 0.2rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">';
        financeReportHtml += '<span style="color: var(--txt-s);">' + item.name + '</span>';
        financeReportHtml += '<span style="color: var(--red);">-' + item.amount.toFixed(1) + '</span>';
        financeReportHtml += '</div>';
      });
      financeReportHtml += '<div style="display: flex; justify-content: space-between; padding: 0.3rem 0; font-weight: 700; border-top: 2px solid var(--red);">';
      financeReportHtml += '<span>总支出</span><span style="color: var(--red);">-' + ledger.totalExpense.toFixed(1) + '</span>';
      financeReportHtml += '</div></div>';
    }

    // 净变化
    var netColor = ledger.netChange >= 0 ? 'var(--green)' : 'var(--red)';
    financeReportHtml += '<div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--bg-2); border-radius: 6px; font-weight: 700; font-size: 1.1rem;">';
    financeReportHtml += '<span>净变化</span>';
    financeReportHtml += '<span style="color: ' + netColor + ';">' + (ledger.netChange >= 0 ? '+' : '') + ledger.netChange.toFixed(1) + '</span>';
    financeReportHtml += '</div>';

    financeReportHtml += '</div></div>';
  }

  // 宰辅进言（AI建议）——区分忠臣建议（冗长说教）和佞臣建议（诱人简洁）
  var suggestHtml='';
  if(suggestions&&suggestions.length>0){
    suggestHtml='<div class="turn-section"><h3>\uD83D\uDCA1 \u5BB0\u8F85\u8FDB\u8A00</h3><div style="display:flex;flex-direction:column;gap:0.4rem;">';
    // 检测建议是否是"佞臣式"（含关键诱惑词汇）
    var _temptKeywords = /宴饮|行乐|灵丹|行宫|选秀|淑女|亲征|扬威|享|休憩|犒赏|珍宝/;
    suggestions.forEach(function(s,i){
      var _text = typeof s==='string'?s:(s.text||s);
      var _isSycophant = _temptKeywords.test(_text);
      var _borderColor = _isSycophant ? 'var(--purple,#9b59b6)' : 'var(--gold-d)';
      var _labelColor = _isSycophant ? 'var(--purple,#9b59b6)' : 'var(--gold)';
      var _label = _isSycophant ? '\u8FD1\u81E3' : '\u7B56';
      suggestHtml+='<div style="padding:0.5rem 0.7rem;background:var(--bg-2);border-radius:6px;border-left:3px solid '+_borderColor+';font-size:0.85rem;color:var(--txt-s);line-height:1.6;cursor:pointer;" onclick="var ta=document.getElementById(\'edict-pol\');if(ta){ta.value+=\''+escHtml(_text).replace(/'/g,"\\'")+'\';toast(\'已采纳\');}" title="点击采纳到诏令">';
      suggestHtml+='<span style="color:'+_labelColor+';font-size:0.78rem;">'+_label+(i+1)+'</span> ';
      suggestHtml+=escHtml(_text);
      suggestHtml+='</div>';
    });
    suggestHtml+='<div style="font-size:0.68rem;color:var(--txt-d);text-align:center;margin-top:0.2rem;">\u70B9\u51FB\u5EFA\u8BAE\u53EF\u91C7\u7EB3\u5230\u4E0B\u56DE\u5408\u8BCF\u4EE4</div>';
    suggestHtml+='</div></div>';
  }

  // 密报/矛盾情报（玩家可见的信息交叉验证渠道）
  var intelHtml = '';
  if (typeof buildInformationCocoon === 'function') {
    var cocoon = buildInformationCocoon();
    if (cocoon.length > 0) {
      intelHtml = '<div class="turn-section"><h3>🕵️ 密报与传闻</h3><div style="font-size:0.78rem;color:var(--txt-d);margin-bottom:0.5rem;">以下信息来源各异，真伪自辨。</div>';
      cocoon.forEach(function(c) {
        intelHtml += '<div style="margin-bottom:0.6rem;padding:0.5rem;background:var(--bg-2);border-radius:6px;">';
        intelHtml += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.6;"><span style="color:var(--gold-d);">[官]</span> ' + escHtml(c.official) + '</div>';
        intelHtml += '<div style="font-size:0.82rem;color:var(--red);line-height:1.6;margin-top:0.2rem;border-top:1px dashed var(--bg-4);padding-top:0.2rem;"><span style="color:var(--red);">[密]</span> ' + escHtml(c.intel) + '</div>';
        intelHtml += '</div>';
      });
      intelHtml += '</div>';
    }
  }

  // 构建主角状态区——分离政治处境与内心独白
  var statusHtml = '';
  if (playerStatus || playerInner) {
    statusHtml = '<div class="turn-section"><h3>\uD83D\uDC64 \u89D2\u8272\u72B6\u6001</h3>';
    if (playerStatus) statusHtml += '<div class="narr-status" style="border-left:3px solid var(--gold-d);padding-left:0.6rem;margin-bottom:0.5rem;"><span style="font-size:0.72rem;color:var(--gold-d);letter-spacing:0.1em;">\u653F\u5C40</span><div>' + escHtml(playerStatus) + '</div></div>';
    if (playerInner) statusHtml += '<div class="narr-status" style="border-left:3px solid var(--purple,#9b59b6);padding-left:0.6rem;font-style:italic;color:var(--txt-s);"><span style="font-size:0.72rem;color:var(--purple,#9b59b6);letter-spacing:0.1em;">\u5185\u7701</span><div>' + escHtml(playerInner) + '</div></div>';
    statusHtml += '</div>';
  }
  // 昏君活动风味文本
  var tyrantHtml = '';
  if (tyrantResult && tyrantResult.flavorTexts && tyrantResult.flavorTexts.length > 0) {
    tyrantHtml = '<div class="turn-section"><h3>\uD83C\uDF77 \u5E1D\u738B\u79C1\u884C</h3>';
    tyrantResult.flavorTexts.forEach(function(ft) {
      tyrantHtml += '<div class="tyrant-flavor"><div class="tyrant-flavor-title">' + ft.icon + ' ' + escHtml(ft.name) + '</div>' + escHtml(ft.text) + '</div>';
    });
    // 效果摘要
    var efxParts = [];
    if (tyrantResult.totalStress !== 0) efxParts.push('<span style="color:var(--green);">\u538B\u529B' + tyrantResult.totalStress + '</span>');
    if (tyrantResult.costLog.length > 0) efxParts.push('<span style="color:var(--red);">' + tyrantResult.costLog.join(' ') + '</span>');
    if (tyrantResult.gainLog.length > 0) efxParts.push('<span style="color:var(--green);">' + tyrantResult.gainLog.join(' ') + '</span>');
    if (efxParts.length > 0) {
      tyrantHtml += '<div style="font-size:0.72rem;text-align:center;color:var(--txt-d);margin-top:0.3rem;">' + efxParts.join(' | ') + '</div>';
    }

    // 朝野反应——根据当前NPC状态生成动态反应文本
    var dec = GM._tyrantDecadence || 0;
    if (dec > 15 && GM.chars) {
      var _reactions = [];
      GM.chars.forEach(function(c) {
        if (c.alive === false || c.isPlayer) return;
        var loy = c.loyalty || 50;
        var amb = c.ambition || 50;
        if (loy > 80 && amb < 50 && dec > 30) {
          _reactions.push({name: c.name, type: 'loyal', text: '\u53F9\u606F\u4E0D\u5DF2\uFF0C\u6B32\u8FDB\u8C0F\u53C8\u6050\u89E6\u6012\u5929\u5A01'});
        } else if (amb > 75 && loy < 40) {
          _reactions.push({name: c.name, type: 'schemer', text: '\u6697\u4E2D\u7A83\u559C\uFF0C\u89C9\u5F97\u673A\u4F1A\u6765\u4E86'});
        } else if (loy > 70 && amb > 60 && dec > 40) {
          _reactions.push({name: c.name, type: 'sycophant', text: '\u5949\u4E0A\u73CD\u5B9D\uFF0C\u5949\u627F\u5723\u610F\uFF0C\u8BF7\u8D4F'});
        }
      });
      if (_reactions.length > 0) {
        tyrantHtml += '<div style="margin-top:0.4rem;padding:0.3rem 0.5rem;background:var(--bg-2);border-radius:6px;font-size:0.75rem;">';
        tyrantHtml += '<div style="color:var(--txt-d);margin-bottom:0.2rem;">\u671D\u91CE\u53CD\u5E94</div>';
        _reactions.forEach(function(r) {
          var col = r.type === 'loyal' ? 'var(--blue)' : r.type === 'schemer' ? 'var(--red)' : 'var(--gold-d)';
          var icon = r.type === 'loyal' ? '\uD83D\uDE1F' : r.type === 'schemer' ? '\uD83D\uDE08' : '\uD83E\uDD11';
          tyrantHtml += '<div style="color:' + col + ';">' + icon + ' <b>' + escHtml(r.name) + '</b>：' + r.text + '</div>';
        });
        tyrantHtml += '</div>';
      }
    }

    // 叙事性里程碑——基于历史次数而非数值，让玩家通过故事感受
    var _histLen = GM._tyrantHistory ? GM._tyrantHistory.length : 0;
    var _milestones = [
      {count: 2, text: '\u4F60\u89C9\u5F97\u8FD9\u6837\u7684\u65E5\u5B50\u4E5F\u4E0D\u9519\u3002\u6BD5\u7ADF\uFF0C\u5E1D\u738B\u4E5F\u662F\u4EBA\u5440\u3002'},
      {count: 5, text: '\u5185\u5F85\u60C4\u60C4\u5730\u8BF4\uFF0C\u6709\u51E0\u4F4D\u8001\u81E3\u5728\u6BBF\u5916\u7B49\u4E86\u5F88\u4E45\u3002\u4F60\u6325\u6325\u624B\uFF1A\u660E\u5929\u518D\u8BF4\u3002'},
      {count: 10, text: '\u6628\u591C\u68A6\u89C1\u7236\u7687\u5728\u9F99\u6900\u4E0A\u770B\u7740\u4F60\uFF0C\u9762\u65E0\u8868\u60C5\u3002\u9192\u6765\u540E\uFF0C\u4F60\u559D\u4E86\u4E00\u676F\u9152\uFF0C\u5F88\u5FEB\u5C31\u5FD8\u4E86\u3002'},
      {count: 15, text: '\u4ECA\u5929\u4E0A\u671D\u65F6\uFF0C\u5927\u6BBF\u4E0A\u975E\u5E38\u5B89\u9759\u3002\u6CA1\u6709\u4EBA\u8FDB\u8C0F\u4E86\u3002\u4F60\u89C9\u5F97\u8FD9\u79CD\u5B89\u9759\u5F88\u8212\u670D\u3002'}
    ];
    _milestones.forEach(function(ms) {
      if (_histLen === ms.count) {
        tyrantHtml += '<div style="margin-top:0.4rem;padding:0.5rem;background:linear-gradient(135deg,rgba(142,68,173,0.08),rgba(44,62,80,0.1));border-radius:8px;font-size:0.82rem;color:var(--txt-s);text-align:center;line-height:1.6;font-style:italic;">' + ms.text + '</div>';
      }
    });

    tyrantHtml += '</div>';
  }

  // E8: 群臣动向——分组可视化
  var npcActHtml = '';
  if (GM.evtLog) {
    var _npcEvts = GM.evtLog.filter(function(e) { return e.type === 'NPC\u81EA\u4E3B' && e.turn === GM.turn - 1; });
    if (_npcEvts.length > 0) {
      // 按类别分组
      var _actCategories = [
        { key: 'political', label: '\u671D\u653F', icon: '\uD83C\uDFDB\uFE0F', color: 'var(--gold)', pattern: /奏|谏|弹劾|上书|请|议|朝|官/ },
        { key: 'military', label: '\u519B\u4E8B', icon: '\u2694\uFE0F', color: 'var(--red)', pattern: /军|兵|战|攻|守|练|征|讨/ },
        { key: 'social', label: '\u4EA4\u9645', icon: '\uD83E\uDD1D', color: 'var(--celadon-400,#66bb6a)', pattern: /结|交|拜|宴|盟|联|访/ },
        { key: 'scheme', label: '\u8C0B\u7565', icon: '\uD83D\uDD75', color: 'var(--indigo-400,#7986cb)', pattern: /密|暗|谋|阴|贿|收买|拉拢/ },
        { key: 'other', label: '\u5176\u4ED6', icon: '\uD83D\uDCCC', color: 'var(--txt-d)', pattern: /.*/ }
      ];
      var _grouped = {};
      _npcEvts.forEach(function(e) {
        var cat = 'other';
        for (var ci = 0; ci < _actCategories.length - 1; ci++) {
          if (_actCategories[ci].pattern.test(e.text)) { cat = _actCategories[ci].key; break; }
        }
        if (!_grouped[cat]) _grouped[cat] = [];
        _grouped[cat].push(e);
      });
      npcActHtml = '<div class="turn-section"><h3>\uD83C\uDFAD \u7FA4\u81E3\u52A8\u5411</h3>';
      _actCategories.forEach(function(cat) {
        var items = _grouped[cat.key];
        if (!items || items.length === 0) return;
        npcActHtml += '<div style="margin-bottom:0.5rem;"><div style="font-size:0.72rem;color:' + cat.color + ';font-weight:700;margin-bottom:0.2rem;">' + cat.icon + ' ' + cat.label + ' (' + items.length + ')</div>';
        items.forEach(function(e) {
          npcActHtml += '<div style="padding:0.3rem 0.5rem;margin-bottom:0.2rem;background:var(--bg-2);border-radius:6px;font-size:0.8rem;color:var(--txt-s);line-height:1.5;border-left:2px solid ' + cat.color + ';">' + escHtml(e.text) + '</div>';
        });
        if (items.length > 4) npcActHtml += '<div style="font-size:0.7rem;color:var(--txt-d);padding-left:0.5rem;">...及另外' + (items.length - 4) + '项</div>';
        npcActHtml += '</div>';
      });
      npcActHtml += '</div>';
    }
  }

  // 人物变动摘要——忠诚/野心/压力/官职/所在地/疾病变化
  var charChangeHtml = '';
  if (GM.turnChanges && GM.turnChanges.characters && GM.turnChanges.characters.length > 0) {
    charChangeHtml = '<div class="turn-section"><h3>\uD83D\uDC64 \u4EBA\u7269\u53D8\u52A8</h3>';
    GM.turnChanges.characters.forEach(function(cc) {
      if (!cc.changes || cc.changes.length === 0) return;
      cc.changes.forEach(function(ch) {
        var _fNameMap = {
          'loyalty':'\u5FE0\u8BDA','ambition':'\u91CE\u5FC3','stress':'\u538B\u529B',
          'strength':'\u5B9E\u529B','influence':'\u5F71\u54CD',
          'officialTitle':'\u5B98\u804C','title':'\u8EAB\u4EFD','faction':'\u6240\u5C5E',
          'location':'\u6240\u5728','alive':'\u5B58\u4EA1','rank':'\u54C1\u7EA7',
          'health':'\u4F53\u6CC1','illness':'\u75BE\u75C5','ill':'\u75BE\u75C5','disease':'\u75BE\u75C5',
          'mourning':'\u5B88\u4E27','retired':'\u81F4\u4ED5','exile':'\u6D41\u653E',
          'integrity':'\u5EC9\u8282','morale':'\u58EB\u6C14','intelligence':'\u667A',
          'administration':'\u653F','military':'\u519B','scholarship':'\u5B66',
          'fame':'\u540D\u671B','clanPrestige':'\u65CF\u671B'
        };
        var _fName = _fNameMap[ch.field] || ch.field;
        // 数值字段·用 ↑↓·字符串字段·用 →
        var _isNum = typeof ch.oldValue === 'number' && typeof ch.newValue === 'number';
        var _arrow = _isNum ? (ch.newValue > ch.oldValue ? '\u2191' : '\u2193') : '\u2192';
        var _col = 'var(--txt-s)';
        if (_isNum) {
          if (ch.field === 'loyalty') _col = ch.newValue > ch.oldValue ? 'var(--green)' : 'var(--red)';
          else if (ch.field === 'stress') _col = ch.newValue > ch.oldValue ? 'var(--red)' : 'var(--green)';
        } else if (ch.field === 'alive') _col = ch.newValue === false ? 'var(--red)' : 'var(--green)';
        else if (ch.field === 'illness' || ch.field === 'ill' || ch.field === 'disease') _col = 'var(--amber-400,#f59e0b)';
        // 布尔/特殊·可读化
        var _ov = ch.oldValue, _nv = ch.newValue;
        if (ch.field === 'alive') { _ov = _ov === false ? '\u6545' : '\u5728'; _nv = _nv === false ? '\u6545' : '\u5728'; }
        if (typeof _ov === 'boolean') _ov = _ov ? '\u662F' : '\u5426';
        if (typeof _nv === 'boolean') _nv = _nv ? '\u662F' : '\u5426';
        if (_ov === undefined || _ov === null || _ov === '') _ov = '\uFF08\u65E0\uFF09';
        if (_nv === undefined || _nv === null || _nv === '') _nv = '\uFF08\u65E0\uFF09';
        charChangeHtml += '<div style="font-size:0.78rem;display:flex;justify-content:space-between;padding:0.15rem 0;border-bottom:1px solid var(--bg-4);">';
        charChangeHtml += '<span>' + escHtml(cc.name) + ' ' + _fName + '</span>';
        charChangeHtml += '<span style="color:' + _col + ';">' + escHtml(String(_ov)) + _arrow + escHtml(String(_nv)) + (ch.reason ? ' (' + escHtml(ch.reason) + ')' : '') + '</span></div>';
      });
    });
    charChangeHtml += '</div>';
  }

  // ── 势力动态（faction_events）展示 ──
  var factionEvtHtml = '';
  if (GM.factionEvents && GM.factionEvents.length > 0) {
    var _recentFE = GM.factionEvents.filter(function(e) { return e.turn === GM.turn; });
    if (_recentFE.length > 0) {
      factionEvtHtml = '<div class="turn-section"><h3>\u2694\uFE0F \u5929\u4E0B\u52BF\u529B\u52A8\u6001</h3><div style="font-size:0.75rem;color:var(--txt-d);margin-bottom:0.3rem;">\u672C\u56DE\u5408\u5404\u65B9\u52BF\u529B\u7684\u81EA\u4E3B\u884C\u52A8</div>';
      _recentFE.forEach(function(fe) {
        factionEvtHtml += '<div style="padding:0.35rem 0.6rem;margin-bottom:0.3rem;background:rgba(138,109,27,0.06);border-radius:6px;font-size:0.8rem;border-left:3px solid var(--gold-d);">';
        factionEvtHtml += '<span style="color:var(--gold);font-weight:700;">' + escHtml(fe.actor) + '</span>';
        if (fe.target) factionEvtHtml += ' \u2192 <span style="color:var(--txt-s);">' + escHtml(fe.target) + '</span>';
        factionEvtHtml += '\uFF1A' + escHtml(fe.action);
        if (fe.result) factionEvtHtml += ' <span style="color:var(--txt-d);">(' + escHtml(fe.result) + ')</span>';
        factionEvtHtml += '</div>';
      });
      factionEvtHtml += '</div>';
    }
  }

  // ── 势力/党派/阶层/军事变动汇总 ──
  var systemChangeHtml = '';
  var _scParts = [];
  // 势力变动
  if (GM.turnChanges && GM.turnChanges.factions && GM.turnChanges.factions.length > 0) {
    GM.turnChanges.factions.forEach(function(fc) {
      fc.changes.forEach(function(ch) {
        var _a = ch.newValue > ch.oldValue ? '\u2191' : '\u2193';
        _scParts.push('<span style="color:var(--gold);">\u2694' + fc.name + '</span> ' + ch.field + ' ' + ch.oldValue + _a + ch.newValue);
      });
    });
  }
  // 党派变动
  if (GM.turnChanges && GM.turnChanges.parties && GM.turnChanges.parties.length > 0) {
    GM.turnChanges.parties.forEach(function(pc) {
      pc.changes.forEach(function(ch) {
        var _a = ch.newValue > ch.oldValue ? '\u2191' : '\u2193';
        _scParts.push('<span style="color:var(--purple,#8a5cf5);">\uD83C\uDFDB' + pc.name + '</span> ' + ch.field + ' ' + ch.oldValue + _a + ch.newValue);
      });
    });
  }
  // 阶层变动
  if (GM.turnChanges && GM.turnChanges.classes && GM.turnChanges.classes.length > 0) {
    GM.turnChanges.classes.forEach(function(cc) {
      cc.changes.forEach(function(ch) {
        var _fN = ch.field === 'satisfaction' ? '\u6EE1\u610F' : ch.field === 'influence' ? '\u5F71\u54CD' : ch.field;
        var _a = ch.newValue > ch.oldValue ? '\u2191' : '\u2193';
        _scParts.push('<span style="color:var(--blue);">\uD83D\uDC51' + cc.name + '</span> ' + _fN + ' ' + ch.oldValue + _a + ch.newValue);
      });
    });
  }
  // 军事变动
  if (GM.turnChanges && GM.turnChanges.military && GM.turnChanges.military.length > 0) {
    GM.turnChanges.military.forEach(function(mc) {
      mc.changes.forEach(function(ch) {
        var _fN = ch.field === 'soldiers' ? '\u5175\u529B' : ch.field === 'morale' ? '\u58EB\u6C14' : ch.field;
        var _a = ch.newValue > ch.oldValue ? '\u2191' : '\u2193';
        var _col = ch.field === 'soldiers' && ch.newValue < ch.oldValue ? 'var(--red)' : 'var(--txt-s)';
        _scParts.push('<span style="color:' + _col + ';">\u2694\uFE0F' + mc.name + '</span> ' + _fN + ' ' + ch.oldValue + _a + ch.newValue);
      });
    });
  }
  if (_scParts.length > 0) {
    systemChangeHtml = '<div class="turn-section"><h3>\uD83D\uDCCA \u5929\u4E0B\u53D8\u52A8</h3>';
    systemChangeHtml += '<div style="display:flex;flex-direction:column;gap:0.2rem;">';
    _scParts.forEach(function(p) {
      systemChangeHtml += '<div style="font-size:0.75rem;padding:0.15rem 0.4rem;border-bottom:1px solid var(--bg-4);">' + p + '</div>';
    });
    systemChangeHtml += '</div></div>';
  }

  // 综合局势速览——关键指标变化条
  // 4.1: 回合要点摘要
  var highlightHtml = '';
  var _highlights = [];
  // 忠诚变动最大的角色
  if (GM.turnChanges && GM.turnChanges.characters) {
    var _maxLoyD = 0, _maxLoyInfo = null;
    GM.turnChanges.characters.forEach(function(cc) {
      cc.changes.forEach(function(ch) {
        if (ch.field === 'loyalty' && Math.abs(ch.newValue - ch.oldValue) > _maxLoyD) {
          _maxLoyD = Math.abs(ch.newValue - ch.oldValue); _maxLoyInfo = { name: cc.name, d: ch.newValue - ch.oldValue, nv: ch.newValue };
        }
      });
    });
    if (_maxLoyInfo && _maxLoyD >= 5) _highlights.push({ icon: '\uD83D\uDC64', text: _maxLoyInfo.name + ' \u5FE0\u8BDA' + (_maxLoyInfo.d > 0 ? '+' : '') + _maxLoyInfo.d + '(\u2192' + _maxLoyInfo.nv + ')', color: _maxLoyInfo.d > 0 ? 'var(--green)' : 'var(--red)' });
  }
  // 实力变化最大的势力
  if (GM.turnChanges && GM.turnChanges.factions) {
    var _maxStrD = 0, _maxStrInfo = null;
    GM.turnChanges.factions.forEach(function(fc) {
      fc.changes.forEach(function(ch) {
        if (ch.field === 'strength' && Math.abs(ch.newValue - ch.oldValue) > _maxStrD) {
          _maxStrD = Math.abs(ch.newValue - ch.oldValue); _maxStrInfo = { name: fc.name, d: ch.newValue - ch.oldValue };
        }
      });
    });
    if (_maxStrInfo && _maxStrD >= 3) _highlights.push({ icon: '\u2694', text: _maxStrInfo.name + ' \u5B9E\u529B' + (_maxStrInfo.d > 0 ? '+' : '') + _maxStrInfo.d, color: _maxStrInfo.d > 0 ? 'var(--green)' : 'var(--red)' });
  }
  // 新伤疤事件
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (c._scars && c._scars.length > 0) {
        var newest = c._scars[c._scars.length - 1];
        if (newest.turn === GM.turn - 1) _highlights.push({ icon: '\u2764', text: c.name + '\uFF1A' + newest.event, color: 'var(--vermillion-400)' });
      }
    });
  }
  // 新阴谋
  if (GM.activeSchemes) {
    GM.activeSchemes.forEach(function(s) { if (s.startTurn === GM.turn - 1) _highlights.push({ icon: '\uD83D\uDD75', text: s.schemer + '\u5BC6\u8C0B' + (s.target ? '\u9488\u5BF9' + s.target : ''), color: 'var(--indigo-400)' }); });
  }
  // 最重要NPC行动（从evtLog中读取，p1不在此作用域内）
  if (GM.evtLog) {
    var _topNpcEvt = GM.evtLog.filter(function(e){return e.type==='\u004E\u0050\u0043\u81EA\u4E3B'&&e.turn===GM.turn-1;})[0];
    if (_topNpcEvt) _highlights.push({ icon: '\uD83D\uDCCC', text: escHtml(_topNpcEvt.text||''), color: 'var(--gold-400)' });
  }
  if (_highlights.length > 0) {
    highlightHtml = '<div style="margin-bottom:0.8rem;"><div style="font-size:0.78rem;color:var(--gold);font-weight:700;margin-bottom:0.3rem;">\u672C\u56DE\u5408\u8981\u70B9</div>';
    _highlights.forEach(function(h) {
      highlightHtml += '<div style="display:flex;align-items:center;gap:0.4rem;padding:0.25rem 0.5rem;background:var(--bg-2);border-left:3px solid ' + h.color + ';border-radius:4px;margin-bottom:0.2rem;font-size:0.78rem;">';
      highlightHtml += '<span>' + h.icon + '</span><span style="color:' + h.color + ';">' + escHtml(h.text) + '</span></div>';
    });
    highlightHtml += '</div>';
  }

  var overviewHtml = '';
  var _ovItems = [];
  // 从oldVars和当前vars计算变化
  Object.entries(GM.vars).forEach(function(e) {
    var d = e[1].value - (oldVars[e[0]] || 0);
    if (Math.abs(d) >= 1) {
      _ovItems.push({name: e[0], val: e[1].value, delta: d});
    }
  });
  if (_ovItems.length > 0) {
    overviewHtml = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.6rem;padding:0.4rem;background:var(--bg-2);border-radius:8px;">';
    _ovItems.forEach(function(it) {
      var col = it.delta > 0 ? 'var(--green)' : 'var(--red)';
      overviewHtml += '<span style="font-size:0.72rem;padding:0.15rem 0.4rem;background:var(--bg-3);border-radius:10px;">' + it.name + ' <span style="color:' + col + ';">' + (it.delta > 0 ? '+' : '') + Math.round(it.delta) + '</span></span>';
    });
    overviewHtml += '</div>';
  }

  // 4.2: 信息源可视化渲染
  // E7: 时政记段落结构化——先分段再逐段渲染
  var _szjParagraphs = shizhengji.split(/\n{2,}/).filter(function(p){ return p.trim().length > 0; });
  if (_szjParagraphs.length <= 1) _szjParagraphs = shizhengji.split(/\n/).filter(function(p){ return p.trim().length > 0; });
  // 段落主题检测
  var _szjTopicMap = [
    { pattern: /军|战|兵|攻|守|伐|阵|围城|败|胜|征/, icon: '\u2694\uFE0F', label: '军事' },
    { pattern: /税|钱|粮|财|岁入|赋|商|市|盐铁/, icon: '\uD83D\uDCB0', label: '财政' },
    { pattern: /民|百姓|流民|饥|荒|疫|灾|旱|涝/, icon: '\uD83C\uDFE0', label: '民生' },
    { pattern: /臣|官|吏|朝|奏|谏|党|弹劾|铨选/, icon: '\uD83C\uDFDB\uFE0F', label: '朝政' },
    { pattern: /外|番|使|夷|和亲|朝贡|边|藩/, icon: '\uD83C\uDF0D', label: '外交' },
    { pattern: /后|妃|太子|皇子|内宫|宗室/, icon: '\uD83D\uDC51', label: '宫廷' }
  ];
  var _renderedSzj = _szjParagraphs.map(function(para) {
    var trimmed = para.trim();
    var topic = null;
    for (var ti = 0; ti < _szjTopicMap.length; ti++) {
      if (_szjTopicMap[ti].pattern.test(trimmed)) { topic = _szjTopicMap[ti]; break; }
    }
    var escaped = escHtml(trimmed);
    // 信息源高亮
    escaped = escaped.replace(/(\u636E[\u4e00-\u9fff]{1,8}\u594F\u62A5|\u6709\u53F8\u5448\u62A5|[\u4e00-\u9fff]{1,6}\u594F\u79F0)/g, '<span style="color:var(--gold-400);font-weight:bold;">\uD83D\uDCCB$1</span>');
    escaped = escaped.replace(/(\u5BC6\u63A2[\u4e00-\u9fff]{0,4}\u62A5|\u7EBF\u62A5\u79F0|\u6697\u7EBF[\u4e00-\u9fff]{0,4}|\u5BC6\u67E5)/g, '<span style="color:var(--indigo-400);font-weight:bold;">\uD83D\uDD75$1</span>');
    escaped = escaped.replace(/(\u574A\u95F4\u4F20[\u4e00-\u9fff]{0,4}|\u6C11\u95F4[\u4e00-\u9fff]{0,4}\u4F20|\u6D41\u8A00\u79F0|\u6709\u4EBA\u4E91)/g, '<span style="color:var(--ink-300);font-style:italic;">\uD83D\uDCAC$1</span>');
    escaped = escaped.replace(/(\u7ECF\u67E5[\u4e00-\u9fff]{0,4}|\u6838\u5B9E|\u67E5\u660E)/g, '<span style="color:var(--celadon-400);font-weight:bold;">\u2713$1</span>');
    // E9: 地理标注——高亮行政区划中的地名
    if (P.adminHierarchy) {
      var _placeNames = [];
      Object.keys(P.adminHierarchy).forEach(function(fk) {
        var fh = P.adminHierarchy[fk];
        if (fh && fh.divisions) (function _walk(divs) {
          divs.forEach(function(d) { if (d.name && d.name.length >= 2) _placeNames.push(d.name); if (d.divisions) _walk(d.divisions); });
        })(fh.divisions);
      });
      if (_placeNames.length > 0) {
        var _placeRe = new RegExp('(' + _placeNames.sort(function(a,b){return b.length-a.length;}).map(function(n){return n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|') + ')', 'g');
        escaped = escaped.replace(_placeRe, '<span style="color:var(--celadon-400);text-decoration:underline dotted;cursor:help;" title="\u5730\u540D">\uD83D\uDCCD$1</span>');
      }
    }
    // 1.2: 角色名称彩色高亮（按势力f.color着色）
    var _facColorMap = {};
    (GM.facs || []).forEach(function(f) { if (f.name && f.color) _facColorMap[f.name] = f.color; });
    var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
    var _charNames12 = (GM.chars || []).filter(function(c) { return c.alive !== false && c.name && c.name.length >= 2; })
      .sort(function(a, b) { return b.name.length - a.name.length; });
    _charNames12.forEach(function(c) {
      var col = (c.faction === _playerFac) ? 'var(--gold-400)' : (_facColorMap[c.faction] || '#888');
      var safeN = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var _safeName = c.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      escaped = escaped.replace(new RegExp(safeN, 'g'), '<span class="char-link" style="color:' + col + ';" onclick="event.stopPropagation();showCharPopup(\'' + _safeName + '\',event)">' + c.name + '</span>');
    });
    if (topic) {
      return '<div style="margin-bottom:0.6rem;padding-left:0.5rem;border-left:2px solid var(--gold-d);"><span style="font-size:0.7rem;color:var(--txt-d);margin-right:0.3rem;">' + topic.icon + topic.label + '</span><br>' + escaped + '</div>';
    }
    return '<div style="margin-bottom:0.5rem;">' + escaped + '</div>';
  }).join('');

  // 1.1: 结算效果差值面板
  var deltaHtml = '';
  (function() {
    var cards = [];
    // 核心指标——从 CORE_METRIC_LABELS 动态读取（由 buildCoreMetricLabels 从编辑器配置构建）
    var _coreKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];
    _coreKeys.forEach(function(k) {
      if (typeof GM[k] !== 'number') return;
      var nv = Math.round(GM[k]);
      var prevKey = '_prev_' + k; // 通用快照 key
      var ov = Math.round((GM[prevKey] !== undefined) ? GM[prevKey] : nv);
      var d = nv - ov;
      if (d !== 0) {
        var label = CORE_METRIC_LABELS[k] || k;
        // 查编辑器变量定义判断升降好坏（inversed=true表示数值越高越差，如民变/党争）
        var vDef = null;
        if (P.variables) {
          var _varArr = Array.isArray(P.variables) ? P.variables : (P.variables.base || []).concat(P.variables.other || []);
          vDef = _varArr.find(function(v){return v.name===k;});
        }
        // fallback: 名称中含"变""乱""争""压""腐"等负面词的视为inversed
        var inversed = (vDef && vDef.inversed) || (!vDef && /变|乱|争|压|腐|threat|strife|unrest|corruption/.test(k));
        var col = inversed ? (d > 0 ? 'var(--vermillion-400)' : 'var(--celadon-400)') : (d > 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)');
        cards.push('<span style="color:' + col + ';">' + label + (d > 0 ? '+' : '') + d + '</span>');
      }
    });
    // base变量（绝对值）
    if (GM.turnChanges && GM.turnChanges.variables) {
      GM.turnChanges.variables.forEach(function(vc) {
        if (_coreKeys.indexOf(vc.name) >= 0) return;
        var d = Math.round((vc.newValue || 0) - (vc.oldValue || 0));
        if (Math.abs(d) < 1) return;
        var v = GM.vars[vc.name];
        var unit = (v && v.unit) || '';
        var isBase = v && (v.max === undefined || v.max > 1000);
        var col = d > 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)';
        cards.push('<span style="color:' + col + ';">' + escHtml(vc.name) + (d > 0 ? '+' : '') + (isBase ? d.toLocaleString() : d) + unit + '</span>');
      });
    }
    // 忠诚变化Top3
    if (GM.turnChanges && GM.turnChanges.characters) {
      var loyChanges = [];
      GM.turnChanges.characters.forEach(function(cc) {
        cc.changes.forEach(function(ch) {
          if (ch.field === 'loyalty') loyChanges.push({ name: cc.name, d: Math.round(ch.newValue - ch.oldValue) });
        });
      });
      loyChanges.sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); });
      loyChanges.forEach(function(lc) {
        if (Math.abs(lc.d) < 2) return;
        var col = lc.d > 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)';
        var _dDisp = (typeof _fmtNum1==='function') ? _fmtNum1(lc.d) : lc.d;
        cards.push('<span style="color:' + col + ';">' + escHtml(lc.name) + '忠' + (lc.d > 0 ? '+' : '') + _dDisp + '</span>');
      });
    }
    if (cards.length > 0) {
      deltaHtml = '<div style="margin-bottom:0.8rem;padding:0.6rem 0.8rem;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);display:flex;flex-wrap:wrap;gap:0.5rem 1rem;font-size:var(--text-sm);font-weight:var(--weight-bold);">'
        + '<span style="color:var(--color-foreground-muted);font-weight:normal;margin-right:0.3rem;">\u672C\u56DE\u5408</span>' + cards.join(' ') + '</div>';
    }
  })();

  // 2.3: 战况可视化——渲染本回合战斗结果
  var battleVisHtml = '';
  (function() {
    var battles = GM._turnBattleResults || [];
    // 也检查battleHistory中本回合的记录
    if (battles.length === 0 && GM.battleHistory) {
      battles = GM.battleHistory.filter(function(b) { return b.turn === GM.turn - 1; });
    }
    if (battles.length === 0) return;

    battleVisHtml = '<div class="turn-section"><h3>\u2694\uFE0F \u6218\u51B5</h3>';
    battles.forEach(function(b) {
      var atkTotal = b.attackerSoldiers || 1;
      var defTotal = b.defenderSoldiers || 1;
      var maxSoldiers = Math.max(atkTotal, defTotal);
      var atkPct = Math.round(atkTotal / maxSoldiers * 100);
      var defPct = Math.round(defTotal / maxSoldiers * 100);
      var atkLossPct = Math.round((b.attackerLoss || 0) / Math.max(atkTotal, 1) * 100);
      var defLossPct = Math.round((b.defenderLoss || 0) / Math.max(defTotal, 1) * 100);

      // 判定颜色
      var verdictColor = 'var(--gold-400)';
      var verdictIcon = '\u2694';
      if (b.verdict === '\u5927\u80DC') { verdictColor = 'var(--celadon-400)'; verdictIcon = '\u2605'; }
      else if (b.verdict === '\u5C0F\u80DC') { verdictColor = 'var(--celadon-400)'; verdictIcon = '\u2713'; }
      else if (b.verdict === '\u8D25\u5317') { verdictColor = 'var(--vermillion-400)'; verdictIcon = '\u2717'; }
      else if (b.verdict === '\u50F5\u6301') { verdictColor = 'var(--amber-400,#f59e0b)'; verdictIcon = '\u2550'; }

      battleVisHtml += '<div class="battle-card">';
      // 标题行
      battleVisHtml += '<div class="battle-header"><span class="battle-side atk">' + escHtml(b.attacker || '') + '</span>';
      battleVisHtml += '<span class="battle-verdict" style="color:' + verdictColor + ';">' + verdictIcon + ' ' + escHtml(b.verdict || '') + '</span>';
      battleVisHtml += '<span class="battle-side def">' + escHtml(b.defender || '') + '</span></div>';

      // 兵力对比条
      battleVisHtml += '<div class="battle-bars">';
      // 攻方
      battleVisHtml += '<div class="battle-bar-row"><span class="bar-label">\u653B</span>';
      battleVisHtml += '<div class="bar-track"><div class="bar-fill atk" style="width:' + atkPct + '%;"><div class="bar-loss" style="width:' + atkLossPct + '%;"></div></div></div>';
      battleVisHtml += '<span class="bar-num">' + (atkTotal >= 10000 ? Math.round(atkTotal / 10000) + '\u4E07' : atkTotal) + '</span></div>';
      // 守方
      battleVisHtml += '<div class="battle-bar-row"><span class="bar-label">\u5B88</span>';
      battleVisHtml += '<div class="bar-track"><div class="bar-fill def" style="width:' + defPct + '%;"><div class="bar-loss" style="width:' + defLossPct + '%;"></div></div></div>';
      battleVisHtml += '<span class="bar-num">' + (defTotal >= 10000 ? Math.round(defTotal / 10000) + '\u4E07' : defTotal) + '</span></div>';
      battleVisHtml += '</div>';

      // 伤亡数字
      battleVisHtml += '<div class="battle-casualties">';
      battleVisHtml += '<span>\u653B\u65B9\u635F\u5931 <b style="color:var(--vermillion-400);">' + (b.attackerLoss || 0).toLocaleString() + '</b></span>';
      battleVisHtml += '<span>\u5B88\u65B9\u635F\u5931 <b style="color:var(--vermillion-400);">' + (b.defenderLoss || 0).toLocaleString() + '</b></span>';
      battleVisHtml += '</div>';

      // 附加信息（地形、季节）
      var _extras = [];
      if (b.terrain) _extras.push(escHtml(b.terrain));
      if (b.season) _extras.push(escHtml(b.season));
      if (b.fortLevel > 0) _extras.push('\u57CE\u9632Lv' + b.fortLevel);
      if (_extras.length > 0) {
        battleVisHtml += '<div class="battle-meta">' + _extras.join(' \u00B7 ') + '</div>';
      }

      battleVisHtml += '</div>';
    });

    // 多回合战争时间轴
    if (GM.activeWars && GM.activeWars.length > 0) {
      var _recentBattles = (GM.battleHistory || []).slice(-20);
      GM.activeWars.forEach(function(war) {
        var warBattles = _recentBattles.filter(function(b) {
          return (b.attackerFaction === war.attacker && b.defenderFaction === war.defender) ||
                 (b.attackerFaction === war.defender && b.defenderFaction === war.attacker);
        });
        if (warBattles.length > 1) {
          battleVisHtml += '<div class="battle-timeline"><div class="battle-timeline-title">' + escHtml(war.attacker || '') + ' vs ' + escHtml(war.defender || '') + ' \u6218\u5F79\u65F6\u95F4\u7EBF</div>';
          battleVisHtml += '<div class="battle-timeline-track">';
          warBattles.forEach(function(wb) {
            var dot = wb.verdict === '\u5927\u80DC' || wb.verdict === '\u5C0F\u80DC' ? 'win' : wb.verdict === '\u8D25\u5317' ? 'lose' : 'draw';
            battleVisHtml += '<div class="timeline-dot ' + dot + '" title="T' + wb.turn + ' ' + escHtml(wb.verdict || '') + '"></div>';
          });
          battleVisHtml += '</div></div>';
        }
      });
    }

    battleVisHtml += '</div>';
  })();

  // 2.1: 分层展示——第一层(总结+Delta+要点) 默认展开，第二层(详情) 默认折叠
  var _summaryText = turnSummary || '';
  // 若AI未返回turn_summary，从时政记首句自动截取
  if (!_summaryText && shizhengji) {
    var _firstSentence = shizhengji.split(/[。！\n]/)[0];
    _summaryText = _firstSentence || '';
  }
  var summaryHtml = '';
  // 一句话总曰已由弹窗头部 .tr-summary-bar 显示（从 sj.turnSummary 读取），此处不再重复渲染

  // 关键事件标签（战争/死亡/叛乱等醒目标记）
  var _criticalTags = [];
  if (GM.activeWars && GM.activeWars.length > 0) _criticalTags.push({label:'战事',color:'var(--vermillion-400)'});
  if (GM.turnChanges && GM.turnChanges.characters) {
    var _deathCount = GM.turnChanges.characters.filter(function(cc){ return cc.changes.some(function(ch){ return ch.field==='alive'&&ch.newValue===false; }); }).length;
    if (_deathCount > 0) _criticalTags.push({label:_deathCount+'人殁',color:'var(--vermillion-400)'});
  }
  if (GM.activeSchemes && GM.activeSchemes.length > 0) _criticalTags.push({label:'密谋',color:'var(--indigo-400,#7986cb)'});
  if (GM.turnChanges && GM.turnChanges.factions) {
    var _warFE = (GM.factionEvents||[]).filter(function(e){return e.turn===GM.turn&&/战|攻|征/.test(e.action);});
    if (_warFE.length > 0) _criticalTags.push({label:'势力冲突',color:'var(--red)'});
  }
  var criticalHtml = '';
  // 要闻标签已由弹窗头部 .tr-critical-bar 显示（_trDetectCritical 从 sj 自动侦测），此处不再重复渲染

  // ============================================================
  // 新五板块结构：①实录 ②时政记 ③数值变化说明 ④人事变动 ⑤后人戏说
  // ============================================================

  // ① 实录（文言史官体） · 新版 tr-section.shilu + tr-shilu
  var shiluHtml = '';
  if (shiluText) {
    shiluHtml = '<div class="tr-section shilu">'
      + '<div class="tr-section-hdr"><span class="lab">\u5B9E \u5F55</span><span class="meta">\u8D77\u5C45\u6CE8\u5B98\u5B9E\u5F55 \u00B7 \u6B63\u53F2\u4F53</span></div>'
      + '<div class="tr-shilu"><div class="tr-shilu-seal">\u53F2\u5B98</div>' + escHtml(shiluText) + '</div>'
      + '</div>';
  }

  // ② 时政记 · 新版 tr-section.szj
  var szjSectionHtml = '';
  if (shizhengji) {
    szjSectionHtml = '<div class="tr-section szj">'
      + '<div class="tr-section-hdr"><span class="lab">\u65F6 \u653F \u8BB0</span><span class="meta">\u671D\u653F\u7EAA\u8981\u4F53</span></div>';
    if (szjTitle) {
      szjSectionHtml += '<div class="tr-szj-title">' + escHtml(szjTitle) + '</div>';
    }
    szjSectionHtml += '<div class="tr-szj-content">' + _renderedSzj + '</div>';
    if (szjSummary) {
      szjSectionHtml += '<div class="tr-szj-summary">' + escHtml(szjSummary) + '</div>';
    }
    szjSectionHtml += '</div>';
  }

  // ③ 数值变化说明（统一渲染）
  var unifiedChangesHtml = _renderUnifiedChanges(oldVars);

  // ④ 人事变动
  var personnelHtml = _renderPersonnelChanges(personnelChanges);

  // ⑤ 后人戏说（场景叙事）· 新版 tr-section.houren + tr-houren-box
  var hourenHtml = '';
  if (hourenXishuo) {
    hourenHtml = '<div class="tr-section houren">'
      + '<div class="tr-section-hdr"><span class="lab">\u540E \u4EBA \u620F \u8BF4</span><span class="meta">\u7A17\u5B98\u91CE\u53F2 \u00B7 \u53C2\u8003\u4E0D\u53EF\u5C3D\u4FE1</span></div>'
      + '<div class="tr-houren-box">' + escHtml(hourenXishuo) + '</div>'
      + '</div>';
  }

  // 第一层（默认展开）：实录 + 一句话总曰 + 关键标签 + 战况
  // ※ 本回合要点/数值变化（delta/overview/highlight）全部合并到 layer2 的【数值变化说明】，layer1 只保留叙事和标签
  var layer1Html = shiluHtml + summaryHtml + criticalHtml + battleVisHtml;

  // 御批回听·对玩家本回合诏令的执行问责(aiEdictEfficacyAudit 生成)
  var efficacyHtml = '';
  try {
    var ef = GM._edictEfficacyReport;
    if (ef && !ef.skipped && Array.isArray(ef.reports) && ef.reports.length > 0) {
      var efColor = ef.overallEfficacy >= 75 ? 'var(--green,#4a9a4a)' : ef.overallEfficacy >= 50 ? 'var(--gold,#c9a84c)' : 'var(--red-s,#b04030)';
      efficacyHtml = '<div class="tr-efficacy-box" style="margin-top:1.2rem;padding:0.9rem 1rem;background:rgba(201,168,76,0.06);border-left:3px solid var(--gold,#c9a84c);border-radius:4px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">'
        + '<div style="font-weight:700;color:var(--gold,#c9a84c);font-size:0.95rem;">〔御批回听〕</div>'
        + '<div style="font-size:0.78rem;color:'+efColor+';">代理强度 ' + (ef.overallEfficacy || 0) + '%·共 ' + ef.total + ' 条</div>'
        + '</div>';
      ef.reports.forEach(function(r) {
        var stCfg = {
          executed: { lbl: '✓ 执行', clr: 'var(--green,#4a9a4a)' },
          partial: { lbl: '◐ 部分', clr: 'var(--gold,#c9a84c)' },
          delayed: { lbl: '⏳ 延宕', clr: 'var(--amber,#e0a040)' },
          ignored: { lbl: '✗ 忽略', clr: 'var(--red-s,#b04030)' }
        };
        var s = stCfg[r.status] || { lbl: r.status || '?', clr: 'var(--txt-d)' };
        efficacyHtml += '<div style="margin-bottom:0.6rem;padding:0.5rem 0.7rem;background:rgba(0,0,0,0.12);border-radius:3px;border-left:2px solid '+s.clr+';font-size:0.8rem;">'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">'
          + '<span style="color:'+s.clr+';font-weight:600;">' + s.lbl + '</span>'
          + '<span style="color:var(--txt-d);font-size:0.72rem;">执行度 ' + (r.executionLevel || 0) + '%</span>'
          + '</div>'
          + '<div style="color:var(--txt-s);margin-bottom:0.3rem;">' + escHtml(r.content || '') + '</div>';
        if (r.evidence) efficacyHtml += '<div style="font-size:0.74rem;color:var(--txt-d);line-height:1.5;">依据：' + escHtml(r.evidence) + '</div>';
        if (r.missed) efficacyHtml += '<div style="font-size:0.74rem;color:'+s.clr+';margin-top:0.2rem;">未落实：' + escHtml(r.missed) + '</div>';
        if (r.reason && r.status !== 'executed') efficacyHtml += '<div style="font-size:0.74rem;color:var(--txt-d);margin-top:0.2rem;">缘由：' + escHtml(r.reason) + '</div>';
        if (r.nextAdvice) efficacyHtml += '<div style="font-size:0.74rem;color:var(--gold,#c9a84c);margin-top:0.3rem;">⇒ 下回合建议：' + escHtml(r.nextAdvice) + '</div>';
        efficacyHtml += '</div>';
      });
      if (Array.isArray(ef.unexpectedEvents) && ef.unexpectedEvents.length > 0) {
        efficacyHtml += '<div style="margin-top:0.5rem;font-size:0.76rem;color:var(--txt-s);border-top:1px dashed rgba(255,255,255,0.12);padding-top:0.5rem;">'
          + '<span style="color:var(--gold-d,#8c7030);">【AI 自发事件】</span>';
        ef.unexpectedEvents.forEach(function(u) {
          efficacyHtml += '<div style="margin-top:0.2rem;">· ' + escHtml(String(u)) + '</div>';
        });
        efficacyHtml += '</div>';
      }
      if (ef.topPriority) {
        efficacyHtml += '<div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(201,168,76,0.15);border-radius:3px;font-size:0.78rem;color:var(--gold,#c9a84c);">'
          + '⚡ 下回合首要：' + escHtml(ef.topPriority) + '</div>';
      }
      efficacyHtml += '</div>';
    }
  } catch(_efHE) { console.warn('[shiji] 御批回听渲染失败', _efHE); efficacyHtml = ''; }

  // 第二层（默认折叠）：时政记 + 数值变化（含要点/财政/军事/势力/党派/阶层/人物）+ 人事变动 + 后人戏说 + 兼容附件
  // ※ changeReportHtml 已并入 _renderUnifiedChanges，此处不再重复
  // ※ 2026-04 用户调整：群臣动向(npcActHtml) 移入风闻录事·密报与奏闻(intelHtml) 删除
  var layer2Html = szjSectionHtml + unifiedChangesHtml + efficacyHtml + personnelHtml + hourenHtml
    + statusHtml + tyrantHtml + factionEvtHtml + financeReportHtml;

  // 群臣动向→风闻录事（每条 NPC 事件写入 GM._fengwenRecord）
  // ※ 奏疏类(奏/谏/弹劾/上书/疏/表)走正常奏疏系统·不入风闻
  // ※ 只收录 4 类：密札(密谋)/耳报(私交)/军情(军事动向)/风议(舆论)
  try {
    if (GM.evtLog) {
      var _npcEvtsFw = GM.evtLog.filter(function(e) { return e.type === 'NPC自主' && e.turn === GM.turn - 1; });
      if (_npcEvtsFw.length > 0) {
        if (!GM._fengwenRecord) GM._fengwenRecord = [];
        _npcEvtsFw.forEach(function(e) {
          var _t = e.text || '';
          // 奏疏类完全跳过（已由奏疏系统处理）
          if (/奏|谏|弹劾|上书|疏|表奏|上表|题奏|参劾/.test(_t)) return;
          var _type = null;
          if (/密|暗|谋|阴|贿|收买|拉拢|勾结|串/.test(_t)) _type = '密札';
          else if (/结交|拜|宴|盟|联姻|访|攀交|门生|座师/.test(_t)) _type = '耳报';
          else if (/军|兵|战|攻|守|练|征|讨|调兵|点卯|调遣/.test(_t)) _type = '军情';
          else if (/私议|流言|传|说|闲谈|窃语/.test(_t)) _type = '风议';
          if (!_type) return; // 不分类·不收录
          GM._fengwenRecord.push({
            type: _type, text: _t,
            credibility: 0.75, turn: GM.turn - 1, source: 'npc_action'
          });
        });
      }
    }
  } catch(_fwE) { console.warn('[shiji→fengwen] NPC evts 转录失败', _fwE); }

  var shijiHtml = layer1Html +
    '<div class="tr-detail-toggle" onclick="var p=this.parentElement;var d=p.querySelector(\'.tr-detail-content\');if(!d)return;var open=d.classList.toggle(\'show\');this.classList.toggle(\'open\',open);this.querySelector(\'.toggle-text\').textContent=open?\'\u6536 \u8D77 \u8BE6 \u60C5\':\'\u5C55 \u5F00 \u8BE6 \u60C5\';">' +
    '<span class="arrow">\u25BC</span> <span class="toggle-text">\u5C55 \u5F00 \u8BE6 \u60C5</span> <span class="arrow">\u25BC</span></div>' +
    '<div class="tr-detail-content">' + layer2Html + '</div>';

  // shijiHistory存完整HTML + 所有结构化字段（供史记回顾和后续兼容）
  var _fullHtml = layer1Html + layer2Html;
  // 收集本回合玩家下的诏令（edicts 参数存的是按分类的原文）
  var _thisTurnEdicts = edicts || {};
  GM.shijiHistory.push({
    turn: GM.turn-1, time: getTSText(GM.turn-1),
    shizhengji: shizhengji, zhengwen: zhengwen,
    playerStatus: playerStatus, playerInner: playerInner,
    turnSummary: _summaryText,
    // 新增字段
    shilu: shiluText, szjTitle: szjTitle, szjSummary: szjSummary,
    personnel: personnelChanges, houren: hourenXishuo,
    edicts: _thisTurnEdicts,  // 保留玩家诏令全文以便史记回顾+下回合 AI 上下文
    html: _fullHtml
  });
  // 6.5: 每回合一句话摘要存入年度素材
  if (!GM._yearlyDigest) GM._yearlyDigest = [];
  GM._yearlyDigest.push({turn: GM.turn-1, summary: _summaryText || (shizhengji||'').split(/[\u3002\n]/)[0] || ''});
  // 按年度清理（只保留当年）
  var _yTurns = (typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12;
  if (GM._yearlyDigest.length > _yTurns * 2) GM._yearlyDigest = GM._yearlyDigest.slice(-_yTurns);
  // 纪传体：记录月度摘要
  // 编年史草稿：优先使用实录(正式体)+时政记；后人戏说作为辅助材料
  // 实录本就是正史体，最适合喂给编年体系统；否则回落到shizhengji+zhengwen
  var _chrSummary = shiluText || shizhengji || '';
  var _chrDetail = shizhengji || '';
  if (_chrDetail && _chrDetail === _chrSummary) _chrDetail = zhengwen || ''; // 避免重复
  ChronicleSystem.addMonthDraft(GM.turn-1, _chrSummary, _chrDetail);

  // 8. 写入起居注
  if(!GM.qijuHistory)GM.qijuHistory=[];
  GM.qijuHistory.push({turn:GM.turn-1,time:getTSText(GM.turn-1),zhengwen:zhengwen});
  renderQiju();

  // 9. 清空输入
  ["edict-pol","edict-mil","edict-dip","edict-eco","edict-oth","xinglu","xinglu-pub","xinglu-prv"].forEach(function(id){var el=_$(id);if(el)el.value="";});

  // 10. 问对：保留聊天记录（跨回合持久），刷新角色列表，关闭弹窗
  renderWenduiChars();
  var _wdm=_$('wendui-modal');if(_wdm)_wdm.remove();

  // 11. 新回合奏疏
  generateMemorials();

  // 11.5/11.6 自然死亡和空缺检查已在 Step 6.90-6.91 中执行，此处不再重复

  // 11b. 快照当前值用于下回合delta显示
  GM._prevVars = {};
  Object.entries(GM.vars||{}).forEach(function(e) { GM._prevVars[e[0]] = e[1].value; });
  // 动态快照所有核心指标（供 Delta 面板比较）
  var _cmlKeys = (typeof CORE_METRIC_LABELS === 'object') ? Object.keys(CORE_METRIC_LABELS) : [];

  // 9.4: 记录核心指标历史快照（供结局统计画曲线）
  if (!GM._metricHistory) GM._metricHistory = [];
  var _snap = {turn: GM.turn - 1};
  _cmlKeys.forEach(function(k) { if (typeof GM[k] === 'number') _snap[k] = Math.round(GM[k]); });
  // 同时记录vars中的核心变量
  Object.entries(GM.vars||{}).forEach(function(e) {
    if (e[1].isCore || (typeof CORE_METRIC_LABELS === 'object' && CORE_METRIC_LABELS[e[0]])) {
      _snap[e[0]] = Math.round(e[1].value);
    }
  });
  GM._metricHistory.push(_snap);
  if (GM._metricHistory.length > 500) GM._metricHistory = GM._metricHistory.slice(-500);
  _cmlKeys.forEach(function(k) { if (typeof GM[k] === 'number') GM['_prev_' + k] = GM[k]; });

  // 11b. 势力历史快照（每回合记录各势力状态，供AI分析趋势）
  if (GM.facs && GM.facs.length > 0) {
    if (!GM._factionHistory) GM._factionHistory = [];
    var _fSnapshot = { turn: GM.turn, factions: {} };
    GM.facs.forEach(function(f) {
      _fSnapshot.factions[f.name] = {
        strength: f.strength || 50,
        military: f.militaryStrength || 0,
        attitude: f.attitude || '',
        leader: f.leader || ''
      };
    });
    GM._factionHistory.push(_fSnapshot);
    // 只保留最近10回合快照
    if (GM._factionHistory.length > 10) GM._factionHistory.shift();
  }

  // 12. 更新界面
  renderGameState();renderBiannian();renderOfficeTree();renderShijiList();

  // 13. 显示史记弹窗
  hideLoading();
  showTurnResult(shijiHtml+"<div style=\"text-align:center;color:var(--gold-d);margin-top:1rem;\">"+getTSText(GM.turn)+"</div>", GM.shijiHistory.length - 1);

  // 7.2: 预加载——玩家阅读回合结果时预构建固定层prompt缓存
  setTimeout(function() {
    if (typeof PromptLayerCache !== 'undefined' && PromptLayerCache.preload) {
      PromptLayerCache.preload();
    }
  }, 500);

  // 释放延迟toast（成就等在settlement期间积攒的提示）
  if (GM._pendingToasts && GM._pendingToasts.length > 0) {
    GM._pendingToasts.forEach(function(msg, i) { setTimeout(function(){ toast(msg); }, 500 + i * 800); });
    GM._pendingToasts = [];
  }

  // 13a. 每回合自动存档到IndexedDB（静默，不弹toast）
  if (typeof TM_SaveDB !== 'undefined' && typeof _prepareGMForSave === 'function') {
    _prepareGMForSave();
    var _autoState = { GM: deepClone(GM), P: deepClone(P) };
    var _sc3 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
    var _autoMeta = {
      name: '自动封存·' + (typeof getTSText==='function'?getTSText(GM.turn):'T'+GM.turn),
      type: 'auto',
      turn: GM.turn,
      scenarioName: _sc3 ? _sc3.name : '',
      eraName: GM.eraName || ''
    };
    // 写入 autosave（页面刷新恢复用）+ slot_0（案卷目录显示用）
    TM_SaveDB.save('autosave', _autoState, _autoMeta).catch(function(e) { console.warn('[AutoSave] autosave写入失败:', e); });
    TM_SaveDB.save('slot_0', _autoState, _autoMeta).then(function() {
      if (typeof _updateSaveIndex === 'function') _updateSaveIndex(0, _autoMeta);
      // 同时写轻量标记到localStorage（用于页面刷新检测）
      try {
        localStorage.setItem('tm_autosave_mark', JSON.stringify({
          turn: GM.turn, timestamp: Date.now(),
          scenarioName: _sc3 ? _sc3.name : '',
          eraName: GM.eraName || ''
        }));
      } catch(e) {}
    }).catch(function(e) { console.warn('[AutoSave] slot_0写入失败:', e); });
  }

  // 13b. 写入每回合完整数据（多文件结构）
  if(window.tianming&&window.tianming.isDesktop&&GM.saveName){
    try{
      // 主上下文
      var turnCtx={turn:GM.turn-1,time:getTSText(GM.turn-1),shizhengji:shizhengji,zhengwen:zhengwen,playerStatus:playerStatus,playerInner:playerInner,vars:deepClone(GM.vars),rels:deepClone(GM.rels),chars:deepClone(GM.chars),officeTree:deepClone(GM.officeTree||[]),families:GM.families?deepClone(GM.families):null,harem:GM.harem?deepClone(GM.harem):null};
      // 玩家操作
      var playerInput={edicts:edicts,xinglu:xinglu,memorialResponses:(GM.memorials||[]).map(function(m){return{from:m.from,type:m.type,status:m.status,reply:m.reply};}),tyrantActivities:GM._turnTyrantActivities||[]};
      // AI推演全部结果（从GM临时存储中提取）
      var aiResults=GM._turnAiResults||{};
      // 变量变化
      var varChanges={_timeScale: P.time ? P.time.perTurn : '1m', _customDays: P.time ? P.time.customDays : null};
      Object.entries(GM.vars).forEach(function(e){
        var d=e[1].value-(oldVars[e[0]]||0);
        if(Math.abs(d)>=0.1) {
          var entry = {old:oldVars[e[0]]||0, now:e[1].value, delta:d};
          // 保留编辑者定义的单位信息
          var unit = e[1].unit || e[1].unitName || e[1].suffix || '';
          if (unit) entry.unit = unit;
          varChanges[e[0]] = entry;
        }
      });
      // 剧本快照（首回合）
      var scenarioData=null;
      var refTextData=null;
      if(GM.turn<=2){
        var _sc4=findScenarioById&&findScenarioById(GM.sid);
        if(_sc4) scenarioData=deepClone(_sc4);
        if(_sc4&&_sc4.refText) refTextData=_sc4.refText;
      }
      var turnData={context:turnCtx,playerInput:playerInput,aiResults:aiResults,varChanges:varChanges};
      if(scenarioData) turnData.scenario=scenarioData;
      if(refTextData) turnData.refText=refTextData;
      window.tianming.writeTurnData(GM.saveName,GM.turn-1,turnData).catch(function(e){ console.warn("[catch] async:", e); });
    }catch(e){ console.warn("[catch] \u9759\u9ED8\u5F02\u5E38:", e.message || e); }
    // 自动存档
    var _asTurns=(P.conf&&P.conf.autoSaveTurns)||5;
    if(_asTurns>0&&GM.turn%_asTurns===0){
      try{
        if (typeof _prepareGMForSave === 'function') _prepareGMForSave();
        var _asd=deepClone(P);
        _asd.gameState=deepClone(GM);
        _asd._saveMeta={turn:GM.turn,gameMode:(P.conf&&P.conf.gameMode)||'',saveName:GM.saveName};
        window.tianming.autoSave(_asd).catch(function(e){ console.warn("[catch] async:", e); });
      }catch(e){ console.warn("[catch] \u9759\u9ED8\u5F02\u5E38:", e.message || e); }
    }
  }

  btn.textContent="\u23F3 \u9759\u5F85\u65F6\u53D8";btn.style.opacity="1";

  // 更新新UI的时间显示和变量显示
  if (typeof updateTimeDisplay === 'function') {
    updateTimeDisplay();
  }
  if (typeof updateTopVariables === 'function') {
    updateTopVariables();
  }

  // 自动存档
  SaveManager.autoSave();

  // 输出回合结算日志
  _dbg('========== 回合结算完成 (T' + GM.turn + ') ==========');
  _dbg('[endTurn] 财务报表:', ledger);
  _dbg('[endTurn] 变动队列已清空，准备进入下一回合');

  // 更新地图颜色（根据占领者实时更新）
  if (P.map && P.map.enabled) {
    updateMapColors();
  }
}

// ============================================================
// 数值变化说明（统一渲染） — 参考崇祯朝政纪要体
// 格式：【分组】\n  指标（旧值 → 新值）：原因；
// 来源：AccountingSystem.getLedger() + GM.turnChanges.* + CORE_METRIC_LABELS + GM.vars
// ============================================================
/** v2 helper：格式化大数值（显示万/亿） */
function _rucFmtBig(v) {
  v = Math.round(v||0);
  if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(2) + '\u4EBF';
  if (Math.abs(v) >= 1e4) return (v/1e4).toFixed(v%1e4===0?0:1) + '\u4E07';
  return v.toLocaleString();
}
/** v2 helper：生成 old→new+delta HTML */
function _rucValHtml(oldV, newV, formatter, unit) {
  var fmt = formatter || _rucFmtBig;
  var d = (newV||0) - (oldV||0);
  var delta;
  if (d === 0) delta = '<span class="delta flat">\u2014</span>';
  else if (d > 0) delta = '<span class="delta up">+' + fmt(d) + '</span>';
  else delta = '<span class="delta dn">\u2212' + fmt(-d) + '</span>';
  return '<span class="old">' + fmt(oldV||0) + (unit?'<span class="unit">'+unit+'</span>':'') + '</span><span class="arr">\u2192</span><span class="new">' + fmt(newV||0) + (unit?'<span class="unit">'+unit+'</span>':'') + '</span>' + delta;
}
/** v2 helper：把 reasons 数组转成 chip HTML */
function _rucReasonChips(reasons, fallback) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return fallback ? '<span class="tr-reason-txt">' + escHtml(fallback) + '</span>' : '';
  }
  var html = '';
  reasons.slice(0,6).forEach(function(r){
    var desc = r.desc || r.type || r.reason || '';
    if (!desc) return;
    var v = r.delta || r.amount || '';
    var cls = 'neu';
    if (typeof r.delta === 'number') cls = r.delta > 0 ? 'pos' : (r.delta < 0 ? 'neg' : 'neu');
    else if (/\u635F|\u964D|\u8870|\u8D25|\u6076|\u6B7B|\u98DF|\u6D88|\u7075|\u8D25\u5317|\u51CF\u5C11|\u800D|\u6D41|\u8D25\u51D1|\u8D2C|\u88C1|\u70E7|\u77AC|\u633A/.test(desc)) cls = 'neg';
    else if (/\u589E|\u5347|\u8865|\u6DFB|\u65B0|\u5B8C|\u6536|\u6210|\u9752|\u8BB8|\u793A|\u6B23|\u7834|\u6B63|\u6109|\u83B7/.test(desc)) cls = 'pos';
    html += '<span class="tr-reason-chip ' + cls + '">' + escHtml(desc) + (v?'<span class="v">'+escHtml(String(v))+'</span>':'') + '</span>';
  });
  return html;
}

function _renderUnifiedChanges(oldVars) {
  oldVars = oldVars || {};
  // v2：新布局 · 10 分类卡块·每项带原因 chip
  var html = '';

  // ═══ ① 本回合要点 ═══
  var highlights = [];
  // 忠诚变动最大
  if (GM.turnChanges && GM.turnChanges.characters) {
    var _loyCand = [];
    GM.turnChanges.characters.forEach(function(cc) {
      (cc.changes||[]).forEach(function(ch) {
        if (ch.field === 'loyalty' && Math.abs(ch.newValue - ch.oldValue) >= 5) {
          _loyCand.push({ name: cc.name, d: ch.newValue - ch.oldValue, nv: ch.newValue, reason: ch.reason || '' });
        }
      });
    });
    _loyCand.sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);});
    _loyCand.slice(0,2).forEach(function(c){
      highlights.push({
        name: escHtml(c.name), sub: '\u5FE0\u8BDA ' + (c.d>0?'+':'') + c.d + ' \u2192 ' + c.nv,
        reason: c.reason || '', cls: c.d>=0?'':'warn'
      });
    });
  }
  // 势力实力变化最大
  if (GM.turnChanges && GM.turnChanges.factions) {
    var _strCand = [];
    GM.turnChanges.factions.forEach(function(fc) {
      (fc.changes||[]).forEach(function(ch) {
        if (ch.field === 'strength' && Math.abs(ch.newValue - ch.oldValue) >= 3) {
          _strCand.push({ name: fc.name, d: ch.newValue - ch.oldValue, reason: ch.reason || '' });
        }
      });
    });
    _strCand.sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);});
    _strCand.slice(0,2).forEach(function(f){
      highlights.push({
        name: escHtml(f.name), sub: '\u5B9E\u529B ' + (f.d>0?'+':'') + f.d,
        reason: f.reason || '', cls: f.d>=0?'':'danger'
      });
    });
  }
  // 新阴谋
  if (Array.isArray(GM.activeSchemes)) {
    GM.activeSchemes.filter(function(s){return s.startTurn === GM.turn - 1;}).slice(0,1).forEach(function(s){
      highlights.push({name: escHtml(s.schemer||'?'), sub:'\u5BC6\u8C0B'+(s.target?'\u9488\u5BF9'+escHtml(s.target):''), reason: s.description||s.goal||'', cls:'danger'});
    });
  }
  if (highlights.length > 0) {
    html += '<div class="tr-cg-block tr-cg-highlight">';
    html += '<div class="tr-cg-hdr"><div class="ic">\u8981</div><div class="lab">\u672C \u56DE \u5408 \u8981 \u70B9</div>';
    html += '<div class="sub">\u6700\u7A81\u51FA\u7684 ' + highlights.length + ' \u9879\u53D8\u52A8</div>';
    html += '<div class="count">' + highlights.length + ' \u9879</div></div>';
    html += '<div class="tr-cg-items">';
    highlights.forEach(function(h){
      html += '<div class="tr-cg-item' + (h.cls?' '+h.cls:'') + '">';
      html += '<div class="tr-cg-name">' + h.name + ' <span class="sub-lbl">' + escHtml(h.sub) + '</span></div>';
      if (h.reason) html += '<div class="tr-cg-vals"><span class="tr-reason-txt">' + escHtml(h.reason) + '</span></div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // 辅助：从 _turnReport 过滤并生成 fiscal_adj reason chips
  function _collectFiscalAdjChips(target, resource) {
    var out = [];
    var rep = GM._turnReport || [];
    rep.forEach(function(r) {
      if (!r || r.type !== 'fiscal_adj') return;
      if (r.target !== target) return;
      if ((r.resource || 'money') !== resource) return;
      var signCls = r.kind === 'income' ? 'pos' : 'neg';
      var signChar = r.kind === 'income' ? '+' : '\u2212';
      var label = escHtml(r.name || r.reason || (r.kind === 'income' ? '入库' : '支用')).slice(0, 16);
      var tip = escHtml((r.reason || '') + (r.name?'\u00B7'+r.name:'')).slice(0, 80);
      var short = r.shortfall || 0;
      var status = r.executionStatus || '';
      if (status === 'blocked') {
        // 完全拒付：红底+❌
        var tipBlk = '\u5E93\u7A7A\u4E3A\u96F6\u00B7\u8BCF\u4E0D\u5F97\u884C\u00B7\u8BF7 ' + (r.requested||0) + ' \u4E00\u6587\u672A\u62E8' + (r.reason?'\u3010'+r.reason+'\u3011':'');
        out.push('<span class="tr-reason-chip" title="' + escHtml(tipBlk) + '" style="background:rgba(192,64,48,0.18);border:1px solid var(--vermillion-400);color:#fef4e8;">\u274C ' + label + '<span style="margin-left:6px;color:#fbd8d0;">\u8BF7' + _rucFmtBig(r.requested||0) + '\u00B7\u672A\u62E8</span></span>');
      } else if (short > 0) {
        // 部分执行：橙框+亏欠标记
        var reqTxt = r.requested ? ('/\u8BF7' + _rucFmtBig(r.requested)) : '';
        var tipShort = '\u8BF7 ' + (r.requested||0) + '\u00B7\u4EC5\u62E8 ' + (r.amount||0) + '\u00B7\u4E8F\u7A7A ' + short + (r.reason?'\u3010'+r.reason+'\u3011':'');
        out.push('<span class="tr-reason-chip danger" title="' + escHtml(tipShort) + '" style="border-color:var(--vermillion-400);color:#d4706a;">\u2757' + label + reqTxt + '<span class="v">' + signChar + _rucFmtBig(r.amount||0) + '</span><span style="color:var(--vermillion-400);margin-left:4px;font-size:0.85em;">\u4E8F' + _rucFmtBig(short) + '</span></span>');
      } else {
        out.push('<span class="tr-reason-chip ' + signCls + '" title="' + tip + '">' + label + '<span class="v">' + signChar + _rucFmtBig(r.amount||0) + '</span></span>');
      }
    });
    return out;
  }

  // ═══ ② 财政·帑廪 ═══
  if (GM.guoku) {
    var og = GM._prevGuoku || {};
    var ng = GM.guoku;
    var gItems = [];
    var _fExp = GM._lastFixedExpense || {};
    var _sal = _fExp.salary && _fExp.salary.money || 0;
    var _arm = _fExp.army && _fExp.army.money || 0;
    var _imp = _fExp.imperial && _fExp.imperial.money || 0;
    var turnIn = ng.turnIncome || 0;
    var turnOut = ng.turnExpense || 0;
    // 钱
    if (typeof ng.money === 'number') {
      var moneyReasons = [];
      if (turnIn > 0) moneyReasons.push('<span class="tr-reason-chip pos">\u5C81\u5165<span class="v">+' + _rucFmtBig(turnIn) + '</span></span>');
      if (_sal > 0) moneyReasons.push('<span class="tr-reason-chip neg">\u4FF8\u7984<span class="v">\u2212' + _rucFmtBig(_sal) + '</span></span>');
      if (_arm > 0) moneyReasons.push('<span class="tr-reason-chip neg">\u519B\u9972<span class="v">\u2212' + _rucFmtBig(_arm) + '</span></span>');
      if (_imp > 0) moneyReasons.push('<span class="tr-reason-chip neg">\u5BAB\u5EF7<span class="v">\u2212' + _rucFmtBig(_imp) + '</span></span>');
      // ★ 追加 AI/玩家触发的一次性调整
      Array.prototype.push.apply(moneyReasons, _collectFiscalAdjChips('guoku', 'money'));
      gItems.push({ic:'\u94B1', name:'\u94F6\u4E24', unit:'\u4E24', ov:og.money, nv:ng.money, reasonsHtml: moneyReasons.join('')});
    }
    if (typeof ng.grain === 'number') {
      var grainR = [];
      var turnGIn = ng.turnGrainIncome || 0;
      var turnGOut = ng.turnGrainExpense || 0;
      if (turnGIn > 0) grainR.push('<span class="tr-reason-chip pos">\u6F15\u7CAE<span class="v">+' + _rucFmtBig(turnGIn) + '</span></span>');
      if (turnGOut > 0) grainR.push('<span class="tr-reason-chip neg">\u652F\u7528<span class="v">\u2212' + _rucFmtBig(turnGOut) + '</span></span>');
      Array.prototype.push.apply(grainR, _collectFiscalAdjChips('guoku', 'grain'));
      gItems.push({ic:'\u7CAE', name:'\u7CAE\u7C73', unit:'\u77F3', ov:og.grain, nv:ng.grain, reasonsHtml: grainR.join('')});
    }
    if (typeof ng.cloth === 'number') {
      var clothR = _collectFiscalAdjChips('guoku', 'cloth');
      if (clothR.length === 0) clothR.push('<span class="tr-reason-txt">\u7EC7\u67D3\u4E0A\u89E3\u00B7\u8D4F\u8D50\u6263\u51CF</span>');
      gItems.push({ic:'\u5E03', name:'\u5E03\u5339', unit:'\u5339', ov:og.cloth, nv:ng.cloth, reasonsHtml: clothR.join('')});
    }
    if (typeof ng.monthlyIncome === 'number') {
      gItems.push({ic:'\u6708', name:'\u6708\u5165', sub:'\u4E24/\u6708', ov:og.monthlyIncome, nv:ng.monthlyIncome, reasonsHtml: '<span class="tr-reason-txt">\u7A0E\u6536\u7EA7\u8054\u4E0A\u89E3\u4E2D\u592E</span>'});
    }
    if (gItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-guoku">';
      var netTxt = '';
      if (turnIn > 0 || turnOut > 0) {
        var net = turnIn - turnOut;
        netTxt = '\u5C81\u5165 ' + _rucFmtBig(turnIn) + '\u4E24 / \u5C81\u51FA ' + _rucFmtBig(turnOut) + '\u4E24' + (net>=0?' \u00B7 \u7ED3\u4F59 ':' \u00B7 \u4E8F\u7A7A ') + _rucFmtBig(Math.abs(net)) + '\u4E24';
      }
      // 赤字警告条
      var _gDefLines = [];
      ['money','grain','cloth'].forEach(function(r){
        var v = Number(ng[r]);
        if (typeof v === 'number' && v < 0) {
          var rl = r==='money'?'银':r==='grain'?'粮':'布';
          _gDefLines.push(rl + ' ' + _rucFmtBig(v));
        }
      });
      if (_gDefLines.length > 0) {
        var _streak = GM._fiscalDeficitStreak || 1;
        html += '<div class="tr-cg-hdr" style="background:linear-gradient(to right,rgba(192,64,48,0.15),transparent);border-left:3px solid var(--vermillion-400);"><div class="ic" style="background:var(--vermillion-400);color:#fef4e8;">\u2757</div><div class="lab" style="color:#d4706a;">\u8D4C\u7A7A\u5728\u5E93\uFF01\u6301\u7EED ' + _streak + ' \u56DE\u5408</div><div class="sub" style="color:#c04030;">' + _gDefLines.join(' \u00B7 ') + '</div></div>';
      }
      html += '<div class="tr-cg-hdr"><div class="ic">\u5E11</div><div class="lab">\u5E11 \u5EAA \u00B7 \u4E2D \u592E \u56FD \u5E93</div>';
      if (netTxt) html += '<div class="sub">' + escHtml(netTxt) + '</div>';
      html += '<div class="count">' + gItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      gItems.forEach(function(it){
        html += '<div class="tr-cg-item">';
        html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.sub || it.unit || '') + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, _rucFmtBig, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reasonsHtml||'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  // ═══ ③ 财政·内帑 ═══
  if (GM.neitang) {
    var on = GM._prevNeitang || {};
    var nn = GM.neitang;
    var nItems = [];
    if (typeof nn.money === 'number') {
      var nMoneyR = _collectFiscalAdjChips('neitang', 'money');
      if (nMoneyR.length === 0) nMoneyR.push('<span class="tr-reason-txt">\u5185\u5EF7\u6536\u652F\u00B7\u5F92\u5FA1\u8D4F\u8D50</span>');
      nItems.push({ic:'\u94B1', name:'\u94F6\u4E24', unit:'\u4E24', ov:on.money, nv:nn.money, reasonsHtml: nMoneyR.join('')});
    }
    if (typeof nn.grain === 'number') {
      var nGrainR = _collectFiscalAdjChips('neitang', 'grain');
      if (nGrainR.length === 0) nGrainR.push('<span class="tr-reason-txt">\u5F9D\u8180\u00B7\u5BAB\u7528\u6D88\u8017</span>');
      nItems.push({ic:'\u7CAE', name:'\u7CAE\u7C73', unit:'\u77F3', ov:on.grain, nv:nn.grain, reasonsHtml: nGrainR.join('')});
    }
    if (typeof nn.cloth === 'number') {
      var nClothR = _collectFiscalAdjChips('neitang', 'cloth');
      if (nClothR.length === 0) nClothR.push('<span class="tr-reason-txt">\u5BAB\u4E2D\u8D50\u8D21</span>');
      nItems.push({ic:'\u5E03', name:'\u5E03\u5339', unit:'\u5339', ov:on.cloth, nv:nn.cloth, reasonsHtml: nClothR.join('')});
    }
    if (typeof nn.huangzhuangAcres === 'number') nItems.push({ic:'\u5E84', name:'\u7687\u5E84', unit:'\u4EA9', ov:on.huangzhuangAcres, nv:nn.huangzhuangAcres, reasonsHtml: '<span class="tr-reason-txt">\u4ECA\u5C81\u65B0\u8F9F/\u5931\u7BA1</span>'});
    if (nItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-neitang">';
      // 赤字警告条
      var _nDefLines = [];
      ['money','grain','cloth'].forEach(function(r){
        var v = Number(nn[r]);
        if (typeof v === 'number' && v < 0) {
          var rl = r==='money'?'银':r==='grain'?'粮':'布';
          _nDefLines.push(rl + ' ' + _rucFmtBig(v));
        }
      });
      if (_nDefLines.length > 0) {
        html += '<div class="tr-cg-hdr" style="background:linear-gradient(to right,rgba(192,64,48,0.15),transparent);border-left:3px solid var(--vermillion-400);"><div class="ic" style="background:var(--vermillion-400);color:#fef4e8;">\u2757</div><div class="lab" style="color:#d4706a;">\u5185\u5E11\u8D4C\u7A7A</div><div class="sub" style="color:#c04030;">' + _nDefLines.join(' \u00B7 ') + '</div></div>';
      }
      html += '<div class="tr-cg-hdr"><div class="ic">\u5185</div><div class="lab">\u5185 \u5E11 \u00B7 \u7687 \u5BB6 \u79C1 \u5E93</div>';
      html += '<div class="sub">\u9669\u5E1D\u79C1\u5E91\u00B7\u4E0E\u5916\u5E1C\u5206\u79FB</div>';
      html += '<div class="count">' + nItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      nItems.forEach(function(it){
        html += '<div class="tr-cg-item">';
        html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.unit||'') + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, _rucFmtBig, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reasonsHtml||'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  // ═══ ④ 户口 ═══
  if (GM.population && GM.population.national) {
    var op = (GM._prevPopulation && GM._prevPopulation.national) || {};
    var opAll = GM._prevPopulation || {};
    var np = GM.population.national;
    var npAll = GM.population;
    var pItems = [];
    if (typeof np.households === 'number') pItems.push({ic:'\u6237', name:'\u6237 \u6570', sub:'\u5728\u7C4D', ov:op.households, nv:np.households, reasonsHtml:'<span class="tr-reason-txt">\u65B0\u518C\u00B7\u9003\u6237\u00B7\u65B0\u5206\u6237</span>'});
    if (typeof np.mouths === 'number') pItems.push({ic:'\u53E3', name:'\u53E3 \u6570', sub:'\u5728\u7C4D', ov:op.mouths, nv:np.mouths, reasonsHtml:'<span class="tr-reason-txt">\u65B0\u751F\u00B7\u6B7B\u4EA1\u00B7\u9003\u6563</span>'});
    if (typeof np.ding === 'number') pItems.push({ic:'\u4E01', name:'\u4E01 \u53E3', sub:'\u53EF\u5F81\u5F79', ov:op.ding, nv:np.ding, reasonsHtml:'<span class="tr-reason-txt">\u62BD\u4E01\u00B7\u8015\u8FC1\u00B7\u4F24\u4EA1\u8017\u635F</span>'});
    if (typeof npAll.fugitives === 'number') {
      var fCls = (npAll.fugitives > (opAll.fugitives||0)) ? 'danger' : '';
      pItems.push({ic:'\u9003', name:'\u9003 \u6237', sub:'\u5931\u7C4D', ov:opAll.fugitives, nv:npAll.fugitives, cls: fCls, reasonsHtml:'<span class="tr-reason-txt">\u65F1\u707E\u00B7\u6D2A\u707E\u00B7\u8D4B\u5F79\u52A0\u91CD\u00B7\u6C11\u9003\u6C5F\u6DEE</span>'});
    }
    if (typeof npAll.hiddenCount === 'number') pItems.push({ic:'\u9690', name:'\u9690 \u6237', sub:'\u8C6A\u7EC5\u836B\u5E87', ov:opAll.hiddenCount, nv:npAll.hiddenCount, cls: 'warn', reasonsHtml:'<span class="tr-reason-txt">\u5730\u65B9\u8C6A\u7EC5\u9690\u533F\u4F43\u6237\u8EB2\u4E01\u5DEE</span>'});
    if (pItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-hukou">';
      html += '<div class="tr-cg-hdr"><div class="ic">\u6237</div><div class="lab">\u6237 \u53E3 \u00B7 \u4E01 \u7C4D</div>';
      html += '<div class="sub">\u6237\u90E8\u9EC4\u518C\u00B7\u5730\u65B9\u9047\u62A5</div>';
      html += '<div class="count">' + pItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      pItems.forEach(function(it){
        html += '<div class="tr-cg-item' + (it.cls?' '+it.cls:'') + '">';
        html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.sub||'') + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, _rucFmtBig, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reasonsHtml||'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  // ═══ ⑤ 政治核心（七大变量/vars）═══
  var politicItems = [];
  if (GM.turnChanges && GM.turnChanges.variables) {
    GM.turnChanges.variables.forEach(function(vc){
      var ov = Math.round(vc.oldValue||0), nv = Math.round(vc.newValue||0);
      if (ov === nv) return;
      var name = vc.name || '';
      // 只纳入政治类（非财政类：国库/内帑等已单独）
      if (/\u56FD\u5E93|\u5185\u5E91|\u8D22\u4EA7/.test(name)) return;
      var iconMap = {'\u7687\u6743':'\u6743','\u7687\u5A01':'\u5A01','\u6C11\u5FC3':'\u5FC3','\u541B\u81E3':'\u541B','\u515A\u4E89':'\u515A','\u5173\u5916\u4EA4':'\u5916','\u5927\u519B':'\u5175','\u540F\u6CBB':'\u540F','\u8150\u8D25':'\u8150','\u7A0E\u6536\u7387':'\u7A0E','\u540D\u671B':'\u540D','\u8D24\u80FD':'\u8D24'};
      var ic = iconMap[name] || (name.charAt(0));
      politicItems.push({ic:ic, name:name, ov:ov, nv:nv, reasons:vc.reasons||[]});
    });
  }
  // 核心指标（CORE_METRIC_LABELS）
  if (typeof CORE_METRIC_LABELS === 'object') {
    Object.keys(CORE_METRIC_LABELS).forEach(function(k) {
      if (typeof GM[k] !== 'number') return;
      var nv = Math.round(GM[k]);
      var prevKey = '_prev_' + k;
      var ov = Math.round(GM[prevKey] !== undefined ? GM[prevKey] : nv);
      if (nv === ov) return;
      var label = CORE_METRIC_LABELS[k] || k;
      if (/\u56FD\u5E93|\u5185\u5E91/.test(label)) return;
      politicItems.push({ic:label.charAt(0), name:label, ov:ov, nv:nv, reasons:[]});
    });
  }
  if (politicItems.length > 0) {
    html += '<div class="tr-cg-block tr-cg-politic">';
    html += '<div class="tr-cg-hdr"><div class="ic">\u653F</div><div class="lab">\u653F \u6CBB \u6838 \u5FC3</div>';
    html += '<div class="sub">\u6838\u5FC3\u53D8\u91CF\u00B7\u541B\u5FC3\u6240\u7CFB</div>';
    html += '<div class="count">' + politicItems.length + ' \u9879</div></div>';
    html += '<div class="tr-cg-items">';
    politicItems.forEach(function(it){
      var deltaD = it.nv - it.ov;
      var itCls = deltaD < -3 ? ' warn' : '';
      html += '<div class="tr-cg-item' + itCls + '">';
      html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + '</div>';
      html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, function(v){return Math.round(v||0).toString();}, '') + '</div>';
      html += '<div class="tr-cg-reasons">' + _rucReasonChips(it.reasons) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // ═══ ⑥ 军事 ═══
  if (GM.turnChanges && GM.turnChanges.military && GM.turnChanges.military.length > 0) {
    var mItems = [];
    GM.turnChanges.military.forEach(function(mc){
      (mc.changes||[]).forEach(function(ch){
        var fMap = {'soldiers':'\u5175\u529B','morale':'\u58EB\u6C14','training':'\u8BAD\u7EC3','supply':'\u8865\u7ED9'};
        var fN = fMap[ch.field] || ch.field;
        var icMap = {'soldiers':'\u5175','morale':'\u58EB','training':'\u8BAD','supply':'\u8865'};
        mItems.push({name:mc.name, field:fN, ic:icMap[ch.field]||'\u519B', ov:ch.oldValue||0, nv:ch.newValue||0, reason:ch.reason||''});
      });
    });
    if (mItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-military">';
      html += '<div class="tr-cg-hdr"><div class="ic">\u519B</div><div class="lab">\u519B \u4E8B \u00B7 \u519B \u961F \u52A8 \u6001</div>';
      html += '<div class="sub">\u5404\u519B\u56E2 \u5175/\u58EB/\u8BAD/\u8865</div>';
      html += '<div class="count">' + mItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      mItems.forEach(function(it){
        var d = (it.nv||0) - (it.ov||0);
        var cls = d < -5 ? ' warn' : (d < -10 ? ' danger' : '');
        html += '<div class="tr-cg-item' + cls + '">';
        html += '<div class="tr-cg-name"><span class="mini-ic">' + it.ic + '</span>' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, function(v){return _rucFmtBig(v);}, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reason?'<span class="tr-reason-txt">'+escHtml(it.reason)+'</span>':'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  // ═══ ⑦ 势力 ═══
  if (GM.turnChanges && GM.turnChanges.factions && GM.turnChanges.factions.length > 0) {
    var fItems = [];
    GM.turnChanges.factions.forEach(function(fc){
      (fc.changes||[]).forEach(function(ch){
        var fMap = {'strength':'\u5B9E\u529B','economy':'\u7ECF\u6D4E','playerRelation':'\u5BF9\u5DF1\u5173\u7CFB','attitude':'\u6001\u5EA6'};
        var fN = fMap[ch.field] || ch.field;
        fItems.push({name:fc.name, field:fN, ov:ch.oldValue||0, nv:ch.newValue||0, reason:ch.reason||''});
      });
    });
    if (fItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-faction">';
      html += '<div class="tr-cg-hdr"><div class="ic">\u52BF</div><div class="lab">\u5929 \u4E0B \u52BF \u529B \u52A8 \u6001</div>';
      html += '<div class="count">' + fItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      fItems.forEach(function(it){
        var d = (it.nv||0) - (it.ov||0);
        var cls = (it.name && /\u540E\u91D1|\u53CD\u519B|\u8D3C\u5BC7|\u53DB\u519B/.test(it.name) && d > 0) ? ' danger' : '';
        html += '<div class="tr-cg-item' + cls + '">';
        html += '<div class="tr-cg-name">' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, function(v){return Math.round(v||0).toString();}, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reason?'<span class="tr-reason-txt">'+escHtml(it.reason)+'</span>':'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  // ═══ ⑧ 党派 ═══
  if (GM.turnChanges && GM.turnChanges.parties && GM.turnChanges.parties.length > 0) {
    var ptyItems = [];
    GM.turnChanges.parties.forEach(function(pc){
      (pc.changes||[]).forEach(function(ch){
        var fMap = {'influence':'\u5F71\u54CD\u529B','satisfaction':'\u6EE1\u610F\u5EA6','cohesion':'\u51DD\u805A\u529B'};
        // 跳过非数字字段（如 status/new_agenda）·避免 Math.round('活跃') 产生 NaN
        if (!fMap[ch.field] || typeof ch.oldValue !== 'number' || typeof ch.newValue !== 'number') return;
        ptyItems.push({name:pc.name, field:fMap[ch.field], ov:ch.oldValue||0, nv:ch.newValue||0, reason:ch.reason||''});
      });
    });
    if (ptyItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-party">';
      html += '<div class="tr-cg-hdr"><div class="ic">\u515A</div><div class="lab">\u671D \u4E2D \u515A \u6D3E</div>';
      html += '<div class="count">' + ptyItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      ptyItems.forEach(function(it){
        html += '<div class="tr-cg-item">';
        html += '<div class="tr-cg-name">' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, function(v){return Math.round(v||0).toString();}, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reason?'<span class="tr-reason-txt">'+escHtml(it.reason)+'</span>':'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  // ═══ ⑨ 阶层 ═══
  if (GM.turnChanges && GM.turnChanges.classes && GM.turnChanges.classes.length > 0) {
    var clsItems = [];
    GM.turnChanges.classes.forEach(function(cc){
      (cc.changes||[]).forEach(function(ch){
        var fMap = {'satisfaction':'\u6EE1\u610F\u5EA6','influence':'\u5F71\u54CD\u529B','population':'\u4EBA\u53E3'};
        if (!fMap[ch.field] || typeof ch.oldValue !== 'number' || typeof ch.newValue !== 'number') return;
        clsItems.push({name:cc.name, field:fMap[ch.field], ov:ch.oldValue||0, nv:ch.newValue||0, reason:ch.reason||''});
      });
    });
    if (clsItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-class">';
      html += '<div class="tr-cg-hdr"><div class="ic">\u9636</div><div class="lab">\u9636 \u5C42 \u52A8 \u6001</div>';
      html += '<div class="count">' + clsItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      clsItems.forEach(function(it){
        html += '<div class="tr-cg-item">';
        html += '<div class="tr-cg-name">' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, function(v){return Math.round(v||0).toString();}, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reason?'<span class="tr-reason-txt">'+escHtml(it.reason)+'</span>':'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  // ═══ ⑩ 人物 ═══
  if (GM.turnChanges && GM.turnChanges.characters && GM.turnChanges.characters.length > 0) {
    var chItems = [];
    GM.turnChanges.characters.forEach(function(cc){
      (cc.changes||[]).forEach(function(ch){
        var fMap = {'loyalty':'\u5FE0\u8BDA','ambition':'\u91CE\u5FC3','stress':'\u538B\u529B','influence':'\u5F71\u54CD\u529B','strength':'\u5B9E\u529B'};
        if (!fMap[ch.field]) return;
        chItems.push({name:cc.name, field:fMap[ch.field], ov:ch.oldValue||0, nv:ch.newValue||0, reason:ch.reason||''});
      });
    });
    if (chItems.length > 0) {
      html += '<div class="tr-cg-block tr-cg-char">';
      html += '<div class="tr-cg-hdr"><div class="ic">\u4EBA</div><div class="lab">\u4EBA \u7269 \u52A8 \u6001</div>';
      html += '<div class="sub">\u6838\u5FC3\u4EBA\u81E3 \u00B7 \u5FE0/\u91CE/\u538B/\u5F71</div>';
      html += '<div class="count">' + chItems.length + ' \u9879</div></div>';
      html += '<div class="tr-cg-items">';
      chItems.slice(0, 12).forEach(function(it){
        var d = (it.nv||0) - (it.ov||0);
        var isDanger = (it.field === '\u5FE0\u8BDA' && d < -5) || (it.field === '\u538B\u529B' && d > 10);
        var isWarn = (it.field === '\u5FE0\u8BDA' && d < 0) || (it.field === '\u538B\u529B' && d > 5);
        var cls = isDanger ? ' danger' : (isWarn ? ' warn' : '');
        html += '<div class="tr-cg-item' + cls + '">';
        html += '<div class="tr-cg-name">' + escHtml(it.name) + ' <span class="sub-lbl">' + escHtml(it.field) + '</span></div>';
        html += '<div class="tr-cg-vals">' + _rucValHtml(it.ov, it.nv, function(v){return Math.round(v||0).toString();}, '') + '</div>';
        html += '<div class="tr-cg-reasons">' + (it.reason?'<span class="tr-reason-txt">'+escHtml(it.reason)+'</span>':'') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
  }

  if (!html) return '';
  return '<div class="turn-section unified-changes"><h3>\u6570 \u503C \u53D8 \u5316 \u00B7 \u5206 \u7C7B \u8BE6 \u6CE8</h3><div class="tr-changes-wrap">' + html + '</div></div>';
}

/** v1 保留（未用·若外部仍调则走 fallback 渲染） */
function _renderUnifiedChangesLegacy(oldVars) {
  oldVars = oldVars || {};
  var groups = {
    '\u8981\u70B9': [],   // 本回合要点（最突出的几项变化）
    '\u8D22\u653F': [],   // 财政
    '\u5730\u65B9': [],   // 地方
    '\u519B\u4E8B': [],   // 军事
    '\u653F\u6CBB': [],   // 政治
    '\u52BF\u529B': [],   // 势力
    '\u515A\u6D3E': [],   // 党派
    '\u9636\u5C42': [],   // 阶层
    '\u4EBA\u7269': []    // 人物
  };

  // —— 本回合要点（最突出的 NPC 忠诚/势力实力/伤疤/阴谋/NPC 行动） ——
  (function _collectHighlights(){
    // 忠诚变动最大的角色
    if (GM.turnChanges && GM.turnChanges.characters) {
      var _maxLoyD = 0, _maxLoyInfo = null;
      GM.turnChanges.characters.forEach(function(cc) {
        (cc.changes||[]).forEach(function(ch) {
          if (ch.field === 'loyalty' && Math.abs(ch.newValue - ch.oldValue) > _maxLoyD) {
            _maxLoyD = Math.abs(ch.newValue - ch.oldValue);
            _maxLoyInfo = { name: cc.name, d: ch.newValue - ch.oldValue, nv: ch.newValue };
          }
        });
      });
      if (_maxLoyInfo && _maxLoyD >= 5) {
        groups['\u8981\u70B9'].push(_maxLoyInfo.name + ' \u5FE0\u8BDA' + (_maxLoyInfo.d > 0 ? '+' : '') + _maxLoyInfo.d + '\uFF08\u2192' + _maxLoyInfo.nv + '\uFF09');
      }
    }
    // 实力变化最大的势力
    if (GM.turnChanges && GM.turnChanges.factions) {
      var _maxStrD = 0, _maxStrInfo = null;
      GM.turnChanges.factions.forEach(function(fc) {
        (fc.changes||[]).forEach(function(ch) {
          if (ch.field === 'strength' && Math.abs(ch.newValue - ch.oldValue) > _maxStrD) {
            _maxStrD = Math.abs(ch.newValue - ch.oldValue);
            _maxStrInfo = { name: fc.name, d: ch.newValue - ch.oldValue };
          }
        });
      });
      if (_maxStrInfo && _maxStrD >= 3) {
        groups['\u8981\u70B9'].push(_maxStrInfo.name + ' \u5B9E\u529B' + (_maxStrInfo.d > 0 ? '+' : '') + _maxStrInfo.d);
      }
    }
    // 新伤疤
    if (GM.chars) {
      GM.chars.forEach(function(c) {
        if (c._scars && c._scars.length > 0) {
          var newest = c._scars[c._scars.length - 1];
          if (newest.turn === GM.turn - 1) groups['\u8981\u70B9'].push(c.name + '\uFF1A' + newest.event);
        }
      });
    }
    // 新阴谋
    if (GM.activeSchemes) {
      GM.activeSchemes.forEach(function(s) {
        if (s.startTurn === GM.turn - 1) groups['\u8981\u70B9'].push(s.schemer + ' \u5BC6\u8C0B' + (s.target ? '\u9488\u5BF9' + s.target : ''));
      });
    }
    // 最重要NPC行动
    if (GM.evtLog) {
      var _topNpcEvt = GM.evtLog.filter(function(e){ return e.type === 'NPC\u81EA\u4E3B' && e.turn === GM.turn - 1; })[0];
      if (_topNpcEvt) groups['\u8981\u70B9'].push(_topNpcEvt.text || '');
    }
  })();

  // 判断指标是否与地方/省份有关
  function _isLocal(name) {
    return /\u6C11\u5FC3|\u53DB\u4E71|\u7A0E\u6536|\u707E\u5BB3|\u4EBA\u53E3|\u7E41\u8363/.test(name) &&
      !/\u56FD\u5E93|\u5185\u5E91|\u8D22\u4EA7/.test(name);
  }

  // —— 岁入岁出总览（每回合固定显示，优先级最高） ——
  (function _collectFiscalSummary() {
    try {
      var g = GM.guoku;
      if (!g) return;
      var turnIn = g.turnIncome || 0;
      var turnInG = g.turnGrainIncome || 0;
      var turnOut = g.turnExpense || 0;
      var turnOutG = g.turnGrainExpense || 0;
      var net = turnIn - turnOut;
      var unit = (typeof CurrencyUnit !== 'undefined' && CurrencyUnit.getUnit) ? CurrencyUnit.getUnit() : { money: '两', grain: '石' };
      var _fmt = function(v) { v = Math.round(v); if (Math.abs(v) >= 1e4) return (v/1e4).toFixed(1) + '万'; return String(v); };
      if (turnIn > 0 || turnOut > 0) {
        groups['\u8D22\u653F'].push('本回合岁入 ' + _fmt(turnIn) + unit.money + (turnInG > 0 ? ' ' + _fmt(turnInG) + unit.grain : '') + '（税收级联上解中央）');
        var feBreakdown = GM._lastFixedExpense;
        if (feBreakdown) {
          var sal = feBreakdown.salary && feBreakdown.salary.money || 0;
          var arm = feBreakdown.army && feBreakdown.army.money || 0;
          var imp = feBreakdown.imperial && feBreakdown.imperial.money || 0;
          groups['\u8D22\u653F'].push('本回合岁出 ' + _fmt(turnOut) + unit.money + ' ：俸禄 ' + _fmt(sal) + ' · 军饷 ' + _fmt(arm) + ' · 宫廷 ' + _fmt(imp));
        } else {
          groups['\u8D22\u653F'].push('本回合岁出 ' + _fmt(turnOut) + unit.money + '（俸禄+军饷+宫廷）');
        }
        var netLbl = net >= 0 ? '结余' : '亏空';
        groups['\u8D22\u653F'].push(netLbl + ' ' + _fmt(Math.abs(net)) + unit.money + '（' + (net >= 0 ? '+' : '−') + '入库）');
      }
    } catch(_fsE) {}
  })();

  // —— 财政（核心指标+财务明细）——
  var _fiscalKeys = /\u56FD\u5E93|\u5185\u5E91|\u8D22\u4EA7|\u8C0B\u8FC6|\u6536\u5165|\u652F\u51FA|\u7A0E\u6536\u7387/;
  if (GM.turnChanges && GM.turnChanges.variables) {
    GM.turnChanges.variables.forEach(function(vc) {
      var name = vc.name || '';
      var ov = Math.round(vc.oldValue||0), nv = Math.round(vc.newValue||0);
      var d = nv - ov;
      if (d === 0) return;
      var reason = (vc.reasons && vc.reasons.length>0) ? vc.reasons.map(function(r){return r.desc||r.type||'';}).filter(Boolean).slice(0,3).join('、') : '';
      var line = name + '（' + ov.toLocaleString() + ' → ' + nv.toLocaleString() + '）' + (reason?'：'+reason:'');
      if (_fiscalKeys.test(name)) groups['\u8D22\u653F'].push(line);
      else if (_isLocal(name)) groups['\u5730\u65B9'].push(line);
      else groups['\u653F\u6CBB'].push(line);
    });
  }

  // —— 核心指标（prestige/unrest等）——
  if (typeof CORE_METRIC_LABELS === 'object') {
    Object.keys(CORE_METRIC_LABELS).forEach(function(k) {
      if (typeof GM[k] !== 'number') return;
      var nv = Math.round(GM[k]);
      var prevKey = '_prev_' + k;
      var ov = Math.round(GM[prevKey] !== undefined ? GM[prevKey] : nv);
      if (nv === ov) return;
      var label = CORE_METRIC_LABELS[k] || k;
      groups['\u653F\u6CBB'].push(label + '（' + ov + ' → ' + nv + '）');
    });
  }

  // —— 军事（军队变化）——
  if (GM.turnChanges && GM.turnChanges.military) {
    GM.turnChanges.military.forEach(function(mc) {
      (mc.changes||[]).forEach(function(ch) {
        var _fN = ch.field === 'soldiers' ? '\u5175\u529B' : ch.field === 'morale' ? '\u58EB\u6C14' : ch.field === 'training' ? '\u8BAD\u7EC3' : ch.field === 'supply' ? '\u8865\u7ED9' : ch.field;
        var line = mc.name + ' ' + _fN + '（' + (ch.oldValue||0) + ' → ' + (ch.newValue||0) + '）' + (ch.reason?'：'+ch.reason:'');
        groups['\u519B\u4E8B'].push(line);
      });
    });
  }

  // —— 势力 ——
  if (GM.turnChanges && GM.turnChanges.factions) {
    GM.turnChanges.factions.forEach(function(fc) {
      (fc.changes||[]).forEach(function(ch) {
        var _fN = ch.field === 'strength' ? '\u5B9E\u529B' : ch.field === 'economy' ? '\u7ECF\u6D4E' : ch.field === 'playerRelation' ? '\u5BF9\u5DF1\u5173\u7CFB' : ch.field;
        var line = fc.name + ' ' + _fN + '（' + (ch.oldValue||0) + ' → ' + (ch.newValue||0) + '）' + (ch.reason?'：'+ch.reason:'');
        groups['\u52BF\u529B'].push(line);
      });
    });
  }

  // —— 党派 ——
  if (GM.turnChanges && GM.turnChanges.parties) {
    GM.turnChanges.parties.forEach(function(pc) {
      (pc.changes||[]).forEach(function(ch) {
        var _fN = ch.field === 'influence' ? '\u5F71\u54CD\u529B' : ch.field === 'satisfaction' ? '\u6EE1\u610F\u5EA6' : ch.field === 'status' ? '\u72B6\u6001' : ch.field;
        // 数字字段 fallback 0；非数字字段原样显示
        var _ov = (typeof ch.oldValue === 'number' || typeof ch.oldValue === 'string') ? ch.oldValue : 0;
        var _nv = (typeof ch.newValue === 'number' || typeof ch.newValue === 'string') ? ch.newValue : 0;
        var line = pc.name + ' ' + _fN + '（' + _ov + ' → ' + _nv + '）' + (ch.reason?'：'+ch.reason:'');
        groups['\u515A\u6D3E'].push(line);
      });
    });
  }

  // —— 阶层 ——
  if (GM.turnChanges && GM.turnChanges.classes) {
    GM.turnChanges.classes.forEach(function(cc) {
      (cc.changes||[]).forEach(function(ch) {
        var _fN = ch.field === 'satisfaction' ? '\u6EE1\u610F\u5EA6' : ch.field === 'influence' ? '\u5F71\u54CD\u529B' : ch.field;
        var line = cc.name + ' ' + _fN + '（' + (ch.oldValue||0) + ' → ' + (ch.newValue||0) + '）' + (ch.reason?'：'+ch.reason:'');
        groups['\u9636\u5C42'].push(line);
      });
    });
  }

  // —— 人物 ——
  if (GM.turnChanges && GM.turnChanges.characters) {
    GM.turnChanges.characters.forEach(function(cc) {
      (cc.changes||[]).forEach(function(ch) {
        var _fN = {'loyalty':'\u5FE0\u8BDA','ambition':'\u91CE\u5FC3','stress':'\u538B\u529B','influence':'\u5F71\u54CD\u529B','strength':'\u5B9E\u529B'}[ch.field] || ch.field;
        var line = cc.name + ' ' + _fN + '（' + (ch.oldValue||0) + ' → ' + (ch.newValue||0) + '）' + (ch.reason?'：'+ch.reason:'');
        groups['\u4EBA\u7269'].push(line);
      });
    });
  }

  // —— 渲染 ——
  var any = Object.keys(groups).some(function(k){return groups[k].length>0;});
  if (!any) return '';
  var html = '<div class="turn-section unified-changes"><h3>\u6570 \u503C \u53D8 \u5316 \u8BF4 \u660E</h3>';
  Object.keys(groups).forEach(function(gk) {
    if (groups[gk].length === 0) return;
    html += '<div style="margin-bottom:0.8rem;">';
    html += '<div style="font-size:0.78rem;color:var(--gold);font-weight:700;margin-bottom:0.3rem;letter-spacing:0.08em;">\u3010' + gk + '\u3011</div>';
    html += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.8;">';
    groups[gk].forEach(function(line) {
      html += '<div style="padding:0.15rem 0.4rem;border-bottom:1px dashed var(--color-border-subtle,rgba(255,255,255,0.05));">' + escHtml(line) + '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

// ============================================================
// 人事变动（从AI返回的personnel_changes数组渲染）
// 格式：姓名（原职）：变动描述
// ============================================================
function _renderPersonnelChanges(personnelChanges) {
  if (!personnelChanges || !personnelChanges.length) return '';
  // 推断 type → CSS class
  function _pcType(change, reason) {
    var s = (change||'') + ' ' + (reason||'');
    if (/\u6B81|\u5D29|\u75C5\u6B7B|\u8584\u5929|\u55E1|\u81EA\u5208/.test(s)) return {cls:'death', lbl:'\u6B81 \u6545'};
    if (/\u4EFB\u547D|\u62DC|\u6388|\u8865\u8BA1|\u85A6\u64A2|\u5C31\u4EFB|\u5152\u8D1F|\u4E0A\u4EFB/.test(s)) return {cls:'appoint', lbl:'\u4EFB \u547D'};
    if (/\u8FC1|\u64A2|\u5347|\u8FDB|\u5165\u9601|\u62DC\u5C06/.test(s)) return {cls:'promote', lbl:'\u8FC1 \u64A2'};
    if (/\u8D2C|\u964D|\u88AB\u8D2C|\u964D\u7EA7|\u9000\u804C/.test(s)) return {cls:'demote', lbl:'\u964D \u8C2A'};
    if (/\u5F52\u7530|\u81F4\u4EDD|\u9000\u4F11|\u4EF1\u5B85/.test(s)) return {cls:'retire', lbl:'\u81F4 \u4EDD'};
    if (/\u4E01\u5FE7|\u5B88\u5236/.test(s)) return {cls:'mourn', lbl:'\u4E01 \u5FE7'};
    if (/\u7F62|\u9769|\u51FA\u4EFB|\u88C1\u6492/.test(s)) return {cls:'fire', lbl:'\u7F62 \u5242'};
    if (/\u6DFB\u4E01|\u6DFB\u5B50|\u4EA7|\u751F|\u65B0\u751F/.test(s)) return {cls:'birth', lbl:'\u6DFB \u4E01'};
    return {cls:'appoint', lbl:'\u4EBA \u4E8B'};
  }
  var html = '<div class="tr-section personnel">';
  html += '<div class="tr-section-hdr"><span class="lab">\u4EBA \u4E8B \u53D8 \u52A8</span><span class="meta">\u8FC1 \u00B7 \u8C2A \u00B7 \u6B81 \u00B7 \u751F \u00B7 \u4EFB \u672C\u56DE\u5408 ' + personnelChanges.length + ' \u8D77</span></div>';
  html += '<div class="tr-personnel-list">';
  personnelChanges.forEach(function(pc) {
    if (!pc || !pc.name) return;
    var former = pc.former || pc.origin || '';
    var change = pc.change || pc.desc || '';
    var reason = pc.reason || '';
    var t = _pcType(change, reason);
    html += '<div class="tr-person-row ' + t.cls + '">';
    html += '<span class="type">' + t.lbl + '</span>';
    html += '<span class="who">' + escHtml(pc.name) + '</span>';
    html += '<span class="from-to">';
    if (former) html += escHtml(former) + ' <span class="arrow">\u2192</span> ';
    html += escHtml(change);
    if (reason) html += ' \uFF08' + escHtml(reason) + '\uFF09';
    html += '</span>';
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

