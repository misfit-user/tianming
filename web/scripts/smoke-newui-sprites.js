#!/usr/bin/env node
// 新界面舆图的点景小图（web/ui/scene/map/sprites.js，日本朝鲜诸样 sprites-east.js、大越南洋西洋据点诸样 sprites-south.js）：
// 图集每格都画得出（拿一个假的画布照画一遍，记下每格落了几笔、笔落在哪），格号不重、不出图集；
// 低画质时日本、朝鲜、大越、南洋、西洋据点的城郭各档、都城、市镇、港、营造地标与远看的村舍照地域换当地的小图（localSprite、seatSpriteOf），
// 立体模型换了样子的（towns3d-east.js EAST_LOCAL、towns3d-south.js SOUTH_LOCAL）小图也换，立体照原样的小图也照原样；中原、没给地域的照原样，林木各处一样。
// 模块是 ES 模块：拷进临时目录（目录标成 ES 模块）再引，不要浏览器。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB = path.resolve(__dirname, '..');
let passed = 0;
function check(cond, msg) {
  if (!cond) throw new Error('[smoke-newui-sprites] FAIL ' + msg);
  passed++;
}

// 假画布：记下每格（translate 换格）落了几笔填色描边，画路径时用到的坐标落在哪个框里（格内坐标）
function fakeCanvas() {
  const cells = new Map();
  let cur = null;
  const touch = (x, y) => {
    if (!cur || !Number.isFinite(x) || !Number.isFinite(y)) return;
    cur.x0 = Math.min(cur.x0, x); cur.x1 = Math.max(cur.x1, x); cur.y0 = Math.min(cur.y0, y); cur.y1 = Math.max(cur.y1, y);
  };
  const bad = [];
  const g = new Proxy({}, {
    get(_t, k) {
      if (k === 'translate') return (x, y) => { cur = { x, y, marks: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }; cells.set(`${x},${y}`, cur); };
      if (k === 'fill' || k === 'stroke' || k === 'fillRect' || k === 'strokeRect') {
        return (...a) => {
          if (cur) cur.marks++;
          if (a.length >= 4) { touch(a[0], a[1]); touch(a[0] + a[2], a[1] + a[3]); }
          if (a.some((v) => typeof v === 'number' && !Number.isFinite(v))) bad.push(String(k));
        };
      }
      if (k === 'moveTo' || k === 'lineTo' || k === 'quadraticCurveTo' || k === 'arc' || k === 'ellipse') {
        return (...a) => {
          if (a.some((v) => typeof v === 'number' && !Number.isFinite(v))) bad.push(String(k));
          touch(a[k === 'quadraticCurveTo' ? 2 : 0], a[k === 'quadraticCurveTo' ? 3 : 1]);
        };
      }
      return () => {};
    },
    set() { return true; }
  });
  return { canvas: { width: 0, height: 0, getContext: () => g }, cells, bad };
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-sprites-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    for (const f of ['sprites.js', 'sprites-east.js', 'sprites-south.js', 'towns3d-east.js', 'towns3d-south.js']) fs.copyFileSync(path.join(WEB, 'ui', 'scene', 'map', f), path.join(dir, f));
    fs.copyFileSync(path.join(WEB, 'ui', 'model', 'settlement.js'), path.join(dir, 'settlement.js'));
    const sp = await import(pathToFileURL(path.join(dir, 'sprites.js')).href);
    const s = await import(pathToFileURL(path.join(dir, 'settlement.js')).href);
    const east = await import(pathToFileURL(path.join(dir, 'towns3d-east.js')).href);
    const south = await import(pathToFileURL(path.join(dir, 'towns3d-south.js')).href);
    const { SPRITE, ATLAS } = sp;

    // 格号：不重、都在图集里；当地诸样接在原有各格之后
    const idx = Object.values(SPRITE);
    check(new Set(idx).size === idx.length, `格号不重（${idx.length} 格）`);
    check(idx.every((i) => Number.isInteger(i) && i >= 0 && i < ATLAS.cols * ATLAS.rows) && ATLAS.used <= ATLAS.cols * ATLAS.rows, `格号都在 ${ATLAS.cols}×${ATLAS.rows} 的图集里（用到 ${ATLAS.used}）`);
    const LOCAL_FIRST = 32;
    const locals = Object.keys(SPRITE).filter((n) => SPRITE[n] >= LOCAL_FIRST);
    check(locals.length >= 60 && SPRITE.bridge < LOCAL_FIRST, `当地诸样 ${locals.length} 格，接在原有各格之后`);

    // 图集照画一遍：每格都落了笔，笔落在格里（下沿是地面，画的东西够高够宽）
    const fake = fakeCanvas();
    globalThis.document = { createElement: () => fake.canvas };
    const atlas = sp.spriteAtlas();
    check(atlas === fake.canvas && atlas.width === 64 * ATLAS.cols && atlas.height === 64 * ATLAS.rows, `图集 ${atlas.width}×${atlas.height}`);
    check(fake.bad.length === 0, `没有坏数落进画布：${fake.bad.slice(0, 5).join('、')}`);
    for (const [name, i] of Object.entries(SPRITE)) {
      const c = fake.cells.get(`${(i % ATLAS.cols) * 64},${Math.floor(i / ATLAS.cols) * 64}`);
      check(!!c && c.marks >= 4, `${name} 画了（${c ? c.marks : 0} 笔）`);
      if (i < LOCAL_FIRST) continue;
      check(c.x0 > -12 && c.x1 < 76 && c.y0 > -12 && c.y1 < 70 && c.x1 - c.x0 > 24 && c.y1 > 55 && c.y1 - c.y0 > 14,
        `${name} 画在格里、落在地上（x ${c.x0.toFixed(1)}～${c.x1.toFixed(1)}，y ${c.y0.toFixed(1)}～${c.y1.toFixed(1)}）`);
    }

    // 照地域换小图：城郭各档、都城、市镇、港、村舍各处都换；大小与中原一样
    const cityOf = (tier, culture = null, ruined = false) => ({ style: 'city', culture, tier, ruined });
    const isLocal = (cell) => cell >= LOCAL_FIRST;
    for (const c of Object.values(s.CULTURE)) {
      for (let tier = 0; tier < 4; tier++) {
        for (const k of [0, 1]) {
          const [cell, size] = sp.seatSpriteOf(cityOf(tier, c), k), [cn, sn] = sp.seatSpriteOf(cityOf(tier), k);
          check(isLocal(cell) && cell !== cn && size === sn, `${c} 第 ${tier} 档${k ? '（要府）' : ''}画当地的城：#${cell}，大小 ${size}`);
        }
      }
      check(sp.seatSpriteOf(cityOf(0, c), 0)[0] !== sp.seatSpriteOf(cityOf(3, c), 0)[0], `${c} 小城与都会不是同一格`);
      const cap = sp.seatSpriteOf(cityOf(2, c), 2);
      check(isLocal(cap[0]) && cap[0] !== SPRITE.capital && cap[1] === sp.seatSpriteOf(cityOf(2), 2)[1], `${c} 的都城画那一国的都城：#${cap[0]}`);
      check(sp.seatSpriteOf(cityOf(1, c), 2)[0] === sp.seatSpriteOf(cityOf(1, c), 0)[0], `${c} 小国的都城照它自己的档`);
      for (const base of ['market', 'port', 'hamlet', 'hamletB']) check(isLocal(sp.localSprite(base, c)), `${c} 的 ${base} 换当地的小图：#${sp.localSprite(base, c)}`);
      for (const base of ['pine', 'dot', 'jia', 'grove', 'willow']) check(sp.localSprite(base, c) === SPRITE[base], `${c} 的林木 ${base} 照原样`);
      // 立体换了样子的小图也换，立体照原样的小图也照原样（河埠的小图就是港那格）
      const table = { ...east.EAST_LOCAL, ...south.SOUTH_LOCAL }[c];
      for (const base of ['temple', 'shrine', 'church', 'academy', 'fort', 'yamen', 'granary', 'waterworks', 'workshop', 'beacon', 'relay', 'bridge', 'scaffold']) {
        const want = !!(table && table[base]), got = sp.localSprite(base, c, -1);
        check(want ? isLocal(got) : got === -1, `${c} 的 ${base}：立体${want ? '换了' : '照原样'}，小图${want ? '也换' : '也照原样'}（${got}）`);
      }
    }
    // 中原、没给地域、认不得的地域、帐与寨照原样
    check(sp.seatSpriteOf(null, 2)[0] === SPRITE.capital && sp.seatSpriteOf(null, 1)[0] === SPRITE.city && sp.seatSpriteOf(null, 0)[1] === 2.6, '没给分档：京城画京城，其余画府城（要府大一号）');
    check(['town', 'city', 'grand', 'metro'].every((n, tier) => sp.seatSpriteOf(cityOf(tier), 0)[0] === SPRITE[n]), '中原四档：小城、府城、大府、都会');
    check(sp.seatSpriteOf(cityOf(2), 2)[0] === SPRITE.capital && sp.seatSpriteOf(cityOf(2, null, true), 0)[0] === SPRITE.ruin, '中原的京城、残城照原样');
    check(sp.localSprite('market', 'xyz') === SPRITE.market && sp.localSprite('market', null) === SPRITE.market && sp.localSprite('church', null, 7) === 7, '没给地域、认不得的地域照原样');
    check(sp.seatSpriteOf({ style: 'tribal', culture: 'japan', tier: 1 }, 0)[0] === SPRITE.stockL && sp.seatSpriteOf({ style: 'nomad', tier: 0 }, 2)[0] === SPRITE.yurtL, '帐、寨照原样（地域只认城郭）');
    check(sp.localSprite('church', 'west', -1) === sp.localSprite('church', 'seasia', -1) && sp.localSprite('church', 'japan', -1) === -1, '教堂：西洋据点、南洋画西式教堂，别处照祠庙那格');
  } finally {
    delete globalThis.document;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`[smoke-newui-sprites] PASS ${passed} 项`);
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
