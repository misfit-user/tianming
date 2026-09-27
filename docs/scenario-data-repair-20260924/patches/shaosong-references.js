// 绍宋剧本·理顺人物、势力、党派、阶层、军队之间的引用（阶段二人物部分第二步）
//
// lint-scenario-data 报出的引用断链多是原账写了泛称或随手简称，逐条对到表里现有的条目：
//   1. 人物阶层：「士大夫」「武将」「金廷·君主」等对到本势力阶层表（大宋宰执文臣、台谏清流、武将军人……）；
//      大宋阶层表没有宦官一类，四名内侍阶层留空（党派仍是「近习内侍」）。
//   2. 人物党派：「主战派」「主和」等简称对到全称；「（无党·亲卫）」之类说明文字改为无党。
//   3. 人物势力：「宋朝廷·内廷」四名内侍归大宋；王善、丁进所部已编入东京留守司招抚义军，归大宋，阶层「溃兵盗匪」。
//   4. 群盗：原账有五支群盗军队、一条「群盗—宋」掠食关系和十一名群盗人物，势力表里却漏了「群盗」这一条，
//      照西军、八字军等无领土势力的写法补上（map.factions 同步登记）。
//   5. 势力都城写成说明文字的，改为地图地块名（大夏「中兴府」为嘉泰五年后之名，改兴庆府）；无固定据地的留空。
//   6. 势力首领写泛称的，有人物表对应者改为其人（大理段正严、高昌毕勒哥……），诸部无共主者写成括注占位。
//   7. 党魁、统兵官写成「王善·杨进等」「诸路帅臣」的，取为首之人或改为括注占位。
//   8. 党派、阶层原账没有 id、sid：照天启的写法补 pty_、cls_ 前缀 id（取「势力|名称」的哈希，重跑不变）与剧本 sid。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/shaosong-references.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '绍宋·建炎元年八月（官方）.json');

// ---------------- 1. 人物阶层 ----------------
const SONG_CIVIL = '宰执文臣';
const SONG_CENSOR = '台谏清流';
const SONG_MILITARY = '武将军人';
const SONG_STUDENT = '太学生·士子';
const JIN_ROYAL = '完颜宗室·勃极烈贵族';
const JIN_SURRENDERED = '辽宋降官 (汉地文治之具)';
const CLASS_BY_NAME = {
  // 台谏：侍御史、御史中丞、御史
  赵鼎: SONG_CENSOR, 张浚: SONG_CENSOR, 颜岐: SONG_CENSOR, 范宗尹: SONG_CENSOR,
  // 太学生与布衣
  陈东: SONG_STUDENT, 欧阳澈: SONG_STUDENT, 范如圭: SONG_STUDENT, 胡闳休: SONG_STUDENT,
  // 原账写「士」的武人
  王德: SONG_MILITARY, 田师中: SONG_MILITARY, 李宝: SONG_MILITARY,
  // 原账写「宋·……」说明的
  刘豫: SONG_CIVIL, 洪皓: SONG_CIVIL, 陈规: SONG_CIVIL, 朱胜非: SONG_CIVIL, 秦桧: SONG_CIVIL,
  曲端: SONG_MILITARY, 刘锜: SONG_MILITARY, 张宪: SONG_MILITARY, 牛皋: SONG_MILITARY, 李彦仙: SONG_MILITARY, 梁红玉: SONG_MILITARY,
  // 金：完颜宗室与降官
  完颜宗辅: JIN_ROYAL, 完颜银术可: JIN_ROYAL, 韩昉: JIN_SURRENDERED, 萧庆: JIN_SURRENDERED, 耶律余睹: JIN_SURRENDERED,
  // 义军
  翟兴: '义军首领 (八字军帅·义军帅)', 翟进: '义军首领 (八字军帅·义军帅)', 何元庆: '义军首领 (八字军帅·义军帅)', 邵兴: '义军首领 (八字军帅·义军帅)',
  翟琮: '山寨豪杰 (太行七寨头目)', 刘文舜: '山寨豪杰 (太行七寨头目)',
  杨进: '义军首领 (帅·寨主)',
  郭浩: '西军将门世家 (种姚折刘吴)', 杨政: '职业军人 (西兵·禁厢正军)',
  王善: '溃兵盗匪', 丁进: '溃兵盗匪',
  // 大宋阶层表无宦官一类：留空
  康履: '', 蓝珪: '', 曾择: '', 黄经臣: ''
};
// 其余按「势力 + 原写法」归类
const CLASS_BY_VALUE = {
  '大宋|士大夫': SONG_CIVIL, '大宋|士': SONG_CIVIL, '大宋|武将': SONG_MILITARY
};
function fixClass(c) {
  if (Object.prototype.hasOwnProperty.call(CLASS_BY_NAME, c.name)) return CLASS_BY_NAME[c.name];
  const key = c.faction + '|' + c.class;
  if (CLASS_BY_VALUE[key]) return CLASS_BY_VALUE[key];
  if (c.faction === '大金' && /^金廷/.test(c.class) && /^完颜/.test(c.name)) return JIN_ROYAL;
  return null;
}

// ---------------- 2. 人物党派 ----------------
const P_WAR = '主战派 (李纲遗绪)';
const P_PEACE = '主和当国派 (汪黄)';
const P_PRAG = '务实调和派 (赵张潜流)';
const PARTY_BY_NAME = {
  王渊: '近习内侍 (从龙宦官)',
  完颜吴乞买: '宗室争权 (东朝勃极烈·吴乞买宗干系)',
  韩昉: '燕云汉人世侯·治理派 (降臣治汉地)', 萧庆: '燕云汉人世侯·治理派 (降臣治汉地)',
  洪皓: P_PRAG, 陈规: P_PRAG,
  李彦仙: P_WAR,
  秦桧: P_PEACE,
  完颜亶: '经略中原·汉化派 (用汉法治汉地)',
  王时雍: '伪楚附逆余孽',
  '任氏(恭睿太后)': '王室宗亲·王太后系',
  '源光（天台座主）': '大寺社僧兵势力 (山门·南都)'
};
const PARTY_BY_VALUE = { 主战派: P_WAR, 主战: P_WAR, 主和派: P_PEACE, 主和: P_PEACE, 务实派: P_PRAG, 务实: P_PRAG };

// ---------------- 3. 人物势力 ----------------
const FACTION_BY_NAME = {
  康履: '大宋', 蓝珪: '大宋', 曾择: '大宋', 黄经臣: '大宋',
  王善: '大宋', 丁进: '大宋'
};

// ---------------- 4. 群盗势力 ----------------
const QUNDAO_MEMBERS = ['李成', '孔彦舟', '张用', '桑仲', '马进', '曹成', '马友', '李宏', '钟相', '杨幺', '范汝为'];
const QUNDAO = {
  id: 'fac_qundao', name: '群盗', side: 'hostile', type: '溃兵巨寇与乡社武装（兵盗之间）',
  leader: '（群盗各自为雄，无共主）', coLeader: null,
  members: QUNDAO_MEMBERS,
  stateDescription: '靖康溃散的官军与啸聚巨寇，李成、孔彦舟、张用、桑仲等各拥众数万，剽掠京东西、淮南、荆湖；受招则官，不受则寇。洞庭钟相、杨幺与建州范汝为等乡社尚未起事。',
  currentMorale: 50,
  fiscalCondition: '剽掠自给·无府库',
  primaryTarget: 'fac_song', naturalAllies: [], loyaltyToSong: 10,
  _independenceLevel: 70,
  internalTension: '诸部各自为雄，互不统属，时有吞并；受宋招安与北投金人之议并存。',
  sid: 'fac_qundao', strength: 25, courtInfluence: 0, popularInfluence: 20, cultureLevel: 10,
  capital: '',
  ideology: '据地自雄·受招则官·不受则寇',
  traits: ['roving-bandits', 'no-territory', 'negotiable'],
  mainResources: ['溃兵与饥民', '剽掠所得粮帛', '江湖水寨'],
  longTermStrategy: '乘宋金交兵之际据地剽掠，择机受宋招安补官，或北投金人。',
  victoryConditions: ['据州县自立', '受招安而得官爵'],
  defeatConditions: ['被官军剿灭', '部众离散'],
  offendThresholds: [
    { score: 15, description: '轻微触怒·言辞冷淡', consequences: ['relations -5'] },
    { score: 30, description: '严重触怒·拒绝招安', consequences: ['relations -15'] },
    { score: 60, description: '不可忍·倾巢剽掠', consequences: ['relations -40', '四出剽掠'] }
  ],
  history: [{ year: 1127, month: 5, event: '靖康之变后官军溃散，李成、孔彦舟、张用、桑仲等各拥众剽掠京东、京西、淮南。' }],
  attitudeDetail: {
    self: ['兵盗之间，可抚可剿', '诸部互不统属'],
    allies: [],
    enemies: ['追剿的宋军'],
    neutrals: ['金人（或可北投）']
  },
  partyRelations: {},
  leadership: { ruler: '', regent: '', general: '李成', chancellor: '', spy: '' },
  treasury: { money: 0, grain: 0, cloth: 0, note: '剽掠自给，无府库。' },
  economicPolicy: { labor: '剽掠' },
  warState: { active: [], pending: [{ enemy: '大宋', since: '1127.05', front: '京东西、淮南、荆湖诸路' }], recent: [] },
  publicOpinion: { amongFollowers: 50 },
  relations: { 大宋: 0, 大金: 0 },
  population: { actual: 0, registered: 0, hidden: 0, ethnicities: { 汉: 100 }, note: '部众随聚随散，不入户籍；诸部军队见军队表。' },
  techLevel: { overall: 15, military: 25 },
  posture: '剽掠观望'
};
const QUNDAO_MAP = {
  label: '群盗', short: '群盗', color: '#6D4C41', line: '#6D4C41',
  note: '溃兵巨寇，无固定地盘。', type: '流寇武装', score: 50,
  scenarioFactionId: 'fac_qundao', scenarioFactionName: '群盗', scenarioFactionColor: '#6D4C41',
  id: 'fac_qundao', key: 'fac_qundao', name: '群盗'
};

// ---------------- 5. 势力都城 ----------------
const CAPITAL = {
  大金: '会宁', 河北义军: '相州', '西军（关陕）': '', 太行八字军: '', '契丹反金 (耶律余睹部)': '',
  大夏: '兴庆府', 大理国: '大理', 东喀喇汗国: '八剌沙衮', 高昌回鹘: '高昌', 古格王国: '扎不让',
  卫藏诸部: '逻些', 多康诸部: '昌都', 乃蛮部: '阿尔泰东麓', 克烈部: '土兀剌河', 蔑儿乞部: '色楞格河',
  蒙兀诸部: '斡难河', 塔塔儿联盟: '捕鱼儿海子', 弘吉剌部: '额尔古纳南岸', 阴山诸部: '阴山西部',
  建昌诸部: '建昌府', 滇西北诸部: '磨些部', 乌蒙乌撒诸部: '乌蒙', 金齿诸部: '金齿诸部', 滇中南诸部: '石城郡',
  流求诸部: '流求中部', 吕宋诸邦: '吕宋中原', 麻逸: '麻逸', 米沙鄢诸邦: '宿务诸邦', 北海诸部: '黑水下游诸部',
  罗殿国: '罗殿', 自杞国: '自杞', 大越李朝: '升龙', 日本: '山城国'
};

// ---------------- 6. 势力首领 ----------------
const LEADER = {
  河北义军: '（磁相守将与义兵头领）', 大理国: '段正严', 高昌回鹘: '毕勒哥', 古格王国: '扎西孜',
  卫藏诸部: '（卫藏诸王系与寺院首领）', 多康诸部: '贡保多吉', 乃蛮部: '亦难赤·必勒格汗', 克烈部: '忽儿札忽思·不亦鲁黑',
  蔑儿乞部: '脱脱里·别乞', 蒙兀诸部: '合不勒汗', 塔塔儿联盟: '篾古真·薛兀勒图', 弘吉剌部: '纳臣那颜',
  阴山诸部: '阿剌兀惕', 高丽: '王楷', 建昌诸部: '阿伏其那', 滇西北诸部: '阿乌牟', 乌蒙乌撒诸部: '阿那莫',
  金齿诸部: '刀景陇', 滇中南诸部: '蒙舍诺', 流求诸部: '巴里斯', 吕宋诸邦: '拉坎·杜玛盖特', 麻逸: '拉贾·布卡延',
  米沙鄢诸邦: '拉卡纳·邦图甘', 蒲端国: '拉惹·基兰', 北海诸部: '胡里改·阿固岱', 罗殿国: '罗阿勿', 自杞国: '阿迩'
};

// ---------------- 7. 党魁、统兵官 ----------------
// 党派名在几个势力里重名（大鬼主神道势力），按「党派|势力」对
const PARTY_LEADER = {
  '务实调和派 (赵张潜流)|大宋': '赵鼎',
  '宗室争权 (东朝勃极烈·吴乞买宗干系)|大金': '完颜吴乞买',
  '燕云汉人世侯·治理派 (降臣治汉地)|大金': '时立爱',
  '崇佛避世派 (妙香佛国·避位为僧)|大理国': '妙澄',
  '亲宋互市派 (东部马道酋)|滇中南诸部': '些么徒阿哲',
  '险部主战割据派|滇中南诸部': '罗摩诺笃',
  '白蛮城邦调和派 (近大理)|滇中南诸部': '白王和恕',
  '大鬼主神道势力|乌蒙乌撒诸部': '阿卓鬼主',
  '分部召离合派|金齿诸部': '刀阿摆',
  '上座部佛僧势力|金齿诸部': '召片悟',
  '守门户主战派 vs 通商主和派|金齿诸部': '刀线象',
  '诸分部酋离合派 (北·南·东部)|建昌诸部': '苴梦冲',
  '大鬼主神道势力|建昌诸部': '鬼主德布',
  '亲宋通商交涉派|建昌诸部': '舍利畔',
  '诸分部酋自固派|罗殿国': '莫阿勒',
  '大鬼主神道势力|罗殿国': '毕阿摩',
  '通宋羁縻交涉派|罗殿国': '罗阿宝',
  '马商集团 (贩马命脉)|自杞国': '矣笃',
  '诸分部酋离合派 (师宗·罗平)|自杞国': '笃慕',
  '通大理马源派|自杞国': '罗婺'
};
const COMMANDER = {
  '东京留守司·招抚义军': '王善',
  '五马山寨·忠义军': '马扩',
  '河北招抚司·王彦后部': '张所',
  '熙河·秦凤诸军': '（诸路帅臣）',
  江淮水军: '（行在水军统制）',
  '两浙·福建路屯驻': '（诸州兵马）',
  '荆湖·川峡屯驻': '（诸路兵马）',
  '李成·孔彦舟等群盗': '孔彦舟',
  '金西路军(粘罕)': '完颜宗翰',
  '金东路军(斡离不)': '完颜宗望',
  '御营·苗傅刘正彦部': '苗傅',
  '京西忠义·翟兴翟进部': '翟兴',
  '建康水军·韩世忠舟师': '韩世忠',
  '金·娄室活女部(陕西)': '完颜娄室',
  '洞庭乡社·钟相(将起)': '钟相',
  '建康水军·别部': '（行在水军）',
  福建路屯驻: '（路分都监）',
  '广南屯驻·摧锋军': '（广东帅司）',
  '金·韩常燕京戍兵': '（韩常，未列传）',
  '西夏·铁鹞子': '萧合达',
  延历寺山门僧兵: '源光（天台座主）',
  '麻逸·护港战士': '邦阿瓦·卡蒂',
  '米沙鄢·纹身勇士': '纹身勇士头领·班瓦'
};

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const s = JSON.parse(raw);
  if (JSON.stringify(s) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  if (JSON.stringify(s.map) !== JSON.stringify(s.mapData)) throw new Error('map 与 mapData 已不一致，先查清再改');

  const log = { class: [], party: [], faction: [], capital: [], leader: [], partyLeader: [], commander: [] };
  const charByName = new Map(s.characters.map((c) => [c.name, c]));
  const need = (name, what) => { if (!charByName.has(name)) throw new Error(what + ' 要对到的人物不在人物表：' + name); };

  // 4. 群盗势力（先补，人物势力校验要用）
  if (s.factions.some((f) => f.name === '群盗')) throw new Error('势力表里已有群盗，这个补丁只能在原账上跑');
  QUNDAO_MEMBERS.forEach((n) => need(n, '群盗成员'));
  s.factions.push(QUNDAO);
  s.map.factions.fac_qundao = QUNDAO_MAP;
  QUNDAO_MEMBERS.forEach((n) => { charByName.get(n).factionId = 'fac_qundao'; });
  const factionNames = new Set(s.factions.map((f) => f.name));
  const facIdByName = new Map(s.factions.map((f) => [f.name, f.id]));

  const classNames = new Set(s.classes.map((c) => c.name));
  const partyNames = new Set(s.parties.map((p) => p.name));

  s.characters.forEach((c) => {
    // 3. 势力
    if (FACTION_BY_NAME[c.name] && !factionNames.has(c.faction)) {
      log.faction.push([c.name, c.faction, FACTION_BY_NAME[c.name]]);
      c.faction = FACTION_BY_NAME[c.name];
      c.factionId = facIdByName.get(c.faction);
    }
    // 1. 阶层
    if (typeof c.class === 'string' && c.class && !classNames.has(c.class)) {
      const next = fixClass(c);
      if (next == null) throw new Error('阶层没有对照：' + c.name + '（' + c.faction + '）' + c.class);
      if (next && !classNames.has(next)) throw new Error('对照的阶层不在表里：' + next);
      log.class.push([c.name, c.class, next || '（留空）']);
      c.class = next;
    }
    // 2. 党派
    if (typeof c.party === 'string' && c.party && !partyNames.has(c.party)) {
      let next = Object.prototype.hasOwnProperty.call(PARTY_BY_NAME, c.name) ? PARTY_BY_NAME[c.name] : PARTY_BY_VALUE[c.party];
      if (next == null) next = '';
      if (next && !partyNames.has(next)) throw new Error('对照的党派不在表里：' + next);
      log.party.push([c.name, c.party, next || '（无党）']);
      c.party = next;
    }
  });

  s.factions.forEach((f) => {
    // 5. 都城
    if (Object.prototype.hasOwnProperty.call(CAPITAL, f.name) && f.capital !== CAPITAL[f.name]) {
      const next = CAPITAL[f.name];
      if (next && !s.map.regions.some((r) => r.name === next)) throw new Error('都城不是地图地块：' + next);
      log.capital.push([f.name, f.capital, next || '（无固定据地，留空）']);
      f.capital = next;
    }
    // 6. 首领
    if (LEADER[f.name] && f.leader !== LEADER[f.name]) {
      const next = LEADER[f.name];
      if (!/^（/.test(next)) {
        need(next, '势力首领');
        const lc = charByName.get(next);
        if (lc.faction !== f.name) throw new Error(next + ' 不属 ' + f.name);
      }
      log.leader.push([f.name, f.leader, next]);
      f.leader = next;
      if (f.leadership && typeof f.leadership === 'object' && !/^（/.test(next)) f.leadership.ruler = next;
    }
  });

  // 7. 党魁
  s.parties.forEach((p) => {
    const next = PARTY_LEADER[p.name + '|' + p.faction];
    let target = next;
    // 南海诸邦：「某某 (对宋海贸大首领)」去掉括注即人名
    if (!target && typeof p.leader === 'string' && / \(.+\)$/.test(p.leader) && charByName.has(p.leader.replace(/ \(.+\)$/, ''))) {
      target = p.leader.replace(/ \(.+\)$/, '');
    }
    if (target && p.leader !== target) {
      need(target, '党魁');
      log.partyLeader.push([p.name + '（' + p.faction + '）', p.leader, target]);
      p.leader = target;
    }
  });

  // 7. 统兵官
  s.military.initialTroops.forEach((t) => {
    const next = COMMANDER[t.name];
    if (next == null || t.commander === next) return;
    if (!/^（/.test(next)) need(next, '统兵官');
    log.commander.push([t.name, t.commander, next]);
    t.commander = next;
  });

  // 8. 党派、阶层补 id、sid
  const scenarioSid = s.sid || s.id;
  const usedIds = new Set();
  let entityIds = 0;
  [['parties', 'pty_ss_'], ['classes', 'cls_ss_']].forEach(([key, prefix]) => {
    s[key].forEach((e) => {
      if (!e.id) {
        const id = prefix + crypto.createHash('sha1').update((e.faction || '') + '|' + e.name).digest('hex').slice(0, 10);
        if (usedIds.has(id)) throw new Error(key + ' 里同一势力下有重名：' + e.faction + ' ' + e.name);
        e.id = id;
        entityIds++;
      }
      usedIds.add(e.id);
      if (!e.sid) e.sid = scenarioSid;
    });
  });
  log.entityIds = entityIds;

  s.mapData = JSON.parse(JSON.stringify(s.map));

  const section = (title, rows, heads) => {
    const out = ['## ' + title + '（' + rows.length + '）', '', '| ' + heads.join(' | ') + ' |', '|' + heads.map(() => ' --- |').join('')];
    rows.forEach((r) => out.push('| ' + r.map((x) => String(x == null ? '' : x)).join(' | ') + ' |'));
    return out.concat(['']);
  };
  const lines = ['# 绍宋·人物、势力、党派、阶层引用理顺报告', '',
    '补「群盗」无领土势力一条（成员 ' + QUNDAO_MEMBERS.join('、') + '），map.factions 同步登记。',
    '党派、阶层补 id、sid ' + log.entityIds + ' 条。', '']
    .concat(section('人物势力', log.faction, ['人物', '原写', '改为']))
    .concat(section('人物阶层', log.class, ['人物', '原写', '改为']))
    .concat(section('人物党派', log.party, ['人物', '原写', '改为']))
    .concat(section('势力都城', log.capital, ['势力', '原写', '改为']))
    .concat(section('势力首领', log.leader, ['势力', '原写', '改为']))
    .concat(section('党魁', log.partyLeader, ['党派', '原写', '改为']))
    .concat(section('统兵官', log.commander, ['军队', '原写', '改为']));
  if (reportFile) fs.writeFileSync(reportFile, lines.join('\n'));
  console.log('势力 ' + log.faction.length + '、阶层 ' + log.class.length + '、党派 ' + log.party.length + '、都城 ' + log.capital.length +
    '、首领 ' + log.leader.length + '、党魁 ' + log.partyLeader.length + '、统兵官 ' + log.commander.length + ' 处');
  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(s) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
