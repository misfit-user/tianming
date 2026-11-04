// 信程走真界面：最远、中等、邻近各选一个人，看笺下写的日数对不对、长数字写得下不下；真发一封核对内核记的日数；窄窗也看
const fs = require('fs');
const path = require('path');
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const out = process.argv[2];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) bad++; };
const VIEWPORTS = [[1920, 1080], [1280, 720], [960, 485], [844, 390]];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const scn of (process.argv[3] || '1,3,2').split(',')) {
    const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
    const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
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
    for (let quiet = 0; quiet < 8;) {
      if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
        quiet = 0;
        await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
        await wait(1200);
      } else { quiet++; await wait(800); }
    }
    console.log(`场景${scn}`);

    const timing = await p.evaluate(() => {
      const g = window.GM;
      const map = g.mapData || g.map;
      const here = _ltHerePlace();
      const live = (g.chars || []).filter((c) => c && c.alive !== false && !c.isPlayer && c.name && c.location);
      const t0 = performance.now();
      const rows = live.map((c) => ({ name: c.name, loc: c.location, km: _ltRouteKm(here, c.location), d: calcLetterDays(here, c.location, 'normal') }));
      const first = performance.now() - t0;
      const t1 = performance.now();
      live.forEach((c) => calcLetterDays(here, c.location, 'normal'));
      const again = performance.now() - t1;
      const ok = rows.filter((r) => r.km != null && r.km > 0 && !_isSameLocation(r.loc, here)).sort((a, b) => a.km - b.km);
      const hasRoster = (name) => true;
      return { here, regions: (map.regions || []).length, first: Math.round(first), again: Math.round(again), all: rows.length, offMap: rows.filter((r) => r.km == null).length,
        pick: [ok[ok.length - 1], ok[Math.floor(ok.length / 2)], ok[0]] };
    });
    console.log(' ', JSON.stringify({ here: timing.here, regions: timing.regions, 全员首算毫秒: timing.first, 再算毫秒: timing.again, 人数: timing.all, 对不上: timing.offMap }));
    check(timing.again / Math.max(1, timing.all) < 0.5, `算过一遍后再算不费力（${timing.all}人${timing.again}ms）`);

    await p.evaluate(() => [...document.querySelectorAll('.hm-btn')].find((n) => n.querySelector('b')?.textContent === '书')?.click());
    await p.waitForSelector('.scr-letters.on', { timeout: 30000 });
    await wait(1000);
    await p.evaluate(() => [...document.querySelectorAll('.scr-letters.on .lt-tab')].find((n) => n.textContent.includes('名册'))?.click());
    await wait(600);

    const pickPerson = (name) => p.evaluate((n) => {
      const e = [...document.querySelectorAll('.scr-letters.on .lt-pi')].find((x) => x.querySelector('.who b')?.textContent === n);
      if (!e) return false;
      e.click();
      return true;
    }, name);
    const read = () => p.evaluate(() => {
      const t = (s) => document.querySelector(`.scr-letters.on ${s}`)?.textContent.trim() || '';
      const meta = document.querySelector('.scr-letters.on .lt-meta');
      return { reach: t('.lt-who .reach'), meta: t('.lt-meta'), metaFit: meta ? { sw: meta.scrollWidth, cw: meta.clientWidth, sh: meta.scrollHeight, ch: meta.clientHeight } : null };
    });
    const CN = '零一二三四五六七八九十百千';
    let farName = '';
    for (const [i, who] of timing.pick.entries()) {
      if (!who) continue;
      const on = await pickPerson(who.name);
      if (!on) { console.log(`  （${who.name}@${who.loc} 不在名册上，跳过）`); continue; }
      await wait(500);
      const s = await read();
      console.log(`  ${who.name}@${who.loc} ${Math.round(who.km)}km 内核${who.d}日 → ${JSON.stringify({ reach: s.reach, meta: s.meta.slice(0, 60) })}`);
      check(/驿递约.+日可达/.test(s.reach), '选人就写日数');
      check(!/\d/.test(s.reach) && !/\d/.test(s.meta.split('·')[0]), '日数是中文数字');
      if (i === 0) {
        farName = who.name;
        await p.screenshot({ path: path.join(out, `s${scn}-far.jpg`), type: 'jpeg', quality: 88 });
        await p.evaluate(() => [...document.querySelectorAll('.lt-bar .q-qianzi button')].find((x) => x.textContent.includes('密使'))?.click());
        await wait(300);
        const slow = await read();
        console.log('   密使', slow.meta.slice(0, 60));
        const backCn = /回书约(.+?)日可望/.exec(slow.meta);
        check(!!backCn && [...backCn[1]].every((c) => CN.includes(c)), `最长的日数也写得对：${backCn && backCn[1]}`);
        for (const [w, h] of VIEWPORTS) {
          await p.setViewportSize({ width: w, height: h });
          await wait(450);
          const geo = await read();
          const crowd = await p.evaluate(() => {
            const m = document.querySelector('.scr-letters.on .lt-meta');
            const bar = document.querySelector('.scr-letters.on .lt-bar');
            if (!m || !bar) return { ok: false };
            const a = m.getBoundingClientRect(), c = bar.getBoundingClientRect();
            const walker = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
            const node = walker.nextNode();
            const at = node ? node.nodeValue.indexOf('可望') : -1;
            const range = document.createRange();
            let need = 0;
            if (at >= 0) {
              range.setStart(node, 0);
              range.setEnd(node, at + 2);
              need = range.getBoundingClientRect().width;
            }
            const hits = ['.lt-left', '.lt-right'].filter((sel) => {
              const e = document.querySelector(`.scr-letters.on ${sel}`);
              if (!e) return false;
              const r = e.getBoundingClientRect();
              return r.width > 0 && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top;
            });
            if (hits.length) return { ok: false, hits, need: Math.round(need), room: m.clientWidth, rect: [Math.round(a.left), Math.round(a.right)] };
            return { ok: a.bottom <= c.top + 2 || a.top >= c.bottom - 2, meta: [Math.round(a.top), Math.round(a.bottom)], bar: [Math.round(c.top), Math.round(c.bottom)], clipped: !(need > 0) || need > m.clientWidth + 1, need: Math.round(need), room: m.clientWidth, fontPx: getComputedStyle(m).fontSize };
          });
          await p.screenshot({ path: path.join(out, `s${scn}-${w}.jpg`), type: 'jpeg', quality: 88 });
          check(crowd.ok && !crowd.clipped, `${w}x${h} 路程一行不压签、两个日数完整 ${JSON.stringify(crowd)}`);
        }
        await p.setViewportSize({ width: 1920, height: 1080 });
        await wait(400);
        await p.evaluate(() => [...document.querySelectorAll('.lt-bar .q-qianzi button')].find((x) => x.textContent.includes('多路') || x.textContent.includes('密使'))?.click());
        await wait(200);
      }
    }

    // 真发一封给最远的人：内核记的日数要和笺下写的一样
    if (farName) {
      await pickPerson(farName);
      await wait(400);
      const before = await p.evaluate((n) => {
        const c = window.GM.chars.find((x) => x.name === n);
        return { here: _ltHerePlace(), loc: c.location, n: (window.GM.letters || []).length };
      }, farName);
      await p.evaluate(() => { const t = document.querySelector('.lt-ta'); t.value = '卿在任上诸事可好，具实以闻。'; t.dispatchEvent(new Event('input', { bubbles: true })); });
      await wait(200);
      const metaAtSend = (await read()).meta;
      const urg = await p.evaluate(() => [...document.querySelectorAll('.lt-bar .q-qianzi button')].filter((x) => x.classList.contains('on') || x.getAttribute('aria-pressed') === 'true').map((x) => x.textContent));
      await p.evaluate(() => [...document.querySelectorAll('.lt-bar .slip')].find((x) => x.classList.contains('go')).click());
      await wait(1200);
      const letter = await p.evaluate((n) => {
        const l = (window.GM.letters || []).filter((x) => x.to === n).pop();
        if (!l) return null;
        return { days: l._travelDays, urgency: l.urgency, sendMode: l.sendMode, from: l.fromLocation, to: l.toLocation, deliv: l._deliveryDay - l._sentDay, reply: l._replyDay - l._sentDay, turns: l.deliveryTurn - l.sentTurn, replyTurns: l.replyTurn - l.sentTurn, dpv: _getDaysPerTurn(),
          base: calcLetterDays(l.fromLocation, l.toLocation, l.urgency) };
      }, farName);
      console.log('  真发', JSON.stringify({ urg, metaAtSend: metaAtSend.slice(0, 40), letter }));
      const secret = letter && letter.sendMode === 'secret_agent';
      check(!!letter, '信发出去了');
      check(letter && letter.days === (secret ? Math.ceil(letter.base * 1.5) : letter.base), '内核记的日数就是算出来的');
      check(letter && letter.deliv === letter.days && letter.reply === letter.days * 2 + 3, '送达、回书日期都按它');
      check(letter && letter.turns >= Math.ceil(letter.days / letter.dpv), '回合数够走完路程');
      await p.screenshot({ path: path.join(out, `s${scn}-sent.jpg`), type: 'jpeg', quality: 88 });
    }
    check(errs.length === 0, `页面报错 ${errs.length}`);
    await b.close();
  }
  console.log(`共 ${bad} 处问题`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(101); });
