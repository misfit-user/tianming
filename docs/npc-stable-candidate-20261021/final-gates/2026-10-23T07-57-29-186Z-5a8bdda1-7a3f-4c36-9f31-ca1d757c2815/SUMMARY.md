# 574＋单一测试夹具补丁：67 项及同轮检查通过

- HEAD：`574fcf05447d6daf0e6a99f64ea4a70b119a496e`；这不是纯574提交的全部门禁结果。
- 唯一源码补丁：`web/scripts/smoke-turn-capture-work-count.js`，SHA256 `489a946ea40e64054185e01258cb428c5ec1930f90892910e3a4e9e76361a733`；其余运行时代码保持574。
- Run：`5a8bdda1-7a3f-4c36-9f31-ca1d757c2815`。
- 锁定 Electron33.4.11 / Node20.18.3；子进程 ELECTRON_RUN_AS_NODE=1，D盘临时目录；原120秒、jobs=1、无重试、新增豁免或失败容忍。
- 时间：2026-10-23T07:57:29.186Z → 2026-10-23T08:07:28.364Z；整轮 599178ms，进程退出0。
- **67 PASS / 0 FAIL / 0 timeout / 0 flaky / 0 suspect / 0 waiver**。两官方兼容与六项静态检查同轮全部PASS。
- 完整回合 99376ms；官方组合smoke 90037ms；开局完整性 100538ms；工作量夹具 1361ms。
- 输入 2395 文件，前后hash均为 `bbce0d44c14a150e8c3893867469f0cc0cd501887ccdfdcf11eca21988b7819d`；changedSourcePaths 前后均仅上述测试夹具。
- 原整轮报告SHA256：`5977019839bebf01a1659a1f1b158495fe0cd0eae4c9f54f1011cfb420265373`。
- 原定向报告SHA256：`9b69bf6e42e68e6938e891e2fbcbaf65e7d76e581d0a682e03d9879308290099`。

## 失败记录与修正范围

[前一轮66/1失败](../2026-10-23T07-44-07-460Z-186eb79d-3676-415a-8347-e47a1fef1f25/SUMMARY.md)完整保留。失败是提取式夹具没有加载新增生产helper，实际ReferenceError，不是超时或环境失败。本轮补充原helper加载与受控memory Promise，同时保留原有结构工作量断言，不修改生产实现来迎合测试。

## 验收边界

天启七年、晚唐兼容仅验证真实加载、地点、职任、活动入口、保存builder和restore-fields，模型尝试各为0；不是正式页面或IndexedDB/fullLoadGame验证。67项是本地定向组合，不是1188项全量CI。正式组合浏览器、真实存档恢复与无采样远端结果仍引用各自独立报告，不从本页推导整个里程碑完成。
