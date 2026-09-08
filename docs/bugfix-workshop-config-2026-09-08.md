# 工坊设定与开局运行态核验

## 范围

本轮基线 `dc7e187f988c6611aa9af833afc890a6df7f9d86`，独立本地分支 `codex/fix-workshop-runtime-config`。它承接此前三个未推送的营造/诏书修复提交；本轮不把它们作为新增修改。远端 main 核验为 `6e02f7f34fcd0ea93600a69a3cfe1d473a840074`。

使用用户提供的 `tianming-scenario-editor-reset-export3.json`，2605824 字节，SHA256：`964a16eb2a86f34b1ad045e91f9a70ff8bac2ffb2cd4f4c1639fe7a7fd057bf9`。原始文件只读，不提交到仓库，不改玩家存档，不调用真实 AI 服务。

## 逐项结论

| 反馈 | 当前代码 + 原剧本的真实结果 |
|---|---|
| 国库 300 万、内帑 80 万未生效 | 现有兼容读取已生效，初始化的 balance/ledger 分别为 3000000/800000；但发现两引擎返回前没有同步 `money`，可继续暴露旧值或 undefined。本轮补齐此遗漏。 |
| 民心 85 不生效、显示 58 | 当前新局实际为 **85**，本轮未重复改民心。已有 `_tmStartPinMinxinFromVars` 把显式变量落到玩家辖区叶子，再由正式系统聚合。不能承诺旧存档会因此重置为 85。 |
| 六部堂官都成为编制外、次级部门消失 | 当前新局有 **17 个正式部门、64 个正式职位**，六部均有真实职位；实际核验吏部尚书按作者所设人物入座。`children/level/holder` 的旧形状已被正式归一。仍存在两个正常兜底部门共 10 个未完整绑定的额外职衔，未伪造职位去消除它们。 |
| 官制原样父子布局 | 现有兼容层会把次级部门拍平成可见部门，本轮没有改成原样复刻作者整棵树的布局。部门与职位可用不等于完整嵌套布局已经实现。 |
| 月入 40 万、月支 12 万不一致 | `fiscalConfig.monthlyIncome/monthlyExpense` 是初始估计，不是固定收支指令。正式收入仍读取辖区税制/经济明细，支出读取官位/兵额/内廷配置。描述文本及 `economyConfig.expenseItems` 不会自动变成正式经费参数。本轮未改游戏机制去强制凑数。 |
| 截图 45 万来源 | 同一导出在当前代码新局没有复现 45 万；月度预览为 **206961 = 军饷185000 + 俸禄1961 + 宫廷20000**。文件 8 支军队共 370000 人，按现有默认每兵每月0.5计算军饷。没有旧截图对应运行存档/构建，不能把当前值冒充对45万的精确复原。 |

`e72ed974d` 已包含财政别名、innerTreasury、官制 children、民心 pin 的历史修复，现已在 main 祖先中。本轮先以行为验证其现状，没有机械复制这些旧补丁。

## 原文件中需要作者统一的口径

1. `gameSettings.daysPerTurn` 和 `time.daysPerTurn` 都是 **90**，同时 `turnUnit` 写的是 `month`。引擎按明确天数运行；不能把整回合钱粮简单当一个月。
2. `adminHierarchy.楚.divisions[0]` 把“大楚”全国 8600 万人口、5.5 亿亩等总量写成 `level:province` 的叶子，和其余 62 个地方并列。运行时会一起汇总，存在全国总计与地方明细重复统计的问题；不能只改财政摘要来校准。
3. 若设计目标是实际月收40万/月支12万，应统一上述辖区与正式 `fiscalConfig` 税目、`fixedExpense` 俸饷/内廷配置，而不是继续只改估计字段或说明文字。本轮没有擅自删除地区、缩兵、调税、把回合改为30天或覆盖原文件。

## 本次代码修改

- `web/tm-guoku-engine.js` / `initFromDynasty`：完成所有初值和别名覆盖后，同步 `GM.guoku.money` 与权威账本库存。
- `web/tm-neitang-engine.js` / `initFromDynasty`：同样同步内帑 `money`。
- 两个既有专项新增初值返回即一致、旧标量清除、显式0优先和1.25小数保留检查。没有舍入库存或改账本计算。
- `web/index.html` 更新两引擎缓存查询戳；正式生成器同步 index/两引擎共3项 hash，清单仍1094项，版本仍1.3.4.11。
- `scripts/verify-workshop-config-fixture.cjs` 是此反馈专用的真实 Electron 测试入口，不是通用剧本校验器。它要求传入原导出文件，不携带玩家的完整剧本内容。

## 实际执行证据

[evidence.json](bugfix-workshop-config/evidence.json) 包含命令、退出码、耗时、源码哈希、脱敏 stdout/stderr、初次失败和最终成功记录。完整原场景运行报告留在本地 `web/dev-tools/workshop-config-2026-09-08/`，未将整份人物/剧本/存档公开打包。

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `node web/scripts/smoke-guoku-legacy-fiscal-compat.js` 修复前 | 1 | 新增 money 初值一致性断言失败 |
| `node web/scripts/smoke-neitang-inner-treasury-compat.js` 修复前 | 1 | 新增 money 初值一致性断言失败 |
| 上述国库 / 内帑专项修复后 | 0 / 0 | 17 / 10 断言通过 |
| `node web/scripts/smoke-office-tree-shape-normalize.js` | 0 | 36 断言通过，包含民心和阵营隔离 |
| `node web/scripts/smoke-cascade-static-remit.js` | 0 | 13 断言通过 |
| 原文件真实 Electron 初始探针 | 1 | 9 PASS / 2 FAIL，失败仅为本轮补修的初始化标量 |
| `node_modules/electron/dist/electron.exe scripts/verify-workshop-config-fixture.cjs <原导出JSON>` | 0 | 11 PASS；4.1秒；原文件与内存剧本模板保持不变 |
| `node scripts/verify-electron-bridge.js` | 0 | 29 PASS；36.1秒；真实 main/preload/IPC/保存恢复 |
| `node web/scripts/ci-smokes.js` 首次 | 1 | 915 PASS / 1 FAIL / 0 SKIP / 2 WAIVED；锁压力测试超时 |
| `node web/scripts/smoke-workshop-lock-recovery.js` 独立复跑 | 0 | 13 PASS；13.7秒 |
| `node web/scripts/ci-smokes.js` 最终 | 0 | **916 PASS / 0 FAIL / 0 SKIP / 2 WAIVED，918全部执行**；99.2秒 |
| `node web/scripts/lint-arch-all.js` | 0 | 13 守卫通过 |
| `node scripts/verify-release-contract.js` | 0 | 166 断言通过 |
| `node web/scripts/verify-official-scenario-parity.js` | 0 | 27 断言通过 |
| `node web/scripts/verify-hot-builder-gates.js` | 0 | 27 合成构建夹具检查通过，未制作发布包 |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 | 0 vulnerabilities |

Electron 33.4.11（Windows、未打包）使用隔离 userData，网络阻断；真实导出直接进入正式 `doActualStart`，没有以成功桩代替财政/民心/官制引擎。不声称物理鼠标或安装包/玩家旧存档已验收。开局既有结算后国库4484299、内帑740000，月入2045182、月支206961；这些不等于“未读到初始300万/80万”。

首次全量的锁模块/压力测试源码与基线完全一致；没有调整断言、期限或白名单。最终报告绑定运行 `dfe68326-a257-45f8-b108-05e4f918d920`；两项 WAIVED 仍仅7个既有缺席资产检查。头部记录是起点+脏树，最终7个生产/测试文件哈希与被测源码一致；之后只补说明与证据。

早期 headless 探针缺 Audio/IndexedDB、一次文件路径错误和临时统计命令错误均不作为真实 Electron 失败或成功依据。正式前后 Electron 结果独立记录。原目录既有改动保留，原JSON只读。本轮未推送、未合并、未发版。
