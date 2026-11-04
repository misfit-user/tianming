// smoke-character-region-travel.js — 人物在最小地块之间一块块走
//
// 规则（同志定）：人物绑定到最小地块，移动也在最小地块之间。
// 先前赴任、召回是人留在原地等天数到期，然后直接到目的地；AI 写 new_location 更是瞬移。
// 现在：路上按走过的比例落到那一块，到期才抵达，抵达和就任的老链不动；
// AI 下令移动，两头都在地图上就走真实路程；对不上地图的、同一地块的、玩家定了即刻抵达的直接到。
// 目的地写粗区的，路程算到区内最近的一块，到了也落在这一块；「军中」这类不是地方的字眼，人留在原来那块，字接在后面。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  PASS ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
}

const sandbox = {
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  setTimeout, clearTimeout, Promise, Map, Set, WeakMap,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  document: { getElementById: () => null, createElement: () => ({ style: {} }), addEventListener() {}, body: {} },
  TM: {}, P: {}, GM: {},
  toast() {}, addEB() {}, escHtml: (s) => String(s == null ? '' : s), getTSText: () => 'T', uid: () => 'id' + Math.random().toString(36).slice(2, 8),
  getCurrentGameDay: () => 100, _getDaysPerTurn: () => 10, SettlementPipeline: { register() {} },
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
for (const rel of ['tm-utils.js', 'tm-map-route-days.js', 'tm-map-locations.js', 'tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js', 'generated/tm-ai-change-applier.bundle.js']) {
  vm.runInContext(read(rel), sandbox, { filename: rel });
}
sandbox._$ = () => null;
sandbox.findCharByName = (n) => (sandbox.GM.chars || []).find((c) => c && c.name === n) || null;
vm.runInContext(read('tm-hongyan-office.js'), sandbox, { filename: 'tm-hongyan-office.js' });
const hit = (rel, name) => read(rel).match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\r?\\n\\}'))[0];
vm.runInContext(hit('tm-chaoyi.js', '_getPlayerLocation'), sandbox);
vm.runInContext(hit('tm-chaoyi.js', '_isAtCapital'), sandbox);

const P = { bj: [116.4, 39.9], bd: [115.47, 38.87], kf: [114.3, 34.8], nj: [118.78, 32.06], gz: [113.26, 23.13], tw: [121, 24] };
const lineMap = () => ({
  locationBindingContract: { schema: 'source-text-location-v2', revision: 1, courtCharacterId: 'c1', courtFactionId: 'f-ming', courtStartRegionId: 'r-bj', exactAreaPriority: true },
  regions: [
    { id: 'r-bj', name: '顺天府', aliases: ['蓟州'], geographicCenter: P.bj, neighbors: ['r-bd'] },
    { id: 'r-bd', name: '保定府', geographicCenter: P.bd, neighbors: ['r-bj', 'r-kf'] },
    { id: 'r-kf', name: '开封府', geographicCenter: P.kf, neighbors: ['r-bd', 'r-nj'] },
    { id: 'r-nj', name: '应天府', geographicCenter: P.nj, neighbors: ['r-kf', 'r-gz'] },
    { id: 'r-gz', name: '广州府', geographicCenter: P.gz, neighbors: ['r-nj'] },
    { id: 'r-tw', name: '台湾', geographicCenter: P.tw, neighbors: [] },
  ],
  locationAreas: [{ text: '东南', regionIds: ['r-nj', 'r-gz'] }],
  locationAliases: [],
});
const world = (extra) => Object.assign({
  turn: 5, _capital: '北京', mapData: lineMap(), facs: [], _turnReport: [],
  chars: [
    { id: 'c1', name: '天子', isPlayer: true, alive: true, location: '京师·紫禁城' },
    { id: 'c2', name: '袁崇焕', alive: true, location: '蓟州·三屯营' },
  ],
  allCharacters: [{ id: 'c2', name: '袁崇焕', alive: true, location: '蓟州·三屯营' }],
}, extra || {});
const who = (n) => sandbox.GM.chars.find((c) => c.name === n);
const mirror = (n) => sandbox.GM.allCharacters.find((c) => c.name === n);
const tick = (d) => sandbox.advanceCharTravelByDays(d);

console.log('一、路上一块块过去，到期才到');
sandbox.GM = world();
const yuan = who('袁崇焕');
assert(sandbox._tmMoveCharToward(yuan, '广州府', '奉诏南下') === 'traveling', '两头都在地图上：上路');
const total = sandbox.calcLetterDays('蓟州·三屯营', '广州府', 'normal');
assert(yuan._travelRemainingDays === total && yuan._travelFrom === '蓟州·三屯营' && yuan._travelTo === '广州府', '走真实路程的天数');
assert(total > 30, '这趟要走一个多月（' + total + '日）');
assert(yuan.location === '蓟州·三屯营', '刚上路还在原处');
assert(mirror('袁崇焕')._travelTo === '广州府', '人物镜像也知道他上路了');
const visited = [yuan.location];
let ticks = 0;
let premature = false;
while (yuan._travelTo && ticks < 40) {
  tick(10);
  ticks++;
  if (yuan._travelTo && yuan.location === '广州府') premature = true;
  if (visited[visited.length - 1] !== yuan.location) visited.push(yuan.location);
}
assert(ticks === Math.ceil(total / 10), '走满这么多回合才到（' + ticks + '回合）');
assert(!premature, '到期之前到不了终点');
assert(visited.join('>') === '蓟州·三屯营>保定府>开封府>应天府>广州府', '一块块过去：' + visited.join('>'));
assert(yuan.location === '广州府' && yuan.regionId === 'r-gz' && yuan.mapRegionId === 'r-gz', '到了绑到终点这一块');
assert(mirror('袁崇焕').location === '广州府' && mirror('袁崇焕').regionId === 'r-gz', '镜像同步');
assert(!yuan._travelTo && !yuan._travelLeg && !yuan._travelRemainingDays, '路上的字段清干净');
assert(sandbox.GM._turnReport.some((r) => r.type === 'travel_arrived' && r.to === '广州府'), '抵达照旧写进回合报告');

console.log('二、路上的状态');
sandbox.GM = world();
const y2 = who('袁崇焕');
sandbox._tmMoveCharToward(y2, '广州府', '');
tick(1);
assert(y2.location === '蓟州·三屯营', '还在这一块：留着细到营寨的写法');
assert(y2.regionId === 'r-bj', '人物绑着这一块');
assert(!sandbox._isAtCapital(y2), '虽还在京畿，上路了就不能朝会');
tick(10);
assert(y2.location === '保定府' && y2.regionId === 'r-bd' && mirror('袁崇焕').location === '保定府', '走到下一块，绑定和镜像都跟着');
assert(y2._travelFrom === '蓟州·三屯营', '起点不变，抵达时的史笔写得对');
tick(10);
const was = y2.location;
y2._travelRemainingDays += 300;
tick(10);
assert(y2.location === was, '剩余天数被改大：人不往回走');
sandbox.GM.chars[0].location = was;
assert(!sandbox._isAtCapital(y2), '路过天子所在也不算朝会的人');

console.log('三、中途改道');
sandbox.GM = world();
const y3 = who('袁崇焕');
sandbox._tmMoveCharToward(y3, '广州府', '');
tick(10);
tick(10);
const mid = y3.location;
y3._travelFrom = y3.location; y3._travelTo = '顺天府'; y3._travelStartTurn = 99;
y3._travelRemainingDays = sandbox.calcLetterDays(mid, '顺天府', 'normal');
y3._travelElapsedDays = 0; y3._travelExpectedDays = 0;
tick(1);
assert(y3.location === mid, '改道从当下这一块重新走，不沿用旧路的进度');

console.log('四、走不通、对不上、同一块、即刻抵达');
sandbox.GM = world();
let y = who('袁崇焕');
assert(sandbox._tmMoveCharToward(y, '台湾', '') === 'traveling', '隔海也要走这么多日');
tick(1);
assert(y.location === '蓟州·三屯营', '隔海：路上不落地块，人还写在原处');
y._travelRemainingDays = 1;
tick(10);
assert(y.location === '台湾' && y.regionId === 'r-tw', '到期直接抵达');

sandbox.GM = world();
y = who('袁崇焕');
assert(sandbox._tmMoveCharToward(y, '太行山·忠义寨', '') === 'arrived' && y.location === '太行山·忠义寨', '目的地对不上地图：直接到');
assert(!y.regionId && !y._travelTo, '不绑地块也不留路上字段');
sandbox.GM = world();
y = who('袁崇焕');
assert(sandbox._tmMoveCharToward(y, '太行山·忠义寨', '', { traveling: true }) === 'traveling' && y.location === '蓟州·三屯营', '明说在途的：按粗估的天数走');
assert(y._travelRemainingDays === 20, '粗估二十日');

sandbox.GM = world();
y = who('袁崇焕');
y.location = '蓟州·三屯营';
assert(sandbox._tmMoveCharToward(y, '顺天府', '') === 'arrived' && y.location === '顺天府' && !y._travelTo, '同一地块：直接到');

sandbox.GM = world();
y = who('袁崇焕');
sandbox._tmMoveCharToward(y, '东南', '');
assert(y._travelTo === '东南', '目的地是粗区也上路');
assert(y._travelRemainingDays === sandbox.calcLetterDays('蓟州·三屯营', '应天府', 'normal'), '路程算到要落脚的那一块');
tick(10);
tick(10);
assert(y.location === '开封府', '朝粗区里最近的一块走');
y._travelRemainingDays = 1;
tick(10);
assert(y.location === '应天府' && y.regionId === 'r-nj', '到了落到最小地块，不留粗区');
assert(!y._travelTo, '行程清干净了');

sandbox.GM = world();
y = who('袁崇焕');
y.location = '应天府';
assert(sandbox._tmMoveCharToward(y, '东南', '') === 'arrived' && y.location === '应天府' && !y._travelTo, '已在粗区里：不动');

sandbox.GM = world();
y = who('袁崇焕');
y.location = '东南';
assert(sandbox._tmMoveCharToward(y, '顺天府', '') === 'traveling', '从粗区动身也上路');
tick(10);
assert(sandbox.TMMapLocations.placeRegionIds(y.location, sandbox.GM).length === 1, '从粗区动身，路上就落到具体地块了');
y._travelRemainingDays = 1;
tick(10);
assert(y.location === '顺天府' && y.regionId === 'r-bj', '从粗区动身也到得了');

sandbox.GM = world();
y = who('袁崇焕');
y.location = '保定府';
assert(sandbox._tmMoveCharToward(y, '军中', '') === 'arrived' && y.location === '保定府·军中', '「军中」不是地方：人还在原来那块，字接在后面');
sandbox.TMMapLocations.syncCharacters(sandbox.GM);
assert(y.regionId === 'r-bd', '写「军中」的还绑着那一块');
assert(sandbox._tmMoveCharToward(y, '北上路上', '') === 'arrived' && y.location === '保定府·北上路上', '「路上」也一样，换字不叠字');
sandbox.TMMapLocations.syncCharacters(sandbox.GM);
assert(y.regionId === 'r-bd', '写「路上」的也绑着那一块');
assert(sandbox.calcLetterDays('顺天府', y.location, 'normal') === sandbox.calcLetterDays('顺天府', '保定府', 'normal'), '给他写信按那一块算路程');

sandbox.GM = world();
y = who('袁崇焕');
y.location = '保定府';
sandbox.applyAITurnChanges({ char_updates: [{ name: '袁崇焕', travelTo: { toLocation: '军前', estimatedDays: 3, reason: '' } }] });
assert(y._travelRemainingDays === 3, 'AI 让他去「军前」：地图上算不出，听 AI 估的');
tick(10);
assert(y.location === '保定府·军前' && y.regionId === 'r-bd', '到了也落在动身那一块');

sandbox.GM = world();
y = who('袁崇焕');
y.location = '保定府';
assert(sandbox._tmMoveCharToward(y, '太行山·忠义寨', '') === 'arrived' && y.location === '太行山·忠义寨', '真地名对不上地图的照写，不冒充还在原地');

sandbox.GM = world({ _playerDirectives: [{ type: 'rule', content: '人事调动即刻抵达' }] });
y = who('袁崇焕');
assert(sandbox._tmMoveCharToward(y, '广州府', '') === 'arrived' && y.location === '广州府', '玩家定了即刻抵达：直接到');

sandbox.GM = world();
y = who('袁崇焕');
sandbox._tmMoveCharToward(y, '广州府', '');
tick(10);
const left = y._travelRemainingDays;
assert(sandbox._tmMoveCharToward(y, '广州府', '') === 'traveling' && y._travelRemainingDays === left, 'AI 重发同一趟：不重启行程');

sandbox.GM = world();
y = who('袁崇焕');
y._travelTo = '保定府'; y._travelAssignPost = '兵部/尚书'; y._travelRemainingDays = 5; y._travelFrom = y.location;
assert(sandbox._tmMoveCharToward(y, '广州府', '') === 'arrived', '赴任途中被 AI 另外移动：不拦赴任链');
assert(y._travelAssignPost === '兵部/尚书' && y._travelTo === '保定府', '赴任的去向还在');

console.log('五、AI 的几条路');
sandbox.GM = world();
y = who('袁崇焕');
sandbox.applyAITurnChanges({ char_updates: [{ name: '袁崇焕', travelTo: { toLocation: '广州府', estimatedDays: 2, reason: '急召' } }] });
assert(y._travelRemainingDays === total, 'AI 说两日：地图上要走多久就走多久');
sandbox.GM = world();
y = who('袁崇焕');
sandbox.applyAITurnChanges({ office_assignments: [{ name: '袁崇焕', post: '巡抚', dept: '', action: 'appoint', toLocation: '广州府', estimatedDays: 2, reason: '' }] });
assert(y._travelTo === '广州府' && y._travelRemainingDays === total, '赴任也一样：AI 说两日，地图上要走多久就走多久');
sandbox.GM = world();
y = who('袁崇焕');
sandbox.applyAITurnChanges({ char_updates: [{ name: '袁崇焕', travelTo: { toLocation: '太行山', estimatedDays: 7, reason: '' } }] });
assert(y._travelRemainingDays === 7, '对不上地图的还听 AI 估的');
sandbox.GM = world();
y = who('袁崇焕');
sandbox.applyAITurnChanges({ char_updates: [{ name: '袁崇焕', updates: { location: '广州府' }, reason: '调任' }] });
assert(y.location === '蓟州·三屯营' && y._travelTo === '广州府', 'AI 直接改所在地：也得走');
assert(/_tmMoveCharToward\(_flCh/.test(read('tm-endturn-apply.js')) && /_tmMoveCharToward\(_nlCh/.test(read('tm-endturn-apply.js')) && /_tmMoveCharToward\(ch, cu\.new_location/.test(read('tm-endturn-apply.js')), 'new_location 三处都走这里');
assert(/_tmMoveCharToward\(ch, loc/.test(read('tm-endturn-agent-write-tools.js')), 'move_char 工具也走这里');
assert(!/_flCh\.location = act\.new_location; if \(window/.test(read('tm-endturn-apply.js').replace(/else \{[^}]*\}/g, '')), '不留瞬移的老写法');

console.log('六、没有地图、老档、坏地图');
sandbox.GM = { turn: 5, _capital: '北京', chars: [{ name: '甲', alive: true, location: '宁远' }], _turnReport: [] };
y = sandbox.GM.chars[0];
assert(sandbox._tmMoveCharToward(y, '顺天府', '') === 'arrived' && y.location === '顺天府', '没有地图的剧本照旧直接到');
y.location = '宁远'; y._travelTo = '顺天府'; y._travelFrom = '宁远'; y._travelRemainingDays = 15;
tick(10);
assert(y.location === '宁远', '没有地图：路上不动');
tick(10);
assert(y.location === '顺天府', '没有地图：到期抵达');

sandbox.GM = world();
y = who('袁崇焕');
y._travelTo = '广州府'; y._travelArrival = sandbox.GM.turn + 3;
tick(10);
assert(y._travelFrom === '蓟州·三屯营', '老档没记起点：补上');
const firstAt = y.location;
sandbox.GM.turn += 1; tick(10);
sandbox.GM.turn += 1; tick(10);
assert(y.location !== firstAt && y.location !== '广州府', '按回合算的老行程也一块块走');
sandbox.GM.turn += 1; tick(10);
assert(y.location === '广州府', '老行程到回合抵达');

sandbox.GM = world();
y = who('袁崇焕');
y._travelTo = '广州府'; y._travelFrom = y.location; y._travelRemainingDays = 5;
Object.defineProperty(sandbox.GM.mapData, 'regions', { get() { throw new Error('坏档'); } });
let threw = false;
try { tick(1); tick(10); } catch (_) { threw = true; }
assert(!threw, '坏地图不拖垮过回合');
assert(y.location === '广州府' && !y._travelTo, '坏地图也照常到期抵达，路上的字段清干净');
assert(sandbox.GM._turnReport.some((r) => r.type === 'travel_arrived'), '坏地图也写进回合报告');
threw = false;
y.location = '宁远';
try { sandbox._tmMoveCharToward(y, '保定府', ''); } catch (_) { threw = true; }
assert(!threw && y.location === '保定府', '坏地图下 AI 移动也不抛错');

console.log('七、每回合对齐绑定');
sandbox.GM = world();
y = who('袁崇焕');
y.location = '保定府';
sandbox.TMMapLocations.syncCharacters(sandbox.GM);
assert(y.regionId === 'r-bd', '对齐得上');
y.location = '开封府';
assert(y.regionId === 'r-bd', '有的地方写所在地不同步（关前提）');
tick(10);
assert(y.regionId === 'r-kf', '过一回合就对齐了');

if (failed) {
  console.log('FAIL smoke-character-region-travel: ' + failed + ' 处失败');
  process.exit(1);
}
console.log('PASS smoke-character-region-travel');
