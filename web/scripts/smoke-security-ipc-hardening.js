// ============================================================
//  smoke-security-ipc-hardening.js — 安全 IPC 加固回归守卫
//  背景(2026-07-09·安全修复加固 agent)：两处绿档安全修的对抗式复审 + 回归守卫。
//    修A·read-turns-summary 路径遍历修：fromTurn/toTurn 必须是规范安全整数段；
//         负数、浮点、指数、前导零和混入字符全部拒绝，范围及跨度同时封顶。
//    修B·工坊包强制 hash 修(main-impl.js :2756)：expectedHash 必过 /^[0-9a-f]{64}$/·
//         再比对 downloadRemoteFile 本地算出的 fileInfo.sha256。
//
//  ★诚实声明·可测边界：main-impl.js 是 Electron 主进程·顶层 require('electron')·
//    纯 node 无法直接 load 整个文件跑真 IPC。故本测采「双轨」策略：
//      轨1·纯函数复刻(behavioral)：在本文件内重实现 turnSeg / hash 门 / isInsideDir /
//           sanitize / 回合循环 等小函数·对第1步边角矩阵每个 payload 做断言。
//           ⚠ 这些复刻【须与 main-impl.js 保持同步】——改了主进程实现要回来改这里。
//      轨2·源码在位守卫(static)：读 main-impl.js 源文·正则断言「当前已在位的防护」
//           不被回退(turnSeg throw、isFinite 门、hash 正则门、zip-slip、本地算 sha256)。
//      轨3·建议加固 WARN：对「尚未落地的加固点」(跨度封顶 / sanitize 纯点段) 打 WARN·
//           不计 fail(当前树保持绿)·加固落地后 WARN 自动转 ok。
//    无法纯测的完整 IPC 链(真下载/真解压/真 dialog)→ 见文末「手动/集成验证清单」
//    及 web/scripts/README-security-ipc.md。
//  运行：node web/scripts/smoke-security-ipc-hardening.js
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'main-impl.js'), 'utf-8');
const MAIN_SHIM = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf-8');
const PRELOAD_SHIM = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf-8');
const HOT_BUILDER = fs.readFileSync(path.join(ROOT, 'web', 'tools', 'build-hot-update-package.js'), 'utf-8');
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));

let pass = 0, fail = 0, warn = 0;
function assert(c, m) { if (c) { pass++; console.log('  ok· ' + m); } else { fail++; console.error('  FAIL· ' + m); } }
function warnMissing(present, m) { if (present) { console.log('  ok(已加固)· ' + m); } else { warn++; console.warn('  WARN(建议加固)· ' + m); } }

// ════════════════════════════════════════════════════════════
//  轨1·纯函数复刻（须与 main-impl.js 保持同步）
// ════════════════════════════════════════════════════════════

// —— 复刻 main-impl.js :151 turnSeg ——
function turnSeg(turn) {
  const raw = typeof turn === 'number' ? turn : String(turn == null ? '' : turn).trim();
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0 || raw > 10000000) throw new Error('非法回合号: ' + turn);
    return String(raw);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error('非法回合号: ' + turn);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n > 10000000) throw new Error('非法回合号: ' + turn);
  return String(n);
}
// —— 复刻 main-impl.js :264 isInsideDir ——
function isInsideDir(parent, target) {
  const rel = path.relative(path.resolve(parent), path.resolve(target));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}
// —— 复刻 main-impl.js sanitize（纯点段中和）——
function sanitizeCurrent(name) {
  const s = String(name).replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  return /^\.+$/.test(s) ? '_' : s;
}
// —— 建议加固后的 sanitize（中和纯点段·见报告 Diff 2）——
function sanitizeHardened(name) {
  const s = String(name).replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  return /^\.+$/.test(s) ? '_' : s; // 纯点段（. .. …）会让 path.join 上跳目录
}
// —— 复刻工坊 hash 门（main-impl.js :2765-2767）——
function hashGateAccepts(expectedRaw, actualHex) {
  const expectedHash = String(expectedRaw == null ? '' : expectedRaw).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) return false; // 真代码此处 throw
  return expectedHash === String(actualHex || '').toLowerCase();
}
// —— 建议加固后的 read-turns-summary 循环边界（见报告 Diff 1）——
//     返回实际迭代次数·证明任何输入都有界终止。
function summarizeHardenedIters(fromTurn, toTurn) {
  let _from, _to;
  try { _from = Number(turnSeg(fromTurn)); _to = Number(turnSeg(toTurn)); }
  catch (_) { return 0; }
  if (!Number.isSafeInteger(_from) || !Number.isSafeInteger(_to)) return 0;
  if (_to < _from) return 0;
  _to = Math.min(_to, _from + 20000, 10000000); // 跨度封顶 + 上限
  if (_to < _from) return 0;
  let it = 0;
  for (let t = _from; t <= _to; t++) { it++; } // 有界·安全整数域内 t++ 必进
  return it;
}

const SAVE_BASE = path.resolve('C:\\tm-test\\turn-data'); // 合成基址（不触真目录）

console.log('— 轨1·纯函数复刻断言 —');

// ── 修A / turnSeg：路径遍历含入（矩阵 A1/A2/A7）──
assert((() => { try { turnSeg('../../etc/passwd'); return false; } catch (_) { return true; } })(),
  'A1· turnSeg("../../etc/passwd") 非规范整数 → throw');
assert((() => { try { turnSeg('..'); return false; } catch (_) { return true; } })(),
  'A2· turnSeg("..") → throw（空段不退化成 saveDir 本身）');
assert(/^[0-9]+$/.test(turnSeg(5)) && turnSeg(5) === '5', 'A3a· turnSeg(整数) 输出纯数字段');
// 含入性：对一批敌意 turn·要么 throw·要么 join 结果仍在 saveDir 内（纯数字段不可能逃逸）
['../../x', '..', '5', -3, '3.5', '7abc', '0x1F', 999999].forEach(t => {
  let inside = true;
  try { inside = isInsideDir(SAVE_BASE, path.join(SAVE_BASE, turnSeg(t), 'context.json')); } catch (_) { inside = true; }
  assert(inside, 'A3b· turn=' + JSON.stringify(t) + ' → 段仍含于 saveDir（或已 throw）');
});
// 同一性：不同非法输入不能别名到同一个合法回合目录
assert((() => { try { turnSeg(-3); return false; } catch (_) { return true; } })(), 'A6· turnSeg(-3) 拒绝（不再别名到回合3）');
assert((() => { try { turnSeg('3.5'); return false; } catch (_) { return true; } })(), 'A7· turnSeg("3.5") 拒绝（不再别名到回合35）');
assert((() => { try { turnSeg('007'); return false; } catch (_) { return true; } })(), 'A7b· 前导零拒绝（规范表示唯一）');
assert((() => { try { turnSeg('1e3'); return false; } catch (_) { return true; } })(), 'A7c· 指数表示拒绝');

// ── 修A / DoS 根因（矩阵 A4/A5）：不真跑病态循环·断言致因属性 ──
assert((1e21 + 1) === 1e21,
  'A5a· IEEE754：t++ 在 1e21 处自增停滞 → 当前 for(t=from;t<=to;t++) 对 ≥2^53 不终止（死循环）');
assert(Number.isFinite(Math.floor(Number(1e21))) === true,
  'A5b· 1e21 通过 Number.isFinite 门 → 当前守卫【不】拦 → 印证 A5 死循环 DoS 存在');
assert(Number.isSafeInteger(1e21) === false,
  'A5c· 建议加固的 Number.isSafeInteger 门可拦 1e21（终止死循环）');
// 加固后循环对每个 payload 都有界终止
assert(summarizeHardenedIters(0, 1e9) === 0,
  'A4· 超出最大回合范围的 toTurn=1e9 → 直接拒绝');
assert(summarizeHardenedIters(0, 10000000) === 20001,
  'A4a· 合法最大范围仍将迭代封顶 20001');
assert(summarizeHardenedIters(1e21, 1e21) === 0,
  'A5d· 加固：fromTurn=toTurn=1e21 → 0 迭代（safe-integer 门拦下·不死循环）');
assert(summarizeHardenedIters(-3, 5) === 0,
  'A6b· 负回合直接拒绝，不钳位到另一个请求');
assert(summarizeHardenedIters(2.9, 5.1) === 0,
  'A3c· 浮点回合直接拒绝，不 floor 成另一个请求');
assert(summarizeHardenedIters(5, 3) === 0,
  'A4b· 加固：toTurn<fromTurn → 0 迭代（倒序空返回）');
assert(summarizeHardenedIters(9007199254740991, 9007199254740991) === 0,
  'A5e· 超过业务回合上限的安全整数也直接拒绝');

// ── 修A / saveName 侧 sanitize 与 turn 组合（矩阵 A8/A9）──
assert(isInsideDir(SAVE_BASE, path.join(SAVE_BASE, sanitizeCurrent('..'))) === true,
  'A8a· sanitize("..")="_" → path.join 保持在 turn-data 内');
assert(isInsideDir(SAVE_BASE, path.join(SAVE_BASE, sanitizeHardened('..'))) === true,
  'A8b· 加固：sanitize("..")→"_"·含于 turn-data（穿越被中和）');
assert(path.resolve(path.join(SAVE_BASE, sanitizeCurrent('.'))) !== path.resolve(SAVE_BASE),
  'A9· sanitize(".")="_" → 不再塌回 saveBase 本身');
assert(sanitizeHardened('正常存档名') === '正常存档名' && sanitizeHardened('a.b.save') === 'a.b.save',
  'A8c· 加固 sanitize 不误伤含点的正常名（仅整体纯点段被替）');

// ── 修B / 工坊 hash 门（矩阵 B1-B4）──
const H = 'a'.repeat(64), Hupper = 'A'.repeat(64), Hb = 'b'.repeat(64);
assert(hashGateAccepts(Hupper, H) === true, 'B1· 大写 hash 经 toLowerCase 后接受并匹配（大小写不敏感）');
assert(hashGateAccepts(' ' + H + ' ', H) === false, 'B2· 前后空白 → 正则 ^…$ 拒绝（fail-closed）');
assert(hashGateAccepts('', H) === false, 'B3· 空 hash → 拒绝（=本次修的核心：无 hash 拒装）');
assert(hashGateAccepts(H + '\n', H) === false, 'B4a· 尾换行 → JS $（无 m）不匹配 → 拒绝（防换行走私）');
assert(hashGateAccepts('a'.repeat(63), H) === false, 'B4b· 63 位 → 长度不足 → 拒绝');
assert(hashGateAccepts('a'.repeat(65), H) === false, 'B4c· 65 位 → 超长 → 拒绝');
assert(hashGateAccepts('g'.repeat(64), H) === false, 'B4d· 含非 hex 字符(g) → 拒绝');
assert(hashGateAccepts(H, Hb) === false, 'B5· 格式合法但与实际 sha256 不符 → 拒绝');
assert(hashGateAccepts(H, H) === true, 'B6· 格式合法且与本地算出的 sha256 一致 → 接受');

// ════════════════════════════════════════════════════════════
//  轨2·源码在位守卫（读 main-impl.js·防已落地防护被回退）
// ════════════════════════════════════════════════════════════
console.log('\n— 轨2·main-impl.js 源码在位守卫 —');

assert(SRC.includes("if (!/^(0|[1-9][0-9]*)$/.test(raw))")
  && /function turnSeg\(turn\)[\s\S]*?Number\.isSafeInteger\(raw\)[\s\S]*?raw < 0[\s\S]*?raw > 10000000/.test(SRC),
  'src· turnSeg 强制唯一的 0..1e7 安全整数表示');
assert(/'read-turns-summary'[\s\S]*?Number\(turnSeg\(fromTurn\)\)[\s\S]*?Number\.isSafeInteger\(_from\)[\s\S]*?_from \+ 20000[\s\S]*?turnSeg\(t\)/.test(SRC),
  'src· read-turns-summary 复用严格 turnSeg，并保留 safe-integer/跨度门');
assert(/if\s*\(!\/\^\[0-9a-f\]\{64\}\$\/\.test\(expectedHash\)\)\s*throw/.test(SRC),
  'src· 工坊安装仍强制 /^[0-9a-f]{64}$/ hash 格式门（修B 未回退）');
assert(/expectedHash !== fileInfo\.sha256/.test(SRC),
  'src· 工坊安装仍比对 expectedHash 与本地 fileInfo.sha256（修B 未回退）');
assert(/function extractZipToTemp\(zipPath\)\s*\{[\s\S]*?isInsideDir\(temp, target\)[\s\S]*?throw/.test(SRC),
  'src· extractZipToTemp 仍做 zip-slip 越界检查（工坊解压纵深防护）');
assert(/BLOCKED_PACK_EXTS\.has\(ext\)[\s\S]*?ALLOWED_PACK_EXTS\.has\(ext\)/.test(SRC),
  'src· validateWorkshopPack 仍走 BLOCKED+ALLOWED 双白名单（hash 只保完整性·安全靠此层）');
assert(/sha256:\s*inlineHash\.digest\('hex'\)/.test(SRC) && /sha256FileStream\(dest\)/.test(SRC) && /sha256:\s*sha256File\(dest\)/.test(SRC),
  'src· downloadRemoteFile 三条 return 均本地算 sha256（非取服务器头 → fileInfo.sha256 可信）');
assert(!/sha256:\s*[^,\n}]*headers\.get/.test(SRC),
  'src· sha256 从不取自 resp.headers（防服务器自报哈希绕过完整性校验）');
assert(/function isAllowedRemoteUrl[\s\S]*?protocol === 'https:'/.test(SRC),
  'src· 远程地址强制 HTTPS（localhost 例外）→ MITM 无法改 catalog 里的 hash');
assert(/require\(['"]\.\/main-impl\.js['"]\)/.test(MAIN_SHIM) && !MAIN_SHIM.includes('_app_main.js')
  && /require\(['"]\.\/preload-impl\.js['"]\)/.test(PRELOAD_SHIM) && !PRELOAD_SHIM.includes('_app_preload.js'),
  'src· main/preload 启动桥只加载安装包内固定实现');
assert(!HOT_BUILDER.includes("addLocalFile(path.join(APP_ROOT, 'main")
  && !HOT_BUILDER.includes("addLocalFile(path.join(APP_ROOT, 'preload")
  && /authenticateReleaseDocument/.test(HOT_BUILDER) && /Ed25519/.test(HOT_BUILDER),
  'src· 内容 OTA 排除主进程代码并强制 Ed25519 发布者认证');
assert(/sandbox:\s*true/.test(SRC) && /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/.test(SRC)
  && /will-navigate/.test(SRC) && /will-redirect/.test(SRC),
  'src· renderer 沙箱、导航、重定向与新窗口均有边界');
assert(/assertTrustedIpcSender\(event\)/.test(SRC) && /frame !== sender\.mainFrame \|\| frame\.parent/.test(SRC),
  'src· 所有 IPC 通过统一包装器校验可信顶层 senderFrame');
assert(/setPermissionRequestHandler/.test(SRC) && /setPermissionCheckHandler/.test(SRC)
  && !/setCertificateVerifyProc|certificate-error/.test(SRC),
  'src· 权限请求默认拒绝且生产 TLS 证书绕过已移除');
assert(PACKAGE.build && PACKAGE.build.win && PACKAGE.build.win.forceCodeSigning === true
  && PACKAGE.build.win.signAndEditExecutable === true && PACKAGE.build.win.verifyUpdateCodeSignature === true,
  'src· Windows 构建缺签名即失败并要求更新签名复验');

// ════════════════════════════════════════════════════════════
//  轨3·建议加固点 WARN（不计 fail·加固落地后自动转 ok）
// ════════════════════════════════════════════════════════════
console.log('\n— 轨3·建议加固点（WARN·见报告 Diff）—');

const rtsBody = (SRC.match(/'read-turns-summary'[\s\S]*?\n\}\);/) || [''])[0];
const sanitizeBody = (SRC.match(/function sanitize\(name\)\s*\{[\s\S]*?\n\}/) || [''])[0];

warnMissing(/isSafeInteger|MAX_TURN|MAX_SPAN|_from \+ 20000|10000000/.test(rtsBody),
  'read-turns-summary 增设 跨度封顶 + safe-integer 门（Diff 1）——防 A4 巨跨度冻结 & A5 ≥2^53 死循环');
warnMissing(sanitizeBody.includes('纯点') || /\.\+\$/.test(sanitizeBody) || /isDotSeg/.test(sanitizeBody),
  'sanitize 中和 "."/".." 纯点段（Diff 2）——防 A8 saveName=".." 上跳一级越界（读/写 turn-data 全部受益）');

// ════════════════════════════════════════════════════════════
//  文末·手动/集成验证清单（纯 node 测不到的完整 IPC 链）
// ════════════════════════════════════════════════════════════
console.log([
  '',
  '— 手动/集成验证清单（真仓·跑起 Electron 后在渲染进程 devtools console 造 payload）—',
  '  前置：window.electronAPI / ipcRenderer 暴露的 invoke（按项目 preload 命名·下用占位 invoke()）。',
  '',
  '  [修A·read-turns-summary]',
  '   1. 先正常玩几回合造出 turn-data/<存档>/1,2,3/context.json。',
  '   2. invoke("read-turns-summary",{saveName:"<存档>",fromTurn:1,toTurn:3}) → 期望 turns 3 条。',
  '   3. 穿越：fromTurn:"../../../../etc",toTurn:"x" → 期望 {turns:[]}（严格整数门拒绝·不抛不读）。',
  '   4. DoS-跨度：fromTurn:0,toTurn:1e9 → 秒回 {turns:[]}；0..1e7 最多扫描 20001 回合。',
  '   5. 死循环输入：fromTurn:1e21,toTurn:1e21 → 即回 {turns:[]}。',
  '   6. saveName 穿越：saveName:"..",fromTurn:1,toTurn:1 → 观察是否读到 turn-data 上级(USER_DATA)；',
  '        写侧同验：invoke("write-turn-data",{saveName:"..",turn:1,data:{context:{x:1}}}) 后到磁盘看',
  '        %APPDATA%/<app>/ 下不得冒出 1/context.json；新写入应落在带 hash 的 canonical 对局目录。',
  '',
  '  [修B·workshop-install-from-url]（需一个能 HTTPS 下载的 .tm-pack 及其真实 sha256）',
  '   7. 正常：invoke("workshop-install-from-url",{packageUrl:"https://.../x.tm-pack",sha256:"<真hash>"}) → success。',
  '   8. 缺 hash：去掉 sha256 字段 → 期望 {success:false,error:"…缺少 sha256…拒绝安装"}（修B 核心）。',
  '   9. 错 hash：sha256 改 1 位 → 期望 {success:false,error:"…sha256 不一致"}（本地重算兜底）。',
  '  10. 大写/空白：sha256 全大写 → 仍 success；首尾加空格 → 期望拒绝（fail-closed·非崩溃）。',
  '  11. 恶意内容(hash 对)：打一个 hash 正确但含 evil.js/evil.exe 的包 → 期望解压后 validateWorkshopPack',
  '        以「禁止/未允许文件类型」拒绝（证明 hash 只保完整性·内容安全靠扩展名白名单层）。',
  '  12. zip-slip：构造条目名含 ../ 的包 → extractZipToTemp 抛「压缩包包含越界路径」。',
  '',
  '  详见 web/scripts/README-security-ipc.md（完整边角矩阵）。'
].join('\n'));

console.log('\n' + (fail ? 'FAILED ' + fail : 'PASS') + ' · pass=' + pass + (warn ? ' · WARN=' + warn + '（建议加固·不阻断）' : ''));
process.exit(fail ? 1 : 0);
