# 原始运行记录已移出主干

这个目录原先连同 607 份原始运行记录一起入库（逐回合时间线、浏览器日志、截图、守卫与冒烟输出，
共 66MB，其中 271 个 `.log`），占了整个 `docs/` 的一半以上，每个工作区检出都要带一份。
2026-11-15 起主干只留本目录下的十四份文字报告；报告里指向子目录的链接因此点不开。

原始记录没有丢：

- 在 git 历史里：`git show 836f737e:docs/npc-stable-candidate-20261021/<路径>`，
  或 `git archive 836f737e docs/npc-stable-candidate-20261021 -o evidence.zip` 整包取出。
- 仓主本机另存了一份压缩包：`E:\tianming-archive\npc-stable-candidate-20261021-evidence.zip`。

以后的验收证据照此办：结论和报告进库，原始日志、时间线、截图留在本机或 CI 产物里，不进主干。
