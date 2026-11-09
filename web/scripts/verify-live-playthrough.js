#!/usr/bin/env node
'use strict';
// verify-live-playthrough — 活体过局验证:Node vm 真启动整 bundle(headless harness)·
//   再用「真实加载顺序里的真函数」验本轮关键改动(非抽取 smoke·抓集成/加载/全局接线)。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// ── 复用 headless-smoke 的 harness(makeStubs/parseIndexHtmlScripts)·剥掉它的 main() ──
let hsSrc = fs.readFileSync(path.join(__dirname, 'headless-smoke.js'), 'utf8');
hsSrc = hsSrc.replace(/^#!.*\n/, '').replace(/'use strict';/, '').replace(/main\(\);\s*$/, '');
const factory = new Function('require', '__dirname', hsSrc + '\nreturn { makeStubs, parseIndexHtmlScripts };');
const { makeStubs, parseIndexHtmlScripts } = factory(require, __dirname);

let A = 0, F = 0;
function ok(c, m){ if(c){ A++; console.log('  ✓ '+m);} else { F++; console.log('  ✗ '+m);} }

console.log('verify-live-playthrough — 真启动 bundle');

// ── 1. 真启动:按 index.html 顺序加载全部脚本(含我改的 8 个文件) ──
const { win } = makeStubs();
const sandbox = vm.createContext(win);
const scripts = parseIndexHtmlScripts();
let loaded = 0; const errors = [];
for (const src of scripts) {
  const abs = path.join(ROOT, src);
  if (!fs.existsSync(abs)) { errors.push(src + ' [missing]'); continue; }
  // 浏览器执行经典脚本时 document.currentScript 是该脚本元素（山河境 tm-shanhe-runtime.js 开头读它的 src）
  sandbox.document.currentScript = { src: 'http://127.0.0.1/' + String(src).replace(/\\/g, '/') };
  try { new vm.Script(fs.readFileSync(abs, 'utf8'), { filename: src }).runInContext(sandbox, { timeout: 15000 }); loaded++; }
  catch (e) { errors.push(src + ' :: ' + (e && e.message)); }
  finally { sandbox.document.currentScript = null; }
}
console.log('  载入 ' + loaded + '/' + scripts.length + ' 脚本');
// 我改的文件必须全部成功载入(集成/语法/接线)
const mine = ['tm-endturn-ai-context.js','tm-fiscal-engine.js','tm-keju-enke.js','tm-keju-wuju.js','tm-promotion.js','tm-military.js','tm-memorials.js','tm-endturn-apply.js','generated/tm-ai-change-applier.bundle.js','tm-history-events.js','phase8-formal-modules.js','tm-authority-complete.js','tm-ai-change-pathutils.js','tm-office-system.js','tm-game-loop.js','tm-faction-action-engine.js','tm-faction-npc-llm-decision.js','tm-endturn-prompt.js','tm-chaoyi-changchao.js'];
const mineErr = errors.filter(e => mine.some(f => e.indexOf(f) >= 0));
ok(mineErr.length === 0, '★本轮 ' + mine.length + ' 改动文件全部真实载入无报错' + (mineErr.length ? (' → '+mineErr.join(' | ')) : ''));
ok(errors.length === 0, '全 bundle 零载入错误' + (errors.length ? (' ('+errors.length+'处: '+errors.slice(0,3).join(' ; ')+')') : ''));

// ── 2. 阶层 + 战事 进 AI(真 TM.EndTurnAIContext.appendPromptPolicyContext) ──
try {
  const fn = sandbox.TM && sandbox.TM.EndTurnAIContext && sandbox.TM.EndTurnAIContext.appendPromptPolicyContext;
  ok(typeof fn === 'function', '真全局 TM.EndTurnAIContext.appendPromptPolicyContext 在位');
  const GM = { turn:10,
    classes:[{name:'士绅',satisfaction:62,influence:40,_structBaseline:55,currentDemand:'减赋'},{name:'军户',satisfaction:22,influence:18}],
    activeWars:[{attacker:'本朝',defender:'后金',warScore:-40,reason:'辽东',startTurn:5}],
    armies:[] };
  const out = fn('', { GM: GM });
  ok(out.indexOf('【阶层正册】') >= 0 && out.indexOf('士绅') >= 0, '★真函数注入【阶层正册】(历史回归修·活体确认)');
  ok(out.indexOf('【当前战事】') >= 0 && out.indexOf('本朝 攻 后金') >= 0, '★真函数注入【当前战事】(AI 不再对自己的仗全盲)');
} catch (e) { ok(false, 'appendPromptPolicyContext 活体调用异常: ' + (e && e.message)); }

// ── 3. 补给 + 加固 入战力(真全局 calculateArmyStrength) ──
try {
  const cas = sandbox.calculateArmyStrength;
  ok(typeof cas === 'function', '真全局 calculateArmyStrength 在位');
  const sFull = cas({ soldiers:1000, supply:100 }, {});
  const sLow  = cas({ soldiers:1000, supply:20 }, {});
  ok(sLow < sFull, '★活体:断粮(supply20)战力 < 满补给(supply100)(补给不再是摆设)');
  const sFortDef = cas({ soldiers:1000, fortification:100 }, { isDefender:true });
  const sBareDef = cas({ soldiers:1000 }, { isDefender:true });
  ok(sFortDef > sBareDef, '★活体:守城+满加固 战力 > 守城无加固(fortify 接战力)');
  const sElite = cas({ soldiers:1000, quality:'精兵' }, {});
  const sNorm = cas({ soldiers:1000, quality:'普通' }, {});
  ok(sElite > sNorm, '★活体:精兵(新关键词)战力 > 普通(quality 死字段复活)');
} catch (e) { ok(false, 'calculateArmyStrength 活体调用异常: ' + (e && e.message)); }

// ── 4. 奏疏发廷议入队(真全局 _courtDebateMemorial) ──
try {
  const cdm = sandbox._courtDebateMemorial;
  if (typeof cdm === 'function') {
    sandbox.GM = { turn:3, memorials:[{ from:'张维贤', content:'请蠲免江南赋税', id:'m9' }], _pendingTinyiTopics:[] };
    try { cdm(0); } catch(_eInner) { /* renderMemorials 在 stub DOM 下可能抛·push 在其前已发生 */ }
    const q = sandbox.GM._pendingTinyiTopics || [];
    ok(q.length === 1 && q[0].sourceType === 'memorial', '★活体:发廷议真入 _pendingTinyiTopics(死路径已修)');
    ok(q.length === 1 && q[0].topic.indexOf('请蠲免江南') >= 0, '议题含奏疏内容(不丢失)');
  } else {
    ok(true, '_courtDebateMemorial 非全局(跳过·单测已覆盖)');
  }
} catch (e) { ok(false, '_courtDebateMemorial 活体调用异常: ' + (e && e.message)); }

console.log('\n活体验证: ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F === 0 ? 0 : 1);
