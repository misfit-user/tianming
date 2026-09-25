// 从《新唐书·地理志》（卷三十七至四十三上）维基文库原文里抽取各府州的所属道、土贡、天宝户口、领县数与县名。
// 原文：https://zh.wikisource.org/w/index.php?title=新唐書/卷037&action=raw（卷037 至 卷043上；卷043下为羁縻州，不取）
// 用法：node parse-xintangshu-dili.js <输出.json> <卷.wiki>...，再跑 songshi-simplify.py 补简体地名。
// 原文结构：「==某道==」下「===府州===」；府州标题后第一段是郡名、土贡、「戶X，口Y」「縣N」，其后每段一个属县。
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber } = require(path.join(__dirname, 'parse-mingshi-dili.js'));

const NUM = '[〇零一二兩两三四五六七八九十百千萬万億亿]+';

function clean(text) {
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '') // 校勘记
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/-\{([^}]*)\}-/g, '$1')
    .replace(/\{\{YL\|([^}]*)\}\}/g, '$1')
    .replace(/\{\{\*\|[^{}]*\}\}/g, '') // 小字注
    .replace(/\{\{[^{}]*\}\}/g, '');
}

function parse(wikiText, volume) {
  const lines = clean(wikiText).split(/\n/);
  const out = [];
  let circuit = '';
  let current = null;
  const flush = () => { if (current) out.push(current); current = null; };
  lines.forEach((raw) => {
    const line = raw.trim();
    const head = line.match(/^(={2,4})\s*([^=]+?)\s*=+$/);
    if (head) {
      if (head[1].length === 2) { flush(); circuit = head[2]; return; }
      flush();
      current = { volume, circuit, name: head[2], tribute: [], households: null, mouths: null, countyCount: null, counties: [], text: '' };
      return;
    }
    if (!current || !line) return;
    if (!current.text) {
      current.text = line;
      const tribute = line.match(/(?:厥|土)貢[：:]([^。]*)。/);
      if (tribute) current.tribute = tribute[1].split(/[、，,]/).map((s) => s.trim()).filter(Boolean);
      // 岭南诸州多只记户数
      const hh = line.match(new RegExp('戶(' + NUM + ')(?:，口(' + NUM + '))?'));
      if (hh) { current.households = cnToNumber(hh[1]); current.mouths = hh[2] ? cnToNumber(hh[2]) : null; }
      const cc = line.match(new RegExp('縣(' + NUM + ')。?'));
      if (cc) {
        current.countyCount = cnToNumber(cc[1]);
        // 有的卷把属县连写在州条同一段：「縣七。梁，郟城，魯山……臨汝。」
        line.slice(cc.index + cc[0].length).split(/[，。]/).map((s) => s.trim())
          .filter((s) => s && s.length <= 5 && !/[：:；]/.test(s)).forEach((s) => current.counties.push(s));
      }
      return;
    }
    // 属县段：段首到第一个逗号（无县等者为句号）为县名
    const m = line.match(/^([^，。、\s]{1,5})[，。]/);
    if (m) current.counties.push(m[1]);
  });
  flush();
  return out;
}

function main() {
  const [outFile, ...files] = process.argv.slice(2);
  const rows = [];
  files.forEach((f) => rows.push(...parse(fs.readFileSync(f, 'utf8'), path.basename(f, '.wiki'))));
  const kept = rows.filter((r) => r.households || r.counties.length);
  kept.forEach((r) => delete r.text);
  fs.writeFileSync(outFile, JSON.stringify(kept, null, 1) + '\n');
  const noHh = kept.filter((r) => !r.households).map((r) => r.name);
  console.log('府州 ' + kept.length + '，有户数 ' + (kept.length - noHh.length) + '；无户数：' + noHh.join('、'));
}

if (require.main === module) main();
module.exports = { parse };
