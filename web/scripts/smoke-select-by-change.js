#!/usr/bin/env node
// 按改动挑冒烟（lib-smoke-select.js，run-smokes.js --changed）：名字比对的边界、挑选规则，以及真实索引上的几条常识。
'use strict';

const assert = require('assert');
const fs = require('fs');

const picker = require('./lib-smoke-select.js');

let checks = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  checks++;
}

// ---------- 名字比对的边界 ----------
ok(picker.mentions("load('tm-foo-bar.js')", 'tm-foo-bar.js', false), '引号里的文件名算提到');
ok(picker.mentions("path.join(WEB, 'sub/tm-foo-bar.js')", 'tm-foo-bar.js', false), '带目录的文件名算提到');
ok(!picker.mentions("load('phase8-tm-foo-bar.js')", 'tm-foo-bar.js', false), '只是别的文件名的后半截，不算');
ok(!picker.mentions("load('tm-foo-bar.json')", 'tm-foo-bar.js', false), '扩展名更长的另一个文件，不算');
ok(picker.mentions("boot(['tm-foo-bar'])", 'tm-foo-bar', true), '不带扩展名的名字算提到');
ok(!picker.mentions("boot(['tm-foo-bar-baz'])", 'tm-foo-bar', true), '不带扩展名时，更长的名字不算');
ok(!picker.mentions("boot(['xtm-foo-bar'])", 'tm-foo-bar', true), '左侧连着别的名字字符，不算');
ok(picker.mentions('读 scenarios 下的 天启（官方）.json', '（官方）.json', false), '中文文件名后缀照常比对');

// ---------- 一个改动文件拿去比对的名字 ----------
const texts = (rel) => picker.needlesFor(rel).map((needle) => needle.text + (needle.wholeName ? '*' : ''));
ok(JSON.stringify(texts('web/tm-foo-bar.js')) === '["tm-foo-bar.js","tm-foo-bar*"]', '脚本：文件名，加不带扩展名的名字');
ok(JSON.stringify(texts('web/ui/adapter/config.js')) === '["adapter/config.js"]', '到处都有的文件名（config.js）带上上级目录再比');
ok(JSON.stringify(texts('web/a.js')) === '["a.js"]', '太短的名字不拿不带扩展名的形式去比');
ok(texts('scenarios/天启七年·九月（官方）.json').includes('（官方）.json'), '官方剧本另按「（官方）.json」后缀比——多数测试整批读，不写哪一部');

// ---------- 挑选规则 ----------
const smoke = (name, text, helpers, broad) => ({ name, text, helpers: new Set(helpers || []), broad: !!broad });
const index = {
  smokes: [
    smoke('smoke-a.js', "read('tm-foo-bar.js')"),
    smoke('smoke-b.js', "boot(['tm-foo-bar'])"),
    smoke('smoke-c.js', "read('tm-foo-bar-baz.js')"),
    smoke('smoke-d.js', 'const fixture = load();', ['web/scripts/lib-x.js']),
    smoke('smoke-e.js', 'boot everything', [], true)
  ]
};
const names = (result) => Array.from(result.selected.keys()).sort().join(' ');

const runtime = picker.select(index, ['web/tm-foo-bar.js'], { indexScripts: new Set(['tm-foo-bar.js']) });
ok(names(runtime) === 'smoke-a.js smoke-b.js smoke-e.js', '改了脚本：提到它的两支，加整批装载的广谱那支；名字更长的另一个文件不沾边');
ok(runtime.selected.get('smoke-a.js')[0] === '提到 tm-foo-bar.js' && /^广谱/.test(runtime.selected.get('smoke-e.js')[0]), '每支都带着被挑中的原因');
ok(runtime.unmatched.length === 0, '有 smoke 提到的文件不进「没人提到」名单');

const helper = picker.select(index, ['web/scripts/lib-x.js'], { indexScripts: new Set() });
ok(names(helper) === 'smoke-d.js', '改了测试用的辅助模块：挑中 require 了它的 smoke');

const self = picker.select(index, ['web/scripts/smoke-c.js'], { indexScripts: new Set() });
ok(names(self) === 'smoke-c.js' && self.selected.get('smoke-c.js')[0] === '它自己改了', '改了 smoke 自己：跑它');

const orphan = picker.select(index, ['web/tm-orphan-file.js'], { indexScripts: new Set() });
ok(orphan.selected.size === 0 && JSON.stringify(orphan.unmatched) === '["web/tm-orphan-file.js"]', '没人提到的代码文件单独列出来；不在 index.html 里的脚本不牵动广谱 smoke');

const docs = picker.select(index, ['docs/notes/x.md', 'web/docs/y.md'], { indexScripts: new Set() });
ok(docs.selected.size === 0 && docs.unmatched.length === 0, '只改文档：什么都不挑，也不报');

const many = picker.select(index, ['web/tm-foo-bar.js', 'web/tm-foo-bar-baz.js', 'web/scripts/lib-x.js'], { indexScripts: new Set() });
ok(names(many) === 'smoke-a.js smoke-b.js smoke-c.js smoke-d.js', '多个改动取并集');

// ---------- 真实索引上的常识 ----------
const real = picker.buildIndex();
const total = fs.readdirSync(__dirname).filter((name) => /^smoke-.*\.js$/.test(name)).length;
ok(real.smokes.length === total && total > 1000, '索引覆盖本目录全部 smoke');
const broad = real.smokes.filter((entry) => entry.broad).length;
ok(broad > 0 && broad < total * 0.1, '广谱 smoke 只是少数（现 ' + broad + ' 支）——多了，按改动挑就失去意义');

const border = picker.select(real, ['web/tm-border-invasion.js']);
ok(border.selected.has('smoke-border-invasion.js'), '改边患脚本，挑中边患那支 smoke');
ok(border.selected.size < total / 4, '改一个叶子文件，挑中的远少于全量（现 ' + border.selected.size + ' 支）');

const fixture = picker.select(real, ['web/scripts/lib-npc-action-fixture.js']);
ok(fixture.selected.size > 0 && fixture.selected.size < total / 4, '改一份夹具，挑中用到它的那些 smoke（现 ' + fixture.selected.size + ' 支）');

// ---------- 接线 ----------

console.log('[smoke-select-by-change] PASS ' + checks + ' checks');
