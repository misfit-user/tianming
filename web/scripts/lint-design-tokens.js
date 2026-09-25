#!/usr/bin/env node
// scripts/lint-design-tokens.js — 美术宪法第0刀：写死颜色与写死字号的棘轮（2026-09-25）
//
// 美术宪法（docs/art-constitution.md）规定：颜色和字号只从 styles.css 的令牌表里取。
// 存量一口吃不掉，所以和其他架构守卫一样做成棘轮：基线按文件记下现有的写死颜色、写死字号，
// 只许降、不许升；新文件从 0 起算。
//
// 计什么：
//   颜色  #rgb / #rgba / #rrggbb / #rrggbbaa，以及 rgb()/rgba()/hsl()/hsla() 里直接写数字的
//   字号  font-size: 12px（px/rem/em/pt）、fontSize = '12px'、fontSize: '12px'
// 不计：
//   令牌定义本身（--名字: 值，令牌表里必然是字面值）、var(--x) 与 calc(var(--x) …)、
//   注释（样式表的 /* */；脚本的注释行与行尾 // 注释）、带 design-ok 标记的行（确经裁定的例外，如图标插画设色）
//
// 文件集：index.html 挂载的运行时 JS（与其他守卫同源）+ index.html 链接的样式表
//        + 运行时 JS 里按文件名动态加载的样式表
//
// 用法（在 web/ 下）：
//   node scripts/lint-design-tokens.js                # 对比基线
//   node scripts/lint-design-tokens.js --update       # 重写基线（确认数字下降后使用）
//   node scripts/lint-design-tokens.js --top 15       # 列欠账最多的前 N 个文件
//   node scripts/lint-design-tokens.js --list <文件>  # 逐行列出某个文件里被计入的写法
//
// 基线：scripts/arch-baselines/design-tokens.json

'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib-arch-guard');

const BASELINE_FILE = path.join(lib.BASELINE_DIR, 'design-tokens.json');
const MARKER = 'design-ok';

const HEX_RE = /(?<=^|[\s:,(='"`])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const FUNC_RE = /\b(?:rgba?|hsla?)\(\s*-?[\d.]/gi;
const CSS_SIZE_RE = /font-size\s*:\s*-?[\d.]+(?:px|rem|em|pt)\b/gi;
const JS_SIZE_RE = /fontSize\s*[:=]\s*['"`]?-?[\d.]+(?:px|rem|em|pt)\b/g;
const TOKEN_DEF_RE = /--[\w-]+\s*:[^;{}]*/g;
const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const DYNAMIC_CSS_RE = /['"`]([\w\-./]+\.css)(?:\?[^'"`]*)?['"`]/g;
const SKIP_STYLE_RE = /(^|\/)(vendor|libs|preview|_archive)\//;

function countMatches(text, re) {
  re.lastIndex = 0;
  const found = text.match(re);
  return found ? found.length : 0;
}

/** 数一行里的写死颜色与写死字号（行已去掉注释） */
function countLine(line) {
  const body = line.replace(TOKEN_DEF_RE, '');
  return {
    colors: countMatches(body, HEX_RE) + countMatches(body, FUNC_RE),
    fontSizes: countMatches(body, CSS_SIZE_RE) + countMatches(body, JS_SIZE_RE)
  };
}

/** 逐行计数：kind 为 'css' 或 'js'；返回合计与带行号的明细 */
function countText(text, kind) {
  const source = kind === 'css'
    ? text.replace(CSS_COMMENT_RE, (block) => block.replace(/[^\r\n]/g, ' '))
    : text;
  const rawLines = text.split(/\r?\n/);
  const lines = source.split(/\r?\n/);
  const hits = [];
  let colors = 0;
  let fontSizes = 0;
  lines.forEach((line, i) => {
    const raw = rawLines[i] || '';
    if (raw.indexOf(MARKER) !== -1) return;
    let body = line;
    if (kind === 'js') {
      if (lib.isCommentLine(line)) return;
      body = lib.stripLineComment(line);
    }
    const c = countLine(body);
    if (!c.colors && !c.fontSizes) return;
    colors += c.colors;
    fontSizes += c.fontSizes;
    hits.push({ line: i + 1, colors: c.colors, fontSizes: c.fontSizes, text: raw.trim().slice(0, 160) });
  });
  return { colors, fontSizes, hits };
}

function toStyleEntry(src) {
  const clean = src.replace(/^\.\//, '').split('?')[0];
  if (/^(https?:)?\/\//.test(clean) || SKIP_STYLE_RE.test(clean)) return null;
  const abs = path.join(lib.WEB_ROOT, clean);
  return fs.existsSync(abs) ? { src: clean, abs, kind: 'css' } : null;
}

/** 运行时样式表：index.html 链接的 + 运行时 JS 按文件名动态加载的 */
function runtimeStyleFiles(jsFiles) {
  const found = new Map();
  const html = fs.readFileSync(path.join(lib.WEB_ROOT, 'index.html'), 'utf8');
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  linkTags.forEach((tag) => {
    if (!/\brel=["']stylesheet["']/i.test(tag)) return;
    const href = /\bhref=["']([^"']+)["']/i.exec(tag);
    const entry = href && toStyleEntry(href[1]);
    if (entry && !found.has(entry.src)) found.set(entry.src, entry);
  });
  jsFiles.forEach((file) => {
    const text = fs.readFileSync(file.abs, 'utf8');
    let m;
    DYNAMIC_CSS_RE.lastIndex = 0;
    while ((m = DYNAMIC_CSS_RE.exec(text))) {
      const entry = toStyleEntry(m[1]);
      if (entry && !found.has(entry.src)) found.set(entry.src, entry);
    }
  });
  return [...found.values()];
}

function auditFiles() {
  const js = lib.runtimeCodeFiles().map((f) => ({ src: f.src, abs: f.abs, kind: 'js' }));
  const css = runtimeStyleFiles(js);
  const files = js.concat(css);
  const counts = {};
  let colors = 0;
  let fontSizes = 0;
  files.forEach((f) => {
    const c = countText(fs.readFileSync(f.abs, 'utf8'), f.kind);
    colors += c.colors;
    fontSizes += c.fontSizes;
    if (c.colors || c.fontSizes) counts[f.src] = { colors: c.colors, fontSizes: c.fontSizes };
  });
  return { files, jsCount: js.length, cssCount: css.length, counts, totals: { colors, fontSizes } };
}

/** 与基线比：返回超基线的条目（基线里没有的文件按 0 算） */
function compareToBaseline(baseFiles, counts) {
  const zero = { colors: 0, fontSizes: 0 };
  const violations = [];
  Object.entries(counts).forEach(([src, cur]) => {
    const was = (baseFiles && baseFiles[src]) || zero;
    if (cur.colors > was.colors) violations.push(`${src}: 写死颜色 ${was.colors} → ${cur.colors}（+${cur.colors - was.colors}）`);
    if (cur.fontSizes > was.fontSizes) violations.push(`${src}: 写死字号 ${was.fontSizes} → ${cur.fontSizes}（+${cur.fontSizes - was.fontSizes}）`);
  });
  return violations;
}

function sortedCounts(counts) {
  const out = {};
  Object.keys(counts).sort().forEach((k) => { out[k] = counts[k]; });
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const UPDATE = args.includes('--update');
  const topIdx = args.indexOf('--top');
  const TOP_N = topIdx !== -1 ? parseInt(args[topIdx + 1], 10) || 15 : 0;
  const listIdx = args.indexOf('--list');
  const LIST = listIdx !== -1 ? args[listIdx + 1] : '';

  const result = auditFiles();
  console.log(`[lint-design-tokens] 运行时 ${result.jsCount} 个脚本 + ${result.cssCount} 个样式表 · 写死颜色 ${result.totals.colors} 处 · 写死字号 ${result.totals.fontSizes} 处`);

  if (LIST) {
    const target = result.files.find((f) => f.src === LIST.replace(/\\/g, '/'));
    if (!target) {
      console.error(`[lint-design-tokens] --list：${LIST} 不在运行时文件集里`);
      process.exit(1);
    }
    countText(fs.readFileSync(target.abs, 'utf8'), target.kind).hits
      .forEach((h) => console.log(`  ${String(h.line).padStart(6)}  色${h.colors} 字${h.fontSizes}  ${h.text}`));
    process.exit(0);
  }

  if (TOP_N) {
    console.log(`--- 欠账最多 Top ${TOP_N}（颜色 + 字号）---`);
    Object.entries(result.counts)
      .sort((a, b) => (b[1].colors + b[1].fontSizes) - (a[1].colors + a[1].fontSizes))
      .slice(0, TOP_N)
      .forEach(([src, c]) => console.log(`  色 ${String(c.colors).padStart(5)} · 字 ${String(c.fontSizes).padStart(5)}  ${src}`));
  }

  if (UPDATE) {
    lib.saveJSON(BASELINE_FILE, {
      config: { marker: MARKER },
      updatedAt: new Date().toISOString(),
      totals: result.totals,
      files: sortedCounts(result.counts)
    });
    console.log(`[lint-design-tokens] 基线已更新 → ${lib.rel(BASELINE_FILE)}`);
    process.exit(0);
  }

  const baseline = lib.loadJSON(BASELINE_FILE, null);
  if (!baseline) {
    console.error('[lint-design-tokens] 无基线。先跑: node scripts/lint-design-tokens.js --update');
    process.exit(1);
  }

  const base = baseline.files || {};
  const zero = { colors: 0, fontSizes: 0 };
  const violations = compareToBaseline(base, result.counts);

  if (violations.length) {
    console.error(`\n[lint-design-tokens] FAIL — ${violations.length} 处：颜色和字号改用 styles.css 的令牌（见 docs/art-constitution.md）；`);
    console.error(`  确经裁定的例外（如图标插画设色）在该行加 ${MARKER}；拆分挪代码或还账后跑 --update 重写基线`);
    violations.forEach((v) => console.error('  ' + v));
    process.exit(1);
  }

  const shrunk = Object.keys(base).filter((src) => {
    const cur = result.counts[src] || zero;
    return cur.colors < base[src].colors || cur.fontSizes < base[src].fontSizes;
  }).length;
  console.log(`[lint-design-tokens] PASS${shrunk ? `（${shrunk} 个文件还了账，可跑 --update 收紧基线）` : ''}`);
  process.exit(0);
}

if (require.main === module) main();

module.exports = { MARKER, countText, countLine, compareToBaseline, runtimeStyleFiles, auditFiles };
