// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-endturn-ai-context.js
// Domain: EndTurn / AI prompt context
// Owns:
//   - End-turn sysP policy/context injections for factions, parties, armies,
//     NPC plans, office appointment rules, output-safety rules, AI plans,
//     and faction matrix summaries.
// Does not own:
//   - Base sysP/narrative/chronicle builders (tm-prompt-composer.js)
//   - LLM dispatch/retry/cache (tm-ai-infra.js)
//   - sc1 writeback or post-call orchestration (tm-endturn-ai-infer.js)
// Public API:
//   - TM.EndTurnAIContext.appendPromptPolicyContext(sysP, ctx)
// Depends on:
//   - global GM/P/TM
//   - optional buildNpcDecisionsForSysP/buildEdictEfficacyFollowUp/buildCharArcsForSysP
// Used by:
//   - tm-endturn-ai-infer.js Region 1
// Tests:
//   - syntax-check / verify-all
// Refactor notes:
//   - Phase 3 R7 Codex slice: first small Region 1 extraction.
// ============================================================

(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  TM.EndTurnAIContext = TM.EndTurnAIContext || {};

  function _capture(err, label) {
    try {
      if (TM && TM.errors && typeof TM.errors.capture === 'function') {
        TM.errors.capture(err, label);
        return;
      }
    } catch (_) {}
    try { console.warn('[' + label + ']', err); } catch (_) {}
  }

  function _slice(v, n) {
    return String(v == null ? '' : v).slice(0, n || 120);
  }

  // 【降本·S1】显要度评分——仅当势力/党派数远超阈值(极大剧本)时用于排序保留最要紧者。
  // 常规剧本走原序不排序(字节不变·不扰缓存前缀·不改行为)。
  function _facSalience(f) {
    if (!f) return -1;
    return (f._collapsing ? 1000 : 0)
      + Math.abs(Number(f.strength) || 0)
      + (100 - (Number(f.stability) == null ? 100 : (Number(f.stability) || 0)))
      + (100 - (Number(f.morale) == null ? 100 : (Number(f.morale) || 0)))
      + (f.suzerainFaction ? 50 : 0);
  }
  function _partySalience(ps) {
    if (!ps) return -1;
    return (Number(ps.influence) || 0)
      + (Number(ps.officeCount) || 0) * 10
      + (Number(ps.recentImpeachWin) || 0)
      + (Number(ps.recentImpeachLose) || 0);
  }

  function appendPromptPolicyContext(sysP, ctx) {
    ctx = ctx || {};
    var GM = ctx.GM || global.GM || {};

    try {
      var stateLines = [];
      if (Array.isArray(GM.facs) && GM.facs.length > 0) {
        stateLines.push('【势力运行时态】');
        // 【降本·S1】常规剧本(≤上限)保持原序原样=字节不变;仅极大剧本按显要度截断+注明从略。
        var _facCap = 24, _facList = GM.facs, _facOmit = 0;
        if (GM.facs.length > _facCap) {
          var _fr = GM.facs.filter(function(f) { return f && f.name; });
          _fr.sort(function(a, b) { return _facSalience(b) - _facSalience(a); });
          _facOmit = Math.max(0, _fr.length - _facCap);
          _facList = _fr.slice(0, _facCap);
        }
        _facList.forEach(function(f) {
          if (!f || !f.name) return;
          var line = '  - ' + f.name +
            ' 阶段=' + (f.lifePhase || 'stable') +
            ' 实力=' + (f.strength || 0) +
            ' 合法性=' + (f.legitimacy || 0) +
            ' 人口=' + (f.population || 0) +
            ' 民心=' + (f.morale || 0) +
            ' 稳定=' + (f.stability || 0);
          if (f._collapsing) line += ' 【濒临崩溃】';
          if (f.suzerainFaction) line += ' 宗主=' + f.suzerainFaction;
          stateLines.push(line);
        });
        if (_facOmit > 0) stateLines.push('  （另有 ' + _facOmit + ' 个次要势力数值从略——不可据此断言其不存在或已亡，仅未列其细目）');
      }
      if (GM.partyState && typeof GM.partyState === 'object') {
        stateLines.push('【党派数值】');
        // 【降本·S1】同上:常规(≤上限)原序原样字节不变;极大才按显要度截断+注明从略。
        var _pKeys = Object.keys(GM.partyState), _pCap = 16, _pOmit = 0;
        if (_pKeys.length > _pCap) {
          _pKeys = _pKeys.filter(function(pn) { return GM.partyState[pn]; });
          _pKeys.sort(function(a, b) { return _partySalience(GM.partyState[b]) - _partySalience(GM.partyState[a]); });
          _pOmit = Math.max(0, _pKeys.length - _pCap);
          _pKeys = _pKeys.slice(0, _pCap);
        }
        _pKeys.forEach(function(pn) {
          var ps = GM.partyState[pn];
          if (!ps) return;
          var _pStand = ps.standing === 'governing' ? '秉政' : (ps.standing === 'marginal' ? '边缘' : (ps.standing === 'opposition' ? '在野' : ''));
          stateLines.push('  - ' + pn +
            (_pStand ? ' 政柄=' + _pStand : '') +
            ' 影响=' + (ps.influence || 0) +
            ' 凝聚=' + (ps.cohesion || 0) +
            ' 占官=' + (ps.officeCount || 0) +
            ' 清誉=' + (ps.reputationBalance || 0) +
            ((ps.recentImpeachWin || 0) > 0 ? ' 近期弹劾胜=' + Math.round(ps.recentImpeachWin) : '') +
            ((ps.recentImpeachLose || 0) > 0 ? ' 近期弹劾败=' + Math.round(ps.recentImpeachLose) : ''));
        });
        if (_pOmit > 0) stateLines.push('  （另有 ' + _pOmit + ' 个次要党派数值从略）');
      }
      // 阶层正册：Phase-3 抽取重构时此块漏迁，致主推演活路径对阶层全盲（历史大 bug 复发）。
      // 数据契约同 tm-endturn-prompt.js 死 else 分支（满意/趋势/影响/势位/诉求/最艰地域）。
      if (Array.isArray(GM.classes) && GM.classes.length > 0) {
        stateLines.push('【阶层正册】');
        GM.classes.slice(0, 12).forEach(function(c) {
          if (!c || !c.name) return;
          var _cSat = Math.round(Number(c.satisfaction) || 0);
          var _cTrend = 0;
          if (Array.isArray(c._satLedger)) c._satLedger.forEach(function(e) { if (e && e.t >= (GM.turn || 0) - 1) _cTrend += (Number(e.d) || 0); });
          _cTrend = Math.round(_cTrend * 10) / 10;
          var _cDm = String(c.currentDemand || (Array.isArray(c.demands) ? c.demands.join('·') : c.demands) || '').slice(0, 34);
          var _cPhase = (c.revoltState && c.revoltState.phase && c.revoltState.phase !== 'calm') ? ('·态:' + c.revoltState.phase) : '';
          var _rf = Number(c._radicalFrac); var _cRadical = (isFinite(_rf) && _rf >= 0.2) ? ('·乱民' + Math.round(_rf * 10) + '成(' + (_rf >= 0.6 ? '鼎沸' : (_rf >= 0.4 ? '汹汹' : '不稳')) + ')') : '';
          var _cWorst = '';
          if (Array.isArray(c.regionalVariants)) {
            var _wv = null;
            c.regionalVariants.forEach(function(v) { if (v && v.region && isFinite(Number(v.satisfaction)) && (!_wv || Number(v.satisfaction) < Number(_wv.satisfaction))) _wv = v; });
            if (_wv && Number(_wv.satisfaction) <= _cSat - 8) _cWorst = '·最艰:' + String(_wv.region).slice(0, 6) + Math.round(Number(_wv.satisfaction));
          }
          var _cMove = '';
          if (Array.isArray(GM._politicalMovements)) {
            var _mv = null;
            GM._politicalMovements.forEach(function(m) { if (m && m.className === c.name && (!_mv || Number(m.support) > Number(_mv.support))) _mv = m; });
            if (_mv && Number(_mv.support) >= 40) _cMove = '·运动:' + String(_mv.label || '').slice(0, 16) + '(' + (_mv.phase || '') + Math.round(Number(_mv.support)) + ')';
          }
          stateLines.push('  - ' + c.name + '·满意' + _cSat + (_cTrend ? ('(' + (_cTrend > 0 ? '+' : '') + _cTrend + ')') : '') + '·影响' + Math.round(Number(c.influence) || 0) + (c._structBaseline != null ? ('·势位' + Math.round(c._structBaseline)) : '') + _cPhase + _cRadical + _cMove + _cWorst + (_cDm ? ('·求:' + _cDm) : ''));
        });
        var _leg = GM._legitimacy;
        if (_leg && _leg.flag && _leg.flag !== '相安') stateLines.push('  〔天命权重〕权贵满意(clout)' + _leg.clout + ' vs 民心(人口)' + _leg.pop + '·' + _leg.flag);
        stateLines.push('  （满意=当下·势位=结构应然·乱民=激进民情(汹涌则近民变)·运动=持续未偿诉求所凝(成势/鼎沸则朝野震动)·求=当前诉求——class_changes 须以正册为准）');
      }
      // ①·C4 流寇威胁喂 LLM（朝廷据此叙事/下旨剿抚·出 roving_actions）
      if (Array.isArray(GM.rovingRebels)) {
        var _rov = GM.rovingRebels.filter(function(r) { return r && !r.disbanded && (Number(r.strength) || 0) > 0; });
        if (_rov.length > 0) {
          stateLines.push('【流寇警报】');
          _rov.slice(0, 6).forEach(function(r) {
            stateLines.push('  - ' + (r.name || '流寇') + '·众' + (Number(r.strength) || 0) + ((r.regions && r.regions.length) ? ('·流窜' + r.regions.slice(0, 4).join('、')) : '') + '（可剿:roving_actions{action:suppress,force:兵力}耗军饷战损·或抚:{action:pacify}招为编户/军户然开赦贼恶例）');
          });
        }
      }
      // 本朝军力·全貌(补盲:让 AI 推演纳入军队各项数据·非只风险军队·主路径·2026-07-01)
      if (Array.isArray(GM.armies) && GM.armies.length > 0) {
        var _mlPf = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.factionName) || '';
        var _mlMine = _mlPf ? GM.armies.filter(function(a){ return a && !a.destroyed && a.faction === _mlPf; }) : [];
        if (_mlMine.length > 0) {
          var _mlFind = (typeof findCharByName === 'function') ? findCharByName : function(){ return null; };
          var _mlDeadCmd = function(a){ if(!a.commander) return true; var _c=_mlFind(a.commander); return !!(_c && (_c.alive===false||_c.dead===true)); };
          var _mlTot = _mlMine.reduce(function(s,a){ return s + (a.soldiers||a.size||0); }, 0);
          var _mlElite = _mlMine.filter(function(a){ return (a.training||0) >= 70 && (a.morale||0) >= 60; }).length;
          var _mlWeak = _mlMine.filter(function(a){ return (a.morale||100) < 40 || (a.training||100) < 40; }).length;
          var _mlNoCmd = _mlMine.filter(_mlDeadCmd).length;
          stateLines.push('【本朝军力·全貌】共 ' + _mlMine.length + ' 支·总兵 ' + _mlTot.toLocaleString() + '·精锐(训≥70气≥60) ' + _mlElite + ' 支·虚弱(气或训<40) ' + _mlWeak + ' 支' + (_mlNoCmd ? ('·缺帅/阵殁 ' + _mlNoCmd + ' 支') : ''));
          stateLines.push('〔主力军镇·按兵力(含主帅武智/训练/编制·推演用将募兵战守须据此)〕');
          _mlMine.slice().sort(function(a,b){ return (b.soldiers||b.size||0) - (a.soldiers||a.size||0); }).slice(0, 6).forEach(function(a){
            var _c = a.commander ? _mlFind(a.commander) : null;
            var _cmS = a.commander ? (_c ? (a.commander + '(武' + (_c.military||_c.valor||50) + '智' + (_c.intelligence||50) + ')') : a.commander) : '缺帅';
            if (a.commander && _mlDeadCmd(a)) _cmS = a.commander + '(阵殁/失联·待补)';
            var _cp = Array.isArray(a.composition) ? a.composition.slice(0,3).map(function(c){ return (c && c.type) ? c.type : ''; }).filter(Boolean).join('/') : '';
            stateLines.push('  · ' + a.name + '·' + (a.soldiers||a.size||0) + '兵·训' + (a.training||50) + '·气' + (a.morale||0) + '·帅' + _cmS + (_cp ? ('·编制' + _cp) : ''));
          });
        }
      }
      if (Array.isArray(GM.armies) && GM.armies.length > 0) {
        var riskArmies = GM.armies.filter(function(a) {
          return (a.mutinyRisk || 0) >= 50 ||
            (a.supply || 100) < 30 ||
            (a.morale || 100) < 30 ||
            (a.payArrearsMonths || 0) >= 2;
        });
        if (riskArmies.length > 0) {
          stateLines.push('【军情警报】');
          riskArmies.slice(0, 8).forEach(function(a) {
            stateLines.push('  - ' + (a.name || '?') +
              ' 驻=' + (a.garrison || '') +
              (a.state === 'marching' ? ' 赴=' + (a.destination || '') : '') +
              (a.state === 'sieging' ? ' 围城中' : '') +
              ' 粮=' + (a.supply || 0) +
              ' 士气=' + (a.morale || 0) +
              ' 欠饷=' + (a.payArrearsMonths || 0) + '月' +
              ' 兵变险=' + (a.mutinyRisk || 0));
          });
        }
      }
      // 当前战事（修·簇5#3：主推演从不注入战争状态→AI 对自己正在打的仗全盲，可能对已停战方再宣战或违背盟约）
      if (Array.isArray(GM.activeWars) && GM.activeWars.length > 0) {
        stateLines.push('【当前战事】');
        GM.activeWars.slice(0, 10).forEach(function(w) {
          if (!w) return;
          var atk = w.attacker || (Array.isArray(w.sides) ? w.sides[0] : '') || '?';
          var def = w.defender || (Array.isArray(w.sides) ? w.sides[1] : '') || '?';
          stateLines.push('  - ' + atk + ' 攻 ' + def +
            (w.warScore != null ? ' 战势=' + Math.round(Number(w.warScore) || 0) + '(攻方视角·±100决出)' : '') +
            (w.casusBelli || w.reason ? ' 缘由=' + String(w.casusBelli || w.reason).slice(0, 16) : '') +
            ((GM.turn && w.startTurn) ? ' 已历' + (GM.turn - w.startTurn) + '回合' : ''));
        });
        stateLines.push('  （已在交战的对象不得"再宣战"；议和/续战须据战势数值定夺）');
      }
      if (Array.isArray(GM.treaties)) {
        var _liveT = GM.treaties.filter(function(t) { return t && (t.expireTurn == null || (GM.turn || 0) < t.expireTurn); });
        if (_liveT.length > 0) {
          stateLines.push('【现行和约/盟约】');
          _liveT.slice(0, 8).forEach(function(t) {
            var _pt = Array.isArray(t.parties) ? t.parties.join('·') : [t.factionA, t.factionB, t.from, t.to].filter(Boolean).join('·');
            stateLines.push('  - ' + (t.typeName || t.type || '盟约') + '：' + _pt + (t.mutual_defense === true ? '·互防' : ''));
          });
          stateLines.push('  （盟约方不得相互攻伐；互防方被攻须考虑履约）');
        }
      }
      // 现行地块状态（修·簇5#6：region_status_changes 只写不读回→AI 不知哪些地块挂着灾异/善政，无法判断该续该撤）
      try {
        var _RS = (global && global.RegionStatus) || (global && global.TM && global.TM.RegionStatus) || null;
        var _Prs = ctx.P || (global && global.P) || null;
        if (_RS && typeof _RS.list === 'function' && _Prs && _Prs.adminHierarchy) {
          var _rsLines = [], _rsN = 0;
          Object.keys(_Prs.adminHierarchy).forEach(function(fk) {
            var fh = _Prs.adminHierarchy[fk];
            (function _w(ds) {
              (ds || []).forEach(function(d) {
                if (!d || _rsN >= 12) return;
                var sts = _RS.list(d);
                if (Array.isArray(sts) && sts.length) sts.forEach(function(st) {
                  if (!st || _rsN >= 12) return;
                  _rsLines.push('  - ' + (d.name || '') + '：' + (st.label || st.kind || st.name || st.type || '') + (st.expiresTurn ? '(至' + st.expiresTurn + ')' : '(长存)'));
                  _rsN++;
                });
                if (d.children) _w(d.children);
                if (d.divisions) _w(d.divisions);
              });
            })(fh && fh.divisions);
          });
          if (_rsLines.length) { stateLines.push('【现行地块状态】'); _rsLines.forEach(function(l) { stateLines.push(l); }); stateLines.push('  （灾异消弭须以 region_status_changes remove；勿对已挂状态重复 add）'); }
        }
      } catch (_rsE) {}
      if (stateLines.length > 0) {
        sysP += '\n\n' + stateLines.join('\n');
        sysP += '\n规则：推演时必须按上述数值展开；势力 lifePhase 决定基调；党派 influence 决定话语权；兵变险 >= 60 必生事件。';
      }
    } catch (err) {
      _capture(err, 'endturn-ai-context.runtime-state');
    }

    try {
      var buildNpcDecisionsForSysP = ctx.buildNpcDecisionsForSysP || global.buildNpcDecisionsForSysP;
      if (typeof buildNpcDecisionsForSysP === 'function') {
        var npcBlock = buildNpcDecisionsForSysP();
        if (npcBlock) {
          sysP += npcBlock;
          sysP += '\n规则：NPC 预规划条目必须按 rationale 展开，不得背离 NPC 已设定动机。';
        }
      }
    } catch (err2) {
      _capture(err2, 'endturn-ai-context.npc-plan');
    }

    sysP += '\n\n【官员任免链则·AI 必守】';
    sysP += '\n1. 推演中的升迁、免职、夺职、调任、新任，必须通过 personnelChanges 输出，字段含 {name, change, fromPost, toPost}。';
    sysP += '\n2. 不得在 shizhengji/zhengwen 中擅称某人为某官，除非 officeTree 已同步换旧任与新任。';
    sysP += '\n3. 同一官职只能有一位正职 holder；换任时要记录前任离任和新任上任。';
    sysP += '\n4. 玩家未颁任免诏令时，AI 不得无前提创造新任命，除非存在空缺、死亡等明确条件。';
    sysP += '\n5. 叙事任命若未通过 personnelChanges 同步，视为推演错误。';

    sysP += '\n\n【输出纯文本链则】';
    sysP += '\n所有叙事字段必须为纯中文文本，不得输出 HTML 标签、onclick、javascript:、URL 或 Markdown 链接。';
    sysP += '\n遇到参考文本中含 HTML 时，原样输出前必须剥离 HTML，只保留中文。';

    try {
      var buildEdictEfficacyFollowUp = ctx.buildEdictEfficacyFollowUp || global.buildEdictEfficacyFollowUp;
      if (typeof buildEdictEfficacyFollowUp === 'function') {
        var edictBlock = buildEdictEfficacyFollowUp();
        if (edictBlock) sysP += edictBlock;
      }
    } catch (err3) {
      _capture(err3, 'endturn-ai-context.edict-followup');
    }

    try {
      var buildCharArcsForSysP = ctx.buildCharArcsForSysP || global.buildCharArcsForSysP;
      if (typeof buildCharArcsForSysP === 'function') {
        var arcBlock = buildCharArcsForSysP();
        if (arcBlock) sysP += arcBlock;
      }
    } catch (err4) {
      _capture(err4, 'endturn-ai-context.char-arcs');
    }

    try {
      var plan = GM._aiInferencePlan;
      if (plan && plan.generatedAt) {
        if (plan.npcHiddenAgenda && Object.keys(plan.npcHiddenAgenda).length > 0) {
          sysP += '\n\n【NPC 隐藏议程】AI 推演 NPC 行为时必须参考，而非只按官职教条推理。';
          Object.keys(plan.npcHiddenAgenda).forEach(function(name) {
            sysP += '\n  - ' + name + ': ' + _slice(plan.npcHiddenAgenda[name], 120);
          });
        }
        if (Array.isArray(plan.crisisBranches) && plan.crisisBranches.length > 0) {
          sysP += '\n\n【危机分岔·剧本可能走向】不要一次演完所有，按玩家实际诏令择路展开。';
          plan.crisisBranches.forEach(function(branch) {
            sysP += '\n  - ' + _slice(branch, 150);
          });
        }
        if (Array.isArray(plan.tippingPoints) && plan.tippingPoints.length > 0) {
          sysP += '\n\n【不可逆临界点】';
          plan.tippingPoints.forEach(function(t) {
            sysP += '\n  - ' + _slice(t, 120);
          });
        }
        if (plan.narrativeTone) {
          var tone = plan.narrativeTone;
          if (tone.sentenceStyle) sysP += '\n\n【行文指令·句式】' + _slice(tone.sentenceStyle, 80);
          if (Array.isArray(tone.vocabulary) && tone.vocabulary.length > 0) sysP += '\n【典型词汇】' + tone.vocabulary.slice(0, 8).join('、');
          if (tone.pacing) sysP += '\n【节奏】' + _slice(tone.pacing, 80);
        }
        if ((GM.turn || 0) <= 2 && plan.npcFirstTurnReaction && Object.keys(plan.npcFirstTurnReaction).length > 0) {
          sysP += '\n\n【首回合 NPC 候选反应·参考】';
          Object.keys(plan.npcFirstTurnReaction).slice(0, 15).forEach(function(name2) {
            sysP += '\n  - ' + name2 + ': ' + _slice(plan.npcFirstTurnReaction[name2], 80);
          });
        }
      }
    } catch (err5) {
      _capture(err5, 'endturn-ai-context.inference-plan');
    }

    try {
      var fm = GM._aiFactionMatrix;
      if (fm && fm.generatedAt) {
        if (Array.isArray(fm.factionMatrix) && fm.factionMatrix.length > 0) {
          sysP += '\n\n【势力关系矩阵】AI 必须按此演绎势力互动，不得凭空突变。';
          fm.factionMatrix.slice(0, 10).forEach(function(m) {
            if (!m || !m.facA || !m.facB) return;
            sysP += '\n  - ' + m.facA + ' -> ' + m.facB + ': ' + (m.currentRelation || '') +
              '；10回合走向=' + _slice(m.trajectoryNext10Turns, 100);
            if (Array.isArray(m.triggersToEscalate) && m.triggersToEscalate.length > 0) {
              sysP += '；升级条件=' + m.triggersToEscalate.slice(0, 2).join('/');
            }
            if (Array.isArray(m.triggersToReconcile) && m.triggersToReconcile.length > 0) {
              sysP += '；和解条件=' + m.triggersToReconcile.slice(0, 2).join('/');
            }
          });
        }
        if (Array.isArray(fm.alliancePotentials) && fm.alliancePotentials.length > 0) {
          sysP += '\n【结盟潜力】' + fm.alliancePotentials.slice(0, 4).join(' | ');
        }
        if (Array.isArray(fm.strategicTriangles) && fm.strategicTriangles.length > 0) {
          sysP += '\n【三角博弈】' + fm.strategicTriangles.slice(0, 3).join(' | ');
        }
        if ((GM.turn || 0) <= 5 && Array.isArray(fm.blackSwans) && fm.blackSwans.length > 0) {
          sysP += '\n【势力黑天鹅·前5回合参考】' + fm.blackSwans.slice(0, 5).join(' | ');
        }
      }
    } catch (err6) {
      _capture(err6, 'endturn-ai-context.faction-matrix');
    }

    return sysP;
  }

  TM.EndTurnAIContext.appendPromptPolicyContext = appendPromptPolicyContext;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.EndTurnAIContext;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
