// 打「天命新界面 Demo」绿色包：解压即玩，只给玩家看新界面的交互，不是正式更新。
// node tools/newui/build-demo.cjs [--no-zip]
// 在 E:/tianming-demo/stage 摆一份工作区副本再打包，工作区与正式版的打包配置一字不动；这份副本与正式版的差别只有：
//   1. 独立身份（productName、appId）：存档、设置在 %APPDATA%/天命新界面Demo，碰不到玩家的正式版；
//   2. 主进程带 ?ui=new&demo=1 开页；index.html 不改（改了要重算启动清单的 indexHash）；
//   3. 主进程关掉更新通道，否则一查更新就可能把 demo 升成正式版；
//   4. 带上缩小的立绘（shrink-portraits.py 的出图）、背景音乐与图标，这些都不进 git。
// 不签名：玩家首次打开 Windows 可能提示「未知发布者」。
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.env.TM_DEMO_DIR || 'E:/tianming-demo';
const NM = process.env.TM_NODE_MODULES || 'E:/tianming-edict-efficacy-20260924/node_modules';
const ICON = process.env.TM_DEMO_ICON || 'E:/tianming-release-1350-20260916/web/icon.png';
const BGM = process.env.TM_DEMO_BGM || 'E:/tianming-circuit-tier-ui-20260923/web/assets/audio';
const PRODUCT = '天命新界面Demo';
const STAGE = path.join(OUT, 'stage');
const DIST = path.join(OUT, 'dist');
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const log = (t) => console.log(`[demo ${new Date().toTimeString().slice(0, 8)}] ${t}`);
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

// 副本不带的目录：开发与预览物，打包配置本来也不收，这里不拷省时间
const SKIP_DIRS = new Set(['web/preview', 'web/docs', 'web/scripts', 'web/tools', 'web/ui/dev', 'web/_archive', 'web/_pw-scratch', 'web/generated_images', 'web/output', 'web/maps', 'web/assets/portraits', 'web/assets/audio']);
const copyWeb = () => fs.cpSync(path.join(ROOT, 'web'), path.join(STAGE, 'web'), {
  recursive: true,
  filter: (src) => !SKIP_DIRS.has(path.relative(ROOT, src).replace(/\\/g, '/')) && !path.basename(src).startsWith('.git')
});

function stage() {
  const portraits = path.join(OUT, 'portraits');
  for (const d of ['tianqi7', 'shaosong', 'tang840']) must(fs.existsSync(path.join(portraits, d)), `缺立绘 ${d}：先跑 shrink-portraits.py`);
  must(fs.existsSync(ICON), `缺图标 ${ICON}`);
  must(fs.existsSync(path.join(NM, 'electron', 'dist', 'electron.exe')), `缺 electron：${NM}`);
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(path.join(STAGE, 'resources'), { recursive: true });
  for (const f of fs.readdirSync(ROOT)) if (/^(main.*|preload-impl)\.js$/.test(f)) fs.copyFileSync(path.join(ROOT, f), path.join(STAGE, f));
  fs.copyFileSync(path.join(ROOT, 'resources/hot-update-public-key.pem'), path.join(STAGE, 'resources/hot-update-public-key.pem'));
  log('拷 web');
  copyWeb();
  log('拷立绘、音乐、图标');
  fs.cpSync(portraits, path.join(STAGE, 'web/assets/portraits'), { recursive: true });
  fs.cpSync(BGM, path.join(STAGE, 'web/assets/audio'), { recursive: true });
  fs.copyFileSync(ICON, path.join(STAGE, 'web/icon.png'));
  fs.mkdirSync(path.join(STAGE, 'scenarios'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const f of pkg.build.files.filter((x) => x.startsWith('scenarios/'))) fs.copyFileSync(path.join(ROOT, f), path.join(STAGE, f));
  patchMain();
  writePackage(pkg);
  fs.symlinkSync(NM, path.join(STAGE, 'node_modules'), 'junction');
}

function patchMain() {
  const p = path.join(STAGE, 'main-impl.js');
  let s = fs.readFileSync(p, 'utf8');
  const load = "loadFile(path.join(getActiveWebRoot(), 'index.html'))";
  must(s.split(load).length - 1 === 3, '主进程 loadFile 处数变了，核对 build-demo');
  s = s.split(load).join("loadFile(path.join(getActiveWebRoot(), 'index.html'), { query: { ui: 'new', demo: '1' } })");
  const title = "    title: '天命',\n";
  const crlf = s.includes("    title: '天命',\r\n");
  const titleAt = crlf ? "    title: '天命',\r\n" : title;
  must(s.split(titleAt).length - 1 === 1, '主进程窗口 title 处数变了，核对 build-demo');
  s = s.replace(titleAt, `    title: '${PRODUCT}',${crlf ? '\r\n' : '\n'}`);
  // 更新通道一律回「没有更新」：Demo 不查、不下、不装
  s += `
;['update-check', 'update-download', 'update-install', 'hot-update-check', 'hot-update-download-install'].forEach((ch) => {
  electronIpcMain.removeHandler(ch);
  electronIpcMain.handle(ch, async () => ({ success: false, hasUpdate: false, error: 'demo-no-update' }));
});
`;
  fs.writeFileSync(p, s);
}

function writePackage(pkg) {
  const files = pkg.build.files.filter((x) => x !== '!web/ui/**' && x !== '!web/vendor/three/**');
  must(files.length === pkg.build.files.length - 2, 'package.json 的 files 里没找到新界面的排除项');
  const demo = {
    name: 'tianming-newui-demo',
    productName: PRODUCT,
    version: pkg.version,
    description: '天命新界面试看版',
    main: pkg.main,
    dependencies: pkg.dependencies,
    build: {
      appId: 'com.tianming.newui.demo',
      productName: PRODUCT,
      directories: { output: DIST },
      files,
      npmRebuild: false,
      electronDist: path.join(NM, 'electron', 'dist'),
      electronVersion: require(path.join(NM, 'electron', 'package.json')).version,
      win: { target: [{ target: 'dir', arch: ['x64'] }], icon: 'web/icon.png', signAndEditExecutable: true, forceCodeSigning: false }
    }
  };
  fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify(demo, null, 2));
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  log('打包');
  // electron-builder 自己解 winCodeSign 会因包里的符号链接失败（Windows 无权建），先解到这里：
  // 7za x -snld winCodeSign-2.6.0.7z -o<OUT>/eb-cache/winCodeSign/winCodeSign-2.6.0（报两个符号链接错不碍事），要的只是 rcedit
  must(fs.existsSync(path.join(OUT, 'eb-cache/winCodeSign/winCodeSign-2.6.0/rcedit-x64.exe')), '缺 eb-cache 里的 winCodeSign，见上面注释');
  const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false', ELECTRON_BUILDER_CACHE: path.join(OUT, 'eb-cache') };
  execFileSync(process.execPath, [path.join(NM, 'electron-builder/cli.js'), '--win', 'dir', '--x64', '--publish', 'never'], { cwd: STAGE, stdio: 'inherit', env });
  const unpacked = path.join(DIST, 'win-unpacked');
  must(fs.existsSync(path.join(unpacked, `${PRODUCT}.exe`)), '没打出 exe');
  fs.writeFileSync(path.join(unpacked, '说明.txt'), '\ufeff' + README.replace(/\n/g, '\r\n'));
  return unpacked;
}

const README = `天命 · 新界面 Demo

这是新界面的试看版，只为看看界面和操作手感，不是正式更新。

打开：解压后双击「${PRODUCT}.exe」。第一次打开 Windows 可能提示「未知发布者」，点「更多信息」→「仍要运行」。
退出：启幕点「掩卷」，局内按 Esc 选「退出游戏」。F11 切换全屏与窗口。

须知：
- 只有 Windows 桌面版，手机和网页都还不行。
- 游戏内容停在十月，正式版之后修的问题这里可能还在，请只看界面。
- 过回合要 AI 推演，须在「典章」里填自己的地址、密钥和模型。不填也能看界面，只是过不了回合。
- 剧本工坊、创意工坊、地图编辑器不在此版。
- 存档和设置与正式版分开，互不影响。立绘比正式版小一半。
`;

function zip(unpacked) {
  const file = path.join(OUT, `${PRODUCT}-${stamp}.zip`);
  fs.rmSync(file, { force: true });
  // 压缩包里顶层是一个文件夹，解压不会散一地
  const top = path.join(DIST, PRODUCT);
  fs.renameSync(unpacked, top);
  log('压缩');
  execFileSync(path.join(NM, '7zip-bin/win/x64/7za.exe'), ['a', '-tzip', '-mx=5', '-mcu=on', file, PRODUCT], { cwd: DIST, stdio: ['ignore', 'ignore', 'inherit'] });
  log(`成：${file}  ${(fs.statSync(file).size / 1048576).toFixed(0)}MB`);
}

stage();
const unpacked = build();
if (!process.argv.includes('--no-zip')) zip(unpacked);
else log(`未压缩：${unpacked}`);
