// 三部真实剧本：绑定率、问对朝会人数、远方的人真走回来一路落在哪、老档读进来绑不绑、每回合对齐费多少时
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) bad++; };
(async () => {
  for (const scn of (process.argv[2] || '1,3,2').split(',')) {
    const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
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
    console.log(`场景${scn}`);

    const stat = await p.evaluate(() => {
      const g = window.GM, L = window.TMMapLocations;
      const live = (g.chars || []).filter((c) => c && c.alive !== false && c.name);
      const bound = live.filter((c) => c.regionId);
      const t0 = performance.now();
      const n = L.syncCharacters(g);
      const syncMs = performance.now() - t0;
      const here = _getPlayerLocation();
      const atChaoyi = live.filter((c) => !c.isPlayer && _isAtCapital(c));
      const atWendui = live.filter((c) => !c.isPlayer && _wdIsAtCapital(c));
      const R = TM.MapRouteDays;
      const map = g.mapData || g.map;
      const hereIds = L.placeRegionIds(here, g);
      const capIds = L.placeRegionIds(g._capital, g);
      const name = (id) => { const x = R.resolveRegion(map, id); return x && x.region ? x.region.name : id; };
      const exact = window.TM.NPC && TM.NPC.DailyActivities ? live.filter((c) => TM.NPC.DailyActivities.exactLocation(c, g)).length : -1;
      return { live: live.length, bound: bound.length, n, syncMs: Math.round(syncMs * 10) / 10, here, hereRegion: hereIds.map(name), capital: g._capital, capRegion: capIds.map(name), chaoyi: atChaoyi.length, wendui: atWendui.length, exact };
    });
    console.log('  绑定', JSON.stringify(stat));
    check(stat.bound / stat.live > 0.55, `多数人绑上地块（${stat.bound}/${stat.live}）`);
    check(stat.hereRegion.length === 1 && stat.capRegion.length === 1, `玩家和京城都落到唯一地块（${stat.hereRegion} / ${stat.capRegion}）`);
    check(stat.chaoyi === stat.wendui, `朝会问对人数一致（${stat.chaoyi}）`);
    check(stat.syncMs < 100, `每回合对齐不费时（${stat.syncMs}ms）`);

    const trip = await p.evaluate(() => {
      const g = window.GM, L = window.TMMapLocations;
      const dpv = _getDaysPerTurn();
      const here = _ltHerePlace();
      const live = (g.chars || []).filter((c) => c && c.alive !== false && !c.isPlayer && c.name && c.location && !c._travelTo);
      const rows = live.map((c) => ({ c, km: _ltRouteKm(c.location, here) })).filter((r) => r.km > 0 && L.placeRegionIds(r.c.location, g).length === 1)
        .map((r) => ({ ...r, plan: TM.MapRouteDays.planRoute(g.mapData || g.map, L.placeRegionIds(r.c.location, g)[0], L.placeRegionIds(here, g)[0], { mode: 'land' }) }))
        .filter((r) => r.plan && r.plan.status === 'reachable' && r.plan.segments.length >= 4).sort((a, b) => b.km - a.km);
      const pick = rows[Math.floor(rows.length / 3)] || rows[0];
      if (!pick) return { none: true };
      const ch = pick.c;
      const from = ch.location;
      const res = _tmMoveCharToward(ch, here, '奉诏回朝');
      const days = ch._travelRemainingDays;
      const road = pick.plan.path.length;
      const seen = [ch.location];
      let turns = 0, canCourtOnRoad = false;
      while (ch._travelTo && turns < 60) {
        advanceCharTravelByDays(dpv);
        turns++;
        if (ch._travelTo && (_isAtCapital(ch) || _wdIsAtCapital(ch))) canCourtOnRoad = true;
        if (seen[seen.length - 1] !== ch.location) seen.push(ch.location);
      }
      return { name: ch.name, from, here, res, km: Math.round(pick.km), days, dpv, road, turns, need: Math.ceil(days / dpv), seen, regionNow: ch.regionId, canCourtOnRoad,
        arrivedAtCourt: _isAtCapital(ch) && _wdIsAtCapital(ch) && _isSameLocation(ch.location, here), mirror: (g.allCharacters || []).filter((x) => x && x.name === ch.name).map((x) => x.location)[0] };
    });
    console.log('  行程', JSON.stringify(trip).slice(0, 520));
    if (!trip.none) {
      check(trip.res === 'traveling', '上路了');
      check(trip.turns === trip.need, `${trip.days}日走了${trip.turns}回合（每回合${trip.dpv}日）`);
      check(trip.seen.length >= 2 || trip.days <= trip.dpv, `路上换过地块（${trip.seen.length}处）`);
      check(!trip.canCourtOnRoad, '在路上不能问对朝会');
      check(trip.arrivedAtCourt, '到了能问对朝会');
    }

    const load = await p.evaluate(async () => {
      const pp = JSON.parse(JSON.stringify(window.P));
      const gm = JSON.parse(JSON.stringify(window.GM));
      delete pp.gameState;
      let stripped = 0;
      for (const c of gm.chars || []) { if (c && c.regionId) stripped++; if (c) { delete c.regionId; delete c.mapRegionId; delete c.mapLocationBinding; } }
      const data = Object.assign(pp, { gameState: gm });
      try { await fullLoadGame(data, {}); } catch (e) { return { threw: String(e && e.message).slice(0, 160) }; }
      const live = (window.GM.chars || []).filter((c) => c && c.alive !== false && c.name);
      return { stripped, bound: live.filter((c) => c.regionId).length, chaoyi: live.filter((c) => !c.isPlayer && _isAtCapital(c)).length };
    });
    console.log('  老档', JSON.stringify(load));
    check(!load.threw && load.bound >= load.stripped - 2, `没绑过的老档读进来绑上（${load.bound}/${load.stripped}）`);
    check(errs.length === 0, `页面报错 ${errs.length}`);
    await b.close();
  }
  console.log(`共 ${bad} 处问题`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(101); });
