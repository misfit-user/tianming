import fs from 'node:fs';
const dir = 'docs/api-wait-compatibility-20260920';
const v = JSON.parse(fs.readFileSync(dir + '/verification.json', 'utf8'));
if (!v.ok) throw Error('Final verification must pass before writing the completion report');
const testLines = String(v.compatibilitySuite.output).trim().split('\n');
const cases = JSON.parse(testLines.at(-1));
const blocks = [
'# 天命 1.3.5.1 慢响应兼容修复：最终验收',
'## 结论',
'本次本地源码修改及本报告列出的工程验收已经完成。恢复成功响应头之后继续等待完整内容的默认语义，同时保留取消、切档隔离、完整性校验和原有世界提交约束。没有通过截短正文、降低模型推理能力或吞掉主推演错误来提高表面成功率。',
'项目：`C:\\Users\\37814\\Desktop\\tianming`。设备：LAPTOP-AV4J1O7I。分支：`' + v.branch + '`。HEAD：`' + v.head + '`。最终核验时间：' + v.at + '。',
'本轮没有提交、推送、打包、发布或部署，也没有调用玩家的付费 API。玩家手里的旧安装包和已部署网页不会自动取得本地源码修复。',
'## 一、默认等待行为',
'排队与真正发送后的首响应等待分开。请求收到成功 HTTP 响应头后，撤销首响应期限，继续等待完整 JSON 或流式正文。后续完成后，仍经过原有解析、必要字段、正文和世界状态校验，全部满足才允许提交。',
'默认不再用原 150 秒首响应期限、共享重试预算或隐藏的 Agent 总时间，截断一个仍可能完成的成功响应。长等待会提示真实状态，不自动重发、切模型、缩减正文或跳过当前阶段。明确错误响应没有被当作成功响应无限等待。',
'同时修复自动输出设置与最终流式入口的不一致：最终请求可以合法省略输出上限字段，不再因 max_tokens 缺省而在发送前报错；明确填写的非法数值仍拒绝。不在传输层偷偷补一个小上限。',
'## 二、玩家可以分别设置',
'| 设置 | 0 的含义 |\n|---|---|\n| 排队最大等待 | 不设强制排队期限 |\n| 发送后的首响应等待 | 使用现有按调用类型计算的自动期限 |\n| 完整响应最大等待 | 不设强制完整响应总期限 |\n| Agent 回合总时限 | 不设隐式总期限，轮数和调用次数限制仍保留 |',
'主、次 API 的等待设置分别保存。玩家明确设定的总上限仍然有效。Agent 的工具调用额度、轮数、深度门槛与语义提交规则保留，不等于无限开新调用。',
'## 三、取消和安卓边界',
'取消、切档和模型配置身份检查保留。等待中的旧请求不能向新世界发布结果；明确取消不能被通用网络重试当成再发一遍的理由。流式和原生工具入口也有同样的区分，不只修改普通 JSON 请求。',
'安卓原生桥接只返回整包结果，没有首响应头事件。本轮保留原生连接检查，推演的正文读取默认不设硬期限；玩家显式上限仍执行。模型列表和能力探测等请求保留自身有限等待。安卓部分验证使用原生桥接模拟及安装源码核对，并非安卓真机。',
'本地取消不保证供应商已停止计算或停止计费。代码只负责不采纳迟到结果、不自动重复发送相同失败操作，不能代替供应商的取消协议。',
];
blocks.push('## 四、最终验证结果');
blocks.push('| 检查 | 实际结果 |\n|---|---|\n| 开工相关专项 | ' + v.baselineSpecialist.pass + '/' + v.baselineSpecialist.selected + ' 通过 |\n| 断线前扩大回归 | ' + v.earlierExpanded.pass + '/' + v.earlierExpanded.selected + ' 通过 |\n| 恢复连接后的最终全量回归 | ' + v.full.pass + '/' + v.full.selected + ' 通过，失败 ' + v.full.fail + '、跳过 ' + v.full.skipped + '、豁免 ' + v.full.waived + ' |\n| 新增等待兼容场景 | ' + cases.pass + '/' + cases.total + ' 通过 |\n| 架构检查 | ' + v.architecture.pass.length + '/13 通过 |\n| 质量边界对照 | ' + v.qualityChecks.filter(row => row.ok).length + '/' + v.qualityChecks.length + ' 通过 |\n| 真实 Edge HTTP 与设置验证 | ' + v.browser.outcome.checks.length + ' 项通过 |\n| 本轮文件语法与最终哈希 | ' + v.files.length + ' 个文件通过 |\n| 本轮范围 git diff --check | 退出码 ' + v.scopedDiff.exit + ' |');
blocks.push('核心差分样例采用受控时钟：第十秒收到成功响应头，第 170 秒返回完整 JSON，首响应策略仍为 150 秒；修复后完整返回且仅有一次请求。另验证显式总期限、未收到首响应时的期限、取消、切档、流式静默间隔、Agent 工具、安卓整包响应、独立主次设置以及排队不消耗首响应预算。');
blocks.push('真实 Edge 使用独立配置、真实 fetch 和本机 HTTP 服务，验证响应头先到、正文延迟超过首响应期限仍成功；并检查显式总期限、取消、工具响应、自动输出的流式入口与设置保存。测试共发送五次合成请求，没有使用实际中转站、付费模型或玩家存档。独立浏览器配置清理结果：' + (v.browser.profileRemoved ? '已清理' : '未确认清理') + '。');
blocks.push('最终浏览器源文件哈希与最终运行时代码一致。记录测试输入文件 ' + v.testedFileCount + ' 个；测试期间变化 ' + v.changedDuringRun.length + ' 个，结束后再次核对变化 ' + v.changedAfterTests.length + ' 个。没有将前一次中断的结果当成最终全量结果。');
blocks.push('原架构失败来自并行地图文件的家族缓存戳不一致。本次仅同步加载标记和生成清单，未修改地图实现、版本号、资产或加载顺序，未删除检查或增加豁免。');
blocks.push('## 五、质量边界与未改动范围');
blocks.push('以下文件或函数与开工备份保持一致：\n\n' + v.qualityChecks.map(row => '- `' + row.check + '`：通过').join('\n'));
blocks.push('模型上下文容量检测和思考协议转换文件没有修改。没有强制改回 32K，也没有默认关闭 thinking。本轮完成的是等待与自动输出流式兼容，不将其他中转协议差异或容量识别问题假称为已经全部解决。');
blocks.push('工程回归全绿不等于所有真实供应商均已验证。尚未使用报告玩家的真实 API 跑完整长局，未运行安卓真机或已发布安装包验收，不能报告真实玩家总体成功率或整回合提速百分比。');
blocks.push('## 六、全量回归中的测试环境修正');
blocks.push('第一次恢复后的全量回归发现 smoke-tc-history-wave 的 B5 隔离场景未加载真实的 _aiWaitSetting，Agent 在构造运行预算时提前抛出 ReferenceError，未进入模型调用。诊断确认不是历史约束被删除。测试补入生产使用的真实解析函数后，原有 49 条断言全部通过；没有 stub 成无条件成功，没有删除或放宽任何历史约束断言。修改后另行重跑完整验证，中间失败结果保存在 before-history-fixture-fix/。');
blocks.push('取消监听器测试也同步了实际所有权：重试等待使用内部控制器，而不是在外部信号重复挂监听器。保留外部三次请求的精确添加/移除检查，并额外用真实 getEventListeners 检查两次内部等待均清理完毕；29 条断言通过。该修改没有放宽或绕过运行时取消逻辑。');
blocks.push('## 七、文件与交付状态');
blocks.push('本轮文件：\n\n| 文件 | SHA-256 前十二位 |\n|---|---|\n' + v.files.map(row => '| `' + row.file + '` | `' + row.sha256.slice(0, 12) + '` |').join('\n'));
blocks.push('完整证据目录：`docs/api-wait-compatibility-20260920/`。关键文件：`verification.json`、`resumed-full-tests.json`、`resumed-run-status.json`、`resumed-tested-inputs.json`、`resumed-architecture.log`、`browser-realtime-result.json`、`own-diff-check.json`、`changes.json`。');
blocks.push('原始备份：`D:\\tianming-task-artifacts-20260919\\api-wait-backup-20260920`。原路径与其他窗口已有改动保留。仅调整地图拆分模块的查询缓存戳，没有回滚其他窗口的地图工作。');
blocks.push('修复尚未进入发布包或线上网页。后续发布仍须由仓主明确触发，并经过项目发布流水线；本报告不构成已发版声明。');
fs.writeFileSync(dir + '/README.md', blocks.join('\n\n') + '\n', 'utf8');
console.log('Final report written:', dir + '/README.md', fs.statSync(dir + '/README.md').size, 'bytes');
