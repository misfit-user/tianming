// 从《明史·地理志》维基文库原文（wikitext）里抽取各府州的领州县数与洪武、弘治、万历三朝户口。
// 用法：node parse-mingshi-dili.js <卷.wiki> [输出.json]
'use strict';
const fs = require('fs');

const DIGITS = { '〇': 0, '零': 0, '一': 1, '二': 2, '兩': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
const UNITS = { '十': 10, '百': 100, '千': 1000 };

// 汉字数字转阿拉伯数字：支持「萬」「億」分节，「十」开头（十二）与「零」占位
function cnToNumber(text) {
  const s = String(text).replace(/万/g, '萬').replace(/亿/g, '億');
  let total = 0;
  let section = 0;
  let digit = 0;
  for (const ch of s) {
    if (ch in DIGITS) {
      digit = DIGITS[ch];
    } else if (ch in UNITS) {
      section += (digit || 1) * UNITS[ch];
      digit = 0;
    } else if (ch === '萬') {
      total += (section + digit) * 10000;
      section = 0;
      digit = 0;
    } else if (ch === '億') {
      total = (total + section + digit) * 100000000;
      section = 0;
      digit = 0;
    }
  }
  return total + section + digit;
}

const NUM = '[〇零一二兩两三四五六七八九十百千萬万億亿]+';

function parse(wikiText) {
  const plain = wikiText.replace(/\{\{YL\|([^}]*)\}\}/g, '$1').replace(/\{\{[^}]*\}\}/g, '');
  const out = [];
  plain.split(/\n/).forEach((line) => {
    const head = line.match(/^[　\s]*(\S{1,8}?(?:府|州|衛|司))元/) || line.match(/^[　\s]*(\S{1,8}?(?:府|州))(?:元|洪武|本)/);
    if (!head) return;
    const name = head[1];
    const record = { name };
    const ling = line.match(new RegExp('領(?:州(' + NUM + ')，)?縣(' + NUM + ')'));
    if (ling) {
      record.zhou = ling[1] ? cnToNumber(ling[1]) : 0;
      record.xian = cnToNumber(ling[2]);
    }
    const periods = [
      ['hongwu26', '洪武二十六年[，,]?\\s*編戶(' + NUM + ')，口(' + NUM + ')'],
      ['hongzhi4', '弘治四年[，,]?\\s*戶(' + NUM + ')，口(' + NUM + ')'],
      ['wanli6', '萬曆六年[，,]?\\s*戶(' + NUM + ')，口(' + NUM + ')']
    ];
    periods.forEach(([key, pattern]) => {
      const m = line.match(new RegExp(pattern));
      if (m) record[key] = { households: cnToNumber(m[1]), mouths: cnToNumber(m[2]) };
    });
    if (record.hongwu26 || record.wanli6 || record.xian) out.push(record);
  });
  return out;
}

if (require.main === module) {
  const file = process.argv[2];
  const rows = parse(fs.readFileSync(file, 'utf8'));
  const outFile = process.argv[3];
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(rows, null, 1));
  rows.forEach((r) => {
    const f = (p) => (r[p] ? r[p].households + '/' + r[p].mouths : '-');
    console.log(r.name.padEnd(6, '　'), '州' + (r.zhou ?? '-'), '县' + (r.xian ?? '-'), ' 洪武', f('hongwu26'), ' 弘治', f('hongzhi4'), ' 万历', f('wanli6'));
  });
}

module.exports = { cnToNumber, parse };
