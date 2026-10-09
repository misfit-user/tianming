// @ts-check
// ═══ 巨石拆分(20260706·第十五拆)：tm-hongyan-office.js 中段切出 renderGameState(主游戏 UI 渲染) ═══
// 内容：_renderEdictArchiveBody(诏令档案懒构建·renderGameState 助手) + renderGameState(主游戏 UI 渲染·原行 1710-2336)。
// 型态：顶层函数型(列0 全局函数·运行时全局名互调·无 alias·无 'use strict'·随 origin 非严格)。
// 装载：须紧接 tm-hongyan-office.js 之后(中段切·保序等价)·再由 tm-hongyan-edict-ui.js 续。契约见 lint-split-contracts。
// 装载期可执行语句：无(全为顶层纯函数定义·无列0 非 function 语句)。
// 往期诏令档案体·懒构建(诏令面板 <details> 展开时调用·2026-06-10 性能·循环体自 renderGameState 原样迁出)
function _renderEdictArchiveBody() {
  var _bodyEl = _$('ed-archive-body');
  if (!_bodyEl) return;
  var _allEdicts = (GM._edictTracker || []).filter(function(e) { return e.turn < GM.turn; });
  if (!_allEdicts.length) { _bodyEl.innerHTML = ''; return; }
  var _edictByTurn = {};
  _allEdicts.forEach(function(e) { if (!_edictByTurn[e.turn]) _edictByTurn[e.turn] = []; _edictByTurn[e.turn].push(e); });
  var _edictTurns = Object.keys(_edictByTurn).sort(function(a,b){ return b-a; });
  var _h = '';
      _edictTurns.forEach(function(turn) {
        var edicts = _edictByTurn[turn];
        var _tsText = typeof getTSText === 'function' ? getTSText(parseInt(turn)) : 'T' + turn;
        _h += '<div class="ed-archive-group">';
        _h += '<div class="ed-archive-group-title">\u7B2C' + turn + '\u56DE\u5408 \u00B7 ' + _tsText + '</div>';
        edicts.forEach(function(e) {
          var _sc = e.status === 'completed' ? 'var(--celadon-400)' : e.status === 'obstructed' ? 'var(--vermillion-400)' : e.status === 'partial' ? '#e67e22' : e.status === 'pending_delivery' ? 'var(--amber-400)' : 'var(--ink-300)';
          var _sl = {completed:'\u2705', obstructed:'\u274C', partial:'\u26A0\uFE0F', executing:'\u23F3', pending:'\u2B55', pending_delivery:'\uD83D\uDCE8'}[e.status] || '';
          _h += '<div style="font-size:var(--text-xs);padding:2px 0;border-bottom:1px solid var(--color-border-subtle);">';
          _h += '<span style="color:' + _sc + ';">' + _sl + '</span> ';
          _h += '<span style="color:var(--color-foreground-muted);">' + escHtml(e.category) + '</span> ';
          _h += escHtml(e.content);
          if (e.assignee) _h += ' <span style="color:var(--ink-300);">[\u6267\u884C:' + escHtml(e.assignee) + ']</span>';
          // 远方送达状态
          if (e._remoteTargets && e._remoteTargets.length > 0) {
            var _ltStatuses = (e._letterIds||[]).map(function(lid) {
              var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
              if (!lt) return null;
              var _name = lt.to || '';
              if (lt.status === 'traveling') return _name + ':信使在途';
              if (lt.status === 'delivered' || lt.status === 'replying') return _name + ':已送达';
              if (lt.status === 'returned') return _name + (lt._isForged ? ':⚠回函(伪)' : ':已送达且回函');
              if (lt.status === 'intercepted') return _name + ':⚠信使失踪';
              if (lt.status === 'intercepted_forging') return _name + ':⚠信使失踪(回函伪造中)';
              if (lt.status === 'recalled') return _name + ':已追回';
              if (lt.status === 'blocked') return _name + ':⚠中书阻挠未下达';
              return _name + ':' + (lt.status||'?');
            }).filter(Boolean);
            if (_ltStatuses.length > 0) {
              _h += '<div style="font-size:0.66rem;color:var(--amber-400);padding-left:1rem;">传书：' + _ltStatuses.join(' | ') + '</div>';
            }
          }
          if (e.feedback) _h += '<div style="color:var(--color-foreground-secondary);padding-left:1rem;">' + escHtml(e.feedback) + '</div>';
          _h += '</div>';
        });
        _h += '</div>';
      });
  _bodyEl.innerHTML = _h;
}

function renderGameState(options){
  options = options || {};
  // ★ 财政三字段同步守卫·防 money/balance/ledgers.stock 跑偏导致顶栏与面板数值不一致
  if (!options.skipStateSync) {
    try { if (typeof _syncFiscalScalars === 'function' && typeof GM !== 'undefined') _syncFiscalScalars(GM); } catch(_syE) { try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_syE, 'renderGameState/sync'); } catch(__){} }
  }
  // 旧 UI
  renderLeftPanel();
  renderBarResources();

  // 中间面板（游戏主体）
  var gc=_$("gc");if(!gc)return;
  // 草稿保护(2026-07-04 审查定罪)：外部调用点(科举纳志/LLM校准回调等)触发全量重建曾清空玩家
  // 已敲入的诏令/行止/书信草稿——重建前快照非空输入·重建后仅回填重建留空的同 id 输入框
  var _draftSnap = {};
  try { gc.querySelectorAll('textarea[id],input[id]').forEach(function(el){ if (el.value && el.type !== 'checkbox' && el.type !== 'radio') _draftSnap[el.id] = el.value; }); } catch(_ds){}
  gc.innerHTML="";
  if (Object.keys(_draftSnap).length) setTimeout(function(){ try { Object.keys(_draftSnap).forEach(function(id){ var el = document.getElementById(id); if (el && !el.value && el.type !== 'checkbox' && el.type !== 'radio') el.value = _draftSnap[id]; }); } catch(_dr){} }, 0);

  // 面包屑
  var _bc=document.createElement("div");_bc.className="gs-breadcrumb";
  _bc.innerHTML='<span>朝野要务</span><span class="sep">›</span><span>本朝纪要</span><span class="sep">›</span><span class="cur" id="gs-bc-cur">朝 政</span>'
    +'<div class="gs-breadcrumb-right">'
    +'<button class="gs-bc-btn" onclick="if(typeof openGlobalSearch===\'function\')openGlobalSearch();">搜 寻</button>'
    +'<button class="gs-bc-btn" onclick="if(typeof openHelp===\'function\')openHelp();">帮 助</button>'
    +'</div>';
  gc.appendChild(_bc);

  // 标签栏（5 组分栏：政务/问答/纪录/臣子/文考）
  var tabBar=document.createElement("div");tabBar.className="gs-tab-bar";
  var _ti = typeof tmIcon === 'function' ? tmIcon : function(){return '';};
  var tabs=[
    {id:"gt-zhaozheng",label:"\u671D\u653F",icon:'office',group:'政务'},
    {id:"gt-edict",label:"\u8BCF\u4EE4",icon:'scroll',group:'政务'},
    {id:"gt-memorial",label:"\u594F\u758F",icon:'memorial',group:'政务'},
    {id:"gt-chaoyi",label:"\u671D\u8BAE",icon:'dialogue',group:'政务',action:'openChaoyi'},
    {id:"gt-wendui",label:"\u95EE\u5BF9",icon:'dialogue',group:'问答'},
    {id:"gt-letter",label:"\u9E3F\u96C1",icon:'scroll',group:'问答'},
    {id:"gt-biannian",label:"\u7F16\u5E74",icon:'chronicle',group:'纪录'},
    {id:"gt-qiju",label:"\u8D77\u5C45\u6CE8",icon:'qiju',group:'纪录'},
    {id:"gt-jishi",label:"\u7EAA\u4E8B",icon:'event',group:'纪录'},
    {id:"gt-shiji",label:"\u53F2\u8BB0",icon:'history',group:'纪录'},
    {id:"gt-office",label:"\u5B98\u5236",icon:'office',group:'臣子'},
    {id:"gt-renwu",label:"\u4EBA\u7269\u5FD7",icon:'person',group:'臣子'},
    {id:"gt-difang",label:"\u5730\u65B9",icon:'faction',group:'臣子'},
    {id:"gt-wenyuan",label:"\u6587\u82D1",icon:'scroll',group:'文考'},
    {id:"gt-keju",label:"\u79D1\u4E3E",icon:'scroll',group:'文考',action:'openKejuPanel'}
  ];
  // 按 group 分组
  var _curGroup=null, _curGroupEl=null, _tabIdx=0;
  tabs.forEach(function(t){
    if (t.group !== _curGroup){
      _curGroupEl=document.createElement('div');
      _curGroupEl.className='gs-tab-group';
      _curGroupEl.setAttribute('data-label', t.group || '');
      tabBar.appendChild(_curGroupEl);
      _curGroup=t.group;
    }
    var btn=document.createElement("button");
    btn.className='g-tab-btn gs-tab-btn'+(_tabIdx===0?" active":"");
    btn.innerHTML=_ti(t.icon,12)+' '+t.label;
    if (t.action) {
      btn.onclick=function(){ if(typeof window[t.action]==='function') window[t.action](); };
    } else {
      (function(_t,_b){
        _b.onclick=function(){
          switchGTab(_b,_t.id);
          if(_t.id==='gt-zhaozheng'){var zp=_$('gt-zhaozheng');if(zp)zp.innerHTML=_renderZhaozhengCenter();}
          var bc=_$('gs-bc-cur'); if(bc) bc.textContent=_t.label;
        };
      })(t,btn);
    }
    _curGroupEl.appendChild(btn);
    _tabIdx++;
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
      edictHTML += '<summary>\u8FD1\u671F\u884C\u6B62\u8BB0\u5F55 <span style="color:var(--ink-300);margin-left:6px;font-size:11px;">' + _recentXl.length + ' \u6761</span></summary>';
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
  // 往期诏令档案·性能 2026-06-10:档案体随回合无界增长(全量 _edictTracker 循环×每条再嵌 letters.find)·
  // 而 <details> 默认折叠 99% 时间无人看——改为展开时才构建(每次展开重建·保持新鲜)
  var _edArchCount = (GM._edictTracker || []).filter(function(e) { return e.turn < GM.turn; }).length;
  if (_edArchCount > 0) {
    edictHTML += '<details class="ed-archive" ontoggle="if(this.open&&typeof _renderEdictArchiveBody===\'function\')_renderEdictArchiveBody();">';
    edictHTML += '<summary>\u5F80 \u671F \u8BCF \u4EE4 \u6863 \u6848 \u00B7 ' + _edArchCount + ' \u6761</summary>';
    edictHTML += '<div style="margin-top:var(--space-2);max-height:400px;overflow-y:auto;" id="ed-archive-body"></div>';
    edictHTML += '</details>';
  }
  // 结束回合按钮
  edictHTML += '<div class="ed-action-bar">';
  edictHTML += '<button class="bt bp" id="btn-end" onclick="confirmEndTurn()" style="padding:var(--space-3) var(--space-8);font-size:var(--text-md);letter-spacing:0.15em;border:2px solid var(--gold-400);box-shadow:0 2px 12px rgba(184,154,83,0.2);">'+_ei('end-turn',16)+' 诏付有司</button>';
  edictHTML += '<button class="bt" title="地形图·山川城池分布（决策辅助）·与【军事·地图总览】数据源不同" onclick="TM.Map.open(\'terrain\')" style="padding:var(--space-3) var(--space-6);font-size:var(--text-md);">'+_ei('map',16)+' 查看地图</button>';
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
    +'<section id="npc-daily-panel" aria-label="日常往来" style="padding:var(--space-2,8px);border-bottom:1px solid var(--color-border-subtle);"></section>'
    +'<div class="hy-main">'
    +  '<div class="hy-left">'
    +    '<div class="hy-left-header"><span class="hy-left-title">\u8FDC \u65B9 \u81E3 \u5B50</span>'
    +      '<button class="hy-multi-btn" id="lt-multi-toggle" onclick="GM._ltMultiMode=!GM._ltMultiMode;GM._ltMultiTargets=[];renderLetterPanel();">\u7FA4 \u53D1</button>'
    +    '</div>'
    +    '<div class="hy-search-wrap"><input id="lt-search" class="hy-search" type="text" placeholder="\u68C0\u7D22\u59D3\u540D\u00B7\u5B98\u804C\u00B7\u515A\u6D3E\u00B7\u5730\u70B9\u2026\u2026" oninput="_ltOnSearchInput(this.value)"></div>'
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
        var _inKy = (GM.chars||[]).filter(function(c){ return c.alive !== false && (!c.location || _isSameLocation(c.location, _cap2)) && !c.isPlayer; });
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
    +'<div class="bn-search-wrap"><input id="bn-search" class="bn-search" placeholder="\u9898\u76EE\u3001\u4EBA\u540D\u3001\u5730\u70B9\u3001\u5173\u952E\u5B57\u2026\u2026" oninput="_scheduleBiannianRender()"></div>'
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
    +'<div class="og-title"><div class="seal">官<br>制</div><div class="main">六 部 卿 寺</div><div class="sub">衙　门　职　官　　　　班　位　各　司　其　职</div></div>'

    // 总览区
    +'<div class="og-section-hdr">'
    +'<span class="tag">衙 门 总 览</span>'
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
    +'<span class="tag">衙 门 层 级</span>'
    +'<span class="desc">\u2014\u2014 \u9F20\u8F6E\u7F29\u653E\u00B7\u62D6\u62FD\u5E73\u79FB\u00B7\u70B9\u51FB\u5361\u7247\u5C55\u5F00\u8BE6\u60C5</span>'
    +'</div>'
    +'<div class="og-tree-topbar">'
    +'<span class="title-bar">\u56FE \u4F8B</span>'
    +'<span style="font-size:12px;color:var(--ink-300);letter-spacing:0.05em;display:inline-flex;align-items:center;gap:8px;">'
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
    +'<div class="wy-search-wrap"><input id="wy-search" class="wy-search" placeholder="\u641C\u7D22\u4F5C\u8005\u00B7\u6807\u9898\u00B7\u8BD7\u6587\u2026" oninput="_scheduleWenyuanRender()"></div>'
    +'<select id="wy-cat-filter" class="wy-filter" onchange="renderWenyuan()"><option value="all">全部触发</option><option value="career">科举官途</option><option value="adversity">逆境贬谪</option><option value="social">社交酬酢</option><option value="duty">任上施政</option><option value="travel">游历山水</option><option value="private">家事私情</option><option value="times">时局天下</option><option value="mood">情感心境</option></select>'
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
    +'<div class="qj-search-wrap"><input id="qj-search" class="qj-search" placeholder="\u641C\u7D22\u8D77\u5C45\u6CE8\u00B7\u65E5\u671F\u00B7\u4EBA\u540D\u2026" oninput="_qijuKw=this.value;_qijuPage=0;_scheduleQijuRender()"></div>'
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
    +'<div class="ji-search-wrap"><input id="jishi-kw" class="ji-search" placeholder="\u641C\u7D22\u8BAE\u9898\u00B7\u4EBA\u7269\u00B7\u5BF9\u8BDD\u2026\u2026" oninput="_jishiKw=this.value;_jishiPage=0;_scheduleJishiRender();"></div>'
    +'<select id="jishi-char-filter" class="ji-filter" onchange="_jishiCharFilter=this.value;_jishiPage=0;renderJishi();"><option value="all">\u5168\u90E8\u4EBA\u7269</option></select>'
    +'<button class="ji-star-btn" onclick="_jishiToggleStarred()" id="js-star-toggle" title="\u4EC5\u770B\u661F\u6807">\u2606</button>'
    +'<button class="ji-export-btn" onclick="_jishiExport()" title="导出纪事完整记录">导 出</button>'
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
    +'<button class="bt bp" onclick="(window.TM&&TM.ceming&&TM.ceming.openDialog)?TM.ceming.openDialog():(typeof toast===\'function\'&&toast(\'策名未就绪\'))" style="padding:5px 12px;font-size:12px;margin-right:6px;" title="策名·将历史人物纳入人物志">策　名</button>'
    +'<span class="rw-tools-lbl">\u62AB \u89C8</span>'
    +'<div class="rw-search-wrap"><input id="rw-search" class="rw-search" placeholder="\u641C\u7D22\u59D3\u540D\u00B7\u5B57\u53F7\u00B7\u5B98\u804C\u2026" oninput="_rwSearch=this.value;(typeof _rwScheduleRender===\'function\'?_rwScheduleRender():renderRenwu());"></div>'
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
    _dfBtn.onclick=function(){switchGTab(_dfBtn,"gt-difang");};tabBar.appendChild(_dfBtn);
    var _dfP=document.createElement("div");_dfP.className="g-tab-panel";_dfP.id="gt-difang";_dfP.style.cssText="flex:1;overflow-y:auto;padding:0;";
    _dfP.innerHTML='<div class="df-panel-wrap"><div class="df-inner">'
      +'<div class="df-title"><div class="seal">\u5730<br>\u65B9</div><div class="main">\u5730 \u65B9 \u8206 \u60C5</div><div class="sub">\u4E00 \u7701 \u4E00 \u6C11 \u60C5\u3000\u3000\u6309 \u5BDF \u629A \u6C11 \u00B7 \u5B89 \u6C11 \u4E3A \u672C</div></div>'
      +'<div id="df-statbar" class="df-statbar"></div>'
      +'<div class="df-tools">'
      +'<span class="df-tools-lbl">\u6309 \u5BDF</span>'
      +'<div class="df-search-wrap"><input id="df-search" class="df-search" placeholder="\u641C\u7D22\u5730\u540D\u00B7\u5B98\u540D\u00B7\u4E8B\u7531\u2026\u2026" oninput="_dfSearch=this.value;(typeof _dfScheduleRender===\'function\'?_dfScheduleRender():_renderDifangPanel());"></div>'
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
          stressTag=' <span style="font-size:0.68rem;padding:1px 4px;border-radius:3px;background:'+(ch.stress>60?'rgba(192,57,43,0.2)':'rgba(230,126,34,0.15)')+';color:'+(ch.stress>60?'var(--red)':'#e67e22')+';">'+(ch.stress>60?'\u5D29':'\u7126')+'</span>';
        }
        // 心情标记（中国古典方括号）
        var moodIcon='';
        if(ch._mood&&ch._mood!=='\u5E73'){
          var _moodColors={'\u559C':'var(--color-success)','\u6012':'var(--vermillion-400)','\u5FE7':'#e67e22','\u60E7':'var(--indigo-400)','\u6068':'var(--vermillion-400)','\u656C':'var(--celadon-400)'};
          moodIcon='<span style="font-size:0.66rem;color:'+(_moodColors[ch._mood]||'var(--txt-d)')+';">\u3014'+ch._mood+'\u3015</span> ';
        }
        // 野心标记
        var ambTag=(ch.ambition||50)>75?'<span style="font-size:0.64rem;color:var(--purple,#9b59b6);">\u91CE</span>':'';
        // 后宫/配偶标记
        var spouseTag='';
        if(typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(ch) : ch.spouse === true){
          var _spIc = typeof getHaremRankIcon === 'function' ? getHaremRankIcon(ch.spouseRank) : '\u{1F490}';
          spouseTag=' <span style="font-size:0.68rem;color:#e84393;">'+_spIc+'</span>';
        }
        var factionTag=ch.faction?'<span style="font-size:0.68rem;color:var(--txt-d);">'+ch.faction+'</span>':'';
        // 立场/党派/学识标签
        var stancePartyTag='';
        if(ch.stance&&ch.stance!=='中立') stancePartyTag+='<span style="font-size:0.62rem;padding:0 3px;border-radius:2px;border:1px solid '+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';color:'+(ch.stance==='改革'?'var(--celadon-400)':ch.stance==='保守'?'var(--indigo-400)':'var(--txt-d)')+';margin-right:2px;">'+ch.stance+'</span>';
        if(ch.party) stancePartyTag+='<span style="font-size:0.62rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;margin-right:2px;">'+escHtml(ch.party)+'</span>';
        var officeLine=ch.title?'<span style="font-size:0.7rem;color:var(--txt-d);">'+ch.title+'</span>':'';
        var ageTag=ch.age?'<span style="font-size:0.68rem;color:var(--txt-d);">'+ch.age+'\u5C81</span>':'';
        var _cap=GM._capital||'京城';
        var locTag='';
        if(ch._travelTo){
          var _rd5=(typeof ch._travelRemainingDays==='number'&&ch._travelRemainingDays>0)?ch._travelRemainingDays:0;
          locTag='<span style="font-size:0.62rem;padding:0 3px;border-radius:2px;background:rgba(184,154,83,0.18);color:var(--gold-400);margin-left:2px;" title="\u5728\u9014">'+escHtml(ch._travelFrom||ch.location||'')+'\u2192'+escHtml(ch._travelTo)+(_rd5?'\u00B7'+_rd5+'\u65E5':'')+'</span>';
        } else if(ch.location&&!_isSameLocation(ch.location,_cap)) locTag='<span style="font-size:0.62rem;padding:0 3px;border-radius:2px;background:rgba(184,154,83,0.1);color:var(--gold-400);margin-left:2px;">'+ch.location+'</span>';
        // 性格特质缩写
        var traitBrief='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitBrief=ch.traitIds.slice(0,2).map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;});return d?d.name:'';}).filter(Boolean).join('\u00B7');
          if(traitBrief) traitBrief='<span style="font-size:0.64rem;color:var(--txt-d);background:var(--bg-4);padding:0 3px;border-radius:3px;">'+traitBrief+'</span>';
        }
        // 目标+满足度
        var goalBrief='';
        if(ch.personalGoal) {
          var _gsat = ch._goalSatisfaction !== undefined ? Math.round(ch._goalSatisfaction) : '';
          var _gsatColor = _gsat >= 60 ? 'var(--celadon-400)' : _gsat >= 30 ? 'var(--gold-400)' : 'var(--vermillion-400)';
          goalBrief='<div style="font-size:0.66rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">\u5FD7\uFF1A'+escHtml(ch.personalGoal);
          if(_gsat !== '') goalBrief += ' <span style="color:'+_gsatColor+';">'+_gsat+'%</span>';
          goalBrief += '</div>';
        }
        // 恩怨摘要（简短）
        var eyBrief='';
        if(typeof EnYuanSystem!=='undefined'){var _eyt2=EnYuanSystem.getTextForChar(ch.name);if(_eyt2)eyBrief='<div style="font-size:0.62rem;color:var(--color-foreground-muted);margin-top:0.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;">'+_eyt2+'</div>';}
        // 五常/气质/面子（新增增强）
        var wcLine='';
        if(typeof calculateWuchang==='function'){
          var _wc=calculateWuchang(ch);
          wcLine='<div style="font-size:0.66rem;color:var(--celadon-400);margin-top:0.15rem;letter-spacing:0.03em;">仁'+_wc.仁+' 义'+_wc.义+' 礼'+_wc.礼+' 智'+_wc.智+' 信'+_wc.信+' <span style="color:var(--gold-400);">'+_wc.气质+'</span></div>';
        }
        var faceLine='';
        if(typeof FaceSystem!=='undefined'&&ch._face!==undefined){
          var _fv=FaceSystem.getFace(ch);
          var _fc=_fv>=60?'var(--color-foreground-muted)':_fv>=40?'#e67e22':'var(--vermillion-400)';
          faceLine=_fv<60?' <span style="font-size:0.62rem;padding:0 3px;border-radius:2px;border:1px solid '+_fc+';color:'+_fc+';">'+(_fv<20?'奇耻':_fv<40?'颜面尽失':'面子低落')+'</span>':'';
        }
        // 特质色彩编码（增强）
        var traitTags='';
        if(ch.traitIds&&ch.traitIds.length>0&&P.traitDefinitions){
          traitTags=ch.traitIds.slice(0,3).map(function(tid){
            var d=P.traitDefinitions.find(function(t){return t.id===tid;});
            if(!d)return '';
            var _tc=(d.dims&&d.dims.boldness>0.2)?'var(--vermillion-400)':(d.dims&&d.dims.compassion>0.2)?'var(--celadon-400)':(d.dims&&d.dims.rationality>0.2)?'var(--indigo-400)':'var(--gold-400)';
            return '<span style="font-size:0.62rem;padding:0 3px;border-radius:2px;border:1px solid '+_tc+';color:'+_tc+';margin-right:2px;">'+d.name+'</span>';
          }).filter(Boolean).join('');
        }
        var _portraitThumb = ch.portrait ? '<img loading="lazy" decoding="async" src="'+escHtml(ch.portrait)+'" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;margin-right:6px;">' : '';
        return "<div class=\"cd\" style=\"padding:0.5rem 0.6rem;margin-bottom:0.35rem;cursor:pointer;border-left:3px solid var(--gold-500);\" onclick=\"openCharDetail('"+ch.name.replace(/'/g,"\\'")+"')\">"
          +"<div style=\"display:flex;align-items:center;\">"+_portraitThumb
          +"<div style=\"flex:1;\"><div style=\"display:flex;justify-content:space-between;align-items:center;\">"
          +"<strong style=\"font-size:0.85rem;\">"+moodIcon+ch.name+locTag+spouseTag+faceLine+"</strong>"
          +"<span style=\"font-size:0.71rem;\">"+ageTag+" <span class=\"stat-number\" style=\"color:"+loyColor+";\">忠"+loyDisp+"</span>"+ambTag+stressTag+"</span>"
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
    try { _renderDifangPanel(); } catch(_dfRefE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_dfRefE, 'difang refresh') : console.warn('[difang refresh]', _dfRefE); }
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
