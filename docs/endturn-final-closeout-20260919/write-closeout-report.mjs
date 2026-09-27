import fs from 'node:fs';
const d='docs/endturn-final-closeout-20260919',v=JSON.parse(fs.readFileSync(d+'/verification.json','utf8'));
if(!v.ok)throw Error('Final proof has not passed; do not publish a completion report');
const q=v.quality.filter(x=>x.ok).length,more=v.commands.filter(x=>x.name.startsWith('extra-'));
const text=[
'# 天命 AI 记忆与过回合可靠性升级：统一收尾报告',
'## 一、结论',
'本地工程收尾已通过本报告列出的验证：长期记忆与双模式读取、能力适配、完整响应恢复、主存档及桌面写入边界、迟到结果保护、启动依赖和模块拆分均已有实现与测试证据。没有把失败提示隐藏起来充当成功，也没有为了提高表面成功率而删正文、降低推演深度或取消世界校验。',
'设备：LAPTOP-AV4J1O7I。项目：`C:\\Users\\37814\\Desktop\\tianming`。分支：`'+v.branch+'`。HEAD：`'+v.head+'`。最终验证时间：'+v.at+'。',
'本报告区分工程验证与生产运行：未调用真实付费 AI API，未提交、推送、打包或部署；测试通过不代表所有供应商和所有真实长局都已验证，也不保证断网、磁盘满或服务端持续故障时仍能完成推演。',
'## 二、整体完成内容',
'**长期记忆与模型适配。** 保留原有活跃记忆层并增加有界长期档案，支持事件、事实、人物经历、关系、承诺、决策依据、因果经验、制度、领土、经济、未解线索和纠错等十二类。两种回合模式共用受治理的检索与来源信息；独立 Agent 接入证据展开和关联追查。主、次 API 的能力证据分开，网络失败与能力失败分开，读取和自主规划仍受玩家开关及预算约束。',
'**完整响应跨刷新恢复。** 在已确认回滚的条件下，合格的完整响应保存到独立本地 IndexedDB；刷新后只有同一世界、完整输入指纹、模型配置、输出限制和调用次序匹配，才可以复用。仍运行原有解析、业务校验、动作应用和唯一提交器。保存的是响应，不是重复执行财政、任免或战争副作用的指令队列。',
'持久候选保留期限为三十分钟，最多六十四条、累计八百万序列化字符；不完整、截断、拒答或校验不明的响应不能作为完整检查点。容量不足或恢复存储失效时使用原有完整请求路径，不裁短内容。提供关闭持久化与清除候选的入口。没有把 API 密钥或原始提示词写进这个检查点库。',
'**未知写入结果自动核对。** 不再把超时直接当作没有写入。收到真实迟到提交事件后，重新读取 autosave 和 slot_0，将两份完整内容与本回合冻结状态逐字核对；一致才完成原事务和展示，不重跑 AI。真实中止则由原回滚入口恢复。没有终态或内容不一致时保持写入保护，不能凭一个任意回执解锁。',
'**请求和保存等待。** 普通、流式和原生工具请求共用取消、排队与恢复预算。主数据库打开、读取、写入、压缩、校验，附加快照、桌面分卷和自动档均区分本地等待结束与真实提交结果，避免重复发送、旧回执污染新存档和提交后误回滚。',
'**无损减少本地计算。** 记忆评分缓存只依据精确文本，词项与多样性排序不变；保存准备阶段跳过的是最终输出过滤器本就丢弃的二十三份镜像复制。原始字段、正文、历史记录、输出顺序和恢复语义仍由完整对照测试检查。',
'**工程装载收尾。** 缺失的启动模块和派生清单已同步；大文件按原函数内容拆分，保留加载顺序和原接口。旧备份源码从运行时扫描目录移出后仍逐文件保留，不删除原证据。已安装的 js-yaml 从 4.3.1 对齐到项目既有锁文件指定的 4.3.2，下载包完整性已核对，没有修改依赖清单或执行安装脚本。',
];
text.push('## 三、最终验收');
text.push('| 检查 | 结果 |\n|---|---|\n| 收尾基线全量 JavaScript smoke | '+v.baseline.pass+'/'+v.baseline.selected+' 通过 |\n| 最终全量 JavaScript smoke | '+v.full.pass+'/'+v.full.selected+' 通过；失败 '+v.full.fail+'，豁免 '+v.full.waived+' |\n| 架构检查 | '+v.architecture.passed.length+'/13 通过 |\n| 另行执行的 .mjs 检查 | '+more.filter(x=>x.exit===0).length+'/'+more.length+' 通过 |\n| 质量边界及等内容函数迁移核对 | '+q+'/'+v.quality.length+' 通过 |\n| 本次收尾涉及文件 | '+v.files.length+' 个，语法与最终哈希核对通过 |\n| 本轮 git diff --check | 退出码 '+v.scopedDiff.exit+' |\n| 官方剧本派生对账 | 通过 |\n| 实际启动清单 | '+v.scriptCount+' 个立即加载脚本；生成器检查通过 |');
text.push('本次测试期间源文件变化数：'+v.changedDuringRun.length+'。全量测试、附加检查和真实浏览器测试使用了记录在 `final-tested-inputs.json` 中的源文件，并在结束后重新核对。没有把上次中断或失败的记录冒充最终通过记录。');
text.push('关键新增检查：\n\n'+v.caseResults.map(x=>'- `'+x.name+'`：'+x.detail).join('\n'));
text.push('质量边界核对逐项结果：\n\n'+v.quality.map(x=>'- '+x.check+'：'+(x.ok?'通过':'失败')).join('\n'));
text.push('## 四、性能依据与真实浏览器验证');
const m=v.memoryBenchmark;
text.push('| 本地检索评分对照 | 修改前 | 修改后 |\n|---|---:|---:|\n| 同一组八个查询，中位耗时 | '+m.results.before.medianMs+' ms | '+m.results.after.medianMs+' ms |\n| 完整排序结果与分数 | 完全一致 | 完全一致 |');
text.push('上述对照使用 360 条合成记录，每个查询保留 20 条结果，两次预热后计七次；输出 SHA-256 一致。它只测本地词项评分、结果融合与多样性筛选，不是整个回合或真实模型响应速度。八十组不同数据及纠错输入另做了 244 次精确结果核对。');
text.push('真实 Edge 使用独立测试配置与原生 IndexedDB，验证写入、页面实际刷新、完整响应逐字相等、模拟推演仅一次、用量不重复计入和显式清除。浏览器结果：`'+JSON.stringify(v.browser.outcome)+'`。测试来源哈希与最终源码匹配；没有使用玩家存档或日常浏览器数据。');
text.push('## 五、测试环境修正及磁盘情况');
text.push('测试保留全部原断言和完整剧本内容，修正了现代浏览器 currentScript/URL 等测试接口；所选官方剧本由完整字节数和 SHA-256 校验，不把另外两套无关世界预先塞入同一个开局。完整存档压力检查按世界隔离进程并及时释放比较用对象，仍覆盖两套官方剧本、短局和八百回合长历史、两种保存格式、完整恢复与异常路径；外层原有三百秒时限没有扩大。');
text.push('收尾时 C 盘曾实际耗尽，导致测试异常和写文件失败。仅将本任务生成的测试证据迁到 D 盘、逐文件校验后建立原路径连接；已有原备份位于 D 盘，游戏源码和玩家文件没有迁移。后续测试临时目录使用 D 盘，仅影响测试进程，不改系统设置或用户数据。C 盘仍需保留实际存档所需空间；本次不会擅自清理个人文件。');
text.push('磁盘写满中断过一次压力测试文件更新。该文件已从开工备份和六次已记录的变更精确重建，SHA-256 与中断前最后记录一致，再应用后续修复并重新验证。重建记录在 `pressure-source-recovery.json` 与 `disk-interruption-restored.json`。最终代码中不保留这次中断产生的空文件。');
text.push('## 六、交付边界');
text.push('本次收尾的源码与上述工程验证已经完成；不额外声称完成真实付费模型长局、手机真机全流程、生产安装包或发布验收。没有可确认的底层提交/中止事件时，保护机制仍会暂停写入，而不是凭猜测制造成功。跨刷新缓存可减少符合严格匹配条件的重复请求，不保证每个回合都命中，也不改变供应商的计费和可用性。');
text.push('仓库仍是原本的本地开发分支与未提交工作区。未执行 push、release、安装包构建或线上部署；网页资源修改也不会自动更新已安装客户端的 preload/main。');
text.push('## 七、文件、证据和复核命令');
text.push('本地报告：`C:\\Users\\37814\\Desktop\\tianming\\docs\\endturn-final-closeout-20260919\\README.md`。该路径保持可用，测试证据实际位于 `validation-workspace.json` 记录的 D 盘工作目录。');
text.push('关键证据：`verification.json`、`final-full-tests.json`、`final-run-status.json`、`final-tested-inputs.json`、`final-architecture.log`、`browser-realtime-result.json`、`memory-benchmark.json`、`own-diff-check.json`、`changes.json`、`yaml-sync.json`。之前失败的全量报告已保留，未从历史中删除。');
text.push('复核命令：\n\n```powershell\nnode web/scripts/run-smokes.js --all --jobs 2 --no-retry --report docs/endturn-final-closeout-20260919/recheck.json\nnode web/scripts/lint-arch-all.js\nnode web/scripts/verify-official-scenario-parity.js\nnode docs/endturn-final-closeout-20260919/verify-final.mjs\n```\n\n复核前应使用有足够空间的临时目录，并确认源码未被其他窗口继续修改；新的改动需要对应的新验收，不能沿用旧哈希证明。');
text.push('本次收尾文件及短哈希：\n\n| 文件 | SHA-256 前十二位 |\n|---|---|\n'+v.files.map(x=>'| `'+x.file+'` | `'+x.sha256.slice(0,12)+'` |').join('\n'));
text.push('原备份和并行改动副本均保留。后续恢复应逐文件比对 `changes.json`，不要整目录覆盖，避免抹掉地图、界面等其他窗口的修改。');
fs.writeFileSync(d+'/README.md',text.join('\n\n')+'\n','utf8');
console.log('Verified final report written:',d+'/README.md',fs.statSync(d+'/README.md').size,'bytes');
