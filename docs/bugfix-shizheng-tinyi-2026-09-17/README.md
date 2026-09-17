# 御案时政直达廷议：本地修复与验证记录

## 范围

设备：LAPTOP-AV4J1O7I。
工程：C:\Users\37814\Desktop\tianming。
修改开始时 HEAD：5ed032afe65cc041dd4d890227ada23e736b4713。
工作区已有大量未提交修改；本次未切换分支、未重置、未提交、未推送、未打包或热更。
本记录不是安装版游戏已更新的证明。

## 根因与补丁

`web/tm-shizheng-panel.js` 的 `_shizhengConvene` 直接调用筹备入口，没有先创建朝议宿主。
原 `_ty2_startSession` 先扣 15 精力并移除筹备窗，再访问不存在的 `cy-body.innerHTML`，随后抛错。
`regression-before-final.log` 记录了原代码的缺失宿主和空 DOM 异常。

运行时代码仅修改 `web/tm-shizheng-panel.js`、`web/tm-chaoyi-tinyi.js`。
直达入口先确保朝议宿主完整、可见，再打开筹备窗；同步预填议题并通过既有 `_ty2_pickPending` 传递元数据。
首屏渲染成功后才扣费；缺失/隐藏宿主、渲染异常、扣费异常等失败保留筹备与议题，并恢复精力快照。
增加重复开议保护；成功后才消费对应待议题；取消与前置校验失败不会扣费。
不调整廷议定价、官员资格、议事规则或其他系统。

## 已执行验证

所有已执行命令均在上述电脑运行，不是 ChatGPT 沙箱结果。
新增 `web/scripts/smoke-shizheng-tinyi-entry.js`：最终 16/16 通过，见 `regression-final.log`。
专项覆盖成功仅扣一次、缺失多个宿主节点、隐藏窗口、精力不足后重试、渲染失败、扣费写口异常及队列保留。
相关回归选择 tinyi、chaoyi、modal-layer：20 个脚本全部通过（含专项），见 `related-smokes.log` / `related-smokes.json`。
该批回归之后，将跨文件直接赋值改为复用 `_ty2_pickPending`；最终专项 16/16 已在此最终版本重跑。
`git diff --check` 针对两个运行时文件和新增测试返回退出码 0。

架构守卫不是全绿：修改前后均有 5/13 失败。
失败项为 lint-dep-graph、lint-global-providers、lint-file-size、lint-split-contracts、ref-check。
对 `arch-before.log` 与 `arch-final.log` 去除耗时、正常新增全局函数计数后，诊断文本完全一致。
未放宽守卫、未更新守卫基线、未处理这些无关既有问题。

## 验证边界

专项加载真实入口、会话和精力函数，但 DOM 使用测试替身，布局和 AI 循环隔离。
独立 Electron 图形验收脚本的写入被工具安全检查拦截；该脚本没有创建，图形验收未执行。
后续追加的独立复现及再次批量回归组合命令同样被拦截，不计入已完成验证。
未打开或修改玩家存档，未消耗真实游戏精力，未使用真实 AI 凭据。
因此结论为：本地源码补丁已落地、专项通过；真实游戏窗口的端到端点验尚未完成。

## 恢复与文件

修改前两个源码的逐字节备份目录：
`web/.bak-shizheng-tinyi-2026-09-17T07-43-29-579Z/`。
恢复时应先检查后续是否又有修改，不要盲目覆盖。
当前补丁没有 Git 提交哈希；上述 HEAD 只是开工基线，不是新提交。
从该源码工程启动的游戏需重新加载相应脚本；单独安装版不会自动获得此补丁。
