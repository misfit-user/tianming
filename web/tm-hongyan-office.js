// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-hongyan-office.js — 鸿雁传书 letter 主域 (R127·R161·R6 拆官制·20260706 第十五拆剥离 UI)
// Domain: 鸿雁信件 (letter·主域·唯一留守域) ── renderGameState / edict UI 已于第十五拆迁出
// Status: active · Last Updated: 2026-05-03 (Phase 3 R6·官制部分已拆到 tm-office-system.js)
// Owner: TM 团队
// Imports: tm-data-model·tm-utils·tm-player-core·TM.PromptComposer·SettlementPipeline·tm-office-system (cross-file·_off*·RANK_HIERARCHY·canPerformAction 等)
// Exports: ~30 top-level functions (主体: `_lt*` letter·sendLetter·`_hy*` hongyan·_settleLettersAndTravel·_generateLetterReply·renderLetterPanel·letterDoctor·letterDiag·LETTER_TYPES/TOKENS/CIPHERS·calcLetterDays·getLocationPromptInjection·renderGameState·_showEdictAdoptMenu·_renderEdictSuggestions·_renderPolishedEdict·_applyPolishedEdict)
// Used by: tm-game-loop·tm-renwu-ui·tm-letter-* smoke·index/editor.html
// Side effects: 全局 functions/vars·DOM (letter panel·主游戏 UI·edict 菜单)·GM.letters·SettlementPipeline.register('letters')
// Test: smoke-letter-full (15)·smoke-letter-intercept-react (29)
// Notes: R127 从 tm-player-actions.js L3304-end 拆出·R6 已 carve out 官制 (706 行) → tm-office-system.js
//        **第十五拆(20260706·中段切·保序等价)已完成**——本文件今只剩 letter 主域:
//          - letter (~1800·主域·_lt*·_hy*·sendLetter·_settleLettersAndTravel·register('letters')·letterDoctor/Diag)
//          - renderGameState (主游戏 UI 渲染) → tm-game-ui-shell.js (紧接本片装载)
//          - edict UI (_showEdict*·_polishEdicts·_renderPolishedEdict·_applyPolishedEdict) → tm-hongyan-edict-ui.js (三片连序)
// 姊妹: tm-player-settings.js·tm-player-core.js·tm-office-system.js (R6 新建)
//
// audit: web/docs/tm-hongyan-office-audit.md (待 R6 后 update)
// ============================================================

// ============================================================
// 鸿雁传书系统 — 信件传递+回复+结算+NPC来书+信使可见化
// ============================================================

function _hyPromptComposerAddon(ch) {
  var composer = (typeof TM !== 'undefined' && TM.PromptComposer) ? TM.PromptComposer : null;
  if (!composer || !ch) return '';
  var out = '';
  try {
    if (typeof composer.buildAiPersonaText === 'function') out += composer.buildAiPersonaText(ch) || '';
    if (typeof composer.buildRecognitionState === 'function') out += composer.buildRecognitionState(ch) || '';
  } catch (_) {}
  return out;
}

function _hyTurnsForMonths(months) {
  if (typeof turnsForMonths === 'function') return turnsForMonths(months);
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return Math.max(1, Math.ceil((months * 30) / Math.max(1, dpv)));
}

var _bnRenderTimer=0,_wyRenderTimer=0,_qjRenderTimer=0,_jiRenderTimer=0;
function _scheduleBiannianRender(delay){
  if(_bnRenderTimer)clearTimeout(_bnRenderTimer);
  _bnRenderTimer=setTimeout(function(){_bnRenderTimer=0;if(typeof renderBiannian==='function')renderBiannian();},delay==null?120:delay);
}
function _scheduleWenyuanRender(delay){
  if(_wyRenderTimer)clearTimeout(_wyRenderTimer);
  _wyRenderTimer=setTimeout(function(){_wyRenderTimer=0;if(typeof renderWenyuan==='function')renderWenyuan();},delay==null?120:delay);
}
function _scheduleQijuRender(delay){
  if(_qjRenderTimer)clearTimeout(_qjRenderTimer);
  _qjRenderTimer=setTimeout(function(){_qjRenderTimer=0;if(typeof renderQiju==='function')renderQiju();},delay==null?120:delay);
}
function _scheduleJishiRender(delay){
  if(_jiRenderTimer)clearTimeout(_jiRenderTimer);
  _jiRenderTimer=setTimeout(function(){_jiRenderTimer=0;if(typeof renderJishi==='function')renderJishi();},delay==null?120:delay);
}


var LETTER_TYPES = {
  // 玩家发信类型
  secret_decree: { label: '密旨', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 3, needsToken: 'seal', formal: false },
  military_order: { label: '征调令', css: 'lt-type-military', icon: 'troops', interceptWeight: 3, needsToken: 'tally', formal: true },
  greeting: { label: '问安函', css: 'lt-type-greeting', icon: 'person', interceptWeight: 0.5, needsToken: false, formal: false },
  personal: { label: '私函', css: 'lt-type-personal', icon: 'dialogue', interceptWeight: 1, needsToken: false, formal: false },
  proclamation: { label: '檄文', css: 'lt-type-proclamation', icon: 'event', interceptWeight: 0, needsToken: false, formal: false },
  formal_edict: { label: '正式诏令', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 2, needsToken: 'seal', formal: true },
  // NPC来信类型
  report: { label: '奏报', css: 'lt-type-military', icon: 'memorial', interceptWeight: 2, formal: true },
  plea: { label: '陈情', css: 'lt-type-personal', icon: 'person', interceptWeight: 1, formal: false },
  warning: { label: '急报', css: 'lt-type-military', icon: 'troops', interceptWeight: 2.5, formal: false },
  intelligence: { label: '密信', css: 'lt-type-secret', icon: 'scroll', interceptWeight: 3, formal: false },
  // R: AI prompt + tm-endturn-ai-infer.js emoMap 生产以下 4 种 type·此前未在字典里声明·UI 退化为"私函"
  thanks: { label: '谢恩', css: 'lt-type-personal', icon: 'memorial', interceptWeight: 0.8, formal: true },
  recommend: { label: '荐表', css: 'lt-type-personal', icon: 'person', interceptWeight: 1.2, formal: true },
  impeach: { label: '密告', css: 'lt-type-secret', icon: 'memorial', interceptWeight: 2.5, formal: false },
  condolence: { label: '吊唁', css: 'lt-type-personal', icon: 'memorial', interceptWeight: 0.5, formal: true },
  // 新增：馈赠、外交国书
  gift: { label: '附礼', css: 'lt-type-greeting', icon: 'treasury', interceptWeight: 0.5, formal: false },
  diplomatic: { label: '国书', css: 'lt-type-proclamation', icon: 'scroll', interceptWeight: 2, formal: true },
  // 跨势力自动诏令（tm-endturn-prep 给 _crossFaction 诏令派发）·走使节传递·和 diplomatic 同语义
  diplomatic_dispatch: { label: '外交文书', css: 'lt-type-proclamation', icon: 'scroll', interceptWeight: 2, formal: true }
};

/** 信物凭证系统 */
var LETTER_TOKENS = {
  seal: { label: '玺印', desc: '加盖玺印，彰显正统', icon: 'scroll' },
  tally: { label: '虎符', desc: '调兵凭证，无符不从', icon: 'troops' },
  gold_tablet: { label: '金牌', desc: '八百里加急专用信物', icon: 'treasury' }
};

/** 加密方式 */
var LETTER_CIPHERS = {
  none: { label: '不加密', interceptReadChance: 1.0, cost: 0 },
  yinfu: { label: '阴符', desc: '预设暗号体系', interceptReadChance: 0.2, cost: 0 },
  yinshu: { label: '阴书', desc: '拆分三份交不同信使', interceptReadChance: 0.05, cost: 0 },
  wax_ball: { label: '蜡丸', desc: '蜡封密函藏于身', interceptReadChance: 0.4, cost: 0 },
  silk_sewn: { label: '帛书缝衣', desc: '缝入衣裳夹层', interceptReadChance: 0.3, cost: 0 }
};

/** 估算两地信件传递天数（改进版） */
function calcLetterDays(fromLoc, toLoc, urgency) {
  if (!fromLoc || !toLoc || fromLoc === toLoc) return 1;
  // 古代驿站速度（里/天）：普通50里，加急300里，八百里加急800里
  var liPerDay = { normal: 50, urgent: 300, extreme: 800 };
  var speed = liPerDay[urgency] || 50;
  // 估算距离（里）——基于行政区划层级推断
  var li = 1000; // 默认中等距离
  if (_ltCheckSameProvince(fromLoc, toLoc)) li = 200;
  // 若两地名有共同前缀（同区域），距离近
  if (fromLoc.length >= 2 && toLoc.length >= 2 && fromLoc.slice(0,2) === toLoc.slice(0,2)) li = 150;
  return Math.max(1, Math.ceil(li / speed));
}
/** 检查两地是否在同一顶级行政区
 * R: 优先读 GM.adminHierarchy（运行时·会反映领土得失/侨置等动态变迁）·
 *    回退 P.adminHierarchy（剧本静态）·与 _renderDifangPanel 等模块一致
 */
function _ltCheckSameProvince(loc1, loc2) {
  var src = (typeof GM !== 'undefined' && GM.adminHierarchy) ? GM.adminHierarchy
          : (typeof P !== 'undefined' && P.adminHierarchy) ? P.adminHierarchy
          : null;
  if (!src) return false;
  var ah = src.player ? src.player : src[Object.keys(src)[0]];
  if (!ah || !ah.divisions) return false;
  var p1 = '', p2 = '';
  ah.divisions.forEach(function(d) {
    var _names = [d.name];
    if (d.children) d.children.forEach(function(c){ _names.push(c.name); if(c.children) c.children.forEach(function(gc){ _names.push(gc.name); }); });
    if (_names.indexOf(loc1) >= 0) p1 = d.name;
    if (_names.indexOf(loc2) >= 0) p2 = d.name;
  });
  return p1 && p1 === p2;
}

/** 渲染鸿雁传书面板 */
function renderLetterPanel() {
  var capital = GM._capital || '京城';
  var _filter = GM._ltFilter || 'all';

  // ── 驿路状态 ──
  var routeBar = _$('letter-route-bar');
  if (routeBar) {
    var disruptions = GM._routeDisruptions || [];
    var active = disruptions.filter(function(d) { return !d.resolved; });
    if (active.length > 0) {
      var _rHtml = '<span class="hy-route-warn-lbl">\u26A0 \u9A7F\u8DEF\u544A\u6025\uFF1A</span>';
      _rHtml += active.map(function(d) {
        return '<span class="hy-route-warn-item">' + escHtml(d.route||'') + (d.reason ? ' \u00B7 ' + escHtml(d.reason) : '') + '</span>';
      }).join('');
      routeBar.innerHTML = _rHtml;
      routeBar.style.display = 'flex';
    } else { routeBar.style.display = 'none'; routeBar.innerHTML = ''; }
  }

  // 更新 multi button 状态
  var _mbtn = _$('lt-multi-toggle');
  if (_mbtn) _mbtn.classList.toggle('active', !!GM._ltMultiMode);
  // 更新 compose target 提示
  var _ctgt = _$('lt-compose-target');
  if (_ctgt) {
    if (GM._ltMultiMode && GM._ltMultiTargets && GM._ltMultiTargets.length > 0) _ctgt.textContent = '（\u7FA4\u53D1' + GM._ltMultiTargets.length + '\u4EBA\uFF09';
    else if (GM._pendingLetterTo) _ctgt.textContent = '\u2192 \u81F4 ' + GM._pendingLetterTo;
    else _ctgt.textContent = '\uFF08\u9009\u62E9\u53D7\u4FE1\u4EBA\uFF09';
  }

  // ── 人物分组·按地域粗分 ──
  var _LT_HAREM_RE = /(皇后|皇贵妃|贵妃|淑妃|德妃|贤妃|皇妃|王妃|侧妃|嫔|妾|才人|选侍|淑人|常在|答应|宫人|乳母|奉圣夫人|国夫人|郡夫人|县君|乡君|公主|郡主|县主|太后|皇太后|太妃|王太妃)/;
  function _regionOf(ch) {
    var loc = ch && ch.location;
    var _tt = (ch && (ch.officialTitle || ch.title || '')) || '';
    if (_tt && _LT_HAREM_RE.test(_tt)) return '内廷';
    if (loc && _isSameLocation(loc, capital)) return '在京';
    return _regionOfLoc(loc);
  }
  function _regionOfLoc(loc) {
    // R: \u65E7\u7248\u542B IME \u8BEF\u7801\u5B57\uFF08\u8FA3\u9633/\u5384\u95E8/\u6280\u6E7E/\u4EAC\u7B7B/\u8468/\u7B07/\u6E29\u90FD/\u7518\u590F/\u77F3\u5BAB/\u6CBF\u5DDE/\u96A9/\u8367/\u5BA7/\u7518\u76F4\uFF09
    //    \u4E14 L457/L458 \u4E24\u6761\u90FD\u8FD4\u56DE"\u8FBD\u4E1C\u00B7\u5317\u5883"\u00B7\u628A"\u5BA3\u5927\u00B7\u5C71\u897F"\u8BEF\u5E76\u5165\u8FBD\u4E1C\u00B7\u6B64\u5904\u7EDF\u4E00\u66F4\u6B63\u5E76\u62C6\u51FA\u72EC\u7ACB\u7EC4
    if (!loc) return '\u5176\u4ED6';
    // \u8FBD\u4E1C\u00B7\u5317\u5883
    if (/\u8FBD|\u5B81\u8FDC|\u9526|\u84DF|\u76DB\u4EAC|\u8FBD\u9633|\u6C88\u9633|\u5C71\u6D77\u5173|\u76AE\u5C9B/.test(loc)) return '\u8FBD\u4E1C\u00B7\u5317\u5883';
    // \u5BA3\u5927\u00B7\u5C71\u897F\uFF08\u72EC\u7ACB\u51FA\u6765\uFF09
    if (/\u5927\u540C|\u5BA3\u5E9C|\u5BA3\u9547|\u592A\u539F|\u4EE3\u5DDE|\u84B2\u5DDE|\u5C71\u897F|\u5F52\u5316/.test(loc)) return '\u5BA3\u5927\u00B7\u5C71\u897F';
    // \u897F\u9672\u00B7\u8FB9\u9547
    if (/\u9655|\u897F\u5B89|\u5EF6|\u7518|\u5B81\u590F|\u5170\u5DDE|\u4E09\u8FB9|\u51C9|\u6986\u6797|\u56FA\u539F|\u7C73\u8102|\u5B89\u585E|\u5E9C\u8C37/.test(loc)) return '\u897F\u9677\u00B7\u8FB9\u9547';
    // \u897F\u5357\u00B7\u5DF4\u8700
    if (/\u56DB\u5DDD|\u91CD\u5E86|\u4E91|\u8D35|\u8700|\u5DF4|\u77F3\u67F1|\u6210\u90FD/.test(loc)) return '\u897F\u5357\u00B7\u5DF4\u8700';
    // \u5357\u65B9\u00B7\u6D77\u7586\uFF08\u542B\u5916\u85E9\uFF09
    if (/\u798F\u5EFA|\u5E7F\u4E1C|\u5E7F\u897F|\u6D77|\u53A6\u95E8|\u53F0\u6E7E|\u743C|\u5E73\u6237|\u6C49\u57CE|\u671D\u9C9C/.test(loc)) return '\u5357\u65B9\u00B7\u6D77\u7586';
    // \u6C5F\u5357\u00B7\u6C5F\u6D59
    if (/\u6C5F|\u676D|\u5357\u4EAC|\u82CF|\u6E56\u5E7F|\u6D59|\u5357\u76F4|\u6B66\u9675|\u8861\u5DDE|\u5B89\u5E86/.test(loc)) return '\u6C5F\u5357\u00B7\u6C5F\u6D59';
    // \u4E2D\u539F\u00B7\u9C81\u8C6B
    if (/\u6CB3\u5357|\u5C71\u4E1C|\u6CB3\u5317|\u5317\u76F4|\u9C81|\u8C6B|\u4FDD\u5B9A|\u5927\u540D|\u957F\u5C71|\u5546\u4E18/.test(loc)) return '\u4E2D\u539F\u00B7\u9C81\u8C6B';
    return '\u5176\u4ED6';
  }

  // ── NPC 卡片列表 ──
  var el = _$('letter-chars');
  if (el) {
    var _ltQ = (GM._ltSearchQuery || '').trim().toLowerCase();
    var _ltAll = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer; });
    var remote = _ltAll;
    if (_ltQ) {
      remote = _ltAll.filter(function(c) {
        var hay = ((c.name||'') + '\u3000' + (c.officialTitle||'') + '\u3000' + (c.title||'') + '\u3000' + (c.role||'') + '\u3000' + (c.faction||'') + '\u3000' + (c.location||'')).toLowerCase();
        return hay.indexOf(_ltQ) >= 0;
      });
    }
    if (remote.length === 0) {
      var _ltEmptyMsg = _ltQ ? ('\u65E0\u5339\u914D\u201C' + escHtml(GM._ltSearchQuery||'') + '\u201D\u7684\u4EBA\u7269') : '\u73B0\u4E16\u65E0\u53EF\u4F20\u4E66\u4E4B\u4EBA';
      el.innerHTML = '<div style="color:var(--color-foreground-muted);font-size:12px;padding:20px 14px;text-align:center;font-family:var(--font-serif);letter-spacing:0.12em;line-height:1.8;">' + _ltEmptyMsg + '</div>';
    } else {
      // 按地域分组
      var _groups = {};
      remote.forEach(function(ch) {
        var r = _regionOf(ch);
        if (!_groups[r]) _groups[r] = [];
        _groups[r].push(ch);
      });
      // \u987A\u5E8F\uFF1A\u8FBD\u4E1C\u00B7\u5317\u5883 / \u5BA3\u5927\u00B7\u5C71\u897F / \u897F\u9677\u00B7\u8FB9\u9547 / \u4E2D\u539F\u00B7\u9C81\u8C6B / \u6C5F\u5357\u00B7\u6C5F\u6D59 / \u897F\u5357\u00B7\u5DF4\u8700 / \u5357\u65B9\u00B7\u6D77\u7586 / \u5176\u4ED6
      var _grpOrder = ['\u5185\u5EF7','\u5728\u4EAC','\u8FBD\u4E1C\u00B7\u5317\u5883','\u5BA3\u5927\u00B7\u5C71\u897F','\u897F\u9677\u00B7\u8FB9\u9547','\u4E2D\u539F\u00B7\u9C81\u8C6B','\u6C5F\u5357\u00B7\u6C5F\u6D59','\u897F\u5357\u00B7\u5DF4\u8700','\u5357\u65B9\u00B7\u6D77\u7586','\u5176\u4ED6'];

      function _cardClass(ch) {
        var t = (ch.title||'') + (ch.officialTitle||'');
        if (/\u5C06|\u603B\u5175|\u7763|\u6307\u6325|\u6307\u6325\u4F7F/.test(t)) return 'hy-c-mili';
        if ((ch.loyalty||50) >= 75) return 'hy-c-loyal';
        if (/\u5B66\u58EB|\u4FA8|\u5C1A\u4E66|\u90CE\u4E2D|\u4FA8\u5B66|\u7AE5\u5B9E|\u4F5B|\u5FB4\u58EB|\u6559\u6388|\u4FA8\u516C|\u84DD\u77E5/.test(t)) return 'hy-c-scholar';
        return 'hy-c-normal';
      }

      // 卡死修(2026-07-21·玩家报「点送信卡死」)：原卡片循环每人 5 次全量 GM.letters 扫描——
      // 硬核档几百人×积年数千封信=每次重建百万级谓词调用·手机端秒级同步冻死(点送信必触发本渲染)。
      // → 单趟预扫成计数表·卡片循环查表。语义与 _ltCountUnread/Transit/Lost/NpcNew 逐一等价(smoke 钉)。
      var _cnt = {};
      var _lateTh = _hyTurnsForMonths(1);
      (GM.letters || []).forEach(function(l) {
        if (!l) return;
        if (l.from) {
          var cf = _cnt[l.from] || (_cnt[l.from] = { unread: 0, transit: 0, lost: 0, npcNew: 0 });
          if (!l._playerRead) { cf.unread++; if (l.status === 'returned') cf.npcNew++; }
        }
        if (l.to) {
          var ct = _cnt[l.to] || (_cnt[l.to] = { unread: 0, transit: 0, lost: 0, npcNew: 0 });
          if (l.status === 'traveling' || l.status === 'replying') ct.transit++;
          if (l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + _lateTh)) ct.lost++;
        }
      });
      var cardsHtml = '';
      _grpOrder.forEach(function(g) {
        if (!_groups[g] || _groups[g].length === 0) return;
        cardsHtml += '<div class="hy-group-sep">' + escHtml(g) + '</div>';
        _groups[g].forEach(function(ch) {
          var isMulti = (GM._ltMultiTargets||[]).indexOf(ch.name) >= 0;
          var sel = (GM._ltMultiMode ? (isMulti ? ' active' : '') : (GM._pendingLetterTo === ch.name ? ' active' : ''));
          var safeName = ch.name.replace(/'/g, "\\'");
          var _cls = _cardClass(ch);
          var _cc = _cnt[ch.name] || { unread: 0, transit: 0, lost: 0, npcNew: 0 };
          var unreadCount = _cc.unread;
          var transitCount = _cc.transit;
          var lostCount = _cc.lost;
          var npcNewCount = _cc.npcNew;
          var _isRouteBlocked = _ltIsRouteBlocked(capital, ch.location);
          var _inds = '';
          if (unreadCount > 0) _inds += '<div class="hy-ind hy-ind-unread" title="' + unreadCount + ' \u5C01\u672A\u8BFB">' + unreadCount + '</div>';
          if (npcNewCount > 0) _inds += '<div class="hy-ind hy-ind-new" title="' + npcNewCount + ' \u5C01\u6765\u51FD">' + npcNewCount + '</div>';
          if (transitCount > 0) _inds += '<div class="hy-ind hy-ind-transit" title="' + transitCount + ' \u5C01\u5728\u9014">' + transitCount + '</div>';
          if (lostCount > 0) _inds += '<div class="hy-ind hy-ind-lost" title="\u4FE1\u4F7F\u903E\u671F">?</div>';
          if (_isRouteBlocked) _inds += '<div class="hy-ind hy-ind-blocked" title="\u9A7F\u8DEF\u963B\u65AD">\u2715</div>';

          var _initial = escHtml(String(ch.name||'?').charAt(0));
          var _portrait = ch.portrait ? '<img loading="lazy" decoding="async" src="' + escHtml(ch.portrait) + '">' : _initial;
          var _travel = '';
          if (ch._travelTo) {
            var _rd4 = (typeof ch._travelRemainingDays === 'number' && ch._travelRemainingDays > 0) ? ch._travelRemainingDays : 0;
            _travel = '<span class="travel-arrow">\u2192</span>' + escHtml(ch._travelTo) + (_rd4 ? '<span style="font-size:0.85em;opacity:0.7;"> \u00B7' + _rd4 + '\u65E5</span>' : '');
          }

          cardsHtml += '<div class="hy-npc-card ' + _cls + sel + '" onclick="_ltSelectTarget(\'' + safeName + '\')">';
          cardsHtml += '<div class="hy-npc-portrait">' + _portrait + '</div>';
          cardsHtml += '<div class="hy-npc-info">';
          cardsHtml += '<div class="hy-npc-name">' + escHtml(ch.name) + '</div>';
          cardsHtml += '<div class="hy-npc-title">' + escHtml(ch.officialTitle || ch.title || ch.role || '') + '</div>';
          cardsHtml += '<div class="hy-npc-loc">' + escHtml(ch.location || '') + _travel + '</div>';
          cardsHtml += '</div>';
          cardsHtml += '<div class="hy-npc-indicators">' + _inds + '</div>';
          cardsHtml += '</div>';
        });
      });
      el.innerHTML = cardsHtml;
    }
  }

  // ── 信件记录区 ──
  var hist = _$('letter-history');
  if (!hist) return;
  var target = GM._pendingLetterTo || '';
  if (!target) {
    var _npcCorr = GM._npcCorrespondence || [];
    var _recentCorr = _npcCorr.filter(function(c) { return (GM.turn - c.turn) <= _hyTurnsForMonths(5); });
    var overviewHtml = '<div class="hy-hist-body"><div class="hy-hist-empty">\u9009\u62E9\u4E00\u4F4D\u8FDC\u65B9\u81E3\u5B50\u00B7\u4EE5\u89C1\u4E66\u4FE1\u5F80\u6765</div>';
    if (_recentCorr.length > 0) {
      overviewHtml = '<div class="hy-hist-head"><div class="hy-hist-title-wrap"><div class="hy-hist-portrait" style="background:linear-gradient(135deg,var(--vermillion-400),var(--ink-100));border-color:var(--vermillion-400);">\u5BC6</div><div><div class="hy-hist-name">\u622A\u83B7\u7684 NPC \u5BC6\u4FE1</div><div class="hy-hist-sub">\u8FD1 5 \u4E2A\u6708\u00B7\u5171 ' + _recentCorr.length + ' \u5C01</div></div></div></div>';
      overviewHtml += '<div class="hy-hist-body">';
      _recentCorr.forEach(function(c) {
        overviewHtml += '<div class="hy-msg hy-msg-intercept"><span class="hy-msg-tag"></span>';
        overviewHtml += '<div class="hy-letter">';
        overviewHtml += '<div class="header"><span class="type-pill">\u5BC6\u51FD</span><span>' + escHtml(c.from) + ' \u2192 ' + escHtml(c.to) + '</span><span class="date">T' + (c.turn||'?') + '</span></div>';
        overviewHtml += '<div class="body">' + escHtml(c.content || c.summary || '') + '</div>';
        if (c.implication) overviewHtml += '<div class="hy-intercept-imply">\u6697\u542B\uFF1A' + escHtml(c.implication) + '</div>';
        overviewHtml += '</div></div>';
      });
      overviewHtml += '</div>';
    } else {
      overviewHtml += '</div>';
    }
    hist.innerHTML = overviewHtml;
    return;
  }

  var ch = findCharByName(target);
  var allLetters = (GM.letters||[]).filter(function(l) { return l.to === target || l.from === target; });
  var letters = allLetters;
  if (_filter === 'unread') letters = allLetters.filter(function(l) { return !l._playerRead; });
  else if (_filter === 'transit') letters = allLetters.filter(function(l) { return l.status === 'traveling' || l.status === 'replying'; });
  else if (_filter === 'lost') letters = allLetters.filter(function(l) { return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + _hyTurnsForMonths(1)); });

  // 新头部
  var _initial = escHtml(String(target||'?').charAt(0));
  var _portraitHtml = (ch && ch.portrait) ? '<img loading="lazy" decoding="async" src="' + escHtml(ch.portrait) + '">' : _initial;
  var html = '<div class="hy-hist-head"><div class="hy-hist-title-wrap">';
  html += '<div class="hy-hist-portrait">' + _portraitHtml + '</div>';
  html += '<div><div class="hy-hist-name">\u4E0E ' + escHtml(target) + ' \u7684\u4E66\u4FE1</div>';
  html += '<div class="hy-hist-sub">' + escHtml(ch ? ch.location : '?') + '\u3000\u5171 ' + allLetters.length + ' \u5C01\u5F80\u6765</div></div>';
  html += '</div><div class="hy-filter-btns">';
  var _filterBtns = [{k:'all',l:'\u5168\u90E8'},{k:'unread',l:'\u672A\u8BFB'},{k:'transit',l:'\u5728\u9014'},{k:'lost',l:'\u5931\u8E2A'}];
  _filterBtns.forEach(function(f) {
    html += '<button class="hy-filter-btn' + (_filter===f.k?' active':'') + '" onclick="GM._ltFilter=\'' + f.k + '\';renderLetterPanel();">' + f.l + '</button>';
  });
  html += '</div></div>';

  // 信件列表容器
  html += '<div class="hy-hist-body">';
  if (letters.length === 0) {
    html += '<div class="hy-hist-empty">' + (_filter==='all' ? '\u5C1A\u65E0\u5F80\u6765\u4E66\u4FE1' : '\u65E0\u5339\u914D\u4FE1\u4EF6') + '</div>';
  } else {
    letters.sort(function(a,b) { return (a.sentTurn||0) - (b.sentTurn||0); });
    // 卡死修·同刀：信史区逐封建卡无上限(多产臣子数百封=数百卡同步 innerHTML)→只铺最近 120 封·更早收卷注明
    if (letters.length > 120) {
      html += '<div class="hy-hist-empty" style="padding:6px 14px;">更早 ' + (letters.length - 120) + ' 封已收卷·只铺近 120 封</div>';
      letters = letters.slice(-120);
    }
    letters.forEach(function(l) { html += _ltRenderLetterCard(l, target); });
  }
  html += '</div>';

  hist.innerHTML = html;
  var _body = hist.querySelector('.hy-hist-body');
  if (_body) _body.scrollTop = _body.scrollHeight;
}

/** 鸿雁传书·检索框输入·只重渲染左侧名册（避免抢焦点） */
function _ltOnSearchInput(v) {
  if (typeof GM === 'undefined' || !GM) return;
  GM._ltSearchQuery = String(v == null ? '' : v);
  if (GM._ltSearchTimer) { clearTimeout(GM._ltSearchTimer); GM._ltSearchTimer = null; }
  GM._ltSearchTimer = setTimeout(function() {
    GM._ltSearchTimer = null;
    var inp = document.getElementById('lt-search');
    var hadFocus = (inp && document.activeElement === inp);
    var caret = inp ? inp.selectionStart : null;
    try { if (typeof renderLetterPanel === 'function') renderLetterPanel(); } catch(_){}
    if (hadFocus) {
      var inp2 = document.getElementById('lt-search');
      if (inp2) {
        inp2.focus();
        try { if (caret != null) inp2.setSelectionRange(caret, caret); } catch(_){}
      }
    }
  }, 80);
}

/** 渲染单封信笺卡片 */
function _ltRenderLetterCard(l, target) {
  var html = '';
  var isOutgoing = (l.from === '玩家');
  var sentDate = (typeof getTSText === 'function') ? getTSText(l.sentTurn) : '第' + l.sentTurn + '回合';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeInfo = LETTER_TYPES[l.letterType] || LETTER_TYPES.personal;
  // R: intercepted_forging（敌方伪造回信中）应视觉伪装为"在途"·不能用红色截获样式·
  //    否则玩家一眼看出被截·破坏伪造剧情·真相靠存疑/遣使核实流程后续暴露
  var _intercepted = (l.status === 'intercepted');
  var _inTransit = (l.status === 'traveling' || l.status === 'replying' || l.status === 'intercepted_forging');
  var _lost = (l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + _hyTurnsForMonths(1)));

  // 外层 msg 类
  var msgCls = 'hy-msg ';
  if (_lost) msgCls += 'hy-msg-lost';
  else if (_intercepted) msgCls += 'hy-msg-intercept';
  else if (_inTransit) msgCls += 'hy-msg-transit';
  else if (isOutgoing) msgCls += 'hy-msg-player';
  else msgCls += 'hy-msg-npc';

  // 印章类
  var sealCls = 'personal';
  if (/secret|decree/.test(l.letterType||'')) sealCls = 'secret';
  else if (/military|army|order/.test(l.letterType||'')) sealCls = 'military';
  var sealChar = typeInfo.label ? String(typeInfo.label).charAt(0) : (isOutgoing ? '\u8C15' : '\u62A5');

  // 标记已读（在途来函不算读·信使未到不该能读全文更不该吞掉到达红点·2026-07-04 审查定罪）
  var _inFlightIn = !isOutgoing && l.status === 'traveling';
  if (!isOutgoing && !l._playerRead && !_inFlightIn) l._playerRead = true;

  html += '<div class="' + msgCls + '"><span class="hy-msg-tag"></span>';
  html += '<div class="hy-letter">';
  html += '<div class="seal ' + sealCls + '">' + sealChar + '</div>';
  html += '<div class="header">';
  html += '<span class="type-pill">' + escHtml(typeInfo.label || '\u4E66\u51FD') + '</span>';
  html += '<span>' + escHtml(urgLabels[l.urgency] || '\u9A7F\u9012') + '</span>';
  if (l._cipher && l._cipher !== 'none') html += '<span>' + escHtml((LETTER_CIPHERS[l._cipher]||{}).label || l._cipher) + '</span>';
  if (l._tokenUsed) html += '<span>' + escHtml((LETTER_TOKENS[l._tokenUsed]||{}).label || l._tokenUsed) + '</span>';
  if (l._sendMode === 'multi_courier') html += '<span>\u591A\u8DEF</span>';
  if (l._sendMode === 'secret_agent') html += '<span>\u5BC6\u4F7F' + (l._agentName ? '(' + escHtml(l._agentName) + ')' : '') + '</span>';
  if (l._multiRecipients) html += '<span>\u7FA4\u53D1' + l._multiRecipients + '\u4EBA</span>';
  html += '<span class="date">' + escHtml(sentDate) + '</span>';
  html += '</div>';
  // 正文（在途来函遮蔽全文）
  html += '<div class="body wd-selectable">' + (_inFlightIn ? '<em style="opacity:.65">〔信使在途·尚未送抵御前〕</em>' : escHtml(l.content || '')) + '</div>';
  // 署名
  var _sig = isOutgoing ? '\u6731\u624B\u4E66' : ('\u81E3 ' + escHtml(l.from||target) + ' \u987F\u9996');
  html += '<div class="signature">' + escHtml(sentDate) + '\u00B7' + _sig + '</div>';
  // 回信（朱笔批注/来回信内容）
  if (l.reply && (l.status === 'returned' || l.status === 'intercepted_forging') && isOutgoing) {
    var replyDate = (typeof getTSText === 'function') ? getTSText(l.replyTurn||GM.turn) : '';
    html += '<div class="reply">';
    html += '<div class="reply-label">\u56DE \u4E66 \u00B7 ' + escHtml(l.to||target) + (replyDate ? '\u00B7' + escHtml(replyDate) : '') + '</div>';
    html += escHtml(l.reply);
    if (l._isForged && (GM._letterSuspects||[]).indexOf(l.id) >= 0) {
      html += '<div style="font-size:12px;color:var(--amber-400);margin-top:4px;font-style:normal;">\u26A0 \u5DF2\u6807\u8BB0\u5B58\u7591\u2014\u2014\u6B64\u4FE1\u5185\u5BB9\u771F\u4F2A\u5F85\u6838</div>';
    }
    if (l._forgedRevealed) {
      html += '<div style="font-size:12px;color:var(--vermillion-400);margin-top:4px;font-weight:bold;font-style:normal;">\u26A0 \u5DF2\u8BC1\u5B9E\u4E3A\u4F2A\u9020\uFF01</div>';
    }
    html += '</div>';
  }
  html += '</div>'; // .hy-letter

  // 操作按钮（信件动作）
  var acts = '';
  if (l.status === 'blocked' && isOutgoing) {
    acts += '<button class="hy-filter-btn" style="color:var(--vermillion-400);border-color:var(--vermillion-400);" onclick="_ltBypassBlock(\'' + l.id + '\')" title="\u7ED5\u8FC7\u4E2D\u4E66\uFF0C\u6539\u7528\u5BC6\u65E8\u76F4\u53D1">\u6539\u7528\u5BC6\u65E8</button>';
  }
  if (l.status === 'traveling' && isOutgoing && !l._recallSent) {
    acts += '<button class="hy-filter-btn" onclick="_ltRecall(\'' + l.id + '\')" title="\u6D3E\u5FEB\u9A6C\u8FFD\u56DE\u4FE1\u4F7F">\u8FFD\u3000\u56DE</button>';
  }
  // \u622A\u83B7/\u88AB\u52AB\u00B7\u5E94\u5BF9\u624B\u6BB5\uFF1A\u53E6\u6D3E\u5BC6\u4F7F\u91CD\u53D1 / \u516B\u767E\u91CC\u52A0\u6025\u518D\u4F20
  if ((l.status === 'intercepted' || l.status === 'intercepted_forging') && isOutgoing && !l._resendIssued) {
    acts += '<button class="hy-filter-btn" style="color:var(--gold-400);border-color:var(--gold-400);" onclick="_ltResend(\'' + l.id + '\',\'secret_agent\')" title="\u6539\u7528\u5BC6\u4F7F\u91CD\u53D1\u00B7\u622A\u83B7\u7387\u5927\u964D\uFF08\u00D70.3\uFF09">\u91CD\u53D1\u00B7\u5BC6\u4F7F</button>';
    acts += '<button class="hy-filter-btn" style="color:var(--vermillion-400);border-color:var(--vermillion-400);" onclick="_ltResend(\'' + l.id + '\',\'multi_courier\')" title="\u591A\u8DEF\u516B\u767E\u91CC\u52A0\u6025\u00B7\u81F3\u5C11\u4E00\u8DEF\u5FC5\u8FBE">\u91CD\u53D1\u00B7\u591A\u8DEF\u52A0\u6025</button>';
  }
  if ((l.status === 'returned' || l.status === 'intercepted_forging') && l.reply && isOutgoing) {
    if ((GM._letterSuspects||[]).indexOf(l.id) < 0) {
      acts += '<button class="hy-filter-btn" onclick="_ltSuspect(\'' + l.id + '\')" title="\u6807\u8BB0\u6B64\u56DE\u4FE1\u53EF\u7591">\u5B58\u3000\u7591</button>';
    }
    acts += '<button class="hy-filter-btn" onclick="_ltVerify(\'' + l.id + '\')" title="\u518D\u9063\u4FE1\u4F7F\u6838\u5B9E">\u9063\u4F7F\u6838\u5B9E</button>';
  }
  if (!isOutgoing && l.status === 'returned' && l._npcInitiated) {
    if (!l._playerReplied) {
      acts += '<button class="hy-filter-btn active" onclick="_ltReplyToNpc(\'' + l.id + '\')" title="\u56DE\u590D\u6B64\u51FD">\u56DE\u3000\u4E66</button>';
    }
    acts += '<button class="hy-filter-btn" onclick="_ltExcerptToEdict(\'' + l.id + '\')" title="\u5212\u9009\u4FE1\u4E2D\u6587\u5B57\u540E\u70B9\u6B64\uFF0C\u6458\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93">\u6458\u3000\u5165</button>';
  }
  acts += '<button class="hy-filter-btn' + (l._starred?' active':'') + '" onclick="_ltStar(\'' + l.id + '\')" title="\u6807\u8BB0\u91CD\u8981">' + (l._starred ? '\u2605' : '\u2606') + '</button>';

  if (acts) {
    html += '<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;' + (isOutgoing?'justify-content:flex-end;':'') + '">' + acts + '</div>';
  }

  // 信使状态条
  if (l.status === 'traveling' || l.status === 'delivered' || l.status === 'replying' || l.status === 'blocked') {
    var _cTxt = _ltGetStatusText(l);
    html += '<div style="font-size:11.5px;color:var(--ink-300);margin-top:4px;font-style:italic;letter-spacing:0.08em;' + (isOutgoing?'text-align:right;':'') + '">\u21A3 ' + escHtml(_cTxt) + '</div>';
  }
  html += '</div>'; // .hy-msg
  return html;
}

/** 信件状态文本（日制） */
function _ltGetStatusText(l) {
  if (l.status === 'traveling') {
    var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : 0;
    var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var arrDay = (typeof l._deliveryDay === 'number') ? l._deliveryDay
                : (typeof l.deliveryTurn === 'number') ? (l.deliveryTurn-1)*dpv : null;
    var arrDate = (typeof getTSText === 'function' && typeof l.deliveryTurn === 'number') ? getTSText(l.deliveryTurn) : '';
    if (l._recallSent) return '追回信使已派出';
    if (arrDay !== null && nowDay > arrDay + 15) return '⚠ 信使逾期未归（已超 ' + Math.round(nowDay - arrDay) + ' 天）';
    if (arrDay !== null) {
      var _rem = arrDay - nowDay;
      if (_rem <= 0) return '信使在途…… 即将抵达';
      return '信使在途…… 约 ' + Math.ceil(_rem) + ' 天后送达' + (arrDate ? '（' + arrDate + '）' : '');
    }
    return '信使在途……';
  }
  if (l.status === 'delivered') return '已送达，等待回函……';
  if (l.status === 'replying') return '回函在途……';
  if (l.status === 'intercepted') return '⚠ 信使失踪' + (l.interceptedBy ? '·疑为' + l.interceptedBy + '所为' : '');
  if (l.status === 'intercepted_forging') return '回函在途……（按：原信使疑被' + (l.interceptedBy||'敌方') + '所截·此回函真伪存疑）';
  if (l.status === 'recalled') return '信使已追回';
  if (l.status === 'blocked') return '⚠ 中书门下阻止，未能下达';
  if (l.status === 'returned') {
    var note = (GM._courierStatus||{})[l.id];
    return note || '信使已归';
  }
  return l.status || '';
}

/** NPC选择（单选/多选模式） */
function _ltSelectTarget(name) {
  if (GM._ltMultiMode) {
    if (!GM._ltMultiTargets) GM._ltMultiTargets = [];
    var idx = GM._ltMultiTargets.indexOf(name);
    if (idx >= 0) GM._ltMultiTargets.splice(idx, 1);
    else GM._ltMultiTargets.push(name);
  } else {
    GM._pendingLetterTo = name;
  }
  renderLetterPanel();
}

/** 统计辅助函数 */
function _ltCountUnread(name) {
  return (GM.letters||[]).filter(function(l) { return l.from === name && !l._playerRead; }).length;
}
function _ltCountTransit(name) {
  return (GM.letters||[]).filter(function(l) { return l.to === name && (l.status === 'traveling' || l.status === 'replying'); }).length;
}
function _ltCountLost(name) {
  return (GM.letters||[]).filter(function(l) { return l.to === name && l.status === 'intercepted'; }).length
    + (GM.letters||[]).filter(function(l) { return l.to === name && l.status === 'traveling' && GM.turn > l.deliveryTurn + _hyTurnsForMonths(1); }).length;
}
function _ltCountNpcNew(name) {
  return (GM.letters||[]).filter(function(l) { return l.from === name && !l._playerRead && l.status === 'returned'; }).length;
}

/** 检查驿路是否阻断 */
function _ltIsRouteBlocked(from, to) {
  var disruptions = GM._routeDisruptions || [];
  return disruptions.some(function(d) {
    if (d.resolved) return false;
    // 检查方向是否匹配（任一端点匹配即视为阻断）
    return (d.from === from || d.to === from || d.from === to || d.to === to || d.route === from + '-' + to || d.route === to + '-' + from);
  });
}

/** 标记回信存疑 */
function _ltSuspect(letterId) {
  if (!GM._letterSuspects) GM._letterSuspects = [];
  if (GM._letterSuspects.indexOf(letterId) < 0) GM._letterSuspects.push(letterId);
  toast('已标记此信存疑，AI推演将据此判断');
  renderLetterPanel();
}

/** 标记/取消重要 */
function _ltStar(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (l) l._starred = !l._starred;
  renderLetterPanel();
}

/** 追回信使 */
function _ltRecall(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l || l.status !== 'traveling') { toast('此信已无法追回'); return; }
  // 追回概率基于已过时间——刚发出容易追回，接近送达则难
  var elapsed = GM.turn - l.sentTurn;
  var total = l.deliveryTurn - l.sentTurn;
  var recallChance = total > 0 ? Math.max(0.1, 1 - (elapsed / total) * 0.8) : 0.5;
  l._recallSent = true;
  // 追回结果在下回合结算中处理
  l._recallChance = recallChance;
  toast('已派快马追回（成功率约' + Math.round(recallChance * 100) + '%），下回合见分晓');
  renderLetterPanel();
}

/** 回复NPC来函 */
function _ltReplyToNpc(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  // 守卫：仅 NPC 来函可调此函·防止误传玩家信件 id 把发信目标设成"玩家"自己
  if (!l._npcInitiated || !l.from || l.from === '玩家') return;
  // 设置当前目标为该NPC，并在textarea中预填回复提示
  GM._pendingLetterTo = l.from;
  GM._ltReplyingTo = letterId;
  renderLetterPanel();
  var ta = _$('letter-textarea');
  if (ta) { ta.focus(); ta.placeholder = '回复' + l.from + '的来函……'; }
}

/** 绕过中书门下阻止——改为密旨发出 */
function _ltBypassBlock(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  l.status = 'traveling';
  l.letterType = 'secret_decree';
  l.sentTurn = GM.turn;
  var days = calcLetterDays(l.fromLocation, l.toLocation, l.urgency || 'normal');
  var dpv = _getDaysPerTurn();
  l.deliveryTurn = GM.turn + Math.max(1, Math.ceil(days / dpv));
  l.replyTurn = l.deliveryTurn + Math.max(1, Math.ceil(days / dpv));
  toast('已改密旨直发——绕过中书门下');
  renderLetterPanel();
}

/** 摘入建议库（划选来函文字后点击，同问对流程） */
function _ltExcerptToEdict(letterId) {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('请先在来函中划选要摘录的文字'); return; }
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  var from = l ? (l.from || '?') : '?';
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '鸿雁', from: from, content: text, turn: GM.turn, used: false });
  toast('已摘入诏书建议库');
  // 如果诏令tab可见则刷新
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

/** 重发被截获的信件——选用更安全的传递方式（密使/多路加急）
 *  · 不删除原 letter（保留情报泄露记录）·新建一封"重发"信
 *  · 自动转为加急·可选 secret_agent / multi_courier·享受截获率折扣
 */
function _ltResend(letterId, mode) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  if (l._resendIssued) { toast('此信已重发过·请到新条目操作'); return; }
  var capital = GM._capital || '京城';
  var ch = (typeof findCharByName === 'function') ? findCharByName(l.to) : null;
  var toLoc = ch ? (ch.location || capital) : (l.toLocation || capital);
  var _newUrgency = mode === 'multi_courier' ? 'extreme' : 'urgent';
  var days = (typeof calcLetterDays === 'function') ? calcLetterDays(capital, toLoc, _newUrgency) : 5;
  var dpv = _getDaysPerTurn();
  var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
  var _nowDayR = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  var newLetter = {
    id: (typeof uid === 'function') ? uid() : 'rs_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    from: '玩家', to: l.to,
    fromLocation: capital, toLocation: toLoc,
    content: '【重发·前函疑被劫】' + (l.content||''),
    sentTurn: GM.turn,
    deliveryTurn: GM.turn + deliveryTurns,
    replyTurn: GM.turn + deliveryTurns + 1,
    _sentDay: _nowDayR,
    _deliveryDay: _nowDayR + days,
    _replyDay: _nowDayR + days * 2 + 3,
    _travelDays: days,
    reply: '', status: 'traveling',
    urgency: _newUrgency, letterType: l.letterType,
    _cipher: 'cipher_substitution', // 重发自动加密·防再次被读
    _sendMode: mode,
    _replyExpected: true,
    _resentFrom: letterId
  };
  if (!Array.isArray(GM.letters)) GM.letters = [];
  GM.letters.push(newLetter);
  l._resendIssued = true;
  // 起居注 + 编年
  var _date = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  if (Array.isArray(GM.qijuHistory)) {
    if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
      turn: GM.turn, date: _date,
      content: '【鸿雁重发】致' + l.to + '的前函疑被劫·改' + (mode === 'secret_agent' ? '密使暗递' : '多路八百里加急') + '重发。'
    });
  }
  if (typeof addEB === 'function') addEB('传书', '致' + l.to + '的信改' + (mode === 'secret_agent' ? '密使' : '多路加急') + '重发');
  toast('已遣' + (mode === 'secret_agent' ? '密使' : '多路加急') + '重发·约' + days + '天可达');
  if (typeof renderLetterPanel === 'function') renderLetterPanel();
}

/** 遣使核实 */
function _ltVerify(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  var capital = GM._capital || '京城';
  var ch = findCharByName(l.to);
  var toLoc = ch ? (ch.location || capital) : capital;
  var days = calcLetterDays(capital, toLoc, 'urgent');
  var dpv = _getDaysPerTurn();
  var _nowDayV = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  var verifyLetter = {
    id: uid(), from: '玩家', to: l.to,
    fromLocation: capital, toLocation: toLoc,
    content: '核实前函——朕遣使复核，卿是否曾收到前日来函并亲笔回书？',
    sentTurn: GM.turn, deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
    replyTurn: GM.turn + Math.max(2, Math.ceil(days * 2 / dpv)),
    _sentDay: _nowDayV,
    _deliveryDay: _nowDayV + days,
    _replyDay: _nowDayV + days * 2 + 3,
    _travelDays: days,
    reply: '', status: 'traveling', urgency: 'urgent',
    letterType: 'secret_decree', _verifyTarget: letterId,
    _sendMode: 'multi_courier', _replyExpected: true
  };
  if (!GM.letters) GM.letters = [];
  GM.letters.push(verifyLetter);
  toast('已遣快马核实，约' + days + '天可知真伪');
  renderLetterPanel();
}

/** 发送信件（支持单发/群发/密使/多路/加密/信物） */
function sendLetter() {
  var textarea = _$('letter-textarea');
  var content = textarea ? textarea.value.trim() : '';
  if (!content) { toast('请写下信函内容'); return; }
  var urgency = _$('letter-urgency') ? _$('letter-urgency').value : 'normal';
  var letterType = _$('letter-type') ? _$('letter-type').value : 'personal';
  var cipher = _$('letter-cipher') ? _$('letter-cipher').value : 'none';
  var sendMode = _$('letter-sendmode') ? _$('letter-sendmode').value : 'normal';

  // 确定收信人列表
  var targets = [];
  if (GM._ltMultiMode && GM._ltMultiTargets && GM._ltMultiTargets.length > 0) {
    targets = GM._ltMultiTargets.slice();
  } else if (GM._pendingLetterTo) {
    targets = [GM._pendingLetterTo];
  }
  if (targets.length === 0) { toast('请先选择收信人'); return; }
  // 自检·剔除自己 + 在京者
  try {
    var _selfNm2 = (P.playerInfo && P.playerInfo.characterName) || '';
    var _capSelf = GM._capital || '京师';
    var _drop = [];
    targets = targets.filter(function(tn) {
      if (_selfNm2 && tn === _selfNm2) { _drop.push(tn + '(自己)'); return false; }
      var _ch = (typeof findCharByName === 'function') ? findCharByName(tn) : null;
      if (_ch) {
        // 用 _isSameLocation·走规范化别名表（京师/紫禁城/顺天府=京城）·
        // 避免硬编码 /京/ 误伤 南京/京口/京广路 等含"京"字异地
        var _atCap = !_ch.location || (typeof _isSameLocation === 'function' && _isSameLocation(_ch.location, _capSelf));
        if (_atCap && !_ch._travelTo) { _drop.push(tn + '(在京)'); return false; }
      }
      return true;
    });
    if (_drop.length > 0) toast('已剔除：' + _drop.join('·') + '·宜面陈或召对');
    if (targets.length === 0) return;
  } catch(_){}

  var capital = GM._capital || '京城';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeLabel = (LETTER_TYPES[letterType]||{}).label || '书信';
  var sentDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  var dpv = _getDaysPerTurn();
  var multiCount = targets.length > 1 ? targets.length : 0;

  // 信物检查（征调令需虎符等）
  // _tokenUsed 只在实际持有时填充——表示"此函确已加盖/附带此信物"·UI 据此显示徽标·
  // 投递时 NPC 视角的"未见信物可拒"判断改由 letterType→needsToken 派生·见 _settleLettersAndTravel
  var tokenNeeded = (LETTER_TYPES[letterType]||{}).needsToken;
  var tokenUsed = '';
  if (tokenNeeded && typeof tokenNeeded === 'string') {
    var _hasToken = (GM.items||[]).some(function(it) { return it.type === tokenNeeded || it.name === (LETTER_TOKENS[tokenNeeded]||{}).label; });
    if (!_hasToken) {
      toast('⚠ 未持有' + ((LETTER_TOKENS[tokenNeeded]||{}).label||'凭证') + '——对方可能疑诏不从');
    } else {
      tokenUsed = tokenNeeded;
    }
  }

  // 密使模式：选择一个NPC作为信使
  var agentName = '';
  if (sendMode === 'secret_agent') {
    var _agentSel = _$('letter-agent');
    agentName = _agentSel ? _agentSel.value : '';
  }

  // 正式诏令经中书门下（权臣可能阻挠）
  var _formalBlocked = false;
  if ((LETTER_TYPES[letterType]||{}).formal) {
    // 检查是否有权臣把控中书——通过官制系统
    var _primeMin = _ltFindPrimeMinister();
    if (_primeMin && (_primeMin.loyalty||50) < 30 && (_primeMin.ambition||50) > 70) {
      _formalBlocked = true;
      toast('⚠ ' + _primeMin.name + '阻挠此诏令流转——可改用密旨绕过');
    }
  }

  // 默认多路信使——更真实（古代正式公文常派 2-3 路）·享受截获率折扣
  if (!sendMode || sendMode === 'normal') sendMode = 'multi_courier';
  var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;

  targets.forEach(function(target) {
    var ch = findCharByName(target);
    var toLoc = ch ? (ch.location || capital) : capital;
    var days = calcLetterDays(capital, toLoc, urgency);
    // 密使模式速度更慢但更安全
    if (sendMode === 'secret_agent') days = Math.ceil(days * 1.5);
    // 回合数仍计算·UI/兼容用·但所有判定走 day
    var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
    var replyDays = days * 2 + 3;
    var replyTurns = Math.max(deliveryTurns + 1, Math.ceil(replyDays / dpv));

    var letter = {
      id: uid(), from: '玩家', to: target,
      fromLocation: capital, toLocation: toLoc,
      content: content, sentTurn: GM.turn,
      deliveryTurn: GM.turn + deliveryTurns,
      replyTurn: GM.turn + replyTurns,
      // 时间制字段（权威·跨剧本一致）
      _sentDay: nowDay,
      _deliveryDay: nowDay + days,
      _replyDay: nowDay + replyDays,
      _travelDays: days,
      reply: '', status: _formalBlocked ? 'blocked' : 'traveling',
      urgency: urgency, letterType: letterType,
      _cipher: cipher, _sendMode: sendMode,
      _tokenUsed: tokenUsed, _agentName: agentName,
      _multiRecipients: multiCount > 0 ? multiCount : undefined,
      _replyingTo: GM._ltReplyingTo || undefined,
      _replyExpected: true
    };

    // 如果是回复NPC来函，标记原函已回复
    if (GM._ltReplyingTo) {
      var origLetter = (GM.letters||[]).find(function(x){ return x.id === GM._ltReplyingTo; });
      if (origLetter) origLetter._playerReplied = true;
    }

    // 征调令/密旨→自动注册诏令追踪
    if (letterType === 'military_order' || letterType === 'secret_decree' || letterType === 'formal_edict') {
      if (!GM._edictTracker) GM._edictTracker = [];
      GM._edictTracker.push({
        content: content, category: letterType === 'military_order' ? '军令' : '政令',
        turn: GM.turn, status: 'pending', source: 'letter',
        target: target, letterId: letter.id
      });
    }

    if (!GM.letters) GM.letters = [];
    GM.letters.push(letter);
  });

  if (GM.qijuHistory) {
    var _targetNames = targets.join('、');
    if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: sentDate, content: '【鸿雁传书】遣' + (urgLabels[urgency]||'驿递') + '致' + _targetNames + '（' + typeLabel + (cipher !== 'none' ? '·' + (LETTER_CIPHERS[cipher]||{}).label : '') + '）。内容：' + content });
  }

  if (textarea) textarea.value = '';
  GM._ltReplyingTo = undefined;
  GM._ltMultiMode = false;
  GM._ltMultiTargets = [];
  toast(targets.length > 1 ? '已群发' + targets.length + '函' : '信函已发出（' + (urgLabels[urgency]||'驿递') + '）');
  // 卡死修·防线：信已发出落账·渲染若炸不得把发送观感拖成「点了卡死」——面板下次打开自愈
  try { renderLetterPanel(); } catch (_eRp) { try { console.warn('[鸿雁] 发送后面板渲染异常(信已发出):', _eRp); } catch (_) {} }
}

/** 查找宰相/中书令 */
function _ltFindPrimeMinister() {
  if (!P.officeConfig) return null;
  var _depts = P.officeConfig.departments || [];
  for (var i = 0; i < _depts.length; i++) {
    var d = _depts[i];
    if (d.name && (d.name.indexOf('中书') >= 0 || d.name.indexOf('宰') >= 0 || d.name.indexOf('丞相') >= 0)) {
      var _pos = d.positions || [];
      for (var j = 0; j < _pos.length; j++) {
        if (_pos[j].holder) return findCharByName(_pos[j].holder);
      }
    }
  }
  return null;
}

/** 每回合结算信件传递+角色赶路 (注册到SettlementPipeline)
 *  R: 时间制重构——所有"已等多久"判定均以"实际天数"为标尺·跨剧本一致
 *     dpv=90 的剧本和 dpv=7 的剧本·"信件 30 天内焦虑续问"是同一行为
 */
function _settleLettersAndTravel() {
  var dpv = _getDaysPerTurn();
  if (!Array.isArray(GM.letters)) GM.letters = [];
  if (!Array.isArray(GM._pendingNpcLetters)) GM._pendingNpcLetters = [];
  if (!GM._courierStatus) GM._courierStatus = {};
  if (!GM._npcCorrespondence) GM._npcCorrespondence = [];

  var _gMode = (P.conf && P.conf.gameMode) || '';
  var _canIntercept = _gMode === 'strict_hist' || _gMode === 'light_hist';
  var _hostileFacs = (GM.facs||[]).filter(function(f){ return !f.isPlayer && (f.playerRelation||0) < -50; });
  // 当前累计天数（跨剧本统一标尺）
  var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  // 取信件的"实际到达天"·兼容旧存档（仅有 deliveryTurn）
  function _ltArrivalDay(l) {
    if (typeof l._deliveryDay === 'number') return l._deliveryDay;
    if (typeof l.deliveryTurn === 'number') return (l.deliveryTurn - 1) * dpv;
    return Infinity; // 数据不全·永不到达·让自愈段兜底
  }
  function _ltReplyArrivalDay(l) {
    if (typeof l._replyDay === 'number') return l._replyDay;
    if (typeof l.replyTurn === 'number') return (l.replyTurn - 1) * dpv;
    return _ltArrivalDay(l) + Math.max(7, dpv); // 兜底
  }
  function _ltInterceptDay(l) {
    if (typeof l._interceptedDay === 'number') return l._interceptedDay;
    if (typeof l._interceptedTurn === 'number') return (l._interceptedTurn - 1) * dpv;
    return null;
  }

  // 0a·重度逾期自愈——超过到达日 30 天仍 traveling 视为驿递事故·强制送达
  // （日制·跨剧本一致：dpv=7 的剧本里也是 30 天而非"4 回合 = 28 天"）
  // intercepted 久未消化阈值：60 天
  GM.letters.forEach(function(l) {
    if (!l) return;
    var _arr = _ltArrivalDay(l);
    if (l.status === 'traveling' && nowDay > _arr + 30) {
      l._autoHealed = true;
      l._deliveryDay = nowDay; // 触发本轮 Section 1/Section 3 处理
      l.deliveryTurn = GM.turn; // 同步保留兼容字段
      if (typeof addEB === 'function') addEB('传书', '逾期信件自愈：致' + (l.to||l.from) + '的信件强制送达（驿递晚到）');
    }
    if (l.status === 'intercepted' && nowDay > _arr + 60) {
      l._autoHealed = true;
      l.status = 'returned';
      if (!l.reply) l.reply = '（信使遗失多日·辗转送达·原文已部分残缺）';
      GM._courierStatus[l.id] = '信使辗转归来·原信物大部完好';
      if (Array.isArray(GM._undeliveredLetters)) {
        GM._undeliveredLetters = GM._undeliveredLetters.filter(function(u){
          return !(u && u.from === l.from && u.to === l.to && u.content === l.content);
        });
      }
      if (typeof addEB === 'function') addEB('传书', '失踪信使归来：致' + (l.to||l.from) + '的旧信终于送达');
    }
  });

  // 0. 处理追回信使
  (GM.letters||[]).forEach(function(l) {
    if (l._recallSent && l.status === 'traveling' && !l._recallResolved) {
      l._recallResolved = true;
      if (Math.random() < (l._recallChance||0.5)) {
        l.status = 'recalled';
        if (typeof addEB === 'function') addEB('传书', '致' + l.to + '的信使已追回');
        toast('信使已追回——致' + l.to + '的函未送达');
      } else {
        if (typeof addEB === 'function') addEB('传书', '追回信使失败——致' + l.to + '的函仍在途');
      }
    }
  });

  // 1. 推进玩家信件（日制判定·跨剧本一致）
  (GM.letters||[]).forEach(function(l) {
    if (l.status === 'blocked') return; // 被中书阻挠
    if (l.status === 'recalled') return;
    if (l.status === 'traveling' && nowDay >= _ltArrivalDay(l)) {
      // 截获判定
      if (_canIntercept && !l._interceptChecked) {
        l._interceptChecked = true;
        var _rate = _ltCalcInterceptRate(l, _hostileFacs);
        if (Math.random() < _rate) {
          _ltDoIntercept(l, _hostileFacs);
          return;
        }
      }
      // NPC 来函不在此推进状态——交给下方 Section 3（_npcInitiated 专属流水线）
      // 否则状态会被改成 'delivered'·导致 Section 3 的 status==='traveling' 守卫失效·
      // 进而漏发到达 toast/邸报/起居·并漏推 _suggestion 到诏书建议库
      if (l._npcInitiated) return;
      l.status = 'delivered';
      if (typeof addEB === 'function') addEB('传书', '致' + (l.to||l.from) + '的信已送达' + (l.toLocation||''));
      // 收信者记忆（玩家→NPC 的信件，无论是否回信都记入记忆）
      if (!l._npcInitiated && l.to) {
        try {
          if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
            var _rcvCh = (typeof findCharByName === 'function') ? findCharByName(l.to) : null;
            if (_rcvCh && _rcvCh.alive !== false) {
              var _typeLabel = (typeof LETTER_TYPES !== 'undefined' && LETTER_TYPES[l.letterType]) ? LETTER_TYPES[l.letterType].label : '来函';
              var _urgLabel = l.urgency === 'extreme' ? '八百里加急' : l.urgency === 'urgent' ? '加急' : '驿递';
              var _subj = l.subjectLine ? ('《' + String(l.subjectLine).slice(0,20) + '》') : '';
              var _body = String(l.content || '').replace(/<[^>]+>/g, '').slice(0, 80);
              var _memTxt = '收天子亲笔' + _typeLabel + '(' + _urgLabel + ')' + _subj + '：' + _body;
              // 情绪依据信件类型与称谓
              var _emoMap = {
                edict: '敬', secret_edict: '惧', military_order: '惧', summons: '敬',
                inquiry: '平', encouragement: '喜', reprimand: '惧',
                personal: '喜', consolation: '哀', condolence: '哀',
                appointment: '敬', promotion: '喜', dismissal: '怒'
              };
              var _emo = _emoMap[l.letterType] || '敬';
              var _weight = l.urgency === 'extreme' ? 8 : l.urgency === 'urgent' ? 7 : 6;
              NpcMemorySystem.remember(l.to, _memTxt, _emo, _weight, '天子', {
                type: 'dialogue',
                source: 'witnessed',
                credibility: 100
              });
            }
          }
        } catch(_memE) {}
      }
      if (!l._npcInitiated) _generateLetterReply(l);
    }
    if (l.status === 'replying' && nowDay >= _ltReplyArrivalDay(l)) {
      l.status = 'returned';
      var _replyNpc = findCharByName(l.to);
      var _dem = _replyNpc ? (_replyNpc.loyalty > 80 ? '恭敬拜读' : _replyNpc.loyalty < 30 ? '面色凝重' : _replyNpc.stress > 70 ? '神色疲惫' : '速具回书') : '已收函';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + _dem + '。';
      // 兜底：AI 异步未返回时·按 NPC 性格态度合成简短回信·避免空白回信
      if (!l.reply || !String(l.reply).trim()) {
        var _toneTxt = '臣' + (l.to||'') + '叩首拜读圣函。';
        if (_replyNpc) {
          var _favorR = 0;
          try { if (_replyNpc._impressions && _replyNpc._impressions['玩家']) _favorR = _replyNpc._impressions['玩家'].favor || 0; } catch(_){}
          if ((_replyNpc.loyalty||50) >= 75 && _favorR >= 0) {
            _toneTxt = '臣' + _replyNpc.name + '谨奉圣函·披沥肝胆·当尽心承命。容臣详察具复·必不负圣意。';
          } else if ((_replyNpc.loyalty||50) < 35 || _favorR <= -10) {
            _toneTxt = '臣' + _replyNpc.name + '已得圣函·容臣三思后再行回奏。圣意所指·臣自当揣度·然事有缓急·不敢轻断。';
          } else if ((_replyNpc.stress||0) > 70) {
            _toneTxt = '臣' + _replyNpc.name + '俯读圣函·近日忧劳形于心·容臣定神后详禀。';
          } else {
            _toneTxt = '臣' + _replyNpc.name + '拜领圣函·谨当详察·不日具复。';
          }
        }
        l.reply = _toneTxt;
        l._fallbackReply = true;
      }
      // 核实信处理
      if (l._verifyTarget) {
        var _orig = (GM.letters||[]).find(function(x){ return x.id === l._verifyTarget; });
        if (_orig && _orig._isForged) {
          l.reply = '臣' + l.to + '惶恐顿首——臣从未收到前日来函，更未曾回书！此前所谓回信必是伪造！请陛下明察！';
          _orig._forgedRevealed = true;
          if (typeof addEB === 'function') addEB('传书', '⚠ ' + l.to + '证实前函回信系伪造！');
        }
      }
      // 征调令未附信物→NPC可能不从
      // 改以信件类型派生"是否需要虎符"·而非依赖 _tokenUsed（后者已改为"实际附带"语义）
      var _needsTally = (LETTER_TYPES[l.letterType]||{}).needsToken === 'tally';
      if (_needsTally && l.letterType === 'military_order' && l._tokenUsed !== 'tally') {
        if (_replyNpc && (_replyNpc.loyalty||50) < 60) {
          l.reply = (l.reply||'') + '\n（按：' + l.to + '以未见虎符为由，暂未奉行征调。）';
        }
      }
      var replyDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: replyDate, content: '【鸿雁传书】' + l.to + '回函到达。' + (l.reply||'') });
    }
    // 伪造回信
    if (l.status === 'intercepted_forging' && nowDay >= _ltReplyArrivalDay(l)) {
      l.status = 'returned'; l._isForged = true;
      l.reply = '臣谨奉诏。诸事安好，请陛下放心。臣当继续勉力。';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + '已收函。';
      var _fd = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: _fd, content: '【鸿雁传书】' + l.to + '回函到达。' + l.reply });
      if (!GM._interceptedIntel) GM._interceptedIntel = [];
      GM._interceptedIntel.push({ turn: GM.turn, interceptor: l.interceptedBy||'敌方', from: '伪造', to: '皇帝', content: '敌方已伪造' + l.to + '的回信欺骗玩家', urgency: 'forged' });
    }
  });

  // 2. NPC主动来书入队（日制·默认多路驿递）
  // R: 用 try/catch 隔离每条 nl·防止单条数据异常（缺 from/content/type）卡死整批
  if (GM._pendingNpcLetters && GM._pendingNpcLetters.length > 0) {
    var capital = GM._capital || '京城';
    var _enqueued = 0, _skipped = 0;
    GM._pendingNpcLetters.forEach(function(nl) {
      try {
        if (!nl || !nl.from) { _skipped++; return; }
        var fromCh = findCharByName(nl.from);
        var fromLoc = fromCh ? (fromCh.location || '远方') : '远方';
        var days = (typeof calcLetterDays === 'function') ? calcLetterDays(fromLoc, capital, nl.urgency || 'normal') : 5;
        if (!isFinite(days) || days < 1) days = 5;
        var letter = {
          id: uid(), from: nl.from, to: '玩家', fromLocation: fromLoc, toLocation: capital,
          content: nl.content||'', sentTurn: GM.turn,
          deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
          // 时间制·权威字段
          _sentDay: nowDay,
          _deliveryDay: nowDay + days,
          _travelDays: days,
          reply: '', status: 'traveling', urgency: nl.urgency||'normal',
          letterType: nl.type||'report', _npcInitiated: true,
          _replyExpected: nl.replyExpected !== false, _playerRead: false,
          _suggestion: nl.suggestion || '',
          _sendMode: 'multi_courier' // NPC 默认多路驿递（更真实·享 ×0.15 截获折扣）
        };
        // NPC 来函先进入在途状态；截获判定交给到达阶段统一处理，避免刚入队即随机变成 intercepted。
        // NPC记住自己写了什么（防止续奏/来函前后矛盾）
        if (nl.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          var _typeLabels = {report:'奏报',plea:'陈情',warning:'急报',intelligence:'密信',personal:'私函'};
          NpcMemorySystem.remember(nl.from, '向天子上' + (_typeLabels[nl.type]||'书') + '：' + (nl.content||'').slice(0,60), '平', 5);
        }
        if (!GM.letters) GM.letters = [];
        GM.letters.push(letter);
        _enqueued++;
      } catch(_nlE) {
        _skipped++;
        try { (window.TM && TM.errors && TM.errors.captureSilent) && TM.errors.captureSilent(_nlE, 'pendingNpcLetter enqueue'); } catch(_){}
      }
    });
    if (_skipped > 0) console.warn('[settleLetters] NPC pending 队列：入队 ' + _enqueued + '·跳过 ' + _skipped);
    GM._pendingNpcLetters = [];
  }

  // 2b. NPC 焦虑续问：被截"皇帝→NPC"信件·15 天后 NPC 主动来函询问
  // 设计意图：让"截获"成为真正的双向事件——NPC 等不到旨意会焦虑·会续问
  // 触发条件：letter._npcInitiated=false（皇帝→NPC）+ status=intercepted + 截获已 15 天 + 未触发过续问
  // 日制·跨剧本一致（dpv=7 的剧本里也是 15 天而非"2 回合 = 14 天"）
  (GM.letters||[]).forEach(function(l) {
    if (!l || l._npcInitiated) return;
    var _icpDay = _ltInterceptDay(l);
    if (_icpDay === null) return;
    if (l.status !== 'intercepted' && l.status !== 'intercepted_forging') return;
    if (l._followupSent) return;
    var _waited = nowDay - _icpDay;
    if (_waited < 15) return;
    // 该 NPC 是否已收到玩家其他指令（同期送达的别的信）·是则不续问
    var _hasOtherDelivered = (GM.letters||[]).some(function(o) {
      return o && o !== l && o.from === '玩家' && o.to === l.to
        && (o.status === 'delivered' || o.status === 'returned' || o.status === 'replying')
        && o.sentTurn >= l._interceptedTurn;
    });
    if (_hasOtherDelivered) { l._followupSent = true; return; }
    // 让该 NPC 写来函·内容由 letterType 决定语气
    var _ch = (typeof findCharByName === 'function') ? findCharByName(l.to) : null;
    if (!_ch || _ch.alive === false) { l._followupSent = true; return; }
    var _loyalty = _ch.loyalty || 50;
    var _stress = _ch.stress || 0;
    var _typeWord = (LETTER_TYPES[l.letterType]||{}).label || '前函';
    var _txt;
    if (_loyalty >= 70 && _stress < 60) {
      _txt = '臣' + l.to + '惶恐顿首：闻陛下曾遣使示下，然臣久候不至。或途中有变。臣谨守本职，未敢轻擅，伏望陛下复降明诏，臣即奉行。';
    } else if (_loyalty < 35 || _stress >= 70) {
      _txt = '臣' + l.to + '冒死陈奏：陛下前所遣' + _typeWord + '迄未见达，臣进退失据·此地形势万变，臣不得不暂依旧例处置·若所行违陛下意，伏乞早赐明示。';
    } else {
      _txt = '臣' + l.to + '谨奏：闻有圣谕颁下，然驿信迟迟未到，恐有阻滞·臣暂仍按前旨守职·伏乞陛下复降明诏，以释臣心。';
    }
    if (!Array.isArray(GM._pendingNpcLetters)) GM._pendingNpcLetters = [];
    GM._pendingNpcLetters.push({
      from: l.to, type: 'plea', urgency: l.urgency === 'extreme' ? 'urgent' : 'normal',
      content: _txt,
      suggestion: '速降复诏·或召' + l.to + '面陈',
      replyExpected: true,
      _triggeredByIntercept: true, _origLetterId: l.id
    });
    l._followupSent = true;
    if (typeof addEB === 'function') addEB('传书', l.to + '久不见旨·遣使来京续问');
  });

  // 3. NPC来信到达 → 自动推入诏书建议库
  // 同时认 traveling/delivered 两种入口·后者用于自愈历史存档（旧版 Section 1 误吞了状态推进·
  // 把 NPC 来函卡死在 delivered 上·导致整条到达流水线静默断掉）
  var _npcArrived = 0;
  (GM.letters||[]).forEach(function(l) {
    if (l._npcInitiated && (l.status === 'traveling' || l.status === 'delivered') && nowDay >= _ltArrivalDay(l)) {
      l.status = 'returned';
      _npcArrived++;
      var ad = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.from + '的来函已送达');
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: ad, content: '【鸿雁传书】收到' + l.from + '自' + (l.fromLocation||'远方') + '来函。' });
      // NPC来函附带的可操作建议 → 自动推入诏书建议库（同问对/朝议流程）
      // 只推AI提炼的suggestion摘要，不推整封信原文
      if (l._suggestion) {
        if (!GM._edictSuggestions) GM._edictSuggestions = [];
        var _dup = GM._edictSuggestions.some(function(s) { return s.from === l.from && s.content === l._suggestion; });
        if (!_dup) {
          GM._edictSuggestions.push({
            source: '鸿雁', from: l.from, content: l._suggestion,
            turn: GM.turn, used: false
          });
        }
      }
    }
  });
  if (_npcArrived > 0) {
    try { if (typeof toast === 'function') toast('鸿雁：' + _npcArrived + ' 封新来函已抵达'); } catch(_){}
    try { if (typeof renderLetterPanel === 'function' && document.getElementById('letter-history')) renderLetterPanel(); } catch(_){}
  }

  // 4. NPC间通信（由AI推演，暂存在GM._pendingNpcCorrespondence）
  if (GM._pendingNpcCorrespondence && GM._pendingNpcCorrespondence.length > 0) {
    GM._pendingNpcCorrespondence.forEach(function(nc) {
      // 玩家的密探有概率截获
      var spyChance = 0.15; // 基础截获率
      if (GM._spyNetwork) spyChance += GM._spyNetwork * 0.01; // 情报网加成
      if (Math.random() < spyChance) {
        GM._npcCorrespondence.push({
          turn: GM.turn, from: nc.from, to: nc.to,
          content: nc.content||'', summary: nc.summary||'',
          implication: nc.implication||'', type: nc.type||'secret'
        });
        if (typeof addEB === 'function') addEB('情报', '截获' + nc.from + '致' + nc.to + '的密信');
      }
    });
    GM._pendingNpcCorrespondence = [];
  }

  // 5. 远方奏疏驿递到达
  if (GM._pendingMemorialDeliveries && GM._pendingMemorialDeliveries.length > 0) {
    var _arrivedMems = [];
    GM._pendingMemorialDeliveries = GM._pendingMemorialDeliveries.filter(function(mem) {
      if (mem.status === 'intercepted') return true; // 被截获的留在队列中（不到达）
      if (GM.turn >= mem._deliveryTurn) {
        mem.status = 'pending'; // 改为可批复
        mem.turn = GM.turn; // 更新为到达回合（让renderMemorials显示）
        mem._arrivedTurn = GM.turn;
        if (!GM.memorials) GM.memorials = [];
        GM.memorials.push(mem);
        _arrivedMems.push(mem);
        return false; // 从队列移除
      }
      return true; // 继续等待
    });
    _arrivedMems.forEach(function(mem) {
      var ad = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('奏疏', mem.from + '自' + (mem._remoteFrom||'远方') + '的奏疏到达');
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: ad, content: '【驿递奏疏】收到' + mem.from + '自' + (mem._remoteFrom||'远方') + '所上奏疏。' });
    });
    if (_arrivedMems.length > 0 && typeof renderMemorials === 'function') renderMemorials();
  }

  // 6. 角色赶路统一交 advanceCharTravelByDays 处理
  // (R: 此处旧实现会先清 _travelTo·导致 advanceCharTravelByDays 跳过·自动就任丢失·
  //  且未清 _travelAssignPost/_travelRemainingDays·留下脏字段·
  //  统一由 tm-endturn-core.js Phase 4.6 advanceCharTravelByDays 处理)
}

function _ltUpdateEdictTrackerForLetter(letter, status, result) {
  if (typeof GM === 'undefined' || !GM || !letter || !Array.isArray(GM._edictTracker)) return;
  var item = GM._edictTracker.find(function(e) { return e && e.letterId === letter.id; });
  if (!item) return;
  item.status = status || item.status;
  item.deliveredTurn = GM.turn || item.deliveredTurn || 0;
  if (result) {
    item.policyResult = {
      ok: !!result.ok,
      pathway: result.pathway || '',
      typeKey: result.classification && result.classification.typeKey || ''
    };
  }
}

function _ltApplyFormalPolicyOnDelivery(letter) {
  if (typeof GM === 'undefined' || !GM || !letter) return null;
  if (letter._npcInitiated || letter.letterType !== 'formal_edict') return null;
  if (letter._policyApplyAttempted) return letter._policyExecution || null;
  var text = String(letter.content || '').trim();
  if (!text) return null;
  letter._policyApplyAttempted = true;
  var parser = (typeof EdictParser !== 'undefined') ? EdictParser : null;
  if (!parser || typeof parser.tryExecute !== 'function') {
    _ltUpdateEdictTrackerForLetter(letter, 'delivered', null);
    return null;
  }
  var result = null;
  try {
    result = parser.tryExecute(text, {}, {
      source: 'hongyan',
      channel: 'letter',
      letterId: letter.id,
      target: letter.to,
      targetLocation: letter.toLocation,
      urgency: letter.urgency,
      letterType: letter.letterType
    });
  } catch(e) {
    result = { ok: false, reason: e && e.message || 'hongyan_policy_error' };
  }
  letter._policyExecution = result;
  if (!GM._hongyanPolicyActions) GM._hongyanPolicyActions = [];
  GM._hongyanPolicyActions.push({
    turn: GM.turn || 0,
    letterId: letter.id,
    to: letter.to || '',
    ok: !!(result && result.ok),
    pathway: result && result.pathway || '',
    typeKey: result && result.classification && result.classification.typeKey || ''
  });
  if (GM._hongyanPolicyActions.length > 60) GM._hongyanPolicyActions.splice(0, GM._hongyanPolicyActions.length - 60);
  if (result && result.ok) {
    letter._policyApplied = true;
    _ltUpdateEdictTrackerForLetter(letter, 'executed', result);
    if (typeof addEB === 'function') addEB('鸿雁政令', '致' + (letter.to || '远臣') + '的正式诏令已落账');
  } else {
    _ltUpdateEdictTrackerForLetter(letter, 'delivered', result);
  }
  return result;
}

/** AI生成回信 */
/** 判定一封信是否走"安全路径"——双方均不在敌方实控区·驿路未阻·未围城
 *  在安全路径上·截获率应极低（≤5%）·只剩极小的"民间盗匪/沿途劫掠"概率
 */
function _ltIsSafePath(l) {
  var _from = l.fromLocation, _to = l.toLocation;
  // 端点检测：是否在敌方实控领土
  function _inEnemyTerr(loc) {
    if (!loc) return false;
    return (GM.facs||[]).some(function(f) {
      if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
      var _fTerr = f.territories || f.territory || [];
      if (typeof _fTerr === 'string') _fTerr = [_fTerr];
      return _fTerr.indexOf(loc) >= 0;
    });
  }
  if (_inEnemyTerr(_from) || _inEnemyTerr(_to)) return false;
  // 围城
  var _besieged = (GM._sieges||[]).some(function(s) { return s.target === _from || s.target === _to; });
  if (_besieged) return false;
  // 驿路阻断
  if (_ltIsRouteBlocked(_from, _to)) return false;
  return true;
}

/** 读取国势四象（皇权/皇威/民心/吏治·均 0-100）·多源回退·缺省 50 */
function _ltReadStateMetric(zhKey, enKey) {
  if (typeof GM === 'undefined' || !GM) return 50;
  var x = GM[enKey];
  if (x != null) {
    if (typeof x === 'number') return x;
    if (typeof x === 'object') {
      if (typeof x.index === 'number') return x.index;
      if (typeof x.value === 'number') return x.value;
    }
  }
  if (GM.vars && GM.vars[zhKey] && typeof GM.vars[zhKey].value === 'number') return GM.vars[zhKey].value;
  return 50;
}

/** 国势四象对截获率的乘数：
 *  四项均高（≥80）·驿政清明·盗匪不敢劫·乘数低至 0.4；
 *  四项均低（≤20）·吏治崩坏·盗匪横行·乘数高至 2.0；
 *  中位 50 → 1.0。设计上以"吏治+皇威"为主轴（直接影响驿政），"皇权+民心"为辅（间接威慑）
 */
function _ltStateMultiplier() {
  var _hq = _ltReadStateMetric('皇权', 'huangquan');
  var _hw = _ltReadStateMetric('皇威', 'huangwei');
  var _mx = _ltReadStateMetric('民心', 'minxin');
  var _lz = _ltReadStateMetric('吏治', 'lizhi');
  // 加权平均：吏治40% + 皇威30% + 皇权15% + 民心15%
  var _w = (_lz * 0.40) + (_hw * 0.30) + (_hq * 0.15) + (_mx * 0.15);
  // 50 → 1.0；80 → 0.55；100 → 0.4；20 → 1.55；0 → 2.0
  // 公式：(1 - (w-50)/50 × 0.6) ·下限 0.4 上限 2.0
  var _mul = 1 - ((_w - 50) / 50) * 0.6;
  return Math.max(0.4, Math.min(2.0, _mul));
}

/** 计算截获概率（基于地理、势力范围、驿路、加密、信件类型）
 *  R: 时间制 + 安全路径 + 国势调节 三重重构
 *  设计原则：
 *    1. 同省内/同地→零截获（在自家驿站网覆盖范围）
 *    2. 安全路径（无敌占区·无路阻·无围城）→ 上限 3%（仅模拟民间偶发劫掠）
 *    3. 国势四象（皇权/皇威/民心/吏治）综合调节·清明朝政可降至 0.4 倍·崩坏朝政升至 2.0 倍
 *    4. light_hist 整体 ×0.3·strict_hist 维持基础值
 *    5. formal_edict / military_order 走官方驿递·×0.6 朝廷招牌保护
 *    6. 默认 multi_courier 模式·×0.15·真实模拟"派多路信使"
 *    7. 仅在真正穿越敌占区或被围困时才有可观察的截获率（最高 30%）
 */
function _ltCalcInterceptRate(l, hostileFacs) {
  if (l.letterType === 'proclamation') return 0; // 檄文公开
  var _from = l.fromLocation, _to = l.toLocation;
  // 同省/同地·零截获（在自家驿站网内）
  if (typeof _ltCheckSameProvince === 'function' && _ltCheckSameProvince(_from, _to)) return 0;
  if (typeof _isSameLocation === 'function' && _isSameLocation(_from, _to)) return 0;

  var _safe = _ltIsSafePath(l);

  // 基础概率（降低基线·让远方信件默认能到）
  var rate = l.urgency === 'extreme' ? 0.01 : l.urgency === 'urgent' ? 0.02 : 0.03;
  // 信件类型权重
  var tw = (LETTER_TYPES[l.letterType]||{}).interceptWeight;
  if (tw !== undefined) rate *= (tw || 0.1);
  // 敌对势力存在·安全路径不加成；不安全路径才加
  if (!_safe && hostileFacs && hostileFacs.length > 0) rate += 0.02;
  // 地理因素：目标地/起点是否在敌方实控区（已在 _safe 中检测·这里再加权）
  var _inHostile = !_safe && (function(){
    var _loc = _to || _from;
    return (GM.facs||[]).some(function(f) {
      if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
      var _fTerr = f.territories || f.territory || [];
      if (typeof _fTerr === 'string') _fTerr = [_fTerr];
      return _fTerr.indexOf(_loc) >= 0;
    });
  })();
  if (_inHostile) rate += 0.10;
  // 围城（沟死）
  var _besieged = (GM._sieges||[]).some(function(s) { return s.target === _from || s.target === _to; });
  if (_besieged) rate += 0.15;
  // 驿路阻断
  if (_ltIsRouteBlocked(_from, _to)) rate += 0.06;
  // 加密降低截获内容可读性（但不降低截获率——只降低情报价值）
  // 密使模式·走暗线·截获率显著降低
  if (l._sendMode === 'secret_agent') rate *= 0.3;
  // 多路信使·至少一路成功（默认模式·真实模拟）
  if (l._sendMode === 'multi_courier') rate *= 0.15;
  // 官方驿递·朝廷招牌·驿站给优待
  if (l._sendMode === 'courier_official') rate *= 0.4;
  // formal/military_order 是国家公文·走官方驿递保护
  if (l.letterType === 'formal_edict' || l.letterType === 'military_order') rate *= 0.6;

  // 国势四象调节·吏治/皇威/皇权/民心 加权·清明 0.4× / 崩坏 2.0×
  rate *= _ltStateMultiplier();

  // 模式调节：light_hist 总体*0.3·strict_hist 维持基础值
  var _gMode = (P.conf && P.conf.gameMode) || '';
  if (_gMode === 'light_hist') rate *= 0.3;

  // 上限：安全路径 3%·有路阻/敌占区/围城 30%
  var _cap = _safe ? 0.03 : 0.30;
  return Math.min(_cap, Math.max(0, rate));
}

/** 执行截获——同步触发四条反应链：情报泄露·叙事记账·NPC 焦虑续问·UI 可知截获方 */
function _ltDoIntercept(l, hostileFacs) {
  l.status = 'intercepted';
  var _int = hostileFacs && hostileFacs.length > 0 ? hostileFacs[Math.floor(Math.random()*hostileFacs.length)].name : '不明势力';
  l.interceptedBy = _int;
  l._interceptedTurn = GM.turn; // 兼容字段
  l._interceptedDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : ((GM.turn-1)*((P.time && P.time.daysPerTurn)||30)); // 权威·NPC 焦虑/续问按天判定
  // 加密影响情报价值
  var _cipherInfo = LETTER_CIPHERS[l._cipher] || LETTER_CIPHERS.none;
  var _canRead = Math.random() < _cipherInfo.interceptReadChance;
  if (!GM._interceptedIntel) GM._interceptedIntel = [];
  GM._interceptedIntel.push({
    turn: GM.turn, interceptor: _int,
    from: l._npcInitiated ? l.from : '皇帝', to: l._npcInitiated ? '皇帝' : l.to,
    content: _canRead ? (l.content||'') : '（密函已截获但无法破译内容）',
    urgency: l.urgency||'normal', letterType: l.letterType||'personal',
    encrypted: !_canRead,
    militaryRelated: _canRead && ((l.content||'').indexOf('兵') >= 0 || (l.content||'').indexOf('军') >= 0 || l.letterType === 'military_order'),
    diplomaticRelated: _canRead && ((l.content||'').indexOf('盟') >= 0 || (l.content||'').indexOf('使') >= 0)
  });
  if (GM._interceptedIntel.length > 30) GM._interceptedIntel.shift();

  // ── 反应链 1：玩家信被截·NPC 不知旨意·进入"未送达指令"队列（AI prompt 让 NPC 按"没收到"行事）──
  if (!l._npcInitiated) {
    if (!GM._undeliveredLetters) GM._undeliveredLetters = [];
    GM._undeliveredLetters.push({ from: l.from, to: l.to, content: l.content, turn: GM.turn, interceptor: _int, letterType: l.letterType, letterId: l.id });
  }

  // ── 反应链 2：UI 状态条立即显示截获方（不再只说"失踪"）──
  GM._courierStatus[l.id] = '⚠ 信使于 ' + _int + ' 控制区遇袭·去向不明';

  // ── 反应链 3：伪造回信·让玩家可能上当（已有机制·维持）──
  if (!l._npcInitiated) {
    var _iFac = (GM.facs||[]).find(function(f){ return f.name === _int; });
    if (_iFac && Math.random() < 0.3) {
      l._forgedReply = true; l.status = 'intercepted_forging'; l.replyTurn = GM.turn + 1;
    }
  }

  // ── 反应链 4：叙事记账·让玩家通过多个渠道知情 ──
  var _isMilitary = l.letterType === 'military_order' || (_canRead && ((l.content||'').indexOf('兵') >= 0 || (l.content||'').indexOf('军') >= 0));
  var _isDiplomatic = l.letterType === 'diplomatic' || l.letterType === 'diplomatic_dispatch';
  var _date = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  // 起居注：玩家几乎一定能看到
  if (Array.isArray(GM.qijuHistory)) {
    var _qijuTxt = l._npcInitiated
      ? '【鸿雁遇险】' + l.from + '自' + (l.fromLocation||'远方') + '的来函中途被劫·疑为' + _int + '所为'
      : '【鸿雁遇险】致' + l.to + '的' + (LETTER_TYPES[l.letterType]||{label:'书函'}).label + '于驿道遇袭·疑为' + _int + '所为';
    if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: _date, content: _qijuTxt });
  }
  // 重大政令/军令被截·入编年史
  if (!l._npcInitiated && (_isMilitary || l.letterType === 'formal_edict' || _isDiplomatic)) {
    // 编年史走 TM.Chronicle 写口(2026-07-04 收口)·时序 push 归一(原 unshift 混写破序)
    if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
      turn: GM.turn, date: _date, type: '鸿雁遇险',
      title: '致' + l.to + '的' + (_isMilitary ? '军令' : _isDiplomatic ? '国书' : '诏令') + '被劫',
      content: '驿使于' + (l.toLocation||'远途') + '附近遇袭·疑为' + _int + '所为' + (_canRead ? '·原文已落敌方' : '·所幸密函未破译') + '。',
      tags: ['鸿雁','截获', _int, l.to]
    });
  }
  // 风闻系统：让玩家通过其他渠道在后续回合"听说"信件被劫
  try {
    if (typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
      PhaseD.addFengwen({
        type: '驿事', turn: GM.turn,
        text: (l._npcInitiated ? l.from + '上书' : '朝廷致' + l.to) + '之信使在' + (l.toLocation||l.fromLocation||'远方') + '失踪·或为' + _int + '所截',
        credibility: _int === '不明势力' ? 0.5 : 0.75,
        source: 'courier_loss',
        actors: [l.from, l.to, _int].filter(Boolean)
      });
    }
  } catch(_){}

  // 事件总线（旧机制·保留）
  if (typeof addEB === 'function') addEB('传书', (l._npcInitiated ? l.from + '的来函' : '致' + l.to + '的') + '信使遇袭·疑为' + _int + '所为');
}

function _generateLetterReply(letter) {
  try { _ltApplyFormalPolicyOnDelivery(letter); } catch(_policyE) {}
  letter.status = 'replying';
  var ch = findCharByName(letter.to);
  if (!ch) { letter.reply = '臣已拜读圣函。'; letter.status = 'returned'; return; }
  // 注：收信记忆已在 _settleLettersAndTravel 的 delivered 节点注入，此处不重复

  var typeLabel = (LETTER_TYPES[letter.letterType]||{}).label || '书信';

  if (typeof callAI === 'function' && P.ai && P.ai.key) {
    var brief = (typeof getCharacterPersonalityBrief === 'function') ? getCharacterPersonalityBrief(ch) : ch.name;
    var memCtx = (typeof NpcMemorySystem !== 'undefined') ? NpcMemorySystem.getMemoryContext(ch.name) : '';
    // 对玩家好感/积怨·影响语气
    var favor = 0;
    try { if (ch._impressions && ch._impressions['玩家']) favor = ch._impressions['玩家'].favor || 0; } catch(_){}
    var toneHint = '';
    if (favor >= 20) toneHint = '\n语气：感激温厚·愿效死力';
    else if (favor >= 5) toneHint = '\n语气：恭敬有分寸';
    else if (favor <= -15) toneHint = '\n语气：表面恭顺但暗含怨怼或疏离·可有所保留';
    else if (favor <= -5) toneHint = '\n语气：礼数不失但缺少热络';
    else toneHint = '\n语气：标准臣礼·不卑不亢';

    // 情节弧·若有
    var arcCtx = '';
    try {
      var arc = (typeof GM !== 'undefined' && GM._charArcs && GM._charArcs[ch.name]) ? GM._charArcs[ch.name] : null;
      if (arc) {
        if (arc.arcStage) arcCtx += '\n当前境：'+arc.arcStage;
        if (arc.motivation) arcCtx += '\n当前动机：'+arc.motivation;
        if (arc.emotionalState) arcCtx += '\n情绪基调：'+arc.emotionalState;
      }
    } catch(_){}

    // 近期涉该 NPC 的玩家诏令
    var recentEdictCtx = '';
    try {
      var tracker = (GM._edictTracker || []).filter(function(e) {
        if (!e || !e.content) return false;
        return e.content.indexOf(ch.name) >= 0 && (GM.turn - (e.turn||0)) <= _hyTurnsForMonths(3);
      }).slice(-3);
      if (tracker.length > 0) {
        recentEdictCtx = '\n玩家近期涉君诏令(回信可顺带回应)：';
        tracker.forEach(function(t) { recentEdictCtx += '\n  · ' + (t.content||'').slice(0, 80); });
      }
    } catch(_){}

    // 本轮往来上下文·若此信不是第一次
    var priorHistory = '';
    try {
      var earlier = (GM.letters || []).filter(function(l) {
        return l && l !== letter && ((l.to === ch.name) || (l.from === ch.name));
      }).slice(-3);
      if (earlier.length > 0) {
        priorHistory = '\n往来背景(近 3 封)：';
        earlier.forEach(function(l) {
          var dir = (l.from === ch.name) ? (ch.name+'→帝') : ('帝→'+ch.name);
          priorHistory += '\n  · '+dir+'·'+((l.content||'').slice(0, 50))+((l.reply&&l.from!==ch.name)?'(已回:'+l.reply.slice(0,40)+')':'');
        });
      }
    } catch(_){}

    var cipherLabel = (LETTER_CIPHERS && LETTER_CIPHERS[letter._cipher] && LETTER_CIPHERS[letter._cipher].label) || '不加密';
    var prompt = '你是' + ch.name + '·' + (ch.officialTitle||ch.title||'') + '·当前在' + (ch.location||'远方') + '。\n性格：' + brief;
    if (ch.stance) prompt += '\n政治立场：' + ch.stance;
    if (ch.party) prompt += '\n党派：' + ch.party + (ch.partyRank?'·'+ch.partyRank:'');
    if (memCtx) prompt += '\n近期心绪：' + memCtx;
    prompt += _hyPromptComposerAddon(ch);
    if (arcCtx) prompt += arcCtx;
    if (recentEdictCtx) prompt += recentEdictCtx;
    if (priorHistory) prompt += priorHistory;
    prompt += toneHint;
    if (typeof _buildTemporalConstraint === 'function') {
      try {
        // 扫描源：来自京城的来信(letter.content) + 往来背景 + 近期涉君诏令·回信者 ch.name 作种子恒入
        var _hyTopic = ((letter && letter.content) || '') + ' ' + (priorHistory || '') + ' ' + (recentEdictCtx || '');
        var _hyMentioned = (typeof _tcScanMentionedNames === 'function') ? _tcScanMentionedNames(_hyTopic, (ch && ch.name) ? [ch.name] : [], 10) : ((ch && ch.name) ? [ch.name] : []);
        prompt += _buildTemporalConstraint(ch, { mentionedNames: _hyMentioned });
      } catch(_){}
    }
    prompt += '\n\n收到来自京城天子的' + typeLabel + '('+cipherLabel+')：\n「' + letter.content + '」';
    prompt += '\n\n【回信要求】';
    prompt += '\n1. 以该角色口吻/身份/性格·100-200 字古典中文';
    prompt += '\n2. 称谓恰当(臣/末将/罪臣/妾身/草民等)';
    prompt += '\n3. 必须针对来信具体内容回应·不得套话空泛';
    prompt += '\n4. 若来信问及某事·直接给答复或说明缘由';
    prompt += '\n5. 若来信有命令·明确接旨或婉拒(附理由)';
    prompt += '\n6. 若近期有玩家涉君诏令·可在回信中顺带回应(感激/委屈/澄清/汇报)';
    prompt += '\n7. 语气与当前境/情绪/好感一致·不割裂';
    prompt += '\n8. 不要提及未在当前游戏时间之前发生的未来史实';
    prompt += '\n\n直接输出回信正文·无前言无解释。';
    callAI(prompt, 600, null, (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined).then(function(reply) {  // 【降本2026-06-19】回信生成(机械对话)走次 API
      letter.reply = (reply || '').trim() || '臣叩首拜读·容臣三思后详禀。';
      // 不在此置 returned——回信须待 _ltReplyArrivalDay 到期由结算分支(status==='replying')落地：
      // 核实揭伪(_forgedRevealed 唯一写点)/军令无虎符拒从/回信到达邸报都在那。即时 returned 曾令
      // 整条结算分支成死路·揭伪机制正常游玩永不触发·且回信零回程时间即刻可读(2026-07-04 审查定罪)
      letter._fallbackReply = false;
      try { if (typeof renderLetterPanel === 'function' && document.getElementById('letter-history')) renderLetterPanel(); } catch(_){}
      try { if (typeof addEB === 'function') addEB('传书', (letter.to||'') + '的回函已落笔'); } catch(_){}
    }).catch(function(err) {
      // AI 失败兜底：按性格写一条简短回信·而非千篇一律的"已拜读"
      var _ch2 = findCharByName(letter.to);
      var _t = '臣已拜读圣函·容臣三思。';
      if (_ch2) {
        if ((_ch2.loyalty||50) >= 75) _t = '臣' + _ch2.name + '谨遵圣谕·当竭股肱以效犬马·待详察后再行具奏。';
        else if ((_ch2.loyalty||50) < 35) _t = '臣' + _ch2.name + '已得来函·此事干系甚大·容臣再三斟酌后回奏。';
        else _t = '臣' + _ch2.name + '叩首拜读圣函·谨当详察·不日具复。';
      }
      letter.reply = _t;
      letter._fallbackReply = true; // 同上·status 留给到期结算分支翻转
      try { if (typeof renderLetterPanel === 'function' && document.getElementById('letter-history')) renderLetterPanel(); } catch(_){}
    });
  } else {
    letter.reply = '臣' + ch.name + '叩首·拜读圣函。容臣细思·当速具回奏。';
    // 无 key 路径同上·status 留给到期结算分支翻转(回程时间照走)
  }
}

/** AI prompt注入：角色位置+传书完整态势 */
function getLocationPromptInjection() {
  var capital = GM._capital || '京城';
  var remote = (GM.chars||[]).filter(function(c) { return c.alive !== false && c.location && !_isSameLocation(c.location, capital); });
  var allLetters = GM.letters || [];
  // 排除：returned(已回)/intercepted(已截)/recalled(已追回)/blocked(被阻于中书)
  // 这四类都不是"还在驿路上等结果"·不应作为在途态势喂给 AI prompt
  var pendingLetters = allLetters.filter(function(l) {
    return l.status !== 'returned' && l.status !== 'intercepted'
        && l.status !== 'recalled' && l.status !== 'blocked';
  });
  var suspectedIds = GM._letterSuspects || [];

  if (remote.length === 0 && allLetters.length === 0) return '';
  var lines = ['【鸿雁传书·完整态势】'];
  lines.push('京城：' + capital);

  if (remote.length > 0) {
    lines.push('不在京城的角色（不能参与朝堂对话/朝议）：');
    remote.forEach(function(c) {
      var line = '  ' + c.name + '（' + c.location + '）';
      if (c._travelTo) line += ' →正在赶往' + c._travelTo;
      if (c.title) line += ' ' + c.title;
      lines.push(line);
    });
  }

  // 在途信件
  if (pendingLetters.length > 0) {
    lines.push('当前在途信件：');
    pendingLetters.forEach(function(l) {
      var typeLabel = (LETTER_TYPES[l.letterType]||{}).label || '书信';
      var st = { traveling:'信使在途', delivered:'已送达待回信', replying:'回信在途', intercepted_forging:'回信在途' };
      if (l._npcInitiated) {
        lines.push('  ' + l.from + '→皇帝（' + typeLabel + '·' + (l.urgency==='extreme'?'八百里加急':l.urgency==='urgent'?'加急':'驿递') + '）：' + (st[l.status]||l.status));
      } else {
        lines.push('  皇帝→' + l.to + '（' + typeLabel + '·' + (l.urgency==='extreme'?'八百里加急':l.urgency==='urgent'?'加急':'驿递') + '）：' + (st[l.status]||l.status));
      }
    });
  }

  // ★2026-07-01 O4·补玩家私信正文:此前鸿雁只注物流态势(在途/被截)·玩家信里下的实质指令只靠 sc1q 抽一次·
  //   sc1q 挂则 SC1 永远看不到信里写了什么(六界面最薄的腿)。此处注入近2回合玩家发出、未截获的信的正文摘要·让推演不依赖 sc1q 也知玩家私信里下的令。
  // ★codex-fix O4:窗口收紧为「本回合新发」(sentTurn===GM.turn)·此前 <=2 令同一在途信连续2-3回合重复注入正文·且与 sc1q 输入5 双注入。只注本回合新令。
  var _playerLetters = pendingLetters.filter(function(l){ return l && !l._npcInitiated && l.content && l.sentTurn === GM.turn; });
  if (_playerLetters.length > 0) {
    lines.push('本回合皇帝新发私信内容（玩家经鸿雁亲下·可能含实质指令/嘱托·NPC 收到后应据此行动，勿只当物流）：');
    _playerLetters.slice(-6).forEach(function(l){
      var _lc = String(l.content||'').replace(/<[^>]+>/g, '').slice(0, 120);
      lines.push('  皇帝→' + l.to + '：「' + _lc + '」');
    });
  }

  // 信使失踪（截获线索——玩家看到的是"信使逾期"）
  var lostLetters = allLetters.filter(function(l) {
    return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + _hyTurnsForMonths(1));
  });
  if (lostLetters.length > 0) {
    lines.push('信使失踪（可能被截获）：');
    lostLetters.forEach(function(l) {
      var target = l._npcInitiated ? ('来自' + l.from) : ('致' + l.to);
      lines.push('  ' + target + '的信使已逾期' + (GM.turn - l.deliveryTurn) + '回合未归');
      if (l._npcInitiated) lines.push('    →' + l.from + '不知道皇帝是否收到其报告，可能焦虑或自行决断');
      else lines.push('    →' + l.to + '未收到皇帝命令，不会按旨行事');
    });
  }

  // 玩家存疑的信件
  if (suspectedIds.length > 0) {
    lines.push('玩家存疑的回信：');
    suspectedIds.forEach(function(sid) {
      var sl = allLetters.find(function(l){ return l.id === sid; });
      if (sl) lines.push('  致' + sl.to + '的回信被玩家标记存疑' + (sl._isForged ? '——【确实是伪造的】' : '——【实际是真信】'));
    });
    lines.push('  →若回信确系伪造，应在叙事中给出更多线索（如NPC行为与信中所述矛盾）');
    lines.push('  →若为真信但被存疑，NPC可能因不被信任而不满');
  }

  // NPC期望回信但未回
  var _npcWaiting = allLetters.filter(function(l) {
    return l._npcInitiated && l._replyExpected && l.status === 'returned' && !l._playerReplied && (GM.turn - l.deliveryTurn) > _hyTurnsForMonths(2);
  });
  if (_npcWaiting.length > 0) {
    lines.push('NPC待回信（期望回复但玩家未回）：');
    _npcWaiting.forEach(function(l) {
      lines.push('  ' + l.from + '来函已等' + (GM.turn - l.deliveryTurn) + '回合未回→可能影响NPC情绪（忠诚、焦虑）');
    });
  }

  // 精确信息时差
  if (remote.length > 0) {
    lines.push('【各NPC信息时差——决定NPC基于什么信息做决策】');
    remote.forEach(function(c) {
      var lastReceived = 0;
      allLetters.forEach(function(l) {
        if (l.to === c.name && (l.status === 'delivered' || l.status === 'returned' || l.status === 'replying')) {
          lastReceived = Math.max(lastReceived, l.deliveryTurn || l.sentTurn);
        }
      });
      var lastSent = 0;
      allLetters.forEach(function(l) {
        if (l.from === c.name && l.status === 'returned') {
          lastSent = Math.max(lastSent, l.sentTurn);
        }
      });
      var delay = lastReceived > 0 ? (GM.turn - lastReceived) : '从未';
      lines.push('  ' + c.name + '（' + c.location + '）：');
      lines.push('    最后收到皇帝指令：' + (lastReceived > 0 ? delay + '回合前' : '从未') + ' → 其决策基于' + (lastReceived > 0 ? delay + '回合前的信息' : '自身判断'));
      if (lastSent > 0) lines.push('    最后来函：' + (GM.turn - lastSent) + '回合前');
      // 是否有未送达命令
      var _undel = (GM._undeliveredLetters||[]).filter(function(u) { return u.to === c.name; });
      if (_undel.length > 0) lines.push('    ⚠ 有' + _undel.length + '封命令未送达——此NPC不知道皇帝的指令');
    });
  }

  // 驿路阻断
  var _disruptions = (GM._routeDisruptions||[]).filter(function(d) { return !d.resolved; });
  if (_disruptions.length > 0) {
    lines.push('【驿路阻断】');
    _disruptions.forEach(function(d) {
      lines.push('  ' + (d.route||d.from+'-'+d.to) + '：' + (d.reason||'原因不明') + ' → 该方向信件截获率大幅提高');
    });
  }

  lines.push('');
  lines.push('【信件驱动NPC行为——核心规则】');
  lines.push('NPC收到皇帝信件后的行为必须在npc_actions中体现：');
  lines.push('  - 收到征调令+有虎符 → 执行调兵（但可能阳奉阴违）');
  lines.push('  - 收到征调令但无虎符 → 疑诏不从，或要求出示凭证');
  lines.push('  - 收到密旨 → 秘密执行（但密旨不经中书，法理性弱）');
  lines.push('  - 从未收到指令 → 按自身判断行事，可能与皇帝意图相悖');
  lines.push('  - 信使失踪多日 → NPC焦虑，可能派人来京打探');
  lines.push('NPC间也会通信——在npc_correspondence中输出重要的NPC间密信：');
  lines.push('  格式: {from,to,content,summary,implication,type:"secret/alliance/conspiracy/routine"}');
  lines.push('  只输出对剧情有影响的通信（密谋/结盟/背叛/情报交换），不必输出日常问候');
  lines.push('NPC主动来书：远方NPC遇重大事件时应在npc_letters中输出。');
  return lines.join('\n');
}



if (typeof SettlementPipeline !== 'undefined') {
  SettlementPipeline.register('letters', '鸿雁传书', function() { _settleLettersAndTravel(); }, 42, 'perturn');
}

/** 控制台·信件医生：一键修复存量卡死信件
 *  用法：在 DevTools 控制台执行 letterDoctor() 即可
 *  · 消费 _pendingNpcLetters 待入队的 NPC 来信·防止永远积压
 *  · traveling 且 GM.turn>=deliveryTurn 的所有信·立刻送达
 *  · intercepted 的信·若 deliveryTurn 已过·转 returned 并附驿递备注·同步清 _undeliveredLetters
 *  · _npcInitiated 的 delivered/traveling 已到期信·转 returned
 *  · 输出修复明细
 */
function letterDoctor() {
  if (typeof GM === 'undefined' || !GM) { console.warn('[letterDoctor] GM 未初始化'); return; }
  if (!Array.isArray(GM.letters)) GM.letters = [];
  if (!Array.isArray(GM._pendingNpcLetters)) GM._pendingNpcLetters = [];
  if (!GM._courierStatus) GM._courierStatus = {};
  var fixed = { delivered: 0, replied: 0, returned: 0, npcArrived: 0, interceptedHealed: 0, pendingFlushed: 0 };
  var nowTurn = GM.turn || 0;
  var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (nowTurn-1)*_dpv;
  function _arrDay(l){ return (typeof l._deliveryDay === 'number') ? l._deliveryDay : (typeof l.deliveryTurn === 'number') ? (l.deliveryTurn-1)*_dpv : Infinity; }
  function _replyDay(l){ return (typeof l._replyDay === 'number') ? l._replyDay : (typeof l.replyTurn === 'number') ? (l.replyTurn-1)*_dpv : _arrDay(l)+_dpv; }

  // 0·先把 pending NPC 队列消费成 letters（直接 returned·跳过 traveling 周期·让玩家立即看到）
  if (GM._pendingNpcLetters.length > 0) {
    var _capital = GM._capital || '京城';
    var _nlBatch = GM._pendingNpcLetters.slice();
    GM._pendingNpcLetters = [];
    _nlBatch.forEach(function(nl) {
      try {
        if (!nl || !nl.from) return;
        var fromCh = (typeof findCharByName === 'function') ? findCharByName(nl.from) : null;
        var fromLoc = fromCh ? (fromCh.location || '远方') : '远方';
        GM.letters.push({
          id: (typeof uid === 'function') ? uid() : 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
          from: nl.from, to: '玩家', fromLocation: fromLoc, toLocation: _capital,
          content: nl.content||'', sentTurn: nowTurn, deliveryTurn: nowTurn,
          _sentDay: nowDay, _deliveryDay: nowDay, _travelDays: 0,
          reply: '', status: 'returned', urgency: nl.urgency||'normal',
          letterType: nl.type||'report', _npcInitiated: true,
          _replyExpected: nl.replyExpected !== false, _playerRead: false,
          _suggestion: nl.suggestion || '', _sendMode: 'multi_courier',
          _doctorFlushed: true
        });
        fixed.pendingFlushed++;
      } catch(_){}
    });
  }

  GM.letters.forEach(function(l) {
    if (!l) return;
    var _arr = _arrDay(l);
    var _rep = _replyDay(l);
    // 玩家信·卡 traveling 且已到期 → delivered → replying → returned
    if (!l._npcInitiated && l.status === 'traveling' && nowDay >= _arr) {
      l.status = 'delivered'; fixed.delivered++;
      try { if (typeof _generateLetterReply === 'function') _generateLetterReply(l); fixed.replied++; } catch(_){ }
    }
    // 玩家信·卡 replying 且已到期 → returned
    if (!l._npcInitiated && l.status === 'replying' && nowDay >= _rep) {
      l.status = 'returned'; fixed.returned++;
      if (!l.reply) l.reply = '臣已拜读圣函·当尽心承命·容详察具复。';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + '已收函';
    }
    // NPC 来信·卡 traveling/delivered 且已到期 → returned
    if (l._npcInitiated && (l.status === 'traveling' || l.status === 'delivered') && nowDay >= _arr) {
      l.status = 'returned'; fixed.npcArrived++;
    }
    // intercepted 已久 → returned 并附备注·同步清 _undeliveredLetters（45 天阈值）
    if (l.status === 'intercepted' && nowDay > _arr + 45) {
      l.status = 'returned'; fixed.interceptedHealed++;
      if (!l.reply) l.reply = '（信使遗失·辗转送达·原文已部分残缺）';
      GM._courierStatus[l.id] = '信使辗转归来';
      if (Array.isArray(GM._undeliveredLetters)) {
        GM._undeliveredLetters = GM._undeliveredLetters.filter(function(u){
          return !(u && u.from === l.from && u.to === l.to && u.content === l.content);
        });
      }
    }
    // intercepted_forging 久未触发回信 → 强制 returned 并标记伪造（30 天阈值）
    if (l.status === 'intercepted_forging' && nowDay > _arr + 30) {
      l.status = 'returned'; l._isForged = true; fixed.interceptedHealed++;
      if (!l.reply) l.reply = '（伪造回函·内容可疑）';
      GM._courierStatus[l.id] = '伪造回函·疑窦';
    }
  });
  if (typeof renderLetterPanel === 'function') {
    try { renderLetterPanel(); } catch(_){}
  }
  console.log('[letterDoctor] 修复完成:', fixed,
    '| 当前 letters 状态分布:',
    GM.letters.reduce(function(a, l){ a[l.status] = (a[l.status]||0) + 1; return a; }, {}));
  if (typeof toast === 'function') {
    var n = fixed.delivered + fixed.returned + fixed.npcArrived + fixed.interceptedHealed + fixed.pendingFlushed;
    toast('信件医生：修复 ' + n + ' 封'
      + (fixed.pendingFlushed ? '·NPC 待入队 ' + fixed.pendingFlushed : '')
      + (fixed.npcArrived ? '·NPC来函 ' + fixed.npcArrived : '')
      + (fixed.delivered ? '·玩家信送达 ' + fixed.delivered : '')
      + (fixed.interceptedHealed ? '·失踪信归 ' + fixed.interceptedHealed : ''));
  }
  return fixed;
}
if (typeof window !== 'undefined') window.letterDoctor = letterDoctor;

/** 控制台·信件诊断：不修改任何状态·只输出当前信件系统的健康报告
 *  用法：letterDiag()
 *  返回详细分布·让玩家自查 + 直接发开发者排错
 */
function letterDiag() {
  if (typeof GM === 'undefined' || !GM) return console.warn('[letterDiag] GM 未初始化');
  var letters = GM.letters || [];
  var nowTurn = GM.turn || 0;
  var byStatus = {}, npcInit = 0, playerSent = 0;
  var stuckTraveling = [], stuckIntercepted = [];
  letters.forEach(function(l) {
    if (!l) return;
    byStatus[l.status||'?'] = (byStatus[l.status||'?']||0) + 1;
    if (l._npcInitiated) npcInit++; else if (l.from === '玩家') playerSent++;
    if (l.status === 'traveling' && typeof l.deliveryTurn === 'number' && nowTurn > l.deliveryTurn + _hyTurnsForMonths(1)) {
      stuckTraveling.push({id:l.id, to:l.to, from:l.from, sentTurn:l.sentTurn, deliveryTurn:l.deliveryTurn, overdue: nowTurn - l.deliveryTurn});
    }
    if (l.status === 'intercepted' && typeof l.deliveryTurn === 'number' && nowTurn > l.deliveryTurn + _hyTurnsForMonths(3)) {
      stuckIntercepted.push({id:l.id, to:l.to, from:l.from, by:l.interceptedBy, deliveryTurn:l.deliveryTurn});
    }
  });
  var pipelineHasLetters = (typeof SettlementPipeline !== 'undefined') &&
    SettlementPipeline.list().some(function(s){ return s.id === 'letters'; });
  var report = {
    turn: nowTurn,
    capital: GM._capital,
    gameMode: (P.conf && P.conf.gameMode) || 'yanyi',
    canIntercept: (P.conf && (P.conf.gameMode === 'strict_hist' || P.conf.gameMode === 'light_hist')),
    pipelineHasLetters: pipelineHasLetters,
    lettersTotal: letters.length,
    byStatus: byStatus,
    npcInitiated: npcInit,
    playerSent: playerSent,
    pendingNpcLetters: (GM._pendingNpcLetters||[]).length,
    pendingMemorialDeliveries: (GM._pendingMemorialDeliveries||[]).length,
    routeDisruptions: ((GM._routeDisruptions||[]).filter(function(d){return !d.resolved;})).length,
    interceptedIntel: (GM._interceptedIntel||[]).length,
    undeliveredLetters: (GM._undeliveredLetters||[]).length,
    stuckTravelingCount: stuckTraveling.length,
    stuckInterceptedCount: stuckIntercepted.length,
    stuckTravelingSample: stuckTraveling.slice(0,3),
    stuckInterceptedSample: stuckIntercepted.slice(0,3)
  };
  console.log('═══════ 鸿雁传书诊断报告 ═══════');
  console.log(report);
  if (!pipelineHasLetters) console.warn('⚠ letters 步骤未注册到 SettlementPipeline·结算永不会跑·请重启 app');
  if (stuckTraveling.length > 0) console.warn('⚠ ' + stuckTraveling.length + ' 封信卡 traveling 已逾期·建议执行 letterDoctor()');
  if (stuckIntercepted.length > 0) console.warn('⚠ ' + stuckIntercepted.length + ' 封信卡 intercepted 久未处理·建议执行 letterDoctor()');
  if ((GM._pendingNpcLetters||[]).length > 0) console.warn('⚠ ' + GM._pendingNpcLetters.length + ' 条 NPC 来信待入队·下回合结算时入队·或执行 letterDoctor() 立即消费');
  return report;
}
if (typeof window !== 'undefined') window.letterDiag = letterDiag;
