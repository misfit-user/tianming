// 晚唐各刀共用：剧本府州与《新唐书·地理志》《元和郡县图志》条目的对应。
'use strict';

const path = require('path');

const DIR = path.resolve(__dirname, '..');
const XINTANGSHU = require(path.join(DIR, 'sources/xintangshu-dili-37-43.json'));
// 《元和郡县图志》元和户（约 813 年）；河朔三镇不上户籍于朝廷，元和志所载不可用
const YUANHE = require(path.join(DIR, 'sources/yuanhe-zhi.json'));
// 原账县名表（第一刀清理前存下）
const COUNTIES = new Map(require(path.join(DIR, 'sources/tang-original-leaves.json')).leaves.map((l) => [l.id, l.counties]));

// 唐廷与河朔、昭义四镇的行政树
const TANG_TREES = ['player', '唐·魏博镇', '唐·成德镇', '唐·卢龙镇', '唐·昭义镇'];
const NO_YUANHE_TREES = new Set(['唐·魏博镇', '唐·成德镇', '唐·卢龙镇']);

// 剧本州名 → 志书条目名（新唐书用州的终名：唐州作泌州、随州作隋州、磁州作惠州……；仪州开成间名辽州）
const ALIAS = {
  唐州: '泌州', 随州: '隋州', 交州: '安南中都护府', 单于都护府: '单于大都护府', 仪州: '辽州', 叙州: '敍州', 河阳三城: '孟州',
  磁州: { name: '惠州', circuit: '河北道' }
};

function leavesOf(divisions, out) {
  (divisions || []).forEach((d) => {
    if ((d.children || []).length) leavesOf(d.children, out);
    else out.push(d);
  });
  return out;
}

// 侨置州（名前带「行」，如陷蕃后侨治平凉的行渭州）不取原州的天宝户，按所领县数估
function sourceFor(leafName, counties) {
  if (/^行/.test(leafName)) return { households: null, countyCount: counties.length, counties };
  const base = leafName.split('·')[0];
  const alias = ALIAS[base];
  const want = typeof alias === 'object' ? alias : { name: alias || base };
  return XINTANGSHU.filter((r) => r.nameS === want.name && (!want.circuit || r.circuitS === want.circuit));
}

function yuanheFor(leafName) {
  if (/^行/.test(leafName)) return null;
  const base = leafName.split('·')[0];
  const alias = ALIAS[base];
  const name = typeof alias === 'object' ? alias.name : (alias || base);
  const rows = YUANHE.filter((r) => r.nameS === name && (r.yuanhe || r.kaiyuan));
  return rows.length === 1 ? rows[0] : null;
}

// 同名州（宋州、渭州……）按同道其他州所在的新唐书之道取舍，再不行取有户数的一条
function resolveSources(leaves) {
  const found = leaves.map((l) => {
    const hit = sourceFor(l.name, COUNTIES.get(l.id) || []);
    return Array.isArray(hit) ? hit : [hit].filter(Boolean);
  });
  const circuits = new Set();
  found.forEach((rows) => { if (rows.length === 1 && rows[0].circuitS) circuits.add(rows[0].circuitS); });
  return found.map((rows, i) => {
    if (rows.length <= 1) return rows[0] || null;
    let pick = rows.filter((r) => circuits.has(r.circuitS));
    if (pick.length !== 1) pick = (pick.length ? pick : rows).filter((r) => r.households);
    if (pick.length !== 1) throw new Error(leaves[i].name + ' 在新唐书里对上多条：' + rows.map((r) => r.circuitS).join('、'));
    return pick[0];
  });
}

module.exports = { TANG_TREES, NO_YUANHE_TREES, ALIAS, leavesOf, resolveSources, yuanheFor };
