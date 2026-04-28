# 天命 · 架构导图

> 目的：让任何维护者（包括三个月后的你自己）在 30 分钟内定位 80% 的代码。
> 这是当前**实然**架构，不是理想架构。理想参见文末"长期演化方向"。
> 最后更新：2026-04-24

---

## 1. 核心心智模型

天命 = **浏览器 Electron 单页应用** + **AI 驱动的历史模拟器**。

```
玩家
  │
  ├─→ 发诏令/问对/朝议/密问/召对（UI 交互，输入半文言文）
  │
  │   [回合结算 endTurn]
  │     ├─ 诏令抽取 → 构建 prompt → 调 AI → 拿 p1 JSON
  │     ├─ validator 校验 p1 → applier 写回 GM
  │     ├─ 子系统推进（经济/官制/区划/人口/环境）
  │     └─ 渲染史记/叙事/变化摘要
  │
  └─→ 下一回合
```

**两套数据**：
- `GM`（Game Master）：**运行时**状态，每个游戏 session 独立。几乎所有运行时读写应该针对 GM。
- `P`（Persistent）：**持久化** 数据。剧本库、全局设置、玩家档案。跨 session 保留。

**混用陷阱**：运行时渲染若读 `P.adminHierarchy` 就会看到静态剧本数据，必须读 `GM.adminHierarchy`。参见"GM/P 字段所有权表"。

---

## 2. 两套编辑器（容易混淆）

本项目有**两套完全独立**的编辑器：

| | 独立编辑工具 | 游戏内编辑器 |
|---|---|---|
| 入口 | 单独打开 `editor.html` | 游戏中 `enterEditor(sid)` |
| 全局对象 | `scriptData` | `P` |
| 主代码 | `editor.js` | `index.html` + `tm-*.js` |
| 用途 | 从零创建/编辑剧本导出 JSON | 游戏中调整当前存档 |
| 函数示例 | `saveScript()` `addChr()` | `enterEditor` `renderEdTab` `aiGenChr` |

**规则**：
- 改独立编辑工具 → `editor.js` / `editor.html`
- 改游戏内编辑器 → `index.html` + 相关 `tm-*.js`
- `P` 和 `scriptData` **不交叉使用**

---

## 3. 文件加载顺序（重要！全局 window.* 靠顺序）

index.html 按依赖顺序加载 **161 个 JS 文件**（截至 2026-04-28，含拆分后的 tm-* 模块 ~157 个 + 编辑器/工具 4 个）。关键分层：

```
第 1 层 · 基础数据 & 工具
  tm-icons  tm-data-model  tm-utils  tm-traits-data
  tm-chronicle-tracker  tm-relations

第 2 层 · 索引与生命周期
  tm-edict-lifecycle  tm-mechanics  tm-change-queue
  tm-index-world (← findCharByName/findFacByName 核心入口)
  tm-npc-engine  tm-game-engine

第 3 层 · 子系统引擎
  tm-map-system  tm-dynamic-systems (SaveManager)
  tm-economy-military  tm-event-system  tm-storage

第 4 层 · 回合结算（拆成 4 个文件）
  tm-endturn-helpers  tm-endturn-province  tm-endturn  tm-endturn-render

第 5 层 · 补丁 & 扩展（警告：此层是腐化重灾区）
  tm-patches  tm-three-systems-ext  tm-three-systems-ui
  tm-char-arcs  tm-chaoyi-keju  tm-char-autogen
  tm-audio-theme  tm-topbar-vars  tm-shell-extras

第 6 层 · 领域子系统（每个系统自成一文件或多片）
  腐败(corruption) · 国库(guoku) · 内堂(neitang)
  角色经济(char-economy) · 户籍(huji) · 环境(env) · 权威(authority)
  货币(currency) · 央地(central-local) · 诏令(edict)

第 7 层 · Phase 补丁（A-H 阶段遗留 16 个文件）
  tm-phase-a-patches ... tm-phase-h-final
  tm-phase-f1-fixes  tm-phase-f2-linkage ...

第 8 层 · 集成层
  tm-integration-bridge  tm-fiscal-cascade  tm-fiscal-fixed-expense

第 9 层 · AI 输入/输出（Schema 在 applier 之前）
  tm-ai-schema           ← 字段契约单一真源
  tm-ai-output-validator ← AI 返回 p1 的校验
  tm-data-access (DA)    ← 统一数据访问门面
  tm-ai-change-applier   ← 写回 GM
  tm-ai-npc-memorials    ← NPC 死亡墓志铭

第 10 层 · UI 抽屉与编辑器桥接
  tm-var-drawers / -ext / -final
  tm-editor-*-deep  tm-editor-custom-presets

第 11 层 · 测试 & 剧本 & 日志
  tm-test  tm-test-harness (TM.test)
  scenarios/*  tm-changelog
```

**加载顺序敏感场景**：
- 后加载的 `tm-audio-theme.js` 覆盖 `tm-game-engine.js` 的 `renderTechTab/renderRulTab/renderEvtTab`（故意补丁，添加编辑按钮）
- `tm-ai-schema` 必须在 `tm-ai-output-validator` 之前（validator 读 schema）
- `tm-data-access` 必须在 `tm-index-world` 之后（DA 委托 findCharByName）

---

## 4. GM 字段所有权表（核心 40 个，共 193 个已知字段）

按访问频率排序。用 DA 读写的字段标 ✓。

| 字段 | 类型 | 所属系统 | DA 入口 |
|------|------|---------|---------|
| `GM.chars` | Array<Character> | 核心 | ✓ `DA.chars.*` |
| `GM.facs` | Array<Faction> | 核心 | ✓ `DA.factions.*` |
| `GM.parties` | Array<Party> | 核心 | ✓ `DA.parties.*` |
| `GM.classes` | Array<Class> | 核心 | ✓ `DA.classes.*` |
| `GM.turn` | number | 核心 | ✓ `DA.turn.current()` |
| `GM.date` | string | 核心 | ✓ `DA.turn.date()` |
| `GM.running` | boolean | 核心 | ✓ `DA.turn.isRunning()` |
| `GM.guoku` | Object | 财政 | ✓ `DA.guoku.*` |
| `GM.officeTree` | Array<Dept> | 官制 | ✓ `DA.officeTree.*` |
| `GM.adminHierarchy` | Array<Division> | 行政 | ✓ `DA.admin.get()` |
| `GM.provinceStats` | Object<name, stats> | 行政 | ✓ `DA.admin.getProvinceStats()` |
| `GM.currentIssues` | Array<Issue> | 时政 | ✓ `DA.issues.*` |
| `GM._edictSuggestions` | Array | 诏书 | ✓ `DA.edict.*` |
| `GM.armies` | Array<Army> | 军事 | × 用 `GM.armies.find` |
| `GM.activeWars / activeBattles` | Array | 军事 | × |
| `GM.yearlyChronicles` | Array | 史记 | × |
| `GM.authority` | Object | 权威 | × 走 `tm-authority-engines` |
| `GM.harem` | Object | 后宫 | × |
| `GM.memorials` | Array | 奏疏 | × |
| `GM.qijuHistory / jishiRecords` | Array | 起居/纪事 | × |
| `GM._turnReport / _turnAiResults` | Object/Array | AI 推演 | × |
| `GM.eraState` | Object | 时代 | × |
| `GM.keju` | Object | 科举 | × 走 `tm-chaoyi-keju` |
| `GM.huji / corruption / environment` | Object | 子系统 | × |
| `GM.npcMemory` | Object | NPC记忆 | × |
| `GM.chronicleAfterwords / characterArcs / playerDecisions` | Array | 记忆归档 | × |

**完整 193 字段清单**：`DA.meta.coveredGMFields` + grep `GM\.` 自查。

---

## 5. P 字段所有权表（持久化关键 10 个）

| 字段 | 含义 | 写入时机 |
|------|------|---------|
| `P.scenarios` | 所有剧本数组 | 新建/导入剧本 |
| `P.ai` | AI 接口配置（key/model/prompt/第二 api） | 玩家设置 |
| `P.conf` | 游戏配置（回合/奏疏数/字数） | 玩家设置 |
| `P.audio` | 音频设置 | 玩家设置 |
| `P.theme` | 主题 | 玩家设置 |
| `P.officeTree` | 剧本的静态官制预设 | 新游戏首次生成 AI 回写 |
| `P.adminHierarchy` | 剧本的静态行政区划预设 | 新游戏首次生成 AI 回写 |
| `P._indices` | P 的索引（scenarioById） | buildIndices() |
| `P._saveVersion` | 存档版本号 | SaveMigrations.stamp |
| `P.playerProfile` | 玩家跨游戏元数据 | 新游戏时 |

**边界规则**：
- 启动时：`P → GM` 一次性深拷贝（fullLoadGame / startGame）
- 运行时：只改 GM，**不许改 P**（个别兜底恢复路径例外）
- 存档时：`{GM: ..., P: ...}` 一起序列化到 IndexedDB slot

**历史违规**（均已验证或修复）：
- `tm-audio-theme.js:1237` P→GM 兜底恢复（合理）
- `tm-audio-theme.js:1778` 新游戏首次生成时 GM→P（合理，把 AI 生成的官制回写到剧本库）
- `tm-index-world.js` 原 swap hack（2026-04-24 已消除，改为 `_officeBuildTreeV10(opts.officeTree)` 参数化）

---

## 6. 回合结算管道（endTurn 调用链）

```
endTurn()  ← tm-endturn.js 入口
  │
  ├─ Phase A · 收集玩家输入
  │    extractEdictActions()           从 GM._edicts 抽诏令动作
  │    collectChaoyiInput()            朝议结果
  │    collectZoushuBatches()          奏疏批注
  │
  ├─ Phase B · 构建 AI prompt（巨型字符串拼接，~5000 token）
  │    inject: GM.chars/facs/parties/classes 摘要
  │    inject: 时局要务 GM.currentIssues
  │    inject: 近 3 回合 yearlyChronicles
  │    inject: 当前国策 GM.customPolicies
  │    inject: 省份概况 GM.provinceStats
  │    inject: 官职健康/任期超标/考课
  │    inject: TM_AI_SCHEMA 描述的输出字段（单一真源）
  │
  ├─ Phase C · 调用 AI（主调用 subcall1）
  │    支持流式（callAIMessagesStream）或非流式 fetch
  │    extractJSON(c1) → p1
  │    >>> TM.validateAIOutput(p1, 'subcall1')  ← 新增校验层
  │    GM._turnAiResults.subcall1 = p1
  │
  ├─ Phase C · 并行子调用 1b/1c
  │    subcall1b: 文事/势力专项（独立 8k 预算）
  │    subcall1c: 诏令问责（directive_compliance）
  │
  ├─ Phase D · 应用变更
  │    applyAITurnChanges(p1) → tm-ai-change-applier.js
  │    p1.character_deaths → tm-endturn.js:9636 处理
  │    p1.office_changes → tm-endturn.js:11115 处理
  │    p1.admin_division_updates → tm-endturn.js:12009 处理
  │    p1.harem_events → tm-endturn.js:12260 处理
  │    p1.current_issues_update → tm-endturn.js:9597 处理
  │
  ├─ Phase E · 子系统推进（tm-endturn-province.js + *-helpers.js）
  │    每省更新 population/unrest/prosperity
  │    经济推进 FiscalCascade
  │    角色经济推进 CharEconomyEngine
  │    户籍推进 HujiEngine
  │    环境推进 EnvCapacityEngine
  │    科举推进 advanceKejuByDays
  │    权威推进 AuthorityEngines
  │    腐败推进 CorruptionEngine
  │
  ├─ Phase F · 记录与渲染（tm-endturn-render.js）
  │    yearlyChronicles.push 本回合摘要
  │    memorialsLog 归档
  │    showPostTurnCourtBanner
  │    renderShiji / renderChronicle
  │
  └─ Phase G · 回合推进
     GM.turn++
     GM.date = getTSText(GM.turn)
     autoSave (slot 0) 每 N 回合
```

**调试技巧**：
- 每阶段卡住：看浏览器 console，搜 `[catch]` `[ai-validator]` `[SaveMigration]`
- AI 返回格式异常：`TM.getLastValidation()` 查最近一次校验
- 变更应用异常：搜 `applyAITurnChanges` 的 try/catch

---

## 7. AI 调用拓扑

```
callAI / callAIMessagesStream           ← tm-utils.js 基础调用
  │
  │  路由决策：tier
  │    _useSecondaryTier() / _getAITier()  ← 主/副 API 选择
  │
  └─→ fetch OpenAI 兼容 endpoint
      │
      └─ TokenUsageTracker.record         ← 消耗统计

主要调用点：
  ├─ endTurn()                             ← 主推演（最贵）
  ├─ 问对/朝议/廷议/御前                     ← 流式对话
  ├─ 科议 (keyi)                            ← 流式
  ├─ 独召密问 (mizhao)                       ← 流式 + JSON
  ├─ 奏疏生成 (generateMemorials)             ← NPC 自发
  ├─ 科举答卷/考官建议                         ← F3/F4
  ├─ 启动预演规划                             ← 一次性，startGame
  ├─ NPC 主动传书 (playerLetters)             ← 非阻塞
  ├─ 情节弧后台推进                           ← requestIdleCallback
  └─ post-inference 诏令问责                   ← endTurn 末尾
```

所有返回 JSON 的调用都应接入 `TM.validateAIOutput`（目前仅主 subcall1 接入，其他待迁移）。

---

## 8. 关键扩展点与反模式警示

### 做扩展时先看这里

| 想做什么 | 找这里 | 要改几个文件 |
|---------|-------|-------------|
| 新增一个角色字段 | `tm-char-full-schema.js` + `SaveMigrations` | 2-4 |
| 新增一个剧本字段 | 剧本 JSON + `tm-data-model.js` + 编辑器 | 3-5 |
| 新增一个 AI 输出字段 | `tm-ai-schema.js` + endturn prompt + 消费代码 | 3 |
| 新增一个诏令类型 | `tm-edict-complete.js` + `tm-edict-parser.js` | 2 |
| 新增一个子系统引擎 | 新建 `tm-xxx-engine.js` + endTurn hook | 2-3 |
| 新增一个 UI 面板 | `index.html` + 面板 JS + `tm-topbar-vars.js` | 3-4 |

### 反模式清单（别再做）

1. **直接 `GM.chars.find(...)`**：改用 `DA.chars.findByName(...)`
2. **AI prompt 里硬写字段名**：改用 `TM_AI_SCHEMA.describe(field).desc`
3. **新建 `xxx-p2.js / xxx-p4.js` 补丁文件**：在原 engine 内用 version flag 或 feature flag
4. **`catch(e){}`** 完全静默：至少加 `console.warn('[模块名] ...', e)`
5. **在运行时改 P 字段**：除非是兜底恢复，否则走 GM
6. **同概念多套命名**（char/character/npc/person）：优先用 `char`（`GM.chars` 的原生命名）

### 遗留补丁地图（谨慎修改）

```
tm-patches.js           · 2186 行 · 跨多个领域的后补 · 拆难度极高
tm-phase-a..h-patches   · 16 个文件 · 按阶段演化的补丁 · 局部合并可能
tm-phase-f1-fixes       · 某阶段专门修 bug 的补丁
tm-phase-g4-finalize    · 某阶段 "收尾" · 往往包含 monkey patch
tm-corruption-p2/p4     · 腐败系统的 2 个后补版本 · 计划合并
tm-guoku-p2/p4/p5/p6    · 国库系统的 4 个后补版本 · 最难合并
tm-neitang-p2           · 内堂系统的补完
tm-var-drawers / -ext / -final · 变量抽屉的 3 代版本
```

---

## 9. 新维护者 15 分钟上手路径

1. 打开 `index.html` 看 `<script src=...>` 列表（~161 行），建立文件分层心智（见 §3）
2. 读 `tm-data-model.js` 了解 GM/P 字段大致形状
3. 读 `tm-game-engine.js` 的 `startGame/enterGame/fullLoadGame`（生命周期入口）
4. 打开 `?test=1` 跑 smoke test，看 DA / Schema / Validator 都正常
5. 浏览器控制台试：`DA.chars.player()` `DA.guoku.money()` `DA.turn.current()`
6. 读 `tm-endturn.js` 顶 200 行（endTurn 函数的头部，感受结算流程开端）
7. 遇到不懂的全局变量 → `DA.meta.coveredGMFields` 或 grep `GM\.xxx`

---

## 10. 长期演化方向（路线图）

当前架构处于**可维护但增速放缓**的阶段。下一年若要保持可持续开发，建议以下演化：

1. **2026 Q3**：把 60+ 文件中直接访问 `GM.guoku/officeTree/chars` 的代码逐步迁移到 `DA.*`（不破坏，加标注）
2. **2026 Q4**：合并 `tm-guoku-p2/p4/p5/p6` 为单文件，用 feature flag 保留历史行为
3. **2027 Q1**：把 `tm-endturn.js` 的 Phase A-G 显式拆为管道步骤（每步可替换、可测试、可 dry-run）
4. **2027 Q2**：发布 JSDoc + TypeScript d.ts，生成 API 文档站点
5. **持续**：每新增 AI 字段必经 `TM_AI_SCHEMA`，每新增数据字段必经 `DA.*`

---

## 附录 A · 常用调试控制台片段

```javascript
// 查看当前玩家角色
DA.chars.player()

// 查看当前回合+日期+是否运行
DA.turn.current(); DA.turn.date(); DA.turn.isRunning();

// 查看国库三账
DA.guoku.money(); DA.guoku.grain(); DA.guoku.cloth();

// 查找某官员的所有兼任
DA.officeTree.postsOf('袁崇焕')

// 查看时局要务
DA.issues.pending()

// 查看最近一次 AI 校验
TM.getLastValidation()

// 运行所有测试
TM.test.run()

// 运行子集
TM.test.runOnly('DA.chars')

// 列出所有已注册测试
TM.test.listSuites()

// 启用/关闭 DAL 访问日志（分析热点）
DA.meta.enableLog(true);
// ...操作...
DA.meta.logSummary()

// 查看 Schema 已定义字段
TM_AI_SCHEMA.listFields()
TM_AI_SCHEMA.describe('office_changes')
```

---

## 附录 B · 最危险的底线

1. **SAVE_VERSION**：改数据结构时必须 bump + 写迁移函数，否则老存档全坏
2. **scenarios/*.js**：剧本文件一旦发布不可随意删字段，靠迁移兼容
3. **AI prompt 的字段顺序**：prompt 里字段说明越靠前权重越高，移动有性能影响
4. **index.html 加载顺序**：改顺序容易让后加载的覆盖失效
