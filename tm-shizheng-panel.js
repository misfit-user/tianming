// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-shizheng-panel.js — 御案时政+独召密问 (R137 从 tm-shell-extras.js L1088-end 拆出)
// 姊妹: tm-shell-extras.js (抽屉 shell UI 注入)
// 包含: 御案时政名录/详情/召对/密召入口 (openShizhengTasks)
//       独召密问两栏面板+问对式 AI 回答
// ============================================================

// ===================================================================
// 御案时政·名录 / 详情 / 召对·密召入口
// ===================================================================
function openShizhengTasks() {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  var GM = window.GM || {};
  var all = (GM.currentIssues || []).slice();
  var pending = all.filter(function(i){ return i.status !== 'resolved'; })
                   .sort(function(a,b){ return (b.raisedTurn||0) - (a.raisedTurn||0); });
  var resolved = all.filter(function(i){ return i.status === 'resolved'; })
                    .sort(function(a,b){ return (b.resolvedTurn||b.raisedTurn||0) - (a.resolvedTurn||a.raisedTurn||0); });

  var exist = document.getElementById('shizheng-tasks-overlay');
  if (exist) exist.remove();

  var overlay = document.createElement('div');
  overlay.id = 'shizheng-tasks-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(18,12,6,0.85);z-index:9998;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  overlay.onclick = function(e){ if (e.target === overlay) closeShizhengTasks(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'width:min(92vw,1020px);max-height:78vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,0.7);overflow:hidden;';

  var html = '';
  html += '<div style="padding:0.9rem 1.4rem;display:flex;align-items:center;gap:1rem;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.06),transparent);">';
  html += '<button onclick="closeShizhengTasks()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.35rem 0.9rem;cursor:pointer;font-size:0.88rem;border-radius:3px;letter-spacing:0.15em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 返 回</button>';
  html += '<div style="flex:1;text-align:center;font-size:1.25rem;letter-spacing:0.7rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;text-shadow:0 2px 8px rgba(201,168,76,0.2);">御 案 时 政</div>';
  html += '<div style="width:5rem;text-align:right;"><span style="color:var(--txt-d);font-size:0.72rem;">'+pending.length+' 待 / '+resolved.length+' 决</span></div>';
  html += '</div>';

  html += '<div style="flex:1;overflow-y:auto;padding:1.1rem 1.4rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';

  if (pending.length === 0 && resolved.length === 0) {
    html += '<div style="text-align:center;padding:4rem 2rem;color:var(--txt-d);font-size:0.95rem;font-family:\'STKaiti\',\'KaiTi\',serif;letter-spacing:0.3em;">四海升平·暂无要务</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:0.85rem;">';
    pending.forEach(function(issue){ html += _renderShizhengCard(issue, _esc); });
    resolved.forEach(function(issue){ html += _renderShizhengCard(issue, _esc); });
    html += '</div>';
  }

  html += '</div>';
  panel.innerHTML = html;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function closeShizhengTasks() {
  var el = document.getElementById('shizheng-tasks-overlay');
  if (el) el.remove();
  var det = document.getElementById('shizheng-task-detail');
  if (det) det.remove();
}

function _renderShizhengCard(issue, _esc) {
  _esc = _esc || ((typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);});
  var isPending = issue.status !== 'resolved';
  var safeId = String(issue.id || '').replace(/'/g, "\\'");
  var _tsT = (typeof getTSText === 'function') ? getTSText : null;
  var dateStr = issue.raisedDate || (_tsT ? _tsT(issue.raisedTurn||1) : ('第'+(issue.raisedTurn||1)+'回合'));
  var title = issue.title || '(未详)';
  var rawDesc = String(issue.description || '');
  var desc = rawDesc.length > 70 ? rawDesc.slice(0, 70) + '…' : rawDesc;

  var cardBg = isPending ? '#f4e8cc' : '#e8ddbf';
  var cardBorder = isPending ? '#c9a85f' : '#a39373';
  var titleColor = isPending ? '#3d2f1a' : '#6b5d47';
  var descColor = isPending ? '#5a4a32' : '#8b7d68';
  var badgeStyle = isPending
    ? 'background:rgba(192,64,48,0.08);border:1px solid rgba(192,64,48,0.45);color:#a13c2e;'
    : 'background:rgba(90,90,90,0.08);border:1px solid rgba(90,90,90,0.45);color:#6b6b6b;';
  var badgeText = isPending ? '待解决' : '已解决';

  var h = '<div class="shizheng-card" data-issue-id="'+_esc(safeId)+'" ';
  h += 'style="background:'+cardBg+';border:1px solid '+cardBorder+';border-radius:4px;padding:0.9rem 1.1rem 0.95rem;cursor:pointer;position:relative;min-height:116px;transition:transform 0.15s ease-out,box-shadow 0.15s ease-out;'+(isPending?'':'opacity:0.78;')+'" ';
  h += 'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 14px rgba(201,168,76,0.25)\';" ';
  h += 'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';" ';
  h += 'onclick="_openShizhengDetail(\''+safeId+'\')">';
  h += '<div style="position:absolute;top:10px;right:10px;'+badgeStyle+'padding:2px 10px;border-radius:2px;font-size:0.7rem;font-weight:bold;transform:rotate(6deg);letter-spacing:0.1em;">'+badgeText+'</div>';
  h += '<div style="font-weight:700;font-size:1rem;color:'+titleColor+';margin-bottom:0.3rem;padding-right:60px;line-height:1.4;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(title)+'</div>';
  h += '<div style="font-size:0.72rem;color:#8b7355;margin-bottom:0.5rem;letter-spacing:0.05em;">'+_esc(dateStr)+'</div>';
  h += '<div style="font-size:0.8rem;color:'+descColor+';line-height:1.65;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(desc)+'</div>';
  h += '</div>';
  return h;
}

function _openShizhengDetail(issueId) {
  var GM = window.GM || {};
  var issue = (GM.currentIssues||[]).find(function(i){ return String(i.id) === String(issueId); });
  if (!issue) { if (typeof toast === 'function') toast('议题已失效'); return; }
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var _tsT2 = (typeof getTSText === 'function') ? getTSText : null;

  var prev = document.getElementById('shizheng-task-detail');
  if (prev) prev.remove();

  var det = document.createElement('div');
  det.id = 'shizheng-task-detail';
  det.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,5,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  det.onclick = function(e){ if (e.target === det) det.remove(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'width:min(90vw,760px);max-height:82vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  var isPending = issue.status !== 'resolved';
  var badgeStyle = isPending
    ? 'background:rgba(192,64,48,0.12);border:1px solid rgba(192,64,48,0.5);color:#c05030;'
    : 'background:rgba(120,120,120,0.12);border:1px solid rgba(120,120,120,0.5);color:#888;';
  var badgeText = isPending ? '待解决' : '已解决';

  var h = '';
  h += '<div style="padding:0.85rem 1.3rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.05),transparent);">';
  h += '<button onclick="document.getElementById(\'shizheng-task-detail\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.35rem 0.9rem;cursor:pointer;font-size:0.85rem;border-radius:3px;letter-spacing:0.15em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 返 回</button>';
  h += '<div style="flex:1;"></div>';
  h += '<button onclick="document.getElementById(\'shizheng-task-detail\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);width:1.9rem;height:1.9rem;cursor:pointer;font-size:0.85rem;border-radius:3px;">✕</button>';
  h += '</div>';

  // 滚动正文
  h += '<div style="flex:1;overflow-y:auto;padding:1.4rem 1.8rem 1.6rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';

  // 标题区
  h += '<div style="text-align:center;margin-bottom:1.3rem;">';
  h += '<div style="font-size:1.55rem;font-weight:bold;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;letter-spacing:0.18em;margin-bottom:0.5rem;text-shadow:0 2px 12px rgba(201,168,76,0.2);">'+_esc(issue.title||'')+'</div>';
  var _rDate = issue.raisedDate || (_tsT2 ? _tsT2(issue.raisedTurn||1) : ('第'+(issue.raisedTurn||1)+'回合'));
  h += '<div style="display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:0.6rem;color:var(--txt-d);font-size:0.8rem;">';
  h += '<span>'+_esc(_rDate)+'</span>';
  if (issue.category) h += '<span style="color:var(--gold-d);">·</span><span>'+_esc(issue.category)+'</span>';
  if (issue.affectedRegion) h += '<span style="color:var(--gold-d);">·</span><span style="color:var(--vermillion-300);">影响·'+_esc(issue.affectedRegion)+'</span>';
  if (issue.severity) {
    var _sevMap = {urgent:'紧急',high:'重要',warn:'警戒',info:'平常'};
    h += '<span style="color:var(--gold-d);">·</span><span>'+_esc(_sevMap[issue.severity]||issue.severity)+'</span>';
  }
  h += '<span style="'+badgeStyle+'padding:2px 10px;border-radius:2px;font-size:0.72rem;font-weight:bold;letter-spacing:0.1em;">'+badgeText+'</span>';
  h += '</div></div>';

  // 核心描述
  h += '<div style="font-size:0.95rem;line-height:2.05;color:var(--txt-l);margin-bottom:1.2rem;text-align:justify;white-space:pre-wrap;font-family:\'STKaiti\',\'KaiTi\',serif;letter-spacing:0.02em;padding:0.8rem 1rem;background:rgba(201,168,76,0.025);border-left:2px solid var(--gold-d);">'+_esc(issue.description||'')+'</div>';

  // 详情奏闻（narrative）
  if (issue.narrative && issue.narrative !== issue.description) {
    h += '<div style="margin-bottom:1.2rem;">';
    h += '<div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;margin-bottom:0.5rem;font-family:\'STKaiti\',\'KaiTi\',serif;">〔 详 情 奏 闻 〕</div>';
    h += '<div style="font-size:0.88rem;line-height:2;color:var(--txt-s);text-align:justify;white-space:pre-wrap;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(issue.narrative)+'</div>';
    h += '</div>';
  }

  // 关涉人物 + 势力
  var hasChars = Array.isArray(issue.linkedChars) && issue.linkedChars.length > 0;
  var hasFacs = Array.isArray(issue.linkedFactions) && issue.linkedFactions.length > 0;
  if (hasChars || hasFacs) {
    h += '<div style="margin-bottom:1.2rem;display:grid;grid-template-columns:'+(hasChars&&hasFacs?'1fr 1fr':'1fr')+';gap:0.8rem;">';
    if (hasChars) {
      h += '<div><div style="font-size:0.75rem;color:var(--gold);letter-spacing:0.25em;margin-bottom:0.35rem;font-family:\'STKaiti\',\'KaiTi\',serif;">关 涉 群 臣</div>';
      h += '<div style="font-size:0.82rem;line-height:1.9;">';
      h += issue.linkedChars.map(function(n){return '<span style="display:inline-block;padding:1px 8px;margin:2px 3px 2px 0;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:2px;color:var(--gold-l);font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(n)+'</span>';}).join('');
      h += '</div></div>';
    }
    if (hasFacs) {
      h += '<div><div style="font-size:0.75rem;color:var(--gold);letter-spacing:0.25em;margin-bottom:0.35rem;font-family:\'STKaiti\',\'KaiTi\',serif;">牵 动 势 力</div>';
      h += '<div style="font-size:0.82rem;line-height:1.9;">';
      h += issue.linkedFactions.map(function(n){return '<span style="display:inline-block;padding:1px 8px;margin:2px 3px 2px 0;background:rgba(192,64,48,0.08);border:1px solid rgba(192,64,48,0.25);border-radius:2px;color:var(--vermillion-300);font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(n)+'</span>';}).join('');
      h += '</div></div>';
    }
    h += '</div>';
  }

  // 风势推演（长期后果）
  if (issue.longTermConsequences && typeof issue.longTermConsequences === 'object') {
    h += '<div style="margin-bottom:1.2rem;background:rgba(201,168,76,0.04);border:1px solid var(--gold-d);border-radius:3px;padding:0.8rem 1.1rem;">';
    h += '<div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;margin-bottom:0.45rem;font-family:\'STKaiti\',\'KaiTi\',serif;">〔 风 势 推 演 〕</div>';
    Object.keys(issue.longTermConsequences).forEach(function(k) {
      h += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.85;margin-bottom:0.2rem;font-family:\'STKaiti\',\'KaiTi\',serif;"><b style="color:var(--gold-d);">'+_esc(k)+'：</b>'+_esc(issue.longTermConsequences[k])+'</div>';
    });
    h += '</div>';
  }

  // 史料
  if (issue.historicalNote) {
    h += '<div style="margin-bottom:1.2rem;font-size:0.78rem;color:var(--ink-400);font-style:italic;line-height:1.85;border-left:2px solid rgba(201,168,76,0.4);padding:0.45rem 0.9rem;background:rgba(201,168,76,0.025);font-family:\'STKaiti\',\'KaiTi\',serif;">〔 史 馆 旧 案 〕 '+_esc(issue.historicalNote)+'</div>';
  }

  // 已选决断（若已决）
  if (issue.chosenText) {
    h += '<div style="margin-bottom:1.2rem;font-size:0.82rem;color:var(--celadon-400,#7eb8a7);line-height:1.8;padding:0.5rem 0.9rem;background:rgba(106,154,127,0.06);border:1px solid rgba(106,154,127,0.3);border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;">〔 陛 下 已 断 〕 '+_esc(issue.chosenText)+'</div>';
  }

  // 陛下决断·选项按钮
  if (Array.isArray(issue.choices) && issue.choices.length > 0 && isPending) {
    h += '<div style="margin-bottom:1.2rem;">';
    h += '<div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;margin-bottom:0.5rem;font-family:\'STKaiti\',\'KaiTi\',serif;text-align:center;">〔 陛 下 决 断 〕</div>';
    var safeIid = String(issue.id || '').replace(/'/g, "\\'");
    issue.choices.forEach(function(ch, idx) {
      h += '<button class="bt bsm" style="display:block;width:100%;text-align:left;margin-bottom:0.35rem;padding:0.55rem 0.85rem;background:rgba(201,168,76,0.05);border:1px solid var(--gold-d);color:var(--txt-l);cursor:pointer;line-height:1.5;white-space:normal;border-radius:3px;" onclick="if(typeof _chooseIssueOption===\'function\'){document.getElementById(\'shizheng-task-detail\').remove();document.getElementById(\'shizheng-tasks-overlay\')&&document.getElementById(\'shizheng-tasks-overlay\').remove();_chooseIssueOption(\''+safeIid+'\','+idx+');}">';
      h += '<div style="font-weight:600;font-size:0.85rem;margin-bottom:0.15rem;color:var(--gold-l);font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(ch.text||'选项'+(idx+1))+'</div>';
      if (ch.desc) h += '<div style="font-size:0.72rem;color:var(--txt-d);">'+_esc(ch.desc)+'</div>';
      h += '</button>';
    });
    h += '</div>';
  }

  // 解决时间（若已决）
  if (!isPending && issue.resolvedTurn) {
    var _resolveDateStr = issue.resolvedDate || (_tsT2 ? _tsT2(issue.resolvedTurn) : ('第'+issue.resolvedTurn+'回合'));
    h += '<div style="text-align:center;font-size:0.8rem;color:var(--celadon-400,#7eb8a7);letter-spacing:0.2em;margin-top:0.6rem;margin-bottom:0.3rem;">· 于 '+_esc(_resolveDateStr)+' 议决 ·</div>';
  }

  h += '</div>'; // /滚动正文

  // 底部操作栏
  if (isPending) {
    var safeId = String(issue.id || '').replace(/'/g, "\\'");
    h += '<div style="padding:0.8rem 1.3rem;display:flex;justify-content:center;gap:1.2rem;border-top:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,transparent,rgba(201,168,76,0.04));">';
    h += '<button onclick="_shizhengConvene(\''+safeId+'\')" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.55rem 1.4rem;cursor:pointer;font-size:0.92rem;letter-spacing:0.28em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;transition:all 0.2s;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.08))\';this.style.color=\'#f0d77a\';" onmouseout="this.style.background=\'linear-gradient(135deg,#3d2f1a,#2a2010)\';this.style.color=\'var(--gold)\';">御 前 召 对 群 臣</button>';
    h += '<button onclick="_shizhengSecret(\''+safeId+'\')" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.55rem 1.4rem;cursor:pointer;font-size:0.92rem;letter-spacing:0.28em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;transition:all 0.2s;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.08))\';this.style.color=\'#f0d77a\';" onmouseout="this.style.background=\'linear-gradient(135deg,#3d2f1a,#2a2010)\';this.style.color=\'var(--gold)\';">独 召 密 问</button>';
    h += '</div>';
  }

  panel.innerHTML = h;
  det.appendChild(panel);
  document.body.appendChild(det);
}

function _shizhengConvene(issueId) {
  var GM = window.GM || {};
  var issue = (GM.currentIssues||[]).find(function(i){ return String(i.id) === String(issueId); });
  var det = document.getElementById('shizheng-task-detail'); if (det) det.remove();
  var ov = document.getElementById('shizheng-tasks-overlay'); if (ov) ov.remove();
  if (typeof openChaoyi === 'function') {
    openChaoyi();
    if (issue && issue.title) {
      // 延迟预填议题
      setTimeout(function(){
        try {
          var topicInp = document.getElementById('cy-topic-input');
          if (topicInp) {
            topicInp.value = issue.title + (issue.description ? '·' + String(issue.description).slice(0, 60) : '');
          }
          if (window.CY) window.CY.topic = issue.title + (issue.description ? '·' + String(issue.description).slice(0, 60) : '');
        } catch(_){}
      }, 120);
    }
  } else if (typeof toast === 'function') { toast('朝议系统加载中'); }
}

function _shizhengSecret(issueId) {
  // 关闭当前详情（保留 shizheng-tasks-overlay 以便返回）
  var det = document.getElementById('shizheng-task-detail'); if (det) det.remove();
  var ov = document.getElementById('shizheng-tasks-overlay'); if (ov) ov.remove();
  // 弹出"选议政大臣与核心议题"两栏面板·预选当前议题
  if (typeof openMiZhaoPicker === 'function') {
    openMiZhaoPicker(issueId);
  } else if (typeof toast === 'function') { toast('密召面板加载中'); }
}

window.openShizhengTasks = openShizhengTasks;
window.closeShizhengTasks = closeShizhengTasks;
window._openShizhengDetail = _openShizhengDetail;
window._shizhengConvene = _shizhengConvene;
window._shizhengSecret = _shizhengSecret;

// ===================================================================
// 独召密问·选人选议题两栏面板 + 问对式 AI 回答
// ===================================================================
function openMiZhaoPicker(prefilledIssueId) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var GM = window.GM || {};
  var capital = GM._capital || '京师';

  // 可召对：与玩家同一所在地·在世·在任·无阻状态
  var playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital || '京师');
  var chars = (GM.chars||[]).filter(function(c){
    if (!c || c.isPlayer) return false;
    if (c.alive === false) return false;
    if (c.imprisoned || c.exiled || c.retired || c.mourning || c.fled || c.missing) return false;
    if (c._travelTo) return false; // 在赶路
    var loc = c.location || playerLoc;
    var sameLoc = (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (loc === playerLoc);
    if (!sameLoc) return false;
    return !!(c.officialTitle || c.title);
  }).sort(function(a,b){
    return (b.importance||0) + (b.loyalty||0)*0.15 - ((a.importance||0) + (a.loyalty||0)*0.15);
  });

  var _tsT = (typeof getTSText === 'function') ? getTSText : null;
  var issues = (GM.currentIssues||[]).filter(function(i){ return i.status !== 'resolved'; })
    .sort(function(a,b){ return (b.raisedTurn||0) - (a.raisedTurn||0); });

  var exist = document.getElementById('mizhao-picker'); if (exist) exist.remove();
  var overlay = document.createElement('div');
  overlay.id = 'mizhao-picker';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,5,0.88);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  overlay.onclick = function(e){ if (e.target === overlay) overlay.remove(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'width:min(94vw,960px);max-height:80vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  // 状态容器
  var state = { selectedChars: [], selectedIssue: prefilledIssueId || null };

  var h = '';
  h += '<div style="padding:0.8rem 1.3rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.06),transparent);">';
  h += '<button onclick="document.getElementById(\'mizhao-picker\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.3rem 0.85rem;cursor:pointer;font-size:0.82rem;border-radius:3px;letter-spacing:0.12em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 返 回</button>';
  h += '<div style="flex:1;text-align:center;font-size:1.15rem;letter-spacing:0.5rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;">选 择 议 政 大 臣 与 核 心 议 题</div>';
  h += '<div style="width:4rem;"></div>';
  h += '</div>';

  h += '<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;padding:0.9rem 1rem;overflow:hidden;">';
  // 左：大臣
  h += '<div style="display:flex;flex-direction:column;border:1px solid rgba(201,168,76,0.25);border-radius:4px;overflow:hidden;">';
  h += '<div style="padding:0.45rem 0.8rem;font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;border-bottom:1px solid rgba(201,168,76,0.2);background:rgba(201,168,76,0.04);font-family:\'STKaiti\',\'KaiTi\',serif;">请 选 择 大 臣</div>';
  h += '<div id="mz-chars" style="flex:1;overflow-y:auto;padding:0.5rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
  if (chars.length === 0) {
    h += '<div style="text-align:center;padding:2rem;color:var(--txt-d);font-size:0.8rem;">京中无可召之臣</div>';
  } else {
    chars.forEach(function(c){
      var safeName = String(c.name).replace(/'/g, "\\'");
      h += '<div class="mz-char-card" data-name="'+_esc(c.name)+'" onclick="_mzToggleChar(this,\''+safeName+'\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.65rem;margin-bottom:0.35rem;background:rgba(40,30,18,0.6);border:1px solid rgba(201,168,76,0.2);border-radius:3px;cursor:pointer;transition:all 0.15s;">';
      var _avatar = (c.name||'?').charAt(0);
      h += '<div style="width:38px;height:38px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg,#5a4a2d,#3d2f1a);border:1px solid var(--gold-d);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.1rem;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(_avatar)+'</div>';
      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-size:0.92rem;color:var(--gold-l);font-weight:600;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(c.name||'')+'</div>';
      h += '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_esc((c.officialTitle||c.title||'')+(c.party?' · '+c.party:''))+'</div>';
      h += '</div>';
      h += '</div>';
    });
  }
  h += '</div></div>';

  // 右：议题
  h += '<div style="display:flex;flex-direction:column;border:1px solid rgba(201,168,76,0.25);border-radius:4px;overflow:hidden;">';
  h += '<div style="padding:0.45rem 0.8rem;font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;border-bottom:1px solid rgba(201,168,76,0.2);background:rgba(201,168,76,0.04);font-family:\'STKaiti\',\'KaiTi\',serif;">请 选 择 一 个 议 题</div>';
  h += '<div id="mz-issues" style="flex:1;overflow-y:auto;padding:0.5rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
  if (issues.length === 0) {
    h += '<div style="text-align:center;padding:2rem;color:var(--txt-d);font-size:0.8rem;">当前无待议要务</div>';
  } else {
    issues.forEach(function(iss){
      var safeIid = String(iss.id||'').replace(/'/g, "\\'");
      var dateStr = iss.raisedDate || (_tsT ? _tsT(iss.raisedTurn||1) : ('第'+(iss.raisedTurn||1)+'回合'));
      var preSel = String(iss.id) === String(prefilledIssueId);
      h += '<div class="mz-issue-card" data-id="'+_esc(safeIid)+'" onclick="_mzSelectIssue(this,\''+safeIid+'\')" style="padding:0.6rem 0.8rem;margin-bottom:0.4rem;background:'+(preSel?'linear-gradient(180deg,#f4e8cc,#e8dbb4)':'rgba(244,232,204,0.88)')+';border:'+(preSel?'2px solid #c9a85f':'1px solid #b89a73')+';border-radius:3px;cursor:pointer;transition:all 0.15s;">';
      h += '<div style="font-weight:700;font-size:0.92rem;color:#3d2f1a;margin-bottom:0.2rem;line-height:1.4;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(iss.title||'')+'</div>';
      h += '<div style="font-size:0.7rem;color:#8b7355;">'+_esc(dateStr)+'</div>';
      h += '</div>';
    });
  }
  h += '</div></div>';
  h += '</div>'; // /grid

  // 底部操作
  h += '<div style="padding:0.65rem 1.3rem;display:flex;justify-content:center;align-items:center;gap:1rem;border-top:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,transparent,rgba(201,168,76,0.04));">';
  h += '<span id="mz-hint" style="font-size:0.72rem;color:var(--txt-d);">· 未选 ·</span>';
  h += '<button id="mz-next" onclick="_mzProceed()" disabled style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold-d);color:var(--gold-d);padding:0.5rem 1.8rem;cursor:not-allowed;font-size:0.92rem;letter-spacing:0.3em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;opacity:0.6;">下 一 步</button>';
  h += '</div>';

  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  window._mzState = state;
}

function _mzToggleChar(el, name) {
  var s = window._mzState; if (!s) return;
  var idx = s.selectedChars.indexOf(name);
  if (idx >= 0) {
    s.selectedChars.splice(idx, 1);
    el.style.background = 'rgba(40,30,18,0.6)';
    el.style.border = '1px solid rgba(201,168,76,0.2)';
  } else {
    // 不限人数·依序叠加
    s.selectedChars.push(name);
    el.style.background = 'linear-gradient(180deg,rgba(201,168,76,0.22),rgba(201,168,76,0.08))';
    el.style.border = '1px solid var(--gold)';
  }
  _mzUpdateHint();
}

function _mzSelectIssue(el, issueId) {
  var s = window._mzState; if (!s) return;
  // 清除旧选中
  document.querySelectorAll('.mz-issue-card').forEach(function(c){
    c.style.background = 'rgba(244,232,204,0.88)';
    c.style.border = '1px solid #b89a73';
  });
  s.selectedIssue = issueId;
  el.style.background = 'linear-gradient(180deg,#f4e8cc,#e8dbb4)';
  el.style.border = '2px solid #c9a85f';
  _mzUpdateHint();
}

function _mzUpdateHint() {
  var s = window._mzState; if (!s) return;
  var hint = document.getElementById('mz-hint');
  var btn = document.getElementById('mz-next');
  var ready = s.selectedChars.length >= 1 && s.selectedIssue;
  if (hint) hint.textContent = '· 已选 ' + s.selectedChars.length + ' 臣 · ' + (s.selectedIssue ? '1 题' : '0 题') + ' ·';
  if (btn) {
    btn.disabled = !ready;
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.style.opacity = ready ? '1' : '0.6';
    btn.style.color = ready ? 'var(--gold-l)' : 'var(--gold-d)';
    btn.style.borderColor = ready ? 'var(--gold)' : 'var(--gold-d)';
  }
}

function _mzProceed() {
  var s = window._mzState; if (!s) return;
  if (s.selectedChars.length < 1 || !s.selectedIssue) return;
  var overlay = document.getElementById('mizhao-picker'); if (overlay) overlay.remove();
  _openMiZhaoDialogue(s.selectedChars, s.selectedIssue);
}

// 独召问对·不限人数·依序流式·初始 2 轮·玩家发言后再追 2 轮
function _openMiZhaoDialogue(charNames, issueId) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var GM = window.GM || {};
  var issue = (GM.currentIssues||[]).find(function(i){ return String(i.id) === String(issueId); });
  if (!issue) { if (typeof toast === 'function') toast('议题已失效'); return; }

  var chars = charNames.map(function(n){ return (GM.chars||[]).find(function(c){ return c.name === n; }); }).filter(Boolean);
  if (chars.length < 1) { if (typeof toast === 'function') toast('无可召之臣'); return; }

  var exist = document.getElementById('mizhao-dialog'); if (exist) exist.remove();
  var overlay = document.createElement('div');
  overlay.id = 'mizhao-dialog';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,5,0.88);z-index:10001;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

  var panel = document.createElement('div');
  // 固定尺寸·聊天区内部滚动·面板不随消息数伸缩
  panel.style.cssText = 'width:min(94vw,920px);display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  var h = '';
  h += '<div style="padding:0.7rem 1.2rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.06),transparent);flex-shrink:0;">';
  h += '<button onclick="_mzEndDialogue()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.3rem 0.8rem;cursor:pointer;font-size:0.82rem;border-radius:3px;letter-spacing:0.12em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 退 朝</button>';
  h += '<div style="flex:1;text-align:center;font-size:1.05rem;letter-spacing:0.45rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;">独 召 密 问 · '+_esc(issue.title||'')+'</div>';
  h += '<button onclick="_mzShowSummary()" title="建言要点：AI 归总每位大臣之主张，陛下可择一纳入诏书建议库" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold-d);color:var(--gold);padding:0.3rem 0.8rem;cursor:pointer;font-size:0.78rem;border-radius:3px;letter-spacing:0.1em;font-family:\'STKaiti\',\'KaiTi\',serif;">建 言 要 点</button>';
  h += '</div>';

  h += '<div style="padding:0.6rem 1.2rem;background:rgba(201,168,76,0.025);border-bottom:1px solid rgba(201,168,76,0.15);font-size:0.8rem;color:var(--txt-s);line-height:1.7;font-family:\'STKaiti\',\'KaiTi\',serif;display:flex;gap:0.5rem;align-items:center;flex-shrink:0;">';
  h += '<span style="color:var(--gold);flex-shrink:0;">议题 · </span><span style="flex:1;">' + _esc(String(issue.description||'').slice(0, 200)) + (String(issue.description||'').length > 200 ? '…' : '') + '</span>';
  h += '</div>';

  // 浮动划选按钮（选文字后显示）·mousedown preventDefault 防止按钮点击清除选区
  h += '<div id="mz-selbtn" style="position:absolute;display:none;z-index:10;background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.3rem 0.7rem;cursor:pointer;font-size:0.78rem;letter-spacing:0.1em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;box-shadow:0 3px 10px rgba(0,0,0,0.55);user-select:none;" onmousedown="event.preventDefault();" onclick="_mzCaptureSelection()">划 入 诏 书</div>';

  h += '<div id="mz-dlg-body" style="height:420px;overflow-y:auto;overflow-x:hidden;padding:1rem 1.3rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;background:rgba(0,0,0,0.15);"></div>';

  // 追问输入
  h += '<div id="mz-input-bar" style="padding:0.7rem 1.2rem;border-top:1px solid rgba(201,168,76,0.2);display:flex;gap:0.6rem;background:linear-gradient(180deg,transparent,rgba(201,168,76,0.04));opacity:0.5;pointer-events:none;flex-shrink:0;">';
  h += '<input type="text" id="mz-dlg-input" placeholder="大臣奏对中…" disabled style="flex:1;background:rgba(40,30,18,0.6);border:1px solid var(--gold-d);color:var(--gold-l);padding:0.55rem 0.85rem;font-size:0.88rem;font-family:\'STKaiti\',\'KaiTi\',serif;border-radius:3px;outline:none;" onkeydown="if(event.key===\'Enter\')_mzSendQuery()">';
  h += '<button id="mz-send-btn" disabled onclick="_mzSendQuery()" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.5rem 1.4rem;cursor:pointer;font-size:0.9rem;letter-spacing:0.3em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;">发 问</button>';
  h += '</div>';

  panel.style.position = 'relative';
  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // 选文字监听·缓存文字·按钮相对 panel 定位
  var body = document.getElementById('mz-dlg-body');
  if (body) {
    body.addEventListener('mouseup', function(){
      setTimeout(function(){
        var sel = window.getSelection();
        var btn = document.getElementById('mz-selbtn');
        if (!btn) return;
        var txt = sel ? sel.toString().trim() : '';
        if (!txt) { btn.style.display = 'none'; window._mzSelCache = ''; return; }
        // 缓存文字·防止点击按钮后选区丢失
        window._mzSelCache = txt;
        try {
          var rng = sel.getRangeAt(0);
          var rect = rng.getBoundingClientRect();
          var pRect = panel.getBoundingClientRect();
          btn.style.display = 'block';
          btn.style.top = Math.max(4, (rect.top - pRect.top - 34)) + 'px';
          btn.style.left = Math.max(8, Math.min(pRect.width - 96, rect.left - pRect.left + rect.width/2 - 40)) + 'px';
        } catch(_){}
      }, 10);
    });
    // 点击非选中区域时隐藏按钮
    body.addEventListener('mousedown', function(e){
      if (e.target && e.target.id === 'mz-selbtn') return;
      var btn = document.getElementById('mz-selbtn');
      if (btn) btn.style.display = 'none';
    });
  }

  window._mzDlg = {
    chars: chars,
    issue: issue,
    history: [],              // [{role:'player'|charName, content:''}]
    perMinisterReplies: {},   // name -> [reply1, reply2, ...]
    slotIdx: 0,               // 当前发言槽号·每次发言后 +1
    maxSlot: 2 * chars.length,// 初始 2 轮 × N 臣
    extraRoundsPerQuery: 2,
    speaking: false
  };
  chars.forEach(function(c){ window._mzDlg.perMinisterReplies[c.name] = []; });

  _mzProcessQueue();
}

function _mzEndDialogue() {
  // 记忆归档 + 纪事档案 + 关闭
  try {
    var d = window._mzDlg;
    if (!d) { var el0=document.getElementById('mizhao-dialog'); if(el0)el0.remove(); return; }
    var GM = window.GM || {};
    var issueTitle = (d.issue && d.issue.title) || '议题';
    // 1. NPC 记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      d.chars.forEach(function(c){
        var lines = d.perMinisterReplies[c.name] || [];
        if (lines.length > 0) {
          var summary = lines.join('｜').slice(0, 120);
          NpcMemorySystem.remember(c.name, '御前独召·议「' + issueTitle + '」·臣奏曰：' + summary, '敬', 7, '天子', { type: 'dialogue', source: 'witnessed', credibility: 100 });
        }
      });
    }
    // 2. 纪事档案（每位大臣一条·供推演读取）
    if (!GM.jishiRecords) GM.jishiRecords = [];
    d.chars.forEach(function(c){
      var lines = d.perMinisterReplies[c.name] || [];
      if (lines.length === 0) return;
      GM.jishiRecords.push({
        turn: GM.turn || 1,
        char: c.name,
        playerSaid: '独召密问·议「' + issueTitle + '」',
        npcSaid: lines.join('\n'),
        mode: 'mizhao',
        issueId: (d.issue && d.issue.id) || '',
        issueTitle: issueTitle
      });
    });
    // 3. 起居注（简短记录召对事实）
    if (!GM.qijuHistory) GM.qijuHistory = [];
    var _tsT = (typeof getTSText === 'function') ? getTSText(GM.turn || 1) : '';
    GM.qijuHistory.unshift({
      turn: GM.turn || 1,
      date: _tsT,
      category: '问对',
      content: '独召密问·议「' + issueTitle + '」·召见' + d.chars.map(function(c){return c.name;}).join('、')
    });
    if (typeof addEB === 'function') addEB('问对', '独召密问·议' + issueTitle + '·' + d.chars.length + '臣奏对毕');
  } catch(_){}
  var el = document.getElementById('mizhao-dialog'); if (el) el.remove();
  window._mzDlg = null;
}

function _mzProcessQueue() {
  var d = window._mzDlg; if (!d) return;
  if (d.speaking) return;
  if (d.slotIdx >= d.maxSlot) {
    // 轮次用尽·等玩家输入或退朝
    _mzEnableInput(true);
    _mzAddSystemLine('· 群臣已进言·陛下若欲再问·请续发之；不复发问则此番独召终止 ·');
    return;
  }
  _mzEnableInput(false);
  d.speaking = true;
  var slotIdx = d.slotIdx;
  var charIdx = slotIdx % d.chars.length;
  var ch = d.chars[charIdx];
  var roundNum = Math.floor(slotIdx / d.chars.length) + 1;
  d.slotIdx += 1;

  var body = document.getElementById('mz-dlg-body');
  if (!body) { d.speaking = false; return; }
  var blockId = 'mz-reply-' + slotIdx;
  body.insertAdjacentHTML('beforeend', _mzRenderMinisterBlock(ch, blockId, roundNum));
  body.scrollTop = body.scrollHeight;

  _mzSpeakMinister(ch, blockId, roundNum).then(function(){
    d.speaking = false;
    setTimeout(_mzProcessQueue, 180);
  }).catch(function(){
    d.speaking = false;
    setTimeout(_mzProcessQueue, 180);
  });
}

function _mzEnableInput(enable) {
  var inp = document.getElementById('mz-dlg-input');
  var btn = document.getElementById('mz-send-btn');
  var bar = document.getElementById('mz-input-bar');
  if (inp) { inp.disabled = !enable; inp.placeholder = enable ? '陛下垂问…（Enter 发送）' : '大臣奏对中…'; }
  if (btn) btn.disabled = !enable;
  if (bar) { bar.style.opacity = enable ? '1' : '0.5'; bar.style.pointerEvents = enable ? 'auto' : 'none'; }
  if (enable && inp) inp.focus();
}

function _mzAddSystemLine(text) {
  var body = document.getElementById('mz-dlg-body'); if (!body) return;
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s);};
  body.insertAdjacentHTML('beforeend', '<div style="text-align:center;margin:0.8rem 0;font-size:0.74rem;color:var(--txt-d);font-style:italic;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(text)+'</div>');
  body.scrollTop = body.scrollHeight;
}

function _mzRenderMinisterBlock(c, blockId, roundNum) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var avatar = (c.name||'?').charAt(0);
  return '<div style="margin-bottom:0.9rem;display:flex;gap:0.7rem;align-items:flex-start;">'
    + '<div style="width:42px;height:42px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg,#5a4a2d,#3d2f1a);border:1px solid var(--gold-d);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.15rem;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(avatar)+'</div>'
    + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:0.86rem;color:var(--gold-l);font-family:\'STKaiti\',\'KaiTi\',serif;margin-bottom:0.2rem;"><b>'+_esc(c.name||'')+'</b> <span style="color:var(--txt-d);font-size:0.7rem;">· '+_esc(c.officialTitle||c.title||'')+' · 第'+roundNum+'言</span></div>'
      + '<div id="'+blockId+'" style="background:rgba(40,30,18,0.45);border:1px solid rgba(201,168,76,0.2);border-left:3px solid var(--gold-d);padding:0.55rem 0.85rem;font-size:0.86rem;color:var(--txt-l);line-height:1.85;font-family:\'STKaiti\',\'KaiTi\',serif;border-radius:3px;min-height:1.5em;user-select:text;"><span style="color:var(--txt-d);font-style:italic;">· 沉吟中 ·</span></div>'
    + '</div>'
  + '</div>';
}

function _mzSpeakMinister(ch, blockId, roundNum) {
  var d = window._mzDlg; if (!d) return Promise.reject();
  var P = window.P || {};
  var GM = window.GM || {};
  var target = document.getElementById(blockId);

  var brief = (typeof getCharacterPersonalityBrief === 'function') ? getCharacterPersonalityBrief(ch) : ch.name;
  var memCtx = (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) ? NpcMemorySystem.getMemoryContext(ch.name) : '';

  // ── 与问对(wendui)一致的基础身份/性格/立场/记忆构建 ──
  var sysP = '你是' + ch.name + '·' + (ch.officialTitle||ch.title||'') + '·当前在京师御前独对。\n性格：' + brief;
  if (ch.stance) sysP += '\n政治立场：' + ch.stance;
  if (ch.party) sysP += '\n党派：' + ch.party + (ch.partyRank?'·'+ch.partyRank:'');
  if (ch.loyalty != null) sysP += '\n对君忠诚：' + ch.loyalty;
  if (memCtx) sysP += '\n近期心绪：' + memCtx;
  if (typeof _buildTemporalConstraint === 'function') { try { sysP += _buildTemporalConstraint(ch); } catch(_){} }

  // 议题完整上下文
  sysP += '\n\n【议题】' + (d.issue.title||'') + '\n' + String(d.issue.description||'').slice(0, 400);
  if (d.issue.narrative) sysP += '\n' + String(d.issue.narrative).slice(0, 400);
  if (d.issue.longTermConsequences && typeof d.issue.longTermConsequences === 'object') {
    sysP += '\n\n【风势推演参考】';
    Object.keys(d.issue.longTermConsequences).forEach(function(k){ sysP += '\n' + k + '：' + d.issue.longTermConsequences[k]; });
  }

  // ── 独召特色：大臣间对话历史 ──
  var histText = '';
  if (d.history.length > 0) {
    histText = '\n\n【已往对答·可附和可驳斥可补充】\n' + d.history.slice(-10).map(function(m){
      return (m.role === 'player' ? '陛下' : m.role) + '曰：' + m.content;
    }).join('\n');
  }

  var selfReplies = d.perMinisterReplies[ch.name] || [];
  var selfHint = '';
  if (selfReplies.length > 0) {
    selfHint = '\n\n你之前已进言 ' + selfReplies.length + ' 次·今番须接续或深化前论·不得重复';
  }
  sysP += histText + selfHint;

  // ── 字数提示（复用问对字数设置 wdMin/wdMax）──
  var wdHint = (typeof _aiDialogueWordHint === 'function') ? _aiDialogueWordHint('wd') : '（每条发言约 120-250 字）';

  // ── JSON 返回规范（与问对一致）──
  sysP += '\n\n【奏对要求】';
  sysP += '\n1. 以尔角色口吻·臣/末将/罪臣等称谓得当';
  sysP += '\n2. 古典白话' + wdHint;
  sysP += '\n3. 针对议题具体表态·切忌套话';
  sysP += '\n4. 可进言陈策·可委婉劝阻·必须明立场';
  sysP += '\n5. 若他臣已有奏对·可附和·可反驳·可补充';
  sysP += '\n\n【返回 JSON 格式】';
  sysP += '\n{';
  sysP += '\n  "reply": "奏对正文·古典白话",';
  sysP += '\n  "loyaltyDelta": -3~+3 的整数·无明显变化填 0,';
  sysP += '\n  "emotionState": "镇定/恭敬/紧张/焦虑/激动/愤怒 任选一",';
  sysP += '\n  "toneEffect": "一句话描述此番奏对之态·如 \'恭敬中略含忧色\' (可留空)",';
  sysP += '\n  "suggestions": [{"topic":"议题要点","content":"具体施政建言·50-80字·可入诏书建议库"}],';
  sysP += '\n  "memoryImpact": {"event":"从大臣视角简述此次被召见·30字内","emotion":"敬/忧/惧/怒/喜/恨/平","importance":1-10}';
  sysP += '\n}';
  sysP += '\n只返回 JSON·无前言无解释·reply 字段务必填写。';

  // 首次 chunk 到达前保留"沉吟中"占位
  var firstChunkReceived = false;
  var _extractReply = function(raw) {
    if (!raw) return '';
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (parsed && parsed.reply) return { reply: String(parsed.reply).trim(), parsed: parsed };
    return { reply: String(raw).trim(), parsed: null };
  };
  var _finish = function(rawTxt) {
    var res = _extractReply(rawTxt);
    var finalTxt = res.reply || ('臣' + ch.name + '叩首·请容臣三思。');
    var parsed = res.parsed;
    // 对话模式 validator 接入（非阻断）——检查 reply 必填+字段漂移
    if (parsed && window.TM && TM.validateAIOutput) {
      try { TM.validateAIOutput(parsed, 'mz-dialogue-' + (ch.name||'?'), 'dialogue'); } catch(_vme){}
    }
    if (target) target.textContent = finalTxt;
    d.history.push({ role: ch.name, content: finalTxt });
    if (!d.perMinisterReplies[ch.name]) d.perMinisterReplies[ch.name] = [];
    d.perMinisterReplies[ch.name].push(finalTxt);

    // 处理忠诚/情绪/建议/记忆（与问对一致）
    try {
      if (parsed) {
        // 忠诚微调
        var loyD = parseInt(parsed.loyaltyDelta, 10); if (!isNaN(loyD) && loyD !== 0) {
          var clamp = function(v,l,h){return Math.max(l, Math.min(h, v));};
          ch.loyalty = clamp((ch.loyalty || 50) + clamp(loyD, -3, 3), 0, 100);
          if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) {
            try { OpinionSystem.addEventOpinion(ch.name, '玩家', loyD * 3, '独召·' + (loyD>0?'受信任':'被冷落')); } catch(_){}
          }
        }
        // 建议入诏书建议库
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
          if (!GM._edictSuggestions) GM._edictSuggestions = [];
          parsed.suggestions.forEach(function(sg){
            if (!sg) return;
            if (typeof sg === 'string') {
              GM._edictSuggestions.push({ source: '独召', from: ch.name, content: sg, turn: GM.turn||1, used: false });
            } else if (sg.content) {
              GM._edictSuggestions.push({ source: '独召', from: ch.name, topic: sg.topic||(d.issue.title||''), content: sg.content, turn: GM.turn||1, used: false });
            }
          });
          try { if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions(); } catch(_){}
        }
        // NPC 记忆（AI 返回优先）
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          var pm = parsed.memoryImpact || {};
          var evt = pm.event || ('御前独召·议「'+(d.issue.title||'')+'」·'+finalTxt.slice(0,25));
          var emo = pm.emotion || (loyD>0?'敬':loyD<0?'忧':'平');
          var imp = Math.max(1, Math.min(10, parseFloat(pm.importance) || 6));
          NpcMemorySystem.remember(ch.name, evt, emo, imp, '天子', { type:'dialogue', source:'witnessed', credibility:100 });
        }
      }
    } catch(_finishE){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_finishE, '独召] finish 处理异常') : console.warn('[独召] finish 处理异常', _finishE); }
  };

  // ── max_tokens 与 tier 策略（与问对/朝议一致·次 API 配置则走次 API·否则主 API）──
  var maxTok = (typeof _aiDialogueTok === 'function') ? _aiDialogueTok('wd', 1) : 800;
  var _tier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined;
  var apiOpts = { tier: _tier };
  apiOpts.onChunk = function(txt) {
    if (!txt) return;
    if (!firstChunkReceived) {
      firstChunkReceived = true;
      if (target) target.textContent = '';
    }
    // 尝试流式提取 reply 字段显示（避免玩家看到裸 JSON）
    var disp = txt;
    try {
      var m = txt.match(/"reply"\s*:\s*"([^"]*)/);
      if (m && m[1]) disp = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } catch(_){}
    if (target) target.textContent = disp;
    var body = document.getElementById('mz-dlg-body'); if (body) body.scrollTop = body.scrollHeight;
  };

  if (typeof callAIMessagesStream === 'function' && P.ai && P.ai.key) {
    return callAIMessagesStream([{role:'user', content: sysP}], maxTok, apiOpts).then(function(finalTxt){
      _finish(finalTxt);
    }).catch(function(err){
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(err, '独召-stream') : console.warn('[独召] stream 失败·回退 callAI', err);
      if (typeof callAI === 'function') {
        return callAI(sysP, maxTok, null, _tier).then(function(reply){ _finish(reply); }).catch(function(){
          if (target) target.textContent = '臣' + ch.name + '叩首·API 异常·请容臣三思后奏。';
        });
      } else {
        if (target) target.textContent = '臣' + ch.name + '叩首·请容臣三思后奏。';
      }
    });
  } else if (typeof callAI === 'function' && P.ai && P.ai.key) {
    return callAI(sysP, maxTok, null, _tier).then(function(reply){ _finish(reply); }).catch(function(){
      if (target) target.textContent = '臣' + ch.name + '叩首·请容臣三思后奏。';
    });
  } else {
    if (target) target.textContent = '臣' + ch.name + '叩首·API 未配置·容臣书面具奏。';
    return Promise.resolve();
  }
}

function _mzSendQuery() {
  var d = window._mzDlg; if (!d) return;
  if (d.speaking) return;
  var inp = document.getElementById('mz-dlg-input');
  if (!inp || !inp.value.trim()) return;
  var q = inp.value.trim();
  inp.value = '';
  var body = document.getElementById('mz-dlg-body');
  if (body) {
    var esc = (typeof escHtml==='function')?escHtml:function(s){return String(s);};
    body.insertAdjacentHTML('beforeend', '<div style="margin:0.6rem 0 1rem;text-align:right;"><span style="display:inline-block;background:rgba(201,168,76,0.1);border:1px solid var(--gold-d);color:var(--gold-l);padding:0.5rem 0.9rem;border-radius:3px;font-size:0.86rem;font-family:\'STKaiti\',\'KaiTi\',serif;max-width:75%;line-height:1.8;user-select:text;">陛下曰：' + esc(q) + '</span></div>');
    body.scrollTop = body.scrollHeight;
  }
  d.history.push({ role: 'player', content: q });
  // 续追 extraRoundsPerQuery 轮 × N 臣
  d.maxSlot += d.extraRoundsPerQuery * d.chars.length;
  _mzProcessQueue();
}

// 建言要点·AI 归总每人主张→陛下择一纳入诏书建议库
function _mzShowSummary() {
  var d = window._mzDlg; if (!d) return;
  if (d.speaking) { if (typeof toast === 'function') toast('大臣奏对中·稍候'); return; }
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s);};

  var exist = document.getElementById('mz-summary-panel'); if (exist) exist.remove();
  var layer = document.createElement('div');
  layer.id = 'mz-summary-panel';
  layer.style.cssText = 'position:fixed;inset:0;background:rgba(10,8,4,0.85);z-index:10010;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  layer.onclick = function(e){ if (e.target === layer) layer.remove(); };

  var p = document.createElement('div');
  p.style.cssText = 'width:min(90vw,720px);max-height:80vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  var h = '<div style="padding:0.75rem 1.2rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:rgba(201,168,76,0.04);">';
  h += '<div style="flex:1;text-align:center;font-size:1.05rem;letter-spacing:0.4rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;">建 言 要 点</div>';
  h += '<button onclick="document.getElementById(\'mz-summary-panel\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);width:1.8rem;height:1.8rem;cursor:pointer;border-radius:3px;">✕</button>';
  h += '</div>';
  h += '<div id="mz-summary-body" style="flex:1;overflow-y:auto;padding:1rem 1.3rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
  h += '<div style="text-align:center;color:var(--txt-d);font-size:0.85rem;padding:2rem;font-style:italic;font-family:\'STKaiti\',\'KaiTi\',serif;">· 史官归纳中 ·</div>';
  h += '</div>';
  p.innerHTML = h;
  layer.appendChild(p);
  document.body.appendChild(layer);

  // 并发为每位大臣调 AI 归纳要点
  var body = document.getElementById('mz-summary-body');
  body.innerHTML = '';
  var tasks = d.chars.map(function(c){
    var replies = d.perMinisterReplies[c.name] || [];
    if (replies.length === 0) return null;
    var containerId = 'mz-sum-' + c.name.replace(/[^a-zA-Z0-9]/g,'_');
    body.insertAdjacentHTML('beforeend', _mzRenderSummaryBlock(c, containerId, replies.length));
    return { ch: c, replies: replies, containerId: containerId };
  }).filter(Boolean);

  tasks.forEach(function(t){
    _mzSummarizeOne(t.ch, t.replies, t.containerId, d.issue);
  });
}

function _mzRenderSummaryBlock(c, containerId, replyCount) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s);};
  return '<div style="margin-bottom:1rem;padding:0.8rem 1rem;background:rgba(40,30,18,0.4);border:1px solid rgba(201,168,76,0.25);border-left:3px solid var(--gold-d);border-radius:3px;">'
    + '<div style="font-size:0.88rem;color:var(--gold-l);margin-bottom:0.35rem;font-family:\'STKaiti\',\'KaiTi\',serif;"><b>' + _esc(c.name||'') + '</b> <span style="color:var(--txt-d);font-size:0.7rem;">· ' + _esc(c.officialTitle||c.title||'') + ' · 奏对 ' + replyCount + ' 次</span></div>'
    + '<div id="' + containerId + '" style="font-size:0.83rem;line-height:1.85;color:var(--txt-s);font-family:\'STKaiti\',\'KaiTi\',serif;min-height:1.5em;"><span style="color:var(--txt-d);font-style:italic;">· 归纳中 ·</span></div>'
    + '<div id="' + containerId + '-act" style="margin-top:0.5rem;text-align:right;display:none;">'
      + '<button onclick="_mzPickToEdict(\'' + containerId + '\',\'' + _esc(c.name).replace(/\'/g,"\\\'") + '\')" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.3rem 0.9rem;cursor:pointer;font-size:0.78rem;letter-spacing:0.15em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;">纳 入 诏 书 建 议 库</button>'
    + '</div>'
  + '</div>';
}

function _mzSummarizeOne(ch, replies, containerId, issue) {
  var P = window.P || {};
  var target = document.getElementById(containerId);
  var actBar = document.getElementById(containerId + '-act');
  var joined = replies.join('\n');

  var prompt = '以下为 ' + ch.name + '(' + (ch.officialTitle||ch.title||'') + ') 在御前独召时就「' + (issue.title||'议题') + '」所进之奏对：\n\n' + joined;
  prompt += '\n\n【任务】请以一段 60-120 字的古典白话·精要归纳其立场·核心主张·建议策略。';
  prompt += '\n不用"臣"字·改为第三人称描述(如"该臣主张…")。直接输出归纳正文·无前言。';

  if (typeof callAI === 'function' && P.ai && P.ai.key) {
    var _sumTier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined;
    callAI(prompt, 400, null, _sumTier).then(function(reply){
      var txt = (reply || '').trim() || (ch.name + '主张：' + replies[0].slice(0, 60));
      if (target) target.textContent = txt;
      if (actBar) actBar.style.display = 'block';
      target.dataset.summary = txt;
    }).catch(function(){
      if (target) target.textContent = ch.name + ' 主张（归纳失败，取首言）：' + (replies[0]||'').slice(0, 60);
      if (actBar) actBar.style.display = 'block';
      target.dataset.summary = (replies[0]||'').slice(0, 60);
    });
  } else {
    var fb = ch.name + ' 主张（取首言）：' + (replies[0]||'').slice(0, 80);
    if (target) target.textContent = fb;
    if (actBar) actBar.style.display = 'block';
    target.dataset.summary = fb;
  }
}

function _mzPickToEdict(containerId, charName) {
  var target = document.getElementById(containerId); if (!target) return;
  var d = window._mzDlg;
  var summary = target.dataset.summary || target.textContent || '';
  var issueTitle = (d && d.issue && d.issue.title) || '议题';
  if (typeof GM === 'undefined' || !GM) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '独召·建言要点',
    from: charName,
    topic: issueTitle,
    content: summary,
    turn: GM.turn || 1,
    used: false
  });
  if (typeof toast === 'function') toast('「' + charName + '」之见已纳入诏书建议库');
  // 视觉反馈
  var actBar = document.getElementById(containerId + '-act');
  if (actBar) actBar.innerHTML = '<span style="color:var(--celadon-400,#7eb8a7);font-size:0.78rem;letter-spacing:0.15em;">· 已 纳 入 诏 书 建 议 库 ·</span>';
}

function _mzCaptureSelection() {
  // 优先读当前选区，回退到 mouseup 时缓存的文字（点击按钮后选区可能已清）
  var sel = window.getSelection();
  var txt = sel && sel.toString() ? sel.toString().trim() : '';
  if (!txt) txt = window._mzSelCache || '';
  if (!txt) {
    if (typeof toast === 'function') toast('请先划选一段大臣发言');
    return;
  }
  var d = window._mzDlg;
  var issueTitle = (d && d.issue && d.issue.title) || '议题';
  var GM = window.GM; if (!GM) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  // 尝试识别发言者（从选区最近的 bubble 的姓名标签）
  var fromName = '';
  try {
    var anc = sel && sel.anchorNode;
    while (anc && anc.nodeType !== 1) anc = anc.parentNode;
    while (anc) {
      if (anc.previousSibling && anc.previousSibling.textContent && /^[\u4e00-\u9fa5]+/.test(anc.previousSibling.textContent)) break;
      anc = anc.parentNode;
    }
    // 回溯到气泡外层的姓名 <b> 标签
    var parent = sel && sel.anchorNode ? sel.anchorNode.parentNode : null;
    while (parent) {
      var bold = parent.querySelector && parent.querySelector('b');
      if (bold && bold.textContent && bold.textContent.length < 10) { fromName = bold.textContent.trim(); break; }
      parent = parent.parentNode;
      if (parent === document.body) break;
    }
  } catch(_){}
  GM._edictSuggestions.push({
    source: '独召·划选',
    from: fromName || '独召群臣',
    topic: issueTitle,
    content: txt.slice(0, 800),
    turn: GM.turn || 1,
    used: false
  });
  if (typeof toast === 'function') toast('划选之语 (' + txt.length + ' 字) 已纳入诏书建议库');
  try { if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions(); } catch(_){}
  // 清除选择 + 隐藏浮按钮 + 清缓存
  try { if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch(_){}
  window._mzSelCache = '';
  var btn = document.getElementById('mz-selbtn'); if (btn) btn.style.display = 'none';
}

window.openMiZhaoPicker = openMiZhaoPicker;
window._mzToggleChar = _mzToggleChar;
window._mzSelectIssue = _mzSelectIssue;
window._mzUpdateHint = _mzUpdateHint;
window._mzProceed = _mzProceed;
window._mzSendQuery = _mzSendQuery;
window._mzEndDialogue = _mzEndDialogue;
window._mzShowSummary = _mzShowSummary;
window._mzPickToEdict = _mzPickToEdict;
window._mzCaptureSelection = _mzCaptureSelection;
