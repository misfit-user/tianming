'use strict';
// External response fixture only. This function is self-contained so the
// Electron gate can inject its source at the fetch boundary without replacing
// request construction, parsing, validators or domain writes.
function responseFor(kind, prompt) {
  kind = String(kind || ''); prompt = String(prompt || '');
  var summary = '确定性测试响应未增加额外世界变化；人物往来、实际行程和资源结算以现有领域记录为准。';
  function sourceText(start, end, limit) {
    var at = prompt.indexOf(start); if (at < 0) throw Error('composite-fixture-source-marker-missing:' + start);
    var value = prompt.slice(at + start.length), stop = end ? value.indexOf(end) : -1;
    return (stop >= 0 ? value.slice(0, stop) : value).trim().slice(0, limit);
  }
  if (!kind && prompt.includes('你是剧作师·负责推进主要 NPC 的情节弧。')) kind = 'character-arcs';
  if (!kind && prompt.includes('You calibrate a historical simulation game state.')) kind = 'party-calibration';
  if (!kind && prompt.includes('天命每回合固定执行的复核与补全 Agent')) kind = 'routine-review';
  if (!kind && prompt.includes('【正式奏疏的完整结构（必须遵守）】')) kind = 'memorial';
  if (!kind && prompt.includes('依据收到的信息选择行动，允许无事、等待、拒绝和改条件。')) kind = 'npc-direction';
  // Direct producers bypass the end-turn subcall adapter. Each dispatch below
  // names the actual production prompt and uses only that consumer's protocol.
  if (!kind && prompt.includes('你是当前绑定的真实人物，以列出的本次职任思考。')) kind = 'political-decision';
  if (!kind && prompt.includes('你是天命推演引擎的党争演绎官。朝堂之上党争激荡')) kind = 'party-inference';
  if (!kind && prompt.includes('你是天命推演引擎的党争演绎官。') && prompt.includes('须为下列党派/阶层立真身份')) kind = 'party-identity';
  if (!kind && prompt.includes('你是推演 AI。基于以下三系统快照')) kind = 'three-systems';
  if (!kind && prompt.includes('你是天命推演引擎的外患演绎官。以下敌国各有心思')) kind = 'border-inference';
  if (!kind && prompt.includes('你是天命推演引擎的民变演绎官。天下汹汹')) kind = 'revolt-inference';
  if (!kind && prompt.includes('【任务·将过去5回合的事件语义化压缩为情景摘要】')) kind = 'memory-l2';
  if (!kind && prompt.includes('【任务·将过去30回合压缩为年代纲要·史书级压缩】')) kind = 'memory-l3';
  if (!kind && prompt.includes('【任务·对比上回合预测与本回合实际·提炼经验教训】')) kind = 'memory-reflect';
  if (!kind && prompt.includes('请将以下游戏事件压缩为200字以内的摘要，格式：')) kind = 'memory-events';
  if (!kind && prompt.includes('请将以下历史纪要压缩为一段100字以内的综述：')) kind = 'memory-archive';
  if (!kind && prompt.includes('【本月事件】') && prompt.includes('请直接输出纪事正文（不要JSON包裹）：')) kind = 'monthly-chronicle';
  if (!kind && prompt.includes('请将以下皇帝历次诏书+进行中大事+在途旅程，整理为本回合 AI 推演所需的简明摘要。')) kind = 'long-term-digest';
  if (!kind && prompt.includes('【官制按需细查·辅助主推演】你是主推演的前置助手。')) kind = 'office-recall';
  if (!kind && prompt.includes('【奏疏代拟】') && prompt.includes('下列地方民情积压已由有司具题待呈御前。')) kind = 'memorial-draft';
  if (!kind && prompt.includes('【辅臣拟议】') && prompt.includes('下列奏疏已呈御前·请为每封拟一句简短处理建议')) kind = 'memorial-advice';
  if (kind === 'sc25c') {
    if (prompt.includes('【sc25c·战术层 tactical】')) kind = 'sc25c.tactical';
    else if (prompt.includes('【sc25c·战略层 strategic】')) kind = 'sc25c.strategic';
  }
  if (kind === 'party-calibration') return { relation_adjustments: [], class_updates: [], party_create: [], class_emerge: [], party_updates: [], faction_updates: [], court_issue_updates: [], issue_goal_links: [], class_character_relation_updates: [], notes: [summary] };
  if (kind === 'memorial') return [];
  if (kind === 'character-arcs') return {}; // tm-char-arcs consumes only explicitly returned character keys.
  if (kind === 'npc-direction') return prompt.includes('若无需新方向，返回 planning:null') ? { planning: null } : [];
  if (kind === 'political-decision') return { rationale: summary, actions: [], proposals: [], proposalResponses: [] };
  if (kind === 'party-inference') return { parties: [] };
  if (kind === 'party-identity') return { parties: [], classes: [] }; // existing deterministic identity fallback stays in production.
  if (kind === 'three-systems') return { factionActions: [], partyActions: [], generalActions: [] };
  if (kind === 'border-inference') return { moves: [] };
  if (kind === 'revolt-inference') return { stocks: [] };
  if (kind === 'memory-l2') return { summary: summary, mood: '', keyCharacters: [], themes: [], turning_points: [] };
  if (kind === 'memory-l3') return { theme: summary, atmosphere: '', highlights: [], mainThreads: '', causalSummary: '', keyCharacters: [] };
  if (kind === 'memory-reflect') return { predictedLast: '', actualThis: summary, divergence: 'low', lesson: '测试替身不作额外预测；后续判断须继续读取实际领域结果。', confidence_calibration: 0 };
  if (kind === 'memory-events') return '测试事件摘录：' + sourceText('事件列表：\n', '\n\n请直接输出摘要正文：', 180);
  if (kind === 'memory-archive') return '测试纪要摘录：' + sourceText('请将以下历史纪要压缩为一段100字以内的综述：\n', '', 85);
  if (kind === 'monthly-chronicle') return '测试月度纪事摘录：' + sourceText('【本月事件】\n', '\n【上月纪事末尾】', 180);
  if (kind === 'long-term-digest') return '测试长期事项摘录（不新增效果或完成判断）：\n' + sourceText('请将以下皇帝历次诏书+进行中大事+在途旅程，整理为本回合 AI 推演所需的简明摘要。\n\n', '\n\n要求：', 650);
  if (kind === 'office-recall') {
    var office = prompt.match(/〔衙门概览〕\s*([^·\n┊]+)·/);
    if (!office) throw Error('composite-fixture-office-recall-needs-known-department');
    return { tool_calls: [{ name: 'query_office', input: { query: office[1].trim() } }] };
  }
  if (kind === 'memorial-advice') return [];
  if (kind === 'memorial-draft') {
    // Preserve the declared source statement, including unresolved status.
    // This fixture supplies no invented finding, expenditure or approval.
    var listed = sourceText('奏疏清单：\n', '\n\n只输出 JSON', 6000), drafts = [], expression = /^(\d+)\..*?·缘由：(.+)$/gm, match;
    while ((match = expression.exec(listed))) if (match[2].trim().length >= 20) drafts.push({ i: Number(match[1]), body: match[2].trim() });
    return drafts;
  }
  if (kind === 'routine-review') {
    var marker = prompt.lastIndexOf('\n{"case":'), packet = marker >= 0 ? JSON.parse(prompt.slice(marker + 1)) : null;
    if (!packet || packet.case.mode !== 'routine' || (packet.case.issues || []).length || (packet.case.corrections || []).length) throw Error('composite-fixture-review-requires-explicit-evidence');
    return { tools: [{ name: 'submit', input: { checks: { validators: '保留真实校验输出，无新增模型修改。', edict_execution: '此替身未发出新的诏令执行。', state_consistency: '人物、行程与资源继续由真实领域结算。', uncovered: '既有未完事项仍由真实账本保留。' }, findings: [], operations: [], reason: summary } }] };
  }
  if (kind === 'sc0') return { tensions: [], consequences: [], memoryQueries: [] };
  if (kind === 'sc05') return { causal_chains: summary, unresolved: '', patterns: '', player_impact: '', npc_memories: '', momentum: '' };
  if (kind === 'sc1q') return { dialogue_commitments: [], collective_resolutions: [], npc_dialogue_intent: [], required_sc1_actions: [] };
  if (kind === 'sc1' || kind === 'sc1_rescue' || kind === 'sc1_inc_retry') return {
    turn_summary: '组合活动测试按既有安排推进。', shizhengji_basis: '真实活动、行程、材料与确定性领域结果。',
    shilu_text: summary, szj_title: '往来与职责', shizhengji: summary, szj_summary: '保留现有事项与实际结果。', player_status: '人物当前状态以本回合真实领域记录为准。', player_inner: '',
    // A declared fixture observation satisfies SC1's substantive-record gate;
    // it makes no claim that an activity, permission or resource effect occurred.
    events: [{ type: 'composite-fixture', title: '外部响应边界', text: summary }],
    resource_changes: {}, char_updates: [], edict_feedback: [], fiscal_adjustments: [], personnel_changes: [], changes: []
  };
  if (kind === 'sc1b') return { cultural_works: [], npc_letters: [], npc_correspondence: [], npc_interactions: [] };
  if (kind === 'sc1c') return { faction_events: [], faction_ai_outcomes: [], faction_interactions_advanced: [], faction_relation_changes: [], faction_succession: [], npc_schemes: [], hidden_moves: [], scheme_actions: [], fengwen_snippets: [] };
  if (kind === 'sc1d') return { shilu_text: summary, szj_title: '往来与职责', shizhengji: summary, szj_summary: '保留现有事项与实际结果。', basis_refs: [] };
  if (kind === 'sc15' || kind === 'sc15n') return { mood_shifts: [], relationship_changes: [], hidden_moves: [], faction_undercurrents: [], npc_schemes: [], rumors: '', npc_cognition: [] };
  if (kind === 'sc_memwrite') return { memory_writes: [], arc_updates: [], causal_edges: [] };
  if (kind === 'sc16') return { faction_priorities: [], faction_actions: [], faction_directives: [], diplomatic_shifts: [], power_balance_shift: '' };
  if (kind === 'sc17') return { fiscal_analysis: summary, supplementary_resource_changes: {}, economic_advice: '', trade_dynamics: '', inflation_pressure: '', resource_forecast: '' };
  if (kind === 'sc18') return { military_situation: summary, war_probability: [], supplementary_army_changes: [], faction_military_actions: [], battleResults: [], power_balance_shift: '' };
  if (kind === 'sc_audit') return { conflicts: [], auto_patches: [], needs_rerun: false };
  if (kind === 'sc2' || kind === 'sc2_prose') return { zhengwen: summary, houren_xishuo: '' };
  if (kind === 'sc2_outline') return { scenes: [], narrative_arc: summary };
  if (kind === 'sc27' || kind === 'sc27_review') return { anachronisms: [], name_errors: [], missing_beats: [], tone_guidance: '', rewritten_passages: '', added_details: '' };
  if (kind === 'sc25c.tactical') return { immediate_foreshadow: [], turn_memory: [], state_board: { mood: '', open_loops: [], unfulfilled_promises: [], recent_summary: summary }, imperial_candidates: [], event_weights: [], trend: '' };
  if (kind === 'sc25c.strategic' || kind === 'sc_consolidate') return { consolidated: summary, key_threads: [], npc_trajectories: [], faction_vectors: [], unresolved_tensions: [], player_reputation_drift: [], next_turn_focus: [] };
  if (kind === 'sc25') return { foreshadow: [], memory: summary, state_board: { mood: '', open_loops: [], unfulfilled_promises: [], recent_summary: summary }, event_weights: [] };
  if (kind === 'sc07') return { npc_cognition: [] };
  if (kind === 'sc28') return { world_snapshot: summary, next_turn_seeds: '', tension_level: '' };
  throw Error('unsupported-composite-model-fixture:' + kind + ':' + prompt.slice(0, 140));
}
module.exports = { responseFor };
