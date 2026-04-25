# scripts/ · 零依赖测试 + 重构工具基础设施

此目录下的工具**严格遵守项目 `_no_dependencies` 原则**——仅使用 Node.js 内置模块 (`fs`, `path`, `vm`, `child_process`)，不引入任何 npm 包。

## 一键检查（最常用）

```bash
node scripts/verify-all.js
```

依次跑 syntax-check → ref-check → find-orphans → headless-smoke·任一失败即停。smoke 的退出码用 baseline (≥207 pass / ≤4 fail) 判断·允许改善但不允许退步。完整跑一遍约 18 秒。

---

## 检查工具（4 道防线）

### `syntax-check.js` (R121)

对仓库根目录所有 `*.js` 跑 `node --check`·最低门槛的预提交检查·~17s。

### `headless-smoke.js` (R121)

Node `vm` + DOM/window/localStorage stub·按 `index.html` 顺序加载所有 tm-*.js·跑 `TM.test` 套件。**作为 R110+ 大拆分的回归护航。**

```bash
node scripts/headless-smoke.js              # 跑全套
node scripts/headless-smoke.js --only E2E   # 只跑名字含 E2E 的 suite
node scripts/headless-smoke.js --list       # 列出 suite 名
node scripts/headless-smoke.js --diag       # 打印 TM.* 关键字段
node scripts/headless-smoke.js --verbose    # 详细错误栈
```

能检测：语法错误·加载顺序·未定义符号·命名空间契约·子系统 API。
不能检测：DOM 渲染·AI 返回值·用户交互·CSS。

**当前 baseline**：207 pass / 4 fail（4 个失败都是 headless 环境限制·非真 bug）。

### `ref-check.js` (R136)

扫描所有 `*.html` / `*.js` 里的 `<script src>` 和 `fetch()` 本地引用·验证目标存在。防止拆分时漏改某个 HTML（R136 就是修这种 bug）。

### `find-orphans.js` (R139)

扫描 HTML `<script>` + JS `importScripts/import/Worker`·自动过滤 .gitignore 中 dev-only 的脚本。识别从未被引用的真孤岛文件——R139 删 2 个孤岛共 801 行。

---

## 审计工具（lint）

### `lint-empty-catch.js` (R144)

审计空 `catch(e){}` 块·按 R86 豁免规则（`catch(_)`·`catch(eN)` JSON parse 链·localStorage 操作）分类。R144 跑完确认热路径全部 R86 合规·剩 1 处误报（注释字符串）。

### `lint-catch-console.js` (R145)

审计含 `console.*` 的 catch 块·分类型 1（纯 console·可自动迁移）/ 类型 2（console + toast/showLoading 多语句·需人工）/ 类型 3（已迁 TM.errors）。

---

## 改写工具（migration）

### `migrate-catch-console.js` (R145)

把 try-catch 块里的纯 console.* 自动改成 `(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'label') : console.warn(...)`。R145 自动迁移 301 处。

```bash
node scripts/migrate-catch-console.js --dry-run   # 预览
node scripts/migrate-catch-console.js --apply     # 真改写
```

### `migrate-promise-catch.js` (R148)

姊妹脚本·同样模式但匹配 Promise `.catch(function(e){...})`。R148 自动迁移 22 处。

### `bump-cache-bust.js` (R142)

把 HTML 里所有 `?v=xxxxx` 替换为指定版本号。修 R142 发现的 v20260424v + v20260425v 混用问题。

```bash
node scripts/bump-cache-bust.js v20260425v        # 不传则用今日
```

### `add-ts-check.js` (R146)

批量给 tm-*.js 加 `// @ts-check` + `/// <reference path="types.d.ts" />` 头部。R146 把覆盖率从 24% → 100%。

---

## 建议工作流

**重构前**：`node scripts/verify-all.js` → 记录 baseline。

**重构后每个 commit**：`node scripts/verify-all.js` → 全绿才提交。任一项失败即回滚或修正·绝不带病提交。

---

## 工具清单（10 个 + 1 个 README）

| 类型 | 工具 | 引入 | 用途 |
|---|---|---|---|
| 一键 | `verify-all.js` | R149 | 跑齐 4 项检查·smoke 用 baseline 判定 |
| 检查 | `syntax-check.js` | R121 | node --check 全扫 |
| 检查 | `headless-smoke.js` | R121 | vm 跑 TM.test |
| 检查 | `ref-check.js` | R136 | 跨文件引用断链 |
| 检查 | `find-orphans.js` | R139 | 真孤岛识别 |
| 审计 | `lint-empty-catch.js` | R144 | R86 豁免规则审计 |
| 审计 | `lint-catch-console.js` | R145 | catch 内 console.* 分型 |
| 改写 | `migrate-catch-console.js` | R145 | try-catch console → TM.errors |
| 改写 | `migrate-promise-catch.js` | R148 | Promise.catch console → TM.errors |
| 改写 | `bump-cache-bust.js` | R142 | HTML ?v= 版本统一 |
| 改写 | `add-ts-check.js` | R146 | 批量加 @ts-check 头 |
