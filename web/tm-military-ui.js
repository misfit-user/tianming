// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-military-ui.js — 军事系统编辑器 UI（添加/编辑部队、军事 tab 渲染、AI 生成）
 *
 * 来源：2026-04-24 R18 从 tm-patches.js:2092-2174 抽离
 *
 * 导出（挂到 window 全局）：
 *   migrateMilUnits()        — 旧存档 units[] → troops[] 向后兼容
 *   addArmy()                — 打开"添加部队"模态框
 *   editArmy(i)              — 编辑部队 i（按 P.military.armies 索引）
 *   renderMilTab(em, sid)    — 渲染军事编辑器 tab（覆盖 game-engine 的版本）
 *   aiGenMil()               — AI 生成军事体系（异步）
 *
 * 依赖：
 *   - P.military 数据结构（troops/facilities/organization/campaigns/armies）
*   - openGenericModal/closeGenericModal（tm-ui-foundation.js）
*   - gv（tm-ui-foundation.js）
 *   - toast / renderEdTab / editingScenarioId（tm-game-engine.js）
 *   - callAISmart / showLoading / hideLoading / _dbg（tm-utils.js）
 *   - milSubLabels、addMilItem、editMilItem、deleteMilItem（旧 data-model 或 patches）
 *
 * 兼容性：原 tm-patches.js:2092-2174 保留相同代码作双保险——
 * 后加载的会覆盖，若未来确认加载顺序稳定可删除 tm-patches.js 的副本。
 * ============================================================ */

// 向后兼容：旧存档的 units[] 迁移到 troops[]
function migrateMilUnits(){
  if(P.military.units&&P.military.units.length>0&&(!P.military.troops||P.military.troops.length===0)){
    P.military.troops=P.military.units.map(function(u){return{sid:u.sid,name:u.name,type:u.type||"",description:(u.desc||"")+(u.atk?" A:"+u.atk+" D:"+u.def+" S:"+u.spd:"")};});
  }
  if(!P.military.troops)P.military.troops=[];
  if(!P.military.facilities)P.military.facilities=[];
  if(!P.military.organization)P.military.organization=[];
  if(!P.military.campaigns)P.military.campaigns=[];
}

// 编辑器内裁撤部队(场景设计·非 gameplay)·命名 handler 取代裸内联 splice·补反馈 toast(与 addArmy/editArmy 一致·无 EditHistory:本军务编辑器走 P.military 非 scriptData·新增也不入撤销账·保持一致)
// 注:gameplay(对局中)裁军走诏书/朝议→AI military_changes 制度通道(tm-ai-change-applier 校验器扫裁军动词)·非裸 UI 删·本 handler 仅服务编辑器 authoring
function disbandArmyInEditor(i){
  var arr = (typeof P !== 'undefined' && P.military) ? P.military.armies : null;
  if (!Array.isArray(arr) || i < 0 || i >= arr.length) return;
  var nm = (arr[i] && arr[i].name) || ('部队' + i);
  arr.splice(i, 1);
  if (typeof renderEdTab === 'function') renderEdTab('t-mil');
  if (typeof toast === 'function') toast('已解散 ' + nm);
}
function addArmy(){
  var body='<div class="form-group"><label>部队名</label><input type="text" id="gm_name"></div>'+
    '<div class="form-group"><label>统帅</label><input type="text" id="gm_cmdr"></div>'+
    '<div class="form-group"><label>驻地</label><input type="text" id="gm_loc"></div>'+
    '<div class="form-group"><label>士气</label><input type="number" id="gm_morale" value="70" min="0" max="100"></div>'+
    '<div class="form-group"><label>补给</label><input type="number" id="gm_supply" value="80" min="0" max="100"></div>';
  openGenericModal("添加部队",body,function(){
    var n=gv("gm_name");if(!n){toast("请输入名称");return;}
    P.military.armies.push({sid:editingScenarioId,name:n,units:[],morale:+(document.getElementById("gm_morale").value)||70,supply:+(document.getElementById("gm_supply").value)||80,location:gv("gm_loc"),commander:gv("gm_cmdr")});
    closeGenericModal();renderEdTab("t-mil");toast("已添加");
  });
}

function editArmy(i){
  var a=P.military.armies[i];
  // 剧本隔离根治：势力下拉只读当前局 GM.facs(单剧本)·不读多剧本 P 库·无局时按 sid 过滤兜底
  var _facSrc = (typeof GM!=='undefined' && GM && Array.isArray(GM.facs) && GM.facs.length) ? GM.facs
    : (typeof _tmActiveScenarioRows==='function' ? _tmActiveScenarioRows(P.factions||P.facs||[]) : (P.factions||P.facs||[]));
  var _facList = _facSrc.filter(function(f){return f && f.name;});
  var _facOpts = '<option value="">（未指定）</option>' + _facList.map(function(f){
    var sel = (a.faction === f.name) ? ' selected' : '';
    return '<option value="' + f.name.replace(/"/g,'&quot;') + '"' + sel + '>' + f.name + (f.isPlayer?' ★本朝':'') + '</option>';
  }).join('');
  var body='<div class="form-group"><label>部队名</label><input type="text" id="gm_name" value="'+(a.name||"").replace(/"/g,'&quot;')+'"></div>'+
    '<div class="form-group"><label>所属势力</label><select id="gm_faction">'+_facOpts+'</select>'+
    '<div style="font-size:0.75rem;color:var(--ink-300);margin-top:2px;">★ 决定部队敌我·跨势力不能任命本朝官员为统帅</div></div>'+
    '<div class="form-group"><label>统帅</label><input type="text" id="gm_cmdr" value="'+(a.commander||"").replace(/"/g,'&quot;')+'"></div>'+
    '<div class="form-group"><label>兵种</label><input type="text" id="gm_type" value="'+(a.type||"").replace(/"/g,'&quot;')+'" placeholder="步兵/骑兵/水军/禁军..."></div>'+
    '<div class="form-group"><label>兵力</label><input type="number" id="gm_size" value="'+(a.size||a.soldiers||a.strength||0)+'" min="0"></div>'+
    '<div class="form-group"><label>驻地</label><input type="text" id="gm_loc" value="'+(a.location||"").replace(/"/g,'&quot;')+'"></div>'+
    '<div class="form-group"><label>士气</label><input type="number" id="gm_morale" value="'+(a.morale!=null?a.morale:70)+'" min="0" max="100"></div>'+
    '<div class="form-group"><label>补给</label><input type="number" id="gm_supply" value="'+(a.supply!=null?a.supply:80)+'" min="0" max="100"></div>';
  openGenericModal("编辑部队",body,function(){
    a.name=gv("gm_name");a.commander=gv("gm_cmdr");a.location=gv("gm_loc");
    // [Slice J·2026-05-10] 走 Membership API·替代直接 a.faction= 写
    var _newFac = gv("gm_faction") || "";
    if (window.TM && window.TM.FactionMembership && window.TM.FactionMembership.assignArmy) {
      window.TM.FactionMembership.assignArmy(a, _newFac, { reason: '军事编辑器手动改归属' });
    } else {
      a.faction = _newFac;
    }
    a.type=gv("gm_type")||a.type||"";
    var _sz = +(document.getElementById("gm_size").value)||0;
    if (_sz > 0) { a.size = _sz; a.soldiers = _sz; }
    a.morale=+(document.getElementById("gm_morale").value)||70;
    a.supply=+(document.getElementById("gm_supply").value)||80;
    closeGenericModal();renderEdTab("t-mil");toast("已保存");
  });
}

// 注意：renderMilTab 是重定义（覆盖 game-engine 的旧版本）
if (typeof window !== 'undefined') {
  window.renderMilTab = function(em,sid){
    migrateMilUnits();
    var h="<h4 style=\"color:var(--gold);\">军事</h4>"+
      "<button class=\"bai\" onclick=\"aiGenMil()\" style=\"margin-bottom:0.8rem;\">🤖 AI生成军事体系</button>"+
      "<div class=\"cd\"><h4>军制</h4><textarea rows=\"3\" onchange=\"P.military.systemDesc=this.value\">"+(P.military.systemDesc||"")+"</textarea></div>"+
      "<div class=\"cd\"><h4>补给</h4><textarea rows=\"2\" onchange=\"P.military.supplyDesc=this.value\">"+(P.military.supplyDesc||"")+"</textarea></div>"+
      "<div class=\"cd\"><h4>战斗</h4><textarea rows=\"2\" onchange=\"P.military.battleDesc=this.value\">"+(P.military.battleDesc||"")+"</textarea></div>";
    var mk=["troops","facilities","organization","campaigns"];
    for(var x=0;x<mk.length;x++){
      var k=mk[x];var items=P.military[k].filter(function(it){return it.sid===sid;});
      h+="<div class=\"cd\"><h4>"+milSubLabels[k]+" ("+items.length+")</h4><button class=\"bt bp bsm\" onclick=\"addMilItem('"+k+"')\">＋</button>";
      h+=items.map(function(it){var idx=P.military[k].indexOf(it);return "<div style=\"background:var(--bg-3);border-radius:4px;padding:0.4rem;margin-top:0.3rem;display:flex;justify-content:space-between;align-items:center;\">"+
        "<div><strong>"+it.name+"</strong>"+(it.type?" <span class=\"tg\">"+it.type+"</span>":"")+"</div>"+
        "<div style=\"display:flex;gap:0.3rem;\"><button class=\"bt bs bsm\" onclick=\"editMilItem('"+k+"',"+idx+")\">✎</button><button class=\"bd bsm\" onclick=\"deleteMilItem('"+k+"',"+idx+")\">✕</button></div></div>";}).join("")+"</div>";
    }
    var armies=P.military.armies.filter(function(a){return a.sid===sid;});
    h+="<div class=\"cd\"><h4>部队 ("+armies.length+")</h4><button class=\"bt bp bsm\" onclick=\"addArmy()\">＋</button>";
    h+=armies.map(function(a){var i=P.military.armies.indexOf(a);
      var _facChip = a.faction ? '<span style="background:rgba(90,111,168,0.3);color:#c9c0e6;padding:1px 6px;border-radius:3px;font-size:0.72rem;margin-left:4px;">'+a.faction+'</span>' : '<span style="color:#9e8862;font-size:0.72rem;margin-left:4px;">无势力</span>';
      var _szTxt = (a.size||a.soldiers||a.strength) ? ' 兵'+(a.size||a.soldiers||a.strength) : '';
      return "<div style=\"background:var(--bg-3);border-radius:4px;padding:0.4rem;margin-top:0.3rem;display:flex;justify-content:space-between;align-items:center;\">"+
      "<div><strong>"+a.name+"</strong>"+_facChip+" 统帅:"+(a.commander||"无")+_szTxt+" 士气:"+a.morale+"</div>"+
      "<div style=\"display:flex;gap:0.3rem;\"><button class=\"bt bs bsm\" onclick=\"editArmy("+i+")\">✎</button><button class=\"bd bsm\" onclick=\"disbandArmyInEditor("+i+")\">✕</button></div></div>";}).join("")+"</div>";
    em.innerHTML=h;
  };
}

// AI军事生成（适配新数据模型：troops替代units）
async function aiGenMil(){
  try{
    showLoading("生成军事中...",20);
    var ctx=P.scenarios.find(function(s){return s.id===editingScenarioId;});
    var _mil=P.military||{};
    var existMil=[].concat(_mil.troops||[]).concat(_mil.facilities||[]).concat(_mil.organization||[]).concat(_mil.campaigns||[]).filter(function(x){return !x.sid||x.sid===editingScenarioId;}).map(function(x){return x.name;});
    var existNoteM=existMil.length?"已有军事（不得重复）："+existMil.join("、")+"\n":"";
    var existArmies=(_mil.armies||[]).filter(function(a){return !a.sid||a.sid===editingScenarioId;}).map(function(a){return a.name;});
    var existArmiesNote=existArmies.length?"已有部队（不得重复）："+existArmies.join("、")+"\n":"";
    var c=await callAISmart("为\""+(ctx?ctx.name:"")+"\"("+(ctx?ctx.era:"")+") 生成军事体系。"+existNoteM+existArmiesNote+
      "\n\nJSON格式：{\"systemDesc\":\"\",\"supplyDesc\":\"\",\"battleDesc\":\"\",\"troops\":[{\"name\":\"\",\"type\":\"\",\"description\":\"\"}],\"facilities\":[{\"name\":\"\",\"type\":\"\",\"description\":\"\"}],\"organization\":[{\"name\":\"\",\"type\":\"\",\"description\":\"\"}],\"campaigns\":[{\"name\":\"\",\"type\":\"\",\"description\":\"\"}],\"armies\":[{\"name\":\"\",\"commander\":\"\",\"location\":\"\",\"morale\":70,\"supply\":80,\"size\":10000,\"type\":\"\",\"equipment\":[]}]}\n\n要求：\n1. troops/facilities/organization/campaigns各至少3项\n2. armies为实际部队（5-8支），每支部队必须包含：\n   - name: 部队名称（如\"禁军\"、\"羽林军\"等）\n   - type: 兵种（如\"步兵\"、\"骑兵\"、\"水军\"等）\n   - size: 部队人数（3000-50000之间的具体数字，禁军8000-15000，地方军3000-8000，主力军15000-50000）\n   - commander: 统帅姓名（真实历史人物）\n   - location: 驻地\n   - equipment: 装备数组，至少2-3项（如[\"铁甲\",\"长矛\",\"弓弩\"]）\n   - morale: 士气（60-90）\n   - supply: 补给（60-90）\n\n只输出JSON。",
      2500,
      {minLength:800,validator:function(c){try{var d=extractJSON(c);return !!(d&&d.armies&&Array.isArray(d.armies)&&d.armies.length>=5&&d.armies.every(function(a){return a.size&&a.size>0;}));}catch(e){return false;}}});
    var d=extractJSON(c);
    if(d&&typeof d==='object'&&!Array.isArray(d)){
      if(d.systemDesc)P.military.systemDesc=d.systemDesc;
      if(d.supplyDesc)P.military.supplyDesc=d.supplyDesc;
      if(d.battleDesc)P.military.battleDesc=d.battleDesc;
      var sid=editingScenarioId;
      var mk=["troops","facilities","organization","campaigns"];
      mk.forEach(function(k){(d[k]||[]).forEach(function(it){P.military[k].push({sid:sid,name:it.name||"",type:it.type||"",description:it.description||""});});});
      var addedArmies=0;
      (d.armies||[]).forEach(function(a){
        if(a.size&&a.size>0){
          P.military.armies.push({sid:sid,name:a.name||"",units:[],morale:a.morale||70,supply:a.supply||80,size:a.size||5000,type:a.type||"步兵",equipment:a.equipment||[],location:a.location||"",commander:a.commander||""});
          addedArmies++;
        }
      });
      if(typeof _dbg==='function')_dbg('[aiGenMil] 生成完成，新增部队',addedArmies,'支');
      renderEdTab("t-mil");
      hideLoading();
      toast("✅ 生成"+addedArmies+"支部队");
    }
  }catch(e){
    console.error('[aiGenMil] 生成失败：',e);
    if(window.TM && TM.errors) TM.errors.capture(e, 'military-ui.aiGenMil');
    hideLoading();
    toast("失败");
  }
}
