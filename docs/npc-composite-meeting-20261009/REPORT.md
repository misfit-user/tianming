# 官方剧本生活组合首版

## 基线与状态

- 上一轮本地规划连续执行基线：`ae156eb2`（`fix: continue NPC planning from verified results`）。
- 本 worktree：`codex/npc-planning-continuity-20261007`。
- 开工时 HEAD 为 `ae156eb2`；未强制回退到外部旧主线 `5d4d66b3`。
- 本轮未 push、未创建 PR、未合并、未部署。`origin/main` 在核查期间继续前进，当前本分支相对它为 ahead 1 / behind 7；未做 rebase/pull。
- 主工作区 `C:\Users\37814\Desktop\tianming` 的既有修改未触碰。

## 接线

- 共同安排、条款版本、到场窗口、讨论阶段和结果：`TM.NPC.Meetings` 的同一 meeting plan。
- 每个人的消息、知情、日程和路线：现有 `DailyActivities`、`ActionLedger`、`MapLocations` 与 `Meetings` 真源。
- 现场内容：meeting plan 内的 `discussion`，沿既有 `DailyActivities.topicInfo` 和 `consultationBasis`；没有新建第二个生活活动账本。
- 结果和后续：`finishMeeting` 写入 participation、个人记忆和一次成长效果；`Meetings.topicHistory` 为后续本地选择提供实际消费者。
- 职任条件：出发和现场开始分别调用 `TM.OfficeTenure.canAct/view`；没有约束的无官人物仍可使用同一 meeting 入口。

## I1：相约读札／当面请益

实现于 `web/tm-npc-travel.js`、`web/tm-npc-local-ai.js`、`web/tm-npc-daily-ui.js`：

- meeting 可以携带已发生且本人已知的 contact/document consultation source；没有可核验来源时拒绝组合创建。
- 现场只在双方实际到场、当前日期达到约定开始日、且仍在活动时段内开放。
- `explain/question/counter` 与 `answer/uncertain/counter` 形成两方独立选择；问题、发言、回答、来源和结果都绑定同一 meeting。
- 活动结束时真实占用 duration；讨论未完成记录为 `uncompleted/partial`，不会伪造圆满结果。
- 返回继续使用原 meeting 的各自行程；参与、讨论心得和后续规划只写一次。
- target 在 actor 发言真正发生后才获得 `heardContent`，未送达/未发生内容不从 view 或 UI 泄漏。

## I2：无官与有职共用一条活动

- 合成旅行回归覆盖：一个无 leave 要求且权限有效的职位 holder 能按真实路线出发；另一个配置了 `requiresLeave` 的 holder 在没有有效离任安排时停在 `waiting_departure`，不会靠删字段放行。
- 未显式附加 meeting 字段时，若 `OfficeTenure.view` 能唯一解析 resident 任职且目的地离开通常驻地，meeting 在出发/现场入口自动重验该任职；多职冲突时要求明确安排，不按列表顺序猜测。
- 该回归保留 OfficeTenure 正式模块加载，未预造虚假 leave 记录，也未通过异常捕获放宽检查。
- 同一 meeting 入口仍允许普通无官人物完成旅行和现场讨论；身份、职任和玩家控制方式没有被合并成一个开关。

## I3：官方剧本生产模块案例

`web/scripts/smoke-npc-composite-official.js` 使用真实 `scenarios/绍宋·建炎元年八月（官方）.json` 数据，保留 513 人物、39 势力、官方地图和机构数据。它没有预填 localGoals、同意、到场或结果：

1. 韩世忠向张俊提出已有 public identity 材料的整理请求。
2. 张俊受理、形成带来源文书并送达；韩世忠反馈完成。
3. 本地候选从已收到文书生成 `reading_understanding` 请益机会。
4. 同一来源转成一份相约读札 meeting；张俊独立接受。
5. 双方按 SimTime 到达约定时段；韩世忠提出具体问题，张俊独立回答。
6. 会面占时后双方返程，participation 和 discussion result 可回读，meeting `done`。

该官方生产模块 smoke 输出：513 人物、39 势力、`reading_understanding`、唯一 discussion result、返程后 `done`、新增模型调用 0。它是正式数据与生产模块验收，不等同于桌面 Electron 浏览器已在本机跑通。

`scripts/electron/npc-daily-cases.cjs` 已加入正式页面、顶层 endTurn、保存/加载和组合 meeting 场景；本机因 `npm ci --ignore-scripts` 后缺少 `node_modules/electron` 二进制，未执行该 Electron 场景。CI job `.github/workflows/ci.yml` 的 `--npc-daily` 会安装 Electron runtime 后实际调用它。

## 测试证据

本轮最终冻结前通过：

- `node web/scripts/smoke-npc-travel.js`：10 groups。
- `node web/scripts/smoke-npc-ai-routing.js`：7 groups。
- `node web/scripts/smoke-npc-life-opportunities.js`：11 groups。
- `node web/scripts/smoke-npc-daily-lifecycle.js`：17 groups。
- `node web/scripts/smoke-npc-daily-activities.js`、`smoke-npc-daily-boundaries.js`。
- `node web/scripts/smoke-office-tenure.js`、`smoke-office-duty-reliability.js`。
- `node web/scripts/smoke-npc-composite-official.js`：官方《绍宋》案例，0 API attempt。
- `node web/scripts/run-smokes.js --grep npc-composite-official --no-retry --timeout 120`：该官方 smoke 纳入发现式 smoke runner 并通过；并行工作区负载下墙钟约 101 秒，单独直接运行约 15 秒。
- `node web/scripts/lint-arch-all.js`：架构守卫全绿。
- `node scripts/verify-release-contract.js`：182 assertions。
- `node web/scripts/verify-official-scenario-parity.js`：41 assertions。
- startup/native manifests 与 `node scripts/sync-hot-baseline.js --check --version 1.3.5.3`：通过；缺席资产按项目规则容忍 595 条，现场文件 hash/size 严格核对。

## 限制与遗留

- Electron 正式 UI 组合场景已接线但本机未执行；不能把本报告写成桌面浏览器完整验收或线上发布。
- 官方 smoke 覆盖《绍宋》生产数据；《天启》和《晚唐》本轮仅保持已有加载/派生物门禁，未宣称完整生活组合试玩。
- 本轮没有扩建完整假制、所有官职的离任 UI、全部历史交通或其他生活活动；公库试点只做回归。
- 新增普通组合流程使用本地确定性分支，模型尝试为 0；其他世界模型边界未被本轮关闭或重新宣传为全游戏离线。
