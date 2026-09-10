# 近期建筑与国师成果：组合交付

本文件记录源码合并候选的本地验证，不是安装包或热更新发布报告。

## 提交范围

- 实际 main 基线：`f102b56585faa48c47d362a91c5260f4cee1b8eb`。
- 被测组合代码：`34d0cfd8a0228d6d8946f069cfd40d15c6f74193`。
- 分支：`codex/recent-building-guoshi-delivery`；后续本报告/证据提交只增加文档，不改变被测代码。
- 包含6个此前建筑提交（83c117a1、4e942337、1a147726、0ccd71ef、3a0b0121、f3d2086c），8个此前国师提交（8b86ddcf、8894e1b7、67895fd1、82477266、256f6373、b6b571b5、e91a2078、cbce229f），本轮第三批888ebb20及说明5231d72a，以及组合merge。保留原提交祖先关系，不用覆盖/强推整合。
- 组合时仅 `web/.hot-update-manifest.json` 冲突，以当前清单为种子，由官方 `sync-hot-baseline.js` 在合并后的源码+只读资产叠层上重建。总清单1097条，410个未跟踪资产条目保留；没有手填hash。
- 原工作树、所有原分支、其他历史任务未提交修改均未覆盖；没有混入旧清理/暂停财政改造等无关工作。

## 内容

1. **建筑原渠道**：核议只能转入既有诏书草稿；正式发布、普通/Agent回合写回通过稳定身份、核办回执创建真实工程，保留足额扣款、幂等、未决/拒绝、回滚和迟到响应保护。没有新独立拍板入口。
2. **国师可靠性**：JSON/SSE响应、真实完成状态、失败草稿续做、案卷加载身份、原案卷保存关联、问策只读执行权限、部分应用确认、记忆/技能待批准提交。
3. **国师第三批**：空转停止、长指令完整保留、阶段工具展开、服务商usage与本地估算分开、叶路径写回执减量、快测来源指纹和官制实际来源提示。

细节及早期失败记录见：[建筑写回](building-order-writeback-2026-09-10.md)、[国师案卷/权限](guoshi-boundaries-2026-09-10.md)、[国师完成/恢复](guoshi-completion-recovery-2026-09-10.md)、[国师效率与实机验收](guoshi-efficiency-2026-09-10.md)。

## 组合验证（全部在34d0cfd8上，Windows本机）

完整机器索引：[recent-building-guoshi-20260910.json](evidence/recent-building-guoshi-20260910.json)，含66个被测改动文件的SHA-256、24次命令、退出码、原始日志位置和Electron报告hash。

| 命令/范围 | 结果 |
| --- | --- |
| 相关29个Smoke（authoring/guoshi/kernel/quicktest/building） | 29 PASS，0 FAIL/SKIP/WAIVED |
| `node web/scripts/lint-arch-all.js` | 13 PASS |
| 官方剧本同步/对账 | 2 sources/9 artifacts未漂移；27 PASS |
| `node scripts/verify-release-contract.js` | 166 PASS |
| `node web/scripts/verify-hot-builder-gates.js` | 27 PASS；仅临时夹具，不发包 |
| 实际工作树审计探针 `--expect-clean` | 11个缺陷判据未复现，2正常对照通过，无框架错误；不冒充全面安全认证 |
| `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org` | 0 vulnerabilities |
| `sync-hot-baseline.js --check --version 1.3.4.11` | 687在场文件通过；410缺席资产清单保留 |
| `git -c core.whitespace=cr-at-eol diff origin/main..HEAD --check` | 0；保留原混合行尾 |
| 真实 Electron：桌面/建筑/润色/案卷/续做/SSE/天启任务/绍宋任务 | 分别29/27/15/20/17/12/10/10 PASS，8条命令均exit0且无进程error/signal |

Electron是锁定33.4.11的未打包环境，临时userData、网络阻断、控制模型响应/时序，真实editor/main/preload/IPC/IndexedDB/游戏初始化。重复的基础桥接检查不能当成互不重复的140个完整玩家流程，也没有真人API/安装包/原生鼠标/FPS验收声明。

### 全量本地结果必须分开看

- 默认 `node web/scripts/ci-smokes.js`（本机8外层worker）两次均：**931 PASS /1 FAIL /0 SKIP /2 WAIVED**。唯一失败是未改动的 `smoke-workshop-lock-recovery.js` 的20秒压力准入断言。两次原始报告分别在 `ci-UWQRx3`、`ci-1moS8N`，没有覆盖为通过。
- 同锁专项独立运行：13 PASS，四进程/100事务/20秒原断言不变。
- 使用 runner 既有参数运行相同完整集合：
  `node web/scripts/run-smokes.js --all --no-retry --jobs 2 --report web/dev-tools/arch-guard/combined-two-workers.json --run-id combined-two-workers-20260910`
  结果 **934唯一结果：932 PASS /0 FAIL /0 SKIP /2 WAIVED**，锁专项也通过（18.4秒，包含其他锁中断用例）。
- 用 CI 的同一个 `validateReport`，锁定runId、34d0cfd8、`discover()`完整集合与实际runnerExit0再次验证，通过。未改变锁实现、其内部并发数、超时、断言、豁免、runner或远端CI默认配置。该对照支持“本地外层并发负载影响压力用例”的判断，**不宣称锁性能问题已被修复，也不把默认8并发失败写成绿**。
- 2项WAIVED仍限于原来的5音频+2字体缺席检查，各脚本其余断言继续执行。没有新增豁免。
- 推送后远端必须用原默认工作流重新验证，不能以本地2worker报告代替远端Checks；合并后CI也应单独记录实际状态。

## 发布及保留边界

未更改package/mobile/web版本、官方剧本正文、正式发布工作流；main/PR事件只做检查与预览artifact，Pages依旧只由仓主手动触发。合并不等于发布，本次不打包、不打标签、不发热更、不部署生产、不删除分支或历史材料。

国师恢复仍限同页同案卷实例；旧无身份锁/旧快测来源未知材料保留保守维护策略。真正模型质量、计费、安装升级回滚等不在本次源码合并验收之内。
