// 人物窗、志窗逐页留影：开一局，把这两扇窗的每一页签、几类人物、几处地块都拍下来，改版式时一眼看全。
// node tools/newui/windows.cjs <出图目录> [--scn=1] [--size=1920x1080] [--tag=w] [--people=刘宗周,朱由检] [--only=person|land]
// 需要本机服务：在 web/ 下 python -m http.server 8794；同志的长渲染在跑时别用。
// 走不到的窗直接报败退出，不留一套假绿的图。
'use strict';
const fs = require('fs');
const path = require('path');

const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const base = process.env.TM_UI_BASE || 'http://127.0.0.1:8794/';
const { chromium } = require(core);

const args = process.argv.slice(2);
const opt = (name, fallback) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : fallback; };
const out = args.find((a) => !a.startsWith('--'));
if (!out) { console.error('用法：node tools/newui/windows.cjs <出图目录> [--scn=1] [--size=1920x1080] [--tag=w] [--people=a,b] [--only=person|land]'); process.exit(2); }
const scn = opt('scn', '1');
const tag = opt('tag', 'w');
const only = opt('only', '');
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const PEOPLE = opt('people', '刘宗周,朱由检,魏忠贤').split(',').filter(Boolean);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));

  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const clickText = (sel, t) => p.evaluate(({ s, x }) => { const e = [...document.querySelectorAll(s)].find((n) => (n.innerText || '').includes(x)); if (!e) return false; e.click(); return true; }, { s: sel, x: t });
  const key = (k) => p.evaluate((x) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: x, bubbles: true })), k);
  const snap = async (name) => { await p.screenshot({ path: path.join(out, `${tag}-${name}.jpg`), type: 'jpeg', quality: 88 }); console.log(name); };
  const roll = (sel, to) => p.evaluate(([s, t]) => { const e = document.querySelector(s); if (e) e.scrollTop = t === 'end' ? e.scrollHeight : t; }, [sel, to]);

  await p.goto(`${base}index.html?ui=new`, { timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 240000 });
  await wait(2000);
  await click('.board button.primary');
  await wait(1500);
  await p.evaluate((n) => { const e = document.querySelector(`.pick-list .pick-item:nth-child(${n})`); if (e) e.click(); }, scn);
  await wait(500);
  await click('.q-juan footer .q-yapai');
  await p.waitForSelector('.opening', { timeout: 120000 });
  await wait(1500);
  await click('.q-juan footer .q-yapai');
  await p.waitForSelector('.scr-desk.on', { timeout: 300000 });
  await wait(6000);
  // 开局卷来得有早有晚：连着十秒都没有卷才算收干净
  for (let quiet = 0; quiet < 10;) {
    if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
      quiet = 0;
      await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
      await wait(1200);
    } else { quiet++; await wait(1000); }
  }

  if (only !== 'land') {
    // 人物：从寻人里点进去，四个页签各拍一张，再滚到底拍窄带
    for (const n of PEOPLE) {
      if (!(await p.evaluate(() => !!document.querySelector('.xr.on')))) { await key('2'); await wait(1200); }
      await p.evaluate((who) => { const i = document.querySelector('.xr-search'); if (i) { i.value = who; i.dispatchEvent(new Event('input', { bubbles: true })); } }, n);
      await wait(500);
      const hit = await p.evaluate((who) => { const r = [...document.querySelectorAll('.xr-row')].find((x) => x.dataset.person === who); if (!r) return false; r.querySelector('.xr-main').click(); return true; }, n);
      if (!hit) { console.log(`寻人里没有 ${n}，跳过`); continue; }
      await wait(900);
      await p.evaluate(() => { const s = document.querySelector('.xr-shut'); if (s) s.click(); });
      await wait(700);
      if (!(await p.evaluate(() => !!document.querySelector('.rw.on')))) throw new Error(`${n}：人物窗没开`);
      for (const t of [0, 1, 2, 3]) {
        await p.evaluate((k) => document.querySelectorAll('.rw.on .rw-tabs > button')[k]?.click(), t);
        await wait(350);
        await snap(`p-${n}-${t}`);
      }
      await roll('.rw.on .rw-scroll', 'end');
      await wait(200);
      await snap(`p-${n}-roll`);
      await roll('.rw.on .rw-scroll', 0);
    }
    // 只收开着的窗：都收了再按 Esc 就是暂停卷
    for (let i = 0; i < 3 && await p.evaluate(() => !!document.querySelector('.rw.on, .xr.on')); i++) { await key('Escape'); await wait(700); }
  }

  if (only !== 'person') {
    // 地块：镜头推到府州档，点舆图上一块地开方志，逐检签拍；再开通志、势力
    await p.evaluate(() => document.querySelectorAll('.mm-tiers .mm')[2]?.click());
    await wait(3500);
    const sx = W / 1920, sy = H / 1080;
    for (let tries = 0; tries < 3 && !(await p.evaluate(() => !!document.querySelector('.zw.on'))); tries++) {
      for (const [x, y] of [[1080, 560], [1000, 480], [1200, 600], [900, 640]]) {
        await p.mouse.click(x * sx, y * sy);
        await wait(1000);
        if (await clickText('.q-yapai', '方志')) break;
      }
      await wait(1500);
    }
    await wait(2500);
    if (!(await p.evaluate(() => !!document.querySelector('.zw.on')))) throw new Error('方志没开');
    const slips = async (prefix) => {
      const n = await p.evaluate(() => document.querySelectorAll('.zw.on .zw-tabs > button').length);
      for (let i = 0; i < n; i++) {
        await p.evaluate((k) => document.querySelectorAll('.zw.on .zw-tabs > button')[k]?.click(), i);
        await wait(350);
        await snap(`${prefix}-${i}`);
      }
    };
    await slips('z');
    await roll('.zw.on .zw-scroll', 'end');
    await wait(200);
    await snap('z-roll');
    await roll('.zw.on .zw-scroll', 0);
    await p.evaluate(() => { const c = [...document.querySelectorAll('.zw.on .fz-crumbs a')].pop(); if (c) c.click(); });
    await wait(2500);
    await slips('c');
    await p.evaluate(() => document.querySelector('.zw.on .fz-crumbs a')?.click());
    await wait(2500);
    if (!(await p.evaluate(() => !!document.querySelector('.zw.sw.on')))) throw new Error('势力窗没开');
    await slips('r');
  }

  fs.writeFileSync(path.join(out, `windows-${tag}.json`), JSON.stringify({ errs }, null, 1));
  console.log(`页面报错 ${errs.length}`, errs.slice(0, 3));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
