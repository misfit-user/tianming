// ============================================================
//  tm-keju.js — 科举系统（R112 从 tm-chaoyi-keju.js L1-1053 拆出）
// Requires: tm-utils.js (GameHooks, _$, callAI, escHtml),
//           tm-index-world.js (findScenarioById, findCharByName)
// 姊妹文件：tm-chaoyi.js (朝议·L1054+)
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 导航地图（2026-04-24 R54 实测更新）
// ══════════════════════════════════════════════════════════════
//
//  此文件混合了两大系统：**科举**（L16-960）+ **朝议**（L965-end）
//  未来拆分候选：tm-keju.js + tm-chaoyi.js（MODULE_REGISTRY §2 P2）
//
//  ┌─ §A 科举面板 & 启动（L16-214） ─────────────────────┐
//  │  L16    openKejuPanel()            打开科举主面板
//  │  L115   proposeKejuPreparation()   朝议触发科举预备
//  │  L137   _kejuQueryLibuStance()     咨询吏部立场
//  │  L155   startKejuByMethod(m,opts)  启动科举·按方法
//  │  L212   resolveKejuCouncilResult() 朝议结果→强推/通过
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §B 科举经费结算（L239-815） ─────────────────────────┐
//  │  L314   payKejuLocalCost()         地方经费
//  │  L343   _kejuSettleLocalCosts()    地方结算
//  │  L378   _kejuSettleProvincialCosts()  省级结算
//  │  L812   _kejuSettleCentralCost()   中央结算
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §C 科举主持 & 考官（L398-720） ─────────────────────┐
//  │  L398   _kejuGenChiefExaminerMemorial()  主考官出题奏疏
//  │  L445   kejuConsultCourtier()      咨询其他大臣
//  │  L464   kejuConsultGuanGe()        咨询馆阁
//  │  L509   openDianshiDelegatePicker()  殿试主持人选任
//  │  L599   _kejuAutoPickExaminer()    自动挑选主考
//  │  L615   _kejuNotifyUrgentStage()   紧急阶段通知
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §D 科举 AI 候选人 & 答卷（L722-898） ──────────────┐
//  │  L722   pickHistoricalCandidates(exam)  20 历史人物候选
//  │  L851   requestEnableKeju()        玩家请求启用科举
//  │  L898   startKejuReform()          科举改制 AI 建议
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §E 朝议打开/关闭（L965-1080） ──────────────────────┐
//  │  L965   openChaoyi()               朝议主入口
//  │  L990   closeChaoyi()
//  │  L1002  _cyShowInputRow()          展示输入行
//  │  L1008  _cySubmitPlayerLine()      玩家插言提交
//  │  L1020  _cyAbortChaoyi()           紧急中断
//  │  L1028  _getPlayerLocation()       同地判定
//  │  L1045  showChaoyiSetup()          选议题+参议臣
//  │  L1079  startChaoyiSession()       开始（旧）
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §F 朝议模式 & 常朝流（L1082-1260） ────────────────┐
//  │  L1082  _cyGetRank(ch)
//  │  L1119  toggleCY(btn, name)        选/不选议员
//  │  L1121  startChaoyiSession()       开始（新 LAYERED 覆盖上面）
//  │  L1168  _startChangchao()          常朝模式·流式
//  │  L1173  _buildChangchaoPrompt()    常朝 prompt
//  │  L1259  _genEmergencyItem()        急务生成
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §G 廷议/御前/科议/其他（L1260+ 至 end） ───────────┐
//  │  廷议 2 轮流式 + 打断 · 御前 2 轮流式 · 科议自动邀请
//  │  具体函数名以 _cy_Xxx / _keyi_Xxx / _jinshiXxx 前缀
//  └─────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  🛠️ 调试入口
// ══════════════════════════════════════════════════════════════
//
//  CY                                 朝议当前状态对象
//  GM.keju / P.keju                   科举运行时/预设
//  DA.chars.byLocation(loc)           获取同地大臣（参议候选）
//  openChaoyi()                       手工开朝议
//  openKejuPanel()                    手工开科举
//
// ══════════════════════════════════════════════════════════════
//  ⚠️ 架构注意事项
// ══════════════════════════════════════════════════════════════
//
//  1. startChaoyiSession 在 L1079 和 L1121 有两个定义
//     第二个（L1121）覆盖第一个（真实使用的是新版）
//     历史原因未清理·未来合并时只保留 L1121
//
//  2. 朝议 + 科举混在一个文件 = 9,454 行
//     未来拆 tm-keju.js (L16-960) + tm-chaoyi.js (L965-end)
//     工时估算 40h（见 MODULE_REGISTRY §2）
//
//  3. 对话类 JSON 走 TM.validateAIOutput(parsed, 'xxx', 'dialogue')
//     schema 在 tm-ai-schema.js:DIALOGUE 分组
//
// ══════════════════════════════════════════════════════════════

// 朝议弹窗系统
var CY={open:false,topic:"",selected:[],messages:[],speaking:false,abortCtrl:null,round:0,phase:'setup',stances:{}};

// 朝议和科举按钮已移入 tm-game-engine.js 的 tabs 数组中
// 不再需要通过 enterGame:after 钩子动态添加（renderGameState每次重建会丢失）

/**
 * 打开科举面板
 */
function openKejuPanel(){
  if(!P.keju) P.keju = {enabled:false,history:[],currentExam:null};
  if(!P.keju.history) P.keju.history = [];
  // 如果当前有科举正在进行，直接打开科举界面
  if(P.keju.currentExam){
    showKejuModal();
    return;
  }

  // 否则显示科举状态面板
  var modal=document.createElement("div");
  modal.className="modal-bg show";
  modal.id="keju-panel-modal";

  var content='<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:700px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;">'+
    '<div style="padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;">'+
    '<div style="font-size:1.1rem;font-weight:700;color:var(--gold);">📜 科举制度</div>'+
    '<button class="bt bs bsm" onclick="document.getElementById(\'keju-panel-modal\').remove()">✕</button>'+
    '</div>'+
    '<div style="flex:1;overflow-y:auto;padding:1.5rem;">';

  if(P.keju.enabled){
    // 科举已启用
    content+='<div style="background:var(--bg-2);padding:1rem;border-radius:8px;margin-bottom:1rem;">'+
      '<h4 style="color:var(--gold);margin-bottom:0.5rem;">\u5236\u5EA6\u6982\u51B5</h4>'+
      '<p>\u2705 \u79D1\u4E3E\u5236\u5EA6\u5DF2\u542F\u7528</p>'+
      '<p>\u8003\u8BD5\u95F4\u9694\uFF1A'+(P.keju.examIntervalNote||'\u7531\u671D\u5EF7\u51B3\u5B9A')+'</p>'+
      (P.keju.examSubjects?'<p>\u8003\u8BD5\u79D1\u76EE\uFF1A'+escHtml(P.keju.examSubjects)+'</p>':'')+
      (P.keju.quotaPerExam?'<p>\u6BCF\u79D1\u53D6\u58EB\uFF1A'+P.keju.quotaPerExam+'\u4EBA\u8FDB\u5165\u6BBE\u8BD5</p>':'')+
      (P.keju.specialRules?'<p>\u7279\u6B8A\u89C4\u5219\uFF1A'+escHtml(P.keju.specialRules)+'</p>':'')+
      '<p>\u4E0A\u6B21\u79D1\u4E3E\uFF1A'+(P.keju.lastExamDate?P.keju.lastExamDate.year+'\u5E74'+P.keju.lastExamDate.month+'\u6708':'\u4ECE\u672A\u4E3E\u529E')+'</p>';

    // 显示筹办状态
    if(GM.keju && GM.keju.preparingExam) {
      content+='<p style="color:var(--gold);font-weight:700;margin-top:0.5rem;">🔄 正在筹办科举考试</p>'+
        '<p style="color:var(--txt-d);font-size:0.85rem;">筹办进展将在史记正文中展示，请耐心等待</p>';
    }

    content+='</div>';

    // 历史记录
    if(P.keju.history.length>0){
      content+='<div style="background:var(--bg-2);padding:1rem;border-radius:8px;margin-bottom:1rem;">'+
        '<h4 style="color:var(--gold);margin-bottom:0.5rem;">历史记录</h4>';
      P.keju.history.slice(-5).reverse().forEach(function(h){
        content+='<div style="padding:0.5rem;background:var(--bg-3);margin-bottom:0.3rem;border-radius:4px;">'+
          '<p><strong>'+h.date.year+'年'+h.date.month+'月</strong></p>'+
          '<p style="font-size:0.85rem;color:var(--txt-d);">录取'+h.passedCount+'人，质量：'+h.quality+'</p>'+
          '<p style="font-size:0.85rem;color:var(--txt-d);">状元：'+h.topThree[0]+'，榜眼：'+h.topThree[1]+'，探花：'+h.topThree[2]+'</p>'+
          '</div>';
      });
      content+='</div>';
    }

    content+='<div style="text-align:center;">';

    // 如果正在筹办，禁用按钮
    if(GM.keju && GM.keju.preparingExam) {
      content+='<button class="bt bp" disabled style="opacity:0.5;cursor:not-allowed;">📋 正在筹办中...</button>'+
        '<p style="color:var(--txt-d);font-size:0.85rem;margin-top:0.5rem;">请等待当前科举筹办完成</p>';
    } else {
      content+='<button class="bt bp" onclick="proposeKejuPreparation()">📋 提议筹办科举</button>'+
        '<p style="color:var(--txt-d);font-size:0.85rem;margin-top:0.5rem;">科举筹办需要时间，具体进展由推演AI决定</p>';
    }

    content+='</div>';
  }else{
    // 科举未启用
    var scenario=P.scenarios.find(function(s){return s.id===GM.sid;});
    var era=(scenario?scenario.era:'')||'';
    var isPreKeju=!isKejuEra(era);

    content+='<div style="background:var(--bg-2);padding:1rem;border-radius:8px;margin-bottom:1rem;">'+
      '<h4 style="color:var(--gold);margin-bottom:0.5rem;">制度状态</h4>'+
      '<p>❌ 科举制度未启用</p>'+
      '<p style="color:var(--txt-d);font-size:0.9rem;margin-top:0.5rem;">'+(isPreKeju?'当前朝代尚未实行科举制度，可通过选官制度改革启用。':'当前因特殊原因未启用科举制度。')+'</p>'+
      '</div>';

    if(isPreKeju){
      content+='<div style="background:var(--bg-2);padding:1rem;border-radius:8px;margin-bottom:1rem;">'+
        '<h4 style="color:var(--gold);margin-bottom:0.5rem;">⚠️ 选官制度改革</h4>'+
        '<p style="color:var(--txt-d);font-size:0.9rem;margin-bottom:0.8rem;">改革为科举制度将遭遇世家大族的强烈反对，可能引发政治动荡。</p>'+
        '<button class="bt bp" onclick="startKejuReform()">🔄 发起科举改革</button>'+
        '</div>';
    }else{
      content+='<div style="text-align:center;">'+
        '<button class="bt bp" onclick="requestEnableKeju()">📜 请求启用科举</button>'+
        '</div>';
    }
  }

  content+='</div></div>';
  modal.innerHTML=content;
  document.body.appendChild(modal);
}

/**
 * 提议筹办科举
 */
function proposeKejuPreparation(){
  // 关闭科举面板
  var panel=document.getElementById('keju-panel-modal');
  if(panel)panel.remove();

  // v5·直接打开〔科议〕专属会议
  openKeyiSession();
}

/**
 * 手动立即举办科举（已废弃，保留兼容）
 */
function manualStartKeju(){
  document.getElementById('keju-panel-modal').remove();
  startKejuExam();
}

// ══════════════════════════════════════════════════════════════════
// v5·C2·朝议结果回调+强推惩罚
// ══════════════════════════════════════════════════════════════════

/** 查询礼部尚书当前态度（'support' / 'oppose' / null） */
function _kejuQueryLibuStance() {
  var libuShangshu = (GM.chars||[]).find(function(c){
    return c && c.alive !== false &&
      (c.officialTitle === '礼部尚书' || c.title === '礼部尚书' || (c.title||'').indexOf('礼部尚书')>=0);
  });
  if (!libuShangshu) return null;  // 缺位
  // 忠诚+好感>60 → 支持；<40 → 反对；其间中立
  var loy = libuShangshu.loyalty || 50;
  var affinity = (typeof AffinityMap !== 'undefined' && AffinityMap.get)
    ? (AffinityMap.get(libuShangshu.name, (P.playerInfo && P.playerInfo.characterName) || '陛下') || 0)
    : 0;
  var combined = loy + affinity;
  if (combined >= 110) return 'support';
  if (combined <= 70)  return 'oppose';
  return null;
}

/** 3 路径启动科举（v5·朝议结果由玩家选路径） */
function startKejuByMethod(method, opts) {
  opts = opts || {};
  var libuStance = _kejuQueryLibuStance();
  var penaltyMultiplier = 1.0;
  if (libuStance === 'support') penaltyMultiplier = 0.5;
  else if (libuStance === 'oppose') penaltyMultiplier = 1.5;

  var penaltyLog = [];
  function applyPenalty(key, delta, reason) {
    var actualDelta = Math.round(delta * penaltyMultiplier);
    penaltyLog.push(reason + ' ' + (actualDelta >= 0 ? '+' : '') + actualDelta);
    if (key === 'huangwei') _adjustHuangwei(actualDelta, reason);
    else if (key === 'huangquan') _adjustHuangquan(actualDelta, reason);
    else if (key === 'minxin') _adjustMinxin(actualDelta, reason);
    else if (key === 'partyInfluence' && opts.opposingParties) {
      opts.opposingParties.forEach(function(pn){
        var p = (GM.parties||[]).find(function(pp){ return pp.name === pn; });
        if (p) p.influence = Math.max(0, (p.influence||0) + actualDelta);
      });
    }
    else if (key === 'affinityMap' && opts.opposingMinisters && typeof AffinityMap !== 'undefined') {
      opts.opposingMinisters.forEach(function(mn){
        AffinityMap.add(mn, (P.playerInfo && P.playerInfo.characterName) || '陛下', actualDelta, reason);
      });
    }
  }

  if (method === 'council') {
    // 朝议通过·无惩罚
    toast('\u671D\u8BAE\u901A\u8FC7\u00B7\u79D1\u4E3E\u7B79\u529E\u542F\u52A8');
  } else if (method === 'edict') {
    // 下诏强推：皇威-10·皇权-5·反对大臣 AffinityMap -8
    applyPenalty('huangwei', -10, '\u4E0B\u8BCF\u5F3A\u63A8\u79D1\u4E3E');
    applyPenalty('huangquan', -5, '\u4E0B\u8BCF\u5F3A\u63A8\u79D1\u4E3E');
    applyPenalty('affinityMap', -8, '\u4E0D\u7ECF\u671D\u8BAE\u5F3A\u63A8\u79D1\u4E3E');
    toast('\u4E0B\u8BCF\u5F3A\u63A8\u00B7\u671D\u81E3\u6709\u6028\u8A00');
  } else if (method === 'defy') {
    // 逆众议强推：皇威-20·皇权-10·民心-5·反对党派-8·AffinityMap-15
    applyPenalty('huangwei', -20, '\u9006\u4F17\u8BAE\u5F3A\u63A8\u79D1\u4E3E');
    applyPenalty('huangquan', -10, '\u9006\u4F17\u8BAE\u5F3A\u63A8\u79D1\u4E3E');
    applyPenalty('minxin', -5, '\u9006\u4F17\u8BAE\u5F3A\u63A8\u79D1\u4E3E');
    applyPenalty('partyInfluence', -8, '\u9006\u4F17\u8BAE\u5F3A\u63A8\u79D1\u4E3E');
    applyPenalty('affinityMap', -15, '\u9006\u4F17\u8BAE\u5F3A\u63A8\u79D1\u4E3E');
    toast('\u9006\u4F17\u8BAE\u5F3A\u63A8\u00B7\u6EE1\u671D\u54D7\u7136');
  }
  if (libuStance === 'support' && method !== 'council') {
    toast('\uD83D\uDCDC \u793C\u90E8\u5C1A\u4E66\u652F\u6301\u00B7\u60E9\u7F5A\u51CF\u534A');
  } else if (libuStance === 'oppose' && method !== 'council') {
    toast('\u26A0 \u793C\u90E8\u5C1A\u4E66\u53CD\u5BF9\u00B7\u60E9\u7F5A\u52A0\u91CD 50%');
  }

  if (GM.keju && GM.keju._pendingProposal) GM.keju._pendingProposal.resolved = true;
  startKejuExam({ type: 'zhengke', launchMethod: method, libuSupport: libuStance === 'support' });
  if (typeof addEB === 'function') addEB('\u79D1\u4E3E', '\u5F00\u79D1\u00B7' + method + (penaltyLog.length ? '\u00B7' + penaltyLog.join('\uFF0C') : ''));
}

/** 朝议结束后·根据朝议倾向提示玩家选择路径 */
function resolveKejuCouncilResult(councilSupport) {
  if (!GM.keju || !GM.keju._pendingProposal || GM.keju._pendingProposal.resolved) return;
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:4800;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';
  var libu = _kejuQueryLibuStance();
  var libuTip = libu === 'support' ? '\uD83D\uDCDC\u793C\u90E8\u652F\u6301\u00B7\u95E8\u69DB\u964D\u81F3\u4E09\u6210\u00B7\u5F3A\u63A8\u60E9\u7F5A\u51CF\u534A'
              : libu === 'oppose'  ? '\u26A0\u793C\u90E8\u53CD\u5BF9\u00B7\u95E8\u69DB\u5347\u81F3\u4E03\u6210\u00B7\u5F3A\u63A8\u60E9\u7F5A\u52A0\u91CD 50%'
              : '\u793C\u90E8\u65E0\u6001\u00B7\u6309\u5E38\u89C4';
  var threshold = libu === 'support' ? 0.3 : libu === 'oppose' ? 0.7 : 0.5;
  var passed = councilSupport >= threshold;
  bg.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:10px;padding:1.4rem 1.6rem;max-width:480px;">'+
    '<div style="font-size:1.08rem;color:var(--gold);font-weight:700;margin-bottom:0.8rem;">\u3014\u671D\u8BAE\u7ED3\u679C\uFF1A\u7B79\u529E\u79D1\u4E3E\u3015</div>'+
    '<div style="font-size:0.85rem;color:var(--txt-s);margin-bottom:0.6rem;line-height:1.7;">'+
      '\u652F\u6301\u5EA6\uFF1A' + Math.round(councilSupport*100) + '% / \u9605\u9608 ' + Math.round(threshold*100) + '%\u00B7' +
      (passed ? '<span style="color:var(--celadon-400);">\u5DF2\u901A\u8FC7</span>' : '<span style="color:var(--vermillion-400);">\u672A\u901A\u8FC7</span>') +
      '<br>' + libuTip +
    '</div>'+
    '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">'+
      (passed ? '<button class="bt bp" onclick="startKejuByMethod(\'council\');this.closest(\'div[style*=fixed]\').remove();">\u4F9D\u8BAE\u542F\u52A8 (\u65E0\u60E9\u7F5A)</button>'
              : '<button class="bt bp" onclick="startKejuByMethod(\'edict\');this.closest(\'div[style*=fixed]\').remove();">\u4E0B\u8BCF\u5F3A\u63A8 (\u76AE\u5A01-10 \u76AE\u6743-5)</button>'+
                '<button class="bt" style="color:var(--vermillion-400);" onclick="startKejuByMethod(\'defy\');this.closest(\'div[style*=fixed]\').remove();">\u9006\u4F17\u8BAE\u5F3A\u63A8 (\u91CD\u60E9)</button>') +
      '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();GM.keju._pendingProposal.resolved=true;toast(\'\u7F62\u4E0D\u8BAE\u4E86\');">\u7F62\u8BAE</button>'+
    '</div></div>';
  document.body.appendChild(bg);
}

/** 辅助·调整皇权 */
function _adjustHuangquan(delta, reason) {
  try {
    if (GM.huangquan && typeof GM.huangquan === 'object') {
      GM.huangquan.value = Math.max(0, Math.min(100, (GM.huangquan.value || 50) + delta));
      if (typeof addEB === 'function') addEB('\u7687\u6743', (delta > 0 ? '+' : '') + delta + '\u00B7' + (reason || ''));
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

/** 辅助·调整民心 */
function _adjustMinxin(delta, reason) {
  try {
    if (GM.minxin && typeof GM.minxin === 'object') {
      GM.minxin.trueIndex = Math.max(0, Math.min(100, (GM.minxin.trueIndex || 50) + delta));
      if (typeof addEB === 'function') addEB('\u6C11\u5FC3', (delta > 0 ? '+' : '') + delta + '\u00B7' + (reason || ''));
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

// ══════════════════════════════════════════════════════════════════
// v5·D1-D3·经费回落 + 中央扣款 + 阶段自动扣费
// ══════════════════════════════════════════════════════════════════

/** 在 adminHierarchy 中递归找节点 */
function _kejuFindDivision(id, hierarchy) {
  if (!hierarchy) hierarchy = GM.adminHierarchy;
  if (!hierarchy || !hierarchy.player || !hierarchy.player.divisions) return null;
  var result = null;
  function walk(nodes) {
    for (var i=0;i<(nodes||[]).length;i++) {
      if (!nodes[i]) continue;
      if (nodes[i].id === id || nodes[i].name === id) { result = nodes[i]; return; }
      if (nodes[i].children) { walk(nodes[i].children); if (result) return; }
    }
  }
  walk(hierarchy.player.divisions);
  return result;
}

/** 找某节点的指定级别祖先（自身若匹配直接返回） */
function _kejuFindAncestorByLevel(node, level, hierarchy) {
  if (!node) return null;
  if ((node.level || '') === level) return node;
  // 暴力扫：找所有 level=level 的节点·判断是否为 node 的祖先
  var all = [];
  if (!hierarchy) hierarchy = GM.adminHierarchy;
  function walk(nodes, ancestors) {
    (nodes||[]).forEach(function(n){
      if (!n) return;
      all.push({ node: n, ancestors: ancestors.slice() });
      if (n.children) walk(n.children, ancestors.concat([n]));
    });
  }
  if (hierarchy && hierarchy.player) walk(hierarchy.player.divisions, []);
  var mine = all.find(function(x){ return x.node === node; });
  if (!mine) return null;
  // 从祖先链里找 level 匹配的
  for (var i=mine.ancestors.length-1; i>=0; i--) {
    if ((mine.ancestors[i].level || '') === level) return mine.ancestors[i];
  }
  return null;
}

/** 从区划的公库扣钱·若不足返回 false */
function _kejuDeductFromDivision(node, amount) {
  if (!node || !node.publicTreasury || !node.publicTreasury.money) return false;
  var avail = node.publicTreasury.money.available != null ? node.publicTreasury.money.available : (node.publicTreasury.money.stock || 0);
  if (avail < amount) return false;
  node.publicTreasury.money.stock = Math.max(0, (node.publicTreasury.money.stock || 0) - amount);
  if (node.publicTreasury.money.available != null) node.publicTreasury.money.available = Math.max(0, node.publicTreasury.money.available - amount);
  node.publicTreasury.money.used = (node.publicTreasury.money.used || 0) + amount;
  return true;
}

/** D1·童/府/院试经费：县→府→省逐级回落 */
function payKejuLocalCost(level, locationNode, amount) {
  var exam = P.keju.currentExam;
  var result = { paidBy: null, fallback: false, shortfall: 0 };
  // 按级别查目标节点
  var chain = level === '童试' ? ['county','prefecture','province']
            : level === '府试' ? ['prefecture','province']
            : level === '院试' ? ['province']
            : ['province'];
  for (var i=0; i<chain.length; i++) {
    var target = _kejuFindAncestorByLevel(locationNode, chain[i]);
    if (target && _kejuDeductFromDivision(target, amount)) {
      result.paidBy = target.id || target.name;
      if (i > 0) {
        result.fallback = true;
        // 回落·公库 stress +3
        if (!target.publicTreasury.stress) target.publicTreasury.stress = 0;
        target.publicTreasury.stress += 3;
      }
      if (exam) exam.costsPaid.local = (exam.costsPaid.local || 0) + amount;
      return result;
    }
  }
  // 完全断粮
  result.shortfall = amount;
  if (exam) exam.costShortfall = true;
  return result;
}

/** 各省/府/县遍历扣童/府/院试费 */
function _kejuSettleLocalCosts(exam) {
  var costs = P.keju.costs || {};
  var multiplier = exam.type === 'enke' ? (costs.enkeMultiplier || 1.3) : 1.0;
  var perCounty = Math.round((costs.local && costs.local.perCounty || 80) * multiplier);
  var perPref   = Math.round((costs.local && costs.local.perPrefecture || 250) * multiplier);
  var perPE     = Math.round((costs.local && costs.local.perProvinceExam || 500) * multiplier);

  if (!GM.adminHierarchy || !GM.adminHierarchy.player) return;
  var shortfallProvinces = [];
  function walk(nodes) {
    (nodes||[]).forEach(function(n){
      if (!n) return;
      if (n.level === 'county') {
        var r = payKejuLocalCost('童试', n, perCounty);
        if (r.shortfall) shortfallProvinces.push(n.name);
      } else if (n.level === 'prefecture') {
        var r2 = payKejuLocalCost('府试', n, perPref);
        if (r2.shortfall) shortfallProvinces.push(n.name);
      } else if (n.level === 'province') {
        // 院试（只按省扣一次·走 province 级）
        if (!n._kejuYuanshiPaid) {
          _kejuDeductFromDivision(n, perPE);
          n._kejuYuanshiPaid = true;
        }
      }
      if (n.children) walk(n.children);
    });
  }
  walk(GM.adminHierarchy.player.divisions);
  if (shortfallProvinces.length) {
    _adjustMinxin(-2, '\u79D1\u4E3E\u00B7\u5730\u65B9\u7ECF\u8D39\u65ED\u4E0D\u8DB3\u00B7' + shortfallProvinces.slice(0,3).join('\u3001'));
  }
}

/** 乡试经费：每省独立 */
function _kejuSettleProvincialCosts(exam) {
  var costs = P.keju.costs || {};
  var multiplier = exam.type === 'enke' ? (costs.enkeMultiplier || 1.3) : 1.0;
  var perProv = Math.round((costs.provincial && costs.provincial.perProvince || 1000) * multiplier);
  if (!GM.adminHierarchy || !GM.adminHierarchy.player) return;
  (GM.adminHierarchy.player.divisions || []).forEach(function(prov){
    if (!prov || prov.level !== 'province') return;
    if (!_kejuDeductFromDivision(prov, perProv)) {
      // 回落无上级·本省预选减半
      prov._kejuPreliminaryHalved = true;
      _adjustMinxin(-1, '\u4E61\u8BD5\u7ECF\u8D39\u65ED\u4E0D\u8DB3\u00B7' + prov.name);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// v5·E1-E2·主考官题本 + 咨询问对
// ══════════════════════════════════════════════════════════════════

/** E1·主考官 AI 生成 3 道备选会试题 */
async function _kejuGenChiefExaminerMemorial(exam) {
  if (!exam || !exam.chiefExaminer) return;
  if (!P.ai || !P.ai.key) return;
  var examiner = findCharByName(exam.chiefExaminer);
  if (!examiner) return;

  var era = (P.dynasty || P.era || '');
  var partyCtx = examiner.party && examiner.party !== '无党派' ? ('\u4E3B\u8003\u5B98\u515A\u6D3E\uFF1A' + examiner.party + '\n') : '';
  var stanceCtx = examiner.stance ? ('\u7ACB\u573A\uFF1A' + examiner.stance + '\n') : '';
  var prompt = '\u4F60\u6263\u5F17\u4F60\u662F' + era + '\u79D1\u4E3E\u4F1A\u8BD5\u4E3B\u8003\u5B98 ' + exam.chiefExaminer +
    '\uFF08' + (examiner.officialTitle || examiner.title || '') + '\uFF09\u3002\u8BF7\u5411\u7687\u5E1D\u4E0A\u9898\u672C\uFF0C\u62DF\u5B9A 3 \u9053\u4F1A\u8BD5\u5907\u9009\u9898\u76EE\u3002\n\n' +
    partyCtx + stanceCtx +
    '\u667A\u8C0B' + (examiner.intelligence || 70) + '\u3001\u6027\u683C' + (examiner.personality || '') + '\n' +
    '\u5F53\u524D\u65F6\u5C40\uFF1A' + ((GM.eraState && GM.eraState.contextDescription) || '') + '\n' +
    '\u8FD4\u56DE JSON\uFF1A\n{\n' +
    '  "memorial": "\u62DF\u9898\u672C\u6587\uFF08\u534A\u6587\u8A00\u00B7200-400 \u5B57\u00B7\u7533\u660E\u9009\u9898\u7406\u7531\u4E0E\u98CE\u683C\uFF09",\n' +
    '  "candidates": [\n' +
    '    {"topic":"\u7B2C\u4E00\u9053\u9898\u76EE\u7684\u5168\u6587 80-150 \u5B57","rationale":"\u9009\u9898\u7406\u7531 30-60 \u5B57","style":"\u7B56\u8BBA/\u7ECF\u4E49/\u65F6\u52A1"},\n' +
    '    {"topic":"\u7B2C\u4E8C\u9053","rationale":"","style":""},\n' +
    '    {"topic":"\u7B2C\u4E09\u9053","rationale":"","style":""}\n' +
    '  ],\n' +
    '  "styleHint": "\u4F5C\u8005\u98CE\u683C\u7B80\u8FF0 20 \u5B57"\n' +
    '}\n\u53EA\u8F93\u51FA JSON\u3002';

  try {
    var raw = await callAISmart(prompt, 2000, { maxRetries: 2 });
    var data = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!data) data = JSON.parse(raw.replace(/```json|```/g, '').trim());
    exam.chiefExaminerMemorial = data;
    exam.huishiTopicCandidates = Array.isArray(data.candidates) ? data.candidates : [];
    _dbg('[科举·E1] 主考官题本生成完毕·候选数=', exam.huishiTopicCandidates.length);
    // 纪事
    if (typeof _kejuWriteJishi === 'function') {
      var topicsSum = exam.huishiTopicCandidates.slice(0,3).map(function(c,i){return (i+1)+'.'+(c.topic||c).slice(0,40);}).join(' | ');
      _kejuWriteJishi('\u4E3B\u8003\u9898\u672C', exam.chiefExaminer + '\u4E0A\u9898\u672C', topicsSum);
    }
    if (typeof addEB === 'function') addEB('\u79D1\u4E3E', exam.chiefExaminer + '\u4E0A\u4F1A\u8BD5\u9898\u672C\u00B7\u5F85\u9662\u4E0B\u9605\u65B0');
    // 主考官 NPC 记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(exam.chiefExaminer, '\u4E3A\u672C\u79D1\u4F1A\u8BD5\u62DF\u9898\u00B7\u4E0A\u9898\u672C\u4E8E\u9661\u4E0B', '\u5FD7', 6);
    }
  } catch(e) {
    console.warn('[科举·E1] 题本生成失败', e);
  }
}

/** E2·咨询问对（会试场景·〔咨询他臣〕） */
function kejuConsultCourtier() {
  var exam = P.keju.currentExam;
  if (!exam) return;
  var topic = exam.huishiTopic || '会试题拟';
  var context = '主考官 ' + exam.chiefExaminer + ' 拟定会试题：\n' + topic.slice(0, 200);
  // 打开问对面板·传入话题
  if (typeof openWenduiPanel === 'function') {
    openWenduiPanel({ initialTopic: '\u54A8\u8BE2\u4F1A\u8BD5\u62DF\u9898', contextHint: context });
  } else if (typeof openChaoyi === 'function') {
    openChaoyi();
    setTimeout(function(){
      var topicEl = _$('cy-topic-input');
      if (topicEl) topicEl.value = '\u54A8\u8BE2\u4F1A\u8BD5\u62DF\u9898\uFF1A' + topic.slice(0,60);
    }, 100);
  }
  toast('\u2709 \u5DF2\u5F00\u95EE\u5BF9\u00B7\u5F85\u5927\u81E3\u610F\u89C1');
}

/** E2·咨询馆阁（殿试场景·〔咨询馆阁〕） */
function kejuConsultGuanGe() {
  var exam = P.keju.currentExam;
  if (!exam) return;
  var topic = exam.playerQuestion || '\u6BBE\u8BD5\u7B56\u95EE';
  var context = '\u6BBE\u8BD5\u4F59\u6B32\u4EB2\u7B56\uFF1A\n' + topic.slice(0, 200);
  // 筛馆阁·内阁大学士+翰林院+礼部
  var guanGeChars = (GM.chars || []).filter(function(c){
    if (!c || c.alive === false) return false;
    var t = c.officialTitle || c.title || '';
    return /\u5927\u5B66\u58EB|\u7FF0\u6797|\u793C\u90E8/.test(t);
  }).slice(0, 6);

  if (typeof openWenduiPanel === 'function') {
    openWenduiPanel({ initialTopic: '\u54A8\u8BE2\u6BBE\u8BD5\u62DF\u9898', contextHint: context, suggestedChars: guanGeChars.map(function(c){return c.name;}) });
  } else if (typeof openChaoyi === 'function') {
    openChaoyi();
    setTimeout(function(){
      var topicEl = _$('cy-topic-input');
      if (topicEl) topicEl.value = '\u54A8\u8BE2\u6BBE\u8BD5\u7B56\u95EE\uFF1A' + topic.slice(0,60);
    }, 100);
  }
  toast('\u2709 \u5DF2\u5F00\u95EE\u5BF9\u00B7\u5F85\u9986\u9601\u610F\u89C1');
}

// ══════════════════════════════════════════════════════════════════
// v5·F1·殿试主持人选任 / 考官自动选
// ══════════════════════════════════════════════════════════════════

/**
 * 判定角色是否属于玩家势力（科举等国事官职只能从玩家势力派任）
 * @param {Object} c
 * @returns {boolean}
 */
function _isPlayerFactionChar(c) {
  if (!c || c.alive === false) return false;
  var pc = (GM.chars || []).find(function(x){ return x && x.isPlayer; });
  if (!pc) return !c.faction;  // 无 player char 时·只认无 faction 者
  // 同势力（按 faction 名匹配）
  if (c.faction && pc.faction && c.faction === pc.faction) return true;
  // 玩家势力首领可能 faction 字段留空·但 isPlayer=true·此时其同僚 faction 也可能空
  if (!c.faction && !pc.faction) return true;
  return false;
}

/** 打开殿试主持人选任面板 */
function openDianshiDelegatePicker() {
  var exam = P.keju.currentExam;
  if (!exam) return;
  var candidates = (GM.chars||[]).filter(function(c){
    return c && c.alive !== false && !c.isPlayer && c.officialTitle && _isAtCapital(c)
           && _isPlayerFactionChar(c);  // ★ 仅本朝/玩家势力官员可代主殿试
  });
  if (!candidates.length) { toast('\u4EAC\u4E2D\u65E0\u5728\u4EFB\u5B98\u5458\u53EF\u4EE3\u4E3B\u6BBE\u8BD5'); return; }
  // 排序：品级→智力
  candidates.sort(function(a,b){
    var ra = _parseRankNumber ? _parseRankNumber(a) : 9;
    var rb = _parseRankNumber ? _parseRankNumber(b) : 9;
    if (ra !== rb) return ra - rb;
    return (b.intelligence||0) - (a.intelligence||0);
  });
  var bg = document.createElement('div');
  bg.id = 'dianshi-delegate-picker';
  bg.style.cssText = 'position:fixed;inset:0;z-index:4850;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:10px;padding:1.2rem 1.4rem;max-width:680px;width:90%;max-height:80vh;overflow-y:auto;">'+
    '<div style="font-size:1.08rem;color:var(--gold);font-weight:700;margin-bottom:0.6rem;">\u3014\u9009\u4EFB\u6BBE\u8BD5\u4EE3\u4E3B\u4EBA\u3015</div>'+
    '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.8rem;line-height:1.7;">\u7687\u5E1D\u4E0D\u5728\u4EAC\u5E08\u00B7\u9700\u9009\u5728\u4EAC\u5B98\u5458\u4EE3\u4E3B\u6BBE\u8BD5\u3002\u4E0D\u540C\u8EAB\u4EFD\u5F71\u54CD\u5929\u5B50\u95E8\u751F\u5173\u7CFB\u3002</div>'+
    '<input id="delegate-search" placeholder="\u641C\u7D22\u59D3\u540D/\u5B98\u804C" style="width:100%;padding:5px 8px;margin-bottom:0.5rem;background:var(--bg-3);border:1px solid var(--bdr);color:var(--txt);" oninput="_filterDelegateList(this.value)">'+
    '<div id="delegate-list" style="max-height:360px;overflow-y:auto;">';
  candidates.forEach(function(c){
    var lbl = _kejuClassifyDelegate(c);
    html += '<div class="delegate-row" data-name="'+escHtml(c.name)+'" style="padding:0.5rem 0.6rem;margin-bottom:3px;background:var(--bg-3);border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:8px;" onclick="_pickDianshiDelegate(\''+escHtml(c.name).replace(/\'/g,"\\'")+'\')">'+
      '<strong style="flex:1;">'+escHtml(c.name)+'</strong>'+
      '<span style="font-size:0.75rem;color:var(--txt-d);">'+escHtml(c.officialTitle||c.title||'')+'</span>'+
      '<span style="font-size:0.68rem;background:'+lbl.color+';color:#fff;padding:1px 4px;border-radius:2px;">'+lbl.label+'</span>'+
      '</div>';
  });
  html += '</div><div style="text-align:center;margin-top:0.6rem;"><button class="bt" onclick="this.closest(\'#dianshi-delegate-picker\').remove();">\u53D6\u6D88</button></div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

/** 分类代主身份 */
function _kejuClassifyDelegate(c) {
  var t = c.officialTitle || c.title || '';
  var role = c.role || '';
  if (role === '太子' || t.indexOf('太子') >= 0) return { label:'\u592A\u5B50', color:'var(--gold)' };
  if (t.indexOf('首辅') >= 0) return { label:'\u9996\u8F85', color:'var(--celadon-400)' };
  if (t.indexOf('礼部尚书') >= 0) return { label:'\u793C\u90E8', color:'var(--celadon-400)' };
  if (c.familyTier === 'royal' || role.indexOf('王') >= 0) return { label:'\u5B97\u5BA4', color:'var(--amber-400)' };
  if ((c.party||'').indexOf('\u9609') >= 0 || role.indexOf('\u6743\u81E3') >= 0) return { label:'\u6743\u81E3', color:'var(--vermillion-400)' };
  if (/\u5C06\u519B|\u603B\u5175|\u5927\u5C06/.test(t)) return { label:'\u6B66\u5C06', color:'var(--red)' };
  return { label:'\u6587\u81E3', color:'var(--ink-300)' };
}

/** 筛选代主列表 */
function _filterDelegateList(query) {
  query = (query || '').toLowerCase();
  var rows = document.querySelectorAll('#delegate-list .delegate-row');
  rows.forEach(function(r){
    var txt = r.textContent.toLowerCase();
    r.style.display = (!query || txt.indexOf(query) >= 0) ? '' : 'none';
  });
}

/** 选中代主 */
function _pickDianshiDelegate(name) {
  var exam = P.keju.currentExam;
  if (!exam) return;
  var c = findCharByName(name);
  if (!c) return;
  exam.dianshiDelegate = { name: name, officialTitle: c.officialTitle || c.title, classification: _kejuClassifyDelegate(c).label };
  // 身份副作用
  var lbl = exam.dianshiDelegate.classification;
  if (lbl === '\u6743\u81E3') _adjustHuangwei(-3, '\u4EE3\u4E3B\u6743\u81E3\u00B7\u79C1\u76F8\u6388\u53D7');
  else if (lbl === '\u6B66\u5C06') {
    _adjustMinxin(-2, '\u6B66\u5C06\u4EE3\u4E3B\u6BBE\u8BD5\u00B7\u793C\u90E8\u6297\u8BAE');
    if (typeof addEB === 'function') addEB('\u79D1\u4E3E', '\u793C\u90E8\u5927\u81E3\u6297\u8BAE\u6B66\u5C06\u4E3B\u6BBE\u8BD5');
  } else if (lbl === '\u5B97\u5BA4') {
    // 宗室满意+10
    var zs = (GM.classes||[]).find(function(cl){ return cl.name === '\u5B97\u5BA4'; });
    if (zs) zs.satisfaction = Math.min(100, (zs.satisfaction||50) + 10);
  }
  toast('\u5DF2\u4EFB '+name+' \u4E3A\u6BBE\u8BD5\u4EE3\u4E3B');
  // v5·纪事 + NPC 记忆
  if (typeof _kejuWriteJishi === 'function') _kejuWriteJishi('\u59D4\u4EFB\u6BBE\u8BD5\u4EE3\u4E3B', name + '\u00B7' + lbl, '\u7687\u5E1D\u4E0D\u5728\u4EAC\u5E08\u00B7\u6388\u6743\u4EE3\u4E3B');
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    NpcMemorySystem.remember(name, '\u8499\u7687\u5E1D\u59D4\u4EFB\u4EE3\u4E3B\u6BBE\u8BD5\u00B7' + lbl + '\u00B7\u4E3A\u663E\u8D35\u4E4B\u6743', '\u5FD7', 8, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B');
  }
  if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
    AffinityMap.add(name, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', 4, '\u7687\u5E1D\u6388\u6BBE\u8BD5\u4EE3\u4E3B\u4E4B\u8363');
  }
  var pp = document.getElementById('dianshi-delegate-picker'); if (pp) pp.remove();
}

/** 考官自动选（玩家未选时由 AI 代选·皇威已在 B2 扣分） */
function _kejuAutoPickExaminer(exam) {
  if (!exam) return;
  var cands = (GM.chars || []).filter(function(c){
    return c && c.alive !== false && !c.isPlayer && (c.intelligence||0) >= 60
           && _isPlayerFactionChar(c);  // ★ 仅玩家势力
  }).sort(function(a,b){ return (b.intelligence||0)-(a.intelligence||0); });
  if (cands.length === 0) return;
  var chosen = cands[0];
  exam.chiefExaminer = chosen.name;
  exam.examinerParty = chosen.party || '';
  exam.examinerStance = chosen.stance || chosen.personality || '';
  exam.examinerIntelligence = chosen.intelligence || 50;
  if (typeof addEB === 'function') addEB('\u79D1\u4E3E', '\u7687\u5E1D\u672A\u9009\u00B7AI \u4EE3\u9009 ' + chosen.name + ' \u4E3A\u4E3B\u8003');
}

/** 进入需玩家决策阶段·显著提醒（顶栏浮条+toast+纪事） */
function _kejuNotifyUrgentStage(exam, stage) {
  if (!exam || exam.stage !== stage) return;
  var cfg = {
    examiner_select: {
      title: '\u793C\u90E8\u5019\u65E8\u00B7\u9009\u4EFB\u672C\u79D1\u4E3B\u8003',
      urgency: '\u4F59 ' + ((P.keju.stageDurationDays && P.keju.stageDurationDays.examiner_select) || 15) + ' \u65E5\u00B7\u9010\u671F\u5C06\u7531\u5409\u90E8\u4EE3\u9009\u00B7\u6263\u7687\u5A01 3',
      action: '\u5373\u523B\u9009\u4EFB',
      color: '#B89A53'
    },
    huishi_draft: {
      title: '\u4E3B\u8003\u5B98\u5DF2\u4E0A\u9898\u672C\u00B7\u5F85\u9605\u5B9A',
      urgency: '\u4F59 ' + ((P.keju.stageDurationDays && P.keju.stageDurationDays.huishi_draft) || 20) + ' \u65E5\u00B7\u9010\u671F\u91C7\u4E3B\u8003\u9996\u9009\u00B7\u6263\u7687\u5A01 2',
      action: '\u5373\u523B\u5BA1\u9605',
      color: '#B89A53'
    },
    dianshi_draft: {
      title: '\u6BBE\u8BD5\u5FC5\u7531\u5929\u5B50\u4EB2\u62DF\u7B56\u95EE',
      urgency: '\u4F59 ' + ((P.keju.stageDurationDays && P.keju.stageDurationDays.dianshi_draft) || 15) + ' \u65E5\u00B7\u9010\u671F AI \u4EE3\u62DF\u00B7\u6263\u7687\u5A01 2',
      action: '\u4EB2\u62DF\u7B56\u95EE',
      color: '#C44040'
    }
  };
  var c = cfg[stage];
  if (!c) return;
  _kejuShowUrgentBanner(c.title, c.urgency, c.action, c.color);
  if (typeof toast === 'function') {
    toast('\uD83D\uDCDC ' + c.title + '\u00B7\u70B9\u9876\u680F\u300C\u5F85\u529E\u300D\u724C\u6216\u300C\u79D1\u4E3E\u300D\u9762\u677F\u6267\u884C', 'info');
  }
  if (typeof addEB === 'function') addEB('\u79D1\u4E3E\u00B7\u5F85\u529E', c.title, {important:true});
  if (GM.qijuHistory) {
    GM.qijuHistory.unshift({
      turn: GM.turn,
      date: (typeof getTSText === 'function') ? getTSText(GM.turn) : 'T'+(GM.turn||0),
      content: '\u3010\u79D1\u4E3E\u00B7\u5F85\u529E\u3011' + c.title + '\u3002' + c.urgency
    });
  }
}

/** 科举待办浮条（常驻右上·直到进入下一阶段） */
function _kejuShowUrgentBanner(title, urgency, actionLabel, color) {
  var existing = document.getElementById('keju-urgent-banner');
  if (existing) existing.remove();
  var banner = document.createElement('div');
  banner.id = 'keju-urgent-banner';
  banner.style.cssText = ''
    + 'position:fixed;top:72px;right:16px;z-index:900;'
    + 'background:linear-gradient(135deg,rgba(15,13,10,0.97),rgba(30,25,18,0.95));'
    + 'border:1px solid ' + color + ';border-left:3px solid ' + color + ';'
    + 'border-radius:8px;padding:0.6rem 0.9rem;'
    + 'max-width:300px;box-shadow:0 4px 16px rgba(0,0,0,0.4);'
    + 'font-family:inherit;cursor:pointer;animation:kejuUrgentPulse 2s ease-in-out infinite;';
  banner.innerHTML = ''
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">'
    +   '<div style="flex:1;">'
    +     '<div style="font-size:0.72rem;color:' + color + ';letter-spacing:0.1em;">\u3014 \u79D1\u4E3E\u5F85\u529E \u3015</div>'
    +     '<div style="font-size:0.88rem;font-weight:700;color:#E8D9B0;margin:2px 0;">' + title + '</div>'
    +     '<div style="font-size:0.7rem;color:#B0A088;line-height:1.4;">' + urgency + '</div>'
    +   '</div>'
    +   '<button onclick="event.stopPropagation();document.getElementById(\'keju-urgent-banner\').remove();" style="background:transparent;border:none;color:#807060;font-size:16px;cursor:pointer;padding:0;line-height:1;">\u2715</button>'
    + '</div>'
    + '<div style="margin-top:6px;text-align:right;">'
    +   '<button onclick="event.stopPropagation();_kejuUrgentAction();" style="background:' + color + ';border:none;color:#1a1410;padding:4px 14px;border-radius:4px;font-size:0.76rem;font-weight:700;cursor:pointer;">' + actionLabel + ' \u2192</button>'
    + '</div>';
  banner.onclick = function() { if (typeof _kejuUrgentAction === 'function') _kejuUrgentAction(); };
  document.body.appendChild(banner);
  // 注入一次动画 style
  if (!document.getElementById('keju-urgent-style')) {
    var s = document.createElement('style');
    s.id = 'keju-urgent-style';
    s.textContent = '@keyframes kejuUrgentPulse{0%,100%{box-shadow:0 4px 16px rgba(0,0,0,0.4);}50%{box-shadow:0 4px 24px ' + color + '66;}}';
    document.head.appendChild(s);
  }
}

/** 点击"即刻选任/审阅/亲拟"按钮·打开科举面板或对应弹窗 */
function _kejuUrgentAction() {
  var banner = document.getElementById('keju-urgent-banner');
  if (banner) banner.remove();
  if (typeof showKejuModal === 'function') showKejuModal();
}

/** 进入下一阶段时·或科举结束时·清掉浮条 */
function _kejuClearUrgentBanner() {
  var b = document.getElementById('keju-urgent-banner');
  if (b) b.remove();
}

// 暴露到 window
if (typeof window !== 'undefined') {
  window._kejuNotifyUrgentStage = _kejuNotifyUrgentStage;
  window._kejuUrgentAction = _kejuUrgentAction;
  window._kejuClearUrgentBanner = _kejuClearUrgentBanner;
}

// ══════════════════════════════════════════════════════════════════
// v5·F2·历史名臣 AI 检索
// ══════════════════════════════════════════════════════════════════

/** 根据游戏模式决定时间窗 */
function _kejuHistoricalWindow() {
  var mode = (P.conf && P.conf.gameMode) || 'yanyi';
  if (mode === 'strict_hist') return 100;
  if (mode === 'light_hist') return 150;
  return null;  // 演义·不限
}

/** F2·AI 检索历史名臣考生 */
async function pickHistoricalCandidates(exam) {
  if (!P.keju.historicalFigurePolicy || !P.keju.historicalFigurePolicy.enableHistorical) return [];
  if (!P.ai || !P.ai.key) return [];

  var year = GM.year || (P.time && P.time.year) || 1600;
  var window = _kejuHistoricalWindow();
  var mode = (P.conf && P.conf.gameMode) || 'yanyi';

  if (!P.keju._historicalFiguresUsed) P.keju._historicalFiguresUsed = [];
  // 现任官员（含实职/散衔/后妃/武将皆不可参加科举）
  var existingOfficialsSet = {};
  (GM.chars || []).forEach(function(c){
    if (!c || c.alive === false) return;
    if (c.officialTitle || (c.title && c.title.length > 0) || c.spouse || c.isPlayer) existingOfficialsSet[c.name] = true;
  });
  var existingOfficials = Object.keys(existingOfficialsSet);
  var usedNames = P.keju._historicalFiguresUsed.concat(
    (GM.chars || []).filter(function(c){ return c && c.isHistorical && c.source === '\u79D1\u4E3E'; }).map(function(c){ return c.name; }),
    existingOfficials
  );

  var prompt = '\u4F60\u662F\u5386\u53F2\u8003\u636E AI\u3002\u4E3A' + (P.dynasty || P.era || '') + '\u671D ' + year +
    ' \u5E74\u7684\u79D1\u4E3E\u6BBE\u8BD5\u68C0\u7D22\u5F53\u65F6\u53EF\u80FD\u5165\u9009\u7684\u5386\u53F2\u540D\u81E3\u8003\u751F\u3002\n\n' +
    '\u3010\u786C\u89C4\u5219\u3011\u6240\u9009\u4EBA\u9009\u5FC5\u987B\u4E3A\u5E03\u8863/\u76D1\u751F/\u4E3E\u4EBA/\u672A\u51FA\u4ED5\u7684\u4E66\u751F\u00B7\u7EDD\u4E0D\u80FD\u662F\u5DF2\u4EFB\u5B98\u804C\u8005\uFF08\u90FD\u5FA1\u53F2/\u5C1A\u4E66/\u5927\u5B66\u58EB/\u90E8\u4F8D\u90CE/\u5C06\u519B/\u6307\u6325\u4F7F/\u540E\u5983\u7B49\u5747\u4E0D\u53EF\uFF09\u3002\n' +
    '\u3010\u786C\u89C4\u5219\u3011\u6240\u9009\u4EBA\u9009\u5728\u672C\u671D\u53F2\u4E66\u4E2D\u4E0D\u80FD\u5DF2\u7ECF\u767B\u79D1\u00B7\u5FC5\u987B\u662F ' + year + ' \u5E74\u524D\u540E\u624D\u4E2D\u79D1\u6216\u5C1A\u672A\u4E2D\u79D1\u4E4B\u4EBA\u3002\n' +
    '\u65F6\u95F4\u7EA6\u675F\uFF1A' + (window ? ('\u987B\u4E3A ' + (year - window) + '~' + (year + window) + ' \u5E74\u95F4\u5386\u53F2\u6D3B\u8DC3\u7684\u4EBA\u7269') : '\u4EFB\u610F\u671D\u4EE3\u5386\u53F2\u540D\u81E3\u7686\u53EF\uFF08\u6F14\u4E49\u6A21\u5F0F\uFF09') + '\n' +
    '\u5E74\u9F84\u7EA6\u675F\uFF1A\u6B64\u4EBA\u5728 ' + year + ' \u5E74\u987B\u4E3A\u5408\u9002\u5E94\u8BD5\u5E74\u9F84 (20-45 \u5C81\u4E3A\u4F73\uFF0C\u6700\u591A 55 \u5C81)\n' +
    '\u5DF2\u7528\u8FC7 / \u5DF2\u4EFB\u5B98\uFF08\u4E25\u7981\u8FD4\u56DE\u4EE5\u4E0B\u59D3\u540D\uFF09\uFF1A' + (usedNames.length ? usedNames.slice(0,80).join('\u3001') + (usedNames.length>80?'\u7B49':'') : '\u65E0') + '\n\n' +
    '\u8FD4\u56DE 5-8 \u540D\u5019\u9009\uFF0CJSON \u6570\u7EC4\uFF1A\n' +
    '[{"name":"\u5019\u9009\u540D","age":34,"class":"\u5BD2\u95E8/\u58EB\u65CF","origin":"\u6D59\u6C5F\u4E0A\u865E",\n' +
    '  "historicalYearMet":1622,"nativeEra":"\u660E","party":"\u4E1C\u6797/\u6D59\u515A/\u65E0",\n' +
    '  "shiliao":"\u300A\u660E\u53F2\u00B7\u5217\u4F20\u300B\u5377\u4E8C\u767E\u516D\u5341\u4E94\uFF1A\u300C\u5019\u9009\u540D\uFF0C\u5B57\u67D0\uFF0C\u67D0\u5730\u4EBA\u3002\u2026\u300D\uFF08\u5FC5\u987B\u662F\u771F\u5B9E\u53F2\u6599\u539F\u6587\u6458\u5F15\uFF09",\n' +
    '  "personality":"\u521A\u76F4/\u5706\u6ED1/\u5B66\u8005","famousFor":"\u8BE5\u4EBA\u5386\u53F2\u4E3B\u8981\u8D21\u732E 20-40 \u5B57",\n' +
    '  "probability":0.8\n' +
    '}]\n\n\u53EA\u8F93\u51FA JSON\u3002';

  try {
    var _tokBudget = (P.conf && P.conf.maxOutputTokens) || (P.conf && P.conf._detectedMaxOutput) || 4000;
    var raw = await callAISmart(prompt, _tokBudget, { maxRetries: 2 });
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!parsed) {
      var m = (raw||'').match(/\[[\s\S]*\]/);
      if (m) try { parsed = JSON.parse(m[0]); } catch(_){}
    }
    if (!Array.isArray(parsed)) return [];

    var valid = parsed.filter(function(c){
      if (!c || !c.name) return false;
      if (usedNames.indexOf(c.name) >= 0) return false;
      // 再次过滤：若此名已在 GM.chars 且有官职·强制剔除（AI 硬性违规）
      var _existCh = (typeof findCharByName === 'function') ? findCharByName(c.name) : null;
      if (_existCh && (_existCh.officialTitle || _existCh.title || _existCh.spouse || _existCh.isPlayer)) {
        console.warn('[\u79D1\u4E3E\u00B7\u6EE4] \u4E22\u5F03\u5DF2\u4EFB\u5B98\u5019\u9009:', c.name, _existCh.officialTitle||_existCh.title);
        return false;
      }
      if (!c.age || c.age < 18 || c.age > 60) return false;
      return Math.random() < (c.probability || 0.7);
    });

    // 记入全局池
    valid.forEach(function(c){
      if (P.keju._historicalFiguresUsed.indexOf(c.name) < 0) P.keju._historicalFiguresUsed.push(c.name);
    });
    // 演义模式：检测跨朝代
    valid.forEach(function(c){
      if (mode === 'yanyi' && c.nativeEra && (P.dynasty||'').indexOf(c.nativeEra) < 0) {
        c._timeAnomaly = true;
      }
    });
    exam.historicalHits = valid.map(function(c){ return c.name; });
    return valid;
  } catch(e) {
    console.warn('[科举·F2] 历史名臣检索失败', e);
    return [];
  }
}

// 暴露到 window·供 HTML onclick 用
if (typeof window !== 'undefined') {
  window.startKejuByMethod = startKejuByMethod;
  window.resolveKejuCouncilResult = resolveKejuCouncilResult;
  window.kejuConsultCourtier = kejuConsultCourtier;
  window.kejuConsultGuanGe = kejuConsultGuanGe;
  window.advanceKejuByDays = advanceKejuByDays;
  window.openDianshiDelegatePicker = openDianshiDelegatePicker;
  window._pickDianshiDelegate = _pickDianshiDelegate;
  window._filterDelegateList = _filterDelegateList;
}

/** D2·中央经费（考官仪仗+会试+殿试）·不足问玩家内帑补贴 */
function _kejuSettleCentralCost(exam, stage) {
  var costs = P.keju.costs || {};
  var multiplier = exam.type === 'enke' ? (costs.enkeMultiplier || 1.3) : 1.0;
  var amount = 0;
  if (stage === 'examiner') amount = Math.round((costs.examiner || 500) * multiplier);
  else if (stage === 'huishi') amount = Math.round((costs.huishi || 10000) * multiplier);
  else if (stage === 'dianshi') amount = Math.round((costs.dianshi || 4000) * multiplier);
  if (amount <= 0) return;

  var guokuMoney = (GM.guoku && GM.guoku.money) || 0;
  if (guokuMoney >= amount) {
    if (GM.guoku) GM.guoku.money = Math.max(0, guokuMoney - amount);
    exam.costsPaid.central = (exam.costsPaid.central || 0) + amount;
    if (typeof addEB === 'function') addEB('\u79D1\u4E3E\u7ECF\u8D39', '\u5E11\u5EAA\u6263 ' + amount + ' \u4E24\u00B7' + stage);
    return { paid: amount, source: 'guoku' };
  }
  // 帑廪不足·弹窗问是否内帑补贴
  var neitangMoney = (GM.neitang && GM.neitang.money) || 0;
  if (neitangMoney >= amount) {
    // 默认自动内帑补贴（避免阻塞时间线·可改为弹窗确认）
    GM.neitang.money = Math.max(0, neitangMoney - amount);
    exam.costsPaid.central = (exam.costsPaid.central || 0) + amount;
    if (typeof addEB === 'function') addEB('\u79D1\u4E3E\u7ECF\u8D39', '\u5185\u5E11\u8865\u8D34 ' + amount + ' \u4E24\u00B7' + stage);
    _adjustHuangwei(2, '\u53D1\u5185\u5E11\u6D4E\u79D1\u4E3E\u00B7\u58EB\u6797\u611F\u9891');
    return { paid: amount, source: 'neitang' };
  }
  // 完全断粮·流产
  exam.costShortfall = true;
  _adjustHuangwei(-10, '\u79D1\u4E3E\u7ECF\u8D39\u5B8C\u5168\u65AD\u7CAE');
  _adjustMinxin(-5, '\u79D1\u4E3E\u7591\u56E0\u8D22\u653F\u505C\u529E');
  if (typeof toast === 'function') toast('\u26A0 \u79D1\u4E3E\u7ECF\u8D39\u65AD\u7CAE\u00B7\u672C\u79D1\u6D41\u4EA7');
  // 直接推进到 finished
  exam.stage = 'finished';
  return { paid: 0, source: null, aborted: true };
}

/**
 * 请求启用科举（隋唐后朝代）
 */
async function requestEnableKeju(){
  if(!P.ai.key){
    P.keju.enabled=true;
    P.keju.examIntervalNote='三年一科';
    toast('✅ 科举制度已启用');
    document.getElementById('keju-panel-modal').remove();
    return;
  }

  showLoading('请求启用科举...',50);

  try{
    var prompt='你是朝廷大臣AI。玩家请求启用科举制度。\n\n'+
      '【当前状况】\n'+
      '国库：'+(GM.vars['国库']?GM.vars['国库'].value:'未知')+'\n'+
      '民心：'+(GM.vars['民心']?GM.vars['民心'].value:'未知')+'\n'+
      '局势：'+(GM.situation||'正常')+'\n\n'+
      '【判断要求】\n'+
      '1. 判断是否可以启用科举（考虑财政、时局等）\n'+
      '2. 如果可以，说明考试间隔\n'+
      '3. 如果不可以，说明原因和需要满足的条件\n\n'+
      '返回JSON：{"canEnable":true/false,"reason":"","intervalNote":"三年一科"}\n\n'+
      '只输出JSON。';

    var result=await callAISmart(prompt,500,{maxRetries:2});
    var data=JSON.parse(result.replace(/```json|```/g,'').trim());

    hideLoading();

    if(data.canEnable){
      P.keju.enabled=true;
      P.keju.examIntervalNote=data.intervalNote||'三年一科';
      toast('✅ '+data.reason);
      document.getElementById('keju-panel-modal').remove();
    }else{
      toast('❌ '+data.reason);
    }
  }catch(e){
    console.error('[科举] 请求启用失败:',e);
    hideLoading();
    toast('❌ 请求失败');
  }
}

/**
 * 发起科举改革（隋唐前朝代）
 */
async function startKejuReform(){
  if(!P.ai.key){
    P.keju.enabled=true;
    P.keju.reformed=true;
    P.keju.examIntervalNote='三年一科';
    toast('✅ 科举改革成功');
    document.getElementById('keju-panel-modal').remove();
    return;
  }

  showLoading('改革进行中...',30);

  try{
    var prompt='你是历史推演AI。玩家在隋唐之前的朝代发起科举制度改革。\n\n'+
      '【当前状况】\n'+
      '国库：'+(GM.vars['国库']?GM.vars['国库'].value:'未知')+'\n'+
      '民心：'+(GM.vars['民心']?GM.vars['民心'].value:'未知')+'\n'+
      '集权度：'+(GM.vars['集权度']?GM.vars['集权度'].value:'未知')+'\n\n'+
      '【改革要求】\n'+
      '1. 科举改革会遭遇世家大族强烈反对\n'+
      '2. 需要足够的集权度才能推行\n'+
      '3. 改革可能引发政治动荡、叛乱等\n'+
      '4. 成功后会削弱世家势力，增强中央集权\n\n'+
      '请推演改革结果，返回JSON：{"success":true/false,"reason":"","consequences":"改革后果描述200字","variableChanges":{"集权度":+15}}\n\n'+
      '只输出JSON。';

    var result=await callAISmart(prompt,1000,{maxRetries:2});
    var data=JSON.parse(result.replace(/```json|```/g,'').trim());

    hideLoading();

    // 应用变量变化
    if(data.variableChanges){
      Object.keys(data.variableChanges).forEach(function(varName){
        if(GM.vars[varName]){
          GM.vars[varName].value+=data.variableChanges[varName];
        }
      });
    }

    if(data.success){
      P.keju.enabled=true;
      P.keju.reformed=true;
      P.keju.examIntervalNote='三年一科';

      // 显示改革结果
      var resultModal=document.createElement('div');
      resultModal.className='modal-bg show';
      resultModal.innerHTML='<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:600px;padding:1.5rem;">'+
        '<h3 style="color:var(--gold);margin-bottom:1rem;">🎉 科举改革成功</h3>'+
        '<p style="line-height:1.8;margin-bottom:1rem;">'+data.consequences+'</p>'+
        '<div style="text-align:center;">'+
        '<button class="bt bp" onclick="this.closest(\'.modal-bg\').remove();document.getElementById(\'keju-panel-modal\').remove();">确定</button>'+
        '</div></div>';
      document.body.appendChild(resultModal);

      renderGameState();
    }else{
      toast('❌ 改革失败：'+data.reason);
    }
  }catch(e){
    console.error('[科举] 改革失败:',e);
    hideLoading();
    toast('❌ 改革失败');
  }
}


