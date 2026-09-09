// @ts-check
// Retired register: only a compatibility no-op and old trial-data warning remain.
(function(global){
  'use strict';
  var TM=global.TM=global.TM||{};
  function el(tag,text,style){var n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(style)n.style.cssText=style;return n;}
  // Kept only so an older cached caller cannot recreate the retired card or throw.
  function mountToolbar() {}
  function mountDetail(panel,id){
    var issue=(global.GM&&global.GM.currentIssues||[]).find(function(i){return i&&i.id===id;});
    if(!issue||!issue.relief||issue.relief.version!==1)return;
    var message=el('p','旧版独立试验案，仅保留历史数据；本页不再提供独立立案、拨款或撤止。请先核对原流水，勿重复支付。','padding:1rem;color:#e0a87f;line-height:1.8;');
    message.dataset.reliefLegacy='true';panel.lastElementChild.prepend(message);
  }
  TM.ReliefGovernanceUI={mountToolbar:mountToolbar,mountDetail:mountDetail};
})(typeof window!=='undefined'?window:globalThis);
