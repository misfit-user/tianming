import fs from 'node:fs';
const dir='docs/endturn-recovery-20260919',v=JSON.parse(fs.readFileSync(dir+'/verification.json','utf8'));
if(!v.testsComplete||!v.ownDiffClean||v.scopedDiff.exit||v.files.some(f=>!f.hashMatches||f.syntax)||v.qualityChecks.some(c=>!c.ok)||v.newFailures.length||v.newArchitectureFailures.length||v.manifest.exit)throw Error('Scoped verification not closed');
const cases=v.newTests.reduce((n,t)=>n+JSON.parse(t.detail).pass,0),b=v.benchmark.summary;
const text=[
'# 天命：保持推演质量的完整响应恢复',
'## 交付摘要',
'本批增加同一页面会话内的完整 AI 响应检查点。已确认回滚后，下一次重试只有在世界基线、模型配置、模式、请求正文和请求次序一致时才复用之前完整返回的内容。原推演流程、解析、业务校验、动作应用和事务提交仍然执行；没有将不完整正文、空字段或简报当成完整成功。',
'项目：`C:\\Users\\37814\\Desktop\\tianming`。设备：LAPTOP-AV4J1O7I。分支：`'+v.branch+'`。开工与结束 HEAD：`'+v.head+'`。最终核验时间：'+v.at+'。',
'本批未调用真实付费 API，未安装依赖、修改发布版本、清空存档、提交、推送、打包或部署。保留了工作区已有改动。',
'## 一、不降质量的具体边界',
'普通 LLM 主推演代码、回合有效性校验、模式契约和管道步骤文件与本批开工备份的 SHA-256 相同。Agent 的深度门槛、自检、系统提示词和回合提示词函数也逐函数对照一致。原请求超时策略、终止错误分类和未缓存请求执行函数保持原逻辑。',
'这些对照和测试证明本轮没有通过删除这些检查或改短提示词来提速；不等于已经证明所有真实模型在长局中具有完全相同的表现。其他本来存在的降级或恢复策略也没有被本批全部重写。',
'完整中文长正文和工具参数按原内容复用。缓存容量不够时跳过缓存，继续原请求；不会为提高命中率而裁掉回答。截断、过滤、拒答、未确认结束的流式输出不作为完整检查点。格式和业务合法性仍由原来的消费者重新检查。',
'## 二、已经实现的恢复路径',
'每次重试先比较点击时已有事务快照的指纹。仅忽略 busy 等四个已知运行状态/回滚诊断字段；不对玩家指令、世界事实或模型提示词做模糊匹配。再比较实际请求正文、模型配置、输出限制、结构约定与同类请求的调用次序。相同请求在一次推演中刻意调用两次时，仍保留两个独立回答，不合并成一次。',
'主请求完整返回后若后续发生已识别的暂时性网络/供应商故障，且整个回合确实回滚，已完成响应可以供本页面下一次重试匹配。普通 JSON、符合条件的原生 Agent 工具响应、已确认完整的流式正文均有对应入口。',
'缓存保存的是响应数据，不是扣款、任免、战斗等状态修改。重试时动作重新经过原有解析、校验及提交器；第一轮的动作已经回滚。通过核心函数模拟验证：失败后资源回到原值，重试完成后只留下本回合的一次净变动。',
'主请求在传输层被上下文缩减或兼容改写后，不会把改写后的响应记成原始请求的完整回答。缓存查找期间更改请求、模型、回合或存档也会触发失效或重新执行。',
'复用的 JSON 响应不再携带一份新的 usage 计费记录，避免把旧回答计为再次发生的付费调用；正文和工具参数不因此缩短。',
'## 三、何时不复用',
'已成功提交的回合、业务/质量校验失败、无法解析的结果、玩家取消、身份变化、尚未确认回滚和结果不明确的存档失败，都不会被直接判定为可恢复。尤其是当前存档入口的 false 返回可能有不同含义，本批没有把它一概理解为尚未落库。',
'换模型、改指令、改模式、改世界数据、切换加载对象、刷新或退出页面后，不复用旧响应。缺少可靠 SHA-256 支持时使用原有完整请求流程。命中策略偏保守，真实复杂回合中的时间戳、随机分支或新增上下文都可能使部分请求无法复用。',
'## 四、容量与使用',
'检查点只在当前页面内存保存，最多 64 个响应、累计 800 万序列化字符，单响应最多 100 万字符；匹配范围为首次保留后的 30 分钟内。请求指纹和整体状态指纹也各有限额。以上为字符限制，不是精确内存 MB 或 token 上限。容量不足只降低复用机会，不降低输出内容。',
'发生符合条件的失败后，提示会显示当前页面保留了多少份完整响应。回合耗时诊断增加“完整响应恢复”区域，显示复用数量，并提供“放弃本次复用，重新生成”。统计只显示安全元数据，缓存正文不导出到诊断或磁盘。',
];
text.push('## 五、验证结果');
text.push('| 检查 | 实际结果 |\n|---|---|\n| 本批开工相关回归 | '+v.baselineTests.pass+'/'+v.baselineTests.selected+' 通过 |\n| 最终同范围加新增测试 | '+v.finalTests.pass+'/'+v.finalTests.selected+' 通过，'+v.finalTests.fail+' 项失败 |\n| 新增两个测试套件内部场景 | '+cases+' 组通过 |\n| 质量边界源码对照 | '+v.qualityChecks.filter(c=>c.ok).length+'/'+v.qualityChecks.length+' 通过 |\n| 本轮 '+v.files.length+' 个源码、测试及清单文件 | 最终哈希与语法核验通过 |\n| 本轮范围 git diff --check | 退出码 '+v.scopedDiff.exit+' |\n| 派生启动清单一致性 | 通过 |');
text.push('质量对照：\n\n'+v.qualityChecks.map(q=>'- '+q.check+'：'+(q.ok?'通过':'失败')).join('\n'));
text.push('新增测试：\n\n'+v.newTests.map(t=>'- `'+t.name+'`：'+t.detail).join('\n'));
text.push('测试使用本地合成世界和模拟供应商响应。其中恢复集成测试直接执行源码里的回合核心、最终化及提交函数，但网络、部分引擎和存储由测试桩提供；不能冒充真实客户端完整长局。正文为空时原有门槛仍拒绝提交，复杂工具参数不会因为 JSON 序列化而被悄悄改成 null。');
text.push('唯一相关回归失败仍是 `'+v.failures.join('`、`')+'`。开工为 419 个启动脚本对契约预期 436 个；本批新模块接入并同步清单后为 420 个，原契约仍未关闭。没有降低该断言，也没有新增失败脚本。');
text.push('架构检查仍失败于 `'+v.architectureFailures.join('`、`')+'`，与本批开工的失败类别相同。没有新增失败类别，但并不等于整仓已经可以发布。没有重跑全仓所有 smoke，也没有对未测范围宣称全绿。');
text.push('## 六、受控提速对照');
text.push('| 同一个模拟故障场景 | 禁用响应复用 | 启用响应复用 |\n|---|---:|---:|\n| 两次尝试的实际 HTTP 请求总数 | '+b.controlCalls+' | '+b.recoveryCalls+' |\n| 三次模拟的耗时中位数 | '+b.controlMedianMs+' 毫秒 | '+b.recoveryMedianMs+' 毫秒 |\n| 完整主推演与正文内容哈希 | 一致 | 一致 |');
text.push('样例为两阶段请求，每次模拟 HTTP 固定延迟 50 毫秒，第一次正文请求返回 503。启用复用后主推演不必再生成一次，正文仍完整请求、输出和校验。这仅说明恢复机制能避免可匹配的重复生成，不代表真实游戏平均提速比例或玩家成功率。实际命中率仍取决于重试时状态和完整请求是否一致。');
text.push('## 七、未完成及使用边界');
text.push('本批完成的是当前页面会话内的完整响应复用，不是持久化跨重启的阶段恢复，也不是跳过状态重算后直接提交旧世界补丁。保存失败结果不明确时仍保持原有失败处理；没有新增“不完整正文先算完整过回合成功”的路径。');
text.push('未运行真实付费模型长局、手机真机、Electron 全流程或生产部署验收。正常回合的全面性能分析、整个调用依赖图重排、可靠的跨刷新恢复，以及存储提交结果核对，仍不能算作本批已完成。');
text.push('## 八、文件与证据');
text.push(v.files.map(f=>'- `'+f.file+'`').join('\n'));
text.push('证据目录：`docs/endturn-recovery-20260919/`。关键记录：`baseline.json`、`changes.json`、`baseline-tests.json`、`final-tests.json`、`baseline-architecture.log`、`final-architecture.log`、`manifest-check.json`、`own-diff-check.json`、`benchmark.json`、`verification.json`。');
text.push('开工备份：`.bak-endturn-recovery-20260919/`。后续改动前应先核对当前 SHA，不重复运行已应用补丁，不整目录还原备份覆盖其他窗口修改。');
fs.writeFileSync(dir+'/README.md',text.join('\n\n')+'\n','utf8');
console.log('Report written:',dir+'/README.md',fs.statSync(dir+'/README.md').size,'bytes');
