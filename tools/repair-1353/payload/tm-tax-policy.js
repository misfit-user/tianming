/* Tax directives change assessment rules, never treasury stock. */
(function(root){'use strict';
var TM=root.TM=root.TM||{};
var arr=x=>Array.isArray(x)?x:[];
var own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
function fail(code,reason){return {ok:false,applied:false,code:code,reason:reason};}
function number(s){
 if(typeof s==='number')return Number.isFinite(s)?s:NaN;
 s=String(s).trim();if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);
 var np=root.TMNumberParser;
 if(np&&np.parseNumber){var p=np.parseNumber(s,{max:100000});if(p.ok)return p.value;}
 var d={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9},v=0,n=0;
 for(var c of s){if(c in d)n=d[c];else if(c==='十'){v+=(n||1)*10;n=0;}
 else if(c==='百'){v+=(n||1)*100;n=0;}else return NaN;}return v+n;
}
function turnDays(g){
 var t=g.time||{},p=root.P||{};
 var sc=typeof root.findScenarioById==='function'?root.findScenarioById(g.sid):null;
 return Number(t.daysPerTurn||g.daysPerTurn||(sc&&sc.time&&sc.time.daysPerTurn)||
 (sc&&sc.gameSettings&&sc.gameSettings.daysPerTurn)||(p.time&&p.time.daysPerTurn))||30;
}
function now(g){
 if(g===root.GM&&typeof root.getCurrentGameDay==='function'){
  var n=root.getCurrentGameDay();if(Number.isFinite(n))return n;
 }return Math.max(0,(Number(g.turn)||0)-1)*turnDays(g);
}
function player(g){
 var p=g.playerInfo||(root.P&&root.P.playerInfo)||{};
 var key=(g.startContext&&g.startContext.playerFactionId)||p.factionId||p.factionName;
 var pc=arr(g.chars).find(c=>c&&c.isPlayer);if(!key&&pc)key=pc.factionId||pc.faction;
 var f=arr(g.facs).find(f=>f&&(f.id===key||f.name===key));
 return f?{id:f.id||f.name,name:f.name||f.id}:{id:key||'',name:key||''};
}
function same(k,f){return !!k&&(k===f.id||k===f.name||k==='player');}
function catalog(g){
 var all=[],seen=new Set(),fac=player(g),mapped=new Map();
 var regions=arr((g.mapData||g.map||{}).regions);
 regions.forEach(r=>{
  var binding=r.adminBinding&&typeof r.adminBinding==='object'?(r.adminBinding.id||r.adminBinding.divisionId):r.adminBinding;
  [r.id,r.mapRegionId,binding].concat(arr(r.accountingLeafIds)).filter(Boolean).forEach(id=>{
   if(!mapped.has(id))mapped.set(id,[]);mapped.get(id).push(r);
  });
 });
 function visit(n,parent,k){
  if(!n||seen.has(n))return;seen.add(n);var id=n.id||n.code||n.name,children=[];
  ['divisions','children','subs','prefectures','counties','districts'].forEach(k=>children.push(...arr(n[k])));
  var match=mapped.get(id)||mapped.get(n.mapRegionId)||[],keys=[id,n.mapRegionId].filter(Boolean);
  match.forEach(r=>keys.push(r.id));
  var allowed=match.length?match.some(r=>same(own(r,'taxAuthorityFactionId')?r.taxAuthorityFactionId:(r.currentOwner||r.owner||r.factionId),fac)):same(k,fac);
  all.push({node:n,id:id,name:n.name||id,parent:parent,leaf:!children.length,keys:Array.from(new Set(keys)),allowed:allowed});
  children.forEach(c=>visit(c,id,k));
 }
 var h=g.adminHierarchy;
 if(Array.isArray(h))h.forEach(n=>visit(n,null,n.factionId||n.owner||fac.id));
 else Object.keys(h||{}).forEach(k=>{var v=h[k],o=v&&v.factionId||k;
  if(Array.isArray(v))v.forEach(n=>visit(n,null,o));
  else if(v&&Array.isArray(v.divisions))v.divisions.forEach(n=>visit(n,null,o));
  else visit(v,null,o);
 });
 var covered=new Set(all.flatMap(x=>x.keys));
 regions.forEach(r=>{if(covered.has(r.id))return;
  var k=own(r,'taxAuthorityFactionId')?r.taxAuthorityFactionId:(r.currentOwner||r.owner||r.factionId);
  all.push({node:r,id:r.id,name:r.name||r.id,parent:null,leaf:true,keys:[r.id],allowed:same(k,fac)});
 });return all;
}
var KINDS=[['land',/田赋|田租|田税|地税|土地税/],['commerce',/商税|商赋|市税|营业税/],
 ['salt',/盐税|盐课/],['head',/丁税|丁赋|人头税/],['liaoxiang',/辽饷/],['jiaoxiang',/剿饷/],['lianxiang',/练饷/],['grain',/漕粮/]];
function kind(t){
 var s=[t.id,t.name,t.sourceTag,t.taxType].filter(Boolean).join(' ');
 for(var pair of KINDS)if(pair[1].test(s))return pair[0];
 if(/land|tianfu|arableLand/i.test(s+' '+t.base))return 'land';
 if(/commerce|shangshui|trade/i.test(s+' '+t.base))return 'commerce';
 if(/salt|yanli/i.test(s))return 'salt';if(/head_tax|dingshui/i.test(s))return 'head';return 'other';
}
// 「三饷」是辽饷、剿饷、练饷的合称：一条税令点名三饷，三种加派一并算在内。
var SANXIANG=['liaoxiang','jiaoxiang','lianxiang'];
function matches(p,t){return p.taxIds.length?p.taxIds.includes(String(t.id)):p.taxKind==='all'||p.taxKind===kind(t)||(p.taxKind==='sanxiang'&&SANXIANG.includes(kind(t)));}
function policies(g){return arr(g&&g.fiscalConfig&&g.fiscalConfig.taxPolicies);}
function active(g,p){var day=now(g);return p&&p.status!=='revoked'&&p.startDay<=day&&(p.endDay==null||day<p.endDay);}
function key(n){return String(n&&(n.id||n.mapRegionId||n.code||n.name)||'');}
function assessmentScope(g,ctx){
 if(ctx&&ctx._taxPolicyScope&&ctx._taxPolicyScope.game===g)return ctx._taxPolicyScope;
 var c=catalog(g),allowed=new Set(c.filter(x=>x.allowed).flatMap(x=>x.keys));
 var s={game:g,allowed:allowed};if(ctx)Object.defineProperty(ctx,'_taxPolicyScope',{value:s,configurable:true});return s;
}
function rateAt(g,n,t,base,day,ctx){
 var id=key(n),r=Number(base),scope=assessmentScope(g,ctx),fac=player(g);
 if(!scope.allowed.has(id))return r;
 for(var p of policies(g)){
  if(p.status==='revoked'||p.startDay>day||(p.endDay!=null&&day>=p.endDay))continue;
  if(!same(p.factionId,fac)&&!same(p.factionName,fac))continue;
  if(!p.regionKeys.includes(id)||!matches(p,t))continue;
  if(p.operation==='restore')r=Number(base);else if(p.operation==='set')r=p.bound==='down'?Math.min(r,p.value):p.bound==='up'?Math.max(r,p.value):p.value;else r*=p.value;
 }return Math.max(0,r);
}
function effectiveTax(g,n,t,ctx){
 if(!g||!policies(g).length)return t;
 var base=own(t,'_policyBaseRate')?t._policyBaseRate:t.rate,start=now(g);
 var days=Number(ctx&&ctx.turnDays)||0,end=start+days,points=[start,end],r;
 if(days>0){policies(g).forEach(p=>{if(p.startDay>start&&p.startDay<end)points.push(p.startDay);if(p.endDay>start&&p.endDay<end)points.push(p.endDay);});
  points=Array.from(new Set(points)).sort((a,b)=>a-b);r=0;
  for(var i=1;i<points.length;i++)r+=rateAt(g,n,t,base,(points[i-1]+points[i])/2,ctx)*(points[i]-points[i-1])/days;
 }else r=rateAt(g,n,t,base,start,ctx);
 return Object.assign({},t,{rate:r,_policyBaseRate:base});
}
// 诏令里一个动作是照办、被禁止还是说不清（2026-10-17 二次复审 R2-1/R2-7 起；三次复审 R3-1/R3-2/R3-6 定下「判不准就请旨」）。
// 加派（tm-endturn-edict.js·extractEdictFiscalActions 内）与税政（tm-tax-policy.js）各一份、逐字相同，smoke-edict-levy-negation 比对两份源码。
// 取舍：加派、免税都是动民生的重手，机器只在没有歧义时代办；判不准的一律交回请旨——宁可让玩家把话说清楚再下一次，也不反向执行。
//   ① 同一子句里禁令词在动作前面 → 禁止。中间夹着「并 / 且 / 另」时：禁令先落在一件具体罪行上、连词后另起命令
//      （「严禁贪污并命户部加派……」「严禁贪污且由户部加派……」）→ 照办；否则（「禁止地方官员另令属员加派……」
//      「严禁私征杂税并加派辽饷」）→ 说不清。动作前有「是否 / 若 / 未经 / 俟」之类 → 说不清。
//   ② 紧挨着的前一子句只有禁令词（「严禁：」「全国严禁，」），或上一句只有禁令词（「严禁；」「严禁」换行）→ 禁止。
//   ③ 紧跟动作的下一子句是纯收回（「著即停止 / 作罢 / 毋庸议」），或同一子句「……之事……停止」，或动作在句末而下一句只有收回 → 收回。
//   ④ 句中别处的禁令、停止、条件字样：禁令落在一件具体罪行上（「严禁贪污军粮」「不得扰民」）或另一处同类动作上
//      （「严禁私自加派，户部加派……」）→ 不相干；其余（「未经朕批准不得执行」「至秋收后停止」
//      「不得以筹饷为由，向……」）一律说不清；收回句紧挨着另一件事的话题（「修建宫室之议，著即停止」）→ 收的是那件事，不相干。
// 「不得已 / 不得不 / 不论 / 禁军 / 以免 / 民力不支」之类不是否定，「不得停止 / 不必停止」是双重否定（照办），都先抹掉。
// from：从第几个子句起找动作（同句前一处被禁止时接着看后一处）；prevSentence / nextSentence：上一句、下一句（看单独成句的禁令与收回）。
// 返回 { mood: 'do' | 'ban' | 'unclear' | 'none', clauses: 抹过的子句, at: 动作所在子句, hit: 动作在子句里的位置, layer: 本层命令里动作前的文字 }。
function actionMood(sentence, actionRe, nextSentence, from, prevSentence) {
  var mask = function(s) {
    return String(s == null ? '' : s).replace(/\s+/g, '')
      .replace(/迫不得已|不得已|不得不|不可不|不能不|不容不|莫不|无不|不论|无论|毋论|不拘|不问|不管|不惜|不计|不日|不时|不久|不分|不止|不足|不敷|不继|不支|不少|不等|不一|不妨|不仅|不但|不独|不惟|不啻|不外|以免|免得|未免|若干|如数|如例|如期|准奏|依议|依所请|准其所请|准[^，,：:]{0,6}所请/g, function(w) { return w.replace(/./g, '＃'); })
      .replace(/(?:不得|不准|不可|不许|不要|不必|毋得|勿得|毋庸)(?:停止|中止|作罢|撤回|收回|延缓|缓行|停办)/g, function(w) { return w.replace(/./g, '＃'); })
      .replace(/(^|[^严查厉明饬勿不永])禁(?=军|卫|旅|苑)/g, '$1＃');
  };
  var BAN_LONG = /禁止|严禁|不得|不许|不准|不要|不可|不必|不宜|不予|不再|不复|永不|毋得|毋庸|毋再|勿得|勿再|切勿|切莫|休得|暂缓|暂不|不允|不容|不让|不使|不肯|不能|不应|不该|无需|无须|毋需|毋须|不需|不用|无庸|毋用|免予|免于|休要|别再|切忌|杜绝|制止|防止|严防|禁绝|根绝|遏止|遏制|取缔|查禁|严惩|惩办|究办|参处|治罪|岂可|岂能|岂得|焉能|焉可|安可|何必|何须|何苦|绝不|决不|断不|万不可|万勿/;
  var BAN_NEAR = /(?:[勿毋莫禁]|不(?=[向对在于为给再必应宜可得许准要能肯愿敢欲另又]))[^，,：:]{0,4}$|不[^，,：:]{0,2}$|未[^，,：:]?$/;
  var STOP = '停止|中止|作罢|罢之|罢议|免议|毋庸议|撤回|收回|作废|寝之|缓行|从缓|缓办|缓议';
  var COND = new RegExp(STOP + '|未经|若|倘|假如|是否|可否|能否|应否|宜否|要否|与否|何不|再议|另议|研议|商议|会议|集议|廷议|酌议|奏议|候旨|请旨|听候|俟|待|等到|届时|一旦|万一|如遇|如有|遇有|奏请|请求|建议|提议|拟议|条陈|奏称|有人');
  var DOUBT = new RegExp(BAN_LONG.source + '|[勿毋莫禁罢]|' + COND.source);
  var HEADER = /^(?:全国|天下|各地|各省|地方|内外|中外|朝野|一律|一概|著即|着即|著|着|即|今|兹|特|再|永远|永|务必|务|须|亦|仍)*(?:禁止|严禁|不得|不许|不准|不要|不可|毋得|勿得|永不|切勿|切莫|禁|勿|毋|莫)$/;
  var CONJ = /并|且|另|又|同时|随后|然后/;
  var LINK = /^(?:并|且|另|又|同时|随后|然后)[^，,：:]{0,4}?(?:命|令|著|着|饬|敕|谕|责成|准予|准|照章|依例|按例|照例|如例|依制|按制|照数|由|交)/;
  var OFFENSE = /贪污|贪墨|贪赃|贪腐|侵吞|侵占|侵渔|侵蚀|侵冒|冒领|冒支|冒滥|虚报|谎报|瞒报|隐匿|隐瞒|克扣|扣减|中饱|勒索|敲诈|讹诈|需索|索取|苛索|苛派|苛敛|苛征|科敛|科派|摊派|私派|私征|滥征|滥派|滥收|滥支|滥用|滥刑|浮收|浮征|多征|多收|多派|加耗|火耗|骚扰|扰民|滋扰|扰害|扰累|欺压|鱼肉|害民|病民|虐民|盗窃|偷盗|盗卖|抢劫|抢掠|劫掠|掳掠|奸淫|杀掠|擅杀|杀人|伤人|放火|纵火|强占|霸占|拐卖|通敌|谋反|作乱|械斗|聚众|赌博|聚赌|酗酒|舞弊|作弊|徇私|营私|结党|包揽|把持|挪用|走私|私铸|私贩|私收|私加|私扣|私吞|囤积|哄抬|拖欠|延误|迟误|迟延|拖延|耽延|推延|观望|推诿|懈怠|废弛|玩忽|渎职|擅离|逃匿|飞洒|诡寄|欺隐|隐漏|折勒|勒派|勒捐|派累|刁难/;
  var PRETEXT = /(?:为由|为名|之名|为辞|借口|名义|擅自|私自|任意|随意|再行|向|对|于|把|将|以|借|藉|因|凭)$/;
  var RETRACT = new RegExp('^(?:著即|着即|即行|应即|立即|立刻|著|着|即|速|一律|均|俱|亦|仍|一概|暂|姑|此事|此议|此令|前令|前旨|所议|所请|其|之)*(?:' + STOP + '|罢|毋庸|不必|不准|不允|不行|勿行|毋行|暂缓|(?:永不|不再|不复|勿再|毋再|不得|不准|不许)(?:施行|举行|执行|实行|推行|行|议|办))(?:之|行|办|议|其事)?$');
  var TOPIC = /(?:之议|之事|一事|之令|之举|之役|工程|事宜)$/;
  var TAIL_STOP = new RegExp('(?:之事|之议|一事|此事|此议|之令|之举)[^，,：:]*(?:' + STOP + ')(?:之|行|办|议)?$');
  // 别处子句是否不相干：没有禁令、停止、条件字样；或禁令落在具体罪行 / 另一处同类动作上，且不带停止、条件字样，也不以「为由 / 向……」之类悬空收尾
  var unrelated = function(c) {
    var b = c.search(DOUBT);
    if (b < 0) return true;
    if (COND.test(c)) return false;
    return (OFFENSE.test(c.slice(b)) || actionRe.test(c.slice(b))) && !PRETEXT.test(c);
  };
  var clauses = mask(sentence).split(/[，,：:]/), at = -1, hit = -1;
  for (var i = from || 0; i < clauses.length && at < 0; i++) { hit = clauses[i].search(actionRe); if (hit >= 0) at = i; }
  var head = at >= 0 ? clauses[at].slice(0, hit) : '', layer = head, doubt = false;
  var result = function(mood) { return { mood: mood, clauses: clauses, at: at, hit: hit, layer: layer }; };
  if (at < 0) return result('none');
  // ① 同一子句、动作之前
  if (BAN_LONG.test(head) || BAN_NEAR.test(head)) {
    var bi = Math.max(0, head.search(new RegExp(BAN_LONG.source + '|[勿毋莫禁]'))), ci = head.slice(bi).search(CONJ);
    if (ci < 0) return result('ban');
    layer = head.slice(bi + ci);
    if (!LINK.test(layer) || !OFFENSE.test(head.slice(0, bi + ci)) || BAN_LONG.test(layer) || BAN_NEAR.test(layer)) doubt = true;
  }
  if (COND.test(head)) doubt = true;
  // ③ 动作之后：同一子句、紧跟的子句、下一句
  var tail = clauses[at].slice(hit);
  if (TAIL_STOP.test(tail) && !BAN_LONG.test(tail)) return result('ban');
  if (!unrelated(tail.replace(actionRe, ''))) doubt = true;
  for (var j = at + 1; j < clauses.length; j++) {
    if (RETRACT.test(clauses[j])) { if (j === at + 1) return result('ban'); if (!(TOPIC.test(clauses[j - 1]) && !actionRe.test(clauses[j - 1]))) doubt = true; }
    else if (!unrelated(clauses[j])) doubt = true;
  }
  var last = clauses[clauses.length - 1];
  if (nextSentence != null && RETRACT.test(mask(nextSentence))) { if (at === clauses.length - 1) return result('ban'); if (!(TOPIC.test(last) && !actionRe.test(last))) doubt = true; }
  // ② ④ 动作之前的子句、上一句
  if (prevSentence != null && HEADER.test(mask(prevSentence))) { if (at === 0) return result('ban'); doubt = true; }
  for (var k = at - 1; k >= 0; k--) {
    if (HEADER.test(clauses[k])) { if (k === at - 1) return result('ban'); doubt = true; }
    else if (!unrelated(clauses[k])) doubt = true;
  }
  return result(doubt ? 'unclear' : 'do');
}
var NUM='[零〇一二两三四五六七八九十百\\d]+(?:\\.\\d+)?';
// 2026-10-13：「取消/废除/撤销/革除/停收 三饷」是玩家最常写的废止句式，原词表不认，整句被当没说；补齐后按全免登记。
var verbs=/税率(?:为|改为|定为|调整为)|增税|加税|减税|降税|免税|免赋|免田赋|免除|蠲免|蠲除|豁免|免征|停征|罢征|停收|取消|废除|废止|撤销|革除|减免|减征|减半|降低|减少|降为|减为|减至|降至|降到|减到|调低|提高|上调|增加|加征|增征|增至|升至|增到|调高|恢复|复征/;
var TAXWORDS=/税|赋|田租|漕粮|三饷|辽饷|剿饷|练饷|盐课/;
function parse(g,text,params){
 params=params||{};text=String(text||'').trim();
 if(!TAXWORDS.test(text)&&!params.taxId)return {handled:false};
 if(!verbs.test(text)&&!own(params,'rate'))return {handled:false};
 if(text.length>12000)return Object.assign(fail('tax-command-too-long','税令过长，请拆分具体条款'),{handled:true});
 var sentences=text.split(/[。；;！!？?\n]+/),pieces=sentences.filter(s=>verbs.test(s)&&TAXWORDS.test(s));
 if(!pieces.length&&own(params,'rate'))pieces=[text];var cat=catalog(g),fac=player(g),plans=[];
 if(!fac.id)return Object.assign(fail('tax-authority-unknown','未能确认本方税权，未修改税制'),{handled:true});
 for(var clause of pieces){
  if(/研究|讨论|论证|是否|可否|可行性|拟议|建议|核验后|查明后|若|倘/.test(clause))return Object.assign(fail('tax-planning-only','此条是研究或附条件事项，未直接执行征免'),{handled:true});
  if(/明年|来年|翌年|明月|下月|下一回合|次回合/.test(clause))return Object.assign(fail('tax-future-date-unresolved','未来生效时间须明确登记，未提前执行'),{handled:true});
  var directions=[/免税|免赋|免田赋|免除|蠲免|蠲除|豁免|免征|停征|罢征|停收|取消|废除|废止|撤销|革除/,/提高|上调|增加|加征|增征|增税|加税|增至|升至|增到|调高/,/减免|减征|减半|降低|减少|降为|减为|减至|降至|降到|减到|调低|减税|降税/,/恢复|复征/].filter(re=>re.test(clause));
  if(directions.length>1)return Object.assign(fail('tax-multiple-actions','不同税务动作请用分号分别列明，未合并扩大执行'),{handled:true});
  // 否定按「命令层」判（2026-10-17 二次复审 R2-1/R2-7·与加派同一份 actionMood）：原来的字数窗口跨冒号、逗号就漏，「严禁贪污并命户部取消三饷」又被误伤；
  // 「不得已」之类两条旧正则一条认一条不认。禁止的跳过；禁令管不管到这项税务说不清的，不执行、请分句写明。
  var at=sentences.indexOf(clause),mood=actionMood(clause,verbs,at>=0?sentences[at+1]:undefined);
  if(mood.mood==='ban'){if(actionMood(clause,verbs,undefined,mood.at+1).mood==='none')continue;return Object.assign(fail('tax-multiple-actions','一句里既有被禁止的税务动作又有别的税务动作，未执行；请分句写明'),{handled:true});}
  if(mood.mood==='unclear'||mood.mood==='none')return Object.assign(fail('tax-negation-unclear','禁令词与税务动作在同一句，管不管到这项税务说不清，未执行；请把禁令与命令分句写明'),{handled:true});
  if(/[-−]\s*\d+(?:\.\d+)?\s*[%％成]/.test(clause))return Object.assign(fail('tax-rate-negative','负数税率或比例不能直接执行'),{handled:true});
  var kinds=KINDS.filter(x=>x[1].test(clause));
  if(!kinds.length&&/三饷/.test(clause))kinds=[['sanxiang',/三饷/]];
  if(kinds.length>1)return Object.assign(fail('tax-kind-ambiguous','多种税请逐项列明调整'),{handled:true});
  var taxKind=kinds.length===1?kinds[0][0]:'all',taxIds=params.taxId?[String(params.taxId)]:[];
  if(!kinds.length&&!taxIds.length&&!/赋税|税赋|税收|全部税|所有税|各项税|一切税|诸税|免税|减税|增税|加税|降税/.test(clause))return Object.assign(fail('tax-kind-unrecognized','未识别明确税种，未将其扩大为全部赋税'),{handled:true});
  var meaningful=clause.replace(/(?:其他|其余|别的)[^，,。；;]*(?:不变|照旧|仍旧)/g,'');
  meaningful=meaningful.replace(/(?:命|着|令)[^，,]*(?:汇报|奏报|具奏|回报|复命)[^，,]*/g,'');
     var exceptionNames=[];
   meaningful=meaningful.replace(/除(?:了)?([^，,。；;]+?)(?:以)?外|([^，,。；;]+?)除外/g,function(full,a,b){
    var term=(a||b||'').trim(),found=cat.filter(x=>x.name&&term.includes(x.name));
    var rest=term;found.sort((x,y)=>y.name.length-x.name.length).forEach(x=>{rest=rest.split(x.name).join('');});
    if(!found.length||rest.replace(/[、和与及及其所属地区所有辖区\s]/g,''))exceptionNames.push(null);
    else exceptionNames.push(...found.map(x=>x.id));return '';
   });
   if(exceptionNames.includes(null))return Object.assign(fail('tax-exception-unresolved','例外地区未能准确识别，未扩大减免范围'),{handled:true});
   var excluded=new Set(exceptionNames),more=true;
   while(more){more=false;cat.forEach(x=>{if(excluded.has(x.parent)&&!excluded.has(x.id)){excluded.add(x.id);more=true;}});}
  var named=cat.filter(x=>x.name&&x.name.length>1&&meaningful.includes(x.name));
  var national=/全国|天下|各地|全境|全体|所有地区/.test(meaningful)||params.scope==='national';
  if(params.regionId){named=cat.filter(x=>x.keys.includes(params.regionId)||x.name===params.regionId);national=false;}
  if(!national&&!named.length)return Object.assign(fail('tax-region-unresolved','请明确全国或可识别的地区，未扩大作用范围'),{handled:true});
  var selected=new Set(named.map(x=>x.id)),changed=true;
  while(changed){changed=false;cat.forEach(x=>{if(selected.has(x.parent)&&!selected.has(x.id)){selected.add(x.id);changed=true;}});}
  var targets=cat.filter(x=>x.leaf&&x.allowed&&!excluded.has(x.id)&&(national||selected.has(x.id)));
  if(!targets.length)return Object.assign(fail('tax-no-authority','目标没有可操作的本方税权地块'),{handled:true});
  var operation,value,m,bound=null;
  if(/恢复|复征/.test(clause)){operation='restore';value=1;}
  else if(/免税|免赋|免田赋|免除|蠲免|蠲除|豁免|免征|停征|罢征|停收|取消|废除|废止|撤销|革除/.test(clause)){
    var explicit=clause.match(new RegExp('税率(?:为|改为|定为|调整为)\\s*('+NUM+')\\s*[%％]'));
    var fraction=clause.match(new RegExp('('+NUM+')\\s*[%％]'))||clause.match(new RegExp('百分之('+NUM+')'));
    var tenths=clause.match(new RegExp('('+NUM+')\\s*成'));
    if(explicit){operation='set';value=number(explicit[1])/100;}
    else{operation='scale';var reduction=/一半|半数/.test(clause)?.5:fraction?number(fraction[1])/100:tenths?number(tenths[1])/10:1;value=1-reduction;}
    if(!Number.isFinite(value)||value<0||value>1)return Object.assign(fail('tax-reduction-invalid','减免比例须明确且介于0至100%之间'),{handled:true});
   }
  else if(/减半/.test(clause)){operation='scale';value=.5;}
  else if((m=clause.match(new RegExp('(提高|上调|调高|增|升|降低|下调|调低|减|降)(?:到|至|为)\\s*('+NUM+')\\s*成')))){
   // 2026-10-14：「减至三成」「减为五成」是日常说法「减到原额的三成」，原代码当成税率本身=0.3，
   // 天启田赋每亩一分四厘被改成三钱（涨二十多倍）、辽饷同理暴涨几十倍。降类动词按原额比例折算；
   // 「提高到两成」两种读法都说得通（税率定为20%／在现额上加两成），不猜，请写明。
   var tenth=number(m[2])/10;
   if(/提高|上调|调高|增|升/.test(m[1]))return Object.assign(fail('tax-rate-ambiguous','「'+m[0]+'」有两种读法（税率定为'+Math.round(tenth*100)+'%，还是在现额上加'+m[2]+'成），未猜测；请写「税率提高到X%」或「加征X成」'),{handled:true});
   if(!Number.isFinite(tenth)||tenth<0||tenth>1)return Object.assign(fail('tax-rate-invalid','「减至X成」的成数须在零到十成之间'),{handled:true});
   operation='scale';value=tenth;
  }
  else {
   var target=clause.match(new RegExp('(?:税率(?:为|改为|定为|调整为)|(?:提高|降低|下调|上调|调高|调低|减|降|增|升)(?:到|至|为))\\s*(百分之)?('+NUM+')\\s*([%％成]?)'));
   var literals=Array.from(clause.matchAll(new RegExp('('+NUM+')\\s*[%％]|百分之('+NUM+')','g')));
   var c=clause.match(new RegExp('('+NUM+')\\s*成'));
   if(!own(params,'rate')&&!target&&literals.length>1)return Object.assign(fail('tax-multiple-rates','多个税率未明确起点和终点，未猜测税率'),{handled:true});
   var amount=own(params,'rate')?Number(params.rate):target?(target[1]||target[3]?number(target[2])/(target[3]==='成'?10:100):NaN):literals.length?number(literals[0][1]||literals[0][2])/100:c?number(c[1])/10:NaN;
   if(!Number.isFinite(amount)||amount<0||amount>10)return Object.assign(fail('tax-rate-invalid','税率或增减比例不明确，未采用默认值'),{handled:true});
   if(own(params,'rate')||/税率(?:为|改为|定为|调整为)|(?:提高|降低|下调|上调|调高|调低|减|降|增|升)(?:到|至|为)/.test(clause)){
    operation='set';value=amount;if(value>1)return Object.assign(fail('tax-rate-range','百分比税率须在0至100%之间'),{handled:true});
    // 「减至3%」只能往下走、「提高到5%」只能往上走：现额已经过线的地块不动，不让「减」字反把税抬高。
    var dir=clause.match(/(提高|上调|调高|增|升|降低|下调|调低|减|降)(?:到|至|为)/);bound=dir?(/提高|上调|调高|增|升/.test(dir[1])?'up':'down'):null;
   }else{operation='scale';value=/增税|加税|提高|上调|增加|加征|增征/.test(clause)?1+amount:1-amount;}
  }
  if(value<0)return Object.assign(fail('tax-rate-range','减免比例不能超过100%'),{handled:true});
  var taxPart=clause.split(/[,，](?:命|着|令|责成)/)[0];
  var duration=taxPart.match(new RegExp('('+NUM+')\\s*(个?月|年|回合|天|日)(?![^，,]*(?:汇报|奏报|具奏|回报|复命))'));
  var days=duration?number(duration[1])*({'月':30,'个月':30,'年':360,'回合':turnDays(g),'天':1,'日':1}[duration[2]]):null;
  if(days!=null&&(!(days>0)||days>36000))return Object.assign(fail('tax-duration-invalid','有效期必须为明确的正数'),{handled:true});
  plans.push({text:clause.trim(),taxKind:taxKind,taxIds:taxIds,operation:operation,value:value,bound:bound,
   regionKeys:Array.from(new Set(targets.flatMap(x=>x.keys))),regionNames:targets.map(x=>x.name),
   factionId:fac.id,factionName:fac.name,startDay:now(g),endDay:days==null?null:now(g)+days});
 }return {ok:plans.length>0,handled:true,plans:plans,reason:plans.length?'':'没有可执行的税务调整条款'};
}
function apply(g,text,params,ctx){
 var plan=parse(g,text,params);if(!plan.handled||!plan.ok)return plan;
 var engine=root.FiscalEngine;if(!engine||!engine.taxPolicyCatalog)return Object.assign(fail('tax-engine-unavailable','财政计算入口未就绪'),{handled:true});
 var native=TM.NativeFiscal&&TM.NativeFiscal.enabled(g),taxes=native?arr(g.nativeWorld&&g.nativeWorld.accounts).filter(a=>a.flowModel&&a.flowModel.type==='region-tax').map(a=>({id:a.id,name:a.name||a.id,base:a.flowModel.taxBase||'',rate:a.flowModel.rate})):engine.taxPolicyCatalog(g);
 for(var p of plan.plans)if(!taxes.some(t=>matches(p,t)))return Object.assign(fail('tax-kind-unavailable','该财政模式没有明确对应的税种，未修改其他收入'),{handled:true});
 var normalized=s=>String(s||'').trim().replace(/\s+/g,' '),input=normalized(text),allEdicts=arrEdicts(g);
 var forced=ctx&&ctx.sourceId||ctx&&ctx.edictId||params&&params.sourceId;
 var binding=[];
 for(var p of plan.plans){
  var candidates=allEdicts.filter(e=>normalized(e.content)===input);
  if(!candidates.length)candidates=allEdicts.filter(e=>input.includes(normalized(e.content))&&normalized(e.content).includes(normalized(p.text)));
  if(candidates.length>1){var current=candidates.filter(e=>e.turn===g.turn);if(current.length)candidates=current;}
  if(!forced&&candidates.length>1)return Object.assign(fail('tax-source-ambiguous','税令来源不唯一，未将执行凭据绑定到其他命令'),{handled:true});
  var original=candidates.length===1?candidates[0]:null;
  if(original&&original.status==='pending_delivery'&&!(ctx&&ctx.channel==='letter'))return Object.assign(fail('tax-pending-delivery','税令尚在传递，未提前执行'),{handled:true});
  var source=String(forced||(original?'edict:'+original.id:'text:'+g.turn+':'+text));
  var old=policies(g).filter(q=>q.sourceId===source),matched=old.find(q=>q.text===p.text&&q.taxKind===p.taxKind&&q.operation===p.operation&&q.value===p.value);
  if(old.length&&!matched)return Object.assign(fail('tax-source-changed','同一来源的税令内容已改变，请作为新命令重新提交'),{handled:true});
  binding.push({plan:p,sourceId:source,existing:matched});
 }
 if(binding.every(b=>b.existing))return {ok:true,applied:true,handled:true,duplicate:true,receiptIds:binding.map(b=>b.existing.id),policies:binding.map(b=>b.existing)};
 var cfg=g.fiscalConfig=g.fiscalConfig||{},seq=Number(cfg.taxPolicySequence)||0;
 var inserted=binding.filter(b=>!b.existing).map(b=>Object.assign({},b.plan,{id:'tax-policy-'+(++seq),sourceId:b.sourceId,issuedTurn:Number(g.turn)||0,status:'active',evidenceType:'tax_policy_registered'}));
 var before=policies(g);cfg.taxPolicies=before.concat(inserted);cfg.taxPolicySequence=seq;
 g._continuityRevision=(Number(g._continuityRevision)||0)+1;
 if(root.addEB)root.addEB('税令','税务规则已登记：'+inserted.map(p=>p.text).join('；'));
 return {ok:true,applied:true,handled:true,receiptIds:inserted.map(p=>p.id),policies:inserted};
}
function coversTask(g,text){
 text=String(text||'');
 // A receipt for tax assessment is not proof of construction, transfers, inquiry, or appointment.
 if(/修建|修筑|修缮|修桥|修路|兴修|营建|建设|兴办|开办|运粮|运银|运送|发粮|赈|募兵|调兵|出兵|查清|查明|调查|查办|清查|核验|核对|稽核|审计|治河|迁民|安置|任命|罢免|追缴|补发|撰写|编写/.test(text))return false;
 function reportOnly(s){
  if(!/汇报|奏报|具奏|复命|回报|面奏|呈报/.test(s))return false;
  arr(g.chars).forEach(c=>{[c.name,c.officialTitle].filter(Boolean).forEach(n=>{s=s.split(n).join('');});});
  s=s.replace(/鸿雁传书|奏疏|书信|向天子|向朕|汇报|奏报|具奏|复命|回报|面奏|呈报|限期|限|之内|回合|个月|月|年|天|日|通过|按期|及时|务必|责成|命|着|令|请|于|在|内|前|后|以|第|[零〇一二两三四五六七八九十百千\d\s，,。；;：:]/g,'');
  return !s;
 }
 var parts=text.split(/[，,。；;\n]+|并且|并|同时|另行|另外|随后|然后|以及/).filter(s=>s.trim());
 return parts.length>0&&parts.every(s=>/税|赋|田租|漕粮|辽饷|剿饷|练饷|盐课/.test(s)||reportOnly(s));
}
function arrEdicts(g){return arr(g._edictTracker).filter(e=>e&&e.id&&e.content);}
function receipts(g,sourceId){return policies(g).filter(p=>p.sourceId===sourceId).map(p=>({id:p.id,type:'tax_policy',sourceId:p.sourceId,text:p.text,regionKeys:p.regionKeys,startDay:p.startDay,endDay:p.endDay}));}
function describe(g,query){
 var list=policies(g).filter(p=>p.status!=='revoked');
 if(query)list=list.filter(p=>p.regionNames.some(n=>String(query).includes(n))||String(query).match(/税|赋|租|征/));
 return list.slice(-12).map(p=>'['+p.id+'] '+p.text+'；'+(active(g,p)?'现行有效':'已到期或未生效')+'；生效日'+p.startDay+(p.endDay==null?'，长期有效':'，截至第'+p.endDay+'日')+'；范围：'+p.regionNames.slice(0,8).join('、')).join('\n');
}
function staticFactor(g,n,ctx){return effectiveTax(g,n,{id:'__static_all_tax',name:'合并税收',rate:1},ctx).rate;}
TM.TaxPolicy={coversTask:coversTask,parse:parse,actionMood:actionMood,apply:apply,effectiveTax:effectiveTax,receipts:receipts,describe:describe,
 active:active,now:now,turnDays:turnDays,number:number,player:player,catalog:catalog,staticFactor:staticFactor};
})(typeof window!=='undefined'?window:globalThis);
