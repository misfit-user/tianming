# 本地人物模拟首版候选报告

## C1：版本与接线

- 当前正式基线：`d8915fa67493d1003ededdf5182f8cc6994eda2c`，与 `origin/main` 一致。
- 按需规划前序移植：`6dd5a146`，来自 `ae156eb2`。
- 生活组合前序移植：`73227f08`、`a7519993`、`a0424d59`，来自 `c65e43d6`、`b0d65815`、`4bcc6db9`。
- 当前候选分支：`codex/npc-life-candidate-20261010`。
- 当前正式入口固定为 main 已有 `tm-npc-daily-ui.js` / `scripts/electron/npc-daily-cases.cjs`；没有合并 `claude/newui-foundation-20261005`。
- 共同安排、现场阶段、结果和返程由同一 `TM.NPC.Meetings` plan 写入；消息/知情由 `DailyActivities` 与 `ActionLedger` 写入；路线由 `Meetings`/`MapLocations` 写入；职任由 `OfficeTenure` 查询；成长由 `CharacterGrowthSystem` 写入；规划由 ActionLedger 引用实际 activity 结果。

## C2：三条流程

### 流程一：私人赴约

真实材料 → 本地机会 → 同一 meeting 约见 → 双方实际到场 → `question` / `answer` → discussion result → 各自行程返程。使用《绍宋·建炎元年八月（官方）》513 人物、39 势力和官方地图，通过 `smoke-npc-composite-official.js` 生产模块回归，结果为 `done`，模型调用 0。

### 流程二：职任约束

`OfficeTenure` resident/field 配置在出发和现场入口重验；无 leave 的 resident 远行停在 `waiting_departure`，合法可行的 field/允许安排可出发。多职无法唯一解析时不按职位列表顺序猜。此流程在真实 OfficeTenure 模块与 meeting 旅行回归中通过，正式 UI 场景未验。

### 流程三：重要变化规划

`smoke-npc-ai-routing.js` 覆盖本人获知的重要变化、两步依赖、实际回应后激活下一步、同局依赖变化使旧结果失效、读档迟到结果丢弃和普通步骤不重复调用模型。该流程生产模块通过，官方正式页面未验。

三条流程目前均是“生产模块通过”；由于 Electron runtime 缺失，不能标记为正式页面完整通过。

## 试玩入口

使用正式 `tm-npc-daily-ui.js` 页面，打开人物志 → 日常往来/书信 → 选择已有联系人和“相约读札／当面请益”。先让邀请实际送达并接受，再用正式日期推进到场；到场后按页面出现的“先问理解/解释要点/提出不同看法”选择，等待对方独立回应，最后查看讨论结果和返程。玩家不需要填写内部 ID。

## 测试证据

- `node web/scripts/smoke-npc-travel.js`：10 groups。
- `node web/scripts/smoke-npc-ai-routing.js`：7 groups。
- `node web/scripts/smoke-npc-life-opportunities.js`：11 groups。
- `node web/scripts/smoke-npc-daily-lifecycle.js`：17 groups。
- `smoke-npc-daily-activities.js`、`smoke-npc-daily-boundaries.js`、`smoke-office-tenure.js`、`smoke-office-duty-reliability.js`：通过。
- `node web/scripts/smoke-npc-composite-official.js`：官方《绍宋》生产模块通过，0 API attempt。
- `node web/scripts/lint-arch-all.js`：通过。
- `node scripts/verify-release-contract.js`：182 assertions 通过。
- `node web/scripts/verify-official-scenario-parity.js`：41 assertions 通过。
- 原生准备清单、启动清单、热更基线 hash/size 检查：通过。

## C3 与限制

- `scripts/electron/npc-daily-cases.cjs` 已接入正式页面、顶层 endTurn、保存/加载和组合 meeting 场景，但本候选没有 `node_modules`，可复用的锁定依赖也缺少 `electron/dist/electron.exe`；`verify-electron-bridge.js --npc-daily` 未运行成功。
- 因此正式页面三流程、两处真实保存/加载和持续 30 日场景仍是待验，不把 production smoke 当成完整试玩。
- 本候选未改版本、未打包、未部署、未推送、未创建 PR、未合并。
- 其他两个官方剧本只通过现有 parity/加载兼容检查，未宣称完整三流程。
