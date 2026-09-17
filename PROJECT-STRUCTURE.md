# 天命 · 项目结构详情 / 待办 / 疑难点

> 基准日期：2026-05-28（根目录整理后）
> 原则：完整性最高 · 移动不删除 · 关键运行文件原地保留 · `web/` 本期未动
> 归档全表 + 还原命令见 `_archive/PATH-MAP.md`

---

## 一、当前根目录（整理后 = 新基准）

只剩运行时与配置，共 16 项：

```
tianming/
├─ main.js / main-impl.js          Electron 主进程入口（main-impl 是真逻辑 ~91KB）
├─ preload-impl.js                沙箱单文件预加载桥（渲染进程 ↔ 主进程 IPC）
├─ package.json / package-lock.json  构建配置 + 依赖锁（无 src 构建：_no_build）
├─ .npmrc
├─ node_modules/                   依赖（electron / electron-builder / adm-zip / electron-updater）
├─ web/                            ⭐ 应用本体（本期未动，见待办①）
├─ scenarios/                      剧本目录（运行时读 APP_ROOT/scenarios）
├─ release-hot/                    🔥 热更发布工作目录（已瘦身，见下）
├─ 启动天命.bat / dev-start.bat    启动脚本（正式 / dev 热重载）
├─ .vscode/ / .playwright-cli/     编辑器 · 测试工具配置
└─ _archive/                       📦 归档区（四桶，见二）
```

`release-hot/` 瘦身后保留：推送脚本 `push-*.py` + `manifests/`（13 个版本清单）+ `hot-latest.json` + 当前在服包 `tianming-hot-1.2.8.1.zip`。发增量热更必须用这套，勿动。

---

## 二、归档结构（`_archive/` 平铺四桶）

| 桶 | 含义 | 主要内容 |
|---|---|---|
| `deprecated/` | 旧·已废弃 | `release/`（1.1.x 安装包）、`release-hot-packages/`（18 个旧热更包 ≈7.6G）、`output/`（playwright 产物）、`__pycache__/`、2 个空目录、`.tmp-doc-recovery/` |
| `reference/` | 旧·可参考 | `map-pipeline/`（17 个建图脚本 + `history map/`）、`backups/`、`_bak/`、`_codex_tmp/`、`codex-claudecode-dialogue/`、`phase8-moodboards/`、`saves/`、`turn-data/`、`old-plans/`（5 旧计划）、`docs/`（6 旧计划）、`restore-tinyi-manual.js` |
| `current/` | 现在·在用 | `findings.md` / `progress.md` / `task_plan.md`（根目录副本已于 2026-07-10 清理下架·历史在 git）、`docs/`（audit-report + design/）｜⚠️ 见疑难点⑤ |
| `future/` | 未来·后续开发 | `godot/`（Godot 迁移工程）、`tools/`（godot-mcp + monitor）、`scripts/`（42 smoke 测试） |

> 校验：关键运行文件 12/12 在位 · 四入口语法校验 PASS · 删除数 0。

---

## 三、运行时架构速览（整理基准的事实依据）

1. **加载方式**：纯原生 JS，零编译零模块（全仓 `import`/`export` 静态声明 = 0 处，2026-06-13 复测）。`web/index.html` 用 **310 个顺序 `<script>`**（2026-06-13 实测；上版 261）串起 **412 个平铺 .js**（含子目录约 660 个），全部挂 `window.*` 全局。
2. **剧本**：运行时从 `APP_ROOT/scenarios` 读「bundled」剧本；打包只随包 2 个官方剧本（`天启七年·九月（官方）`、`绍宋·建炎元年八月（官方）`），白名单见 `package.json` build.files。
3. **存档/用户数据**：`saves`、用户剧本、`turn-data` 实际落在 Electron 的 userData（AppData），**不是仓库根目录**——所以根目录那两份是测试遗留，已归 `reference/`。
4. **热更**：`release-hot/` 的推送脚本经 SSH 把 zip 传到发布服务器、服务端做增量解包；`hot-latest.json` + `manifests/` 记录已发布状态；客户端还会从激活的热更包里取 bundled-scenarios（剧本改动也能热更）。

---

## 四、后续待办 backlog

按优先级：

1. **[高·已立计划] `web/` 命名 + 结构**：412 个 js 平铺 + 310 顺序脚本 + 全局 `window.*` 串联。绝大多数已合规，真正违例仍是那一小撮（`phase8-formal-*`、`tm-tinyi-v3` 等，**尚未改名**）。统一命名规范 + 切割式重命名计划见 **`docs/NAMING-PLAN.md`**；协作 agent 改动守则见 **`DEV-GUIDE.md`**。深度重构（去冗余 `tm-` / 进子目录，200+ 文件）列为可选后续。
2. **[已定] godot-mcp 先禁用**：`tools/` 移入 `future/` 后该 MCP 程序已不在原路径、连不上。决策——**先禁用**（开关在游戏项目之外的 Claude 用户级配置，需本人操作）；后续要用 Godot 集成时，再把路径指向 `_archive/future/tools/godot-mcp/` 或还原后启用。
3. **[中] GUI 实跑验证**：已做语法 + 结构校验，但 Electron GUI 未实测。双击 `启动天命.bat`，确认进主菜单 / 读官方剧本 / 存读档正常。
4. **[低] scenarios dev/发布分离**：7 个剧本 json（约 10MB）中只 2 个官方随包，其余 5 个为本地 dev 剧本，可单独归置（注：`scenarios/` 总 116MB 主要是素材，非 json）。
5. **[低] release-hot 稳态规则**：固定「留 当前在服 + 最多 1 个前序」，更老的滚进 `deprecated/release-hot-packages/`；每次发版后顺手清。
6. **[低] active 桶定位**：见疑难点⑤，待 owner / 你拍板后调整。

---

## 五、当前疑难点 / 开放问题

1. **磁盘空间未回收**：归档是「移动不删」，8GB+ 旧产物仍在盘上（`_archive/`），只是组织清晰了。真要回收空间需另行决定删哪些——默认不删（完整性优先）。
2. **版本管理边界**：本目录**当前非 git 仓库**，`_archive/PATH-MAP.md` 是唯一 undo 依据。已确认 `_archive/` 不会进安装包（build.files 是白名单）；若将来纳入 git，需用 .gitignore 决定是否跟踪 `_archive/`。
3. **归档脚本相对路径失效**：`reference/map-pipeline/` 里的建图脚本移动后内部相对路径已断——纯留档，重跑需修路径或整组还原。
4. **大文件可拆点**（2026-06-13 实测）：`tm-endturn-ai.js`（357KB）+ `tm-endturn-apply.js`（354KB）是回合结算管道核心、`styles.css`（554KB）、`tm-tinyi-v3.js`（339KB）——后续可评估拆分。按行数看平铺层 ≥5000 行的代码文件 3 个（`tm-tinyi-v3` 6939 / `tm-endturn-apply` 5392 / `tm-chaoyi-changchao` 5100），实时清单跑 `web/scripts/debt-report.js`。
5. **`current/` 桶定位（已定，非待决）**：`findings/progress/task_plan` 按既定决策放在 `current/`（常用文件归「现在」桶）。唯一副作用：它们已不在根目录，planning 工具的 `/clear` 自动恢复会失效——手动管理即可。
6. **`tools/` `scripts/` 归 future 的语义**：它们其实是「现在能用的工具」（smoke 测试、monitor-server），归 `future/` 是因 godot 暂不活跃。若重新启用，需挪回根目录或更新引用路径。
