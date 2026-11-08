# d31 保存闭包与较晚后台写入诊断

## 结论与限制

确认了一处不必要的存档对象保留：`_endTurn_saveSnapshot` 在重型 async 函数内部创建未等待的记忆保存回调。即使 core 已清除公开的 capture/payload 字段，这个回调仍让该函数的 canonical state 和 payload 活着，直到 `sc25/sc25c` 完成。

将 producer 移到外部小型 helper 后，真实函数的小对象 WeakRef 对照显示这两个对象可以提前回收。未确认提交的恢复路径仍保有同一份 payload，可以执行原 `acceptReconciledCommit`，并在成功确认及释放后回收。

**这是显式 GC 的可达性诊断，不是正式浏览器验收，不证明 OOM 已经解决，不测量实际保留字节数。** 未启动游戏、未调用模型、未改变堆上限、未修改运行时代码。真实运行时修改由另一实施代理负责。

## 真实失败时序

原始目录：`web/dev-tools/ci-39914633560-composite/611c2c4c-4779-43d3-b115-96f8f77ff39a`。

候选 `d31d47787573e9cb48935a1e8d3e6ccdca56b90f`，CI 实际 checkout `815bfb626364dd6d0f15b9cab6833099740c8f08`。此次普通、无采样的组合测试在 814839ms 后失败，renderer 明确报告 `reason=oom`。详见 [remote-d31-overlap.json](remote-d31-overlap.json)，其中保留原始报告和日志哈希。

| UTC | 已观察事实 |
|---|---|
| 07:09:02.510 | turn 4 / day 60 / load 2，提交与 capture 释放均完成。 |
| 07:10:07.282 | review-3 开始 calls=2。 |
| 07:10:15.203 | review 仍 investigating；background/desktop 空闲；canonical 与桌面均 revision 15；sc25c 尚在运行。 |
| 07:11:03.681 | review 仍 calls=2；sc25c 已完成，producer receipt fulfilled；新的 background pending/timer 为 true。 |
| 07:11:10.698 | review 仍 calls=2；新的 background inFlight 为 true，canonical 尚为 revision 15。 |
| 07:11:22.637 | renderer OOM；没有完成最终背景落库及最后可见结果断言。 |

这排除了“只是 681 那一次 pending 保存没有等完”的解释：第一轮保存已经落库，第二轮复核开始后又发生了新的保存。

`d31` 源码关联：

- `web/tm-endturn-render.js:192–198` 注册 `sc25/sc25c` 完成后的 `post-turn-memory-complete` 保存。其完成时间与新队列出现吻合；失败 trace 没记录 `request.reasons`，不能认定它是唯一生产者。
- `web/tm-emergency-recovery-review.js:249–294` 在模型请求前创建 basis，直到请求及工具处理退出的 finally 才释放。同一 calls=2 期间冻结的 GM/P 可以与新保存重叠。
- `web/tm-save-lifecycle.js:2087–2109` 新后台保存需要 detached state、canonical 序列化以及原子写入，旧的已提交快照在新提交之前不能删除。
- `web/tm-endturn-core.js:775–780` 已清除提交 capture/meta 的大字段；真实日志确认执行了这段边界。再次清这些字段不能替代移除仍持有它们的回调作用域。

当前失败报告没有 fatal allocation 的 JavaScript 调用栈，也没有对象 retainers。不能从这一组 trace 断言某一个 `P` 字段是唯一原因；8a allocation sampling 的累计分配数同样不是单个活对象大小或 retainer 证明。

## 真实源码的轻量对照

脚本 [diagnose.cjs](diagnose.cjs) 从指定 Git 提交或当前文件读取整份 `tm-endturn-render.js`，在 VM 中加载原实现及其 helper。只隔离外部存储 IO、世界 builder 和微小测试对象；没有复制保存函数实现。

运行环境固定为 Electron 33.4.11 / Node 20.18.3 / V8 13.0.245.25-electron.0。`ELECTRON_RUN_AS_NODE=1` 仅传给子进程；参数 `--expose-gc` **只用于本诊断**。

| 证据 | 在记忆 producer 尚未结束时 | producer 完成后 | 恢复保护 |
|---|---|---|---|
| [baseline-d31.json](baseline-d31.json) | state/payload 都仍可达 | 二者均可回收，保存请求恰一次 | 已确认提交 |
| [helper-working-tree.json](helper-working-tree.json) | state/payload 均可回收 | 仍可回收，保存请求恰一次 | 已确认提交 |
| [baseline-d31-unconfirmed.json](baseline-d31-unconfirmed.json) | state/payload 都仍可达 | 仍保留 | reconciliation 收到同一 state/payload，确认释放后均可回收 |
| [helper-working-tree-unconfirmed.json](helper-working-tree-unconfirmed.json) | state/payload 都仍可达 | 仍保留 | 相同保护通过，没有丢弃恢复数据 |

原 d31 源文件 SHA256：`5a16e2e8981863e9e0d1b9a2cc21920a15d7df897c2499456a9ffbd83638c030`。

对照工作树文件 SHA256：`276a0ef562f460ffcea381992c508644b7e332cf2f994e8793452c07c7a2a4a9`。这是当时尚未提交的 helper 实现身份，不能写成 d31 的已发布行为。

### 最终 helper 字节补验

2026-10-23 07:38:08–07:38:09 UTC，对已冻结的最终 helper 文件 SHA256 `f8a5a8bf29067a2c09eab645a9591eca606660cf5cca2b8665c5a4c1cce0a3f6` 重新运行两条诊断；运行前后哈希相同，原四份证据未覆盖。

- [helper-final-f8a5-normal.json](helper-final-f8a5-normal.json)：已确认提交后，producer 尚未结束时 state/payload 已可回收；producer 完成只排队一次。57ms。
- [helper-final-f8a5-unconfirmed.json](helper-final-f8a5-unconfirmed.json)：未确认提交时，两份对象在 producer 完成前后仍保留；原 reconciliation 收到同一对象，确认释放后均可回收。80ms。

两条均使用相同锁定 Node 20 / Electron 33 及显式 GC，小对象、无游戏启动。这仍只是闭包可达性证据；最终运行时组合流程和普通无采样 CI 另行验收。记录中的 HEAD 仍为 d31、`sourceCommit=null`，代表该文件当时是 d31 上的未提交补丁，最终功能提交应由候选报告另行绑定。

各次诊断只使用约百字节测试正文，执行 55–82ms；这些耗时不是正式游戏性能指标。

复跑子进程参数：

```text
node_modules/electron/dist/electron.exe --expose-gc docs/npc-stable-candidate-20261021/save-closure-diagnostic-d31/diagnose.cjs --source-commit d31d47787573e9cb48935a1e8d3e6ccdca56b90f --expected-pending retained
node_modules/electron/dist/electron.exe --expose-gc docs/npc-stable-candidate-20261021/save-closure-diagnostic-d31/diagnose.cjs --expected-pending released
node_modules/electron/dist/electron.exe --expose-gc docs/npc-stable-candidate-20261021/save-closure-diagnostic-d31/diagnose.cjs --unconfirmed --expected-pending retained
```

以上命令须由父进程以 child env 设置 `ELECTRON_RUN_AS_NODE=1`；不改系统或会话全局环境。`--output` 可写入一个新的证据文件，已有文件不会覆盖。

## 下一步验收边界

helper 外移和 producer 完成后的真实保存屏障，需要生产回归保护：完成、失败、世界改变、取消、SAVE_WRITE_UNCONFIRMED 恢复、后到保存仍持久化。普通无采样的完整组合浏览器和 CI 必须另跑；不能继承本诊断或 8a 隐式 GC 采样运行的通过结论。
