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
//   docket   案头待批之件叫什么；props 案上器物的换法

const CHANNEL_KEYS = ['ling', 'pi', 'shu', 'jian', 'xing'];

export const PROFILES = {
  sovereign: {
    name: '元首', room: 'sovereign', desk: '御案', self: '朕', enter: '臨朝',
    seal: { chars: ['诏', '付', '有', '司'], title: '诏付有司', note: '颁行已拟诏书' },
    channels: {
      ling: ['撰写诏书', '起草政令'], pi: ['百官奏疏', '御览奏报'], shu: ['鸿雁传书', '手札密谕'],
      jian: ['召对朝议', '问对·常朝·廷议'], xing: ['巡幸行止', '主角行止']
    },
    books: [['舆', '舆图', 'map'], ['人', '人物图志', 'people'], ['官', '官制', 'offices'], ['财', '财计', 'fiscal'], ['军', '军务', 'army'], ['史', '史官实录', 'annals']],
    tags: { memorials: '奏折', tray: '时政花笺', letterbox: '信匣', writing: '笔砚', books: '史册', seal: '玉玺' },
    ledger: ['treasury', 'privy', 'census'], gauges: 'realm', map: 'realm',
    docket: '奏疏', props: { seal: 'imperial', yellowMemorials: true }
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
    docket: '公文', props: { seal: 'office', yellowMemorials: false }
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
    docket: '申文', props: { seal: 'office', yellowMemorials: false }
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
    docket: '书札', props: { seal: 'private', yellowMemorials: false }
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
