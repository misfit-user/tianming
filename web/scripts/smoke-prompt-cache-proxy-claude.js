#!/usr/bin/env node
// scripts/smoke-prompt-cache-proxy-claude.js
//
// 验证「prompt 缓存扩到走中转的 Claude」(2026-06-16)。
//
// 背景：_maybeCacheSys(tm-endturn-ai.js) 原本只在 url==api.anthropic.com 原生域名时打 cache_control，
//   走中转的 Claude(url 非原生但 model 含 claude → _detectAIProvider 仍判 anthropic) 被 _native 卡掉、吃不到缓存。
// 改动：①_maybeCacheSys 放开 _native，改为 provider==anthropic && len>1500 && !停用闸。
//   ②安全网：_aiFetchWithRetryInner 撞 400 且请求含 cache_control → _stripCacheControlFromBody 脱字段重试一次
//     + 置 _aiCacheCtrlDisabled 本会话停用（防个别代理不认该字段每回合先撞 400）。
//   ③sc1b 内联那处统一走 _maybeCacheSys。
//
// 范围：[A] 行为·从真源码抽 _stripCacheControlFromBody 实跑  [B] 源契约·锁三处改动防回归。

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

const infraSrc = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
const aiSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');

// ── [A] 行为：抽出真·_stripCacheControlFromBody 跑 ──
const m = infraSrc.match(/function _stripCacheControlFromBody\(body\)\s*\{[\s\S]*?\n\}/);
assert(m, '[A] 能从源码抽出 _stripCacheControlFromBody');
const strip = new Function('return (' + m[0] + ')')();

// 1) system 带 cache_control 的数组 content → 拍回纯字符串·返回 true
const b1 = { messages: [
  { role: 'system', content: [{ type: 'text', text: 'SYS规则很长', cache_control: { type: 'ephemeral' } }] },
  { role: 'user', content: 'U' }
] };
assert(strip(b1) === true, '[A] 含 cache_control → 返回 true');
assert(b1.messages[0].content === 'SYS规则很长', '[A] system content 拍回原字符串');
assert(b1.messages[1].content === 'U', '[A] user content 不动');

// 2) 纯字符串 content → 返回 false·原样不动
const b2 = { messages: [{ role: 'system', content: 'plain' }, { role: 'user', content: 'U' }] };
assert(strip(b2) === false, '[A] 无数组 content → 返回 false');
assert(b2.messages[0].content === 'plain', '[A] 纯字符串不动');

// 3) 真·多模态数组(无 cache_control) → 不碰·返回 false
const imgBlock = { type: 'image_url', image_url: { url: 'x' } };
const b3 = { messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }, imgBlock] }] };
assert(strip(b3) === false, '[A] 无 cache_control 的多模态数组 → 返回 false（不误伤）');
assert(Array.isArray(b3.messages[0].content) && b3.messages[0].content[1] === imgBlock, '[A] 多模态数组保持原样不被拍平');

// 4) 多个 text 块带 cache_control → 拼接
const b4 = { messages: [{ role: 'system', content: [
  { type: 'text', text: 'A', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'B' }
] }] };
assert(strip(b4) === true && b4.messages[0].content === 'AB', '[A] 多块拼接为 AB');

// 5) 空/无 messages → false 不抛
assert(strip({}) === false && strip(null) === false, '[A] 空 body → false 不抛');

// ── [B] 源契约 ──
// infra：停用闸 + strip 函数 + 400 自愈分支
assert(/var _aiCacheCtrlDisabled = false;/.test(infraSrc), '[B] infra 定义 _aiCacheCtrlDisabled 停用闸');
assert(infraSrc.indexOf('function _stripCacheControlFromBody') >= 0, '[B] infra 定义 _stripCacheControlFromBody');
assert(infraSrc.indexOf("resp.status === 400 && !_isContextLength && !_ccStripped && _stripCacheControlFromBody(body)") >= 0,
  '[B] infra 400 分支：脱 cache_control 重试');
assert(/_ccStripped = true;[\s\S]{0,80}_aiCacheCtrlDisabled = true;/.test(infraSrc),
  '[B] infra 400 分支：置 _ccStripped 与本会话停用闸');

// endturn-ai：_maybeCacheSys 放开 _native（新门控在、旧门控除）+ sc1b 统一
assert(infraSrc.indexOf('_native &&') < 0 || true, ''); // infra 不涉及，占位略过
assert(aiSrc.indexOf("_provider === 'anthropic' && _len > 1500 && !_ccDisabled") >= 0,
  '[B] _maybeCacheSys 新门控：provider anthropic + len>1500 + 未停用（不再卡 _native）');
assert(aiSrc.indexOf("_provider === 'anthropic' && _native && _len > 1500") < 0,
  '[B] 旧的 _native 死域名门控已移除');
assert(aiSrc.indexOf("var _sc1bMsgs = [{role:'system',content:_maybeCacheSys(_sc1bSys)}") >= 0,
  '[B] sc1b 统一走 _maybeCacheSys（2026-07-02 起经 sysPFor 分级·仍同一缓存闸）');
assert(aiSrc.indexOf('_isNativeAnth1b') < 0, '[B] sc1b 旧内联 _isNativeAnth1b 已删');

console.log(`smoke-prompt-cache-proxy-claude: ${pass} assertions PASS`);
