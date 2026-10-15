#!/usr/bin/env node
/* eslint-env node */
'use strict';

// 本地 mock LLM 中转 —— 补回 demo-guoshi.html 预置的 127.0.0.1:8799。
// OpenAI 兼容 /v1/chat/completions：按国师 loop 的模式（作者/审阅/问答/讲解/计划）与会审角色（史官/谏官）
// 返回合理 tool_calls，让「生成 / 审阅 / 🏛️三堂会审」的完整 UI 在本地浏览器跑起来。
// 这是 mock 行为（非真智能），用于验 UI 流程渲染（进度清单 / 两官报告 / diff / 应用审）。
//
// 用法：node scripts/mock-llm-guoshi.js   （监听 127.0.0.1:8799），再开 demo-guoshi.html。
//
// 演示剧本（2026-10-15 国师重做时补，只认需求里的关键字，别的照旧）：
//   「演示」  查人 → 改袁崇焕官职 + 补两位文官 → 校验 → 收尾，每轮带一句旁白
//   「请教」  先问你两个问题（askClarification）
//   「长文」  收尾说明很长（标题、列表、表格、代码），看排版
//   「报错」  回 401，看错误卡
// 环境变量 MOCK_DELAY_MS=毫秒：每次回复前等一会儿，好截「运行中」。
// 请求带 stream:true 时回 OpenAI 事件流（带想法 reasoning_content），MOCK_STREAM_MS 调吐字快慢。

const http = require('http');
const PORT = 8799;
const DELAY = Math.max(0, Number(process.env.MOCK_DELAY_MS || 0) || 0);

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
const CORS_JSON = Object.assign({ 'Content-Type': 'application/json' }, CORS);

let _seq = 0;
function tc(name, input) { return { id: 'call_' + (++_seq) + '_' + name, type: 'function', function: { name: name, arguments: JSON.stringify(input) } }; }

// 按 loop 当前模式/阶段决定返回哪些 tool_calls（mock 行为，够推进流程 + 展示各刀 UI）
function decide(messages, toolNames, allText, userText) {
  const has = function (n) { return toolNames.indexOf(n) >= 0; };
  const aTurns = messages.filter(function (m) { return m.role === 'assistant'; }).length;
  const didMutate = messages.some(function (m) { return m.role === 'assistant' && /applyPush|applyEdit|multiEdit|bulkAdd/.test(JSON.stringify(m.tool_calls || [])); });

  // ── 连通性自检 / 会话起名（设置里「测试连接」、跑完自动起标题）──
  if (has('ping')) return [tc('ping', { ok: true })];
  if (has('setTitle')) {
    const req = (/玩家需求：([^\n]*)/.exec(userText) || [])[1] || '';
    const t = req.replace(/^(演示|请教|长文|报错)[：:]\s*/, '').replace(/[，。,.!！?？].*$/, '').slice(0, 12);
    return [tc('setTitle', { title: t || '剧本编辑' })];
  }

  // ── 审阅模式（史官 / 谏官 / 通用体检）──
  if (has('submitReview')) {
    if (/史官/.test(allText)) return [tc('submitReview', { summary: '（mock·史官）史实大体可考，一处纪年需复核', findings: [{ dimension: '史实合理性', severity: '中', location: '新增人物', issue: '任职年份与设定时代纪年可能错位', suggestion: '核对正史纪年；拿不准改保守措辞并标存疑' }] })];
    if (/谏官/.test(allText)) return [tc('submitReview', { summary: '（mock·谏官）整体可玩，留意一处强弱', findings: [{ dimension: '平衡性', severity: '低', location: '新增势力', issue: '初始资源略高于同类势力', suggestion: '下调一档，与既有势力齐平' }] })];
    return [tc('submitReview', { summary: '（mock）体检完成，无重大阻塞', findings: [{ dimension: '内容缺口', severity: '低', location: '整体', issue: '部分人物缺 AI 人格', suggestion: '补 aiPersona 让其在推演里有行为' }] })];
  }
  if (has('submitAnswer')) return [tc('submitAnswer', { answer: '（mock）基于剧本数据的回答：当前剧本结构正常。' })];
  if (has('submitExplanation')) return [tc('submitExplanation', { summary: '（mock）剧本讲解总览。', points: [{ topic: '核心看点', detail: '（mock）讲解要点。' }] })];
  if (has('proposePlan')) return [tc('proposePlan', { summary: '（mock）改动计划', steps: ['第一步（mock）', '第二步（mock）'] })];

  // ── 作者模式 ──
  // 演示剧本只看这一句话之后的回合（同一段对话里接着说时，前面几轮不算）
  var lastUser = -1; messages.forEach(function (m, i) { if (m.role === 'user') lastUser = i; });
  const turnsSince = messages.slice(lastUser + 1).filter(function (m) { return m.role === 'assistant'; }).length;
  const d = demo(messages.slice(lastUser + 1), has, turnsSince, userText);
  if (d) return d;
  const m = mapDemo(messages.slice(lastUser + 1), has, turnsSince, userText);
  if (m) return m;
  const w = webDemo(messages.slice(lastUser + 1), has, turnsSince, userText);
  if (w) return w;
  // 会审修订阶段
  if (/三堂会审[··].*修订|据.*意见.*修订/.test(userText)) {
    if (!didMutate && has('applyEdit')) return [tc('applyEdit', { path: 'worldSettings.note', value: '（mock）已据史官·谏官意见修订：纪年改保守措辞、新势力资源下调一档' })];
    return [tc('finish', { summary: '（mock）已逐条采纳两官意见并修订完成' })];
  }
  // 刀1：明显硬伤 → 进谏（仅首轮）
  // 硬伤信号须「需求级」且不撞历史叙述常用词——国师把剧本已有内容当 exemplars 塞进 user，
  // 范例里「灭亡/歼灭」等历史词若被匹配会误触发进谏。故收窄为现代器物 + 明确的开局清零指令。
  if (aTurns === 0 && has('remonstrate') && /AK\s*-?\s*47|步枪|坦克|冲锋枪|机枪|火箭炮|导弹|核弹|核武器|战斗机|航空母舰|手机|互联网/.test(userText)) {
    return [tc('remonstrate', { concern: '该需求含明显硬伤：时代错置的器物，或令某方开局即灭的设定，会破坏硬核可信与可玩性', severity: '史实', suggestion: '改用契合时代的设定（如冷兵器名将）；势力存废给出可玩的博弈过程，而非开局直接清零' })];
  }
  // 刀2：涉及具体史实 → 先自核（首轮），再落字 + 标存疑
  var didCheck = messages.some(function (m) { return m.role === 'assistant' && /checkHistory/.test(JSON.stringify(m.tool_calls || [])); });
  if (!didCheck && has('checkHistory') && /生卒|生平|官职|年号|纪年|史实|张居正|海瑞|戚继光|某位历史/.test(userText)) {
    return [tc('checkHistory', { facts: [{ claim: '该人物的生卒年与最高官职', verdict: '存疑', note: '（mock）需正史核对，先标存疑' }] })];
  }
  // 已动过手 → 收尾
  if (didMutate || aTurns >= 2) return [tc('finish', { summary: '（mock）本次改动已完成' })];
  // 实质改动：加一个势力 + 一名人物（+ 对没把握处标存疑）
  const out = [];
  if (has('applyPush')) {
    out.push(tc('applyPush', { path: 'factions', value: { name: '东林文官集团', leader: '顾宪成', desc: '（mock）以江南士大夫清流为主的政治集团' } }));
    out.push(tc('applyPush', { path: 'characters', value: { name: '顾宪成', faction: '东林文官集团', office: '吏部文选司郎中', aiPersona: '（mock）清议领袖，重名节、好结党议政' } }));
  }
  if (has('flagUncertain')) out.push(tc('flagUncertain', { path: 'characters.顾宪成.office', reason: '（mock）具体任期年份需正史核对' }));
  return out.length ? out : [tc('finish', { summary: '（mock）暂无可改' })];
}

// 演示剧本：返回 tool_calls 数组（可带 .content 旁白）或 null
// 地图编辑器的国师（需求里带「地图：」）：检索地块 → （要改名就）改第一块 → 收尾
function mapDemo(messages, has, aTurns, userText) {
  if (!has('mapEditorOverview') || !/地图[：:]/.test(userText)) return null;
  let divs = [];
  for (let i = 0; i < messages.length; i++) {   // 取这句话之后第一次检索的结果（改名前的名字）
    if (messages[i].role !== 'tool') continue;
    try { const o = JSON.parse(messages[i].content); if (o && Array.isArray(o.divisions)) { divs = o.divisions; break; } } catch (e) {}
  }
  const rename = /改名为([^\s，。,.]+)/.exec(userText);
  if (aTurns === 0) return Object.assign([tc('mapEditorOverview', { limit: 20 })], { content: '先看看这张图上有哪些地块。' });
  if (rename && has('mapEditorEdit') && aTurns === 1 && divs.length) {
    return Object.assign([tc('mapEditorEdit', { edits: [{ id: divs[0].id, patch: { name: rename[1] } }] })], { content: '第一块是「' + divs[0].name + '」，照你说的改名。' });
  }
  const names = divs.slice(0, 12).map(function (x) { return x.name; }).filter(Boolean);
  return [tc('finish', { summary: rename
    ? '把「' + ((divs[0] && divs[0].name) || '第一块地') + '」改名为「' + rename[1] + '」，其余属性没动。'
    : (names.length ? '这张图上有 ' + divs.length + ' 块：' + names.join('、') + (divs.length > 12 ? ' 等' : '') + '。' : '这张图上还没有地块。') })];
}

// 「查证：X」：先上维基百科读 X（跳到「生平」），再据读到的收尾；玩家不许读或读不到就照实说
function webDemo(messages, has, aTurns, userText) {
  if (!/查证[：:]/.test(userText) || !has('webFetch')) return null;
  const subject = (/查证[：:]\s*([^\s，。,.的]+)/.exec(userText) || [])[1] || '袁崇焕';
  if (aTurns === 0) {
    return Object.assign([tc('webFetch', { url: 'https://zh.wikipedia.org/wiki/' + subject, find: '生平' })], { content: '先上维基百科查「' + subject + '」。' });
  }
  let res = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'tool') continue;
    try { res = JSON.parse(messages[i].content); } catch (e) {}
    break;
  }
  if (res && res.ok && res.text) {
    const body = String(res.text).split('\n').filter(function (l) { return l && !/^(网址|标题|来源)：|^（以下是网页内容|^#/.test(l); }).join(' ').slice(0, 110);
    return [tc('finish', { status: 'completed', summary: '查了维基百科「' + (res.title || subject) + '」：' + body + '……\n\n出处：' + res.url })];
  }
  return [tc('finish', { status: 'partial', summary: '没读到网页（' + ((res && res.reason) || '没有结果') + '），这次只能凭已有资料，要紧处我会标出来请你核。' })];
}

function demo(messages, has, aTurns, userText) {
  function say(text, calls) { calls = calls || []; calls.content = text; return calls; }
  if (/报错/.test(userText)) return { error: 401 };
  if (/请教/.test(userText) && aTurns === 0 && has('askClarification')) {
    return say('这事有两种改法，先问清楚再动手。', [tc('askClarification', { questions: ['新补的文官要放在中枢（六部、内阁）还是地方（布政司、府州）？', '要不要沿用东林、浙党这样的派系标签？'] })]);
  }
  if (/长文/.test(userText)) {
    return [tc('finish', { summary: '## 开局格局\n\n天启七年九月，**新君初立**，权阉当国。玩家要在三条线上同时用力：\n\n1. 内廷：魏忠贤一党把持司礼监与东厂；\n2. 外朝：东林余脉散在南北，阉党占着要津；\n3. 边事：辽东宁锦一线，后金虎视。\n\n### 几个关键数字\n\n| 项 | 数 | 说明 |\n|---|---:|---|\n| 太仓存银 | 80 万两 | 一年辽饷就要 500 万 |\n| 九边兵额 | 88 万 | 实额远低于此 |\n| 内帑 | 200 万两 | 可调，但要皇帝点头 |\n\n### 上手建议\n\n- 先稳住内廷，别急着动魏忠贤；\n- 辽东用人看`袁崇焕`、`孙承宗`两条线；\n- 财政先查**辽饷**与**矿税**。\n\n```json\n{ "startYear": 1627, "turnUnit": "月" }\n```' })];
  }
  if (!/演示/.test(userText)) return null;
  var toolMsgs = messages.filter(function (m) { return m.role === 'tool'; });
  var seen = toolMsgs.map(function (m) { return typeof m.content === 'string' ? m.content : JSON.stringify(m.content); }).join('\n');
  if (aTurns === 0 && has('searchEntities')) {
    return say('先看看袁崇焕眼下是什么官，再看主角势力里有哪些文官。', [tc('searchEntities', { collection: 'characters', query: '袁崇焕' }), tc('searchEntities', { collection: 'characters', query: '侍郎' })]);
  }
  if (aTurns === 1) {
    var first = toolMsgs[0] ? (typeof toolMsgs[0].content === 'string' ? toolMsgs[0].content : JSON.stringify(toolMsgs[0].content)) : '';
    var m = first.match(/"index":\s*(\d+)/) || seen.match(/characters\[(\d+)\]/);
    var idx = m ? +m[1] : 0;
    var calls = [];
    if (has('applyEdit')) calls.push(tc('applyEdit', { path: 'characters.' + idx + '.officialTitle', value: '兵部尚书兼右副都御史，督师蓟辽' }));
    if (has('applyPush')) {
      calls.push(tc('applyPush', { path: 'characters', value: { name: '文震孟', zi: '文起', faction: '明朝廷', officialTitle: '左春坊左中允', age: 53, gender: '男', birthplace: '苏州长洲', party: '东林', desc: '天启二年状元，以直谏忤魏忠贤，削籍归里，士林重其风节。', aiPersona: '刚直敢言，重名节，遇事必争，不善周旋。', wuchangOverride: { '仁': 68, '义': 74, '礼': 80, '智': 70, '信': 72 } } }));
      calls.push(tc('applyPush', { path: 'characters', value: { name: '郑三俊', zi: '用章', faction: '明朝廷', officialTitle: '南京户部右侍郎', age: 53, gender: '男', birthplace: '池州建德', party: '东林', desc: '为官清慎，留心钱谷，阉党当国时引疾不出。', aiPersona: '持重清廉，长于理财，不轻易表态。', wuchangOverride: { '仁': 76, '义': 66, '礼': 78, '智': 68, '信': 74 } } }));
    }
    if (has('flagUncertain')) calls.push(tc('flagUncertain', { path: 'characters.' + idx + '.officialTitle', reason: '加衔与督师的确切月份需核《崇祯长编》' }));
    return say('袁崇焕的官职按崇祯元年的任命改；文官补文震孟、郑三俊两位，都是东林一脉。', calls);
  }
  if (aTurns === 2 && has('validateDraft')) return say('改完自查一遍引用。', [tc('validateDraft', {})]);
  return [tc('finish', { summary: '改了三处：\n\n- **袁崇焕**：官职改为「兵部尚书兼右副都御史，督师蓟辽」（月份待核，已标出）；\n- 新增 **文震孟**（左春坊左中允，东林）；\n- 新增 **郑三俊**（南京户部右侍郎，东林）。\n\n两位新人的籍贯、表字、性格都按正史填了。' })];
}

function reply(res, toolCalls) {
  const msg = { role: 'assistant', content: (toolCalls && toolCalls.content) || '' };
  if (toolCalls && toolCalls.length) msg.tool_calls = toolCalls;
  res.writeHead(200, CORS_JSON);
  res.end(JSON.stringify({
    id: 'mock-' + (++_seq), object: 'chat.completion', model: 'mock-guoshi',
    choices: [{ index: 0, message: msg, finish_reason: (toolCalls && toolCalls.length) ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 60, total_tokens: 160 }
  }));
}

// 流式（国师重做 S4）：请求带 stream:true 时按 OpenAI 事件流一小段一小段吐——先想法（reasoning_content），
//   再旁白，再工具名与参数；末尾 finish_reason、用量、[DONE]。MOCK_STREAM_MS 调每段间隔（默认 25ms）。
const STREAM_MS = Math.max(0, Number(process.env.MOCK_STREAM_MS || 25) || 0);
function _thought(calls) {
  const names = (calls || []).map(function (c) { return c.function.name; });
  if (names.indexOf('webFetch') >= 0) return '这件事要核史实，凭记忆写容易错。先上维基百科读一读「生平」那段，再据实回你。';
  if (names.indexOf('finish') >= 0 && /维基百科|没读到网页/.test(String(calls[0].function.arguments || ''))) return '读到了。挑要紧的几句回给你，附上出处，你可以自己点开核。';
  if (names.indexOf('finish') >= 0) return '都改完、校验也过了。收尾要把改了什么、为什么这么改讲清楚：袁崇焕那条点明月份待核；两位新人说清出身和派系，免得读的人以为是随手编的。';
  if (names.indexOf('applyPush') >= 0 || names.indexOf('applyEdit') >= 0) return '查到了：袁崇焕眼下挂的还是旧衔。崇祯元年四月起复，加兵部尚书兼右副都御史、督师蓟辽——但确切月份各书说法不一，改完得标个待核。\n\n补文官要挑这一年真在朝或刚起复的东林人：文震孟、郑三俊都合适，得有表字、籍贯、性格和五常，不能是空壳。';
  if (names.indexOf('validateDraft') >= 0) return '改了一处、加了两人，自查一遍引用和必填字段。';
  if (names.indexOf('askClarification') >= 0) return '「再补几位文官」太宽了：补几位、哪一派、什么品级都没说。先问清楚再动手，免得白写。';
  if (names.indexOf('mapEditorEdit') >= 0) return '找到了要改的那块。地名照你说的改，势力归属、边界这些都不动。';
  if (names.indexOf('mapEditorOverview') >= 0) return '先把这张图上的地块列出来，拿到稳定的编号再动手——同名的地块不能凭名字猜。';
  if (names.indexOf('searchEntities') >= 0) return '先看剧本里现在是什么样，别凭印象改。袁崇焕在不在、挂的什么官；朝廷里已经有哪些文官，免得重名。';
  return '想一想从哪里下手。';
}
function _pieces(str, n) { const out = []; const a = Array.from(str || ''); for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n).join('')); return out; }
function streamReply(res, toolCalls, body) {
  const id = 'mock-' + (++_seq), frames = [];
  const frame = function (delta, finish) { return 'data: ' + JSON.stringify({ id: id, object: 'chat.completion.chunk', model: 'mock-guoshi', choices: [{ index: 0, delta: delta, finish_reason: finish || null }] }) + '\n\n'; };
  frames.push(frame({ role: 'assistant', content: '' }));
  _pieces(_thought(toolCalls), 3).forEach(function (p) { frames.push(frame({ reasoning_content: p })); });
  _pieces((toolCalls && toolCalls.content) || '', 2).forEach(function (p) { frames.push(frame({ content: p })); });
  (toolCalls || []).forEach(function (c, i) {
    frames.push(frame({ tool_calls: [{ index: i, id: c.id, type: 'function', function: { name: c.function.name, arguments: '' } }] }));
    _pieces(c.function.arguments, 6).forEach(function (p) { frames.push(frame({ tool_calls: [{ index: i, function: { arguments: p } }] })); });
  });
  frames.push(frame({}, (toolCalls && toolCalls.length) ? 'tool_calls' : 'stop'));
  if (body && body.stream_options && body.stream_options.include_usage) frames.push('data: ' + JSON.stringify({ id: id, object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 100, completion_tokens: 60, total_tokens: 160 } }) + '\n\n');
  frames.push('data: [DONE]\n\n');
  res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }, CORS));
  let k = 0;
  (function next() {
    if (k >= frames.length) { res.end(); return; }
    res.write(frames[k++]);
    setTimeout(next, STREAM_MS);
  })();
}

http.createServer(function (req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(200, CORS_JSON); res.end(JSON.stringify({ ok: true, hint: 'POST /v1/chat/completions' })); return; }
  let buf = '';
  req.setEncoding('utf8');   // 按流解码：请求体大了会分块，逐块转字符串会把块边界上的汉字切坏
  req.on('data', function (c) { buf += c; });
  req.on('end', function () {
    let body = {};
    try { body = JSON.parse(buf || '{}'); } catch (e) {}
    const messages = body.messages || [];
    const toolNames = (body.tools || []).map(function (t) { return t.function ? t.function.name : t.name; });
    const allText = JSON.stringify(messages);
    let userText = '';
    for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'user') { userText = typeof messages[i].content === 'string' ? messages[i].content : JSON.stringify(messages[i].content); break; } }
    let calls;
    try { calls = decide(messages, toolNames, allText, userText); }
    catch (e) { calls = [tc('finish', { summary: '（mock）decide 出错：' + (e && e.message) })]; }
    setTimeout(function () {
      if (calls && calls.error) {
        res.writeHead(calls.error, CORS_JSON);
        res.end(JSON.stringify({ error: { message: '（mock）Incorrect API key provided. 你填的 Key 不对或已失效。', type: 'invalid_request_error', code: 'invalid_api_key' } }));
        return;
      }
      if (body.stream === true) streamReply(res, calls, body); else reply(res, calls);
    }, DELAY);
  });
}).listen(PORT, '127.0.0.1', function () {
  console.log('[mock-llm-guoshi] listening on http://127.0.0.1:' + PORT + '/v1  · 国师 demo 可直接本地跑（Ctrl+C 停）');
});
