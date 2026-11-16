#!/usr/bin/env node
// smoke-office-institutions-chronicle-entry.js
// 刀10 反孤儿守卫（真渲染主体）：
//   A) 真调 renderOfficeTree（正常 officeTree / 空 officeTree 各一次），断言「制度志」按钮各恰好出现一个（不缺失·不叠加）；
//   B) 源码字符串断言（防孤儿化·辅）：官制面板须调 PhaseF5.openInstitutionsChronicle；
//   C) 弹窗本体真渲染：对象池老档形状不抛错 + 阶段中文化（含 debate→廷议 / trial→试行 / abolished→已废）。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BTN_MARK = 'og-inst-chronicle-bar';   // 按钮外层唯一 ASCII 标记·用于计数

function assert(cond, msg) {
  if (!cond) { console.error('FAIL ' + msg); throw new Error('[assert] ' + msg); }
}
function countBtn(html) {
  return (String(html).match(new RegExp(BTN_MARK, 'g')) || []).length;
}

// ── el DOM 桩：支持 innerHTML + insertAdjacentHTML(afterbegin/beforeend) ──
function makeEl() {
  return {
    innerHTML: '',
    insertAdjacentHTML(pos, html) {
      if (pos === 'afterbegin') this.innerHTML = html + this.innerHTML;
      else this.innerHTML = this.innerHTML + html;
    }
  };
}

// ── 加载 tm-office-runtime.js 到 vm·并注入渲染所需外部全局/桩 ──
function loadOfficeRuntime() {
  const el = makeEl();
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Date
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-office-runtime.js'), 'utf8'), ctx, { filename: 'tm-office-runtime.js' });
  // 外部全局（本文件不定义·真运行时由姊妹文件提供）
  ctx.escHtml = s => String(s == null ? '' : s);
  ctx._$ = id => (id === 'office-tree' ? el : null);
  // 隔离无关重渲染子函数（按钮挂载正交于树体渲染·桩掉以聚焦被测行为）
  ctx._officeInitDefaults = () => {};
  ctx._renderOfficeTreeList = elm => { elm.innerHTML = '<div class="stub-list"></div>'; };
  return { ctx, el };
}

// ── 加载 generated/tm-ai-change-applier.bundle.js 到 vm（真实写入链·registerInstitution 是 :1184 create 分支实调函数）──
function loadApplier() {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Date
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js'].forEach(function(file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'generated/tm-ai-change-applier.bundle.js'), 'utf8'), ctx, { filename: 'generated/tm-ai-change-applier.bundle.js' });
  return ctx;
}

// ── A) 真渲染：按钮恰好各一个 ──
(function realRenderNonEmpty() {
  const { ctx, el } = loadOfficeRuntime();
  assert(typeof ctx.renderOfficeTree === 'function', 'renderOfficeTree 应为全局函数');
  ctx.P = { officeTree: [] };
  ctx.GM = {
    turn: 5,
    officeTree: [{ name: 'X', positions: [] }],
    dynamicInstitutions: [],
    _officeViewMode: 'list',
    _officeViewModeExplicit: true
  };
  ctx.renderOfficeTree(true);   // force=true 绕开 _gtTabVisible 早返回
  assert(countBtn(el.innerHTML) === 1, '正常 officeTree 渲染后·制度志按钮应恰好一个·实=' + countBtn(el.innerHTML));
  assert(/PhaseF5\.openInstitutionsChronicle/.test(el.innerHTML), '按钮 onclick 应调 PhaseF5.openInstitutionsChronicle');
})();

(function realRenderEmpty() {
  const { ctx, el } = loadOfficeRuntime();
  ctx.P = { officeTree: [] };
  ctx.GM = { turn: 5, officeTree: [], dynamicInstitutions: [] };
  ctx.renderOfficeTree(true);   // 空态分支·提前 return·但按钮须已挂上
  assert(countBtn(el.innerHTML) === 1, '空 officeTree（官制未配置）渲染后·制度志按钮应恰好一个·实=' + countBtn(el.innerHTML));
  assert(/PhaseF5\.openInstitutionsChronicle/.test(el.innerHTML), '空态按钮 onclick 应调 PhaseF5.openInstitutionsChronicle');
})();

// ── C) 弹窗本体真渲染：对象池形状 + 阶段中文化 ──
function makeToolsSandbox(dynamicInstitutions) {
  const created = [];
  const doc = {
    createElement() { const el = { className: '', style: {}, innerHTML: '', addEventListener() {}, remove() {} }; created.push(el); return el; },
    body: { appendChild() {} },
    getElementById() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}, readyState: 'complete'
  };
  const sandbox = {
    console, Math, Date, JSON, RegExp, Error,
    Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
    setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; }, clearTimeout() {},
    document: doc, toast() {}, addEB() {},
    TM: { errors: { capture() {}, captureSilent() {} } },
    GM: { turn: 42, dynamicInstitutions, _permanentReforms: [] }
  };
  sandbox.window = sandbox; sandbox._created = created;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-player-tools.js'), 'utf8'), sandbox, { filename: 'tm-player-tools.js' });
  return sandbox;
}
function lastModalHtml(sandbox) {
  const c = sandbox._created;
  assert(c.length > 0, '弹窗应创建 overlay 元素');
  return c[c.length - 1].innerHTML;
}

// C1) 对象池老档形状不抛错 + running→施行
(function objectPoolShape() {
  const sb = makeToolsSandbox({ ministries: { m1: { name: '银流司', rank: 5, stage: 'running', createdTurn: 10, staffSize: 20, annualBudget: 40000, effectiveness: 0.75, corruption: 15 } } });
  assert(sb.PhaseF5 && typeof sb.PhaseF5.openInstitutionsChronicle === 'function', 'PhaseF5.openInstitutionsChronicle 应导出为函数');
  let threw = false;
  try { sb.PhaseF5.openInstitutionsChronicle(); } catch (e) { threw = true; console.error(e); }
  assert(!threw, '对象池形状的 dynamicInstitutions 不应令弹窗抛错');
  const html = lastModalHtml(sb);
  assert(html.includes('银流司'), '对象池形状下弹窗应列出机构名（非空表）');
  assert(html.includes('施行'), 'running 阶段应中文化为「施行」');
  assert(!/\brunning\b/.test(html), '不应向玩家输出英文阶段 running');
})();

// C2) debate→廷议 / trial→试行（生命周期 API 会写入这两态·此前漏映射）
//     机构名刻意用中性字·避免「廷议衙门」之类名字含阶段词造成 includes 假命中(阶段词只应来自 _stageCn)
(function debateTrialStages() {
  const sb = makeToolsSandbox([
    { name: '甲衙', rank: 4, stage: 'debate', createdTurn: 3, staffSize: 10, annualBudget: 10000 },
    { name: '乙衙', rank: 4, stage: 'trial', createdTurn: 5, staffSize: 12, annualBudget: 12000 }
  ]);
  sb.PhaseF5.openInstitutionsChronicle();
  const html = lastModalHtml(sb);
  assert(html.includes('状态 廷议'), 'debate 阶段应中文化为「廷议」');
  assert(html.includes('状态 试行'), 'trial 阶段应中文化为「试行」');
  assert(!/状态 debate/.test(html) && !/状态 trial/.test(html), '不应向玩家输出英文阶段 debate/trial');
})();

// C3) 数组形状 + abolished→已废
(function arrayShapeAbolished() {
  const sb = makeToolsSandbox([{ name: '废司', rank: 5, stage: 'abolished', createdTurn: 10, abolishedTurn: 30, staffSize: 20, annualBudget: 40000, effectiveness: 0.4, corruption: 60 }]);
  sb.PhaseF5.openInstitutionsChronicle();
  const html = lastModalHtml(sb);
  assert(html.includes('废司'), '数组形状下弹窗应列出机构名');
  assert(html.includes('已废'), 'abolished 阶段应中文化为「已废」');
})();

// C4) 空态不抛错并显示空态文案
(function emptyState() {
  const sb = makeToolsSandbox(null);
  let threw = false;
  try { sb.PhaseF5.openInstitutionsChronicle(); } catch (e) { threw = true; console.error(e); }
  assert(!threw, 'null 的 dynamicInstitutions 不应抛错');
  const html = lastModalHtml(sb);
  assert(html.includes('暂无动态设立机构'), '空态应显示「暂无动态设立机构」');
})();

// ── D) 药丸条(pill bar)阶段中文化：与弹窗同步补 debate→廷议 / trial→试行 ──
//     机构名用中性字·阶段词只应来自药丸条 stCn(不被机构名假命中)
(function pillBarStages() {
  const { ctx } = loadOfficeRuntime();
  ctx.GM = { turn: 5, dynamicInstitutions: [
    { name: '甲衙', rank: 4, stage: 'debate' },
    { name: '乙衙', rank: 4, stage: 'trial' }
  ] };
  assert(typeof ctx._offDynamicInstitutionsPanel === 'function', '_offDynamicInstitutionsPanel 应为函数');
  const html = ctx._offDynamicInstitutionsPanel();
  assert(html.includes('廷议'), '药丸条 debate 应中文化为「廷议」');
  assert(html.includes('试行'), '药丸条 trial 应中文化为「试行」');
  assert(!/>\s*debate\s*</.test(html) && !/>\s*trial\s*</.test(html), '药丸条不应输出英文 debate/trial');
})();

// ── E) 未知态兜底（stage 非闭集）：真实写入链 registerInstitution 写 stage:'review'·两处渲染须中文兜底不吐裸英文 ──
//     AIChangeApplier.registerInstitution 的 Object.assign(defaults, spec) 允许 spec.stage 覆盖·旧格式 AI 可写任意串
(function unknownStageFallbackViaRealWriteChain() {
  const app = loadApplier();
  app.GM = { turn: 7, dynamicInstitutions: [] };
  assert(app.AIChangeApplier && typeof app.AIChangeApplier.registerInstitution === 'function', 'AIChangeApplier.registerInstitution 应可调');
  const inst = app.AIChangeApplier.registerInstitution({ action: 'create', name: '甲司', stage: 'review' });
  assert(inst && inst.stage === 'review', '真实写入链应把旧格式 stage:review 落为 review（坐实非闭集泄漏）');
  const reviewInsts = app.GM.dynamicInstitutions;   // [ {name:'甲司', stage:'review', ...} ]

  // 弹窗：未知态渲染「未明（原值）」·带原值便于排查·但不得吐裸「状态 review」
  const sb = makeToolsSandbox(reviewInsts);
  sb.PhaseF5.openInstitutionsChronicle();
  const popHtml = lastModalHtml(sb);
  assert(popHtml.includes('未明（review）'), '弹窗未知态应中文兜底为「未明（review）」');
  assert(!/状态\s*review/.test(popHtml), '弹窗不得输出裸英文「状态 review」');

  // 药丸条：空间小·未知态只显「未明」·机构名中性(甲司)故整段不应出现 review
  const { ctx } = loadOfficeRuntime();
  ctx.GM = { turn: 7, dynamicInstitutions: reviewInsts };
  const pillHtml = ctx._offDynamicInstitutionsPanel();
  assert(pillHtml.includes('未明'), '药丸条未知态应中文兜底为「未明」');
  assert(!/review/i.test(pillHtml), '药丸条不得输出裸英文 review');
})();

console.log('[smoke-office-institutions-chronicle-entry] PASS 真渲染按钮各1个 + 弹窗&药丸条阶段中文化(debate/trial + 未知态未明兜底·真实写入链)');
