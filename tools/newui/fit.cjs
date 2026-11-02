// 新前端版式体检：开一局，开着人物窗、志窗，把窗口换成各种大小，逐档量一遍「谁压了谁、谁出了屏、谁被挤没了」，顺手存图。
// node tools/newui/fit.cjs <出图目录> [--scn=1] [--pick=刘宗周] [--sizes=1920x1080,1280x647] [--tag=a]
// 量出来的问题打在终端上，也写进 <出图目录>/fit-<tag>.json；退出码是问题条数（可当门禁用）。
// 需要本机服务：在 web/ 下 python -m http.server 8794；同志的长渲染在跑时别用。
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
if (!out) { console.error('用法：node tools/newui/fit.cjs <出图目录> [--scn=1] [--pick=刘宗周] [--sizes=a,b] [--tag=a]'); process.exit(2); }
const scn = opt('scn', '1');
const pick = opt('pick', '刘宗周');
const tag = opt('tag', 'fit');
const SIZES = opt('sizes', '1920x1080,2560x1440,1920x969,1600x900,1536x730,1366x657,1280x647,1280x585,1180x820,1024x768,960x485,844x390')
  .split(',').map((s) => s.split('x').map(Number));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 页内量：外框互压、出屏，窗内几处非留够不可的尺寸。全用 getBoundingClientRect，CSS 像素。
const audit = (state) => {
  const vw = innerWidth, vh = innerHeight;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const shown = (e) => { if (!e) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const box = (sel) => { const e = document.querySelector(sel); return shown(e) ? e.getBoundingClientRect() : null; };
  const hit = (a, b, slack = 2) => { if (!a || !b) return 0; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > slack && h > slack ? Math.round(w * h) : 0; };
  const issues = [];
  const say = (code, text) => issues.push({ code, text });
  const px = (n) => Math.round(n);

  const parts = {
    读数条: '.scr-desk .topbar', 书目: '.scr-desk .rail', 提纲: '.scr-desk .hm-outline', 右下角: '.scr-desk .hm-corner',
    看法: '.scr-map .mm-panel', 立像: '.scr-desk .hm-me', 待办: '.scr-desk .hm-alerts', 邸报: '.scr-desk .dibao',
    人物窗: '.rw.on', 志窗: '.zw.on', 势力窗: '.rm.on'
  };
  const rects = {};
  for (const [k, s] of Object.entries(parts)) { const r = box(s); if (r) rects[k] = r; }
  // 出屏
  for (const [k, r] of Object.entries(rects)) {
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) say('出屏', `${k} 出屏 [${px(r.left)},${px(r.top)},${px(r.right)},${px(r.bottom)}]`);
  }
  // 互压（人物窗、志窗盖住左半是本意，但盖到读数条算错；立像、待办、邸报在窗底下也是本意）
  const pairs = [['读数条', '人物窗'], ['读数条', '志窗'], ['读数条', '立像'], ['读数条', '待办'], ['读数条', '邸报'], ['提纲', '读数条'], ['提纲', '书目'], ['提纲', '看法'], ['提纲', '右下角'], ['提纲', '人物窗'], ['提纲', '志窗'],
    ['书目', '右下角'], ['书目', '读数条'], ['看法', '右下角'], ['看法', '书目'], ['看法', '人物窗'], ['看法', '志窗'], ['立像', '看法'], ['立像', '右下角'], ['立像', '邸报'], ['右下角', '人物窗'], ['右下角', '志窗']];
  for (const [a, b] of pairs) { const n = hit(rects[a], rects[b]); if (n) say('互压', `${a}×${b} ${n}px²`); }
  // 书目每一颗都要看得见、点得着
  const rail = [...document.querySelectorAll('.scr-desk .rail > *')].filter(shown);
  const corner = rects.右下角;
  const railOut = rail.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > vh || (corner && hit(r, corner)); });
  if (railOut.length) say('书目', `书目 ${rail.length} 颗里 ${railOut.length} 颗被盖或出屏`);
  // 读数条里的字别被裁
  const tb = document.querySelector('.scr-desk .topbar');
  if (tb && shown(tb) && tb.scrollWidth > tb.clientWidth + 2) say('读数条', `读数条内容 ${tb.scrollWidth} 宽于条 ${tb.clientWidth}`);
  // 提纲两段
  const secs = [...document.querySelectorAll('.scr-desk .hm-outline > section')].filter(shown);
  const secScroll = secs.filter((e) => e.scrollHeight > e.clientHeight + 2).length;
  if (secs.length > 1 && secScroll > 1) say('提纲', `提纲 ${secs.length} 段有 ${secScroll} 段各自滚动`);
  for (const e of secs) { const h = e.getBoundingClientRect().height; if (h < rem * 3 && e.scrollHeight > e.clientHeight + 2) say('提纲', `提纲一段被挤到 ${px(h)}px`); }

  const metrics = { vw, vh, rem: +rem.toFixed(2), k: +(rem / 16).toFixed(3), panels: Object.fromEntries(Object.entries(rects).map(([k, r]) => [k, [px(r.left), px(r.top), px(r.right), px(r.bottom)]])) };

  // 人物窗、志窗同一路数：一处滚动，卷底不折太多行，卷首的字别压到右上按钮，内容不能横向出框
  const dock = (sel, label, min) => {
    const win = document.querySelector(sel);
    if (!win) return;
    const scroll = win.querySelector('.rw-scroll, .zw-scroll');
    const foot = win.querySelector('.rw-foot, .zw-foot');
    if (scroll) {
      const r = scroll.getBoundingClientRect();
      metrics[label] = px(r.height);
      if (r.height < rem * min) say(label, `${label}滚动区只剩 ${px(r.height)}px（${(r.height / rem).toFixed(1)}rem）`);
      if (scroll.scrollWidth > scroll.clientWidth + 1) say(label, `${label}横向溢出 ${scroll.scrollWidth - scroll.clientWidth}px`);
      // 内容里还有别的竖向滚动，就是又长出了一条小缝
      const inner = [...scroll.querySelectorAll('*')].filter((e) => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 2; });
      if (inner.length) say(label, `${label}内还有 ${inner.length} 处各自滚动（${inner[0].className}）`);
    }
    if (foot && shown(foot)) {
      const r = foot.getBoundingClientRect();
      if (r.height > rem * 7) say(label, `${label}卷底折到 ${px(r.height)}px`);
      if (r.bottom > vh + 1) say(label, `${label}卷底出屏`);
      if ([...foot.querySelectorAll('button')].some((b) => b.getBoundingClientRect().right > win.getBoundingClientRect().right)) say(label, `${label}卷底按钮出框`);
    }
    const ctl = win.querySelector('.rw-ctls, .zw-ctls')?.getBoundingClientRect();
    const title = win.querySelector('.rw-title, .zw-titles');
    if (ctl && title && hit(ctl, title.getBoundingClientRect())) say(label, `${label}名字压到右上按钮`);
    for (const e of win.querySelectorAll('.rw-title > h2, .zw-name h2')) if (e.scrollWidth > e.parentElement.clientWidth + 1) say(label, `${label}名字宽过一行`);
  };
  dock('.rw.on', '人物窗', 14);
  dock('.zw.on', '志窗', 14);
  return { state, issues, metrics };
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));

  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const clickText = (sel, t) => p.evaluate(({ s, x }) => { const e = [...document.querySelectorAll(s)].find((n) => (n.innerText || '').includes(x)); if (!e) return false; e.click(); return true; }, { s: sel, x: t });
  const key = (k) => p.evaluate((x) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: x, bubbles: true })), k);

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
  // 开局卷来得有早有晚：连着十秒都没有卷才算收干净（卷没收，底下的窗一个也开不了，量出来全是假绿）
  for (let quiet = 0; quiet < 10;) {
    if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
      quiet = 0;
      await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
      await wait(1200);
    } else { quiet++; await wait(1000); }
  }

  const report = [];
  // must：这一档必须开着的窗；没开就是走查走岔了，宁可报败也别出一张假绿的单子
  const sweep = async (state, must) => {
    if (must && !(await p.evaluate((s) => !!document.querySelector(s), must))) throw new Error(`${state}：${must} 没开着`);
    for (const [w, h] of SIZES) {
      await p.setViewportSize({ width: w, height: h });
      await wait(900);
      const r = await p.evaluate(audit, state);
      r.size = `${w}x${h}`;
      report.push(r);
      await p.screenshot({ path: path.join(out, `${tag}-${state}-${w}x${h}.jpg`), type: 'jpeg', quality: 86 });
      // 开着窗的，再滚到底拍一张：卷首收成窄带、页签吸住的样子
      const rolled = await p.evaluate(() => { const e = document.querySelector('.rw.on .rw-scroll, .zw.on .zw-scroll'); if (!e) return false; e.scrollTop = e.scrollHeight; return true; });
      if (rolled) {
        await wait(150);
        const stuck = await p.evaluate(() => {
          const win = document.querySelector('.rw.on, .zw.on');
          const hero = win.querySelector('.rw-hero, .zw-hero').getBoundingClientRect();
          const tabs = win.querySelector('.rw-tabs, .zw-tabs').getBoundingClientRect();
          const title = win.querySelector('.rw-title, .zw-titles').getBoundingClientRect();
          return { heroBottom: Math.round(hero.bottom), tabsTop: Math.round(tabs.top), titleTop: Math.round(title.top), titleBottom: Math.round(title.bottom) };
        });
        if (stuck.titleTop < 0 || stuck.titleBottom > stuck.heroBottom) r.issues.push({ code: '窄带', text: `窄带露不全名字（${JSON.stringify(stuck)}）` });
        if (Math.abs(stuck.tabsTop - stuck.heroBottom) > 8 && stuck.tabsTop < stuck.heroBottom) r.issues.push({ code: '窄带', text: '页签没吸在窄带之下' });
        await p.screenshot({ path: path.join(out, `${tag}-${state}-${w}x${h}-roll.jpg`), type: 'jpeg', quality: 86 });
        await p.evaluate(() => { const e = document.querySelector('.rw.on .rw-scroll, .zw.on .zw-scroll'); if (e) e.scrollTop = 0; });
      }
      console.log(`${state.padEnd(6)} ${`${w}x${h}`.padEnd(10)} 1rem=${String(r.metrics.rem).padEnd(6)} ${r.issues.length ? r.issues.map((i) => i.text).join('；') : '无'}`);
    }
    await p.setViewportSize({ width: 1920, height: 1080 });
    await wait(600);
  };

  await sweep('home');

  // 人物窗：从寻人里点一个有家人的
  await key('2');
  await wait(1500);
  await p.evaluate((n) => { const i = document.querySelector('.xr-search'); if (i) { i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); } }, pick);
  await wait(500);
  await p.evaluate((n) => { const r = [...document.querySelectorAll('.xr-row')].find((x) => x.dataset.person === n) || document.querySelector('.xr-row'); if (r) r.querySelector('.xr-main').click(); }, pick);
  await wait(1200);
  await p.evaluate(() => { const s = document.querySelector('.xr-shut'); if (s) s.click(); });
  await wait(800);
  await sweep('person', '.rw.on');
  await p.evaluate(() => document.querySelectorAll('.rw.on .rw-tabs > button')[3]?.click());
  await wait(500);
  await sweep('bio', '.rw.on');
  // 只收开着的窗：都收了再按 Esc 就是暂停卷
  for (let i = 0; i < 3 && await p.evaluate(() => !!document.querySelector('.rw.on, .xr.on')); i++) { await key('Escape'); await wait(800); }

  // 志窗：镜头推到府州档，点舆图上一块地，小签上开方志；再开它所属省道的通志
  await p.evaluate(() => document.querySelectorAll('.mm-tiers .mm')[2]?.click());
  await wait(3500);
  // 窗口刚换回来，舆图要一会儿才认得出点击；多点几处
  for (let tries = 0; tries < 3 && !(await p.evaluate(() => !!document.querySelector('.zw.on'))); tries++) {
    for (const [x, y] of [[1080, 560], [1000, 480], [1200, 600], [900, 640]]) {
      await p.mouse.click(x, y);
      await wait(1000);
      if (await clickText('.q-yapai', '方志')) break;
    }
    await wait(1500);
  }
  await wait(2500);
  console.log('方志开了', await p.evaluate(() => !!document.querySelector('.zw.on')));
  await sweep('land', '.zw.on');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.zw.on .fz-crumbs a')].pop(); if (b) b.click(); });
  await wait(2500);
  await sweep('circuit', '.zw.on');
  // 势力窗：同一扇志窗，点志名上头路径里的势力名开
  await p.evaluate(() => document.querySelector('.zw.on .fz-crumbs a')?.click());
  await wait(2500);
  await sweep('realm', '.zw.sw.on');

  fs.writeFileSync(path.join(out, `fit-${tag}.json`), JSON.stringify({ errs, report }, null, 1));
  const n = report.reduce((a, r) => a + r.issues.length, 0);
  console.log(`共 ${n} 条；页面报错 ${errs.length}`, errs.slice(0, 3));
  await b.close();
  process.exit(Math.min(n, 100));
})().catch((e) => { console.error(e); process.exit(101); });
