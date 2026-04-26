# Scenario→Engine→UI 对齐修复计划（**核验后精简版**）

> 原审计列出 16 项·**逐条核验代码后修订**：
> - **5 项假错误**：agent 误判·已确认无需修（A.1/A.2/A.4/B.7/B.10）
> - **5 项真错误**：需写代码（A.5 / A.3 增量 / B.6 增量 / B.8 增量 / 16）
> - **3 项轻微**：已有兜底·仅文档化（D.11/D.12/D.13）
> - **3 项未深查**：B.9 起居注 category / B.14-15 皇权皇威 subDims·待 spot-check
>
> 工作目录：`C:\Users\37814\Desktop\tianming\web`

---

## ❌ 假错误清单（**不修**）

| # | 原审报 | 实际真相 |
|---|--------|----------|
| A.1 科举字段 | `quotaPerExam` 不被读 | `tm-keju.js:136` UI 已读·`currentExam/stages/quota` 是 runtime 动态考试实例·不应在 scenario |
| A.2 党派双定义 | L2583 简化 vs L5809 完整 | L2583 是 `corruption.entrenchedFactions[]`（腐败派系），与 `parties` 是不同对象 |
| A.4 邸报无持久化 | 缺 `GM.ebHistory` | `addEB()` 第 304 行 `GM.evtLog.push` 已持久化 + 500 条 LRU·**字段名叫 evtLog 而非 ebHistory** |
| B.7 supervision 孤立 | engine/UI 完全未用 | `tm-corruption-engine.js` line 34/561/667/853 + p2:552 + p4:394 多处使用 |
| B.10 物价双源 | grainPrice 冲突 | `prices.grain`=指数(1.0 基准)·`currency.market.grainPrice`=单价(两/石)·**不同语义维度·非冲突** |

---

## ✅ 真错误清单（**需修**）

### A.5 军事双 schema 同步 🟡

- **现状**：`tm-game-loop.js:807` 只在 startGame 写 `GM.armies`·`tm-huji-deep-fill.js:393` 用 `GM.population.military.types`·两源后续不联动
- **方案**：`tm-military.js` 新增 `syncMilitarySources(GM)`·endturn 后调用·`armies[]` 为权威源·`population.military` 派生
- **改动**：~80 行 · 中风险 · 不破存档
- **验证**：AI 增减一支军后两源数字一致

### A.3 增量 cascade 细分进 turnChanges 🔴

- **现状**：`GM.turnChanges` 已有 7 类(variables/characters/factions/parties/classes/military/map)·**但** cascade 细分(中央/地方留存/被贪/路耗)只在 `GM._lastCascadeSummary` 临时对象
- **方案**：在 `tm-fiscal-cascade.js` collect 末尾·把 `totals.{central,localRetain,skimmed,lostTransit}` 各项推入 `GM.turnChanges.variables` 用合适的变量名（如"上解中央钱"/"地方留存粮"）·让史记自动渲染
- **改动**：~80 行 · 中风险 · 不破存档（追加结构）
- **验证**：一回合 cascade 后 `GM.turnChanges.variables` 含 4 项 cascade 细分

### B.6 增量 官制最小权限判定 🟡

- **现状**：`bindingHint`/`powers`/`privateIncome.illicitRisk` 已被 `tm-ai-change-applier` + `tm-ai-npc-memorials` 读用作 prompt 描述（"肥缺"标签）·但**无实际权限判定规则**
- **方案**：`tm-hongyan-office.js` 新增 `canPerformAction(charName, action)`·检查 char.officialTitle → position.powers[action]·支持 `appointment/impeach/taxCollect/militaryCommand` 4 类·诏令解析时调用·拒绝时显示"X 无 Y 之权"
- **改动**：~60 行 · 中风险 · 不破存档
- **验证**：内阁首辅可批红·六部尚书不可

### B.8 增量 scenario 补 minxinByClass 初值 🟡

- **现状**：engine `tm-authority-engines:316/331` 已读 `_readInitialObject('minxinByClass')`·`tm-authority-deep:196` 与 `tm-class-mobility:108` 用·**问题在 scenario `minxinByClass` 不写**·byClass 字段空挂
- **方案**：`scenarios/tianqi7-1627.js` `authorityConfig.minxinByClass` 写 5 阶级初值（士大夫 35 / 商贾 50 / 农民 30 / 工匠 45 / 游民 20·按 1627 民怨实情）
- **改动**：~20 行 · 低风险 · 不破存档
- **验证**：游戏开局 `GM.minxin.byClass` 5 项有值·tm-class-mobility 触发的 clergy index -25 能正确从 60 减到 35

### #16 势力 leadership 5 字段实装 🟢

- **现状**：scenario L5377+ 写 `{ruler, regent, general, chancellor, spy}`·engine 仅读 ruler·其余 4 字段浪费
- **方案 A（轻量·建议）**：`tm-data-model.js` 加注释保留·暂不实装·后续按需扩展
- **方案 B（实装）**：`tm-faction-engine.js` 用 general 字段做军事行动倾向 + spy 字段做情报概率·~50 行
- **改动**：A=注释 0 行·B=~50 行 · 低风险

---

## 🟢 仅文档化（**不修代码**·已有兜底）

| # | 项 | 文档化措施 |
|---|---|-----------|
| D.11 | 军事 size/soldiers/strength 三选 | scenario 注释 `soldiers` 为权威·tm-military 加 deprecate warn comment |
| D.12 | hukou vs population.national | docs 写明 `population.national` 权威·`hukou` legacy 视图保留 |
| D.13 | prosperity 位置 | docs 写明顶层 `prosperity` 当前与 `economyBase.prosperity` 通过 fallback 50 兼容·后续可重构 |

---

## 🟡 待 spot-check（**未深查·先放着**）

- B.9 起居注 category 中英混用：需 grep 实际 category 值·确认是否真混乱
- B.14 皇权 subDims 不同步：scenario 设 4 维初值·engine 是否在 index 变化时同步？
- B.15 皇威 subDims 缺 scenario：engine auto-fill 兜底·scenario 是否需补显式初值

---

## 跨依赖

- A.3（cascade 进 turnChanges）独立，可先做
- B.8（minxinByClass 初值）→ tm-class-mobility 已用，补完即可立即生效
- B.6（权限判定）独立，但与未来诏令解析改造耦合
- A.5（军事 sync）独立

---

## 估算总量

| 项 | 行数 | 风险 | 破存档 |
|----|------|------|--------|
| A.5 军事 sync | ~80 | 中 | 否 |
| A.3 cascade→turnChanges | ~80 | 中 | 否 |
| B.6 权限判定 | ~60 | 中 | 否 |
| B.8 minxinByClass | ~20 | 低 | 否 |
| #16 leadership | 0~50 | 低 | 否 |
| **合计** | **~240-290** | — | **0 项需 migration** |

预计 1 个工作日完成·verify-all 5/5 收尾。

---

## 总结：审计 ROI

- agent 报 16 项 → 核验 5 项假错误·折算 31% false positive 率
- 真问题集中在「**真双源**」(军事)+「**字段未实装**」(权限/leadership)+「**初值缺**」(minxinByClass)+「**delta 散落**」(cascade)
- 之前 17 个邸报修过的真问题（cash/money、publicPurse、turnIncome 等）才是更严重的——agent 这轮没找到新的同级 bug
- **建议**：直接修这 5 项·跳过假错误 + 文档化·避免无谓改动
