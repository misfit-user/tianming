// 从《宋史·地理志》（卷八十五至九十）维基文库原文里抽取各府州军监的所属路、等第、崇宁户口、属县及县等。
// 原文：https://zh.wikisource.org/w/index.php?title=宋史/卷085&action=raw（卷085 至 卷090 六卷）
// 用法：node parse-songshi-dili.js <输出.json> <卷.wiki>...，再跑 songshi-simplify.py 补简体地名。
// 原文结构：「==路==」「===分路===」「====府州====」三级标题（京畿路下府州是三级标题）；
// 府州标题后第一段是沿革与「崇甯戸X，口Y」，其后每段一个属县（或监、寨）。
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber } = require(path.join(__dirname, 'parse-mingshi-dili.js'));

const NUM = '[〇零一二兩两三四五六七八九十百千萬万億亿]+';
const SEAT = /(府|州|軍|監)$/;

function clean(text) {
  return text
    .replace(/-\{([^}]*)\}-/g, '$1')
    .replace(/\{\{YL\|([^}]*)\}\}/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '');
}

function parse(wikiText, volume) {
  const lines = clean(wikiText).split(/\n/);
  const out = [];
  let circuit = '';
  let subCircuit = '';
  let current = null;
  const flush = () => { if (current) out.push(current); current = null; };
  lines.forEach((raw) => {
    const head = raw.match(/^(={2,4})\s*([^=]+?)\s*=+\s*$/);
    if (head) {
      const level = head[1].length;
      const name = head[2].trim();
      if (level === 2) { flush(); circuit = name; subCircuit = ''; return; }
      if (SEAT.test(name) && !/路$/.test(name)) {
        flush();
        current = { name, circuit, subCircuit: subCircuit || circuit, volume, paragraphs: [] };
        return;
      }
      flush();
      subCircuit = name;
      return;
    }
    const text = raw.replace(/^[　\s]+/, '').trim();
    if (current && text) current.paragraphs.push(text);
  });
  flush();
  return out.map((r) => {
    const first = r.paragraphs[0] || '';
    const rec = { name: r.name, circuit: r.circuit, subCircuit: r.subCircuit, volume: r.volume };
    const grade = first.match(new RegExp('^' + r.name + '[，,]\\s*([^。，]{1,4})[。，]'));
    if (grade) rec.grade = grade[1];
    const cy = first.match(new RegExp('崇[甯寧宁]\\s*[戸户戶](' + NUM + ')(?:[，,]\\s*口(' + NUM + '))?'));
    if (cy) rec.chongning = { households: cnToNumber(cy[1]), mouths: cy[2] ? cnToNumber(cy[2]) : null };
    // 不冠年号的「戸X，口Y」：志中户口通为崇宁数，照崇宁用，另记一笔
    const plain = !cy && first.match(new RegExp('[。，][戸户戶](' + NUM + ')(?:[，,]\\s*口(' + NUM + '))?'));
    if (plain) rec.chongning = { households: cnToNumber(plain[1]), mouths: plain[2] ? cnToNumber(plain[2]) : null, unlabeled: true };
    const other = first.match(new RegExp('(元豐|紹興|宣和|政和|大觀)[^戸户戶]{0,6}[戸户戶](' + NUM + ')(?:[，,]\\s*口(' + NUM + '))?'));
    if (!cy && other) rec.otherCensus = { era: other[1], households: cnToNumber(other[2]), mouths: other[3] ? cnToNumber(other[3]) : null };
    const xian = (first + (r.paragraphs[1] || '')).match(new RegExp('縣(' + NUM + ')'));
    // 属县段：「壽光，望。」县名后是县等（赤、畿、次赤、次畿、望、緊、上、中、中下、下），没写等第的记空
    const COUNTY = /^([^，。：]{1,4})[，。](?:(次赤|次畿|赤|畿|望|緊|上|中下|中|下)[。，])?/;
    const countyParas = r.paragraphs.slice(1).filter((p) => COUNTY.test(p));
    rec.counties = countyParas.map((p) => p.match(COUNTY)[1]);
    rec.countyGrades = countyParas.map((p) => p.match(COUNTY)[2] || '');
    // 首段「縣四：钜野，望。」把第一个属县写在同一段里
    const inline = first.match(/縣[^：]{1,4}：([^，。]{1,4})[，。](?:(次赤|次畿|赤|畿|望|緊|上|中下|中|下)[。，])?/);
    if (inline && !rec.counties.includes(inline[1])) {
      rec.counties.unshift(inline[1]);
      rec.countyGrades.unshift(inline[2] || '');
    }
    rec.countyCount = xian ? cnToNumber(xian[1]) : rec.counties.length;
    rec.firstParagraph = first;
    return rec;
  });
}

if (require.main === module) {
  const [outFile, ...files] = process.argv.slice(2);
  const rows = [];
  files.forEach((f) => rows.push(...parse(fs.readFileSync(f, 'utf8'), path.basename(f).replace(/\..*$/, ''))));
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 1));
  let withCensus = 0;
  rows.forEach((r) => {
    if (r.chongning) withCensus++;
    const c = r.chongning ? r.chongning.households + '/' + (r.chongning.mouths ?? '-') : (r.otherCensus ? r.otherCensus.era + ' ' + r.otherCensus.households : '-');
    console.log([r.circuit, r.subCircuit, r.name, r.grade || '', '县' + r.countyCount, c].join('\t'));
  });
  console.error('共 ' + rows.length + ' 个府州军监，有崇宁户口的 ' + withCensus + ' 个');
}

module.exports = { parse };
