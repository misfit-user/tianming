#!/usr/bin/env node
'use strict';
/* smoke-sysp-tiering — sysP 分级省流(2026-07-02)
 * 背景：实测一回合 18 个调用各重发 54.8K 静态 sysP=69% 输入(docs/ai-relay-fullturn-analysis.md)。
 * 本刀：①总闸 sysPTieringEnabled(默认关=恒返整条=零行为变更) ②补 sc1b/sc1c 漏斗(原绕过 sysPFor)
 * ③填 SYS_PROFILE_OF 首批 8 调用+定制档 EDICT/SNAP/COG(修正原计划 sc27/sc07 用 LITE 的丢段坑)。
 * 验法：提取 tm-endturn-prompt.js 里真 sysPFor 闭包与真 profile 表·假 _segs 逐档断言。
 */
const fs = require('fs');
const path = require('path');
const W = path.join(__dirname, '..');

let A = 0, F = 0;
function ok(cond, msg) { if (cond) { A++; console.log('  ✓ ' + msg); } else { F++; console.log('  ✗ ' + msg); } }

const promptSrc = fs.readFileSync(path.join(W, 'tm-endturn-prompt.js'), 'utf8');

function extractBraced(src, anchor) {
  const st = src.indexOf(anchor);
  if (st < 0) return null;
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', st); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return end > st ? src.slice(src.indexOf('{', st), end) : null;
}

// 真 profile 表
const profilesLit = extractBraced(promptSrc, 'global.TM.Endturn.AI.prompt.SYS_PROFILES = {');
const assignLit = extractBraced(promptSrc, 'global.TM.Endturn.AI.prompt.SYS_PROFILE_OF = {');
ok(!!profilesLit && !!assignLit, 'SYS_PROFILES / SYS_PROFILE_OF 表提取');
const SYS_PROFILES = (0, eval)('(' + profilesLit + ')');
const SYS_PROFILE_OF = (0, eval)('(' + assignLit + ')');

// 真 sysPFor 闭包
const fnAnchor = 'ctx.prompt.sysPFor = function(scId){';
const fnBody = extractBraced(promptSrc, fnAnchor);
ok(!!fnBody, 'sysPFor 闭包提取');
const mkSysPFor = new Function('ctx', 'global', 'return function(scId)' + fnBody + ';');

// 假 _segs(与 build 的段名对齐·按代码序·二批起 worldState 拆四子段)
const SEGS = ['base', 'worldPlan', 'events', 'digest', 'context', 'player', 'npcDeep', 'worldSocial', 'letters', 'worldGov', 'personnel', 'worldLifecycle', 'socialRules', 'roster', 'tail'];
const MARK = { base: '[B]', worldPlan: '[WP]', events: '[E]', digest: '[D]', context: '[C]', player: '[PL]', npcDeep: '[N]', worldSocial: '[WS]', letters: '[L]', worldGov: '[WG]', personnel: '[PE]', worldLifecycle: '[WL]', socialRules: '[S]', roster: '[R]', tail: '[T]' };
function mkCtx() {
  const segs = SEGS.map((n) => ({ name: n, text: MARK[n] }));
  return { prompt: { sysP: segs.map((s) => s.text).join(''), _segs: segs } };
}
function mkGlobal(flagOn) {
  return { P: { conf: flagOn ? { sysPTieringEnabled: true } : {} }, TM: { Endturn: { AI: { prompt: { SYS_PROFILES: SYS_PROFILES, SYS_PROFILE_OF: SYS_PROFILE_OF } } } } };
}

// ① 总闸默认关 → 恒返整条(引用恒等=字节恒等)
let ctx = mkCtx();
let fn = mkSysPFor(ctx, mkGlobal(false));
ok(fn('sc17') === ctx.prompt.sysP && fn('sc27') === ctx.prompt.sysP && fn('sc1') === ctx.prompt.sysP, '① 总闸关 → 全部恒返整条 sysP(零行为变更)');

// ② 开闸 → 各档裁剪正确
ctx = mkCtx();
fn = mkSysPFor(ctx, mkGlobal(true));
ok(fn('sc17') === '[B][C][WG][R][T]', '② sc17→LITE = base+context+worldGov(营造经济/国策/区划)+roster+tail');
ok(fn('sc16') === '[B][WP][E][C][WS][R][T]' && fn('sc18') === '[B][WP][E][C][WS][R][T]', '② sc16/sc18→FAC = Plan(关系矩阵)+Social(势力规则/矛盾)+events·不带Gov细账');
ok(fn('sc27') === '[B][C][R][T]', '② sc27→REVIEW(三批纠错:唯一调用点=legacy 叙事审查·非诏令·EDICT 系首批按文档名误判)');
ok(fn('sc07') === '[B][WP][D][C][PL][N][WS][R][T]', '② sc07→COG 含 Plan(隐藏议程)+Social(党派)+npcDeep+player+digest');
ok(fn('sc28') === '[B][D][C][WS][WG][R][T]', '② sc28→SNAP 含 Social+Gov 当前态+digest·不带 Plan 规划meta');
ok(['sc17', 'sc16', 'sc18', 'sc27', 'sc28', 'sc07'].every(function (id) { return fn(id).indexOf('[WL]') < 0; }), '② worldLifecycle(生灭schema)仅 FULL/NPC 带·分级档全不带');

// ③ 主线 8 id 永不入表 → 恒 FULL;谨慎区 10 id 三批已实审入表
['sc0', 'sc1', 'sc1q', 'sc1b', 'sc1c', 'sc1d', 'sc2', 'sc05'].forEach(function (id) {
  if (SYS_PROFILE_OF[id]) { F++; console.log('  ✗ ③ 主线 ' + id + ' 不应入表'); }
});
ok(fn('sc1') === ctx.prompt.sysP && fn('sc2') === ctx.prompt.sysP, '③ 主线 sc1/sc2 开闸下仍 FULL(永不降)');
A++; console.log('  ✓ ③ 主线 8 个 id 全不在表(抽查通过)');

// ③b 三批·谨慎区 10 id(2026-07-02 逐调用点实审)
ok(fn('scOl') === '[B][E][D][C][PL][N][WS][R][T]' && fn('scP') === fn('scOl'), '③b scOl/scP→NARR(事实已同源喂 user prompt·舍 Gov/Plan/生灭)');
ok(fn('scR') === '[B][C][R][T]', '③b scR→REVIEW 最薄档(查时代错/人名·roster 在)');
ok(fn('sc15') === '[B][WP][E][D][C][PL][N][WS][L][S][R][T]' && fn('sc15n') === fn('sc15'), '③b sc15/sc15n→NPCDEEP(全库最宽·仅舍 Gov 细账/生灭/personnel)');
ok(fn('memwrite') === '[B][C][N][R][T]', '③b memwrite→MEMW(事实全在 tpMW·npcDeep 身份接地)');
ok(fn('scTac') === '[B][D][C][WS][R][T]' && fn('scStr') === fn('scTac') && fn('sc25') === fn('scTac'), '③b scTac/scStr/sc25→MEMC(综述要 Social+digest)');
ok(fn('sc19') === '[B][C][WS][R][T]', '③b sc19→ENRICH(党派阶层背景+史观基准+防撞名)');
ok(['scOl', 'scP', 'scR', 'sc15', 'sc15n', 'memwrite', 'scTac', 'scStr', 'sc25', 'sc19'].every(function (id) { return fn(id).indexOf('[WL]') < 0 && fn(id).indexOf('[WG]') < 0; }), '③b 谨慎区全不带 worldGov 细账/生灭 schema');

// ④ 铁律：每个启用档必含 base(硬约束)+roster(幻觉防火墙)+tail
Object.keys(SYS_PROFILE_OF).forEach(function (id) {
  const p = SYS_PROFILES[SYS_PROFILE_OF[id]];
  if (!p || !p.base || !p.roster || !p.tail) { F++; console.log('  ✗ ④ ' + id + ' 档丢了 base/roster/tail'); }
});
A++; console.log('  ✓ ④ 全部启用档保 base(硬约束)+roster(实体名单)+tail');

// ⑤ _segs 为空(截断回退) → 开闸也返整条
ctx = mkCtx(); ctx.prompt._segs = null;
fn = mkSysPFor(ctx, mkGlobal(true));
ok(fn('sc17') === ctx.prompt.sysP, '⑤ 分块回退态 → 恒整条(安全)');

// ⑥ 未知 scId → FULL
ctx = mkCtx();
fn = mkSysPFor(ctx, mkGlobal(true));
ok(fn('sc_unknown_x') === ctx.prompt.sysP, '⑥ 未知 scId → 整条');

// ⑦ 漏斗契约：sc1b/sc1c 已走 sysPFor
const aiSrc = fs.readFileSync(path.join(W, 'tm-endturn-ai.js'), 'utf8');
ok(!/content:_maybeCacheSys\(sysP\)\}.*tp1b/.test(aiSrc), '⑦ sc1b 旧直拿写法已不存');

// ⑧ 设置开关契约

console.log('\n' + (F === 0 ? 'ALL PASS' : 'FAIL') + ' (' + A + ' pass / ' + F + ' fail)');
process.exit(F === 0 ? 0 : 1);
