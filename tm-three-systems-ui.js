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
  function fullTextAttr(s) {
    if (typeof global.tmFullTextAttr === 'function') return global.tmFullTextAttr(s, true);
    var v = String(s == null ? '' : s).trim();
    return v ? ' title="' + esc(v) + '"' : '';
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
    function _phaseLabel(phase) {
    var m = {consolidating:'上升',stable:'稳定',strained:'紧张',declining:'衰退',collapsing:'崩溃',rising:'上升'};
    return m[phase] || (phase || '稳定');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  势力+外交面板
  // ══════════════════════════════════════════════════════════════════════
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
      html += '<div><span class="tm-party-full tm-fulltext-source"'+fullTextAttr(p.name)+' style="font-weight:700;font-size:1rem;display:inline-block;max-width:260px;vertical-align:bottom;">'+esc(p.name)+'</span>';
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
      if (meta.length) {
        var metaText = meta.join(' · ');
        html += '<div class="tm-party-full tm-fulltext-source"'+fullTextAttr(metaText)+' style="font-size:0.74rem;color:var(--txt-s);margin-bottom:0.5rem;line-height:1.6;">'+esc(metaText)+'</div>';
      }
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

    // 指标状态色(好绿/中黄/差红·rev=越低越好如兵变欠饷)
    function _milClr(v, good, mid, rev){ if(rev){ return v<mid?'#7bbd8f':(v<good?'#e0a040':'#d9694a'); } return v>=good?'#7bbd8f':(v>=mid?'#e0a040':'#d9694a'); }
    Object.keys(byOwner).forEach(function(owner) {
      var isPlayer = owner === playerFac;
      html += '<div style="margin-bottom:1rem;">';
      html += '<div class="tm-army-full tm-fulltext-source"'+fullTextAttr(owner+(isPlayer?' (本朝)':'')+' · '+byOwner[owner].length+' 支')+' style="font-size:0.85rem;font-weight:600;color:'+(isPlayer?'var(--gold)':'var(--txt-s)')+';margin-bottom:0.4rem;border-bottom:1px dashed var(--bd,rgba(255,255,255,0.1));padding-bottom:0.3rem;">'+esc(owner)+(isPlayer?' (本朝)':'')+' · '+byOwner[owner].length+' 支</div>';
      byOwner[owner].forEach(function(a) {
        var _sup=a.supply||0,_mor=a.morale||0,_trn=a.training||50,_arr=a.payArrearsMonths||0,_mut=a.mutinyRisk||0;
        var _crisis=_mut>=60||_arr>=3||_sup<30||_mor<30;
        var _edge=_mut>=60?'#d9694a':(_crisis?'#e0a040':(_mor>=60?'#7bbd8f':'rgba(255,255,255,0.14)'));
        html += '<div style="background:'+(_crisis?'rgba(200,60,50,0.06)':'var(--bg-2)')+';border-radius:8px;padding:0.65rem 0.75rem;margin-bottom:0.6rem;border-left:3px solid '+_edge+';">';
        // 头部:军名 + 状态徽 + 兵数
        html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem;margin-bottom:0.55rem;">';
        html += '<div style="min-width:0;overflow:hidden;"><span class="tm-army-full tm-fulltext-source"'+fullTextAttr(a.name)+' style="font-weight:700;font-size:0.92rem;color:var(--txt,#ecdcc4);">'+esc(a.name)+'</span>';
        if (a.state && a.state !== 'garrison') html += ' <span style="font-size:0.64rem;color:var(--amber,#e0a040);background:rgba(224,160,64,0.12);padding:1px 6px;border-radius:3px;vertical-align:middle;white-space:nowrap;">'+esc({marching:'\u884c\u519b',sieging:'\u56f4\u57ce',routed:'\u6e83\u6563',disbanded:'\u89e3\u6563'}[a.state]||a.state)+'</span>';
        html += '</div>';
        html += '<div style="white-space:nowrap;font-weight:700;font-size:0.9rem;color:var(--gold,#c9a85f);">'+((a.soldiers||a.size||0).toLocaleString())+'<span style="font-size:0.64rem;color:var(--txt-d);font-weight:400;"> \u5175</span></div>';
        html += '</div>';
        // 指标网格:粮/气/训/欠饷/兵变(状态色+大值+迷你条·一眼见军情)
        var _cells=[['\u7cae',_sup,_milClr(_sup,60,30,false),_sup],['\u6c14',_mor,_milClr(_mor,60,40,false),_mor],['\u8bad',_trn,_milClr(_trn,60,40,false),_trn],['\u6b20\u997a',_arr+'\u6708',_arr>=3?'#d9694a':(_arr>0?'#e0a040':'#7bbd8f'),Math.min(100,_arr*25)],['\u5175\u53d8',_mut,_milClr(_mut,60,30,true),_mut]];
        html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.35rem;margin-bottom:0.5rem;">';
        _cells.forEach(function(c){ html += '<div style="text-align:center;"><div style="font-size:0.6rem;color:var(--txt-d);letter-spacing:0.04em;margin-bottom:1px;">'+c[0]+'</div><div style="font-size:0.98rem;font-weight:700;line-height:1;color:'+c[2]+';font-variant-numeric:tabular-nums;">'+c[1]+'</div><div style="height:3px;background:rgba(255,255,255,0.07);border-radius:2px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:'+Math.max(0,Math.min(100,c[3]))+'%;background:'+c[2]+';"></div></div></div>'; });
        html += '</div>';
        // 主帅行(头像徽+武智·空缺/阵殁红标) + 驻赴靠右
        var _cmName=a.commander||'',_cmCh=(_cmName&&typeof findCharByName==='function')?findCharByName(_cmName):null,_cmDead=_cmName&&(_cmCh?(_cmCh.alive===false||_cmCh.dead===true):true);
        html += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.45rem;row-gap:0.25rem;padding:0.45rem 0 0.1rem;border-top:1px solid rgba(255,255,255,0.05);font-size:0.74rem;">';
        if(!_cmName){ html += '<span style="color:var(--red,#c0563a);">\u26a0 \u4e3b\u5e05\u7a7a\u7f3a\u00b7\u5f85\u8865</span>'; }
        else if(_cmDead){ html += '<span style="color:var(--red,#c0563a);">\u26a0 \u4e3b\u5e05 '+esc(_cmName)+' \u9635\u6b81/\u5931\u8054\u00b7\u5f85\u8865</span>'; }
        else { var _cmM=_cmCh?(_cmCh.military||_cmCh.valor||50):50,_cmI=_cmCh?(_cmCh.intelligence||50):50;
          html += '<span style="width:26px;height:26px;flex:none;border-radius:4px;background:linear-gradient(135deg,#4a3e2e,#2e261d);display:inline-flex;align-items:center;justify-content:center;color:var(--gold,#c9a85f);font-weight:700;font-size:0.82rem;border:1px solid rgba(184,154,83,0.25);">'+esc(_cmName.slice(0,1))+'</span>';
          html += '<span class="tm-army-full tm-fulltext-source"'+fullTextAttr('\u4e3b\u5e05 '+_cmName+' \u00b7 \u6b66'+_cmM+' \u667a'+_cmI)+'><b style="color:var(--txt,#ecdcc4);">'+esc(_cmName)+'</b> <span style="color:var(--txt-d);">\u6b66</span><b>'+_cmM+'</b> <span style="color:var(--txt-d);">\u667a</span><b>'+_cmI+'</b></span>';
        }
        var _loc=a.garrison||a.location||'',_dest=a.destination||'';
        if(_loc||_dest){ html += '<span class="tm-army-full tm-fulltext-source"'+fullTextAttr((_loc?'\u9a7b '+_loc:'')+(_dest?' \u8d74 '+_dest:''))+' style="margin-left:auto;color:var(--txt-s);white-space:nowrap;">'+(_loc?'\u9a7b '+esc(_loc):'')+(_dest?' \u2192 '+esc(_dest):'')+'</span>'; }
        html += '</div>';
        // 编制·兵种构成 chips
        if (Array.isArray(a.composition) && a.composition.length) {
          var _ct=a.composition.reduce(function(s,c){return s+((c&&c.count)||0);},0)||1;
          html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;padding-top:0.4rem;">';
          a.composition.forEach(function(c){ if(!c||!c.type)return; var _pc=Math.round(((c.count||0)/_ct)*100);
            html += '<span style="font-size:0.66rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);border-radius:4px;padding:2px 7px;color:var(--txt-s);">'+esc(c.type)+' <b style="color:var(--txt,#ecdcc4);">'+((c.count||0).toLocaleString())+'</b> <span style="color:var(--txt-d);">'+_pc+'%</span></span>'; });
          html += '</div>';
        }
        if (a.controlLevel>=60) html += '<div style="font-size:0.68rem;color:var(--amber,#e0a040);margin-top:0.4rem;">\u2691 \u79c1\u5175\u5ea6 '+a.controlLevel+'\u00b7\u5c3e\u5927\u4e0d\u6389\u4e4b\u865e</div>';
        // 操作按钮(仅玩家·紧凑 4 列均分)
        if (isPlayer) {
          html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem;margin-top:0.55rem;">';
          var _abtn='display:flex;align-items:center;justify-content:center;font-size:0.76rem;min-height:44px;padding:0.4rem 0.2rem;touch-action:manipulation;';
          html += '<button class="bt bs" onclick="_tsTransferArmy(\''+jsEsc(a.name)+'\')" style="'+_abtn+'">\u8c03\u5175</button>';
          html += '<button class="bt bs" onclick="_tsBoostMorale(\''+jsEsc(a.name)+'\')" style="'+_abtn+'">\u72a9\u519b</button>';
          html += '<button class="bt bs" onclick="_tsSettleArrears(\''+jsEsc(a.name)+'\')" style="'+_abtn+'">\u53d1\u997a</button>';
          html += '<button class="bt bs" onclick="_tsAppointGeneral(\''+jsEsc(a.name)+'\')" style="'+_abtn+'">\u6613\u5c06</button>';
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
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    var _arrears = a ? Math.max(0, Math.round(Number(a.payArrearsMonths||0))) : 0;
    var _MS = global.MilitarySystems || (global.TM && global.TM.MilitarySystems);
    if (a && _MS && typeof _MS.settleArmyArrears === 'function') {
      var r = _MS.settleArmyArrears(a, {});
      var c = (r && r.cost) || { money:0, grain:0, cloth:0 };
      _pushEdict('谕：户部拨银 '+(c.money||0)+' 两'+(c.grain?'·粮 '+c.grain+' 石':'')+'·发 '+aname+' 积欠 '+_arrears+' 月军饷·安定军心。', '发饷');
      _toast(r && r.monthsCleared > 0
        ? ('已发饷·清欠 '+r.monthsCleared+' 月·耗银 '+(c.money||0)+(r.shortfall>0 ? '（国库不足·欠 '+Math.round(r.shortfall)+'）' : ''))
        : '无欠饷可补');
    } else {
      _pushEdict('谕：户部速拨银两·发 '+aname+' 积欠军饷·安定军心。', '发饷');
      if (a) { a.payArrearsMonths = 0; a.mutinyRisk = Math.max(0, (a.mutinyRisk||0) - 30); }
      _toast('饷已清·兵变险大减');
    }
  }
  // 活人将才候选(同势力优先·按武略降序·剔现任·只列在世)→易将下拉
  function _tsLivingCommanderCandidates(army) {
    var chars = (global.GM && Array.isArray(GM.chars)) ? GM.chars : [];
    var fac = army && army.faction;
    var cur = (army && army.commander) || '';
    var out = [];
    chars.forEach(function(c) {
      if (!c || !c.name) return;
      if (c.alive === false || c.dead === true) return;   // ★只列在世·死者不入候选
      if (c.name === cur) return;
      out.push({
        name: c.name,
        mil: c.military || c.valor || 50,
        intel: c.intelligence || 50,
        faction: c.faction || '',
        title: c.title || c.officialTitle || '',
        sameFac: fac ? (c.faction === fac) : false
      });
    });
    out.sort(function(x, y) {
      if (x.sameFac !== y.sameFac) return x.sameFac ? -1 : 1;     // 同朝优先
      return (y.mil + y.intel * 0.3) - (x.mil + x.intel * 0.3);   // 武略综合降序
    });
    return out;
  }
  function _tsAppointGeneral(aname) {
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (!a) { _toast('未找到部队·' + aname); return; }
    var curName = a.commander || '';
    var curCh = (curName && typeof findCharByName === 'function') ? findCharByName(curName) : null;
    var curDead = curCh ? (curCh.alive === false || curCh.dead === true) : (!!curName);
    var cands = _tsLivingCommanderCandidates(a);
    var CAP = 60, shown = cands.slice(0, CAP);
    var html = '<div style="padding:0.9rem;">';
    html += '<div style="font-size:0.82rem;color:var(--txt-s);margin-bottom:0.7rem;">为 <b style="color:var(--gold);">' + esc(aname) + '</b> 拜将易帅 · 仅在世将才可受命</div>';
    if (!curName) {
      html += '<div style="font-size:0.78rem;color:var(--red,#c0563a);background:rgba(200,50,50,0.1);border-radius:5px;padding:0.45rem 0.6rem;margin-bottom:0.7rem;">⚠ 现主帅空缺·此部无人统御</div>';
    } else if (curDead) {
      html += '<div style="font-size:0.78rem;color:var(--red,#c0563a);background:rgba(200,50,50,0.1);border-radius:5px;padding:0.45rem 0.6rem;margin-bottom:0.7rem;">⚠ 现主帅 ' + esc(curName) + ' 已殁/失联·亟待补任</div>';
    } else {
      var cm = curCh.military || curCh.valor || 50, ci = curCh.intelligence || 50;
      html += '<div style="font-size:0.78rem;color:var(--txt-s);margin-bottom:0.7rem;">现主帅：<b>' + esc(curName) + '</b> · 武 ' + cm + ' · 智 ' + ci + '</div>';
    }
    if (!shown.length) {
      html += '<div style="font-size:0.78rem;color:var(--txt-d);">朝中暂无可调遣之在世将才。</div>';
    } else {
      html += '<select id="ts_appoint_sel" style="width:100%;padding:0.5rem;border-radius:5px;background:var(--bg-3,#1c140c);color:var(--txt,#ecdcc4);border:1px solid var(--bd,rgba(255,255,255,0.15));font-size:0.82rem;margin-bottom:0.7rem;">';
      shown.forEach(function(c) {
        var label = c.name + ' · 武' + c.mil + ' 智' + c.intel + (c.sameFac ? '' : ' · ' + (c.faction || '无属')) + (c.title ? ' · ' + c.title : '');
        html += '<option value="' + esc(c.name) + '">' + esc(label) + '</option>';
      });
      html += '</select>';
      if (cands.length > CAP) html += '<div style="font-size:0.66rem;color:var(--txt-d);margin-bottom:0.5rem;">（在世将才众·仅列前 ' + CAP + ' 名·按武略与本朝优先）</div>';
      html += '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">';
      html += '<button class="bt bs" onclick="closeGenericModal()" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0.55rem 1.1rem;touch-action:manipulation;">取消</button>';
      html += '<button class="bt bp" onclick="_tsConfirmAppoint(\'' + jsEsc(aname) + '\')" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0.55rem 1.1rem;touch-action:manipulation;">确认拜将</button>';
      html += '</div>';
    }
    html += '<div style="font-size:0.66rem;color:var(--txt-d);margin-top:0.6rem;line-height:1.5;">※ 拜将后忠诚略降；主帅若阵殁/赐死，过回合自动出缺。</div>';
    html += '</div>';
    _openModal('易将 · 拜帅', html, null);
  }
  function _tsConfirmAppoint(aname) {
    var sel = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('ts_appoint_sel') : null;
    var name = sel ? String(sel.value || '').trim() : '';
    if (!name) { _toast('请择一将才'); return; }
    var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
    if (!ch || ch.alive === false || ch.dead === true) { _toast('此人已殁或查无此人·不可拜将'); return; }   // ★死人/幽灵守卫
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (!a) { _toast('未找到部队'); return; }
    // 直写主字段 + 4 读取别名(与引擎 _armyCurrentCommander 读取集一致)·清死亡卸职标记
    a.commander = name; a.commanderName = name; a.general = name; a.leader = name;
    a.commanderAlive = true; a._commanderLost = false;
    var t = ch.title || ch.officialTitle; if (t) a.commanderTitle = t;
    a.loyalty = Math.max(30, (a.loyalty || 60) - 10);
    _pushEdict('谕：擢 ' + name + ' 为 ' + aname + ' 新统帅·原统帅另有任用。', '易将');
    try { if (typeof closeGenericModal === 'function') closeGenericModal(); } catch (e) {}
    _toast('已拜 ' + name + ' 为 ' + aname + ' 主帅');
    try { if (typeof openMilitaryDetailPanel === 'function') openMilitaryDetailPanel(); } catch (e) {}
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
  global._tsConfirmAppoint = _tsConfirmAppoint;
  global._tsLivingCommanderCandidates = _tsLivingCommanderCandidates;

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
      // action 中文化(不漏英文码)+花费+成败/策反结果·display-only(原仅显 [bribe] 英文薄行)
      var _actCN = { bribe:'暗结收买', spreadRumor:'散播谣言', sponsorRebellion:'资助内斗', espionage:'刺探军情' };
      html += '<div style="font-size:0.72rem;color:var(--txt-d);margin-top:0.5rem;border-top:1px solid var(--bd,rgba(255,255,255,0.08));padding-top:0.4rem;">我朝谍报·已对 '+esc(fac.name)+' 用 '+interventions.length+' 次：';
      interventions.slice(-6).reverse().forEach(function(i){
        var actCN = _actCN[i.action] || '密遣';
        var tgt = i.targetChar ? ('·'+esc(i.targetChar)) : '';
        var costTxt = '';
        if (i.cost) { var _cp=[]; if(i.cost.money)_cp.push((Math.round(i.cost.money/1000)/10)+'万两'); if(i.cost.grain)_cp.push((Math.round(i.cost.grain/1000)/10)+'万石'); if(_cp.length)costTxt=' ·耗'+_cp.join('·'); }
        var outcome = '';
        if (i.action === 'bribe' && i.effects) { outcome = i.effects.bribed ? ' ·<span style="color:#6bb07c;">已策反</span>' : ' ·<span style="color:var(--txt-d);">忠诚-'+Math.max(0,Math.round((i.effects.loyaltyBefore||0)-(i.effects.loyaltyAfter||0)))+'</span>'; }
        else if (i.success === false) { outcome = ' ·<span style="color:#c5524a;">未果</span>'; }
        else if (i.success) { outcome = ' ·<span style="color:#6bb07c;">得手</span>'; }
        html += '<div style="margin-top:1px;">· 第'+i.turn+'回·<b style="color:var(--gold);">'+esc(actCN)+'</b>'+tgt+costTxt+outcome+'</div>';
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
    // F2·SC16 采纳审计·显示采纳率 + cooldown + ignoredItems
    var sc16Comp = (fac._lastLlmApplySummary && fac._lastLlmApplySummary.sc16Compliance) || null;
    if (sc16Comp) {
      var compColor = sc16Comp.complianceScore >= 70 ? '#6bb07c' : (sc16Comp.complianceScore >= 40 ? '#cda54c' : '#b04030');
      html += '<div style="margin:0.2rem 0;"><span style="color:' + compColor + ';font-weight:bold;">采纳率 ' + esc(sc16Comp.complianceScore) + '%</span> ' + esc(sc16Comp.adoptedCount) + '/' + esc(sc16Comp.directiveCount) + ' 条指令被执行</div>';
      if (sc16Comp.ignoredItems && sc16Comp.ignoredItems.length) {
        html += '<details style="margin:0.2rem 0;"><summary style="cursor:pointer;color:var(--red,#b04030);font-size:0.72rem;">未采纳 ' + sc16Comp.ignoredItems.length + ' 条</summary>';
        sc16Comp.ignoredItems.forEach(function(it){ html += '<div style="font-size:0.7rem;padding-left:1rem;color:var(--txt-d);">[' + esc(it.type) + '] ' + esc(it.summary) + (it.target ? ' (target=' + esc(it.target) + ')' : '') + '</div>'; });
        html += '</details>';
      }
    }
    if (directive) {
      html += '<div>turn=' + esc(directive.turn || '?') + ' direct=' + esc(directive.hasDirectContent ? 'yes' : 'no');
      if (directive.cooldownApplied) html += ' <span style="color:var(--red,#b04030);font-size:0.72rem;">cooldown=' + esc(directive.cooldownApplied) + ' (' + esc(directive.cooldownDelta) + ')</span>';
      html += '</div>';
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

  // F3·2026-05-22·全局 NPC AI 状态面板·跨势力总览
  function _tsInspectGlobalNpcLlm() {
    if (!global.GM) { _toast('暂无游戏数据'); return; }
    var status = null;
    try {
      if (global.TM && TM.FactionNpcLlmDecision && typeof TM.FactionNpcLlmDecision.getGlobalNpcLlmStatus === 'function') {
        status = TM.FactionNpcLlmDecision.getGlobalNpcLlmStatus();
      }
    } catch(e) { _toast('状态聚合失败: ' + (e && e.message || e)); return; }
    if (!status) { _toast('NPC LLM 决策模块未加载'); return; }

    var enabledTxt = status.enabled ? (status.effectivelyOn ? '<span style="color:#6bb07c;">●已启用</span>' : '<span style="color:#cda54c;">○开关 ON 但 ' + (status.hasKey ? '未生效' : '缺 API key') + '</span>') : '<span style="color:#888;">○已关闭</span>';

    var html = '<div style="padding:0.9rem;max-height:78vh;overflow-y:auto;">';
    html += '<div style="display:flex;justify-content:space-between;gap:0.8rem;align-items:flex-start;margin-bottom:0.8rem;">';
    html += '<div><h3 style="margin:0;color:var(--gold);">NPC AI 全局状态·T' + esc(status.turn) + '</h3><div style="font-size:0.76rem;color:var(--txt-d);">跨势力 LLM 推演总览·调度统计·候选评分·失败记录。</div></div>';
    html += '<div style="font-size:0.85rem;">' + enabledTxt + '</div>';
    html += '</div>';

    // ─── 调度统计 5 grid ───
    var ds = status.dispatchStats || {};
    html += '<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0.5rem;margin-bottom:0.8rem;font-size:0.74rem;">';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>已应用</b><br><span style="color:#6bb07c;font-size:1.1rem;">' + esc(ds.applied || 0) + '</span></div>';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>跑/排队</b><br><span style="color:#cda54c;font-size:1.1rem;">' + esc(ds.running || 0) + ' / ' + esc((ds.scheduled || 0) - (ds.running || 0) - (ds.applied || 0) - (ds.failed || 0) - (ds.canceled || 0)) + '</span></div>';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>失败</b><br><span style="color:#b04030;font-size:1.1rem;">' + esc(ds.failed || 0) + '</span></div>';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>跳过/合并</b><br><span style="font-size:1.1rem;">' + esc(ds.skipped || 0) + ' / ' + esc((ds.partial || 0) + (ds.noAction || 0)) + '</span></div>';
    html += '<div style="background:var(--bg-2);padding:0.45rem;border-radius:4px;"><b>估算 tokens</b><br><span style="font-size:1.1rem;">' + esc(Math.round((status.estimatedTokensThisTurn || 0) / 1000)) + 'k</span></div>';
    html += '</div>';

    // ─── 候选评分矩阵 (top 8) ───
    html += '<div style="margin-bottom:0.8rem;background:var(--bg-2);padding:0.55rem;border-radius:4px;">';
    html += '<b style="color:var(--gold);font-size:0.78rem;">候选评分 (top 8·按 score 排)</b>';
    if (status.candidates && status.candidates.length) {
      html += '<div style="font-size:0.72rem;margin-top:0.4rem;">';
      status.candidates.forEach(function(c, i) {
        html += '<div style="border-bottom:1px dashed rgba(255,255,255,0.08);padding:0.2rem 0;display:flex;justify-content:space-between;gap:0.5rem;"><span><b>' + (i + 1) + '·</b> ' + esc(c.faction) + '</span><span style="color:var(--txt-d);">score=' + esc(c.score) + ' · ' + esc((c.reasons || []).join(' / ')) + '</span></div>';
      });
      html += '</div>';
    } else {
      html += '<div style="font-size:0.72rem;color:var(--txt-d);">暂无候选评分·本回合 SC16/精细化推演未跑。</div>';
    }
    html += '</div>';

    // ─── 各势力 status (perFacStatus) ───
    html += '<div style="margin-bottom:0.8rem;">';
    html += '<b style="color:var(--gold);font-size:0.78rem;">势力状态 (' + esc(status.facCount) + ' 个 NPC 势力)</b>';
    html += '<div style="font-size:0.72rem;background:var(--bg-2);border-radius:4px;padding:0.45rem;margin-top:0.3rem;">';
    if (status.perFacStatus && status.perFacStatus.length) {
      status.perFacStatus.slice(0, 20).forEach(function(p) {
        var statusColor = '#888';
        var statusIcon = '○';
        if (p.status === 'applied') { statusColor = '#6bb07c'; statusIcon = '✓'; }
        else if (p.status === 'running') { statusColor = '#cda54c'; statusIcon = '●'; }
        else if (p.status === 'failed') { statusColor = '#b04030'; statusIcon = '✗'; }
        else if (p.status === 'skipped') { statusColor = '#888'; statusIcon = '−'; }
        html += '<div style="border-bottom:1px dashed rgba(255,255,255,0.08);padding:0.2rem 0;display:flex;justify-content:space-between;gap:0.5rem;">';
        html += '<span><i style="color:' + statusColor + ';">' + statusIcon + '</i> <a href="javascript:void(0)" onclick="_tsInspectFactionAiDebug(\'' + jsEsc(p.faction) + '\')" style="color:var(--txt);text-decoration:none;border-bottom:1px dotted var(--txt-d);">' + esc(p.faction) + '</a>';
        // F2·SC16 采纳率 badge
        if (p.sc16ComplianceScore != null && p.sc16DirectiveCount > 0) {
          var compColor = p.sc16ComplianceScore >= 70 ? '#6bb07c' : (p.sc16ComplianceScore >= 40 ? '#cda54c' : '#b04030');
          html += ' <span title="SC16 采纳率: ' + esc(p.sc16ComplianceScore) + '% (' + esc(p.sc16DirectiveCount) + ' 条指令)" style="color:' + compColor + ';font-size:0.71rem;margin-left:0.3rem;">SC16:' + esc(p.sc16ComplianceScore) + '%</span>';
        }
        html += '</span>';
        html += '<span style="color:var(--txt-d);">T' + esc(p.lastTurn) + ' · 应用 ' + esc(p.appliedActions) + ' 跳 ' + esc(p.skippedActions) + ' 合 ' + esc(p.mergedActions) + '</span>';
        html += '</div>';
        if (p.rationale) html += '<div style="font-size:0.71rem;color:var(--txt-d);padding-left:1.2rem;margin-bottom:0.15rem;">"' + esc(p.rationale) + '..."</div>';
        if (p.goals && p.goals.active > 0) {
          var _gtop = (p.goals.top || []).map(function(g){ return esc(g.desc) + '(' + esc(g.horizon === 'long' ? '长' : '短') + '·' + esc(g.step) + (g.note ? '·' + esc(g.note) : '') + ')'; }).join('，');
          html += '<div style="font-size:0.71rem;color:var(--gold);padding-left:1.2rem;margin-bottom:0.2rem;">目标 ' + esc(p.goals.active) + ' 活跃' + (p.goals.achieved ? ' · 已达成 ' + esc(p.goals.achieved) : '') + (_gtop ? ' · ' + _gtop : '') + '</div>';
        }
      });
      if (status.perFacStatus.length > 20) html += '<div style="color:var(--txt-d);margin-top:0.3rem;">... 还有 ' + (status.perFacStatus.length - 20) + ' 个势力未显示</div>';
    } else {
      html += '<div style="color:var(--txt-d);">暂无 NPC 势力数据。</div>';
    }
    html += '</div></div>';

    // ─── recentApplications ───
    html += '<div style="margin-bottom:0.8rem;">';
    html += '<b style="color:var(--gold);font-size:0.78rem;">最近动作 (跨势力·近 10)</b>';
    html += '<div style="font-size:0.72rem;background:var(--bg-2);border-radius:4px;padding:0.45rem;margin-top:0.3rem;">';
    if (status.recentApplications && status.recentApplications.length) {
      status.recentApplications.forEach(function(r) {
        html += '<div style="padding:0.15rem 0;">T' + esc(r.turn) + ' · <b>' + esc(r.faction) + '</b> · ' + esc(r.type) + ' <span style="color:var(--txt-d);">(' + esc(r.source) + ')</span></div>';
      });
    } else {
      html += '<div style="color:var(--txt-d);">暂无动作记录。</div>';
    }
    html += '</div></div>';

    // ─── recentFailures ───
    if (status.recentFailures && status.recentFailures.length) {
      html += '<div style="margin-bottom:0.8rem;">';
      html += '<b style="color:var(--red,#b04030);font-size:0.78rem;">最近失败 (近 5)</b>';
      html += '<div style="font-size:0.72rem;background:rgba(184,80,60,0.08);border-radius:4px;padding:0.45rem;margin-top:0.3rem;">';
      status.recentFailures.forEach(function(f) {
        html += '<div style="border-bottom:1px dashed rgba(184,80,60,0.2);padding:0.25rem 0;">';
        html += '<b>T' + esc(f.turn) + ' · ' + esc(f.faction || '<dispatch>') + '</b> · kind=' + esc(f.kind);
        if (f.error) html += '<br><span style="color:var(--txt-d);">' + esc(String(f.error).slice(0, 200)) + '</span>';
        if (f.rawPreview) html += '<details style="margin-top:0.2rem;"><summary style="cursor:pointer;color:var(--txt-d);">raw preview</summary><pre style="font-size:0.71rem;white-space:pre-wrap;margin:0.2rem 0 0;color:var(--txt);">' + esc(f.rawPreview) + '</pre></details>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // ─── pickLog ───
    if (status.pickLog && status.pickLog.length) {
      html += '<details style="margin-bottom:0.8rem;background:var(--bg-2);padding:0.55rem;border-radius:4px;font-size:0.72rem;"><summary style="cursor:pointer;color:var(--gold);">最近 10 次随机选择 (pickLog)</summary>';
      html += '<div style="margin-top:0.4rem;">';
      status.pickLog.forEach(function(p) {
        html += '<div style="padding:0.15rem 0;">T' + esc(p.turn) + ' · pool=' + esc(p.pool) + ' · selected=<b>' + esc(p.selected) + '</b> <span style="color:var(--txt-d);">from ' + esc((p.candidates || []).length) + ' candidates</span></div>';
      });
      html += '</div></details>';
    }

    html += '</div>';
    _openModal('NPC AI 全局状态', html, null);
  }
  global._tsInspectGlobalNpcLlm = _tsInspectGlobalNpcLlm;

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
  // F3·2026-05-22·NPC LLM 状态 badge·读 GM._npcFactionLlmLedger.runs[fac].status
  function _npcLlmStatusBadge(facName) {
    if (!global.GM || !facName) return '';
    var llmOn = !!(global.TM && TM.FactionNpcSettings && TM.FactionNpcSettings.isAiPrecisionEnabled && TM.FactionNpcSettings.isAiPrecisionEnabled());
    if (!llmOn) return '';
    var runs = (GM._npcFactionLlmLedger && GM._npcFactionLlmLedger.runs) || {};
    var run = runs[facName];
    if (!run) return '<i title="NPC AI 待机" style="color:#888;">○</i>';
    var s = run.status;
    if (s === 'running') return '<i title="NPC AI 正在跑" style="color:#6bb07c;">●</i>';
    if (s === 'applied') return '<i title="NPC AI 已执行" style="color:#6bb07c;">✓</i>';
    if (s === 'failed') return '<i title="NPC AI 失败·点势力AI 看详情" style="color:#b04030;">✗</i>';
    if (s === 'skipped') return '<i title="NPC AI 已跳过" style="color:#888;">−</i>';
    return '<i title="NPC AI 状态: ' + esc(s || '?') + '" style="color:#888;">·</i>';
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
    var aiBadge = isPlayer ? '' : _npcLlmStatusBadge(fac.name);
    return '<button class="frp-card ' + (isSel ? 'active ' : '') + tone + '" onclick="viewFac(\'' + jsEsc(fac.name) + '\')">' +
      '<span class="frp-card-mark" style="background:' + esc(fac.color || '') + '"></span>' +
      '<span class="frp-card-main"><strong>' + esc(fac.name) + '</strong><em>' + esc(title) + '</em></span>' +
      '<span class="frp-card-side"><b>' + Math.round(power) + '</b><i>' + _fmtNum(met.soldiers) + '兵</i></span>' +
      '<span class="frp-card-tags"><i class="' + relTone + '">' + (isPlayer ? '本朝' : esc(_relationLabel(rel))) + '</i><i>' + esc((ds && ds.label) || (dh && dh.labels && dh.labels.overall) || '平') + '</i>' + aiBadge + '</span>' +
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
    var llmOn = !!(global.TM && TM.FactionNpcSettings && TM.FactionNpcSettings.isAiPrecisionEnabled && TM.FactionNpcSettings.isAiPrecisionEnabled());
    var aiBtn = llmOn ? '<button class="bt bs" onclick="_tsInspectGlobalNpcLlm()" style="margin-left:auto;font-size:0.78rem;padding:0.3rem 0.7rem;background:rgba(107,176,124,0.15);color:var(--celadon-400,#6bb07c);">NPC AI 全局状态</button>' : '';
    var html = '<div class="frp-shell"><header class="frp-top"><div><span>天下势力</span><h1>势力天平</h1></div><p>按国势、兵力、财政、人物和外交把所有势力摊开，先看谁强，后看哪里会炸。</p>' + aiBtn + '</header>';
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
