// 人多的地块拍下来：人物窗点「方志」进顺天府、亳州、长安，看一排小像、人物卷、四邻；通志人物；势力窗在册人物；窄窗。用法：zw-folk.cjs <出图目录> <场景> <人物名> [WxH]
const fs = require('fs');
const path = require('path');
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const [out, scn, who, size] = process.argv.slice(2);
const [W, H] = (size || '1536x864').split('x').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) bad++; };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message.slice(0, 180)); console.log('  页面报错', e.message.slice(0, 180)); });
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const clickText = (sel, text) => p.evaluate(([s, t]) => { const e = [...document.querySelectorAll(s)].find((x) => x.textContent.trim().includes(t)); if (!e) return false; e.click(); return true; }, [sel, text]);
  const snap = (n) => p.screenshot({ path: path.join(out, `s${scn}-${n}.jpg`), type: 'jpeg', quality: 88 });
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
  console.log(`场景${scn} ${who}`);
  // 入图：镜头推到府州档
  await p.evaluate(() => document.querySelectorAll('.mm-tiers .mm')[2]?.click());
  await wait(3500);
  // 让两个人上路：一个正赶来，一个从此地过境
  const road = await p.evaluate((n) => {
    const g = window.GM;
    const target = g.chars.find((c) => c.name === n);
    const here = target && target.location;
    const same = (a, b) => _isSameLocation(a, b);
    const far = g.chars.find((c) => c && c.alive !== false && !c.isPlayer && c.name && c.name !== n && c.location && !c._travelTo && !same(c.location, here) && _ltRouteKm(c.location, here) > 500 && window.TMMapLocations.placeRegionIds(c.location, g).length === 1);
    const local = g.chars.find((c) => c && c.alive !== false && !c.isPlayer && c.name && c.name !== n && c.location && !c._travelTo && same(c.location, here));
    const out = {};
    if (far) { out.coming = far.name; out.comingRes = _tmMoveCharToward(far, here, '奉诏'); }
    if (local) { const dest = far ? far._travelFrom : ''; out.passing = local.name; out.passingRes = _tmMoveCharToward(local, dest, '外放'); out.dest = dest; }
    return out;
  }, who);
  console.log('  上路', JSON.stringify(road));
  // 悬停小签：扫一扫有人的地块
  const pts = [];
  for (let y = 120; y < H - 200; y += 60) for (let x = 520; x < W - 280; x += 70) pts.push([x, y]);
  let tipText = '';
  for (const [x, y] of pts) {
    await p.mouse.move(x, y);
    await wait(90);
    tipText = await p.evaluate(() => { const t = document.querySelector('.map-tip:not(.hide)'); return t ? t.textContent : ''; });
    if (tipText.includes('此地')) break;
  }
  console.log('  悬停', tipText);
  check(tipText.includes('此地'), '悬停小签写着此地几人');
  await snap('tip');
  // 寻人开人物窗
  await p.keyboard.press('2');
  await wait(1200);
  const search = await p.evaluate((n) => { const i = document.querySelector('.xr-search'); if (!i) return false; i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); return true; }, who);
  await wait(500);
  const picked = await p.evaluate((n) => { const r = [...document.querySelectorAll('.xr-row')].find((x) => x.dataset.person === n); if (!r) return false; r.querySelector('.xr-main').click(); return true; }, who);
  await wait(900);
  await p.evaluate(() => document.querySelector('.xr-shut')?.click());
  await wait(900);
  console.log('  ', JSON.stringify({ search, picked, person: await p.evaluate(() => !!document.querySelector('.rw.on')) }));
  await snap('person');
  const go = await click('.rw-placego');
  check(go, '人物窗有「方志」');
  await wait(2500);
  const r = await p.evaluate(() => {
    const zw = document.querySelector('.zw.on');
    if (!zw) return { on: false };
    const t = (s) => zw.querySelector(s)?.textContent.trim() || '';
    return { on: true, name: t('.zw-titles h2'), head: t('.fz-folkhead'), faces: [...zw.querySelectorAll('.fz-folkbar .fz-face')].length, facesShown: [...zw.querySelectorAll('.fz-folkbar .fz-face')].filter((x) => x.offsetHeight > 0).length,
      tab: t('.fz-slip.on'), sections: [...zw.querySelectorAll('.zw-body .fz-sub h4')].map((x) => x.textContent), rows: zw.querySelectorAll('.fz-fk').length, nb: zw.querySelectorAll('.fz-nb').length };
  });
  console.log('  方志', JSON.stringify(r));
  check(r.on && r.tab.includes('人物'), '开到人物卷');
  check(r.rows > 0, '人物卷列得出人');
  await snap('z-people');
  await p.evaluate(() => { document.querySelector('.zw.on .zw-scroll').scrollTop = 99999; });
  await wait(400);
  await snap('z-people-end');
  await p.evaluate(() => { document.querySelector('.zw.on .zw-scroll').scrollTop = 0; document.querySelectorAll('.zw.on .zw-tabs > button')[1]?.click(); });
  await wait(500);
  await snap('z-huyi');
  // 点一张小像进人物窗
  const face = await p.evaluate(() => { const e = document.querySelector('.zw.on .fz-folkbar .fz-face'); if (!e) return ''; const n = e.dataset.person; e.click(); return n; });
  await wait(1000);
  const toPerson = await p.evaluate(() => !!document.querySelector('.rw.on'));
  console.log('  点小像', face, toPerson);
  // 回方志再展通志
  await click('.rw-placego');
  await wait(1500);
  const cir = await p.evaluate(() => { const a = [...document.querySelectorAll('.zw.on .fz-crumbs a')].find((x) => x.title === '展通志'); if (!a) return false; a.click(); return true; });
  await wait(1500);
  if (cir) {
    await p.evaluate(() => [...document.querySelectorAll('.zw.on .zw-tabs > button')].find((x) => x.textContent.includes('人物'))?.click());
    await wait(500);
    await snap('c-people');
    const c = await p.evaluate(() => { const z = document.querySelector('.zw.on'); return { groups: z.querySelectorAll('.fz-cfolk > section').length, faces: z.querySelectorAll('.fz-cfolk .fz-face').length, sw: z.querySelector('.zw-scroll').scrollWidth, cw: z.querySelector('.zw-scroll').clientWidth }; });
    console.log('  通志', JSON.stringify(c));
    check(c.groups > 0 && c.sw <= c.cw + 1, '通志人物按州分，没有横向滚动');
  }
  // 势力窗
  const fac = await p.evaluate(() => { const a = [...document.querySelectorAll('.zw.on .fz-crumbs a')].find((x) => x.title === '展势力'); if (!a) return false; a.click(); return true; });
  await wait(2000);
  if (fac) {
    await snap('r-junchen');
    const s = await p.evaluate(() => { const z = [...document.querySelectorAll('.zw.on')].pop(); return { faces: z.querySelectorAll('.rm-members .fz-face').length, more: z.querySelector('.rm-members-more')?.textContent || '', leadFaces: z.querySelectorAll('.rm-people .rm-face').length, leadGlyph: z.querySelectorAll('.rm-people .rm-glyph').length }; });
    console.log('  势力', JSON.stringify(s));
    check(s.faces > 0, '在册人物成小像');
    await p.evaluate(() => { const z = [...document.querySelectorAll('.zw.on .zw-scroll')].pop(); if (z) z.scrollTop = 99999; });
    await wait(500);
    await snap('r-junchen-end');
  }
  check(errs.length === 0, `页面报错 ${errs.length}`);
  await b.close();
  console.log(`共 ${bad} 处问题`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(101); });
