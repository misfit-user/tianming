# NPC 行动回执与持续互动

## 行为变化

旧 NPC 包装器可能把处理器提前返回视为成功，任免与合作也可能只写叙述或关系。本次统一到现有 NpcBehaviorRegistry / ActionLedger：处理器交回明确阶段和可验证领域引用，漏返回、伪造凭据、失效身份及写入异常不能产生完成记录。

- 任免回写现有职任真源；奖励核对实际私财与交付条件；公库移交使用 PublicTreasury 的账户、权限及额度检查。建议、处分请求、改革提案和拨款请求保留其提交阶段。
- 请求、送达、回应、协商、履行、反馈沿用同一计划及来源。玩家必须明确选择；不同人物只取得已送达的信息，并保留各自评价。
- 无官人物的已送达请求、到期承诺和可执行计划进入有限轮转。活跃计划不受展示上限裁剪，存档保留阶段与去重凭据。
- 所涉主写回、独立 NPC、Agent 关系入口共用执行边界；报告不重放实际操作。异步生成返回后检查当前世界与身份；空闲计算只留提案，到模拟边界再提交。
- 性格影响判断，不以单个特质禁止奖励、惩处或对外宣战。能力不能直接创造公私财富或治理收益。

## 真源与接线

正式加载顺序仍为 `tm-npc-engine.js → tm-npc-action-ledger.js → tm-npc-decision.js → tm-npc-decision-ai-driven.js`；已退役全局引擎没有恢复。

`tm-endturn-apply.js`、`tm-relations.js` 与 AI applier 的已接管动作进入共同账本。SC15/SC15n 重述只记录来源；`tm-endturn-pipeline-steps.js` 校验异步世界租约。个人经历沿用 NpcMemorySystem，单向评价沿用 OpinionSystem，交办承诺沿用 ImperialOrders，恢复沿用原保存生命周期。

旧能力金额公式及合作自动奖励被具体文书、协办与已授权账户操作接管。现有 CharEconEngine / CharacterEconomyLedger 日常经济仍保留原执行者。旧自报完成标为 legacy_reported，不补出资产、授职或奖励；旧未完事项可在原记录中重拟。

## 验证

源码基线为 `9b4f253f31de64d1928ded0401b95ccdc50f2c72`，其文件树与远端 `06fb9b6a4584fea7e547836ba894536e8666d053` 完全一致。为保持 PR 范围，提交接在后者之上。`frozen-inputs.json` 保存本轮 30 个源码/回归文件的验收 SHA-256。

| 本地命令 | 结果 |
|---|---|
| `node web/scripts/smoke-npc-action-loop.js` | 32 组通过 |
| `node web/scripts/smoke-npc-action-entrypoints.js` | 25 断言通过 |
| `node docs/npc-action-loop-20260928/domain-extra.cjs` | 21 断言通过 |
| `node web/scripts/ci-smokes.js --jobs 2` | 1139 PASS、0 FAIL、0 SKIP、2 项既有缺失资产豁免 |
| `node web/scripts/lint-arch-all.js` | 15/15 PASS |
| `node web/scripts/verify-official-scenario-parity.js` | 41 断言通过 |
| `node scripts/verify-release-contract.js` | 182 断言通过 |
| `node scripts/sync-hot-baseline.js --check --version 1.3.5.3` | PASS；缺席的未跟踪资产条目保留 |
| `node web/scripts/build-renderer-modules.js --check` | 正式 bundle 可重现 |

完整生产模块在本地 VM 中走实际主写回和保存入口：两名无官人物完成请求、回应、文书交付、反馈；非皇帝官员提出公库移交，协作者回应，失权时等待，恢复有效权力后实际扣/入 40，并在同一事项核收。另测拒绝、改条件、未送达、取消、调任交接、玩家明确回书、同名对象、跨来源重试、资源变化和故障回滚。

已有回归中锁定的自拨款、能力生财、共享私密上下文及姓名级封锁断言，已替换为实际领域结果、守恒、限知和独立行动断言。测试加载完整生产模块，没有复制实现自证。原子回滚测试会故意触发通知渲染异常，该异常不撤销已提交操作或导致重试重复。

`metrics.json` 记录同设备、100 人、每次 10 份例行文书、12 次运行的比较：模拟模型调用仍为 1 次；世界序列化体积约 59 KB → 69 KB；200 个独立待办保留数 99 → 200。没有真实模型耗时或大型玩家存档性能结论。

## 范围与后续

- 未运行真实模型、生产玩家存档、完整浏览器视觉或移动端验收。
- 限知输入覆盖本轮独立批量、单人兼容、Agent 关系专家和计划检索。主推演/SC15 的其他世界结算字段、其他 Agent 专家与旧对话没有全面改成逐角色知识输入。
- 通信按明确模拟回合递送；未补齐全部驿路、拦截、实物运输或私人事业消费者。支用权须由真实职任明确声明，没有按官名授予权限。
- 不改界面入口名称，不扩展国家或行政区划，不改版本，不部署或打包。原始本地验收记录和补丁保留在工作副本。
