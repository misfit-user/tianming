> 附录二：一回合的 AI 调用与确定性系统（2026-09-30 Codex 只读勘察，基线 c64707e9）。我抽核过：无密钥时入口直接返回（tm-endturn-core.js:359-372）；系统步里唯一的 GM.turn++ 在 tm-endturn-systems.js:65（报告写 59 行）；三部剧本每回合天数 30、10、30。其余行号以报告为准，引用前复核。

# 一回合里的 AI 调用与确定性系统全表

调查对象：`D:\tianming-guanben-design-20260930`，HEAD `c64707e9884f91159efbba3a5a6748c3b9c836f0`。本报告只引用工作树源码；三个官方剧本的 `daysPerTurn` 另用 Node 在内存中解析 JSON 实测，未把巨型单行文件整行输出。`文件:行号` 均为本仓库当前工作树行号。

## 一、AI 调用总表

### 1. 过回合主链与 follow-up

`endTurn()` 在 `tm-endturn-core.js:353-385` 进入；无 API key 时入口直接提示并 return（`356-368`），有 key 才进入 `_endTurnCore`。核心锁、快照与事务边界在 `tm-endturn-core.js:770-822`：先 `GM._endTurnCommitPending=true`、`GM.busy=true`，再 `EndTurnHooks.before`，按 pipeline 执行 `prep → plan-prefetch → ai → post-ai-edict → systems → render-and-finalize`（步骤定义 `tm-endturn-pipeline-steps.js:201-299,354-425,428-557,560-909`）。

|调用（入口/证据）|阶段、顺序、依赖|触发/开关|输入 → 输出/写回|“玩家是皇帝”与固定回合|结算前后台可行性、规模|
|---|---|---|---|---|---|
|`scThreeSystemsAI`（`tm-endturn-pipeline-steps.js:301-350`，实现由 `scThreeSystemsAI()` 提供）|prep 的 plan-prefetch，和长期摘要并行；ai 步只等待/消费已完成结果|有 `P.ai.key` 才启动；失败为软失败|读 `GM.facs/partyState/armies/edicts/_chronicle`，写预取摘要|系统摘要不必皇帝，但输入仍是玩家君主世界；按当前回合快照|输入在 prep 后已确定，适合后台；调用预算由实现控制，代码只保证“预取一次”。|
|`aiDigestLongTermActions`（同上 `329-344`）|同上|`P.ai.key`|读长期行动/编年，写 `GM._longTermDigest`|提示词围绕君主长期诏令；固定 `GM.turn`|可后台；按回合去重（`turn` 戳）。|
|`sc0` 局势分析（`tm-endturn-ai.js:1230-1272`）|ai，和 `sc1q` 并行（`1366-1367`）；其 `memoryQueries` 供 SC_RECALL/SC1|`minDepth=standard`（gate `832-839`）；`anomalyRoutingEnabled`、`reflectionAgentEnabled` 仅增字段/上下文（`1239-1244`）|读 `tp`、当前状态、玩家本回合行动；写 `GM._turnAiResults.thinking/anomaly`|“玩家本回合每个行动”“非玩家势力本回合”见 `1232-1238`；偏君主视角但可世界视角|不能早于玩家操作快照；可在结算前后台；`max_tokens=12000`（`1245`）。|
|`sc1q` 对话承诺（`tm-endturn-ai.js:1275-1364`）|ai，与 sc0 并行；结果注入 SC1（`2553-2610`）|`minDepth=lite`；六类输入全空则零调用（`1300-1306`）；API key 由入口保证|读 `jishiRecords`、`_courtRecords`、`_secretMeetings`、`_npcCommitments`、本回合私信/朱批；写 `ctx.results.sc1q`/`GM._turnAiResults.subcall1q`|输出 schema 明写 `adopted_by_emperor`、`required_sc1_actions`（`1330-1341`）；“皇帝/陛下”语义|玩家对话确定后可后台；回合窗口硬编码 `turn`、最近 N 回合和“本回合”（`1277-1298`）；`max_tokens=3500`（`1343`）。|
|`sc05` 因果记忆回顾（`tm-endturn-ai.js:1681-1685,2038-2054`）|ai，SC1 前；结果进入 SC1 前缀|`minDepth=standard`；无 key 不进主 AI|读近史、`GM._aiMemory/_consolidatedMemory/_foreshadows`、SC_RECALL；写 `ctx.results.sc05`、memory diagnostics|以玩家主线/君主诏令为中心；按 `T` 范围、最近回合切片|结算前状态已知可后台；`max_tokens=5000`。|
|`sc1` 主结构化账本（`tm-endturn-ai.js:2066-2070,3693-3710,3763-3829`）|ai 核心；SC1 成功后才允许 apply/follow-up；失败阻断回合（`4840-4845`）|`minDepth=lite`；必需调用；`sc1` 另有 schema retry、增量 retry、rescue（`1010-1057,1059-1101`）；诏令覆盖不足可能再调 `sc1_edicts`（`4846-4850`）|读所有玩家操作、旧变量、世界/人物/势力/财政快照、sc0/sc05/sc1q；输出 `events/resource_changes/char_updates/edict_feedback/fiscal_adjustments/...`，由 `tm-endturn-ai-infer.js:139-146` 写回各状态|写死最强：prompt 规定“君主本回合颁布正式政令”“玩家私人行动”“君主对 NPC 意志”（`tm-endturn-prompt.js:238-240`），并要求“陛下/朕/皇帝”叙事（`572-650,2148-2180`）；`playerInfo.characterName` 是主角来源（`2048-2055,2781-2799`）|固定“本回合”、`GM.turn`、按 `daysPerTurn` 的驿递/项目进度（`tm-endturn-prompt.js:1371`）；5 天可使按回合的期限/叙事稀疏，180 天会把本回合大量事件压成一次。可在玩家输入冻结后后台，但 apply 必须结算内串行。主输出预算由 `_sc1BaseTok`/上下文容量决定；rescue ≤3500（`1077`）。|
|`sc1b` 文事鸿雁人际（`tm-endturn-ai.js:4260-4320`）|ai，SC1 后与 sc1c/sc1d 并行（`4837-4838`）|`minDepth=lite`；`P.ai.stream_sc1` 等只影响传输/预算|读 SC1、人物/关系、作品/书信、玩家行动；写 `subcall1b`，并合并 cultural works/letters/interactions|提示词仍把玩家作为君主/陛下接收书信；人物名从 `P.playerInfo`|“本回合”“上回合/最近回合”筛选；5/180 天会改变书信/作品密度；SC1 完成后可后台并行。预算 `_sc1bBaseTok`（`4311`）。|
|`sc1c` 势力外交/阴谋（`tm-endturn-ai.js:4510-4723`）|同上并行；结果合并 SC1（`4734-4742`），另写 `activeSchemes/_hiddenMoves/fengwen`（`4743-4814`）|`minDepth=lite`；`sc1c` 可由 `P.ai.sc1OwnedBySc1c` 等 flag 调整字段|读势力、地图/军务/财政、旧暗流；写势力事件/关系/继承/阴谋/暗流/风闻|明确要求“玩家不得作 actor/schemer”，但主叙事仍有“君主/陛下”；玩家势力由 `P.playerInfo.factionName`|按回合 `startTurn/lastTurn=GM.turn`、本回合行动；长区间会把一次阴谋推进过度。SC1/世界快照稳定后可后台。预算 `_sc1cBaseTok`（`4713`）。|
|`sc1d` 史记/时政（`tm-endturn-ai.js:3990-4080`）|与 sc1b/c 并行；输出成为最终 `shilu_text/shizhengji`|`minDepth=lite`；`strict_hist`/`refText` 影响 prompt|读 SC1 账本、奏疏/朝议/问对/历史模板；写 `subcall1d` 和 record|最强皇帝口吻：史记对象含“君主/陛下”事实，`player_status` 以 `P.playerInfo` 生成（`4026-4027`）；历史审查另见 `tm-endturn-followup.js:3463-3503`|固定“本回合”“上回合未结朝议”；时段变长会使纪实密度与日期边界失真。可后台生成，但须在 commit 前接回 record；`_sc1dBaseTok≤7000`（`4073`）。|
|`sc15n` NPC 三层合成（`tm-endturn-followup.js:446-524`）|follow-up Branch A；启用时替代 sc15|`P.ai.sc15nEnabled===true` 且 `minDepth=lite`；否则跳过|读 SC1、sc1q、人物/关系/阴谋；写 NPC mood/relations/undercurrents/cognition|“玩家角色”作为不可代决策者，仍以君主世界为背景|依赖本回合 SC1/sc1q；可后台但 apply 原子化。预算 3000/5000/8000（`495`）。|
|`sc15` NPC 深度（`tm-endturn-followup.js:529-678`）|Branch A；sc15n 未启用时执行|`minDepth=standard`；写回前后有 `_applyNpcDeepResult` 原子保护|读人物完整档案、SC1 行动、关系/阴谋/地区；写 loyalty/stress/mood/relations/hidden moves/plots|提示含“玩家/君主”但允许 NPC 独立拒绝；非皇帝玩家仍会被当作世界主角|`GM.turn` 过期阴谋清理与“5 回合未更新”规则；5/180 天需重写为 elapsed days。可在结算前算候选，但 apply 必须以结算快照为准；`max_tokens=12000`（`646`）。|
|`sc_memwrite` NPC 记忆回写（`tm-endturn-followup.js:681-855`）|post-turn 队列；依赖 sc15/sc1q，通常回合后后台|`minDepth=lite`；`P.ai.key`；可有 continuation call|读 sc15、sc1q、角色关系/承诺；写 NPC memory/causal edges/arc updates|内文仍以“本回合/陛下”承诺为来源|按 `GM.turn` 幂等/回写窗口；可后台。主 call + continuation，预算见 `tm-endturn-followup.js:780,836`。|
|`sc16` 势力推演（`tm-endturn-followup.js:855-908`）|Branch B，与 sc17/sc18 batch 并行（`_runSubcallBatch`）|`minDepth=full`；`P.ai.sc16Lite=true` 仅改 prompt/预算；可用 `factionToolDecisionEnabled`|读全局势力/地图/军务/外交与 SC1c；写 faction priorities/actions/directives/diplomatic shifts，并建立 ledger|明确“非玩家势力”；对玩家势力过滤，仍把玩家当君主/本朝|本回合 directive ledger、`turn` 幂等；长时段不能一次等价多个决策。结算前可预取（先例：eager faction）；预算 lite/full 约 3K/8K。|
|`sc17` 财政专门推演（`tm-endturn-followup.js:909-960`）|Branch B；默认被跳过|`P.ai.sc17Skip!==false` 时只从 SC1 `economic_advice` 派生（`914-924`）；显式 false 才调用|读 SC1/财政账；输出 fiscal analysis/supplementary changes/advice|提示围绕君主国库/诏令；非皇帝角色不适配|固定本回合财政变化；长时段一次推演会把多期收入支出混在一起。可后台；完整 call 在 `939`。|
|`sc18` 军事态势（`tm-endturn-followup.js:961-1080`）|Branch B；与 sc16/17 并行|`minDepth=full`；战斗模式强制降到 lite（`tm-endturn-ai.js:834`）；`P.ai.sc18Lite` 可只要概率|读战争/军队/SC1c/边患；写 military situation/army changes/battleResult|“玩家势力/本朝”语义；战场决策依赖君主命令|按本回合战争窗口、turn；5/180 天会改变战斗次数/补给。可提前算“态势”，战斗 apply 仍结算内；lite/full call `974/1071`。|
|`sc_audit` 数据一致性审查（`tm-endturn-followup.js:1180-1250`）|Branch B 末端，等 specialty 输出|`minDepth=lite`；调用 tier 由 `_getAITier`；失败通常软处理|读 SC1/SC15-18/确定性快照；写审计诊断，不直接改世界|偏世界/账本，不必皇帝；仍检查君主诏令覆盖|需要同回合 AI 产出，不能早于它们；`max_tokens` 在 `1241` 配置。|
|`sc19` 新实体/角色补全（`tm-endturn-followup.js:1334-1470`）|post-turn 队列|`minDepth=lite`；按实体候选，最多 6 角色/3 势力/2 党派/2 阶层（代码注释/截断逻辑 `1334-1470`）|读新增实体、SC1/SC15；写角色/势力细节|人物仍置于君主世界；非皇帝玩家不改变实体归属|输入要等 SC1/SC15；可后台；`max_tokens` 随实体数。|
|`sc2_outline → sc27_review → sc2_prose` 三段叙事（`tm-endturn-followup.js:1813-1917`）|Branch C；三段仅 `P.ai.sc2Pipeline==='3stage'`|`minDepth` 分别 lite/standard/lite；默认走 legacy `sc2`（`1620-1621,1963-2013`）|读 SC1 record、SC15-18摘要、玩家行止；写 outline/review/`zhengwen`|3stage/legacy prompt 都要求“主角/君主”，可见 `1970-1985`；非皇帝角色需要改写 narrator|依赖同回合 record；“本回合”与固定场景数导致 5/180 天叙事比例失真；可在结算后后台，但 record commit 依赖最终 prose。|
|`sc25c` 记忆合成双调用（`tm-endturn-followup.js:2062-2280`）|post-turn 队列；tactical 与 strategic 并行|默认开启（`P.ai.sc25cEnabled!==false`，`2066,2290`）；两调用都 lite|读本回合/上回合 record、未了伏笔、state board、NPC/势力轨迹；写 tactical/strategic memory、state board、`GM._consolidatedMemory` 镜像|“本回合/下一回合”用语明显；主角仍默认君主|结算前世界输入不完整，适合回合后后台；每次 2 calls，预算在 `2161-2162`。|
|legacy `sc25` + `sc_consolidate`（`tm-endturn-followup.js:2286-2360,3023-3230`）|仅 `sc25cEnabled=false` 时替代/补充|lite；`consolidationEnabled/memorySynthesisEnabled=false` 可关闭 consolidate（`3035-3037`）|读伏笔/史记/对话；写 `_foreshadows/_consolidatedMemory`|按回合窗口和“本回合”压缩；长时段需改为 elapsed range|可后台；各自一 call。|
|`sc27` 叙事质量审查（`tm-endturn-followup.js:2572-2617`）|Branch C，等 specialty/audit|`minDepth=standard`；可修正文案|读 zhengwen/史实/禁用名单；写 rewritten/additional details|历史顾问 prompt 明写“皇帝时期”并检查玩家诏令（`3463-3475`）|固定本回合叙事；可后台但最终 record 必须等它。`max_tokens` 在 `2610`。|
|`sc07` NPC 认知整合（`tm-endturn-followup.js:2642-2915`）|Branch C，与 sc2/审查 DAG 并行|`minDepth=lite`；sc15n 开启时跳过（`2644-2647`）|读 NPC/关系、SC1 interactions、风闻/暗流；写 `GM._npcCognition`，可选 `cognitionFeedbackEnabled` 反馈 loyalty|“玩家角色不在此推演范围”但 context 仍有君主|按本回合幂等戳 `_cogFeedbackTurn=GM.turn`（`2896-2904`）；可后台。预算 `2826`。|
|`sc28` 世界快照（`tm-endturn-followup.js:2956-3007`）|post-turn 队列；默认被 sc25c strategic 折叠|仅 `P.ai.sc28Enabled=true` 或 sc25c 关闭时调用；`minDepth=full`|读 SC1/SC25c/势力/军务；写 `_lastSc28Snapshot/_aiMemory/_foreshadows`|世界视角较强，但“本回合/下一回合种子”仍固定回合|可后台；`max_tokens=4000`（`2983`）。|
|`memory_steward`（`tm-endturn-followup.js:3257-3263`，实现 `tm-memory-steward.js:503`）|post-turn；替代压缩旧路径时运行|lite；MemorySteward flag/策略决定；一次 call|读 L1/L2/L3 与 provenance，写记忆固化|无皇帝必需，但来源多为君主回合记录|适合后台；`outputBudget` 参数化，实际一次。|
|`compress_ai_memory / compress_foreshadows / compress_conversation`（`tm-endturn-followup.js:3269-3360`）|post-turn 队列|lite、阈值触发，`soft:true`|读历史/伏笔/对话，写摘要|按回合窗口/固定摘要长度；可后台|每项一 call，可能 0-3 次。|
|`history_check` 史实核对（`tm-endturn-followup.js:3446-3503`）|历史模式 follow-up；在玩家等待路径仍可能阻塞|`strict_hist`/历史配置；critical|读剧本 dynasty/emperor、AI 文本、玩家诏令；写纠正文案|提示直接“剧本背景…皇帝时期”（`3463`）；强写死君主|固定回合史实边界；需等文本。|

### 2. 过回合外的 AI

|调用/入口|调度、上限、输入输出|证据与拆分结论|
|---|---|---|
|势力 eager `decideAll`|`tm-faction-npc-dispatcher.js:7-11,287-295`：默认延迟 300ms；`tm-faction-npc-settings.js:17-27,66-68` 默认 precision/eager、每回合最多 2 个势力；`decideFor` 真正调用在 `tm-faction-npc-llm-decision.js:2300-2325`。工具模式一次工具首轮 + 最多 4 工具 + 第二轮 call（`1865-1894`），普通模式每次最多 2 次重试 `1756-1777`。读势力/地图/财政/君主公开情报，写 deferred political packet/ledger，不直接越过边界。可在结算前后台，现成先例。|
|势力 in-turn 调度|默认第一次 30s、后续 90s，最多 8 次/回合（`tm-faction-npc-dispatcher.js:7-11,252-274`；速度 preset 60s/180s 见 `tm-faction-npc-in-turn-driver.js:287-303`）。过回合入口先 `cancelInTurnTimers()`（`tm-endturn-core.js:369-375`）；每次 `decideFor` 选择非玩家势力并按 `GM.turn` 去重（`tm-faction-npc-in-turn-driver.js:213-241`）。|
|NPC 自主决断|render-finalize 后 `_scheduleNpcBehaviorPostRender`（`tm-endturn-pipeline-steps.js:84-117`）；`executeNpcBehaviors` 每回合模型预算最多 3 calls、敏感人物最多 2 + 公共批次（`tm-npc-decision-ai-driven.js:316-348`），单次 `callAI` 默认 2500 tokens、60s timeout（`356-383`）。`idle:true` 时只 defer，不立即执行状态动作（`171-190`）。可后台，但须 world lease/turn 不变。|
|诏令回听/督查|systems 中依赖 `ctx.results.aiResult + edicts`，后台 enqueue `edict_efficacy`（`tm-endturn-pipeline-steps.js:528-546`）；开 `edictOversightEnabled` 时走 `TM.EdictOversight`，否则 `aiEdictEfficacyAudit`，无 key 不调用。输入是本回合已落账诏令与 AI 结果，不能提前于 AI。|
|post-turn 记忆 DAG|`_launchPostTurnJobs` 在 `tm-endturn-followup.js:3578-3580` 调用；队列依赖/收口在 `tm-post-turn-jobs.js:409-604,625-694`。L2 每 5 回合（`92-191,583-588`）、L3 每 30 回合（`197-280,588-593`）、reflect 按间隔（`285-340,597-602`），失败可重试/脱离保存。|
|记忆旧档压缩|`_compressOldArchives` `tm-post-turn-jobs.js:694-722`，有 key 才 `callAI(...,300)`；纯确定性先合并，AI 结果异步补写。|
|常朝/朝议/御前/问对/奏疏/科举等进行中调用|代表入口：常朝适配器 `tm-chaoyi-changchao-adapter.js:371,1104-1110,1203-1225`；问对 `tm-chaoyi.js:151`；奏疏/机械生文 `tm-guoku-engine.js:1797,2059-2260`、`tm-hongyan-office.js:1518`。它们由玩家点击/系统弹窗触发，使用 `secondary` 或配置 tier；不是 end-turn 固定批次，输入通常是当时对话/制度状态，适合即时后台，但若写 GM 需 lease。|
|本地人物 AI|`tm-npc-local-ai.js` 是本地队列/唤醒，不是模型 API；`tm-npc-decision-ai-driven.js:320-323` 先 `TM.NPC.LocalAI.wake('turn')`，无 key 仍可返回 local result，modelCalls=0。|

### 3. 深度门控、计数与异常重试

- `runMain` 的 gate/顺序元数据在 `tm-endturn-ai.js:728-768`；标准 gate 是 `sc0/sc05/sc15/sc16/sc17/sc18/sc27` 等，lite gate 可跑 sc1 家族、sc1q、sc07、sc25 系列，full 才跑 sc16/sc18。
- UI 自报档位次数为 lite 10、standard 14、full 18（`tm-ai-infra.js:2630-2632`，`tm-patches.js:1318`）。按当前默认 flags（sc25c 开、sc15n 关、sc17 skip、sc2 legacy、sc28 折叠）静态主链是：standard 14 个基础 call；full 在此基础上加 sc0/sc16/sc18，通常再加条件性 sc19，故为 17 个稳定 call、出现 sc19 时 18 个。sc1 rescue、sc1 incremental、JSON repair、tool round、网络重试均是额外 call，不能算进固定基线。
- 无 API key：正常 UI 的 `endTurn()` 被 `tm-endturn-core.js:356-368` 拦住；若直接调用 `_endTurn_aiInfer`，其 `else` 仍会随机推进变量并写“国家变化中/时光流逝/如常”（`tm-endturn-ai-infer.js:201-204`），但这不是当前按钮可达路径。确定性 pipeline 因此没有正式“无 key 过回合”入口；测试/Agent 直接调用 core 需另行保证 result contract。


### 4. 条件性系统 AI（不在 SC 主链稳定计数内）

|入口|触发与调用|固定回合/玩家角色风险|
|---|---|---|
|边患侵攻 `borderInvasionAI`|Settlement 注册 `borderInvasion`（`tm-border-invasion.js:154,318-320`）；满足敌方势力/边境条件时入 post-turn job，`callAI(...,900)`（`303`），输出入侵方案/使节/战争状态|按回合最多新出一支、`GM.turn` 去重；提示默认“玩家/朝廷”视角；应改为按 elapsed days 累积威胁后由结算裁决。|
|悬朝/被俘朝廷 `captiveCourt`|Settlement 注册 `captiveCourt`（`tm-captive-court.js:185,205-208`）；满足 `GM` 被俘/悬朝状态才入队，`callAI(...,600)`（`163`），写继统/朝廷反应|强依赖“本回合”政治窗口和 `GM.turn`；玩家不一定皇帝时应改为“被俘政体/控制者”主体。|
|党派推演 `partyInference`|`partyInference` 注册（`tm-party-inference.js:458,477-480`）；flag/数据满足时两类模型入口：forge `callAI(...,900)`（`230`），tick `callAI(...,1600)`（`441`）；写党派身份/动态建议|代码明确确定性 `partyDynamics` 只产底账、AI 只产 prompt 叙演（文件头与 `14`）；回合幂等/最多党派候选，长时段需按天累计。|
|官制章程/动态迁移 `office-charter`|`officeCharterEnabled`/`officeDynMigrationEnabled` 控制；单项 `callAI(...,1200)`（`tm-office-charter.js:23,144`），job 在 `216,314` 入队|读职位/权力/官员，写章程建议；适合后台，但必须把“某回合迁移”换成版本化事件。|
|事件工具裁决/太史公|`tm-endturn-helpers.js:2028` 的 `callAIWithTools(...,900)` 为事件 adjudication 条件调用；玩家死亡/终局评价在 `867-898` 有 `callAI(...,600)`|都不是每回合稳定调用；后者 prompt 明写“这位君主的功过”（`888`），玩家身份强绑定。|
|常朝/问对/辅臣拟议|问对 UI 的单轮 NPC 回答在 `tm-chaoyi.js:142-152` 调 `callAI`；常朝/说朝/御前的 AI 入口在 `tm-chaoyi-changchao-adapter.js:371,1104-1110,1203-1225`，受 `state._isPostTurn`、频次/能量约束；问对记录含 `GM.turn` 与承诺期限。可即时后台，但必须锁定参与者与对话 lease。|
|奏疏/ memorial 生成|`tm-memorials.js:128-133,149-226`：有 key 才 `genMemorialsAI`，prompt 读当前 `GM.turn`/局势/职位并写 memorials；无 key 只保留剧本预置/空池。可在确定性“到期/需求”事件后后台生成，不能替代已登记玩家奏疏。|
|外患/民变/府库等其他“AI 语义化”|`tm-border-invasion.js:303`、`tm-captive-court.js:163`、`tm-party-inference.js:230,441` 之外，凡 `callAI` 的 gameplay 模块都应按“玩家操作时即时/结算时快照”分类；不能把稳定主链 14/17 误报成全库上限。|
## 二、确定性系统总表

### 1. 调度器与回合尾顺序

`SettlementPipeline.register` 接受 `daily|monthly|perturn`，按 priority 排序；`runBySchedule`/`runAll` 的行为在 `tm-ai-infra.js:1359-1438`。`SubTickRunner.calcSubTicks` 取 `_getDaysPerTurn()`，months=`max(days<15?0:1,round(days/30))`（`1461-1465`）；默认 `run` 一次跑所有 schedule（`1471-1481`），可选 `runMultiTick` 以 7 天批次跑 daily、按月跑 monthly、最后一次 perturn（`1488-1511`）。

注册表（id / priority / schedule；同一 priority 按注册顺序）如下，按 priority 大致执行：

|priority|id（文件:行号）|schedule|时间/即时化判断|
|---:|---|---|---|
|10|`variables`（`tm-help-social.js:1352`）|monthly|`timeRatio`/monthRatio 缩放；可按日但阈值/随机需保持累计量。|
|15|`eraState`（`tm-help-social.js:1353`）、`eraProgress`（`tm-endturn-helpers.js:1385`）|monthly/perturn|时代/年度阈值，结算按 elapsed months 更稳。|
|17.5/18/19|`threatVarLink/borderRiskLeaf/armyPressureLeaf`（`tm-border-risk.js:308-310`）|perturn|按回合一次；可改 daily，但必须把 risk/pressure 的阈值与幂等戳改为 elapsed-day。|
|20|`coastalRaid`（`tm-coastal-raid.js:64`）|perturn|随机/阈值沿回合；日推进会改变 RNG 次数。|
|21-26|`officeVacancy`（`tm-office-vacancy.js:55`）、`legitimacy`（`tm-mechanics.js:1222`）、`relations/opinionDecay/postPerf/affinityDecay`（`tm-help-social.js:1352-1356,943`）、`stressDecay/goalSatisfaction/stressTrait`（`tm-mechanics.js:1320,1406,1493`）、`charGrowth/personalityEvolution/npcMemDecay`（`tm-mechanics-world.js:83-89`）|perturn/monthly|多数有 monthRatio；关系/压力衰减若非线性，按日会与一次性幂等不同。|
|27-29|`haremSettle/consortClan/familyBonds`（`tm-mechanics-world.js:673,676,801`）|perturn/monthly|后宫/家族常按回合事件，需拆出每日资源变化与结算事件。|
|30-36|`treatyClean/factions/parties/classes/characters/military/map/familyRenown`（`tm-feudal-warfare.js:642,1075-1083`、`tm-mechanics-world.js:495`）|perturn/monthly/daily|军务已有 daily；势力/地图/人物目前 monthly，适合按 elapsed months；战争推进/移动可按日。|
|38-45|`scheme/armyMarch/units/supply/buildings/vassals/titles/adminDivisions/mapState`（`tm-feudal-warfare.js:901,907,1083-1089`）、`march/siege/buildingOutput/provinceEconomy`（`tm-military.js:1683,1892,2666,2717`）|perturn/monthly/daily|行军/围城/补给可日；建筑产出/地方经济按 elapsed days；阴谋/条约清理按真实期限。|
|42-48|`letters`, `office_*`, `deptTasksReply`, `zoushuGen`, `kejuAutoAssign`（`tm-hongyan-office.js:1679`、`tm-office-system.js:1997-2000`、`tm-endturn-helpers.js:2263,2361`、`tm-keju-runtime-keyi.js:2090`）|perturn|驿递/期限已有 daysPerTurn 换算；自动上疏/任官有“每回合一次”假设，不能简单日跑。|
|50-55|`annualReview`, `annual`/科举相关、`achievementCheck/playerGrowth`（`tm-endturn-helpers.js:489,1697,1723`）|monthly/perturn|年度应以日历边界触发，不应按固定回合数。|
|88-95|`goalCheck`, `achievementCheck`, `decisionScan`, `npcDeathReact/npcDisgraceReact/npcDefeatReact/npcRetireReact/factionEventReact`, `partyDynamics`, `tradeRoutes`, `diplomaticMissions`, `tensionScore`, `historyIndex`, `changeQueue`, `clearCache`（`tm-endturn-helpers.js:1027-1130,1338,1453,1570-1700,2051-2195`；`tm-help-social.js:1357`）|多为 perturn|这是最明显的“每回合一次”尾部；可保留结算触发，或改成事件驱动幂等。|
|90+|`revoltEntity`, `captiveCourt`, `borderInvasion`, `negotiationExpiry`, `partyInference`, `officeCharter/officeDynMigration`（`tm-revolt-entity.js:331`、`tm-captive-court.js:206`、`tm-border-invasion.js:318`、`tm-negotiation.js:230`、`tm-party-inference.js:478`、`tm-office-charter.js:327`）|perturn|民变/悬朝/边患/谈判都以回合快照推进；可按天维护势能，但结局/谈判轮次应在结算时一次裁决。|

### 2. systems 步固定调用顺序

`_endTurn_updateSystems` 入口及顺序见 `tm-endturn-systems.js:21-59`：BattleEngine/TMBattleTurn → `SubTickRunner.run` → `GM.turn++`。随后依次为日历同步、Relief/Corruption、Huji/DeepFill/Governance/RuntimeBridge、Guoku/灾害、Neitang、CharEcon/Promotion/EconomyLinkage/Currency/CentralLocal/EconomyGapFill、EnvCapacity/EdictParser/EdictComplete、Authority/历史预设/全局规则、Phase A-G、货币/财政/封建/诏令补完、NPC memorials/IntegrationBridge、人物年龄/任职检测、中央集权/阈值/历史/Keju/Conspiracy/ChangeQueue/缓存（`tm-endturn-systems.js:60-555`）。几乎所有 tick 都传 `monthRatio = _getDaysPerTurn()/30`（`47-50`），但 `GM.turn++` 只有一次（`59`）。

能按日跑的：行军/围城/补给/信使旅行、人口/环境/财政计息等明确使用 days/monthRatio 的引擎；应使用 7-day 子 tick 先例而非重复 perturn。只能结算一次或需重写的：`GM.turn` 幂等/ledger、AI 事件应用、党派/年度审查/自动上疏/谈判轮次/随机民变、Phase A-G 中按回合封顶的反馈。按日拆分可能改变 RNG 次数、阈值跨越顺序和非线性 clamp，不能声称结果等价。


#### SettlementPipeline 注册项逐项索引

以下是源码中所有 `SettlementPipeline.register` 的逐项索引；schedule/priority 是注册实参，未显式传入者为默认 `perturn`/priority 50（注册器默认见 `tm-ai-infra.js:1365-1376`）。

|id|文件:行|priority|schedule|
|---|---|---:|---|
|variables|`tm-help-social.js:1352`|10|monthly|
|eraState|`tm-help-social.js:1353`|15|monthly|
|threatVarLink|`tm-border-risk.js:308`|17.5|perturn|
|borderRiskLeaf|`tm-border-risk.js:309`|18|perturn|
|armyPressureLeaf|`tm-border-risk.js:310`|19|perturn|
|coastalRaid|`tm-coastal-raid.js:64`|20|perturn|
|legitimacy|`tm-mechanics.js:1222`|21|perturn|
|officeVacancy|`tm-office-vacancy.js:55`|21|perturn|
|relations|`tm-help-social.js:1354`|20|monthly|
|opinionDecay|`tm-help-social.js:1355`|22|monthly|
|affinityDecay|`tm-help-social.js:943`|23|monthly|
|stressDecay|`tm-mechanics.js:1320`|24|monthly|
|postPerf|`tm-help-social.js:1356`|25|monthly|
|charGrowth|`tm-mechanics-world.js:83`|25|perturn|
|stressTrait|`tm-mechanics.js:1493`|25|monthly|
|playerGrowth|`tm-endturn-helpers.js:1723`|26|perturn|
|personalityEvolution|`tm-mechanics-world.js:85`|26|perturn|
|goalSatisfaction|`tm-mechanics.js:1406`|26|monthly|
|npcMemDecay|`tm-mechanics-world.js:88`|26|monthly|
|haremSettle|`tm-mechanics-world.js:801`|27|perturn|
|consortClan|`tm-mechanics-world.js:676`|28|perturn|
|familyBonds|`tm-mechanics-world.js:673`|29|monthly|
|treatyClean|`tm-feudal-warfare.js:642`|30|perturn|
|factions|`tm-feudal-warfare.js:1075`|30|monthly|
|parties|`tm-feudal-warfare.js:1076`|31|monthly|
|classes|`tm-feudal-warfare.js:1077`|32|monthly|
|characters|`tm-feudal-warfare.js:1078`|33|monthly|
|gossipSpread|`tm-mechanics-world.js:166`|33|perturn|
|military|`tm-feudal-warfare.js:1080`|34|daily|
|map|`tm-feudal-warfare.js:1082`|35|monthly|
|familyRenown|`tm-mechanics-world.js:495`|36|monthly|
|scheme|`tm-feudal-warfare.js:901`|38|perturn|
|armyMarch|`tm-feudal-warfare.js:907`|—|perturn (default)|
|units|`tm-feudal-warfare.js:1083`|40|monthly|
|supply|`tm-feudal-warfare.js:1084`|41|monthly|
|letters|`tm-hongyan-office.js:1679`|42|perturn|
|buildings|`tm-feudal-warfare.js:1085`|42|monthly|
|office_mourning|`tm-office-system.js:1997`|45|perturn|
|vassals|`tm-feudal-warfare.js:1086`|43|monthly|
|titles|`tm-feudal-warfare.js:1087`|44|monthly|
|adminDivisions|`tm-feudal-warfare.js:1088`|44.5|monthly|
|mapState|`tm-feudal-warfare.js:1089`|45|monthly|
|officeDisaffection|`tm-office-system.js:1998`|46|perturn|
|deptTasksReply|`tm-endturn-helpers.js:2263`|46|perturn|
|officePersonnelTurnover|`tm-office-system.js:1999`|47|perturn|
|zoushuGen|`tm-endturn-helpers.js:2361`|47|perturn|
|officeJingcha|`tm-office-system.js:2000`|48|perturn|
|annualReview|`tm-endturn-helpers.js:489`|50|monthly|
|kejuAutoAssign|`tm-keju-runtime-keyi.js:2090`|55|perturn|
|npcDeathReact|`tm-endturn-helpers.js:1027`|90|perturn|
|npcDisgraceReact|`tm-endturn-helpers.js:1064`|90|perturn|
|npcDefeatReact|`tm-endturn-helpers.js:1099`|90|perturn|
|npcRetireReact|`tm-endturn-helpers.js:1130`|90|perturn|
|factionEventReact|`tm-endturn-helpers.js:1338`|90|perturn|
|changeQueue|`tm-help-social.js:1357`|92|perturn|
|clearCache|`tm-help-social.js:1358`|95|perturn|
|eraProgress|`tm-endturn-helpers.js:1385`|—|perturn (default)|
|borderThreatAgg|`tm-endturn-helpers.js:1431`|—|perturn (default)|
|stateCoupling|`tm-endturn-helpers.js:1453`|—|perturn (default)|
|npcIntentAnalysis|`tm-endturn-helpers.js:1570`|—|perturn (default)|
|npcEventProposal|`tm-endturn-helpers.js:1574`|—|perturn (default)|
|healthDecay|`tm-endturn-helpers.js:1611`|—|perturn (default)|
|partyDynamics|`tm-endturn-helpers.js:1654`|—|perturn (default)|
|decisionScan|`tm-endturn-helpers.js:1690`|—|perturn (default)|
|goalCheck|`tm-endturn-helpers.js:1697`|88|perturn|
|achievementCheck|`tm-endturn-helpers.js:1700`|—|perturn (default)|
|tradeRoutes|`tm-endturn-helpers.js:2051`|—|perturn (default)|
|diplomaticMissions|`tm-endturn-helpers.js:2091`|—|perturn (default)|
|tensionScore|`tm-endturn-helpers.js:2117`|—|perturn (default)|
|historyIndex|`tm-endturn-helpers.js:2195`|—|perturn (default)|
|borderInvasion|`tm-border-invasion.js:318`|—|perturn (default)|
|captiveCourt|`tm-captive-court.js:206`|—|perturn (default)|
|negotiationExpiry|`tm-negotiation.js:230`|—|perturn (default)|
|officeCharter|`tm-office-charter.js:327`|—|perturn (default)|
|officeDynMigration|`tm-office-charter.js:330`|—|perturn (default)|
|partyInference|`tm-party-inference.js:478`|—|perturn (default)|
|revoltEntity|`tm-revolt-entity.js:331`|—|perturn (default)|
|march|`tm-military.js:1683`|33|perturn|
|siege|`tm-military.js:1892`|36|perturn|
|buildingOutput|`tm-military.js:2666`|30|perturn|
|provinceEconomy|`tm-military.js:2717`|35|perturn|
|enYuanDecay|`tm-mechanics-world.js:1512`|60|perturn|
|contradictions|`tm-mechanics-world.js:1705`|16|monthly|
## 三、发起、锁、后台收口与 GM.turn

- 按钮 `web/game UI` 的 `btn-end` 调 `confirmEndTurn()`（`web/tm-game-loop.js:779`；按钮生成 `2390`），确认后 `endTurn()`。`endTurn()` 先挡 `GM.busy`、无 key、重复 pre-submit，并由 `_showPostTurnCourtPromptAndStartEndTurn` 进入 `_endTurnInternal`（`tm-endturn-core.js:353-385`）。
- 锁：`GM._endTurnCommitPending`、`GM.busy`、`GM._endTurnBusy`；事务快照/pre-endturn save 在 `tm-endturn-core.js:788-809`。AI/后台写入用 world lease/turn 校验，旧回合结果会被拒绝（`tm-endturn-reliability.js:40-41,404`、`tm-endturn-response-recovery.js`）。
- `tm-post-turn-jobs.js:521-553` 入队，`dependsOn` 在 `521-536` 解析；下一回合开始或保存前由 `625-694` await，非关键任务可 detach。关键保存依赖默认包括 `sc25/sc25c`（`tm-post-turn-jobs.js:29-40,74-82`）。
- in-turn 势力计时器在过回合入口取消；新的回合在 render-finalize 调 `scheduleTurnRuns`（`tm-endturn-core.js:369-375`、`tm-endturn-pipeline-steps.js:189-194`）。
- 全库 root `web/*.js` 中 `GM.turn` 共有约 **2,305** 次文本命中（只读计数）。主要消费者：显示/叙事（`tm-endturn-prompt.js` 63 次、`tm-endturn-render.js` 26）、AI 输入与幂等（`tm-endturn-ai.js` 67、`tm-endturn-followup.js` 54）、状态应用/冷却/期限（`tm-endturn-apply.js` 135、`tm-endturn-apply-stages.js` 84、`tm-hongyan-office.js` 67）、确定性 tick（`tm-endturn-systems.js` 53、`tm-endturn-helpers.js` 52）、UI/进行中事件（`tm-game-loop.js` 53）。按用途可分：回合显示/日期；`lastTurn/turn+N` 冷却和期限；每回合/每 5/30 回合周期；幂等戳（NPC/faction/feedback）；事务锁/保存代际。

## 四、调用次数合计（有 API key）

在默认 flags（sc25c 开、sc15n 关、sc17 skip、sc2 legacy、sc28 折叠、无额外历史模式）下：

- **标准深度：14 个稳定主/跟进 call**：sc1q、sc05、sc1、sc1b、sc1c、sc1d、sc15、sc_memwrite、sc_audit、sc2、sc25c tactical、sc25c strategic、sc27、sc07。`sc19` 只在发现候选实体时追加；诏令覆盖修复、JSON repair、网络 retry 另加。
- **完整深度：17 个稳定 call**，在标准 14 上增加 sc0、sc16、sc18；若本回合触发 sc19，则为 18。UI 文字把完整档标为“18 调用”（`tm-ai-infra.js:2630-2632`、`tm-patches.js:1318`），这是把典型 sc19/可选任务计入的产品估算，不是每个世界状态的硬上限。
- 标准/完整都可能再有：pre-fetch 两调用、`sc1_rescue/sc1_inc_retry/sc1_edicts`、follow-up 3stage/历史审查/压缩、post-turn L2/L3/reflect/督查、NPC autonomy（≤3）、faction eager/in-turn（默认每回合最多 2 + in-turn 预算 8 的合并上限）。因此“近二十次”只适用于 end-turn 稳定主链；整段墙钟生命周期没有固定上限。
- 无 API key 时，当前按钮路径零 AI、也零确定性结算（入口直接 return）；本地 NPC AI 与已落地玩家 UI 操作仍可运行，直接调用内部 inference 才会走随机变量兜底（`tm-endturn-ai-infer.js:201-204`）。

## 五、拆成“即时 + 结算”的可行性

### 1. 三部官方剧本的 daysPerTurn

Node 内存实测（`JSON.parse` 后只打印字段）：

|官方剧本|daysPerTurn|证据|
|---|---:|---|
|天启七年·九月（官方）|30|`scenarios/天启七年·九月（官方）.json:1`（实测 id `sc-tianqi7-1627`）|
|晚唐·开成五年（官方）|10|`scenarios/晚唐·开成五年（官方）.json:1`（实测 id `sc-tang840-840`）|
|绍宋·建炎元年八月（官方）|30|`scenarios/绍宋·建炎元年八月（官方）.json:1`（实测 id `sc-jianyan1-1127-shaosong`）|

权威读取是 `_getDaysPerTurn()`：优先 `P.time.daysPerTurn`，再按 `perTurn/customDays` 兼容，最后 30（`tm-utils.js:843-860`）；启动时把 `gameSettings.daysPerTurn` 标准化进 `P.time`（`tm-patches-start.js:1375-1382`）。编辑器允许作者改 `daysPerTurn/turnDuration/turnUnit/customDays`（`editor-fullgen.js:1144-1151,1517-1538`）；当前普通游戏设置面板只暴露 AI/玩法开关，未见给玩家实时改 `daysPerTurn` 的按钮，因此“可由剧本作者/编辑器改，运行中玩家默认不可改”是源码结论。

### 2. systems/finalize 对同回合 AI 产出的依赖

|依赖产出|消费位置|不跑 AI 连续节律的后果|
|---|---|---|
|SC1 `changes/resource/variable/char/faction/office/fiscal/events`|`tm-endturn-ai-infer.js:139-146` apply；`tm-endturn-pipeline-steps.js:433-515` post-ai-edict|确定性系统会读旧世界，属于**缺少 AI 输入**；若仍执行 apply 会产生空/兜底叙事。|
|SC1 edict feedback/appointments/deaths|`tm-endturn-prep.js:481-519` 收集意图，`tm-endturn-apply*.js` 写回，systems 后续读 `GM.officeTree/chars`|官职/死亡/财政落账顺序改变，属于**顺序错误**。|
|SC15/15n mood/relations/hidden moves/plots|`tm-endturn-followup.js:250-439,504-524` 原子应用；Settlement `npcIntentAnalysis/partyDynamics/healthDecay/scheme` 后续读取|不跑 AI 只是少一层 NPC 输入；若按日重复，会把同一暗流/关系多算。|
|SC16 faction directives/relations|`tm-endturn-followup.js:855-908` 写 `_sc16FactionDirectives`；in-turn/eager faction scheduler 读取（`tm-faction-npc-llm-decision.js:474-534,2414-2455`）|势力选择会回退 strength/模板，属于**输入缺失**。|
|SC17/SC18|`tm-endturn-followup.js:909-1080` 写财政/军事补充；systems 的 Battle/Guoku/Army/财政消费|跳过只是不产生 AI 补充；若把 systems 当已有结果，会出现战斗/财政与叙事不一致。|
|SC1d/sc2/sc27|render/finalize、`GM._lastEndturnAiContext`、史记/实录写入（`tm-endturn-pipeline-steps.js:560-909`）|世界确定性仍可跑，但没有可提交的 record；当前 validity 对缺主结果会 abort（`tm-endturn-ai.js:4840-4845`）。|
|SC25c/sc28/memory|post-turn queue 与下一回合 prompt（`tm-endturn-followup.js:2062-2280,2956-3037`）|确定性状态不必依赖，但跨回合记忆/伏笔断档。|

### 3. 是否已有“只跑确定性”的无 key 路径

**按钮路径没有。** `endTurn()` 在 key 检查处直接 return（`tm-endturn-core.js:356-368`），所以不会执行 prep/systems/finalize。内部 `_endTurn_aiInfer` 有随机变量/三句兜底，但仍需绕过按钮并自行满足 pipeline result contract（`tm-endturn-ai-infer.js:201-204`）。因此不能把当前无 key 行为称为现成节律实现；可复用的真正节律骨架是 `SubTickRunner.runMultiTick`，但它现在仍假设回合尾 perturn、且不负责 `GM.turn++`/事务提交（`tm-ai-infra.js:1488-1511`）。

### 4. prep 中玩家操作何时可落地

- 可在玩家操作当时落地：输入框诏令的结构化登记/去重、`recordPlayerDecision`、已颁诏书同步、简单财政转账/资源预扣、改革草稿与 UI 草稿保存；当前收集位置 `tm-endturn-prep.js:314-335,459-470`，改革/财政专用落账函数在 `tm-endturn-edict.js` 与 fiscal engines。
- 仍依赖回合开始/结算边界：诏令执行期限/驿递起算（`tm-endturn-prep.js:397-426` 用 `GM.turn`、`daysPerTurn`）、跨渠道去重、`oldVars` 基线（`473-474`）、本回合事件 `_candidateEvents._resolvedTurn`（`341-358`）、事务快照/回滚（`tm-endturn-core.js:788-809`）。即时化需要把这些从 `turn` 改为 event id + game-day，并保留一次结算的原子提交。

## 改成即时 + 结算、且玩家不一定是皇帝时，最难拆的五个地方

1. **玩家身份不是一个变量而是一整套 prompt 契约。** `tm-endturn-prompt.js:238-240,572-650,1998-2006,2148-2180,2781-2799` 同时写“君主/陛下/朕”、国家诏令、私人行动、第一人称内心；sc1q 还要求 `adopted_by_emperor`（`tm-endturn-ai.js:1330-1341`）。改成官员/平民必须重新定义信息可见性、可执行权和叙事主角，而不是替换一个称谓。
2. **AI 写回与 systems 是同一事务 DAG。** `post-ai-edict` 先应用 AI 变化，systems 再跑 Settlement/引擎（`tm-endturn-pipeline-steps.js:428-557`）；SC15/16/18 等结果又被 in-turn/eager 与下回合 prompt 消费。拆开后若节律先跑，缺的是输入；若把旧 AI 结果重复套用，会重复扣账、重复任官或重复战争。
3. **`GM.turn` 同时承担日期、幂等、冷却、周期、保存租约。** 约 2,305 个 root-web 命中，且 `SubTickRunner` 只在最后一次 perturn 配合 `GM.turn++`（`tm-endturn-systems.js:59`）。即时日历需要独立 `gameDay/eventSeq/settlementId`，否则 5 天/180 天会同时击穿 `turn+N` 期限与“本回合一次”幂等。
4. **后台 AI 与结算锁存在竞态。** in-turn 30/90 秒 timer、eager batch、NPC autonomy、post-turn DAG 都可能持有旧 world；过回合要取消/收口（`tm-faction-npc-dispatcher.js:160-195,252-313`、`tm-endturn-core.js:369-375`），保存还要 await 关键任务并 detach 其余（`tm-post-turn-jobs.js:625-694`）。即时模式必须有可取消 job lease、事件版本和原子 merge。
5. **确定性系统并非都可线性缩放。** `SubTickRunner.runMultiTick` 虽已有 daily/monthly/perturn 框架（`tm-ai-infra.js:1488-1511`），但民变、围城、阴谋、随机 raid、阈值、年度审查、党派反馈都可能受 RNG 顺序/非线性 clamp 影响；仅把 `daysPerTurn` 换成 elapsed days 会改变结果，必须为每类系统定义 daily accumulator、结算裁决和 RNG stream。
