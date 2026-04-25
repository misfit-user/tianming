# 常朝迁移地图 · preview → tm-chaoyi-v2.js

**目的**：把 `preview-changchao.html` 里的新机制（朝威分流 / 启奏-详述两段 / 抗辩 / 严斥 5 outcomes / 时辰 / 喧哗 / 退朝 tally / 玩家自由话语意图识别）迁回主项目`tm-chaoyi-v2.js`·UI 全替换·prompt 与 v2 现有融合。

**关联文档**：[CHANGCHAO_PROMPT_MIGRATION.md](./CHANGCHAO_PROMPT_MIGRATION.md)（prompt 专项地图）

---

## 📊 实施状态总览（2026-04-25 更新）

| 类别 | 完成度 | 备注 |
|---|---|---|
| **A 类·UI 全替换** | 11/11 ✅ | 全部在 tm-chaoyi-v3.js 实现·USE_CC3 默认 true 已激活 |
| **B 类·prompt 融合** | 5/5 ✅ | intent + mentioned + 朝威标识 + 季节 + GM 角色上下文(personality/loyalty/记忆/关系) |
| **C 类·v2 资产保留+复用** | 11/11 ✅ | C5/C6/C7/C8 在 P0 波 3 全部补完·v3 决议真写 GM |
| **D 类·preview 独有清理** | 9/9 ✅ | P3 清 218 行 mock 死代码 |
| **G 缺席机制** | ✅ | P2·9 类缺席状态识别 + 衙门连续缺席惩罚 |
| **I 真实性** | ✅ | P4·季节天气视觉气泡 + AI prompt 注入 |
| **E v2 §1 物理删除** | 🟡 deferred | 标 deprecated·_cc2_buildAgendaPrompt 仍被 v3 复用·物理删除留待长期验证 |
| 路由切换 | ✅ | USE_CC3 默认 true·console `window.USE_CC3=false` 可回 v2 |
| smoke 测试 | ✅ | scripts/smoke-chaoyi-v3.js 56/0 接进 verify-all |

完成里程碑：所有 MIGRATION_MAP 任务·除 E 类物理删除外·全部通关。

---

## §0 旧存档兼容性（先决条件结论）

经审计 `tm-save-lifecycle.js#_prepareGMForSave`（L199）：**CY 全局不进存档**·只序列化 GM 字段。这意味着新版迁移天然兼容旧存档·无需 version bump、无需迁移脚本、无需"朝议中禁止存档"限制。

| 项 | 兼容性 | 说明 |
|---|---|---|
| `GM._courtRecords[]` 旧记录 | ✓ 完全兼容 | 新增可选字段（intent / mentioned / reprimandOutcome）缺失时用默认值 |
| `GM._chaoyiCount[turn]` | ✓ | 数字不变 |
| `GM._ccHeldItems[]` | ✓ | 旧 {dept, title, content} 新版照样消费·新可选字段（type/controversial/selfReact）有兜底 |
| `GM._pendingTinyiTopics[]` | ✓ | 不变 |
| `GM._isPostTurnCourt` | ✓ | 不变 |
| `GM._lastChangchaoDecisions[]` | ✓ | 不变 |
| `CY._cc2.*`（朝议进行中状态）| ✓ 不入存档 | 新增 _strictQueue / _chaosFired / _dissentTarget 对存档零影响 |
| 朝议中存档 → 加载 | ✓ 行为一致 | 旧版也是"朝议状态丢·重新开"·新版同样 |

**唯一需要注意**：新版读 `GM._courtRecords[i].intent` 等新字段时·要兜底访问（`record.intent || 'neutral'`）·防旧记录字段缺失炸场。所有新代码必须用兜底写法·这是迁移的硬约束。

**结论**：旧存档 100% 可读·迁移过程不破坏任何持久数据。

---

## §1 总览

```
preview-changchao.html (~2057 行 JS)            tm-chaoyi-v2.js §1 (~1330 行)
        │                                                  │
        ├─ UI/UX 层 ──────────────────[ A 全替换 ]────────→ 替换 v2 现 UI
        │
        ├─ AI prompt 层 ─────────────[ B 融合 ]──────────→ v2 prompt 末尾追加新段
        │                                                  （详见 PROMPT_MIGRATION）
        │
        ├─ GM 状态读写 ─────────────[ C 全采用 v2 ]─────→ 不动·preview 全 mock 丢弃
        │
        └─ 配置/控制条 ─────────────[ D 丢弃 ]──────────→ preview 调试专用·上线时
                                                            从 GM 读真实值
```

---

## §2 资产分类清单

### A 类 · UI/UX 全替换（preview 新版进 v2·v2 旧 UI 删）

| # | preview 新机制 | v2 旧实现 | 迁移行动 |
|---|---|---|---|
| A1 | 启奏 → 详述两段流程 | v2 announce → report → debate 三段 | **替换**·v2 改两段制 |
| A2 | 朝威分流（isStrictCourt + 请奏队列）| **v2 全无** | **新增** |
| A3 | 时辰流动（标题栏 🕒）| **v2 全无** | **新增** |
| A4 | 抗辩面板（dissent 三选一）| v2 部分（"听其抗辩 / 朕意已决 / 严斥"按钮）| **替换**·preview 形式更清晰 |
| A5 | 严斥 5 outcomes | v2 已有完全相同实现（lines 885-941）| **保留 v2 版**（preview 是从 v2 抄的镜像）|
| A6 | 退朝 tally 圆胶囊 | v2 文本"准N驳N议N留N" | **替换** |
| A7 | 朝堂氛围气泡（鸣鞭三响 / 山呼 / 缺朝名册）| v2 简略系统气泡 | **替换** |
| A8 | 玩家输入主控通道（去插言按钮·按 Enter 即说话）| v2 [📣 插言] 按钮模式 | **替换** |
| A9 | 议程类型 8 色编码（type-badge / detail border-left）| v2 已有部分配色（lines 238, 376）| **合并**·preview 配色更全 |
| A10 | 喧哗视觉化（红雾遮罩 + 鸣磬肃静按钮）| v2 已有触发逻辑·UI 较简略 | **合并**·v2 逻辑 + preview 视觉 |
| A11 | 朝会总结面板（圆胶囊 + 议程明细分色）| v2 文本汇总 | **替换** |

### B 类 · prompt 融合（v2 prompt 保留·preview 新段拼末尾）

详见 [CHANGCHAO_PROMPT_MIGRATION.md](./CHANGCHAO_PROMPT_MIGRATION.md)·此处仅列总目：

| # | 新增 prompt 段 | 拼接位置 |
|---|---|---|
| B1 | 玩家话意图识别（intent）| `_cc2_genRoundSpeeches` 末尾 |
| B2 | 玩家话点名识别（mentioned）| `_cc2_genRoundSpeeches` 末尾 |
| B3 | 玩家自由话语 → NPC 立场化回应（**v2 全无**）| 新增独立函数 `_cc2_npcRespondToPlayer` |
| B4 | 朝威分流标识（strict / 众言）| `_cc2_buildAgendaPrompt` / `_cc2_genRoundSpeeches` |
| B5 | NPC 立场模板（intent-specific）| AI 失败时的 fallback·走简版 mock |

### C 类 · 完全保留 v2（preview 不接触·上线版直接调）

| # | v2 资产 | 价值 | 备注 |
|---|---|---|---|
| C1 | `_cc2_buildAgendaPrompt` ~200 行 | 注入 GM.currentIssues / armies / evtLog / _ccHeldItems / 出席官员性格派系 / 上次裁决倾向 | **不动** |
| C2 | `callAI` tier 系统 | secondary 未配自动回 primary·token 计数·重试·超时 | **必须用** |
| C3 | `NpcMemorySystem.remember()` | 朝议中训诫/嘉奖/奏对都进 NPC 记忆 | **必须用** |
| C4 | `OpinionSystem.addEventOpinion()` / `AffinityMap.adjust()` | 朝议影响 NPC 关系 | **必须用** |
| C5 | `GM._edictTracker.push()` | 准奏的事真进诏令追踪表 | **必须用** |
| C6 | `GM._courtRecords.push()` (v2 inline 1935-1945) | AI 推演读"上回合圣意" | **必须用** |
| C7 | `GM._isPostTurnCourt` / 后朝并发 / `_pendingShijiModal` | 朔朝期间史记弹窗排队 | **必须用** |
| C8 | `GM._pendingTinyiTopics` 加题 | 下廷议 → 真转入廷议菜单 | **必须用** |
| C9 | `_aiDialogueWordHint('cy')` / `_aiDialogueTok('cy', n)` | 玩家朝议字数设置 | **必须用**（preview 写死 50-120 字要换） |
| C10 | `_isAtCapital` / `findCharByName` / `_isPlayerFactionChar` | 在场判定·角色查找 | **必须用** |
| C11 | `addCYBubble`（共享气泡组件 tm-chaoyi.js L137）| v2 大量调用 | **必须用** |

### D 类 · preview 独有须丢弃（调试专用）

| # | preview 项 | 上线版替代 |
|---|---|---|
| D1 | 顶部 `.preview-info` 控制条（皇威/皇权滑块、AI 配置 UI、模式切换、重启按钮）| 全删·上线时皇威/皇权从 GM 读·AI 走 P.ai 配置·朝制由触发路径决定 |
| D2 | mock `CHARS = {韩爌, 毕自严, ...}` 字典 | 删·上线时遍历 `GM.chars` |
| D3 | mock `AGENDA = [a1...a7]` | 删·上线时由 `_cc2_buildAgendaPrompt` AI 生成 |
| D4 | mock `state.prestige / state.power` 滑块状态 | 删·上线时读 `GM.vars.皇威.value` / `GM.vars.皇权.value` |
| D5 | `callAIPreview` 直接 fetch（自带 OpenAI 兼容协议）| 删·上线版调 v2 的 `callAI(prompt, tok, signal, 'secondary')` |
| D6 | `getAIConfig / saveAIConfig / showAIConfigModal`（preview 自管 localStorage.tm_api）| 删·上线时主项目设置面板已管 |
| D7 | mock `state.attendees / state.absents` 计算 | 删·上线时遍历 GM.chars 用 `_isAtCapital` |
| D8 | `_dissentResolve` 全局闭包模式（preview 简化）| 改·上线时走 v2 的 Promise/state 体系 |
| D9 | `closeSummary` window 暴露函数 | 改·收进 v2 命名空间 |

---

## §3 迁移项详细对照（按文件路径）

### 3.1 `tm-chaoyi-v2.js` §1 常朝（lines ~1-1330）

| 行号 | 原内容 | 迁移行动 |
|---|---|---|
| L14-120 | `_cc2_openPrepareDialog` 准备弹窗 | **保留**·入口不变·内部接新 UI |
| L122-198 | `_cc2_startCourtSession` 主入口 | **改**·改用 preview 的开场仪礼（鸣鞭三响视觉化 + 缺朝名册卡 + 山呼震动 + 御殿） |
| L200-256 | `_cc2_buildAgendaPrompt` 议程生成 prompt | **保留 + 增强**·末尾追加朝威标识（B4） |
| L260-310 | `_cc2_advance` 主循环·queue/decisions | **改**·两段制（announce → detail）替代三段制 |
| L312-340 | `phaseAnnounce` 启奏阶段 | **改**·preview 启奏短气泡 + [奏来/免议/再奏] 三选 |
| L342-440 | `phaseReport / phaseDebate` 报告+辩难 | **改**·合并为 detail 阶段·按 controversial 触发议论 |
| L442-540 | `_cc2_judgeChaosOnset` chaos 判定 | **保留**·preview chaos 视觉化叠加 |
| L545-700 | `_cc2_genRoundSpeeches` 议论发言 | **保留 + 增强**·拼 B1/B2 段（intent / mentioned） |
| L745-900 | `phaseReact` / `phaseReprimand` 反应+严斥 | **改**·preview 反应模板 + v2 严斥 5 outcomes（preview 镜像保留） |
| L920-1010 | `phaseClosing / phaseSummary` 退朝总结 | **改**·preview tally 圆胶囊 + 议程明细分色 |
| L1100-1330 | summon / 各种 helpers | **保留** |

### 3.2 `tm-chaoyi.js` 入口分发（已清债·153 行）

| 函数 | 迁移行动 |
|---|---|
| `openChaoyi` | 不动 |
| `closeChaoyi` | 加新增态清理（_strictQueue / _chaosFired / _dissentTarget） |
| `addCYBubble` | 加 sysKind 参数支持（ceremony / warn / success） |
| `_cy_pickMode` | 不动 |

### 3.3 编辑器面（CHANGCHAO_EDITOR_PHASE）— 留到下周期

按之前共识·编辑器侧的朝制配置（朝威阈值/请奏品级线/议程类型集/朝堂礼仪文本）**这次不做**·留到独立编辑器周期。

---

## §4 朝代适应性分析（重点）

### 4.1 通用 / 配置 / 剧本填三层

| 维度 | 通用（写死代码可全朝代用）| 配置（剧本 scenario 字段控制）| 剧本作者填（GM.chars / agenda） |
|---|---|---|---|
| **朝威机制** | isStrictCourt 阈值 75（皇威+皇权）| 阈值可剧本覆盖 `scenario.chaoyi.strictThreshold` | — |
| **rank 1-2 例外**（阁臣不待旨）| 数字"1-2 品" | 可剧本覆盖 `scenario.chaoyi.directSpeakRank` | char.rank（剧本作者填品级） |
| **议程类型 8 类** | routine/request/warning/emergency/personnel/confrontation/joint_petition/personal_plea | 可裁剪：剧本 `scenario.chaoyi.enabledTypes` | item.type（AI 生成或剧本预设） |
| **派系**（影响立场推断）| `inferStanceForResponder` 抽象逻辑 | — | char.faction（明=东林/阉党·宋=新党/旧党·唐=牛/李·清=满/汉） |
| **官署名**（"户部 礼部 ..."下拉）| **不通用**·此处需配置 | `scenario.chaoyi.deptOptions = [户部,礼部,...]`（明/清）/ `[尚书省,中书省,门下省,...]`（唐/宋）| — |
| **宫殿名**（"奉天门 / 紫宸殿 ..."）| 不通用 | `scenario.chaoyi.audienceHall`（默认 "正殿"） | — |
| **意图识别 7 类** | inferPlayerIntent 关键词 | 关键词可剧本扩展 | — |
| **严斥 5 outcomes** | 通用人性反应 | — | — |
| **抗辩三选** | listen / override / reprimand 通用 | — | — |
| **退朝礼仪**（鸣鞭/山呼/卷帘）| 唐以后通用·秦汉魏晋有别 | `scenario.chaoyi.openingRites = ['mingbian','shanhu','imperialEnter']` | — |
| **干支日期** | 通用计算 | scenario.startYear → 60干支转换 | — |
| **时辰** | 寅时初/正/三刻·卯时... 通用 | — | — |
| **角色** | — | — | GM.chars 全是剧本数据 |
| **议程内容** | — | `_cc2_buildAgendaPrompt` 读 GM.currentIssues/armies/evtLog 动态生成 | scenario 可预设 `chaoyi.fixedAgenda[]` |

### 4.2 各朝代差异点对照

| 朝代 | 朝制名 | 殿名 | 班次 | 派系类型 | 备注 |
|---|---|---|---|---|---|
| **秦** | 朝议 | 阿房殿 | 列侯将军 | 法/儒 | 朝议未制度化·跳过 |
| **汉** | 常朝 | 长乐宫/未央宫 | 文左武右 | 外戚/宦官/士族 | "鸣鞭"未确立 |
| **唐** | 常参 | 紫宸殿/含元殿 | 五品以上常参官 | 牛/李/关陇 | 三省六部·"押班"内官 |
| **宋** | 视朝/朔望参 | 垂拱殿/紫宸殿 | 文东武西 | 新/旧党 | 翰林学士草制·门下封驳 |
| **元** | 大朝（罕） | 大明殿/大安殿 | 蒙汉分席 | 蒙/色目/汉 | 朝议制度化弱·跳过 |
| **明** | 御门听政 | 奉天门/乾清门 | 文东武西 | 东林/阉党/楚浙 | preview 默认覆盖 |
| **清** | 御门听政 | 乾清门/养心殿 | 满左汉右 | 满/汉/八旗 | 朔望大朝有别 |

**结论**：
- **核心机制**（朝威/启奏-详述/抗辩/严斥/意图/点名）—— **全朝代通用**
- **官署名 / 殿名 / 班次法 / 派系 / 礼仪文本** —— **必须配置化**·走 `scenario.chaoyi.*` 字段
- **秦元两朝** —— 朝议制度未成熟·建议**剧本作者关闭朝议系统**或简化模式

### 4.3 配置字段建议（写进 scenario schema）

```json
{
  "chaoyi": {
    "enabled": true,
    "audienceHall": "奉天门",
    "openingRites": ["mingbian", "shanhu", "imperialEnter"],
    "strictThreshold": { "prestige": 75, "power": 75 },
    "directSpeakRank": 2,
    "deptOptions": ["户部", "吏部", "礼部", "兵部", "刑部", "工部", "都察院"],
    "factionMap": {
      "东林": { "tone": "support", "allyClass": "kdao" },
      "阉党残余": { "tone": "oppose", "allyClass": "eunuch" }
    },
    "enabledTypes": ["routine","request","warning","emergency","personnel","confrontation","joint_petition","personal_plea"],
    "fixedAgenda": []
  }
}
```

各朝代剧本只需替换 `audienceHall / deptOptions / factionMap`·机制层零改动。

### 4.4 编辑器面工作（下周期）

编辑器需新增"朝议规则"面板·配置上述 scenario.chaoyi.* 字段。规模约一面板·与"行政区划""官制"并列。

---

## §5 渐进式迁移步骤

### 阶段 0 · 准备（0.5 天）
- [ ] 备份 `tm-chaoyi-v2.js` → `.bak`
- [ ] 跑一次 verify-all 记录基线（207 通过 / 4 失败）
- [ ] 在主项目跑一次完整朝议·人工记录现有 UX 关键节点（用作回归对比）

### 阶段 1 · A 类 UI 替换（2-3 天）
按依赖顺序：
1. addCYBubble 增强 sysKind（A7 基础）
2. 议程类型 8 色 CSS（A9）
3. 开场仪礼三段（鸣鞭三响动画 / 山呼震动 / 缺朝名册卡）（A7）
4. 启奏-详述两段流程（A1·**最大改动**）
5. 朝威分流 + 请奏队列（A2·新增机制）
6. 时辰流动（A3·小改动）
7. 抗辩面板（A4·preview 形式替换 v2 旧 UI）
8. 退朝 tally 圆胶囊（A6/A11）
9. 喧哗视觉合并（A10）
10. 玩家输入主控通道（A8）

每步独立可测·verify-all 必跑。

### 阶段 2 · B 类 prompt 融合（1-2 天）
详见 [CHANGCHAO_PROMPT_MIGRATION.md](./CHANGCHAO_PROMPT_MIGRATION.md)。

### 阶段 3 · 朝代配置化（1 天）
- 新建 `scenario.chaoyi` schema
- v2 代码读取并使用 audienceHall / deptOptions / factionMap / strictThreshold
- 默认值兜底

### 阶段 4 · smoke 测试（0.5 天）
- 新增 `scripts/smoke-chaoyi.js`：朝威分流 / 抗辩 / 严斥 / 退朝 tally / 朝代切换
- 走完 1628 明剧本 + 一个简化唐剧本

### 阶段 5 · 邸报 + 推送（0.5 天）
- changelog.json 新条目
- git commit + push

**预估总工时**：5-7 天

---

## §6 回滚策略

每阶段独立 commit·verify-all 不过则回滚单 commit。备份 `.bak` 文件保留至阶段 5 完成后再删。

---

## §7 待用户确认的关键决定

1. **A1 启奏-详述两段制**：是否完全替换 v2 现 announce/report/debate 三段制？还是仍保留 report 阶段（"读全文奏报"）作为可选？preview 是合并的·更紧凑。
2. **A5 严斥 5 outcomes**：v2 和 preview 几乎一致·是否就用 v2 现版（preview 的是镜像·删 preview 这份）？
3. **朝代配置 §4.3**：scenario.chaoyi 字段集是否合理？是否还有遗漏维度？
4. **§4.2 秦元处理**：建议剧本作者**关闭朝议**·还是给一个"简朝议模式"（只支持 announce + decide·无议论无抗辩）？
5. **阶段 1.4 启奏-详述两段**改动最大·风险最高。是否要在该步进一步细分（如先做"启奏 UI"·跑通后再做"详述 UI"）？

请逐项裁决·确认后我开始 PROMPT_MIGRATION 文档·然后再动手。
