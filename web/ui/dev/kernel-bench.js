// 适配层台：在真内核上走一遍「开局 → 读数 → 存档 → 列档」，结果写进页面与 window.__kernelBench，供截图脚本核对。
// 用法：index.html?ui=new&bench=kernel[&sid=剧本id][&save=1]
import { h } from '../core/dom.js';
import { game } from '../adapter/game.js';
import { num, grade, monthName, dayName } from '../core/numerals.js';
import { qiPanel, zhiPanel, zhang, pin } from '../kit/index.js';

export async function runKernelBench(root) {
  const params = new URLSearchParams(location.search);
  const out = { steps: [], events: [], errors: [] };
  window.__kernelBench = out;
  const logEl = h('ol', { style: { margin: 0, padding: '0 0 0 1.2rem', font: 'var(--fs-2)/1.7 var(--f-kai)', maxHeight: '60vh', overflow: 'auto' } });
  const panel = qiPanel({ title: '适配层台', note: '真内核' }, logEl);
  panel.style.cssText = 'position:fixed;left:1rem;top:1rem;width:34rem;z-index:5';
  root.append(panel);
  const t0 = performance.now();
  const step = (text, data) => {
    const t = ((performance.now() - t0) / 1000).toFixed(1);
    out.steps.push({ t: +t, text, data });
    logEl.append(h('li', `${t}s　${text}`));
    console.log('[kernel-bench]', text, data ?? '');
  };
  for (const ev of ['kernel:loading', 'kernel:toast', 'game:opening', 'game:started', 'game:entered', 'legacy:overlay', 'game:turn-result']) {
    game.on(ev, (p) => out.events.push({ ev, t: +((performance.now() - t0) / 1000).toFixed(2), text: p && (p.text || p.name || p.id || p.className) }));
  }
  try {
    await game.boot();
    step('内核就绪');
    const list = game.scenarios();
    step(`剧本目录 ${list.length} 部：${list.map((s) => s.name).join('、')}`);
    const sid = params.get('sid') || (list.find((s) => /天启/.test(s.name)) || list[0]).id;
    // 开场仪典：新前端此处该演开场；台上直接继续
    game.once('game:opening', (o) => { step(`开场仪典：${o.name}｜${o.player && o.player.clean}｜戏眼 ${o.eyes ? o.eyes.length : 0} 条｜开场白 ${o.opening.length} 字`); setTimeout(() => o.begin(), 50); });
    await game.newGame(sid, { saveName: '适配层台·' + Date.now() });
    step('进入游戏');
    const s = game.select;
    const d = s.date();
    step(`日期：${d.era}${d.reignYear ? num(d.reignYear) + '年' : ''} · ${d.ganzhi}年 · ${d.season} · ${monthName(d.month)}${dayName(d.day)}（${d.dayGanzhi}日）· 公元${d.year} · 第${d.turn}回合 · 内核写作「${d.text}」`);
    const p = s.player();
    step(`玩家：${p.name}（${p.title}）· ${p.faction}`);
    const tr = s.treasury(), pv = s.privy(), cs = s.census(), gs = s.gauges();
    step(`帑廪：${tr.rows.map((r) => `${r.label}${num(r.value)}${r.unit}${r.delta ? (r.delta > 0 ? ' 盈' : ' 亏') + num(r.delta) : ''}`).join('，')}${tr.state ? '（' + tr.state.label + '）' : ''}`);
    step(`内帑：${pv.rows.map((r) => `${r.label}${num(r.value)}${r.unit}`).join('，')}`);
    step(`户口：口${num(cs.mouths)}，户${num(cs.households)}，丁${num(cs.ding)}`);
    step(`国势：${gs.map((g) => `${g.label}${g.value}（${grade(g.value)}）`).join('，')}`);
    const mem = s.memorials();
    step(`待批奏疏 ${mem.length} 件${mem[0] ? '：首件《' + mem[0].title.slice(0, 20) + '》来自' + mem[0].from : ''}`);
    const chars = s.characters();
    step(`在世人物 ${chars.length} 人`);
    const mr = s.mapRegions();
    step(mr ? `舆图府州 ${mr.regions.length} 块，势力 ${Object.keys(mr.factions).length} 家（${mr.mapId}）` : '舆图府州：此剧本无可投影的地图');
    out.snapshot = { date: d, player: p, treasury: tr, privy: pv, census: cs, gauges: gs, memorials: mem.length, characters: chars.length,
      regions: mr ? mr.regions.length : 0, factions: mr ? Object.keys(mr.factions).length : 0,
      sampleRegion: mr && mr.regions.find((r) => r.name === '西安府') };
    // 器物摆一摆读数
    const ledger = zhiPanel({ title: '读数' },
      h('div', { style: { display: 'flex', gap: '1rem', flexWrap: 'wrap' } },
        zhang('帑廪', tr.rows.map((r) => ({ k: r.label, v: r.value, d: r.delta, unit: r.unit }))),
        zhang('内帑', pv.rows.map((r) => ({ k: r.label, v: r.value, d: r.delta, unit: r.unit }))),
        zhang('户口', [{ k: '口', v: cs.mouths }, { k: '丁', v: cs.ding }])),
      h('div', { style: { display: 'flex', gap: '1rem', marginTop: '.75rem' } }, gs.map((g) => pin(g.label, g.value))));
    ledger.style.cssText = 'position:fixed;right:1rem;top:1rem;width:30rem;padding:1rem;z-index:5;color:var(--ink)';
    ledger.querySelectorAll('.q-zhang li > b').forEach((b) => { b.style.color = 'var(--ink)'; });
    root.append(ledger);
    if (params.get('save') === '1') {
      const r = await game.saves.save('适配层台存档');
      step(`存档：${JSON.stringify(r)}`);
      const saves = await game.saves.list();
      step(`存档列表 ${saves.length} 卷：${saves.slice(0, 4).map((x) => x.name).join('、')}`);
      out.saves = saves.length;
    }
    step('完');
  } catch (err) {
    out.errors.push(String(err && err.stack || err));
    step('出错：' + (err && err.message || err));
  }
  out.done = true;
  document.body.dataset.ready = '1';
}
