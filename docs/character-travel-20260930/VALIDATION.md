# 验证记录

## 正向生产流程

Electron 生产入口 `node scripts/verify-electron-bridge.js --npc-travel`：

1. 沈行之在东城发起约见，邀约先按东城→西城路线进入 transit；第 5 日后玩家才收到。
2. 玩家在正式鸿雁面板明确接受；人物仍在东城，随后由程序推进 `_travelTo=西城`。
3. 双方到场后写入唯一 participation，返程完成后回到原处；保存/读档保持同一计划、地点和 returned 状态。
4. `modelAttempts=[]`、`externalTraffic=[]`、`day=15`，未重复创建或重复参与。

同一生产入口 `--npc-daily` 仍通过上一轮 NPC→NPC 引见、玩家明确回应、材料交付和保存读档流程，模型调用与外部请求均为 0。

## 命令与结果

- 基线：`run-smokes.js` 15 PASS / 0 FAIL。
- 旅行/日期/日常/位置/保存针对性：32 PASS / 0 FAIL；最终旅行/日常/路线/日期切片：10 PASS / 0 FAIL。
- `node web/scripts/lint-arch-all.js`：全架构守卫 PASS。
- `node scripts/verify-release-contract.js`：PASS（资产树基线含 1411 项；CI 无资产 checkout 对缺席资产容忍 595 项）。
- `node web/scripts/verify-official-scenario-parity.js`：41 assertions PASS。
- `node scripts/sync-hot-baseline.js --check --version 1.3.5.3 --asset-root <主工作副本> --temp-root D:\TianmingTaskTemp`：PASS。
- Electron：`--npc-travel` 11 项 PASS；`--npc-daily` 13 项 PASS。
- 全量 `ci-smokes --jobs 1`：1146 PASS / 3 FAIL / 2 WAIVED。3 个失败为 C 盘临时目录 ENOSPC（desktop async load、dev sync）及新增启动模块计数；启动契约已修正，3 项在 D 盘临时目录重查均 PASS。重型电路治理与官方 bundle parity 也已顺序单独 PASS。

## 性能与未验范围

针对性 run-smokes 并发 2 约 64 秒；旅行 Electron 约 31 秒，日常 Electron 约 40 秒；两条流程均 0 模型调用、0 外部网络请求。严格路线查询按地图对象缓存，普通日常仍使用有界本地预算。

未在真实生产存档、真实模型、移动端或完整世界无 API 模式下验收；未实现完整古代路网、跨地水文、官员请假/代理/归任及所有旧政治动作接管。全量门禁的 C 盘 ENOSPC 需要在有更大临时盘的 CI 环境复跑。
