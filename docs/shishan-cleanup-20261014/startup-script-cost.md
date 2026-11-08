# index.html 同步脚本启动成本（node v24.14.0·vm·headless 桩·2026-10-14）

脚本 479 个 · 20.2MB · 编译+顶层执行合计 1522ms（5 轮·执行取最小·编译取首轮冷值·各轮墙钟 4308/1454/2195/1837/2057ms）

| 分期 | 脚本数 | 字节 | 耗时 ms | 占比 |
| --- | ---: | ---: | ---: | ---: |
| world | 318 | 14246KB | 1043 | 69% |
| core | 117 | 3647KB | 316 | 21% |
| optional | 29 | 2604KB | 133 | 9% |
| menu | 15 | 224KB | 30 | 2% |

前 30 个脚本合计 319ms，占 21%：

| # | 脚本 | 分期 | KB | 编译 ms | 执行 ms | 合计 ms |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| 1 | generated/tm-ai-change-applier.bundle.js | world | 362 | 21.6 | 1.4 | 23.1 |
| 2 | tm-endturn-apply.js | world | 342 | 18.4 | 0.7 | 19.1 |
| 3 | tm-endturn-ai.js | world | 399 | 17.3 | 0.7 | 18.0 |
| 4 | tm-endturn-systems.js | world | 39 | 12.9 | 0.6 | 13.5 |
| 5 | tm-huji-engine.js | world | 152 | 11.6 | 1.1 | 12.7 |
| 6 | tm-fiscal-engine.js | world | 162 | 11.3 | 1.3 | 12.6 |
| 7 | tm-endturn-followup.js | world | 277 | 11.7 | 0.8 | 12.5 |
| 8 | tm-endturn-prompt.js | world | 356 | 11.5 | 0.6 | 12.0 |
| 9 | tm-player-core.js | world | 219 | 9.5 | 1.5 | 11.0 |
| 10 | tm-npc-decision.js | core | 88 | 9.5 | 1.0 | 10.5 |
| 11 | tm-renwu-tuzhi.js | optional | 166 | 9.3 | 1.1 | 10.4 |
| 12 | tm-guoku-engine.js | world | 149 | 9.1 | 1.2 | 10.3 |
| 13 | tm-content-manager.js | optional | 177 | 8.3 | 1.7 | 10.0 |
| 14 | phase8-formal-map.js | optional | 163 | 9.1 | 0.9 | 10.0 |
| 15 | tm-content-manager-community.js | optional | 185 | 8.4 | 1.3 | 9.7 |
| 16 | tm-economy-engine.js | world | 145 | 7.6 | 1.8 | 9.5 |
| 17 | tm-ai-infra.js | core | 165 | 7.3 | 1.7 | 9.0 |
| 18 | phase8-formal-bridge.js | optional | 183 | 6.4 | 2.6 | 9.0 |
| 19 | tm-wendui.js | core | 183 | 7.7 | 1.0 | 8.6 |
| 20 | tm-char-economy-engine.js | world | 95 | 6.9 | 1.5 | 8.5 |
| 21 | phase8-formal-map-dossier.js | optional | 166 | 7.7 | 0.7 | 8.5 |
| 22 | tm-npc-daily-activities.js | core | 80 | 7.3 | 1.0 | 8.4 |
| 23 | tm-keju-runtime.js | world | 113 | 7.2 | 0.9 | 8.1 |
| 24 | tm-ai-planning.js | world | 124 | 7.4 | 0.7 | 8.1 |
| 25 | tm-utils.js | core | 110 | 6.6 | 1.4 | 8.0 |
| 26 | phase8-formal-rightrail.js | optional | 147 | 7.0 | 0.9 | 8.0 |
| 27 | tm-authority-engines.js | world | 101 | 6.5 | 1.2 | 7.6 |
| 28 | phase8-formal-drafts.js | optional | 214 | 6.7 | 0.9 | 7.6 |
| 29 | tm-tinyi-v3.js | world | 147 | 6.1 | 1.4 | 7.6 |
| 30 | tm-faction-npc-llm-decision.js | world | 146 | 6.8 | 0.7 | 7.5 |
