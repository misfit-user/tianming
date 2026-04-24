// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  tm-launch.js — 启动 & 编辑器入口（R111 从 tm-game-engine.js L1-1140 拆出）
//  姊妹文件: tm-player-actions.js (L1141-7013) + tm-game-loop.js (L7014-end)
//  原文件: tm-game-engine.js — 游戏引擎（启动·UI·存档·编辑器入口·9,043 行）
// Requires: tm-data-model.js (P, GM), tm-utils.js (all),
//           tm-index-world.js (findScenarioById, buildIndices, findCharByName),
//           tm-change-queue.js (makeEntitiesReactive),
//           tm-dynamic-systems.js (initAICache)
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 导航地图（2026-04-24 R53 实测更新）
// ══════════════════════════════════════════════════════════════
//
//  ┌─ §A 精力 & 清理（行 10-40） ───────────────────────┐
//  │  L11    _spendEnergy()            主角精力消耗判定
//  │  L30    _cleanupOverlays()        清理遗留浮层（防 DOM 漏）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §B 启动界面（行 40-440） ─────────────────────────┐
//  │  L43    showScnSelect()           显示剧本选择
//  │  L403   backToLaunch()            从游戏退回启动页
//  │         ↓ saveP() + GameHooks.run('backToLaunch:after')
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §C 编辑器入口（行 440-1100） ─────────────────────┐
//  │  L442   enterEditor(sid)          进入游戏内编辑器
//  │  （具体 tab 渲染在 tm-editor-details.js / tm-audio-theme.js）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §D 设置面板（行 1100-1300） ──────────────────────┐
//  │  L1146  openSettings()            打开设置（会被 tm-patches.js 覆盖）
//  │  L1291  closeSettings()           关闭设置
//  │  （tm-patches.js 内完整重写 openSettings，涵盖 API 配置）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §E 玩家操作工具（行 1300-5300） ──────────────────┐
//  │  发诏令 / 问对 / 传书 / 起居注 / 纪事 / 史记 / 朝议等
//  │  核心 UI 生成+玩家输入收集逻辑
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §F 结算管道注册（行 5300-7300） ──────────────────┐
//  │  L5302  _settleLettersAndTravel()  信件传递+赶路
//  │  L5884  renderGameState()         主状态渲染入口
//  │  L6943  enterGame()               加载剧本后进入游戏
//  │  L7366  startGame(sid)            新游戏启动入口
//  │  L7891  SettlementPipeline.register(...)  结算顺序注册
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §G 存档/加载生命周期（行 7300-9000） ─────────────┐
//  │  startGame → enterGame → SaveManager / autoSave
//  │  GameHooks.run('xxx:after') 多处 hook 扩展点
//  │  fullLoadGame 在 tm-audio-theme.js（历史原因）
//  └─────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  🛠️ 调试入口
// ══════════════════════════════════════════════════════════════
//
//  DA.turn.isRunning()                当前是否游戏中
//  DA.scenario.name()                 当前剧本名
//  TM.invariants.check()              所有不变量扫一遍
//  _cleanupOverlays()                 手工清理顶层浮层
//  backToLaunch()                     紧急退回启动页
//
// ══════════════════════════════════════════════════════════════
//  ⚠️ 常见陷阱
// ══════════════════════════════════════════════════════════════
//
//  1. openSettings 在 tm-patches.js:8 被完整重写。本文件的 L1146 版本
//     只在 tm-patches.js 未加载时生效。如果要改设置 UI 请改
//     tm-patches.js（或 R22 的 tm-settings-ui.js 迁移靶文件）
//
//  2. renderTechTab/renderRulTab/renderEvtTab 定义在本文件但被
//     tm-audio-theme.js 和 tm-editor-details.js 覆盖（加编辑按钮）
//
//  3. GameHooks.run() 的 hook 名字散落在各文件，grep 'GameHooks.run'
//     可见所有扩展点
//
//  4. 本文件不包含 fullLoadGame，在 tm-audio-theme.js 内（历史债务）
//
// ══════════════════════════════════════════════════════════════
// N4: 主角精力消耗——各操作消耗不同精力
function _spendEnergy(cost, actionName) {
  if (GM._energy === undefined) return true; // 系统未初始化则不限制
  if (GM._energy < cost) {
    toast('\u7CBE\u529B\u4E0D\u8DB3\uFF08\u9700' + cost + '\uFF0C\u5F53\u524D' + Math.round(GM._energy) + '\uFF09\uFF0C\u8BF7\u7ED3\u675F\u56DE\u5408\u4F11\u606F');
    return false;
  }
  GM._energy -= cost;
  _dbg('[Energy] ' + actionName + ' -' + cost + ' 剩余' + GM._energy);
  // 轻量更新精力条（避免重建整个左面板）
  var _enBar = document.getElementById('_energyBar');
  if (_enBar) {
    var _pct = Math.round((GM._energy / (GM._energyMax || 100)) * 100);
    var _col = _pct > 60 ? 'var(--celadon-400)' : _pct > 30 ? 'var(--gold-400)' : 'var(--vermillion-400)';
    _enBar.innerHTML = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:2px;">\u7CBE\u529B ' + Math.round(GM._energy) + '/' + (GM._energyMax || 100) + '</div>'
      + '<div style="height:4px;background:var(--bg-4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + _pct + '%;background:' + _col + ';border-radius:2px;transition:width 0.3s;"></div></div>';
  }
  return true;
}

function _cleanupOverlays(){
  ['save-manager-overlay','_scnPreview','_mapModeChoice','_enthrone-event','_charDetailOv','_renwuPageOv','_victory','_defeat','_endgame'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.remove();
  });
  // 清理浮动通知
  var nc=document.getElementById('notify-container');if(nc)nc.innerHTML='';
  document.querySelectorAll('.notify-urgent').forEach(function(el){el.remove();});
  document.querySelectorAll('.char-popup').forEach(function(el){el.remove();});
}
function doNewGame(){_dbg('[doNewGame] 执行开始');_cleanupOverlays();_$("launch").style.display="none";showScnSelect();}
function doLoadSave(){_dbg('[doLoadSave] 执行开始');_cleanupOverlays();if(typeof openSaveManager==='function'){openSaveManager();}else{importSaveFile();}}
function doEditor(){_dbg('[doEditor] 执行开始');_cleanupOverlays();_$("launch").style.display="none";showScnManage();}

function showScnSelect(){
  var page=_$("scn-page");
  page.classList.add("show");
  page.innerHTML="<button class=\"bt bs\" onclick=\"backToLaunch()\" style=\"position:fixed;top:1rem;left:1rem;z-index:1000;font-family:'STKaiti','KaiTi','楷体',serif;letter-spacing:0.15em;\">\u25C1 \u8FD4 \u56DE \u542F \u5E55</button>"+
    "<div class=\"scn-page-title\">\u9009 \u62E9 \u5267 \u672C</div>"+
    "<div style=\"font-family:'STKaiti','KaiTi','楷体',serif;font-size:12px;color:var(--ink-400);letter-spacing:0.3em;text-align:center;margin-top:8px;margin-bottom:16px;font-style:italic;\">\u2014\u2014 \u62E9\u4E00\u6BB5\u65F6\u65E5\uFF0C\u5165\u5176\u4E16\u754C \u2014\u2014</div>"+
    "<div class=\"scn-grid\">"+
    P.scenarios.map(function(s){
      return "<div class=\"scn-card\" onclick=\"previewScenario('"+escHtml(s.id)+"')\">"+
        "<div class=\"scn-era\">"+escHtml(s.era)+"</div>"+
        "<div class=\"scn-name\">"+escHtml(s.name)+"</div>"+
        "<div class=\"scn-role\">"+escHtml(s.role)+"</div>"+
        "<div class=\"scn-bg\">"+escHtml((s.background||'').substring(0,80))+(s.background&&s.background.length>80?'…':'')+"</div></div>";
    }).join("")+
    (P.scenarios.length===0?"<div style=\"color:var(--ink-400);text-align:center;padding:2rem;grid-column:1/-1;font-style:italic;font-family:'STKaiti','KaiTi','楷体',serif;letter-spacing:0.2em;\">\u6682\u65E0\u5267\u672C\uFF0C\u8BF7\u5148\u521B\u4F5C</div>":"")+
    "</div>";
}

// 剧本预览模态框
function previewScenario(sid) {
  var sc = findScenarioById(sid);
  if (!sc) { startGame(sid); return; }

  // 统计
  var charCount = (P.characters||[]).filter(function(c){return c.sid===sid;}).length;
  var facCount = (P.factions||[]).filter(function(f){return f.sid===sid;}).length;
  var partyCount = (P.parties||[]).filter(function(p){return p.sid===sid;}).length;
  var eventCount = 0;
  if (sc.events) { ['historical','random','conditional','story','chain'].forEach(function(k){ eventCount += (sc.events[k]||[]).length; }); }
  var pi = sc.playerInfo || {};
  var contradictions = pi.coreContradictions || [];

  var h = '<div style="position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:fi 0.2s ease;" id="_scnPreview" onclick="if(event.target===this)this.remove();">';
  h += '<div class="scn-preview-modal" onclick="event.stopPropagation();">';

  // 顶部金线装饰
  h += '<div style="height:2px;background:linear-gradient(90deg,transparent,var(--gold-500),var(--gold-400),var(--gold-500),transparent);margin-bottom:var(--space-4);"></div>';

  // 标题
  h += '<div style="text-align:center;margin-bottom:var(--space-4);">';
  h += '<div style="font-size:var(--text-xs);color:var(--gold-400);letter-spacing:0.15em;">' + (sc.era||'') + '</div>';
  h += '<div style="font-size:var(--text-2xl);font-weight:var(--weight-bold);color:var(--color-primary);letter-spacing:0.2em;margin:var(--space-1) 0;">〔' + (sc.name||'') + '〕</div>';
  if (sc.role) h += '<div style="font-size:var(--text-sm);color:var(--color-foreground-secondary);margin-top:var(--space-1);">' + sc.role + '</div>';
  h += '</div>';

  // 剧本概述
  if (sc.overview || sc.background) {
    h += '<div class="narrative-text" style="margin-bottom:var(--space-4);font-size:var(--text-sm);padding:var(--space-3);background:var(--color-sunken);border-radius:var(--radius-md);border-left:3px solid var(--gold-400);">';
    h += (sc.overview || sc.background || '').substring(0, 300);
    if ((sc.overview||sc.background||'').length > 300) h += '……';
    h += '</div>';
  }

  // 统计数据
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-2);margin-bottom:var(--space-4);text-align:center;">';
  var _stats = [{v:charCount,l:'\u4EBA\u7269',i:'person'},{v:facCount,l:'\u52BF\u529B',i:'faction'},{v:partyCount,l:'\u515A\u6D3E',i:'office'},{v:eventCount,l:'\u4E8B\u4EF6',i:'event'}];
  _stats.forEach(function(st){
    h += '<div style="background:var(--color-surface);padding:var(--space-3) var(--space-2);border-radius:var(--radius-sm);border:1px solid var(--color-border-subtle);">';
    h += '<div style="font-size:var(--text-xl);color:var(--color-primary);font-weight:var(--weight-bold);">' + st.v + '</div>';
    h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);display:flex;align-items:center;justify-content:center;gap:3px;">'+tmIcon(st.i,11)+st.l+'</div></div>';
  });
  h += '</div>';

  // 玩家信息
  if (pi.characterName || pi.factionName) {
    h += '<div style="padding:var(--space-3);background:rgba(120,81,169,0.1);border:1px solid rgba(120,81,169,0.2);border-radius:var(--radius-md);margin-bottom:var(--space-3);">';
    h += '<div style="font-size:var(--text-xs);color:var(--indigo-400);font-weight:var(--weight-bold);margin-bottom:var(--space-1);letter-spacing:0.08em;">'+tmIcon('person',12)+' \u73A9\u5BB6\u8EAB\u4EFD</div>';
    if (pi.characterName) h += '<div style="font-size:var(--text-sm);color:var(--color-foreground);">\u89D2\u8272\uFF1A' + pi.characterName + (pi.characterTitle ? ' \u300C' + pi.characterTitle + '\u300D' : '') + '</div>';
    if (pi.factionName) h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-secondary);">\u52BF\u529B\uFF1A' + pi.factionName + '</div>';
    h += '</div>';
  }

  // 显著矛盾
  if (contradictions.length > 0) {
    h += '<div style="padding:var(--space-3);background:rgba(192,64,48,0.06);border:1px solid rgba(192,64,48,0.15);border-radius:var(--radius-md);margin-bottom:var(--space-3);">';
    h += '<div style="font-size:var(--text-xs);color:var(--vermillion-400);font-weight:var(--weight-bold);margin-bottom:var(--space-2);letter-spacing:0.08em;">'+tmIcon('strife',12)+' \u663E\u8457\u77DB\u76FE</div>';
    var dimC = {political:'var(--indigo-400)',economic:'var(--gold-400)',military:'var(--vermillion-400)',social:'var(--celadon-400)'};
    contradictions.slice(0, 4).forEach(function(c) {
      h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-secondary);padding:2px 0;border-left:3px solid ' + (dimC[c.dimension]||'var(--color-foreground-muted)') + ';padding-left:var(--space-2);margin-bottom:3px;">' + (c.title||'') + '</div>';
    });
    h += '</div>';
  }

  // 水墨分隔线
  h += '<hr class="ink-divider" style="margin:var(--space-3) 0;">';

  // 难度选择
  h += '<div style="margin-bottom:var(--space-4);">';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-bottom:var(--space-2);text-align:center;letter-spacing:0.1em;">\u96BE\u5EA6\u9009\u62E9</div>';
  h += '<div style="display:flex;gap:var(--space-2);" id="_diffSelect">';
  h += '<button class="bt bs" style="flex:1;padding:var(--space-2);opacity:0.6;font-size:var(--text-sm);" onclick="_selectDiff(this,\'narrative\')">'+tmIcon('scroll',14)+' \u53D9\u4E8B</button>';
  h += '<button class="bt bp" style="flex:1;padding:var(--space-2);font-size:var(--text-sm);" onclick="_selectDiff(this,\'standard\')">'+tmIcon('policy',14)+' \u6807\u51C6</button>';
  h += '<button class="bt bs" style="flex:1;padding:var(--space-2);opacity:0.6;font-size:var(--text-sm);" onclick="_selectDiff(this,\'hardcore\')">'+tmIcon('troops',14)+' \u786C\u6838</button>';
  h += '</div>';
  h += '<div id="_diffDesc" style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-top:var(--space-1);text-align:center;">\u5E73\u8861\u7684AI\u63A8\u6F14\u4F53\u9A8C</div>';
  h += '</div>';

  // 按钮
  h += '<div style="display:flex;gap:var(--space-3);">';
  h += '<button class="bt bp" style="flex:2;padding:var(--space-3);font-size:var(--text-base);font-weight:var(--weight-bold);letter-spacing:0.1em;" onclick="document.getElementById(\'_scnPreview\').remove();_startWithDifficulty(\'' + sid + '\')">'+tmIcon('scroll',16)+' \u5F00\u59CB\u6E38\u620F</button>';
  h += '<button class="bt bs" style="flex:1;padding:var(--space-3);" onclick="document.getElementById(\'_scnPreview\').remove();">\u6401\u7F6E</button>';
  h += '</div>';

  // 底部金线
  h += '<div style="height:1px;background:linear-gradient(90deg,transparent,var(--gold-500),transparent);margin-top:var(--space-4);"></div>';

  h += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

var _selectedDifficulty = 'standard';
function _selectDiff(btn, diff) {
  _selectedDifficulty = diff;
  var btns = document.querySelectorAll('#_diffSelect button');
  for (var i = 0; i < btns.length; i++) { btns[i].className = 'bt'; btns[i].style.opacity = '0.6'; }
  btn.className = 'bt bp'; btn.style.opacity = '1';
  var descs = {narrative:'\u53D9\u4E8B\u4E3A\u4E3B\uFF0CAI\u66F4\u6E29\u548C\uFF0C\u51CF\u5C11\u7A81\u53D1\u707E\u96BE',standard:'\u5E73\u8861\u7684AI\u63A8\u6F14\u4F53\u9A8C',hardcore:'\u786C\u6838\u6A21\u5F0F\uFF0CAI\u66F4\u6FC0\u8FDB\uFF0C\u66F4\u591A\u5371\u673A\u4E8B\u4EF6'};
  var el = document.getElementById('_diffDesc');
  if (el) el.textContent = descs[diff] || '';
}

function _startWithDifficulty(sid) {
  window._pendingDifficulty = _selectedDifficulty;

  // 检查剧本是否有地图数据
  var sc = findScenarioById(sid);
  var hasMapData = sc && sc.map && sc.map.regions && sc.map.regions.length > 0;

  // 弹窗让玩家选择地图模式
  _showMapModeChoice(sid, hasMapData);
}

/**
 * 地图模式选择弹窗
 */
function _showMapModeChoice(sid, hasMapData) {
  var h = '<div style="position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:fi 0.2s ease;" id="_mapModeChoice">';
  h += '<div class="scn-preview-modal" style="max-width:480px;text-align:center;" onclick="event.stopPropagation();">';

  h += '<div style="height:2px;background:linear-gradient(90deg,transparent,var(--gold-500),transparent);margin-bottom:var(--space-4);"></div>';
  h += '<div style="font-size:var(--text-lg);font-weight:var(--weight-bold);color:var(--color-primary);letter-spacing:0.15em;">〔 舆 图 之 选 〕</div>';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin:var(--space-2) 0 var(--space-4);">选择空间系统的运作方式</div>';

  h += '<div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-3);">';

  // 选项一：使用剧本地图
  var mapDisabled = !hasMapData;
  h += '<div style="flex:1;background:var(--color-surface);border:1px solid ' + (mapDisabled ? 'var(--color-border-subtle)' : 'var(--color-border-subtle)') + ';border-radius:var(--radius-md);padding:var(--space-3);cursor:' + (mapDisabled ? 'not-allowed' : 'pointer') + ';transition:all 0.2s;opacity:' + (mapDisabled ? '0.4' : '1') + ';" ';
  if (!mapDisabled) {
    h += 'onmouseover="this.style.borderColor=\'var(--gold-500)\';this.style.boxShadow=\'var(--shadow-sm)\'" ';
    h += 'onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.boxShadow=\'none\'" ';
    h += 'onclick="_confirmMapMode(\'' + sid + '\',true)">';
  } else {
    h += '>';
  }
  h += '<div style="font-size:2rem;margin-bottom:var(--space-2);">' + tmIcon('map', 28) + '</div>';
  h += '<div style="font-size:var(--text-base);font-weight:var(--weight-bold);color:' + (mapDisabled ? 'var(--ink-300)' : 'var(--celadon-400)') + ';margin-bottom:var(--space-1);">采用剧本地图</div>';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);line-height:var(--leading-normal);">';
  if (hasMapData) {
    h += '使用剧本编辑者配置的地图区域、道路、关隘数据进行寻路和空间计算。';
  } else {
    h += '此剧本未配置地图数据，无法使用此选项。';
  }
  h += '</div></div>';

  // 选项二：AI地理志
  h += '<div style="flex:1;background:var(--color-surface);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);padding:var(--space-3);cursor:pointer;transition:all 0.2s;" ';
  h += 'onmouseover="this.style.borderColor=\'var(--gold-500)\';this.style.boxShadow=\'var(--shadow-sm)\'" ';
  h += 'onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.boxShadow=\'none\'" ';
  h += 'onclick="_confirmMapMode(\'' + sid + '\',false)">';
  h += '<div style="font-size:2rem;margin-bottom:var(--space-2);">' + tmIcon('scroll', 28) + '</div>';
  h += '<div style="font-size:var(--text-base);font-weight:var(--weight-bold);color:var(--gold-400);margin-bottom:var(--space-1);">AI 地理志</div>';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);line-height:var(--leading-normal);">';
  h += '由AI根据真实历史地理知识推算距离、地形、关隘、城防。无需地图数据，适合所有剧本。';
  h += '</div></div>';

  h += '</div>';

  h += '<div style="height:1px;background:linear-gradient(90deg,transparent,var(--gold-500),transparent);"></div>';
  h += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

function _confirmMapMode(sid, useMap) {
  var overlay = document.getElementById('_mapModeChoice');
  if (overlay) overlay.remove();

  // 存储选择
  window._pendingUseMap = useMap;

  // 进入存档命名 + 游戏模式选择
  _showGameSetupModal(sid);
}

/**
 * 存档命名 + 游戏模式选择弹窗（web 端）
 */
var _pendingGameMode = 'yanyi';
function _showGameSetupModal(sid) {
  var sc = findScenarioById(sid);
  var defaultName = sc ? (sc.name || '新纪元') : '新纪元';
  // 加日期戳以区分多次开局
  var d = new Date();
  var pad = function(n){return n<10?'0'+n:n;};
  var stamp = d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes());
  defaultName = defaultName + '·' + stamp;

  _pendingGameMode = 'yanyi';

  var h = '<div style="position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:fi 0.2s ease;" id="_gameSetupModal">';
  h += '<div class="scn-preview-modal" style="max-width:560px;" onclick="event.stopPropagation();">';

  // 顶部金线
  h += '<div style="height:2px;background:linear-gradient(90deg,transparent,var(--gold-500),var(--gold-400),var(--gold-500),transparent);margin-bottom:var(--space-4);"></div>';

  // 标题
  h += '<div style="text-align:center;margin-bottom:var(--space-4);">';
  h += '<div style="font-size:var(--text-lg);font-weight:var(--weight-bold);color:var(--color-primary);letter-spacing:0.2em;">〔 开 卷 立 册 〕</div>';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-top:var(--space-1);">为此局推演命名，择定史笔之格</div>';
  h += '</div>';

  // 存档名输入
  h += '<div style="margin-bottom:var(--space-4);">';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-bottom:var(--space-2);letter-spacing:0.1em;">'+tmIcon('scroll',12)+' 存档名</div>';
  h += '<input id="_gs_saveName" type="text" value="'+escHtml(defaultName)+'" style="width:100%;padding:var(--space-3);background:var(--color-sunken);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);color:var(--color-foreground);font-family:var(--font-serif);font-size:var(--text-base);letter-spacing:0.05em;" placeholder="为此次推演起一个名字">';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-top:var(--space-1);">将用于存档、导出、史记标识</div>';
  h += '</div>';

  // 三模式选择
  h += '<div style="margin-bottom:var(--space-3);">';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-bottom:var(--space-2);letter-spacing:0.1em;">'+tmIcon('chronicle',12)+' 史笔之格</div>';

  // 演义（默认选中）
  h += '<div id="_gm_yanyi" class="_gm-opt _gm-active" onclick="_selectGameMode(this,\'yanyi\')" style="border:2px solid var(--gold-500);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-2);cursor:pointer;background:rgba(184,154,83,0.08);transition:all 0.2s;">';
  h += '<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px;">';
  h += '<span>'+tmIcon('scroll',16)+'</span>';
  h += '<span style="color:var(--gold-400);font-weight:var(--weight-bold);font-size:var(--text-base);">演义</span>';
  h += '<span style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-left:auto;">小说化 · 戏剧性</span>';
  h += '</div>';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-secondary);line-height:var(--leading-normal);">AI 可自由发挥，允许架空情节。历史名臣全时段可现，戏剧张力最大。</div>';
  h += '</div>';

  // 轻度史实
  h += '<div id="_gm_light" class="_gm-opt" onclick="_selectGameMode(this,\'light_hist\')" style="border:2px solid var(--color-border-subtle);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-2);cursor:pointer;transition:all 0.2s;">';
  h += '<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px;">';
  h += '<span>'+tmIcon('policy',16)+'</span>';
  h += '<span style="color:var(--celadon-400);font-weight:var(--weight-bold);font-size:var(--text-base);">轻度史实</span>';
  h += '<span style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-left:auto;">大事遵史 · 细节可演</span>';
  h += '</div>';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-secondary);line-height:var(--leading-normal);">大事件（战争/朝代更替/重大改革）沿史脉发展，细节可因干预而变。名臣限开局前后二百年内。</div>';
  h += '</div>';

  // 严格史实
  h += '<div id="_gm_strict" class="_gm-opt" onclick="_selectGameMode(this,\'strict_hist\')" style="border:2px solid var(--color-border-subtle);border-radius:var(--radius-md);padding:var(--space-3);cursor:pointer;transition:all 0.2s;">';
  h += '<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px;">';
  h += '<span>'+tmIcon('history',16)+'</span>';
  h += '<span style="color:var(--vermillion-400);font-weight:var(--weight-bold);font-size:var(--text-base);">严格史实</span>';
  h += '<span style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-left:auto;">资治通鉴级 · 客观克制</span>';
  h += '</div>';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-secondary);line-height:var(--leading-normal);">严格遵守史实，AI 参照史料与学术研究。数值渐变、信息不对称、政策延迟。名臣限开局前后百年。</div>';
  h += '</div>';

  // 严格史实参考文本
  h += '<div id="_gs_strictRef" style="display:none;margin-top:var(--space-3);padding:var(--space-3);background:var(--color-sunken);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);">';
  h += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-bottom:var(--space-1);">'+tmIcon('memorial',12)+' 参考史料（选填）</div>';
  h += '<textarea id="_gs_refText" placeholder="可粘贴正史记载、大事年表、学术研究等，AI 将严格参照此文本推演" style="width:100%;min-height:100px;padding:var(--space-2);background:var(--color-background);border:1px solid var(--color-border-subtle);border-radius:var(--radius-sm);color:var(--color-foreground);font-family:var(--font-serif);font-size:var(--text-xs);line-height:var(--leading-normal);resize:vertical;"></textarea>';
  h += '</div>';

  h += '</div>';

  // 分隔
  h += '<hr class="ink-divider" style="margin:var(--space-3) 0;">';

  // 按钮
  h += '<div style="display:flex;gap:var(--space-3);">';
  h += '<button class="bt bp" style="flex:2;padding:var(--space-3);font-size:var(--text-base);font-weight:var(--weight-bold);letter-spacing:0.1em;" onclick="_finalizeStartGame(\''+sid+'\')">'+tmIcon('scroll',16)+' 开卷推演</button>';
  h += '<button class="bt bs" style="flex:1;padding:var(--space-3);" onclick="document.getElementById(\'_gameSetupModal\').remove();_startWithDifficulty(\''+sid+'\');">返回</button>';
  h += '</div>';

  h += '<div style="height:1px;background:linear-gradient(90deg,transparent,var(--gold-500),transparent);margin-top:var(--space-4);"></div>';

  h += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);

  // 聚焦存档名
  setTimeout(function(){var inp=document.getElementById('_gs_saveName');if(inp){inp.focus();inp.select();}},100);
}

/**
 * 切换游戏模式选择
 */
function _selectGameMode(el, mode) {
  _pendingGameMode = mode;
  var ids = ['_gm_yanyi','_gm_light','_gm_strict'];
  ids.forEach(function(id){
    var d = document.getElementById(id);
    if (d) {
      d.style.borderColor = 'var(--color-border-subtle)';
      d.style.background = '';
      d.classList.remove('_gm-active');
    }
  });
  el.style.borderColor = 'var(--gold-500)';
  el.style.background = 'rgba(184,154,83,0.08)';
  el.classList.add('_gm-active');
  // 严格史实展开参考文本
  var ref = document.getElementById('_gs_strictRef');
  if (ref) ref.style.display = (mode==='strict_hist') ? 'block' : 'none';
}

/**
 * 确认存档名与模式，进入游戏
 */
function _finalizeStartGame(sid) {
  var nameEl = document.getElementById('_gs_saveName');
  var name = nameEl ? (nameEl.value || '').trim() : '';
  if (!name) { toast('请先为此局命名'); if(nameEl) nameEl.focus(); return; }

  if (!P.conf) P.conf = {};
  P.conf.gameMode = _pendingGameMode || 'yanyi';

  // 严格史实的参考文本
  if (P.conf.gameMode === 'strict_hist') {
    var refEl = document.getElementById('_gs_refText');
    P.conf.refText = refEl ? (refEl.value || '').trim() : '';
  } else {
    P.conf.refText = '';
  }

  // 预设存档名（startGame 会读取 _prevSaveName 继承）
  if (typeof GM !== 'undefined') GM.saveName = name;
  window._pendingSaveName = name;

  var overlay = document.getElementById('_gameSetupModal');
  if (overlay) overlay.remove();

  startGame(sid);
}

function showScnManage(){
  var page=_$("scn-page");
  page.classList.add("show");
  page.innerHTML="<button class=\"bt bs\" onclick=\"backToLaunch()\" style=\"position:fixed;top:1rem;left:1rem;z-index:1000;font-family:'STKaiti','KaiTi','楷体',serif;letter-spacing:0.15em;\">\u25C1 \u8FD4 \u56DE \u542F \u5E55</button>"+
    "<div class=\"scn-page-title edit-title-purple\">\u8457 \u5377 \u00B7 \u7F16 \u8F91 \u5668</div>"+
    "<div style=\"font-family:'STKaiti','KaiTi','楷体',serif;font-size:12px;color:var(--ink-400);letter-spacing:0.3em;text-align:center;margin-top:8px;margin-bottom:16px;font-style:italic;\">\u2014\u2014 \u5F00\u7089\u7ACB\u8A00\uFF0C\u9020\u5316\u4E00\u4E16 \u2014\u2014</div>"+
    "<div style=\"display:flex;gap:10px;margin-top:var(--space-3);justify-content:center;flex-wrap:wrap;\">"+
    "<button class=\"bai edit-op\" onclick=\"aiGenFullScenario()\" style=\"font-family:'STKaiti','KaiTi','楷体',serif;letter-spacing:0.12em;\">\u2728 AI \u4E00 \u952E \u9020 \u5377</button></div>"+
    "<div id=\"ai-full-gen-panel\" style=\"display:none;max-width:600px;width:100%;margin-top:1rem;\"></div>"+
    "<div class=\"scn-grid edit-grid-purple\">"+
    "<div class=\"scn-card scn-card-new\" onclick=\"createNewScn()\">\uFF0B \u65B0 \u5EFA \u7A7A \u5377</div>"+
    P.scenarios.map(function(s,i){
      return "<div class=\"scn-card\" onclick=\"openEditorHtml('"+s.id+"')\">"+
        "<div class=\"scn-era\">"+s.era+"</div>"+
        "<div class=\"scn-name\">"+s.name+"</div>"+
        "<div class=\"scn-role\">"+s.role+"</div>"+
        "<div style=\"display:flex;justify-content:flex-end;margin-top:0.5rem;\"><button class=\"bd bsm\" onclick=\"event.stopPropagation();if(confirm('\u5220\u9664?')){P.scenarios.splice("+i+",1);saveP();showScnManage();}\">\u5220\u9664</button></div></div>";
    }).join("")+
    "</div>";
}

function backToLaunch(){_cleanupOverlays();_$("scn-page").classList.remove("show");_$("scn-page").innerHTML="";_$("bar").style.display="none";_$("E").style.display="none";_$("G").style.display="none";_$("launch").style.display="flex";var sf=_$("shiji-btn");if(sf)sf.classList.remove("show");var sb=_$("save-btn");if(sb)sb.classList.remove("show");saveP();GameHooks.run('backToLaunch:after');}

function createNewScn(){
  var modal=document.createElement("div");modal.className="modal-bg show";modal.id="new-scn-modal";
  modal.innerHTML="<div class=\"modal-box\" style=\"max-width:350px;text-align:center;\"><div style=\"font-size:1.2rem;font-weight:700;color:var(--gold);margin-bottom:1rem;\">\u521B\u5EFA\u65B0\u5267\u672C</div><div class=\"fd full\"><label>\u5267\u672C\u540D\u79F0</label><input id=\"new-scn-name\" autofocus></div><div style=\"display:flex;gap:0.5rem;margin-top:1rem;\"><button class=\"bt bp\" style=\"flex:1;\" onclick=\"confirmNewScn()\">\u521B\u5EFA</button><button class=\"bt bs\" style=\"flex:1;\" onclick=\"_$('new-scn-modal').remove()\">\u53D6\u6D88</button></div></div>";
  document.body.appendChild(modal);
  setTimeout(function(){var inp=_$("new-scn-name");if(inp)inp.focus();},100);
}
function confirmNewScn(){
  var name=_$("new-scn-name")?_$("new-scn-name").value.trim():"";
  if(!name){toast("\u8F93\u5165\u540D\u79F0");return;}
  _$("new-scn-modal").remove();
  var id=uid();
  P.scenarios.push({id:id,era:"",name:name,role:"",background:"",tags:[],opening:"",suggestions:[],active:true,winCond:"",loseCond:"",customPrompt:"",scnStyle:"",scnStyleRule:"",refText:"",masterScript:"",refFiles:[]});
  saveP(); // 持久化新建的剧本
  openEditorHtml(id);
}

// ============================================================
//  编辑器框架
// ============================================================
var editorTabs=[
  {id:"t-scn",icon:"\uD83D\uDCDC",label:"\u5267\u672C\u4FE1\u606F",group:"\u6838\u5FC3"},
  {id:"t-chr",icon:"\uD83D\uDC64",label:"\u89D2\u8272",group:"\u5185\u5BB9"},
  {id:"t-fac",icon:"\uD83C\uDFDB",label:"\u515A\u6D3E",group:"\u5185\u5BB9"},
  {id:"t-class",icon:"\uD83D\uDC51",label:"\u9636\u5C42",group:"\u5185\u5BB9"},
  {id:"t-itm",icon:"\uD83D\uDDE1",label:"\u7269\u54C1",group:"\u5185\u5BB9"},
  {id:"t-mil",icon:"\u2694",label:"\u519B\u4E8B",group:"\u5185\u5BB9"},
  {id:"t-tech",icon:"\uD83D\uDD2C",label:"\u79D1\u6280\u6811",group:"\u5185\u5BB9"},
  {id:"t-civic",icon:"\uD83C\uDFDB",label:"\u5E02\u653F\u6811",group:"\u5185\u5BB9"},
  {id:"t-var",icon:"\uD83D\uDCCA",label:"\u53D8\u91CF",group:"\u7CFB\u7EDF"},
  {id:"t-rul",icon:"\u2696",label:"\u89C4\u5219",group:"\u7CFB\u7EDF"},
  {id:"t-evt",icon:"\uD83C\uDFAD",label:"\u4E8B\u4EF6",group:"\u7CFB\u7EDF"},
  {id:"t-tim",icon:"\u23F1",label:"\u65F6\u95F4",group:"\u4E16\u754C"},
  {id:"t-map",icon:"\uD83D\uDDFA",label:"\u5730\u56FE",group:"\u4E16\u754C"},
  {id:"t-wld",icon:"\uD83C\uDF0D",label:"\u4E16\u754C",group:"\u4E16\u754C"},
  {id:"t-office",icon:"\uD83C\uDFDB",label:"\u5B98\u5236",group:"\u4E16\u754C"}
];

function enterEditor(sid){
  editingScenarioId=sid;
  _$("scn-page").classList.remove("show");
  _$("bar").style.display="flex";
  _$("E").style.display="flex";
  _$("G").style.display="none";

  var sc=findScenarioById(sid);

  // 顶部栏按钮
  _$("bar-btns").innerHTML="<span style=\"font-size:0.78rem;color:var(--gold);background:rgba(201,168,76,0.1);padding:0.2rem 0.6rem;border-radius:8px;border:1px solid var(--gold-d);\">\u7F16\u8F91: "+(sc?sc.name:"")+"</span>"+
    "<button class=\"bt bp\" onclick=\"saveAndBack()\">\uD83D\uDCBE \u4FDD\u5B58\u5E76\u8FD4\u56DE</button>"+
    "<button class=\"tb\" onclick=\"if(confirm('\u8FD4\u56DE?'))backToLaunch()\">\u2190 \u8FD4\u56DE</button>";

  // 侧边栏
  var sbHtml="";var lastGroup="";
  editorTabs.forEach(function(tab){
    if(tab.group!==lastGroup){sbHtml+="<div class=\"sg\">"+tab.group+"</div>";lastGroup=tab.group;}
    sbHtml+="<div class=\"si\" onclick=\"switchEdTab(this,'"+tab.id+"')\">"+tab.icon+" <span>"+tab.label+"</span><span class=\"ed-badge\" id=\"edb-"+tab.id+"\"></span></div>";
  });
  _$("sidebar").innerHTML=sbHtml;

  // 锁定下拉框
  loadT();
  renderEdTab("t-scn");
  _$("sidebar").querySelector(".si").classList.add("on");
}

function saveAndBack(){
  if(window.tianming&&window.tianming.isDesktop){window.tianming.autoSave(P).then(function(){toast("\u2705 \u5DF2\u4FDD\u5B58");}).catch(function(e){console.warn('[saveAndBack]',e);toast("\u2705 \u5DF2\u4FDD\u5B58");});}else{toast("\u2705 \u5DF2\u4FDD\u5B58");}
  setTimeout(backToLaunch,300);
}

function switchEdTab(el,id){
  document.querySelectorAll(".si").forEach(function(s){s.classList.remove("on");});
  el.classList.add("on");
  renderEdTab(id);
  GameHooks.run('switchEdTab:after', el, id);
}

// ============================================================
//  编辑器标签页渲染
// ============================================================
function renderEdTab(id){
  var em=_$("em");
  var sid=editingScenarioId;
  var sc=findScenarioById(sid)||{};

  if(id==="t-scn") renderScnTab(em,sc);
  else if(id==="t-chr") renderChrTab(em,sid);
  else if(id==="t-fac") renderFacTab(em,sid);
  else if(id==="t-class") renderClassTab(em,sid);
  else if(id==="t-itm") renderItmTab(em,sid);
  else if(id==="t-var") renderVarTab(em,sid);
  else if(id==="t-rul") renderRulTab(em,sid);
  else if(id==="t-evt") renderEvtTab(em,sid);
  else if(id==="t-mil") renderMilTab(em,sid);
  else if(id==="t-tech") renderTechTab(em,sid);
  else if(id==="t-civic") renderCivicTab(em,sid);
  else if(id==="t-tim") renderTimTab(em);
  else if(id==="t-map") renderMapTab(em);
  else if(id==="t-wld") renderWldTab(em,sid);
  else if(id==="t-office") renderOfficeTab(em);
  else em.innerHTML="<div style=\"color:var(--txt-d);padding:2rem;\">\u5F85\u5B9E\u73B0</div>";
  updateEdBadges(sid);
}
function updateEdBadges(sid){
  var counts={"t-chr":0,"t-fac":0,"t-class":0,"t-ext":0,"t-itm":0,"t-mil":0,"t-tech":0,"t-civic":0,"t-var":0,"t-rul":0,"t-evt":0,"t-wld":0,"t-office":0};
  function cf(arr){return Array.isArray(arr)?arr.filter(function(x){return x.sid===sid;}).length:0;}
  counts["t-chr"]=cf(P.characters);counts["t-fac"]=cf(P.factions);counts["t-class"]=cf(P.classes);
  counts["t-itm"]=cf(P.items);
  counts["t-var"]=cf(P.variables);counts["t-rul"]=cf(P.rules);counts["t-evt"]=cf(P.events);
  counts["t-tech"]=cf(P.techTree);counts["t-civic"]=cf(P.civicTree);
  if(P.world&&P.world.entries)counts["t-wld"]=P.world.entries.filter(function(e){return!e.sid||e.sid===sid;}).length;
  counts["t-office"]=(P.officeTree||[]).length;
  var mc=0;["troops","facilities","organization","campaigns"].forEach(function(k){mc+=P.military&&P.military[k]?cf(P.military[k]):0;});
  mc+=P.military&&P.military.armies?cf(P.military.armies):0;
  counts["t-mil"]=mc;
  Object.keys(counts).forEach(function(k){var el=document.getElementById("edb-"+k);if(el)el.textContent=counts[k]>0?counts[k]:"";});
}

// --- 角色 ---
function renderChrTab(em,sid){
  var list=P.characters.filter(function(c){return c.sid===sid;});
  em.innerHTML="<h4 style=\"color:var(--gold);\">\uD83D\uDC64 \u89D2\u8272 ("+list.length+")</h4>"+
    "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"addChr()\">\uFF0B \u65B0\u589E</button><button class=\"bai\" onclick=\"aiGenChr()\">\uD83E\uDD16 AI\u751F\u6210</button></div>"+
    list.map(function(ch){var i=P.characters.indexOf(ch);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><div><strong style=\"color:var(--gold-l);\">"+ch.name+"</strong> <span style=\"color:var(--txt-d);font-size:0.8rem;\">"+ch.title+"</span></div><div><button class=\"bs bsm\" onclick=\"editChr("+i+")\">\u7F16\u8F91</button> <button class=\"bd bsm\" onclick=\"P.characters.splice("+i+",1);renderEdTab('t-chr');\">\u2715</button></div></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+ch.desc+"</div></div>";}).join("")||"<div style=\"color:var(--txt-d);\">\u6682\u65E0</div>";
}
function addChr(){P.characters.push({sid:editingScenarioId,name:"\u65B0\u89D2\u8272",title:"",desc:"",stats:{},stance:"",playable:false,personality:"",appearance:"",skills:[],loyalty:70,morale:70,ambition:50,benevolence:50,intelligence:50,valor:50,dialogues:[],secret:"",faction:"",aiPersonaText:"",behaviorMode:"",valueSystem:"",speechStyle:"",rels:[],isHistorical:false,age:30,gender:"\u7537"});renderEdTab("t-chr");}
function editChr(i){
  var ch=P.characters[i];
  function sl(field,label,val,idx){
    return '<div class="sl-g"><label style="width:60px;font-size:12px;">'+label+'</label>'+
      '<input type="range" min="0" max="100" value="'+val+'" style="flex:1;" '+
      'oninput="P.characters['+idx+'].'+field+'=+this.value;this.nextElementSibling.textContent=this.value">'+
      '<span class="sl-v">'+val+'</span></div>';
  }
  var loyalty = ch.loyalty!=null?ch.loyalty:70;
  var ambition = ch.ambition!=null?ch.ambition:50;
  var benevolence = ch.benevolence!=null?ch.benevolence:50;
  var intelligence = ch.intelligence!=null?ch.intelligence:50;
  var valor = ch.valor!=null?ch.valor:50;
  var morale = ch.morale!=null?ch.morale:70;
  _$("em").innerHTML="<div class=\"cd\"><h4>\u7F16\u8F91\u89D2\u8272</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u540D\u79F0</label><input value=\""+ch.name+"\" onchange=\"P.characters["+i+"].name=this.value\"></div><div class=\"fd\"><label>\u5934\u8854</label><input value=\""+ch.title+"\" onchange=\"P.characters["+i+"].title=this.value\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u7ACB\u573A</label><input value=\""+(ch.stance||"")+"\" onchange=\"P.characters["+i+"].stance=this.value\"></div><div class=\"fd\"><label>\u6D3E\u7CFB</label><input value=\""+(ch.faction||"")+"\" onchange=\"P.characters["+i+"].faction=this.value\"></div></div>"+
    "<div class=\"fd full\"><label>\u63CF\u8FF0</label><textarea rows=\"2\" onchange=\"P.characters["+i+"].desc=this.value\">"+(ch.desc||"")+"</textarea></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>\u6027\u683C</label><input value=\""+(ch.personality||"")+"\" onchange=\"P.characters["+i+"].personality=this.value\"></div>"+
    "<div class=\"fd full\" style=\"margin-top:0.5rem;\"><label style=\"margin-bottom:4px;display:block;\">\u4E94\u7EF4\u5C5E\u6027</label>"+
    sl('loyalty','\u5FE0\u8BDA',loyalty,i)+
    sl('ambition','\u91CE\u5FC3',ambition,i)+
    sl('benevolence','\u4EC1\u5FB7',benevolence,i)+
    sl('intelligence','\u667A\u8C0B',intelligence,i)+
    sl('valor','\u6B66\u52C7',valor,i)+
    sl('morale','\u58EB\u6C14',morale,i)+
    "</div>"+
    "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>AI\u4EBA\u8BBE\u6587\u672C</label><textarea rows=\"3\" onchange=\"P.characters["+i+"].aiPersonaText=this.value\" placeholder=\"\u8BE6\u7EC6\u63CF\u8FF0\u4F9BAI\u5224\u65AD\u89D2\u8272\u884C\u4E3A\">"+(ch.aiPersonaText||"")+"</textarea></div>"+
    "<button class=\"bt bp\" onclick=\"renderEdTab('t-chr');toast('\u5DF2\u4FDD\u5B58')\" style=\"margin-top:0.5rem;\">\u5B8C\u6210</button></div>";
}

async function aiGenChr(){
  showLoading("\u751F\u6210\u89D2\u8272\u4E2D...",20);
  try{var ctx=findScenarioById(editingScenarioId);
    var era=ctx?ctx.era:"";var scnName=ctx?ctx.name:"";
    var histReq="\u3010\u8981\u6C42\u3011\u4EBA\u7269\u5FC5\u987B\u662F"+era+"\u65F6\u671F\u5B9E\u9645\u5B58\u5728\u7684\u5386\u53F2\u4EBA\u7269\uff0c\u4E0D\u5F97\u865A\u6784\u3002";
    var existChr=P.characters.filter(function(x){return x.sid===editingScenarioId;}).map(function(x){return x.name;});var existNote1=existChr.length?"已有人物（不得重复）："+existChr.join("、")+"\n":"";var content=await callAISmart("\u4F60\u662F\u4E2D\u56FD\u5386\u53F2\u4E13\u5BB6\u3002"+histReq+existNote1+"\u8BF7\u4E3A\u5267\u672C\u300A"+scnName+"\u300B("+era+")\u751F\u62125\u4E2A\u65B0\u5386\u53F2\u4EBA\u7269\uff0c\u4E25\u683C\u6309\u6B63\u53F2\u8FD8\u539F\u3002\u8FD4\u56DEJSON:\n[{\"name\":\"\",\"title\":\"\",\"desc\":\"\",\"personality\":\"\",\"stats\":{},\"loyalty\":70,\"ambition\":50,\"benevolence\":50,\"intelligence\":70,\"valor\":60,\"morale\":75,\"stance\":\"\",\"faction\":\"\",\"isHistorical\":true}]",2500,{minLength:200,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});
    var jm=content.match(/\[[\s\S]*\]/);if(jm){JSON.parse(jm[0]).forEach(function(c){P.characters.push({sid:editingScenarioId,name:c.name||"",title:c.title||"",desc:c.desc||"",stats:c.stats||{},stance:c.stance||"",playable:false,personality:c.personality||"",appearance:"",skills:[],loyalty:c.loyalty!=null?c.loyalty:70,morale:c.morale!=null?c.morale:75,ambition:c.ambition!=null?c.ambition:50,benevolence:c.benevolence!=null?c.benevolence:50,intelligence:c.intelligence!=null?c.intelligence:70,valor:c.valor!=null?c.valor:60,dialogues:[],secret:"",faction:c.faction||"",aiPersonaText:"",behaviorMode:"",valueSystem:"",speechStyle:"",rels:[],isHistorical:c.isHistorical||true,age:30,gender:"\u7537"});});renderEdTab("t-chr");toast("\u2705 \u5DF2\u751F\u6210");}
  }catch(err){toast("\u5931\u8D25: "+err.message);}
  finally{hideLoading();}
}

// renderFacTab 已在后面（约22128行）定义增强版本，此处不再重复
async function aiGenFac(){showLoading("生成党派中...",20);try{var ctx=P.scenarios.find(function(s){return s.id===editingScenarioId;});var era=ctx?ctx.era:"";var scnName=ctx?ctx.name:"";var histReq="《要求》派系必须是"+era+"时期真实存在的历史派系、震营或政治集团，领袖人物必须是该时期实有其人，不得虚构。";var existFac=P.factions.filter(function(x){return x.sid===editingScenarioId;}).map(function(x){return x.name;});var existNote2=existFac.length?"已有势力（不得重复）："+existFac.join("、")+"\n":"";var c=await callAISmart("你是中国历史专家。"+histReq+existNote2+"请为剧本《"+scnName+"》("+era+")生成3-5个历史上实际存在的派系或政治集团，严格按正史还原。返回JSON:[{\"name\":\"\",\"leader\":\"\",\"desc\":\"\",\"strength\":50,\"ideology\":\"\",\"territory\":\"\",\"traits\":[]}]",2000,{minLength:150,maxRetries:3,validator:function(c){try{var jm=c.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});var jm=c.match(/\[[\s\S]*\]/);if(jm){JSON.parse(jm[0]).forEach(function(f){P.factions.push({sid:editingScenarioId,name:f.name||"",leader:f.leader||"",desc:f.desc||"",color:"#"+Math.floor(random()*16777215).toString(16).padStart(6,"0"),traits:f.traits||[],strength:f.strength||50,territory:f.territory||"",ideology:f.ideology||""});});renderEdTab("t-fac");toast("历史派系已生成");}}catch(e){toast("失败: "+e.message);}finally{hideLoading();}}

// --- 阶层 ---
function renderClassTab(em,sid){
  var list=P.classes.filter(function(c){return c.sid===sid;});
  em.innerHTML="<h4 style=\"color:var(--gold);\">\uD83D\uDC51 \u9636\u5C42 ("+list.length+")</h4>"+
    "<button class=\"bt bp\" onclick=\"P.classes.push({sid:editingScenarioId,name:'\u65B0\u9636\u5C42',desc:'',privileges:'',restrictions:'',population:'',influence:50});renderEdTab('t-class');\">\uFF0B</button>"+
    "<div style=\"margin-top:0.8rem;\">"+list.map(function(c){var i=P.classes.indexOf(c);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+c.name+"</strong><button class=\"bd bsm\" onclick=\"P.classes.splice("+i+",1);renderEdTab('t-class');\">\u2715</button></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+c.desc+" | \u5F71\u54CD:"+c.influence+"</div></div>";}).join("")+"</div>";
}

// --- 外部势力 ---
// --- 物品 ---
function renderItmTab(em,sid){
  var list=P.items.filter(function(t){return t.sid===sid;});
  em.innerHTML="<h4 style=\"color:var(--gold);\">\uD83D\uDDE1 \u7269\u54C1/\u79D1\u6280/\u653F\u7B56 ("+list.length+")</h4>"+
    "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp bsm\" onclick=\"P.items.push({sid:editingScenarioId,name:'\u65B0',type:'item',desc:'',effect:{},prereq:'',acquired:false});renderEdTab('t-itm');\">\uFF0B\u7269\u54C1</button><button class=\"bt bp bsm\" onclick=\"P.items.push({sid:editingScenarioId,name:'\u65B0',type:'tech',desc:'',effect:{},prereq:'',acquired:false});renderEdTab('t-itm');\">\uFF0B\u79D1\u6280</button><button class=\"bt bp bsm\" onclick=\"P.items.push({sid:editingScenarioId,name:'\u65B0',type:'policy',desc:'',effect:{},prereq:'',acquired:false});renderEdTab('t-itm');\">\uFF0B\u653F\u7B56</button></div>"+
    list.map(function(t){var i=P.items.indexOf(t);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><div><span class=\"tg\">"+t.type+"</span> <strong>"+t.name+"</strong></div><button class=\"bd bsm\" onclick=\"P.items.splice("+i+",1);renderEdTab('t-itm');\">\u2715</button></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+t.desc+"</div></div>";}).join("")||"<div style=\"color:var(--txt-d);\">\u6682\u65E0</div>";
}

// --- 变量 ---
function renderVarTab(em,sid){
  var vars=P.variables.filter(function(v){return v.sid===sid;});
  var rels=P.relations.filter(function(r){return r.sid===sid;});
  em.innerHTML="<h4 style=\"color:var(--gold);\">\uD83D\uDCCA \u53D8\u91CF ("+vars.length+") \u00B7 \u5173\u7CFB ("+rels.length+")</h4>"+
    "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp bsm\" onclick=\"P.variables.push({sid:editingScenarioId,name:'\u65B0\u53D8\u91CF',value:50,min:0,max:100,color:'#c9a84c',icon:'',cat:'',visible:true,desc:''});renderEdTab('t-var');\">\uFF0B\u53D8\u91CF</button><button class=\"bt bp bsm\" onclick=\"P.relations.push({sid:editingScenarioId,name:'\u65B0\u5173\u7CFB',value:0,desc:''});renderEdTab('t-var');\">\uFF0B\u5173\u7CFB</button><button class=\'bt bg bsm\' onclick=\'aiGenVar()\'>AI\u751f\u6210</button></div>"+
    vars.map(function(v){var i=P.variables.indexOf(v);return "<div class=\"cd\" style=\"padding:0.5rem;display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;\"><input value=\""+v.name+"\" style=\"width:90px;font-weight:700;\" onchange=\"P.variables["+i+"].name=this.value\"><input type=\"number\" value=\""+v.value+"\" style=\"width:42px;\" onchange=\"P.variables["+i+"].value=+this.value\"><input type=\"color\" value=\""+(v.color||"#c9a84c")+"\" style=\"width:22px;height:20px;padding:0;border:none;\" onchange=\"P.variables["+i+"].color=this.value\"><button class=\"bd bsm\" onclick=\"P.variables.splice("+i+",1);renderEdTab('t-var');\">\u2715</button></div>";}).join("")+
    "<hr class=\"dv\"><div style=\"font-weight:700;color:var(--gold);margin-bottom:0.5rem;\">\u5173\u7CFB</div>"+
    rels.map(function(r){var i=P.relations.indexOf(r);return "<div class=\"cd\" style=\"display:flex;gap:0.4rem;align-items:center;padding:0.5rem;\"><input value=\""+r.name+"\" style=\"flex:1;\" onchange=\"P.relations["+i+"].name=this.value\"><input type=\"number\" value=\""+r.value+"\" style=\"width:50px;\" onchange=\"P.relations["+i+"].value=+this.value\"><button class=\"bd bsm\" onclick=\"P.relations.splice("+i+",1);renderEdTab('t-var');\">\u2715</button></div>";}).join("");
}

// --- 规则/事件/军事/科技/市政/时间/地图/世界/官制 ---
// 简化版渲染（功能完整但精简）
async function aiGenVar(){
  var sid=editingScenarioId;
  if(!sid){toast("\u8bf7\u5148\u9009\u62e9\u5267\u672c");return;}
  var scn=findScenarioById(sid)||{};
  var ctx=(scn.name||"")+(scn.era?","+scn.era:"")+(scn.background?","+scn.background:"");
  var vc=6,rc=5;
  var prompt="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002"+
    "\u5267\u672c\u80cc\u666f\uff1a"+ctx+
    "\n\u8bf7\u751f\u6210"+vc+"\u4e2a\u5168\u5c40\u53d8\u91cf\u548c"+rc+"\u4e2a\u4eba\u7269\u5173\u7cfb\u3002"+
    "\u53d8\u91cf\u5e94\u53cd\u6620\u8be5\u65f6\u671f\u771f\u5b9e\u653f\u6cbb\u3001\u519b\u4e8b\u3001\u7ecf\u6d4e\u3001\u6c11\u5fc3\u72b6\u51b5\u3002"+
    "\n\u8fd4\u56deJSON: {\"variables\":[{\"name\":\"...\",\"value\":50,\"min\":0,\"max\":100,\"desc\":\"...\"},...],"+
    "\"relations\":[{\"name\":\"...\",\"from\":\"...\",\"to\":\"...\",\"type\":\"...\",\"value\":50},...]}";
  showLoading("\u751f\u6210\u53d8\u91cf\u4e0e\u5173\u7cfb...");
  try{
    var existVar=P.variables.filter(function(x){return x.sid===editingScenarioId;}).map(function(x){return x.name;});var existNoteV=existVar.length?"\u5df2\u6709\u53d8\u91cf\uff08\u4e0d\u5f97\u91cd\u590d\uff09\uff1a"+existVar.join("\u3001")+"\n":"";var raw=await callAISmart(prompt+existNoteV,2000,{minLength:100,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return j.variables&&Array.isArray(j.variables)&&j.variables.length>=Math.min(vc,2);}catch(e){return false;}}});
    var j=JSON.parse(raw.replace(/```json|```/g,"").trim());
    var added=0;
    if(j.variables&&Array.isArray(j.variables))j.variables.forEach(function(v){
      P.variables.push({id:uid(),sid:sid,name:v.name||"",value:v.value!=null?v.value:50,min:v.min!=null?v.min:0,max:v.max!=null?v.max:100,color:"#c9a84c",icon:"",cat:"",visible:true,desc:v.desc||""});
      added++;
    });
    if(j.relations&&Array.isArray(j.relations))j.relations.forEach(function(r){
      P.relations.push({id:uid(),sid:sid,name:r.name||(r.from+"\u2192"+r.to),from:r.from||"",to:r.to||"",type:r.type||"",value:r.value!=null?r.value:50,desc:""});
      added++;
    });
    saveP();
    renderEdTab("t-var");
    toast("\u5df2\u751f\u6210\u53d8\u91cf/\u5173\u7cfb "+added+"\u4e2a");
  }catch(e){toast("\u751f\u6210\u5931\u8d25:"+e.message);}
  finally{hideLoading();}
}

function renderRulTab(em,sid){em.innerHTML="<h4 style=\"color:var(--gold);\">\u89C4\u5219</h4><button class=\"bt bp\" onclick=\"P.rules.push({sid:editingScenarioId,name:'\u65B0\u89C4\u5219',enabled:true,trigger:{type:'threshold',variable:'',op:'<',value:20},effect:{narrative:'',varChg:{},event:null}});renderEdTab('t-rul');\">\uFF0B</button>"+P.rules.filter(function(r){return r.sid===sid;}).map(function(r){var i=P.rules.indexOf(r);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+r.name+"</strong><button class=\"bd bsm\" onclick=\"P.rules.splice("+i+",1);renderEdTab('t-rul');\">\u2715</button></div></div>";}).join("");}
function renderEvtTab(em,sid){em.innerHTML="<h4 style=\"color:var(--gold);\">\u4E8B\u4EF6</h4><button class=\"bt bp\" onclick=\"P.events.push({sid:editingScenarioId,id:uid(),name:'\u65B0\u4E8B\u4EF6',type:'scripted',triggerTurn:0,oneTime:true,triggered:false,narrative:'',choices:[]});renderEdTab('t-evt');\">\uFF0B</button>"+P.events.filter(function(e){return e.sid===sid;}).map(function(ev){var i=P.events.indexOf(ev);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+ev.name+"</strong><button class=\"bd bsm\" onclick=\"P.events.splice("+i+",1);renderEdTab('t-evt');\">\u2715</button></div></div>";}).join("");}
function renderMilTab(em,sid){
  // Migrate legacy units[] -> troops[]
  if(!P.military.troops){P.military.troops=P.military.units||[];}
  if(!P.military.facilities){P.military.facilities=[];}
  if(!P.military.organization){P.military.organization=[];}
  if(!P.military.campaigns){P.military.campaigns=[];}

  var cats=[
    {key:'troops',label:'\u5175\u79CD'},
    {key:'facilities',label:'\u8BBE\u65BD'},
    {key:'organization',label:'\u7F16\u5236'},
    {key:'campaigns',label:'\u6218\u5F79'}
  ];

  var catsHTML=cats.map(function(cat){
    var items=(P.military[cat.key]||[]).filter(function(u){return u.sid===sid;});
    var rows=items.map(function(u){
      var i=P.military[cat.key].indexOf(u);
      return '<div style="background:var(--bg-3);border-radius:4px;padding:0.4rem;margin-top:0.3rem;display:flex;justify-content:space-between;align-items:center;">'+
        '<strong>'+u.name+'</strong><span style="font-size:12px;color:var(--txt-d);">'+(u.type||'')+(u.desc?('  - '+u.desc):'')+'</span>'+
        '<span><button class="bt bsm" onclick="editMilItem(\''+cat.key+'\','+i+')">\u7F16\u8F91</button>'+
        '<button class="bd bsm" onclick="P.military[\''+cat.key+'\'].splice('+i+',1);renderEdTab(\'t-mil\')">\u2715</button></span></div>';
    }).join('');
    return '<div class="cd" style="margin-top:0.5rem;"><h4>'+cat.label+' ('+items.length+')</h4>'+
      '<button class="bt bp bsm" onclick="addMilItem(\''+cat.key+'\')">＋ \u6DFB\u52A0</button>'+
      rows+'</div>';
  }).join('');

  em.innerHTML='<h4 style="color:var(--gold);">\u519B\u4E8B</h4>'+
    '<div class="cd"><h4>\u519B\u5236\u8BF4\u660E</h4><textarea rows="2" onchange="P.military.systemDesc=this.value">'+(P.military.systemDesc||'')+"</textarea></div>"+
    catsHTML;
}
function addMilItem(k){
  openGenericModal('\u6DFB\u52A0'+({'troops':'\u5175\u79CD','facilities':'\u8BBE\u65BD','organization':'\u7F16\u5236','campaigns':'\u6218\u5F79'}[k]||k),
    '<div class="form-group"><label>\u540D\u79F0</label><input id="gmf-name"></div>'+
    '<div class="form-group"><label>\u7C7B\u578B</label><input id="gmf-type"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="gmf-desc" rows="2"></textarea></div>',
    function(){
      if(!P.military[k])P.military[k]=[];
      P.military[k].push({sid:editingScenarioId,name:gv('gmf-name')||'\u65B0\u6761\u76EE',type:gv('gmf-type')||'',desc:gv('gmf-desc')||''});
      renderEdTab('t-mil');
    }
  );
}
function editMilItem(k,i){
  var u=P.military[k][i];
  openGenericModal('\u7F16\u8F91'+({'troops':'\u5175\u79CD','facilities':'\u8BBE\u65BD','organization':'\u7F16\u5236','campaigns':'\u6218\u5F79'}[k]||k),
    '<div class="form-group"><label>\u540D\u79F0</label><input id="gmf-name" value="'+escHtml(u.name||'')+'"></div>'+
    '<div class="form-group"><label>\u7C7B\u578B</label><input id="gmf-type" value="'+escHtml(u.type||'')+'"></div>'+
    '<div class="form-group"><label>\u63CF\u8FF0</label><textarea id="gmf-desc" rows="2">'+(u.desc||'')+'</textarea></div>',
    function(){
      P.military[k][i].name=gv('gmf-name');
      P.military[k][i].type=gv('gmf-type');
      P.military[k][i].desc=gv('gmf-desc');
      renderEdTab('t-mil');
    }
  );
}

function deleteMilItem(k,i){
  P.military[k].splice(i,1);
  renderEdTab('t-mil');
}

function renderTechTab(em,sid){em.innerHTML="<h4 style=\"color:var(--gold);\">\u79D1\u6280\u6811</h4><button class=\"bt bp\" onclick=\"P.techTree.push({sid:editingScenarioId,name:'\u65B0\u79D1\u6280',desc:'',prereqs:[],costs:[],effect:{},era:'\u521D\u7EA7',unlocked:false});renderEdTab('t-tech');\">\uFF0B</button>"+P.techTree.filter(function(t){return t.sid===sid;}).map(function(t){var i=P.techTree.indexOf(t);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+t.name+"</strong> <span class=\"tg\">"+t.era+"</span><button class=\"bd bsm\" onclick=\"P.techTree.splice("+i+",1);renderEdTab('t-tech');\">\u2715</button></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+t.desc+"</div></div>";}).join("");}
// renderCivicTab 已在后面（约22304行）定义增强版本，此处不再重复
function editCivic(i){
  var c=P.civicTree[i];
  openGenericModal('编辑市政',
    '<div class="form-group"><label>名称</label><input id="gmf-name" value="'+escHtml(c.name||'')+'"></div>'+
    '<div class="form-group"><label>描述</label><textarea id="gmf-desc" rows="2">'+(c.desc||'')+'</textarea></div>'+
    '<div class="form-group"><label>时代</label><input id="gmf-era" value="'+escHtml(c.era||'')+'"></div>'+
    '<div class="form-group"><label>前置条件(逗号分隔)</label><input id="gmf-prereqs" value="'+escHtml((c.prereqs||[]).join(','))+'"></div>'+
    '<div class="form-group"><label>效果(JSON)</label><input id="gmf-effect" value="'+escHtml(JSON.stringify(c.effect||{}))+'"></div>',
    function(){
      var cv=P.civicTree[i];
      if(!cv)return;
      cv.name=gv('gmf-name');
      cv.desc=gv('gmf-desc');
      cv.era=gv('gmf-era');
      cv.prereqs=gv('gmf-prereqs').split(',').map(function(s){return s.trim();}).filter(Boolean);
      try{cv.effect=JSON.parse(gv('gmf-effect'));}catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
      renderEdTab('t-civic');
    }
  );
}
async function aiGenCivic(){
  showLoading('生成市政中...',20);
  try{
    var ctx=findScenarioById(editingScenarioId);
    var era=ctx?ctx.era:"";var scnName=ctx?ctx.name:"";
    var existCiv=(P.civicTree&&P.civicTree.policies?P.civicTree.policies:[]).filter(function(x){return !x.sid||x.sid===editingScenarioId;}).map(function(x){return x.name;});var existNoteC=existCiv.length?"已有政策（不得重复）："+existCiv.join("、")+"\n":"";var c=await callAISmart('你是中国历史专家。请为剧本《'+scnName+'》('+era+')生成3-5个市政正策或制度，必须是该时期历史上实际存在的。'+existNoteC+'返回JSON:[{"name":"","desc":"","era":"","prereqs":[],"effect":{},"costs":[]}]',2000,{minLength:100,maxRetries:3,validator:function(content){try{var jm=content.match(/\[[\s\S]*\]/);if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
    var jm=c.match(/\[[\s\S]*\]/);
    if(jm){JSON.parse(jm[0]).forEach(function(v){
      P.civicTree.push({sid:editingScenarioId,name:v.name||'',desc:v.desc||'',era:v.era||era,prereqs:v.prereqs||[],costs:v.costs||[],effect:v.effect||{},adopted:false});
    });renderEdTab('t-civic');toast('市政已生成');}
  }catch(e){toast('失败: '+e.message);}
  finally{hideLoading();}
}

function renderTimTab(em){var t=P.time;var eraList=(t.eraNames||[]);var eraRows=eraList.map(function(e,i){return "<div style=\"display:flex;gap:6px;align-items:center;margin-bottom:3px;\">"+"<input id=\"t-era-n-"+i+"\" value=\""+e.name+"\" placeholder=\"\u5E74\u53F7\u540D\" style=\"width:80px\">"+"<input type=\"number\" id=\"t-era-y-"+i+"\" value=\""+e.startYear+"\" placeholder=\"\u5E74\" style=\"width:60px\">"+"<input type=\"number\" id=\"t-era-m-"+i+"\" value=\""+e.startMonth+"\" placeholder=\"\u6708\" style=\"width:44px\">"+"<button class=\"bd bsm\" onclick=\"_eraUpd("+i+")\">\u4FDD</button>"+"<button class=\"bd bsm\" onclick=\"_eraDel("+i+")\">\u5220</button>"+"</div>";}).join("");em.innerHTML="<h4 style=\"color:var(--gold);\">\u65F6\u95F4</h4>"+"<div class=\"rw\">"+"<div class=\"fd\"><label>\u8D77\u59CB\u5E74</label>"+"<input type=\"number\" id=\"t-year\" value=\""+t.year+"\" onchange=\"saveT()\"></div>"+"<div class=\"fd\"><label>\u524D\u7F00</label>"+"<input id=\"t-prefix\" value=\""+( t.prefix||"")+"\" onchange=\"saveT()\"></div>"+"<div class=\"fd\"><label>\u540E\u7F00</label>"+"<input id=\"t-suffix\" value=\""+( t.suffix||"")+"\" onchange=\"saveT()\"></div>"+"</div>"+"<div class=\"rw\">"+"<div class=\"fd\"><label>\u6BCF\u56DE\u5408</label>"+"<select id=\"t-per-turn\" onchange=\"saveT()\">"+"<option value=\"1s\" "+(t.perTurn==="1s"?"selected":"")+">\u5B63</option>"+"<option value=\"1m\" "+(t.perTurn==="1m"?"selected":"")+">\u6708</option>"+"<option value=\"1y\" "+(t.perTurn==="1y"?"selected":"")+">\u5E74</option>"+"</select></div>"+"<div class=\"fd\"><label>\u5B63\u8282(\u9017\u53F7)</label>"+"<input id=\"t-seasons\" value=\""+( t.seasons||[]).join(",")+"\" onchange=\"saveT()\"></div>"+"<div class=\"fd\"><label>\u8D77\u59CB\u5B63\u8282</label>"+"<input type=\"number\" id=\"t-start-s\" value=\""+( t.startS||0)+"\" onchange=\"saveT()\"></div>"+"</div>"+"<div class=\"rw\">"+"<div class=\"fd\"><label>\u5E74\u53F7</label>"+"<input id=\"t-reign\" value=\""+( t.reign||"")+"\" onchange=\"saveT()\"></div>"+"<div class=\"fd\"><label>\u5E74\u53F7\u8D77\u59CB</label>"+"<input type=\"number\" id=\"t-reign-y\" value=\""+( t.reignY||1)+"\" onchange=\"saveT()\"></div>"+"<div class=\"fd\"><label>\u663E\u793A</label>"+"<select id=\"t-display\" onchange=\"saveT()\">"+"<option value=\"year_season\" "+(t.display==="year_season"?"selected":"")+">\u5E74+\u5B63</option>"+"<option value=\"reign\" "+(t.display==="reign"?"selected":"")+">\u5E74\u53F7</option>"+"</select></div>"+"</div>"+"<hr style=\"border-color:var(--bg-4);margin:8px 0;\">"+"<div class=\"rw\">"+"<div class=\"fd\"><label>\u8D77\u59CB\u6708</label>"+"<input type=\"number\" id=\"t-start-month\" min=\"1\" max=\"12\" value=\""+( t.startMonth||1)+"\" onchange=\"saveT()\"></div>"+"<div class=\"fd\"><label>\u8D77\u59CB\u65E5</label>"+"<input type=\"number\" id=\"t-start-day\" min=\"1\" max=\"30\" value=\""+( t.startDay||1)+"\" onchange=\"saveT()\"></div>"+"</div>"+"<div class=\"rw\">"+"<div class=\"fd\"><label>"+"<input type=\"checkbox\" id=\"t-enable-ganzhi\" "+(t.enableGanzhi?"checked":"")+" onchange=\"saveT()\">"+" \u5E72\u652F\u5E74\u4EFD</label></div>"+"<div class=\"fd\"><label>"+"<input type=\"checkbox\" id=\"t-enable-ganzhi-day\" "+(t.enableGanzhiDay?"checked":"")+" onchange=\"saveT()\">"+" \u5E72\u652F\u65E5\u671F</label></div>"+"<div class=\"fd\"><label>"+"<input type=\"checkbox\" id=\"t-enable-era-name\" "+(t.enableEraName?"checked":"")+" onchange=\"saveT()\">"+" \u6539\u5143\u5E74\u53F7</label></div>"+"</div>"+"<div style=\"margin-top:8px;\">"+"<strong style=\"color:var(--gold-dim);\">\u5E74\u53F7\u5217\u8868</strong>"+" <button class=\"bt bsm\" onclick=\"_eraAdd()\">+\u6DFB\u52A0</button>"+"<div id=\"t-era-list\" style=\"margin-top:6px;\">"+eraRows+"</div></div>";window._eraAdd=function(){if(!P.time.eraNames)P.time.eraNames=[];P.time.eraNames.push({name:"",startYear:P.time.year,startMonth:1,startDay:1});renderTimTab(document.getElementById("t-era-list").closest(".tab-panel")||document.getElementById("t-era-list").parentNode.parentNode);};window._eraDel=function(i){if(!P.time.eraNames)return;P.time.eraNames.splice(i,1);renderTimTab(document.getElementById("t-era-list").closest(".tab-panel")||document.getElementById("t-era-list").parentNode.parentNode);};window._eraUpd=function(i){var e=P.time.eraNames[i];if(!e)return;var n=document.getElementById("t-era-n-"+i);if(n)e.name=n.value;var y=document.getElementById("t-era-y-"+i);if(y)e.startYear=+y.value||P.time.year;var m=document.getElementById("t-era-m-"+i);if(m)e.startMonth=+m.value||1;saveT();};}
function renderMapTab(em){em.innerHTML="<h4 style=\"color:var(--gold);\">\u5730\u56FE</h4><div style=\"color:var(--txt-d);\">\u5730\u56FE\u7F16\u8F91\u5668\uFF08\u5F85\u91CD\u6784\u4E2D\uFF09</div>";}
function renderWldTab(em,sid){em.innerHTML="<h4 style=\"color:var(--gold);\">\u4E16\u754C\u8BBE\u5B9A</h4><div class=\"cd\"><h4>\u5386\u53F2</h4><textarea rows=\"4\" onchange=\"P.world.history=this.value\">"+(P.world.history||"")+"</textarea></div><div class=\"cd\"><h4>\u653F\u6CBB</h4><textarea rows=\"3\" onchange=\"P.world.politics=this.value\">"+(P.world.politics||"")+"</textarea></div><div class=\"cd\"><h4>\u7ECF\u6D4E</h4><textarea rows=\"3\" onchange=\"P.world.economy=this.value\">"+(P.world.economy||"")+"</textarea></div><div class=\"cd\"><h4>\u519B\u4E8B</h4><textarea rows=\"3\" onchange=\"P.world.military=this.value\">"+(P.world.military||"")+"</textarea></div><div class=\"cd\"><h4>\u6587\u5316</h4><textarea rows=\"3\" onchange=\"P.world.culture=this.value\">"+(P.world.culture||"")+"</textarea></div>";}
// renderOfficeTab 已在后面（约22464行）定义SVG树形版本，此处不再重复
async function aiGenOfficeEd(){var dynasty=prompt("\u671D\u4EE3:");if(!dynasty)return;try{showLoading("\u751F\u6210\u5B98\u5236\u4E2D...",20);var _off=P.officialSystem||{};var existOff=[].concat(_off.departments||[]).map(function(x){return x.name;});var existNoteOE=existOff.length?"已有部门（不得重复）："+existOff.join("、")+"\n":"";var c=await callAISmart("\u751F\u6210"+dynasty+"\u5B98\u5236\u3002"+existNoteOE+"\u8FD4\u56DEJSON:[{\"name\":\"\u90E8\u95E8\",\"positions\":[{\"name\":\"\u5B98\u804C\",\"holder\":\"\",\"desc\":\"\",\"rank\":\"\"}],\"subs\":[]}]\n5-8\u90E8\u95E8",3000,{minLength:300,maxRetries:3,validator:function(c){try{var cleaned3=c.replace(/```json|```/g,'').trim();var jm=cleaned3.match(/\[[\s\S]*?\](?=\s*$)/);if(!jm){jm=cleaned3.match(/\[[\s\S]*\]/);}if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=5;}catch(e){return false;}}});var cleaned3=c.replace(/```json|```/g,'').trim();var jm=cleaned3.match(/\[[\s\S]*?\](?=\s*$)/);if(!jm){jm=cleaned3.match(/\[[\s\S]*\]/);}if(jm){try{P.officeTree=JSON.parse(jm[0]);}catch(pe3){var fs3=jm[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}');P.officeTree=JSON.parse(fs3);}renderEdTab("t-office");hideLoading();toast("\u2705");}}catch(e){hideLoading();toast("\u5931\u8D25");}}

// ============================================================
//  AI整体生成剧本
// ============================================================
function aiGenFullScenario(){
  var panel=_$("ai-full-gen-panel");if(!panel)return;
  if(panel.style.display==="block"){panel.style.display="none";return;}
  panel.style.display="block";
  panel.innerHTML='<div class="cd"><h4 style="color:var(--gold);">\uD83E\uDD16 AI\u751F\u6210\u5386\u53F2\u5267\u672C</h4>'+
    '<div class="rw"><div class="fd full"><label>\u671D\u4EE3 / \u7687\u5E1D <span style="color:var(--txt-d);font-size:0.8rem;">\uff08\u5FC5\u586B\uff09</span></label>'+
    '<input id="fg-dynasty" placeholder="\u5982\uff1A\u660E\u671D\u5D07\u797A\u7687\u5E1D / \u5510\u671D\u674E\u4E16\u6C11" style="width:100%;"></div></div>'+
    '<div class="rw"><div class="fd full"><label>\u8865\u5145\u63CF\u8FF0 <span style="color:var(--txt-d);font-size:0.8rem;">\uff08\u53EF\u9009\uff0C\u6307\u5B9A\u80CC\u666F\u3001\u4E8B\u4EF6\uff09</span></label>'+
    '<textarea id="fg-desc" rows="2" placeholder="\u5982\uff1A\u5D07\u797A\u5341\u4E03\u5E74\uff0C\u674E\u81EA\u6210\u5175\u4E34\u57CE\u4E0B\uff0C\u671D\u5C40\u52A8\u8361\u2026"></textarea></div></div>'+
    '<div class="rw"><div class="fd"><label>\u751F\u6210\u8BE6\u7EC6\u7A0B\u5EA6</label>'+
    '<select id="fg-words"><option value="brief">\u7B80\u7565\uff08\u5FEB\u901F\uff09</option><option value="normal" selected>\u6807\u51C6\uff08\u63A8\u8350\uff09</option><option value="detailed">\u8BE6\u7EC6\uff08\u5185\u5BB9\u4E30\u5BCC\uff09</option><option value="full">\u5B8C\u6574\uff08\u6700\u8BE6\u5C3D\uff09</option></select></div></div>'+
    '<button class="bai" onclick="execFullGen()" style="margin-top:0.8rem;width:100%;">\uD83D\uDE80 \u5F00\u59CB\u751F\u6210\u5386\u53F2\u5267\u672C</button>'+
    '<div id="fg-status" style="font-size:0.82rem;color:var(--txt-d);margin-top:0.3rem;"></div></div>';
}
var _fgAbortCtrl=null;
function _fgShowProgress(step,total,stepName,done){
  var ov=_$("fg-progress-overlay");
  if(!ov){
    ov=document.createElement("div");
    ov.id="fg-progress-overlay";
    ov.style.cssText="position:fixed;inset:0;background:rgba(10,8,4,0.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;";
    document.body.appendChild(ov);
  }
  var pct=Math.round((step/total)*100);
  var stepsHtml=(done||[]).map(function(s){return "<div style='color:var(--green);margin:4px 0;'>\u2705 "+s+"</div>";}).join("");
  if(stepName)stepsHtml+="<div style='color:var(--gold);margin:4px 0;'>\u23F3 "+stepName+"\u2026</div>";
  ov.innerHTML="<div style='text-align:center;max-width:480px;width:90%;'>"+
    "<div style='font-size:1.6rem;font-weight:bold;color:var(--gold);margin-bottom:1rem;'>\uD83D\uDCDC \u751F\u6210\u5386\u53F2\u5267\u672C\u4E2D</div>"+
    "<div style='background:var(--bg2);border-radius:8px;height:18px;overflow:hidden;margin-bottom:1rem;'>"+
    "<div style='height:100%;width:"+pct+"%;background:linear-gradient(90deg,var(--gold),#e8b86d);transition:width 0.4s;border-radius:8px;'></div></div>"+
    "<div style='color:var(--txt-d);margin-bottom:1.2rem;font-size:0.9rem;'>"+pct+"% \u5B8C\u6210</div>"+
    "<div style='text-align:left;font-size:0.92rem;line-height:1.8;'>"+stepsHtml+"</div>"+
    "<button onclick=\"_fgCancelGen()\" style='margin-top:1.5rem;padding:0.4rem 1.2rem;background:transparent;border:1px solid var(--red,#c44);color:var(--red,#c44);border-radius:6px;cursor:pointer;font-size:0.85rem;'>\u53D6\u6D88\u751F\u6210</button>"+
    "</div>";
}
function _fgHideProgress(){
  var ov=_$("fg-progress-overlay");if(ov)ov.remove();
}
function _fgCancelGen(){
  if(_fgAbortCtrl){_fgAbortCtrl.abort();_fgAbortCtrl=null;}
  _fgHideProgress();
  toast("已取消生成");
}
async function execFullGen(){
  var dynasty=_$("fg-dynasty")?_$("fg-dynasty").value.trim():"";
  if(!dynasty){toast("\u8bf7\u5148\u8f93\u5165\u671d\u4ee3/\u7687\u5e1d");return;}
  var desc=_$("fg-desc")?_$("fg-desc").value.trim():"";
  var level=_$("fg-words")?_$("fg-words").value:"normal";
  var bgLen={brief:"150\u5b57",normal:"300\u5b57",detailed:"500\u5b57",full:"800\u5b57"}[level]||"300\u5b57";
  var openLen={brief:"300\u5b57",normal:"600\u5b57",detailed:"1000\u5b57",full:"1500\u5b57"}[level]||"600\u5b57";
  var chrCount={brief:5,normal:8,detailed:12,full:16}[level]||8;
  var varCount={brief:4,normal:6,detailed:8,full:10}[level]||6;
  var relCount={brief:3,normal:5,detailed:8,full:10}[level]||5;
  var deptCount={brief:4,normal:6,detailed:8,full:10}[level]||6;
  var techCount={brief:4,normal:6,detailed:10,full:14}[level]||6;
  var civicCount={brief:3,normal:5,detailed:8,full:12}[level]||5;
  var milCount={brief:3,normal:4,detailed:6,full:8}[level]||4;
  var facCount={brief:3,normal:4,detailed:6,full:8}[level]||4;
  var evtCount={brief:4,normal:6,detailed:10,full:14}[level]||6;
  var itemCount={brief:4,normal:6,detailed:10,full:14}[level]||6;
  var TOTAL=12;
  var context=dynasty+(desc?","+desc:"");
  var histNote="\u3010\u8981\u6c42\u3011\u4e25\u683c\u6309\u7167\u4e2d\u56fd\u6b63\u53f2\u8fd8\u539f\uff0c\u4eba\u7269\u5fc5\u987b\u662f\u771f\u5b9e\u5386\u53f2\u4eba\u7269\uff0c\u4e8b\u4ef6\u5fc5\u987b\u5c5e\u4e8e\u8be5\u671d\u4ee3\u8be5\u7687\u5e1d\u65f6\u671f\uff0c\u4e0d\u5f97\u865a\u6784\u3002";
  var done=[];
  var st=_$("fg-status");if(st)st.textContent="\u751f\u6210\u4e2d...";
  _fgAbortCtrl=new AbortController();
  _fgShowProgress(0,TOTAL,"\u51c6\u5907\u4e2d",done);
  var sid=uid();
  var scn={id:sid,era:"",name:"",role:"",background:"",tags:[],opening:"",suggestions:[],active:true,winCond:"",loseCond:"",customPrompt:"",masterScript:"",refFiles:[]};
  try{
    // Step 1
    _fgShowProgress(1,TOTAL,"\u751f\u6210\u5267\u672c\u57fa\u7840\u8bbe\u5b9a",done);
    var prompt1="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u5c0f\u8bf4\u5bb6\u548c\u6e38\u620f\u5267\u672c\u8bbe\u8ba1\u5e08\u3002"+histNote+
      "\u8bf7\u4e3a\u300a"+context+"\u300b\u521b\u4f5c\u4e00\u4e2a\u5386\u53f2\u7b56\u7565\u6e38\u620f\u5267\u672c\u57fa\u7840\u8bbe\u5b9a\u3002"+
      "\u8981\u6c42:\n1. era\u5fc5\u987b\u662f\u771f\u5b9e\u5386\u53f2\u5e74\u4ee3\u3002\n2. background\u8be6\u7ec6\u63cf\u5199\u653f\u6cbb\u683c\u5c40\u3001\u7ecf\u6d4e\u72b6\u51b5\u3001\u793e\u4f1a\u77db\u76fe\uff0c\u7ea6"+bgLen+"\u3002\n3. opening\u5f00\u573a\u767d\u5c55\u793a\u5c40\u52bf\u7d27\u8feb\u611f\uff0c\u7ea6"+openLen+"\u3002"+
      "\n4. role\u662f\u73a9\u5bb6\u626e\u6f14\u7684\u771f\u5b9e\u5386\u53f2\u4eba\u7269\u3002\n5. name\u662f\u5267\u672c\u6807\u9898\u3002\n6. suggestions\u662f3\u4e2a\u5267\u60c5\u5efa\u8bae\u6570\u7ec4\u3002"+
      "\n\u8fd4\u56de\u7eefJSON\uff1a{\"era\":\"...\",\"name\":\"...\",\"role\":\"...\",\"background\":\"...\",\"opening\":\"...\",\"suggestions\":[\"...\",\"...\",\"...\"]}";
    var r1=await callAISmart(prompt1,2000,{signal:_fgAbortCtrl.signal,minLength:300,maxRetries:3});
    var ctxScn="";
    try{
      var j1=JSON.parse(r1.replace(/```json|```/g,"").trim());
      scn.era=j1.era||dynasty;scn.name=j1.name||(dynasty+"\u5267\u672c");scn.role=j1.role||"";scn.background=j1.background||"";scn.opening=j1.opening||"";scn.suggestions=j1.suggestions||[];
      ctxScn="\u5267\u672C\u300A"+scn.name+"\u300B\uFF0C\u65F6\u4EE3\uFF1A"+scn.era+"\uFF0C\u73A9\u5BB6\u89D2\u8272\uFF1A"+scn.role+"\u3002\u80CC\u666F\uFF1A"+scn.background;
    }catch(e){scn.era=dynasty;scn.name=dynasty+"\u5267\u672c";ctxScn="\u671d\u4ee3\uff1a"+dynasty;}
    done.push("\u5267\u672c\u57fa\u7840\u8bbe\u5b9a");

    // Step 2
    _fgShowProgress(2,TOTAL,"\u751f\u6210\u5386\u53f2\u4eba\u7269",done);
    var prompt2="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002"+histNote+
      "\u80cc\u666f\uff1a"+ctxScn+
      "\n\u8bf7\u751f\u6210"+chrCount+"\u4e2a\u771f\u5b9e\u5386\u53f2\u4eba\u7269\u3002\u6bcf\u4e2a\u5305\u542b: name(\u771f\u5b9e\u59d3\u540d), role(\u5b98\u804c), faction(\u9635\u8425), personality(\u6027\u683c\u63cf\u8ff0), loyalty(0-100), ambition(0-100), benevolence(0-100), intelligence(0-100), valor(0-100), morale(0-100)\u3002"+
      "\n\u8fd4\u56de\u7eefJSON\u6570\u7ec4: [{\"name\":\"...\",\"role\":\"...\",\"faction\":\"...\",\"personality\":\"...\",\"loyalty\":70,\"ambition\":60,\"benevolence\":50,\"intelligence\":80,\"valor\":65,\"morale\":75},...]";
    var r2=await callAISmart(prompt2,3000,{signal:_fgAbortCtrl.signal,minLength:500,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return Array.isArray(j)&&j.length>=Math.min(chrCount,3);}catch(e){return false;}}});
    var chrs=[];var ctxChrs="";
    try{
      var j2=JSON.parse(r2.replace(/```json|```/g,"").trim());
      if(Array.isArray(j2))chrs=j2;
    }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
    chrs.forEach(function(c){
      P.characters.push({id:uid(),sid:sid,name:c.name||"",role:c.role||"",faction:c.faction||"",personality:c.personality||"",loyalty:c.loyalty!=null?c.loyalty:50,ambition:c.ambition!=null?c.ambition:50,benevolence:c.benevolence!=null?c.benevolence:50,intelligence:c.intelligence!=null?c.intelligence:50,valor:c.valor!=null?c.valor:50,morale:c.morale!=null?c.morale:75,stats:{},isPlayer:false});
      // 自动从 personality 文本匹配 traitIds
      var lastChar = P.characters[P.characters.length - 1];
      if (typeof autoAssignTraitIds === 'function') autoAssignTraitIds(lastChar);
    });
    if(chrs.length)ctxChrs="\u4E3B\u8981\u4EBA\u7269\uFF1A"+chrs.map(function(c){return c.name+"("+c.role+")";}).join("\u3001");
    done.push("\u5386\u53f2\u4eba\u7269("+chrs.length+")");

    // Step 3
    _fgShowProgress(3,TOTAL,"\u751f\u6210\u53d8\u91cf\u4e0e\u5173\u7cfb",done);
    var prompt3="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210"+varCount+"\u4e2a\u5386\u53f2\u5168\u5c40\u53d8\u91cf\u548c"+relCount+"\u4e2a\u4eba\u7269\u5173\u7cfb\u3002\u5168\u5c40\u53d8\u91cf\u5e94\u53cd\u6620\u8be5\u65f6\u671f\u771f\u5b9e\u653f\u6cbb\u3001\u519b\u4e8b\u3001\u7ecf\u6d4e\u3001\u6c11\u5fc3\u72b6\u51b5\u3002\u4eba\u7269\u5173\u7cfb\u5e94\u57fa\u4e8e\u771f\u5b9e\u5386\u53f2\u3002"+
      "\n\u8fd4\u56deJSON: {\"variables\":[{\"name\":\"...\",\"value\":50,\"min\":0,\"max\":100,\"desc\":\"...\"},...],\"relations\":[{\"from\":\"...\",\"to\":\"...\",\"type\":\"...\",\"value\":50},...]}";
    var r3=await callAISmart(prompt3,2000,{signal:_fgAbortCtrl.signal,minLength:300,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return j.variables&&Array.isArray(j.variables)&&j.variables.length>=Math.min(varCount,3);}catch(e){return false;}}});
    try{
      var j3=JSON.parse(r3.replace(/```json|```/g,"").trim());
      if(j3.variables&&Array.isArray(j3.variables))j3.variables.forEach(function(v){P.variables.push({id:uid(),sid:sid,name:v.name||"",value:v.value!=null?v.value:50,min:v.min!=null?v.min:0,max:v.max!=null?v.max:100,desc:v.desc||""});});
      if(j3.relations&&Array.isArray(j3.relations))j3.relations.forEach(function(r){P.relations.push({id:uid(),sid:sid,from:r.from||"",to:r.to||"",type:r.type||"",value:r.value!=null?r.value:50});});
    }catch(e){console.warn('Step 3 (variables/relations) parse failed:',e);}
    done.push("\u53d8\u91cf\u4e0e\u5173\u7cfb");

    // Step 4
    _fgShowProgress(4,TOTAL,"\u751f\u6210\u5b98\u5236\u6811",done);
    var prompt4="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u5b98\u5236\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210"+deptCount+"\u4e2a\u5c5e\u4e8e\u8be5\u671d\u4ee3\u7684\u771f\u5b9e\u5c0f\u673a\u6784\u5b98\u5236\u90e8\u95e8\u3002\u5c3d\u91cf\u8fd8\u539f\u5386\u53f2\u771f\u5b9e\u5b98\u79f0\u3002"+
      "\n\u8fd4\u56deJSON\u6570\u7ec4: [{\"name\":\"...\",\"desc\":\"...\",\"headRole\":\"...\",\"slots\":3},...] \u5171"+deptCount+"\u4e2a\u3002";
    var r4=await callAISmart(prompt4,1500,{signal:_fgAbortCtrl.signal,minLength:300,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return Array.isArray(j)&&j.length>=Math.min(facCount,3);}catch(e){return false;}}});
    try{
      var j4=JSON.parse(r4.replace(/```json|```/g,"").trim());
      if(Array.isArray(j4))j4.forEach(function(d){P.officeTree.push({id:uid(),sid:sid,name:d.name||"",desc:d.desc||"",headRole:d.headRole||"",slots:d.slots||3,members:[]});});
    }catch(e){console.warn('Step 4 (officeTree) parse failed:',e);}
    done.push("\u5b98\u5236\u6811");

    // Step 5
    _fgShowProgress(5,TOTAL,"\u751f\u6210\u79d1\u6280\u6811",done);
    var prompt5="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u79d1\u6280\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210"+techCount+"\u4e2a\u5c5e\u4e8e\u8be5\u671d\u4ee3\u7684\u5386\u53f2\u79d1\u6280/\u53d1\u660e/\u5de5\u827a\u8282\u70b9\uff0c\u4f53\u73b0\u8be5\u65f6\u671f\u771f\u5b9e\u6280\u672f\u6c34\u5e73\u3002"+
      "\n\u8fd4\u56deJSON\u6570\u7ec4: [{\"name\":\"...\",\"desc\":\"...\",\"effect\":\"...\",\"era\":\"...\",\"prereqs\":[],\"costs\":{}},...] \u5171"+techCount+"\u4e2a\u3002";
    var r5=await callAISmart(prompt5,1500,{signal:_fgAbortCtrl.signal,minLength:200,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return Array.isArray(j)&&j.length>=Math.min(evtCount,2);}catch(e){return false;}}});
    try{
      var j5=JSON.parse(r5.replace(/```json|```/g,"").trim());
      if(Array.isArray(j5))j5.forEach(function(t){P.techTree.push({id:uid(),sid:sid,name:t.name||"",desc:t.desc||"",effect:t.effect||"",era:t.era||scn.era,prereqs:t.prereqs||[],costs:t.costs||{},unlocked:false});});
    }catch(e){console.warn('Step 5 (techTree) parse failed:',e);}
    done.push("\u79d1\u6280\u6811");

    // Step 6
    _fgShowProgress(6,TOTAL,"\u751f\u6210\u5e02\u653f\u6811",done);
    var prompt6="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u653f\u6cbb\u5236\u5ea6\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210"+civicCount+"\u4e2a\u5c5e\u4e8e\u8be5\u671d\u4ee3\u7684\u5386\u53f2\u653f\u7b56/\u5236\u5ea6/\u6cbb\u56fd\u7406\u5ff5\u8282\u70b9\uff0c\u4f53\u73b0\u8be5\u65f6\u671f\u771f\u5b9e\u6cbb\u56fd\u65b9\u7565\u3002"+
      "\n\u8fd4\u56deJSON\u6570\u7ec4: [{\"name\":\"...\",\"desc\":\"...\",\"effect\":\"...\",\"era\":\"...\",\"prereqs\":[],\"costs\":{}},...] \u5171"+civicCount+"\u4e2a\u3002";
    var r6=await callAISmart(prompt6,1500,{signal:_fgAbortCtrl.signal,minLength:200,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return Array.isArray(j)&&j.length>=Math.min(itemCount,2);}catch(e){return false;}}});
    try{
      var j6=JSON.parse(r6.replace(/```json|```/g,"").trim());
      if(Array.isArray(j6))j6.forEach(function(c){P.civicTree.push({id:uid(),sid:sid,name:c.name||"",desc:c.desc||"",effect:c.effect||"",era:c.era||scn.era,prereqs:c.prereqs||[],costs:c.costs||{},adopted:false});});
    }catch(e){console.warn('Step 6 (civicTree) parse failed:',e);}
    done.push("\u5e02\u653f\u6811");

    // Step 7
    _fgShowProgress(7,TOTAL,"\u751f\u6210\u519b\u4e8b\u4f53\u7cfb",done);
    if(!P.military)P.military={troops:[],facilities:[],organization:[],campaigns:[],armies:[],systemDesc:"",supplyDesc:"",battleDesc:""};
    var prompt7="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u519b\u4e8b\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210\u8be5\u671d\u4ee3\u519b\u4e8b\u4f53\u7cfb\uff0c\u5305\u542b4\u4e2a\u5b50\u7c7b\u5404"+milCount+"\u4e2a\u6761\u76ee\uff1a\n"+
      "troops(\u5175\u79cd/\u519b\u961f\u7c7b\u578b), facilities(\u519b\u4e8b\u8bbe\u65bd), organization(\u519b\u4e8b\u7f16\u5236/\u5236\u5ea6), campaigns(\u91cd\u8981\u6218\u5f79/\u519b\u4e8b\u884c\u52a8)\u3002"+
      "\n\u8fd4\u56deJSON: {\"troops\":[{\"name\":\"...\",\"type\":\"...\",\"description\":\"...\"},...],\"facilities\":[...],\"organization\":[...],\"campaigns\":[...]}";
    var r7=await callAISmart(prompt7,2000,{signal:_fgAbortCtrl.signal,minLength:300,maxRetries:3});
    try{
      var j7=JSON.parse(r7.replace(/```json|```/g,"").trim());
      ["troops","facilities","organization","campaigns"].forEach(function(k){
        if(j7[k]&&Array.isArray(j7[k]))j7[k].forEach(function(m){
          P.military[k].push({id:uid(),sid:sid,name:m.name||"",type:m.type||k,description:m.description||""});
        });
      });
    }catch(e){console.warn('Step 7 (military) parse failed:',e);}
    done.push("\u519b\u4e8b\u4f53\u7cfb");

    // Step 8
    _fgShowProgress(8,TOTAL,"\u751f\u6210\u52bf\u529b\u6d3e\u7cfb",done);
    var prompt8="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210"+facCount+"\u4e2a\u8be5\u65f6\u671f\u771f\u5b9e\u5b58\u5728\u7684\u653f\u6cbb\u6d3e\u7cfb/\u52bf\u529b\u96c6\u56e2\u3002"+
      "\n\u8fd4\u56deJSON\u6570\u7ec4: [{\"name\":\"...\",\"leader\":\"...\",\"desc\":\"...\",\"ideology\":\"...\",\"strength\":60,\"courtInfluence\":50,\"popularInfluence\":40},...] \u5171"+facCount+"\u4e2a\u3002";
    var r8=await callAISmart(prompt8,1500,{signal:_fgAbortCtrl.signal,minLength:200,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return Array.isArray(j)&&j.length>=2;}catch(e){return false;}}});
    try{
      var j8=JSON.parse(r8.replace(/```json|```/g,"").trim());
      if(Array.isArray(j8))j8.forEach(function(fc){
        P.factions.push({id:uid(),sid:sid,name:fc.name||"",leader:fc.leader||"",desc:fc.desc||"",color:"#888",traits:[],strength:fc.strength||50,territory:"",ideology:fc.ideology||"",courtInfluence:fc.courtInfluence||50,popularInfluence:fc.popularInfluence||50});
      });
    }catch(e){console.warn('Step 8 (factions) parse failed:',e);}
    done.push("\u52bf\u529b\u6d3e\u7cfb");

    // Step 9
    _fgShowProgress(9,TOTAL,"\u751f\u6210\u5386\u53f2\u4e8b\u4ef6",done);
    var prompt9="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210"+evtCount+"\u4e2a\u8be5\u65f6\u671f\u771f\u5b9e\u5386\u53f2\u4e8b\u4ef6\uff0c\u53ef\u4f5c\u4e3a\u6e38\u620f\u89e6\u53d1\u5668\u3002\u6bcf\u4e2a\u4e8b\u4ef6\u5305\u542b: name, trigger(\u89e6\u53d1\u6761\u4ef6\u63cf\u8ff0), effect(\u5386\u53f2\u5f71\u54cd), era\u3002"+
      "\n\u8fd4\u56deJSON\u6570\u7ec4: [{\"name\":\"...\",\"trigger\":\"...\",\"effect\":\"...\",\"era\":\"...\"},...] \u5171"+evtCount+"\u4e2a\u3002";
    var r9=await callAISmart(prompt9,2000,{signal:_fgAbortCtrl.signal,minLength:300,maxRetries:3});
    try{
      var j9=JSON.parse(r9.replace(/```json|```/g,"").trim());
      if(Array.isArray(j9))j9.forEach(function(ev){
        P.events.push({id:uid(),sid:sid,name:ev.name||"",trigger:ev.trigger||"",effect:ev.effect||"",era:ev.era||scn.era,options:[],conditions:[],fired:false});
      });
    }catch(e){console.warn('Step 9 (events) parse failed:',e);}
    done.push("\u5386\u53f2\u4e8b\u4ef6");

    // Step 10
    _fgShowProgress(10,TOTAL,"\u751f\u6210\u5386\u53f2\u7269\u54c1",done);
    var prompt10="\u4f60\u662f\u4e2d\u56fd\u5386\u53f2\u6587\u7269\u4e13\u5bb6\u3002"+histNote+
      ctxScn+" "+ctxChrs+
      "\n\u8bf7\u751f\u6210"+itemCount+"\u4e2a\u8be5\u65f6\u671f\u6709\u5386\u53f2\u8bb0\u8f7d\u7684\u91cd\u8981\u5668\u7269/\u5b9d\u7269/\u5178\u7c4d/\u5175\u5668\u3002\u6bcf\u4e2a\u5305\u542b: name, type(\u7c7b\u578b), desc(\u5386\u53f2\u63cf\u8ff0), effect(\u6e38\u620f\u6548\u679c), rarity(common/rare/epic/legendary)\u3002"+
      "\n\u8fd4\u56deJSON\u6570\u7ec4: [{\"name\":\"...\",\"type\":\"...\",\"desc\":\"...\",\"effect\":\"...\",\"rarity\":\"rare\"},...] \u5171"+itemCount+"\u4e2a\u3002";
    var r10=await callAISmart(prompt10,1500,{signal:_fgAbortCtrl.signal,minLength:200,maxRetries:3,validator:function(c){try{var j=JSON.parse(c.replace(/```json|```/g,"").trim());return Array.isArray(j)&&j.length>=2;}catch(e){return false;}}});
    try{
      var j10=JSON.parse(r10.replace(/```json|```/g,"").trim());
      if(Array.isArray(j10))j10.forEach(function(it){
        if(!P.items)P.items=[];
        P.items.push({id:uid(),sid:sid,name:it.name||"",type:it.type||"",desc:it.desc||"",effect:it.effect||"",rarity:it.rarity||"common",owner:"",quantity:1});
      });
    }catch(e){console.warn('Step 10 (items) parse failed:',e);}
    done.push("\u5386\u53f2\u7269\u54c1");

    // ============ 第12步：交叉验证 + 自动修复 ============
    _fgShowProgress(11,TOTAL,'验证一致性',done);
    try {
      // 确保角色引用的势力存在
      var _vChars = (P.characters||[]).filter(function(c){return c.sid===sid;});
      var _vFacs = (P.factions||[]).filter(function(f){return f.sid===sid;});
      var facNameSet = {};
      _vFacs.forEach(function(f) { if (f.name) facNameSet[f.name] = true; });
      _vChars.forEach(function(c) {
        if (c.faction && !facNameSet[c.faction]) {
          // 自动修复：将角色的势力设为第一个存在的势力
          var firstFac = _vFacs[0];
          if (firstFac) {
            console.warn('[FullGen] 角色 ' + c.name + ' 的势力 "' + c.faction + '" 不存在，修正为 "' + firstFac.name + '"');
            c.faction = firstFac.name;
          }
        }
      });

      // 确保势力的 leader 在角色列表中
      var charNameSet = {};
      _vChars.forEach(function(c) { if (c.name) charNameSet[c.name] = true; });
      _vFacs.forEach(function(f) {
        if (f.leader && !charNameSet[f.leader]) {
          console.warn('[FullGen] 势力 ' + f.name + ' 的首领 "' + f.leader + '" 不在角色列表中');
          // 尝试找同势力的角色作为首领
          var sameFac = _vChars.find(function(c) { return c.faction === f.name; });
          if (sameFac) f.leader = sameFac.name;
        }
      });

      // 确保变量有min/max
      var allVars = (P.variables||[]).filter(function(v){return v.sid===sid;});
      if (Array.isArray(allVars)) {
        allVars.forEach(function(v) {
          if (v.min === undefined) v.min = 0;
          if (v.max === undefined) v.max = 100;
          if (v.value === undefined) v.value = v.defaultValue || Math.round((v.min + v.max) / 2);
          v.value = clamp(v.value, v.min, v.max);
        });
      }

      // 基本内容检查
      if (_vChars.length === 0 && _vFacs.length === 0) {
        toast('AI生成内容不足，请重试');
        _fgHideProgress();
        return;
      }

      _dbg('[FullGen] 交叉验证完成');
    } catch(e) { console.warn('[FullGen] 验证步骤异常:', e); }
    done.push("交叉验证");

    // 确保时间配置存在
    if (!scn.time) {
      // 尝试从剧本配置或AI生成的era推断年份
      var guessYear = 0;
      if (scn.startYear) {
        guessYear = scn.startYear;
      } else if (scn.era) {
        // 通用朝代年份参考表（仅作为AI未提供startYear时的兜底）
        var _eraRef = {
          '秦': -221, '汉': -206, '西汉': -206, '东汉': 25, '三国': 220,
          '魏': 220, '蜀': 221, '吴': 222, '晋': 265, '西晋': 265, '东晋': 317,
          '南北朝': 420, '隋': 581, '唐': 618, '五代': 907, '宋': 960,
          '北宋': 960, '南宋': 1127, '辽': 907, '金': 1115, '西夏': 1038,
          '元': 1271, '明': 1368, '清': 1644
        };
        for (var eraKey in _eraRef) {
          if (scn.era.indexOf(eraKey) >= 0) { guessYear = _eraRef[eraKey]; break; }
        }
      }
      scn.time = { year: guessYear || 1, perTurn: '1s', seasons: ['春','夏','秋','冬'], startS: 0, prefix: guessYear < 0 ? '公元前' : '', suffix: '年', startMonth: 1, startDay: 1 };
    }

    // Step 12: finalize
    _fgShowProgress(12,TOTAL,"\u4fdd\u5b58\u5267\u672c",done);
    P.scenarios.push(scn);
    saveP();
    done.push("\u5b8c\u6210");
    _fgShowProgress(12,TOTAL,"\u5168\u90e8\u5b8c\u6210",done);
    if(st)st.textContent="\u5df2\u5b8c\u6210";
    toast("\u5267\u672c\u300a"+scn.name+"\u300b\u5df2\u751f\u6210\uff01");
    _fgHideProgress();
    showScnManage();
  }catch(err){
    _fgHideProgress();
    if(err&&err.name==="AbortError"){if(st)st.textContent="\u5df2\u4e2d\u65ad";toast("\u5df2\u4e2d\u65ad");}
    else{if(st)st.textContent="\u51fa\u9519";toast("\u751f\u6210\u5931\u8d25:"+err);console.error(err);}
  }
}

// ============================================================
//  导入导出
