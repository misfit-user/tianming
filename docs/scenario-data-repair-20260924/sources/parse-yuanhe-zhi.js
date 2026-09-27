// 从《元和郡县图志》维基文库原文里抽取各府州的所属方镇、开元户与元和户。
// 原文：https://zh.wikisource.org/w/index.php?title=元和郡縣圖志/卷01&action=raw（卷01 至 卷40；卷十九、二十、二十三、二十四、
// 三十五、三十六原书已佚，维基文库无页面；卷二十五浙西诸州存本无户数）
// 用法：node parse-yuanhe-zhi.js <输出.json> <卷.wiki>...，再跑 songshi-simplify.py 补简体地名。
// 原文结构：卷首标题「卷十二·河東道一　河中節度使」，方镇下「管州五：河中府，絳州……」；
// 「==府州==」标题后第一段是「開元戶X。元和戶Y。鄉Z。」（元和户或缺）。
'use strict';
const fs = require('fs');
const path = require('path');
const { cnToNumber: cnToNumberRaw } = require(path.join(__dirname, 'parse-mingshi-dili.js'));
// 「戶萬五百一十」这类开头省去「一」的写法：萬前补一
const cnToNumber = (text) => cnToNumberRaw(/^[萬万]/.test(text) ? '一' + text : text);

const NUM = '[〇零一二兩两三四五六七八九十百千萬万億亿]+';

function clean(text) {
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<\/?onlyinclude>/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/-\{([^}]*)\}-/g, '$1')
    .replace(/\{\{YL\|([^}]*)\}\}/g, '$1');
}

function parse(wikiText, volume) {
  const text = clean(wikiText);
  const title = (text.match(/\{\{Novel\|[^|]*\|([^|]*)\|/) || [])[1] || '';
  let fangzhen = (title.match(/[　\s]([^　\s]+(?:節度使|觀察使|經略使|防禦使|團練使|都護))/) || [])[1] || '';
  const out = [];
  let current = null;
  text.split(/\n/).forEach((raw) => {
    const line = raw.trim();
    // 同卷内换方镇：「某某節度使」单独成段并随后「管州」
    const fz = line.match(/^([^，。：\s]{2,10}(?:節度使|觀察使|經略使|防禦使|團練使))$/);
    if (fz) { fangzhen = fz[1]; return; }
    const head = line.match(/^==\s*([^=]+?)\s*==$/);
    if (head) {
      if (current) out.push(current);
      current = { volume, fangzhen, name: head[1], kaiyuan: null, yuanhe: null };
      return;
    }
    if (!current || current.kaiyuan != null || current.yuanhe != null || !line) return;
    const k = line.match(new RegExp('開元戶(' + NUM + ')'));
    const y = line.match(new RegExp('元和戶(' + NUM + ')'));
    if (k) current.kaiyuan = cnToNumber(k[1]);
    if (y) current.yuanhe = cnToNumber(y[1]);
  });
  if (current) out.push(current);
  return out;
}

function main() {
  const [outFile, ...files] = process.argv.slice(2);
  const rows = [];
  files.forEach((f) => {
    const text = fs.readFileSync(f, 'utf8');
    if (/^<!DOCTYPE/i.test(text)) return; // 佚卷
    rows.push(...parse(text, path.basename(f, '.wiki')));
  });
  fs.writeFileSync(outFile, JSON.stringify(rows, null, 1) + '\n');
  console.log('府州 ' + rows.length + '，有元和户 ' + rows.filter((r) => r.yuanhe).length + '，有开元户 ' + rows.filter((r) => r.kaiyuan).length);
}

if (require.main === module) main();
module.exports = { parse };
