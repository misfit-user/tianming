// Monetary recovery only selects a proven total. The original edict engine owns writes.
(function(root){
  'use strict';var TM=root.TM=root.TM||{},pending=new WeakMap(),flights=new WeakMap();if(TM.RecoveryEdict)return;
  var numberChars='0-9零〇一二两三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖拾佰仟萬億';
  function error(code,message){return TM.EmergencyRecovery.fault(code,message);}
  function moneyText(g){return JSON.stringify(g.currency||null);}
  function quote(text,a){if(!a||!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<0||a.end<=a.start||a.end>text.length||text.slice(a.start,a.end)!==a.literal)throw error('RECOVERY_SOURCE_MISMATCH','数值必须逐字引用原诏令');return a.literal;}
  function classifiedTotals(text,role){
    var issuance=role==='issue_paper',action=issuance?/发行|增发|印发|开印|印制|颁行/g:/流入|输入|纳银|引入|增入|净入|进银/g;
    if(issuance?!/宝钞|交子|会子|官票|纸币|纸钞/.test(text):!/海外|海商|开海|通商/.test(text))return [];
    var acts=Array.from(text.matchAll(action));if(acts.length!==1||/或|至少|至多|最多|不超过|不少于|大约|约计|左右|上下|若干|如果|倘若|若|一旦|待核准|获准后/.test(text))return [];
    if(/(?:尚未|并未|没有|不得|不可|不许|不再|暂停|禁止|暂缓|取消|勿|毋|未|不|拟|计划|如果|倘若|待)[^，,。；;]{0,8}(?:发行|增发|印发|开印|印制|颁行|流入|输入|纳银|引入)/.test(text))return [];
    var ranges=[],rx=new RegExp('['+numberChars+']+(?:\\.\\d+)?','g'),m;
    while((m=rx.exec(text))){
      var literal=m[0],end=m.index+literal.length,tail=text.slice(end),unitMatch=tail.match(/^\s*(贯|两|文|张|缗)/);
      if(!unitMatch&&literal.length>1&&literal.endsWith('两')){literal=literal.slice(0,-1);end--;tail=text.slice(end);unitMatch=['两','两'];}
      if(!unitMatch)continue;
      var a=text.slice(0,m.index),prefix=a.split(/[，,。；;！？!?\n]/).pop(),parts=a.split(/[，,。；;！？!?\n]/),previous=parts.length>1?parts[parts.length-2]:'';
      var suffix=tail.split(/[，,。；;！？!?\n]/)[0];
      if(/准备金|储备|预备|备用|兑付|兑换|面额|每贯|每张|每文/.test(prefix)||/作为准备|作为储备/.test(suffix))continue;
      if(/至少|至多|最多|不超过|不少于|约|左右|上下|若干|至|或/.test(prefix+suffix)||/[-−负]\s*$/.test(prefix))continue;
      action.lastIndex=0;var direct=action.test(prefix);action.lastIndex=0;
      var continuation=/^\s*(?:发行总额|流入总额|总额|额度|金额|规模|数额|总量|总计|共计|核定为|定为|确定为|计为)/.test(prefix)&&action.test(previous);action.lastIndex=0;
      if(!direct&&!continuation)continue;
      var parsed=root.TMNumberParser&&root.TMNumberParser.parseNumber(literal,{max:1000000000000});
      if(parsed&&parsed.ok)ranges.push({start:m.index,end:end,literal:literal,amount:parsed.value,unit:unitMatch[1]});
    }
    return ranges;
  }
  function certified(text,plan){
    if(!plan||!['issue_paper','overseas_silver_flow'].includes(plan.role))throw error('RECOVERY_EDICT_ROLE','未提供可核验的数量用途');
    quote(text,plan.amount);var totals=classifiedTotals(text,plan.role);
    if(totals.length!==1||totals[0].start!==plan.amount.start||totals[0].end!==plan.amount.end)throw error('RECOVERY_EDICT_AMBIGUOUS','原文不能证明唯一执行总额，不猜数量');
    var row=totals[0];if(plan.role==='overseas_silver_flow'&&row.unit!=='两')throw error('RECOVERY_EDICT_UNIT','银流量必须明确以两计量，不能猜兑换率');
    if(plan.role==='issue_paper'&&row.unit!=='贯')throw error('RECOVERY_UNIT_UNCONFIRMED','当前发行恢复尚无张、文等单位的面额或换算凭据，不能只复制数额后自动落账');
    return {role:plan.role,amount:row.amount,unit:row.unit,source:{start:row.start,end:row.end,literal:row.literal}};
  }
  function register(text,result){
    if(!root.GM||!result||result.ok||!result.amountError||!TM.EmergencyRecovery||TM.EmergencyRecovery.config().mode==='off')return false;
    if(!result.classification||result.classification.typeKey!=='currency_reform')return false;
    var g=root.GM,rows=pending.get(g);if(!rows){rows=new Map();pending.set(g,rows);}
    var key=JSON.stringify([g._campaignId,g._timelineId,g.turn,text]);
    if(!rows.has(key))rows.set(key,{key:key,text:String(text),turn:g.turn,result:result,phase:'pending'});return true;
  }
  async function performFlush(ctx){
    var g=root.GM,rows=g&&pending.get(g),receipts=[];if(!rows||!TM.EmergencyRecovery||TM.EmergencyRecovery.config().mode==='off')return receipts;
    for(var row of rows.values()){
      if(row.turn!==g.turn||row.phase!=='pending')continue;
      if(!g._endTurnCommitPending)throw error('RECOVERY_NO_TRANSACTION','诏令恢复只能在可回滚的回合提交边界执行');
      row.phase='investigating';var before=moneyText(g),player=root.P,gen=root._tmLoadGen;
      var guard=function(){if(pending.get(g)!==rows||!g._endTurnCommitPending||root.GM!==g||root.P!==player||root._tmLoadGen!==gen||g.turn!==row.turn||JSON.stringify([g._campaignId,g._timelineId,g.turn,row.text])!==row.key||ctx&&ctx.signal&&ctx.signal.aborted||TM.EmergencyRecovery.config().mode==='off'||moneyText(g)!==before)throw error('AI_STALE_WORLD','恢复依据或账本已改变，未重复执行');};
      var adapter={contract:{kind:'edict-quantity',proposal:'{role:"issue_paper|overseas_silver_flow",amount:{start:原文UTF16起点,end:终点,literal:"原数词"}}',rules:'只恢复原文唯一数量用途；纸币自动恢复须明确以贯计量，银流须以两计量，不猜面额或兑换率；原诏令全部保留，准备金或汇率不是发行量。无法证实时必须 needsPlayer。预检不执行发行。'},
        preview:function(plan){try{guard();return {ok:true,value:certified(row.text,plan),verification:'原文字面数额、用途和唯一性已核对；尚未修改钱粮'};}catch(e){return {ok:false,code:e.code,message:e.message};}}};
      var recovered=await TM.EmergencyRecovery.recover({id:'edict_quantity',kind:'edict-quantity',raw:row.text,error:{code:'TM_EDICT_AMOUNT_INVALID'},normalExhausted:true,normalAttempts:1,safeBoundary:true,adapter:adapter,signal:ctx&&ctx.signal,guard:guard});
      if(!recovered.ok){row.phase='deferred';if(recovered.error&&/^(AI_ABORTED|AI_STALE_WORLD|AI_REQUEST_DEADLINE)$/.test(recovered.error.code))throw recovered.error;receipts.push({ok:false,applied:false,reason:recovered.reason||'needs-player'});continue;}
      guard();var certificate=recovered.value,fp=await TM.AgentKernel.fingerprintScenario({text:row.text,turn:g.turn,campaign:g._campaignId,timeline:g._timelineId});guard();
      if(!fp)throw error('RECOVERY_FINGERPRINT','无法确认幂等标识，未执行');
      var id='er-'+fp.hash,params={amount:certificate.amount};
      var currency=g.currency;if(!currency)throw error('RECOVERY_EDICT_ENGINE','货币账本未初始化，不能凭空建立执行依据');
      var oldIssues=currency.paper&&currency.paper.issuances,oldSilver=currency.coins&&currency.coins.silver&&currency.coins.silver.stock;
      if(certificate.role==='issue_paper'){
        if(!Array.isArray(oldIssues)||!Array.isArray(currency.paper.activeIssuances))throw error('RECOVERY_EDICT_ENGINE','纸币账本结构未就绪');
        var prior=oldIssues.filter(function(p){return p&&p.id===id;});
        if(prior.length){if(prior.length!==1||prior[0].originalAmount!==certificate.amount)throw error('RECOVERY_DUPLICATE_CONFLICT','既有发行回执冲突');row.phase='applied';receipts.push({ok:true,id:id,applied:true,duplicate:true,amount:certificate.amount,role:certificate.role});continue;}
        params.paperId=id;
      }else if(!Number.isFinite(oldSilver))throw error('RECOVERY_EDICT_ENGINE','银库存不是可核验数值');
      row.phase='applying';var beforeCount=oldIssues&&oldIssues.length;
      var applied=root.EdictParser.tryExecute(row.text,params,{source:'emergency-recovery',recoveryId:id});
      if(root.GM!==g||root.P!==player||root._tmLoadGen!==gen)throw error('AI_STALE_WORLD','执行时世界已切换');
      var verified=applied&&applied.ok===true;
      if(certificate.role==='issue_paper')verified=verified&&oldIssues.length===beforeCount+1&&oldIssues.filter(function(p){return p.id===id&&p.originalAmount===certificate.amount;}).length===1;
      else verified=verified&&g.currency.coins.silver.stock===oldSilver+certificate.amount;
      if(!verified)throw error('RECOVERY_EDICT_APPLY_FAILED','数量恢复候选未取得真实落账回执；由原回合事务回滚，不重放');
      row.phase='applied';row.receipt={ok:true,id:id,applied:true,persisted:false,amount:certificate.amount,unit:certificate.unit,role:certificate.role,source:certificate.source};receipts.push(row.receipt);
    }
    return receipts;
  }
  function flush(ctx){
    var g=root.GM;if(!g)return Promise.resolve([]);if(flights.has(g))return flights.get(g);
    var promise=Promise.resolve().then(function(){return performFlush(ctx);});flights.set(g,promise);
    return promise.finally(function(){if(flights.get(g)===promise)flights.delete(g);});
  }
  TM.RecoveryEdict={register:register,flush:flush,certified:certified,discard:function(g){if(g){pending.delete(g);flights.delete(g);}}};
})(typeof window!=='undefined'?window:globalThis);
