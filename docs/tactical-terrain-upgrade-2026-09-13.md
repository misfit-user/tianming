# 程序战术地图改造 · 2026-09-13

本轮为本地运行时升级；没有提交、推送、部署或打安装包。此前亲征与启动自动存档修复全部保留。没有使用玩家存档、API、付费服务或第三方游戏资产。

## 实际改变

- 程序战场由约12万×8万单位的粗烤图，改为约3.2万×2.4万的战术尺度；阵列仍按原军队名册部署，不缩减真实兵数。
- 固定种子生成连续山岭、缓坡河谷和干燥部署区。来敌方向、地貌密度、雪地/荒漠/水乡、海岸/岛屿/边堡参数参与生成。四向布阵都可用。
- 地形网格、士兵贴地、坡度效果、林地掩护、河流/桥渡分类共用同一地形数据。桥上不再按渡河减速；浅滩保留涉水代价。高地要点寻找真实干燥山顶。
- 原创轻量立体树冠/树干、石块、屋舍/屋顶/窗门、木桥和关栅，独立深度测试，不再把树屋桥当平面图案烤入3D地面。村庄留开垦区、田块按坡度放置，道路连接两岸。
- 地表图集配近景重复细节纹理；河床/水面分离、共享河带顶点避免裂缝，水面有轻微流动变化；小地图使用同源地形和视野轮廓。
- 初始镜头按阵列宽度与方向取景。鼠标使用真实网格三角形求交，解决原平面投射及粗步进越过窄岸坡的问题。
- 分块绘制地物、画布/纹理尺寸封顶、16位地形索引、换图释放旧缓冲；保留2D回退及原军队3D模型。

改造入口仅对程序地图启用；三张旧历史地图的生成数据不重做。公共地形光照/法线与拾取可靠性有同步改进。

## 已验证

| 检查 | 结果/证据 |
| --- | --- |
| 地形纯行为 | 89项通过；`terrain-world-shores-0650ec0e-fd2d-474a-ab57-84cb645b3f2d` |
| 六场真实Electron地图 | 最终29项通过；`web/dev-tools/electron-bridge/eff59213-e385-4582-896c-52ce755091a0/report.json`（此前bbc77cac、e152426a两轮同样29项通过） |
| 真实亲征完整往返 | 19项通过；`web/dev-tools/electron-bridge/68db2db1-ee49-4e03-9222-f32b8dada759/report.json` |
| 架构 | 13/13；`terrain-architecture-final-3ecdce8e-49bc-4691-9a94-bb03959e75be` |
| 官方剧本源/派生对账 | 27项通过；`terrain-parity-a811a979-b465-438a-8804-b57ab3fdcea8` |
| 发布契约 | 166项通过；`terrain-release-78ab00db-3e27-40a2-a012-e7f4487bbd57` |
| 同版资源基线 | 最终check通过；1105项/assets367，本轮仅新加2个战场JS，无游戏资产删除，版本仍1.3.4.11；回执`terrain-baseline-final-dd203838-3196-49fc-9127-2d636a6b0d66` |
| 全量smoke | 956/956，0失败/跳过/豁免；`web/dev-tools/arch-guard/ci-cItQmJ/smoke-report.json`，回执`terrain-full-suite-59a10ea4-f880-4d6b-94bf-989c5a5b4a02` |

回执均在`web/dev-tools/office-writeback/`。原生测试使用隔离用户目录，禁止外网；实际启动iframe、上传GPU、操作开战、执行军事战果写口。没有用截图或纯mock替代战斗验收。

本机隔离样本8000兵的六场测量：启动约1.33–5.79秒；帧间隔中位33.4–49.9ms、P95为66.6–99.9ms；可见山顶点选误差0.04–0.21地图单位。它们只是本机窗口样本，不代表所有电脑/安卓性能，也没有拿这些值宣称速度相对旧版提升。

实机截图：

- [实际亲征开战](../web/dev-tools/electron-bridge/68db2db1-ee49-4e03-9222-f32b8dada759/personal-campaign-battle.png)
- [田野村落](../web/dev-tools/electron-bridge/bbc77cac-b8e4-4473-b70b-5c2ea57e02b6/terrain-verdant.png)
- [水乡场景](../web/dev-tools/electron-bridge/bbc77cac-b8e4-4473-b70b-5c2ea57e02b6/terrain-wetland.png)
- [关栅场景](../web/dev-tools/electron-bridge/bbc77cac-b8e4-4473-b70b-5c2ea57e02b6/terrain-verdant-fort.png)

关键失败证据完整保留：原生启动时序探针、旧粗射线526.94偏移、DDA编写时语法错误、被前坡遮挡的假设纠正、农田候选被高度/森林条件挤空。根因排查技能促使补上窄脊与遮挡反例；没有放宽旧闸值、超时或添加豁免。

## 与《全面战争：三国》的差距

这一轮提升了地形结构、立体感、操作可靠性，**不等于达到全战级画质**。当前仍是轻量WebGL与原创低多边形地物，没有高精PBR植被/建筑资产、级联实时阴影、完整LOD美术链、大规模城防破坏或全战级军阵动画。

林地/坡度/桥渡影响已进现有战术逻辑；村舍/关栅仍为环境地物，不能宣称已实现房屋碰撞、绕屋寻路或攻城AI；也没有把原来可涉水的地形改成不可通行障碍。后续若按AAA方向推进，应独立制作高品质资产和渲染样板，再按低配/中配/高配分档验收，不能靠继续加密当前烤图兑现。

## 重跑

```text
node scripts/run-office-verification.cjs terrain-world web/scripts/smoke-battle-terrain-world.js
node scripts/run-office-verification.cjs terrain-native scripts/verify-electron-bridge.js --tactical-terrain
node scripts/run-office-verification.cjs terrain-campaign scripts/verify-electron-bridge.js --personal-campaign
node scripts/run-office-verification.cjs terrain-full web/scripts/ci-smokes.js
```

全量smoke独立运行，不与原生画面/架构等重型验证并发。场景和过程记录由文件规划保存；原生图片是实际运行截图，不是概念图。
