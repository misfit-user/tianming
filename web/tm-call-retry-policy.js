// Pure per-call retry policy. Never repeats a world mutation or a tool invocation.
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  if (TM.CallRetryPolicy) return;
  var labels = {
    sc0:'统筹思考',sc1q:'问对与朝议承诺',sc05:'深度回顾',sc1:'主推演',sc1_rescue:'主推演结构救援',sc1b:'文事与鸿雁',sc1c:'势力互动',sc1d:'多系统推演',
    sc15:'人物深度推演',sc15n:'人物分层推演',sc_memwrite:'人物记忆写回',sc16:'势力推演',sc17:'党派推演',sc18:'军事推演',sc_audit:'因果审读',sc19:'经济建议',
    sc2:'后人戏说',sc25:'战术记忆',sc25c:'综合记忆回写',sc27:'叙事审读',sc07:'人物认知',sc28:'世界快照',sc_consolidate:'记忆固化',sc2_outline:'叙事提纲',sc27_review:'提纲审读',sc2_prose:'叙事成文',
    compress_ai_memory:'长期记忆整合',compress_foreshadows:'伏笔整合',compress_conversation:'对话整合',history_check:'史实核对',
    agent_turn:'Agent 每轮模型请求',agent_quality_review:'Agent 叙事审读',agent_quality_fix:'Agent 叙事修订',agent_anomaly_scan:'Agent 非常规举措识别'
  };
  var seen = new Set();
  function eligible(id) { return typeof id === 'string' && /^(?:sc[0-9_]|SC_RECALL|compress_|history_check|agent_turn|agent_quality_|agent_anomaly_)/.test(id) && /^[\w:.-]{1,100}$/.test(id); }
  function count(value) {
    if (value == null || value === '') return null;
    if (!/^(?:0|[1-9]\d*)$/.test(String(value)) || Number(value)>20) { var e=new Error('重试次数须为 0 至 20 的整数；留空表示跟随默认');e.code='AI_RETRY_CONFIG';e.status=400;throw e; }
    return Number(value);
  }
  function config() { return root.P && root.P.conf && root.P.conf.aiCallRetryOverrides || {}; }
  function selected(id) {
    if (!eligible(id)) return null;
    var cfg=config(), base=id.split(':')[0];seen.add(id);
    for (var keys=[id,base,'*'],i=0;i<keys.length;i++) { if(Object.prototype.hasOwnProperty.call(cfg,keys[i])) { var n=count(cfg[keys[i]]);if(n!=null)return n; } }
    return null;
  }
  function options(opts) {
    var out=Object.assign({},opts||{});if(out._turnRetriesResolved)return out;
    var n=selected(out.id);out._turnRetriesResolved=true;
    if(n!=null){out.maxRetries=n;out._configuredRetries=true;out._turnRetryCount=n;}
    return out;
  }
  function catalog() {
    var ids=new Set(Object.keys(labels));seen.forEach(function(id){if(!/^agent_turn:r\d+$/.test(id)&&!/:repair$/.test(id))ids.add(id);});
    Object.keys(config()).forEach(function(id){if(eligible(id))ids.add(id);});
    var calls=TM.Endturn && TM.Endturn.AI && TM.Endturn.AI.subcalls;
    if(calls && calls.listCallPolicies)calls.listCallPolicies().forEach(function(row){ids.add(row.id);});
    return Array.from(ids,function(id){return{id:id,label:labels[id]||labels[id.split(':')[0]]||id};});
  }
  function validate(values) {
    var out={};Object.keys(values||{}).forEach(function(id){if(id!=='*'&&!eligible(id))throw new Error('未知调用设置：'+id);var n=count(values[id]);if(n!=null)out[id]=n;});return out;
  }
  function retryable(e) {
    if(!e||e._tmNativeTransport||e.mainWriteback||e.writebackFailures)return false;
    if(/ABORT|STALE|DEADLINE|BUDGET|CONFIG|context_|writeback|narrative/.test(e.code||'')||e.name==='AbortError')return false;
    return Number(e.status)===429 || Number(e.status)>=500 || (e.code==='AI_TIMEOUT' || e.code==='tool-timeout') || (e instanceof TypeError || e.name==='TypeError') && /fetch|network/i.test(e.message||'');
  }
  TM.CallRetryPolicy={options:options,selected:selected,count:count,catalog:catalog,validate:validate,retryable:retryable,maxRetries:20};
})(typeof window!=='undefined'?window:globalThis);
