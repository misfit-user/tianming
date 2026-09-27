// 从《文献通考·征榷考一》（卷十四，维基文库原文）抽取「熙宁十年以前天下诸州商税岁额」：各州所在档次与税务数。
// 原文：https://zh.wikisource.org/w/index.php?title=文獻通考/卷十四&action=raw
// 用法：node parse-wxtk-shangshui.js <卷十四.wiki> [输出.json]
// 原书按岁额分八档列州名（多为省称，如「杭」「蘇」「東京」），州名后小注税务数。
// 各档取代表值：档内上下限的中值，最高一档取四十五万，最低一档取三千。
// 原书按语：四蜀所纳皆铁钱，十才及铜钱之一——四川四路折铜钱时除以十，由使用方处理。
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber } = require(path.join(__dirname, 'parse-mingshi-dili.js'));

const BRACKETS = [
  ['四十萬貫以上', 450000],
  ['二十萬貫以上', 300000],
  ['十萬貫以上', 150000],
  ['五萬貫以上', 75000],
  ['五萬貫以下', 40000],
  ['三萬貫以下', 20000],
  ['一萬貫以下', 7500],
  ['五千貫以下', 3000]
];

function parse(wikiText) {
  const text = wikiText.replace(/-\{([^}]*)\}-/g, '$1').replace(/\{\{YL\|([^}]*)\}\}/g, '$1');
  const lines = text.split(/\n/).map((l) => l.replace(/^[　\s]+/, '').trim());
  const start = lines.findIndex((l) => /^熙寧十年以前天下諸州商稅歲額/.test(l));
  if (start < 0) throw new Error('找不到「熙寧十年以前天下諸州商稅歲額」');
  const out = [];
  let bracket = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (/^按：/.test(line)) break;
    const head = BRACKETS.find(([label]) => line === label + '：');
    if (head) { bracket = head; continue; }
    if (!bracket) continue;
    // 州名后的小注（税务数）可有可无（「東京」无注）；小注后可能不空格直接接下一州
    line.replace(/<sub>([^<]*)<\/sub>/g, (all, note) => '<sub>' + note.replace(/[\s　]/g, '') + '</sub> ').split(/[\s　]+/).filter(Boolean).forEach((token) => {
      const m = token.match(/^([^<]+?)(?:<sub>([^<]*?)(?:<\/sub>)?)?$/);
      if (!m) throw new Error('认不出：' + token);
      const offices = m[2] ? cnToNumber(m[2].replace(/務$/, '')) : null;
      out.push({ name: m[1], bracket: bracket[0], quota: bracket[1], offices });
    });
  }
  return out;
}

if (require.main === module) {
  const rows = parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(rows, null, 1) + '\n');
  const byBracket = {};
  rows.forEach((r) => { (byBracket[r.bracket] = byBracket[r.bracket] || []).push(r.name); });
  Object.entries(byBracket).forEach(([b, names]) => console.log(b + '（' + names.length + '）：' + names.join(' ')));
  console.error('共 ' + rows.length + ' 州');
}

module.exports = { parse, BRACKETS };
