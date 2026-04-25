# 天命 · 文档索引

> 所有技术文档的一页纸入口。2026-04-24 R79 整合 · R102 路径重组 · 2026-04-25 R150 加 scripts/ 工具链。
> 目录：`ARCHITECTURE.md`/`INDEX.md` 在根；其余 38 份文档归入 `docs/{design,dev,maps,external,misc}/`；零依赖工具链在 `scripts/`。

---

## 🚀 按需求快速定位

### 「我是新维护者，从哪开始？」
1. 读 [ARCHITECTURE.md](ARCHITECTURE.md) § 1-3（心智模型+编辑器关系+加载顺序）
2. 打开游戏按 **Ctrl+Shift+/** 看速查卡
3. 控制台跑 `TM.test.run()` 确认基础设施正常
4. 浏览 [DEBUG_CHEATSHEET.md](docs/dev/DEBUG_CHEATSHEET.md)「15 分钟上手路径」

### 「想修某个 bug」
1. 按 **Ctrl+Shift+E** 看错误面板
2. [ARCHITECTURE.md](ARCHITECTURE.md) § 6 看 endTurn 管道找相关阶段
3. 读目标文件顶部导航（见下方「文件顶部导航」）
4. 用 `DA.*` 或 `TM.*` 工具查状态

### 「想合并某个 LAYERED 补丁」
1. 读 [PATCH_CLASSIFICATION.md](docs/dev/PATCH_CLASSIFICATION.md) 查目标文件的类型和合并成本
2. 游戏里 `TM.checklist.preMerge('合并名')` 锁基准
3. 改代码
4. `TM.checklist.postMerge('合并名')` 自动对比
5. 若 overall !== 'ok'，`TM.checklist.downloadReport()` 发给 reviewer

### 「想新增一个游戏机制」
1. 读 [ARCHITECTURE.md](ARCHITECTURE.md) § 8 反模式清单（别再做什么）
2. 读 [MODULE_REGISTRY.md](docs/dev/MODULE_REGISTRY.md) 决定目标文件
3. 新增 AI 字段必先在 `tm-ai-schema.js` 声明
4. 新增 GM 字段必在 [ARCHITECTURE.md](ARCHITECTURE.md) § 4 表补上
5. 写 smoke test 到 `tm-test-harness.js`

### 「怀疑性能有问题」
1. 按 **Ctrl+Shift+P** 打开性能面板
2. `TM.perf.print()` 控制台看 p95 表
3. 设阈值：`TM.perf.setThreshold('xxx.tick', 500)`
4. 锁基线：`TM.perf.lockBaseline()`，改完后 `TM.perf.printCompare()`

---

## 📚 按文档类型

### 架构与设计
| 文档 | 内容 | 字数 |
|------|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 10 章完整架构（心智模型+GM/P 字段表+endTurn 管道+反模式） | ~5000 |
| [MODULE_REGISTRY.md](docs/dev/MODULE_REGISTRY.md) | 92 文件索引+合并优先级+工时估算 | ~3000 |
| [PATCH_CLASSIFICATION.md](docs/dev/PATCH_CLASSIFICATION.md) | 18+ 补丁文件分类（SELF/APPEND/OVERRIDE/LAYERED/MIXED）+ tm-patches 6 领域切分 | ~3000 |

### 调试与诊断
| 文档 | 内容 | 字数 |
|------|------|------|
| [DEBUG_CHEATSHEET.md](docs/dev/DEBUG_CHEATSHEET.md) | 完整控制台速查（DA.*/ TM.*/ 常见问题 6 流程） | ~2500 |
| [GLOBAL_POLLUTION_REPORT.md](docs/dev/GLOBAL_POLLUTION_REPORT.md) | window 全局 1469 量化 + 命名空间建议 | ~1500 |

### 运维与发布
| 文档 | 内容 | 字数 |
|------|------|------|
| [MERGE_PLAYBOOK.md](docs/dev/MERGE_PLAYBOOK.md) | **进入测试环境的合并作业手册** · 5 Scenario + Rollback + 质量门禁 | ~2500 |
| [changelog.json](changelog.json) | 所有版本变更记录（JSON 格式，邸报读取） | 大 |

---

## 📂 按文件顶部导航

**核心 3 大文件已内嵌导航**（打开文件直接看顶部注释）：

| 文件 | 行数 | 导航轮次 |
|------|------|---------|
| `tm-endturn-ai-infer.js` | 10,565 | **R147**（5 段：sysP/Sub-call/sc1主推/写回/sc15-27） |
| `tm-game-engine.js` | 9,043 | R53 |
| `tm-chaoyi-keju.js` | 9,454 | R54 |
| `tm-index-world.js` | 8,820 | R78 |
| `tm-audio-theme.js` | 3,430 | R78 |
| `tm-dynamic-systems.js` | 2,976 | R78 |
| `tm-patches.js` | 2,186 | R58（含 6 段切分清单） |
| `tm-ai-change-applier.js` | 2,091 | **R150**（8 段：路径/白名单/实体/绑定/钩子/机构/applyAITurnChanges/v2 通道） |
| `tm-endturn.js` | 已拆 | R110 拆为 prep+core+ai-infer 三 |

---

## 🔧 控制台快捷键汇总

```
Ctrl+Shift+D    统一诊断仪表板（一屏看全）
Ctrl+Shift+E    错误日志面板
Ctrl+Shift+P    性能采样面板
Ctrl+Shift+/    速查卡浮层
?test=1         启动时自动跑 smoke test（URL 加）
```

---

## ⚙️ 测试与重构工具链（scripts/ · R121 起 · 零依赖）

**一键全检**：
```bash
node scripts/verify-all.js   # syntax→ref→orphans→smoke 4 项 18s · smoke 用 baseline 不退步判定
```

**4 道防线**：

| 工具 | 引入 | 作用 |
|------|------|------|
| `syntax-check.js` | R121 | node --check 全扫 180 个 .js |
| `headless-smoke.js` | R121 | vm 加载 + TM.test 套件 (baseline ≥207 pass / ≤4 fail) |
| `ref-check.js` | R136 | 跨 HTML 引用断链 |
| `find-orphans.js` | R139 | 真孤岛识别 (R139 删 2 个共 801 行死代码) |

**审计 + 改写**：

| 工具 | 引入 | 作用 |
|------|------|------|
| `lint-empty-catch.js` | R144 | R86 豁免规则审计·确认全部合规 |
| `lint-catch-console.js` | R145 | catch 内 console 分型 (类1/2/3) |
| `migrate-catch-console.js` | R145 | try-catch console → TM.errors (301 处) |
| `migrate-promise-catch.js` | R148 | Promise.catch console → TM.errors (22 处) |
| `bump-cache-bust.js` | R142 | HTML ?v= 版本统一 |
| `add-ts-check.js` | R146 | 批量加 @ts-check 头 (24% → 100%) |

详见 `scripts/README.md`。

---

## 🧰 基础设施工具清单（按功能）

### 数据访问
- `DA.*` — 统一数据访问门面（chars/guoku/officeTree 等 12 领域）
- `TM.Economy/MapSystem/Lizhi/...` — 业务函数门面（7 空间 110 函数）

### 校验
- `TM_AI_SCHEMA` — AI 字段契约单一真源
- `TM.validateAIOutput` — AI 返回校验（支持 turn-full / dialogue 两模式）
- `TM.invariants.check()` — GameState 不变量（10 groups）
- `TM.guard.report()` — 全局污染守卫

### 观测
- `TM.errors` — 全局错误捕获
- `TM.perf` — 性能采样+阈值+baseline 对比
- `TM.state` — GM 状态快照
- `TM.diff(a, b)` — 对象差异
- `TM.hooks` — GameHooks 查询追踪
- `TM.test` — 196+ smoke test

### 工作流
- `TM.checklist.preMerge/postMerge` — 合并审计一键操作
- `TM.diag.open()` — 统一仪表板
- `TM.cheatsheet.show()` — 速查卡

### 存档
- `SaveManager.saveToSlot/loadFromSlot`
- `SAVE_VERSION` / `SaveMigrations.run`

---

## 🗺️ 重构历程（13 轮 + 持续）

| 轮次 | 主题 | 关键产出 |
|------|------|---------|
| 1-5 | 基础设施打地基 | DA / Schema / Validator / Test / ErrorCollector |
| 6-7 | 继续 + 文档化 | 95+ smoke test · ARCHITECTURE · MODULE_REGISTRY |
| 8-9 | 监控与护栏 | perf 采样 · invariants 校验 · endTurn 导航 |
| 10-11 | 主动防御 | 污染报告 · perf 阈值 · 6 命名空间 · 真拆 Modal/Military/World/Editor |
| 12 | 状态可观测性 | state 快照 · diff 对比 · hooks 追踪 |
| 13 | 工作流整合 | Ctrl+Shift+D 仪表板 · checklist · 速查卡浮层 |
| 14 | 文档整合 | INDEX.md（本文件） · onboarding · scenarios schema · version 查询 |
| R109-R141 | 大拆分 | 28 次文件拆分·游戏运行时无 5000+ 非单函数文件·建立 syntax/ref/orphans/smoke 4 道防线 |
| R143-R148 | 深度清理 | escHtml 单一化·394 空 catch+ 301 catch console+ 22 Promise.catch 迁 TM.errors·115 文件加 @ts-check·巨函数 5 段 banner |
| R149-R150 | 工具链/文档完整化 | scripts/verify-all 一键 + scripts/README 全量 + INDEX.md 补 scripts/ 工具链 + tm-ai-change-applier 顶部 8 段导航 |

---

## 📮 找到相关文档后

**如果该文档没答案** — 按此顺序问：
1. 按 Ctrl+Shift+E 看错误
2. `TM.invariants.check()` 看不变量
3. grep 源码（`tm-*.js` 关键字搜索）
4. 读文件顶部导航注释

**还是没答案？** 可能是**未记录的架构债务**——补到 MODULE_REGISTRY.md 或相关文件顶部。
