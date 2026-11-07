// 钱名走查：钱的名目、单位跟朝代走（明清银、两，唐宋钱、贯），界面上不许写死。
// 开一局，按右列书目开军务、科举、宫闱（翻宫苑、奇珍两签），各点开第一项；再从本人人物窗进方志逐签读。
// 只读打开的那本册或方志窗，按内核此刻的钱名（CurrencyUnit.getUnit、_moneyNoun）找别朝的单位；另验舆图军旗兵数的进位。
// node tools/newui/money-names.cjs <出图目录> <第几卷 1天启 2绍宋 3晚唐> [WxH]
// 数和单位常分在两个元素里（innerText 中间插换行），故逐个读小元素自身的 textContent（不插换行），另数单独成块的单位字。
// 先往册里塞一条「三万｜两」「约费银五千」自检，尺子抓不到就停（量出零算没查到）。需要本机服务 8794。
'use strict';
const fs = require('fs');
const path = require('path');
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const [out, scn, size] = process.argv.slice(2);
if (!out || !scn) { console.error('用法：node tools/newui/money-names.cjs <出图目录> <第几卷 1天启 2绍宋 3晚唐> [WxH]'); process.exit(2); }
const [W, H] = (size || '1536x864').split('x').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => { errs.push(e.message.slice(0, 180)); console.log('  页面报错', e.message.slice(0, 180)); });
  const click = (sel, scope) => p.evaluate(([s, sc]) => { const root = sc ? document.querySelector(sc) : document; if (!root) return false; const e = [...root.querySelectorAll(s)].find((x) => x.getClientRects().length); if (!e) return false; e.click(); return true; }, [sel, scope || null]);
  const snap = (n) => p.screenshot({ path: path.join(out, `s${scn}-${n}.jpg`), type: 'jpeg', quality: 86 });
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
  const kernel = await p.evaluate(() => ({ unit: (window.CurrencyUnit && window.CurrencyUnit.getUnit && window.CurrencyUnit.getUnit().money) || '两', noun: typeof window._moneyNoun === 'function' ? window._moneyNoun() : '银' }));
  // 别朝的单位：明清记两，唐宋记贯（缗同贯）；名目「银」只在不记银的朝代算错（「钱」字太常见，钱粮、应征钱，不拿来判）
  const own = kernel.unit === '缗' ? ['贯', '缗'] : kernel.unit === '贯' ? ['贯', '缗'] : [kernel.unit];
  const foreign = ['两', '贯', '缗'].filter((u) => !own.includes(u));
  console.log(`场景${scn} 内核钱名 ${kernel.noun}、${kernel.unit}；别朝单位 ${foreign.join('、')}${kernel.noun === '银' ? '' : '，名目不该有银'}`);
  let bad = 0;
  let seenTotal = 0;
  const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) bad++; };

  // 舆图军旗兵数：九千九百五十起写「一万」，不写「十千」
  const counts = await p.evaluate(async () => { const m = await import('/ui/screens/mapmarks.js'); return [9949, 9950, 9960, 9999, 10000, 10500, 19960, 99960].map((n) => `${n}=${m.shortCount(n)}`); });
  check(!counts.some((s) => s.includes('十千')) && counts[2].endsWith('=一万'), `军旗兵数 ${counts.join(' ')}`);

  const scan = async (name, scope = '.ce-ov.on') => {
    const r = await p.evaluate(([sc, ownU, foreignU, noSilver]) => {
      const ov = document.querySelector(sc);
      if (!ov) return null;
      const NUM = '[0-9〇零一二三四五六七八九十百千万亿]';
      const vis = (e) => e.getClientRects().length > 0;
      const all = [...ov.querySelectorAll('*')].filter(vis);
      const leaf = {};
      all.forEach((e) => { if (e.children.length) return; const t = e.textContent.trim(); if (ownU.includes(t) || foreignU.includes(t) || (noSilver && t === '银')) leaf[t] = (leaf[t] || 0) + 1; });
      const badRe = foreignU.map((u) => new RegExp(NUM + u)).concat(noSilver ? [new RegExp('银' + NUM), new RegExp(NUM + '银')] : []);
      const goodRe = new RegExp(NUM + '(' + ownU.join('|') + ')');
      const hits = new Set();
      let good = 0;
      all.forEach((e) => {
        if (e.querySelectorAll('*').length > 12) return;
        const t = e.textContent.replace(/\s+/g, '');
        if (!t || t.length > 60) return;
        if (badRe.some((re) => re.test(t))) hits.add(t.slice(0, 40));
        if (goodRe.test(t)) good++;
      });
      return { leaf, hits: [...hits], good };
    }, [scope, own, foreign, kernel.noun !== '银']);
    if (!r) { check(false, `${name}：没开`); return false; }
    const wrongLeaves = Object.keys(r.leaf).filter((k) => !own.includes(k));
    const fail = r.hits.length > 0 || wrongLeaves.length > 0;
    const seen = r.good + own.reduce((s, u) => s + (r.leaf[u] || 0), 0);
    if (name !== '自检') {
      seenTotal += seen;
      const leaves = Object.entries(r.leaf).map(([k, n]) => `${k}${n}`).join(' ');
      check(!fail, `${name}：带数的本朝单位 ${r.good} 处，单独成块的单位字 ${leaves || '无'}${r.hits.length ? '，写死的：' + r.hits.slice(0, 6).join(' ｜ ') : ''}`);
      await snap(name);
    }
    return fail;
  };
  const tab = (t) => p.evaluate((x) => {
    const ov = document.querySelector('.ce-ov.on');
    const list = ov ? [...ov.querySelectorAll('button')].filter((e) => e.getClientRects().length) : [];
    const e = list.find((bt) => bt.textContent.replace(/\s+/g, '').includes(x));
    if (!e) return list.map((bt) => bt.textContent.replace(/\s+/g, '')).filter((s) => s && s.length < 10).slice(0, 30).join('/') || '（册没开）';
    e.click();
    return true;
  }, t);
  const openBook = async (name) => {
    const ok = await click(`nav.rail .q-wadang[data-name="${name}"]`);
    await wait(2500);
    return ok && (await p.evaluate(() => !!document.querySelector('.ce-ov.on')));
  };
  const closeBook = async () => { await click('.ce-close', '.ce-ov.on'); await wait(1200); };

  if (!(await openBook('军务'))) check(false, '军务册没开');
  else {
    // 自检：数和单位分在两个元素里、行内连写，尺子都得抓到（用别朝的单位，本朝记两就拿贯来试）
    const probeUnit = foreign[0];
    await p.evaluate((u) => { const d = document.createElement('div'); d.id = 'mn-selftest'; d.innerHTML = `<p><b>三万</b> <small>${u}</small></p><p>约费五千${u}</p>`; document.querySelector('.ce-ov.on').appendChild(d); }, probeUnit);
    const caught = await scan('自检');
    await p.evaluate(() => document.getElementById('mn-selftest').remove());
    if (!caught) { console.log('  尺子坏了：自检没抓到'); process.exit(4); }
    console.log(`  （自检：尺子抓得到「${probeUnit}」）`);
    await scan('军务');
    if (await click('.ar-row', '.ce-ov.on')) { await wait(1800); await scan('军务-一项'); } else check(false, '军务没有可点的一军');
    await closeBook();
  }
  if (await openBook('科举')) { await scan('科举'); await closeBook(); } else check(false, '科举册没开');
  if (await openBook('宫闱')) {
    for (const t of ['宫苑', '奇珍']) {
      const ok = await tab(t);
      if (ok !== true) { console.log(`  （宫闱没有「${t}」签；册里的钮：${ok}）`); continue; }
      await wait(1500);
      await scan(`宫闱-${t}`);
      if (await click('.gw-item', '.ce-ov.on')) { await wait(1800); await scan(`宫闱-${t}-一项`); } else console.log(`  （宫闱「${t}」没有可点的一项）`);
    }
    await closeBook();
  } else check(false, '宫闱册没开');

  // 方志：寻人开本人人物窗，点「方志」进所在地块，逐签读
  const me = await p.evaluate(() => (window.GM.chars.find((c) => c && c.isPlayer) || {}).name || '');
  await p.keyboard.press('2');
  await wait(1200);
  await p.evaluate((n) => { const i = document.querySelector('.xr-search'); if (!i) return; i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); }, me);
  await wait(500);
  await p.evaluate((n) => { const r = [...document.querySelectorAll('.xr-row')].find((x) => x.dataset.person === n); if (r) r.querySelector('.xr-main').click(); }, me);
  await wait(900);
  await click('.xr-shut');
  await wait(900);
  if (await click('.rw-placego')) {
    await wait(2500);
    const slips = await p.evaluate(() => [...document.querySelectorAll('.zw.on .fz-slip')].filter((e) => e.getClientRects().length).map((e) => e.textContent.replace(/\s+/g, '')));
    console.log(`  方志（${me}所在）的签：${slips.join('/') || '无'}`);
    for (let i = 0; i < slips.length; i++) {
      await p.evaluate((k) => { const e = [...document.querySelectorAll('.zw.on .fz-slip')].filter((x) => x.getClientRects().length)[k]; if (e) e.click(); }, i);
      await wait(1500);
      await scan(`方志-${slips[i]}`, '.zw.on');
    }
  } else check(false, `方志：${me}的人物窗没有「方志」`);
  check(seenTotal > 0, `各页合计量到本朝单位 ${seenTotal} 处（量到零算没查到）`);
  check(errs.length === 0, `页面报错 ${errs.length}`);
  console.log(bad ? `共 ${bad} 处不过` : '全过');
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(3); });
