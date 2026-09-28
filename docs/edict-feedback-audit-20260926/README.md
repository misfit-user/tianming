# 过回合诏书效果反馈审计

日期：2026-09-26。检查当前本地工作树（版本 1.3.5.2，HEAD `5bef8008fe3592e8c026fbbe3bf03345b1cadf2d`）。本次只诊断：未改正式源码、玩家存档或设置，没有调用真实模型。

## 结论

已复现执行回报链路中的实际断点。最直接命中的是“润色 → 颁行天下”的完整诏书：**原文进入推演输入，但没有统一登记进执行追踪表；即使 AI 已返回执行回报，也可能无法匹配而被丢弃。**

普通手写诏令也有反馈展示问题：“执行中”的回报可以已经存入追踪表，却没有出现在过回合结果页。额外的后台“御批回听”晚于归档完成时，不会回填该回合的 HTML；已有旧报告还可能被显示在新回合中。

这能解释“玩家看不到自己的诏书反馈”，但不能仅由此判定每道诏书都未产生效果。没有玩家原存档、具体诏书和原始 AI 回包，不能确定他遇到的是哪一个断点，或某项数值是否实际变动。

## 1. 完整诏书漏登执行追踪表

### 真实调用链

1. `web/tm-hongyan-edict-ui.js` 的 `_applyPolishedEdict('replace')` 把完整诏书写到 `GM.edicts`，状态为 `promulgated`，同时清空五类草拟。`phase8-formal-drafts.js:1873` 的正式界面分支同样清空五类，保持整道诏书处理。
2. `web/tm-endturn-prep.js:353-365` 只给五类手写输入登记 `GM._edictTracker`。
3. 到同文件 `503-511`，才把已颁行全文填入 `edicts.decree`，此后没有补登记整道诏书。后续机械准备也没有为本次复现样本补出对应条目。
4. `web/tm-endturn-prompt.js:590-594` 会包含“颁行诏书·全文”，所以不能说原文一开始就丢了。但这一分支没有对应的追踪编号；五类手写段落才在 `603-604` 注入 `edictId`。`web/tm-endturn-ai.js:2287` 用该基础提示构造主推演输入。
5. `web/tm-endturn-apply.js:4955-4983` 将 `edict_feedback` 匹配到 `_edictTracker`；找不到条目时不落账、不提示未匹配。

### 对照复现

使用实际发布函数、实际输入收集代码及实际反馈写入代码：

| 输入方式 | 输入保留全文 | 对应追踪条目 | 同样的 completed 回报 |
|---|---|---:|---|
| 写入“政令”草拟 | 是 | 1 | 正常更新执行状态与反馈 |
| 润色后“颁行天下” | 是，位于 decree | 0 | 无处写入，反馈消失 |

进一步通过官方天启 JSON 的正式 `doActualStart` 启动，执行完整 `_endTurn_collectInput()`，而非仅抽取登记片段：

```text
诏书：令百官奏事时均注明承办人及日期，以便逐项检核，不得虚报。
decree 全文保留：是
收集前 tracker 数：0
收集后 tracker 数：0
对应 tracker 数：0
```

证据：[完整启动复现](native-collection-results.json)、[发布/登记/反馈对照](results.json)。

### 同一关联层的另一处错误

`tm-endturn-apply.js:4979-4983` 的最后兜底没有核对类别或编号，直接取本回合第一条 pending。探针给出一个不存在的 `edictId`，仍能把无关的第一道诏令标成 completed。完整诏书与其他待办混用时，不能把“某处出现过回报”视为它已经对上正确诏令。

## 2. 反馈存了，但过回合页面没展示

- `tm-endturn-apply.js:5016-5022` 能把新诏令的 status、feedback、progressPercent 写进 tracker。
- 随后的即时事件分支仅处理 obstructed/completed/partial，以及旧诏令进展。**本回合新诏的 executing 或 pending_delivery 没有对应的即时回报分支**；在途分支还会提前 return。
- `tm-endturn-shiji-compose.js:1084` 的“御批回听”只读取 `GM._edictEfficacyReport`，没有直接渲染本回合 tracker 的反馈，也不直接消费主推演的 `edict_feedback`。

离线给真实写入口返回：

```text
status: executing
feedback: 本诏已派员逐县查勘，预计下月复奏。
progressPercent: 30
```

结果：tracker 保存了上述反馈；事件列表没有新增项；真实 `_composeShijiHtml()` 生成的本回合页面没有这段话。AI 在叙事中额外复述它时玩家可能看到，否则基本反馈依赖其他入口。

## 3. 后台回听晚到，不能补入已经归档的页面

- `tm-endturn-pipeline-steps.js:543-552` 把 `edict_efficacy` 作为后台任务启动。
- `tm-post-turn-jobs.js:29-43` 的必须等待/保存任务只有 sc25、sc25c，不包括该审查。
- `tm-endturn-render.js:508-571` 将当时生成的 HTML 一次性写入 `shijiHistory`。
- `tm-endturn-ai-helpers.js:375-455` 等待审查结果后只更新 live report、历史评分和编年记录，没有重建已存的该回合 HTML。
- `tm-endturn-shiji-compose.js:1087` 读取报告时不核对 `ef.turn`，所以旧报告也会被放入新回合结果。

探针以受控 Promise 模拟后台晚到（无真实 API）：

| 状态 | live report | 已归档的 T4 页面 |
|---|---|---|
| 后台仍在等待 | 上期 T3 报告 | 显示 T3 内容 |
| T4 后台报告到达 | 正确变为 T4 报告 | 仍是 T3 内容 |

在没有旧报告的首次审查中，当前报告到达后，已归档页面仍没有该反馈。手动重新调用真实渲染函数能显示新报告，说明断点在更新/归档时序，而非报告根本无法渲染。

## 4. 缺少逐条回报的覆盖检查

主提示明确要求每道诏令报告，但 `tm-ai-output-validator.js` 只检查反馈的顶层数组形状，没有必填子字段或与实际下诏清单的对应校验。`tm-endturn-validity.js:136` 起的提交校验检查主推演存在、叙事可用等，也没有验证诏令逐条覆盖。

两道已知诏令的三个受控结果均通过 strict 输出校验和提交校验（status=ok，无反馈缺失警告）：

- 整个 `edict_feedback` 字段缺失；
- `edict_feedback: []`；
- 只回报其中一道。

因此“提示词要求逐道交代”尚未形成可验证的回执约束。

## 修复顺序建议

1. **统一编号与登记。** 保留整道颁行语义，将完整诏书接入已有执行追踪表，以稳定编号贯通输入、反馈、档案与长期效力；不要把全文再次塞回五类输入造成重复推演。
2. **主结果立即给回执。** 每道诏令都显示执行状态、承办者、具体结果或受阻原因、待办项与已确认的数值变化。执行中、在途和缺反馈也应明确显示，不能只有完成时才可见。
3. **处理遗漏与错号。** 按本回合提交的编号检查覆盖；无法对应的反馈保留为待核，不应静默丢弃或套给第一条待办。缺项标明“未获得回报/待补正”，必要时定向补齐，不捏造已经执行的结果。
4. **后台审查独立补充。** 御批回听按正确回合回填、刷新，并避免跨回合串报；基础执行回执直接使用主推演结果，不依赖额外审查是否及时完成。

## 模式与证据边界

- 上述完整发布/输入收集与反馈写入复现针对常规推演链路。
- Agent 分支的补登记位于 `tm-endturn-agent-mode.js:962`，受 `agentEdictOversightEnabled` 开关控制（118）；关闭时不会提供这项兜底。不能把它当成所有模式都已自动补登记的保证。本次未运行真实 Agent 模型。
- 15 个相关生产文件的 SHA-256 已记录并在探针结束后核对，均未变化。
- 现有四项相关 smoke 全绿：decree-whole（16 assertions）、edict-efficacy（19 cases）、formal-edict-endturn-bridge、shiji-volumes（49 assertions）。它们分别验证文本注入、已有 tracker 的效力、静态桥接、已准备好的审查数据，未覆盖本次端到端断点。

复跑（在仓根）：

```powershell
node docs/edict-feedback-audit-20260926/probe.cjs
node docs/edict-feedback-audit-20260926/native-collection.cjs
```

前者成功复现 8 组行为，后者验证正式官方启动后的完整收集路径。探针只在隔离 VM 中改状态，正式代码、用户存档与真实 API 均未改动或调用。
