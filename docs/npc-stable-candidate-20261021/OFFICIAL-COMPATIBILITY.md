# 另外两部官方剧本：生产模块兼容范围

## 结论

天启七年、晚唐开成五年的正式脚本懒加载、同步开局、完整人物与地图、活动条件读口、保存结构与恢复字段检查通过。它们没有完成正式按钮试玩、顶层 `endTurn`、三十日连续运行或 Electron 存档加载；这些不得用本报告替代。

绍宋原始开局另有只读诊断：当前树无需给韩世忠补 `publicIdentity`，即可从已有剧本关系识别同地联系人及可用材料。主绍宋正式组合试玩由独立 Electron 门禁负责。

## 命令与证据

```text
node --expose-gc docs/npc-stable-candidate-20261021/check-other-officials.cjs
node --expose-gc docs/npc-stable-candidate-20261021/check-other-officials.cjs --case shaosong
```

- `official-compatibility.json`：两个剧本的加载数量、真实活动 ID、在途消息、职责读口、保存字节数、重复提交与恢复检查、耗时。
- `official-runtime-tianqi.json`、`official-runtime-tang.json`：实际 VM 编译的生产源码逐文件 SHA-256；报告引用聚合摘要。另列官方脚本 manifest hash，未用旧主线测试数字。
- `official-compat-tianqi.log`、`official-compat-tang.log`：实际子进程日志。
- `initial-shaosong-contact.json`：原始绍宋同步开局的联系人、同地可递送条件与材料读口诊断。

## 实际检查

| 剧本 | 保留的正常数据 | 读口与入口样例 | 职任边界 |
| --- | --- | --- | --- |
| 天启七年 | 217 人、22 势力、307 地块；163 人能解析到精确地点 | 魏忠贤与黄立极，`ming-01-p01`，原有关系可产生真实通问请求 | 魏忠贤有两项实际职位；旧配置为 `legacy_unspecified`，不能声称验证了有驻任许可的外出 |
| 晚唐开成五年 | 142 人、42 势力、575 地块；53 人能解析到精确地点 | 嗢没斯与㕎馺可汗，斡耳朵八里，原有关系可产生真实通问请求 | 该参与者当前读口无适用职任；不据此宣称全部晚唐岗位均具完整外出制度 |

没有移动人口、删除其他人物、增加公开标记或预填活动结果。无法精确定位的其他人物保留原始资料，不以同城假设掩盖未知地点。

使用实际 `TMOfficialScenarioLoader.ready/ensure` 读取清单内完整脚本，并校验字节数和 SHA-256。使用原有全加载 headless 设施加载正式脚本，调用真正的 `doActualStart` 同步构造；活动经 `DailyActivities.submitNPC` 建立，保持在途，未手填送达、同意或完成。

保存兼容使用真正的 `_buildSaveState({format:'idb',prepare:false,detach:true})`，以 JSON 作为传输，再调用 `_restoreSavedFields`。检查对象已替换、旧 ActionLedger 租约失效、人口和地图保持、原消息及凭据存在、同 actionId 不产生第二份活动。旧岗位缺少 ID 时，恢复可补齐已有确定性身份；明确 ID 不可改变，重复恢复不再改写身份。这里没有写入 IndexedDB，也没有执行正式菜单 `fullLoadGame`。

## 环境与失败分类

最初试图复用完整存档 barrier 时，现有 headless harness 的 IndexedDB 实现只返回 `stub·no-idb`，导致真实等待超时。证据保留在 `official-compat-tianqi-first.log`。这是本夹具不提供浏览器存储，不是生产存档故障。后续检查因此明确缩至保存结构/恢复字段，不把 JSON 恢复宣传成正式读档通过。

`Audio is not defined` 同样来自无音频对象的 headless 环境。最终子进程退出状态为 0，仍保留这些环境日志。最初职责全等断言还遇到旧岗位稳定 ID 的正式恢复迁移；`official-compat-tianqi-second.log` 保留差异。现断言逐项保留职责，只允许缺失 ID 被规范化，并检查迁移可重跑。

## 模型与世界边界

本检查拦截模型调用并记录，两个剧本的实际模型尝试均为 0。官方脚本资源请求由同路径磁盘字节代替 HTTP，未调用外部服务。沿用原启动 smoke 的界面/音频及后台模型预热替身；没有运行全世界回合。因此不能据此声称完整世界离线，也不能用这里的耗时代表正式过回合性能。

此脚本位于交付目录，没有新增 `smoke-*` 自动发现项，以保持正在运行的全量门禁名单稳定。本报告不声称它已经成为远端 CI job。完整组合门禁及其运行身份见主报告。
