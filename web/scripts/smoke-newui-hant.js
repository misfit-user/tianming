#!/usr/bin/env node
// 新界面刻本字的简→繁（web/ui/core/hant.js，词表 web/vendor/opencc/s2t.js）：一简多繁的字按词转（十日后→十日後、皇后照旧），
// 本朝专名按补正表（台吉、征夷、颁布），扩展区的字按码位转；人名里一简多繁的字照原字（范景文、于谦），叶万云人名里作葉萬雲，
// 人名先切出来再转其余（督师范景文不切成師範），名单变了下一轮跟着变（同一轮里只取一回）。
// 史记卷不重页（web/ui/adapter/select.js distinctVol、annal；archive.js 史馆目录）：后人戏说与正文同文、正文与时政记同文的不另列一页。
// 模块是 ES 模块：拷进临时目录（目录标成 ES 模块），照仓里的相对位置摆。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const WEB = path.resolve(__dirname, '..');
let passed = 0;
function check(cond, msg) {
  if (!cond) throw new Error('[smoke-newui-hant] FAIL ' + msg);
  passed++;
}
function eq(got, want, msg) { check(got === want, `${msg}：得「${got}」，应为「${want}」`); }

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-hant-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    for (const rel of ['ui/core/hant.js', 'vendor/opencc/s2t.js', 'ui/adapter/select.js', 'ui/adapter/currency.js', 'ui/adapter/archive.js', 'ui/core/numerals.js']) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.copyFileSync(path.join(WEB, rel), path.join(dir, rel));
    }
    globalThis.window = { GM: {} };
    const { hant, hantName, setHantNames } = await import(pathToFileURL(path.join(dir, 'ui/core/hant.js')).href);

    // 一简多繁按词转；按字的照首选
    eq(hant('十日后匿灾重治'), '十日後匿災重治', '日后作日後');
    eq(hant('皇后'), '皇后', '皇后不作皇後');
    eq(hant('后金皇太极整八旗'), '後金皇太極整八旗', '后金作後金');
    eq(hant('行军三百里'), '行軍三百里', '里程的里不作裏');
    eq(hant('城里'), '城裏', '城里作城裏');
    eq(hant('于是遣使屯于西安'), '於是遣使屯於西安', '于是、屯于作於');
    eq(hant('陕西左布政使'), '陝西左布政使', '布政使不作佈');
    eq(hant('头发'), '頭髮', '头发作頭髮');
    eq(hant('天启七年八月'), '天啓七年八月', '日期');
    // 本朝专名补正
    eq(hant('奥巴台吉率骑巡辽东'), '奧巴台吉率騎巡遼東', '台吉不作臺吉');
    eq(hant('征夷大将军'), '征夷大將軍', '征夷不作徵夷');
    eq(hant('颁布诏书'), '頒布詔書', '颁布作頒布（刻本字形）');
    eq(hant('咸福宫'), '咸福宮', '咸福宫不作鹹');
    // 扩展区的字按码位
    eq(hant('\u{2B587}毡'), '鞾氈', '扩展区的字');
    // 空与非字
    eq(hant(''), '', '空串');
    eq(hant(null), '', 'null');
    eq(hant('第3回合 · OK'), '第3回合 · OK', '非汉字照原样');

    // 人名：一简多繁照原字；叶万云作葉萬雲；人名先切出来
    eq(hantName('范景文'), '范景文', '人名范');
    eq(hantName('叶向高'), '葉向高', '人名叶');
    eq(hantName('朱万良'), '朱萬良', '人名万');
    eq(hantName('孙云鹤'), '孫雲鶴', '人名云');
    eq(hantName('武元复'), '武元復', '人名里候选不含自己的字照首选');
    eq(hant('督师范景文奏'), '督師範景文奏', '没登记人名时照词表（对照）');
    let roster = ['范景文', '于谦', '涂文辅', '张采', '周皇后'];
    setHantNames(() => roster);
    eq(hant('督师范景文奏'), '督師范景文奏', '人名先切出来，不切成師範');
    eq(hant('于谦守京师，涂文辅掌御马监，张采上疏'), '于謙守京師，涂文輔掌御馬監，張采上疏', '人名里于、涂、采照原字');
    eq(hant('周皇后贤'), '周皇后賢', '名单里的长名');
    eq(hant('师范'), '師範', '名单之外照常');
    eq(hant('余懋衡上疏'), '餘懋衡上疏', '名单还没有余懋衡');
    roster = roster.concat(['余懋衡']);
    eq(hant('余懋衡上疏'), '餘懋衡上疏', '同一轮里名单只取一回');
    await null;   // 下一轮
    eq(hant('余懋衡上疏'), '余懋衡上疏', '下一轮名单添人后跟着认');
    let reads = 0;
    setHantNames(() => { reads++; return roster; });
    for (let k = 0; k < 50; k++) hant('督师范景文奏');
    eq(reads, 1, '同一轮转五十段只取一回名单');
    setHantNames(() => [null, '张', 42, '朱由检']);
    eq(hant('朱由检'), '朱由檢', '名单里的坏项、单字跳过');
    setHantNames(null);

    // 史记卷不重页
    const sel = await import(pathToFileURL(path.join(dir, 'ui/adapter/select.js')).href);
    eq(sel.distinctVol('同文', ' 同文 '), '', '与前卷同文（首尾空白不计）');
    eq(sel.distinctVol('戏说', '正文', '时政记'), '戏说', '不同文照列');
    eq(sel.distinctVol('', '正文'), '', '空卷');
    window.GM = {
      shijiHistory: [
        { turn: 1, time: 'T1', shizhengji: '时政记甲', zhengwen: '正文甲', houren: '正文甲', shilu: '实录甲' },
        { turn: 2, time: 'T2', shizhengji: '时政记乙', zhengwen: '时政记乙', houren: '戏说乙', shilu: '实录乙' }
      ]
    };
    const a0 = sel.annal(0), a1 = sel.annal(1);
    eq(a0.houren, '', '旧档后人戏说与正文同文：不另列');
    eq(a0.zhengwen, '正文甲', '正文照列');
    eq(a1.zhengwen, '', '正文与时政记同文：不另列');
    eq(a1.houren, '戏说乙', '真有后人戏说照列');
    const archive = await import(pathToFileURL(path.join(dir, 'ui/adapter/archive.js')).href);
    const cat = archive.catalog();
    const vols = (id) => ((cat.find((x) => x.id === id) || {}).vols || []).map(([k]) => k).join('、');
    eq(vols('shiji-0'), '实录、时政记、正文', '史馆目录：同文的后人戏说不列');
    eq(vols('shiji-1'), '实录、时政记、后人戏说', '史馆目录：同文的正文不列');

    console.log(`[smoke-newui-hant] PASS ${passed} 项`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
