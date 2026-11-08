#!/usr/bin/env node
// 断处续 smoke：中转把 JSON 回答掐断（不论报什么结束原因）时，接着写、拼成完整 JSON；拼不出就交还原来的路。
// 写坏了的（括号对不上、引号没转义）不是被掐，不接；游戏原有的截断判断也不再把没转义的引号当成截断（11-08 真跑查出）。
// 设计稿 docs/llm-duanchu-xu-20261108.md（11-08 同志定：所有 JSON 子调用、默认开、最多接 3 次）。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };

function load(conf) {
  const c = { console: { log() {}, warn() {}, error() {} }, TM: {}, P: { conf: conf || {} } };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-ai-continuation.js'), 'utf8'), c, { filename: 'tm-ai-continuation.js' });
  return { C: c.TM.AIContinuation, ctx: c };
}
const { C, ctx } = load();
const reply = (content, finish) => ({ choices: [{ message: { content }, finish_reason: finish == null ? 'stop' : finish }] });

// ── 开关：默认开，显式 false 才关 ──
ok(C.enabled(), '默认开');
ctx.P.conf.aiContinueOnCut = false;
ok(!C.enabled(), 'P.conf.aiContinueOnCut === false 才关');
ctx.P.conf.aiContinueOnCut = true;
ok(load({}).C.enabled() && C.MAX_LINKS === 3, '最多接 3 次');

// ── 判「被掐」：只看回答本身 ──
ok(!C.isCut('{"a":1}'), '收了尾的不算');
ok(C.isCut('{"a":1,"b":[1,2'), '开了头没收尾');
ok(C.isCut('{"a":"阻止东林'), '断在字符串里');
ok(C.isCut('```json\n{"a":[{"b":1}'), '代码块标记开头的也认');
ok(!C.isCut('好的，以下是结果'), '纯文字不接');
ok(!C.isCut(''), '空回答不接（没有可接的半截）');
ok(!C.isCut('{"a":"}"}'), '字符串里的括号不算');
ok(C.isCut('{"a":"x\\"}'), '转义的引号不算收尾');
ok(C.isCut('{"a":1,"b":tr') && C.isCut('{"a":1.') && C.isCut('{"a":-'), '断在 true、数字半中间也认');
ok(C.isCut('{"a":"x\\') && C.isCut('{"a":"\\u4e'), '断在转义符半中间也认');
// 写坏了的不是被掐：接着写拼不出能解析的 JSON（11-08 auto-1108-1921 两次误接，各白发了一两次整份提示）
ok(!C.isCut('{"anomaly":{"detected":false,"moves":[[]}}'), '括号对不上（统筹思考写成 "moves":[[]}}）：不接');
ok(!C.isCut('{"tableEdit":"<!-- /INSERT -->"</tableEdit>","economic_advice":"赤字"}'), '引号没转义、已收尾（主推演写成 …-->"</tableEdit>"）：不接');
ok(!C.isCut('{"a":"x","b":"他说"好'), '已写的部分有没转义的引号：没收尾也不接（拼出来也解析不了）');

// ── 拼 ──
const s1 = C.stitch('{"a":"甲乙', '丙丁","b":2}');
eq(JSON.parse(s1.text), { a: '甲乙丙丁', b: 2 }, '半句接半句');
const s2 = C.stitch('{"a":"武之望接诏，即与胡廷', '即与胡廷宴交割。","b":2}');
ok(s2.how === 'overlap' && s2.overlap === 4, '去掉续写开头重复的 4 字');
eq(JSON.parse(s2.text), { a: '武之望接诏，即与胡廷宴交割。', b: 2 }, '去重叠后内容对');
const s3 = C.stitch('{"turn_summary":"x","events":[{"t":1}', '{"turn_summary":"x","events":[{"t":1},{"t":2}]}');
ok(s3.how === 'restart', '它从头重写了整个 JSON：用新写的');
eq(JSON.parse(s3.text).events.length, 2, '重写的那份完整');
const s4a = C.stitch('{"people":[{"who":"甲","mem":"太仓八万两"},{"who":"乙","mem":"国债之说', '{"who":"乙","mem":"国债之说，有失体统"}]}');
eq(JSON.parse(s4a.text), { people: [{ who: '甲', mem: '太仓八万两' }, { who: '乙', mem: '国债之说，有失体统' }] }, '续写把断掉的元素原样从头重写：当重叠去掉，两条都在、不重复');
const s4 = C.stitch('{"people":[{"who":"甲","mem":"太仓八万两"},{"who":"乙","mem":"国债之说', '{"who":"乙","feel":"算计","mem":"国债之说，有失体统"}]}');
ok(s4.how === 'backoff', '续写把断掉的元素改写了（多了一栏）：退回到这个元素开头');
eq(JSON.parse(s4.text), { people: [{ who: '甲', mem: '太仓八万两' }, { who: '乙', feel: '算计', mem: '国债之说，有失体统' }] }, '退回后两条都在、用改写的那条');
const s4k = C.stitch('{"a":{"x":1,"y":"半', '"y":"整句"},"b":2}');
ok(s4k.how === 'backoff', '续写从断掉的那个键重写：退回到这一项开头');
eq(JSON.parse(s4k.text), { a: { x: 1, y: '整句' }, b: 2 }, '退回后键不重复');
const s5 = C.stitch('{"a":1,"bc', 'd":2}');
eq(JSON.parse(s5.text), { a: 1, bcd: 2 }, '断在键名里也能接');
const s6 = C.stitch('{"a":1,"b":', ' [1,2]}');
eq(JSON.parse(s6.text), { a: 1, b: [1, 2] }, '断在冒号后');
const s7 = C.stitch('```json\n{"a":"x', 'y"}\n```');
ok(C.isCut(s7.text) === false, '续写末尾的代码块标记不碍事');
const s8 = C.stitch('{"a":[1,2,', '"坏"}]}');
ok(s8.broken, '拼不出结构对的：标记拼坏');
const s9 = C.stitch('{"a":1,"b":{"c":2', '"]}}');
ok(s9.broken, '不是键的续写不退进对象（11-08 实遇「"]}}」被当成新键收成 "]}}":null）');
const s10 = C.stitch('{"turn_summary":"x","e":[1', '{"turn_summary":"y","e":[[1}]}');
ok(s10.broken && s10.how !== 'restart', '从头重写的那份自己写坏了：不用它');

// 一份真实大小的 JSON 从中间切开、原样续写，拼出来要和原文一字不差
const big = { turn_summary: '新帝即位，清算权阉', events: [], char_updates: [], party_changes: [] };
for (let i = 0; i < 300; i++) big.events.push({ type: 'x', title: '事' + i, text: '诏令陕西赈济，户部拨银' + i + '万两，' + '阉党阻挠'.repeat(i % 5) });
for (let i = 0; i < 80; i++) big.char_updates.push({ name: '人' + i, loyalty_delta: i % 3 - 1, new_location: '京师·' + i });
big.party_changes.push({ name: '阉党', new_agenda: '维持权力,阻止东林党人' });
const full = JSON.stringify(big, null, 2);
for (const at of [0.37, 0.61, 0.93]) {
  const cut = Math.floor(full.length * at);
  const r1 = C.stitch(full.slice(0, cut), full.slice(cut));
  ok(r1.text === full, '原样续写拼回原文（切在 ' + Math.round(at * 100) + '%）');
  const r2 = C.stitch(full.slice(0, cut), full.slice(cut - 12));
  ok(r2.text === full && r2.overlap === 12, '续写开头重复 12 字也拼回原文（切在 ' + Math.round(at * 100) + '%）');
}

// ── 接着写的请求 ──
const body = { model: 'm', temperature: 0.7, max_tokens: 16000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] };
const b2 = C.buildBody(body, '{"a":"阻止东林');
ok(!('response_format' in b2) && b2.stream === false, '去掉 response_format（它会逼模型写完整对象）');
ok(b2.messages.length === 4 && b2.messages[2].role === 'assistant' && b2.messages[2].content === '{"a":"阻止东林', '助手那条是半截原文，一字不改');
ok(b2.messages[3].role === 'user' && /阻止东林/.test(b2.messages[3].content) && /不要重复已写的内容/.test(b2.messages[3].content), '用户那条点出断处、叫它接着写');
ok(body.messages.length === 2 && body.response_format, '原请求体不动');
ok(b2.model === 'm' && b2.max_tokens === 16000 && b2.temperature === 0.7, '模型、上限、温度照原请求');

// ── 接到完整为止 ──
(async () => {
  const script = (list) => { const calls = []; return { calls, fetch: async (b, n) => { calls.push({ n, b }); const x = list.shift(); if (x instanceof Error) throw x; return x; } }; };

  let f = script([reply('丙丁","b":2}')]);
  let r = await C.run({ body, raw: '{"a":"甲乙', fetch: f.fetch, id: 'sc1' });
  ok(r.ok && r.links === 1 && JSON.parse(r.text).b === 2, '接一次就完整');

  f = script([reply('丙丁","b":[1', 'length'), reply(',2]}')]);
  r = await C.run({ body, raw: '{"a":"甲乙', fetch: f.fetch });
  ok(r.ok && r.links === 2 && f.calls[1].b.messages[2].content === '{"a":"甲乙丙丁","b":[1', '接两次；第二次带的是拼好的半截');

  f = script([reply(''), reply('丙丁"}')]);
  r = await C.run({ body, raw: '{"a":"甲乙', fetch: f.fetch });
  ok(r.ok && r.links === 2 && r.pieces[0].how === 'empty', '续写回空一次：再试一次');

  f = script([reply(''), reply('  ')]);
  r = await C.run({ body, raw: '{"a":"甲乙', fetch: f.fetch });
  ok(!r.ok && r.err === 'empty' && f.calls.length === 2, '续写连着两次回空：不接了，交还原来的路');

  f = script([reply('一', 'length'), reply('二', 'length'), reply('三', 'length'), reply('"}')]);
  r = await C.run({ body, raw: '{"a":"', fetch: f.fetch });
  ok(!r.ok && r.links === 3 && f.calls.length === 3, '接 3 次仍没收尾：停，不接第 4 次');

  f = script([reply('丙丁"}\n以上为本回合结果。')]);
  r = await C.run({ body, raw: '{"a":"甲乙', fetch: f.fetch });
  ok(r.ok && r.text === '{"a":"甲乙丙丁"}', 'JSON 之后的闲话去掉');

  const netErr = new Error('HTTP 502'); netErr.code = 'HTTP_502';
  f = script([netErr]);
  r = await C.run({ body, raw: '{"a":"甲乙', fetch: f.fetch });
  ok(!r.ok && r.err === 'HTTP_502', '续写请求出错：交还原来的路');

  f = script([reply('"坏"}]}')]);
  r = await C.run({ body, raw: '{"a":[1,2,', fetch: f.fetch });
  ok(!r.ok && r.err === 'broken' && f.calls.length === 1, '拼坏了就停，不再白接');

  f = script([]);
  r = await C.run({ body, raw: '{"a":1}', fetch: f.fetch });
  ok(r.ok && r.links === 0 && f.calls.length === 0, '本来就完整的不接');

  f = script([reply('丙丁"}')]);
  r = await C.run({ body, raw: '{"a":"甲乙', fetch: f.fetch, deadlineAt: Date.now() - 1 });
  ok(!r.ok && r.err === 'deadline' && f.calls.length === 0, '过了总期限不接');

  ok(C.recent().length >= 9, '最近的断处续留诊断记录');

  // ── 接线 continueIfCut：拼好的就地写回原 data（应急恢复的记账认这个对象）；接着写另开记账 ──
  const sent = [], shown = [], diags = [], usage = [];
  ctx._aiFetchWithRetry = async (url, b, signal, o) => { sent.push({ url, b, o }); return { choices: [{ message: { content: '丙丁"}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 3 } }; };
  ctx.showLoading = (msg) => shown.push(msg);
  ctx.recordAIDiagnostic = (kind, p) => diags.push([kind, p]);
  ctx.TokenUsageTracker = { record: (u, id) => usage.push(id) };
  const d1 = reply('{"a":"甲乙', 'stop');
  const ticket = {}; d1._ticket = ticket;
  const o1 = await C.continueIfCut(body, d1, '{"a":"甲乙', { id: 'sc1', label: '结构化数据', url: 'U', key: 'K', tier: 'primary', priority: 'critical', timeoutMs: 1000 });
  ok(o1 === '{"a":"甲乙丙丁"}' && d1.choices[0].message.content === o1 && d1.choices[0].finish_reason === 'stop' && d1._ticket === ticket, '拼好的就地写回原 data 对象（同一个对象）');
  ok(sent.length === 1 && sent[0].url === 'U' && sent[0].o.id === 'sc1:cont1' && sent[0].o.maxRetries === 1 && sent[0].o.apiKey === 'K' && !('_normalRecoveryTicket' in sent[0].o), '接着写另开记账：id 记成 sc1:cont1、不带原调用的重试票');
  ok(shown.some((m) => /结构化数据被中转截断，正在从断处接着写（第1次）/.test(m)), '加载提示告诉玩家在接着写');
  ok(diags.some(([k, p]) => k === 'continuation' && p.ok && p.links === 1) && usage.includes('sc1:cont'), '记诊断、记用量');
  sent.length = 0;
  const d2 = reply('{"a":1}');
  ok(await C.continueIfCut(body, d2, '{"a":1}', { id: 'sc1', url: 'U' }) === '{"a":1}' && !sent.length, '完整的不接');
  ctx.P.conf.aiContinueOnCut = false;
  const d3 = reply('{"a":"甲乙', 'length');
  ok(await C.continueIfCut(body, d3, '{"a":"甲乙', { id: 'sc1', url: 'U' }) === '{"a":"甲乙' && !sent.length && d3.choices[0].finish_reason === 'length', '设置里关了就不接，原样往下走');
  ctx.P.conf.aiContinueOnCut = true;
  ctx._aiFetchWithRetry = async () => { throw new Error('HTTP 502'); };
  const d4 = reply('{"a":"甲乙', 'length');
  ok(await C.continueIfCut(body, d4, '{"a":"甲乙', { id: 'sc1', url: 'U' }) === '{"a":"甲乙' && d4.choices[0].message.content === '{"a":"甲乙' && d4.choices[0].finish_reason === 'length', '接不成：原 data 不动，交还原来的拒收、救援');

  // 写坏的不接：原样交原来的修复与重试，一次也不去要「接着写」
  const sent2 = [];
  ctx._aiFetchWithRetry = async (url, b, signal, o) => { sent2.push(o.id); return reply('}'); };
  for (const bad of ['{"anomaly":{"detected":false,"moves":[[]}}', '{"tableEdit":"<!-- /INSERT -->"</tableEdit>","economic_advice":"赤字"}']) {
    const d = reply(bad);
    ok(await C.continueIfCut(body, d, bad, { id: 'sc0', url: 'U' }) === bad && d.choices[0].message.content === bad, '写坏的原样交还：' + bad.slice(0, 20));
  }
  ok(sent2.length === 0, '写坏的一次也没去要接着写');

  // 加载提示：接完还给原来那句（拼不成时游戏整次重来，别让「正在接着写」一直挂着）；别的调用改过提示就不动
  const el = { textContent: '统筹思考' };
  ctx.document = { getElementById: (id) => (id === 'loading-sub' ? el : null) };
  ctx.showLoading = (msg) => { el.textContent = msg; };
  ctx._aiFetchWithRetry = async () => { throw new Error('HTTP 502'); };
  await C.continueIfCut(body, reply('{"a":"甲乙', 'length'), '{"a":"甲乙', { id: 'sc0', label: '统筹思考', url: 'U' });
  ok(el.textContent === '统筹思考', '接不成：加载提示还给原来那句');
  ctx._aiFetchWithRetry = async () => { el.textContent = '文事·势力·并行推演'; return reply('丙丁"}'); };
  await C.continueIfCut(body, reply('{"a":"甲乙', 'length'), '{"a":"甲乙', { id: 'sc0', label: '统筹思考', url: 'U' });
  ok(el.textContent === '文事·势力·并行推演', '接的时候别的调用改了提示：不动');

  const ai = fs.readFileSync(path.join(WEB, 'tm-endturn-ai.js'), 'utf8');
  const iHook = ai.indexOf('raw = await TM.AIContinuation.continueIfCut(body, data, raw');
  ok(iHook > ai.indexOf('async function _callEndturnAI(') && iHook > ai.indexOf('raw = data.choices[0].message.content') && iHook < ai.indexOf('var _RAW_CAP'), '_callEndturnAI 在拿到正文后、超大响应封顶之前接（封顶管拼好的全文）');
  ok(/c1 = await TM\.AIContinuation\.continueIfCut\(_sc1Body, data1, c1/.test(ai), '主推演流式那条路也接');
  // 游戏原有的截断判断 _looksJsonUnclosed：没转义的引号不再当成截断（11-08 主推演因此会被直接拒收、中止回合，连重试都不走）
  const fnAt = ai.indexOf('function _looksJsonUnclosed(text) {');
  const looks = new Function(ai.slice(fnAt, ai.indexOf('\n    }', fnAt) + 6) + '\nreturn _looksJsonUnclosed;')();
  ok(!looks('{"tableEdit":"<!-- /INSERT -->"</tableEdit>","economic_advice":"赤字"}'), '截断判断：引号没转义、已收尾的不算截断（交修复与重试）');
  ok(looks('{"a":"阻止东林') && looks('{"a":1,"b"') && looks('{"a":"x","b":"他说"好'), '截断判断：真被掐的照旧算截断');
  ok(!looks('{"a":"x\\"y","b":2}') && !looks('{"a":1}'), '截断判断：转义的引号、完整的照旧不算');
  const patches = fs.readFileSync(path.join(WEB, 'tm-patches.js'), 'utf8').replace(/\\'/g, "'");
  ok(/_togglePConf\('aiContinueOnCut',this\.checked\)/.test(patches), '设置面板有断处续开关');
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  const iCont = html.indexOf('tm-ai-continuation.js'), iAi = html.indexOf('tm-endturn-ai.js?');
  ok(iCont > 0 && iCont < iAi, 'index.html 登记了断处续模块，且在回合推演之前');

  console.log('smoke-ai-continuation: ' + checks + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
