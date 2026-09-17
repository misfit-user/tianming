#!/usr/bin/env node
/* eslint-env node */
'use strict';

// S1+S2 smoke：authoring agent 沙箱/工具/校验 + tool-caller/loop。无真实 LLM。
// 模块已内联 resolvePath，不再依赖 tm-ai-change-pathutils.js。

const path = require('path');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));

let pass = 0;
function ok(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL: ' + msg); throw new Error('FAIL: ' + msg); }
  pass++;
  console.log('  ✓ ' + msg);
}

(async function main() {
  try {
    // ───────────────────────── S1 ─────────────────────────
    console.log('— makeDraft 沙箱隔离 —');
    const src = { name: '原', factions: [{ name: '明' }] };
    global.scriptData = src;
    const d = AA.makeDraft();
    d.name = '改'; d.factions[0].name = '清';
    ok(src.name === '原' && src.factions[0].name === '明', 'makeDraft 深拷贝隔离·原对象不被改');
    ok(d.name === '改', 'draft 可独立修改');

    console.log('— applyEdit 设值/建路径/拦截 —');
    const d2 = AA.makeDraft({ factions: [{ name: '明', leader: '旧' }] });
    const r2 = AA.applyEdit(d2, 'factions.明.leader', '李自成');
    ok(r2.ok && d2.factions[0].leader === '李自成', 'applyEdit 按名导航设值 factions.明.leader');
    ok(r2.old === '旧', 'applyEdit 记录 old 值');

    const d3 = AA.makeDraft({});
    const r3 = AA.applyEdit(d3, 'worldSettings.religion', '佛教');
    ok(r3.ok && r3.created && d3.worldSettings.religion === '佛教', 'applyEdit 创建缺失纯对象路径');

    ok(!AA.applyEdit({}, 'ai.key', 'x').ok, 'applyEdit 拒绝 ai.key（blocklist）');
    ok(!AA.applyEdit({}, '_internal', 'x').ok, 'applyEdit 拒绝 _ 前缀字段');
    ok(!AA.applyEdit({}, 'id', 'x').ok, 'applyEdit 拒绝 id');
    ok(!AA.applyEdit({}, 'gameSettings.ai.model', 'x').ok, 'applyEdit 拒绝嵌套 .ai. 段');

    console.log('— 路径安全：原型污染/强制写入也拒绝 —');
    const pollutionKey = 'tmGuoshiPolluted';
    delete Object.prototype[pollutionKey];
    [
      '__proto__.' + pollutionKey,
      'constructor.prototype.' + pollutionKey,
      'worldSettings.prototype.' + pollutionKey
    ].forEach(function(unsafePath) {
      ok(!AA.applyEdit({}, unsafePath, '污染', { force: true }).ok, 'applyEdit 拒绝危险路径 ' + unsafePath);
      ok(!AA.applyPush({}, unsafePath, '污染', { force: true }).ok, 'applyPush 拒绝危险路径 ' + unsafePath);
      ok(!AA.applyRemove({}, unsafePath, { force: true }).ok, 'applyRemove 拒绝危险路径 ' + unsafePath);
    });
    ok(Object.prototype[pollutionKey] === undefined && ({}[pollutionKey]) === undefined, 'Object.prototype 未被污染');

    console.log('— preflight 纯读取：不偷偷规范化草稿 —');
    const preflightInput = { name: '缺规范字段', startYear: 1627, factions: [{ id: 'f1', name: '明' }], characters: [{ name: '甲', faction: '明' }] };
    const preflightBefore = JSON.stringify(preflightInput);
    const preflightReport = AA.preflight(preflightInput);
    ok(JSON.stringify(preflightInput) === preflightBefore, 'preflight 前后输入逐字节一致');
    ok(preflightReport.bootable === false && preflightReport.blockers.some(function(x) { return /gameSettings/.test(x); }), '缺 gameSettings 被报告为阻断而非静默补写');
    ok(!Object.prototype.hasOwnProperty.call(preflightInput.characters[0], 'factionId'), 'preflight 不回填人物 factionId');

    console.log('— applyPush —');
    const d4 = AA.makeDraft({ factions: [{ name: '明' }] });
    const r4 = AA.applyPush(d4, 'characters', { name: '张三' });
    ok(r4.ok && d4.characters.length === 1 && d4.characters[0].name === '张三', 'applyPush 向缺失数组创建并追加');
    AA.applyPush(d4, 'characters', { name: '李四' });
    ok(d4.characters.length === 2, 'applyPush 向已有数组追加');

    console.log('— 坑 B：applyEdit 旁路 PathUtils 运行时副作用 —');
    let loyaltyCalled = false;
    global.setCharacterLoyalty = function () { loyaltyCalled = true; return { ok: true, oldValue: 50, newValue: 70 }; };
    global.adjustCharacterLoyalty = function () { loyaltyCalled = true; return { ok: true }; };
    global.GM = { guoku: { money: 5, balance: 5 }, turnChanges: {} };

    const dG = AA.makeDraft({ guoku: { money: 100 } });
    AA.applyEdit(dG, 'guoku.money', 999);
    ok(dG.guoku.money === 999, 'draft.guoku.money 改为 999');
    ok(global.GM.guoku.balance === 5 && global.GM.guoku.money === 5, '未触发 _syncCoreVarSideEffects（GM.guoku 原封不动）');

    const dC = AA.makeDraft({ characters: [{ name: '张三', loyalty: 50 }] });
    const rC = AA.applyEdit(dC, 'characters.张三.loyalty', 99);
    ok(rC.ok && dC.characters[0].loyalty === 99, 'loyalty 直接设为 99（未被 maxJump 拦截截成 70）');
    ok(!loyaltyCalled, '未调用 setCharacterLoyalty/adjust（loyalty 拦截被旁路）');
    ok(!global.GM.turnChanges.characters, '未触发 _recordCharChange（GM.turnChanges 干净）');

    console.log('— 校验器：admin-population（父>=子人口）—');
    const dPbad = { adminHierarchy: { 明: { divisions: [
      { name: '省', population: { mouths: 100 }, divisions: [
        { name: 'A', population: { mouths: 70 } }, { name: 'B', population: { mouths: 50 } }
      ] }
    ] } } };
    const rpBad = AA.validateDraft(dPbad, 'admin-population');
    ok(!rpBad.ok && rpBad.violations.length === 1, '父(100) < 子之和(120) 被抓: ' + rpBad.violations[0]);

    const dPok = { adminHierarchy: { 明: { divisions: [
      { name: '省', population: { mouths: 200 }, divisions: [
        { name: 'A', population: { mouths: 70 } }, { name: 'B', population: { mouths: 50 } }
      ] }
    ] } } };
    ok(AA.validateDraft(dPok, 'admin-population').ok, '父(200) >= 子之和(120) 通过');

    const dPunknown = { adminHierarchy: { 明: { divisions: [
      { name: '省', divisions: [{ name: 'A', population: { mouths: 70 } }] }
    ] } } };
    ok(AA.validateDraft(dPunknown, 'admin-population').ok, '父人口未知时跳过比较·不误报');

    console.log('— 校验器：faction-refs（势力引用合法）—');
    const dF = {
      factions: [{ name: '明' }],
      characters: [{ name: '张', faction: '清' }],
      military: { initialTroops: [{ name: '京营', faction: '明' }] }
    };
    const rf = AA.validateDraft(dF, 'faction-refs');
    ok(!rf.ok && rf.violations.length === 1 && /清/.test(rf.violations[0]), '人物引用不存在势力「清」被抓');
    ok(AA.validateDraft({ factions: [{ name: '明' }, { name: '清' }], characters: [{ name: '张', faction: '清' }] }, 'faction-refs').ok, '全部引用合法时通过');

    console.log('— 校验器：region-coverage（区划↔地图）—');
    const dR = {
      mapData: { regions: [{ name: '顺天府' }] },
      adminHierarchy: { 明: { divisions: [{ name: '北直隶', divisions: [{ name: '顺天府' }, { name: '保定府' }] }] } }
    };
    const rr = AA.validateDraft(dR, 'region-coverage');
    ok(!rr.ok && /保定府/.test(rr.violations[0]), '孤儿末级区划「保定府」被抓');

    console.log('— validateDraft 聚合 —');
    const rAll = AA.validateDraft(dF);
    // _defaultChecks 已从 3 组增至 5 组(2026-06 绍宋教训新增 timeline-compliance + char-completeness)·按命名组断言(鲁棒·免再被新增打破)
    ok(['admin-population', 'faction-refs', 'region-coverage', 'timeline-compliance', 'char-completeness'].every(function (g) { return rAll.results[g]; }), 'validateDraft 默认跑全部 5 组结构检查(含 timeline-compliance/char-completeness)');
    // 此最小 draft(张仅 name/faction)faction-refs 与 char-completeness 双失败·两组都断言(锁全失败行为·非脆弱的 failed 计数)
    ok(rAll.ok === false
      && rAll.results['faction-refs'] && !rAll.results['faction-refs'].ok
      && rAll.results['char-completeness'] && !rAll.results['char-completeness'].ok,
      '聚合报告反映 faction-refs + char-completeness 双失败(残桩人物)');

    // ───────────────────────── S2 ─────────────────────────
    console.log('— loop：注入 caller 驱动 NL→toolcall→改draft→finish —');
    function scriptedCaller(seq) {
      let i = 0;
      return function (prompt, tools, opts) {
        const r = seq[i] || { toolCalls: [] };
        i++;
        return Promise.resolve(r);
      };
    }
    const draftA = AA.makeDraft({ name: '旧', factions: [{ name: '明' }] });
    const callerA = scriptedCaller([
      { toolCalls: [{ name: 'applyEdit', input: { path: 'name', value: '安史之乱' } }] },
      { toolCalls: [{ name: 'validateDraft', input: {} }] },
      { toolCalls: [{ name: 'finish', input: { summary: '改名完成' } }] }
    ]);
    const resA = await AA.runAuthoringLoop(draftA, '把剧本名改成安史之乱', { caller: callerA });
    ok(draftA.name === '安史之乱', 'loop 驱动 applyEdit 改了 draft.name');
    ok(resA.finished && resA.stopReason === 'finish', 'loop 经 finish 正常结束');
    ok(resA.iterations === 3, 'loop 跑了 3 轮');
    ok(resA.transcript.some(t => t.name === 'validateDraft'), 'transcript 含 validateDraft');
    ok(resA.finalValidation && typeof resA.finalValidation.ok === 'boolean', '返回 finalValidation');

    console.log('— 刀1：remonstrate 进谏 → 停机等定夺·不施改 —');
    const draftRem = AA.makeDraft({ name: '旧', factions: [{ name: '明' }] });
    const callerRem = scriptedCaller([
      { toolCalls: [{ name: 'remonstrate', input: { concern: '崇祯生于1611、万历1620年崩，让崇祯当万历之子辈分与生卒矛盾', severity: '史实', suggestion: '若要架空血缘，设为万历之孙更合史理' } }] }
    ]);
    const resRem = await AA.runAuthoringLoop(draftRem, '把崇祯设成万历的儿子', { caller: callerRem });
    ok(resRem.stopReason === 'needsConfirmation', 'remonstrate 触发 stopReason=needsConfirmation');
    ok(resRem.finished === true, 'remonstrate 视为本轮已收束(finished)');
    ok(resRem.remonstrance && /崇祯/.test(resRem.remonstrance.concern), '返回 remonstrance.concern 异议内容');
    ok(/万历之孙/.test(resRem.remonstrance.suggestion), '返回 remonstrance.suggestion 替代方案');
    ok(resRem.remonstrance.severity === '史实', '返回 remonstrance.severity 硬伤类型');
    ok(draftRem.name === '旧', '进谏时未对 draft 施改(停下来等定夺)');

    console.log('— 刀1：玩家坚持后 priorConversation 续接 → 正常执行 —');
    const callerRem2 = scriptedCaller([
      { toolCalls: [{ name: 'applyEdit', input: { path: 'name', value: '崇祯·万历子' } }] },
      { toolCalls: [{ name: 'finish', input: { summary: '已按玩家坚持执行' } }] }
    ]);
    const resRem2 = await AA.runAuthoringLoop(draftRem, '我坚持，就这么改', { caller: callerRem2, priorConversation: resRem.conversation });
    ok(resRem2.finished && resRem2.stopReason === 'finish', '玩家坚持后续接·正常 finish');
    ok(draftRem.name === '崇祯·万历子', '续接后按玩家坚持施改(进谏不阻断最终意志)');

    console.log('— 刀2：checkHistory 自查证 + 低把握 flagUncertain + historyChecks 轨迹 —');
    const draftHC = AA.makeDraft({ name: '万历中兴', factions: [{ name: '明' }], characters: [] });
    const callerHC = scriptedCaller([
      { toolCalls: [{ name: 'checkHistory', input: { facts: [
        { claim: '张居正卒于1582年', verdict: '确信' },
        { claim: '其门生某谋士的确切生卒', verdict: '不确定', note: '正史无载' }
      ] } }] },
      { toolCalls: [{ name: 'applyPush', input: { path: 'characters', value: { name: '张居正', faction: '明', bio: '万历首辅' } } }] },
      { toolCalls: [{ name: 'flagUncertain', input: { path: 'characters.张居正.bio', reason: '生平细节部分靠推测' } }] },
      { toolCalls: [{ name: 'finish', input: { summary: '加入张居正，存疑处已标注' } }] }
    ]);
    const resHC = await AA.runAuthoringLoop(draftHC, '加入张居正', { caller: callerHC, toolPacks:['history'] });
    ok(resHC.finished && resHC.stopReason === 'finish', 'checkHistory 流程正常 finish');
    ok(resHC.transcript.some(t => t.name === 'checkHistory'), 'transcript 含 checkHistory 自核步骤');
    const hcStep = resHC.transcript.find(t => t.name === 'checkHistory');
    ok(hcStep.result.lowConfidence === 1, 'checkHistory 回喂识别 1 条低把握(驱动 flagUncertain)');
    ok(Array.isArray(resHC.historyChecks) && resHC.historyChecks.length === 2, 'historyChecks 汇总 2 条自核声明');
    ok(resHC.historyChecks.some(f => f.verdict === '不确定'), 'historyChecks 保留存疑判定');
    ok(resHC.uncertainties.some(u => /bio/.test(u.path)), '低把握内容触发 flagUncertain·进 uncertainties');

    console.log('— 刀3：对抗式三角色 runWithCritics（拟稿→史官+谏官→修订）—');
    function criticsCaller() {
      let draftTurns = 0, reviseTurns = 0;
      return function (conversation, tools, opt) {
        const toolNames = (tools || []).map(t => t.name);
        const sys = (opt && opt.system) || '';
        const isReview = toolNames.indexOf('submitReview') >= 0;
        if (isReview && /史官/.test(sys)) {
          return { text: '', toolCalls: [{ id: 'r1', name: 'submitReview', input: { summary: '有一处史实存疑', findings: [{ dimension: '史实合理性', severity: '中', location: 'characters·张三', issue: '生卒与年号矛盾', suggestion: '改保守纪年并标存疑' }] } }] };
        }
        if (isReview && /谏官/.test(sys)) {
          return { text: '', toolCalls: [{ id: 'r2', name: 'submitReview', input: { summary: '平衡尚可', findings: [{ dimension: '平衡性', severity: '低', location: '势力·甲', issue: '甲略强', suggestion: '兵力微调' }] } }] };
        }
        let lastUser = '';
        for (let i = conversation.length - 1; i >= 0; i--) { if (conversation[i].role === 'user') { lastUser = conversation[i].text || ''; break; } }
        if (/三堂会审·修订/.test(lastUser)) {
          reviseTurns++;
          if (reviseTurns === 1) return { text: '采纳意见', toolCalls: [{ id: 'e1', name: 'applyEdit', input: { path: 'name', value: '会审定稿' } }] };
          return { text: '修订完成', toolCalls: [{ id: 'f2', name: 'finish', input: { summary: '已据史官谏官意见修订' } }] };
        }
        draftTurns++;
        if (draftTurns === 1) return { text: '先自核史实', toolCalls: [{ id: 'h1', name: 'checkHistory', input: { facts: [{ claim: '张三生于万历元年', verdict: '不确定', note: '正史无载' }] } }] };
        return { text: '拟稿完成', toolCalls: [{ id: 'f1', name: 'finish', input: { summary: '初稿完成' } }] };
      };
    }
    const draftCR = AA.makeDraft({ name: '初稿名', factions: [{ name: '甲' }], characters: [{ name: '张三', faction: '甲' }] });
    const resCR = await AA.runWithCritics(draftCR, '设定一个甲势力开局', { caller: criticsCaller(), toolPacks:['history'] });
    ok(resCR.critiqued && resCR.steps.length === 4, '会审走完四阶段：拟稿+史官+谏官+修订');
    ok(resCR.steps[0].role === '国师·拟稿' && resCR.steps[0].result.finished, '①国师拟稿 finish');
    ok(resCR.steps[1].role === '史官·史实审' && !!resCR.steps[1].result.review, '②史官产出审阅报告');
    ok(resCR.steps[2].role === '谏官·平衡审' && !!resCR.steps[2].result.review, '③谏官产出审阅报告');
    ok(resCR.findings.length === 2, '史官+谏官共 2 条意见汇总');
    ok(/张三生于/.test(JSON.stringify(resCR.steps[1].result.conversation)), '史官收到国师自核的低把握项(刀2 historyChecks 回灌史官)');
    ok(resCR.revised && resCR.steps[3].role === '国师·修订', '④有意见→国师据谏修订');
    ok(/三堂会审·修订/.test(JSON.stringify(resCR.steps[3].result.conversation)), '修订需求里回灌了史官谏官的审阅意见');
    ok(draftCR.name === '会审定稿', '修订真正落到同一 draft（名字被改）');

    console.log('— 刀3：会审无异议→拟稿即终稿（省修订调用）—');
    function cleanCaller() {
      return function (conversation, tools, opt) {
        const sys = (opt && opt.system) || '';
        if (((tools || []).map(t => t.name).indexOf('submitReview') >= 0)) {
          return { text: '', toolCalls: [{ id: 'rc', name: 'submitReview', input: { summary: '没问题', findings: [] } }] };
        }
        return { text: '拟稿完成', toolCalls: [{ id: 'fc', name: 'finish', input: { summary: '初稿完成' } }] };
      };
    }
    const draftCR2 = AA.makeDraft({ name: '干净稿', factions: [{ name: '甲' }], characters: [{ name: '张三', faction: '甲' }] });
    const resCR2 = await AA.runWithCritics(draftCR2, '设定甲势力', { caller: cleanCaller() });
    ok(resCR2.critiqued && resCR2.revised === false, '无意见时不触发修订');
    ok(resCR2.steps.length === 3, '无意见时只跑三阶段（拟稿+史官+谏官，无修订）');

    console.log('— loop：maxIterations 闸 —');
    const draftB = AA.makeDraft({ name: 'x' });
    const neverFinish = function () { return Promise.resolve({ toolCalls: [{ name: 'applyEdit', input: { path: 'overview', value: '…' } }] }); };
    const resB = await AA.runAuthoringLoop(draftB, 'x', { caller: neverFinish, maxIterations: 5 });
    ok(resB.iterations === 5 && resB.stopReason === 'maxIterations' && !resB.finished, 'maxIterations 闸生效（不会无限跑）');

    console.log('— loop：空 toolCalls 先 nudge 再放弃（方向A 韧性）—');
    const resC = await AA.runAuthoringLoop(AA.makeDraft({}), 'x', { caller: () => Promise.resolve({ toolCalls: [] }) });
    ok(resC.stopReason === 'noToolCalls' && resC.iterations === 3, '无 toolCalls 先 nudge 2 次再停在 noToolCalls（1+2 轮·不立即放弃）');

    console.log('— loop：nudge 后自愈（no-tool → 提示 → finish）—');
    let cNudge = 0;
    const nudgeThenFinish = function () {
      cNudge++;
      return Promise.resolve(cNudge === 1 ? { toolCalls: [] } : { toolCalls: [{ name: 'finish', input: { summary: '改好了' } }] });
    };
    const resCn = await AA.runAuthoringLoop(AA.makeDraft({ name: 'x' }), 'x', { caller: nudgeThenFinish });
    ok(resCn.finished && resCn.stopReason === 'finish', 'noToolCalls 后经 nudge 自愈并 finish');

    console.log('— loop：瞬态错误退避重试后自愈（方向A 韧性）—');
    let cFlaky = 0;
    const flakyThenOk = function () {
      cFlaky++;
      if (cFlaky === 1) { const e = new Error('网络抖动'); e.transient = true; return Promise.reject(e); }
      return Promise.resolve({ toolCalls: [{ name: 'finish', input: { summary: 'ok' } }] });
    };
    const resR = await AA.runAuthoringLoop(AA.makeDraft({ name: 'x' }), 'x', { caller: flakyThenOk, retryBaseMs: 1 });
    ok(resR.finished && resR.stopReason === 'finish' && cFlaky === 2, '瞬态错误重试一次后自愈 finish');

    console.log('— loop：非瞬态错误（401）快速失败·不重试 —');
    let cHard = 0;
    const hardErr = function () { cHard++; const e = new Error('401 鉴权失败'); e.status = 401; return Promise.reject(e); };
    let hardRejected = false;
    await AA.runAuthoringLoop(AA.makeDraft({ name: 'x' }), 'x', { caller: hardErr, retryBaseMs: 1 }).catch(() => { hardRejected = true; });
    ok(hardRejected && cHard === 1, '非瞬态错误（401）不重试·一次即失败');

    console.log('— callWithTools：anthropic 路径（mock fetch）—');
    let seen = null;
    global.localStorage = { getItem: () => JSON.stringify({ key: 'k1', url: 'https://api.anthropic.com', model: 'claude-x' }) };
    global.fetch = function (endpoint, init) {
      seen = { endpoint, init };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: [{ type: 'tool_use', name: 'applyEdit', input: { path: 'name', value: 'X' } }] }) });
    };
    const ra = await AA.callWithTools('hi', AA.AGENT_TOOLS);
    ok(ra.toolCalls.length === 1 && ra.toolCalls[0].name === 'applyEdit', 'callWithTools 解析 anthropic tool_use');
    ok(/\/v1\/messages$/.test(seen.endpoint), 'anthropic endpoint 拼接 /v1/messages');
    ok(seen.init.headers['x-api-key'] === 'k1', 'anthropic 用 x-api-key header');
    ok(JSON.parse(seen.init.body).tools[0].input_schema, 'anthropic tools 用 input_schema');

    console.log('— callWithTools：openai-compat 路径（mock fetch）—');
    global.localStorage = { getItem: () => JSON.stringify({ key: 'k2', url: 'https://api.openai.com/v1', model: 'gpt-4o' }) };
    global.fetch = function (endpoint, init) {
      seen = { endpoint, init };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ choices: [{ message: { tool_calls: [{ function: { name: 'finish', arguments: '{"summary":"ok"}' } }] } }] }) });
    };
    const ro = await AA.callWithTools('hi', AA.AGENT_TOOLS);
    ok(ro.toolCalls.length === 1 && ro.toolCalls[0].name === 'finish' && ro.toolCalls[0].input.summary === 'ok', 'callWithTools 解析 openai tool_calls + 解 arguments JSON');
    ok(/\/chat\/completions$/.test(seen.endpoint), 'openai endpoint 拼接 /chat/completions');
    ok(seen.init.headers.Authorization === 'Bearer k2', 'openai 用 Bearer header');
    const openAiTools = JSON.parse(seen.init.body).tools || [];
    ok(openAiTools.every(t => t && t.type === 'function' && t.function && t.function.name), 'openai tools 用 function 包裹');
    ok(openAiTools.some(t => t.function.name === 'applyEdit'), 'openai tools 保留 applyEdit');

    console.log('— callWithTools：缺 key 报错 —');
    let threw = false;
    global.localStorage = { getItem: () => '{}' };
    try { await AA.callWithTools('hi', AA.AGENT_TOOLS); } catch (e) { threw = /API Key/.test(e.message); }
    ok(threw, '未配置 key 时 reject 提示配置 API');

    // ───────────────────────── S3 ─────────────────────────
    console.log('— S3: 违规挡 finish → agent 自修 → finish —');
    const draftH = AA.makeDraft({ factions: [{ name: '明' }], characters: [] });
    const callerH = scriptedCaller([
      { toolCalls: [{ name: 'applyPush', input: { path: 'characters', value: { name: '张', faction: '清' } } }] }, // 非法势力引用
      { toolCalls: [{ name: 'finish', input: { summary: '试图结束' } }] },                                           // 应被挡
      { toolCalls: [{ name: 'applyEdit', input: { path: 'characters.张.faction', value: '明' } }] },                 // 自修
      { toolCalls: [{ name: 'finish', input: { summary: '修好了' } }] }                                              // 通过
    ]);
    const resH = await AA.runAuthoringLoop(draftH, '加个角色张', { caller: callerH });
    ok(resH.finishAttempts === 1, 'finish 因违规被拦了 1 次');
    ok(draftH.characters[0].faction === '明', 'agent 据违规反馈自修了非法势力引用');
    ok(resH.finished && resH.stopReason === 'finish', '修复后再次 finish 通过');
    ok(resH.iterations === 4, '共 4 轮(改→挡→修→finish)');

    console.log('— S3: maxFinishAttempts 放弃 —');
    const draftI = AA.makeDraft({ factions: [{ name: '明' }], characters: [{ name: '张', faction: '清' }] });
    const alwaysFinish = () => Promise.resolve({ toolCalls: [{ name: 'finish', input: {} }] });
    const resI = await AA.runAuthoringLoop(draftI, 'x', { caller: alwaysFinish, maxFinishAttempts: 3 });
    ok(resI.finishAttempts === 3 && resI.stopReason === 'finishBlocked' && !resI.finished, '一直不修·3 次后放弃(finishBlocked·不死循环)');

    console.log('— S3: region-coverage 仅警告·不拦 finish —');
    const draftJ = AA.makeDraft({
      factions: [{ name: '明' }],
      mapData: { regions: [{ name: '顺天府' }] },
      adminHierarchy: { 明: { divisions: [{ name: '北直隶', divisions: [{ name: '顺天府' }, { name: '保定府' }] }] } }
    });
    const callerJ = scriptedCaller([{ toolCalls: [{ name: 'finish', input: { summary: 'ok' } }] }]);
    const resJ = await AA.runAuthoringLoop(draftJ, 'x', { caller: callerJ });
    ok(resJ.finished && resJ.finishAttempts === 0, 'region-coverage 有孤儿但属非 blocking·不拦 finish');
    ok(!resJ.finalValidation.ok, 'finalValidation 仍诚实标记 region 违规');

    console.log('— S3: token 预算闸 —');
    const draftK = AA.makeDraft({ name: 'x' });
    const neverFinishK = () => Promise.resolve({ toolCalls: [{ name: 'applyEdit', input: { path: 'overview', value: '内容' } }] });
    const resK = await AA.runAuthoringLoop(draftK, '一个比较长的中文需求用来撑高 prompt 的 token 估算值', { caller: neverFinishK, maxTokens: 50 });
    ok(resK.stopReason === 'tokenBudget', 'token 超预算时停在 tokenBudget');
    ok(resK.tokensUsed >= 50, 'tokensUsed 记录累计估算');

    // ───────────────────────── S4 ─────────────────────────
    console.log('— S4: computeDiff —');
    const diffs = AA.computeDiff(
      { name: '旧', characters: [{ name: '张', loyalty: 50 }] },
      { name: '新', characters: [{ name: '张', loyalty: 60 }, { name: '李' }] }
    );
    const byPath = {}; diffs.forEach(d => { byPath[d.path] = d; });
    ok(byPath['name'] && byPath['name'].type === 'changed' && byPath['name'].after === '新', 'diff 抓到 name 改');
    ok(byPath['characters.0.loyalty'] && byPath['characters.0.loyalty'].type === 'changed', 'diff 抓到嵌套数组元素改');
    ok(byPath['characters.1'] && byPath['characters.1'].type === 'added', 'diff 抓到新增数组元素');
    ok(AA.computeDiff({ a: 1 }, { a: 1 }).length === 0, '无变更时 diff 为空');
    const manyBefore = {}, manyAfter = {};
    for (let manyI = 0; manyI < 350; manyI++) manyAfter['field' + manyI] = manyI;
    const fullDiff = AA.computeDiff(manyBefore, manyAfter);
    ok(fullDiff.length === 350 && fullDiff.truncated === false, '默认 diff 完整返回 350 条，不再静默截断');
    const cappedDiff = AA.computeDiff(manyBefore, manyAfter, { maxEntries: 300 });
    ok(cappedDiff.length === 300 && cappedDiff.truncated === true, '显式上限会标记 truncated');
    let truncatedRejected = false;
    try { AA.applySelectedDiffs(manyBefore, manyAfter, cappedDiff, function() { return true; }); }
    catch (e) { truncatedRejected = e && e.code === 'diff-truncated'; }
    ok(truncatedRejected, '不完整 diff 在应用端 fail closed');

    console.log('— S4: 旧编辑器 adapter —');
    let renderAllCalls = 0, saveScriptCalls = 0;
    const fakeG = {
      TM: { legacyEditorDocument: { id: 'legacy-test-document' } },
      scriptData: { name: '原', factions: [{ name: '明' }], _phase6: 'keep' },
      renderAll: () => { renderAllCalls++; },
      saveScript: () => { saveScriptCalls++; }
    };
    const oldAdapter = AA.makeOldEditorAdapter(fakeG);
    ok(oldAdapter.isAvailable(), '旧 adapter 在 scriptData+saveScript 存在时可用');
    const refBefore = fakeG.scriptData;
    oldAdapter.commit({ name: '安史之乱', factions: [{ name: '唐' }], _phase6: 'keep' });
    ok(fakeG.scriptData === refBefore, 'commit 就地替换·保留 scriptData 引用');
    ok(fakeG.scriptData.name === '安史之乱' && fakeG.scriptData.factions[0].name === '唐', 'commit 内容已替换');
    ok(fakeG.scriptData._phase6 === 'keep', 'commit 不洗 draft 携带的字段');
    ok(renderAllCalls === 1 && saveScriptCalls === 1, 'commit 触发 renderAll + saveScript');

    console.log('— S4: 新编辑器 adapter —');
    let applied = null;
    const fakeReset = {
      TM_SCENARIO_EDITOR_RESET_APP: {
        state: { scenario: { name: '原新' } },
        applyImportedScenario: (parsed, label) => { applied = { parsed, label }; }
      }
    };
    const resetAdapter = AA.makeResetEditorAdapter(fakeReset);
    ok(resetAdapter.isAvailable(), '新 adapter 在 RESET_APP 存在时可用');
    ok(resetAdapter.getScenario().name === '原新', '新 adapter 取 state.scenario');
    let missingProtocolRejected = false;
    try { resetAdapter.commit({ name: '不能走导入覆盖' }); } catch (e) { missingProtocolRejected = /安全案卷编辑协议/.test(e.message); }
    ok(missingProtocolRejected && applied === null, '旧宿主缺少编辑协议时拒绝，不回退导入覆盖');
    const editLease = { document: { id: 'test-document' }, revision: 0 };
    fakeReset.TM_SCENARIO_EDITOR_RESET_APP.captureDocumentLease = () => editLease;
    fakeReset.TM_SCENARIO_EDITOR_RESET_APP.commitScenarioEdit = (parsed, label, lease) => { applied = { parsed, label, lease }; return { ok: true }; };
    resetAdapter.commit({ name: '新剧本' });
    ok(applied && applied.parsed.name === '新剧本' && /国师/.test(applied.label) && applied.lease === editLease, 'commit 调独立 commitScenarioEdit 并传递实际租约');

    console.log('— S4: detectAdapter —');
    ok(AA.detectAdapter(fakeReset).id === 'scenario-editor-reset', 'detect 优先新编辑器');
    ok(AA.detectAdapter(fakeG).id === 'legacy-editor', 'detect 回退旧编辑器');
    ok(AA.detectAdapter({}) === null, '都不在时 detect 返回 null');

    // ───────────────────────── S5 ─────────────────────────
    console.log('— S5: schema 指南 + 实体模板 —');
    const guide = AA.buildSchemaGuide();
    ok(/factions/.test(guide) && /characters/.test(guide) && /adminHierarchy/.test(guide), 'schema 指南列出主要实体');
    ok(/populationDetail\.mouths/.test(guide) && /父级/.test(guide), 'schema 指南含正式区划父>=子人口约束');
    ok(/禁止英译/.test(guide), 'schema 指南含禁英译约束');
    ok(/factions\[\]\.name/.test(guide) || /必须等于某个 factions/.test(guide), 'schema 指南含势力引用约束');
    ok(AA.ENTITY_TEMPLATES.character && 'loyalty' in AA.ENTITY_TEMPLATES.character, 'ENTITY_TEMPLATES.character 含 loyalty 骨架');
    ok(AA.ENTITY_TEMPLATES.division.populationDetail && 'mouths' in AA.ENTITY_TEMPLATES.division.populationDetail && typeof AA.ENTITY_TEMPLATES.division.population === 'number', 'ENTITY_TEMPLATES.division 对齐官方 population 数值与 populationDetail.mouths');
    ok(Array.isArray(AA.ENTITY_TEMPLATES.division.children) && !('divisions' in AA.ENTITY_TEMPLATES.division), '区划子级使用 children，不能继续指导 agent 写错 divisions');

    console.log('— S5: schema 指南进入 system（可缓存）+ 用户需求进 conversation —');
    let capSystem = '', capConv = null;
    const captureCaller = (conversation, tools, opts) => { capSystem = (opts && opts.system) || ''; capConv = conversation; return Promise.resolve({ toolCalls: [{ name: 'finish', input: {} }] }); };
    await AA.runAuthoringLoop(AA.makeDraft({ factions: [] }), '把剧本名改成测试剧本', { caller: captureCaller });
    ok(/剧本结构速查/.test(capSystem), 'system 含 schema 速查');
    ok(/行政区划父级/.test(capSystem), 'system 含硬约束');
    ok(capConv[0].role === 'user' && /把剧本名改成测试剧本/.test(capConv[0].text), '初始 user turn 含用户需求');

    // ───────────────────────── A: 健壮性 ─────────────────────────
    console.log('— A: 500 重试 —');
    let n500 = 0;
    global.localStorage = { getItem: () => JSON.stringify({ key: 'k', url: 'https://api.openai.com/v1', model: 'gpt-4o' }) };
    global.fetch = function () {
      n500++;
      if (n500 <= 2) return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('err'), headers: { get: () => '' } });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ choices: [{ message: { tool_calls: [{ id: 'x', function: { name: 'finish', arguments: '{}' } }] } }] }) });
    };
    const rRetry = await AA.callWithTools('hi', AA.AGENT_TOOLS, { retryBaseMs: 1 });
    ok(n500 === 3 && rRetry.toolCalls[0].name === 'finish', '500 重试两次后第 3 次成功');

    console.log('— A: 400 → 文本兜底 —');
    let phase = 0;
    global.fetch = function () {
      phase++;
      if (phase === 1) return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve('tools not supported'), headers: { get: () => '' } });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: '{"tool_calls":[{"name":"finish","input":{"summary":"ok"}}]}' } }] }) });
    };
    const rFb = await AA.callWithTools('hi', AA.AGENT_TOOLS, { retryBaseMs: 1 });
    ok(rFb.fallback && rFb.toolCalls[0].name === 'finish', '400 后扁平化文本兜底·解析 JSON tool_calls');

    console.log('— A: 200 无 tool_calls 但文本含 JSON ─ 兜底 —');
    global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: '{"tool_calls":[{"name":"applyEdit","input":{"path":"name","value":"X"}}]}' } }] }) });
    const rFb2 = await AA.callWithTools('hi', AA.AGENT_TOOLS);
    ok(rFb2.fallback && rFb2.toolCalls[0].name === 'applyEdit', '端点忽略 tools 但吐 JSON·从文本兜底解析');

    // ───────────────────────── B: 多轮线程 ─────────────────────────
    console.log('— B: anthropic 多轮 tool_use/tool_result 线程 + cache_control —');
    let seenBody = null;
    global.localStorage = { getItem: () => JSON.stringify({ key: 'k', url: 'https://api.anthropic.com', model: 'claude-x' }) };
    global.fetch = function (url, init) { seenBody = JSON.parse(init.body); return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: [{ type: 'tool_use', id: 'tu_1', name: 'finish', input: {} }] }) }); };
    const conv = [
      { role: 'user', text: '改名' },
      { role: 'assistant', text: '', toolCalls: [{ id: 'tu_0', name: 'applyEdit', input: { path: 'name', value: 'X' } }] },
      { role: 'tool', toolResults: [{ id: 'tu_0', name: 'applyEdit', content: 'ok' }] }
    ];
    const rb = await AA.callWithTools(conv, AA.AGENT_TOOLS, { system: 'SYS' });
    ok(seenBody.system && seenBody.system[0].cache_control, 'anthropic system 带 cache_control(缓存)');
    ok(seenBody.messages[1].content.some(b => b.type === 'tool_use' && b.id === 'tu_0'), 'assistant turn 含 tool_use(带 id)');
    ok(seenBody.messages[2].content[0].type === 'tool_result' && seenBody.messages[2].content[0].tool_use_id === 'tu_0', 'tool turn 的 tool_result 引用同 id');
    ok(rb.toolCalls[0].id === 'tu_1' && rb.toolCalls[0].name === 'finish', '解析 tool_use 保留 id');

    console.log('— B: openai 多轮 tool_calls/role:tool 线程 —');
    global.localStorage = { getItem: () => JSON.stringify({ key: 'k', url: 'https://api.openai.com/v1', model: 'gpt-4o' }) };
    global.fetch = function (url, init) { seenBody = JSON.parse(init.body); return Promise.resolve({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }) }); };
    await AA.callWithTools(conv, AA.AGENT_TOOLS, { system: 'SYS' });
    ok(seenBody.messages[0].role === 'system', 'openai system 作为 messages[0]');
    const asst = seenBody.messages.find(m => m.role === 'assistant' && m.tool_calls);
    ok(asst && asst.tool_calls[0].id === 'tu_0', 'openai assistant.tool_calls 带 id');
    const toolMsg = seenBody.messages.find(m => m.role === 'tool');
    ok(toolMsg && toolMsg.tool_call_id === 'tu_0', 'openai role:tool 的 tool_call_id 对应');

    console.log('— B: loop 维护增长 conversation —');
    const draftMT = AA.makeDraft({ factions: [{ name: '明' }] });
    const mtCaller = scriptedCaller([
      { text: '我先看看', toolCalls: [{ id: 'a', name: 'getField', input: { path: 'factions' } }] },
      { toolCalls: [{ id: 'b', name: 'applyEdit', input: { path: 'name', value: '测试剧本' } }] },
      { toolCalls: [{ id: 'c', name: 'finish', input: {} }] }
    ]);
    const resMT = await AA.runAuthoringLoop(draftMT, '改名', { caller: mtCaller });
    ok(resMT.conversation.length === 1 + 3 * 2, 'conversation = 初始 user + 每轮(assistant+tool)');
    ok(resMT.conversation.some(t => t.role === 'tool'), 'conversation 含 tool turn');
    ok(draftMT.name === '测试剧本' && resMT.finished, '多轮编辑后改名生效 + finish');

    console.log('— D: onText 暴露 agent 文本 —');
    let texts = [];
    await AA.runAuthoringLoop(AA.makeDraft({ factions: [] }), 'x', {
      caller: scriptedCaller([{ text: '思考中', toolCalls: [{ id: 'a', name: 'finish', input: {} }] }]),
      onText: (t) => texts.push(t)
    });
    ok(texts.length === 1 && texts[0] === '思考中', 'onText 回调拿到 agent 每步文本');

    // ───────────────────────── C: 读/查询/删除工具 ─────────────────────────
    console.log('— C: getField / searchEntities / removeEntity —');
    const draftC = AA.makeDraft({ factions: [{ name: '明' }, { name: '清' }], characters: [{ name: '张', faction: '明' }, { name: '李', faction: '清' }] });
    ok(AA.dispatchTool(draftC, 'getField', { path: 'factions' }).value.length === 2, 'getField 取顶层数组');
    ok(AA.dispatchTool(draftC, 'getField', { path: 'characters.张' }).value.faction === '明', 'getField 按名取数组元素');
    const sr = AA.dispatchTool(draftC, 'searchEntities', { collection: 'characters', query: '清' });
    ok(sr.ok && sr.count === 1 && sr.matches[0].name === '李', 'searchEntities 按 faction 关键词命中');
    ok(AA.dispatchTool(draftC, 'searchEntities', { collection: 'characters', query: '' }).count === 2, 'searchEntities 空 query 返回全部');
    const rmv = AA.applyRemove(draftC, 'characters.张');
    ok(rmv.ok && draftC.characters.length === 1 && draftC.characters[0].name === '李', 'applyRemove 按名删数组元素');
    ok(!AA.applyRemove({}, 'ai.key').ok, 'applyRemove 拒绝 blocked path');
    ok(AA.dispatchTool(draftC, 'removeEntity', { path: 'factions.清' }).ok && draftC.factions.length === 1, 'removeEntity 走 dispatch 删势力');

    console.log('— C2: copyField 生图复用直拷（2026-07-10）—');
    const bigImg = 'data:image/png;base64,' + 'A'.repeat(40000);
    const draftCF = AA.makeDraft({ characters: [{ name: '张', portrait: bigImg }, { name: '李' }], factions: [{ name: '明' }] });
    const cf1 = AA.dispatchTool(draftCF, 'copyField', { from: 'characters.张.portrait', to: 'factions.明.leaderPortrait' });
    ok(cf1.ok === true && draftCF.factions[0].leaderPortrait === bigImg, 'copyField 大图 data URL 经路径直拷落目标字段');
    ok(/图像·约\d+KB/.test(cf1.copied), 'copyField 返回图像体量摘要(不把大值送回上下文)');
    const cf2 = AA.dispatchTool(draftCF, 'copyField', { from: 'characters.王.portrait', to: 'characters.李.portrait' });
    ok(cf2.ok === false && /from/.test(cf2.reason), 'copyField 源字段不存在 → 明确报错');
    ok(AA.dispatchTool(draftCF, 'copyField', { from: 'characters.张.portrait', to: 'ai.key' }).ok === false, 'copyField 写入享 applyEdit 同套拦截(blocklist)');
    ok(AA.dispatchTool(draftCF, 'copyField', { from: 'characters.张.portrait' }).ok === false, 'copyField 缺 to → 拒绝');
    ok(AA.AGENT_TOOLS.some(t => t.name === 'copyField'), 'copyField 已注册进 AGENT_TOOLS');

    console.log('— C6: 快测首回合真跑接线（刀④乙2026-07-10 智能升级A）—');
    const qtRes = await Promise.resolve(AA.dispatchTool(AA.makeDraft({}), 'readQuickTestReport', {}));
    ok(qtRes.ok === false && /IndexedDB/.test(qtRes.reason), 'readQuickTestReport 无 IndexedDB 环境明确报错(不装死)');
    ok(AA.AGENT_TOOLS.some(t => t.name === 'readQuickTestReport'), 'readQuickTestReport 已注册进 AGENT_TOOLS');
    const bridgeSrc = require('fs').readFileSync(path.join(__dirname, '..', 'preview', 'scenario-editor-sandbox-bridge.js'), 'utf8');
    ok(/tmScenarioQuickTest/.test(bridgeSrc) && /runQuickTestFirstTurn/.test(bridgeSrc) && /_endTurnInternal/.test(bridgeSrc), '桥侧快测流程在(带 key 启动+首回合真跑)');
    ok(bridgeSrc.indexOf("QUICKTEST_DB_ID = 'quickTestReport:latest'") >= 0, '桥侧报告写回保留 key');
    const agentSrc = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent.js'), 'utf8');
    ok(agentSrc.indexOf("'quickTestReport:latest'") >= 0, 'agent 侧读取与桥侧同 key(镜像防漂移)');
    const appSrc = require('fs').readFileSync(path.join(__dirname, '..', 'preview', 'scenario-editor-reset-app.js'), 'utf8');
    ok(/launch-quicktest-run/.test(appSrc) && /launchFormalSandbox\(\{ quickTest: true \}\)/.test(appSrc), '编辑器工作台「快测·首回合真跑」按钮+命令接线');
    ok(/tmScenarioQuickTest=1/.test(appSrc), '编辑器启动 URL 带快测参数');

    console.log('— C5: 微计划规则注入 + 运行教训回喂（刀③2026-07-10 智能升级D）—');
    let mpSys = '', mpUser = '';
    const mpCaller = function (conversation, tools, o) {
      mpSys = (o && o.system) || '';
      mpUser = (conversation && conversation[0] && conversation[0].text) || '';
      return Promise.resolve({ text: '', toolCalls: [{ id: 'm1', name: 'finish', input: { summary: 'x' } }] });
    };
    await AA.runAuthoringLoop(AA.makeDraft({ factions: [] }), '大改经济', { caller: mpCaller, conventions: '', blockingChecks: [], maxTokens: 1000000, runHistory: '· [国师] 重做官职 → 未完成:tokenBudget（半途而废）' });
    ok(mpSys.indexOf('歧义先对齐') >= 0 && mpSys.indexOf('微计划') >= 0, '微计划规则默认注入系统提示(⓪½)');
    ok(mpUser.indexOf('前情·最近几次协作的结局') >= 0 && mpUser.indexOf('tokenBudget') >= 0, '运行教训回喂进首轮上下文');
    let mpSys2 = '';
    await AA.runAuthoringLoop(AA.makeDraft({ factions: [] }), 'x', { caller: function (c, t, o) { mpSys2 = (o && o.system) || ''; return Promise.resolve({ text: '', toolCalls: [{ id: 'm2', name: 'finish', input: { summary: 'x' } }] }); }, conventions: '', blockingChecks: [], maxTokens: 1000000, microPlanConfirm: false });
    ok(mpSys2.indexOf('歧义先对齐') < 0, 'microPlanConfirm=false 时规则不注入(开关可关)');

    console.log('— C4: bulkUpdate 条件批改 + statsAggregate 聚合（刀②2026-07-10 智能升级C）—');
    const dBu = AA.makeDraft({ characters: [
      { name: '祖大寿', faction: '明', region: '辽东', military: 80, loyalty: 60 },
      { name: '满桂', faction: '明', region: '辽东', military: 78, loyalty: 70 },
      { name: '钱谦益', faction: '明', region: '江南', military: 20, loyalty: 50 },
      { name: '皇太极', faction: '后金', region: '辽东', military: 92, loyalty: 100 }
    ] });
    const bu1 = AA.dispatchTool(dBu, 'bulkUpdate', { collection: 'characters', where: { faction: '明', region: '辽东' }, field: 'military', op: 'add', value: 5 });
    ok(bu1.ok === true && bu1.matched === 2 && bu1.changed === 2, 'bulkUpdate 多键 AND 条件命中批改');
    ok(dBu.characters[0].military === 85 && dBu.characters[1].military === 83 && dBu.characters[2].military === 20 && dBu.characters[3].military === 92, 'bulkUpdate 只改命中项·数值正确');
    const bu2 = AA.dispatchTool(dBu, 'bulkUpdate', { collection: 'characters', where: { loyalty: { op: '<', value: 61 } }, field: 'loyalty', op: 'add', value: 10 });
    ok(bu2.ok === true && bu2.changed === 2 && dBu.characters[0].loyalty === 70 && dBu.characters[2].loyalty === 60, 'bulkUpdate 比较条件({op:"<"})生效');
    const bu3 = AA.dispatchTool(dBu, 'bulkUpdate', { collection: 'characters', where: { faction: '明' }, field: 'military', op: 'add', value: 1, limit: 1 });
    ok(bu3.ok === true && bu3.matched === 3 && bu3.changed === 1 && bu3.cappedByLimit === 2, 'bulkUpdate limit 试跑封顶·matched 如实报');
    ok(AA.dispatchTool(dBu, 'bulkUpdate', { collection: 'characters', where: { faction: '明' }, field: 'title', op: 'add', value: 5 }).skippedNonNumeric === 3, 'bulkUpdate 非数值字段 add 跳过并计数');
    ok(AA.dispatchTool(dBu, 'bulkUpdate', { collection: 'characters', field: 'military', op: 'add', value: 5 }).ok === false, 'bulkUpdate 缺 where 拒绝');
    const sa1 = AA.dispatchTool(dBu, 'statsAggregate', { collection: 'characters', groupBy: 'faction', metrics: ['military'] });
    ok(sa1.ok === true && sa1.groups === 2 && sa1.stats['后金'].metrics.military.avg === 92, 'statsAggregate 分组聚合·均值正确');
    ok(sa1.stats['明'].count === 3 && sa1.stats['明'].metrics.military.max >= 85, 'statsAggregate 组内 count/max');
    const sa2 = AA.dispatchTool(dBu, 'statsAggregate', { collection: 'characters', metrics: ['loyalty'], where: { region: '辽东' } });
    ok(sa2.ok === true && sa2.stats['(全部)'].count === 3, 'statsAggregate where 过滤+不分组');
    ok(AA.AGENT_TOOLS.some(t => t.name === 'bulkUpdate') && AA.AGENT_TOOLS.some(t => t.name === 'statsAggregate'), '两工具已注册进 AGENT_TOOLS');

    console.log('— C3: relation-consistency + finish 质量闸（刀①2026-07-10 智能升级B）—');
    const dRel = AA.makeDraft({ characters: [{ name: '甲' }, { name: '乙' }], relations: [
      { from: '甲', to: '乙', type: '好友' },
      { from: '甲', to: '不存在的人', type: '仇', strictRefs: true },
      { from: '乙', to: '乙', type: '自恋' },
      { from: '甲', to: '乙', type: '好友' }
    ] });
    const vr = AA.validateDraft(dRel, 'relation-consistency');
    ok(vr.ok === false && vr.violations.length === 3, 'relation-consistency 悬空/自环/重复三类全报');
    ok(/不存在的人/.test(vr.violations.join('')), '悬空引用点名');
    ok(AA.validateDraft(AA.makeDraft({ characters: [{ name: '甲' }, { name: '乙' }], relations: [{ from: '甲', to: '乙', type: '好友' }] }), 'relation-consistency').ok === true, '干净关系网通过');
    ok(AA.validateDraft(AA.makeDraft({ characters: [{ name: '甲' }], relations: [{ from: '东林党', to: '阉党', type: '群体血仇' }, { from: '甲', to: '已故人物', type: '追思' }] }), 'relation-consistency').ok === true, '开放关系图允许党派/阶层/已故或未出场人物节点');

    // finish 质量闸：增量语义——存量坏账不追责·引入新病顶回·修掉放行
    const dGate = AA.makeDraft({ characters: [{ name: '甲' }], relations: [{ from: '甲', to: '旧悬空', type: '旧账', strictRefs: true }] });
    let gRound = 0;
    const gateCaller = function () {
      gRound++;
      if (gRound === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'g1', name: 'applyPush', input: { path: 'relations', value: { from: '甲', to: '新悬空', type: '新病', strictRefs: true } } }] });
      if (gRound === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 'g2', name: 'finish', input: { summary: '带病收尾试探' } }] });
      if (gRound === 3) return Promise.resolve({ text: '', toolCalls: [{ id: 'g3', name: 'applyEdit', input: { path: 'relations', value: [{ from: '甲', to: '旧悬空', type: '旧账', strictRefs: true }] } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'g4', name: 'finish', input: { summary: '修好了' } }] });
    };
    const gRes = await AA.runAuthoringLoop(dGate, '加一条关系', { caller: gateCaller, conventions: '', blockingChecks: [], maxTokens: 1000000 });
    ok(gRes.finished && gRes.stopReason === 'finish', '质量闸：修掉新病后放行 finish（存量旧悬空不追责）');
    const gTR = gRes.conversation.filter(m => m.role === 'tool').reduce((a, m) => a.concat(m.toolResults || []), []);
    const gRefused = gTR.filter(tr => tr.name === 'finish' && String(tr.content).indexOf('quality-gate-worse') >= 0);
    ok(gRefused.length === 1, '质量闸：引入新悬空关系的 finish 被顶回(quality-gate-worse)');
    ok(gTR.some(tr => tr.name === 'finish' && String(tr.content).indexOf('relation-consistency') >= 0 && String(tr.content).indexOf('1→2') >= 0), '顶回信息带组名与基线→现值');

    console.log('— UI·X applySelectedDiffs 逐条接受/拒绝 —');
    const xCur = { name: '原名', factions: [{ name: '甲', power: 5 }, { name: '乙', power: 3 }], time: { year: 1627 } };
    const xDraft = { name: '新名', factions: [{ name: '甲改', power: 5 }, { name: '乙', power: 3 }, { name: '丙', power: 1 }], time: { year: 1628 } };
    const xDiffs = AA.computeDiff(xCur, xDraft);
    ok(JSON.stringify(AA.applySelectedDiffs(xCur, xDraft, xDiffs, () => true)) === JSON.stringify(xDraft), '接受全部 == draft');
    ok(JSON.stringify(AA.applySelectedDiffs(xCur, xDraft, xDiffs, () => false)) === JSON.stringify(xCur), '拒绝全部 == current（原状）');
    const xRejAdd = AA.applySelectedDiffs(xCur, xDraft, xDiffs, d => d.path !== 'factions.2');
    ok(xRejAdd.factions.length === 2 && xRejAdd.factions.every(f => f !== undefined) && xRejAdd.name === '新名' && xRejAdd.time.year === 1628, '拒绝新增元素：数组 compact 无洞·其余改动保留');
    const xRejName = AA.applySelectedDiffs(xCur, xDraft, xDiffs, d => d.path !== 'name');
    ok(xRejName.name === '原名' && xRejName.factions.length === 3 && xRejName.factions[0].name === '甲改', '拒绝单个标量改：仅该字段回原·其余仍是 draft');
    const xRejRemove = AA.applySelectedDiffs({ items: ['a', 'b', 'c'] }, { items: ['a', 'c'] }, AA.computeDiff({ items: ['a', 'b', 'c'] }, { items: ['a', 'c'] }), () => false);
    ok(JSON.stringify(xRejRemove.items) === JSON.stringify(['a', 'b', 'c']), '拒绝删除：放回 before·原数组复原');
    const xBase = { name: '原名', overview: '运行前' };
    const xAgent = { name: '国师新名', overview: '运行前' };
    const xLive = { name: '原名', overview: '玩家并行补写' };
    const xMerged = AA.applySelectedDiffs(xLive, xAgent, AA.computeDiff(xBase, xAgent), function() { return true; });
    ok(xMerged.name === '国师新名' && xMerged.overview === '玩家并行补写', '应用从实时剧本起步，保留国师运行期间的无关人工改动');
    let conflictRejected = false;
    try { AA.applySelectedDiffs({ name: '玩家并行改名', overview: '运行前' }, xAgent, AA.computeDiff(xBase, xAgent), function() { return true; }); }
    catch (e) { conflictRejected = e && e.code === 'edit-conflict' && e.conflicts && e.conflicts[0].path === 'name'; }
    ok(conflictRejected, '同路径人工改动触发 edit-conflict，整次应用不落盘');

    console.log('\n全部通过 (' + pass + ' 断言)');
  } catch (e) {
    console.error('\n测试失败: ' + (e && e.message || e));
    process.exit(1);
  }
})();
