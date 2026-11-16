const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'phase8-formal-rightrail.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('ASSERT FAIL:', msg);
    process.exit(1);
  }
}

function sliceBetween(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `missing slice ${start}`);
  return source.slice(a, b);
}

const issueCheck = sliceBetween('function rightIssueIsPlayerFactionPerson', 'function rightIssueTopic');
const issuePeople = sliceBetween('function rightIssuePeople()', 'function rightWenduiHistory');
const renderMap = sliceBetween('function renderMapPanelRich()', 'function rightFinanceRoot');
const renderArchive = sliceBetween('function renderZhiRich()', 'var renderers =');

assert(source.includes('function rightIssueContext'), 'issue panel must cache faction/pinned context once per people scan');
assert(issuePeople.includes('var ctx = rightIssueContext();'), 'rightIssuePeople must create one reusable context');
assert(issuePeople.includes('rightIssueIsPlayerFactionPerson(p, ctx)'), 'rightIssuePeople must reuse context while filtering');
assert(issueCheck.includes('ctx && Array.isArray(ctx.playerFactions)'), 'issue ownership check must read cached player factions when provided');
assert(issueCheck.includes('ctx && Array.isArray(ctx.knownFactions)'), 'issue ownership check must read cached known factions when provided');
assert(issuePeople.includes('ctx.pinnedPeople[personKey(a)]'), 'rightIssuePeople sort must use cached pinned lookup for a');
assert(issuePeople.includes('ctx.pinnedPeople[personKey(b)]'), 'rightIssuePeople sort must use cached pinned lookup for b');
assert(!issuePeople.includes('(state.pinnedPeople || []).indexOf(personKey'), 'rightIssuePeople must not scan pinnedPeople during every sort comparison');

assert(source.includes('RIGHT_ADMIN_INITIAL_ROWS'), 'map panel must cap initial synchronous admin cards');
assert(source.includes('function rightAdminCardsHtml'), 'map panel must render admin cards via shared helper');
assert(source.includes('function rightScheduleAdminListHydration'), 'map panel must defer full admin list hydration');
assert(renderMap.includes('syncItems'), 'renderMapPanelRich must build a small initial admin list');
assert(renderMap.includes('rightAdminCardsHtml(syncItems)'), 'renderMapPanelRich must render only syncItems before first paint');
assert(!/items\.map\s*\(\s*function\s*\(\s*x\s*,\s*i\s*\)/.test(renderMap), 'renderMapPanelRich must not synchronously map every admin card');

assert(source.includes('RIGHT_OFFICE_INITIAL_NODES'), 'archive panel must cap initial synchronous office nodes');
assert(source.includes('function rightOfficeTreeHtml'), 'archive panel must have shared full office tree renderer');
assert(source.includes('function rightOfficeTreeShellHtml'), 'archive panel must have lightweight office tree shell renderer');
assert(source.includes('function rightScheduleOfficeTreeHydration'), 'archive panel must defer full office tree hydration');
assert(renderArchive.includes('deferredTree'), 'renderZhiRich must decide whether to defer large office trees');
assert(renderArchive.includes('treeHtml'), 'renderZhiRich must render precomputed treeHtml');
assert(!/tree\.map\s*\(\s*function\s*\(\s*n\s*\)\s*\{\s*return\s+renderRightOfficeNode\s*\(\s*n,\s*0\s*\)/.test(renderArchive), 'renderZhiRich must not synchronously map the full office tree');

console.log('smoke-right-panel-lag-guards OK');
