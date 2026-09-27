// 从《元丰九域志》（四库全书本，维基文库原文）抽取各府州军监的元丰主户、客户与所属路。
// 原文：https://zh.wikisource.org/w/index.php?title=元豐九域志_(四庫全書本)/卷01&action=raw（卷01 至 卷10）
// 用法：node parse-jiuyuzhi.js <输出.json> <卷.wiki>...
// 原文每州：一行州名（等第＋州名＋郡名＋军额），一行「地里」，一行「户主X客Y」；路名用 {{SK anchor|某路}} 标出。
// 生僻字在原文里是 {{SKchar|N}} 占位，州名里遇到的记为「□」，由使用方按上下文认。
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber } = require(path.join(__dirname, 'parse-mingshi-dili.js'));

const NUM = '[〇零一二兩两三四五六七八九十百千萬万億亿]+';
const GRADE = /^(大都督府|都督府|次府|同下州|同上州|望|緊|雄|輔|上|中下|中|下)/;

function clean(line) {
  return line
    .replace(/\{\{SK notes\|(?:[^{}]|\{\{[^{}]*\}\})*\}\}/g, '')
    .replace(/\{\{SKchar\|\d+\}\}/g, '□')
    .replace(/\{\{(?:SK anchor|YL)\|([^{}]*)\}\}/g, '$1')
    .replace(/\{\{YL\|([^{}]*)\}\}/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^[　\s]+/, '')
    .trim();
}

function parse(wikiText, volume) {
  const lines = wikiText.split(/\n/).map(clean).filter(Boolean);
  const out = [];
  let circuit = '';
  lines.forEach((line, i) => {
    if (/^\S{1,4}路$/.test(line) && !/^(東路|西路)$/.test(line)) circuit = line;
    if (/^(東路|西路)$/.test(line)) circuit = circuit.replace(/(東|西)?路$/, '') + line;
    const m = line.match(new RegExp('^[户戸戶]主(' + NUM + ')(?:客(' + NUM + '))?'));
    if (!m) return;
    // 州名行在「地里」行之前
    let j = i - 1;
    while (j >= 0 && /^地里/.test(lines[j])) j--;
    let head = lines[j] || '';
    let grade = '';
    let g;
    while ((g = head.match(GRADE))) { grade += g[1]; head = head.slice(g[1].length); }
    const name = (head.match(/^(.{1,4}?(?:州|府|軍|監))/) || [])[1] || head.slice(0, 4);
    out.push({ name, grade, circuit, volume, head: lines[j], zhu: cnToNumber(m[1]), ke: m[2] ? cnToNumber(m[2]) : 0 });
  });
  return out;
}

if (require.main === module) {
  const [outFile, ...files] = process.argv.slice(2);
  const rows = [];
  files.forEach((f) => rows.push(...parse(fs.readFileSync(f, 'utf8'), path.basename(f).replace(/\..*$/, ''))));
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 1) + '\n');
  rows.forEach((r) => console.log([r.circuit, r.name, r.grade, r.zhu + r.ke].join('\t')));
  console.error('共 ' + rows.length + ' 州，户合计 ' + rows.reduce((a, r) => a + r.zhu + r.ke, 0));
}

module.exports = { parse };
