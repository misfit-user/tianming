#!/usr/bin/env node
// 刻本字的简→繁词表：把 OpenCC 的字表、词表压成新前端用的数据模块 web/vendor/opencc/s2t.js。
//   node tools/newui/build-hant.cjs --src <目录>
// 目录里放 OpenCC 仓 data/dictionary 下的 STCharacters.txt、STPhrases.txt，另放一个 COMMIT（取自哪一版，一行提交号）。
// 原件：github.com/BYVoid/OpenCC，Apache-2.0（许可原文在 web/vendor/opencc/LICENSE）。
// 压法：
//   CHARS   只列简繁不同的字，成对排（简繁简繁……，按码位成对：有扩展区的字，一字占两个 UTF-16 单元），取 OpenCC 首选；
//   KEEP    一简多繁、且候选里有它自己的字（后、于、范、台……）——人名里这些字照原字印；
//   PHRASES 词条以「|」隔开，写「词」或「词=位字位字」，只记与按字首选转出不同的位（位以 0-9、a、b 记）。
// 词表全收，按字首选就转得对的词也收：「布政使」「于阗」「吉凶」这类词要在表里，才挡得住「宣布」「于是」那样的错切。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'web', 'vendor', 'opencc', 's2t.js');
const argv = process.argv.slice(2);
const srcAt = argv.indexOf('--src');
if (srcAt < 0 || !argv[srcAt + 1]) {
  console.error('用法：node tools/newui/build-hant.cjs --src <放 STCharacters.txt、STPhrases.txt、COMMIT 的目录>');
  process.exit(2);
}
const SRC = path.resolve(argv[srcAt + 1]);

function table(file) {
  const rows = [];
  for (const raw of fs.readFileSync(path.join(SRC, file), 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [s, t] = line.split('\t');
    if (!s || !t) throw new Error(`${file} 有一行读不懂：${line}`);
    rows.push([s, t.split(' ').filter(Boolean)]);
  }
  return rows;
}

const commit = fs.readFileSync(path.join(SRC, 'COMMIT'), 'utf8').trim();
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('COMMIT 应是一行四十位提交号');

const chars = new Map();
const keep = [];
for (const [s, cands] of table('STCharacters.txt')) {
  if ([...s].length !== 1) throw new Error(`字表里有不止一字的条目：${s}`);
  chars.set(s, cands[0]);
  if (cands.length > 1 && cands.includes(s)) keep.push(s);
}
const byChar = (s) => [...s].map((c) => chars.get(c) || c);

const phrases = [];
let full = 0;
for (const [s, cands] of table('STPhrases.txt')) {
  if (/[|='\\]/.test(s + cands[0])) throw new Error(`词条里有分隔符：${s}`);
  const src = [...s];
  const dst = [...cands[0]];
  if (src.length !== dst.length || src.length > 36) throw new Error(`词条简繁字数不一或过长：${s}`);
  const def = byChar(s);
  let diff = '';
  dst.forEach((c, i) => { if (c !== def[i]) diff += i.toString(36) + c; });
  phrases.push(diff ? `${s}=${diff}` : s);
  if (diff) full++;
}

const pairs = [...chars].filter(([s, t]) => s !== t).map(([s, t]) => s + t).join('');
const lines = [];
for (let i = 0; i < phrases.length; i += 400) lines.push(`  '${phrases.slice(i, i + 400).join('|')}'`);
const out = [
  '// 生成，勿手改：node tools/newui/build-hant.cjs --src <OpenCC data/dictionary>',
  `// 取自 OpenCC（github.com/BYVoid/OpenCC）提交 ${commit} 的 STCharacters.txt、STPhrases.txt；Apache-2.0，许可原文见同目录 LICENSE。`,
  `// 字 ${chars.size}（简繁不同 ${[...pairs].length / 2}，一简多繁留原字 ${keep.length}），词 ${phrases.length}（改字 ${full}）。格式见生成脚本开头。`,
  `export const CHARS = '${pairs}';`,
  `export const KEEP = '${keep.join('')}';`,
  'export const PHRASES = [',
  lines.join(',\n'),
  "].join('|');",
  ''
].join('\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log(`写出 ${path.relative(ROOT, OUT)}：${Buffer.byteLength(out)} 字节；字 ${chars.size}、词 ${phrases.length}（改字 ${full}）、留原字 ${keep.length}`);
