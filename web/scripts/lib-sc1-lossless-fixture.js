'use strict';
function userMessage(){
 const world={records:Array.from({length:80},(_,i)=>({id:'entity-'+i,fact:'complete original fact '+i,order:'do not alter actor '+i})),required_actions:['preserve all actors','preserve all amounts'],memory:{promise:'keep the exact promise'}};
 const json=JSON.stringify(world,null,4).replace(/\n/g,'\n'+' '.repeat(96));
 return 'PLAYER ORDER: preserve this entire instruction.\n```json\n'+json+'\n```\n=== sc1q 硬性要求 ===\n5 required actions must all be applied.\n=== 非常规举措 ===\nretain causal constraints.\n=== 输出格式强约束 (FINAL RULE·不可违反) === YOU MUST RETURN JSON ONLY.';
}
function jsonBlock(text){return text.match(/```json\n([\s\S]*?)\n```/)[1];}
module.exports={userMessage,jsonBlock};
