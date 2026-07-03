// @ts-check
// ============================================================
// tm-endturn-agent-depth-tools.js — 模式 b · S10 · agent 深化工具(C 方案)
//
// 补 mode B 的「产出丰度差距」(详见 docs/agent-mode-depth-gap.md):
//   mode B 替换了整个 sc0-sc28·丢了 NPC 深度/记忆伏笔/世界快照等"活态"层。
//   C 方案=把这些深度做成 **agent 可按需调用的深化工具**·agent 想给哪个域加深就调哪个。
//
// 实现现实:followup 的 sc15/sc25/sc28… 是**深绑模块内部 helper 的匿名闭包**·无法直接抽出调用。
//   故这里**复用各 scene 的 prompt 形态 + 输出目标(写入哪些 GM 字段)**·以 agent 的本回合上下文喂入·
//   走公共网关 callAIMessages。⚠权衡:prompt 是"按 scene 重述"非"同引用"·scene 改了此处需跟改(drift)。
//   若日后要真·零 drift·则需把 followup 重构成可注入上下文的命名 runner(更大更险·留后)。
//
// 进度:S10 先落 deepen_world(复用 sc28·最自包含)立范式。后续 deepen_npcs(sc15)/recall_consolidate(sc25) 等照此扩。
// ============================================================

(function (root) {
  'use strict';
  var TM = root.TM || (root.TM = {});
  TM.Endturn = TM.Endturn || {};

  function _GM(ctx) { return (ctx && ctx.GM) || root.GM || null; }
  function _brief(v, n) { try { var s = typeof v === 'string' ? v : JSON.stringify(v); n = n || 200; return s && s.length > n ? s.slice(0, n) + '…' : String(s); } catch (e) { return String(v); } }

  // 汇总「本回合 agent 实际做了什么」作深化上下文(narrative + 改动 + 关键状态)
  function _turnDigest(gm) {
    var L = [];
    if (gm && gm._turnPlayerOps) L.push(gm._turnPlayerOps);   // 命门:深化也 ground 在玩家本回合操作上(史记/NPC/势力推演紧扣玩家所为·非泛泛)
    var rep = (gm && Array.isArray(gm._turnReport)) ? gm._turnReport : [];
    var narr = rep.filter(function (e) { return e.type === 'narrative' || e.type === 'summary'; }).map(function (e) { return e.text; }).filter(Boolean);
    if (narr.length) L.push('本回合纪事:' + narr.join(' / ').slice(0, 600));
    var log = (gm && Array.isArray(gm._agentWriteLog)) ? gm._agentWriteLog : [];
    if (log.length) L.push('本回合改动:' + log.slice(0, 20).map(function (e) { return (e.reason || e.path); }).filter(Boolean).join('；').slice(0, 500));
    // 资源态
    var res = [];
    if (gm && gm.guoku != null) res.push('国库' + _brief((gm.guoku && typeof gm.guoku === 'object') ? gm.guoku.balance : gm.guoku, 30));
    if (gm && gm.vars) { try { Object.keys(gm.vars).slice(0, 10).forEach(function (k) { var v = gm.vars[k]; res.push(k + '=' + Math.round((v && v.value != null) ? v.value : v)); }); } catch (e) {} }
    if (res.length) L.push('资源:' + res.join(' '));
    // 关键角色(变化的)
    var ch = (gm && Array.isArray(gm.chars)) ? gm.chars.filter(function (c) { return c && c.alive !== false && (c._changed || c.loyalty < 30 || c.ambition > 70 || c.stress > 40); }) : [];
    if (ch.length) L.push('关键角色:' + ch.slice(0, 12).map(function (c) { return c.name + '忠' + c.loyalty + '野' + c.ambition + (c.stress > 30 ? '压' + c.stress : ''); }).join(' '));
    return L.join('\n');
  }

  // 跨回合记忆上下文(2026-06·治"内容失忆":深化只读当前回合→生成不接前文)·供史记/NPC 续接过往、推进情节线与伏笔
  function _memoryContext(gm) {
    if (!gm) return '';
    var L = [];
    try { if (gm._sagaMemory && gm._sagaMemory.text) L.push('多回合综合脉络(贯穿主线·叙事须接此·非另起):' + _brief(gm._sagaMemory.text, 320)); } catch (e) {}
    try { var sb = gm._stateBoard; if (sb && (sb.recent_summary || sb.mood)) L.push('上回合状态:' + [sb.mood, sb.recent_summary].filter(Boolean).join('·').slice(0, 200) + ((sb.open_loops && sb.open_loops.length) ? (' 悬念:' + sb.open_loops.slice(0, 3).join('/')) : '') + ((sb.unfulfilled_promises && sb.unfulfilled_promises.length) ? (' 未兑现:' + sb.unfulfilled_promises.slice(0, 3).join('/')) : '')); } catch (e) {}
    try { var cm = gm._consolidatedMemory; if (Array.isArray(cm) && cm.length) L.push('近回合记忆:' + cm.slice(-4).map(function (m) { return '第' + m.turn + '回:' + _brief(m.summary, 80); }).join(' ')); } catch (e) {}
    try { var pt = gm._plotThreads; if (Array.isArray(pt)) { var act = pt.filter(function (t) { return t && t.status !== 'resolved'; }).slice(0, 6); if (act.length) L.push('进行中情节线(须推进·勿重造):' + act.map(function (t) { return t.title + '(' + (t.status || '') + ')'; }).join(' / ')); } } catch (e) {}
    try { var fs = gm._foreshadows; if (Array.isArray(fs) && fs.length) L.push('未回收伏笔:' + fs.slice(-5).map(function (f) { return _brief(typeof f === 'string' ? f : (f.content || ''), 50); }).filter(Boolean).join(' / ')); } catch (e) {}
    // ④ 编年·进行中长期事势(史记须呼应推进·勿当没发生)
    try { var ct = gm._chronicleTracks || gm.biannianItems; if (Array.isArray(ct)) { var actCt = ct.filter(function (t) { return t && t.status !== 'completed' && t.status !== 'aborted' && !t.hidden; }).slice(0, 8); if (actCt.length) L.push('编年·进行中长期事势:' + actCt.map(function (t) { return (t.title || '') + (t.currentStage ? '(' + t.currentStage + ')' : ''); }).join(' / ')); } } catch (e) {}
    // ④ 前几回合史记·实录(史记须续接历史·读几回合按能力档)
    try { var sj = gm.shijiHistory; if (Array.isArray(sj) && sj.length) { var Pm = root.P || {}; var md = Math.max(1, Math.round((Pm.conf && Pm.conf.agentMemoryDepth) || 6)); var recSj = sj.slice(-md); if (recSj.length) L.push('前几回合史记(续接):' + recSj.map(function (s) { return '〔第' + (s.turn != null ? s.turn : '?') + '回' + (s.szjTitle ? '·' + s.szjTitle : '') + '〕' + _brief(s.shilu || s.shiluText || s.shizhengji || s.szjSummary || '', 110); }).join(' ')); } } catch (e) {}
    if (!L.length) return '';
    return '\n\n【跨回合记忆 · 你的叙事须续接前文、推进情节线与伏笔、呼应编年长期事势(勿失忆重起炉灶)】\n' + L.join('\n');
  }

  function _parse(text) {
    try { if (typeof root.robustParseJSON === 'function') return root.robustParseJSON(text); var m = String(text || '').match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; }
  }
  // T4(审计③·Codex 韧性对照) · 关键站 JSON 自纠：parse+正则抢救双败才带错重问一次·输出上限×1.5
  //   (截断与格式错一石二鸟·不动共享网关)。只用于质量命门站(记忆固化/史记主体)——机械深析失败本就
  //   不阻断、不值得重问。失败静默返空·调用方按原失败路走。
  async function _reaskJSON(gm, msgs, maxTok, tier) {
    if (typeof root.callAIMessages !== 'function') return '';
    try {
      var sys0 = (msgs[0] && msgs[0].role === 'system') ? String(msgs[0].content || '') : '';
      var rest = (msgs[0] && msgs[0].role === 'system') ? msgs.slice(1) : msgs;
      var sys2 = sys0 + '\n\n⚠ 你上次的输出无法解析为合法 JSON（可能被截断或夹带说明文字）。这次只返回完整合法的 JSON 本体：不要 markdown 围栏、不要 JSON 之外的任何文字、字符串内换行用 \\n 转义、确保末尾闭合。';
      if (gm) gm._agentJsonReasks = (gm._agentJsonReasks || 0) + 1;
      var raw = await root.callAIMessages([{ role: 'system', content: sys2 }].concat(rest), Math.round(maxTok * 1.5), null, tier);
      return (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    } catch (e) { return ''; }
  }

  // ── deepen_world:复用 sc28·世界态势快照(写 _aiMemory snapshot + _foreshadows seeds + _lastSc28Snapshot 跨回合锚) ──
  async function _deepenWorld(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载·无法深化)' };
    var turn = gm.turn || 0;
    var tp = '本回合结束后的世界完整状态:\n' + _turnDigest(gm)
      + '\n\n请生成一份极高密度的世界状态快照·供下回合 AI 作记忆起点。只返回 JSON:\n'
      + '{"world_snapshot":"当前世界完整状态压缩——含所有关键变化、人物状态、势力格局、经济军事、社会矛盾(≤400字)","next_turn_seeds":"下回合应发展的种子——哪些事正在酝酿、哪些人即将行动(≤200字)","tension_level":"当前紧张度(1-10)及原因(≤50字)"}';
    var sys = '你是天命的世界态势史官。基于本回合实际发生的变化·凝练一份客观、信息密集的世界快照与下回合伏笔种子。只返回 JSON·不要解释。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1600, null, 'secondary'); }
    catch (e) { return { ok: false, text: '(世界快照调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text);
    if (!p || !p.world_snapshot) return { ok: false, text: '(世界快照解析失败/空)' };
    // 写入·复用 sc28 的输出目标(下回合 sc1 prep 读 _lastSc28Snapshot·mode A/B 连续)
    if (!Array.isArray(gm._aiMemory)) gm._aiMemory = [];
    gm._aiMemory.push({ turn: turn, content: p.world_snapshot, type: 'snapshot', priority: 'high' });
    if (p.next_turn_seeds) { if (!Array.isArray(gm._foreshadows)) gm._foreshadows = []; gm._foreshadows.push({ turn: turn, content: '【下回合种子】' + p.next_turn_seeds, priority: 'high' }); }
    gm._lastSc28Snapshot = { turn: turn, world_snapshot: p.world_snapshot || '', next_turn_seeds: p.next_turn_seeds || '', tension_level: p.tension_level || '', _agent: true };
    if (Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: '记忆·世界快照', reason: '生成世界态势记忆锚(tension ' + (p.tension_level || '?') + ')', new: _brief(p.world_snapshot, 60), turn: turn, _agent: true, _op: 'deepen_world' });
    return { ok: true, text: '已生成世界快照(tension ' + (p.tension_level || '?') + ')·入记忆锚供下回合' };
  }

  // ── deepen_npcs:复用 sc15·NPC 深度(心绪/压力/暗筹真落 GM.chars 的 _mood/stress/_scars——sc15 本就读这些·闭环) ──
  function _npcSalience(c) { var s = 0; if (c._changed) s += 3; if ((c.loyalty || 50) < 30) s += 2; if ((c.ambition || 50) > 70) s += 2; if ((c.stress || 0) > 40) s += 1; if (c.isPlayer) s -= 5; return s; }
  function _selectNpcs(gm, focus) {
    var arr = (gm && Array.isArray(gm.chars)) ? gm.chars.filter(function (c) { return c && c.alive !== false && c.name; }) : [];
    if (focus && focus.length) { var set = {}; focus.forEach(function (n) { set[String(n)] = 1; }); var f = arr.filter(function (c) { return set[c.name]; }); if (f.length) return f.slice(0, 12); }
    arr.sort(function (a, b) { return _npcSalience(b) - _npcSalience(a); });
    return arr.slice(0, 8);
  }
  async function _deepenNpcs(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载·无法深化)' };
    var npcs = _selectNpcs(gm, input && input.focus);
    if (!npcs.length) return { ok: false, text: '(无可深化的存活角色)' };
    var turn = gm.turn || 0;
    var roster = npcs.map(function (c) { return '· ' + c.name + (c.title ? ('/' + c.title) : '') + (c.faction ? (' 势:' + c.faction) : '') + ' 忠' + (c.loyalty || 50) + ' 野' + (c.ambition || 50) + (c.stress ? (' 压' + c.stress) : '') + (c._mood ? (' 情:' + c._mood) : '') + (c.personalGoal ? (' 求:' + String(c.personalGoal).slice(0, 20)) : ''); }).join('\n');
    var tp = '本回合发生:\n' + _turnDigest(gm) + '\n\n以下重点人物·请据本回合之事推演各自的内心反应:\n' + roster
      + '\n\n为每人给出:据本回合实际发生·此人此刻的心绪与暗筹(贴合其忠/野/性格/处境·勿套话)。'
      + '\n⚠【一致性·防人格分裂】若此人在上方【本回合玩家操作】的问对/朝议/书信中已有言行,其内心与暗筹**须与那些言行一致**:问对中慷慨陈词者,内心不应莫名冷淡;朝议中力主某策者,暗筹不应反对该策——除非此人正是表里不一(那也须在 hidden_intent 点明"口是心非·实则…",而非无故矛盾)。'
      + '\n只返回 JSON:\n'
      + '{"npcs":[{"name":"","mood":"一词情绪(如 忧惧/愤懑/窃喜/隐忍)","stress_delta":-20到20整数,"inner":"一句内心独白(≤40字)","hidden_intent":"暗中打算·无则空(≤30字)"}]}';
    var sys = '你是天命的人物内心史官。基于本回合实际发生的事(含玩家与各人的问对/朝议/书信)·推演重点人物的真实内心与暗筹·须贴合各自忠诚/野心/性格/处境·**且与其本回合已有言行一致(勿人格分裂)**·不要套话。只返回 JSON·不要解释。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1800, null, 'secondary'); }
    catch (e) { return { ok: false, text: '(NPC深化调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text);
    var list = (p && Array.isArray(p.npcs)) ? p.npcs : null;
    if (!list || !list.length) return { ok: false, text: '(NPC深化解析失败/空)' };
    var applied = 0;
    list.forEach(function (n) {
      if (!n || !n.name) return;
      var c = (gm.chars || []).filter(function (x) { return x && x.name === n.name && x.alive !== false; })[0];
      if (!c) return;
      if (n.mood) c._mood = String(n.mood).slice(0, 8);
      var sd = Number(n.stress_delta);
      if (!isNaN(sd) && isFinite(sd)) c.stress = Math.max(0, Math.min(100, (c.stress || 0) + Math.max(-20, Math.min(20, sd))));
      if (n.inner || n.hidden_intent) {
        if (!Array.isArray(c._scars)) c._scars = [];
        var ev = (n.hidden_intent ? ('【暗筹】' + n.hidden_intent + ' ') : '') + (n.inner || '');
        c._scars.push({ event: ev.slice(0, 60), emotion: n.mood || '', turn: turn, _agent: true });
        if (c._scars.length > 12) c._scars = c._scars.slice(-12);
        // 同步写 canonical _memory(决策核心消费字段)·非只 _scars(刻骨铭心层)·与系统事件(考课/阴谋/科举)同源·让本回合推演的人物记忆进入下回合决策可读的记忆
        try {
          if (root.NpcMemorySystem && typeof root.NpcMemorySystem.remember === 'function') {
            var _imp = Math.max(3, Math.min(9, 4 + Math.round(Math.abs(sd || 0) / 5)));
            root.NpcMemorySystem.remember(c.name, (n.inner || ev).slice(0, 60), n.mood || '', _imp, '', { _agent: true, turn: turn, category: 'inner' });
          }
        } catch (_) {}
      }
      c._changed = true;
      applied++;
    });
    if (applied && Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: 'NPC·内心', reason: '深化 ' + applied + ' 名人物心绪/暗筹', new: list.slice(0, 5).map(function (n) { return n.name + '(' + (n.mood || '') + ')'; }).join(' '), turn: turn, _agent: true, _op: 'deepen_npcs' });
    return { ok: applied > 0, text: applied > 0 ? ('已深化 ' + applied + ' 名人物内心(心绪/压力/暗筹落到角色)') : '(无人物被深化)' };
  }

  // ── deepen_relations:走 applyNpcInteraction(与 mode A 的 aiOutput.relations 同一入口·零漂移)·把本回合推演出的人物间关系变化真写回 char.relations ──
  //   命门:mode A 靠 applyAITurnChanges 应用 LLM 吐的 relations 数组→applyNpcInteraction;mode B 原本完全没有这条→推演里的人物恩怨落不到关系数据·下回合 NPC 决策读不到。此工具补齐(auto-suite 兜底·弱模型也覆盖)。
  async function _deepenRelations(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载·无法深化)' };
    if (typeof root.applyNpcInteraction !== 'function') return { ok: false, text: '(applyNpcInteraction 未加载·关系无法落地)' };
    var TYPES = root.NPC_INTERACTION_TYPES || {};
    // 仅人际(char-to-char)类型·剔除带 historyType 的势力/外交级(那些走 diplomatic_action)
    var charTypes = Object.keys(TYPES).filter(function (k) { return TYPES[k] && !TYPES[k].historyType; });
    if (!charTypes.length) return { ok: false, text: '(NPC_INTERACTION_TYPES 未加载·无可用关系类型)' };
    var npcs = _selectNpcs(gm, input && input.focus);
    if (npcs.length < 2) return { ok: false, text: '(可推演关系的人物不足两人)' };
    var turn = gm.turn || 0;
    var roster = npcs.map(function (c) { return '· ' + c.name + (c.title ? ('/' + c.title) : '') + (c.faction ? (' 势:' + c.faction) : ''); }).join('\n');
    var typeGuide = charTypes.map(function (k) { return k + '(' + (TYPES[k].label || '') + ')'; }).join('、');
    var label2key = {}; charTypes.forEach(function (k) { if (TYPES[k].label) label2key[TYPES[k].label] = k; });
    var tp = '本回合发生:\n' + _turnDigest(gm) + '\n\n以下重点人物·请据本回合实际发生之事·推演他们之间因本回合而起的关系变化(谁因何与谁交恶/结盟/举荐/弹劾/构陷/和解…):\n' + roster
      + '\n\n只取本回合真有其事、确有因果的关系变化·勿凭空捏造·勿把日常往来都列上。'
      + '\n可用关系类型(请用括号前的英文 type):' + typeGuide
      + '\n只返回 JSON:\n{"relations":[{"actor":"发起者姓名","target":"对象姓名","type":"英文type","reason":"因本回合何事(≤25字)"}]}';
    var sys = '你是天命的人物关系史官。据本回合实际发生·推演重点人物之间的关系变化·须有真实因果(本回合确有其事)·勿捏造。只返回 JSON·不要解释。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1400, null, 'secondary'); }
    catch (e) { return { ok: false, text: '(关系深化调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text);
    var list = (p && Array.isArray(p.relations)) ? p.relations : null;
    if (!list || !list.length) return { ok: false, text: '(关系深化解析失败/空·本回合或无显著关系变化)' };
    var names = {}; (gm.chars || []).forEach(function (c) { if (c && c.name) names[c.name] = 1; });
    var applied = 0, _done = [];
    list.forEach(function (r) {
      if (!r || !r.actor || !r.target || r.actor === r.target) return;
      var type = r.type;
      if (!TYPES[type] && label2key[type]) type = label2key[type];   // 容错:中文标签→key
      if (!TYPES[type] || TYPES[type].historyType) return;            // 非法 / 势力级 type 跳过
      if (!names[r.actor] || !names[r.target]) return;                // 须是真实存在的人物
      var ok2 = false;
      try { ok2 = root.applyNpcInteraction(r.actor, r.target, type, { description: (r.reason || '') + '·本回合推演', visibility: 'court', _agent: true }); }
      catch (e) { ok2 = false; }
      if (ok2) {
        applied++;
        _done.push(r.actor + '→' + r.target + '(' + (TYPES[type].label || type) + ')');
        if (Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'relation', actor: r.actor, target: r.target, interaction: type, reason: r.reason || '', turn: turn, _agent: true, _op: 'deepen_relations' });
      }
    });
    return { ok: applied > 0, text: applied > 0 ? ('已落地 ' + applied + ' 桩人物关系变化:' + _done.slice(0, 6).join('、') + '(写回 char.relations·下回合 NPC 决策可感)') : '(本回合无可落地的关系变化)' };
  }

  // ── recall_consolidate:复用 sc25·把本回合固化为记忆与连续性(状态盘下回合 sc1 读·情节线索跨回合续接) ──
  function _uid(gm, i) { try { if (typeof root.uid === 'function') return root.uid(); } catch (e) {} return 'pt_' + (gm.turn || 0) + '_' + i + '_' + ((gm._plotThreads && gm._plotThreads.length) || 0); }
  async function _recallConsolidate(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载·无法整合)' };
    var turn = gm.turn || 0;
    var threads = '';
    if (Array.isArray(gm._plotThreads)) {
      var active = gm._plotThreads.filter(function (t) { return t && t.status !== 'resolved'; });
      if (active.length) threads = '\n【活跃情节线索·应在 plot_updates 更新进展·勿重造】\n' + active.slice(0, 10).map(function (t) { return '· [' + t.id + '] ' + t.title + ' (' + (t.threadType || '') + ') 状态:' + t.status; }).join('\n') + '\n';
    }
    // 多回合综合(2026-06·owner"长记忆能综合多回合·超窗自动压缩·持续未决=当前"):
    //   近 memDepth 回合喂"细"·更早的靠上一版 saga(已压缩)折叠进来(超窗自动压缩·照常注入)·窗口随模型能力档。
    var _Pmd = root.P || {}; var _memDepth = Math.max(2, Math.round((_Pmd.conf && _Pmd.conf.agentMemoryDepth) || 6));
    var recentArc = '';
    try {
      var cmArc = gm._consolidatedMemory;
      if (Array.isArray(cmArc) && cmArc.length) recentArc += '\n\n【近 ' + _memDepth + ' 回合记忆(细·请综合成连贯脉络·非罗列)】\n' + cmArc.slice(-_memDepth).map(function (m) { return '第' + (m && m.turn != null ? m.turn : '?') + '回:' + _brief((m && (m.summary || m.text)) || '', 90); }).join('\n');
      if (gm._sagaMemory && gm._sagaMemory.text) recentArc += '\n\n【上一版多回合脉络(更早回合已折叠于此·在其上滚动更新·勿推倒重写·勿丢早期主线)】\n' + _brief(gm._sagaMemory.text, 400);
    } catch (e) {}
    var tp = '本回合摘要:\n' + _turnDigest(gm) + threads + recentArc
      + '\n\n请把本回合固化为记忆与连续性。只返回 JSON:\n'
      + '{"memory":"本回合高密度压缩记录——含关键人名/事件/变化/玩家决策及后果(≤200字)",'
      + '"saga":"【多回合综合脉络·超窗压缩层】把至今全程**综合**成一段连贯叙事(近 ' + _memDepth + ' 回合外的更早事折叠压缩入此·勿逐回合罗列)——提炼贯穿主线、关键因果、转折、积累的未决悬念;**持续进行/未闭环的线视为当前状态·勿淡化压掉**;滚动更新上一版·勿丢早期主线·≤320字",'
      + '"state_board":{"mood":"当前朝堂氛围基调一句(≤40字)","recent_summary":"本回合最压缩摘要(≤150字·下回合优先读)","open_loops":["悬而未决应推进的线 1(≤35字)","线2"],"unfulfilled_promises":["待兑现决策/未闭环事项 1(≤35字)","2"]},'
      + '"plot_updates":[{"threadId":"已有线ID或null","title":"剧情线名","threadType":"political/military/personal/economic/succession/foreign","update":"本回合进展(≤30字)","status":"brewing/active/climax/resolved","newThread":false}],'
      + '"foreshadow":["伏笔1——40字·何人何事何时引爆","伏笔2","伏笔3"],'
      + '"causal_edges":[{"from":"起因(事件/决策/人物·≤20字)","to":"结果(≤20字)","type":"triggered/enabled/blocked/escalated","strength":0.6,"explanation":"因果说明(≤40字)"}]}';
    var sys = '你是天命的记忆与情节史官。把本回合固化为高密度记忆、状态盘、情节线索与因果链连续性·供下回合推演续接。只返回 JSON·不要解释。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 2000, null, 'secondary'); }
    catch (e) { return { ok: false, text: '(整合调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text);
    if (!p || (!p.memory && !p.state_board)) {   // T4 · 记忆固化=跨回合连续性命门·双败才重问一次(提额防截断)
      var text2 = await _reaskJSON(gm, [{ role: 'system', content: sys }, { role: 'user', content: tp }], 2000, 'secondary');
      if (text2) p = _parse(text2);
    }
    if (!p || (!p.memory && !p.state_board)) return { ok: false, text: '(整合解析失败/空·已重问一次)' };
    var did = [];
    if (p.memory) {
      if (!Array.isArray(gm._aiMemory)) gm._aiMemory = [];
      gm._aiMemory.push({ turn: turn, text: String(p.memory), priority: 'high' });
      if (!Array.isArray(gm._consolidatedMemory)) gm._consolidatedMemory = [];
      // 刀F(2026-07-02)·形状调和:LLM 管线写 {consolidated,...}·此处原只写 {summary}——跨模式互读各自扑空
      //   (管线的滚动续写读 .consolidated·agent 的记忆档读 .summary)。双键并写·两边消费者都能读。
      gm._consolidatedMemory.push({ turn: turn, summary: String(p.memory).slice(0, 300), consolidated: String(p.memory).slice(0, 300) });
      if (gm._consolidatedMemory.length > 50) gm._consolidatedMemory = gm._consolidatedMemory.slice(-50);
      did.push('记忆');
    }
    if (p.saga) { gm._sagaMemory = { turn: turn, text: String(p.saga).slice(0, 600) }; did.push('多回合脉络'); }  // 综合多回合·滚动更新
    if (p.state_board) {
      var sb = p.state_board;
      // 刀F(2026-07-02)·形状调和:补 ts/expiresAt(LLM 管线同款·§6.5 R3 五回合失效)——原缺 expiresAt·agent 写的状态盘在消费端永不过期·老悬念误导后续回合
      gm._stateBoard = { turn: turn, ts: Date.now(), expiresAt: (turn + 5), mood: String(sb.mood || '').slice(0, 60), recent_summary: String(sb.recent_summary || '').slice(0, 250), open_loops: Array.isArray(sb.open_loops) ? sb.open_loops.slice(0, 5) : [], unfulfilled_promises: Array.isArray(sb.unfulfilled_promises) ? sb.unfulfilled_promises.slice(0, 5) : [], _agent: true };
      did.push('状态盘');
    }
    if (Array.isArray(p.plot_updates) && p.plot_updates.length) {
      if (!Array.isArray(gm._plotThreads)) gm._plotThreads = [];
      p.plot_updates.forEach(function (pu, i) {
        if (!pu || !pu.title) return;
        if (pu.newThread || !pu.threadId) {
          if (!gm._plotThreads.find(function (t) { return t.title === pu.title; })) {
            gm._plotThreads.push({ id: _uid(gm, i), title: pu.title, description: pu.update || '', participants: [], startTurn: turn, lastUpdateTurn: turn, status: pu.status || 'active', priority: 3, threadType: pu.threadType || 'political', updates: [{ turn: turn, text: pu.update || '' }], _agent: true });
          }
        } else {
          var th = gm._plotThreads.find(function (t) { return t.id === pu.threadId || t.title === pu.title; });
          if (th) { th.lastUpdateTurn = turn; if (pu.status) th.status = pu.status; if (!Array.isArray(th.updates)) th.updates = []; if (pu.update) th.updates.push({ turn: turn, text: pu.update }); if (th.updates.length > 20) th.updates = th.updates.slice(-20); }
        }
      });
      gm._plotThreads = gm._plotThreads.filter(function (t) { return t.status !== 'resolved' || (turn - (t.lastUpdateTurn || 0) < 5); });
      if (gm._plotThreads.length > 15) gm._plotThreads = gm._plotThreads.slice(-15);
      did.push('情节线索');
    }
    if (Array.isArray(p.foreshadow) && p.foreshadow.length) {
      if (!Array.isArray(gm._foreshadows)) gm._foreshadows = [];
      p.foreshadow.slice(0, 6).forEach(function (f) { if (f) gm._foreshadows.push({ turn: turn, content: String(f), priority: 'normal', _agent: true }); });
      did.push('伏笔');
    }
    // DA4·因果链 → gm._causalGraph.edges(镜像 followup sc-memwrite:938 结构·被 ai.js:1952 下回合推演读·save-lifecycle 持久)
    if (Array.isArray(p.causal_edges) && p.causal_edges.length) {
      if (!gm._causalGraph || typeof gm._causalGraph !== 'object') gm._causalGraph = { nodes: [], edges: [] };
      if (!Array.isArray(gm._causalGraph.edges)) gm._causalGraph.edges = [];
      p.causal_edges.slice(0, 12).forEach(function (ce, i) {
        if (!ce || !ce.from || !ce.to) return;
        gm._causalGraph.edges.push({ id: 'e_agent_' + turn + '_' + i, from: String(ce.from).slice(0, 40), to: String(ce.to).slice(0, 40), type: ce.type || 'triggered', strength: Math.max(0, Math.min(1, parseFloat(ce.strength) || 0.5)), explanation: String(ce.explanation || '').slice(0, 80), turn: turn, _agent: true });
      });
      if (gm._causalGraph.edges.length > 300) gm._causalGraph.edges = gm._causalGraph.edges.slice(-300);
      did.push('因果链');
    }
    if (!did.length) return { ok: false, text: '(整合无有效产出)' };
    if (Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: '记忆·整合', reason: '固化本回合(' + did.join('/') + ')', new: String((p.state_board && p.state_board.recent_summary) || p.memory || '').slice(0, 60), turn: turn, _agent: true, _op: 'recall_consolidate' });
    return { ok: true, text: '已固化本回合:' + did.join('、') + '(状态盘/记忆/线索供下回合续接)' };
  }

  // ── deepen_letters:复用 sc1b·NPC 书信往来(本回合之事激起的人际通信 → GM.letters·人际质感) ──
  async function _deepenLetters(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载·无法生成书信)' };
    var turn = gm.turn || 0;
    var who = _selectNpcs(gm, input && input.focus).slice(0, 6).map(function (c) { return c.name + (c.faction ? ('(' + c.faction + ')') : ''); }).join('、');
    var tp = '本回合发生:\n' + _turnDigest(gm) + (who ? ('\n在场重点人物:' + who) : '')
      + '\n\n据本回合之事·推演此刻可能发出的书信(作为**人物间活动**·非给君上的奏报)。**优先人物↔人物**(盟友通气/同党密谋/构陷告发/师友问候/通风报信等)·收信人写另一位 NPC 姓名(勿写"玩家");仅极少数确需上闻君上者才写"玩家"。'
      + '\n本回合若无自然通信由头·返回空数组(0 封·勿强凑)；有则 1-3 封·写信人收信人贴合各自处境与关系。只返回 JSON:\n'
      + '{"letters":[{"from":"写信人姓名","to":"收信人姓名(优先另一 NPC·非玩家)","letterType":"intelligence/private/gift/plea/accusation","urgency":"normal/urgent","content":"信文(≤200字·有实质内容·非套话)"}]}';
    var sys = '你是天命的人际文书史官。据本回合实际发生·推演人物之间此刻该有的书信往来(人物活动的一种)·贴合各人处境与关系·有实质内容。无由头则空。只返回 JSON·不要解释。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1800, null, 'secondary'); }
    catch (e) { return { ok: false, text: '(书信调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text);
    var list = (p && Array.isArray(p.letters)) ? p.letters : null;
    if (!list || !list.length) return { ok: false, text: '(书信解析失败/空)' };
    if (!Array.isArray(gm.letters)) gm.letters = [];
    var applied = 0;
    list.slice(0, 4).forEach(function (L, i) {
      if (!L || !L.content) return;
      gm.letters.push({
        id: 'letter_agent_' + turn + '_' + i + '_' + (gm.letters.length || 0),
        from: L.from || '某臣', to: L.to || '玩家',
        letterType: L.letterType || 'intelligence', content: String(L.content).slice(0, 400),
        sentTurn: turn, deliveryTurn: turn, status: 'delivered',
        urgency: L.urgency || 'normal', _npcInitiated: true, _replyExpected: false, _playerRead: false, _agent: true
      });
      applied++;
    });
    if (applied && Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: '鸿雁·书信', reason: '生成 ' + applied + ' 封书信', new: list.slice(0, 3).map(function (L) { return (L.from || '') + '→' + (L.to || ''); }).join(' '), turn: turn, _agent: true, _op: 'deepen_letters' });
    return { ok: applied > 0, text: applied > 0 ? ('已生成 ' + applied + ' 封书信(入鸿雁)') : '(无书信生成)' };
  }

  // ── deepen_court:世界向君上案头汇聚的待决事务——御案时政(新增/推进/了结·镜像 sc1 current_issues_update)+ 群臣求见(入 _pendingAudiences·镜像 apply 私访/宴请→求见队列) ──
  //   命门(owner):御案时政不一定新产·也可更新旧;问对要能产生求见(老 LLM 推演本有·此处补 agent)。一次调用两产出(单次多干)。
  async function _deepenCourt(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载·无法推演朝务)' };
    var turn = gm.turn || 0;
    var existing = (Array.isArray(gm.currentIssues) ? gm.currentIssues : []).filter(function (i) { return i && i.status === 'pending'; }).slice(0, 8);
    var existTxt = existing.length ? existing.map(function (i) { return '· id=' + i.id + ' 「' + (i.title || '') + '」' + (i.description ? ('—' + String(i.description).slice(0, 40)) : ''); }).join('\n') : '(无·可新增)';
    var roster = _selectNpcs(gm, null).slice(0, 8).map(function (c) { return c.name + (c.title ? ('/' + c.title) : ''); }).join('、');
    var tp = '本回合发生:\n' + _turnDigest(gm)
      + '\n\n现有待决御案时政(可更新/解决·须用其 id):\n' + existTxt
      + (roster ? ('\n在场重点人物:' + roster) : '')
      + '\n\n据本回合实际之事·推演「该浮上君上案头的待决事务」:'
      + '\n① 御案时政(issue_updates):本回合张力可**新增**议题(action:add)、**推进/恶化**旧议题(action:update·用现有 id)、或已了结者标**解决**(action:resolve·用现有 id)。不必每项都动·无则空数组。'
      + '\n② 群臣求见(audiences):本回合有谁因何事想**入对面君**(口奏求见·非书面奏疏)·须本回合确有缘由·写真实在场人物。无则空数组。'
      + '\n只返回 JSON:\n{"issue_updates":[{"action":"add|update|resolve","id":"(update/resolve 必填·现有 id)","title":"(add/update 用)","category":"军务/财政/民生/吏治/边防/宫廷等","description":"≤50字","reason":"因本回合何事(≤25字)"}],"audiences":[{"name":"求见者姓名","reason":"求见缘由(≤30字)"}]}';
    var sys = '你是天命的朝务编修。据本回合实际发生·推演该浮上君上案头的待决事务:御案时政要务的新增/推进/了结、群臣的求见入对。须扣本回合真有其事·勿凭空捏造。只返回 JSON·不要解释。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1600, null, 'secondary'); }
    catch (e) { return { ok: false, text: '(朝务调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text);
    if (!p) return { ok: false, text: '(朝务解析失败)' };
    // —— 御案时政:add/update/resolve(镜像 tm-endturn-apply current_issues_update)——
    if (!Array.isArray(gm.currentIssues)) gm.currentIssues = [];
    var addN = 0, updN = 0, resN = 0;
    var _getTS = (typeof root.getTSText === 'function') ? root.getTSText : function () { return ''; };
    ((p && Array.isArray(p.issue_updates)) ? p.issue_updates : []).forEach(function (u) {
      if (!u || !u.action) return;
      if (u.action === 'add' && u.title) {
        gm.currentIssues.push({ id: 'issue_agent_' + turn + '_' + (gm.currentIssues.length || 0), title: String(u.title).slice(0, 40), category: u.category || '要事', description: String(u.description || '').slice(0, 120), status: 'pending', raisedTurn: turn, raisedDate: _getTS(turn), sourceType: 'agent_analysis', authorityLevel: 'ai_analysis', factStatus: 'advisory_unverified', _agent: true });
        addN++; if (typeof root.addEB === 'function') { try { root.addEB('时局', '新要务：' + u.title); } catch (_) {} }
      } else if (u.action === 'resolve' && u.id) {
        var ri = gm.currentIssues.find(function (i) { return i.id === u.id && i.status === 'pending'; });
        if (ri) { ri.status = 'resolved'; ri.resolvedTurn = turn; ri.resolvedDate = _getTS(turn); ri.factStatus = 'resolved_advisory'; resN++; if (typeof root.addEB === 'function') { try { root.addEB('时局', '要务解决：' + ri.title); } catch (_) {} } }
      } else if (u.action === 'update' && u.id) {
        var ui2 = gm.currentIssues.find(function (i) { return i.id === u.id; });
        if (ui2) { if (u.description) ui2.description = String(u.description).slice(0, 120); if (u.title) ui2.title = String(u.title).slice(0, 40); if (u.category) ui2.category = u.category; ui2._lastUpdatedTurn = turn; updN++; }
      }
    });
    // —— 求见:→ _pendingAudiences(镜像 apply:5051·tm-wendui「阶下待见」消费)——
    if (!Array.isArray(gm._pendingAudiences)) gm._pendingAudiences = [];
    var names = {}; (gm.chars || []).forEach(function (c) { if (c && c.name && c.alive !== false) names[c.name] = 1; });
    var audN = 0;
    ((p && Array.isArray(p.audiences)) ? p.audiences : []).forEach(function (a) {
      if (!a || !a.name || !names[a.name]) return;                                        // 须真实存活人物
      if (gm._pendingAudiences.some(function (q) { return q && q.name === a.name; })) return; // 去重(已在队列不重复)
      gm._pendingAudiences.push({ name: a.name, reason: String(a.reason || '求见').slice(0, 60), turn: turn, _agent: true });
      audN++;
    });
    if (gm._pendingAudiences.length > 20) gm._pendingAudiences = gm._pendingAudiences.slice(-20);  // cap(同 faction-diplomacy)
    var total = addN + updN + resN + audN;
    if (total && Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: '御案·朝务', reason: '时政 新' + addN + '/进' + updN + '/结' + resN + ' · 求见' + audN, turn: turn, _agent: true, _op: 'deepen_court' });
    return { ok: total > 0, text: total > 0 ? ('御案时政 新增' + addN + '/更新' + updN + '/解决' + resN + ' · 求见 ' + audN + ' 人(入问对待见)') : '(本回合无新待决事务)' };
  }

  // ── deepen_cognition:复用 sc07·NPC 认知(聚焦动态认知层:当下怎么看局面/君上·保留稳定画像) ──
  async function _deepenCognition(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载·无法深化认知)' };
    var npcs = _selectNpcs(gm, input && input.focus);
    if (!npcs.length) return { ok: false, text: '(无可深化的存活角色)' };
    var turn = gm.turn || 0;
    var roster = npcs.map(function (c) { return '· ' + c.name + (c.faction ? (' 势:' + c.faction) : '') + ' 忠' + (c.loyalty || 50) + (c._mood ? (' 情:' + c._mood) : ''); }).join('\n');
    var tp = '本回合发生:\n' + _turnDigest(gm) + '\n\n以下重点人物·推演各自此刻的「认知」(不是情绪·是他怎么看待/相信):\n' + roster
      + '\n\n为每人给出:① 当下对局面与君上的真实看法 ② 对本回合某事的认知(是否看穿/误判/起疑)。只返回 JSON:\n'
      + '{"npcs":[{"name":"","currentView":"对局面/君上的真实看法(≤80字)","recognition":"对某事的认知或起疑(≤60字)"}]}';
    var sys = '你是天命的人物认知史官。据本回合实际发生·推演重点人物当下的认知(怎么看、信什么、是否看穿)·贴合其立场处境。只返回 JSON·不要解释。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1600, null, 'secondary'); }
    catch (e) { return { ok: false, text: '(认知深化调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text);
    var list = (p && Array.isArray(p.npcs)) ? p.npcs : null;
    if (!list || !list.length) return { ok: false, text: '(认知深化解析失败/空)' };
    if (!gm._npcCognition || typeof gm._npcCognition !== 'object') gm._npcCognition = {};
    var applied = 0;
    list.forEach(function (n) {
      if (!n || !n.name) return;
      var c = (gm.chars || []).filter(function (x) { return x && x.name === n.name && x.alive !== false; })[0];
      if (!c) return;
      var ex = gm._npcCognition[n.name] || {};   // 保留稳定画像(selfIdentity 等)·只覆盖动态认知
      gm._npcCognition[n.name] = Object.assign({}, ex, {
        currentView: String(n.currentView || ex.currentView || '').slice(0, 150),
        recognition: String(n.recognition || ex.recognition || '').slice(0, 120),
        _lastCogTurn: turn, _agent: true
      });
      applied++;
    });
    if (applied && Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: 'NPC·认知', reason: '深化 ' + applied + ' 名人物认知', new: list.slice(0, 4).map(function (n) { return n.name; }).join(' '), turn: turn, _agent: true, _op: 'deepen_cognition' });
    return { ok: applied > 0, text: applied > 0 ? ('已深化 ' + applied + ' 名人物认知(当下看法/认知落 _npcCognition)') : '(无人物被深化)' };
  }

  // ── D2 deepen_factions:复用 sc16·势力/外交深析(写 facs[]._aiAssessment 意图/动向/对君上态度) ──
  async function _deepenFactions(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载)' };
    var turn = gm.turn || 0;
    var facs = (gm && Array.isArray(gm.facs)) ? gm.facs.filter(function (f) { return f && f.name; }) : [];
    if (!facs.length) return { ok: false, text: '(无势力可深析)' };
    if (input && Array.isArray(input.focus) && input.focus.length) { var set = {}; input.focus.forEach(function (n) { set[String(n)] = 1; }); var ff = facs.filter(function (f) { return set[f.name]; }); if (ff.length) facs = ff; }
    facs = facs.slice(0, 10);
    var roster = facs.map(function (f) { return '· ' + f.name + (f.strength != null ? (' 实力' + f.strength) : '') + (f.posture ? (' 姿态:' + f.posture) : '') + (f.leader ? (' 首领:' + f.leader) : ''); }).join('\n');
    var tp = '本回合发生:\n' + _turnDigest(gm) + '\n\n以下各方势力·请据本回合之事推演其动向:\n' + roster
      + '\n\n为每方给出:据本回合实际·该势力此刻真实意图/动向/对君上(玩家)态度变化(贴合其实力处境宿怨·勿套话)·并指出本回合浮现的势力暗流与暗中图谋。只返回 JSON:\n'
      + '{"factions":[{"name":"","intent":"当前核心意图(≤30字)","move":"下一步动向(≤30字)","toward_player":"对君上态度:亲附/观望/离心/敌对·及因","stance_delta":-20到20整数}],"undercurrents":[{"faction":"","type":"暗流(结党/离心/观望/异动)","description":"≤40字","impact":"对局势影响≤30字"}],"schemes":[{"schemer":"主谋(人或势力)","target":"目标","plan":"图谋≤40字","progress":"萌芽/酝酿/进行"}]}';
    var sys = '你是天命的地缘势力史官。基于本回合实际·推演各方势力真实意图与动向、浮现的暗流与暗中图谋·须贴合各自实力/处境/历史宿怨·不要套话。只返回 JSON。';
    var raw; try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 2200, null, 'secondary'); } catch (e) { return { ok: false, text: '(势力深析调用失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || '');
    var p = _parse(text); var list = (p && Array.isArray(p.factions)) ? p.factions : null;
    if (!list || !list.length) return { ok: false, text: '(势力深析解析失败/空)' };
    var applied = 0;
    list.forEach(function (n) { if (!n || !n.name) return; var f = (gm.facs || []).filter(function (x) { return x && x.name === n.name; })[0]; if (!f) return; f._aiAssessment = { intent: n.intent || '', move: n.move || '', towardPlayer: n.toward_player || '', turn: turn, _agent: true }; var sd = Number(n.stance_delta); if (!isNaN(sd) && isFinite(sd)) f._stanceShift = Math.max(-20, Math.min(20, sd)); applied++; });
    // ⑤势力层:暗流 _factionUndercurrents + 阴谋 activeSchemes(对齐 LLM 管线·agent 自产·非复用 sc)
    var ucN = 0, scN = 0;
    if (p && Array.isArray(p.undercurrents)) {
      if (!Array.isArray(gm._factionUndercurrents)) gm._factionUndercurrents = [];
      p.undercurrents.slice(0, 8).forEach(function (u) { if (!u || !(u.description || u.faction)) return; gm._factionUndercurrents.push({ faction: u.faction || '', type: u.type || '', description: String(u.description || '').slice(0, 80), impact: String(u.impact || '').slice(0, 60), turn: turn, _agent: true }); ucN++; });
      if (gm._factionUndercurrents.length > 40) gm._factionUndercurrents = gm._factionUndercurrents.slice(-40);
      if (ucN) { if (!Array.isArray(gm._factionUndercurrentsHistory)) gm._factionUndercurrentsHistory = []; gm._factionUndercurrentsHistory.push({ turn: turn, count: ucN, _agent: true }); }
    }
    if (p && Array.isArray(p.schemes)) {
      if (!Array.isArray(gm.activeSchemes)) gm.activeSchemes = [];
      p.schemes.slice(0, 6).forEach(function (s) { if (!s || !s.schemer) return; gm.activeSchemes.push({ schemer: s.schemer, target: s.target || '', plan: String(s.plan || '').slice(0, 80), progress: s.progress || '萌芽', startTurn: turn, _agent: true }); scN++; });
      if (gm.activeSchemes.length > 30) gm.activeSchemes = gm.activeSchemes.slice(-30);
    }
    if ((applied || ucN || scN) && Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: '势力·动向', reason: '深析 ' + applied + ' 方势力·暗流' + ucN + '·阴谋' + scN, new: list.slice(0, 5).map(function (n) { return n.name + '(' + (n.intent || '').slice(0, 8) + ')'; }).join(' '), turn: turn, _agent: true, _op: 'deepen_factions' });
    return { ok: (applied > 0 || ucN > 0 || scN > 0), text: (applied > 0 || ucN > 0 || scN > 0) ? ('已深析 ' + applied + ' 方势力动向 + 暗流' + ucN + '/阴谋' + scN + '(落 facs._aiAssessment/_factionUndercurrents/activeSchemes)') : '(无势力被深析)' };
  }

  // ── D2 deepen_economy:复用 sc17·财政经济深析(写 _economyDeepening) ──
  async function _deepenEconomy(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载)' };
    var turn = gm.turn || 0;
    var tp = '本回合发生:\n' + _turnDigest(gm) + '\n\n请据本回合之事·深析天下财政经济态势。只返回 JSON:\n'
      + '{"assessment":"财政经济总评——国库/赋税/民生经济真实状况与本回合变化(≤200字)","risks":["隐患1","隐患2"],"trends":["趋势1","趋势2"],"fiscal_pressure":"财政压力(1-10)及因(≤40字)"}';
    var sys = '你是天命的经济财政史官。基于本回合实际·客观深析财政经济态势、隐患、趋势。只返回 JSON。';
    var raw; try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1400, null, 'secondary'); } catch (e) { return { ok: false, text: '(经济深析失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || ''); var p = _parse(text);
    if (!p || !p.assessment) return { ok: false, text: '(经济深析解析失败/空)' };
    gm._economyDeepening = { turn: turn, assessment: p.assessment, risks: p.risks || [], trends: p.trends || [], fiscalPressure: p.fiscal_pressure || '', _agent: true };
    if (Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: '经济·态势', reason: '深析财政经济(压力 ' + (p.fiscal_pressure || '?') + ')', new: _brief(p.assessment, 60), turn: turn, _agent: true, _op: 'deepen_economy' });
    return { ok: true, text: '已深析经济态势(财政压力 ' + (p.fiscal_pressure || '?') + ')·落 _economyDeepening' };
  }

  // ── D2 deepen_military:复用 sc18·军事边防深析(写 _militaryDeepening) ──
  async function _deepenMilitary(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载)' };
    var turn = gm.turn || 0;
    var armies = (gm && Array.isArray(gm.armies)) ? gm.armies.slice(0, 12).map(function (a) { return (a.name || '军') + (a.strength != null ? ('力' + a.strength) : '') + (a.location ? ('@' + a.location) : ''); }).join(' ') : '';
    var wars = (gm && Array.isArray(gm.activeWars)) ? gm.activeWars.length : 0;
    var tp = '本回合发生:\n' + _turnDigest(gm) + (armies ? ('\n军备:' + armies) : '') + '\n进行中战事:' + wars
      + '\n\n请据本回合之事·深析军事态势(战力/边防/威胁/战和)。只返回 JSON:\n'
      + '{"assessment":"军事态势总评——边防/战力/威胁真实状况与本回合变化(≤200字)","threats":["威胁1","威胁2"],"recommendations":["建议1","建议2"],"war_risk":"战事风险(1-10)及因(≤40字)"}';
    var sys = '你是天命的军事边防史官。基于本回合实际·客观深析军事态势、威胁、战和建议。只返回 JSON。';
    var raw; try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: tp }], 1400, null, 'secondary'); } catch (e) { return { ok: false, text: '(军事深析失败:' + (e && e.message) + ')' }; }
    var text = (typeof raw === 'string') ? raw : ((raw && (raw.content || raw.text)) || ''); var p = _parse(text);
    if (!p || !p.assessment) return { ok: false, text: '(军事深析解析失败/空)' };
    gm._militaryDeepening = { turn: turn, assessment: p.assessment, threats: p.threats || [], recommendations: p.recommendations || [], warRisk: p.war_risk || '', _agent: true };
    if (Array.isArray(gm._turnReport)) gm._turnReport.push({ type: 'change', path: '军事·态势', reason: '深析军事(战事风险 ' + (p.war_risk || '?') + ')', new: _brief(p.assessment, 60), turn: turn, _agent: true, _op: 'deepen_military' });
    return { ok: true, text: '已深析军事态势(战事风险 ' + (p.war_risk || '?') + ')·落 _militaryDeepening' };
  }

  // ── D3 deepen_narrative:复用 sc2 链·叙事多遍打磨(纲要→正文·两遍)·替单遍 finalize 叙事 ──
  // T2(审计②·模型分工修正) · 史记正文是玩家逐字读的质量命门·此前错落 secondary(与机械深析同档)——
  //   默认回 primary·P.conf.agentNarrativeTier 可改(如明确要省钱)。未配 secondary 时两值等价·零变化。
  function _narrTier() {
    try { var pc = (root.P && root.P.conf) || (typeof P !== 'undefined' && P && P.conf) || {}; return pc.agentNarrativeTier || 'primary'; }
    catch (e) { return 'primary'; }
  }
  async function _deepenNarrative(gm, input) {
    if (!gm) return { ok: false, text: '(无存档)' };
    if (typeof root.callAIMessages !== 'function') return { ok: false, text: '(callAIMessages 未加载)' };
    var turn = gm.turn || 0; var digest = _turnDigest(gm); var memCtx = _memoryContext(gm);   // memCtx:跨回合记忆·史记须接前文
    // 第1遍·纲要
    var raw1; try { raw1 = await root.callAIMessages([{ role: 'system', content: '你是天命史官。先列本回合史记的关键脉络(不写正文)。只返回 JSON:{"beats":["要点1","要点2"],"tone":"基调"}' }, { role: 'user', content: '本回合发生:\n' + digest + memCtx + '\n\n列出本回合史记应涵盖的关键脉络(3-6 点·须呼应跨回合记忆中的情节线与伏笔)。' }], 900, null, _narrTier()); } catch (e) { return { ok: false, text: '(叙事纲要失败:' + (e && e.message) + ')' }; }
    var t1 = (typeof raw1 === 'string') ? raw1 : ((raw1 && (raw1.content || raw1.text)) || ''); var o = _parse(t1);
    var beats = (o && Array.isArray(o.beats)) ? o.beats.join('；') : '';
    // 第2遍·据纲要成正文
    // 第2遍·据纲要成史记四体(时政记/实录/政文/后人戏说·对应史记弹窗 GM.shijiHistory 各组成部分)
    // DA-Q2·史记字段提示词改由共享 recordSpecs 出(与 LLM 管线 sc1 逐字同源·字数随玩家设置 _getCharRange)·
    //   废原 paraphrase + 写死字数·并修正旧 playerInner 误作"朝野反响"(canonical=主角内心独白·渲染器据此)。
    //   DA-Q2b:houren 不再挤在本多字段调用·改由专用 pass(下方 raw3·hourenSpec·镜像管线 sc2 富场景叙事)出;zhengwen/suggestions 非 sc1 字段保留。
    var _rs = (root.TM && root.TM.Endturn && root.TM.Endturn.AI && root.TM.Endturn.AI.prompt && root.TM.Endturn.AI.prompt.recordSpecs) ? root.TM.Endturn.AI.prompt.recordSpecs({}) : null;
    // 字数设置 → max_tokens 缩放(汉字≈2tok+缓冲)·否则真模型也被低 max_tokens 截断·对齐管线慷慨上限(sc1≈7000/sc2=16000)
    var _szjMaxN = (_rs && _rs.szjMax) || 1200, _shiluMaxN = (_rs && _rs.shiluMax) || 400, _hourenMaxN = (_rs && _rs.hourenMax) || 6000;
    var _tokRecord = Math.min(16000, Math.max(2600, Math.round((_szjMaxN * 2 + _shiluMaxN + 800) * 2)));  // 史记主体(时政记+实录+政文+杂)
    var _tokHouren = Math.min(24000, Math.max(4000, Math.round(_hourenMaxN * 2 + 1200)));                  // 后人戏说(可达 6000-9000 字)
    var _schema;
    if (_rs) {
      _schema = '只返回 JSON:{'
        + '"shizhengji":"' + _rs.shizhengji + '",'
        + '"shilu":"' + _rs.shilu + '",'
        + '"zhengwen":"政文·推演正文体·承时政记延展天下局势演进与因果(' + _rs.szjMin + '-' + _rs.szjMax + '字)",'
        + '"playerStatus":"' + _rs.playerStatus + '",'
        + '"playerInner":"' + _rs.playerInner + '",'
        + '"suggestions":["宰辅就下回合的进言(2-3条·每条≤30字)"],'
        + '"title":"' + _rs.szjTitle + '",'
        + '"summary":"' + _rs.szjSummary + '"}';
    } else {
      // recordSpecs 未加载(node 测试未 require / 极端)·回落简表·不致崩
      _schema = '只返回 JSON:{"shizhengji":"时政记·朝政纪要体(≤250字)","shilu":"实录·正史体(≤200字)","zhengwen":"政文·推演正文(≤250字)","playerStatus":"君上处境与威望(≤60字)","playerInner":"主角内心独白(第一人称·≤80字)","suggestions":["宰辅进言(2-3条)"],"title":"时政记副标题(≤20字)","summary":"一句话摘要"}';
    }
    // 信史校准(镜像 LLM sc27 叙事质量二审·嵌入约束防时代错乱/人名错误·守"硬核可信"命门·零额外调用)
    var _aliveNames = (gm.chars || []).filter(function (c) { return c && c.alive !== false && c.name; }).map(function (c) { return c.name; }).slice(0, 40);
    var _periodVocab = (gm._aiScenarioDigest && gm._aiScenarioDigest.periodVocabulary) ? String(gm._aiScenarioDigest.periodVocabulary).slice(0, 200) : '';
    var _xinshi = '\n\n【信史校准·守硬核可信】① 人名只用真实在世人物' + (_aliveNames.length ? ('(' + _aliveNames.join('、') + ')') : '(见上文出场者)') + '·勿杜撰查无此人;② 禁时代错乱:勿用现代词汇/制度/物事、勿掺他朝专名' + (_periodVocab ? ('·宜用本时代用语(' + _periodVocab + ')') : '·称谓名物须合本朝代') + '。';
    // ★工具调用优化(2026-06):后人戏说(raw3·_tokHouren≤24k)与史记主体(raw2·_tokRecord≤16k)均只依赖 raw1 纲要 beats、彼此独立·又是系统最大两次调用→**并行**(先 kick off raw3·再 await raw2·省 1 次最大调用墙钟·AI 队列自限真并发)。raw3 .catch 返 null·不阻断史记主体。
    var _hsFn = (root.TM && root.TM.Endturn && root.TM.Endturn.AI && root.TM.Endturn.AI.prompt && root.TM.Endturn.AI.prompt.hourenSpec);
    var _raw3P = _hsFn
      ? root.callAIMessages([{ role: 'system', content: '你是天命史官·撰写《后人戏说》——把本回合还原为可感知的生活场景(具体人物/对话/动作/画面·与"政文"宏观政论文风迥异·勿写成评论摘要)。只返回 JSON。' }, { role: 'user', content: '本回合发生:\n' + digest + memCtx + '\n\n纲要:' + (beats || '(自拟)') + _hsFn({}) + _xinshi }], _tokHouren, null, _narrTier()).catch(function () { return null; })
      : Promise.resolve(null);
    var _recMsgs = [{ role: 'system', content: '你是天命史官·产出本回合史记主体记录(对齐 LLM 管线 ctx.record 契约·各文体风格有别·后人戏说另由专项 pass 出)。' + _schema }, { role: 'user', content: '本回合发生:\n' + digest + memCtx + '\n\n纲要:' + (beats || '(自拟)') + '\n\n据此产出完整史记记录(时政记/实录/政文 + 君上状态/主角内心/宰辅进言 + 标题/摘要)·各体文风须别·须达字数下限·须续接跨回合记忆(呼应过往与情节线·勿失忆重起)·**人物言行须与其本回合在问对/朝议/书信中的表现一致(勿矛盾·勿人格分裂)**。' + _xinshi }];
    var raw2; try { raw2 = await root.callAIMessages(_recMsgs, _tokRecord, null, _narrTier()); } catch (e) { return { ok: false, text: '(史记记录失败:' + (e && e.message) + ')' }; }
    var t2 = (typeof raw2 === 'string') ? raw2 : ((raw2 && (raw2.content || raw2.text)) || '');
    // ★2026-07-01·健壮兜底(镜像下方 houren 兜底·根治"实录/政文直接没了"):史记主体是长 prose(时政记+实录+政文
    //   动辄数千字)·内部真换行/未转义引号极易致 JSON.parse 失败→p 空→**整个史记四体丢弃**→renderer 回落
    //   finalize 生的粗叙事(带字面 \n\n)·且实录/政文全空。故 parse 失败或缺 shizhengji 时·正则逐字段抽值
    //   (容转义引号与换行·带 \\n→\n 归一)salvage 各体·尽力保住实录/政文/时政记。T4 抽成函数供重问后复用。
    function _salvRecord(tx, p0) {
      if (p0 && p0.shizhengji) return p0;
      var _cl2 = String(tx || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      var _xField = function (key) {
        var _m = _cl2.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
        return (_m && _m[1]) ? _m[1].replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
      };
      var _szSalvage = _xField('shizhengji') || _xField('narrative');
      if (!_szSalvage) return p0;
      var p1 = p0 || {};
      p1.shizhengji  = p1.shizhengji  || _szSalvage;
      p1.shilu       = p1.shilu       || _xField('shilu');
      p1.zhengwen    = p1.zhengwen    || _xField('zhengwen');
      p1.playerStatus= p1.playerStatus|| _xField('playerStatus');
      p1.playerInner = p1.playerInner || _xField('playerInner');
      p1.title       = p1.title       || _xField('title');
      p1.summary     = p1.summary     || _xField('summary');
      return p1;
    }
    var p = _salvRecord(t2, _parse(t2));
    if (!p || !(p.shizhengji || p.narrative)) {   // T4 · 史记四体=玩家逐字读的产出·parse+抢救双败才重问一次(提额防截断)
      var _t2b = await _reaskJSON(gm, _recMsgs, _tokRecord, _narrTier());
      if (_t2b) { t2 = _t2b; p = _salvRecord(_t2b, _parse(_t2b)); }
    }
    var _main = (p && (p.shizhengji || p.narrative)) || '';
    if (!p || !_main) return { ok: false, text: '(史记四体解析失败/空·已重问一次)' };
    // DA-Q2b·后人戏说(已并行 in-flight·此 await 取结果)·镜像管线 sc2·富场景叙事·失败/空不阻断史记主体
    var _houren = '';
    try {
      var raw3 = await _raw3P;
      if (raw3) {
        var t3 = (typeof raw3 === 'string') ? raw3 : ((raw3 && (raw3.content || raw3.text)) || ''); var p3 = _parse(t3);
        _houren = (p3 && (p3.houren_xishuo || p3.houren)) || '';
        // 健壮兜底(治"后人戏说回落=政文"bug):长 prose(数千字)塞 JSON 时内部换行/引号常致 JSON.parse 失败→_houren 空→render 回落 zhengwen。
        //   故解析失败时:① 正则抽 houren_xishuo 字段值(容转义引号与换行) ② 仍无且整段是纯文本→直接用整段。
        if (!_houren && t3) {
          var _clean = String(t3).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
          var _hm = _clean.match(/"(?:houren_xishuo|houren)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (_hm && _hm[1]) _houren = _hm[1].replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          if (!_houren && _clean && !/^[\[{]/.test(_clean) && _clean.length > 120) _houren = _clean;
        }
      }
    } catch (e) { /* houren 专项失败不阻断史记主体 */ }
    if (!Array.isArray(gm._turnReport)) gm._turnReport = [];
    gm._turnReport = gm._turnReport.filter(function (e) { return e.type !== 'narrative'; });
    gm._turnReport.unshift({ type: 'narrative', text: String(_main).slice(0, Math.max(900, _szjMaxN * 2)), turn: turn, _agent: true, _op: 'deepen_narrative', _polished: true });
    if (p.summary) { gm._turnReport = gm._turnReport.filter(function (e) { return e.type !== 'summary'; }); gm._turnReport.push({ type: 'summary', text: String(p.summary).slice(0, 200), turn: turn, _agent: true }); }
    // D7:存史记四体供 run() 焊缝映射进 aiResult → render 步写 GM.shijiHistory(史记弹窗 实录/时政记/政文/后人戏说 全部组成部分·键名对齐 ai-infer aiResult)
    // slice 上限随字数设置缩放(原写死 800/600/700/1500 远低于设置·会把符合字数的稿截断)·留 2× 缓冲
    gm._agentChronicle = { shizhengji: String(_main).slice(0, Math.max(900, _szjMaxN * 2)), shiluText: String(p.shilu || '').slice(0, Math.max(700, _shiluMaxN * 2)), zhengwen: String(p.zhengwen || '').slice(0, Math.max(800, _szjMaxN * 2)), hourenXishuo: String(_houren).slice(0, Math.max(2000, _hourenMaxN * 2)), playerStatus: String(p.playerStatus || '').slice(0, 200), playerInner: String(p.playerInner || '').slice(0, 260), suggestions: (Array.isArray(p.suggestions) ? p.suggestions.slice(0, 5).map(function (s) { return String(s).slice(0, 80); }) : []), szjTitle: String(p.title || '').slice(0, 40), szjSummary: String(p.summary || '').slice(0, 260), _agent: true };
    gm._narrativePolished = true;
    return { ok: true, text: '已成本回合史记四体(时政记/实录/政文/后人戏说)+标题摘要' };
  }

  var DEFS = [
    { name: 'deepen_world', description: '生成世界态势快照 + 下回合伏笔种子(存入记忆锚·下回合推演的记忆起点)。本回合大局有显著变化、想给世界留记忆锚时调用。复用 sc28。', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'deepen_npcs', description: '深化重点人物的内心(心绪/压力/暗筹·真落到角色)。本回合发生了影响人物心境的事、想让 NPC 有真实内心反应时调用。可传 focus:[人名] 指定·不传则自动选关键人物。复用 sc15。', parameters: { type: 'object', properties: { focus: { type: 'array', items: { type: 'string' }, description: '可选·指定要深化的人物名' } }, required: [] } },
    { name: 'deepen_relations', description: '把本回合推演出的人物间关系变化(交恶/结盟/举荐/弹劾/构陷/和解等)真写回 char.relations(走与 LLM 同一入口 applyNpcInteraction)。本回合人物间有恩怨/合纵连横时调用·补"人物关系维度"·下回合 NPC 决策即可感知。可传 focus:[人名]。', parameters: { type: 'object', properties: { focus: { type: 'array', items: { type: 'string' } } }, required: [] } },
    { name: 'recall_consolidate', description: '把本回合固化为记忆与连续性:压缩记忆 + 状态盘(下回合优先读) + 情节线索更新 + 伏笔。回合收尾前调一次·让世界有跨回合记忆与剧情连续。复用 sc25。', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'deepen_letters', description: '据本回合之事生成**人物间**书信往来(优先 NPC↔NPC·盟友通气/同党密谋/构陷告发/师友问候·作为人物活动·非给君上的奏报·无由头则空·入鸿雁)。本回合有人际通信由头时调用。可传 focus:[人名]。复用 sc1b。', parameters: { type: 'object', properties: { focus: { type: 'array', items: { type: 'string' } } }, required: [] } },
    { name: 'deepen_court', description: '推演该浮上君上案头的待决事务:御案时政要务(新增/推进/了结现有议题)+ 群臣求见入对(NPC 因本回合之事想口奏面君·入问对待见队列)。本回合局势演化、有新议题或人物欲求见时调用。镜像 LLM 的 current_issues_update + 求见队列。', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'deepen_cognition', description: '深化重点人物的认知(当下怎么看局面/君上、是否看穿某事·落 _npcCognition·保留稳定画像)。与 deepen_npcs(情绪)互补——此为认知层。可传 focus:[人名]。复用 sc07。', parameters: { type: 'object', properties: { focus: { type: 'array', items: { type: 'string' } } }, required: [] } },
    { name: 'deepen_factions', description: '深析各方势力意图/动向/对君上态度(↔sc16)。本回合涉及势力博弈/外交/战和时调用·补"势力维度"深度。可传 focus:[势力名]。', parameters: { type: 'object', properties: { focus: { type: 'array', items: { type: 'string' } } }, required: [] } },
    { name: 'deepen_economy', description: '深析财政经济态势/隐患/趋势(↔sc17)。本回合涉及财政/赋税/民生经济时调用·补"经济维度"深度。', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'deepen_military', description: '深析军事态势/威胁/战和(↔sc18)。本回合涉及战事/边防/军队时调用·补"军事维度"深度。', parameters: { type: 'object', properties: {}, required: [] } },
    { name: 'deepen_narrative', description: '多遍打磨本回合史记(纲要→正文·↔sc2链)·替单遍叙事·收尾前调让史记有文采有深度。', parameters: { type: 'object', properties: {}, required: [] } }
  ];
  var TOOL_SET = {}; DEFS.forEach(function (d) { TOOL_SET[d.name] = true; });

  async function handle(name, input, ctx) {
    var gm = _GM(ctx);
    switch (name) {
      case 'deepen_world':       return _wrap(name, await _deepenWorld(gm, input || {}));
      case 'deepen_npcs':        return _wrap(name, await _deepenNpcs(gm, input || {}));
      case 'deepen_relations':   return _wrap(name, await _deepenRelations(gm, input || {}));
      case 'recall_consolidate': return _wrap(name, await _recallConsolidate(gm, input || {}));
      case 'deepen_letters':     return _wrap(name, await _deepenLetters(gm, input || {}));
      case 'deepen_court':       return _wrap(name, await _deepenCourt(gm, input || {}));
      case 'deepen_cognition':   return _wrap(name, await _deepenCognition(gm, input || {}));
      case 'deepen_factions':    return _wrap(name, await _deepenFactions(gm, input || {}));
      case 'deepen_economy':     return _wrap(name, await _deepenEconomy(gm, input || {}));
      case 'deepen_military':    return _wrap(name, await _deepenMilitary(gm, input || {}));
      case 'deepen_narrative':   return _wrap(name, await _deepenNarrative(gm, input || {}));
      default: return { ok: false, name: name, text: '(未知深化工具:' + name + ')' };
    }
  }
  function _wrap(name, r) { return { ok: !!(r && r.ok), name: name, text: (r && r.text) || '' }; }

  function defs() { return DEFS.slice(); }
  function isToolName(name) { return Object.prototype.hasOwnProperty.call(TOOL_SET, name); }

  TM.Endturn.AgentDepthTools = {
    defs: defs,
    DEFS: DEFS,
    handle: handle,
    isToolName: isToolName,
    _turnDigest: _turnDigest   // 测试用
  };
})(typeof window !== 'undefined' ? window : globalThis);
