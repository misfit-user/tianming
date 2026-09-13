#!/usr/bin/env node
'use strict';
/* smoke-ai-err-human — 失败态人话化（2026-07-02）
 * 背景：过回合 catch/设置探测把 error.message 原文甩给玩家（"HTTP 401: {...}"），新手无从下手。
 * 本刀：tm-ai-infra.js 增 _tmAiErrHuman 分类器（认得出→人话+去哪修·认不出→null 回退原文），
 * 接 tm-endturn-core.js 过回合 catch + tm-player-settings.js 两处探测 catch。
 */
const fs = require('fs');
const path = require('path');
const W = path.join(__dirname, '..');

let A = 0, F = 0;
function ok(cond, msg) { if (cond) { A++; console.log('  ✓ ' + msg); } else { F++; console.log('  ✗ ' + msg); } }

// ── 提取真函数 ──
const infraSrc = (fs.readFileSync(path.join(W, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(W, 'tm-ai-infra.js'), 'utf8'));
const fnStart = infraSrc.indexOf('function _tmAiErrHuman(err)');
ok(fnStart > 0, 'tm-ai-infra.js 含 _tmAiErrHuman 定义');
let depth = 0, fnEnd = -1;
for (let i = infraSrc.indexOf('{', fnStart); i < infraSrc.length; i++) {
  if (infraSrc[i] === '{') depth++;
  else if (infraSrc[i] === '}') { depth--; if (depth === 0) { fnEnd = i + 1; break; } }
}
const fn = (0, eval)('(' + infraSrc.slice(fnStart, fnEnd) + ')');

function mkErr(msg, status, name) { const e = new Error(msg); if (status) e.status = status; if (name) Object.defineProperty(e, 'name', { value: name }); return e; }

// ① 密钥类
ok(/密钥无效/.test(fn(mkErr('HTTP 401: {"error":{"message":"Incorrect API key provided"}}', 401)) || ''), '① 401(status) → 密钥无效+指路设置');
ok(/密钥无效/.test(fn(mkErr('HTTP 401: Unauthorized')) || ''), '① 401(仅message) → 同样命中');
ok(/尚未配置/.test(fn(mkErr('API未配置')) || ''), '① 未配置 → 指路设置填写');
// ② 额度/权限
ok(/额度不足|欠费/.test(fn(mkErr('HTTP 402: insufficient_quota', 402)) || ''), '② 402 → 额度不足');
ok(/额度不足|欠费/.test(fn(mkErr('You exceeded your current quota, please check your plan')) || ''), '② quota 文案 → 额度不足');
ok(/拒绝访问/.test(fn(mkErr('HTTP 403', 403)) || ''), '② 403 → 拒绝访问');
// ③ 模型/路径
ok(/模型名不存在|核对 API 地址/.test(fn(mkErr('HTTP 404: model "gpt-x" not found', 404)) || ''), '③ 404 → 核对地址与模型名');
ok(/模型名不存在|核对 API 地址/.test(fn(mkErr('The model `abc` does not exist')) || ''), '③ does not exist 文案命中');
// ④ 限速/服务端
ok(/限速/.test(fn(mkErr('HTTP 429: rate limit', 429)) || ''), '④ 429 → 限速');
ok(/服务端故障/.test(fn(mkErr('HTTP 502: Bad Gateway', 502)) || ''), '④ 5xx → 服务端故障');
// ⑤ 超时/网络
ok(/超时/.test(fn(mkErr('The user aborted a request.', 0, 'AbortError')) || ''), '⑤ AbortError → 超时');
ok(/超时/.test(fn(mkErr('Request timeout after 600s')) || ''), '⑤ timeout 文案 → 超时');
ok(/网络不可达/.test(fn(new TypeError('Failed to fetch')) || ''), '⑤ Failed to fetch → 网络不可达');
// ⑥ 解析/截断
ok(/解析失败|更强模型/.test(fn(mkErr('Unexpected token < in JSON at position 0')) || ''), '⑥ JSON 解析 → 建议换强模型');
// ⑦ 认不出 → null（调用方回退原文·不吞信息）
ok(fn(mkErr('some totally unknown weird failure')) === null, '⑦ 未知错误返回 null');
ok(fn(null) === null, '⑦ null 入参安全');
// ⑧ 429 但有 status 属性缺 message 数字也命中
ok(/限速/.test(fn(mkErr('Too Many Requests', 429)) || ''), '⑧ status 属性独立于 message 生效');

// ── 消费点契约 ──
const coreSrc = fs.readFileSync(path.join(W, 'tm-endturn-core.js'), 'utf8');
ok(/_tmAiErrHuman/.test(coreSrc) && /回合中断/.test(coreSrc), '⑨ 过回合 catch 已接分类器(回合中断·人话)');
ok(/回合处理出错/.test(coreSrc), '⑨ 认不出仍回退原文路径保留');
const psSrc = fs.readFileSync(path.join(W, 'tm-player-settings.js'), 'utf8');
ok((psSrc.match(/_tmAiErrHuman/g) || []).length >= 2, '⑩ 设置两处探测 catch 已接分类器');
ok(/window\._tmAiErrHuman = _tmAiErrHuman/.test(infraSrc), '⑪ 分类器挂 window 供跨文件共用');

console.log('\n' + (F === 0 ? 'ALL PASS' : 'FAIL') + ' (' + A + ' pass / ' + F + ' fail)');
process.exit(F === 0 ? 0 : 1);
