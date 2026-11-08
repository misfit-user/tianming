# 后台复核与待办保存的分配重叠

## 实际修复

`RecoveryReview.afterCommit.begin` 先取得本次 pending 来源的正式排队回执，等待已有后台保存队列确认提交，再重验世界、回合、加载代次、API 配置、忙碌状态和背景取消信号，才继续 `join → makeBasis`。不持有世界事务，不删除来源或保存字段，不修改重试次数、时限、堆上限或 GC。

`publishBackground` 返回原保存请求回执。新的保存失败路径仅更新 pending/error，不再次排队重置保存重试；尚未进入 join 时明确中止并清理 review。正常 join 的后续保存行为保持。

## 冻结证据

- 运行时代码基线：`f4359559260a76417e75a5de76c094fc2248ed4c` 加本目录 evidence.json 中的两文件 SHA256；运行前后 hash 不变。
- 当前同一测试：62 PASS / 0 FAIL，exit 0。
- 仅将 review runtime 换为该基线的 Git 原始 blob：45 PASS / 17 FAIL，exit 1；原45项断言保留且通过。
- `candidate.stdout.log` 最后一项加载实际生产后台保存队列，暂停实际双槽写口，证明写口返回前没有第二次复核快照或模型调用；确认提交后正常恢复。磁盘与模型响应是受控边界，不冒充完整浏览器或真实 IDB 验证。
- `prior-runtime.stderr.log` 最后一项在同一受控写口未提交时已经形成第二次 basis（2 != 1），是旧实现的顺序反例。

## 分配诊断的正确边界

两份 profile 来自 run `c758790a-f00f-4416-bcb7-25e8ac538975`。同版本 V8 的 `getSamplingProfile` 内部触发强制 GC；这一运行只能作诊断，不能作为普通验收。

profile 0089 同时存在后台保存 P/GM 克隆、canonical JSON 和复核 GM/P 冻结字符串；profile 0098 收尾后复核字符串和中间 JSON 已释放。栈记录是统计存活分配估算，不是对象保留链，不能证明单个对象精确大小、永久泄漏，或两个领域合法快照是重复错误。

本次只消除已识别的“该复核的 pending 保存”与“该复核第二轮 basis”并发。没有据此声称 OOM 已解决，仍须关闭采样后运行正式组合 CI。
