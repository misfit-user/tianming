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

  // 问天带轻量只读工具 + get_dossier（2026-07-10 刀④·一调抓全维度·「整顿辽东军务」类涉面广的指令不必 get_field 一手手摸）
  // records 等重工具仍留给回合 agent（问天要快）。
  var READ_TOOL_NAMES = ['get_overview', 'get_field', 'list_entities', 'inspect_entity', 'search_save', 'get_relations', 'get_dossier'];

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
        edictText: { type: 'string', description: 'category=edictSubstitute 时必填·诏令正式措辞30-80字。★问天不能凭空造新人物/军队/势力等实体（七类直改只改在档实体现有字段；天意 absolute 类目除外，天意档依既有语义直接造物不受此限）；玩家（未以天意措辞）要"生成/引入新人物"时归本类·把 edictText 写成征召句式（"征召<姓名>入朝"/"诏<姓名>为<官职>"/"起复<姓名>"），玩家下诏后诏令征召管线才会真造人。禁止在 interpretation 里口头答应生成新实体而无诏令落实。' },
        edictChannel: { type: 'string', enum: ['pol', 'mil', 'dip', 'eco', 'oth'] },
        structured: { type: 'object', description: '{target,action,scope,forbidden,measurable,condition}' },
        ambiguity: { type: 'array', items: { type: 'string' } },
        watch: {
          type: 'array',
          description: '(可选·仅当裁定含可量化的后续目标时填·最多6条)兑现对账指标——回合结束后引擎按在档真值自动核验并回报玩家。path 用与 hardChanges 相同的路径式·★须先用工具核实在档真名·勿凭空猜。expect: increase/decrease=相对现值方向·gte/lte/eq=与 value 比较·change=只要变动。',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              expect: { type: 'string', enum: ['increase', 'decrease', 'gte', 'lte', 'eq', 'change'] },
              value: { description: 'gte/lte/eq 时的比较值' },
              note: { type: 'string', description: '指标短名(给玩家看·如「袁崇焕忠诚」)' }
            },
            required: ['path', 'expect']
          }
        },
        clarify: { type: 'object', description: '仅当对象指代/意图拿不准且影响裁定时才填：向玩家提一个澄清问题·确认框会给可点选项·玩家一点即带澄清重裁。拿得准就不要填。', properties: { question: { type: 'string', description: '一句话问题' }, options: { type: 'array', items: { type: 'string' }, description: '2-4个候选短语(如两个同名人的身份区分)' } } }
      },
      required: ['category', 'interpretation']
    }
  };

  function _readTools() {
    try { return (root.TM && TM.Endturn && TM.Endturn.AgentReadTools) || null; } catch (_) { return null; }
  }

  // dry-run 探针（2026-07-10 刀②·引擎导出 _wtDryRunHardChange·缺位[node裸跑/装载序异常]→null=跳过校验保旧行为）
  function _dryRun(path) {
    try {
      if (typeof root._wtDryRunHardChange === 'function') return root._wtDryRunHardChange(path);
    } catch (_) {}
    return null;
  }

  // submit 校验：hardChanges 逐笔 dry-run 预演(不写入)·就地标注 hc._dryRun 供确认框红绿预标。
  // 返回坏笔清单（仅 category=hardChange 计坏·absolute 天意档不拒只标注——造物自由是其语义）。
  function _validateSubmit(result) {
    var bad = [];
    var hcs = (result && Array.isArray(result.hardChanges)) ? result.hardChanges : [];
    for (var i = 0; i < hcs.length; i++) {
      var hc = hcs[i];
      if (!hc || !hc.path) continue;
      var dr = _dryRun(hc.path);
      if (!dr) continue;
      hc._dryRun = { ok: !!dr.ok, kind: dr.kind || '', reason: dr.reason || '' };
      if (!dr.ok && result.category !== 'absolute') bad.push({ i: i, path: hc.path, reason: dr.reason || '解析不到真实字段' });
    }
    return bad;
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
    // 兑现对账 flag OFF 时从 submit schema 剥掉 watch（省 token·真 OFF 零行为）
    var submitDef = SUBMIT_TOOL;
    try {
      if (!(root.P && P.conf && P.conf.wentianFulfillAudit === true)) {
        submitDef = JSON.parse(JSON.stringify(SUBMIT_TOOL));
        delete submitDef.parameters.properties.watch;
      }
    } catch (_wtWsE) {}
    var tools = (typeof rt.defs === 'function' ? rt.defs() : []).filter(function (d) {
      return d && READ_TOOL_NAMES.indexOf(d.name) >= 0;
    }).concat([submitDef]);

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
      var submitted = null;
      for (var s = 0; s < calls.length; s++) {
        if (calls[s] && calls[s].name === 'submit_wentian' && calls[s].input) { submitted = calls[s].input; break; }
      }
      if (submitted) {
        // submit 校验回路（2026-07-10 刀②）：hardChange 档解析不到真实字段的笔=确认后必落幽灵键闸被拒——
        // 还有轮次就把校验报告喂回·逼 AI 用工具核实真名后重提；轮尽仍坏→照常返回(确认框红标兜底·玩家裁决)。
        var bad = _validateSubmit(submitted);
        if (bad.length && round < maxR) {
          transcript += '\n【submit 校验·未通过】你提交的 hardChanges 有 ' + bad.length + ' 笔解析不到真实字段（确认后会被引擎拒绝）：\n'
            + bad.map(function (x) { return '- 第' + (x.i + 1) + '笔 path「' + x.path + '」：' + x.reason; }).join('\n')
            + '\n请用只读工具核实对象在档真名与真实字段路径·然后重新调用 submit_wentian（无问题的笔保持原样一并重提）。\n';
          trace.push('校验退回×' + bad.length);
          if (typeof opts.onProgress === 'function') { try { opts.onProgress('校验退回', round); } catch (_) {} }
          continue;
        }
        return { ok: true, result: submitted, trace: trace };
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
        var _cap = (c.name === 'get_dossier') ? 3600 : 1600;  // dossier 是聚合工具·1600 会砍掉维度汇总的价值
        transcript += '\n【工具·' + c.name + '】入参 ' + JSON.stringify(c.input || {}).slice(0, 240)
          + '\n结果：' + outText.slice(0, _cap) + '\n';
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
