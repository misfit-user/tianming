// smoke-capital-world.js — 三部官方剧本开局 GM._capital 为空，内核退回默认的「京城」
//
// 病根：只有原生开局写 _capital，官方剧本开局它是空的，四十多个内核文件都退回「京城」。
// 后果：晚唐长安同城的臣子被当远方；绍宋金国燕京、日本的「京」被当在京，写不了信。
// 修法：开局、读档都补真实京城（读本势力写的都城）；京师、宫中这些通称跟着当朝京城走；
// 行在、随驾跟着天子走（剧本 locationBindingContract 同此口径）；
// 书信、朱批、求见看玩家本人所在，因为绍宋开局玩家在亳州，京城却是应天府。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  PASS ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
}

const toasts = [];
const sandbox = { console, setTimeout, clearTimeout, TM: {}, P: {}, GM: {} };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.document = { getElementById: () => null, createElement: () => ({ style: {} }), addEventListener() {}, body: {} };
sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
sandbox.toast = (m) => toasts.push(String(m || ''));
sandbox.escHtml = (s) => String(s == null ? '' : s);
sandbox.getTSText = () => 'T';
sandbox.uid = () => 'id' + Math.random().toString(36).slice(2, 8);
sandbox.getCurrentGameDay = () => 100;
sandbox._getDaysPerTurn = () => 30;
sandbox.SettlementPipeline = { register() {} };
sandbox.findCharByName = (n) => (sandbox.GM.chars || []).find((c) => c && c.name === n) || null;
sandbox.renderLetterPanel = () => {};
vm.createContext(sandbox);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
vm.runInContext(read('tm-utils.js'), sandbox, { filename: 'tm-utils.js' });
sandbox._$ = () => null;
const located = read('tm-chaoyi.js').match(/function _getPlayerLocation\(\) \{[\s\S]*?\r?\n\}/);
assert(!!located, '取到内核 _getPlayerLocation');
vm.runInContext(located[0], sandbox);
vm.runInContext(read('tm-hongyan-office.js'), sandbox, { filename: 'tm-hongyan-office.js' });
sandbox.renderLetterPanel = () => {};

const same = (a, b) => sandbox._isSameLocation(a, b);
const world = (facFields, chars, extra) => Object.assign({
  playerInfo: { factionName: '本朝', factionLeader: '君主' },
  facs: [{ name: '敌国', capital: '敌都' }, Object.assign({ name: '本朝', isPlayer: true }, facFields)],
  chars: chars || [],
}, extra);

console.log('一、从剧本推京城');
const derive = (fields, chars) => sandbox._tmCapitalFromWorld(world(fields, chars), {});
assert(derive({ capital: '北京·紫禁城' }) === '北京', '天启：北京·紫禁城 两段是一处，留北京');
assert(derive({ capitalName: '京兆府·长安' }) === '京兆府·长安', '晚唐：京兆府·长安 是府与城，全留');
assert(derive({ capital: '应天府' }) === '应天府', '绍宋：应天府');
assert(derive({ capital: '沈阳（盛京·1625 努尔哈赤自辽阳迁都）' }) === '沈阳', '括注去掉');
assert(derive({ capital: '(已无)', capitalName: '' }, [{ name: '君主', location: '洛阳·紫微宫' }]) === '洛阳·紫微宫', '占位不算，退到君主所在');
assert(derive({}, [{ name: '君主', alive: false, location: '洛阳' }]) === '', '君主已死又没写都城：空着，内核退回默认');
assert(sandbox._tmCapitalFromWorld(world({ capital: '错的' }, [], { playerInfo: { capital: '对的' } }), {}) === '对的', '玩家身份写的都城优先');
assert(derive({ capital: '无' }) === '', '「无」不当都城');
assert(derive({ capital: '行在' }) === '', '行在不当都城，它跟着人走');

console.log('二、开局与读档补值');
const ensure = (g) => { sandbox._tmEnsureCapital(g, {}); return g; };
assert(ensure(world({ capital: '应天府' }))._capital === '应天府', '空值补上');
assert(ensure(Object.assign(world({ capital: '应天府' }), { _capital: '原生开局地' }))._capital === '原生开局地', '已有值不动（原生开局）');
assert(ensure(Object.assign(world({ capital: '应天府' }), { _capital: null, capital: '扬州' }))._capital === '扬州', '老档 AI 迁都只写过 GM.capital：以它为准');
assert(ensure(Object.assign(world({ capital: '应天府' }), { _capital: '应天府', capital: '扬州' }))._capital === '扬州', '老档 _capital 落后于 GM.capital：追上');
const hostile = { get facs() { throw new Error('坏档'); }, chars: [] };
let threw = false;
try { sandbox._tmEnsureCapital(hostile, {}); } catch (_) { threw = true; }
assert(!threw, '推京城出错不外抛，不拖垮存读档');
const twice = ensure(ensure(world({ capital: '应天府' })));
assert(twice._capital === '应天府' && twice.capital === undefined, '可重复调用，不多写字段');
assert(ensure(world({}))._capital === undefined, '什么都推不出：不写');
assert(/_tmEnsureCapital\(GM, P\)/.test(read('tm-save-lifecycle.js')), '_ensureGMDefaults 调它（读档、存档前都过这里）');
assert(/_tmEnsureCapital\(GM, P\)/.test(read('tm-patches-start.js')), 'doActualStart 标完玩家势力就调它');

console.log('三、没有京城时行为不变');
sandbox.GM = {};
assert(same('京师·文渊阁', '京城') && same('紫禁城·乾清宫', '京城') && same('顺天府', '京城'), '别名表照旧');
assert(!same('南京·户部', '京城'), '南京不算京城');

console.log('四、天启：京城是北京');
sandbox.GM = { _capital: '北京' };
assert(same('京师·文渊阁', '北京') && same('京师·紫禁城·乾清宫', '北京') && same('顺天府', '北京'), '宫内、衙门、顺天府都在京');
assert(!same('南京·户部', '北京') && !same('沈阳', '北京') && !same('辽东·宁远', '北京'), '外地不在京');
sandbox.GM = { _capital: '京师' };
assert(same('京师·文渊阁', '京师') && same('宫中', '京师'), '京城写成通称也不递归');

console.log('五、晚唐：京城是京兆府·长安');
sandbox.GM = { _capital: '京兆府·长安' };
assert(same('京兆府·长安', '京兆府·长安') && same('长安', '京兆府·长安'), '长安同城');
assert(same('京师', '京兆府·长安') && same('宫中', '京兆府·长安') && same('禁中·大明宫', '京兆府·长安') && same('京城', '京兆府·长安'), 'AI 写的通称认得');
assert(!same('河南府·洛阳', '京兆府·长安') && !same('魏州', '京兆府·长安'), '外地不在京');
assert(!same('紫禁城', '京兆府·长安') && !same('燕京', '京兆府·长安'), '别朝的实地不算');

console.log('六、绍宋：京城是应天府，玩家在亳州');
const courtChars = () => [
  { id: 'c1', name: '赵构', isPlayer: true, alive: true, location: '亳州·明道宫·九龙井侧' },
  { id: 'c2', name: '韩世忠', alive: true, location: '亳州·随驾' },
];
sandbox.GM = { _capital: '应天府', chars: courtChars(), mapData: { locationBindingContract: { courtCharacterId: 'c1' } } };
const atCourt = '亳州·明道宫·九龙井侧';
assert(same('行在', atCourt) && same('随驾', atCourt) && same('行在·随驾', atCourt) && same('亳州·随驾', atCourt), '行在、随驾跟着天子在亳州');
assert(!same('行在', '应天府') && !same('随驾', '应天府'), '行在不是京城');
assert(same('行在·应天府(南京)', '应天府') && same('应天府', '应天府'), '写明在应天府的在京');
assert(!same('行在·应天府(南京)', atCourt), '写明在应天府的不随驾');
assert(same('应天府（即将随南行扬州）', '应天府'), '括注不碍事');
sandbox.GM.chars[0].location = '扬州';
assert(same('行在', '扬州') && !same('行在', atCourt), '天子到扬州，行在跟到扬州');
sandbox.GM.chars[0].location = atCourt;
sandbox.GM = { _capital: '应天府', chars: courtChars() };
assert(same('行在', atCourt), '剧本没写契约：退到玩家所在');
sandbox.GM = { _capital: '应天府' };
assert(same('行在', '行在') && !same('行在', '应天府'), '世上没有天子可认：行在就是行在，不崩');
sandbox.GM = { _capital: '应天府', chars: courtChars(), mapData: { locationBindingContract: { courtCharacterId: 'c1' } } };
assert(!same('行在·福建', '应天府'), '行在后面写了实地，以实地为准');
assert(!same('燕京', '应天府') && !same('金国·燕京（北狩中）', '应天府'), '金国燕京不在京');
assert(!same('京', '应天府') && !same('京·内里', '应天府'), '日本的「京」不在京');
assert(!same('建康府', '应天府'), '建康府不是应天府');
assert(!same('亳州·随驾', '应天府'), '随驾亳州不在京');

console.log('七、书信看玩家本人所在');
// 走老面板的入口：新前端的传参接缝只在新前端分支上有，这条路两边都有
const send = (content, targets) => {
  sandbox.GM._ltMultiMode = true;
  sandbox.GM._ltMultiTargets = targets.slice();
  sandbox._$ = (id) => (id === 'letter-textarea' ? { value: content } : null);
  sandbox.sendLetter();
  sandbox._$ = () => null;
};
const shaosong = () => ({
  turn: 3, _capital: '应天府', letters: [], items: [],
  mapData: { locationBindingContract: { courtCharacterId: 'c1' } },
  chars: [
    { id: 'c1', name: '赵构', isPlayer: true, alive: true, location: '亳州·明道宫·九龙井侧' },
    { name: '韩世忠', alive: true, location: '亳州·随驾' },
    { name: '朱胜非', alive: true, location: '行在' },
    { name: '陈东', alive: true, location: '行在·应天府(南京)' },
    { name: '孟皇后', alive: true, location: '应天府（即将随南行扬州）' },
    { name: '鳥羽上皇', alive: true, location: '京' },
    { name: '时立爱', alive: true, location: '燕京' },
  ],
});
sandbox.P = { playerInfo: { characterName: '赵构' } };
sandbox.GM = shaosong();
assert(sandbox._ltHerePlace() === '亳州·明道宫·九龙井侧', '玩家不在京：写实地');
send('卿等听旨', ['韩世忠', '朱胜非', '陈东', '孟皇后', '鳥羽上皇', '时立爱']);
const to = sandbox.GM.letters.map((l) => l.to);
assert(!to.includes('韩世忠') && !to.includes('朱胜非'), '随驾、行在与天子同地：剔除，宜召对');
assert(to.includes('陈东') && to.includes('孟皇后'), '玩家在亳州：应天府的臣子能写信');
assert(to.includes('鳥羽上皇') && to.includes('时立爱'), '日本的京、金国燕京能写信');
assert(sandbox.GM.letters.every((l) => l.fromLocation === '亳州·明道宫·九龙井侧'), '信从亳州发出');

sandbox.GM = { turn: 3, _capital: '京兆府·长安', letters: [], items: [], chars: [
  { name: '李瀍', isPlayer: true, alive: true, location: '京兆府·长安' },
  { name: '李德裕', alive: true, location: '京兆府·长安' },
  { name: '何重顺', alive: true, location: '魏州' },
] };
sandbox.P = { playerInfo: { characterName: '李瀍' } };
assert(sandbox._ltHerePlace() === '京兆府·长安', '玩家在京：写京城名');
send('卿听旨', ['李德裕', '何重顺']);
assert(sandbox.GM.letters.map((l) => l.to).join() === '何重顺', '晚唐：长安同城剔除，魏州能写');
assert(sandbox.GM.letters[0].fromLocation === '京兆府·长安', '信从长安发出');

console.log('八、同省按主地点比');
sandbox.GM = { _capital: '北京', adminHierarchy: { player: { divisions: [
  { name: '北直隶', children: [{ name: '顺天府' }, { name: '保定府' }] },
  { name: '南直隶', children: [{ name: '应天府' }, { name: '苏州府' }] },
] } } };
assert(sandbox.calcLetterDays('京师·文渊阁', '保定府', 'normal') === 4, '京师到保定：同省四日');
assert(sandbox.calcLetterDays('北京', '保定府', 'normal') === 4, '北京到保定：同省四日');
assert(sandbox.calcLetterDays('北京', '苏州府', 'normal') === 20, '北京到苏州：跨省二十日');
assert(sandbox.calcLetterDays('南京·户部', '苏州府', 'urgent') === 1, '南京到苏州：同省加急一日');

console.log('九、迁都两个字段一起写');
assert(/G\._capital = params\.newCapital;\s*G\.capital = params\.newCapital;/.test(read('tm-edict-complete.js')), '迁都诏同写两字段');
assert(/GM\.capital = e\.newCapital;\s*GM\._capital = e\.newCapital;/.test(read('tm-endturn-apply-stages.js')), '推演 move_capital 同写两字段');
assert(/gm\.capital = cap;\s*gm\._capital = cap;/.test(read('tm-endturn-agent-write-tools.js')), 'relocate_capital 同写两字段');

if (failed) {
  console.log('FAIL smoke-capital-world: ' + failed + ' 处失败');
  process.exit(1);
}
console.log('PASS smoke-capital-world');
