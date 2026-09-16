'use strict';
// Evidence index, not a test runner. Original requirements are retained verbatim;
// a component PASS never changes a named excluded scenario into an executed case.
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  [matrixFile, smokeFile] = process.argv.slice(2),
  allowIncomplete = process.argv.includes('--allow-incomplete');
assert(matrixFile && smokeFile, 'Pass the original requirement matrix and the FINAL full smoke report');
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p), 'utf8')),
  hash = (p) =>
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.resolve(root, p)))
      .digest('hex'),
  original = read(matrixFile),
  smoke = read(smokeFile),
  finalFile = 'docs/native-start-workbench/final-verification.json',
  final = read(finalFile);
assert(original.caseCount === 100 && original.cases.length === 100);
assert(final.complete && final.sourceUnchanged && smoke.complete);
const gatesPassed = final.ok && smoke.results.every((r) => r.pass && !r.timedOut && !r.flaky && !r.suspect);
if (!allowIncomplete) assert(gatesPassed, 'Final gates are incomplete; use --allow-incomplete only to publish an explicitly incomplete evidence index');
for (const [file, expected] of Object.entries(final.fileHashes))
  assert.equal(hash(file), expected, 'Acceptance source changed: ' + file);
const evidence = {},
  entries = {};
function native(key, name) {
  const row = final.results.find((r) => r.name === name);
  assert(row);
  evidence[key] = {
    ok: row.ok,
    kind: 'actual-Electron',
    runId: final.runId,
    command: row.command,
    evidencePaths: [finalFile, ...row.evidence],
    inputHashes: final.fileHashes,
  };
}
for (const [key, name] of Object.entries({
  entry: 'native-start-entry',
  faults: 'native-start-faults',
  assets: 'native-workbench-assets',
  tasks: 'native-workbench-tasks',
  permission: 'native-workbench-permissions',
  flow: 'native-workbench-flow',
  hits: 'native-map-hits',
  old: 'native-legacy-official',
  auto: 'authoring-autoapply',
  core: 'native-start-core',
  atlas: 'neutral-atlas',
}))
  native(key, name);
const invalidProfileFile = 'web/dev-tools/electron-bridge/fdd40e0a-b9dd-469f-adbe-b8aa49825136/report.json',
  invalidProfiles = read(invalidProfileFile);
assert(invalidProfiles.results.every((r) => r.ok && r.detail?.ok));
assert(
  invalidProfiles.results.some((r) =>
    r.detail.results.some((c) => c.status === 'PASS' && c.name.startsWith('missing or dead characters')),
  ),
);
evidence.faults.evidencePaths.push(invalidProfileFile);
function unit(key, file) {
  const row = smoke.results.find((r) => r.name === file);
  assert(row);
  evidence[key] = {
    ok: row.pass && !row.timedOut && !row.flaky && !row.suspect,
    kind: 'production-function-smoke',
    runId: smoke.runId,
    command: ['node', 'web/scripts/' + file],
    evidencePaths: [smokeFile],
    test: file,
    assertionOutput: row.output,
    inputHashes: {
      test: hash('web/scripts/' + file),
      nativeFixture: hash('web/scripts/fixtures/native-start-fixture.cjs'),
      runtimeManifest: hash('web/tm-start-runtime-manifest.json'),
    },
  };
}
for (const [key, file] of Object.entries({
  contracts: 'smoke-native-start-contracts.js',
  compiler: 'smoke-native-start-compiler.js',
  world: 'smoke-native-start-world.js',
  preparation: 'smoke-native-start-preparation.js',
  fiscal: 'smoke-native-fiscal-consumers.js',
  events: 'smoke-native-world-events.js',
  map: 'smoke-map-workbench.js',
  formats: 'smoke-map-asset-formats.js',
  export: 'smoke-native-artifact-export.js',
  operationSchema: 'smoke-workbench-operation-contract.js',
  spatial: 'smoke-map-spatial-index.js',
}))
  unit(key, file);
evidence.gates = {
  ok: gatesPassed,
  kind: 'free-gates',
  runId: final.runId,
  command: ['node', 'scripts/verify-native-workbench-completion.cjs'],
  evidencePaths: [finalFile, smokeFile],
  inputHashes: final.fileHashes,
};
for (const phase of ['verify-start', 'verify-reload', 'verify-download']) {
  const file = 'output/playwright/native-workbench/' + phase + '.json',
    r = read(file);
  assert(r.ok);
  evidence[phase] = {
    kind: 'actual-browser',
    runId: r.at,
    command: ['node', 'scripts/native-browser-acceptance-step.cjs', phase],
    evidencePaths: [file],
    inputHashes: { fixture: r.sourceHash },
    capabilityNote:
      phase === 'verify-download'
        ? 'File picker deliberately unavailable; actual Blob download and disk hash verified.'
        : '',
  };
}
const liveFile = 'docs/native-start-workbench/live-acceptance-20260915-retest.json',
  live = read(liveFile);
evidence.live = {
  kind: 'real-provider',
  runId: live.runId,
  command: [
    'node',
    'scripts/verify-native-live-authoring.cjs',
    '--authorized-five-requests',
    '--retest-after-map-id-fix',
    '<local config reader arguments>',
  ],
  evidencePaths: [
    liveFile,
    'docs/native-start-workbench/live-acceptance-20260915.json',
    'docs/native-start-workbench/real-api-budget-20260915.json',
    'docs/native-start-workbench/real-api-budget-20260915-retest.json',
  ],
  ok: live.ok,
  requestsReserved: live.requestsReserved,
};
function set(ids, refs, note, status = 'PASS') {
  for (const id of ids.split(' ')) {
    assert(!entries[id], id);
    refs.split(' ').forEach((ref) => assert(evidence[ref], ref));
    entries[id] = { status, evidenceKeys: refs.split(' '), notes: note };
  }
}
set(
  'A01',
  'contracts compiler',
  '原指定 v15/47 配置按用户要求排除；合成配置仅验证通用编译，不替代 47 份真源。',
  'EXCLUDED_LATE_TANG',
);
set(
  'A02',
  'compiler entry',
  '原指定唐廷、日本、新罗数据未使用；合成人物的属性、身份和全世界保留已验证。',
  'EXCLUDED_LATE_TANG',
);
set('A03', 'atlas contracts', '合成受托代表确实从正式入口开局；保留原元首、委托范围，不靠称号升级。');
set('A04 A06', 'entry verify-start', '正式同页选择和真实初始化、无桌面 bridge 的浏览器与无模型 key 均通过。');
set('A05', 'old', '两份原官方 JSON 未修改，默认单主角开局和新进程读档通过。');
set(
  'A07 A08',
  'contracts compiler faults',
  '缺人物、死亡标记、缺真实元首关系的实际原生选择器禁止开始，旧 live 与两个 canonical 存档不变。',
);
set('A09', 'contracts entry', '同名不同 ID 的选择实际选中第二人，不能按模糊名称替代。');
set('A10 A13', 'faults entry', '取消准备、真实 IDB guard 拒写、双槽存档及旧 live 回滚通过。');
set('A11', 'entry faults compiler', '重复确认与已提交候选再次提交被拒，未重复初始化或入账。');
set(
  'A12',
  'compiler preparation faults',
  '合成过期源、忽略取消的读取及迟到结果已测；不使用原指定日本/吐蕃。',
  'EXCLUDED_LATE_TANG',
);
set('A14', 'compiler entry', '开场、规则、GM 身份来自锁定候选；源摘要保持。');
set(
  'A15 A16 A17',
  'compiler core entry',
  '通用不克隆预览、不污染锁定源和外国数据保留通过；实际 v15/47 样本不在本轮。',
  'EXCLUDED_LATE_TANG',
);
set('A18', 'fiscal entry', '实际死亡/继承入口更新 current ID，原 profile 与初始 ID 留史，钱库不重置，重启一致。');
set('A19 A20', 'world contracts compiler', '规则能力与私库由显式契约决定；未知规则/资源能力在准备前明确拒绝。');
set('A21', 'entry verify-start', '正式选择器显示没有可用配置的势力缺项卡，未自动补造元首。');
set(
  'A22 A23',
  'contracts compiler',
  'v15 幂等迁移、具体日本人物旧简介冲突为晚唐内容，未改未验。',
  'EXCLUDED_LATE_TANG',
);
set('A24', 'contracts', '明确共同元首、摄政和代表关系有生产契约断言，不取列表第一人当唯一元首。');
set(
  'B01 B02 B09',
  'fiscal entry',
  '通用 NPC 排除、外军/代付、三期和十期财政通过；未使用 47 配置或 121 编组数据。',
  'EXCLUDED_LATE_TANG',
);
set('B03 B04 B05 B06', 'fiscal entry', '实际官俸和军饷消费者按账户承担；外籍任职保留、空职不补玩家，联合份额核验。');
set('B07 B08 B10', 'fiscal world', '零账、无皇产、显式流量、欠额和同一回合重复结算通过；不静默兑换资源。');
set(
  'B11',
  'fiscal entry map',
  'A 主权/B 实控/C 税权真实三期只入 C 账户并跨进程读回；税权转移须明确写契约，拆并守恒且异税权合并拒绝。',
);
set(
  'B12 B13',
  'fiscal entry compiler',
  '外国社会视图和关联边的通用正向/负向传播已测；指定日本/海南阶层数据排除。',
  'EXCLUDED_LATE_TANG',
);
set('B14', 'compiler fiscal', '保留跨国人物关系；阶层结果只传播到真实支持边，跨国合法边不一刀切删除。');
set('B15', 'events', '实际历史事件、AI 队列、直接 UI 共用执行 claim；已读/观察与行权分离。');
set('B16', 'atlas fiscal', '真实代表开局及任命/财政写入口均不能因称号变皇帝而升级权限。');
set(
  'C01 C02',
  'atlas formats',
  '独立中立 2.1.0 原包和海南独立格真实运行/点击；未使用 v15 政治归属与财政绑定。',
  'EXCLUDED_LATE_TANG',
);
set('C03', 'hits map', '真实 SVG 点击湖中无陆地命中；内环分类保持。');
set('C04 C05 C06', 'map spatial', '正向物理陆地漏缝、双侧共享边、数值尾差与真实水洞分别记录；边段空间索引与有序穷举结果一致，不放宽容差。');
set(
  'C07',
  'atlas formats',
  '原独立中立图 575 个逻辑格、622 面片、228 内环经过完整加载、原生渲染；格式投影保留每个面片的内环。',
);
set(
  'C08',
  'atlas hits',
  '原对马两个面的实际鼠标命中同一 jp-tsushima；财政/驻军消费者以逻辑地区/军队 ID 而非面片计数。',
);
set(
  'C09 C10 C11 C12',
  'map flow',
  '整数拆分尾差、完整 typed 引用迁移、兵额守恒、不同控制合并拒绝和其他源绑定不变通过。',
);
set('C13 C14 C15', 'map atlas', '点接触无路线、物理河流不生成政治授权；全部 575 个标签锚点在有效面内。');
set('C16', 'assets permission map', '几何候选与引用迁移/提交分离；失败保旧根和 live，不半包应用。');
set(
  'D01',
  'flow permission operationSchema',
  '实际 registry 向调用方提供完整操作参数；派发真实 Worker/持久服务，真实收到的别名入参免费复现。',
);
set('D02', 'permission', '问策/审阅/问答/讲解四个只读入口实际调用写工具均拒绝，不创建资产。');
set('D03 D04', 'permission auto', '共审须批准；放行成功一次自动应用；持久局部授权拒绝越界和旧字段工具绕过。');
set('D05 D06 D07', 'permission tasks auto', '新项目、同名重载、人工 revision 冲突与延迟回包隔离通过。');
set('D08', 'auto', '现有作者提交未确认保持失败，不把忽略赋值算成功。');
set('D09', 'permission operationSchema', '原目标失败后无关成功仍不能 finish；修复同操作同目标后才清除对应失败。');
set('D10 D11', 'permission flow', '虚构资产 ID 拒绝；报告/制品绑定输入与生产代码摘要，过期候选不能新认证。');
set('D12', 'permission auto', '只读/任务范围与实际提供工具集的拒绝回执已测；全量旧工具权限契约由 smoke 保持。');
set('D13', 'atlas flow', '全图实际扫描 575 格/228 内环，输出限量不等于扫描限量；保留总数与截断标记。');
set(
  'D14 D15',
  'permission assets tasks',
  '资料 sourceRef 只读真实本案附件，不授予写权限；任务取消和同事务写 guard 拒绝迟到提交。',
);
set('D16', 'auto gates', '原字段写、记忆持久化和全权限提交/撤销保存流程保持。');
set(
  'E01 E02 E03',
  'flow formats',
  '实际生成、完整回读、解析 manifest 各成员、重新导入及当前契约检查；原包许可原字节保留。',
);
set(
  'E04',
  'verify-download',
  '真实 Chrome 禁用 File System Access 能力后点击导出：UI 如实称交给浏览器；外部测试从下载目录回读 ZIP 的 SHA 和长度一致。',
);
set('E05 E06 E07', 'export assets formats', '磁盘满/取消/路径与 ZIP 恶意项/同名竞争均拒绝；不覆盖原目标。');
set('E08 E10', 'assets', '真实案卷 IDB 事务、孤儿候选、CAS、相同 operation 回执/不同输入冲突通过。');
set('E09 E11', 'tasks live', '新进程显式恢复检查点；两次真实上限均被执行，未派发第六次 HTTP，保留 partial。');
set('E12', 'permission', '工作台普通工具无 Git、安装官方脚本、部署能力；导出需要玩家操作。');
set('F01', 'faults permission flow', '源修改/候选修改/代码指纹不一致拒绝认证；输入摘要及最新运行文件分别保留。');
set('F02', 'gates', '命令退出/信号/超时独立判定；主动中断的全套运行保留失败，不能用其中 PASS 行当终局结果。');
set('F03', 'flow atlas', '同快照生产 renderer 输出实际 PNG，原图可人工打开；不是模型生图。');
set('F04', 'tasks live', '真实请求分两笔授权各最多 5 次，预留计数先于 HTTP；免费套件不含真实服务脚本。');
set('F05', 'live permission', '真实资料含不可信上传指令仍未触发外部上传；密钥仅配置专用传输，资料不扩权。');
set(
  'F06',
  'permission preparation',
  '未提供通用外网研究：来源仅本项目 ID，准备资源固定同目录白名单。没有任意 URL 请求接口；不宣传已实现联网检索。',
);
set(
  'F07 F08',
  'entry',
  '通用正式存档/新进程重启与代表开局通过；原指定 47 配置和七个晚唐身份未执行。',
  'EXCLUDED_LATE_TANG',
);
set('F09', 'old', '天启七年/绍宋真实默认开局、保存、新进程重启通过，官方 JSON 源不改。');
set('F10', 'compiler world', '缺地图/摘要版本错拒绝或使用同摘要内嵌快照，不静默换最新版。');
set(
  'F11',
  'entry flow verify-start verify-reload verify-download',
  '正式 Electron 与 HTTP 浏览器入口、隔离准备、案卷资产和浏览器导出分别实测。',
);
set('F12', 'gates', '最新冻结源码全量 smoke、架构、官方派生、资源基线/发布契约；仅基线用官方工具更新，未发版。');
set(
  'F13',
  'preparation',
  '仅验收 Windows Electron 和 Chrome；未跑移动实机，无法据桌面结果认证移动端。',
  'NOT_RUN_MOBILE',
);
set(
  'F14',
  'preparation entry assets atlas',
  '重复打开/取消/预览后的帧、活动任务和回调清理有断言；没有长时间移动设备峰值内存证明。',
  'PARTIAL_SOAK',
);
set(
  'F15',
  'formats export live',
  '独立原包 5 份许可证保留哈希；拒绝凭据字段/越界路径。浏览器测试与真实服务报告不含 key。',
);
set(
  'F16',
  'live operationSchema permission',
  '两次真实服务均在 5 次上限下 partial。第二次定位参数 schema 缺失及失败目标无法消除，已补齐并用真实入参免费复现。修复后的第三次真实服务未获预算，不能改记 PASS。',
  'FAILED_REAL_BUDGET',
);
assert.equal(Object.keys(entries).length, 100);
const cases = original.cases.map((c) => {
  const e = entries[c.id];
  assert(e, c.id);
  return {
    ...c,
    originalStatus: c.status,
    status: e.status === 'PASS' && e.evidenceKeys.some(key=>key!=='live' && evidence[key].ok===false) ? 'BLOCKED_LATEST_GATE' : e.status,
    runId: final.runId,
    sourceCommit: final.head,
    command: e.evidenceKeys.map((key) => evidence[key].command),
    inputHashes: { runtimeManifest: hash('web/tm-start-runtime-manifest.json') },
    evidencePaths: [...new Set(e.evidenceKeys.flatMap((key) => evidence[key].evidencePaths))],
    evidenceKeys: e.evidenceKeys,
    notes: e.notes,
    executedEvidenceKinds: [...new Set(e.evidenceKeys.map((key) => evidence[key].kind))],
  };
});
const report = {
  ...original,
  schema: 'tm-native-workbench-case-evidence/1',
  generatedAt: new Date().toISOString(),
  requirementsSha256: hash(matrixFile),
  requestedScope: 'generic implementation only; no Late-Tang data or 47-profile migration',
  allCasesPassed: false,
  freeGatesPassed: gatesPassed,
  qualification:
    'PASS certifies the stated behavior in the listed samples and evidence kinds, not additional platforms or paid long games. Original setup and evidenceLevel remain visible. Excluded named data are not substituted silently.',
  summary: cases.reduce((s, c) => ((s[c.status] = (s[c.status] || 0) + 1), s), {}),
  evidence,
  cases,
};
fs.writeFileSync(
  path.join(root, 'docs/native-start-workbench/acceptance-matrix.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ caseCount: cases.length, allCasesPassed: false, summary: report.summary }));
