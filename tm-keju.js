// @ts-check
/// <reference path="types.d.ts" />
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
// 历史记录里的 date 字段形态不一：有的是 {year,month} 对象，有的是字符串("天启七年"/getTSText)，
// 有的整个缺失(_kejuArchiveExam / AI 写入 / 旧存档)。统一成可显示字符串，缺失就返回空，绝不抛错。
function _kejuFmtDate(d){
  if(d==null) return '';
  if(typeof d==='string') return d;
  if(typeof d==='object'){
    if(d.year!=null) return d.year+'年'+(d.month!=null?d.month+'月':'');
    if(d.text) return String(d.text);
  }
  return '';
}

// ── 特科明细（恩科/武举/童子科 history 可展开·原仅显 .length 计数·display-only）──
// 缘由 subtype 是技术串(bingbu-backed/tesuoming-fengchan/birthday 等)·prefix 映射中文·不显英文
function _kjExamReasonCN(h){
  var s=String((h&&(h.subtype||h.historyPath))||'').toLowerCase();
  if(/birthday|寿|圣寿/.test(s))return '圣寿恩科';
  if(/reign|登极|即位/.test(s))return '登极恩科';
  if(/fengchan|封禅|瑞|祥|auspicious/.test(s))return '祥瑞特开';
  if(/war|战功|录功|军功|merit/.test(s))return '录功之科';
  if(/chaos|乱|war-recovery/.test(s))return '乱后抡才';
  if(/bingbu|兵部/.test(s))return '兵部所请';
  if(/libu|礼部/.test(s))return '礼部所请';
  if(/player|御|edict|钦/.test(s))return '御点亲开';
  if(/recommend|荐|conversion|late-bloomer|转/.test(s))return '荐举/转录';
  return '';
}
function _kjHistRows(arr,kind){
  if(!arr||!arr.length)return '<p style="color:var(--txt-d);font-size:0.8rem;padding:4px 2px;">暂无开科记录。</p>';
  return arr.slice().reverse().map(function(h){
    var names=(kind==='enke'?h.jinshiNames:(kind==='wuju'?h.wujinshiNames:null));
    var cnt=(kind==='enke'?h.jinshiCount:(kind==='wuju'?h.wujinshiCount:h.poolSize));
    var reason=_kjExamReasonCN(h);
    var who=(names&&names.length)?('<span style="color:var(--txt-d);"> · '+names.slice(0,8).join('、')+(names.length>8?' 等':'')+'</span>'):'';
    return '<div style="font-size:0.82rem;color:var(--txt);padding:4px 2px;border-bottom:1px solid rgba(180,150,80,0.12);">'
      +'<b style="color:var(--gold);">'+(h.year!=null?h.year+'年':'—')+'</b>'
      +(reason?' <span style="color:var(--accent,#b5803a);">'+reason+'</span>':'')
      +(h.examiner?' · 主考 '+h.examiner:'')
      +' · '+(kind==='tongzi'?'选童 ':'中式 ')+(cnt!=null?cnt:'?')+(kind==='tongzi'?' 名':' 人')
      +who+'</div>';
  }).join('');
}

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
      '<p>\u4E0A\u6B21\u79D1\u4E3E\uFF1A'+(_kejuFmtDate(P.keju.lastExamDate)||'\u4ECE\u672A\u4E3E\u529E')+'</p>';

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
        if(!h) return;
        var _kd = _kejuFmtDate(h.date) || '时间不详';
        var _t3 = Array.isArray(h.topThree) ? h.topThree : [];
        content+='<div style="padding:0.5rem;background:var(--bg-3);margin-bottom:0.3rem;border-radius:4px;">'+
          '<p><strong>'+_kd+'</strong></p>'+
          '<p style="font-size:0.85rem;color:var(--txt-d);">录取'+(h.passedCount!=null?h.passedCount:'?')+'人，质量：'+(h.quality||'—')+'</p>'+
          '<p style="font-size:0.85rem;color:var(--txt-d);">状元：'+(_t3[0]||'—')+'，榜眼：'+(_t3[1]||'—')+'，探花：'+(_t3[2]||'—')+'</p>'+
          '</div>';
      });
      content+='</div>';
    }

    // 科举生态·特科 + 学派 (event-driven·只显示状态)
    var _enkeArr = ((typeof GM!=='undefined'&&GM&&GM._enkeHistory)||[]);
    var _wujuArr = ((typeof GM!=='undefined'&&GM&&GM._wujuHistory)||[]);
    var _tongziArr = ((typeof GM!=='undefined'&&GM&&GM._tongziHistory)||[]);
    var _enkeN = _enkeArr.length, _wujuN = _wujuArr.length, _tongziN = _tongziArr.length;
    var _schoolNet = (typeof GM!=='undefined'&&GM&&GM._schoolNetwork)||{};
    var _academies = _schoolNet.academies || _schoolNet.schools || [];
    var _lineages = _schoolNet.lineages || _schoolNet.parties || [];
    // 可点格 → toggle 对应明细 div(有记录才可点)
    var _kjTog=function(id){return 'onclick="var d=document.getElementById(\''+id+'\');if(d)d.style.display=(d.style.display===\'none\'?\'block\':\'none\');" style="cursor:pointer;" title="点看明细"';};
    content+='<div style="background:var(--bg-2);padding:0.9rem 1rem;border-radius:8px;margin-bottom:1rem;">'+
      '<h4 style="color:var(--gold);margin-bottom:0.6rem;">科举生态·特科与学派</h4>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem 1rem;font-size:0.88rem;">'+
      '<div '+(_enkeN?_kjTog('kj-enke-detail'):'')+'>📜 <b>恩科</b>·已开 '+_enkeN+' 次'+(_enkeN?' <span style="color:var(--txt-d);font-size:0.75rem;">▾</span>':'')+'</div>'+
      '<div '+(_wujuN?_kjTog('kj-wuju-detail'):'')+'>⚔️ <b>武举</b>·已开 '+_wujuN+' 次'+(_wujuN?' <span style="color:var(--txt-d);font-size:0.75rem;">▾</span>':'')+'</div>'+
      '<div '+(_tongziN?_kjTog('kj-tongzi-detail'):'')+'>🌱 <b>童子科</b>·已选 '+_tongziN+' 神童'+(_tongziN?' <span style="color:var(--txt-d);font-size:0.75rem;">▾</span>':'')+'</div>'+
      '<div>🏛️ <b>私学/书院</b>·'+(_academies.length||0)+' 处·'+(_lineages.length||0)+' 学派</div>'+
      '</div>'+
      '<div id="kj-enke-detail" style="display:none;margin-top:0.5rem;border-top:1px solid rgba(180,150,80,0.18);padding-top:0.3rem;"><div style="font-size:0.78rem;color:var(--gold);margin-bottom:0.2rem;">恩科开科明细</div>'+_kjHistRows(_enkeArr,'enke')+'</div>'+
      '<div id="kj-wuju-detail" style="display:none;margin-top:0.5rem;border-top:1px solid rgba(180,150,80,0.18);padding-top:0.3rem;"><div style="font-size:0.78rem;color:var(--gold);margin-bottom:0.2rem;">武举开科明细</div>'+_kjHistRows(_wujuArr,'wuju')+'</div>'+
      '<div id="kj-tongzi-detail" style="display:none;margin-top:0.5rem;border-top:1px solid rgba(180,150,80,0.18);padding-top:0.3rem;"><div style="font-size:0.78rem;color:var(--gold);margin-bottom:0.2rem;">童子科选童明细</div>'+_kjHistRows(_tongziArr,'tongzi')+'</div>'+
      '<p style="color:var(--txt-d);font-size:0.78rem;margin-top:0.5rem;">特科按朝廷事件自然 trigger (寿诞·大乱·瑞祥·战功 等)·学派由山长 NPC 自驱讲会·跨系统接口已 wired</p>'+
      '</div>';

    content+='<div style="text-align:center;">';

    // 如果正在筹办，禁用按钮
    if(GM.keju && GM.keju.preparingExam) {
      content+='<button class="bt bp" disabled style="opacity:0.5;cursor:not-allowed;">📋 正在筹办中...</button>'+
        '<p style="color:var(--txt-d);font-size:0.85rem;margin-top:0.5rem;">请等待当前科举筹办完成</p>';
    } else {
      content+='<button class="bt bp" onclick="proposeKejuPreparation()">📋 提议筹办科举</button>'+
        '<p style="color:var(--txt-d);font-size:0.85rem;margin-top:0.5rem;">科举筹办需要时间，具体进展由推演AI决定</p>';
      // Stage 2·Phase L·改革科举范式按钮 (默认显示·除非 P.conf.useNewKejuL===false 显式关闭)
      if ((!P.conf || P.conf.useNewKejuL !== false) && typeof window._kjpOpenReformProposal === 'function') {
        content+='<div style="margin-top:0.8rem;"><button class="bt" onclick="window._kjpOpenReformProposal()">⚖️ 改革科举范式</button>'+
          '<p style="color:var(--txt-d);font-size:0.8rem;margin-top:0.3rem;">改 paradigm 字段·走廷议议政·议毕 L7 apply (L1-L12 全功能)</p></div>';
      }
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
 * v7.1·B3·扩 topicType 参数·向后兼容·无参时 fallback kaike
 *
 * @param {string} topicType - 'kaike' (默认) / 'examiner_pick' / 'question_review' / 'scandal' / 'reform' / 'allocation' / 'school_ban' / 'eunuch_check' / 'activation'
 * @param {object} topicData - 议题数据·跟 callback 走
 */
function proposeKejuPreparation(topicType, topicData){
  // 关闭科举面板 (若打开)
  var panel=document.getElementById('keju-panel-modal');
  if(panel)panel.remove();

  // v7.1·B3·走 9 议题路由·无参时默 kaike (向后兼容现 button)
  openKeyiSession({
    topicType: topicType || 'kaike',
    topicData: topicData || {}
  });
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
    if (typeof AuthorityEngines !== 'undefined' && AuthorityEngines.adjustHuangquan) {
      AuthorityEngines.adjustHuangquan(delta > 0 ? 'personalRule' : 'memorialObjection', delta, reason || '\u79d1\u4e3e\u5236\u5ea6\u7275\u52a8\u7687\u6743', { source:'keju' });
      return;
    }
    if (GM.huangquan && typeof GM.huangquan === 'object') {
      var key = typeof GM.huangquan.index === 'number' ? 'index' : 'value';
      GM.huangquan[key] = Math.max(0, Math.min(100, (typeof GM.huangquan[key] === 'number' ? GM.huangquan[key] : 50) + delta));
      if (typeof addEB === 'function') addEB('\u7687\u6743', (delta > 0 ? '+' : '') + delta + '\u00B7' + (reason || ''));
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

/** 辅助·调整民心 */
function _adjustMinxin(delta, reason) {
  try {
    // P-DZ\u6C11\u5FC3\u00B7\u79D1\u4E3E\u6C11\u5FC3\u8D70 AuthorityEngines.adjustMinxin \u5E76 persist \u644A\u56DE\u53F6\u5B50\uFF08\u9632\u56DE\u5408\u672B aggregate \u62B9\uFF09\u00B7\u4FDD\u7559\u90B8\u62A5
    var _AEkj = (typeof AuthorityEngines !== 'undefined' && AuthorityEngines) || (typeof window !== 'undefined' && window.AuthorityEngines) || null;
    if (_AEkj && typeof _AEkj.adjustMinxin === 'function') {
      _AEkj.adjustMinxin('socialMobility', delta, reason, { persist: true });
      if (typeof addEB === 'function') addEB('\u6C11\u5FC3', (delta > 0 ? '+' : '') + delta + '\u00B7' + (reason || ''));
      return;
    }
    if (GM.minxin && typeof GM.minxin === 'object') {
      GM.minxin.trueIndex = Math.max(0, Math.min(100, (typeof GM.minxin.trueIndex === 'number' ? GM.minxin.trueIndex : 50) + delta));
      if (typeof addEB === 'function') addEB('\u6C11\u5FC3', (delta > 0 ? '+' : '') + delta + '\u00B7' + (reason || ''));
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

// ══════════════════════════════════════════════════════════════════
// v5·D1-D3·经费回落 + 中央扣款 + 阶段自动扣费
// ══════════════════════════════════════════════════════════════════

function _kejuWalkDivisions(nodes, visitor, ancestors) {
  ancestors = ancestors || [];
  for (var i = 0; i < (nodes || []).length; i++) {
    var n = nodes[i];
    if (!n) continue;
    if (visitor(n, ancestors) === false) return false;
    if (n.children && _kejuWalkDivisions(n.children, visitor, ancestors.concat([n])) === false) return false;
  }
  return true;
}

/** 找某节点的指定级别祖先（自身若匹配直接返回） */
function _kejuFindAncestorByLevel(node, level, hierarchy) {
  if (!node) return null;
  if ((node.level || '') === level) return node;
  // 暴力扫：找所有 level=level 的节点·判断是否为 node 的祖先
  var all = [];
  if (!hierarchy) hierarchy = GM.adminHierarchy;
  if (hierarchy && hierarchy.player) {
    _kejuWalkDivisions(hierarchy.player.divisions, function(n, ancestors) {
      all.push({ node: n, ancestors: ancestors.slice() });
    });
  }
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
  _kejuWalkDivisions(GM.adminHierarchy.player.divisions, function(n) {
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
  });
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
  } else if (typeof _ty2_openSetup === 'function') {
    _ty2_openSetup();
    setTimeout(function(){
      var topicEl = _$('ty2-topic');
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
  } else if (typeof _ty2_openSetup === 'function') {
    _ty2_openSetup();
    setTimeout(function(){
      var topicEl = _$('ty2-topic');
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

function _kejuHasChiefExaminerOffice(c) {
  if (!c || c.alive === false) return false;
  var title = String(c.officialTitle || c.office || c.postName || c.position || c.title || '').trim();
  if (!title) return false;
  if (c.spouse) return false;
  var roleText = String(c.role || '') + ' ' + title;
  if (/后|妃|嫔|贵人|太后|太妃|公主|郡主|太监|学生/.test(roleText)) return false;
  return true;
}

function _kejuIsEligibleChiefExaminer(c) {
  return !!(c && c.alive !== false && !c.isPlayer
    && (c.intelligence || 0) >= 60
    && _isPlayerFactionChar(c)
    && _kejuHasChiefExaminerOffice(c));
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
    '<input id="delegate-search" placeholder="\u641C\u7D22\u59D3\u540D/\u5B98\u804C" style="width:100%;padding:5px 8px;margin-bottom:0.5rem;background:var(--bg-3);border:1px solid var(--bdr);color:var(--txt);" oninput="_scheduleDelegateFilter(this.value)">'+
    '<div id="delegate-list" style="max-height:360px;overflow-y:auto;">';
  candidates.forEach(function(c){
    var lbl = _kejuClassifyDelegate(c);
    html += '<div class="delegate-row" data-name="'+escHtml(c.name)+'" style="padding:0.5rem 0.6rem;margin-bottom:3px;background:var(--bg-3);border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:8px;" onclick="_pickDianshiDelegate(\''+escHtml(c.name).replace(/\'/g,"\\'")+'\')">'+
      '<strong style="flex:1;">'+escHtml(c.name)+'</strong>'+
      '<span style="font-size:0.75rem;color:var(--txt-d);">'+escHtml(c.officialTitle||c.title||'')+'</span>'+
      '<span style="font-size:0.71rem;background:'+lbl.color+';color:#fff;padding:1px 4px;border-radius:2px;">'+lbl.label+'</span>'+
      '</div>';
  });
  html += '</div><div style="text-align:center;margin-top:0.6rem;"><button class="bt" onclick="this.closest(\'#dianshi-delegate-picker\').remove();">\u53D6\u6D88</button></div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

/** 分类代主身份·v7.1 D1 + D4 第 7 类 (司礼监·明清专有 gate)·6 身份 paradigm 100% 保留 (red line #6) */
function _kejuClassifyDelegate(c) {
  var t = c.officialTitle || c.title || '';
  var role = c.role || '';
  if (role === '太子' || t.indexOf('太子') >= 0) return { label:'\u592A\u5B50', color:'var(--gold)' };
  if (t.indexOf('首辅') >= 0) return { label:'\u9996\u8F85', color:'var(--celadon-400)' };
  if (t.indexOf('礼部尚书') >= 0) return { label:'\u793C\u90E8', color:'var(--celadon-400)' };
  if (c.familyTier === 'royal' || role.indexOf('王') >= 0) return { label:'\u5B97\u5BA4', color:'var(--amber-400)' };
  if ((c.party||'').indexOf('\u9609') >= 0 || role.indexOf('\u6743\u81E3') >= 0) return { label:'\u6743\u81E3', color:'var(--vermillion-400)' };
  if (/\u5C06\u519B|\u603B\u5175|\u5927\u5C06/.test(t)) return { label:'\u6B66\u5C06', color:'var(--red)' };
  // v7.1\u00B7D4 \u7B2C 7 \u7C7B\u00B7\u53F8\u793C\u76D1\u00B7\u660E\u6E05\u4E13\u6709 gate (\u6C49/\u5510/\u5B8B\u7B49\u573A\u666F fallback \u6587\u81E3)
  var __scn = (typeof P !== 'undefined' && P && P.scenarios)
    ? P.scenarios.find(function(s){ return s && s.id === GM.sid; }) : null;
  var __era = __scn ? (__scn.era || __scn.dynasty || '') : '';
  if ((__era === '\u660E' || __era === '\u6E05') && t.indexOf('\u53F8\u793C\u76D1') >= 0) {
    return { label:'\u53F8\u793C\u76D1', color:'var(--vermillion-300)', isEunuch: true };
  }
  return { label:'\u6587\u81E3', color:'var(--ink-300)' };
}

var _delegateFilterTimer = 0;
var _delegateFilterQuery = '';
function _scheduleDelegateFilter(query) {
  _delegateFilterQuery = query || '';
  if (_delegateFilterTimer) clearTimeout(_delegateFilterTimer);
  _delegateFilterTimer = setTimeout(function() {
    _delegateFilterTimer = 0;
    _filterDelegateList(_delegateFilterQuery);
  }, 80);
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
  // v7.1·D1·7 身份副作用 (6 原 + 第 7 类司礼监预留·red line #6 守)
  var lbl = exam.dianshiDelegate.classification;
  if (lbl === '太子') {
    // 太子代主·国本得固·皇威+8·event "储位+3"
    if (typeof _adjustHuangwei === 'function') _adjustHuangwei(+8, '太子代主·国本得固');
    if (typeof addEB === 'function') addEB('科举', '太子代主·国本得固·储位+3');
  } else if (lbl === '首辅') {
    // 首辅代主·皇威+5·若有党·该党 tension+2
    if (typeof _adjustHuangwei === 'function') _adjustHuangwei(+5, '首辅代主');
    if (c.party && typeof _kjUpdateFactionTension === 'function') {
      _kjUpdateFactionTension({ party: c.party, delta: +2, reason: '首辅党代主·权重' });
    }
  } else if (lbl === '礼部') {
    // 礼部代主·礼制本职·礼部/士林满意+5
    if (typeof _bumpKejuSatisfaction === 'function') _bumpKejuSatisfaction('礼制', +5, '礼部代主·本职');
  } else if (lbl === '宗室') {
    // 宗室满意+10·100% 保留 v5 paradigm
    var zs = (GM.classes||[]).find(function(cl){ return cl.name === '宗室'; });
    if (zs) {
      if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function') {
        TM.ClassEngine.gateSatisfaction(GM, zs, 10, { turn: GM.turn, source: 'keju', reason: '宗室代主殿试' });
      } else {
        zs.satisfaction = Math.min(100, (zs.satisfaction||50) + 10);
      }
    }
  } else if (lbl === '权臣') {
    // 权臣代主·皇威-3·若有党·tension+5
    if (typeof _adjustHuangwei === 'function') _adjustHuangwei(-3, '代主权臣·私相授受');
    if (c.party && typeof _kjUpdateFactionTension === 'function') {
      _kjUpdateFactionTension({ party: c.party, delta: +5, reason: '权臣代主·政争升级' });
    }
  } else if (lbl === '武将') {
    // 武将代主·皇威-2 (D1 加强)·民心-2·礼部抗议
    if (typeof _adjustHuangwei === 'function') _adjustHuangwei(-2, '武将代主');
    _adjustMinxin(-2, '武将代主殾试·礼部抗议');
    if (typeof addEB === 'function') addEB('科举', '礼部大臣抗议武将主殾试');
  } else if (lbl === '司礼监') {
    // v7.1·D4 第 7 类·司礼监代主·明清专有·宦党擅权
    // TODO·I1 GM._eunuchInterference 实现后接·宦党 prestige+10·反宦联盟 enmity+15
    if (typeof _adjustHuangwei === 'function') _adjustHuangwei(-5, '司礼监代主·宦党擅权');
    if (typeof addEB === 'function') addEB('科举', '司礼监代主·宦党 prestige+10·反宦联盟 enmity+15 (待 I1 接)');
  }
  // v7.1·D1·跟 C1 联动·若代主 = 主考·tension+3·议政忌惮
  if (exam.chiefExaminer && name === exam.chiefExaminer && c.party
      && typeof _kjUpdateFactionTension === 'function') {
    _kjUpdateFactionTension({ party: c.party, delta: +3, reason: '代主=主考·权位重叠' });
    if (typeof toast === 'function') toast('⚠ 代主即主考·议政忌惮');
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

/**
 * v7.1·D1·helper·礼部/士林 fallback satisfaction bump
 *   prefer === '礼制' → 试 ['礼部','士林','文士'] 命中即停
 *   其他 prefer → 当 class name 直查
 */
function _bumpKejuSatisfaction(prefer, delta, reason) {
  if (!GM.classes || !Array.isArray(GM.classes)) return;
  var keywords = (prefer === '礼制') ? ['礼部', '士林', '文士'] : [prefer];
  for (var i = 0; i < GM.classes.length; i++) {
    var nm = GM.classes[i].name || '';
    for (var j = 0; j < keywords.length; j++) {
      if (nm.indexOf(keywords[j]) >= 0) {
        if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function') {
          TM.ClassEngine.gateSatisfaction(GM, GM.classes[i], delta, { turn: GM.turn, source: 'keju', reason: reason || '科举' });
        } else {
          var cur = GM.classes[i].satisfaction || 50;
          GM.classes[i].satisfaction = Math.max(0, Math.min(100, cur + delta));
        }
        if (typeof addEB === 'function') {
          var sign = delta >= 0 ? '+' : '';
          addEB('阶层', nm + sign + delta + '·' + (reason || ''));
        }
        return;
      }
    }
  }
}

/** 考官自动选（玩家未选时由 AI 代选·皇威已在 B2 扣分） */
function _kejuAutoPickExaminer(exam) {
  if (!exam) return;
  var cands = (GM.chars || []).filter(function(c){
    return _kejuIsEligibleChiefExaminer(c);
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
  // R112·advanceKejuByDays 定义在 tm-chaoyi.js·由后者自行暴露到 window
  window.openDianshiDelegatePicker = openDianshiDelegatePicker;
  window._pickDianshiDelegate = _pickDianshiDelegate;
  window._scheduleDelegateFilter = _scheduleDelegateFilter;
  window._filterDelegateList = _filterDelegateList;
  // v7.1·D1·暴露 classify / bumpSatisfaction·供 smoke 测试 + 其他模块
  window._kejuClassifyDelegate = _kejuClassifyDelegate;
  window._bumpKejuSatisfaction = _bumpKejuSatisfaction;
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
    // C4\u00B7toast/EB \u6587\u6848\u00B7\u965B\u4E0B\u6177\u6168\u00B7\u5185\u5E11\u8865\u8D34 X \u4E24\u00B7\u58EB\u6797\u611F\u5FF5 (paradigm 0 \u6539\u00B7huangwei+2 \u4E0D\u52A8)
    if (typeof addEB === 'function') addEB('\u79D1\u4E3E\u7ECF\u8D39', '\u965B\u4E0B\u6177\u6168\u00B7\u5185\u5E11\u8865\u8D34 ' + amount + ' \u4E24\u00B7\u58EB\u6797\u611F\u5FF5\u00B7' + stage);
    if (typeof toast === 'function') toast('\uD83D\uDCDC \u965B\u4E0B\u6177\u6168\u00B7\u5185\u5E11\u8865\u8D34 ' + amount + ' \u4E24\u00B7\u58EB\u6797\u611F\u5FF5', 'info');
    _adjustHuangwei(2, '\u53D1\u5185\u5E11\u6D4E\u79D1\u4E3E\u00B7\u58EB\u6797\u611F\u5FF5');
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
 * v7.1·Slice A1·thin wrapper 转发到 _kjActivateRun (tm-keju-activation.js)·5 档 sc0
 */
async function requestEnableKeju(){
  if (typeof window !== 'undefined' && typeof window._kjActivateRun === 'function') {
    return window._kjActivateRun({ mode: 'enable' });
  }
  // fallback·activation 模块未载入 (不应发生)·走旧二元
  console.warn('[科举] _kjActivateRun 未载·fallback 旧二元');
  if(!P.ai.key){
    P.keju.enabled=true;
    P.keju.examIntervalNote='三年一科';
    toast('✅ 科举制度已启用');
    var panel=document.getElementById('keju-panel-modal'); if(panel) panel.remove();
    return;
  }
  P.keju.enabled=true;
  P.keju.examIntervalNote='三年一科';
  toast('✅ 科举制度已启用 (legacy fallback)');
  var panel=document.getElementById('keju-panel-modal'); if(panel) panel.remove();
}

/**
 * 发起科举改革（隋唐前朝代）
 * v7.1·Slice A1·thin wrapper 转发到 _kjActivateRun (tm-keju-activation.js)·5 档 sc0
 */
async function startKejuReform(){
  if (typeof window !== 'undefined' && typeof window._kjActivateRun === 'function') {
    return window._kjActivateRun({ mode: 'reform' });
  }
  // fallback·activation 模块未载入
  console.warn('[科举] _kjActivateRun 未载·fallback 旧二元');
  if(!P.ai.key){
    P.keju.enabled=true;
    P.keju.reformed=true;
    P.keju.examIntervalNote='三年一科';
    toast('✅ 科举改革成功 (legacy fallback)');
    var panel=document.getElementById('keju-panel-modal'); if(panel) panel.remove();
    return;
  }
  P.keju.enabled=true;
  P.keju.reformed=true;
  P.keju.examIntervalNote='三年一科';
  toast('✅ 科举改革成功 (legacy fallback)');
  var panel=document.getElementById('keju-panel-modal'); if(panel) panel.remove();
}
