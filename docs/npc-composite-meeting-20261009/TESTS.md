# 测试清单

环境：Windows、Node.js 24.14.0、npm 11.9.0；候选工作树没有 node_modules，定向 smoke 直接使用锁定源码；清单检查用已有候选依赖通过 NODE_PATH 只读复用。

| 类别 | 命令 | 结果 |
|---|---|---|
| 组合旅行 | `node web/scripts/smoke-npc-travel.js` | PASS 10 groups |
| 按需规划 | `node web/scripts/smoke-npc-ai-routing.js` | PASS 7 groups |
| 生活机会 | `node web/scripts/smoke-npc-life-opportunities.js` | PASS 11 groups |
| 生命周期 | `node web/scripts/smoke-npc-daily-lifecycle.js` | PASS 17 groups |
| 职任/公库回归 | `smoke-office-tenure.js`, `smoke-office-duty-reliability.js` | PASS |
| 官方组合 | `node web/scripts/smoke-npc-composite-official.js` | PASS，513 人物，39 势力，0 API attempt |
| 架构 | `node web/scripts/lint-arch-all.js` | PASS |
| 发布契约 | `node scripts/verify-release-contract.js` | PASS 182 assertions |
| 官方 parity | `node web/scripts/verify-official-scenario-parity.js` | PASS 41 assertions |
| 生成清单 | native/startup/hot `--check` | PASS |
| Electron | `node scripts/verify-electron-bridge.js --npc-daily` | PASS：正式页面请益/追问、真实 endTurn、保存加载、0 API；组合会面 Electron 场景未纳入门禁 |

完整 1159 smoke 尚未在这个新候选上运行；旧候选的完整数字不作为本候选结果。

组合会面 Electron 夹具曾在同一正式页面中暴露 UI lease、路线提示遮挡和重载回菜单边界；已撤出 CI。组合业务仍由 `web/scripts/smoke-npc-composite-official.js` 的真实生产模块 smoke 覆盖。
