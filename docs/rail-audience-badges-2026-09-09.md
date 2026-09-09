# 右栏红泡：对应真实请见

本轮基线 `38fab3a4fe97d0d4ee9ec077be4754e67f9f0fc3`，分支 `codex/fix-rail-badges`。只在独立工作树本地实施；保留之前本地提交及原工作树用户改动。读取远端时 main 为 `14d477945f5ef78b913ed5f249b51c2002167d0f`，本轮未推送、合并或发布。

## 行为与边界

- 原数字不是全部写死：阶层/党派入口数待批奏疏，问对入口数未决政务，钉选入口数已钉选总数，军务和风闻数历史记录。根因是计数与入口内容不对应、没有消退语义。
- `phase8-formal-rightrail.js/rightWenduiPendingState` 复用现有候见过滤与 `rightWenduiIsSeeker`，名单和红泡共用查询。队列、现有议程派生求见均计入；同人不重复计算，多条原始来意与 `_qid` 保留，不改为按数组下标删除。
- `phase8-formal-bridge.js/updateRailBadges` 只保留宫殿入口的请见数字；零时隐藏，悬停/辅助标签说明人数。`openRailPanel` 在有请见时直接打开问对名单，而非上次停留的朝议页；进入页面本身不算处理。
- 接见结束沿用 `_lastMetTurn`；拒见使用 `tm-wendui.js` 原处理入口，新增 `_lastAudienceDeniedTurn` 仅抑制本回合已经拒绝的动态求见，不伪造接见。原忠诚、压力、记忆后果保持。下回合仍满足旧条件时可以重新求见。
- 刷新沿用现有渲染、问对处理及关闭回调，没有增加轮询计时器或另建提醒系统。其他入口及原渠道保留，不把钉选总数、旧闻数冒充待办。
- 现有队列兼容规则不收窄：使节、作者预置请求保留；查无此人的旧记录仍由原消费路径处理，不盲删恢复材料。这里没有新增 AI 求见生成逻辑、朝议任务或游戏机制。

## 验证

所有命令从工作树根执行，命令均经 `node scripts/perf/run.cjs <标签> -- <下列命令>` 保存退出码、被测 HEAD、脏树文件哈希、环境和原始输出。下表目录均位于 `web/dev-tools/perf-round1/`（本机证据，不声称已上传）。

| 命令 | 结果 / 退出码 | 证据目录 |
| --- | --- | --- |
| `node web/scripts/smoke-right-rail-badge-semantics.js --ref 38fab3a4fe97d0d4ee9ec077be4754e67f9f0fc3` | 5 PASS / 19 FAIL，1 | `rail-before-cached-final-4272fc56-e852-4c67-92e8-0c30f4be404b` |
| `node web/scripts/smoke-right-rail-badge-semantics.js` | 24 PASS，0 | `rail-target-cached-final-049caf41-adfb-4903-ade7-4e440ced8a40` |
| `node web/scripts/smoke-newui-routing.js` | 41 PASS，0 | `rail-routing-da6ce8ae-9c77-4a41-a3e8-4c8667ac0864` |
| `node web/scripts/smoke-rightrail-datasource.js` | 50 PASS，0 | `rail-datasource-cc4bc0e3-9472-48ce-b627-7cad8e99ef8d` |
| `node web/scripts/verify-audience-seek.js` | 35 PASS，0 | `rail-seek-f7156ce1-8496-4eeb-ae76-3133609f519e` |
| `node web/scripts/verify-wendui-counsel.js` | 17 PASS，0 | `rail-counsel-05921d2d-16bb-407c-a49b-4156de84168f` |
| `node web/scripts/smoke-foreign-ruler-court-gate.js` | 13 PASS，0；旧 VM 缺 localStorage 警告保留 | `rail-foreign-gate-e642fbd5-9ffb-42ac-aa15-7b763cdb1c90` |
| `node scripts/verify-electron-bridge.js --rail-badges` | 15 PASS，0 | `rail-electron-final-d4fe7178-5c84-4034-aa93-b88ab49bb8a8` |
| `node scripts/verify-electron-bridge.js` | 29 PASS，0（12+11+6，包含重复基础检查） | `rail-desktop-final-27ba46db-0928-497d-9953-7263669b6a44` |
| `node scripts/verify-electron-bridge.js --character-actions` | 15 PASS，0 | `rail-character-final-f59cfae6-9aad-4907-b080-2351973a1629` |
| `node web/scripts/lint-arch-all.js` | 13 守卫 PASS，0 | `rail-arch-final-8a1dfaf7-8c25-4a3c-8f5f-5a1936fc3ff1` |
| `node scripts/verify-release-contract.js` | 166 PASS，0 | `rail-release-final-b37fa8cd-e988-41f7-af55-95b417d67d9f` |
| `node web/scripts/verify-official-scenario-parity.js` | 27 PASS，0 | `rail-parity-final-ad358e1b-93e6-421e-a4e6-8f43ab5ea324` |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS，0 | `rail-builder-final-987fc5a8-4d02-423c-bcbb-1a5781c55e7f` |
| `node scripts/sync-hot-baseline.js --check --version 1.3.4.11` | 686 在场条目一致，410 未跟踪资产缺席按原契约容忍；0 | `rail-hot-check-final-6559a7e7-3f81-450c-8437-7a0f0698b0c8` |
| `node web/scripts/ci-smokes.js`（首轮） | 920 PASS / 2 FAIL / 0 SKIP / 2 WAIVED，924 执行；1 | `rail-full-final-bbde141f-b82b-4803-a148-c3f6c59658f5` |
| `node web/scripts/ci-smokes.js`（最终复跑） | 921 PASS / 1 FAIL / 0 SKIP / 2 WAIVED，924 执行；1 | `rail-full-repeat-6fcced1e-ac18-4337-942c-197f446372d7` |
| `node web/scripts/smoke-full-turn-flow.js`（独立复跑） | PASS，0 | `rail-fullturn-isolated-7876b10e-48de-4fe5-96ae-2f23b17096c0` |
| `node web/scripts/smoke-workshop-lock-recovery.js`（独立复跑） | 12 PASS 后并发准入超时，1 | `rail-lock-isolated-c98c66cd-167f-4d14-aa8c-326f4b1a4651` |

旧基线回归的 FAIL 同时包括旧错位数字和新接口/导航行为缺席，不等于 19 个独立缺陷。相同脚本读取实际 Git blob，不替换生产实现。原 `smoke-rightrail-datasource` 只更新被提取的同一清洗谓词名称；不降低删除、主键及阵营断言。

Electron 33.4.11 / Chromium 130 / 内嵌 Node 20.18.3，Windows，窗口 1280×800，临时 userData，合成世界，阻断外网，无玩家密钥。15 条包含 5 条通用桥接安全检查和 10 条本轮操作断言，不是 15 局游戏。真实 DOM 按钮 click + 命中测试验证 3→2→1→0、打开名单不消退、同人去重、下一回合及同回合换局。不是原生鼠标 Computer Use、真实 AI 网络或安装包验收。

结构化 Electron 报告与截图：`web/dev-tools/electron-bridge/894f3107-51e1-4810-999f-d30dae357ad8/`。截图中的空地图/缺图来自隔离样本与本工作树未跟踪资产缺席，不代表已验证完整游戏美术。

探索失败如实保留：首次命中测试被仍显示的首页挡住；补齐正式页面显示状态。其后合成 GM 漏 `evtLog`，原拒见 addEB 抛错；补齐样本数组，未改写/绕过 addEB。原 addEB 的正式刷新会关抽屉，后续操作改为再次点击真实红泡进入，不点击隐藏 DOM。相关失败见 `rail-electron-b8ce4d27-*`、`rail-electron-1fe7c58a-*`、`rail-electron-deny-trace-*`、`rail-electron-error-trace-*`、`rail-electron-dc04a246-*`；最终额外断言无未捕获 renderer 异常。

## 派生物与交付

执行 `build-startup-phase-manifest.js`（409 eager / 8 deferred）、`sync-official-scenarios.js`（2 来源 / 9 派生物）；数据正文未改。三个分片家族缓存戳同步。非发布同步命令：

```
node scripts/sync-hot-baseline.js --write --version 1.3.4.11 --asset-root C:/Users/37814/Desktop/tianming --temp-root E:/tianming-relief-temp
```

官方生成器只更新四个生产文件 hash/size 和生成时间，仍为 1096 条，无版本变化，无安装包、热更包或部署。`tm-wendui.js` 原混合行尾保留，只让新增行随邻行；bridge 原 CRLF 保留。

首轮全量的完整回合在 `doActualStart` 的既有 10 秒 VM 限制超时，独立复跑通过；工坊锁在 `stress admission deadline exceeded` 失败，独立复跑仍失败，本轮未定其根因。锁模块、工坊事务模块和锁专项测试均与本轮基线逐字节相同。没有修改锁协议、测试截止时间或豁免规则，也没有把失败改报为通过。

新增 Node 测试随后缓存同一生产函数的提取结果，避免每个案例反复进行 Acorn 解析；24 条断言及实际被测函数不变，前后均重新运行。Electron 的生产代码、测试代码与缓存戳在其最终验证后未变；仅新增这项 Node 测试的解析缓存、生成清单及交付说明。

最终全量复跑仍有同一工坊锁准入超时，完整回合恢复通过。正式报告 `web/dev-tools/arch-guard/ci-W2dzJM/smoke-report.json`，运行 ID `453aaf16-1e66-4cef-b5e0-98ec4f3b8f4b`；全量门禁**未通过**，不以专项成功替代。两个 WAIVED 仍是 `smoke-audio-bgm.js` 五首缺席音频和 `smoke-mapeditor-ui.js` 两项缺席字体，共七条具体资产检查，未扩大豁免。

最终 `git diff --check` 退出 0；生产四文件与 Electron 最终被测哈希逐一一致。源码、版本、官方剧本、锁模块边界核对完毕；交付为本地可审查提交，尚未取得全量门禁通过，不自动推送、合并或发布。
