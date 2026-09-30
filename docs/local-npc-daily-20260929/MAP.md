# 第一批接入核对

基线 22472d247e54956238387defaeda1c50db7acd43。本轮基线命令：`node web/scripts/run-smokes.js --grep npc-action --grep political --grep letter --grep hongyan --grep save-lifecycle --jobs 2 --no-retry --report docs/local-npc-daily-20260929/baseline.json`，19 PASS / 0 FAIL。

| 触发／事实源 | 基线核对 | 本轮已接入 |
|---|---|---|
| enterGame:after / 已提交玩家回应 / 正式模拟边界 | 已有 GameHooks；enterGame 在初始化健康检查后触发。UI 渲染本身不应决定 | 有界本地调度，按本人待答、承诺、结构化目标与已知关系选择 |
| executeNpcBehaviors | 先旧 advance/flush，再 missing_ai_key；idle 在真实时间运行 | 本地常规循环先于模型守卫；idle 不增加日程；本地类型不再次由模型选择 |
| NpcBehaviorRegistry / ActionLedger.executeHuman | 同步短事务，可信人类 context；私人 social 不需组织 | 复用注册和 execute/executeHuman；新活动保存于原 _npcPlans 的明确版本字段 |
| 消息／计划 | 原两方版本2；deliveryTurn + 1；旧凭据类型有限 | 新活动明确三方角色、已送达知识、条款版本和固定来源；专门验证本次阶段、交付和联系凭据 |
| 鸿雁传书 | 正式页面已有通信与计划回应；自由发信、NPC 回信有模型路径及旧皇帝称谓 | 同页面添加结构化本地入口、待回应、交付来源；新消息为同一原事项的只读投影，不走旧自由信消费者 |
| 个人关系／记忆 | AffinityMap 对称，OpinionSystem 按方向记录 sourceId；记忆支持 characterId/_noMirror | 只用本人已知关系；完成阶段才作单向评价，问候不固定奖好感；材料引用而非复制全部记忆 |
| 日历／位置 | getCurrentGameDay 是当前正式日标尺；MapLocations 可区分 resolved/area/unresolved | 不另造日历；存确定期限，不因回合天数重算。明确同地短通联不等于见面，未知／在途不算同地 |
| 保存／恢复 | _npcActionState、_npcPlans 均随原生命周期保存；loadGen 有失效边界 | 在原状态中版本迁移、幂等预算与事项；旧计划按原语义保留。恢复与渲染不额外推进日数 |

不调用 PoliticalActions.bind 来伪造私人组织。仅复用 controlled 与已有可信 executeHuman。普通活动交付不是 notice；使用实际材料文档及当前事项阶段凭据。第一阶段同日工作限短材料整理；需要多日时等待正式游戏时间，保留全局无 Key 过回合守卫。

正式可见页为 Phase8 `renderFormalLetterPanel` / `openDeskOverlay` 中的日常往来区；同时适配旧 `renderLetterPanel`。实际提交链为：`DailyUI` 当前票据或 `LocalAI` 私有签发 → 原注册器/ActionLedger → `DailyActivities.commit` → 原计划内真实消息/交付 → `ActionLedger.advance({localOnly:true})` 同步核验递送 → 本人记忆/有来源评价 → 原保存字段。`GM.letters` 只作投影，旧回复/摘入动作转回同一事项。

首次进入最多四次决定，回合/已提交回应最多四批共四十八次；空转、重复渲染和实际等待不增加预算。远程普通自由信仍沿原通道，不宣称已离线。当地短递话不充当旅行或会面。

P0 查找曾把不存在的时间模块名和 PowerShell 路径通配符传给 rg；已定位真正时钟在 tm-ai-infra.js，改用 git grep 或先枚举文件。没有据此认定模块缺失。
