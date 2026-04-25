// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-player-core.js — 游戏运行时玩家操作 (R127 从 tm-player-actions.js L501-3303 拆出)
// 姊妹: tm-player-settings.js (L1-500·设置+API)
//       tm-hongyan-office.js (L3304-end·鸿雁+官制)
// 包含: ESC 暂停菜单+启动 API 加载+Electron·文苑·全局资源栏·人物志完整页 6-tab
//       openPause/openAbdication/openShiji/_shijiShowDetail/switchGTab/
//       addEB/_fmtEvt/_wyQualityStars/renderGameState/renwu* 系列
// ============================================================

// ============================================================
//  ESC暂停菜单
// ============================================================
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){
    e.preventDefault();
    // 2.8: 逐层关闭弹窗
    var _renwuOv=document.getElementById('_renwuPageOv');if(_renwuOv&&_renwuOv.classList.contains('open')){_renwuOv.classList.remove('open');return;}
    var _charPop=document.querySelector('.char-popup');if(_charPop){_charPop.remove();return;}
    var _urgentPop=document.querySelector('.notify-urgent');if(_urgentPop){_urgentPop.classList.add('closing');setTimeout(function(){_urgentPop.remove();},300);return;}
    if(_$("turn-modal").classList.contains("show")){closeTurnResult();return;}
    if(_$("settings-bg").classList.contains("show")){closeSettings();return;}
    if(_$("pause-bg").classList.contains("show")){closePause();return;}
    if(GM.running){openPause();return;}
    openSettings();return;
  }
  // 4.3: 快捷键系统（仅在游戏中且无弹窗时生效）
  if(!GM.running)return;
  if(_$("settings-bg").classList.contains("show")||_$("pause-bg").classList.contains("show"))return;
  if(_$("turn-modal").classList.contains("show"))return;
  if(document.querySelector('.modal-bg.show'))return;
  // 不在输入框中时才响应
  var tag=(document.activeElement||{}).tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  // 数字键1-9切标签
  var _tabMap={'1':'gt-edict','2':'gt-memorial','3':'gt-wendui','4':'gt-letter','5':'gt-biannian','6':'gt-office','7':'gt-qiju','8':'gt-jishi','9':'gt-shiji'};
  if(_tabMap[e.key]){var _tb=document.querySelector('.g-tab-btn');if(_tb)switchGTab(null,_tabMap[e.key]);return;}
  // Ctrl+S快速存档
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(typeof openSaveManager==='function')openSaveManager();return;}
});
function openPause(){
  // 回合推演中禁止暂停（防止状态竞争）
  if (GM._endTurnBusy) return;
  var _pi = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  _$("pause-bg").innerHTML="<div class=\"pause-menu\"><div class=\"pause-title\">\u3014 \u5929 \u547D \u3015</div><button class=\"pause-btn\" onclick=\"closePause()\">\u7EE7 \u7EED</button><button class=\"pause-btn\" onclick=\"closePause();openSaveManager()\">"+_pi('save',16)+" \u6848\u5377\u7BA1\u7406</button><button class=\"pause-btn\" onclick=\"closePause();openSettings()\">"+_pi('settings',16)+" \u8BBE \u7F6E</button><button class=\"pause-btn\" onclick=\"closePause();openShiji()\">"+_pi('history',16)+" \u53F2 \u8BB0</button><button class=\"pause-btn\" onclick=\"closePause();openAbdication()\">\u7985\u8BA9\u9000\u4F4D</button><button class=\"pause-btn\" style=\"color:var(--vermillion-400);\" onclick=\"closePause();backToLaunch()\">\u5F52\u53BB\u6765\u516E</button></div>";
  _$("pause-bg").classList.add("show");
}
function closePause(){_$("pause-bg").classList.remove("show");}

// N8: 退位/禅让系统
function openAbdication() {
  var pc = GM.chars && GM.chars.find(function(c){ return c.isPlayer; });
  if (!pc) { toast('未找到玩家角色'); return; }
  // 候选继承人：同势力存活角色
  var candidates = (GM.chars || []).filter(function(c) {
    return c.alive !== false && !c.isPlayer && c.faction === pc.faction;
  }).sort(function(a, b) { return (b.rankLevel || 9) - (a.rankLevel || 9); });
  var html = '<div style="padding:1.5rem;max-width:480px;">';
  html += '<div style="text-align:center;margin-bottom:1rem;"><div style="font-size:1.2rem;color:var(--gold);font-weight:700;">\u7985\u8BA9\u9000\u4F4D</div>';
  html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-top:0.3rem;">\u5C06\u5929\u5B50\u4E4B\u4F4D\u4F20\u4E88\u540E\u4EBA\uFF0C\u6B64\u4E3E\u4E0D\u53EF\u9006</div></div>';
  if (candidates.length === 0) {
    html += '<div style="color:var(--vermillion-400);text-align:center;">无合适继承人</div>';
  } else {
    html += '<div style="max-height:250px;overflow-y:auto;">';
    candidates.slice(0, 10).forEach(function(c, i) {
      var intel = c.intelligence || 50, admin = c.administration || 50;
      var _safeName = escHtml(c.name).replace(/'/g, '&#39;').replace(/\\/g, '\\\\');
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;margin-bottom:0.3rem;background:var(--bg-2);border-radius:6px;cursor:pointer;" onclick="_confirmAbdication(\'' + _safeName + '\')">';
      html += '<div><div style="font-size:0.85rem;font-weight:700;">' + escHtml(c.name) + '</div><div style="font-size:0.7rem;color:var(--txt-d);">' + escHtml(c.title || '') + ' \u667A' + intel + ' \u653F' + admin + '</div></div>';
      html += '<span style="font-size:0.75rem;color:var(--gold);">\u9009\u62E9</span></div>';
    });
    html += '</div>';
  }
  html += '<button class="bt bs" style="width:100%;margin-top:0.8rem;" onclick="this.closest(\'.modal-bg\').remove();">\u53D6\u6D88</button>';
  html += '</div>';
  var ov = document.createElement('div');
  ov.className = 'modal-bg show';
  ov.innerHTML = '<div class="modal" style="max-width:500px;">' + html + '</div>';
  document.body.appendChild(ov);
}
function _confirmAbdication(heirName) {
  if (!confirm('\u786E\u5B9A\u5C06\u5E1D\u4F4D\u7985\u8BA9\u7ED9' + heirName + '\uFF1F\u6B64\u4E3E\u4E0D\u53EF\u64A4\u56DE\u3002')) return;
  var pc = GM.chars.find(function(c){ return c.isPlayer; });
  var heir = findCharByName(heirName);
  if (!pc || !heir) return;
  // 禅让
  pc.isPlayer = false;
  pc.title = (pc.title || '') + '（太上皇）';
  heir.isPlayer = true;
  // 更新P.playerInfo——用继承人数据替换旧玩家信息
  P.playerInfo.characterName = heir.name;
  P.playerInfo.characterTitle = heir.title || heir.officialTitle || '';
  P.playerInfo.characterBio = heir.bio || '';
  P.playerInfo.characterPersonality = heir.personality || '';
  if (heir.faction) P.playerInfo.factionName = heir.faction;
  // 更新年号提示
  if (typeof addEB === 'function') addEB('\u7985\u8BA9', pc.name + '\u7985\u8BA9\u5E1D\u4F4D\u4E8E' + heir.name);
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
    NpcMemorySystem.addMemory(heir.name, '\u7EE7\u627F\u5E1D\u4F4D\uFF0C\u767B\u57FA\u79F0\u5E1D', 10, 'career');
  }
  // 关闭弹窗
  document.querySelectorAll('.modal-bg').forEach(function(m){ m.remove(); });
  toast('\u7985\u8BA9\u5B8C\u6210\uFF0C' + heir.name + '\u5DF2\u7EE7\u4F4D');
  if (typeof renderGameState === 'function') renderGameState();
}

// 史记浮动按钮
var _shijiPage=0,_shijiKw='',_shijiPageSize=10;
function openShiji(){
  if(!GM.shijiHistory||GM.shijiHistory.length===0){showTurnResult("<div style='text-align:center;padding:2rem;color:var(--txt-d);'>\u5c1a\u65e0\u53f2\u8bb0</div>");return;}
  _shijiPage=0;_shijiKw='';
  _renderShijiPanel();
}
function _renderShijiPanel(){
  var all=GM.shijiHistory.slice().reverse();
  var kw=(_shijiKw||'').trim().toLowerCase();
  var filtered=kw?all.filter(function(sj){return (sj.shizhengji||'').toLowerCase().indexOf(kw)>=0||(sj.time||'').toLowerCase().indexOf(kw)>=0||String(sj.turn).indexOf(kw)>=0;}):all;
  var total=filtered.length;
  var pages=Math.ceil(total/_shijiPageSize)||1;
  if(_shijiPage>=pages)_shijiPage=pages-1;
  var slice=filtered.slice(_shijiPage*_shijiPageSize,(_shijiPage+1)*_shijiPageSize);
  var html='<div style="display:flex;flex-direction:column;height:100%;">';
  // header
  html+='<div style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0.8rem;border-bottom:1px solid var(--bdr);flex-shrink:0">';
  html+='<strong style="color:var(--gold);font-size:1.05rem;">\u53f2\u8bb0 / \u8d77\u5c45\u6ce8</strong>';
  html+='<input id="shiji-kw" class="fd" style="flex:1;font-size:0.85rem" placeholder="\u641c\u7d22\u5173\u952e\u8bcd\u2026" value="'+(_shijiKw||'').replace(/"/g,'&quot;')+'" oninput="_shijiKw=this.value;_shijiPage=0;_renderShijiPanel()">';
  html+='<button class="bt bs bsm" onclick="_shijiExport()" title="\u5bfc\u51fa">\u2193 \u5bfc\u51fa</button>';
  html+='<button class="bt bs bsm" onclick="_historyCompare()" title="\u4E0E\u771F\u5B9E\u5386\u53F2\u5BF9\u6BD4">\u2696 \u5386\u53F2\u5BF9\u6BD4</button>';
  html+='<button class="bt bs bsm" onclick="closeTurnResult()">\u2715</button>';
  html+='</div>';
  // list
  html+='<div style="flex:1;overflow-y:auto;padding:0.5rem 0.8rem">';
  if(!slice.length){html+='<div style="text-align:center;padding:2rem;color:var(--txt-d);">\u65e0\u5339\u914d\u7ed3\u679c</div>';}
  slice.forEach(function(sj,i){
    var realIdx=GM.shijiHistory.length-1-(all.indexOf(sj));
    html+='<div class="cd" style="cursor:pointer;margin-bottom:0.4rem" onclick="_shijiShowDetail('+realIdx+')">';
    html+='<div style="display:flex;justify-content:space-between"><strong style="color:var(--gold-l)">T'+sj.turn+'</strong><span style="font-size:0.78rem;color:var(--txt-d)">'+sj.time+'</span></div>';
    html+='<div style="font-size:0.82rem;color:var(--txt-s);margin-top:0.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(sj.shizhengji||'')+'</div>';
    html+='</div>';
  });
  html+='</div>';
  // footer pagination
  html+='<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.5rem;border-top:1px solid var(--bdr);flex-shrink:0">';
  html+='<button class="bt bs bsm" '+((_shijiPage<=0)?'disabled':'')+' onclick="_shijiPage--;_renderShijiPanel()">\u2039</button>';
  html+='<span style="font-size:0.82rem;color:var(--txt-s)">'+(_shijiPage+1)+' / '+pages+'&nbsp;&nbsp;('+total+'\u6761)</span>';
  html+='<button class="bt bs bsm" '+((_shijiPage>=pages-1)?'disabled':'')+' onclick="_shijiPage++;_renderShijiPanel()">\u203a</button>';
  html+='</div>';
  html+='</div>';
  showTurnResult(html);
}
function _shijiShowDetail(idx){
  var sj=GM.shijiHistory[idx];
  if(!sj)return;
  var backBtn='<div style="text-align:center;margin-top:1rem"><button class="bt bs bsm" onclick="_renderShijiPanel()">\u8fd4\u56de\u5217\u8868</button></div>';
  showTurnResult((sj.html||'')+backBtn);
}
function _shijiExport(){
  var all=GM.shijiHistory.slice();
  var txt=all.map(function(sj){return '[T'+sj.turn+'] '+sj.time+'\n'+(sj.shizhengji||'');}).join('\n\n---\n\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast('\u2705 \u5df2\u590d\u5236\u5230\u526a\u8d34\u677f');}).catch(function(){_shijiDownload(txt);});}
  else _shijiDownload(txt);
}
// E11: 历史对比——调用AI比较游戏进程与真实历史
function _historyCompare() {
  if (!P.ai || !P.ai.key) { toast('需要配置AI才能使用历史对比'); return; }
  var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
  var dynasty = (sc && sc.dynasty) || P.dynasty || '';
  var era = (sc && sc.era) || '';
  var turnInfo = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
  // 收集游戏关键事件摘要
  var eventSummary = (GM.shijiHistory || []).slice(-5).map(function(sj) {
    return 'T' + sj.turn + '(' + sj.time + '): ' + (sj.shizhengji || '');
  }).join('\n');
  var currentState = '';
  if (GM.eraState) currentState += '阶段：' + (GM.eraState.dynastyPhase || '?');
  var factions = (GM.facs || []).map(function(f) { return f.name + '(实力' + (f.strength||50) + ')'; }).join('、');

  var prompt = '你是一位历史学家。以下是一个' + dynasty + (era ? '·' + era : '') + '时期的历史模拟游戏当前状态（' + turnInfo + '，第' + GM.turn + '回合）：\n\n'
    + '【当前国势】' + currentState + '\n'
    + '【各方势力】' + factions + '\n'
    + '【近期大事】\n' + eventSummary + '\n\n'
    + '请对比真实历史中同一时期实际发生的事件，分析：\n'
    + '1. 哪些方面与真实历史一致\n'
    + '2. 哪些方面出现了重大偏差（蝴蝶效应）\n'
    + '3. 如果继续按此趋势发展，历史走向会如何变化\n\n'
    + '用300-500字回答，注明具体史实依据。';

  // 显示loading
  showTurnResult('<div style="text-align:center;padding:3rem;"><div style="color:var(--gold);font-size:1rem;margin-bottom:1rem;">\u2696 \u5386\u53F2\u5BF9\u6BD4\u5206\u6790\u4E2D\u2026\u2026</div><div style="color:var(--txt-d);font-size:0.8rem;">AI\u6B63\u5728\u6BD4\u8F83\u6E38\u620F\u8FDB\u7A0B\u4E0E\u771F\u5B9E\u5386\u53F2</div></div>');

  callAI(prompt, 1500).then(function(resp) {
    var html = '<div style="padding:1rem;">';
    html += '<h3 style="color:var(--gold);margin-bottom:1rem;">\u2696 \u5386\u53F2\u5BF9\u6BD4\u5206\u6790</h3>';
    html += '<div style="font-size:0.85rem;color:var(--txt-s);line-height:1.8;white-space:pre-wrap;">' + escHtml(resp) + '</div>';
    html += '<div style="text-align:center;margin-top:1rem;"><button class="bt bs" onclick="_renderShijiPanel()">返回史记</button></div>';
    html += '</div>';
    showTurnResult(html);
  }).catch(function(err) {
    showTurnResult('<div style="text-align:center;padding:2rem;color:var(--red);">历史对比失败：' + escHtml(err.message) + '<br><button class="bt bs" onclick="_renderShijiPanel()">返回</button></div>');
  });
}

function _shijiDownload(txt){
  var a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='shiji_'+(GM.saveName||'export')+'.txt';
  a.click();
  toast('\u2705 \u5df2\u5bfc\u51fa');
}

// ============================================================
//  启动时加载API配置
// ============================================================
(function(){
  function _applyAiCfg(c) {
    if (!c) return;
    P.ai.key   = c.key   || P.ai.key   || "";
    P.ai.url   = c.url   || P.ai.url   || "";
    P.ai.model = c.model || P.ai.model || "";
    if (c.temp != null) P.ai.temp = parseFloat(c.temp) || 0.8;
    if (c.tok != null) P.ai.tok = parseInt(c.tok, 10) || 2000;
    if (c.mem != null) P.ai.mem = parseInt(c.mem, 10) || 20;
    if (c.prompt != null) P.ai.prompt = c.prompt;
    if (c.rules != null) P.ai.rules = c.rules;
  }
  if(window.tianming&&window.tianming.isDesktop){
    window.tianming.loadAutoSave().then(function(res){
      if(res&&res.success&&res.data&&res.data.ai) _applyAiCfg(res.data.ai);
    }).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'catch] async:') : console.warn('[catch] async:', e); });
    return;
  }
  try{var s=localStorage.getItem("tm_api");if(s){_applyAiCfg(JSON.parse(s));}}
  catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
})();

// ============================================================
//  Electron集成
// ============================================================
// Desktop标记已移至问天按钮区域，不再需要修改logo
// ============================================================
//  Part 2：游戏引擎核心函数
// ============================================================

// 地图状态变量
var mapTool="rect",mapDrawing=false,mapStart=null,mapSelIdx=-1,mapPolyPts=[];

// 事件类型图标
// ─ 常规条目类型（朝代/人事/军事等）
// ─ 风闻类条目（告状/风议/密札/耳报）——非正式渠道情报，严格史实模式下的主要识腐来源
var _EVT_ICONS=(typeof tmIcon==='function')?{'朝代':tmIcon('prestige',14),'人事':tmIcon('office',14),'任命':tmIcon('memorial',14),'罢免':tmIcon('close',14),'赏赐':tmIcon('treasury',14),'惩罚':tmIcon('execution',14),'死亡':tmIcon('close',14),
  '事件':tmIcon('event',14),'军事':tmIcon('troops',14),'封臣危机':tmIcon('faction',14),'时代':tmIcon('chronicle',14),'时代趋势':tmIcon('history',14),'完成':tmIcon('policy',14),'诏令意图':tmIcon('scroll',14),
  '群体不满':tmIcon('unrest',14),'改革反弹':tmIcon('strife',14),'官制危机':tmIcon('unrest',14),
  // ═══ 风闻四类（登闻鼓/士林/门生/内廷） ═══
  '告状':tmIcon('drum',14),'风议':tmIcon('rumor',14),'密札':tmIcon('letter',14),'耳报':tmIcon('whisper',14)}:{};

// 可信度标签（风闻类条目专用）
var _CRED_META = {
  'high':   { label:'\u53EF\u4FE1',       color:'var(--green)' },  // 可信（钦差/账册/确证）
  'medium': { label:'\u53C2\u8003',       color:'var(--gold)'  },  // 参考（士林风议/部分证据）
  'low':    { label:'\u98CE\u95FB',       color:'var(--txt-d)' },  // 风闻（流言/未核实）
  'biased': { label:'\u504F\u9882',       color:'var(--purple,#8a5cf5)' } // 偏颇（宦官耳报/党人揭发）
};

function _fmtEvt(e){
  var icon=_EVT_ICONS[e.type]||'•';
  var credHtml='';
  if (e.credibility && _CRED_META[e.credibility]) {
    var cm = _CRED_META[e.credibility];
    credHtml = ' <span style="font-size:0.62rem;color:'+cm.color+';border:1px solid '+cm.color+';padding:0 3px;border-radius:2px;margin-left:2px;">'+cm.label+'</span>';
  }
  return "<div style=\"padding:0.3rem 0;font-size:0.78rem;border-bottom:1px solid rgba(42,42,62,0.3);\">"+
    "<span style=\"margin-right:3px;\">"+icon+"</span>"+
    "<span class=\"tg\">"+escHtml(e.type)+"</span>"+credHtml+" "+escHtml(e.text)+
    " <span style=\"color:var(--txt-d);font-size:0.65rem;\">"+escHtml(e.time||'')+"</span></div>";
}

// 风闻录事（原"大事记"）
// @param {string} type - 事件类型（朝代/人事/…/告状/风议/密札/耳报）
// @param {string} text - 事件文本
// @param {Object} [opts] - 可选字段：{credibility, subject, source, ref}
//   credibility: 'high'|'medium'|'low'|'biased' —— 风闻四类建议填写
//   subject: 被指涉的角色ID（可点击查看）
//   source: 情报来源角色ID（门生/御史/宦官）
//   ref: 关联的弹章/案件id
function addEB(type,text,opts){
  var entry = {turn:GM.turn,type:type,text:text,time:getTSText(GM.turn)};
  if (opts) {
    if (opts.credibility) entry.credibility = opts.credibility;
    if (opts.subject)     entry.subject     = opts.subject;
    if (opts.source)      entry.source      = opts.source;
    if (opts.ref)         entry.ref         = opts.ref;
  }
  GM.evtLog.push(entry);
  // 防止evtLog无限增长——保留最近500条
  if (GM.evtLog.length > 500) GM.evtLog = GM.evtLog.slice(-300);
  var el=_$("evt-log");
  if(el)el.innerHTML=GM.evtLog.slice(-20).reverse().map(_fmtEvt).join("");
}

// 添加事件日志（用于监听系统）
function addEventLog(text) {
  addEB('系统', text);
}

// 游戏标签切换
function switchGTab(btn,panelId){
  document.querySelectorAll(".g-tab-btn").forEach(function(b){b.classList.remove("active");});
  document.querySelectorAll(".g-tab-panel").forEach(function(p){p.style.display="none";});
  if(btn)btn.classList.add("active");
  var panel=_$(panelId);if(panel)panel.style.display=(panelId==='gt-letter'?'flex':'block');
  // 切换到诏令tab时刷新建议库
  if(panelId==='gt-edict' && typeof _renderEdictSuggestions==='function') _renderEdictSuggestions();
  // 切换到鸿雁传书tab时刷新面板
  if(panelId==='gt-letter' && typeof renderLetterPanel==='function') renderLetterPanel();
  // 切换到官制tab时重绘树状图（panel可能首次渲染时尺寸计算失败）
  if(panelId==='gt-office' && typeof renderOfficeTree==='function') {
    // 延迟确保 display:block 已生效，SVG 尺寸能正确计算
    setTimeout(function(){ try { renderOfficeTree(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'OfficeTree') : console.error('[OfficeTree]', e); } }, 30);
  }
  // 切换到文苑tab时渲染作品列表
  if(panelId==='gt-wenyuan' && typeof renderWenyuan==='function') {
    setTimeout(function(){ try { renderWenyuan(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'Wenyuan') : console.error('[Wenyuan]', e); } }, 30);
  }
}

// ============================================================
// 文苑（文事作品库）面板
// ============================================================
var _WENYUAN_GENRES = { shi:'诗', ci:'词', fu:'赋', qu:'曲', ge:'歌行', wen:'散文', apply:'应用文', ji:'记叙', ritual:'祭碑', paratext:'序跋' };
var _WENYUAN_CATS = {
  career: { label:'科举宦途', color:'#3498db' },
  adversity:{label:'逆境贬谪', color:'#c0392b' },
  social: { label:'社交酬酢', color:'#e67e22' },
  duty:   { label:'任上施政', color:'#9b59b6' },
  travel: { label:'游历山水', color:'#16a085' },
  private:{ label:'家事私情', color:'#e91e63' },
  times:  { label:'时局天下', color:'#f39c12' },
  mood:   { label:'情感心境', color:'#607d8b' }
};

/** 诗稿卷轴式作者标签——姓只取首字/两字 */
function _wyAuthorTab(name) {
  if (!name) return '?';
  // 保留最多3字，去空白
  var nm = String(name).replace(/\s+/g,'').slice(0, 3);
  return escHtml(nm);
}

/** 品鉴星 */
function _wyQualityStars(q) {
  var _n = Math.max(0, Math.min(100, q||0));
  var _stars = Math.round(_n / 20);
  if (_stars < 1) _stars = 1;
  if (_stars > 5) _stars = 5;
  var html = '<span class="wy-quality"><span class="lbl">\u54C1</span>';
  for (var i=0; i<5; i++) html += '<span class="star' + (i<_stars?'':' d') + '">\u2605</span>';
  html += '<span class="val">' + _n + '</span></span>';
  return html;
}

/** 风险徽章 */
function _wyRiskBadge(r) {
  var _lvl = r || 'low';
  var _lbl = _lvl === 'high' ? '\u653F\u9669 \u00B7 \u9AD8' : _lvl === 'medium' ? '\u653F\u9669 \u00B7 \u4E2D' : '\u653F\u9669 \u00B7 \u4F4E';
  return '<span class="wy-risk ' + _lvl + '">' + _lbl + '</span>';
}

function renderWenyuan() {
  var list = _$('wenyuan-list'); if (!list) return;
  var sbar = _$('wy-statbar'), leg = _$('wy-legend');
  var works = (GM.culturalWorks || []).slice();

  // 统计
  var curTurn = GM.turn || 1;
  var _stat = { all: works.length, preserved: 0, forbidden: 0, risky: 0, recent: 0, authors: {} };
  works.forEach(function(w) {
    if (w.isPreserved) _stat.preserved++;
    if (w.isForbidden) _stat.forbidden++;
    if (w.politicalRisk === 'high' || w.politicalRisk === 'medium') _stat.risky++;
    if ((w.turn||0) >= curTurn - 8) _stat.recent++;
    if (w.author) _stat.authors[w.author] = (_stat.authors[w.author]||0) + 1;
  });
  var _authorCnt = Object.keys(_stat.authors).length;
  if (sbar) {
    sbar.innerHTML = ''
      + '<div class="wy-stat-card s-all"><div class="wy-stat-lbl">\u603B \u5F55</div><div class="wy-stat-num">'+_stat.all+'</div><div class="wy-stat-sub">\u7BC7</div></div>'
      + '<div class="wy-stat-card s-preserve"><div class="wy-stat-lbl">\u4F20 \u4E16</div><div class="wy-stat-num">'+_stat.preserved+'</div><div class="wy-stat-sub">\u540D\u4F5C</div></div>'
      + '<div class="wy-stat-card s-forbid"><div class="wy-stat-lbl">\u67E5 \u7981</div><div class="wy-stat-num">'+_stat.forbidden+'</div><div class="wy-stat-sub">\u8BB3\u7981</div></div>'
      + '<div class="wy-stat-card s-risk"><div class="wy-stat-lbl">\u653F \u9669</div><div class="wy-stat-num">'+_stat.risky+'</div><div class="wy-stat-sub">\u6D89\u8BBD</div></div>'
      + '<div class="wy-stat-card s-era"><div class="wy-stat-lbl">\u672C \u671D</div><div class="wy-stat-num">'+_stat.recent+'</div><div class="wy-stat-sub">\u8FD1\u4F5C</div></div>'
      + '<div class="wy-stat-card s-author"><div class="wy-stat-lbl">\u6587 \u9B41</div><div class="wy-stat-num">'+_authorCnt+'</div><div class="wy-stat-sub">\u540D\u5BB6</div></div>';
  }

  if (!works.length) {
    if (leg) leg.innerHTML = '';
    list.innerHTML = '<div class="wy-empty">\u6682\u65E0\u6587\u4E8B\u4F5C\u54C1<div class="sub">\u58EB\u5927\u592B\u56E0\u5883\u9047\u00B7\u9645\u9047\u00B7\u5FC3\u5883\u800C\u4F5C\uFF0C\u968F\u56DE\u5408\u63A8\u6F14\u81EA\u7136\u751F\u6210</div></div>';
    return;
  }

  // 筛选
  var catFil = (_$('wy-cat-filter') || {value:'all'}).value;
  var genFil = (_$('wy-genre-filter') || {value:'all'}).value;
  var sortKey = (_$('wy-sort') || {value:'recent'}).value;
  var preservedOnly = !!(_$('wy-preserved-only') || {}).checked;
  var hideForbidden = !!(_$('wy-hide-forbidden') || {}).checked;
  var kw = (_$('wy-search') || {value:''}).value.toLowerCase().trim();

  var filtered = works.filter(function(w) {
    if (catFil !== 'all' && w.triggerCategory !== catFil) return false;
    if (genFil !== 'all' && w.genre !== genFil) return false;
    if (preservedOnly && !w.isPreserved) return false;
    if (hideForbidden && w.isForbidden) return false;
    if (kw) {
      var hay = ((w.author||'') + (w.title||'') + (w.content||'') + (w.trigger||'') + (w.location||'')).toLowerCase();
      if (hay.indexOf(kw) < 0) return false;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    if (sortKey === 'quality') return (b.quality||0) - (a.quality||0);
    if (sortKey === 'author') return String(a.author||'').localeCompare(String(b.author||''));
    if (sortKey === 'date') return String(b.date||'').localeCompare(String(a.date||''));
    return (b.turn || 0) - (a.turn || 0); // recent
  });

  // 触发类别 legend
  if (leg) {
    var _catKeyMap = { career:'c-career', adversity:'c-adversity', social:'c-social', duty:'c-duty', travel:'c-travel', private:'c-private', times:'c-times', mood:'c-mood' };
    var _catCnt = {};
    filtered.forEach(function(w) { var k = w.triggerCategory || 'other'; _catCnt[k] = (_catCnt[k]||0)+1; });
    var _lhtml = '<span class="wy-legend-lbl">\u89E6 \u53D1</span>';
    Object.keys(_WENYUAN_CATS).forEach(function(k) {
      if (!_catCnt[k]) return;
      var cls = _catKeyMap[k] || '';
      _lhtml += '<span class="wy-legend-chip ' + cls + '">' + escHtml(_WENYUAN_CATS[k].label) + '<span class="num">\u00B7' + _catCnt[k] + '</span></span>';
    });
    leg.innerHTML = _lhtml;
  }

  if (!filtered.length) { list.innerHTML = '<div class="wy-empty">\u7BC7 \u673A \u5BC2 \u5BC2\u3000\u65E0 \u5339 \u914D \u4E4B \u4F5C<div class="sub">\u8BD5\u8C03\u62AB\u89C8\u6216\u653E\u5BBD\u7B5B\u9009</div></div>'; return; }

  var _catKeyMap2 = { career:'c-career', adversity:'c-adversity', social:'c-social', duty:'c-duty', travel:'c-travel', private:'c-private', times:'c-times', mood:'c-mood' };
  var html = '';
  filtered.forEach(function(w) {
    var _realIdx = works.indexOf(w);
    var cat = _WENYUAN_CATS[w.triggerCategory] || {label:'', color:'#888'};
    var genreLbl = _WENYUAN_GENRES[w.genre] || w.genre || '';
    var _catCls = _catKeyMap2[w.triggerCategory] || '';
    var _cardCls = 'wy-card ' + _catCls;
    if (w.isPreserved) _cardCls += ' preserved';
    if (w.isForbidden) _cardCls += ' forbidden';

    // 节选：取前 4 行或 120 字
    var _lines = (w.content || '').split('\n').filter(function(s){return s.trim();});
    var _excerpt = _lines.slice(0, 4).join('\n');
    if (_excerpt.length > 160) _excerpt = _excerpt.substring(0, 160) + '\u2026';
    var _excerptCls = 'wy-excerpt';
    if (w.genre === 'shi' || w.genre === 'ci' || w.genre === 'qu' || w.genre === 'ge') _excerptCls += ' elegant';
    if (w.genre === 'fu') _excerptCls += ' fu';
    if (w.genre === 'wen' || w.genre === 'ji' || w.genre === 'ritual' || w.genre === 'paratext') _excerptCls += ' wen';

    html += '<div class="' + _cardCls + '" onclick="_showWorkDetail(' + _realIdx + ')">';
    // 左：题签卷轴
    html += '<div class="wy-tab-col">';
    html += '<div class="wy-tab-scroll"><div class="wy-tab-author">' + _wyAuthorTab(w.author||'\u65E0\u540D') + '</div>';
    if (w.date) html += '<div class="wy-tab-date">' + escHtml(String(w.date).slice(0, 10)) + '</div>';
    else if (w.turn) html += '<div class="wy-tab-date">T' + w.turn + '</div>';
    html += '</div>';
    if (w.isPreserved) html += '<div class="wy-tab-seal">\u5370</div>';
    html += '</div>';
    // 右：正文列
    html += '<div class="wy-main-col">';
    html += '<div class="wy-hdr-row"><span class="wy-title-w">' + escHtml(w.title||'\u65E0\u9898') + '</span>';
    if (genreLbl) html += '<span class="wy-genre-chip">' + escHtml(genreLbl) + '</span>';
    if (w.subtype) html += '<span class="wy-subtype">' + escHtml(w.subtype) + '</span>';
    html += '</div>';
    // meta-row
    var _metaParts = [];
    if (cat.label) _metaParts.push('<span class="wy-cat-chip">' + escHtml(cat.label) + '</span>');
    if (w.location) _metaParts.push('<span class="wy-loc">' + escHtml(w.location) + '</span>');
    if (w.mood) _metaParts.push('<span class="wy-mood">' + escHtml(w.mood) + '</span>');
    if (_metaParts.length) html += '<div class="wy-meta-row">' + _metaParts.join('') + '</div>';
    // excerpt
    if (_excerpt) html += '<div class="' + _excerptCls + '">' + escHtml(_excerpt) + '</div>';
    // 品鉴行
    var _tagsHtml = '';
    if (w.theme) _tagsHtml += '<span class="wy-tag">' + escHtml(w.theme) + '</span>';
    if (w.motivation && w.motivation !== 'spontaneous') {
      var _motMap = {commissioned:'\u53D7\u547D',flattery:'\u5E72\u8C12',response:'\u916C\u7B54',mourning:'\u54C0\u60BC',critique:'\u8BBD\u8C15',celebration:'\u9882\u626C',farewell:'\u9001\u522B',memorial:'\u7EAA\u5FF5',ghostwrite:'\u4EE3\u7B14',duty:'\u5E94\u5236',self_express:'\u81EA\u6292'};
      _tagsHtml += '<span class="wy-tag">' + (_motMap[w.motivation] || escHtml(w.motivation)) + '</span>';
    }
    html += '<div class="wy-assess">' + _wyQualityStars(w.quality) + _wyRiskBadge(w.politicalRisk) + _tagsHtml + '</div>';
    // 创作背景
    if (w.narrativeContext) html += '<div class="wy-ctx">' + escHtml(w.narrativeContext) + '</div>';
    if (w.politicalImplication) html += '<div class="wy-implicit">' + escHtml(w.politicalImplication) + '</div>';
    // 操作
    html += '<div class="wy-actions">';
    html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'appreciate\')">\u8D4F \u6790</button>';
    html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'inscribe\')">\u9898 \u5E8F</button>';
    html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'echo\')">\u8FFD \u548C</button>';
    if (!w.isForbidden) html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'circulate\')">\u4F20 \u6284</button>';
    if (!w.isForbidden) html += '<button class="wy-btn danger" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'ban\')">\u67E5 \u7981</button>';
    else html += '<button class="wy-btn" onclick="event.stopPropagation();_workAction(' + _realIdx + ',\'unban\')">\u89E3 \u7981</button>';
    html += '<button class="wy-btn primary" onclick="event.stopPropagation();_showWorkDetail(' + _realIdx + ')">\u8BE6 \u60C5</button>';
    html += '</div>';
    html += '</div>'; // main-col
    html += '</div>'; // card
  });
  list.innerHTML = html;
}

function _showWorkDetail(idx) {
  var w = (GM.culturalWorks || [])[idx]; if (!w) return;
  var cat = _WENYUAN_CATS[w.triggerCategory] || {label:'', color:'#888'};
  var genreLbl = _WENYUAN_GENRES[w.genre] || w.genre || '';
  var html = '<div class="modal-bg show" id="_workDetailModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:620px;max-height:90vh;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.3rem;letter-spacing:0.08em;">' + escHtml(w.title || '') + '</h3>';
  html += '<div style="font-size:0.78rem;color:var(--color-foreground-muted);margin-bottom:0.6rem;">' + escHtml(w.author||'') + ' · ' + escHtml(w.date||'') + (w.location ? ' · 于 '+escHtml(w.location) : '') + '</div>';
  // 全文
  html += '<div style="font-family:var(--font-serif,serif);font-size:1rem;line-height:2.0;color:var(--color-foreground);padding:1rem;background:linear-gradient(to bottom,rgba(184,154,83,0.04),transparent);border-left:3px solid var(--gold-500);border-radius:var(--radius-md);white-space:pre-wrap;margin-bottom:0.6rem;">' + escHtml(w.content || '') + '</div>';
  // 创作背景
  if (w.narrativeContext) {
    html += '<div style="font-size:0.82rem;color:var(--color-foreground-secondary);background:var(--bg-2);padding:0.5rem 0.7rem;border-radius:var(--radius-sm);margin-bottom:0.6rem;line-height:1.7;"><b style="color:' + cat.color + ';">创作背景：</b>' + escHtml(w.narrativeContext) + '</div>';
  }
  // 元数据
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px 12px;font-size:0.72rem;margin-bottom:0.6rem;">';
  html += '<div><b style="color:' + cat.color + ';">触发：</b>' + cat.label + (w.trigger ? ' · ' + w.trigger : '') + '</div>';
  html += '<div><b style="color:var(--gold-400);">文体：</b>' + genreLbl + (w.subtype ? ' · ' + w.subtype : '') + '</div>';
  if (w.mood) html += '<div><b>情绪：</b>' + w.mood + '</div>';
  if (w.theme) html += '<div><b>题材：</b>' + w.theme + '</div>';
  if (w.motivation) html += '<div><b>动机：</b>' + w.motivation + '</div>';
  if (w.elegance) html += '<div><b>雅俗：</b>' + w.elegance + '</div>';
  html += '<div><b>质量：</b>' + (w.quality || 0) + '</div>';
  html += '<div><b>风险：</b>' + (w.politicalRisk || 'low') + '</div>';
  if (w.isPreserved) html += '<div style="color:var(--gold-400);">★ 传世之作</div>';
  if (w.isForbidden) html += '<div style="color:var(--vermillion-400);">⚠ 已查禁</div>';
  html += '</div>';
  if (w.politicalImplication) html += '<div style="font-size:0.78rem;color:var(--vermillion-400);margin-bottom:0.5rem;padding:0.3rem 0.5rem;background:rgba(192,57,43,0.08);border-radius:4px;">政治暗讽：' + escHtml(w.politicalImplication) + '</div>';
  if (w.dedicatedTo && w.dedicatedTo.length) html += '<div style="font-size:0.72rem;color:var(--color-foreground-muted);">赠：' + w.dedicatedTo.map(escHtml).join('、') + '</div>';
  // 玩家操作
  html += '<div style="display:flex;gap:6px;margin-top:0.8rem;flex-wrap:wrap;justify-content:flex-end;">';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'appreciate\')">赐阅赏析</button>';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'inscribe\')">御题赐序</button>';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'echo\')">追和</button>';
  html += '<button class="bt bsm" onclick="_workAction(' + idx + ',\'circulate\')">传抄</button>';
  if (!w.isForbidden) html += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_workAction(' + idx + ',\'ban\')">查禁</button>';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_workDetailModal\');if(m)m.remove();">关闭</button>';
  html += '</div>';
  html += '</div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

function _workAction(idx, action) {
  var w = (GM.culturalWorks || [])[idx]; if (!w) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  var content = '';
  if (action === 'appreciate') content = '赐阅 ' + w.author + '《' + w.title + '》，表嘉赏之意';
  else if (action === 'inscribe') content = '御题 ' + w.author + '《' + w.title + '》——亲笔题跋或作序，准其刊行';
  else if (action === 'echo') content = '命 ' + w.author + ' 或朝中文臣追和《' + w.title + '》——再作一篇次韵酬答';
  else if (action === 'circulate') content = '将 ' + w.author + '《' + w.title + '》传抄行世，刻本广布';
  else if (action === 'ban') content = '查禁 ' + w.author + '《' + w.title + '》——此作' + (w.politicalImplication ? '有' + w.politicalImplication + '之嫌，' : '') + '不宜流布';
  else if (action === 'unban') content = '解禁 ' + w.author + '《' + w.title + '》——准其重新流布，刊本发还';
  if (content) {
    GM._edictSuggestions.push({ source: '\u6587\u4E8B', from: w.author, content: content, turn: GM.turn, used: false });
    toast('已录入诏令建议库');
    if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  }
  var m = document.getElementById('_workDetailModal'); if (m) m.remove();
}

// P3: 省份民情面板渲染
var _dfSearch='', _dfSort='name', _dfCrisis=false;

function _renderDifangPanel() {
  var grid = _$('difang-grid'); if (!grid) return;
  // 优先读运行时 GM.adminHierarchy（与左侧栏一致·含推演更新的民心/腐败/人口）·回退剧本 P.adminHierarchy
  var ah = (GM && GM.adminHierarchy && Object.keys(GM.adminHierarchy).length > 0) ? GM.adminHierarchy : P.adminHierarchy;
  if (!ah) { grid.innerHTML = '<div style="color:var(--txt-d);text-align:center;">未设置行政区划</div>'; return; }

  // 启动时按需派生管辖类型（首次或势力变更后）
  if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();
  var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';

  // 收集所有顶级区划（扁平化）+ 附带管辖信息（dedupe 同名区划：只取第一个出现的）
  var _allDivs = [];
  var _seenRegionKeys = {};
  var factionKeys = Object.keys(ah);
  factionKeys.forEach(function(fk) {
    var fh = ah[fk];
    if (!fh || !fh.divisions) return;
    var _fac = (GM.facs || []).find(function(f) { return f.name === fh.name || f.name === fk; });
    fh.divisions.forEach(function(d) {
      if (!d || !d.name) return;
      var _key = d.id || d.name;
      if (_seenRegionKeys[_key]) return;   // 跳过已收集（避免多势力重名重复）
      _seenRegionKeys[_key] = true;
      // 获取或派生 autonomy
      var autonomy = d.autonomy;
      if (!autonomy || !autonomy.type) {
        autonomy = (typeof deriveAutonomy === 'function') ? deriveAutonomy(d, _fac, _playerFac) : { type: 'zhixia' };
      }
      if (!autonomy.type) return;
      _allDivs.push({ div: d, faction: fh.name || fk, factionKey: fk, autonomy: autonomy });
    });
  });

  // 辅助：递归从叶子聚合 population + minxin/corruption/fiscal/publicTreasury
  function _dfRecurseAggregate(node) {
    if (!node) return null;
    if (!node.children || node.children.length === 0) {
      var _popObj = (node.population && typeof node.population === 'object') ? node.population : null;
      return {
        mouths: _popObj ? (_popObj.mouths||0) : (typeof node.population === 'number' ? node.population : 0),
        households: _popObj ? (_popObj.households||0) : 0,
        ding: _popObj ? (_popObj.ding||0) : 0,
        fugitives: _popObj ? (_popObj.fugitives||0) : 0,
        hiddenCount: _popObj ? (_popObj.hiddenCount||0) : 0,
        minxin: (typeof node.minxin === 'number') ? node.minxin : null,
        corruption: (typeof node.corruption === 'number') ? node.corruption : null,
        remit: (node.fiscal && node.fiscal.remittedToCenter) || 0,
        actual: (node.fiscal && node.fiscal.actualRevenue) || 0,
        pubMoney: (node.publicTreasury && node.publicTreasury.money && node.publicTreasury.money.stock) || 0,
        pubGrain: (node.publicTreasury && node.publicTreasury.grain && node.publicTreasury.grain.stock) || 0,
        pubCloth: (node.publicTreasury && node.publicTreasury.cloth && node.publicTreasury.cloth.stock) || 0,
        envLoad: (node.environment && node.environment.currentLoad) || 0,
        count: 1
      };
    }
    var acc = { mouths:0, households:0, ding:0, fugitives:0, hiddenCount:0, remit:0, actual:0, pubMoney:0, pubGrain:0, pubCloth:0, minxinW:0, corrW:0, envLoadSum:0, count:0 };
    node.children.forEach(function(c) {
      var sub = _dfRecurseAggregate(c);
      if (!sub) return;
      acc.mouths += sub.mouths; acc.households += sub.households; acc.ding += sub.ding;
      acc.fugitives += sub.fugitives; acc.hiddenCount += sub.hiddenCount;
      acc.remit += sub.remit; acc.actual += sub.actual;
      acc.pubMoney += sub.pubMoney; acc.pubGrain += sub.pubGrain; acc.pubCloth += sub.pubCloth;
      var w = sub.mouths || 1;
      if (sub.minxin != null) acc.minxinW += sub.minxin * w;
      if (sub.corruption != null) acc.corrW += sub.corruption * w;
      acc.envLoadSum += (sub.envLoad || 0) * (sub.count||1);
      acc.count += sub.count;
    });
    var totalW = acc.mouths || 1;
    return {
      mouths: acc.mouths, households: acc.households, ding: acc.ding,
      fugitives: acc.fugitives, hiddenCount: acc.hiddenCount,
      minxin: totalW > 0 ? acc.minxinW / totalW : null,
      corruption: totalW > 0 ? acc.corrW / totalW : null,
      remit: acc.remit, actual: acc.actual,
      pubMoney: acc.pubMoney, pubGrain: acc.pubGrain, pubCloth: acc.pubCloth,
      envLoad: acc.count > 0 ? acc.envLoadSum / acc.count : 0,
      count: acc.count
    };
  }

  // 为每个区划计算数据（优先读自身深化字段；若顶级 population 为空则从子递归聚合）
  _allDivs.forEach(function(item) {
    var d = item.div;
    var ps = GM.provinceStats && GM.provinceStats[d.name];
    item.name = d.name;
    var _agg = _dfRecurseAggregate(d);
    // 新字段：population 是对象
    if (d.population && typeof d.population === 'object' && d.population.mouths > 0) {
      item.pop = d.population.mouths || 0;
      item.households = d.population.households || 0;
      item.ding = d.population.ding || 0;
      item.fugitives = d.population.fugitives || 0;
      item.hiddenCount = d.population.hiddenCount || 0;
    } else if (_agg && _agg.mouths > 0) {
      // 顶级没自身人口 → 用叶子聚合
      item.pop = _agg.mouths;
      item.households = _agg.households;
      item.ding = _agg.ding;
      item.fugitives = _agg.fugitives;
      item.hiddenCount = _agg.hiddenCount;
    } else {
      item.pop = (typeof d.population === 'number' ? d.population : 0) || (ps ? ps.population : 0) || 0;
      item.households = d.households || (ps ? ps.households : 0) || Math.floor(item.pop/5);
      item.ding = Math.floor(item.pop*0.25);
      item.fugitives = 0; item.hiddenCount = 0;
    }
    // 民心/腐败/财政/公库 —— 优先自身字段；无则用子聚合
    item.minxin = (typeof d.minxin === 'number') ? d.minxin : (_agg && _agg.minxin != null ? _agg.minxin : null);
    item.corruption = (typeof d.corruption === 'number') ? d.corruption : (_agg && _agg.corruption != null ? _agg.corruption : ((ps && ps.corruption) || 0));
    item.unrest = item.minxin != null ? Math.max(0, 100 - item.minxin) : ((ps && ps.unrest) || 0);
    item.prosperity = d.prosperity || (ps ? (ps.prosperity||ps.development) : 0) || 0;
    item.remit = (d.fiscal && d.fiscal.remittedToCenter) || (_agg && _agg.remit) || 0;
    item.actualRevenue = (d.fiscal && d.fiscal.actualRevenue) || (_agg && _agg.actual) || 0;
    item.taxRevenue = item.remit || item.actualRevenue || (ps ? ps.taxRevenue : 0) || 0;
    item.pubMoney = (d.publicTreasury && d.publicTreasury.money && d.publicTreasury.money.stock) || (_agg && _agg.pubMoney) || 0;
    item.pubGrain = (d.publicTreasury && d.publicTreasury.grain && d.publicTreasury.grain.stock) || (_agg && _agg.pubGrain) || 0;
    item.pubCloth = (d.publicTreasury && d.publicTreasury.cloth && d.publicTreasury.cloth.stock) || (_agg && _agg.pubCloth) || 0;
    item.envLoad = (d.environment && d.environment.currentLoad) || (_agg && _agg.envLoad) || 0;
    item.regionType = d.regionType || 'normal';
    item.governor = d.governor || (ps ? ps.governor : '') || '';
    item.govCh = item.governor ? findCharByName(item.governor) : null;
    // 稳定度（民心优先；无则按当地忠诚+老 unrest 派生）
    if (item.minxin != null) {
      item.stability = item.minxin;
    } else {
      var localChars = (GM.chars || []).filter(function(c) { return c.alive !== false && c.location === d.name; });
      var avgLoy = localChars.length > 0 ? Math.round(localChars.reduce(function(s,c){ return s+(c.loyalty||50); },0)/localChars.length) : 50;
      item.stability = Math.max(0, Math.min(100, avgLoy - item.unrest * 0.5));
    }
    // 趋势
    var prev = GM._prevProvinceStats && GM._prevProvinceStats[d.name];
    item.trend = {};
    if (prev) {
      item.trend.prosperity = (item.prosperity||0) > (prev.prosperity||prev.development||0) ? '\u2191' : (item.prosperity||0) < (prev.prosperity||prev.development||0) ? '\u2193' : '';
      item.trend.corruption = (item.corruption||0) > (prev.corruption||0) ? '\u2191' : (item.corruption||0) < (prev.corruption||0) ? '\u2193' : '';
      item.trend.unrest = (item.unrest||0) > (prev.unrest||0) ? '\u2191' : (item.unrest||0) < (prev.unrest||0) ? '\u2193' : '';
    }
  });

  // 搜索
  if (_dfSearch) {
    var kw = _dfSearch.toLowerCase();
    _allDivs = _allDivs.filter(function(item) { return item.name.toLowerCase().indexOf(kw) >= 0 || item.governor.toLowerCase().indexOf(kw) >= 0 || item.faction.toLowerCase().indexOf(kw) >= 0; });
  }
  // 危机筛选
  if (_dfCrisis) {
    _allDivs = _allDivs.filter(function(item) { return item.unrest > 40 || item.corruption > 50; });
  }
  // 排序
  _allDivs.sort(function(a,b) {
    if (_dfSort === 'unrest') return (b.unrest||0) - (a.unrest||0);
    if (_dfSort === 'corruption') return (b.corruption||0) - (a.corruption||0);
    if (_dfSort === 'population') return (b.pop||0) - (a.pop||0);
    if (_dfSort === 'tax') return (b.taxRevenue||b.tax||0) - (a.taxRevenue||a.tax||0);
    return a.name.localeCompare(b.name);
  });

  if (_allDivs.length === 0) { grid.innerHTML = '<div style="color:var(--color-foreground-muted);text-align:center;padding:2rem;font-family:var(--font-serif);letter-spacing:0.2em;">\u65E0\u5339\u914D\u533A\u5212</div>'; return; }

  // ═══ 统计栏 + 图例 + 预警 ═══
  var _allTotal = _allDivs.length;
  var _cntZhi=0, _cntFan=0, _cntJi=0, _cntTu=0, _cntShu=0, _cntCrisis=0;
  _allDivs.forEach(function(item){
    var t = item.autonomy.type;
    if (t === 'zhixia') _cntZhi++;
    else if (t === 'fanzhen' || t === 'fanguo') _cntFan++;
    else if (t === 'jimi') _cntJi++;
    else if (t === 'chaogong') _cntShu++;
    if (item.regionType === 'tusi') _cntTu++;
    if (item.unrest > 40 || item.corruption > 50 || (item.fugitives||0) > (item.pop||1) * 0.04) _cntCrisis++;
  });

  // 统计栏
  var statEl = _$('df-statbar');
  if (statEl) {
    var sh = '';
    sh += '<div class="df-stat-card s-all"><div class="df-stat-lbl">\u884C \u653F \u533A \u5212</div><div class="df-stat-num">' + _allTotal + '</div><div class="df-stat-sub">\u5404\u9053\u00B7\u5E03\u653F\u53F8\u00B7\u85E9\u9547\u00B7\u7F81\u7E3B</div></div>';
    sh += '<div class="df-stat-card s-zhi"><div class="df-stat-lbl">\u76F4 \u8F96</div><div class="df-stat-num">' + _cntZhi + '</div><div class="df-stat-sub">\u90E1\u53BF\u5236\u00B7\u6D41\u5B98\u7BA1\u7406</div></div>';
    sh += '<div class="df-stat-card s-fan"><div class="df-stat-lbl">\u85E9 \u9547</div><div class="df-stat-num">' + _cntFan + '</div><div class="df-stat-sub">\u8282\u5EA6\u4F7F\u00B7\u85E9\u56FD</div></div>';
    sh += '<div class="df-stat-card s-ji"><div class="df-stat-lbl">\u7F81 \u7E3B \u00B7 \u571F \u53F8</div><div class="df-stat-num">' + (_cntJi + _cntTu) + '</div><div class="df-stat-sub">\u56E0\u4FD7\u800C\u6CBB</div></div>';
    sh += '<div class="df-stat-card s-crisis"><div class="df-stat-lbl">\u26A0 \u5371 \u673A</div><div class="df-stat-num">' + _cntCrisis + '</div><div class="df-stat-sub">\u6C11\u53D8\u9AD8\u00B7\u8150\u8D25\u91CD\u00B7\u9003\u6237\u591A</div></div>';
    statEl.innerHTML = sh;
  }

  // 图例
  var legendEl = _$('df-legend');
  if (legendEl) {
    var lh = '<span class="df-legend-lbl">\u7BA1 \u8F96</span>';
    lh += '<span class="df-legend-chip zhi">\u76F4 \u8F96 <span class="num">' + _cntZhi + '</span></span>';
    lh += '<span class="df-legend-chip fan">\u85E9 \u9547 <span class="num">' + _cntFan + '</span></span>';
    lh += '<span class="df-legend-chip ji">\u7F81 \u7E3B <span class="num">' + _cntJi + '</span></span>';
    lh += '<span class="df-legend-chip tu">\u571F \u53F8 <span class="num">' + _cntTu + '</span></span>';
    lh += '<span class="df-legend-chip shu">\u671D \u8D21 <span class="num">' + _cntShu + '</span></span>';
    legendEl.innerHTML = lh;
  }

  // 预警条（前 3 个高危区）
  var alertEl = _$('df-alerts');
  if (alertEl) {
    var _crisisSortedAll = _allDivs.slice().sort(function(a,b){
      var sa = (a.unrest||0) * 1.5 + (a.corruption||0);
      var sb = (b.unrest||0) * 1.5 + (b.corruption||0);
      return sb - sa;
    }).filter(function(x){ return x.unrest > 40 || x.corruption > 50; }).slice(0, 3);
    if (_crisisSortedAll.length > 0) {
      var ah = '';
      _crisisSortedAll.forEach(function(cx){
        var icon = cx.unrest > 60 ? '\u4E71' : cx.corruption > 60 ? '\u8150' : '\u8B66';
        var cls = cx.unrest > 60 ? '' : 'warn';
        var cause = [];
        if (cx.unrest > 60) cause.push('\u6C11\u53D8 ' + Math.round(cx.unrest));
        if (cx.corruption > 50) cause.push('\u8150\u8D25 ' + Math.round(cx.corruption));
        if ((cx.fugitives||0) > 0) cause.push('\u9003\u6237 ' + (cx.fugitives > 10000 ? Math.round(cx.fugitives/10000)+'\u4E07':cx.fugitives));
        ah += '<div class="df-alert' + (cls?' '+cls:'') + '"><div class="ic">' + icon + '</div>';
        ah += '<div><span class="lbl">' + escHtml(cx.name) + '\uFF1A</span><span class="txt">' + cause.join(' \u00B7 ') + (cx.governor ? ' \u00B7 \u957F\u5B98 ' + escHtml(cx.governor) : '') + '</span></div></div>';
      });
      alertEl.innerHTML = ah;
      alertEl.style.display = 'flex';
    } else {
      alertEl.style.display = 'none';
      alertEl.innerHTML = '';
    }
  }

  // ═══ 省份卡网格 ═══
  var html = '';
  _allDivs.forEach(function(item) {
    var t = item.autonomy.type;
    var typeCls = t === 'zhixia' ? 'df-zhi' : (t === 'fanguo' || t === 'fanzhen') ? 'df-fan' : (t === 'jimi' ? 'df-ji' : (t === 'chaogong' ? 'df-shu' : 'df-zhi'));
    if (item.regionType === 'tusi') typeCls = 'df-tu';
    var isCrisis = item.unrest > 40 || item.corruption > 50;
    var cardCls = 'df-card ' + typeCls + (isCrisis ? ' crisis' : '');

    var autonLabel = t === 'zhixia' ? '\u76F4 \u8F96' : t === 'fanguo' ? (item.autonomy.subtype === 'real' ? '\u5B9E\u5C01\u85E9' : '\u865A\u5C01\u85E9') : t === 'fanzhen' ? '\u85E9 \u9547' : t === 'jimi' ? (item.regionType === 'tusi' ? '\u571F \u53F8' : '\u7F81 \u7E3B') : t === 'chaogong' ? '\u671D \u8D21' : '';
    var _isDirect = t === 'zhixia';

    // 大人口口数显示
    var _popMain = item.pop > 10000 ? (item.pop/10000).toFixed(item.pop >= 1e6 ? 0 : 1).replace(/\.0$/,'') : item.pop;
    var _popUnit = item.pop > 10000 ? '\u4E07\u53E3' : '\u53E3';

    html += '<div class="' + cardCls + '">';
    // 顶部
    html += '<div class="df-card-hdr">';
    html += '<span class="df-card-name">' + escHtml(item.name) + '</span>';
    if (autonLabel) html += '<span class="df-auton-chip">' + autonLabel + '</span>';
    if (item.faction) html += '<span class="df-fac-tag">' + escHtml(item.faction) + '</span>';
    html += '<span class="df-pop-main"><span class="n">' + _popMain + '</span><span class="u">' + _popUnit + '</span></span>';
    html += '</div>';

    html += '<div class="df-card-body">';

    // 持爵者/宗主（非直辖）
    if (!_isDirect && item.autonomy.holder) {
      var holderLbl = t === 'fanguo' ? (item.autonomy.subtype === 'real' ? '\u5B9E\u5C01\u85E9\u738B' : '\u865A\u5C01\u85E9\u738B') : t === 'jimi' ? '\u571F\u53F8' : t === 'fanzhen' ? '\u8282\u5EA6\u4F7F' : t === 'chaogong' ? '\u5916\u85E9\u738B' : '';
      html += '<div style="font-size:10.5px;color:var(--auton-c);font-family:var(--font-serif);letter-spacing:0.08em;">' + holderLbl + '\uFF1A' + escHtml(item.autonomy.holder);
      if (item.autonomy.loyalty !== undefined) html += ' \u00B7 \u5FE0 ' + item.autonomy.loyalty;
      if (item.autonomy.tributeRate) html += ' \u00B7 \u8D21\u7387 ' + Math.round(item.autonomy.tributeRate*100) + '%';
      html += '</div>';
    }

    // 4 维条形图
    var _mxCls = item.minxin != null ? (item.minxin >= 60 ? '' : item.minxin >= 35 ? ' mid' : ' lo') : '';
    var _mxVal = item.minxin != null ? Math.round(item.minxin) : null;
    var _crCls = item.corruption >= 60 ? ' hi' : item.corruption >= 40 ? ' mid' : '';
    var _crVal = Math.round(item.corruption||0);
    var _prVal = Math.round(item.prosperity||0);
    var _unCls = item.unrest >= 60 ? ' hi' : item.unrest >= 35 ? ' mid' : '';
    var _unVal = Math.round(item.unrest||0);
    html += '<div class="df-bars">';
    if (_mxVal != null) html += '<div class="df-bar minxin' + _mxCls + '"><span class="df-bar-lbl">\u6C11\u5FC3</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_mxVal) + '%;"></div></div><span class="df-bar-val">' + _mxVal + '</span></div>';
    html += '<div class="df-bar corruption' + _crCls + '"><span class="df-bar-lbl">\u8150\u8D25</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_crVal) + '%;"></div></div><span class="df-bar-val">' + _crVal + '</span></div>';
    html += '<div class="df-bar prosperity"><span class="df-bar-lbl">\u7E41\u8363</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_prVal) + '%;"></div></div><span class="df-bar-val">' + _prVal + '</span></div>';
    html += '<div class="df-bar unrest' + _unCls + '"><span class="df-bar-lbl">\u53DB\u4E71</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_unVal) + '%;"></div></div><span class="df-bar-val">' + _unVal + '</span></div>';
    html += '</div>';

    // 户口细项
    function _fmtP(v){ return v >= 10000 ? (v/10000).toFixed(v>=1e7?0:1).replace(/\.0$/,'') + '\u4E07' : v; }
    html += '<div class="df-pop-detail">';
    html += '<span class="df-pop-item"><span class="lbl">\u6237</span><span class="v">' + _fmtP(item.households||0) + '</span></span>';
    html += '<span class="df-pop-item"><span class="lbl">\u53E3</span><span class="v">' + _fmtP(item.pop||0) + '</span></span>';
    html += '<span class="df-pop-item"><span class="lbl">\u4E01</span><span class="v">' + _fmtP(item.ding||0) + '</span></span>';
    if (item.fugitives > 0) {
      var fugCls = (item.fugitives > (item.pop||1) * 0.04) ? ' danger' : ' warn';
      html += '<span class="df-pop-item' + fugCls + '"><span class="lbl">\u9003</span><span class="v">' + _fmtP(item.fugitives) + '</span></span>';
    }
    if (item.hiddenCount > 0) {
      html += '<span class="df-pop-item warn"><span class="lbl">\u9690</span><span class="v">' + _fmtP(item.hiddenCount) + '</span></span>';
    }
    html += '</div>';

    // 财政
    var _taxRev = Math.round(item.taxRevenue||0);
    var _remit = Math.round(item.remit||0);
    if (_taxRev > 0 || _remit > 0) {
      html += '<div class="df-fiscal">';
      if (_taxRev > 0) html += '<span class="df-fiscal-item income"><span class="lbl">\u5B9E \u6536</span><span class="v">' + _fmtP(_taxRev) + '\u4E24</span></span>';
      if (_isDirect) {
        html += '<span class="df-fiscal-item"><span class="lbl">\u4E0A \u89E3</span><span class="v">' + _fmtP(_remit) + '\u4E24</span></span>';
      } else if (item.autonomy.tributeRate) {
        var _tribute = Math.round(_taxRev * item.autonomy.tributeRate);
        html += '<span class="df-fiscal-item"><span class="lbl">\u8D21 \u8D4B</span><span class="v">' + _fmtP(_tribute) + '\u4E24</span></span>';
      }
      html += '</div>';
    }

    // 公库 钱粮布
    if (item.pubMoney > 0 || item.pubGrain > 0 || item.pubCloth > 0) {
      html += '<div class="df-treasury-row">';
      html += '<span class="lbl">\u5DDE \u5E93</span>';
      if (item.pubMoney > 0) html += '<span class="item gold"><span class="k">\u94B1</span><span class="v">' + _fmtP(item.pubMoney) + '\u4E24</span></span>';
      if (item.pubGrain > 0) html += '<span class="item grain"><span class="k">\u7CAE</span><span class="v">' + _fmtP(item.pubGrain) + '\u77F3</span></span>';
      if (item.pubCloth > 0) html += '<span class="item cloth"><span class="k">\u5E03</span><span class="v">' + _fmtP(item.pubCloth) + '\u5339</span></span>';
      html += '</div>';
    }

    // 环境负担
    if (item.envLoad > 0) {
      var _envPct = Math.round((item.envLoad > 1 ? item.envLoad : item.envLoad * 100));
      var _envCls = _envPct >= 85 ? ' hi' : _envPct >= 60 ? ' mid' : '';
      html += '<div class="df-bar env' + _envCls + '"><span class="df-bar-lbl">\u73AF\u8D1F</span><div class="df-bar-track"><div class="df-bar-fill" style="width:' + Math.min(100,_envPct) + '%;"></div></div><span class="df-bar-val">' + _envPct + '</span></div>';
    }

    // 危机说明
    if (isCrisis) {
      var notes = [];
      if (item.unrest > 60) notes.push('\u6C11\u53D8\u5371\u6025');
      if (item.corruption > 60) notes.push('\u8150\u8D25\u6CDB\u6EE5');
      if ((item.fugitives||0) > (item.pop||1) * 0.04) notes.push('\u9003\u6237\u6D6A\u6F6E');
      if (item.envLoad > 0.85) notes.push('\u8F7D\u91CD\u8D85\u9650');
      if (notes.length > 0) html += '<div class="df-crisis-note">' + notes.join(' \u00B7 ') + '\uFF0C\u4E9F\u987B\u65E9\u7B79\u5904\u7F6E</div>';
    }

    // 事件 chips (灾荒/战乱/瘟疫/丰收等)
    var _evChips = [];
    if ((item.unrest||0) > 70) _evChips.push({ cls:'rebellion', txt:'\u6C11\u53D8' });
    if ((item.envLoad||0) > 0.9) _evChips.push({ cls:'calamity', txt:'\u8F7D\u91CD' });
    if (Array.isArray(item.disasters)) {
      item.disasters.forEach(function(d) {
        var _dName = (typeof d === 'string') ? d : (d.type || d.name || '');
        if (!_dName) return;
        var _cls = 'calamity';
        if (_dName.indexOf('\u65F1') >= 0 || _dName.indexOf('\u65F1\u707E') >= 0) _cls = 'drought';
        else if (_dName.indexOf('\u6D2A') >= 0 || _dName.indexOf('\u6C34') >= 0) _cls = 'flood';
        else if (_dName.indexOf('\u75AB') >= 0 || _dName.indexOf('\u75C5') >= 0) _cls = 'plague';
        else if (_dName.indexOf('\u4E71') >= 0 || _dName.indexOf('\u53DB') >= 0) _cls = 'rebellion';
        _evChips.push({ cls:_cls, txt:_dName });
      });
    }
    if (Array.isArray(item.activeEvents)) {
      item.activeEvents.forEach(function(ae) {
        var _n = (typeof ae === 'string') ? ae : (ae.name || ae.title || '');
        if (_n) _evChips.push({ cls:'calamity', txt:_n });
      });
    }
    if (GM.activeWars && GM.activeWars.length) {
      var _hasWar = GM.activeWars.some(function(w) { return (w.location||'').indexOf(item.name) >= 0 || (w.province||'') === item.name; });
      if (_hasWar) _evChips.push({ cls:'war', txt:'\u6218\u4E8B' });
    }
    if ((item.yearOutput||1) > 1.2 && !isCrisis) _evChips.push({ cls:'bumper', txt:'\u4E30\u79BB' });
    if (_evChips.length) {
      html += '<div class="df-events">';
      _evChips.slice(0, 5).forEach(function(e) { html += '<span class="df-event-chip ' + e.cls + '">' + escHtml(e.txt) + '</span>'; });
      html += '</div>';
    }

    // 长官行
    html += '<div class="df-governor">';
    if (item.governor) {
      var _portChar = item.governor ? item.governor.charAt(0) : '?';
      var _portImg = (item.govCh && item.govCh.portrait) ? '<img src="' + escHtml(item.govCh.portrait) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' : escHtml(_portChar);
      html += '<div class="df-gov-portrait">' + _portImg + '</div>';
      var _loy = item.govCh ? (item.govCh.loyalty || 50) : 50;
      var _loyCls = _loy >= 70 ? '' : _loy >= 40 ? 'mid' : 'lo';
      var _gTitle = _isDirect ? '\u5DE1\u629A' : (t === 'fanzhen' ? '\u603B\u5175\u5B98' : t === 'jimi' ? '\u5BA3\u6170\u4F7F' : '\u957F\u5B98');
      html += '<div class="df-gov-info"><div class="df-gov-title">' + _gTitle + '</div><div class="df-gov-name">' + escHtml(item.governor) + '<span class="loyalty ' + _loyCls + '">\u5FE0 ' + _loy + '</span></div></div>';
    } else {
      html += '<div class="df-gov-portrait" style="background:repeating-linear-gradient(45deg,rgba(107,93,71,0.25),rgba(107,93,71,0.25) 2px,rgba(107,93,71,0.1) 2px,rgba(107,93,71,0.1) 4px);border-style:dashed;color:var(--ink-300);">?</div>';
      html += '<div class="df-gov-info"><div class="df-gov-title">\u957F\u5B98</div><div class="df-gov-name" style="color:var(--vermillion-400);font-style:italic;">\u7A7A\u7F3A</div></div>';
    }
    // 操作按钮
    var _divName = escHtml(item.name).replace(/'/g,"\\'");
    html += '<div class="df-gov-actions">';
    if (_isDirect) {
      html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfEdict(\'' + _divName + '\')">\u4E0B \u65E8</button>';
      if (item.governor) html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfChangeGov(\'' + _divName + '\')">\u6362 \u5B98</button>';
      if (isCrisis) html += '<button class="df-gov-btn danger" onclick="event.stopPropagation();_dfEdict(\'' + _divName + '\')">\u8D48 \u6D4E</button>';
    } else {
      html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfEdict(\'' + _divName + '\')">\u4F20 \u65E8</button>';
      html += '<button class="df-gov-btn" onclick="event.stopPropagation();_dfNonDirectAction(\'' + _divName + '\',\'' + t + '\')">\u53EF \u884C \u4E4B \u7B56</button>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>'; // .df-card-body
    html += '</div>'; // .df-card
  });
  grid.innerHTML = html;
}

/** 数据条辅助·兼容旧调用 */
function _dfBar(label, val, color, trend) {
  var v = Math.round(val||0);
  var tStr = trend ? '<span style="font-size:0.55rem;color:' + (trend==='\u2191'?'var(--vermillion-400)':'var(--celadon-400)') + ';">' + trend + '</span>' : '';
  return '<div style="display:flex;align-items:center;gap:3px;margin-top:2px;font-size:0.6rem;">'
    + '<span style="width:24px;color:var(--color-foreground-muted);">' + label + '</span>'
    + '<div style="flex:1;height:3px;background:var(--color-border-subtle);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + Math.min(100,v) + '%;background:' + color + ';border-radius:2px;"></div></div>'
    + '<span style="width:20px;text-align:right;color:var(--color-foreground-muted);">' + v + '</span>' + tStr
    + '</div>';
}

/** 下旨——预填诏令建议库 */
function _dfEdict(divName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  showPrompt('\u5BF9' + divName + '\u4E0B\u65E8\uFF1A', '', function(content) {
    if (!content) return;
    GM._edictSuggestions.push({ source: '\u5730\u65B9', from: divName, content: content, turn: GM.turn, used: false });
    toast('\u5DF2\u5F55\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93');
    if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  });
}

/** 更换长官——跳转官制荐贤 */
function _dfChangeGov(divName) {
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5730\u65B9', from: divName, content: '\u66F4\u6362' + divName + '\u957F\u5B98', turn: GM.turn, used: false });
  toast('\u5DF2\u5F55\u5165\u8BCF\u4E66\u5EFA\u8BAE\u5E93\u2014\u2014\u8BF7\u5728\u8BCF\u4EE4\u4E2D\u4E0B\u65E8');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

/** 玩家颁诏实时预警——基于诏令文本分类+阻力估算+历史参照 */
var _edictForecastTimer = null;
function _edictLiveForecast(textareaId) {
  // 防抖
  if (_edictForecastTimer) clearTimeout(_edictForecastTimer);
  _edictForecastTimer = setTimeout(function() {
    var ta = _$(textareaId);
    var fcEl = _$(textareaId + '-forecast');
    if (!ta || !fcEl) return;
    var text = ta.value.trim();
    if (!text || text.length < 4) { fcEl.style.display = 'none'; return; }
    if (typeof classifyEdict !== 'function' || typeof EDICT_TYPES === 'undefined') { fcEl.style.display = 'none'; return; }
    var etype = classifyEdict(text);
    var t = EDICT_TYPES[etype]; if (!t) { fcEl.style.display = 'none'; return; }
    // 组装预警 HTML
    var html = '';
    html += '<div style="color:var(--gold-400);font-weight:600;">' + escHtml(t.label);
    if (typeof formatLifecycleForScript === 'function') {
      html += ' · ' + escHtml(formatLifecycleForScript(etype));
    }
    html += '</div>';
    if (t.phased) html += '<div style="color:var(--amber-400);font-size:0.68rem;">※ 改革类——分试点→推广→反扑→定局 5 阶段</div>';
    if (t.resistance) {
      var resLines = Object.keys(t.resistance).map(function(cls) { return cls + '('+t.resistance[cls]+')'; });
      if (resLines.length) html += '<div style="color:var(--vermillion-400);font-size:0.68rem;">阻力：' + escHtml(resLines.join(' / ')) + '</div>';
    }
    if (t.affectedClasses) {
      var winners = [], losers = [];
      Object.keys(t.affectedClasses).forEach(function(cls) {
        var v = t.affectedClasses[cls];
        if (v > 0) winners.push(cls+'+'+v);
        if (v < 0) losers.push(cls+v);
      });
      if (winners.length || losers.length) {
        html += '<div style="font-size:0.68rem;">';
        if (winners.length) html += '<span style="color:var(--celadon-400);">受益：' + escHtml(winners.join('、')) + '</span>';
        if (winners.length && losers.length) html += ' · ';
        if (losers.length) html += '<span style="color:var(--vermillion-400);">受损：' + escHtml(losers.join('、')) + '</span>';
        html += '</div>';
      }
    }
    if (t.unintendedRisk) {
      var riskMap = {
        middlemen_skim: '⚠ 风险：胥吏截留，惠民打折',
        peasant_revolt: '⚠ 风险：加赋过急可能引发民变',
        elite_backlash: '⚠ 风险：精英阶层反扑，反改革潮'
      };
      if (riskMap[t.unintendedRisk]) html += '<div style="color:var(--amber-400);font-size:0.68rem;">' + riskMap[t.unintendedRisk] + '</div>';
    }
    if (t.historyPaths && t.historyPaths.length) html += '<div style="color:var(--ink-300);font-size:0.65rem;">典范：' + escHtml(t.historyPaths.slice(0,3).join('、')) + '</div>';
    fcEl.innerHTML = html;
    fcEl.style.display = 'block';
  }, 500); // 500ms 防抖
}

/** 修建建筑弹窗——玩家可选已有建筑类型或自定义 */
function _dfBuildModal(divName) {
  var _old = document.getElementById('_dfBuildModal'); if (_old) _old.remove();
  var types = (P.buildingSystem && P.buildingSystem.buildingTypes) || [];
  var html = '<div class="modal-bg show" id="_dfBuildModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:560px;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.08em;">\u3014 \u4FEE\u5EFA\u4E8E' + escHtml(divName) + ' \u3015</h3>';
  html += '<div style="font-size:0.75rem;color:var(--txt-d);margin-bottom:0.6rem;line-height:1.5;">\u53EF\u9009\u5267\u672C\u5DF2\u5B9A\u4E49\u7684\u5EFA\u7B51\uFF0C\u6216\u81EA\u5B9A\u4E49\u65B0\u5EFA\u7B51\u3002AI\u5C06\u6839\u636E\u63CF\u8FF0\u5224\u5B9A\u5408\u7406\u6027\u3001\u8D39\u7528\u3001\u5DE5\u671F\u4E0E\u5B9E\u9645\u6548\u679C\u3002</div>';

  // Tab切换
  html += '<div style="display:flex;gap:4px;margin-bottom:0.5rem;">';
  html += '<button class="bt bsm" id="_bmTabPre" style="flex:1;" onclick="document.getElementById(\'_bmPre\').style.display=\'block\';document.getElementById(\'_bmCustom\').style.display=\'none\';">\u9884\u5B9A\u5EFA\u7B51</button>';
  html += '<button class="bt bsm" id="_bmTabCustom" style="flex:1;" onclick="document.getElementById(\'_bmPre\').style.display=\'none\';document.getElementById(\'_bmCustom\').style.display=\'block\';">\u81EA\u5B9A\u4E49</button>';
  html += '</div>';

  // 预定义建筑选择
  html += '<div id="_bmPre">';
  if (types.length === 0) {
    html += '<div style="color:var(--txt-d);padding:1rem;text-align:center;">\u5267\u672C\u672A\u5B9A\u4E49\u5EFA\u7B51\u7C7B\u578B\uFF0C\u8BF7\u7528\u300C\u81EA\u5B9A\u4E49\u300D</div>';
  } else {
    html += '<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:0.3rem;">';
    types.forEach(function(b, i) {
      html += '<div style="padding:0.5rem;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:6px;cursor:pointer;" onclick="_dfSubmitBuild(&quot;' + encodeURIComponent(divName) + '&quot;,' + i + ',null)">';
      html += '<div style="font-size:0.85rem;color:var(--gold);font-weight:700;">' + escHtml(b.name) + ' <span style="font-size:0.66rem;color:var(--txt-d);">[' + escHtml(b.category || '') + '] \u6700\u9AD8Lv' + (b.maxLevel||5) + ' \u57FA\u672C\u8D39' + (b.baseCost||0) + '\u4E24 \u5DE5\u671F' + (b.buildTime||3) + '\u56DE\u5408</span></div>';
      if (b.description) html += '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.5;margin-top:0.2rem;">' + escHtml(b.description.substring(0, 180)) + (b.description.length>180?'\u2026':'') + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // 自定义建筑
  html += '<div id="_bmCustom" style="display:none;">';
  html += '<div style="margin-bottom:0.5rem;"><label style="font-size:0.78rem;color:var(--gold);">\u5EFA\u7B51\u540D\u79F0</label><input id="_bmCustName" class="fd" placeholder="\u5982\uFF1A\u5174\u6587\u9986 / \u6C34\u8F66\u574A / \u7CAE\u5E93"></div>';
  html += '<div style="margin-bottom:0.5rem;"><label style="font-size:0.78rem;color:var(--gold);">\u7C7B\u522B</label><select id="_bmCustCat" class="fd">';
  ['economic:经济','military:军事','cultural:文化','administrative:行政','religious:宗教','infrastructure:基础设施'].forEach(function(p) {
    var kv = p.split(':'); html += '<option value="' + kv[0] + '">' + kv[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div style="margin-bottom:0.5rem;"><label style="font-size:0.78rem;color:var(--gold);">\u63CF\u8FF0\uFF08\u544AAI\u4F60\u60F3\u4FEE\u4EC0\u4E48\u53CA\u9884\u671F\u6548\u679C\uFF09</label><textarea id="_bmCustDesc" rows="4" class="fd" placeholder="\u4F8B\uFF1A\u4FEE\u6587\u9986\u4EE5\u85CF\u4E66\u5200\u7248\uFF0C\u4F9B\u5C9A\u9633\u5B66\u8005\u5165\u5185\u8BAE\u4E8B\uFF0C\u4EE5\u5174\u6587\u98CE\u3001\u5B89\u78A8\u58EB"></textarea></div>';
  html += '</div>';

  html += '<div style="display:flex;gap:8px;margin-top:0.8rem;justify-content:flex-end;">';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_dfBuildModal\');if(m)m.remove();">\u6492\u5E9C</button>';
  html += '<button class="bt bp" onclick="_dfSubmitBuild(&quot;' + encodeURIComponent(divName) + '&quot;,-1,true)">\u63D0\u4EA4\u81EA\u5B9A\u4E49</button>';
  html += '</div>';
  html += '</div></div>';

  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

/** 提交修建请求到诏令建议库 */
function _dfSubmitBuild(divNameEnc, typeIdx, isCustom) {
  var divName = decodeURIComponent(divNameEnc);
  var content = '';
  if (isCustom) {
    var name = (document.getElementById('_bmCustName')||{}).value || '';
    var cat = (document.getElementById('_bmCustCat')||{}).value || 'economic';
    var desc = (document.getElementById('_bmCustDesc')||{}).value || '';
    if (!name.trim() || !desc.trim()) { toast('请填写建筑名称与描述'); return; }
    content = '于 ' + divName + ' 修建【自定义 · ' + cat + '】' + name + '：' + desc + '。——请AI判定此建筑的合理性、成本、工期与实际效果。';
  } else {
    var types = (P.buildingSystem && P.buildingSystem.buildingTypes) || [];
    var b = types[typeIdx]; if (!b) return;
    content = '于 ' + divName + ' 修建 ' + b.name + (b.baseCost?'（预计费用 '+b.baseCost+' 两，工期 '+(b.buildTime||3)+' 回合）':'') + '。——请AI按其描述综合判定实际效果。';
  }
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5DE5\u7A0B', from: divName, content: content, turn: GM.turn, used: false });
  toast('\u5DF2\u5F55\u5165\u8BCF\u4EE4\u5EFA\u8BAE\u5E93\u2014\u2014\u8BF7\u5728\u8BCF\u4EE4\u533A\u7EB3\u5165\u540E\u9881\u8BCF');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_dfBuildModal'); if (m) m.remove();
}

/** 非直辖区划——中国化操作路径弹窗 */
function _dfNonDirectAction(divName, autonomyType) {
  // 找到该区划及其 autonomy
  var _found = null;
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.name === divName) _found = d;
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
  }
  if (!_found) { toast('\u672A\u627E\u5230\u533A\u5212'); return; }
  var autonomy = _found.autonomy || { type: autonomyType };
  var holder = autonomy.holder || '(\u672A\u77E5\u6301\u7235\u8005)';

  // 按类型提供中国化操作路径
  var _actions = [];
  var _title = '', _desc = '';
  if (autonomyType === 'fanguo') {
    _title = '\u5BF9\u85E9\u56FD\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E4B\u5C01\u56FD\u3002\u9675\u4E0B\u82E5\u6B32\u7F6E\u5587\uFF0C\u6709\u6570\u7B56\u53EF\u884C\uFF1A';
    _actions = [
      { label: '\u884C\u63A8\u6069\u4EE4', hint: '\u5F3A\u5236\u5206\u5C01\u5176\u5B50\u7B49\u2014\u2014\u5982\u6C49\u6B66\u6545\u4E8B\uFF0C\u6BCF\u4EE3\u5206\u8584\uFF0C\u4E94\u4EE3\u540E\u85E9\u6743\u81EA\u6D88', action: 'edict:\u5BF9' + divName + '\u8840\u8109\u884C\u63A8\u6069\u4EE4\uFF0C\u4EE4' + holder + '\u540E\u5D3F\u7686\u5E94\u5206\u5C01\uFF0C\u6BCF\u4EE3\u5206\u8584\u5176\u571F' },
      { label: '\u65AD\u7136\u524A\u85E9', hint: '\u76F4\u63A5\u5269\u593A\u85E9\u738B\u7235\u571F\u2014\u2014\u5FE0\u8BDA\u66B4\u8DCC\uFF0C\u5F88\u53EF\u80FD\u5F15\u53D1\u53DB\u4E71(\u5982\u4E03\u56FD\u4E4B\u4E71\u3001\u9756\u96BE\u4E4B\u5F79)', action: 'edict:\u524A\u85E9' + divName + '\uFF0C\u5269\u593A' + holder + '\u7235\u571F\uFF0C\u539F\u5C01\u5730\u6536\u5F52\u671D\u5EF7\u76F4\u8F96' },
      { label: '\u4F20\u65E8\u89C4\u8C0F', hint: '\u5229\u7528\u73B0\u6709\u8BCF\u4EE4\u5668\u68B0\u8F93\u9001\u610F\u5FD7\u2014\u2014\u6267\u884C\u529B\u770B\u85E9\u738B\u5FE0\u8BDA', action: 'edict:\u547D' + holder + '\u6574\u6CBB' + divName + '\uFF0C\u5174\u5229\u9664\u5F0A' },
      { label: '\u6696\u6BEB\u62DC\u547D', hint: '\u8D50\u7269\u3001\u52A0\u5C01\u3001\u4EE5\u6069\u62C9\u62E2\u85E9\u738B\u5FE0\u5FC3', action: 'edict:\u8D50' + holder + '\u6042\u5149\uFF0C\u63D0\u9AD8\u5176\u5BF9\u671D\u5EF7\u5FE0\u8BDA' }
    ];
  } else if (autonomyType === 'jimi') {
    _title = '\u5BF9\u7F81\u7E3B\u571F\u53F8\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E16\u88AD\u4E4B\u571F\u3002\u671D\u5EF7\u4F8B\u4E0D\u7F6E\u6D41\u5B98\uFF0C\u9675\u4E0B\u53EF\u884C\uFF1A';
    _actions = [
      { label: '\u6539\u571F\u5F52\u6D41', hint: '\u5C06\u571F\u53F8\u4E4B\u5730\u6539\u4E3A\u6D41\u5B98\u7BA1\u8F96\u2014\u2014\u987B\u5F85\u571F\u53F8\u53DB\u4E71\u6216\u7EDD\u55E3\uFF0C\u6216\u629B\u5F00\u540E\u679C\u5F3A\u63A8', action: 'edict:\u884C\u6539\u571F\u5F52\u6D41\u4E8E' + divName + '\uFF0C\u53D6\u6D88' + holder + '\u571F\u53F8\u8EAB\u4EFD\uFF0C\u7F6E\u6D41\u5B98\u8F96\u5236' },
      { label: '\u6566\u8C15\u5B89\u629A', hint: '\u9063\u4F7F\u6566\u8C15\u6216\u8D50\u5C01\u2014\u2014\u4EE5\u6069\u5B89\u629A\uFF0C\u7EF4\u6301\u5C5E\u4F7F\u5173\u7CFB', action: 'edict:\u9063\u4F7F\u6566\u8C15' + holder + '\uFF0C\u8D50\u5C01\u5B89\u629A\u4F7F\uFF0C\u6C38\u9547\u4E00\u65B9' },
      { label: '\u8C03\u6574\u8D21\u989D', hint: '\u589E\u51CF\u571F\u53F8\u8D21\u8D4B\u989D\u5EA6', action: 'edict:\u8C03\u6574' + holder + '\u5E74\u8D21\u989D\u5EA6' },
      { label: '\u51C6\u5176\u627F\u88AD', hint: '\u627F\u8BA4\u65B0\u4EFB\u571F\u53F8\u8EAB\u4EFD', action: 'edict:\u51C6\u4E88' + holder + '\u7236\u5B50\u627F\u88AD\u571F\u53F8\u4E4B\u804C' }
    ];
  } else if (autonomyType === 'chaogong') {
    _title = '\u5BF9\u671D\u8D21\u5916\u85E9\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E4B\u56FD\uFF0C\u5C5E\u591A\u56FD\u5916\u85E9\u3002\u5929\u671D\u4E0D\u5F97\u76F4\u8F96\uFF0C\u552F\u6709\uFF1A';
    _actions = [
      { label: '\u518C\u5C01\u5176\u541B', hint: '\u9057\u4F7F\u518C\u5C01\u5176\u56FD\u738B/\u4E16\u5B50\u2014\u2014\u5F3A\u5316\u5B97\u85E9\u5173\u7CFB', action: 'edict:\u9057\u4F7F\u518C\u5C01' + holder + '\u4E3A\u5176\u56FD\u541B\u4E3B\uFF0C\u8D50\u4E88\u507D\u547D' },
      { label: '\u52E7\u4EE4\u8FDB\u8D21', hint: '\u52E0\u4EE4\u521D\u8D21\u6216\u5047\u9053\u4ECB\u5165', action: 'edict:\u52E0\u4EE4' + holder + '\u6309\u671F\u8FDB\u8D21\uFF0C\u4EE5\u793A\u5C0A\u670F' },
      { label: '\u6D3E\u9063\u4F7F\u81E3', hint: '\u4E34\u65F6\u6D3E\u4F7F\u8C03\u89E3\u7EAA\u5F8B\u6216\u51B2\u7A81', action: 'edict:\u6D3E\u9063\u4F7F\u81E3\u524D\u5F80' + divName + '\uFF0C\u8C03\u89E3\u5B89\u629A' },
      { label: '\u5174\u5E08\u5F81\u8BA8', hint: '\u5F81\u8BA8\u5E76\u7F6E\u90E1\u2014\u2014\u6C49\u6B66\u706D\u5357\u8D8A\u6545\u4E8B\uFF0C\u9700\u5E74\u9A6C\u538B\u5883', action: 'edict:\u5174\u5E08\u5F81\u8BA8' + holder + '\uFF0C\u5E73\u5B9A\u540E\u4E8E\u5176\u5730\u7F6E\u90E1\u53BF' }
    ];
  } else if (autonomyType === 'fanzhen') {
    _title = '\u5BF9\u85E9\u9547\u3010' + divName + '\u3011\u53EF\u884C\u4E4B\u7B56';
    _desc = '\u6B64\u4E43 ' + holder + ' \u4E4B\u85E9\u9547\uFF0C\u519B\u653F\u5408\u4E00\u3002\u671D\u5EF7\u96BE\u4EE5\u8282\u5236\uFF1A';
    _actions = [
      { label: '\u5BA3\u8C15\u5165\u671D', hint: '\u52E0\u4EE4\u8282\u5EA6\u4F7F\u5165\u671D\u2014\u2014\u4E00\u822C\u88AB\u963F\u8FDE\u6216\u53CD\u62B3', action: 'edict:\u5BA3\u8C15' + holder + '\u5165\u671D\u89C1\u9A7E\uFF0C\u4EA4\u51FA\u5175\u6743' },
      { label: '\u963B\u5176\u4F20\u8896', hint: '\u963B\u6B62\u5176\u5B50\u7EE7\u627F\u85E9\u9547\u2014\u2014\u6613\u5F15\u81EA\u7ACB', action: 'edict:\u4E0D\u51C6' + holder + '\u4E4B\u5B50\u7EE7\u4EFB' + divName + '\u8282\u5EA6\u4F7F' },
      { label: '\u5174\u5E08\u8BA8\u4F10', hint: '\u76F4\u63A5\u51FA\u5175\u8BA8\u4F10', action: 'edict:\u5174\u5E08\u8BA8\u4F10' + holder + '\uFF0C\u5E73\u5B9A\u540E\u6539' + divName + '\u4E3A\u76F4\u8F96' }
    ];
  } else {
    toast('\u65E0\u53EF\u884C\u4E4B\u7B56'); return;
  }

  // 弹窗（用已有 modal-bg / modal-box CSS）
  var html = '<div class="modal-bg show" id="_dfFeudalModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:540px;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">\u3014 ' + escHtml(_title) + ' \u3015</h3>';
  html += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.7;margin-bottom:0.8rem;padding:0.5rem;background:var(--bg-2);border-radius:6px;">' + escHtml(_desc) + '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
  _actions.forEach(function(a, i) {
    html += '<div style="padding:0.6rem;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:6px;cursor:pointer;" onclick="_dfDoNonDirectAction(' + i + ',&quot;' + encodeURIComponent(divName) + '&quot;,&quot;' + encodeURIComponent(autonomyType) + '&quot;)">';
    html += '<div style="font-size:0.88rem;color:var(--gold);font-weight:700;margin-bottom:0.2rem;">' + escHtml(a.label) + '</div>';
    html += '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.5;">' + escHtml(a.hint) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="text-align:center;margin-top:0.8rem;"><button class="bt bs" onclick="var m=document.getElementById(\'_dfFeudalModal\');if(m)m.remove();">\u6492\u5E9C\u800C\u56DE</button></div>';
  html += '</div></div>';
  // 缓存动作列表供点击调用
  window._dfNonDirectActions = _actions;
  // 先移除可能存在的旧弹窗
  var _old = document.getElementById('_dfFeudalModal'); if (_old) _old.remove();
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

/** 执行中国化操作——记入诏令建议库 */
function _dfDoNonDirectAction(idx, divNameEnc, autonomyTypeEnc) {
  var divName = decodeURIComponent(divNameEnc);
  var actions = window._dfNonDirectActions || [];
  var a = actions[idx]; if (!a) return;
  // 记入诏令建议库
  var content = a.action.indexOf('edict:') === 0 ? a.action.substring(6) : a.action;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5C01\u5EFA', from: divName, content: content, turn: GM.turn, used: false });
  toast('\u3014' + a.label + '\u3015\u5DF2\u5F55\u5165\u8BCF\u4EE4\u5EFA\u8BAE\u5E93');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_dfFeudalModal'); if (m) m.remove();
}

// 左侧面板渲染
function renderLeftPanel(){
  var gl=_$("gl");if(!gl)return;
  gl.innerHTML="";
  // 标记需要在末尾追加侧面板
  var _needSidePanels = true;

  // P9: 渐进式引导（前3回合，每次renderLeftPanel都检查）
  if (GM.turn && GM.turn <= 3) {
    var _guideMap = {1:{t:'初临朝堂',h:'左侧查看资源和势力·右侧"谕令"下诏·"奏议"批折·"诏付有司"推进'},2:{t:'察言观势',h:'查看诏令执行情况·召开朝议·关注势力动态·建议库有方案'},3:{t:'运筹帷幄',h:'人物关系因决策变化·大臣记住你的选择·利用派系矛盾·此后不再提示'}};
    var _gm = _guideMap[GM.turn];
    if (_gm) {
      var _gDiv = document.createElement('div');
      _gDiv.style.cssText = 'margin-bottom:0.6rem;padding:8px;background:linear-gradient(135deg,rgba(201,169,110,0.12),rgba(201,169,110,0.04));border:1px solid var(--gold-d);border-radius:6px;position:relative;font-size:0.7rem;';
      _gDiv.innerHTML = '<span style="color:var(--gold);font-weight:700;">\u{1F4D6} ' + _gm.t + '</span> <span style="color:var(--txt-d);">(' + GM.turn + '/3)</span><br><span style="color:var(--txt-s);line-height:1.5;">' + _gm.h.split('·').map(function(s){return '\u2022'+s;}).join(' ') + '</span>'
        + '<button onclick="this.parentElement.remove();" style="position:absolute;top:4px;right:6px;background:none;border:none;color:var(--txt-d);cursor:pointer;font-size:0.65rem;">\u2715</button>';
      gl.appendChild(_gDiv);
    }
  }

  // 回合信息（增强版：年号+干支+季节+月日完整显示）
  var ti=document.createElement("div");ti.style.cssText="text-align:center;margin-bottom:0.8rem;";
  var _tsMain = getTS(GM.turn);
  var _tsExtra = '';
  if (typeof calcDateFromTurn === 'function') {
    var _cd = calcDateFromTurn(GM.turn);
    if (_cd) {
      var parts = [];
      // 干支年（始终显示）
      if (_cd.gzYearStr) parts.push(_cd.gzYearStr + '\u5E74');
      // 公元年
      parts.push('\u516C\u5143' + _cd.adYear + '\u5E74');
      // 农历月日
      if (_cd.lunarMonth) parts.push(_cd.lunarMonth + '\u6708');
      // 干支日（始终显示）
      if (_cd.gzDayStr) parts.push(_cd.gzDayStr + '\u65E5');
      _tsExtra = parts.join(' ');
    }
  }
  ti.innerHTML="<div style=\"font-size:1.4rem;font-weight:700;color:var(--gold);\">" + _tsMain + "</div>"
    + (_tsExtra ? "<div style=\"font-size:0.68rem;color:var(--txt-d);margin-top:2px;\">" + _tsExtra + "</div>" : "")
    + "<div style=\"font-size:0.72rem;color:var(--txt-d);\">" + (typeof getTSText==='function'?getTSText(GM.turn):'') + "</div>";
  gl.appendChild(ti);
  // 顶栏年号/时代指示（兼容旧/新结构）
  var barEra=_$("bar-era");
  var _sc=findScenarioById&&findScenarioById(GM.sid);
  if(barEra){ barEra.textContent=(_sc?_sc.name:'')+(GM.eraName?' · '+GM.eraName:''); }
  var _barDyn=_$("bar-dynasty"), _barDate=_$("bar-date"), _barTurnT=_$("bar-turn-text");
  if(_barDyn){ _barDyn.textContent=(_sc?_sc.name:'')+(GM.eraName?' · '+GM.eraName:''); }
  if(_barDate){ _barDate.textContent=(typeof getTSText==='function'?getTSText(GM.turn):''); }
  if(_barTurnT){ _barTurnT.textContent='第 '+(GM.turn||1)+' 回合'; }
  // 四时物候：按 GM.turn 月份推算
  var _wSeal=_$("bar-weather-seal"), _wName=_$("bar-weather-name"), _wDesc=_$("bar-weather-desc");
  if(_wSeal && _wName){
    var _mon=(((GM.turn||1)-1)%12)+1; // 1..12
    var _s='春',_sTxt='春分',_sDesc='桃李始华';
    if(_mon>=3&&_mon<=5){_s='春';_sTxt=['孟春','仲春','季春'][_mon-3];_sDesc=['立春·东风解冻','春分·雷乃发声','谷雨·萍始生'][_mon-3];}
    else if(_mon>=6&&_mon<=8){_s='夏';_sTxt=['孟夏','仲夏','季夏'][_mon-6];_sDesc=['立夏·蝼蝈鸣','夏至·蜩始鸣','大暑·腐草为萤'][_mon-6];}
    else if(_mon>=9&&_mon<=11){_s='秋';_sTxt=['孟秋','仲秋','季秋'][_mon-9];_sDesc=['立秋·凉风至','秋分·鸿雁来','霜降·草木黄落'][_mon-9];}
    else {_s='冬';var _wi=(_mon===12?0:_mon+1);_sTxt=['孟冬','仲冬','季冬'][_wi];_sDesc=['立冬·水始冰','冬至·蚯蚓结','大寒·鸡始乳'][_wi];}
    _wSeal.textContent=_s;
    _wName.textContent=_sTxt;
    if(_wDesc)_wDesc.textContent=_sDesc;
  }
  // 悬浮推演按钮 + 底栏状态条显示
  var _gsTurnFloat=_$("gs-turn-float"), _gsStatusBar=_$("gs-status-bar");
  if(_gsTurnFloat) _gsTurnFloat.classList.add('show');
  if(_gsStatusBar) _gsStatusBar.classList.add('show');
  var _gsStatusSave=_$("gs-status-save"), _gsStatusTurn=_$("gs-status-turn");
  if(_gsStatusSave) _gsStatusSave.textContent=(GM.saveName||'未命名');
  if(_gsStatusTurn) _gsStatusTurn.textContent='第 '+(GM.turn||1)+' 回合';
  // 同步悬浮推演按钮 disabled 状态
  var _gsTurnBig=_$("gs-turn-big");
  if(_gsTurnBig){
    _gsTurnBig.disabled = !!(GM.busy || GM._endTurnBusy);
  }
  // 摘要
  var _gsTurnSummary=_$("gs-turn-summary");
  if(_gsTurnSummary){
    var _ec=(GM._edictSuggestions||[]).filter(function(e){return !e.used;}).length;
    var _mc=(GM.memorials||[]).filter(function(m){return !m.reviewed;}).length;
    _gsTurnSummary.innerHTML='诏 <span class="hl">'+_ec+'</span> · 疏 <span class="hl">'+_mc+'</span>'+(_ec+_mc>0?' · <span class="warn">待处置</span>':' · <span style="color:var(--celadon-400);">朕意已决</span>');
  }
  // 顶栏七官方变量
  if(typeof renderTopBarVars==='function') renderTopBarVars();
  // 改元按钮（始终可用）
  var gaiyuanBtn=document.createElement("button");
  gaiyuanBtn.className="bt bsm";
  gaiyuanBtn.style.cssText="width:100%;margin-bottom:0.5rem;font-size:0.75rem;";
  gaiyuanBtn.innerHTML=tmIcon('scroll',12)+' 改元';
  gaiyuanBtn.onclick=function(){openGaiyuanModal();};
  gl.appendChild(gaiyuanBtn);

  // 朝代阶段徽章
  if(GM.eraState&&GM.eraState.dynastyPhase){
    var _phaseMap={founding:{icon:tmIcon('history',14),label:'开创',color:'var(--indigo-400)'},rising:{icon:tmIcon('history',14),label:'上升',color:'var(--green-400)'},peak:{icon:tmIcon('prestige',14),label:'盛世',color:'var(--gold-400)'},stable:{icon:tmIcon('execution',14),label:'承平',color:'var(--ink-300)'},decline:{icon:tmIcon('unrest',14),label:'衰落',color:'#e67e22'},declining:{icon:tmIcon('unrest',14),label:'衰落',color:'#e67e22'},crisis:{icon:tmIcon('unrest',14),label:'危局',color:'var(--vermillion-400)'},collapse:{icon:tmIcon('close',14),label:'崩溃',color:'var(--vermillion-400)'},revival:{icon:tmIcon('history',14),label:'中兴',color:'var(--green-400)'}};
    var _pi=_phaseMap[GM.eraState.dynastyPhase]||{icon:tmIcon('chronicle',14),label:GM.eraState.dynastyPhase,color:'var(--ink-300)'};
    var phDiv=document.createElement("div");
    phDiv.style.cssText="text-align:center;margin-bottom:0.5rem;padding:0.3rem 0.6rem;background:var(--bg-2);border-radius:6px;border:1px solid var(--bdr);";
    phDiv.innerHTML='<span style="font-size:0.9rem;">'+_pi.icon+'</span> <span style="font-size:0.78rem;color:'+_pi.color+';font-weight:700;">'+_pi.label+'</span>';
    var _es=GM.eraState;
    var _stability=Math.round((_es.socialStability||0.5)*100);
    var _economy=Math.round((_es.economicProsperity||0.5)*100);
    var _central=Math.round((_es.centralControl||0.5)*100);
    phDiv.innerHTML+=' <span style="font-size:0.68rem;color:var(--txt-d);">\u7A33'+_stability+'% \u7ECF'+_economy+'% \u6743'+_central+'%</span>';
    // 可展开的详细参数
    var _unity=Math.round((_es.politicalUnity||0.5)*100);
    var _culture=Math.round((_es.culturalVibrancy||0.5)*100);
    var _bureau=Math.round((_es.bureaucracyStrength||0.5)*100);
    var _mil=Math.round((_es.militaryProfessionalism||0.5)*100);
    phDiv.innerHTML+='<div style="font-size:0.6rem;color:var(--txt-d);margin-top:2px;">\u7EDF\u4E00'+_unity+'% \u6587\u5316'+_culture+'% \u5B98\u50DA'+_bureau+'% \u519B\u4E13'+_mil+'%</div>';
    gl.appendChild(phDiv);
    // 1.8: 时代双进度条
    if (GM.eraProgress) {
      var _epDiv = document.createElement("div");
      _epDiv.style.cssText = "margin-bottom:0.4rem;padding:0.3rem 0.5rem;background:var(--bg-2);border-radius:6px;font-size:0.65rem;";
      var _colPct = Math.min(100, Math.round(GM.eraProgress.collapse));
      var _resPct = Math.min(100, Math.round(GM.eraProgress.restoration));
      _epDiv.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="color:var(--vermillion-400);">\u8870\u9000 ' + _colPct + '</span><span style="color:var(--celadon-400);">\u4E2D\u5174 ' + _resPct + '</span></div>'
        + '<div style="display:flex;gap:2px;height:4px;">'
        + '<div style="flex:1;background:var(--bg-4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + _colPct + '%;background:var(--vermillion-400);border-radius:2px;"></div></div>'
        + '<div style="flex:1;background:var(--bg-4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + _resPct + '%;background:var(--celadon-400);border-radius:2px;"></div></div>'
        + '</div>';
      gl.appendChild(_epDiv);
    }
  }

  // 1.9: 外部威胁标量显示
  if (GM.borderThreat > 0) {
    var _btDiv = document.createElement("div");
    _btDiv.style.cssText = "margin-bottom:0.4rem;font-size:0.7rem;";
    var _btThresh = (P.mechanicsConfig && P.mechanicsConfig.borderThreat) || {};
    var _btCol = GM.borderThreat >= (_btThresh.criticalThreshold || 80) ? 'var(--vermillion-400)' : GM.borderThreat >= (_btThresh.warningThreshold || 60) ? '#e67e22' : 'var(--txt-d)';
    _btDiv.innerHTML = '<span style="color:' + _btCol + ';">\u8FB9\u60A3 ' + GM.borderThreat + '</span>';
    gl.appendChild(_btDiv);
  }

  // N4: 主角精力显示
  if (GM._energy !== undefined) {
    var _enDiv = document.createElement("div");
    _enDiv.id = '_energyBar';
    _enDiv.style.cssText = "margin-bottom:0.5rem;padding:0.3rem 0.5rem;background:var(--bg-2);border-radius:6px;";
    var _enPct = Math.round((GM._energy / (GM._energyMax || 100)) * 100);
    var _enColor = _enPct > 60 ? 'var(--celadon-400)' : _enPct > 30 ? 'var(--gold-400)' : 'var(--vermillion-400)';
    _enDiv.innerHTML = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:2px;">\u7CBE\u529B ' + Math.round(GM._energy) + '/' + (GM._energyMax || 100) + '</div>'
      + '<div style="height:4px;background:var(--bg-4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + _enPct + '%;background:' + _enColor + ';border-radius:2px;transition:width 0.3s;"></div></div>';
    gl.appendChild(_enDiv);
  }

  // 季节效果
  var se=getSE(GM.turn);
  if(se){
    var sed=document.createElement("div");
    var _seasonIcons={春:'〔春〕',夏:'〔夏〕',秋:'〔秋〕',冬:'〔冬〕'};
    var _curSeason=calcDateFromTurn?calcDateFromTurn(GM.turn).season:'';
    var _sIcon=_seasonIcons[_curSeason]||'〔时〕';
    sed.style.cssText="font-size:var(--text-xs);color:var(--color-foreground-secondary);text-align:center;margin-bottom:var(--space-2);padding:var(--space-1) var(--space-2);background:var(--color-sunken);border-radius:var(--radius-sm);border:1px solid var(--color-border-subtle);letter-spacing:0.08em;";
    sed.innerHTML=_sIcon+' '+se;
    gl.appendChild(sed);
  }

  // 资源
  var resDiv=document.createElement("div");resDiv.className="pt";resDiv.innerHTML=tmIcon('treasury',12)+' \u8D44\u6E90';gl.appendChild(resDiv);
  Object.entries(GM.vars).forEach(function(e){
    var v=e[1];var _range=(v.max||100)-(v.min||0);var pct=_range>0?Math.round(((v.value||0)-(v.min||0))/_range*100):50;
    var _crit=pct>85||pct<15?' critical':'';
    var rd=document.createElement("div");rd.style.cssText="margin-bottom:0.5rem;";
    rd.innerHTML='<div class="res-label"><span class="res-name">'+(v.icon||"")+e[0]+'</span><span class="res-value stat-number" style="color:'+(v.color||"var(--gold-400)")+'">'+(v.value||0)+'</span></div><div class="rb"><div class="rf'+_crit+'" style="width:'+pct+'%;background:'+(v.color||"var(--gold-400)")+';"></div></div>';
    gl.appendChild(rd);
  });

  // B4: 经济概况
  if (P.economyConfig && P.economyConfig.enabled !== false) {
    var ecDiv = document.createElement("div");
    ecDiv.style.cssText = "margin-bottom:0.5rem;font-size:var(--text-xs);color:var(--color-foreground-muted);background:var(--color-sunken);padding:var(--space-1) var(--space-2);border-radius:var(--radius-sm);border:1px solid var(--color-border-subtle);";
    var ec = P.economyConfig;
    var ecHtml = tmIcon('treasury',12) + ' ';
    ecHtml += (ec.currency || '\u8D2F');
    if (ec.economicCycle) {
      var _ecClr = ec.economicCycle === 'prosperity' ? 'var(--celadon-400)' : ec.economicCycle === 'recession' || ec.economicCycle === 'depression' ? 'var(--vermillion-400)' : 'var(--color-foreground-muted)';
      var _ecLbl = {prosperity:'\u7E41\u8363',stable:'\u7A33\u5B9A',recession:'\u8870\u9000',depression:'\u8427\u6761'}[ec.economicCycle] || '';
      ecHtml += ' <span style="color:' + _ecClr + ';">' + _ecLbl + '</span>';
    }
    ecHtml += ' \u7A0E' + Math.round((ec.taxRate || 0.1) * 100) + '%';
    if (ec.inflationRate > 0.03) ecHtml += ' \u901A\u80C0' + Math.round(ec.inflationRate * 100) + '%';
    ecDiv.innerHTML = ecHtml;
    gl.appendChild(ecDiv);
  }

  // B1: 双层国库显示
  if (P.economyConfig && P.economyConfig.dualTreasury) {
    var treasuryDiv = document.createElement("div");
    treasuryDiv.style.cssText = "margin-bottom:0.5rem;padding:0.4rem 0.5rem;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);font-size:0.75rem;";
    var _stVal = GM.stateTreasury || 0;
    var _pvVal = GM.privateTreasury || 0;
    var _stColor = _stVal < 0 ? 'var(--vermillion-400)' : 'var(--color-foreground-secondary)';
    var _pvColor = 'var(--celadon-400)';
    treasuryDiv.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:0.2rem;"><span>'+tmIcon('treasury',12)+' 国库</span><span class="stat-number" style="color:'+_stColor+';">'+Math.round(_stVal).toLocaleString()+'</span></div>'
      + '<div style="display:flex;justify-content:space-between;"><span>'+tmIcon('treasury',12)+' 内库</span><span class="stat-number" style="color:'+_pvColor+';">'+Math.round(_pvVal).toLocaleString()+'</span></div>'
      + ((GM._bankruptcyTurns||0) > 0 ? '<div style="color:var(--vermillion-400);font-size:0.65rem;margin-top:0.2rem;">〔财政危机第'+(GM._bankruptcyTurns)+'回合〕</div>' : '');
    gl.appendChild(treasuryDiv);
  }

  // P4: 财务预测——显示下回合预估收支
  if (typeof AccountingSystem !== 'undefined') {
    var _lastLedger = AccountingSystem.getLedger();
    if (_lastLedger && (_lastLedger.totalIncome > 0 || _lastLedger.totalExpense > 0)) {
      var _fcDiv = document.createElement("div");
      _fcDiv.style.cssText = "font-size:0.68rem;color:var(--txt-d);padding:2px 0.5rem;margin-bottom:0.3rem;";
      var _fcNet = _lastLedger.netChange;
      _fcDiv.innerHTML = '\u9884\u4F30\u4E0B\u56DE\u5408\uFF1A<span style="color:' + (_fcNet >= 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)') + ';">' + (_fcNet >= 0 ? '+' : '') + _fcNet.toFixed(0) + '</span>';
      gl.appendChild(_fcDiv);
    }
  }
  // 不显示荒淫值数值——玩家通过叙事和NPC反应感受

  // 主角压力显示
  if (P.playerInfo && P.playerInfo.characterName) {
    var _pChar = typeof findCharByName === 'function' ? findCharByName(P.playerInfo.characterName) : null;
    if (_pChar && (_pChar.stress || 0) > 0) {
      var pStressDiv = document.createElement("div");
      pStressDiv.style.cssText = "margin-bottom:0.4rem;";
      var pStress = _pChar.stress || 0;
      var pStressLabel = pStress > 70 ? '\u5FC3\u529B\u4EA4\u7601' : pStress > 50 ? '\u7126\u8651\u4E0D\u5B89' : pStress > 30 ? '\u7565\u611F\u7591\u60D1' : '\u5C1A\u53EF';
      var pStressColor = pStress > 70 ? 'var(--red)' : pStress > 50 ? '#e67e22' : pStress > 30 ? 'var(--blue)' : 'var(--txt-d)';
      var _moodIcon = '';
      if (_pChar._mood && _pChar._mood !== '\u5E73') {
        var _pmi = {'\u559C':'\uD83D\uDE0A','\u6012':'\uD83D\uDE20','\u5FE7':'\uD83D\uDE1F','\u60E7':'\uD83D\uDE28','\u6068':'\uD83D\uDE24','\u656C':'\uD83D\uDE4F'};
        _moodIcon = (_pmi[_pChar._mood] || '') + ' ';
      }
      pStressDiv.innerHTML = "<div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>" + _moodIcon + "\u5FC3\u5883</span><span style=\"color:" + pStressColor + ";font-size:0.7rem;\">" + pStressLabel + "</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:" + pStress + "%;background:" + pStressColor + ";\"></div></div>";
      gl.appendChild(pStressDiv);
    }
  }

  // 季度议程按钮
  var agendaBtn=document.createElement("button");
  agendaBtn.className="bt bsm";
  agendaBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  agendaBtn.innerHTML=tmIcon('agenda',14)+" \u65F6\u5C40\u8981\u52A1";
  agendaBtn.onclick=function(){openQuarterlyAgenda();};
  gl.appendChild(agendaBtn);

  // 省级经济按钮
  var provinceBtn=document.createElement("button");
  provinceBtn.className="bt bsm";
  provinceBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  provinceBtn.innerHTML=tmIcon('office',14)+" \u5730\u65B9\u533A\u5212";
  provinceBtn.onclick=function(){openProvinceEconomy();};
  gl.appendChild(provinceBtn);

  // P5: 军事面板——活跃战争概览
  if (GM.activeWars && GM.activeWars.length > 0) {
    var _warDiv = document.createElement("div");
    _warDiv.style.cssText = "margin-top:0.5rem;padding:0.4rem 0.5rem;background:rgba(192,57,43,0.1);border:1px solid var(--vermillion-400);border-radius:6px;";
    var _warHtml = '<div style="font-size:0.75rem;color:var(--vermillion-400);font-weight:700;margin-bottom:3px;">' + tmIcon('troops',12) + ' \u6D3B\u8DC3\u6218\u4E89 (' + GM.activeWars.length + ')</div>';
    GM.activeWars.forEach(function(w) {
      _warHtml += '<div style="font-size:0.7rem;color:var(--txt-s);padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05);">'
        + escHtml(w.attacker || '?') + ' \u2694\uFE0F ' + escHtml(w.defender || '?')
        + (w.warScore !== undefined ? ' <span style="color:' + (w.warScore > 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)') + ';">\u6218\u5206' + w.warScore + '</span>' : '')
        + '</div>';
    });
    _warDiv.innerHTML = _warHtml;
    gl.appendChild(_warDiv);
  }

  // 记忆锚点按钮——已隐藏（数据继续供 AI 推演记忆使用）
  // 如需调试查看，可在控制台执行 openMemoryAnchors() 或开启 P.conf.debugMemoryAnchor
  if (P.conf && P.conf.debugMemoryAnchor) {
    var memoryBtn=document.createElement("button");
    memoryBtn.className="bt bsm";
    memoryBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);opacity:0.5;";
    memoryBtn.innerHTML=tmIcon('chronicle',14)+" \u5927\u4E8B\u8BB0\uFF08\u8C03\u8BD5\uFF09";
    memoryBtn.onclick=function(){openMemoryAnchors();};
    gl.appendChild(memoryBtn);
  }

  // 天下大势按钮（合并历史事件+时代趋势）
  var situationBtn=document.createElement("button");
  situationBtn.className="bt bsm";
  situationBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  situationBtn.innerHTML=tmIcon('history',14)+" \u5929\u4E0B\u5927\u52BF";
  situationBtn.onclick=function(){openWorldSituation();};
  gl.appendChild(situationBtn);

  // AI性能监控按钮
  if (P.ai && P.ai.key) {
    var aiPerfBtn=document.createElement("button");
    aiPerfBtn.className="bt bsm";
    aiPerfBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
    aiPerfBtn.innerHTML=tmIcon('settings',14)+" AI\u8C03\u5EA6";
    aiPerfBtn.onclick=function(){openAIPerformance();};
    gl.appendChild(aiPerfBtn);
  }

  // 帮助按钮
  var helpBtn=document.createElement("button");
  helpBtn.className="bt bsm";
  helpBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  helpBtn.innerHTML=tmIcon('scroll',14)+" 帮助";
  helpBtn.onclick=function(){openHelp();};
  gl.appendChild(helpBtn);

  // 音频设置按钮
  var audioBtn=document.createElement("button");
  audioBtn.className="bt bsm";
  audioBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  audioBtn.innerHTML=tmIcon('settings',14)+" 音频";
  audioBtn.onclick=function(){openAudioSettings();};
  gl.appendChild(audioBtn);

  // 主题设置按钮
  var themeBtn=document.createElement("button");
  themeBtn.className="bt bsm";
  themeBtn.style.cssText="width:100%;margin-top:0.5rem;font-size:0.75rem;background:var(--bg-2);";
  themeBtn.innerHTML=tmIcon('policy',14)+" 主题";
  themeBtn.onclick=function(){openThemeSettings();};
  gl.appendChild(themeBtn);

  // 关系
  if(Object.keys(GM.rels).length>0){
    var relTitle=document.createElement("div");relTitle.className="pt";relTitle.textContent="\u5173\u7CFB";relTitle.style.marginTop="0.8rem";gl.appendChild(relTitle);
    Object.entries(GM.rels).forEach(function(e){
      var v=e[1];var color=v.value>30?"var(--green)":v.value<-30?"var(--red)":"var(--blue)";
      var rd=document.createElement("div");rd.style.cssText="display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.78rem;";
      rd.innerHTML="<span>"+e[0]+"</span><span style=\"color:"+color+";\">"+v.value+"</span>";
      gl.appendChild(rd);
    });
  }

  // 风闻录事（原"大事记"）——收录朝野耳目、弹章、耳报、风议、密札、登闻状
  var evtTitle=document.createElement("div");evtTitle.className="pt";evtTitle.textContent="\u98CE\u95FB\u5F55\u4E8B";evtTitle.style.marginTop="0.8rem";gl.appendChild(evtTitle);
  var evtDiv=document.createElement("div");evtDiv.id="evt-log";evtDiv.style.cssText="max-height:200px;overflow-y:auto;";
  evtDiv.innerHTML=GM.evtLog.length>0?GM.evtLog.slice(-20).reverse().map(_fmtEvt).join(""):"<div style=\"color:var(--txt-d);font-size:0.78rem;text-align:center;padding:0.5rem;\">\u6682\u65E0\u98CE\u95FB</div>";
  gl.appendChild(evtDiv);

  // P10: 上下文功能提示——根据当前游戏状态提示可做的事
  var _hints = [];
  if (GM.activeWars && GM.activeWars.length > 0) _hints.push('\u6B63\u5728\u4EA4\u6218\uFF0C\u53EF\u4E0B\u8FBE\u519B\u4EE4');
  if (GM._edictSuggestions && GM._edictSuggestions.filter(function(s){return !s.used;}).length > 0) _hints.push('\u5EFA\u8BAE\u5E93\u6709\u672A\u91C7\u7EB3\u65B9\u6848');
  if (_hints.length > 0) {
    var hintDiv = document.createElement('div');
    hintDiv.style.cssText = 'margin-top:0.5rem;padding:0.4rem;background:rgba(201,169,110,0.08);border-radius:6px;border:1px dashed var(--gold-d);';
    hintDiv.innerHTML = '<div style="font-size:0.65rem;color:var(--gold);margin-bottom:2px;">\u63D0\u793A</div>' + _hints.map(function(h){ return '<div style="font-size:0.68rem;color:var(--txt-d);line-height:1.5;">\u00B7 ' + h + '</div>'; }).join('');
    gl.appendChild(hintDiv);
  }

  // 追加侧面板（势力/阶层/党派/军事/目标等——由renderSidePanels管理）
  if (typeof renderSidePanels === 'function') renderSidePanels();
}

// 游戏主界面渲染
function openGaiyuanModal(){  var cur=GM.eraName||"";  var t=P.time;var tpy=4;if(t.perTurn==="1y")tpy=1;else if(t.perTurn==="1m")tpy=12;  var yo=Math.floor((GM.turn-1)/tpy);var y=t.year+yo;  var mo=t.startMonth||1;  var html="<div style='padding:1rem'>"+    "<div style='margin-bottom:0.8rem;color:var(--gold);font-weight:700'>"+"改元"+"</div>"+    "<div style='font-size:0.85rem;color:var(--txt-d);margin-bottom:0.8rem'>"+"当前年号："+cur+"。改元后将使用新年号。"+"</div>"+    "<div class='rw'>"+    "<div class='fd'><label>"+"新年号名"+"</label><input id='gy-name' value=''  placeholder='如建安、建兴…'></div>"+    "<div class='fd'><label>"+"起始年"+"</label><input type='number' id='gy-year' value='"+y+"'></div>"+    "<div class='fd'><label>"+"起始月"+"</label><input type='number' id='gy-month' min='1' max='12' value='"+mo+"'></div>"+    "<div class='fd'><label>"+"起始日"+"</label><input type='number' id='gy-day' min='1' max='31' value='1'></div>"+    "</div></div>";  openGenericModal("改元",html,function(){    var name=(_$("gy-name")||{}).value||"";    if(!name){toast("年号名不能为空");return false;}    var ey=parseInt((_$("gy-year")||{}).value)||y;    var em=parseInt((_$("gy-month")||{}).value)||mo;    var ed=parseInt((_$("gy-day")||{}).value)||1;    if(!GM.eraNames)GM.eraNames=[];    GM.eraNames.push({name:name,startYear:ey,startMonth:em,startDay:ed});    GM.eraName=name;    if(!P.time.eraNames)P.time.eraNames=[];    P.time.eraNames.push({name:name,startYear:ey,startMonth:em,startDay:ed});    P.time.enableEraName=true;    saveP();renderLeftPanel();    toast("改元为"+name+"元年");  });}// ============================================================
// Tooltip 系统（轻量单例）
// ============================================================
var TmTooltip = {
  _el: null,
  _timer: null,
  _getEl: function() {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'tm-tooltip';
      document.body.appendChild(this._el);
    }
    return this._el;
  },
  show: function(anchor, html) {
    var el = this._getEl();
    el.innerHTML = html;
    el.classList.add('visible');
    // 定位：优先锚点下方
    var r = anchor.getBoundingClientRect();
    var top = r.bottom + 6;
    var left = r.left;
    // 溢出翻转
    if (top + 200 > window.innerHeight) top = r.top - el.offsetHeight - 6;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
    if (left < 4) left = 4;
    el.style.top = top + 'px';
    el.style.left = left + 'px';
  },
  hide: function() {
    if (this._el) this._el.classList.remove('visible');
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  },
  /** 绑定hover tooltip到元素 */
  bind: function(el, contentFn) {
    var self = this;
    el.addEventListener('mouseenter', function() {
      self._timer = setTimeout(function() { self.show(el, contentFn()); }, 120);
    });
    el.addEventListener('mouseleave', function() { self.hide(); });
  }
};

// ============================================================
// 全局资源栏渲染（顶栏动态指标+回合变化量）
// ============================================================
function renderBarResources() {
  var bar = _$('bar');
  if (!bar || !GM.running) return;
  var container = bar.querySelector('.bar-resources');
  if (!container) {
    container = document.createElement('div');
    container.className = 'bar-resources';
    var btns = _$('bar-btns');
    if (btns) bar.insertBefore(container, btns);
    else bar.appendChild(container);
  }
  // 顶栏指标待重新规划——GM.vars 自定义资源已撤出
  container.innerHTML = '';
}

// ============================================================
// 角色详情——人物志完整页（6-tab 布局，匹配 preview-char-full.html）
// ============================================================
// 人物志面板 → 官制入口(关闭人物志+切官制 tab·高亮目标官职)
function _rwpOpenOffice(name) {
  if (!name) return;
  try { document.getElementById('_renwuPageOv') && document.getElementById('_renwuPageOv').classList.remove('open'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  if (typeof switchGTab === 'function') switchGTab(null, 'gt-office');
  if (typeof renderOfficeTree === 'function') setTimeout(function(){ try { renderOfficeTree(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}} }, 50);
  if (typeof toast === 'function') toast('已切至官制·查看 '+name+' 职位');
}
// 人物志面板 → 问对入口(关闭人物志+打开问对弹窗)
function _rwpOpenWendui(name) {
  if (!name) return;
  try { document.getElementById('_renwuPageOv') && document.getElementById('_renwuPageOv').classList.remove('open'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  if (typeof openWenduiModal === 'function') {
    openWenduiModal(name, 'private');
  } else {
    // 降级：切到问对 tab + 设置 target
    try { GM.wenduiTarget = name; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
    if (typeof switchGTab === 'function') switchGTab(null, 'gt-wendui');
    if (typeof toast === 'function') toast('已切至问对·' + name);
  }
}
// 人物志面板 → 传书入口(关闭人物志+切传书 tab·预填收信人)
function _rwpOpenLetter(name) {
  if (!name) return;
  try { document.getElementById('_renwuPageOv') && document.getElementById('_renwuPageOv').classList.remove('open'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  if (typeof switchGTab === 'function') switchGTab(null, 'gt-letter');
  // 预填目标
  setTimeout(function(){
    try {
      var toInp = document.getElementById('letter-to') || document.querySelector('[data-role="letter-to"]');
      if (toInp) { toInp.value = name; if (typeof toInp.dispatchEvent === 'function') toInp.dispatchEvent(new Event('input', { bubbles: true })); }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
    if (typeof renderLetterPanel === 'function') renderLetterPanel();
  }, 50);
  if (typeof toast === 'function') toast('可传书予·' + name);
}
function _rwpFameSeal(fame) {
  var v = typeof fame === 'number' ? fame : (fame && fame.value) || 0;
  if (v >= 80) return { cls: 'radiant', label: '+' + Math.round(v) + ' 朝宗' };
  if (v >= 50) return { cls: 'bright', label: '+' + Math.round(v) + ' 儒望' };
  if (v >= 20) return { cls: 'clear', label: '+' + Math.round(v) + ' 清誉' };
  if (v > -10) return { cls: 'neutral', label: (v >= 0 ? '+' : '') + Math.round(v) + ' 无闻' };
  if (v > -40) return { cls: 'stain', label: Math.round(v) + ' 微瑕' };
  return { cls: 'infamy', label: Math.round(v) + ' 恶名' };
}
function _rwpXianTier(virtue) {
  var v = typeof virtue === 'number' ? virtue : (virtue && virtue.merit) || 0;
  if (v >= 800) return '师表';
  if (v >= 500) return '朝宗';
  if (v >= 300) return '儒望';
  if (v >= 150) return '清誉';
  if (v >= 50) return '有闻';
  return '未识';
}
function _rwpXianPct(virtue) {
  var v = typeof virtue === 'number' ? virtue : (virtue && virtue.merit) || 0;
  var stages = [0, 50, 150, 300, 500, 800];
  for (var i = stages.length - 1; i >= 0; i--) {
    if (v >= stages[i]) {
      var next = stages[i + 1] || 1000;
      return Math.max(0, Math.min(100, ((v - stages[i]) / (next - stages[i])) * 100));
    }
  }
  return 0;
}
function _rwpAbilityRank(v) {
  if (v >= 85) return 'excel';
  if (v >= 70) return 'good';
  if (v >= 40) return '';
  return 'poor';
}
function _rwpAbilityRankLabel(v) {
  if (v >= 90) return '卓异';
  if (v >= 80) return '优秀';
  if (v >= 70) return '中上';
  if (v >= 50) return '寻常';
  if (v >= 30) return '稍逊';
  return '下愚';
}
function _rwpMoodCls(emotion) {
  var map = {'喜':'happy','怒':'angry','忧':'worry','惧':'fear','恨':'hate','敬':'respect','平':'peace'};
  return map[emotion] || 'peace';
}
function _rwpLoyaltyTag(v) {
  if (v >= 80) return '忠贞可托';
  if (v >= 60) return '尚堪一用';
  if (v >= 40) return '貌合神离';
  if (v >= 20) return '心怀异志';
  return '叛骨天成';
}
function _rwpAmbitionTag(v) {
  if (v >= 80) return '志在九霄';
  if (v >= 60) return '图有远略';
  if (v >= 40) return '知进退';
  if (v >= 20) return '安守本分';
  return '淡泊无求';
}
function _rwpHeartVerdict(loy, amb) {
  if (loy >= 70 && amb <= 60) return { cls: '', text: '可 托 以 一 方 · 良 臣 之 选' };
  if (loy >= 70 && amb > 60) return { cls: 'warn', text: '忠 而 有 志 · 宜 善 驭 之' };
  if (loy < 40 && amb >= 70) return { cls: 'danger', text: '心 怀 异 志 · 慎 防 反 侧' };
  if (loy < 40) return { cls: 'warn', text: '忠 诚 可 疑 · 须 加 看 护' };
  return { cls: '', text: '中 规 中 矩 · 可 观 后 效' };
}

/** 渲染八才雷达 SVG */
function _rwpRenderRadar(ch) {
  // 8维：智武军政管魅交仁
  var abilities = [
    { key: 'intelligence', label: '智', val: ch.intelligence || 50 },
    { key: 'valor', label: '武', val: ch.valor || 50 },
    { key: 'military', label: '军', val: ch.military || 50 },
    { key: 'administration', label: '政', val: ch.administration || 50 },
    { key: 'management', label: '管', val: ch.management || ch.administration || 50 },
    { key: 'charisma', label: '魅', val: ch.charisma || 50 },
    { key: 'diplomacy', label: '交', val: ch.diplomacy || 50 },
    { key: 'benevolence', label: '仁', val: ch.benevolence || 50 }
  ];
  var cx = 110, cy = 110, rMax = 80;
  // 生成数据多边形点
  var dataPts = abilities.map(function(a, i) {
    var angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
    var r = (a.val / 100) * rMax;
    return (cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1);
  }).join(' ');
  // 8条轴线 + 标签位置
  var axisLines = '', labels = '', dots = '';
  abilities.forEach(function(a, i) {
    var angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
    var ex = cx + rMax * Math.cos(angle);
    var ey = cy + rMax * Math.sin(angle);
    axisLines += '<line x1="'+cx+'" y1="'+cy+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'"/>';
    var lx = cx + (rMax + 14) * Math.cos(angle);
    var ly = cy + (rMax + 14) * Math.sin(angle) + 4;
    labels += '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'">'+a.label+'</text>';
    var pr = (a.val / 100) * rMax;
    var px = cx + pr * Math.cos(angle);
    var py = cy + pr * Math.sin(angle);
    dots += '<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="2.5"/>';
  });
  // 网格多边形（4层）
  var grids = '';
  [0.25, 0.5, 0.75, 1.0].forEach(function(scale) {
    var pts = abilities.map(function(_, i) {
      var angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
      var r = scale * rMax;
      return (cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1);
    }).join(' ');
    grids += '<polygon points="'+pts+'"/>';
  });
  var svg = '<svg class="rwp-radar" viewBox="0 0 220 220">' +
    '<g stroke="rgba(184,154,83,0.12)" fill="none" stroke-width="1">' + grids + '</g>' +
    '<g stroke="rgba(184,154,83,0.15)" stroke-width="1">' + axisLines + '</g>' +
    '<polygon points="'+dataPts+'" fill="rgba(184,154,83,0.2)" stroke="var(--gold-400)" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<g fill="var(--gold-300)">' + dots + '</g>' +
    '<g fill="var(--ink-300)" font-size="11" font-family="serif" text-anchor="middle" letter-spacing="2">' + labels + '</g>' +
    '</svg>';
  return { svg: svg, abilities: abilities };
}

/** 渲染简化家族树 SVG */
function _rwpRenderFamilyTree(ch) {
  var members = (ch.familyMembers && Array.isArray(ch.familyMembers)) ? ch.familyMembers : [];
  if (members.length === 0) return '<div style="padding:24px;text-align:center;color:#d4be7a;font-style:italic;">家 谱 暂 缺 · 史 笔 未 录</div>';
  // 按代分组
  var groups = {'-2':[],'-1':[],'0':[],'1':[],'2':[]};
  members.forEach(function(m) {
    var g = m.generation !== undefined ? m.generation : 0;
    if (groups[g]) groups[g].push(m);
  });
  // 本人加入 gen 0
  groups[0].unshift({ name: ch.name, zi: ch.zi, relation: '本人', self: true, age: ch.age, title: ch.title||ch.officialTitle||'' });
  var svg = '<svg viewBox="0 0 900 580" class="rwp-ft-svg">';
  var genLabels = {'-2':'祖 辈','-1':'父 辈','0':'同 辈','1':'子 嗣','2':'孙 辈'};
  var yMap = {'-2':35, '-1':155, '0':275, '1':400, '2':525};
  // 世代标签
  svg += '<g class="ft-gen-labels" font-family="serif" font-size="11" letter-spacing="3" fill="#8a6d2b">';
  Object.keys(genLabels).forEach(function(g) {
    if (groups[g] && groups[g].length > 0) svg += '<text x="14" y="'+(yMap[g]+25)+'">'+genLabels[g]+'</text>';
  });
  svg += '<line x1="8" y1="35" x2="8" y2="555" stroke="#8a6d2b" stroke-width="1" opacity="0.4"/></g>';
  // 节点
  svg += '<g class="ft-nodes" font-family="serif">';
  Object.keys(groups).forEach(function(g) {
    var row = groups[g];
    if (!row.length) return;
    var startX = 60;
    var gap = Math.min(120, (820 - 100) / row.length);
    row.forEach(function(m, i) {
      var x = startX + i * gap;
      var y = yMap[g];
      var dead = m.dead || m.deceased;
      var inLaw = m.inLaw || m.relation && /妻|嫂|媳|姻/.test(m.relation);
      var cls = m.self ? 'self' : (dead ? 'dead' : (inLaw ? 'in-law' : ''));
      var rectFill = m.self ? 'rgba(184,154,83,0.12)' : (inLaw ? 'rgba(126,184,167,0.05)' : 'rgba(0,0,0,0.3)');
      var rectStroke = m.self ? '#d4be7a' : (inLaw ? '#7eb8a7' : '#b89a53');
      var rectStrokeW = m.self ? '2' : '1';
      var dashAttr = inLaw ? ' stroke-dasharray="3,2"' : '';
      var textColor = m.self ? '#d4be7a' : (dead ? '#9d917d' : (inLaw ? '#d4c9b0' : '#f8f3e8'));
      var relColor = m.self ? '#d4be7a' : (inLaw ? '#7eb8a7' : '#b89a53');
      svg += '<g class="ft-node '+cls+'" transform="translate('+x+','+y+')">';
      svg += '<rect width="100" height="'+(m.self?50:40)+'" rx="4" fill="'+rectFill+'" stroke="'+rectStroke+'" stroke-width="'+rectStrokeW+'"'+dashAttr+'/>';
      svg += '<text x="50" y="16" text-anchor="middle" font-size="9" fill="'+relColor+'" letter-spacing="2">'+(m.relation||'亲属')+'</text>';
      svg += '<text x="50" y="'+(m.self?33:29)+'" text-anchor="middle" font-size="'+(m.self?15:13)+'" fill="'+textColor+'" '+(m.self?'font-weight="bold"':'')+'>'+escHtml((m.name||'')+(dead?' †':''))+'</text>';
      var sub = '';
      if (m.self) sub = (m.zi?'字'+m.zi+' · ':'') + (m.age?m.age+' · ':'') + (m.title||'');
      else sub = (m.age?m.age+' · ':'') + (m.title||m.note||'');
      svg += '<text x="50" y="'+(m.self?44:38)+'" text-anchor="middle" font-size="'+(m.self?9:8)+'" fill="'+(m.self?'#b89a53':'#9d917d')+'">'+escHtml(sub)+'</text>';
      svg += '</g>';
    });
  });
  svg += '</g></svg>';
  return svg;
}

// ───────────────────────────────────────────────────────────────────
// 快速详情面板 openCharDetail（440px 右滑，点角色名入口）
// ───────────────────────────────────────────────────────────────────
function openCharDetail(charName) {
  var ch = typeof findCharByName === 'function' ? findCharByName(charName) : null;
  if (!ch) { toast('未找到角色'); return; }
  if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureFullFields === 'function') {
    try { CharFullSchema.ensureFullFields(ch); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  } else if (typeof CharEconEngine !== 'undefined' && typeof CharEconEngine.ensureCharResources === 'function') {
    try { CharEconEngine.ensureCharResources(ch); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  }

  var ov = document.getElementById('_charDetailOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '_charDetailOv';
    ov.className = 'char-detail-overlay';
    ov.innerHTML = '<div class="char-detail-panel" id="_charDetailPanel"></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.remove('open'); });
    document.body.appendChild(ov);
  }
  var panel = document.getElementById('_charDetailPanel');

  var loy = Math.round(ch.loyalty || 50);
  var amb = Math.round(ch.ambition || 50);
  var res = ch.resources || {};
  var pub = res.publicPurse || res.publicTreasury || {};
  var priv = res.privateWealth || {};
  var fame = res.fame !== undefined ? res.fame : 0;
  var virtue = res.virtueMerit !== undefined ? res.virtueMerit : 0;
  var health = Math.round(res.health !== undefined ? res.health : (ch.health !== undefined ? ch.health : 80));
  var stress = Math.round(res.stress !== undefined ? res.stress : (ch.stress || 0));
  var gender = ch.gender || (ch.isFemale ? 'female' : 'male');
  // 兼容中/英 gender 值：'女'|'female' 视为女·'男'|'male' 视为男
  var isFemale = (gender === 'female' || gender === '女' || ch.isFemale === true);
  var age = ch.age || '';
  var fameS = _rwpFameSeal(fame);
  var xianTier = _rwpXianTier(virtue);
  var radar = _rwpRenderRadar(ch);
  var safeName = (ch.name||'').replace(/'/g, "\\'").replace(/"/g, '&quot;');

  var h = '';
  // 头部
  h += '<div class="qp-head">';
  var portraitInner = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" alt="">' : escHtml((ch.name||'').charAt(0));
  h += '<div class="qp-portrait">'+portraitInner+'</div>';
  h += '<div class="qp-heading">';
  h += '<div><span class="qp-name">' + escHtml(ch.name || '') + '</span>';
  if (ch.zi || ch.courtesyName) h += '<span class="qp-courtesy">'+escHtml(ch.zi||ch.courtesyName)+'</span>';
  if (gender) h += '<span class="qp-gender-age">' + (isFemale?'♀':'♂') + (age?age:'') + '</span>';
  h += '</div>';
  if (ch.title || ch.officialTitle) {
    h += '<div class="qp-title">' + escHtml(ch.officialTitle || ch.title || '');
    if (ch.rankLevel) h += ' · ' + (typeof rankLevelToText === 'function' ? rankLevelToText(ch.rankLevel) : '品级'+ch.rankLevel);
    h += '</div>';
  }
  h += '<div class="qp-location-line">';
  if (ch.location) {
    h += '<span class="rwp-mini-tag loc" style="font-size:9px;">'+escHtml(ch.location)+'</span>';
    if (ch._travelTo) h += '<span class="rwp-mini-tag travel" style="font-size:9px;">→'+escHtml(ch._travelTo)+'</span>';
  }
  if (ch.faction) h += '<span class="rwp-mini-tag fac" style="font-size:9px;">'+escHtml(ch.faction)+(ch.party?' · '+escHtml(ch.party):'')+'</span>';
  h += '</div>';
  h += '</div>';
  h += '<button class="qp-close" onclick="document.getElementById(\'_charDetailOv\').classList.remove(\'open\')">×</button>';
  h += '</div>';

  // 心性
  var loyCol = loy>=70?'var(--celadon-300)':loy<=30?'var(--vermillion-300)':'var(--ink-50)';
  var ambCol = amb>=70?'var(--purple-400,#8e44ad)':'var(--ink-50)';
  h += '<div class="qp-sec"><div class="qp-sec-title">心 性</div>';
  h += '<div class="qp-heart-mini">';
  h += '<div class="qp-heart-mini-item loy"><span class="qp-heart-mini-lb">忠</span><span class="qp-heart-mini-v" style="color:'+loyCol+';">'+loy+'</span></div>';
  h += '<div class="qp-heart-mini-item amb"><span class="qp-heart-mini-lb">野</span><span class="qp-heart-mini-v" style="color:'+ambCol+';">'+amb+'</span></div>';
  h += '</div></div>';

  // 品行状态四格
  var hCls = health>=70?'':health>=40?'warn':'crit';
  var sCls = stress>=70?'crit':stress>=40?'warn':'';
  h += '<div class="qp-sec"><div class="qp-sec-title">品 行 状 态</div>';
  h += '<div class="rwp-stats-row" style="gap:6px;">';
  h += '<div class="rwp-stat-card" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">名望</div><div class="rwp-fame-seal '+fameS.cls+'" style="font-size:10px;padding:2px 6px;">'+fameS.label+'</div></div>';
  h += '<div class="rwp-stat-card rwp-xian-card" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">贤能</div><div class="rwp-stat-card-value" style="font-size:16px;">'+Math.round(virtue)+'</div><div class="rwp-xian-tier" style="font-size:8px;">'+xianTier+'</div></div>';
  h += '<div class="rwp-stat-card rwp-health-card '+hCls+'" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">健</div><div class="rwp-stat-card-value" style="font-size:16px;">'+health+'</div></div>';
  h += '<div class="rwp-stat-card rwp-health-card '+sCls+'" style="padding:6px 4px;"><div class="rwp-stat-card-label" style="font-size:9px;">压</div><div class="rwp-stat-card-value" style="font-size:16px;">'+stress+'</div></div>';
  h += '</div></div>';

  // 公库·私产（压缩）
  h += '<div class="qp-sec"><div class="qp-sec-title">公 库 · 私 产</div>';
  h += '<div class="rwp-grid-2" style="gap:6px;">';
  var pubMoney = pub.money || pub.balance || 0;
  var pubGrain = pub.grain || 0;
  var pubCloth = pub.cloth || 0;
  var prMoney = priv.money || priv.cash || 0;
  var prGrain = priv.grain || 0;
  var prCloth = priv.cloth || 0;
  h += '<div style="padding:6px 8px;background:rgba(0,0,0,0.25);border-radius:3px;">';
  h += '<div style="font-size:9px;color:var(--gold-400);letter-spacing:0.2em;text-align:center;margin-bottom:3px;">公 库</div>';
  h += '<div style="font-size:10px;line-height:1.7;">钱 '+_fmtShort(pubMoney)+' · 粮 '+_fmtShort(pubGrain)+' · 布 '+_fmtShort(pubCloth)+'</div></div>';
  h += '<div style="padding:6px 8px;background:rgba(0,0,0,0.25);border-radius:3px;">';
  h += '<div style="font-size:9px;color:var(--gold-400);letter-spacing:0.2em;text-align:center;margin-bottom:3px;">私 产</div>';
  h += '<div style="font-size:10px;line-height:1.7;"><span'+(prMoney<0?' style="color:var(--vermillion-300);"':'')+'>钱 '+(prMoney<0?'-':'')+_fmtShort(Math.abs(prMoney))+'</span> · 粮 '+_fmtShort(prGrain)+' · 布 '+_fmtShort(prCloth)+'</div></div>';
  h += '</div></div>';

  // 能力八才（紧凑 2x4）
  h += '<div class="qp-sec"><div class="qp-sec-title">能 力 八 才</div>';
  h += '<div class="rwp-ability-grid" style="gap:4px;">';
  var abLabels = {intelligence:'智',valor:'武',military:'军',administration:'政',management:'管',charisma:'魅',diplomacy:'交',benevolence:'仁'};
  var rkShort = {excel:'优',good:'良','':'寻',poor:'逊'};
  radar.abilities.forEach(function(a) {
    var rk = _rwpAbilityRank(a.val);
    h += '<div class="rwp-ability-cell '+rk+'" style="padding:4px 8px;"><span class="rwp-ability-cell-name" style="font-size:11px;">'+abLabels[a.key]+'</span>';
    h += '<div class="rwp-ability-cell-right"><span class="rwp-ability-cell-value" style="font-size:14px;">'+a.val+'</span>';
    h += '<span class="rwp-ability-cell-rank" style="font-size:9px;">'+rkShort[rk]+'</span></div></div>';
  });
  h += '</div></div>';

  // 五常
  if (typeof calculateWuchang === 'function') {
    var wc = calculateWuchang(ch);
    h += '<div class="qp-sec"><div class="qp-sec-title">五 常 · 气 质</div>';
    h += '<div class="rwp-stat-grid five" style="gap:3px;">';
    ['仁','义','礼','智','信'].forEach(function(k) {
      h += '<div class="rwp-stat" style="padding:4px;"><div class="rwp-stat-label">'+k+'</div><div class="rwp-stat-value" style="font-size:12px;">'+(wc[k]||0)+'</div></div>';
    });
    h += '</div>';
    if (wc.气质) h += '<div style="font-size:10px;color:var(--gold-400);text-align:center;margin-top:4px;letter-spacing:0.2em;">气质 · '+wc.气质+'</div>';
    h += '</div>';
  }

  // 特质 · 情绪
  var hasTraits = (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions);
  var mood = '';
  if (ch._memory && ch._memory.length > 0) {
    var recent = ch._memory.slice(-3);
    var moodCount = {};
    recent.forEach(function(m) { if (m.emotion) moodCount[m.emotion] = (moodCount[m.emotion]||0) + 1; });
    var maxN = 0;
    Object.keys(moodCount).forEach(function(k) { if (moodCount[k] > maxN) { maxN = moodCount[k]; mood = k; } });
  }
  if (hasTraits || mood) {
    h += '<div class="qp-sec"><div class="qp-sec-title">特 质 · 情 绪</div>';
    if (hasTraits) {
      h += '<div>';
      ch.traitIds.slice(0, 5).forEach(function(tid) {
        var d = P.traitDefinitions.find(function(t) { return t.id === tid; });
        if (!d) return;
        var cls = 'gold';
        if (d.dims && d.dims.boldness > 0.2) cls = 'valor';
        else if (d.dims && d.dims.compassion > 0.2) cls = 'heart';
        else if (d.dims && d.dims.rationality > 0.2) cls = 'mind';
        h += '<span class="rwp-trait-tag '+cls+'" style="font-size:10px;padding:2px 8px;">'+escHtml(d.name)+'</span>';
      });
      h += '</div>';
    }
    if (mood && mood !== '平') {
      var mCls = _rwpMoodCls(mood);
      var mTxt = {'喜':'心境欣然','怒':'怒气未消','忧':'心事深重','惧':'惶恐难安','恨':'怨恨难消','敬':'心怀感念'}[mood] || mood;
      h += '<div style="margin-top:6px;"><span class="rwp-mood-chip '+mCls+'" style="font-size:11px;padding:3px 10px;">〔'+mood+'〕'+mTxt+'</span></div>';
    }
    h += '</div>';
  }

  // 外貌 / 生平（省略号）
  if (ch.appearance) {
    h += '<div class="qp-sec"><div class="qp-sec-title">外 貌</div>';
    h += '<div class="rwp-prose italic" style="font-size:11px;padding:6px 10px;line-height:1.6;text-indent:0;">'+escHtml(ch.appearance)+'</div></div>';
  }
  if (ch.bio) {
    h += '<div class="qp-sec"><div class="qp-sec-title">生 平</div>';
    h += '<div class="rwp-prose" style="font-size:11px;padding:6px 10px;line-height:1.6;text-indent:0;">'+escHtml(ch.bio.length>160?ch.bio.slice(0,160)+'……':ch.bio)+'</div></div>';
  }

  // 近五记忆
  if (ch._memory && ch._memory.length > 0) {
    h += '<div class="qp-sec"><div class="qp-sec-title">近 五 记 忆</div>';
    h += '<div style="font-size:11px;">';
    ch._memory.slice(-5).reverse().forEach(function(m) {
      var mc = _rwpMoodCls(m.emotion);
      h += '<div class="rwp-mem '+mc+'" style="padding:3px 0 3px 10px;font-size:10px;"><span class="rwp-mem-mood '+mc+'">〔'+m.emotion+'〕</span>'+escHtml((m.event||'').slice(0,36));
      if (m.who) h += '<span class="rwp-mem-who">('+escHtml(m.who)+')</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  // 志向
  if (ch.personalGoal) {
    var gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : 0;
    var gpc = gsat>=60?'var(--celadon-300)':gsat>=30?'var(--gold-300)':'var(--vermillion-300)';
    h += '<div class="qp-sec"><div class="qp-sec-title">个 人 志 向</div>';
    h += '<div style="padding:8px 10px;background:rgba(0,0,0,0.22);border-left:2px solid var(--gold-500);border-radius:0 3px 3px 0;font-size:11px;line-height:1.6;">';
    h += escHtml(ch.personalGoal);
    h += '<div style="margin-top:4px;font-size:10px;"><span style="color:#d4be7a;">满足度</span> <span style="color:'+gpc+';font-weight:600;">'+gsat+'%</span></div>';
    h += '</div></div>';
  }

  // 入口到完整人物志
  h += '<div class="qp-link-more" onclick="openCharRenwuPage(\''+safeName+'\')">〔 点 开 人 物 志 查 看 完 整 〕</div>';

  panel.innerHTML = h;
  ov.classList.add('open');
}

function _fmtShort(v) {
  v = v || 0;
  if (Math.abs(v) >= 10000) return (v/10000).toFixed(1)+'万';
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  return Math.round(v);
}

// ───────────────────────────────────────────────────────────────────
// 人物志完整页 openCharRenwuPage（1120px 居中，6 Tab，双击或点"完整人物志"入口）
// ───────────────────────────────────────────────────────────────────
function openCharRenwuPage(charName) {
  var ch = typeof findCharByName === 'function' ? findCharByName(charName) : null;
  if (!ch) { toast('未找到角色'); return; }
  if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureFullFields === 'function') {
    try { CharFullSchema.ensureFullFields(ch); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-game-engine');}catch(_){}}
  }

  var ov = document.getElementById('_renwuPageOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '_renwuPageOv';
    ov.className = 'renwu-page-overlay';
    ov.innerHTML = '<div class="renwu-page-container" id="_renwuPageContainer"></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.remove('open'); });
    document.body.appendChild(ov);
  }
  var panel = document.getElementById('_renwuPageContainer');

  // ─── 数据预备 ───
  var loy = Math.round(ch.loyalty || 50);
  var amb = Math.round(ch.ambition || 50);
  var res = (ch.resources || {});
  var pub = res.publicPurse || res.publicCoffers || {};
  var priv = res.privateWealth || {};
  var fame = res.fame !== undefined ? res.fame : (res.fameValue || 0);
  var virtue = res.virtueMerit !== undefined ? res.virtueMerit : (res.virtue || 0);
  var health = Math.round(res.health !== undefined ? res.health : (ch.health !== undefined ? ch.health : 80));
  var stress = Math.round(res.stress !== undefined ? res.stress : (ch.stress || 0));
  var gender = ch.gender || (ch.isFemale ? 'female' : 'male');
  var isFemale = (gender === 'female' || gender === '女' || ch.isFemale === true);
  var age = ch.age || '';
  var fameS = _rwpFameSeal(fame);
  var xianTier = _rwpXianTier(virtue);
  var xianPct = _rwpXianPct(virtue);
  var radar = _rwpRenderRadar(ch);

  // ─── 头部区 ───
  var h = '<div class="rwp-top">';
  h += '<div class="rwp-identity-row">';
  // 头像
  var portraitInner = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" alt="">' : escHtml((ch.name||'').charAt(0));
  h += '<div class="rwp-portrait'+(ch.portrait?' has-image':'')+'">'+portraitInner+'</div>';
  // 身份体
  h += '<div class="rwp-ident-body">';
  h += '<div class="rwp-name-row">';
  h += '<div class="rwp-name">' + escHtml(ch.name || '') + '</div>';
  if (ch.zi || ch.courtesyName) h += '<div class="rwp-courtesy">'+escHtml(ch.zi || ch.courtesyName)+'</div>';
  if (gender) h += '<span class="rwp-gender '+(isFemale?'female':'male')+'">'+(isFemale?'女':'男')+(age?' · '+age:'')+'</span>';
  h += '</div>';
  // 官职
  if (ch.title || ch.officialTitle) {
    h += '<div class="rwp-title"><b>' + escHtml(ch.officialTitle || ch.title || '') + '</b>';
    if (ch.rankLevel) h += ' · ' + (typeof rankLevelToText === 'function' ? rankLevelToText(ch.rankLevel) : '品级'+ch.rankLevel);
    h += '</div>';
  }
  // mini tags
  h += '<div class="rwp-mini-tags">';
  if (ch.location) {
    h += '<span class="rwp-mini-tag loc">所在地 '+escHtml(ch.location)+'</span>';
    if (ch._travelTo) h += '<span class="rwp-mini-tag travel">→ '+escHtml(ch._travelTo)+'</span>';
  }
  if (ch.faction) h += '<span class="rwp-mini-tag fac">势力 · '+escHtml(ch.faction)+'</span>';
  if (ch.family) {
    var tierMap = {imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'};
    h += '<span class="rwp-mini-tag clan">'+escHtml(ch.family)+(ch.familyTier?' · '+(tierMap[ch.familyTier]||ch.familyTier):'')+'</span>';
  }
  if (ch.learning) h += '<span class="rwp-mini-tag origin">'+escHtml(ch.learning)+'</span>';
  if (ch.birthplace) h += '<span class="rwp-mini-tag">籍贯 '+escHtml(ch.birthplace)+'</span>';
  if (ch.ethnicity || ch.faith) h += '<span class="rwp-mini-tag">'+(ch.ethnicity||'')+(ch.ethnicity&&ch.faith?' · ':'')+(ch.faith||'')+'</span>';
  if (ch.culture) h += '<span class="rwp-mini-tag">'+escHtml(ch.culture)+'</span>';
  if (ch.party) h += '<span class="rwp-mini-tag">'+escHtml(ch.party+(ch.partyRank?' · '+ch.partyRank:''))+'</span>';
  h += '</div>';
  h += '</div>';
  // 操作按钮
  h += '<div class="rwp-actions">';
  var safeName = (ch.name||'').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  if (GM.running) {
    h += '<button class="rwp-act-btn" onclick="_rwpOpenWendui(\''+safeName+'\')">问 对</button>';
    h += '<button class="rwp-act-btn" onclick="_rwpOpenLetter(\''+safeName+'\')">传 书</button>';
    if (ch.officialTitle || ch.title) {
      h += '<button class="rwp-act-btn" onclick="_rwpOpenOffice(\''+safeName+'\')">官 制</button>';
    }
  }
  h += '<button class="rwp-act-btn close" onclick="document.getElementById(\'_renwuPageOv\').classList.remove(\'open\')">×</button>';
  h += '</div>';
  h += '</div>'; // identity row

  // 心性二维
  var loyFillCls = loy >= 60 ? 'loyalty-hi' : 'loyalty-lo';
  var ambFillCls = amb >= 70 ? 'ambition-hi' : amb >= 40 ? 'ambition-mid' : 'ambition-lo';
  h += '<div class="rwp-heart">';
  h += '<div class="rwp-heart-item loyalty"><span class="rwp-heart-label">忠 诚</span>';
  h += '<div class="rwp-heart-bar"><div class="rwp-heart-bar-fill '+loyFillCls+'" style="width:'+loy+'%;"></div></div>';
  h += '<span class="rwp-heart-value">'+loy+'</span>';
  h += '<span class="rwp-heart-tag">'+_rwpLoyaltyTag(loy)+'</span></div>';
  h += '<div class="rwp-heart-item ambition"><span class="rwp-heart-label">野 心</span>';
  h += '<div class="rwp-heart-bar"><div class="rwp-heart-bar-fill '+ambFillCls+'" style="width:'+amb+'%;"></div></div>';
  h += '<span class="rwp-heart-value">'+amb+'</span>';
  h += '<span class="rwp-heart-tag">'+_rwpAmbitionTag(amb)+'</span></div>';
  h += '</div>';
  var verdict = _rwpHeartVerdict(loy, amb);
  h += '<div class="rwp-verdict'+(verdict.cls?' '+verdict.cls:'')+'">综合评估：'+verdict.text+'</div>';
  h += '</div>'; // rwp-top

  // ─── Tab 导航 ───
  h += '<div class="rwp-tabs">';
  ['概 要','身 世','家 谱','仕 途','心 绪','关 系'].forEach(function(t, i) {
    h += '<button class="rwp-tab'+(i===0?' active':'')+'" onclick="_rwpSwitchTab(this,'+i+')">'+t+'</button>';
  });
  h += '</div>';

  h += '<div class="rwp-tab-panels">';

  // ═══ Tab 1: 概要 ═══
  h += '<div class="rwp-tab-panel active">';
  // 资源
  h += '<div class="rwp-sec">';
  h += '<div class="rwp-sec-title">资 源<small>公库与官职绑定，私产归个人</small></div>';
  h += '<div class="rwp-grid-2">';
  // 公私财富
  h += '<div class="rwp-res-block">';
  h += '<div class="rwp-res-subgroup"><div class="rwp-res-sublabel">公 库 · 职 权 支 配</div><div class="rwp-res-items">';
  h += _rwpResItem(pub.money||0, '贯', 'coin');
  h += _rwpResItem(pub.grain||0, '石', 'grain');
  h += _rwpResItem(pub.cloth||0, '匹', 'cloth');
  h += '</div></div>';
  h += '<div class="rwp-res-subgroup"><div class="rwp-res-sublabel">私 产</div><div class="rwp-res-items">';
  h += _rwpResItem(priv.money||0, '贯', 'coin');
  h += _rwpResItem(priv.grain||0, '石', 'grain');
  h += _rwpResItem(priv.cloth||0, '匹', 'cloth');
  h += '</div></div>';
  h += '</div>';
  // 品行状态四格
  h += '<div class="rwp-res-block">';
  h += '<div class="rwp-res-sublabel">品 行 状 态</div>';
  h += '<div class="rwp-stats-row">';
  // 名望
  h += '<div class="rwp-stat-card"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="4" width="14" height="16" rx="1"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
  h += '<div class="rwp-stat-card-label">名 望</div><div class="rwp-fame-seal '+fameS.cls+'">'+fameS.label+'</div></div>';
  // 贤能
  h += '<div class="rwp-stat-card rwp-xian-card"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.5 7.1 19.2 8 13.7 4 9.8l5.5-.8z"/></svg>';
  h += '<div class="rwp-stat-card-label">贤 能</div><div class="rwp-stat-card-value">'+Math.round(virtue)+'</div>';
  h += '<div class="rwp-xian-tier">'+xianTier+'</div><div class="rwp-xian-prog"><div class="rwp-xian-prog-fill" style="width:'+xianPct.toFixed(1)+'%;"></div></div></div>';
  // 健康
  var hCls = health>=70?'':health>=40?'warn':'crit';
  h += '<div class="rwp-stat-card rwp-health-card '+hCls+'"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/></svg>';
  h += '<div class="rwp-stat-card-label">健 康</div><div class="rwp-stat-card-value">'+health+'</div>';
  h += '<div class="rwp-health-bar"><div class="rwp-health-bar-fill health" style="width:'+health+'%;"></div></div></div>';
  // 压力
  var sCls = stress>=70?'crit':stress>=40?'warn':'';
  var sBarCls = stress>=60?'stress-hi':stress>=30?'stress-mid':'stress-lo';
  var sSub = stress>=80?'将 崩':stress>=60?'负 重':stress>=30?'承 重':'从 容';
  h += '<div class="rwp-stat-card rwp-health-card '+sCls+'"><svg class="rwp-stat-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12c1.5-3 5.5-5 7-5s5.5 2 7 5M12 7v10M8 17h8"/></svg>';
  h += '<div class="rwp-stat-card-label">压 力</div><div class="rwp-stat-card-value">'+stress+'</div>';
  h += '<div class="rwp-stat-card-sub">'+sSub+'</div>';
  h += '<div class="rwp-health-bar"><div class="rwp-health-bar-fill '+sBarCls+'" style="width:'+stress+'%;"></div></div></div>';
  h += '</div></div>';
  h += '</div></div>';

  // 能力八才
  h += '<div class="rwp-sec">';
  h += '<div class="rwp-sec-title">能 力 八 才<small>忠诚野心已移至顶部心性</small></div>';
  h += '<div class="rwp-abilities">' + radar.svg;
  h += '<div class="rwp-ability-grid">';
  var abLabels = {intelligence:'智 力',valor:'武 勇',military:'军 事',administration:'政 务',management:'管 理',charisma:'魅 力',diplomacy:'外 交',benevolence:'仁 厚'};
  radar.abilities.forEach(function(a) {
    var rk = _rwpAbilityRank(a.val);
    var label = _rwpAbilityRankLabel(a.val);
    h += '<div class="rwp-ability-cell '+rk+'"><span class="rwp-ability-cell-name">'+abLabels[a.key]+'</span>';
    h += '<div class="rwp-ability-cell-right"><span class="rwp-ability-cell-value">'+a.val+'</span>';
    h += '<span class="rwp-ability-cell-rank">'+label+'</span></div></div>';
  });
  h += '</div></div></div>';

  // 五常 + 特质
  h += '<div class="rwp-grid-2">';
  h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">五 常</div>';
  if (typeof calculateWuchang === 'function') {
    var wc = calculateWuchang(ch);
    h += '<div class="rwp-stat-grid five">';
    ['仁','义','礼','智','信'].forEach(function(k) {
      h += '<div class="rwp-stat"><div class="rwp-stat-label">'+k+'</div><div class="rwp-stat-value">'+(wc[k]||0)+'</div></div>';
    });
    h += '</div>';
    if (wc.气质) h += '<div style="text-align:center;font-size:11px;color:var(--gold-400);margin-top:6px;letter-spacing:0.2em;">气 质：'+wc.气质+'</div>';
  } else {
    h += '<div style="color:#d4be7a;font-size:11px;">五 常 未 启</div>';
  }
  h += '</div>';
  h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">性 格 特 质</div>';
  if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
    h += '<div>';
    ch.traitIds.forEach(function(tid) {
      var d = P.traitDefinitions.find(function(t) { return t.id === tid; });
      if (!d) return;
      var cls = 'gold';
      if (d.dims && d.dims.boldness > 0.2) cls = 'valor';
      else if (d.dims && d.dims.compassion > 0.2) cls = 'heart';
      else if (d.dims && d.dims.rationality > 0.2) cls = 'mind';
      h += '<span class="rwp-trait-tag '+cls+'">'+escHtml(d.name)+'</span>';
    });
    h += '</div>';
  } else if (ch.traits && Array.isArray(ch.traits)) {
    h += '<div>';
    ch.traits.forEach(function(t) {
      h += '<span class="rwp-trait-tag gold">'+escHtml(typeof t==='string'?t:(t.name||''))+'</span>';
    });
    h += '</div>';
  } else {
    h += '<div style="color:#d4be7a;font-size:11px;">特 质 未 录</div>';
  }
  if (ch.personality) h += '<div style="font-size:11px;color:var(--ink-300);margin-top:6px;line-height:1.6;font-style:italic;">'+escHtml(ch.personality)+'</div>';
  h += '</div>';
  h += '</div>';

  // 志向
  if (ch.personalGoal) {
    var gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : 0;
    var gPctCls = gsat >= 60 ? 'hi' : gsat >= 30 ? 'mid' : 'lo';
    h += '<div class="rwp-sec" style="margin-top:18px;"><div class="rwp-sec-title">个 人 志 向</div>';
    h += '<div class="rwp-goal-card"><div class="rwp-goal-text">'+escHtml(ch.personalGoal)+'</div>';
    h += '<div class="rwp-goal-progress"><span class="rwp-goal-label">满 足 度</span>';
    h += '<div class="rwp-goal-bar"><div class="rwp-goal-bar-fill" style="width:'+gsat+'%;"></div></div>';
    h += '<span class="rwp-goal-pct '+gPctCls+'">'+gsat+'%</span></div></div></div>';
  }
  h += '</div>'; // tab1

  // ═══ Tab 2: 身世 ═══
  h += '<div class="rwp-tab-panel">';
  h += '<div class="rwp-sec"><div class="rwp-sec-title">身 份 档 案</div>';
  h += '<div class="rwp-identity-grid">';
  var idCells = [
    {l:'性 别', v: isFemale?'女':'男'},
    {l:'年 龄', v: age || '未详'},
    {l:'身 份', v: ch.role || '—'},
    {l:'职 业', v: ch.occupation || ch.officialTitle || '—'},
    {l:'籍 贯', v: ch.birthplace || '—'},
    {l:'所 在 地', v: ch.location + (ch._travelTo?' \u2192 '+ch._travelTo+((typeof ch._travelRemainingDays==='number'&&ch._travelRemainingDays>0)?'\uFF08\u8FD8\u9700 '+ch._travelRemainingDays+' \u65E5\uFF09':''):''), cls: ch._travelTo?'warn':''},
    {l:'势 力', v: ch.faction || '无'},
    {l:'民 族', v: ch.ethnicity || '—'},
    {l:'信 仰', v: ch.faith || '—'},
    {l:'文 化', v: ch.culture || '—'},
    {l:'学 识', v: ch.learning || '—', cls: ch.learning?'hi':''},
    {l:'辞 令', v: ch.diction || '—'},
    {l:'立 场', v: ch.stance || '—', cls: ch.stance==='改革'?'hi':''},
    {l:'党 派', v: ch.party ? ch.party+(ch.partyRank?' · '+ch.partyRank:'') : '—'},
    {l:'家 族', v: ch.family ? ch.family+(ch.familyTier?' · '+({imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'}[ch.familyTier]||ch.familyTier):'') : '—'},
    {l:'与 君 主', v: ch.playerRelation || '—'}
  ];
  idCells.forEach(function(c) {
    h += '<div class="rwp-id-cell"><div class="rwp-id-label">'+c.l+'</div><div class="rwp-id-value'+(c.cls?' '+c.cls:'')+'">'+escHtml(c.v||'—')+'</div></div>';
  });
  h += '</div></div>';

  // 公私身份对照
  h += '<div class="rwp-sec"><div class="rwp-sec-title">公 私 身 份 对 照</div>';
  h += '<div class="rwp-duo">';
  h += '<div class="rwp-duo-col public"><div class="rwp-duo-header">官 职 身 份</div>';
  h += '<div class="rwp-duo-row"><span class="label">官职</span><span class="val">'+escHtml(ch.officialTitle||ch.title||'—')+'</span></div>';
  if (ch.rankLevel) h += '<div class="rwp-duo-row"><span class="label">品级</span><span class="val">'+(typeof rankLevelToText==='function'?rankLevelToText(ch.rankLevel):'品级'+ch.rankLevel)+'</span></div>';
  if (ch.officeDuties) h += '<div class="rwp-duo-row"><span class="label">职事</span><span class="val">'+escHtml(ch.officeDuties)+'</span></div>';
  if (ch.superior) h += '<div class="rwp-duo-row"><span class="label">上司</span><span class="val">'+escHtml(ch.superior)+'</span></div>';
  if (ch.concurrentTitle) h += '<div class="rwp-duo-row"><span class="label">兼衔</span><span class="val">'+escHtml(ch.concurrentTitle)+'</span></div>';
  h += '</div>';
  h += '<div class="rwp-duo-col private"><div class="rwp-duo-header">私 人 身 份</div>';
  if (ch.familyRole) h += '<div class="rwp-duo-row"><span class="label">家中</span><span class="val">'+escHtml(ch.familyRole)+'</span></div>';
  if (ch.mentor) h += '<div class="rwp-duo-row"><span class="label">师承</span><span class="val">'+escHtml(ch.mentor)+'</span></div>';
  if (ch.friends) h += '<div class="rwp-duo-row"><span class="label">好友</span><span class="val">'+escHtml(Array.isArray(ch.friends)?ch.friends.join(' · '):ch.friends)+'</span></div>';
  if (ch.hobbies) h += '<div class="rwp-duo-row"><span class="label">爱好</span><span class="val">'+escHtml(Array.isArray(ch.hobbies)?ch.hobbies.join(' · '):ch.hobbies)+'</span></div>';
  if (ch.zi || ch.haoName) h += '<div class="rwp-duo-row"><span class="label">字号</span><span class="val">'+(ch.zi||'')+(ch.haoName?' · 号'+ch.haoName:'')+'</span></div>';
  h += '</div></div></div>';

  if (ch.appearance) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">外 貌</div><div class="rwp-prose italic">'+escHtml(ch.appearance)+'</div></div>';
  }
  if (ch.bio) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">生 平</div><div class="rwp-prose">'+escHtml(ch.bio)+'</div></div>';
  }
  if (ch.background || ch.description) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">角 色 描 写</div><div class="rwp-prose">'+escHtml(ch.background || ch.description)+'</div></div>';
  }
  h += '</div>'; // tab2

  // ═══ Tab 3: 家谱 ═══
  h += '<div class="rwp-tab-panel">';
  h += '<div class="rwp-sec"><div class="rwp-sec-title">家 谱 · 五 代 树<small>金框为本人 · 虚线为姻亲</small></div>';
  h += '<div class="rwp-ft-svg-wrap">' + _rwpRenderFamilyTree(ch) + '</div>';
  h += '<div class="rwp-ft-legend">';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark self"></span>本 人</span>';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark blood"></span>血 亲</span>';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark inlaw"></span>姻 亲</span>';
  h += '<span class="rwp-ft-lg"><span class="rwp-ft-lg-mark dead"></span>已 故</span>';
  h += '</div></div>';
  // 家族统览
  if (ch.family || ch.familyTier) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">家 族 · 统 览</div>';
    h += '<div class="rwp-ft-clan-grid">';
    var clanPrestige = ch.clanPrestige !== undefined ? ch.clanPrestige : 50;
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">族 望</div><div class="rwp-ft-clan-v-big">'+Math.round(clanPrestige)+'</div><div class="rwp-ft-clan-bar"><span class="rwp-ft-clan-bar-fill" style="width:'+clanPrestige+'%;"></span></div></div>';
    var tierMap2 = {imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'};
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">门 第</div><div class="rwp-ft-clan-v-big" style="color:var(--celadon-300);">'+(tierMap2[ch.familyTier]||'—')+'</div></div>';
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">家 族 势 力</div><div class="rwp-ft-clan-v-big" style="font-size:16px;">'+escHtml(ch.party||ch.faction||'—')+'</div></div>';
    var clanSize = (ch.familyMembers && ch.familyMembers.length) || 0;
    h += '<div class="rwp-ft-clan-item"><div class="rwp-ft-clan-lb">族 丁 总 数</div><div class="rwp-ft-clan-v-big">'+clanSize+'</div></div>';
    h += '</div></div>';
  }
  // 姻亲四族·从 familyMembers 中筛 inLaw 或关系为姻亲的·按 family 聚合
  try {
    var _inlaws = {};
    (ch.familyMembers || []).forEach(function(m) {
      if (!m) return;
      var rel = (m.relation || m.role || '');
      var isInLaw = m.inLaw === true || /妻|嫂|媳|姻|岳|丈人|舅|姑/.test(rel);
      if (!isInLaw) return;
      var fam = m.family || (m.name && m.name.length >= 2 ? m.name.charAt(0)+'氏' : '');
      if (!fam) return;
      if (!_inlaws[fam]) _inlaws[fam] = { family: fam, members: [], relations: [] };
      _inlaws[fam].members.push(m.name || '');
      if (rel) _inlaws[fam].relations.push(rel);
    });
    // 从 ch.family (本家) 反推母族/妻族·用 spouseClan / motherClan 字段
    if (ch.motherClan && !_inlaws[ch.motherClan]) _inlaws[ch.motherClan] = { family: ch.motherClan, members: [], relations: ['母族'] };
    if (ch.spouseClan && !_inlaws[ch.spouseClan]) _inlaws[ch.spouseClan] = { family: ch.spouseClan, members: [], relations: ['妻族'] };
    var _inlawList = Object.keys(_inlaws).map(function(k){ return _inlaws[k]; });
    if (_inlawList.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">姻 亲 诸 族</div>';
      h += '<div style="padding:10px 14px;background:rgba(0,0,0,0.22);border-radius:5px;">';
      _inlawList.slice(0, 8).forEach(function(inl) {
        var relText = inl.relations.length ? ('（'+inl.relations.slice(0,2).join('·')+'）') : '';
        h += '<div style="font-size:12px;color:var(--ink-200);margin:3px 0;line-height:1.9;">· <span style="color:var(--celadon-300);">'+escHtml(inl.family)+'</span>'+relText;
        if (inl.members.length) h += '<span style="color:var(--ink-400);font-size:11px;margin-left:6px;">'+inl.members.slice(0,3).map(escHtml).join('·')+'</span>';
        h += '</div>';
      });
      h += '</div></div>';
    }
  } catch(_inlawE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_inlawE, '人物志] 姻亲段') : console.warn('[人物志] 姻亲段', _inlawE); }
  // 在朝者·从 GM.chars 筛同 family 且有官职者
  try {
    if (ch.family) {
      var _inCourt = (GM.chars || []).filter(function(cc) {
        if (!cc || cc.dead) return false;
        if (cc.family !== ch.family) return false;
        return !!(cc.officialTitle || cc.title);
      }).slice(0, 10);
      if (_inCourt.length > 0) {
        h += '<div class="rwp-sec"><div class="rwp-sec-title">在 朝 者</div>';
        h += '<div style="padding:10px 14px;background:rgba(184,154,83,0.06);border:1px solid rgba(184,154,83,0.2);border-radius:3px;">';
        _inCourt.forEach(function(cc) {
          var isSelf = cc.name === ch.name;
          var nmCls = isSelf ? 'var(--gold-300)' : (cc.party && cc.party === ch.party ? 'var(--celadon-300)' : 'var(--ink-50)');
          var roleTxt = cc.name === ch.name ? '（本人）' : '';
          var rkTxt = cc.rankLevel ? ('·'+(typeof rankLevelToText==='function'?rankLevelToText(cc.rankLevel):'品'+cc.rankLevel)) : '';
          h += '<div style="font-size:12px;line-height:1.8;">· <b style="color:'+nmCls+';">'+escHtml(cc.name)+'</b>'+roleTxt
             + '（'+escHtml(cc.officialTitle||cc.title||'')+rkTxt+'）</div>';
        });
        h += '</div></div>';
      }
    }
  } catch(_incE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_incE, '人物志] 在朝者段') : console.warn('[人物志] 在朝者段', _incE); }
  h += '</div>'; // tab3

  // ═══ Tab 4: 仕途 ═══
  h += '<div class="rwp-tab-panel">';
  // 仕途履历（从 ch._scars milestone 或 ch.career 构建）
  h += '<div class="rwp-sec"><div class="rwp-sec-title">仕 途 履 历</div>';
  if (ch.career && Array.isArray(ch.career) && ch.career.length > 0) {
    h += '<div class="rwp-timeline">';
    ch.career.forEach(function(c) {
      var ms = c.milestone ? ' milestone' : '';
      h += '<div class="rwp-timeline-item'+ms+'"><div class="rwp-timeline-date">'+escHtml(c.date||c.time||'')+'</div>';
      h += '<div class="rwp-timeline-title">'+escHtml(c.title||c.event||'')+'</div>';
      if (c.desc) h += '<div class="rwp-timeline-desc">'+escHtml(c.desc)+'</div>';
      h += '</div>';
    });
    h += '</div>';
  } else {
    h += '<div style="padding:12px;text-align:center;color:#d4be7a;font-style:italic;">仕 途 尚 浅 · 事 迹 未 录</div>';
  }
  h += '</div>';
  // 经历·大事纪·从 ch._scars milestone 或 ch._experience 构建
  try {
    var _bigEvents = [];
    if (Array.isArray(ch._scars)) {
      ch._scars.forEach(function(s) {
        if (s && (s.milestone || s.bigEvent || s.emotion === '敬' || s.emotion === '恨')) {
          _bigEvents.push({ date: s.turn?('T'+s.turn):'', title: s.event||'', desc: s.who?('与 '+s.who):'', milestone: !!s.milestone });
        }
      });
    }
    if (Array.isArray(ch._chronicle)) {
      ch._chronicle.slice(-8).forEach(function(c) {
        _bigEvents.push({ date: c.turn?('T'+c.turn):'', title: c.title||c.event||'', desc: c.desc||'', milestone: !!c.milestone });
      });
    }
    if (_bigEvents.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">经 历 · 大 事 纪<small>近 8 条</small></div>';
      h += '<div class="rwp-timeline">';
      _bigEvents.slice(-8).forEach(function(e) {
        var ms = e.milestone ? ' milestone' : '';
        h += '<div class="rwp-timeline-item'+ms+'"><div class="rwp-timeline-date">'+escHtml(e.date)+'</div>';
        h += '<div class="rwp-timeline-title">'+escHtml(e.title)+'</div>';
        if (e.desc) h += '<div class="rwp-timeline-desc">'+escHtml(e.desc)+'</div>';
        h += '</div>';
      });
      h += '</div></div>';
    }
  } catch(_beE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_beE, '人物志] 大事纪段') : console.warn('[人物志] 大事纪段', _beE); }
  // 文事作品集·从 ch.works / ch.culturalWorks 读
  try {
    var _works = [];
    if (Array.isArray(ch.works)) _works = _works.concat(ch.works);
    if (Array.isArray(ch.culturalWorks)) _works = _works.concat(ch.culturalWorks);
    // 也扫 GM.culturalWorks 中 author === ch.name
    if (Array.isArray(GM.culturalWorks)) {
      GM.culturalWorks.forEach(function(w) {
        if (w && w.author === ch.name) _works.push(w);
      });
    }
    if (_works.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">文 事 作 品 集<small>近 '+Math.min(_works.length, 8)+' 件</small></div>';
      _works.slice(-8).forEach(function(w) {
        var title = w.title || w.name || '无题';
        var meta = [];
        if (w.date || w.turn) meta.push(w.date || ('T'+w.turn));
        if (w.genre || w.type) meta.push(w.genre || w.type);
        if (w.distribution || w.circulated) meta.push(w.distribution || '流传');
        h += '<div class="rwp-work-card"><div class="rwp-work-title">《 '+escHtml(title)+' 》</div>';
        if (meta.length) h += '<div class="rwp-work-meta">'+escHtml(meta.join(' · '))+'</div>';
        if (w.extract || w.excerpt || w.content) {
          var ext = (w.extract || w.excerpt || w.content).slice(0, 90);
          h += '<div class="rwp-work-extract">"'+escHtml(ext)+(ext.length>=90?'……':'')+'"</div>';
        }
        h += '</div>';
      });
      h += '</div>';
    }
  } catch(_wkE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_wkE, '人物志] 作品集段') : console.warn('[人物志] 作品集段', _wkE); }
  // 颜面+志向
  h += '<div class="rwp-grid-2">';
  if (typeof FaceSystem !== 'undefined' && ch._face !== undefined) {
    var fv = Math.round(ch._face);
    var fLabel = fv>=70?'颜 面 在':fv>=40?'有 分 量':'颜 面 失';
    h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">颜 面</div>';
    h += '<div class="rwp-face-card"><div class="rwp-face-value">'+fv+'</div>';
    h += '<div><div class="rwp-face-label">'+fLabel+'</div>';
    h += '<div class="rwp-face-desc">'+(typeof FaceSystem.getFaceText==='function'?FaceSystem.getFaceText(ch):'')+'</div></div></div></div>';
  }
  if (ch.personalGoal) {
    var gsat2 = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : 0;
    var gpc = gsat2>=60?'hi':gsat2>=30?'mid':'lo';
    h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">个 人 志 向</div>';
    h += '<div class="rwp-goal-card"><div class="rwp-goal-text" style="font-size:12px;">'+escHtml(ch.personalGoal)+'</div>';
    h += '<div class="rwp-goal-progress"><span class="rwp-goal-label">满足</span>';
    h += '<div class="rwp-goal-bar"><div class="rwp-goal-bar-fill" style="width:'+gsat2+'%;"></div></div>';
    h += '<span class="rwp-goal-pct '+gpc+'">'+gsat2+'%</span></div></div></div>';
  }
  h += '</div>';
  h += '</div>'; // tab4

  // ═══ Tab 5: 心绪 ═══
  h += '<div class="rwp-tab-panel">';
  // 当前情绪
  var moodMap = {'喜':{cls:'happy',txt:'心 境 欣 然'},'怒':{cls:'angry',txt:'怒 气 未 消'},'忧':{cls:'worry',txt:'心 事 深 重'},'惧':{cls:'fear',txt:'惶 恐 难 安'},'平':{cls:'peace',txt:'心 如 止 水'}};
  var currentMood = '平';
  if (ch._memory && ch._memory.length > 0) {
    var recent = ch._memory.slice(-3);
    var scoreMap = {'喜':0,'怒':0,'忧':0,'惧':0,'恨':0,'敬':0,'平':0};
    recent.forEach(function(m) { if (scoreMap[m.emotion]!==undefined) scoreMap[m.emotion]++; });
    var max = 0;
    Object.keys(scoreMap).forEach(function(k) { if (scoreMap[k] > max) { max = scoreMap[k]; currentMood = k; } });
  }
  var md = moodMap[currentMood] || moodMap['平'];
  h += '<div class="rwp-grid-2">';
  h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">当 前 情 绪</div>';
  h += '<div style="display:flex;gap:10px;align-items:center;"><span class="rwp-mood-chip '+md.cls+'">〔 '+currentMood+' 〕 '+md.txt+'</span></div></div>';
  if (ch.innerThought) {
    h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">近 期 心 声</div>';
    h += '<div class="rwp-inner-thought">'+escHtml(ch.innerThought)+'</div></div>';
  }
  h += '</div>';
  // 情节弧·若有(后台调用 CharArcs 生成)
  try {
    var _arc = (GM._charArcs && GM._charArcs[ch.name]) ? GM._charArcs[ch.name] : null;
    if (_arc && (_arc.arcStage || _arc.motivation)) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">情 节 弧 <span style="font-size:0.7rem;color:var(--txt-d);font-weight:400;letter-spacing:0;">T'+(_arc.turn||'?')+' 起</span></div>';
      h += '<div style="padding:10px 14px;background:rgba(142,106,168,0.06);border:1px solid rgba(142,106,168,0.2);border-radius:5px;">';
      if (_arc.arcStage) h += '<div style="font-size:12px;color:var(--purple-300,#b89ec8);letter-spacing:0.2em;margin-bottom:6px;">当 前 境 · '+escHtml(_arc.arcStage)+'</div>';
      if (_arc.emotionalState) h += '<div style="font-size:11px;color:var(--txt-s);margin-bottom:4px;">情绪：'+escHtml(_arc.emotionalState)+'</div>';
      if (_arc.motivation) h += '<div style="font-size:11px;color:var(--txt-s);margin-bottom:4px;line-height:1.6;">动机：'+escHtml(_arc.motivation)+'</div>';
      if (_arc.nextCue) h += '<div style="font-size:11px;color:var(--gold-d,#8c7030);line-height:1.6;">潜动向：'+escHtml(_arc.nextCue)+'</div>';
      if (typeof _arc.arcProgress === 'number') {
        var _ap = Math.max(0, Math.min(100, _arc.arcProgress));
        h += '<div style="margin-top:6px;height:4px;background:rgba(0,0,0,0.2);border-radius:2px;overflow:hidden;"><div style="height:100%;width:'+_ap+'%;background:var(--purple-400,#8e6aa8);"></div></div>';
        h += '<div style="font-size:10px;color:var(--txt-d);margin-top:2px;letter-spacing:0.1em;">弧线进度 '+_ap+'%</div>';
      }
      h += '</div></div>';
    }
  } catch(_arcUiE) {}
  // 压力详情
  if (stress > 30) {
    var sL = stress>=80?'将 崩':stress>=60?'负 重':'承 重';
    h += '<div class="rwp-sec"><div class="rwp-sec-title">压 力 详 情</div>';
    h += '<div style="padding:12px 14px;background:rgba(192,64,48,0.06);border:1px solid rgba(192,64,48,0.2);border-radius:5px;">';
    h += '<div style="color:var(--vermillion-300);font-size:12px;margin-bottom:6px;letter-spacing:0.2em;">压 力 值 · '+stress+'/100 · '+sL+'</div>';
    if (ch.stressSources && ch.stressSources.length) {
      h += '<div style="font-size:10px;color:var(--vermillion-400);letter-spacing:0.15em;margin-bottom:4px;">当 下 压 源</div>';
      ch.stressSources.forEach(function(s) { h += '<div style="font-size:11px;padding:2px 0 2px 10px;border-left:1px dashed rgba(255,255,255,0.1);">· '+escHtml(s)+'</div>'; });
    }
    // 释压之法·从 hobbies/stressOff/stressRelief 读
    var _reliefs = [];
    if (Array.isArray(ch.stressRelief)) _reliefs = ch.stressRelief.slice(0, 4);
    else if (Array.isArray(ch.stressOff)) _reliefs = ch.stressOff.slice(0, 4);
    else if (ch.hobbies) _reliefs = (Array.isArray(ch.hobbies) ? ch.hobbies : String(ch.hobbies).split(/[·、，,\/]/)).filter(Boolean).slice(0, 4);
    if (_reliefs.length > 0) {
      h += '<div style="font-size:10px;color:var(--celadon-400);letter-spacing:0.15em;margin:8px 0 4px;">释 压 之 法</div>';
      _reliefs.forEach(function(s) { h += '<div style="font-size:11px;padding:2px 0 2px 10px;border-left:1px dashed rgba(126,184,167,0.2);color:var(--celadon-300);">· '+escHtml(s)+'</div>'; });
    }
    h += '</div></div>';
  }
  // 人生历练·分域累计·从 ch._experience 或 ch.exp 读
  try {
    var _exp = ch._experience || ch.exp || null;
    if (_exp && typeof _exp === 'object') {
      var _domains = [
        { k: '治理', lbs: ['governance','administration','治理','rule'] },
        { k: '民生', lbs: ['livelihood','民生','people'] },
        { k: '文事', lbs: ['literary','文事','culture'] },
        { k: '党议', lbs: ['faction','党议','politics'] },
        { k: '军机', lbs: ['military','军事','军机','war'] },
        { k: '刑名', lbs: ['justice','刑名','law'] }
      ];
      var _domainStats = [];
      _domains.forEach(function(d) {
        var cnt = 0;
        d.lbs.forEach(function(l) { if (typeof _exp[l] === 'number') cnt += _exp[l]; });
        if (cnt > 0) _domainStats.push({ k: d.k, cnt: cnt });
      });
      var _recentExp = Array.isArray(ch._experienceLog) ? ch._experienceLog.slice(-4) :
        Array.isArray(_exp.recent) ? _exp.recent.slice(-4) : [];
      if (_domainStats.length > 0 || _recentExp.length > 0) {
        h += '<div class="rwp-sec"><div class="rwp-sec-title">人 生 历 练<small>分域累计</small></div>';
        if (_domainStats.length > 0) {
          h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;padding:10px 14px;background:rgba(0,0,0,0.22);border-radius:5px;">';
          _domainStats.forEach(function(d) {
            h += '<div style="flex:1;min-width:80px;text-align:center;padding:6px;background:rgba(184,154,83,0.06);border:1px solid rgba(184,154,83,0.18);border-radius:3px;">'
              + '<div style="font-size:11px;color:var(--gold-400);letter-spacing:0.2em;">'+d.k+'</div>'
              + '<div style="font-size:18px;color:var(--gold-300);font-weight:600;margin-top:2px;">'+d.cnt+'</div></div>';
          });
          h += '</div>';
        }
        if (_recentExp.length > 0) {
          h += '<div style="font-size:11px;color:var(--ink-300);letter-spacing:0.1em;margin-bottom:4px;">近 期</div>';
          _recentExp.forEach(function(e) {
            var txt = typeof e === 'string' ? e : (e.text || e.desc || ('〔'+(e.domain||'?')+'〕'+(e.event||'')));
            h += '<div style="font-size:11px;padding:3px 0 3px 10px;color:var(--ink-200);line-height:1.6;">· '+escHtml(txt)+'</div>';
          });
        }
        h += '</div>';
      }
    }
  } catch(_expE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_expE, '人物志] 历练段') : console.warn('[人物志] 历练段', _expE); }
  // 近期记忆
  if (ch._memory && ch._memory.length > 0) {
    h += '<div class="rwp-sec"><div class="rwp-sec-title">此 人 记 忆<small>近 5 条</small></div><div>';
    ch._memory.slice(-5).reverse().forEach(function(m) {
      var mc = _rwpMoodCls(m.emotion);
      h += '<div class="rwp-mem '+mc+'"><span class="rwp-mem-mood '+mc+'">〔'+m.emotion+'〕</span>'+escHtml(m.event);
      if (m.who) h += '<span class="rwp-mem-who">('+escHtml(m.who)+')</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }
  // 印象
  if (ch._impressions) {
    var impParts = [];
    for (var _pn in ch._impressions) {
      var _imp = ch._impressions[_pn];
      if (Math.abs(_imp.favor) >= 3) {
        var _rel = _imp.favor >= 15 ? '感恩' : _imp.favor >= 5 ? '好感' : _imp.favor <= -15 ? '深恨' : _imp.favor <= -5 ? '不满' : '寻常';
        impParts.push('<b>'+escHtml(_pn)+'：</b>'+_rel+'('+(_imp.favor>0?'+':'')+_imp.favor+')');
      }
    }
    if (impParts.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">对 他 人 印 象</div>';
      h += '<div class="rwp-impressions"><div>'+impParts.join('　')+'</div></div></div>';
    }
  }
  // 刻骨铭心
  if (ch._scars && ch._scars.length > 0) {
    h += '<div class="rwp-sec"><div class="rwp-scar-box"><div class="rwp-scar-label">刻 骨 铭 心 · 不 忘</div>';
    ch._scars.forEach(function(s) {
      var mc = _rwpMoodCls(s.emotion);
      h += '<div class="rwp-mem '+mc+'"><span class="rwp-mem-mood '+mc+'">〔'+s.emotion+'〕</span>'+escHtml(s.event);
      if (s.who) h += '<span class="rwp-mem-who">('+escHtml(s.who)+')</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }
  h += '</div>'; // tab5

  // ═══ Tab 6: 关系 ═══
  h += '<div class="rwp-tab-panel">';
  // 玩家好感
  if (ch._impressions && ch._impressions['玩家']) {
    var fv = ch._impressions['玩家'].favor || 0;
    h += '<div class="rwp-sec"><div class="rwp-sec-title">对 玩 家 好 感</div>';
    h += '<div class="rwp-opinion-breakdown">';
    h += '<div class="rwp-opinion-total"><span class="rwp-opinion-total-lb">合 计 好 感</span>';
    h += '<span class="rwp-opinion-total-v'+(fv<0?' neg':'')+'">'+(fv>=0?'+':'')+fv+'</span></div>';
    h += '<div class="rwp-opinion-bar"><div class="rwp-opinion-fill '+(fv>=0?'pos':'neg')+'" style="width:'+Math.min(50,Math.abs(fv)/2)+'%;"></div></div>';
    h += '</div></div>';
  }
  // 恩怨
  if (typeof EnYuanSystem !== 'undefined') {
    var eyt = EnYuanSystem.getTextForChar(ch.name);
    if (eyt) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">恩 怨 · 因 果</div><div class="rwp-prose">'+escHtml(eyt)+'</div></div>';
    }
  }
  // 关系网（从 impressions）
  if (ch._impressions) {
    var relList = [];
    for (var pn in ch._impressions) {
      if (pn === '玩家') continue;
      var imp = ch._impressions[pn];
      if (Math.abs(imp.favor||0) >= 3) relList.push({ name: pn, favor: imp.favor });
    }
    relList.sort(function(a,b){ return Math.abs(b.favor)-Math.abs(a.favor); });
    if (relList.length > 0) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">人 际 关 系 网</div><div class="rwp-aff-list">';
      relList.slice(0, 10).forEach(function(r) {
        var cls = r.favor>=5?'pos':r.favor<=-5?'neg':'neu';
        var rel = r.favor>=15?'感恩深厚':r.favor>=5?'有好感':r.favor<=-15?'深怀恨意':r.favor<=-5?'心存不满':'寻常';
        h += '<div class="rwp-aff-item '+cls+'"><span class="rwp-aff-name">'+escHtml(r.name)+'</span>';
        h += '<span class="rwp-aff-rel">'+rel+'</span>';
        h += '<span class="rwp-aff-value">'+(r.favor>0?'+':'')+r.favor+'</span></div>';
      });
      h += '</div></div>';
    }
  }
  // 血缘关系 + 门生故吏 · 2 列并排
  try {
    var _bloods = [];
    if (Array.isArray(ch.familyMembers)) {
      ch.familyMembers.forEach(function(m) {
        if (!m || !m.name) return;
        var rel = m.relation || m.role || '';
        var isInLaw = m.inLaw === true || /妻|嫂|媳|岳|丈人|舅/.test(rel);
        if (isInLaw && !/妻/.test(rel)) return;  // 姻亲不算血缘(妻子特殊·列入)
        var close = m.dead ? '已故' : (m.name === ch.name ? '本人' : '亲');
        _bloods.push({ name: m.name, rel: rel, close: close, dead: !!m.dead });
      });
    }
    var _students = [];
    if (Array.isArray(ch.studentsIds)) {
      ch.studentsIds.slice(0, 10).forEach(function(sn) {
        var sc = GM.chars && GM.chars.find(function(cc){ return cc.name === sn; });
        _students.push({ name: sn, rel: sc ? (sc.officialTitle||sc.title||'') : '门生', tag: '门生' });
      });
    }
    // 亦扫 GM.chars 中 mentor 含本人
    if (Array.isArray(GM.chars)) {
      GM.chars.forEach(function(cc) {
        if (!cc || !cc.mentor) return;
        if (String(cc.mentor).indexOf(ch.name) < 0) return;
        if (_students.some(function(s){ return s.name === cc.name; })) return;
        _students.push({ name: cc.name, rel: cc.officialTitle||cc.title||'门生', tag: '门生' });
      });
    }
    // 故吏·从 ch._formerSubordinates 或扫 GM.chars 曾为下属者
    if (Array.isArray(ch._formerSubordinates)) {
      ch._formerSubordinates.slice(0, 8).forEach(function(sub) {
        _students.push({ name: typeof sub === 'string' ? sub : sub.name, rel: (typeof sub === 'object' ? sub.post||'故吏' : '故吏'), tag: '故吏' });
      });
    }
    if (_bloods.length > 0 || _students.length > 0) {
      h += '<div class="rwp-grid-2">';
      if (_bloods.length > 0) {
        h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">血 缘 关 系</div><div class="rwp-aff-list">';
        _bloods.slice(0, 10).forEach(function(b) {
          var cls = b.dead ? 'neu' : 'pos';
          h += '<div class="rwp-aff-item '+cls+'"><span class="rwp-aff-name">'+escHtml(b.name)+'</span>';
          h += '<span class="rwp-aff-rel">'+escHtml(b.rel||'—')+'</span>';
          h += '<span class="rwp-aff-value">'+b.close+'</span></div>';
        });
        h += '</div></div>';
      }
      if (_students.length > 0) {
        h += '<div class="rwp-sec" style="margin-bottom:0;"><div class="rwp-sec-title">门 生 故 吏</div><div class="rwp-aff-list">';
        _students.slice(0, 10).forEach(function(s) {
          h += '<div class="rwp-aff-item pos"><span class="rwp-aff-name">'+escHtml(s.name)+'</span>';
          h += '<span class="rwp-aff-rel">'+escHtml(s.rel)+'</span>';
          h += '<span class="rwp-aff-value">'+s.tag+'</span></div>';
        });
        h += '</div></div>';
      }
      h += '</div>';
    }
  } catch(_relE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_relE, '人物志] 血缘/门生段') : console.warn('[人物志] 血缘/门生段', _relE); }
  // 降级文本·PatronNetwork(若存在·作为补充)
  if (typeof PatronNetwork !== 'undefined') {
    var pnt = PatronNetwork.getTextForChar(ch.name);
    if (pnt) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">恩 怨 · 因 果</div><div class="rwp-prose" style="font-size:11px;">'+escHtml(pnt)+'</div></div>';
    }
  }
  h += '</div>'; // tab6

  h += '</div>'; // tab-panels

  panel.innerHTML = h;
  ov.classList.add('open');
}

/** 切换 tab */
function _rwpSwitchTab(btn, idx) {
  var panel = btn.closest('.renwu-page-container') || btn.closest('.char-detail-panel');
  if (!panel) return;
  var tabs = panel.querySelectorAll('.rwp-tab');
  var panels = panel.querySelectorAll('.rwp-tab-panel');
  tabs.forEach(function(t, i) { t.classList.toggle('active', i === idx); });
  panels.forEach(function(p, i) { p.classList.toggle('active', i === idx); });
}

/** 渲染资源单元 */
function _rwpResItem(val, unit, type) {
  var svg = '';
  if (type === 'coin') svg = '<svg class="rwp-res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><rect x="9.5" y="9.5" width="5" height="5" stroke-width="1.3"/></svg>';
  else if (type === 'grain') svg = '<svg class="rwp-res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 21V6"/><path d="M12 10C8.5 10 6 8.5 5 6"/><path d="M12 10C15.5 10 18 8.5 19 6"/><path d="M12 14C8.5 14 6 12.5 5 10"/><path d="M12 14C15.5 14 18 12.5 19 10"/></svg>';
  else if (type === 'cloth') svg = '<svg class="rwp-res-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 7Q12 4 20 7L20 9Q12 6 4 9Z"/><path d="M4 11Q12 8 20 11L20 13Q12 10 4 13Z"/></svg>';
  var neg = val < 0;
  var v = Math.abs(val);
  var display = v >= 10000 ? (v/10000).toFixed(1)+'万' : v >= 1000 ? v.toLocaleString() : Math.round(v);
  return '<div class="rwp-res-item">'+svg+'<span><span class="rwp-res-val'+(neg?' neg':'')+'">'+display+'</span><span class="rwp-res-unit">'+unit+'</span></span></div>';
}

