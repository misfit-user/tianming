// 晚唐剧本·人物字段去伪（阶段三第四刀之一）
//
// 晚唐人物表每人真正写过的只有五六段文字：生平（bio，分「来历」background 与「处境」description 两段）、性格、个人志向、
// 辞令、内心独白。其余十来个字段是把这几段原样抄进去凑出来的，与天启、绍宋各写各的不同：
//   - 立场 stance、核心动机 coreMotivations、个人目标 personalGoals 都是个人志向的抄件；
//   - 价值观 valueSystem、行为模式 behaviorMode 是性格或志向的抄件；
//   - 压力源 stressSources 是「处境」段的抄件，台词 dialogues 是内心独白的抄件；
//   - 一批外藩人物的辞令 diction / speechStyle 是性格的抄件，description 与 bio 逐字相同；
//   - 仕途履历第一条是生平段落、日期写「此前」，记忆 _memory 第一条也是生平段落；
//   - 开局状态的履历条写「现状快照，不是任命日期；不据此反推任期」，虚构人物的来源写「作者虚构角色……」，
//     家属附注写「亲等见史料；未核生卒与在世状态」，籍贯写「此处不等于已证出生地」，史料前加「【史家资料，非人物记忆】」，
//     「官职校记」officeEvidenceNote 写「沿用现版」「不提前……」——这些是制作时的自我说明，图志里会原样显示给玩家。
// 抄件不是资料：立场里放志向，推演提示里「立场」就答非所问；压力源放整段处境，人物提示里同一段话出现两次。
// 更要紧的是 personalGoals：引擎要的是 {longTerm, shortTerm, priority, progress} 对象（tm-endturn-prompt 读 g.longTerm），
// 晚唐有 245 人写成字符串数组，推演提示里便成了「郑肃：undefined(0%)」，而且因为「已有目标」，AI 也不会替他们另立。
//
// 本补丁对全部人物：
//   1. 删抄件：valueSystem、behaviorMode、coreMotivations、dialogues 是抄件就删；stance 是志向抄件就清空（史实人物的真实立场在
//      人物一刀按史料另写）；stressSources 里生平已有的段落删去；与性格相同的辞令清空；与 bio 相同的 description 删去；
//      生平段落当作的履历条与记忆条删去；「开局状态」履历条删去（现任官职本就在 officialTitle）；经济配置里抄的处境段删去；
//      学识、文化等字段里误放的生平段落清空。
//   2. personalGoals 改为引擎要的对象：longTerm 取个人志向，shortTerm 与 longTerm 相同的清空，context 是生平段落的删去。
//   3. 去掉制作用语：fictionalSources、officeEvidenceNote 删去；史料去掉「【史家资料，非人物记忆】」前缀，删去「【时点待核】」
//      「【原文待核】」占位条；家属附注是套话的删去；籍贯、出生地只留地名；形貌、师承、学识去掉「未详」「不据此」一类说明。
//   4. 顶层 relations 的 desc 只是「甲与乙：类型」的，删去（类型本就在 type）。
//   5. 家产登记附注里的「尚待簿契查明」改为说明登记本身；刘从谏、张保皐两条附注按实物改。
// background（来历）与 description（处境）是 bio 的两段，各有读者（廷议读来历，经济引擎凭「进士」算贤能），保留。
// aiPersonaText 是这几段的汇编，专门的 NPC 子调用只读它，保留。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-people-fields.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');

const HEDGE_PREFIX = '【史家资料，非人物记忆】';
const PLACEHOLDER_SOURCE = /^【(时点待核|原文待核)】/;
const HEDGE_FAMILY_NOTE = /^亲等见史料；未核生卒与在世状态。?$/;
const SNAPSHOT_CAREER = /^现状快照，不是任命日期/;
// 误放了生平段落的短字段
const PROSE_SLOTS = ['learning', 'culture', 'hobbies', 'appearance', 'secret'];

const squash = (s) => String(s || '').replace(/\s+/g, '');
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);

// 籍贯、出生地：「籍贯：荥阳（籍贯；具体出生地点未详）；此处不等于已证出生地」→「荥阳」
function cleanBirthplace(text) {
  const m = String(text).match(/^(?:籍贯|出生地)：([^（；]+)/);
  return m ? m[1] : text;
}

// 形貌只有几条，逐条改：留下史传原话，去掉「具体五官未详」「不等于可精确复原肖像」一类说明；
// 金昕一条记的是退居起居（葛衣蔬食），不是形貌，清空
const APPEARANCE = {
  '史传记“狀纖頎，頗類帝”；具体五官与肤色未详。': '史传记其“狀纖頎，頗類帝”。',
  '《旧唐书》形容：“形狀眇小而精悍。”服饰、肤色与面部细节未详。': '《旧唐书》记其“形狀眇小而精悍”。',
  '《池上篇》自写“白須颯然”，是文学自述，不等于可精确复原肖像。': '《池上篇》自写“白須颯然”。',
  '退居生活史载“葛衣蔬食”；不据此捏造面貌。': ''
};

const ASSET_NOTES = {
  '共同取给的旧业，田亩范围尚待家中簿契查明。': '本房共同取给的旧业，本人可取给，不占产权份额。',
  '居用之处已知，产权与可售范围尚待本房簿契核明。': '本房居用的宅舍，不计入本人可售家产。',
  // 刘从谏：《新唐书》本传「榷馬牧及商旅，歲入錢五萬緡」
  '只列可辨私有货本；节镇榷取、军资与刘氏私业的界线尚须核清。': '刘氏经营的马牧与商旅货本。'
};
// 张保皐的海舶货股误用了作坊的附注（「工具与存料另册」）
const ASSET_NOTES_BY_NAME = { 清海私人海舶货股: '清海镇海舶贸易中的私人货股。' };

// 师承、学识：去掉括注的制作说明与「科第未详」一类分句
function stripHedges(text) {
  return String(text)
    .replace(/（[^）]*(未核|未详|不是|无据|不据此)[^）]*）/g, '')
    .split('；')
    .filter((part) => !/未详|不等于|不据此/.test(part))
    .join('；');
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const counts = {};
  const bump = (key) => { counts[key] = (counts[key] || 0) + 1; };
  const samples = {};
  const sample = (key, text) => { (samples[key] = samples[key] || []).length < 3 && samples[key].push(text); };

  scenario.characters.forEach((c) => {
    const bio = squash(c.bio);
    const inBio = (text) => !!text && bio.includes(squash(text));
    const goal = c.personalGoal || '';
    const personality = c.personality || '';

    // ---- 1. 抄件 ----
    ['valueSystem', 'behaviorMode'].forEach((key) => {
      if (key in c && (c[key] === personality || c[key] === goal || isEmpty(c[key]))) { delete c[key]; bump(key + ' 抄件删去'); }
    });
    if (c.stance && c.stance === goal) { c.stance = ''; bump('stance 志向抄件清空'); }
    if ('coreMotivations' in c && (c.coreMotivations || []).every((m) => m === goal)) { delete c.coreMotivations; bump('coreMotivations 抄件删去'); }
    if ('dialogues' in c) {
      c.dialogues = (c.dialogues || []).filter((d) => d !== c.innerThought);
      if (!c.dialogues.length) { delete c.dialogues; bump('dialogues 空或只有内心独白抄件，删去'); }
    }
    if (Array.isArray(c.stressSources) && c.stressSources.some(inBio)) {
      c.stressSources = c.stressSources.filter((s) => !inBio(s));
      bump('stressSources 生平段落删去');
    }
    if (c.diction && c.diction === personality) { c.diction = ''; bump('diction 性格抄件清空'); }
    if (c.speechStyle && c.speechStyle === personality) { c.speechStyle = ''; bump('speechStyle 性格抄件清空'); }
    if ('description' in c && c.description === c.bio) { delete c.description; bump('description 与 bio 相同删去'); }
    if (Array.isArray(c._memory) && c._memory.some((m) => inBio(m.event))) {
      c._memory = c._memory.filter((m) => !inBio(m.event));
      bump('_memory 生平段落删去');
    }
    if (Array.isArray(c.career)) {
      const kept = c.career.filter((e) => {
        if (e.date === '此前' && inBio(e.desc || e.note)) { bump('career「此前」生平条删去'); return false; }
        if (SNAPSHOT_CAREER.test(e.desc || '')) { bump('career「开局状态」条删去'); return false; }
        return true;
      });
      c.career = kept;
    }
    if (c.economyConfig && inBio(c.economyConfig.context)) { delete c.economyConfig.context; bump('economyConfig.context 生平段落删去'); }
    PROSE_SLOTS.forEach((key) => {
      if (typeof c[key] === 'string' && c[key].length > 20 && inBio(c[key])) { sample(key + ' 生平段落清空', c.name + '：' + c[key].slice(0, 30)); c[key] = ''; bump(key + ' 生平段落清空'); }
    });

    // ---- 2. personalGoals 改为引擎对象 ----
    if (Array.isArray(c.personalGoals)) {
      c.personalGoals = c.personalGoals.map((g, i) => {
        if (typeof g === 'string') {
          bump('personalGoals 字符串改对象');
          return { id: 'goal_' + (i + 1), type: 'custom', longTerm: g, shortTerm: '', progress: 0, priority: 5 };
        }
        if (g.shortTerm && g.shortTerm === g.longTerm) { g.shortTerm = ''; bump('personalGoals.shortTerm 抄件清空'); }
        if (g.context && inBio(g.context)) { delete g.context; bump('personalGoals.context 生平段落删去'); }
        return g;
      });
    }

    // ---- 3. 制作用语 ----
    if ('fictionalSources' in c) { delete c.fictionalSources; bump('fictionalSources 删去'); }
    if ('officeEvidenceNote' in c) { sample('officeEvidenceNote 删去', c.name + '：' + c.officeEvidenceNote); delete c.officeEvidenceNote; bump('officeEvidenceNote 删去'); }
    if (Array.isArray(c.historicalSources)) {
      c.historicalSources = c.historicalSources
        .filter((h) => { if (PLACEHOLDER_SOURCE.test(h)) { bump('historicalSources 待核占位条删去'); return false; } return true; })
        .map((h) => { if (h.startsWith(HEDGE_PREFIX)) { bump('historicalSources 前缀去掉'); return h.slice(HEDGE_PREFIX.length); } return h; });
    }
    (c.familyMembers || []).forEach((f) => { if (HEDGE_FAMILY_NOTE.test(f.note || '')) { delete f.note; bump('familyMembers 套话附注删去'); } });
    if (c.birthplace && /^(籍贯|出生地)：/.test(c.birthplace)) {
      const cleaned = cleanBirthplace(c.birthplace);
      sample('birthplace 只留地名', c.birthplace + ' → ' + cleaned);
      c.birthplace = cleaned; bump('birthplace 只留地名');
    }
    if (c.appearance && c.appearance in APPEARANCE) {
      sample('appearance 去说明', c.appearance + ' → ' + APPEARANCE[c.appearance]);
      c.appearance = APPEARANCE[c.appearance]; bump('appearance 去说明');
    }
    ['mentor', 'learning'].forEach((key) => {
      if (typeof c[key] === 'string' && /未详|未核|不等于|不据此|无据|不是/.test(c[key])) {
        const cleaned = stripHedges(c[key]);
        sample(key + ' 去说明', c[key] + ' → ' + cleaned);
        c[key] = cleaned; bump(key + ' 去说明');
      }
    });
  });

  // ---- 4. 顶层关系的套写说明 ----
  (scenario.relations || []).forEach((r) => {
    if (r.desc === r.from + '与' + r.to + '：' + r.type) { delete r.desc; bump('relations desc「甲与乙：类型」删去'); }
  });

  // ---- 5. 家产登记的附注 ----
  // 「本房共业」「本房所居宅舍」是本人有取给或居住之权、不占产权份额（ownershipShare 0）的登记，结构是引擎的；
  // 附注却写「尚待家中簿契查明」，改为说明这条登记本身。其余两条附注与实物不符或是待核说明，逐条改。
  ((scenario.characterEconomyConfig || {}).assets || []).forEach((a) => {
    if (a.note in ASSET_NOTES) { a.note = ASSET_NOTES[a.note]; bump('家产附注改写'); }
    else if (a.name in ASSET_NOTES_BY_NAME) { a.note = ASSET_NOTES_BY_NAME[a.name]; bump('家产附注改写'); }
  });

  const report = ['# 晚唐·人物字段去伪报告', '',
    '晚唐 ' + scenario.characters.length + ' 名人物里，多数字段是把生平、性格、志向、辞令、内心独白原样抄进去凑出来的，另有制作时的自我说明直接写在图志字段里。' +
      '本补丁删去抄件与制作用语，把 personalGoals 改为引擎要的对象。数字、生平正文一概不动。', '',
    '| 处理 | 处数 |', '| --- | --- |',
    ...Object.keys(counts).map((k) => '| ' + k + ' | ' + counts[k] + ' |'), '',
    '## 样例', '',
    ...Object.keys(samples).flatMap((k) => ['- ' + k + '：', ...samples[k].map((t) => '  - ' + t)])];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
