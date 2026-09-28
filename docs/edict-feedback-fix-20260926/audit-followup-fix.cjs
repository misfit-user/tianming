'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-endturn-ai-helpers.js',s=>{
 const a=s.indexOf('function buildEdictEfficacyFollowUp()');s=s.slice(0,a)+s.slice(a).replace(/_edictAuditReport/g,'GM._edictEfficacyReport');
 s=R(s,'  var _auditG = GM, _auditTurn = GM.turn-1;',"  var _auditG = GM, _auditTurn = GM.turn-1;\n  var _auditDate = typeof getTSText==='function' ? getTSText(_auditTurn) : GM._gameDate || '';");
 s=R(s,"      turn: _auditTurn, date: GM._gameDate || '',",'      turn: _auditTurn, date: _auditDate,');
 return s;
});
