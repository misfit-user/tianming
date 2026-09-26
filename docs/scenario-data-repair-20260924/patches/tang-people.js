// 晚唐剧本·史实人物逐人改正（阶段三第四刀之二）
//
// 开局是开成五年正月十四（840 年 2 月 20 日，武宗受册当日）。原账的唐方史实人物有的官职、所在是旧任或泛称
// （崔龟从已出镇宣歙仍写户部侍郎在长安，卢商写成长安的「资深文臣」且多算了近二十岁，李景让、崔铉、白敏中只写「文臣」），
// 有的开局前已死（李翱开成元年前后卒于山南东道任上），有的名字是后来才改的（李回开局时仍名李躔，避武宗讳改名在即位之后）。
// 人物字段去伪一刀把「立场」里抄的志向清空了，这里按史料补上各人的政治立场。
//
// 逐人改正：官职（实职、兼职、加衔分开）、所在、生年与周岁、字、郡望，以及与之矛盾的生平、处境、志向文字；
// 当前官职有确切任命日期的，补一条仕途履历。每条注明依据，原文与出处见 sources/tang-research/ 的核查结果（court、north、south、bio-audit 四份），
// 也照录在报告里。拿不准的不改，列在报告末尾待核。
// 生年由享年倒推时按虚岁（生年 = 卒年 − 享年 + 1）；生日不详的，周岁按生日在正月十四之后计（与原账李瀍、李怡的算法一致）。
// 改名在全剧本（地图除外）替换，但史料引文里的原文不动。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-people.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const WUCHANG_FILE = path.join(REPO, 'web/assets/reference/tang840-wuchang.json');
const LOCATIONS_JS = path.join(REPO, 'web', 'tm-map-locations.js');
const { TANG_TREES, leavesOf } = require(path.join(DIR, 'data/tang-sources.js'));
const { NEW_PEOPLE, GOVERNORS, LEAF_GOVERNORS, CIRCUIT_TITLES } = require(path.join(DIR, 'data/tang-people-new.js'));

// ---------- 工具 ----------

// 史料引文照录原文，改名、改字不碰
const QUOTE_KEYS = new Set(['historicalSources', 'quotes', 'sources']);

function deepSwap(obj, from, to) {
  let count = 0;
  (function walk(o) {
    Object.keys(o).forEach((k) => {
      if (QUOTE_KEYS.has(k)) return;
      const v = o[k];
      if (typeof v === 'string') {
        if (v.includes(from)) { o[k] = v.split(from).join(to); count++; }
      } else if (v && typeof v === 'object') walk(v);
    });
  })(obj);
  return count;
}

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

// 官职：officialTitle 是实职（游戏按它绑官缺与地块），称谓 title/role/occupation 写全衔，兼职、加衔各自成列
function setOffice(c, { official, concurrent = [], honorary }) {
  c.officialTitle = official;
  const full = [official, ...concurrent].filter(Boolean).join('·');
  c.title = full; c.role = full; c.occupation = full;
  if (concurrent.length || 'concurrentTitles' in c) {
    c.concurrentTitles = concurrent.slice();
    c.concurrentTitle = concurrent.join('、');
  }
  if ('officialTitles' in c || concurrent.length) c.officialTitles = [official, ...concurrent].filter(Boolean);
  if (honorary) c.honoraryTitles = honorary.slice();
}

// 生平 = 来历 + 处境；扮演提示是生平、性格、志向、辞令、内心独白的汇编，随之重生成
function setText(c, fields) {
  Object.assign(c, fields);
  if ('background' in fields || 'description' in fields) {
    c.bio = [c.background, c.description].filter(Boolean).join('\n\n');
  }
  if ('personalGoal' in fields) {
    c.personalGoals = c.personalGoal ? [{ id: 'goal_1', type: 'custom', longTerm: c.personalGoal, shortTerm: '', progress: 0, priority: 5 }] : [];
  }
  c.aiPersonaText = [c.bio, c.personality, c.personalGoal, c.diction, c.innerThought].filter(Boolean).join('\n\n');
}

function addCareer(c, date, title, desc) {
  c.career = (c.career || []).filter((e) => !(e.date === date && e.title === title));
  c.career.push({ date, title, desc, milestone: false });
}

function markDead(c, fields) {
  Object.assign(c, { alive: false, active: false, location: '(已殁)', stance: '', personalGoal: '', personalGoals: [] }, fields);
}

// 文字改错：原句必须找得到，找不到说明原账已变，先核对
function swapText(c, field, from, to) {
  if (typeof c[field] !== 'string' || !c[field].includes(from)) throw new Error(c.name + '.' + field + ' 里找不到「' + from + '」');
  const fields = {};
  fields[field] = c[field].split(from).join(to);
  setText(c, fields);
}

// 两人之间的关系：人物关系表与顶层关系，两个方向一并处理
function dropRelation(scenario, a, b) {
  let n = 0;
  scenario.characters.forEach((c) => {
    if (c.name === a && c.relations && c.relations[b]) { delete c.relations[b]; n++; }
    if (c.name === b && c.relations && c.relations[a]) { delete c.relations[a]; n++; }
  });
  const before = scenario.relations.length;
  scenario.relations = scenario.relations.filter((r) => !((r.from === a && r.to === b) || (r.from === b && r.to === a)));
  n += before - scenario.relations.length;
  if (!n) throw new Error(a + ' 与 ' + b + ' 之间没有关系可删');
}

function relabelRelation(scenario, a, b, label, description) {
  let n = 0;
  scenario.characters.forEach((c) => {
    [[a, b], [b, a]].forEach(([from, to]) => {
      if (c.name !== from || !c.relations || !c.relations[to]) return;
      c.relations[to].labels = [label];
      if (description) c.relations[to].description = description; else delete c.relations[to].description;
      n++;
    });
  });
  scenario.relations.forEach((r) => {
    if (!((r.from === a && r.to === b) || (r.from === b && r.to === a))) return;
    r.type = label;
    if (description) r.desc = description; else delete r.desc;
    n++;
  });
  if (!n) throw new Error(a + ' 与 ' + b + ' 之间没有关系可改');
}

// ---------- 逐人改正 ----------
// 每项：name、what（改了什么）、source（依据）、apply(c, scenario)

const FIXES = [
  {
    name: '崔龟从',
    what: '官职与所在：开成四年由户部侍郎出为宣歙观察使（代崔郸），开局时在宣州，不再是户部侍郎',
    source: '《旧唐书·文宗纪下》开成四年「以戶部侍郎崔龜從為宣歙觀察使，代崔鄲；以鄲為太常卿」；《旧唐书·崔郸传》「四年，入為太常卿」',
    apply(c, scenario) {
      setOffice(c, { official: '宣歙观察使', concurrent: ['宣州刺史'], honorary: [] });
      c.location = '宣州';
      vacatePost(scenario, '户部侍郎', c);
      assignPost(scenario, '宣歙观察使', c);
      setText(c, {
        description: '开成四年由户部侍郎出为宣歙观察使，接替入朝的崔郸，坐镇宣州。宣、歙、池三州的税赋、上供与刑狱都须经他过问；先帝的哀诏已到江南，丧礼称谓若有疑处，他只能由表章陈说。',
        personalGoal: '由表章厘清继统丧祭的称谓与仪次，使此次礼文不留下后日争论；宣歙三州的上供按期办齐。'
      });
      addCareer(c, '开成四年', '宣歙观察使', '由户部侍郎出为宣州刺史、宣歙观察使，代崔郸。');
    }
  },
  {
    name: '卢商',
    what: '官职、所在与年龄：开成二年五月由苏州刺史擢润州刺史、浙西团练观察使，开局时在润州；大中十三年卒年七十一，生于贞元五年，开局 50 岁（原账 69 岁、写「年近七旬」）',
    source: '《旧唐书·文宗纪下》开成二年「以蘇州刺史盧商為浙西觀察使」；《旧唐书·卢商传》「遷潤州刺史、浙西團練觀察使。入為刑部侍郎」「大中十三年……卒於漢陰驛，時年七十一」',
    apply(c, scenario) {
      setOffice(c, { official: '浙西观察使', concurrent: ['润州刺史'] });
      assignPost(scenario, '浙西观察使', c);
      Object.assign(c, { location: '润州', age: 50, birthYear: 789 });
      setText(c, {
        background: '范阳卢氏，少孤贫力学，元和四年登进士第，又以书判拔萃登科，辗转幕府与州县，对钱谷文书、民间差科有长期经验。开成初出为苏州刺史，次年擢浙西观察使。',
        description: '坐镇润州，苏、常、湖、杭的谷帛与江口漕运都要经他过问。新君即位的诏书传到江南，他更关心上供的绢米能否如期起运，哪一处仓场只剩簿面上的数。',
        personalGoal: '把浙西的上供与仓场旧账理清，不让簿面数目冒充实储。'
      });
      addCareer(c, '开成二年五月', '浙西观察使', '由苏州刺史擢润州刺史、浙西团练观察使。');
    }
  },
  {
    name: '李商隐',
    what: '官职与所在：登第后释褐秘书省校书郎，调补虢州弘农尉，开局时在虢州（原账写长安的「文士」）；生年从学界通说元和八年，开局 26 岁',
    source: '《旧唐书·文苑传下·李商隐》「開成二年，方登進士第，釋褐秘書省校書郎，調補弘農尉」；《新唐书·文艺传下·李商隐》「調弘農尉，以活獄忤觀察使孫簡，將罷去，會姚合代簡，諭使還官」；姚合代孙简在开成四年八月（《旧唐书·文宗纪下》）',
    apply(c) {
      setOffice(c, { official: '弘农尉' });
      Object.assign(c, { location: '虢州', age: 26, birthYear: 813, rosterRole: 'civil', socialClass: 'civilOfficial' });
      setText(c, {
        description: '登第后释褐秘书省校书郎，调补弘农尉。因平反狱囚忤了陕虢观察使孙简，几被罢去，姚合接任后劝他还官。县尉俸薄事繁，投书也未必等得到回信；他会反复改一首寄赠诗，担心一个称谓被故人读出别样意思。'
      });
    }
  },
  {
    name: '崔铉',
    what: '官职与所在：开局时在江陵李石幕中任荆南节度掌书记，会昌初才入朝为左拾遗（原账写长安的「文臣」，来历写「早历朝职」）',
    source: '《旧唐书·崔元略传附崔铉》「三辟諸侯府，荊南、西蜀掌書記。會昌初，入為左拾遺」；《新唐书·崔铉传》「從李石荊南為賓佐」「鉉入朝，凡三歲至宰相，而石猶在江陵」',
    apply(c) {
      setOffice(c, { official: '荆南节度掌书记' });
      c.location = '江陵府';
      setText(c, {
        background: '崔元略之子，进士出身，有文章才，三辟诸侯府。身处崔氏显族，家世使人肯看他的名刺，也使同辈处处计较他的升沉是否过快。',
        description: '他在李石的荆南幕府掌书记，替节帅起草表奏与檄牒。新君初立的消息传到江陵，翰林与中书的人选议论也随书信而来；他急于呈示文才，不愿总在幕中候荐，遇前辈压下文章，便会另觅传递的门路。'
      });
    }
  },
  {
    name: '李景让',
    what: '官职：开成四年由华州刺史入为礼部侍郎，五年主持贡举（原账写「文臣」）',
    source: '《旧唐书·忠义传下·李景让》「四年，入為禮部侍郎。五年，選貢士李蔚」；《新唐书·李景让传》「歷中書舍人、禮部侍郎」',
    apply(c, scenario) {
      setOffice(c, { official: '礼部侍郎', concurrent: ['知贡举'] });
      assignPost(scenario, '礼部侍郎', c);
      setText(c, {
        description: '开成四年由华州刺史入为礼部侍郎，今春主持贡举。荐书与请托一同来到，他愿就举子的文行发表意见，却不愿在酒席间口头担保；有人指他不通情面，他宁可少一个交往。'
      });
      addCareer(c, '开成四年', '礼部侍郎', '由华州刺史入为礼部侍郎，次年春主持贡举。');
    }
  },
  {
    name: '姚勖',
    what: '所在与兼职：以盐铁推官知河阴院，开局时在河阴（河南府），不在长安；字斯勤，姚崇之后',
    source: '《旧唐书·韦温传》「鹽鐵判官姚勖知河陰院，嘗雪冤獄」；《资治通鉴》卷二四六「上乃以勖檢校禮部郎中，依前鹽鐵推官」；《新唐书·姚崇传附姚勖》「勖字斯勤」',
    apply(c) {
      setOffice(c, { official: '盐铁推官', concurrent: ['知河阴院'], honorary: ['检校礼部郎中'] });
      Object.assign(c, { location: '河南府·洛阳', zi: '斯勤', family: '姚氏（姚崇之后）' });
    }
  },
  {
    name: '白敏中',
    what: '官职与所在：以殿中侍御史为邠宁节度副使（节帅苻澈开成四年六月到任），开局时多半在邠州（原账写长安的「文臣」）',
    source: '《新唐书·白敏中传》「改殿中侍御史，為符澈邠寧副使」；《旧唐书·文宗纪下》开成四年「以長武城使苻澈為邠寧節度」。旧传作会昌初殿中侍御史分司东都，二书不一，从新传',
    apply(c) {
      setOffice(c, { official: '殿中侍御史', concurrent: ['邠宁节度副使'] });
      c.location = '邠州';
      setText(c, {
        description: '他以殿中侍御史在邠宁节度使苻澈幕中为副使，军府钱粮、边军给赐都要经手。新君即位的诏书到了邠州，洛阳来信问候从兄病况，京中友人谈官缺，白敏中两边都回得妥帖，却不愿终身只被称作白公之弟。'
      });
    }
  },
  {
    name: '赵归真',
    what: '所在：宝历二年文宗即位时配流岭南，开成五年秋才奉召入禁中；开局时不在长安（原账写他在京师托人求见）',
    source: '《旧唐书·文宗纪上》宝历二年「道士趙歸真，並配流嶺南」；《旧唐书·武宗纪》开成五年「是秋，召道士趙歸真等八十一人入禁中」、「我爾時已識此道人……只呼趙鍊師」',
    apply(c) {
      c.location = '广州';
      setText(c, {
        background: '以道术出入敬宗宫中，熟悉斋醮仪范，也懂得向有权势的人谈清静养生。颍王那时便识得这位「赵炼师」。',
        description: '宝历二年文宗即位，他与僧惟真等一同配流岭南，此后十余年行迹不显。新君即位的消息传到岭南，他盼着召还，收拾经箓与随身器物，等京中故人传话；若儒臣当面质疑，便把方术之争转作三教得失。',
        personalGoal: '得新君召还京师，建立宫中的供奉与讲论地位。'
      });
    }
  },
  {
    name: '裴休',
    what: '官职：本传大和初历监察御史、右补阙、史馆修撰，会昌中「自尚书郎历典数郡」，开局时的具体郎官无考，写「尚书郎」（原账写「文臣」）；郡望去掉「另核」',
    source: '《旧唐书·裴休传》「入為監察御史、右補闕、史館修撰。會昌中，自尚書郎歷典數郡」',
    apply(c) {
      setOffice(c, { official: '尚书郎' });
      c.family = '裴氏（裴肃之子，济源人）';
    }
  },
  {
    name: '李躔',
    rename: ['李回', '李躔'],
    what: '名字与来历：开局时仍名李躔、字昭回，避武宗讳改名李回、字昭度是即位以后的事；原账来历写「曾佐魏博幕府」，本传是滑台从事、扬州掌书记，他与魏博打交道是会昌三年奉使河朔',
    source: '《新唐书·宗室宰相传·李回》「本名躔，字昭回，避武宗諱改焉」；《旧唐书·李回传》「釋褐滑臺從事，揚州掌書記，得監察御史……開成初，以庫部郎中知制誥，拜中書舍人」、会昌三年「乃命回奉使河朔」',
    apply(c) {
      Object.assign(c, { zi: '昭回', aliases: ['李回'] });
      setText(c, {
        background: '宗室郇王祎之后。长庆初进士擢第，又登贤良方正制科，释褐滑台从事、扬州掌书记，入朝历补阙、起居郎，为李德裕所知。开成初以库部郎中知制诰，拜中书舍人。',
        diction: '发问清楚，避免先争忠逆；私下谈藩镇时会用军府里听得懂的词。'
      });
    }
  },
  {
    name: '李翱',
    what: '已殁：大和九年出为山南东道节度使，开成元年七月殷侑已接任，新传记他卒于山南东道任上，开局时已不在（旧传「會昌中，卒於鎮」与旧纪矛盾）',
    source: '《旧唐书·文宗纪下》大和九年「以戶部侍郎李翱檢校禮部尚書，充山南東道節度使」、开成元年「刑部尚書殷侑檢校右僕射，充山南東道節度使」；《新唐书·李翱传》「山南東道節度使，卒」',
    apply(c) {
      markDead(c, {});
      setOffice(c, { official: '故·山南东道节度使' });
      setText(c, {
        background: '韩愈门下后学，也是韩氏姻亲，提倡古文，撰《复性书》，力图从性情修养谈到政治。历幕府与台省，出为湖南观察使，入为刑部、户部侍郎，大和九年出镇山南东道。',
        description: '开成元年卒于山南东道节度使任上。',
        personalGoal: ''
      });
    }
  },
  {
    name: '李珏',
    what: '年龄：大中七年卒、年六十九，生于贞元元年，开局 54 岁（原账 56）；兼监修国史',
    source: '《新唐书·李珏传》「卒，年六十九」；《旧唐书·李珏传》「大中七年卒」；《新唐书·杨嗣复传》「玨監修國史」',
    apply(c) {
      setOffice(c, { official: c.officialTitle, concurrent: ['监修国史'] });
      Object.assign(c, { age: 54, birthYear: 785 });
    }
  },
  {
    name: '仇士良',
    what: '年龄、字与兼衔：会昌三年卒、享年六十三，生于建中二年，开局 58 岁（原账 59）；字匡美；兼知内侍省事、左街功德使，特进、骠骑大将军为加衔',
    source: '郑薰《内侍省监楚国公仇士良神道碑》（《全唐文》卷七九〇）「九年五月拜左神策軍中尉兼左街功德使，將軍知省事如故」「優詔加特進」「尋遷驃騎大將軍」「享年六十有三」；《新唐书·宦者传上·仇士良》「仇士良，字匡美」',
    apply(c) {
      setOffice(c, { official: '左神策军中尉', concurrent: ['知内侍省事', '左街功德使'], honorary: ['特进', '骠骑大将军'] });
      Object.assign(c, { age: 58, birthYear: 781, zi: '匡美' });
    }
  },
  {
    name: '鱼弘志',
    what: '加衔：甘露事变后进右卫上将军，兼中尉如故',
    source: '《新唐书·宦者传上·仇士良》「事平……弘誌右衞上將軍兼中尉」',
    apply(c) { setOffice(c, { official: '右神策军中尉', honorary: ['右卫上将军'] }); }
  },
  {
    name: '王才人',
    what: '年龄：十三岁入宫，穆宗（820—824 在位）以赐颍王，开局至少 27 岁（原账 24）；确切生年无考，取可能的最小值',
    source: '《新唐书·后妃传下·武宗王贤妃》「年十三，善歌舞，得入宮中。穆宗以賜潁王」',
    apply(c) { c.age = 27; }
  },
  {
    name: '杨嗣复',
    what: '临时使职与郡望：文宗崩后摄冢宰；郡望弘农杨氏（原账「郡望与具体支系另核」）；大中二年卒年六十六，生于建中四年',
    source: '《资治通鉴》卷二四六「以楊嗣復攝塚宰」；《旧唐书·杨嗣复传》「大中二年……卒，時年六十六」；《旧唐书·杨於陵传》「楊於陵，字達夫，弘農人」',
    apply(c) {
      setOffice(c, { official: c.officialTitle, concurrent: ['摄冢宰'] });
      Object.assign(c, { family: '弘农杨氏（杨於陵之子）', birthYear: 783 });
      addCareer(c, '开成四年十一月', '门下侍郎·同平章事', '由中书侍郎进门下侍郎。');
    }
  },
  {
    name: '郑覃',
    what: '郡望：荥阳郑氏（原账「具体支系另核」）；开成四年五月罢相守左仆射',
    source: '《旧唐书·郑覃传》「鄭覃，故相珣瑜之子」「封滎陽郡公」「四年五月，罷相，守左僕射」',
    apply(c) {
      c.family = '荥阳郑氏（郑珣瑜之子）';
      addCareer(c, '开成四年五月', '尚书左仆射', '罢知政事，守左仆射。');
    }
  },
  {
    name: '陈夷行',
    what: '补履历：开成四年九月检校礼部尚书，出为华州刺史、镇国军防御使',
    source: '《旧唐书·陈夷行传》「四年九月，檢校禮部尚書，出為華州刺史」；《旧唐书·文宗纪下》「以吏部侍郎陳夷行為華州鎮國軍防禦使」',
    apply(c) {
      setOffice(c, { official: '华州刺史', concurrent: ['镇国军防御使'], honorary: ['检校礼部尚书'] });
      addCareer(c, '开成四年九月', '华州刺史', '罢相后检校礼部尚书，出为华州刺史、镇国军防御使。');
    }
  },
  {
    name: '李宗闵',
    what: '补履历：开成四年十二月由杭州刺史改太子宾客分司东都',
    source: '《旧唐书·文宗纪下》开成四年「以杭州刺史李宗閔為太子賓客，分司東都」',
    apply(c) { addCareer(c, '开成四年十二月', '太子宾客·分司东都', '由杭州刺史改太子宾客，分司东都。'); }
  },
  {
    name: '杜悰',
    what: '字与生年：字永裕；咸通十四年卒、年八十，生于贞元十年；判度支是使职，与户部尚书分列',
    source: '《新唐书·杜悰传》「悰，字永裕」「卒，年八十」；《资治通鉴》卷二四六开成四年「楊嗣復、李玨因請除悰戸部尚書」',
    apply(c, scenario) {
      setOffice(c, { official: '户部尚书', concurrent: ['判度支'], honorary: ['驸马都尉'] });
      assignPost(scenario, '判度支', c);
      Object.assign(c, { zi: '永裕', birthYear: 794 });
      addCareer(c, '开成四年四月', '户部尚书·判度支', '文宗称其理财之才，杨嗣复、李珏请除户部尚书，仍判度支。');
    }
  },
  {
    name: '魏谟',
    what: '生年：大中十二年十二月卒、年六十六，生于贞元九年',
    source: '《旧唐书·魏谟传》「十二年十二月卒，時年六十六」',
    apply(c) {
      c.birthYear = 793;
      addCareer(c, '开成四年', '谏议大夫', '拜谏议大夫，仍兼起居舍人、判弘文馆事。');
    }
  },
  {
    name: '周墀',
    what: '补履历：开成四年十月正拜中书舍人，翰林学士如故',
    source: '《旧唐书·周墀传》「四年十月，正拜中書舍人，內職如故」',
    apply(c) { addCareer(c, '开成四年十月', '中书舍人·翰林学士', '正拜中书舍人，翰林学士如故。'); }
  },
  {
    name: '崔郸',
    what: '补履历：开成四年七月以太常卿同平章事，十一月为中书侍郎',
    source: '《新唐书·宰相表下》开成四年「七月甲辰，太常卿崔鄲同中書門下平章事」「十一月壬午……鄲為中書侍郎」',
    apply(c) { addCareer(c, '开成四年七月', '同平章事', '以太常卿同中书门下平章事，十一月加中书侍郎。'); }
  },
  {
    name: '韦温',
    what: '字与郡望：字弘育，京兆韦氏（韦绶之子）；原账为空',
    source: '《新唐书·韦温传》「溫，字弘育」；《旧唐书·韦温传》',
    apply(c) { Object.assign(c, { zi: '弘育', family: '京兆韦氏（韦绶之子）' }); }
  },
  {
    name: '郑肃',
    what: '履历日期、字与年龄：开成四年闰正月由吏部侍郎检校礼部尚书，出为河中晋绛慈隰等州节度使（原账写「开局前·月日未详」）；字乂敬；元和三年登进士第，原账 49 岁则登第时仅十七八岁，按登第时二十二岁推为 52 岁；生平里「敬宗崩后，他参与议礼」两传不载（为敬宗室祝版称谓发议的是崔龟从），删去；与裴夷直的「丧礼谏议」关系无据（开局时他在河中），删去',
    source: '《旧唐书·文宗纪下》开成四年「閏月甲申朔，以吏部侍郎鄭肅檢校禮部尚書、河中晉絳慈隰等州節度使」；《旧唐书·郑肃传》「元和三年，擢進士第……太和初，入朝為尚書郎。六年，轉太常少卿。……博士以下必就肅決之」；《新唐书·郑肃传》「鄭肅，字乂敬」',
    apply(c, scenario) {
      c.career = (c.career || []).filter((e) => e.date !== '开局前·月日未详');
      addCareer(c, '开成四年闰正月', '河中节度使', '由吏部侍郎检校礼部尚书，出为河中尹、河中晋绛慈隰等州节度使。');
      Object.assign(c, { zi: '乂敬', age: 52 });
      swapText(c, 'background', '历太常少卿。敬宗崩后，他参与议礼；文宗所立太子', '历太常少卿，博士有疑议必就他决断。文宗所立太子');
      dropRelation(scenario, '郑肃', '裴夷直');
    }
  },
  {
    name: '李绅',
    what: '兼职与加衔：汴州刺史、宋亳汴颍观察等使，开成四年就加检校兵部尚书（原账加衔为空）',
    source: '《旧唐书·李绅传》「六月，檢校戶部尚書、汴州刺史、宣武節度、宋亳汴潁觀察等使。……四年，就加檢校兵部尚書」',
    apply(c) { setOffice(c, { official: '宣武节度使', concurrent: ['汴州刺史', '宋亳汴颍观察使'], honorary: ['检校兵部尚书'] }); }
  },
  {
    name: '刘沔',
    what: '年龄、字与加衔：新传卒年六十五，会昌末卒，开局约 57 岁（原账 67）；字子汪；兼单于大都护，开成中以破党项功加检校户部尚书',
    source: '《新唐书·刘沔传》「劉沔，字子汪」「卒，年六十五」；《旧唐书·刘沔传》「移授振武節度使，檢校右散騎常侍、單於大都護。開成中……以功加檢校戶部尚書」',
    apply(c) {
      setOffice(c, { official: '振武节度使', concurrent: ['单于大都护'], honorary: ['检校户部尚书'] });
      Object.assign(c, { age: 57, zi: '子汪' });
    }
  },
  {
    name: '石雄',
    what: '官职：太和中召隶振武刘沔军为裨将，文宗以王智兴之故久不提擢（原账写「振武将领」）',
    source: '《旧唐书·石雄传》「乃召還，隸振武劉沔軍為裨將，累立破羌之功。文宗以智興故，未甚提擢，而李紳、李德裕以崔群舊將，素嘉之」',
    apply(c) { setOffice(c, { official: '振武军裨将' }); }
  },
  {
    name: '王宰',
    what: '官职、所在与来历：新传「甘露之变，以功兼御史大夫，为光州刺史……除盐州刺史」，开成中由田牟代为盐州刺史，此后至会昌三年为邠宁节度使之间的任官无考；原账写太原的「将领」（他镇河东在会昌四年以后），改为前盐州刺史，暂置长安；王智兴是怀州温县人，原账写「太原王氏将门子弟」无据',
    source: '《新唐书·王智兴传附王宰》「少拳果，長隸神策軍。甘露之變，以功兼御史大夫，為光州刺史。……除鹽州刺史。持法嚴，人不甚便。累擢邠寧慶節度使」；《册府元龟》「田牟開成中為隴州刺史會鹽州刺史王宰好以法臨黨項羌人不安以牟寬厚故命易之」；《旧唐书·王智兴传》「王智興，字匡諫，懷州溫縣人也」',
    apply(c) {
      setOffice(c, { official: '前盐州刺史' });
      c.location = '京兆府·长安';
      swapText(c, 'background', '太原王氏将门子弟，王智兴之子，历宿卫军职', '怀州温县将门子弟，王智兴之子，长隶神策军，甘露之变后历光州、盐州刺史');
    }
  },
  {
    name: '朱邪赤心',
    what: '身份与所在：朱邪执宜死后嗣领沙陀部众，开成四年回鹘宰相掘罗勿以马三百借其兵攻彰信可汗；沙陀此时居代北云、朔塞下，隶河东节度，不在振武（原账写单于都护府的「沙陀部将」）；字德兴',
    source: '《新唐书·沙陀传》「授執宜陰山府都督、代北行營招撫使，隸河東節度」「執宜死，子赤心嗣。開成四年……宰相掘羅勿以良馬三百遺赤心，約共攻彰信可汗」；《旧五代史·武皇纪上》注引神道碑「公諱國昌，字德興」',
    apply(c) {
      c.officialTitle = ''; c.title = '沙陀首领'; c.role = '沙陀首领'; c.occupation = '沙陀首领';
      Object.assign(c, { location: '朔州', zi: '德兴' });
      swapText(c, 'background', '沙陀朱邪氏部将，随族众', '朱邪执宜之子，执宜死后嗣领沙陀部众，随族众');
    }
  },
  {
    name: '何进滔',
    what: '加衔与性格：累检校司徒、同中书门下平章事（原账加衔为空）；原账性格写「对部下过失常纵容，怕严惩少数人会使更多人寒心」，与受推之初即斩杀害前帅者九十余人的记载相反，改',
    source: '《新唐书·藩镇魏博·何进滔传》「孰殺前使及監軍者，疏出之。凡斬九十餘人，釋脅從者」「進累檢校司徒、同中書門下平章事」',
    apply(c) {
      setOffice(c, { official: '魏博节度使', honorary: ['检校司徒', '同中书门下平章事'] });
      swapText(c, 'personality', '对部下过失常纵容，怕严惩少数人会使更多人寒心。', '寻常过失肯宽，危及军府的大恶却下得了重手。');
    }
  },
  {
    name: '何重霸',
    what: '官职、字与年龄：墓志记太和四年起「以大理卿副戎事」，通鉴记何进滔卒时他是都知兵马使，是魏博事实上的嗣帅（原账写「魏博牙将」）；会昌元年才赐名重顺，后又名弘敬，开局仍名重霸；字子肃，咸通七年卒享年六十，开局 32 岁',
    source: '《资治通鉴》卷二四六「魏博節度使何進滔薨，軍中推其子都知兵馬使重順知留後」；《旧唐书·武宗纪》会昌元年六月「制以魏博兵馬留後何重霸……仍賜名重順」；《何弘敬墓志》',
    apply(c) {
      setOffice(c, { official: '魏博节度副使', concurrent: ['都知兵马使'], honorary: ['御史大夫'] });
      Object.assign(c, { zi: '子肃', age: 32, birthYear: 807, aliases: ['何重顺', '何弘敬'] });
      setText(c, {
        background: '何进滔之子，成长于魏博军府，久在军中，为魏博节度副使、都知兵马使。父亲的威望来自多年共事的牙将，他虽统领诸营，未必能使每一名老将同样服气。',
        description: '新朝消息传到魏州，诸营都在看他如何接过父亲的担子。他想亲自办妥一件调兵或交涉，却又不愿事事被父亲旧部重新审过；宴席上爽快答应的赏给，回到案前才发现账房为难。',
        personalGoal: '在诸营老将中立起自己的威信。'
      });
    }
  },
  {
    name: '王元逵',
    what: '年龄与加衔：新传大中八年卒、年四十三，生于元和七年，开局 27 岁（原账 28）；累迁检校左仆射',
    source: '《新唐书·王廷凑传附王元逵》「大中八年死，年四十三」；《旧唐书·王廷凑传附王元逵》「累遷檢校左僕射」',
    apply(c) {
      setOffice(c, { official: '成德节度使', concurrent: ['镇州大都督府长史'], honorary: ['检校左仆射', '驸马都尉'] });
      Object.assign(c, { age: 27, birthYear: 812 });
    }
  },
  {
    name: '史元忠',
    what: '加衔：节度副大使、知节度事时转检校工部尚书（通王遥领节度大使）',
    source: '《旧唐书·杨志诚传附史元忠》「明年，轉檢校工部尚書、節度副大使，知節度事」',
    apply(c) { setOffice(c, { official: '卢龙节度使', honorary: ['检校工部尚书'] }); }
  },
  {
    name: '刘从谏',
    what: '加衔与年龄：开成四年十一月萧本案结后进位检校司徒（原账作检校司空）；新传卒年四十一，会昌三年卒，生于贞元十九年，开局 36 岁（原账 38）',
    source: '《旧唐书·刘从谏传》「從諫進位檢校司徒。會昌三年卒」；《新唐书·刘悟传附刘从谏》「卒，年四十一」',
    apply(c) {
      setOffice(c, { official: '昭义节度使', honorary: ['检校司徒', '同中书门下平章事'] });
      Object.assign(c, { age: 36, birthYear: 803 });
    }
  },
  {
    name: '刘稹',
    what: '官职：开局时职务无考，最早见于记载的是会昌三年刘从谏病重时所授的牙内都知兵马使；原账「昭义牙将」无据，改写身份',
    source: '《资治通鉴》卷二四七「以弟右驍衛將軍從素之子稹為牙內都知兵馬使」',
    apply(c) { c.officialTitle = ''; c.title = '刘从谏从子'; c.role = '刘从谏从子'; c.occupation = '刘从谏从子'; }
  },
  {
    name: '郑覃',
    what: '生平：原账把罢内官和籴、谏赏赐都系于文宗朝；实为宪宗元和十四年论罢内官充京西北和籴使、穆宗即位之初与同列谏游宴赏赐，只有奏请校定六籍、勒石太学是文宗朝事；与仇士良的关系原写「内官取财上的分歧」无据，改为有据的甘露后延英面诘',
    source: '《旧唐书·郑覃传》「元和十四年二月，遷諫議大夫。憲宗用內官五人為京西北和糴使，覃上疏論罷」「穆宗不恤政事，喜遊宴；即位之始……覃與同職崔玄亮等廷奏」；《旧唐书·李石传》「石與鄭覃嘗謂之曰：「京師之亂，始自訓、註；而訓、註之起，始自何人？」仇士良等不能對」',
    apply(c, scenario) {
      swapText(c, 'background', '文宗朝主持刊定石经，反对以内官主持京西北和籴，亦屡谏宫中赏赐。', '宪宗时上疏论罢以内官充京西北和籴使，穆宗初又与同列谏游宴、赏赐过厚；文宗朝奏请校定六籍、勒石太学。');
      relabelRelation(scenario, '郑覃', '仇士良', '延英面诘', '甘露变后延英议事，宦官动辄引训、注折宰相，郑覃与李石当面诘问训、注始因何人得进，仇士良等不能对。');
    }
  },
  {
    name: '崔郸',
    what: '生平与关系：崔郸是清河武城崔氏，崔珙是博陵安平崔氏，不是同族；原账「同族相亲」「同族往来」改为中枢同僚',
    source: '《旧唐书·崔邠传》「崔邠，字處仁，清河武城人」（崔郸为其弟）；《旧唐书·崔珙传》「崔珙，博陵安平人」',
    apply(c, scenario) {
      swapText(c, 'background', '他与崔珙同族相亲，所任职事却各有分际。', '他与崔珙虽同姓，却一出清河、一出博陵，所任职事亦各有分际。');
      relabelRelation(scenario, '崔郸', '崔珙', '中枢同僚');
    }
  },
  {
    name: '裴夷直',
    what: '郡望与字：河东裴氏（原账写「清河裴氏」），字礼卿',
    source: '《新唐书·王质传》「若河東裴夷直、天水趙皙……皆一時選云」；《全唐诗》卷五一三小传「裴夷直，字禮卿，河東人」',
    apply(c) {
      swapText(c, 'background', '出身清河裴氏', '出身河东裴氏');
      Object.assign(c, { zi: '礼卿', family: '河东裴氏' });
    }
  },
  {
    name: '李宗闵',
    what: '生平：开成元年由潮州司户量移衡州司马（原账作衢州；纪、鉴两处均作衡州，本传作衢州，从纪、鉴）',
    source: '《旧唐书·文宗纪下》「以潮州司戶李宗閔為衡州司馬」「以衡州司馬李宗閔為杭州刺史」',
    apply(c) { swapText(c, 'background', '量移衢州', '量移衡州'); }
  },
  {
    name: '赵归真',
    what: '关系：与李翱的「儒道之辩」、与裴休的「三教议论」都无史据（他宝历二年起流放岭南，李翱开成元年前后已卒），删去',
    source: '《旧唐书·文宗纪上》宝历二年「道士趙歸真，並配流嶺南」',
    apply(c, scenario) { dropRelation(scenario, '赵归真', '李翱'); dropRelation(scenario, '赵归真', '裴休'); }
  },
  {
    name: '裴休',
    what: '关系：与李翱的「经义往来」、与白居易的「诗文佛学交游」两传皆不载，删去',
    source: '《旧唐书·裴休传》所载佛学交游是「與義學僧講求佛理」；《新唐书·李翱传》',
    apply(c, scenario) { dropRelation(scenario, '裴休', '李翱'); dropRelation(scenario, '裴休', '白居易'); }
  },
  {
    name: '李躔',
    what: '关系：与何进滔的「魏博旧闻」是时代错（他与魏博打交道是会昌三年奉使河朔，那时魏博主帅已是何弘敬），删去',
    source: '《旧唐书·李回传》会昌三年「乃命回奉使河朔。魏博何弘敬、鎮冀王元逵皆具櫜鞬郊迎」',
    apply(c, scenario) {
      dropRelation(scenario, '李躔', '何进滔');
      setText(c, { background: c.background + '使府与中枢文书两边都见过，使他不容易被单方面的说辞打动。' });
    }
  }
];

// 字、生年等只补空缺、不改文字的
const BIRTH = { 白居易: 772, 刘禹锡: 772, 杜牧: 803 };

// ---------- 政治立场（原账是志向的抄件，人物字段去伪一刀已清空） ----------
// 依据见 sources/tang-research/ 各人的引文；只写开局前已成的关系，不写后来的事
const STANCES = {
  李瀍: '北司拥立的新君',
  李怡: '韬晦宗室',
  王才人: '潜邸宠姬',
  郭太皇太后: '五朝太母，不预外政',
  杨嗣复: '牛党·文宗首相',
  李珏: '牛党·主维陈王储位',
  崔郸: '中立·与李德裕兄弟素善',
  崔珙: '与李德裕亲厚',
  郑覃: '李党·经学宿相',
  陈夷行: '李党·与郑覃同道',
  裴夷直: '牛党·宗闵、嗣复所擢',
  李宗闵: '牛党魁首',
  杜悰: '驸马·理财，杨李所荐',
  李让夷: '李党·郑覃所荐',
  魏谟: '牛党·杨李所引',
  周墀: '文宗近臣·宗闵旧属',
  白居易: '不附两党·分司闲退',
  刘禹锡: '永贞旧人·分司闲居',
  杜牧: '牛僧孺旧幕·杜悰从弟',
  李商隐: '令狐门生·王茂元婿',
  仇士良: '北司·左军中尉·拥立',
  鱼弘志: '北司·右军中尉·拥立',
  刘弘逸: '枢密·附杨嗣复，意在安王',
  薛季棱: '枢密·附李珏，扶陈王',
  赵归真: '道士·颍王旧识',
  李躔: '李党·德裕所知',
  崔铉: '李石幕宾',
  李景让: '与牛党士人相善',
  韦温: '坚正中立·与杨李交好',
  姚勖: '与李德裕厚善',
  // 外镇与河朔
  郑肃: '太子永旧僚·礼学旧臣',
  李绅: '李党·德裕旧友',
  李德裕: '李党魁首',
  牛僧孺: '牛党魁首',
  李石: '甘露后维持政事的旧相',
  李固言: '牛党·杨嗣复同道',
  石雄: '李绅、德裕所器',
  王宰: '王智兴之子·神策旧将',
  朱邪赤心: '沙陀首领·隶河东',
  何进滔: '河朔自专·奉朝廷名分',
  何重霸: '魏博嗣帅',
  王元逵: '成德·尚公主，素怀忠顺',
  史元忠: '卢龙军中推立之帅',
  刘从谏: '昭义自专·抗表斥北司',
  // 新补长官里有史可据的
  崔琯: '宋申锡案中直言·德裕旧属',
  高铢: '论李训之谏臣',
  狄兼谟: '直谏之臣',
  李款: '劾郑注之直臣',
  归融: '杨嗣复所引',
  王彦威: '李宗闵所重·结交北司',
  薛元赏: '附李德裕维州之议',
  陈君奕: '北司·仇士良部将',
  王茂元: '甘露后赂两军自保'
};

// ---------- 拿不准、未改的 ----------
const UNVERIFIED = [
  '韦温：两唐书都说他文宗朝已出为陕虢观察使，但姚合开成四年八月才到陕虢，开局当天是右丞还是已出镇，无法确定；仍写尚书右丞在长安。',
  '裴休：开局时的具体郎官无考，只写「尚书郎」。',
  '白敏中：从新传写邠宁节度副使；旧传作会昌初殿中侍御史分司东都，二书不一。',
  '赵归真：宝历二年配流岭南以后的行迹史无明文，姑置岭南治所广州。',
  '姚勖：原账 36 岁与「长庆初擢进士第」不甚相合（登第时才十七八岁），生年无考，未改。',
  '夏绥银宥：开成三年十月所授的「高霞寓」与宝历二年已卒的元和名将同名，身份存疑，未补人，道长官空缺；金商、丹州查不到开成间的长官，空缺。',
  '天德温德彝、灵盐魏仲卿、泾原王茂元、凤翔陈君奕、兖海张贾、同州卢载、湖南李翊、容管胡沐：都是开局前最后一条可查的任命或开局后不久见于记载，其间有无更替史无明文，推定在任。陕虢姚合、义武韩威也可能在开局前已由韦温、陈君赏接替。',
  '王宰：开成中卸盐州刺史后至会昌三年为邠宁节度使之间的任官无考，暂置长安。刘稹：开局时职务、所在无考，仍置潞州。',
  '李固言：新传卒年七十八，若卒于大中末，开局约 57 岁（原账 62），卒年出自二手，未改。李石：卒年只能推定，原账 56 岁或高估两三岁，未改。',
  '多数人的生年两唐书无载（崔郸、崔珙、郑覃、陈夷行、裴夷直、李宗闵、李让夷、崔龟从、周墀、鱼弘志、刘弘逸、薛季棱、李躔、崔铉、李景让、韦温等），原账年龄是估计，未改。'
];

// ---------- 官缺：唐廷官制树在势力、顶层与登记表里各存一份，一并改 ----------

function officeCopies(scenario) {
  const fac = scenario.factions.find((f) => f.name === '唐朝廷');
  return [fac.officeTree, scenario.officeTree, scenario.officeRegistryByFaction['唐朝廷']];
}

// 每份官制树里取一个同名官缺：本人已任的优先，否则取第一个空缺
function pickPost(tree, postName, c) {
  const all = [];
  tree.forEach((o) => (o.positions || []).forEach((p) => { if (p.name === postName) all.push(p); }));
  return all.find((p) => p.holderId === c.id) || all.find((p) => !p.holderId) || null;
}

function assignPost(scenario, postName, c, rename) {
  officeCopies(scenario).forEach((tree) => {
    const p = pickPost(tree, postName, c);
    if (!p) throw new Error('官制树里没有空着的「' + postName + '」可给 ' + c.name);
    Object.assign(p, { holder: c.name, holderId: c.id, occupancyStatus: 'occupied' });
    if (rename) p.name = rename;
  });
}

function vacatePost(scenario, postName, c) {
  officeCopies(scenario).forEach((tree) => {
    const p = pickPost(tree, postName, c);
    if (!p || p.holderId !== c.id) throw new Error(c.name + ' 并不担任「' + postName + '」');
    Object.assign(p, { holder: '', holderId: '', occupancyStatus: 'unrecorded' });
  });
}

// ---------- 新补人物 ----------

// 家产史无可考，按原账唐廷在外节帅（卢钧、马植、李石、李固言、牛僧孺、李德裕、李绅、刘沔八人）的中位数估
const GOVERNOR_WEALTH = { money: 3530, grain: 140, cloth: 45, treasure: 465, slaves: 10, fame: 40, household: { money: 42, grain: 7, cloth: 0.3 } };
const POLARITY = {
  positive: { affinity: 62.5, trust: 40, respect: 50, fear: 0, hostility: 0, value: 25 },
  negative: { affinity: 40, trust: 25, respect: 45, fear: 0, hostility: 25, value: -20 }
};

function stableId(prefix, text) {
  return prefix + crypto.createHash('sha1').update('sc-tang840-840:' + text).digest('hex').slice(0, 12);
}

function genericPortrait(spec, index) {
  if (spec.military) return 'assets/portraits/tang840/generic/tang_military_mature_0' + (index % 2 + 1) + '.png';
  if (spec.age >= 55) return 'assets/portraits/tang840/generic/tang_civil_old_01.png';
  return 'assets/portraits/tang840/generic/tang_civil_young_0' + (index % 2 + 1) + '.png';
}

function healthByAge(age) { return age >= 65 ? 70 : age >= 55 ? 76 : age >= 45 ? 82 : 86; }

function buildCharacter(spec, index, scenario) {
  const id = stableId('char-', spec.name);
  const full = [spec.official, ...(spec.concurrent || [])].join('·');
  const s = spec.stats;
  const c = {
    id, sid: scenario.id, name: spec.name, title: full, officialTitle: spec.official, role: full,
    isPlayer: false, isRoyal: false, alive: true, age: spec.age, gender: '男', location: spec.location,
    faction: '唐朝廷', party: '', partyRank: '成员', rankLevel: 12, traits: [], personality: '',
    bio: [spec.background, spec.description].join('\n\n'), isHistorical: true,
    personalGoal: '', innerThought: '', stressSources: [], diction: '',
    resources: {
      privateWealth: {
        accounting: { schema: 'tm-character-economy/2' },
        money: GOVERNOR_WEALTH.money, grain: GOVERNOR_WEALTH.grain, cloth: GOVERNOR_WEALTH.cloth, land: 0,
        treasure: GOVERNOR_WEALTH.treasure, commerce: 0, slaves: GOVERNOR_WEALTH.slaves, debt: 0,
        landHoldings: [], houses: [], shops: [], treasures: [], livestock: [], investments: [], debts: [], receivables: [], familyBusiness: []
      },
      fame: GOVERNOR_WEALTH.fame, hiddenWealth: 0
    },
    career: (spec.career || []).map(([date, title, desc]) => ({ date, title, desc, milestone: false })),
    _memory: [], relations: {}, family: spec.family || '', stance: spec.stance || '',
    loyalty: s.loyalty, ambition: s.ambition, intelligence: s.intelligence, valor: s.valor, military: s.military,
    administration: s.administration, management: s.management, charisma: s.charisma, diplomacy: s.diplomacy,
    benevolence: s.benevolence, integrity: s.integrity, speechStyle: '', description: spec.description,
    aiPersonaText: '', health: healthByAge(spec.age), stress: 40, traitIds: [], partyIds: [],
    portrait: genericPortrait(spec, index), background: spec.background, personalGoals: [], occupation: full,
    rosterRole: spec.military ? 'mili' : 'civil', works: [],
    economyConfig: {
      accounting: { schema: 'tm-character-economy/2' }, incomeStreams: [],
      expenseStreams: [{ id: id + '-household', kind: 'household', label: '衣食、燃料与日用', monthly: Object.assign({}, GOVERNOR_WEALTH.household) }],
      supportArrangements: []
    },
    socialClass: spec.military ? 'militaryOfficial' : 'civilOfficial',
    appearance: '', ethnicity: '', faith: '', birthplace: spec.birthplace || '', birthTime: '', zi: spec.zi || '', haoName: '',
    familyTier: '', familyStatus: '', familyRole: '', mentor: '', hobbies: '', secret: '', learning: spec.learning || '', culture: '',
    familyMembers: spec.father ? [{ name: spec.father, relation: '父' }] : [], redLines: [], personalGrudges: [], skills: [],
    historicalSources: spec.sources.slice(), type: 'historical', isFictional: false, factionId: '唐朝廷'
  };
  if (spec.father) c.father = spec.father;
  if (spec.birthYear) c.birthYear = spec.birthYear;
  c.officialTitles = [spec.official, ...(spec.concurrent || [])];
  c.concurrentTitles = (spec.concurrent || []).slice();
  c.concurrentTitle = c.concurrentTitles.join('、');
  c.honoraryTitles = (spec.honorary || []).slice();
  c.wuchangOverride = Object.assign({}, spec.wuchang.scores);
  c.wuchangAssessment = { version: 1, kind: 'historical-inference', confidence: Object.assign({}, spec.wuchang.confidence), reference: 'assets/reference/tang840-wuchang.json', key: id };
  c.aiPersonaText = [c.bio, c.personality].filter(Boolean).join('\n\n');
  return c;
}

// 史载的交往：人物关系表与顶层关系各记一条，双方都记
function addRelations(scenario, c, list) {
  const byName = new Map(scenario.characters.map((x) => [x.name, x]));
  (list || []).forEach(([otherName, label, polarity, labelBack]) => {
    const other = byName.get(otherName);
    if (!other) throw new Error(c.name + ' 的交往对象 ' + otherName + ' 不在人物表');
    const p = POLARITY[polarity];
    [[c, other, label], [other, c, labelBack || label]].forEach(([from, to, type]) => {
      from.relations = from.relations || {};
      from.relations[to.name] = { affinity: p.affinity, trust: p.trust, respect: p.respect, fear: p.fear, hostility: p.hostility, labels: [type] };
      scenario.relations.push({ id: stableId('tang840-rel-', from.name + '→' + to.name), sid: scenario.id, from: from.name, to: to.name, fromId: from.id, toId: to.id, type, value: p.value });
    });
  });
}

// ---------- 各道长官：道节点与治所州写 governor，人物官称须与道官称一致 ----------

function assignGovernors(scenario, governors, leafGovernors, circuitTitles) {
  const byName = new Map(scenario.characters.map((x) => [x.name, x]));
  const circuits = new Map();
  TANG_TREES.forEach((key) => scenario.adminHierarchy[key].divisions.forEach((d) => circuits.set(d.name, d)));
  const touched = new Set();
  const rows = [];
  Object.keys(circuitTitles).forEach((name) => { circuits.get(name).officialPosition = circuitTitles[name]; });
  Object.keys(governors).forEach((circuitName) => {
    const circuit = circuits.get(circuitName);
    if (!circuit) throw new Error('没有这个道：' + circuitName);
    const c = byName.get(governors[circuitName]);
    if (!c) throw new Error(circuitName + ' 的长官 ' + governors[circuitName] + ' 不在人物表');
    if (c.officialTitle !== circuit.officialPosition) throw new Error(c.name + ' 的官称「' + c.officialTitle + '」与' + circuitName + '官称「' + circuit.officialPosition + '」不一致');
    const seat = leavesOf([circuit], []).find((l) => l.id === circuit.capitalChildId);
    if (c.location !== seat.name) throw new Error(c.name + ' 应在治所 ' + seat.name + '，实写 ' + c.location);
    circuit.governor = c.name;
    seat.governor = c.name;
    touched.add(seat);
    rows.push('| ' + circuitName + ' | ' + circuit.officialPosition + ' | ' + c.name + ' | ' + seat.name + '（' + seat.officialPosition + '） |');
  });
  // 另有长官的府州（河南府的河南尹、同州防御使）：人物官称须与府州官称一致，游戏按官称活绑定
  const leaves = [];
  TANG_TREES.forEach((key) => leavesOf(scenario.adminHierarchy[key].divisions, leaves));
  Object.keys(leafGovernors).forEach((leafName) => {
    const leaf = leaves.find((l) => l.name === leafName);
    const c = byName.get(leafGovernors[leafName]);
    if (!leaf || !c) throw new Error('找不到府州或长官：' + leafName + ' ' + leafGovernors[leafName]);
    if (c.officialTitle !== leaf.officialPosition) throw new Error(c.name + ' 的官称与' + leafName + '官称「' + leaf.officialPosition + '」不一致');
    leaf.governor = c.name;
    touched.add(leaf);
    rows.push('| （府州） | ' + leaf.officialPosition + ' | ' + c.name + ' | ' + leaf.name + ' |');
  });
  const byMap = new Map(scenario.map.regions.map((r) => [r.id, r]));
  touched.forEach((leaf) => {
    const data = JSON.parse(JSON.stringify(leaf));
    delete data.treasuryBinding;
    byMap.get(leaf.mapRegionId).data = data;
  });
  scenario.mapData = JSON.parse(JSON.stringify(scenario.map));
  return rows;
}

// 参考档按原文件的缩进、换行符与结尾写回
function sameFormat(raw, obj) {
  let out = JSON.stringify(obj, null, /^\{\r?\n {2}"/.test(raw) ? 2 : 0);
  if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n');
  if (/\r?\n$/.test(raw)) out += raw.includes('\r\n') ? '\r\n' : '\n';
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const before = new Map(scenario.characters.map((c) => [c.id, { name: c.name, location: c.location }]));
  const wuchangRaw = fs.readFileSync(WUCHANG_FILE, 'utf8');
  const wuchang = JSON.parse(wuchangRaw);
  const renames = [];
  FIXES.forEach((fix) => {
    if (fix.rename) {
      const [from, to] = fix.rename;
      const n = renameEverywhere(scenario, from, to);
      if (!n) throw new Error('全剧本找不到「' + from + '」');
      deepSwap(wuchang.characters, from, to); // 五常参考档的人名与评语一并改，引文（sources）不动
      renames.push('- 全剧本「' + from + '」→「' + to + '」共 ' + n + ' 处（史料引文不动）');
    }
    fix.apply(charByName(scenario, fix.name), scenario);
  });
  Object.keys(BIRTH).forEach((name) => { const c = charByName(scenario, name); if (!c.birthYear) c.birthYear = BIRTH[name]; });

  // 新补的开局在任长官：人物、五常参考档、史载交往、官缺
  const newRows = [];
  NEW_PEOPLE.forEach((spec, index) => {
    if (scenario.characters.some((x) => x.name === spec.name)) throw new Error(spec.name + ' 已在人物表');
    const c = buildCharacter(spec, index, scenario);
    scenario.characters.push(c);
    wuchang.characters[c.id] = { name: c.name, kind: 'historical-inference', initialScores: Object.assign({}, spec.wuchang.scores), confidence: Object.assign({}, spec.wuchang.confidence), note: spec.wuchang.note, sources: spec.wuchang.sources };
    addRelations(scenario, c, spec.relations);
    if (spec.post !== null) assignPost(scenario, spec.post || spec.official, c, spec.postRename);
    newRows.push('| ' + c.name + ' | ' + c.title + ' | ' + c.location + ' | ' + c.age + '（' + spec.ageBasis + '） | ' + spec.sources.length + ' 条 |');
  });
  const governorRows = assignGovernors(scenario, GOVERNORS, LEAF_GOVERNORS, CIRCUIT_TITLES);
  // 政治立场：原账是志向的抄件，人物字段去伪一刀已清空，这里按史料写
  Object.keys(STANCES).forEach((name) => { charByName(scenario, name).stance = STANCES[name]; });

  // 地点改了的人物：按运行时同一套规则核对能否落到地块
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(LOCATIONS_JS, 'utf8'), sandbox);
  const game = { mapData: scenario.map, factions: scenario.factions, characters: scenario.characters };
  const moved = [];
  scenario.characters.forEach((c) => {
    const old = before.get(c.id);
    if (!old || old.location === c.location) return;
    let bound = '（已殁，不落地块）';
    if (c.alive !== false) {
      const out = sandbox.TMMapLocations.resolveText(c.location, scenario.map, c, 'character', game);
      if (!out || !out.regionName) throw new Error(c.name + ' 的新所在「' + c.location + '」落不到地块');
      bound = out.regionName;
    }
    moved.push('| ' + c.name + ' | ' + old.location + ' | ' + c.location + ' | ' + bound + ' |');
  });

  // 自检：人物名、id 唯一；已殁者不再统兵、不居官缺
  const names = scenario.characters.map((c) => c.name);
  if (new Set(names).size !== names.length) throw new Error('改后人物名重复');
  const dead = new Set(scenario.characters.filter((c) => c.alive === false).map((c) => c.name));
  scenario.military.initialTroops.forEach((t) => { if (dead.has(t.commander)) throw new Error(t.name + ' 由已殁的 ' + t.commander + ' 统兵'); });

  const report = ['# 晚唐·史实人物逐人改正报告', '',
    '开局为开成五年正月十四（840 年 2 月 20 日）。以下 ' + FIXES.length + ' 项逐人改正官职、所在、生卒与相关文字；另为 ' + Object.keys(STANCES).length + ' 人按史料补写政治立场。', '',
    '## 逐项', ''];
  FIXES.forEach((fix) => report.push('- **' + fix.name + '**：' + fix.what + '。依据：' + fix.source));
  report.push('', '## 新补在任长官', '', '家产史无可考，按原账唐廷在外节帅八人的中位数估；性格、志向、辞令、内心独白史无明文，留空。', '',
    '| 人物 | 官职 | 所在 | 年龄（依据） | 史料 |', '| --- | --- | --- | --- | --- |', ...newRows,
    '', '## 各道长官', '', '| 道 | 官称 | 长官 | 治所 |', '| --- | --- | --- | --- |', ...governorRows);
  report.push('', '## 改名', '', ...renames,
    '', '## 政治立场', '', '| 人物 | 立场 |', '| --- | --- |', ...Object.keys(STANCES).map((n) => '| ' + n + ' | ' + STANCES[n] + ' |'),
    '', '## 所在改动与地块', '', '| 人物 | 原所在 | 改后 | 地块 |', '| --- | --- | --- | --- |', ...moved,
    '', '## 未改、待核', '', ...UNVERIFIED.map((s) => '- ' + s));
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    fs.writeFileSync(WUCHANG_FILE, sameFormat(wuchangRaw, wuchang));
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE) + ' 与 ' + path.relative(REPO, WUCHANG_FILE));
  }
}

main();
