# AGENTS.md · 天命 · 给自动化助手（Codex 等）的发版红线手册

> 本文件是 **Codex/自动化助手** 在本仓工作、尤其是**打包发版**时的第一读物。
> 通用开发纪律见 [`CLAUDE.md`](CLAUDE.md) 与 [`CONTRIBUTING.md`](CONTRIBUTING.md)；本文件只钉**发版/打包**这条历史上反复灾难性出错的路。
> **看不懂某条规则的“为什么”，就不要动它**——每条都对应过一次真实的线上事故。

---

## 〇、最高铁律

1. **发版只由仓主显式触发。** 你不主动打包、不主动 push、不主动 ship。合进 main ≠ 发版。
2. **不要手搓版本号、不要手搓热更基线、不要手搓 zip。** 全走 `scripts/release.js`（下方一、二节）。手搓 = 漏字段 = “新安装包打开还是旧版”一类灾难。
3. **改完先跑门禁再说完成**（第五节）。断言“打好了/修好了”之前，本机把该跑的命令跑绿，别凭印象。
4. **字节冻结**：`.gitattributes` 是 `* -text`。禁止 `sed` 整文件改写、禁止顺手转行尾（CRLF↔LF）、禁止把中文 display name 翻成英文。含中文的 `.ps1` **必须存 UTF-8 BOM**（PS 5.1 否则乱码 parser error）。

---

## 一、正确发版流程（两阶段·别自创第三种）

天命发版**只有**这一条正道，`scripts/release.js` 全程带闸自检：

```bash
# 阶段① prepare：在短命分支盖版本戳 + 刷热更基线（一把盖全部字段·原子·带 .bak + 写后回读）
node scripts/release.js --prepare --version 1.3.4.9 --notes "本版说明"
#   → 改动 package.json / mobile/release-version.json / web/version.json /
#     web/index.html(meta tm-version + footer #tm-foot-ver) / web/.hot-update-manifest.json
#   → 提交这些文件，经 PR 合入 main（先写好 changelog 邸报条目·顶条 module 须以版本号开头）

# 阶段② publish：只在 clean 且 HEAD === origin/main 的 main 上跑
node scripts/release.js --publish --version 1.3.4.9 --with-installer --notes "本版说明"
#   → 桌面热更 zip + 安卓 capgo bundle + 预检对账 + gh release(ship-<版本>) + 自动部署指针
#   → 服务器 autodeploy(≤5min) 或按打印的 OWNER-RUNBOOK 手动 curl 落位
```

- **全量安装包（exe/apk）另打**，不在 release.js 里：exe = `npm run build:win`（或 `build:win:nomodel`）→ `E:\版本\测试版<版本>`；apk = `cd mobile && npm run sync` 后 gradle `assembleDebug` → 拷到同目录。二者是**给没装过的人用的全量包**，与热更是两回事。
- **同版本重打 / prepare 后 publish 撞 GATE-3 单调闸**：release.js **没有** `--allow-same-version`（`flag()` 静默忽略未知参数·只 `build-hot-update-package.js` 认它·别被误导）。真正的摩擦是 prepare 的桌面构建会把本机 `release-hot/hot-latest.json` feed 写成新版·publish 的 GATE-3（比本机 feed）随即拒同版。解法：publish 前把本机 feed 倒回旧版——`git show <含旧版feed的commit>:release-hot/hot-latest.json > release-hot/hot-latest.json`（feed 已 gitignored·取历史 blob）。线上闸③另查真服务器 feed·不受本机 feed 影响。每次 publish 失败重跑前都要重新倒 feed（构建又会写成新版）。

---

## 二、版本号：要么全盖，要么不碰（“新包还是旧版”事故根）

一个版本散落在 **6 处**，少盖任何一处都会让安装包/客户端认成旧版（历史真事故）：

| 位置 | 字段 |
|---|---|
| `package.json` | `version`(三段 semver·映射 `a.b.(c*100+d)`，如 1.3.4.9→**1.3.409**)、`build.buildVersion`(四段)、`build.directories.output`(测试版<版本>)、`build.artifactName` |
| `mobile/release-version.json` | `version`、`versionCode`(严格递增) |
| `web/version.json` | `version` |
| `web/index.html` | `<meta name="tm-version">` **和** `<span id="tm-foot-ver">`（左下角显示） |
| `mobile/android/app/build.gradle` | `versionCode`/`versionName`（ignored 派生物·从 canonical 同步·别当盖戳文件提交） |
| `web/.hot-update-manifest.json` | 热更基线（见第三节） |

**别手改这 6 处**——`release.js --prepare` 一把全盖且带“恰一处匹配”断言。真要手改，改完必须逐一核对全 6 处一致，且基线要重生成（第三节）。

- **版本某段 >9**（如 1.3.4.**10**）：数字拼接 versionCode 会歧义（1.3.10.0 vs 1.31.0.0），`--prepare` 报错要你显式 `--version-code <严格递增整数>`。1.3.4.9=1349 → 1.3.4.10 用 `--version-code 1350`。

---

## 三、热更基线（`web/.hot-update-manifest.json`）：OTA 必须自带游戏美术资源

> **2026-07-20 血泪教训（1.3.4.9→1.3.4.10 生产事故）：本节此前写反成"OTA 只收跟踪代码"，直接导致玩家丢图。已纠正——看不懂就别改回去。**

**热更 OTA（桌面 Electron hot + 安卓 Capgo）是整包 www 替换——包里 = 全部要发的 www，绝不与已装内容合并。所以 OTA 必须自带全部游戏美术资源（未跟踪的 `web/assets/*`：311 立绘 / 音频 / etl-scenes，~715MB）。** 1.3.4.8 及以前 OTA 恒含它们（桌面 ~828MB、capgo ~880MB）。**绝不能把 OTA 收敛成"只发 git 跟踪代码"**——那样 capgo 一更安卓玩家画面就没立绘（1.3.4.9 就是这么炸的：OTA 从 828MB 缩成 22MB → 全丢图）。

- 收集器（`web/tools/build-hot-update-package.js`）**只走 `release-excludes.json` 排真垃圾**（godot / preview 设计稿 / `.bak-*` / `_ingame*.png` 截图 / vendor / dev 脚本），**不加任何 git-tracked 过滤**。capgo `mobile/scripts/build-capgo-bundle.ps1` **不传 `--tracked-only`**。真游戏资产 `web/assets/*` **绝不在排除之列**。
- 基线 `web/.hot-update-manifest.json` = **含资产的全量清单**（`node scripts/sync-hot-baseline.js --write --version <版本>`·前置 `version.json`/`index.html` 已盖戳=GATE-5）。1.3.4.10 = 1088 项（357 assets / 378 png）。
- **CI 契约 ≠ 发版策略**（这是当年犯错的认知根）：CI checkout 只有 git 跟踪文件、磁盘无这些未跟踪资产，故 `sync-hot-baseline.js --check` **容忍"基线有、本 checkout 磁盘缺席的条目"不算 stale**（skip `obsolete canonical path` when `!fs.existsSync`），仍严格校验在场文件 hash/size（stale）与无多余文件（missing）。据此 CI(无 assets)绿、仓主本机(有 assets)全量逐文件校验。**基线就该是仓主全量热更树的真相，不是"只列跟踪码"。**
- **发版体检**：打完 OTA zip 应各 ~800MB+；若骤降到几十 MB 就是资产被漏掉了——`node -e "const A=require('adm-zip');console.log(new A('release-hot/tianming-hot-<版本>.zip').getEntries().filter(e=>/\.png$/i.test(e.entryName)).length)"` 应 ≈378。
- 官方剧本运行时数据经跟踪的 `web/scenarios/*.js`（loader 以 `<script>` 加载）到达 OTA；`web/bundled-scenarios/*（官方）.json` 是 gitignored 元数据/编辑器件·不进 OTA 无妨。
- 在线 Pages 例外：CI 托不动 715MB·`stage-web-release.js` 上 Pages **不传** `--tracked-only`（CI 上自然只有跟踪码·大资产靠 CDN 兜底）。

---

## 四、官方剧本 / 派生物 / 可移植性

- **唯一数据真源** = 仓根 `scenarios/*（官方）.json`。改它后**必须** `node web/scripts/sync-official-scenarios.js`，把派生物（`web/bundled-scenarios/`、`web/preview/scenario-editor-reset-data.js` 等）同步并提交。禁止从内置 JS/bundle 反向导出覆盖 JSON。
- **派生物不许烘绝对路径**：生成器一律落**相对 repo root + 正斜杠**的路径（2026-07 修过 `editor-reset-inventory.js`：`summary.source` 从 `C:\Users\...\scenarios\..` 改相对）。否则 CI 在 Linux 重生成时 `git diff` 报 stale（“Reject stale generated products”真事故）。
- CI 的 `guards / Reject stale generated products` = 跑完 sync 后 `git diff --exit-code`。你提交前**本机也跑一遍 sync 再看 git diff**，有 diff 就是派生物没同步/不可移植。

---

## 五、发版前后必绿的门禁（本机先跑，别指望 CI 兜底）

```bash
node web/scripts/ci-smokes.js               # 全量 smoke（现 774）·0 FAIL
node web/scripts/lint-arch-all.js           # 架构守卫 8/8（棘轮·基线只降不升）
node web/scripts/verify-official-scenario-parity.js   # 官方剧本派生对账
node scripts/verify-release-contract.js     # 跨管线契约 + 热更基线逐文件对齐
node scripts/sync-hot-baseline.js --check --version <版本>   # 基线=纯跟踪树·PASS
```

CI（push main 触发 `guards` + `mobile-release-contracts`；ship-* release 触发 `pages-production`）会复跑这些。**别直接推 main 绕过 review**（`CLAUDE.md` 协作纪律）——除非仓主明确让你直接发版。

---

## 六、本机环境坑（2026-07 已根治·别退回旧写法）

- **junction**：本机 `mobile/` 常是指向 `E:\MovedFromC\...` 的 junction，`$PSScriptRoot\..\..` 会解到错盘。`mobile/scripts/*.ps1` 已改用 marker（`scripts\stage-web-release.js`）从 `$PSScriptRoot`/cwd 逐级上溯找 repo root——**别改回 `$PSScriptRoot\..\..`**。
- **中文 .ps1 必带 UTF-8 BOM**（PS 5.1 否则 `Unexpected token` parser error）。改这些文件用 `[System.IO.File]::WriteAllText($p,$c,(New-Object System.Text.UTF8Encoding($true)))` 保 BOM。
- `release-hot/hot-latest.json` 是**非确定性构建产物**（含 wall-clock `generatedAt`），已 gitignored——别把它重新加进 git，否则 publish 上传前 clean 闸会被它自己的产物卡死。
- 中文 `.bat` 必须 UTF-8 带 BOM + goto 结构（无 BOM 按 OEM936 撕碎多行 if 块）。

---

## 七、双端热更 + 服务器落位（别只发一端）

- 热更是**两条独立管线**：桌面 Electron(`hot/`) + 安卓 Capgo(`capgo/`)。同一份 `web/` 源要**分别发**（`release.js --publish` 一次两端都打）。
- 服务器落位：gh release 建好后，autodeploy poller ≤5min 自动拉，或仓主在服务器按 `OWNER-RUNBOOK-<版本>.txt` 手动 curl。SSH 从开发会话被封→**只走 gh release + 服务器 curl**，别试图 SFTP/SSH 直传。
- 验证：`curl -s https://api.themisfitserspeople.top/tianming/hot/hot-latest.json | head -3`（版本应=新版）。

---

**一句话**：打包发版**全程走 `scripts/release.js`（两阶段 prepare/publish）**，别手搓任何一步；改派生物必 sync 且落相对路径；**OTA 必须自带全部 `web/assets`（~800MB+·绝不收敛成"只发跟踪码"·见第三节血泪教训）**；改完本机跑绿第五节全部门禁再报完成。
