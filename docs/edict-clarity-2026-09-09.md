# 诏书撰写清晰度：本地验证

基线 `4f1615e887a2e2956932c696d5903dc291d9500d`，分支 `codex/fix-edict-clarity`，工作树 `tianming-perf-round1`。保留原 `tianming` 的用户改动和此前本地提交；没有推送、合并、改版本或发布。

## 修改与不变量

- `web/phase8-formal-drafts.js`：提示文字由半透明改为不透明棕墨色，类别小注加深。真实计算样式对应的提示字/底色对比度从 **2.4301** 变为 **5.1613**（最终精确值见原始 observations）。
- 卷轴、页首、侧栏和各输入行的入场动画保留，但不再向后填充已完成的 transform/filter。静止后的输入框祖先链均为 `transform:none / filter:none / opacity:1`。外框改用等价的 65px 边距居中，保留原宽高和窄屏规则。
- 不改字体、全局缩放、绢纹、卷轴、分类印章、润色/诏付入口、草稿序列化、AI、存档和旧渠道。不是将截图变清晰，也不声称查明玩家机器上每个模糊来源。
- `index.html` 只更新 drafts 双片的缓存戳。官方生成器只同步两个生产文件的 hash/size；基线仍 1096 项，版本仍 1.3.4.11。未打包。历史 CRLF 测试文件保持 CRLF；`.gitattributes` 仅声明该文件的 CR 行尾，真实空格检查不变。

## 可复跑与证据

`node scripts/verify-electron-bridge.js --edict-clarity` 使用正式 main/preload、真实 BrowserWindow 与正式面板，临时 userData，禁止外网，不使用玩家存档。增加相同命令到既有 Windows Electron CI，尚未远程运行。

相同最终测试脚本对独立基线工作树运行 `--repo E:/tianming-edict-clarity-baseline`：**9 PASS / 6 FAIL，退出 1**；修复后 **15 PASS / 0 FAIL，退出 0**。失败为三个桌面尺寸各自的低对比度与静止文字层断言，原布局/草稿正常对照均通过。

Windows / Electron 33.4.11 / Chromium 130 / 内部 Node 20.18.3 / CLI Node 24.14.0 / DPR 1.25。实际 CSS 视口为 1432×763、1280×800、1366×768（Windows 会对请求尺寸作 DPI 取整）。图像为真实窗口捕获，已查看 1432 宽度的前后图；不是原生鼠标或中文输入法组合态实测。

以下路径均相对仓根，本地 `web/dev-tools` 不入 Git；每个 perf-round1 目录含 `run.json`（命令、退出码、HEAD、dirty 文件哈希、平台）、stdout/stderr。被测源码是基线加本次改动；后续提交只有说明和 CR 属性声明差异，不冒称已测试远端合并提交。

- 基线：`web/dev-tools/perf-round1/edict-clarity-baseline-final-harness-169c8890-e73f-436b-8b2c-5fd0e57536aa/`；画面和逐祖先样式：`web/dev-tools/electron-bridge/b8b0b3cb-43f1-4fdb-86bc-a546dd554f43/`。
- 修复：`web/dev-tools/perf-round1/edict-clarity-final-electron-ab89b5fe-f16d-4322-9ce7-d92d9869d6ef/`；画面和样式：`web/dev-tools/electron-bridge/d7297653-73df-467b-b31b-5e57e5d88173/`（`edict-1432.png`、`edict-written.png`、`edict-clarity-observations.json`）。
- 最初探索：`web/dev-tools/perf-round1/edict-clarity-before-6f65268e-e35f-43f8-a73e-dcc85fc7d53c/`，退出 1。该次还发现原有 960×640 窄布局的行重叠；本轮桌面清晰度改动没有修它，未把该失败计为通过。最终同适配器基线对照保留全部桌面验收不变量，并且新增了完整祖先链检查。

## 门禁

所有命令以 `node scripts/perf/run.cjs edict-clarity-<名称> -- <命令>` 留原始日志，当前结果如下：

| 命令（仓根执行） | 结果 | 退出码 |
|---|---|---:|
| `node scripts/verify-electron-bridge.js --edict-clarity` | 15 PASS | 0 |
| `node scripts/verify-electron-bridge.js --edict-polish` | 15 PASS | 0 |
| `node scripts/verify-electron-bridge.js` | 三模式累计 29 PASS（有重复基础检查） | 0 |
| `node web/scripts/smoke-formal-module-modal-size.js` | 21 PASS | 0 |
| `node web/scripts/smoke-perf-desk-panels.js` | 15 PASS，含换局、草稿、快照 | 0 |
| `node web/scripts/smoke-fixed-fit-modern-viewport-units.js` | 8 PASS | 0 |
| `node web/scripts/smoke-formal-edict-polish-scope.js` | 16 PASS | 0 |
| `node web/scripts/lint-arch-all.js` | 13 PASS | 0 |
| `node scripts/verify-release-contract.js` | 166 PASS | 0 |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS | 0 |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS | 0 |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | 在场 686 项严格匹配，保留缺席的 410 项资产 | 0 |
| `node web/scripts/ci-smokes.js` | 920 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，922 个脚本全部执行 | 0 |

全量报告：`web/dev-tools/arch-guard/ci-uDz4Ww/smoke-report.json`，运行 ID `f547bc31-7b4b-4b96-bbb4-24300ce8fbd9`；命令日志 `web/dev-tools/perf-round1/edict-clarity-full-f89d95a9-b96b-4f3e-bdc1-2b4a54965212/`。仅沿用 7 项具体资产缺席豁免，未扩大规则；所有非资产断言均执行。`git diff --check` 最终退出 0。

生成命令均退出 0：`build-startup-phase-manifest.js`、`lint-global-providers.js`、`sync-official-scenarios.js`（前缀均为 `node web/scripts/`），以及 `node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp`。没有更改官方剧本正文或版本字段。

范围外：签名安装包、Android 真机、自定义固定分辨率下的清晰度、玩家截图的采集/缩放链、原生 IME。窄屏行重叠另需独立修复；不能称本轮对所有窗口尺寸已验收。
