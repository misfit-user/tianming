// 新前端巡看：开一局，把启幕、主画面、案上诸事、诸册、工具卷走一遍，逐张存图，末了写 manifest.json 备查。
// node tools/newui/tour.cjs <出图目录> [--scn=1] [--size=1920x1080] [--tag=t1] [--as=宗泽] [--pick=岳飞] [--only=home,fiscal]
//   --scn   第几卷（1 天启 2 绍宋 3 晚唐）；--as 借此人视角看通用一套（不走 ?as=，那会挂「借视角」横幅以外还换开局流程）
//   --only  只拍这几步（逗号分隔的步名），调一页时省得全走
//   --exe   不开浏览器，改验打包好的 exe（经调试口连上去，用户数据放 --profile 指的目录，不写玩家目录）
// 需要本机服务：在 web/ 下 python -m http.server 8794；playwright-core 与 Chromium 路径同 web/ui/dev/shoot.cjs。
// 一次只开一个浏览器；同志的长渲染在跑时别用（见记忆 feedback-no-heavy-probes-during-user-render）。
'use strict';
const path = require('path');
const fs = require('fs');

const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const base = process.env.TM_UI_BASE || 'http://127.0.0.1:8794/';
const { chromium } = require(core);
const { spawn, execFileSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (name, fallback) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : fallback; };
const out = args.find((a) => !a.startsWith('--'));
if (!out) { console.error('用法：node tools/newui/tour.cjs <出图目录> [--scn=1] [--size=1920x1080] [--tag=t1] [--as=宗泽] [--pick=岳飞] [--only=a,b]'); process.exit(2); }
const scn = opt('scn', '1');
const tag = opt('tag', `s${scn}`);
const viewAs = opt('as', '');
const pick = opt('pick', '');
const only = opt('only', '') ? new Set(opt('only', '').split(',')) : null;
let [W, H] = opt('size', '1920x1080').split('x').map(Number);
const exePath = opt('exe', '');
const profile = opt('profile', path.join(out || '.', 'exe-profile'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 屏上露出的英文词、T3、undefined、NaN 顺手收起来（人名里的西文放过不了，看的时候自己分）
const SWEEP = /[A-Za-z_]{3,}[\w.]*|\bT\d+\b|NaN|undefined|\[object/g;
const SWEEP_OK = /^(AI|API|HTTP|Ctrl|Enter|Esc|Shift|Tab|Alt)$/;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  let b, p, child = null;
  if (exePath) {
    const PORT = 9333;
    child = spawn(exePath, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--disable-features=CalculateNativeWinOcclusion'], { stdio: 'ignore', detached: false });
    for (let i = 0; i < 60 && !b; i++) { await wait(1000); try { b = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (_e) { /* 还没起来 */ } }
    if (!b) throw new Error('连不上 exe 的调试口');
    for (let i = 0; i < 60 && !p; i++) { p = b.contexts().flatMap((c) => c.pages()).find((x) => /index\.html/.test(x.url())); if (!p) await wait(1000); }
    if (!p) throw new Error('exe 没开出 index.html');
    console.log('页面', decodeURI(p.url()).slice(-60));
    // 验包时别盖住屏幕上正在用的东西：退出全屏，把窗口挪到屏幕外（调试口照样能截图）
    await p.evaluate(() => window.tianming && window.tianming.setFullScreen(false));
    await wait(1500);
    const move = "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\"user32.dll\")]public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int cx,int cy,uint f);}';"
      + `$h=(Get-Process -Id ${child.pid}).MainWindowHandle;[W]::SetWindowPos($h,[IntPtr]::Zero,-4000,0,${W},${H},0x14)`;
    try { execFileSync('powershell', ['-NoProfile', '-Command', move], { stdio: 'ignore' }); } catch (e) { console.log('挪窗失败', e.message.slice(0, 120)); }
    await wait(1500);
    [W, H] = await p.evaluate(() => [innerWidth, innerHeight]);
    console.log('视口', W, H);
  } else {
    b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
    p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  }
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  p.on('requestfailed', (r) => errs.push(`reqfail ${r.url().slice(-110)}`));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`http${r.status()} ${r.url().slice(-110)}`); });
  const shots = [];

  const snap = async (id, group, label) => {
    const file = `${tag}-${id}.jpg`;
    const latin = await p.evaluate(({ re, ok }) => {
      const hits = (document.body.innerText || '').match(new RegExp(re, 'g')) || [];
      return [...new Set(hits)].filter((m) => !new RegExp(ok).test(m)).slice(0, 30);
    }, { re: SWEEP.source, ok: SWEEP_OK.source });
    await p.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 88 });
    shots.push({ id, group, label, file, size: `${W}x${H}`, tag, latin });
    console.log(`  拍 ${id}　${label}${latin.length ? `　[英文 ${latin.slice(0, 6).join(' ')}]` : ''}`);
  };
  const click = (sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].pop(); if (!e) return false; e.click(); return true; }, sel);
  const clickFirst = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const clickText = (sel, text) => p.evaluate(({ s, t }) => { const e = [...document.querySelectorAll(s)].find((x) => (x.innerText || x.textContent || '').trim().includes(t)); if (!e) return false; e.click(); return true; }, { s: sel, t: text });
  const TOOL = { 案卷目录: '存', 典章: '典', 问天: '问', 全部变量: '总', 暂停: '暂' };   // 工具钮的 title 已收进签条，按钮上的字认
  const clickTool = (title) => p.evaluate((t) => { const e = [...document.querySelectorAll('.scr-desk .tools button')].find((x) => x.textContent.trim().startsWith(t)); if (!e) return false; e.click(); return true; }, TOOL[title]);
  const key = (k) => p.evaluate((x) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: x, bubbles: true })), k);
  const exists = (sel) => p.evaluate((s) => !!document.querySelector(s), sel);
  // 收回主画面：开着的卷、窗、册一层层 Esc，书案让位的页回来后等镜头走完
  const shut = async () => {
    for (let i = 0; i < 5; i++) {
      const open = await p.evaluate(() => !document.querySelector('.scr-desk.on') || !!document.querySelector('.rw.on, .xr.on, .ce-ov.on, .wt-ov.on, .q-juan-veil, .q-kewei'));
      if (!open) break;
      await key('Escape');
      await wait(900);
    }
    await wait(1200);
  };
  const want = (id) => !only || only.has(id);
  const step = async (id, group, label, go, settle = 2200) => {
    if (!want(id)) return;
    try {
      const r = await go();
      if (r === false) { console.log(`  缺 ${id}　${label}（入口不在）`); shots.push({ id, group, label, missing: true, tag }); await shut(); return; }
      await wait(settle);
      await snap(id, group, label);
    } catch (e) { console.log(`  败 ${id}　${e.message.slice(0, 200)}`); shots.push({ id, group, label, failed: e.message.slice(0, 200), tag }); }
    await shut();
  };

  // ---------- 启幕 ----------
  console.log(`== ${tag} 第${scn}卷 ${W}x${H}`);
  if (!exePath) await p.goto(`${base}index.html?ui=new`, { timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 240000 });
  await wait(2500);
  if (want('title')) await snap('title', '启幕', '启幕');
  await click('.board button.primary');
  await wait(1500);
  await p.evaluate((n) => { const e = document.querySelector(`.pick-list .pick-item:nth-child(${n})`); if (e) e.click(); }, scn);
  await wait(500);
  if (want('pick')) await snap('pick', '启幕', '开卷·择本');
  await clickFirst('.q-juan footer .q-yapai');
  await p.waitForSelector('.opening', { timeout: 120000 });
  await wait(2500);
  if (want('opening')) await snap('opening', '启幕', '开场卷');
  await clickFirst('.q-juan footer .q-yapai');
  await p.waitForSelector('.scr-desk.on', { timeout: 300000 });
  await wait(6500);
  for (let k = 0; k < 5; k++) {
    if (!(await exists('.q-juan-veil'))) break;
    if (want('welcome')) await snap(`welcome${k}`, '启幕', k ? `开局卷之${k + 1}` : '开局卷·天下大势');
    await click('.q-juan-veil footer .q-yapai');
    await wait(1500);
  }
  await wait(3000);

  // ---------- 主画面 ----------
  if (want('home')) await snap('home', '主画面', '舆图为家（默认主画面）');
  if (want('desk')) { await click('.hm-desk'); await wait(5000); await snap('desk', '主画面', '升起书案（御案）'); await click('.hm-desk'); await wait(5000); }
  if (viewAs) {
    await p.evaluate((n) => window.__newui.game.setViewAs(n), viewAs);
    await wait(3500);
    if (want('as-home')) await snap('as-home', '通用视角', `借${viewAs}视角·主画面`);
    const books = await p.evaluate(() => [...document.querySelectorAll('.scr-desk .rail > *')].map((x) => x.dataset.name));
    for (let i = 0; i < books.length; i++) {
      if (books[i] === '舆图') continue;
      await step(`as-book${i + 1}`, '通用视角', `${viewAs}·${books[i]}`, () => key(String((i + 1) % 10)));
    }
    await step('as-self', '通用视角', `${viewAs}·本人人物窗`, () => click('.hm-xiang'), 1500);
    await p.evaluate(() => window.__newui.game.setViewAs && window.__newui.game.setViewAs(null));
    await wait(3000);
    await shut();
  }

  // ---------- 案上诸事（五渠道）：书案让位，要等镜头俯下去 ----------
  const ring = (i) => () => p.evaluate((n) => { const e = document.querySelectorAll('.hm-ring .hm-btn')[n]; if (!e) return false; e.click(); return true; }, i);
  await step('edict', '案上诸事', '撰写诏书', ring(0), 5000);
  await step('docket', '案上诸事', '批阅奏疏', ring(1), 5000);
  await step('letters', '案上诸事', '传书', ring(2), 5000);
  await step('roster', '案上诸事', '召对·名单', ring(3), 3000);
  await step('conduct', '案上诸事', '行止', ring(4), 5000);
  await step('issues', '案上诸事', '时政花笺（待议）', () => click('.hm-alert.t-qing'), 2500);

  // ---------- 人物 ----------
  if (want('person') || want('finder')) {
    await click('.hm-xiang');
    await wait(1500);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.rw.on .rw-tabs > button')].map((x) => x.innerText.trim()));
    for (let i = 0; i < tabs.length; i++) {
      await p.evaluate((n) => document.querySelectorAll('.rw.on .rw-tabs > button')[n].click(), i);
      await wait(700);
      if (want('person')) await snap(`person${i}`, '人物', `人物窗·${tabs[i]}`);
    }
    await shut();
    await key('2');
    await wait(1500);
    if (want('finder')) await snap('finder', '人物', '寻人');
    if (pick) {
      await p.evaluate((n) => { const i = document.querySelector('.xr-search'); if (i) { i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); } }, pick);
      await wait(500);
      await p.evaluate((n) => { const r = [...document.querySelectorAll('.xr-row')].find((x) => x.dataset.person === n); if (r) r.querySelector('.xr-main').click(); }, pick);
      await wait(1500);
      if (want('finder')) await snap('picked', '人物', `人物窗·${pick}`);
    }
    await shut();
    await shut();
  }

  // ---------- 诸册（数字键）：按书目实有的走 ----------
  const rail = await p.evaluate(() => [...document.querySelectorAll('.scr-desk .rail > *')].map((x) => x.dataset.name));
  for (let i = 0; i < rail.length; i++) {
    if (rail[i] === '舆图' || rail[i] === '人物') continue;
    await step(`book${i + 1}`, '诸册', rail[i], () => key(String((i + 1) % 10)), 2500);
  }
  await step('guoshi', '诸册', '国势册', () => click('.gauges .link'), 2500);

  // ---------- 舆图上点一块地 ----------
  await step('region', '舆图', '点一块地（志窗）', async () => { await p.mouse.click(Math.round(W * 0.56), Math.round(H * 0.5)); }, 2500);

  // ---------- 工具卷 ----------
  await step('saves', '工具', '案卷目录', () => clickTool('案卷目录'));
  await step('settings', '工具', '典章', () => clickTool('典章'));
  await step('wentian', '工具', '问天', () => clickTool('问天'), 3000);
  await step('allvars', '工具', '全部变量', () => clickTool('全部变量'));
  await step('pause', '工具', '暂停卷', () => clickTool('暂停'), 1200);
  await step('help', '工具', '帮助', async () => { await clickTool('暂停'); await wait(900); return clickText('.pz-item', '帮助'); });

  // ---------- 过回合 ----------
  await step('settle', '过回合', '过回合确认', () => click('.scr-desk .tuiyan'), 1800);

  // ---------- 验包：更新通道关着、退出走得通 ----------
  if (exePath) {
    const upd = await p.evaluate(async () => { try { return await window.tianming.checkForUpdate(); } catch (e) { return String(e.message); } });
    console.log('  查更新回', JSON.stringify(upd).slice(0, 120));
    await clickTool('暂停');
    await wait(900);
    console.log('  退出钮', await clickText('.pz-item', '退出游戏'));
    await wait(900);
    await p.evaluate(() => { const b = [...document.querySelectorAll('.q-juan-veil footer button, .q-juan footer button')].find((x) => x.textContent.trim() === '退出'); if (b) b.click(); }).catch(() => {});
    const gone = await new Promise((r) => { const t = setTimeout(() => r(false), 40000); child.once('exit', () => { clearTimeout(t); r(true); }); });
    console.log('  点退出后进程', gone ? '已退' : '40 秒没退');
  }

  fs.writeFileSync(path.join(out, `manifest-${tag}.json`), JSON.stringify({ tag, scn, viewAs, size: `${W}x${H}`, shots, errs: [...new Set(errs)].slice(0, 40) }, null, 1));
  console.log(`== ${tag} 完：${shots.filter((s) => s.file).length} 张，缺 ${shots.filter((s) => s.missing).length}，败 ${shots.filter((s) => s.failed).length}，控制台错 ${new Set(errs).size}`);
  if (child) { try { child.kill(); } catch (_e) { /* 已退 */ } } else await b.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
