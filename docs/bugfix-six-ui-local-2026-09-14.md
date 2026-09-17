# 六项玩家反馈：本地补齐与再次验收

## 范围与版本来源

- 本次修复分支：`codex/fix-six-ui-20260914`，工作树 `E:\tianming-six-ui-20260914`，基于 fetch 后的 `origin/main`：`4b5fc853bf0b7501d26d0952c32c3a6fc9fc76cc`。
- 实际本地游戏：`C:\Users\37814\Desktop\tianming`。该目录有未提交的地图、财政户籍、历法、剧本文案等并行改动，只做精确片段补齐，不整文件覆盖。
- 本轮不提交、推送、合并、部署、改版本或打安装包。保持书卷式界面。没有读改真实 API 配置或玩家存档。

## 六项结果

| 反馈 | 定位及修复 | 验收 |
|---|---|---|
| 国帑分账显示 `div_...` | 旧修复只查扁平 `GM.regions`。本次新增只读名称索引，先查实时行政树，再兼容嵌套/字典地区、code 别名和账册名称。国帑与保留的年度决算实现共用；未知地区明确未载，不猜名称、不改财政键值。 | 真实天启区划 ID、树状区划、旧存档、重命名、循环引用、HTML 转义均验证。 |
| 户口下方错误的 0 户 | 当前 main/C 的读取逻辑已正确，但 C 缓存戳还停留在旧版本；更新入口缓存戳。户数读取人口明细等明确数据，缺失不伪装零，真实零仍保留。 | 官方天启应天府 `div_pref_ming_02_01`：1508850 口、290164 户；通过完整详情入口显示 `151万 / 29万户`，原明细不变。 |
| 帮助切栏目闪屏、栏目移动 | 当前帮助代码已是固定框架、正文局部更新，保留左侧节点和滚动；更新 C 的旧缓存戳，验证实际点击路径。 | 同一弹窗/栏目节点、导航位置/尺寸/滚动量不变；真实鼠标点击通过。 |
| 主副 API 模型列表与 thinking | C 文件虽存在，index 缺 `tm-ai-request-options`、`tm-api-models`、`tm-api-settings` 三个装载；`tm-utils` 丢了主副思考配置透传，`tm-ai-infra` 丢了请求参数和新输出字段支持。本轮补齐整个调用链。 | 两处 Model_ID 旁拉取/搜索/选择/手填；thinking 分别保存默认、开启、关闭；验证真实 GET 路径和四类 POST 请求体。 |
| 右栏第二次点击不关闭 | C 丢失已有的用户点击 toggle 逻辑及右栏按钮复用。恢复同按钮关闭、不同按钮切换、官制独立页再次点击返回；程序 `openPanel` 仍是幂等刷新。 | 点击开/关/切换与官制独立页通过，按钮 DOM 不被重建。 |
| 删除圣旨建议重建整页 | C 丢失卡片原索引及局部删除逻辑。恢复只删除对应卡片、更新数量/空态，不重开表单。 | 保留草稿、同一输入节点、选区、焦点及滚动；按原索引连续删除到零，按钮点击路径单独复核。 |

## 数据与质量边界

- 模型列表请求只访问玩家填入的目标 API；测试使用 `.invalid` 地址、合成凭据/响应和临时 Electron userData，禁止真实外网请求。未验证任何特定中转站的额度、在线可用性或私有协议。
- thinking 未显式选择时保持原模型默认，不裁剪提示词、工具或输出预算。四条传输路径与 SC1 已冻结请求体都做了断言；不能关闭思考的模型仍需按接口支持情况配置。
- API 列表改变地址/Key/关闭窗口后的迟到结果不能污染新窗口；返回的模型 ID 只作为文本，保存再打开也不能注入 HTML。
- 财政索引每次打开报表只遍历一次，不跨存档缓存；账本和行政树不写回。保留 `PhaseG4.openYearlyReport` 的旧决算入口，正式全局 `openYearlyReport` 的国帑页跳转不改变。
- 原始 C 备份：`E:\tianming-six-ui-20260914\_codex_tmp\six-ui-20260914-pre-fix`。备份最初在 web/backups，随后移到 web 外，避免把旧 index 误当成运行页面纳入引用门禁。
- C 的 `tm-help-social.js`、`tm-endturn-province.js`、`tm-patches.js`、`tm-endturn-ai.js`、`editor-authoring-agent-provider.js` 与本轮备份字节相同。C 现有历法、时代中性文案、公开人口视图以及地图成果没有被回退。
- C startup 清单由现有生成器重建：仅增加上述三个 API 入口，无移除项。所有补丁保留原文件行尾，额外做了“规范化文本不变”的行尾检查。

## 本轮验证记录

修复前 C 原生基线：`web/dev-tools/electron-bridge/4fe9b117-524f-4a61-ab91-520247959009/report.json`，复现侧栏不关闭、圣旨重建、API 控件缺失。增加嵌套区划后 `1994319c-1ccf-4ccd-ae07-888e48105fe3` 再次确认财政名称缺口；这些失败记录保留，不当作通过。

| 命令/检查 | 本轮结果与证据 |
|---|---|
| `node web/scripts/ci-smokes.js` | **966 PASS / 0 FAIL / 0 SKIP / 0 WAIVED / 0 suspect**。报告 `web/dev-tools/arch-guard/ci-gIDa1J/smoke-report.json`；新财政单测实际纳入。 |
| `node web/scripts/lint-arch-all.js` | **13/13 PASS**。备份移出 web 后重新执行通过，没有改门禁规则。 |
| `node web/scripts/verify-official-scenario-parity.js` | **27 assertions PASS**。官方同步只生成新工作树缺席的派生 JSON，已有跟踪派生物无变化。 |
| `node scripts/verify-release-contract.js` | **166 assertions PASS**；回执 `web/dev-tools/office-writeback/six-ui-release-contract-0436948f-d7ba-42a3-a7b2-138058a892d3`。 |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | **1117 files PASS**。由工具生成，未删任何原基线条目，仅 index、财政 UI、国帑抽屉三项 hash 更新。新工作树缺席的 45 个既有美术/语义模型文件从旧工作树逐项验 SHA256 后补齐，未降低资产门禁。 |
| `node web/scripts/build-startup-phase-manifest.js --check`（修复分支） | **PASS：416 scripts / 8 deferred**。 |
| `node scripts/verify-electron-bridge.js --seven-ui --repo C:\Users\37814\Desktop\tianming` | **26/26 PASS**。最终按钮路径、源码及清单回执 `web/dev-tools/electron-bridge/8fc25daf-d64e-470a-8fe5-7bdc96148200/report.json`；之前同源完整验收 `b0961f14-136f-4923-8c1b-0130784f69d2` 也通过。 |
| 同一原生套件，`--repo E:\tianming-six-ui-20260914` | 全部断言通过，回执 `web/dev-tools/electron-bridge/8746bb47-5c03-41a0-b9a4-aa2a3f991b46/report.json`。 |
| `node web/scripts/smoke-api-models-thinking.js` | **19 PASS**，同时在全量 966 项中再次执行。 |
| `node web/scripts/smoke-fiscal-region-labels.js` | **6 PASS**，同时在全量 966 项中再次执行。 |

截图在对应原生回执目录的 `seven-population.png`、`seven-treasury.png`、`seven-help.png`、`seven-edict.png`、`seven-api-settings.png`。人口与 API 页面已目视复核。

完整门禁结果仅指独立修复分支；C 的本轮六项功能以实际原生验收为准，不据此宣称其所有并行未提交工作已达到发布状态。用户需要保存当前进度后重新打开本地游戏，才会加载这轮补齐的入口；未重启现有玩家窗口。
