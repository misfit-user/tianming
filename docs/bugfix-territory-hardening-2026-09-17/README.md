# 领地易主链路加固：本地验收记录

设备：LAPTOP-AV4J1O7I。
工程：C:\Users\37814\Desktop\tianming。
本次日期：2026-09-17。
起止 HEAD：5ed032afe65cc041dd4d890227ada23e736b4713。
未创建提交，未推送，未打包或发布，未加载玩家存档，未调用外部 AI。

## 实际修改

1. 主回合应用地图变化不再要求 P.map 存在；GM.mapData / GM.map 可独立承接当前世界。
2. 地图应用异常向回合事务传播，不再只写控制台后继续假成功。
3. 同一响应中先完成 faction_create，再应用 map_changes，使新国家先拥有有效运行时身份。
4. 新增统一批量领地事务，单地块接口、AI 批次和旧批量入口复用。
5. 全批预检地块、势力、数值和重复目标；同地块冲突目标拒绝，重复同目标合并。
6. 稳定地块 ID 优先且不失败回退到其他名称；歧义名称拒绝，对象式行政绑定得到解析。
7. 批次内任一写入或必要国家派生计算失败，恢复本批已修改对象；不提前发成功事件或刷新。
8. 成功批次只重算一次国家派生数据、请求一次正式地图刷新；旧画布刷新异常不拦截正式 SVG。
9. 明确无主归属在归属索引重建中保留，不被旧的国家领地提示重新认领。
10. 通用字段更新禁止绕开归属事务；叙事补录也不再捕获事务失败后强行覆写旧镜像。
11. 不变归属重放保留领地列表顺序，不重复记史、计算或刷新；JSON 重载后同样验证。

## 文件范围

- web/tm-endturn-apply.js
- web/tm-faction-membership.js
- web/tm-map-system.js
- web/map-integration.js
- web/tm-ai-change-narrative.js

测试新增 web/scripts/smoke-territory-hardening.js；旧 smoke-tianqi-map-runtime.js 补加载正式依赖 tm-faction-membership.js，未降低断言。
上一轮的 tm-three-systems-ext.js、tm-endturn-prompt.js 和 phase8-formal-map.js 与本轮开工备份逐字节一致。

## 验证结果

- territory-hardening：28/28 通过。
- territory-ownership-sync：8/8 通过。
- territory-context-sync：7/7 通过。
- territory-render-economy：4/4 通过。
- 合计 47 项专项案例；它们包含在 105 个相关脚本的回归中，不重复累计脚本数量。
- 最终相关回归：103 PASS、2 FAIL、0 SKIP、0 WAIVED、0 FLAKY、0 SUSPECT。
- 所有修改代码语法检查通过；git diff --check 退出码 0。
- 40 地块批量测试：国家派生重算 1 次，正式地图刷新请求 1 次；这是调用次数验证，不是宣称整体提速 40 倍。
- 架构守卫：仍有 5/13 项失败；修前与最终失败诊断逐条比较一致，未放宽基线。

## 仍未通过的两项相关测试

1. smoke-runtime-save-consistency.js：读档 hydration / receipt 屏障的静态断言失败（其余 80 项通过）。
2. smoke-shaosong-target-map-regions.js：官方剧本 Western Xia external force summary not synced。

两项都在不包含本轮代码补丁的只读对照运行中复现；对照器 run-baseline.cjs 不恢复、覆盖或修改工作区源码。具体见 baseline-save.log、baseline-scenario.log。
原始 21 项新测试在开工代码对照中为 2 通过、19 失败；对应修后为 21/21。后追加 7 项案例，最终 28/28。

## 使用与边界

本次测试在本机使用生产函数、合成世界和官方剧本副本，覆盖实际主 writeBack 函数、自动刷新调用、SVG 构面与国界、国家索引及人口税基；部分无关子系统和 DOM 使用测试替身。
没有完整正式游戏窗口端到端验收，没有调用真实外部语言模型，因此不保证模型每次叙述零错误，也不把任意一句正文视为已确认易主。

从本源码工程启动时，请先保存进度并重新启动以加载新代码；加载后，成功应用的易主会自动同步并刷新，不需要玩家再次批准。独立安装客户端未被打包更新。

## 留存证据

FINAL-RESULT.json 保存修改文件 SHA-256、原文件哈希、语法和差异检查、47 项专项结果、105 脚本汇总及架构对照。
originals 保存开工时原文件；多个 .bak 为本轮中间步骤备份。final-smokes.json / final-smokes.log / arch-final.log 是最终原始报告。
apply-hardening.mjs 与 batch-support.txt 是未执行的早期草稿，不代表实际落地方案；实际修补由 fix-main-entry、apply-batch、fix-entry-order、refine-boundaries、finish-bulk 脚本完成并经过后续测试。不要重复运行一次性补丁脚本。
