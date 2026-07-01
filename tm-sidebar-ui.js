// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-sidebar-ui.js — 侧栏面板 + 科技/市政/详情 + 宫殿 UI（§F 渲染层）
//
// R99 从 tm-endturn.js 抽出·原 L13287-14155 (869 行)
// 包含：
//   enterGame:after hook (触发 renderSidePanels)
//   科技树/市政树：renderGameTech / unlockTech / renderGameCivic / adoptCivic
//   阶层/党派/军事 详情：openClassDetailPanel / openPartyDetailPanel / openMilitaryDetailPanel
//   侧栏主渲染：renderSidePanels (~348 行)
//   宫殿面板：openPalacePanel + 6 辅助 (_palaceAction/_palaceRenovateModal/
//            _palaceSubmitReno/_palaceReassignModal/_palaceSubmitReassign/_palaceNewBuild)
//
// 外部调用：renderGameTech/Civic 各 2+·openClassDetailPanel 等各 1·renderSidePanels 2
// 依赖外部：GM / P / _$ / toast / openGenericModal / GameHooks / findTechByName 等
//
// 加载顺序：必须在 tm-endturn.js 之前
// ============================================================

// ============================================================
//  游戏内科技树/市政树面板
// ============================================================
// enterGame后渲染侧边面板（科技/市政/人物志已移入renderGameState）
GameHooks.on('enterGame:after', function(){
  renderSidePanels();
});

function tmSidebarFullTextAttr(value, always) {
  if (typeof window !== 'undefined' && typeof window.tmFullTextAttr === 'function') {
    return window.tmFullTextAttr(value, always !== false);
  }
  var v = String(value == null ? '' : value).trim();
  return v ? ' title="' + escHtml(v) + '"' : '';
}

function renderGameTech(){
  var el=_$("g-tech");if(!el||!GM.techTree)return;
  el.innerHTML=GM.techTree.map(function(t,i){
    var canUnlock=true;
    var costDesc=(t.costs||[]).map(function(c){var v=GM.vars[c.variable];var ok=v&&v.value>=c.amount;if(!ok)canUnlock=false;return "<span style=\"color:"+(ok?"var(--green)":"var(--red)")+";\">"+c.variable+":"+c.amount+(v?" ("+v.value+")":"")+"</span>";}).join(" ");
    if(t.prereqs)t.prereqs.forEach(function(pre){var pt=findTechByName(pre);if(!pt||!pt.unlocked)canUnlock=false;});
    var prereqDesc='';
    if(t.prereqs&&t.prereqs.length>0&&!t.unlocked){prereqDesc='<div style="font-size:0.71rem;color:var(--txt-d);">\u524D\u7F6E: '+t.prereqs.map(function(p){var pt=findTechByName(p);return '<span style="color:'+(pt&&pt.unlocked?'var(--green)':'var(--red)')+';">'+escHtml(p)+'</span>';}).join(', ')+'</div>';}
    return "<div class=\"cd\" style=\"border-left:3px solid "+(t.unlocked?"var(--green)":"var(--bdr)")+";\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+t.name+(t.era?' <span style=\"font-size:0.71rem;color:var(--txt-d);\">['+t.era+']</span>':'')+"</strong>"+(t.unlocked?"<span class=\"tg\" style=\"background:rgba(39,174,96,0.2);color:var(--green);\">\u2705</span>":canUnlock?"<button class=\"bt bp bsm\" onclick=\"unlockTech("+i+")\">\u89E3\u9501</button>":"")+"</div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+(t.desc||t.description||'')+"</div>"+prereqDesc+(!t.unlocked&&costDesc?"<div style=\"font-size:0.72rem;margin-top:0.2rem;\">\u6D88\u8017: "+costDesc+"</div>":"")+"</div>";
  }).join("")||"<div style=\"color:var(--txt-d);\">\u65E0</div>";
}
function unlockTech(i){
  var t=GM.techTree[i];if(!t||t.unlocked)return;
  var ok=true;(t.costs||[]).forEach(function(c){if(!GM.vars[c.variable]||GM.vars[c.variable].value<c.amount)ok=false;});
  if(!ok){toast("\u8D44\u6E90\u4E0D\u8DB3");return;}
  (t.costs||[]).forEach(function(c){GM.vars[c.variable].value-=c.amount;});
  t.unlocked=true;
  Object.entries(t.effect||{}).forEach(function(e){if(GM.vars[e[0]])GM.vars[e[0]].value=clamp(GM.vars[e[0]].value+e[1],GM.vars[e[0]].min,GM.vars[e[0]].max);});
  addEB("\u79D1\u6280",t.name+"\u5DF2\u89E3\u9501");renderGameTech();renderGameState();toast("\u2705 "+t.name);
}

function renderGameCivic(){
  var el=_$("g-civic");if(!el||!GM.civicTree)return;
  el.innerHTML=GM.civicTree.map(function(c,i){
    var canAdopt=true;
    // 前置依赖检查（与科技树一致）
    if(c.prereqs&&c.prereqs.length>0){
      c.prereqs.forEach(function(pre){
        var pt=GM.civicTree.find(function(x){return x.name===pre;});
        if(!pt||!pt.adopted)canAdopt=false;
      });
    }
    var costDesc=(c.costs||[]).map(function(ct){var v=GM.vars[ct.variable];var ok=v&&v.value>=ct.amount;if(!ok)canAdopt=false;return "<span style=\"color:"+(ok?"var(--green)":"var(--red)")+";\">"+ct.variable+":"+ct.amount+"</span>";}).join(" ");
    var prereqDesc='';
    if(c.prereqs&&c.prereqs.length>0&&!c.adopted){
      prereqDesc='<div style="font-size:0.71rem;color:var(--txt-d);">\u524D\u7F6E: '+c.prereqs.map(function(p){var pt=GM.civicTree.find(function(x){return x.name===p;});return '<span style="color:'+(pt&&pt.adopted?'var(--green)':'var(--red)')+';">'+escHtml(p)+'</span>';}).join(', ')+'</div>';
    }
    return "<div class=\"cd\" style=\"border-left:3px solid "+(c.adopted?"var(--green)":"var(--bdr)")+";\"><div style=\"display:flex;justify-content:space-between;\"><strong>"+c.name+"</strong>"+(c.adopted?"<span class=\"tg\" style=\"background:rgba(39,174,96,0.2);color:var(--green);\">\u2705</span>":canAdopt?"<button class=\"bt bp bsm\" onclick=\"adoptCivic("+i+")\">\u63A8\u884C</button>":"")+"</div><div style=\"font-size:0.78rem;color:var(--txt-s);\">"+(c.desc||c.description||'')+"</div>"+prereqDesc+(!c.adopted&&costDesc?"<div style=\"font-size:0.72rem;margin-top:0.2rem;\">\u6D88\u8017: "+costDesc+"</div>":"")+"</div>";
  }).join("")||"<div style=\"color:var(--txt-d);\">\u65E0</div>";
}
function adoptCivic(i){
  var c=GM.civicTree[i];if(!c||c.adopted)return;
  // 前置依赖检查
  if(c.prereqs&&c.prereqs.length>0){
    var prereqOk=true;
    c.prereqs.forEach(function(pre){var pt=GM.civicTree.find(function(x){return x.name===pre;});if(!pt||!pt.adopted)prereqOk=false;});
    if(!prereqOk){toast("\u524D\u7F6E\u653F\u7B56\u672A\u63A8\u884C");return;}
  }
  var ok=true;(c.costs||[]).forEach(function(ct){if(!GM.vars[ct.variable]||GM.vars[ct.variable].value<ct.amount)ok=false;});
  if(!ok){toast("\u8D44\u6E90\u4E0D\u8DB3");return;}
  (c.costs||[]).forEach(function(ct){GM.vars[ct.variable].value-=ct.amount;});
  c.adopted=true;
  Object.entries(c.effect||{}).forEach(function(e){if(GM.vars[e[0]])GM.vars[e[0]].value=clamp(GM.vars[e[0]].value+e[1],GM.vars[e[0]].min,GM.vars[e[0]].max);});
  addEB("\u5E02\u653F",c.name+"\u5DF2\u63A8\u884C");renderGameCivic();renderGameState();toast("\u2705 "+c.name);
}

// ══════ 人物志 UI 已迁移到 tm-renwu-ui.js (R98) ══════
// - var _rwSearch/_rwFaction/_rwRole/_rwSort/_rwShowDead
// - renderRenwu / _rwFacClass / _rwFacChipStyle / _rwRankChip
// - _rwLoyRing / _rwStatRow / _rwWcDot / _rwRenderCard
// - viewRenwu (人物详情弹窗 ~546 行)
// ═══════════════════════════════════════════════════════

// ============================================================
// ── 阶层详情面板 ──
function openClassDetailPanel() {
  if (!GM.classes || GM.classes.length === 0) { toast('\u6682\u65E0\u9636\u5C42\u6570\u636E'); return; }
  var html = '<div style="padding:1rem;max-height:80vh;overflow-y:auto;">';
  GM.classes.forEach(function(cl) {
    var sat = Math.round(cl.satisfaction || 50);
    var inf = cl.influence || cl.classInfluence || 0;
    var satClr = sat > 65 ? 'var(--green)' : sat < 35 ? 'var(--red)' : 'var(--gold)';
    html += '<div style="background:var(--bg-2);border-radius:6px;padding:0.8rem;margin-bottom:0.8rem;border-left:3px solid ' + satClr + ';">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">';
    html += '<span class="tm-class-full tm-fulltext-source" ' + tmSidebarFullTextAttr(cl.name, true) + ' style="font-weight:700;font-size:0.95rem;display:inline-block;max-width:260px;vertical-align:bottom;">' + escHtml(cl.name) + '</span>';
    html += '<div style="display:flex;gap:0.5rem;font-size:0.75rem;">';
    html += '<span style="color:' + satClr + ';">\u6EE1\u610F ' + sat + '</span>';
    html += '<span style="color:var(--blue);">\u5F71\u54CD ' + inf + '</span>';
    html += '</div></div>';
    // 详细信息网格
    var fields = [];
    if (cl.size) fields.push(['\u89C4\u6A21', cl.size]);
    if (cl.economicRole) fields.push(['\u7ECF\u6D4E\u89D2\u8272', cl.economicRole]);
    if (cl.status) fields.push(['\u6CD5\u5F8B\u5730\u4F4D', cl.status]);
    if (cl.mobility) fields.push(['\u6D41\u52A8\u6027', cl.mobility]);
    if (cl.privileges) fields.push(['\u7279\u6743', cl.privileges]);
    if (cl.obligations) fields.push(['\u4E49\u52A1', cl.obligations]);
    if (cl.unrestThreshold) fields.push(['\u4E0D\u6EE1\u9608\u503C', cl.unrestThreshold]);
    if (fields.length > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.78rem;margin-bottom:0.4rem;">';
      fields.forEach(function(f) {
        var fv = f[0] + ': ' + String(f[1]);
        html += '<div class="tm-class-full tm-fulltext-source" ' + tmSidebarFullTextAttr(fv, true) + '><span style="color:var(--txt-d);">' + f[0] + ':</span> ' + escHtml(String(f[1])) + '</div>';
      });
      html += '</div>';
    }
    if (cl.demands) {
      html += '<div class="tm-class-full tm-fulltext-source" ' + tmSidebarFullTextAttr('\u8BC9\u6C42: ' + cl.demands, true) + ' style="font-size:0.78rem;margin-bottom:0.3rem;"><span style="color:var(--red);">\u8BC9\u6C42:</span> ' + escHtml(cl.demands) + '</div>';
    }
    if (cl.description) {
      html += '<div class="tm-class-full" ' + tmSidebarFullTextAttr(cl.description, true) + ' style="font-size:0.76rem;color:var(--txt-s);line-height:1.5;">' + escHtml(cl.description) + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  openGenericModal('\u9636\u5C42\u8BE6\u60C5', html, null);
}

// ── 党派详情面板 ──
function openPartyDetailPanel() {
  if (!GM.parties || GM.parties.length === 0) { toast('\u6682\u65E0\u515A\u6D3E\u6570\u636E'); return; }
  var html = '<div style="padding:1rem;max-height:80vh;overflow-y:auto;">';
  GM.parties.forEach(function(p) {
    var inf = p.influence || p.strength || 0;
    var stClr = p.status === '\u6D3B\u8DC3' ? 'var(--green)' : p.status === '\u5F0F\u5FAE' ? 'var(--gold)' : p.status === '\u88AB\u538B\u5236' ? 'var(--red)' : 'var(--txt-d)';
    html += '<div style="background:var(--bg-2);border-radius:6px;padding:0.8rem;margin-bottom:0.8rem;border-left:3px solid var(--purple);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">';
    html += '<div><span class="tm-party-full tm-fulltext-source" ' + tmSidebarFullTextAttr(p.name, true) + ' style="font-weight:700;font-size:0.95rem;display:inline-block;max-width:260px;vertical-align:bottom;">' + escHtml(p.name) + '</span>';
    if (p.status) html += ' <span style="font-size:0.7rem;color:' + stClr + ';">' + escHtml(p.status) + '</span>';
    html += '</div>';
    html += '<span style="color:var(--purple);font-size:0.82rem;">\u5F71\u54CD ' + inf + '</span>';
    html += '</div>';
    // 核心信息
    var fields = [];
    if (p.leader) fields.push(['\u9996\u9886', p.leader]);
    if (p.ideology) fields.push(['\u7ACB\u573A', p.ideology]);
    if (p.rivalParty) fields.push(['\u5BBF\u654C', p.rivalParty]);
    if (p.org) fields.push(['\u7EC4\u7EC7\u5EA6', p.org]);
    if (p.base) fields.push(['\u652F\u6301\u7FA4\u4F53', p.base]);
    if (p.members) fields.push(['\u6838\u5FC3\u6210\u5458', p.members]);
    if (fields.length > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem;font-size:0.78rem;margin-bottom:0.4rem;">';
      fields.forEach(function(f) {
        var fv = f[0] + ': ' + String(f[1]);
        html += '<div class="tm-party-full tm-fulltext-source" ' + tmSidebarFullTextAttr(fv, true) + '><span style="color:var(--txt-d);">' + f[0] + ':</span> ' + escHtml(String(f[1])) + '</div>';
      });
      html += '</div>';
    }
    // 目标与议程
    var goals = [];
    if (p.currentAgenda) goals.push('\u5F53\u524D\u8BAE\u7A0B: ' + p.currentAgenda);
    if (p.shortGoal) goals.push('\u77ED\u671F\u76EE\u6807: ' + p.shortGoal);
    if (p.longGoal) goals.push('\u957F\u671F\u8FFD\u6C42: ' + p.longGoal);
    if (goals.length > 0) {
      html += '<div style="font-size:0.78rem;margin-bottom:0.3rem;">';
      goals.forEach(function(g) { html += '<div class="tm-party-full tm-fulltext-source" ' + tmSidebarFullTextAttr(g, true) + '>' + escHtml(g) + '</div>'; });
      html += '</div>';
    }
    // 政策立场标签
    if (p.policyStance) {
      var stances = Array.isArray(p.policyStance) ? p.policyStance : [p.policyStance];
      html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.3rem;">';
      stances.forEach(function(s) {
        html += '<span class="tm-party-full tm-fulltext-source" ' + tmSidebarFullTextAttr(s, true) + ' style="font-size:0.71rem;background:var(--bg-3);color:var(--txt-s);padding:1px 6px;border-radius:3px;display:inline-block;max-width:100%;">' + escHtml(s) + '</span>';
      });
      html += '</div>';
    }
    if (p.description) {
      html += '<div class="tm-party-full" ' + tmSidebarFullTextAttr(p.description, true) + ' style="font-size:0.76rem;color:var(--txt-s);line-height:1.5;">' + escHtml(p.description) + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  openGenericModal('\u515A\u6D3E\u8BE6\u60C5', html, null);
}

// ── 军事力量详情面板 ──
function openMilitaryDetailPanel() {
  var armies = (GM.armies || []).filter(function(a){return !a.destroyed;});
  if (armies.length === 0) { toast('\u6682\u65E0\u519B\u961F\u6570\u636E'); return; }

  // 按 armyType 分组
  var grouped = {};
  armies.forEach(function(a) {
    var t = a.armyType || a.type || '\u5176\u4ED6';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(a);
  });

  var totalSoldiers = armies.reduce(function(s,a){return s+(a.soldiers||a.size||a.strength||0);},0);
  var totalArmies = armies.length;
  var avgMorale = armies.reduce(function(s,a){return s+(a.morale||50);},0) / totalArmies;
  var avgTraining = armies.reduce(function(s,a){return s+(a.training||50);},0) / totalArmies;

  // 类型图标映射
  var typeIcons = {
    '\u7981\u519B': '\uD83C\uDFF0', '\u8FB9\u519B': '\u2694\uFE0F', '\u6C34\u5E08': '\u2693',
    '\u9A91\u5175': '\uD83D\uDC0E', '\u6B65\u5175': '\u2694\uFE0F', '\u706B\u5668\u5175': '\uD83D\uDCA5',
    '\u571F\u53F8\u5175': '\uD83C\uDF04', '\u6C11\u5175': '\u26CF\uFE0F', '\u5BB6\u4E01': '\uD83D\uDEE1\uFE0F',
    '\u5176\u4ED6': '\u2694\uFE0F'
  };

  var html = '<div class="military-detail-wrap" style="padding:1rem;max-height:80vh;overflow-y:auto;">';

  // ═══ 总览卡片 ═══
  html += '<div style="background:linear-gradient(135deg,rgba(184,154,83,0.15),rgba(139,46,37,0.1));border:1px solid var(--gold-d);border-radius:8px;padding:0.8rem;margin-bottom:1rem;display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;">';
  html += '<div><div style="font-size:0.7rem;color:var(--txt-d);">\u603B\u519B\u961F</div><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">' + totalArmies + '</div></div>';
  html += '<div><div style="font-size:0.7rem;color:var(--txt-d);">\u603B\u5175\u529B</div><div style="font-size:1.1rem;font-weight:700;color:var(--gold);">' + totalSoldiers.toLocaleString() + '</div></div>';
  html += '<div><div style="font-size:0.7rem;color:var(--txt-d);">\u5E73\u5747\u58EB\u6C14</div><div style="font-size:1.1rem;font-weight:700;color:' + (avgMorale>65?'var(--green)':avgMorale<40?'var(--red)':'var(--gold)') + ';">' + Math.round(avgMorale) + '</div></div>';
  html += '<div><div style="font-size:0.7rem;color:var(--txt-d);">\u5E73\u5747\u8BAD\u7EC3</div><div style="font-size:1.1rem;font-weight:700;color:' + (avgTraining>65?'var(--green)':avgTraining<40?'var(--red)':'var(--gold)') + ';">' + Math.round(avgTraining) + '</div></div>';
  html += '</div>';

  // ═══ 分组展示 ═══
  Object.keys(grouped).forEach(function(groupName) {
    var list = grouped[groupName];
    var gTotal = list.reduce(function(s,a){return s+(a.soldiers||a.size||a.strength||0);},0);
    var icon = typeIcons[groupName] || '\u2694\uFE0F';
    html += '<div style="margin-bottom:0.8rem;">';
    html += '<div class="tm-army-full tm-fulltext-source" ' + tmSidebarFullTextAttr(groupName + ' (' + list.length + '\u652F\u00B7\u5408\u8BA1' + gTotal.toLocaleString() + ')', true) + ' style="font-size:0.82rem;font-weight:700;color:var(--gold-400);margin-bottom:0.5rem;padding:4px 8px;background:rgba(184,154,83,0.08);border-left:3px solid var(--gold-d);border-radius:3px;">';
    html += icon + ' ' + escHtml(groupName) + ' <span style="font-size:0.71rem;color:var(--txt-d);font-weight:400;">(' + list.length + '\u652F\u00B7\u5408\u8BA1' + gTotal.toLocaleString() + ')</span>';
    html += '</div>';

    list.forEach(function(a) {
      var sol = a.soldiers || a.size || a.strength || 0;
      var mor = a.morale || 0, tra = a.training || 0, loy = a.loyalty || 50, ctrl = a.control || 50;
      var morClr = mor>65?'var(--green)':mor<40?'var(--red)':'var(--gold)';
      var traClr = tra>65?'var(--green)':tra<40?'var(--red)':'var(--gold)';
      var loyClr = loy>65?'var(--green)':loy<40?'var(--red)':'var(--gold)';
      var ctrlClr = ctrl>70?'var(--green)':ctrl<45?'var(--red)':'var(--gold)';
      var quality = a.quality || '';
      var qualClr = /精锐|精兵/.test(quality)?'var(--gold-400)':/普通|一般/.test(quality)?'var(--txt-s)':/弱|老/.test(quality)?'var(--red)':'var(--txt-d)';

      html += '<div style="background:var(--bg-2);border-radius:6px;padding:0.7rem;margin-bottom:0.6rem;border-left:3px solid ' + morClr + ';">';

      // 标题行：名称 + 兵力 + 品质
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;gap:0.5rem;">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div class="tm-army-full tm-fulltext-source" ' + tmSidebarFullTextAttr(a.name||'\u65E0\u540D', true) + ' style="font-weight:700;font-size:0.92rem;color:var(--gold);">' + escHtml(a.name||'\u65E0\u540D') + '</div>';
      if (quality) html += '<div class="tm-army-full tm-fulltext-source" ' + tmSidebarFullTextAttr(quality, true) + ' style="font-size:0.71rem;color:' + qualClr + ';margin-top:2px;">' + escHtml(quality) + '</div>';
      html += '</div>';
      html += '<div style="text-align:right;flex-shrink:0;">';
      html += '<div style="font-size:1.05rem;font-weight:700;color:var(--gold);">' + sol.toLocaleString() + '</div>';
      html += '<div style="font-size:0.66rem;color:var(--txt-d);">\u5175</div>';
      html += '</div>';
      html += '</div>';

      // 统帅+驻地
      var metaLines = [];
      if (a.commander) metaLines.push(['\uD83E\uDD34 \u7EDF\u5E05', (a.commanderTitle?a.commanderTitle+'\u00B7':'')+a.commander]);
      if (a.garrison || a.location) metaLines.push(['\uD83D\uDCCD \u9A7B\u5730', String(a.garrison||a.location)]);
      if (a.activity) metaLines.push(['\uD83D\uDCCB \u52A8\u6001', a.activity]);
      if (a.ethnicity) metaLines.push(['\uD83C\uDFF4 \u65CF\u7FA4', a.ethnicity]);
      if (a.equipmentCondition) metaLines.push(['\uD83D\uDEE1\uFE0F \u88C5\u5907', a.equipmentCondition]);
      if (metaLines.length > 0) {
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:0.72rem;margin-bottom:0.5rem;">';
        metaLines.forEach(function(m) {
          var mv = m[0] + ': ' + String(m[1]);
          html += '<div class="tm-army-full tm-fulltext-source" ' + tmSidebarFullTextAttr(mv, true) + '><span style="color:var(--txt-d);">' + m[0] + ':</span> <span style="color:var(--txt);">' + escHtml(String(m[1])) + '</span></div>';
        });
        html += '</div>';
      }

      // 四项状态条：士气/训练/忠诚/控制
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:0.5rem;">';
      [['\u58EB\u6C14',mor,morClr],['\u8BAD\u7EC3',tra,traClr],['\u5FE0\u8BDA',loy,loyClr],['\u63A7\u5236',ctrl,ctrlClr]].forEach(function(s) {
        html += '<div style="text-align:center;">';
        html += '<div style="font-size:0.68rem;color:var(--txt-d);">' + s[0] + '</div>';
        html += '<div style="height:4px;background:var(--bg-3);border-radius:2px;margin:2px 0;overflow:hidden;"><div style="height:100%;width:' + s[1] + '%;background:' + s[2] + ';transition:width 0.3s;"></div></div>';
        html += '<div style="font-size:0.71rem;color:' + s[2] + ';font-weight:600;">' + s[1] + '</div>';
        html += '</div>';
      });
      html += '</div>';

      // 兵种构成
      if (Array.isArray(a.composition) && a.composition.length > 0) {
        html += '<div style="margin-bottom:0.5rem;">';
        html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-bottom:3px;">\u5175\u79CD\u6784\u6210</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        a.composition.forEach(function(c) {
          if (!c || !c.type) return;
          html += '<div class="tm-army-full tm-fulltext-source" ' + tmSidebarFullTextAttr(c.type + ' ' + (c.count||0).toLocaleString(), true) + ' style="font-size:0.71rem;background:var(--bg-3);border:1px solid var(--gold-d);border-radius:10px;padding:2px 8px;">';
          html += '<span style="color:var(--txt);">' + escHtml(c.type) + '</span>';
          html += ' <span style="color:var(--gold);font-weight:600;">' + (c.count||0).toLocaleString() + '</span>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';
      }

      // 装备
      if (Array.isArray(a.equipment) && a.equipment.length > 0) {
        html += '<div style="margin-bottom:0.5rem;">';
        html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-bottom:3px;">\u88C5\u5907\u6E05\u5355</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:3px;">';
        a.equipment.forEach(function(e) {
          if (!e || !e.name) return;
          var condClr = e.condition==='\u7CBE\u826F'?'var(--green)':e.condition==='\u4E00\u822C'?'var(--txt-s)':e.condition==='\u7F3A\u635F'||e.condition==='\u788E'?'var(--red)':'var(--txt-d)';
          html += '<div class="tm-army-full tm-fulltext-source" ' + tmSidebarFullTextAttr(e.name + ' ' + (e.count||0).toLocaleString() + (e.condition ? ' ' + e.condition : ''), true) + ' style="font-size:0.71rem;padding:2px 6px;background:var(--bg-3);border-radius:3px;display:flex;justify-content:space-between;gap:4px;">';
          html += '<span style="color:var(--txt);">' + escHtml(e.name) + '</span>';
          html += '<span><span style="color:var(--gold);">' + (e.count||0).toLocaleString() + '</span>';
          if (e.condition) html += ' <span style="color:' + condClr + ';font-size:0.66rem;">' + escHtml(e.condition) + '</span>';
          html += '</span>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';
      }

      // 岁饷
      if (Array.isArray(a.salary) && a.salary.length > 0) {
        html += '<div style="margin-bottom:0.5rem;">';
        html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-bottom:3px;">\u5C81\u9972</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;font-size:0.7rem;">';
        a.salary.forEach(function(s) {
          if (!s || !s.resource) return;
          html += '<span class="tm-army-full tm-fulltext-source" ' + tmSidebarFullTextAttr(s.resource + ': ' + (s.amount||0).toLocaleString() + ' ' + (s.unit||''), true) + ' style="color:var(--txt);"><span style="color:var(--txt-d);">' + escHtml(s.resource) + ':</span> <span style="color:var(--gold);font-weight:600;">' + (s.amount||0).toLocaleString() + '</span> <span style="color:var(--txt-d);font-size:0.68rem;">' + escHtml(s.unit||'') + '</span></span>';
        });
        html += '</div>';
        html += '</div>';
      }

      // 描述
      if (a.description) {
        html += '<div class="tm-army-full" ' + tmSidebarFullTextAttr(a.description, true) + ' style="font-size:0.7rem;color:var(--txt-s);line-height:1.5;padding-top:4px;border-top:1px dashed var(--bg-4);">' + escHtml(a.description) + '</div>';
      }

      html += '</div>';
    });
    html += '</div>';
  });

  html += '</div>';
  openGenericModal('\u2694\uFE0F \u519B\u4E8B\u8BE6\u60C5\u00B7\u90E8\u961F\u4E0E\u88C5\u5907', html, null);
}

//  左侧面板扩展：阶层/党派/官制消耗
// ============================================================
function renderSidePanels(){
  var gl=_$("gl");if(!gl)return;

  // 清除上一次追加的侧面板内容（防止重复调用导致内容翻倍）
  var _old = document.getElementById('side-panels-ext');
  if (_old) _old.remove();
  var _wrap = document.createElement('div');
  _wrap.id = 'side-panels-ext';

  // 将后续所有 gl.appendChild 替换为追加到 _wrap 内
  var gl_real = gl;
  gl = _wrap;

  // 势力一览
  if(GM.facs&&GM.facs.length>0){
    var fp=document.createElement("div");fp.style.marginBottom="0.8rem";
    fp.innerHTML="<div class=\"pt\">\u2694 \u52BF\u529B\u683C\u5C40 <span style=\"font-size:0.7rem;color:var(--txt-d);font-weight:400;\">"+GM.facs.length+"\u4E2A</span></div>"+GM.facs.map(function(f){
      var attClr=f.attitude==='\u53CB\u597D'||f.attitude==='\u8054\u76DF'?'var(--green)':f.attitude==='\u654C\u5BF9'||f.attitude==='\u4EA4\u6218'||f.attitude==='\u654C\u89C6'?'var(--red)':f.attitude==='\u9644\u5C5E'||f.attitude==='\u5B97\u4E3B'||f.attitude==='\u671D\u8D21'?'var(--blue)':'var(--txt-d)';
      var str=f.strength||50;
      var milStr=f.militaryStrength?' \u5175'+f.militaryStrength:'';
      // 类型标签
      var typeTag=f.type?'<span style="font-size:0.62rem;color:var(--ink-300);margin-left:2px;">'+escHtml(f.type)+'</span>':'';
      // 封臣/宗主标签
      var _vassalTag='';
      if(f.liege)_vassalTag=' <span style="font-size:0.62rem;color:var(--blue);border:1px solid var(--blue);border-radius:3px;padding:0 3px;">\u81E3\u2192'+escHtml(String(f.liege))+'</span>';
      else if(f.vassals&&f.vassals.length>0)_vassalTag=' <span style="font-size:0.62rem;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:0 3px;">\u5B97\u4E3B('+f.vassals.length+')</span>';
      // 颜色条
      var facColor = f.color || attClr;
      // 首领信息
      var leaderLine = '';
      if (f.leader) {
        leaderLine = '<div style="font-size:0.66rem;color:var(--txt-d);">'
          + escHtml(f.leader) + (f.leaderTitle ? '(' + escHtml(f.leaderTitle) + ')' : '')
          + (f.territory ? ' \u00B7 ' + escHtml(String(f.territory)) : '') + '</div>';
      }
      // 目标/文化
      var extraLine = '';
      var extras = [];
      if (f.goal) extras.push('\u2691' + escHtml(String(f.goal)));
      if (f.mainstream) extras.push(escHtml(String(f.mainstream)));
      if (f.resources) extras.push(escHtml(String(f.resources)));
      if (extras.length > 0) extraLine = '<div style="font-size:0.64rem;color:var(--ink-300);margin-top:1px;">' + extras.join(' \u00B7 ') + '</div>';
      return '<div style="margin-bottom:0.45rem;border-left:2px solid '+facColor+';padding-left:0.4rem;">'
        +'<div style="display:flex;justify-content:space-between;font-size:0.78rem;">'
        +'<span>'+(f.name||'')+typeTag+_vassalTag+(f.attitude?' <span style="font-size:0.66rem;color:'+attClr+';">'+f.attitude+'</span>':'')+'</span>'
        +'<span style="color:'+attClr+';">'+str+milStr+'</span></div>'
        +'<div class="rb"><div class="rf" style="width:'+str+'%;background:'+facColor+';"></div></div>'
        +leaderLine+extraLine+'</div>';
    }).join("");
    // 势力间关系摘要
    if(GM.factionRelations&&GM.factionRelations.length>0){
      var _frHtml='<div style="margin-top:0.3rem;font-size:0.7rem;color:var(--txt-d);border-top:1px solid var(--bg-4);padding-top:0.3rem;">';
      GM.factionRelations.forEach(function(r){
        var rClr=(r.value||0)>30?'var(--green)':(r.value||0)<-30?'var(--red)':'var(--txt-d)';
        _frHtml+='<div>'+r.from+'\u2192'+r.to+' <span style="color:'+rClr+';">'+r.type+'('+r.value+')</span></div>';
      });
      _frHtml+='</div>';
      fp.innerHTML+=_frHtml;
    }
    gl.appendChild(fp);
  }

  // 军事力量（点击打开详情）
  if(GM.armies&&GM.armies.length>0){
    var activeA=GM.armies.filter(function(a){return !a.destroyed;});
    if(activeA.length>0){
      var mp=document.createElement("div");mp.style.marginBottom="0.8rem";mp.style.cursor="pointer";
      mp.onclick=function(){openMilitaryDetailPanel();};
      mp.title='\u70B9\u51FB\u67E5\u770B\u5404\u519B\u5B8C\u6574\u8BE6\u60C5';
      var totalSol=activeA.reduce(function(s,a){return s+(a.soldiers||0);},0);
      mp.innerHTML="<div class=\"pt\">\u2694\uFE0F \u519B\u4E8B\u529B\u91CF <span style=\"font-size:0.7rem;color:var(--txt-d);\">\u603B\u5175\u529B"+totalSol+"\u00B7"+activeA.length+"\u652F</span></div>"+activeA.map(function(a){
        var sol=a.soldiers||0;
        var pct=totalSol>0?Math.round(sol/totalSol*100):0;
        var morClr=(a.morale||0)>70?'var(--green)':(a.morale||0)>40?'var(--gold)':'var(--red)';
        var info=a.name+(a.armyType?' <span style=\"font-size:0.66rem;color:var(--txt-d);\">'+a.armyType+'</span>':'');
        var detail=sol+'\u5175 \u58EB\u6C14'+(a.morale||50)+' \u8BAD\u7EC3'+(a.training||50);
        var _cn=a.commander||'';
        var _cc=(_cn&&typeof findCharByName==='function')?findCharByName(_cn):null;
        var _cDead=!!_cn&&(_cc?(_cc.alive===false||_cc.dead===true):true);
        if(!_cn)detail+=' <span style="color:var(--red,#c0563a);">\u5E05:\u7A7A\u7F3A</span>';
        else if(_cDead)detail+=' <span style="color:var(--red,#c0563a);">\u5E05:'+_cn+'(\u6B81)</span>';
        else detail+=' \u5E05:'+_cn;
        if(a.garrison)detail+=' \u9A7B:'+String(a.garrison);
        return "<div style=\"margin-bottom:0.4rem;\"><div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>"+info+"</span><span style=\"color:"+morClr+";\">"+sol+"</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:"+pct+"%;background:"+morClr+";\"></div></div><div style=\"font-size:0.7rem;color:var(--txt-d);\">"+ detail+"</div></div>";
      }).join("");
      gl.appendChild(mp);
    }
  }

  // 目标条件
  if(P.goals&&P.goals.length>0){
    var gp=document.createElement("div");gp.style.marginBottom="0.8rem";
    var typeIcons={win:'\u2605',lose:'\u2716',milestone:'\u25C6',npc_goal:'\u25CB'};
    var typeColors={win:'var(--gold)',lose:'var(--red)',milestone:'var(--blue)',npc_goal:'var(--txt-s)'};
    gp.innerHTML="<div class=\"pt\">\uD83C\uDFAF \u76EE\u6807\u6761\u4EF6</div>"+P.goals.map(function(g){
      return "<div style=\"padding:0.2rem 0;font-size:0.75rem;display:flex;gap:0.3rem;\"><span style=\"color:"+(typeColors[g.type]||'var(--txt-s)')+";\">"+( typeIcons[g.type]||'\u25CB')+"</span><span>"+(g.name||'')+"</span></div>";
    }).join("");
    gl.appendChild(gp);
  }

  // 显著矛盾
  if(P.playerInfo&&P.playerInfo.coreContradictions&&P.playerInfo.coreContradictions.length>0){
    var cp=document.createElement("div");cp.style.marginBottom="0.8rem";
    var dimC={political:'#6366f1',economic:'#f59e0b',military:'#ef4444',social:'#10b981'};
    var dimN={political:'\u653F',economic:'\u7ECF',military:'\u519B',social:'\u793E'};
    var _cHtml="<div class=\"pt\" style=\"color:#a885d5;\">\u26A1 \u663E\u8457\u77DB\u76FE</div>";
    P.playerInfo.coreContradictions.forEach(function(c){
      var dc=dimC[c.dimension]||'#9ca3af';
      _cHtml+="<div style=\"padding:3px 0;font-size:0.72rem;border-left:3px solid "+dc+";padding-left:6px;margin-bottom:3px;\">";
      _cHtml+="<span style=\"color:"+dc+";font-weight:700;\">"+escHtml(c.title||'')+"</span>";
      _cHtml+=" <span style=\"font-size:0.62rem;color:var(--txt-d);\">"+(dimN[c.dimension]||'')+"</span>";
      if(c.severity==='critical')_cHtml+=" <span style=\"font-size:0.62rem;color:#dc2626;\">\u2605</span>";
      _cHtml+="</div>";
    });
    cp.innerHTML=_cHtml;
    gl.appendChild(cp);
  }

  // 头衔爵位
  if(GM.chars){
    var _titledChars=GM.chars.filter(function(c){return c.alive!==false&&c.titles&&c.titles.length>0;});
    if(_titledChars.length>0){
      var tp=document.createElement("div");tp.style.marginBottom="0.8rem";
      var _tHtml="<div class=\"pt\">\uD83D\uDC51 \u7235\u4F4D\u6301\u6709</div>";
      _titledChars.forEach(function(c){
        var ts=c.titles.map(function(t){
          var hTag=t.hereditary?'\u4E16\u88AD':'\u6D41\u5B98';
          var supTag=(t._suppressed&&t._suppressed.length>0)?' \u26D4':'';
          return t.name+'<span style="font-size:0.62rem;color:var(--txt-d);">('+hTag+supTag+')</span>';
        }).join(' ');
        _tHtml+="<div style=\"font-size:0.75rem;padding:2px 0;\"><span style=\"color:var(--gold-l);\">"+escHtml(c.name)+"</span> "+ts+"</div>";
      });
      tp.innerHTML=_tHtml;
      gl.appendChild(tp);
    }
  }

  // 封建关系（封臣-宗主树）
  if(GM.facs){
    var _hasVassals=GM.facs.some(function(f){return (f.vassals&&f.vassals.length>0)||f.liege;});
    if(_hasVassals){
      var vp=document.createElement("div");vp.style.marginBottom="0.8rem";
      var _vHtml="<div class=\"pt\">\uD83C\uDFF0 \u5C01\u5EFA\u5173\u7CFB</div>";
      GM.facs.forEach(function(f){
        if(f.vassals&&f.vassals.length>0){
          _vHtml+="<div style=\"margin-bottom:0.4rem;\">";
          _vHtml+="<div style=\"font-size:0.78rem;font-weight:700;color:var(--gold-l);\">[\u5B97\u4E3B] "+escHtml(f.name)+"</div>";
          var _totalTrib=0;
          f.vassals.forEach(function(vn){
            var vf=GM._indices.facByName?GM._indices.facByName.get(vn):null;
            var ruler=GM.chars?GM.chars.find(function(c){return c.faction===vn&&(c.position==='\u541B\u4E3B'||c.position==='\u9996\u9886');}):null;
            var loy=ruler?(ruler.loyalty||50):50;
            var loyClr=loy>70?'var(--green)':loy<35?'var(--red)':'var(--txt-s)';
            var trib=vf?Math.round((vf.tributeRate||0.3)*100):30;
            _totalTrib+=trib;
            _vHtml+="<div style=\"padding-left:1rem;font-size:0.72rem;display:flex;justify-content:space-between;\">";
            _vHtml+="<span>\u2514 "+escHtml(vn)+(ruler?" ("+escHtml(ruler.name)+")":"")+"</span>";
            _vHtml+="<span>\u8D21"+trib+"% <span style=\"color:"+loyClr+"\">\u5FE0"+loy+"</span>"+(loy<35?" \u26A0":"")+"</span>";
            _vHtml+="</div>";
          });
          _vHtml+="<div style=\"font-size:0.7rem;color:var(--txt-d);padding-left:1rem;\">\u5C01\u81E3"+f.vassals.length+"\u4E2A</div>";
          _vHtml+="</div>";
        }
      });
      vp.innerHTML=_vHtml;
      gl.appendChild(vp);
    }
  }

  // 行政区划概览
  if(P.adminHierarchy){
    var _adminKeys2=Object.keys(P.adminHierarchy);
    var _totalDivs=0;var _govCount=0;var _topDivs=[];
    _adminKeys2.forEach(function(k){
      var ah=P.adminHierarchy[k];if(!ah||!ah.divisions)return;
      function _cnt(divs){divs.forEach(function(d){_totalDivs++;if(d.governor)_govCount++;if(d.children)_cnt(d.children);});}
      _cnt(ah.divisions);
      ah.divisions.forEach(function(d){_topDivs.push(d);});
    });
    if(_totalDivs>0){
      var ap=document.createElement("div");ap.style.marginBottom="0.8rem";
      var _aHtml="<div class=\"pt\">\uD83C\uDFEF \u884C\u653F\u533A\u5212 <span style=\"font-size:0.7rem;color:var(--txt-d);\">\u5171"+_totalDivs+"\u5355\u4F4D \u5B98"+_govCount+"</span></div>";
      _topDivs.forEach(function(d){
        var pStr=d.prosperity?' \u7E41'+d.prosperity:'';
        var gStr=d.governor?' \u5B98:'+escHtml(d.governor):'';
        var chCount=d.children?d.children.length:0;
        _aHtml+="<div style=\"font-size:0.72rem;padding:2px 0;\">"+escHtml(d.name)+"<span style=\"color:var(--txt-d);font-size:0.66rem;\"> "+(d.terrain||'')+(d.level?'('+d.level+')':'')+(chCount>0?' \u4E0B\u8F96'+chCount:'')+pStr+gStr+"</span></div>";
      });
      ap.innerHTML=_aHtml;
      gl.appendChild(ap);
    }
  }

  // 阶层（点击打开详情）
  if(GM.classes&&GM.classes.length>0){
    var cp=document.createElement("div");cp.style.marginBottom="0.8rem";cp.style.cursor="pointer";
    cp.onclick=function(){openClassDetailPanel();};
    cp.innerHTML="<div class=\"pt\">\uD83D\uDC51 \u9636\u5C42</div>"+GM.classes.map(function(c){var _ci=c.influence||c.classInfluence||0;return "<div style=\"margin-bottom:0.3rem;\"><div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>"+escHtml(c.name)+(c.satisfaction?' <span style=\"font-size:0.7rem;color:var(--txt-d);\">'+Math.round(c.satisfaction)+'</span>':'')+"</span><span style=\"color:var(--gold);\">"+_ci+"</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:"+_ci+"%;background:var(--blue);\"></div></div></div>";}).join("");
    gl.appendChild(cp);
  }

  // 党派（点击打开详情）
  if(GM.parties&&GM.parties.length>0){
    var pp=document.createElement("div");pp.style.marginBottom="0.8rem";pp.style.cursor="pointer";
    pp.onclick=function(){openPartyDetailPanel();};
    pp.innerHTML="<div class=\"pt\">\uD83C\uDFDB \u515A\u6D3E</div>"+GM.parties.map(function(p){var _inf=p.influence||p.strength||0;var _stClr=p.status==='\u6D3B\u8DC3'?'var(--green)':p.status==='\u5F0F\u5FAE'?'var(--gold)':p.status==='\u88AB\u538B\u5236'?'var(--red)':'var(--txt-d)';return "<div style=\"margin-bottom:0.3rem;\"><div style=\"display:flex;justify-content:space-between;font-size:0.78rem;\"><span>"+escHtml(p.name)+(p.status?' <span style=\"font-size:0.7rem;color:'+_stClr+';\">'+escHtml(p.status)+'</span>':'')+"</span><span>"+_inf+"</span></div><div class=\"rb\"><div class=\"rf\" style=\"width:"+_inf+"%;background:var(--purple);\"></div></div></div>";}).join("");
    gl.appendChild(pp);
  }

  // 重要物品
  if(GM.items&&GM.items.length>0){
    var ip=document.createElement("div");ip.style.marginBottom="0.8rem";
    var typeIcons={weapon:'\u2694',armor:'\uD83D\uDEE1',consumable:'\uD83C\uDF76',treasure:'\uD83D\uDC8E',document:'\uD83D\uDCDC',seal:'\uD83D\uDD8B',special:'\u2728'};
    var rarClr={'\u666E\u901A':'var(--txt-d)','\u7CBE\u826F':'var(--green)','\u73CD\u8D35':'var(--blue)','\u4F20\u8BF4':'var(--gold)'};
    var _iHtml="<div class=\"pt\">\uD83D\uDCE6 \u7269\u54C1 <span style=\"font-size:0.7rem;color:var(--txt-d);font-weight:400;\">"+GM.items.length+"\u4EF6</span></div>";
    GM.items.forEach(function(it){
      var _acqStyle = it.acquired ? '' : 'opacity:0.5;';
      var _acqTag = it.acquired ? '' : '<span style="font-size:0.62rem;color:var(--ink-300);margin-left:3px;">\u672A\u83B7</span>';
      _iHtml+="<div style=\"padding:0.2rem 0;font-size:0.75rem;border-bottom:1px solid var(--bg-4);"+_acqStyle+"\">";
      _iHtml+="<div style=\"display:flex;justify-content:space-between;\"><span>"+(typeIcons[it.type]||'\u2022')+' '+(it.name||'')+_acqTag+"</span>";
      if(it.rarity&&it.rarity!=='\u666E\u901A')_iHtml+="<span style=\"font-size:0.66rem;color:"+(rarClr[it.rarity]||'var(--txt-d)')+";\">"+it.rarity+"</span>";
      _iHtml+="</div>";
      if(it.effect)_iHtml+="<div style=\"font-size:0.7rem;color:var(--gold-d);\">"+escHtml(String(it.effect))+"</div>";
      if(it.owner)_iHtml+="<div style=\"font-size:0.66rem;color:var(--ink-300);\">\u6301\u6709\uFF1A"+escHtml(it.owner)+"</div>";
      _iHtml+="</div>";
    });
    ip.innerHTML=_iHtml;
    gl.appendChild(ip);
  }

  // 后宫/妃嫔面板
  if(GM.chars&&GM.harem){
    var _spouseChars=GM.chars.filter(function(c){return c.alive!==false && (typeof _tmIsPlayerConsort === 'function' ? _tmIsPlayerConsort(c) : c.spouse === true);});
    if(_spouseChars.length>0){
      var hp=document.createElement("div");hp.style.marginBottom="0.8rem";
      var _hHtml="<div class=\"pt\">\uD83D\uDC90 \u540E\u5BAB</div>";
      // 按位份排序（动态从rankSystem获取level）
      _spouseChars.sort(function(a,b){
        var la = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(a.spouseRank) : 9;
        var lb = typeof getHaremRankLevel === 'function' ? getHaremRankLevel(b.spouseRank) : 9;
        return la - lb;
      });
      _spouseChars.forEach(function(sp){
        var rkName=sp.spouseRank||'';
        if(typeof getHaremRankName==='function'){var rn=getHaremRankName(sp.spouseRank);if(rn)rkName=rn;}
        var rkIcon='';if(typeof getHaremRankIcon==='function')rkIcon=getHaremRankIcon(sp.spouseRank);
        var childCount=sp.children?sp.children.length:0;
        var loyClr=(sp.loyalty||50)>70?'var(--green)':(sp.loyalty||50)<30?'var(--red)':'var(--txt-s)';
        _hHtml+="<div style=\"font-size:0.72rem;padding:2px 0;display:flex;justify-content:space-between;\">";
        _hHtml+="<span>"+rkIcon+" "+escHtml(sp.name)+" <span style=\"color:var(--gold-d);font-size:0.66rem;\">"+escHtml(rkName)+"</span></span>";
        var favStr = sp.favor !== undefined ? ' \u5BA0' + sp.favor : '';
        _hHtml+="<span style=\"font-size:0.66rem;\"><span style=\"color:"+loyClr+"\">\u5FE0"+(sp.loyalty||50)+"</span>"+favStr+(childCount>0?" \u5B50"+childCount:"")+"</span>";
        _hHtml+="</div>";
      });
      // 继承人
      if(GM.harem.heirs&&GM.harem.heirs.length>0){
        _hHtml+="<div style=\"font-size:0.7rem;color:var(--gold);margin-top:3px;border-top:1px solid var(--bg-4);padding-top:3px;\">\u7EE7\u627F\u4EBA: "+GM.harem.heirs.join('\u3001')+"</div>";
      }
      // 孕期
      if(GM.harem.pregnancies&&GM.harem.pregnancies.length>0){
        _hHtml+="<div style=\"font-size:0.7rem;color:var(--purple,#9b59b6);\">\u6709\u5B55: "+GM.harem.pregnancies.map(function(p){return p.mother;}).join('\u3001')+"</div>";
      }
      hp.innerHTML=_hHtml;
      gl.appendChild(hp);
    }
  }

  // 建筑概览
  var _allBlds=(typeof getAllBuildingsCompat==='function')?getAllBuildingsCompat():((GM.buildings&&GM.buildings)||[]);
  if(_allBlds&&_allBlds.length>0){
    var _catCount={};var _totalBld=_allBlds.length;
    var _inQueue=GM.buildingQueue?GM.buildingQueue.length:0;
    _allBlds.forEach(function(b){
      var cat=b.category||(typeof BUILDING_TYPES!=='undefined'&&BUILDING_TYPES[b.type]?BUILDING_TYPES[b.type].category:'');
      _catCount[cat]=(_catCount[cat]||0)+1;
    });
    var _catNames={'military':'\u519B','economic':'\u7ECF','economy':'\u7ECF','cultural':'\u6587','culture':'\u6587','administrative':'\u653F','administration':'\u653F','religious':'\u5B97','infrastructure':'\u57FA'};
    var bp=document.createElement("div");bp.style.marginBottom="0.8rem";
    var _bHtml="<div class=\"pt\">\uD83C\uDFD7 \u5EFA\u7B51 <span style=\"font-size:0.7rem;color:var(--txt-d);\">\u5171"+_totalBld+"\u5EA7</span></div>";
    var _catEntries=Object.keys(_catCount);
    if(_catEntries.length>0){
      _bHtml+="<div style=\"display:flex;flex-wrap:wrap;gap:4px;font-size:0.7rem;\">";
      _catEntries.forEach(function(c){_bHtml+="<span style=\"background:var(--bg-3);padding:1px 5px;border-radius:3px;\">"+(_catNames[c]||c)+":"+_catCount[c]+"</span>";});
      _bHtml+="</div>";
    }
    if(_inQueue>0)_bHtml+="<div style=\"font-size:0.7rem;color:var(--gold);margin-top:3px;\">\u5EFA\u9020\u4E2D: "+_inQueue+"\u9879</div>";
    bp.innerHTML=_bHtml;
    gl.appendChild(bp);
  }

  // 事件概览
  if(GM.events&&GM.events.length>0){
    var _untrigEvts=GM.events.filter(function(e){return !e.triggered;});
    var _trigEvts=GM.events.filter(function(e){return e.triggered;});
    if(_untrigEvts.length>0||_trigEvts.length>0){
      var ep2=document.createElement("div");ep2.style.marginBottom="0.8rem";
      var _eHtml="<div class=\"pt\">\u{1F4DC} \u4E8B\u4EF6 <span style=\"font-size:0.7rem;color:var(--txt-d);\">\u5F85\u89E6\u53D1"+_untrigEvts.length+" \u5DF2\u53D1\u751F"+_trigEvts.length+"</span></div>";
      _untrigEvts.forEach(function(e){
        var impClr=e.importance==='\u5173\u952E'?'var(--red)':e.importance==='\u91CD\u8981'?'var(--gold)':'var(--txt-d)';
        _eHtml+="<div style=\"font-size:0.72rem;padding:2px 0;\"><span style=\"color:"+impClr+";\">"+(e.importance==='\u5173\u952E'?'\u2605':e.importance==='\u91CD\u8981'?'\u25C6':'\u25CB')+"</span> "+escHtml(e.name||'')+(e.type?' <span style=\"font-size:0.66rem;color:var(--txt-d);\">'+escHtml(e.type)+'</span>':'')+"</div>";
      });
      if(_trigEvts.length>0){
        _eHtml+="<div style=\"font-size:0.7rem;color:var(--green);margin-top:3px;border-top:1px solid var(--bg-4);padding-top:2px;\">\u5DF2\u53D1\u751F: "+_trigEvts.map(function(e){return e.name;}).join('\u3001')+"</div>";
      }
      ep2.innerHTML=_eHtml;
      gl.appendChild(ep2);
    }
  }

  // 官制消耗
  if(P.officeConfig&&P.officeConfig.costVariables&&P.officeConfig.costVariables.length>0&&GM.officeTree&&GM.officeTree.length>0){
    var td=0,to=0;
    function cnt(tree){tree.forEach(function(d){td++;to+=(d.positions||[]).filter(function(p){return p.holder;}).length;if(d.subs)cnt(d.subs);});}
    cnt(GM.officeTree);
    var oc=document.createElement("div");oc.style.marginBottom="0.8rem";
    oc.innerHTML="<div class=\"pt\">\uD83D\uDCB0 \u5B98\u5236\u6D88\u8017</div><div style=\"font-size:0.71rem;color:var(--txt-d);\">\u90E8\u95E8:"+td+" \u5B98\u5458:"+to+"</div>"+P.officeConfig.costVariables.map(function(cv){var cost=(cv.perDept||0)*td+(cv.perOfficial||0)*to;var v=GM.vars[cv.variable];var ok=v&&v.value>=cost;return "<div style=\"display:flex;justify-content:space-between;font-size:0.75rem;\"><span>"+cv.variable+"</span><span style=\"color:"+(ok?"var(--txt-s)":"var(--red)")+";\">-"+cost+"/\u56DE</span></div>";}).join("");
    gl.appendChild(oc);
  }

  // 皇城宫殿面板
  if (P.palaceSystem && P.palaceSystem.enabled && P.palaceSystem.palaces && P.palaceSystem.palaces.length > 0) {
    var ppd = document.createElement('div');
    ppd.style.marginBottom = '0.8rem';
    var _palaces = P.palaceSystem.palaces;
    // 按type分组统计
    var _typeStats = {};
    _palaces.forEach(function(p) { _typeStats[p.type] = (_typeStats[p.type] || 0) + 1; });
    var _typeLabels = { main_hall:'外朝', imperial_residence:'帝居', consort_residence:'后妃居所', dowager:'太后宫', crown_prince:'太子宫', ceremonial:'礼制', garden:'园林', office:'内廷', offering:'祭祀' };
    var _statItems = [];
    Object.keys(_typeStats).forEach(function(t) {
      _statItems.push((_typeLabels[t] || t) + _typeStats[t]);
    });
    // 本回合居住的妃嫔数
    var _occupiedCount = 0;
    _palaces.forEach(function(p) { if (p.subHalls) p.subHalls.forEach(function(sh) { if (sh.occupants) _occupiedCount += sh.occupants.length; }); });
    var _damaged = _palaces.filter(function(p) { return p.status === 'damaged' || p.status === 'ruined'; }).length;
    ppd.innerHTML = '<div class="pt" onclick="openPalacePanel()" style="cursor:pointer;">🏯 ' + escHtml(P.palaceSystem.capitalName || '皇城') + ' <span style="font-size:0.7rem;color:var(--txt-d);font-weight:400;">' + _palaces.length + '处</span></div>'
      + '<div style="font-size:0.71rem;color:var(--txt-d);line-height:1.5;">' + _statItems.join(' · ') + '</div>'
      + '<div style="font-size:0.71rem;color:var(--txt-s);">居住 ' + _occupiedCount + '人' + (_damaged?' · <span style="color:var(--red);">'+_damaged+'处需修缮</span>':'') + '</div>'
      + '<div style="font-size:0.66rem;color:var(--gold-d);margin-top:2px;cursor:pointer;" onclick="openPalacePanel()">点击查看详情 →</div>';
    gl.appendChild(ppd);
  }

  // 注意：把 shell extras 注入到 gl_real（而非 _wrap），这样 #side-panels-ext 被 CSS 隐藏后仍显示
  try { if (typeof _renderShellExtrasLeft === 'function') _renderShellExtrasLeft(gl_real); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn');}catch(_){}}

  // 将整个侧面板容器追加到真实gl（将被 CSS .gs-drawer-body #side-panels-ext 隐藏）
  gl_real.appendChild(_wrap);

  // 右侧 drawer 面板 — shell extras
  try { if (typeof _renderShellExtrasRight === 'function') _renderShellExtrasRight(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-endturn');}catch(_){}}
}

// 皇城详情弹窗
function openPalacePanel() {
  if (!P.palaceSystem || !P.palaceSystem.palaces) return;
  var palaces = P.palaceSystem.palaces;
  var _typeLabels = { main_hall:'外朝主殿', imperial_residence:'帝居宫殿', consort_residence:'后妃居所', dowager:'太后/太妃宫', crown_prince:'太子宫', ceremonial:'礼制建筑', garden:'园林行宫', office:'内廷办公', offering:'祭祀宗庙' };
  var _typeColors = { main_hall:'#ffd700', imperial_residence:'#e74c3c', consort_residence:'#9b59b6', dowager:'#d4a04c', crown_prince:'#3498db', ceremonial:'#95a5a6', garden:'#16a085', office:'#7f8c8d', offering:'#c0392b' };
  var html = '<div class="modal-bg show" id="_palaceDetailModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:800px;max-height:85vh;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">🏯 ' + escHtml(P.palaceSystem.capitalName || '皇城') + '</h3>';
  if (P.palaceSystem.capitalDescription) html += '<div style="font-size:0.78rem;color:var(--txt-s);line-height:1.7;padding:0.5rem;background:var(--bg-2);border-radius:6px;margin-bottom:0.8rem;">' + escHtml(P.palaceSystem.capitalDescription) + '</div>';
  // 按type分组
  var groups = {};
  palaces.forEach(function(p) { (groups[p.type] = groups[p.type] || []).push(p); });
  Object.keys(_typeLabels).forEach(function(t) {
    var grp = groups[t]; if (!grp || !grp.length) return;
    var color = _typeColors[t] || '#888';
    html += '<div style="margin-bottom:0.8rem;">';
    html += '<div style="font-size:0.85rem;color:' + color + ';font-weight:700;margin-bottom:0.3rem;padding:0.2rem 0;border-bottom:1px solid ' + color + '44;">◆ ' + _typeLabels[t] + ' (' + grp.length + ')</div>';
    grp.forEach(function(pal, pi) {
      var realIdx = palaces.indexOf(pal);
      html += '<div style="padding:0.5rem;margin-bottom:0.4rem;background:var(--bg-2);border-left:3px solid ' + color + ';border-radius:4px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div><span style="font-size:0.95rem;color:' + color + ';font-weight:700;">' + escHtml(pal.name) + '</span>';
      if (pal.status && pal.status !== 'intact') {
        var sMap = { damaged:'损坏', ruined:'荒废', underconstruction:'在建' };
        html += '<span style="margin-left:6px;font-size:0.71rem;color:var(--red);">[' + (sMap[pal.status] || pal.status) + ']</span>';
      }
      if (pal.location) html += '<span style="margin-left:6px;font-size:0.7rem;color:var(--txt-d);">📍' + escHtml(pal.location) + '</span>';
      html += '</div>';
      html += '<div style="display:flex;gap:2px;">';
      html += '<button class="bt bsm" style="font-size:0.68rem;" onclick="_palaceAction(' + realIdx + ',\'renovate\')">修缮</button>';
      html += '<button class="bt bsm" style="font-size:0.68rem;" onclick="_palaceAction(' + realIdx + ',\'reassign\')">移居</button>';
      html += '</div>';
      html += '</div>';
      if (pal.function) html += '<div style="font-size:0.72rem;color:var(--txt-d);margin-top:2px;">' + escHtml(pal.function) + '</div>';
      if (pal.subHalls && pal.subHalls.length > 0) {
        html += '<div style="margin-top:4px;padding-left:10px;font-size:0.72rem;line-height:1.8;">';
        pal.subHalls.forEach(function(sh) {
          var roleLabel = { main:'主殿', side:'偏殿', attached:'附殿' }[sh.role] || sh.role;
          var shColor = sh.role === 'main' ? '#ffd700' : sh.role === 'side' ? '#9b59b6' : '#16a085';
          html += '<div style="color:' + shColor + ';">├ <b>' + escHtml(sh.name) + '</b> <span style="color:var(--txt-d);">(' + roleLabel + ' ' + ((sh.occupants||[]).length) + '/' + (sh.capacity||1) + ')</span>';
          if (sh.occupants && sh.occupants.length) html += ' <span style="color:#4ade80;">' + sh.occupants.map(escHtml).join('、') + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:0.8rem;">';
  html += '<button class="bt bp" onclick="_palaceNewBuild()">⊕ 修建新宫殿</button>';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_palaceDetailModal\');if(m)m.remove();">关闭</button>';
  html += '</div>';
  html += '</div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

function _palaceAction(idx, action) {
  var pal = P.palaceSystem && P.palaceSystem.palaces && P.palaceSystem.palaces[idx];
  if (!pal) return;
  if (action === 'renovate') {
    _palaceRenovateModal(pal);
    return;
  }
  if (action === 'reassign') {
    _palaceReassignModal(pal);
    return;
  }
}

/** 修缮弹窗 */
function _palaceRenovateModal(pal) {
  var _old = document.getElementById('_palaceRenoModal'); if (_old) _old.remove();
  var statusMap = { damaged:'损坏', ruined:'荒废', underconstruction:'在建', intact:'完好' };
  var html = '<div class="modal-bg show" id="_palaceRenoModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:460px;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">◎ 修缮 ' + escHtml(pal.name) + '</h3>';
  html += '<div style="font-size:0.78rem;color:var(--txt-s);padding:0.5rem;background:var(--bg-2);border-radius:6px;margin-bottom:0.6rem;">当前状态：<b>' + (statusMap[pal.status]||'完好') + '</b>' + (pal.lastRenovation?' · 上次修缮 T'+pal.lastRenovation:'') + '</div>';
  html += '<label style="font-size:0.78rem;color:var(--gold);">修缮意图（告知AI）</label>';
  html += '<textarea id="_palRenoDesc" rows="3" class="fd" style="width:100%;" placeholder="' + (pal.status === 'ruined' ? '如：荒废重建，恢复规制' : '如：整修正殿屋瓦、重绘彩绘、重铺砖石') + '"></textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:0.6rem;justify-content:flex-end;">';
  html += '<button class="bt bs" onclick="var m=document.getElementById(\'_palaceRenoModal\');if(m)m.remove();">取消</button>';
  html += '<button class="bt bp" onclick="_palaceSubmitReno(&quot;' + encodeURIComponent(pal.name) + '&quot;)">提交</button>';
  html += '</div></div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}
function _palaceSubmitReno(palNameEnc) {
  var palName = decodeURIComponent(palNameEnc);
  var desc = ((document.getElementById('_palRenoDesc')||{}).value||'').trim() || '修缮 ' + palName + '，恢复规制与威严';
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u5BAB\u5EFA', from: palName, content: '修缮 ' + palName + '：' + desc, turn: GM.turn, used: false });
  toast('已录入诏令建议库');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_palaceRenoModal'); if (m) m.remove();
}

/** 移居弹窗——列出目标宫殿的所有 subHall 供选择 */
function _palaceReassignModal(pal) {
  var _old = document.getElementById('_palaceAssignModal'); if (_old) _old.remove();
  // 收集当前宫殿的现有居住者
  var currentOccupants = [];
  if (pal.subHalls) {
    pal.subHalls.forEach(function(sh) {
      (sh.occupants || []).forEach(function(n) { currentOccupants.push({ name: n, fromSubHall: sh }); });
    });
  }
  // 收集所有 subHall 作为可迁目标（包括其他宫殿的居所殿）
  var allSubHalls = [];
  (P.palaceSystem.palaces || []).forEach(function(p) {
    if (p.type !== 'consort_residence' && p.type !== 'imperial_residence' && p.type !== 'main_hall') return;
    (p.subHalls || []).forEach(function(sh) {
      allSubHalls.push({ palace: p, subHall: sh });
    });
  });

  var html = '<div class="modal-bg show" id="_palaceAssignModal" onclick="if(event.target===this)this.remove()">';
  html += '<div class="modal-box" style="max-width:600px;max-height:85vh;overflow-y:auto;">';
  html += '<h3 style="color:var(--gold);margin:0 0 0.5rem;letter-spacing:0.1em;">◎ ' + escHtml(pal.name) + ' 妃嫔移居</h3>';

  if (currentOccupants.length === 0) {
    html += '<div style="padding:1rem;text-align:center;color:var(--txt-d);">此宫殿暂无居住者</div>';
    html += '<div style="text-align:center;margin-top:0.6rem;"><button class="bt bs" onclick="var m=document.getElementById(\'_palaceAssignModal\');if(m)m.remove();">关闭</button></div>';
  } else {
    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.78rem;color:var(--gold);">① 选择迁出者</label>';
    html += '<select id="_palAssignWho" class="fd" style="width:100%;">';
    currentOccupants.forEach(function(o) {
      html += '<option value="' + escHtml(o.name) + '">' + escHtml(o.name) + '（现居：' + escHtml(o.fromSubHall.name) + '）</option>';
    });
    html += '</select></div>';

    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.78rem;color:var(--gold);">② 选择目标居所</label>';
    html += '<select id="_palAssignTo" class="fd" style="width:100%;">';
    allSubHalls.forEach(function(t) {
      var occ = t.subHall.occupants || [];
      var full = occ.length >= (t.subHall.capacity || 1);
      var roleLabel = { main:'主殿', side:'偏殿', attached:'附殿' }[t.subHall.role] || t.subHall.role;
      var dispText = t.palace.name + '·' + t.subHall.name + '（' + roleLabel + ' ' + occ.length + '/' + (t.subHall.capacity||1) + '）' + (full ? ' [满]' : '');
      html += '<option value="' + escHtml(t.palace.name) + '|' + escHtml(t.subHall.name) + '"' + (full ? ' disabled' : '') + '>' + escHtml(dispText) + '</option>';
    });
    html += '</select></div>';

    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.78rem;color:var(--gold);">③ 原因说明（AI据此生成叙事）</label>';
    html += '<textarea id="_palAssignReason" rows="2" class="fd" style="width:100%;" placeholder="如：晋贵妃位，移居储秀宫正殿；或：失宠，迁出乾清宫"></textarea>';
    html += '</div>';

    html += '<div style="display:flex;gap:8px;margin-top:0.6rem;justify-content:flex-end;">';
    html += '<button class="bt bs" onclick="var m=document.getElementById(\'_palaceAssignModal\');if(m)m.remove();">取消</button>';
    html += '<button class="bt bp" onclick="_palaceSubmitReassign()">提交</button>';
    html += '</div>';
  }
  html += '</div></div>';
  var tmp = document.createElement('div'); tmp.innerHTML = html; document.body.appendChild(tmp.firstChild);
}

function _palaceSubmitReassign() {
  var who = (document.getElementById('_palAssignWho')||{}).value || '';
  var toVal = (document.getElementById('_palAssignTo')||{}).value || '';
  var reason = ((document.getElementById('_palAssignReason')||{}).value||'').trim();
  if (!who || !toVal) { toast('请选择迁出者与目标居所'); return; }
  var parts = toVal.split('|');
  var toPal = parts[0], toSubHall = parts[1];
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  var content = '调 ' + who + ' 移居 ' + toPal + '·' + toSubHall + (reason ? '——' + reason : '');
  GM._edictSuggestions.push({ source: '\u5BAB\u5EFA', from: toPal, content: content, turn: GM.turn, used: false });
  toast('已录入诏令建议库');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_palaceAssignModal'); if (m) m.remove();
}

function _palaceNewBuild() {
  var name = window.prompt('新建宫殿名：', '');
  if (!name || !name.trim()) return;
  var desc = window.prompt('该宫殿用途、规模、位置（告知AI）：', '');
  if (!desc || !desc.trim()) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '\u5BAB\u5EFA',
    from: '皇城',
    content: '新建宫殿【' + name.trim() + '】：' + desc.trim() + '。——请AI判定建造合理性、成本、工期与威仪影响，纳入皇城。',
    turn: GM.turn,
    used: false
  });
  toast('已录入诏令建议库，请在诏令区纳入后颁诏');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  var m = document.getElementById('_palaceDetailModal'); if (m) m.remove();
}
