// 朝议走一遍留影：开一局，从召对卷进常朝、廷议、御前会议，按得动的签就往下按，每一步拍一张、记下浮层和案底。
// node tools/newui/court.cjs <出图目录> [--scn=1] [--size=1920x1080] [--tag=c] [--modes=changchao,tinyi,yuqian] [--steps=14]
// 没有 AI 密钥时内核走兜底文字，流程照走；退出码 = 页面报错条数 + 版式问题条数。需要本机服务（web/ 下 python -m http.server 8794）。
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
if (!out) { console.error('用法：node tools/newui/court.cjs <出图目录> [--scn=1] [--size=1920x1080] [--tag=c] [--modes=changchao,tinyi,yuqian] [--steps=14]'); process.exit(2); }
const scn = opt('scn', '1');
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const tag = opt('tag', 'c');
const MODES = opt('modes', 'changchao,tinyi,yuqian').split(',');
const STEPS = Number(opt('steps', '14'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => {
    const from = String(e.stack || '').split('\n').slice(1, 3).map((x) => x.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' ← ');
    errs.push(`${e.message.slice(0, 160)}｜${from}`);
    console.log('  页面报错', e.message.slice(0, 160), '｜', from);
  });
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const snap = (n) => p.screenshot({ path: path.join(out, `${tag}-${n}.jpg`), type: 'jpeg', quality: 88 });

  await p.goto(`${base}index.html?ui=new`, { timeout: 180000 });
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
  // 精力、次数别挡路：这是看界面，不是看规则
  await p.evaluate(() => { const g = window.GM; if (g) { g._energy = 100; g.energy = 100; g._chaoyiCount = {}; } });

  const state = () => p.evaluate(() => {
    const on = document.querySelector('.scr-court.on');
    const veil = [...document.querySelectorAll('.q-juan-veil')].pop();
    return {
      court: !!on,
      slips: on ? [...on.querySelectorAll('.ct-slips button')].map((b) => b.textContent) : [],
      status: on ? on.querySelector('.ct-status')?.textContent || '' : '',
      topic: on ? on.querySelector('.ct-topic')?.textContent || '' : '',
      entries: on ? on.querySelectorAll('.ct-flow > *').length : 0,
      juan: veil ? (veil.querySelector('header')?.innerText || '').replace(/\s+/g, ' ').slice(0, 40) : '',
      juanBtns: veil ? [...veil.querySelectorAll('.au-pick-row, footer .q-yapai')].map((b) => b.innerText.replace(/\s+/g, ' ').slice(0, 14)).slice(0, 10) : []
    };
  });

  // 版式体检：几大块互不相压、不出屏，案底的签别顶进实录，立轴别小到看不清
  const issues = [];
  const audit = async (where) => {
    const found = await p.evaluate(() => {
      const on = document.querySelector('.scr-court.on');
      if (!on) return [];
      const out = [];
      const shown = (e) => { if (!e) return false; const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const parts = { 题: '.crumb', 退朝: '.back', 议题: '.ct-topic', 朝班: '.ct-roster', 立轴: '.ct-pres', 实录: '.ct-rec', 案底: '.ct-bar', 签: '.ct-slips', 插言: '.ct-say' };
      const r = {};
      for (const [k, s] of Object.entries(parts)) { const e = on.querySelector(s); if (shown(e)) r[k] = e.getBoundingClientRect(); }
      for (const [k, b] of Object.entries(r)) if (b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) out.push(`${k}出屏 [${[b.left, b.top, b.right, b.bottom].map(Math.round)}]`);
      const hit = (a, b) => { if (!r[a] || !r[b]) return 0; const w = Math.min(r[a].right, r[b].right) - Math.max(r[a].left, r[b].left), h = Math.min(r[a].bottom, r[b].bottom) - Math.max(r[a].top, r[b].top); return w > 2 && h > 2 ? Math.round(w * h) : 0; };
      for (const [a, b] of [['朝班', '立轴'], ['立轴', '实录'], ['朝班', '实录'], ['实录', '案底'], ['题', '议题'], ['议题', '退朝'], ['题', '朝班'], ['退朝', '实录'], ['立轴', '案底'], ['签', '插言']]) { const n = hit(a, b); if (n) out.push(`${a}×${b} ${n}px²`); }
      const stage = on.querySelector('.ct-pres-stage');
      const fig = on.querySelector('.ct-pres-stage > .q-zhou:last-child');
      if (fig) {
        const b = fig.getBoundingClientRect();
        if (b.width < 90) out.push(`立轴只有 ${Math.round(b.width)} 宽`);
        const plate = on.querySelector('.ct-pres-plate').getBoundingClientRect();
        if (b.bottom > plate.top + 1) out.push(`立轴压名牌 ${Math.round(b.bottom - plate.top)}`);
        if (stage && r.立轴 && plate.bottom > r.立轴.bottom + 2) out.push(`名牌出了空当 ${Math.round(plate.bottom - r.立轴.bottom)}`);
      }
      const plateEl = on.querySelector('.ct-pres-plate');
      if (plateEl && plateEl.scrollWidth > plateEl.clientWidth + 2) out.push('名牌横向溢出');
      const nameEl = on.querySelector('.ct-pres-plate h3');
      if (nameEl && nameEl.scrollWidth > nameEl.clientWidth + 2) out.push(`名字被裁：${nameEl.textContent}`);
      for (const m of on.querySelectorAll('button.ct-mem')) if (m.scrollWidth > m.clientWidth + 2) { out.push(`朝班行溢出：${m.textContent}`); break; }
      const recEl = on.querySelector('.ct-rec');
      for (const b of on.querySelectorAll('.ct-slips .slip')) { const c = b.getBoundingClientRect(); if (c.top < recEl.getBoundingClientRect().bottom - 1) { out.push(`签顶进实录：${b.textContent}`); break; } if (b.scrollHeight > b.clientHeight + 2) { out.push(`签字溢出：${b.textContent}`); break; } }
      return out;
    });
    for (const f of found) if (!issues.some((x) => x.f === f)) { issues.push({ where, f }); console.log(`  版式 ${where}：${f}`); }
  };

  for (const mode of MODES) {
    console.log(`\n===== ${mode} =====`);
    await p.evaluate(() => document.querySelectorAll('.q-juan-veil .q-juan-close').forEach((b) => b.click()));
    await p.evaluate(() => { const g = window.GM; if (g) { g._energy = 100; g.energy = 100; g._chaoyiCount = {}; } });
    const rail = await p.evaluate(() => { const b = [...document.querySelectorAll('.hm-btn')].find((x) => x.querySelector('b')?.textContent === '见'); if (b) { b.click(); return b.textContent; } return ''; });
    await wait(1200);
    const ok = await p.evaluate((m) => {
      const name = { changchao: '常朝', tinyi: '廷议', yuqian: '御前会议' }[m];
      const b = [...document.querySelectorAll('.au-court button')].find((x) => x.querySelector('b')?.textContent === name);
      if (!b) return false;
      b.click();
      return true;
    }, mode);
    console.log('开议', rail, ok);
    if (!ok) { await snap(`${mode}-noopen`); continue; }

    let i = 0;
    for (; i < STEPS; i++) {
      await wait(i === 0 ? 3500 : 2200);
      const s = await state();
      console.log(`[${i}]`, JSON.stringify(s));
      await snap(`${mode}-${String(i).padStart(2, '0')}`);
      await audit(`${mode}-${i}`);
      if (!s.court && !s.juan && !s.juanBtns.length) break;
      // 先过卷，再按案底第一枝（go 优先）
      const did = await p.evaluate(() => {
        const veil = [...document.querySelectorAll('.q-juan-veil')].pop();
        if (veil) {
          const input = veil.querySelector('input.ct-topicin');
          if (input && !input.value) { input.value = '辽东军饷如何筹措'; input.dispatchEvent(new Event('input', { bubbles: true })); }
          const area = veil.querySelector('textarea');
          if (area && !area.value) { area.value = '此事当议。'; area.dispatchEvent(new Event('input', { bubbles: true })); }
          // 廷议预审走「明发」，看全流程；其余先点选项行，再点卷底的实事（收卷、罢、取消不点）
          const rows = [...veil.querySelectorAll('.au-pick-row')];
          const row = rows.find((b) => /明发/.test(b.textContent)) || rows.find((b) => !/取消|罢|记起居注|不录/.test(b.textContent));
          const foot = [...veil.querySelectorAll('footer .q-yapai')].find((b) => !/收卷|取消|^.?罢|关闭/.test(b.textContent));
          if (foot) { foot.click(); return `卷:${foot.textContent}`; }
          if (row) { row.click(); return `行:${row.textContent.slice(0, 12)}`; }
          const shut = [...veil.querySelectorAll('footer .q-yapai')].find((b) => /收卷/.test(b.textContent));
          if (shut) { shut.click(); return '卷:收卷'; }
          return '';
        }
        const on = document.querySelector('.scr-court.on');
        const b = on && (on.querySelector('.ct-slips .slip.go') || on.querySelector('.ct-slips button'));
        if (b) { b.click(); return `签:${b.textContent}`; }
        return '';
      });
      console.log('    →', did || '（等）');
    }
    await snap(`${mode}-end`);
    await p.evaluate(() => { const b = document.querySelector('.scr-court.on .back'); if (b) b.click(); });
    await wait(1500);
    for (let k = 0; k < 4; k++) {
      const left = await p.evaluate(() => { const v = [...document.querySelectorAll('.q-juan-veil')].pop(); if (!v) return false; const a = [...v.querySelectorAll('footer .q-yapai')].pop() || v.querySelector('.q-juan-close'); if (a) a.click(); return true; });
      if (!left) break;
      await wait(800);
    }
    await wait(1500);
  }
  fs.writeFileSync(path.join(out, `court-${tag}.json`), JSON.stringify({ errs, issues }, null, 1));
  console.log(`\n页面报错 ${errs.length}`, errs.slice(0, 4), `版式问题 ${issues.length}`);
  await browser.close();
  process.exit(errs.length + issues.length);
})().catch((e) => { console.error(e); process.exit(101); });
