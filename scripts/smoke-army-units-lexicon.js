#!/usr/bin/env node
'use strict';
/* smoke-army-units-lexicon — 兵种识别第4层(LLM 归类·记忆化词典)
 *   前三层(字根/装备)接不住的生僻/架空名 → learnUnknownTypes 调次级 LLM 归类 → 写持久词典 GM._unitLexicon
 *   → 标军 _unitsStale → 签名自愈重派 → classifyUnitType 命中 lexicon 层(src:'lexicon')。
 *   记忆化(只问一次·负缓存 _unitLexiconMiss)·无 key/无生僻则 no-op·永不崩。LLM 调用 mock 注入(opts.callAI)。 */
const path = require('path');
const AU = require(path.resolve(__dirname, '..', 'tm-army-units.js'));
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }

(async () => {
  console.log('smoke-army-units-lexicon');

  /* ① 基线:生僻名前三层接不住→fallback(不误伤有字根的) */
  AU._clearLexicon();
  ok(AU.classifyUnitType('虚空行者').src === 'fallback', '① 虚空行者→fallback(前三层接不住)');
  ok(AU.classifyUnitType('水晶构造体').src === 'fallback', '① 水晶构造体→fallback');
  ok(AU.classifyUnitType('长枪兵').src === 'radical', '① 长枪兵→radical(有字根·不受影响)');
  ok(AU.classifyUnitType('关宁铁骑').arm === 'cav', '① 关宁铁骑→cav(字根·不受影响)');

  /* ② learnUnknownTypes:mock LLM 归类→写持久词典→标脏→重派命中 */
  AU._clearLexicon();
  const mockAI = (prompt, mt, o) => Promise.resolve('```json\n[{"name":"虚空行者","arm":"cav","sub":"shock"},{"name":"水晶构造体","arm":"art","sub":"cannon"}]\n```');
  const GM2 = { armies: [{ id: 'b1', composition: [{ type: '虚空行者', count: 2000 }, { type: '水晶构造体', count: 800 }, { type: '梦魇兽群', count: 500 }] }] };
  AU.ensureAllArmies(GM2);
  const before = GM2.armies[0].units.find(u => u['番号'] === '虚空行者');
  ok(before && before.tacClass === 'step/sword', '② learn前 虚空行者 units=step/sword(fallback)');
  const res = await AU.learnUnknownTypes(GM2, { callAI: mockAI });
  ok(res.learned === 2, '② learnUnknownTypes 学会2个·实=' + JSON.stringify(res));
  ok(GM2._unitLexicon['虚空行者'] && GM2._unitLexicon['虚空行者'].arm === 'cav', '② 持久词典写入 虚空行者→cav(随存档)');
  ok(GM2.armies[0]._unitsStale === true, '② 受影响军标 _unitsStale(签名自愈)');
  AU.ensureArmyUnits(GM2.armies[0]);
  const vk = GM2.armies[0].units.filter(u => u['番号'] === '虚空行者');
  ok(vk.length >= 1 && vk.every(u => u.tacClass === 'cav/shock'), '② 重派后 虚空行者→cav/shock(命中词典·lexicon类型不拆)');
  ok(GM2.armies[0].units.find(u => u['番号'] === '水晶构造体').tacClass === 'art/cannon', '② 水晶构造体→art/cannon');

  /* ③ 负缓存:LLM 未归类者→_unitLexiconMiss·仍 fallback */
  ok(GM2.armies[0].units.find(u => u['番号'] === '梦魇兽群').tacClass === 'step/sword', '③ 梦魇兽群(LLM未归类)→仍fallback');
  ok(GM2._unitLexiconMiss['梦魇兽群'] === 1, '③ 梦魇兽群→负缓存(不再问)');

  /* ④ 记忆化:再学同军→全已知(词典+负缓存)→不再调 LLM */
  let calls = 0; const countAI = (p, mt, o) => { calls++; return Promise.resolve('[]'); };
  const res2 = await AU.learnUnknownTypes(GM2, { callAI: countAI });
  ok(res2.reason === 'none-unknown' && calls === 0, '④ 再学→none-unknown·零LLM调用(只问一次)·实=' + res2.reason + '/calls' + calls);

  /* ⑤ 同步词典层:从 GM._unitLexicon 水合(载入存档)→classifyUnitType 命中 */
  AU._clearLexicon();
  const GM3 = { _unitLexicon: { '雷霆游侠': { arm: 'cav', sub: 'horse' } }, armies: [{ id: 'c1', composition: [{ type: '雷霆游侠', count: 1200 }] }] };
  ok(AU.classifyUnitType('雷霆游侠').src === 'fallback', '⑤ 水合前(清缓存)→fallback');
  AU.ensureAllArmies(GM3);
  ok(AU.classifyUnitType('雷霆游侠').src === 'lexicon', '⑤ ensureAllArmies 水合后→lexicon(从存档 GM._unitLexicon)');
  ok(GM3.armies[0].units[0].tacClass === 'cav/horse', '⑤ units tacClass=cav/horse(词典驱动)');

  /* ⑥ 无 AI 优雅降级(无 callAI/无 key)→no-op·仍 fallback·永不崩 */
  AU._clearLexicon();
  const GM4 = { armies: [{ id: 'd1', composition: [{ type: '不明军团', count: 900 }] }] };
  const r4 = await AU.learnUnknownTypes(GM4, {});
  ok((r4.reason === 'no-ai' || r4.reason === 'no-key') && r4.learned === 0, '⑥ 无callAI/key→no-op·reason=' + r4.reason);
  ok(AU.classifyUnitType('不明军团').src === 'fallback', '⑥ 无AI下仍fallback(永不崩)');

  /* ⑦ 垃圾/无法解析回复→学0+全负缓存·永不崩 */
  AU._clearLexicon();
  const GM5 = { armies: [{ id: 'e1', composition: [{ type: '混沌造物', count: 700 }] }] };
  const r5 = await AU.learnUnknownTypes(GM5, { callAI: () => Promise.resolve('抱歉我无法理解') });
  ok(r5.learned === 0 && GM5._unitLexiconMiss['混沌造物'] === 1, '⑦ 垃圾回复→学0+负缓存(永不崩)');
  const r6 = await AU.learnUnknownTypes(GM5, { callAI: () => Promise.reject(new Error('网络错误')) });
  ok(r6.reason === 'none-unknown' || r6.reason === 'ai-error', '⑦ LLM抛错→捕获不崩·reason=' + r6.reason);

  /* ⑧ 空/无军→不崩 */
  ok((await AU.learnUnknownTypes(null, {})).reason === 'no-armies', '⑧ 无GM→no-armies(不崩)');
  ok((await AU.learnUnknownTypes({ armies: [] }, { callAI: mockAI })).reason === 'none-unknown', '⑧ 空军群→none-unknown');

  console.log('\n结果: ' + A + ' 通过 / ' + F + ' 失败');
  process.exit(F ? 1 : 0);
})();
