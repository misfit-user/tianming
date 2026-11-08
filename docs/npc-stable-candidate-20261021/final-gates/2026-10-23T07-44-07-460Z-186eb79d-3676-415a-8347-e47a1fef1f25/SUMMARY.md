# 574 首轮冻结门禁：66 通过 / 1 夹具失败

- 代码：`574fcf05447d6daf0e6a99f64ea4a70b119a496e`，run `186eb79d-3676-415a-8347-e47a1fef1f25`。
- 锁定 Electron 33.4.11 / Node 20.18.3；子进程 ELECTRON_RUN_AS_NODE=1，D 盘临时目录，120 秒原期限、jobs=1、无重试或新增豁免。
- 起止：2026-10-23T07:44:07.460Z → 2026-10-23T07:54:08.326Z；总 600866ms。
- 67 项：66 PASS / 1 FAIL / 0 timeout；两官方兼容与六项静态检查均 PASS。整轮状态 **failed**，进程退出 1。
- 唯一错误：`ReferenceError: _endTurn_startPostTurnMemorySave is not defined`。`smoke-turn-capture-work-count.js` 只提取主保存函数，未加载新 helper；原始失败完整保留，未修改断言或当轮重跑。
- 完整回合 109018ms、开局完整性 99107ms，均未超时。
- 冻结输入 2395 文件，前后 hash 相同：`b6c4a61b1d11dafcaaa974c5a3a7543d45e58e3327a35d5c293302698bbbf93a`。
- 原整轮报告 SHA256：`1bbf1be93139d4adf102a8d84be5a7bc856a6dbade5ec4c20e55f4a003735935`。
- 原定向报告 SHA256：`d58e601b3b3c6fa663a821b30f6e5ebfc7f64624bb0aad27a71cb47653dd4c35`。

## 边界

官方兼容仅验证天启七年与晚唐的真实加载、地点、职任、活动入口、保存 builder 和 restore-fields；不是完整页面、IndexedDB 保存恢复或持续世界试玩。正式组合浏览器与远端 CI 分别报告，不能据此宣布候选全部通过。

后续只补夹具对真实 helper 的加载时，须在新的明确冻结输入树重新运行并单独留证；本份失败不覆盖。
