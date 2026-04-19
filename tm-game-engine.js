// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  启动界面
// Requires: tm-data-model.js (P, GM), tm-utils.js (all),
//           tm-index-world.js (findScenarioById, buildIndices, findCharByName),
//           tm-change-queue.js (makeEntitiesReactive),
//           tm-dynamic-systems.js (initAICache)
// ============================================================
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
  page.innerHTML="<button class=\"bt bs\" onclick=\"backToLaunch()\" style=\"position:fixed;top:1rem;left:1rem;z-index:1000;\">"+tmIcon('close',14)+" \u8FD4\u56DE</button>"+
    "<div class=\"scn-page-title\">\u9009 \u62E9 \u5267 \u672C</div>"+
    "<div class=\"scn-grid\">"+
    P.scenarios.map(function(s){
      return "<div class=\"scn-card\" onclick=\"previewScenario('"+escHtml(s.id)+"')\">"+
        "<div class=\"scn-era\">"+escHtml(s.era)+"</div>"+
        "<div class=\"scn-name\">"+escHtml(s.name)+"</div>"+
        "<div class=\"scn-role\">"+escHtml(s.role)+"</div>"+
        "<div class=\"scn-bg\">"+escHtml((s.background||'').substring(0,80))+(s.background&&s.background.length>80?'…':'')+"</div></div>";
    }).join("")+
    (P.scenarios.length===0?"<div style=\"color:var(--color-foreground-muted);text-align:center;padding:2rem;grid-column:1/-1;font-style:italic;\">\u6682\u65E0\u5267\u672C\uFF0C\u8BF7\u5148\u521B\u4F5C</div>":"")+
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
  page.innerHTML="<button class=\"bt bs\" onclick=\"backToLaunch()\" style=\"position:fixed;top:1rem;left:1rem;z-index:1000;\">"+tmIcon('close',14)+" \u8FD4\u56DE</button>"+
    "<div class=\"scn-page-title\">\u5267 \u672C \u7BA1 \u7406</div>"+
    "<div style=\"display:flex;gap:0.5rem;margin-top:var(--space-3);\">"+
    "<button class=\"bai\" onclick=\"aiGenFullScenario()\">"+tmIcon('event',14)+" AI\u751F\u6210\u6574\u4E2A\u5267\u672C</button></div>"+
    "<div id=\"ai-full-gen-panel\" style=\"display:none;max-width:600px;width:100%;margin-top:1rem;\"></div>"+
    "<div class=\"scn-grid\">"+
    "<div class=\"scn-card scn-card-new\" onclick=\"createNewScn()\">\uFF0B \u65B0\u5EFA</div>"+
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
// ============================================================
function importSaveFile(){
  if(window.tianming&&window.tianming.isDesktop){
    window.tianming.dialogImport().then(function(res){
      if(!res||res.canceled||!res.success)return;
      try{
        var data=res.data;
        if(data.gameState){P=data;GM=data.gameState;GM.running=true;if(GM._rngState)restoreRng(GM._rngState);if(GM._warTruces && typeof WarWeightSystem !== 'undefined') WarWeightSystem.deserialize(GM._warTruces);_$("launch").style.display="none";_$("bar").style.display="flex";_$("G").style.display="grid";enterGame();toast("\u2705 \u5DF2\u52A0\u8F7D");}
        else{P=data;loadT();toast("\u5DF2\u52A0\u8F7D\u9879\u76EE");showScnManage();}
      }catch(err){toast("\u5931\u8D25");}
    }).catch(function(){toast("\u5931\u8D25");});
    return;
  }
  var inp=document.createElement("input");inp.type="file";inp.accept=".json";
  inp.onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    var r=new FileReader();r.onload=function(ev){
      try{
        var data=JSON.parse(ev.target.result);
        if(data.gameState){P=data;GM=data.gameState;GM.running=true;if(GM._rngState)restoreRng(GM._rngState);if(GM._warTruces && typeof WarWeightSystem !== 'undefined') WarWeightSystem.deserialize(GM._warTruces);_$("launch").style.display="none";_$("bar").style.display="flex";_$("G").style.display="grid";enterGame();toast("\u2705 \u5DF2\u52A0\u8F7D");}
        else{P=data;loadT();toast("\u5DF2\u52A0\u8F7D\u9879\u76EE");showScnManage();}
      }catch(err){toast("\u5931\u8D25");}
    };r.readAsText(f);
  };inp.click();
}
function doSaveGame(){
  if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");return;}
  var saveData=deepClone(P);saveData.gameState=deepClone(GM);
  if(window.tianming&&window.tianming.isDesktop){
    // 使用统一的存档系统
    doSaveGameDesktop();
    return;
  }
  showPrompt("\u5B58\u6863\u540D:","T"+GM.turn,function(name){if(!name)return;
  var b=new Blob([JSON.stringify(saveData,null,2)],{type:"application/json"});
  var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name+".json";a.click();
  toast("\u2705 \u5DF2\u5BFC\u51FA");
  });
}


// 桌面版存档（使用统一的存档面板）
async function doSaveGameDesktop(){
  if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");return;}
  var files=[];
  try{
    var r=await window.tianming.listProjects();
    if(r.success&&r.files)files=r.files;
  }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
  var html='<div class="pnl">';
  html+='<div class="pnl-hd"><div><div class="pnl-t">\u4FDD\u5B58\u6E38\u620F</div>';
  html+='<div class="pnl-sub">\u5F53\u524D\u56DE\u5408: T'+GM.turn+'</div></div></div>';
  html+='<div class="fd full" style="margin-bottom:1.2rem">';
  html+='<label>\u5B58\u6863\u540D</label>';
  html+='<input id="save-name-inp" value="'+escHtml(GM.saveName||('T'+GM.turn))+'">';
  html+='</div>';
  html+='<button class="bt bp" style="margin-bottom:1.4rem" onclick="desktopDoSave()">\u2714 \u4FDD\u5B58</button>';
  if(files.length){
    html+='<div class="pnl-section">\u8986\u76D6\u73B0\u6709\u5B58\u6863</div>';
    html+='<div class="pnl-list" style="max-height:200px">';
    files.forEach(function(f){
      html+='<div class="pnl-row">';
      html+='<div class="pnl-row-info"><div class="pnl-row-name">'+f.name+'</div>';
      html+='<div class="pnl-row-meta">'+f.modifiedStr+'</div></div>';
      html+='<button class="bt bp bsm" onclick="_$(\\u0027save-name-inp\\u0027).value='+JSON.stringify(f.name).replace(/"/g,"&quot;")+';desktopDoSave()">覆盖</button>';
      html+='</div>';
    });
    html+='</div>';
  }
  html+='<div class="pnl-ft"><button class="bt bs" onclick="enterGame()">\u53D6\u6D88</button></div>';
  html+='</div>';
  showPanel(html);
  _$('G').style.display='none';
}

// ============================================================
//  设置弹窗
// ============================================================
function openSettings(){
  var bg=_$("settings-bg");
  bg.innerHTML="<div class=\"settings-box\"><div style=\"padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;\"><div style=\"font-size:1.1rem;font-weight:700;color:var(--gold);\">\u2699 \u8BBE\u7F6E</div><button class=\"bt bs bsm\" onclick=\"closeSettings()\">\u2715</button></div><div class=\"settings-body\" id=\"settings-body\"></div></div>";

  var _imgApiCfg = {}; try { _imgApiCfg = JSON.parse(localStorage.getItem('tm_api_image') || '{}'); } catch(e) {}
  _$("settings-body").innerHTML=
    "<div class=\"settings-section\"><h4>API</h4>"+
    "<div class=\"rw\"><div class=\"fd\"><label>Key</label><input type=\"password\" id=\"s-key\" value=\""+(P.ai.key||"")+"\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label>\u5730\u5740</label><input id=\"s-url\" value=\""+(P.ai.url||"")+"\" placeholder=\"https://api.openai.com/v1 \u6216\u4E2D\u8F6C\u7AD9URL\"></div><div class=\"fd\"><label>\u6A21\u578B</label><input id=\"s-model\" value=\""+(P.ai.model||"")+"\"></div></div>"+
    "<div style=\"font-size:0.75rem;color:var(--txt-d);margin:-0.3rem 0 0.5rem;\">\u652F\u6301\u4EFB\u610F OpenAI \u517C\u5BB9\u4E2D\u8F6C\u7AD9\uFF0C\u5730\u5740\u586B\u5199 base URL \u5373\u53EF\u3002</div>"+
    "<button class=\"bt bp bsm\" onclick=\"P.ai.key=_$('s-key').value;P.ai.url=_$('s-url').value;P.ai.model=_$('s-model').value;try{localStorage.setItem('tm_api',JSON.stringify(P.ai));}catch(e){}if(window.tianming&&window.tianming.isDesktop){window.tianming.autoSave(P).catch(function(){});}saveP();toast('\u2705 \u5DF2\u4FDD\u5B58')\">\u4FDD\u5B58</button>"+
    "<div style=\"margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--bdr);\"><div style=\"font-size:0.75rem;color:var(--gold-d);margin-bottom:0.3rem;\">\u667A\u80FD\u751F\u56FE API\uFF08\u72EC\u7ACB\u914D\u7F6E\uFF0C\u7528\u4E8E\u7ACB\u7ED8\u7B49\u56FE\u7247\u751F\u6210\uFF09</div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">Key</label><input type=\"password\" id=\"s-img-key\" value=\""+(_imgApiCfg.key||'')+"\" placeholder=\"\u7559\u7A7A\u5219\u590D\u7528\u4E3BAPI\" style=\"font-size:0.8rem;\"></div></div>"+
    "<div class=\"rw\"><div class=\"fd\"><label style=\"font-size:0.72rem;\">URL</label><input id=\"s-img-url\" value=\""+(_imgApiCfg.url||'')+"\" placeholder=\"https://api.openai.com/v1/images/generations\" style=\"font-size:0.8rem;\"></div><div class=\"fd\"><label style=\"font-size:0.72rem;\">\u6A21\u578B</label><input id=\"s-img-model\" value=\""+(_imgApiCfg.model||'dall-e-3')+"\" style=\"font-size:0.8rem;width:80px;\"></div></div>"+
    "<button class=\"bt bs bsm\" onclick=\"var ik=(_$('s-img-key')||{}).value||'',iu=(_$('s-img-url')||{}).value||'',im=(_$('s-img-model')||{}).value||'dall-e-3';if(ik||iu){localStorage.setItem('tm_api_image',JSON.stringify({key:ik.trim(),url:iu.trim(),model:im.trim()}));}else{localStorage.removeItem('tm_api_image');}toast('\u751F\u56FEAPI\u5DF2\u4FDD\u5B58');\">\u4FDD\u5B58\u751F\u56FE\u8BBE\u7F6E</button></div></div>"+

    "<div class=\"settings-section\"><h4>\u6587\u98CE</h4>"+
    "<div class=\"fd\"><label>\u5168\u5C40</label><select onchange=\"P.conf.style=this.value\"><option "+(P.conf.style==="\u6587\u5B66\u5316"?"selected":"")+">\u6587\u5B66\u5316</option><option "+(P.conf.style==="\u53F2\u4E66\u4F53"?"selected":"")+">\u53F2\u4E66\u4F53</option><option "+(P.conf.style==="\u622F\u5267\u5316"?"selected":"")+">\u622F\u5267\u5316</option></select></div></div>"+


    "<div class=\"settings-section\"><h4>\u96BE\u5EA6</h4>"+
    "<select onchange=\"P.conf.difficulty=this.value\"><option "+(P.conf.difficulty==="\u7B80\u5355"?"selected":"")+">\u7B80\u5355</option><option "+(P.conf.difficulty==="\u666E\u901A"?"selected":"")+">\u666E\u901A</option><option "+(P.conf.difficulty==="\u56F0\u96BE"?"selected":"")+">\u56F0\u96BE</option></select></div>"+

    // 1.6: Token消耗统计
    "<div class=\"settings-section\"><h4>AI \u8C03\u7528\u7EDF\u8BA1</h4>"+
    (function() {
      if (typeof TokenUsageTracker === 'undefined') return '<div style="color:var(--txt-d);font-size:0.8rem;">暂无数据</div>';
      var s = TokenUsageTracker.getStats();
      var family = (typeof ModelAdapter !== 'undefined') ? ModelAdapter.detectFamily(P.ai.model) : 'openai';
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.8rem;">'+
        '<div>输入Token: <b>'+s.promptTokens.toLocaleString()+'</b></div>'+
        '<div>输出Token: <b>'+s.completionTokens.toLocaleString()+'</b></div>'+
        '<div>总Token: <b>'+s.totalTokens.toLocaleString()+'</b></div>'+
        '<div>API调用次数: <b>'+s.totalCalls+'</b></div>'+
        '<div>预估费用('+family+'): <b>$'+s.estimatedCostUSD+'</b></div>'+
        '<div>本回合消耗: <b>'+TokenUsageTracker.getTurnUsage().toLocaleString()+'</b></div>'+
        '</div>';
    })()+
    "</div>"+

    // 8.6: 错误日志
    "<div class=\"settings-section\"><h4>\u8C03\u8BD5</h4>"+
    "<div style=\"display:flex;gap:0.5rem;flex-wrap:wrap;\">"+
    "<button class=\"bt bp bsm\" onclick=\"if(typeof runSelfTests==='function'){runSelfTests();toast('自检完成，查看控制台');}\">\u8FD0\u884C\u81EA\u68C0</button>"+
    "<button class=\"bt bp bsm\" onclick=\"if(typeof ErrorMonitor!=='undefined'){var t=ErrorMonitor.exportText();navigator.clipboard.writeText(t).then(function(){toast('错误日志已复制到剪贴板('+ErrorMonitor.count()+'条)')}).catch(function(){prompt('请手动复制:',t);});}else{toast('无错误监控');}\">"+"\u5BFC\u51FA\u9519\u8BEF\u65E5\u5FD7 "+(typeof ErrorMonitor!=='undefined'?'('+ErrorMonitor.count()+')':'')+"</button>"+
    "<button class=\"bt bp bsm\" onclick=\"if(typeof DebugLog!=='undefined'){DebugLog.enable('all');toast('已启用全部调试日志');}\">\u5F00\u542F\u8C03\u8BD5\u65E5\u5FD7</button>"+
    "</div></div>";

  bg.classList.add("show");
}
function closeSettings(){_$("settings-bg").classList.remove("show");}

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
    }).catch(function(e){ console.warn("[catch] async:", e); });
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
    setTimeout(function(){ try { renderOfficeTree(); } catch(e) { console.error('[OfficeTree]', e); } }, 30);
  }
  // 切换到文苑tab时渲染作品列表
  if(panelId==='gt-wenyuan' && typeof renderWenyuan==='function') {
    setTimeout(function(){ try { renderWenyuan(); } catch(e) { console.error('[Wenyuan]', e); } }, 30);
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
  var ah = P.adminHierarchy; if (!ah) { grid.innerHTML = '<div style="color:var(--txt-d);text-align:center;">未设置行政区划</div>'; return; }

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
    var _guideMap = {1:{t:'初临朝堂',h:'左侧查看资源和势力·右侧"谕令"下诏·"奏议"批折·"静待时变"推进'},2:{t:'察言观势',h:'查看诏令执行情况·召开朝议·关注势力动态·建议库有方案'},3:{t:'运筹帷幄',h:'人物关系因决策变化·大臣记住你的选择·利用派系矛盾·此后不再提示'}};
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
  // 顶栏年号/时代指示
  var barEra=_$("bar-era");
  if(barEra){
    var _sc=findScenarioById&&findScenarioById(GM.sid);
    barEra.textContent=(_sc?_sc.name:'')+(GM.eraName?' · '+GM.eraName:'');
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
  if (members.length === 0) return '<div style="padding:24px;text-align:center;color:var(--ink-400);font-style:italic;">家 谱 暂 缺 · 史 笔 未 录</div>';
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
    try { CharFullSchema.ensureFullFields(ch); } catch(e) {}
  } else if (typeof CharEconEngine !== 'undefined' && typeof CharEconEngine.ensureCharResources === 'function') {
    try { CharEconEngine.ensureCharResources(ch); } catch(e) {}
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
  if (gender) h += '<span class="qp-gender-age">' + (gender==='female'?'♀':'♂') + (age?age:'') + '</span>';
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
    h += '<div style="margin-top:4px;font-size:10px;"><span style="color:var(--ink-400);">满足度</span> <span style="color:'+gpc+';font-weight:600;">'+gsat+'%</span></div>';
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
    try { CharFullSchema.ensureFullFields(ch); } catch(e) {}
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
  if (gender) h += '<span class="rwp-gender '+(gender==='female'?'female':'male')+'">'+(gender==='female'?'女':'男')+(age?' · '+age:'')+'</span>';
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
    h += '<button class="rwp-act-btn" onclick="(typeof openWendui===\'function\')&&openWendui(\''+safeName+'\')">问 对</button>';
    h += '<button class="rwp-act-btn" onclick="(typeof openLetterCompose===\'function\')&&openLetterCompose(\''+safeName+'\')">传 书</button>';
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
    h += '<div style="color:var(--ink-400);font-size:11px;">五 常 未 启</div>';
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
    h += '<div style="color:var(--ink-400);font-size:11px;">特 质 未 录</div>';
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
    {l:'性 别', v: gender==='female'?'女':'男'},
    {l:'年 龄', v: age || '未详'},
    {l:'身 份', v: ch.role || '—'},
    {l:'职 业', v: ch.occupation || ch.officialTitle || '—'},
    {l:'籍 贯', v: ch.birthplace || '—'},
    {l:'所 在 地', v: ch.location + (ch._travelTo?' → '+ch._travelTo:''), cls: ch._travelTo?'warn':''},
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
    h += '<div style="padding:12px;text-align:center;color:var(--ink-400);font-style:italic;">仕 途 尚 浅 · 事 迹 未 录</div>';
  }
  h += '</div>';
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
    h += '</div></div>';
  }
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
  // 门生
  if (typeof PatronNetwork !== 'undefined') {
    var pnt = PatronNetwork.getTextForChar(ch.name);
    if (pnt) {
      h += '<div class="rwp-sec"><div class="rwp-sec-title">门 生 故 吏</div><div class="rwp-prose" style="font-size:11px;">'+escHtml(pnt)+'</div></div>';
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

// ============================================================
// 鸿雁传书系统 — 信件传递+回复+结算+NPC来书+信使可见化
// ============================================================

/** 信件类型定义 */
// ============================================================
// 品级体系（结构化官阶——通用中国古代18级制）
// ============================================================
// ============================================================
// 官制双层模型——数据迁移与工具
// ============================================================

/** 迁移并双向同步 position 数据：老模型(headCount/actualCount/holder+additionalHolders) ↔ 新模型(establishedCount/vacancyCount/actualHolders) */
function _offMigratePosition(pos) {
  if (!pos || typeof pos !== 'object') return;

  // ── Step 1: 规范老字段 ──
  if (pos.headCount === undefined || pos.headCount === null || pos.headCount === '') pos.headCount = 1;
  if (typeof pos.headCount === 'string') { var _hc = parseInt(pos.headCount, 10); pos.headCount = isNaN(_hc) || _hc < 1 ? 1 : _hc; }
  if (!Array.isArray(pos.additionalHolders)) pos.additionalHolders = [];
  var _matCount = (pos.holder ? 1 : 0) + pos.additionalHolders.length;
  if (pos.actualCount === undefined) pos.actualCount = _matCount;

  // ── Step 2: 新字段——若已存在则以新字段为权威 ──
  if (pos.establishedCount == null) {
    pos.establishedCount = pos.headCount;
  } else {
    // 新字段已设 → 反向同步到老字段
    pos.headCount = pos.establishedCount;
  }
  if (pos.vacancyCount == null) {
    // 从老字段派生：缺员 = 编制 - 实有
    pos.vacancyCount = Math.max(0, pos.headCount - pos.actualCount);
  } else {
    // 新字段已设 → 反向同步 actualCount
    var _derivedActual = Math.max(0, pos.establishedCount - pos.vacancyCount);
    if (pos.actualCount < _derivedActual) pos.actualCount = _derivedActual;
    else if (pos.actualCount > _derivedActual && _matCount <= _derivedActual) pos.actualCount = _derivedActual;
  }

  // ── Step 3: actualHolders——若未存在则从老字段(holder + additionalHolders)构建 ──
  if (!Array.isArray(pos.actualHolders)) {
    var ah = [];
    if (pos.holder) ah.push({ name: pos.holder, generated: true });
    pos.additionalHolders.forEach(function(nm) {
      if (nm && !ah.some(function(h){return h.name===nm;})) ah.push({ name: nm, generated: true });
    });
    // 补占位到 actualCount 长度
    while (ah.length < pos.actualCount) {
      ah.push({ name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2,8) });
    }
    pos.actualHolders = ah;
  } else {
    // 新字段已存在——反向同步到老字段（holder + additionalHolders）
    var namedArr = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
    pos.holder = namedArr[0] || '';
    pos.additionalHolders = namedArr.slice(1);
    // 反向同步 actualCount
    if (pos.actualHolders.length > pos.actualCount) pos.actualCount = pos.actualHolders.length;
  }

  // 单人俸禄兼容
  if (!pos.perPersonSalary && pos.salary) pos.perPersonSalary = pos.salary;
  if (!pos.salary && pos.perPersonSalary) pos.salary = pos.perPersonSalary;

  pos._migrated = true;
}

/** 迁移整棵官制树 */
function _offMigrateTree(tree) {
  if (!tree) return;
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) { _offMigratePosition(p); });
      if (n.subs) _walk(n.subs);
    });
  })(tree);
}

/** 获取职位的具象人数——优先新模型 actualHolders，降级老模型 */
function _offMaterializedCount(pos) {
  if (Array.isArray(pos.actualHolders)) {
    return pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).length;
  }
  return (pos.holder ? 1 : 0) + (pos.additionalHolders ? pos.additionalHolders.length : 0);
}

/** 获取职位的所有具象角色名列表——优先新模型 */
function _offAllHolders(pos) {
  if (Array.isArray(pos.actualHolders)) {
    return pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  }
  var arr = [];
  if (pos.holder) arr.push(pos.holder);
  if (pos.additionalHolders) arr = arr.concat(pos.additionalHolders);
  return arr;
}

/** 任命：把 person 装入 position 的 actualHolders（优先填占位；无占位则扩展） */
function _offAppointPerson(pos, person) {
  if (!pos || !person) return;
  _offMigratePosition(pos);
  if (!Array.isArray(pos.actualHolders)) pos.actualHolders = [];
  // 若已有同名条目，跳过
  if (pos.actualHolders.some(function(h){return h && h.name === person && h.generated!==false;})) return;
  // 找第一个 generated:false 占位
  var slot = pos.actualHolders.find(function(h){return h && h.generated===false;});
  if (slot) {
    slot.name = person;
    slot.generated = true;
    slot.appointedTurn = (typeof GM!=='undefined' && GM.turn) || 0;
  } else {
    // 无占位——扩展一个（编制可能因此增加）
    pos.actualHolders.push({ name: person, generated: true, appointedTurn: (typeof GM!=='undefined' && GM.turn) || 0 });
    if (pos.actualHolders.length > pos.establishedCount) pos.establishedCount = pos.actualHolders.length;
    if (pos.actualHolders.length > pos.headCount) pos.headCount = pos.actualHolders.length;
    pos.actualCount = pos.actualHolders.length;
  }
  // 同步老字段
  var named = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  pos.holder = named[0] || '';
  pos.additionalHolders = named.slice(1);
  pos.actualCount = named.length + pos.actualHolders.filter(function(h){return h && h.generated===false;}).length;
}

/** 罢免：从 actualHolders 中移除 person，留下 generated:false 占位（不变更编制） */
function _offDismissPerson(pos, person) {
  if (!pos || !person) return;
  _offMigratePosition(pos);
  if (!Array.isArray(pos.actualHolders)) pos.actualHolders = [];
  var idx = pos.actualHolders.findIndex(function(h){return h && h.name === person;});
  if (idx >= 0) {
    // 替换为占位（保持位置计数）
    pos.actualHolders[idx] = { name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2,8), vacatedBy: person, vacatedTurn: (typeof GM!=='undefined' && GM.turn) || 0 };
  }
  var named = pos.actualHolders.filter(function(h){return h && h.name && h.generated!==false;}).map(function(h){return h.name;});
  pos.holder = named[0] || '';
  pos.additionalHolders = named.slice(1);
}

/** 获取部门的聚合统计 */
function _offDeptStats(dept) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, vacant: 0, unmaterialized: 0, holders: [] };
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      (n.positions||[]).forEach(function(p) {
        _offMigratePosition(p);
        stats.headCount += (p.headCount||1);
        stats.actualCount += (p.actualCount||0);
        var m = _offMaterializedCount(p);
        stats.materialized += m;
        _offAllHolders(p).forEach(function(h) { stats.holders.push(h); });
      });
      if (n.subs) _walk(n.subs);
    });
  })([dept]);
  stats.vacant = stats.headCount - stats.actualCount;
  stats.unmaterialized = stats.actualCount - stats.materialized;
  return stats;
}

/** 获取整棵树的聚合统计 */
function _offTreeStats(tree) {
  var stats = { headCount: 0, actualCount: 0, materialized: 0, depts: 0 };
  (function _walk(nodes) {
    nodes.forEach(function(n) {
      stats.depts++;
      (n.positions||[]).forEach(function(p) {
        _offMigratePosition(p);
        stats.headCount += (p.headCount||1);
        stats.actualCount += (p.actualCount||0);
        stats.materialized += _offMaterializedCount(p);
      });
      if (n.subs) _walk(n.subs);
    });
  })(tree||[]);
  return stats;
}

var RANK_HIERARCHY = [
  {id:'z1',label:'正一品',level:1,salary:100,color:'var(--gold-400)'},
  {id:'c1',label:'从一品',level:2,salary:90,color:'var(--gold-400)'},
  {id:'z2',label:'正二品',level:3,salary:80,color:'var(--gold-400)'},
  {id:'c2',label:'从二品',level:4,salary:72,color:'var(--gold-400)'},
  {id:'z3',label:'正三品',level:5,salary:65,color:'var(--amber-400)'},
  {id:'c3',label:'从三品',level:6,salary:58,color:'var(--amber-400)'},
  {id:'z4',label:'正四品',level:7,salary:50,color:'var(--amber-400)'},
  {id:'c4',label:'从四品',level:8,salary:44,color:'var(--amber-400)'},
  {id:'z5',label:'正五品',level:9,salary:38,color:'var(--celadon-400)'},
  {id:'c5',label:'从五品',level:10,salary:33,color:'var(--celadon-400)'},
  {id:'z6',label:'正六品',level:11,salary:28,color:'var(--celadon-400)'},
  {id:'c6',label:'从六品',level:12,salary:24,color:'var(--celadon-400)'},
  {id:'z7',label:'正七品',level:13,salary:20,color:'var(--color-foreground-secondary)'},
  {id:'c7',label:'从七品',level:14,salary:17,color:'var(--color-foreground-secondary)'},
  {id:'z8',label:'正八品',level:15,salary:14,color:'var(--ink-300)'},
  {id:'c8',label:'从八品',level:16,salary:12,color:'var(--ink-300)'},
  {id:'z9',label:'正九品',level:17,salary:10,color:'var(--ink-300)'},
  {id:'c9',label:'从九品',level:18,salary:8,color:'var(--ink-300)'}
];

/** 根据品级文本获取level（数字越小品级越高） */
function getRankLevel(rankStr) {
  if (!rankStr) return 99;
  for (var i = 0; i < RANK_HIERARCHY.length; i++) {
    if (rankStr.indexOf(RANK_HIERARCHY[i].label) >= 0) return RANK_HIERARCHY[i].level;
  }
  return 99;
}

/** 获取品级信息 */
function getRankInfo(rankStr) {
  if (!rankStr) return null;
  for (var i = 0; i < RANK_HIERARCHY.length; i++) {
    if (rankStr.indexOf(RANK_HIERARCHY[i].label) >= 0) return RANK_HIERARCHY[i];
  }
  return null;
}

/** 计算官员满意度（大材小用/小材大用检测） */
function calcOfficialSatisfaction(charName, posRank, deptName) {
  var ch = findCharByName(charName);
  if (!ch) return { score: 50, label: '未知' };
  // 能力综合分
  var abilityScore = ((ch.intelligence||50) + (ch.administration||50) + (ch.military||50)) / 3;
  var rankLevel = getRankLevel(posRank);
  // 品级越高(level越小)→需要越高能力
  var expectedAbility = Math.max(30, 90 - rankLevel * 3.5);
  var diff = abilityScore - expectedAbility;
  // 野心影响：野心高的人在低品级更不满
  var ambitionPenalty = rankLevel > 10 ? (ch.ambition||50) * 0.3 : 0;
  var satisfaction = 50 + diff * 0.8 - ambitionPenalty;
  satisfaction = Math.max(0, Math.min(100, Math.round(satisfaction)));
  var label = satisfaction > 75 ? '志得意满' : satisfaction > 55 ? '安于其位' : satisfaction > 35 ? '郁郁不得志' : '怀才不遇';
  return { score: satisfaction, label: label };
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
  // 新增：馈赠、外交国书
  gift: { label: '附礼', css: 'lt-type-greeting', icon: 'treasury', interceptWeight: 0.5, formal: false },
  diplomatic: { label: '国书', css: 'lt-type-proclamation', icon: 'scroll', interceptWeight: 2, formal: true }
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
  if (P.adminHierarchy) {
    var _sameProv = _ltCheckSameProvince(fromLoc, toLoc);
    if (_sameProv) li = 200;
  }
  // 若两地名有共同前缀（同区域），距离近
  if (fromLoc.length >= 2 && toLoc.length >= 2 && fromLoc.slice(0,2) === toLoc.slice(0,2)) li = 150;
  return Math.max(1, Math.ceil(li / speed));
}
/** 检查两地是否在同一顶级行政区 */
function _ltCheckSameProvince(loc1, loc2) {
  if (!P.adminHierarchy) return false;
  var ah = P.adminHierarchy.player ? P.adminHierarchy.player : P.adminHierarchy[Object.keys(P.adminHierarchy)[0]];
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
  function _regionOf(loc) {
    if (!loc) return '\u5176\u4ED6';
    if (/\u8FBD|\u5BA7|\u9526|\u7518\u76F4|\u76DB\u4EAC|\u8FA3\u9633|\u6C88\u9633|\u4EAC\u7B7B/.test(loc)) return '\u8FBD\u4E1C\u00B7\u5317\u5883';
    if (/\u5927\u540C|\u5BA3|\u8367|\u592A\u539F|\u9695/.test(loc)) return '\u8FBD\u4E1C\u00B7\u5317\u5883';
    if (/\u9655|\u897F\u5B89|\u5EF6|\u7518|\u5B81\u590F|\u5170\u5DDE|\u4E09\u8FB9|\u6C58\u5DDE|\u51C9/.test(loc)) return '\u897F\u9677\u00B7\u8FB9\u9547';
    if (/\u56DB\u5DDD|\u91CD\u5E86|\u4E91|\u8D35|\u8568|\u7B47|\u77F3\u67F1|\u6210\u90FD/.test(loc)) return '\u897F\u5357\u00B7\u5DF4\u8700';
    if (/\u798F\u5EFA|\u5E7F\u4E1C|\u5E7F\u897F|\u6D77|\u5384\u95E8|\u6280\u6E7E|\u6E29\u90FD|\u7518\u590F/.test(loc)) return '\u5357\u65B9\u00B7\u6D77\u7586';
    if (/\u6C5F|\u676D|\u5357\u4EAC|\u82CF|\u6E56\u5E7F|\u77F3\u5BAE|\u6D59/.test(loc)) return '\u6C5F\u5357\u00B7\u6C5F\u6D59';
    if (/\u6CB3\u5357|\u5C71\u4E1C|\u6CB3\u5317|\u5317\u76F4|\u9C81/.test(loc)) return '\u4E2D\u539F\u00B7\u9C81\u8C6B';
    return '\u5176\u4ED6';
  }

  // ── NPC 卡片列表 ──
  var el = _$('letter-chars');
  if (el) {
    var remote = (GM.chars||[]).filter(function(c) { return c.alive !== false && c.location && c.location !== capital && !c.isPlayer; });
    if (remote.length === 0) {
      el.innerHTML = '<div style="color:var(--color-foreground-muted);font-size:12px;padding:20px 14px;text-align:center;font-family:var(--font-serif);letter-spacing:0.12em;line-height:1.8;">\u767E\u5B98\u5747\u5728\u4EAC\u57CE\u00B7\u65E0\u9700\u4F20\u4E66</div>';
    } else {
      // 按地域分组
      var _groups = {};
      remote.forEach(function(ch) {
        var r = _regionOf(ch.location);
        if (!_groups[r]) _groups[r] = [];
        _groups[r].push(ch);
      });
      var _grpOrder = ['\u8FBD\u4E1C\u00B7\u5317\u5883','\u897F\u9677\u00B7\u8FB9\u9547','\u4E2D\u539F\u00B7\u9C81\u8C6B','\u6C5F\u5357\u00B7\u6C5F\u6D59','\u897F\u5357\u00B7\u5DF4\u8700','\u5357\u65B9\u00B7\u6D77\u7586','\u5176\u4ED6'];

      function _cardClass(ch) {
        var t = (ch.title||'') + (ch.officialTitle||'');
        if (/\u5C06|\u603B\u5175|\u7763|\u6307\u6325|\u6307\u6325\u4F7F/.test(t)) return 'hy-c-mili';
        if ((ch.loyalty||50) >= 75) return 'hy-c-loyal';
        if (/\u5B66\u58EB|\u4FA8|\u5C1A\u4E66|\u90CE\u4E2D|\u4FA8\u5B66|\u7AE5\u5B9E|\u4F5B|\u5FB4\u58EB|\u6559\u6388|\u4FA8\u516C|\u84DD\u77E5/.test(t)) return 'hy-c-scholar';
        return 'hy-c-normal';
      }

      var cardsHtml = '';
      _grpOrder.forEach(function(g) {
        if (!_groups[g] || _groups[g].length === 0) return;
        cardsHtml += '<div class="hy-group-sep">' + escHtml(g) + '</div>';
        _groups[g].forEach(function(ch) {
          var isMulti = (GM._ltMultiTargets||[]).indexOf(ch.name) >= 0;
          var sel = (GM._ltMultiMode ? (isMulti ? ' active' : '') : (GM._pendingLetterTo === ch.name ? ' active' : ''));
          var safeName = ch.name.replace(/'/g, "\\'");
          var _cls = _cardClass(ch);
          var unreadCount = _ltCountUnread(ch.name);
          var transitCount = _ltCountTransit(ch.name);
          var lostCount = _ltCountLost(ch.name);
          var npcNewCount = _ltCountNpcNew(ch.name);
          var _isRouteBlocked = _ltIsRouteBlocked(capital, ch.location);
          var _inds = '';
          if (unreadCount > 0) _inds += '<div class="hy-ind hy-ind-unread" title="' + unreadCount + ' \u5C01\u672A\u8BFB">' + unreadCount + '</div>';
          if (npcNewCount > 0) _inds += '<div class="hy-ind hy-ind-new" title="' + npcNewCount + ' \u5C01\u6765\u51FD">' + npcNewCount + '</div>';
          if (transitCount > 0) _inds += '<div class="hy-ind hy-ind-transit" title="' + transitCount + ' \u5C01\u5728\u9014">' + transitCount + '</div>';
          if (lostCount > 0) _inds += '<div class="hy-ind hy-ind-lost" title="\u4FE1\u4F7F\u903E\u671F">?</div>';
          if (_isRouteBlocked) _inds += '<div class="hy-ind hy-ind-blocked" title="\u9A7F\u8DEF\u963B\u65AD">\u2715</div>';

          var _initial = escHtml(String(ch.name||'?').charAt(0));
          var _portrait = ch.portrait ? '<img src="' + escHtml(ch.portrait) + '">' : _initial;
          var _travel = ch._travelTo ? '<span class="travel-arrow">\u2192</span>' + escHtml(ch._travelTo) : '';

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
    var _recentCorr = _npcCorr.filter(function(c) { return (GM.turn - c.turn) <= 5; });
    var overviewHtml = '<div class="hy-hist-body"><div class="hy-hist-empty">\u9009\u62E9\u4E00\u4F4D\u8FDC\u65B9\u81E3\u5B50\u00B7\u4EE5\u89C1\u4E66\u4FE1\u5F80\u6765</div>';
    if (_recentCorr.length > 0) {
      overviewHtml = '<div class="hy-hist-head"><div class="hy-hist-title-wrap"><div class="hy-hist-portrait" style="background:linear-gradient(135deg,var(--vermillion-400),var(--ink-100));border-color:var(--vermillion-400);">\u5BC6</div><div><div class="hy-hist-name">\u622A\u83B7\u7684 NPC \u5BC6\u4FE1</div><div class="hy-hist-sub">\u8FD1 5 \u56DE\u5408\u00B7\u5171 ' + _recentCorr.length + ' \u5C01</div></div></div></div>';
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
  else if (_filter === 'lost') letters = allLetters.filter(function(l) { return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1); });

  // 新头部
  var _initial = escHtml(String(target||'?').charAt(0));
  var _portraitHtml = (ch && ch.portrait) ? '<img src="' + escHtml(ch.portrait) + '">' : _initial;
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
    letters.forEach(function(l) { html += _ltRenderLetterCard(l, target); });
  }
  html += '</div>';

  hist.innerHTML = html;
  var _body = hist.querySelector('.hy-hist-body');
  if (_body) _body.scrollTop = _body.scrollHeight;
}

/** 渲染单封信笺卡片 */
function _ltRenderLetterCard(l, target) {
  var html = '';
  var isOutgoing = (l.from === '玩家');
  var sentDate = (typeof getTSText === 'function') ? getTSText(l.sentTurn) : '第' + l.sentTurn + '回合';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeInfo = LETTER_TYPES[l.letterType] || LETTER_TYPES.personal;
  var _intercepted = (l.status === 'intercepted' || l.status === 'intercepted_forging');
  var _inTransit = (l.status === 'traveling' || l.status === 'replying');
  var _lost = (l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1));

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

  // 标记已读
  if (!isOutgoing && !l._playerRead) l._playerRead = true;

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
  // 正文
  html += '<div class="body wd-selectable">' + escHtml(l.content || '') + '</div>';
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
      html += '<div style="font-size:11px;color:var(--amber-400);margin-top:4px;font-style:normal;">\u26A0 \u5DF2\u6807\u8BB0\u5B58\u7591\u2014\u2014\u6B64\u4FE1\u5185\u5BB9\u771F\u4F2A\u5F85\u6838</div>';
    }
    if (l._forgedRevealed) {
      html += '<div style="font-size:11px;color:var(--vermillion-400);margin-top:4px;font-weight:bold;font-style:normal;">\u26A0 \u5DF2\u8BC1\u5B9E\u4E3A\u4F2A\u9020\uFF01</div>';
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
    html += '<div style="font-size:10.5px;color:var(--ink-300);margin-top:4px;font-style:italic;letter-spacing:0.08em;' + (isOutgoing?'text-align:right;':'') + '">\u21A3 ' + escHtml(_cTxt) + '</div>';
  }
  html += '</div>'; // .hy-msg
  return html;
}

/** 信件状态文本 */
function _ltGetStatusText(l) {
  if (l.status === 'traveling') {
    var arrDate = (typeof getTSText === 'function') ? getTSText(l.deliveryTurn) : '第' + l.deliveryTurn + '回合';
    if (l._recallSent) return '追回信使已派出';
    if (GM.turn > l.deliveryTurn + 1) return '⚠ 信使逾期未归';
    return '信使在途…… 预计' + arrDate + '送达';
  }
  if (l.status === 'delivered') return '已送达，等待回函……';
  if (l.status === 'replying') return '回函在途……';
  if (l.status === 'intercepted') return '⚠ 信使失踪';
  if (l.status === 'intercepted_forging') return '回函在途……';
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
    + (GM.letters||[]).filter(function(l) { return l.to === name && l.status === 'traveling' && GM.turn > l.deliveryTurn + 1; }).length;
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

/** 遣使核实 */
function _ltVerify(letterId) {
  var l = (GM.letters||[]).find(function(x){ return x.id === letterId; });
  if (!l) return;
  var capital = GM._capital || '京城';
  var ch = findCharByName(l.to);
  var toLoc = ch ? (ch.location || capital) : capital;
  var days = calcLetterDays(capital, toLoc, 'urgent');
  var dpv = _getDaysPerTurn();
  var verifyLetter = {
    id: uid(), from: '玩家', to: l.to,
    fromLocation: capital, toLocation: toLoc,
    content: '核实前函——朕遣使复核，卿是否曾收到前日来函并亲笔回书？',
    sentTurn: GM.turn, deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
    replyTurn: GM.turn + Math.max(2, Math.ceil(days * 2 / dpv)),
    reply: '', status: 'traveling', urgency: 'urgent',
    letterType: 'secret_decree', _verifyTarget: letterId
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

  var capital = GM._capital || '京城';
  var urgLabels = { normal:'驿递', urgent:'加急', extreme:'八百里加急' };
  var typeLabel = (LETTER_TYPES[letterType]||{}).label || '书信';
  var sentDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
  var dpv = _getDaysPerTurn();
  var multiCount = targets.length > 1 ? targets.length : 0;

  // 信物检查（征调令需虎符等）
  var tokenNeeded = (LETTER_TYPES[letterType]||{}).needsToken;
  var tokenUsed = '';
  if (tokenNeeded && typeof tokenNeeded === 'string') {
    // 检查是否有此信物（物品系统）——若无则警告但仍可发（NPC可能不从）
    var _hasToken = (GM.items||[]).some(function(it) { return it.type === tokenNeeded || it.name === (LETTER_TOKENS[tokenNeeded]||{}).label; });
    if (!_hasToken) {
      toast('⚠ 未持有' + ((LETTER_TOKENS[tokenNeeded]||{}).label||'凭证') + '——对方可能疑诏不从');
    }
    tokenUsed = tokenNeeded;
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

  targets.forEach(function(target) {
    var ch = findCharByName(target);
    var toLoc = ch ? (ch.location || capital) : capital;
    var days = calcLetterDays(capital, toLoc, urgency);
    // 密使模式速度更慢但更安全
    if (sendMode === 'secret_agent') days = Math.ceil(days * 1.5);
    // 多路信使增加冗余
    var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
    var replyDays = days * 2 + 3;
    var replyTurns = Math.max(deliveryTurns + 1, Math.ceil(replyDays / dpv));

    var letter = {
      id: uid(), from: '玩家', to: target,
      fromLocation: capital, toLocation: toLoc,
      content: content, sentTurn: GM.turn,
      deliveryTurn: GM.turn + deliveryTurns,
      replyTurn: GM.turn + replyTurns,
      reply: '', status: _formalBlocked ? 'blocked' : 'traveling',
      urgency: urgency, letterType: letterType,
      _cipher: cipher, _sendMode: sendMode,
      _tokenUsed: tokenUsed, _agentName: agentName,
      _multiRecipients: multiCount > 0 ? multiCount : undefined,
      _replyingTo: GM._ltReplyingTo || undefined
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
    GM.qijuHistory.unshift({ turn: GM.turn, date: sentDate, content: '【鸿雁传书】遣' + (urgLabels[urgency]||'驿递') + '致' + _targetNames + '（' + typeLabel + (cipher !== 'none' ? '·' + (LETTER_CIPHERS[cipher]||{}).label : '') + '）。内容：' + content });
  }

  if (textarea) textarea.value = '';
  GM._ltReplyingTo = undefined;
  GM._ltMultiMode = false;
  GM._ltMultiTargets = [];
  toast(targets.length > 1 ? '已群发' + targets.length + '函' : '信函已发出（' + (urgLabels[urgency]||'驿递') + '）');
  renderLetterPanel();
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

/** 每回合结算信件传递+角色赶路 (注册到SettlementPipeline) */
function _settleLettersAndTravel() {
  var dpv = _getDaysPerTurn();
  if (!GM._courierStatus) GM._courierStatus = {};
  if (!GM._npcCorrespondence) GM._npcCorrespondence = [];

  var _gMode = (P.conf && P.conf.gameMode) || '';
  var _canIntercept = _gMode === 'strict_hist' || _gMode === 'light_hist';
  var _hostileFacs = (GM.facs||[]).filter(function(f){ return !f.isPlayer && (f.playerRelation||0) < -50; });

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

  // 1. 推进玩家信件
  (GM.letters||[]).forEach(function(l) {
    if (l.status === 'blocked') return; // 被中书阻挠
    if (l.status === 'recalled') return;
    if (l.status === 'traveling' && GM.turn >= l.deliveryTurn) {
      // 截获判定
      if (_canIntercept && !l._interceptChecked) {
        l._interceptChecked = true;
        var _rate = _ltCalcInterceptRate(l, _hostileFacs);
        if (Math.random() < _rate) {
          _ltDoIntercept(l, _hostileFacs);
          return;
        }
      }
      l.status = 'delivered';
      if (typeof addEB === 'function') addEB('传书', '致' + (l.to||l.from) + '的信已送达' + (l.toLocation||''));
      if (!l._npcInitiated) _generateLetterReply(l);
    }
    if (l.status === 'replying' && GM.turn >= l.replyTurn) {
      l.status = 'returned';
      var _replyNpc = findCharByName(l.to);
      var _dem = _replyNpc ? (_replyNpc.loyalty > 80 ? '恭敬拜读' : _replyNpc.loyalty < 30 ? '面色凝重' : _replyNpc.stress > 70 ? '神色疲惫' : '速具回书') : '已收函';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + _dem + '。';
      // 核实信处理
      if (l._verifyTarget) {
        var _orig = (GM.letters||[]).find(function(x){ return x.id === l._verifyTarget; });
        if (_orig && _orig._isForged) {
          l.reply = '臣' + l.to + '惶恐顿首——臣从未收到前日来函，更未曾回书！此前所谓回信必是伪造！请陛下明察！';
          _orig._forgedRevealed = true;
          if (typeof addEB === 'function') addEB('传书', '⚠ ' + l.to + '证实前函回信系伪造！');
        }
      }
      // 征调令/密旨未附信物→NPC可能不从
      if (l._tokenUsed === 'tally' && l.letterType === 'military_order') {
        var _hasIt = (GM.items||[]).some(function(it){ return it.type === 'tally' || it.name === '虎符'; });
        if (!_hasIt && _replyNpc && _replyNpc.loyalty < 60) {
          l.reply = (l.reply||'') + '\n（按：' + l.to + '以未见虎符为由，暂未奉行征调。）';
        }
      }
      var replyDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: replyDate, content: '【鸿雁传书】' + l.to + '回函到达。' + (l.reply||'') });
    }
    // 伪造回信
    if (l.status === 'intercepted_forging' && GM.turn >= l.replyTurn) {
      l.status = 'returned'; l._isForged = true;
      l.reply = '臣谨奉诏。诸事安好，请陛下放心。臣当继续勉力。';
      GM._courierStatus[l.id] = '信使回报：' + (l.to||'') + '已收函。';
      var _fd = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.to + '的回信已到达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: _fd, content: '【鸿雁传书】' + l.to + '回函到达。' + l.reply });
      if (!GM._interceptedIntel) GM._interceptedIntel = [];
      GM._interceptedIntel.push({ turn: GM.turn, interceptor: l.interceptedBy||'敌方', from: '伪造', to: '皇帝', content: '敌方已伪造' + l.to + '的回信欺骗玩家', urgency: 'forged' });
    }
  });

  // 2. NPC主动来书入队
  if (GM._pendingNpcLetters && GM._pendingNpcLetters.length > 0) {
    var capital = GM._capital || '京城';
    GM._pendingNpcLetters.forEach(function(nl) {
      var fromCh = findCharByName(nl.from);
      var fromLoc = fromCh ? (fromCh.location || '远方') : '远方';
      var days = calcLetterDays(fromLoc, capital, nl.urgency || 'normal');
      var letter = {
        id: uid(), from: nl.from, to: '玩家', fromLocation: fromLoc, toLocation: capital,
        content: nl.content||'', sentTurn: GM.turn,
        deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
        reply: '', status: 'traveling', urgency: nl.urgency||'normal',
        letterType: nl.type||'report', _npcInitiated: true,
        _replyExpected: nl.replyExpected !== false, _playerRead: false,
        _suggestion: nl.suggestion || ''
      };
      if (_canIntercept && nl.type !== 'proclamation') {
        var _r2 = _ltCalcInterceptRate(letter, _hostileFacs);
        if (Math.random() < _r2) { _ltDoIntercept(letter, _hostileFacs); }
      }
      // NPC记住自己写了什么（防止续奏/来函前后矛盾）
      if (nl.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
        var _typeLabels = {report:'奏报',plea:'陈情',warning:'急报',intelligence:'密信',personal:'私函'};
        NpcMemorySystem.remember(nl.from, '向天子上' + (_typeLabels[nl.type]||'书') + '：' + (nl.content||'').slice(0,60), '平', 5);
      }
      if (!GM.letters) GM.letters = [];
      GM.letters.push(letter);
    });
    GM._pendingNpcLetters = [];
  }

  // 3. NPC来信到达 → 自动推入诏书建议库
  (GM.letters||[]).forEach(function(l) {
    if (l._npcInitiated && l.status === 'traveling' && GM.turn >= l.deliveryTurn) {
      l.status = 'returned';
      var ad = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      if (typeof addEB === 'function') addEB('传书', l.from + '的来函已送达');
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: ad, content: '【鸿雁传书】收到' + l.from + '自' + (l.fromLocation||'远方') + '来函。' });
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
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: ad, content: '【驿递奏疏】收到' + mem.from + '自' + (mem._remoteFrom||'远方') + '所上奏疏。' });
    });
    if (_arrivedMems.length > 0 && typeof renderMemorials === 'function') renderMemorials();
  }

  // 6. 推进角色赶路
  (GM.chars||[]).forEach(function(c) {
    if (c._travelTo && GM.turn >= c._travelArrival) {
      var arrDate = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
      c.location = c._travelTo;
      if (typeof addEB === 'function') addEB('人事', c.name + '已抵达' + c.location);
      if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: arrDate, content: '【入京】' + c.name + '从' + c._travelFrom + '抵达' + c.location + '。' });
      c._travelTo = null;
      c._travelArrival = 0;
      c._travelFrom = '';
    }
  });
}

/** AI生成回信 */
/** 计算截获概率（基于地理、势力范围、驿路、加密、信件类型） */
function _ltCalcInterceptRate(l, hostileFacs) {
  if (l.letterType === 'proclamation') return 0; // 檄文公开
  // 基础概率
  var rate = l.urgency === 'extreme' ? 0.02 : l.urgency === 'urgent' ? 0.05 : 0.10;
  // 信件类型权重
  var tw = (LETTER_TYPES[l.letterType]||{}).interceptWeight;
  if (tw !== undefined) rate *= (tw || 0.1);
  // 敌对势力加成
  if (hostileFacs && hostileFacs.length > 0) rate += 0.10;
  // 地理因素：目标地是否在敌对势力控制区
  if (l.toLocation || l.fromLocation) {
    var _loc = l.toLocation || l.fromLocation;
    var _inHostile = (GM.facs||[]).some(function(f) {
      if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
      var _fTerr = f.territories || f.territory || [];
      if (typeof _fTerr === 'string') _fTerr = [_fTerr];
      return _fTerr.indexOf(_loc) >= 0;
    });
    if (_inHostile) rate += 0.25; // 途经敌占区
  }
  // 围城中的信更难出去
  var _besieged = (GM._sieges||[]).some(function(s) { return s.target === l.fromLocation || s.target === l.toLocation; });
  if (_besieged) rate += 0.40;
  // 驿路阻断
  if (_ltIsRouteBlocked(l.fromLocation, l.toLocation)) rate += 0.30;
  // 加密降低截获内容可读性（但不降低截获率——只降低情报价值）
  // 密使模式降低截获率
  if (l._sendMode === 'secret_agent') rate *= 0.3;
  // 多路信使降低截获率（至少一路成功）
  if (l._sendMode === 'multi_courier') rate *= 0.15;
  return Math.min(0.9, Math.max(0, rate));
}

/** 执行截获 */
function _ltDoIntercept(l, hostileFacs) {
  l.status = 'intercepted';
  var _int = hostileFacs && hostileFacs.length > 0 ? hostileFacs[Math.floor(Math.random()*hostileFacs.length)].name : '不明势力';
  l.interceptedBy = _int;
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
  if (!GM._undeliveredLetters) GM._undeliveredLetters = [];
  GM._undeliveredLetters.push({ to: l._npcInitiated ? '皇帝' : l.to, content: l.content, turn: GM.turn, interceptor: _int });
  GM._courierStatus[l.id] = '⚠ 信使逾期未归——去向不明';
  // 伪造回信
  if (!l._npcInitiated) {
    var _iFac = (GM.facs||[]).find(function(f){ return f.name === _int; });
    if (_iFac && Math.random() < 0.3) {
      l._forgedReply = true; l.status = 'intercepted_forging'; l.replyTurn = GM.turn + 1;
    }
  }
  if (typeof addEB === 'function') addEB('传书', (l._npcInitiated ? l.from + '的来函' : '致' + l.to + '的') + '信使逾期未归');
}

function _generateLetterReply(letter) {
  letter.status = 'replying';
  var ch = findCharByName(letter.to);
  if (!ch) { letter.reply = '臣已拜读圣函。'; letter.status = 'returned'; return; }

  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(letter.to, '收到天子亲笔来函：' + letter.content, '敬', 6, '天子');
  }

  var typeLabel = (LETTER_TYPES[letter.letterType]||{}).label || '书信';

  if (typeof callAI === 'function' && P.ai && P.ai.key) {
    var brief = (typeof getCharacterPersonalityBrief === 'function') ? getCharacterPersonalityBrief(ch) : ch.name;
    var memCtx = (typeof NpcMemorySystem !== 'undefined') ? NpcMemorySystem.getMemoryContext(ch.name) : '';
    var prompt = '你是' + ch.name + '，' + (ch.title||'') + '，当前在' + (ch.location||'远方') + '。\n性格：' + brief;
    if (memCtx) prompt += '\n近期心绪：' + memCtx;
    prompt += '\n收到来自京城天子的' + typeLabel + '：\n「' + letter.content + '」\n\n请以该角色的口吻、身份、性格、当前心绪写一封回信（100-200字），用古典中文，称谓恰当（臣/末将等）。回信应反映你的真实情感和立场。直接输出回信内容。';
    callAI(prompt, 500).then(function(reply) {
      letter.reply = reply || '臣叩首拜读，容臣三思后详禀。';
      letter.status = 'returned';
    }).catch(function() {
      letter.reply = '臣已拜读圣函，容臣三思。';
      letter.status = 'returned';
    });
  } else {
    letter.reply = '臣' + ch.name + '叩首，拜读圣函。容臣细思，当速具回奏。';
  }
}

/** AI prompt注入：角色位置+传书完整态势 */
function getLocationPromptInjection() {
  var capital = GM._capital || '京城';
  var remote = (GM.chars||[]).filter(function(c) { return c.alive !== false && c.location && c.location !== capital; });
  var allLetters = GM.letters || [];
  var pendingLetters = allLetters.filter(function(l) { return l.status !== 'returned' && l.status !== 'intercepted'; });
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

  // 信使失踪（截获线索——玩家看到的是"信使逾期"）
  var lostLetters = allLetters.filter(function(l) {
    return l.status === 'intercepted' || (l.status === 'traveling' && GM.turn > l.deliveryTurn + 1);
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
    return l._npcInitiated && l._replyExpected && l.status === 'returned' && !l._playerReplied && (GM.turn - l.deliveryTurn) > 2;
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

/** 按需具象化——为未具象的在任官员生成角色 */
async function _offMaterialize(deptName, posName) {
  if (!P.ai || !P.ai.key) { toast('需要AI密钥'); return; }
  // 找到职位
  var _pos = null, _dept = null;
  (function _f(ns) { ns.forEach(function(n) { if (n.name === deptName) { (n.positions||[]).forEach(function(p) { if (p.name === posName) { _pos = p; _dept = n; } }); } if (n.subs) _f(n.subs); }); })(GM.officeTree||[]);
  if (!_pos) { toast('找不到职位'); return; }
  if (typeof _offMigratePosition === 'function') _offMigratePosition(_pos);
  var _m = _offMaterializedCount(_pos);
  if (_m >= (_pos.actualCount||0)) { toast('此职位所有在任者已具象'); return; }
  var _dynasty = '';
  var _sc4 = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
  if (_sc4) _dynasty = (_sc4.era||'') + (_sc4.dynasty||'');
  var _existNames = (GM.chars||[]).map(function(c) { return c.name; });
  try {
    toast('正在生成角色...');
    var prompt = '背景：' + (_dynasty||'中国古代') + '。为' + deptName + '的' + posName + '（' + (_pos.rank||'') + '）生成1名任职者。\n'
      + '优先用真实历史人物，找不到则虚构。\n'
      + '已有角色：' + _existNames.slice(0,15).join('、') + '\n'
      + '返回JSON：{"name":"人名","personality":"性格","intelligence":60,"administration":60,"military":40,"loyalty":60,"ambition":50}';
    var c = await callAI(prompt, 500);
    var parsed = extractJSON(c);
    if (parsed && parsed.name) {
      if (!GM.chars) GM.chars = [];
      if (!GM.chars.find(function(ch){ return ch.name === parsed.name; })) {
        GM.chars.push({
          name: parsed.name, title: posName, officialTitle: posName,
          personality: parsed.personality||'', intelligence: parsed.intelligence||55,
          administration: parsed.administration||55, military: parsed.military||40,
          loyalty: parsed.loyalty||55, ambition: parsed.ambition||45,
          location: GM._capital||'京城', alive: true,
          valor: parsed.valor||40, diplomacy: parsed.diplomacy||50, stress: 0
        });
      }
      // 加入holders
      if (!_pos.additionalHolders) _pos.additionalHolders = [];
      if (!_pos.holder) { _pos.holder = parsed.name; }
      else { _pos.additionalHolders.push(parsed.name); }
      toast('已生成：' + parsed.name);
      if (typeof renderOfficeTree === 'function') renderOfficeTree();
    }
  } catch(e) { toast('生成失败'); }
}

/** 丁忧/考课/任期结算 */
function _settleOfficeMourning() {
  // 1. 丁忧中的官员——在丁忧期间从官制树中标记空缺（但不删除holder，保留恢复）
  (GM.chars||[]).forEach(function(c) {
    if (!c._mourning || c.alive === false) return;
    if (GM.turn >= c._mourning.until) {
      // 丁忧期满——可复职
      c._mourning = null;
      if (typeof addEB === 'function') addEB('人事', c.name + '丁忧期满，可重新起用');
    } else if (c._mourning.since === GM.turn) {
      // 刚进入丁忧——从官制树中暂离（AI已在office_changes中dismiss）
      // 如果AI没有dismiss，这里补上
      (function _checkMourn(nodes) {
        nodes.forEach(function(n) {
          (n.positions||[]).forEach(function(p) {
            if (p.holder === c.name && !c._mourningDismissed) {
              c._mourningOldPost = { dept: n.name, pos: p.name, rank: p.rank };
              // 不直接清除holder——让AI在office_changes中处理
              // 但标记以便AI prompt知道
              c._mourningDismissed = true;
            }
          });
          if (n.subs) _checkMourn(n.subs);
        });
      })(GM.officeTree||[]);
    }
  });

  // 2. 考课周期提醒（在AI prompt中已注入，此处记录触发状态）
  if (GM.turn > 0 && GM.turn % 5 === 0) {
    if (!GM._lastEvalTurn || GM._lastEvalTurn < GM.turn - 3) {
      GM._lastEvalTurn = GM.turn;
      if (typeof addEB === 'function') addEB('官制', '考课之期——吏部应对百官考评');
    }
  }
}

function renderGameState(){
  // 旧 UI
  renderLeftPanel();
  renderBarResources();

  // 中间面板（游戏主体）
  var gc=_$("gc");if(!gc)return;
  gc.innerHTML="";

  // 标签栏
  var tabBar=document.createElement("div");tabBar.style.cssText="display:flex;gap:0.3rem;padding:0.5rem;background:var(--bg-2);border-bottom:1px solid var(--bdr);flex-wrap:wrap;";
  var _ti = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  var tabs=[{id:"gt-zhaozheng",label:"\u671D\u653F",icon:'office'},{id:"gt-edict",label:"\u8BCF\u4EE4",icon:'scroll'},{id:"gt-memorial",label:"\u594F\u758F",icon:'memorial'},{id:"gt-wendui",label:"\u95EE\u5BF9",icon:'dialogue'},{id:"gt-letter",label:"\u9E3F\u96C1",icon:'scroll'},{id:"gt-biannian",label:"\u7F16\u5E74",icon:'chronicle'},{id:"gt-office",label:"\u5B98\u5236",icon:'office'},{id:"gt-wenyuan",label:"\u6587\u82D1",icon:'scroll'},{id:"gt-qiju",label:"\u8D77\u5C45\u6CE8",icon:'qiju'},{id:"gt-jishi",label:"\u7EAA\u4E8B",icon:'event'},{id:"gt-shiji",label:"\u53F2\u8BB0",icon:'history'},{id:"gt-chaoyi",label:"\u671D\u8BAE",icon:'dialogue',action:'openChaoyi'},{id:"gt-keju",label:"\u79D1\u4E3E",icon:'scroll',action:'openKejuPanel'}];
  tabs.forEach(function(t,i){
    var btn=document.createElement("button");btn.className="g-tab-btn"+(i===0?" active":"");btn.innerHTML=_ti(t.icon,13)+' '+t.label;
    if (t.action) {
      // 动作型标签（朝议/科举等）——点击触发函数而非切换面板
      btn.onclick=function(){ if(typeof window[t.action]==='function') window[t.action](); };
    } else {
      btn.onclick=function(){
        switchGTab(btn,t.id);
        if(t.id==='gt-zhaozheng'){var zp=_$('gt-zhaozheng');if(zp)zp.innerHTML=_renderZhaozhengCenter();}
      };
    }
    tabBar.appendChild(btn);
  });
  gc.appendChild(tabBar);

  // 2.5: 朝政中心面板
  var zzP=document.createElement("div");zzP.className="g-tab-panel";zzP.id="gt-zhaozheng";zzP.style.cssText="flex:1;overflow-y:auto;padding:1rem;display:block;";
  zzP.innerHTML=_renderZhaozhengCenter();
  gc.appendChild(zzP);

  // 诏令面板
  var edictP=document.createElement("div");edictP.className="g-tab-panel";edictP.id="gt-edict";edictP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
  // 诏令区标题——根据玩家角色身份动态调整称谓
  var _edictRole='天子';
  var _sc2=findScenarioById&&findScenarioById(GM.sid);
  if(_sc2){
    var _r=_sc2.role||'';
    if(_r.indexOf('王')>=0||_r.indexOf('侯')>=0) _edictRole=_r;
    else if(_r) _edictRole=_r;
  }
  var _ei = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  // 诏令5类·含圆形字符徽章+宋体提示词
  var _edictCats = [
    {id:'edict-pol', label:'政 令', badge:'政', cls:'ed-c-pol', hint:'改革官制·任免官员·降旨安抚',  placeholder:'诏谕天下，如：改革官制、降旨安抚、任免官员……'},
    {id:'edict-mil', label:'军 令', badge:'军', cls:'ed-c-mil', hint:'调兵遣将·加强边防·讨伐叛贼',  placeholder:'调兵遣将，如：调动军队、加强边防、讨伐叛贼……'},
    {id:'edict-dip', label:'外 交', badge:'外', cls:'ed-c-dip', hint:'遣使和亲·结盟讨伐·册封藩属',  placeholder:'纵横捭阖，如：遣使和亲、结盟讨伐、册封藩属……'},
    {id:'edict-eco', label:'经 济', badge:'经', cls:'ed-c-eco', hint:'减税轻赋·开仓放粮·兴修水利',  placeholder:'经纶民生，如：减税轻赋、开仓放粮、兴修水利……'},
    {id:'edict-oth', label:'其 他', badge:'他', cls:'ed-c-oth', hint:'大赦·科举·建造·礼仪',          placeholder:'其他旨意，如：大赦天下、科举取士、建造宫殿……'}
  ];
  var edictHTML = '<div class="ed-panel-wrap" style="padding:var(--space-4) var(--space-5);">';

  // ═══ 左右并排布局 ═══
  edictHTML += '<div style="display:flex;gap:var(--space-5);align-items:flex-start;position:relative;z-index:1;">';

  // ── 左侧：建议库 ──
  edictHTML += '<div style="width:260px;flex-shrink:0;align-self:flex-start;position:sticky;top:20px;">';
  edictHTML += '<div class="ed-sug-title-wrap"><span class="ed-sug-title">\u8BAE \u4E8B \u6E05 \u518C</span></div>';
  edictHTML += '<div id="edict-sug-sidebar" style="display:flex;flex-direction:column;gap:8px;max-height:70vh;overflow-y:auto;padding-right:4px;"></div>';
  edictHTML += '</div>';

  // ── 右侧：诏书编辑区 ──
  edictHTML += '<div style="flex:1;min-width:0;">';

  // 御笔标题 + 朱砂印章
  edictHTML += '<div class="ed-yubi-title">';
  edictHTML += '<div class="seal">'+escHtml(_edictRole)+'</div>';
  edictHTML += '<div class="main">' + escHtml(_edictRole) + ' \u5FA1 \u7B14</div>';
  edictHTML += '<div class="sub">\u5949\u5929\u627F\u8FD0\u7687\u5E1D\u3000\u3000\u8BCF\u66F0</div>';
  edictHTML += '</div>';

  // 5 类诏令卡片
  edictHTML += '<div class="ed-cards">';
  _edictCats.forEach(function(cat) {
    edictHTML += '<div class="ed-card '+cat.cls+'">';
    edictHTML += '<div class="ed-card-hdr">';
    edictHTML += '<span class="ed-cat-icon">'+cat.badge+'</span>';
    edictHTML += '<span class="ed-cat-label">'+cat.label+'</span>';
    edictHTML += '<span class="ed-cat-hint">'+cat.hint+'</span>';
    edictHTML += '</div>';
    edictHTML += '<textarea id="'+cat.id+'" rows="2" class="edict-input paper-texture" placeholder="'+cat.placeholder+'" oninput="_edictLiveForecast(\''+cat.id+'\')"></textarea>';
    edictHTML += '<div id="'+cat.id+'-forecast" class="ed-forecast" style="display:none;"></div>';
    edictHTML += '</div>';
  });
  edictHTML += '</div>';

  // 建议库动态渲染
  _renderEdictSuggestions();

  // 润色控制行
  edictHTML += '<div class="ed-polish-bar">';
  edictHTML += '<span class="ed-polish-label">\u6587 \u98CE \u9009 \u62E9</span>';
  edictHTML += '<select id="edict-polish-style" style="font-size:12px;padding:6px 12px;background:var(--color-elevated);border:1px solid var(--color-border-subtle);color:var(--color-foreground);border-radius:2px;font-family:var(--font-serif);cursor:pointer;">';
  edictHTML += '<option value="elegant">\u5178\u96C5\u9A88\u6587</option>';
  edictHTML += '<option value="concise">\u7B80\u6D01\u660E\u5FEB</option>';
  edictHTML += '<option value="ornate">\u534E\u4E3D\u6587\u85FB</option>';
  edictHTML += '<option value="plain">\u767D\u8BDD\u6587\u8A00</option>';
  edictHTML += '</select>';
  edictHTML += '<button class="ed-polish-btn" onclick="_polishEdicts()">\u6709 \u53F8 \u6DA6 \u8272</button>';
  edictHTML += '</div>';

  // 润色结果区
  edictHTML += '<div id="edict-polished" style="display:none;margin-top:var(--space-3);"></div>';

  // 主角行止
  edictHTML += '<div class="ed-section-divider"><span class="label">\u4E3B \u89D2 \u884C \u6B62</span></div>';
  edictHTML += '<div class="ed-xinglu-card">';
  edictHTML += '<div class="ed-xinglu-hdr">';
  edictHTML += '<span class="title">\u672C \u56DE \u5408 \u884C \u52A8</span>';
  edictHTML += '<span class="desc">\u2014\u2014\u4F60\u8FD9\u6BB5\u65F6\u95F4\u505A\u4E86\u4EC0\u4E48</span>';
  edictHTML += '</div>';
  edictHTML += '<textarea id="xinglu-pub" rows="4" class="edict-input paper-texture" placeholder="\u5982\uFF1A\u53EC\u89C1\u67D0\u81E3\u3001\u6821\u9605\u4E09\u519B\u3001\u5FAE\u670D\u79C1\u8BBF\u3001\u591C\u8BFB\u53F2\u4E66\u3001\u7956\u5E99\u796D\u7940\u3001\u5BB4\u8BF7\u7FA4\u81E3\u2026\u2026"></textarea>';

  // 行止历史
  if (GM.qijuHistory && GM.qijuHistory.length > 1) {
    var _recentXl = GM.qijuHistory.filter(function(q) { return q.xinglu && q.turn < GM.turn; }).slice(-5).reverse();
    if (_recentXl.length > 0) {
      edictHTML += '<details class="ed-xinglu-hist">';
      edictHTML += '<summary>\u8FD1\u671F\u884C\u6B62\u8BB0\u5F55 <span style="color:var(--ink-300);margin-left:6px;font-size:10px;">' + _recentXl.length + ' \u6761</span></summary>';
      edictHTML += '<div style="margin-top:10px;max-height:200px;overflow-y:auto;">';
      _recentXl.forEach(function(q) {
        edictHTML += '<div class="ed-xinglu-hist-item"><span class="turn">T' + q.turn + '</span>' + escHtml(q.xinglu) + '</div>';
      });
      edictHTML += '</div></details>';
    }
  }
  edictHTML += '</div>'; // ed-xinglu-card

  // 帝王私行
  edictHTML += '<div class="ed-tyrant-block">';
  edictHTML += '<div class="ed-tyrant-toggle" onclick="var p=_$(\'tyrant-panel\');if(p){p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.classList.toggle(\'open\');if(p.style.display!==\'none\'&&typeof TyrantActivitySystem!==\'undefined\')TyrantActivitySystem.renderPanel();}">';
  edictHTML += '\u5E1D \u738B \u79C1 \u884C';
  edictHTML += '<span class="sub">\u2014\u2014 \u70B9\u51FB\u5C55\u5F00\uFF08\u540E\u5983\u00B7\u6E38\u730E\u00B7\u4E39\u836F\u00B7\u5BC6\u8BBF\uFF09</span>';
  edictHTML += '</div>';
  edictHTML += '<div id="tyrant-panel" style="display:none;max-height:300px;overflow-y:auto;padding:var(--space-2);margin-top:var(--space-2);"></div>';
  edictHTML += '</div>';
  // 往期诏令档案
  if (GM._edictTracker && GM._edictTracker.length > 0) {
    var _allEdicts = GM._edictTracker.filter(function(e) { return e.turn < GM.turn; });
    if (_allEdicts.length > 0) {
      // 按回合分组
      var _edictByTurn = {};
      _allEdicts.forEach(function(e) { if (!_edictByTurn[e.turn]) _edictByTurn[e.turn] = []; _edictByTurn[e.turn].push(e); });
      var _edictTurns = Object.keys(_edictByTurn).sort(function(a,b){ return b-a; });
      edictHTML += '<details class="ed-archive">';
      edictHTML += '<summary>\u5F80 \u671F \u8BCF \u4EE4 \u6863 \u6848 \u00B7 ' + _allEdicts.length + ' \u6761</summary>';
      edictHTML += '<div style="margin-top:var(--space-2);max-height:400px;overflow-y:auto;">';
      _edictTurns.forEach(function(turn) {
        var edicts = _edictByTurn[turn];
        var _tsText = typeof getTSText === 'function' ? getTSText(parseInt(turn)) : 'T' + turn;
        edictHTML += '<div class="ed-archive-group">';
        edictHTML += '<div class="ed-archive-group-title">\u7B2C' + turn + '\u56DE\u5408 \u00B7 ' + _tsText + '</div>';
        edicts.forEach(function(e) {
          var _sc = e.status === 'completed' ? 'var(--celadon-400)' : e.status === 'obstructed' ? 'var(--vermillion-400)' : e.status === 'partial' ? '#e67e22' : e.status === 'pending_delivery' ? 'var(--amber-400)' : 'var(--ink-300)';
          var _sl = {completed:'\u2705', obstructed:'\u274C', partial:'\u26A0\uFE0F', executing:'\u23F3', pending:'\u2B55', pending_delivery:'\uD83D\uDCE8'}[e.status] || '';
          edictHTML += '<div style="font-size:var(--text-xs);padding:2px 0;border-bottom:1px solid var(--color-border-subtle);">';
          edictHTML += '<span style="color:' + _sc + ';">' + _sl + '</span> ';
          edictHTML += '<span style="color:var(--color-foreground-muted);">' + escHtml(e.category) + '</span> ';
          edictHTML += escHtml(e.content);
          if (e.assignee) edictHTML += ' <span style="color:var(--ink-300);">[\u6267\u884C:' + escHtml(e.assignee) + ']</span>';
          // 远方送达状态
          if (e._remoteTargets && e._remoteTargets.length > 0) {
            var _ltStatuses = (e._letterIds||[]).map(function(lid) {
              var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
              if (!lt) return null;
              var _name = lt.to || '';
              if (lt.status === 'traveling') return _name + ':信使在途';
              if (lt.status === 'delivered' || lt.status === 'replying') return _name + ':已送达';
              if (lt.status === 'returned') return _name + ':已送达且回函';
              if (lt.status === 'intercepted') return _name + ':⚠信使失踪';
              if (lt.status === 'recalled') return _name + ':已追回';
              return _name + ':' + (lt.status||'?');
            }).filter(Boolean);
            if (_ltStatuses.length > 0) {
              edictHTML += '<div style="font-size:0.6rem;color:var(--amber-400);padding-left:1rem;">传书：' + _ltStatuses.join(' | ') + '</div>';
            }
          }
          if (e.feedback) edictHTML += '<div style="color:var(--color-foreground-secondary);padding-left:1rem;">' + escHtml(e.feedback) + '</div>';
          edictHTML += '</div>';
        });
        edictHTML += '</div>';
      });
      edictHTML += '</div></details>';
    }
  }

  // 结束回合按钮
  edictHTML += '<div class="ed-action-bar">';
  edictHTML += '<button class="bt bp" id="btn-end" onclick="confirmEndTurn()" style="padding:var(--space-3) var(--space-8);font-size:var(--text-md);letter-spacing:0.15em;border:2px solid var(--gold-400);box-shadow:0 2px 12px rgba(184,154,83,0.2);">'+_ei('end-turn',16)+' 静待时变</button>';
  edictHTML += '<button class="bt" onclick="openMapViewer()" style="padding:var(--space-3) var(--space-6);font-size:var(--text-md);">'+_ei('map',16)+' 查看地图</button>';
  edictHTML += '</div>';
  edictHTML += '</div>'; // 关闭右侧诏书编辑区
  edictHTML += '</div>'; // 关闭左右并排 flex 容器
  edictHTML += '</div>'; // 关闭 ed-panel-wrap
  edictP.innerHTML = edictHTML;
  gc.appendChild(edictP);

  // 奏疏面板
  var memP=document.createElement("div");memP.className="g-tab-panel";memP.id="gt-memorial";memP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  memP.innerHTML='<div class="mem-panel-wrap"><div class="mem-inner">'
    +'<div class="mem-title"><div class="seal">\u5949<br>\u6731</div><div class="main">\u594F \u758F \u5F85 \u89C8</div><div class="sub">\u6848\u724D\u4E4B\u53F8\u3000\u3000\u767E\u5B98\u542F\u594F</div></div>'
    +'<div id="zouyi-list"></div>'
    +'</div></div>';
  gc.appendChild(memP);

  // 问对面板（仅角色选择网格，点击打开弹窗）
  var wdP=document.createElement("div");wdP.className="g-tab-panel";wdP.id="gt-wendui";wdP.style.cssText="flex:1;overflow-y:auto;padding:0;display:flex;flex-direction:column;";
  wdP.innerHTML='<div class="wdp-panel-wrap"><div class="wdp-inner">'
    +'<div class="wdp-title"><div class="seal">\u53EC\u89C1</div><div class="main">\u5FA1 \u524D \u95EE \u5BF9</div><div class="sub">\u541B\u81E3\u4E4B\u5BF9\u3000\u3000\u9762\u5723\u8BF7\u5BF9</div></div>'
    +'<div id="wendui-chars"></div>'
    +'</div></div>';
  gc.appendChild(wdP);

  // 鸿雁传书面板
  var ltP=document.createElement("div");ltP.className="g-tab-panel";ltP.id="gt-letter";ltP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  ltP.innerHTML='<div class="hy-panel-wrap"><div class="hy-inner">'
    +'<div class="hy-title"><div class="seal">\u9C7C<br>\u96C1</div><div class="main">\u9E3F \u96C1 \u4F20 \u4E66</div><div class="sub">\u7B3A\u672D\u5F80\u6765\u3000\u3000\u9A7F\u4F7F\u4F20\u9012</div></div>'
    +'<div id="letter-route-bar" class="hy-route-warn" style="display:none;"></div>'
    +'<div class="hy-main">'
    +  '<div class="hy-left">'
    +    '<div class="hy-left-header"><span class="hy-left-title">\u8FDC \u65B9 \u81E3 \u5B50</span>'
    +      '<button class="hy-multi-btn" id="lt-multi-toggle" onclick="GM._ltMultiMode=!GM._ltMultiMode;GM._ltMultiTargets=[];renderLetterPanel();">\u7FA4 \u53D1</button>'
    +    '</div>'
    +    '<div id="letter-chars" class="hy-npc-list"></div>'
    +  '</div>'
    +  '<div class="hy-center">'
    +    '<div id="letter-history"></div>'
    +    '<div class="hy-compose-area">'
    +      '<div class="hy-compose-title">\u4E66 \u672D \u62DF \u7A3F<span class="target" id="lt-compose-target">\uFF08\u9009\u62E9\u53D7\u4FE1\u4EBA\uFF09</span></div>'
    +      '<div class="hy-compose-row">'
    +        '<select id="letter-type"><option value="secret_decree">\u5BC6\u65E8</option><option value="military_order">\u5F81\u8C03\u4EE4</option><option value="greeting">\u95EE\u5B89\u51FD</option><option value="personal" selected>\u79C1\u51FD</option><option value="proclamation">\u6A84\u6587</option></select>'
    +        '<select id="letter-urgency"><option value="normal">\u666E\u901A\u9A7F\u9012\uFF08\u65E5\u884C\u4E94\u5341\u91CC\uFF09</option><option value="urgent">\u52A0\u6025\u9A7F\u9012\uFF08\u65E5\u884C\u4E09\u767E\u91CC\uFF09</option><option value="extreme">\u516B\u767E\u91CC\u52A0\u6025</option></select>'
    +      '</div>'
    +      '<div class="hy-compose-row">'
    +        '<select id="letter-cipher"><option value="none">\u4E0D\u52A0\u5BC6</option><option value="yinfu">\u9634\u7B26\uFF08\u6697\u53F7\u4F53\u7CFB\uFF09</option><option value="yinshu">\u9634\u4E66\uFF08\u62C6\u5206\u4E09\u8DEF\uFF09</option><option value="wax_ball">\u8721\u4E38\u5BC6\u51FD</option><option value="silk_sewn">\u5E1B\u4E66\u7F1D\u8863</option></select>'
    +        '<select id="letter-sendmode"><option value="normal">\u666E\u901A\u4FE1\u4F7F</option><option value="multi_courier">\u591A\u8DEF\u4FE1\u4F7F\uFF08\u622A\u83B7\u7387\u964D\u4F4E\uFF09</option><option value="secret_agent">\u5BC6\u4F7F\uFF08\u4E0D\u8D70\u9A7F\u7AD9\uFF09</option></select>'
    +      '</div>'
    +      '<div class="hy-compose-row" id="lt-agent-row" style="display:none;"><label style="font-size:12px;color:var(--color-foreground-muted);align-self:center;">\u5BC6\u4F7F\u4EBA\u9009\uFF1A</label><select id="letter-agent"></select></div>'
    +      '<textarea id="letter-textarea" class="hy-compose-paper" placeholder="\u81F4\u4E66\u8FDC\u65B9\u81E3\u5B50\u2026\u2026" rows="4"></textarea>'
    +      '<div class="hy-compose-bot">'
    +        '<span class="hy-compose-hint">\u203B \u52A0\u5BC6/\u5BC6\u4F7F\u964D\u4F4E\u622A\u83B7\u7387\uFF1B\u516B\u767E\u91CC\u52A0\u6025\u8017\u8D39\u66F4\u591A\u90AE\u8D39</span>'
    +        '<button class="hy-send-btn" onclick="sendLetter()">\u9063 \u4F7F</button>'
    +      '</div>'
    +    '</div>'
    +  '</div>'
    +'</div>'
    +'</div></div>';
  gc.appendChild(ltP);
  // 密使选择器联动
  var _smSel = ltP.querySelector('#letter-sendmode');
  if (_smSel) _smSel.onchange = function() {
    var agRow = _$('lt-agent-row');
    if (this.value === 'secret_agent') {
      if (agRow) agRow.style.display = 'flex';
      var agSel = _$('letter-agent');
      if (agSel) {
        var _cap2 = GM._capital || '京城';
        var _inKy = (GM.chars||[]).filter(function(c){ return c.alive !== false && c.location === _cap2 && !c.isPlayer; });
        agSel.innerHTML = _inKy.map(function(c){ return '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + '（' + escHtml(c.title||'') + '）</option>'; }).join('');
      }
    } else { if (agRow) agRow.style.display = 'none'; }
  };

  // 编年面板
  var bnP=document.createElement("div");bnP.className="g-tab-panel";bnP.id="gt-biannian";bnP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  bnP.innerHTML='<div class="bn-panel-wrap"><div class="bn-inner">'
    +'<div class="bn-title"><div class="seal">\u7F16<br>\u5E74</div><div class="main">\u7F16 \u5E74 \u7EAA \u4E8B</div><div class="sub">\u5929\u3000\u5B50\u3000\u7EAA\u3000\u5E74\u3000\u3000\u3000\u8BF8\u4E8B\u7ECF\u5E74\u7D2F\u8F7D</div></div>'
    +'<div id="bn-active"></div>'
    +'<div class="bn-section-hdr" style="margin-top:16px;"><span class="tag">\u7F16 \u5E74 \u68C0 \u7D22</span><span class="desc">\u2014\u2014 \u6309\u5E74\u4EFD\u00B7\u7C7B\u522B\u00B7\u5173\u952E\u5B57\u8FFD\u6EAF\u5F80\u8FF9</span></div>'
    +'<div class="bn-tools">'
    +'<span class="bn-tools-label">\u67E5\u3000\u9605\uFF1A</span>'
    +'<div class="bn-search-wrap"><input id="bn-search" class="bn-search" placeholder="\u9898\u76EE\u3001\u4EBA\u540D\u3001\u5730\u70B9\u3001\u5173\u952E\u5B57\u2026\u2026" oninput="renderBiannian()"></div>'
    +'<select id="bn-filter" class="bn-filter" onchange="renderBiannian()">'
    +'<option value="all">\u5168\u90E8\u7C7B\u522B</option><option value="\u519B\u4E8B">\u519B\u4E8B</option><option value="\u653F\u6CBB">\u653F\u4E8B</option><option value="\u7ECF\u6D4E">\u7ECF\u6D4E</option><option value="\u5916\u4EA4">\u5916\u4EA4</option><option value="\u6587\u5316">\u6587\u5316</option><option value="\u4EBA\u4E8B">\u4EBA\u4E8B</option><option value="\u707E\u5F02">\u5929\u8C61\u707E\u5F02</option></select>'
    +'<button class="bn-export-btn" onclick="_bnExport()" title="\u5BFC\u51FA\u5168\u90E8\u7F16\u5E74">\u2756 \u5BFC \u51FA</button>'
    +'<span class="bn-tools-stat" id="bn-tools-stat"></span>'
    +'</div>'
    +'<div class="bn-section-hdr"><span class="tag">\u7F16 \u5E74 \u53F2 \u518C</span><span class="desc">\u2014\u2014 \u65E2\u5F80\u4E4B\u4E8B\u00B7\u6C38\u4E45\u5B58\u5F55</span></div>'
    +'<div class="bn-chronicle-wrap"><div id="biannian-list"></div></div>'
    +'</div></div>';
  gc.appendChild(bnP);

  // 官制面板
  var offP=document.createElement("div");offP.className="g-tab-panel";offP.id="gt-office";offP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  offP.innerHTML='<div class="og-panel-wrap"><div class="og-inner">'
    +'<div class="og-title"><div class="seal">\u5B98<br>\u5236</div><div class="main">\u516D \u90E8 \u537F \u5BFA</div><div class="sub">\u8862\u3000\u95E8\u3000\u804C\u3000\u5B98\u3000\u3000\u3000\u3000\u73ED\u3000\u4F4D\u3000\u5404\u3000\u53F8\u3000\u5176\u3000\u804C</div></div>'

    // 总览区
    +'<div class="og-section-hdr">'
    +'<span class="tag">\u8862 \u95E8 \u603B \u89C8</span>'
    +'<span class="desc">\u2014\u2014 \u7F16\u5236\u00B7\u6743\u529B\u683C\u5C40\u00B7\u4FF8\u7984\u5F00\u652F</span>'
    +'<span class="act">'
    +'<button class="og-hdr-btn" onclick="_offReformToEdict(\'add_dept\',\'\')">\u589E \u8BBE \u90E8 \u95E8</button>'
    +'<button class="og-hdr-btn primary" onclick="if(typeof _offOpenZhongtui===\'function\')_offOpenZhongtui();else toast(\'\u8350\u8D24\u5EF7\u63A8\u9700\u5148\u9009\u4E2D\u804C\u4F4D\')">\u8350 \u8D24 \u5EF7 \u63A8</button>'
    +'</span>'
    +'</div>'

    // 预警 + 摘要
    +'<div id="office-alerts" class="og-alerts"></div>'
    +'<div id="office-summary" class="og-summary-grid"></div>'

    // 树
    +'<div class="og-section-hdr">'
    +'<span class="tag">\u8862 \u95E8 \u5C42 \u7EA7</span>'
    +'<span class="desc">\u2014\u2014 \u9F20\u8F6E\u7F29\u653E\u00B7\u62D6\u62FD\u5E73\u79FB\u00B7\u70B9\u51FB\u5361\u7247\u5C55\u5F00\u8BE6\u60C5</span>'
    +'</div>'
    +'<div class="og-tree-topbar">'
    +'<span class="title-bar">\u56FE \u4F8B</span>'
    +'<span style="font-size:11px;color:var(--ink-300);letter-spacing:0.05em;display:inline-flex;align-items:center;gap:8px;">'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:#e4c579;border-radius:1px;"></span>\u6B63\u4E00\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--gold-400);border-radius:1px;"></span>\u4E8C\u4E09\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--celadon-400);border-radius:1px;"></span>\u56DB\u4E94\u54C1</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:3px;height:14px;background:var(--ink-500);border-radius:1px;"></span>\u516D\u54C1\u4EE5\u4E0B</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--amber-400);"></span>\u4E45\u4EFB</span>'
    +'<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--vermillion-400);"></span>\u4E0D\u6EE1\u00B7\u7F3A\u5458</span>'
    +'</span>'
    +'</div>'
    +'<div id="office-tree"></div>'
    +'</div></div>';
  gc.appendChild(offP);

  // 文苑面板（文事作品库）
  var wyP=document.createElement("div");wyP.className="g-tab-panel";wyP.id="gt-wenyuan";wyP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  wyP.innerHTML='<div class="wy-panel-wrap"><div class="wy-inner">'
    +'<div class="wy-title"><div class="seal">\u6587<br>\u82D1</div><div class="main">\u6587 \u82D1 \u00B7 \u8BD7 \u6587 \u603B \u96C6</div><div class="sub">\u8BD7 \u8BCD \u6B4C \u8D4B\u3000\u3000\u5E8F \u8DCB \u8BB0 \u94ED\u3000\u3000\u7ECF \u4E16 \u98CE \u96C5</div></div>'
    +'<div id="wy-statbar" class="wy-statbar"></div>'
    +'<div class="wy-tools">'
    +'<span class="wy-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="wy-search-wrap"><input id="wy-search" class="wy-search" placeholder="\u641C\u7D22\u4F5C\u8005\u00B7\u6807\u9898\u00B7\u8BD7\u6587\u2026" oninput="renderWenyuan()"></div>'
    +'<select id="wy-cat-filter" class="wy-filter" onchange="renderWenyuan()"><option value="all">\u5168\u90E8\u89E6\u53D1</option><option value="career">\u79D1\u4E3E\u5B98\u9014</option><option value="adversity">\u9006\u5883\u8D2C\u8C2A</option><option value="social">\u793E\u4EA4\u916C\u9154</option><option value="duty">\u4EFB\u4E0A\u65BD\u653F</option><option value="travel">\u6E38\u5386\u5C71\u6C34</option><option value="private">\u5BB6\u4E8B\u79C1\u60C5</option><option value="times">\u65F6\u5C40\u5929\u4E0B</option><option value="mood">\u60C5\u611F\u5FC3\u5883</option></select>'
    +'<select id="wy-genre-filter" class="wy-filter" onchange="renderWenyuan()"><option value="all">\u5168\u90E8\u6587\u4F53</option><option value="shi">\u8BD7</option><option value="ci">\u8BCD</option><option value="fu">\u8D4B</option><option value="qu">\u66F2</option><option value="ge">\u6B4C\u884C</option><option value="wen">\u6563\u6587</option><option value="apply">\u5E94\u7528\u6587</option><option value="ji">\u8BB0\u53D9\u6587</option><option value="ritual">\u796D\u6587\u7891\u94ED</option><option value="paratext">\u5E8F\u8DCB</option></select>'
    +'<select id="wy-sort" class="wy-filter" onchange="renderWenyuan()"><option value="recent">\u6392\uFF1A\u8FD1\u4F5C</option><option value="quality">\u6392\uFF1A\u54C1\u8BC4</option><option value="author">\u6392\uFF1A\u4F5C\u8005</option><option value="date">\u6392\uFF1A\u5E74\u4EE3</option></select>'
    +'<label class="wy-chk"><input type="checkbox" id="wy-preserved-only" onchange="renderWenyuan()">\u4EC5\u4F20\u4E16</label>'
    +'<label class="wy-chk"><input type="checkbox" id="wy-hide-forbidden" onchange="renderWenyuan()">\u9690\u67E5\u7981</label>'
    +'</div>'
    +'<div id="wy-legend" class="wy-legend"></div>'
    +'<div id="wenyuan-list" class="wy-grid"></div>'
    +'</div></div>';
  gc.appendChild(wyP);

  // 起居注面板
  var qjP=document.createElement("div");qjP.className="g-tab-panel";qjP.id="gt-qiju";qjP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  qjP.innerHTML='<div class="qj-panel-wrap"><div class="qj-inner">'
    +'<div class="qj-title"><div class="seal">\u8D77<br>\u5C45<br>\u6CE8</div><div class="main">\u8D77\u3000\u5C45\u3000\u6CE8</div><div class="sub">\u4E00 \u65E5 \u4E00 \u5F55\u3000\u3000\u8D77 \u5C45 \u996E \u98DF \u8A00 \u52A8 \u5FC5 \u4E66\u3000\u3000\u85CF \u4E4B \u91D1 \u532E \u77F3 \u5BA4</div></div>'
    +'<div id="qj-statbar" class="qj-statbar"></div>'
    +'<div class="qj-tools">'
    +'<span class="qj-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="qj-search-wrap"><input id="qj-search" class="qj-search" placeholder="\u641C\u7D22\u8D77\u5C45\u6CE8\u00B7\u65E5\u671F\u00B7\u4EBA\u540D\u2026" oninput="_qijuKw=this.value;_qijuPage=0;renderQiju()"></div>'
    +'<select id="qj-cat-filter" class="qj-filter" onchange="_qijuCat=this.value;_qijuPage=0;renderQiju()">'
    +'<option value="all">\u5168\u90E8\u7C7B\u522B</option><option value="\u8BCF\u4EE4">\u8BCF\u4EE4</option><option value="\u594F\u758F">\u594F\u758F</option><option value="\u671D\u8BAE">\u671D\u8BAE</option><option value="\u9E3F\u96C1">\u9E3F\u96C1</option><option value="\u4EBA\u4E8B">\u4EBA\u4E8B</option><option value="\u884C\u6B62">\u884C\u6B62</option><option value="\u53D9\u4E8B">\u53D9\u4E8B</option></select>'
    +'<select id="qj-sort" class="qj-filter" onchange="_qijuSort=this.value;_qijuPage=0;renderQiju()"><option value="recent">\u6392\uFF1A\u8FD1\u65E5 \u2193</option><option value="old">\u6392\uFF1A\u65E7\u65E5 \u2191</option><option value="annot">\u6392\uFF1A\u5FA1\u6279\u5148</option></select>'
    +'<label class="qj-chk"><input type="checkbox" id="qj-annot-only" onchange="_qijuAnnotOnly=this.checked;_qijuPage=0;renderQiju()">\u4EC5\u5FA1\u6279</label>'
    +'<label class="qj-chk"><input type="checkbox" id="qj-collapse-narr" onchange="_qijuCollapseNarr=this.checked;renderQiju()">\u6298\u53E0\u53D9\u4E8B</label>'
    +'<button class="qj-export" onclick="_qijuExport()">\u5BFC \u51FA \u7F16 \u5E74</button>'
    +'</div>'
    +'<div id="qj-legend" class="qj-legend"></div>'
    +'<div id="qiju-history"></div>'
    +'</div></div>';
  gc.appendChild(qjP);

  // 纪事面板
  var jsP=document.createElement("div");jsP.className="g-tab-panel";jsP.id="gt-jishi";jsP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  jsP.innerHTML='<div class="ji-panel-wrap"><div class="ji-inner">'
    +'<div class="ji-title"><div class="seal">\u7EAA<br>\u4E8B</div><div class="main">\u7EAA \u4E8B \u672C \u672B</div><div class="sub">\u4EE5 \u4E8B \u7CFB \u65E5\u3000\u3000\u4EE5 \u65E5 \u7CFB \u6708\u3000\u3000\u4EE5 \u6708 \u7CFB \u65F6\u3000\u3000\u4EE5 \u65F6 \u7CFB \u5E74</div></div>'
    +'<div id="jishi-statbar" class="ji-statbar"></div>'
    +'<div class="ji-tools">'
    +'<span class="ji-tools-lbl">\u62AB\u3000\u89C8</span>'
    +'<div class="ji-view-switch">'
    +'<button class="ji-view-btn active" id="js-view-time" onclick="_jishiView=\'time\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u65F6 \u95F4 \u7EBF</button>'
    +'<button class="ji-view-btn" id="js-view-char" onclick="_jishiView=\'char\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u6309 \u4EBA \u7269</button>'
    +'<button class="ji-view-btn" id="js-view-type" onclick="_jishiView=\'type\';_jishiPage=0;document.querySelectorAll(\'.ji-view-btn\').forEach(function(b){b.classList.remove(\'active\');});this.classList.add(\'active\');renderJishi();">\u6309 \u4E8B \u7C7B</button>'
    +'</div>'
    +'<div class="ji-search-wrap"><input id="jishi-kw" class="ji-search" placeholder="\u641C\u7D22\u8BAE\u9898\u00B7\u4EBA\u7269\u00B7\u5BF9\u8BDD\u2026\u2026" oninput="_jishiKw=this.value;_jishiPage=0;renderJishi();"></div>'
    +'<select id="jishi-char-filter" class="ji-filter" onchange="_jishiCharFilter=this.value;_jishiPage=0;renderJishi();"><option value="all">\u5168\u90E8\u4EBA\u7269</option></select>'
    +'<button class="ji-star-btn" onclick="_jishiToggleStarred()" id="js-star-toggle" title="\u4EC5\u770B\u661F\u6807">\u2606</button>'
    +'<button class="ji-export-btn" onclick="_jishiExport()" title="\u5BFC\u51FA\u7EB5\u7EAA\u5B8C\u6574\u8BB0\u5F55">\u5BFC \u51FA</button>'
    +'</div>'
    +'<div id="jishi-legend" class="ji-legend"></div>'
    +'<div id="jishi-list"></div>'
    +'</div></div>';
  gc.appendChild(jsP);

  // 史记面板
  var sjP=document.createElement("div");sjP.className="g-tab-panel";sjP.id="gt-shiji";sjP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  sjP.innerHTML='<div class="sj-panel-wrap"><div class="sj-inner">'
    +'<div class="sj-title"><div class="seal">\u53F2<br>\u8BB0</div><div class="main">\u53F2 \u8BB0 \u672C \u7EAA</div><div class="sub">\u7A76 \u5929 \u4EBA \u4E4B \u9645\u3000\u901A \u53E4 \u4ECA \u4E4B \u53D8\u3000\u6210 \u4E00 \u5BB6 \u4E4B \u8A00</div></div>'
    +'<div id="shiji-list"></div>'
    +'</div></div>';
  gc.appendChild(sjP);

  // 科技树面板（条件显示）
  if(P.systems && P.systems.techTree!==false){
    var _techBtn=document.createElement("button");_techBtn.className="g-tab-btn";_techBtn.innerHTML=_ti('scroll',13)+' \u79D1\u6280';
    _techBtn.onclick=function(){switchGTab(_techBtn,"gt-tech");};tabBar.appendChild(_techBtn);
    var _techP=document.createElement("div");_techP.className="g-tab-panel";_techP.id="gt-tech";_techP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
    _techP.innerHTML='<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u79D1\u6280</div><div id="g-tech"></div>';
    gc.appendChild(_techP);
  }
  // 市政树面板（条件显示）
  if(P.systems && P.systems.civicTree!==false){
    var _civicBtn=document.createElement("button");_civicBtn.className="g-tab-btn";_civicBtn.innerHTML=_ti('office',13)+' \u5E02\u653F';
    _civicBtn.onclick=function(){switchGTab(_civicBtn,"gt-civic");};tabBar.appendChild(_civicBtn);
    var _civicP=document.createElement("div");_civicP.className="g-tab-panel";_civicP.id="gt-civic";_civicP.style.cssText="flex:1;overflow-y:auto;padding:1rem;";
    _civicP.innerHTML='<div style="font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u5E02\u653F</div><div id="g-civic"></div>';
    gc.appendChild(_civicP);
  }
  // 人物志面板
  var _rwBtn=document.createElement("button");_rwBtn.className="g-tab-btn";_rwBtn.innerHTML=_ti('person',13)+' \u4EBA\u7269\u5FD7';
  _rwBtn.onclick=function(){switchGTab(_rwBtn,"gt-renwu");};tabBar.appendChild(_rwBtn);
  var _rwP=document.createElement("div");_rwP.className="g-tab-panel";_rwP.id="gt-renwu";_rwP.style.cssText="flex:1;overflow-y:auto;padding:0;";
  _rwP.innerHTML='<div class="rw-panel-wrap"><div class="rw-inner">'
    +'<div class="rw-title"><div class="seal">\u4EBA<br>\u7269</div><div class="main">\u4EBA \u7269 \u5FD7</div><div class="sub">\u82F1 \u6770 \u5217 \u4F20\u3000\u3000\u81E7 \u5426 \u54C1 \u8BC4</div></div>'
    +'<div id="rw-statbar" class="rw-statbar"></div>'
    +'<div class="rw-tools">'
    +'<span class="rw-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="rw-search-wrap"><input id="rw-search" class="rw-search" placeholder="\u641C\u7D22\u59D3\u540D\u00B7\u5B57\u53F7\u00B7\u5B98\u804C\u2026" oninput="_rwSearch=this.value;renderRenwu();"></div>'
    +'<select id="rw-faction" class="rw-filter" onchange="_rwFaction=this.value;renderRenwu();"><option value="all">\u5168\u90E8\u6D3E\u7CFB</option></select>'
    +'<select id="rw-role" class="rw-filter" onchange="_rwRole=this.value;renderRenwu();"><option value="all">\u5168\u90E8\u8EAB\u4EFD</option><option value="civil">\u6587\u81E3</option><option value="military">\u6B66\u5C06</option><option value="harem">\u540E\u5BAB</option><option value="none">\u5E03\u8863</option></select>'
    +'<select id="rw-sort" class="rw-filter" onchange="_rwSort=this.value;renderRenwu();"><option value="loyalty">\u6392\uFF1A\u5FE0\u8BDA</option><option value="intelligence">\u6392\uFF1A\u667A\u529B</option><option value="administration">\u6392\uFF1A\u653F\u52A1</option><option value="military">\u6392\uFF1A\u519B\u4E8B</option><option value="ambition">\u6392\uFF1A\u91CE\u5FC3</option></select>'
    +'<label class="rw-chk"><input type="checkbox" id="rw-dead" onchange="_rwShowDead=this.checked;renderRenwu();">\u663E \u5DF2 \u6B81</label>'
    +'</div>'
    +'<div id="rw-legend" class="rw-legend"></div>'
    +'<div id="rw-grid" class="rw-grid"></div>'
    +'</div></div>';
  gc.appendChild(_rwP);

  // P3: 省份民情面板（地方舆情）
  if (P.adminHierarchy) {
    var _dfBtn=document.createElement("button");_dfBtn.className="g-tab-btn";_dfBtn.innerHTML=_ti('faction',13)+' \u5730\u65B9';
    _dfBtn.onclick=function(){switchGTab(_dfBtn,"gt-difang");_renderDifangPanel();};tabBar.appendChild(_dfBtn);
    var _dfP=document.createElement("div");_dfP.className="g-tab-panel";_dfP.id="gt-difang";_dfP.style.cssText="flex:1;overflow-y:auto;padding:0;";
    _dfP.innerHTML='<div class="df-panel-wrap"><div class="df-inner">'
      +'<div class="df-title"><div class="seal">\u5730<br>\u65B9</div><div class="main">\u5730 \u65B9 \u8206 \u60C5</div><div class="sub">\u4E00 \u7701 \u4E00 \u6C11 \u60C5\u3000\u3000\u6309 \u5BDF \u629A \u6C11 \u00B7 \u5B89 \u6C11 \u4E3A \u672C</div></div>'
      +'<div id="df-statbar" class="df-statbar"></div>'
      +'<div class="df-tools">'
      +'<span class="df-tools-lbl">\u6309 \u5BDF</span>'
      +'<div class="df-search-wrap"><input id="df-search" class="df-search" placeholder="\u641C\u7D22\u5730\u540D\u00B7\u5B98\u540D\u00B7\u4E8B\u7531\u2026\u2026" oninput="_dfSearch=this.value;_renderDifangPanel();"></div>'
      +'<select id="df-sort" class="df-filter" onchange="_dfSort=this.value;_renderDifangPanel();"><option value="name">\u6392\uFF1A\u540D\u79F0</option><option value="unrest">\u6392\uFF1A\u6C11\u53D8 \u2191</option><option value="corruption">\u6392\uFF1A\u8150\u8D25 \u2191</option><option value="population">\u6392\uFF1A\u4EBA\u53E3 \u2193</option><option value="tax">\u6392\uFF1A\u7A0E\u6536 \u2193</option></select>'
      +'<label class="df-chk"><input type="checkbox" id="df-crisis" onchange="_dfCrisis=this.checked;_renderDifangPanel();">\u26A0 \u4EC5 \u5371 \u673A</label>'
      +'<button class="df-export" onclick="if(typeof openProvinceEconomy===\'function\')openProvinceEconomy();">\u8BE6 \u7EC6 \u533A \u5212</button>'
      +'</div>'
      +'<div id="df-legend" class="df-legend"></div>'
      +'<div id="df-alerts" class="df-alerts" style="display:none;"></div>'
      +'<div id="difang-grid" class="df-grid"></div>'
      +'</div></div>';
    gc.appendChild(_dfP);
  }

  // 右侧面板——增强角色卡片
  var gr=_$("gr");if(gr){
    var _charList = (GM.chars || []).filter(function(c){return c.alive!==false;});
    // 7.3: 角色列表分页——超过30人时先显示前30，可展开全部
    var _charPageLimit = 30;
    var _charShowAll = gr._showAllChars || false;
    var _charDisplayList = (!_charShowAll && _charList.length > _charPageLimit) ? _charList.slice(0, _charPageLimit) : _charList;
    gr.innerHTML="<div class=\"pt\" style=\"display:flex;align-items:center;gap:4px;\">"+tmIcon('person',12)+" \u4EBA\u7269 <span style=\"font-size:var(--text-xs);color:var(--color-foreground-muted);font-weight:400;margin-left:auto;\">"+_charList.length+"\u4EBA</span></div>"+
      _charDisplayList.map(function(ch){
        var loy=ch.loyalty||50;
        var loyColor=loy>70?"var(--green)":loy<30?"var(--red)":"var(--gold)";
        var loyDisp = (typeof _fmtNum1==='function') ? _fmtNum1(loy) : loy;
        var stressTag='';
        if(ch.stress&&ch.stress>40){
          stressTag=' <span style="font-size:0.62rem;padding:1px 4px;border-radius:3px;background:'+(ch.stress>60?'rgba(192,57,43,0.2)':'rgba(230,126,34,0.15)')+';color:'+(ch.stress>60?'var(--red)':'#e67e22')+';">'+(ch.stress>60?'\u5D29':'\u7126')+'</span>';
        }
        // 心情标记（中国古典方括号）
        var moodIcon='';
        if(ch._mood&&ch._mood!=='\u5E73'){
          var _moodColors={'\u559C':'var(--color-success)','\u6012':'var(--vermillion-400)','\u5FE7':'#e67e22','\u60E7':'var(--indigo-400)','\u6068':'var(--vermillion-400)','\u656C':'var(--celadon-400)'};
          moodIcon='<span style="font-size:0.6rem;color:'+(_moodColors[ch._mood]||'var(--txt-d)')+';">\u3014'+ch._mood+'\u3015</span> ';
        }
        // 野心标记
        var ambTag=(ch.ambition||50)>75?'<span style="font-size:0.58rem;color:var(--purple,#9b59b6);">\u91CE</span>':'';
        // 后宫/配偶标记
        var spouseTag='';
        if(ch.spouse){
          var _spIc = typeof getHaremRankIcon === 'function' ? getHaremRankIcon(ch.spouseRank) : '\u{1F490}';
          spouseTag=' <span style="font-size:0.62rem;color:#e84393;">'+_spIc+'</span>';
        }
        var factionTag=ch.faction?'<span style="font-size:0.62rem;color:var(--txt-d);">'+ch.faction+'</span>':'';
        // 立场/党派/学识标签
        var stancePartyTag='';
        if(ch.stance&&ch.stance!=='中立') stancePartyTag+='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';color:'+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';margin-right:2px;">'+ch.stance+'</span>';
        if(ch.party) stancePartyTag+='<span style="font-size:0.55rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;margin-right:2px;">'+escHtml(ch.party)+'</span>';
        var officeLine=ch.title?'<span style="font-size:0.7rem;color:var(--txt-d);">'+ch.title+'</span>':'';
        var ageTag=ch.age?'<span style="font-size:0.62rem;color:var(--txt-d);">'+ch.age+'\u5C81</span>':'';
        var _cap=GM._capital||'京城';
        var locTag='';
        if(ch.location&&ch.location!==_cap) locTag='<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;background:rgba(184,154,83,0.1);color:var(--gold-400);margin-left:2px;">'+(ch._travelTo?'→'+ch._travelTo:ch.location)+'</span>';
        // 性格特质缩写
        var traitBrief='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitBrief=ch.traitIds.slice(0,2).map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;});return d?d.name:'';}).filter(Boolean).join('\u00B7');
          if(traitBrief) traitBrief='<span style="font-size:0.58rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;">'+traitBrief+'</span>';
        }
        // 目标+满足度
        var goalBrief='';
        if(ch.personalGoal) {
          var _gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : '';
          var _gsatColor = _gsat >= 60 ? 'var(--celadon-400)' : _gsat >= 30 ? 'var(--gold-400)' : 'var(--vermillion-400)';
          goalBrief='<div style="font-size:0.6rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">\u5FD7\uFF1A'+escHtml(ch.personalGoal);
          if(_gsat !== '') goalBrief += ' <span style="color:'+_gsatColor+';">'+_gsat+'%</span>';
          goalBrief += '</div>';
        }
        // 恩怨摘要（简短）
        var eyBrief='';
        if(typeof EnYuanSystem!=='undefined'){var _eyt2=EnYuanSystem.getTextForChar(ch.name);if(_eyt2)eyBrief='<div style="font-size:0.55rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">'+_eyt2+'</div>';}
        // 五常/气质/面子（新增增强）
        var wcLine='';
        if(typeof calculateWuchang==='function'){
          var _wc=calculateWuchang(ch);
          wcLine='<div style="font-size:0.6rem;color:var(--celadon-400);margin-top:0.15rem;letter-spacing:0.03em;">仁'+_wc.仁+' 义'+_wc.义+' 礼'+_wc.礼+' 智'+_wc.智+' 信'+_wc.信+' <span style="color:var(--gold-400);">'+_wc.气质+'</span></div>';
        }
        var faceLine='';
        if(typeof FaceSystem!=='undefined'&&ch._face!==undefined){
          var _fv=FaceSystem.getFace(ch);
          var _fc=_fv>=60?'var(--color-foreground-muted)':_fv>=40?'#e67e22':'var(--vermillion-400)';
          faceLine=_fv<60?' <span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+_fc+';color:'+_fc+';">'+(_fv<20?'奇耻':_fv<40?'颜面尽失':'面子低落')+'</span>':'';
        }
        // 特质色彩编码（增强）
        var traitTags='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitTags=ch.traitIds.slice(0,3).map(function(tid){
            var d=P.traitDefinitions.find(function(t){return t.id===tid;});
            if(!d)return '';
            var _tc=(d.dims&&d.dims.boldness>0.2)?'var(--vermillion-400)':(d.dims&&d.dims.compassion>0.2)?'var(--celadon-400)':(d.dims&&d.dims.rationality>0.2)?'var(--indigo-400)':'var(--gold-400)';
            return '<span style="font-size:0.55rem;padding:0 3px;border-radius:2px;border:1px solid '+_tc+';color:'+_tc+';margin-right:2px;">'+d.name+'</span>';
          }).filter(Boolean).join('');
        }
        var _portraitThumb = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;margin-right:6px;">' : '';
        return "<div class=\"cd\" style=\"padding:0.5rem 0.6rem;margin-bottom:0.35rem;cursor:pointer;border-left:3px solid var(--gold-500);\" onclick=\"openCharDetail('"+ch.name.replace(/'/g,"\\'")+"')\">"
          +"<div style=\"display:flex;align-items:center;\">"+_portraitThumb
          +"<div style=\"flex:1;\"><div style=\"display:flex;justify-content:space-between;align-items:center;\">"
          +"<strong style=\"font-size:0.85rem;\">"+moodIcon+ch.name+locTag+spouseTag+faceLine+"</strong>"
          +"<span style=\"font-size:0.68rem;\">"+ageTag+" <span class=\"stat-number\" style=\"color:"+loyColor+";\">忠"+loyDisp+"</span>"+ambTag+stressTag+"</span>"
          +"</div>"
          +"<div style=\"display:flex;justify-content:space-between;align-items:center;margin-top:0.1rem;\">"+officeLine+"<span>"+factionTag+"</span></div>"
          +(stancePartyTag?'<div style="margin-top:0.1rem;">'+stancePartyTag+'</div>':'')
          +wcLine
          +"<div style=\"margin-top:0.1rem;\">"+traitTags+"</div>"
          +goalBrief
          +eyBrief
          +"</div></div></div>";
      }).join("")||"<div style=\"color:var(--txt-d);font-size:0.78rem;\">\u65E0</div>";
    // 7.3: 超过分页限制时添加"显示全部"按钮
    if (!_charShowAll && _charList.length > _charPageLimit) {
      gr.innerHTML += '<div style="text-align:center;padding:0.3rem;"><button class="bt bs bsm" onclick="_$(\'gr\')._showAllChars=true;renderGameState();">\u663E\u793A\u5168\u90E8' + _charList.length + '\u4EBA</button></div>';
    }
  }

  // 渲染子组件
  renderWenduiChars();renderMemorials();renderBiannian();renderOfficeTree();renderShijiList();renderJishi();
  // 地方舆情每回合同步刷新（接新 adminHierarchy 深化字段）
  if (typeof _renderDifangPanel === 'function' && P.adminHierarchy) {
    try { _renderDifangPanel(); } catch(_dfRefE) { console.warn('[difang refresh]', _dfRefE); }
  }
  if(typeof renderGameTech==='function')renderGameTech();
  if(typeof renderGameCivic==='function')renderGameCivic();
  if(typeof renderRenwu==='function')renderRenwu();
  if(typeof renderSidePanels==='function')renderSidePanels();
  // 触发钩子，各模块在此追加徽章/地图等
  GameHooks.run('renderGameState:after');
  // 2.8: 动态元素无障碍增强
  if (typeof _applyA11y === 'function') _applyA11y();
}

// ── 建议库动态渲染 ──
// 纳入诏书的下拉菜单——以 body 级 fixed 定位呈现，避免被侧栏 overflow 裁切
function _showEdictAdoptMenu(evt, realIdx) {
  if (evt) { evt.stopPropagation(); evt.preventDefault(); }
  // 移除旧菜单
  var _old = document.getElementById('_edictAdoptMenu'); if (_old) _old.remove();
  var _btn = evt && evt.currentTarget ? evt.currentTarget : (evt && evt.target);
  if (!_btn) return;
  var rect = _btn.getBoundingClientRect();
  var cats = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  var menu = document.createElement('div');
  menu.id = '_edictAdoptMenu';
  // 计算位置——优先向下；若下方空间不足则向上
  var menuH = cats.length * 28 + 6;
  var vh = window.innerHeight;
  var top = rect.bottom + 4;
  if (top + menuH > vh - 10) top = Math.max(10, rect.top - menuH - 4);
  menu.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + top + 'px;z-index:9999;background:var(--color-elevated,#1a1a2e);border:1px solid var(--color-border-subtle,#444);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:90px;padding:3px 0;';
  cats.forEach(function(cat) {
    var item = document.createElement('div');
    item.textContent = cat.label;
    item.style.cssText = 'padding:5px 12px;font-size:0.8rem;cursor:pointer;color:' + cat.color + ';transition:background 0.12s;';
    item.onmouseover = function() { this.style.background = 'var(--color-surface,rgba(255,255,255,0.06))'; };
    item.onmouseout = function() { this.style.background = ''; };
    item.onclick = function(ev) {
      ev.stopPropagation();
      var sg = GM._edictSuggestions && GM._edictSuggestions[realIdx];
      if (sg) {
        var ta = _$(cat.id);
        if (ta) {
          // 纳入时保留问题背景：先写 topic，再写 content
          var prefix = '';
          if (sg.topic) prefix += '〔' + sg.topic + '〕';
          if (sg.from) prefix += '（' + sg.from + '言）';
          var block = (prefix ? prefix + '\n' : '') + sg.content;
          ta.value += (ta.value ? '\n\n' : '') + block;
        }
        if (typeof toast === 'function') toast('\u5DF2\u7EB3\u5165' + cat.label + (sg.topic?'（含问题背景）':''));
      }
      menu.remove();
      document.removeEventListener('click', _closeEdictMenu);
    };
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  // 点击外部关闭
  setTimeout(function() { document.addEventListener('click', _closeEdictMenu); }, 0);
}
function _closeEdictMenu(e) {
  var m = document.getElementById('_edictAdoptMenu');
  if (m && !m.contains(e.target)) {
    m.remove();
    document.removeEventListener('click', _closeEdictMenu);
  }
}

function _renderEdictSuggestions() {
  var container = _$('edict-sug-sidebar');
  if (!container) return;
  var _edictCatIds = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  var _unused = (GM._edictSuggestions || []).filter(function(s) { return !s.used; });
  // 按来源映射 src 类
  var _srcClsMap = {
    '\u671D\u8BAE': 'ed-src-chaoyi',
    '\u95EE\u5BF9': 'ed-src-wendui',
    '\u9E3F\u96C1': 'ed-src-letter',
    '\u594F\u758F': 'ed-src-memorial',
    '\u5B98\u5236': 'ed-src-office',
    '\u5730\u65B9': 'ed-src-local'
  };
  var html = '';
  if (_unused.length === 0) {
    html += '<div style="font-size:11.5px;color:var(--color-foreground-muted);line-height:1.7;padding:12px 10px;text-align:center;font-family:var(--font-serif);font-style:italic;">\u8BF8\u4E8B\u6682\u5B81\u3002\u53EC\u5F00\u300C\u671D\u8BAE\u300D\u6216\u300C\u95EE\u5BF9\u300D\uFF0C\u5176\u8FDB\u8A00\u5C06\u6536\u5165\u6B64\u5904\u3002</div>';
  } else {
    _unused.forEach(function(s) {
      var _realIdx = (GM._edictSuggestions || []).indexOf(s);
      var _srcCls = _srcClsMap[s.source] || 'ed-src-default';
      var _srcLine = '\u3010' + escHtml(s.source || '?') + (s.from ? '\u00B7' + escHtml(s.from) : '') + '\u3011';
      html += '<div class="ed-sug-item ' + _srcCls + '" onclick="_showEdictAdoptMenu(event,' + _realIdx + ')">';
      html += '<div class="src">' + _srcLine + '</div>';
      if (s.topic) html += '<div class="topic">\u3014' + escHtml(s.topic) + '\u3015</div>';
      html += '<div class="txt">' + escHtml(s.content) + '</div>';
      html += '<span class="act">\u6458\u5165</span>';
      html += '<button class="del" onclick="event.stopPropagation();GM._edictSuggestions[' + _realIdx + '].used=true;_renderEdictSuggestions();" title="\u5220\u9664">\u2715</button>';
      html += '</div>';
    });
  }
  container.innerHTML = html;
}

// ── 有司润色：将各类诏令合并为正式诏书 ──
async function _polishEdicts() {
  var cats = [
    { id: 'edict-pol', label: '\u653F\u4EE4' },
    { id: 'edict-mil', label: '\u519B\u4EE4' },
    { id: 'edict-dip', label: '\u5916\u4EA4' },
    { id: 'edict-eco', label: '\u7ECF\u6D4E' },
    { id: 'edict-oth', label: '\u5176\u4ED6' }
  ];
  var parts = [];
  cats.forEach(function(cat) {
    var el = _$(cat.id);
    var val = el ? el.value.trim() : '';
    if (val) parts.push({ label: cat.label, content: val });
  });
  if (parts.length === 0) { toast('\u8BF7\u5148\u5728\u5404\u7C7B\u8BCF\u4EE4\u4E2D\u586B\u5199\u5185\u5BB9'); return; }

  var panel = _$('edict-polished');
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);padding:var(--space-4);">\u6709\u53F8\u6B63\u5728\u6DA6\u8272\u8BCF\u4E66\u2026\u2026</div>';

  // 读取风格选择
  var styleEl = _$('edict-polish-style');
  var style = styleEl ? styleEl.value : 'elegant';
  var styleDesc = {
    elegant: '\u5178\u96C5\u5E84\u91CD\u7684\u6587\u8A00\uFF0C\u5584\u7528\u5BF9\u5076\u9A88\u53E5',
    concise: '\u7B80\u6D01\u660E\u5FEB\uFF0C\u76F4\u5165\u4E3B\u9898\uFF0C\u4E0D\u7528\u5197\u957F\u8F9E\u85FB',
    ornate: '\u534E\u4E3D\u6587\u85FB\uFF0C\u6587\u91C7\u98DE\u626C\uFF0C\u5927\u91CF\u4F7F\u7528\u5178\u6545\u3001\u8F9E\u8D4B\u3001\u6392\u6BD4',
    plain: '\u767D\u8BDD\u6587\u8A00\uFF0C\u534A\u6587\u534A\u767D\uFF0C\u901A\u4FD7\u6613\u61C2\u4F46\u4FDD\u6301\u5E84\u91CD'
  }[style] || '';

  if (!P.ai.key) {
    var merged = parts.map(function(p) { return '\u3010' + p.label + '\u3011' + p.content; }).join('\n\n');
    _renderPolishedEdict(panel, merged);
    return;
  }

  var sc = findScenarioById && findScenarioById(GM.sid);
  var era = (sc && sc.era) || '';
  var dynasty = (sc && sc.dynasty) || '';
  var role = (P.playerInfo && P.playerInfo.characterName) || '\u7687\u5E1D';
  var dateText = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';

  var prompt = '\u4F60\u662F' + (dynasty || era || '\u4E2D\u56FD\u53E4\u4EE3') + '\u671D\u5EF7\u7684\u4E2D\u4E66\u820D\u4EBA/\u7FF0\u6797\u5B66\u58EB\uFF0C\u8D1F\u8D23\u8D77\u8349\u6B63\u5F0F\u8BCF\u4E66\u3002\n\n';
  prompt += '\u3010\u53D1\u5E03\u8005\u3011' + role + '\n';
  prompt += '\u3010\u65F6\u95F4\u3011' + dateText + '\n\n';
  prompt += '\u3010\u73A9\u5BB6\u8349\u62DF\u7684\u5404\u7C7B\u65E8\u610F\u3011\n';
  parts.forEach(function(p) { prompt += '\u3014' + p.label + '\u3015' + p.content + '\n'; });

  prompt += '\n\u3010\u4EFB\u52A1\u3011\u5C06\u4EE5\u4E0A\u5404\u7C7B\u65E8\u610F\u5408\u5E76\u6DA6\u8272\u4E3A\u4E00\u9053\u5B8C\u6574\u7684\u6B63\u5F0F\u8BCF\u4E66\u3002\u8981\u6C42\uFF1A\n';
  prompt += '1. \u8BCF\u4E66\u683C\u5F0F\u5FC5\u987B\u4E25\u683C\u9075\u5FAA' + (era || '\u8BE5\u671D\u4EE3') + '\u7684\u771F\u5B9E\u516C\u6587\u4F53\u5236\u2014\u2014\n';
  prompt += '   \u4E0D\u540C\u671D\u4EE3\u8BCF\u4E66\u683C\u5F0F\u5DEE\u5F02\u6781\u5927\uFF0C\u4F60\u5FC5\u987B\u6839\u636E\u5177\u4F53\u671D\u4EE3\u9009\u7528\u6B63\u786E\u683C\u5F0F\uFF1A\n';
  prompt += '   \u00B7 \u79E6\u6C49\uFF1A\u5236\u66F0/\u8BCF\u66F0\uFF0C\u65E0\u56FA\u5B9A\u8D77\u9996\u5957\u8BED\uFF0C\u7ED3\u5C3E\u201C\u5E03\u544A\u5929\u4E0B\u201D\u201C\u5176\u4EE4\u2026\u2026\u201D\u7B49\n';
  prompt += '   \u00B7 \u9B4F\u664B\u5357\u5317\u671D\uFF1A\u591A\u7528\u201C\u95E8\u4E0B\u201D\u8D77\u9996\uFF0C\u9A88\u6587\u98CE\u683C\u6D53\u90C1\n';
  prompt += '   \u00B7 \u5510\u5B8B\uFF1A\u5236\u4E66\u201C\u95E8\u4E0B\uFF1A\u201D\u8D77\u9996\uFF0C\u6555\u4E66\u201C\u6555\u67D0\u67D0\u201D\u8D77\u9996\uFF0C\u7ED3\u5C3E\u201C\u4E3B\u8005\u65BD\u884C\u201D\n';
  prompt += '   \u00B7 \u5143\u4EE3\uFF1A\u8499\u6C49\u5408\u74A7\uFF0C\u767D\u8BDD\u8BCF\u4E66\u201C\u957F\u751F\u5929\u6C14\u529B\u91CC\uFF0C\u5927\u798F\u836B\u62A4\u52A9\u91CC\uFF0C\u7687\u5E1D\u5723\u65E8\u2026\u2026\u201D\n';
  prompt += '   \u00B7 \u660E\u6E05\uFF1A\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\uFF0C\u8BCF\u66F0/\u5236\u66F0/\u6555\u66F0\u201D\u2014\u2014\u6CE8\u610F\u201C\u5949\u5929\u627F\u8FD0\u201D\u56DB\u5B57\u540E\u63A5\u201C\u7687\u5E1D\u201D\uFF0C\n';
  prompt += '     \u201C\u8BCF\u66F0\u201D\u53E6\u8D77\uFF0C\u4E2D\u95F4\u65AD\u53E5\uFF0C\u4E0D\u662F\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\u8BCF\u66F0\u201D\u8FDE\u8BFB\u3002\u4E14\u6B64\u683C\u5F0F\u4EC5\u9650\u660E\u6E05\u3002\n';
  prompt += '   \u00B7 \u82E5\u975E\u5E1D\u738B\uFF08\u5982\u8BF8\u4FAF/\u738B/\u4E1E\u76F8\u7B49\uFF09\uFF0C\u5E94\u4F7F\u7528\u201C\u4EE4\u201D\u201C\u6559\u201D\u201C\u6A84\u201D\u7B49\u5BF9\u5E94\u6587\u79CD\uFF0C\u4E0D\u7528\u201C\u8BCF\u201D\n';
  prompt += '2. \u6B63\u6587\uFF1A\u5C06\u5404\u7C7B\u65E8\u610F\u6709\u673A\u878D\u5408\uFF0C\u6309\u8F7B\u91CD\u7F13\u6025\u6392\u5217\uFF0C\u884C\u6587\u6D41\u7545\n';
  prompt += '3. \u8BED\u8A00\u98CE\u683C\uFF1A' + styleDesc + '\n';
  prompt += '4. \u4FDD\u7559\u73A9\u5BB6\u6240\u6709\u65E8\u610F\u7684\u5B9E\u8D28\u5185\u5BB9\uFF0C\u4E0D\u9057\u6F0F\u4E0D\u7BE1\u6539\uFF0C\u4E0D\u51ED\u7A7A\u589E\u52A0\u65B0\u653F\u7B56\n';
  prompt += '5. \u5B57\u6570\uFF1A' + _charRangeText('zw') + '\n\n';
  prompt += '\u76F4\u63A5\u8F93\u51FA\u8BCF\u4E66\u5168\u6587\uFF0C\u4E0D\u8981\u52A0\u4EFB\u4F55\u89E3\u91CA\u3002';

  try {
    var result = await callAI(prompt, 2000);
    if (result) _renderPolishedEdict(panel, result);
    else panel.innerHTML = '<div style="color:var(--color-foreground-muted);text-align:center;">\u6DA6\u8272\u672A\u8FD4\u56DE\u5185\u5BB9</div>';
  } catch(e) {
    panel.innerHTML = '<div style="color:var(--vermillion-400);">\u6DA6\u8272\u5931\u8D25\uFF1A' + escHtml(e.message || '') + '</div>';
  }
}

function _renderPolishedEdict(panel, text) {
  // 卷轴式·宣纸底+上下木轴+朱砂御玺+颁行天下
  panel.innerHTML = ''
    + '<div class="ed-scroll">'
    +   '<div class="ed-scroll-title">\u8BCF\u3000\u4E66</div>'
    +   '<textarea id="edict-polished-text" class="ed-scroll-text" rows="12">' + escHtml(text) + '</textarea>'
    +   '<div class="ed-scroll-seal"><div class="top">\u7687 \u5E1D</div><div class="main">\u5236\u5B9D</div><div class="bot">\u4E4B \u5B9D</div></div>'
    + '</div>'
    + '<div class="ed-scroll-actions">'
    +   '<button class="ed-scroll-btn" onclick="_polishEdicts()" title="\u91CD\u65B0\u7531\u6709\u53F8\u6DA6\u8272">\u91CD \u65B0 \u6DA6 \u8272</button>'
    +   '<button class="ed-scroll-btn" onclick="_applyPolishedEdict(\'keep\')" title="\u4FDD\u7559\u5206\u7C7B\u539F\u6587\u4E0D\u53D8\uFF0C\u8BCF\u4E66\u4EC5\u5B58\u6863\u5C55\u793A">\u7F16 \u8BA2 \u5B58 \u6863</button>'
    +   '<button class="ed-scroll-btn primary" onclick="_applyPolishedEdict(\'replace\')" title="\u5C06\u8BCF\u4E66\u66FF\u6362\u5230\u653F\u4EE4\u680F">\u9881 \u884C \u5929 \u4E0B</button>'
    +   '<button class="ed-scroll-btn" onclick="_$(\'edict-polished\').style.display=\'none\'">\u6536 \u8D77</button>'
    + '</div>';
}

function _applyPolishedEdict(mode) {
  var ta = _$('edict-polished-text');
  if (!ta) return;
  var text = ta.value.trim();
  if (!text) { toast('\u8BCF\u4E66\u5185\u5BB9\u4E3A\u7A7A'); return; }

  if (mode === 'replace') {
    // 替换模式：诏书写入政令栏，清空其他分类
    var polEl = _$('edict-pol');
    if (polEl) polEl.value = text;
    ['edict-mil', 'edict-dip', 'edict-eco', 'edict-oth'].forEach(function(id) {
      var el = _$(id); if (el) el.value = '';
    });
    toast('\u8BCF\u4E66\u5DF2\u5F55\u5165\u653F\u4EE4\u680F');
  } else {
    // 展示模式：不改动各类textarea，诏书存入GM.edicts供展示
    toast('\u8BCF\u4E66\u5DF2\u5B58\u6863\uFF0C\u5404\u7C7B\u8BCF\u4EE4\u4FDD\u6301\u4E0D\u53D8');
  }
  // 存入GM.edicts供起居注等引用
  if (!GM.edicts) GM.edicts = [];
  GM.edicts.push(text);
  _$('edict-polished').style.display = 'none';
}

// 官职公库初始化：walk officeTree，从 publicTreasuryInit 建立 live publicTreasury
function _initOfficePublicTreasury(nodes) {
  (nodes || []).forEach(function(n) {
    if (!n) return;
    (n.positions || []).forEach(function(p) {
      if (!p) return;
      // 若已有 live publicTreasury 则跳过（保存加载时不覆盖）
      if (p.publicTreasury && p.publicTreasury.money && p.publicTreasury.money.stock != null) return;
      var init = p.publicTreasuryInit || {};
      p.publicTreasury = {
        money: { stock: init.money || 0, quota: init.quotaMoney || 0, used: 0, available: init.money || 0, deficit: 0 },
        grain: { stock: init.grain || 0, quota: init.quotaGrain || 0, used: 0, available: init.grain || 0, deficit: 0 },
        cloth: { stock: init.cloth || 0, quota: init.quotaCloth || 0, used: 0, available: init.cloth || 0, deficit: 0 },
        currentHead: p.holder || null,
        previousHead: null,
        handoverLog: []
      };
    });
    if (n.subs) _initOfficePublicTreasury(n.subs);
  });
}

// 按品级推算角色私产初始值（当剧本未给定 wealthInit 且 wealth 为字符串描述时）
// 兼容从 rank(数字) 和 officialTitle(如"从四品"/"正二品") 两种输入
function _parseRankNumber(ch) {
  // 1. 直接用 rank 数字
  if (typeof ch.rank === 'number' && ch.rank >= 1 && ch.rank <= 9) return ch.rank;
  // 2. 从 officialTitle/rank 字符串解析"正X品/从X品"
  var rankStr = (typeof ch.rank === 'string' ? ch.rank : '') + '|' + (ch.officialTitle || '') + '|' + (ch.title || '');
  var numMap = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 };
  var m = rankStr.match(/(正|从)([一二三四五六七八九])品/);
  if (m) {
    var r = numMap[m[2]];
    // 从品加 0.5 档，但结果仍取整数档位（1-9）
    return r;
  }
  // 3. 无品级 → 0（平民/未入仕）
  return 0;
}
function _inferPrivateWealthByRank(ch) {
  var r = _parseRankNumber(ch);
  // 品级越高私产越丰（明清历史参照·单位 两/亩）
  var tiers = {
    1:  { cash: 50000, land: 10000, treasure: 30000, slaves: 200, commerce: 20000 },  // 正一品
    2:  { cash: 30000, land:  8000, treasure: 20000, slaves: 150, commerce: 15000 },  // 正二品
    3:  { cash: 15000, land:  5000, treasure: 10000, slaves: 100, commerce:  8000 },  // 正三品
    4:  { cash:  8000, land:  3000, treasure:  5000, slaves:  60, commerce:  4000 },  // 正四品
    5:  { cash:  4000, land:  1500, treasure:  2500, slaves:  30, commerce:  2000 },  // 正五品
    6:  { cash:  2000, land:   800, treasure:  1200, slaves:  15, commerce:  1000 },  // 正六品
    7:  { cash:  1000, land:   400, treasure:   600, slaves:   8, commerce:   500 },  // 正七品
    8:  { cash:   500, land:   200, treasure:   300, slaves:   4, commerce:   200 },  // 正八品
    9:  { cash:   200, land:   100, treasure:   150, slaves:   2, commerce:   100 }   // 正九品
  };
  // 无品级 → 平民/未入仕基准（很低）
  if (!r || r < 1) return { cash: 100, land: 50, treasure: 50, slaves: 0, commerce: 50 };
  return tiers[Math.min(9, r)] || tiers[9];
}

// 从 wealth 字符串中解析数字线索（如"田 4 万顷"→ land = 40000*100, "家丁 3000"→ slaves = 3000）
function _parseWealthString(s) {
  if (!s || typeof s !== 'string') return {};
  var out = {};
  // 田 N 万顷
  var m1 = s.match(/田\s*(\d+(?:\.\d+)?)\s*万?顷/);
  if (m1) {
    var qing = parseFloat(m1[1]);
    if (s.indexOf('万顷') >= 0) qing *= 10000;
    out.land = Math.round(qing * 100);  // 1 顷 = 100 亩
  } else {
    var m2 = s.match(/田\s*(\d+(?:\.\d+)?)\s*万?亩/);
    if (m2) {
      var mu = parseFloat(m2[1]);
      if (s.indexOf('万亩') >= 0) mu *= 10000;
      out.land = Math.round(mu);
    }
  }
  // 家丁 N
  var m3 = s.match(/家丁\s*(\d+(?:\.\d+)?)\s*(千|万)?/);
  if (m3) {
    var n = parseFloat(m3[1]);
    var mu2 = m3[2] === '万' ? 10000 : m3[2] === '千' ? 1000 : 1;
    out.slaves = Math.round(n * mu2);
  }
  // 富甲天下 / 抄没 X 万两
  var m4 = s.match(/(?:抄没估?|家?产)\s*(\d+)\s*万?两/);
  if (m4) {
    var v = parseInt(m4[1]);
    if (s.indexOf('万两') >= 0 || s.indexOf('万') >= 0) v *= 10000;
    out.cash = v;
  }
  // 富甲天下 / 豪富 关键词
  if (/富甲天下|豪富|巨富/.test(s)) {
    out._rich = true;  // rank-based * 5
  } else if (/家境殷实|小有资产/.test(s)) {
    out._rich = false;
  } else if (/清贫|贫困|寒素/.test(s)) {
    out._poor = true;  // rank-based * 0.3
  }
  return out;
}

// 初始化所有角色的 privateWealth
function _initCharacterPrivateWealth(chars) {
  var _isLeader = function(c){
    if (!c) return false;
    // 皇帝
    if (c.role === '皇帝' || c.officialTitle === '皇帝') return true;
    if (c.isPlayer && c.royalRelation === 'emperor_family' && c.isRoyal) return true;
    if (c.title && /明思宗|崇祯帝|庄烈帝|皇帝/.test(c.title)) return true;
    // 势力领袖
    var facs = (GM && GM.facs) || [];
    for (var i = 0; i < facs.length; i++) {
      var f = facs[i]; if (!f) continue;
      if (f.leader === c.name) return true;
      if (f.leadership && f.leadership.ruler === c.name) return true;
    }
    return false;
  };
  (chars || []).forEach(function(ch) {
    if (!ch || ch.alive === false) return;
    if (!ch.resources) ch.resources = {};
    // 领袖：跳过五大类赋值，其私产=内帑/领袖私库 镜像（由 updatePublicTreasuryMirror 同步）
    if (_isLeader(ch)) {
      if (typeof CharEconEngine !== 'undefined') {
        try { CharEconEngine.ensureCharResources(ch); } catch(_){}
        try { CharEconEngine.updatePublicTreasuryMirror(ch); } catch(_){}
      }
      return;
    }
    // 若 resources.privateWealth 已有有效数据（存档加载）则跳过
    if (ch.resources.privateWealth && (ch.resources.privateWealth.cash > 0 || ch.resources.privateWealth.land > 0)) return;
    // 剧本可直接提供 wealthInit 覆盖全部
    if (ch.wealthInit && typeof ch.wealthInit === 'object') {
      ch.resources.privateWealth = {
        cash: ch.wealthInit.cash || 0,
        land: ch.wealthInit.land || 0,
        treasure: ch.wealthInit.treasure || 0,
        slaves: ch.wealthInit.slaves || 0,
        commerce: ch.wealthInit.commerce || 0
      };
      if (ch.wealthInit.hidden != null) ch.hiddenWealth = ch.wealthInit.hidden;
      return;
    }
    // 按品级推算基准
    var base = _inferPrivateWealthByRank(ch);
    // 从 wealth 字符串解析线索叠加
    var parsed = _parseWealthString(ch.wealth || '');
    if (parsed._rich) {
      ['cash','land','treasure','slaves','commerce'].forEach(function(k){ base[k] = Math.round(base[k] * 5); });
    }
    if (parsed._poor) {
      ['cash','land','treasure','slaves','commerce'].forEach(function(k){ base[k] = Math.round(base[k] * 0.3); });
    }
    // 具体数字线索覆盖
    ['cash','land','treasure','slaves','commerce'].forEach(function(k){
      if (parsed[k] != null && parsed[k] > 0) base[k] = parsed[k];
    });
    ch.resources.privateWealth = base;
  });
}

// 进入游戏
function enterGame(){
  _$("E").style.display="none";
  _$("G").style.display="grid";

  // 为所有实体添加响应式属性
  makeEntitiesReactive();

  // 官职公库：从 publicTreasuryInit 初始化 live publicTreasury（首回合/存档加载）
  try {
    if (GM.officeTree) {
      _initOfficePublicTreasury(GM.officeTree);
      if (GM.turn === 1) console.log('[enterGame] 官职公库初始化完成');
    }
  } catch(_opE) { console.warn('[enterGame] 官职公库初始化失败', _opE); }

  // 角色私产：按 wealth 字符串+品级推算填入 resources.privateWealth
  try {
    _initCharacterPrivateWealth(GM.chars || []);
    if (GM.turn === 1) console.log('[enterGame] 角色私产初始化完成');
  } catch(_pwE) { console.warn('[enterGame] 角色私产初始化失败', _pwE); }

  // 角色公库镜像：按 officialTitle 绑定到官职·读其 publicTreasury.money.stock
  try {
    var _cEng = (typeof CharEconEngine !== 'undefined') ? CharEconEngine : null;
    if (_cEng && typeof _cEng.updatePublicTreasuryMirror === 'function' && GM.chars) {
      GM.chars.forEach(function(ch){
        if (!ch || ch.alive === false) return;
        try { _cEng.ensureCharResources(ch); } catch(_){}
        try { _cEng.updatePublicTreasuryMirror(ch); } catch(_){}
      });
      if (GM.turn === 1) console.log('[enterGame] 角色公库镜像刷新完成');
    }
  } catch(_mpE) { console.warn('[enterGame] 角色公库镜像失败', _mpE); }

  // 首次进入游戏（turn=1 且未初始化过腐败预设）→ 按朝代预设初始化腐败
  try {
    if (GM.turn === 1 && !GM._corruptionPresetDone && typeof CorruptionEngine !== 'undefined') {
      var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      var dynasty = (sc && (sc.dynasty || sc.era)) || (GM.eraState && GM.eraState.dynasty) || '';
      var phase = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';
      // 第三参数：剧本覆盖（若剧本含 sc.corruption 字段则部分覆盖预设）
      var r = CorruptionEngine.initFromDynasty(dynasty, phase, sc || {});
      GM._corruptionPresetDone = true;
      console.log('[corruption] 初始化：', r);
    }
  } catch(e) { console.error('[enterGame] 腐败朝代预设失败:', e); }

  // 帑廪朝代预设
  try {
    if (GM.turn === 1 && !GM._guokuPresetDone && typeof GuokuEngine !== 'undefined') {
      var sc2 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      var dyn = (sc2 && (sc2.dynasty || sc2.era)) || (GM.eraState && GM.eraState.dynasty) || '';
      var ph = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';
      var gr = GuokuEngine.initFromDynasty(dyn, ph, sc2 || {});
      GM._guokuPresetDone = true;
      console.log('[guoku] 初始化：', gr);
    }
  } catch(e) { console.error('[enterGame] 帑廪朝代预设失败:', e); }

  // 内帑朝代预设（依赖帑廪先完成）
  try {
    if (GM.turn === 1 && !GM._neitangPresetDone && typeof NeitangEngine !== 'undefined') {
      var sc3 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      var dyn3 = (sc3 && (sc3.dynasty || sc3.era)) || (GM.eraState && GM.eraState.dynasty) || '';
      var ph3 = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';
      var nr = NeitangEngine.initFromDynasty(dyn3, ph3, sc3 || {});
      GM._neitangPresetDone = true;
      console.log('[neitang] 初始化：', nr);
    }
  } catch(e) { console.error('[enterGame] 内帑朝代预设失败:', e); }

  // 剧本历史人物加载（若剧本指定了 historicalChars）
  try {
    if (GM.turn === 1 && !GM._historicalCharsLoaded && typeof loadHistoricalCharsFromScenario === 'function') {
      var sc4 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      if (sc4 && sc4.historicalChars) {
        var loaded = loadHistoricalCharsFromScenario(sc4);
        console.log('[historical] 已加载 ' + loaded + ' 位历史人物');
      }
      GM._historicalCharsLoaded = true;
    }
  } catch(e) { console.error('[enterGame] 历史人物加载失败:', e); }

  // 统一角色字段补齐（字/性别/家族成员/仕途/内心等 UI 所需字段）
  try {
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
      var _filled = CharFullSchema.ensureAll(GM.chars);
      if (GM.turn === 1) console.log('[CharFullSchema] 初始化 ' + _filled + ' 位角色完整字段');
    }
  } catch(e) { console.error('[enterGame] CharFullSchema 失败:', e); }

  // 货币系统初始化（币种/本位制/铸币机构/纸币预设/市场）
  try {
    if (typeof CurrencyEngine !== 'undefined' && typeof CurrencyEngine.init === 'function') {
      var _sc5 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      CurrencyEngine.init(_sc5);
      if (GM.turn === 1) console.log('[CurrencyEngine] 初始化 朝代=' + (GM.currency && GM.currency.dynasty));
    }
  } catch(e) { console.error('[enterGame] CurrencyEngine 失败:', e); }

  // 央地财政初始化（分层/分账预设/合规/监察）
  try {
    if (typeof CentralLocalEngine !== 'undefined' && typeof CentralLocalEngine.init === 'function') {
      var _sc6 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      CentralLocalEngine.init(_sc6);
      if (GM.turn === 1) console.log('[CentralLocalEngine] 初始化 预设=' + (GM.fiscal && GM.fiscal._currentPreset));
    }
  } catch(e) { console.error('[enterGame] CentralLocalEngine 失败:', e); }

  // 经济补完模块（19 税种/四层/封建 5 类/土地兼并/借贷/口碑/廷议/强征/购买力传播）
  try {
    if (typeof EconomyGapFill !== 'undefined' && typeof EconomyGapFill.init === 'function') {
      EconomyGapFill.init();
      // 四层自适应递归
      var _sc7 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      EconomyGapFill.buildHierarchyFromAdminDepth(_sc7);
      if (GM.turn === 1) console.log('[EconomyGapFill] 补完模块就绪（12 项）');
    }
  } catch(e) { console.error('[enterGame] EconomyGapFill 失败:', e); }

  // 户口系统初始化（户/口/丁 + 色目户 + 徭役 + 兵役 + 人口动态）
  try {
    if (typeof HujiEngine !== 'undefined' && typeof HujiEngine.init === 'function') {
      var _sc8 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      // 诊断：打印剧本 populationConfig 是否存在及 nationalMouths
      if (GM.turn === 1) {
        var _pc8 = _sc8 && _sc8.populationConfig;
        console.log('[HujiEngine] sc.populationConfig:', _pc8 ? '存在' : '缺失',
          _pc8 && _pc8.initial ? ('initial.nationalMouths=' + _pc8.initial.nationalMouths) : '(无 initial)');
      }
      HujiEngine.init(_sc8);
      if (GM.turn === 1) console.log('[HujiEngine] 初始化后 GM.population.national:', GM.population && GM.population.national);
    }
  } catch(e) { console.error('[enterGame] HujiEngine 失败:', e); }

  // 环境承载力初始化（五维承载/疤痕/过载/危机/技术阶梯）
  try {
    if (typeof EnvCapacityEngine !== 'undefined' && typeof EnvCapacityEngine.init === 'function') {
      var _sc9 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      EnvCapacityEngine.init(_sc9);
      if (GM.turn === 1) console.log('[EnvCapacityEngine] 初始化 技术朝代=' + (GM.environment && GM.environment.techEra));
    }
  } catch(e) { console.error('[enterGame] EnvCapacityEngine 失败:', e); }

  // 户口深化（阶层系统/A6-A8/C2-C10/D2-D6/F30 核心）
  try {
    if (typeof HujiDeepFill !== 'undefined' && typeof HujiDeepFill.init === 'function') {
      HujiDeepFill.init();
      if (GM.turn === 1) console.log('[HujiDeepFill] 深化模块就绪（阶层+封建+F30）');
    }
  } catch(e) { console.error('[enterGame] HujiDeepFill 失败:', e); }

  // 诏令补完（P1 + 反向触发 + 自动路由 + Help UI）
  try {
    if (typeof EdictComplete !== 'undefined' && typeof EdictComplete.init === 'function') {
      EdictComplete.init();
      if (GM.turn === 1) console.log('[EdictComplete] 诏令补完就绪（P1+11 反向触发）');
    }
  } catch(e) { console.error('[enterGame] EdictComplete 失败:', e); }

  // 环境恢复政策 + §9 全联动
  try {
    if (typeof EnvRecoveryFill !== 'undefined' && typeof EnvRecoveryFill.init === 'function') {
      EnvRecoveryFill.init();
    }
  } catch(e) { console.error('[enterGame] EnvRecoveryFill 失败:', e); }

  // 皇威/皇权/民心 三系统 + 7×6 变量联动
  try {
    if (typeof AuthorityEngines !== 'undefined' && typeof AuthorityEngines.init === 'function') {
      AuthorityEngines.init();
      if (GM.turn === 1) console.log('[AuthorityEngines] 皇威/皇权/民心 + 联动矩阵就绪');
    }
  } catch(e) { console.error('[enterGame] AuthorityEngines 失败:', e); }

  // 权力系统补完（权臣/民变5级/暴君症状/失威危机/天象/四象限/联动全）
  try {
    if (typeof AuthorityComplete !== 'undefined' && typeof AuthorityComplete.init === 'function') {
      AuthorityComplete.init();
      if (GM.turn === 1) console.log('[AuthorityComplete] 补完就绪（16 项 P0+P1+P2）');
    }
  } catch(e) { console.error('[enterGame] AuthorityComplete 失败:', e); }

  // 历史预设库（25 徭役 / 9 迁徙 / 7 兵制 / 8 阶层 / 65 诏令 / 30 典范 / 12 抗疏）
  try {
    if (typeof HistoricalPresets !== 'undefined' && typeof HistoricalPresets.init === 'function') {
      HistoricalPresets.init();
      if (GM.turn === 1) console.log('[HistoricalPresets] 历史数据库就绪');
    }
  } catch(e) { console.error('[enterGame] HistoricalPresets 失败:', e); }

  // C/D/B/A/E/F 阶段补丁 init
  try {
    // scriptData 在此作用域解析：优先取当前剧本对象；否则取 window.scriptData；都无则空对象
    var scriptData = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
    if (!scriptData) scriptData = (typeof window !== 'undefined' && window.scriptData) ? window.scriptData : {};
    if (typeof PhaseC !== 'undefined' && typeof PhaseC.init === 'function') PhaseC.init();
    if (typeof PhaseD !== 'undefined' && typeof PhaseD.init === 'function') PhaseD.init();
    if (typeof PhaseB !== 'undefined' && typeof PhaseB.init === 'function') PhaseB.init(scriptData);
    if (typeof PhaseA !== 'undefined' && typeof PhaseA.init === 'function') PhaseA.init(scriptData);
    if (typeof PhaseE !== 'undefined' && typeof PhaseE.init === 'function') PhaseE.init();
    if (typeof PhaseF1 !== 'undefined' && typeof PhaseF1.init === 'function') PhaseF1.init();
    if (typeof PhaseF2 !== 'undefined' && typeof PhaseF2.init === 'function') PhaseF2.init();
    if (typeof PhaseF3 !== 'undefined' && typeof PhaseF3.init === 'function') PhaseF3.init(scriptData);
    if (typeof PhaseF4 !== 'undefined' && typeof PhaseF4.init === 'function') PhaseF4.init();
    if (typeof PhaseF5 !== 'undefined' && typeof PhaseF5.init === 'function') PhaseF5.init();
    if (typeof PhaseF6 !== 'undefined' && typeof PhaseF6.init === 'function') PhaseF6.init();
    if (typeof PhaseG1 !== 'undefined' && typeof PhaseG1.init === 'function') PhaseG1.init();
    if (typeof PhaseG2 !== 'undefined' && typeof PhaseG2.init === 'function') PhaseG2.init(scriptData);
    if (typeof PhaseG3 !== 'undefined' && typeof PhaseG3.init === 'function') PhaseG3.init();
    if (typeof PhaseG4 !== 'undefined' && typeof PhaseG4.init === 'function') PhaseG4.init(scriptData);
    if (typeof PhaseH !== 'undefined' && typeof PhaseH.init === 'function') PhaseH.init(scriptData);
    // 融合桥接：行政区划 ↔ 七变量
    if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.init === 'function') IntegrationBridge.init();
    // 帑廪/内帑 三账初始化（若剧本未配置则 ensureGuokuModel 给默认）
    if (typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.ensureModel === 'function') GuokuEngine.ensureModel();
    if (typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.ensureModel === 'function') NeitangEngine.ensureModel();
    // 首回合立即跑一次税收级联 + 聚合，这样 UI 启动时不会显示 0
    if (GM.turn === 1) {
      console.log('[enterGame-T1] GM.adminHierarchy 结构:',
        GM.adminHierarchy ? ('键=' + Object.keys(GM.adminHierarchy).join(',') +
          '·player.divisions 长度=' + (GM.adminHierarchy.player && GM.adminHierarchy.player.divisions ? GM.adminHierarchy.player.divisions.length : '(无 player.divisions)')) : '(空)');
    }
    if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.collect === 'function') {
      try { CascadeTax.collect(); } catch(_ctInitE) { console.warn('[enterGame] CascadeTax.collect init', _ctInitE); }
    }
    // 固定支出：俸禄+军饷+宫廷（endTurn 本来每回合跑·此处补首回合）
    if (typeof FixedExpense !== 'undefined' && typeof FixedExpense.collect === 'function') {
      try {
        var _feR = FixedExpense.collect();
        if (GM.turn === 1) console.log('[enterGame-T1] FixedExpense 首回合结算:', _feR && _feR.turnExpense);
      } catch(_feInitE) { console.warn('[enterGame] FixedExpense.collect init', _feInitE); }
    }
    if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') {
      try { IntegrationBridge.aggregateRegionsToVariables(); } catch(_agInitE) { console.warn('[enterGame] bridge aggregate init', _agInitE); }
    }
    if (GM.turn === 1) {
      console.log('[enterGame-T1] 聚合后 GM.population.national:', GM.population && GM.population.national);
    }

  } catch(e) { console.error('[enterGame] Phase 补丁 init 失败:', e); }

  // 兜底：Phase init 无论成败，都再做一次户口检查
  // 若 national.mouths 明显偏低（< 剧本初始 1/2），直接从剧本 populationConfig 强制写入
  try {
    var _scFb = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
    var _scPopFb = _scFb && _scFb.populationConfig && _scFb.populationConfig.initial;
    if (GM.turn === 1 && _scPopFb) {
      console.log('[enterGame-兜底] 剧本 populationConfig.initial:', _scPopFb);
      console.log('[enterGame-兜底] 当前 GM.population.national:', GM.population && GM.population.national);
    }
    if (_scPopFb && _scPopFb.nationalMouths) {
      var _curM = (GM.population && GM.population.national && GM.population.national.mouths) || 0;
      if (_curM < _scPopFb.nationalMouths * 0.5) {
        if (!GM.population) GM.population = {};
        if (!GM.population.national) GM.population.national = {};
        GM.population.national.mouths = _scPopFb.nationalMouths;
        GM.population.national.households = _scPopFb.nationalHouseholds || Math.floor(_scPopFb.nationalMouths / 5.2);
        GM.population.national.ding = _scPopFb.nationalDing || Math.floor(_scPopFb.nationalMouths * 0.26);
        GM.population.fugitives = _scPopFb.nationalFugitives || 0;
        GM.population.hiddenCount = _scPopFb.hiddenPopulation || 0;
        console.warn('[enterGame] 户口聚合异常·从剧本初值兜底：mouths=' + _scPopFb.nationalMouths
          + ' (原 ' + _curM + ')');
      } else if (GM.turn === 1) {
        console.log('[enterGame-兜底] 户口正常·无需兜底 (当前 ' + _curM + ' >= 剧本 ' + _scPopFb.nationalMouths * 0.5 + ')');
      }
    } else if (GM.turn === 1) {
      console.warn('[enterGame-兜底] 剧本无 populationConfig.initial.nationalMouths·跳过兜底');
    }
  } catch(_popFbE) { console.warn('[enterGame] 户口兜底失败', _popFbE); }

  renderGameState();

  // 时局概览（Turn 1专属）
  if (GM.turn === 1) _showSituationOverview();

  // 触发钩子，各模块在此注入标签页/按钮
  GameHooks.run('enterGame:after');

  // AI深度预热已移到doActualStart中在进度条阶段同步完成
}

// 时局概览面板（开局展示天下大势）
function _showSituationOverview() {
  var h = '<div style="position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;" id="_situationModal" onclick="if(event.target===this)this.remove();">';
  h += '<div style="max-width:600px;width:90%;max-height:80vh;overflow-y:auto;background:var(--bg-2);border:2px solid var(--gold);border-radius:12px;padding:2rem;" onclick="event.stopPropagation();">';
  h += '<div style="text-align:center;font-size:1.4rem;font-weight:700;color:var(--gold);letter-spacing:0.15em;margin-bottom:1rem;">\u5929\u4E0B\u5927\u52BF</div>';

  // 势力格局
  if (GM.facs && GM.facs.length > 0) {
    h += '<div style="margin-bottom:1rem;"><div style="font-size:0.8rem;color:var(--gold);font-weight:700;margin-bottom:0.5rem;">\u52BF\u529B\u683C\u5C40</div>';
    GM.facs.forEach(function(f) {
      var isPlayer = f.isPlayer ? ' \u2605' : '';
      h += '<div style="font-size:0.78rem;color:var(--txt-s);padding:3px 0;">' + f.name + isPlayer + ' \u2014 \u5B9E\u529B' + (f.strength||50) + (f.leader ? ' \u9996\u9886:' + f.leader : '') + '</div>';
    });
    h += '</div>';
  }

  // 显著矛盾
  if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
    var dimC = {political:'#6366f1',economic:'#f59e0b',military:'#ef4444',social:'#10b981'};
    h += '<div style="margin-bottom:1rem;"><div style="font-size:0.8rem;color:#a885d5;font-weight:700;margin-bottom:0.5rem;">\u26A1 \u5F53\u524D\u77DB\u76FE</div>';
    P.playerInfo.coreContradictions.forEach(function(c) {
      h += '<div style="font-size:0.78rem;color:var(--txt-s);padding:3px 0;border-left:3px solid ' + (dimC[c.dimension]||'#888') + ';padding-left:8px;">' + c.title + (c.parties ? ' (' + c.parties + ')' : '') + '</div>';
    });
    h += '</div>';
  }

  // 玩家处境
  var pi = P.playerInfo || {};
  if (pi.characterName) {
    h += '<div style="padding:0.8rem;background:rgba(120,81,169,0.1);border-radius:8px;margin-bottom:1rem;">';
    h += '<div style="font-size:0.8rem;color:#a885d5;font-weight:700;margin-bottom:0.3rem;">\u4F60\u7684\u5904\u5883</div>';
    h += '<div style="font-size:0.82rem;color:var(--txt-s);">' + pi.characterName + (pi.characterTitle ? '(' + pi.characterTitle + ')' : '') + '\uFF0C' + (pi.factionName || '') + '</div>';
    if (pi.factionGoal) h += '<div style="font-size:0.75rem;color:var(--txt-d);margin-top:3px;">\u76EE\u6807\uFF1A' + pi.factionGoal + '</div>';
    h += '</div>';
  }

  h += '<div style="text-align:center;"><button class="bt bp" onclick="document.getElementById(\'_situationModal\').remove();" style="padding:10px 40px;font-size:0.95rem;">\u5F00\u59CB\u6CBB\u56FD</button></div>';
  h += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

// ============================================================
// 剧本完整性校验（游戏开始前自动执行）
// ============================================================
function validateScenario(sc) {
  if (!sc) return { valid: false, errors: ['剧本不存在'], warnings: [] };
  var errors = [], warnings = [];

  // 必填字段
  if (!sc.name) errors.push('剧本缺少名称');
  if (!sc.era && !sc.dynasty) warnings.push('未设定朝代/时代');

  // 角色校验
  var chars = sc.characters || P.characters || [];
  if (chars.length === 0) warnings.push('无角色数据，AI将自行生成');
  var charNames = {};
  chars.forEach(function(c, i) {
    if (!c.name) errors.push('角色#' + (i+1) + '缺少名称');
    else if (charNames[c.name]) warnings.push('角色名重复: ' + c.name);
    else charNames[c.name] = true;
    // 数值范围检查
    if (c.loyalty !== undefined && (c.loyalty < 0 || c.loyalty > 100)) {
      c.loyalty = clamp(c.loyalty, 0, 100);
      warnings.push(c.name + '的忠诚度已修正到0-100范围');
    }
  });

  // 势力校验
  var facs = sc.factions || P.factions || [];
  var facNames = {};
  facs.forEach(function(f) {
    if (f.name) facNames[f.name] = true;
  });
  // 角色引用的势力是否存在
  chars.forEach(function(c) {
    if (c.faction && facs.length > 0 && !facNames[c.faction]) {
      warnings.push(c.name + '所属势力"' + c.faction + '"不存在');
    }
  });

  // 变量校验
  var vars = sc.variables || P.variables || [];
  if (Array.isArray(vars)) {
    vars.forEach(function(v) {
      if (!v.name) warnings.push('发现无名变量');
      if (v.min !== undefined && v.max !== undefined && v.min > v.max) {
        warnings.push('变量"' + v.name + '"的最小值大于最大值');
      }
    });
  }

  // 时间校验
  if (!sc.time && !P.time.year) warnings.push('未设定起始年份');

  // 关系校验
  var rels = sc.relations || P.relations || [];
  if (Array.isArray(rels)) {
    rels.forEach(function(r) {
      if (r.from && chars.length > 0 && !charNames[r.from]) warnings.push('关系引用不存在的角色: ' + r.from);
      if (r.to && chars.length > 0 && !charNames[r.to]) warnings.push('关系引用不存在的角色: ' + r.to);
    });
  }

  // 玩家信息跨系统校验
  var pi = sc.playerInfo || {};
  if (pi.factionName && facs.length > 0 && !facNames[pi.factionName]) {
    warnings.push('\u73A9\u5BB6\u52BF\u529B"' + pi.factionName + '"\u4E0D\u5728\u52BF\u529B\u5217\u8868\u4E2D\uFF0C\u5C06\u81EA\u52A8\u521B\u5EFA');
  }
  if (pi.characterName && chars.length > 0 && !charNames[pi.characterName]) {
    warnings.push('\u73A9\u5BB6\u89D2\u8272"' + pi.characterName + '"\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D\uFF0C\u5C06\u81EA\u52A8\u521B\u5EFA');
  }

  // 官制校验
  var gov = sc.government || {};
  if (gov.nodes && gov.nodes.length > 0) {
    (function _chkGov(nodes) {
      nodes.forEach(function(n) {
        if (n.positions) n.positions.forEach(function(p) {
          if (p.holder && chars.length > 0 && !charNames[p.holder]) {
            warnings.push('\u5B98\u5236"' + n.name + '-' + p.name + '"\u4EFB\u804C\u8005"' + p.holder + '"\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D');
          }
        });
        if (n.subs) _chkGov(n.subs);
      });
    })(gov.nodes);
  }

  // 军事统帅校验
  if (sc.military && sc.military.initialTroops) {
    sc.military.initialTroops.forEach(function(t) {
      if (t.commander && chars.length > 0 && !charNames[t.commander]) {
        warnings.push('\u519B\u961F"' + t.name + '"\u7EDF\u5E05"' + t.commander + '"\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D');
      }
    });
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// 开始游戏
function startGame(sid){
  _dbg('[startGame] 开始启动游戏，sid:', sid);
  _dbg('[startGame] P.scenarios 长度:', P.scenarios ? P.scenarios.length : 'undefined');
  _dbg('[startGame] P._indices:', P._indices);
  _dbg('[startGame] P._indices.scenarioById:', P._indices ? P._indices.scenarioById : 'undefined');

  var sc=findScenarioById(sid);
  _dbg('[startGame] findScenarioById 返回:', sc);

  if(!sc){
    console.error('[startGame] 未找到剧本，sid:', sid);
    _dbg('[startGame] P.scenarios 内容:', P.scenarios);
    toast("\u672A\u627E\u5230");
    return;
  }
  // 剧本完整性校验
  var validation = validateScenario(sc);
  if (!validation.valid) {
    toast('剧本错误: ' + validation.errors.join('; '));
    console.error('[startGame] 剧本校验失败:', validation.errors);
    return;
  }
  if (validation.warnings.length > 0) {
    console.warn('[startGame] 剧本警告:', validation.warnings);
    _dbg('[startGame] 校验警告: ' + validation.warnings.join('; '));
  }
  _$("scn-page").classList.remove("show");
  _$("launch").style.display="none";_$("bar").style.display="flex";_$("bar-btns").innerHTML="";_$("G").style.display="grid";_$("E").style.display="none";
  _$("shiji-btn").classList.add("show");_$("save-btn").classList.add("show");

  var _prevSaveName=GM.saveName||'';GM={running:true,sid:sid,turn:1,vars:{},rels:{},chars:[],facs:[],items:[],armies:[],evtLog:[],conv:[],busy:false,memorials:[],qijuHistory:[],jishiRecords:[],biannianItems:[],officeTree:P.officeTree?deepClone(P.officeTree):[],wenduiTarget:null,wenduiHistory:{},officeChanges:[],shijiHistory:[],allCharacters:[],classes:[],parties:[],techTree:[],civicTree:[],autoSummary:"",summarizedTurns:[],currentDay:0,eraName:"",eraNames:[],eraState:sc.eraState?deepClone(sc.eraState):(P.eraState?deepClone(P.eraState):{politicalUnity:0.7,centralControl:0.6,legitimacySource:'hereditary',socialStability:0.6,economicProsperity:0.6,culturalVibrancy:0.7,bureaucracyStrength:0.6,militaryProfessionalism:0.5,landSystemType:'mixed',dynastyPhase:'peak',contextDescription:''}),taxPressure:52,playerAbilities:{management:0,military:0,scholarship:0,politics:0},currentIssues:[],pendingConsequences:[],memoryAnchors:[],provinceStats:{},playerPendingTasks:[],playerCharacterId:null,npcContext:null,turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]},_listeners:{},_changeQueue:[],triggeredHistoryEvents:{},rigidTriggers:{},offendGroupScores:{},activeRebounds:[],triggeredOffendEvents:{},_indices:null,postSystem:null,mapData:null,eraStateHistory:[],culturalWorks:[],_forgottenWorks:[],factionRelationsMap:{}};if(_prevSaveName)GM.saveName=_prevSaveName;
// 行政区划：从剧本/P 深拷贝到 GM，税收级联/bridge/aggregate 都读 GM.adminHierarchy
GM.adminHierarchy = (sc && sc.adminHierarchy) ? deepClone(sc.adminHierarchy) : (P.adminHierarchy ? deepClone(P.adminHierarchy) : null);
// 勤政计数（内朝+后朝协同）
GM._courtMeter = { thisTurnCount: 0, missedStreak: 0, diligentStreak: 0, lastCourtTurn: 0 };
GM._pendingShijiModal = { aiReady: false, courtDone: true, payload: null };  // courtDone 默认 true (没开后朝时直接可弹)
GM._courtRecords = [];
// 载入剧本预设关系——角色关系网
if (sc.presetRelations && Array.isArray(sc.presetRelations.npc) && sc.presetRelations.npc.length > 0 && typeof ensureCharRelation === 'function') {
  sc.presetRelations.npc.forEach(function(rel) {
    if (!rel || !rel.charA || !rel.charB) return;
    var rAB = ensureCharRelation(rel.charA, rel.charB);
    var rBA = ensureCharRelation(rel.charB, rel.charA);
    if (!rAB || !rBA) return;
    ['affinity','trust','respect','fear','hostility','conflictLevel'].forEach(function(k) {
      if (rel[k] !== undefined) { rAB[k] = rel[k]; rBA[k] = rel[k]; }
    });
    if (Array.isArray(rel.labels) && rel.labels.length) {
      rel.labels.forEach(function(l) {
        if (rAB.labels.indexOf(l) < 0) rAB.labels.push(l);
        if (rBA.labels.indexOf(l) < 0) rBA.labels.push(l);
      });
    }
    if (Array.isArray(rel.history)) { rAB.history = rel.history.slice(); rBA.history = rel.history.slice(); }
  });
}
// 载入剧本预设关系——势力关系矩阵
if (sc.presetRelations && Array.isArray(sc.presetRelations.faction) && sc.presetRelations.faction.length > 0 && typeof ensureFactionRelation === 'function') {
  sc.presetRelations.faction.forEach(function(rel) {
    if (!rel || !rel.facA || !rel.facB) return;
    var rAB = ensureFactionRelation(rel.facA, rel.facB);
    var rBA = ensureFactionRelation(rel.facB, rel.facA);
    if (!rAB || !rBA) return;
    ['trust','hostility','economicTies','culturalAffinity','kinshipTies','territorialDispute'].forEach(function(k) {
      if (rel[k] !== undefined) { rAB[k] = rel[k]; rBA[k] = rel[k]; }
    });
    if (Array.isArray(rel.historicalEvents)) { rAB.historicalEvents = rel.historicalEvents.slice(); rBA.historicalEvents = rel.historicalEvents.slice(); }
    if (Array.isArray(rel.activeTreaties)) { rAB.activeTreaties = rel.activeTreaties.slice(); rBA.activeTreaties = rel.activeTreaties.slice(); }
  });
}

// 载入剧本预设的历史名作
if (sc.culturalConfig && sc.culturalConfig.enabled && Array.isArray(sc.culturalConfig.presetWorks) && sc.culturalConfig.presetWorks.length > 0) {
  sc.culturalConfig.presetWorks.forEach(function(w) {
    if (!w || !w.author || !w.title) return;
    GM.culturalWorks.push(Object.assign({
      id: 'preset_' + Math.random().toString(36).slice(2, 8),
      turn: 0,
      triggerCategory: 'times',
      trigger: 'preset',
      motivation: 'self_express',
      genre: 'shi',
      mood: '',
      theme: '',
      elegance: 'refined',
      dedicatedTo: [],
      quality: 85,
      politicalRisk: 'low',
      isPreserved: true,
      appreciatedBy: [],
      echoResponses: [],
      isForbidden: false
    }, w));
  });
}

  // 加载经济配置
  if (sc.economyConfig) {
    P.economyConfig = deepClone(sc.economyConfig);
  } else if (!P.economyConfig) {
    P.economyConfig = {
      redistributionRate: 0.3,
      baseIncome: 100
    };
  }

  // 加载诏令样本配置（作者预设典型诏令+风格提示）
  if (sc.edictConfig) {
    P.edictConfig = deepClone(sc.edictConfig);
  } else {
    P.edictConfig = { enabled: true, examples: [], styleNote: '' };
  }

  // 加载岗位系统配置
  if (sc.postSystem) {
    GM.postSystem = deepClone(sc.postSystem);
  } else {
    GM.postSystem = {
      enabled: false,
      posts: []
    };
  }

  var _gs=(typeof sc!=="undefined"&&sc.gameSettings)||{};
  if(_gs.eraName)GM.eraName=_gs.eraName;
  if(_gs.eraNames&&_gs.eraNames.length)GM.eraNames=_gs.eraNames.slice();

  // 加载完整的时间配置
  // 步骤1：如果剧本有time对象，用它作为基础
  if(sc.time && typeof sc.time === 'object'){
    P.time = deepClone(sc.time);
  }
  // 步骤2：gameSettings 始终覆盖（用户在编辑器里设置的优先级最高）
  if(_gs.startYear !== undefined && _gs.startYear !== null && _gs.startYear !== ''){
    P.time.year = Number(_gs.startYear);
    if(P.time.year < 0){ P.time.prefix = '公元前'; P.time.suffix = '年'; }
    else { P.time.prefix = '公元'; P.time.suffix = '年'; }
  }
  if(_gs.startMonth) P.time.startMonth = Number(_gs.startMonth);
  if(_gs.startDay) P.time.startDay = Number(_gs.startDay);
  if(_gs.startLunarMonth) P.time.startLunarMonth = Number(_gs.startLunarMonth);
  if(_gs.startLunarDay) P.time.startLunarDay = Number(_gs.startLunarDay);
  // 回合天数：统一用 daysPerTurn
  if (_gs.daysPerTurn && _gs.daysPerTurn > 0) {
    P.time.daysPerTurn = Number(_gs.daysPerTurn);
  } else if (_gs.turnUnit) {
    // 旧格式兼容
    var _dMap5 = {'\u65E5':1,'\u5468':7,'\u6708':30,'\u5B63':90,'\u5E74':365};
    P.time.daysPerTurn = (_gs.turnDuration||1) * (_dMap5[_gs.turnUnit]||30);
  }
  if (!P.time.daysPerTurn) P.time.daysPerTurn = 30;
  if (_gs.enableGanzhi !== undefined) P.time.enableGanzhi = _gs.enableGanzhi;
  if (_gs.enableGanzhiDay !== undefined) P.time.enableGanzhiDay = _gs.enableGanzhiDay;
  // 年号默认启用（若剧本 gameSettings 未显式设置或为 false，仍启用——年号由即位改元事件议定）
  P.time.enableEraName = (_gs.enableEraName === false) ? false : true;
  if (_gs.eraNames && _gs.eraNames.length > 0) {
    P.time.eraNames = deepClone(_gs.eraNames);
  }

  // 加载剧本的其他配置到 P 对象
  if(sc.military) {
    P.military = deepClone(sc.military);
    // 给 initialTroops sid-tag（编辑器新 schema·剧本注册时未打 sid）
    if (Array.isArray(P.military.initialTroops)) {
      P.military.initialTroops.forEach(function(t) {
        if (!t.sid) t.sid = sid;
        if (!t.id)  t.id  = 'troop_' + Math.random().toString(36).slice(2, 8);
      });
    }
  }
  if(sc.rules) P.rules = deepClone(sc.rules);
  if(sc.timeline) P.timeline = deepClone(sc.timeline);
  if(sc.map) P.map = deepClone(sc.map);
  if(sc.worldSettings) P.worldSettings = deepClone(sc.worldSettings);
  if(sc.government) P.government = deepClone(sc.government);
  if(sc.adminHierarchy) P.adminHierarchy = deepClone(sc.adminHierarchy);
  if(sc.officeTree) P.officeTree = deepClone(sc.officeTree);
  if(sc.officeConfig) P.officeConfig = deepClone(sc.officeConfig);
  // 剧本自定义预设（25 大徭役 / 9 迁徙 / 7 兵制 / 税种 / 制度 覆盖）
  if(sc.customPresets) P.customPresets = deepClone(sc.customPresets);
  // 同步到 window.scriptData.customPresets 供 HistoricalPresets 动态 getter 读取
  try {
    if (typeof window !== 'undefined') {
      if (!window.scriptData) window.scriptData = {};
      if (sc.customPresets) window.scriptData.customPresets = deepClone(sc.customPresets);
    }
  } catch(_cpE) {}
  if(sc.fiscalConfig) P.fiscalConfig = deepClone(sc.fiscalConfig);
  // 如果officeTree为空但government.nodes有数据，从government.nodes同步
  if((!P.officeTree || P.officeTree.length === 0) && P.government && P.government.nodes && P.government.nodes.length > 0) {
    P.officeTree = deepClone(P.government.nodes);
  }
  // 同步更新 GM.officeTree
  if(P.officeTree && P.officeTree.length>0) GM.officeTree = deepClone(P.officeTree);

  // 官制双向迁移（老↔新字段）——使用统一的 _offMigrateTree，避免字段不一致
  if (GM.officeTree && GM.officeTree.length > 0 && typeof _offMigrateTree === 'function') {
    // 强制重跑迁移（清除 _migrated 标记以确保新字段被同步）
    (function _clearMigrated(ns) { ns.forEach(function(n){ if(n && n.positions) n.positions.forEach(function(p){ if(p) p._migrated=false; }); if(n && n.subs) _clearMigrated(n.subs); }); })(GM.officeTree);
    _offMigrateTree(GM.officeTree);
  }
  // 官职深化字段（公库/陋规/权限/钩子）—— 新剧本首次载入时补默认
  if (GM.officeTree && GM.officeTree.length > 0 && window.TM_OfficeDeep && typeof TM_OfficeDeep.ensurePosDeep === 'function') {
    (function _fixDeep(ns) { ns.forEach(function(n){ if(n && n.positions) n.positions.forEach(function(p){ TM_OfficeDeep.ensurePosDeep(p); }); if(n && n.subs) _fixDeep(n.subs); }); })(GM.officeTree);
  }
  if(sc.techTree) P.techTree = deepClone(sc.techTree);
  if(sc.traitDefinitions && sc.traitDefinitions.length > 0) P.traitDefinitions = deepClone(sc.traitDefinitions);
  if(sc.civicTree) P.civicTree = deepClone(sc.civicTree);
  if(sc.variables) P.variables = deepClone(sc.variables);
  // 规范化：将对象格式的数据转为扁平数组，公式单独存储
  if(P.variables && !Array.isArray(P.variables)){
    var _fv=[];
    if(P.variables.base) P.variables.base.forEach(function(v){ v._category='base'; _fv.push(v); });
    if(P.variables.other) P.variables.other.forEach(function(v){ v._category='other'; _fv.push(v); });
    P._varFormulas = P.variables.formulas || [];
    P.variables=_fv;
  }
  if(P.techTree && !Array.isArray(P.techTree)){var _ft=[];if(P.techTree.military)_ft=_ft.concat(P.techTree.military);if(P.techTree.civil)_ft=_ft.concat(P.techTree.civil);P.techTree=_ft;}
  if(P.civicTree && !Array.isArray(P.civicTree)){var _fc=[];if(P.civicTree.city)_fc=_fc.concat(P.civicTree.city);if(P.civicTree.policy)_fc=_fc.concat(P.civicTree.policy);if(P.civicTree.resource)_fc=_fc.concat(P.civicTree.resource);if(P.civicTree.corruption)_fc=_fc.concat(P.civicTree.corruption);P.civicTree=_fc;}
  // rules保持对象格式{base,combat,economy,diplomacy}，不转为数组
  // (旧版兼容：如果rules已经是数组则保持数组)
  if(sc.openingText) P.openingText = sc.openingText;
  if(sc.globalRules) P.globalRules = sc.globalRules;
  if(sc.mapData) P.mapData = deepClone(sc.mapData);
  if(sc.buildingSystem) P.buildingSystem = deepClone(sc.buildingSystem);
  if(sc.vassalSystem) P.vassalSystem = deepClone(sc.vassalSystem);
  if(sc.titleSystem) P.titleSystem = deepClone(sc.titleSystem);
  if(sc.officialVassalMapping) P.officialVassalMapping = deepClone(sc.officialVassalMapping);
  if(sc.keju) P.keju = deepClone(sc.keju);
  // 加载势力间关系
  GM.factionRelations = deepClone(sc.factionRelations || P.factionRelations || []);
  // 加载后宫配置到GM.harem
  if(sc.haremConfig) {
    if(!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
    GM.harem = Object.assign(GM.harem, deepClone(sc.haremConfig));
  }

  // 加载剧本的角色、势力、党派、阶层等数据到 P 对象
  if(sc.characters) {
    // 移除旧的该剧本的角色，添加新的
    P.characters = (P.characters||[]).filter(function(c){return c.sid!==sid;});
    P.characters = P.characters.concat(sc.characters.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.factions) {
    P.factions = (P.factions||[]).filter(function(f){return f.sid!==sid;});
    P.factions = P.factions.concat(sc.factions.map(function(f){f.sid=sid;return f;}));
  }
  if(sc.parties) {
    P.parties = (P.parties||[]).filter(function(p){return p.sid!==sid;});
    P.parties = P.parties.concat(sc.parties.map(function(p){p.sid=sid;return p;}));
  }
  if(sc.classes) {
    P.classes = (P.classes||[]).filter(function(c){return c.sid!==sid;});
    P.classes = P.classes.concat(sc.classes.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.items) {
    P.items = (P.items||[]).filter(function(i){return i.sid!==sid;});
    P.items = P.items.concat(sc.items.map(function(i){i.sid=sid;return i;}));
  }
  if(sc.relations) {
    P.relations = (P.relations||[]).filter(function(r){return r.sid!==sid;});
    P.relations = P.relations.concat(sc.relations.map(function(r){r.sid=sid;return r;}));
  }

  // 加载事件数据：sc.events 是对象格式 {historical:[], random:[], ...}，需要转换为 P.events 数组格式
  if(sc.events){
    var allEvents = [];
    if(sc.events.historical) allEvents = allEvents.concat(sc.events.historical.map(function(e){e.sid=sid;e.type='historical';return e;}));
    if(sc.events.random) allEvents = allEvents.concat(sc.events.random.map(function(e){e.sid=sid;e.type='random';return e;}));
    if(sc.events.conditional) allEvents = allEvents.concat(sc.events.conditional.map(function(e){e.sid=sid;e.type='conditional';return e;}));
    if(sc.events.story) allEvents = allEvents.concat(sc.events.story.map(function(e){e.sid=sid;e.type='story';return e;}));
    if(sc.events.chain) allEvents = allEvents.concat(sc.events.chain.map(function(e){e.sid=sid;e.type='chain';return e;}));
    // 移除旧的该剧本的事件，添加新的
    P.events = (P.events||[]).filter(function(e){return e.sid!==sid;});
    P.events = P.events.concat(allEvents);
  }

  // 变量加载到GM.vars（含min/max规范化，与doActualStart一致）
  (P.variables||[]).filter(function(v){return v.sid===sid;}).forEach(function(v){
    if(!v.name) return;
    var gv=deepClone(v);
    if(gv.value===undefined) gv.value=parseFloat(gv.defaultValue)||parseFloat(gv.initial)||0;
    gv.value=parseFloat(gv.value)||0;
    if(gv.min===undefined&&gv.minimum!==undefined) gv.min=gv.minimum;
    if(gv.max===undefined&&gv.maximum!==undefined) gv.max=gv.maximum;
    if(gv.min===undefined) gv.min=0;
    if(gv.max===undefined) gv.max=Math.max(100,Math.abs(gv.value)*10);
    gv.min=parseFloat(gv.min)||0;gv.max=parseFloat(gv.max)||100;
    if(gv.max<=gv.min) gv.max=gv.min+100;
    GM.vars[gv.name]=gv;
  });
  GM._varFormulas = (P._varFormulas || []).map(function(f) {
    if (!f.type) f.type = 'income'; // 旧公式默认为收支类型
    if (!f.chains) f.chains = [];
    return f;
  });
  (P.relations||[]).filter(function(r){return r.sid===sid;}).forEach(function(r){GM.rels[r.name]=deepClone(r);});
  GM.chars=(P.characters||[]).filter(function(c){return c.sid===sid;}).map(function(c){
    var _cc = deepClone(c);
    // 兼容：老剧本/存档没有 management 字段 → 默认与 administration 同步值
    if (_cc.management === undefined || _cc.management === null) {
      _cc.management = Math.max(30, Math.min(80, Math.round((_cc.administration || 50) * 0.85 + 5)));
    }
    // 兼容：老数据 traitIds → traits
    if (!Array.isArray(_cc.traits)) {
      if (Array.isArray(_cc.traitIds)) _cc.traits = _cc.traitIds.slice();
      else if (typeof _cc.traits === 'string' && _cc.traits) _cc.traits = _cc.traits.split(/[、，,\/;；]/).map(function(s){return s.trim();}).filter(Boolean);
      else _cc.traits = [];
    }
    // 兼容：关系网 / 作品索引
    if (!_cc.relations || typeof _cc.relations !== 'object') _cc.relations = {};
    if (!Array.isArray(_cc.works)) _cc.works = [];
    if (!Array.isArray(_cc.appreciated)) _cc.appreciated = [];
    return _cc;
  });
  // 势力关系矩阵兜底
  if (!GM.factionRelationsMap || typeof GM.factionRelationsMap !== 'object') GM.factionRelationsMap = {};
  GM.facs=(P.factions||[]).filter(function(f){return f.sid===sid;}).map(function(f){
    var faction = deepClone(f);
    // 初始化封臣系统字段
    if (!faction.vassals) faction.vassals = [];
    if (!faction.liege) faction.liege = null;
    if (!faction.tributeRate) faction.tributeRate = 0.3; // 默认贡奉比例30%
    if (!faction.territories) faction.territories = [];
    return faction;
  });
  GM.items=(P.items||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.acquired=false;return c;});
  // GM.armies：优先用 initialTroops（编辑器新 schema，完整字段），fallback 到旧 armies 字段
  // 并统一字段：soldiers/size 互相补齐，garrison/location 互相补齐
  var _initTroops = (P.military && P.military.initialTroops || []).filter(function(a){return a.sid===sid;});
  var _legacyArmies = (P.military && P.military.armies || []).filter(function(a){return a.sid===sid;});
  var _troopSrc = _initTroops.length > 0 ? _initTroops : _legacyArmies;
  GM.armies = _troopSrc.map(function(a) {
    var c = deepClone(a);
    // 字段对齐——FixedExpense 读 soldiers；渲染读 size；location/garrison 等同
    if (c.soldiers == null && c.size != null) c.soldiers = c.size;
    if (c.size == null && c.soldiers != null) c.size = c.soldiers;
    if (c.strength == null && c.soldiers != null) c.strength = c.soldiers;
    if (c.location == null && c.garrison != null) c.location = c.garrison;
    if (c.garrison == null && c.location != null) c.garrison = c.location;
    return c;
  });
  if (GM.turn === 1) console.log('[startGame] GM.armies 载入 ' + GM.armies.length + ' 支部队·总兵力=' + GM.armies.reduce(function(s,a){return s+(a.soldiers||0);},0));

  // 应用编辑器预设的封臣关系
  if (P.vassalSystem && P.vassalSystem.vassalRelations && P.vassalSystem.vassalRelations.length > 0) {
    P.vassalSystem.vassalRelations.forEach(function(rel) {
      var vassalFac = GM.facs.find(function(f) { return f.name === rel.vassal; });
      var liegeFac = GM.facs.find(function(f) { return f.name === rel.liege; });
      if (vassalFac && liegeFac) {
        vassalFac.liege = rel.liege;
        vassalFac.tributeRate = rel.tributeRate || 0.3;
        if (rel.vassalType) vassalFac.vassalType = rel.vassalType;
        if (!liegeFac.vassals) liegeFac.vassals = [];
        if (liegeFac.vassals.indexOf(rel.vassal) === -1) liegeFac.vassals.push(rel.vassal);
        // 如果有预设忠诚度，设置封臣首领的忠诚度
        if (rel.loyalty !== undefined) {
          var vRuler = GM.chars.find(function(c) { return c.faction === rel.vassal && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); });
          if (vRuler) vRuler.loyalty = rel.loyalty;
        }
      }
    });
  }
  // 应用编辑器预设的角色头衔
  if (P.titleSystem && P.titleSystem.characterTitles && P.titleSystem.characterTitles.length > 0) {
    P.titleSystem.characterTitles.forEach(function(ct) {
      var ch = GM.chars.find(function(c) { return c.name === ct.character; });
      if (ch) {
        if (!ch.titles) ch.titles = [];
        ch.titles.push({
          name: ct.titleName || '', level: ct.titleLevel || 5,
          hereditary: ct.hereditary || false, privileges: ct.privileges || [],
          _suppressed: [], grantedTurn: 0, grantedBy: '\u5F00\u5C40\u9884\u8BBE'
        });
      }
    });
  }

  // 推断京城名称（玩家势力首都/剧本背景）
  var _capital = '';
  if (sc && sc.playerInfo && sc.playerInfo.capital) _capital = sc.playerInfo.capital;
  if (!_capital && P.adminHierarchy) {
    var _ahKeys = Object.keys(P.adminHierarchy);
    if (_ahKeys.length > 0) {
      var _ah = P.adminHierarchy[_ahKeys[0]];
      if (_ah && _ah.divisions && _ah.divisions[0]) _capital = _ah.divisions[0].capital || _ah.divisions[0].name || '';
    }
  }
  if (!_capital) _capital = '京城';
  GM._capital = _capital;

  // 初始化GM.letters（鸿雁传书）
  if (!GM.letters) GM.letters = [];
  if (!GM._pendingNpcLetters) GM._pendingNpcLetters = [];
  if (!GM._letterSuspects) GM._letterSuspects = [];
  if (!GM._courierStatus) GM._courierStatus = {};
  if (!GM._routeDisruptions) GM._routeDisruptions = [];
  // 载入编辑器预设的初始驿路阻断
  if (GM._routeDisruptions.length === 0 && P.conf && P.conf.initialRouteDisruptions) {
    P.conf.initialRouteDisruptions.forEach(function(d) {
      GM._routeDisruptions.push({ route: d.route||'', from: d.from||'', to: d.to||'', reason: d.reason||'', resolved: false, turn: 0 });
    });
  }
  if (!GM._npcCorrespondence) GM._npcCorrespondence = [];
  if (!GM._pendingNpcCorrespondence) GM._pendingNpcCorrespondence = [];
  if (!GM._pendingMemorialDeliveries) GM._pendingMemorialDeliveries = [];
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._ccHeldItems) GM._ccHeldItems = [];
  if (!GM._playerDirectives) GM._playerDirectives = [];
  if (!GM._importedMemories) GM._importedMemories = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];
  if (!Array.isArray(GM._chronicle)) GM._chronicle = []; // 永久编年记录（防御非数组）
  if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  // 迁移官制树到双层模型
  if (typeof _offMigrateTree === 'function') _offMigrateTree(GM.officeTree);

  // 自动为旧角色匹配 traitIds + 初始化所在地
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      autoAssignTraitIds(c);
      validateTraits(c);
      if (typeof inferPersonalGoal === 'function') inferPersonalGoal(c);
      // 所在地标记：编辑器明确设置→_locationExplicit；未设置→临时默认京城+_locationNeedAI
      if (c.location) {
        c._locationExplicit = true;
      } else {
        c.location = _capital; // 临时默认，后续由逻辑审查AI修正
        c._locationNeedAI = true;
      }
    });
  }

  // 初始化NPC个人目标（如剧本未配置则留空，由AI后续填充）
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (!c.personalGoal) c.personalGoal = '';
    });
  }

  // 构建索引系统（性能优化）
  buildIndices();

  // 初始化 AI 缓存系统
  initAICache();

  // 初始化 Unit 系统
  if (P.unitSystem && P.unitSystem.enabled) {
    initUnitSystem();
  }

  // 初始化补给系统
  if (P.supplySystem && P.supplySystem.enabled) {
    initSupplySystem();
  }

  // 初始化建筑系统
  if (P.buildingSystem && P.buildingSystem.enabled) {
    initBuildingSystem();
  }

  // 应用地图模式选择
  if (window._pendingUseMap === false) {
    // 玩家选择AI地理志模式——禁用地图数据
    P.map = P.map || {};
    P.map.enabled = false;
    P.map.regions = [];
    P.map.roads = [];
    GM._useAIGeo = true; // 标记：使用AI地理推断
    console.log('[startGame] AI地理志模式：已禁用地图数据');
  } else {
    GM._useAIGeo = false;
  }
  delete window._pendingUseMap;

  // 初始化地图系统（若有数据则正常初始化，无数据则跳过）
  initGameMap();

  // 初始化省级经济系统
  initProvinceEconomy();

  // 初始化得罪群体系统
  OffendGroupsSystem.initialize();

  // 初始化状态耦合系统
  StateCouplingSystem.initialize();

  // 初始化集权回拨系统
  CentralizationSystem.initialize();

  // 初始化领地产出系统
  TerritoryProductionSystem.initialize();

  // 初始化职位系统
  PositionSystem.initialize();

  // 初始化交互系统
  InteractionSystem.initialize();

  // 初始化矛盾演化系统
  if (typeof ContradictionSystem !== 'undefined') ContradictionSystem.initialize();

  // 初始化 NPC Engine
  NpcEngine.initialize();

  // 注册鸿雁传书+角色赶路结算
  if (typeof SettlementPipeline !== 'undefined') {
    SettlementPipeline.register('letters', '鸿雁传书', function() { _settleLettersAndTravel(); }, 42, 'perturn');
    SettlementPipeline.register('office_mourning', '丁忧/考课结算', function() { _settleOfficeMourning(); }, 45, 'perturn');
  }

  // 初始化确定性随机系统
  initRng(sid + '_' + Date.now());
  GM._rngState = getRngState();

  GameHooks.run('startGame:after', sid);
  enterGame();
  generateMemorials();
  toast(typeof getTSText==='function'?getTSText(1):'游戏开始');

  // === 即位改元事件（游戏开始时触发） ===
  // 如果剧本没有预设年号，弹出即位改元事件让玩家议定
  if(!GM.eraNames||!GM.eraNames.length){
    setTimeout(function(){ _showEnthronementEvent(sid); }, 600);
  }
}

/**
 * 即位改元事件 —— 新君即位，议定年号
 * 两种选择：依成制（次年改元）/ 即刻改元
 */
function _showEnthronementEvent(sid){
  var sc=findScenarioById(sid);
  var playerName=(sc&&sc.playerInfo&&sc.playerInfo.characterName)||'新君';
  var roleName=(sc&&sc.role)||'天子';
  var di=calcDateFromTurn?calcDateFromTurn(GM.turn):null;
  var curYear=di?di.adYear:(P.time.year||1);
  var curGzYear=di?di.gzYearStr:'';

  var h='<div style="position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);animation:fi 0.3s ease;" id="_enthrone-event">';
  h+='<div class="scn-preview-modal" style="max-width:560px;text-align:center;" onclick="event.stopPropagation();">';

  // 顶部装饰
  h+='<div style="height:2px;background:linear-gradient(90deg,transparent,var(--gold-500),var(--gold-400),var(--gold-500),transparent);margin-bottom:var(--space-4);"></div>';

  // 标题
  h+='<div style="font-size:var(--text-xs);color:var(--vermillion-400);letter-spacing:0.15em;margin-bottom:var(--space-1);">即位大典</div>';
  h+='<div style="font-size:var(--text-xl);font-weight:var(--weight-bold);color:var(--color-primary);letter-spacing:0.15em;">〔新君临朝·议定年号〕</div>';

  // 叙事
  h+='<div class="narrative-text" style="text-align:left;margin:var(--space-4) 0;font-size:var(--text-sm);line-height:var(--leading-loose);">';
  h+='先帝崩逝，'+escHtml(playerName)+'即'+escHtml(roleName)+'位。';
  h+='群臣伏阙，恭请圣裁：新朝肇始，当以何年号纪元？<br><br>';
  h+='<span style="color:var(--color-foreground-muted);font-size:var(--text-xs);">依古制，改元有二途：一曰"踰年改元"，遵先帝遗泽，待旧年号终了，翌年正式启用新元——此为敬天法祖之正道；';
  h+='二曰"即刻改元"，新君乾纲独断，即日废旧号、行新元——此为彰显新政之锐意。</span>';
  h+='</div>';

  // 年号输入
  h+='<div style="margin-bottom:var(--space-4);">';
  h+='<label style="font-size:var(--text-xs);color:var(--gold-400);letter-spacing:0.1em;display:block;margin-bottom:var(--space-1);">钦定年号</label>';
  h+='<input id="_era-name-input" class="edict-input" style="text-align:center;font-size:var(--text-lg);font-weight:var(--weight-bold);letter-spacing:0.2em;max-width:200px;margin:0 auto;" placeholder="如：建元、永平…">';
  h+='</div>';

  h+='<hr class="ink-divider" style="margin:var(--space-3) 0;">';

  // 两个选择
  h+='<div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-3);">';

  // 依成制
  h+='<div style="flex:1;background:var(--color-surface);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);padding:var(--space-3);cursor:pointer;transition:all 0.2s;" ';
  h+='onmouseover="this.style.borderColor=\'var(--gold-500)\';this.style.boxShadow=\'var(--shadow-sm)\'" ';
  h+='onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.boxShadow=\'none\'" ';
  h+='onclick="_confirmEnthronement(\'tradition\','+curYear+')">';
  h+='<div style="font-size:var(--text-base);font-weight:var(--weight-bold);color:var(--celadon-400);margin-bottom:var(--space-1);">依成制</div>';
  h+='<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);line-height:var(--leading-normal);">踰年改元——待旧年号之年终了，次年正月方启新元。合乎礼法，群臣归心。</div>';
  h+='</div>';

  // 即刻改元
  h+='<div style="flex:1;background:var(--color-surface);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);padding:var(--space-3);cursor:pointer;transition:all 0.2s;" ';
  h+='onmouseover="this.style.borderColor=\'var(--vermillion-400)\';this.style.boxShadow=\'var(--shadow-sm)\'" ';
  h+='onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.boxShadow=\'none\'" ';
  h+='onclick="_confirmEnthronement(\'immediate\','+curYear+')">';
  h+='<div style="font-size:var(--text-base);font-weight:var(--weight-bold);color:var(--vermillion-400);margin-bottom:var(--space-1);">即刻改元</div>';
  h+='<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);line-height:var(--leading-normal);">乾纲独断——即日废旧号、启新元。彰显新政锐意，然或议者以为僭急。</div>';
  h+='</div>';

  h+='</div>';

  // 底部金线
  h+='<div style="height:1px;background:linear-gradient(90deg,transparent,var(--gold-500),transparent);"></div>';

  h+='</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
  setTimeout(function(){ var inp=document.getElementById('_era-name-input'); if(inp) inp.focus(); },300);
}

/**
 * 确认改元选择
 * @param {string} mode - 'tradition'(踰年) 或 'immediate'(即刻)
 * @param {number} curYear - 当前公元年
 */
function _confirmEnthronement(mode, curYear){
  var nameInput=document.getElementById('_era-name-input');
  var eraName=(nameInput?nameInput.value:'').trim();
  if(!eraName){ toast('请输入年号名'); if(nameInput) nameInput.focus(); return; }

  var overlay=document.getElementById('_enthrone-event');
  if(overlay) overlay.remove();

  var di=calcDateFromTurn?calcDateFromTurn(GM.turn):null;
  var startMonth=di?(di.lunarMonth||1):1;

  if(!GM.eraNames) GM.eraNames=[];
  if(!P.time.eraNames) P.time.eraNames=[];
  // 关键：启用年号显示（否则即使 GM.eraNames 有值，calcDateFromTurn 会跳过）
  P.time.enableEraName = true;

  var narrative='';
  if(mode==='tradition'){
    // 踰年改元：次年正月生效
    var startYear=curYear+1;
    var entry={name:eraName, startYear:startYear, startMonth:1, startDay:1};
    GM.eraNames.push(entry);
    P.time.eraNames.push(entry);
    narrative='群臣山呼，议定年号"'+eraName+'"。依成制，踰年改元——待今岁终了，明年正月即为'+eraName+'元年。\n朝野称颂，以为合乎礼法。';
  } else {
    // 即刻改元：当月生效
    var entry2={name:eraName, startYear:curYear, startMonth:startMonth, startDay:1};
    GM.eraNames.push(entry2);
    P.time.eraNames.push(entry2);
    GM.eraName=eraName; // 立即设置
    narrative='圣旨下，即日改元"'+eraName+'"！新君乾纲独断，废旧号启新元。\n锐意革新之气令人振奋，然朝中亦有老臣私议，以为操之过急。';
  }

  // 记入起居注
  if(GM.qijuHistory){
    GM.qijuHistory.unshift({
      turn:GM.turn,
      date:getTSText?getTSText(GM.turn):'第1回合',
      content:'【即位改元】'+narrative
    });
  }

  // 记入编年
  if(GM.biannianItems){
    GM.biannianItems.unshift({
      turn:GM.turn,
      date:getTSText?getTSText(GM.turn):'',
      title:'新君即位·议定年号"'+eraName+'"',
      content:narrative,
      importance:'high'
    });
  }

  saveP();
  renderLeftPanel();
  toast('年号已定：'+eraName+(mode==='tradition'?' （踰年改元，明年正月生效）':' （即刻改元）'));
}

// ============================================================
// ============================================================
// 5.4: 外交谈判——派遣使臣
// ============================================================

function openDiplomacyPanel() {
  // 可选使臣列表（存活的非玩家角色）
  var envoys = (GM.chars||[]).filter(function(c){return c.alive!==false && !c.isPlayer;});
  var envoyOptions = envoys.map(function(c){
    return '<option value="'+c.name.replace(/"/g,'&quot;')+'">'+escHtml(c.name)+' (\u5916\u4EA4'+Math.round(c.diplomacy||50)+' \u667A'+Math.round(c.intelligence||50)+')</option>';
  }).join('');

  var factionOptions = (GM.facs||[]).filter(function(f){
    return f.name !== (P.playerInfo&&P.playerInfo.factionName||'');
  }).map(function(f){
    return '<option value="'+escHtml(f.name)+'">'+escHtml(f.name)+'</option>';
  }).join('');

  var html = '<div style="padding:1rem;">';
  html += '<div style="font-size:1rem;font-weight:700;color:var(--color-primary);margin-bottom:0.8rem;">\u9063\u4F7F\u51FA\u4F7F</div>';
  html += '<div class="form-group"><label>\u76EE\u6807\u52BF\u529B</label><select id="diplo-target">'+factionOptions+'</select></div>';
  html += '<div class="form-group"><label>\u6307\u5B9A\u4F7F\u81E3</label><select id="diplo-envoy">'+envoyOptions+'</select></div>';
  html += '<div class="form-group"><label>\u8C08\u5224\u8981\u6C42</label><textarea id="diplo-terms" rows="3" style="width:100%;" placeholder="\u5982\uFF1A\u5272\u8BA9\u6CB3\u5317\u4E09\u9547\u3001\u6BCF\u5E74\u8FDB\u8D21\u5E1B\u4E09\u4E07\u5339\u3001\u548C\u4EB2\u516C\u4E3B..."></textarea></div>';
  html += '<div class="form-group"><label>\u5E95\u7EBF</label><textarea id="diplo-bottom" rows="2" style="width:100%;" placeholder="\u53EF\u63A5\u53D7\u7684\u6700\u4F4E\u6761\u4EF6\uFF08\u4F7F\u81E3\u4F4E\u4E8E\u6B64\u5E95\u7EBF\u4E0D\u53EF\u7B54\u5E94\uFF09"></textarea></div>';
  html += '<button class="bt bp" onclick="sendDiplomaticMission()" style="width:100%;margin-top:0.5rem;">\u9063\u4F7F\u51FA\u53D1</button>';
  html += '</div>';

  showTurnResult(html);
}

function sendDiplomaticMission() {
  var target = (document.getElementById('diplo-target')||{}).value;
  var envoyName = (document.getElementById('diplo-envoy')||{}).value;
  var terms = (document.getElementById('diplo-terms')||{}).value;
  var bottom = (document.getElementById('diplo-bottom')||{}).value;
  if (!target || !envoyName || !terms) { toast('\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F'); return; }

  // 存入GM待处理外交任务
  if (!GM._diplomaticMissions) GM._diplomaticMissions = [];
  GM._diplomaticMissions.push({
    target: target,
    envoy: envoyName,
    terms: terms,
    bottomLine: bottom,
    sentTurn: GM.turn,
    status: 'traveling' // traveling → negotiating → result
  });

  closeTurnResult();
  toast(envoyName + '\u5DF2\u643A\u56FD\u4E66\u51FA\u53D1\u524D\u5F80' + target);
  if (typeof addEB === 'function') addEB('\u5916\u4EA4', '\u9063' + envoyName + '\u51FA\u4F7F' + target);
}

// ============================================================
// 5.6: 制度改革——通过变量系统运作
// 玩家可通过诏令发起改革（如"推行募兵制"），AI在resource_changes中
// 动态创建/推进改革进度变量（如"募兵制改革进度"），0→100代表过渡过程。
// 不需要独立的UI面板——改革是诏令的一种，由AI自行叙事和推进。
// ============================================================

// 2.5: 朝政中心面板
// ============================================================

function _renderZhaozhengCenter() {
  var _ti = typeof tmIcon === 'function' ? tmIcon : function(){return '';};

  // 检查各操作可用性
  function _canKeju() {
    if (!P.keju || !P.keju.enabled) return {ok:false,reason:'\u672A\u5F00\u542F\u79D1\u4E3E\u5236\u5EA6'};
    if (P.keju.currentExam) return {ok:false,reason:'\u79D1\u4E3E\u8FDB\u884C\u4E2D'};
    return {ok:true};
  }
  function _canChaoyi() {
    if (typeof startChaoyiSession !== 'function') return {ok:false,reason:'\u672A\u52A0\u8F7D\u671D\u8BAE\u6A21\u5757'};
    return {ok:true};
  }
  function _canProvince() {
    if (typeof openProvinceEconomy !== 'function') return {ok:false,reason:'\u672A\u52A0\u8F7D\u7701\u4EFD\u6A21\u5757'};
    if (!GM.provinceStats || Object.keys(GM.provinceStats).length === 0) return {ok:false,reason:'\u65E0\u7701\u4EFD\u6570\u636E'};
    return {ok:true};
  }
  function _canMap() {
    return (P.map && P.map.regions && P.map.regions.length > 0) ? {ok:true} : {ok:false,reason:'\u65E0\u5730\u56FE\u6570\u636E'};
  }
  function _hasTech() { return typeof renderTechTree === 'function' && P.techTree; }
  function _hasCivic() { return typeof renderCivicTree === 'function' && P.civicTree; }

  // 操作条目结构
  var groups = [
    { label: '\u5185\u653F', icon: 'office', color: 'var(--indigo-400)', items: [
      {label:'\u4E0B\u8BCF\u4EE4', sub:'\u653F\u4EE4/\u519B\u4EE4/\u5916\u4EA4/\u7ECF\u6D4E', action:'switchGTab(null,"gt-edict")', icon:'scroll', ok:true},
      {label:'\u79D1\u4E3E\u53D6\u58EB', sub:'\u5F00\u79D1\u53D6\u58EB', action:'openKejuPanel()', icon:'scroll', ok:_canKeju().ok, reason:_canKeju().reason},
      {label:'\u5730\u65B9\u533A\u5212', sub:'\u67E5\u770B\u5730\u65B9\u884C\u653F', action:'openProvinceEconomy()', icon:'treasury', ok:_canProvince().ok, reason:_canProvince().reason},
      {label:'\u5730\u65B9\u8206\u60C5', sub:'\u5404\u9053\u5DDE\u5E9C\u6C11\u60C5', action:'switchGTab(null,"gt-difang");_renderDifangPanel()', icon:'faction', ok:!!P.adminHierarchy, reason:P.adminHierarchy?'':'\u65E0\u884C\u653F\u533A\u5212'}
    ]},
    { label: '\u519B\u4E8B', icon: 'troops', color: 'var(--vermillion-400)', items: [
      {label:'\u519B\u4E8B\u8BCF\u4EE4', sub:'\u8C03\u5175\u9063\u5C06', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-mil");if(el)el.focus()', icon:'troops', ok:true},
      {label:'\u5236\u5EA6\u6539\u9769', sub:'\u901A\u8FC7\u8BCF\u4EE4\u53D1\u8D77', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-pol");if(el){el.focus();el.placeholder="\u5982\uFF1A\u63A8\u884C\u52DF\u5175\u5236/\u6539\u9769\u7A0E\u5236/\u5B9E\u884C\u79D1\u4E3E...";}', icon:'scroll', ok:true},
      {label:'\u5730\u56FE\u603B\u89C8', sub:'\u52BF\u529B\u5206\u5E03', action:'showMapInGame()', icon:'map', ok:_canMap().ok, reason:_canMap().reason}
    ]},
    { label: '\u4EBA\u4E8B', icon: 'person', color: 'var(--gold-400)', items: [
      {label:'\u5B98\u5236\u4EFB\u514D', sub:'\u67E5\u770B\u5B98\u5236\u6811', action:'switchGTab(null,"gt-office")', icon:'office', ok:true},
      {label:'\u4EBA\u7269\u5FD7', sub:'\u67E5\u770B\u5168\u90E8\u89D2\u8272', action:'switchGTab(null,"gt-renwu")', icon:'person', ok:true},
      {label:'\u95EE\u5BF9\u81E3\u5B50', sub:'\u4E0E\u89D2\u8272\u5BF9\u8BDD', action:'switchGTab(null,"gt-wendui")', icon:'dialogue', ok:true}
    ]},
    { label: '\u5916\u4EA4', icon: 'faction', color: 'var(--celadon-400)', items: [
      {label:'\u5916\u4EA4\u8BCF\u4EE4', sub:'\u9063\u4F7F/\u548C\u4EB2/\u7ED3\u76DF', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-dip");if(el)el.focus()', icon:'scroll', ok:true},
      {label:'\u9063\u4F7F\u51FA\u4F7F', sub:'\u6D3E\u9063\u4F7F\u81E3\u8C08\u5224', action:'openDiplomacyPanel()', icon:'faction', ok:true},
      {label:'\u9E3F\u96C1\u4F20\u4E66', sub:'\u53D1\u9001\u5BC6\u4FE1', action:'switchGTab(null,"gt-letter")', icon:'scroll', ok:true}
    ]},
    { label: '\u53D1\u5C55', icon: 'policy', color: 'var(--amber-400,#f59e0b)', items: [
      {label:'\u79D1\u6280\u6811', sub:'\u519B\u4E8B/\u6C11\u7528\u79D1\u6280', action:'switchGTab(null,"gt-tech")', icon:'policy', ok:!!_hasTech(), reason:_hasTech()?'':'\u672A\u914D\u7F6E\u79D1\u6280\u6811'},
      {label:'\u6C11\u653F\u6811', sub:'\u57CE\u5E02/\u653F\u7B56', action:'switchGTab(null,"gt-civic")', icon:'policy', ok:!!_hasCivic(), reason:_hasCivic()?'':'\u672A\u914D\u7F6E\u6C11\u653F\u6811'},
      {label:'\u671D\u8BAE', sub:'\u53EC\u5F00\u5EF7\u8BAE', action:'startChaoyiSession()', icon:'dialogue', ok:_canChaoyi().ok, reason:_canChaoyi().reason}
    ]}
  ];

  var html = '<div style="text-align:center;margin-bottom:0.8rem;"><div style="font-size:var(--text-lg,1.1rem);font-weight:700;color:var(--color-primary);letter-spacing:0.15em;">\u3014 \u671D \u653F \u4E2D \u5FC3 \u3015</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-top:0.2rem;">\u7B2C' + (GM.turn||1) + '\u56DE\u5408 \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '</div></div>';

  groups.forEach(function(g) {
    html += '<div class="zz-group">';
    html += '<div class="zz-group-title" style="--gc:' + g.color + ';">' + _ti(g.icon,13) + ' ' + g.label + '</div>';
    html += '<div class="zz-items">';
    g.items.forEach(function(item) {
      var cls = item.ok ? 'zz-item' : 'zz-item disabled';
      var onclick = item.ok ? ' onclick="' + item.action.replace(/"/g, '&quot;') + '"' : '';
      html += '<div class="' + cls + '"' + onclick + '>';
      html += '<div class="zz-item-icon">' + _ti(item.icon, 16) + '</div>';
      html += '<div class="zz-item-text"><div class="zz-item-label">' + item.label + '</div>';
      if (item.sub) html += '<div class="zz-item-sub">' + item.sub + '</div>';
      html += '</div>';
      if (item.ok) {
        html += '<div class="zz-item-status ok">\u25CF</div>';
      } else {
        html += '<div class="zz-item-status no" title="' + escHtml(item.reason||'') + '">\u25CB ' + escHtml(item.reason||'') + '</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  });

  // 快捷状态摘要
  html += '<div class="zz-summary">';
  var _treasury = GM.stateTreasury || 0;
  var _wars = GM.activeWars ? GM.activeWars.length : 0;
  html += '<span>\u56FD\u5E93 ' + Math.round(_treasury) + '</span>';
  if (_wars > 0) html += '<span style="color:var(--vermillion-400);">\u6218\u4E89 ' + _wars + '</span>';
  html += '</div>';

  return html;
}

// 2.8: 无障碍增强——为动态生成的UI元素补充ARIA标签
function _applyA11y() {
  // Tab栏标记为tablist
  var tabBars = document.querySelectorAll('.g-tab-btn');
  tabBars.forEach(function(btn) {
    btn.setAttribute('role', 'tab');
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', btn.textContent.trim());
  });
  // 操作按钮
  document.querySelectorAll('.ngui-action').forEach(function(btn) {
    btn.setAttribute('role', 'button');
    var title = btn.querySelector('.ngui-action-title');
    if (title && !btn.getAttribute('aria-label')) btn.setAttribute('aria-label', title.textContent.trim());
  });
  // 朝政中心操作项
  document.querySelectorAll('.zz-item').forEach(function(item) {
    if (!item.classList.contains('disabled')) item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    var label = item.querySelector('.zz-item-label');
    if (label) item.setAttribute('aria-label', label.textContent.trim());
    // 键盘回车触发点击
    item.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } });
  });
  // 结算按钮
  var endBtn = document.getElementById('btn-end-turn');
  if (endBtn) endBtn.setAttribute('aria-label', '\u7ED3\u675F\u672C\u56DE\u5408');
}
// 首次加载后调用
setTimeout(_applyA11y, 1000);

// 2.7: 移动端底部导航栏
function _initMobileNav() {
  if (document.getElementById('mobile-nav')) return;
  if (window.innerWidth > 768) return;
  var nav = document.createElement('div');
  nav.id = 'mobile-nav';
  nav.innerHTML = '<button onclick="_toggleMobilePanel(\'left\')">\u2630 \u6982\u89C8</button>' +
    '<button onclick="switchGTab(null,\'gt-edict\')">\u270D \u8BCF\u4EE4</button>' +
    '<button onclick="confirmEndTurn()">\u23F3 \u7ED3\u7B97</button>' +
    '<button onclick="_toggleMobilePanel(\'right\')">\u2699 \u64CD\u4F5C</button>';
  document.body.appendChild(nav);
}
function _toggleMobilePanel(side) {
  if (side === 'left') {
    var lp = document.querySelector('.ngui-left');
    if (lp) lp.classList.toggle('mobile-open');
    var rp = document.querySelector('.ngui-right');
    if (rp) rp.classList.remove('mobile-open');
  } else {
    var rp2 = document.querySelector('.ngui-right');
    if (rp2) rp2.classList.toggle('mobile-open');
    var lp2 = document.querySelector('.ngui-left');
    if (lp2) lp2.classList.remove('mobile-open');
  }
}
// 监听窗口大小变化 + 启动时检查
if (typeof window !== 'undefined') {
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 768) _initMobileNav();
    else { var mn = document.getElementById('mobile-nav'); if (mn) mn.remove(); }
  });
  // 启动时也检查一次
  window.addEventListener('DOMContentLoaded', function() {
    if (window.innerWidth <= 768) _initMobileNav();
  });
}

// ============================================================
// 2.2: 角色交互快捷面板
// ============================================================

/**
 * 显示角色快捷面板（点击角色名时弹出）
 * @param {string} charName - 角色名
 * @param {Event} evt - 点击事件
 */
// ============================================================
// 问天系统——玩家与推演AI的元通信通道
// ============================================================

function openWentian() {
  var old = _$('wentian-modal');
  if (old) { old.remove(); return; }

  if (!GM._playerDirectives) GM._playerDirectives = [];
  if (!GM._importedMemories) GM._importedMemories = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];

  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'wentian-modal';
  modal.style.cssText = '-webkit-app-region:no-drag;';
  modal.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);width:95%;max-width:700px;height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg);">'
    // 头部
    + '<div style="padding:0.6rem 1rem;border-bottom:1px solid var(--color-border-subtle);display:flex;justify-content:space-between;align-items:center;">'
    + '<div style="font-size:var(--text-md);font-weight:var(--weight-bold);color:var(--gold-400);letter-spacing:0.15em;">\u95EE\u5929</div>'
    + '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u4E0E\u63A8\u6F14AI\u76F4\u63A5\u5BF9\u8BDD\u2014\u2014\u4E0B\u56DE\u5408\u751F\u6548</div>'
    + '<button class="bt bsm" onclick="_$(\'wentian-modal\').remove();">\u2715</button>'
    + '</div>'
    // 对话区
    + '<div id="wt-chat" style="flex:1;overflow-y:auto;padding:0.8rem;background:var(--color-sunken);"></div>'
    // 输入区
    + '<div style="padding:0.6rem;border-top:1px solid var(--color-border-subtle);">'
    + '<div style="display:flex;gap:var(--space-1);margin-bottom:var(--space-1);">'
    + '<button class="bt bsm" onclick="_wtImportDoc()" title="\u5BFC\u5165\u6587\u6863\u4F5C\u4E3A\u63A8\u6F14\u4E0A\u4E0B\u6587">\u5BFC\u5165\u6587\u6863</button>'
    + '<button class="bt bsm" onclick="_wtImportMemory()" title="\u5BFC\u5165\u5BF9\u8BDD\u8BB0\u5F55\u4F5C\u4E3ANPC\u8BB0\u5FC6">\u6CE8\u5165\u8BB0\u5FC6</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wtClearDirectives()" title="\u6E05\u9664\u6240\u6709\u73A9\u5BB6\u6307\u4EE4">\u6E05\u9664\u6307\u4EE4</button>'
    + '<span style="margin-left:auto;font-size:0.6rem;color:var(--ink-300);">\u6307\u4EE4' + GM._playerDirectives.length + ' \u8BB0\u5FC6' + GM._importedMemories.length + '</span>'
    + '</div>'
    + '<div style="display:flex;gap:var(--space-2);">'
    + '<textarea id="wt-input" placeholder="\u5BF9\u63A8\u6F14AI\u8BF4\u2026\u2026\uFF08\u7EA0\u6B63\u63A8\u6F14/\u52A0\u5165\u89C4\u5219/\u52A0\u5165\u5185\u5BB9\uFF09" rows="3" style="flex:1;resize:none;padding:0.4rem;font-size:var(--text-sm);font-family:inherit;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-foreground);"></textarea>'
    + '<button class="bt bp" onclick="_wtSend()" style="padding:0.4rem 1rem;align-self:flex-end;">\u95EE\u5929</button>'
    + '</div></div></div>';
  document.body.appendChild(modal);
  _wtRenderHistory();
}

/** 渲染问天对话历史 */
function _wtRenderHistory() {
  var chat = _$('wt-chat'); if (!chat) return;
  var html = '';
  // 欢迎信息
  html += '<div style="text-align:center;font-size:0.72rem;color:var(--ink-300);padding:0.5rem;margin-bottom:0.5rem;">\u95EE\u5929\u7CFB\u7EDF\u2014\u2014\u60A8\u7684\u6307\u4EE4\u5C06\u5728\u4E0B\u56DE\u5408\u63A8\u6F14\u65F6\u751F\u6548</div>';
  // 已有指令
  if (GM._playerDirectives && GM._playerDirectives.length > 0) {
    html += '<div style="font-size:0.65rem;color:var(--gold-400);margin-bottom:var(--space-1);">\u6D3B\u8DC3\u6307\u4EE4 (' + GM._playerDirectives.length + ')</div>';
    GM._playerDirectives.forEach(function(d, i) {
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem;">';
      html += '<div style="max-width:85%;background:var(--color-accent-subtle);border-right:3px solid var(--gold-400);border-radius:var(--radius-md) 2px 2px var(--radius-md);padding:0.4rem 0.6rem;font-size:var(--text-xs);">';
      html += '<div style="font-size:0.6rem;color:var(--gold-400);margin-bottom:2px;">T' + (d.turn||'?') + ' ' + (d.type === 'rule' ? '\u89C4\u5219' : d.type === 'correction' ? '\u7EA0\u6B63' : d.type === 'content' ? '\u5185\u5BB9' : '\u6307\u4EE4') + '</div>';
      html += escHtml(d.content);
      html += '<button style="font-size:0.55rem;color:var(--vermillion-400);background:none;border:none;cursor:pointer;margin-left:4px;" onclick="GM._playerDirectives.splice(' + i + ',1);_wtRenderHistory();">\u2715</button>';
      html += '</div></div>';
    });
  }
  // 已导入记忆
  if (GM._importedMemories && GM._importedMemories.length > 0) {
    html += '<div style="font-size:0.65rem;color:var(--celadon-400);margin-bottom:var(--space-1);">\u5DF2\u5BFC\u5165\u8BB0\u5FC6 (' + GM._importedMemories.length + ')</div>';
    GM._importedMemories.forEach(function(m, i) {
      html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);padding:2px 6px;background:var(--color-elevated);border-radius:3px;margin-bottom:2px;display:flex;justify-content:space-between;">';
      html += '<span>' + escHtml((m.title||'').slice(0,40) || m.content.slice(0,40)) + '\u2026</span>';
      html += '<button style="font-size:0.55rem;color:var(--vermillion-400);background:none;border:none;cursor:pointer;" onclick="GM._importedMemories.splice(' + i + ',1);_wtRenderHistory();">\u2715</button>';
      html += '</div>';
    });
  }
  // 对话历史
  (GM._wentianHistory||[]).forEach(function(h) {
    if (h.role === 'player') {
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem;"><div style="max-width:85%;background:var(--color-accent-subtle);border-right:3px solid var(--vermillion-400);border-radius:var(--radius-md) 2px 2px var(--radius-md);padding:0.4rem 0.6rem;font-size:var(--text-sm);color:var(--color-foreground);">' + escHtml(h.content) + '</div></div>';
    } else {
      html += '<div style="display:flex;margin-bottom:0.4rem;"><div style="max-width:85%;background:var(--color-elevated);border-left:3px solid var(--gold-500);border-radius:2px var(--radius-md) var(--radius-md) 2px;padding:0.4rem 0.6rem;font-size:var(--text-sm);color:var(--color-foreground-secondary);">' + escHtml(h.content) + '</div></div>';
    }
  });
  chat.innerHTML = html;
  chat.scrollTop = chat.scrollHeight;
}

/** 发送问天指令 */
function _wtSend() {
  var input = _$('wt-input');
  var content = input ? input.value.trim() : '';
  if (!content) return;
  if (input) input.value = '';

  // 判断类型
  var type = 'directive';
  if (/纠正|错了|不对|不应该|不合理/.test(content)) type = 'correction';
  else if (/规则|必须|不得|要求|禁止|总是/.test(content)) type = 'rule';
  else if (/加入|增加|设定|背景|补充/.test(content)) type = 'content';

  if (!GM._playerDirectives) GM._playerDirectives = [];
  GM._playerDirectives.push({ content: content, type: type, turn: GM.turn });

  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'player', content: content, turn: GM.turn });
  // AI确认回应
  GM._wentianHistory.push({ role: 'system', content: '\u2705 \u6536\u5230\u3002\u6B64\u6307\u4EE4\u5C06\u5728\u4E0B\u56DE\u5408\u63A8\u6F14\u65F6\u751F\u6548\u3002' + (type === 'rule' ? '\uFF08\u5DF2\u6807\u8BB0\u4E3A\u6301\u4E45\u89C4\u5219\uFF0C\u6BCF\u56DE\u5408\u90FD\u4F1A\u9075\u5B88\uFF09' : type === 'correction' ? '\uFF08\u5DF2\u6807\u8BB0\u4E3A\u7EA0\u6B63\uFF0C\u5C06\u5728\u4E0B\u56DE\u5408\u8C03\u6574\uFF09' : '') });

  _wtRenderHistory();
  toast('\u6307\u4EE4\u5DF2\u5F55\u5165\u2014\u2014\u4E0B\u56DE\u5408\u751F\u6548');
}

/** 导入文档 */
function _wtImportDoc() {
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.md,.json,.log';
  fileInput.onchange = function() {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      if (!GM._importedMemories) GM._importedMemories = [];
      GM._importedMemories.push({ title: file.name, content: text, type: 'document', turn: GM.turn });
      if (!GM._wentianHistory) GM._wentianHistory = [];
      GM._wentianHistory.push({ role: 'player', content: '\u3010\u5BFC\u5165\u6587\u6863\u3011' + file.name + ' (' + Math.round(text.length/1000) + 'KB)', turn: GM.turn });
      GM._wentianHistory.push({ role: 'system', content: '\u2705 \u6587\u6863\u5DF2\u5BFC\u5165\u4E3A\u63A8\u6F14\u4E0A\u4E0B\u6587\u3002AI\u5C06\u5728\u63A8\u6F14\u65F6\u53C2\u8003\u6B64\u6587\u6863\u5185\u5BB9\u3002' });
      _wtRenderHistory();
      toast('\u6587\u6863\u5DF2\u5BFC\u5165\uFF1A' + file.name);
    };
    reader.readAsText(file);
  };
  fileInput.click();
}

/** 导入对话记录作为NPC记忆 */
function _wtImportMemory() {
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem;max-width:500px;width:95%;">'
    + '<div style="font-size:var(--text-sm);color:var(--gold-400);margin-bottom:var(--space-2);">\u6CE8\u5165\u8BB0\u5FC6</div>'
    + '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-bottom:var(--space-2);">\u7C98\u8D34\u5BF9\u8BDD\u8BB0\u5F55\u6216\u6587\u5B57\uFF0C\u4F5C\u4E3ANPC\u8BB0\u5FC6\u6216\u5168\u5C40\u80CC\u666F\u6CE8\u5165\u63A8\u6F14</div>'
    + '<div style="margin-bottom:var(--space-2);"><label style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u76EE\u6807NPC\uFF08\u7559\u7A7A=\u5168\u5C40\u80CC\u666F\uFF09</label>'
    + '<input id="wt-mem-target" placeholder="\u89D2\u8272\u540D\uFF08\u53EF\u7559\u7A7A\uFF09" style="width:100%;padding:3px 6px;font-size:var(--text-xs);background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-family:inherit;margin-top:2px;"></div>'
    + '<div style="margin-bottom:var(--space-2);"><label style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u8BB0\u5FC6\u5185\u5BB9</label>'
    + '<textarea id="wt-mem-content" rows="8" placeholder="\u7C98\u8D34\u5BF9\u8BDD\u8BB0\u5F55\u6216\u80CC\u666F\u6587\u5B57\u2026" style="width:100%;padding:0.4rem;font-size:var(--text-xs);font-family:inherit;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-foreground);margin-top:2px;resize:vertical;"></textarea></div>'
    + '<div style="display:flex;gap:var(--space-2);justify-content:flex-end;">'
    + '<button class="bt bp" onclick="_wtDoImportMemory();this.closest(\'div[style*=fixed]\').remove();">\u6CE8\u5165</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}

function _wtDoImportMemory() {
  var target = (_$('wt-mem-target')||{}).value || '';
  var content = (_$('wt-mem-content')||{}).value || '';
  if (!content.trim()) { toast('\u8BF7\u8F93\u5165\u8BB0\u5FC6\u5185\u5BB9'); return; }

  if (target.trim()) {
    // 写入特定NPC记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(target.trim(), content.trim(), '\u5E73', 8, '\u5916\u90E8\u5BFC\u5165');
      toast('\u5DF2\u6CE8\u5165' + target + '\u7684\u8BB0\u5FC6');
    }
  }
  // 同时存入全局imported memories（供AI推演参考）
  if (!GM._importedMemories) GM._importedMemories = [];
  GM._importedMemories.push({ title: target ? '\u8BB0\u5FC6\u6CE8\u5165\u2192' + target : '\u5168\u5C40\u80CC\u666F', content: content.trim(), type: 'memory', target: target.trim(), turn: GM.turn });
  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'player', content: '\u3010\u8BB0\u5FC6\u6CE8\u5165\u3011' + (target ? target + '\uFF1A' : '\u5168\u5C40\uFF1A') + content.trim().slice(0,50) + '\u2026', turn: GM.turn });
  GM._wentianHistory.push({ role: 'system', content: '\u2705 \u8BB0\u5FC6\u5DF2\u6CE8\u5165\u3002' + (target ? target + '\u5C06\u8BB0\u4F4F\u6B64\u5185\u5BB9\u3002' : '\u5DF2\u4F5C\u4E3A\u5168\u5C40\u63A8\u6F14\u80CC\u666F\u3002') });
  _wtRenderHistory();
}

/** 清除所有玩家指令 */
function _wtClearDirectives() {
  if (!confirm('\u786E\u5B9A\u6E05\u9664\u6240\u6709\u7384\u5929\u6307\u4EE4\uFF1F')) return;
  GM._playerDirectives = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'system', content: '\u6240\u6709\u6307\u4EE4\u5DF2\u6E05\u9664\u3002' });
  _wtRenderHistory();
  toast('\u6307\u4EE4\u5DF2\u6E05\u9664');
}

function showCharPopup(charName, evt) {
  // 移除已有的popup
  var old = document.querySelector('.char-popup');
  if (old) old.remove();

  var ch = findCharByName(charName);
  if (!ch) {
    // 未找到·显示"查找档案"弹窗·触发 crystallizePendingCharacter
    _showCharNotFoundPopup(charName, evt);
    return;
  }

  // 构建面板内容
  var html = '<div class="char-popup-header" style="display:flex;gap:8px;align-items:flex-start;">';
  // 立绘头像
  if (ch.portrait) {
    html += '<img src="' + escHtml(ch.portrait) + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;">';
  }
  html += '<div>';
  var facColor = '#888';
  (GM.facs || []).forEach(function(f) { if (f.name === ch.faction && f.color) facColor = f.color; });
  html += '<div class="char-popup-name" style="color:' + facColor + ';">' + escHtml(ch.name) + '</div>';
  if (ch.title) html += '<div class="char-popup-title">' + escHtml(ch.title) + '</div>';
  if (ch.faction) html += '<div class="char-popup-faction" style="border-color:' + facColor + ';">' + escHtml(ch.faction) + '</div>';
  html += '</div></div>';

  // 核心属性
  html += '<div class="char-popup-stats">';
  var _stats = [
    {label:'忠诚', val:ch.loyalty, max:100, color:(ch.loyalty||50)>60?'var(--celadon-400)':'var(--vermillion-400)'},
    {label:'能力', val:ch.ability||ch.competence||50, max:100, color:'var(--gold-400)'},
    {label:'野心', val:ch.ambition||50, max:100, color:(ch.ambition||50)>70?'var(--vermillion-400)':'var(--color-foreground-muted)'},
    {label:'外交', val:ch.diplomacy||50, max:100, color:'var(--gold-400)'},
    {label:'压力', val:ch.stress||0, max:100, color:(ch.stress||0)>60?'var(--vermillion-400)':'var(--celadon-400)'}
  ];
  _stats.forEach(function(s) {
    var pct = Math.round((s.val || 0) / s.max * 100);
    html += '<div class="char-popup-stat"><span class="stat-label">' + s.label + '</span>';
    html += '<div class="stat-bar"><div class="stat-fill" style="width:' + pct + '%;background:' + s.color + ';"></div></div>';
    html += '<span class="stat-val">' + Math.round(s.val || 0) + '</span></div>';
  });
  html += '</div>';

  // 官职（从官制树提取完整信息）
  var _offInfo = typeof _offGetCharInfo === 'function' ? _offGetCharInfo(charName) : null;
  if (_offInfo && _offInfo.current) {
    var _rkI = typeof getRankInfo === 'function' ? getRankInfo(_offInfo.current.rank) : null;
    html += '<div class="char-popup-info" style="border-left:3px solid var(--gold-400);padding-left:6px;">';
    html += '<div style="font-size:0.78rem;color:var(--gold-400);font-weight:700;">' + escHtml(_offInfo.current.dept) + ' · ' + escHtml(_offInfo.current.pos);
    if (_offInfo.current.rank) html += ' <span style="color:' + (_rkI ? _rkI.color : 'var(--ink-300)') + ';">（' + escHtml(_offInfo.current.rank) + '）</span>';
    html += '</div>';
    html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">任期' + _offInfo.current.tenure + '回合';
    if (_offInfo.lastEval) html += ' · 考评：' + escHtml(_offInfo.lastEval.grade||'');
    if (_offInfo.satisfaction) html += ' · ' + escHtml(_offInfo.satisfaction.label);
    html += '</div>';
    html += '</div>';
  } else if (_offInfo && _offInfo.mourning) {
    html += '<div class="char-popup-info" style="color:var(--ink-300);font-size:0.75rem;">丁忧守丧中（因' + escHtml(_offInfo.mourning.parent||'') + '去世）</div>';
  } else if (ch.office || ch.position || ch.officialTitle) {
    html += '<div class="char-popup-info">' + escHtml(ch.officialTitle || ch.office || ch.position) + '</div>';
  }
  // 仕途按钮
  if (_offInfo && _offInfo.career.length > 0) {
    html += '<div style="margin:4px 0;"><button class="bt bsm" style="font-size:0.65rem;" onclick="_offShowCareer(\'' + escHtml(charName).replace(/'/g,"\\'") + '\')">\u67E5\u770B\u5B8C\u6574\u4ED5\u9014</button></div>';
  }
  // 所在地
  if (ch.location) {
    html += '<div class="char-popup-info" style="font-size:0.7rem;">所在：' + escHtml(ch.location) + '</div>';
  }

  // 关系网
  var _rels = [];
  if (GM.rels) {
    Object.keys(GM.rels).forEach(function(k) {
      if (k.indexOf(ch.name) >= 0) {
        var other = k.replace(ch.name, '').replace(/[→←↔\-_]/g, '').trim();
        if (other && GM.rels[k].value !== 0) _rels.push({name: other, val: GM.rels[k].value});
      }
    });
  }
  if (ch.affinities) {
    Object.keys(ch.affinities).forEach(function(k) {
      if (!_rels.find(function(r){return r.name===k;})) {
        _rels.push({name: k, val: ch.affinities[k]});
      }
    });
  }
  if (_rels.length > 0) {
    _rels.sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
    html += '<div class="char-popup-section"><div class="char-popup-section-title">\u5173\u7CFB</div>';
    _rels.slice(0, 4).forEach(function(r) {
      var col = r.val > 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)';
      var icon = r.val > 20 ? '\u2665' : r.val < -20 ? '\u2694' : '\u00B7';
      html += '<div style="font-size:0.72rem;display:flex;justify-content:space-between;"><span>' + icon + ' ' + escHtml(r.name) + '</span><span style="color:' + col + ';">' + (r.val > 0 ? '+' : '') + Math.round(r.val) + '</span></div>';
    });
    html += '</div>';
  }

  // 操作按钮
  html += '<div class="char-popup-actions">';
  if (!ch.isPlayer) {
    html += '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();switchGTab(null,\'gt-wendui\');GM._pendingWenduiChar=\'' + ch.name.replace(/'/g,"\\'") + '\';">\u95EE\u5BF9</button>';
  }
  if (typeof openAppointModal === 'function' && !ch.isPlayer) {
    html += '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();openAppointModal(\'' + ch.name.replace(/'/g,"\\'") + '\');">\u4EFB\u547D</button>';
  }
  html += '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();if(typeof openCharDetail===\'function\')openCharDetail(\'' + ch.name.replace(/'/g,"\\'") + '\');else if(typeof showCharDetail===\'function\')showCharDetail(\'' + ch.name.replace(/'/g,"\\'") + '\');else switchGTab(null,\'gt-renwu\');">\u8BE6\u60C5</button>';
  html += '</div>';

  // 创建popup元素
  var popup = document.createElement('div');
  popup.className = 'char-popup';
  popup.innerHTML = html;
  // 预设 max-height 以便真正超出屏幕时可滚动
  popup.style.maxHeight = 'calc(100vh - 24px)';
  popup.style.overflowY = 'auto';
  popup.style.maxWidth = Math.min(380, window.innerWidth - 24) + 'px';
  document.body.appendChild(popup);

  // 定位·考虑全屏边界·不能超出
  _positionCharPopup(popup, evt);

  // 点击外部关闭
  setTimeout(function() {
    function _closePopup(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('mousedown', _closePopup); }
    }
    document.addEventListener('mousedown', _closePopup);
  }, 50);
}

/** 人物卡片定位·自动适配屏幕·避免溢出 */
function _positionCharPopup(popup, evt) {
  var rect = popup.getBoundingClientRect();
  var _evt = evt || (typeof window !== 'undefined' ? window.event : null);
  var margin = 12;
  var w = rect.width, h = rect.height;
  var vw = window.innerWidth, vh = window.innerHeight;
  var x, y;
  if (_evt && typeof _evt.clientX === 'number' && typeof _evt.clientY === 'number') {
    // 优先右下·若挤边则翻到左边或上方
    x = _evt.clientX + 10;
    y = _evt.clientY + 10;
    // 右边溢出·改放鼠标左侧
    if (x + w > vw - margin) x = Math.max(margin, _evt.clientX - w - 10);
    // 下边溢出·改放鼠标上方
    if (y + h > vh - margin) y = Math.max(margin, _evt.clientY - h - 10);
  } else {
    // 无 evt 信息·居中
    x = Math.max(margin, (vw - w) / 2);
    y = Math.max(margin, (vh - h) / 2);
  }
  // 最终保险·仍溢出时钳制
  if (x + w > vw - margin) x = Math.max(margin, vw - w - margin);
  if (y + h > vh - margin) y = Math.max(margin, vh - h - margin);
  if (x < margin) x = margin;
  if (y < margin) y = margin;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
}

/** 未找到人物·弹"查找档案"提示卡·点击按钮调 crystallize 触发详细生成 */
function _showCharNotFoundPopup(charName, evt) {
  var old = document.querySelector('.char-popup');
  if (old) old.remove();
  var popup = document.createElement('div');
  popup.className = 'char-popup';
  var safeName = (charName||'').replace(/'/g, "\\'");
  popup.innerHTML = ''
    + '<div class="char-popup-header" style="display:flex;gap:8px;align-items:flex-start;">'
    +   '<div>'
    +     '<div class="char-popup-name" style="color:var(--amber-400);">' + escHtml(charName) + '</div>'
    +     '<div class="char-popup-title" style="color:var(--ink-300);">\u6863\u6848\u672A\u5F55</div>'
    +   '</div>'
    + '</div>'
    + '<div class="char-popup-info" style="font-size:0.78rem;line-height:1.7;color:var(--color-foreground-muted);margin-top:4px;">'
    +   '\u6B64\u4EBA\u5C1A\u672A\u5F55\u5165\u4EBA\u7269\u5FD7\u3002\u94E8\u66F9\u53EF\u67E5\u627E\u5176\u6765\u5386\u00B7\u5982\u7CFB\u53F2\u5B9E\u4EBA\u7269\u5219\u91C7\u53F2\u4E66\u7ACB\u4F20\u00B7\u5982\u867A\u6784\u5219\u6784\u5176\u8EAB\u4E16\u3002'
    + '</div>'
    + '<div class="char-popup-actions" style="margin-top:8px;">'
    +   '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();_lookupCharDossier(\'' + safeName + '\');">\uD83D\uDCDA \u67E5\u627E\u6863\u6848</button>'
    +   '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();">\u6682\u7F13</button>'
    + '</div>';
  popup.style.maxHeight = 'calc(100vh - 24px)';
  popup.style.overflowY = 'auto';
  popup.style.maxWidth = Math.min(340, window.innerWidth - 24) + 'px';
  document.body.appendChild(popup);
  _positionCharPopup(popup, evt);
  setTimeout(function() {
    function _closePopup(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('mousedown', _closePopup); }
    }
    document.addEventListener('mousedown', _closePopup);
  }, 50);
}

/** 查找档案·调 crystallizePendingCharacter·成功后自动弹出 showCharPopup */
async function _lookupCharDossier(charName) {
  if (!charName) return;
  if (typeof findCharByName === 'function' && findCharByName(charName)) {
    showCharPopup(charName);
    return;
  }
  if (typeof crystallizePendingCharacter !== 'function') {
    if (typeof toast === 'function') toast('\u89D2\u8272\u751F\u6210\u6A21\u5757\u672A\u52A0\u8F7D');
    return;
  }
  try {
    // crystallizePendingCharacter 自带"整理档案中"进度条·内部判断史实/虚构
    await crystallizePendingCharacter(charName, { reason: '\u73A9\u5BB6\u67E5\u627E\u6863\u6848' });
    // 成功后展示其卡片
    if (typeof findCharByName === 'function' && findCharByName(charName)) {
      setTimeout(function(){ showCharPopup(charName); }, 300);
    }
  } catch(e) {
    console.warn('[\u67E5\u627E\u6863\u6848] \u5931\u8D25', e);
    if (typeof toast === 'function') toast('\u67E5\u627E\u5931\u8D25\uFF1A' + (e.message || e));
  }
}

if (typeof window !== 'undefined') {
  window._lookupCharDossier = _lookupCharDossier;
  window._showCharNotFoundPopup = _showCharNotFoundPopup;
}

// ============================================================
