import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,'  function current(s) {','  function generation() { return root._tmLoadGen || 0; }\n  function current(s) {');
  s=s.replaceAll('root._tmLoadGen ===','generation() ===');
  s=s.replaceAll('root._tmLoadGen !==','generation() !==');
  s=s.replaceAll('=== root._tmLoadGen','=== generation()');
  s=s.replaceAll('generation: root._tmLoadGen','generation: generation()');
  return r(s,"world: [root.GM._campaignId, root.GM._timelineId].join('|'), at: Date.now(), state: 'running',","world: [root.GM._campaignId, root.GM._timelineId].join('|'), at: reuse ? previous.at : Date.now(), state: 'running',");
});
