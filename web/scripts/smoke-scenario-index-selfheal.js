// smoke-scenario-index-selfheal.js — findScenarioById 索引自愈 + 著卷导入口防回归（2026-07-11）
// 定罪案：「新建空卷→输入名称→找不到剧本」——confirmNewScn 直接 P.scenarios.push，
// 而 findScenarioById 查缓存 Map（P._indices.scenarioById），push 不更新 Map → 新卷即建即丢。
// 修法：查询侧自愈（命中验真防幽灵·未命中扫数组回填），一次治全仓十余处 push/splice 点位。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok· ' + name); }
  else { fail++; console.log('  FAIL· ' + name); }
}

// ── 功能级：抽出 findScenarioById 在沙箱真跑 ──
const src = fs.readFileSync(path.join(__dirname, '..', 'tm-indices.js'), 'utf8');
const m = src.match(/function findScenarioById\(id\) \{[\s\S]*?\n\}/);
ok(!!m, 'findScenarioById 源码可抽取');
if (m) {
  const sandbox = {
    console: { warn: function(){} },
    P: { scenarios: [], _indices: { scenarioById: new Map() } },
    buildIndices: function() {
      sandbox.P._indices = sandbox.P._indices || {};
      sandbox.P._indices.scenarioById = new Map();
      (sandbox.P.scenarios || []).forEach(function(sc){ if (sc && sc.id) sandbox.P._indices.scenarioById.set(sc.id, sc); });
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(m[0] + '\nthis._find = findScenarioById;', sandbox);

  // 场景1（定罪案主路径）：push 后索引陈旧·应自愈命中并回填索引
  const fresh = { id: 'new-blank-1', name: '新空卷' };
  sandbox.P.scenarios.push(fresh);
  ok(sandbox._find('new-blank-1') === fresh, '场景1·新建 push 未入索引 → 自愈命中（原 bug 此处返回 undefined）');
  ok(sandbox.P._indices.scenarioById.get('new-blank-1') === fresh, '场景1·命中后回填索引');

  // 场景2：splice 删除后 Map 残留幽灵·应验真拒绝并清除
  const ghost = { id: 'ghost-1', name: '将删卷' };
  sandbox.P.scenarios.push(ghost);
  sandbox.buildIndices();
  sandbox.P.scenarios.splice(sandbox.P.scenarios.indexOf(ghost), 1);
  ok(sandbox._find('ghost-1') === undefined, '场景2·splice 删除后不再幽灵命中');
  ok(!sandbox.P._indices.scenarioById.has('ghost-1'), '场景2·幽灵条目已从索引清除');

  // 场景3：正常命中不受影响
  ok(sandbox._find('new-blank-1') === fresh, '场景3·常规命中照旧');

  // 场景4：不存在的 id → undefined
  ok(sandbox._find('nope') === undefined, '场景4·确实不存在返回 undefined');
}

// ── 源码级：著卷列表页有导入正门 ──
const launch = fs.readFileSync(path.join(__dirname, '..', 'tm-launch.js'), 'utf8');
// 架构约束：p:_indices 子树写主是 tm-indices.js·导入不得手写索引（靠 findScenarioById 查询侧自愈）
ok(!/importScnFromFile[\s\S]{0,1600}scenarioById\.set/.test(launch.slice(launch.indexOf('function importScnFromFile'))), '导入不闯 p:_indices 子树（索引走查询侧自愈）');

console.log('[smoke-scenario-index-selfheal] ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
