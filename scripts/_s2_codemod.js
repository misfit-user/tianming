'use strict';
// S2 codemod: 给 tm-building-works.js 增量接入人才引擎(3处)。fs 读写真实文件,绕过工具污染。
// 自动 .bak·改前锚点断言·改后结果断言·幂等。退出码: 0 成功 / 50+ 锚点缺 / 60+ 后检缺。
var fs = require('fs');
var path = require('path');
var F = path.join(__dirname, '..', 'tm-building-works.js');
var src = fs.readFileSync(F, 'utf8');
function die(code, msg) { console.log('CODEMOD_FAIL code=' + code + ' ' + msg); process.exit(code); }

if (src.indexOf('TalentBuildingBridge') >= 0) { console.log('CODEMOD_ALREADY_DONE'); process.exit(0); }

var bak = F + '.bak-pre-s2';
if (!fs.existsSync(bak)) fs.writeFileSync(bak, src, 'utf8');

// — 改1: sanitizeStructuredFx 透传 talentSource —
var a1 = 'if (raw.label) out.label = String(raw.label);';
if (src.indexOf(a1) < 0) die(51, 'anchor1 sanitize.label');
src = src.replace(a1, a1 + '\n    if (raw.talentSource && typeof raw.talentSource === \'object\') out.talentSource = raw.talentSource; // S2·人才源透传(费效封顶在 bridge)');

// — 改1b: sanitize return 条件加 talentSource —
var a2 = 'out.upkeepPerTurn != null || out.label) ? out : null;';
if (src.indexOf(a2) < 0) die(52, 'anchor2 sanitize.return');
src = src.replace(a2, 'out.upkeepPerTurn != null || out.label || out.talentSource) ? out : null;');

// — 改2: applyCompletion 末尾 hook(锚: _bpE catch 后 return true) —
var a3 = 'try { _buildingPolitics(div, bld, P, GM); } catch (_bpE) {}\n    }\n    return true;';
if (src.indexOf(a3) < 0) die(53, 'anchor3 applyCompletion');
src = src.replace(a3, 'try { _buildingPolitics(div, bld, P, GM); } catch (_bpE) {}\n    }\n    try { var _TBB = (typeof TM !== \'undefined\' && TM.TalentBuildingBridge) || (typeof window !== \'undefined\' && window.TM && window.TM.TalentBuildingBridge); if (_TBB && typeof _TBB.onComplete === \'function\') _TBB.onComplete(div, bld, _typeDef, P, GM); } catch (_tbE) {} // S2·人才源路由\n    return true;');

// — 改3: revertBuilding 末尾 hook(锚: delete appliedTurn 后 return true) —
var a4 = 'delete bld.appliedDelta;\n    delete bld.appliedTurn;\n    return true;';
if (src.indexOf(a4) < 0) die(54, 'anchor4 revertBuilding');
src = src.replace(a4, 'try { var _gm = (typeof window !== \'undefined\' && window.GM) || null; var _TBB = (typeof TM !== \'undefined\' && TM.TalentBuildingBridge) || (typeof window !== \'undefined\' && window.TM && window.TM.TalentBuildingBridge); if (_TBB && typeof _TBB.onRevert === \'function\' && _gm) _TBB.onRevert(div, bld, _gm); } catch (_tbE) {} // S2·人才源撤销\n    delete bld.appliedDelta;\n    delete bld.appliedTurn;\n    return true;');

// — 改后断言 —
var post = ['out.talentSource = raw.talentSource', '|| out.talentSource) ? out : null', '_TBB.onComplete(div, bld, _typeDef, P, GM)', '_TBB.onRevert(div, bld, _gm)'];
for (var i = 0; i < post.length; i++) { if (src.indexOf(post[i]) < 0) die(60 + i, 'postcheck missing: ' + post[i]); }

fs.writeFileSync(F, src, 'utf8');
console.log('CODEMOD_OK 4edits bak=' + path.basename(bak));
process.exit(0);
