#!/usr/bin/env node
'use strict';
/* smoke-region-governor-live — 省份/地块面板「地方主官」绑定官职持有人(修死字段):
 * 原 division.governor 是死字段(剧本初始设·任免/死亡不更新)。phase8-formal-map.js 新 liveRegionGovernor(officePosition)
 * 按治理官职在 GM.chars 找在世持有人(title 精确 或 officialTitle 起头/含·因官职含兼衔)。regionBundle 据此派生 data.governor
 * (权威·活)+ data.governorVacant(出缺);死亡/改任→自动出缺。pill/bkRow 渲染空缺·待补红标。
 * 抽源跑匹配逻辑(真实绑定:char.title「顺天巡抚」==div.officialPosition·officialTitle「顺天巡抚·都察院右副都御史」起头匹配)。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', 'phase8-formal-map.js'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-region-governor-live');

// 抽 liveRegionGovernor 函数源
const m = src.match(/function liveRegionGovernor\(officePosition\)\{[\s\S]*?\n  \}/);
ok(!!m, 'liveRegionGovernor 函数存在');
const fn = m ? eval('(' + m[0] + ')') : null;   // 函数表达式

// 真实数据绑定:天启 北直隶 officialPosition「顺天巡抚」·char 刘诏 title「顺天巡抚」/officialTitle「顺天巡抚·都察院右副都御史」
global.window = global;
global.GM = { chars: [
  { name: '刘诏', title: '顺天巡抚', officialTitle: '顺天巡抚·都察院右副都御史', alive: true, administration: 62 },
  { name: '李邦华', title: '应天巡抚', officialTitle: '应天巡抚·都察院右副都御史', alive: true },
  { name: '死督', title: '陕西巡抚', officialTitle: '陕西巡抚·X', alive: false },   // 已殁
  { name: '杂员', title: '主事', officialTitle: '某部主事', alive: true },
  { name: '知府甲', title: '知府', officialTitle: '保定知府', alive: true },        // 泛称·多人
  { name: '知府乙', title: '知府', officialTitle: '河间知府', alive: true }
] };

ok(fn('顺天巡抚') && fn('顺天巡抚').name === '刘诏', '① title 精确匹配在世持有人(顺天巡抚→刘诏)');
ok(fn('应天巡抚') && fn('应天巡抚').name === '李邦华', '② officialTitle 起头匹配(应天巡抚→李邦华)');
ok(fn('陕西巡抚') === null, '③ 持有人已殁→无在世匹配(返 null·上层据此出缺)');
ok(fn('两广总督') === null, '④ 查无此官职持有人→null');
ok(fn('') === null && fn(null) === null, '⑤ 空 officePosition→null 不崩');
// 在世但 title 不等、officialTitle 不起头 → 不误匹配
ok(fn('尚书') === null, '⑥ 不误匹配(主事/某部主事 不含「尚书」起头)');
ok(fn('知府') === null, '⑥b 泛称多人匹配→null(不把第一个知府误派给所有府·唯一匹配才派生)');

// 接线契约:regionBundle 派生 + pill/bkRow 空缺态
ok(/_liveGov\s*=\s*_officePos\s*\?\s*liveRegionGovernor\(_officePos\)/.test(src), '⑦ regionBundle 调 liveRegionGovernor 派生');
ok(/data\.governorVacant\s*=\s*true/.test(src) && /_sc\.alive === false \|\| _sc\.dead === true/.test(src), '⑧ 静态主官已殁→governorVacant(死字段降级)');
ok(/data\.governorVacant\) return '<span class="bk-pill"[\s\S]*?vermillion-400[\s\S]*?空缺·待补/.test(src), '⑨ pill 空缺·待补红标');
ok(/bkRow\('主官', data\.governorVacant \? '空缺·待补'/.test(src), '⑩ bkRow 主官 空缺态');

console.log('\nsmoke-region-governor-live ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
