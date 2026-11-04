// 同地规矩在界面上管不管用：同一地块的能召对、不能写信；别的地块反过来；在路上的两样都看情形。人物窗的按钮、召对名册、问对入口都量。
// node tools/newui/gate.cjs <场景> <同块的人> <别块的人>；需要本机服务：在 web/ 下 python -m http.server 8794
'use strict';
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const [scn, nearName, farName] = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const p = await (await b.newContext({ viewport: { width: 1536, height: 864 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message.slice(0, 180)); console.log('  页面报错', e.message.slice(0, 180)); });
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  await p.goto('http://127.0.0.1:8794/index.html?ui=new', { timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 240000 });
  await wait(2000);
  await click('.board button.primary');
  await wait(1500);
  await p.evaluate((n) => document.querySelector(`.pick-list .pick-item:nth-child(${n})`)?.click(), scn);
  await wait(500);
  await click('.q-juan footer .q-yapai');
  await p.waitForSelector('.opening', { timeout: 120000 });
  await wait(1500);
  await click('.q-juan footer .q-yapai');
  await p.waitForSelector('.scr-desk.on', { timeout: 300000 });
  await wait(6000);
  for (let quiet = 0; quiet < 10;) {
    if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
      quiet = 0;
      await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
      await wait(1200);
    } else { quiet++; await wait(1000); }
  }
  console.log(`场景${scn}`);
  const buttons = async (who) => {
    if (!(await p.evaluate(() => !!document.querySelector('.xr.on')))) { await p.keyboard.press('2'); await wait(1200); }
    await p.evaluate((n) => { const i = document.querySelector('.xr-search'); if (i) { i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); } }, who);
    await wait(500);
    const hit = await p.evaluate((n) => { const r = [...document.querySelectorAll('.xr-row')].find((x) => x.dataset.person === n); if (!r) return false; r.querySelector('.xr-main').click(); return true; }, who);
    await wait(900);
    await p.evaluate(() => document.querySelector('.xr-shut')?.click());
    await wait(800);
    if (!hit) return null;
    return p.evaluate(() => {
      const on = document.querySelector('.rw.on');
      if (!on) return null;
      const list = [...on.querySelectorAll('footer button, .rw-foot button, .rw-acts button')];
      const out = {};
      for (const x of list) out[x.textContent.trim()] = { off: x.disabled || x.classList.contains('off') || x.getAttribute('aria-disabled') === 'true', why: x.title || '' };
      return { place: on.querySelector('.rw-place')?.textContent.trim() || '', go: !!on.querySelector('.rw-placego'), buttons: out };
    });
  };
  const near = await buttons(nearName);
  console.log(`  同块 ${nearName}`, JSON.stringify(near));
  const far = await buttons(farName);
  console.log(`  别块 ${farName}`, JSON.stringify(far));
  const AUD = /召对|问对|见/;
  const LET = /拟书|写信|传书|鸿雁/;
  const pick = (r, re) => r && Object.entries(r.buttons).find(([k]) => re.test(k));
  const na = pick(near, AUD), nl = pick(near, LET), fa = pick(far, AUD), fl = pick(far, LET);
  check(!!na && !na[1].off, `同块的能召对（${na && na[0]}）`);
  check(!!nl && nl[1].off, `同块的不必写信（${nl && nl[0]}：${nl && nl[1].why}）`);
  check(!!fa && fa[1].off, `别块的不能召对（${fa && fa[0]}：${fa && fa[1].why}）`);
  check(!!fl && !fl[1].off, `别块的能写信（${fl && fl[0]}）`);
  // 问对入口：内核的门
  const k = await p.evaluate(([a, c]) => {
    const f = (n) => (window.GM.chars || []).find((x) => x.name === n);
    return { near: _wdIsAtCapital(f(a)), far: _wdIsAtCapital(f(c)), nearCourt: _isAtCapital(f(a)), farCourt: _isAtCapital(f(c)) };
  }, [nearName, farName]);
  check(k.near && k.nearCourt && !k.far && !k.farCourt, '问对、朝会的门都按地块');
  // 召对名册
  await p.evaluate(() => [...document.querySelectorAll('.hm-btn')].find((n) => n.querySelector('b')?.textContent === '见')?.click());
  await wait(1500);
  const roster = await p.evaluate(([a, c]) => {
    const t = document.body.innerText;
    const names = [...document.querySelectorAll('.q-juan-veil [data-person]')].map((x) => x.dataset.person);
    return { nearListed: names.includes(a), farListed: names.includes(c), count: names.length, hasAwayNote: /不在此地|远在|外任|在外/.test(t) };
  }, [nearName, farName]);
  console.log('  名册', JSON.stringify(roster));
  check(roster.nearListed, '同块的在召对名册上');
  check(errs.length === 0, `页面报错 ${errs.length}`);
  await b.close();
  console.log(`共 ${bad} 处问题`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(101); });
