# 战术地图第二阶段 · 近景、投影与寻路

本轮在 `E:/tianming-office-writeback` 完成本地实施与隔离验收。保留前轮地形、亲征和自动存档修复；没有提交、推送、合并、部署、打安装包，版本仍为1.3.4.11。没有读取玩家API密钥、使用玩家存档、购买或下载第三方美术资产。

## 实施范围

### 通行与指挥

- 旋转房屋、关栅和大石块进入障碍几何；河道深水和海面不可直接穿过，桥梁与浅渡是通行点。
- 网格A*、连续线段扫掠和对角防切角共同负责路线安全；每步限制新求路数量，缓存有上限，不为大量部队无限搜索。
- 行军、追击、散兵后撤、溃逃及战斗推挤接入同一移动边界；援军先落在有效陆地入口，散兵沿军阵轨迹绕障并在桥渡收窄横向目标。
- 四个来敌方向按实际己方区域布阵，修掉原先写死“河流南侧”的放置限制；敌方区域不能被拖入。
- 显示真实路线及调整后的落点。无路时停步、只提示一次；计算预算不足明确提示分段下令，不伪称已证明无路可达。

### 近景与渲染

- 新增可编辑程序模型源：树干分枝、镂空叶簇，瓦面、檐梁、木构、窗棂、基础，石块与关栅；三个LOD档均有几何预算检查。
- 同类地物实例化绘制，近处使用细节模型、远处降几何；材质补木纹、瓦缝、灰墙和叶片变化。
- 地形与地物采用两级深度投影，并保留地表细节光照。投影能力/帧缓冲不可用时明确回退，不把缺扩展变成黑屏。
- 设置增加“均衡 / 精细 / 省电”和独立投影开关。省电档使用远景LOD并释放阴影纹理。
- 显卡上下文丢失时退回二维地图；恢复后重建地形、投影和兵模，旧异步兵模回调以GPU代次失效，兵额不变。

本机未连接Blender接口，PATH和常规安装目录未找到Blender，因此本轮采用可编辑程序资产与原游戏WebGL管线，没有声称导出了Blender高精模型。文件规划将工作分成通行、表现、实机和总回归，分别留下证据。

## 验收证据

| 验收 | 结果 |
| --- | --- |
| 导航契约 | 18项通过（最终全量套件复验）；包括四向过河/布阵、旋转房屋、窄连接、防穿透、无路/预算区分、溃逃与非法坐标 |
| 资产与投影契约 | 23项通过；三档LOD/法线/尺寸/确定性和缺深度纹理回退 |
| 第二阶段真实Electron | 21项通过：`web/dev-tools/electron-bridge/cf3a5bbe-3efb-4517-8524-45121f2f9cbb/report.json` |
| 六种地貌真实Electron | 29项通过：`web/dev-tools/electron-bridge/e9523965-8cbc-4e1d-bcaf-baaaa14d939d/report.json` |
| 亲征往返 | 最终19项通过：`web/dev-tools/electron-bridge/14877a0a-73e1-4078-a05f-57c29b18cacd/report.json` |
| 架构守卫 | 13/13：`battle2-final-arch-9aa34166-fb59-4797-8322-50d8162d70fd` |
| 官方剧本对账 | 27项：`battle2-official-parity-03f3ad5b-30c2-4310-bd82-9aa376372d66` |
| 发布契约 | 166项：`battle2-release-contract-7840d961-76fc-4e07-a8b0-bd514d0e657c` |
| 同版基线 | 最终check通过1110项/assets367；本轮新添5个JS模块，删除0；回执`battle2-baseline-accepted-7f01e89a-0f86-4d42-b1ee-a8f05ad9aa83` |
| 全量smoke | 958/958，零失败/跳过/豁免/可疑退出；`web/dev-tools/arch-guard/ci-OdSXMy/smoke-report.json`，回执`battle2-full-suite-recheck-bd26be71-c68d-4858-8585-69f6919ef124` |

命令回执目录均为 `web/dev-tools/office-writeback/`。原生验收是原生产main/preload与实际战场iframe，使用独立用户目录并禁止外网；没有修改玩家正在使用的客户端。

实测样本中，生产 `moveUnit` 绕屋83步到达、最大单步14.79单位，过桥264步到达；部队和9个散兵均未进入障碍/深水。同场高画质模型不变时，投影开关造成296000采样像素中的54478个显著变化。该场近景地物精细档8330三角形、省电档1380，投影纹理由2048+1024两级变为释放状态。这些是本机样本，不是全设备帧率承诺。

最后一轮原生21项复验的近景树林精细档帧间隔中位34.9ms、P95为53.3ms；同高模阴影开关显著变化像素53723/296000，GPU上下文强制丢失后恢复成功、兵额不变。首次全量套件因`spawn UNKNOWN`中断的证据仍保留，单独通过的用例不能替代完整复验。

最后已用原命令、原8并发、原120秒期限完整复跑全绿；没有修改测试运行器、系统设置或豁免规则。首次进程启动异常根因未能从事后日志确认，不把它伪称为游戏逻辑缺陷或已证实的内存问题。

实机图片（不是概念图）：

- [瓦面木构与投影](../web/dev-tools/electron-bridge/cf3a5bbe-3efb-4517-8524-45121f2f9cbb/phase2-village-high.png)
- [近景枝叶与地面投影](../web/dev-tools/electron-bridge/cf3a5bbe-3efb-4517-8524-45121f2f9cbb/phase2-forest-close.png)

## 边界与下一步

这不是“达到《全面战争：三国》画质”的交付。本轮是更细致的原创程序资产、两级地形/地物投影和可用寻路，不是高精扫描/PBR美术库。兵模沿用原资源，尚未引入动态兵卒级阴影、建筑破坏/攻城AI、建筑遮挡下的完整弹道模拟或跨平台大军团长期压力验收。

固定历史战役仍沿原生成布局，新的寻路和精细地物重点接入程序战场；通用地形着色和GPU恢复同时服务战场渲染。发布后仍需真实玩家设备反馈才能评价所有配置的运行表现。

深度纹理格式、能力探测和帧缓冲使用依据 [Khronos WEBGL_depth_texture规范](https://registry.khronos.org/webgl/extensions/WEBGL_depth_texture/)，未引入运行时CDN依赖。

## 重跑

```text
node scripts/run-office-verification.cjs navigation web/scripts/smoke-battle-navigation.js
node scripts/run-office-verification.cjs assets web/scripts/smoke-battle-render-assets.js
node scripts/run-office-verification.cjs native-phase2 scripts/verify-electron-bridge.js --tactical-phase2
node scripts/run-office-verification.cjs native-terrain scripts/verify-electron-bridge.js --tactical-terrain
node scripts/run-office-verification.cjs native-campaign scripts/verify-electron-bridge.js --personal-campaign
node scripts/run-office-verification.cjs full web/scripts/ci-smokes.js
```

完整smoke应独占本任务的重型验证时段；不与原生画面或架构全扫并行，以免制造依赖检查的硬期限噪声。
