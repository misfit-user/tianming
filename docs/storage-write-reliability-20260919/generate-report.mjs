import fs from 'node:fs';
const dir='docs/storage-write-reliability-20260919',v=JSON.parse(fs.readFileSync(dir+'/verification.json','utf8'));
if(!v.testsComplete||!v.ownDiffClean||v.scopedDiff.exit||v.files.some(f=>!f.hashMatches||f.syntax)||v.qualityChecks.some(q=>!q.ok)||v.failures.length||v.newArchitectureFailures.length||!v.browserCurrent||!v.browser.outcome?.ok)throw Error('Verification not closed');
const total=v.newTests.reduce((n,t)=>n+JSON.parse(t.detail).pass,0);
const text=[
'# 天命：主存档写入、压缩与校验的可靠性收口',
'## 本轮结果',
'本轮补齐主库写事务及存档压缩、解压和校验的有界等待。重要区别是：超时后先请求中止，并等待真实终态；结果仍未确认时暂停本页继续写入，不当作保存成功，也不直接回滚并重试。普通 LLM 与独立 Agent 的推演、正文和质量门槛没有缩减。',
'项目：`C:\\Users\\37814\\Desktop\\tianming`。设备：LAPTOP-AV4J1O7I。分支：`'+v.branch+'`。开工和结束 HEAD：`'+v.head+'`。核验：'+v.at+'。',
'未调用付费 AI API，未读取或修改玩家实际存档，未安装依赖、提交、推送、打包或部署。浏览器验证使用此次创建的独立配置目录和合成存档，不使用日常浏览器配置。',
'## 一、写入结果不再靠超时猜测',
'主库单槽写入、双槽原子写入、通用记录、批量迁移写入和删除共用事务监视器。默认写入等待 60 秒；到期请求 abort，并最多再等待 5 秒确认终态。实际 oncomplete 才作为提交，实际 onabort 才作为已中止；请求层 error 本身不触发新一次写入。',
'正常慢写在期限内提交仍保留全部内容。中止等待期间若收到真实完成事件，接受该真实提交一次；如果事务确实中止，按失败处理并允许后续正常重试。配额回收与重试仍只按原有受保护槽位规则执行，且必须在中止已经确认之后。',
'若中止无法执行或终态始终不到，报告 SAVE_WRITE_UNCONFIRMED，并阻止本页继续写入。当前回合不自动回滚、不启动响应重放、不刷写桌面自动档，也不丢弃分卷暂存。界面提示“存档待核对”；后续应重新打开游戏并核对完整存档和恢复点，本轮没有实现对不明结果的一键自动对账。',
'迟到终态会记录诊断，但不会在已退出等待的旧调用上再通知提交或自动开启新一轮写入。该保护针对当前页面；重新打开后的数据读取仍按既有存档/恢复逻辑执行。',
'## 二、完整存档压缩与校验',
'压缩、解压和 SHA-256 等待默认以 60 秒为阶段期限。压缩变换采用可取消的流读取，正常输出完整 gzip 内容。压缩失败或超时沿用完整原始 JSON 保存，不删字段、不截正文；代价可能是存档占用更大，空间不足时仍必须报错。',
'解压或校验无法完成时返回明确错误，不使用半截文本、空对象或临时弱校验值冒充成功，也不会进入依赖该结果的写事务。正常 gzip、未压缩字符串与旧 UTF-8 存档兼容路径已核验。',
'这些是异步阶段时限，不是整个回合时限；浏览器主线程阻塞和系统挂起可能延迟计时事件。无法取消的底层操作即使迟到返回，也不会重新推进已经失败的保存调用。',
'## 三、不降低推演质量的证据',
'普通 LLM 主推演、独立 Agent、回合有效性、模式契约、管道步骤、上一轮响应恢复、AI 传输及时间快照共九个运行时文件保持开工时的哈希。主存档构造、公开保存协议、旧源迁移、打开/只读查询和最终化/正文渲染等关键函数也做了逐函数对照。',
'本轮改变的是写事务失败边界和二进制流的等待方式，不减少模型提示词、输出预算、推演阶段、记忆类型、正文或业务校验。遇到存储结果不明时暂停，是为了避免重复结算或覆盖；不是把失败改成表面成功。',
];
text.push('## 四、验证结果');
text.push('| 检查 | 结果 |\n|---|---|\n| 开工同范围专项 | '+v.baselineTests.pass+'/'+v.baselineTests.selected+' 通过 |\n| 最终同范围及新增专项 | '+v.finalTests.pass+'/'+v.finalTests.selected+' 通过 |\n| 新增内部场景 | '+total+' 组通过 |\n| 扩展回归 | '+v.extendedTests.pass+'/'+v.extendedTests.selected+' 通过 |\n| 质量边界对照 | '+v.qualityChecks.filter(q=>q.ok).length+'/'+v.qualityChecks.length+' 通过 |\n| 实际 Edge 浏览器 | '+v.browser.outcome.results.length+' 项检查通过 |\n| 本轮 '+v.files.length+' 个文件的语法、哈希及差异检查 | 通过 |');
text.push('新增用例包括真实中止前不重试、写入超时、迟到终态、部分 put 抛错、手动保存和删除、回合暂停与禁止错误回滚、完整中文 gzip 往返、压缩取消、解压和校验超时、原有旧档兼容等。旧测试的事务桩补上真实 onabort 事件，断言仍要求整体不部分提交；没有降低存档或内容断言。');
text.push('实际浏览器为 '+v.browser.version.product+'，在独立新建配置目录中通过本地回环地址运行合成数据，不使用日常浏览器或玩家数据库。验证了原生 CompressionStream、完整双槽存取、单次提交通知，以及第二个槽位写入异常时的原生事务整体中止。最初虚拟时钟测试触发提前超时，最终改用真实时钟重新验证；原记录保留，没有修改生产期限使该测试通过。');
text.push('浏览器测试不包含真实付费模型推演、游戏全部 UI、手机真机或 Electron 完整长局。源码级故障测试采用可控数据库事件与时钟；实际浏览器测试补充了正常压缩/读写和原生中止验证，不能据此推算真实玩家整体成功率。');
text.push('扩展回归未通过项：`'+v.extendedFailures.join('`、`')+'`。仍是此前存在的启动清单契约：实际 420 个脚本，要求 436 个。本轮没有改入口或降低断言。不同范围的通过数量不能理解为全仓测试数量。');
text.push('架构检查仍失败于 `'+v.architectureFailures.join('`、`')+'`，与本轮基线类别一致，没有新增失败类别。未提高文件体积基线或添加豁免，整仓尚不能视作发版全绿。');
text.push('## 五、范围与后续边界');
text.push('本轮覆盖主要存储写事务、删除、迁移批量写入和压缩/解压/校验等待。没有实现所有外部 IPC、历史数据库打开迁移、持久化跨刷新响应恢复或不明结果的自动对账。旧外部桥接若完全不响应，仍需独立验证。');
text.push('新增期限不会保证系统卡死时准点触发。压缩回退可能增加磁盘占用，事务结果不明时也可能需要重新打开核对；这两种情况均不会冒充完整成功。正常推演质量保持的证据来自源码边界和存档内容验证，尚无真实模型长局对照数据。');
text.push('## 六、文件与证据');text.push(v.files.map(f=>'- `'+f.file+'`').join('\n'));
text.push('证据目录：`docs/storage-write-reliability-20260919/`。关键文件：baseline.json、changes.json、final-tests.json、extended-tests.json、final-architecture.log、verification.json、reproduced.json、browser-realtime-result.json、browser-test.html。实际浏览器使用的存储模块副本 SHA 与最终源码匹配。');
text.push('修改前备份：`.bak-storage-write-reliability-20260919/`。继续修改前核对 SHA，不重复运行已应用补丁，也不整目录还原覆盖其他窗口修改。');
text.push('技术依据：W3C Indexed Database API 3.0 的事务生命周期、提交与中止定义（`https://www.w3.org/TR/IndexedDB/`）；MDN ReadableStream.pipeThrough 的流传递与取消接口（`https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/pipeThrough`）。时限数值是本项目的实现选择，并非标准规定。');
fs.writeFileSync(dir+'/README.md',text.join('\n\n')+'\n','utf8');console.log('Report written:',dir+'/README.md');
