// 过回合后谁还攥着整局拷贝。
// 开局后、推演前，在页面里给每一份整局拷贝挂一个弱引用（不拦着回收）：推演事务、回滚拷贝（GM、P）、推演前恢复点、
// 定稿、后台自动存档、存档文字包、推演上下文、每回合复核的底稿（整局 JSON 解析出来的大件）。每份都记是第几次推演时做的。
// 过回合、强制回收后，看哪些还活着；同时列出每回合复核在跑的、回合后待办的状态、现行基线是哪一份。
// --watch=秒：最后一回合过完后接着每 20 秒看一次，分清“后台事跑完就放”还是“一直不放”。
// 再清控制台记录（Runtime.discardConsoleEntries）后回收再看——清了就没的，是控制台打印把它带住了。
// --paths：最后从全局往下找还活着的拷贝挂在哪（只走数据属性，闭包里攥着的找不到；最多两分钟）。
// 推演当中凡是带对象参数的控制台打印，都顺着参数往下找四层，碰到上面这些拷贝就记下是哪一句。
// node tools/newui/turn-retain.cjs <天启|绍宋|晚唐> [--turns=1] [--settle=20] [--watch=0] [--paths]
// 需要本机服务：在 web/ 下 python -m http.server 8794。一次只开一个浏览器。
'use strict';
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const SIDS = { 天启: 'sc-tianqi7-1627', 绍宋: 'sc-jianyan1-1127-shaosong', 晚唐: 'sc-tang840-840' };
const USAGE = '用法：node tools/newui/turn-retain.cjs <天启|绍宋|晚唐> [--turns=1] [--settle=20] [--watch=0] [--paths]';
const scnKey = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!SIDS[scnKey]) { console.error(USAGE); process.exit(2); }
const opt = (name, dflt) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? Number(a.split('=')[1]) : dflt; };
const settle = opt('settle', 20) * 1000;
const turns = Math.max(1, opt('turns', 1));
const watchSec = Math.max(0, opt('watch', 0));
const wantPaths = process.argv.includes('--paths');
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
  p.on('dialog', (d) => d.accept().catch(() => {}));
  p.on('crash', () => { console.log('  页面崩溃：渲染进程没了（多半是内存撑爆）'); process.exit(5); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('HeapProfiler.enable');
  const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); await wait(500); await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const settleVeils = async (rounds, cap = 40) => {
    for (let quiet = 0, n = 0; quiet < rounds && n < cap; n++) {
      if (await p.evaluate(() => !!document.querySelector('.q-juan-veil'))) {
        quiet = 0;
        await p.evaluate(() => { const a = [...document.querySelectorAll('.q-juan-veil footer .q-yapai')].pop(); if (a) a.click(); });
        await wait(1200);
      } else { quiet++; await wait(1000); }
    }
  };

  console.log(`新界面 ${scnKey}（${SIDS[scnKey]}）过 ${turns} 回合，查回合后谁还攥着整局拷贝`);
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
  await p.waitForSelector('.scr-desk.on', { timeout: 600000 });
  await wait(6000);
  await settleVeils(10);
  await wait(settle);
  console.log(`  进局（回收后）：堆实占 ${MB(await gc())}`);

  const hooked = await p.evaluate((mockUrl) => {
    const w = window;
    w.P.ai = Object.assign({}, w.P.ai || {}, { key: 'mock-key', url: mockUrl, model: 'mock-model' });
    const T = w.__tr = { refs: [], hits: [], objLogs: 0, labels: new WeakMap(), turn: 0, events: [] };
    const track = (obj, label) => {
      if (!obj || typeof obj !== 'object') return;
      const full = `${label}#${T.turn}`;
      T.refs.push({ label: full, ref: new WeakRef(obj) });
      T.labels.set(obj, full);
    };
    const t0 = Date.now();
    const note = (text) => { if (T.events.length < 400) T.events.push(`${Math.round((Date.now() - t0) / 1000)}s ${text}`); };
    const out = [];
    // 推演事务：回滚拷贝在事务创建时就做好
    if (typeof w._tmCaptureEndTurnTransaction === 'function') {
      const cap = w._tmCaptureEndTurnTransaction;
      w._tmCaptureEndTurnTransaction = function () {
        const txn = cap.apply(this, arguments);
        track(txn, '推演事务');
        track(txn && txn.gm && txn.gm.data, '回滚拷贝·GM');
        track(txn && txn.p && txn.p.data, '回滚拷贝·P');
        track(txn && txn.captureSession, '事务记录');
        return txn;
      };
      out.push('事务');
    }
    // 整份存档态：按调用栈分是谁要的
    if (typeof w._buildSaveState === 'function') {
      const build = w._buildSaveState;
      w._buildSaveState = function (opts) {
        const st = build.apply(this, arguments);
        if (st && opts && opts.detach) {
          const s = String(new Error().stack || '');
          const who = /_tmCapturePreEndTurnCommittedState/.test(s) ? '推演前恢复点'
            : /_endTurn_saveSnapshot/.test(s) ? '定稿'
            : /_tmCommitBackgroundWorld/.test(s) ? '后台自动存档'
            : /_tmCaptureCommittedWorldSnapshotFromLive/.test(s) ? '基线（取自现局）'
            : '其他：' + (s.split('\n')[2] || '').trim().slice(0, 90);
          track(st, who);
        }
        return st;
      };
      out.push('存档态');
    }
    // 存档文字包（整局 JSON 字符串、压缩件都挂在它上面）
    if (w.TM_SaveDB && typeof w.TM_SaveDB.createCanonicalPayload === 'function' && !Object.isFrozen(w.TM_SaveDB)) {
      const mk = w.TM_SaveDB.createCanonicalPayload;
      w.TM_SaveDB.createCanonicalPayload = function (state, identity) {
        const who = /^background:/.test(String(identity && identity.transactionId || '')) ? '后台自动存档' : '回合定稿';
        return Promise.resolve(mk.apply(this, arguments)).then((pl) => { track(pl, `存档文字包·${who}`); return pl; });
      };
      out.push('文字包');
    }
    // 存档写入、时间快照：记开始和结束，看回合后有没有还没写完的
    if (w.TM_SaveDB && typeof w.TM_SaveDB.saveManyAtomic === 'function' && !Object.isFrozen(w.TM_SaveDB)) {
      const save = w.TM_SaveDB.saveManyAtomic;
      w.TM_SaveDB.saveManyAtomic = function (rows, options) {
        const id = String(options && options.transactionId || '?').slice(0, 40);
        note(`存档写入开始 ${id}`);
        return Promise.resolve(save.apply(this, arguments)).then((v) => { note(`存档写入结束 ${id} → ${v}`); return v; }, (e) => { note(`存档写入失败 ${id}：${String(e && e.message || e).slice(0, 80)}`); throw e; });
      };
      out.push('存档写入');
    }
    if (w.StateSnapshot && typeof w.StateSnapshot.save === 'function' && !Object.isFrozen(w.StateSnapshot)) {
      const ss = w.StateSnapshot.save;
      w.StateSnapshot.save = function (args) {
        const turn = args && args.turn;
        note(`时间快照开始 第${turn}回合`);
        return Promise.resolve(ss.apply(this, arguments)).then((v) => { note(`时间快照结束 第${turn}回合 → ${v && v.ok}`); return v; }, (e) => { note(`时间快照失败 第${turn}回合：${String(e && e.message || e).slice(0, 80)}`); throw e; });
      };
      out.push('时间快照');
    }
    // 整局大小的 JSON 解析结果（每回合复核的底稿就是这么拷出来的）：输入超过 20MB 才看调用栈
    const parse = JSON.parse;
    JSON.parse = function (text) {
      const v = parse.apply(this, arguments);
      if (typeof text === 'string' && text.length > 20 * 1048576) {
        const s = String(new Error().stack || '');
        const who = /makeBasis/.test(s) ? '复核底稿' : '大件JSON：' + (s.split('\n')[2] || '').trim().slice(0, 80);
        track(v, who);
      }
      return v;
    };
    out.push('大件JSON');
    const Pl = w.TM && w.TM.Endturn && w.TM.Endturn.Pipeline;
    if (Pl && typeof Pl.buildCtx === 'function') {
      const bc = Pl.buildCtx;
      Pl.buildCtx = function () { const c = bc.apply(this, arguments); track(c, '推演上下文'); return c; };
      out.push('上下文');
    }
    // 带对象参数的控制台打印：顺着参数往下找四层，碰到上面挂了号的拷贝就记下
    const reach = (root) => {
      const seen = new Set([root]);
      const q = [[root, '']];
      for (let i = 0; i < q.length && i < 20000; i++) {
        const [o, path] = q[i];
        const lab = T.labels.get(o);
        if (lab) return `${path || '（参数本身）'} → ${lab}`;
        if (path.split('.').length > 4) continue;
        let keys;
        try { keys = Object.getOwnPropertyNames(o); } catch (_e) { continue; }
        for (const k of keys.slice(0, 300)) {
          let v;
          try { const d = Object.getOwnPropertyDescriptor(o, k); v = d && d.value; } catch (_e) { continue; }
          if (v && typeof v === 'object' && !seen.has(v) && !(typeof Node !== 'undefined' && v instanceof Node)) { seen.add(v); q.push([v, `${path}.${k}`]); }
        }
      }
      return '';
    };
    ['log', 'info', 'warn', 'error', 'debug', 'dir', 'table', 'trace'].forEach((m) => {
      const orig = console[m];
      if (typeof orig !== 'function') return;
      console[m] = function () {
        try {
          for (let i = 0; i < arguments.length; i++) {
            const a = arguments[i];
            if (!a || typeof a !== 'object') continue;
            T.objLogs++;
            const hit = reach(a);
            if (hit && T.hits.length < 200) T.hits.push(`console.${m}「${String(arguments[0]).slice(0, 60)}」第${i}个参数${hit}`);
          }
        } catch (_e) { /* 查不了就算了，照常打印 */ }
        return orig.apply(this, arguments);
      };
    });
    return out;
  }, 'http://127.0.0.1:8794/__mock_ai/v1/chat/completions');
  console.log(`  挂上弱引用和记录：${hooked.join('、')}`);

  const alive = () => p.evaluate(() => {
    const m = new Map();
    window.__tr.refs.forEach((r) => { const k = r.label; const v = m.get(k) || [0, 0]; v[1]++; if (r.ref.deref()) v[0]++; m.set(k, v); });
    // 只列还活着的，死光的一笔带过
    const live = [...m.entries()].filter(([, [a]]) => a > 0).map(([k, [a, n]]) => `${k} ${a}/${n}`);
    const dead = [...m.entries()].filter(([, [a]]) => a === 0).length;
    return { live, dead };
  });
  const state = () => p.evaluate(() => {
    const T = window.__tr, TM = window.TM || {}, GM = window.GM || {};
    let review = [];
    try { review = TM.RecoveryReview && TM.RecoveryReview.status ? TM.RecoveryReview.status().map((s) => `${s.id} ${s.phase || '?'} 调用${s.calls || 0}次「${String(s.detail || '').slice(0, 50)}」`) : ['（无复核模块）']; } catch (e) { review = [`（读不出：${e.message}）`]; }
    // 待办可能上百件（各州民变身份推断各一件），只按状态计数，另列关键记忆（sc25、sc25c）和没做完的前 12 件
    const sum = (list) => {
      const by = {};
      list.forEach((j) => { by[j.status] = (by[j.status] || 0) + 1; });
      const key = list.filter((j) => /^sc25c?$/.test(j.id)).map((j) => `${j.id}:${j.status}`);
      const open = list.filter((j) => j.status !== 'done' && !/^sc25c?$/.test(j.id));
      return `${Object.entries(by).map(([k, v]) => `${k} ${v}`).join('、')}${key.length ? '；关键 ' + key.join(' ') : ''}${open.length ? '；未完 ' + open.slice(0, 12).map((j) => `${j.id}:${j.status}`).join(' ') + (open.length > 12 ? ` 等 ${open.length} 件` : '') : ''}`;
    };
    const q = GM._postTurnJobs;
    const jobs = q && Array.isArray(q.pending) ? `第${q.turn}回合的 ${q.pending.length} 件：${sum(q.pending)}` : '无';
    const det = Array.isArray(GM._postTurnDetachedJobs) && GM._postTurnDetachedJobs.length ? `${GM._postTurnDetachedJobs.length} 件：${sum(GM._postTurnDetachedJobs)}` : '无';
    const base = window.lastCommittedSnapshot;
    const baseLabel = base ? (T.labels.get(base) || T.labels.get(base.state) || '（没挂号的一份）') : '无';
    const events = T.events.splice(0);
    return { review, jobs, det, baseLabel, events, busy: !!GM.busy, turn: GM.turn };
  });
  const report = async (stage) => {
    const used = await gc();
    const a = await alive();
    const s = await state();
    console.log(`  ${stage}：堆实占 ${MB(used)}；第 ${s.turn} 回合${s.busy ? '（推演中）' : ''}`);
    console.log(`    还活着的（活/共）：${a.live.join('　') || '无'}；已放掉的 ${a.dead} 类`);
    console.log(`    现行基线：${s.baseLabel}`);
    console.log(`    回合复核在跑的：${s.review.length ? s.review.join('；') : '无'}`);
    console.log(`    回合后待办：${s.jobs}`);
    console.log(`    脱离待办：${s.det}`);
    if (s.events.length) console.log(`    写入记录：${s.events.join('；')}`);
  };

  for (let n = 1; n <= turns; n++) {
    await p.evaluate((k) => { window.__tr.turn = k; }, n);
    const t0 = Date.now();
    // 推演当中每 2 秒看一次堆（不回收），记最高点
    let peak = 0, peakAt = 0, polling = true;
    const poller = (async () => {
      while (polling) {
        try { const h = await cdp.send('Runtime.getHeapUsage'); if (h.usedSize > peak) { peak = h.usedSize; peakAt = Math.round((Date.now() - t0) / 1000); } } catch (_e) { /* 页面忙时取不到就跳过 */ }
        await wait(2000);
      }
    })();
    const res = await p.evaluate(async () => {
      try { const Gm = await import('/ui/adapter/game.js'); await Gm.game.advance({ court: false }); return { ok: true, turn: window.GM.turn }; }
      catch (e) { return { ok: false, err: String(e && e.message || e).slice(0, 200), turn: window.GM && window.GM.turn }; }
    });
    polling = false;
    await poller;
    console.log(`  第${n}次推演${res.ok ? '完成' : '出错 ' + res.err} ${Math.round((Date.now() - t0) / 1000)} 秒，到第 ${res.turn} 回合；推演当中堆峰值 ${MB(peak)}（第 ${peakAt} 秒）`);
    await settleVeils(6);
    await wait(settle);
    await report(`第${n}次推演后（回收后）`);
  }

  if (watchSec > 0) {
    const w0 = Date.now();
    while (Date.now() - w0 < watchSec * 1000) {
      await wait(20000);
      await report(`再等 ${Math.round((Date.now() - w0) / 1000)} 秒`);
    }
  }

  const info = await p.evaluate(() => ({ hits: window.__tr.hits, objLogs: window.__tr.objLogs }));
  console.log(`  推演当中带对象参数的控制台打印 ${info.objLogs} 处，其中碰到整局拷贝的 ${info.hits.length} 处${info.hits.length ? '：' : ''}`);
  [...new Set(info.hits)].slice(0, 25).forEach((h) => console.log(`    ${h.slice(0, 300)}`));

  await cdp.send('Runtime.enable');
  await cdp.send('Runtime.discardConsoleEntries');
  await report('清控制台记录后（回收后）');

  if (wantPaths) {
    // 清了还在的：从全局往下找路径（只走数据属性，闭包里攥着的找不到）
    const paths = await p.evaluate(() => {
      const T = window.__tr;
      const want = new Map();
      T.refs.forEach((r) => { const o = r.ref.deref(); if (o && !want.has(o)) want.set(o, r.label); });
      if (!want.size) return [];
      const found = [];
      const seen = new Set();
      const skip = new Set(['__tr']);
      const q = [];
      Object.getOwnPropertyNames(window).forEach((k) => {
        if (skip.has(k)) return;
        let v;
        try { const d = Object.getOwnPropertyDescriptor(window, k); v = d && d.value; } catch (_e) { return; }
        if (v && (typeof v === 'object' || typeof v === 'function') && !seen.has(v)) { seen.add(v); q.push([v, `window.${k}`]); }
      });
      const t0 = Date.now();
      for (let i = 0; i < q.length && i < 6000000 && Date.now() - t0 < 120000; i++) {
        const [o, path] = q[i];
        if (want.has(o)) { found.push(`${want.get(o)} ← ${path}`); want.delete(o); if (!want.size) break; continue; }
        if (typeof Node !== 'undefined' && o instanceof Node) continue;
        if (path.length > 400) continue;
        const kids = [];
        if (o instanceof Map) o.forEach((v, k) => { kids.push([v, `${path}.get(${String(k).slice(0, 30)})`]); if (k && typeof k === 'object') kids.push([k, `${path}.key`]); });
        else if (o instanceof Set) { let n = 0; o.forEach((v) => kids.push([v, `${path}.set[${n++}]`])); }
        let keys = [];
        try { keys = Object.getOwnPropertyNames(o); } catch (_e) { /* 跳过 */ }
        for (const k of keys) {
          let v;
          try { const d = Object.getOwnPropertyDescriptor(o, k); v = d && d.value; } catch (_e) { continue; }
          kids.push([v, Array.isArray(o) ? `${path}[${k}]` : `${path}.${k}`]);
        }
        for (const [v, pth] of kids) if (v && (typeof v === 'object' || typeof v === 'function') && !seen.has(v)) { seen.add(v); q.push([v, pth]); }
      }
      want.forEach((label) => found.push(`${label}：从全局按数据属性没找到（多半在闭包、定时器或未了结的承诺里）`));
      return found;
    });
    if (paths.length) { console.log('  清了还在的，从全局找到的路径：'); paths.forEach((x) => console.log(`    ${x.slice(0, 400)}`)); }
  }
  await b.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(3); });
