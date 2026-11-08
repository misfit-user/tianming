'use strict';
// smoke-official-scenario-seeder.js — 桌面端官方剧本落盘器（tm-official-scenario-seeder.js）契约。
// 它只在桌面剧本目录缺官方剧本文件时工作：经 tm-official-scenario-loader 装缺的那几个内建脚本，
// 把 P.scenarios 里的整份数据克隆后交给 tianming.saveScenario。不再有第二份 seeder 主包。

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB_ROOT = path.resolve(__dirname, '..');
const SEEDER_PATH = path.join(WEB_ROOT, 'tm-official-scenario-seeder.js');
const { ENTRIES } = require('./sync-official-scenarios.js');

function read(file) { return fs.readFileSync(file, 'utf8'); }
// vm 上下文里造的对象原型来自另一个 realm，deepStrictEqual 会因原型不同而失败：比较前先压成普通 JSON。
const plain = (value) => JSON.parse(JSON.stringify(value));

function listedLocalScripts(html) {
  const scripts = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html))) scripts.push(match[1].split(/[?#]/, 1)[0].replace(/^\.\//, ''));
  return scripts;
}

function fullScenario(id) {
  return { id, name: 'FULL:' + id, characters: [{ id: 'c1', traits: ['a'] }], map: { regions: [{ id: 'r1' }] } };
}

// 一个干净的 seeder 上下文：桌面 API、loader、console 都可按用例替换。
function boot(options) {
  const opts = options || {};
  const warnings = [];
  const saves = [];
  const ensured = [];
  const existing = new Set(opts.existing || []);
  const context = {
    console: {
      log() {}, info() {},
      warn(...args) { warnings.push(args.map(String).join(' ')); }
    },
    structuredClone,
    Promise
  };
  context.window = context;
  context.globalThis = context;
  if (opts.desktop !== false) {
    context.tianming = {
      isDesktop: true,
      listScenarios: opts.listScenarios || (async () => ({ success: true, files: Array.from(existing, (name) => ({ name })) })),
      saveScenario: opts.saveScenario || (async (filename, data) => { saves.push({ filename, data }); return { success: true }; })
    };
  }
  if (opts.loader !== false) {
    context.TMOfficialScenarioLoader = {
      ensure: opts.ensure || (async (id) => { ensured.push(id); return fullScenario(id); })
    };
  }
  vm.createContext(context);
  vm.runInContext(read(SEEDER_PATH), context, { filename: SEEDER_PATH });
  assert(context.TMOfficialScenarioSeeder && typeof context.TMOfficialScenarioSeeder.ensure === 'function', 'seeder must register itself');
  return { context, seeder: context.TMOfficialScenarioSeeder, warnings, saves, ensured };
}

const ALL = ENTRIES.map((entry) => entry.filename.replace(/\.json$/, ''));

async function main() {
  let checks = 0;
  function ok(condition, label) { assert.ok(condition, label); checks++; }

  // 1. 文件名↔id 对照表与生成器登记一致（顺序也一致）。
  {
    const { seeder } = boot();
    assert.deepStrictEqual(
      plain(seeder.official),
      ENTRIES.map((entry) => ({ filename: entry.filename.replace(/\.json$/, ''), id: entry.id })),
      'seeder OFFICIAL table must mirror sync-official-scenarios ENTRIES');
    ok(true, 'official table mirrors the generator registry');
  }

  // 2. 没有桌面 API：跳过，不碰 loader。
  {
    const { seeder, ensured } = boot({ desktop: false });
    const result = await seeder.ensure();
    ok(result.skipped === true && /desktop/.test(result.reason), 'non-desktop pages skip');
    ok(ensured.length === 0, 'non-desktop pages never load a scenario');
  }

  // 3. 三份都在：不装、不存。
  {
    const { seeder, ensured, saves } = boot({ existing: ALL });
    const result = await seeder.ensure();
    assert.deepStrictEqual(plain(result), { saved: [], missing: [] });
    ok(ensured.length === 0 && saves.length === 0, 'complete scenario dir loads and saves nothing');
  }

  // 4. 缺一份：只经 loader 装那一份，存的是克隆（深等、不同引用），结果列出已存与缺失。
  {
    const shaosong = ENTRIES.find((entry) => entry.key === 'shaosong');
    const present = ALL.filter((name) => name !== shaosong.filename.replace(/\.json$/, ''));
    const loaded = {};
    const { seeder, ensured, saves, warnings } = boot({
      existing: present,
      ensure: async (id) => { ensured.push(id); loaded[id] = fullScenario(id); return loaded[id]; }
    });
    const result = await seeder.ensure();
    assert.deepStrictEqual(ensured, [shaosong.id], 'only the missing scenario is loaded, by its manifest id');
    ok(saves.length === 1 && saves[0].filename === shaosong.filename.replace(/\.json$/, ''), 'the missing scenario is saved under its official filename');
    assert.deepStrictEqual(plain(saves[0].data), plain(loaded[shaosong.id]));
    ok(saves[0].data !== loaded[shaosong.id] && saves[0].data.map.regions !== loaded[shaosong.id].map.regions, 'saved data is a deep clone, never the live P.scenarios object');
    assert.deepStrictEqual(plain(result), { saved: [saves[0].filename], missing: [saves[0].filename] });
    ok(warnings.length === 0, 'happy path logs no warnings');
    ok(await seeder.ensure() === await seeder.ensure(), 'a settled ensure() keeps returning the same result object');
  }

  // 5. 并发 ensure() 共用一次运行（async 包装每次都是新 promise，但只列目录一次、同一个结果对象）。
  {
    let lists = 0;
    const { seeder } = boot({ existing: [], listScenarios: async () => { lists++; return { success: true, files: [] }; } });
    const [first, second] = await Promise.all([seeder.ensure(), seeder.ensure()]);
    ok(first === second && lists === 1, 'concurrent ensure() calls share one run and one result');
    ok(first.saved.length === 3 && first.missing.length === 3, 'an empty scenario dir gets all three official scenarios');
  }

  // 6. loader 不在：整个 ensure 失败并可重试（装好 loader 后再调会成功）。
  {
    const { context, seeder, saves } = boot({ existing: [], loader: false });
    const failed = await seeder.ensure();
    ok(failed.skipped === true && /loader unavailable/.test(failed.error), 'missing loader fails the run instead of silently saving nothing');
    ok(saves.length === 0, 'nothing is saved without the loader');
    context.TMOfficialScenarioLoader = { ensure: async (id) => fullScenario(id) };
    const retried = await seeder.ensure();
    ok(retried.saved.length === 3, 'a later call retries after the loader appears');
  }

  // 7. 某一份装载失败：整体失败、已存的保留、下次重试。
  {
    const tang = ENTRIES.find((entry) => entry.key === 'tang840');
    let attempt = 0;
    const { seeder, saves } = boot({
      existing: [],
      ensure: async (id) => {
        if (id === tang.id && attempt++ === 0) throw new Error('script load failed');
        return fullScenario(id);
      }
    });
    const failed = await seeder.ensure();
    ok(failed.skipped === true && /script load failed/.test(failed.error), 'a failed scenario load fails the run');
    ok(saves.length === 2, 'scenarios loaded before the failure are still saved');
    const retried = await seeder.ensure();
    ok(retried.saved.length === 3, 'the run is retried from scratch on the next call (the desktop dir dedupes by filename)');
  }

  // 8. loader 给回占位或别的 id：不存、警告、继续。
  {
    const { seeder, saves, warnings } = boot({
      existing: [],
      ensure: async (id) => (id === ENTRIES[0].id ? { id, _lazyOfficial: true } : fullScenario(id))
    });
    const result = await seeder.ensure();
    ok(saves.length === 2 && result.saved.length === 2, 'a placeholder is never written to disk');
    ok(warnings.some((line) => /not loaded/.test(line)), 'a placeholder is reported');
  }

  // 9. 落盘失败：警告、不计入 saved。
  {
    const { seeder, warnings } = boot({
      existing: [],
      saveScenario: async (filename) => (filename === ALL[1] ? { success: false, error: 'disk full' } : { success: true })
    });
    const result = await seeder.ensure();
    ok(result.saved.length === 2 && !result.saved.includes(ALL[1]), 'a failed save is not reported as saved');
    ok(warnings.some((line) => /save failed/.test(line) && /disk full/.test(line)), 'a failed save is reported with its reason');
  }

  // 10. 源码契约：不再引用任何第二份数据包；index.html 同时挂 seeder 与 loader。
  {
    const source = read(SEEDER_PATH);
    ok(!/tm-official-scenario-bundle|TMOfficialScenarioBundle/.test(source), 'seeder must not reference a seeder bundle');
    ok(/TMOfficialScenarioLoader/.test(source), 'seeder loads scenarios through the official loader');
    const scripts = listedLocalScripts(read(path.join(WEB_ROOT, 'index.html')));
    ok(scripts.includes('tm-official-scenario-seeder.js') && scripts.includes('tm-official-scenario-loader.js'), 'index.html loads both the seeder and the loader');
    ok(!fs.existsSync(path.join(WEB_ROOT, 'tm-official-scenario-bundle.js')), 'the seeder bundle file is gone');
  }

  console.log('[smoke-official-scenario-seeder] PASS checks=' + checks);
}

main().catch((error) => {
  console.error('[smoke-official-scenario-seeder] FAIL ' + (error && error.stack || error));
  process.exit(1);
});
