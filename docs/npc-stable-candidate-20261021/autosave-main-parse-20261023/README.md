# 自动存档文本留在文本通道

## 修复范围

旧 `autoSaveJson` 虽避免 contextBridge 递归冻结世界对象，却在隔离 preload 中再次 JSON.parse 完整正文。隔离上下文仍属于 renderer 进程。分配诊断曾在该函数观测到约245.7—257.4 MB统计存活分配；这不是对象保留链，也不证明它是 OOM 唯一原因。

本次只改自动存档文本的进程边界：

- preload 捕获既有 session/revision，将正文字符串放入 `dataJson`，通过原 `auto-save` IPC 发出。
- main 的原单写队列内解析并验证对象形状，再进入原临时文件、session 重验、rename、metadata 和回执流程。
- 旧对象接口和磁盘 envelope 保持。没有新写队列、GC、堆上限、超时、依赖或版本变化。
- 非法字符串仍使 `autoSaveJson` 的 Promise rejected；只是检查位置从 preload 移到实际主进程队列。非法 queued 请求即使期间换 session 也仍拒绝，不悄悄降成成功或普通 false。非字符串仍在 preload 直接拒绝。
- 非法正文在目录与 session 写入之前失败；含两种正文或非字符串 dataJson 的主进程请求被拒绝。

## 精确测试身份

`evidence.json` 记录基线 `681e29ad804c56e4a8cb8bb22c10a34b417eb7fe` 加五个实际修改文件 SHA256。七个定向命令均 exit 0，运行前后文件 hash 相同。原输出保留在同目录。

核心文本测试24项：同一真实 preload 与真实 main 源码队列/prepare函数，验证文本和旧对象磁盘 envelope相同、renderer正文解析次数为0、main解析排在前一笔write/rename之后、非法输入不改盘或会话、换档、写入失败、rename期间换会话和随后有效重试。

仅将 preload 替换成681的原Git blob，其余测试和主边界不变：exit 1，失败于“preload不能分配整份已解析正文”。原实现确实进行了1次renderer解析，新实现为0。这是分配路径反例，不是完整性能或浏览器验收。

既有自动存档可靠性20项保持；仅两条正文回读适配新的运输形状，旧shell的对象通道断言仍直接检查data。原运行态保存、安全可信边界、IPC守卫、手动文本保存和组合等待回归也通过。

正式desktop用例新增“非法文本不更换session”断言，但本组没有启动Electron游戏。后续应运行真实production bridge和关闭分配采样的组合浏览器/CI。**尚不声明OOM已解决或候选已通过最终验收。**

## 证据边界

新文本单测实际执行生产源码，IPC和磁盘I/O为受控边界；不是物理磁盘完整试玩。安全可信边界单测另加载实际完整main模块及其可信IPC包装。main/preload传输改动不会要求修改锁文件或安装依赖。
