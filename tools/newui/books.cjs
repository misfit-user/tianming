// 顶栏账簿、四方印打开的两册（度支册、国势册）：逐叶截图、量溢出、走一遍交互。
// node tools/newui/books.cjs <出图目录> <场景关键字> [WxH] [tag]
// 交互：户口排序、欠项展开、点省翻通志、鉴古展开；再灌一份「结账后」的账，看名目细目和源降两账。
const fs = require('fs');
const path = require('path');
const core = 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const [out, scnKey, size = '1536x864', tag = 't'] = process.argv.slice(2);
if (!out || !scnKey) { console.error('用法：node tools/newui/books.cjs <出图目录> <场景关键字> [WxH] [tag]'); process.exit(2); }
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
  // 量：裁掉的字、折成多行的表格行
  const measure = async (name) => {
    const m = await p.evaluate(() => {
      const ov = document.querySelector('.ce-ov.on');
      if (!ov) return null;
      const leaf = ov.querySelector('.ce-leaf.right');
      const clipped = [];
      ov.querySelectorAll('*').forEach((e) => {
        if (e.children.length === 0 && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible') clipped.push(e.textContent.slice(0, 16));
      });
      const tall = [...ov.querySelectorAll('.fi-prov .row, .gs-tax-row, .gs-gaps p:not(.gs-note), .gs-tiles span, .fi-row:not(.xfer), .gs-bars p, .gs-ledger p, .gs-depts p')].filter((e) => e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).fontSize) * 3.2).map((e) => e.textContent.slice(0, 16));
      const wide = leaf.scrollWidth > leaf.clientWidth + 1;
      // 一段字占了几行：数、名这种短东西折行就是版式错了
      const linesOf = (range) => new Set([...range.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
      const lines = (e) => { const r = document.createRange(); r.selectNodeContents(e); return linesOf(r); };
      const broken = [...ov.querySelectorAll('.gs-rows b, .gs-rows p > span:first-child, .fi-card .flow span, .gs-dims b, .gs-grade, .fi-sum-nums b, .gs-seal small span')]
        .filter((e) => e.offsetParent && e.textContent.trim() && lines(e) > 1).map((e) => e.textContent.slice(0, 16));
      // 名目列表：可以换行，但词不能拆开（「巡／狩」）
      const split = [];
      ov.querySelectorAll('.gs-names').forEach((box) => {
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          for (const m of n.data.matchAll(/[^\s　]+/g)) {
            const r = document.createRange();
            r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
            if (linesOf(r) > 1) split.push(m[0]);
          }
        }
      });
      const text = ov.innerText;
      // 负号在标题字里读作「一」；开发口吻不该进册
      const minus = text.match(/[−–—-][零一二三四五六七八九十百千万]+/g) || [];
      const dev = text.match(/预设表|undefined|NaN|\bnull\b|Δ/g) || [];
      // 钱名跟朝代走：不用两的朝代，册里不该出现「若干两」「库银」「·银」
      const moneyUnit = window.CurrencyUnit.getUnit().money;
      const coin = moneyUnit === '两' ? [] : text.match(/[零一二三四五六七八九十百千万亿\d][ \t　]*两|库银|借银|拨银|内帑银|·\s*银|^银$/gm) || [];
      return { scroll: [leaf.scrollHeight, leaf.clientHeight], width: leaf.clientWidth, clipped, tall, wide, broken, split, minus, dev, coin };
    });
    console.log(`  ${name}`, JSON.stringify(m));
    check(m && !m.wide, `${name}：右叶不横向溢出`);
    check(m && m.tall.length === 0, `${name}：表格行不折行`);
    check(m && m.clipped.length === 0, `${name}：没有被裁掉的字 ${m ? m.clipped.join('、') : ''}`);
    check(m && m.broken.length === 0, `${name}：数和名不折行 ${m ? m.broken.join('、') : ''}`);
    check(m && m.split.length === 0, `${name}：名目不拆词 ${m ? m.split.join('、') : ''}`);
    check(m && m.minus.length === 0, `${name}：不用负号写数 ${m ? m.minus.slice(0, 4).join('、') : ''}`);
    check(m && m.dev.length === 0, `${name}：没有开发口吻 ${m ? m.dev.join('、') : ''}`);
    check(m && m.coin.length === 0, `${name}：钱名合朝代 ${m ? m.coin.slice(0, 4).join('、') : ''}`);
    return m;
  };
  const toTab = async (label) => { await p.evaluate((t) => { const x = [...document.querySelectorAll('.fi-tabs button')].find((e) => e.innerText.replace(/\s/g, '').includes(t)); if (x) x.click(); }, label); await wait(500); };

  console.log(`场景 ${scnKey} ${size}`);
  await p.evaluate(() => document.querySelectorAll('.topbar .q-zhang.link')[0]?.click());
  await wait(900);
  await shot('fiscal-guoku');
  await measure('帑廪');
  // 统一预算的剧本（晚唐）开局就有真细目，统统能展开
  const opening = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.fi-right .fi-item')];
    items.forEach((x) => { x.open = true; });
    return { items: items.length, subs: document.querySelectorAll('.fi-right .fi-item .fi-debts.sub p').length, names: [...document.querySelectorAll('.fi-right .fi-item summary .k')].map((x) => x.textContent) };
  });
  console.log('  开局细目', JSON.stringify(opening));
  if (opening.items) {
    await wait(200);
    await shot('fiscal-guoku-items');
    await measure('帑廪细目');
    await p.evaluate(() => document.querySelectorAll('.fi-right .fi-item').forEach((x) => { x.open = false; }));
  }
  const debtsBefore = await p.evaluate(() => document.querySelectorAll('.fi-right .fi-debts p').length);
  if (await p.evaluate(() => !!document.querySelector('.fi-more'))) {
    await click('.fi-more');
    await wait(300);
    const after = await p.evaluate(() => document.querySelectorAll('.fi-right .fi-debts p').length);
    check(after > debtsBefore, `欠项展开：${debtsBefore} → ${after}`);
    await click('.fi-more');
    await wait(200);
  }
  await toTab('内帑');
  await shot('fiscal-neitang');
  await measure('内帑');
  // 顶栏说亏多少，册里就得是多少
  const sameAsBar = await p.evaluate(() => {
    const bar = document.querySelectorAll('.topbar .q-zhang.link')[1];
    const card = document.querySelector('.fi-card');
    return { bar: bar ? bar.innerText.replace(/\s+/g, ' ').slice(0, 30) : '', card: card ? card.innerText.replace(/\s+/g, ' ').slice(0, 50) : '' };
  });
  console.log('  顶栏', sameAsBar.bar, '｜册', sameAsBar.card);
  await toTab('户口');
  await shot('fiscal-census');
  await measure('户口');
  const firstRow = () => p.evaluate(() => document.querySelector('.fi-prov .row .n')?.textContent);
  const r0 = await firstRow();
  await click('.fi-prov .hd .k-fugitives');
  await wait(200);
  await click('.fi-prov .hd .k-fugitives');
  await wait(300);
  const r1 = await firstRow();
  check(r0 && r1 && r0 !== r1, `按逃户升序排：首行 ${r0} → ${r1}`);
  await click('.fi-prov .hd .k-mouths');
  await wait(300);
  await click('.fi-prov .row .n');
  await wait(1800);
  const circuit = await p.evaluate(() => ({ fiscal: !!document.querySelector('.fi-ov.on'), on: !!document.querySelector('.zw.on'), text: (document.querySelector('.zw.on') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 40) }));
  console.log('  点省', JSON.stringify(circuit));
  check(!circuit.fiscal && circuit.on, '点省名：度支册合上，翻到通志');
  await shot('fiscal-to-circuit');
  await p.evaluate(() => [...document.querySelectorAll('.zw.on .zw-ctls button')].pop()?.click());
  await wait(900);

  await p.evaluate(() => document.querySelector('.gauges .link')?.click());
  await wait(900);
  const seals = await p.evaluate(() => [...document.querySelectorAll('.gs-seal')].map((x) => x.querySelector('.name')?.textContent));
  for (let i = 0; i < seals.length; i++) {
    await p.evaluate((n) => document.querySelectorAll('.gs-seal')[n]?.click(), i);
    await wait(450);
    await shot(`guoshi-${i}-${seals[i]}`);
    await measure(seals[i]);
  }
  const folds = await p.evaluate(() => {
    document.querySelectorAll('.gs-seal')[2]?.click();
    const f = document.querySelector('.gs-fold');
    if (!f) return null;
    const closed = !f.open;
    f.querySelector('summary').click();
    return { closed, open: f.open };
  });
  await wait(300);
  if (folds) check(folds.closed && folds.open, '鉴古默认收起，点开展开');

  // ---------- 灌一份结账后的账 ----------
  await p.evaluate(() => {
    const G = window.GM;
    const g = G.guoku;
    delete g.openingFiscalPending;
    g.flowBasis = 'actual';
    G._isFreshNewGame = false;
    G._lastCascadeTaxTurn = G.turn;
    G._lastFixedExpenseTurn = G.turn;
    g.accounting = { turn: G.turn, days: 30 };
    Object.assign(g.ledgers.money, {
      thisTurnIn: 520000, thisTurnOut: 460000,
      sources: { tianfu: 300000, yanlizhuan: 120000, shipaiShui: 60000, qita: 40000 },
      sinks: { 军饷: 280000, 俸禄: 120000, 工程: 60000 },
      sourceDetails: { tianfu: [{ name: '南直隶', amount: 120000 }, { name: '浙江', amount: 100000 }, { name: '江西', amount: 80000 }] },
      sinkDetails: { 军饷: [{ name: '宁远戍军', amount: 160000 }, { name: '京营', amount: 120000 }] },
    });
    const put = (o, k, v) => { if (o) o[k] = v; };
    put(G.minxin, 'sources', { taxation: -6.4, corvee: -2.1, disasterRelief: 3.2, judicialFairness: 0, localOfficial: -1.3, priceStability: 0, security: 0.8, socialMobility: 0, culturalPolicy: 0, heavenSign: 0, auspicious: 0, prophecy: 0, warResult: -4.5, imperialVirtue: 1.1 });
    if (G.huangquan) { G.huangquan.sources = Object.assign({}, G.huangquan.sources, { purge: 4.2, personalRule: 2.5 }); G.huangquan.drains = Object.assign({}, G.huangquan.drains, { factionConsuming: 3.6, idleGovern: 1.2 }); }
    if (G.huangwei) { G.huangwei.sources = Object.assign({}, G.huangwei.sources, { militaryVictory: 5, benevolence: 1.5 }); G.huangwei.drains = Object.assign({}, G.huangwei.drains, { militaryDefeat: 7.5, courtScandal: 2.5, heavenlySign: 1 }); }
  });
  await p.evaluate(() => document.querySelector('.ce-ov.on .ce-close')?.click());
  await wait(500);
  await p.evaluate(() => document.querySelector('.gauges .link')?.click());
  await wait(700);
  for (const [i, nm] of [[1, '民心'], [2, '皇权'], [3, '皇威']]) {
    await p.evaluate((n) => document.querySelectorAll('.gs-seal')[n]?.click(), i);
    await wait(400);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.gs-ledger p')].map((x) => x.innerText.replace(/\s+/g, '')));
    console.log(`  结账后${nm}`, rows.slice(0, 5).join(' '));
    check(rows.length > 0 && !rows.some((t) => /[+−-]0(\.0)?$|[+−-]零$/.test(t)), `结账后${nm}：只列动过的`);
    await shot(`settled-${nm}`);
    await measure(`结账后${nm}`);
  }
  await p.evaluate(() => document.querySelector('.ce-ov.on .ce-close')?.click());
  await wait(500);
  await p.evaluate(() => document.querySelectorAll('.topbar .q-zhang.link')[0]?.click());
  await wait(800);
  await toTab('帑廪');
  const names = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.fi-right .fi-item')];
    if (items[0]) items[0].open = true;
    return { items: items.length, bars: document.querySelectorAll('.fi-right .fi-bar').length };
  });
  console.log('  结账后名目', JSON.stringify(names));
  check(names.bars > 2, '结账后有名目长条');
  check(names.items >= 1 || opening.items >= 1, '有细目的名目可展开');
  await wait(300);
  await shot('settled-fiscal');
  await measure('结账后帑廪');

  const coin = await p.evaluate(async () => {
    const [F, S] = await Promise.all([import('/ui/adapter/fiscal.js'), import('/ui/adapter/select.js')]);
    const bar = S.treasury().rows[0];
    const card = F.account('guoku').res[0];
    const me = S.person();
    return { money: F.money(), bar: [bar.label, bar.unit], card: [card.label, card.unit], granary: F.MEASURES.granary[0][2], wealth: [me.wealth[0].k, me.wealth[0].unit], purse: [me.purse[0].k, me.purse[0].unit] };
  });
  console.log('  钱名', JSON.stringify(coin));
  const same = (a) => a[0] === coin.money.noun && a[1] === coin.money.unit;
  check(same(coin.bar), `顶栏钱名 ${coin.bar.join('、')} 合 ${coin.money.noun}、${coin.money.unit}`);
  check(same(coin.card), `度支册钱名 ${coin.card.join('、')} 和顶栏一样`);
  check(same(coin.wealth) && same(coin.purse), `人物家产公费钱名 ${coin.wealth.join('、')} 和顶栏一样`);
  check(coin.granary.includes(`万${coin.money.unit}`), `赈济约费单位 ${coin.granary}`);
  check(errs.length === 0, `页面报错 ${errs.length}`);
  await b.close();
  console.log(`共 ${bad} 处问题`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(101); });
