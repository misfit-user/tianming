// 真过回合：走新前端的推演口（adapter/game.js advance → 内核 _endTurnInternal），整条推演管线照常跑，
// 只把模型的回应换成假的（请求 /__mock_ai/ 的一律回一份最小的主推演结果：一件不带数值的寻常事）。
// 看度支两库：库存之变等于收减支（开局拨存另减）；开局预估和第一次结账差多少、差在哪一目；欠项总数对明细；页面不报错。
// 模型真回应（会改账的诏令、事件）不在这里，这局不存档。
// --debt：开局给帑廪钱账记一笔可自动清偿的旧欠 5000，看预估把它列在「清偿旧欠」、真结账还的和预估一样
// node tools/newui/real-turn.cjs <场景关键字> [回合数=2] [--debt]
const core = 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const withDebt = process.argv.includes('--debt');
const [scnKey, turnsArg = '2'] = args;
if (!scnKey) { console.error('用法：node tools/newui/real-turn.cjs <场景关键字> [回合数]'); process.exit(2); }
const turns = Number(turnsArg) || 2;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 主推演要有三项以上、其中一项是「重」字段（tm-endturn-ai.js _hasSc1StructuredResult），否则内核中止本回合。
// 给一件不带任何数值的寻常事，不碰账
const MOCK = JSON.stringify({
  turn_summary: '本月京师无大事，诸司照常。',
  player_status: '如常',
  shizhengji_basis: '诸司例行公事。',
  events: [{ title: '京师如常', description: '本月京师坊市如常，无大事可记。', type: 'misc' }]
});
let bad = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) bad++; };

(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  // 模型回应换成假的：只拦 /__mock_ai/（同源，页面 CSP 的 connect-src 只放行本机与 https），别的请求照走
  await ctx.route('http://127.0.0.1:8794/__mock_ai/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: MOCK } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })
  }));
  const p = await ctx.newPage();
  const errs = [], fiscalLogs = [];
  let aiCalls = 0;
  const turnLog = [];
  p.on('dialog', (d) => { turnLog.push(`[dialog ${d.type()}] ${d.message().slice(0, 120)}`); d.accept(); });
  p.on('request', (r) => { if (r.url().includes('/__mock_ai/')) aiCalls++; });
  // 渲染进程没了（多半是内存撑爆）时 evaluate 永远等不回来，别干等
  p.on('crash', () => { console.log('  页面崩溃：渲染进程没了（多半是内存撑爆），后面的没法核'); process.exit(5); });
  p.on('pageerror', (e) => { errs.push(e.message.slice(0, 180)); console.log('  页面报错', e.message.slice(0, 180)); });
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /endTurn|推演|回滚|abort/i.test(t)) turnLog.push(`[${m.type()}] ${t.slice(0, 200)}`); if (m.type() === 'error' && /guoku|neitang|fiscal|帑|财政|FixedExpense|CascadeTax/i.test(t)) fiscalLogs.push(t.slice(0, 200)); });
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const settleVeils = async (rounds = 10) => {
    for (let quiet = 0; quiet < rounds;) {
      if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
        quiet = 0;
        await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
        await wait(1200);
      } else { quiet++; await wait(1000); }
    }
  };
  await p.goto('http://127.0.0.1:8794/index.html?ui=new', { timeout: 180000 });
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 240000 });
  await wait(2000);
  await click('.board button.primary');
  await wait(1500);
  await p.evaluate((k) => { const it = [...document.querySelectorAll('.pick-list .pick-item')].find((x) => x.innerText.includes(k)); if (it) it.click(); }, scnKey);
  await wait(500);
  await click('.q-juan footer .q-yapai');
  await p.waitForSelector('.opening', { timeout: 120000 });
  await wait(1500);
  await click('.q-juan footer .q-yapai');
  await p.waitForSelector('.scr-desk.on', { timeout: 300000 });
  await wait(6000);
  await settleVeils();
  await p.evaluate(() => { const P = window.P; P.ai = Object.assign({}, P.ai || {}, { key: 'mock-key', url: 'http://127.0.0.1:8794/__mock_ai/v1/chat/completions', model: 'mock-model' }); });

  const read = () => p.evaluate(async () => {
    const F = await import('/ui/adapter/fiscal.js');
    const G = window.GM;
    const one = (k) => F.account(k).res.map((r) => ({
      key: r.key, stock: r.stock, inn: r.inn, out: r.out, held: r.held || 0, heldPending: !!r.heldPending, deficit: r.deficit || 0,
      rowsSum: (r.deficits || []).reduce((n, d) => n + (d.amount || 0), 0),
      sources: Object.fromEntries(r.sources.map((x) => [x.label, x.amount])), sinks: Object.fromEntries(r.sinks.map((x) => [x.label, x.amount])),
      detail: Object.fromEntries([...r.sources, ...r.sinks].map((x) => [x.label, Object.fromEntries((x.details || []).map((d) => [d.name, d.amount]))]))
    }));
    return { turn: G.turn, guoku: one('guoku'), neitang: one('neitang') };
  });
  const diffs = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, Math.round((b[k] || 0) - (a[k] || 0))]).filter(([, d]) => Math.abs(d) >= 1).map(([k, d]) => `${k}${d > 0 ? '+' : ''}${d}`).join(' ');

  console.log(`场景 ${scnKey} 真过回合 ${turns} 次（模型回应是假的）`);
  if (withDebt) {
    await p.evaluate(() => {
      const led = window.GM.guoku.ledgers.money;
      led.deficit = (Number(led.deficit) || 0) + 5000;
      if (!led.deficitDetails) led.deficitDetails = {};
      (led.deficitDetails['试欠'] = led.deficitDetails['试欠'] || []).push({ id: 'probe:debt', name: '试记旧欠', amount: 5000 });
    });
  }
  let prev = await read();
  const opening = prev;
  if (withDebt) console.log(`  试记旧欠 5000：预估支出里清偿旧欠 ${Math.round(prev.guoku[0].sinks['清偿旧欠'] || 0)}（其他 ${Math.round(prev.guoku[0].sinks['其他'] || 0)}）`);
  if (withDebt) check((prev.guoku[0].sinks['清偿旧欠'] || 0) > 0, '试记旧欠：开局预估把清偿旧欠单列一目');
  // --trace：帑廪钱的三个镜像（balance、money、ledgers.money.stock）每一次写入都记下变了多少、谁写的，结账后按写口合计
  const trace = process.argv.includes('--trace');
  const installTrace = () => p.evaluate(() => {
    const G = window.GM, log = window.__stockTrace = [];
    const who = () => (new Error().stack || '').split('\n').slice(3, 7).map((s) => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '')).join(' < ');
    const trap = (obj, key, tag) => {
      let v = obj[key];
      Object.defineProperty(obj, key, { configurable: true, enumerable: true, get: () => v, set: (nv) => { const d = (Number(nv) || 0) - (Number(v) || 0); if (Math.abs(d) >= 1) log.push({ tag, d: Math.round(d), at: who() }); v = nv; } });
    };
    ['money', 'grain', 'cloth'].forEach((k) => trap(G.guoku.ledgers[k], 'stock', 'guoku/' + k));
    trap(G.neitang.ledgers.money, 'stock', 'neitang/money');
    trap(G.guoku, 'balance', 'guoku/balance');
    // 粮的镜像：有人直写 GM.guoku.grain，对账（reconcileLedgerScalar）就记成「外部调整」
    trap(G.guoku, 'grain', 'guoku/grain镜像');
    window.__stockTraceLeds = [G.guoku, G.guoku.ledgers.money, G.guoku.ledgers.grain, G.neitang, G.neitang.ledgers.money];
  });
  const dumpTrace = () => p.evaluate(() => {
    const log = window.__stockTrace || [], G = window.GM, was = window.__stockTraceLeds || [];
    const by = {};
    log.filter((x) => !/balance/.test(x.tag)).forEach((x) => { const t = by[x.tag] = by[x.tag] || {}; t[x.at] = (t[x.at] || 0) + x.d; });
    const now = [G.guoku, G.guoku.ledgers.money, G.guoku.ledgers.grain, G.neitang, G.neitang.ledgers.money];
    return { replaced: now.some((o, i) => o !== was[i]), writes: log.length,
      stockBy: Object.fromEntries(Object.entries(by).map(([tag, m]) => [tag, Object.entries(m).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 30)])),
      // balance 写了而 stock 没跟着变的（镜像之间互相覆盖时会丢账）
      balanceOnly: log.filter((x) => x.tag === 'guoku/balance').slice(0, 60) };
  });
  for (let i = 1; i <= turns; i++) {
    const t0 = Date.now();
    if (trace) await installTrace();
    const run = p.evaluate(async () => {
      const Gm = await import('/ui/adapter/game.js');
      try { await Gm.game.advance({ court: false }); return { ok: true }; } catch (e) { return { ok: false, err: String(e && e.message || e).slice(0, 200) }; }
    });
    // 推演卡住（等某个弹层、某个永不回的承诺）时别干等：十分钟一到，把最近的日志和页面上开着的东西打出来
    const res = await Promise.race([run, wait(600000).then(() => null)]);
    if (!res) {
      console.log(`  第${i}次推演 十分钟没完，卡住了；最近日志：`);
      turnLog.slice(-40).forEach((x) => console.log('    ' + x));
      console.log('    页面上 ' + await p.evaluate(() => JSON.stringify({ turn: window.GM.turn, busy: !!window.GM._endTurnBusy, veils: [...document.querySelectorAll('.q-juan-veil, [role=dialog], .modal')].map((e) => (e.className + ':' + e.innerText).slice(0, 160)) })));
      await p.screenshot({ path: 'E:/tianming-tmp/b3/real-turn-stuck.png' }).catch(() => {});
      await b.close();
      process.exit(4);
    }
    const secs = Math.round((Date.now() - t0) / 1000);
    if (process.argv.includes('--verbose') || !res.ok) turnLog.slice(-25).forEach((x) => console.log('    ' + x));
    turnLog.length = 0;
    await settleVeils(6);
    const now = await read();
    if (trace) {
      const t = await dumpTrace();
      console.log(`    写库 ${t.writes} 次${t.replaced ? '（帑廪对象中途被换掉，后半段没记上）' : ''}`);
      Object.entries(t.stockBy).forEach(([tag, rows]) => rows.forEach(([at, d]) => console.log(`      ${tag} ${d > 0 ? '+' : ''}${d}  ${at}`)));
      if (process.argv.includes('--verbose')) console.log('    balance 写入序列 ' + t.balanceOnly.map((x) => `${x.d > 0 ? '+' : ''}${x.d}@${x.at.split(' < ')[0]}`).join(' | ').slice(0, 3000));
    }
    if (process.argv.includes('--raw')) console.log('    原账 ' + JSON.stringify(await p.evaluate(() => { const r = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => Math.abs(Number(v) || 0) >= 1).map(([k, v]) => [k, Math.round(v)])); const L = (k) => window.GM[k].ledgers.money; return { guokuIn: r(L('guoku').sources), guokuOut: r(L('guoku').sinks), neitangIn: r(L('neitang').sources), neitangOut: r(L('neitang').sinks) }; })));
    const heap = await p.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0));
    console.log(`  第${i}次推演 ${res.ok ? '完成' : '出错 ' + res.err} ${secs}秒 回合${prev.turn}→${now.turn} 模型请求累计${aiCalls} 页面堆${heap}MB`);
    check(res.ok && now.turn === prev.turn + 1, `第${i}次推演：回合加一`);
    // 事件簿里本回合的欠饷、兵变（假回应不会写这些，有就是引擎自己写的）
    const mutiny = await p.evaluate((t) => (window.GM.evtLog || []).filter((e) => e && e.turn >= t && /欠饷|兵变|逃亡/.test(String(e.type) + String(e.text))).map((e) => `${e.type}:${String(e.text).slice(0, 60)}`), prev.turn);
    if (mutiny.length) console.log(`    事件簿 欠饷/兵变 ${mutiny.length} 条：${mutiny.slice(0, 6).join('；')}`);
    const openingNote = i === 1 ? '（开局拨存另减）' : '';
    for (const kind of ['guoku', 'neitang']) {
      now[kind].forEach((r, j) => {
        const was = prev[kind][j];
        const moved = r.stock - was.stock, net = r.inn - r.out, held = i === 1 ? (was.heldPending ? was.held : 0) : 0;
        console.log(`  ${kind}/${r.key} 库${Math.round(was.stock)}→${Math.round(r.stock)} 变${Math.round(moved)} 收${Math.round(r.inn)} 支${Math.round(r.out)}${held ? ` 拨存${Math.round(held)}` : ''}（上期册里${i === 1 ? '预估' : '实'}收${Math.round(was.inn)} 支${Math.round(was.out)}）`);
        check(Math.abs(moved - (net - held)) <= Math.max(1, Math.abs(r.out + r.inn) * 0.002), `第${i}次 ${kind}/${r.key}：库存之变${Math.round(moved)}等于收减支${Math.round(net)}${openingNote}`);
        if (i === 1) {
          const dIn = diffs(was.sources, r.sources), dOut = diffs(was.sinks, r.sinks);
          if (dIn || dOut) console.log(`    预估→实账 收：${dIn || '无差'}；支：${dOut || '无差'}`);
          for (const lab of new Set([...Object.keys(was.sources), ...Object.keys(r.sources), ...Object.keys(was.sinks), ...Object.keys(r.sinks)])) {
            const a = was.sources[lab] ?? was.sinks[lab] ?? 0, z = r.sources[lab] ?? r.sinks[lab] ?? 0;
            if (Math.abs(z - a) >= 1) { const dd = diffs(was.detail[lab] || {}, r.detail[lab] || {}); if (dd) console.log(`      ${lab} 细目：${dd}`); }
          }
          check(Math.abs(was.inn - r.inn) <= Math.max(1, r.inn * 0.03), `第${i}次 ${kind}/${r.key}：开局预估收${Math.round(was.inn)}和实收${Math.round(r.inn)}相差不过三分`);
          check(Math.abs(was.out - r.out) <= Math.max(1, r.out * 0.03), `第${i}次 ${kind}/${r.key}：开局预估支${Math.round(was.out)}和实支${Math.round(r.out)}相差不过三分`);
        }
        if (r.rowsSum || r.deficit) check(Math.abs(r.deficit - r.rowsSum) <= 1, `第${i}次 ${kind}/${r.key}：欠项总数${Math.round(r.deficit)}和明细${Math.round(r.rowsSum)}对得上`);
      });
    }
    prev = now;
  }
  console.log(`  开局→第${turns}次 帑廪钱 ${Math.round(opening.guoku[0].stock)}→${Math.round(prev.guoku[0].stock)} 内帑钱 ${Math.round(opening.neitang[0].stock)}→${Math.round(prev.neitang[0].stock)}`);
  if (fiscalLogs.length) console.log('  财政相关报错', fiscalLogs.slice(0, 6));
  check(fiscalLogs.length === 0, `控制台财政相关报错 ${fiscalLogs.length}`);
  check(errs.length === 0, `页面报错 ${errs.length}`);
  console.log(bad ? `共 ${bad} 处不过` : '全过');
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(3); });
