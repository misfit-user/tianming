#!/usr/bin/env node
'use strict';
/* smoke-authoring-agent-fiction — 国师 agent 虚构/架空世界观档(worldKind:'fictional')：
 *   ① 去史实锚定的系统提示(虚构世界观·不提违背史实·checkHistory 改设定自洽)；
 *   ② 结构速查把 dynasty/emperor 解读为自拟政权/君主、并点出 world/worldSettings 世界观容器；
 *   ③ 人物完整性校验对虚构世界豁免「五常」(仍查能力越界/势力绑定)。
 * 史实档(默认/historical)保持原有考据行为不变(回归)。
 * 系统提示经 runAuthoringLoop + 自定义 caller 捕获 opts.system(同既有 smoke 范式·不触网)。 */
const path = require('path');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-authoring-agent-fiction');

(async function () {
  // ── buildSchemaGuide 两档 ──
  const gH = AA.buildSchemaGuide();
  const gHx = AA.buildSchemaGuide('historical');
  const gF = AA.buildSchemaGuide('fictional');
  ok(/dynasty\(朝代\)/.test(gH) && /emperor\(帝王\)/.test(gH), '史实速查保留 dynasty(朝代)/emperor(帝王)');
  ok(/factions/.test(gH) && /characters/.test(gH) && /禁止英译/.test(gH), '史实速查保留主要实体+禁英译(回归)');
  ok(gH === gHx, 'buildSchemaGuide() 等价 buildSchemaGuide("historical")(默认史实)');
  ok(/dynasty\(时代\/政权名/.test(gF), '虚构速查 dynasty 改读为「时代/政权名」(自拟)');
  ok(/worldSettings/.test(gF) && /world\{/.test(gF), '虚构速查点出 world/worldSettings 世界观容器');
  ok(/isFictional/.test(gF), '虚构速查提示人物置 isFictional');
  ok(/worldSettings/.test(gH), 'world/worldSettings 容器也出现在史实速查(补审计缺口·两档都点出)');

  // ── 系统提示两档(经 runAuthoringLoop 捕获 opts.system) ──
  let cap = '';
  const cc = (conv, tools, opts) => { cap = (opts && opts.system) || ''; return Promise.resolve({ toolCalls: [{ name: 'finish', input: {} }] }); };

  await AA.runAuthoringLoop(AA.makeDraft({ factions: [] }), '建个剧本', { caller: cc });
  const sysH = cap;
  ok(/历史策略游戏/.test(sysH), '史实档 system 自称「历史策略游戏」(回归)');
  ok(/违背史实/.test(sysH) && /checkHistory/.test(sysH), '史实档 system 保留违背史实进谏 + checkHistory 自查(回归)');

  await AA.runAuthoringLoop(AA.makeDraft({ factions: [] }), '建个奇幻剧本', { caller: cc, worldKind: 'fictional' });
  const sysF = cap;
  ok(/虚构\/架空世界观/.test(sysF), '虚构档 system 声明「虚构/架空世界观」');
  ok(/奇幻|武侠|异世界/.test(sysF), '虚构档 system 列举奇幻/武侠/异世界等原创设定');
  ok(!/违背史实/.test(sysF), '虚构档 system 去掉「违背史实」锚定');
  ok(/世界观自洽性/.test(sysF), '虚构档进谏改以「世界观自洽性」为据');
  ok(/不要用 checkHistory/.test(sysF), '虚构档明确不用 checkHistory 纠结真实史实');

  const draftF = AA.makeDraft({ factions: [] }); draftF.worldKind = 'fictional';
  await AA.runAuthoringLoop(draftF, '继续', { caller: cc });
  ok(/虚构\/架空世界观/.test(cap), 'draft.worldKind=fictional 持久字段也触发虚构档(无需 opts)');

  // ── 人物完整性校验：虚构世界豁免「五常」 ──
  const charNoWC = [{ name: '剑神', faction: '天剑宗' }, { name: '魔尊', faction: '血魔教' }];
  const facs = [{ id: 'f1', name: '天剑宗' }, { id: 'f2', name: '血魔教' }];
  const rH = AA.validateDraft({ characters: charNoWC, factions: facs }, 'char-completeness');
  ok(!rH.ok && /五常/.test(rH.violations.join('')), '史实档:史实人物缺五常 → 违规(回归)');
  const rF = AA.validateDraft({ worldKind: 'fictional', characters: charNoWC, factions: facs }, 'char-completeness');
  ok(rF.ok || !/五常/.test(rF.violations.join('')), '虚构档:缺五常豁免(无五常违规)');
  const rOob = AA.validateDraft({ worldKind: 'fictional', characters: [{ name: 'X', faction: '天剑宗', intelligence: 250 }], factions: facs }, 'char-completeness');
  ok(!rOob.ok && /越界/.test(rOob.violations.join('')), '虚构档:仍查能力值越界(只豁免五常·非全豁免)');

  console.log('\nsmoke-authoring-agent-fiction ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
  process.exit(F === 0 ? 0 : 1);
})();
