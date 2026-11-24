#!/usr/bin/env node
// 新界面舆图聚落等第的读数（web/ui/adapter/select.js settlements）：定地域要的法理所属、政区类别、区划类别、年份读得到。
// 天启的日本、大越，区划树里同一块记两份：prefectures 平列只有名与类别，children 树里那份才带法理所属、政区类别——
// 舆图取到平列那份时，按 id 找带全的那份；取到的本就带全（朝鲜）照用；两份都不带的空着。
// 内核用桩：地图三块、区划树、历法。模块是 ES 模块：拷进临时目录（目录标成 ES 模块）。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB = path.resolve(__dirname, '..');
let passed = 0;
function check(cond, msg) {
  if (!cond) throw new Error('[smoke-newui-settle-read] FAIL ' + msg);
  passed++;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-settle-read-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    for (const f of ['select.js', 'currency.js']) fs.copyFileSync(path.join(WEB, 'ui', 'adapter', f), path.join(dir, f));
    const thinEdo = { id: 'div_edo', name: '江户', level: 'prefecture', divisionType: '城下' };
    const fullEdo = { id: 'div_edo', name: '江户', divisionType: '城下', mapRegionId: 'r-edo', dejureOwner: '德川幕府', regionType: 'foreign_shogunate', children: [] };
    const seoul = { id: 'div_seoul', name: '京畿道', divisionType: '道', dejureOwner: '朝鲜', regionType: 'fanbang' };
    const lone = { id: 'div_lone', name: '孤块', divisionType: '府' };
    const regions = [{ id: 'r-edo', name: '江户' }, { id: 'r-seoul', name: '京畿道' }, { id: 'r-lone', name: '孤块' }];
    const live = { 'r-edo': thinEdo, 'r-seoul': seoul, 'r-lone': lone };
    globalThis.window = {
      GM: {
        turn: 1, facs: [],
        adminHierarchy: {
          'fac-tokugawa-japan': { divisions: [{ id: 'supp-honshu', name: '本州', children: [fullEdo], prefectures: [thinEdo] }] },
          'fac-joseon': { divisions: [seoul] }
        }
      },
      P: { time: { year: 1600 } },
      calcDateFromTurn: () => ({ adYear: 1627, eraInfo: {} }),
      TMPhase8FormalBridge: { __p8MapParts: {
        getMapData: () => ({ regions }),
        regionBundle: (r) => ({ data: { prosperity: 60, terrain: '平原', economyBase: { commerceVolume: 1e6 }, population: 3e5 }, liveDivision: live[r.id] }),
        regionLevel: () => '政区 · 某国'
      } }
    };
    const sel = await import(pathToFileURL(path.join(dir, 'select.js')).href);
    const out = await sel.settlements();
    check(!!out && Object.keys(out).length === 3, '三块都读到');
    check(out['r-edo'].dejure === '德川幕府' && out['r-edo'].regionType === 'foreign_shogunate', `取到平列那份时按 id 找带全的（${JSON.stringify(out['r-edo'])}）`);
    check(out['r-edo'].divisionType === '城下', '区划类别照平列那份');
    check(out['r-seoul'].dejure === '朝鲜' && out['r-seoul'].regionType === 'fanbang' && out['r-seoul'].divisionType === '道', '本就带全的照用');
    check(out['r-lone'].dejure === '' && out['r-lone'].regionType === '', '两份都不带的空着');
    check(Object.values(out).every((x) => x.year === 1627), '年份照内核历法（不是剧本开局年）');
    check(out['r-edo'].kind === '政区', '剧本政区类别照旧');
    check(out['r-edo'].name === '江户' && out['r-lone'].name === '孤块', '地块名递下去（认占城旧地）');
    console.log(`[smoke-newui-settle-read] PASS ${passed} 项`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
