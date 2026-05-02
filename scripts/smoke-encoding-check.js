#!/usr/bin/env node
// Fail fast on common GBK/UTF-8 mojibake in JavaScript source.
// Normal historical Chinese text is allowed; only high-precision corrupted
// marker fragments are rejected.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SELF = path.resolve(__filename);

const MOJIBAKE_MARKERS = [
  '\u95c1\u5180', // 闁冀
  '\u95c1\u4e84', // 闁�
  '\u95c2\u51af', // 闂冯
  '\u95c2\u50a8', // 闂储
  '\u95c2\u52ef', // 闂�
  '\u95c2\u52fc', // 闂�
  '\u95c3\u70d8', // 閃烘
  '\u95c3\u8be7', // 閃诧
  '\u95c6\u52cf', // 閆�
  '\u95c6\u62cc', // 閆�
  '\u95c7\u5e1b', // 閇帛
  '\u95c7\u6098', // 閇悘
  '\u95c8\u7189', // 閈熉
  '\u95c8\u9675', // 閈陵
  '\u95c9\u8dfa', // 閉跺
  '\u95c9\u64bb', // 閉撻
  '\u95c9\u51bf', // 閉冿
  '\u95ca\u9498', // 開钘
  '\u95ca\u546c', // 開呬
  '\u95cb\u6ddf', // 開淟
  '\u95cc\u4edb', // 閌仛
  '\u95cc\u5cf0', // 閌峰
  '\u95cc\u52cd', // 閌�
  '\u95cd\u9e3f', // 閍鸿
  '\u95ce\u52cb', // 閎勋
  '\u95d0\u57ee', // 闐埮
  '\u95d2\u6136', // 闒愶
  '\u95d3\u53e7', // 闓叧
  '\u95d4\u62f7', // 闔拷
  '\u95d6\u5e47', // 闖幇
  '\u95d8\u4f77', // 闘佷
  '\u95d9\u70d8', // 闙烘
  '\u95db\u8dfa', // 闛跺
  '\u95dd\u60e7', // 闝惧
  '\u95de\u56d8', // 闞囘
  '\u95e1\u6c2d', // 闡氭
  '\u95e2\u60e7', // 闢惧
  '\u95e3\u6095', // 闣悕
  '\u95e4\u5c80', // 闤岀
  '\u95e5\u52cd', // 闥�
  '\u95e6\u5e2e', // 闦帮
  '\u95e8\u950b', // 门锋
  '\u95e9\u6076', // 闩恶
  '\u95eb\u7455', // 闫瑕
  '\u95ec\u6c12', // 闬氒
  '\u95ed\u5c95', // 闭岕
  '\u95ef\u67c7', // 闯柇
  '\u95f0\u54f8', // 闰哸
  '\u95f2\u75af', // 闲疯
  '\u95f3\u612d', // 闳愭
  '\u95f5\u59cc', // 闵姌
  '\u95f7\u8d21', // 闷贡
  '\u95f9\u5168', // 闹全
  '\u95fa\u5cf0', // 闺峰
  '\u95fb\u50e7', // 闻僧
  '\u95fd\u6fb6', // 闽澶
  '\u95fe\u59e9', // 闾姩
  '\u95f3\u70d8\u52cf\u93c5', // 闳烘劏鏅
  '\u9350\u546c', // 鍐呬
  '\u9357\u8fab', // 鍗辫
  '\u934f\u6c2b', // 鍏氫
  '\u935b\u6729', // 鍛末
  '\u9418\u56e8', // 鐘囨
  '\u9428\u56e7', // 鐨囧
  '\u9428\u56e8', // 鐨囨
  '\u9435\u4f43', // 鐵佃
  '\u9437\u7441', // 鐷瑁
  '\u943a\u5b2a', // 鐺嬪
  '\u9422\ue7ca', // 鐢
  '\u95b8\u611c', // 閸愜
  '\u95b8\u6200', // 閸戀
  '\u95b9\u6052', // 閹恒
  '\u95ba\u5184', // 閺冄
  '\u95ba\u582b', // 閺堫
  '\u95ba\u5d84', // 閺嶄
  '\u95bb\u5197', // 閻冗
  '\u95bb\u5d85', // 閻嶅
  '\u95bc\u4f78', // 閼佸
  '\u95bd\ufe40', // 閽﹀
  '\u95be\u65bf', // 閾斿
  '\u95bf\u8dfa', // 閿跺
  '\u9366\u9d3f', // 鍦鸿
  '\u934a\u612d', // 鍊愭
  '\u934a\u6c47', // 鍊汇
  '\u934f\u30e7', // 鍏ョ
  '\u9350\u60e7', // 鍐惧
  '\u935a\u5ea4', // 鍚度
  '\u9366\u610d', // 鍦愍
  '\u9372\u70d8', // 鍲烘
  '\u93c9\u51ae', // 鏉冮
  '\u93c8\u6fc6', // 鏈濆
  '\u93c3\u6280', // 鏃技
  '\u93c1\u677f', // 鏁板
  '\u93c0\u5d85', // 鏀呅
  '\u941e\u6c34', // 鐞水
  '\u9420\u4f7a', // 鐠佺
  '\u9422\u67c9', // 鐢柉
  '\u9423\u6b0e', // 鐣欎
  '\u9428\u56e8', // 鐨囨
  '\u9432\u611c', // 鐲愜
  '\u93c2\u528d', // 鏂�
  '\u93c2\u6597', // 鏂斗
  '\u93c3\u5d83', // 鏃�
  '\u93c3\u6a14', // 鏃旀
  '浜轰簨', // 人事 mojibake
  '\u93cc\u30e5', // 鏌ュ
  '\u93cd\u509e', // 鏍傞
  '\u93d7\u610b', // 鏗愋
  '\u93dc\u5d12', // 鏜�
  '\u93dd\u8dfa', // 鏝跺
  '\u93de\u612d', // 鏞愭
  '\u93e1\u581f', // 鏡堟
  '\u93e2\u7b13', // 鏢笓
  '\u93e8\u6fc6', // 鏨濆
  '\u93e9\u7154', // 鏩煔
  '\u93ec\u75af', // 鏬疯
  '\u93ae\u66f6', // 鎮曶
  '\u93b0\u5823', // 鎰堣
  '\u93b7\u7189', // 鎷熉
  '\u93ba\u3128', // 鎺ㄨ
  '\u93bb\u619f', // 鎻掟
  '\u93bf\u611c', // 鎿愜
  '\u95c7\u6fb6', // 閇澶
  '\u6fe1\u30e5', // 濡ュ
  '\u701b\u5c7e', // 瀛尾
  '\u7035\u55d8', // 瀵嗘
  '\u6d93\u5b29', // 涓妩
  '\u6d60\u30e5', // 浠ュ
  '\u6fb6\u509e', // 澶傞
  '\u7455\u55d8', // 瑕嗘
  '\u7481\ue1c0', // 璁
  '\u7487\u5fce', // 璇忔
  '\u74ba\ue047', // 璺
  '\u7611\u509a', // 瘑傚
  '\u7c7c\u5fce', // 籼忔
  '\u7e5a\u934f', // 繚鍏
  '\u7ed4\u5b2a', // 绔嬪
  '\u7eed\u55d8', // 续嗘
  '\u7f01\u55d8', // 缁嗘
  '\u95b5\u6253', // 閵打
  '\u934f\u6c2d\u6df3',
  '\u9350\u5d84\u7ca0',
  '\u9357\u6827\u757c',
  '\u9350\u6d99\u6582',
  '\u5bf0\u56e9',
  '\u6fb6\u535e',
  '\u95c2\u3127',
  '\u935a\u5c80',
  '\u93c8\ue046',
  '\u5be4\u75af',
  '\u93c0\ue224',
  '\u9359\u5d8f',
  '\u95c4\u6d97\u7b05',
  '\u923a\u6128',
  '\u95b8\u6d99',
  '\u6d93\ue15f',
  '\u5a13\u546f\u608a',
  '\u93c6\u64ae\u6e76',
  '\u74ba'
];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const files = walk(ROOT, []).filter((file) => path.resolve(file) !== SELF);
const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const marker of MOJIBAKE_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx >= 0) {
      violations.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: lineOf(text, idx),
        marker
      });
      break;
    }
  }
}

if (violations.length) {
  console.error(`[smoke-encoding-check] found ${violations.length} possible mojibake hit(s)`);
  violations.slice(0, 80).forEach((v) => {
    console.error(`- ${v.file}:${v.line} marker=${JSON.stringify(v.marker)}`);
  });
  if (violations.length > 80) {
    console.error(`... ${violations.length - 80} more`);
  }
  process.exit(1);
}

console.log(`[smoke-encoding-check] pass files=${files.length} markers=${MOJIBAKE_MARKERS.length}`);
