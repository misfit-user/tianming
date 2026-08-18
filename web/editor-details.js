// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * editor-details.js — 游戏内编辑器详细编辑面板
 *
 * 来源：2026-04-24 R21 从 tm-patches.js:1682-1860 抽离
 *
 * 覆盖的 tab 渲染函数（替换 tm-game-engine 的简版）：
 *   renderItmTab  — 物品/科技/政策
 *   renderRulTab  — 规则
 *   renderEvtTab  — 事件
 *   renderFacTab  — 党派
 *   renderClassTab — 阶层
 *   renderWldTab  — 世界设定
 *   renderTechTab — 科技树
 *   editChr       — 角色详细编辑（含 10 维属性滑块）
 *
 * 新增的 detail 编辑函数：
 *   saveChrEdit(i)  editItm(i)  editClass2(i)  editTech2(i)
 *
 * 新增的 AI 生成函数：
 *   aiGenItems  aiGenRules  aiGenEvents  aiGenClasses  aiGenWorld  aiGenTech
 *
 * 依赖：
 *   - P.characters/items/rules/events/factions/classes/world/techTree
*   - openGenericModal/closeGenericModal/gv（tm-ui-foundation.js）
 *   - _$('em')/renderEdTab/toast/editingScenarioId（tm-game-engine.js）
 *   - callAISmart/showLoading/hideLoading/uid（tm-utils.js）
 *   - escHtml（全局工具）
 *
 * 兼容性：原 tm-patches.js:1682-1860 保留相同代码作双保险。
 * 所有 renderXxxTab 是覆盖重定义（editChr/renderItmTab/renderRulTab 等是 window.* 覆盖）。
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;

  // 角色详细编辑（覆盖简版） - 含五维滑块
  window.editChr = function(i){
    var ch=P.characters[i];
    var ss=Object.entries(ch.stats||{}).map(function(e){return e[0]+":"+e[1];}).join(",");
    function sl(label,key,val){return '<div class="slider-group"><label>'+label+'</label><input type="range" min="0" max="100" value="'+val+'" id="chr-sl-'+key+'" oninput="this.nextElementSibling.textContent=this.value"><span class="slider-val">'+val+'</span></div>';}
    var sliders=sl("忠诚","loyalty",ch.loyalty!=null?ch.loyalty:70)+
      sl("士气","morale",ch.morale!=null?ch.morale:70)+
      sl("野心","ambition",ch.ambition!=null?ch.ambition:50)+
      sl("仁德","benevolence",ch.benevolence!=null?ch.benevolence:50)+
      sl("智谋","intelligence",ch.intelligence!=null?ch.intelligence:50)+
      sl("武勇","valor",ch.valor!=null?ch.valor:50)+
      sl("军事","military",ch.military!=null?ch.military:50)+
      sl("政务","administration",ch.administration!=null?ch.administration:50)+
      sl("魅力","charisma",ch.charisma!=null?ch.charisma:50)+
      sl("外交","diplomacy",ch.diplomacy!=null?ch.diplomacy:50);
    _$("em").innerHTML="<div class=\"cd\"><h4>编辑角色: "+ch.name+"</h4>"+
      "<div class=\"rw\"><div class=\"fd\"><label>名称</label><input id=\"chr-ed-name\" value=\""+ch.name+"\"></div><div class=\"fd\"><label>头衔</label><input id=\"chr-ed-title\" value=\""+ch.title+"\"></div><div class=\"fd\"><label>阵营</label><input id=\"chr-ed-faction\" value=\""+(ch.faction||"")+"\"></div></div>"+
      "<div class=\"rw\"><div class=\"fd\"><label>立场</label><input id=\"chr-ed-stance\" value=\""+(ch.stance||"")+"\"></div><div class=\"fd q\"><label>年龄</label><input type=\"number\" id=\"chr-ed-age\" value=\""+(ch.age||30)+"\"></div><div class=\"fd q\"><label>性别</label><select id=\"chr-ed-gender\"><option "+(ch.gender==="男"?"selected":"")+">男</option><option "+(ch.gender==="女"?"selected":"")+">女</option></select></div><div class=\"fd q\"><label>类型</label><select id=\"chr-ed-hist\"><option value=\"false\" "+(ch.isHistorical?"":"selected")+">虚构</option><option value=\"true\" "+(ch.isHistorical?"selected":"")+">历史名臣</option></select></div></div>"+
      "<div style=\"background:var(--bg-3);border:1px solid var(--bdr);border-radius:8px;padding:0.6rem;margin:0.5rem 0;\"><div style=\"font-size:0.85rem;font-weight:700;color:var(--gold);margin-bottom:0.3rem;\">五维属性</div>"+sliders+"</div>"+
      "<div class=\"fd full\"><label>描述</label><textarea rows=\"2\" id=\"chr-ed-desc\">"+ch.desc+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>性格</label><textarea rows=\"2\" id=\"chr-ed-personality\">"+(ch.personality||"")+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>外貌</label><input id=\"chr-ed-appearance\" value=\""+(ch.appearance||"")+"\"></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>属性(k:v,k:v)</label><input id=\"chr-ed-stats\" value=\""+ss+"\"></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>技能(逗号)</label><input id=\"chr-ed-skills\" value=\""+(ch.skills||[]).join(",")+"\"></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>台词(每行)</label><textarea rows=\"2\" id=\"chr-ed-dialogues\">"+(ch.dialogues||[]).join("\n")+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>秘密目标</label><input id=\"chr-ed-secret\" value=\""+(ch.secret||"")+"\"></div>"+
      "<hr class=\"dv\"><div style=\"font-size:0.88rem;font-weight:700;color:var(--purple);margin-bottom:0.5rem;\">AI深度设定</div>"+
      "<div class=\"fd full\"><label>AI人设文本</label><textarea rows=\"3\" id=\"chr-ed-aiPersona\" placeholder=\"详细描述供AI判断角色行为\">"+(ch.aiPersonaText||"")+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>行为模式</label><textarea rows=\"2\" id=\"chr-ed-behavior\" placeholder=\"AI如何决定行动\">"+(ch.behaviorMode||"")+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>价值观</label><textarea rows=\"2\" id=\"chr-ed-values\">"+(ch.valueSystem||"")+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>说话风格</label><textarea rows=\"2\" id=\"chr-ed-speech\">"+(ch.speechStyle||"")+"</textarea></div>"+
      "<button class=\"bt bp\" onclick=\"saveChrEdit("+i+")\" style=\"margin-top:0.5rem;\">完成</button></div>";
  };

  window.saveChrEdit = function(i){
    var ch=P.characters[i];
    ch.name=gv("chr-ed-name");ch.title=gv("chr-ed-title");ch.faction=gv("chr-ed-faction");
    ch.stance=gv("chr-ed-stance");ch.age=+(document.getElementById("chr-ed-age").value)||30;
    ch.gender=document.getElementById("chr-ed-gender").value;
    ch.isHistorical=document.getElementById("chr-ed-hist").value==="true";
    ch.loyalty=+document.getElementById("chr-sl-loyalty").value;
    ch.morale=+document.getElementById("chr-sl-morale").value;
    ch.ambition=+document.getElementById("chr-sl-ambition").value;
    ch.benevolence=+document.getElementById("chr-sl-benevolence").value;
    ch.intelligence=+document.getElementById("chr-sl-intelligence").value;
    ch.valor=+document.getElementById("chr-sl-valor").value;
    ch.military=+document.getElementById("chr-sl-military").value;
    ch.administration=+document.getElementById("chr-sl-administration").value;
    ch.charisma=+document.getElementById("chr-sl-charisma").value;
    ch.diplomacy=+document.getElementById("chr-sl-diplomacy").value;
    ch.desc=gv("chr-ed-desc");ch.personality=gv("chr-ed-personality");
    ch.appearance=gv("chr-ed-appearance");
    var statsStr=gv("chr-ed-stats");var o={};statsStr.split(",").forEach(function(p){var kv=p.split(":");if(kv[0]&&kv[1])o[kv[0].trim()]=parseInt(kv[1])||0;});ch.stats=o;
    ch.skills=gv("chr-ed-skills").split(",").map(function(s){return s.trim();}).filter(Boolean);
    ch.dialogues=document.getElementById("chr-ed-dialogues").value.split("\n").filter(Boolean);
    ch.secret=gv("chr-ed-secret");
    ch.aiPersonaText=document.getElementById("chr-ed-aiPersona").value;
    ch.behaviorMode=document.getElementById("chr-ed-behavior").value;
    ch.valueSystem=document.getElementById("chr-ed-values").value;
    ch.speechStyle=document.getElementById("chr-ed-speech").value;
    renderEdTab("t-chr");toast("已保存");
  };

  // 物品详细编辑
  window.renderItmTab = function(em,sid){
    var list=P.items.filter(function(t){return t.sid===sid;});
    em.innerHTML="<h4 style=\"color:var(--gold);\">物品/科技/政策 ("+list.length+")</h4>"+
      "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp bsm\" onclick=\"P.items.push({sid:editingScenarioId,name:'新',type:'item',desc:'',effect:{},prereq:'',acquired:false});renderEdTab('t-itm');\">＋物品</button><button class=\"bt bp bsm\" onclick=\"P.items.push({sid:editingScenarioId,name:'新',type:'tech',desc:'',effect:{},prereq:'',acquired:false});renderEdTab('t-itm');\">＋科技</button><button class=\"bt bp bsm\" onclick=\"P.items.push({sid:editingScenarioId,name:'新',type:'policy',desc:'',effect:{},prereq:'',acquired:false});renderEdTab('t-itm');\">＋政策</button><button class=\"bai\" onclick=\"aiGenItems()\">🤖</button></div>"+
      list.map(function(t){var i=P.items.indexOf(t);var eff=Object.entries(t.effect||{}).map(function(e){return(e[1]>0?"+":"")+e[1]+" "+e[0];}).join(", ");
        return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><div><span class=\"tg\">"+t.type+"</span> <strong>"+t.name+"</strong></div><div><button class=\"bs bsm\" onclick=\"editItm("+i+")\">编辑</button> <button class=\"bd bsm\" onclick=\"P.items.splice("+i+",1);renderEdTab('t-itm');\">✕</button></div></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+t.desc+"</div>"+(eff?"<div style=\"margin-top:0.2rem;\">"+eff+"</div>":"")+(t.prereq?"<div style=\"font-size:0.7rem;color:var(--txt-d);\">前置: "+t.prereq+"</div>":"")+"</div>";}).join("")||"<div style=\"color:var(--txt-d);\">暂无</div>";
  };

  window.editItm = function(i){
    var t=P.items[i];var effStr=Object.entries(t.effect||{}).map(function(e){return e[0]+":"+e[1];}).join(",");
    _$("em").innerHTML="<div class=\"cd\"><h4>编辑</h4>"+
      "<div class=\"rw\"><div class=\"fd\"><label>名称</label><input value=\""+t.name+"\" onchange=\"P.items["+i+"].name=this.value\"></div><div class=\"fd q\"><label>类型</label><select onchange=\"P.items["+i+"].type=this.value\"><option "+(t.type==="item"?"selected":"")+">物品</option><option value=\"tech\" "+(t.type==="tech"?"selected":"")+">科技</option><option value=\"policy\" "+(t.type==="policy"?"selected":"")+">政策</option></select></div></div>"+
      "<div class=\"fd full\"><label>描述</label><textarea rows=\"3\" onchange=\"P.items["+i+"].desc=this.value\">"+t.desc+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>效果(变量:值,逗号)</label><input value=\""+effStr+"\" onchange=\"var o={};this.value.split(',').forEach(function(p){var kv=p.split(':');if(kv[0]&&kv[1])o[kv[0].trim()]=parseInt(kv[1])||0;});P.items["+i+"].effect=o;\"></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>前置条件</label><input value=\""+(t.prereq||"")+"\" onchange=\"P.items["+i+"].prereq=this.value\" placeholder=\"如: 变法支持>50\"></div>"+
      "<button class=\"bt bp\" onclick=\"renderEdTab('t-itm');toast('已保存')\" style=\"margin-top:0.5rem;\">完成</button></div>";
  };

  window.aiGenItems = async function(){
    showLoading("生成物品中...",20);
    try{
      var ctx=P.scenarios.find(function(s){return s.id===editingScenarioId;});
      var existItm=P.items.filter(function(x){return x.sid===editingScenarioId;}).map(function(x){return x.name;});
      var existNoteI=existItm.length?"已有道具（不得重复）："+existItm.join("、")+"\n":"";
      var c=await callAISmart("为"+(ctx?ctx.name:"")+"生成3-5物品/科技。"+existNoteI+"JSON:[{\"name\":\"\",\"type\":\"item/tech/policy\",\"desc\":\"\",\"effect\":{},\"prerequisite\":\"\"}]",1500,{minLength:200,validator:function(c){try{var jm=extractJSONMatch(c,'array');if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
      var jm=extractJSONMatch(c,'array');
      if(jm){
        JSON.parse(jm[0]).forEach(function(t){
          P.items.push({sid:editingScenarioId,name:t.name||"",type:t.type||"item",desc:t.desc||"",effect:t.effect||{},prereq:t.prerequisite||"",acquired:false});
        });
        renderEdTab("t-itm");
        toast("✅");
      }
    }catch(e){
      if(window.TM && TM.errors) TM.errors.capture(e, 'editor-details.aiGenItems');
      toast("失败");
    }finally{
      hideLoading();
    }
  };

  // 规则详细编辑
  window.renderRulTab = function(em,sid){
    var vn=P.variables.filter(function(v){return v.sid===sid;}).map(function(v){return v.name;});
    var list=P.rules.filter(function(r){return r.sid===sid;});
    em.innerHTML="<h4 style=\"color:var(--gold);\">规则 ("+list.length+")</h4>"+
      "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"P.rules.push({sid:editingScenarioId,name:'新',enabled:true,trigger:{type:'threshold',variable:'',op:'<',value:20},effect:{narrative:'',varChg:{},event:null}});renderEdTab('t-rul');\">＋</button><button class=\"bai\" onclick=\"aiGenRules()\">🤖</button></div>"+
      list.map(function(r){var i=P.rules.indexOf(r);var t=r.trigger;
        return "<div class=\"cd\" style=\"border-left:3px solid "+(r.enabled?"var(--green)":"var(--red)")+"\"><div style=\"display:flex;justify-content:space-between;margin-bottom:0.3rem;\"><div style=\"display:flex;gap:0.3rem;align-items:center;\"><input type=\"checkbox\" "+(r.enabled?"checked":"")+" onchange=\"P.rules["+i+"].enabled=this.checked;renderEdTab('t-rul');\"><input value=\""+r.name+"\" style=\"background:transparent;border:none;color:var(--txt);font-weight:700;\" onchange=\"P.rules["+i+"].name=this.value\"></div><button class=\"bd bsm\" onclick=\"P.rules.splice("+i+",1);renderEdTab('t-rul');\">✕</button></div>"+
        "<div style=\"background:var(--bg-1);border-radius:4px;padding:0.4rem;font-size:0.8rem;\"><select onchange=\"P.rules["+i+"].trigger.type=this.value;renderEdTab('t-rul');\"><option value=\"threshold\" "+(t.type==="threshold"?"selected":"")+">阈值</option><option value=\"keyword\" "+(t.type==="keyword"?"selected":"")+">关键词</option><option value=\"turn\" "+(t.type==="turn"?"selected":"")+">回合</option><option value=\"random\" "+(t.type==="random"?"selected":"")+">随机</option></select>"+
        (t.type==="threshold"?" <select onchange=\"P.rules["+i+"].trigger.variable=this.value\">"+vn.map(function(n){return "<option "+(t.variable===n?"selected":"")+">"+n+"</option>";}).join("")+"</select><select onchange=\"P.rules["+i+"].trigger.op=this.value\"><option "+(t.op==="<"?"selected":"")+">&lt;</option><option "+(t.op===">"?"selected":"")+">&gt;</option></select><input type=\"number\" value=\""+(t.value||0)+"\" style=\"width:45px;\" onchange=\"P.rules["+i+"].trigger.value=+this.value\">":"")+
        (t.type==="keyword"?"<input value=\""+(t.keywords||[]).join(",")+"\" placeholder=\"关键词,逗号\" onchange=\"P.rules["+i+"].trigger.keywords=this.value.split(',').map(function(s){return s.trim();})\">":"")+
        "</div><div style=\"background:var(--bg-1);border-radius:4px;padding:0.4rem;margin-top:0.3rem;\"><label style=\"font-size:0.72rem;color:var(--txt-d);\">触发效果</label><textarea rows=\"2\" style=\"width:100%;\" onchange=\"P.rules["+i+"].effect.narrative=this.value\">"+(r.effect.narrative||"")+"</textarea></div></div>";}).join("");
  };

  window.aiGenRules = async function(){
    showLoading("生成规则中...",20);
    try{
      var existRul=(Array.isArray(P.rules)?P.rules:[]).filter(function(x){return !x.sid||x.sid===editingScenarioId;}).map(function(x){return x.name;});
      var existNoteR=existRul.length?"已有规则（不得重复）："+existRul.join("、")+"\n":"";
      var c=await callAISmart("生成3规则。"+existNoteR+"JSON:[{\"name\":\"\",\"trigger\":{\"type\":\"threshold\",\"variable\":\"\",\"op\":\"<\",\"value\":20},\"effect\":{\"narrative\":\"\"}}]",1500,{minLength:150,validator:function(c){try{var jm=extractJSONMatch(c,'array');if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
      var jm=extractJSONMatch(c,'array');
      if(jm){
        JSON.parse(jm[0]).forEach(function(r){P.rules.push({sid:editingScenarioId,name:r.name||"",enabled:true,trigger:r.trigger||{type:"threshold"},effect:r.effect||{}});});
        renderEdTab("t-rul");toast("✅");
      }
    }catch(e){
      if(window.TM && TM.errors) TM.errors.capture(e, 'editor-details.aiGenRules');
      toast("失败");
    }finally{hideLoading();}
  };

  // 事件详细编辑
  window.renderEvtTab = function(em,sid){
    var list=P.events.filter(function(e){return e.sid===sid;});
    em.innerHTML="<h4 style=\"color:var(--gold);\">事件 ("+list.length+")</h4>"+
      "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"P.events.push({sid:editingScenarioId,id:uid(),name:'新',type:'scripted',triggerTurn:0,oneTime:true,triggered:false,narrative:'',choices:[]});renderEdTab('t-evt');\">＋</button><button class=\"bai\" onclick=\"aiGenEvents()\">🤖</button></div>"+
      list.map(function(ev){var i=P.events.indexOf(ev);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+ev.name+"</strong><div><button class=\"bs bsm\" onclick=\"editEvt("+i+")\">编辑</button> <button class=\"bd bsm\" onclick=\"P.events.splice("+i+",1);renderEdTab('t-evt');\">✕</button></div></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+(ev.narrative||"").slice(0,60)+"…</div>"+(ev.choices&&ev.choices.length?"<div style=\"font-size:0.7rem;color:var(--txt-d);\">"+ev.choices.length+" 选项</div>":"")+"</div>";}).join("");
  };

  window.aiGenEvents = async function(){
    try{
      showLoading("生成事件中...",20);
      var ctx=P.scenarios.find(function(s){return s.id===editingScenarioId;});
      var existEvt=(P.events||[]).filter(function(x){return x.sid===editingScenarioId;}).map(function(x){return x.name;});
      var existNoteE=existEvt.length?"已有事件（不得重复）："+existEvt.join("、")+"\n":"";
      var c=await callAISmart("为\""+(ctx?ctx.name:"")+"\" 生成3事件。"+existNoteE+"JSON:[{\"name\":\"\",\"narrative\":\"事件200字\",\"triggerTurn\":0,\"oneTime\":true,\"choices\":[{\"text\":\"\",\"effect\":{}}]}]",2000,{minLength:400,validator:function(c){try{var jm=extractJSONMatch(c,'array');if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
      var jm=extractJSONMatch(c,'array');
      if(jm){
        JSON.parse(jm[0]).forEach(function(ev){P.events.push({sid:editingScenarioId,id:uid(),name:ev.name||"",type:"scripted",triggerTurn:ev.triggerTurn||0,oneTime:true,triggered:false,narrative:ev.narrative||"",choices:ev.choices||[]});});
        renderEdTab("t-evt");hideLoading();toast("✅");
      }
    }catch(e){
      if(window.TM && TM.errors) TM.errors.capture(e, 'editor-details.aiGenEvents');
      hideLoading();toast("失败");
    }
  };

  // 党派详细编辑
  window.renderFacTab = function(em,sid){
    var list=P.factions.filter(function(f){return f.sid===sid;});
    em.innerHTML="<h4 style=\"color:var(--gold);\">党派 ("+list.length+")</h4>"+
      "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"P.factions.push({sid:editingScenarioId,name:'新',leader:'',desc:'',color:'#888',traits:[],strength:50,territory:'',ideology:'',courtInfluence:50,popularInfluence:30,members:'',partyRelations:''});renderEdTab('t-fac');\">＋</button><button class=\"bai\" onclick=\"aiGenFac()\">🤖</button></div>"+
      list.map(function(f){var i=P.factions.indexOf(f);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+f.name+"</strong><div><button class=\"bs bsm\" onclick=\"editFac("+i+")\">编辑</button> <button class=\"bd bsm\" onclick=\"P.factions.splice("+i+",1);renderEdTab('t-fac');\">✕</button></div></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+f.desc+"</div></div>";}).join("")||"<div style=\"color:var(--txt-d);\">暂无</div>";
  };

  // 阶层详细编辑
  window.renderClassTab = function(em,sid){
    var list=P.classes.filter(function(c){return c.sid===sid;});
    em.innerHTML="<h4 style=\"color:var(--gold);\">阶层 ("+list.length+")</h4>"+
      "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"P.classes.push({sid:editingScenarioId,name:'新',desc:'',privileges:'',restrictions:'',population:'',influence:50});renderEdTab('t-class');\">＋</button><button class=\"bai\" onclick=\"aiGenClasses()\">🤖</button></div>"+
      list.map(function(c){var i=P.classes.indexOf(c);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+c.name+"</strong><div><button class=\"bs bsm\" onclick=\"editClass2("+i+")\">编辑</button> <button class=\"bd bsm\" onclick=\"P.classes.splice("+i+",1);renderEdTab('t-class');\">✕</button></div></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+c.desc+" | 影响:"+c.influence+"</div></div>";}).join("")||"<div style=\"color:var(--txt-d);\">暂无</div>";
  };

  window.editClass2 = function(i){
    var c=P.classes[i];
    _$("em").innerHTML="<div class=\"cd\"><h4>编辑阶层</h4>"+
      "<div class=\"rw\"><div class=\"fd\"><label>名称</label><input value=\""+c.name+"\" onchange=\"P.classes["+i+"].name=this.value\"></div><div class=\"fd q\"><label>影响力</label><input type=\"number\" value=\""+c.influence+"\" onchange=\"P.classes["+i+"].influence=+this.value\"></div></div>"+
      "<div class=\"fd full\"><label>描述</label><textarea rows=\"2\" onchange=\"P.classes["+i+"].desc=this.value\">"+c.desc+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>特权</label><textarea rows=\"2\" onchange=\"P.classes["+i+"].privileges=this.value\">"+(c.privileges||"")+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>限制</label><textarea rows=\"2\" onchange=\"P.classes["+i+"].restrictions=this.value\">"+(c.restrictions||"")+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>人口比例</label><input value=\""+(c.population||"")+"\" onchange=\"P.classes["+i+"].population=this.value\"></div>"+
      "<button class=\"bt bp\" onclick=\"renderEdTab('t-class');toast('已保存')\" style=\"margin-top:0.5rem;\">完成</button></div>";
  };

  window.aiGenClasses = async function(){
    showLoading("生成阶层中...",20);
    try{
      var ctx=P.scenarios.find(function(s){return s.id===editingScenarioId;});
      var existCls=P.classes.filter(function(x){return x.sid===editingScenarioId;}).map(function(x){return x.name;});
      var existNoteCl=existCls.length?"已有阶层（不得重复）："+existCls.join("、")+"\n":"";
      var c=await callAISmart("为"+(ctx?ctx.name:"")+"生成3-6阶层。"+existNoteCl+"JSON:[{\"name\":\"\",\"desc\":\"\",\"privileges\":\"\",\"restrictions\":\"\",\"population\":\"\",\"influence\":50}]",1500,{minLength:200,validator:function(c){try{var jm=extractJSONMatch(c,'array');if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=3;}catch(e){return false;}}});
      var jm=extractJSONMatch(c,'array');
      if(jm){
        JSON.parse(jm[0]).forEach(function(cl){P.classes.push({sid:editingScenarioId,name:cl.name||"",desc:cl.desc||"",privileges:cl.privileges||"",restrictions:cl.restrictions||"",population:cl.population||"",influence:cl.influence||50});});
        renderEdTab("t-class");toast("✅");
      }
    }catch(e){
      if(window.TM && TM.errors) TM.errors.capture(e, 'editor-details.aiGenClasses');
      toast("失败");
    }finally{hideLoading();}
  };

  // 世界设定
  window.renderWldTab = function(em,sid){
    if(!P.world.entries)P.world.entries=[];
    if(P.world.entries.length===0){
      ["history","politics","economy","military","culture","glossary"].forEach(function(k){
        if(P.world[k])P.world.entries.push({sid:sid,category:k,content:P.world[k],tags:[]});
      });
    }
    var entries=P.world.entries.filter(function(e){return!e.sid||e.sid===sid;});
    em.innerHTML="<h4 style=\"color:var(--gold);\">世界设定</h4><div style=\"font-size:0.8rem;color:var(--txt-d);margin-bottom:0.8rem;\">自由编辑，每条可自定义分类。AI推演时全部读取。</div>"+
      "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"if(!P.world.entries)P.world.entries=[];P.world.entries.push({sid:editingScenarioId,category:'新',content:'',tags:[]});renderEdTab('t-wld');\">＋ 新增</button><button class=\"bai\" onclick=\"aiGenWorld()\">🤖 AI生成</button></div>"+
      entries.map(function(entry){var i=P.world.entries.indexOf(entry);return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;margin-bottom:0.3rem;\"><input value=\""+(entry.category||"")+"\" placeholder=\"分类\" style=\"width:120px;font-weight:700;\" onchange=\"P.world.entries["+i+"].category=this.value\"><button class=\"bd bsm\" onclick=\"P.world.entries.splice("+i+",1);renderEdTab('t-wld');\">✕</button></div><textarea rows=\"4\" style=\"width:100%;\" onchange=\"P.world.entries["+i+"].content=this.value\">"+entry.content+"</textarea></div>";}).join("")+
      "<hr class=\"dv\"><div style=\"font-size:0.95rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;\">运行逻辑</div>"+
      "<div class=\"fd full\"><label>世界规则</label><textarea rows=\"5\" onchange=\"P.world.rules=this.value\" placeholder=\"定义世界运作规则\">"+(P.world.rules||"")+"</textarea></div>";
  };

  window.aiGenWorld = async function(){
    try{
      showLoading("生成世界中...",20);
      var ctx=P.scenarios.find(function(s){return s.id===editingScenarioId;});
      var existWld=(P.worldEvents||[]).filter(function(x){return x.sid===editingScenarioId;}).map(function(x){return x.name||x.title||"";});
      var existNoteW=existWld.length?"已有世界设定（不得重复）："+existWld.join("、")+"\n":"";
      var c=await callAISmart("为\""+(ctx?ctx.name:"")+"\" 生成世界观。"+existNoteW+"JSON:[{\"category\":\"\",\"content\":\"详细200-400字\"}]\n6个分类",3000,{minLength:800,validator:function(c){try{var jm=extractJSONMatch(c,'array');if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=6;}catch(e){return false;}}});
      var jm=extractJSONMatch(c,'array');
      if(jm){
        if(!P.world.entries)P.world.entries=[];
        JSON.parse(jm[0]).forEach(function(e){P.world.entries.push({sid:editingScenarioId,category:e.category||"",content:e.content||"",tags:[]});});
        renderEdTab("t-wld");hideLoading();toast("✅");
      }
    }catch(e){
      if(window.TM && TM.errors) TM.errors.capture(e, 'editor-details.aiGenWorld');
      hideLoading();toast("失败");
    }
  };

  // 科技树
  window.renderTechTab = function(em,sid){
    var list=P.techTree.filter(function(t){return t.sid===sid;});
    em.innerHTML="<h4 style=\"color:var(--gold);\">科技树 ("+list.length+")</h4>"+
      "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.8rem;\"><button class=\"bt bp\" onclick=\"P.techTree.push({sid:editingScenarioId,name:'新',desc:'',prereqs:[],costs:[],effect:{},era:'初级',unlocked:false});renderEdTab('t-tech');\">＋</button><button class=\"bai\" onclick=\"aiGenTech()\">🤖</button></div>"+
      list.map(function(t){var i=P.techTree.indexOf(t);var costStr=(t.costs||[]).map(function(c){return c.variable+":"+c.amount;}).join(", ");
        return "<div class=\"cd\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+t.name+"</strong> <span class=\"tg\">"+t.era+"</span><div><button class=\"bs bsm\" onclick=\"editTech2("+i+")\">编辑</button> <button class=\"bd bsm\" onclick=\"P.techTree.splice("+i+",1);renderEdTab('t-tech');\">✕</button></div></div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+t.desc+"</div>"+(costStr?"<div style=\"font-size:0.7rem;color:var(--txt-d);\">消耗: "+costStr+"</div>":"")+"</div>";}).join("")||"<div style=\"color:var(--txt-d);\">暂无</div>";
  };

  window.editTech2 = function(i){
    var t=P.techTree[i];var sid=editingScenarioId;var vars=P.variables.filter(function(v){return v.sid===sid;});
    if(!t.costs)t.costs=[];
    var costsHtml=t.costs.map(function(c,ci){var opts=vars.map(function(v){return "<option "+(v.name===c.variable?"selected":"")+">"+v.name+"</option>";}).join("");return "<div style=\"display:flex;gap:0.3rem;margin-bottom:0.2rem;\"><select onchange=\"P.techTree["+i+"].costs["+ci+"].variable=this.value\" style=\"flex:1;\">"+opts+"</select><input type=\"number\" value=\""+c.amount+"\" style=\"width:60px;\" onchange=\"P.techTree["+i+"].costs["+ci+"].amount=+this.value\"><button class=\"bd bsm\" onclick=\"P.techTree["+i+"].costs.splice("+ci+",1);editTech2("+i+");\">✕</button></div>";}).join("");
    _$("em").innerHTML="<div class=\"cd\"><h4>编辑科技</h4>"+
      "<div class=\"rw\"><div class=\"fd\"><label>名称</label><input value=\""+t.name+"\" onchange=\"P.techTree["+i+"].name=this.value\"></div><div class=\"fd q\"><label>时代</label><select onchange=\"P.techTree["+i+"].era=this.value\"><option "+(t.era==="初级"?"selected":"")+">初级</option><option "+(t.era==="中级"?"selected":"")+">中级</option><option "+(t.era==="高级"?"selected":"")+">高级</option></select></div></div>"+
      "<div class=\"fd full\"><label>描述</label><textarea rows=\"2\" onchange=\"P.techTree["+i+"].desc=this.value\">"+t.desc+"</textarea></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>前置(逗号)</label><input value=\""+(t.prereqs||[]).join(",")+"\" onchange=\"P.techTree["+i+"].prereqs=this.value.split(',').map(function(s){return s.trim();}).filter(Boolean)\"></div>"+
      "<div class=\"fd full\" style=\"margin-top:0.3rem;\"><label>效果(变量:值)</label><input value=\""+Object.entries(t.effect||{}).map(function(e){return e[0]+":"+e[1];}).join(",")+"\" onchange=\"var o={};this.value.split(',').forEach(function(p){var kv=p.split(':');if(kv[0]&&kv[1])o[kv[0].trim()]=parseInt(kv[1])||0;});P.techTree["+i+"].effect=o;\"></div>"+
      "<hr class=\"dv\"><div style=\"font-weight:700;color:var(--gold);margin-bottom:0.3rem;\">解锁消耗</div>"+costsHtml+
      "<button class=\"bt bs bsm\" onclick=\"P.techTree["+i+"].costs.push({variable:'"+(vars[0]?vars[0].name:"")+"',amount:10});editTech2("+i+");\">＋ 添加</button>"+
      "<br><button class=\"bt bp\" onclick=\"renderEdTab('t-tech');toast('已保存')\" style=\"margin-top:0.5rem;\">完成</button></div>";
  };

  window.aiGenTech = async function(){
    showLoading("生成科技中...",20);
    try{
      var ctx=P.scenarios.find(function(s){return s.id===editingScenarioId;});
      var existTech=[].concat(P.techTree&&P.techTree.military?P.techTree.military:[]).concat(P.techTree&&P.techTree.civil?P.techTree.civil:[]).filter(function(x){return !x.sid||x.sid===editingScenarioId;}).map(function(x){return x.name;});
      var existNoteT=existTech.length?"已有科技（不得重复）："+existTech.join("、")+"\n":"";
      var c=await callAISmart("为"+(ctx?ctx.name:"")+"生成8科技。"+existNoteT+"JSON:[{\"name\":\"\",\"desc\":\"\",\"prereqs\":[],\"costs\":[{\"variable\":\"经济实力\",\"amount\":20}],\"effect\":{},\"era\":\"初级/中级/高级\"}]",2000,{minLength:400,validator:function(c){try{var jm=extractJSONMatch(c,'array');if(!jm)return false;var arr=JSON.parse(jm[0]);return Array.isArray(arr)&&arr.length>=8;}catch(e){return false;}}});
      var jm=extractJSONMatch(c,'array');
      if(jm){
        JSON.parse(jm[0]).forEach(function(t){P.techTree.push({sid:editingScenarioId,name:t.name||"",desc:t.desc||"",prereqs:t.prereqs||[],costs:t.costs||[],effect:t.effect||{},era:t.era||"初级",unlocked:false});});
        renderEdTab("t-tech");toast("✅");
      }
    }catch(e){
      if(window.TM && TM.errors) TM.errors.capture(e, 'editor-details.aiGenTech');
      toast("失败");
    }finally{hideLoading();}
  };

})();
