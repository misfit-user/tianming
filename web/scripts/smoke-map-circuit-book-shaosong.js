#!/usr/bin/env node
// smoke-map-circuit-book-shaosong.js — 谱牒版图卷在绍宋真实开局上的守恒检查
//
// 从 smoke-map-circuit-book.js 拆出：一个文件只开一局，免得全量测试里两局开局叠加超过 120 秒。
// 验跨朝代分组：大宋的正式省道组数、州签集合与数据层重算一致，没有漏签、重签或混入他方地块。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { bantuSnapshot, bantuMarkup, assertBantuConservation } = require('./lib-map-circuit-bantu.js');

const WEB = path.resolve(__dirname, '..');
const helperFile = path.join(__dirname, 'smoke-start-game-data-integrity.js');
const helperText = fs.readFileSync(helperFile, 'utf8').replace(/^#![^\n]*\n/, '');
const helperEnd = helperText.indexOf('(async function main()');
if (helperEnd < 0) throw new Error('helper boundary missing');
const helpers = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
  helperText.slice(0, helperEnd) + '\nreturn { loadGame };')(require, process, __dirname, helperFile, { exports: {} }, {});

const SID = 'sc-jianyan1-1127-shaosong';
const song = helpers.loadGame(SID);
vm.runInContext(`P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(${JSON.stringify(SID)})`, song, { timeout: 180000 });

setTimeout(() => {
  try {
    // 浏览器里省道分组来自按需加载的地名模块；VM 不跑按需加载，这里直接装入它的布局脚本
    vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-map-realm-layout.js'), 'utf8'), song, { filename: 'tm-map-realm-layout.js' });
    const snapshot = bantuSnapshot((code) => vm.runInContext(code, song, { timeout: 60000 }), '大宋');
    assertBantuConservation(snapshot, bantuMarkup(snapshot));
    console.log('[smoke-map-circuit-book-shaosong] 1 组检查全部通过');
    console.log('  ok · 绍宋大宋版图：正式省道组数与州签集合守恒');
    process.exit(0);
  } catch (error) {
    console.error('[smoke-map-circuit-book-shaosong] FAIL', error && error.stack || error);
    process.exit(1);
  }
}, 300);
