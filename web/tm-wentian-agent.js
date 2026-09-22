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
  var READ_TOOL_NAMES = ['get_overview', 'get_field', 'list_entities', 'inspect_entity', 'search_save', 'get_relations', 'get_dossier', 'read_world'];

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
        operations: { type:'array', description:'可实际执行的游戏修改；确认时逐项写入。天意创建党派等实体必须提交操作，不能仅写 plan。', items:{type:'object',properties:{tool:{type:'string'},input:{type:'object'},reason:{type:'string'}},required:['tool','input','reason']} },
        hardChanges: {
          type: 'array',
          description: '兼容旧式数值修改；与 operations 二选一，不能同时提交，以免同一笔修改重复执行。新实体和复杂联动优先全部放进 operations。path 用真实字段路径，先用工具核实对象与现值。',
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
        edictText: { type: 'string', description: '仅当玩家要求拟诏或按君主诏令施行时填写正式诏令措辞。直接修改或创建游戏实体应提交 operations，不得用未执行的诏令草案冒充已经修改。' },
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
  function _validateSubmit(result, content) {
    var bad = [];
    var hcs = (result && Array.isArray(result.hardChanges)) ? result.hardChanges : [];
    var operations=Array.isArray(result.operations)?result.operations:[],writer=TM.Endturn&&TM.Endturn.AgentWriteTools;
    if(operations.length&&hcs.length)bad.push({i:0,path:'operations',reason:'operations 与 hardChanges 不能重复提交；请将全部修改合并为一组 operations，旧式修改可转换为 edit_world'});
    operations.forEach(function(op,i){if(!writer||!op||!writer.isToolName(op.tool)||!op.input||typeof op.input!=='object'||Array.isArray(op.input)||!op.reason)bad.push({i:i,path:op&&op.tool||'',reason:'须提供实际已注册的修改工具、参数和依据'});});
    if(result.category==='absolute'&&/(成立|创建|新建|建立|设立|组建).*(党派|党|势力|军队|阶层|人物)/.test(content||'')&&!operations.length&&!hcs.length)bad.push({i:0,path:'operations',reason:'天意造物必须提交 edit_world 等实际修改操作，不能仅口头承诺'});
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
      if (Number.isSafeInteger(n) && n >= 1) return n;
    } catch (_) {}
    return 6;
  }

  // run(content, opts) → { ok, result(submit_wentian input), trace:[工具名] } | { ok:false }
  //   opts: { teaching(教学核心文本·与单发同源), ctx(剧本/回合/已有规则), forceHint, onProgress(toolName, round) }
  async function run(content, opts) {
    opts = opts || {};
    var owner=root.GM,player=root.P,generation=root._tmLoadGen||0,turn=owner&&owner.turn;
    function current(){return root.GM===owner&&root.P===player&&(root._tmLoadGen||0)===generation&&(!owner||owner.turn===turn);}
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
    if(TM.AgentWorldEditor&&!tools.some(function(d){return d.name==='read_world';}))tools.push({name:'read_world',description:'读取任意游戏业务字段；path为空列出顶层数据，支持按实体名称/ID寻址及offset分页。',parameters:{type:'object',properties:{path:{type:'string'},offset:{type:'integer'},length:{type:'integer'}}}});
    if(TM.AgentWorldEditor)tools.push({name:'preview_world',description:'在隔离世界中预检一组edit_world操作，按顺序验证新增实体和依赖；不修改当前游戏。',parameters:{type:'object',properties:{operations:SUBMIT_TOOL.parameters.properties.operations},required:['operations']}});

    var transcript = '你是天命AI推演系统的元指令裁定官（agent 模式）。玩家对「问天」通道说了一条指令。\n'
      + '你的职责：①先用只读工具查证——指令涉及的人/军/阶层/党派/势力/区划在档真名是什么、现值多少（玩家可能写错字、用绰号、记错现状）；'
      + '②查证足够后调用 submit_wentian 提交裁定。宁可先查一两手·不要凭空猜路径与数值。\n'
      + '【裁定教学】\n' + String(opts.teaching || '') + '\n'
      + (opts.ctx ? '【上下文】\n' + opts.ctx + '\n' : '')
      + (opts.forceHint ? opts.forceHint + '\n' : '')
      + '【玩家指令】\n' + content + '\n';
    var writer=TM.Endturn&&TM.Endturn.AgentWriteTools;
    if(writer)transcript+='【可执行修改工具】'+JSON.stringify(writer.defs())+'\n将修改放入 submit_wentian.operations（tool/input/reason），确认前不执行。天意允许创造新实体和修改全部游戏业务内容；新党派用 edit_world，operation=append、path=parties、value={name,leader,members,ideology,...}。名册没有该党派不是拒绝理由，可按指令成立空的新党组织，再补成员。已有实体不得另造同名副本。set_field 的领域限制可改用对应领域工具，或 edit_world 完成明确的控制台修改。\n';

    transcript+='【完整控制台能力】不局限于党派：人物 chars、势力 facs、阶层 classes、军队 armies 都可 append 新建，或按名称/ID set、merge、remove；未知业务字段也可创建。read_world 可查询任意世界数据，preview_world 可验证整组 edit_world 操作及先建人物再建势力/军队等依赖。天意是直接改写世界状态，不受政治可行性、人物历史出场时间、原始名册或普通工具白名单限制；输入仍须满足游戏数据形状，使用真实ID且各联动字段相符。不能只写推演建议；必须形成可执行操作并读回结果。需要新阶层用 classes，不要误写到 parties；新军用 armies，兵力、主帅、所属势力与位置应明确。普通募兵走 command_army；天意直接给定兵额用 edit_world，不隐含额外支出。';
    var trace = [];
    var maxR = _maxRounds();
    for (var round = 1; round <= maxR; round++) {
      if(!current())return {ok:false,error:'world-changed'};
      var forceLast = (round === maxR);
      var resp;
      try {
        resp = await root.callAIWithTools(transcript, tools, {
          maxTok: 4096,
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
      if(!current())return {ok:false,error:'world-changed'};
      if(resp&&resp.error&&resp.error.code==='aborted')return {ok:false,error:'cancelled'};
      var submitted = null;
      for (var s = 0; s < calls.length; s++) {
        if (calls[s] && calls[s].name === 'submit_wentian' && calls[s].input) { submitted = calls[s].input; break; }
      }
      if (submitted) {
        if(opts.forceCategory)submitted.category=opts.forceCategory;
        // submit 校验回路（2026-07-10 刀②）：hardChange 档解析不到真实字段的笔=确认后必落幽灵键闸被拒——
        // 还有轮次就把校验报告喂回·逼 AI 用工具核实真名后重提；轮尽仍坏→照常返回(确认框红标兜底·玩家裁决)。
        var bad = _validateSubmit(submitted, content);
        if(!bad.length&&TM.AgentWorldEditor&&Array.isArray(submitted.operations)&&submitted.operations.length&&submitted.operations.every(function(op){return op.tool==='edit_world';})){
          var preview=TM.AgentWorldEditor.preview(root.GM,submitted.operations);
          if(!preview.ok)bad.push({i:preview.index||0,path:'operations',reason:preview.reason});
        }
        if (bad.length && round < maxR) {
          transcript += '\n【submit 校验·未通过】你提交的修改方案有 ' + bad.length + ' 项未通过预检（须修正后再提交）：\n'
            + bad.map(function (x) { return '- 第' + (x.i + 1) + '笔 path「' + x.path + '」：' + x.reason; }).join('\n')
            + '\n请用只读工具核实对象在档真名与真实字段路径·然后重新调用 submit_wentian（无问题的笔保持原样一并重提）。\n';
          trace.push('校验退回×' + bad.length);
          if (typeof opts.onProgress === 'function') { try { opts.onProgress('校验退回', round); } catch (_) {} }
          continue;
        }
        if(bad.length&&(Array.isArray(submitted.operations)&&submitted.operations.length||submitted.category==='absolute'))return {ok:false,error:bad.map(function(x){return x.reason;}).join('；')};
        return { ok: true, result: submitted, trace: trace };
      }
      // 执行只读工具（≤4/轮）·结果滚入 transcript 续轮
      var used = 0;
      for (var i = 0; i < calls.length && used < 4; i++) {
        var c = calls[i];
        if (!c || !c.name || c.name === 'submit_wentian') continue;
        var out;
        try {
          if(c.name==='read_world'&&TM.AgentWorldEditor)out={text:JSON.stringify(TM.AgentWorldEditor.inspect(root.GM,c.input))};
          else if(c.name==='preview_world'&&TM.AgentWorldEditor)out={text:JSON.stringify(TM.AgentWorldEditor.preview(root.GM,c.input&&c.input.operations||[]))};
          else out = await rt.handle(c.name, c.input || {}, { GM: root.GM, P: root.P });
        }
        catch (eTool) { out = { ok: false, text: '(工具异常:' + ((eTool && eTool.message) || eTool) + ')' }; }
        var outText = (out && typeof out === 'object') ? String(out.text || '') : String(out || '');
        var _cap = /^(read_world|preview_world)$/.test(c.name) ? 9000 : (c.name === 'get_dossier') ? 3600 : 1600;
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

  function applyOperations(p){
    var writer=TM.Endturn&&TM.Endturn.AgentWriteTools;
    var guards=root.AIChangeApplier&&root.AIChangeApplier.writeGuards,receipts=[];
    function execute(){receipts=(p.operations||[]).map(function(op){
      if(!writer||!op||!writer.isToolName(op.tool)||!op.input||typeof op.input!=='object')return {ok:false,tool:op&&op.tool,reason:'修改工具或参数无效'};
      var result;try{result=writer.handleSync(op.tool,Object.assign({},op.input,{reason:op.reason||p.raw}),{GM:root.GM,P:root.P,meta:{enforceSemanticWrites:true,authority:'wentian'}});}catch(e){return {ok:false,tool:op.tool,reason:e.message};}
      return {ok:!!result.ok,tool:op.tool,path:result.path,reason:result.text,changed:result.changed,result:result.result};
    });return {ok:receipts.every(function(r){return r.ok;}),reason:receipts.filter(function(r){return !r.ok;}).map(function(r){return r.reason;}).join('；')};}
    var applied=guards?guards.runAtomicMutation(execute):execute();
    if(!applied.ok&&applied.rolledBack)receipts.forEach(function(r){r.ok=false;r.changed=false;r.rolledBack=true;r.reason='本组修改已回滚：'+applied.reason;});
    return receipts;
  }
  TM.WentianAgent = { run: run, enabled: enabled, applyOperations:applyOperations, SUBMIT_TOOL: SUBMIT_TOOL, READ_TOOL_NAMES: READ_TOOL_NAMES.slice() };
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.WentianAgent;
})(typeof window !== 'undefined' ? window : globalThis);
