// 在 VM 里真开官方剧本（与 smoke-tang840-opening-ledgers 同一套 headless 装载），
// 对抽样地块调用正式的方志渲染，导出玩家实际看到的文字，以及 regionBundle 汇总出的数据。
// 用法：node dossier-dump.js <sid> <输出目录> [地块名,地块名,...]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKTREE = process.env.TM_AUDIT_WORKTREE || path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(WORKTREE, 'web/scripts');
const HELPER_FILE = path.join(SCRIPTS_DIR, 'smoke-start-game-data-integrity.js');

const SOURCES = {
  'sc-tianqi7-1627': '天启七年·九月（官方）.json',
  'sc-jianyan1-1127-shaosong': '绍宋·建炎元年八月（官方）.json',
  'sc-tang840-840': '晚唐·开成五年（官方）.json'
};

const sid = process.argv[2];
const outDir = process.argv[3];
const wantedNames = (process.argv[4] || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!SOURCES[sid] || !outDir) {
  console.error('用法：node dossier-dump.js <sid> <输出目录> [地块名,...]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

function loadHelpers() {
  const text = fs.readFileSync(HELPER_FILE, 'utf8').replace(/^#![^\n]*\n/, '');
  const end = text.indexOf('(async function main()');
  if (end < 0) throw new Error('找不到 smoke-start-game-data-integrity 的 main 边界');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports',
    text.slice(0, end) + '\nreturn { loadGame };');
  return factory(require, process, SCRIPTS_DIR, HELPER_FILE, { exports: {} }, {});
}

// 把册页 HTML 转成便于审阅的纯文本：块级元素换行，去标签，解实体
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d|\/section|\/header|\/footer)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function safeJson(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (k, v) => {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return '[循环]';
      seen.add(v);
    }
    if (typeof k === 'string' && /^(geometry|path|d|points|coords|polygon)$/.test(k)) return '[几何略]';
    return v;
  }, 1);
}

(async function main() {
  const helpers = loadHelpers();
  const context = helpers.loadGame(null);
  const source = JSON.parse(fs.readFileSync(path.join(WORKTREE, 'scenarios', SOURCES[sid]), 'utf8'));
  context.__source = source;
  vm.runInContext(
    'P.scenarios=(P.scenarios||[]).filter(function(s){return s.id!==__source.id;});' +
    'P.scenarios.push(__source); P.ai.key=""; P.ai.url=""; P.ai.model="";', context);
  const started = Date.now();
  vm.runInContext('doActualStart(' + JSON.stringify(sid) + ')', context, { timeout: 600000 });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  console.log('[started]', sid, ((Date.now() - started) / 1000).toFixed(1) + 's');

  const game = context.GM;
  const parts = context.TMPhase8FormalBridge && context.TMPhase8FormalBridge.__p8MapParts;
  if (!game || !game.mapData || !parts) throw new Error('开局后缺 GM.mapData 或地图模块');
  const regions = game.mapData.regions || [];
  const picked = wantedNames.length
    ? wantedNames.map((name) => regions.find((r) => r.name === name || r.id === name) || { missing: name })
    : regions.slice(0, 6);

  const summary = [];
  for (const region of picked) {
    if (region.missing) { summary.push({ name: region.missing, error: '地图上没有这个地块' }); continue; }
    const safeName = String(region.name || region.id).replace(/[\\/:*?"<>|]/g, '_');
    let bookText = '';
    let bundle = null;
    let error = null;
    try {
      bundle = parts.regionBundle(region);
      parts.openRegionDossier(region);
      const pop = context.document.getElementById('ppop');
      bookText = htmlToText(pop && pop.innerHTML);
    } catch (e) {
      error = String(e && e.stack || e);
    }
    fs.writeFileSync(path.join(outDir, safeName + '.txt'), bookText || ('[渲染失败] ' + error));
    fs.writeFileSync(path.join(outDir, safeName + '.bundle.json'), safeJson(bundle));
    summary.push({ name: region.name, id: region.id, chars: bookText.length, error });
  }
  fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary));
  process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
