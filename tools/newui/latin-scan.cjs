// 扫界面数据里漏出来的英文：把朝野册（势力、党派、阶层、家族）、方志、通志的输出整棵走一遍，列出带英文的字串。
// node tools/newui/latin-scan.cjs [场景，默认 1,3,2]；退出码是不同字串的条数（可当门禁用）。
// 需要本机服务：在 web/ 下 python -m http.server 8794；同志的长渲染在跑时别用。
'use strict';
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let total = 0;
  for (const scn of (process.argv[2] || '1,3,2').split(',')) {
    const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
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
    const out = await p.evaluate(async () => {
      const R = await import('/ui/adapter/realm.js');
      const S = await import('/ui/adapter/social.js').catch(() => null);
      const F = await import('/ui/adapter/fangzhi.js');
      const hits = new Map();
      const seen = new WeakSet();
      const walk = (v, where) => {
        if (v == null) return;
        if (typeof v === 'string') {
          if (/^assets\//.test(v)) return;   // 资源路径
          const m = v.match(/[A-Za-z_][A-Za-z_0-9]{2,}/g);
          if (m) m.forEach((w) => { if (!hits.has(w)) hits.set(w, `${where} ｜ ${v.slice(0, 70)}`); });
          return;
        }
        if (typeof v !== 'object' || seen.has(v)) return;
        seen.add(v);
        if (Array.isArray(v)) { v.forEach((x) => walk(x, where)); return; }
        for (const k of Object.keys(v)) {
          // 机器字段；looseSources、refs、sources 是史料引文，西文书名和网址不算漏
          if (/^(id|key|ownerKey|portrait|src|icon|tone|kind|type|regionId|seal|cls|class|liupin|qingzhuo|looseSources|refs|sources|officeNote|gender)$/.test(k)) continue;
          walk(v[k], where);
        }
      };
      const errs = [];
      const guard = (name, fn) => { try { fn(); } catch (e) { errs.push(`${name}: ${String(e && e.message).slice(0, 90)}`); } };
      guard('factions', () => R.factions().forEach((f) => guard(`势力 ${f.name}`, () => walk(R.faction(f.key), `势力 ${f.name}`))));
      if (S) {
        guard('parties', () => (S.parties ? S.parties() : []).forEach((x) => guard(`党 ${x.key}`, () => walk(S.party ? S.party(x.key) : x, `党 ${x.key}`))));
        guard('classes', () => (S.classes ? S.classes() : []).forEach((x) => guard(`阶层 ${x.key}`, () => walk(S.klass ? S.klass(x.key) : S.classOf ? S.classOf(x.key) : x, `阶层 ${x.key}`))));
      }
      guard('families', () => (R.families ? R.families() : []).forEach((x) => guard(`家族 ${x.key}`, () => walk(R.family(x.key), `家族 ${x.key}`))));
      // 人物：名册一行和整本详传。史料出处（网址、西文书名）是引文，不算漏
      const SEL = await import('/ui/adapter/select.js');
      const BIO = await import('/ui/adapter/bio.js');
      const OFF = await import('/ui/adapter/offices.js').catch(() => null);
      guard('people', () => SEL.people({ dead: true }).forEach((c) => {
        const row = { ...c }; delete row.relations; delete row.stats; delete row.wuchang;
        walk(row, `人物 ${c.name}`);
        guard(`详传 ${c.name}`, () => { const b = { ...BIO.person(c.name) }; delete b.sources; delete b.historicalSources; walk(b, `详传 ${c.name}`); });
      }));
      if (OFF && OFF.tree) guard('offices', () => walk(OFF.tree(), '官制'));
      try { await F.ensureCircuits(); } catch (_e) { /* 无省道照扫方志 */ }
      const regions = (window.GM.mapData || window.GM.map || {}).regions || [];
      const cdone = new Set();
      for (const r of regions) {
        guard(`方志 ${r.name}`, () => {
          const d = F.region(r.id);
          if (!d) return;
          walk(d, `方志 ${r.name}`);
          const c = F.circuit(r.id);
          if (c && !cdone.has(c.key)) { cdone.add(c.key); walk(c, `通志 ${c.name}`); }
        });
      }
      return { hits: [...hits.entries()], errs: errs.slice(0, 12), regions: regions.length, circuits: cdone.size };
    });
    console.log(`=== 场景${scn}：地块 ${out.regions}，省道 ${out.circuits}，英文 ${out.hits.length} 个词`);
    out.hits.forEach(([w, at]) => console.log(`  ${w} ← ${at}`));
    out.errs.forEach((e) => console.log(`  出错 ${e}`));
    total += out.hits.length;
    await b.close();
  }
  console.log(`共 ${total} 个词`);
  process.exit(Math.min(total, 100));
})().catch((e) => { console.error(e); process.exit(101); });
