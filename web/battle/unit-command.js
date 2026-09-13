/* Tactical commander identity and derived abilities. Pure data; never reads/writes the strategic save. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TMBattleCommand=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const stat=(g,key,fallback)=>g&&Number.isFinite(Number(g[key]))&&g[key]!==null&&g[key]!==''?Math.max(0,Math.min(100,Number(g[key]))):fallback;
  function identity(g,u){return g.characterId?'id:'+g.characterId:u.commandKey||'name:'+g.n;}
  function named(g){return g&&g.available!==false&&g.role!=='deputy'&&g.n&&(!!g.characterId||!/^(裨将|军官|无名|敌帅|主将|将领|待任|未任命)$/.test(g.n));}
  function candidates(units,side){
    const groups=new Map(),emperors=new Set(units.filter(u=>u.side===side&&u.emperor).map(u=>identity(u.commandGen||u.gen||{},u)));
    for(const u of units){if(u.side!==side||u.emperor||u._hero)continue;const g=u.commandGen||u.gen;if(!named(g))continue;const key=identity(g,u);if(emperors.has(key))continue;
      if(!groups.has(key))groups.set(key,{src:u,gen:g,key,cohorts:[],armyIds:[]});const c=groups.get(key);c.cohorts.push(u);if(u.parentArmyId!=null&&!c.armyIds.includes(u.parentArmyId))c.armyIds.push(u.parentArmyId);if(u._marshal)c.src=u;
    }
    return [...groups.values()].sort((a,b)=>Number(!!b.src._marshal)-Number(!!a.src._marshal)||stat(b.gen,'mil',62)-stat(a.gen,'mil',62));
  }
  function skill(u){
    const g=u.gen||{},valor=stat(g,'valor',60),mil=stat(g,'mil',62),intel=stat(g,'int',55),sub=u.sub;
    if(u.emperor)return'duzhan';
    if(sub==='horse')return'huima';if(u.type==='art')return'cuifeng';
    if(['musket','crossbow','bow'].includes(sub))return'huogong';
    if(intel>=82&&intel>=valor+4&&intel>=mil)return'zhenfu';
    if(sub==='spear'||sub==='halberd')return valor>=90?'sizhan':valor>=86?'xianzhen':'juma';
    if(u.type==='cav')return valor>=88?'hengsao':'xianzhen';
    return mil>=80?'tiebi':valor>=82?'xianzhen':'tiebi';
  }
  function snapshot(u){const commander=(u._hero||u.emperor)&&named(u.gen);return{id:u.id,_srcId:u._srcId,parentArmyId:u._hero?null:(u.parentArmyId??null),side:u.side,genName:commander?u.gen.n:null,characterId:commander?u.gen.characterId||'':'',commandArmyIds:u.commandArmyIds||(u.parentArmyId!=null?[u.parentArmyId]:[]),emperor:!!u.emperor};}
  function fates(reg,byid,captured){return reg.filter(r=>r.genName).map(r=>{const u=byid[r.id];return{id:r._srcId??r.id,name:r.genName,characterId:r.characterId||'',parentArmyId:r.commandArmyIds&&r.commandArmyIds[0],armyIds:r.commandArmyIds||[],side:r.side,fate:r.emperor&&captured?'captured':!u?'killed':u._genFate||(u._genDead?'wounded':u.state==='rout'?'fled':'safe')};});}
  function description(g){if(!g)return'未提供将领资料';const labels={valor:'武勇',military:'军事',intelligence:'智谋'},defaults=(g.defaultStats||[]).map(k=>labels[k]||k);return(g.n||'裨将')+' · 武勇'+stat(g,'valor',60)+' / 军事'+stat(g,'mil',62)+' / 智谋'+stat(g,'int',55)+(defaults.length?'（'+defaults.join('、')+'缺资料，使用默认）':g.recognized?'（已匹配人物）':'');}
  return{stat,identity,named,candidates,skill,snapshot,fates,description};
});
