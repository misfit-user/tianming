// 省道主官数据、数值依据与逐条原文；由 patches/governors.js 应用。
'use strict';
module.exports = {
  "sid": "shaosong",
  "scenario": "绍宋·建炎元年八月（官方）.json",
  "label": "绍宋·建炎元年八月",
  "playerFaction": "fac_song",
  "playerCopies": 2,
  "useIds": false,
  "scope": "本刀补宋廷 28 个省道节点；其他 76 个外藩分区维持既有数据，仅改一处虚构少年官称的前缀歧义。以建炎元年八月为任官时点，路帅取安抚/经略安抚；京畿复用东京留守，河北战区及三泉直隶按实际制度保留特例。 西军另有独立官制，六路帅位同步为宋廷对应职位的同一数据，清除曲端、赵哲及王庶旧职的提前任官。",
  "calibration": {
    "sample": [
      {
        "name": "陈规",
        "id": "char_jianyan1_67"
      },
      {
        "name": "王庶",
        "id": "char_ss_110"
      },
      {
        "name": "范致虚",
        "id": "char_ss_111"
      },
      {
        "name": "叶梦得",
        "id": "char_ss_114"
      },
      {
        "name": "朱松",
        "id": "char_ss_135"
      },
      {
        "name": "卫肤敏",
        "id": "char_ss_138"
      },
      {
        "name": "张悫",
        "id": "char_ss_142"
      },
      {
        "name": "张守",
        "id": "char_ss_144"
      },
      {
        "name": "刘珏",
        "id": "char_ss_145"
      },
      {
        "name": "晏敦复",
        "id": "char_ss_147"
      },
      {
        "name": "周望",
        "id": "char_ss_153"
      },
      {
        "name": "刘大中",
        "id": "char_ss_156"
      },
      {
        "name": "李擢",
        "id": "char_ss_158"
      },
      {
        "name": "富直柔从弟",
        "id": "char_ss_159"
      }
    ],
    "stats": {
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 45,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69
    },
    "wuchang": {
      "仁": 60,
      "义": 72,
      "礼": 69,
      "智": 66,
      "信": 74
    },
    "note": "冻结 e1c8384c 同剧本在世成年文官样本的中位数；未载行迹维持基线（低可信度），有据项目按 5/10/15 档调节。数字是游戏建模，不是史籍测量；未知健康、压力、家产采用明列的缺省或同职中位数。"
  },
  "characters": [
    {
      "id": "char_ss1127_governor_a6ff5b0a9005",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "孙竢",
      "zi": "",
      "haoName": "",
      "title": "京东西路安抚使",
      "officialTitle": "京东西路安抚使·知应天府",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "应天府",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "原任广州知州，建炎元年返行在，朝廷以为应天尹。\n\n现领京东西路安抚使事务，治所为应天府。",
      "background": "原任广州知州，建炎元年返行在，朝廷以为应天尹。",
      "description": "现领京东西路安抚使事务，治所为应天府。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "原任广州知州，建炎元年返行在，朝廷以为应天尹。\n\n现领京东西路安抚使事务，治所为应天府。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/孙竢.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 45,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷6：“會知廣州孫竢還朝，甫至行在，乃以爲應天尹。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "孙竢"
      }
    },
    {
      "id": "char_ss1127_governor_300f2f79736e",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "曾孝序",
      "zi": "",
      "haoName": "",
      "title": "京东东路经略安抚使",
      "officialTitle": "京东东路经略安抚使·知青州·制置使",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "青州",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "建炎元年任青州知州。六月朝廷一度召赴行在，青州百姓赴南都借留，获准继续守青州。\n\n现领京东东路经略安抚使事务，治所为青州。",
      "background": "建炎元年任青州知州。六月朝廷一度召赴行在，青州百姓赴南都借留，获准继续守青州。",
      "description": "现领京东东路经略安抚使事务，治所为青州。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "建炎元年任青州知州。六月朝廷一度召赴行在，青州百姓赴南都借留，获准继续守青州。\n\n现领京东东路经略安抚使事务，治所为青州。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/曾孝序.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 45,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷6：“旣而青州民詣南都借留孝序，上許之。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
        "《建炎以来系年要录》卷11：“資政殿學士京東東路經略安撫使兼制置使知青州曾孝序” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷011"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "曾孝序"
      }
    },
    {
      "id": "char_ss1127_governor_1d4878fd1616",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "孙昭远",
      "zi": "",
      "haoName": "",
      "title": "京西北路安抚使",
      "officialTitle": "京西北路安抚使·京西北路制置使·西京留守·河南尹",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "河南府",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "曾任西道副总管，督促陕西诸路勤王。建炎元年入见后任河南尹、西京留守、西道都总管，七月改京西北路制置使，收集义兵保守伊洛。\n\n现领京西北路安抚使事务，治所为河南府。",
      "background": "曾任西道副总管，督促陕西诸路勤王。建炎元年入见后任河南尹、西京留守、西道都总管，七月改京西北路制置使，收集义兵保守伊洛。",
      "description": "现领京西北路安抚使事务，治所为河南府。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "曾任西道副总管，督促陕西诸路勤王。建炎元年入见后任河南尹、西京留守、西道都总管，七月改京西北路制置使，收集义兵保守伊洛。\n\n现领京西北路安抚使事务，治所为河南府。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 77,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/孙昭远.png",
      "loyalty": 80,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 55,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷6：“卽以爲河南尹、西京留守、西道都總管” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
        "《建炎以来系年要录》卷7：“時西道都總管孫昭遠初至河南府，調陝西河北義兵合萬人，柵伊陽，使民入保，會罷四總管，昭遠改除京西北路制置使。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "M",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "孙昭远"
      }
    },
    {
      "id": "char_ss1127_governor_c02afcee05fb",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "唐重",
      "zi": "圣任",
      "haoName": "",
      "title": "永兴军路经略安抚使",
      "officialTitle": "永兴军路经略安抚使·知京兆府·经略制置使",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 39,
      "birthplace": "眉州彭山",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "大观三年进士",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "京兆府",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "字圣任，眉州彭山人，大观三年进士。历州县、吏部和台谏，靖康间反对以告发搜括民间金银。出知同州，面对金兵以数百残兵守城。建炎元年六月任京兆府。\n\n现领永兴军路经略安抚使事务，治所为京兆府。",
      "background": "字圣任，眉州彭山人，大观三年进士。历州县、吏部和台谏，靖康间反对以告发搜括民间金银。出知同州，面对金兵以数百残兵守城。建炎元年六月任京兆府。",
      "description": "现领永兴军路经略安抚使事务，治所为京兆府。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "字圣任，眉州彭山人，大观三年进士。历州县、吏部和台谏，靖康间反对以告发搜括民间金银。出知同州，面对金兵以数百残兵守城。建炎元年六月任京兆府。\n\n现领永兴军路经略安抚使事务，治所为京兆府。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 70,
        "义": 77,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/唐重.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 55,
      "administration": 75,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 60,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷6：“天章閣待制知同州唐重，充天章閣直學士知京兆府。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
        "《宋史》卷447·唐重传：“唐重，字聖任，眉州彭山人。少有大志。大觀三年進士。\n重度不能守，乃開門縱州人使出，自以殘兵數百守城，以示必死。” https://zh.wikisource.org/wiki/宋史/卷447",
        "《宋史》卷447·唐重传：“重曰：「如此，則子得以告父，弟得以告兄，奴婢得以告主矣，豈初政所宜？」即與御史抗論，乃止。” https://zh.wikisource.org/wiki/宋史/卷447"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "M",
          "义": "M",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "唐重"
      }
    },
    {
      "id": "char_ss1127_governor_38022d9fa902",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "赵明诚",
      "zi": "",
      "haoName": "",
      "title": "江南东路安抚使",
      "officialTitle": "江南东路安抚使·知江宁府·江东经制副使",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 46,
      "birthplace": "密州诸城",
      "birthTime": "1081年",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "江宁府",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "赵挺之子，喜访金石刻辞，考订古文与名氏年代。建炎元年七月起复直龙图阁，知江宁府兼江东经制副使，八月到任。\n\n现领江南东路安抚使事务，治所为江宁府。",
      "background": "赵挺之子，喜访金石刻辞，考订古文与名氏年代。建炎元年七月起复直龙图阁，知江宁府兼江东经制副使，八月到任。",
      "description": "现领江南东路安抚使事务，治所为江宁府。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "赵挺之子，喜访金石刻辞，考订古文与名氏年代。建炎元年七月起复直龙图阁，知江宁府兼江东经制副使，八月到任。\n\n现领江南东路安抚使事务，治所为江宁府。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 76,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/赵明诚.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 76,
      "valor": 45,
      "military": 45,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷7：“仍起復直龍圖閣趙明誠知江寧府兼江東經制副使。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007",
        "《建炎以来系年要录》卷7：“《建康知府題名》明誠以元年八月到任” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007",
        "赵明诚《金石录序》：“余自少小喜從當世學士大夫訪問前代金石刻詞以為異聞後得歐陽文忠公集古録讀而賢之以為是正譌謬有功於後學甚大” https://zh.wikisource.org/wiki/文章辨體彚選_(四庫全書本)/全覽11",
        "李清照《金石录后序》（年龄条）：“侯年二十一，在太學作學生。” https://zh.wikisource.org/wiki/金石錄_(四庫全書本)/後序"
      ],
      "birthYear": 1081,
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "M",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "赵明诚"
      }
    },
    {
      "id": "char_ss1127_governor_f12255a73493",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "姚鹏",
      "zi": "",
      "haoName": "",
      "title": "江南西路安抚使",
      "officialTitle": "江南西路安抚使·知洪州",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "洪州",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "原以直秘阁知深州，领河北勤王军南来。建炎元年五月升直龙图阁、知洪州。\n\n现领江南西路安抚使事务，治所为洪州。",
      "background": "原以直秘阁知深州，领河北勤王军南来。建炎元年五月升直龙图阁、知洪州。",
      "description": "现领江南西路安抚使事务，治所为洪州。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "原以直秘阁知深州，领河北勤王军南来。建炎元年五月升直龙图阁、知洪州。\n\n现领江南西路安抚使事务，治所为洪州。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/姚鹏.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 45,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷5：“直祕閣知深州姚鵬，陞直龍圖閣，知洪州。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷005"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "姚鹏"
      }
    },
    {
      "id": "char_ss1127_governor_ff09be894684",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "唐悫",
      "zi": "",
      "haoName": "",
      "title": "荆湖北路安抚使",
      "officialTitle": "荆湖北路安抚使·知荆南府",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "江陵府",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "原以秘阁修撰知鼎州。军贼祝靖等侵扰荆湖时，调本路刀弩手助公安守御。建炎元年六月改知荆南府。\n\n现领荆湖北路安抚使事务，治所为江陵府。",
      "background": "原以秘阁修撰知鼎州。军贼祝靖等侵扰荆湖时，调本路刀弩手助公安守御。建炎元年六月改知荆南府。",
      "description": "现领荆湖北路安抚使事务，治所为江陵府。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "原以秘阁修撰知鼎州。军贼祝靖等侵扰荆湖时，调本路刀弩手助公安守御。建炎元年六月改知荆南府。\n\n现领荆湖北路安抚使事务，治所为江陵府。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/唐悫.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 50,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷6：“祕閣修撰知鼎州唐愨，知荊南府。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
        "《建炎以来系年要录》卷6：“唐愨自鼎州調本路刀弩手助之，賊乃去。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "唐悫"
      }
    },
    {
      "id": "char_ss1127_governor_ae2510fc5b08",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "曾开",
      "zi": "",
      "haoName": "",
      "title": "荆湖南路安抚使",
      "officialTitle": "荆湖南路安抚使·知潭州",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "潭州",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "曾楙之弟。建炎元年六月自提举杭州洞霄宫复显谟阁待制、知潭州。\n\n现领荆湖南路安抚使事务，治所为潭州。",
      "background": "曾楙之弟。建炎元年六月自提举杭州洞霄宫复显谟阁待制、知潭州。",
      "description": "现领荆湖南路安抚使事务，治所为潭州。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "曾楙之弟。建炎元年六月自提举杭州洞霄宫复显谟阁待制、知潭州。\n\n现领荆湖南路安抚使事务，治所为潭州。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/曾开.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 45,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷6：“朝奉大夫提舉杭州洞霄宮曾開，復顯謨閣待制，知潭州。開，楙弟也。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "曾开"
      }
    },
    {
      "id": "char_ss1127_governor_22e90ed83317",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "卢法原",
      "zi": "",
      "haoName": "",
      "title": "成都府路安抚使",
      "officialTitle": "成都府路安抚使·知成都府",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "成都府",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "以徽猷阁直学士知成都府，成都为蜀中要府。\n\n现领成都府路安抚使事务，治所为成都府。",
      "background": "以徽猷阁直学士知成都府，成都为蜀中要府。",
      "description": "现领成都府路安抚使事务，治所为成都府。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "以徽猷阁直学士知成都府，成都为蜀中要府。\n\n现领成都府路安抚使事务，治所为成都府。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/卢法原.png",
      "loyalty": 75,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 45,
      "administration": 65,
      "management": 70,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷9：“徽猷閣直學士知成都府盧法原奉詔修城，費九縣市易常平錢八萬緡有奇，時苗役羨錢自市輕齎勤王，及撫諭官根刷之餘，猶存此數。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷009"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "卢法原"
      }
    },
    {
      "id": "char_ss1127_governor_9343c6079dab",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "赵点",
      "zi": "",
      "haoName": "",
      "title": "秦凤路经略安抚使",
      "officialTitle": "秦凤路经略安抚使·知秦州",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "秦州",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "原以直秘阁知秦州、秦凤路经略使。京城被围时受召勤王，未自领兵出援，只遣将官李安率军。\n\n现领秦凤路经略安抚使事务，治所为秦州。",
      "background": "原以直秘阁知秦州、秦凤路经略使。京城被围时受召勤王，未自领兵出援，只遣将官李安率军。",
      "description": "现领秦凤路经略安抚使事务，治所为秦州。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "原以直秘阁知秦州、秦凤路经略使。京城被围时受召勤王，未自领兵出援，只遣将官李安率军。\n\n现领秦凤路经略安抚使事务，治所为秦州。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 62,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/赵点.png",
      "loyalty": 65,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 35,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷1：“於是環慶經略使王似、熙河經略使王倚，各以兵來會，而涇原經略使席貢、秦鳳經略使趙點、鄜延經略使張深皆不至，昭遠凡二十八疏劾之，貢竟不行，點亦才遣將官李安領兵入援。秦州州學教授周良翰見點，責以京城危急，勸點自行，點不聽。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷001",
        "《建炎以来系年要录》卷9：“直祕閣知秦州趙點，勒停，坐獻馬於李綱也。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷009"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "M",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "赵点"
      }
    },
    {
      "id": "char_ss1127_governor_48777e25dcbd",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "席贡",
      "zi": "",
      "haoName": "",
      "title": "泾原路经略安抚使",
      "officialTitle": "泾原路经略安抚使·知渭州",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "渭州",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "泾原路经略使。京城被围时不应范致虚等的合兵勤王之檄，孙昭远多次上疏劾之。\n\n现领泾原路经略安抚使事务，治所为渭州。",
      "background": "泾原路经略使。京城被围时不应范致虚等的合兵勤王之檄，孙昭远多次上疏劾之。",
      "description": "现领泾原路经略安抚使事务，治所为渭州。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "泾原路经略使。京城被围时不应范致虚等的合兵勤王之檄，孙昭远多次上疏劾之。\n\n现领泾原路经略安抚使事务，治所为渭州。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 62,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/席贡.png",
      "loyalty": 65,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 40,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷1：“於是環慶經略使王似、熙河經略使王倚，各以兵來會，而涇原經略使席貢、秦鳳經略使趙點、鄜延經略使張深皆不至，昭遠凡二十八疏劾之，貢竟不行，點亦才遣將官李安領兵入援。秦州州學教授周良翰見點，責以京城危急，勸點自行，點不聽。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷001"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "M",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "席贡"
      }
    },
    {
      "id": "char_ss1127_governor_c6b7fab70075",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "王似",
      "zi": "",
      "haoName": "",
      "title": "环庆路经略安抚使",
      "officialTitle": "环庆路经略安抚使·知庆州",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "庆州",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "环庆路经略使。京城被围时率所部兵会范致虚等勤王军，后军屯陕府。\n\n现领环庆路经略安抚使事务，治所为庆州。",
      "background": "环庆路经略使。京城被围时率所部兵会范致虚等勤王军，后军屯陕府。",
      "description": "现领环庆路经略安抚使事务，治所为庆州。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "环庆路经略使。京城被围时率所部兵会范致虚等勤王军，后军屯陕府。\n\n现领环庆路经略安抚使事务，治所为庆州。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 77,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/王似.png",
      "loyalty": 80,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 50,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷1：“於是環慶經略使王似、熙河經略使王倚，各以兵來會，而涇原經略使席貢、秦鳳經略使趙點、鄜延經略使張深皆不至，昭遠凡二十八疏劾之，貢竟不行，點亦才遣將官李安領兵入援。秦州州學教授周良翰見點，責以京城危急，勸點自行，點不聽。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷001"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "M",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "王似"
      }
    },
    {
      "id": "char_ss1127_governor_978b9b3bdf9b",
      "sid": "sc-jianyan1-1127-shaosong",
      "name": "张深",
      "zi": "",
      "haoName": "",
      "title": "熙河兰湟路经略安抚使",
      "officialTitle": "熙河兰湟路经略安抚使·知熙州",
      "role": "路级帅臣",
      "alive": true,
      "active": true,
      "gender": "男",
      "age": 55,
      "birthplace": "",
      "birthTime": "",
      "ethnicity": "汉",
      "faith": "儒",
      "culture": "汉",
      "learning": "",
      "appearance": "",
      "diction": "",
      "personality": "",
      "location": "熙州",
      "rankLevel": 4,
      "faction": "大宋",
      "factionId": "fac_song",
      "party": "",
      "partyRank": "",
      "family": "",
      "familyTier": "",
      "familyRole": "",
      "familyStatus": {},
      "clanPrestige": 0,
      "mentor": "",
      "superior": "",
      "hobbies": [],
      "innerThought": "",
      "personalGoal": "",
      "stressSources": [],
      "isHistorical": true,
      "isFictional": false,
      "type": "historical",
      "career": [],
      "familyMembers": [],
      "bio": "原任鄜延路经略使、延安府知府，率兵勤王。建炎元年五月一度拟知京兆，后改知熙州、任熙河经略使，辞行时所部孙渥一军留卫行在，其余还本路。\n\n现领熙河兰湟路经略安抚使事务，治所为熙州。",
      "background": "原任鄜延路经略使、延安府知府，率兵勤王。建炎元年五月一度拟知京兆，后改知熙州、任熙河经略使，辞行时所部孙渥一军留卫行在，其余还本路。",
      "description": "现领熙河兰湟路经略安抚使事务，治所为熙州。",
      "resources": {
        "privateWealth": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        },
        "fame": 0,
        "health": 65,
        "stress": 20,
        "publicPurse": {
          "money": 0,
          "grain": 0,
          "cloth": 0
        }
      },
      "health": 65,
      "stress": 20,
      "traits": [],
      "traitIds": [],
      "relations": {},
      "_memory": [],
      "aiPersonaText": "原任鄜延路经略使、延安府知府，率兵勤王。建炎元年五月一度拟知京兆，后改知熙州、任熙河经略使，辞行时所部孙渥一军留卫行在，其余还本路。\n\n现领熙河兰湟路经略安抚使事务，治所为熙州。",
      "behaviorMode": "",
      "valueSystem": "",
      "speechStyle": "",
      "secret": "",
      "skills": [],
      "dialogues": [],
      "rels": [],
      "occupation": "文官",
      "class": "宰执文臣",
      "socialClass": "civilOfficial",
      "rosterRole": "civil",
      "wuchangOverride": {
        "仁": 60,
        "义": 72,
        "礼": 69,
        "智": 66,
        "信": 74
      },
      "personalGoals": [],
      "vassalType": "",
      "playerRelation": "",
      "spouse": false,
      "portrait": "assets/portraits/shaosong/张深.png",
      "loyalty": 70,
      "ambition": 50,
      "intelligence": 66,
      "valor": 45,
      "military": 50,
      "administration": 65,
      "management": 65,
      "charisma": 55,
      "diplomacy": 50,
      "benevolence": 50,
      "integrity": 69,
      "historicalSources": [
        "《建炎以来系年要录》卷5：“熙河經略使張深辭行，詔留深所部鄜延統制官孫渥一軍，衞行在，餘兵復還本路。” https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷005"
      ],
      "wuchangAssessment": {
        "version": 1,
        "kind": "historical-inference",
        "confidence": {
          "仁": "L",
          "义": "L",
          "礼": "L",
          "智": "L",
          "信": "L"
        },
        "reference": "省道主官说明.md",
        "key": "张深"
      }
    }
  ],
  "characterUpdates": [
    {
      "name": "宗泽",
      "set": {
        "title": "东京留守兼开封尹",
        "officialTitle": "东京留守兼开封尹",
        "location": "开封府"
      },
      "unset": [
        "mapLocationBinding",
        "regionId",
        "mapRegionId"
      ],
      "sources": [
        "ss-zongze"
      ],
      "reason": "使现职官称可活绑定；落点用该路实际首府。王庶另移除误记次年节制全陕的未来经历。"
    },
    {
      "name": "范致虚",
      "set": {
        "title": "京西南路安抚使",
        "officialTitle": "京西南路安抚使·知邓州",
        "location": "襄阳府"
      },
      "unset": [
        "mapLocationBinding",
        "regionId",
        "mapRegionId"
      ],
      "sources": [
        "ss-fan-deng",
        "ss-fan-jingxi"
      ],
      "reason": "使现职官称可活绑定；落点用该路实际首府。王庶另移除误记次年节制全陕的未来经历。"
    },
    {
      "name": "吕颐浩",
      "set": {
        "title": "淮南东路安抚使",
        "officialTitle": "淮南东路安抚使·知扬州",
        "location": "扬州"
      },
      "unset": [
        "mapLocationBinding",
        "regionId",
        "mapRegionId"
      ],
      "sources": [
        "ss-lv"
      ],
      "reason": "使现职官称可活绑定；落点用该路实际首府。王庶另移除误记次年节制全陕的未来经历。"
    },
    {
      "name": "胡舜陟",
      "set": {
        "title": "淮南西路安抚使",
        "officialTitle": "淮南西路安抚使·知庐州",
        "location": "庐州"
      },
      "unset": [
        "mapLocationBinding",
        "regionId",
        "mapRegionId"
      ],
      "sources": [
        "ss-hu",
        "ss-hu-defence"
      ],
      "reason": "使现职官称可活绑定；落点用该路实际首府。王庶另移除误记次年节制全陕的未来经历。"
    },
    {
      "name": "王庶",
      "set": {
        "title": "鄜延路经略安抚使",
        "officialTitle": "鄜延路经略安抚使·知延安府",
        "location": "延安府",
        "bio": "庆阳人。崇宁五年进士，历官州县，靖康间任陕西计度转运副使。建炎元年五月升直龙图阁、知延安府，主持鄜延一路军民。",
        "aiPersonaText": "庆阳文臣，建炎元年知延安府，主持鄜延一路军民。",
        "personalGoal": "",
        "personalGoals": [],
        "innerThought": "",
        "stressSources": [],
        "personalGrudges": [],
        "_memory": [],
        "_scars": [],
        "dialogues": [],
        "career": [],
        "coreMotivations": []
      },
      "unset": [
        "mapLocationBinding",
        "regionId",
        "mapRegionId"
      ],
      "sources": [
        "ss-wangshu"
      ],
      "reason": "使现职官称可活绑定；落点用该路实际首府。王庶另移除误记次年节制全陕的未来经历。"
    },
    {
      "name": "张所",
      "set": {
        "title": "河北招抚使",
        "officialTitle": "河北招抚使",
        "location": "卫州"
      },
      "unset": [
        "mapLocationBinding",
        "regionId",
        "mapRegionId"
      ],
      "sources": [
        "ss-zhangsuo"
      ],
      "reason": "使现职官称可活绑定；落点用该路实际首府。王庶另移除误记次年节制全陕的未来经历。"
    },
    {
      "name": "脱黑脱阿",
      "set": {
        "officialTitle": "少年贵族·蔑儿乞别乞之裔"
      },
      "sources": [],
      "reason": "原剧本明确为未掌权的虚构少年，仅调整词序，避免前缀匹配到在任别乞。"
    },
    {
      "name": "赵哲",
      "set": {
        "title": "大金通问副使",
        "officialTitle": "大金通问副使·武功大夫·达州刺史",
        "role": "使臣",
        "bio": "建炎元年曾以百骑分队与金军交战，奉书至元帅府。五月以武功大夫领达州刺史，为周望通问使之副。",
        "aiPersonaText": "武功大夫赵哲，建炎元年以达州刺史充通问副使。",
        "location": "行在",
        "stance": "",
        "personalGoal": "",
        "personalGoals": [],
        "innerThought": "",
        "stressSources": [],
        "dialogues": [],
        "career": [],
        "_memory": [],
        "_scars": [],
        "coreMotivations": [],
        "valueSystem": "",
        "behaviorMode": "",
        "secret": ""
      },
      "unset": [
        "mapLocationBinding",
        "regionId",
        "mapRegionId"
      ],
      "sources": [
        "ss-zhaozhe"
      ],
      "reason": "旧稿把后来的环庆经略经历提前，导致新补王似后官称冲突；修正相关现职与未来化处境。"
    }
  ],
  "offices": [
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "京东西路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "孙竢",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-sunsi"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "京东东路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "曾孝序",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-zeng-stay",
        "ss-zeng-office"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "京西北路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "孙昭远",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-sunzhao",
        "ss-sunzhao-jingxi"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "京西南路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "范致虚",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-fan-deng",
        "ss-fan-jingxi"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "永兴军路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "唐重",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-tangzhong",
        "ss-tang-bio",
        "ss-tang-civil"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "淮南东路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "吕颐浩",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-lv"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "淮南西路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "胡舜陟",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-hu",
        "ss-hu-defence"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "江南东路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "赵明诚",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-zhaoming",
        "ss-zhao-arrive",
        "ss-zhao-scholar",
        "ss-zhao-age"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "江南西路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "姚鹏",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-yaopeng"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "荆湖北路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "唐悫",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-tangque",
        "ss-tangque-aid"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "荆湖南路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "曾开",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-zengkai"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "成都府路安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "卢法原",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-lufayuan"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "秦凤路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "赵点",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-west-five",
        "ss-zhaodian-end"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "泾原路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "席贡",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-west-five"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "环庆路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "王似",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-west-five"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "鄜延路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "王庶",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-wangshu"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "熙河兰湟路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "张深",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-zhangshen"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "position": {
        "name": "福建路安抚使",
        "rank": "从三品·诸路",
        "holder": "",
        "desc": "掌本路帅司事务。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 1,
        "authority": "decision",
        "succession": "appointment",
        "duties": "掌本路帅司事务。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-system"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "position": {
        "name": "广南东路经略安抚使",
        "rank": "从三品·诸路",
        "holder": "",
        "desc": "掌本路帅司事务。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 1,
        "authority": "decision",
        "succession": "appointment",
        "duties": "掌本路帅司事务。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-guangdong-vacancy"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "position": {
        "name": "广南西路经略安抚使",
        "rank": "从三品·诸路",
        "holder": "",
        "desc": "掌本路帅司事务。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 1,
        "authority": "decision",
        "succession": "appointment",
        "duties": "掌本路帅司事务。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-system"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "position": {
        "name": "潼川府路安抚使",
        "rank": "从三品·诸路",
        "holder": "",
        "desc": "掌本路帅司事务。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 1,
        "authority": "decision",
        "succession": "appointment",
        "duties": "掌本路帅司事务。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-lifu",
        "ss-system"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "position": {
        "name": "夔州路安抚使",
        "rank": "从三品·诸路",
        "holder": "",
        "desc": "掌本路帅司事务。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 1,
        "authority": "decision",
        "succession": "appointment",
        "duties": "掌本路帅司事务。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-lifu",
        "ss-system"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "position": {
        "name": "利州路安抚使",
        "rank": "从三品·诸路",
        "holder": "",
        "desc": "掌本路帅司事务。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 1,
        "authority": "decision",
        "succession": "appointment",
        "duties": "掌本路帅司事务。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-lifu",
        "ss-system"
      ]
    },
    {
      "owner": "player",
      "department": "诸路帅司",
      "departmentId": "off_ss1127_circuit_governors",
      "position": {
        "name": "知三泉县",
        "rank": "县令（实秩未详）",
        "holder": "",
        "desc": "掌三泉县政。",
        "establishedCount": 1,
        "salary": 6,
        "perPersonSalary": "月俸 6 石 · 岁俸 72 石（沿用宋县官游戏俸档）",
        "vacancyCount": 1,
        "authority": "decision",
        "succession": "appointment",
        "duties": "掌三泉县政。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-system"
      ]
    },
    {
      "owner": "fac_xijun",
      "department": "陕西六路经略安抚司 (帅司·路军政)",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "泾原路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "席贡",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-west-five"
      ]
    },
    {
      "owner": "fac_xijun",
      "department": "陕西六路经略安抚司 (帅司·路军政)",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "环庆路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "王似",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-west-five"
      ]
    },
    {
      "owner": "fac_xijun",
      "department": "陕西六路经略安抚司 (帅司·路军政)",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "熙河兰湟路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "张深",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-zhangshen"
      ]
    },
    {
      "owner": "fac_xijun",
      "department": "陕西六路经略安抚司 (帅司·路军政)",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "秦凤路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "赵点",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-west-five",
        "ss-zhaodian-end"
      ]
    },
    {
      "owner": "fac_xijun",
      "department": "陕西六路经略安抚司 (帅司·路军政)",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "鄜延路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "王庶",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-wangshu"
      ]
    },
    {
      "owner": "fac_xijun",
      "department": "陕西六路经略安抚司 (帅司·路军政)",
      "departmentDescription": "诸路帅臣任官；省道与财政漕司分列。",
      "position": {
        "name": "永兴军路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "唐重",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "sources": [
        "ss-tangzhong",
        "ss-tang-bio",
        "ss-tang-civil"
      ]
    }
  ],
  "officeUpdates": [
    {
      "owner": "player",
      "ref": "关陕宣抚·制置司 (西军)/泾原路经略安抚使·节度使",
      "set": {
        "name": "泾原路统制官",
        "rank": "武臣（实秩未详）",
        "duties": "泾原路军将，统制本部兵马。",
        "desc": "泾原路军将，统制本部兵马。"
      },
      "sources": [
        "ss-west-five"
      ],
      "reason": "曲端此时尚不是一路经略使。"
    },
    {
      "owner": "player",
      "ref": "关陕宣抚·制置司 (西军)/熙河路经略·秦凤路承宣使",
      "set": {
        "name": "泾原路第十二将副将",
        "rank": "武臣（实秩未详）",
        "establishedCount": 1,
        "vacancyCount": 0,
        "duties": "泾原路第十二将副将。",
        "desc": "泾原路第十二将副将。"
      },
      "sources": [],
      "reason": "同步前轮吴玠已核现职，不再沿用未来的经略头衔。"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/环庆路经略安抚使",
      "set": {
        "name": "环庆路经略安抚使",
        "rank": "帅臣（品秩随寄禄官）",
        "holder": "王似",
        "desc": "总本路军民、守备与抚绥，转运财官另理其职。",
        "establishedCount": 1,
        "salary": 35,
        "perPersonSalary": "月俸 35 石 · 岁俸 420 石",
        "vacancyCount": 0,
        "authority": "decision",
        "succession": "appointment",
        "duties": "总本路军民、守备与抚绥，转运财官另理其职。",
        "publicTreasuryInit": {
          "money": 0,
          "grain": 0,
          "cloth": 0,
          "quotaMoney": 0,
          "quotaGrain": 0,
          "quotaCloth": 0
        },
        "bindingHint": "region",
        "privateIncome": {
          "bonusType": "恩赏",
          "illicitRisk": "medium"
        },
        "powers": {
          "appointment": true,
          "impeach": true,
          "supervise": true,
          "taxCollect": false,
          "militaryCommand": true
        }
      },
      "unset": [],
      "sources": [
        "ss-west-five"
      ],
      "reason": "西军环庆旧席直接更正为王似并与宋廷逐字段对齐，保留数组位置，重复应用不挪动席序。"
    }
  ],
  "bindings": [
    {
      "owner": "player",
      "nodeId": "div_ss_e15bbc8644e3",
      "name": "京畿路",
      "governorOffice": "东京留守司 (北疆·开封·孤悬)/东京留守兼开封尹",
      "holder": "宗泽",
      "status": "连上",
      "sources": [
        "ss-zongze"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_461adb50ff30",
      "name": "京东西路",
      "governorOffice": "诸路帅司/京东西路安抚使",
      "holder": "孙竢",
      "status": "新补",
      "sources": [
        "ss-sunsi",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_4bb800f0edbe",
      "name": "京东东路",
      "governorOffice": "诸路帅司/京东东路经略安抚使",
      "holder": "曾孝序",
      "status": "新补",
      "sources": [
        "ss-zeng-stay",
        "ss-zeng-office",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_790a15370d02",
      "name": "京西北路",
      "governorOffice": "诸路帅司/京西北路安抚使",
      "holder": "孙昭远",
      "status": "新补",
      "sources": [
        "ss-sunzhao",
        "ss-sunzhao-jingxi",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_bd013d7d7de2",
      "name": "京西南路",
      "governorOffice": "诸路帅司/京西南路安抚使",
      "holder": "范致虚",
      "status": "新补",
      "sources": [
        "ss-fan-deng",
        "ss-fan-jingxi",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "原误写京西北路；改为京西南路。任命与到任分开，十二月到官说仍列待核。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_3426f7d6ea70",
      "name": "永兴军路",
      "governorOffice": "诸路帅司/永兴军路经略安抚使",
      "holder": "唐重",
      "status": "新补",
      "sources": [
        "ss-tangzhong",
        "ss-tang-bio",
        "ss-tang-civil",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_efe9eeb8c902",
      "name": "淮南东路",
      "governorOffice": "诸路帅司/淮南东路安抚使",
      "holder": "吕颐浩",
      "status": "新补",
      "sources": [
        "ss-lv",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_2d2e4aac0b36",
      "name": "淮南西路",
      "governorOffice": "诸路帅司/淮南西路安抚使",
      "holder": "胡舜陟",
      "status": "新补",
      "sources": [
        "ss-hu",
        "ss-hu-defence",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_e09dfe01cd2c",
      "name": "江南东路",
      "governorOffice": "诸路帅司/江南东路安抚使",
      "holder": "赵明诚",
      "status": "新补",
      "sources": [
        "ss-zhaoming",
        "ss-zhao-arrive",
        "ss-zhao-scholar",
        "ss-zhao-age",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "《要录》考订七月授命、八月到任；具体到任日未详。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_ae275acfc704",
      "name": "江南西路",
      "governorOffice": "诸路帅司/江南西路安抚使",
      "holder": "姚鹏",
      "status": "新补",
      "sources": [
        "ss-yaopeng",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_c035e61cb806",
      "name": "荆湖北路",
      "governorOffice": "诸路帅司/荆湖北路安抚使",
      "holder": "唐悫",
      "status": "新补",
      "sources": [
        "ss-tangque",
        "ss-tangque-aid",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_5bb300355425",
      "name": "荆湖南路",
      "governorOffice": "诸路帅司/荆湖南路安抚使",
      "holder": "曾开",
      "status": "新补",
      "sources": [
        "ss-zengkai",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_4aad9569a7c9",
      "name": "成都府路",
      "governorOffice": "诸路帅司/成都府路安抚使",
      "holder": "卢法原",
      "status": "新补",
      "sources": [
        "ss-lufayuan",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "邻月现任回证，八月延任属 M，非新找得八月任命。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_383068df97eb",
      "name": "秦凤路",
      "governorOffice": "诸路帅司/秦凤路经略安抚使",
      "holder": "赵点",
      "status": "新补",
      "sources": [
        "ss-west-five",
        "ss-zhaodian-end",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_c8ee00c88194",
      "name": "泾原路",
      "governorOffice": "诸路帅司/泾原路经略安抚使",
      "holder": "席贡",
      "status": "新补",
      "sources": [
        "ss-west-five",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_564e48e76e57",
      "name": "环庆路",
      "governorOffice": "诸路帅司/环庆路经略安抚使",
      "holder": "王似",
      "status": "新补",
      "sources": [
        "ss-west-five",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_b50745e66c46",
      "name": "鄜延路",
      "governorOffice": "诸路帅司/鄜延路经略安抚使",
      "holder": "王庶",
      "status": "新补",
      "sources": [
        "ss-wangshu",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_afd24c201baf",
      "name": "熙河兰湟路",
      "governorOffice": "诸路帅司/熙河兰湟路经略安抚使",
      "holder": "张深",
      "status": "新补",
      "sources": [
        "ss-zhangshen",
        "ss-system",
        "ss-concurrent",
        "ss-river"
      ],
      "reason": "据任命与帅司制度补位；知府知州兼帅的省略官衔按职官志说明。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_4b0d957f66c3",
      "name": "河北西路",
      "governorOffice": "河北招抚司 (北疆·李纲罢后随废)/河北招抚使",
      "holder": "张所",
      "status": "连上",
      "sources": [
        "ss-zhangsuo"
      ],
      "reason": "河北宋有分区处战争状态，沿实际河北招抚使，不杜撰同月安抚使。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_983349928199",
      "name": "福建路",
      "governorOffice": "诸路帅司/福建路安抚使",
      "holder": "",
      "status": "出缺",
      "sources": [
        "ss-system"
      ],
      "reason": "江常只考到建炎元年知福州的线索，八月任期未坐实；程迈属后年，不提前。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_a6fd2ffe8c7e",
      "name": "广南东路",
      "governorOffice": "诸路帅司/广南东路经略安抚使",
      "holder": "",
      "status": "出缺",
      "sources": [
        "ss-guangdong-vacancy"
      ],
      "reason": "陈述摄帅、陈邦光继任的月日未考定；不为补人把财官提前当正帅。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_34c36723a461",
      "name": "广南西路",
      "governorOffice": "诸路帅司/广南西路经略安抚使",
      "holder": "",
      "status": "出缺",
      "sources": [
        "ss-system"
      ],
      "reason": "查《要录》元年各卷、广西经略司边事，未考定八月任官。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_097b3ab61827",
      "name": "潼川府路",
      "governorOffice": "诸路帅司/潼川府路安抚使",
      "holder": "",
      "status": "出缺",
      "sources": [
        "ss-lifu",
        "ss-system"
      ],
      "reason": "查《要录》元年各卷及职官志，未考定八月路帅。沿需求保留可任官空席，非断言史实当时缺员；具体建置仍待核。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_8b62646aa40c",
      "name": "夔州路",
      "governorOffice": "诸路帅司/夔州路安抚使",
      "holder": "",
      "status": "出缺",
      "sources": [
        "ss-lifu",
        "ss-system"
      ],
      "reason": "查《要录》元年各卷及职官志，未考定八月路帅。沿需求保留可任官空席，非断言史实当时缺员；具体建置仍待核。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_d2a89e66588a",
      "name": "利州路",
      "governorOffice": "诸路帅司/利州路安抚使",
      "holder": "",
      "status": "出缺",
      "sources": [
        "ss-lifu",
        "ss-system"
      ],
      "reason": "查《要录》元年各卷及职官志，未考定八月路帅。沿需求保留可任官空席，非断言史实当时缺员；具体建置仍待核。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_62f22151b8ab",
      "name": "三泉直隶",
      "governorOffice": "诸路帅司/知三泉县",
      "holder": "",
      "status": "出缺",
      "sources": [
        "ss-system"
      ],
      "reason": "直隶县无路帅，不创造三泉安抚使；县令姓名未考。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_90bec1753763",
      "name": "两浙路",
      "governorOffice": null,
      "holder": "",
      "status": "枚举",
      "governanceNote": "分镇",
      "governanceDetail": "浙东与浙西分别置安抚。八月叶梦得被杭州叛军拘执，翟汝文从越州出师；不能将一人的官职套为两浙全域。",
      "sources": [
        "ss-zhejiang"
      ],
      "reason": "按开局真实分治格局，不将局部将领升作整路主官。"
    },
    {
      "owner": "player",
      "nodeId": "div_ss_733c7e0a7ef2",
      "name": "河东路",
      "governorOffice": null,
      "holder": "",
      "status": "枚举",
      "governanceNote": "分镇",
      "governanceDetail": "太原已失，宋有部分包括麟府等沿河军州，折可求、徐徽言等各守其地，无一名实际统领全路的安抚使。",
      "sources": [
        "ss-west-five"
      ],
      "reason": "按开局真实分治格局，不将局部将领升作整路主官。"
    }
  ],
  "sources": [
    {
      "id": "ss-system",
      "title": "《宋史》卷167·职官七",
      "url": "https://zh.wikisource.org/wiki/宋史/卷167",
      "file": "sources/shaosong-governors/raw/songshi-167.txt",
      "quote": "經略安撫司經略安撫使，一人，以直秘閣以上充，掌一路兵民之事。",
      "claim": "安抚帅司的一般职掌；不涉及转运财官。",
      "confidence": "H"
    },
    {
      "id": "ss-concurrent",
      "title": "《宋史》卷167·职官七",
      "url": "https://zh.wikisource.org/wiki/宋史/卷167",
      "file": "sources/shaosong-governors/raw/songshi-167.txt",
      "quote": "太原府、延安府、慶州、渭州、熙州、秦州則兼經略安撫使、馬歩軍都總管。定州眞定府、瀛州、大名府、京兆府則兼安撫使、馬歩軍都總管。瀘州、潭州、廣州、桂州、雄州則兼安撫使、兵馬鈐轄。潁昌府、靑州、鄆州、許州、鄧州則兼安撫使、兵馬巡檢。其-{餘}-大藩府",
      "claim": "知州知府兼帅的制度依据；任命省略安抚衔时据此解释。",
      "confidence": "H"
    },
    {
      "id": "ss-river",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "每路文臣爲安撫使、馬步軍都總管，總一路兵，政許便宜行事，武臣副之。",
      "claim": "六月李纲沿河、沿淮、沿江置帅府议。",
      "confidence": "H"
    },
    {
      "id": "ss-zongze",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "上乃許之，徙澤知開封府",
      "claim": "六月任开封；京畿仍用东京留守。",
      "confidence": "H"
    },
    {
      "id": "ss-sunsi",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "會知廣州孫竢還朝，甫至行在，乃以爲應天尹。",
      "claim": "六月应天尹；依知府兼路帅旧制（职官志、河防置帅议）绑定京东西。",
      "confidence": "H"
    },
    {
      "id": "ss-zeng-stay",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "旣而青州民詣南都借留孝序，上許之。",
      "claim": "六月先召而留，不能误删在任。",
      "confidence": "H"
    },
    {
      "id": "ss-zeng-office",
      "title": "《建炎以来系年要录》卷11",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷011",
      "file": "sources/shaosong-governors/raw/yaolu-011.txt",
      "quote": "資政殿學士京東東路經略安撫使兼制置使知青州曾孝序",
      "claim": "十二月遇害条回证官衔；后事不入开局。",
      "confidence": "H"
    },
    {
      "id": "ss-sunzhao",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "卽以爲河南尹、西京留守、西道都總管",
      "claim": "六月任河南尹、西京留守。",
      "confidence": "H"
    },
    {
      "id": "ss-sunzhao-jingxi",
      "title": "《建炎以来系年要录》卷7",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007",
      "file": "sources/shaosong-governors/raw/yaolu-007.txt",
      "quote": "時西道都總管孫昭遠初至河南府，調陝西河北義兵合萬人，柵伊陽，使民入保，會罷四總管，昭遠改除京西北路制置使。",
      "claim": "七月改京西北制置；路帅按安抚槽位记，另保留制置兼职。",
      "confidence": "H"
    },
    {
      "id": "ss-fan-deng",
      "title": "《建炎以来系年要录》卷5",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷005",
      "file": "sources/shaosong-governors/raw/yaolu-005.txt",
      "quote": "知鄧州，充南道都總管",
      "claim": "五月初除邓州。",
      "confidence": "H"
    },
    {
      "id": "ss-fan-jingxi",
      "title": "《建炎以来系年要录》卷12",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷012",
      "file": "sources/shaosong-governors/raw/yaolu-012.txt",
      "quote": "初觀文殿學士京西南路安撫使-{范}-致虛既受命，會河東制置使趙宗印引兵自商山出武關，欲趨行在，與致虛會於方城",
      "claim": "十二月到任说与五月初除相互参看；任命可据，到任时点不够明确，M。",
      "confidence": "M"
    },
    {
      "id": "ss-tangzhong",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "天章閣待制知同州唐重，充天章閣直學士知京兆府。",
      "claim": "六月除任京兆，依永兴军路帅府建制。",
      "confidence": "H"
    },
    {
      "id": "ss-lv",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "呂頤浩，爲徽猷閣直學士，知揚州。",
      "claim": "六月扬州现任。",
      "confidence": "H"
    },
    {
      "id": "ss-hu",
      "title": "《建炎以来系年要录》卷7",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007",
      "file": "sources/shaosong-governors/raw/yaolu-007.txt",
      "quote": "侍御史胡舜陟，充祕閣修撰，知廬州。",
      "claim": "七月除任；不沿用旧御史现职。",
      "confidence": "H"
    },
    {
      "id": "ss-hu-defence",
      "title": "《建炎以来系年要录》卷7",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007",
      "file": "sources/shaosong-governors/raw/yaolu-007.txt",
      "quote": "舜陟至，修治城池，建樓櫓戰棚，具藺石，布渠答，又增築東西水門，疏決壅潰，因濠壘以備衝擊，繇是廬人始安。",
      "claim": "任初修城守备，供能力依据。",
      "confidence": "H"
    },
    {
      "id": "ss-zhaoming",
      "title": "《建炎以来系年要录》卷7",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007",
      "file": "sources/shaosong-governors/raw/yaolu-007.txt",
      "quote": "仍起復直龍圖閣趙明誠知江寧府兼江東經制副使。",
      "claim": "七月起复。",
      "confidence": "H"
    },
    {
      "id": "ss-zhao-arrive",
      "title": "《建炎以来系年要录》卷7",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷007",
      "file": "sources/shaosong-governors/raw/yaolu-007.txt",
      "quote": "《建康知府題名》明誠以元年八月到任",
      "claim": "作者明辨日历误系次年正月；八月到任日未详。",
      "confidence": "H"
    },
    {
      "id": "ss-yaopeng",
      "title": "《建炎以来系年要录》卷5",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷005",
      "file": "sources/shaosong-governors/raw/yaolu-005.txt",
      "quote": "直祕閣知深州姚鵬，陞直龍圖閣，知洪州。",
      "claim": "五月任洪州。",
      "confidence": "H"
    },
    {
      "id": "ss-tangque",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "祕閣修撰知鼎州唐愨，知荊南府。",
      "claim": "六月任荆南。",
      "confidence": "H"
    },
    {
      "id": "ss-tangque-aid",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "唐愨自鼎州調本路刀弩手助之，賊乃去。",
      "claim": "调兵援公安，军事能力可据。",
      "confidence": "H"
    },
    {
      "id": "ss-zengkai",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "朝奉大夫提舉杭州洞霄宮曾開，復顯謨閣待制，知潭州。開，楙弟也。",
      "claim": "六月知潭州，依湖南兼帅旧制。",
      "confidence": "H"
    },
    {
      "id": "ss-lufayuan",
      "title": "《建炎以来系年要录》卷9",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷009",
      "file": "sources/shaosong-governors/raw/yaolu-009.txt",
      "quote": "徽猷閣直學士知成都府盧法原奉詔修城，費九縣市易常平錢八萬緡有奇，時苗役羨錢自市輕齎勤王，及撫諭官根刷之餘，猶存此數。",
      "claim": "九月邻月记录回证成都现任，八月续任推定 M。",
      "confidence": "M"
    },
    {
      "id": "ss-west-five",
      "title": "《建炎以来系年要录》卷1",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷001",
      "file": "sources/shaosong-governors/raw/yaolu-001.txt",
      "quote": "於是環慶經略使王似、熙河經略使王倚，各以兵來會，而涇原經略使席貢、秦鳳經略使趙點、鄜延經略使張深皆不至，昭遠凡二十八疏劾之，貢竟不行，點亦才遣將官李安領兵入援。秦州州學教授周良翰見點，責以京城危急，勸點自行，點不聽。",
      "claim": "年初五路任官与勤王表现；熙河后由张深接任。",
      "confidence": "H"
    },
    {
      "id": "ss-zhaodian-end",
      "title": "《建炎以来系年要录》卷9",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷009",
      "file": "sources/shaosong-governors/raw/yaolu-009.txt",
      "quote": "直祕閣知秦州趙點，勒停，坐獻馬於李綱也。",
      "claim": "九月才罢；八月仍任，不能预先替换李积。",
      "confidence": "H"
    },
    {
      "id": "ss-zhangshen",
      "title": "《建炎以来系年要录》卷5",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷005",
      "file": "sources/shaosong-governors/raw/yaolu-005.txt",
      "quote": "熙河經略使張深辭行，詔留深所部鄜延統制官孫渥一軍，衞行在，餘兵復還本路。",
      "claim": "五月以熙河经略使辞行，八月依最后已知任命续任。",
      "confidence": "H"
    },
    {
      "id": "ss-wangshu",
      "title": "《建炎以来系年要录》卷5",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷005",
      "file": "sources/shaosong-governors/raw/yaolu-005.txt",
      "quote": "起復直徽猷閣、陝府西路計度轉運副使王庶，升直龍圖閣、知延安府",
      "claim": "五月任延安；不把次年陕西节制任命提前。",
      "confidence": "H"
    },
    {
      "id": "ss-zhangsuo",
      "title": "《建炎以来系年要录》卷6",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷006",
      "file": "sources/shaosong-governors/raw/yaolu-006.txt",
      "quote": "遣張所招撫河北，王𤫉綞制河東",
      "claim": "引《龟鉴》记招抚河北；复用既有招抚使职，八月内废罢日期与剧情时点另列边界。",
      "confidence": "H"
    },
    {
      "id": "ss-zhejiang",
      "title": "《建炎以来系年要录》卷8",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷008",
      "file": "sources/shaosong-governors/raw/yaolu-008.txt",
      "quote": "浙東安撫使翟汝文聞變，自將七千人屯西興，且奏請浙西兵受其節制。",
      "claim": "请求浙西军受节制反证当时原非同一帅府，两浙合图不可用一人统全路。",
      "confidence": "H"
    },
    {
      "id": "ss-guangdong-vacancy",
      "title": "《建炎以来系年要录》卷12",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷012",
      "file": "sources/shaosong-governors/raw/yaolu-012.txt",
      "quote": "初廣東帥闕，轉運使直龍圖閣陳述攝行帥事，述所爲貪酷，朝廷命顯謨閣待制陳邦光知廣州",
      "claim": "陈述摄帅与陈邦光到任缺前段准确日期，不倒推到八月。",
      "confidence": "H"
    },
    {
      "id": "ss-lifu",
      "title": "《宋史》卷167·职官七",
      "url": "https://zh.wikisource.org/wiki/宋史/卷167",
      "file": "sources/shaosong-governors/raw/songshi-167.txt",
      "quote": "宣和二年，詔瀘州守臣帶潼川府、夔州路兵馬都鈐轄、瀘南沿邊路兵馬都鈐轄、瀘南沿邊安撫使。又詔罷置輔郡内潁昌府帶京西路安撫使。三年，詔杭、越州、江-{寧}-府、洪州守臣-{並}-帶安撫使。六年，詔瀘州止帶主管瀘南沿邊安撫司公事。仍差守臣。",
      "claim": "潼、夔与泸南职掌交错，未考准元年八月整路安抚建制，保留空席并列未决。",
      "confidence": "H"
    },
    {
      "id": "ss-tang-bio",
      "title": "《宋史》卷447·唐重传",
      "url": "https://zh.wikisource.org/wiki/宋史/卷447",
      "file": "sources/shaosong-governors/ss-tang-bio.txt",
      "quote": "唐重，字聖任，眉州彭山人。少有大志。大觀三年進士。\n重度不能守，乃開門縱州人使出，自以殘兵數百守城，以示必死。",
      "claim": "开局前同州守御与生平；年龄未得享年，只据登第年代估。",
      "confidence": "H"
    },
    {
      "id": "ss-tang-civil",
      "title": "《宋史》卷447·唐重传",
      "url": "https://zh.wikisource.org/wiki/宋史/卷447",
      "file": "sources/shaosong-governors/ss-tang-civil.txt",
      "quote": "重曰：「如此，則子得以告父，弟得以告兄，奴婢得以告主矣，豈初政所宜？」即與御史抗論，乃止。",
      "claim": "反对告匿金银一事为开局前仁、义评定依据。",
      "confidence": "H"
    },
    {
      "id": "ss-zhao-scholar",
      "title": "赵明诚《金石录序》",
      "url": "https://zh.wikisource.org/wiki/文章辨體彚選_(四庫全書本)/全覽11",
      "file": "sources/shaosong-governors/ss-zhao-scholar.txt",
      "quote": "余自少小喜從當世學士大夫訪問前代金石刻詞以為異聞後得歐陽文忠公集古録讀而賢之以為是正譌謬有功於後學甚大",
      "claim": "据金石考订学问调智，不拿文学研究当军事本领。",
      "confidence": "H"
    },
    {
      "id": "ss-zhao-age",
      "title": "李清照《金石录后序》（年龄条）",
      "url": "https://zh.wikisource.org/wiki/金石錄_(四庫全書本)/後序",
      "file": "sources/shaosong-governors/ss-zhao-age.txt",
      "quote": "侯年二十一，在太學作學生。",
      "claim": "系建中靖国辛巳（1101）成婚，虚岁倒推1081，开局约46；书名下的后序版本另存引文。",
      "confidence": "M"
    },
    {
      "id": "ss-zhaozhe",
      "title": "《建炎以来系年要录》卷5",
      "url": "https://zh.wikisource.org/wiki/建炎以來繫年要錄/卷005",
      "file": "sources/shaosong-governors/raw/yaolu-005.txt",
      "quote": "武功大夫趙哲，領達州剌史副之。",
      "claim": "五月以达州刺史为通问副使，不是环庆经略。",
      "confidence": "H"
    }
  ],
  "peopleNotes": [
    {
      "name": "孙竢",
      "bioBasis": "ss-sunsi",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "只知任命和前职，未得可单项增减的行迹；同部文官中位数，L。",
      "deltas": {},
      "wuchangDeltas": {},
      "sources": [
        "ss-sunsi"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "曾孝序",
      "bioBasis": "ss-zeng-stay、ss-zeng-office",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "只知任命和前职，未得可单项增减的行迹；同部文官中位数，L。",
      "deltas": {},
      "wuchangDeltas": {},
      "sources": [
        "ss-zeng-stay",
        "ss-zeng-office"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "孙昭远",
      "bioBasis": "ss-sunzhao、ss-sunzhao-jingxi",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "同部文官中位数加减 {\"military\":10,\"loyalty\":5}；五常加减 {\"义\":5}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "military": 10,
        "loyalty": 5
      },
      "wuchangDeltas": {
        "义": 5
      },
      "sources": [
        "ss-sunzhao",
        "ss-sunzhao-jingxi"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "唐重",
      "bioBasis": "ss-tangzhong、ss-tang-bio、ss-tang-civil",
      "ageBasis": "大观三年（1109）登第，按二十二虚岁推，开局约39；不填 birthYear。",
      "statsBasis": "同部文官中位数加减 {\"administration\":10,\"military\":10,\"benevolence\":10}；五常加减 {\"仁\":10,\"义\":5}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "administration": 10,
        "military": 10,
        "benevolence": 10
      },
      "wuchangDeltas": {
        "仁": 10,
        "义": 5
      },
      "sources": [
        "ss-tangzhong",
        "ss-tang-bio",
        "ss-tang-civil"
      ],
      "portraitAge": "年龄未详；游戏年龄 39（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "眉州彭山",
      "appearance": "无"
    },
    {
      "name": "赵明诚",
      "bioBasis": "ss-zhaoming、ss-zhao-arrive、ss-zhao-scholar、ss-zhao-age",
      "ageBasis": "后序1101年二十一虚岁倒推1081，开局约46，M。",
      "statsBasis": "同部文官中位数加减 {\"intelligence\":10}；五常加减 {\"智\":10}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "intelligence": 10
      },
      "wuchangDeltas": {
        "智": 10
      },
      "sources": [
        "ss-zhaoming",
        "ss-zhao-arrive",
        "ss-zhao-scholar",
        "ss-zhao-age"
      ],
      "portraitAge": "约 46 岁",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "密州诸城",
      "appearance": "无"
    },
    {
      "name": "姚鹏",
      "bioBasis": "ss-yaopeng",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "只知任命和前职，未得可单项增减的行迹；同部文官中位数，L。",
      "deltas": {},
      "wuchangDeltas": {},
      "sources": [
        "ss-yaopeng"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "唐悫",
      "bioBasis": "ss-tangque、ss-tangque-aid",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "同部文官中位数加减 {\"military\":5}；五常加减 {}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "military": 5
      },
      "wuchangDeltas": {},
      "sources": [
        "ss-tangque",
        "ss-tangque-aid"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "曾开",
      "bioBasis": "ss-zengkai",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "只知任命和前职，未得可单项增减的行迹；同部文官中位数，L。",
      "deltas": {},
      "wuchangDeltas": {},
      "sources": [
        "ss-zengkai"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "卢法原",
      "bioBasis": "ss-lufayuan",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "同部文官中位数加减 {\"management\":5}；五常加减 {}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "management": 5
      },
      "wuchangDeltas": {},
      "sources": [
        "ss-lufayuan"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "赵点",
      "bioBasis": "ss-west-five、ss-zhaodian-end",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "同部文官中位数加减 {\"military\":-10,\"loyalty\":-10}；五常加减 {\"义\":-10}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "military": -10,
        "loyalty": -10
      },
      "wuchangDeltas": {
        "义": -10
      },
      "sources": [
        "ss-west-five",
        "ss-zhaodian-end"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "席贡",
      "bioBasis": "ss-west-five",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "同部文官中位数加减 {\"military\":-5,\"loyalty\":-10}；五常加减 {\"义\":-10}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "military": -5,
        "loyalty": -10
      },
      "wuchangDeltas": {
        "义": -10
      },
      "sources": [
        "ss-west-five"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "王似",
      "bioBasis": "ss-west-five",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "同部文官中位数加减 {\"military\":5,\"loyalty\":5}；五常加减 {\"义\":5}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "military": 5,
        "loyalty": 5
      },
      "wuchangDeltas": {
        "义": 5
      },
      "sources": [
        "ss-west-five"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    },
    {
      "name": "张深",
      "bioBasis": "ss-zhangshen",
      "ageBasis": "未检得生年享年，依前轮人物规范暂取55岁运行估值，不填 birthYear（L）。",
      "statsBasis": "同部文官中位数加减 {\"military\":5,\"loyalty\":-5}；五常加减 {}。仅取上述开局前行为；卢法原九月修城记录只作能力推定。",
      "deltas": {
        "military": 5,
        "loyalty": -5
      },
      "wuchangDeltas": {},
      "sources": [
        "ss-zhangshen"
      ],
      "portraitAge": "年龄未详；游戏年龄 55（推估）",
      "rank": "寄禄官未详；帅司俸档按原剧本从三品",
      "birthplace": "未详",
      "appearance": "无"
    }
  ],
  "uncertain": [
    "出缺表示本次资料不足而不填姓名，不是断言史实空员。福建江常、广东陈述/陈邦光、广西及川东三路须继续以任官原刻/宋会要逐月细核。",
    "范致虚五月除邓、十二月到官的记载不完全相合；采用受命身份，具体到任日未明。卢法原由九月现任回推八月，王似、席贡由年初任官与后文延续推到八月，均为 M，不冒充八月直接任命。",
    "京东西、江东、江西、淮东淮西等依知州知府兼帅旧制与李纲六月置帅议落实安抚职衔；有些任命正文仅写知州知府，职衔全称仍是制度推定。潼川、夔、利建置有先后，当前空席是数据预留，未证同月可任人。",
    "开局只给八月，无法在同月替代具体日：赵明诚八月到任；张所随着李纲罢相被贬的日界仍应与剧情作者合核。本刀保持开局已有张所。",
    "三泉是直隶县，保留知三泉县官缺；河北宋有分区复用河北招抚使。两浙、河东宋有部分为分镇。",
    "新补人物多数生年、享年未考，依既有框架使用55岁运行估值且不写 birthYear；无史载外貌、性格、内心或志向不编。",
    "官俸沿原剧本帅司35石/月；这是兼容已有游戏经济的俸档，不等于每名宋臣实际寄禄俸。财官不补。原西军旧席俸额未扩展校订。",
    "宋廷顶层和势力树是两份完整副本；西军是独立官制而非完整副本，但六路帅位曾存旧任，也已同步为同一职位数据。其他军职与待设机构不扩展改制。"
  ],
  "officeRemovals": [
    {
      "owner": "player",
      "ref": "诸路监司 (帅·漕·宪·仓)/经略安抚使 (帅司)",
      "sources": [
        "ss-system"
      ],
      "reason": "16 席聚合帅司拆成逐路职位；移除旧空额，避免运行时将零编制兜底成一席。"
    },
    {
      "owner": "fac_xijun",
      "ref": "川陕宣抚处置司 (总节制·建炎元年八月未置)/陕西节制使 (诸路节制·权宜)",
      "sources": [
        "ss-west-five",
        "ss-wangshu"
      ],
      "reason": "西军自有官制也存在提前任官或聚合空额，按宋廷实际六路帅职同步拆解，不把赵哲、曲端或次年王庶留作旧帅。"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/泾原路经略安抚使 (兼节度使)",
      "sources": [
        "ss-west-five",
        "ss-wangshu"
      ],
      "reason": "西军自有官制也存在提前任官或聚合空额，按宋廷实际六路帅职同步拆解，不把赵哲、曲端或次年王庶留作旧帅。"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/熙河·秦凤·鄜延·永兴诸路经略安抚使",
      "sources": [
        "ss-west-five",
        "ss-wangshu"
      ],
      "reason": "西军自有官制也存在提前任官或聚合空额，按宋廷实际六路帅职同步拆解，不把赵哲、曲端或次年王庶留作旧帅。"
    }
  ],
  "officeMirrors": [
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/泾原路经略安抚使",
      "canonicalRef": "诸路帅司/泾原路经略安抚使"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/环庆路经略安抚使",
      "canonicalRef": "诸路帅司/环庆路经略安抚使"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/熙河兰湟路经略安抚使",
      "canonicalRef": "诸路帅司/熙河兰湟路经略安抚使"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/秦凤路经略安抚使",
      "canonicalRef": "诸路帅司/秦凤路经略安抚使"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/鄜延路经略安抚使",
      "canonicalRef": "诸路帅司/鄜延路经略安抚使"
    },
    {
      "owner": "fac_xijun",
      "ref": "陕西六路经略安抚司 (帅司·路军政)/永兴军路经略安抚使",
      "canonicalRef": "诸路帅司/永兴军路经略安抚使"
    }
  ]
};
