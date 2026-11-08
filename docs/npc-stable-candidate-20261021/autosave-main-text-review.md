# 自动存档文本传输：独立审核

日期：2026-10-23。审核者：`/root/review_waits`。

审核基线为 `681e29ad804c56e4a8cb8bb22c10a34b417eb7fe` 加当时未提交的文本传输补丁。以下 SHA-256 标识实际核读的字节；不将尚未提交的补丁写成已经包含于该基线。

| 文件 | SHA-256 |
| --- | --- |
| `main-impl.js` | `eaf893396a6213b1ab92aa8fc80ddb9b25596647a8d12918d9b96bff7facd2e0` |
| `preload-impl.js` | `22fc36e4490c6c3584e943d62ff706f63bca1ee04ecf8e7f04f0179a8f7e5f70` |
| `web/scripts/smoke-autosave-text-bridge.js` | `054a2feb22dea802e8fbe071595fe1c86e293cac7c63dd86b14754800fbd644c` |

## 结论

本次限定范围的独立代码审核未发现阻断。preload 不再解析整份正文；文本进入既有主进程共享队列后才解析、校验并沿原写盘路径执行。没有建立另一条写队列或独立存档格式。

已核对的契约：

- `JSON.parse` 位于 `autoSaveWriteQueue.then` 内，排队中的后续文本不会提前构造成完整对象。
- 非法JSON、非对象正文、同时带对象与文本的歧义输入均被拒绝。主边界的 `AUTO_SAVE_JSON_INVALID` 回执在preload转换为Promise rejection，不静默兑现false。
- 初稿在解析前短路过期session，会使排队期间换session的非法文本丢失原拒绝契约。此问题已移除；新增的“queued malformed + rotation”用例核查拒绝及不覆盖旧盘。
- 文本／形状校验发生在 `ensureSaveDir` 和会话持久化之前；无效正文不能建立一份新session。
- 会话仍由preload取得并在调用时固定，正文内的同名字段不授予会话身份。原可信顶层renderer检查继续包裹该IPC通道。
- 固定 `.tmp` 的共享串行化、写入期间的session复核、rename完成后的session复核均保留。旧成功或失败不能认作当前世界已保存。
- 旧对象入口继续使用原路径；文本和对象最终均经 `prepareDesktopSavePayload`，保留既有envelope、generation、metadata及错误处理。
- 写盘失败不推进renderer成功时间／回合，不自动退回另一运输方式重复写入；后续明确合法请求仍可成功。

## 测试审核与执行边界

核读的新文本回归直接加载实际preload、main的串行handler及实际payload准备函数。IPC和文件系统是声明的受控边界；测试核查零preload解析、真实队列次序、磁盘envelope、无效正文、换session和失败后的恢复，没有复制一份业务实现。

`smoke-desktop-autosave-reliability.js` 的两处正文读取适配了 `dataJson`，原旧shell对象入口断言保留。正式Electron存档场景追加了无效文本不轮换session的断言，但这项代码存在本身不等于浏览器已经通过。

本审核者独立执行了 `node --check preload-impl.js`、`node --check main-impl.js` 与 `git diff --check`，均退出0。行为回归由实施代理运行并另行归档，本说明不将其数字冒充本审核者重跑结果。

本审核者未修改运行时代码、未启动重型测试、未调用付费模型、未提交或推送。本文是之后按主代理要求补写的审核记录。

## 未能由本审核证明的结论

此补丁减少renderer/preload中的完整解析对象，但没有证明全部内存峰值或OOM根因，也没有证明最终正常浏览器已稳定完成。仍须在包含这些确切native字节、关闭CDP采样的候选上运行完整组合流程、两次实际加载、最终持久化和相关门禁。

此前8a采样运行涉及V8隐式强制GC，只能作诊断，不能替代上述普通验收。未改堆上限、超时或真实人口／世界过程以制造通过。
