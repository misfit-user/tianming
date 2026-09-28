# 晚唐人物本地修改：并发保护

2026-09-17 17:51：本轮重连检查发现 history-0.ndjson 至 history-3.ndjson 正由另一组远程调用持续写入。为避免覆盖正在进行的资料导入，本轮保留这些文件，不重写、不执行未完成的数据包。

当前本轮先负责人物官职显示去重：web/tm-office-system.js 的显示选项，以及 web/tm-renwu-tuzhi.js 的显示读取。准备及验收脚本使用 ui-dedupe-* 文件名。保留官职机制 getter 的默认行为，不修改官职领取、任免或存档。

后续资料导入请保留上述 UI 增量；若同文件哈希发生变化，应重新读取合并，不从旧备份覆盖。根剧本及派生物每次写入前仍需检查当前哈希。禁止 git reset/push/发版。

17:58 更新：UI 去重已经写入两处正式文件，21条新增断言与20条既有断言通过，ui-dedupe-installed.json 保存安装前后哈希。默认 _offGetCharOfficeTitles(ch) 的机制行为不变；显示调用使用第二参数 {displayOnly:true}。

已独立从本对话挂载的执行稿提取并核对导入数据：81人的事实字段、原文、来源链接和353人的技能映射全部匹配（H013分清全文和另列的开局裁剪片段）。ui-independent-input-check.json 已通过。

正在准备基于这些输入的正式人物页隔离验收。请资料导入任务保留 UI 去重改动；后出的原文放独立史家资料层，勿直接写入角色记忆。写入正式源/派生前检查当前哈希，不覆盖同时进行的绍宋或易主修复。

18:09 核验：晚唐真源已写入 d7c76bf8310884ebdc6f29327cf9e3e8efdf3b9b8a9704c34cecfe0fdbcde373；史料 UI 已在我先前去重增量之上应用。注意，绍宋真源由并发任务在17:51左右改为51e9ca52808cbc2b0ae205e5f6569f3142620c5ba32eab3a082606a09c313a04；天启未变。verify-content.py最后的“其他剧本不变”断言因此失败，禁止恢复绍宋旧备份。晚唐内容与UI此前的写入脚本均只定向修改晚唐及通用显示，不包含绍宋根JSON写入。

本轮现在准备执行唯一官方生成器同步当前三份真源，并用 ui-full-scenario-electron.cjs 验证真实晚唐开局、全部81史料页、兼衔不占中央席位和存档快照保留。ui-dedupe-electron.cjs的真实生产主程序/预加载/界面8项测试已通过；旧档重复官名显示回归通过。

真实官方开局验证发现阻断（runtime-full/report.json）：434人已正确进入正式游戏，郑肃/杜悰/崔龟从主职与河中任所正确，但引擎把崔龟从“权判吏部尚书铨事”错误匹配为实授“吏部尚书”，自动占位。不能只靠JSON静态验证。当前本轮正在追查通用官职匹配规则并做有界修复，保持这条断言，不放宽测试；资料/UI导入请不要覆盖 tm-office-system.js 的正在进行的增量。

18:26 真实开局再次定位：tm-patches-start.js 1907行优先用 GM.facs中的 faction.officeTree 覆盖总树，导致只更新 root.officeTree/officeRegistryByFaction 还不够。新三人仍取旧的势力内官制副本，之前恰被错误模糊匹配“补”上。当前本轮将按相同稳定官位ID把三条已校任职同步到 factions[*].officeTree（只这些3职位，不动其他势力数据），并保留未知职位不自动猜人的规则。最终 source SHA会因这3条镜像修复改变，请验证器改为逐路径保护而非声称整个 factions 顶层完全未变。禁止回滚并发绍宋。

18:30 实际进展：已同步 factions[1].officeTree 的三条职位9个字段，最终晚唐源SHA为 eac33ec4a1af95c8c9514f1399155ff2c52d3255c20d20d9af59a5e48bd91f28，生成器已同步。上一轮全流程新开局已通过434人、三职任命一致且不误占中央席位、81史料记录、79原文/2待核、后事不进记忆/AI、虚构无假引文。仅最后截图被正常的“临朝第一日”首次帮助遮挡；已在隔离测试中通过正常关闭按钮收起帮助，正在重跑，保留可见性断言，不修改正式游戏帮助功能。

ui-final-verify.py 按9个精确字段检查 factions 镜像，其余势力数据逐对象比较不变。旧verify-content.py现在须考虑这笔已记录的必要镜像改动，不应按旧的整个factions不变断言误判或回滚。

最后补到兼任丢失根因：_offAddCharOfficeTitle(ch, sameMain, {concurrent:true}) 原先因 currentMain===title 落入替换分支，清空全部兼任，导致郑肃等人新开局只剩主职。已改为 concurrent且已有主职即幂等合并，显式非兼任调职仍正常替换。41条新增断言、原20条多官职断言通过；最新 full Electron 测试增加郑肃、李固言、崔龟从的每项真实兼任保留断言。请保留 ui-import-installed.json 记录的最新 office-system 增量。
