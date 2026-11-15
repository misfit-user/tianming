// 按改动挑冒烟：改了哪些文件 → 该跑哪些 smoke。
//
// 依据是每支 smoke「提到」了哪些文件：它自己的源码，加上它 require 进来的本目录辅助模块（夹具、lib-*）的源码。
// 提到 = 出现了文件名（tm-foo.js），或不带扩展名的名字（'tm-foo'，不少夹具这样装载脚本）。
// 另有一类「广谱」smoke 照 index.html 的脚本清单整批装载，文件名一个也不写——只要改了清单里的脚本就都算上。
//
// 这是省时间的挑选，不是豁免：没被挑中的 smoke 仍由 CI 的全量冒烟兜底。
'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const WEB_ROOT = path.resolve(SCRIPTS_DIR, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');

// 整批装载 index.html 脚本清单的写法
const BROAD_PATTERNS = [/parseIndexScripts\s*\(/, /<script\b[^'"`\n]*\bsrc\b/i];
// 太短、太常见的名字不拿去比对（index.js、main.js 这类到处都是）
const COMMON_BASENAMES = new Set(['index.js', 'main.js', 'package.json', 'manifest.json', 'config.js', 'utils.js', 'README.md']);

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
}

// 本文件 require 进来的本地模块（只认相对路径的字面量）
function localRequires(file, text) {
  const found = [];
  const pattern = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const base = path.resolve(path.dirname(file), match[1]);
    const hit = [base, base + '.js', base + '.cjs', path.join(base, 'index.js')].find((candidate) => {
      try { return fs.statSync(candidate).isFile(); } catch (_) { return false; }
    });
    if (hit) found.push(hit);
  }
  return found;
}

// 一支 smoke 连同它用到的辅助模块的全部源码。只跟进测试用的辅助代码（web/scripts、仓根 scripts 与 tools），
// 不跟进被测的运行时代码——那些靠文件名比对。
function closureText(entry, cache) {
  const seen = new Set();
  const parts = [];
  const queue = [entry];
  while (queue.length && seen.size < 60) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!cache.has(file)) cache.set(file, readText(file));
    const text = cache.get(file);
    if (text === null) continue;
    parts.push(text);
    for (const next of localRequires(file, text)) {
      const rel = path.relative(REPO_ROOT, next).replace(/\\/g, '/');
      const helper = rel.startsWith('web/scripts/') || rel.startsWith('scripts/') || rel.startsWith('tools/') || rel.startsWith('web/tools/');
      if (helper && !seen.has(next)) queue.push(next);
    }
  }
  return { text: parts.join('\n'), files: Array.from(seen) };
}

// 建索引：每支 smoke 的源码闭包、是否广谱
function buildIndex(scriptsDir) {
  const dir = scriptsDir || SCRIPTS_DIR;
  const cache = new Map();
  const smokes = fs.readdirSync(dir).filter((name) => /^smoke-.*\.js$/.test(name)).sort().map((name) => {
    const closure = closureText(path.join(dir, name), cache);
    return {
      name,
      text: closure.text,
      helpers: new Set(closure.files.map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, '/'))),
      broad: BROAD_PATTERNS.some((pattern) => pattern.test(closure.text))
    };
  });
  return { smokes };
}

// index.html 里装载的脚本（相对 web/ 的路径，去掉查询串）
function indexScripts(webRoot) {
  const html = readText(path.join(webRoot || WEB_ROOT, 'index.html')) || '';
  const set = new Set();
  const pattern = /<script\b[^>]*\bsrc\s*=\s*['"]([^'"?]+)/gi;
  let match;
  while ((match = pattern.exec(html))) set.add(match[1]);
  return set;
}

// text 里是否出现 needle，且两侧不是别的名字的一部分：
//   tm-ai.js 不该命中 tm-endturn-ai.js（左侧是名字字符），也不该命中 tm-ai.json（右侧是字母）；
//   不带扩展名的 tm-ai（wholeName）还不该命中 tm-ai-change-applier（右侧是连字符）。
function mentions(text, needle, wholeName) {
  const rightStop = wholeName ? /[A-Za-z0-9_\-]/ : /[A-Za-z0-9_]/;
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) return false;
    const before = text[at - 1];
    const after = text[at + needle.length];
    const leftOk = before === undefined || !/[A-Za-z0-9_\-]/.test(before);
    const rightOk = after === undefined || !rightStop.test(after);
    if (leftOk && rightOk) return true;
    from = at + 1;
  }
}

// 一个改动文件拿去比对的名字
function needlesFor(rel) {
  const base = rel.split('/').pop();
  const needles = [];
  if (!COMMON_BASENAMES.has(base)) needles.push({ text: base, wholeName: false });
  else needles.push({ text: rel.split('/').slice(-2).join('/'), wholeName: false });
  const stem = base.replace(/\.(js|cjs|mjs)$/, '');
  if (stem !== base && stem.length >= 8 && /-/.test(stem)) needles.push({ text: stem, wholeName: true });
  // 官方剧本多半按后缀整批读，不写具体哪一部
  if (/^scenarios\/.*（官方）\.json$/.test(rel)) needles.push({ text: '（官方）.json', wholeName: false });
  return needles;
}

// 挑选。changed：仓内相对路径（/ 分隔）。返回：
//   selected   Map(smoke 名 → 命中它的原因)
//   unmatched  改了、却没有任何 smoke 直接提到的文件
function select(index, changed, options) {
  const scripts = (options && options.indexScripts) || indexScripts();
  const selected = new Map();
  const unmatched = [];
  const add = (name, reason) => {
    if (!selected.has(name)) selected.set(name, []);
    if (selected.get(name).length < 3) selected.get(name).push(reason);
  };
  let runtimeChanged = null;
  for (const rel of changed) {
    const base = rel.split('/').pop();
    if (/^web\/scripts\/smoke-.*\.js$/.test(rel)) { add(base, '它自己改了'); continue; }
    const needles = needlesFor(rel);
    let hits = 0;
    for (const smoke of index.smokes) {
      if (smoke.helpers.has(rel) || needles.some((needle) => mentions(smoke.text, needle.text, needle.wholeName))) {
        add(smoke.name, '提到 ' + base);
        hits++;
      }
    }
    const webRel = rel.startsWith('web/') ? rel.slice(4) : null;
    if (webRel && (scripts.has(webRel) || webRel === 'index.html')) runtimeChanged = runtimeChanged || base;
    // 代码文件改了却没有一支 smoke 提到它：值得让人知道（文档、数据不报）
    if (!hits && /\.(js|cjs|mjs|html|css)$/.test(rel) && !/^(docs|web\/docs)\//.test(rel)) unmatched.push(rel);
  }
  if (runtimeChanged) {
    for (const smoke of index.smokes) if (smoke.broad) add(smoke.name, '广谱：照 index.html 整批装载（改了 ' + runtimeChanged + ' 等）');
  }
  return { selected, unmatched };
}

// 相对「与基准引用的分叉点」改过的文件：已提交的、没提交的、未跟踪的都算。找不到分叉点返回 null。
function changedFiles(baseRef) {
  const { spawnSync } = require('child_process');
  const run = (args) => {
    const result = spawnSync('git', args, { cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024 });
    return !result.error && result.status === 0 ? result.stdout.toString('utf8') : null;
  };
  const base = (run(['merge-base', 'HEAD', baseRef || 'origin/main']) || '').trim();
  if (!base) return null;
  const diff = run(['diff', '-z', '--name-only', '--no-renames', base]);
  if (diff === null) return null;
  const untracked = run(['ls-files', '-z', '--others', '--exclude-standard']) || '';
  const files = new Set((diff + untracked).split('\0').filter(Boolean));
  return { base, files: Array.from(files).sort() };
}

module.exports = { buildIndex, select, mentions, needlesFor, indexScripts, closureText, changedFiles };
