// @ts-check
// ═══════════════════════════════════════════════════════════════════════
//  tm-ai-change-applier-reconcile.js — AI 变化「复核/善后」分片
//  （巨石拆分第二十二拆·20260706·自 tm-ai-change-applier.js 行 3253-4055 迁出）
//  内容：死亡规范化/墓志铭/玩家走位复核/职掌巡行/政令遵从/摄政裁决/写前预检(preflight)/战果结算/赤字惩罚。
//  【装载序·硬约束】须在 tm-ai-change-applier.js（origin）【之后】装载（index.html 紧随其后）：
//    origin 装载期已向 bucket TM.__acaParts 导出本片捕获的 origin 成员（下方 var 捕获行）；
//    本片把复核/善后族函数回填 bucket 供 origin 委托 shim 调用期解析。错序=捕获 undefined 立崩。契约见 lint-split-contracts。
// ═══════════════════════════════════════════════════════════════════════
(function(global) {
  'use strict';
  var __acaP = (function(){ var t = global.TM = global.TM || {}; return t.__acaParts = t.__acaParts || {}; })();
  // ── reverse 捕获：origin 成员（origin 装载期已 __acaP.X=X 导出；本地名与迁出体一致·体内 0 改字节）──
  var _findEntity = __acaP._findEntity, _estimateTravelDays = __acaP._estimateTravelDays, _arriveCharNow = __acaP._arriveCharNow, _sameTravelLocation = __acaP._sameTravelLocation, _travelMirrorFields = __acaP._travelMirrorFields, _syncCharacterLocationMirrors = __acaP._syncCharacterLocationMirrors, _refreshCharacterLocationUiAfterTravel = __acaP._refreshCharacterLocationUiAfterTravel;
  var _applyAITurnChangesUnsafe = __acaP._applyAITurnChangesUnsafe;
  //>>ACA-SPLIT22-RECONCILE-BODY-START
  // ═══════════════════════════════════════════════════════════════════
  //  AI 人物死亡写回完整性：char_updates 敏感键 → character_deaths → 唯一死亡 sink
  // ═══════════════════════════════════════════════════════════════════
  var _CHAR_DEATH_FIELD_RE = /^(?:alive|dead|isDead|deceased|positionAtDeath|diedAt|death[a-zA-Z0-9_]*|_death[a-zA-Z0-9_]*)$/i;

  function _strictLivingChar(G, ref) {
    var name = String(ref == null ? '' : ref).trim();
    if (!name || !G || !Array.isArray(G.chars)) return null;
    var ch = G.chars.find(function(c) {
      return c && ((c.name != null && String(c.name).trim() === name) || (c.id != null && String(c.id).trim() === name));
    });
    return ch && ch.alive !== false && ch.dead !== true ? ch : null;
  }

  function normalizeAIWriteBackDeaths(aiOutput, opts) {
    opts = opts || {};
    var G = global.GM;
    var result = { added: [], routed: [], failed: [], normalized: 0 };
    if (!G || !aiOutput || typeof aiOutput !== 'object' || !Array.isArray(aiOutput.char_updates)) return result;
    if (!Array.isArray(aiOutput.character_deaths)) aiOutput.character_deaths = [];

    aiOutput.char_updates.forEach(function(cu) {
      if (!cu || typeof cu !== 'object') return;
      var updates = (cu.updates && typeof cu.updates === 'object' && !Array.isArray(cu.updates)) ? cu.updates : null;
      var wantsDeath = !!((updates && (updates.alive === false || updates.dead === true || updates.isDead === true || updates.deceased === true)) ||
        cu.alive === false || cu.dead === true || cu.isDead === true || cu.deceased === true);
      var hadSensitive = false;
      var reason = String(cu.reason || cu.deathReason || cu.deathCause ||
        (updates && (updates.deathReason || updates.deathCause || updates._deathCause)) || 'AI人物死亡').trim();

      if (updates) Object.keys(updates).forEach(function(key) {
        if (_CHAR_DEATH_FIELD_RE.test(key)) { hadSensitive = true; delete updates[key]; }
      });
      Object.keys(cu).forEach(function(key) {
        if (_CHAR_DEATH_FIELD_RE.test(key)) { hadSensitive = true; delete cu[key]; }
      });
      if (!hadSensitive) return;
      if (!wantsDeath) {
        result.failed.push({ char_update: cu.name || '', reason: 'sensitive death fields require character_deaths' });
        return;
      }
      var ch = _strictLivingChar(G, cu.name);
      if (!ch) {
        result.failed.push({ char_update: cu.name || '', reason: 'death target must be an existing living character' });
        return;
      }
      var existing = aiOutput.character_deaths.find(function(cd) {
        var ref = cd && String(cd.name || '').trim();
        return ref && (ref === String(ch.name || '').trim() || ref === String(ch.id || '').trim());
      });
      if (!existing) {
        existing = { name: ch.name || ch.id, reason: reason || 'AI人物死亡' };
        aiOutput.character_deaths.push(existing);
        result.added.push(existing);
      } else if (!existing.reason && !existing.cause && !existing.deathReason) {
        existing.reason = reason || 'AI人物死亡';
      }
      if (!result.routed.some(function(cd) { return cd === existing; })) result.routed.push(existing);
      result.normalized++;
    });
    return result;
  }

  function applyNormalizedAIWriteBackDeaths(G, normalization, applied) {
    normalization = normalization || { routed: [], added: [], failed: [] };
    applied = applied || { failed: [] };
    if (!Array.isArray(applied.failed)) applied.failed = [];
    if (Array.isArray(normalization.failed) && normalization.failed.length) {
      Array.prototype.push.apply(applied.failed, normalization.failed);
    }
    var routed = Array.isArray(normalization.routed) ? normalization.routed : (normalization.added || []);
    var appliedChars = [];
    routed.forEach(function(cd) {
      var ch = _strictLivingChar(G, cd && cd.name);
      if (!ch) { applied.failed.push({ character_death: cd, reason: 'death target no longer living' }); return; }
      if (appliedChars.indexOf(ch) >= 0) return;
      try {
        if (typeof global.applyOneDeath === 'function') global.applyOneDeath(cd);
        else if (typeof global.applyCharacterDeaths === 'function') global.applyCharacterDeaths({ character_deaths: [cd] });
        else { applied.failed.push({ character_death: cd, reason: 'death pipeline unavailable' }); return; }
        if (ch.alive === false || ch.dead === true) appliedChars.push(ch);
        else applied.failed.push({ character_death: cd, reason: 'death pipeline did not apply' });
      } catch (e) {
        applied.failed.push({ character_death: cd, reason: (e && e.message) || 'death pipeline exception' });
      }
    });
    if (appliedChars.length) {
      applied.semantic = applied.semantic || {};
      applied.semantic.character_deaths_normalized = appliedChars.length;
    }
    return appliedChars.length;
  }

  global.normalizeAIWriteBackDeaths = normalizeAIWriteBackDeaths;
  global.applyNormalizedAIWriteBackDeaths = applyNormalizedAIWriteBackDeaths;

  // ═══════════════════════════════════════════════════════════════════
  //  死亡墓志铭 & 诈死holding
  // ═══════════════════════════════════════════════════════════════════
  function _processDeathEpitaphs(G, aiOutput) {
    if (!G || !Array.isArray(G.chars)) return;
    if (!G._epitaphs) G._epitaphs = [];
    if (!G._fakeDeathHolding) G._fakeDeathHolding = {};

    // 处理本回合 character_deaths
    var deathList = Array.isArray(aiOutput.character_deaths) ? aiOutput.character_deaths : [];
    deathList.forEach(function(d){
      if (!d || !d.name) return;
      var ch = _findEntity(G, 'char', d.name);
      if (!ch) return;
      var isFake = (d.type === 'fake' || d.type === '诈死' || /\u8BC8\u6B7B/.test(d.reason || ''));
      if (isFake) {
        ch._fakeDeath = true;
        // holding：保留该角色过往 aiMemory/evtLog 引用·不摘要不清理
        G._fakeDeathHolding[ch.name] = {
          turn: G.turn || 0,
          reason: d.reason || '',
          _memorySnapshot: (ch._memory ? ch._memory.slice() : [])
        };
        G._turnReport.push({ type: 'fake_death', char: ch.name, reason: d.reason, turn: G.turn || 0 });
        return;
      }
      // 真死：生成墓志铭
      _generateEpitaph(G, ch, d.reason || '');
    });

    // 补扫：alive=false 但尚无墓志铭的角色（可能被 char_updates 间接赐死）
    G.chars.forEach(function(ch){
      if (!ch || ch.alive !== false || ch._fakeDeath) return;
      if (ch._epitaphed) return;
      _generateEpitaph(G, ch, ch._deathReason || '');
    });
  }

  function _generateEpitaph(G, ch, reason) {
    if (!ch || ch._epitaphed) return;
    var name = ch.name || '';
    // 摘要：取过去30回合内 aiMemory/evtLog 中涉及该角色的事件
    var snippets = [];
    var curTurn = G.turn || 0;
    (G._aiMemory || []).forEach(function(mem){
      if (!mem) return;
      var mtxt = (typeof memoryEntryText === 'function') ? memoryEntryText(mem) : ((mem.text || mem.content || '') + '');
      if (!mtxt) return;
      if ((curTurn - (mem.turn||0)) > 30) return;
      if (mtxt.indexOf(name) >= 0) snippets.push('T'+mem.turn+' '+mtxt.substring(0,80));
    });
    var _evtLen = (G.evtLog || []).length;
    (G.evtLog || []).forEach(function(ev, idx){
      if (!ev) return;
      var txt = (ev.desc || ev.text || '') + '';
      if (!txt || txt.indexOf(name) < 0) return;
      // 最近200条采样入墓志铭
      if ((_evtLen - idx) <= 200) {
        snippets.push('T'+(ev.turn||0)+' '+txt.substring(0,80));
      }
      // 打标：所有提及该死者的事件（不限200条）均标注，后续 prompt 过滤
      ev._charDied = true;
    });
    var epitaph = {
      char: name,
      diedTurn: curTurn,
      diedAt: ch.diedAt || (G.eraState && G.eraState.yearLabel) || '',
      reason: reason || ch._deathReason || '',
      positionAtDeath: ch.positionAtDeath || ch.officialTitle || '',  // 死亡应用已清 officialTitle·殁前官衔存于 positionAtDeath
      summary: snippets.slice(0, 10).join(' | ') || ('T'+curTurn+' '+name+'薨'),
      importance: (ch.historicalImportance || 0) + (ch._memory ? ch._memory.length : 0)
    };
    G._epitaphs.push(epitaph);
    // 从 _aiMemory 移除该角色原始条目（保留墓志铭摘要）
    if (Array.isArray(G._aiMemory)) {
      G._aiMemory = G._aiMemory.filter(function(mem){
        var memText = (typeof memoryEntryText === 'function') ? memoryEntryText(mem) : ((mem && (mem.text || mem.content)) || '');
        if (!mem || !memText) return true;
        return memText.indexOf(name) < 0;
      });
    }
    ch._epitaphed = true;
    G._turnReport.push({ type: 'epitaph', char: name, reason: epitaph.reason, turn: curTurn });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  移动对账层 S3·确定性兜底（2026-05-28）
  //  顽疾根因：人物移动 100% 靠 AI 自愿吐 char_updates.travelTo·AI 只叙事不吐字段→原地不动。
  //  本层在 AI 变更应用后·按 prep 捕获的玩家移动令逐条核对·AI 漏的引擎自己落地。
  // ═══════════════════════════════════════════════════════════════════
  // 是否有"即时/次回合抵达"类玩家持久规则/天意在线（决策2·规则纯 context·这里只读不改规则）
  function _hasInstantArrivalRule(G) {
    if (!G || !Array.isArray(G._playerDirectives)) return false;
    var moveKey = /人事|调动|调任|移动|移驻|赴任|召见|召还|到任|抵达|走位/;
    var instKey = /即刻|即时|瞬间|立即|当回合|次回合|疾驰|星夜|无在途|不在途|不存在.{0,3}在途/;
    return G._playerDirectives.some(function(d){
      if (!d) return false;
      if (d.type !== 'rule' && !d._absolute) return false;   // 仅持久规则/天意
      var t = (d.content || '') + ' ' + (d.structured ? JSON.stringify(d.structured) : '');
      return moveKey.test(t) && instKey.test(t);
    });
  }
  // 决策1·即时到达=系统型·须挂后果（轻量·不直写财政账本避免 desync·重后果可后续按距离/品级扩展）
  function _applyInstantArrivalCost(G, ch, mc) {
    try {
      if (typeof ch.stress === 'number') ch.stress = Math.min(100, ch.stress + 5); else ch.stress = 5;
      if (typeof global.addEB === 'function') global.addEB('人事', ch.name + ' 奉诏急递星夜驰抵 ' + mc.to + '·鞍马劳顿（即时到达·驿传代价）');
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      G._turnReport.push({ type:'instant_arrival_cost', char: ch.name, to: mc.to, stress: 5, turn: G.turn || 0 });
    } catch(_){}
  }
  function _reconcilePlayerMovements(G) {
    if (!G || !Array.isArray(G._turnMoveCommands) || G._turnMoveCommands.length === 0) return;
    var cmds = G._turnMoveCommands;
    G._turnMoveCommands = [];   // 本回合消费一次·清空·避免跨回合重复兜底
    if (!Array.isArray(G.chars)) return;
    var instant = _hasInstantArrivalRule(G);
    var dateText = (typeof global.getTSText === 'function') ? global.getTSText(G.turn || 0) : ('T' + (G.turn || 0));
    var fixed = 0;
    cmds.forEach(function(mc){
      if (!mc || !mc.char || !mc.to) return;
      var ch = null;
      for (var i = 0; i < G.chars.length; i++) { if (G.chars[i] && G.chars[i].name === mc.char) { ch = G.chars[i]; break; } }
      if (!ch) return;
      if (ch.alive === false) return;                                  // 已故不动
      if (_sameTravelLocation(ch.location || '', mc.to)) return;        // 已在目标地·达成
      var heading = ch._travelTo && _sameTravelLocation(ch._travelTo, mc.to);  // AI 已为此目标启程在途
      var cmdInstant = instant || !!mc.instant;                        // 即时=持久规则在线 或 本条移动令诏文直言即刻/瞬间(extractEdictMovements 标 mc.instant)
      if (heading && !cmdInstant) return;                              // 已在途·又无即时要求→尊重 AI 行程·不重复兜底
      if (typeof ch._travelAssignPost !== 'string') ch._travelAssignPost = '';
      if (cmdInstant) {
        // 即时抵达规则在线→当回合直接到位（AI 漏吐 或 只启了慢程·都压成即抵·满足"不存在在途"）+ 决策1后果
        if (!heading) ch._travelFrom = ch.location || '';
        ch._travelTo = mc.to;
        ch._travelReason = (mc.reason || '诏令移动') + '·急递即刻抵达(玩家规则)';
        _arriveCharNow(G, ch, dateText);
        _applyInstantArrivalCost(G, ch, mc);
      } else {
        // 无即时规则·AI 又漏了→引擎补启正常多回合行程（至少"走位起步"·不再原地不动）
        ch._travelFrom = ch.location || '';
        ch._travelTo = mc.to;
        ch._travelReason = (mc.reason || '诏令移动') + '·引擎补启';
        ch._travelStartTurn = G.turn || 0;
        ch._travelRemainingDays = _estimateTravelDays(ch._travelFrom, mc.to);
        try { _syncCharacterLocationMirrors(G, ch, _travelMirrorFields(ch), []); } catch(_){}
        if (typeof global.addEB === 'function') global.addEB('人事', ch.name + ' 奉诏启程赴 ' + mc.to + '（引擎补启·AI 漏返 travelTo）');
      }
      if (!Array.isArray(G._turnReport)) G._turnReport = [];
      G._turnReport.push({ type:'move_reconciled', char: ch.name, to: mc.to, instant: !!instant, turn: G.turn || 0 });
      fixed++;
    });
    if (fixed > 0 && typeof _refreshCharacterLocationUiAfterTravel === 'function') {
      try { _refreshCharacterLocationUiAfterTravel(); } catch(_){}
    }
  }
  global._reconcilePlayerMovements = _reconcilePlayerMovements;

  // ── P-VWF·2026-05-29·财政改革对账层 ──
  // 照 _reconcilePlayerMovements 范式·读 GM._turnFiscalReforms·按 type 确定性拨开关（必生效）·
  // 根治"玩家开源改革(肃贪/清丈/盐法/开海/劝农)未接入央地真账·中央月入死焊"。
  // 量：粗保底值（明示·owner 可调·绝非精细基线表）·只是 AI 没吐力度时的"必生效"兜底；
  // AI 按情境吐力度（2b-AI量）留后续 prompt 教 AI 再接·此处先保"生不生效"高一量级的红线。
  function _reconcilePlayerFiscalReforms(G, aiOutput) {
    if (!G || !Array.isArray(G._turnFiscalReforms) || G._turnFiscalReforms.length === 0) return;
    var reforms = G._turnFiscalReforms;
    G._turnFiscalReforms = [];   // 本回合消费一次·清空·避免跨回合重复兜底
    var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || null;
    var _P = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
    var pFac = (_P && _P.playerInfo && _P.playerInfo.factionName) || '';
    if (!Array.isArray(G._turnReport)) G._turnReport = [];
    // 粗保底量（owner 可调·非精细分操作表·仅 AI 未吐力度时的必生效兜底）
    var BASE = { compliance: 0.05, saltRate: 0.05, corruption: 3 };
    // 2b-AI量：AI 按情境吐 reform_effects:[{type, complianceDelta?, rateDelta?}]·有则用 AI（夹护栏）·无则走 BASE 粗保底
    var aiMag = {};
    var _aiRe = (aiOutput && Array.isArray(aiOutput.reform_effects)) ? aiOutput.reform_effects : [];
    _aiRe.forEach(function(re) { if (re && re.type) aiMag[re.type] = re; });

    reforms.forEach(function(fr) {
      if (!fr || !fr.type) return;
      var detail = { type: fr.type };
      if (fr.type === 'anticorruption') {
        var cd = (aiMag.anticorruption && typeof aiMag.anticorruption.complianceDelta === 'number') ? Math.max(0, Math.min(0.2, aiMag.anticorruption.complianceDelta)) : BASE.compliance; // AI 给则用·夹护栏 0-0.2·无则粗保底
        var n = (FE && FE.adjustPlayerCompliance) ? FE.adjustPlayerCompliance(pFac, cd, 0.1, 1) : 0;
        if (n === 0 && FE && FE.adjustPlayerCompliance) n = FE.adjustPlayerCompliance('', cd, 0.1, 1); // 势力key对不上→不过滤兜底·保必生效
        detail.complianceUp = cd; detail.fromAI = !!aiMag.anticorruption; detail.divisions = n;
        // P-DZ·吏治接浊度：肃贪降浊度。落点已查死（aggregateRegionsToVariables endturn 把 div.corruption 聚合→subDepts.provincial.true，会覆盖直接写的 provincial），故分两条：
        //   ① provincial 半 + cascade 中央月入：降源头 div.corruption（cascade corrPenalty 直接读·computeTaxAmount→实收；回合末 aggregate 把它聚合成 provincial.true→实征率面板·持久不回弹）
        //   ② fiscal 半：独立全局口·aggregate 不覆盖·直接降 subDepts.fiscal.true + sync（当回合即反映实征率财政半）
        // 确定性管「降这件事 + 护栏」，量交 AI（corruptionDelta 夹 0~15）·无则粗保底
        try {
          var corrDrop = (aiMag.anticorruption && typeof aiMag.anticorruption.corruptionDelta === 'number') ? Math.max(0, Math.min(15, aiMag.anticorruption.corruptionDelta)) : BASE.corruption; // AI 给则用·夹 0~15·无则粗保底
          // ① 降源头 div.corruption（cascade 中央月入 + 回合末 aggregate→provincial.true）
          var _divN = (FE && FE.adjustPlayerDivisionCorruption) ? FE.adjustPlayerDivisionCorruption(pFac, -corrDrop, 0, 100) : 0;
          if (_divN === 0 && FE && FE.adjustPlayerDivisionCorruption) _divN = FE.adjustPlayerDivisionCorruption('', -corrDrop, 0, 100); // 势力 key 对不上→不过滤兜底·保必生效
          // ② fiscal 独立全局口·直接降 + sync（当回合即反映）
          var _CE = (typeof global !== 'undefined' && global.CorruptionEngine) || (typeof window !== 'undefined' && window.CorruptionEngine) || null;
          var _GMc = (typeof global !== 'undefined' && global.GM) || G; // 与 corruption-engine 同源
          if (_GMc && _GMc.corruption && _GMc.corruption.subDepts && _GMc.corruption.subDepts.fiscal && typeof _GMc.corruption.subDepts.fiscal.true === 'number') {
            _GMc.corruption.subDepts.fiscal.true = Math.max(0, _GMc.corruption.subDepts.fiscal.true - corrDrop);
            if (_CE && typeof _CE.syncIndexFromSubDepts === 'function') _CE.syncIndexFromSubDepts('肃贪整饬吏治（P-DZ·财政口·实征率回升）');
          }
          detail.corruptionDrop = corrDrop; detail.corruptionDivisions = _divN; detail.corruptionFromAI = !!(aiMag.anticorruption && typeof aiMag.anticorruption.corruptionDelta === 'number');
        } catch (_dzE) {}
      } else if (fr.type === 'landsurvey') {
        var ns = (FE && FE.triggerPlayerSurvey) ? FE.triggerPlayerSurvey(pFac) : 0;
        if (ns === 0 && FE && FE.triggerPlayerSurvey) ns = FE.triggerPlayerSurvey('');
        detail.surveyed = ns;
      } else if (fr.type === 'saltreform') {
        if (!G.policies) G.policies = {};
        var cur = typeof G.policies.saltTaxRate === 'number' ? G.policies.saltTaxRate : 0.40;
        var sd = (aiMag.saltreform && typeof aiMag.saltreform.rateDelta === 'number') ? Math.max(-0.2, Math.min(0.2, aiMag.saltreform.rateDelta)) : BASE.saltRate; // AI 给则用·夹护栏 ±0.2·无则粗保底
        G.policies.saltTaxRate = Math.max(0, Math.min(0.8, cur + sd)); // 护栏·税率不破0.8崩档
        detail.saltTaxRate = G.policies.saltTaxRate; detail.fromAI = !!aiMag.saltreform;
      } else if (fr.type === 'openmaritime') {
        if (G._maritimeBan) G._maritimeBan = { active: false, turn: G.turn || 0 };
        detail.maritimeBanLifted = true;
      } else if (fr.type === 'encouragefarming') {
        if (!G.policies) G.policies = {};
        G.policies.encourageFarming = true;
        detail.encourageFarming = true;
      } else {
        return;
      }
      G._turnReport.push({ type: 'fiscal_reform_reconciled', reform: fr.type, detail: detail, turn: G.turn || 0 });
      if (typeof global.addEB === 'function') global.addEB('财政改革', ({anticorruption:'肃贪',landsurvey:'丈田',saltreform:'盐政改革',openmaritime:'开海通商',encouragefarming:'劝农'}[fr.type]||fr.type) + '·已确定性落账·必生效');
    });
  }
  global._reconcilePlayerFiscalReforms = _reconcilePlayerFiscalReforms;

  // ── 官制活化 Slice②·履职 tick → 实征率/腐败（确定性·开关 officeDutyStateEnabled·默认关零回归）──
  // 每回合调 tickOfficeDutyState：失职扣/称职奖·按抽象 power 映射既有 FE 杠杆（taxCollect→compliance·supervise/impeach→corruption）。
  function _applyOfficeDutyTick(G) {
    if (typeof officeFlagOn !== 'function' || !officeFlagOn('officeDutyStateEnabled')) return;
    if (typeof tickOfficeDutyState !== 'function') return;
    var agg = tickOfficeDutyState(G);
    if (!agg || (!agg.compliance && !agg.corruption)) return;
    var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || null;
    var _P = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
    var pFac = (_P && _P.playerInfo && _P.playerInfo.factionName) || '';
    if (!FE) return;
    if (agg.compliance && FE.adjustPlayerCompliance) {
      var nc = FE.adjustPlayerCompliance(pFac, agg.compliance, 0.1, 1);
      if (nc === 0) FE.adjustPlayerCompliance('', agg.compliance, 0.1, 1);   // 势力 key 对不上→不过滤兜底·保生效
    }
    if (agg.corruption && FE.adjustPlayerDivisionCorruption) {
      var nk = FE.adjustPlayerDivisionCorruption(pFac, agg.corruption, 0, 100);
      if (nk === 0) FE.adjustPlayerDivisionCorruption('', agg.corruption, 0, 100);
    }
    try {
      if (typeof global.addEB === 'function' && agg.details && agg.details.length) {
        var _low = agg.details.filter(function (x) { return x.band === 'low'; }).map(function (x) { return x.dept + (x.pos || ''); });
        var _high = agg.details.filter(function (x) { return x.band === 'high'; }).map(function (x) { return x.dept + (x.pos || ''); });
        var _seg = [];
        if (_low.length) _seg.push('失职：' + _low.join('、'));
        if (_high.length) _seg.push('称职：' + _high.join('、'));
        if (_seg.length) { global.addEB('官制', '履职结算·' + _seg.join('；') + '（实征率' + (agg.compliance >= 0 ? '+' : '') + agg.compliance.toFixed(3) + '·腐败' + (agg.corruption >= 0 ? '+' : '') + agg.corruption.toFixed(1) + '）'); if (!Array.isArray(G._chronicle)) G._chronicle = []; G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: (agg.compliance !== 0 && agg.corruption !== 0) ? '官制↔财政·吏治' : (agg.corruption !== 0 ? '官制↔吏治' : '官制↔财政'), text: '百官履职·' + _seg.join('；') + '·实征率' + (agg.compliance >= 0 ? '+' : '') + agg.compliance.toFixed(3) + '·吏治' + (agg.corruption >= 0 ? '+' : '') + agg.corruption.toFixed(1), tags: ['联动', '官制'] }); }
      }
    } catch (_ebE) {}
  }
  global._applyOfficeDutyTick = _applyOfficeDutyTick;

  // ── 官制活化 Slice③ 权限门·税类 income 执行力打折（颁布权≠执行力·开关 officeAuthorityGateEnabled·默认关零回归）──
  function _isTaxIncome(fa) {
    var s = String((fa.category || '') + '|' + (fa.name || '') + '|' + (fa.reason || ''));
    if (/缴获|贡纳|进贡|赏赐|罚没|抄没|抄家|捐纳|卖官|借款|赎银|缴还/.test(s)) return false;
    return /加赋|加派|加征|田赋|商税|盐课|盐税|关税|榷|赋税|税赋|征税|催征|追征|辽饷|练饷|剿饷|杂税|丁银|条鞭|火耗|正赋|钱粮|税银/.test(s);
  }
  function _applyTaxAuthorityGate(G, fa, amount) {
    if (typeof officeFlagOn !== 'function' || !officeFlagOn('officeAuthorityGateEnabled')) return amount;
    if (typeof resolveOfficeAuthority !== 'function') return amount;
    if (!(amount > 0) || fa.kind !== 'income' || !_isTaxIncome(fa)) return amount;
    var auth = resolveOfficeAuthority(G, 'taxCollect');
    if (!auth || auth.effectiveness >= 1) return amount;             // 称职满效·不打折
    var collected = Math.round(amount * auth.effectiveness);
    var shortfall = amount - collected;
    if (shortfall > 0) {
      try {
        var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine) || null;
        if (FE && FE.adjustPlayerDivisionCorruption) {
          var _P = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
          var pFac = (_P && _P.playerInfo && _P.playerInfo.factionName) || '';
          var corrBump = Math.min(8, (1 - auth.effectiveness) * 10);  // 漏额→中饱私囊·失效越狠涨越多·夹8
          var nn = FE.adjustPlayerDivisionCorruption(pFac, corrBump, 0, 100);
          if (nn === 0) FE.adjustPlayerDivisionCorruption('', corrBump, 0, 100);
        }
      } catch (_cgE) {}
    }
    try { if (typeof global.addEB === 'function') global.addEB('官制', '加赋失实·' + (fa.name || fa.category || '税入') + ' 原额' + amount + ' → 实收' + collected + '（×' + auth.effectiveness.toFixed(2) + '·' + auth.reason + '·漏额中饱）'); } catch (_egE) {}
    try { if (!Array.isArray(G._chronicle)) G._chronicle = []; G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: '官制↔财政·吏治', text: '掌征税之权' + auth.reason + '·' + (fa.name || fa.category || '税入') + ' 加赋原额' + amount + '·实收' + collected + '·漏额' + shortfall + '中饱', tags: ['联动', '官制'] }); } catch (_cgE2) {}
    return collected;
  }
  global._applyTaxAuthorityGate = _applyTaxAuthorityGate;

  function _applyDirectiveCompliance(G, aiOutput) {
    if (!G) return;
    // 刀9·本回合已执行一次性纠正指令暂存：下方 filter 删除 _pendingRemovalAfterApply 指令·validator 本 pass 稍后读其文本判源。
    //   ★turn 级重置(非每 pass 清)：同回合多 pass(sc1/问天/奏疏各调一次 applier)时·后续 pass 不得清掉先前 pass 快照·
    //   否则「王安病故」在后续 pass 被误判无源。按 GM.turn 换回合才清·同 turn 保留并去重 append·重入结算安全。
    var _curTurn = G.turn || 0;
    if (!Array.isArray(G._directivesAppliedThisTurn) || G._directivesAppliedTurn !== _curTurn) {
      G._directivesAppliedThisTurn = [];   // arch-ok
      G._directivesAppliedTurn = _curTurn;   // arch-ok
    }
    if (!Array.isArray(G._playerDirectives) || G._playerDirectives.length === 0) return;
    var reports = aiOutput && Array.isArray(aiOutput.directive_compliance) ? aiOutput.directive_compliance : [];
    // 按 id 索引指令
    var idMap = {};
    G._playerDirectives.forEach(function(d){ if (d && d.id) idMap[d.id] = d; });
    reports.forEach(function(r){
      if (!r || !r.id) return;
      var d = idMap[r.id];
      if (!d) return;
      d._lastStatus = r.status || 'ignored';
      d._lastReason = r.reason || '';
      d._lastEvidence = r.evidence || '';
      d._lastCheckTurn = G.turn || 0;
      if (d._lastStatus === 'ignored') {
        d._ignoredCount = (d._ignoredCount||0) + 1;
      } else if (d._lastStatus === 'followed') {
        d._followedCount = (d._followedCount||0) + 1;
      } else if (d._lastStatus === 'partial') {
        d._partialCount = (d._partialCount||0) + 1;
      }
      G._turnReport.push({ type: 'directive_compliance', id: r.id, status: r.status, reason: r.reason, evidence: r.evidence, turn: G.turn||0 });
    });
    // 未回报的 rule 类指令也标记为 unchecked （避免以为被遵守）
    G._playerDirectives.forEach(function(d){
      if (!d || !d.id) return;
      var reported = reports.some(function(r){return r && r.id===d.id;});
      if (!reported && d.type === 'rule' && d._lastCheckTurn !== G.turn) {
        d._lastStatus = 'unchecked';
        d._lastCheckTurn = G.turn || 0;
      }
    });
    // 合规处理完·清理本回合标记的一次性 directive（纠正类执行后移除）·删前把文本快照到本回合暂存(供刀9 源头判据·去重防重入双记)
    G._playerDirectives = G._playerDirectives.filter(function(d){
      if (d && d._pendingRemovalAfterApply) {
        try {
          var _dc = (d.content != null ? String(d.content) : '');
          if (!G._directivesAppliedThisTurn.some(function(x){ return x && x.content === _dc; })) {
            G._directivesAppliedThisTurn.push({ turn: _curTurn, content: _dc });   // arch-ok
          }
        } catch(_) {}
        return false;
      }
      return true;
    });
  }
  global._applyDirectiveCompliance = _applyDirectiveCompliance;

  function _applyRegentDecisions(G, aiOutput) {
    if (!G) return;
    var signal = G.regentSignal || (G.regentState && G.regentState.signal) || null;
    var decisions = aiOutput && Array.isArray(aiOutput.regent_decisions) ? aiOutput.regent_decisions : [];
    if (!signal && decisions.length === 0) {
      if (G.regentState && G.regentState.active === true) {
        G.regentState.active = false;
        G.regentState.hardCeiling = false;
        G.regentState.lastDecisionTurn = G.turn || 0;
      }
      return;
    }
    if (!G.regentState || typeof G.regentState !== 'object') G.regentState = {};
    G.regentState.signal = signal || G.regentState.signal || null;
    G.regentState.decisions = decisions.map(function(r) {
      return {
        subject: r && r.subject || '',
        regentName: r && r.regentName || '',
        action: r && r.action || 'defer',
        hardCeiling: !!(r && r.hardCeiling),
        reason: r && r.reason || ''
      };
    });
    G.regentState.active = !!(signal && signal.active);
    G.regentState.hardCeiling = !!(signal && signal.hardCeiling);
    G.regentState.lastDecisionTurn = G.turn || 0;
    if (signal) {
      G.regentState.rulerName = signal.rulerName || '';
      G.regentState.rulerTitle = signal.rulerTitle || '';
      G.regentState.rulerAge = signal.rulerAge;
      G.regentState.rulerHealth = signal.rulerHealth;
      G.regentState.playerRole = signal.playerRole || '';
      G.regentState.reasons = signal.reasons || [];
    }
    decisions.forEach(function(r) {
      G._turnReport.push({
        type: 'regent_decision',
        subject: r && r.subject || '',
        regentName: r && r.regentName || '',
        action: r && r.action || 'defer',
        hardCeiling: !!(r && r.hardCeiling),
        reason: r && r.reason || '',
        turn: G.turn || 0
      });
    });
  }
  global._applyRegentDecisions = _applyRegentDecisions;

  function _tmGateReason(label, reason, item) {
    var payload = { label: label || '', reason: reason || '', item: item || null };
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_gate', payload); } catch(_) {}
    _tmPushAIWeakHint(label, reason, item);
    return false;
  }

  function _tmNormName(name) {
    return String(name || '').trim().replace(/[\s·\-—、，。（）()《》“”"'：:；;！？?]/g, '');
  }

  function _tmNameOf(entity) {
    return entity && (entity.name || entity.id || entity.title || entity.label);
  }

  function _tmAliasHit(entity, raw, norm) {
    if (!entity) return false;
    var fields = ['_aliases', 'aliases', 'alias', 'courtesyName', 'zi', 'hao', 'posthumousName', 'templeName'];
    for (var i = 0; i < fields.length; i++) {
      var v = entity[fields[i]];
      if (!v) continue;
      var arr = Array.isArray(v) ? v : String(v).split(/[、,，/|;]/);
      for (var j = 0; j < arr.length; j++) {
        var a = String(arr[j] || '').trim();
        if (a && (a === raw || _tmNormName(a) === norm)) return true;
      }
    }
    return false;
  }

  function _tmFindInList(list, name) {
    if (!Array.isArray(list) || !name) return null;
    var raw = String(name).trim();
    var norm = _tmNormName(raw);
    if (!norm) return null;
    var i, e, en;
    for (i = 0; i < list.length; i++) {
      e = list[i]; en = _tmNameOf(e);
      if (e && en && String(en).trim() === raw) return e;
    }
    for (i = 0; i < list.length; i++) {
      e = list[i]; en = _tmNameOf(e);
      if (e && en && _tmNormName(en) === norm) return e;
    }
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (_tmAliasHit(e, raw, norm)) return e;
    }
    return null;
  }

  function _tmGetScenario(G) {
    try {
      if (typeof global.findScenarioById === 'function' && G && G.sid) return global.findScenarioById(G.sid);
    } catch(_) {}
    return null;
  }

  function _tmPushArrays(root, keys, out) {
    if (!root || typeof root !== 'object') return;
    keys.forEach(function(k) {
      if (Array.isArray(root[k])) out.push(root[k]);
    });
  }

  function _tmResolveChar(G, name) {
    if (!name || !G) return null;
    var active = _tmFindInList(G.chars || [], name);
    if (active) return { entity: active, source: 'GM.chars', active: true };
    try {
      if (global.DA && global.DA.chars && typeof global.DA.chars.findByName === 'function') {
        var da = global.DA.chars.findByName(name);
        if (da) return { entity: da, source: 'DA.chars', active: !!_tmFindInList(G.chars || [], _tmNameOf(da) || name) };
      }
    } catch(_) {}
    try {
      if (typeof global._fuzzyFindChar === 'function') {
        var fuzzy = global._fuzzyFindChar(name);
        if (fuzzy) return { entity: fuzzy, source: '_fuzzyFindChar', active: !!_tmFindInList(G.chars || [], _tmNameOf(fuzzy) || name) };
      }
    } catch(_) {}
    var all = _tmFindInList(G.allCharacters || [], name);
    if (all) return { entity: all, source: 'GM.allCharacters', active: false };
    var sc = _tmGetScenario(G);
    var sd = global.scriptData || {};
    var buckets = [];
    _tmPushArrays(sd, ['characters', 'chars', 'npcs', 'persons', 'allCharacters'], buckets);
    _tmPushArrays(sc, ['characters', 'chars', 'npcs', 'persons', 'allCharacters'], buckets);
    for (var i = 0; i < buckets.length; i++) {
      var hit = _tmFindInList(buckets[i], name);
      if (hit) return { entity: hit, source: 'scenario.characters', active: false };
    }
    return null;
  }

  function _tmResolveFaction(G, name) {
    if (!name || !G) return null;
    var active = _tmFindInList(G.facs || [], name);
    if (active) return { entity: active, source: 'GM.facs', active: true };
    try {
      if (global.DA && global.DA.factions && typeof global.DA.factions.findByName === 'function') {
        var da = global.DA.factions.findByName(name);
        if (da) return { entity: da, source: 'DA.factions', active: !!_tmFindInList(G.facs || [], _tmNameOf(da) || name) };
      }
    } catch(_) {}
    try {
      if (typeof global._fuzzyFindFac === 'function') {
        var fuzzy = global._fuzzyFindFac(name);
        if (fuzzy) return { entity: fuzzy, source: '_fuzzyFindFac', active: !!_tmFindInList(G.facs || [], _tmNameOf(fuzzy) || name) };
      }
    } catch(_) {}
    var sc = _tmGetScenario(G);
    var sd = global.scriptData || {};
    var buckets = [];
    _tmPushArrays(G, ['factions', 'allFactions', 'extForces'], buckets);
    _tmPushArrays(sd, ['factions', 'facs', 'allFactions', 'extForces'], buckets);
    _tmPushArrays(sc, ['factions', 'facs', 'allFactions', 'extForces'], buckets);
    for (var i = 0; i < buckets.length; i++) {
      var hit = _tmFindInList(buckets[i], name);
      if (hit) return { entity: hit, source: 'scenario.factions', active: false };
    }
    return null;
  }

  function _tmPushAIWeakHint(label, reason, item, resolution) {
    var G = global.GM;
    if (!G) return true;
    var hint = {
      label: label || '',
      reason: reason || '',
      itemName: item && (item.name || item.faction || item.newLeader || item.target || ''),
      source: resolution && resolution.source || '',
      active: resolution ? !!resolution.active : null,
      turn: G.turn || 0
    };
    if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];
    G._aiWeakWriteHints.push(hint);
    if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', hint); } catch(_) {}
    return true;
  }

  function _tmWeakEntityHint(label, reason, item, resolution) {
    _tmPushAIWeakHint(label, reason, item, resolution);
    return true;
  }

  // ── fiscal 别名归一(preflight 白名单判定用·落库契约硬化刀②·2026-07-16·居平内帑案悬案) ──
  //   ★别名表镜像·改须与 tm-ai-change-applier.js 的 _normTarget/_normKind(_flagFiscalTransferPairs 内)
  //     与 fiscal_adjustments 容差归一段(fa.target/fa.kind 中文别名映射)同步·三处逐字一致(反之亦然)。
  //   仅供 preflight 白名单判定·不 mutate 条目(下游 applier 会对留存条目再归一·防重复变换)。
  function _faNormTargetForGate(t) {
    var s = String(t == null ? '' : t).trim();
    if (/^(太仓|太仓库|国库|户部库|外库|公帑|公库|guoku|taicang|taicangku)$/i.test(s)) return 'guoku';
    if (/^(内帑|内库|内承运库|私帑|帝室库|御库|neitang|neicang)$/i.test(s)) return 'neitang';
    if (/^(province|省|布政使司)\s*[:：]/i.test(s)) return 'province:' + s.replace(/^(province|省|布政使司)\s*[:：]\s*/i, '');
    if (s === 'guoku' || s === 'neitang' || /^province:/.test(s)) return s;
    return '';
  }
  function _faNormKindForGate(k) {
    var s = String(k == null ? '' : k).trim();
    if (/^(income|收入|进项|增收|入项)$/i.test(s)) return 'income';
    if (/^(expense|expenditure|支出|开支|耗费|拨支|出项)$/i.test(s)) return 'expense';
    return (s === 'income' || s === 'expense') ? s : '';
  }

  function preflightAIWriteBack(aiOutput, opts) {
    var G = global.GM;
    if (!G || !aiOutput || typeof aiOutput !== 'object') return aiOutput;
    opts = opts || {};
    var blocked = 0;
    function keepArray(field, label, fn) {
      if (!Array.isArray(aiOutput[field])) return;
      var kept = [];
      aiOutput[field].forEach(function(item) {
        if (fn(item)) kept.push(item);
        else blocked++;
      });
      aiOutput[field] = kept;
    }

    function canonicalLeaderFields(item, fields, outputField, label) {
      if (!item || typeof item !== 'object') return { present:false, ok:true };
      var present = fields.filter(function(key) { return Object.prototype.hasOwnProperty.call(item, key); });
      if (!present.length) return { present:false, ok:true };
      var refs = present.map(function(key) { return String(item[key] == null ? '' : item[key]).trim(); });
      if (refs.every(function(ref) { return !ref; })) {
        present.forEach(function(key) { delete item[key]; });
        item[outputField] = '';
        return { present:true, ok:true, name:'' };
      }
      var resolved = refs.map(function(ref) { return ref ? _strictLivingChar(G, ref) : null; });
      if (resolved.some(function(ch) { return !ch; })) {
        _tmGateReason(label, 'leader/head must resolve exactly to a living active character', item);
        return { present:true, ok:false };
      }
      var first = resolved[0];
      if (resolved.some(function(ch) { return ch !== first; })) {
        _tmGateReason(label, 'conflicting leader/head mirrors', item);
        return { present:true, ok:false };
      }
      present.forEach(function(key) { delete item[key]; });
      item[outputField] = first.name || refs[0];
      return { present:true, ok:true, name:item[outputField] };
    }

    keepArray('character_deaths', 'character_deaths', function(d) {
      if (!d || !d.name) return _tmGateReason('character_deaths', 'missing name', d);
      // 死亡是不可逆语义：只接受当前 GM.chars 精确 name/id；不使用 alias/fuzzy/scenario 库外候选。
      var rawDeathName = String(d.name).trim();
      var ch = (G.chars || []).find(function(c) {
        return c && ((c.name != null && String(c.name).trim() === rawDeathName) || (c.id != null && String(c.id).trim() === rawDeathName));
      });
      if (!ch) return _tmGateReason('character_deaths', 'death target not in active roster: ' + d.name, d);
      if (ch.alive === false || ch.dead === true) return _tmGateReason('character_deaths', 'char already dead: ' + d.name, d);
      var deathReason = d.reason || d.cause || d.deathReason;
      if (!deathReason) return _tmGateReason('character_deaths', 'missing cause/reason: ' + d.name, d);
      d.name = ch.name || rawDeathName;
      if (!d.reason) d.reason = String(deathReason);
      // ── 刀C·C1(2026-07-19)·结构化死亡来源判据(裸伏诛/自缢/纯病故=bare·无源→疑史实幻觉·不落库) ──
      //   复用刀9：_classifyStructuredDeathKind 分类 bare/active·仅 gate bare 且本回合无任何源头(玩家诏令三源/司法危难态/
      //   其他结构化键互证[排 character_deaths 自证]/npc_actions 涉及·_narrativeDeathSourced)。主动致死/暴力殉难/含本局
      //   具体事由(战殁/奉旨赐死/被斩)=active·照常落。★宁漏勿误杀：非 bare 或有任一源即放行。拒写降级=转弱自查纸条+console 留痕·不静默丢弃。
      try {
        var _c1bkt = global.TM && global.TM.__acaParts;
        var _c1classify = _c1bkt && _c1bkt._classifyStructuredDeathKind;
        var _c1sourced = _c1bkt && _c1bkt._narrativeDeathSourced;
        if (_c1classify && _c1sourced && _c1classify(d.reason) === 'bare' &&
            !_c1sourced(G, aiOutput, ch, { excludeStructuredKey: 'character_deaths' })) {
          console.warn('[preflight/character_deaths] 无源孤立结构化死亡·不落库(疑 AI 史实幻觉·转弱自查纸条留痕): ' + d.name + ' ← 「' + String(d.reason).slice(0, 40) + '」');
          return _tmGateReason('character_deaths', '无源孤立结构化死亡(疑史实幻觉·bare 死因无任何源头): ' + d.name + '·死因「' + String(d.reason).slice(0, 30) + '」', d);
        }
      } catch (_c1e) {}
      return true;
    });

    keepArray('faction_create', 'faction_create', function(fc) {
      if (!fc || !fc.name) return _tmGateReason('faction_create', 'missing name', fc);
      var fcRes = _tmResolveFaction(G, fc.name);
      if (fcRes && fcRes.active) return _tmGateReason('faction_create', 'duplicate active faction: ' + fc.name, fc);
      if (fcRes && !fcRes.active) _tmPushAIWeakHint('faction_create', 'faction name seems known outside active roster: ' + fc.name, fc, fcRes);
      if (!(fc.reason || fc.triggerEvent || fc.origin || fc.parentFaction)) return _tmGateReason('faction_create', 'missing reason/trigger: ' + fc.name, fc);
      if (!canonicalLeaderFields(fc, ['leader','head','newLeader','new_leader','leaderName','leader_name','ruler'], 'leader', 'faction_create').ok) return false;
      return true;
    });

    keepArray('party_create', 'party_create', function(pc) {
      if (!pc || !pc.name) return _tmGateReason('party_create', 'missing name', pc);
      if ((G.parties || []).some(function(p) { return p && p.name === pc.name; })) return _tmGateReason('party_create', 'duplicate active party: ' + pc.name, pc);
      if (!canonicalLeaderFields(pc, ['leader','head','newLeader','new_leader','leaderName','leader_name','ruler'], 'leader', 'party_create').ok) return false;
      return true;
    });

    keepArray('party_splinter', 'party_splinter', function(sp) {
      if (!sp || !sp.parent || !sp.newName) return _tmGateReason('party_splinter', 'missing parent/newName', sp);
      if (!(G.parties || []).some(function(p) { return p && p.name === sp.parent; })) return _tmGateReason('party_splinter', 'parent party not active: ' + sp.parent, sp);
      if (!canonicalLeaderFields(sp, ['newLeader','new_leader','leader','head','leaderName','leader_name','ruler'], 'newLeader', 'party_splinter').ok) return false;
      return true;
    });

    (Array.isArray(aiOutput.faction_events) ? aiOutput.faction_events : []).forEach(function(fe) {
      var gate = canonicalLeaderFields(fe, ['newLeader','new_leader','leader','head','leaderName','leader_name','ruler'], 'newLeader', 'faction_events');
      if (gate.present && !gate.ok) blocked++;
    });
    (Array.isArray(aiOutput.party_changes) ? aiOutput.party_changes : []).forEach(function(pc) {
      var gate = canonicalLeaderFields(pc, ['new_leader','newLeader','leader','head','leaderName','leader_name','ruler'], 'new_leader', 'party_changes');
      if (gate.present && !gate.ok) blocked++;
    });
    (Array.isArray(aiOutput.party_updates) ? aiOutput.party_updates : []).forEach(function(pu) {
      if (!pu || !pu.updates || typeof pu.updates !== 'object' || Array.isArray(pu.updates)) return;
      var gate = canonicalLeaderFields(pu.updates, ['leader','head','newLeader','new_leader','leaderName','leader_name','ruler'], 'leader', 'party_updates');
      if (gate.present && !gate.ok) blocked++;
    });

    keepArray('faction_succession', 'faction_succession', function(sc) {
      if (!sc || !sc.faction || !sc.newLeader) return _tmGateReason('faction_succession', 'missing faction/newLeader', sc);
      // 继统会在 endturn 主链直接改 leader，必须像死亡一样只接受当前活跃对象的精确 name/id；
      // 不让模糊名、场景库幽灵人物或已死亡人物穿过后续直写 consumer。
      var rawFaction = String(sc.faction).trim();
      var fac = (G.facs || []).find(function(f) {
        return f && ((f.name != null && String(f.name).trim() === rawFaction) || (f.id != null && String(f.id).trim() === rawFaction));
      });
      if (!fac) return _tmGateReason('faction_succession', 'faction not in active roster: ' + sc.faction, sc);
      var rawLeader = String(sc.newLeader).trim();
      var leader = (G.chars || []).find(function(c) {
        return c && ((c.name != null && String(c.name).trim() === rawLeader) || (c.id != null && String(c.id).trim() === rawLeader));
      });
      if (!leader) return _tmGateReason('faction_succession', 'newLeader not in active roster: ' + sc.newLeader, sc);
      if (leader.alive === false || leader.dead === true) return _tmGateReason('faction_succession', 'newLeader is dead: ' + sc.newLeader, sc);
      // sc 是 AI 的继统事件载荷，不是人物/军队成员关系对象；这里只归一化引用，
      // 不触碰任何运行态 entity.faction（后者必须走 FactionMembership API）。
      Object.assign(sc, { faction: fac.name || rawFaction });
      sc.newLeader = leader.name || rawLeader;
      return true;
    });

    keepArray('faction_dissolve', 'faction_dissolve', function(fd) {
      if (!fd || !fd.name) return _tmGateReason('faction_dissolve', 'missing name', fd);
      var facRes = _tmResolveFaction(G, fd.name);
      if (!facRes) return _tmWeakEntityHint('faction_dissolve', 'faction seems not in current known lists: ' + fd.name, fd, facRes);
      var fac = facRes.entity;
      if (!facRes.active) _tmPushAIWeakHint('faction_dissolve', 'faction seems known but not active: ' + fd.name, fd, facRes);
      if (fac.isPlayer) return _tmGateReason('faction_dissolve', 'player faction cannot dissolve: ' + fd.name, fd);
      if (!(fd.cause || fd.reason)) return _tmGateReason('faction_dissolve', 'missing cause/reason: ' + fd.name, fd);
      if ((fd.cause === 'conquered' || fd.cause === 'absorbed') && fd.conqueror) {
        var conquerorRes = _tmResolveFaction(G, fd.conqueror);
        if (!conquerorRes) return _tmWeakEntityHint('faction_dissolve', 'conqueror seems not in current known lists: ' + fd.conqueror, fd, conquerorRes);
        if (!conquerorRes.active) _tmPushAIWeakHint('faction_dissolve', 'conqueror seems known but not active: ' + fd.conqueror, fd, conquerorRes);
      }
      return true;
    });

    keepArray('office_assignments', 'office_assignments', function(oa) {
      if (!oa || !oa.name) return _tmGateReason('office_assignments', 'missing name', oa);
      var oaRes = _tmResolveChar(G, oa.name);
      if (!oaRes) return _tmWeakEntityHint('office_assignments', 'char seems not in current known lists: ' + oa.name, oa, oaRes);
      if (!oaRes.active) _tmPushAIWeakHint('office_assignments', 'char seems known but not active roster: ' + oa.name, oa, oaRes);
      var action = String(oa.action || 'appoint').toLowerCase();
      if (/兼/.test(String(oa.action || ''))) action = 'appoint';
      if (action === 'concurrent') action = 'appoint';
      if ((action === 'appoint' || action === 'transfer') && !oa.post) return _tmGateReason('office_assignments', 'missing post: ' + oa.name, oa);
      return true;
    });

    keepArray('fiscal_adjustments', 'fiscal_adjustments', function(fa) {
      if (!fa || !fa.target || !fa.kind) return _tmGateReason('fiscal_adjustments', 'missing target/kind', fa);
      // ★ 落库契约硬化刀②(2026-07-16·居平内帑案悬案)：闸前先做中文→canonical 归一·归一后再过白名单。
      //   此前白名单只认英文 guoku/neitang/province:/income/expense·AI 写中文别名(内帑/国库/太仓/收入/支出…)
      //   的 fiscal 条目在 preflight 即被剔·而下游 applier(fiscal_adjustments 容差归一段)本能吃这些别名
      //   (2026-06-02 bug A 修)——preflight 比消费端更严=好账被冤杀。此处归一「仅供闸判定」·不 mutate fa
      //   (留存条目由 applier 再归一)。真垃圾 target/kind 归一落空照剔。别名表镜像见上方 _faNormTargetForGate 注释。
      var _gateKind = _faNormKindForGate(fa.kind);
      if (_gateKind !== 'income' && _gateKind !== 'expense') return _tmGateReason('fiscal_adjustments', 'invalid kind: ' + fa.kind, fa);
      var fiscalAction = String(fa.action || fa.op || 'add').toLowerCase();
      if (fiscalAction === 'modify' || fiscalAction === 'set') fiscalAction = 'update';
      if (fiscalAction === 'delete' || fiscalAction === 'disable' || fiscalAction === 'cancel') fiscalAction = 'stop';
      if (fiscalAction !== 'stop' && fiscalAction !== 'remove' && !(parseFloat(fa.amount) > 0)) return _tmGateReason('fiscal_adjustments', 'invalid amount', fa);
      if (!_faNormTargetForGate(fa.target)) {
        return _tmGateReason('fiscal_adjustments', 'invalid target: ' + fa.target, fa);
      }
      return true;
    });

    if (aiOutput.battleResult) {
      var br = aiOutput.battleResult;
      if (!br.winnerFactionId || !br.loserFactionId) {
        _tmGateReason('battleResult', 'missing winnerFactionId/loserFactionId', br);
        delete aiOutput.battleResult;
        blocked++;
      }
    }

    if (blocked > 0) {
      try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_gate_summary', { blocked: blocked, source: opts.source || '' }); } catch(_) {}
    }
    return aiOutput;
  }
  global.preflightAIWriteBack = preflightAIWriteBack;

  function _applyBattleResult(G, aiOutput, applied) {
    if (!G || !aiOutput || !aiOutput.battleResult) return;
    var api = global.MilitarySystems || (global.TM && global.TM.MilitarySystems);
    if (!api || typeof api.applyBattleResult !== 'function') {
      if (applied && applied.failed) applied.failed.push({ battleResult: true, reason: 'MilitarySystems missing' });
      return;
    }
    var r = api.applyBattleResult(aiOutput.battleResult, G);
    if (r && r.ok) {
      if (applied) {
        if (!applied.semantic) applied.semantic = {};
        applied.semantic.battleResult = 1;
      }
      if (!G._turnReport) G._turnReport = [];
      G._turnReport.push({
        type: 'battleResult',
        battleId: r.result && r.result.battleId,
        winner: r.result && r.result.winner,
        loser: r.result && r.result.loser,
        turn: G.turn || 0
      });

      // 标记败方主帅(幸存败将)·供 NPC 战败涟漪反应(_npcDefeatRipple)。阵亡者 alive=false·走死亡涟漪不在此标。
      try {
        var _cfBR = aiOutput.battleResult.commanderFate;
        if (_cfBR && _cfBR.name && /败|挫|溃|defeat|rout|擒|俘|captur|surrender|降|逃|escap|伤|wound/i.test(String(_cfBR.outcome || ''))) {
          var _cfChBR = (G.chars || []).find(function(c){ return c && c.name === _cfBR.name; });
          if (_cfChBR && _cfChBR.alive !== false) { _cfChBR._defeatTurn = G.turn || 0; _cfChBR._defeatReason = String(_cfBR.outcome || '战败'); }
        }
      } catch (_dfBR) {}

      // P-5TK 第二刀：玩家方军胜 → 皇威加分（病根②：军功此前几乎不接皇威，金州/喜峰口胜仗皇威累计≈0）
      // 确定性管「赢了必加 + 护栏 + 保守保底（防面板纹丝不动）」；量优先 AI(battleResult.huangweiDelta)，AI 没吐才走保底
      try {
        var _AE5TK = global.AuthorityEngines || (global.TM && global.TM.AuthorityEngines);
        if (_AE5TK && typeof _AE5TK.adjustHuangwei === 'function') {
          var _winId5TK = String(aiOutput.battleResult.winnerFactionId || aiOutput.battleResult.winnerFaction || aiOutput.battleResult.winner || (r.result && r.result.winner) || '').trim();
          // 宁漏不误：在 G.facs 按 name/id 找到 winner 对应势力、确认 isPlayer 才加；拿不准就不加（绝不给敌胜误涨皇威）
          var _winFac5TK = _winId5TK ? (G.facs || []).find(function(f){ return f && (f.name === _winId5TK || f.id === _winId5TK); }) : null;
          var _P5TK = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
          var _pName5TK = (_P5TK && _P5TK.playerInfo && _P5TK.playerInfo.factionName) || '';
          var _isPlayerWin5TK = !!(_winFac5TK && _winFac5TK.isPlayer) || (!!_pName5TK && _winId5TK === _pName5TK);
          if (_isPlayerWin5TK) {
            var P5TK_HW_WIN_BASE = 2;   // 军胜皇威保底加分（AI 未吐量时兜底·可调）
            var P5TK_HW_WIN_CAP = 8;    // 单场皇威加分护栏上限（防 AI 吐爆表·可调）
            var _aiHw5TK = Number(aiOutput.battleResult.huangweiDelta);
            var _hwGain5TK = (isFinite(_aiHw5TK) && _aiHw5TK > 0) ? Math.min(_aiHw5TK, P5TK_HW_WIN_CAP) : P5TK_HW_WIN_BASE;
            if (_hwGain5TK > 0) {
              var _hwR5TK = _AE5TK.adjustHuangwei('militaryVictory', _hwGain5TK, '玩家方军胜·' + _winId5TK + '（P-5TK 军功接皇威）');
              if (applied) {
                if (!applied.semantic) applied.semantic = {};
                applied.semantic.huangweiMilitaryVictory = (_hwR5TK && _hwR5TK.delta) || _hwGain5TK;
              }
            }
          }
        }
      } catch (_e5TK) {}
    } else if (applied && applied.failed) {
      applied.failed.push({ battleResult: true, reason: r && r.reason });
    }
  }
  global._applyBattleResult = _applyBattleResult;

  // 赤字深度等级：返回 tier 对应的惩罚倍率（越深越重）
  function _deficitTier(amount, scaleMoney) {
    var deep = Math.abs(amount);
    var pct = deep / Math.max(1, scaleMoney);
    if (pct < 0.1) return { tier: 1, label: '微亏', mult: 1 };       // <10%
    if (pct < 0.3) return { tier: 2, label: '告急', mult: 2 };        // 10-30%
    if (pct < 0.8) return { tier: 3, label: '空虚', mult: 4 };        // 30-80%
    if (pct < 2) return { tier: 4, label: '债台高筑', mult: 7 };      // 80-200%
    return { tier: 5, label: '民穷财尽', mult: 12 };                   // >200%
  }

  function _applyFiscalDeficitPenalties(G) {
    if (!G) return;
    var pens = [];
    // 规模参考：用岁入作 baseline（无则 fallback）
    var monthIn = (G.guoku && (G.guoku.monthlyIncome || G.guoku.turnIncome)) || 100000;
    var scaleMoney = Math.max(100000, monthIn * 12);   // 年入作比例基准
    var scaleGrain = Math.max(50000, (G.guoku && G.guoku.monthlyGrainIncome || 10000) * 12);
    var scaleCloth = Math.max(20000, (G.guoku && G.guoku.monthlyClothIncome || 5000) * 12);

    function checkTreasury(targetName, targetObj) {
      if (!targetObj) return;
      var checks = [
        { res:'money', scale:scaleMoney, label:'银' },
        { res:'grain', scale:scaleGrain, label:'粮' },
        { res:'cloth', scale:scaleCloth, label:'布' }
      ];
      checks.forEach(function(ck){
        var v = Number(targetObj[ck.res]);
        if (typeof v !== 'number' || isNaN(v) || v >= 0) return;
        var t = _deficitTier(v, ck.scale);
        pens.push({ target: targetName, resource: ck.res, label: ck.label, tier: t.tier, tierLabel: t.label, amount: v, mult: t.mult });
      });
    }
    checkTreasury('guoku', G.guoku);
    checkTreasury('neitang', G.neitang);
    if (pens.length === 0) return;

    // 汇总倍率（多项赤字累加·累加封顶 ×3）
    var totalMult = 0;
    pens.forEach(function(p){ totalMult += p.mult; });
    totalMult = Math.min(totalMult, 36);

    // 应用到各系统
    // 1) 皇威（真实值）
    if (!G._huangweiState) G._huangweiState = { index: 70 };
    var hwPenalty = Math.round(totalMult * 0.25);  // tier1:-0.25~ tier5:-3
    G._huangweiState.index = Math.max(0, (Number(G._huangweiState.index)||70) - hwPenalty);
    // 2) 民心
    if (!G._minxinState) G._minxinState = { index: 60 };
    var mxPenalty = Math.round(totalMult * 0.3);
    G._minxinState.index = Math.max(0, (Number(G._minxinState.index)||60) - mxPenalty);
    // 3) 动乱
    G.unrest = Math.min(100, (Number(G.unrest)||0) + Math.round(totalMult * 0.4));
    // 4) 吏治 (corruption 上升·越穷越腐)
    if (G._corruptionState) {
      G._corruptionState.index = Math.min(100, (Number(G._corruptionState.index)||0) + Math.round(totalMult * 0.15));
    }
    // 5) 军心（NPC 将领忠诚 -1~-3）—— 仅 tier3+ 才影响武将
    if (pens.some(function(p){return p.tier >= 3;}) && Array.isArray(G.chars)) {
      G.chars.forEach(function(c){
        if (!c || c.alive === false) return;
        var isMilitary = (c.military||0) > 60 || /\u519B|\u5C06|\u5E05|\u53F2/.test(c.officialTitle||'');
        if (isMilitary && typeof c.loyalty === 'number') {
          if (typeof global.adjustCharacterLoyalty === 'function') {
            global.adjustCharacterLoyalty(c, -Math.round(totalMult * 0.08), '\u56FD\u7528\u7A98\u8FEB\u5BFC\u81F4\u519B\u5FC3\u52A8\u6447', { source:'resource-deficit-military-loyalty', oncePerTurn:true });
          } else {
            c.loyalty = Math.max(0, c.loyalty - Math.round(totalMult * 0.08));
          }
        }
      });
    }
    // 6) 粮亏独立加成：饥荒事件概率 + 人口逃散
    var grainDef = pens.find(function(p){return p.resource==='grain' && p.tier>=2;});
    if (grainDef && G.population && G.population.national) {
      var fugitives = Math.round((G.population.national.mouths||0) * 0.002 * grainDef.mult);
      G.population.fugitives = (Number(G.population.fugitives)||0) + fugitives;
      G.population.national.mouths = Math.max(0, (G.population.national.mouths||0) - fugitives);
    }
    // 登记事件
    if (!G._turnReport) G._turnReport = [];
    G._turnReport.push({
      type: 'fiscal_deficit',
      penalties: pens,
      totalMult: totalMult,
      appliedTo: { huangwei: -hwPenalty, minxin: -mxPenalty, unrest: Math.round(totalMult*0.4), corruption: Math.round(totalMult*0.15) },
      turn: G.turn || 0
    });
    // 累计告警（连续赤字计数）
    if (!G._fiscalDeficitStreak) G._fiscalDeficitStreak = 0;
    G._fiscalDeficitStreak++;
    if (G._fiscalDeficitStreak >= 3) {
      // 持续 3+ 回合赤字：弹窗+重大告警
      if (typeof global.addEB === 'function') global.addEB('\u8D22\u653F\u2757\u2757', '\u8D4C\u7A7A\u7EE7\u7EED ' + G._fiscalDeficitStreak + ' \u56DE\u5408\uFF01\u7687\u5A01 -' + hwPenalty + ' \u6C11\u5FC3 -' + mxPenalty + ' \u52A8\u4E71+' + Math.round(totalMult*0.4));
    } else {
      if (typeof global.addEB === 'function') global.addEB('\u8D22\u653F\u2757', '\u56FD\u5EAA\u8D64\u5B57\uFF01' + pens.map(function(p){return p.label+p.tierLabel;}).join('\u3001') + ' \u2192 \u7687\u5A01-' + hwPenalty + ' \u6C11\u5FC3-' + mxPenalty);
    }
  }
  // 若连续两回合均未赤字·streak 归零（入口：某处定期重置）
  function _resetDeficitStreakIfHealthy(G) {
    if (!G) return;
    var anyDef = false;
    ['money','grain','cloth'].forEach(function(r){
      if (G.guoku && (Number(G.guoku[r])||0) < 0) anyDef = true;
      if (G.neitang && (Number(G.neitang[r])||0) < 0) anyDef = true;
    });
    if (!anyDef) G._fiscalDeficitStreak = 0;
  }
  global._applyFiscalDeficitPenalties = _applyFiscalDeficitPenalties;
  global._resetDeficitStreakIfHealthy = _resetDeficitStreakIfHealthy;
  // AI writeback validation and rollback transaction (split from the origin to keep the runtime shard bounded).
  var _AI_VALIDATOR_LOG_KEYS = [
    '_fiscalValidatorLog','_personnelValidatorLog','_militaryValidatorLog','_sentimentValidatorLog',
    '_populationValidatorLog','_officeValidatorLog','_warValidatorLog','_revoltValidatorLog',
    '_disasterValidatorLog','_diplomacyValidatorLog','_kejuValidatorLog','_partyValidatorLog',
    '_edictEffectValidatorLog','_courtCeremonyValidatorLog','_constructionValidatorLog','_omenValidatorLog',
    '_marriageBirthValidatorLog','_conspiracyValidatorLog','_currencyValidatorLog','_religionValidatorLog'
  ];

  function _captureValidatorBaseline(G) {
    var out = {};
    _AI_VALIDATOR_LOG_KEYS.forEach(function(key) { out[key] = Array.isArray(G && G[key]) ? G[key].length : 0; });
    return out;
  }

  function _collectValidatorFailures(G, baseline) {
    var failures = [];
    _AI_VALIDATOR_LOG_KEYS.forEach(function(key) {
      var rows = Array.isArray(G && G[key]) ? G[key].slice(baseline[key] || 0) : [];
      rows.forEach(function(row) {
        if (!row || Number(row.turn || 0) !== Number((G && G.turn) || 0)) return;
        var details = [];
        ['warnings','missing','skipped','errors'].forEach(function(field) {
          if (Array.isArray(row[field]) && row[field].length) details = details.concat(row[field]);
        });
        if (details.length) failures.push({ validator: key, reason: 'consistency validation failed', details: details.slice(0, 8) });
      });
    });
    return failures;
  }

  function _runConsistencyValidator(applied, aiOutput, name, fn) {
    try {
      fn();
      return true;
    } catch (error) {
      var message = String(error && (error.message || error) || 'validator exception');
      if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(error, 'applier] ' + name + ' validator:');
      else console.warn('[applier] ' + name + ' validator:', error);
      if (aiOutput && aiOutput._strictValidation === true) {
        if (!Array.isArray(applied.failed)) applied.failed = [];
        applied.failed.push({ validator: name, reason: 'validator exception', details: [message] });
      }
      return false;
    }
  }
  function _refreshAIIndices(G, P0) {
    try {
      if (typeof global.buildIndices === 'function') global.buildIndices();
      else if (global.TM && global.TM.Indices && typeof global.TM.Indices.invalidate === 'function') global.TM.Indices.invalidate(G, P0);
    } catch (_) {
      try { if (global.TM && global.TM.Indices && typeof global.TM.Indices.invalidate === 'function') global.TM.Indices.invalidate(G, P0); } catch (_) {}
    }
  }

  function _captureAIStateObject(obj, runtimeKeys) {
    var data = (typeof global.deepClone === 'function') ? global.deepClone(obj) : JSON.parse(JSON.stringify(obj));
    var descriptors = {};
    Object.getOwnPropertyNames(obj || {}).forEach(function(key) {
      var d = Object.getOwnPropertyDescriptor(obj, key);
      if (!d) return;
      // _indices is a derived Map cache, never transaction state. Restoring its
      // descriptor can resurrect stale object references (or JSON-cloned {}).
      if (key === '_indices') { try { delete data[key]; } catch (_) {} return; }
      if ((runtimeKeys && runtimeKeys.indexOf(key) >= 0) || d.get || d.set ||
          (Object.prototype.hasOwnProperty.call(d, 'value') && typeof d.value === 'function') ||
          !Object.prototype.hasOwnProperty.call(data, key)) {
        descriptors[key] = d;
        try { delete data[key]; } catch (_) {}
      }
    });
    return { data: data, descriptors: descriptors };
  }

  function _restoreAIStateObject(target, snapshot) {
    Object.getOwnPropertyNames(target || {}).forEach(function(key) { try { delete target[key]; } catch (_) {} });
    Object.keys(snapshot.data || {}).forEach(function(key) { target[key] = snapshot.data[key]; });
    Object.keys(snapshot.descriptors || {}).forEach(function(key) {
      try { Object.defineProperty(target, key, snapshot.descriptors[key]); }
      catch (_) { if (Object.prototype.hasOwnProperty.call(snapshot.descriptors[key], 'value')) target[key] = snapshot.descriptors[key].value; }
    });
  }

  function _validateAIResultState(G) {
    var failures = [];
    if (!G || typeof G !== 'object' || Array.isArray(G)) failures.push({ reason: 'GM must remain an object' });
    ['chars','facs','armies'].forEach(function(key) {
      if (G && Object.prototype.hasOwnProperty.call(G, key) && !Array.isArray(G[key])) failures.push({ path: key, reason: key + ' must remain an array' });
    });
    ['guoku','neitang'].forEach(function(key) {
      var box = G && G[key];
      if (!box) return;
      ['money','grain','cloth'].forEach(function(res) {
        if (Object.prototype.hasOwnProperty.call(box, res) && (typeof box[res] !== 'number' || !isFinite(box[res]))) {
          failures.push({ path: key + '.' + res, reason: 'fiscal scalar must be finite' });
        }
      });
    });
    return failures;
  }

  /**
   * AI 写回原子边界：所有 handler 只在可回滚草稿窗口内执行；任一显式失败、
   * validator 命中或全局形状破坏都恢复 GM/P 原状并返回 ok:false。
   */
  function applyAITurnChangesAtomic(aiOutput) {
    var G = global.GM;
    var P0 = global.P;
    if (!G || !aiOutput || typeof aiOutput !== 'object') return { ok: false, applied: { failed: [{ reason: 'invalid GM/AI output' }] } };
    var gSnapshot, pSnapshot;
    try {
      gSnapshot = _captureAIStateObject(G, ['_postTurnJobs', '_postTurnDetachedJobs', '_indices']);
      if (P0 && typeof P0 === 'object') pSnapshot = _captureAIStateObject(P0, ['scenario', '_indices']);
      var result = _applyAITurnChangesUnsafe(aiOutput);
      result = result && typeof result === 'object' ? result : { ok: false, applied: { failed: [{ reason: 'applier returned no result' }] } };
      result.applied = result.applied || { failed: [] };
      result.applied.failed = Array.isArray(result.applied.failed) ? result.applied.failed : [];
      var stateFailures = _validateAIResultState(G);
      if (stateFailures.length) Array.prototype.push.apply(result.applied.failed, stateFailures);
      if (result.ok !== true || result.applied.failed.length) {
        _restoreAIStateObject(G, gSnapshot);
        if (P0 && pSnapshot) _restoreAIStateObject(P0, pSnapshot);
        _refreshAIIndices(G, P0);
        return { ok: false, applied: result.applied, rolledBack: true, error: 'AI writeback transaction rejected' };
      }
      return result;
    } catch (e) {
      try { if (gSnapshot) _restoreAIStateObject(G, gSnapshot); } catch (_) {}
      try { if (P0 && pSnapshot) _restoreAIStateObject(P0, pSnapshot); } catch (_) {}
      _refreshAIIndices(G, P0);
      return { ok: false, applied: { failed: [{ reason: String(e && (e.message || e) || 'AI writeback exception') }] }, rolledBack: true, error: e };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  财政三字段同步守卫·确保 GM.guoku/neitang 的 money/balance/ledgers.stock 三字段一致
  //  策略：以 ledgers.stock 为权威源（applier 内 fiscal_adjustments 同时更新它和 .money）·向后写 .money 和 .balance
  //  若 ledger 不存在则以 .money 为准·补全 .balance
  // ═══════════════════════════════════════════════════════════════════
  function _syncFiscalScalars(G) {
    if (!G) return;
    ['guoku', 'neitang'].forEach(function(target) {
      var t = G[target];
      if (!t) return;
      ['money','grain','cloth'].forEach(function(res) {
        var ledStock = (t.ledgers && t.ledgers[res] && typeof t.ledgers[res].stock === 'number') ? t.ledgers[res].stock : null;
        var scalar = (typeof t[res] === 'number') ? t[res] : null;
        // 取权威值：ledger 优先·否则 scalar·否则 0
        var canon = (ledStock != null) ? ledStock : (scalar != null ? scalar : 0);
        // 写回三处
        t[res] = canon;
        if (t.ledgers && t.ledgers[res]) t.ledgers[res].stock = canon;
        if (res === 'money') t.balance = canon;  // balance 仅对 money 有意义
      });
      // 若有 ledger 但 .money 与 stock 之前就不一致·留一条警告
      if (t.ledgers && t.ledgers.money && typeof t.ledgers.money.stock === 'number' && typeof t.money === 'number') {
        // 此时已对齐·不再需要警告
      }
    });
  }
  // 暴露给 window·让 endTurn / renderGameState 可调用兜底
  if (typeof window !== 'undefined') window._syncFiscalScalars = _syncFiscalScalars;
  //>>ACA-SPLIT22-RECONCILE-BODY-END
  // ── forward 回填：本片复核/善后族 → bucket（origin 委托 shim 调用期解析）──
  __acaP._processDeathEpitaphs = _processDeathEpitaphs; __acaP._reconcilePlayerMovements = _reconcilePlayerMovements; __acaP._reconcilePlayerFiscalReforms = _reconcilePlayerFiscalReforms; __acaP._applyOfficeDutyTick = _applyOfficeDutyTick; __acaP._applyTaxAuthorityGate = _applyTaxAuthorityGate; __acaP._applyDirectiveCompliance = _applyDirectiveCompliance;
  __acaP._applyRegentDecisions = _applyRegentDecisions; __acaP.preflightAIWriteBack = preflightAIWriteBack; __acaP._applyBattleResult = _applyBattleResult; __acaP._applyFiscalDeficitPenalties = _applyFiscalDeficitPenalties; __acaP._hasInstantArrivalRule = _hasInstantArrivalRule;
  __acaP._captureValidatorBaseline = _captureValidatorBaseline; __acaP._collectValidatorFailures = _collectValidatorFailures; __acaP._runConsistencyValidator = _runConsistencyValidator;
  __acaP.applyAITurnChangesAtomic = applyAITurnChangesAtomic; __acaP._syncFiscalScalars = _syncFiscalScalars;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
