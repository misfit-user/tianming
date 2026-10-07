// 身份档：同一张书案的骨架，按视角人物的身份换陈设、名目与读数——看书案就知道你是谁。
// 皇帝只是其中一档（官本位设计稿第九章「案头即身份」、第十三章 13.4「推演之后看到什么」）。
// 档由适配层 perspective().tier 现算；这里只管「这一档在界面上怎么呈现」，不碰内核。
// 只属某一档的字（朕、御案、诏书、奏疏、玉玺……）只许写在这里，界面代码一律从档里取（tools/newui/lint-ui-identity.cjs 守着）。
//
// 每档：
//   name     档名
//   room     书房（scene/study/room.js 的 ROOMS 键）
//   desk     案名；self 自称；enter 开场白收尾的那一下（落座）
//   seal     案底那方印：用印即交出本期拟好的令
//   channels 五渠道「令、批、书、见、行」在这一档叫什么（设计稿 9.2）
//   books    右列书目（瓦当）：[字, 名, 键]
//   tags     案上器物的牙牌
//   ledger   顶栏账簿：哪几本（键见 screens/desk.js 的 LEDGERS）
//   gauges   顶栏四品：realm 国势四项（吏治、民心、皇权、皇威），self 本人四项（名望、贤能、康健、心绪）
//   map      舆图视野：realm 全境；seat 京师居中；jurisdiction 辖区居中描边；home 本籍居中
//   ling     「令」那一页：纸面（silk 黄绫诏卷／paper 素纸）、议事清册、行止、私行、润色、颁行、档案诸名目，五类的提示，颁行前三种说法
//   abdicate 暂停卷里的「退位」：叫法、卷首按语、继承人标签、确认语（空则不列）
//   letters  「书」那一页：可发的文书种类（内核 LETTER_TYPES 的键）、抬头与署名、来函署名、名册与截获密函的叫法
//   audience 召对（「见」之问对）：自称与「曰」「对曰」、实录卷首、名单分组、诸动作的叫法
//   guide    进局「临朝须知」几条：[题, 说]
//   social   朝野册党派、阶层两页卷底的动作叫法（召人、付议、拟令；不设则不列）
//   bio      列传：称上之词（君上、今上）、对此人批注的叫法、身后追赠、看本人心志的叫法
//   annals   史记那一卷：卷名、令的叫法；archive 旧档总库（史馆）的册名，note 起居注上加批的叫法
//   issues   时政那一页：题名、拍板叫什么、召对与密问的名目、空时说什么
//   docket   「批」那一页：待批之件叫什么、批语叫什么、空时说什么、几枝签（[键, 字, 注]）；props 案上器物的换法

const CHANNEL_KEYS = ['ling', 'pi', 'shu', 'jian', 'xing'];

export const PROFILES = {
  sovereign: {
    name: '元首', room: 'sovereign', desk: '御案', self: '朕', enter: '臨朝',
    seal: { chars: ['诏', '付', '有', '司'], title: '诏付有司', note: '颁行已拟诏书' },
    channels: {
      ling: ['撰写诏书', '起草政令'], pi: ['百官奏疏', '御览奏报'], shu: ['鸿雁传书', '手札密谕'],
      jian: ['召对朝议', '问对·常朝·廷议'], xing: ['巡幸行止', '主角行止']
    },
    books: [['舆', '舆图', 'map'], ['人', '人物图志', 'people'], ['官', '官制', 'offices'], ['财', '财计', 'fiscal'], ['军', '军务', 'army'], ['势', '朝野', 'realm'], ['史', '史官实录', 'annals']],
    tags: { memorials: '奏折', tray: '时政花笺', letterbox: '信匣', writing: '笔砚', books: '史册', seal: '玉玺' },
    ledger: ['treasury', 'privy', 'census'], gauges: 'realm', map: 'realm',
    docket: {
      name: '奏疏', reply: '朱批', hint: '朱笔批注', empty: '案牍清净　百官无事启奏', excerpt: '摘入诏书',
      sign: '{title}臣{name}谨奏', signBare: '{name}谨奏',
      groups: { urgent: '急奏', pending: '启奏', held: '留中', done: '已批' },
      // 抬头：称君上之词另起一行高出两格（双抬），称朝廷之词高出一格（单抬）
      taitou: { double: ['皇上', '陛下', '圣上', '圣明', '圣恩', '圣裁', '圣躬', '天恩', '天颜', '宸衷', '宸断'], single: ['朝廷', '国家', '宗社', '社稷', '列祖', '祖宗', '天朝'] },
      verdicts: [['approved', '准', '依议准行'], ['rejected', '驳', '不准所请'], ['annotated', '批', '朱笔示意'], ['held', '留中', '暂不发下'],
        ['referred', '交部议', '着有司议处'], ['court_debate', '付廷议', '下廷臣会议'], ['summon', '召对', '召上奏者面询']]
    },
    issues: { title: '御案时政', decide: '圣裁', chosen: '已断', convene: '御前召对群臣', secret: '独召密问', empty: '四海升平　暂无要务', people: '关涉群臣' },
    urgentAck: '朕已知晓',
    bio: { lord: '君上', now: '今上', note: '御笔朱批', posthumous: '追赠', mind: '御览心志' },
    social: { summonParty: '召党魁', summonClass: '召代表', court: '付廷议', partyDraft: '拟平衡诏', classDraft: '拟安抚诏' },
    annals: { title: '史官实录', orders: '诏令', ownOrders: '本回诏令', echo: '诏令回响', decree: '诏书', archive: '史馆', note: '御批' },
    guideTitle: '临朝须知',
    guide: [['时政与奏疏', '点案上花笺看当前要务，点那摞奏折批阅臣下所请，心中有数。'], ['拟诏施政', '笔砚或「撰写诏书」下达旨意——施政、任免、征伐皆由此。'],
      ['召对朝议', '与群臣议事问对，听取异见。'], ['推演', '顶栏「推演」推进时局——AI 演绎天下对这一朝的反应。']],
    ling: {
      surface: 'silk', suggest: '议事清册', conduct: '主角行止', conductHint: '此期所为——如召见某臣、校阅三军、微服私访、祖庙祭祀……',
      private: '帝王私行', privateNote: '至多三项，后果由推演定', polish: '有司润色', promulgate: '钤玺颁行', archive: '往期诏令', done: '已颁之诏',
      empty: '今日无事，不如休息一番？天下太平，何必事事操心。', ready: '诏令已拟，是否颁行天下？', idle: '不理朝政，只顾享乐——如此甚好！',
      hints: { political: '诏谕天下，如：改革官制、降旨安抚、任免官员……', military: '调兵遣将，如：调动军队、加强边防、讨伐叛贼……',
        diplomatic: '纵横捭阖，如：遣使和亲、结盟讨伐、册封藩属……', economic: '经纶民生，如：减税轻赋、开仓放粮、兴修水利……', other: '其他旨意，如：大赦天下、科举取士、建造宫殿……' }
    },
    letters: {
      types: ['secret_decree', 'military_order', 'greeting', 'personal', 'proclamation'], dflt: 'personal',
      to: (n) => `致　${n}`, mine: '朱手书', theirs: (n, foreign) => (foreign ? `${n}　谨致` : `臣 ${n} 顿首`),
      far: '远方臣子', compose: '拟书', reply: '回书', send: '遣使', excerpt: '摘入诏书', hint: '致书远方臣子……',
      intercepted: '截获密函', idle: '择一位远方之人，以见书信往来', empty: '尚无书信往来', atCourt: '在京诸臣不必传书，宜召对面陈'
    },
    audience: {
      title: '召对', me: '上', ask: '曰', reply: '对曰', privateReply: '曰', input: '垂询', hint: '问其所知……', send: '垂询', leave: '退下',
      head: (name, formal) => (formal ? `召${name}入对` : `${name}入内叙话`), record: '起居注', privateRecord: '燕闲私语',
      pending: '阶下待见', seeking: '有臣求见', court: '在朝诸臣', away: '远方之人', accept: '接见', refuse: '不见', dismiss: '暂却',
      screen: '屏退左右', order: '面谕差遣', commits: '交办', excerpt: '摘入诏书', confront: '召人对质', reward: '赏', punish: '罚', adopt: '纳谏',
      envoy: { accept: '准奏', reject: '驳回', temporize: '羁縻', counter: '回价' }
    },
    abdicate: { name: '禅让退位', note: '传位于后人，此举不可逆', tags: { heir: '储君', 'heir-blood': '皇嗣' },
      ask: (who) => `确定将大位禅让给${who}？此举不可撤回。`, ok: '禅让', done: (who) => `禅让既成，${who}已继大位` },
    props: { seal: 'imperial', yellowMemorials: true }
  },
  minister: {
    name: '京官', room: 'ministry', desk: '公案', self: '本官', enter: '视事',
    seal: { chars: ['用', '印', '发', '文'], title: '用印发文', note: '发出已拟公文' },
    channels: {
      ling: ['行文', '题奏·咨文·札付'], pi: ['批详', '堂判公事'], shu: ['私书', '请托·结纳'],
      jian: ['谒见', '上官·同僚·会推'], xing: ['行止', '告假·出差']
    },
    books: [['舆', '舆图', 'map'], ['人', '人物图志', 'people'], ['官', '官制', 'offices'], ['邸', '邸报', 'gazette'], ['谱', '年谱', 'annals']],
    tags: { memorials: '咨文', tray: '案头要事', letterbox: '信匣', writing: '笔砚', books: '案卷', seal: '部印' },
    ledger: ['purse', 'wealth'], gauges: 'self', map: 'seat',
    docket: {
      name: '公文', reply: '批语', hint: '批语', empty: '案上无待批公文',
      excerpt: '摘录', sign: '{title}{name}呈', signBare: '{name}呈', groups: { urgent: '急件', pending: '待批', held: '存案', done: '已批' }, taitou: { double: [], single: [] },
      verdicts: [['approved', '准', '照准'], ['rejected', '驳', '驳回'], ['annotated', '批', '批示'], ['held', '存案', '暂存'],
        ['referred', '转详', '转上官'], ['court_debate', '会议', '付堂议'], ['summon', '传见', '传来面询']]
    },
    issues: { title: '案头要事', decide: '决断', chosen: '已断', convene: '集议', secret: '密询', empty: '案头无要事', people: '关涉之人' },
    urgentAck: '知道了',
    annals: { title: '年谱', orders: '公文', ownOrders: '本回公文', echo: '公文回响', decree: '公文', archive: '案牍库', note: '批注' },
    guideTitle: '视事须知',
    guide: [['案头要事', '先看案上公文与要事。'], ['行文', '笔砚行文，上奏下札。'], ['推演', '顶栏「推演」推进时局。']],
    ling: {
      surface: 'paper', suggest: '摘录', conduct: '行止', conductHint: '此期所为……', private: '私事', privateNote: '', polish: '润色', promulgate: '用印发文', archive: '往期公文', done: '已发之文',
      empty: '此期无文可发。', ready: '公文已拟，是否发出？', idle: '',
      hints: { political: '题奏、咨文……', military: '', diplomatic: '', economic: '', other: '' }
    },
    letters: {
      types: ['greeting', 'personal'], dflt: 'personal',
      to: (n) => `致　${n}`, mine: '手书', theirs: (n) => `${n}　拜上`,
      far: '远方故旧', compose: '拟书', reply: '回书', send: '寄出', excerpt: '摘录', hint: '致书远方……',
      intercepted: '风闻密函', idle: '择一位远方之人，以见书信往来', empty: '尚无书信往来', atCourt: '同城之人不必传书，宜登门拜会'
    },
    audience: {
      title: '谒见', me: '余', ask: '曰', reply: '曰', privateReply: '曰', input: '问', hint: '问其所知……', send: '相询', leave: '辞别',
      head: (name) => `与${name}相见`, record: '谈录', privateRecord: '私语',
      pending: '门外候见', seeking: '登门求见', court: '同城之人', away: '远方之人', accept: '相见', refuse: '不见', dismiss: '改日',
      screen: '屏退左右', order: '托付', commits: '托付之事', excerpt: '摘录', confront: '请人对质', reward: '馈赠', punish: '责备', adopt: '采纳',
      envoy: { accept: '允', reject: '却', temporize: '缓议', counter: '还价' }
    },
    abdicate: '',
    props: { seal: 'office', yellowMemorials: false }
  },
  provincial: {
    name: '地方官', room: 'yamen', desk: '公案', self: '本官', enter: '视事',
    seal: { chars: ['用', '印', '发', '文'], title: '用印发文', note: '发出已拟公文' },
    channels: {
      ling: ['行文', '札付·牌票·告示'], pi: ['批详', '申文·状纸'], shu: ['私书', '请托·结纳'],
      jian: ['谒见', '上官·属吏·士绅'], xing: ['行止', '巡视·告假']
    },
    books: [['舆', '舆图', 'map'], ['人', '人物图志', 'people'], ['官', '官制', 'offices'], ['册', '辖区册籍', 'registry'], ['邸', '邸报', 'gazette'], ['谱', '年谱', 'annals']],
    tags: { memorials: '申文', tray: '案头要事', letterbox: '信匣', writing: '笔砚', books: '案卷', seal: '官印' },
    ledger: ['jurisdiction', 'purse', 'wealth'], gauges: 'self', map: 'jurisdiction',
    docket: {
      name: '申文', reply: '堂批', hint: '堂批', empty: '案上无待批申文',
      excerpt: '摘录', sign: '{title}{name}呈', signBare: '{name}呈', groups: { urgent: '急件', pending: '待批', held: '存案', done: '已批' }, taitou: { double: [], single: [] },
      verdicts: [['approved', '准', '如详办理'], ['rejected', '驳', '驳令另议'], ['annotated', '批', '堂批'], ['held', '存案', '暂存'],
        ['referred', '转详', '详报上司'], ['court_debate', '会议', '集议'], ['summon', '传讯', '传来面询']]
    },
    issues: { title: '案头要事', decide: '决断', chosen: '已断', convene: '集议', secret: '密询', empty: '案头无要事', people: '关涉之人' },
    urgentAck: '知道了',
    annals: { title: '年谱', orders: '公文', ownOrders: '本回公文', echo: '公文回响', decree: '公文', archive: '案牍库', note: '批注' },
    guideTitle: '视事须知',
    guide: [['案头要事', '先看案上申文与要事。'], ['行文', '笔砚行文，札付告示。'], ['推演', '顶栏「推演」推进时局。']],
    ling: {
      surface: 'paper', suggest: '摘录', conduct: '行止', conductHint: '此期所为……', private: '私事', privateNote: '', polish: '润色', promulgate: '用印发文', archive: '往期公文', done: '已发之文',
      empty: '此期无文可发。', ready: '公文已拟，是否发出？', idle: '',
      hints: { political: '札付、牌票、告示……', military: '', diplomatic: '', economic: '', other: '' }
    },
    letters: {
      types: ['greeting', 'personal'], dflt: 'personal',
      to: (n) => `致　${n}`, mine: '手书', theirs: (n) => `${n}　拜上`,
      far: '远方故旧', compose: '拟书', reply: '回书', send: '寄出', excerpt: '摘录', hint: '致书远方……',
      intercepted: '风闻密函', idle: '择一位远方之人，以见书信往来', empty: '尚无书信往来', atCourt: '同城之人不必传书，宜登门拜会'
    },
    audience: {
      title: '谒见', me: '余', ask: '曰', reply: '曰', privateReply: '曰', input: '问', hint: '问其所知……', send: '相询', leave: '辞别',
      head: (name) => `与${name}相见`, record: '谈录', privateRecord: '私语',
      pending: '门外候见', seeking: '登门求见', court: '同城之人', away: '远方之人', accept: '相见', refuse: '不见', dismiss: '改日',
      screen: '屏退左右', order: '托付', commits: '托付之事', excerpt: '摘录', confront: '请人对质', reward: '馈赠', punish: '责备', adopt: '采纳',
      envoy: { accept: '允', reject: '却', temporize: '缓议', counter: '还价' }
    },
    abdicate: '',
    props: { seal: 'office', yellowMemorials: false }
  },
  gentry: {
    name: '不在官', room: 'study', desk: '书案', self: '', enter: '入座',
    seal: { chars: ['钤', '印', '封', '缄'], title: '钤印封缄', note: '发出已拟家令、书札' },
    channels: {
      ling: ['家令', '族规·公呈'], pi: ['家事', '家事·乡事'], shu: ['书信', '投书·往还'],
      jian: ['拜谒', '谒见·文会'], xing: ['行止', '应试·游学·回籍']
    },
    books: [['舆', '舆图', 'map'], ['人', '人物图志', 'people'], ['族', '家族', 'family'], ['产', '产业', 'estate'], ['邸', '邸报', 'gazette'], ['谱', '年谱', 'annals']],
    tags: { memorials: '书札', tray: '案头要事', letterbox: '信匣', writing: '笔砚', books: '书册', seal: '私印' },
    ledger: ['wealth'], gauges: 'self', map: 'home',
    docket: {
      name: '书札', reply: '批语', hint: '批语', empty: '案上无待办之事',
      excerpt: '摘录', sign: '{title}{name}呈', signBare: '{name}呈', groups: { urgent: '急件', pending: '待批', held: '存案', done: '已批' }, taitou: { double: [], single: [] },
      verdicts: [['approved', '允', '允行'], ['rejected', '却', '回绝'], ['annotated', '批', '批语'], ['held', '存', '暂存']]
    },
    issues: { title: '案头要事', decide: '主意', chosen: '已定', convene: '商议', secret: '私问', empty: '无事萦怀', people: '关涉之人' },
    urgentAck: '知道了',
    annals: { title: '年谱', orders: '家令', ownOrders: '本回家令', echo: '回响', decree: '家令', archive: '家乘', note: '眉批' },
    guideTitle: '入座须知',
    guide: [['家事乡事', '先看案上书札与家事。'], ['书信', '信匣往还，结交师友。'], ['推演', '顶栏「推演」推进时局。']],
    ling: {
      surface: 'paper', suggest: '摘录', conduct: '行止', conductHint: '此期所为……', private: '私事', privateNote: '', polish: '润色', promulgate: '钤印封缄', archive: '往期书札', done: '已发之札',
      empty: '此期无事。', ready: '书札已拟，是否发出？', idle: '',
      hints: { political: '家令、公呈……', military: '', diplomatic: '', economic: '', other: '' }
    },
    letters: {
      types: ['greeting', 'personal'], dflt: 'personal',
      to: (n) => `致　${n}`, mine: '手书', theirs: (n) => `${n}　拜上`,
      far: '远方故旧', compose: '拟书', reply: '回书', send: '寄出', excerpt: '摘录', hint: '致书远方……',
      intercepted: '风闻密函', idle: '择一位远方之人，以见书信往来', empty: '尚无书信往来', atCourt: '同城之人不必传书，宜登门拜会'
    },
    audience: {
      title: '谒见', me: '余', ask: '曰', reply: '曰', privateReply: '曰', input: '问', hint: '问其所知……', send: '相询', leave: '辞别',
      head: (name) => `与${name}相见`, record: '谈录', privateRecord: '私语',
      pending: '门外候见', seeking: '登门求见', court: '同城之人', away: '远方之人', accept: '相见', refuse: '不见', dismiss: '改日',
      screen: '屏退左右', order: '托付', commits: '托付之事', excerpt: '摘录', confront: '请人对质', reward: '馈赠', punish: '责备', adopt: '采纳',
      envoy: { accept: '允', reject: '却', temporize: '缓议', counter: '还价' }
    },
    abdicate: '',
    props: { seal: 'private', yellowMemorials: false }
  }
};

// 将来的档（将帅、宗室、商人……）未立之前，就近借用
const NEAREST = { general: 'provincial', prince: 'gentry', merchant: 'gentry' };

export function profileOf(p) {
  const tier = (p && p.tier) || 'sovereign';
  const prof = PROFILES[tier] || PROFILES[NEAREST[tier]] || PROFILES.sovereign;
  // 自称：不在官的自称其名（去姓）；其余照档
  const bare = p && p.name ? String(p.name).replace(/[（(].*$/, '') : '';
  const self = prof.self || (bare.length > 1 ? bare.slice(1) : bare);
  return { tier, ...prof, self, channels: CHANNEL_KEYS.map((key) => ({ key, title: prof.channels[key][0], sub: prof.channels[key][1] })) };
}
