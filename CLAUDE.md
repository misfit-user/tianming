# 天命项目 · 工作纪律

> 精炼硬规矩。详细背景/进度在记忆系统（`~/.claude/.../memory/`），此处只放「必须遵守」的那几条。

## 验证
- 说「完成 / 已修 / 还坏着 / 没有 X」之前，**先跑命令实查当前状态**，别凭印象、别复述旧诊断当现状。
- 改完代码先 `node` 跑通或跑断言再说完成；关键改动留 `.bak`。
- 回复「我能不能 / 有没有 X」时先核实，别凭记忆下断言。

## 架构守卫（2026-07-04 起 · 详见 web/docs/arch-guards.md）
- 每刀收尾跑 `node scripts/lint-arch-all.js`，须全绿。四刀皆棘轮：基线只许降不许升。
- **读随便，写必须走账**：新增 GM/P 直写即红——改走子系统 mutator/ledger，或裁定后登记 owners / 行内 `// arch-ok`。
- 拆分/改名前先 `node scripts/lint-dep-graph.js --who TM.Xxx` 查引用面；按主题回归用 `node scripts/run-smokes.js --grep <主题>`。

## 写测试（2026-11-16 起）
- 测试要**把代码跑起来**，断言它算出来的结果（vm 装文件 / require 模块）。别把源码当文字读进来断言「里面有某段字」——代码错了它照样绿，只是改了写法它就红。新增这类断言 `lint-smoke-source-pins` 会拦；确实只能看文字的（某旧写法不得再出现）写成否定式 `ok(!src.includes(…))`。
- 别把游戏里的逻辑抄一份进测试再测抄本——游戏那份改了，抄本还绿着。
- 修一个 bug 配一支能复现它的测试就够；不为同一处改动另堆「接线检查」「已登记检查」。

## 改动边界
- 用户说「改 X」就**只动 X**，别顺手改无关文件（如 styles.css）。preview/mockup 与运行时代码是两条 review 路径，不混。
- 大改拆 3–5 个小 slice，一刀只做一件事，拒绝把无关事捆进同一刀。
- 重写/重构含中文的段落时，**禁止顺手把中文 display name 翻成英文**；改前后 grep 中文 token 数量比对。
- 遇 GBK→UTF-8 乱码：**禁 ASCII-safe 替换**，从 1.1.6 备份做参考还原。
- 对齐 schema 以**运行时渲染器**（`_peRender*` / `_render*Panel`）为权威，preview-*.html 只是 mockup。

## 协作·推送（详见 CONTRIBUTING.md）
- 主干 = `main`，**远端为唯一真相源**。开工先更新 main，在隔离 worktree 上一事一分支地做。
- **仓主侧（本机）验证全绿后直推 main**（owner 2026-07-21 拍板：PR 逐个批红太繁·`gh pr merge` 在助手环境被分类器拦死）。直推前置门槛不降：`lint-arch-all` 8/8 + 全量 ci-smokes + 基线对齐；高风险大改仍可自愿走 PR 留一道预审。
- 协作者仍走短命分支 + PR：等 `guards` + `mobile-release-contracts` 全绿和 approval 后合并。
- 禁：force-push、守卫红着合、半成品占坑式提交、`--no-verify` 绕 hook。
- 新协作者只使用自己的 GitHub 账号和 `Write` 权限；禁止共享仓主 PAT/SSH/API key，生产发布凭据仍由仓主持有。
- 磁铁文件/跨领地改动先认领；PR 合并后删短命分支。
- 磁铁文件（`arch-baselines/*.json`）rebase 冲突时**不手合**，取一侧后重跑对应 lint `--update` 重生成。

## 官方剧本真源
- 唯一数据真源是仓根 `scenarios/*（官方）.json`；`web/scenarios/*.js`、seeder/preview bundle、`web/bundled-scenarios/` 都是派生物。
- 改官方 JSON 后运行 `npm run sync:official-scenarios`，再跑 `npm run verify:official-scenarios`；禁止从内置 JS/bundle 反向导出覆盖 JSON。

## 发版（ship / 热更）
- **ship / 热更 / 发版仍只由仓主显式触发**，合进 main ≠ 发版；进行中的大功能（如科举大改）整套完工前不 ship。
- 发版必须分两阶段：短命分支运行 `scripts/release.js --prepare`，把版本盖戳与 `web/.hot-update-manifest.json` 经 PR 合入；随后只在 clean 且 `HEAD === origin/main` 的 `main` 运行 `--publish`。publish 禁止再改 tracked 版本/基线，上传前会复验 HEAD 与 release tag 指向。
- Android 版本真源是 tracked `mobile/release-version.json`；`mobile/android/app/build.gradle` 属 ignored Capacitor 派生物，publish 只在本机从 canonical 同步它，禁止把它当 PR 盖戳文件。
- production 外写只认仓库 owner：`release.js` 上传前验证当前 `gh` 账号；`pages-production` 同时限制 manual actor 与 Release author。direct Write 协作者只能开发/PR，不能触发正式 Pages 或 ship 外写。
- `--publish --no-upload` 仅供本地制品验证，允许非 main/dirty，但必须硬跳过 GitHub Release 与 autodeploy 外写；`--offline` 不得用于正式 publish。
- 发热更走 **server-side SSH `python3` 解 zip**，不走 SFTP per-file。
- `changelog.json` 要 `/tianming` 与 `/hot` 两处同步（skill `upload-hot.py` 已自动同步）。
- 发增量包前确认基线对齐，避免「版本号跳最新但 UI 退版」的假更新。
- **热更要发两次**：电脑端（Electron·`build-hot-update-package.js`→服务器 `/tianming/hot/`）和**安卓端**（Capgo·`build-capgo-bundle.ps1`→`/tianming/capgo/`）是**两条独立管线**·同一份 `web/` 源码要分别发·**别只发一端**。一键双端打包：skill `tianming-hotupdate-push` 的 `publish-all.ps1`。SSH 从开发会话被封→两端都走 `gh release`→owner 在服务器 `curl` 拉落位。安卓首更 Capgo 大概率全量(~460MB)·之后才差量。

## 内容与文案 · 跨朝代通用
- **游戏内容（机制 / 事件 / 制度 / 数值）禁止局限于某一朝代**：设计任何内容前先判断「这是中国古代通用的，还是某朝独有的」。通用的进通用层，朝代独有的归剧本数据，绝不把单朝特例硬编进引擎。
- UI 固定文案（chrome）用**朝代中立词**，不写死「内阁 / 票拟 / 司礼监」等明清专名；角色官衔属剧本数据，可保留专名。
- 不臆测 P 社 UI 先例（训练记忆不可信），设计以游戏内截图为锚。

## 协作风格
- 长 `--do` 链里别变成「无情干活机器」，保留判断和人味（owner 反馈）。
