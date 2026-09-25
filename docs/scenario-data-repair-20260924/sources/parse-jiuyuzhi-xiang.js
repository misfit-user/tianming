// 从《元丰九域志》抽取各州属县的乡数（县内分户的权重）。
// 原文两种版本（维基文库）：
//   金陵书局刊本，只录卷一（四京、京东路）：「畿，陳留。<small>京東五十二里。四鄉。…」
//   四库全书本，卷01 至 卷10：「望天長州西一百一十里二十八鄉銅城石梁二鎮望高郵州西北一百里一十鄉…」
// 同一州两本都有时取金陵本。
// 用法：node parse-jiuyuzhi-xiang.js <输出.json> <金陵本卷001.wiki> <四库本卷01.wiki>...
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber } = require(path.join(__dirname, 'parse-mingshi-dili.js'));

const NUM = '[〇零一二兩两三四五六七八九十百千]+';
const GRADES = '次赤|次畿|赤|畿|望|緊|上|中下|中|下';

function cleanSiku(line) {
  return line
    .replace(/\{\{SK notes\|(?:[^{}]|\{\{[^{}]*\}\})*\}\}/g, '')
    .replace(/\{\{SKchar\|\d+\}\}/g, '□')
    .replace(/\{\{(?:SK anchor|YL)\|([^{}]*)\}\}/g, '$1')
    .replace(/\{\{YL\|([^{}]*)\}\}/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^[　\s]+/, '')
    .trim();
}

// 州名：去掉等第、府号前缀后取到第一个州府军监字
function prefectureName(head) {
  let h = head.replace(/^(?:東京|西京|南京|北京)，/, '');
  let g;
  while ((g = h.match(/^(大都督府|中都督府|下都督府|都督府|次府|同下州|同上州|望|緊|雄|輔|上|中下|中|下|□)[，]?/))) h = h.slice(g[0].length);
  const m = h.match(/^(.{1,4}?(?:州|府|軍|監))/);
  return m ? m[1] : null;
}

function parseJinling(text) {
  const out = {};
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let current = null;
  lines.forEach((line, i) => {
    if (/^地里。/.test(line)) {
      current = prefectureName(lines[i - 1].replace(/<[^>]+>.*$/, '').replace(/。$/, ''));
      if (current) out[current] = out[current] || {};
      return;
    }
    const m = line.match(new RegExp('^(' + GRADES + ')，([^。<]{1,4})。<small>(?:[^<]*?)(' + NUM + ')鄉'));
    if (m && current) out[current][m[2]] = cnToNumber(m[3]);
  });
  return out;
}

function parseSiku(text) {
  const out = {};
  const lines = text.split(/\n/).map(cleanSiku).filter(Boolean);
  let current = null;
  const county = new RegExp('(' + GRADES + '|□)?([^\\s　□里鄉鎮，。]{1,3}?)(?:(?:州|府|軍|監|京)?[東西南北]{0,2}(?:' + NUM + ')里)?(' + NUM + ')鄉', 'g');
  lines.forEach((line, i) => {
    if (/^地里/.test(line)) {
      current = prefectureName(lines[i - 1]);
      if (current) out[current] = out[current] || {};
      return;
    }
    if (!current || /^(地里|[户戸戶]主|古跡|土貢)/.test(line)) return;
    let m;
    county.lastIndex = 0;
    while ((m = county.exec(line))) out[current][m[2]] = cnToNumber(m[3]);
  });
  return out;
}

if (require.main === module) {
  const [outFile, jinling, ...siku] = process.argv.slice(2);
  const result = {};
  siku.forEach((f) => Object.assign(result, parseSiku(fs.readFileSync(f, 'utf8'))));
  Object.assign(result, parseJinling(fs.readFileSync(jinling, 'utf8')));
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1) + '\n');
  const n = Object.keys(result).length;
  const c = Object.values(result).reduce((a, o) => a + Object.keys(o).length, 0);
  console.error(n + ' 州，' + c + ' 县');
}

module.exports = { parseJinling, parseSiku };
