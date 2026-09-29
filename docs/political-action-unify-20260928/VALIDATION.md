# 验收条件与实际证据对应

下表记录本轮实际覆盖，不把 24 条任务书逐项自动标成“全部完成”。测试均为真实生产模块配合离线夹具；真实模型、玩家存档和完整产品操作不在本表证据中。

| 任务书项 | 实际证据 | 范围限制 |
|---|---|---|
| 1 有权与无权正反向 | political-action-unification、political-boundaries：两国有权授职、公库转移、条约；无绑定与伪授权受阻 | 不是全部职权种类 |
| 2 ID／同名／无君主 | boundaries typed identity、invalid authority；继承 office-holder-stable-identities；真实行权不再 alive[0] | 旧未接管领域仍需逐个审查 |
| 3 代理／集体／常务 | boundaries acting holder、独立议事票；绍宋三票签署；guoku 既有财政过程继续 | 没有新建通用匿名行政引擎 |
| 4 兼任／即刻失权 | 当前 role、scope、到期与改革回归；旧证据保存深拷贝 | 全制度种类未穷举 |
| 5 普通玩家所在国家 | generation：本国真实 NPC 仍授职，玩家无自动行动；guoku/native-fiscal 单周期检查 | 两项分别验证；未跑全部人类角色组合浏览器流程 |
| 6 双边／玩家外交 | 联络建议→两方代表→还价→联盟→盟友战争；原 _wdEnvoyDecision 明确批准 | 当前已支持条约类型 |
| 7 联络／谈判／全权 | liaison draft、negotiating authority、ratification、collective positive | 授权需要真实数据声明 |
| 8 单方 treaty／单方退出 | 无主体与单方生效受阻；legitimate withdrawal 成功 | 通牒所有后果未实现 |
| 9 条款版本／长文 | 长条款完整保存；counter v2；v1 拒绝，v2 成立 | 不依赖截断展示 |
| 10 送达／接受／履行 | 未送达无知识；实际付款人已知 public_transfer 义务才交割；原按钮不再叠加效果 | 通用交易物品未接管 |
| 11 失败／通知／保留 | 签约故障原子回滚；通知失败重试不重签；活跃条约超过展示上限 | 不模拟所有持久化介质故障 |
| 12 更替／在途 | 签发人死亡后的有效在途文书；新签署撤权受阻；组织协议保留 | 不穷举政权继承法 |
| 13 实际任职 | 乙国 fac 树真授职、NativeWorld 双组织；绍宋真岗位；上一轮任免／转任回归 | 不替所有剧本补全权限 |
| 14 竞争／不复制 | 两入口竞争真实余额；单流水守恒；扣款失败；同组织唐库移交 | 原生账户全部组合未验证 |
| 15 正常周期 | guoku legacy 同周期仅一次；native-fiscal-consumers 与既有财政回归 | 保留已有 NativeFiscal/CascadeTax 分工 |
| 16 军令 | 真掌兵者待答、换将、MarchSystem 开拔；无兵额差额；原 command-authority 回归 | 不重写补员／训练／战斗 |
| 17 战争／条约消费者 | 联盟触发现有参战；原 living-world 与战争门槛回归；错误 warId 不换战 | 未声称全部战争规则人物化 |
| 18 同源跨入口 | faction/person 共用 actionId 幂等；SC16 只产候选；继承 npc-action-entrypoints 主推演／Agent 规则 | 没有把所有未接管 Agent 工具纳入统一 |
| 19 伪 receipt／旧效果 | 旧 war、既有 office、错误交易引用、伪 system/source 都不能自证本次操作 | 只覆盖已接管凭据类型 |
| 20 意见冲突／人物预算 | 独立来源不按文本合并；候选可拒绝／暂缓；实际资源与当前身份裁定冲突 | 不是完整的政治争议程序 |
| 21 异步／读档／异常 | 同回合新世界、请求中死亡与撤职、提交余额变化、缺依赖、迁移和提交故障 | 真实模型网络只用 Promise 替身 |
| 22 真实时间／统计 | generated 与 completed 分开；延期至模拟边界；各来源共用预算；正常周期幂等 | 未测长时间实际在线成本 |
| 23 知情 | 最终人物 prompt、工具、SC16 公开投影、未送达还价秘密标记；迟到知识不追认旧候选 | 不保证全游戏所有输入限知 |
| 24 存档／fallback | 无旧 receipt 的迁移、幂等重跑、故障回滚、旧在途原 ID 续办；缺模块不恢复直接差额 | 新语义存档回退需升级前副本 |

主要测试文件：

- `web/scripts/smoke-political-action-unification.js`
- `web/scripts/smoke-political-boundaries.js`
- `web/scripts/smoke-political-generation.js`
- `web/scripts/smoke-political-official-scenarios.js`
- `web/scripts/smoke-faction-npc-llm-decision.js`
- `web/scripts/smoke-faction-npc-endturn-e2e.js`
- `web/scripts/smoke-faction-npc-full-audit.js`
- `web/scripts/smoke-npc-action-loop.js`、`smoke-npc-action-entrypoints.js`
- `web/scripts/smoke-command-authority.js`、`smoke-faction-living-world.js`、`smoke-native-fiscal-consumers.js`

探索失败与最终验收分开保存。改过的旧测试有生产行为替代断言，不以函数名字出现或吞异常计通过。原 smoke 发现规则和既有豁免不改。
