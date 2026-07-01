#!/usr/bin/env node
'use strict';
/* smoke-bgm-import — 设置·声乐「导入音乐」功能源契约:
 * AudioSystem 加 importUserMusic/loadUserTracks/removeUserTrack/_openUserBgmDB/_pickMusicFiles;
 * 音乐文件大→存 IndexedDB(tmUserBgm/tracks blob)跨会话持久·每次加载 object URL 接入 playlist;
 * init 恢复·面板加「导入音乐」按钮 + 导入轨可删(✕)。DOM/IndexedDB 行为已真浏览器端到端验证(导入/持久/复原/删除)·此 smoke 守接线防腐。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', 'tm-audio-theme.js'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-bgm-import');

// 方法存在
['importUserMusic', 'loadUserTracks', 'removeUserTrack', '_openUserBgmDB', '_pickMusicFiles'].forEach(function (fn) {
  ok(new RegExp('\\b' + fn + ':\\s*function').test(src), '方法存在: ' + fn);
});
// IndexedDB blob 存储(不进 localStorage)
ok(/indexedDB\.open\('tmUserBgm'/.test(src), 'IndexedDB 库 tmUserBgm');
ok(/createObjectStore\('tracks', \{ keyPath: 'id' \}\)/.test(src), 'objectStore tracks(keyPath id)');
// 导入:过滤音频 + 即时 object URL + 持久 blob
ok(/\/\^audio\\\//.test(src) && /mp3\|ogg\|wav/.test(src), 'importUserMusic 过滤 audio/* 或扩展名');
ok(/URL\.createObjectURL\(m\.file\)/.test(src) && /store\.put\(\{ id: m\.id[^}]*blob: m\.file/.test(src), '导入:object URL 即时接入 + IndexedDB 存 blob');
ok(/replace\(\/\[<>"&\]\/g/.test(src), '导入标题 sanitize(剥 <>"& )防注入+显示失真·Codex P2');
// ── Codex 复核修复(gpt-5.5/xhigh) ──
ok(/_userBgmDBPromise === p\) self\._userBgmDBPromise = null/.test(src), 'Codex P1: _openUserBgmDB 失败不永久缓存(rejected→清空·下次重开)');
ok(/Math\.random\(\)\.toString\(36\)\.slice\(2, 8\)/.test(src), 'Codex P1: 导入 id 加随机段(防同毫秒/跨tab 碰撞致 put 覆盖)');
ok(/rq\.onerror = function\(\)[\s\S]*?删除导入曲失败/.test(src) && /tx\.onerror[\s\S]*?事务失败/.test(src), 'Codex P1: 删除事务带 onerror(不静默→不复活已删轨)');
ok(/!trackId && this\.currentTrackId && this\.currentTrackId\.indexOf\('user_'\) === 0/.test(src), 'Codex P1: playTrack 守 pending 导入轨(不兜底覆盖 currentTrackId·跨会话保选择)');
ok(/重入 init 前撤旧导入轨 object URL/.test(src), 'Codex P2: init 重入前撤旧导入轨 URL(防泄漏堆积)');
// 恢复:init 调 loadUserTracks·从 getAll 重建 object URL
ok(/this\.loadUserTracks\(/.test(src) && /this\.loadPlaylist\(\);/.test(src), 'init 在 loadPlaylist 后调 loadUserTracks');
ok(/getAll\(\)/.test(src) && /URL\.createObjectURL\(rec\.blob\)/.test(src), 'loadUserTracks 从 IndexedDB getAll 重建 object URL');
// 删除:撤 URL + 删 IndexedDB + 出 playlist
ok(/URL\.revokeObjectURL\(t\.src\)/.test(src) && /objectStore\('tracks'\)\.delete\(id\)/.test(src), 'removeUserTrack 撤 URL + 删 IndexedDB');
ok(/return x\.id !== id/.test(src), 'removeUserTrack 出 playlist');
// 面板 UI:导入按钮 + 导入轨 ✕
ok(/_pickMusicFiles\(\);">导 入 音 乐<\/button>/.test(src), '面板「导入音乐」按钮接 _pickMusicFiles');
ok(/track\.user \? '<button class="gs-audio-del"/.test(src) && /removeUserTrack\(/.test(src), '导入轨渲染 ✕ 删除钮(仅 user 轨)');

console.log('\nsmoke-bgm-import ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
