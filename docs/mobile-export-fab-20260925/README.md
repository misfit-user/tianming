# 手机导出位置与悬浮按钮归位

## 玩家行为

- 安卓存档副本、游戏内存档导出、剧本工坊、案卷包、旧版编辑器及项目导出，使用系统保存窗口选择文件夹和文件名。写入结束才提示成功；取消不落入浏览器下载，写入失败显示错误。
- 正式游戏左上时间栏：电脑右键、手机长按约 500ms，让暂停／设置悬浮按钮回到时间栏右下方，并清除拖动位置记忆。
- 拖动限制在可见舞台内；历史越界坐标、横竖屏及视口变化会重新限位；定时刷新不会打断正在进行的拖动。

## 接线与兼容

共享网页接口是 `TM.fileExport.saveJson(json, filename)`。安卓原生真源位于 `mobile/plugins/tianming-file-export`，通过本地 npm 依赖和 Capacitor 自动发现注册；正常安装依赖后按 `mobile/README.md` 的 `npm run sync` 流程同步。

选择文件夹需要包含该插件的新 APK。仅更新网页或 Capgo 内容无法给旧 APK 增加 Java 插件，旧壳会显示更新安装包的说明。桌面原生保存与浏览器下载方式保持原有分工。

原生端使用 Android Storage Access Framework 的 `ACTION_CREATE_DOCUMENT`；在工作线程写 UTF-8 和流式复制，成功结果在输出流关闭后返回。大 JSON 不放入待恢复 Activity 的 Bundle。

## 验证

- `node web/scripts/smoke-mobile-file-export.js`：10 组测试，覆盖字节与中文、脱敏、存档格式、取消、失败、并发、旧壳、桌面及三个入口加载顺序。
- `node web/scripts/smoke-mobile-scenario-export.js`：普通／强制剧本、案卷、批量字段和项目导出的真实函数行为。
- `node web/scripts/smoke-pause-fab-reposition.js`：加载真实长按桥，验证归位、手势取消、边界、缩放、持久化与拖动。
- 原有剧本工坊回归：2274 条断言通过；原有返回启动界面回归通过。
- Chromium 149 手机视口验证：9 组通过，使用生产 fixed-fit、悬浮按钮、长按桥脚本，覆盖真实拖动、右键、触摸长按、重载和横竖屏，浏览器运行错误为零。结果及截图见同目录。
- 架构守卫 13 项全部通过；官方剧本派生对账 41 条断言通过；启动阶段与原生运行时清单重生成后检查通过。
- 全量首轮：1090 PASS、2 项已登记的缺资产豁免、3 FAIL。新增导出脚本的登记遗漏已修复；隔离目录的 npm 依赖检查异常及晚唐开局 60 秒超时，已在原工作区按原时限单项复核通过。最终六项复测 6 PASS / 0 FAIL；没有将首轮结果改写成全绿。
- 原生 Gradle `compileDebugJavaWithJavac`、SDK34 真实类路径 javac、Capacitor 自动注册均通过，未打 APK。完整结果见 `verification.json` 和 `native-evidence/`。

## 交付边界

这是本地功能修改，未打包、推送或发布。版本号及热更基线保持原值。发布契约及基线检查已执行，因这次 12 项源码／清单变化而被旧热更基线拦截；正式发版时需要按 `scripts/release.js` 流程 prepare，再完成发布门禁。

尚未使用实体 Android 手机验证系统文件选择器、厂商文件管理器及后台进程恢复。浏览器手机视口测试不能替代这一项。
