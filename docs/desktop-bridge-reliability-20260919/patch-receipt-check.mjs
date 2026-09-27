import {edit} from './patch-utils.mjs';
edit('web/tm-endturn-reliability.js',(s,r)=>{
  s=r(s,'      var key;',"      var key, expected = {};\n      if (payload) ['transactionId','campaignId','timelineId','turn','stateChecksum'].forEach(function(k) { expected[k] = payload[k]; });");
  return r(s,"        done = true; cleanup(); bridgeRecord(method, e ? 'failed' : 'responded', e, started); requestEnd(ticket, e);",`        if (!e && value && value.success === true && method !== 'listSaveTimelineRefs') {
          var mismatch = Object.keys(expected).some(function(k) { return value[k] != null && String(value[k]) !== String(expected[k]); });
          if (mismatch) e = bridgeError('TURN_BRIDGE_IDENTITY', '桌面分卷回执身份不匹配，保留恢复信息', true);
        }
        done = true; cleanup(); bridgeRecord(method, e ? 'failed' : 'responded', e, started);
        requestEnd(ticket, e || (value && value.success === false ? error('TURN_BRIDGE_REJECTED', '桌面返回失败') : null));`);
});
