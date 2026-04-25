# 常朝 prompt 迁移地图 · preview AI prompt → v2 prompt 体系

**目的**：把 `preview-changchao.html` 里的 AI prompt 增量（意图识别 / 点名识别 / NPC 立场化回应玩家）融合进 `tm-chaoyi-v2.js` 现有 prompt 体系·**不破坏 v2 既有 GM 上下文集成**。

**关联**：[CHANGCHAO_MIGRATION_MAP.md](./CHANGCHAO_MIGRATION_MAP.md)（总迁移地图 · §B 类）

---

## §1 v2 现有 prompt 函数清单

| # | 函数 | v2 行号 | 调 callAI 时机 | 注入字段（GM 上下文）|
|---|---|---|---|---|
| P1 | `_cc2_buildAgendaPrompt` | L200-256 | 朝会启动一次 | currentIssues / armies / evtLog / _ccHeldItems / 出席官员（性格/派系/loyalty） / 上次裁决倾向 |
| P2 | `_cc2_genRoundSpeeches` | L545-700 | 议论每轮 | character.personality / loyalty / faction / family / officialTitle / NpcMemorySystem 历史 |
| P3 | `_cc2_judgeChaosOnset` | L420-490 | 议论将开始时 | controversy / 参议人数 / 派系冲突 |
| P4 | `_cc2_phaseReact` | L745-779 | 玩家决断后 | 决断 action / item / 在场各 NPC stance |
| P5 | `_cc2_judgeSummonReaction` | L1131-1215 | 玩家传召某员后 | 召入者 rank/marital/identity / 在场 attendees / context |
| P6 | dissent 抗辩深陈 prompt | L851-866 | 玩家选"听其抗辩"时 | dissenter / 史例 / 祖制 / 民生 |
| P7 | reprimand outcome 判定 prompt | L885-941 | 玩家选"严斥"时 | target loyalty/personality / 5 类 outcome 概率 |

每个 prompt 函数内部已经把"完整 GM 上下文"灌得很充分。preview 这边只有"角色 mock 字典 + 议程 mock 数组"两层·上下文薄。

**所以方向明确**：preview 的 prompt 增量必须"叠"在 v2 函数末尾·不能替换 v2 函数主体。

---

## §2 preview 新增 prompt 段（要融合的）

### 2.1 玩家话意图识别（intent 7 类）

**preview 实现**（`buildNpcPrompt` 内）：
```js
const intentLabels = {
  inquire: '询问情况·想了解细节',
  aggressive: '言辞激进·有强行推进/严办之意',
  mediate: '倾向折中调和·或要求分批办理',
  sympathetic: '表达对百姓/受害者的同情忧虑',
  punish: '意欲惩治某人或追究失职',
  praise: '嘉许某人某事',
  doubt: '心存疑虑·需臣劝导或申辩',
  neutral: '随意发问·态度中性'
};
if (intent && intent !== 'neutral') {
  p += '【陛下话语意图分析】' + intentLabels[intent] + '。请以此为基调回应。\n';
}
```

**v2 注入位置**：`_cc2_genRoundSpeeches` 当玩家有 `_pendingPlayerLine` 时·拼到 prompt 末尾。

### 2.2 玩家话点名识别（mentioned）

**preview 实现**：
```js
if (isMentioned) {
  if (item.target === name) {
    p += '【重要】陛下点名提及你（' + name + '·正是被指弹劾对象）·你须自辩。\n';
  } else {
    p += '【重要】陛下点名提及你（' + name + '）·你须直接领旨·或谨慎进言·不可不应。\n';
  }
}
```

**v2 注入位置**：同上·`_cc2_genRoundSpeeches` 玩家插言后·拼到对应 NPC 的 prompt。

### 2.3 玩家自由话语 → NPC 立场化回应（**v2 全无**）

**preview 实现**：`npcRespondToPlayer(playerText, count)` + `generateNpcReply(name, item, playerText, stance, intent, isMentioned)`。这是一条 **v2 没有的新路径**——目前 v2 只在"议论中插言"和"决断后反应"两个时机让 NPC 回应玩家·没有"详述阶段玩家自由打字 → 主奏者+1 NPC 立刻回应"的交互。

**v2 处理方案**：
- 新建函数 `_cc2_npcRespondToPlayer(playerText, count, item)` 在 v2 命名空间
- 内部：findMentionedChars + inferPlayerIntent + 候选构造 + 调 `callAI`（**走 v2 callAI tier·不走 preview 的 fetch**）
- prompt 由新建函数 `_cc2_buildNpcReplyPrompt(name, item, playerText, stance, intent, isMentioned)` 生成·**复用 v2 角色上下文（character.personality/loyalty 等）**
- 在 v2 详述阶段的 `cy-player-input` Enter 处理处调用此新函数

### 2.4 朝威分流标识（strict / 众言）

**preview 实现**：通过 isStrictCourt 判定·UI 层呈现差异。但 prompt 没显式传给 AI。

**v2 增强**：在 `_cc2_buildAgendaPrompt` 和 `_cc2_genRoundSpeeches` 末尾追加：
```
【朝威状态】当前朝堂为「肃朝」（皇威 ≥75 且 皇权 ≥75）·百官谨慎·三品以下不主动发言除非陛下点名。所生成议程/发言须体现「殿中肃静·谨言慎行」。
```
或：
```
【朝威状态】当前朝堂为「众言」（皇威或皇权 <75）·百官较为活跃·有自发表态。可生成更多元化发言。
```

让 AI 生成的内容自身适应朝威·而不只是 UI 适应。

### 2.5 NPC 立场模板（intent-specific mock fallback）

**preview 实现**：`generateNpcReplyMock` 7 套 intent-specific 模板·AI 失败时兜底。

**v2 处理**：
- 简化版迁过去（模板代码 ~100 行）
- 作为 callAI 失败时的兜底·写在 `_cc2_buildNpcReplyPrompt` 配套的 `_cc2_replyMockFallback` 函数里
- 必须比 preview 简化·因为 v2 还有 NpcMemorySystem 等更丰富的兜底渠道

---

## §3 融合后 prompt 结构总图

### 3.1 议论发言 prompt（v2 P2 + preview B1/B2/B4 增强）

```
[v2 现有内容·完全保留]
你是 {name}·身份「{title}」·派系「{faction}」·品级 {rank}。
性格：{personality}·忠诚度 {loyalty}·与陛下关系：{relation}。
家族：{family}·官途经历：{officialTitle}。
NPC 历史记忆（最近 5 条）：
  - 朝议中曾「...」（情绪：忧）
议题原文：{detail}
【议论上下文】
  其他臣发言：
    韩爌（折中）：「臣以为...」
    王永光（反对）：「太仓存银已紧...」
{原 v2 prompt 主体}

[新增段·preview B1/B2 拼接末尾]
{若 _pendingPlayerLine 存在}
陛下方才说：「{playerText}」
【陛下话语意图分析】{intentLabel}。请以此为基调回应。
{若该 NPC 被点名}
【重要】陛下点名提及你（{name}{·是否 target}）·你须{自辩/直接领旨}。

[新增段·B4 朝威标识]
【朝威状态】{strict / 众言}·{描述}。

[v2 现有要求段·完全保留]
请以 {name} 的口吻·立场为「{stanceLabel}」·针对议题（含陛下话）作发言。
要求：
· 半文言·明末朝堂奏对体·「臣……」开头
· {wordHint·读 _aiDialogueWordHint('cy')}
· 立场鲜明·体现派系倾向与品级口吻
· 紧扣陛下话的具体内容
· 不重复 selfReact / debate 中的话
· 直接输出回应文·不要任何前后缀
```

### 3.2 NPC 回应玩家自由话 prompt（B3 新建）

```
[复用 v2 角色上下文工具函数·拼出与 P2 同样的 character/personality 段]
你是 {name}·身份「{title}」·派系「{faction}」·品级 {rank}。
性格：{personality}·忠诚度 {loyalty}。
NPC 历史记忆（最近 3 条）：...

[当前议程上下文·从 v2 P2 提取]
今日早朝·正议题「{title}」（{dept}上奏）。
议题原文：{detail}

[已有发言]
殿中已有臣表态：
  {selfReact[]}
议论中诸臣：
  {debate[].slice(0,4)}

[玩家话 + 意图 + 点名段·preview B1/B2]
陛下方才说：「{playerText}」
【陛下话语意图分析】{intentLabel}。
{若被点名}【重要】陛下点名提及你...

[要求段]
请以 {name} 的口吻·立场为「{stance}」·针对陛下的话作回应。
要求：
· 半文言·{wordHint·_aiDialogueWordHint('cy')}
· 立场鲜明·体现派系倾向
· 紧扣陛下话的具体内容（不要空泛"陛下圣明"）
· 不重复 selfReact / debate 中的话
· 直接输出回应文
```

---

## §4 字段对照表（preview → v2 GM）

| preview 字段 | v2 等价（GM/P 字段） | 备注 |
|---|---|---|
| `CHARS[name].title` | `findCharByName(name).officialTitle / title` | v2 char 有更多字段 |
| `CHARS[name].rank` | char 没有直接 rank·需从 GM.officeTree 推算 | preview 写死 1-9 品·v2 走 `_cyGetRank(ch)`（已删·要恢复或从 officeTree 查） |
| `CHARS[name].faction` | char.faction | 字段名一致 |
| `CHARS[name].class` | 计算属性·从 ch.class 或职衔推断 | "kdao/wu/east" 标签·v2 应在 buildPrompt 时计算·不存 char |
| `CHARS[name].absent` | `_isAtCapital(ch)` 反向 | 已有函数 |
| `state.prestige` / `state.power` | `GM.vars.皇威.value` / `GM.vars.皇权.value` | 从 GM 读 |
| `state.attendees / absents` | 遍历 GM.chars + `_isAtCapital` | 实时计算·不存 state |
| `AGENDA` 数组 | v2 `_cc2_buildAgendaPrompt` 生成的 `CY._cc2.queue` | 上线版完全 AI 生成 |
| `item.target` | item.target | 字段一致 |
| `item.controversial / importance` | 字段一致 | preview 直接复制 v2 schema |
| `item.selfReact` | **v2 没有此字段**·需新增到议程 schema | AI 生成议程时多加一个 selfReact 字段·或运行时按 controversial 派生 |
| `item.debate / debate2` | v2 现有 debate 字段·debate2 是新增 | AI 生成时让 prompt 多吐一组 |
| `state._chaosFired` | `CY._cc2.chaos` | v2 已有 |
| `state._strictQueue` | `CY._cc2.strictQueue`（新增） | 新增 v2 命名空间字段 |
| `state._dissentTarget / Item / Action` | `CY._cc2.dissent = {target,item,action}`（新增） | 同上 |

---

## §5 callAI 调用路径替换

| preview 调用 | v2 替代 |
|---|---|
| `await callAIPreview(prompt)` | `await callAI(prompt, _aiDialogueTok('cy', 1), null, 'secondary')` |
| 直接 fetch OpenAI 端点 | 走 `callAI` tier 系统 |
| 无 token usage 跟踪 | callAI 内部自动 record（TokenUsageTracker） |
| 无 abort signal | 接 `CY.abortCtrl.signal` |
| 无 cache | callAI 走 S4 通用 API 缓存 |
| 失败直接抛 | callAI 内部已重试·抛出已是真失败 |

---

## §6 测试用例（迁移后必跑）

| # | 用例 | 期望 |
|---|---|---|
| T1 | 1628 明剧本·朝威 55+60 → 跑议程 a1 → 玩家详述阶段输 "陕西饥情甚重 朕忧之" | 主奏者毕自严回应（用 sympathetic 模板）+ 1 NPC 跟话·内容紧扣"陕西饥情" |
| T2 | 同剧本·拉皇威 90 + 皇权 90 → 议程 a1 详述 → 系统气泡显示"诸臣肃然待旨"·rank ≥3 进请奏队列 | 决断区出现"📋 请奏 N 人"按钮·点 NPC 名进发言 |
| T3 | 议程 a4 弹劾温体仁 → 准奏 → 45% 概率温体仁抗辩 → 听其抗辩 → 从其议 | 决议反转·NpcMemorySystem 记入"陛下从我谏" |
| T4 | 议程 a4 → 严斥温体仁 → 5 outcomes 之一 | NPC loyalty/stress/ambition 实际改动·影响下回合 |
| T5 | 玩家详述阶段输 "温体仁可斩否？" | 温体仁立刻自辩 + 黄宗周等言官附议（点名识别 + intent=punish） |
| T6 | AI 失败（断网或 key 错）→ 玩家自由话 | 走 mock fallback·NPC 用 intent-specific 模板回应 |
| T7 | 退朝 → 总结 tally 圆胶囊·议程明细分色显示 | UI 与 preview 一致·数据从 CY._cc2.decisions 读 |
| T8 | 朔朝触发（`_isPostTurnCourt=true`）→ 跑朝议 → 决议 `targetTurn = GM.turn+1` | _courtRecords 标 phase=post-turn |
| T9 | 切到一个简化唐剧本（scenario.chaoyi.audienceHall='紫宸殿', deptOptions=三省六部）→ 跑朝议 | 标题"紫宸殿"·发部议下拉显示三省 |
| T10 | smoke-chaoyi.js 跑全套自动测试 | 全过 |

---

## §7 待用户确认的关键决定

1. **B3 NPC 回应玩家**：新建独立函数 `_cc2_npcRespondToPlayer` 还是合并进 `_cc2_genRoundSpeeches`？我建议**独立**·因为时机不同（前者是详述/议论中玩家说话即触发·后者是 NPC 轮次里）。
2. **B4 朝威标识**：是注入所有 prompt 还是只 NPC 发言相关 prompt？我建议**只注入 NPC 发言**（P2 / B3）·议程生成（P1）也加但简短一句。
3. **C9 字数 hint**：preview 写死 50-120·上线必须改 `_aiDialogueWordHint('cy')`·确认这是唯一的字数源吗？
4. **§4 item.selfReact 字段**：v2 议程 schema 没有此字段·要不要让 AI 生成议程时多吐 selfReact 数组？还是运行时按 controversial 从 debate 数组派生 1-2 条？前者更丰富·后者更省 token。
5. **§5.absent**：preview 用 `CHARS[].absent` 标记·v2 用 `_isAtCapital` 函数。迁移时统一用 v2 方式·确认无遗漏。

请逐项裁决·确认后开始动手实施总迁移地图的阶段 1。
