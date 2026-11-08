#!/usr/bin/env node
/* eslint-env node */
'use strict';
// smoke-guoshi-polish — 国师重做 S5 的小毛病修缮（2026-10-15）：
//   Anthropic 地址以 /v1 结尾不再拼成 /v1/v1/messages；Gemini 连通检测报对线路；
//   体检不再对没有原生开局的剧本跑原生契约（那条检查会自己崩）；系统提示不再提不存在的 createEntity；
//   教训回喂、版本说明按剧本分开，版本说明以改动账为准（撤销过的不算）且不顶掉待审卡；
//   旧单线程迁移先写新后删旧；国师自查只把这次新带来的问题算「没成」；mock 能答连通自检与会话起名。
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const web = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(web, f), 'utf8');
const sources = ['editor-authoring-agent-provider.js', 'editor-authoring-agent.js'].map(f => [f, read(f)]);
const core = sources[1][1], icons = read('editor-authoring-agent-ui-icons.js'), ui = read('editor-authoring-agent-ui.js'), render = read('editor-authoring-agent-ui-render.js'), mock = read('scripts/mock-llm-guoshi.js');
function fixture(fetcher) {
  const c = { console, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, TextDecoder, TextEncoder, Uint8Array, Response, ReadableStream, Headers, setTimeout, clearTimeout, fetch: fetcher };
  c.window = c; vm.createContext(c); sources.forEach(([file, source]) => vm.runInContext(source, c, { filename: file }));
  return c.TM.AuthoringAgent;
}
const json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ FAIL: ' + name + '\n' + e.stack); } }
console.log('smoke-guoshi-polish');
(async () => {
  await test('Anthropic：各种地址写法都只拼出一个 /v1/messages，并带网页直连头', async () => {
    const seen = [];
    const aa = fixture(async (url, o) => { seen.push({ url, h: o.headers }); return json({ content: [{ type: 'tool_use', id: 't', name: 'finish', input: { summary: '好' } }], stop_reason: 'tool_use' }); });
    for (const u of ['https://api.anthropic.com', 'https://api.anthropic.com/', 'https://api.anthropic.com/v1', 'https://api.anthropic.com/v1/', 'https://api.anthropic.com/v1/messages']) {
      await aa.callWithTools('测', [{ name: 'finish', parameters: { type: 'object' } }], { cfg: { url: u, key: 'k', model: 'claude-x' }, maxRetries: 0 });
    }
    seen.forEach(s => assert.equal(s.url, 'https://api.anthropic.com/v1/messages'));
    assert.equal(seen[0].h['anthropic-dangerous-direct-browser-access'], 'true');
  });
  await test('Gemini 原生连通检测报「gemini」，不再说成 OpenAI 兼容', async () => {
    const aa = fixture(async () => json({ candidates: [{ content: { parts: [{ functionCall: { name: 'ping', args: { ok: true } } }] }, finishReason: 'STOP' }] }));
    const r = await aa.testConnection({ cfg: { url: 'https://generativelanguage.googleapis.com/v1beta', key: 'k', model: 'gemini-x' } });
    assert.equal(r.ok, true); assert.equal(r.provider, 'gemini');
  });
  await test('体检：没有原生开局的剧本不跑原生契约，不再报「检查异常」', async () => {
    const AA = require(path.join(web, 'editor-authoring-agent.js'));
    const r = AA.preflight(AA.makeDraft({ name: '甲', characters: [{ name: '乙' }] }));
    assert.deepEqual([].concat(r.blockers, r.warnings).filter(x => /检查异常/.test(x)), []);
    assert.equal(r.results['native-start'], undefined);
    assert.match(core, /var groups = Object\.keys\(_checks\)\.filter\(function\(g\) \{ return g !== 'native-start' \|\| !!\(draft && draft\.nativeStart\); \}\);/);
  });
  await test('系统提示不再提不存在的 createEntity', async () => {
    assert.doesNotMatch(core, /createEntity/);
  });
  await test('教训回喂、版本说明按剧本分开', async () => {
    assert.match(ui, /fileKey: _fileKey\(\),   \/\/ 教训回喂与版本说明按剧本分开/);
    assert.match(ui, /var h = \(_loadHistory\(\) \|\| \[\]\)\.filter\(function \(r\) \{ return r && r\.fileKey && r\.fileKey === fk; \}\);/);
    assert.match(ui, /return r\.fileKey === fk && _CHANGE_KINDS\[r\.kind\]/);
  });
  await test('版本说明以改动账为准：撤销过的不算；只读信息卡不顶掉待审卡', async () => {
    const m = ui.match(/function runChangelogUI\(\) \{[\s\S]*?\n  \}\n/)[0];
    assert.match(m, /L\.list\(_fileKey\(\), _fileLabel\(\)\)/); assert.match(m, /filter\(function \(e\) \{ return !e\.undone; \}\)/);
    assert.match(m, /_infoCard\('版本说明'/); assert.doesNotMatch(m, /resetResults|_beginReplyCard|buildChangelog/, '不拿运行记录兜底（它不知道哪些撤销了）');
    assert.match(m, /都已撤销，没有要写进版本说明的/);
    // 拼法本身：一行一次，附上动了谁
    const src = ui.match(/function _changelogFromLedger\(ents\) \{[\s\S]*?\n  \}\n/)[0];
    const fn = new Function('__aaU', src + '; return _changelogFromLedger;')({ _COLL_CN: { characters: '人物' } });
    const cl = fn([{ summary: '改了三处：\n\n- **袁崇焕**：官职', names: [{ op: 'chg', top: 'characters', name: '袁崇焕' }, { op: 'add', top: 'characters', name: '文震孟' }] }, { request: '补个事件', names: [] }]);
    assert.equal(cl.count, 2);
    assert.equal(cl.text, '## 本次更新\n\n- 改了三处： 袁崇焕：官职（修改人物「袁崇焕」、新增人物「文震孟」）\n- 补个事件');
  });
  await test('旧单线程迁移：先写新后删旧，读不懂/写不进时旧记录留着', async () => {
    const m = ui.match(/function _migrateLegacyThread\(\) \{[\s\S]*?\n  \}\n/)[0];
    assert(m.indexOf('localStorage.setItem(SESS_BODY + id') < m.lastIndexOf('localStorage.removeItem(THREAD_KEY)'), '写新在删旧之前');
    assert.match(m, /try \{ pack = JSON\.parse\(raw\); \} catch \(e0\) \{ return; \}/);
    assert.match(m, /if \(!_sessIndex\(\)\.some\(function \(m\) \{ return m && m\.id === id; \}\)\) return;/);
  });
  await test('国师自查按开工时的剧本比，只把新问题算「没成」', async () => {
    assert.match(render, /if \(step\.name === 'validateDraft' && r\.ok === false && Array\.isArray\(r\.violations\)\) \{ try \{ dl = validationDelta\(r\); \}/);
    assert.match(render, /var bad = dl \? !dl\.ok : r\.ok === false;/);
    assert.match(render, /'校验：没有新问题' \+ \(dl\.old\.length \? '（剧本原有 ' \+ dl\.old\.length \+ ' 处提示）' : ''\)/);
  });
  await test('收尾那一步的一行摘要不露 Markdown 记号', async () => {
    assert.match(render, /case 'finish': return '收尾：' \+ _shortVal\(String\(i\.summary \|\| ''\)\.replace\(/);
  });
  await test('版面：面板开着时启动钮收起；展开时印章不被撑成长条；出错后两颗恢复键不小于 36px', async () => {
    assert.match(icons, /'body:has\(#tm-aa-panel\.open\) #tm-aa-fab\{display:none\}'/);
    assert.match(icons, /\.fs \.tm-aa-empty>\*:not\(\.emp-seal\)\{max-width:860px/);
    assert.match(icons, /'\.tm-aa-recovery-actions button\{height:36px\}'/);
  });
  await test('桌面版回归认的字眼都在（任务未完成 / 继续未完成 / 确认应用部分 / 仍有未完成项 / 冲突 / 已应用到剧本 / 完成 / 已自动修复·丢弃 / 批准并执行）', async () => {
    assert.match(ui, /'停下了，任务未完成' : \(status === 'partial' \? '只完成了一部分' : '任务未完成'\)/);
    assert.match(ui, /\(ui\._recovery \? '继续未完成的部分' : '再试一次'\)/);
    assert.match(ui, /ui\.els\.apply\.textContent = '再点一下：确认应用部分结果';/);
    assert.match(ui, /\(unfinished \? '，任务仍有未完成项' : ''\)/);
    assert.match(ui, /setStatus\('和你的手工改动冲突：/);
    assert.match(ui, /setStatus\('已应用到剧本：' \+ _accN \+ ' 处'/);
    assert.match(ui, /var body = head \|\| '完成了';/);
    assert.match(ui, /'，已自动修复 ' \+ _fixN \+ ' 条格式不对的条目' \+ \(_dropN \? '、丢弃 ' \+ _dropN/);
    assert.match(ui, /ui\.els\.apply\.textContent = '批准并执行';/);
  });
  await test('mock 能答连通自检与会话起名', async () => {
    assert.match(mock, /if \(has\('ping'\)\) return \[tc\('ping', \{ ok: true \}\)\];/);
    assert.match(mock, /if \(has\('setTitle'\)\) \{/);
  });
  console.log('\nsmoke-guoshi-polish ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
  process.exit(fail === 0 ? 0 : 1);
})();
