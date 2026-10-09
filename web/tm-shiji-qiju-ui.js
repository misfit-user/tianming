// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-shiji-qiju-ui.js — 史记列表 + 起居注渲染 UI
//
// R97 从 tm-endturn.js 抽出·原 L13276-13744 (469 行)
// 13 函数：
//   史记：renderShijiList / _sjlExtractDeltas / _sjlExport / _sjlDownload
//   起居注：_qijuNormalize / _qijuCatClass / _qijuCatKey / _qijuHighlight /
//          renderQiju / _qijuAnnotate / _qijuZoom / _qijuExport / _qijuDownload
//   状态：var _sjlPage/_sjlKw/_sjlPageSize/_sjlYrFilter/_sjlTypeFilter
//        var _qijuPage/_qijuKw/_qijuCat/_qijuPageSize/_qijuAnnotOnly/_qijuSort/_qijuCollapseNarr
//
// 外部调用：renderShijiList (4 文件)+renderQiju (3 文件)+_qijuExport (1 文件)
// 依赖外部：GM / P / _$ / toast / openGenericModal 等 window 全局
//
// 加载顺序：必须在 tm-endturn.js 之前
// ============================================================

// 史记列表（带分页+搜索+导出）
// 史官档案默认不裁掉旧回合；玩家可手动改为分页。
var _sjlPage=0,_sjlKw='',_sjlPageSize='all',_sjlYrFilter='',_sjlTypeFilter='';
var _sjlRenderTimer=0;
function scheduleShijiListRender(delay){
  if(_sjlRenderTimer)clearTimeout(_sjlRenderTimer);
  _sjlRenderTimer=setTimeout(function(){
    _sjlRenderTimer=0;
    renderShijiList();
  },delay==null?120:delay);
}
function _sjlPageSizeNum(total){
  if (_sjlPageSize === 'all') return Math.max(1, total || 1);
  var n = parseInt(_sjlPageSize, 10);
  return isFinite(n) && n > 0 ? n : 50;
}
function _sjlTrimText(text, limit){
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  limit = limit || 360;
  return text.length > limit ? text.slice(0, limit) + '……' : text;
}
function _sjlRecordPreview(sj){
  var parts = [];
  if (sj.shilu) parts.push('<div class="sj-preview-line shilu"><span>实录</span>' + escHtml(_sjlTrimText(sj.shilu, 420)) + '</div>');
  if (sj.shizhengji) parts.push('<div class="sj-preview-line szj"><span>时政</span>' + escHtml(_sjlTrimText(sj.shizhengji, 420)) + '</div>');
  if (!parts.length && sj.zhengwen) parts.push('<div class="sj-preview-line"><span>政文</span>' + escHtml(_sjlTrimText(sj.zhengwen, 420)) + '</div>');
  return parts.join('');
}
function _sjlRecordHtml(sj){
  if (!sj) return '';
  if (sj.html) return sj.html;
  var html = '';
  if (sj.shilu) {
    html += '<div class="tr-section shilu">'
      + '<div class="tr-section-hdr"><span class="lab">实 录</span><span class="meta">起居注官实录 · 正史体</span></div>'
      + '<div class="tr-shilu"><div class="tr-shilu-seal">史官</div>' + escHtml(sj.shilu) + '</div>'
      + '</div>';
  }
  if (sj.shizhengji) {
    html += '<div class="tr-section szj"><div class="tr-section-hdr"><span class="lab">时 政 记</span><span class="meta">朝政纪要体</span></div>';
    if (sj.szjTitle) html += '<div class="tr-szj-title">' + escHtml(sj.szjTitle) + '</div>';
    html += '<div class="tr-szj-content"><p>' + escHtml(sj.shizhengji).replace(/\n+/g, '</p><p>') + '</p></div>';
    if (sj.szjSummary || sj.turnSummary) html += '<div class="tr-szj-summary">' + escHtml(sj.szjSummary || sj.turnSummary) + '</div>';
    html += '</div>';
  }
  if (sj.zhengwen) {
    html += '<div class="tr-section"><div class="tr-section-hdr"><span class="lab">政 文</span><span class="meta">推演正文</span></div>'
      + '<div class="tr-szj-content"><p>' + escHtml(sj.zhengwen).replace(/\n+/g, '</p><p>') + '</p></div></div>';
  }
  if (sj.houren) {
    html += '<div class="tr-section houren"><div class="tr-section-hdr"><span class="lab">后 人 戏 说</span><span class="meta">稗官野史 · 参考不可尽信</span></div>'
      + '<div class="tr-houren-box">' + escHtml(sj.houren) + '</div></div>';
  }
  return html || escHtml(sj.shizhengji || sj.shilu || sj.turnSummary || '');
}
function _sjlRecordHtmlByIdx(idx){
  return _sjlRecordHtml(GM.shijiHistory && GM.shijiHistory[idx]);
}
function renderShijiList(force){
  var el=_$("shiji-list");if(!el)return;
  // 性能·史记面板隐藏时跳过重渲（切到 gt-shiji 时由 switchGTab force 渲染）·shijiHistory 长局可达数百条·此处省掉每次 renderGameState 的全量 reverse+分组
  if(!force && typeof _gtTabVisible==='function' && !_gtTabVisible('gt-shiji')) return;
  var all=(GM.shijiHistory||[]).slice().reverse();
  var kw=(_sjlKw||'').trim().toLowerCase();
  var yrFilter=_sjlYrFilter||'';
  var typeFilter=_sjlTypeFilter||'';

  // 年度分组（从 sj.time 提取年号）
  function _sjYear(sj){
    var t = sj.time || '';
    var m = t.match(/(.{2,8}\u5E74)/);
    if (m) return m[1];
    if (typeof calcDateFromTurn === 'function') {
      var di = calcDateFromTurn(sj.turn || 1);
      if (di && typeof di.adYear !== 'undefined') return String(di.adYear) + '\u5E74';
    }
    var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var baseYear = (typeof P !== 'undefined' && P.time && typeof P.time.year === 'number') ? P.time.year : 0;
    return String(baseYear + Math.floor(((sj.turn || 1) - 1) * dpv / 365)) + '\u5E74';
  }
  function _sjDate(sj){
    var t = sj.time || '';
    var d = t.replace(/^.{2,8}\u5E74/, '').trim();
    return d || ('T' + (sj.turn||0));
  }
  // 回合类型（war/death/major）
  function _sjTypes(sj){
    var types = {};
    var txt = (sj.shizhengji||'') + ' ' + (sj.shilu||'') + ' ' + (sj.szjTitle||'');
    if (/战|战事|攻城|戒|失陷|旋师|出兵|战役|大捷/.test(txt)) types.war = 1;
    if (/殁|崩|薨|薨|人殁|病死|感疾|自刎/.test(txt)) types.death = 1;
    if (/\u5BC6\u8C0B|\u963F\u8C0B|\u9634\u8C0B/.test(txt)) types.scheme = 1;
    if (/\u515A\u4E89|\u515A\u6D3E|\u4E1C\u6797|\u9609\u515A|\u515A\u7FBD/.test(txt)) types.faction = 1;
    if (/旱|洪|雪灾|霹霸|震灾|疫|蝗|天火|人灾|蝙/.test(txt)) types.calamity = 1;
    if (Array.isArray(sj.personnel) && sj.personnel.length > 0) types.event = 1;
    return types;
  }

  // 年度下拉集合
  var _allYears = {};
  (GM.shijiHistory||[]).forEach(function(sj){ var y = _sjYear(sj); _allYears[y] = (_allYears[y]||0) + 1; });

  // 筛选
  var filtered = all;
  if (kw) filtered = filtered.filter(function(sj){
    return (sj.shizhengji||'').toLowerCase().indexOf(kw)>=0 ||
           (sj.time||'').toLowerCase().indexOf(kw)>=0 ||
           (sj.szjTitle||'').toLowerCase().indexOf(kw)>=0 ||
           (sj.turnSummary||'').toLowerCase().indexOf(kw)>=0 ||
           String(sj.turn).indexOf(kw)>=0;
  });
  if (yrFilter) filtered = filtered.filter(function(sj){ return _sjYear(sj) === yrFilter; });
  if (typeFilter) filtered = filtered.filter(function(sj){ return !!_sjTypes(sj)[typeFilter]; });

  var total=filtered.length;
  var pageSize = _sjlPageSizeNum(total);
  var pages=Math.ceil(total/pageSize)||1;
  if(_sjlPage>=pages)_sjlPage=pages-1;
  if(_sjlPage<0)_sjlPage=0;
  var slice=filtered.slice(_sjlPage*pageSize,(_sjlPage+1)*pageSize);

  // 工具栏
  var h = '<div class="sj-tools">';
  h += '<span class="sj-tools-lbl">\u7FFB\u3000\u9605</span>';
  h += '<div class="sj-search-wrap"><input id="sjl-kw" class="sj-search" placeholder="\u641C\u7D22\u56DE\u5408\u00B7\u65E5\u671F\u00B7\u8981\u95FB\u2026\u2026" value="' + (_sjlKw||'').replace(/"/g,'&quot;') + '" oninput="_sjlKw=this.value;_sjlPage=0;scheduleShijiListRender()"></div>';
  // 年份下拉
  var yrOpts = '<option value="">\u5168\u90E8\u5E74\u4EFD</option>';
  Object.keys(_allYears).forEach(function(y){
    yrOpts += '<option value="' + escHtml(y) + '"' + (yrFilter===y?' selected':'') + '>' + escHtml(y) + ' (' + _allYears[y] + '\u6761)</option>';
  });
  h += '<select class="sj-filter" onchange="_sjlYrFilter=this.value;_sjlPage=0;renderShijiList()">' + yrOpts + '</select>';
  // 类型下拉
  var typeOpts = [
    {k:'', l:'\u5168\u90E8\u7C7B\u578B'},
    {k:'war', l:'\u2694 \u6218\u4E8B'},
    {k:'death', l:'\u2623 人殁'},
    {k:'calamity', l:'\u26A1 \u707E\u5F02'},
    {k:'scheme', l:'\u25C9 \u5BC6\u8C0B'},
    {k:'faction', l:'\u25CE \u515A\u4E89'},
    {k:'event', l:'\u2605 \u4EBA\u4E8B'}
  ].map(function(t){ return '<option value="' + t.k + '"' + (typeFilter===t.k?' selected':'') + '>' + t.l + '</option>'; }).join('');
  h += '<select class="sj-filter" onchange="_sjlTypeFilter=this.value;_sjlPage=0;renderShijiList()">' + typeOpts + '</select>';
  var sizeOpts = [
    {v:'all', l:'全部'},
    {v:'20', l:'20回/页'},
    {v:'50', l:'50回/页'},
    {v:'100', l:'100回/页'}
  ].map(function(o){ return '<option value="' + o.v + '"' + (String(_sjlPageSize)===o.v?' selected':'') + '>' + o.l + '</option>'; }).join('');
  h += '<select class="sj-filter" onchange="_sjlPageSize=this.value;_sjlPage=0;renderShijiList()">' + sizeOpts + '</select>';
  h += '<button class="sj-export" onclick="_sjlExport()">\u5BFC \u51FA \u5168 \u53F2</button>';
  h += '<span class="sj-stat">\u5171 <span class="n">' + (GM.shijiHistory||[]).length + '</span> \u56DE \u00B7 \u663E <span class="n">' + total + '</span> \u56DE</span>';
  h += '</div>';

  if (!slice.length) {
    h += '<div style="color:var(--color-foreground-muted);text-align:center;padding:2rem;font-family:var(--font-serif);letter-spacing:0.2em;">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u53F2\u8BB0</div>';
  } else {
    // 按年分组
    var _lastYear = null;
    slice.forEach(function(sj) {
      var yr = _sjYear(sj);
      if (yr !== _lastYear) {
        var _yCount = _allYears[yr] || 0;
        h += '<div class="sj-year-sep">' + escHtml(yr) + ' <span class="y-count">' + _yCount + ' \u56DE</span></div>';
        _lastYear = yr;
      }
      var idx = GM.shijiHistory.length - 1 - all.indexOf(sj);
      var types = _sjTypes(sj);
      var cardCls = 'sj-card';
      if (types.war) cardCls += ' has-war';
      if (types.death) cardCls += ' has-death';
      if (types.war && types.death) cardCls += ' has-major';
      if (sj.turnSummary && sj.turnSummary.length > 10) cardCls += ' has-major';
      var dateStr = _sjDate(sj);
      var era = (sj.time||'').match(/([\u7532\u4E59\u4E19\u4E01\u620A\u5DF1\u5E9A\u8F9B\u58EC\u7678][\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5])/);
      var eraStr = era ? era[1] : '';
      var season = (dateStr.match(/(\u6625|\u590F|\u79CB|\u51AC|[\u6B63\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341\u814A]\u6708)/) || [])[1] || '';
      var eraChip = (eraStr || season) ? (eraStr + (season && eraStr ? '\u00B7' + season.charAt(0) : season)) : '';

      var sumText = sj.turnSummary || sj.szjSummary || (sj.shizhengji||'').split(/[\u3002\uFF01\n]/)[0] || '';
      var titleText = sj.szjTitle || '';

      h += '<div class="' + cardCls + '" onclick="showTurnResult(_sjlRecordHtmlByIdx(' + idx + '),' + idx + ')">';
      // 左：回合号
      h += '<div class="sj-turn-col">';
      h += '<div class="sj-turn-no"><span class="n">' + sj.turn + '</span>\u56DE</div>';
      h += '<div class="sj-turn-date">' + escHtml(dateStr.slice(0,8)) + '</div>';
      if (eraChip) h += '<div class="sj-turn-era">' + escHtml(eraChip) + '</div>';
      h += '</div>';
      // 中：摘要
      h += '<div class="sj-body-col">';
      if (titleText) h += '<div><span class="sj-szj-title">' + escHtml(titleText) + '</span></div>';
      h += '<div class="sj-sum">' + escHtml(sumText || sj.shizhengji || sj.shilu || '') + '</div>';
      var previewHtml = _sjlRecordPreview(sj);
      if (previewHtml) h += '<div class="sj-record-preview">' + previewHtml + '</div>';
      // tags
      var tags = [];
      if (types.war) tags.push({cls:'war', l:'\u6218\u4E8B'});
      if (types.death) tags.push({cls:'death', l:'人殁'});
      if (types.scheme) tags.push({cls:'scheme', l:'\u5BC6\u8C0B'});
      if (types.faction) tags.push({cls:'faction', l:'\u515A\u4E89'});
      if (types.calamity) tags.push({cls:'calamity', l:'\u707E\u5F02'});
      if (types.event) tags.push({cls:'event', l:'\u4EBA\u4E8B'});
      if (tags.length > 0) {
        h += '<div class="sj-tags-row">';
        tags.forEach(function(t){ h += '<span class="sj-tag ' + t.cls + '">' + t.l + '</span>'; });
        h += '</div>';
      }
      h += '</div>';
      // 右：delta 徽章（从 turnChanges 推断 top 3-4 变化）
      h += '<div class="sj-delta-col">';
      var deltaBadges = _sjlExtractDeltas(sj);
      deltaBadges.slice(0,4).forEach(function(d){
        h += '<span class="sj-delta-badge ' + d.dir + '"><span class="lbl">' + escHtml(d.lbl) + '</span>' + escHtml(d.val) + '</span>';
      });
      h += '</div>';
      h += '</div>';
    });
  }

  // 分页
  h += '<div class="sj-paging">';
  h += '<button class="sj-pg-btn" ' + (_sjlPage<=0?'disabled':'') + ' onclick="_sjlPage--;renderShijiList()">\u2039</button>';
  h += '<span class="sj-pg-info"><span class="n">' + (_sjlPage+1) + '</span> / ' + pages + ' \u00B7 \u5171 <span class="n">' + total + '</span> \u56DE</span>';
  h += '<button class="sj-pg-btn" ' + (_sjlPage>=pages-1?'disabled':'') + ' onclick="_sjlPage++;renderShijiList()">\u203A</button>';
  h += '</div>';

  el.innerHTML = h;
}

/** 从史记条目提取显著数值变化（供卡片右列显示） */
function _sjlExtractDeltas(sj) {
  var badges = [];
  // 若当时turnChanges被保存为sj._deltas则用；否则从 shizhengji 文字启发
  if (Array.isArray(sj._deltas) && sj._deltas.length) {
    sj._deltas.slice(0, 4).forEach(function(d){ badges.push(d); });
    return badges;
  }
  // 兜底：从文字中抽出主要字眼
  var t = (sj.shizhengji||'') + (sj.shilu||'');
  if (/辽饷|饷银|拨饷/.test(t)) badges.push({dir:'dn', lbl:'辽饷', val:'发'});
  if (/\u80DC\u6377|\u5927\u6377|\u5C0F\u80DC/.test(t)) badges.push({dir:'up', lbl:'\u519B\u5A01', val:'+'});
  if (/\u65F1|\u6D2A|\u96EA\u707E/.test(t)) badges.push({dir:'dn', lbl:'\u707E\u5BB3', val:'\u5347'});
  if (/撤职|贬|降/.test(t)) badges.push({dir:'dn', lbl:'人事', val:'变'});
  if (/升擢|扩权|擢任/.test(t)) badges.push({dir:'up', lbl:'升擢', val:'+'});
  if (/\u515A|\u4E89|\u5F39\u52BE/.test(t)) badges.push({dir:'dn', lbl:'\u671D\u7EB2', val:'\u635F'});
  return badges;
}
function _sjlExport(){
  var txt=(GM.shijiHistory||[]).map(function(sj){
    var out = '[T'+sj.turn+'] '+(sj.time||'');
    if (sj.szjTitle) out += '\n【' + sj.szjTitle + '】';
    if (sj.turnSummary) out += '\n总曰：' + sj.turnSummary;
    if (sj.shilu) out += '\n\n【实录】\n' + sj.shilu;
    if (sj.shizhengji) out += '\n\n【时政记】\n' + sj.shizhengji;
    if (sj.zhengwen) out += '\n\n【政文】\n' + sj.zhengwen;
    if (sj.houren) out += '\n\n【后人戏说】\n' + sj.houren;
    return out;
  }).join('\n\n---\n\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast('已复制');}).catch(function(){_sjlDownload(txt);});}
  else _sjlDownload(txt);
}
function _sjlDownload(txt){
  var a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='shiji_'+(GM.saveName||'export')+'.txt';a.click();toast('已导出');
}
var _qijuPage=0,_qijuKw='',_qijuCat='all',_qijuPageSize=15,_qijuAnnotOnly=false,_qijuSort='recent',_qijuCollapseNarr=false;

/** 统一获取起居注条目的显示文本和类别 */
function _qijuNormalize(r) {
  var text = '', cat = r.category || '';
  // schema1: 回合结算 {edicts, xinglu, memorials, edictsSource?}
  if (r.edicts) {
    var parts = [];
    if (r.edicts.political) parts.push('\u653F\uFF1A' + r.edicts.political);
    if (r.edicts.military) parts.push('\u519B\uFF1A' + r.edicts.military);
    if (r.edicts.diplomatic) parts.push('\u5916\uFF1A' + r.edicts.diplomatic);
    if (r.edicts.economic) parts.push('\u7ECF\uFF1A' + r.edicts.economic);
    if (r.edicts.other) parts.push('\u5176\u4ED6\uFF1A' + r.edicts.other);
    if (parts.length > 0) {
      // 来源标签：已颁行润色稿 / 玩家原文（未润色）
      var _srcTag = '';
      if (r.edictsSource === 'promulgated') _srcTag = '\u3010\u8BCF\u4EE4\u00B7\u9881\u884C\u7A3F\u00B7\u5DF2\u6DA6\u8272\u3011\n';
      else if (r.edictsSource === 'original') _srcTag = '\u3010\u8BCF\u4EE4\u00B7\u73A9\u5BB6\u539F\u6587\u00B7\u672A\u6DA6\u8272\u3011\n';
      text += _srcTag + parts.join('\n');
      cat = cat || '\u8BCF\u4EE4';
    }
    if (r.xinglu) { text += (text ? '\n' : '') + '\u3010\u884C\u6B62\u3011' + r.xinglu; if (!cat) cat = '\u884C\u6B62'; }
  }
  // schema2: AI叙事 {zhengwen}
  if (r.zhengwen) { text = r.zhengwen; cat = cat || '\u53D9\u4E8B'; }
  // schema3: 实时事件 {content}
  if (r.content && !text) {
    text = r.content;
    // 从content前缀推断类别
    if (!cat) {
      if (text.indexOf('\u3010\u9E3F\u96C1') >= 0 || text.indexOf('\u3010\u9A7F\u9012') >= 0) cat = '\u9E3F\u96C1';
      else if (text.indexOf('\u3010\u671D\u8BAE') >= 0 || text.indexOf('\u3010\u5E38\u671D') >= 0) cat = '\u671D\u8BAE';
      else if (text.indexOf('\u3010\u594F\u758F') >= 0 || text.indexOf('\u6279\u590D') >= 0) cat = '\u594F\u758F';
      else if (text.indexOf('\u3010\u5165\u4EAC') >= 0 || text.indexOf('\u4EFB\u547D') >= 0 || text.indexOf('\u7F62\u514D') >= 0) cat = '\u4EBA\u4E8B';
      else cat = '\u5176\u4ED6';
    }
  }
  return { text: text || '(无内容)', cat: cat || '\u5176\u4ED6' };
}

/** 类别→CSS 类 */
function _qijuCatClass(cat) {
  // 7 \u539F\u6709 + NPC bridge / endturn-apply \u65B0\u7C7B\u76EE
  var map = {
    '\u8BCF\u4EE4':'c-edict','\u594F\u758F':'c-memo','\u671D\u8BAE':'c-chaoyi',
    '\u9E3F\u96C1':'c-letter','\u4EBA\u4E8B':'c-person','\u884C\u6B62':'c-xingzhi',
    '\u53D9\u4E8B':'c-narrative',
    '\u8D22\u653F':'c-fiscal','\u519B\u52A1':'c-military','\u5916\u4EA4':'c-diplomacy',
    '\u5730\u653F':'c-province','\u8D22\u8BA1':'c-fiscal','\u95F4\u8C0D':'c-intrigue',
    '\u53DB\u4E71':'c-rebel','\u8D77\u4E49':'c-rebel','\u515A\u6D3E':'c-party','\u52BF\u529B':'c-power',
    '\u9636\u5C42':'c-class'
  };
  return map[cat] || 'c-narrative';
}
/** 类别→统计键 */
function _qijuCatKey(cat) {
  // \u6269\u542B NPC \u52BF\u529B\u63A8\u9001\u7C7B\u76EE
  var map = {
    '\u8BCF\u4EE4':'edict','\u594F\u758F':'memo','\u671D\u8BAE':'chaoyi',
    '\u9E3F\u96C1':'letter','\u4EBA\u4E8B':'person','\u884C\u6B62':'xingzhi',
    '\u53D9\u4E8B':'narrative',
    '\u8D22\u653F':'fiscal','\u519B\u52A1':'military','\u5916\u4EA4':'diplomacy',
    '\u5730\u653F':'province','\u8D22\u8BA1':'fiscal','\u95F4\u8C0D':'intrigue',
    '\u53DB\u4E71':'rebel','\u8D77\u4E49':'rebel','\u515A\u6D3E':'party','\u52BF\u529B':'power',
    '\u9636\u5C42':'class'
  };
  return map[cat] || 'narrative';
}
/** 人名高亮：把角色名包成 .name */
function _qijuHighlight(text) {
  if (!text) return '';
  var out = escHtml(text);
  var names = [];
  (GM.chars||[]).forEach(function(c) { if (c.name && c.name.length >= 2 && c.name.length <= 6) names.push(c.name); });
  (GM.allCharacters||[]).forEach(function(c) { if (c.name && c.name.length >= 2 && c.name.length <= 6 && names.indexOf(c.name) < 0) names.push(c.name); });
  names.sort(function(a,b){return b.length - a.length;});
  names.forEach(function(nm) {
    if (!nm) return;
    var safe = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { out = out.replace(new RegExp(safe, 'g'), '<span class="name">' + escHtml(nm) + '</span>'); } catch(_){}
  });
  return out;
}

function renderQiju(){
  var el=_$("qiju-history");if(!el)return;
  var sbar=_$("qj-statbar"), leg=_$("qj-legend");
  var all=(GM.qijuHistory||[]).slice();
  var kw=(_qijuKw||'').trim().toLowerCase();
  var catFilter = _qijuCat || 'all';

  // 统一化
  var normalized = all.map(function(r) {
    var n = _qijuNormalize(r);
    return { raw: r, text: n.text, cat: n.cat, turn: r.turn||0, date: r.time || r.date || (typeof getTSText==='function'?getTSText(r.turn):'T'+(r.turn||'?')), annotation: r._annotation || '' };
  });

  // 全量统计
  var curTurn = GM.turn || 1;
  var _stat = { all: normalized.length, month: 0, edict: 0, memo: 0, chaoyi: 0, letter: 0, person: 0, xingzhi: 0, narrative: 0, annot: 0 };
  var _catCnt = {};
  normalized.forEach(function(n) {
    if (n.turn >= curTurn - 4) _stat.month++;
    if (n.annotation) _stat.annot++;
    var k = _qijuCatKey(n.cat);
    _stat[k] = (_stat[k]||0) + 1;
    _catCnt[n.cat] = (_catCnt[n.cat]||0) + 1;
  });
  if (sbar) {
    sbar.innerHTML = ''
      + '<div class="qj-stat-card s-all"><div class="qj-stat-lbl">\u603B \u5F55</div><div class="qj-stat-num">'+_stat.all+'</div><div class="qj-stat-sub">\u6761</div></div>'
      + '<div class="qj-stat-card s-month"><div class="qj-stat-lbl">\u8FD1 \u65E5</div><div class="qj-stat-num">'+_stat.month+'</div><div class="qj-stat-sub">\u8FD1\u8BB0</div></div>'
      + '<div class="qj-stat-card s-edict"><div class="qj-stat-lbl">\u8BCF \u4EE4</div><div class="qj-stat-num">'+_stat.edict+'</div><div class="qj-stat-sub">\u9053</div></div>'
      + '<div class="qj-stat-card s-memo"><div class="qj-stat-lbl">\u594F \u758F</div><div class="qj-stat-num">'+_stat.memo+'</div><div class="qj-stat-sub">\u5C01</div></div>'
      + '<div class="qj-stat-card s-chaoyi"><div class="qj-stat-lbl">\u671D \u8BAE</div><div class="qj-stat-num">'+_stat.chaoyi+'</div><div class="qj-stat-sub">\u6B21</div></div>'
      + '<div class="qj-stat-card s-annot"><div class="qj-stat-lbl">\u5FA1 \u6279</div><div class="qj-stat-num">'+_stat.annot+'</div><div class="qj-stat-sub">\u6761</div></div>';
  }

  // 类别 legend（按现有数据）
  if (leg) {
    var _catOrder = ['\u8BCF\u4EE4','\u594F\u758F','\u671D\u8BAE','\u9E3F\u96C1','\u4EBA\u4E8B','\u884C\u6B62','\u53D9\u4E8B'];
    var _lhtml = '<span class="qj-legend-lbl">\u7C7B \u522B</span>';
    _catOrder.forEach(function(c) {
      if (!_catCnt[c]) return;
      _lhtml += '<span class="qj-legend-chip ' + _qijuCatClass(c) + '">' + escHtml(c) + '<span class="num">\u00B7' + _catCnt[c] + '</span></span>';
    });
    leg.innerHTML = _lhtml;
  }

  // 筛选
  var filtered = normalized;
  if (kw) filtered = filtered.filter(function(n) { return n.text.toLowerCase().indexOf(kw) >= 0 || (n.date||'').toLowerCase().indexOf(kw) >= 0; });
  if (catFilter !== 'all') filtered = filtered.filter(function(n) { return n.cat === catFilter; });
  if (_qijuAnnotOnly) filtered = filtered.filter(function(n) { return n.annotation; });

  // 按回合分组
  var _byTurn = {};
  filtered.forEach(function(n) {
    var tk = n.turn || 0;
    if (!_byTurn[tk]) _byTurn[tk] = { date: n.date, items: [], tally: {} };
    _byTurn[tk].items.push(n);
    var k = _qijuCatKey(n.cat);
    _byTurn[tk].tally[k] = (_byTurn[tk].tally[k]||0) + 1;
  });
  var _turns = Object.keys(_byTurn).sort(function(a,b) {
    if (_qijuSort === 'old') return a - b;
    if (_qijuSort === 'annot') {
      var annotA = _byTurn[a].items.some(function(i){return i.annotation;}) ? 1 : 0;
      var annotB = _byTurn[b].items.some(function(i){return i.annotation;}) ? 1 : 0;
      if (annotA !== annotB) return annotB - annotA;
      return b - a;
    }
    return b - a;
  });

  // 分页（按回合组）
  var total = _turns.length;
  var pages = Math.ceil(total / _qijuPageSize) || 1;
  if (_qijuPage >= pages) _qijuPage = pages - 1;
  if (_qijuPage < 0) _qijuPage = 0;
  var pageTurns = _turns.slice(_qijuPage * _qijuPageSize, (_qijuPage + 1) * _qijuPageSize);

  var h = '';
  if (pageTurns.length === 0) {
    h = '<div class="qj-empty">\u672A \u5F55 \u4E4B \u65E5\u3000\u6682 \u65E0 \u8D77 \u5C45</div>';
  } else {
    h += '<div class="qj-timeline">';
    pageTurns.forEach(function(tk, idx) {
      var group = _byTurn[tk];
      var _firstCls = (idx === 0 && _qijuPage === 0) ? ' first' : '';
      h += '<div class="qj-day'+_firstCls+'" data-turn="' + (tk || '?') + '">';
      // 日卷头
      h += '<div class="qj-day-hdr">';
      h += '<div class="qj-day-title">\u7B2C ' + escHtml(String(tk||'?')) + ' \u56DE\u5408</div>';
      if (group.date) h += '<div class="qj-day-date">' + escHtml(group.date) + '</div>';
      // 数件盘
      var _tallyKeys = [['edict','\u8BCF'],['memo','\u758F'],['chaoyi','\u8BAE'],['letter','\u96C1'],['person','\u4E8B'],['xingzhi','\u6B62']];
      var _tallyHtml = '';
      _tallyKeys.forEach(function(tk2) {
        var cnt = group.tally[tk2[0]]||0;
        if (!cnt) return;
        _tallyHtml += '<span class="qj-tally-dot ' + tk2[0] + '">' + tk2[1] + ' ' + cnt + '</span>';
      });
      if (_tallyHtml) h += '<div class="qj-day-tally">' + _tallyHtml + '</div>';
      h += '</div>';
      // 日课条目
      h += '<div class="qj-day-body">';
      group.items.forEach(function(n) {
        var _cls = _qijuCatClass(n.cat);
        var _ridx = (GM.qijuHistory||[]).indexOf(n.raw);
        h += '<div class="qj-rec ' + _cls + '">';
        h += '<div class="qj-rec-hdr">';
        h += '<span class="qj-cat-chip">' + escHtml(n.cat) + '</span>';
        if (n.date) h += '<span class="qj-rec-time">' + escHtml(n.date) + '</span>';
        h += '<div class="qj-rec-actions">';
        h += '<button class="qj-rec-btn annot" onclick="_qijuAnnotate(' + _ridx + ')">\u5FA1 \u6279</button>';
        h += '<button class="qj-rec-btn zoom" onclick="_qijuZoom(' + _ridx + ')">\u5C55 \u9605</button>';
        h += '</div>';
        h += '</div>';
        // 叙事折叠
        var _isNarr = (n.cat === '\u53D9\u4E8B');
        if (_qijuCollapseNarr && _isNarr) {
          var _brief = (n.text||'').length > 60 ? n.text.substring(0, 60) + '\u2026' : n.text;
          h += '<div class="qj-rec-text wd-selectable" style="opacity:0.75;">' + _qijuHighlight(_brief) + '</div>';
        } else {
          h += '<div class="qj-rec-text wd-selectable">' + _qijuHighlight(n.text) + '</div>';
        }
        if (n.annotation) h += '<div class="qj-annot">' + escHtml(n.annotation) + '</div>';
        // 诏令类·附加后续连锁效应（从 _edictTracker 取 _chainEffects）
        if (n.cat === '\u8BCF\u4EE4' && GM._edictTracker && GM._edictTracker.length) {
          var _matchedTrackers = [];
          var _rawText = n.raw && n.raw.content ? n.raw.content : n.text;
          var _rawTurn = n.turn;
          GM._edictTracker.forEach(function(t) {
            if (!t || !t._chainEffects || !t._chainEffects.length) return;
            // 匹配：同回合 & 文本包含或反向包含
            if (t.turn === _rawTurn) {
              var _tc = (t.content||'').slice(0, 30);
              if (_tc && _rawText.indexOf(_tc) >= 0) _matchedTrackers.push(t);
              else if (!_tc && _matchedTrackers.indexOf(t) < 0) _matchedTrackers.push(t);
            }
            // 或 tracker.content 前缀命中 raw text
            else if (_rawText && t.content && _rawText.indexOf(t.content.slice(0, 20)) >= 0) {
              _matchedTrackers.push(t);
            }
          });
          if (_matchedTrackers.length > 0) {
            h += '<div class="qj-chain">';
            h += '<div class="qj-chain-hdr">\u540E\u7EED\u8FDE\u9501\uFF1A</div>';
            _matchedTrackers.forEach(function(t) {
              var _status = t.status ? '\u00B7' + t.status : '';
              var _prog = t.progressPercent ? '\u00B7' + t.progressPercent + '%' : '';
              if (t.assignee) h += '<div class="qj-chain-item">\u6267\u884C\uFF1A' + escHtml(t.assignee) + _status + _prog + '</div>';
              if (t.feedback) h += '<div class="qj-chain-item">\u53CD\u9988\uFF1A' + escHtml(t.feedback.slice(0, 100)) + '</div>';
              (t._chainEffects||[]).slice(-6).forEach(function(ce) {
                var _tn = ce.turn ? ('T' + ce.turn + ' ') : '';
                h += '<div class="qj-chain-item">' + escHtml(_tn + (ce.effect||'')) + '</div>';
              });
            });
            h += '</div>';
          }
        }
        h += '</div>';
      });
      h += '</div>'; // day-body
      h += '</div>'; // day
    });
    h += '</div>'; // timeline
  }
  // 分页
  h += '<div class="qj-paging">';
  h += '<button class="qj-pg-btn" ' + (_qijuPage <= 0 ? 'disabled' : '') + ' onclick="_qijuPage--;renderQiju();">\u2039 \u524D\u00A0\u9875</button>';
  h += '<span class="qj-pg-info"><span class="cur">' + (_qijuPage+1) + '</span> / ' + pages + '\u3000\u5171 ' + filtered.length + ' \u6761 \u00B7 \u672C\u9875 ' + pageTurns.length + ' \u65E5</span>';
  h += '<button class="qj-pg-btn" ' + (_qijuPage >= pages-1 ? 'disabled' : '') + ' onclick="_qijuPage++;renderQiju();">\u540E\u00A0\u9875 \u203A</button>';
  h += '</div>';
  el.innerHTML = h;
  try { if (typeof decoratePendingInDom === 'function') decoratePendingInDom(el); } catch(_){}
}

/** 御批——为起居注条目添加批注 */
function _qijuAnnotate(idx) {
  if (idx < 0 || !GM.qijuHistory || !GM.qijuHistory[idx]) return;
  showPrompt('\u5FA1\u6279\uFF1A', GM.qijuHistory[idx]._annotation || '', function(text) {
    if (text === null) return;
    GM.qijuHistory[idx]._annotation = text;
    renderQiju();
  });
}

/** 展阅——完整展示条目 */
function _qijuZoom(idx) {
  if (idx < 0 || !GM.qijuHistory || !GM.qijuHistory[idx]) return;
  var r = GM.qijuHistory[idx];
  var n = _qijuNormalize(r);
  var dt = r.time || r.date || (typeof getTSText==='function'?getTSText(r.turn):'T'+(r.turn||'?'));
  var _cls = _qijuCatClass(n.cat);
  var html = '<div class="modal-bg show" id="_qijuZoomModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:640px;">';
  html += '<h3 style="color:var(--gold-300);margin:0 0 0.4rem;letter-spacing:0.12em;">\u3010' + escHtml(n.cat) + '\u3011\u7B2C' + (r.turn||'?') + '\u56DE\u5408</h3>';
  html += '<div style="font-size:0.82rem;color:#d4c9b0;font-style:italic;letter-spacing:0.08em;margin-bottom:0.8rem;">' + escHtml(dt) + '</div>';
  html += '<div class="qj-rec ' + _cls + '" style="padding:10px 14px;">';
  html += '<div class="qj-rec-text" style="font-size:14.5px;line-height:2;">' + _qijuHighlight(n.text) + '</div>';
  if (r._annotation) html += '<div class="qj-annot">' + escHtml(r._annotation) + '</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;margin-top:0.8rem;justify-content:flex-end;">';
  html += '<button class="bt bsm" onclick="_qijuAnnotate(' + idx + ');var m=document.getElementById(\'_qijuZoomModal\');if(m)m.remove();">\u5FA1 \u6279</button>';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_qijuZoomModal\');if(m)m.remove();">\u5173 \u95ED</button>';
  html += '</div></div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

function _qijuExport(){
  var txt = (GM.qijuHistory||[]).map(function(r) {
    var n = _qijuNormalize(r);
    var dt = r.time || r.date || ('T' + (r.turn||''));
    var ann = r._annotation ? '\n  御批：' + r._annotation : '';
    return '[T' + (r.turn||'') + '] ' + dt + ' [' + n.cat + ']\n' + n.text + ann;
  }).join('\n\n---\n\n');
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(function(){toast('\u5DF2\u590D\u5236');}).catch(function(){_qijuDownload(txt);}); }
  else _qijuDownload(txt);
}
function _qijuDownload(txt){
  var a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='qiju_'+(GM.saveName||'export')+'.txt';a.click();toast('\u5DF2\u5BFC\u51FA');
}
