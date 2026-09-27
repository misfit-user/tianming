// 从《和名类聚抄》二十卷本（古活字版）国郡部抽取各国所管郡数与田积（町）。
// 原文：国立国语研究所「日本語史研究用テキストデータ集」https://www2.ninjal.ac.jp/textdb_dataset/kwrs/（CC BY 4.0），
//   txt/kwrs-005.txt 至 kwrs-009.txt（卷五至卷九）。每国首行：「国名［国府…］<TAB>管N［田X町Y段Z步 正公各…］」。
// 翻字本三处国名同作「備前国」，按国府所在郡改正：賀夜郡为備中国，葦田郡为備後国。
// 用法：node parse-wamyosho.js <输出.json> <kwrs-005.txt>...
'use strict';
const fs = require('fs');

const DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function kanjiNumber(s) {
  let total = 0;
  let section = 0;
  let digit = 0;
  for (const ch of s) {
    if (DIGIT[ch]) digit = DIGIT[ch];
    else if (ch === '十' || ch === '百' || ch === '千') {
      section += (digit || 1) * { 十: 10, 百: 100, 千: 1000 }[ch];
      digit = 0;
    } else if (ch === '万') {
      total += (section + digit || 1) * 10000;
      section = 0;
      digit = 0;
    } else throw new Error('认不出的数字：' + s);
  }
  return total + section + digit;
}

const SEAT_FIX = { 賀夜郡: '備中国', 葦田郡: '備後国' };

function main() {
  const [outFile, ...inputs] = process.argv.slice(2);
  const rows = [];
  inputs.forEach((file) => {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
      const cols = line.split('\t');
      if (cols.length < 3 || !/国郡部/.test(cols[0]) || !/^管/.test(cols[2])) return;
      const m = cols[2].match(/^管([一二三四五六七八九十]+)［田([一二三四五六七八九十百千万]+)(?:余)?町/);
      if (!m) return;
      let name = cols[1].replace(/［.*$/, '');
      const seat = (cols[1].match(/国府在(.+?郡)/) || [])[1] || null;
      if (seat && SEAT_FIX[seat]) name = SEAT_FIX[seat];
      rows.push({ name, seat, districts: kanjiNumber(m[1]), fieldCho: kanjiNumber(m[2]), source: cols[0].split('・').slice(0, 3).join('・') });
    });
  });
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 1) + '\n');
  console.log(rows.length + ' 国，田积合计 ' + rows.reduce((a, r) => a + r.fieldCho, 0) + ' 町');
}

main();
