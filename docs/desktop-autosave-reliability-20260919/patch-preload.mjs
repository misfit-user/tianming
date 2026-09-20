import {edit} from './patch-utils.mjs';
edit('preload-impl.js',(s,r)=>{
  s=r(s,"let _autoSaveSessionToken = '';","let _autoSaveSessionToken = '';\nlet _autoSaveSessionRevision = 0;");
  s=r(s,"function _invokeAutoSave(data) {","function _invokeAutoSave(data) {\n  const requestToken = _autoSaveSessionToken, requestRevision = _autoSaveSessionRevision;");
  s=r(s,"    sessionToken: _autoSaveSessionToken,","    sessionToken: requestToken,");
  s=r(s,"    if (result && result.sessionToken) _autoSaveSessionToken = String(result.sessionToken);",`    // Only the current request may confirm its existing session; late replies never rotate it.
    if (requestRevision === _autoSaveSessionRevision && requestToken === _autoSaveSessionToken
        && result && result.success === true && result.sessionToken && String(result.sessionToken) !== requestToken) {
      return Object.assign({}, result, { success: false, stale: true, error: '自动存档成功回执的会话不匹配，未采用该回执' });
    }`);
  return r(s,"    if (result && result.success && result.token) _autoSaveSessionToken = String(result.token);","    if (result && result.success && result.token) { _autoSaveSessionRevision++; _autoSaveSessionToken = String(result.token); }");
});
