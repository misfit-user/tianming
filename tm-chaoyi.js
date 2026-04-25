// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  tm-chaoyi.js — 朝议系统（R112 从 tm-chaoyi-keju.js L1054-end 拆出）
// Requires: tm-utils.js (GameHooks, _$, callAI, escHtml),
//           tm-index-world.js (findCharByName)
// 姊妹文件：tm-keju.js (科举) · tm-chaoyi-v2.js (R129 三会议 v2 流式版)
//
// R157 章节导航 (清债后约 160 行)：
//   §1 [L20]  openChaoyi/closeChaoyi 入口 + 频率限制
//   §2 [L57]  _cyShowInputRow / _cySubmitPlayerLine 玩家输入
//   §3 [L83]  _getPlayerLocation / _isAtCapital 位置判定
//   §4 [L100] showChaoyiSetup 三模式选卡
//   §5 [L126] _cy_pickMode 分发到 v2
//   §6 [L134] startChaoyiSession 旧名兼容桩
//   §7 [L143] addCYBubble 共享气泡（v2 主调）
// 
// ============================================================

function openChaoyi(){
  // 频率限制：每回合最多2次朝议（廷议+常朝各1次，御前会议不限）
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
  if (GM._chaoyiCount[GM.turn] >= 2) { toast('今日已朝议' + GM._chaoyiCount[GM.turn] + '次，改日再议'); return; }
  CY={open:true,topic:"",selected:[],messages:[],speaking:false,abortCtrl:null,round:0,phase:'setup',stances:{},mode:'tinyi',maxRounds:99,_playerActions:[],_pendingPlayerLine:null,_abortChaoyi:false};
  var modal=document.createElement("div");modal.className="modal-bg show";modal.id="chaoyi-modal";
  modal.innerHTML='<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:95%;max-width:860px;height:88vh;display:flex;flex-direction:column;overflow:hidden;">'
    +'<div style="padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'
    +'<div id="cy-mode-label" style="font-size:1.1rem;font-weight:700;color:var(--gold);">\uD83C\uDFDB \u671D\u8BAE</div>'
    +'<div style="display:flex;align-items:center;gap:0.6rem;">'
    +'<span id="cy-round-tag" style="font-size:0.72rem;color:var(--txt-d);display:none;"></span>'
    +'<button class="bt bs bsm" onclick="closeChaoyi()">\u2715 \u9000\u671D</button></div></div>'
    +'<div id="cy-topic" style="padding:0.5rem 1.2rem;border-bottom:1px solid var(--bdr);display:none;font-size:0.9rem;color:var(--gold-l);"></div>'
    +'<div id="cy-body" style="flex:1;overflow-y:auto;padding:1rem;"></div>'
    +'<div id="cy-input-row" style="padding:0.5rem 0.8rem;border-top:1px solid var(--bdr);background:var(--color-elevated);display:none;align-items:center;gap:0.4rem;">'
      +'<input type="text" id="cy-player-input" placeholder="陛下欲言……(回车插言)" style="flex:1;padding:0.4rem 0.6rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-size:0.8rem;" onkeydown="if(event.key===\'Enter\'){_cySubmitPlayerLine();}" />'
      +'<button class="bt bsm bp" onclick="_cySubmitPlayerLine()">📣 插言</button>'
      +'<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_cyAbortChaoyi()" title="立即停止当前发言序列">⏸ 打断</button>'
    +'</div>'
    +'<div id="cy-footer" style="padding:0.6rem 1rem;border-top:1px solid var(--bdr);"></div></div>';
  document.body.appendChild(modal);
  showChaoyiSetup();
}

function closeChaoyi(){
  CY.open=false;CY.phase='setup';CY._pendingPlayerLine=null;CY._abortChaoyi=true;
  if(CY.abortCtrl){try{CY.abortCtrl.abort();}catch(e){ console.warn("[catch] 静默异常:", e.message || e); }}
  var m=_$("chaoyi-modal");if(m)m.remove();
  if(typeof renderLeftPanel==='function')renderLeftPanel();
  // 后朝结束钩子——触发史记弹窗或过渡到加载条
  if (GM._isPostTurnCourt && typeof _onPostTurnCourtEnd === 'function') {
    _onPostTurnCourtEnd();
  }
}

/** 显示/隐藏玩家输入栏（朝议进入讨论后再显示） */
function _cyShowInputRow(show){
  var row=_$("cy-input-row"); if(!row) return;
  row.style.display = show ? 'flex' : 'none';
}

/** 玩家回车或点击"插言"：将发言缓存，下一轮 AI 生成前会被读取并插入对话 */
function _cySubmitPlayerLine(){
  var inp=_$("cy-player-input"); if(!inp) return;
  var v=(inp.value||'').trim();
  if(!v) return;
  if(!CY || !CY.open){ toast('朝议已散'); return; }
  CY._pendingPlayerLine = v;
  inp.value = '';
  // 立刻显示一个"候言"提示气泡，避免玩家以为没反应
  try { if(typeof addCYBubble==='function') addCYBubble('内侍','（陛下举笏示意，待当前发言毕即插言。）', true); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

/** 玩家打断：停止当前发言序列 */
function _cyAbortChaoyi(){
  if(!CY || !CY.open) return;
  CY._abortChaoyi = true;
  if(CY.abortCtrl){ try { CY.abortCtrl.abort(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}} }
  try { if(typeof addCYBubble==='function') addCYBubble('内侍','（陛下拊案——群臣噤声。）', true); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

/** 获取玩家当前所在地（可能不是京城） */
function _getPlayerLocation() {
  if (P.playerInfo && P.playerInfo.characterName) {
    var pch = findCharByName(P.playerInfo.characterName);
    if (pch && pch.location) return pch.location;
  }
  return GM._capital || '京城';
}

function _isAtCapital(ch) {
  if (!ch || ch.alive === false) return false;
  var playerLoc = _getPlayerLocation();
  var loc = ch.location || (GM._capital || '京城');
  if (ch._travelTo) return false;
  // 使用 _isSameLocation 做宽松匹配——紫禁城·乾清宫 / 坤宁宫 / 京师·文渊阁 视为同地
  return (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (loc === playerLoc);
}

function showChaoyiSetup(){
  var body=_$("cy-body");var footer=_$("cy-footer");
  body.innerHTML = '<div style="padding:1.5rem 1rem;">'
    + '<div style="text-align:center;font-size:1rem;color:var(--gold);letter-spacing:0.12em;margin-bottom:1.2rem;">〔 今 日 朝 议 〕</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.8rem;">'
    + _cy_modeCardHtml('changchao', '📜 常 朝', '例行朝参', '多事并奏·百官齐集·逐条裁决', '30-50 人', '精力 10')
    + _cy_modeCardHtml('tinyi',    '🏛 廷 议', '集议大政', '一议多轮·辩难立场·共识或独断', '15-30 人', '精力 25')
    + _cy_modeCardHtml('yuqian',   '👑 御前会议', '密召心腹', '坦言直陈·君臣密议·可不录', '3-8 人',   '精力 10')
    + '</div>'
    + '<div style="text-align:center;margin-top:1rem;"><button class="bt" onclick="closeChaoyi()">取消</button></div>'
    + '</div>';
  footer.innerHTML = '';
}

function _cy_modeCardHtml(mode, title, subtitle, desc, scale, energy) {
  return '<div class="cy-mode-card" onclick="_cy_pickMode(\'' + mode + '\')" '
    + 'style="cursor:pointer;padding:0.9rem 0.6rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);text-align:center;transition:all 0.15s;" '
    + 'onmouseover="this.style.borderColor=\'var(--gold-500)\';this.style.background=\'var(--color-elevated)\'" '
    + 'onmouseout="this.style.borderColor=\'var(--color-border)\';this.style.background=\'var(--color-surface)\'">'
    + '<div style="font-size:1rem;font-weight:700;color:var(--gold-400);margin-bottom:0.3rem;">' + title + '</div>'
    + '<div style="font-size:0.72rem;color:var(--color-foreground);margin-bottom:0.5rem;">' + subtitle + '</div>'
    + '<div style="font-size:0.65rem;color:var(--color-foreground-muted);line-height:1.4;margin-bottom:0.5rem;">' + desc + '</div>'
    + '<div style="font-size:0.62rem;color:var(--ink-300);">' + scale + ' · ' + energy + '</div>'
    + '</div>';
}

function _cy_pickMode(mode) {
  CY.mode = mode;
  if (mode === 'changchao') {
    // CC 迁移波 5+：v2 §1 已物理删除·常朝唯一入口为 _cc3_open（tm-chaoyi-v3.js）
    if (typeof _cc3_open === 'function') {
      _cc3_open();
    } else if (typeof toast === 'function') {
      toast('常朝 v3 未加载·请刷新页面');
    }
    return;
  }
  if (mode === 'tinyi')  { _ty2_openSetup(); return; }
  if (mode === 'yuqian') { _yq2_openSetup(); return; }
}

// 老版进入函数——若旧代码路径仍调用，重导向到 showChaoyiSetup
function startChaoyiSession(){ showChaoyiSetup(); }

// ─── 共享气泡组件（v1 删除后唯一保留的 UI 工具·tm-chaoyi-v2.js 大量调用） ───
function addCYBubble(name,text,isSystem){
  var body=_$("cy-body");if(!body)return;
  var div=document.createElement("div");
  if(isSystem){
    div.style.cssText="text-align:center;margin:0.6rem 0;font-size:0.75rem;color:var(--txt-d);opacity:0.7;";
    div.textContent=text;
  } else {
    div.style.cssText="display:flex;gap:0.5rem;margin-bottom:0.8rem;animation:fi 0.3s ease;";
    var _cych=typeof findCharByName==='function'?findCharByName(name):null;
    var _cyAvatar=_cych&&_cych.portrait?'<img src="'+escHtml(_cych.portrait)+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">':'<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>';
    div.innerHTML=_cyAvatar
      +'<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;color:var(--gold);">'+escHtml(name)+'</div>'
      +'<div class="cy-bubble" style="background:var(--bg-3);border:1px solid var(--bdr);border-radius:3px 10px 10px 10px;padding:0.4rem 0.7rem;font-size:0.85rem;line-height:1.6;">'+text+'</div></div>';
  }
  body.appendChild(div);body.scrollTop=body.scrollHeight;
  return div;
}
