# 接管矩阵

基线：`ae4ba9c15cc58c21cf5fb322a8c195bdf26c8cbe`，继承 PR #89。这里区分已接管范围与现存独立领域，不能读作全引擎统一完成。完整门禁结果另见报告。

## 真实加载与共同入口

`index.html → OfficeHolderState / NPC ActionLedger / NpcBehaviorRegistry → tm-political-actions.js → FactionActionEngine / FactionDiplomacy`。

`FactionNpcLlmDecision.decideFor → 先绑定实际人物、组织、职任、world lease → 人物限知 prompt / tools → 原网络调用 → 再验证 → ActionLedger.state.politicalPending → endturn apply.writeBack 内 flush → 下表领域写口 → ActionLedger 短事务 / operationRefs → 人物经历 / 关联展示 → 原 _buildSaveState / _restoreSavedFields`。

不恢复 `NpcEngine`、`InteractionSystem`。`PoliticalActions` 是身份与提交适配器，没有自己的世界、账户或条约库。原 `GM.facs`、`GM.officeTree`、`fac.officeTree`、`nativeWorld` 都在同一个 world 中读取，不临时替换 GM。

## 效果所有者与切换

| 范围／生产者 | 输出语义与决定依据 | 最终写口／凭据 | 报告、保存与回退 | 本轮状态 |
|---|---|---|---|---|
| 势力 office / 人物 appoint、dismiss、transfer | 人物候选；当前具体组织／岗位任职的 appointment 权，兼任须选本次身份 | 原 `_offAppointCharacter` / `_offVacatePersonSlot`，NativeWorld.officePermission，前后岗位读回 | 统一 action+phase；任职经历只在真写入后生成；原树保存 | **接入共同规则**。另一 NPC 政权、native 双树、正式主写回及跨入口重复已行为测试 |
| 势力 fiscal_policy / 人物 office_duty transfer | 具体用途、实体账户、金额；当前 treasurySpend 与账户保管范围分别检查 | 原 PublicTreasury.transfer；核对 action、前后余额、debits/credits、库存／可用额／额度 | 同一流水及行动回执；扣款失败或提交异常回滚；无模块不恢复 treasuryDelta | **接入共同规则**。竞争、守恒、失败、旧凭据、额度测试；晚唐官方实体库转移 |
| FactionNpcGuoku 周期 | 有来源的财政过程；继续沿 NativeFiscal / CascadeTax / legacy 分工 | 原财政真账；legacy 增加模拟周期幂等 | 原 npcFiscalLedger；sourceKind=world_process；玩家财政存储边界保留 | **保留正常领域结算**。没有将 fiscal_policy 类型名一概当成政治候选 |
| diplomacy action / recordProposals / applyResponses | 候选、签发、送达、回应、当前版本签署分别记录；联络者无最终代表权 | 原 fac._incomingProposals → TreatySystem.createTreaty → 原 GM.treaties；核对两方签署／完整条款版本／本次操作 | 原队列与条约保存；双方各自知识快照；无依赖返回 blocked，不恢复单侧条约写入 | **接入共同规则**。NPC↔NPC、还价、旧版拒绝、玩家回应、保存续办、真实盟友参战消费者 |
| collective treaty council | 剧本明示议事席与规则版本；当前任职分别表决、达到声明门槛才成立 | 同一提案的 collectiveVotes 与最终 collective signature，不造第二条约库 | 成立后组织义务延续；尚未成立的表决重验任职 | **接入共同规则（条约范围）**。合成规则与绍宋既有勃极烈会议配置均有正向测试；不是通用宪制引擎 |
| 原使节按钮 / TM.Negotiation | 明确的人类回应；会话只是同一提案版本的视图 | `_wdEnvoyDecision → recordPlayerResponse → executeHuman → 同一 respond/lodge` | 阻止旧按钮再次加邦交、支付岁币或结束战争；回价保留完整条款 | **接入共同规则**。现有 UI 入口行为测试；未新增界面 |
| unilateral withdrawal | 本方有权人退出自己已知的有效协议；不需要对方再同意 | TreatySystem.breakTreaty；本次 active→inactive 与行动 ID | 保留旧签署和履行历史；刷新派生联盟缓存 | **接入共同规则**。已测试 |
| 物资外交条款 deal / ultimatum | 接受条款形成未履行义务；明确 public_transfer 条款由实际付款人知情后作出执行决定 | 同一提案 obligations → 原 PublicTreasury.transfer → 原义务记录真实流水；核对版本、账户、金额、当前职权 | 接受本身不付钱。transferToPlayer 只接受真实义务与付款依据；重复请求读取原回执 | **已接具体公库交割；通用贸易／通牒效果未接管**。扣款不足、未知条款、重复与真正交付均测试 |
| military_order | 当前军令身份与军队所属组织；掌兵者只能签自己的回应 | CommandAuthority → Army 或 MarchSystem；真实 command / march / army_operation 前后凭据 | 待接令、换将、开拔分别记；不能用命令夹带兵额／士气／训练差额 | **接入共同规则**。有权换将、实际掌兵者待答、开拔与无路失败测试 |
| declare_war / join_war | 当前 declareWar 权与明确敌方；同名不明时不借名字猜对象 | 原 CasusBelliSystem；保留玩家战争门槛、停战、重复、参战规则；本次新战争绑定 actor/action | 私有签发令牌防直接 applier 旁路；已有盟约常设参战仍走原消费者 | **接入共同规则**。80 项 living-world 检查与新增边界测试；错误显式 warId 不再改选另一战 |
| 本地 memorial / edict / chaoyi / office 模板 | 发现事项、候选办法；不自动代人物同意 | 原 `_npcPlans` 中 political_candidate → 人物采纳／拒绝／暂缓 → 上述领域；文书用现有 NPC 双向通信 | 展示引用同一 planId/actionId；候选有界保留；不自动奖忠诚、公帑、政绩 | **候选接入共同规则；记录是报告投影**。天启真实人物的文书往返测试 |
| SC16 full/lite | 公共世界背景的战略建议；must_follow 等旧模型措辞不赋权 | 公开事实投影 → 实际人物的候选事项 | 原策略缓存标 proposal；不直接写 relation；不强制采纳 | **候选接入共同规则**。秘密标记与无世界效果测试 |
| eager / in-turn / idle / manual | 不同调度方式，生成尚未执行 | 共享预算、lease、延期 packet；明确模拟边界提交 | 回合／读档／死亡／调任后重验；真实等待不提供额外财政周期 | **接入共同规则**。模拟网络延迟与正式写回测试 |
| 原主推演 npc_actions / interactions / correspondence、SC15/15n、Agent 人物入口 | 延续 #89 的意图／报告区分与稳定 action+phase | NpcBehaviorRegistry / ActionLedger；同种任职、账户、战争共用领域 | 叙述不能重放；玩家不被自动承诺 | **继承并回归**。不声明所有 Agent 专家输入都已全游戏限知 |
| province_policy / rebellion_policy / spy_or_intrigue | 仍有原领域／策略压力裁定 | 原地方数值、rebellion/intrigue pressure；已切掉 intrigue 借道直接外交写入 | 原保存与开关。未把这些称为已完成的人物政治链 | **本轮未接管** |
| 既有政策／改制、生产、正常税收、战斗／行军过程 | 已成立规则或受控领域过程 | 原 OfficeReform、NativeFiscal、CascadeTax、战斗与行军真源 | 不重新请 NPC 批准、不重放周期 | **保留正常领域结算**；未重写全行政、生产和战争裁定 |
| 历史事件 proposal | 可信的玩家明确选择；普通人是联络建议，有代表权才签署 | recordPlayerProposal → executeHuman → 原外交事项 | event/branch/op 来源稳定，不替另一方接受；原历史事件入口保留 | **接入共同规则**。有权人、普通联络人、重复来源均测试 |
| 历史事件 factionDelivery | 旧 accepted 标签不构成支付授权；需 typed obligation 与付款人决定 | 与上述公库交割同一写口 | 缺少材料返回 blocked，不伪造完成；需要为具体旧事件补有来源的履行资料 | **受控入口已接；未逐一升级全部旧历史交付配置** |
| 势力 LLM raw.builds / repair / goalUpdates | 原代码可按模型报价和自报收益直接扣／加财产 | 新 decideFor 没有继续调用这些旧写口；既有建筑、维修和正常建设过程仍由原领域推进 | 缺少统一授权与预算适配，不能回退自动调用旧差额消费者 | **主动生成路径未接管**。这部分自动能力尚待恢复，不能说全部旧势力能力已保留 |

## 当前证据级别

- `reproduced-before.log`：基线真实模块复现无主体增帑、单侧签约、跨组织任职查位失败、旧战争冒充新回执、同周期重复财政共五项。不是复制函数片段。
- 新政治行为、边界、生成、三官方剧本测试：生产模块 + 明确合成世界或 canonical 官方数据 + 模型替身；不是真实模型或浏览器验收。
- 正式 `TM.Endturn.AI.apply.writeBack` 与 `_buildSaveState / _restoreSavedFields` 已加入行为回归。
- 职任选择、推理前绑定、提交前复核共用 effective assignment。当前代理、到期、死亡、改制与同回合换人立即重验；已完成的 authorityBasis 保存历史快照，不随岗位对象改写。
- 输入中的提案版本与完整条款签名随 binding 保存到延期 packet。只有决策时已经送达／读到的版本才能被回应；迟到知识不能倒过来批准旧候选。工具主动取得材料时更新实际输入证明。
- 旧测试中“解析失败也算执行”“单侧条约”“任意差额增帑”“回信自动增加双方宿怨”“整国玩家冻结”改为验证对应正向流程和拒绝条件。原军令、财政、协议消费者、身份歧义、解析诊断与保存检查保留或加强。

## 三官方剧本

| 剧本 | 当前分支 | 最小新增配置与实际正向例子 | 明确限制 |
|---|---|---|---|
| 天启七年 | legacy 任职／财政 | 后金汗、察哈尔可汗的既有具名职任补稳定 ID 和交涉／签约权；两方文书送达后互不侵犯协议；另测官方人物文书往返 | 没有给所有外藩官员授万能权；未补全其财政额度／下级任免 |
| 绍宋 | legacy 任职／财政 | 原勃极烈五席声明集体规则，具名者分开选择；大夏已有君主补交涉身份；三票成立组织签署；金国真实空缺授职 | 五席过半为明确标注的本轮模拟配置；缺少人物记录的席位不虚构人；不是史实考据新增结论 |
| 晚唐 | legacy + declared PublicTreasury / CascadeTax 账户 | 魏博、成德节帅原职责上补受限外交、本府书吏任用、所属实体库移交范围；真实互不侵犯与魏州→博州库存转移 | 未把资料未详的书吏当成空缺；无额度时只允许明示同组织库存移交，不能新增预算或对外付款 |

新保存语义不能靠关开关安全回退。新行动回执、条约版本和在途 packet 要由支持本语义的代码继续读取；回退到旧代码应使用升级前副本，而非重新播放差额。
