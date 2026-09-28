// @ts-check
/// <reference path="types.d.ts" />
// tm-office-runtime-summary-appoint.js — 官员表·部门效能摘要预警 + 中推/荐举 + 统一任命选任器
//   (第十六拆·从 tm-office-runtime.js 尾部 §3+选任器切出·保序切割 sibling·排 origin 之后)
// 装载序：必须紧接 tm-office-runtime.js 之后装载（index.html · ?v=20260706-split）——
//   与拆前逐字节等价靠此邻接。本片装载期可执行语句仅：`var _OFF_PICKER=null` 与
//   `if(typeof window...)window._offOpenZhongtui=...` 暴露行；余皆顶层 function 声明(挂全局)。
// 跨文件词法可见性：origin 与本片同为经典 <script>(非 module)，顶层 var/function 皆全局属性，互可见。
//   OfficeDynastification 及其 4 个引用函数(_officeGetSubtabs/_officeClassifyDept/
//   officeApplyDismissalPressure/officeAssignConcurrentTitle)全留 origin，本片不含之。
// 内容：_renderOfficeSummary(§3 摘要/预警) · _offOpenZhongtui · _offRecommend/_offFilterCandidates/
//   _offAutoFill/_offSelectCandidate · _OFF_PICKER + _offOpenPicker 选任器族(_offPickerFilterChip/
//   _offCountTag/_offStatsMiniHtml/_offPickerSetFilter)

function _renderOfficeSummary() {
  var el = _$('office-summary'); if (!el) return;
  var treeStats = typeof _offTreeStats === 'function' ? _offTreeStats(GM.officeTree) : { headCount:0, actualCount:0, materialized:0, depts:0 };
  var totalDepts = treeStats.depts;
  var totalPos = treeStats.headCount;
  var actualCount = treeStats.actualCount;
  var materialized = treeStats.materialized;
  var vacantPos = Math.max(0, Number(treeStats.vacant) || 0);
  var overstaffed = Math.max(0, Number(treeStats.overstaffed) || 0);
  var unmaterialized = Math.max(0, Number(treeStats.unmaterialized) || 0);

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
          var _fc = _offOccupancy(p).primary;
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
    html += '<div style="color:var(--ink-300);font-size:12px;font-style:italic;padding:4px 0;">\u672A\u52BF\u4E4B\u5C40\u00B7\u767E\u5B98\u5404\u5C45\u5176\u4F4D</div>';
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
    html += '<div style="color:var(--ink-300);font-size:12px;font-style:italic;padding:4px 0;">\u672A\u914D\u7F6E\u4FF8\u7984\u89C4\u5219</div>';
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
          if (!_offOccupancy(p).occupied) return;
          var _rl = typeof getRankLevel === 'function' ? getRankLevel(p.rank) : 99;
          if (_rl > 3) return;
          var _pc = _offOccupancy(p).primary;
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

    // 人才流失预警：才高位卑萌去意的能臣（_seeksRemoval·S1d 才不配位反哺产出·officeSatisfactionFeedbackEnabled 关时恒空不预警·2026-07-01）
    var _disaffElite = (GM.chars || []).filter(function (c) { return c && c.alive !== false && c._seeksRemoval; });
    if (_disaffElite.length > 0) {
      var _deNames = _disaffElite.slice(0, 5).map(function (c) { return escHtml(c.name) + (c.officialTitle ? '·' + escHtml(c.officialTitle) : ''); });
      alerts.push({ type: 'warn', ic: '才', lbl: '人才流失预警：', txt: _deNames.join('、') + (_disaffElite.length > 5 ? '等' : '') + '·才高位卑久郁·忠诚渐衰萌去意·<strong>' + _disaffElite.length + '</strong> 员待拔擢留贤，否则恐挂冠而去' });
    }

    // 职位空缺
    if (vacantPos > 0) {
      var _vacNames = [];
      (function _vscan(nodes){
        nodes.forEach(function(n){
          (n.positions||[]).forEach(function(p){
            if (_offOccupancy(p).vacancyCount > 0 && _vacNames.length < 5) _vacNames.push(escHtml(n.name||'') + '\u00B7' + escHtml(p.name||''));
          });
          if (n.subs) _vscan(n.subs);
        });
      })(GM.officeTree||[]);
      alerts.push({type:'warn', ic:'\u7F3A', lbl:'\u804C\u4F4D\u7A7A\u7F3A\uFF1A', txt:_vacNames.join('\u3001') + (vacantPos > 5 ? '\u7B49 ' : '\u00B7') + '\u5171 <strong>' + vacantPos + '</strong> \u804C\u5F85\u8865'});
    }

    if (overstaffed > 0) {
      alerts.push({type:'danger', ic:'\u8D85', lbl:'\u7F16\u5236\u8D85\u5458\uFF1A', txt:'\u5B9E\u6709\u5B98\u5458\u8D85\u51FA\u7F16\u5236 <strong>' + overstaffed + '</strong> \u5458\u00B7\u8BF7\u6838\u67E5\u91CD\u590D\u4EFB\u547D\u6216\u65E7\u6863\u7F16\u5236'});
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

/** 全局·荐贤廷推入口——列出所有空缺职位·点击进入对应职位的荐贤/廷推流程
 *  解决 tm-hongyan-office.js 头按钮 onclick 调用 _offOpenZhongtui 但未实现的 bug
 *  - 高品级(rank≤6) 自动进 _offTingTui(廷推 modal)
 *  - 一般品级 进 _offRecommend(候选人列表 modal)
 *  - 选定者写入 _edictSuggestions(诏书建议库)·下回合 endturn 推演读为人事议题
 */
function _offOpenZhongtui() {
  if (!GM.officeTree || GM.officeTree.length === 0) {
    if (typeof toast === 'function') toast('官制未配置·无职位可推');
    return;
  }
  // 收集所有空缺职位·路径+品级
  var vacancies = [];
  (function _walk(nodes, prefix) {
    if (!nodes) return;
    nodes.forEach(function(n, i) {
      var basePath = prefix.concat([i]);
      (n.positions || []).forEach(function(p, pi) {
        if (!_offOccupancy(p).occupied) {
          var rl = (typeof getRankLevel === 'function') ? getRankLevel(p.rank) : 99;
          vacancies.push({
            pathArr: basePath.concat(['p', pi]),
            deptName: n.name,
            posName: p.name,
            rank: p.rank || '',
            rankLevel: rl,
            isHigh: rl <= 6,
            duty: (p.desc || p.duties || '').slice(0, 40)
          });
        }
      });
      if (n.subs) _walk(n.subs, basePath.concat(['s']));
    });
  })(GM.officeTree, []);

  if (vacancies.length === 0) {
    if (typeof toast === 'function') toast('百司满员·无缺可推');
    return;
  }
  // 按品级·高品级在前
  vacancies.sort(function(a, b) { return a.rankLevel - b.rankLevel; });

  // 弹窗列出缺
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:600px;max-height:80vh;overflow-y:auto;width:90vw;">';
  html += '<div style="font-size:var(--text-md);color:var(--color-primary);margin-bottom:var(--space-2);letter-spacing:0.15em;text-align:center;">〔 荐 贤 廷 推 〕</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);text-align:center;margin-bottom:var(--space-3);">共 ' + vacancies.length + ' 职待补·选一荐之·高品走廷推·余者荐贤</div>';

  var lastGroup = '';
  vacancies.forEach(function(v) {
    // 高品级/一般 分组
    var group = v.isHigh ? '高品·廷推' : '一般·荐贤';
    if (group !== lastGroup) {
      html += '<div style="font-size:0.7rem;color:var(--gold-400);margin:var(--space-2) 0 var(--space-1);letter-spacing:0.1em;border-bottom:1px solid var(--color-border-subtle);padding-bottom:2px;">' + group + '</div>';
      lastGroup = group;
    }
    var pathJSON = JSON.stringify(v.pathArr).replace(/"/g, '&quot;');
    var safeDept = escHtml(v.deptName).replace(/'/g, "\\'");
    var safePos = escHtml(v.posName).replace(/'/g, "\\'");
    html += '<div style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + (v.isHigh ? 'var(--gold-500)' : 'var(--color-border-subtle)') + ';border-radius:var(--radius-sm);cursor:pointer;display:flex;justify-content:space-between;align-items:center;" '
      + 'onclick="this.closest(\'div[style*=fixed]\').remove();_offRecommend(' + pathJSON + ',\'' + safeDept + '\',\'' + safePos + '\')">';
    html += '<div>';
    html += '<span style="font-size:var(--text-sm);' + (v.isHigh ? 'color:var(--gold-400);font-weight:var(--weight-bold);' : '') + '">' + escHtml(v.deptName) + ' · ' + escHtml(v.posName) + '</span>';
    if (v.rank) html += '<span style="font-size:0.7rem;color:var(--ink-300);margin-left:6px;">' + escHtml(v.rank) + '</span>';
    if (v.duty) html += '<div style="font-size:0.68rem;color:var(--color-foreground-muted);margin-top:2px;">' + escHtml(v.duty) + '</div>';
    html += '</div>';
    html += '<span style="font-size:0.7rem;color:var(--gold-400);">' + (v.isHigh ? '入 廷 推 ›' : '荐 贤 ›') + '</span>';
    html += '</div>';
  });
  html += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">关闭</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}
if (typeof window !== 'undefined') window._offOpenZhongtui = _offOpenZhongtui;

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
  var candidates = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c._captured && !c.isPlayer; });
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
    if (c.location && !_isSameLocation(c.location, capital) && _isSameLocation(c.location, deptName)) c._avoidance = '\u672C\u7C4D\u56DE\u907F';
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
  if (pos.rank) inner += '<div style="font-size:0.7rem;color:var(--ink-300);margin-bottom:var(--space-2);">\u54C1\u7EA7\u8981\u6C42\uFF1A' + escHtml(pos.rank) + '</div>';
  var top10 = candidates.slice(0, 10);
  top10.forEach(function(c, ci) {
    var isFaction = _quanOfficer && _quanOfficer.faction && c.faction === _quanOfficer.faction;
    var borderClr = isFaction ? 'var(--gold-500)' : 'var(--color-border-subtle)';
    inner += '<div style="padding:var(--space-2);margin-bottom:var(--space-1);background:var(--color-elevated);border:1px solid ' + borderClr + ';border-radius:var(--radius-sm);cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="_offSelectCandidate(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\',\'' + escHtml(deptName).replace(/'/g,"\\'") + '\',\'' + escHtml(posName).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
    inner += '<div>';
    inner += '<span style="font-size:var(--text-sm);font-weight:var(--weight-bold);">' + escHtml(c.name) + '</span>';
    if (c.title) inner += '<span style="font-size:0.7rem;color:var(--ink-300);margin-left:4px;">' + escHtml(c.title) + '</span>';
    if (isFaction) inner += '<span style="font-size:0.66rem;color:var(--gold-400);margin-left:4px;">[\u94E8\u66F9\u8350]</span>';
    if (c._avoidance) inner += '<span style="font-size:0.66rem;color:var(--vermillion-400);margin-left:4px;">[' + c._avoidance + ']</span>';
    inner += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);">\u667A' + (c.intelligence||50) + ' \u653F' + (c.administration||50) + ' \u519B' + (c.military||50) + ' \5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</div>';
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
    if (c.title) inner += '<span style="font-size:0.7rem;color:var(--ink-300);margin-left:4px;">' + escHtml(c.title) + '</span>';
    if (isFaction) inner += '<span style="font-size:0.66rem;color:var(--gold-400);margin-left:4px;">[\u94E8\u66F9\u8350]</span>';
    if (c._avoidance) inner += '<span style="font-size:0.66rem;color:var(--vermillion-400);margin-left:4px;">[' + c._avoidance + ']</span>';
    inner += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);">\u667A' + (c.intelligence||50) + ' \u653F' + (c.administration||50) + ' \u519B' + (c.military||50) + ' \5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</div>';
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
  var candidate = typeof findCharByName === 'function' ? findCharByName(charName) : null;
  var candidateAge = typeof getValidAge === 'function' ? getValidAge(candidate, 30) : (candidate && Number.isFinite(Number(candidate.age)) && Number(candidate.age) >= 0 ? Math.floor(Number(candidate.age)) : 30);
  if (!candidate || candidateAge < 20 || candidateAge > 70) {
    if (typeof toast === 'function') toast('候选人年龄不符合任官契约', 'error');
    return false;
  }
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '官制', from: '铨曹',
    content: '任命' + charName + '为' + deptName + posName,
    turn: GM.turn, used: false
  });
  toast('已录入诏书建议库——请在诏令中正式下旨');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  return true;
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
  var pos = null;
  try { pos = getOffNode(pathArr); } catch(_){}
  if (!pos || pos.name !== posName) {
    try {
      if (typeof _offFindPositionByName === 'function') {
        var _hit = _offFindPositionByName(posName, deptName, GM.officeTree || []);
        if (_hit && _hit.pos) pos = _hit.pos;
      }
    } catch(_){}
  }
  pos = pos || { name: posName, desc: '', duties: '', rank: '' };
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

  // 玩家所在势力领袖：运行态 GM/TM.Player 为权威，不回读剧本模板的旧君身份。
  var playerFac = (GM.facs||[]).find(function(f){ return f.isPlayer; });
  var playerFacName = playerFac ? playerFac.name : '';
  if (!playerFacName) {
    var runtimeInfo = (typeof TM !== 'undefined' && TM.Player && typeof TM.Player.getInfo === 'function') ? TM.Player.getInfo() : (GM.playerInfo || {});
    playerFacName = runtimeInfo.factionName || GM.playerFaction || '';
  }
  var playerParty = playerFac && playerFac.leaderParty ? playerFac.leaderParty : '';

  // 候选池：活人·非玩家·非已在此职；派系过滤仅在玩家有明确势力时生效（中立/无派系角色始终可用）
  var cands = (GM.chars || []).filter(function(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    var age = typeof getValidAge === 'function' ? getValidAge(c, 30) : (Number.isFinite(Number(c.age)) && Number(c.age) >= 0 ? Math.floor(Number(c.age)) : 30);
    if (age < 20 || age > 70) return false;
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
    if (c.location && !_isSameLocation(c.location, capital)) score -= 10;
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
    if (c.location && !_isSameLocation(c.location, capital)) c._pickerTravelDays = 20;

    // 分类标签
    c._pickerTags = [];
    if (!c.officialTitle) c._pickerTags.push('vacant');
    if ((c.administration||50) >= 65) c._pickerTags.push('civil');
    if ((c.military||50) >= 65) c._pickerTags.push('military');
    if ((c.loyalty||50) >= 75) c._pickerTags.push('loyal');
    if (c.location && !_isSameLocation(c.location, capital)) c._pickerTags.push('remote');

    // 警示标志
    c._pickerWarnings = [];
    if (loyVal < req.loyNeeded) c._pickerWarnings.push('\u5FE0\u8BDA\u4E0D\u8DB3');
    var pickerAge = typeof getValidAge === 'function' ? getValidAge(c, 30) : (Number.isFinite(Number(c.age)) && Number(c.age) >= 0 ? Math.floor(Number(c.age)) : 30);
    if (pickerAge >= 65) c._pickerWarnings.push('\u5E74\u8FC8');
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
  bg.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
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
