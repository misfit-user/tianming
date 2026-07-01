// @ts-check
/// <reference path="types.d.ts" />
//  数据模型
// ============================================================

/**
 * @typedef {Object} TimeConfig
 * @property {number} year - 起始年份
 * @property {string} prefix - 年份前缀（如"公元前"）
 * @property {string} suffix - 年份后缀（如"年"）
 * @property {string} perTurn - 每回合时间（"1d"|"1m"|"1s"|"1y"|"custom"）
 * @property {number} customDays - 自定义天数
 * @property {string[]} seasons - 季节名称
 * @property {number} startS - 起始季节索引
 * @property {string} reign - 年号
 * @property {number} reignY - 年号起始年
 * @property {string} display - 显示格式
 * @property {string} template - 模板
 * @property {number} startMonth - 起始月
 * @property {number} startDay - 起始日
 * @property {boolean} enableGanzhi - 启用干支纪年
 * @property {boolean} enableGanzhiDay - 启用干支纪日
 * @property {boolean} enableEraName - 启用年号
 * @property {Array<{name:string, startYear:number, startMonth:number, startDay:number}>} eraNames
 */

/**
 * @typedef {Object} AIConfig
 * @property {string} key - API Key
 * @property {string} url - API 地址
 * @property {string} model - 模型名称
 * @property {number} temp - 温度
 * @property {number} tok - 最大 token
 * @property {number} mem - 对话记忆条数
 * @property {string} prompt - 系统提示词
 * @property {string} rules - 规则
 */

/**
 * @typedef {Object} GameConf
 * @property {string} difficulty - 难度
 * @property {string} style - 文风
 * @property {number} maxWords - 最大字数
 * @property {number} memorialMin - 奏疏最少
 * @property {number} memorialMax - 奏疏最多
 * @property {number} qijuLookback - 起居注读取回合数
 * @property {number} shijiLookback - 史记读取回合数
 * @property {string} gameMode - 游戏模式（"yanyi"|"light_hist"|"strict_hist"）
 * @property {number} memoryAnchorKeep - 记忆锚点保留数
 * @property {number} memoryArchiveKeep - 年代归档保留数
 * @property {number} characterArcKeep - 角色弧线保留数
 * @property {number} playerDecisionKeep - 决策记录保留数
 * @property {number} chronicleKeep - 叙事记忆保留数
 * @property {number} convKeep - 对话历史保留数
 * @property {number} autoSaveTurns - 自动存档间隔
 */

/**
 * @typedef {Object} TraitDef
 * @property {string} id - 特质ID
 * @property {string} name - 特质名称
 * @property {string} [opposite] - 对立特质ID
 * @property {Object} dims - 人格维度影响 {boldness, compassion, greed, honor, rationality, sociability, vengefulness, energy}
 * @property {Object} [attrMod] - 属性修正 {valor, intelligence, administration, military}
 * @property {number} [opinionSame=10] - 同特质好感修正
 * @property {number} [opinionOpposite=-10] - 对立特质好感修正
 * @property {string} [aiHint] - AI行为指导语
 * @property {string[]} [stressOn] - 增加压力的行为
 * @property {string[]} [stressOff] - 释放压力的行为
 */

/**
 * @typedef {Object} GoalDef
 * @property {string} id - 目标ID
 * @property {string} title - 标题
 * @property {string} [description] - 描述
 * @property {string} type - 类型（"survive"|"variable_gte"|"variable_lte"|"custom"）
 * @property {string} [variable] - 变量名
 * @property {number} [value] - 目标值
 * @property {number} [turns] - 存活回合数
 * @property {string} [condition] - 自定义条件表达式
 * @property {boolean} [winCondition] - 是否胜利条件
 * @property {boolean} [loseCondition] - 是否失败条件
 * @property {boolean} [completed] - 是否已完成
 * @property {number} [completedTurn] - 完成回合
 */

/**
 * 项目配置对象（剧本定义 + 系统设置）
 * @type {{
 *   meta: {name:string, v:string},
 *   name: string, dynasty: string, emperor: string, overview: string,
 *   openingText: string, globalRules: string,
 *   playerInfo: {factionName:string, factionDesc:string, characterName:string, characterDesc:string},
 *   gameSettings: Object,
 *   scenarios: Array, characters: Array, factions: Array, parties: Array,
 *   items: Array, events: Array, variables: Array, relations: Array, rules: Array,
 *   military: Object, time: TimeConfig, mapData: Object, map: Object,
 *   cities: Array, territories: Array,
 *   world: Object, worldSettings: Object, eraState: Object,
 *   classes: Array, externalForces: Array,
 *   techTree: Array, civicTree: Array, officeTree: Array,
 *   government: Object, adminHierarchy: Object,
 *   conf: GameConf, ai: AIConfig,
 *   traitDefinitions: TraitDef[],
 *   goals: GoalDef[],
 *   softFloors: Object, offendGroups: Object,
 *   autoRebound: Object, stateCoupling: Object,
 *   keju: Object, buildingSystem: Object,
 *   positionSystem: Object, centralizationSystem: Object,
 *   territoryProductionSystem: Object, interactionSystem: Object,
 *   npcEngine: Object, aiWeightSystem: Object,
 *   rigidHistoryEvents: Array
 * }}
 */
var P={
  meta:{name:"tianming",v:"4.0"},
  name:'',dynasty:'',emperor:'',overview:'',
  openingText:'',
  globalRules:'',
  playerInfo:{
    factionName:'',factionType:'',factionLeader:'',factionLeaderTitle:'',
    factionTerritory:'',factionStrength:'',factionCulture:'',factionGoal:'',
    factionResources:'',factionDesc:'',
    characterName:'',characterTitle:'',characterFaction:'',characterAge:'',
    characterGender:'',characterPersonality:'',characterFaith:'',characterCulture:'',
    characterBio:'',characterDesc:''
  },
  gameSettings:{
    enabledSystems:{items:true,military:true,techTree:true,civicTree:true,events:true,map:true,characters:true,factions:true,classes:true,rules:true,officeTree:true},
    startYear:1,startMonth:1,startDay:1,
    enableGanzhi:true,enableGanzhiDay:true,
    enableEraName:true,eraNames:[],
    daysPerTurn:30,turnDuration:1,turnUnit:'月'
  },
  systems:{characters:true,factions:true,items:true,military:true,events:true,map:true,techTree:true,civicTree:true},
  scenarios:[],
  characters:[],
  factions:[],
  parties:[],
  items:[],
  events:[],
  variables:[],
  relations:[],
  rules:[],
  military:{systemDesc:"",supplyDesc:"",battleDesc:"",units:[],armies:[],troops:[],facilities:[],organization:[],campaigns:[],initialTroops:[],militarySystem:[]},
  time:{year:-356,prefix:"\u516C\u5143\u524D",suffix:"\u5E74",perTurn:"1s",customDays:90,varSpeed:false,seasons:["\u6625","\u590F","\u79CB","\u51AC"],startS:2,sEffects:[],reign:"",reignY:1,display:"year_season",template:"{reign}{ry}\u5E74 {season}",startMonth:1,startDay:1,startLunarMonth:0,startLunarDay:0,enableGanzhi:true,enableGanzhiDay:true,enableEraName:true,eraNames:[],daysPerTurn:90},
  mapData:{imageDataUrl:null,width:800,height:500,regions:[]},
  map:{
    enabled:true, // 地图系统启用（用于可视化和AI地理理解）
    items:[],     // 传统格式地块数据
    regions:[],   // 智能格式地块数据
    roads:[],     // 道路数据
    // 说明：地图主要用于帮助AI理解地理位置关系和让玩家了解地块状态
    // 地块颜色会根据占领者实时更新
    // 实际推演以行政区划（cities/territories）为准
  },
  cities:[], // 行政区划：城市、州府、郡县等（真正的游戏数据基础）
  territories:[], // 领地系统：与行政区划关联，用于产出计算
  buildingSystem:{
    enabled:false,
    buildings:[] // 建筑模板配置
  },
  // 皇城宫殿系统（中国古代皇家建筑群）
  palaceSystem:{
    enabled:false,
    capitalName:'',        // 皇城名（如紫禁城/大明宫/未央宫）
    capitalDescription:'',
    palaces:[]             // 宫殿列表（含主殿/偏殿/居住殿等）
    // 每个palace: {id, name, type, function, description, location, capacity,
    //              subHalls:[{id,name,role(main/side/attached),capacity,occupants[],rankRestriction[]}],
    //              status, maintainCost, builtYear, level, isHistorical}
  },
  battleConfig:{
    enabled:true,
    thresholds:{decisive:1.5, victory:1.0, stalemate:0.7},
    varianceRange:0.15,
    seasonMod:{'\u6625':1.0,'\u590F':0.95,'\u79CB':1.0,'\u51AC':0.85},
    fortLevelBonus:[1.0,1.3,1.6,2.0,2.5,3.0],
    terrainModifiers:null, // null=使用默认，用户可在编辑器中覆盖
    unitTypes:null,        // null=使用硬编码UnitTypes，用户可在编辑器中自定义
    marchConfig:{enabled:false},
    supplyConfig:{enabled:false},
    siegeConfig:{enabled:false}
  },
  warConfig:{
    casusBelliTypes:[
      {id:'rebellion',name:'平叛讨逆',legitimacyCost:0,truceMonths:12},
      {id:'border',name:'边境争端',legitimacyCost:0,truceMonths:12},
      {id:'claim',name:'宣称领土',legitimacyCost:10,truceMonths:36},
      {id:'holy',name:'天子讨不臣',legitimacyCost:0,truceMonths:36},
      {id:'subjugation',name:'武力征服',legitimacyCost:20,truceMonths:48},
      {id:'none',name:'无端开衅',legitimacyCost:40,truceMonths:60}
    ]
  },
  diplomacyConfig:{
    treatyTypes:[
      {id:'alliance',name:'同盟',durationMonths:36,mutual_defense:true},
      {id:'truce',name:'停战',durationMonths:12},
      {id:'tribute',name:'朝贡',durationMonths:0},
      {id:'marriage',name:'和亲',durationMonths:0},
      {id:'trade',name:'互市',durationMonths:12}
    ]
  },
  schemeConfig:{
    enabled:false,
    schemeTypes:[
      {id:'assassination',name:'刺杀',baseSuccess:0.15,offenseWeight:0.005,defenseAttr:'valor',defenseWeight:0.003,cooldownMonths:24,cost:500,discoveryChance:0.3},
      {id:'fabricate',name:'伪造宣称',baseSuccess:0.25,offenseWeight:0.008,cooldownMonths:12,cost:300,discoveryChance:0.2},
      {id:'seduce',name:'策反',baseSuccess:0.20,offenseWeight:0.006,defenseAttr:'loyalty',defenseWeight:0.005,cooldownMonths:6,cost:200,discoveryChance:0.15},
      {id:'spy',name:'刺探',baseSuccess:0.40,offenseWeight:0.004,cooldownMonths:3,cost:50,discoveryChance:0.1}
    ]
  },
  initialEnYuan:[],        // 初始恩怨关系 [{type:'en'|'yuan', from, to, 强度:1-5, 事由, 不共戴天:bool}]
  initialPatronNetwork:[], // 初始门生关系 [{座主, 门生, 关系类型:'座主门生'|'同年'|'同乡', 亲密度:0-100}]
  adminConfig:{
    tierRules:[
      {level:'country',name:'国/朝',tributeMultiplier:1.0,maxArmies:10,canAppoint:true,canLevy:true,canDeclareWar:true},
      {level:'province',name:'道/路/省',tributeMultiplier:0.8,maxArmies:5,canAppoint:true,canLevy:true,canDeclareWar:false},
      {level:'prefecture',name:'州/府/郡',tributeMultiplier:0.5,maxArmies:2,canAppoint:false,canLevy:true,canDeclareWar:false},
      {level:'county',name:'县/城',tributeMultiplier:0.3,maxArmies:0,canAppoint:false,canLevy:false,canDeclareWar:false},
      {level:'district',name:'乡/镇',tributeMultiplier:0.1,maxArmies:0,canAppoint:false,canLevy:false,canDeclareWar:false}
    ],
    capitalLinkage:true
  },
  chronicleConfig:{
    yearlyEnabled:false,
    yearlyMinChars:800,
    yearlyMaxChars:1500,
    style:'biannian',
    styleOptions:[
      {id:'biannian',name:'编年体',ref:'《资治通鉴》《续资治通鉴长编》'},
      {id:'shilu',name:'实录体',ref:'各朝实录（《明实录》《清实录》）'},
      {id:'jizhuan',name:'纪传体',ref:'《史记》《汉书》《新唐书》'},
      {id:'jishi',name:'纪事本末体',ref:'《通鉴纪事本末》'},
      {id:'biji',name:'笔记体',ref:'《世说新语》《容斋随笔》'},
      {id:'custom',name:'自定义',ref:''}
    ],
    customStyleDesc:''
  },
  eventConstraints:{
    enabled:false,
    types:[
      {id:'disaster',name:'天灾',maxPerYear:3,minIntervalMonths:4,priority:'major'},
      {id:'plague',name:'瘟疫',maxPerYear:1,minIntervalMonths:12,priority:'major'},
      {id:'foreign_invasion',name:'外族入侵',maxPerYear:1,minIntervalMonths:12,priority:'major'},
      {id:'economic_crisis',name:'经济危机',maxPerYear:1,minIntervalMonths:12,priority:'normal'}
    ],
    rankThreshold:5,
    unknownPolicy:'narrative_only'
  },
  decisionConfig:{
    decisions:[
      {id:'create_emperor',name:'称帝',conditions:['eraPhase==乱世','noExistingEmperor','controlRatio>=0.6'],cost:{money:10000},effects:[{type:'grant_title',level:'emperor'},{type:'set_era',phase:'治世'}],description:'登基称帝，开创新朝'},
      {id:'create_kingdom',name:'称王',conditions:['controlRatio>=0.5'],cost:{money:5000},effects:[{type:'grant_title',level:'king'}],description:'称王建国'}
    ]
  },
  keju:{
    enabled:false, // 科举制度是否启用（由AI根据朝代和推演情况判断）
    reformed:false, // 是否通过改革启用（用于隋唐前朝代）
    lastExamDate:null, // 上次科举的日期 {year, month, day}
    nextExamDate:null, // 下次科举的日期（由AI推演决定，不固定）
    currentExam:null, // 当前进行中的科举考试
    history:[], // 历史科举记录
    examIntervalNote:'', // AI对科举间隔的说明（如"本朝三年一科"）
    preparingExam:false, // 是否正在筹办科举
    examNote:'' // 科举制度说明（供AI推演参考）：科举实施受多种因素影响（国子监情况、各地文教、道路通畅、科举福利政策、剧本变量等），科举结果会影响后续推演（地方吏治、士人忠诚、阶层关系等）
  },
  world:{history:"",politics:"",economy:"",military:"",culture:"",glossary:"",entries:[],rules:""},
  worldSettings:{culture:'',weather:'',religion:'',economy:'',technology:'',diplomacy:''},
  eraState:{
    politicalUnity:0.7,
    centralControl:0.6,
    legitimacySource:'hereditary',
    socialStability:0.6,
    economicProsperity:0.6,
    culturalVibrancy:0.7,
    bureaucracyStrength:0.6,
    militaryProfessionalism:0.5,
    landSystemType:'mixed',
    dynastyPhase:'peak',
    contextDescription:''
  },
  classes:[],
  externalForces:[],
  techTree:[],
  civicTree:[],
  officeTree:[],
  officeDeptLinks:[],
  officeConfig:{costVariables:[],shortfallEffects:""},
  government:{name:'',description:'',selectionSystem:'',promotionSystem:'',nodes:[]},
  adminHierarchy:{},
  timeline:{past:[],future:[]},
  conf:{difficulty:"\u666E\u901A",style:"\u6587\u5B66\u5316",maxWords:500,sugCount:4,win:"",lose:"",themeColor:"#c9a84c",gameTitle:"\u5929\u547D",memorialMin:2,memorialMax:4,qijuLookback:5,shijiLookback:5,summaryRule:"",verbosity:"standard",szjMin:300,szjMax:600,zwMin:400,zwMax:800,memLoyalMin:400,memLoyalMax:600,memNormalMin:200,memNormalMax:350,memSecretMin:150,memSecretMax:250,wdMin:120,wdMax:250,cyMin:120,cyMax:250,chronicleMin:800,chronicleMax:1500,commentMin:80,commentMax:200,csMin:100,csMax:200,bvMin:50,bvMax:150,customStyle:"",styleSzj:"",styleZw:"",gameMode:"yanyi",showRelation:true,refText:"",refFiles:[],memoryAnchorKeep:40,memoryArchiveKeep:20,characterArcKeep:10,playerDecisionKeep:30,chronicleKeep:10,convKeep:40,autoSaveTurns:5,npcAiPrecision:true,npcAiPrecisionMode:"eager",npcAiPrecisionMaxPerTurn:2,npcInTurnMaxPerTurn:8},
  ai:{key:"",url:"https://api.openai.com/v1/chat/completions",model:"gpt-4o",temp:0.8,tok:2000,mem:20,prompt:"",rules:""},
  traitDefinitions: [
    // ===== 17对对立特质（参考CK3性格特质系统，适配天命全朝代） =====
    // 每个特质：dims(8维人格), opposite(对立), attrMod(属性修正), opinionSame/Opposite(好感), aiHint(AI行为指导), stressOn/Off(压力触发/释放)
    {id:'brave',name:'勇猛',opposite:'cowardly',dims:{boldness:0.4,energy:0.2,sociability:0.1,rationality:-0.1},attrMod:{valor:2,military:1},opinionSame:10,opinionOpposite:-10,aiHint:'主动求战，追求荣耀，不惧冒险',stressOn:['退缩','求和','示弱'],stressOff:['征战','冒险','立功']},
    {id:'cowardly',name:'怯懦',opposite:'brave',dims:{boldness:-0.4,rationality:0.1,energy:-0.2,sociability:-0.1},attrMod:{valor:-2,intelligence:1},opinionSame:10,opinionOpposite:-10,aiHint:'规避风险，善用谋略代替正面对抗',stressOn:['被迫上阵','孤注一掷'],stressOff:['安全','避险']},
    {id:'calm',name:'沉稳',opposite:'wrathful',dims:{rationality:0.4,energy:-0.1,vengefulness:-0.2,boldness:-0.1},attrMod:{intelligence:1,administration:1},opinionSame:10,opinionOpposite:-10,aiHint:'冷静分析，不为情绪所动，善于隐忍',stressOn:['被激怒','失控'],stressOff:['冥想','读书']},
    {id:'wrathful',name:'暴躁',opposite:'calm',dims:{boldness:0.3,vengefulness:0.3,energy:0.1,compassion:-0.2,rationality:-0.3},attrMod:{military:2,valor:1},opinionSame:5,opinionOpposite:-10,aiHint:'容易暴怒，倾向用武力解决问题，但有威慑力',stressOn:['隐忍','妥协'],stressOff:['惩罚','发泄怒火']},
    {id:'content',name:'知足',opposite:'ambitious',dims:{honor:0.1,sociability:-0.1,vengefulness:-0.1,boldness:-0.3,energy:-0.3,greed:-0.4},attrMod:{intelligence:1},opinionSame:15,opinionOpposite:-5,aiHint:'安于现状，忠于上级，不主动争权',stressOn:['被迫争权','扩张'],stressOff:['安定','守成']},
    {id:'ambitious',name:'野心勃勃',opposite:'content',dims:{energy:0.4,greed:0.4,boldness:0.3,sociability:0.2},attrMod:{valor:1,intelligence:1,administration:1},opinionSame:-10,opinionOpposite:-5,aiHint:'渴望权力和地位，主动扩张势力，不满现状',stressOn:['屈居人下','失去权力'],stressOff:['获得权力','扩张']},
    {id:'diligent',name:'勤勉',opposite:'lazy',dims:{energy:0.4,boldness:0.2,rationality:0.2,vengefulness:0.1},attrMod:{administration:3,intelligence:2},opinionSame:10,opinionOpposite:-10,aiHint:'事必躬亲，精力充沛，但难以放权',stressOn:['荒废政务'],stressOff:['处理政务','巡视']},
    {id:'lazy',name:'怠惰',opposite:'diligent',dims:{energy:-0.4,greed:0.1,compassion:-0.1,sociability:-0.1},attrMod:{administration:-1,intelligence:-1,valor:-1},opinionSame:5,opinionOpposite:-10,aiHint:'懈怠政务，倾向委托他人，但压力小',stressOn:['繁重政务'],stressOff:['休闲','不作为']},
    {id:'forgiving',name:'宽厚',opposite:'vengeful',dims:{compassion:0.3,honor:0.2,rationality:0.1,energy:-0.1,vengefulness:-0.5},attrMod:{intelligence:1},opinionSame:10,opinionOpposite:-10,aiHint:'以德报怨，善于化敌为友，但可能被利用',stressOn:['处决','酷刑','抄家'],stressOff:['赦免','和解']},
    {id:'vengeful',name:'睚眦必报',opposite:'forgiving',dims:{vengefulness:0.5,energy:0.1,honor:-0.1,rationality:-0.1,compassion:-0.2},attrMod:{valor:1,intelligence:1},opinionSame:5,opinionOpposite:-10,aiHint:'有仇必报，绝不放过敌人，但可能因私废公',stressOn:['放过仇人','被迫赦免'],stressOff:['复仇','惩罚仇敌']},
    {id:'generous',name:'慷慨',opposite:'greedy',dims:{compassion:0.3,honor:0.2,sociability:0.2,greed:-0.5},attrMod:{administration:-1},opinionSame:10,opinionOpposite:-15,aiHint:'乐于赏赐，收买人心，但消耗国库',stressOn:['搜刮','加税','吝啬'],stressOff:['赏赐','减税','救济']},
    {id:'greedy',name:'贪婪',opposite:'generous',dims:{greed:0.5,honor:-0.1,compassion:-0.2},attrMod:{administration:-1},opinionSame:5,opinionOpposite:-15,aiHint:'聚敛财富，加重赋税，但国库充裕',stressOn:['赏赐','减税','损失钱财'],stressOff:['征税','获利']},
    {id:'gregarious',name:'善交际',opposite:'shy',dims:{sociability:0.5,compassion:0.2,boldness:0.2},attrMod:{administration:1},opinionSame:10,opinionOpposite:-5,aiHint:'善于社交，广结人脉，但可能泄密',stressOn:['被孤立','独处'],stressOff:['宴会','社交']},
    {id:'shy',name:'内向',opposite:'gregarious',dims:{sociability:-0.5,vengefulness:-0.1,boldness:-0.2},attrMod:{intelligence:1},opinionSame:10,opinionOpposite:-5,aiHint:'不善交际，独来独往，但谨慎不易被算计',stressOn:['公开场合','宴会'],stressOff:['独处','读书']},
    {id:'honest',name:'坦诚',opposite:'deceitful',dims:{honor:0.4,sociability:0.2,boldness:0.1,compassion:0.1},attrMod:{administration:1,intelligence:-2},opinionSame:10,opinionOpposite:-10,aiHint:'言行一致，不善谋略，但深得信任',stressOn:['使诈','隐瞒','阴谋'],stressOff:['揭发','直言']},
    {id:'deceitful',name:'狡诈',opposite:'honest',dims:{rationality:0.1,boldness:-0.1,compassion:-0.1,honor:-0.4},attrMod:{intelligence:3,administration:-1},opinionSame:5,opinionOpposite:-10,aiHint:'善于欺骗和操纵，诡计多端',stressOn:['被迫坦诚'],stressOff:['阴谋得逞']},
    {id:'humble',name:'谦逊',opposite:'arrogant',dims:{compassion:0.2,honor:0.2,energy:-0.1,greed:-0.3},attrMod:{},opinionSame:10,opinionOpposite:-15,aiHint:'谦虚待人，尊重他人意见，深得民心',stressOn:['自夸','傲慢行为'],stressOff:['礼让','请教']},
    {id:'arrogant',name:'傲慢',opposite:'humble',dims:{boldness:0.2,greed:0.2,sociability:0.1,energy:0.1,compassion:-0.2,honor:-0.2,rationality:-0.2},attrMod:{},opinionSame:-5,opinionOpposite:-15,aiHint:'目中无人，刚愎自用，但有气势',stressOn:['屈服','认错'],stressOff:['威压','立威']},
    {id:'just',name:'公正',opposite:'arbitrary',dims:{honor:0.5,rationality:0.2,vengefulness:0.1},attrMod:{administration:2,intelligence:-1},opinionSame:10,opinionOpposite:-10,aiHint:'依法行事，奖惩分明，不徇私情',stressOn:['徇私','冤狱','不公'],stressOff:['明断','昭雪']},
    {id:'arbitrary',name:'专断',opposite:'just',dims:{boldness:0.1,compassion:-0.1,rationality:-0.2,honor:-0.5},attrMod:{intelligence:2,administration:-2},opinionSame:5,opinionOpposite:-10,aiHint:'独断专行，随心所欲，但不受规矩约束',stressOn:['被限制','遵循旧例'],stressOff:['任性妄为','破例']},
    {id:'patient',name:'耐心',opposite:'impatient',dims:{rationality:0.3,vengefulness:0.1,energy:-0.1,boldness:-0.2},attrMod:{intelligence:1},opinionSame:10,opinionOpposite:-10,aiHint:'善于等待时机，从容不迫',stressOn:['被催促','仓促决策'],stressOff:['等待','从容']},
    {id:'impatient',name:'急躁',opposite:'patient',dims:{boldness:0.2,energy:0.1,vengefulness:-0.1,rationality:-0.3},attrMod:{intelligence:-1},opinionSame:5,opinionOpposite:-10,aiHint:'急于求成，催促下属，但行动迅速',stressOn:['久等','拖延'],stressOff:['速决','即刻行动']},
    {id:'trusting',name:'信人',opposite:'suspicious',dims:{honor:0.3,sociability:0.3,compassion:0.2,rationality:-0.2,vengefulness:-0.2},attrMod:{administration:1,intelligence:-1},opinionSame:10,opinionOpposite:-10,aiHint:'易于信任他人，但容易被欺骗',stressOn:['怀疑','调查下属'],stressOff:['委以重任','信任']},
    {id:'suspicious',name:'猜忌',opposite:'trusting',dims:{vengefulness:0.3,rationality:-0.1,honor:-0.2,sociability:-0.4},attrMod:{intelligence:2},opinionSame:5,opinionOpposite:-10,aiHint:'多疑善猜，难以信任任何人，频繁更换亲信',stressOn:['被迫信任','委以重任'],stressOff:['监视','查探']},
    {id:'temperate',name:'节制',opposite:'gluttonous',dims:{energy:0.1,vengefulness:-0.1,greed:-0.3},attrMod:{administration:1},opinionSame:10,opinionOpposite:-10,aiHint:'自律克制，以身作则',stressOn:['奢侈','放纵'],stressOff:['节俭','克己']},
    {id:'gluttonous',name:'纵欲',opposite:'temperate',dims:{greed:0.3,energy:-0.1},attrMod:{administration:-1},opinionSame:5,opinionOpposite:-10,aiHint:'贪图享乐，但压力较小',stressOn:['节俭','苦行'],stressOff:['宴饮','享乐']},
    // ===== 三向互斥特质组（同情心/冷酷/残暴） =====
    {id:'compassionate',name:'仁慈',opposite:'callous',dims:{compassion:0.5,honor:0.3,sociability:0.2,greed:-0.2},attrMod:{administration:1,intelligence:-1},opinionSame:10,opinionOpposite:-15,aiHint:'悲天悯人，不忍杀伐，倾向宽恕',stressOn:['处决','酷刑','屠杀','囚禁'],stressOff:['赦免','救济','放归']},
    {id:'callous',name:'冷酷',opposite:'compassionate',dims:{rationality:0.1,sociability:-0.1,honor:-0.3,compassion:-0.5},attrMod:{intelligence:1},opinionSame:5,opinionOpposite:-15,aiHint:'铁石心肠，不动感情，纯粹理性决策',stressOn:['无条件赦免','施恩'],stressOff:['铁腕','冷血决断']},
    {id:'sadistic',name:'残暴',opposite:'compassionate',dims:{honor:-0.4,compassion:-0.5},attrMod:{valor:2,intelligence:1},opinionSame:-10,opinionOpposite:-15,aiHint:'嗜血好杀，以折磨为乐，极端恐怖',stressOn:['仁慈','赦免'],stressOff:['处决','折磨','屠杀']},
    // ===== 其他互斥特质 =====
    {id:'fickle',name:'善变',opposite:'stubborn',dims:{boldness:0.1,honor:-0.2,rationality:-0.2,vengefulness:-0.2},attrMod:{administration:-1,intelligence:1},opinionSame:5,opinionOpposite:-5,aiHint:'朝令夕改，立场飘忽，但灵活应变',stressOn:['被要求坚持'],stressOff:['改弦更张']},
    {id:'stubborn',name:'固执',opposite:'fickle',dims:{honor:0.3,vengefulness:0.3,rationality:-0.1},attrMod:{administration:2},opinionSame:5,opinionOpposite:-5,aiHint:'认定的事绝不改变，一意孤行',stressOn:['被迫妥协','改变立场'],stressOff:['坚持到底']},
    // ===== 信仰相关 =====
    {id:'zealous',name:'虔诚',opposite:'cynical',dims:{energy:0.2,rationality:-0.2,boldness:0.1},attrMod:{military:1},opinionSame:15,opinionOpposite:-10,aiHint:'狂热信仰，以宗教/道德准则约束一切',stressOn:['亵渎','背弃信仰'],stressOff:['修庙','祭祀']},
    {id:'cynical',name:'愤世嫉俗',opposite:'zealous',dims:{rationality:0.3,compassion:-0.1,energy:-0.2},attrMod:{intelligence:2},opinionSame:10,opinionOpposite:-10,aiHint:'不信鬼神，蔑视教条，但理性务实',stressOn:['被迫参与宗教仪式'],stressOff:['嘲讽教条']}
  ],
  goals:[],
  workshop:{submissions:[],approved:[]},
  rigidHistoryEvents:[], // 历史事件系统：时间触发+分支选择框架
  softFloors:{ // 软下限系统配置
    // 格式：'变量路径': { enabled: true, threshold: 阈值, damping: 阻尼系数 }
    // 示例：
    // 'vars.民心': { enabled: true, threshold: 20, damping: 0.6 },
    // 'vars.军心': { enabled: true, threshold: 15, damping: 0.5 }
  },
  offendGroups:{ // 得罪群体系统配置
    enabled:true,
    groups:[], // 利益集团列表（由剧本编辑器配置）
    // 格式：{ id: '文官集团', name: '文官集团', description: '朝廷文官', offendScore: 0, thresholds: [...] }
    decayRate:0.05, // 每回合得罪分数自然衰减率（5%）
    decayEnabled:true
  },
  autoRebound:{ // 自动反弹系统配置
    enabled:true,
    reforms:[], // 改革定义列表（由剧本编辑器配置）
    // 格式：{ id: '改革ID', name: '改革名称', triggerConditions: {...}, reboundRules: [...] }
    globalDecayRate:0.1 // 反弹强度全局衰减率（10%/回合）
  },
  stateCoupling:{ // 状态耦合系统配置
    enabled:true,
    couplings:[], // 耦合关系列表（由剧本编辑器配置）
    // 格式：{ source: '源变量', target: '目标变量', coefficient: 系数, condition: {...} }
    minImpact:0.1 // 最小影响值（低于此值不触发）
  },
  vacantPositionReminder:{ // 空缺提醒系统配置
    enabled:true,
    checkInterval:12, // 检查间隔（回合数，默认12回合=1年）
    reminderTitle:'官职空缺提醒',
    reminderMessage:'以下官职当前空缺，请考虑任命合适人选：'
  },
  naturalDeath:{ // 自然死亡系统配置
    enabled:true,
    ageThresholds:[ // 年龄阈值（由剧本编辑器配置）
      { age:60, deathRate:0.01 }, // 60岁，1%死亡率
      { age:70, deathRate:0.02 },  // 70岁，2%死亡率
      { age:80, deathRate:0.07 },  // 80岁，7%死亡率
      { age:90, deathRate:0.15 }   // 90岁，15%死亡率
    ],
    healthModifier:{ // 健康状况修正
      excellent:-0.5, // 健康极佳，死亡率减半
      good:-0.2,      // 健康良好，死亡率-20%
      normal:0,       // 健康正常，无修正
      poor:0.3,       // 健康不佳，死亡率+30%
      critical:0.8    // 健康危急，死亡率+80%
    },
    deathMessage:'因年老/疾病去世'
  },
  aiWeightSystem:{ // AI 权重系统配置（借鉴 CK3）
    enabled:true,
    // 决策权重配置：每个决策类型定义 Base + Modifiers
    // 公式：Weight = Base + Sum(AddModifiers) × Product(FactorModifiers)
    decisions:{
      // 示例配置结构（由剧本编辑器配置具体决策）
      // 'declare_war': {
      //   base: 0, // 基础权重（100=默认执行, 0=默认不执行, 负数=强烈抵制）
      //   addModifiers: [ // 加法修正
      //     { condition: { type: 'personality', field: 'boldness', operator: '>=', value: 70 }, add: 30 },
      //     { condition: { type: 'variable', field: '军事力量', operator: '>=', value: 80 }, add: 25 },
      //     { condition: { type: 'relation', field: '敌对关系', operator: '<=', value: -50 }, add: 40 }
      //   ],
      //   factorModifiers: [ // 乘法修正（factor = 0 表示一票否决）
      //     { condition: { type: 'variable', field: '国库', operator: '<', value: 20 }, factor: 0 }, // 国库不足，绝对不宣战
      //     { condition: { type: 'relation', field: '盟友关系', operator: '>=', value: 50 }, factor: 0 }, // 不对盟友宣战
      //     { condition: { type: 'variable', field: '军事力量', operator: '>=', value: 150 }, factor: 1.5 } // 军力强大，权重放大
      //   ],
      //   personalityModifiers: { // 人格修正（连续值映射）
      //     boldness: 0.5, // 胆识每高 1 点，权重增加 0.5
      //     rationality: -0.3, // 理性每高 1 点，权重减少 0.3
      //     vengefulness: 0.2
      //   },
      //   resourceModifiers: { // 资源修正
      //     money: { threshold: 50, add: 20 }, // 金钱 >= 50 时，权重 +20
      //     grain: { threshold: 30, add: 15 }
      //   }
      // }
    }
  },
  centralizationSystem:{ // 集权等级与回拨机制（借鉴晚唐风云）
    enabled:true,
    // 上缴率表：集权等级 × 领地类型
    tributeRates:{
      // 格式：{ centralization: 集权等级(1-4), territoryType: 'military'/'civil', rate: 上缴率(0-1) }
      1: { military: 0.10, civil: 0.40 }, // 放任：军事领地 10%，民事领地 40%
      2: { military: 0.20, civil: 0.60 }, // 一般：军事领地 20%，民事领地 60%
      3: { military: 0.35, civil: 0.80 }, // 严控：军事领地 35%，民事领地 80%
      4: { military: 0.50, civil: 0.95 }  // 压榨：军事领地 50%，民事领地 95%
    },
    // 默认集权等级（新角色/新领地）
    defaultCentralization: 2,
    // 默认回拨率（新角色）
    defaultRedistributionRate: 0.3, // 30%
    // 财政结算顺序：自底向上收集贡赋，自顶向下回拨
    // 角色数据扩展：
    // - character.centralization: 上级对我设定的集权等级（1-4）
    // - character.redistributionRate: 我对下属的回拨率（0-1）
    // - character.overlordId: 我的上级 ID
    // - character.territoryType: 我的领地类型（'military'/'civil'，由官职推导）
  },
  territoryProductionSystem:{ // 领地产出系统（借鉴晚唐风云）
    enabled:true,
    // 产出公式：总产出 = basePopulation × K × (development/100) × (control/100) × (1 + admin×0.02)
    // 钱 = 总产出 × moneyRatio / (moneyRatio + grainRatio) + 建筑加成
    // 粮 = 总产出 × grainRatio / (moneyRatio + grainRatio) + 建筑加成
    productionCoefficient: 0.9, // K 系数
    adminBonus: 0.02, // 管理能力加成系数（每点管理能力增加 2% 产出）
    // 领地数据扩展：
    // - territory.basePopulation: 基础人口（决定产出规模）
    // - territory.moneyRatio: 钱粮比例-钱（如 5）
    // - territory.grainRatio: 钱粮比例-粮（如 6.2）
    // - territory.development: 发展度（0-100）
    // - territory.control: 控制度（0-100）
    // - territory.populace: 民心（0-100）
    // - territory.admin: 管理能力（0-100，由官员能力决定）
    // - territory.buildings: 建筑列表（提供加成）
    defaultValues:{
      basePopulation: 50000,
      moneyRatio: 3,
      grainRatio: 4,
      development: 50,
      control: 70,
      populace: 60,
      admin: 50
    }
  },
  positionSystem:{ // 职位模板与岗位分离系统（借鉴晚唐风云）
    enabled:true,
    // 职位模板（PositionTemplate）：定义职位种类的静态属性
    templates:[], // 格式：{ id, name, rank, category, salary, authority, requirements, description }
    // 岗位（Post）：具体的坑位实例，预生成
    posts:[], // 格式：{ id, templateId, holderId, region, status, appointedTurn }
    // 品位体系：29 级文武散官
    ranks:[ // 从九品下 → 从一品
      { level:1, name:'从九品下', type:'civil', prestigeRequired:0 },
      { level:2, name:'正九品下', type:'civil', prestigeRequired:5 },
      { level:3, name:'从九品上', type:'civil', prestigeRequired:10 },
      { level:4, name:'正九品上', type:'civil', prestigeRequired:15 },
      { level:5, name:'从八品下', type:'civil', prestigeRequired:20 },
      { level:6, name:'正八品下', type:'civil', prestigeRequired:25 },
      { level:7, name:'从八品上', type:'civil', prestigeRequired:30 },
      { level:8, name:'正八品上', type:'civil', prestigeRequired:35 },
      { level:9, name:'从七品下', type:'civil', prestigeRequired:40 },
      { level:10, name:'正七品下', type:'civil', prestigeRequired:45 },
      { level:11, name:'从七品上', type:'civil', prestigeRequired:50 },
      { level:12, name:'正七品上', type:'civil', prestigeRequired:55 },
      { level:13, name:'从六品下', type:'civil', prestigeRequired:60 },
      { level:14, name:'正六品下', type:'civil', prestigeRequired:65 },
      { level:15, name:'从六品上', type:'civil', prestigeRequired:70 },
      { level:16, name:'正六品上', type:'civil', prestigeRequired:75 },
      { level:17, name:'从五品下', type:'civil', prestigeRequired:80 },
      { level:18, name:'正五品下', type:'civil', prestigeRequired:85 },
      { level:19, name:'从五品上', type:'civil', prestigeRequired:90 },
      { level:20, name:'正五品上', type:'civil', prestigeRequired:95 },
      { level:21, name:'从四品下', type:'civil', prestigeRequired:100 },
      { level:22, name:'正四品下', type:'civil', prestigeRequired:110 },
      { level:23, name:'从四品上', type:'civil', prestigeRequired:120 },
      { level:24, name:'正四品上', type:'civil', prestigeRequired:130 },
      { level:25, name:'从三品', type:'civil', prestigeRequired:140 },
      { level:26, name:'正三品', type:'civil', prestigeRequired:150 },
      { level:27, name:'从二品', type:'civil', prestigeRequired:160 },
      { level:28, name:'正二品', type:'civil', prestigeRequired:170 },
      { level:29, name:'从一品', type:'civil', prestigeRequired:180 },
      { level:30, name:'正一品', type:'civil', prestigeRequired:200 }
    ],
    // 角色数据扩展：
    // - character.rankLevel: 当前品位等级（1-30）
    // - character.prestige: 贤能积分（累积自动晋升）
    // - character.posts: 持有的岗位 ID 列表
    defaultRankLevel: 1,
    prestigeGainPerTurn: 2 // 每回合自动获得的贤能积分
  },
  interactionSystem:{ // Interaction 注册表模式（借鉴晚唐风云）
    enabled:true,
    categories:['personnel','diplomacy','economy','military','intrigue'],
    interactions:[
      // ═══ 人事类 ═══
      {id:'dismiss', name:'罢免', category:'personnel',
       conditions:[{type:'source',field:'rank',operator:'<=',value:5}],
       cost:{money:0}, effects:[{type:'target',field:'officialTitle',value:''}],
       description:'罢免目标官职。品级需高于或等于目标。'},
      {id:'promote', name:'升迁', category:'personnel',
       conditions:[{type:'source',field:'rank',operator:'<=',value:3}],
       cost:{money:200}, effects:[{type:'target',field:'rank',value:-1}],
       description:'擢升目标品级。需有任命权。'},
      {id:'summon', name:'召见', category:'personnel',
       conditions:[], cost:{money:0},
       effects:[{type:'target',field:'loyalty',value:3},{type:'target',field:'stress',value:-5}],
       description:'召见臣下觐见，了解情况，提升忠诚。'},
      // ═══ 经济类 ═══
      {id:'gift', name:'赏赐', category:'economy',
       conditions:[], cost:{money:500},
       effects:[{type:'target',field:'loyalty',value:10}],
       description:'赏赐财物，大幅提升忠诚。'},
      {id:'feast', name:'赐宴', category:'economy',
       conditions:[], cost:{money:300},
       effects:[{type:'target',field:'loyalty',value:5},{type:'target',field:'stress',value:-10}],
       description:'设宴款待，提升忠诚并舒缓压力。'},
      {id:'grant_land', name:'赐田', category:'economy',
       conditions:[{type:'source',field:'rank',operator:'<=',value:3}],
       cost:{money:1000},
       effects:[{type:'target',field:'loyalty',value:15}],
       description:'赐予田产庄园，大幅笼络。'},
      // ═══ 外交类 ═══
      {id:'befriend', name:'结交', category:'diplomacy',
       conditions:[], cost:{money:100},
       effects:[{type:'target',field:'loyalty',value:5}],
       description:'主动结交，拉近关系。'},
      {id:'marriage_propose', name:'提亲', category:'diplomacy',
       conditions:[{type:'source',field:'rank',operator:'<=',value:5}],
       cost:{money:800},
       effects:[{type:'target',field:'loyalty',value:20}],
       description:'联姻结亲，建立姻亲纽带。'},
      {id:'send_envoy', name:'遣使', category:'diplomacy',
       conditions:[], cost:{money:200},
       effects:[{type:'target',field:'loyalty',value:3}],
       description:'派遣使者传达善意。'},
      // ═══ 军事类 ═══
      {id:'threaten', name:'威胁', category:'military',
       conditions:[{type:'source',field:'valor',operator:'>=',value:60}],
       cost:{money:0},
       effects:[{type:'target',field:'loyalty',value:5},{type:'target',field:'ambition',value:-10},{type:'target',field:'stress',value:10}],
       description:'以武力威胁迫使对方就范。'},
      {id:'challenge', name:'邀战', category:'military',
       conditions:[{type:'source',field:'valor',operator:'>=',value:70}],
       cost:{money:0},
       effects:[{type:'target',field:'stress',value:15}],
       description:'公开邀请比武较量。'},
      // ═══ 阴谋类 ═══
      {id:'bribe', name:'行贿', category:'intrigue',
       conditions:[], cost:{money:800},
       effects:[{type:'target',field:'loyalty',value:12},{type:'target',field:'ambition',value:5}],
       description:'暗中行贿，收买对方。'},
      {id:'slander', name:'谗言', category:'intrigue',
       conditions:[{type:'source',field:'intelligence',operator:'>=',value:50}],
       cost:{money:100},
       effects:[{type:'target',field:'loyalty',value:-10},{type:'target',field:'stress',value:10}],
       description:'在君主面前进谗言，诋毁目标。'},
      {id:'exile', name:'流放', category:'intrigue',
       conditions:[{type:'source',field:'rank',operator:'<=',value:3}],
       cost:{money:0},
       effects:[{type:'target',field:'loyalty',value:-30},{type:'target',field:'stress',value:30}],
       description:'将目标贬谪流放边疆。'},
      {id:'pardon', name:'恩赦', category:'intrigue',
       conditions:[{type:'source',field:'rank',operator:'<=',value:3}],
       cost:{money:0},
       effects:[{type:'target',field:'loyalty',value:20},{type:'target',field:'stress',value:-20}],
       description:'赦免目标罪过，施恩收心。'}
    ]
  },
  npcEngine:{ // NPC Engine 双层分离架构（借鉴晚唐风云）
    enabled:true,
    // 核心设计：底层引擎不知道玩家存在，为每个决策权角色生成待处理事项（Tasks）
    // 玩家扮演角色时，消费该角色的 Tasks
    maxActionsPerTurn: 3, // 每回合最大行动数（兜底值，优先使用rankActionFrequency）
    taskDeadline: 3, // 任务超时回合数（超时后自动执行）
    // 品级行动频率表（九品制：1=一品最高，9=九品最低）
    rankActionFrequency: [
      {minRank:1, maxRank:3, actionsPerTurn:3},   // 一~三品：每回合3次
      {minRank:4, maxRank:5, actionsPerTurn:2},   // 四~五品：每回合2次
      {minRank:6, maxRank:7, actionsPerTurn:1},   // 六~七品：每回合1次
      {minRank:8, maxRank:9, actionIntervalMonths:3} // 八~九品：每3月1次
    ],
    // 行为模块注册表
    behaviors:[
      // ═══ 12种中国特色NPC行为模板 ═══
      // 权重采用CK3式: weight = (base + Σadd + Σpersonality) × Πfactor
      // weight = 概率百分比（weight=30 → 30%触发概率）
      {id:'recommend', name:'举荐人才', category:'personnel', enabled:true,
       weight:{base:20, addModifiers:[{condition:'vacantPosts>0',add:15}],
       personalityModifiers:{intelligence:0.3, sociability:0.2},
       factorModifiers:[{condition:'vacantPosts==0',factor:0}]},
       aiPrompt:'此NPC想推荐门生或贤才出任空缺官职'},
      {id:'impeach', name:'弹劾同僚', category:'personnel', enabled:true,
       weight:{base:5, addModifiers:[{condition:'targetCorrupt',add:20}],
       personalityModifiers:{valor:0.2, benevolence:-0.1},
       factorModifiers:[]},
       aiPrompt:'此NPC欲弹劾某位政敌或贪官'},
      {id:'drill', name:'操练兵马', category:'military', enabled:true,
       weight:{base:25, addModifiers:[],
       personalityModifiers:{valor:0.3, administration:0.1},
       factorModifiers:[{condition:'noArmy',factor:0}]},
       aiPrompt:'此NPC想操练军队提升训练度'},
      {id:'irrigation', name:'兴修水利', category:'economy', enabled:true,
       weight:{base:15, addModifiers:[],
       personalityModifiers:{administration:0.3, benevolence:0.2},
       factorModifiers:[]},
       aiPrompt:'此NPC想在辖地兴修水利提升农业'},
      {id:'faction_building', name:'结党营私', category:'intrigue', enabled:true,
       weight:{base:-5, addModifiers:[{condition:'lowLoyalty',add:20}],
       personalityModifiers:{ambition:0.4, loyalty:-0.3},
       factorModifiers:[{condition:'highLoyalty',factor:0}]},
       aiPrompt:'此NPC暗中拉拢朝臣组建自己的派系'},
      {id:'marriage_alliance', name:'联姻', category:'diplomacy', enabled:true,
       weight:{base:10, addModifiers:[],
       personalityModifiers:{sociability:0.3},
       factorModifiers:[{condition:'lowRank',factor:0}]},
       aiPrompt:'此NPC想通过联姻巩固政治关系'},
      {id:'write_book', name:'著书立说', category:'culture', enabled:true,
       weight:{base:5, addModifiers:[{condition:'highStress',add:15}],
       personalityModifiers:{intelligence:0.3, stress:0.2},
       factorModifiers:[]},
       aiPrompt:'此NPC想著书立说释放压力、提升声望'},
      {id:'relief', name:'赈灾济民', category:'governance', enabled:true,
       weight:{base:10, addModifiers:[{condition:'disaster',add:25}],
       personalityModifiers:{benevolence:0.4},
       factorModifiers:[]},
       aiPrompt:'此NPC想开仓放粮赈济灾民'},
      {id:'remonstrate', name:'进谏直言', category:'governance', enabled:true,
       weight:{base:8, addModifiers:[{condition:'badPolicy',add:20}],
       personalityModifiers:{valor:0.3, benevolence:0.2},
       factorModifiers:[]},
       aiPrompt:'此NPC想直言进谏指出施政弊端'},
      {id:'befriend_powerful', name:'结交权贵', category:'social', enabled:true,
       weight:{base:15, addModifiers:[],
       personalityModifiers:{sociability:0.3, ambition:0.2},
       factorModifiers:[]},
       aiPrompt:'此NPC想结交更高品级的权贵'},
      {id:'recruit_private', name:'招募私兵', category:'military', enabled:true,
       weight:{base:-10, addModifiers:[{condition:'veryLowLoyalty',add:25}],
       personalityModifiers:{ambition:0.4, valor:0.2, loyalty:-0.3},
       factorModifiers:[{condition:'highLoyalty',factor:0}]},
       aiPrompt:'此NPC暗中招募私人武装力量'},
      {id:'distribute_wealth', name:'散财施恩', category:'social', enabled:true,
       weight:{base:10, addModifiers:[],
       personalityModifiers:{benevolence:0.3, sociability:0.2},
       factorModifiers:[{condition:'noMoney',factor:0}]},
       aiPrompt:'此NPC散财结交门生或施恩于人'}
    ]
    // 示例行为模块：
    // - 'appoint': 任命官员
    // - 'review': 审批草稿
    // - 'declareWar': 宣战
    // - 'keju': 科举
    // - 'reform': 改革
  }
};

/**
 * 运行时游戏状态
 * @type {{
 *   running: boolean, sid: string|null, turn: number, saveName: string,
 *   vars: Object<string, {value:number, min:number, max:number}>,
 *   rels: Object<string, {value:number}>,
 *   chars: Array, facs: Array, items: Array, armies: Array,
 *   evtLog: Array<{type:string, text:string, turn:number}>,
 *   conv: Array<{role:string, content:string}>,
 *   busy: boolean, memorials: Array, qijuHistory: Array,
 *   officeTree: Array, officeChanges: Array,
 *   shijiHistory: Array, allCharacters: Array,
 *   taxPressure: number,
 *   turnChanges: Object, _listeners: Object, _changeQueue: Array,
 *   triggeredHistoryEvents: Object, rigidTriggers: Object,
 *   offendGroupScores: Object, affinityMap: Object, activeRebounds: Array,
 *   triggeredOffendEvents: Object, _indices: Object|null,
 *   memoryAnchors: Array, memoryArchive: Array,
 *   characterArcs: Object, playerDecisions: Array,
 *   chronicleAfterwords: Array, customPolicies: Array,
 *   _rngState: {seed:string, s:number}|null,
 *   eraState: Object, eraStateHistory: Array,
 *   eraName: string, eraNames: Array
 * }}
 */
var GM={running:false,sid:null,turn:1,saveName:"",vars:{},rels:{},chars:[],facs:[],items:[],armies:[],evtLog:[],conv:[],busy:false,memorials:[],qijuHistory:[],jishiRecords:[],biannianItems:[],officeTree:[],wenduiTarget:null,wenduiHistory:{},officeChanges:[],shijiHistory:[],allCharacters:[],classes:[],parties:[],extForces:[],techTree:[],civicTree:[],autoSummary:"",summarizedTurns:[],currentDay:0,eraName:"",eraNames:[],eraState:{},turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]},_listeners:{},_changeQueue:[],triggeredHistoryEvents:{},rigidTriggers:{},offendGroupScores:{},affinityMap:{},activeRebounds:[],triggeredOffendEvents:{},_indices:null,postSystem:null,mapData:null,eraStateHistory:[],taxPressure:50,
// 文事系统：士大夫文化作品库（诗词文赋画琴等）
culturalWorks:[], _forgottenWorks:[],
// 势力关系矩阵（多维+历史账本）
factionRelationsMap:{},

// ═══════════════════════════════════════════════════════
// 七大官方变量（最小初始数据，完整系统逐步落地）
// 详见 设计方案-变量联动总表.md 与各变量设计方案
// ═══════════════════════════════════════════════════════

// 1. 帑廪（国库/国帑）——分钱/粮/布三列 + 八类收入 + 八类支出
guoku:{
  balance:1000000,monthlyIncome:80000,monthlyExpense:75000,annualIncome:960000,lastDelta:0,trend:'stable',
  actualTaxRate:1.0,
  ledgers:{
    money:{stock:1000000,lastTurnIn:0,lastTurnOut:0,sources:{},sinks:{},history:[]},
    grain:{stock:500000,lastTurnIn:0,lastTurnOut:0,sources:{},sinks:{},history:[]},
    cloth:{stock:200000,lastTurnIn:0,lastTurnOut:0,sources:{},sinks:{},history:[]}
  },
  unit:{money:'两',grain:'石',cloth:'匹'},
  sources:{tianfu:0,dingshui:0,caoliang:0,yanlizhuan:0,shipaiShui:0,quanShui:0,juanNa:0,qita:0},
  expenses:{fenglu:0,junxiang:0,zhenzi:0,gongcheng:0,jisi:0,shangci:0,neiting:0,qita:0},
  bankruptcy:{active:false,consecutiveMonths:0,severity:0},
  emergency:{extraTax:{active:false,rate:0},loan:{active:false,amount:0,monthsLeft:0}},
  history:{monthly:[],yearly:[],events:[]}
},

// 2. 内帑（皇室私库）——三列账本 + 6 源 + 5 支
neitang:{
  balance:200000,monthlyIncome:15000,monthlyExpense:12000,lastDelta:0,trend:'stable',
  ledgers:{
    money:{stock:200000,lastTurnIn:0,lastTurnOut:0,sources:{},sinks:{},history:[]},
    grain:{stock:30000,lastTurnIn:0,lastTurnOut:0,sources:{},sinks:{},history:[]},
    cloth:{stock:20000,lastTurnIn:0,lastTurnOut:0,sources:{},sinks:{},history:[]}
  },
  unit:{money:'两',grain:'石',cloth:'匹'},
  sources:{huangzhuang:0,huangchan:0,specialTax:0,confiscation:0,tribute:0,guokuTransfer:0},
  expenses:{gongting:0,dadian:0,shangci:0,houGongLingQin:0,guokuRescue:0},
  crisis:{active:false,consecutiveMonths:0,severity:0},
  history:{monthly:[],yearly:[],events:[]}
},

// 3. 在籍户口
hukou:{registeredTotal:10000000,estimatedHidden:1500000,byClass:{shi:0.05,nong:0.72,gong:0.07,shang:0.05,bing:0.05,seng:0.02,xuyi:0.02,haoqiang:0.01,liumin:0.01},lastDelta:0,trend:'stable'},

// 4. 腐败（UI 显示为"吏治"，数值低=清明高=污浊）
corruption:{trueIndex:30,perceivedIndex:22,phase:'moderate',subDepts:{central:{true:25,perceived:20},provincial:{true:35,perceived:28},military:{true:40,perceived:30},fiscal:{true:45,perceived:35},judicial:{true:30,perceived:22},imperial:{true:20,perceived:10}},supervision:{level:45},lumpSumIncidents:[],entrenchedFactions:[]},

// 5. 民心
minxin:{trueIndex:65,perceivedIndex:72,phase:'peace',byRegion:{},byClass:{shi:{true:70},nong:{true:60},gong:{true:55},shang:{true:60},bing:{true:55},seng:{true:68},xuyi:{true:40},haoqiang:{true:75},liumin:{true:20}},omens:{heavenlySigns:[],auspiciousSigns:[],prophecies:[]},uprisings:[]},

// 6. 皇权
huangquan:{index:55,phase:'balance',subDims:{central:{value:60},provincial:{value:50},military:{value:55},imperial:{value:70}},powerMinister:null,counterMoves:[]},

// 7. 皇威
huangwei:{index:65,perceivedIndex:68,phase:'normal',subDims:{court:{value:70},provincial:{value:60},military:{value:65},foreign:{value:55}},tyrantSyndrome:{active:false,hiddenDamage:{unreportedMinxinDrop:0,concealedCorruption:0,wrongfulDeaths:0}},lostAuthorityCrisis:{active:false}}
};

// ── 君上称谓·语言习惯「感知机制」(系统级·跨朝代·无硬编码称谓表) ─────────────────────────
// owner 拍板：引擎只「组装本剧本语境」(朝代/年号/国家/君主称号·全来自剧本数据)，由 AI 据此「感知」本朝特有的
// 君臣称谓与语言习惯(如宋→官家·明→陛下/皇上·清→皇上/万岁)，全 prompt 共用、全程一致。支持架空朝代(AI 据其设定自判)。
// 不写死任何朝代→称谓映射：称谓由 AI 从语境感知，引擎只负责把语境喂全、喂准。
function _sovereignLanguageContext(G) {
  G = G || (typeof GM !== 'undefined' ? GM : null);
  var P_ = (typeof P !== 'undefined') ? P : null;
  function pick() { for (var i = 0; i < arguments.length; i++) { var v = arguments[i]; if (v != null && v !== false && v !== true && ('' + v).trim()) return ('' + v).trim(); } return ''; }
  var es = (G && G.eraState) || {};
  var ec = (G && G.engineConstants) || (P_ && P_.engineConstants) || {};
  var pi = (P_ && P_.playerInfo) || {};
  // ── 时代/纪元：动态优先（受推演影响·改元/改朝/纪年推进全反映；剧本静态 label 仅兜底）──
  var dynEra      = pick(G && G.eraName, es.eraName);                                            // 动态年号（改元写 GM.eraName）
  var staticLabel = pick(ec.label, G && G.label, es.label, P_ && P_.label, G && G.dynastyName);  // 剧本静态时代描述（兜底）
  var dynKey      = pick(G && G.dynastyKey, es.dynastyKey, ec.dynastyKey, P_ && P_.dynastyKey);
  var dynastyNm   = pick(G && G.dynasty, G && G.dynastyName, pi.dynasty, P_ && P_.dynasty);       // 朝代名（可读·动态优先·改朝随之）
  if (!dynastyNm && staticLabel) dynastyNm = ('' + staticLabel).split(/[·:：\/\s（(]/)[0];        // 从剧本 label 派生朝代名（南宋·建炎初→南宋·非硬编码）
  // 当前年（动态·随回合推进；改元/改朝后亦实时）
  var curYear = '';
  try { if (typeof turnToDate === 'function' && G && G.turn) curYear = turnToDate(G.turn).year; } catch (e) {}
  if (!curYear) curYear = pick(G && G.year, G && G.currentYear, pi.startYear, ec.startYear);
  // 「时代」描述：有动态年号 → 「朝代·年号·年」(改元/改朝全反映)；否则回落剧本静态 label（仍带动态年）
  var eraDesc;
  if (dynEra) eraDesc = (dynastyNm ? dynastyNm + '·' : '') + dynEra + (curYear ? '·' + curYear + '年' : '');
  else if (staticLabel) eraDesc = staticLabel + (curYear ? '（' + curYear + '年）' : '');
  else eraDesc = (dynastyNm || dynKey || '') + (curYear ? '·' + curYear + '年' : '');
  // 国家(玩家势力名) + 君主(玩家角色名/称号)·均动态（随禅位/易主/改国号实时）
  var pc = (G && Array.isArray(G.chars)) ? G.chars.find(function (c) { return c && c.isPlayer; }) : null;
  var country  = pick(pi.factionName, pc && (pc.faction || pc.factionName), G && G.playerFaction);
  var sovName  = pick(pc && pc.name, pi.factionLeader, pi.characterName);
  var sovTitle = pick(pc && (pc.title || pc.officialTitle), pi.factionLeaderTitle, pi.characterTitle);
  return { eraDesc: eraDesc, dynEra: dynEra, dynKey: dynKey, country: country, sovName: sovName, sovTitle: sovTitle };
}
// 注入所有 AI prompt 的「称谓感知」段(单一真相源)。无语境则返回空串(不注入)。
function _sovereignLanguagePromptLine(G) {
  var c;
  try { c = _sovereignLanguageContext(G); } catch (e) { return ''; }
  if (!c || (!c.eraDesc && !c.dynKey && !c.country && !c.sovName)) return '';
  var bits = [];
  if (c.eraDesc) bits.push('时代：' + c.eraDesc);
  else if (c.dynKey) bits.push('朝代：' + c.dynKey);
  if (c.country) bits.push('国家：' + c.country);
  if (c.sovName || c.sovTitle) bits.push('君主：' + (c.sovName || '') + (c.sovTitle ? '·' + c.sovTitle : ''));
  var line = '【称谓感知·本剧本语境——AI 据此感知本朝君臣称谓与语言习惯·全程一致·勿串他朝/现代】\n';
  line += '  · ' + bits.join('  ') + '\n';
  // 具体君臣称谓：数据层 era 包中立查表(剧本 imperialAddress 优先→朝代包回退)·引擎不认专名·仅 eraLangField(era,...) 查表(见 tm-era-language-pack.js)
  var _ia = '';
  try {
    var _P = (typeof P !== 'undefined') ? P : null;
    var _sv = (_P && _P.scenario && _P.scenario.imperialAddress) || (G && G.imperialAddress) || '';
    var _era = c.eraDesc || c.dynKey || '';
    _ia = (typeof eraLangField === 'function') ? eraLangField(_era, 'imperialAddress', _sv) : _sv;
  } catch (e) {}
  if (_ia) line += '  · 本朝君臣称谓（据此·勿用他朝/现代称呼）：' + _ia + '\n';
  line += '  · 据上述朝代、国家、君主身份，感知并一致使用本朝特有的「君上称谓」「臣下自称」「奏对/书信/口语」习惯（各朝迥异，如宋称官家、明清称皇上/万岁、汉唐称陛下/圣上），切勿混入他朝或现代用语；架空设定则据其自洽逻辑自判。\n';
  // 货币单位·跨朝代(宋/唐/元为「贯」·明清为「两」等)·从 CurrencyUnit 派生·让 AI 涉钱数一律用本朝单位·不串他朝(旧朝议/问对/奏疏硬编码「两」致宋剧本大臣误用白银)
  try {
    var _mu = (typeof CurrencyUnit !== 'undefined' && CurrencyUnit.unitOf) ? CurrencyUnit.unitOf('money') : '';
    if (_mu) line += '  · 本朝钱货以「' + _mu + '」为单位——凡奏对、议政、文书言及银钱数额，一律以「' + _mu + '」计（粮以石、布以匹），切勿用他朝或现代货币单位。\n';
  } catch (e) {}
  return line;
}
// 单词君上称呼(供 UI/模板固定文案·非 AI 感知)：剧本 sovereignAddress → era 包中立查表 → 保守回退「陛下」(现有明/汉唐剧本不回归·宋等有包朝代得专称·架空作者可自设 scenario.sovereignAddress)。引擎不认专名·仅 eraLangField 查表。
function _sovereignAddressTerm(G) {
  try {
    var _P = (typeof P !== 'undefined') ? P : null;
    var sv = (_P && _P.scenario && _P.scenario.sovereignAddress) || (G && G.sovereignAddress) || '';
    if (sv) return sv;
    var c = _sovereignLanguageContext(G);
    var era = (c && (c.eraDesc || c.dynKey)) || '';
    var t = (typeof eraLangField === 'function') ? eraLangField(era, 'sovereignAddress', '') : '';
    return t || '陛下';
  } catch (e) { return '陛下'; }
}
if (typeof window !== 'undefined') { window._sovereignLanguageContext = _sovereignLanguageContext; window._sovereignLanguagePromptLine = _sovereignLanguagePromptLine; window._sovereignAddressTerm = _sovereignAddressTerm; }
if (typeof global !== 'undefined') { try { global._sovereignLanguageContext = _sovereignLanguageContext; global._sovereignLanguagePromptLine = _sovereignLanguagePromptLine; global._sovereignAddressTerm = _sovereignAddressTerm; } catch (e) {} }

// ── 跨剧本数据隔离（防串台）─────────────────────────────────────────────
// P.characters/factions/parties/classes/events 等是「跨剧本累积」的全局表：官方天启运行时快照
// 常驻 P、且玩过的任一剧本数据也按各自 sid 留在 P 里（doActualStart 只移除同 sid 旧行，不动别的剧本）。
// GM.chars/GM.facs 已按当前 sid 严格过滤，所以正局数据本身是干净的；但不少消费方（人物图志名册、
// 朝议外部势力、问对找势力、开局事件激活、自动生成势力表…）会在 GM 之外再「附加整份 P.xxx」，
// 于是把别的剧本（典型如官方天启）的人物/势力/事件漏进当前局，表现为「载入绍宋却看到天启人物势力」。
// 此助手按当前激活剧本 sid 收口：开局中(GM.sid 有值)→只留 sid 严格相等的行（与 GM.chars 同口径，
// sid 缺失的孤儿行一并排除）；无激活剧本(预览/编辑)→原样返回，不改既有行为。
function _tmActiveScenarioRows(arr){
  if (!Array.isArray(arr)) return [];
  var sid = (typeof GM !== 'undefined' && GM && GM.sid) ? GM.sid : null;
  if (!sid) return arr;
  return arr.filter(function(r){ return r && r.sid === sid; });
}
if (typeof window !== 'undefined') window._tmActiveScenarioRows = _tmActiveScenarioRows;

// 当前局的变量定义列表(剧本隔离·同上不变量)。变量比别的数组多一层坑：
//   ① GM.vars 是开局时按当前 sid 建的「每局权威」(object·键=变量名·保留 inversed/isCore/displayName/max 等)；
//   ② P.variables 是「set-once」的不可靠库——只在为空时才设(_tmStartLoadVars)·玩第二个剧本时常停留在第一个剧本·
//      且可能是数组或 {base,other,formulas} 编辑器结构。
// 故 gameplay 读「当前局变量定义」必须优先 GM.vars(取其 values)·仅无局(预览/极早期)才回退 P.variables。
// 这样升降红绿方向(inversed)/核心指标标签等不再串到别的剧本。
function _tmActiveVars(){
  if (typeof GM !== 'undefined' && GM && GM.vars && typeof GM.vars === 'object') {
    var ks = Object.keys(GM.vars);
    if (ks.length) return ks.map(function(k){ return GM.vars[k]; });
  }
  if (typeof P !== 'undefined' && P && P.variables) {
    if (Array.isArray(P.variables)) return P.variables;
    if (typeof P.variables === 'object') return (P.variables.base || []).concat(P.variables.other || []);
  }
  return [];
}
if (typeof window !== 'undefined') window._tmActiveVars = _tmActiveVars;
