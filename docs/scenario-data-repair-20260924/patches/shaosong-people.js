// 绍宋剧本·人物时代错误修正（阶段二人物部分第二步）
//
// 开局是建炎元年八月（1127）。原账有人此时已死、身在别处、官职是后来才授的，或把两个人写成一个、一个人写成两个。
// 这里逐人改正：生死、所在地、在场状态、当时官职，以及与之矛盾的简介、扮演提示、履历、关系与势力文字。
// 每条都注明依据；拿不准的不改，列在报告末尾待核。
// 人名改动（重名或借用古人名的虚构人物）在全剧本范围替换，地图（map/mapData）不动。
// 地点改动后按运行时同一套规则（web/tm-map-locations.js）重算人物的地块绑定。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/shaosong-people.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '绍宋·建炎元年八月（官方）.json');
const LOCATIONS_JS = path.join(REPO, 'web', 'tm-map-locations.js');

// ---------- 工具 ----------

// 把对象里所有字符串中的 from 换成 to，返回换了几处
function deepSwap(obj, from, to) {
  let count = 0;
  (function walk(o) {
    Object.keys(o).forEach((k) => {
      const v = o[k];
      if (typeof v === 'string') {
        if (v.includes(from)) { o[k] = v.split(from).join(to); count++; }
      } else if (v && typeof v === 'object') walk(v);
    });
  })(obj);
  return count;
}

// 全剧本（地图除外）改名
function renameEverywhere(scenario, from, to) {
  let count = 0;
  Object.keys(scenario).forEach((key) => {
    if (key === 'map' || key === 'mapData') return;
    const v = scenario[key];
    if (typeof v === 'string') {
      if (v.includes(from)) { scenario[key] = v.split(from).join(to); count++; }
    } else if (v && typeof v === 'object') count += deepSwap(v, from, to);
  });
  return count;
}

function charByName(scenario, name) {
  const c = scenario.characters.find((x) => x.name === name);
  if (!c) throw new Error('人物表里没有 ' + name);
  return c;
}

function swapIn(c, pairs) {
  pairs.forEach(([from, to]) => {
    if (!deepSwap(c, from, to)) throw new Error(c.name + ' 的文字里找不到「' + from + '」，原账已变，先核对');
  });
}

function replaceMatch(c, field, re, to) {
  if (!re.test(c[field])) throw new Error(c.name + '.' + field + ' 不匹配 ' + re);
  c[field] = c[field].replace(re, to);
}

// 已殁人物的统一写法（与原账种师道、种师中一致）
function markDead(c, fields) {
  Object.assign(c, { alive: false, active: false, location: '(已殁)' }, fields);
}

function removeRelations(scenario, pairs) {
  const before = scenario.relations.length;
  scenario.relations = scenario.relations.filter((r) => !pairs.some(([a, b]) => r.from === a && r.to === b));
  const removed = before - scenario.relations.length;
  if (removed !== pairs.length) throw new Error('人物关系应删 ' + pairs.length + ' 条，实删 ' + removed + ' 条');
}

// ---------- 逐人修正 ----------
// 每项：name（改后的名字）、what（改了什么）、source（依据）、apply(c, scenario)

const FIXES = [
  {
    name: '完颜宗望',
    what: '已殁：天会五年（1127）六月病卒，开局时已不在；东路军与所领党派改由其弟、继任右副元帅完颜宗辅统领',
    source: '《金史·宗望传》《金史·宗辅传》；本剧本大金势力 _membershipNote 与外部势力大事记原已写明宗望六月病死',
    apply(c, scenario) {
      markDead(c, {
        officialTitle: '故·右副元帅(斡离不)',
        role: '金军主帅(已殁)',
        stance: '东路主帅·天会五年六月病殁',
        bio: '金太祖第二子，本名斡离不，国人号"二太子"。以右副元帅统东路军两入汴京，掳徽钦北去，略定河北，威震南朝。天会五年（建炎元年，1127）六月病殁军中，年四十；东路兵柄归其弟宗辅（讹里朵）。',
        innerThought: '（临终之念）' + c.innerThought,
        aiPersonaText: '你扮演完颜宗望——已殁。你本金太祖第二子，女真名斡离不，国人号"二太子"，以右副元帅统东路军两入汴京、掳徽钦二帝北去，略定河北，威震南朝。天会五年（建炎元年）六月你病殁军中，年四十，东路兵柄归于弟宗辅。你已不能再有所行动，唯余威名、东路旧部与燕云汉臣之遗绪，影响金廷南侵方略。'
      });
      const troop = scenario.military.initialTroops.find((t) => t.name === '金东路军(斡离不)');
      if (!troop) throw new Error('找不到金东路军(斡离不)');
      Object.assign(troop, { name: '金东路军(讹里朵)', commander: '完颜宗辅', commanderTitle: '金·右副元帅' });
      const party = scenario.parties.find((p) => p.leader === '完颜宗望');
      if (!party) throw new Error('找不到宗望领衔的党派');
      party.leader = '完颜宗辅';
      party.leadership.chief = '完颜宗辅 (右副元帅·讹里朵·宗望殁后继掌东路)';
      scenario.classes.forEach((k) => {
        const list = k.representativeNpcs;
        if (!Array.isArray(list) || !list.includes('完颜宗望')) return;
        k.representativeNpcs = list.includes('完颜宗辅') ? list.filter((n) => n !== '完颜宗望') : list.map((n) => (n === '完颜宗望' ? '完颜宗辅' : n));
      });
    }
  },
  {
    name: '耶律南仙',
    what: '已殁：宣和七年（夏元德七年，1125）辽亡，所生太子仁爱悲愤而卒，南仙亦绝食死；原账误把曹妃所生的仁孝记为她的儿子',
    source: '《西夏书事》卷三十三；本剧本李乾顺亲属表原已写明仁爱为成安公主所出、仁孝为曹妃所出',
    apply(c, scenario) {
      markDead(c, {
        officialTitle: '故·西夏崇宗后（辽成安公主）',
        role: '西夏皇后(已殁)',
        stance: '辽亡之岁绝食而殁',
        bio: '辽宗室女，封成安公主，夏贞观五年（1105）下嫁崇宗李乾顺，生嫡长子仁爱，立为太子。夏元德七年（宋宣和七年，1125）辽亡，仁爱悲愤而卒，南仙亦绝食而死。',
        innerThought: '（临终之念）故国已墟，吾儿仁爱又悲愤而殁，此身更何所恋？唯愿夏国不为金人所吞，契丹之血不绝于人间。',
        secret: '',
        aiPersonaText: '你扮演耶律南仙——已殁。你本辽宗室之女，封成安公主，下嫁西夏崇宗李乾顺以结辽夏之好，生嫡长子仁爱。宣和七年（夏元德七年，1125）辽亡，仁爱悲愤而卒，你亦绝食而死。你已不能再有所行动，唯余辽夏旧姻之名，与契丹遗民复辽之念相系。',
        career: [
          { year: 1105, title: '辽成安公主（下嫁夏国）', note: '辽帝以宗女封成安公主，下嫁夏崇宗李乾顺，以固辽夏之好。' },
          { year: 1125, title: '辽亡·绝食而殁', note: '辽为金所灭，太子仁爱悲愤而卒，南仙绝食死。' }
        ]
      });
      removeRelations(scenario, [['李乾顺', '耶律南仙'], ['耶律南仙', '李乾顺'], ['耶律南仙', '萧合达'], ['萧合达', '耶律南仙']]);
      const force = scenario.externalForces.find((f) => (f.keyFigures || []).includes('耶律南仙'));
      force.keyFigures = force.keyFigures.filter((n) => n !== '耶律南仙');
      const husband = charByName(scenario, '李乾顺');
      husband.familyMembers.forEach((m) => {
        if (m.name === '耶律南仙') Object.assign(m, { dead: true, note: '辽成安公主·嫡长子仁爱生母·元德七年辽亡绝食而殁' });
        if (m.name === '李仁爱') Object.assign(m, { dead: true, note: '嫡长子·成安公主所出·元德七年辽亡悲愤而卒' });
      });
    }
  },
  {
    name: '野利守礼',
    what: '改名：原名「野利仁荣」是元昊时创制西夏文字的名臣（1042 年卒），此人是职能虚构的崇宗朝御史，借用古人全名；改为不与史载人物重名的名字，身份与文字不变',
    source: '《宋史·夏国传》记野利仁荣卒于庆历二年；原账此人标注为职能虚构',
    rename: ['野利仁荣', '野利守礼']
  },
  {
    name: '拉喇嘛·索南沃',
    what: '改名：原名「绛求沃」即菩提光（Byang chub \'od），十一世纪迎请阿底峡的古格僧王，1127 年早已不在；原账此人是虚构的在位僧王，扮演提示里还把菩提光当作前代先人。改为不与史载人物重名的名字，党派名随改',
    source: '古格王统：益西沃、菩提光、希瓦沃三代拉喇嘛，均在十一世纪至 1111 年间；原账此人标注为虚构',
    rename: ['绛求沃', '索南沃']
  },
  {
    name: '信班他古',
    what: '换成史载人物：原名「信阿罗汉」（Shin Arahan）是劝阿奴律陀皈依上座部的国师，1115 年圆寂；1127 年在位的蒲甘僧伽之长、阿朗悉都王之师是继任的信班他古（Shin Panthagu）。原账此人是虚构，现改为史载人物',
    source: '缅甸编年史（《琉璃宫史》）：信阿罗汉 1115 年圆寂，班他古继为国师，阿朗悉都朝在任',
    rename: ['信阿罗汉', '信班他古'],
    apply(c) {
      Object.assign(c, { isFictional: false, isHistorical: true, type: 'historical' });
      swapIn(c, [['孟人(史料无具名,姑以虚构当之)', '信阿罗汉圆寂(1115)后继为僧伽之长']]);
      replaceMatch(c, 'aiPersonaText', /你是蒲甘王朝的一位上座部僧伽长老,孟人出身。\(你的名姓史料无征[^)]*\)/,
        '你是蒲甘王朝的上座部僧伽之长信班他古。(史载先师信阿罗汉于1115年圆寂后,由你继为蒲甘国师,为阿朗悉都王所敬礼;你所承之法统,以孟僧阿利安达长老自直通启阿奴律陀之心为源。)');
      swapIn(c, [['孟人出身,少入僧伽', '少入僧伽']]);
    }
  },
  {
    name: '任氏(仁宗妃)',
    what: '身份改正：恭睿太后任氏是仁宗的王妃（定安任氏，任元厚之女，1109 年生），仁宗四年李资谦所进二女被废后纳为妃，日后生毅宗、明宗、神宗；原账把她写成仁宗生母、李资谦之女、年近五旬——那是 1118 年已故的顺德王后李氏。名字里的「恭睿太后」是日后尊号，改为当时身份',
    source: '《高丽史·后妃传》恭睿太后任氏、顺德王后李氏条',
    rename: ['任氏(恭睿太后)', '任氏(仁宗妃)'],
    apply(c, scenario) {
      Object.assign(c, {
        age: 18,
        officialTitle: '高丽·王妃',
        role: '高丽王妃·定安任氏之女',
        stance: '李资谦败后新纳之妃·谦抑自守',
        personality: '端淑谦抑·识大体',
        bio: '高丽仁宗之妃任氏，定安人，中书令任懿之孙、任元厚之女。仁宗四年（1126）李资谦败，资谦所进二女（仁宗之姨）皆废，乃纳任氏为妃，时年十八。宫阙新经焚毁，王权初复，王妃居宫闱，谦抑自守，以安王室为念；日后生毅宗、明宗、神宗，尊为恭睿太后。',
        innerThought: '李氏之祸方息，宫阙焚余未复，我以新妃入宫，一举一动皆在人眼中。前二妃皆以外家之祸见废，我当谦抑自守、奉主上以安王室，方不负任氏门楣。',
        secret: '深知前二妃皆以外家之祸见废，常惧母家任氏他日亦为人所忌，故约束亲族、不敢稍露干政之意。',
        aiPersonaText: '你是高丽仁宗王楷之妃任氏，定安人，中书令任懿之孙、任元厚之女，年方十八。去岁（仁宗四年）权臣李资谦作乱，焚宫犯阙，乱平之后，李资谦所进二女（论辈分本是仁宗之姨）皆被废黜，你由是入宫为妃。你深知前二妃皆以外家之祸见废，故处处谦抑自守，约束母家，不预外政，唯以奉主上、安宫闱、缮王室为念。你端淑而识大体，说话温婉得体，论事多劝主上持重守成、调和庙堂诸派，而不涉朝政细务。你日后将生毅宗、明宗、神宗三王，尊为恭睿太后；此刻你仍是初入宫闱、步步谨慎的年轻王妃。',
        dialogues: [
          '前二位娘娘皆以外家之祸见废，妾入宫以来，一日不敢忘此前车之鉴。',
          '宫阙焚余，百废待兴。妾惟愿主上保重圣躬，缓缓收拾，毋急于一时。',
          '妾母家任氏，蒙主上恩眷，已属非分；外朝之事，妾不敢与闻。',
          '事大也好，西京也罢，但求主上持重守成，王氏宗社得安。'
        ],
        _memory: [
          { event: '去岁李资谦作乱焚宫·乱平后二妃皆废·我以定安任氏之女入宫为妃', emotion: '平', weight: 7, importance: 7, turn: 0 },
          { event: '前二妃皆以外家之祸见废·我当约束母家、谦抑自守', emotion: '忧', weight: 8, importance: 8, turn: 0 },
          { event: '宫阙焚余未复·王权初复·我惟以安宫闱、奉主上为念', emotion: '忍', weight: 7, importance: 7, turn: 0 }
        ],
        _scars: [],
        coreMotivations: ['奉主上、安宫闱，助王室于乱后收拾', '约束母家任氏，不蹈李氏外戚之覆辙', '劝主上持重守成，调和庙堂事大与西京之争'],
        personalGoal: '奉主上安宫闱·约束母家不蹈外戚之覆辙·劝主上持重守成',
        stressSources: ['前二妃以外家之祸见废之鉴', '初入宫闱步步谨慎', '宫阙焚余未复', '恐母家为人所忌'],
        redLines: ['绝不容母家假宫闱之势干预朝政', '绝不容任何危及主上与王室宗社之事'],
        personalGrudges: [],
        appearance: '年方十八的王妃，仪容端雅，举止谦婉自抑，眉目间有初入宫闱的谨慎。',
        speechStyle: '温婉得体、谦抑自守，论事多劝持重守成、安王室。',
        valueSystem: '以奉主上、安王室为最高，约束外家、不预外政。',
        behaviorMode: '居宫闱谦抑自守，约束母家，不预外政，唯于宫闱之内默助主上。',
        familyMembers: [
          { name: '任元厚', relation: '父', note: '定安任氏·中书令任懿之子', title: '高丽重臣', generation: -1, dead: false, inLaw: false, zi: '' },
          { name: '王楷', relation: '夫', note: '高丽仁宗·去岁乱平后纳吾为妃', title: '高丽仁宗', generation: 0, dead: false, inLaw: true, zi: '' }
        ],
        career: [
          { year: 1109, title: '生于定安任氏', note: '中书令任懿之孙、任元厚之女' },
          { year: 1126, title: '入宫为仁宗妃', note: '李资谦败，所进二女皆废，乃纳任氏为妃' }
        ]
      });
      // 所领党派：原名「王太后系」，而 1127 年高丽并无王太后在世；改为以平乱近臣为首的王室宗亲一系
      const party = scenario.parties.find((p) => p.name === '王室宗亲·王太后系' && p.faction === '高丽');
      if (!party) throw new Error('找不到高丽王室宗亲·王太后系');
      if (!renameEverywhere(scenario, '王室宗亲·王太后系', '王室宗亲·近臣系')) throw new Error('党派改名未生效');
      Object.assign(party, {
        leader: '崔思全',
        status: '调护 (王权初复、宫室焚毁，近臣与王氏宗亲护持王权、调和庙堂诸派)',
        ideology: '护王氏社稷·固王权·调和事大自主之争·重宗庙正统·缮治焚毁宫室',
        desc: '以仁宗亲信近臣崔思全、金粲为枢的王氏王室宗亲一系。仁宗四年（1126）李资谦之乱，崔思全说降拓俊京、擒资谦，王权始复；资谦所进二女（仁宗之姨）既废，仁宗纳定安任氏为妃。今宫阙新经焚毁、王权扫地之后初复，此系不专主事大或西京，重在护王权、缮宫室（延庆宫焚后重建）、调和庙堂事大与西京两派之争、维王氏宗庙正统。',
        currentAgenda: '护仁宗王权·缮治焚毁王宫·调和事大西京之争·安顿庆源李氏外戚之善后·维王氏正统',
        members: '崔思全·金粲·任氏(仁宗妃)·王氏宗亲诸王',
        leadership: { chief: '崔思全 (内医·平乱功臣)', deputy: '金粲 (内侍近臣)', spokesman: '（王氏宗亲诸王）' }
      });
      // 仁宗亲属、关系与相关党派阶层的文字：生母是已故的顺德王后李氏，任氏是妃
      const king = charByName(scenario, '王楷');
      const at = king.familyMembers.findIndex((m) => m.name === '任氏(仁宗妃)');
      if (at < 0) throw new Error('王楷亲属表里找不到任氏');
      king.familyMembers.splice(at, 1,
        { name: '顺德王后李氏', relation: '母', note: '睿宗妃·李资谦次女·睿宗十三年(1118)已薨', title: '高丽顺德王后', generation: -1, dead: true, inLaw: false, zi: '' },
        { name: '任氏(仁宗妃)', relation: '妻', note: '定安任氏·任元厚之女·去岁乱平后纳为妃', title: '高丽王妃', generation: 0, dead: false, inLaw: true, zi: '' });
      swapIn(king, [['凡决断必托于群臣廷议与太后之意', '凡决断必托于群臣廷议']]);
      const toQueen = scenario.relations.find((r) => r.from === '王楷' && r.to === '任氏(仁宗妃)');
      Object.assign(toQueen, { type: '夫妻·乱后新纳', desc: '任氏定安任氏之女·李资谦所进二妃既废·乱平后纳为妃·谦抑自守、约束母家·朕敬重之。' });
      const toKim = scenario.relations.find((r) => r.from === '任氏(仁宗妃)' && r.to === '金富轼');
      Object.assign(toKim, { type: '王妃敬重·事大守成', desc: '任氏愿主上持重守成·敬金富轼等事大老成之臣安定宗社·不喜妙清谶纬北伐之浮躁。' });
      swapIn(scenario.parties.find((p) => p.name === '外戚庆源李氏余绪'), [['然仁宗生母恭睿太后任氏实为李资谦之女,外戚血脉犹系王室;王室既清算资谦之党,又须安抚太后一系',
        '然仁宗生母顺德王后本李资谦之女(睿宗十三年已薨),外戚血脉犹系王室;王室既清算资谦之党,又须顾念先王后母家']]);
      swapIn(scenario.classes.find((k) => k.name === '王室宗亲' && /王楷/.test(k.description)), [['生母恭睿太后任氏(李资谦之女)护持。宗室诸王、王太后系为王权之倚。',
        '赖近臣崔思全、金粲护持,乱后新纳定安任氏为妃。宗室诸王、近臣系为王权之倚。']]);
    }
  },
  {
    name: '李阳焕',
    what: '身份改正：1127 年八月李阳焕仍是皇太子（崇贤侯之子，仁宗李乾德无子，育为嗣），仁宗是年十二月才崩；原账职衔写皇太子，简介与扮演提示却写成已即位的「仁宗」「父神宗早崩」，把庙号也弄反了（李乾德是仁宗，李阳焕日后是神宗）',
    source: '《大越史记全书》李纪：仁宗天符庆寿元年（1127）十二月崩，皇太子阳焕即位，是为神宗',
    apply(c) {
      Object.assign(c, {
        officialTitle: '大越·皇太子',
        role: '大越储君',
        stance: '大越储君·仁宗年高将嗣位',
        bio: '大越李朝皇太子，崇贤侯之子。仁宗李乾德年高无子，育为嗣子，立为皇太子。今仁宗春秋已高，储君年方十一，不久将嗣大位（史称神宗）。',
        innerThought: '父皇年高多病，太傅们说孤不久便要坐上那大殿。殿上臣子说的话，孤一半也听不大懂。北边大宋打仗，离升龙好远好远，与孤何干？孤只盼听话，将来做个不失祖业的好皇帝。等孤长大了，是不是就能自己拿主意了呢……',
        aiPersonaText: '你扮演大越李朝皇太子李阳焕，年方十一。你本崇贤侯之子，仁宗李乾德年高无子，育你为嗣、立为皇太子。今仁宗春秋已高、多病，你不久将嗣大位（史称神宗），届时辅政的太尉刘庆覃等重臣与宫中长辈将替你秉政。你天性聪敏而怯懦，凡有问对，必先看父皇与辅臣的颜色而后言，自家全无主张。你深居东宫，于北朝宋金鼎革之变所知甚浅，只隐约听闻"北方大国互相攻杀"，于你而言遥远如传闻。大越自尊为南天之主，奉宋正朔受其郡王之封，然山川阻隔、自守南疆，对中朝变乱并无切肤之痛。你言语稚气，常以孩童心性发问，而太傅每以"祖宗成法"相规。你最大的本分，是谨守东宫、勿失祖业。',
        dialogues: [
          '太傅，北边那个大宋……当真叫人掳了两个皇帝去么？那……他们的新皇帝，也似孤这般小么？',
          '父皇说的，孤都依。诸卿有事，且去奏过父皇与太尉。',
          '孤年幼，不晓兵戈。只盼南疆无事，占城莫来扰我边民，孤便心安了。',
          '祖宗基业将来要交到孤手里，万不可失。这话，是太傅日日教孤念的。'
        ],
        _memory: [
          { event: '父皇年高多病·太傅说我不久便要坐那么大的殿·臣子的话一半听不懂', emotion: '惧', weight: 7, turn: 0, importance: 7 },
          { event: '我本崇贤侯之子·父皇无子育我为嗣·只盼做个不失祖业的好皇帝', emotion: '慨', weight: 7, turn: 0, importance: 7 },
          { event: '北边打仗离升龙好远好远·与我何干', emotion: '疑', weight: 6, turn: 0, importance: 6 },
          { event: '等我长大了·是不是就能自己拿主意了呢', emotion: '慨', weight: 6, turn: 0, importance: 6 }
        ],
        coreMotivations: ['谨守东宫、不失李朝祖业，做父皇与辅臣期许的乖顺储君', '保南疆安宁，弭占城、真腊之边患', '在父皇与太傅教导下渐渐长成，习祖宗成法'],
        personalGoal: '谨守东宫不失李朝祖业·在父皇与辅臣教导下渐长习祖宗成法·保南疆弭占城真腊边患',
        stressSources: ['冲龄将嗣大位', '须顺父皇辅臣之命', '南疆占城真腊边患', '不敢轻动兵戈', '祖业成法待习'],
        redLines: ['绝不违逆父皇与辅政重臣之命', '绝不轻动兵戈以致动摇南疆自守之局'],
        appearance: '总角稚童，身着储君冠服，端坐时常下意识望向父皇与太傅。',
        speechStyle: '稚气天真，多发孩童之问，凡事称"依父皇""问太傅"，全无定见。',
        valueSystem: '孝顺父皇、谨守祖法即为本分，社稷大计自有长辈裁断。',
        behaviorMode: '谨守东宫、唯命是从，遇事先察父皇辅臣意旨，绝不自专。',
        career: [
          { year: 1116, title: '生', note: '崇贤侯之子' },
          { year: 1117, title: '立为皇太子', note: '仁宗李乾德无子，育为嗣子，立为皇太子' },
          { year: 1127, title: '储君', note: '仁宗春秋已高，储君将嗣大位；南疆自守不预北事' }
        ]
      });
    }
  },
  {
    name: '任得敬',
    what: '势力改正：任得敬此时是宋西安州通判，绍兴七年（1137）西夏陷西安州才出降、以女进崇宗；原账把十年后的降夏权臣身份提前到开局。改属西军（关陕），人在西安州，文字改写为守边佐官，降夏专权作为史载伏笔保留；删去四条以降夏后身份写成的关系',
    source: '《宋史·夏国传》；《西夏书事》卷三十五',
    apply(c, scenario) {
      Object.assign(c, {
        faction: '西军（关陕）',
        factionId: 'fac_xijun',
        party: '',
        officialTitle: '西安州通判',
        role: '宋臣·西安州通判',
        stance: '守边佐官·心无定主（史载后降夏专权）',
        location: '原州·西安州',
        bio: '宋西安州通判，佐守泾原路西北边州。北宋既亡，关陕孤悬，朝廷号令难及，得敬身处宋夏之交，心无定主。史载绍兴七年（1137）西夏陷西安州，得敬出降，以女进崇宗，后专夏国之政、几裂土自立。',
        innerThought: '二圣北狩，新君远在江淮，关陕孤悬、朝廷号令几不能及。守这西安州，西有夏人、东有金骑，忠义二字，乱世里值几文钱？且看风色——谁能保我身家，我便为谁效力。',
        secret: '守边之心不坚，早存择主而事之念；夏人若来，未必死守。',
        aiPersonaText: '你是任得敬，三十五岁，宋西安州通判，佐守泾原路西北边州。北宋已亡，二帝北狩，新君远在江淮，关陕诸军各自为战、朝廷号令难及，你身处宋、夏、金三方之交。你智深而政熟，工于钻营、长于权术，不以一姓为忠，惟以势利为归；表面恪守臣节、勤于州务，心里却时时掂量：宋若不能庇你，你何必为其殉。你说话从容深沉，含而不露，待人接物绵里藏针。史载你日后（绍兴七年）于西夏攻陷西安州时出降，以女进西夏崇宗、凭裙带骤贵，终专夏国之政、几裂土自立；此刻这一切尚未发生，你仍是宋朝一介边州佐官，野心深藏未露。扮演时要演出一个守边佐官的精明与摇摆：遇事先算利害，对朝廷恭顺而少担当，对夏人既防且留后路。',
        dialogues: [
          '良禽择木而栖。然眼下某仍食宋禄，守好这西安州，便是本分。',
          '关陕孤悬，朝廷远在江淮，粮饷不继——某不过一州佐官，能做的，只是保全城中身家。',
          '夏人近在咫尺，与其结怨，不如留一线余地。',
          '为臣之道，进退须有分寸；乱世之中，先得活下去，才谈得上忠义。'
        ],
        _memory: [
          { event: '二圣北狩·新君远在江淮·关陕孤悬·朝廷号令难及', emotion: '疑', weight: 8, turn: 0, importance: 8 },
          { event: '我佐守西安州·西有夏人东有金骑·城中身家性命系于我手', emotion: '忧', weight: 8, turn: 0, importance: 8 },
          { event: '忠义二字乱世里值几文钱·谁能保我身家我便为谁效力', emotion: '贪', weight: 8, turn: 0, importance: 8 },
          { event: '野心不可早露·露则身死', emotion: '疑', weight: 9, turn: 0, importance: 9 }
        ],
        _scars: [],
        coreMotivations: ['保全身家性命与西安州城中家业', '于宋夏金三方之间审时度势、择强而附', '伺机攫取更大权柄，不甘久居边州佐官'],
        personalGoal: '保全身家·于宋夏金之间审时度势择强而附·伺机攫取更大权柄',
        stressSources: ['关陕孤悬朝廷号令难及', '西夏近在咫尺', '金骑窥陕', '边州粮饷不继', '野心不可早露'],
        redLines: ['不为已无力庇护之朝廷白白殉死', '不容他人夺其身家根本'],
        personalGrudges: [],
        appearance: '宋朝青袍佐官，面相沉静，目光深沉内敛，举止从容而藏锋。',
        behaviorMode: '表面恪守臣节、勤于州务，暗中审时度势、预留后路，野心深藏不轻露。',
        familyMembers: [
          { name: '任氏', relation: '女', note: '尚幼·待字闺中（史载后进西夏崇宗为妃，立为后）', title: '', generation: 1, dead: false, inLaw: false, zi: '' }
        ],
        career: [
          { year: 1127, title: '宋西安州通判', note: '北宋亡后关陕孤悬，佐守西安州（史载绍兴七年城陷降夏，以女进崇宗，后专夏政）' }
        ]
      });
      removeRelations(scenario, [['李乾顺', '任得敬'], ['任得敬', '李乾顺'], ['任得敬', '察哥'], ['野利守礼', '任得敬']]);
      // 西夏势力：任得敬作为「他日降人」的伏线保留（smoke 也要求夏国 AI 提示提到他），但不再写成夏国现任之臣
      const xia = scenario.factions.find((f) => f.id === 'fac_xixia');
      xia.partyRelations['宋降人与外来军官'].leader = '萧合达';
      swapIn(xia, [
        ['防任得敬等降人坐大', '防宋降人坐大'],
        ['任得敬是中长期权臣隐患', '宋西安州通判任得敬一类边吏（史载日后降夏）是中长期权臣隐患'],
        ['任得敬等降人和新附寨户坐大', '宋降人和新附寨户坐大'],
        ['任得敬伏线', '宋降人坐大之伏线']
      ]);
      const force = scenario.externalForces.find((f) => (f.keyFigures || []).includes('任得敬'));
      force.keyFigures = force.keyFigures.filter((n) => n !== '任得敬');
      swapIn(force, [['察哥军权与任得敬隐患', '察哥军权与宋降人坐大之隐患']]);
      const family = scenario.families.find((f) => f.founder === '任得敬');
      Object.assign(family, {
        name: '任氏·西安州', tier: 'gentry', prestige: 30, ancestralSeat: '西安州',
        desc: '宋西安州通判任得敬之家。史载绍兴七年（1137）西夏陷西安州，得敬出降，以女进崇宗为后，骤贵用事，西夏外戚干政之渐自此始。'
      });
    }
  },
  {
    name: '完颜宗磐',
    what: '去重：「完颜蒲鲁虎」就是完颜宗磐（本名蒲鲁虎，太宗长子），原账把一个人写成两人；删去泛写的「完颜蒲鲁虎」一条及其一条关系，保留完颜宗磐',
    source: '《金史·宗磐传》：宗磐本名蒲鲁虎，太宗长子',
    apply(c, scenario) {
      const index = scenario.characters.findIndex((x) => x.name === '完颜蒲鲁虎');
      if (index < 0) throw new Error('找不到完颜蒲鲁虎');
      scenario.characters.splice(index, 1);
      removeRelations(scenario, [['完颜蒲鲁虎', '完颜宗辅']]);
    }
  },
  {
    name: '秦桧',
    what: '所在地改正：靖康二年随二帝北迁，此时拘于金营（燕京），建炎四年（1130）才南归；原账把他放在「临安」在场。改为北狩（开局即按被俘处理，不入廷议、不任官），独白改为身陷金营',
    source: '《宋史·秦桧传》',
    apply(c) {
      Object.assign(c, {
        officialTitle: '前御史中丞（靖康二年随二帝北迁·拘于金营）',
        location: '金国·燕京（随二帝北迁·被拘）',
        presenceState: '北狩',
        innerThought: '身陷金营，随二帝北迁，生死系于人手。金人贪利而畏久战，他日南北终须议和——若得脱身南归，以通和之议自效，未必无出头之日。挞懒诸人，须善结之。'
      });
    }
  },
  {
    name: '张邦昌',
    what: '所在地改正：建炎元年六月李纲入相后，已责授昭化军节度副使、潭州安置（九月赐死）；原账写他仍以太保、观文殿大学士居行在',
    source: '《宋史·张邦昌传》《宋史·高宗纪》',
    apply(c) {
      Object.assign(c, {
        officialTitle: '责授昭化军节度副使·潭州安置',
        role: '贬臣·废楚',
        location: '潭州（安置）',
        presenceState: '罢闲·贬'
      });
      swapIn(c, [
        ['建炎元年（1127）五月高宗即位·以其反正之功、宽宥不诛·封太保、奉国军节度使、同安郡王·寻为观文殿大学士。此刻虽蒙恩仍居高位·然身负僭逆之名',
          '建炎元年（1127）五月高宗即位·以其反正之功、宽宥不诛·封太保、奉国军节度使、同安郡王。六月李纲入相·力言僭逆之罪不可赦·遂责授昭化军节度副使、潭州安置。此刻身在贬所·身负僭逆之名'],
        ['如今(建炎元年八月)虽蒙官家(赵玖)宽宥，封同安郡王、授太保，你却日夜不安', '如今(建炎元年八月)你已被责授昭化军节度副使、安置潭州，虽保得一命，却日夜不安'],
        ['官家面上宽我，可清流的弹章一封接一封……这太保的冠冕，怕是催命的索。', '官家先宽我、封王授保，转眼又贬我到这潭州……清流的弹章一封接一封，这条命怕是保不长了。']
      ]);
      c.career[c.career.length - 1] = { year: 1127, title: '责授昭化军节度副使·潭州安置', note: '五月蒙宽宥封同安郡王，六月李纲入相后责授节度副使、潭州安置，惶恐待罪' };
    }
  },
  {
    name: '王时雍',
    what: '所在地改正：以附伪楚除名、安置高州（建炎元年九月诛于高州）；原账写他罢黜后仍在行在',
    source: '《宋史·高宗纪》建炎元年；《宋史·张邦昌传》附',
    apply(c) {
      Object.assign(c, {
        officialTitle: '（伪楚故相·除名·高州安置）',
        location: '高州（安置）',
        presenceState: '罢闲·贬'
      });
      swapIn(c, [
        ['王时雍以附逆罢黜废居。此刻虽失位而旧党羽尚存·转而依附黄潜善、汪伯彦以图复起。', '王时雍以附逆除名、安置高州。此刻身在贬所·旧党羽尚存·犹冀黄潜善、汪伯彦主和当道·援手复起。'],
        ['如今(建炎元年八月)你虽失官位，朝中却还留着党羽，遂转附黄潜善、汪伯彦', '如今(建炎元年八月)你已被除名、安置高州，朝中却还留着党羽，遂暗托黄潜善、汪伯彦'],
        ['可张邦昌都还能封郡王，我何至于就此完了？', '张邦昌贬潭州，我贬高州，可朝中党羽尚在，我何至于就此完了？']
      ]);
      c.career[c.career.length - 1] = { year: 1127, title: '除名·高州安置', note: '以附伪楚除名、安置高州，党羽尚存，暗托黄潜善汪伯彦以图复起' };
    }
  },
  {
    name: '拓俊京',
    what: '所在地改正：仁宗五年（1127）三月为左正言郑知常所劾，流配岩墮岛（次年移谷州）；原账写他仍在开京掌兵。所统二军六卫的统兵官改为未详',
    source: '《高丽史·拓俊京传》《高丽史·仁宗世家》五年三月',
    apply(c, scenario) {
      Object.assign(c, {
        officialTitle: '高丽·前武臣（仁宗五年流岩墮岛）',
        location: '岩墮岛（流配）',
        presenceState: '罢闲·贬',
        stance: '平李资谦之乱·旋以专恣流配',
        bio: '高丽武臣。仁宗四年（1126）倒戈擒李资谦、平其乱，以功骤贵；五年（1127）三月为左正言郑知常劾以专恣，流配岩墮岛，高丽武臣跋扈之渐。',
        innerThought: '某倒戈擒资谦，于王室有再造之功，不过数月，郑知常一纸弹章，某便流落这岩墮岛。飞鸟尽、良弓藏，自古如此……然王上念旧，或有召还之日。',
        career: [
          { year: 1126, title: '倒戈平李资谦之乱', note: '李资谦专权乱国，俊京倒戈擒之，有匡扶王室之功。' },
          { year: 1127, title: '流配岩墮岛', note: '三月左正言郑知常劾其专恣，流岩墮岛。' }
        ]
      });
      swapIn(c, [['终以跋扈被黜——你正是', '终以跋扈被黜——今岁（仁宗五年）三月，左正言郑知常劾你专恣，你已流配岩墮岛。你正是']]);
      const troop = scenario.military.initialTroops.find((t) => t.commander === '拓俊京');
      if (!troop) throw new Error('找不到拓俊京所统部队');
      troop.commander = '（二军上将军·拓俊京流配后未详）';
    }
  },
  {
    name: '周望',
    what: '官职改正：建炎元年五月以太常少卿假给事中，充大金通问使；两浙宣抚使是建炎三年九月的事。原账把后职提前',
    source: '《建炎以来系年要录》建炎元年五月戊午、建炎三年九月癸丑条',
    apply(c) {
      Object.assign(c, {
        officialTitle: '太常少卿·假给事中·大金通问使',
        location: '金营（奉使通问）',
        presenceState: '外地',
        role: '文臣·通问使',
        stance: '奉使通问金营·持重少决',
        bio: '周望·开封人。历官州郡、有政事之名。建炎元年（1127）五月·以太常少卿假给事中·充大金通问使·奉书北使金营。此刻年五十四·身在虏廷·窥金人虚实。其人长于持重而短于应变·史载建炎三年宣抚两浙·金兀术南下渡江时调度失措·东南残破。',
        innerThought: '奉使虏廷，生死系于金人一念。金人来势汹汹，和议未必可成；我但求不辱使命、全身而归。至于战和大计，非我一人所能定。',
        career: [
          { year: 1127, title: '太常少卿·大金通问使', note: '建炎元年五月假给事中，奉书北使金营' },
          { year: 1129, title: '两浙宣抚使·渡江调度失措', note: '建炎三年九月宣抚两浙，金兀术南下坐失战机，东南残破' }
        ]
      });
      swapIn(c, [['你扮演周望，今为两浙宣抚使，节制两浙诸军、经画东南江防。然你长于持重而短于应变，后金兀术南下渡江，你调度失措、坐失战机，致东南残破——此为你之大失。',
        '你扮演周望，今以太常少卿假给事中、充大金通问使，奉书北使金营。你长于持重而短于应变——史载你日后（建炎三年）宣抚两浙，金兀术南下渡江时调度失措、坐失战机，致东南残破。']]);
    }
  },
  {
    name: '叶梦得',
    what: '官职改正：建炎元年知杭州，为两浙帅臣（八月杭州胜捷军卒陈通作乱，执帅臣叶梦得）；江东安抚制置大使是绍兴年间的事',
    source: '《建炎以来系年要录》卷八建炎元年八月；《宋史·叶梦得传》',
    apply(c) {
      Object.assign(c, { officialTitle: '知杭州（两浙帅臣）', location: '杭州', stance: '帅守杭州·能文能政' });
      swapIn(c, [
        ['建炎元年（1127）·受命为江东安抚制置大使·帅守江东·经画江防、绥辑流亡、措置粮储·为东南屏障。', '靖康、建炎之际·知杭州·为两浙帅臣·治钱塘、措置粮储、绥辑流亡·为东南屏障；时杭州胜捷军卒骄悍思乱（绍兴间始为江东安抚制置大使）。'],
        ['建炎间任江东安抚制置大使，帅守江东、经画江防。', '今知杭州，为两浙帅臣，镇钱塘、经画东南。'],
        ['你受命经略江东（建康一带），筹画江防', '你受命镇守杭州，筹画防务'],
        ['受命守江东，所赖者', '受命守杭州，所赖者']
      ]);
      c.career.forEach((e) => { if (e.year === 1127) Object.assign(e, { title: '知杭州（两浙帅臣）', note: '建炎初知杭州，治钱塘、措置粮储、绥辑流亡；八月胜捷军卒陈通作乱' }); });
    }
  },
  {
    name: '朱胜非',
    what: '官职改正：高宗即位后试中书舍人兼权直学士院，建炎二年始除尚书右丞；原账写建炎元年御史中丞（行在御史中丞此时是颜岐），所在写成还未改名的「临安」',
    source: '《宋史·朱胜非传》',
    apply(c) {
      Object.assign(c, { officialTitle: '试中书舍人·兼权直学士院', title: '中书舍人', location: '行在' });
      swapIn(c, [
        ['建炎元年（1127）·新朝草建·擢为御史中丞·居台谏之长·纠弹百僚。', '建炎元年（1127）·高宗即位·试中书舍人兼权直学士院·掌草诏命。'],
        ['建炎元年御史中丞·后入相', '建炎元年试中书舍人·二年除尚书右丞、迁中书侍郎·后入相'],
        ['建炎元年时任御史中丞', '建炎元年试中书舍人兼权直学士院'],
        ['建炎元年御史中丞', '建炎元年试中书舍人']
      ]);
    }
  },
  {
    name: '吕颐浩',
    what: '官职改正：高宗即位后除知扬州，车驾南幸（建炎元年十月）后才除户部侍郎兼知扬州、进户部尚书；原账开局即写户部尚书随驾',
    source: '《宋史·吕颐浩传》',
    apply(c) {
      Object.assign(c, { officialTitle: '知扬州', title: '知扬州', location: '扬州', presenceState: '外地', role: '知扬州·后期镇苗刘之变' });
      swapIn(c, [
        ['建炎元年（1127）五月·高宗即位·擢为户部尚书、随驾·经画行在财用以给军食。', '建炎元年（1127）·高宗即位·除知扬州·经画淮南财赋、修治扬州以备车驾南幸（车驾至扬州后始除户部侍郎、进户部尚书）。'],
        ['你扮演 吕颐浩·字 元直·户部尚书·随驾', '你扮演 吕颐浩·字 元直·知扬州'],
        ['建炎元年（1127）五月拜户部尚书。', '建炎元年（1127）除知扬州·车驾南幸后除户部侍郎、进户部尚书。'],
        ['户部空虚·军饷难供·李公经略已废·我以户部·勉力支撑。', '李公经略已废·车驾将南幸淮甸·扬州须先备粮储城守·我以知州·勉力支撑。']
      ]);
      c.career.forEach((e) => { if (e.year === 1127) Object.assign(e, { title: '知扬州', note: '建炎元年', date: '1127年' }); });
    }
  },
  {
    name: '刘豫',
    what: '官职改正：宣和六年除河北提点刑狱，金人南侵弃官避乱仪真；建炎二年正月才用张悫荐除知济南府。原账把济南之命提前到建炎元年',
    source: '《宋史·刘豫传》',
    apply(c) {
      Object.assign(c, {
        officialTitle: '前河北提点刑狱（弃官避乱仪真）',
        title: '前河北提刑·避居仪真',
        location: '真州·仪真',
        presenceState: '罢闲'
      });
      swapIn(c, [
        ['建炎元年（1127）·经张悫荐引·新除知济南府·此刻待赴任。其人才具平平而患得患失·身居河北要郡而怀苟全之念', '宣和六年除河北提点刑狱·金人南侵·弃官避乱仪真。此刻闲居仪真·与张悫相善、望其援引（史载建炎二年正月用悫荐除知济南府）。其人才具平平而患得患失·怀苟全之念'],
        ['建炎元年八月时身份是宋朝廷的济南知府待赴任', '建炎元年八月时弃官避居仪真，尚未起用'],
        ['北宋元符进士·建炎元年新除济南知府', '北宋元符进士·前河北提点刑狱·避居仪真'],
        ['济南知府待赴任', '前河北提刑·避居仪真'],
        ['我若守济南·金兵一来必死。', '若起用我守北边州郡·金兵一来必死。']
      ]);
      c.career[c.career.length - 1] = { year: 1127, title: '弃官避乱仪真', note: '宣和六年除河北提点刑狱，金人南侵弃官南避；建炎二年正月始用张悫荐除知济南府', date: '建炎元年', milestone: false };
    }
  },
  {
    name: '刘锜',
    what: '官职改正：高宗即位，录刘仲武之后，特授閤门宣赞舍人、差知岷州，为陇右都护；原账写泾原路第六将',
    source: '《宋史·刘锜传》',
    apply(c) {
      Object.assign(c, { officialTitle: '閤门宣赞舍人·知岷州·陇右都护', title: '知岷州·陇右都护', location: '岷州' });
      swapIn(c, [
        ['在泾原军中·位居第六将', '高宗即位·录仲武之后·特授閤门宣赞舍人·差知岷州·为陇右都护·与夏人战屡胜'],
        ['位居泾原路第六将', '知岷州·为陇右都护'],
        ['泾原路第六将', '知岷州·陇右都护']
      ]);
    }
  },
  {
    name: '李彦仙',
    what: '官职改正：河东陷后归陕，为陕州守臣李弥大裨将，戍崤渑之间；建炎二年复陕州后才知陕州。原账写「原宁夏路统制」（宋无宁夏路，其籍贯是宁州彭原），籍贯也写成巩州',
    source: '《宋史·李彦仙传》：宁州彭原人，徙居巩州',
    apply(c) {
      Object.assign(c, { officialTitle: '陕州守臣李弥大裨将·戍崤渑之间', title: '裨将（后知陕州）' });
      swapIn(c, [
        ['原宁夏路统制·靖康间起兵抗金·后任陕州知州', '陕州裨将·戍崤渑之间·后知陕州'],
        ['（武将·边地义军 + 主战派）·陕州知州', '（武将·边地义军 + 主战派）·陕州裨将'],
        ['·巩州人·徙居陕州', '·宁州彭原人·徙居巩州'],
        ['·巩州人。', '·宁州彭原人·徙居巩州。']
      ]);
    }
  },
  {
    name: '曲端',
    what: '官职改正：建炎元年治兵泾原、招流民溃卒，为泾原路统制官；经略安抚使是后来的事',
    source: '《宋史·曲端传》',
    apply(c) {
      Object.assign(c, { officialTitle: '泾原路统制官（治兵泾原·招流民溃卒）', title: '泾原路统制官·西军实力派' });
      swapIn(c, [['建炎元年泾原路 6 将之首', '建炎元年泾原路统制官']]);
    }
  },
  {
    name: '汪伯彦',
    what: '官职改正：建炎元年五月同知枢密院事，寻进知枢密院事、兼御营副使；建炎二年十二月始拜右仆射。原账写左仆射首相，与本剧本官制树（知枢密院事·御营副使）不一致。权臣地位不变。独白里的「陈东欧阳澈已诛」与二人开局仍在行在相矛盾，改为欲治其罪',
    source: '《宋史·汪伯彦传》《宋史·宰辅表》',
    apply(c) {
      Object.assign(c, { officialTitle: '知枢密院事·兼御营副使' });
      swapIn(c, [
        ['左仆射兼门下侍郎（首相）', '知枢密院事·兼御营副使'],
        ['首相·主和派党魁', '枢密·主和派党魁'],
        ['党魁·首相', '党魁·知枢密院事'],
        ['官·首相', '官·知枢密院事'],
        ['建炎元年（1127）五月高宗即位·拜中书侍郎。八月初·李纲既罢·转尚书左仆射兼门下侍郎·遂为首相。', '建炎元年（1127）五月高宗即位·拜同知枢密院事·寻进知枢密院事、兼御营副使·与右仆射黄潜善并当国柄。'],
        ['陈东欧阳澈已诛', '陈东欧阳澈伏阙狂悖·当以重典惩之']
      ]);
    }
  },
  {
    name: '完颜宗翰',
    what: '官职改正：尚书令是天会十三年（1135）熙宗即位后的官，开局时为左副元帅',
    source: '《金史·宗翰传》',
    apply(c) { swapIn(c, [['左副元帅·尚书令', '左副元帅']]); }
  },
  {
    name: '张宪',
    what: '官职改正：此时尚是诸军裨将，未隶岳飞（岳飞此刻被夺官北上）；原账写作岳飞前军副都统制、随岳飞在御营',
    source: '《宋史·岳飞传》附张宪；本剧本岳飞开局为「北上途中」',
    apply(c) {
      Object.assign(c, {
        officialTitle: '诸军裨将（尚未显名）',
        title: '裨将',
        location: '行伍（尚未隶岳飞）',
        presenceState: '外地',
        innerThought: '二圣北狩，国仇未报。我不过诸军间一裨将，一刀一枪积功，所恃唯本部子弟兵。何日得遇知兵之帅，拔我于卒伍，驱驰河朔，死亦无憾。'
      });
      swapIn(c, [
        ['（武将·岳飞部）·前军副都统制', '（武将·尚未隶岳飞）·裨将'],
        ['岳飞前军副都统制·背嵬军主将', '诸军裨将（他日为岳飞前军副都统制·背嵬军主将）']
      ]);
      const memory = c._memory.find((m) => m.event.includes('岳少保'));
      Object.assign(memory, { event: '我不过诸军间一裨将·一刀一枪积功·何日得遇知兵之帅拔我于卒伍', emotion: '忧' });
      c.coreMotivations = ['盼遇知兵之帅，拔于行伍、驱驰报国', '二圣被掳之恨·恨不能提一旅北叩金营', '护本部子弟兵·一刀一枪积功'];
    }
  },
  {
    name: '牛皋',
    what: '官职改正：此时是汝州鲁山聚众抗金的义军首领，后经翟兴表补保义郎，绍兴初才归岳飞；原账写作岳飞中军统制、随岳飞在御营',
    source: '《宋史·牛皋传》',
    apply(c) {
      Object.assign(c, {
        officialTitle: '汝颍义军首领',
        title: '义军首领',
        location: '京西·汝州（鲁山）',
        presenceState: '外地',
        innerThought: '金骑残破乡里，焚我田园、屠我父老。我牛皋一介农夫，聚乡里子弟保险抗金，屡挫其游骑。朝廷若肯收用，我便为官军前驱；不收，我也死守汝颍。'
      });
      swapIn(c, [
        ['（武将·岳飞部）·中军统制', '（义军·尚未隶岳飞）·义军首领'],
        ['岳飞中军统制·后绍兴朝转太尉', '汝颍义军首领（他日归岳飞为中军统制）']
      ]);
      const memory = c._memory.find((m) => m.event.includes('岳少保'));
      Object.assign(memory, { event: '朝廷若肯收用·我便为官军前驱·不收我也死守汝颍', emotion: '决' });
      c.coreMotivations = ['汝州农家子·乡里被金骑残破·这血仇记到骨头里', '靖康聚众起兵·一身许了杀贼事·守汝颍保乡里', '盼朝廷收用·为官军前驱踏破金营雪此血仇'];
    }
  },
  {
    name: '梁红玉',
    what: '官职与所在地改正：此时尚是随韩世忠军中的侍妾，未受封（护国、安国、杨国夫人皆建炎三年以后所封）；原账所在写成还未改名的「临安」',
    source: '《宋史·韩世忠传》',
    apply(c) {
      Object.assign(c, { officialTitle: '（韩世忠侍妾·未受封）', location: '亳州·随驾（随韩世忠军）' });
      swapIn(c, [
        ['（武将家眷·非朝党）·安国夫人', '（武将家眷·非朝党）·未受封'],
        ['安国夫人·后被封杨国夫人', '韩世忠侍妾·他日受封安国、杨国夫人']
      ]);
    }
  },
  {
    name: '李清照',
    what: '所在地改正：建炎元年赵明诚赴江宁，李清照留青州整理金石，十二月青州兵变始南下；原账写「江南」',
    source: '李清照《金石录后序》',
    apply(c) { c.location = '京东·青州'; }
  },
  {
    name: '赵立',
    what: '官职与所在地改正：此时是徐州武卫军中的军校，建炎四年才知楚州；原账开局即写楚州知州',
    source: '《宋史·赵立传》',
    apply(c) { Object.assign(c, { officialTitle: '徐州武卫军军校', location: '徐州' }); }
  },
  {
    name: '赵佶',
    what: '所在地改正：建炎元年八月二帝在燕京（九月起徙中京，建炎四年才到五国城）；北狩诸人同改',
    source: '《宋史·徽宗纪》《钦宗纪》；《呻吟语》',
    apply(c, scenario) {
      c.location = '金国·燕京（北狩中）';
      ['赵桓', '朱琏', '赵谌'].forEach((n) => { charByName(scenario, n).location = '金国·燕京（北狩中）'; });
      charByName(scenario, '邢秉懿').location = '金国·上京（北狩中）';
    }
  }
];

// 上面改了身份的人物，记忆、目标等零散文字里仍按旧身份说话的句子
const TEXT_SWAPS = {
  张邦昌: [['官家面上宽我·封我太保观文殿大学士·可这恩遇之下·我只觉那是悬顶之剑', '官家先宽我、封王授保·六月又贬我潭州安置·我只觉那是悬顶之剑']],
  朱胜非: [['我自御史中丞骤入相位·正值李纲七十五日而罢', '我以中书舍人掌草诏命·正值李纲七十五日而罢']],
  吕颐浩: [['建炎元年·拜户部尚书·支军饷', '建炎元年·除知扬州·备车驾南幸'], ['户部尚书·未来宰相·镇苗刘之变功臣', '知扬州·未来宰相·镇苗刘之变功臣']],
  刘豫: [['建炎元年经张悫荐引·新除知济南府·身居河北要郡而心怀苟全·待赴任而已。', '弃官避乱仪真·闲居待起·与张悫相善、望其援引·心怀苟全而已。'], ['济南守将关胜骨鲠', '闲居待起·仕途未卜']],
  刘锜: [['今居泾原第六将', '今知岷州·为陇右都护']],
  汪伯彦: [['再图建康临安', '再图建康杭州']],
  张宪: [['岳少保拔我于行伍·命我领背嵬精锐·军中倚为第一锐·此恩此命我以死报之', '我不过诸军间一裨将·一刀一枪积功·何日得遇知兵之帅拔我于卒伍'], ['随岳飞北复·守背嵬军', '盼遇知兵之帅·拔于行伍驱驰报国']],
  赵佶: [['苟全残命于五国城', '苟全残命于北地']],
  邢秉懿: [['(北狩)困五国城', '(北狩)困于金国']]
};

// 查过、但史料不足以断定的，留待核对
const UNVERIFIED = [
  '官制树：户部尚书挂许翰、礼部尚书挂吕好问（二人开局罢闲）、东京留守司统制挂岳飞（开局北上途中）、熙河路经略挂吴玠、泾原路经略挂曲端，多为后来职任；改动牵涉官缺与西军玩法，未动',
  '滕康、富直柔、谢克家、李回、路允迪、卢益等执政台谏官衔多为建炎二三年以后所授，建炎元年实职待逐一核《系年要录》',
  '韦氏、邢秉懿建炎元年秋是否已入上京浣衣院，诸书记载不一；二帝以外的北狩者所在只改了明显错误的五国城',
  '陈与义此时避乱邓州（兵部员外郎为绍兴元年），朱松此时为福建州县小官（吏部员外郎为绍兴年间）：官衔待核后改',
  '大越「黎太后」（虚构）写作垂帘辅幼主，而开局仁宗尚在；时立爱、段正兴等年龄与史载有出入',
  '克烈脱斡邻勒（王汗）1127 年十三岁偏早，生年史无确载'
];

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const before = new Map(scenario.characters.map((c) => [c.id, { name: c.name, location: c.location }]));
  const lines = [];
  FIXES.forEach((fix) => {
    if (fix.rename) {
      const [from, to] = fix.rename;
      const n = renameEverywhere(scenario, from, to);
      if (!n) throw new Error('全剧本找不到「' + from + '」');
      lines.push('- 全剧本「' + from + '」→「' + to + '」共 ' + n + ' 处');
    }
    const c = fix.name === '完颜宗磐' ? charByName(scenario, '完颜宗磐') : charByName(scenario, fix.name);
    if (fix.apply) fix.apply(c, scenario);
  });
  Object.keys(TEXT_SWAPS).forEach((name) => swapIn(charByName(scenario, name), TEXT_SWAPS[name]));

  // 地点变了的人物，按运行时规则重算地块绑定
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(LOCATIONS_JS, 'utf8'), sandbox);
  const game = { mapData: scenario.map, factions: scenario.factions, characters: scenario.characters };
  const rebound = [];
  scenario.characters.forEach((c) => {
    const old = before.get(c.id);
    if (!old || old.location === c.location) return;
    const out = sandbox.TMMapLocations.sync(c, 'character', game);
    rebound.push('| ' + c.name + ' | ' + old.location + ' | ' + c.location + ' | ' + (out.regionName || '（不落地块：' + out.method + '）') + ' |');
  });

  // 自检：人物名、id 唯一；已殁者不再统兵、不再领党派
  const names = scenario.characters.map((c) => c.name);
  if (new Set(names).size !== names.length) throw new Error('改后人物名重复');
  const ids = scenario.characters.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error('改后人物 id 重复');
  const dead = new Set(scenario.characters.filter((c) => c.alive === false).map((c) => c.name));
  scenario.military.initialTroops.forEach((t) => { if (dead.has(t.commander)) throw new Error(t.name + ' 由已殁的 ' + t.commander + ' 统兵'); });
  scenario.parties.forEach((p) => { if (dead.has(p.leader)) throw new Error(p.name + ' 的党魁 ' + p.leader + ' 已殁'); });

  const report = ['# 绍宋·人物时代错误修正报告', '',
    '开局为建炎元年八月（1127）。以下 ' + FIXES.length + ' 项逐人改正生死、所在、官职与相关文字，人物由 ' + before.size + ' 人变为 ' + scenario.characters.length + ' 人。', '',
    '## 逐项', ''];
  FIXES.forEach((fix) => report.push('- **' + fix.name + '**：' + fix.what + '。依据：' + fix.source));
  report.push('', '## 改名', '', ...lines, '', '## 地点改动与地块绑定', '', '| 人物 | 原所在 | 改后 | 绑定地块 |', '| --- | --- | --- | --- |', ...rebound,
    '', '## 未改、待核', '', ...UNVERIFIED.map((s) => '- ' + s));
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
