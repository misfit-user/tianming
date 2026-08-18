// @ts-check
// scripts/lint-split-contracts.js — 保序切割契约守卫（2026-07-04）
//
// 背景：巨石立项拆的行为等价性完全建立在「sibling 紧挨 origin 按序装载」上——
//   执行顺序与拆分前逐字节等价。此前只靠 <script> 里的「勿动位置」注释裸奔；
//   任何人（含未来的自己/并行会话/发版工具）挪动或在中间插入脚本都会静默破坏等价性。
// 契约：每座已拆巨石登记一条 [before..., origin, after...] 序列，
//   要求它在对应入口 html 的 <script src> 顺序里**连续且按序**出现。
// 新拆一座巨石 → 在对应入口的 CONTRACTS 里加一条（拆分脚本收尾步骤之一）。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/** index.html 入口的拆分家族（含 origin 自身·按应有顺序） */
const CONTRACTS = [
  // 第一拆+第八拆(二切)：tm-tinyi-v3 四片
  ['tm-tinyi-v3-persona.js', 'tm-tinyi-v3.js', 'tm-tinyi-v3-edict-personnel.js', 'tm-tinyi-v3-parties.js'],
  // 第二拆：tm-chaoyi-changchao 三片
  ['tm-chaoyi-changchao-adapter.js', 'tm-chaoyi-changchao.js', 'tm-chaoyi-changchao-flows.js'],
  // 第三拆：tm-keju-runtime 两片
  ['tm-keju-runtime.js', 'tm-keju-runtime-keyi.js'],
  // 第四拆：tm-wendui 两片
  ['tm-wendui.js', 'tm-wendui-persona-views.js'],
  // 第五拆：tm-npc-decision 两片
  ['tm-npc-decision.js', 'tm-npc-decision-ai-driven.js'],
  // 第六拆：tm-patches 两片
  ['tm-patches.js', 'tm-patches-start.js'],
  // 第七拆：tm-economy-engine 两片(头切·currency 在前)
  ['tm-economy-engine-currency.js', 'tm-economy-engine.js'],
  // 第九拆(alias 范式首例)：keju-paradigm-panel·render 必须在前(alias 装载期解析·错序=undefined)
  ['tm-keju-paradigm-panel-render.js', 'tm-keju-paradigm-panel.js'],
  // 第十拆(IIFE 型首例)：tm-corruption 三片·R9 假性 IIFE(engine+p2+p4 嵌套)倒回·engine 先(挂 CorruptionEngine)→ cases/extras monkey-patch
  ['tm-corruption-engine.js', 'tm-corruption-cases.js', 'tm-corruption-extras.js'],
  // 第十二拆(顶层函数型后缀切)：tm-mechanics NPC记忆/成长片·memory 紧挨 origin(其后为 mechanics-world)
  ['tm-mechanics.js', 'tm-mechanics-memory.js'],
  // 第十三拆(顶层函数型后缀切)：tm-feudal §G-§N warfare片·紧挨 origin
  ['tm-feudal.js', 'tm-feudal-warfare.js'],
  // 第十四拆(顶层函数型中段切)：tm-game-loop §5b 问天直改引擎·紧挨 origin
  ['tm-game-loop.js', 'tm-game-loop-wentian-hardchange.js'],
  // 第十五拆(顶层函数型中段切)：tm-hongyan-office letter 主域留守·中段切出 renderGameState(game-ui-shell)+edict UI(edict-ui)
  //   letter 夹在两片外侧(head=letter part1·tail=register('letters')/doctor/diag)·origin=head+tail·三片须连序
  ['tm-hongyan-office.js', 'tm-game-ui-shell.js', 'tm-hongyan-edict-ui.js'],
  // 第十六拆(顶层函数型尾切)：tm-office-runtime §3 摘要/预警+中推/荐举+选任器片·紧挨 origin(排其后)
  ['tm-office-runtime.js', 'tm-office-runtime-summary-appoint.js'],
  // 第十九拆(IIFE 型·alias 范式)：tm-endturn-followup 27 顶层纯 helper+6 ns 导出迁出·helpers 须在 origin【之前】装载(填 TM.__etFollowupParts bucket·origin 顶部 alias 回绑)
  ['tm-endturn-followup-helpers.js', 'tm-endturn-followup.js'],
  // 第二十拆(IIFE 型·origin-first bucket)：tm-content-manager §2-§5 社区/商城 UI 中段切出·community 须【紧随 origin 之后】
  //   origin 装载期向 bucket TM.__cmParts 导出 kept 成员→community 闭包捕获；community 回填 §2-§5 函数→origin 委托 shim 调用期解析·错序即崩
  ['tm-content-manager.js', 'tm-content-manager-community.js'],
  // 第二十三拆(顶层函数型中段切·保序切割)：tm-ai-infra 模型探测系统 中段切出·model-detect 须【紧随 origin 之后】
  //   经典 <script>(非 module)·顶层 var/function 全局互见·无 bucket；origin 对本片函数引用全在函数体内(运行时·typeof 守卫)·故本片载于 origin 之后安全
  ['tm-ai-infra-json.js', 'tm-ai-infra.js', 'tm-ai-infra-model-detect.js'],
  // 第二十四拆(IIFE 型·origin-first 双向 bucket)：phase8-formal-rightrail 社会层/阶层党派观测中段(行1359-3113)切出·social 须【紧随 origin 之后】
  //   origin 装载期向 bucket TM.__p8RailParts 导出 5 kept body 函数→social 闭包捕获；social 回填 13 社会层/面板函数→origin 委托 shim(renderers[kind]()/flyout/handler)调用期解析·错序即崩
  ['phase8-formal-rightrail.js', 'phase8-formal-rightrail-social.js'],
  // 第二十五拆(IIFE 型·②b origin-first 双向 bucket)：phase8-formal-map 军队对账+regionBundle 数据装配层[orig 2235-2675]+方志谱牒册页 UI[orig 2881-3893]双段切出·dossier 须【紧随 origin 之后】
  //   origin 装载末向 bridge.__p8MapParts 导出 45 kept 成员→dossier 闭包捕获；dossier 回填 5 函数→origin forward shim 调用期解析。§5 计分带(GRADE_BANDS 直读)留守·错序即崩
  ['phase8-formal-map.js', 'phase8-formal-map-dossier.js'],
  // 第二十六拆(真 IIFE·origin-first 双向 bucket)：phase8-formal-drafts 御案奏疏(zou-yuan)+鸿雁(yan-yuan)面板中段切出·message-panels 须【紧随 origin 之后】
  //   origin 装载期向 bucket TM.__p8DraftsMsgPanels 导出 18 个捕获成员→message-panels 闭包捕获；sibling 回填 9 个函数→origin forward shim 调用期解析·错序即崩
  ['phase8-formal-drafts.js', 'phase8-formal-drafts-message-panels.js'],
  // 第二十七拆(IIFE 型·②a alias/bucket)：phase8-formal-bridge 4 样式注入函数(installStyles/installTopbarExactStyles/installActionEntryExactStyles/installFormalVisibilityStyles)迁出·styles 须在 origin【之前】装载(填 bucket TM.__p8BridgeParts·origin 顶部 alias 回绑)
  //   纯 CSS 注入·零闭包依赖；origin 装载期 installFormalShell 同步调用 installStyles 等·错序即别名 undefined 崩
  ['phase8-formal-bridge-styles.js', 'phase8-formal-bridge.js'],
  // 第二十二拆(IIFE 型·origin-first 双向 bucket)：tm-ai-change-applier 一致性校验器族(validators)+复核/善后族(reconcile) 两分片须【紧随 origin 之后】按序连续
  //   origin 装载末尾向 bucket TM.__acaParts 导出 12 个 kept helper→两分片闭包捕获；两分片回填校验/复核函数→origin 32 委托 shim 调用期解析·错序即崩
  ['tm-ai-change-applier.js', 'tm-ai-change-applier-validators.js', 'tm-ai-change-applier-reconcile.js'],
  // apply解构S2(类③巨石·IIFE 型·origin-first)：tm-endturn-apply writeBack 两端最独立 stage(AP-1 _applyCore_reconcile
  //   + AP-6 _applyPostValidateAssemble)迁出·stages 须【紧随 origin 之后】。origin writeBack 变薄为 dispatcher·
  //   运行时(回合推演调用期)调 ns.stages.<stage>(ctx)——两片装载期不互调仅定义·故 sibling 载于 origin 之后安全
  ['tm-endturn-apply.js', 'tm-endturn-apply-stages.js'],
];

/** editor.html 入口的拆分家族（编辑器侧巨石） */
const EDITOR_CONTRACTS = [
  // 第十八拆(真 IIFE ui-bucket 范式)：editor-authoring-agent-ui 三片·icons 在 origin【前】(叶子·发布_icon/injectStyles/_TOOL_ICON)
  //   render 在 origin【后】(纯消费·读 ui 共享单例+origin 助手)·origin 反向 shim 委托两侧。preview 双入口同步(未被本 lint 校验)
  ['editor-authoring-agent-ui-icons.js', 'editor-authoring-agent-ui.js', 'editor-authoring-agent-ui-render.js'],
  // 第十一拆(真 IIFE alias 首例)：editor-authoring-agent Provider 簇(D)迁出·provider 须在 origin【之前】装载(填 TM.__aaParts bucket·origin 顶部读 alias)
  ['editor-authoring-agent-provider.js', 'editor-authoring-agent.js'],
  // 第十二拆(editor.html 侧同族)：tm-mechanics memory 片(index.html + editor.html 双入口装载)
  ['tm-mechanics.js', 'tm-mechanics-memory.js'],
  // 第十三拆(editor.html 侧同族)：tm-feudal warfare 片(index.html + editor.html 双入口装载)
  ['tm-feudal.js', 'tm-feudal-warfare.js'],
];

/** preview/scenario-editor-reset-preview.html 入口的拆分家族（Codex 复审指出的覆盖缺口·2026-07-06 补） */
const PREVIEW_CONTRACTS = [
  // 第十八拆：preview 只载 agent→ui 三片(不载 provider=既有不对称)·三片序须与 editor.html 一致
  ['editor-authoring-agent-ui-icons.js', 'editor-authoring-agent-ui.js', 'editor-authoring-agent-ui-render.js'],
];

// 提取 <script src="X.js?v=..."> 的有序文件名列表（裸文件名·忽略 query 与 ../ 类路径前缀——preview 子目录用 ../ 引根级脚本）
function loadOrder(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const order = [];
  const re = /<script[^>]+src="([^"?]+)(?:\?[^"]*)?"/g;
  let m;
  while ((m = re.exec(html)) !== null) order.push(m[1].replace(/^(\.\.\/)+/, ''));
  return order;
}

function checkContracts(order, contracts, entry) {
  let failed = 0;
  for (const seq of contracts) {
    const idxs = seq.map(f => order.indexOf(f));
    const missing = seq.filter((f, i) => idxs[i] === -1);
    if (missing.length) {
      console.error(`[lint-split-contracts] FAIL ${seq[0]} 家族：${entry} 缺装载点 ${missing.join(', ')}`);
      failed++;
      continue;
    }
    // 连续且按序：idxs 必须严格 +1 递增
    let ok = true;
    for (let i = 1; i < idxs.length; i++) if (idxs[i] !== idxs[i - 1] + 1) ok = false;
    if (!ok) {
      console.error(`[lint-split-contracts] FAIL ${seq[0]} 家族：${entry} 装载序被打断/乱序（实际位次 ${idxs.join(',')}）——保序切割等价性要求 sibling 紧挨 origin`);
      console.error(`  应为连续序列：${seq.join(' → ')}`);
      failed++;
    }
  }
  // 附加不变量：每片有且仅有一个装载点（重复装载=同名顶层函数静默覆盖）
  for (const seq of contracts) for (const f of seq) {
    const n = order.filter(x => x === f).length;
    if (n > 1) { console.error(`[lint-split-contracts] FAIL ${f}：${entry} 装载 ${n} 次（应恰 1 次）`); failed++; }
  }
  return failed;
}

let failed = 0;
failed += checkContracts(loadOrder('index.html'), CONTRACTS, 'index.html');
failed += checkContracts(loadOrder('editor.html'), EDITOR_CONTRACTS, 'editor.html');
failed += checkContracts(loadOrder('preview/scenario-editor-reset-preview.html'), PREVIEW_CONTRACTS, 'preview/scenario-editor-reset-preview.html');

const total = CONTRACTS.length + EDITOR_CONTRACTS.length + PREVIEW_CONTRACTS.length;
if (failed === 0) {
  console.log(`[lint-split-contracts] PASS · ${total} 座拆分家族装载序契约全部成立（index.html ${CONTRACTS.length} + editor.html ${EDITOR_CONTRACTS.length} + preview ${PREVIEW_CONTRACTS.length}）`);
  process.exit(0);
}
process.exit(1);
