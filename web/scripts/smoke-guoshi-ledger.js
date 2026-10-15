#!/usr/bin/env node
/* eslint-env node */
'use strict';
// smoke-guoshi-ledger — 国师改动账（2026-10-15 国师重做 S2）：
//   反向差异只回退国师改过的那几处、保留别处手工编辑；撤销较早一笔连带之后几笔；
//   那几处后来又被手工改过要认出冲突、默认不覆盖、force 才覆盖；恢复（重做）照原样落回；
//   记账/列表在没有 IndexedDB 的环境退回内存。另守 UI 接线（应用后记账、回复卡与改动史可撤销）。
const path = require('path');
const fs = require('fs');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));
const L = require(path.join(__dirname, '..', 'editor-authoring-agent-ledger.js'));
let P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function J(x) { return JSON.stringify(x); }

(async function main() {
  console.log('smoke-guoshi-ledger');
  const base = { name: '甲剧本', characters: [{ name: '袁崇焕', title: '巡抚', age: 43 }, { name: '孙承宗', title: '督师', age: 65 }], factions: [{ name: '明' }] };

  // 第一笔：改袁崇焕头衔 + 新增文震孟 + 改剧本名
  const d1 = AA.makeDraft(base);
  d1.characters[0].title = '督师蓟辽';
  d1.characters.push({ name: '文震孟', title: '中允', age: 53 });
  d1.name = '甲剧本·改';
  const diffs1 = AA.computeDiff(base, d1);
  const live1 = AA.applySelectedDiffs(base, d1, diffs1);
  ok(live1.characters.length === 3 && live1.characters[0].title === '督师蓟辽', '前提：第一笔应用成功');
  const e1 = await L.record({ fileKey: 'proj:a', fileLabel: '甲剧本', diffs: L.strip(diffs1), ts: 1000 });
  ok(e1 && e1.id && !e1.undone, '记账：生成 id、未撤销');

  // 别处手工编辑（与国师无关的字段）
  const live2 = JSON.parse(J(live1)); live2.characters[1].age = 66;

  // 第二笔：新增郑三俊
  const d2 = AA.makeDraft(live2); d2.characters.push({ name: '郑三俊', title: '侍郎' });
  const diffs2 = AA.computeDiff(live2, d2);
  const live3 = AA.applySelectedDiffs(live2, d2, diffs2);
  const e2 = await L.record({ fileKey: 'proj:a', fileLabel: '甲剧本', diffs: L.strip(diffs2), ts: 2000 });
  const eOther = await L.record({ fileKey: 'proj:b', fileLabel: '乙剧本', diffs: [], ts: 3000 });

  // strip / invert
  ok(L.strip(diffs1).every(function (d) { return Object.keys(d).every(function (k) { return /^(path|type|before|after)$/.test(k); }); }), 'strip 只留 path/type/before/after');
  const inv = L.invert([{ path: 'a', type: 'added', after: 1 }, { path: 'b', type: 'removed', before: 2 }, { path: 'c', type: 'changed', before: 3, after: 4 }]);
  ok(inv[0].type === 'changed' && inv[0].before === 4 && inv[0].after === 3 && inv[1].type === 'added' && inv[1].after === 2 && inv[2].type === 'removed' && inv[2].before === 1, 'invert：新增↔删除互换、修改前后对调（倒序）');

  // 连带链
  const listed = await L.list('proj:a', '甲剧本');
  ok(listed.mine.length === 2 && listed.mine[0].id === e2.id, '列表：本案卷两笔、新的在前（别的案卷不混进来）');
  const chain = L.chainFor(listed.mine, listed.mine.filter(function (x) { return x.id === e1.id; })[0]);
  ok(chain.length === 2 && chain[0].id === e2.id && chain[1].id === e1.id, '撤销第一笔要连带第二笔（从新到旧）');
  ok(L.chainFor(listed.mine, listed.mine[0]).length === 1, '撤销最新一笔只撤它自己');

  // 撤销：回到开工时，但保留别处手工编辑
  const r = L.applyChain(live3, chain);
  ok(r.ok, '撤销链落地成功');
  const expect = JSON.parse(J(base)); expect.characters[1].age = 66;
  ok(J(r.scenario) === J(expect), '撤销后 = 开工时 + 别处手工编辑（孙承宗 66 岁保留）');

  // 冲突：国师改过的那处后来又被手工改了
  const live3b = JSON.parse(J(live3)); live3b.characters[0].title = '我手改的';
  const rc = L.applyChain(live3b, chain);
  ok(!rc.ok && rc.conflicts.some(function (c) { return c.path === 'characters.0.title'; }), '那处后来被手改过 → 报冲突、不覆盖');
  const rf = L.applyChain(live3b, chain, { force: true });
  ok(rf.ok && rf.scenario.characters[0].title === '巡抚', 'force 才覆盖回改前');

  // 恢复（重做）
  const rr = L.redoChain(r.scenario, chain);
  ok(rr.ok && J(rr.scenario) === J(live3), '恢复：从旧到新落回，得到撤销前的样子');

  // 标记 / 汇总
  const up = await L.update(e1.id, { undone: true, undoneAt: 4000 });
  ok(up && up.undone === true, '标记已撤销');
  const after = await L.list('proj:a', '甲剧本');
  ok(L.chainFor(after.mine, after.mine.filter(function (x) { return x.id === e2.id; })[0]).length === 1, '已撤销的不再进连带链');
  const kin = await L.list('draft:new-load', '甲剧本');
  ok(kin.mine.length === 0 && kin.kin.length === 2, '未入库剧本换了载入身份：按剧本名把旧账找回来');
  const sm = L.summarize(diffs1, live1, base);
  ok(sm.counts.add === 1 && sm.counts.chg === 2 && sm.names.some(function (n) { return n.name === '文震孟' && n.op === 'add'; }) && sm.names.some(function (n) { return n.name === '袁崇焕' && n.op === 'chg'; }), '汇总：新增 1（文震孟）· 修改 2（袁崇焕、剧本名）');
  ok(eOther && eOther.fileKey === 'proj:b', '别的案卷各记各的');

  // UI 接线（源码契约）
  const ui = fs.readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8');
  ok(/ui\._onApplied = function/.test(ui) && /L\.record\(entry\)/.test(ui), 'UI：应用后记一笔账');
  ok(/function _undoEntry\(/.test(ui) && /chainFor\(/.test(ui) && /applyChain\(/.test(ui), 'UI：撤销走连带链 + 反向差异');
  ok(/data-lg-undo/.test(ui) && /data-lg-redo/.test(ui), 'UI：改动史逐笔撤销/恢复');
  for (const page of ['preview/scenario-editor-reset-preview.html', 'editor.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const a = html.indexOf('editor-authoring-agent.js'), b = html.indexOf('editor-authoring-agent-ledger.js'), c = html.indexOf('editor-authoring-agent-ui.js');
    ok(a > 0 && b > a && c > b, page + '：改动账脚本装在核心之后、面板之前');
  }

  // 撤销/恢复后告诉国师（tovarish：撤销后告诉模型文件已回滚）：只加在接着说的那条消息上
  {
    const seen = [];
    const caller = (conv) => { seen.push(conv[conv.length - 1].text || ''); return Promise.resolve({ text: '', toolCalls: [{ id: 'f' + seen.length, name: 'finish', input: { summary: '好' } }] }); };
    const first = await AA.runAuthoringLoop(AA.makeDraft(base), '改袁崇焕', { caller, conventions: '', blockingChecks: [], stateNotes: ['不该出现'] });
    ok(!/动过剧本/.test(seen[0]), '新开对话不加便条（模型没有旧记忆，看当前剧本就够）');
    await AA.runAuthoringLoop(AA.makeDraft(base), '接着改', { caller, conventions: '', blockingChecks: [], priorConversation: first.conversation, stateNotes: ['在改动史里撤销了「改袁崇焕」那次应用，共 2 处回到了改前'] });
    ok(/^【玩家在你上次回复之后动过剧本】\n- 在改动史里撤销了「改袁崇焕」那次应用，共 2 处回到了改前\n（以当前剧本为准：撤销掉的改动已经不在了/.test(seen[seen.length - 1]), '接着说时便条写在这条用户消息最前面');
    const ui = fs.readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8');
    ok(/_noteState\('在改动史里撤销了「' \+ _entryTitle\(target\)/.test(ui) && /_noteState\('在改动史里恢复了「' \+ _entryTitle\(target\)/.test(ui), '撤销、恢复成功后各记一句');
    ok(/options\.stateNotes = ui\._stateNotes\.slice\(\); ui\._stateNotes = \[\];/.test(ui), '下次发送带上便条，发出即清');
  }

  console.log('\nsmoke-guoshi-ledger ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
  process.exit(F === 0 ? 0 : 1);
})().catch(function (e) { console.error('CHAIN FAIL', e && e.stack || e); process.exit(1); });
