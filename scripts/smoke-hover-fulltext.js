#!/usr/bin/env node
'use strict';
/* smoke-hover-fulltext — 全局悬停显示完整文本模块的静态契约
 * 布局相关行为(scrollWidth 溢出判定/弹层)靠真浏览器 playwright 验；此处守代码契约不回退。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.resolve(ROOT, 'tm-hover-fulltext.js'), 'utf8');
const html = fs.readFileSync(path.resolve(ROOT, 'index.html'), 'utf8');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-hover-fulltext');

// ── 安装门控 ──
ok(/__tmFulltipInstalled/.test(js), '幂等安装守卫(__tmFulltipInstalled)');
ok(/any-hover: hover/.test(js) && /any-pointer: fine/.test(js), '门控:仅纯触屏(无 any-hover 且无 any-pointer:fine)跳过·桌面/无头均装');

// ── 截断判定(核心) ──
ok(/textOverflow/.test(js) && /scrollWidth > el\.clientWidth/.test(js), '单行省略号:text-overflow ellipsis + scrollWidth>clientWidth 溢出判定');
ok(/-webkit-line-clamp/.test(js) && /scrollHeight > el\.clientHeight/.test(js), '多行 clamp:line-clamp + scrollHeight>clientHeight 溢出判定');
ok(/hasAttribute\('data-fulltip'\)/.test(js), '显式接口 data-fulltip(独占属性名·不复用 FAB 的 data-tip)');
ok(/getAttribute\('title'\)[^\n]*\)\s*return null|title'\) \|\| ''\)\.trim\(\)\) return null/.test(js), '有原生 title 的元素跳过(避免双重弹窗)');
ok(/tagName/.test(js) && /INPUT|TEXTAREA/.test(js) && /isContentEditable/.test(js), '输入/可编辑元素不处理');

// ── 委托 + 不干扰 ──
ok(/addEventListener\('mouseover'[\s\S]*?true\)/.test(js), 'mouseover 委托挂 document(capture)·覆盖重渲染元素');
ok(/addEventListener\('mouseout'/.test(js), 'mouseout 收起(离开元素)');
ok(/pointer-events:none/.test(js), '浮层 pointer-events:none(不吃鼠标/不闪/不挡点击)');
ok(/textContent = info\.full/.test(js), '内容走 textContent(纯文本·防注入)');
ok(/findTrunc/.test(js) && /MAX_DEPTH/.test(js), 'mouseover 命中子节点时向上找截断祖先(有限层数)');
ok(/'scroll', hide|addEventListener\('scroll'/.test(js) && /'wheel'/.test(js) && /'mousedown'/.test(js), '滚动/滚轮/按下时立即收起(位置失效)');
ok(/isConnected/.test(js), '展示前校验元素仍在 DOM(重渲染后不弹幽灵)');

// ── 不碰 owner 脏文件 styles.css:样式由模块运行时注入 ──
ok(/id = 'tm-fulltip-css'/.test(js) && /createElement\('style'\)/.test(js), 'tooltip 样式由模块注入 <style>(不改 styles.css)');

// ── index.html 接线 ──
ok(/<script src="tm-hover-fulltext\.js/.test(html), 'index.html 已挂载 tm-hover-fulltext.js');

console.log('\nsmoke-hover-fulltext ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
