// 从《金史·地理志》（卷二十四至二十六，维基文库原文）抽取各府州的所属路、等第与户数（泰和七年前后）。
// 原文：https://zh.wikisource.org/w/index.php?title=金史/卷24&action=raw（卷24 至 卷26）
// 用法：node parse-jinshi-dili.js <输出.json> <卷.wiki>...，再跑 songshi-simplify.py 补简体地名。
// 原文结构：「==某路==」下每段一府州：「會寧府，下。……戶X。縣N：」；县、镇段夹在其间。
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber } = require(path.join(__dirname, 'parse-mingshi-dili.js'));

const NUM = '[〇零一二兩两三四五六七八九十百千萬万億亿]+';

function parse(wikiText, volume) {
  const text = wikiText.replace(/-\{([^}]*)\}-/g, '$1').replace(/\{\{YL\|([^}]*)\}\}/g, '$1').replace(/\{\{[^}]*\}\}/g, '');
  const out = [];
  let circuit = '';
  text.split(/\n/).forEach((raw) => {
    const head = raw.match(/^==\s*([^=]+?)\s*==\s*$/);
    if (head) { circuit = head[1].trim(); return; }
    const line = raw.replace(/^[　\s]+/, '').trim();
    // 府州段：名字以府、州、军、路（蒲与路等）结尾，紧跟「，」与等第或建置
    const m = line.match(/^([^，。\s]{1,6}?(?:府|州|軍|路))，/);
    if (!m || !circuit) return;
    const hh = line.match(new RegExp('[戸户戶](' + NUM + ')'));
    const xian = line.match(new RegExp('縣(' + NUM + ')'));
    out.push({
      name: m[1], circuit, volume,
      households: hh ? cnToNumber(hh[1]) : null,
      countyCount: xian ? cnToNumber(xian[1]) : null,
      firstParagraph: line.slice(0, 300)
    });
  });
  return out;
}

if (require.main === module) {
  const [outFile, ...files] = process.argv.slice(2);
  const rows = [];
  files.forEach((f) => rows.push(...parse(fs.readFileSync(f, 'utf8'), path.basename(f).replace(/\..*$/, ''))));
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 1) + '\n');
  const withHh = rows.filter((r) => r.households != null);
  console.error('共 ' + rows.length + ' 府州，有户数的 ' + withHh.length + ' 个，户合计 ' + withHh.reduce((a, r) => a + r.households, 0));
}

module.exports = { parse };
