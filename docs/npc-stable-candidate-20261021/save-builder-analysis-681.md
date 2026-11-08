# 681 保存构造链只读排除分析

- 分析提交：`681e29ad804c56e4a8cb8bb22c10a34b417eb7fe`。
- 当前 `web/tm-save-lifecycle.js` 与该提交逐字节一致，SHA256：`0675740b33e5fadaa4a6ee30e2792e4dbd61c2786deff5864012f0ae91f4d868`。
- 范围：只读源码、既有测试与8a分配诊断；本次没有修改运行时或执行重型测试。

## 已有保护，不能再描述成尚未修复的全量重复克隆

1. `_tmCommitBackgroundWorld`（tm-save-lifecycle.js:2078、2087）只调用一次 `_buildSaveState({detach:true})`，检查世界租约及事务状态后创建canonical payload，双槽原子写入成功才采纳。失败或租约变化不会提前发布新基线。
2. builder（:2391）先把GM从live脱离；P（:2393—2400）只按实际对象同一性去除已经可由GM地图恢复的两个别名，然后深拷贝。不同对象即使内容相同也不擅自合并。
3. `_prepareGMForSave` 的canonical调用已经传 `omitDiscardedMirrors:true`（:2402）；白名单镜像在准备阶段就不生成。`smoke-perf-save-preparation.js` 已有对23项被丢弃镜像的克隆计数和结果等价断言，本次仅阅读、未重新运行。
4. 准备后的第二次 `_autoSaveSnapshotGM` 已传 `reuseMutable:true`（:2404）；该函数在:2319、2326、2336直接复用已经脱离live的镜像／历史／mutable值，不再深拷整个GM。
5. 提交后 `_tmAdoptCommittedWorldSnapshot` 使用 `takeOwnership:true`（:2109）；:2449不会再做默认的 `deepClone(state)`。不能把这条明确移交所有权路径误说成额外全世界克隆。

`_savedEventBus`等子系统序列化结果、DOM草稿、P层配置镜像和截断诊断各有不同恢复契约，不能为了减少字段统一删除。现有跳过白名单与直接调用准备函数的兼容范围应保留。

## 为什么同时看到多份分配，不足以认定重复错误

8a run `c758790a-f00f-4416-bcb7-25e8ac538975` 的既有profile0089记录：

| 分配来源栈 | 该栈统计存活分配字节 |
| --- | ---: |
| 后台保存 → builder → deepClone（P） | 515,168,632 |
| 后台保存 → builder → _autoSaveSnapshotGM → deepClone（GM） | 375,634,392 |
| 后台保存 → createCanonicalPayload → JSON.stringify | 347,127,776 |

profile0098中上述P／GM栈分别为227,692,584和179,460,044字节。原文件见[profile0089](review-save-barrier-20261023/allocation-profile-0089.json)与[profile0098](review-save-barrier-20261023/allocation-profile-0098.json)。这些数字按调用栈聚合，可能包含多次调用的存活分配；不是“一份P就这么大”、精确对象大小或retainer／永久泄漏证明。

源码可确认：新后台state构建、序列化和写入期间，旧 `lastCommittedSnapshot`仍是已提交基线；只有双槽写入、writeGuard复验及采纳成功后才替换。新提交前必须保留旧snapshot，以维持失败回退、跨世界拒写和桌面只保存已提交状态的约束。提前清空它虽然可能降低峰值，却会削弱正确性，不应采用。

canonical序列化还会同时持有state、JSON和压缩结果（tm-storage.js:300）；这些是现行提交契约的一部分。分配诊断不能直接证明其中任一份可以删除。该profile使用的CDP采样在匹配V8版本会隐式GC，因此仅作分配来源诊断，不作普通浏览器通过或OOM因果证明。

## 小型潜在冗余及本轮决定

`_buildSaveState`确实在深拷P之后才删除truthy `P.gameState`（:2413）。但正式加载路径已在:1504、1517清除该旧嵌套字段；当前证据没有证明正常组合链仍携带一份巨大僵尸gameState。它是可单独验证的兼容边角，不能作为这次OOM根因或已解决峰值的结论，本轮不因此改builder。

若将来验证这项边角，应覆盖：有／无旧gameState时的输出一致、live P不变、其他字段及地图别名保持、prepare=false与project/idb两格式、克隆失败仍明确传播；并先证明实际输入存在该冗余。不能用空输出或伪造hash让测试通过。

目前没有发现比正在独立验证的“桌面自动档文本在main串行队列解析”更应优先实施的builder改动。本轮保留canonical快照和事务边界，先验证一个已经识别的可移除分配；不扩展为保存格式迁移、按内容合并地图或删除公共／私人事实。
