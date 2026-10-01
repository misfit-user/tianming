# 人物时空与真实赴约

## 基线

- 起始工作基线：`c64707e9884f91159efbba3a5a6748c3b9c836f0`（PR #91 合并后的本地人物 AI 日常交互）。
- 本分支：`codex/character-travel-20260930`。工作期间 `origin/main` 后继了一个模型上下文修复，提交前会合并该后继基线。
- 未恢复已退役的 NpcEngine/InteractionSystem；沿用 ActionLedger、DailyActivities、Hongyan 面板、GM.chars 与既有保存机制。

## 事实所有者

| 事实 | 唯一生产读写位置 |
| --- | --- |
| 模拟日期 | `TM.SimTime`；endTurn 在事务内 prepare/commit，`tm-ai-infra.js` 与时间显示只读取它 |
| 人物实际位置 | `GM.chars`；`TMMapLocations` 负责地点解析，既有 `_travelFrom/_travelTo/_travelRemainingDays` 负责物理行程 |
| 路线与耗时 | `TM.MapRouteDays.planRoute`；严格区分可达、不可达、未解析、坐标缺失，旧 `daysBetween` 仅保留给行政兼容消费者 |
| 消息递送 | 约见计划中的 `messages` 与 `TM.NPC.ActionLedger`；跨地递送绑定发出时已知收件地，不追踪秘密位置 |
| 活动参与 | `TM.NPC.Meetings.advanceWithin`，只在双方按程序抵达同一目标地且仍在窗口内写入 participation |
| 任职 | 既有 OfficeHolderState / AI change applier；本轮旅行不写 `_travelAssignPost`，不会抵达即复职 |
| 页面 | Hongyan 正式面板是上述计划与回应的投影，不能绕过稳定 ID、阶段和票据直接写世界 |

## 本轮接线

`LocalAI` 读取已知关系、公开地点、目标和待办 → `DailyActivities`/`Meetings` 产生本地选择 → ActionLedger 同步事务验证 operation evidence → 同一计划保存消息、阶段、行程和经历 → Hongyan 面板显示回应/在途/抵达/返程。

日期步长在 endTurn 开始时锁定，提交失败由既有事务回滚；读档缺少时间段时建立一次 `unknown_step_history` 基准，不重放旧收支或旅行。路线缓存包含地图路网指纹，原地修改 neighbors/edges 会失效。

## 支持与边界

- 首版支持有明确地块代表点的陆路邻接；`walking`、`horse`、`courier` 使用集中游戏参数，显式 `boat` 边可用舟行。没有完整驿站、季节水文或跨地图自动补路。
- 已接通跨地约见、递送、接受/婉拒/改期、真实去程、到场、实际会面、返程；路线版本变化会暂停在途，取消可在当前位置停止，不瞬移。
- 官员既有赴任/免职物理字段继续由原领域处理；完整请假、差遣、代理和归任制度不在本轮。
- 本轮新旅行/活动链不调用模型；战争、财政及其他正式 endTurn 过程仍保留原有 API 守卫。
