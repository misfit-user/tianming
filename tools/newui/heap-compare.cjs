// 新旧界面同一局比页面内存。两边走同一个内核开局（startGame → 开场白 → doActualStart），
// 过回合同走 _endTurnInternal、模型回应换成同一份假的（同源 /__mock_ai/，页面 CSP 只放行本机与 https）。
// 各时点先强制回收垃圾（CDP HeapProfiler.collectGarbage 两遍）再读 V8 实占（Runtime.getHeapUsage），另记 DOM 节点、监听数。
// 只量渲染进程主线程那一个 V8 堆（撑爆它渲染进程就没了）；Worker 各有各的堆，不在内。
// node tools/newui/heap-compare.cjs <old|new> <天启|绍宋|晚唐> [回合数=1] [--settle=30] [--sample] [--profile-out=<目录>]
// --sample 按脚本、分配处、调用链列出仍活着的内存；--profile-out 另存每个时点的原始抽样
// 需要本机服务：在 web/ 下 python -m http.server 8794。一次只开一个浏览器；同志的长渲染在跑时别用。
'use strict';
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [ui, scnKey, turnsArg = '1'] = args;
const SIDS = { 天启: 'sc-tianqi7-1627', 绍宋: 'sc-jianyan1-1127-shaosong', 晚唐: 'sc-tang840-840' };
if (!/^(old|new)$/.test(ui || '') || !SIDS[scnKey]) { console.error('用法：node tools/newui/heap-compare.cjs <old|new> <天启|绍宋|晚唐> [回合数=1] [--settle=30]'); process.exit(2); }
const sid = SIDS[scnKey];
const turns = Number(turnsArg) || 0;
const settle = Number((process.argv.find((a) => a.startsWith('--settle=')) || '--settle=30').split('=')[1]) * 1000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MB = (n) => `${Math.round((Number(n) || 0) / 1048576)}MB`;
const MOCK = JSON.stringify({
  turn_summary: '本月京师无大事，诸司照常。',
  player_status: '如常',
  shizhengji_basis: '诸司例行公事。',
  events: [{ title: '京师如常', description: '本月京师坊市如常，无大事可记。', type: 'misc' }]
});

(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route('http://127.0.0.1:8794/__mock_ai/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: MOCK } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })
  }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('dialog', (d) => d.accept().catch(() => {}));
  p.on('crash', () => { console.log('  页面崩溃：渲染进程没了（多半是内存撑爆）'); process.exit(5); });
  p.on('pageerror', (e) => { errs.push(e.message.slice(0, 160)); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('HeapProfiler.enable');
  const rows = [];
  const measure = async (stage) => {
    const t0 = Date.now();
    await cdp.send('HeapProfiler.collectGarbage');
    await wait(500);
    await cdp.send('HeapProfiler.collectGarbage');
    const h = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters').catch(() => ({}));
    const lim = await p.evaluate(() => (performance.memory ? performance.memory.jsHeapSizeLimit : 0));
    rows.push({ stage, used: h.usedSize });
    console.log(`  ${stage}：堆实占 ${MB(h.usedSize)}（向系统要了 ${MB(h.totalSize)}，上限 ${MB(lim)}）DOM 节点 ${dom.nodes ?? '?'} 监听 ${dom.jsEventListeners ?? '?'}　回收用 ${Math.round((Date.now() - t0) / 1000)} 秒`);
  };
  // --sample：开局前起 V8 抽样堆分析（每 64KB 抽一次），量完把仍活着的内存按分配处汇总（谁分配的、还留着多少）
  // --profile-out=<目录>：另把每个时点的原始抽样存成 json，事后可再细查，不必重跑
  const sample = process.argv.includes('--sample');
  const profileOut = (process.argv.find((a) => a.startsWith('--profile-out=')) || '').slice('--profile-out='.length);
  const startSampling = async () => { if (sample) await cdp.send('HeapProfiler.startSampling', { samplingInterval: 65536 }); };
  const reportSampling = async (stage) => {
    if (!sample) return;
    const { profile } = await cdp.send('HeapProfiler.getSamplingProfile');
    if (profileOut) {
      require('fs').mkdirSync(profileOut, { recursive: true });
      require('fs').writeFileSync(require('path').join(profileOut, `${ui}-${scnKey}-${stage}.heapprofile.json`), JSON.stringify(profile));
    }
    const byFrame = new Map(), byScript = new Map(), byChain = new Map();
    const short = (u) => String(u || '（内建）').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '') || '（内建）';
    // 每个分配处：自身大小记在栈顶那一帧；脚本合计按栈上第一个有地址的帧（JSON.parse 这类内建记到调用它的脚本）
    // 调用链：从分配处往上数有地址的帧，自己调自己（deepClone 递归）只算一帧，取前五帧——分清是谁叫的深拷贝、谁留着
    const walk = (node, owner, chain) => {
      const cf = node.callFrame;
      const url = short(cf.url);
      const label = `${url}:${cf.lineNumber + 1} ${cf.functionName || '（匿名）'}`;
      const here = cf.url ? label : `${cf.functionName || '（内建）'} ← ${owner}`;
      const own = cf.url ? label : owner;
      const nextChain = cf.url && chain[chain.length - 1] !== label ? chain.concat(label) : chain;
      if (node.selfSize) {
        byFrame.set(here, (byFrame.get(here) || 0) + node.selfSize);
        const sk = own.split(':')[0];
        byScript.set(sk, (byScript.get(sk) || 0) + node.selfSize);
        const ck = nextChain.slice(-5).reverse().join(' ← ') || '（顶层）';
        byChain.set(ck, (byChain.get(ck) || 0) + node.selfSize);
      }
      (node.children || []).forEach((c) => walk(c, own, nextChain));
    };
    walk(profile.head, '（顶层）', []);
    const total = [...byScript.values()].reduce((a, v) => a + v, 0);
    console.log(`  ${stage} 抽样所见仍活着的 ${MB(total)}（开局起分配、至今未回收的），按脚本：`);
    [...byScript.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`    ${MB(v).padStart(7)}  ${k}`));
    console.log('  按分配处（前 25）：');
    [...byFrame.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`    ${MB(v).padStart(7)}  ${k.slice(0, 150)}`));
    console.log('  按调用链（前 20，每条最多五帧，左边是分配处）：');
    [...byChain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(`    ${MB(v).padStart(7)}  ${k.slice(0, 400)}`));
  };
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  // 最多点四十轮：遮罩老点不掉（或页面已崩、取不到）也不在这里干等
  const settleVeils = async (rounds = 10, cap = 40) => {
    for (let quiet = 0, n = 0; quiet < rounds && n < cap; n++) {
      if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
        quiet = 0;
        await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
        await wait(1200);
      } else { quiet++; await wait(1000); }
    }
  };
  console.log(`${ui === 'new' ? '新' : '旧'}界面 ${scnKey}（${sid}） 过回合 ${turns} 次，各时点静候 ${settle / 1000} 秒再量`);
  const tStart = Date.now();
  if (ui === 'new') {
    await p.goto('http://127.0.0.1:8794/index.html?ui=new', { timeout: 180000 });
    await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 240000 });
    await wait(settle);
    await measure('载入（启幕，未开局）');
    await startSampling();
    await click('.board button.primary');
    await wait(1500);
    await p.evaluate((k) => { const it = [...document.querySelectorAll('.pick-list .pick-item')].find((x) => x.innerText.includes(k)); if (it) it.click(); }, scnKey);
    await wait(500);
    await click('.q-juan footer .q-yapai');
    await p.waitForSelector('.opening', { timeout: 120000 });
    await wait(1500);
    await click('.q-juan footer .q-yapai');
    await p.waitForSelector('.scr-desk.on', { timeout: 600000 });
    await wait(6000);
    await settleVeils();
  } else {
    await p.goto('http://127.0.0.1:8794/index.html', { timeout: 180000 });
    await p.waitForFunction(() => typeof window.startGame === 'function' && typeof window.doActualStart === 'function' && typeof window._endTurnInternal === 'function' && window.GM && window.P, null, { timeout: 240000 });
    await wait(settle);
    await measure('载入（主菜单，未开局）');
    await startSampling();
    // 同新界面 adapter/game.js newGame：开局选项放进内核约定的几处，再调 startGame
    await p.evaluate((s) => {
      const w = window;
      w._pendingUseMap = true; w._pendingMapModeSid = s; w._pendingMapModeAt = Date.now();
      w.P.conf = w.P.conf || {}; w.P.conf.gameMode = 'yanyi'; w.P.conf.refText = '';
      w._pendingSaveName = '内存对照';
      Promise.resolve(w.startGame(s)).catch((e) => console.error('startGame', e));
    }, sid);
    await p.waitForSelector('#tm-op-enter', { timeout: 300000 });
    await wait(1500);
    await click('#tm-op-enter');
    await p.waitForFunction((s) => { const g = document.getElementById('G'); return window.TM && window.TM.StartupHealth && window.TM.StartupHealth.sid === s && g && g.style.display === 'grid'; }, sid, { timeout: 600000 });
  }
  console.log(`  进局用 ${Math.round((Date.now() - tStart) / 1000)} 秒`);
  await wait(settle);
  await measure('进局');
  await reportSampling('进局');
  await p.evaluate(() => { const P = window.P; P.ai = Object.assign({}, P.ai || {}, { key: 'mock-key', url: 'http://127.0.0.1:8794/__mock_ai/v1/chat/completions', model: 'mock-model' }); });
  for (let i = 1; i <= turns; i++) {
    const t0 = Date.now();
    const run = p.evaluate(async (useNew) => {
      try {
        if (useNew) { const Gm = await import('/ui/adapter/game.js'); await Gm.game.advance({ court: false }); }
        else await window._endTurnInternal({ postTurnCourt: false });
        return { ok: true, turn: window.GM.turn };
      } catch (e) { return { ok: false, err: String(e && e.message || e).slice(0, 200), turn: window.GM && window.GM.turn }; }
    }, ui === 'new');
    // 推演当中每两秒读一次堆（不回收），记峰值：撑爆渲染进程的是峰值（推演前快照、提示词、存档序列化叠在一起），不是推演后回收剩下的
    let peak = 0, peakAt = 0, sampling = true;
    const sampler = (async () => {
      while (sampling) {
        try { const h = await cdp.send('Runtime.getHeapUsage'); if (h.usedSize > peak) { peak = h.usedSize; peakAt = Math.round((Date.now() - t0) / 1000); } } catch (_e) { /* 页面正忙，下回再读 */ }
        await wait(2000);
      }
    })();
    const res = await Promise.race([run, wait(900000).then(() => null)]);
    sampling = false;
    await sampler;
    if (!res) { console.log(`  第${i}次推演十五分钟没完，不量了`); break; }
    console.log(`  第${i}次推演 ${res.ok ? '完成' : '出错 ' + res.err} ${Math.round((Date.now() - t0) / 1000)} 秒，到第 ${res.turn} 回合；推演当中堆峰值 ${MB(peak)}（第 ${peakAt} 秒）`);
    if (ui === 'new') await settleVeils(6);
    await wait(settle);
    await measure(`第${i}次推演后`);
    await reportSampling(`第${i}次推演后`);
  }
  if (rows.length >= 2) console.log(`  开局所增 ${MB(rows[1].used - rows[0].used)}${rows.length > 2 ? `；推演所增 ${MB(rows[rows.length - 1].used - rows[1].used)}` : ''}`);
  console.log(`  页面报错 ${errs.length}${errs.length ? '：' + errs.slice(0, 3).join(' ｜ ') : ''}`);
  await b.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(3); });
