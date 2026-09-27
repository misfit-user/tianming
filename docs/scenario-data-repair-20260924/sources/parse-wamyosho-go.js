// 从《和名类聚抄》二十卷本（古活字版）国郡部卷六至卷九数各国、各郡所列的乡。
// 乡是律令制按户编的单位（一乡五十户），比田积更贴近户口，晚唐剧本日本诸国按乡数分人口。
// 原文：国立国语研究所「日本語史研究用テキストデータ集」https://www2.ninjal.ac.jp/textdb_dataset/kwrs/（CC BY 4.0），
//   txt/kwrs-006.txt 至 kwrs-009.txt。每行「所在<TAB>见出し<TAB>注文」：郡名行见出し是郡名，乡名行见出し为空、注文是乡名。
// 翻字本卷七「加賀国第99」下列的是羽咋、能登、鳳至、珠洲四郡，实为能登国（卷五能登国管此四郡），按郡名改正。
// 用法：node parse-wamyosho-go.js <输出.json> <kwrs-006.txt>...
'use strict';
const fs = require('fs');

const SECTION_FIX = { '加賀国第99': '能登国' };

function main() {
  const [outFile, ...inputs] = process.argv.slice(2);
  const byKuni = new Map();
  inputs.forEach((file) => {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
      const cols = line.split('\t');
      if (cols.length < 3 || cols[1] !== '' || !cols[2].trim()) return;
      const m = cols[0].match(/^巻(\d+)・国郡部第12・((.+?)第\d+)・(.+?)・/);
      if (!m) return;
      const kuni = SECTION_FIX[m[2]] || m[3];
      const gun = m[4];
      if (!byKuni.has(kuni)) byKuni.set(kuni, { name: kuni, townships: 0, districts: {}, source: '巻' + m[1] + '・国郡部第12・' + m[2] });
      const row = byKuni.get(kuni);
      row.townships += 1;
      row.districts[gun] = (row.districts[gun] || 0) + 1;
    });
  });
  const rows = [...byKuni.values()];
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 1) + '\n');
  console.log('国 ' + rows.length + '，乡 ' + rows.reduce((s, r) => s + r.townships, 0));
}

main();
