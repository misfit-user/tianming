// 从《文献通考·田赋考四》（维基文库原文）抽取元丰《中书备对》所载四京一十八路垦田与熙宁十年两税见催额。
// 用法：node parse-wxtk-yuanfeng.js <卷四.wiki> [输出.json]
// 原文每路一段：「某路田X頃Y畝，官田X頃Y畝，見催額X貫…<sub>夏稅X…。秋稅X…</sub>」；田亩折成亩，税额只取数字（贯石匹等混计，原书如此）。
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber } = require(path.join(__dirname, 'parse-mingshi-dili.js'));

const NUM = '[〇零一二兩两三四五六七八九十百千萬万億亿]+';

function mu(qing, muPart) {
  return cnToNumber(qing) * 100 + (muPart ? cnToNumber(muPart) : 0);
}

function parse(wikiText) {
  const text = wikiText.replace(/-\{([^}]*)\}-/g, '$1').replace(/\{\{YL\|([^}]*)\}\}/g, '$1');
  const out = [];
  text.split(/\n/).forEach((raw) => {
    const line = raw.replace(/^[　\s]+/, '');
    const head = line.match(/^(\S{2,6}?(?:府界|路))(?:田|田為)/);
    if (!head || !/見催額/.test(line)) return;
    const rec = { name: head[1] };
    const land = line.match(new RegExp('^' + head[1] + '田(' + NUM + ')頃(?:(' + NUM + ')畝)?'));
    if (land) rec.landMu = mu(land[1], land[2]);
    else rec.landNote = line.slice(head[1].length, line.indexOf('，'));
    const official = line.match(new RegExp('官田(' + NUM + ')頃(?:(' + NUM + ')畝)?|官田(' + NUM + ')畝'));
    if (official) rec.officialLandMu = official[3] ? cnToNumber(official[3]) : mu(official[1], official[2]);
    const quota = line.match(new RegExp('見催額(' + NUM + ')'));
    if (quota) rec.twoTaxQuota = cnToNumber(quota[1]);
    const summer = line.match(new RegExp('夏稅(' + NUM + ')'));
    const autumn = line.match(new RegExp('秋稅(' + NUM + ')'));
    if (summer) rec.summerTax = cnToNumber(summer[1]);
    if (autumn) rec.autumnTax = cnToNumber(autumn[1]);
    out.push(rec);
  });
  return out;
}

if (require.main === module) {
  const rows = parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(rows, null, 1));
  rows.forEach((r) => console.log([r.name, r.landMu != null ? Math.round(r.landMu / 1e4) + '万亩' : r.landNote, '官田' + (r.officialLandMu || 0), '见催' + r.twoTaxQuota, '夏' + r.summerTax, '秋' + r.autumnTax].join('\t')));
  const land = rows.reduce((a, r) => a + (r.landMu || 0), 0);
  console.error(rows.length + ' 路，田合计 ' + Math.round(land / 1e4) + ' 万亩（原书总数 461616556 顷亩折 46161.66 万亩）');
}

module.exports = { parse };
