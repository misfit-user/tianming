# 工坊地区查找与写入一致性修复

基线：`main@12942b78fe64d20f4eb9ee01827a2c3567b38bf1`（PR #73 合并后）。
分支：`codex/fix-authoring-region-paths`。本轮仅授权本地代码、测试与提交；未推送、未合并、未发布。

## 已确认的根因与修复

- `editor-authoring-agent.js::_searchEntities` 原本直接取 `draft[collection]`，因此 `map.regions`、`adminHierarchy.楚.divisions` 虽然真实存在仍被报为不存在。现在搜索、批量修改、数值统计与单字段读写使用同一个路径解析器，搜索结果附带 ID 与可直接读写的完整路径。
- `_resolvePath` / `applyEdit` 的旧失败回退会把未匹配到的数组实体名变成非索引属性，返回成功，但下一次读取不认，JSON 序列化也会丢弃。现在数组只允许现有索引或唯一 ID/名称；未知与歧义引用明确失败，新增实体须显式 `applyPush`。
- 合法实体下新增深层对象字段同样受到旧回退影响。现在先在脱离草稿的分支构造缺失对象链，整条路径通过后才挂接，后续索引失败不遗留半截字段。
- ID 优先于显示名称；重名不再首项匹配。数组 `length` 可读但不可写，缺失叶子的 `getField/getFields` 不再报作已找到。`applyPush/applyRemove/multiEdit` 保留追加、删除和整批回滚语义；已有可变数组不重复赋值给只读父属性。

这些是工坊编辑路径修复，不改地图美术、地名、游戏数值、财政/民心机制或历史存档。实际导出含186个地图地块和186个行政区；地区经济位于行政节点的 `economyBase`。存在同名地区，不能用模糊名称自动挑选其中一项。

## 行为证据

同一组33个行为测试直接执行工作树实现，或通过 `--ref` 读取基线完整模块；未替换旧夹具或预期答案。

```text
node web/scripts/smoke-authoring-region-paths.js --ref 12942b78fe64d20f4eb9ee01827a2c3567b38bf1
node web/scripts/smoke-authoring-region-paths.js
node scripts/verify-electron-bridge.js --authoring-regions
node scripts/verify-electron-bridge.js
```

基线33组：12 PASS / 21 FAIL（退出1）；修复后33 PASS（退出0）。包含嵌套与中文路径、ID/同名/重排、缺失与歧义失败、数组边界、对象字段新增、原型链保护、批量回滚、序列化读回、不同草稿隔离及旧追加语义。

Electron 33.4.11 在独立临时 userData 中加载真实 main/preload 和新旧两个工坊 HTML，通过实际 `makeResetEditorAdapter` 应用修改、`saveProjectSnapshot` 持久化、重载页面清空内存，再以 `loadProjectSnapshot` 读取。外部网络被阻断，无成功存储桩、真实账号调用或物理鼠标操作声明。

默认使用公开合成样本。另以只读的玩家导出复跑：设置 `TM_AUTHORING_REGION_FIXTURE` 为自己的 JSON 路径，再执行上述 `--authoring-regions` 命令。玩家完整 JSON 不入库，原文件 SHA-256 保持 `964a16eb2a86f34b1ad045e91f9a70ff8bac2ffb2cd4f4c1639fe7a7fd057bf9`。

最终正式门禁与原始命令结果见 [evidence.json](bugfix-authoring-region-paths/evidence.json)。其中每次执行含 HEAD、工作区状态、平台、Node、命令、退出码、源码哈希与脱敏日志。测试执行时 HEAD 仍为基线，补丁位于已记录哈希的工作树；这些测试完成后仅补充文档/证据，再一起提交，不把基线 SHA 当成已经包含补丁。

| 最终命令/对象 | 退出码 | 实际结果 |
|---|---:|---|
| `smoke-authoring-region-paths.js` | 0 | 33 PASS |
| 原有 authoring / office-source 相关脚本 | 0 | 9脚本 PASS |
| `verify-electron-bridge.js` | 0 | 29 PASS（生产 / 测试导出 / 重启） |
| `verify-electron-bridge.js --authoring-regions` | 0 | 合成样本12 PASS |
| 同命令 + `TM_AUTHORING_REGION_FIXTURE` | 0 | 玩家导出只读副本12 PASS |
| `lint-arch-all.js` | 0 | 13守卫 PASS |
| `verify-release-contract.js` | 0 | 166断言 PASS |
| `verify-official-scenario-parity.js` | 0 | 27断言 PASS |
| `verify-hot-builder-gates.js` | 0 | 27合成构建夹具断言 PASS |
| `audit-repro.cjs --repo <本工作树> --expect-clean` | 0 | 11探针未复现旧缺陷，2对照通过，0框架错误；不代替本轮正向行为测试 |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`（实际npm CLI） | 0 | 0 vulnerabilities |
| `ci-smokes.js` 最终冻结代码 | 0 | **917 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，919脚本全部执行** |

最终全量运行身份为 `e78ffeba-9018-4bc7-a930-c58e7736e02a`。两项 WAIVED 仍只对应音频5项、地图编辑器2项缺席资产检查，不曾扩大豁免。证据导出器核对9个生产/测试/入口文件哈希与最终全量执行一致。Electron 的12/29计数为检查记录，含重复的基础桥接断言，不冒充互不重复的完整游戏流程。新的合成工坊 Electron 用例已接入既有 Windows CI，但本轮尚未推送或取得远端检查。

## 初次失败与验证边界

- 首个 Electron 测试在 `did-finish-load` 后立即断言 ready，早于编辑器实际的异步 IndexedDB 初始化。测试适配为等待现有 ready 标记；没有改应用行为或扩大外层超时。
- 修复中自查发现追加已有数组时多余的父属性赋值会使只读父属性报错。单独失败回归记录为32 PASS / 1 FAIL；一行修正后锁定33组，重新运行最终门禁。
- 首次审计记录器不能直接 spawn Windows 的 `npm.cmd`（EINVAL），不是依赖审计结果。之后直接调用实际 `npm-cli.js` 完成审计。
- 原始 `git diff --check` 将纯 CRLF 的 preview HTML 两条修改行末尾的 CR 报作空白（退出2）。遵守字节冻结保留该文件594条 CRLF；采用 `git -c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol diff --check` 验证通过，未关闭真正的行尾空格/空行/制表符检查，也未修改仓库 Git 配置。
- 脚本 HTML 缓存戳按既有双文件家族同步，保留原行尾。官方生成器维护热更清单，1094条保留、无移除、版本仍1.3.4.11；没有制作用于发布的安装包或热更包。
- 不声称玩家那次未知工具参数已逐字重演，也不把本轮编辑器读写验证扩展成所有地方数值的开局/回合机制验收。历史上已丢失、从未真正写入 JSON 的编辑，不能凭空恢复，应在修复后重新提交。
