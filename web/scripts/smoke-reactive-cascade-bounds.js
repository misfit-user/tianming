#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;
function assert(condition, label) {
  if (!condition) throw new Error('FAIL·' + label);
  assertions++;
  console.log('  ok·' + label);
}
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitFor(predicate, timeoutMs) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for reactive cascade');
    await wait(5);
  }
}

async function main() {
  const captures = [];
  const errors = [];
  const ctx = {
    console: {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error() { errors.push(Array.from(arguments)); }
    },
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    Promise,
    Set,
    WeakMap,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    GM: { turn: 1, vars: {}, chars: [], facs: [], _listeners: {}, _changeQueue: [] },
    P: {},
    TM: { errors: { capture(error, operation, context) { captures.push({ error, operation, context }); } } },
    _dbg() {},
    deepClone(value) { return JSON.parse(JSON.stringify(value)); },
    ensureWritableRuntimeMap() { return null; }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-change-queue.js'), 'utf8'), ctx, { filename: 'tm-change-queue.js' });

  const finiteEntity = { id: 'finite' };
  const finiteOrder = [];
  ctx.registerListener('finite', 'a', () => {
    finiteOrder.push('a');
    ctx.triggerPropertyChange('finite', finiteEntity, 'b', 0, 1);
  });
  ctx.registerListener('finite', 'b', () => {
    finiteOrder.push('b');
    ctx.triggerPropertyChange('finite', finiteEntity, 'c', 0, 1);
  });
  ctx.registerListener('finite', 'c', () => { finiteOrder.push('c'); });
  ctx.triggerPropertyChange('finite', finiteEntity, 'a', 0, 1);
  await waitFor(() => finiteOrder.length === 3, 500);
  assert(finiteOrder.join('>') === 'a>b>c', '有限 A→B→C 级联按序完成');
  assert(ctx.GM._changeQueue.length === 0 && !ctx.GM._reactiveCascade, '正常级联结束后 epoch 状态清空');

  const loopEntity = { id: 'loop' };
  let loopCalls = 0;
  let macrotaskRan = false;
  ctx.registerListener('loop', 'a', () => {
    loopCalls++;
    ctx.triggerPropertyChange('loop', loopEntity, 'b', loopCalls, loopCalls + 1);
  });
  ctx.registerListener('loop', 'b', () => {
    loopCalls++;
    ctx.triggerPropertyChange('loop', loopEntity, 'a', loopCalls, loopCalls + 1);
  });
  setTimeout(() => { macrotaskRan = true; }, 0);
  ctx.triggerPropertyChange('loop', loopEntity, 'a', 0, 1);
  await waitFor(() => captures.length > 0, 1500);

  assert(loopCalls <= 64, 'A↔B 循环在批次上限内终止（calls=' + loopCalls + '）');
  assert(macrotaskRan, '持续级联每四批向宏任务/绘制让出控制权');
  assert(ctx.GM._changeQueue.length === 0 && !ctx.GM._changeQueueScheduled && !ctx.GM._reactiveCascade, '超限后活跃队列和 epoch 全部释放');
  assert(captures.length === 1 && captures[0].error.code === 'reactive-cascade-limit', '超限只产生一次结构化错误捕获');
  assert(captures[0].operation === 'reactive-property-cascade' &&
    captures[0].context.propertyChain.some((key) => key === 'loop.a' || key === 'loop.b'), '诊断包含 entityType/propertyName 触发链');
  const diagnostics = ctx.getReactiveQueueDiagnostics(ctx.GM);
  assert(diagnostics.length > 0 && diagnostics.length <= 128, '剩余事件进入有界诊断队列');
  assert(diagnostics.some((row) => row.entityType === 'loop' && /^(?:a|b)$/.test(row.propertyName)), 'dead diagnostics 保留实体类型与属性名');
  assert(errors.some((args) => String(args[0]).includes('cascade aborted')), '控制台记录终止原因而非静默活锁');

  const throwingEntity = {};
  Object.defineProperty(throwingEntity, 'id', {
    configurable: true,
    get() { throw new Error('injected reactive identity getter failure'); }
  });
  let throwingListenerCalls = 0;
  ctx.registerListener('throwing', 'value', () => { throwingListenerCalls++; });
  ctx.triggerPropertyChange('throwing', throwingEntity, 'value', 0, 1);
  await waitFor(() => ctx.getReactiveQueueDiagnostics(ctx.GM).some((row) => row.reason === 'internal-exception'), 500);
  assert(throwingListenerCalls === 0, '内部 identity 异常发生在监听器执行前');
  assert(!ctx.GM._reactiveQueueProcessing && ctx.GM._changeQueue.length === 0, '内部异常通过 finally 释放 processing 标志并清空队列');
  assert(errors.some((args) => String(args[0]).includes('internal processing failed')), '内部异常留下可诊断日志');

  const independent = { id: 'independent' };
  let independentCalls = 0;
  ctx.registerListener('independent', 'done', () => { independentCalls++; });
  ctx.triggerPropertyChange('independent', independent, 'done', false, true);
  await waitFor(() => independentCalls === 1, 500);
  assert(independentCalls === 1 && ctx.GM._changeQueue.length === 0, '终止后下一个独立 cascade 正常运行');

  const source = fs.readFileSync(path.join(ROOT, 'tm-change-queue.js'), 'utf8');
  assert(/REACTIVE_CASCADE_MAX_EVENTS\s*=\s*10000/.test(source) &&
    /REACTIVE_CASCADE_MAX_BATCHES\s*=\s*64/.test(source) &&
    /REACTIVE_YIELD_EVERY_BATCHES\s*=\s*4/.test(source), '生产队列固定事件/批次/让步上限');
  assert(!/ChangeQueue\.applyAll\s*\([^)]*processChangeQueue|processChangeQueue\s*\([^)]*ChangeQueue/.test(source), '两类 Change Queue 仍无互相消费路径');

  console.log('PASS assertions=' + assertions);
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
