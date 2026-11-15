# 天命 · 协作手册（双人短命分支 + PR）

> 新人（和新 Claude 会话）入口。硬规矩在根目录 `CLAUDE.md`（Claude Code 自动加载）；
> 架构守卫详解在 `web/docs/arch-guards.md`；拆分/重构范式在 `web/docs/split-paradigms.md`。

## 一、快速上手

```bash
git clone <本仓>
cd tianming
npm ci --ignore-scripts                  # 安装锁定依赖；AST 架构守卫需要 devDependency acorn
git config core.hooksPath hooks        # 安装 pre-push 守卫（架构 lint + 派生文件新鲜度）
git config merge.tm-derived.driver true  # 派生文件变基时不再报冲突（见第五节）
```

**资产补全（必做）**：`web/assets/` 的大件（立绘 647MB/字体/音频等）不入 git，走 release 全量包：

```bash
gh release download ship-1.3.4.8 --repo <本仓> --pattern '1.3.4.8.zip'
# 解出其中 web/assets/** 覆盖到本地 clone 的 web/assets/
```

运行：根目录 `npm start`（Electron 壳）。改 `web/` 后需重启方可见（详见 CLAUDE.md）。

## 二、新协作者加入（仓主一次性操作）

1. 仓主在 GitHub **Settings → Collaborators and teams → Add people** 按对方自己的 GitHub 用户名发邀请；日常开发只给 `Write`，不共享仓主账号、PAT、SSH 私钥、AI key 或服务器凭据，也不授予 `Admin`。
2. 对方接受邀请后，用自己的凭据 clone，设置自己的 `user.name/user.email`，安装本仓 hooks，并从受保护 `main` 建第一条短命分支；禁止用仓主机器上残留的登录态代推。
3. 第一条 PR 走完整 `guards`、`mobile-release-contracts` 和对方 approval。两项 check 至少在远端成功一次后，仓主再执行下文的 branch-protection `--apply`，并在 Settings 里确认直接 push/force-push 已被拦住。
4. `ship-*` Release、Pages production environment、服务器与签名密钥仍只由仓主持有；协作者可以提交发版准备 PR，但不能通过共享密钥绕过 owner 审批。

邀请是 GitHub 外部状态，仓库无法凭空代填用户名。未完成邀请/接受/首 PR 前，不把“协作者已加入”写成完成。

## 三、同步节奏（核心约定）

`main` 是受保护的集成分支。两人都使用**短命分支、小刀快合**（一把刀 = 数小时粒度）：

1. **开工前**：更新主干后新建 `codex/<主题>` 或 `<名字>/<主题>` 分支；一个分支只做一件事。
2. **push 前**：pre-push hook 自动跑 `lint-arch-all.js` 各项守卫，并检查派生文件与已提交的内容对不对得上；自己再跑定向 smoke
   `node scripts/run-smokes.js --changed`（在 `web/` 下；按改了哪些文件挑出相关的几支，`--changed --list` 先看挑中哪些、各因为什么），
   或按主题 `node scripts/run-smokes.js --grep <主题>`。全量冒烟由 CI 兜底。
3. **所有改动走 PR**：等待 `guards` 与 `mobile-release-contracts` 通过；至少 1 名对方批准后 squash/rebase merge。
4. PR 合并后删除分支。主干红灯时先修复，不继续叠新功能；禁止直接 push、force-push 或绕过检查。

## 四、地界与认领

- 按子系统划地界，同一时刻两人（和各自的 Claude agent）在不同象限动刀。
- 开工先在 GitHub Issues 占坑并在 PR 描述标明领地，避免两边 Claude 同时扑向同一片。

## 五、冲突磁铁文件（必读）

| 文件 | 规矩 |
|---|---|
| `web/.hot-update-manifest.json`、`web/tm-start-runtime-manifest.json`、`web/startup-script-phases.json`，以及官方剧本的各份产物 | **派生文件：不手工改，也不手工合并。** 改完代码跑 `node scripts/regen-derived.js`（即 `npm run regen`），它按依赖顺序把该更新的都更新，并列出要 `git add` 的文件；只提交一部分改动时加 `--staged`，哈希就按暂存区的内容算。变基相撞不用解：装了合并驱动（见第一节）就不会停下，没装就任取一侧；变基完再跑一次即可，结果只取决于最终的文件内容。pre-push 按已提交的内容检查，漏了会拦下并给出修法。**不要用 `sync-hot-baseline.js --write`**：缺少未跟踪资产（立绘、模型）的检出里，它会把这些资产的条目从基线里抹掉；那是发版 prepare 在资产齐全的主检出里才用的。 |
| `web/scripts/arch-baselines/*.json` | **永不手工合并**。rebase 冲突时取任意一侧，然后重跑对应 lint 的 `--update` 重新生成（棘轮只许收紧）。 |
| `web/index.html` 脚本区 | 只做行级小改；rebase 勤。拆分家族成员改动须整族 bump `?v=` 戳（守卫⑦会拦）。 |
| `web/scripts/lint-split-contracts.js` | 只追加条目，按拆分编号序插入。 |
| `scenarios/*（官方）.json` | 官方剧本唯一数据真源。修改后只运行 `npm run sync:official-scenarios`，禁止反向改 bundle/内置 JS。真源里地图只存 `map` 一份、不写 `mapData`（运行时那份由构建与主进程补回）；脚本要 `map`、`mapData` 俱全的完整剧本，用 `web/scripts/official-scenario-source.js` 的 `readOfficialScenario`，写回用 `writeOfficialScenario`。 |
| `scenarios/` 其余文件 | 这个目录只放官方真源，和被脚本引用的草案（如绍宋 182 区草案）。自用、试玩用的剧本放游戏的用户剧本目录，不进主干：游戏只列三部官方剧本与用户目录，放在这里它也读不到。 |
| `docs/<任务>/` 下的验收证据 | 结论与报告进库；原始运行记录（日志、逐回合时间线、截图、守卫与冒烟的整份输出）留在本机或 CI 产物里，不进主干。`docs/npc-stable-candidate-20261021/README.md` 是先例：66MB 原始记录撤出，只留文字报告。 |

## 六、刀纪律精要（全文见 CLAUDE.md）

- 一刀一事，大改拆 3–5 slice；说「完成」前先实跑命令验证。
- 重构**禁止顺手把中文 display name 翻英**；改前后 CJK 计数比对。
- 行为等价重构的自证标准：**trim 行多重集差集**（原行零丢失，差集只含申报过的脚手架）。
- GM/P 直写走账（mutator/ledger 或 `// arch-ok` 裁定），`lint-gm-writes` 按源封顶。
- 新 flag 必配设置开关；机制内容跨朝代通用，单朝特例归剧本数据。

## 七、提交风格

commit message 用「战报体」：首行=刀名+量化战果，正文=范式/契约/验证结论。
这不只给人看——**对方的 Claude 靠它读懂你动了什么**。

## 八、发版边界

热更/发版/打包（`scripts/release.js`、双端管线、服务器 autodeploy）**只由仓主触发**。
合进 main ≠ 发版。

`release.js` 是不可合并的两阶段流程：

1. 从最新 `origin/main` 建短命分支，先提交同版本 `changelog.json`，再运行
   `node scripts/release.js --prepare --version <四段版本> --notes "<说明>"`。prepare 只盖戳
   `package.json`、`mobile/release-version.json`、`web/version.json`、`web/index.html` 与
   `web/.hot-update-manifest.json`；canonical 基线明确纳入 git，使用
   `git add package.json mobile/release-version.json web/version.json web/index.html web/.hot-update-manifest.json`
   后提交，并经正常 PR 合入。
2. PR 合入后切回 clean `main`、`git pull --ff-only`，再运行
   `node scripts/release.js --publish --version <同一版本> --notes "<同一说明>"`。publish 会 fetch 并要求
   `HEAD === origin/main`，只消费已盖戳文件；构建前和上传前各验一次，期间绝不修改 tracked 版本或基线。
   外写前还会读取 `gh` 当前账号，只有仓库 owner 可创建/覆盖 Release 与 autodeploy 指针。

`mobile/android/` 是 ignored 的 Capacitor 派生工程，绝不能充当版本真源；四段 Android 版本与
`versionCode` 以 tracked `mobile/release-version.json` 为准，publish 在本机有 Gradle 时会从 canonical
同步派生文件。

本地只想验证双端制品时使用 `--publish --no-upload`；它允许非 main/dirty 工作树，但 GitHub Release 与
autodeploy 指针两条外写路径都会硬关闭。`--offline` 也只允许在该本地模式中使用。

## 九、CI 说明

`.github/workflows/ci.yml`：`guards` 跑官方剧本 parity、发布契约、8 项架构守卫与全量 smoke；`mobile-release-contracts` 在 Windows PowerShell 5.1 真跑 mobile dry-run/stage/hash verify。
fresh checkout 无大资产，故 `arch-baselines/ci-smoke-allowlist.json` 白名单豁免三个
缺资产 smoke（audio-bgm / mapeditor-ui / scenario-editor-reset-preview）；
新增豁免须双方点头。

仓主需在 GitHub Settings → Branches 为 `main` 开启：Require a pull request、1 approval、dismiss stale approvals、require conversation resolution、require branches up to date，并把 `guards`、`mobile-release-contracts` 设为 required checks。仓库提供的建议配置可先预览：

```bash
node scripts/configure-branch-protection.js
# 仓主确认后才执行：node scripts/configure-branch-protection.js --apply
```

## 十、Pages 与 main 边界

- `main` 是开发集成态，只产出短期 Actions preview artifact，不自动覆盖公开站点。
- 正式 Pages 只由仓主创建的 `ship-*` GitHub Release 发布事件，或仓主本人手动选择明确 ref 触发 `pages-production`；direct Write 协作者触发的 production job 会被拒绝。
- release 与手动 ref 共用完整门禁：官方派生同步及 diff、parity、发布契约、hot-builder fixture、8/8 架构闸、全量 smoke；release tag 还必须证明其提交是 `origin/main` 的祖先。
- GitHub Pages 的 Source 必须设为 **GitHub Actions**。公开站点部署 `web/` 的受检 staging，不再发布仓库根 README。
