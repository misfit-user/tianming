'use strict';
// tm-wentian-agent.js — 问天 agent 模式（2026-07-03）
//   旧问天=单发解析：AI 只凭指令文本猜路径——人名错字/模糊指代/不知现值·直改常「路径未找到」或改错人。
//   agent 模式=先查证后裁定：AI 用只读工具（查字段/搜档案/细查实体/关系网）核实对象真名与现值·
//   再调 submit_wentian 提交裁定（可多条 hardChanges）。
//   基建全复用：callAIWithTools（tm-ai-infra·三 provider 归一·不支持 tools 自动降级 prompt 模拟）+
//   TM.Endturn.AgentReadTools（endturn agent 的只读工具集）+ transcript 累积伪多轮
//   （同有司核议 _decideMultiStep 范式·末轮 forceTool 逼终结防空转）。
//   产出与旧 _wtPending 契约兼容（新增 hardChanges 数组·单条 hardChange 照旧可用）。
//   开关：P.conf.wentianAgentMode !== false 默认开（设置→性能·成本控制可关）；
//   基建不可用（无 callAIWithTools/AgentReadTools）→ _wtSend 自动回退旧单发·永不断问天。
(function (root) {
  root.TM = root.TM || {};

  // 问天只用轻量只读工具（dossier/records 等重工具留给回合 agent·问天要快）
  var READ_TOOL_NAMES = ['get_overview', 'get_field', 'list_entities', 'inspect_entity', 'search_save', 'get_relations'];

  var SUBMIT_TOOL = {
    name: 'submit_wentian',
    description: '提交问天最终裁定（终结工具）。查证完毕后必须调用本工具——不要只输出文本。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['rule', 'correction', 'content', 'directive'], description: 'rule=持久规则/correction=纠正/content=背景补充/directive=一次性指令' },
        category: { type: 'string', enum: ['narrative', 'setting', 'hardChange', 'edictSubstitute', 'absolute'] },
        interpretation: { type: 'string', description: '30-80字：复述玩家意图 + 你查证到的关键事实（如「袁崇焕现忠诚55·将设为100」）' },
        plan: { type: 'string', description: '一句话下回合怎样落实' },
        hardChanges: {
          type: 'array',
          description: 'category=hardChange/absolute 时必填·可多条。path 用常见路径式(chars[人物名].loyalty / divisions[府州名].economyBase.farmland 等)。★须先用工具核实对象在档真名与现值·勿凭空猜名。',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              op: { type: 'string', enum: ['set', 'add', 'mul'] },
              value: { description: '数字或要写入的内容' },
              note: { type: 'string', description: '这一笔改什么(短句·给玩家确认看)' }
            },
            required: ['path', 'op']
          }
        },
        edictText: { type: 'string', description: 'category=edictSubstitute 时必填·诏令正式措辞30-80字' },
        edictChannel: { type: 'string', enum: ['pol', 'mil', 'dip', 'eco', 'oth'] },
        structured: { type: 'object', description: '{target,action,scope,forbidden,measurable,condition}' },
        ambiguity: { type: 'array', items: { type: 'string' } }
      },
      required: ['category', 'interpretation']
    }
  };

  function _readTools() {
    try { return (root.TM && TM.Endturn && TM.Endturn.AgentReadTools) || null; } catch (_) { return null; }
  }

  function enabled() {
    try {
      if (root.P && P.conf && P.conf.wentianAgentMode === false) return false;
      return typeof root.callAIWithTools === 'function' && !!_readTools();
    } catch (_) { return false; }
  }

  function _maxRounds() {
    try {
      var n = parseInt(root.P && P.conf && P.conf.wentianAgentRounds, 10);
      if (isFinite(n) && n >= 1) return Math.min(4, n);
    } catch (_) {}
    return 3;
  }

  // run(content, opts) → { ok, result(submit_wentian input), trace:[工具名] } | { ok:false }
  //   opts: { teaching(教学核心文本·与单发同源), ctx(剧本/回合/已有规则), forceHint, onProgress(toolName, round) }
  async function run(content, opts) {
    opts = opts || {};
    var rt = _readTools();
    if (!rt || typeof root.callAIWithTools !== 'function') return { ok: false };
    var tools = (typeof rt.defs === 'function' ? rt.defs() : []).filter(function (d) {
      return d && READ_TOOL_NAMES.indexOf(d.name) >= 0;
    }).concat([SUBMIT_TOOL]);

    var transcript = '你是天命AI推演系统的元指令裁定官（agent 模式）。玩家对「问天」通道说了一条指令。\n'
      + '你的职责：①先用只读工具查证——指令涉及的人/军/阶层/党派/势力/区划在档真名是什么、现值多少（玩家可能写错字、用绰号、记错现状）；'
      + '②查证足够后调用 submit_wentian 提交裁定。宁可先查一两手·不要凭空猜路径与数值。\n'
      + '【裁定教学】\n' + String(opts.teaching || '') + '\n'
      + (opts.ctx ? '【上下文】\n' + opts.ctx + '\n' : '')
      + (opts.forceHint ? opts.forceHint + '\n' : '')
      + '【玩家指令】\n' + content + '\n';

    var trace = [];
    var maxR = _maxRounds();
    for (var round = 1; round <= maxR; round++) {
      var forceLast = (round === maxR);
      var resp;
      try {
        resp = await root.callAIWithTools(transcript, tools, {
          maxTok: 1400,
          tier: (typeof root._useSecondaryTier === 'function' && root._useSecondaryTier()) ? 'secondary' : undefined,
          forceTool: forceLast ? 'submit_wentian' : undefined,
          timeoutMs: 45000,
          maxRetries: 1,
          id: 'wentian-agent'
        });
      } catch (eCall) {
        return { ok: false, error: (eCall && eCall.message) || String(eCall) };
      }
      var calls = (resp && resp.toolCalls) || [];
      for (var s = 0; s < calls.length; s++) {
        if (calls[s] && calls[s].name === 'submit_wentian' && calls[s].input) {
          return { ok: true, result: calls[s].input, trace: trace };
        }
      }
      // 执行只读工具（≤4/轮）·结果滚入 transcript 续轮
      var used = 0;
      for (var i = 0; i < calls.length && used < 4; i++) {
        var c = calls[i];
        if (!c || !c.name || c.name === 'submit_wentian') continue;
        var out;
        try { out = await rt.handle(c.name, c.input || {}, { GM: root.GM, P: root.P }); }
        catch (eTool) { out = { ok: false, text: '(工具异常:' + ((eTool && eTool.message) || eTool) + ')' }; }
        var outText = (out && typeof out === 'object') ? String(out.text || '') : String(out || '');
        transcript += '\n【工具·' + c.name + '】入参 ' + JSON.stringify(c.input || {}).slice(0, 240)
          + '\n结果：' + outText.slice(0, 1600) + '\n';
        trace.push(c.name);
        used++;
        if (typeof opts.onProgress === 'function') { try { opts.onProgress(c.name, round); } catch (_) {} }
      }
      if (!calls.length) {
        transcript += '\n（上轮你没有调用任何工具。若已查证清楚·请调用 submit_wentian 提交裁定。）\n';
      }
    }
    return { ok: false, error: 'rounds-exhausted' };
  }

  TM.WentianAgent = { run: run, enabled: enabled, SUBMIT_TOOL: SUBMIT_TOOL, READ_TOOL_NAMES: READ_TOOL_NAMES.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.WentianAgent;
})(typeof window !== 'undefined' ? window : globalThis);
