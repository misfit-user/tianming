// 度支册的收支细项：开局一次，再按真实过回合的顺序跑一遍财政结算（税入、固定支出、回合加一、两库 tick，不灌假账）又一次。
// 回合加一不能省：内核有判断靠它（tm-endturn-systems.js 的 GM.turn++ 在两次收支之间）。
// node tools/newui/fiscal-items.cjs <出图目录> <场景关键字> [WxH] [tag]
// 查：细项之和对得上总数、没有英文代号和「_欠」、能展开到细目；预览不改账；
//     每本账库存之变等于收减支（清还旧欠也算支）；开局预估和第一次结账对得上。这局不存档。
const fs = require('fs');
const path = require('path');
const core = 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const [out, scnKey, size = '1366x768', tag = 'fi'] = process.argv.slice(2);
if (!out || !scnKey) { console.error('用法：node tools/newui/fiscal-items.cjs <出图目录> <场景关键字> [WxH] [tag]'); process.exit(2); }
const [W, H] = size.split('x').map(Number);
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
  for (let quiet = 0; quiet < 10;) {
    if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
      quiet = 0;
      await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
      await wait(1200);
    } else { quiet++; await wait(1000); }
  }
  const shot = (name) => p.screenshot({ path: path.join(out, `${tag}-${name}.jpg`), type: 'jpeg', quality: 86 });
  const openBook = async () => {
    await p.evaluate(() => document.querySelector('.ce-ov.on .ce-close')?.click());
    await wait(400);
    await p.evaluate(() => document.querySelectorAll('.topbar .q-zhang.link')[0]?.click());
    await wait(900);
  };
  const toTab = async (label) => { await p.evaluate((t) => { const x = [...document.querySelectorAll('.fi-tabs button')].find((e) => e.innerText.replace(/\s/g, '').includes(t)); if (x) x.click(); }, label); await wait(500); };
  const toRes = async (i) => { await p.evaluate((n) => document.querySelectorAll('.fi-card')[n]?.click(), i); await wait(400); };

  // 数：账户读回来的各项，和总数比
  const accountCheck = async (stage, kind) => {
    const rows = await p.evaluate(async (k) => {
      const F = await import('/ui/adapter/fiscal.js');
      const a = F.account(k);
      const pick = (list) => list.map((x) => ({ label: x.label, amount: x.amount, details: x.details.map((d) => ({ name: d.name, amount: d.amount })) }));
      return { forecast: a.forecast, res: a.res.map((r) => ({ key: r.key, inn: r.inn, out: r.out, sources: pick(r.sources), sinks: pick(r.sinks) })) };
    }, kind);
    const latin = /^[\x00-\x7f]+$/;
    // 皇庄租征银：钱账有了，粮账就不能再挂皇庄；钱账的皇庄也不能再拆出「粮租」
    if (kind === 'neitang') {
      const zhuang = (key) => ((rows.res.find((r) => r.key === key) || { sources: [] }).sources.find((x) => x.label === '皇庄')) || null;
      check(!(zhuang('money') && zhuang('grain')), `${stage}内帑：皇庄租只记一处（钱账${zhuang('money') ? '有' : '无'}，粮账${zhuang('grain') ? '有' : '无'}）`);
      check(!(zhuang('money') && zhuang('money').details.some((d) => /粮/.test(d.name))), `${stage}内帑：钱账的皇庄不再拆出粮租`);
    }
    for (const r of rows.res) {
      for (const [side, list, total] of [['收', r.sources, r.inn], ['支', r.sinks, r.out]]) {
        const sum = list.reduce((n, x) => n + x.amount, 0);
        const names = list.map((x) => `${x.label}${Math.round(x.amount)}${x.details.length ? `(细${x.details.length})` : ''}`).join(' ');
        console.log(`  ${stage}${kind}/${r.key}${side} 共${Math.round(total)}：${names}`);
        if (total >= 1) {
          check(Math.abs(sum - total) <= Math.max(1, total * 0.005), `${stage}${kind}/${r.key}${side}：细项之和${Math.round(sum)}对得上总数`);
          check(!(list.length === 1 && /^(其他|qita|other)$/.test(list[0].label)), `${stage}${kind}/${r.key}${side}：不是只有一条「其他」`);
        }
        check(!list.some((x) => latin.test(x.label) || /_欠$/.test(x.label)), `${stage}${kind}/${r.key}${side}：名目没有英文代号和「_欠」`);
        check(!list.some((x) => x.details.some((d) => latin.test(d.name))), `${stage}${kind}/${r.key}${side}：细目没有英文代号`);
        for (const x of list) {
          if (x.details.length) check(Math.abs(x.details.reduce((n, d) => n + d.amount, 0) - x.amount) <= Math.max(1, x.amount * 0.005), `${stage}${kind}/${r.key}${side}·${x.label}：细目之和对得上`);
        }
      }
    }
    return rows;
  };
  // 画面：册里真画出来、能点开
  const pageCheck = async (stage, held) => {
    const m = await p.evaluate(() => {
      const items = [...document.querySelectorAll('.fi-right .fi-item')];
      if (items[0]) items[0].open = true;
      const right = document.querySelector('.fi-right');
      return { bars: document.querySelectorAll('.fi-right .fi-bar').length, items: items.length, subs: items[0] ? items[0].querySelectorAll('.fi-debts.sub p').length : 0, wide: right.scrollWidth > right.clientWidth + 1, blank: /尚未分目|未分细目/.test(right.innerText), text: right.innerText };
    });
    console.log(`  ${stage} 长条${m.bars} 可展开${m.items} 首项细目${m.subs}`);
    check(m.bars > 2, `${stage}：册里画出了名目长条`);
    check(m.items >= 1 && m.subs > 1, `${stage}：有能展开的细目`);
    check(!m.blank, `${stage}：不再写「尚未分目」`);
    if (held) check(m.text.includes(held), `${stage}：写明${held}`);
    check(!m.wide, `${stage}：不横向溢出`);
    check(!/[A-Za-z_]{3,}/.test(m.text), `${stage}：册里没有英文代号 ${(m.text.match(/[A-Za-z_]{3,}/g) || []).slice(0, 4).join('、')}`);
  };

  console.log(`场景 ${scnKey} ${size}`);
  // ---------- 开局 ----------
  const pure = await p.evaluate(async () => {
    const F = await import('/ui/adapter/fiscal.js');
    const snap = () => JSON.stringify([window.GM.guoku, window.GM.neitang]);
    const before = snap();
    F.account('guoku'); F.account('neitang');
    return before === snap();
  });
  check(pure, '读细项不改账');
  await accountCheck('开局', 'guoku');
  await accountCheck('开局', 'neitang');
  const stocks = () => p.evaluate(async () => {
    const F = await import('/ui/adapter/fiscal.js');
    // repaid：清偿旧欠，只记下来看；held：册里写的开局拨存（期初分割，不算收支）
    // deficit/rowsSum：欠项总数与明细之和；manual：其中「待诏给付」的（manualSettlement），只能由诏令清结
    const manualOf = (k, key) => { const d = ((window.GM[k].ledgers[key] || {}).deficitDetails) || {}; return Object.keys(d).reduce((n, c) => n + (d[c] || []).filter((x) => x && x.manualSettlement === true).reduce((s, x) => s + (Number(x.amount) || 0), 0), 0); };
    const read = (k) => F.account(k).res.map((r) => ({ key: r.key, stock: r.stock, inn: r.inn, out: r.out, repaid: Number((window.GM[k].ledgers[r.key].sinks || {})['清偿旧欠']) || 0, held: r.held || 0, heldPending: !!r.heldPending, deficit: r.deficit || 0, rowsSum: (r.deficits || []).reduce((n, d) => n + (d.amount || 0), 0), manual: manualOf(k, r.key) }));
    return { guoku: read('guoku'), neitang: read('neitang') };
  });
  // 欠项：总数和明细之和对得上（明细为空时不论）
  const debtCheck = (stage, rows) => {
    for (const kind of ['guoku', 'neitang']) for (const r of rows[kind]) {
      if (r.rowsSum || r.deficit) check(Math.abs(r.deficit - r.rowsSum) <= 1, `${stage} ${kind}/${r.key}：欠项总数${Math.round(r.deficit)}和明细${Math.round(r.rowsSum)}对得上`);
    }
  };
  const before = await stocks();
  debtCheck('开局', before);
  // 皇庄：各地块分摊之和就是全国数（内帑据以收租的数），租入 = 亩数 × 每亩租率；
  // 方志风物志的皇庄行取同一个数，没有皇庄（唐宋、统一预算）就不列
  const capitalOf = { 天启: '顺天府', 绍宋: '开封府', 晚唐: '京兆府' };
  const zhuangRead = () => p.evaluate(async (cap) => {
    const G = window.GM, n = G.neitang || {}, NT = window.NeitangEngine;
    let sum = 0, rows = 0, capShare = null;
    Object.keys(G.adminHierarchy || {}).forEach((fk) => {
      const walk = (divs) => (divs || []).forEach((d) => {
        if (!d) return;
        const kids = (d.children && d.children.length) || (d.divisions && d.divisions.length);
        if (!kids) { const v = NT.huangzhuangOf(d); sum += v; if (v) rows++; }
        if (cap && String(d.name || '').startsWith(cap)) capShare = NT.huangzhuangOf(d);
        walk(d.children); walk(d.divisions);
      });
      walk((G.adminHierarchy[fk] || {}).divisions);
    });
    const rent = ((n.sourcesDetail || {}).huangzhuang || [])[0];
    let page = null;
    if (cap) {
      try {
        const Z = await import('/ui/adapter/fangzhi.js');
        if (Z.ensureCircuits) await Z.ensureCircuits();
        const id = Z.regionIdOf(cap), pg = id ? Z.region(id) : null;
        const vol = pg && pg.vols.find((v) => v.key === 'fengwu');
        const row = vol && (vol.grid || []).find((x) => x.k === '皇庄');
        page = { id, row: row ? row.v : null };
      } catch (e) { page = { err: e.message.slice(0, 120) }; }
    }
    return { explicit: !!n._tmExplicitFlow, declared: n.huangzhuangDeclared === true ? n.huangzhuangAcres : null, rate: n.huangzhuangRatePerAcre, sum, rows, capShare, rent: rent ? rent.amount : null, sources: n.sources || {}, page };
  }, capitalOf[scnKey] || null);
  const hz = await zhuangRead();
  console.log(`  皇庄 全国${hz.declared} 每亩${hz.rate} 分摊${hz.sum}（${hz.rows} 块） 租入${hz.rent} 方志${JSON.stringify(hz.page)}`);
  if (hz.explicit) {
    check(hz.sum === 0, `皇庄：统一预算的内库不收皇庄租，地块不列皇庄（分摊${hz.sum}）`);
  } else if (hz.declared != null) {
    check(Math.abs(hz.sum - hz.declared) <= hz.rows, `皇庄：地块分摊之和${hz.sum}就是全国${hz.declared}`);
    check(Math.abs((hz.rent || 0) - Math.round(hz.declared * (hz.rate || 0))) <= 1, `皇庄：租入${hz.rent}等于亩数乘每亩租率`);
  }
  if (hz.page && !hz.page.err && hz.page.id) {
    const want = hz.capShare || 0, got = hz.page.row == null || hz.page.row === '' ? 0 : Number(hz.page.row);
    check(got === want, `皇庄：方志${capitalOf[scnKey]}的皇庄行（${got || '不列'}）取内帑分摊数（${want || '无'}）`);
  } else if (capitalOf[scnKey]) check(false, `皇庄：方志${capitalOf[scnKey]}读不到 ${JSON.stringify(hz.page)}`);
  await openBook();
  await toTab('帑廪');
  await shot('open-guoku');
  await pageCheck('开局帑廪', before.guoku[0].held ? '将从库中拨存' : null);
  await shot('open-guoku-item');
  await toRes(1);
  await shot('open-guoku-grain');
  await toRes(0);
  await toTab('内帑');
  await toRes(0);
  await shot('open-neitang');
  await pageCheck('开局内帑');
  await shot('open-neitang-item');

  // ---------- 真跑一遍财政结算 ----------
  const ran = await p.evaluate(async () => {
    const G = window.GM;
    const r = { tax: !!window.CascadeTax.collect(), fixed: !!window.FixedExpense.collect() };
    G.turn++; // 真实过回合在这里加一，两库 tick 在加一之后
    window.GuokuEngine.tick({ turn: G.turn, monthRatio: 1, _monthRatio: 1 });
    window.NeitangEngine.tick({ turn: G.turn, monthRatio: 1, _monthRatio: 1 });
    const { bus } = await import('/ui/core/bus.js');
    bus.emit('game:changed', { what: 'probe' });
    return r;
  });
  console.log('  结算', JSON.stringify(ran));
  await accountCheck('结账后', 'guoku');
  await accountCheck('结账后', 'neitang');
  const after = await stocks();
  debtCheck('结账后', after);
  // 「待诏给付」的旧欠只能由诏令清结：自动清偿旧欠不能超过开局可自动还的那部分
  for (const r of after.guoku) {
    const was = before.guoku.find((x) => x.key === r.key);
    check(r.repaid <= Math.max(0, was.deficit - was.manual) + 1, `结账后 guoku/${r.key}：自动清偿旧欠${Math.round(r.repaid)}没碰待诏给付的${Math.round(was.manual)}`);
  }
  // 开局拨给各官署公帑的经费：第一次结账才从两库划走，不算本期支出。回执在 _publicTreasuryOpeningTransfers
  const opening = await p.evaluate(() => {
    const sum = { money: 0, grain: 0, cloth: 0 };
    let n = 0;
    Object.values(window.GM._publicTreasuryOpeningTransfers || {}).forEach((x) => {
      n++;
      const paid = (x.result || x).paid || {};
      Object.keys(sum).forEach((k) => { sum[k] += Number(paid[k]) || 0; });
    });
    return { sum, n };
  });
  if (opening.n) {
    console.log(`  开局拨付 ${opening.n} 笔 ${JSON.stringify(opening.sum)}`);
    for (const key of Object.keys(opening.sum)) {
      const gap = ['guoku', 'neitang'].reduce((s, kind) => {
        const r = after[kind].find((x) => x.key === key), was = before[kind].find((x) => x.key === key);
        return s + (r.stock - was.stock) - (r.inn - r.out);
      }, 0);
      check(Math.abs(gap + opening.sum[key]) <= 5, `开局拨付 ${key}：两库多减${Math.round(-gap)}等于回执合计${Math.round(opening.sum[key])}`);
    }
  }
  // 拨存：开局写「将拨存」，结账后那一期写「已拨存」，两库合计都等于回执；没有拨存就不写
  for (const key of ['money', 'grain', 'cloth']) {
    const sum = (rows) => ['guoku', 'neitang'].reduce((s, kind) => s + (rows[kind].find((x) => x.key === key).held || 0), 0);
    const want = opening.n ? opening.sum[key] : 0;
    check(Math.abs(sum(before) - want) <= 5 && ['guoku', 'neitang'].every((kind) => before[kind].every((x) => !x.held || x.heldPending)), `拨存 ${key}：开局册里写将拨存${Math.round(sum(before))}，回执${Math.round(want)}`);
    check(Math.abs(sum(after) - want) <= 5 && ['guoku', 'neitang'].every((kind) => after[kind].every((x) => !x.heldPending)), `拨存 ${key}：结账后册里写已拨存${Math.round(sum(after))}，回执${Math.round(want)}`);
  }
  if (opening.n) {
    await openBook();
    await toTab('帑廪');
    const text = await p.evaluate(() => document.querySelector('.fi-left').innerText + document.querySelector('.fi-right').innerText);
    check(/已拨存/.test(text), '结账后帑廪：册里写明已拨存');
    await shot('settled1-guoku');
  }
  // 对账：库存之变 = 收 − 支；开局预估 = 第一次结账
  for (const kind of ['guoku', 'neitang']) {
    after[kind].forEach((r, i) => {
      const was = before[kind][i];
      const moved = r.stock - was.stock;
      const net = r.inn - r.out;
      console.log(`  对账 ${kind}/${r.key} 库${Math.round(was.stock)}→${Math.round(r.stock)} 变${Math.round(moved)} 收${Math.round(r.inn)} 支${Math.round(r.out)}（预估收${Math.round(was.inn)} 支${Math.round(was.out)}）`);
      if (!opening.n) check(Math.abs(moved - net) <= Math.max(1, Math.abs(r.out + r.inn) * 0.002), `对账 ${kind}/${r.key}：库存之变${Math.round(moved)}等于收减支${Math.round(net)}`);
      check(Math.abs(was.inn - r.inn) <= Math.max(1, r.inn * 0.03), `对账 ${kind}/${r.key}：开局预估收${Math.round(was.inn)}和实收${Math.round(r.inn)}相差不过三分`);
      const tol = Math.max(1, r.out * 0.03);
      check(Math.abs(was.out - r.out) <= tol, `对账 ${kind}/${r.key}：开局预估支${Math.round(was.out)}和实支${Math.round(r.out)}（其中清偿旧欠${Math.round(r.repaid)}）相差不过三分`);
    });
  }
  // 第二回合：账不能逐期累加，库存之变仍等于收减支
  await p.evaluate(async () => {
    const G = window.GM;
    window.CascadeTax.collect();
    window.FixedExpense.collect();
    G.turn++;
    window.GuokuEngine.tick({ turn: G.turn, monthRatio: 1, _monthRatio: 1 });
    window.NeitangEngine.tick({ turn: G.turn, monthRatio: 1, _monthRatio: 1 });
    const { bus } = await import('/ui/core/bus.js');
    bus.emit('game:changed', { what: 'probe' });
  });
  const second = await stocks();
  debtCheck('第二回合', second);
  check(['guoku', 'neitang'].every((kind) => second[kind].every((x) => !x.held)), '第二回合：拨存那一期过了就不再写');
  for (const kind of ['guoku', 'neitang']) {
    second[kind].forEach((r, i) => {
      const was = after[kind][i];
      const moved = r.stock - was.stock;
      console.log(`  第二回合 ${kind}/${r.key} 库${Math.round(was.stock)}→${Math.round(r.stock)} 收${Math.round(r.inn)} 支${Math.round(r.out)}`);
      check(Math.abs(moved - (r.inn - r.out)) <= Math.max(1, Math.abs(r.out + r.inn) * 0.002), `第二回合 ${kind}/${r.key}：库存之变${Math.round(moved)}等于收减支${Math.round(r.inn - r.out)}`);
      if (was.out > 0) check(r.out < was.out * 1.5 + 1, `第二回合 ${kind}/${r.key}：支出没有逐期累加（${Math.round(was.out)}→${Math.round(r.out)}）`);
    });
  }
  await accountCheck('第二回合', 'guoku');
  await accountCheck('第二回合', 'neitang');
  await openBook();
  await toTab('帑廪');
  await shot('settled-guoku');
  await pageCheck('结账后帑廪');
  // 库存成了负数：顶栏和册里都要写明，不能看着像盈余
  const negative = await p.evaluate(async () => {
    const F = await import('/ui/adapter/fiscal.js');
    const bar = document.querySelector('.topbar .q-zhang.link');
    const rows = bar ? [...bar.querySelectorAll('li > b')] : [];
    const cards = [...document.querySelectorAll('.fi-card .stock')];
    return F.account('guoku').res.map((r, i) => ({ key: r.key, stock: r.stock, bar: rows[i] ? rows[i].textContent : '', card: cards[i] ? cards[i].textContent : '' }));
  });
  for (const x of negative) {
    if (x.stock >= 0) continue;
    console.log(`  负库存 ${x.key} ${Math.round(x.stock)} 顶栏「${x.bar}」册「${x.card}」`);
    check(x.bar.startsWith('亏'), `负库存 ${x.key}：顶栏写明亏（${x.bar}）`);
    check(x.card.startsWith('亏空'), `负库存 ${x.key}：册里写明亏空（${x.card}）`);
  }
  await shot('settled-guoku-item');
  await toRes(1);
  await shot('settled-guoku-grain');
  await toRes(0);
  await toTab('内帑');
  await toRes(0);
  await shot('settled-neitang');
  await pageCheck('结账后内帑');
  await shot('settled-neitang-item');

  // 旧存档：存档里没有 huangzhuangDeclared、每亩租率、皇产岁入（那时皇庄按地块公式数合计入账）。
  // 去掉这几项、亩数退回旧剧本的 32 万，再结一期：补读剧本写明的数，皇庄、皇产两项年额和新开局一样
  if (!hz.explicit) {
    const oldSave = await p.evaluate(() => {
      const G = window.GM, n = G.neitang, want = { huangzhuang: n.sources.huangzhuang, huangchan: n.sources.huangchan };
      delete n.huangzhuangDeclared; delete n.huangzhuangRatePerAcre; delete n.imperialBusinessRevenueAnnual; n.huangzhuangAcres = 320000;
      // 各块亩数也换成旧剧本那样的数（每块都记着），补读后应回到剧本现记的
      // 只换剧本里记着的块（开局才由地图生成的块不在剧本里，旧存档里也是同一套生成的数）
      const sc = window.findScenarioById && window.findScenarioById(G.sid), named = new Set();
      const walkSc = (l) => (l || []).forEach((d) => { if (!d) return; if (d.economyBase && d.economyBase.imperialFarmland !== undefined) named.add(d.name); walkSc(d.children); walkSc(d.divisions); });
      Object.keys((sc && sc.adminHierarchy) || {}).forEach((fk) => walkSc((sc.adminHierarchy[fk] || {}).divisions));
      const divs = [], walk = (l) => (l || []).forEach((d) => { if (!d) return; if (d.economyBase && named.has(d.name)) divs.push(d); walk(d.children); walk(d.divisions); });
      Object.keys(G.adminHierarchy || {}).forEach((fk) => walk((G.adminHierarchy[fk] || {}).divisions));
      const fresh = divs.map((d) => d.economyBase.imperialFarmland || 0);
      // 旧剧本的数比现记的大（天启顺天府旧 129.9 万亩、现 94.8 万）。皇庄所在块的亩数随耕地浮动，
      // 块上还记着上期的自然量和每亩比率，旧存档里记的也是旧剧本的数，一并换掉
      let floating = 0;
      divs.forEach((d, i) => {
        const eb = d.economyBase, old = Math.round(fresh[i] * 1.5) + 12345;
        eb.imperialFarmland = old;
        if (typeof eb._imperialFarmlandNaturalLast !== 'number') return;
        floating++;
        eb._imperialFarmlandNaturalLast = old; eb._imperialFarmlandNaturalRate = old / Math.max(1, eb.farmland || 0); eb._imperialFarmlandNaturalDriverLast = eb.farmland;
      });
      window.CascadeTax.collect(); window.FixedExpense.collect(); G.turn++;
      window.GuokuEngine.tick({ turn: G.turn, monthRatio: 1, _monthRatio: 1 });
      window.NeitangEngine.tick({ turn: G.turn, monthRatio: 1, _monthRatio: 1 });
      // 浮动的块开局后已结过一期，和剧本所记差一点，差 2% 以内算回来了
      const near = (a, b) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * 0.02);
      const off = () => divs.filter((d, i) => !near(d.economyBase.imperialFarmland || 0, fresh[i])).map((d) => d.name);
      const wrong = off();
      // 再结一期：补读的亩数不能被浮动基数拉回旧剧本的
      window.CascadeTax.collect();
      const pulledBack = off();
      return { want, got: { huangzhuang: n.sources.huangzhuang, huangchan: n.sources.huangchan }, flag: n.huangzhuangDeclared, divs: divs.length, floating, wrong, pulledBack };
    });
    for (const k of ['huangzhuang', 'huangchan']) check(Math.abs((oldSave.got[k] || 0) - (oldSave.want[k] || 0)) <= 1, `旧存档：补读剧本后${k === 'huangzhuang' ? '皇庄' : '皇产'}年额${Math.round(oldSave.got[k] || 0)}和新开局${Math.round(oldSave.want[k] || 0)}一样`);
    check(oldSave.wrong.length === 0, `旧存档：${oldSave.divs} 块的皇庄亩数补读后回到剧本所记${oldSave.wrong.length ? `，没回来的 ${oldSave.wrong.length} 块：` + oldSave.wrong.slice(0, 8).join('、') : ''}`);
    check(oldSave.pulledBack.length === 0, `旧存档：再结一期，亩数随耕地浮动的 ${oldSave.floating} 块没被拉回旧数${oldSave.pulledBack.length ? `，拉回的：` + oldSave.pulledBack.slice(0, 8).join('、') : ''}`);
  }
  check(errs.length === 0, `页面报错 ${errs.length}`);
  console.log(bad ? `共 ${bad} 处不过` : '全过');
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(3); });
