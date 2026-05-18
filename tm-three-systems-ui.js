// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-three-systems-ui.js
 * 三大系统升级·波4 UI 面板 + 结构化诏书工具箱
 *
 * 1. 覆盖/增强 openPartyDetailPanel + openMilitaryDetailPanel
 * 2. 新增 openForcesRelationsPanel (势力+外交关系)
 * 3. 新增结构化诏书 handlers·生成 _edictTracker 条目+写编年
 */
(function(global){
  'use strict';

  // ─── 辅助 ───
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  // 对 JS 字符串字面量转义(双层·内容嵌入 HTML 属性 onclick 的 JS 单引号字符串)
  // 先 JS 转义再 HTML 转义·HTML 解码后得到合法 JS·JS parser 再解码
  function jsEsc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  }
  function _openModal(title, html, onSave) {
    if (typeof openGenericModal === 'function') {
      openGenericModal(title, html, onSave || null);
    } else {
      alert(title + '\n' + html.replace(/<[^>]+>/g, ''));
    }
  }
  function _toast(m) { if (typeof toast === 'function') toast(m); }
  function _pushEdict(content, category) {
    if (!global.GM) return false;
    if (!GM._edictTracker) GM._edictTracker = [];
    var id = 'ts_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    GM._edictTracker.push({
      id: id, content: content, category: category || '三系统',
      turn: GM.turn || 0, status: 'pending',
      assignee: '', feedback: '', progressPercent: 0
    });
    // 编年
    if (!GM._chronicle) GM._chronicle = [];
    GM._chronicle.push({
      turn: GM.turn || 0, date: GM._gameDate || '',
      type: category || '诏书',
      text: content.slice(0, 120),
      tags: ['诏书', category || '三系统']
    });
    return id;
  }
  function _phaseColor(phase) {
    if (phase === 'consolidating') return 'var(--green)';
    if (phase === 'stable') return 'var(--gold)';
    if (phase === 'strained') return 'var(--amber, #e0a040)';
    if (phase === 'declining') return 'var(--red-s, #b04030)';
    if (phase === 'collapsing') return 'var(--red, #c03030)';
    return 'var(--txt-d)';
  }
  function _phaseLabel(phase) {
    var m = {consolidating:'上升',stable:'稳定',strained:'紧张',declining:'衰退',collapsing:'崩溃',rising:'上升'};
    return m[phase] || (phase || '稳定');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  势力+外交面板
  // ══════════════════════════════════════════════════════════════════════
  function openForcesRelationsPanel() {
    if (!global.GM || !Array.isArray(GM.facs) || GM.facs.length === 0) { _toast('暂无势力数据'); return; }
    if (typeof ThreeSystemsExt !== 'undefined' && ThreeSystemsExt.buildProvinceOwnerIndex) ThreeSystemsExt.buildProvinceOwnerIndex();
    // 2026-05-10·Layer 1·读取反向索引·防御性 rebuild
    if (global.TM && TM.FactionIndex && TM.FactionIndex.rebuild) {
      try { TM.FactionIndex.rebuild(); } catch(_){}
    }
    // 2026-05-10·Layer 3·派生健康度同步刷新
    if (global.TM && TM.FactionDerived && TM.FactionDerived.compute) {
      try { TM.FactionDerived.compute(); } catch(_){}
    }
    // Phase B1-B3·派生经济/凝聚/综合
    if (global.TM && TM.FactionDerivedEconomy && TM.FactionDerivedEconomy.compute) {
      try { TM.FactionDerivedEconomy.compute(); } catch(_){}
    }
    if (global.TM && TM.FactionDerivedCohesion && TM.FactionDerivedCohesion.compute) {
      try { TM.FactionDerivedCohesion.compute(); } catch(_){}
    }
    if (global.TM && TM.FactionDerivedStrength && TM.FactionDerivedStrength.compute) {
      try { TM.FactionDerivedStrength.compute(); } catch(_){}
    }
    var playerFac = (global.P && P.playerInfo && P.playerInfo.factionName) || '';

    var html = '<div style="padding:0.8rem;max-height:78vh;overflow-y:auto;">';
    html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.8rem;">势力运行时态·绿=上升 金=稳定 琥珀=紧张 红=衰退/崩溃·人物/军队 inline 显示</div>';

    // 势力列表
    GM.facs.forEach(function(f) {
      if (!f || !f.name) return;
      var isPlayer = f.name === playerFac;
      var phase = f.lifePhase || 'stable';
      // Layer 2 索引·缺则 fallback 到 getFactionProvinces
      var idx = (global.GM._facIndex && GM._facIndex[f.name]) || null;
      var prov = idx ? idx.provinces : (typeof getFactionProvinces === 'function' ? getFactionProvinces(f.name) : []);
      var provCount = prov.length;
      var m = idx ? idx.metrics : null;

      html += '<div style="background:var(--bg-2);border-radius:8px;padding:0.8rem;margin-bottom:0.7rem;border-left:4px solid '+_phaseColor(phase)+';">';
      // 头
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">';
      html += '<div><span style="font-weight:700;font-size:1rem;color:'+(f.color||'var(--gold)')+';">'+esc(f.name)+'</span>';
      if (isPlayer) html += ' <span style="font-size:0.7rem;color:var(--gold);background:rgba(201,168,76,0.15);padding:1px 6px;border-radius:3px;">本朝</span>';
      if (f._collapsing) html += ' <span style="font-size:0.7rem;color:var(--red);background:rgba(200,50,50,0.15);padding:1px 6px;border-radius:3px;">濒崩</span>';
      html += ' <span style="font-size:0.72rem;color:'+_phaseColor(phase)+';margin-left:6px;">【'+_phaseLabel(phase)+'】</span>';
      html += '</div>';
      html += '<div style="font-size:0.76rem;color:var(--txt-d);">领袖: '+esc(f.leader||'无')+'</div>';
      html += '</div>';
      // 数值网格
      html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.5rem;font-size:0.76rem;margin-bottom:0.5rem;">';
      html += '<div><div style="color:var(--txt-d);">实力</div><div style="font-weight:600;">'+(f.strength||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">合法性</div><div style="font-weight:600;">'+(f.legitimacy||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">人口</div><div style="font-weight:600;">'+(f.population||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">民心</div><div style="font-weight:600;">'+(f.morale||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">稳定</div><div style="font-weight:600;">'+(f.stability||0)+'</div></div>';
      html += '</div>';

      // ─────── Layer 3·派生健康度 ───────
      var dh = f.derivedHealth || null;
      if (dh) {
        function _hcolor(v) {
          if (v >= 70) return 'var(--green)';
          if (v >= 50) return 'var(--gold)';
          if (v >= 30) return 'var(--amber, #e0a040)';
          return 'var(--red, #b04030)';
        }
        var dhTip = '朝堂凝聚源自党争失衡+忠诚 / 军权集中=100−私兵化 / 人事健康=忠诚−欠饷×5 / 兵权稳健=100−兵变−欠饷比';
        html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;font-size:0.72rem;margin-bottom:0.5rem;padding:0.4rem;background:rgba(255,255,255,0.03);border-radius:4px;" title="'+esc(dhTip)+'">';
        html += '<div><div style="color:var(--txt-d);">朝堂凝聚</div><div style="font-weight:600;color:'+_hcolor(dh.courtCohesion)+';">'+dh.courtCohesion+' '+dh.labels.courtCohesion+'</div></div>';
        html += '<div><div style="color:var(--txt-d);">军权集中</div><div style="font-weight:600;color:'+_hcolor(dh.militaryControl)+';">'+dh.militaryControl+' '+dh.labels.militaryControl+'</div></div>';
        html += '<div><div style="color:var(--txt-d);">人事健康</div><div style="font-weight:600;color:'+_hcolor(dh.personnelHealth)+';">'+dh.personnelHealth+' '+dh.labels.personnelHealth+'</div></div>';
        html += '<div><div style="color:var(--txt-d);">兵权稳健</div><div style="font-weight:600;color:'+_hcolor(dh.militaryStability)+';">'+dh.militaryStability+' '+dh.labels.militaryStability+'</div></div>';
        html += '<div><div style="color:var(--txt-d);">综合</div><div style="font-weight:700;color:'+_hcolor(dh.overall)+';">'+dh.overall+' 【'+dh.labels.overall+'】</div></div>';
        html += '</div>';
      }

      // ─────── Layer 1·人物 inline ───────
      if (m && m.charCount > 0) {
        html += '<div style="margin-top:0.5rem;padding-top:0.4rem;border-top:1px dashed var(--bd,rgba(255,255,255,0.08));font-size:0.74rem;">';
        html += '<div style="color:var(--txt-d);margin-bottom:0.25rem;">人物 '+m.charCount+' 人 · 朝臣 '+m.charByRole.court+' · 将领 '+m.charByRole.general+' · 宗室 '+m.charByRole.clan+(m.avgLoyalty>0?(' · 平均忠诚 '+m.avgLoyalty):'')+'</div>';
        // 朝臣 (前 6)
        var courts = idx.chars.filter(function(c){
          var p = String(c.position||c.title||'');
          return /尚书|侍郎|大学士|御史|给事中|翰林|阁|卿|监/.test(p);
        });
        if (courts.length > 0) {
          html += '<div style="margin-bottom:0.2rem;"><span style="color:var(--txt-d);">朝臣:</span> ';
          html += courts.slice(0,6).map(function(c){
            var pTag = c.party ? '<span style="color:var(--amber, #e0a040);font-size:0.68rem;">{'+esc(c.party)+'}</span>' : '';
            return '<span style="color:var(--txt-s);">'+esc(c.name)+'</span>'+pTag;
          }).join('·');
          if (courts.length > 6) html += ' <span style="color:var(--txt-d);">+'+(courts.length-6)+'</span>';
          html += '</div>';
        }
        // 将领 (前 6) + 私兵化标记
        var generals = idx.chars.filter(function(c){
          var p = String(c.position||c.title||'');
          return /总兵|都督|参将|副将|提督|经略|游击/.test(p);
        });
        if (generals.length > 0) {
          html += '<div style="margin-bottom:0.2rem;"><span style="color:var(--txt-d);">将领:</span> ';
          html += generals.slice(0,6).map(function(c){
            // 该将领是否带私兵化军 (controlLevel>=60)
            var hisArmies = idx.armies.filter(function(a){return a.commander === c.name && (a.controlLevel||0)>=60;});
            var privTag = hisArmies.length > 0 ? '<span style="color:var(--red,#b04030);font-size:0.68rem;" title="私兵化">⚠</span>' : '';
            return '<span style="color:var(--txt-s);">'+esc(c.name)+'</span>'+privTag;
          }).join('·');
          if (generals.length > 6) html += ' <span style="color:var(--txt-d);">+'+(generals.length-6)+'</span>';
          html += '</div>';
        }
        // 宗室 (前 4)
        if (m.charByRole.clan > 0) {
          var clans = idx.chars.filter(function(c){
            var p = String(c.position||c.title||'');
            return /宗室|亲王|郡王|公主|贝勒/.test(p);
          });
          if (clans.length > 0) {
            html += '<div style="margin-bottom:0.2rem;"><span style="color:var(--txt-d);">宗室:</span> ';
            html += clans.slice(0,4).map(function(c){return '<span style="color:var(--txt-s);">'+esc(c.name)+'</span>';}).join('·');
            if (clans.length > 4) html += ' <span style="color:var(--txt-d);">+'+(clans.length-4)+'</span>';
            html += '</div>';
          }
        }
        html += '</div>';
      }

      // ─────── Layer 1·军队 inline ───────
      if (m && m.armyCount > 0) {
        var crisisIcon = '';
        if (m.arrearsArmies > 0) crisisIcon += '<span style="color:var(--red);" title="欠饷军">饷'+m.arrearsArmies+'</span> ';
        if (m.avgMutinyRisk >= 50) crisisIcon += '<span style="color:var(--red);" title="平均兵变风险">变'+m.avgMutinyRisk+'</span> ';
        if (m.privatizedRatio >= 0.4) crisisIcon += '<span style="color:var(--amber, #e0a040);" title="私兵化比例">私'+Math.round(m.privatizedRatio*100)+'%</span> ';
        html += '<div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px dashed var(--bd,rgba(255,255,255,0.08));font-size:0.74rem;">';
        html += '<div style="color:var(--txt-d);margin-bottom:0.25rem;">军队 '+m.armyCount+' 支 · 总兵 '+(m.totalSoldiers>=10000?Math.round(m.totalSoldiers/10000)+'万':m.totalSoldiers)+(crisisIcon?(' · '+crisisIcon):'')+'</div>';
        // 列前 6 支
        html += '<div style="line-height:1.6;">';
        idx.armies.slice(0,6).forEach(function(a){
          var sd = (a.soldiers||a.size||0);
          var sdLabel = sd >= 10000 ? Math.round(sd/10000)+'万' : sd;
          var dot = (a.mutinyRisk||0) >= 60 ? 'var(--red)' : (a.morale||100) >= 60 ? 'var(--green)' : 'var(--amber, #e0a040)';
          html += '<span style="color:var(--txt-s);">'+esc(a.name)+' </span>';
          html += '<span style="color:var(--txt-d);font-size:0.68rem;">['+sdLabel+(a.commander?'·'+esc(a.commander):'')+']</span>';
          html += '<span style="color:'+dot+';font-size:0.6rem;"> ●</span> ';
        });
        if (idx.armies.length > 6) html += '<span style="color:var(--txt-d);">+'+(idx.armies.length-6)+'</span>';
        html += '</div></div>';
      }

      // ─────── Layer 1·党派 inline (仅本朝/有党派) ───────
      if (m && Object.keys(idx.parties).length > 0) {
        html += '<div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px dashed var(--bd,rgba(255,255,255,0.08));font-size:0.74rem;">';
        var imbalanceTag = m.partyImbalance >= 0.5 ? ' <span style="color:var(--red);" title="党争失衡">⚠</span>' : '';
        html += '<div style="color:var(--txt-d);margin-bottom:0.25rem;">党派 (主导: '+esc(m.partyDominantName||'无')+')'+imbalanceTag+'</div>';
        html += '<div>';
        Object.keys(idx.parties).forEach(function(pn){
          var p = idx.parties[pn];
          var isDominant = pn === m.partyDominantName;
          html += '<span style="color:'+(isDominant?'var(--gold)':'var(--txt-s)')+';">'+esc(pn)+'</span>';
          html += '<span style="color:var(--txt-d);font-size:0.7rem;"> '+p.memberCount+'人'+(p.leader?(' ['+esc(p.leader)+']'):'')+'</span> · ';
        });
        html += '</div></div>';
      }

      // ─────── 领地 + 外交 ───────
      var extras = [];
      if (provCount > 0) extras.push('领地 '+provCount+' 处' + (provCount <= 4 ? ': '+prov.join('、') : (': '+prov.slice(0,4).join('、')+' +'+(provCount-4))));
      if (f.diplomacyStance) extras.push('外交: '+f.diplomacyStance);
      if (f.suzerainFaction) extras.push('宗主: '+f.suzerainFaction);
      if (Array.isArray(f.vassals) && f.vassals.length) extras.push('附庸: '+f.vassals.join('、'));
      if (f.ideology || f.culture) extras.push('意识: '+(f.ideology||f.culture));
      if (extras.length) {
        html += '<div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px dashed var(--bd,rgba(255,255,255,0.08));font-size:0.74rem;color:var(--txt-s);">'+esc(extras.join(' · '))+'</div>';
      }
      // 动作按钮（仅非玩家势力）
      if (!isPlayer) {
        html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">';
        html += '<button class="bt bs" onclick="_tsDeclareWar(\''+jsEsc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(200,50,50,0.15);border-color:var(--red,#b04030);">宣战</button>';
        html += '<button class="bt bs" onclick="_tsProposePeace(\''+jsEsc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">议和</button>';
        html += '<button class="bt bs" onclick="_tsGrantVassal(\''+jsEsc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">册封附庸</button>';
        html += '<button class="bt bs" onclick="_tsTribute(\''+jsEsc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">遣使通好</button>';
        html += '<button class="bt bs" onclick="_tsInspectNpcInternal(\''+jsEsc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(76,168,201,0.15);border-color:#4ca8c9;">查阅·内政</button>';
        html += '</div>';
      }
      html += '</div>';
    });

    // 关系矩阵(简化为邻接表)
    if (Array.isArray(GM.factionRelations) && GM.factionRelations.length > 0) {
      html += '<div style="margin-top:1rem;padding-top:0.8rem;border-top:1px solid var(--bd,rgba(255,255,255,0.1));">';
      html += '<div style="font-weight:600;margin-bottom:0.5rem;">势力关系矩阵</div>';
      html += '<div style="font-size:0.75rem;line-height:1.7;">';
      GM.factionRelations.slice(0, 30).forEach(function(r) {
        if (!r || !r.from || !r.to) return;
        var typeColor = r.type === 'war' ? 'var(--red)' : r.type === 'alliance' ? 'var(--green)' : r.type === 'vassal' ? 'var(--purple)' : 'var(--txt-s)';
        html += '<div>· <span style="color:var(--gold);">'+esc(r.from)+'</span> → <span style="color:var(--gold);">'+esc(r.to)+'</span> <span style="color:'+typeColor+';">['+esc(r.type||'中立')+']</span>';
        if (r.value !== undefined) html += ' '+r.value;
        if (r.desc) html += ' '+esc(r.desc);
        html += '</div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    _openModal('势力外交·关系总览', html, null);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  党派面板 (覆盖原 openPartyDetailPanel)
  // ══════════════════════════════════════════════════════════════════════
  function openPartyPanelEnhanced() {
    if (!global.GM || !Array.isArray(GM.parties) || GM.parties.length === 0) { _toast('暂无党派数据'); return; }
    var ps = GM.partyState || {};
    var html = '<div style="padding:0.8rem;max-height:78vh;overflow-y:auto;">';
    html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.8rem;">党派·影响值+官位占比+清名恶名·可弹劾/清党/召集</div>';

    GM.parties.forEach(function(p) {
      if (!p || !p.name) return;
      var s = ps[p.name] || {};
      var inf = s.influence !== undefined ? s.influence : (p.influence||0);
      var oc = s.officeCount || 0;
      var rep = s.reputationBalance || 0;
      var cohesion = s.cohesion !== undefined ? s.cohesion : (p.cohesion||50);
      var repColor = rep >= 30 ? 'var(--green)' : rep <= -30 ? 'var(--red)' : 'var(--gold)';
      var stclr = inf >= 60 ? 'var(--red)' : inf >= 30 ? 'var(--gold)' : 'var(--txt-d)';

      html += '<div style="background:var(--bg-2);border-radius:8px;padding:0.8rem;margin-bottom:0.7rem;border-left:4px solid '+stclr+';">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">';
      html += '<div><span style="font-weight:700;font-size:1rem;">'+esc(p.name)+'</span>';
      if (p.status) html += ' <span style="font-size:0.7rem;color:'+stclr+';">['+esc(p.status)+']</span>';
      html += '</div>';
      html += '<div style="font-size:0.76rem;color:'+stclr+';">影响 '+inf+' · 占官 '+oc+'</div>';
      html += '</div>';
      // 数值网格
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;font-size:0.75rem;margin-bottom:0.5rem;">';
      html += '<div><div style="color:var(--txt-d);">影响</div><div style="font-weight:600;color:'+stclr+';">'+inf+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">凝聚</div><div style="font-weight:600;">'+cohesion+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">官位</div><div style="font-weight:600;">'+oc+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">清誉</div><div style="font-weight:600;color:'+repColor+';">'+(rep>0?'+':'')+rep+'</div></div>';
      html += '</div>';
      // 基础信息
      var meta = [];
      if (p.leader) meta.push('领袖: '+p.leader);
      if (p.ideology) meta.push('立场: '+p.ideology);
      if (p.currentAgenda) meta.push('议程: '+p.currentAgenda);
      if (Array.isArray(s.conflictWith) && s.conflictWith.length) meta.push('宿敌: '+s.conflictWith.join('、'));
      if (Array.isArray(s.alliedWith) && s.alliedWith.length) meta.push('同盟: '+s.alliedWith.join('、'));
      if (meta.length) html += '<div style="font-size:0.74rem;color:var(--txt-s);margin-bottom:0.5rem;line-height:1.6;">'+esc(meta.join(' · '))+'</div>';
      // 近期弹劾/政策动态
      var dyn = [];
      if ((s.recentImpeachWin||0) > 0) dyn.push('<span style="color:var(--green);">近期弹劾胜×'+Math.round(s.recentImpeachWin)+'</span>');
      if ((s.recentImpeachLose||0) > 0) dyn.push('<span style="color:var(--red);">近期弹劾败×'+Math.round(s.recentImpeachLose)+'</span>');
      if ((s.recentPolicyWin||0) > 0) dyn.push('<span style="color:var(--green);">近期政策成×'+Math.round(s.recentPolicyWin)+'</span>');
      if (dyn.length) html += '<div style="font-size:0.72rem;margin-bottom:0.5rem;">'+dyn.join(' · ')+'</div>';
      // 动作按钮
      html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">';
      html += '<button class="bt bs" onclick="_tsImpeachByParty(\''+jsEsc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(200,50,50,0.12);">令言官弹劾</button>';
      html += '<button class="bt bs" onclick="_tsSummonParty(\''+jsEsc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">召集议事</button>';
      html += '<button class="bt bs" onclick="_tsPurgeParty(\''+jsEsc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(200,50,50,0.2);border-color:var(--red);">清算党人</button>';
      html += '<button class="bt bs" onclick="_tsBalanceParty(\''+jsEsc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">借势平衡</button>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    _openModal('朝中党派·影响与动作', html, null);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  军事面板 (覆盖原 openMilitaryDetailPanel)
  // ══════════════════════════════════════════════════════════════════════
  function openMilitaryPanelEnhanced() {
    if (!global.GM || !Array.isArray(GM.armies) || GM.armies.length === 0) { _toast('暂无军队数据'); return; }
    var playerFac = (global.P && P.playerInfo && P.playerInfo.factionName) || '';
    var html = '<div style="padding:0.8rem;max-height:78vh;overflow-y:auto;">';

    // 粮饷告急
    var crises = GM.armies.filter(function(a){return !a.destroyed && ((a.supply||100)<30 || (a.morale||100)<30 || (a.mutinyRisk||0)>=50 || (a.payArrearsMonths||0)>=3);});
    if (crises.length > 0) {
      html += '<div style="background:rgba(200,50,50,0.1);border:1px solid var(--red,#b04030);border-radius:6px;padding:0.6rem;margin-bottom:0.7rem;font-size:0.78rem;">';
      html += '<div style="font-weight:600;color:var(--red);margin-bottom:0.3rem;">【军情告急】'+crises.length+' 支部队需关注</div>';
      crises.slice(0, 3).forEach(function(a) {
        html += '<div>· '+esc(a.name)+(a.payArrearsMonths>=3?'·欠饷'+a.payArrearsMonths+'月':'')+(a.mutinyRisk>=50?'·兵变险'+a.mutinyRisk:'')+(a.supply<30?'·粮'+a.supply:'')+(a.morale<30?'·气'+a.morale:'')+'</div>';
      });
      html += '</div>';
    }

    // 按势力分组·Slice E·只读 a.faction (a.owner 已废)
    var byOwner = {};
    GM.armies.filter(function(a){return !a.destroyed;}).forEach(function(a) {
      var owner = a.faction || '无归属';
      if (!byOwner[owner]) byOwner[owner] = [];
      byOwner[owner].push(a);
    });

    Object.keys(byOwner).forEach(function(owner) {
      var isPlayer = owner === playerFac;
      html += '<div style="margin-bottom:1rem;">';
      html += '<div style="font-size:0.85rem;font-weight:600;color:'+(isPlayer?'var(--gold)':'var(--txt-s)')+';margin-bottom:0.4rem;border-bottom:1px dashed var(--bd,rgba(255,255,255,0.1));padding-bottom:0.3rem;">'+esc(owner)+(isPlayer?' (本朝)':'')+' · '+byOwner[owner].length+' 支</div>';
      byOwner[owner].forEach(function(a) {
        var bgColor = (a.mutinyRisk||0) >= 60 ? 'rgba(200,50,50,0.08)' : 'var(--bg-2)';
        html += '<div style="background:'+bgColor+';border-radius:6px;padding:0.6rem;margin-bottom:0.5rem;border-left:3px solid '+(a.mutinyRisk>=60?'var(--red)':(a.morale>=60?'var(--green)':'var(--amber, #e0a040)'))+';">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">';
        html += '<div><span style="font-weight:600;">'+esc(a.name)+'</span>';
        if (a.state && a.state !== 'garrison') html += ' <span style="font-size:0.7rem;color:var(--amber, #e0a040);background:rgba(224,160,64,0.1);padding:1px 5px;border-radius:3px;">'+esc({marching:'行军中',sieging:'围城中',routed:'溃散',disbanded:'解散'}[a.state]||a.state)+'</span>';
        html += '</div>';
        html += '<span style="font-size:0.75rem;color:var(--txt-d);">'+(a.soldiers||a.size||0)+' 兵</span>';
        html += '</div>';
        // 数值
        html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;font-size:0.7rem;margin-bottom:0.3rem;">';
        html += '<div><span style="color:var(--txt-d);">粮</span> '+(a.supply||0)+'</div>';
        html += '<div><span style="color:var(--txt-d);">气</span> '+(a.morale||0)+'</div>';
        html += '<div><span style="color:var(--txt-d);">训</span> '+(a.training||50)+'</div>';
        html += '<div><span style="color:var(--txt-d);">欠饷</span> '+(a.payArrearsMonths||0)+'月</div>';
        html += '<div><span style="color:var(--txt-d);">兵变</span> <span style="color:'+(a.mutinyRisk>=60?'var(--red)':'var(--txt-s)')+';">'+(a.mutinyRisk||0)+'</span></div>';
        html += '</div>';
        // 信息
        var info = [];
        if (a.commander) info.push('统帅: '+a.commander);
        if (a.garrison || a.location) info.push('驻: '+(a.garrison||a.location));
        if (a.destination) info.push('赴: '+a.destination);
        if (a.controlLevel >= 60) info.push('私兵度 '+a.controlLevel);
        if (info.length) html += '<div style="font-size:0.72rem;color:var(--txt-s);margin-bottom:0.3rem;">'+esc(info.join(' · '))+'</div>';
        // 动作按钮(仅玩家势力军队)
        if (isPlayer) {
          html += '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.3rem;">';
          html += '<button class="bt bs" onclick="_tsTransferArmy(\''+jsEsc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">调兵</button>';
          html += '<button class="bt bs" onclick="_tsBoostMorale(\''+jsEsc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">犒军鼓舞</button>';
          html += '<button class="bt bs" onclick="_tsSettleArrears(\''+jsEsc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">发饷清欠</button>';
          html += '<button class="bt bs" onclick="_tsAppointGeneral(\''+jsEsc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">易将</button>';
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    });

    html += '</div>';
    _openModal('兵部·各路军镇', html, null);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  结构化诏书 Handlers (9 个动作)
  // ══════════════════════════════════════════════════════════════════════
  function _tsDeclareWar(fname) {
    var reason = prompt('对 '+fname+' 宣战理由 / 讨伐檄文要旨?', '');
    if (reason === null) return;
    _pushEdict('谕：以『'+reason+'』为由·兴师讨伐 '+fname+'·令兵部整饬军备·户部筹措军饷。', '宣战');
    _toast('已颁·兴师伐 '+fname);
    if (global.GameEventBus && global.GameEventBus.emit) global.GameEventBus.emit('faction:declareWar', {target: fname, reason: reason});
  }
  function _tsProposePeace(fname) {
    var terms = prompt('向 '+fname+' 提议议和·条件?', '互不侵犯·约为兄弟');
    if (terms === null) return;
    _pushEdict('谕：遣使赴 '+fname+' 议和·条件『'+terms+'』。', '议和');
    _toast('已遣使议和');
  }
  function _tsGrantVassal(fname) {
    var type = prompt('册封 '+fname+' 为附庸·类型(朝贡/藩属/羁縻)?', '朝贡');
    if (type === null) return;
    _pushEdict('谕：册封 '+fname+' 为本朝之附庸·以『'+type+'』礼相待。', '册封');
    _toast('已颁册封诏');
  }
  function _tsTribute(fname) {
    _pushEdict('谕：遣礼部使节赴 '+fname+' 通好·赐绢帛·探其政情。', '通好');
    _toast('已遣通好使');
  }

  function _tsImpeachByParty(partyName) {
    var target = prompt('令言官弹劾·目标姓名(从 '+partyName+' 阵营中选)?', '');
    if (!target) return;
    var charge = prompt('罪名?', '贪渎·不法');
    if (charge === null) return;
    _pushEdict('谕：令科道言官弹劾 '+target+'('+partyName+')·罪名『'+charge+'』·着三法司会审。', '弹劾');
    if (global.GM && GM.partyState && GM.partyState[partyName]) {
      GM.partyState[partyName].recentImpeachLose = (GM.partyState[partyName].recentImpeachLose||0) + 1;
    }
    // 事件总线：供波5联动(可能导致该党武将 loyalty/opportunism 波动)
    try {
      if (global.GameEventBus && global.GameEventBus.emit) {
        global.GameEventBus.emit('party:impeach', { target: target, party: partyName, charge: charge });
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-three-systems-ui');}catch(_){}}
    _toast('已下弹劾');
  }
  function _tsSummonParty(partyName) {
    var topic = prompt('召集 '+partyName+' 骨干议事·议题?', '时政策议');
    if (topic === null) return;
    _pushEdict('谕：召 '+partyName+' 之首脑入内·商议『'+topic+'』。', '召集');
    _toast('已下召集诏');
  }
  function _tsPurgeParty(partyName) {
    if (!confirm('确认清算 '+partyName+' ? 此举必引大狱·党祸流血·后果难料。')) return;
    var extent = prompt('清洗范围(首脑/骨干/全党)?', '首脑');
    if (extent === null) return;
    _pushEdict('谕：以『党祸』为罪·清洗 '+partyName+' 之『'+extent+'』·着锦衣卫缉拿·三法司会鞫。', '党祸');
    if (global.GM && GM.partyState && GM.partyState[partyName]) {
      GM.partyState[partyName].recentImpeachLose = (GM.partyState[partyName].recentImpeachLose||0) + 5;
      GM.partyState[partyName].influence = Math.max(0, GM.partyState[partyName].influence - 20);
    }
    // 事件总线：波5 listener 会让同党武将 loyalty-25/mutinyRisk+20
    try {
      if (global.GameEventBus && global.GameEventBus.emit) {
        global.GameEventBus.emit('party:purge', { party: partyName, extent: extent });
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-three-systems-ui');}catch(_){}}
    _toast('党祸已起·慎之');
  }
  function _tsBalanceParty(partyName) {
    var rival = prompt('借势 '+partyName+' 以平衡何党?', '');
    if (rival === null) return;
    _pushEdict('谕：重用 '+partyName+' 之清流·以制衡 '+rival+' 之专权。', '制衡');
    if (global.GM && GM.partyState && GM.partyState[partyName]) {
      GM.partyState[partyName].recentPolicyWin = (GM.partyState[partyName].recentPolicyWin||0) + 2;
    }
    _toast('已颁制衡诏');
  }

  function _tsTransferArmy(aname) {
    var dest = prompt('调 '+aname+' 赴何处?', '');
    if (!dest) return;
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) {
      a.destination = dest;
      a.state = 'marching';
      var dist = 15 + Math.round(Math.random() * 20);
      a.marchDaysLeft = dist;
    }
    _pushEdict('谕：调 '+aname+' 即日拔营·赴 '+dest+'·沿途驿路供给。', '调兵');
    _toast('已调 '+aname+'→'+dest);
  }
  function _tsBoostMorale(aname) {
    _pushEdict('谕：犒 '+aname+' 三军·赐酒肉·彰其勋劳。', '犒军');
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) { a.morale = Math.min(100, (a.morale||50) + 10); a.loyalty = Math.min(100, (a.loyalty||60) + 5); }
    _toast('已犒 '+aname);
  }
  function _tsSettleArrears(aname) {
    _pushEdict('谕：户部速拨银两·发 '+aname+' 积欠军饷·安定军心。', '发饷');
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) { a.payArrearsMonths = 0; a.mutinyRisk = Math.max(0, (a.mutinyRisk||0) - 30); }
    _toast('饷已清·兵变险大减');
  }
  function _tsAppointGeneral(aname) {
    var target = prompt('易将·新统帅姓名?', '');
    if (!target) return;
    _pushEdict('谕：擢 '+target+' 为 '+aname+' 新统帅·原统帅另有任用。', '易将');
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) { a.commander = target; a.loyalty = Math.max(30, (a.loyalty||60) - 10); }
    _toast('已易将');
  }

  // ─── 暴露 ───
  global._tsDeclareWar = _tsDeclareWar;
  global._tsProposePeace = _tsProposePeace;
  global._tsGrantVassal = _tsGrantVassal;
  global._tsTribute = _tsTribute;
  global._tsImpeachByParty = _tsImpeachByParty;
  global._tsSummonParty = _tsSummonParty;
  global._tsPurgeParty = _tsPurgeParty;
  global._tsBalanceParty = _tsBalanceParty;
  global._tsTransferArmy = _tsTransferArmy;
  global._tsBoostMorale = _tsBoostMorale;
  global._tsSettleArrears = _tsSettleArrears;
  global._tsAppointGeneral = _tsAppointGeneral;

  // ────────── Phase C6·NPC 内政查阅 (read-only) ──────────
  function _tsInspectNpcInternal(facName) {
    if (!global.GM || !Array.isArray(GM.facs)) { _toast('暂无势力数据'); return; }
    var fac = GM.facs.find(function(x){ return x && x.name === facName; });
    if (!fac) { _toast('势力不存在·' + facName); return; }
    var playerFac = (global.P && P.playerInfo && P.playerInfo.factionName) || '';
    if (fac.name === playerFac) { _toast('本朝内政走主面板'); return; }

    var memorials = Array.isArray(fac.npcMemorials) ? fac.npcMemorials : [];
    var edicts = Array.isArray(fac.npcEdicts) ? fac.npcEdicts : [];
    var chaoyi = Array.isArray(fac.npcChaoyi) ? fac.npcChaoyi : [];
    var officeActions = Array.isArray(fac.npcOfficeActions) ? fac.npcOfficeActions : [];
    var ledger = Array.isArray(fac.npcFiscalLedger) ? fac.npcFiscalLedger : [];
    var militaryActions = Array.isArray(fac.npcMilitaryActions) ? fac.npcMilitaryActions : [];
    var diplomacyActions = Array.isArray(fac.npcDiplomacyActions) ? fac.npcDiplomacyActions : [];
    var provincePolicies = Array.isArray(fac.npcProvincePolicies) ? fac.npcProvincePolicies : [];
    var fiscalActions = Array.isArray(fac.npcFiscalActions) ? fac.npcFiscalActions : [];
    var intrigueActions = Array.isArray(fac.npcIntrigueActions) ? fac.npcIntrigueActions : [];
    var rebellionPolicies = Array.isArray(fac.npcRebellionPolicies) ? fac.npcRebellionPolicies : [];

    var html = '<div style="padding:0.8rem;max-height:78vh;overflow-y:auto;">';
    html += '<div style="font-size:0.78rem;color:var(--txt-d);margin-bottom:0.8rem;">观察·' + esc(fac.name) + ' 内政 (read-only·情报视角)·勿言敌国之政非己事</div>';

    // 简要数值
    var ds = fac.derivedStrength || null;
    var de = fac.derivedEconomy || null;
    var dh = fac.derivedHealth || null;
    if (ds || de || dh) {
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;font-size:0.76rem;margin-bottom:0.8rem;background:var(--bg-2);padding:0.5rem;border-radius:6px;">';
      if (ds) html += '<div><div style="color:var(--txt-d);">综合实力</div><div style="font-weight:600;">'+ds.value+'/'+ds.label+'</div></div>';
      if (dh) html += '<div><div style="color:var(--txt-d);">健康度</div><div style="font-weight:600;">'+dh.overall+'/'+(dh.labels&&dh.labels.overall||'?')+'</div></div>';
      if (de) html += '<div><div style="color:var(--txt-d);">财政压</div><div style="font-weight:600;">'+de.fiscalStress+'/'+(de.labels&&de.labels.economyHealth||'?')+'</div></div>';
      var dc = fac.derivedCohesion;
      if (dc) html += '<div><div style="color:var(--txt-d);">凝聚</div><div style="font-weight:600;">'+dc.overall+'/'+(dc.labels&&dc.labels.overall||'?')+'</div></div>';
      html += '</div>';
    }

    // 财政账本
    if (ledger.length > 0) {
      html += '<div style="margin-bottom:0.7rem;"><div style="font-weight:600;color:var(--gold);margin-bottom:0.3rem;">财政·近 '+Math.min(ledger.length,6)+' 月</div>';
      html += '<div style="font-size:0.74rem;background:var(--bg-2);border-radius:4px;padding:0.4rem;">';
      ledger.slice(-6).reverse().forEach(function(l){
        var crisisTag = l.crisis ? ' <span style="color:var(--red);">⚠危</span>' : '';
        html += '<div>第'+l.turn+'回·入'+l.monthlyIncome+'·支'+l.monthlyExpense+'·net'+(l.net>=0?'+':'')+l.net+'·库'+l.treasuryAfter+crisisTag+'</div>';
      });
      html += '</div></div>';
    }

    // 诏令
    if (edicts.length > 0) {
      html += '<div style="margin-bottom:0.7rem;"><div style="font-weight:600;color:var(--gold);margin-bottom:0.3rem;">诏令·近 '+Math.min(edicts.length,5)+' 道</div>';
      html += '<div style="font-size:0.76rem;background:var(--bg-2);border-radius:4px;padding:0.4rem;">';
      edicts.slice(-5).reverse().forEach(function(e){
        var llmTag = e._generatedByLlm ? ' <span style="color:var(--celadon-400,#6bb07c);font-size:0.7rem;">[LLM 决策]</span>'
                   : (e._enrichedContent ? ' <span style="color:var(--celadon-400,#6bb07c);font-size:0.7rem;">[文]</span>' : '');
        html += '<div style="margin-bottom:0.3rem;border-left:2px solid '+(e.trigger&&e.trigger.indexOf('危')>=0?'var(--red)':'var(--gold)')+';padding-left:0.5rem;">';
        html += '<div style="color:var(--txt-d);">第'+e.turn+'回·['+esc(e.type)+'·'+esc(e.trigger)+'] '+esc(e.issuer)+llmTag+'</div>';
        html += '<div>'+esc(e._enrichedContent || e.content)+'</div></div>';
      });
      html += '</div></div>';
    }

    // 奏疏
    if (memorials.length > 0) {
      html += '<div style="margin-bottom:0.7rem;"><div style="font-weight:600;color:var(--gold);margin-bottom:0.3rem;">奏疏·近 '+Math.min(memorials.length,5)+' 折</div>';
      html += '<div style="font-size:0.76rem;background:var(--bg-2);border-radius:4px;padding:0.4rem;">';
      memorials.slice(-5).reverse().forEach(function(m){
        var statusColor = m.status === 'approved' ? 'var(--green)' : m.status === 'rejected' ? 'var(--red)' : 'var(--txt-s)';
        var llmTag = m._generatedByLlm ? ' <span style="color:var(--celadon-400,#6bb07c);font-size:0.7rem;">[LLM 决策]</span>'
                   : (m._enrichedContent ? ' <span style="color:var(--celadon-400,#6bb07c);font-size:0.7rem;">[文]</span>' : '');
        html += '<div style="margin-bottom:0.3rem;border-left:2px solid '+statusColor+';padding-left:0.5rem;">';
        html += '<div style="color:var(--txt-d);">第'+m.turn+'回·'+esc(m.from)+'('+esc(m.fromRole)+') → '+esc(m.to)+' [<span style="color:'+statusColor+';">'+esc(m.status)+'</span>]'+llmTag+'</div>';
        html += '<div>'+esc(m._enrichedContent || m.content)+'</div>';
        if (m.ruling) html += '<div style="color:var(--gold);font-size:0.72rem;">朱批: '+esc(m.ruling)+'</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // 朝议
    if (chaoyi.length > 0) {
      html += '<div style="margin-bottom:0.7rem;"><div style="font-weight:600;color:var(--gold);margin-bottom:0.3rem;">朝议·近 '+Math.min(chaoyi.length,5)+' 次</div>';
      html += '<div style="font-size:0.76rem;background:var(--bg-2);border-radius:4px;padding:0.4rem;">';
      chaoyi.slice(-5).reverse().forEach(function(c){
        html += '<div>第'+c.turn+'回·['+esc(c.type)+'] '+esc(c.summary)+'</div>';
      });
      html += '</div></div>';
    }

    // 人事
    if (officeActions.length > 0) {
      html += '<div style="margin-bottom:0.7rem;"><div style="font-weight:600;color:var(--gold);margin-bottom:0.3rem;">人事·近 '+Math.min(officeActions.length,5)+' 项</div>';
      html += '<div style="font-size:0.76rem;background:var(--bg-2);border-radius:4px;padding:0.4rem;">';
      officeActions.slice(-5).reverse().forEach(function(a){
        var actionColor = a.action === 'promote' ? 'var(--green)' : 'var(--red)';
        html += '<div style="border-left:2px solid '+actionColor+';padding-left:0.5rem;">第'+a.turn+'回·['+esc(a.action)+'] '+esc(a.target)+' ('+esc(a.effect.positionFrom)+'→'+esc(a.effect.positionTo)+') '+esc(a.reason)+'</div>';
      });
      html += '</div></div>';
    }

    html += _renderNpcActionSection('军务', militaryActions, 5, _npcMilitaryActionText);
    html += _renderNpcActionSection('外交', diplomacyActions, 5, _npcDiplomacyActionText);
    html += _renderNpcActionSection('地政', provincePolicies, 5, _npcProvincePolicyText);
    html += _renderNpcActionSection('财计', fiscalActions, 5, _npcFiscalActionText);
    html += _renderNpcActionSection('间谍', intrigueActions, 5, _npcIntrigueActionText);
    html += _renderNpcActionSection('叛乱', rebellionPolicies, 5, _npcRebellionPolicyText);

    if (memorials.length === 0 && edicts.length === 0 && chaoyi.length === 0 && officeActions.length === 0 && ledger.length === 0
        && militaryActions.length === 0 && diplomacyActions.length === 0 && provincePolicies.length === 0 && fiscalActions.length === 0
        && intrigueActions.length === 0 && rebellionPolicies.length === 0) {
      html += '<div style="color:var(--txt-d);padding:1rem;text-align:center;">暂无内政记录·该势力 chars 数据稀少或刚刚生成</div>';
    }

    // ─────── Phase G·LLM 决策按钮 (开关 on 时显示) ───────
    var llmOn = (global.TM && TM.FactionNpcSettings && TM.FactionNpcSettings.isAiPrecisionEnabled());
    if (llmOn) {
      html += '<div style="margin-top:0.8rem;padding-top:0.5rem;border-top:1px dashed var(--bd,rgba(255,255,255,0.1));">';
      html += '<button class="bt bs" onclick="_tsNpcLlmDecide(\''+jsEsc(fac.name)+'\')" style="font-size:0.75rem;padding:0.3rem 0.7rem;background:rgba(107,176,124,0.15);color:var(--celadon-400,#6bb07c);">让 LLM 主君决策本回合</button>';
      html += '<button class="bt bs" onclick="_tsInspectFactionAiDebug(\''+jsEsc(fac.name)+'\')" style="font-size:0.7rem;padding:0.25rem 0.5rem;margin-left:0.4rem;">势力AI账本</button>';
      html += '<button class="bt bs" onclick="_tsNpcEnrich(\''+jsEsc(fac.name)+'\')" style="font-size:0.7rem;padding:0.25rem 0.5rem;margin-left:0.4rem;background:rgba(107,176,124,0.05);color:var(--celadon-400,#6bb07c);">仅润色文字 (cosmetic)</button>';
      // 上次 rationale 显示
      if (fac._lastLlmRationale) {
        html += '<div style="font-size:0.72rem;color:var(--celadon-400,#6bb07c);margin-top:0.3rem;padding:0.4rem;background:rgba(107,176,124,0.05);border-left:2px solid var(--celadon-400,#6bb07c);">第'+fac._lastLlmRationale.turn+'回·LLM 主君考量: '+_renderAiFullText(fac._lastLlmRationale.text, 220)+'</div>';
      } else {
        html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:0.3rem;">点击触发 LLM 真做决策·影响 char.loyalty/treasury·~3-5s</div>';
      }
      html += '</div>';
    }

    // ─────── Phase F2·player 干预动作 ───────
    html += '<div style="margin-top:1rem;padding-top:0.8rem;border-top:1px solid var(--bd,rgba(255,255,255,0.1));">';
    html += '<div style="font-weight:600;color:var(--gold);margin-bottom:0.4rem;">⚙ 暗中干预 ('+esc(fac.name)+')·消耗本朝资源·结果不可逆</div>';
    html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">';
    html += '<button class="bt bs" onclick="_tsNpcSpreadRumor(\''+jsEsc(fac.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(184,154,83,0.1);">散播谣言 (-2 万两)</button>';
    html += '<button class="bt bs" onclick="_tsNpcSponsorRebellion(\''+jsEsc(fac.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(184,90,50,0.1);">资助派系内斗 (-10 万两·5 万石粮)</button>';
    // bribe / espionage 按 char·要先选 char
    var entry = global.GM._facIndex && GM._facIndex[fac.name];
    var bribableChars = (entry && entry.chars) ? entry.chars.filter(function(c){ return c.alive !== false; }).slice(0, 3) : [];
    if (bribableChars.length > 0) {
      bribableChars.forEach(function(c){
        var disp = c.name.length > 8 ? c.name.slice(0, 7) + '..' : c.name;
        html += '<button class="bt bs" onclick="_tsNpcBribe(\''+jsEsc(fac.name)+'\',\''+jsEsc(c.name)+'\')" style="font-size:0.7rem;padding:0.25rem 0.5rem;background:rgba(107,176,124,0.08);">暗结·'+esc(disp)+' (-5 万两)</button>';
      });
      bribableChars.slice(0, 2).forEach(function(c){
        var disp = c.name.length > 8 ? c.name.slice(0, 7) + '..' : c.name;
        html += '<button class="bt bs" onclick="_tsNpcEspionage(\''+jsEsc(fac.name)+'\',\''+jsEsc(c.name)+'\')" style="font-size:0.7rem;padding:0.25rem 0.5rem;background:rgba(76,168,201,0.08);">间谍·'+esc(disp)+' (-8 万两)</button>';
      });
    }
    html += '</div>';
    // 历史
    var interventions = (global.TM && TM.FactionNpcIntervention && TM.FactionNpcIntervention.getLog) ? TM.FactionNpcIntervention.getLog(fac.name) : [];
    if (interventions.length > 0) {
      html += '<div style="font-size:0.72rem;color:var(--txt-d);margin-top:0.4rem;">已用干预 ('+interventions.length+'):';
      interventions.slice(-5).reverse().forEach(function(i){
        html += '<div>· 第'+i.turn+'回·['+esc(i.action)+'] '+(i.targetChar?'目标:'+esc(i.targetChar):'')+'</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';
    _openModal('内政查阅·' + fac.name, html, null);
  }
  global._tsInspectNpcInternal = _tsInspectNpcInternal;

  function _aiDbgClip(v, max) {
    var s = '';
    if (v == null) return '';
    if (typeof v === 'string') s = v;
    else {
      try { s = JSON.stringify(v); } catch(_) { s = String(v); }
    }
    max = max || 160;
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function _aiDbgText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch(_) { return String(v); }
  }

  function _renderAiFullText(v, max) {
    var s = _aiDbgText(v);
    if (!s) return '';
    max = max || 180;
    if (s.length <= max) return '<span>' + esc(s) + '</span>';
    return '<details class="tm-ai-fulltext" style="margin-top:0.25rem;">'
      + '<summary style="cursor:pointer;color:var(--txt-s);">' + esc(_aiDbgClip(s, max)) + '</summary>'
      + '<pre style="white-space:pre-wrap;margin:0.4rem 0 0;padding:0.45rem;background:rgba(0,0,0,0.18);border:1px solid var(--bd,rgba(255,255,255,0.1));border-radius:4px;color:var(--txt);font:inherit;line-height:1.65;max-height:22rem;overflow:auto;">' + esc(s) + '</pre>'
      + '</details>';
  }

  function _aiDbgCounts(rows) {
    var out = {};
    (Array.isArray(rows) ? rows : []).forEach(function(r){
      var k = (r && r.status) || 'unknown';
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  function _aiDbgPairs(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return Object.keys(obj).map(function(k){ return esc(k) + ':' + esc(obj[k]); }).join(' / ');
  }

  function _tsInspectFactionAiDebug(facName) {
    if (!global.GM || !Array.isArray(GM.facs)) { _toast('暂无势力数据'); return; }
    var fac = GM.facs.find(function(x){ return x && x.name === facName; });
    if (!fac) { _toast('势力不存在 ' + facName); return; }
    var diag = null;
    try {
      if (global.TM && TM.FactionNpcLlmDecision && typeof TM.FactionNpcLlmDecision.buildFactionAiDiagnostics === 'function') {
        diag = TM.FactionNpcLlmDecision.buildFactionAiDiagnostics(fac.name);
      }
    } catch(_){}
    var ledger = (diag && Array.isArray(diag.actionLedger)) ? diag.actionLedger : (Array.isArray(fac._npcLlmActionLedger) ? fac._npcLlmActionLedger : []);
    var directive = (diag && diag.sc16Directive) || (GM._sc16FactionDirectives && GM._sc16FactionDirectives.byFaction && GM._sc16FactionDirectives.byFaction[fac.name]) || fac._sc16Directive || null;
    var run = (diag && diag.run) || (GM._npcFactionLlmLedger && GM._npcFactionLlmLedger.runs && GM._npcFactionLlmLedger.runs[fac.name]) || null;
    var settings = {};
    try {
      if (diag && diag.settings) settings = diag.settings;
      else if (global.TM && TM.FactionNpcSettings && typeof TM.FactionNpcSettings.getStatus === 'function') settings = TM.FactionNpcSettings.getStatus() || {};
    } catch(_){}
    var candidateRank = diag && diag.candidateRank || null;
    var actionContract = '';
    try {
      if (global.TM && TM.FactionActionEngine) {
        if (!candidateRank && typeof TM.FactionActionEngine.scoreFactionCandidate === 'function') candidateRank = TM.FactionActionEngine.scoreFactionCandidate(fac, { turn: (GM && GM.turn) || 1 });
        if (typeof TM.FactionActionEngine.formatActionContractForPrompt === 'function') actionContract = TM.FactionActionEngine.formatActionContractForPrompt({ maxChars: 900 });
      }
    } catch(_){}
    var qiju = (diag && Array.isArray(diag.qijuWrites)) ? diag.qijuWrites.slice(-8).reverse() : (Array.isArray(GM.qijuHistory) ? GM.qijuHistory : []).filter(function(q){
      if (!q) return false;
      var src = q._source || '';
      if (['npc-in-turn-llm','npc-bridge','faction-npc-llm'].indexOf(src) < 0) return false;
      return q._facName === fac.name || _aiDbgClip(q, 260).indexOf(fac.name) >= 0;
    }).slice(-8).reverse();
    var dispatch = diag && diag.dispatch || GM._npcFactionLlmDispatchLedger || null;

    var html = '<div style="padding:0.9rem;max-height:78vh;overflow-y:auto;">';
    html += '<div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;margin-bottom:0.8rem;">';
    html += '<div><h3 style="margin:0;color:var(--gold);">势力 AI 调试 · ' + esc(fac.name) + '</h3><div style="font-size:0.76rem;color:var(--txt-d);">查看 SC16 战略指令、精细化 LLM 执行账本、失败/合并原因与近事写入。</div></div>';
    html += '<button class="bt bs" onclick="_tsNpcLlmDecide(\'' + jsEsc(fac.name) + '\')">手动精细推演</button>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.5rem;margin-bottom:0.8rem;font-size:0.74rem;">';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>精细化开关</b><br>' + esc(settings.enabled != null ? settings.enabled : (settings.npcAiPrecision != null ? settings.npcAiPrecision : 'unknown')) + '</div>';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>并发/上限</b><br>' + esc(settings.concurrency || settings.npcAiPrecisionConcurrency || '?') + ' / ' + esc(settings.maxPerTurn || settings.npcAiPrecisionMaxPerTurn || '?') + '</div>';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>本轮 run</b><br>' + esc(run ? (run.status || run.state || 'running') : '未记录') + '</div>';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>调度/动作</b><br>' + esc(dispatch && dispatch.jobs ? dispatch.jobs.length : 0) + ' job / ' + esc(ledger.length) + ' 条</div>';
    html += '</div>';

    if (run && run.failure) {
      var fail = run.failure || {};
      html += '<div style="margin-bottom:0.8rem;background:rgba(184,80,60,0.1);padding:0.55rem;border-left:2px solid var(--red,#b04030);font-size:0.73rem;">';
      html += '<b>LLM 失败诊断</b><br>kind=' + esc(fail.kind || '?') + ' / attempts=' + esc(fail.attempts || 0) + ' / maxTokens=' + esc(fail.maxTokens || 0) + ' / rawLength=' + esc(fail.rawLength || 0);
      if (fail.possibleTruncation) html += ' <span style="color:var(--red,#b04030);">疑似输出截断</span>';
      if (fail.rawPreview) html += '<div style="margin-top:0.35rem;">raw preview: ' + _renderAiFullText(fail.rawPreview, 260) + '</div>';
      html += '</div>';
    }

    if (candidateRank || fac._lastLlmApplySummary) {
      var s = fac._lastLlmApplySummary || {};
      html += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.5rem;margin-bottom:0.8rem;font-size:0.74rem;">';
      html += '<div style="background:rgba(205,165,76,0.08);padding:0.5rem;border-radius:4px;"><b>候选评分</b><br>' + (candidateRank ? ('score=' + esc(Math.round(candidateRank.score || 0)) + ' / ' + esc((candidateRank.reasons || []).join('、'))) : '暂无') + '</div>';
      html += '<div style="background:rgba(107,176,124,0.08);padding:0.5rem;border-radius:4px;"><b>上次执行汇总</b><br>' + (fac._lastLlmApplySummary ? ('T' + esc(s.turn || '?') + ' 尝试' + esc(s.attemptedActions || 0) + ' 成功' + esc(s.appliedActions || 0) + ' 跳过' + esc(s.skippedActions || 0) + ' 合并' + esc(s.mergedActions || 0)) : '暂无') + '</div>';
      html += '</div>';
    }

    html += '<div style="margin-bottom:0.8rem;background:var(--bg-2);padding:0.55rem;border-radius:4px;font-size:0.75rem;">';
    html += '<b style="color:var(--gold);">SC16 指令</b>';
    if (directive) {
      html += '<div>turn=' + esc(directive.turn || '?') + ' direct=' + esc(directive.hasDirectContent ? 'yes' : 'no') + '</div>';
      (directive.directives || []).slice(0, 3).forEach(function(d){ html += '<div>指令：' + _renderAiFullText(d.strategic_intent || d.must_follow || d.reason || d, 180) + '</div>'; });
      (directive.actions || []).slice(0, 4).forEach(function(a){ html += '<div>行动：' + _renderAiFullText((a.faction || fac.name) + ' -> ' + (a.target || a.targetFaction || '') + ' ' + (a.action || a.intent || ''), 180) + '</div>'; });
      (directive.diplomacy || []).slice(0, 4).forEach(function(d){ html += '<div>外交：' + _renderAiFullText((d.from || '?') + ' -> ' + (d.to || '?') + ' ' + (d.new_relation || d.type || ''), 160) + '</div>'; });
    } else {
      html += '<div style="color:var(--txt-d);">暂无 SC16 指令账本。通常说明本局尚未跑过 full 势力自主推演，或本回合 SC16 失败。</div>';
    }
    html += '</div>';

    if (actionContract) {
      html += '<details style="margin-bottom:0.8rem;background:var(--bg-2);padding:0.55rem;border-radius:4px;font-size:0.72rem;"><summary style="cursor:pointer;color:var(--gold);">动作契约</summary><pre style="white-space:pre-wrap;margin:0.45rem 0 0;color:var(--txt);">' + esc(actionContract) + '</pre></details>';
    }

    if (fac._lastLlmRationale) {
      html += '<div style="margin-bottom:0.8rem;background:rgba(107,176,124,0.08);padding:0.55rem;border-left:2px solid var(--celadon-400,#6bb07c);font-size:0.75rem;"><b>上次君主考量 T' + esc(fac._lastLlmRationale.turn || '?') + '</b><br>' + _renderAiFullText(fac._lastLlmRationale.text, 260) + '</div>';
    }

    html += '<div style="margin-bottom:0.8rem;"><b style="color:var(--gold);font-size:0.78rem;">最近 LLM 动作账本</b>';
    html += '<div style="font-size:0.72rem;background:var(--bg-2);border-radius:4px;padding:0.45rem;">';
    if (ledger.length) ledger.slice(-18).reverse().forEach(function(r){
      html += '<div style="border-bottom:1px dashed rgba(255,255,255,0.08);padding:0.25rem 0;"><b>T' + esc(r.turn || '?') + ' ' + esc(r.type || '?') + '</b> <span style="color:var(--txt-d);">' + esc(r.status || '?') + ' / ' + esc(r.source || '') + '</span><br>' + _renderAiFullText(r.detail, 180) + '</div>';
    });
    else html += '<div style="color:var(--txt-d);">暂无动作账本。</div>';
    html += '</div></div>';

    html += '<div><b style="color:var(--gold);font-size:0.78rem;">近事/起居注写入</b><div style="font-size:0.72rem;background:var(--bg-2);border-radius:4px;padding:0.45rem;">';
    if (qiju.length) qiju.forEach(function(q){ html += '<div>[' + esc(q._source || '?') + '] T' + esc(q.turn || '?') + ' ' + _renderAiFullText(q.content || q.text || q.zhengwen || q, 180) + '</div>'; });
    else html += '<div style="color:var(--txt-d);">暂无精细化近事写入。</div>';
    html += '</div></div>';
    html += '</div>';
    _openModal('势力 AI 调试 · ' + fac.name, html, null);
  }
  global._tsInspectFactionAiDebug = _tsInspectFactionAiDebug;

  // ─────── Phase F2·干预 action handlers ───────
  function _runIntervention(fnName, args, successMsg) {
    if (!global.TM || !TM.FactionNpcIntervention || !TM.FactionNpcIntervention[fnName]) {
      _toast('干预 API 未加载'); return;
    }
    var ret = TM.FactionNpcIntervention[fnName].apply(null, args);
    if (!ret || !ret.ok) {
      _toast('×' + (ret && ret.reason || '干预失败'));
      return;
    }
    _toast('✓' + successMsg);
    // 刷新当前 panel
    if (args[0]) setTimeout(function(){ _tsInspectNpcInternal(args[0]); }, 200);
  }
  function _tsNpcBribe(fac, c) { _runIntervention('bribe', [fac, c], '已暗结·' + c); }
  function _tsNpcSponsorRebellion(fac) { _runIntervention('sponsorRebellion', [fac], '已资助 ' + fac + ' 派系内斗'); }
  function _tsNpcSpreadRumor(fac) { _runIntervention('spreadRumor', [fac], '已散谣·' + fac + ' 朝堂震动'); }
  function _tsNpcEspionage(fac, c) { _runIntervention('espionage', [fac, c], '已策反·' + c); }
  global._tsNpcBribe = _tsNpcBribe;
  global._tsNpcSponsorRebellion = _tsNpcSponsorRebellion;
  global._tsNpcSpreadRumor = _tsNpcSpreadRumor;
  global._tsNpcEspionage = _tsNpcEspionage;

  // Phase F4·手动 trigger LLM enrich (cosmetic·按 fac)
  function _tsNpcEnrich(facName) {
    if (!global.TM || !TM.FactionNpcLlmEnrich) { _toast('LLM enrich 模块未加载'); return; }
    if (!TM.FactionNpcSettings || !TM.FactionNpcSettings.isAiPrecisionEnabled()) {
      _toast('未启用 NPC LLM 精细化·先去设置打开');
      return;
    }
    _toast('润色中...');
    var promise = TM.FactionNpcLlmEnrich.enrichFaction
      ? TM.FactionNpcLlmEnrich.enrichFaction(facName)
      : TM.FactionNpcLlmEnrich.enrichRecent();
    promise.then(function(r){
      _toast('润色完成·' + (r && r.enriched || 0) + '/' + (r && r.attempted || 0));
      setTimeout(function(){ _tsInspectNpcInternal(facName); }, 100);
    }).catch(function(e){
      _toast('×润色失败·' + ((e && e.message) || e));
    });
  }
  global._tsNpcEnrich = _tsNpcEnrich;

  // Phase G·手动 trigger LLM 决策 (mechanic·真改数据·按 fac)
  function _tsNpcLlmDecide(facName) {
    if (!global.TM || !TM.FactionNpcLlmDecision) { _toast('LLM decision 模块未加载'); return; }
    if (!TM.FactionNpcSettings || !TM.FactionNpcSettings.isAiPrecisionEnabled()) {
      _toast('未启用 NPC LLM 精细化·先去设置打开');
      return;
    }
    _toast('LLM 主君决策中...约 3-5 秒');
    TM.FactionNpcLlmDecision.decideFor(facName, { source: 'manual', turn: (GM && GM.turn) || 1 }).then(function(r){
      if (r.applied) {
        var s = r.summary || {};
        _toast('✓决策应用·mem=' + (s.memorials || 0) + ' edict=' + (s.edicts || 0) + ' chaoyi=' + (s.chaoyi || 0) + ' office=' + (s.office || 0));
        setTimeout(function(){ _tsInspectNpcInternal(facName); }, 200);
      } else {
        _toast('×LLM 决策未应用·' + (r.reason || '未知') + (r.fallbackToTemplate ? ' (已 fallback 模板)' : ''));
      }
    }).catch(function(e){
      _toast('×LLM 决策出错·' + ((e && e.message) || e));
    });
  }
  global._tsNpcLlmDecide = _tsNpcLlmDecide;

  function _refreshFactionRuntime() {
    try { if (typeof ThreeSystemsExt !== 'undefined' && ThreeSystemsExt.buildProvinceOwnerIndex) ThreeSystemsExt.buildProvinceOwnerIndex(); } catch(_){}
    try { if (global.TM && TM.FactionMembership && TM.FactionMembership.migrateArmyOwnerToFaction) TM.FactionMembership.migrateArmyOwnerToFaction(); } catch(_){}
    try { if (global.TM && TM.FactionIndex && TM.FactionIndex.rebuild) TM.FactionIndex.rebuild(); } catch(_){}
    try { if (global.TM && TM.FactionDerived && TM.FactionDerived.compute) TM.FactionDerived.compute(); } catch(_){}
    try { if (global.TM && TM.FactionDerivedEconomy && TM.FactionDerivedEconomy.compute) TM.FactionDerivedEconomy.compute(); } catch(_){}
    try { if (global.TM && TM.FactionDerivedCohesion && TM.FactionDerivedCohesion.compute) TM.FactionDerivedCohesion.compute(); } catch(_){}
    try { if (global.TM && TM.FactionDerivedStrength && TM.FactionDerivedStrength.compute) TM.FactionDerivedStrength.compute(); } catch(_){}
  }
  function _num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback || 0);
  }
  function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _scoreTone(v) {
    v = _num(v, 0);
    if (v >= 70) return 'good';
    if (v >= 50) return 'mid';
    if (v >= 30) return 'warn';
    return 'bad';
  }
  function _phaseTone(phase) {
    if (phase === 'consolidating' || phase === 'rising') return 'good';
    if (phase === 'stable') return 'mid';
    if (phase === 'strained') return 'warn';
    if (phase === 'declining' || phase === 'collapsing') return 'bad';
    return 'mid';
  }
  function _fmtNum(v) {
    v = Math.round(_num(v, 0));
    if (Math.abs(v) >= 100000000) return Math.round(v / 100000000) + '亿';
    if (Math.abs(v) >= 10000) return Math.round(v / 10000) + '万';
    return String(v);
  }
  function _facEntry(name) {
    return (global.GM && GM._facIndex && GM._facIndex[name]) || null;
  }
  function _playerFacName() {
    if (global.P && P.playerInfo && P.playerInfo.factionName) return P.playerInfo.factionName;
    var pc = global.GM && Array.isArray(GM.chars) ? GM.chars.find(function(c){ return c && c.isPlayer; }) : null;
    return (pc && pc.faction) || '';
  }
  function _relationBetween(a, b) {
    if (!a || !b || a === b) return null;
    var map = global.GM && GM.factionRelationsMap;
    if (map && map[a] && map[a][b]) return map[a][b];
    var list = (global.GM && Array.isArray(GM.factionRelations)) ? GM.factionRelations : [];
    for (var i = list.length - 1; i >= 0; i--) {
      var r = list[i];
      if (!r) continue;
      if ((r.from === a && r.to === b) || (r.from === b && r.to === a)) return r;
    }
    return null;
  }
  function _relationTone(rel) {
    if (!rel) return 'none';
    var t = String(rel.type || '').toLowerCase();
    var v = _num(rel.value, 0);
    if (/war|hostile|敌|战/.test(t) || v <= -60) return 'hostile';
    if (/alliance|friend|ally|盟|友/.test(t) || v >= 55) return 'friend';
    if (/vassal|tributary|附|贡|宗主/.test(t)) return 'vassal';
    if (v <= -25) return 'tense';
    return 'neutral';
  }
  function _relationLabel(rel) {
    if (!rel) return '无记录';
    if (rel.type) return rel.type;
    var v = _num(rel.value, 0);
    if (v <= -60) return '敌对';
    if (v >= 55) return '友好';
    if (v <= -25) return '紧张';
    return '中立';
  }
  function _bar(label, value, extraCls) {
    value = _clamp(Math.round(_num(value, 0)), 0, 100);
    return '<div class="frp-bar ' + (extraCls || _scoreTone(value)) + '"><div class="frp-bar-top"><span>' + esc(label) + '</span><b>' + value + '</b></div><i style="width:' + value + '%"></i></div>';
  }
  function _miniStat(label, value, tone) {
    return '<div class="frp-mini-stat ' + (tone || '') + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }
  function _facMetrics(fac) {
    var entry = _facEntry(fac.name);
    var m = (entry && entry.metrics) || {};
    return {
      entry: entry,
      chars: m.charCount || 0,
      armies: m.armyCount || 0,
      soldiers: m.totalSoldiers || _num(fac.militaryStrength, 0),
      provinces: entry && entry.provinces ? entry.provinces.length : 0,
      arrears: m.arrearsArmies || 0,
      avgMutiny: m.avgMutinyRisk || 0,
      avgLoyalty: m.avgLoyalty || 0,
      dominantParty: m.partyDominantName || '',
      partyImbalance: m.partyImbalance || 0,
      privatizedRatio: m.privatizedRatio || 0
    };
  }
  function _facPower(fac) {
    return fac && fac.derivedStrength ? _num(fac.derivedStrength.value, 0) : _num(fac && fac.strength, 50);
  }
  function _factionCard(fac, selectedName, playerFac) {
    var met = _facMetrics(fac);
    var ds = fac.derivedStrength || null;
    var dh = fac.derivedHealth || null;
    var power = _facPower(fac);
    var isSel = fac.name === selectedName;
    var isPlayer = fac.name === playerFac || fac.isPlayer;
    var phase = fac.lifePhase || (dh && dh.overall < 30 ? 'declining' : 'stable');
    var tone = _phaseTone(phase);
    var rel = playerFac && fac.name !== playerFac ? _relationBetween(playerFac, fac.name) : null;
    var relTone = isPlayer ? 'self' : _relationTone(rel);
    var title = (fac.leader || fac.ruler || fac.factionLeader || '无主') + (fac.territory ? ' · ' + fac.territory : '');
    return '<button class="frp-card ' + (isSel ? 'active ' : '') + tone + '" onclick="viewFac(\'' + jsEsc(fac.name) + '\')">' +
      '<span class="frp-card-mark" style="background:' + esc(fac.color || '') + '"></span>' +
      '<span class="frp-card-main"><strong>' + esc(fac.name) + '</strong><em>' + esc(title) + '</em></span>' +
      '<span class="frp-card-side"><b>' + Math.round(power) + '</b><i>' + _fmtNum(met.soldiers) + '兵</i></span>' +
      '<span class="frp-card-tags"><i class="' + relTone + '">' + (isPlayer ? '本朝' : esc(_relationLabel(rel))) + '</i><i>' + esc((ds && ds.label) || (dh && dh.labels && dh.labels.overall) || '平') + '</i></span>' +
      '</button>';
  }
  function _listNames(list, limit, render) {
    if (!Array.isArray(list) || list.length === 0) return '<span class="frp-muted">暂无</span>';
    return list.slice(0, limit).map(render).join('') + (list.length > limit ? '<span class="frp-more">+' + (list.length - limit) + '</span>' : '');
  }
  function _npcMilitaryActionText(x) {
    x = x || {};
    var e = x.effect || {};
    var text = (x.army || x.target || x.action || '军务调度');
    if (e.commanderFrom || e.commanderTo) text += ' ' + (e.commanderFrom || '?') + '→' + (e.commanderTo || '?');
    if (e.trainingDelta || e.moraleDelta) text += ' 练+' + (e.trainingDelta || 0) + ' 士+' + (e.moraleDelta || 0);
    if (x.reason) text += ' · ' + x.reason;
    return text;
  }
  function _npcDiplomacyActionText(x) {
    x = x || {};
    var e = x.effect || {};
    var text = (x.to || x.target || x.action || '外交处置');
    if (e.relationFrom !== undefined || e.relationTo !== undefined) text += ' 关系' + (e.relationFrom !== undefined ? e.relationFrom : '?') + '→' + (e.relationTo !== undefined ? e.relationTo : '?');
    if (x.reason) text += ' · ' + x.reason;
    return text;
  }
  function _npcProvincePolicyText(x) {
    x = x || {};
    var e = x.effect || {};
    var text = (x.province || x.target || x.action || '地块政策');
    if (e.ownerFrom || e.ownerTo) text += ' 归属' + (e.ownerFrom || '?') + '→' + (e.ownerTo || '?');
    if (e.revenueDelta) text += ' 财赋' + (e.revenueDelta > 0 ? '+' : '') + e.revenueDelta;
    if (x.reason) text += ' · ' + x.reason;
    return text;
  }
  function _npcFiscalActionText(x) {
    x = x || {};
    var e = x.effect || {};
    var text = (x.resource || x.action || '财政政策');
    if (x.amount !== undefined) text += ' ' + x.amount;
    if (e.before !== undefined || e.after !== undefined) text += ' 库存' + (e.before !== undefined ? e.before : '?') + '→' + (e.after !== undefined ? e.after : '?');
    if (x.reason) text += ' · ' + x.reason;
    return text;
  }
  function _npcIntrigueActionText(x) {
    x = x || {};
    var text = (x.targetFaction || x.target || '目标') + ' · ' + (x.intrigue || x.policy || x.action || '间谍行动');
    if (x.pressure !== undefined) text += ' 压力+' + x.pressure;
    if (x.reason) text += ' · ' + x.reason;
    return text;
  }
  function _npcRebellionPolicyText(x) {
    x = x || {};
    var text = (x.targetFaction || x.target || '目标') + ' · ' + (x.policy || x.action || '叛乱政策');
    if (x.support !== undefined) text += ' 声势+' + x.support;
    if (x.reason) text += ' · ' + x.reason;
    return text;
  }
  function _renderNpcActionSection(title, list, limit, renderText) {
    if (!Array.isArray(list) || list.length === 0) return '';
    var html = '<div style="margin-bottom:0.7rem;"><div style="font-weight:600;color:var(--gold);margin-bottom:0.3rem;">' + esc(title) + '·近' + Math.min(list.length, limit) + '项</div>';
    html += '<div style="font-size:0.76rem;background:var(--bg-2);border-radius:4px;padding:0.4rem;">';
    list.slice(-limit).reverse().forEach(function(a){
      html += '<div style="margin-bottom:0.25rem;border-left:2px solid var(--gold);padding-left:0.5rem;">第' + esc(a.turn || '-') + '回·' + esc(renderText(a)) + '</div>';
    });
    html += '</div></div>';
    return html;
  }
  function _recentForFac(facName) {
    var out = [];
    var logs = (global.GM && Array.isArray(GM._factionMilitaryLog)) ? GM._factionMilitaryLog : [];
    logs.slice(-30).forEach(function(x){
      if (x && (x.faction === facName || x.target === facName || x.targetFaction === facName)) {
        out.push({ turn:x.turn, type:'军情', text:(x.action || '') + (x.outcome ? ' · ' + x.outcome : '') });
      }
    });
    var fac = (GM.facs || []).find(function(f){ return f && f.name === facName; });
    if (fac) {
      (fac.npcEdicts || []).slice(-4).forEach(function(x){ out.push({ turn:x.turn, type:'诏令', text:x._enrichedContent || x.content || x.trigger || '' }); });
      (fac.npcMemorials || []).slice(-4).forEach(function(x){ out.push({ turn:x.turn, type:'奏疏', text:(x.from ? x.from + '：' : '') + (x._enrichedContent || x.content || '') }); });
      (fac.npcOfficeActions || []).slice(-3).forEach(function(x){ out.push({ turn:x.turn, type:'人事', text:(x.target || '') + ' · ' + (x.reason || x.action || '') }); });
      (fac.npcMilitaryActions || []).slice(-3).forEach(function(x){ out.push({ turn:x.turn, type:'军务', text:_npcMilitaryActionText(x) }); });
      (fac.npcDiplomacyActions || []).slice(-3).forEach(function(x){ out.push({ turn:x.turn, type:'外交', text:_npcDiplomacyActionText(x) }); });
      (fac.npcProvincePolicies || []).slice(-3).forEach(function(x){ out.push({ turn:x.turn, type:'地政', text:_npcProvincePolicyText(x) }); });
      (fac.npcFiscalActions || []).slice(-3).forEach(function(x){ out.push({ turn:x.turn, type:'财计', text:_npcFiscalActionText(x) }); });
      (fac.npcIntrigueActions || []).slice(-3).forEach(function(x){ out.push({ turn:x.turn, type:'间谍', text:_npcIntrigueActionText(x) }); });
      (fac.npcRebellionPolicies || []).slice(-3).forEach(function(x){ out.push({ turn:x.turn, type:'叛乱', text:_npcRebellionPolicyText(x) }); });
    }
    return out.sort(function(a,b){ return _num(b.turn,0) - _num(a.turn,0); }).slice(0, 8);
  }
  function _detailPanel(fac, playerFac) {
    var met = _facMetrics(fac);
    var entry = met.entry;
    var ds = fac.derivedStrength || {};
    var dh = fac.derivedHealth || {};
    var de = fac.derivedEconomy || {};
    var dc = fac.derivedCohesion || {};
    var phase = fac.lifePhase || 'stable';
    var rel = playerFac && fac.name !== playerFac ? _relationBetween(playerFac, fac.name) : null;
    var relTone = fac.name === playerFac ? 'self' : _relationTone(rel);
    var chars = (entry && entry.chars) || [];
    var armies = (entry && entry.armies) || [];
    var court = chars.filter(function(c){ return /尚书|侍郎|大学士|御史|给事中|阁|部|司/.test(String(c.position || c.title || c.officialTitle || '')); });
    var generals = chars.filter(function(c){ return /总兵|都督|参将|副将|提督|经略|巡抚|游击/.test(String(c.position || c.title || c.officialTitle || '')); });
    var recent = _recentForFac(fac.name);
    var html = '<section class="frp-detail">';
    html += '<div class="frp-hero ' + _phaseTone(phase) + '"><div><div class="frp-eyebrow">势力档案</div><h2>' + esc(fac.name) + '</h2><p>' + esc(fac.description || fac.desc || fac.goal || fac.territory || '暂无势力描述') + '</p></div><div class="frp-seal"><b>' + Math.round(_facPower(fac)) + '</b><span>国势</span></div></div>';
    html += '<div class="frp-badges"><span class="' + relTone + '">' + (fac.name === playerFac ? '本朝' : esc(_relationLabel(rel))) + '</span><span>' + esc(_phaseLabel(phase)) + '</span><span>' + esc(fac.type || fac.paradigm || fac.culture || '未定型') + '</span></div>';
    html += '<div class="frp-stat-grid">' + _miniStat('领袖', fac.leader || fac.ruler || fac.factionLeader || '无主') + _miniStat('领地', met.provinces ? met.provinces + '处' : (fac.territory || '未索引')) + _miniStat('人物', met.chars + '人') + _miniStat('军队', met.armies + '支') + _miniStat('总兵', _fmtNum(met.soldiers)) + _miniStat('忠诚', met.avgLoyalty || '未知', _scoreTone(met.avgLoyalty || 50)) + '</div>';
    html += '<div class="frp-section"><h3>国势四诊</h3><div class="frp-bars">' + _bar('综合实力', ds.value !== undefined ? ds.value : _facPower(fac)) + _bar('政权健康', dh.overall !== undefined ? dh.overall : 50) + _bar('经济余力', de.economyHealth !== undefined ? de.economyHealth : 50) + _bar('内部凝聚', dc.overall !== undefined ? dc.overall : 50) + _bar('军权稳定', dh.militaryStability !== undefined ? dh.militaryStability : (100 - met.avgMutiny)) + '</div></div>';
    html += '<div class="frp-section frp-columns"><div><h3>人物骨架</h3><div class="frp-chipline">' + _listNames(court.length ? court : chars, 8, function(c){ return '<span>' + esc(c.name) + (c.party ? ' · ' + esc(c.party) : '') + '</span>'; }) + '</div><div class="frp-subline">将领：' + _listNames(generals, 6, function(c){ return '<span>' + esc(c.name) + '</span>'; }) + '</div></div>';
    html += '<div><h3>军队布置</h3><div class="frp-army-list">' + _listNames(armies, 7, function(a){ var risk = (a.mutinyRisk || 0) >= 60 || (a.payArrearsMonths || 0) >= 3; return '<span class="' + (risk ? 'risk' : '') + '">' + esc(a.name || '军') + '<i>' + _fmtNum(a.soldiers || a.size || 0) + ' · ' + esc(a.garrison || a.location || '') + '</i></span>'; }) + '</div></div></div>';
    html += '<div class="frp-section frp-columns"><div><h3>财政与隐患</h3><div class="frp-risk-list"><span>年入 ' + _fmtNum(de.annualTaxIncome || 0) + '</span><span>年军费 ' + _fmtNum(de.annualMilitaryCost || 0) + '</span><span class="' + _scoreTone(100 - (de.fiscalStress || 0)) + '">财政压力 ' + (de.fiscalStress || 0) + '</span><span class="' + (met.arrears ? 'bad' : '') + '">欠饷军 ' + met.arrears + '</span><span class="' + (met.privatizedRatio >= 0.4 ? 'warn' : '') + '">私兵化 ' + Math.round(met.privatizedRatio * 100) + '%</span></div></div>';
    html += '<div><h3>外交位置</h3><div class="frp-risk-list">';
    if (rel) html += '<span>' + esc(playerFac) + ' 对 ' + esc(fac.name) + '：' + esc(_relationLabel(rel)) + '</span><span>关系值 ' + (rel.value !== undefined ? rel.value : '未量化') + '</span>';
    if (fac.suzerainFaction) html += '<span>宗主 ' + esc(fac.suzerainFaction) + '</span>';
    if (Array.isArray(fac.vassals) && fac.vassals.length) html += '<span>附庸 ' + esc(fac.vassals.join('、')) + '</span>';
    html += '<span>' + esc(fac.diplomacyStance || fac.attitude || '无公开立场') + '</span></div></div></div>';
    html += '<div class="frp-section"><h3>近期动作</h3><div class="frp-timeline">';
    if (recent.length) recent.forEach(function(x){ html += '<div><b>T' + esc(x.turn || '-') + ' · ' + esc(x.type) + '</b><span>' + esc(String(x.text || '').slice(0, 90)) + '</span></div>'; });
    else html += '<div><b>暂无</b><span>此势力暂未留下可见近事，可能刚刚开局或尚未触发精细化推演。</span></div>';
    html += '</div></div>';
    if (fac.name !== playerFac) {
      html += '<div class="frp-actions"><button onclick="_tsInspectNpcInternal(\'' + jsEsc(fac.name) + '\')">查内政</button><button onclick="_tsInspectFactionAiDebug(\'' + jsEsc(fac.name) + '\')">势力AI</button><button onclick="_tsTribute(\'' + jsEsc(fac.name) + '\')">遣使</button><button onclick="_tsProposePeace(\'' + jsEsc(fac.name) + '\')">议和</button><button class="danger" onclick="_tsDeclareWar(\'' + jsEsc(fac.name) + '\')">宣战</button></div>';
    }
    html += '</section>';
    return html;
  }
  function _relationBoard(factions, selectedName) {
    var top = factions.slice(0, 10);
    var html = '<div class="frp-relation-board"><h3>关系棋盘</h3><div class="frp-relation-grid" style="grid-template-columns:140px repeat(' + top.length + ', minmax(54px,1fr));"><span></span>';
    top.forEach(function(f){ html += '<b title="' + esc(f.name) + '">' + esc(f.name.slice(0, 4)) + '</b>'; });
    top.forEach(function(row){
      html += '<b class="row-name">' + esc(row.name.slice(0, 7)) + '</b>';
      top.forEach(function(col){
        var rel = row.name === col.name ? null : _relationBetween(row.name, col.name);
        var tone = row.name === col.name ? 'self' : _relationTone(rel);
        html += '<span class="frp-relation-cell ' + tone + (row.name === selectedName || col.name === selectedName ? ' focus' : '') + '" title="' + esc(row.name + ' - ' + col.name + '：' + _relationLabel(rel) + (rel && rel.value !== undefined ? ' ' + rel.value : '')) + '">' + (row.name === col.name ? '本' : esc(_relationLabel(rel).slice(0, 1))) + '</span>';
      });
    });
    html += '</div></div>';
    return html;
  }
  function openForcesRelationsPanel(selectedFacName) {
    if (!global.GM || !Array.isArray(GM.facs) || GM.facs.length === 0) { _toast('暂无势力数据'); return; }
    _refreshFactionRuntime();
    var playerFac = _playerFacName();
    var factions = GM.facs.filter(function(f){ return f && f.name; }).slice().sort(function(a,b){ return _facPower(b) - _facPower(a); });
    var selected = factions.find(function(f){ return f.name === selectedFacName; }) || factions.find(function(f){ return f.name === playerFac; }) || factions[0];
    var hostileCount = 0, warCount = 0, totalSoldiers = 0;
    factions.forEach(function(f){
      var met = _facMetrics(f);
      totalSoldiers += met.soldiers;
      var rel = playerFac && f.name !== playerFac ? _relationBetween(playerFac, f.name) : null;
      var tone = _relationTone(rel);
      if (tone === 'hostile' || tone === 'tense') hostileCount++;
      if (rel && /war|战/.test(String(rel.type || ''))) warCount++;
    });
    var html = '<div class="frp-shell"><header class="frp-top"><div><span>天下势力</span><h1>势力天平</h1></div><p>按国势、兵力、财政、人物和外交把所有势力摊开，先看谁强，后看哪里会炸。</p></header>';
    html += '<div class="frp-overview">' + _miniStat('势力', factions.length + '家') + _miniStat('总兵', _fmtNum(totalSoldiers)) + _miniStat('敌压', hostileCount + '家', hostileCount ? 'warn' : 'good') + _miniStat('战事', warCount + '处', warCount ? 'bad' : 'mid') + '</div>';
    html += '<div class="frp-grid"><aside class="frp-list">';
    factions.forEach(function(f){ html += _factionCard(f, selected.name, playerFac); });
    html += '</aside><main>' + _detailPanel(selected, playerFac) + _relationBoard(factions, selected.name) + '</main></div></div>';
    _openModal('势力天平', html, null);
  }

  global.openForcesRelationsPanel = openForcesRelationsPanel;
  // 势力面板入口——若原游戏未定义 openFacPanel/viewFac·则以三系统面板替代
  global.openFacPanel = openForcesRelationsPanel;
  global.viewFac = function(facName){ openForcesRelationsPanel(facName); };
  // 覆盖原有·但保留原方法作为降级
  if (typeof global.openPartyDetailPanel === 'function') {
    global._originalOpenPartyDetailPanel = global.openPartyDetailPanel;
  }
  global.openPartyDetailPanel = openPartyPanelEnhanced;
  if (typeof global.openMilitaryDetailPanel === 'function') {
    global._originalOpenMilitaryDetailPanel = global.openMilitaryDetailPanel;
  }
  global.openMilitaryDetailPanel = openMilitaryPanelEnhanced;

})(typeof window !== 'undefined' ? window : this);
