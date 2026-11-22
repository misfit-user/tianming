#!/usr/bin/env node
'use strict';
// verify-class-chain-live — 真启动整 bundle（headless·按 index.html 顺序载全部脚本），
//   用真实加载顺序里的真全局驱动本会话八刀阶层链，验组装/接线/载入（非抽取 smoke）。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// 复用 headless-smoke 的 harness（与 verify-live-playthrough 同法）
let hsSrc = fs.readFileSync(path.join(__dirname, 'headless-smoke.js'), 'utf8');
hsSrc = hsSrc.replace(/^#!.*\n/, '').replace(/'use strict';/, '').replace(/main\(\);\s*$/, '');
const factory = new Function('require', '__dirname', hsSrc + '\nreturn { makeStubs, parseIndexHtmlScripts };');
const { makeStubs, parseIndexHtmlScripts } = factory(require, __dirname);

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function r1(n) { return Math.round(Number(n) * 10) / 10; }

console.log('verify-class-chain-live — 真启动整 bundle 驱动阶层链');
const { win } = makeStubs();
const sandbox = vm.createContext(win);
const scripts = parseIndexHtmlScripts();
let loaded = 0; const errors = [];
for (const src of scripts) {
  const abs = path.join(ROOT, src);
  if (!fs.existsSync(abs)) { errors.push(src + ' [missing]'); continue; }
  try { new vm.Script(fs.readFileSync(abs, 'utf8'), { filename: src }).runInContext(sandbox, { timeout: 15000 }); loaded++; }
  catch (e) { errors.push(src + ' :: ' + (e && e.message)); }
}
console.log('  载入 ' + loaded + '/' + scripts.length + ' 脚本');

// ── 1. 本会话 6 改动文件在真 bundle 全部载入无错 ──
const mine = ['tm-social-foundation.js', 'tm-class-engine.js', 'tm-class-mobility.js', 'tm-endturn-ai-context.js', 'tm-endturn-prompt.js', 'tm-endturn-apply.js'];
const mineErr = errors.filter(function (e) { return mine.some(function (f) { return e.indexOf(f) >= 0; }); });
ok(mineErr.length === 0, '★本会话 6 改动文件在真 bundle 全部载入无报错' + (mineErr.length ? (' → ' + mineErr.join(' | ')) : ''));

// ── 2. 真全局接线到位 ──
const SF = sandbox.TM && sandbox.TM.SocialFoundation, CE = sandbox.TM && sandbox.TM.ClassEngine, PF3 = sandbox.PhaseF3;
ok(SF && typeof SF.tick === 'function' && typeof SF.computeLegitimacy === 'function' && typeof SF.tickClassRadical === 'function', '真全局 TM.SocialFoundation.tick/computeLegitimacy/tickClassRadical 在位');
ok(CE && typeof CE.refreshClassPhase === 'function' && typeof CE.ensureClassPopulationCell === 'function', '真全局 TM.ClassEngine.refreshClassPhase/ensureClassPopulationCell 在位');
ok(PF3 && typeof PF3._tickRadicalFlight === 'function', '真全局 PhaseF3._tickRadicalFlight 在位');
// 流寇池（C4 凝聚/镇压/招抚）11-21 删旧时删了：流寇只从各州起事来（tm-revolt-cases / rising / band），旧档流寇池读档后折回逃户
ok(PF3 && typeof PF3._tickRovingCoalesce === 'undefined' && typeof PF3.pacifyRovingRebel === 'undefined', '真全局 PhaseF3 流寇池的口子删了（11-21 删旧）');

// ── 3. 真 bundle 内驱动整条链（苛政·6 回合）──
const leaves = []; for (let i = 0; i < 10; i++) leaves.push({ name: '县' + i, taxRate: 1.45, minxin: 30, statusEffects: i < 5 ? [{ kind: 'disaster' }] : [], warZone: false });
const GM = {
  turn: 0,
  classes: [
    { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 58, demands: '减赋', populationKeys: ['peasant_self'], regionalVariants: [] },
    { name: '士绅', economicRole: '治理', influence: 40, satisfaction: 62, demands: '保优免', populationKeys: ['gentry_high'], regionalVariants: [] }
  ],
  population: { national: { mouths: 10000000 }, byClass: { peasant_self: { mouths: 6000000 }, gentry_high: { mouths: 200000 } }, byLegalStatus: { taoohu: { mouths: 0 } }, hiddenCount: 0 },
  minxin: { trueIndex: 40 }, armies: [], evtLog: []   // evtLog：真 play 游戏开局即初始化的核心字段（addEB 写入处）·此处补全测试 GM
};
const P = { adminHierarchy: { player: { divisions: [{ name: '某省', children: leaves }] } } };
let err = null;
try {
  for (let t = 1; t <= 6; t++) {
    GM.turn = t;
    SF.tick(GM, P);
    GM.classes.forEach(function (c) { CE.refreshClassPhase(GM, c); });
    sandbox.GM = GM; PF3._tickRadicalFlight({}, 1);
  }
} catch (e) { err = ((e && e.message) || String(e)) + ' || @ ' + ((e && e.stack || '').split('\n').slice(1, 4).join(' << ')); }
ok(!err, '真 bundle 内连跑 6 回合无异常' + (err ? (' → ' + err) : ''));

const z = GM.classes[0];
ok(z.satisfaction < 55, '链·自耕农满意度下行(真bundle·A 不对称) → ' + r1(z.satisfaction));
ok((z._radicalFrac || 0) >= 0.3, '链·乱民蓄水上涨(B) → ' + r1(z._radicalFrac));
ok(['brewing', 'uprising'].indexOf((z.revoltState || {}).phase) >= 0, '链·起义态点燃(C1) → ' + (z.revoltState || {}).phase);
ok(GM.population.byLegalStatus.taoohu.mouths > 0 && GM.population.hiddenCount > 0, '链·流民失血+hiddenCount(C2/C3·真bundle) 逃户=' + GM.population.byLegalStatus.taoohu.mouths);
ok(GM.population.byClass.peasant_self.mouths + GM.population.byClass.gentry_high.mouths + GM.population.byLegalStatus.taoohu.mouths === 6200000, '链·人口守恒(真bundle)');
ok(GM._legitimacy && typeof GM._legitimacy.flag === 'string' && GM._legitimacy.flag.length > 0, '链·天命权重旗标(D) → ' + (GM._legitimacy || {}).clout + '/' + (GM._legitimacy || {}).pop + '·' + (GM._legitimacy || {}).flag);

// ── 4. 真 bundle 内正册 prompt 实样 ──
try {
  const ctxFn = sandbox.TM && sandbox.TM.EndTurnAIContext && sandbox.TM.EndTurnAIContext.appendPromptPolicyContext;
  if (typeof ctxFn === 'function') {
    const out = ctxFn('', { GM: GM });
    ok(/乱民\d成/.test(out) && /态:/.test(out), '★真 bundle 正册含乱民N成 + 态:(喂 LLM)');
    console.log('  ── 真 bundle 末回合正册实样 ──');
    out.split('\n').filter(function (ln) { return /正册|自耕农|士绅|天命权重/.test(ln); }).forEach(function (ln) { console.log('  ' + ln.trim()); });
  } else { ok(false, 'TM.EndTurnAIContext.appendPromptPolicyContext 未在真 bundle 在位'); }
} catch (e) { ok(false, '真 bundle 正册调用异常: ' + (e && e.message)); }

console.log('\n[verify-class-chain-live] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
