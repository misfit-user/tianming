// ============================================================
// tm-office-runtime.js — 官员表游戏内 UI (R132 从 tm-memorials.js L3058-end 拆出)
// 姊妹: tm-memorials.js + tm-wendui.js + tm-office-panel.js + tm-office-editor.js
// 包含: 三朝 tab 配置 (OFFICE_SUBTABS)+v10 官制显示层+渲染部门树+快捷切换
// ============================================================

// ============================================================
//  官员表（游戏内）
// ============================================================
// v10·三朝 tab 配置（通用古制·跨朝代适配）
var OFFICE_SUBTABS = {
  central: [
    { key:'all', name:'\u5168 \u90E8', desc:'\u4E2D\u592E\u8862\u95E8\u00B7\u4E0D\u5206\u7C7B' },
    { key:'shuji', name:'\u67A2 \u673A \u8F85 \u653F', desc:'\u76F8\u8F85\u00B7\u79E6\u6C49\u4E09\u516C/\u5510\u4E09\u7701/\u5B8B\u4E8C\u5E9C/\u660E\u9601/\u6E05\u519B\u673A' },
    { key:'liucao', name:'\u516D \u66F9 \u767E \u53F8', desc:'\u540F\u6237\u793C\u5175\u5211\u5DE5\u00B7\u79E6\u6C49\u4E5D\u537F\u2192\u5510\u5B8B\u516D\u90E8' },
    { key:'taijian', name:'\u53F0 \u8C0F \u98CE \u5BAA', desc:'\u5FA1\u53F2\u53F0/\u90FD\u5BDF\u9662/\u516D\u79D1\u00B7\u98CE\u5BAA\u76D1\u5BDF' },
    { key:'sijian', name:'\u5BFA \u76D1 \u4E5D \u537F', desc:'\u4E5D\u5BFA\u4E94\u76D1\u00B7\u804C\u4E8B\u793C\u4E50\u533B\u535C\u9A6C\u653F' },
    { key:'xunqi', name:'\u52CB \u621A \u52A0 \u8854', desc:'\u4E09\u516C\u865A\u8854/\u5B97\u5BA4/\u9996\u5584\u4E4B\u5E9C' }
  ],
  inner: [
    { key:'all', name:'\u5168 \u90E8', desc:'\u5185\u5EF7\u00B7\u4E0D\u5206\u7C7B' },
    { key:'zhongchao', name:'\u4E2D \u671D \u673A \u8981', desc:'\u8FD1\u4F8D\u6279\u9605\u00B7\u6C49\u4E2D\u671D/\u660E\u53F8\u793C/\u6E05\u519B\u673A\u6C49\u5316\u524D' },
    { key:'tiqi', name:'\u7F07 \u9A91 \u8033 \u76EE', desc:'\u4FA6\u7F09\u7279\u52A1\u00B7\u6C49\u7EE3\u8863/\u660E\u9526\u8863\u536B\u4E1C\u5382' },
    { key:'suwei', name:'\u5BBF \u536B \u7981 \u519B', desc:'\u5BAB\u7981\u7532\u5175\u00B7\u6C49\u5357\u5317\u519B/\u5510\u5317\u8862/\u660E\u5FA1\u9A6C\u56DB\u536B/\u6E05\u4F8D\u536B' },
    { key:'gongyu', name:'\u4F9B \u5FA1 \u5BAB \u52A1', desc:'\u5BAB\u95F1\u4F9B\u5FA1\u00B7\u6C49\u5C11\u5E9C/\u5510\u6BBF\u4E2D/\u660E\u4E8C\u5341\u56DB\u76D1/\u6E05\u5185\u52A1\u5E9C' }
  ],
  region: [
    { key:'all', name:'\u5168 \u90E8', desc:'\u5730\u65B9\u00B7\u4E0D\u5206\u7C7B' },
    { key:'fengjiang', name:'\u5C01 \u7586 \u7763 \u629A', desc:'\u65B9\u9762\u5927\u5458\u00B7\u5510\u8282\u5EA6/\u5B8B\u5B89\u629A/\u660E\u6E05\u7763\u629A\u7ECF\u7565' },
    { key:'fannie', name:'\u85E9 \u81EC \u4E09 \u53F8', desc:'\u7701\u7EA7\u4E09\u53F8\u00B7\u5510\u89C2\u5BDF/\u660E\u6E05\u5E03\u6309\u90FD' },
    { key:'junxian', name:'\u90E1 \u53BF \u7267 \u5B88', desc:'\u5E9C\u5DDE\u53BF\u00B7\u79E6\u90E1\u53BF/\u5510\u5DDE\u53BF/\u660E\u6E05\u5E9C\u5DDE\u53BF' },
    { key:'bianzhen', name:'\u8FB9 \u9547 \u8282 \u5E05', desc:'\u8FB9\u585E\u519B\u5E05\u00B7\u5510\u8282\u5EA6/\u660E\u4E5D\u8FB9\u603B\u5175/\u6E05\u516B\u65D7\u5C06\u519B' }
  ]
};

// v10·部门分类器：按名称将部门归入 court + group
// 正则匹配按先后顺序·首个命中即返回
var _OFFICE_CLASSIFIER_PATTERNS = [
  // 内廷·中朝机要
  [/\u53F8\u793C\u76D1|\u4E1C\u5382|\u4E2D\u66F8|\u4FBF\u6BBF/, { court:'inner', group:'zhongchao' }],
  // 内廷·缇骑耳目
  [/\u9526\u8863|\u897F\u5382|\u7ED3\u9526|\u7EE3\u8863|\u7F07\u9A91/, { court:'inner', group:'tiqi' }],
  // 内廷·宿卫禁军
  [/\u5FA1\u9A6C|\u56DB\u536B|\u4E94\u519B\u90FD\u7763|\u4F8D\u536B|\u5357\u5317\u519B|\u671F\u95E8|\u7FBD\u6797|\u5317\u8862|\u5343\u725B/, { court:'inner', group:'suwei' }],
  // 内廷·供御宫务
  [/\u5185\u5B98\u76D1|\u5C1A\u8863|\u5C1A\u81B3|\u5C1A\u5BB6|\u5C1A\u529E|\u4E0A\u6797\u82D1|\u5185\u627F\u8FD0|\u795E\u5BAB|\u76F4\u6BBF|\u5185\u5EF7|\u6BBF\u4E2D\u7701|\u5C11\u5E9C|\u5185\u52A1/, { court:'inner', group:'gongyu' }],
  // 地方·边镇节帅
  [/\u603B\u5175|\u4E5D\u8FB9|\u8FB9\u9547|\u536B\u6240|\u5C06\u519B/, { court:'region', group:'bianzhen' }],
  // 地方·封疆督抚
  [/\u603B\u7763|\u5DE1\u629A|\u7ECF\u7565|\u6309\u629A|\u7BC0\u5EA6|\u5B89\u629A|\u89C2\u5BDF|\u8F6C\u8FD0/, { court:'region', group:'fengjiang' }],
  // 地方·藩臬三司
  [/\u5E03\u653F|\u6309\u5BDF|\u90FD\u6307\u6325|\u53C2\u653F|\u53C2\u8BAE/, { court:'region', group:'fannie' }],
  // 中央·枢机辅政
  [/\u5185\u9601|\u7FF0\u6797|\u8A79\u4E8B|\u4E2D\u4E66\u7701|\u95E8\u4E0B\u7701|\u5C1A\u4E66\u7701|\u540C\u5E73\u7AE0\u4E8B|\u53C2\u77E5\u653F\u4E8B|\u4E1E\u76F8|\u5927\u5B66\u58EB|\u519B\u673A/, { court:'central', group:'shuji' }],
  // 中央·台谏风宪（先于六部匹配·避免都察院被判为六部）
  [/\u90FD\u5BDF\u9662|\u5FA1\u53F2|\u5927\u7406|\u901A\u653F|\u516D\u79D1|\u7ED9\u4E8B\u4E2D|\u8C0F\u9662|\u8C0F\u8BAE|\u53F8\u9685/, { court:'central', group:'taijian' }],
  // 中央·六曹百司
  [/\u5409\u90E8|\u6237\u90E8|\u793C\u90E8|\u5175\u90E8|\u5211\u90E8|\u5DE5\u90E8|\u540F\u90E8|\u5C1A\u4E66|\u4F8D\u90CE|\u4E5D\u537F(?!\u5BFA)|\u592A\u5E38|\u592A\u4EC6|\u592A\u5C09|\u5EF7\u5C09|\u5927\u9E3F\u81FA|\u5927\u53F8\u519C|\u5927\u884C\u4EBA/, { court:'central', group:'liucao' }],
  // 中央·寺监九卿
  [/\u5149\u7984|\u592A\u4EC6|\u9E3F\u80EA|\u5C1A\u5B9D|\u56FD\u5B50|\u6B3D\u5929|\u592A\u533B|\u5BFA\u5378|\u76D1\u5378|\u5B9D\u6E90|\u79D8\u4E66|\u5DE6\u98DE|\u79D1\u9053/, { court:'central', group:'sijian' }],
  // 中央·勋戚加衔
  [/\u5B97\u4EBA|\u4E09\u516C|\u4E09\u5B64|\u4E09\u5C11|\u592A\u5E08|\u592A\u5085|\u592A\u4FDD|\u5C11\u5E08|\u5C11\u5085|\u5C11\u4FDD|\u987A\u5929\u5E9C|\u5E94\u5929\u5E9C|\u7235|\u4F2F\u7235|\u4FAF|\u7687\u65CF|\u5B97\u5BA4/, { court:'central', group:'xunqi' }]
];

function _officeClassifyDept(dept) {
  if (!dept) return { court:'central', group:'sijian' };
  if (dept._classified) return dept._classified;
  // 剧本显式声明
  if (dept.court && dept.group) {
    dept._classified = { court: dept.court, group: dept.group };
    return dept._classified;
  }
  var name = dept.name || '';
  for (var i = 0; i < _OFFICE_CLASSIFIER_PATTERNS.length; i++) {
    if (_OFFICE_CLASSIFIER_PATTERNS[i][0].test(name)) {
      dept._classified = _OFFICE_CLASSIFIER_PATTERNS[i][1];
      return dept._classified;
    }
  }
  dept._classified = { court:'central', group:'sijian' };
  return dept._classified;
}

function _officeEnsureClassify() {
  if (!GM.officeTree) return;
  GM.officeTree.forEach(function(d){ _officeClassifyDept(d); });
}

// v10·三朝 court 切换
function setOfficeCourtKey(k) {
  if (k !== 'central' && k !== 'inner' && k !== 'region') k = 'central';
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeCourt = k;
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// v10·二级 subtab 切换
function setOfficeSubTab(sub) {
  if (typeof GM === 'undefined' || !GM) return;
  if (!GM._officeSubTab) GM._officeSubTab = { central:'all', inner:'all', region:'all' };
  var ck = GM._officeCourt || 'central';
  GM._officeSubTab[ck] = sub || 'all';
  // 切换分类时·默认折叠当前 court 所有部门·避免上一视图展开态残留
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  _officeEnsureClassify();
  (GM.officeTree||[]).forEach(function(d, idx){
    var cls = _officeClassifyDept(d);
    if (cls.court === ck) {
      var k = JSON.stringify([idx]);
      GM._officeCollapsed[k] = true;
    }
  });
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// v10·初始化默认折叠（首次渲染时调用）
function _officeInitDefaults() {
  if (!GM) return;
  if (!GM._officeCourt) GM._officeCourt = 'central';
  if (!GM._officeSubTab) GM._officeSubTab = { central:'all', inner:'all', region:'all' };
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._officeCollapsedInit) {
    (GM.officeTree||[]).forEach(function(d, idx){
      var k = JSON.stringify([idx]);
      if (!(k in GM._officeCollapsed)) GM._officeCollapsed[k] = true;
    });
    GM._officeCollapsedInit = true;
  }
  _officeEnsureClassify();
}

// 官制树·筛选模式切换（空缺/在任/全部）
function setOfficeFilterMode(mode) {
  if (mode !== 'all' && mode !== 'empty' && mode !== 'filled') mode = 'all';
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeFilterMode = mode;
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// 官制树·视图模式切换（列表/树图）
function setOfficeViewMode(mode) {
  if (mode !== 'list' && mode !== 'tree') mode = 'tree';
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeViewMode = mode;
  GM._officeViewModeExplicit = true; // 玩家显式切换·不再自动迁移
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// 官制·搜索关键词（防抖·300ms）
var _officeSearchTimer = null;
function setOfficeSearchKw(kw) {
  if (typeof GM === 'undefined' || !GM) return;
  GM._officeSearchKw = (kw || '').trim().toLowerCase();
  if (_officeSearchTimer) clearTimeout(_officeSearchTimer);
  _officeSearchTimer = setTimeout(function(){
    if (typeof renderOfficeTree === 'function') renderOfficeTree();
    // 保持搜索框焦点
    setTimeout(function(){ var inp = document.getElementById('office-search-input'); if (inp) { inp.focus(); inp.setSelectionRange(kw.length, kw.length); } }, 20);
  }, 280);
}

// 判断位置是否匹配搜索词
function _officePosMatchKw(p, kw) {
  if (!kw) return true;
  var hay = ((p.name||'') + (p.holder||'') + (p.rank||'')).toLowerCase();
  if (hay.indexOf(kw) >= 0) return true;
  if (p.holder) {
    var _ch = (GM.chars||[]).find(function(c){return c && c.name === p.holder;});
    if (_ch) {
      var hay2 = ((_ch.hometown||'') + (_ch.party||'') + (_ch.faction||'') + (_ch.title||'') + (_ch.courtesyName||'')).toLowerCase();
      if (hay2.indexOf(kw) >= 0) return true;
    }
  }
  return false;
}

// 列表视图·部门展开/收起
function toggleListDept(deptIdx) {
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  var key = JSON.stringify([deptIdx]);
  GM._officeCollapsed[key] = !GM._officeCollapsed[key];
  if (typeof renderOfficeTree === 'function') renderOfficeTree();
}

// 统计部门（含子部门）的编制/实有/空缺
function _officeCountDept(d) {
  var r = { posCount:0, filCount:0, vacCount:0 };
  (function _walk(node){
    (node.positions||[]).forEach(function(p){
      r.posCount++;
      if (p.holder) r.filCount++;
      else r.vacCount++;
    });
    (node.subs||[]).forEach(_walk);
  })(d);
  return r;
}

// 筛选通过判断·列表视图用
function _officePosMatchFilter(p, mode) {
  if (p && p._pendingEdict && p._pendingEdict.turn === (GM && GM.turn)) return true;
  if (mode === 'empty') return !p.holder;
  if (mode === 'filled') return !!p.holder;
  return true;
}

// 预览样式·位置卡渲染（list 视图专用·与 _ogRenderPosCard 独立）
function _ogpRenderPosCard(p, deptName, pathArr) {
  if (!p) return '';
  var _rankLvl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 10;
  var _rankCls = _rankLvl <= 2 ? 'rank-top' : _rankLvl <= 6 ? 'rank-high' : _rankLvl <= 10 ? 'rank-mid' : _rankLvl <= 18 ? 'rank-low' : 'rank-base';
  var _sealCls = _rankLvl <= 6 ? '' : _rankLvl <= 12 ? ' mid-lvl' : ' low-lvl';
  var holder = p.holder ? (GM.chars||[]).find(function(c){return c && c.name === p.holder;}) : null;
  var isVacant = !holder;
  var pathStr = JSON.stringify(pathArr);
  var safeDept = escHtml(deptName||'').replace(/'/g,"\\'");
  var safePos = escHtml(p.name||'').replace(/'/g,"\\'");
  var safeHolder = escHtml(p.holder||'').replace(/'/g,"\\'");
  var mainBtn = isVacant
    ? '<button class="ogp-pos-btn appoint" onclick="event.stopPropagation();_offOpenPicker(' + pathStr + ',\'' + safeDept + '\',\'' + safePos + '\',\'\')">\u4EFB \u547D</button>'
    : '<button class="ogp-pos-btn" onclick="event.stopPropagation();_offOpenPicker(' + pathStr + ',\'' + safeDept + '\',\'' + safePos + '\',\'' + safeHolder + '\')">\u6539 \u6362</button>';

  var html = '<div class="ogp-pos ' + _rankCls + (isVacant?' vacant':'') + '">';
  if (isVacant) html += '<div class="ogp-vacant-dot"></div>';

  // Head
  html += '<div class="ogp-pos-head"><div class="ogp-pos-title-group">';
  html += '<div class="ogp-pos-title">' + escHtml(p.name||'?');
  if (p.rank) html += '<span class="ogp-rank-seal' + _sealCls + '">' + escHtml(p.rank) + '</span>';
  html += '</div>';
  html += '<div class="ogp-pos-dept-sub">' + escHtml(deptName||'') + '</div>';
  html += '</div>' + mainBtn + '</div>';

  if (isVacant) {
    html += '<div class="ogp-pos-holder"></div>';
    html += '<div class="ogp-pos-meta"><span>\u6B64 \u804C \u65E0 \u4EBA \u00B7 \u653F \u52A1 \u505C \u6EDE</span></div>';
  } else {
    var loy = holder.loyalty||50;
    var loyCls = loy>=70?'loyal':loy<40?'danger':'mid';
    var tenureVal = 0;
    if (holder._tenure) { var _tk = (deptName||'') + (p.name||''); tenureVal = holder._tenure[_tk] || 0; }
    var portraitCls = _rankLvl <= 4 ? ' imperial' : '';
    var nameInitial = escHtml(String(holder.name||'?').charAt(0));
    var portrait = holder.portrait ? '<img src="'+escHtml(holder.portrait)+'">' : nameInitial;
    var tenureHtml = tenureVal > 0 ? '<div class="ogp-pos-tenure">' + tenureVal + '</div>' : '';

    html += '<div class="ogp-pos-holder">';
    html += '<div class="ogp-pos-portrait' + portraitCls + '">' + portrait + tenureHtml + '</div>';
    html += '<div class="ogp-pos-holder-info">';
    html += '<div class="ogp-pos-name-line"><span onclick="event.stopPropagation();if(typeof showCharPopup===\'function\')showCharPopup(\'' + escHtml(holder.name).replace(/'/g,"\\'") + '\',event)" style="cursor:pointer;">' + escHtml(holder.name||'?') + '</span>';
    if (holder.age) html += '<span class="age">\u00B7' + holder.age + '\u5C81</span>';
    html += '</div>';
    var subs = [];
    if (holder.hometown) subs.push(escHtml(holder.hometown));
    if (holder.party && holder.party !== '\u65E0\u515A') subs.push(escHtml(holder.party));
    if (subs.length) html += '<div class="ogp-pos-holder-sub">' + subs.join(' \u00B7 ') + '</div>';
    html += '</div>';
    html += '<span class="ogp-loyalty ' + loyCls + '">\u5FE0 ' + loy + '</span>';
    html += '</div>';

    // Stats
    var intelli = holder.intelligence||50, admin = holder.administration||50, mil = holder.military||50;
    function _sc(v){return v>=75?'good':v<40?'bad':'warn';}
    function _sb(v){return v>=75?'bg-good':v<40?'bg-bad':'bg-warn';}
    html += '<div class="ogp-pos-stats">';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u667A</span><span class="val ' + _sc(intelli) + '">' + intelli + '</span><div class="bar"><div class="' + _sb(intelli) + '" style="width:' + intelli + '%"></div></div></div>';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u653F</span><span class="val ' + _sc(admin) + '">' + admin + '</span><div class="bar"><div class="' + _sb(admin) + '" style="width:' + admin + '%"></div></div></div>';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u519B</span><span class="val ' + _sc(mil) + '">' + mil + '</span><div class="bar"><div class="' + _sb(mil) + '" style="width:' + mil + '%"></div></div></div>';
    html += '<div class="ogp-stat-cell"><span class="lbl">\u5FE0</span><span class="val ' + _sc(loy) + '">' + loy + '</span><div class="bar"><div class="' + _sb(loy) + '" style="width:' + loy + '%"></div></div></div>';
    html += '</div>';

    // Meta (tenure)
    if (tenureVal > 0) {
      html += '<div class="ogp-pos-meta"><span class="tenure">\u4EFB <b>' + tenureVal + '</b> \u56DE</span></div>';
    }
  }

  // 待下诏书条
  if (p._pendingEdict && p._pendingEdict.turn === (GM && GM.turn)) {
    var pe = p._pendingEdict;
    var peTxt = pe.prevHolder ? ('\u6539 ' + escHtml(pe.prevHolder) + ' \u2192 ' + escHtml(pe.newHolder)) : ('\u4EFB ' + escHtml(pe.newHolder));
    html += '<div class="og-pending-edict"><span class="og-pe-lbl">\u3014\u5F85\u4E0B\u8BCF\u4E66\u3015</span><span class="og-pe-txt">' + peTxt + '</span><button class="og-pe-undo" onclick="event.stopPropagation();_offUndoAppointment(\'' + escHtml(pe.deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(pe.posName).replace(/'/g,"\\'") + '\')">\u64A4 \u9500</button></div>';
  }

  html += '</div>';
  return html;
}

// 官制列表视图渲染·皇帝舞台 + 部门横列 + 行内展开
function _renderOfficeTreeList(container) {
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._officeFilterMode) GM._officeFilterMode = 'all';
  if (typeof _officeInitDefaults === 'function') _officeInitDefaults();
  var courtKey = GM._officeCourt || 'central';
  var subTab = (GM._officeSubTab && GM._officeSubTab[courtKey]) || 'all';

  var tree = GM.officeTree || [];
  // 识别皇帝节点（若有）与部门列表（按 court+subTab 过滤）
  var emperor = null;
  var depts = [];
  tree.forEach(function(d){
    if (d && (d.isEmperor || d.type === 'emperor' || /^\u7687\u5E1D|^\u5929\u5B50|^\u671D\u5EF7$/.test(d.name||''))) { emperor = d; return; }
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    if (cls.court !== courtKey) return;
    if (subTab !== 'all' && cls.group !== subTab) return;
    depts.push(d);
  });

  // 当前 subTab 计数·供筛选条
  var totalPos = 0, totalFil = 0, totalVac = 0;
  depts.forEach(function(d){
    var r = _officeCountDept(d);
    totalPos += r.posCount; totalFil += r.filCount; totalVac += r.vacCount;
  });

  // court 级计数·供 court tabs 徽标
  var perCourt = { central:{pos:0, vac:0}, inner:{pos:0, vac:0}, region:{pos:0, vac:0} };
  (GM.officeTree||[]).forEach(function(d){
    if (d.isEmperor || d.type === 'emperor' || /^\u7687\u5E1D|^\u5929\u5B50|^\u671D\u5EF7$/.test(d.name||'')) return;
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    (d.positions||[]).forEach(function(p){
      perCourt[cls.court].pos++;
      if (!p.holder) perCourt[cls.court].vac++;
    });
  });

  var _fm = GM._officeFilterMode;
  var _vm = GM._officeViewMode || 'list';
  var _kw = GM._officeSearchKw || '';
  var _fbActive = function(m){ return _fm===m?' active':''; };
  var _vmActive = function(m){ return _vm===m?' active':''; };
  var _sc = GM.running ? findScenarioById(GM.sid) : null;
  var _scnName = _sc ? _sc.name : '';
  var _dtText = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : ('T' + (GM.turn||0));
  var filterBar = '<div class="og-filter-bar">'
    + '<span class="og-fb-title">\u3014 \u5B98 \u5236 \u6811 \u3015</span>'
    + '<button class="og-fb-btn' + _fbActive('all') + '" onclick="setOfficeFilterMode(\'all\')" title="\u663E\u793A\u5168\u90E8">\u5168\u90E8 <span class="og-fb-n">' + totalPos + '</span></button>'
    + '<button class="og-fb-btn empty' + _fbActive('empty') + '" onclick="setOfficeFilterMode(\'empty\')" title="\u53EA\u770B\u7A7A\u7F3A">\u7A7A\u7F3A <span class="og-fb-n">' + totalVac + '</span></button>'
    + '<button class="og-fb-btn filled' + _fbActive('filled') + '" onclick="setOfficeFilterMode(\'filled\')" title="\u53EA\u770B\u5728\u4EFB">\u5728\u4EFB <span class="og-fb-n">' + totalFil + '</span></button>'
    + '<input id="office-search-input" class="og-fb-search" placeholder="\u641C \u59D3\u540D/\u5B98\u804C/\u7C4D\u8D2F/\u6D3E\u7CFB\u2026" value="' + escHtml(_kw) + '" oninput="setOfficeSearchKw(this.value)"/>'
    + '<span style="display:inline-block;width:1px;height:16px;background:var(--color-border-subtle);margin:0 6px;"></span>'
    + '<button class="og-fb-btn' + _vmActive('list') + '" onclick="setOfficeViewMode(\'list\')" title="\u5217\u8868\u89C6\u56FE">\u5217 \u8868</button>'
    + '<button class="og-fb-btn' + _vmActive('tree') + '" onclick="setOfficeViewMode(\'tree\')" title="\u6811\u56FE\u89C6\u56FE">\u6811 \u56FE</button>'
    + (_dtText ? '<span class="og-fb-stats">' + escHtml(_dtText) + (_scnName ? ' \u00B7 ' + escHtml(_scnName) : '') + '</span>' : '')
    + '</div>';

  // 三朝 court tabs
  var _courtTabsHtml = ''
    + '<div class="og-court-tabs">'
    + _buildCourtTab('central', '\u5916 \u671D', '\u4E2D \u592E \u767E \u53F8', perCourt.central, courtKey)
    + _buildCourtTab('inner',   '\u5185 \u671D', '\u5185 \u5EF7 \u5BAB \u7981', perCourt.inner, courtKey)
    + _buildCourtTab('region',  '\u5916 \u671D', '\u5730 \u65B9 \u7763 \u629A', perCourt.region, courtKey)
    + '</div>';

  // 二级 subtab
  var _subCfg = (typeof OFFICE_SUBTABS !== 'undefined' && OFFICE_SUBTABS[courtKey]) ? OFFICE_SUBTABS[courtKey] : [{key:'all', name:'\u5168\u90E8', desc:''}];
  var _subtabsHtml = '<div class="og-subtabs-bar">';
  _subCfg.forEach(function(s){
    var cnt = _countSubtabPos(courtKey, s.key);
    var cls = 'og-subtab' + (s.key === subTab ? ' active' : '');
    _subtabsHtml += '<button class="' + cls + '" onclick="setOfficeSubTab(\'' + s.key + '\')">' + escHtml(s.name) + ' <span class="og-subtab-n">' + cnt.pos + '</span>';
    if (cnt.vac > 0) _subtabsHtml += '<span class="og-subtab-vac-pip" title="\u7A7A\u7F3A ' + cnt.vac + '"></span>';
    _subtabsHtml += '</button>';
  });
  var _curDesc = (_subCfg.find ? _subCfg.find(function(s){return s.key===subTab;}) : null);
  if (_curDesc) _subtabsHtml += '<span class="og-subtab-desc">' + escHtml(_curDesc.desc || '') + '</span>';
  _subtabsHtml += '</div>';

  filterBar = filterBar + _courtTabsHtml + _subtabsHtml;

  // 皇帝舞台（ogp-* 预览样式）
  var playerChar = (GM.chars||[]).find(function(c){ return c && c.isPlayer; });
  var dateText = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : ('T' + (GM.turn||0));
  var emperorTitle = emperor ? emperor.name : (playerChar ? (playerChar.title||playerChar.name||'\u5929\u5B50') : '\u5929\u5B50');
  var emperorHtml = '<div class="ogp-emperor-stage"><div class="ogp-emperor">'
    + '<div class="eb">\u5929 \u547D \u6240 \u5F52</div>'
    + '<div class="nm">' + escHtml(emperorTitle) + '</div>'
    + '<div class="rg">' + escHtml(dateText) + '</div>'
    + '</div></div>';

  // 部门横列 + 展开面板（同一 grid·panel 用 grid-column:1/-1 占满）
  var bodyHtml = '<div class="ogp-dept-row">';
  depts.forEach(function(d, idx){
    var key = JSON.stringify([idx + (emperor?1:0)]);
    var isOpen = GM._officeCollapsed[key] === true;
    var cnt = _officeCountDept(d);
    var seal = (d.name||'?').charAt(0);
    bodyHtml += '<div class="ogp-dept' + (isOpen?' expanded':'') + '" onclick="toggleListDept(' + (idx + (emperor?1:0)) + ')">'
      + '<span class="chev">\u25BE</span>'
      + '<span class="seal">' + escHtml(seal) + '</span>'
      + '<div class="nm">' + escHtml(d.name||'?') + '</div>'
      + '<div class="meta">\u7F16<b>' + cnt.posCount + '</b>\u00B7\u5B9E<b>' + cnt.filCount + '</b>'
      + (cnt.vacCount>0?' <span class="vac-pip"></span>':'')
      + '</div></div>';
  });
  // 面板在同一 grid 外·插到 grid 底部
  bodyHtml += '</div>';
  // 独立展开面板（每个打开的部门一个 panel）
  depts.forEach(function(d, idx){
    var key = JSON.stringify([idx + (emperor?1:0)]);
    var isOpen = GM._officeCollapsed[key] === true;
    if (!isOpen) return;
    var cnt = _officeCountDept(d);
    var positionsHtml = '';
    (function _emit(node, pathArr){
      (node.positions||[]).forEach(function(p, pi){
        if (!_officePosMatchFilter(p, _fm)) return;
        if (!_officePosMatchKw(p, _kw)) return;
        positionsHtml += _ogpRenderPosCard(p, node.name || d.name, pathArr.concat(['positions', pi]));
      });
      (node.subs||[]).forEach(function(sub, si){
        _emit(sub, pathArr.concat(['subs', si]));
      });
    })(d, [idx + (emperor?1:0)]);

    bodyHtml += '<div class="ogp-panel open">'
      + '<div class="title">\u3014<b>' + escHtml(d.name||'?') + '</b>\u3015<small>\u7F16 ' + cnt.posCount + ' \u00B7 \u5B9E ' + cnt.filCount + (cnt.vacCount>0?(' \u00B7 \u7A7A ' + cnt.vacCount):'') + '</small></div>'
      + '<div class="ogp-positions">' + (positionsHtml || '<div style="grid-column:1/-1;text-align:center;color:var(--color-foreground-muted);padding:2rem;">\u65E0\u5339\u914D\u804C\u4F4D</div>') + '</div>'
      + '</div>';
  });

  container.innerHTML = filterBar + '<div class="ogp-wrap">' + emperorHtml + bodyHtml + '</div>';
}

function renderOfficeTree(){
  var el=_$("office-tree");if(!el)return;
  // 容错：如果 GM.officeTree 为空但 P.officeTree 有数据，恢复
  if ((!GM.officeTree || GM.officeTree.length===0) && P.officeTree && P.officeTree.length > 0) {
    try { GM.officeTree = deepClone(P.officeTree); } catch(_e) { GM.officeTree = P.officeTree; }
  }
  if(!GM.officeTree||GM.officeTree.length===0){
    el.innerHTML='<div style="color:var(--txt-d);font-size:0.82rem;padding:1rem;text-align:center;">\u5B98\u5236\u672A\u914D\u7F6E\u3002\u8BF7\u5728\u5267\u672C\u7F16\u8F91\u5668\u7684\u300C\u653F\u5E9C\u300D\u6216\u300C\u5B98\u5236\u300D\u9762\u677F\u4E2D\u914D\u7F6E\uFF0C\u6216\u70B9\u4E0A\u65B9\u300C\uFF0B \u90E8\u95E8\u300D\u6DFB\u52A0</div>';
    return;
  }
  // v10·初始化默认折叠+分类
  if (typeof _officeInitDefaults === 'function') _officeInitDefaults();
  // 视图模式·v10 默认 tree（预览同）·仅当玩家手动切过才保留其选择
  if (!GM._officeViewMode) GM._officeViewMode = 'tree';
  if (!GM._officeViewModeExplicit && GM._officeViewMode === 'list') {
    // 未显式切换过·一次性迁移到 tree
    GM._officeViewMode = 'tree';
  }
  try {
    if (GM._officeViewMode === 'list' && typeof _renderOfficeTreeList === 'function') {
      _renderOfficeTreeList(el);
    } else if (typeof _officeBuildTree === 'function') {
      _renderOfficeTreeSVG(el);
    } else {
      el.innerHTML=GM.officeTree.map(function(d,i){return renderOfficeDeptV2(d,[i]);}).join("");
    }
    if (typeof _renderOfficeSummary === 'function') _renderOfficeSummary();
  } catch(e) {
    console.error('[renderOfficeTree] 渲染失败，降级为列表视图:', e);
    try {
      el.innerHTML=GM.officeTree.map(function(d,i){return renderOfficeDeptV2(d,[i]);}).join("");
      if (typeof _renderOfficeSummary === 'function') _renderOfficeSummary();
    } catch(e2) {
      el.innerHTML = '<div style="color:var(--vermillion-400);padding:1rem;">\u5B98\u5236\u6811\u6E32\u67D3\u5931\u8D25\uFF1A' + escHtml(e.message || String(e)) + '</div>';
    }
  }
}

/** v2 helper：每个节点的可视高度（部门 ~120，职位 ~196·有「待下诏书」条时 +34） */
function _ogCardHeight(fi) {
  if (fi.isPos) {
    var _pe = fi.node && fi.node._pendingEdict;
    var _hasPe = _pe && typeof GM !== 'undefined' && _pe.turn === GM.turn;
    return _hasPe ? 230 : 196;
  }
  if (fi.depth === 0) return 100;
  return 110;
}

/** v2 helper：从 rank 字符串得品级档 CSS class */
function _ogRankClass(rankStr) {
  var lvl = typeof getRankLevel === 'function' ? getRankLevel(rankStr) : 18;
  if (lvl <= 2) return 'og-rank-top';
  if (lvl <= 6) return 'og-rank-high';
  if (lvl <= 10) return 'og-rank-mid';
  if (lvl <= 18) return 'og-rank-low';
  return 'og-rank-base';
}

/** v2 helper：党派→CSS class */
function _ogPartyClass(p) {
  if (!p) return '';
  var s = String(p);
  if (/\u4E1C\u6797/.test(s)) return 'dongin';
  if (/\u6D59/.test(s)) return 'zhe';
  if (/\u9609|\u5BA6|\u5B98\u515A/.test(s)) return 'yan';
  if (/\u6606/.test(s)) return 'kun';
  if (/\u6E05\u6D41|\u5E03\u8863/.test(s)) return 'qing';
  return '';
}

/** v2 helper：渲染部门卡 */
function _ogRenderDeptCard(fi, idx, NW, cardH, pathStr) {
  var nd = fi.node;
  var isEmperor = fi.depth === 0;
  var isRoot1 = fi.depth === 1;
  var depthCls = isEmperor ? 'depth-0' : (isRoot1 ? 'depth-1' : '');

  var psCount = (nd.positions || []).length;
  var subCount = (nd.subs || []).length;
  var vacCount = (nd.positions||[]).filter(function(p){return !p.holder;}).length;
  var filledCount = psCount - vacCount;
  var canCollapse = (psCount + subCount > 0) && !isEmperor;
  var isColl = fi.collapsed;

  // 实权指数
  var _deptPower = 0;
  if (!isEmperor && psCount > 0) {
    (nd.positions||[]).forEach(function(p) {
      if (p.holder) {
        var _pc = findCharByName(p.holder);
        var _rl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 10;
        _deptPower += (_pc ? ((_pc.intelligence||50)+(_pc.administration||50))/2 : 30) + Math.max(0, (18 - _rl)) * 3;
      }
    });
    _deptPower = Math.round(_deptPower / Math.max(1, psCount));
  } else if (isEmperor) {
    _deptPower = Math.round(((GM.vars||{}).imperialAuthority || (GM.vars||{}).huangquan || 60));
  }
  var _pwCls = _deptPower > 70 ? 'hi' : _deptPower > 45 ? 'mid' : 'lo';
  var _pwOff = 94.2 * (1 - Math.min(100, Math.max(0, _deptPower)) / 100);

  var _safeDept = escHtml(nd.name||'').replace(/'/g,"\\'");
  var _deptClickable = canCollapse && !isEmperor;
  var _deptClickClass = _deptClickable ? ' clickable' : '';
  if (_deptClickable && isColl) _deptClickClass += ' collapsed';
  var _deptClickHandler = _deptClickable
    ? ('onclick="if(event.target.closest(\'.og-dept-collapse,.og-dept-btn\'))return;GM._officeCollapsed[JSON.stringify(' + pathStr + ')]=!GM._officeCollapsed[JSON.stringify(' + pathStr + ')];renderOfficeTree();"')
    : '';
  var html = '';
  html += '<div class="og-dept-card ' + depthCls + _deptClickClass + '" style="left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + NW + 'px;height:' + cardH + 'px;" ' + _deptClickHandler + '>';
  // 顶栏：名 + 实权环 + 折叠
  html += '<div class="og-dept-hdr">';
  html += '<span class="nm">' + escHtml(nd.name||'?') + (_deptClickable ? '<span class="og-dept-chevron-indicator">' + (isColl?'\u25B8':'\u25BE') + '</span>' : '') + '</span>';
  if (!isEmperor || _deptPower > 0) {
    html += '<div class="og-power-ring ' + _pwCls + '" title="\u5B9E\u6743\u6307\u6570 ' + _deptPower + '">';
    html += '<svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15" fill="none" stroke-width="3"/>';
    html += '<circle class="fg" cx="18" cy="18" r="15" fill="none" stroke-width="3" stroke-dasharray="94.2" stroke-dashoffset="' + _pwOff.toFixed(1) + '"/></svg>';
    html += '<div class="txt">' + _deptPower + '</div></div>';
  }
  if (canCollapse) {
    html += '<button class="og-dept-collapse" onclick="event.stopPropagation();GM._officeCollapsed[JSON.stringify(' + pathStr + ')]=!GM._officeCollapsed[JSON.stringify(' + pathStr + ')];renderOfficeTree();" title="' + (isColl ? '\u5C55\u5F00' : '\u6298\u53E0') + '">' + (isColl ? '\u25BC' : '\u25B2') + '</button>';
  }
  html += '</div>';

  // 主体
  html += '<div class="og-dept-body">';
  // 职能 chip
  if (nd.functions && nd.functions.length > 0) {
    html += '<div class="og-dept-func-row">';
    nd.functions.slice(0,5).forEach(function(f){ html += '<span class="og-dept-func">' + escHtml(f) + '</span>'; });
    html += '</div>';
  } else if (isEmperor) {
    var _playerChar = (GM.chars||[]).find(function(c){return c.isPlayer;});
    if (_playerChar) {
      html += '<div class="og-dept-func-row">';
      html += '<span class="og-dept-func">' + escHtml(_playerChar.name || '') + '</span>';
      if (_playerChar.age) html += '<span class="og-dept-func">\u5E74 ' + _playerChar.age + '</span>';
      html += '</div>';
    }
  }
  // 编制填充条
  if (!isEmperor && psCount > 0) {
    var fillPct = psCount > 0 ? Math.round(filledCount / psCount * 100) : 0;
    var vacPct = 100 - fillPct;
    html += '<div class="og-dept-fill">';
    html += '<span class="num">\u7F16\u5236</span>';
    html += '<div class="og-dept-fill-bar">';
    html += '<div class="fg" style="width:' + fillPct + '%;"></div>';
    if (vacPct > 0) html += '<div class="vac" style="width:' + vacPct + '%;"></div>';
    html += '</div>';
    html += '<span class="num">' + filledCount + ' / ' + psCount + '</span>';
    if (vacCount === 0) html += '<span class="og-hc-chip full">\u6EE1</span>';
    else if (fillPct >= 70) html += '<span class="og-hc-chip part">\u7F3A ' + vacCount + '</span>';
    else html += '<span class="og-hc-chip vac">\u7F3A ' + vacCount + '</span>';
    html += '</div>';
  }
  // 操作按钮行
  if (!isEmperor) {
    html += '<div class="og-dept-actions">';
    html += '<button class="og-dept-btn" onclick="event.stopPropagation();_offReformToEdict(\'add_pos\',\'' + _safeDept + '\')" title="\u589E\u8BBE\u5B98\u804C">+\u5B98</button>';
    html += '<button class="og-dept-btn" onclick="event.stopPropagation();_offReformToEdict(\'add_sub\',\'' + _safeDept + '\')" title="\u589E\u8BBE\u4E0B\u5C5E\u90E8\u95E8">+\u5C40</button>';
    html += '<button class="og-dept-btn" onclick="event.stopPropagation();_offReformToEdict(\'rename\',\'' + _safeDept + '\')" title="\u6539\u540D">\u6539</button>';
    html += '<button class="og-dept-btn danger" onclick="event.stopPropagation();_offReformToEdict(\'abolish\',\'' + _safeDept + '\')" title="\u88C1\u6492">\u88C1</button>';
    html += '</div>';
  }
  html += '</div>'; // .og-dept-body
  html += '</div>'; // .og-dept-card
  return html;
}

/** v2 helper：渲染职位卡 */
function _ogRenderPosCard(fi, idx, NW, cardH) {
  var nd = fi.node;
  if (typeof _offMigratePosition === 'function') _offMigratePosition(nd);

  var _holder = nd.holder ? findCharByName(nd.holder) : null;
  var _deptName = fi.parent && fi.parent.node ? (fi.parent.node.name||'') : '';
  var _parentFunc = fi.parent && fi.parent.node && fi.parent.node.functions ? (fi.parent.node.functions[0]||'') : '';

  var _rankCls = _ogRankClass(nd.rank);
  var _rankInfo = nd.rank && typeof getRankInfo === 'function' ? getRankInfo(nd.rank) : null;

  var _hc = nd.headCount || 1;
  var _ac = nd.actualCount || 0;
  var _mc = typeof _offMaterializedCount === 'function' ? _offMaterializedCount(nd) : (nd.holder ? 1 : 0);
  var _vacant = (_hc||1) - (_ac||0);
  var _unmat = (_ac||0) - _mc;

  var _tenureKey = _deptName + (nd.name||'');
  var _tenureVal = (_holder && _holder._tenure && _tenureKey) ? (_holder._tenure[_tenureKey]||0) : 0;
  var _satisfaction = nd.holder && typeof calcOfficialSatisfaction === 'function' ? calcOfficialSatisfaction(nd.holder, nd.rank, _deptName) : null;
  var _lastEval = (nd._evaluations && nd._evaluations.length > 0) ? nd._evaluations[nd._evaluations.length-1] : null;
  var _evals = (nd._evaluations||[]).slice(-3);

  // 主按钮
  var _safeDept = escHtml(_deptName).replace(/'/g,"\\'");
  var _safePos = escHtml(nd.name||'').replace(/'/g,"\\'");
  var _safePath = JSON.stringify(fi.path).replace(/"/g,'&quot;');
  var _mainBtn = '';
  if (nd.holder) {
    _mainBtn = '<button class="og-pos-action-btn change" onclick="event.stopPropagation();_offOpenPicker(' + _safePath + ',\'' + _safeDept + '\',\'' + _safePos + '\',\'' + escHtml(nd.holder||'').replace(/'/g,"\\'") + '\')" title="\u6539\u6362\u5728\u4EFB\u8005">\u6539 \u6362</button>';
  } else if (_unmat > 0 && _ac > 0) {
    _mainBtn = '<button class="og-pos-action-btn concretize" onclick="event.stopPropagation();if(typeof _offMaterialize===\'function\')_offMaterialize(\'' + _safeDept + '\',\'' + _safePos + '\')" title="\u5177\u8C61\u5316">\u5177 \u8C61</button>';
  } else {
    _mainBtn = '<button class="og-pos-action-btn appoint" onclick="event.stopPropagation();_offOpenPicker(' + _safePath + ',\'' + _safeDept + '\',\'' + _safePos + '\',\'\')" title="\u4EFB\u547D">\u4EFB \u547D</button>';
  }

  // 在任者行 class
  var _holderCls = 'vacant';
  if (_holder) {
    var _loy = _holder.loyalty||50;
    _holderCls = _loy >= 70 ? 'loyal' : _loy < 35 ? 'danger' : 'mid';
  }

  var _isVacantCard = !_holder;
  // 状态识别：丁忧守制（已存在数据）·其他（告病/权摄/兼任/贬谪/致仕）为未来扩展预留 CSS
  var _stateCls = '';
  var _stateBadge = '';
  if (_holder && _holder._mourning) { _stateCls = ' og-state-mourning'; _stateBadge = '<div class="og-mourn-badge">\u4E01 \u5FE7</div>'; }
  else if (_holder && _holder._sickLeave) { _stateCls = ' og-state-sick'; }
  else if (_holder && _holder._actingPos) { _stateCls = ' og-state-acting'; _stateBadge = '<div class="og-acting-stamp">\u7F72</div>'; }
  else if (_holder && _holder._demoted) { _stateCls = ' og-state-demoted'; _stateBadge = '<div class="og-demoted-tag">\u8D2C \u8C2A</div>'; }
  else if (_holder && _holder._retirePending) { _stateCls = ' og-state-retire'; _stateBadge = '<div class="og-retire-glow"></div>'; }
  var _isConcurrent = _holder && _holder._concurrentWith;
  var _concurrentTag = _isConcurrent ? '<div class="og-concurrent-stack">+\u517C</div>' : '';

  // listMode·列表视图·无需绝对定位
  var _listMode = !!(fi && fi._listMode);
  var _posStyle = _listMode
    ? ''
    : 'style="left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + NW + 'px;height:' + cardH + 'px;"';

  var html = '';
  html += '<div class="og-pos-card ' + _rankCls + (_isVacantCard?' og-vacant-card':'') + _stateCls + (_listMode?' og-pos-card-list':'') + '" ' + _posStyle + '>';
  html += '<div class="og-rank-bar"></div>';
  html += _stateBadge + _concurrentTag;
  if (_isVacantCard) html += '<div class="og-vacant-dot" title="\u6B64\u804C\u7A7A\u7F3A\u5F85\u8865"></div>';

  // 顶栏：官职 + 品级（朱砂印）+ 主按钮
  var _rankLvl = typeof getRankLevel === 'function' ? getRankLevel(nd.rank) : 18;
  var _sealCls = _rankLvl <= 6 ? '' : _rankLvl <= 12 ? ' mid-lvl' : ' low-lvl';
  html += '<div class="og-pos-top">';
  html += '<div class="og-pos-nm-wrap">';
  html += '<div class="og-pos-nm">' + escHtml(nd.name||'?');
  if (nd.rank) html += '<span class="og-rank-seal' + _sealCls + '">' + escHtml(nd.rank) + '</span>';
  html += '</div>';
  var subParts = [];
  if (_deptName) subParts.push(escHtml(_deptName));
  if (_parentFunc) subParts.push('<span class="sep">\u00B7</span><span>' + escHtml(_parentFunc) + '</span>');
  if (subParts.length > 0) html += '<div class="og-pos-sub-line">' + subParts.join('') + '</div>';
  html += '</div>';
  html += _mainBtn;
  html += '</div>';

  // 在任者行
  html += '<div class="og-pos-holder-row ' + _holderCls + '">';
  if (_holder) {
    var _portrait = _holder.portrait ? '<img src="' + escHtml(_holder.portrait) + '">' : escHtml(String(_holder.name||'?').charAt(0));
    var _imperialCls = _rankLvl <= 4 ? ' og-portrait-imperial' : '';
    var _tenureHtml = (_tenureVal > 0) ? '<span class="og-tenure-ring">' + _tenureVal + '</span>' : '';
    html += '<div class="og-pos-portrait' + _imperialCls + '">' + _portrait + _tenureHtml + '</div>';
    html += '<div class="og-pos-holder-info">';
    html += '<div class="og-pos-name-line">';
    html += '<span class="nm" onclick="event.stopPropagation();if(typeof showCharPopup===\'function\')showCharPopup(\'' + escHtml(_holder.name||'').replace(/'/g,"\\'") + '\',event)">' + escHtml(_holder.name||'?') + '</span>';
    // 党派徽章
    var _pty = _holder.party || _holder.faction;
    if (_pty && _pty !== '\u671D\u5EF7') {
      var _ptyCls = _ogPartyClass(_pty);
      html += '<span class="og-party-tag' + (_ptyCls?' '+_ptyCls:'') + '">' + escHtml(String(_pty).slice(0,4)) + '</span>';
    }
    if (_hc > 1) html += '<span class="og-hc-chip' + (_vacant===0?' full':_vacant>0?' part':'') + '">\u7F16' + _hc + '\u00B7\u5B9E' + _ac + '</span>';
    html += '</div>';
    // 年龄/任期/满意度
    var subLine = [];
    if (_holder.age) subLine.push('\u5E74 ' + _holder.age);
    if (_tenureVal > 0) subLine.push('\u4EFB ' + _tenureVal + ' \u56DE\u5408');
    if (_satisfaction && typeof _satisfaction.score === 'number') {
      var _ssClr = _satisfaction.score >= 65 ? 'var(--celadon-400)' : _satisfaction.score >= 45 ? 'var(--amber-400,#c9a045)' : 'var(--vermillion-400)';
      subLine.push('<span style="color:' + _ssClr + ';">\u6EE1\u610F ' + Math.round(_satisfaction.score) + '</span>');
    }
    if (subLine.length > 0) {
      html += '<div class="og-pos-sub-line">' + subLine.map(function(p, i){ return (i>0?'<span class="sep">\u00B7</span>':'') + p; }).join('') + '</div>';
    }
    html += '</div>';
  } else if (_listMode) {
    // 列表模式·空缺·极简只显警告·对齐预览
    html += '<div style="flex:1;text-align:center;padding:14px 0;font-style:italic;letter-spacing:0.3em;color:var(--ink-300,#7a6e54);font-size:13px;">\u3014 \u7A7A \u7F3A \u00B7 \u5F85 \u8865 \u3015</div>';
  } else {
    html += '<div class="og-pos-portrait vacant">?</div>';
    html += '<div class="og-pos-holder-info">';
    html += '<div class="og-pos-name-line"><span style="font-style:italic;">\u7A7A \u7F3A</span>';
    if (_hc > 1) html += '<span class="og-hc-chip vac">\u7F16' + _hc + '\u00B7\u5B9E' + _ac + '</span>';
    html += '</div>';
    html += '<div class="og-pos-sub-line" style="color:var(--vermillion-400);">\u6B64\u804C\u65E0\u4EBA\u00B7\u5F85\u8865</div>';
    html += '</div>';
  }
  html += '</div>';

  // 能力四维（仅在任显示·空缺不显）
  if (_holder) {
    var _loyVal = _holder.loyalty||50;
    var _loyCls = _loyVal >= 70 ? 'hi' : _loyVal < 40 ? 'lo' : 'mid';
    html += '<div class="og-stats-row">';
    html += '<span class="og-stat-box"><span class="lbl">\u667A</span><span class="v">' + (_holder.intelligence||50) + '</span><span class="og-stat-bar-mini" style="--w:' + (_holder.intelligence||50) + '%;"></span></span>';
    html += '<span class="og-stat-box"><span class="lbl">\u653F</span><span class="v">' + (_holder.administration||50) + '</span><span class="og-stat-bar-mini" style="--w:' + (_holder.administration||50) + '%;"></span></span>';
    html += '<span class="og-stat-box"><span class="lbl">\u519B</span><span class="v">' + (_holder.military||50) + '</span><span class="og-stat-bar-mini" style="--w:' + (_holder.military||50) + '%;"></span></span>';
    html += '<span class="og-stat-box loy ' + _loyCls + '"><span class="lbl">\u5FE0</span><span class="v">' + _loyVal + '</span><span class="og-stat-bar-mini" style="--w:' + _loyVal + '%;"></span></span>';
    html += '</div>';
  } else if (!_listMode) {
    html += '<div class="og-empty-msg">\u6B64\u804C\u65E0\u4EBA\u00B7\u653F\u52A1\u505C\u6EDE</div>';
  } else {
    // 列表模式空缺·底部朱红警告
    html += '<div style="padding:10px 14px;text-align:center;color:var(--vermillion-400);font-size:11px;letter-spacing:0.1em;border-top:1px dashed rgba(192,64,48,0.2);">\u6B64 \u804C \u65E0 \u4EBA \u00B7 \u653F \u52A1 \u505C \u6EDE</div>';
  }

  // 权限图标（列表模式空缺时跳过·保持极简）
  if (nd.powers && !(_listMode && !_holder)) {
    var pw = nd.powers;
    html += '<div class="og-powers">';
    html += '<span class="og-powers-lbl">\u6743</span>';
    html += '<span class="og-power-icon appoint' + (pw.appointment?'':' off') + '" title="\u8F9F\u4E3E\u6743">\u8F9F</span>';
    html += '<span class="og-power-icon impeach' + (pw.impeach?'':' off') + '" title="\u5F39\u52BE\u6743">\u5F39</span>';
    html += '<span class="og-power-icon tax' + (pw.taxCollect?'':' off') + '" title="\u7A0E\u6536\u6743">\u7A0E</span>';
    html += '<span class="og-power-icon military' + (pw.militaryCommand?'':' off') + '" title="\u519B\u6743">\u5175</span>';
    html += '<span class="og-power-icon supervise' + (pw.supervise?'':' off') + '" title="\u76D1\u5BDF\u6743">\u76D1</span>';
    html += '</div>';
  }

  // 公库/陋规/任期/考评
  var metaParts = [];
  if (nd.publicTreasuryInit) {
    var pti = nd.publicTreasuryInit;
    if (pti.money) metaParts.push('<span class="og-meta-treasury">\u94F6 ' + Math.round(pti.money/10000) + ' \u4E07</span>');
    if (pti.grain) metaParts.push('<span class="og-meta-grain">\u7C73 ' + Math.round(pti.grain/10000) + ' \u4E07</span>');
  }
  if (nd.privateIncome && nd.privateIncome.illicitRisk === 'high') {
    metaParts.push('<span class="og-meta-illicit hot">\u80A5\u7F3A</span>');
  } else if (nd.privateIncome && nd.privateIncome.illicitRisk === 'low') {
    metaParts.push('<span class="og-meta-illicit cold">\u6E05\u8981</span>');
  }
  if (_tenureVal > 12) {
    metaParts.push('<span class="og-meta-tenure warn">\u4E45\u7559 ' + _tenureVal + ' \u56DE</span>');
  }
  if (_evals.length > 0) {
    var evalHtml = '<span class="og-eval-history"><span class="lbl">\u8003</span>';
    _evals.forEach(function(ev){
      var g = ev.grade||'';
      var dotCls = /\u4E0A|\u4F18|\u7532/.test(g) ? 'up' : /\u4E0B|\u52A3|\u4E01/.test(g) ? 'dn' : 'mid';
      evalHtml += '<span class="og-eval-dot ' + dotCls + '" title="' + escHtml(g) + '">' + escHtml(g.charAt(0)||'·') + '</span>';
    });
    evalHtml += '</span>';
    metaParts.push(evalHtml);
  }
  if (metaParts.length > 0) {
    html += '<div class="og-meta-row">';
    html += metaParts.map(function(p, i){ return (i>0?'<span class="sep">\u00B7</span>':'') + p; }).join('');
    html += '</div>';
  }

  // 状态文本内容（丁忧/告病/权摄/贬谪/致仕/兼任 的底部说明条）
  if (_holder) {
    if (_holder._mourning) {
      var _mp = _holder._mourning;
      var _mt = '依制守孝';
      if (_mp.parent) _mt = '因' + escHtml(_mp.parent) + '殁·' + _mt;
      if (_mp.until) _mt += '·<b>T' + _mp.until + '</b> 期满';
      else if (typeof _mp.turnsLeft === 'number') _mt += '·还需 <b>' + _mp.turnsLeft + '</b> 回合';
      else _mt += '<b> 27</b> 月再起';
      html += '<div class="og-state-note mourn">' + _mt + '</div>';
    } else if (_holder._sickLeave) {
      var _sk = _holder._sickLeave;
      var _skTxt = escHtml(_sk.reason || '\u75C5\u6682\u79BB');
      var _skDays = _sk.days || _sk.duration;
      html += '<div class="og-sick-banner"><span class="icon">\u2695</span><span class="sec-lbl">\u544A \u75C5</span><span>' + _skTxt + '</span>' + (_skDays ? '<span style="margin-left:auto;">\u2192 <b>' + _skDays + ' \u65E5</b></span>' : '') + '</div>';
    } else if (_holder._actingPos) {
      var _ap = _holder._actingPos;
      var _apNote = _ap.note || ('\u4EE5' + (_ap.fromPos||'\u4F9B\u804C') + '\u6444' + (nd.name||'\u5C1A\u4E66') + '\u4E8B\u00B7\u4FDF\u9662\u4E0B\u7B80\u62D4\u6B63\u5B98');
      html += '<div class="og-acting-note">' + escHtml(_apNote) + '</div>';
    } else if (_holder._demoted) {
      var _dm = _holder._demoted;
      var _dmReason = _dm.reason || '\u88AB\u8D2C\u00B7\u56DE\u4EFB\u5E0C\u671B\u6E3A\u8302';
      html += '<div class="og-state-note demoted">' + escHtml(_dmReason) + '</div>';
    } else if (_holder._retirePending) {
      var _rp = _holder._retirePending;
      var _rpTxt = (_holder.age ? _holder.age + '\u5C81' : '\u5E74\u9AD8') + (_rp.count ? '\u00B7' + _rp.count + '\u5EA6\u8BF7\u8F9E' : '\u00B7\u8BF7\u9AB8\u9AA8\u5F52') + '\u00B7\u9661\u4E0B\u672A\u5141';
      html += '<div class="og-state-note retire">' + escHtml(_rpTxt) + '</div>';
    }
    if (_holder._concurrentWith) {
      var _cw = _holder._concurrentWith;
      var _cwName = (typeof _cw === 'string') ? _cw : (_cw.posName || _cw.name || '\u4ED6\u804C');
      html += '<div class="og-concurrent-second"><span class="sec-lbl">\u517C</span><span>' + escHtml(_cwName) + '</span></div>';
    }
  }

  // 历任链
  if (nd._history && nd._history.length > 0) {
    var _hist = nd._history.slice(-3);
    html += '<div class="og-history-rail">';
    html += '<span class="lbl">\u5386\u4EFB</span>';
    _hist.forEach(function(h, hi){
      if (hi > 0) html += '<span class="arr">\u2192</span>';
      html += '<span class="name">' + escHtml(h.holder||'?') + '</span>';
    });
    if (nd.holder) {
      html += '<span class="arr">\u2192</span>';
      html += '<span class="name current">' + escHtml(nd.holder) + '</span>';
    }
    html += '</div>';
  }

  // 待下诏书条（回合内生效·可撤销）
  var _pe = nd._pendingEdict;
  if (_pe && _pe.turn === GM.turn) {
    var _peTxt = _pe.prevHolder
      ? ('改 ' + escHtml(_pe.prevHolder) + ' \u2192 ' + escHtml(_pe.newHolder))
      : ('任 ' + escHtml(_pe.newHolder));
    html += '<div class="og-pending-edict" title="\u672C\u56DE\u5408\u672B\u6B63\u5F0F\u9881\u5E03\u00B7\u671F\u95F4\u53EF\u64A4\u9500">';
    html += '<span class="og-pe-lbl">\u3014\u5F85\u4E0B\u8BCF\u4E66\u3015</span>';
    html += '<span class="og-pe-txt">' + _peTxt + '</span>';
    html += '<button class="og-pe-undo" onclick="event.stopPropagation();_offUndoAppointment(\'' + escHtml(_pe.deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(_pe.posName).replace(/'/g,"\\'") + '\')">\u64A4 \u9500</button>';
    html += '</div>';
  }

  html += '</div>'; // .og-pos-card
  return html;
}

/** SVG树状图渲染（游戏版 v10 — 三朝 tab + 二级分类 + 嵌套群组四层树 + 默认折叠 + 自动居中） */
function _renderOfficeTreeSVG(container) {
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._officeFilterMode) GM._officeFilterMode = 'all';
  if (typeof _officeInitDefaults === 'function') _officeInitDefaults();
  var courtKey = GM._officeCourt || 'central';
  var subTab = (GM._officeSubTab && GM._officeSubTab[courtKey]) || 'all';

  // 直接传入 GM.officeTree，不再做 P↔GM swap hack
  var layout = _officeBuildTreeV10({
    officeTree: GM.officeTree,
    courtKey: courtKey, subTab: subTab, collapsed: GM._officeCollapsed,
    EMP_W: 240, EMP_H: 96, GROUP_H: 60,
    DEPT_W: 240, DEPT_H: 120,
    POS_W: 260, POS_H: 210,
    H_GAP: 22, DEPT_GAP: 18, V_GAP: 46, V_GAP_GROUP: 30
  });

  var flat = layout.flat;
  var cw = Math.max(layout.width + 80, 700);
  var ch = Math.max(layout.height + 80, 400);

  // 空缺/在任统计（基于全 court·非仅当前 subTab）·供 court tabs 徽标显示
  var perCourt = { central:{pos:0, vac:0}, inner:{pos:0, vac:0}, region:{pos:0, vac:0} };
  (GM.officeTree||[]).forEach(function(d){
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    (d.positions||[]).forEach(function(p){
      perCourt[cls.court].pos++;
      if (!p.holder) perCourt[cls.court].vac++;
    });
  });

  // 当前 subTab 的空缺/在任（给 filter-bar 徽标）
  var empCount = 0, filCount = 0;
  for (var _ci = 0; _ci < flat.length; _ci++) {
    var _cfi = flat[_ci];
    if (_cfi.type !== 'pos') continue;
    if (_cfi.node && _cfi.node.holder) filCount++;
    else empCount++;
  }
  var allCount = empCount + filCount;

  var _fm = GM._officeFilterMode;
  var _kw = GM._officeSearchKw || '';
  function _ofMatch(fi) {
    if (fi.type !== 'pos') return true;
    if (fi.node && fi.node._pendingEdict && fi.node._pendingEdict.turn === GM.turn) return true;
    if (_kw && typeof _officePosMatchKw === 'function' && !_officePosMatchKw(fi.node, _kw)) return false;
    if (_fm === 'empty') return !fi.node.holder;
    if (_fm === 'filled') return !!fi.node.holder;
    return true;
  }

  // 包装旧版 _ogCardHeight/_ogRenderDeptCard/_ogRenderPosCard 以接 v10 节点（添加 isPos 字段）
  function _adaptForOld(fi) {
    fi.isPos = (fi.type === 'pos');
    if (fi.type === 'dept') {
      fi.depth = 1; // 旧版期望 depth 字段存在（部门=1）
    }
    return fi;
  }

  // SVG 连线：主干 + Group→Dept elbow + Dept→Pos elbow
  var svgLines = '';
  var themeCol = courtKey === 'inner' ? 'var(--purple-400)' : (courtKey === 'region' ? 'var(--indigo-400)' : 'var(--gold-500)');
  if (layout.groupNodes && layout.groupNodes.length > 0) {
    var empCx = layout.emperorCx;
    var empBottom = layout.root.y + layout.root.h;
    var lastG = layout.groupNodes[layout.groupNodes.length - 1];
    var spineBottom = lastG.y + lastG.h / 2;
    svgLines += '<path d="M ' + empCx + ' ' + empBottom + ' L ' + empCx + ' ' + spineBottom + '" stroke="var(--gold-400)" stroke-width="2.2" fill="none" opacity="0.82"/>';
  }
  for (var i = 0; i < flat.length; i++) {
    var fi = flat[i];
    if (!fi.parent) continue;
    if (!_ofMatch(fi)) continue;
    if (fi.type === 'group') continue; // 主干已覆盖
    var p = fi.parent;
    var px = p.x + p.w / 2;
    var py = p.y + p.h;
    var cx = fi.x + fi.w / 2;
    var cy = fi.y;
    var my = py + (cy - py) * 0.5;
    var clr = (fi.type === 'pos') ? 'var(--celadon-400)' : themeCol;
    var sw = (fi.type === 'pos') ? '1.5' : '1.8';
    var dsh = (fi.type === 'pos') ? ' stroke-dasharray="4,3"' : '';
    svgLines += '<path d="M' + px + ',' + py + ' L' + px + ',' + my + ' L' + cx + ',' + my + ' L' + cx + ',' + cy + '" stroke="' + clr + '" stroke-width="' + sw + '" fill="none" opacity="0.75"' + dsh + '/>';
  }

  // 群组包围框（背景层）
  var themeClassSuffix = courtKey === 'inner' ? ' theme-inner' : (courtKey === 'region' ? ' theme-region' : '');
  var wrapperBgs = '';
  layout.groupNodes.forEach(function(gNode){
    var minX = gNode.x, maxX = gNode.x + gNode.w, minY = gNode.y, maxY = gNode.y + gNode.h;
    function walk(c){
      if (c.x < minX) minX = c.x;
      if (c.x + c.w > maxX) maxX = c.x + c.w;
      if (c.y + c.h > maxY) maxY = c.y + c.h;
      c.children.forEach(walk);
    }
    gNode.children.forEach(walk);
    var padX = 10, padB = 12, padT = 4;
    var bx = minX - padX, by = minY - padT;
    var bw = (maxX - minX) + padX * 2;
    var bh = (maxY - minY) + padT + padB;
    wrapperBgs += '<div class="og-group-wrapper' + themeClassSuffix + '" style="left:' + bx + 'px;top:' + by + 'px;width:' + bw + 'px;height:' + bh + 'px;"></div>';
  });

  // 节点渲染
  var nodesDivs = '';
  for (var i2 = 0; i2 < flat.length; i2++) {
    var fi2 = flat[i2];
    if (!_ofMatch(fi2)) continue;
    if (fi2.type === 'emperor') {
      nodesDivs += _ogRenderEmperorCard(fi2);
    } else if (fi2.type === 'group') {
      nodesDivs += _ogRenderGroupBanner(fi2, themeClassSuffix);
    } else if (fi2.type === 'dept') {
      nodesDivs += _ogRenderDeptCardV10(fi2, courtKey);
    } else if (fi2.type === 'pos') {
      nodesDivs += _ogRenderPosCardV10(fi2, courtKey);
    }
  }

  var wrapperId = 'office-tree-wrap-game';
  var canvasId = 'office-tree-canvas-game';

  var _fbActive = function(m){ return _fm===m?' active':''; };
  var _vm = GM._officeViewMode || 'list';
  var _vmActive = function(m){ return _vm===m?' active':''; };
  var _kw2 = GM._officeSearchKw || '';
  var _sc2 = GM.running ? findScenarioById(GM.sid) : null;
  var _scnName2 = _sc2 ? _sc2.name : '';
  var _dtText2 = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : ('T' + (GM.turn||0));

  // 三朝 court tabs
  var _courtTabs = ''
    + '<div class="og-court-tabs">'
    + _buildCourtTab('central', '\u5916 \u671D', '\u4E2D \u592E \u767E \u53F8', perCourt.central, courtKey)
    + _buildCourtTab('inner',   '\u5185 \u671D', '\u5185 \u5EF7 \u5BAB \u7981', perCourt.inner, courtKey)
    + _buildCourtTab('region',  '\u5916 \u671D', '\u5730 \u65B9 \u7763 \u629A', perCourt.region, courtKey)
    + '</div>';

  // 二级 subtab
  var _subCfg = (typeof OFFICE_SUBTABS !== 'undefined' && OFFICE_SUBTABS[courtKey]) ? OFFICE_SUBTABS[courtKey] : [{key:'all', name:'\u5168\u90E8', desc:''}];
  var _subtabsHtml = '<div class="og-subtabs-bar">';
  _subCfg.forEach(function(s){
    var cnt = _countSubtabPos(courtKey, s.key);
    var cls = 'og-subtab' + (s.key === subTab ? ' active' : '');
    _subtabsHtml += '<button class="' + cls + '" onclick="setOfficeSubTab(\'' + s.key + '\')">' + escHtml(s.name) + ' <span class="og-subtab-n">' + cnt.pos + '</span>';
    if (cnt.vac > 0) _subtabsHtml += '<span class="og-subtab-vac-pip" title="\u7A7A\u7F3A ' + cnt.vac + '"></span>';
    _subtabsHtml += '</button>';
  });
  var _curDesc = (_subCfg.find ? _subCfg.find(function(s){return s.key===subTab;}) : null);
  if (_curDesc) _subtabsHtml += '<span class="og-subtab-desc">' + escHtml(_curDesc.desc || '') + '</span>';
  _subtabsHtml += '</div>';

  var filterBar = '<div class="og-filter-bar">'
    + '<span class="og-fb-title">\u3014 \u5B98 \u5236 \u6811 \u3015</span>'
    + '<button class="og-fb-btn' + _fbActive('all') + '" onclick="setOfficeFilterMode(\'all\')" title="\u663E\u793A\u5168\u90E8\u804C\u4F4D">\u5168\u90E8 <span class="og-fb-n">' + allCount + '</span></button>'
    + '<button class="og-fb-btn empty' + _fbActive('empty') + '" onclick="setOfficeFilterMode(\'empty\')" title="\u53EA\u770B\u7A7A\u7F3A">\u7A7A\u7F3A <span class="og-fb-n">' + empCount + '</span></button>'
    + '<button class="og-fb-btn filled' + _fbActive('filled') + '" onclick="setOfficeFilterMode(\'filled\')" title="\u53EA\u770B\u5728\u4EFB">\u5728\u4EFB <span class="og-fb-n">' + filCount + '</span></button>'
    + '<input id="office-search-input" class="og-fb-search" placeholder="\u641C \u59D3\u540D/\u5B98\u804C/\u7C4D\u8D2F/\u6D3E\u7CFB\u2026" value="' + escHtml(_kw2) + '" oninput="setOfficeSearchKw(this.value)"/>'
    + '<span style="display:inline-block;width:1px;height:16px;background:var(--color-border-subtle);margin:0 6px;"></span>'
    + '<button class="og-fb-btn' + _vmActive('list') + '" onclick="setOfficeViewMode(\'list\')" title="\u5217\u8868\u89C6\u56FE">\u5217 \u8868</button>'
    + '<button class="og-fb-btn' + _vmActive('tree') + '" onclick="setOfficeViewMode(\'tree\')" title="\u6811\u56FE\u89C6\u56FE">\u6811 \u56FE</button>'
    + (_dtText2 ? '<span class="og-fb-stats">' + escHtml(_dtText2) + (_scnName2 ? ' \u00B7 ' + escHtml(_scnName2) : '') + '</span>' : '')
    + '</div>';

  container.innerHTML =
    filterBar
    + _courtTabs
    + _subtabsHtml
    + '<div id="' + wrapperId + '" class="og-tree-frame" style="height:640px;border-top:none;border-radius:0 0 3px 3px;">'
    + '<div class="og-tree-hint">\u25C9 \u9F20 \u8F6E \u7F29 \u653E<span class="sep">\u00B7</span>\u957F \u6309 \u62D6 \u52A8<span class="sep">\u00B7</span>\u70B9 \u51FB \u5C55 \u5F00 \u8BE6 \u60C5</div>'
    + '<div class="og-tree-zoom-ctrl">'
    + '<button onclick="_offZoomIn()" title="\u653E\u5927">+</button>'
    + '<button onclick="_offZoomOut()" title="\u7F29\u5C0F">\u2212</button>'
    + '<button onclick="_offZoomReset()" title="\u590D\u4F4D">\u27F2</button>'
    + '<span class="og-zoom-label" id="og-zoom-label">\u2014</span>'
    + '</div>'
    + '<div id="' + canvasId + '" class="og-tree-canvas" style="width:' + cw + 'px;height:' + ch + 'px;">'
    + '<svg style="position:absolute;top:0;left:0;pointer-events:none;" width="' + cw + '" height="' + ch + '">' + svgLines + '</svg>'
    + wrapperBgs
    + nodesDivs
    + '</div></div>';

  // Zoom + pan + 自动居中
  (function() {
    var wrap = document.getElementById(wrapperId);
    var canvas = document.getElementById(canvasId);
    if (!wrap || !canvas) return;
    var scale, ox, oy;
    function autoFit() {
      var r = wrap.getBoundingClientRect();
      var marginW = 80, marginH = 50;
      var fitScale = Math.min(
        (r.width - marginW) / cw,
        (r.height - marginH) / ch
      );
      fitScale = Math.max(0.28, Math.min(1.1, fitScale));
      scale = fitScale;
      ox = (r.width - cw * fitScale) / 2;
      if (ch * fitScale < r.height - marginH) {
        oy = (r.height - ch * fitScale) / 2;
      } else {
        oy = 30;
      }
    }
    function applyT() {
      canvas.style.transform = 'translate('+ox+'px,'+oy+'px) scale('+scale+')';
      var lbl = document.getElementById('og-zoom-label');
      if (lbl) lbl.textContent = Math.round(scale*100) + '%';
    }
    autoFit(); applyT();

    // 暴露给 onclick 全局按钮使用
    window._offZoomIn = function(){ scale = Math.min(3, scale * 1.15); applyT(); };
    window._offZoomOut = function(){ scale = Math.max(0.15, scale * 0.87); applyT(); };
    window._offZoomReset = function(){ autoFit(); applyT(); };

    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var rect = wrap.getBoundingClientRect();
      var mx = e.clientX - rect.left, my2 = e.clientY - rect.top;
      var delta = e.deltaY > 0 ? 0.85 : 1.18;
      var ns = Math.max(0.18, Math.min(3, scale * delta));
      ox = mx - (mx - ox) * (ns / scale);
      oy = my2 - (my2 - oy) * (ns / scale);
      scale = ns; applyT();
    }, {passive: false});
    var drag = null;
    wrap.addEventListener('mousedown', function(e) {
      var t = e.target;
      if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (t.closest && t.closest('.og-pos-card, .og-dept-card, .og-v10-pos, .og-v10-dept, .og-node-group, .og-pe-undo, .og-v10-pending-undo, .og-tree-zoom-ctrl')) return;
      e.preventDefault();
      drag = {sx: e.clientX - ox, sy: e.clientY - oy};
      wrap.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', function(e) {
      if (!drag) return;
      ox = e.clientX - drag.sx; oy = e.clientY - drag.sy; applyT();
    });
    document.addEventListener('mouseup', function() { drag = null; if (wrap) wrap.style.cursor = 'grab'; });

    // 窗口 resize 防抖重新居中
    if (window._offResizeTimer) clearTimeout(window._offResizeTimer);
    if (window._offResizeHandler) window.removeEventListener('resize', window._offResizeHandler);
    window._offResizeHandler = function() {
      clearTimeout(window._offResizeTimer);
      window._offResizeTimer = setTimeout(function(){
        if (!document.getElementById(canvasId)) return;
        autoFit(); applyT();
      }, 180);
    };
    window.addEventListener('resize', window._offResizeHandler);
  })();

  // 全局键盘 / 聚焦搜索（仅在官制 tab 激活时）
  if (!window._offKeybindInstalled) {
    window._offKeybindInstalled = true;
    document.addEventListener('keydown', function(e){
      if (e.key !== '/') return;
      // 仅在官制面板可见时拦截·避免干扰其他输入
      var el = document.getElementById('office-tree');
      if (!el || !el.offsetParent) return;
      // 已聚焦输入框时不拦截
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      var inp = document.getElementById('office-search-input');
      if (inp) { e.preventDefault(); inp.focus(); inp.select(); }
    });
  }
}

/** v10·部门卡（复刻 preview-guanzhi-v10.html·三行简洁布局） */
function _ogRenderDeptCardV10(fi, courtKey) {
  var nd = fi.node;
  var psCount = (nd.positions||[]).length;
  var vac = (nd.positions||[]).filter(function(p){ return !p.holder; }).length;
  var actual = psCount - vac;
  var seal = (nd.seal || (nd.name||'\u00B7').replace(/\s/g,'').slice(0,1));
  var themeCls = courtKey === 'inner' ? ' theme-inner' : (courtKey === 'region' ? ' theme-region' : '');
  var pathJSON = JSON.stringify(fi.path);
  var collapsed = !!fi.collapsed;
  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;';
  var toggleCall = 'GM._officeCollapsed[JSON.stringify(' + pathJSON + ')]=!GM._officeCollapsed[JSON.stringify(' + pathJSON + ')];renderOfficeTree();';

  var html = '<div class="og-v10-dept' + themeCls + '" style="' + style + '" ';
  html += 'onclick="if(event.target.closest(\'.og-v10-dept-collapse\'))return;' + toggleCall + '">';
  html += '<button class="og-v10-dept-collapse" onclick="event.stopPropagation();' + toggleCall + '" title="' + (collapsed?'\u5C55\u5F00':'\u6298\u53E0') + '">' + (collapsed?'\u25BC':'\u25B2') + '</button>';
  html += '<span class="og-v10-dept-seal">' + escHtml(seal) + '</span>';
  html += '<div class="og-v10-dept-name">' + escHtml(nd.name||'?') + '</div>';
  var desc = nd.description || nd.desc || '';
  if (desc) html += '<div class="og-v10-dept-desc">' + escHtml(desc) + '</div>';
  html += '<div class="og-v10-dept-meta">\u7F16<b>' + psCount + '</b>\u00B7\u5B9E<b>' + actual + '</b>';
  if (vac > 0) html += '\u00B7\u7F3A<b>' + vac + '</b> <span class="og-v10-dept-vac-pip"></span>';
  html += '</div>';
  html += '</div>';
  return html;
}

/** v10·职位卡（复刻 preview-guanzhi-v10.html·完整 12 态） */
function _ogRenderPosCardV10(fi, courtKey) {
  var nd = fi.node;
  if (typeof _offMigratePosition === 'function') _offMigratePosition(nd);
  var _holder = nd.holder ? findCharByName(nd.holder) : null;
  var _deptName = (fi.parent && fi.parent.node) ? (fi.parent.node.name||'') : '';
  var _rankLvl = typeof getRankLevel === 'function' ? getRankLevel(nd.rank) : 18;
  var _rankCls = _rankLvl <= 2 ? 'rank-top' : _rankLvl <= 6 ? 'rank-high' : _rankLvl <= 12 ? 'rank-mid' : 'rank-low';
  var _sealCls = _rankLvl <= 6 ? '' : (_rankLvl <= 12 ? 'mid-lvl' : 'low-lvl');

  // 态识别（参考旧版 _ogRenderPosCard 数据源）
  var _isVacant = !_holder;
  var _state = '';
  if (_isVacant) _state = 'vacant';
  else if (_holder._mourning) _state = 'mourning';
  else if (_holder._sickLeave) _state = 'sick';
  else if (_holder._actingPos) _state = 'acting';
  else if (_holder._demoted) _state = 'demoted';
  else if (_holder._retirePending) _state = 'retire';
  var _hasPending = nd._pendingEdict && nd._pendingEdict.turn === GM.turn;
  var _concurrentWith = _holder && _holder._concurrentWith;
  // 赴任态·识别新模型 _travelTo 与旧模型 _enRouteToOffice
  var _transitTo = _holder && (_holder._travelTo || _holder._enRouteToOffice);
  var _transitDays = _holder && (_holder._travelRemainingDays || _holder._enRouteDaysLeft || _holder._enRouteDays);
  var _transitFrom = _holder && (_holder._travelFrom || _holder._enRouteFrom || _holder.location);

  // 党派
  var _partyCls = '';
  if (_holder && _holder.party) {
    var p = String(_holder.party);
    if (/\u4E1C\u6797/.test(p)) _partyCls = 'dongin';
    else if (/\u6D59/.test(p)) _partyCls = 'zhe';
    else if (/\u9609|\u5BA6/.test(p)) _partyCls = 'yan';
    else if (/\u6E05\u6D41|\u5E03\u8863/.test(p)) _partyCls = 'qing';
    else if (/\u6606/.test(p)) _partyCls = 'kun';
  }
  var _partyLbl = { dongin:'\u4E1C', zhe:'\u6D59', yan:'\u9609', qing:'\u6E05', kun:'\u6606' }[_partyCls] || '';

  var cls = 'og-v10-pos ' + _rankCls;
  if (_state) cls += ' state-' + _state;
  if (_concurrentWith) cls += ' state-concurrent';
  if (_hasPending) cls += ' has-pending'; // 拟任态·边框+光晕

  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;';
  var _safePath = JSON.stringify(fi.path).replace(/"/g,'&quot;');
  var _safeDept = escHtml(_deptName).replace(/'/g,"\\'");
  var _safePos = escHtml(nd.name||'').replace(/'/g,"\\'");
  var _safeHolder = escHtml(nd.holder||'').replace(/'/g,"\\'");

  var html = '<div class="' + cls + '" style="' + style + '">';
  if (_partyCls) {
    html += '<div class="og-v10-party-ribbon ' + _partyCls + '"></div>';
    html += '<span class="og-v10-party-ribbon-label">' + _partyLbl + '</span>';
  }
  if (_state === 'vacant') html += '<span class="og-v10-vacant-dot"></span>';
  if (_state === 'mourning') html += '<span class="og-v10-mourn-badge">\u4E01 \u5FE7</span>';
  if (_concurrentWith) html += '<span class="og-v10-concurrent-stack">+\u517C</span>';
  if (_state === 'acting') html += '<span class="og-v10-acting-stamp">\u7F72</span>';
  if (_state === 'demoted') html += '<span class="og-v10-demoted-tag">\u8D2C \u8C2A</span>';
  // 拟任印章·右上角大字醒目
  if (_hasPending) html += '<span class="og-v10-draft-stamp">\u62DF</span>';

  // 头部
  html += '<div class="og-v10-pos-header">';
  html += '<div class="og-v10-pos-title-group">';
  html += '<div class="og-v10-pos-title">' + escHtml(nd.name||'?') + ' <span class="og-v10-rank-seal ' + _sealCls + '">' + escHtml(nd.rank||'') + '</span></div>';
  html += '<div class="og-v10-pos-sub">' + escHtml(_deptName) + (nd.duties ? ' \u00B7 ' + escHtml(String(nd.duties).slice(0, 24)) : '') + '</div>';
  html += '</div>';
  var btnLabel = '\u6539 \u6362', btnCls = '';
  if (_isVacant) { btnLabel = '\u4EFB \u547D'; btnCls = ' appoint'; }
  else if (_state === 'acting') btnLabel = '\u6B63 \u6388';
  else if (_state === 'mourning') { btnLabel = '\u6743 \u7F72'; btnCls = ' appoint'; }
  html += '<button class="og-v10-pos-btn' + btnCls + '" onclick="event.stopPropagation();_offOpenPicker(' + _safePath + ',\'' + _safeDept + '\',\'' + _safePos + '\',\'' + _safeHolder + '\')">' + btnLabel + '</button>';
  // 弹劾按钮：仅针对 NPC 派系 + 非玩家角色（异己党派或异势力高官）
  if (!_isVacant && _holder) {
    var _playerFacN = '';
    var _playerFac = (GM.facs||[]).find(function(f){ return f.isPlayer; });
    if (_playerFac) _playerFacN = _playerFac.name;
    if (!_playerFacN) _playerFacN = (P.playerInfo && P.playerInfo.factionName) || '';
    var _isForeign = _playerFacN && _holder.faction && _holder.faction !== _playerFacN;
    var _isHostile = _holder.loyalty != null && _holder.loyalty < 40;
    if (_isForeign || _isHostile) {
      html += '<button class="og-v10-pos-btn impeach" style="background:rgba(192,64,48,0.14);border-color:rgba(192,64,48,0.5);color:var(--vermillion-300,#d97b6b);margin-left:4px;" onclick="event.stopPropagation();_offImpeach(\'' + _safeHolder + '\',\'' + _safeDept + '\',\'' + _safePos + '\')" title="\u5F39\u52BE">\u5F39 \u52BE</button>';
    }
  }
  html += '</div>';

  if (_isVacant) {
    html += '<div class="og-v10-pos-holder"></div>';
    html += '<div class="og-v10-pos-meta" style="color:var(--vermillion-300,#d97b6b);justify-content:center;padding:10px 12px;"><span>\u6B64 \u804C \u65E0 \u4EBA</span></div>';
  } else {
    // 在任者行
    var initial = (nd.holder||'?').slice(0,1);
    var portraitCls = 'og-v10-pos-portrait' + ((_rankCls==='rank-top'||_rankCls==='rank-high')?' rank-top-border':'');
    var _tenureKey = _deptName + (nd.name||'');
    var _tenureVal = (_holder && _holder._tenure && _tenureKey) ? (_holder._tenure[_tenureKey]||0) : 0;
    html += '<div class="og-v10-pos-holder">';
    html += '<div class="' + portraitCls + '">' + escHtml(initial);
    if (_tenureVal > 0) html += '<span class="og-v10-tenure-ring">' + _tenureVal + '</span>';
    html += '</div>';
    html += '<div class="og-v10-pos-holder-info">';
    html += '<div class="og-v10-pos-holder-name' + (_hasPending ? ' draft-name' : '') + '">'
      + (_hasPending ? '<span class="og-v10-draft-prefix">\u62DF \u00B7 </span>' : '')
      + escHtml(nd.holder);
    if (_holder.courtesyName) html += '<span class="courtesy">' + escHtml(_holder.courtesyName) + '</span>';
    if (_holder.age) html += '<span class="age">\u00B7' + _holder.age + '\u5C81</span>';
    html += '</div>';
    var sub = '';
    if (_transitTo && _transitDays > 0) {
      sub = '<span style="color:var(--vermillion-300,#d97b6b);">' + escHtml(_transitFrom||'') + ' \u2192 ' + escHtml(_transitTo) + ' \u00B7 <b>' + _transitDays + '</b> \u65E5</span>';
    } else if (_holder.hometown) {
      sub = escHtml(_holder.hometown);
    }
    if (sub) html += '<div class="og-v10-pos-holder-sub">' + sub + '</div>';
    html += '</div>';
    var _loy = _holder.loyalty != null ? _holder.loyalty : 50;
    var _loyCls = _loy >= 75 ? 'loyal' : (_loy >= 55 ? 'mid' : 'danger');
    html += '<span class="og-v10-loyalty-mark ' + _loyCls + '">\u5FE0 ' + _loy + '</span>';
    html += '</div>';

    // 四维
    var _intel = _holder.intelligence != null ? _holder.intelligence : 50;
    var _admin = _holder.administration != null ? _holder.administration : 50;
    var _mil = _holder.military != null ? _holder.military : 50;
    html += '<div class="og-v10-pos-stats">';
    [['\u667A',_intel],['\u653F',_admin],['\u519B',_mil],['\u5FE0',_loy]].forEach(function(pair){
      var v = pair[1]||0;
      var sc = v>=80?'good':(v>=60?'warn':(v>=40?'':'bad'));
      var bc = v>=80?'bg-good':(v>=60?'bg-warn':(v>=40?'':'bg-bad'));
      html += '<div class="og-v10-stat-cell"><span class="og-v10-stat-lbl">' + pair[0] + '</span><span class="og-v10-stat-val ' + sc + '">' + v + '</span><div class="og-v10-stat-bar"><div class="' + bc + '" style="width:' + v + '%"></div></div></div>';
    });
    html += '</div>';

    // 任期+考评
    html += '<div class="og-v10-pos-meta">';
    if (_tenureVal > 0) html += '<span class="og-v10-tenure">\u4EFB <b>' + _tenureVal + '</b> \u56DE' + (_tenureVal>15?'\u00B7\u4E45\u7559':(_tenureVal<2?'\u00B7\u65B0\u4EFB':'')) + '</span>';
    else html += '<span></span>';
    var evals = (nd._evaluations||[]).slice(-3);
    if (evals.length) {
      html += '<span class="og-v10-evals">';
      evals.forEach(function(e){
        var lvl = typeof e === 'object' ? (e.grade||e.level||'mid') : String(e);
        var dc = /\u4F18|up|good|A/.test(lvl) ? 'up' : /\u52A3|down|bad|D|F/.test(lvl) ? 'dn' : 'mid';
        var lbl = dc==='up'?'\u4F18':(dc==='dn'?'\u52A3':'\u4E2D');
        html += '<span class="og-v10-eval-dot ' + dc + '">' + lbl + '</span>';
      });
      html += '</span>';
    }
    html += '</div>';

    // 态特定底条
    if (_concurrentWith) {
      html += '<div class="og-v10-concurrent-second"><span class="lbl">\u517C</span><span>' + escHtml(_concurrentWith) + '</span></div>';
    }
    if (_transitTo && _transitDays > 0) {
      html += '<div class="og-v10-transit-note"><span>\u8D74\u4EFB\u5728\u9014</span><span style="margin-left:auto;">\u8FD8\u9700 <b>' + _transitDays + '</b> \u65E5</span></div>';
    }
    if (_state === 'mourning' && _holder._mourning) {
      var mn = _holder._mourning.monthsLeft || _holder._mourning.left || 27;
      html += '<div style="padding:6px 12px;font-size:9px;color:rgba(217,208,187,0.7);letter-spacing:0.1em;text-align:center;font-style:italic;border-top:1px dashed rgba(217,208,187,0.2);">\u4F9D\u5236\u5B88\u5B5D\u00B7<b style="color:#d9d0bb;">' + mn + '</b>\u6708\u518D\u8D77</div>';
    }
    if (_state === 'sick' && _holder._sickLeave) {
      var days = _holder._sickLeave.daysLeft || _holder._sickLeave.days || _holder._sickLeave || 0;
      html += '<div class="og-v10-sick-banner"><span>\u2695</span><span class="lbl">\u544A \u75C5</span><span style="margin-left:auto;">\u672A\u671D <b>' + days + '</b> \u65E5</span></div>';
    }
    if (_state === 'acting' && _holder._actingPos) {
      html += '<div class="og-v10-acting-note">' + escHtml('\u4EE5 ' + (_holder._actingPos||'\u4F8D\u90CE') + ' \u6444\u4E8B\u00B7\u4EF0\u7B80\u62D4\u6B63\u5B98') + '</div>';
    }
    if (_state === 'retire' && _holder._retirePending) {
      var refusals = _holder._retirePending.refusals || 1;
      html += '<div class="og-v10-retire-note"><span>' + (_holder.age||70) + ' \u5C81\u00B7' + refusals + ' \u5EA6\u8BF7\u8F9E\u00B7\u965B\u4E0B\u672A\u5141</span></div>';
    }

    // 待下诏书
    if (_hasPending) {
      var _pe = nd._pendingEdict;
      var _peTxt = _pe.prevHolder ? ('\u6539 ' + escHtml(_pe.prevHolder) + ' \u2192 ' + escHtml(_pe.newHolder)) : ('\u4EFB ' + escHtml(_pe.newHolder));
      html += '<div class="og-v10-pending-strip">';
      html += '<span class="og-v10-pending-lbl">\u3014\u5F85\u4E0B\u8BCF\u4E66\u3015</span>';
      html += '<span class="og-v10-pending-txt">' + _peTxt + '</span>';
      html += '<button class="og-v10-pending-undo" onclick="event.stopPropagation();_offUndoAppointment(\'' + _safeDept + '\',\'' + _safePos + '\')">\u64A4 \u9500</button>';
      html += '</div>';
    }
  }

  html += '</div>';
  return html;
}

/** v10·皇帝卡片（简化·不与现有 dept/pos 卡重叠） */
function _ogRenderEmperorCard(fi) {
  var emp = (GM.chars||[]).find(function(c){ return c && c.isPlayer; }) || { name:'\u7687\u4E0A', age:null, title:'' };
  var reign = (typeof getTSText === 'function') ? getTSText(GM.turn||0) : '';
  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;position:absolute;background:linear-gradient(135deg,rgba(201,168,95,0.18),rgba(140,80,20,0.1)),var(--color-surface-elevated,#2a241c);border:1.5px solid var(--gold-400);border-radius:3px;box-shadow:0 0 0 1px rgba(184,154,83,0.15),0 6px 30px rgba(0,0,0,0.6);padding:12px 16px;text-align:center;z-index:2;';
  var html = '<div class="og-emperor-card" style="' + style + '">';
  html += '<div style="position:absolute;inset:4px;border:1px dashed rgba(201,168,95,0.3);pointer-events:none;border-radius:2px;"></div>';
  html += '<div style="font-size:10px;letter-spacing:0.35em;color:var(--gold-400);margin-bottom:4px;">\u5929 \u547D \u6240 \u5F52</div>';
  html += '<div style="font-size:20px;font-weight:700;color:var(--gold-100,#f4e8c5);letter-spacing:0.3em;text-shadow:0 0 10px rgba(201,168,95,0.3);">' + escHtml(emp.name||'\u5E1D') + '</div>';
  if (reign) html += '<div style="font-size:10px;color:var(--txt-d);margin-top:3px;letter-spacing:0.2em;">' + escHtml(reign) + '</div>';
  html += '</div>';
  return html;
}

/** v10·群组横幅 */
function _ogRenderGroupBanner(fi, themeSuffix) {
  var g = fi.groupCfg;
  var pos = 0, vac = 0, deptCnt = fi.children.length;
  fi.children.forEach(function(d){
    (d.node.positions || []).forEach(function(p){
      pos++;
      if (!p.holder) vac++;
    });
  });
  var style = 'left:' + fi.x + 'px;top:' + fi.y + 'px;width:' + fi.w + 'px;height:' + fi.h + 'px;';
  var html = '<div class="og-node-group' + (themeSuffix||'') + '" style="' + style + '">';
  html += '<span class="og-group-corner tl"></span><span class="og-group-corner tr"></span><span class="og-group-corner bl"></span><span class="og-group-corner br"></span>';
  html += '<div class="og-group-left">';
  html += '<div class="og-group-name">' + escHtml(g.name) + '</div>';
  html += '<div class="og-group-desc">' + escHtml(g.desc || '') + '</div>';
  html += '</div>';
  html += '<div class="og-group-stats">';
  html += '<span>\u8862 <span class="dept-count"><b>' + deptCnt + '</b></span></span>';
  html += '<span>\u7F16 <b>' + pos + '</b></span>';
  if (vac > 0) html += '<span class="vac">\u7F3A <b>' + vac + '</b></span>';
  html += '</div>';
  html += '</div>';
  return html;
}

/** v10·构造 court tab 按钮 */
function _buildCourtTab(key, eyebrow, title, cnt, currentCourt) {
  var cls = 'og-court-tab' + (key === currentCourt ? ' active' : '');
  return '<button class="' + cls + '" onclick="setOfficeCourtKey(\'' + key + '\')">'
    + '<span class="og-tab-eyebrow">' + eyebrow + '</span>'
    + '<span class="og-tab-title">' + title + '</span>'
    + '<span class="og-tab-stats">'
    + '<span><b>' + cnt.pos + '</b> \u804C</span>'
    + '<span><span class="og-vac-pip"></span><b>' + cnt.vac + '</b> \u7F3A</span>'
    + '</span>'
    + '</button>';
}

/** v10·统计某 subtab 的 pos/vac */
function _countSubtabPos(courtKey, subKey) {
  var r = { pos:0, vac:0 };
  if (!GM.officeTree) return r;
  GM.officeTree.forEach(function(d){
    var cls = (typeof _officeClassifyDept === 'function') ? _officeClassifyDept(d) : { court:'central', group:'sijian' };
    if (cls.court !== courtKey) return;
    if (subKey !== 'all' && cls.group !== subKey) return;
    (d.positions||[]).forEach(function(p){
      r.pos++;
      if (!p.holder) r.vac++;
    });
  });
  return r;
}

/** 部门效能摘要·v2 三栏 + 预警条 */
function _renderOfficeSummary() {
  var el = _$('office-summary'); if (!el) return;
  var treeStats = typeof _offTreeStats === 'function' ? _offTreeStats(GM.officeTree) : { headCount:0, actualCount:0, materialized:0, depts:0 };
  var totalDepts = treeStats.depts;
  var totalPos = treeStats.headCount;
  var actualCount = treeStats.actualCount;
  var materialized = treeStats.materialized;
  var vacantPos = totalPos - actualCount;
  var unmaterialized = actualCount - materialized;

  // 俸禄
  var theoryCost = 0, actualCost = 0;
  if (P.officeConfig && P.officeConfig.costVariables) {
    P.officeConfig.costVariables.forEach(function(cv) {
      theoryCost += (totalDepts * (cv.perDept||0)) + (totalPos * (cv.perOfficial||0));
      actualCost += (totalDepts * (cv.perDept||0)) + (actualCount * (cv.perOfficial||0));
    });
  }

  // 派系控制
  var factionMap = {};
  (function _fcs(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        if (p.holder) {
          var _fc = findCharByName(p.holder);
          var _k = _fc && (_fc.party || _fc.faction);
          if (_k && _k !== '\u671D\u5EF7') {
            if (!factionMap[_k]) factionMap[_k] = 0;
            factionMap[_k]++;
          }
        }
      });
      if (n.subs) _fcs(n.subs);
    });
  })(GM.officeTree||[]);
  var facEntries = Object.keys(factionMap).sort(function(a,b){ return factionMap[b] - factionMap[a]; });
  var _facColors = {};
  (GM.facs||[]).forEach(function(f) { if (f.color) _facColors[f.name] = f.color; });
  (GM.parties||[]).forEach(function(f) { if (f.color) _facColors[f.name] = f.color; });
  var _defaultFac = ['#6a9a7f','#5a6fa8','#c9a045','#8e6aa8','#b89a53','#d15c47','#5a8fb8'];
  var _totalFilled = facEntries.reduce(function(s,k){return s+factionMap[k];},0);

  // ───── 三栏摘要 ─────
  var html = '';

  // 卡1：编制·实有·具象·缺员
  html += '<div class="og-summary-card c-count">';
  html += '<div class="og-sc-label">\u7F16\u5236\u00B7\u5B9E\u6709\u00B7\u5177\u8C61</div>';
  html += '<div class="og-cnt-row">';
  html += '<div class="og-cnt-box"><div class="og-cnt-num good">' + totalDepts + '</div><div class="og-cnt-lbl">\u90E8\u95E8</div></div>';
  html += '<div class="og-cnt-box"><div class="og-cnt-num mid">' + totalPos + '</div><div class="og-cnt-lbl">\u7F16\u5236</div></div>';
  html += '<div class="og-cnt-box"><div class="og-cnt-num ' + (vacantPos===0?'good':'mid') + '">' + actualCount + '</div><div class="og-cnt-lbl">\u5B9E\u6709</div></div>';
  html += '<div class="og-cnt-box"><div class="og-cnt-num">' + materialized + '</div><div class="og-cnt-lbl">\u5177\u8C61</div></div>';
  if (vacantPos > 0) html += '<div class="og-cnt-box"><div class="og-cnt-num warn">' + vacantPos + '</div><div class="og-cnt-lbl">\u7F3A\u5458</div></div>';
  html += '</div>';
  html += '</div>';

  // 卡2：权力格局
  html += '<div class="og-summary-card c-power">';
  html += '<div class="og-sc-label">\u6743 \u529B \u683C \u5C40</div>';
  if (facEntries.length > 0) {
    html += '<div class="og-fac-bar">';
    facEntries.forEach(function(fk, i) {
      var pct = Math.round(factionMap[fk] / Math.max(1, _totalFilled + vacantPos) * 100);
      var clr = _facColors[fk] || _defaultFac[i % _defaultFac.length];
      html += '<div style="width:' + pct + '%;background:' + clr + ';" title="' + escHtml(fk) + ' ' + factionMap[fk] + '\u4EBA"></div>';
    });
    if (vacantPos > 0) {
      var vpct = Math.round(vacantPos / Math.max(1, _totalFilled + vacantPos) * 100);
      html += '<div style="width:' + vpct + '%;background:rgba(107,93,71,0.5);" title="\u7A7A\u7F3A ' + vacantPos + '\u4EBA"></div>';
    }
    html += '</div>';
    html += '<div class="og-fac-legend">';
    facEntries.forEach(function(fk, i) {
      var clr = _facColors[fk] || _defaultFac[i % _defaultFac.length];
      html += '<span class="og-fac-chip"><span class="sw" style="background:' + clr + ';"></span>' + escHtml(fk) + ' ' + factionMap[fk] + '</span>';
    });
    if (vacantPos > 0) {
      html += '<span class="og-fac-chip"><span class="sw" style="background:rgba(107,93,71,0.5);"></span>\u7A7A\u7F3A ' + vacantPos + '</span>';
    }
    html += '</div>';
  } else {
    html += '<div style="color:var(--ink-300);font-size:11px;font-style:italic;padding:4px 0;">\u672A\u52BF\u4E4B\u5C40\u00B7\u767E\u5B98\u5404\u5C45\u5176\u4F4D</div>';
  }
  html += '</div>';

  // 卡3：岁俸
  html += '<div class="og-summary-card c-cost">';
  html += '<div class="og-sc-label">\u5C81 \u4FF8 \u5F00 \u652F</div>';
  if (actualCost > 0 || theoryCost > 0) {
    html += '<div class="og-cost-main">' + (Math.round(actualCost)).toLocaleString() + ' <span class="unit">\u4E24/\u5C81</span></div>';
    if (theoryCost > actualCost) {
      html += '<div class="og-cost-theory">\u7F16\u5236\u5168\u5458\u5E94\u652F <span class="v">' + (Math.round(theoryCost)).toLocaleString() + ' \u4E24</span> \u00B7 \u5DEE\u989D ' + (Math.round(theoryCost - actualCost)).toLocaleString() + ' \u4E24\uFF08\u7CFB\u7F3A\u5458\u8282\u4F59\uFF09</div>';
    } else {
      html += '<div class="og-cost-theory">\u4F9D\u7F16\u5236\u8DB3\u989D\u652F\u7ED9</div>';
    }
  } else {
    html += '<div style="color:var(--ink-300);font-size:11px;font-style:italic;padding:4px 0;">\u672A\u914D\u7F6E\u4FF8\u7984\u89C4\u5219</div>';
  }
  html += '</div>';

  el.innerHTML = html;

  // ───── 预警条 ─────
  var alertEl = _$('office-alerts');
  if (alertEl) {
    var alerts = [];

    // 权臣预警：内阁首辅/六部尚书之一，所辖派系 >= 30% 且忠诚 < 60
    var _powerHolders = [];
    (function _scan(nodes){
      nodes.forEach(function(n){
        (n.positions||[]).forEach(function(p){
          if (!p.holder) return;
          var _rl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 99;
          if (_rl > 3) return;
          var _pc = findCharByName(p.holder);
          if (!_pc) return;
          var _pkey = _pc.party || _pc.faction;
          var _samePartyCnt = _pkey ? (factionMap[_pkey]||0) : 0;
          if (_samePartyCnt >= Math.max(4, _totalFilled * 0.25) && (_pc.loyalty||50) < 60) {
            _powerHolders.push({name: p.holder, pos: p.name, dept: n.name, partyCnt: _samePartyCnt, power: Math.round(((_pc.intelligence||50)+(_pc.administration||50))/2 + 20)});
          }
        });
        if (n.subs) _scan(n.subs);
      });
    })(GM.officeTree||[]);
    if (_powerHolders.length > 0) {
      _powerHolders.sort(function(a,b){return b.power - a.power;});
      var ph = _powerHolders[0];
      alerts.push({type:'danger', ic:'\u8B66', lbl:'\u6743\u81E3\u9884\u8B66\uFF1A', txt:escHtml(ph.name) + '\u00B7' + escHtml(ph.pos) + '\u00B7\u6240\u5C5E\u6D3E\u7CFB\u5C45<strong>' + ph.partyCnt + '</strong>\u804C\u00B7\u5B9E\u6743\u6307\u6570<strong>' + ph.power + '</strong>\u00B7\u6050\u6709\u4E13\u6743\u4E4B\u865E'});
    }

    // 职位空缺
    if (vacantPos > 0) {
      var _vacNames = [];
      (function _vscan(nodes){
        nodes.forEach(function(n){
          (n.positions||[]).forEach(function(p){
            if (!p.holder && _vacNames.length < 5) _vacNames.push(escHtml(n.name||'') + '\u00B7' + escHtml(p.name||''));
          });
          if (n.subs) _vscan(n.subs);
        });
      })(GM.officeTree||[]);
      alerts.push({type:'warn', ic:'\u7F3A', lbl:'\u804C\u4F4D\u7A7A\u7F3A\uFF1A', txt:_vacNames.join('\u3001') + (vacantPos > 5 ? '\u7B49 ' : '\u00B7') + '\u5171 <strong>' + vacantPos + '</strong> \u804C\u5F85\u8865'});
    }

    // 未具象
    if (unmaterialized > 0) {
      alerts.push({type:'info', ic:'\u8865', lbl:'\u5177\u8C61\u5316\uFF1A', txt:'\u5C1A\u6709 <strong>' + unmaterialized + '</strong> \u804C\u4E3A\u540D\u5B57\u5360\u4F4D\u00B7\u9700\u4ECE\u6709\u53F8\u9012\u8865\u5177\u4F53\u4EBA\u7269'});
    }

    if (alerts.length > 0) {
      alertEl.innerHTML = alerts.map(function(a){
        var cls = a.type === 'warn' ? ' warn' : a.type === 'info' ? ' info' : '';
        return '<div class="og-alert' + cls + '"><div class="ic">' + a.ic + '</div><div><span class="lbl">' + a.lbl + '</span><span class="txt">' + a.txt + '</span></div></div>';
      }).join('');
    } else {
      alertEl.innerHTML = '';
    }
  }
}

/** 荐贤——显示候选人列表，选择后写入诏令建议库 */
/** 高品级职位（从三品以上）触发廷推流程 */
function _offRecommend(pathArr, deptName, posName) {
  var pos = getOffNode(pathArr);
  if (!pos) return;
  // 检查品级——高品级触发廷推
  var _rl = typeof getRankLevel === 'function' ? getRankLevel(pos.rank) : 99;
  if (_rl <= 6) {
    _offTingTui(pathArr, deptName, posName, pos);
    return;
  }
  var capital = GM._capital || '京城';
  // 候选人：按职能匹配排序
  var candidates = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer; });
  // 能力匹配分数
  var _dutyText = (pos.desc||'') + (pos.duties||'') + deptName;
  var _isMilitary = /兵|军|卫|武|都督|将/.test(_dutyText);
  var _isAdmin = /吏|铨|考|礼|户|度支|工|刑/.test(_dutyText);
  candidates.forEach(function(c) {
    var score = 0;
    if (_isMilitary) score += (c.military||50) * 2 + (c.valor||50);
    else if (_isAdmin) score += (c.administration||50) * 2 + (c.intelligence||50);
    else score += (c.intelligence||50) + (c.administration||50) + (c.diplomacy||50);
    // 忠诚加分
    score += (c.loyalty||50) * 0.5;
    // 已有官职减分（避免兼任过多）
    if (c.officialTitle) score -= 20;
    // 品级匹配（简单：有品级的职位优先有品级经验的人）
    if (pos.rank && c._tenure) score += Object.keys(c._tenure).length * 5;
    // 回避标注
    c._avoidance = '';
    if (c.location && c.location !== capital && c.location === deptName) c._avoidance = '\u672C\u7C4D\u56DE\u907F';
    c._hasRecommender = c._recommendedBy || '';
    c._recommendScore = score;
  });
  candidates.sort(function(a,b) { return (b._recommendScore||0) - (a._recommendScore||0); });
  // 铨曹推荐（吏部主官的推荐偏向本派系）
  var _quanOfficer = null;
  if (typeof findOfficeByFunction === 'function') {
    var _q = findOfficeByFunction('铨') || findOfficeByFunction('吏') || findOfficeByFunction('选');
    if (_q && _q.holder) _quanOfficer = findCharByName(_q.holder);
  }
  // 弹窗
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var inner = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:500px;max-height:80vh;overflow-y:auto;">';
  inner += '<div style="font-size:var(--text-sm);color:var(--color-primary);margin-bottom:var(--space-2);letter-spacing:0.1em;">\u8350\u8D24\u2014\u2014' + escHtml(deptName) + escHtml(posName) + '</div>';
  if (_quanOfficer) {
    inner += '<div style="font-size:0.7rem;color:var(--gold-400);margin-bottom:var(--space-2);">\u94E8\u66F9\u63A8\u8350\uFF08' + escHtml(_quanOfficer.name) + '\uFF09\uFF1A</div>';
  }
  if (pos.rank) inner += '<div style="font-size:0.65rem;color:var(--ink-300);margin-bottom:var(--space-2);">\u54C1\u7EA7\u8981\u6C42\uFF1A' + escHtml(pos.rank) + '</div>';
  var top10 = candidates.slice(0, 10);
  top10.forEach(function(c, ci) {
    var isFaction = _quanOfficer && _quanOfficer.faction && c.faction === _quanOfficer.faction;
    var borderClr = isFaction ? 'var(--gold-500)' : 'var(--color-border-subtle)';
    inner += '<div style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + borderClr + ';border-radius:var(--radius-sm);cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="_offSelectCandidate(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\',\'' + escHtml(deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(posName).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
    inner += '<div>';
    inner += '<span style="font-size:var(--text-sm);font-weight:var(--weight-bold);">' + escHtml(c.name) + '</span>';
    if (c.title) inner += '<span style="font-size:0.65rem;color:var(--ink-300);margin-left:4px;">' + escHtml(c.title) + '</span>';
    if (isFaction) inner += '<span style="font-size:0.6rem;color:var(--gold-400);margin-left:4px;">[\u94E8\u66F9\u8350]</span>';
    if (c._avoidance) inner += '<span style="font-size:0.6rem;color:var(--vermillion-400);margin-left:4px;">[' + c._avoidance + ']</span>';
    inner += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">\u667A' + (c.intelligence||50) + ' \u653F' + (c.administration||50) + ' \u519B' + (c.military||50) + ' \5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</div>';
    inner += '</div>';
    inner += '<span style="font-size:0.7rem;color:var(--gold-400);">' + Math.round(c._recommendScore||0) + '\u5206</span>';
    inner += '</div>';
  });
  // 搜索筛选栏
  inner += '<div style="margin-top:var(--space-2);display:flex;gap:var(--space-1);margin-bottom:var(--space-1);">';
  inner += '<input id="_off-rec-search" placeholder="\u641C\u7D22\u59D3\u540D/\u5B98\u804C\u2026" style="flex:1;padding:2px 6px;font-size:0.7rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-family:inherit;" oninput="_offFilterCandidates(this.value)">';
  inner += '<select id="_off-rec-filter" style="font-size:0.7rem;padding:2px 4px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:var(--radius-sm);" onchange="_offFilterCandidates(_$(\'_off-rec-search\').value)">';
  inner += '<option value="all">\u5168\u90E8</option><option value="civil">\u6587\u5B98\u4F18\u5148</option><option value="military">\u6B66\u5B98\u4F18\u5148</option><option value="loyal">\u5FE0\u8BDA\u4F18\u5148</option><option value="vacant">\u65E0\u5B98\u804C</option></select>';
  inner += '</div>';
  inner += '<div id="_off-rec-list">';
  top10.forEach(function(c, ci) {
    var isFaction = _quanOfficer && _quanOfficer.faction && c.faction === _quanOfficer.faction;
    var borderClr = isFaction ? 'var(--gold-500)' : 'var(--color-border-subtle)';
    inner += '<div class="_off-rec-item" data-name="' + escHtml(c.name) + '" data-title="' + escHtml(c.title||'') + '" data-admin="' + (c.administration||50) + '" data-mil="' + (c.military||50) + '" data-loy="' + (c.loyalty||50) + '" data-hasoffice="' + (c.officialTitle?'1':'0') + '" style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + borderClr + ';border-radius:var(--radius-sm);cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="_offSelectCandidate(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\',\'' + escHtml(deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(posName).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
    inner += '<div>';
    inner += '<span style="font-size:var(--text-sm);font-weight:var(--weight-bold);">' + escHtml(c.name) + '</span>';
    if (c.title) inner += '<span style="font-size:0.65rem;color:var(--ink-300);margin-left:4px;">' + escHtml(c.title) + '</span>';
    if (isFaction) inner += '<span style="font-size:0.6rem;color:var(--gold-400);margin-left:4px;">[\u94E8\u66F9\u8350]</span>';
    if (c._avoidance) inner += '<span style="font-size:0.6rem;color:var(--vermillion-400);margin-left:4px;">[' + c._avoidance + ']</span>';
    inner += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">\u667A' + (c.intelligence||50) + ' \u653F' + (c.administration||50) + ' \u519B' + (c.military||50) + ' \5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</div>';
    inner += '</div>';
    inner += '<span style="font-size:0.7rem;color:var(--gold-400);">' + Math.round(c._recommendScore||0) + '\u5206</span>';
    inner += '</div>';
  });
  inner += '</div>';
  inner += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button></div>';
  inner += '</div>';
  bg.innerHTML = inner;
  document.body.appendChild(bg);
}

/** 候选人搜索过滤 */
function _offFilterCandidates(keyword) {
  var items = document.querySelectorAll('._off-rec-item');
  var filterType = (_$('_off-rec-filter')||{}).value || 'all';
  var kw = (keyword||'').toLowerCase();
  items.forEach(function(el) {
    var name = (el.getAttribute('data-name')||'').toLowerCase();
    var title = (el.getAttribute('data-title')||'').toLowerCase();
    var matchKw = !kw || name.indexOf(kw) >= 0 || title.indexOf(kw) >= 0;
    var matchFilter = true;
    if (filterType === 'civil') matchFilter = parseInt(el.getAttribute('data-admin')||'50') >= 60;
    else if (filterType === 'military') matchFilter = parseInt(el.getAttribute('data-mil')||'50') >= 60;
    else if (filterType === 'loyal') matchFilter = parseInt(el.getAttribute('data-loy')||'50') >= 70;
    else if (filterType === 'vacant') matchFilter = el.getAttribute('data-hasoffice') === '0';
    el.style.display = (matchKw && matchFilter) ? '' : 'none';
  });
}

/** 有司自动递补（不具象——只增actualCount） */
function _offAutoFill(deptName, posName) {
  var _found = false;
  (function _f(ns) {
    ns.forEach(function(n) {
      // 在所有层级搜索部门名
      if (n.name === deptName) {
        (n.positions||[]).forEach(function(p) {
          if (p.name === posName && !_found) {
            if (typeof _offMigratePosition === 'function') _offMigratePosition(p);
            if ((p.actualCount||0) < (p.headCount||1)) {
              p.actualCount = (p.actualCount||0) + 1;
              _found = true;
              toast(deptName + posName + '有司递补1人（未具象）');
              if (typeof renderOfficeTree === 'function') renderOfficeTree();
            } else { toast('此职已满编'); }
          }
        });
      }
      if (n.subs) _f(n.subs);
    });
  })(GM.officeTree||[]);
}

/** 选择候选人→写入诏令建议库 */
function _offSelectCandidate(charName, deptName, posName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '官制', from: '铨曹',
    content: '任命' + charName + '为' + deptName + posName,
    turn: GM.turn, used: false
  });
  toast('已录入诏书建议库——请在诏令中正式下旨');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

/* ══════════════════════════════════════════════════════════════════
   统一任命/改换选任器（v2）
   · 列出全部本势力活人物
   · 按匹配度+派系+忠诚综合排序
   · 搜索 + 过滤(全部/文官/武官/忠诚/无官职/本派系/同籍贯)
   · 选中 → 录入诏书建议库（替换时写"免旧+任新"两条）
   ══════════════════════════════════════════════════════════════════ */
var _OFF_PICKER = null;

function _offOpenPicker(pathArr, deptName, posName, currentHolder) {
  var pos = getOffNode(pathArr) || { name: posName, desc: '', duties: '', rank: '' };
  var capital = GM._capital || '京城';
  var dutyText = (pos.desc||'') + (pos.duties||'') + deptName + posName;
  var isMilitary = /兵|军|卫|武|都督|将|都指挥|总兵|参将/.test(dutyText);
  var isAdmin = /吏|铨|考|礼|户|度支|工|刑|御史/.test(dutyText);
  var isClose = /学士|侍读|侍讲|翰林|中书|舍人/.test(dutyText);

  // 职位需求推导（match% 基准）
  var rankLvl = typeof getRankLevel === 'function' ? getRankLevel(pos.rank) : 10;
  var loyNeeded = rankLvl <= 3 ? 75 : rankLvl <= 6 ? 60 : 45;
  var req;
  if (isMilitary) req = { primary:'military', secondary:'valor', label:'武官\u00B7\u519B\u4E8B\u4E3A\u4E3B', loyNeeded:loyNeeded };
  else if (isClose) req = { primary:'intelligence', secondary:'diplomacy', label:'\u8FD1\u4F8D\u00B7\u5B66\u8BC6+\u8FA9\u624D', loyNeeded:loyNeeded };
  else if (isAdmin) req = { primary:'administration', secondary:'intelligence', label:'\u6587\u5B98\u00B7\u653F\u52A1\u4E3A\u4E3B', loyNeeded:loyNeeded };
  else req = { primary:'administration', secondary:'intelligence', label:'\u7EFC\u5408\u804C\u4F4D', loyNeeded:loyNeeded };
  var statLabel = { administration:'\u653F\u52A1', military:'\u519B\u4E8B', intelligence:'\u667A\u529B', valor:'\u6B66\u52C7', diplomacy:'\u8FA9\u624D' };
  req.primaryLabel = statLabel[req.primary] || req.primary;
  req.secondaryLabel = statLabel[req.secondary] || req.secondary;

  // 玩家所在势力领袖·多重兜底：GM.facs.isPlayer → P.playerInfo.factionName → GM.playerFaction
  var playerFac = (GM.facs||[]).find(function(f){ return f.isPlayer; });
  var playerFacName = playerFac ? playerFac.name : '';
  if (!playerFacName) {
    playerFacName = (P.playerInfo && P.playerInfo.factionName) || GM.playerFaction || '';
  }
  var playerParty = playerFac && playerFac.leaderParty ? playerFac.leaderParty : '';

  // 候选池：活人·非玩家·非已在此职；派系过滤仅在玩家有明确势力时生效（中立/无派系角色始终可用）
  var cands = (GM.chars || []).filter(function(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    if (c.name === currentHolder) return false; // 现任不是候选
    // 派系锁：仅当玩家有明确势力且角色也有明确且不匹配的派系时才排除
    // 中立角色（c.faction 空）一律允许；玩家无明确势力时不做派系过滤
    if (playerFacName && c.faction && c.faction !== playerFacName) return false;
    return true;
  });

  // 打分 + 胜任度百分比
  cands.forEach(function(c) {
    // 原综合 score（用于默认排序一致）
    var score = 0;
    if (isMilitary) score += (c.military||50) * 2 + (c.valor||50);
    else if (isAdmin) score += (c.administration||50) * 2 + (c.intelligence||50);
    else if (isClose) score += (c.intelligence||50) * 2 + (c.diplomacy||50);
    else score += (c.intelligence||50) + (c.administration||50) + (c.diplomacy||50);
    score += (c.loyalty||50) * 0.6;
    if (c.officialTitle) score -= 15;
    if (c.location && c.location !== capital) score -= 10;
    if (pos.rank && c._tenure) score += Math.min(30, Object.keys(c._tenure).length * 4);
    c._pickerScore = score;

    // 胜任度 0-100·主属性 60%·次属性 25%·忠诚 15%
    var primaryVal = c[req.primary] || 50;
    var secondaryVal = c[req.secondary] || 50;
    var loyVal = c.loyalty || 50;
    var loyComponent = loyVal >= req.loyNeeded ? 100 : Math.round((loyVal / req.loyNeeded) * 100);
    var match = Math.round(primaryVal * 0.6 + secondaryVal * 0.25 + loyComponent * 0.15);
    c._pickerMatch = Math.max(0, Math.min(100, match));

    // 赴任天数（外地才算·粗估 20 日保底·实际以 AI 推演为准）
    c._pickerTravelDays = 0;
    if (c.location && c.location !== capital) c._pickerTravelDays = 20;

    // 分类标签
    c._pickerTags = [];
    if (!c.officialTitle) c._pickerTags.push('vacant');
    if ((c.administration||50) >= 65) c._pickerTags.push('civil');
    if ((c.military||50) >= 65) c._pickerTags.push('military');
    if ((c.loyalty||50) >= 75) c._pickerTags.push('loyal');
    if (c.location && c.location !== capital) c._pickerTags.push('remote');

    // 警示标志
    c._pickerWarnings = [];
    if (loyVal < req.loyNeeded) c._pickerWarnings.push('\u5FE0\u8BDA\u4E0D\u8DB3');
    if (c.age && c.age >= 65) c._pickerWarnings.push('\u5E74\u8FC8');
    if (c.age && c.age < 20) c._pickerWarnings.push('\u5E74\u5E7C');
  });
  // 主排序：胜任度 desc；次排序：忠诚 desc
  cands.sort(function(a,b){
    var m = (b._pickerMatch||0) - (a._pickerMatch||0);
    if (m !== 0) return m;
    return (b.loyalty||50) - (a.loyalty||50);
  });
  // 标记冠亚季
  if (cands.length > 0) cands[0]._pickerRank = 1;
  if (cands.length > 1) cands[1]._pickerRank = 2;
  if (cands.length > 2) cands[2]._pickerRank = 3;

  _OFF_PICKER = { pathArr: pathArr, deptName: deptName, posName: posName, currentHolder: currentHolder, cands: cands, pos: pos, filter: 'all', kw: '', req: req };

  // 建 modal
  var existing = document.getElementById('off-picker-modal');
  if (existing) existing.remove();
  var bg = document.createElement('div');
  bg.id = 'off-picker-modal';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  bg.onclick = function(e) { if (e.target === bg) _offClosePicker(); };

  var modeLbl = currentHolder ? '改换' : '任命';
  var modeClr = currentHolder ? 'var(--amber-400)' : 'var(--gold-400)';

  var html = ''
    + '<div style="background:var(--color-surface);border:1px solid ' + modeClr + ';border-radius:var(--radius-lg);width:min(680px,94vw);max-height:86vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);overflow:hidden;">'
    // 标题栏
    +   '<div style="padding:0.9rem 1.2rem 0.7rem;border-bottom:1px solid var(--color-border-subtle);background:linear-gradient(180deg,rgba(184,154,83,0.04),transparent);">'
    +     '<div style="display:flex;justify-content:space-between;align-items:baseline;">'
    +       '<div>'
    +         '<div style="font-size:0.72rem;color:var(--ink-300);letter-spacing:0.2em;">\u3014 \u9078 \u4EFB \u3015</div>'
    +         '<div style="font-size:1.05rem;font-weight:700;color:' + modeClr + ';margin-top:3px;">' + modeLbl + escHtml(deptName) + '\u00B7' + escHtml(posName)
    +           (pos.rank ? '<span style="font-size:0.7rem;font-weight:400;color:var(--ink-300);margin-left:6px;">' + escHtml(pos.rank) + '</span>' : '')
    +         '</div>'
    +       '</div>'
    +       '<button class="bt bs bsm" onclick="_offClosePicker()" aria-label="\u5173\u95ED">\u2715</button>'
    +     '</div>'
    +     (pos.desc ? '<div style="font-size:0.74rem;color:var(--ink-300);margin-top:4px;line-height:1.5;">' + escHtml(pos.desc) + '</div>' : '')
    +     '<div style="margin-top:6px;padding:5px 10px;background:rgba(107,176,124,0.06);border-left:3px solid var(--celadon-400);border-radius:2px;font-size:0.72rem;color:var(--ink-300);">'
    +       '<span style="color:var(--celadon-400);font-weight:600;letter-spacing:0.1em;">\u3014 \u6B64 \u804C \u6240 \u6C42 \u3015</span> '
    +       escHtml(req.label) + ' \u00B7 '
    +       '\u4E3B\u8981' + escHtml(req.primaryLabel) + ' \u00B7 '
    +       '\u8F85\u4EE5' + escHtml(req.secondaryLabel) + ' \u00B7 '
    +       '\u5FE0\u8BDA\u2265<strong style="color:var(--gold-400);">' + req.loyNeeded + '</strong>'
    +     '</div>'
    +     (currentHolder ? '<div class="off-pk-replacing">\u2192 \u73B0\u4EFB\uFF1A<b>' + escHtml(currentHolder) + '</b>\uFF08\u9009\u4EFB\u540E\u5C06\u81EA\u52A8\u51FB\u514D\u65E7\u4EFB\u00B7\u8D77\u7528\u65B0\u4EBA\uFF09</div>' : '')
    +   '</div>'
    // 过滤栏（chip 带计数）
    +   '<div style="padding:0.5rem 1rem;border-bottom:1px solid var(--color-border-subtle);display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">'
    +     '<input id="off-picker-search" placeholder="\u641C\u59D3\u540D/\u5B98\u804C/\u7C4D\u8D2F\u2026" style="flex:1;min-width:160px;padding:5px 10px;font-size:0.8rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);" oninput="_offPickerFilter()"/>'
    +     _offPickerFilterChip('all', '\u5168\u90E8', cands.length)
    +     _offPickerFilterChip('civil', '\u6587\u5B98', _offCountTag(cands, 'civil'))
    +     _offPickerFilterChip('military', '\u6B66\u5B98', _offCountTag(cands, 'military'))
    +     _offPickerFilterChip('loyal', '\u5FE0\u8BDA', _offCountTag(cands, 'loyal'))
    +     _offPickerFilterChip('vacant', '\u5E03\u8863', _offCountTag(cands, 'vacant'))
    +   '</div>'
    // 列表容器
    +   '<div id="off-picker-list" style="flex:1;overflow-y:auto;padding:0.5rem 0.8rem;"></div>'
    // 底部·含键盘提示
    +   '<div class="off-pk-footer">'
    +     '<span id="off-picker-count">\u5171 <b style="color:var(--gold-300);">' + cands.length + '</b> \u4EBA\u53EF\u9009 \u00B7 \u6309<b>\u80DC\u4EFB\u5EA6</b>\u964D\u5E8F</span>'
    +     '<span class="off-pk-kbd">'
    +       '<span><kbd>\u2191</kbd><kbd>\u2193</kbd> \u9009\u4EBA</span>'
    +       '<span><kbd>\u23CE</kbd> \u786E\u8BA4</span>'
    +       '<span><kbd>/</kbd> \u641C\u7D22</span>'
    +       '<span><kbd>Esc</kbd> \u53D6\u6D88</span>'
    +     '</span>'
    +   '</div>'
    + '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);
  _offRenderPickerList();
  var _ipt = document.getElementById('off-picker-search');
  if (_ipt) setTimeout(function(){ _ipt.focus(); }, 50);
}

function _offPickerFilterChip(key, label, count) {
  var st = _OFF_PICKER && _OFF_PICKER.filter === key;
  var bg = st ? 'var(--gold-400)' : 'var(--color-elevated)';
  var clr = st ? 'var(--color-bg)' : 'var(--color-foreground-muted)';
  var bd = st ? 'var(--gold-400)' : 'var(--color-border)';
  var cnt = (typeof count === 'number') ? '<span class="off-pk-chip-count">' + count + '</span>' : '';
  return '<button onclick="_offPickerSetFilter(\'' + key + '\')" style="font-size:0.72rem;padding:3px 10px;background:' + bg + ';border:1px solid ' + bd + ';border-radius:999px;color:' + clr + ';cursor:pointer;display:inline-flex;align-items:center;gap:4px;">' + label + cnt + '</button>';
}

// 统计候选人在某 tag/类别下的数量
function _offCountTag(cands, key) {
  if (!cands || !cands.length) return 0;
  if (key === 'all') return cands.length;
  if (key === 'vacant') return cands.filter(function(c){ return !c.officialTitle; }).length;
  return cands.filter(function(c){ return (c._pickerTags||[]).indexOf(key) >= 0; }).length;
}

// 候选人四维 mini-bar 三件组
function _offStatsMiniHtml(c, f1) {
  f1 = f1 || function(v){ return Math.round(v); };
  function _cls(v){ return v >= 75 ? 'hi' : v >= 50 ? 'mid' : 'lo'; }
  function _row(lbl, v) {
    var cls = _cls(v);
    return '<div class="off-pk-stat-mini"><span class="lbl">' + lbl + '</span><span class="val ' + cls + '">' + f1(v) + '</span><div class="bar"><div class="fill-' + cls + '" style="width:' + Math.min(100, v) + '%;"></div></div></div>';
  }
  return '<div class="off-pk-stats-mini">'
    + _row('\u667A', c.intelligence || 50)
    + _row('\u653F', c.administration || 50)
    + _row('\u519B', c.military || 50)
    + _row('\u5FE0', c.loyalty || 50)
    + '</div>';
}

function _offPickerSetFilter(key) {
  if (!_OFF_PICKER) return;
  _OFF_PICKER.filter = key;
  // 重渲过滤栏
  var modal = document.getElementById('off-picker-modal');
  if (modal) {
    var chips = modal.querySelectorAll('button[onclick^="_offPickerSetFilter"]');
    chips.forEach(function(c){
      var k = (c.getAttribute('onclick')||'').match(/'([^']+)'/);
      if (k && k[1]) {
        var isSel = k[1] === key;
        c.style.background = isSel ? 'var(--gold-400)' : 'var(--color-elevated)';
        c.style.color = isSel ? 'var(--color-bg)' : 'var(--color-foreground-muted)';
        c.style.borderColor = isSel ? 'var(--gold-400)' : 'var(--color-border)';
      }
    });
  }
  _offRenderPickerList();
}

