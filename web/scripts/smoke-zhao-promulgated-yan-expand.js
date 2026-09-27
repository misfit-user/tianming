#!/usr/bin/env node
/* eslint-env node */
/*
 * smoke-zhao-promulgated-yan-expand.js
 * 2026-06-11·两修(phase8-formal-drafts.js):
 *   ① 诏书整体颁行后凭空消失:拟诏 tab 顶部加「本回合已颁行诏书」整块(读 GM.edicts status=promulgated 本回合)+
 *      颁行后 setTimeout(openZhaoPreviewPanel) 重渲让卡出现 + 「撤回改拟」回退到政令草拟。
 *   ② 鸿雁右侧来函「展阅」看不到全文:展阅原走 letter-target-desk(只设收件人)→ 改 letter-expand-desk 就地展开
 *      右卡(.inc-body/.inc-title 去预览夹)。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// 第二十六拆：鸿雁(yan)面板迁出 phase8-formal-drafts-message-panels.js·并入源以便展阅/letter-read 断言可达
const src = fs.readFileSync(path.join(ROOT, 'phase8-formal-drafts.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'phase8-formal-drafts-message-panels.js'), 'utf8');

let passed = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); passed += 1; }
function slice(a, b) { const i = src.indexOf(a); const j = b ? src.indexOf(b, i + a.length) : -1; return src.slice(i >= 0 ? i : 0, j >= 0 ? j : (i >= 0 ? i + 4000 : 0)); }

// ── ② 鸿雁:展阅弹大居中阅览浮层(替代旧的右栏就地展开·窄列挤成一小块) ─────────
const inbox = slice('function renderFormalInboxItem(item)', 'function renderFormalLetterCard');
assert(inbox.indexOf("'letter-read-desk'") >= 0, '展阅按钮须走 letter-read-desk(弹阅览浮层)');
assert(inbox.indexOf("'letter-target-desk'") < 0, '展阅不应走 letter-target-desk(那只设收件人)');
assert(inbox.indexOf("'letter-expand-desk'") < 0, '不应再有旧的就地展开 letter-expand-desk');
assert(inbox.indexOf("actionBtn('展阅', 'letter-read-desk'") >= 0, '展阅按钮文案+动作正确');
// 阅览浮层函数
// 前缀匹配·签名已演进为 (letter, navList, navIdx)·验特征不验精确形参表
assert(inbox.indexOf('function openLetterReadOverlay(letter') >= 0, '须有 openLetterReadOverlay 浮层函数');
assert(/openDeskOverlay\('tm-letter-read-overlay'/.test(inbox), '须经 openDeskOverlay 弹出(自带 scrim+点外关闭)');
assert(/fullHongyanText\(content/.test(inbox), '浮层须 fullHongyanText 显示正文全文(pre-wrap·不截断)');
assert(inbox.indexOf('data-close-bridge="1"') >= 0, '浮层须有关闭按钮(data-close-bridge)');

// handler
const handler = slice("action === 'letter-read-desk'", "action === 'letter-multi-toggle-desk'");
assert(/openLetterReadOverlay\(lrLetter\)/.test(handler), 'letter-read-desk 须找到信件后弹阅览浮层');
assert(/formalIncomingLetters\(getLetters\(\)\)/.test(handler), '须从来函列表按 id 找信(兜底再查全部信件)');

// 阅览卡 CSS:大尺寸舒适·非一小块(治「太小了」)
assert(/\.tm-letter-read-card\{[^}]*width:min\(680px/.test(src), '阅览卡须宽 680px(不再窄列挤成一小块)');
// 美术宪法第2刀起御案字号写成 calc(N * var(--tm-px, 1px))（跟着界面字号开关缩放，默认档仍是 16px）
assert(/\.tm-letter-read-card \.lr-body\{[^}]*font-size:(?:16px|calc\(16 \* var\(--tm-px, 1px\)\))/.test(src), '正文须 16px 舒适字号');
assert(/\.tm-letter-read-card \.lr-body\{[^}]*line-height:2\.05/.test(src), '正文须行高 2.05 舒适');
assert(/\.tm-letter-read-card \.lr-body\{[^}]*overflow-y:auto/.test(src), '正文长则卡内滚动(max-height:86vh)');
// 右侧来函预览仍夹 2 行(列表紧凑·只展阅时弹大浮层)
assert(/\.inc-body\{[^}]*-webkit-line-clamp:2/.test(src), '右侧来函列表仍 2 行预览');

// ── ① 诏书:已颁行整块 + 重渲 + 撤回 ──────────────────────────────────────────
const edictPanel = slice('function renderFormalEdictPanel()', 'function renderFormalLetterCard');
assert(/_promThisTurn/.test(edictPanel), '拟诏面板须算本回合已颁行诏书');
assert(/status === 'promulgated' && Number\(e\.turn[^)]*\) === Number\(gm\.turn/.test(edictPanel), '须筛 GM.edicts status=promulgated 且本回合');
assert(edictPanel.indexOf('edict-prom-card') >= 0, '须渲「本回合已颁行诏书」卡');
assert(edictPanel.indexOf('本回合已颁行诏书') >= 0, '卡须有标题文案');
assert(edictPanel.indexOf("'edict-prom-revoke-desk'") >= 0, '须有撤回改拟按钮');
assert(/fullHongyanText\(e\.text/.test(edictPanel), '须用 fullHongyanText 整块显示诏书全文(不截断)');

// 颁行后重渲
const applyFn = slice('function applyFormalPolishedEdict(text, mode)', 'function formalEdictDraftValue');
assert(/setTimeout\(openZhaoPreviewPanel, 0\)/.test(applyFn), '颁行清空草拟后须重渲拟诏面板(否则诏书消失)');
assert(/edict-pol[\s\S]*edict-oth[\s\S]*forEach/.test(applyFn), '整体颁行仍清五类草拟(保持去重·不塞政令)');

// 撤回 handler
const revoke = slice("action === 'edict-prom-revoke-desk'", "action === 'letter-target-desk'");
assert(/_rec\.status = 'draft'/.test(revoke), '撤回须把该诏书 status 改回 draft(不再本回合整体推演)');
assert(/syncFormalEdictDraft\('edict-pol', _rec\.text/.test(revoke), '撤回须把全文放回政令草拟供改拟');
assert(/openZhaoPreviewPanel\(\)/.test(revoke), '撤回后须重渲');

// CSS 卡
assert(/\.edict-prom-card\{/.test(src), '.edict-prom-card CSS 须存在');
assert(/\.epc-body\{[^}]*white-space:pre-wrap/.test(src), '.epc-body 须 pre-wrap 显示诏书全文');

console.log('[smoke-zhao-promulgated-yan-expand] PASS ' + passed + ' assertions');
