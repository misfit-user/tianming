# 天命 AI 记忆系统契约（2026-06-01）

本文是代码层面的开发契约，用来约束后续扩展人物记忆、时政记、编年、裁断记录、语义记忆与 prompt 注入时的边界。它不是研究综述，而是落地规则。

## 1. Memory Envelope

所有可进入统一记忆管线的记录都必须投影为 `TM.MemoryEnvelope`。

最小字段：

- `schemaVersion`: 当前为 `memory-envelope/v0`。
- `projectionVersion`: 当前投影版本号。
- `saveId` / `worldId`: 存档与世界隔离键。
- `ownerScope`: 记忆归属范围。
- `readScope`: 允许读取范围。常见值：`public`、`player`、`npc:<id>`、`faction:<id>`、`system`。
- `writeScope`: 允许写入或治理范围。
- `body`: 原始事实体，仅用于审计和非 prompt 场景。
- `safeBody`: 可注入文本体。进入 prompt 的编译层必须优先使用 `safeBody`。

禁止：直接把外部候选、AI 摘要、draft、quarantine 文本绕过 Envelope 注入 prompt。

## 2. Authority And Lanes

权威等级决定冲突时的优先级：

- `engine_state`: 硬状态，最高。
- `player_pin` / `rule_validated`: 玩家诏令、法院裁断、规则验证结论。
- `court_report` / `structured_chronicle` / `event_log`: 朝堂记录、编年、事件日志。
- `ai_extracted`: 经过 WriteGate 接受的 AI 抽取事实。
- `ai_summary` / `vector` / `rumor`: 低权威，只能作为警示、线索或历史证据。

推荐 lanes：

- `L1_world_truth`: 世界硬事实。
- `L2_active_law_commitment`: 生效法令与承诺。
- `L4_dialogue_evidence`: 朝议、裁断、对话证据。
- `L6_retrieved_evidence`: 检索召回证据。
- `L7_chronicle_context`: 编年、史官记录。

## 3. WriteGate Lifecycle

WriteGate 是所有 AI 写入长期记忆的入口。

生命周期：

- `enqueue`: 候选进入 `_memoryWriteQueue`，生成 Envelope。
- `pending_review`: 进入 `_memoryDraftInbox`。
- `quarantined`: 命中注入风险或低可信风险，进入 `_memoryQuarantine`。
- `acceptDraft`: 人审或可信系统接受，状态变为 `active` / `accepted`。
- `flushAccepted`: 写入 `_memoryAccepted`，随后由 Envelope 投影进入检索链。
- `rejectDraft`: 保留审计，不进入可注入事实层。

容量上限：

- Write queue / draft inbox / quarantine / accepted 默认各保留 80 条。
- Audit events 默认保留 120 条。
- 裁剪必须保留最近记录，不得破坏已接受事实的 `id` 与 source refs。

## 4. Court Records

`GM._courtRecords` 是朝堂推演与裁断的重要依据。

投影规则：

- 有 `decision` / `resolution` / `result` / `adopted` / `decisions` 时，Envelope `type = court_resolution`。
- 否则 `type = court_record`。
- 裁断默认 `authority = rule_validated`；普通记录默认 `authority = court_report`。
- 默认 lane 为 `L4_dialogue_evidence`。
- `sourceRefs` 指向 `courtRecords:<id>`。
- 有 `sourceType/sourceId` 时，应生成 `basisRefs`，保留裁断依据。

召回规则：

- 裁断记录优先于 rumor、vector、普通 AI summary。
- 裁断不能被低权威记忆覆盖。
- 如需废止裁断，必须通过 `Controls/Edges` 建立明确 supersedes 或 invalidation。

## 5. Controls And Edges

`GM._memoryControls` 与 `GM._memEdges` 是记忆治理层。

Controls 可表达：

- `hidden`
- `archived`
- `markedFalse`
- `pinned`
- `resident`
- `supersededBy`
- `cooldownUntilTurn`

Edges 可表达：

- `supersedes`: 新事实取代旧事实。
- `contradicts`: 高权威事实压制冲突事实。
- `continues` / `elaborates` / `related`: 检索扩展关系。

容量上限：

- controls 默认保留 80 条。
- edges 默认保留 80 条。

规则：

- 当前事实检索不得注入 superseded、markedFalse、quarantined、readScope 不匹配的记忆。
- 历史证据检索可以保留旧事实，但必须带上状态和来源。

## 6. Memory Context Compiler

`TM.MemoryContextCompiler` 是 retrieval 到 prompt 的最后收口层。

职责：

- 接收 retrieval hits 或从 GM 收集 Envelope。
- 应用治理结果、范围、时间、权威、lane、预算排序。
- 生成稳定分区：
  - `coreFacts`
  - `courtRecords`
  - `chronology`
  - `recentEvents`
  - `relationshipFacts`
  - `warnings`
- 输出 `<memory-context schema-version="memory-context/v0">`。
- 进入 prompt 的文本必须来自 `safeBody` 优先路径。
- budget 裁剪必须保留 diagnostics 与 suppressed 原因。

SC_RECALL 注入规则：

- 优先使用 `MemoryContextCompiler.compileRecall()`。
- 如果 compiler 不可用，允许回退到旧 `<recalled-memories>` 注入。
- 注入 trace stage 使用 `sc05-recall-compiler`。

## 7. Verification Contract

每次扩展记忆系统至少检查：

- 新增 `smoke-memory-*.js` 放进 `web/scripts/` 即可：`run-smokes.js` 与 CI 按文件名自动发现，不必再往 `verify-all.js` 登记（原先强制登记的 `smoke-memory-manifest.js` 已于 2026-11-16 撤掉）。
- Envelope schema、retrieval governance、injection lineage、context zones、WriteGate、Controls/Edges 的 smoke 不得回退。
- 端到端黄金场景必须覆盖：
  - CourtRecord 优先于 rumor。
  - 新事实 supersedes 旧事实。
  - Draft / Quarantine 不注入。
  - readScope 不匹配不注入。
  - prompt 注入只使用 `safeBody`。
