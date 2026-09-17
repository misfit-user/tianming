# 人物图志入口与任官参考

本地分支：`codex/fix-character-actions`；起点：`7edcefbd2d0f7b7f78b0e33e43dbdd9e69dd2bee`。只读 fetch 确认 `origin/main` 仍为 `14d477945f5ef78b913ed5f249b51c2002167d0f`。保留此前未推送的本地提交，原 `tianming` 工作树未覆盖。没有推送、合并、改版本、打包或发布。

## 核验与修改

- `tm-renwu-tuzhi.js` 的鸿雁/任免原来调用 `switchGTab`，只切换正式界面隐藏的旧页。现接正式鸿雁入口；任免先在图志内显示只读职位推荐，再进入已有选任器。
- 两处按钮组现在各只有一个“召入问对”和一个“鸿雁传书”，不再因地点名称不含“京、宫”等字而重复。问对原选模式入口本来可用，保留而非宣称重写；地点、阵营、健康、出行等实际限制仍由原问对系统执行。远方导流走可见的正式传书界面。
- 钉选原有存储动作保留，增加“取消钉选”及 `aria-pressed` 反馈；图志在前台时使用自身可见提示。关系按钮退出对参/其他视图，并把内容页签滚到可见区，避免切换了内容但玩家仍停在旧头屏。
- `phase8-formal-drafts.js` 暴露既有 `deskTargetLetter`；指定个人时退出群发模式，保留已有正文，调用既有草稿保存入口。未直接发送信件或调用 AI。
- 操作前核对当前世界、当前人物对象；同名人物有歧义、树路径变动、同名官署+官职无法由旧选任接口唯一识别时明确拒绝，不首项猜测。关闭图志释放推荐上下文。

## 推荐规则与边界

`tm-office-powermap.js` 的 `TM.OfficeFit` 只读实际 `GM.officeTree`，递归保留各级部门的全部职位；不从预览、硬编码官名表或上局剧本造职位。

参考分 = 基础能力 60% + 五常 40%。优先按剧本 `powers` 识别职责领域，没有权力字段才用职位/职责文字推断。各领域权重在“评分依据”展开显示；不是任命资格判定，也不是实际履职成功率。缺字段以 50 作明确标注的估计；支持五常中文/拼音/英文别名、空 `wuchang` 加 `wuchangOverride` 的旧形状；0 不作缺省。

默认不勾选“仅看缺额”，包含已有人职位，按分数降序排列；勾选后只保留缺额大于 0 的职位。岗位统计复用 `_offPositionStats`，给它独立副本，防止展示时迁移 live 树。部分缺额和未具象在任者均参与统计。已在此职不重复发起选任。

“进入官制选任”打开原 `_offOpenPicker` 并筛到当前姓名，仍由玩家在原流程确认。关闭图志后使用原选任器/辞旧兼任确认层级，不抬高选任器遮住后续确认框。原年龄/势力/现任限制没有放宽；多席任免结算未重写。

## 测试与证据（均为本机）

下表命令日志由 `node scripts/perf/run.cjs <标签> -- <命令>` 生成，位于 `web/dev-tools/perf-round1/<标签>-UUID/`，包含命令、退出码、HEAD、工作区状态与脏文件哈希。以下目录不提交到 Git，不冒充远程 CI 或玩家实存档结果。

| 命令 | 结果 | 退出码 / 日志标签 |
|---|---|---|
| `node web/scripts/smoke-character-actions-office-fit.js --ref 7edcefbd2d0f7b7f78b0e33e43dbdd9e69dd2bee` | 2 PASS / 25 FAIL | 1 / character-actions-final-before-clean |
| `node web/scripts/smoke-character-actions-office-fit.js` | 27 PASS | 0 / character-actions-final-node-clean |
| `node web/scripts/run-smokes.js --grep renwu` | 6 PASS | 0 / character-actions-old-ui |
| `node scripts/verify-electron-bridge.js --character-actions` | 15 PASS | 0 / character-actions-delivery-electron |
| `node scripts/verify-electron-bridge.js --edict-clarity` | 15 PASS | 0 / character-actions-edict-regression |
| `node scripts/verify-electron-bridge.js` | 三模式累计 29 PASS | 0 / character-actions-desktop |
| `node web/scripts/lint-arch-all.js` | 13 PASS | 0 / character-actions-cache-arch |
| `node scripts/verify-release-contract.js` | 166 PASS | 0 / character-actions-final-release |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS | 0 / character-actions-parity |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS | 0 / character-actions-builder |
| `node web/scripts/ci-smokes.js` | 921 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，923 个脚本全部执行 | 0 / character-actions-delivery-full |

最终全量原始报告 `web/dev-tools/arch-guard/ci-NQk6YX/smoke-report.json`，run ID `69c45a36-4089-43fc-9e6e-eafd5564c942`；日志目录 `web/dev-tools/perf-round1/character-actions-delivery-full-dde0897b-e27d-49ab-bb15-1742c9ed8abc/`。仍为 7 项具体资产缺席检查，豁免规则没有修改。测试时为起点 HEAD 加本次未提交补丁；运行时源码/测试哈希与最终交付一致，文档随后补齐，不冒称远端合并预览验证。

旧基线失败包括新推荐功能尚不存在，不能称为 25 个原有 Bug；原问对入口和死亡/玩家限制的正常对照通过。新增测试还读取两个官方剧本的原始官职/人物数据，检查遍历完整、分数有限和无写入；这不是两个剧本完整开局实测。

最终 Electron 报告与图片：`web/dev-tools/electron-bridge/c76ae03b-111b-4396-9f3c-a109d51c8a2c/`，含 `report.json`、`office-all.png`、`office-vacancies.png`、`office-confirmation.png`。使用锁定 Electron 33.4.11，Windows、DPR 1.25、1280×800 测试窗口、独立临时 userData、受控虚拟人物与外网阻断；按钮通过真实 DOM 点击及命中测试，未伪造桥接。

保留的首次失败：界面模板一个括号错误由 `node --check` 抓到后纠正；第一次 Electron 14 项通过后，测试把原有可点击 div 误选为 button，修改选择器后保留原命中/确认框断言通过；架构检查抓到问对 sibling 缓存戳漏同步，整族补齐后重跑，未扩大豁免。对应原始目录标签分别为 `character-actions-electron` 和 `character-actions-final-arch`。

原生 Computer Use 初始化两次失败（含重置）：`failed to write kernel assets: 系统找不到指定的路径。 (os error 3)`，未完成原生鼠标操作。没有真实 AI、玩家存档、Android/签名安装包验收声明；本次 Electron 到达并检查原任免确认界面，未将其夸大成全部任免分支的完整实机验收。

派生物由 `build-startup-phase-manifest.js`、`lint-global-providers.js`、`sync-official-scenarios.js` 及 `scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp` 同步。409 eager / 8 deferred 不变，热更清单 1096 项不变，只同步相关文件的 hash/size 和生成时间。官方正文、依赖和版本不改；`tm-wendui.js` 保留历史混合行尾，只让修改块沿用其原 CRLF。
