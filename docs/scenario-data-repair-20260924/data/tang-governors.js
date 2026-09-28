// 省道主官数据、数值依据与逐条原文；由 patches/governors.js 应用。
'use strict';
module.exports = {
  "sid": "tang",
  "scenario": "晚唐·开成五年（官方）.json",
  "label": "晚唐·开成五年",
  "playerFaction": "唐朝廷",
  "playerCopies": 3,
  "useIds": true,
  "scope": "覆盖唐廷 45 道、河朔昭义四镇与外藩 58 个省道节点；复用既有史实人物，不新造人物。唐廷三份、外藩两份官制逐职位同步。",
  "calibration": null,
  "characters": [],
  "characterUpdates": [
    {
      "name": "陈夷行",
      "set": {
        "title": "镇国军防御使",
        "officialTitle": "镇国军防御使"
      },
      "sources": [
        "tang-e24edbab8a",
        "tang-b299364022"
      ],
      "reason": "使节点显示、职位名与活绑定官称一致；无新增任官。"
    },
    {
      "name": "卢载",
      "set": {
        "title": "同州防御使",
        "officialTitle": "同州防御使"
      },
      "sources": [
        "tang-3af2c8be03",
        "tang-f7c0c771cc"
      ],
      "reason": "使节点显示、职位名与活绑定官称一致；无新增任官。"
    },
    {
      "name": "韦长",
      "set": {
        "title": "平卢淄青节度使",
        "officialTitle": "平卢淄青节度使"
      },
      "sources": [
        "tang-4978805849",
        "tang-ea4b03eb07"
      ],
      "reason": "使节点显示、职位名与活绑定官称一致；无新增任官。"
    },
    {
      "name": "李绅",
      "set": {
        "title": "宣武军节度使",
        "officialTitle": "宣武军节度使"
      },
      "sources": [
        "tang-ca2d917dda",
        "tang-08c1cfc652"
      ],
      "reason": "使节点显示、职位名与活绑定官称一致；无新增任官。"
    },
    {
      "name": "李款",
      "set": {
        "title": "江南西道观察使",
        "officialTitle": "江南西道观察使"
      },
      "sources": [
        "tang-cdb06d347c",
        "tang-7a6548b7bd",
        "tang-f73395cb04",
        "tang-1d4169bf92"
      ],
      "reason": "使节点显示、职位名与活绑定官称一致；无新增任官。"
    },
    {
      "name": "大延广",
      "set": {
        "title": "王子·渤海",
        "officialTitle": "王子·渤海"
      },
      "sources": [],
      "reason": "既有王子身份保持原义，避免“渤海王”前缀误挂王子。"
    }
  ],
  "offices": [
    {
      "owner": "新罗",
      "department": "君长",
      "departmentId": "dept-governor-adcaf8165da9",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-adcaf8165da9",
        "name": "新罗王",
        "rank": "君长",
        "holder": "金庆膺",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "渤海",
      "department": "君长",
      "departmentId": "dept-governor-a3040a232b36",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-a3040a232b36",
        "name": "渤海王",
        "rank": "君长",
        "holder": "大彝震",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "回鹘",
      "department": "君长",
      "departmentId": "dept-governor-be45c9dd6914",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-be45c9dd6914",
        "name": "回鹘可汗",
        "rank": "君长",
        "holder": "㕎馺可汗",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "迦摩缕波",
      "department": "君长",
      "departmentId": "dept-governor-d9f4c25ff878",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-d9f4c25ff878",
        "name": "迦摩缕波王",
        "rank": "君长",
        "holder": "婆那摩罗跋摩",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "南诏",
      "department": "君长",
      "departmentId": "dept-governor-859196a6b1d9",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-859196a6b1d9",
        "name": "南诏王",
        "rank": "君长",
        "holder": "劝丰祐",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "黠戛斯",
      "department": "君长",
      "departmentId": "dept-governor-816598583132",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-816598583132",
        "name": "黠戛斯可汗",
        "rank": "君长",
        "holder": "阿热",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "瞿折罗·波罗底诃罗",
      "department": "君长",
      "departmentId": "dept-governor-2edd3af41daf",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-2edd3af41daf",
        "name": "瞿折罗王",
        "rank": "君长",
        "holder": "弥醯罗·博阇",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "波罗王朝",
      "department": "君长",
      "departmentId": "dept-governor-f643ad59b709",
      "departmentDescription": "本国君长",
      "position": {
        "id": "office-governor-f643ad59b709",
        "name": "波罗王",
        "rank": "君长",
        "holder": "提婆波罗",
        "establishedCount": 1,
        "vacancyCount": 0,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统辖王庭及所属诸地。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "环王",
      "department": "君长",
      "departmentId": "dept-governor-d989b7231f2e",
      "position": {
        "id": "office-governor-d989b7231f2e",
        "name": "环王国王",
        "rank": "君长",
        "holder": "",
        "establishedCount": 1,
        "vacancyCount": 1,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统理本国事务。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "迦湿弥罗",
      "department": "君长",
      "departmentId": "dept-governor-8fa0aee2f5a1",
      "position": {
        "id": "office-governor-8fa0aee2f5a1",
        "name": "迦湿弥罗王",
        "rank": "君长",
        "holder": "",
        "establishedCount": 1,
        "vacancyCount": 1,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统理本国事务。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "泥婆罗",
      "department": "君长",
      "departmentId": "dept-governor-4e219c15faf6",
      "position": {
        "id": "office-governor-4e219c15faf6",
        "name": "泥婆罗王",
        "rank": "君长",
        "holder": "",
        "establishedCount": 1,
        "vacancyCount": 1,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统理本国事务。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "真腊",
      "department": "君长",
      "departmentId": "dept-governor-47ee4380d107",
      "position": {
        "id": "office-governor-47ee4380d107",
        "name": "真腊王",
        "rank": "君长",
        "holder": "",
        "establishedCount": 1,
        "vacancyCount": 1,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统理本国事务。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "骠国",
      "department": "君长",
      "departmentId": "dept-governor-9e829daafa29",
      "position": {
        "id": "office-governor-9e829daafa29",
        "name": "骠国王",
        "rank": "君长",
        "holder": "",
        "establishedCount": 1,
        "vacancyCount": 1,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统理本国事务。",
        "bindingHint": "region",
        "authority": "decision"
      }
    },
    {
      "owner": "湄公河上游诸部",
      "department": "君长",
      "departmentId": "dept-governor-cc1a06db0ba4",
      "position": {
        "id": "office-governor-cc1a06db0ba4",
        "name": "哈里奔猜王",
        "rank": "君长",
        "holder": "",
        "establishedCount": 1,
        "vacancyCount": 1,
        "salary": 0,
        "perPersonSalary": "君长不列臣僚俸给",
        "duties": "统理本国事务。",
        "bindingHint": "region",
        "authority": "decision"
      }
    }
  ],
  "officeUpdates": [
    {
      "owner": "player",
      "ref": "office-fb04643807e2",
      "set": {
        "name": "镇国军防御使"
      },
      "reason": "任官确为华州镇国军防御使；保留稳定职位 id 与原有俸给。"
    }
  ],
  "bindings": [
    {
      "owner": "player",
      "nodeId": "circuit-fcbb6db903e5",
      "name": "京畿",
      "governorOffice": "office-da6256132f6d",
      "holder": "敬昕",
      "status": "连上",
      "sources": [
        "tang-d9ca51f961",
        "tang-504f2b10b5"
      ],
      "reason": "承接已核任官；開成四年九月丙午（839年）以前江西觀察使為京兆尹"
    },
    {
      "owner": "player",
      "nodeId": "circuit-73c65d904e95",
      "name": "华州防御",
      "governorOffice": "office-fb04643807e2",
      "holder": "陈夷行",
      "status": "连上",
      "sources": [
        "tang-e24edbab8a",
        "tang-b299364022"
      ],
      "reason": "承接已核任官；開成四年九月辛丑（839年），由吏部侍郎授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-e00116cb986e",
      "name": "河中",
      "governorOffice": "office-43a6e9e38b0c",
      "holder": "郑肃",
      "status": "连上",
      "sources": [
        "tang-e187f288f1",
        "tang-59b7fefb21"
      ],
      "reason": "承接已核任官；開成四年閏正月甲申朔（839年）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-c3ce2a358e6d",
      "name": "同州防御",
      "governorOffice": "office-905043b2b822",
      "holder": "卢载",
      "status": "连上",
      "sources": [
        "tang-3af2c8be03",
        "tang-f7c0c771cc"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；開成三年到開局日（兩年）沒有查到換人，holder 為推定；維基百科同州條也只列到盧載（838年）（二手）。同州是直屬中央的防禦使州，不屬河中；剧本把同州歸入河中不合。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-6efad25adc25",
      "name": "金商",
      "governorOffice": "office-e58619739d7e",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-5bc753054d",
        "tang-0e63a40aa4"
      ],
      "reason": "开成间任官未考明，保留出缺。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-0e5aec7cd61a",
      "name": "东都",
      "governorOffice": "office-16a7c5873444",
      "holder": "崔琯",
      "status": "连上",
      "sources": [
        "tang-5b45f655ce",
        "tang-6c28cf0c16",
        "tang-a1831b6c32",
        "tang-3a44445320"
      ],
      "reason": "承接已核任官；開成三年十月乙酉朔（838年）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-472ceb5133c8",
      "name": "陕虢",
      "governorOffice": "office-3f29bb5e895b",
      "holder": "姚合",
      "status": "连上",
      "sources": [
        "tang-6a10c3dbe9",
        "tang-0d8774773a",
        "tang-307337d23b",
        "tang-8727d5e1b9"
      ],
      "reason": "承接已核任官；開成四年八月庚戌朔（839年）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-855efb7188a4",
      "name": "河阳",
      "governorOffice": "office-38bc232007ae",
      "holder": "李执方",
      "status": "连上",
      "sources": [
        "tang-1fd86071b9",
        "tang-a1a6afef78",
        "tang-8d74af6a0d",
        "tang-1ad204fa0a"
      ],
      "reason": "承接已核任官；開成二年六月戊申（837年），由左金吾衛將軍授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-9d221cb47716",
      "name": "河东",
      "governorOffice": "office-ae02b4a39062",
      "holder": "狄兼谟",
      "status": "连上",
      "sources": [
        "tang-253374c174",
        "tang-5e27c385ad",
        "tang-ed3b84c7e7",
        "tang-b67eb96684"
      ],
      "reason": "承接已核任官；開成三年十二月（838年，系於辛丑日裴度召還條之後）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-7b56570b0017",
      "name": "振武",
      "governorOffice": "office-c35c84c82ca1",
      "holder": "刘沔",
      "status": "连上",
      "sources": [
        "tang-83910da8d5",
        "tang-00b944e838",
        "tang-371a150e5b"
      ],
      "reason": "承接已核任官；大和九年九月乙亥（835年），自涇原節度使移授"
    },
    {
      "owner": "player",
      "nodeId": "circuit-6a6a3f34f7aa",
      "name": "天德",
      "governorOffice": "office-7a81820776d4",
      "holder": "温德彝",
      "status": "连上",
      "sources": [
        "tang-a1d757279e",
        "tang-18cd5cefab",
        "tang-7f02d980bd"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；溫德彝何時到任不詳。開局日在任的可能是溫德彝，也可能仍是李逵或另有其人。維基百科天德軍條只列李逵（839年）、田牟（841—843年）（二手）。官稱：剧本作「天德軍防禦使」，紀作「天德軍都防禦使」，通鑑作「天德軍使」。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-493d9b5d13f8",
      "name": "灵盐",
      "governorOffice": "office-7f42b112e381",
      "holder": "魏仲卿",
      "status": "连上",
      "sources": [
        "tang-cbc759af87",
        "tang-151d7f8692"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；魏仲卿是開成元年到會昌初唯一查到的任命，此後四年沒有替換記錄，也沒有他開成五年仍在任的直接證據，holder 只是推定。已在維基文庫檢索「靈武節度使 會昌」「朔方靈鹽 開成」「靈武 開成四年」「靈州 開成五年」，均無結果。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-28b4c7d75b79",
      "name": "夏绥银",
      "governorOffice": "office-2be50f4967bc",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-8c1983cbd5",
        "tang-e2ab64f8f1",
        "tang-0e11e29cee",
        "tang-1e827805f8"
      ],
      "reason": "高霞寓同名及生卒冲突未解，保留出缺。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-074bed2f1ea6",
      "name": "鄜坊",
      "governorOffice": "office-d92517c45545",
      "holder": "李昌言",
      "status": "连上",
      "sources": [
        "tang-fd6ea9fe2d",
        "tang-a91f809628"
      ],
      "reason": "承接已核任官；開成四年夏四月壬子朔（839年），由右羽林統軍授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-5ba46e32fccb",
      "name": "邠宁",
      "governorOffice": "office-70ecbe889eea",
      "holder": "苻澈",
      "status": "连上",
      "sources": [
        "tang-51b69c10fb",
        "tang-cc9b1d6db4",
        "tang-6507f6e210"
      ],
      "reason": "承接已核任官；開成四年六月辛亥朔（839年），由長武城使授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-8cd0350528f2",
      "name": "泾原",
      "governorOffice": "office-db523e56995f",
      "holder": "王茂元",
      "status": "连上",
      "sources": [
        "tang-9a15e5c55b",
        "tang-699965f190"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；大和九年到會昌初沒有查到涇原換人的記錄，所以推定開局日仍是王茂元。但他召為將作監的時間不詳，也可能開局前已經離任。已檢索「涇原節度使 開成四年」「王茂元 開成」「王茂元 將作監」。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-0145a6fa4671",
      "name": "凤翔",
      "governorOffice": "office-b24b8d2ba45c",
      "holder": "陈君奕",
      "status": "连上",
      "sources": [
        "tang-445b4ef2b7",
        "tang-a6d63b5ec8"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；紀文「左神刺大將軍」即「左神策大將軍」。開成元年九月以後到開局日沒有他仍在任的直接證據，也沒有換人記錄，holder 為推定。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-109f413f0a02",
      "name": "义武",
      "governorOffice": "office-a2acfaf512a4",
      "holder": "韩威",
      "status": "连上",
      "sources": [
        "tang-0650b83aa2",
        "tang-ac76b8c62f",
        "tang-4fb908557b"
      ],
      "reason": "承接已核任官；開成三年十一月壬申（838年），由蔡州刺史授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-ec9d22a78a77",
      "name": "义昌",
      "governorOffice": "office-6d39d2d76cfd",
      "holder": "刘约",
      "status": "连上",
      "sources": [
        "tang-e85bf713aa",
        "tang-38a8ddeba2"
      ],
      "reason": "承接已核任官；開成三年十一月壬戌（838年），由德州刺史、滄景節度副使升任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-e38a346e2c14",
      "name": "平卢",
      "governorOffice": "office-7e77a80b9ac1",
      "holder": "韦长",
      "status": "连上",
      "sources": [
        "tang-4978805849",
        "tang-ea4b03eb07"
      ],
      "reason": "承接已核任官；開成四年七月壬寅（839年），由河南尹授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-a25f7afbdeab",
      "name": "天平",
      "governorOffice": "office-b02b0d8a6917",
      "holder": "李彦佐",
      "status": "连上",
      "sources": [
        "tang-839f2d1642",
        "tang-a6d5ff95ce",
        "tang-251da56879",
        "tang-e98e1bbc01"
      ],
      "reason": "承接已核任官；開成三年十一月壬戌（838年），自滄州（義昌）移鎮"
    },
    {
      "owner": "player",
      "nodeId": "circuit-6e4f1fe8c634",
      "name": "兖海",
      "governorOffice": "office-312e8d380f4a",
      "holder": "张贾",
      "status": "连上",
      "sources": [
        "tang-c3ccab6e6a",
        "tang-37729777d1",
        "tang-c0e4da1fbc"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；張賈841年已回朝任鴻臚卿，他何時離開兗海不詳，開局日是否仍在任無直接證據。另，《舊唐書·文宗紀》大和四年有「兵部尚書致仕張賈卒」，那是另一個同名之人。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-717c4305c5af",
      "name": "宣武",
      "governorOffice": "office-29d1f8b5927f",
      "holder": "李绅",
      "status": "连上",
      "sources": [
        "tang-ca2d917dda",
        "tang-08c1cfc652"
      ],
      "reason": "承接已核任官；開成元年六月（836年），由河南尹授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-1e3461fb47fe",
      "name": "义成",
      "governorOffice": "office-7688d10ac1c5",
      "holder": "裴弘泰",
      "status": "连上",
      "sources": [
        "tang-5e3ee11105",
        "tang-c2843c3754"
      ],
      "reason": "承接已核任官；開成元年四月癸酉（836年），由亳州刺史授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-b3383286d154",
      "name": "忠武",
      "governorOffice": "office-c64794204605",
      "holder": "王彦威",
      "status": "连上",
      "sources": [
        "tang-0c694c66c8",
        "tang-76942426b6"
      ],
      "reason": "承接已核任官；開成三年七月甲子（838年），由衛尉卿授任，代殷侑"
    },
    {
      "owner": "player",
      "nodeId": "circuit-404bcc73e13c",
      "name": "武宁",
      "governorOffice": "office-2647666b6682",
      "holder": "薛元赏",
      "status": "连上",
      "sources": [
        "tang-7dfe5d2dd0",
        "tang-78832734c7"
      ],
      "reason": "承接已核任官；開成元年十二月丙申朔（836年），由京兆尹授任"
    },
    {
      "owner": "player",
      "nodeId": "circuit-214f2de00ef9",
      "name": "淮南",
      "governorOffice": "office-7773d3bfb4a2",
      "holder": "李德裕",
      "status": "连上",
      "sources": [
        "tang-566612fdfc",
        "tang-4b479fd56d",
        "tang-a025fe9106",
        "tang-7657e507a7",
        "tang-c98785fe25"
      ],
      "reason": "承接已核任官；開成二年五月丙寅（837）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-050164ec911f",
      "name": "鄂岳",
      "governorOffice": "office-2ce2cbd1b5fe",
      "holder": "高锴",
      "status": "连上",
      "sources": [
        "tang-f7fa3919b0",
        "tang-d5fdd7eb1a",
        "tang-a7fc896a9d",
        "tang-9ef77d2309",
        "tang-4c4fe7dc22",
        "tang-ec74f20203",
        "tang-19efdcfb1e"
      ],
      "reason": "承接已核任官；開成三年五月癸未（838；本傳作「其年九月」）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-97031fea1260",
      "name": "浙西",
      "governorOffice": "office-8acf63f0e028",
      "holder": "卢商",
      "status": "连上",
      "sources": [
        "tang-55bba02c9c",
        "tang-5b8b692e38",
        "tang-1fa0e49988"
      ],
      "reason": "承接已核任官；開成二年五月辛未（837）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-ee17dba1d328",
      "name": "浙东",
      "governorOffice": "office-64a2e2cd4b76",
      "holder": "萧俶",
      "status": "连上",
      "sources": [
        "tang-ccb8582d9e",
        "tang-a1570e8107"
      ],
      "reason": "承接已核任官；開成四年三月（839）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-d927658a70b9",
      "name": "宣歙",
      "governorOffice": "office-488d85dffd2b",
      "holder": "崔龟从",
      "status": "连上",
      "sources": [
        "tang-cf2297c0b1",
        "tang-1f9c0d53be",
        "tang-bdd8b765d6"
      ],
      "reason": "承接已核任官；開成四年三月除（839），同年五月到郡"
    },
    {
      "owner": "player",
      "nodeId": "circuit-7b14a21bfa3f",
      "name": "福建",
      "governorOffice": "office-a247fc0015e1",
      "holder": "卢贞",
      "status": "连上",
      "sources": [
        "tang-b75c384bec",
        "tang-da1bb7f871"
      ],
      "reason": "承接已核任官；開成四年閏正月丙午（839）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-0882a98a00d2",
      "name": "江西",
      "governorOffice": "office-86e149f4c791",
      "holder": "李款",
      "status": "连上",
      "sources": [
        "tang-cdb06d347c",
        "tang-7a6548b7bd",
        "tang-f73395cb04",
        "tang-1d4169bf92"
      ],
      "reason": "承接已核任官；開成四年九月辛丑（839）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-08f480473cbd",
      "name": "湖南",
      "governorOffice": "office-ed39564175f9",
      "holder": "李翊",
      "status": "连上",
      "sources": [
        "tang-10c095f741",
        "tang-dcc738fd8f"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；開成二年六月至開成五年八月之間，未查到其他人除湖南的記載（查過舊唐書文宗紀、武宗紀、通鑑卷245–246、維基文庫全文檢索「湖南觀察使」「李翊」）。因此只能推定李翊仍在任，但他已在任約三年，中間可能有未載的更替。李翊無傳。中文維基湖南觀察使表亦只列「李翊（837年）」，之後直接接楊嗣復（840年）。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-f14dccddb8d4",
      "name": "荆南",
      "governorOffice": "office-17d0097a408e",
      "holder": "李石",
      "status": "连上",
      "sources": [
        "tang-25efa1dc65",
        "tang-0549decf48",
        "tang-971b50b9e4"
      ],
      "reason": "承接已核任官；開成三年正月丙子（838）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-1bf9f95c2b9f",
      "name": "山南东道",
      "governorOffice": "office-b6013ac20556",
      "holder": "牛僧孺",
      "status": "连上",
      "sources": [
        "tang-321b19f454",
        "tang-8d3e935bbd",
        "tang-a41a67dd38"
      ],
      "reason": "承接已核任官；開成四年八月癸亥（839）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-9920e4240b5c",
      "name": "山南西道",
      "governorOffice": "office-030ae206ece6",
      "holder": "归融",
      "status": "连上",
      "sources": [
        "tang-585fa6ef73",
        "tang-fc940db4cf",
        "tang-3b939cfe94",
        "tang-56f10b520c"
      ],
      "reason": "承接已核任官；開成四年二月（839；紀文日干「辛酉」與「癸酉朔」不合）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-e9c11698735b",
      "name": "剑南西川",
      "governorOffice": "office-bd83625f1519",
      "holder": "李固言",
      "status": "连上",
      "sources": [
        "tang-e902cc01a2",
        "tang-ac678e322d",
        "tang-09f45159ff",
        "tang-b366e886a9"
      ],
      "reason": "承接已核任官；開成二年十月戊申（837）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-89e9df1066fe",
      "name": "剑南东川",
      "governorOffice": "office-fe60552637ce",
      "holder": "郑复",
      "status": "连上",
      "sources": [
        "tang-1957cb9f8e",
        "tang-212ba2b656",
        "tang-f9e5ea2caf",
        "tang-c8b8822c28"
      ],
      "reason": "承接已核任官；開成四年九月甲辰（839）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-a8a3f460b7fa",
      "name": "黔中",
      "governorOffice": "office-c7364542b2cb",
      "holder": "张沼",
      "status": "连上",
      "sources": [
        "tang-d477375ba8",
        "tang-f381a67500",
        "tang-b5c5851600"
      ],
      "reason": "承接已核任官；開成三年十月己丑（838）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-53b2ca5109e8",
      "name": "岭南",
      "governorOffice": "office-338249c6ae25",
      "holder": "卢钧",
      "status": "连上",
      "sources": [
        "tang-596f9ceacb",
        "tang-0b022779da",
        "tang-1a6cb948c0",
        "tang-964136279e"
      ],
      "reason": "承接已核任官；開成元年十二月庚戌（836）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-adc7157939ae",
      "name": "桂管",
      "governorOffice": "office-8b238422b503",
      "holder": "冯审",
      "status": "连上",
      "sources": [
        "tang-5bda51c9af",
        "tang-28874d090e",
        "tang-42f4735a02",
        "tang-6f5d0acb3a",
        "tang-f46040fb27"
      ],
      "reason": "承接已核任官；開成四年九月辛丑（839）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-a539c36cd2c3",
      "name": "容管",
      "governorOffice": "office-a08d26ef9a17",
      "holder": "胡沐",
      "status": "连上",
      "sources": [
        "tang-f4583dd5f7",
        "tang-4513b37505"
      ],
      "reason": "沿用前轮推定在任，尚未补得更紧贴开局的任免；太和九年以後未查到容管的除授記載（查過文宗紀、武宗紀、通鑑、維基文庫檢索「胡沐」「容管經略使」）。開局日胡沐是否仍在任只是推定，他已在任四年多，中間可能有未載的更替。二手：中文維基「容管经略使」列胡沐（835–840）。"
    },
    {
      "owner": "player",
      "nodeId": "circuit-b0922201b667",
      "name": "邕管",
      "governorOffice": "office-a33659c04d3e",
      "holder": "唐弘实",
      "status": "连上",
      "sources": [
        "tang-819c4ddb1c",
        "tang-68f0a6e3e2"
      ],
      "reason": "承接已核任官；開成三年十一月癸亥（838）"
    },
    {
      "owner": "player",
      "nodeId": "circuit-97a50d999831",
      "name": "安南",
      "governorOffice": "office-9d034387b065",
      "holder": "马植",
      "status": "连上",
      "sources": [
        "tang-70e40b130c",
        "tang-26e9c36f87",
        "tang-65e5d3ff91"
      ],
      "reason": "承接已核任官；開成元年九月庚辰（836）"
    },
    {
      "owner": "唐·魏博镇",
      "nodeId": "circuit-9f81793098fe",
      "name": "魏博",
      "governorOffice": "office-4fbc37fa0e19",
      "holder": "何进滔",
      "status": "连上",
      "sources": [
        "tang-407875fcdc",
        "tang-b1217dd0ac"
      ],
      "reason": "承接已核任官；大和三年（829年），軍中推立，朝廷授任"
    },
    {
      "owner": "唐·成德镇",
      "nodeId": "circuit-e44653cad28d",
      "name": "成德",
      "governorOffice": "office-8dcc116fbe63",
      "holder": "王元逵",
      "status": "连上",
      "sources": [
        "tang-a67874301c",
        "tang-84339632df"
      ],
      "reason": "承接已核任官；大和八年（834年）父王廷湊卒後由三軍推立（本傳）"
    },
    {
      "owner": "唐·卢龙镇",
      "nodeId": "circuit-c9098c852df5",
      "name": "卢龙",
      "governorOffice": "office-e6522913b731",
      "holder": "史元忠",
      "status": "连上",
      "sources": [
        "tang-17fa78ffc8",
        "tang-bfacfbd30c"
      ],
      "reason": "承接已核任官；大和八年（834年）逐楊志誠後任留後，次年正授副大使、知節度事"
    },
    {
      "owner": "唐·昭义镇",
      "nodeId": "circuit-a6bc21892703",
      "name": "昭义",
      "governorOffice": "office-7f0aa80414b6",
      "holder": "刘从谏",
      "status": "连上",
      "sources": [
        "tang-a956cb6141"
      ],
      "reason": "承接已核任官；寶曆元年（825年）父劉悟卒後繼任留後，次年正授"
    },
    {
      "owner": "海南诸峒",
      "nodeId": "circuit-bbbd6820e2db",
      "name": "琼崖山洞",
      "governorOffice": null,
      "governanceNote": "羁縻",
      "governanceDetail": "本地首领分治，册封朝贡关系不等于流官直接统辖；未考得全组统一任官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-dd1eda53a1",
        "tang-fee27f5b8c",
        "tang-10cb300a3d"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-0",
      "name": "畿内",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-1",
      "name": "东海道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-2",
      "name": "东山道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-3",
      "name": "北陆道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-4",
      "name": "山阴道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-5",
      "name": "山阳道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-6",
      "name": "南海道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "日本",
      "nodeId": "v19-jp-circuit-7",
      "name": "西海道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "五畿七道是令制国分组，各国有国司；未以一名中央大臣兼作全道长官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f502d68433",
        "tang-47e077dac4",
        "tang-a6b767ccbd",
        "tang-570ddbde66",
        "tang-3344c7e850",
        "tang-44add69ad1",
        "tang-26f8df5cf9",
        "tang-1414150bbb",
        "tang-646800bfb3",
        "tang-4c88c5bbbb",
        "tang-15a3471fcf",
        "tang-6c7228ebfe",
        "tang-02b8f3b79a",
        "tang-523dc20c7f",
        "tang-df79b6bfe0"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "耽罗",
      "nodeId": "c10-tamna",
      "name": "耽罗",
      "governorOffice": null,
      "governanceNote": "羁縻",
      "governanceDetail": "本地首领分治，册封朝贡关系不等于流官直接统辖；未考得全组统一任官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f52ba62ebb",
        "tang-7f9068f1ca",
        "tang-f52ba62ebb"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "蝦夷",
      "nodeId": "c10-north-honshu",
      "name": "蝦夷诸村",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-72d4e3aadb",
        "tang-1c7beaf980",
        "tang-72d4e3aadb",
        "tang-7dfbea604a",
        "tang-8a342d8f4e",
        "tang-e4d048da3b",
        "tang-1c7beaf980",
        "tang-72d4e3aadb",
        "tang-72d4e3aadb",
        "tang-523dc20c7f"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "渡嶋蝦夷",
      "nodeId": "c10-hokkaido",
      "name": "渡嶋",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-a39c333306",
        "tang-f4d1353bc0",
        "tang-a39c333306"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "台湾诸部",
      "nodeId": "c10-taiwan",
      "name": "台湾",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "吕宋诸部",
      "nodeId": "c10-luzon",
      "name": "吕宋北部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-e5389d6648",
        "tang-49e244ff49"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "吕宋诸部",
      "nodeId": "c13-5067d75a92",
      "name": "吕宋中南部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-e5389d6648",
        "tang-49e244ff49"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "新罗",
      "nodeId": "c10-silla",
      "name": "王京与九州",
      "governorOffice": "office-governor-adcaf8165da9",
      "holder": "金庆膺",
      "status": "新补",
      "sources": [
        "tang-fce2a6ecbe",
        "tang-5ca7c74400",
        "tang-8131388ea6",
        "tang-b496f02ff9",
        "tang-8131388ea6",
        "tang-a90cb63b5b",
        "tang-d235bf2a6e",
        "tang-b496f02ff9",
        "tang-088f54a460",
        "tang-c9ec418726",
        "tang-45105f2ec9",
        "tang-24566c2a89",
        "tang-2de2b390b4"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    },
    {
      "owner": "渤海",
      "nodeId": "c10-balhae",
      "name": "五京诸府",
      "governorOffice": "office-governor-a3040a232b36",
      "holder": "大彝震",
      "status": "新补",
      "sources": [
        "tang-2c1e587837",
        "tang-d464867796",
        "tang-7f7ac7c2fa",
        "tang-12d4f2ff3d",
        "tang-f68296e20b",
        "tang-f7e93cfbd5",
        "tang-3482e3b9b0",
        "tang-1f642bf69f",
        "tang-c447a31c86",
        "tang-5d7353ce7d",
        "tang-8abb70cf5d",
        "tang-f8176a3298",
        "tang-c9b87597ef",
        "tang-df7ebe26c9"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    },
    {
      "owner": "黑水靺鞨诸部",
      "nodeId": "c10-heishui",
      "name": "黑水十六落",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-061998b629",
        "tang-0c75e93b27",
        "tang-6333e56a0d",
        "tang-10b710d89c",
        "tang-80034f6604",
        "tang-061998b629",
        "tang-c14fe59077",
        "tang-061998b629",
        "tang-20b672efb1",
        "tang-914db0c885",
        "tang-20b672efb1",
        "tang-c14fe59077",
        "tang-c14fe59077",
        "tang-061998b629"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "黑水靺鞨诸部",
      "nodeId": "c13-d1bfa9a0ab",
      "name": "黑水以北诸部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-061998b629",
        "tang-0c75e93b27",
        "tang-6333e56a0d",
        "tang-10b710d89c",
        "tang-80034f6604",
        "tang-061998b629",
        "tang-c14fe59077",
        "tang-061998b629",
        "tang-20b672efb1",
        "tang-914db0c885",
        "tang-20b672efb1",
        "tang-c14fe59077",
        "tang-c14fe59077",
        "tang-061998b629"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "室韦诸部",
      "nodeId": "c10-shiwei",
      "name": "室韦诸部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-2bea18dd8b",
        "tang-4781c5a984",
        "tang-5d7353ce7d",
        "tang-f17e6f59e8",
        "tang-9652a52c4b",
        "tang-a32bca192f",
        "tang-20b672efb1",
        "tang-a32bca192f",
        "tang-a32bca192f",
        "tang-a32bca192f",
        "tang-a32bca192f",
        "tang-20b672efb1",
        "tang-a32bca192f",
        "tang-2bea18dd8b"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "室韦诸部",
      "nodeId": "c13-f63ccb4078",
      "name": "室建河诸部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-2bea18dd8b",
        "tang-4781c5a984",
        "tang-5d7353ce7d",
        "tang-f17e6f59e8",
        "tang-9652a52c4b",
        "tang-a32bca192f",
        "tang-20b672efb1",
        "tang-a32bca192f",
        "tang-a32bca192f",
        "tang-a32bca192f",
        "tang-a32bca192f",
        "tang-20b672efb1",
        "tang-a32bca192f",
        "tang-2bea18dd8b"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "奚诸部",
      "nodeId": "c10-xi",
      "name": "饶乐五部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-d7877a4d8d",
        "tang-5d7353ce7d",
        "tang-951343616c",
        "tang-fa6fcdf48c",
        "tang-728645753f",
        "tang-728645753f",
        "tang-d7877a4d8d",
        "tang-7311a4d641",
        "tang-cbd2ac2e05",
        "tang-c4e92953f3"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "契丹诸部",
      "nodeId": "c10-khitan",
      "name": "松漠八部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-b815f177ac",
        "tang-c1ed55b70e",
        "tang-e43c5f40df",
        "tang-9979ea9b63",
        "tang-ca80b64054",
        "tang-030c1bdebe",
        "tang-2a7c7c6666",
        "tang-5d7353ce7d",
        "tang-89b5476516",
        "tang-89b5476516",
        "tang-175a0b608b",
        "tang-48431c34a4",
        "tang-4ebffaa8f0",
        "tang-2d8d588381",
        "tang-e80776e604",
        "tang-2d8d588381"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "吐蕃",
      "nodeId": "v19-tibet-geography-0",
      "name": "伍如与约如",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-d39ec04fa7",
        "tang-9f43ed6756",
        "tang-da1bf17419",
        "tang-4ea65412f8",
        "tang-4771c5b70c",
        "tang-799acd0e3a",
        "tang-514ed32130",
        "tang-024c34f1c8",
        "tang-d39ec04fa7",
        "tang-7d52425e34",
        "tang-6294083da8",
        "tang-ee461636b4",
        "tang-10fe03e1a3",
        "tang-d397539b04",
        "tang-2453f84ec8",
        "tang-3b0135a799",
        "tang-75baf88a39",
        "tang-8f63c7ebb4",
        "tang-ae6a18d0df",
        "tang-043a01e397",
        "tang-75baf88a39",
        "tang-b9b8350ad0",
        "tang-1e125f0f27",
        "tang-c1fb6078a7",
        "tang-ba2cd8074b",
        "tang-d675022bd4",
        "tang-b8a8dc58bb",
        "tang-4bb426efad",
        "tang-dbea707f8d",
        "tang-ab69bcaddc",
        "tang-1a9dfb4c51",
        "tang-2d4bf11cd7",
        "tang-eaeeec9547",
        "tang-7ea2760bbf",
        "tang-f56affef1a",
        "tang-e8b403a3a7",
        "tang-796be55b4f",
        "tang-f0331a2282",
        "tang-408b66ef88",
        "tang-ad676cd7c1",
        "tang-7b3e3b441e",
        "tang-8279c23c36",
        "tang-a77bb620cb",
        "tang-a1911a3809",
        "tang-658812a15e",
        "tang-d3a561b28a",
        "tang-0a4402ad7d",
        "tang-91e41b954b",
        "tang-d983f2bec6",
        "tang-d75f3ecf37",
        "tang-d487bb9004",
        "tang-85ad24c658",
        "tang-0e063cbafd"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "吐蕃",
      "nodeId": "v19-tibet-geography-1",
      "name": "叶如、如拉与羊同",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-d39ec04fa7",
        "tang-9f43ed6756",
        "tang-da1bf17419",
        "tang-4ea65412f8",
        "tang-4771c5b70c",
        "tang-799acd0e3a",
        "tang-514ed32130",
        "tang-024c34f1c8",
        "tang-d39ec04fa7",
        "tang-7d52425e34",
        "tang-6294083da8",
        "tang-ee461636b4",
        "tang-10fe03e1a3",
        "tang-d397539b04",
        "tang-2453f84ec8",
        "tang-3b0135a799",
        "tang-75baf88a39",
        "tang-8f63c7ebb4",
        "tang-ae6a18d0df",
        "tang-043a01e397",
        "tang-75baf88a39",
        "tang-b9b8350ad0",
        "tang-1e125f0f27",
        "tang-c1fb6078a7",
        "tang-ba2cd8074b",
        "tang-d675022bd4",
        "tang-b8a8dc58bb",
        "tang-4bb426efad",
        "tang-dbea707f8d",
        "tang-ab69bcaddc",
        "tang-1a9dfb4c51",
        "tang-2d4bf11cd7",
        "tang-eaeeec9547",
        "tang-7ea2760bbf",
        "tang-f56affef1a",
        "tang-e8b403a3a7",
        "tang-796be55b4f",
        "tang-f0331a2282",
        "tang-408b66ef88",
        "tang-ad676cd7c1",
        "tang-7b3e3b441e",
        "tang-8279c23c36",
        "tang-a77bb620cb",
        "tang-a1911a3809",
        "tang-658812a15e",
        "tang-d3a561b28a",
        "tang-0a4402ad7d",
        "tang-91e41b954b",
        "tang-d983f2bec6",
        "tang-d75f3ecf37",
        "tang-d487bb9004",
        "tang-85ad24c658",
        "tang-0e063cbafd"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "吐蕃",
      "nodeId": "v19-tibet-geography-2",
      "name": "孙波如、南如与青海",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-d39ec04fa7",
        "tang-9f43ed6756",
        "tang-da1bf17419",
        "tang-4ea65412f8",
        "tang-4771c5b70c",
        "tang-799acd0e3a",
        "tang-514ed32130",
        "tang-024c34f1c8",
        "tang-d39ec04fa7",
        "tang-7d52425e34",
        "tang-6294083da8",
        "tang-ee461636b4",
        "tang-10fe03e1a3",
        "tang-d397539b04",
        "tang-2453f84ec8",
        "tang-3b0135a799",
        "tang-75baf88a39",
        "tang-8f63c7ebb4",
        "tang-ae6a18d0df",
        "tang-043a01e397",
        "tang-75baf88a39",
        "tang-b9b8350ad0",
        "tang-1e125f0f27",
        "tang-c1fb6078a7",
        "tang-ba2cd8074b",
        "tang-d675022bd4",
        "tang-b8a8dc58bb",
        "tang-4bb426efad",
        "tang-dbea707f8d",
        "tang-ab69bcaddc",
        "tang-1a9dfb4c51",
        "tang-2d4bf11cd7",
        "tang-eaeeec9547",
        "tang-7ea2760bbf",
        "tang-f56affef1a",
        "tang-e8b403a3a7",
        "tang-796be55b4f",
        "tang-f0331a2282",
        "tang-408b66ef88",
        "tang-ad676cd7c1",
        "tang-7b3e3b441e",
        "tang-8279c23c36",
        "tang-a77bb620cb",
        "tang-a1911a3809",
        "tang-658812a15e",
        "tang-d3a561b28a",
        "tang-0a4402ad7d",
        "tang-91e41b954b",
        "tang-d983f2bec6",
        "tang-d75f3ecf37",
        "tang-d487bb9004",
        "tang-85ad24c658",
        "tang-0e063cbafd"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "吐蕃",
      "nodeId": "v19-tibet-geography-3",
      "name": "东道节度",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-d39ec04fa7",
        "tang-9f43ed6756",
        "tang-da1bf17419",
        "tang-4ea65412f8",
        "tang-4771c5b70c",
        "tang-799acd0e3a",
        "tang-514ed32130",
        "tang-024c34f1c8",
        "tang-d39ec04fa7",
        "tang-7d52425e34",
        "tang-6294083da8",
        "tang-ee461636b4",
        "tang-10fe03e1a3",
        "tang-d397539b04",
        "tang-2453f84ec8",
        "tang-3b0135a799",
        "tang-75baf88a39",
        "tang-8f63c7ebb4",
        "tang-ae6a18d0df",
        "tang-043a01e397",
        "tang-75baf88a39",
        "tang-b9b8350ad0",
        "tang-1e125f0f27",
        "tang-c1fb6078a7",
        "tang-ba2cd8074b",
        "tang-d675022bd4",
        "tang-b8a8dc58bb",
        "tang-4bb426efad",
        "tang-dbea707f8d",
        "tang-ab69bcaddc",
        "tang-1a9dfb4c51",
        "tang-2d4bf11cd7",
        "tang-eaeeec9547",
        "tang-7ea2760bbf",
        "tang-f56affef1a",
        "tang-e8b403a3a7",
        "tang-796be55b4f",
        "tang-f0331a2282",
        "tang-408b66ef88",
        "tang-ad676cd7c1",
        "tang-7b3e3b441e",
        "tang-8279c23c36",
        "tang-a77bb620cb",
        "tang-a1911a3809",
        "tang-658812a15e",
        "tang-d3a561b28a",
        "tang-0a4402ad7d",
        "tang-91e41b954b",
        "tang-d983f2bec6",
        "tang-d75f3ecf37",
        "tang-d487bb9004",
        "tang-85ad24c658",
        "tang-0e063cbafd"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "吐蕃",
      "nodeId": "v19-tibet-geography-4",
      "name": "河西与西域南道",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-d39ec04fa7",
        "tang-9f43ed6756",
        "tang-da1bf17419",
        "tang-4ea65412f8",
        "tang-4771c5b70c",
        "tang-799acd0e3a",
        "tang-514ed32130",
        "tang-024c34f1c8",
        "tang-d39ec04fa7",
        "tang-7d52425e34",
        "tang-6294083da8",
        "tang-ee461636b4",
        "tang-10fe03e1a3",
        "tang-d397539b04",
        "tang-2453f84ec8",
        "tang-3b0135a799",
        "tang-75baf88a39",
        "tang-8f63c7ebb4",
        "tang-ae6a18d0df",
        "tang-043a01e397",
        "tang-75baf88a39",
        "tang-b9b8350ad0",
        "tang-1e125f0f27",
        "tang-c1fb6078a7",
        "tang-ba2cd8074b",
        "tang-d675022bd4",
        "tang-b8a8dc58bb",
        "tang-4bb426efad",
        "tang-dbea707f8d",
        "tang-ab69bcaddc",
        "tang-1a9dfb4c51",
        "tang-2d4bf11cd7",
        "tang-eaeeec9547",
        "tang-7ea2760bbf",
        "tang-f56affef1a",
        "tang-e8b403a3a7",
        "tang-796be55b4f",
        "tang-f0331a2282",
        "tang-408b66ef88",
        "tang-ad676cd7c1",
        "tang-7b3e3b441e",
        "tang-8279c23c36",
        "tang-a77bb620cb",
        "tang-a1911a3809",
        "tang-658812a15e",
        "tang-d3a561b28a",
        "tang-0a4402ad7d",
        "tang-91e41b954b",
        "tang-d983f2bec6",
        "tang-d75f3ecf37",
        "tang-d487bb9004",
        "tang-85ad24c658",
        "tang-0e063cbafd"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "回鹘",
      "nodeId": "c10-uyghur",
      "name": "乌德鞬山",
      "governorOffice": "office-governor-be45c9dd6914",
      "holder": "㕎馺可汗",
      "status": "新补",
      "sources": [
        "tang-e58fe930aa",
        "tang-b975b48984",
        "tang-6c4617136e",
        "tang-08a479f3e6",
        "tang-8ed618b5f5",
        "tang-b92373218e",
        "tang-9ae5374e51",
        "tang-63f29f7420",
        "tang-dca2be1bd0",
        "tang-c62936b088",
        "tang-e93b8de884",
        "tang-820dc5eee5",
        "tang-ef2fdbdca4",
        "tang-6c7f57c176",
        "tang-449079e8c1",
        "tang-6b819caebc",
        "tang-06fd71fc33",
        "tang-5fe95551f8",
        "tang-3c6f22811a",
        "tang-5a0d8095cc",
        "tang-0ef74413e7",
        "tang-39127e2e7e",
        "tang-9ff4accf8d",
        "tang-82ad466ad0",
        "tang-9ff4accf8d",
        "tang-8ba4089d9f",
        "tang-bbd1cf2b2d",
        "tang-ce759ce2fb",
        "tang-13a0875a41",
        "tang-d97bad3327",
        "tang-5a0d8095cc"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    },
    {
      "owner": "回鹘",
      "nodeId": "c13-24e53439db",
      "name": "北庭",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-e58fe930aa",
        "tang-b975b48984",
        "tang-6c4617136e",
        "tang-08a479f3e6",
        "tang-8ed618b5f5",
        "tang-b92373218e",
        "tang-9ae5374e51",
        "tang-63f29f7420",
        "tang-dca2be1bd0",
        "tang-c62936b088",
        "tang-e93b8de884",
        "tang-820dc5eee5",
        "tang-ef2fdbdca4",
        "tang-6c7f57c176",
        "tang-449079e8c1",
        "tang-6b819caebc",
        "tang-06fd71fc33",
        "tang-5fe95551f8",
        "tang-3c6f22811a",
        "tang-5a0d8095cc",
        "tang-0ef74413e7",
        "tang-39127e2e7e",
        "tang-9ff4accf8d",
        "tang-82ad466ad0",
        "tang-9ff4accf8d",
        "tang-8ba4089d9f",
        "tang-bbd1cf2b2d",
        "tang-ce759ce2fb",
        "tang-13a0875a41",
        "tang-d97bad3327",
        "tang-5a0d8095cc"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "回鹘",
      "nodeId": "circuit-968ac52c2b14",
      "name": "金山诸部",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-e58fe930aa",
        "tang-b975b48984",
        "tang-6c4617136e",
        "tang-08a479f3e6",
        "tang-8ed618b5f5",
        "tang-b92373218e",
        "tang-9ae5374e51",
        "tang-63f29f7420",
        "tang-dca2be1bd0",
        "tang-c62936b088",
        "tang-e93b8de884",
        "tang-820dc5eee5",
        "tang-ef2fdbdca4",
        "tang-6c7f57c176",
        "tang-449079e8c1",
        "tang-6b819caebc",
        "tang-06fd71fc33",
        "tang-5fe95551f8",
        "tang-3c6f22811a",
        "tang-5a0d8095cc",
        "tang-0ef74413e7",
        "tang-39127e2e7e",
        "tang-9ff4accf8d",
        "tang-82ad466ad0",
        "tang-9ff4accf8d",
        "tang-8ba4089d9f",
        "tang-bbd1cf2b2d",
        "tang-ce759ce2fb",
        "tang-13a0875a41",
        "tang-d97bad3327",
        "tang-5a0d8095cc"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "回鹘",
      "nodeId": "c13-5672e495d2",
      "name": "仙娥河",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-e58fe930aa",
        "tang-b975b48984",
        "tang-6c4617136e",
        "tang-08a479f3e6",
        "tang-8ed618b5f5",
        "tang-b92373218e",
        "tang-9ae5374e51",
        "tang-63f29f7420",
        "tang-dca2be1bd0",
        "tang-c62936b088",
        "tang-e93b8de884",
        "tang-820dc5eee5",
        "tang-ef2fdbdca4",
        "tang-6c7f57c176",
        "tang-449079e8c1",
        "tang-6b819caebc",
        "tang-06fd71fc33",
        "tang-5fe95551f8",
        "tang-3c6f22811a",
        "tang-5a0d8095cc",
        "tang-0ef74413e7",
        "tang-39127e2e7e",
        "tang-9ff4accf8d",
        "tang-82ad466ad0",
        "tang-9ff4accf8d",
        "tang-8ba4089d9f",
        "tang-bbd1cf2b2d",
        "tang-ce759ce2fb",
        "tang-13a0875a41",
        "tang-d97bad3327",
        "tang-5a0d8095cc"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "迦摩缕波",
      "nodeId": "c10-kamarupa",
      "name": "迦摩缕波",
      "governorOffice": "office-governor-d9f4c25ff878",
      "holder": "婆那摩罗跋摩",
      "status": "新补",
      "sources": [
        "tang-43e827b3fa",
        "tang-cf26bc555c",
        "tang-28777fd588",
        "tang-0707de05a9",
        "tang-43e827b3fa",
        "tang-8f3a1ecdd6"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    },
    {
      "owner": "东喜马拉雅诸部",
      "nodeId": "c10-himalaya-east",
      "name": "东喜马拉雅诸部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-77016801be"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "骠国",
      "nodeId": "c10-pyu",
      "name": "骠国",
      "governorOffice": "office-governor-9e829daafa29",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-2cfa7fd223",
        "tang-75961bb9e6",
        "tang-4c092c7fa9",
        "tang-ed11160304",
        "tang-9aa8ed7c68",
        "tang-e25a38357d",
        "tang-c8fe03176a",
        "tang-f88473fd23",
        "tang-37425f8374",
        "tang-60c25c56cd",
        "tang-74ac5be023",
        "tang-93896a89f9",
        "tang-6e0929617d"
      ],
      "reason": "王国君位存在；本轮无足够一手任期材料落实到人物，保留君位出缺，不称无君主。"
    },
    {
      "owner": "西部山地诸部",
      "nodeId": "c10-arakan",
      "name": "骠国以西山地",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-cf26bc555c",
        "tang-b04bbdbbe3",
        "tang-8aaca146c3"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "下缅甸河谷诸聚落",
      "nodeId": "c10-lower-irrawaddy",
      "name": "弥臣",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-9886819390",
        "tang-66d96f7dbf",
        "tang-bbeff8a9ca",
        "tang-398e426223",
        "tang-bc944d4d5b",
        "tang-bfb4c74cf4",
        "tang-f9ceaacb68",
        "tang-aa8baf4cf9",
        "tang-af93209420"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "下缅甸河谷诸聚落",
      "nodeId": "c13-ce173156da",
      "name": "孟人诸港",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-9886819390",
        "tang-66d96f7dbf",
        "tang-bbeff8a9ca",
        "tang-398e426223",
        "tang-bc944d4d5b",
        "tang-bfb4c74cf4",
        "tang-f9ceaacb68",
        "tang-aa8baf4cf9",
        "tang-af93209420"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "茫蛮诸部",
      "nodeId": "c10-salween",
      "name": "茫蛮诸部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-2d37f77002",
        "tang-611f7f29d9",
        "tang-72f76247f8"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "南诏",
      "nodeId": "c10-nanzhao",
      "name": "十睑",
      "governorOffice": "office-governor-859196a6b1d9",
      "holder": "劝丰祐",
      "status": "新补",
      "sources": [
        "tang-5af57bbee7",
        "tang-133464ff2d",
        "tang-5ba072e7a5",
        "tang-12a452c2ad",
        "tang-69caea7bde",
        "tang-2feb4bf3fa",
        "tang-2425979e02",
        "tang-b5275d6062",
        "tang-18575bc89b",
        "tang-580486a4e2",
        "tang-7ac8013d00",
        "tang-2980f1e386",
        "tang-43708258a8",
        "tang-936d5011f4",
        "tang-4b0ae1e0bf",
        "tang-a3b30349ec",
        "tang-0cd8c76ef7",
        "tang-e9a8f30395",
        "tang-8b40a3c908",
        "tang-bed5bf608b",
        "tang-e40dca3382",
        "tang-cb2b02ce59",
        "tang-24356cb4dd",
        "tang-d582a84d89",
        "tang-ae734e28d0",
        "tang-90b1ca742b",
        "tang-57f2f33de9",
        "tang-91ed7f3338"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    },
    {
      "owner": "南诏",
      "nodeId": "circuit-55884df8b1ea",
      "name": "诸节度都督",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-5af57bbee7",
        "tang-133464ff2d",
        "tang-5ba072e7a5",
        "tang-12a452c2ad",
        "tang-69caea7bde",
        "tang-2feb4bf3fa",
        "tang-2425979e02",
        "tang-b5275d6062",
        "tang-18575bc89b",
        "tang-580486a4e2",
        "tang-7ac8013d00",
        "tang-2980f1e386",
        "tang-43708258a8",
        "tang-936d5011f4",
        "tang-4b0ae1e0bf",
        "tang-a3b30349ec",
        "tang-0cd8c76ef7",
        "tang-e9a8f30395",
        "tang-8b40a3c908",
        "tang-bed5bf608b",
        "tang-e40dca3382",
        "tang-cb2b02ce59",
        "tang-24356cb4dd",
        "tang-d582a84d89",
        "tang-ae734e28d0",
        "tang-90b1ca742b",
        "tang-57f2f33de9",
        "tang-91ed7f3338"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "环王",
      "nodeId": "c10-champa-frontier",
      "name": "环王北境",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "环王北境的边地分区；未考得统领全组边城的单一守将，不能把国王再当作每组边区主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-44de2a1e8a",
        "tang-d8532d768e",
        "tang-d9651e02de",
        "tang-33b539fb7f",
        "tang-9621544942",
        "tang-cd51c47917",
        "tang-24b6f5bdb2",
        "tang-b2d7a1e2c8",
        "tang-0656988a84",
        "tang-cc2e13d0cb",
        "tang-7fbec7ab33",
        "tang-3631d7bcbf",
        "tang-813ede0bb7"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "环王",
      "nodeId": "c13-ddf9eee255",
      "name": "环王",
      "governorOffice": "office-governor-d989b7231f2e",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-44de2a1e8a",
        "tang-d8532d768e",
        "tang-d9651e02de",
        "tang-33b539fb7f",
        "tang-9621544942",
        "tang-cd51c47917",
        "tang-24b6f5bdb2",
        "tang-b2d7a1e2c8",
        "tang-0656988a84",
        "tang-cc2e13d0cb",
        "tang-7fbec7ab33",
        "tang-3631d7bcbf",
        "tang-813ede0bb7"
      ],
      "reason": "王国君位存在；本轮无足够一手任期材料落实到人物，保留君位出缺，不称无君主。"
    },
    {
      "owner": "湄公河上游诸部",
      "nodeId": "c10-mekong",
      "name": "文单与湄公河诸部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-8d3a46ef58",
        "tang-b1884ad2c2",
        "tang-fb0a3c772d",
        "tang-c977bbc79a",
        "tang-f3a57a57f3",
        "tang-e7d8873e7e",
        "tang-1b6f59c140"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "湄公河上游诸部",
      "nodeId": "c13-60083cfb22",
      "name": "哈里奔猜",
      "governorOffice": "office-governor-cc1a06db0ba4",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-8d3a46ef58",
        "tang-b1884ad2c2",
        "tang-fb0a3c772d",
        "tang-c977bbc79a",
        "tang-f3a57a57f3",
        "tang-e7d8873e7e",
        "tang-1b6f59c140"
      ],
      "reason": "王国君位存在；本轮无足够一手任期材料落实到人物，保留君位出缺，不称无君主。"
    },
    {
      "owner": "牂牁诸蛮",
      "nodeId": "c10-unresolved-east",
      "name": "牂牁",
      "governorOffice": null,
      "governanceNote": "羁縻",
      "governanceDetail": "本地首领分治，册封朝贡关系不等于流官直接统辖；未考得全组统一任官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-56d11bb146",
        "tang-abde9b12d6",
        "tang-347b827ca1",
        "tang-f58cceacd6",
        "tang-e1d32b07a6",
        "tang-6c7f57c176",
        "tang-5b41127b50",
        "tang-ecabc9c57c",
        "tang-ec2e4a7cb8",
        "tang-e4b47f81d1",
        "tang-449079e8c1",
        "tang-7b85e506e5",
        "tang-4bba9c81c2"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "黠戛斯",
      "nodeId": "c13-9c5782caba",
      "name": "坚昆",
      "governorOffice": "office-governor-816598583132",
      "holder": "阿热",
      "status": "新补",
      "sources": [
        "tang-2a9f632811",
        "tang-3c63a849b3",
        "tang-42da911914",
        "tang-fb437301be",
        "tang-eafc36c04e",
        "tang-4db57636b3",
        "tang-889a974f8d",
        "tang-d07ab9d436",
        "tang-a6674d8841",
        "tang-22bab8fec2",
        "tang-12d68c4def",
        "tang-889a974f8d",
        "tang-c034e7b4f6",
        "tang-2f6b891999"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    },
    {
      "owner": "安西绿洲诸城",
      "nodeId": "c13-4ce8e9ece7",
      "name": "安西四镇故地",
      "governorOffice": null,
      "governanceNote": "分镇",
      "governanceDetail": "此分区合有多个军镇、部落或属地，由各部各镇分掌，未考得统领整个分区的单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-a7b5f0b38b",
        "tang-a45956f7ad",
        "tang-0048406132",
        "tang-36f91ca410",
        "tang-46eda2d825",
        "tang-56876d3ab5",
        "tang-2502c12638",
        "tang-ebc5a23069",
        "tang-41373091ab",
        "tang-46e91cdf51",
        "tang-ee40a7351e",
        "tang-e4079464d1",
        "tang-c3f13eb8af",
        "tang-cd79135c35",
        "tang-910a90cac7",
        "tang-dc24d397a3",
        "tang-bac002abdb",
        "tang-978843c943",
        "tang-715730eac1"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "葛逻禄诸部",
      "nodeId": "c13-d6567db0df",
      "name": "十姓可汗故地",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-aa4f70fc5a",
        "tang-466a842a8d",
        "tang-6a56e55e3f",
        "tang-8ccdfe67a7",
        "tang-2cecf409d1",
        "tang-d118814f88",
        "tang-632802e6bc",
        "tang-db56bbb026",
        "tang-45b061dd50",
        "tang-e874944652",
        "tang-4f14b1da56"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "葱岭诸谷",
      "nodeId": "c13-fe85bd0ac9",
      "name": "葱岭",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-de710624ac",
        "tang-58ee1e4c91",
        "tang-a5eeea3e3a",
        "tang-38d1a52571",
        "tang-4be6a7ca2c",
        "tang-58ee1e4c91",
        "tang-a4cd4c93ca"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "迦湿弥罗",
      "nodeId": "c13-9653ce8f33",
      "name": "迦湿弥罗",
      "governorOffice": "office-governor-8fa0aee2f5a1",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-944e8bd161",
        "tang-3985c33940",
        "tang-f7b98e008d",
        "tang-498e51820e",
        "tang-0e32de46e5",
        "tang-c9a194e5b4",
        "tang-dcaa3c126a"
      ],
      "reason": "王国君位存在；本轮无足够一手任期材料落实到人物，保留君位出缺，不称无君主。"
    },
    {
      "owner": "泥婆罗",
      "nodeId": "c13-91d65b7651",
      "name": "泥婆罗",
      "governorOffice": "office-governor-4e219c15faf6",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-a722d15a6d",
        "tang-f70dc3f9df",
        "tang-dfee875da4",
        "tang-9e2e11aebd",
        "tang-434aeb6d69",
        "tang-3dc2952263"
      ],
      "reason": "王国君位存在；本轮无足够一手任期材料落实到人物，保留君位出缺，不称无君主。"
    },
    {
      "owner": "骨利干诸部",
      "nodeId": "c13-daeb9c855f",
      "name": "小海诸部",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-11d01926ac",
        "tang-5469124e82",
        "tang-18a4728b53",
        "tang-fb6aae08a4",
        "tang-eba1c1a148",
        "tang-8c4a437793",
        "tang-6a64516a3e",
        "tang-18a4728b53"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "真腊",
      "nodeId": "c13-0b6d7d240f",
      "name": "真腊",
      "governorOffice": "office-governor-47ee4380d107",
      "holder": "",
      "status": "出缺",
      "sources": [
        "tang-f00634cd16",
        "tang-1568e243b2",
        "tang-737162c0d0",
        "tang-e1253e8882",
        "tang-8dc7fc8ed0",
        "tang-38998bd7ce",
        "tang-f37216f427",
        "tang-927763a0e2",
        "tang-bd9349581a"
      ],
      "reason": "王国君位存在；本轮无足够一手任期材料落实到人物，保留君位出缺，不称无君主。"
    },
    {
      "owner": "堕和罗",
      "nodeId": "c13-3d0e9e601e",
      "name": "堕和罗",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-f6758087af",
        "tang-440d1e5b15",
        "tang-58f79b658a",
        "tang-d17bf12293"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "南海半岛诸港",
      "nodeId": "c13-6b43c743b1",
      "name": "南海半岛",
      "governorOffice": null,
      "governanceNote": "诸部",
      "governanceDetail": "地方诸部或聚落分别治理，不能把某一酋长视为全域单一主官。",
      "holder": "",
      "status": "枚举",
      "sources": [
        "tang-ad93211cc2",
        "tang-2f8a434075",
        "tang-c307ee1bbb",
        "tang-977a008d53",
        "tang-e113ebc1cf",
        "tang-f44a1532a9",
        "tang-b87fd9cb9e"
      ],
      "reason": "按前轮区划考证保留多主官格局；无可确定的单一省道职。"
    },
    {
      "owner": "瞿折罗·波罗底诃罗",
      "nodeId": "div-v15-2edd3af41daf",
      "name": "曲女城与恒河诸地",
      "governorOffice": "office-governor-2edd3af41daf",
      "holder": "弥醯罗·博阇",
      "status": "新补",
      "sources": [
        "tang-650cbe3b93",
        "tang-d84d2372bd",
        "tang-ec4d5a43b4",
        "tang-9498344553",
        "tang-7ee47a0965",
        "tang-a74b4e16ac",
        "tang-90519ed3b4",
        "tang-2de904cd16",
        "tang-a15136347f",
        "tang-02faa7f577",
        "tang-4f8bb41c34",
        "tang-0c777e9993",
        "tang-d056b93ac6",
        "tang-9544a79209",
        "tang-a74b4e16ac",
        "tang-41d32f23c1"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    },
    {
      "owner": "波罗王朝",
      "nodeId": "div-v15-f643ad59b709",
      "name": "摩揭陀与东部诸地",
      "governorOffice": "office-governor-f643ad59b709",
      "holder": "提婆波罗",
      "status": "新补",
      "sources": [
        "tang-dab281ad82",
        "tang-77b6fc14c4",
        "tang-875187885c",
        "tang-07ed983b39",
        "tang-8918ebc0c5",
        "tang-7889270347",
        "tang-6e12ae19eb",
        "tang-1ed5331136",
        "tang-7805e1b610",
        "tang-d513f893f5"
      ],
      "reason": "已有史实人物；补君长职位作本王庭辖区的引用。"
    }
  ],
  "sources": [
    {
      "id": "tang-d9ca51f961",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年九月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丙午，以前江西觀察使敬昕為京兆尹。",
      "claim": "開成四年九月丙午敬昕任京兆尹",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-504f2b10b5",
      "title": "《資治通鑑》卷二四六·開成五年八月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "庚午，門下侍郎、同平章事李玨坐爲山陵使龍輴陷，罷爲太常卿。貶京兆尹敬昕爲郴州司馬。",
      "claim": "開成五年八月庚午敬昕以京兆尹被貶（說明開局日仍在任）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-e24edbab8a",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年九月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "辛丑，以吏部侍郎陳夷行為華州鎮國軍防禦使",
      "claim": "開成四年九月陳夷行任華州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-b299364022",
      "title": "《舊唐書》卷十八上·武宗紀·開成五年七月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷18上",
      "quote": "秋七月，制檢校禮部尚書、華州刺史陳夷行復為中書侍郎、同平章事。",
      "claim": "開成五年七月由華州入相",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷18上.wiki"
    },
    {
      "id": "tang-e187f288f1",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年閏正月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "閏月甲申朔，以吏部侍郎鄭肅檢校禮部尚書、河中晉絳慈隰等州節度使",
      "claim": "開成四年閏正月鄭肅任河中節度使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-59b7fefb21",
      "title": "《舊唐書》卷一七六·鄭肅傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷176",
      "quote": "乃以肅檢校禮部尚書，兼河中尹、河中節度、晉絳觀察等使。會昌初，武宗思太子永之無罪，盡誅陷永之黨。朝議稱肅忠正，有大臣之節。召拜太常卿",
      "claim": "本傳所載官稱及武宗朝召還",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷176.wiki"
    },
    {
      "id": "tang-3af2c8be03",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年二月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "辛亥，左丞盧載為同州防禦使。",
      "claim": "開成三年二月盧載任同州防禦使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-f7c0c771cc",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年二月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丁未，以同州刺史孫簡為陝虢觀察使，代盧行術",
      "claim": "前任孫簡同月調陝虢",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-5bc753054d",
      "title": "《新唐書》卷六七·方鎮表四·興元元年",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷067",
      "quote": "置金、商二州都防禦使。",
      "claim": "金商都防禦使建置",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/xts-卷067.wiki"
    },
    {
      "id": "tang-0e63a40aa4",
      "title": "《新唐書》卷六七·方鎮表四·光啟元年",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷067",
      "quote": "升金商都防禦使為節度，兼京畿制置萬勝軍等使。",
      "claim": "光啟元年升節度（證明開成時仍有此使）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/xts-卷067.wiki"
    },
    {
      "id": "tang-5b45f655ce",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "冬十月乙酉朔，以尚書左丞崔琯檢校戶部尚書，充東都留守。",
      "claim": "開成三年十月崔琯任東都留守",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-6c28cf0c16",
      "title": "《舊唐書》卷一七七·崔琯傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷177",
      "quote": "三年，檢校戶部尚書，判東都尚書省事、東都留守、東畿汝都防禦等使。會昌中，遷銀青光祿大夫、檢校吏部尚書、興元尹，充山南西道節度使。",
      "claim": "本傳完整官稱，會昌中才離任",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷177.wiki"
    },
    {
      "id": "tang-a1831b6c32",
      "title": "《舊唐書》卷一六八·高釴傳附弟銖",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷168",
      "quote": "四年七月，出為河南尹。會昌末，為吏部侍郎。",
      "claim": "河南尹高銖開成四年七月上任",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷168.wiki"
    },
    {
      "id": "tang-3a44445320",
      "title": "《唐會要》卷六八·河南尹",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷068",
      "quote": "開成五年四月。東都奏。河南尹高銖。與知臺御史盧罕街衢相逢。高銖乘肩輿。無所避。",
      "claim": "開成五年四月高銖仍任河南尹",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷068.wiki"
    },
    {
      "id": "tang-6a10c3dbe9",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年八月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "八月庚戌朔，以給事中姚合為陝虢觀察使。",
      "claim": "開成四年八月姚合任陝虢",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-0d8774773a",
      "title": "《新唐書》卷二〇三·李商隱傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷203",
      "quote": "調弘農尉，以活獄忤觀察使孫簡，將罷去，會姚合代簡，諭使還官。",
      "claim": "姚合接替孫簡（李商隱傳旁證）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷203.wiki"
    },
    {
      "id": "tang-307337d23b",
      "title": "《舊唐書》卷一六八·韋溫傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷168",
      "quote": "上素重溫，亦不奪其操，出為陜虢觀察使。武宗即位，李德裕用事，召拜吏部侍郎",
      "claim": "繼任者韋溫任陝虢，年月不詳",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷168.wiki"
    },
    {
      "id": "tang-8727d5e1b9",
      "title": "《新唐書》卷六四·方鎮表一·開成元年",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷064",
      "quote": "復置陝虢都防禦觀察使。",
      "claim": "開成元年復置陝虢都防禦觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/xts-卷064.wiki"
    },
    {
      "id": "tang-1fd86071b9",
      "title": "《舊唐書》卷十七下·文宗紀下·開成二年六月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "戊申，以左金吾衛將軍李執方為河陽三城懷州節度使。",
      "claim": "開成二年六月李執方任河陽三城懷州節度使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-a1a6afef78",
      "title": "《資治通鑑》卷二四五·開成二年六月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷245",
      "quote": "戊申，以左金吾將軍李執方為河陽節度使。",
      "claim": "同一任命（通鑑）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷245.wiki"
    },
    {
      "id": "tang-8d74af6a0d",
      "title": "《新唐書》卷二一〇·藩鎮魏博·何進滔傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷210",
      "quote": "子重順襲。武宗詔河陽李執方、滄州劉約諭朝京師，或割地自效，不聽命。",
      "claim": "開成五年末何進滔死後，李執方仍在河陽",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷210.wiki"
    },
    {
      "id": "tang-1ad204fa0a",
      "title": "《資治通鑑》卷二四七·會昌三年四月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷247",
      "quote": "丁亥，以忠武節度使王茂元為河陽節度使",
      "claim": "王茂元任河陽",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷247.wiki"
    },
    {
      "id": "tang-253374c174",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十二月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "辛丑，詔以河東節度使、開府儀同三司、守司徒、兼中書令、太原尹、北都留守、上柱國、晉國公、食邑三千戶裴度可守司徒、中書令。以兵部侍郎狄兼謨為河東節度使。",
      "claim": "開成三年十二月狄兼謨任河東節度使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-5e27c385ad",
      "title": "《舊唐書》卷八九·狄仁傑傳附族曾孫兼謨",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷89",
      "quote": "兼謨尋轉兵部侍郎。明年，檢校工部尚書、太原尹，充河東節度使。會昌中，累歴方鎮，卒。",
      "claim": "本傳官稱",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷89.wiki"
    },
    {
      "id": "tang-ed3b84c7e7",
      "title": "《新唐書》卷一七七·韋博傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷177",
      "quote": "回鶻入寇，以符澈為河東節度使，拜博為判官。",
      "claim": "苻澈因回鶻入寇而改任河東",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷177.wiki"
    },
    {
      "id": "tang-b67eb96684",
      "title": "《資治通鑑》卷二四六·會昌二年三月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "時河東節度使苻澈疾病，庚申，以沔代之。以金吾上將軍李忠順爲振武節度使。",
      "claim": "會昌二年三月劉沔代苻澈",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-83910da8d5",
      "title": "《舊唐書》卷十七下·文宗紀下·大和九年九月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "乙亥，以涇原節度使劉沔為振武麟勝節度使。",
      "claim": "大和九年劉沔自涇原移振武",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-00b944e838",
      "title": "《資治通鑑》卷二四六·開成五年十月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "詔振武節度使劉沔屯雲迦關以備之。",
      "claim": "開成五年十月仍稱振武節度使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-371a150e5b",
      "title": "《舊唐書》卷一六一·劉沔傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷161",
      "quote": "移授振武節度使，檢校右散騎常侍、單於大都護。開成中，党項雜虜大擾河西。沔率吐渾、契苾、沙陁三部落等諸族萬人、馬三千騎，徑至銀、夏討襲，大破之。俘獲萬計，告捷而還。以功加檢校戶部尚書。",
      "claim": "開成中破党項，加檢校戶部尚書",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷161.wiki"
    },
    {
      "id": "tang-a1d757279e",
      "title": "《資治通鑑》卷二四六·開成五年十月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "冬，十月，丙辰，天德軍使溫德彝奏：「回鶻潰兵侵逼西城，亙六十里，不見其後。邊人以回鶻猥至，恐懼不安。」",
      "claim": "開成五年十月溫德彝以天德軍使身份奏事",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-18cd5cefab",
      "title": "《舊唐書》卷十七下·文宗紀下·開成二年六月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "己亥，以鴻臚卿李逵為天德軍都防禦使。",
      "claim": "開成二年李逵任天德軍都防禦使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-7f02d980bd",
      "title": "《資治通鑑》卷二四六·會昌元年八月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "天德軍使田牟、監軍韋仲平欲擊回鶻以求功",
      "claim": "會昌元年已是田牟",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-cbc759af87",
      "title": "《舊唐書》卷十七下·文宗紀下·開成元年閏五月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "己丑，以神策大將軍魏仲卿為朔方靈鹽節度。",
      "claim": "開成元年閏五月魏仲卿任朔方靈鹽節度",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-151d7f8692",
      "title": "《資治通鑑》卷二四六·開成三年六月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "初，靈武節度使王晏平自盜贓七千餘緡，上以其父智興有功，免死，長流康州。",
      "claim": "前任王晏平因貪贓罷免",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-8c1983cbd5",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "壬辰，以右金吾衛將軍高霞寓為夏、綏、銀、宥節度使。",
      "claim": "開成三年十月任命，名字作高霞寓",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-e2ab64f8f1",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丁酉，夏州節度使劉源卒。",
      "claim": "前任劉源卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-0e11e29cee",
      "title": "《舊唐書》卷一六二·高霞寓傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷162",
      "quote": "寶歷二年，疽發首，不能理事，求歸闕下。其夏，授右金吾衛大將軍、檢校司徒，途次奉天而卒，年五十五，贈太保。",
      "claim": "元和名將高霞寓早在寶曆二年已死，與上條同名不同人或名字有誤",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷162.wiki"
    },
    {
      "id": "tang-1e827805f8",
      "title": "《新唐書》卷八·武宗紀·會昌六年二月",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷008",
      "quote": "庚辰，夏綏銀節度使米暨為東北道招討党項使。",
      "claim": "會昌六年米暨",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷008.wiki"
    },
    {
      "id": "tang-fd6ea9fe2d",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年四月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "夏四月壬子朔，以右羽林統軍李昌言為鄜坊節度使。",
      "claim": "開成四年四月李昌言任鄜坊",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-a91f809628",
      "title": "《舊唐書》卷十七下·文宗紀下·大和六年十月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "壬午，以左金吾衛將軍李昌言檢校左散騎常侍，充夏、綏、銀、宥節度使。",
      "claim": "李昌言大和六年曾任夏綏",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-51b69c10fb",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年六月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "六月辛亥朔，以長武城使苻澈為邠寧節度。",
      "claim": "開成四年六月苻澈任邠寧",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-cc9b1d6db4",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年五月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丙午，邠甯節度使郭旼卒。",
      "claim": "前任郭旼開成四年五月卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-6507f6e210",
      "title": "《新唐書》卷一一九·白居易傳附弟敏中",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷119",
      "quote": "遷右拾遺，改殿中侍御史，為符澈邠寧副使，澈卒以能政聞。",
      "claim": "白敏中任其邠寧副使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷119.wiki"
    },
    {
      "id": "tang-9a15e5c55b",
      "title": "《舊唐書》卷十七下·文宗紀下·大和九年九月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "癸未，以前廣州節度使王茂元為涇原節度使。",
      "claim": "大和九年王茂元任涇原",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-699965f190",
      "title": "《新唐書》卷一七〇·王棲曜傳附子茂元",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷170",
      "quote": "鄭註用事，遷涇原節度使。註敗，悉出家貲餉兩軍，得不誅，封濮陽郡侯。召為將作監，領陳許節度使，又徙河陽。",
      "claim": "涇原之後召為將作監、改領陳許",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷170.wiki"
    },
    {
      "id": "tang-445b4ef2b7",
      "title": "《舊唐書》卷十七下·文宗紀下·大和九年十一月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丁卯，以左神刺大將軍陳君奕為鳳翔節度使。",
      "claim": "大和九年陳君奕任鳳翔",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-a6d63b5ec8",
      "title": "《冊府元龜》（維基文庫「冊府元龜/卷0650」頁）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜/卷0650",
      "quote": "陳君奕為鳳翔節度使文宗開成元年九月己卯詔罰君奕兩月俸以舊制西藩非賀正賀冬繼好使臣不至論屈熱等不由三事而來節度使宜留之奏聽朝旨君奕不遵舊制故有是罰。",
      "claim": "開成元年九月仍在鳳翔（受罰俸）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜_卷0650.wiki"
    },
    {
      "id": "tang-0650b83aa2",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十一月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "壬申，以蔡州刺史韓威為定州刺史、義武軍節度、北平軍等使。",
      "claim": "開成三年十一月韓威任義武",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-ac76b8c62f",
      "title": "《冊府元龜》帝王部（維基文庫「冊府元龜/卷0109」頁；四庫本在卷一四〇）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜/卷0109",
      "quote": "四年十二月贈故易定觀察判官兼侍御史李士季給事中其家委韓威安存喪事官給仍賜一子官",
      "claim": "開成四年十二月韓威仍在易定",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜_卷0109.wiki"
    },
    {
      "id": "tang-4fb908557b",
      "title": "《舊唐書》卷十八上·武宗紀·開成五年八月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷18上",
      "quote": "易定軍亂，逐節度使陳君賞。君賞鳩合豪傑數百人，復入城，盡誅謀亂兵士，軍城復安。",
      "claim": "開成五年八月易定節度使已是陳君賞",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷18上.wiki"
    },
    {
      "id": "tang-e85bf713aa",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十一月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "以滄州節度使李彥佐為鄆、曹、濮節度使，以德州刺史、滄景節度副使劉約為義昌軍節度使。",
      "claim": "開成三年十一月劉約代李彥佐任義昌",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-38a8ddeba2",
      "title": "《新唐書》卷二一〇·何進滔傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷210",
      "quote": "武宗詔河陽李執方、滄州劉約諭朝京師，或割地自效，不聽命。",
      "claim": "開成五年末仍在滄州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷210.wiki"
    },
    {
      "id": "tang-4978805849",
      "title": "《舊唐書》卷十七下·文宗紀下·開成四年七月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "壬寅，以河南尹韋長為平盧軍節度使，以刑部侍郎高鍇為河南尹。",
      "claim": "開成四年七月韋長任平盧",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-ea4b03eb07",
      "title": "《全唐文》卷七三二·韋長小傳",
      "url": "https://zh.wikisource.org/wiki/全唐文/卷0732",
      "quote": "長，長慶時官京兆尹。開成中為荊南觀察使檢校左散騎常侍兼河南尹，進檢校工部尚書，除平盧軍節度使。",
      "claim": "本人小傳",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/全唐文_卷0732.wiki"
    },
    {
      "id": "tang-839f2d1642",
      "title": "《資治通鑑》卷二四六·開成三年十一月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "以義昌節度使李彥佐爲天平節度使，以劉約爲義昌節度使。",
      "claim": "開成三年十一月李彥佐移鎮天平",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-a6d5ff95ce",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十一月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "以滄州節度使李彥佐為鄆、曹、濮節度使",
      "claim": "紀文",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-251da56879",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年十一月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "乙丑，天平軍節度使王源中卒。",
      "claim": "前任王源中開成三年十一月卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-e98e1bbc01",
      "title": "《新唐書》卷八·武宗紀·會昌三年五月",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷008",
      "quote": "武寧軍節度使李彥佐為晉絳行營諸軍節度招討使。",
      "claim": "會昌三年已在武寧",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷008.wiki"
    },
    {
      "id": "tang-c3ccab6e6a",
      "title": "《舊唐書》卷十七下·文宗紀下·開成二年七月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "甲申，乙太府卿張賈為兗海觀察使。",
      "claim": "開成二年張賈任兗海觀察使（紀文「乙」為「以」字之誤）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-37729777d1",
      "title": "《新唐書》卷六五·方鎮表二·大和八年",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷065",
      "quote": "廢沂海節度使為觀察使。",
      "claim": "大和八年兗海降為觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/xts-卷065.wiki"
    },
    {
      "id": "tang-c0e4da1fbc",
      "title": "《資治通鑑》卷二四六·會昌元年八月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "時詔以鴻臚卿張賈爲巡邊使，使察回鶻情偽，未還。",
      "claim": "會昌元年已回朝",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-ca2d917dda",
      "title": "《舊唐書》卷一七三·李紳傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷173",
      "quote": "開成元年，鄭覃輔政，起德裕為浙西觀察使，紳為河南尹。六月，檢校戶部尚書、汴州刺史、宣武節度、宋亳汴潁觀察等使。二年，夏秋旱，大蝗，獨不入汴、宋之境，詔書褒美。又於州置利潤樓店。四年，就加檢校兵部尚書。",
      "claim": "開成元年任宣武，四年加檢校兵部尚書",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷173.wiki"
    },
    {
      "id": "tang-08c1cfc652",
      "title": "《舊唐書》卷十八上·武宗紀·開成五年九月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷18上",
      "quote": "以宣武軍節度使、檢校吏部尚書、汴州刺史李紳代德裕鎮淮南。",
      "claim": "開成五年九月移淮南",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-李紳.wiki"
    },
    {
      "id": "tang-5e3ee11105",
      "title": "《舊唐書》卷十七下·文宗紀下·開成元年四月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "癸酉，以亳州刺史裴弘泰為義成軍節度使",
      "claim": "開成元年四月裴弘泰任義成",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-c2843c3754",
      "title": "《冊府元龜》（維基文庫「冊府元龜/卷0650」頁）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜/卷0650",
      "quote": "裴弘泰為鄭滑節度使開成四年十一月弘泰奏慶成節日放當州囚徒以資聖壽詔曰：弘泰以慶成令節擅放累囚雖曰：竭誠。且為幹禁恐開後例須示薄懲宜罰一月俸料。",
      "claim": "開成四年十一月仍在鄭滑（受罰俸）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜_卷0650.wiki"
    },
    {
      "id": "tang-0c694c66c8",
      "title": "《舊唐書》卷十七下·文宗紀下·開成三年七月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "甲子，以衛尉卿王彥威檢校禮部尚書，充忠武軍節度使",
      "claim": "開成三年七月王彥威任忠武",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-76942426b6",
      "title": "《舊唐書》卷一五七·王彥威傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷157",
      "quote": "三年七月，檢校禮部尚書，代殷侑為許州刺史，充忠武軍節度、陳許溵觀察等使。會昌中，入為兵部侍郎",
      "claim": "本傳官稱",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷157.wiki"
    },
    {
      "id": "tang-7dfe5d2dd0",
      "title": "《舊唐書》卷十七下·文宗紀下·開成元年十二月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "十二月丙申朔，以京兆尹、兼御史大夫薛元賞為武寧節度、徐泗宿濠觀察等使",
      "claim": "開成元年十二月薛元賞任武寧",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-78832734c7",
      "title": "《新唐書》卷一九七·循吏·薛元賞傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷197",
      "quote": "遷累司農卿、京兆尹。出為武寧節度使，罷泗口猥稅，人以為便。俄徙邠寧。",
      "claim": "本傳",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷197.wiki"
    },
    {
      "id": "tang-566612fdfc",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "以浙西觀察使李德裕檢校戶部尚書，兼揚州大都督府長史，充淮南節度使。辛未，詔以前淮南節度使牛僧孺為檢校司空、東都留守，以蘇州刺史盧商為浙西觀察使。",
      "claim": "開成二年五月由浙西觀察使移淮南，檢校戶部尚書、揚州大都督府長史",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-4b479fd56d",
      "title": "《舊唐書》卷一七四·李德裕傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷174",
      "quote": "開成二年五月，授揚州大都督府長史、淮南節度副大使、知節度使事，代牛僧孺。",
      "claim": "本傳記其使職全稱",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷174.wiki"
    },
    {
      "id": "tang-a025fe9106",
      "title": "《舊唐書》卷一七四·李德裕傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷174",
      "quote": "五年正月，武宗即位。七月，召德裕於淮南。九月，授門下侍郎、同平章事。",
      "claim": "開成五年七月始召、九月入相，開局日仍在揚州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷174.wiki"
    },
    {
      "id": "tang-7657e507a7",
      "title": "《舊唐書》卷十八上·武宗紀",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷18上",
      "quote": "九月，以淮南節度使、檢校尚書左僕射李德裕為吏部尚書、同中書門下平章事，尋兼門下侍郎；以宣武軍節度使、檢校吏部尚書、汴州刺史李紳代德裕鎮淮南。",
      "claim": "離任時結銜含檢校尚書左僕射；李紳代鎮",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-李紳.wiki"
    },
    {
      "id": "tang-c98785fe25",
      "title": "《資治通鑑》卷二四六",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "初，上之立非宰相意，故楊嗣復、李玨相繼罷去，召淮南節度使李德裕入朝。九月，甲戌朔，至京師。丁丑，以德裕爲門下侍郎、同平章事。",
      "claim": "通鑑同記召淮南節度使入朝",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-f7fa3919b0",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "癸未，以吏部侍郎高鍇為鄂嶽觀察使，代高重；以重為兵部侍郎。",
      "claim": "開成三年以吏部侍郎為鄂岳觀察使，代高重",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-d5fdd7eb1a",
      "title": "《舊唐書》卷一六八·高釴傳附弟鍇",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷168",
      "quote": "尋轉吏部侍郎。其年九月，出為鄂州刺史、御史大夫、鄂嶽觀察使，卒。",
      "claim": "本傳：出為鄂岳觀察使，卒（卒於任）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷168.wiki"
    },
    {
      "id": "tang-a7fc896a9d",
      "title": "《新唐書》卷一七七·高釴傳附弟鍇",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷177",
      "quote": "遷吏部侍郎，出為鄂嶽觀察使。卒，贈禮部尚書。",
      "claim": "新傳同：鄂岳觀察使任上卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷177.wiki"
    },
    {
      "id": "tang-9ef77d2309",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "壬寅，以河南尹韋長為平盧軍節度使，以刑部侍郎高鍇為河南尹。",
      "claim": "文宗紀開成四年七月「高鍇為河南尹」一條與本傳不合",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-4c4fe7dc22",
      "title": "《舊唐書》卷一六八·高釴傳附弟銖",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷168",
      "quote": "開成三年，就加檢校左散騎常侍，尋入為刑部侍郎。四年七月，出為河南尹。",
      "claim": "實為其兄高銖：開成三年入為刑部侍郎，四年七月出為河南尹",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷168.wiki"
    },
    {
      "id": "tang-ec74f20203",
      "title": "《唐會要》卷二三（四庫本）",
      "url": "https://zh.wikisource.org/wiki/唐會要_(四庫全書本)/卷023",
      "quote": "開成四年十月戸部侍郎崔蠡奏臣伏以國忌行香事不師古聖心求理動法典章",
      "claim": "崔蠡開成四年十月尚在戶部侍郎任",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要 (四庫全書本)_卷023.wiki"
    },
    {
      "id": "tang-19efdcfb1e",
      "title": "《李義山文集箋注》卷三（四庫本）",
      "url": "https://zh.wikisource.org/wiki/李義山文集箋注_(四庫全書本)/卷03",
      "quote": "時崔蠡方除鄂岳觀察而王茂元為陳許節度",
      "claim": "清人箋注：崔蠡其後方除鄂岳（時王茂元為陳許節度）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/李義山文集箋注 (四庫全書本)_卷03.wiki"
    },
    {
      "id": "tang-55bba02c9c",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "辛未，詔以前淮南節度使牛僧孺為檢校司空、東都留守，以蘇州刺史盧商為浙西觀察使。",
      "claim": "開成二年五月以蘇州刺史為浙西觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-5b8b692e38",
      "title": "《冊府元龜》卷四九四（四庫本）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜_(四庫全書本)/卷0494",
      "quote": "五月以蘇州刺史盧商為潤州刺史攝御史大夫充浙江西道都團練觀察等使商在蘇州變鹽法獲利倍多時宰臣為鹽鐵使以課績上聞故有是命",
      "claim": "冊府記全銜",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜 (四庫全書本)_卷0494.wiki"
    },
    {
      "id": "tang-1fa0e49988",
      "title": "《舊唐書》卷一七六·盧商傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷176",
      "quote": "宰相領鹽鐵，以其績上，遷潤州刺史、浙西團練觀察使。入為刑部侍郎，轉京兆尹。",
      "claim": "本傳：由浙西入為刑部侍郎",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷176.wiki"
    },
    {
      "id": "tang-ccb8582d9e",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "癸酉，浙東觀察使李道樞卒。以戶部侍郎崔龜從為宣歙觀察使，代崔鄲；以鄲為太常卿。以楚州刺史蕭俶為浙東觀察使。",
      "claim": "開成四年三月以楚州刺史為浙東觀察使，前任李道樞卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-a1570e8107",
      "title": "《舊唐書》卷一七二·蕭俛傳附弟俶",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷172",
      "quote": "開成二年，出為楚州刺史。四年三月，遷越州刺史、御史中丞、浙東都團練觀察使。會昌中，入為左散騎常侍",
      "claim": "本傳：四年三月遷越州刺史、浙東都團練觀察使，會昌中始入朝",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷172.wiki"
    },
    {
      "id": "tang-cf2297c0b1",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "以戶部侍郎崔龜從為宣歙觀察使，代崔鄲；以鄲為太常卿。",
      "claim": "開成四年三月以戶部侍郎代崔鄲為宣歙觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-1f9c0d53be",
      "title": "崔龜從《宣州昭亭山梓華君神祠記》（《全唐文》卷七二九）",
      "url": "https://zh.wikisource.org/wiki/宣州昭亭山梓華君神祠記",
      "quote": "前年四月，自戶部侍郎出為宣州，去前夢二十年矣。五月至郡",
      "claim": "自述四月出為宣州、五月至郡",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/宣州昭亭山梓華君神祠記.wiki"
    },
    {
      "id": "tang-bdd8b765d6",
      "title": "崔龜從《敬亭廟祭文》（《全唐文》卷七二九）",
      "url": "https://zh.wikisource.org/wiki/敬亭廟祭文",
      "quote": "維開成五年歲次庚申九月甲戌朔十四日丁亥，宣歙池等州都團練觀察處置等使朝散大夫使持節宣州諸軍事守宣州刺史兼御史大夫上柱國賜紫金魚袋崔龜從",
      "claim": "開成五年九月仍署宣歙觀察使全銜",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/敬亭廟祭文.wiki"
    },
    {
      "id": "tang-b75c384bec",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "辛丑，以司農卿李𤣱為福建觀察使，諫官論其不可，乃罷之。丙午，以大理卿盧貞為福建觀察使。",
      "claim": "李𤣱之命被諫官駁回後，以大理卿盧貞為福建觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-da1bb7f871",
      "title": "《全唐詩》卷四六三·盧貞小傳",
      "url": "https://zh.wikisource.org/wiki/全唐詩/卷463",
      "quote": "盧貞，字子蒙，官河南尹，開成中為大理卿，終福建觀察使。詩二首。",
      "claim": "全唐詩小傳：開成中為大理卿，終福建觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/全唐詩_卷463.wiki"
    },
    {
      "id": "tang-cdb06d347c",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "辛丑，以吏部侍郎陳夷行為華州鎮國軍防禦使，以蘇州刺史李穎為江西觀察使，以諫議大夫馮定為桂管觀察使。",
      "claim": "文宗紀：以蘇州刺史「李穎」為江西觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-7a6548b7bd",
      "title": "《舊唐書》卷一七一·李中敏傳附李款",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷171",
      "quote": "開成中，累官至諫議大夫，出為蘇州刺史，遷洪州刺史、江西觀察使。",
      "claim": "李款本傳：由蘇州刺史遷洪州刺史、江西觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷171.wiki"
    },
    {
      "id": "tang-f73395cb04",
      "title": "《新唐書》卷一一八·李中敏傳附李款",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷118",
      "quote": "注死，由倉部員外郎累遷江西觀察使。終澶王傅。",
      "claim": "新傳同",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷118.wiki"
    },
    {
      "id": "tang-1d4169bf92",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丙午，以前江西觀察使敬昕為京兆尹。",
      "claim": "前任敬昕此時已回京為京兆尹",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-10c095f741",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丁亥，以御史中丞狄兼謨為刑部侍郎，以前京兆尹歸融為秘書監，以給事中李翊為湖南觀察使。",
      "claim": "開成二年以給事中為湖南觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-dcc738fd8f",
      "title": "《舊唐書》卷十八上·武宗紀",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷18上",
      "quote": "門下侍郎、同平章事楊嗣復檢校吏部尚書、潭州刺史，充湖南都團練觀察使",
      "claim": "下一位有記載的湖南觀察使是楊嗣復（開成五年八月）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷18上.wiki"
    },
    {
      "id": "tang-25efa1dc65",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丙子，以中書侍郎、同中書門下平章事李石為荊南節度使，依前中書侍郎、平章事。丁丑，以前荊南節度使韋長為河南尹。",
      "claim": "開成三年正月以中書侍郎平章事出鎮荊南",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-0549decf48",
      "title": "《舊唐書》卷十八上·武宗紀",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷18上",
      "quote": "以荊南節度使、檢校右僕射、同平章事李石可檢校司空、平章事，兼太原尹、北都留守，充河東節度、管內觀察等使。",
      "claim": "會昌三年仍以荊南節度使移河東",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷18上.wiki"
    },
    {
      "id": "tang-971b50b9e4",
      "title": "《新唐書》卷六七·方鎮表四",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷067",
      "quote": "復置荊南節度使。",
      "claim": "方鎮表：荊南開成三年復為節度",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/xts-卷067.wiki"
    },
    {
      "id": "tang-321b19f454",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "癸亥，以左僕射牛僧孺檢校司空、同平章事，兼襄州刺史，充山南東道節度使。",
      "claim": "開成四年八月由左僕射出鎮襄州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-8d3e935bbd",
      "title": "《資治通鑑》卷二四六",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "以前山南東道節度使、同平章事牛僧孺爲太子太師。先是漢水溢，壞襄州民居。故李德裕以爲僧孺罪而廢之。",
      "claim": "會昌元年閏九月以前山南東道節度使為太子太師",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-a41a67dd38",
      "title": "《舊唐書》卷一七七·盧鈞傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷177",
      "quote": "會昌初，遷襄州刺史、山南東道節度使。",
      "claim": "盧鈞會昌初繼任山南東道",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷177.wiki"
    },
    {
      "id": "tang-585fa6ef73",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丁未，興元節度使鄭浣卒。",
      "claim": "前任鄭澣開成四年閏正月卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-fc940db4cf",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "二月癸酉朔。辛酉，以吏部侍郎歸融檢校禮部尚書，充山南西道節度使。",
      "claim": "開成四年二月以吏部侍郎為山南西道節度使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-3b939cfe94",
      "title": "《舊唐書》卷一四九·歸崇敬傳附孫融",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷149",
      "quote": "三年檢校禮部尚書、興元尹、兼御史大夫，充山南西道節度使。",
      "claim": "本傳全銜",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷149.wiki"
    },
    {
      "id": "tang-56f10b520c",
      "title": "《新唐書》卷一六四·歸崇敬傳附融",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷164",
      "quote": "歲間，出為山南西道節度使，徙東川。還，歷兵部尚書，累封晉陵郡公。",
      "claim": "新傳：出為山南西道節度使，徙東川",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷164.wiki"
    },
    {
      "id": "tang-e902cc01a2",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "戊申，以門下侍郎、同平章事李固言為劍南西川節度使，依前同門下侍郎、平章事。",
      "claim": "開成二年十月以門下侍郎平章事出鎮西川",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-ac678e322d",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "戊辰，西川節度使李固言再上表，讓門下侍郎及檢校右僕射。",
      "claim": "開成三年七月上表讓門下侍郎（紀作「及檢校右僕射」）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-09f45159ff",
      "title": "《舊唐書》卷一七三·李固言傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷173",
      "quote": "其年十月，以門下侍郎平章事出為成都尹、劍南西川節度使，代楊嗣復。上表讓門下侍郎，乃檢校左僕射。會昌初入朝，歷兵、戶二部尚書。",
      "claim": "本傳：讓門下侍郎後改檢校左僕射，會昌初入朝",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷173.wiki"
    },
    {
      "id": "tang-b366e886a9",
      "title": "《新唐書》卷一八二·李固言傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷182",
      "quote": "讓還門下侍郎，乃檢校尚書左僕射。始置騾軍千匹，又募銳士三千，武備雄完。武宗立，召授右僕射。",
      "claim": "新傳：讓還門下侍郎，檢校尚書左僕射；武宗立，召授右僕射",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷182.wiki"
    },
    {
      "id": "tang-1957cb9f8e",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "辛卯，以劍南東川節度楊汝士為吏部侍郎。",
      "claim": "前任楊汝士入為吏部侍郎",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-212ba2b656",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "甲辰，以京兆尹鄭復為劍南東川節度使。",
      "claim": "開成四年九月以京兆尹為東川節度使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-f9e5ea2caf",
      "title": "《唐會要》卷二四",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷024",
      "quote": "會昌元年六月敕。東道節度使鄭復。雖稱有疾。擅離本道。宜釋放。以後藩鎮。如更違越。必舉憲章。",
      "claim": "會昌元年六月仍稱東川節度使鄭復（通行本脫「川」字）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷024.wiki"
    },
    {
      "id": "tang-c8b8822c28",
      "title": "《唐會要》卷二四（四庫本）",
      "url": "https://zh.wikisource.org/wiki/唐會要_(四庫全書本)/卷024",
      "quote": "會昌元年六月勅東川節度使鄭復雖稱有疾擅離本道宜釋放以後藩鎮如更違越必舉憲章",
      "claim": "四庫本作「東川節度使」",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要 (四庫全書本)_卷024.wiki"
    },
    {
      "id": "tang-d477375ba8",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "己丑，以少府監張沼為黔中觀察使。",
      "claim": "開成三年十月以少府監為黔中觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-f381a67500",
      "title": "《新唐書》卷一八四·馬植傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷184",
      "quote": "以政最，檢校左散騎常侍，徙黔中觀察使。",
      "claim": "馬植由安南徙黔中",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷184.wiki"
    },
    {
      "id": "tang-b5c5851600",
      "title": "《唐會要》卷七三",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷073",
      "quote": "四年十一月。安南都護馬植奏。當管經略押衙兼都知兵馬使杜存誠。管善良四鄉。請給發印一面。",
      "claim": "馬植開成四年十一月尚在安南（見安南條）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷073.wiki"
    },
    {
      "id": "tang-596f9ceacb",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "庚戌，以華州刺史盧鈞為廣州刺史，充嶺南節度使；以中書舍人崔龜從為華州防禦使。",
      "claim": "開成元年十二月以華州刺史為廣州刺史、嶺南節度使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-0b022779da",
      "title": "《舊唐書》卷一七七·盧鈞傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷177",
      "quote": "其年冬，代李從易為廣州刺史、御史大夫、嶺南節度使。",
      "claim": "本傳全銜",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷177.wiki"
    },
    {
      "id": "tang-1a6cb948c0",
      "title": "《冊府元龜》卷六三一（四庫本）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜_(四庫全書本)/卷0631",
      "quote": "十一月嶺南節度使盧鈞奏當道伏以海嶠擇吏與江淮不同",
      "claim": "冊府同條作「盧鈞」",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜 (四庫全書本)_卷0631.wiki"
    },
    {
      "id": "tang-964136279e",
      "title": "《新唐書》卷一八二·盧鈞傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷182",
      "quote": "請為鈞生立祠，刻石頌德，鈞固辭。以戶部侍郎召判戶部。  會昌中，漢水害襄陽，拜鈞山南東道節度使",
      "claim": "新傳：華蠻請立生祠後，以戶部侍郎召還，會昌中改山南東道",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷182.wiki"
    },
    {
      "id": "tang-5bda51c9af",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "以蘇州刺史李穎為江西觀察使，以諫議大夫馮定為桂管觀察使。",
      "claim": "文宗紀作「諫議大夫馮定為桂管觀察使」",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-28874d090e",
      "title": "《舊唐書》卷一六八·馮宿傳附從弟審",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷168",
      "quote": "開成三年，遷諫議大夫。四年九月，出為桂州刺史、桂管觀察使。入為國子祭酒。",
      "claim": "馮審本傳：開成三年遷諫議大夫，四年九月出為桂州刺史、桂管觀察使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷168.wiki"
    },
    {
      "id": "tang-42f4735a02",
      "title": "《新唐書》卷一七七·馮宿傳附審",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷177",
      "quote": "審，字退思。開成中，為諫議大夫，拜桂管觀察使，歷國子祭酒。",
      "claim": "新傳同",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷177.wiki"
    },
    {
      "id": "tang-6f5d0acb3a",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "前桂管觀察使嚴謇卒。",
      "claim": "前任嚴謇（嚴譽）已罷，開成四年十月卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-f46040fb27",
      "title": "《舊唐書》卷十八上·武宗紀",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷18上",
      "quote": "中書侍郎、同平章事李玨檢校兵部尚書、桂州刺史，充桂管防禦觀察等使",
      "claim": "李玨於開成五年八月出為桂管",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷18上.wiki"
    },
    {
      "id": "tang-f4583dd5f7",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "乙巳，令內養馮叔良殺前徐州監軍王守涓于中牟縣。以左神策軍胡沐為容管經略使",
      "claim": "太和九年十一月以左神策（將）軍為容管經略使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-4513b37505",
      "title": "《舊唐書》卷十七下（四庫本）",
      "url": "https://zh.wikisource.org/wiki/舊唐書_(四庫全書本)/卷017下",
      "quote": "以左神策將軍胡沐為容管經略使",
      "claim": "四庫本作「左神策將軍」",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書 (四庫全書本)_卷017下.wiki"
    },
    {
      "id": "tang-819c4ddb1c",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "癸亥，以宋州刺史唐弘實為邕管經略使。",
      "claim": "開成三年十一月以宋州刺史為邕管經略使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-68f0a6e3e2",
      "title": "《冊府元龜》卷四八八·邦計部·賦稅二（維基文庫頁面標為卷0438）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜/卷0438",
      "quote": "四年十二月邕管經略使唐弘實奏當管上供兩稅錢一千四百七十三貫文其見錢請每年附廣州綱送納敕宜委嶺南西道觀察使每年與受領回易輕貨附綱送省其僦運腳錢仍令數內抽折。",
      "claim": "開成四年十二月仍以邕管經略使上奏（距開局不到兩月）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜_卷0438.wiki"
    },
    {
      "id": "tang-70e40b130c",
      "title": "《舊唐書》卷十七下·文宗紀下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "以饒州刺史馬植為安南都護。",
      "claim": "開成元年九月以饒州刺史為安南都護",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-26e9c36f87",
      "title": "《太平廣記》卷一三八（出《本事詩》）",
      "url": "https://zh.wikisource.org/wiki/太平廣記/卷第138",
      "quote": "唐丞相馬植，罷安南都護。與時宰不通，又除黔南，殊不得意。",
      "claim": "罷安南後除黔南",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/太平廣記_卷第138.wiki"
    },
    {
      "id": "tang-65e5d3ff91",
      "title": "《資治通鑑》卷二四七",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷247",
      "quote": "安南經略使武渾役將士治城，將士作亂，燒城樓，劫府庫。",
      "claim": "安南後任武渾（會昌三年）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷247.wiki"
    },
    {
      "id": "tang-407875fcdc",
      "title": "《新唐書》卷二一〇·何進滔傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷210",
      "quote": "居魏十餘年，民安之。進累檢校司徒、同中書門下平章事。開成五年死，贈太傅，謚曰定。",
      "claim": "本傳",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷210.wiki"
    },
    {
      "id": "tang-b1217dd0ac",
      "title": "《資治通鑑》卷二四六·開成五年十月",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "魏博節度使何進滔薨，軍中推其子都知兵馬使重順知留後。",
      "claim": "開成五年十月死，子重順知留後",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-a67874301c",
      "title": "《舊唐書》卷一四二·王廷湊傳附子元逵",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷142",
      "quote": "廷湊卒，三軍推主軍事，請命於朝。乃起復檢校工部尚書、鎮州大都督府長史、成德軍節度使，累遷檢校左僕射。元逵素懷忠順，頓革父風。",
      "claim": "本傳",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷142.wiki"
    },
    {
      "id": "tang-84339632df",
      "title": "《舊唐書》卷十七下·文宗紀下·開成二年六月",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷17下",
      "quote": "丁酉，以成德軍節度使王元逵為駙馬都尉，尚壽安公主。",
      "claim": "開成二年尚壽安公主",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷17下.wiki"
    },
    {
      "id": "tang-17fa78ffc8",
      "title": "《舊唐書》卷一八〇·楊志誠傳附史元忠",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷180",
      "quote": "初，元忠既逐志誠，詔以通王淳遙領節度，授元忠左散騎常侍、幽州大都督府左司馬、知府事，充節度留後。明年，轉檢校工部尚書、節度副大使，知節度事。後為偏將陳行泰所殺。",
      "claim": "本傳",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷180.wiki"
    },
    {
      "id": "tang-bfacfbd30c",
      "title": "《新唐書》卷八·武宗紀·會昌元年九月",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷008",
      "quote": "九月癸巳，幽州盧龍軍將陳行泰殺其節度使史元忠，自稱知留務。",
      "claim": "會昌元年九月被殺",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷008.wiki"
    },
    {
      "id": "tang-a956cb6141",
      "title": "《新唐書》卷八·武宗紀·會昌三年四月",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷008",
      "quote": "四月乙丑，昭義軍節度使劉從諫卒，其子稹自稱留後。",
      "claim": "會昌三年四月卒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷008.wiki"
    },
    {
      "id": "tang-dd1eda53a1",
      "title": "《新唐書》卷四三上·地理志七上（嶺南道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043上",
      "quote": "瓊州瓊山郡，下都督府。貞觀五年以崖州之瓊山置。自乾封後沒山洞蠻，貞元五年，嶺南節度使李復討復之。",
      "claim": "琼州乾封后没山洞蛮",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043上.wiki"
    },
    {
      "id": "tang-fee27f5b8c",
      "title": "《舊唐書》卷四一·地理志四（嶺南道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷41",
      "quote": "瓊州本隸廣府管內，乾封年，山洞草賊反叛，遂茲淪陷，至今一百餘年。",
      "claim": "旧唐书：山洞草贼反叛，沦陷百余年",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷41.wiki"
    },
    {
      "id": "tang-10cb300a3d",
      "title": "《新唐書》卷四三上·地理志七上（嶺南道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043上",
      "quote": "瓊州瓊山郡，下都督府。貞觀五年以崖州之瓊山置。自乾封後沒山洞蠻，貞元五年，嶺南節度使李復討復之。土貢：金。戶六百四十九。",
      "claim": "琼州编户649户",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043上.wiki"
    },
    {
      "id": "tang-f502d68433",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "七年春正月戊寅朔。天皇御大極殿。受朝賀。",
      "claim": "开局前后天皇在京御大极殿、朝觐嵯峨院",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-47e077dac4",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "二月戊申朔己酉。天皇朝覲先太上天皇及太皇大后於嵯峨院。",
      "claim": "承和七年二月天皇朝觐嵯峨院（上皇居处在京西）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-a6b767ccbd",
      "title": "《續日本後紀》卷十二（承和九年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第十二",
      "quote": "仰左右京職警固街巷。亦令固山城國五道。",
      "claim": "承和九年警固京城，并固山城国五道（京城在山城国）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第十二.wiki"
    },
    {
      "id": "tang-570ddbde66",
      "title": "《新唐書》卷二二〇·東夷傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷220",
      "quote": "次諾樂立，次嵯峨，次浮和，次仁明。 仁明直開成四年，復入貢。",
      "claim": "唐人所记日本王系，仁明当开成四年",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷220.wiki"
    },
    {
      "id": "tang-3344c7e850",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "戊子。天皇不豫也。",
      "claim": "开局前三日（正月十一）天皇不豫；正月二十内宴罢",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-44add69ad1",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "從五位下御春朝臣濱主爲鎭守將軍。",
      "claim": "承和七年正月以御春滨主为镇守将军",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-26f8df5cf9",
      "title": "《日本後紀》卷二一（弘仁二年）",
      "url": "https://zh.wikisource.org/wiki/日本後紀/卷第廿一",
      "quote": "其志波城。近于河濱。屡被水害。須去其處。遷立便地。",
      "claim": "志波城因水害须迁",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/日本後紀_卷第廿一.wiki"
    },
    {
      "id": "tang-1414150bbb",
      "title": "《日本三代實錄》卷五十（仁和三年）",
      "url": "https://zh.wikisource.org/wiki/日本三代實錄/卷第五十",
      "quote": "国府在出羽郡井口地。即是、去延暦年中陸奥守従五位上小野朝臣岑守、拠大将軍従三位坂上大宿祢田村麻呂論奏、所建也。",
      "claim": "出羽国府在出羽郡井口，延历年间建",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/日本三代實錄_卷第五十.wiki"
    },
    {
      "id": "tang-646800bfb3",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "甲申。天皇御紫宸殿。垂珠簾。覽青馬。』詔授三品秀良親王二品。從三位藤原朝臣愛發正三位。",
      "claim": "正月七日藤原爱发叙正三位",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-4c88c5bbbb",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "參議從四位上文室朝臣秋津爲兼丹後守。春宮大夫右衛門督如故。",
      "claim": "参议文室秋津兼丹后守，春宫大夫右卫门督如故",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-15a3471fcf",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "辛酉。召流人小野篁。",
      "claim": "二月十四日召流人小野篁",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-6c7228ebfe",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "於是。中納言藤原朝臣吉野奏言。",
      "claim": "五月中纳言藤原吉野奏言",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-02b8f3b79a",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "中納言兼右近衛大將從三位橘朝臣氏公上表。",
      "claim": "中纳言兼右近卫大将橘氏公",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-523dc20c7f",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "壬寅。勅符陸奧守正五位下良峯朝臣木連。前鎭守將軍外從五位下匝瑳宿祢末守等。省今月十八日奏。知發援兵二千人。案奏状云。奧邑之民。共稱庚申。潰出之徒不能抑制。",
      "claim": "二月陆奥奥邑骚动，发援兵二千",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-df79b6bfe0",
      "title": "《續日本後紀》卷九（承和七年，即開成五年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第九",
      "quote": "大宰府言。藩外新羅臣張寳高。遣使献方物。即從鎭西追却焉。爲人臣無境外之交也。",
      "claim": "十二月张宝高遣使大宰府被却",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第九.wiki"
    },
    {
      "id": "tang-f52ba62ebb",
      "title": "《新唐書》卷二二〇·東夷傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷220",
      "quote": "龍朔初，有儋羅者，其王儒李都羅遣使入朝，國居新羅武州南島上，俗樸陋，衣大豕皮，夏居革屋，冬窟室。地生五穀，耕不知用牛，以鐵齒杷土。初附百濟。麟德中，酋長來朝，從帝至太山。後附新羅。",
      "claim": "国居新罗武州南岛上",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷220.wiki"
    },
    {
      "id": "tang-7f9068f1ca",
      "title": "《三國史記》卷十·新羅本紀（元聖王至神武王）",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷10",
      "quote": "武珍州進赤烏，牛頭州進白雉。冬十月，大寒，松竹皆死。耽羅國遣使朝貢。",
      "claim": "801年耽罗国遣使朝贡新罗（开成前最后一次记载，无名）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷10.wiki"
    },
    {
      "id": "tang-72d4e3aadb",
      "title": "《日本後紀》卷二一（弘仁二年）",
      "url": "https://zh.wikisource.org/wiki/日本後紀/卷第廿一",
      "quote": "去二月五日奏稱。請發陸奧出羽兩国兵合二万六千人。征尓薩體。幣伊二村者。",
      "claim": "弘仁二年征尔萨体、幣伊二村",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/日本後紀_卷第廿一.wiki"
    },
    {
      "id": "tang-1c7beaf980",
      "title": "《日本後紀》卷二一（弘仁二年）",
      "url": "https://zh.wikisource.org/wiki/日本後紀/卷第廿一",
      "quote": "邑良志閇村降俘吉弥侯部都留岐申云。己等與貳薩體村夷伊加古等。久搆仇怨。今伊加古等。練兵整衆。居都母村。誘幣伊村夷。將伐己等。",
      "claim": "弘仁二年（811）所见首领：尔萨体村夷伊加古、邑良志闭村降俘吉弥侯部都留岐（距开局29年）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/日本後紀_卷第廿一.wiki"
    },
    {
      "id": "tang-7dfbea604a",
      "title": "《新唐書》卷二二〇·東夷傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷220",
      "quote": "明年，使者與蝦蛦人偕朝。 蝦蛦亦居海島中",
      "claim": "新唐书作蝦蛦",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷220.wiki"
    },
    {
      "id": "tang-8a342d8f4e",
      "title": "《日本書紀》卷二六（齊明紀）",
      "url": "https://zh.wikisource.org/wiki/日本書紀/卷第廿六",
      "quote": "定渟代、津輕二郡郡領",
      "claim": "津轻郡",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/日本書紀_卷第廿六.wiki"
    },
    {
      "id": "tang-e4d048da3b",
      "title": "《日本書紀》卷二六（齊明紀）",
      "url": "https://zh.wikisource.org/wiki/日本書紀/卷第廿六",
      "quote": "津輕郡蝦夷一百二十人",
      "claim": "津轻郡蝦夷",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/日本書紀_卷第廿六.wiki"
    },
    {
      "id": "tang-a39c333306",
      "title": "《續日本紀》卷八（養老二年—五年）",
      "url": "https://zh.wikisource.org/wiki/續日本紀/卷第八",
      "quote": "乙亥。出羽并渡嶋蝦夷八十七人來。貢馬千疋。",
      "claim": "养老二年出羽并渡嶋蝦夷来贡马",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本紀_卷第八.wiki"
    },
    {
      "id": "tang-f4d1353bc0",
      "title": "《續日本紀》卷八（養老二年—五年）",
      "url": "https://zh.wikisource.org/wiki/續日本紀/卷第八",
      "quote": "丙子。遣渡嶋津輕津司從七位上諸君鞍男等六人於靺鞨國。觀其風俗。",
      "claim": "养老四年遣渡嶋津轻津司往靺鞨国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本紀_卷第八.wiki"
    },
    {
      "id": "tang-e5389d6648",
      "title": "《宋史》卷四八九·外國五·占城",
      "url": "https://zh.wikisource.org/wiki/宋史/卷489",
      "quote": "東去麻逸國二日程",
      "claim": "宋史：占城东去麻逸国二日程",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/宋史_卷489.wiki"
    },
    {
      "id": "tang-49e244ff49",
      "title": "英文维基百科 Laguna Copperplate Inscription（二手）",
      "url": "https://en.wikipedia.org/wiki/Laguna_Copperplate_Inscription",
      "quote": "the Chief and Commander of Tundun",
      "claim": "拉古纳铜版铭文（Śaka 822年=900年）提到 Tundun 等地首领（维基百科转录 Postma 1992 释文，二手）",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Laguna_Copperplate_Inscription.wiki"
    },
    {
      "id": "tang-fce2a6ecbe",
      "title": "《唐會要》卷九五",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷095",
      "quote": "開成元年，其王子金義琮來謝恩，兼宿衞。二年四月十一日，放還蕃，賜物有差。五年四月，鴻臚寺奏新羅國告哀，其質子及年滿合歸國學生等共一百五人，並放還。",
      "claim": "开成五年四月新罗告哀使方至唐",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷095.wiki"
    },
    {
      "id": "tang-5ca7c74400",
      "title": "《三國史記》卷三四·雜志·地理一",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷34",
      "quote": "始與高句麗百濟地錯犬牙，或相和親，或相寇鈔，後與大唐侵滅二邦，平其土地，遂置九州，本國界內置三州，王城東北當唐恩浦路曰尙州，王城南曰良州，西曰康州，於故百濟國界置三州，百濟故城北熊津口曰熊州，次西南曰全州，次南曰武州，於故高句麗南界置二州，從西第一曰漢州，次東曰朔州，又次東曰溟州，九州所管郡縣，無慮四百五十",
      "claim": "新罗平丽济后置九州，九州所管郡县约四百五十",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷34.txt"
    },
    {
      "id": "tang-8131388ea6",
      "title": "《三國遺事》卷一·紀異·辰韓",
      "url": "https://zh.wikisource.org/wiki/三國遺事/卷第一",
      "quote": "新羅全盛之時。京中十七萬八千九百三十六戶一千三百六十坊五十五里三十五金入宅",
      "claim": "三国遗事称“京中”",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國遺事_卷第一.txt"
    },
    {
      "id": "tang-b496f02ff9",
      "title": "《續日本後紀》卷十一（承和九年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第十一",
      "quote": "新羅人李少貞等・人到筑紫大津。大宰府遣使問來由。頭首少貞申云。張寳高死。其副將李昌珍等欲叛亂。武珍州列賀閻丈興兵討平。今已無虞。",
      "claim": "承和九年（842）日方记录称“武珍州”",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第十一.wiki"
    },
    {
      "id": "tang-a90cb63b5b",
      "title": "《三國史記》卷十一·新羅本紀（文聖王）",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷11",
      "quote": "二年，春正月，以禮徵爲上大等，義琮爲侍中，良順爲伊飡。",
      "claim": "840年正月礼徵为上大等、良顺为伊飡",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷11.wiki"
    },
    {
      "id": "tang-d235bf2a6e",
      "title": "《三國史記》卷十一·新羅本紀（文聖王）",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷11",
      "quote": "八年，春，淸海弓福，怨王不納女，據鎭叛。朝廷將討之，則恐有不測之患，將置之，則罪不可赦，憂慮不知所圖。武州人閻長者，以勇壯聞於時，來告曰：「朝廷幸聽臣，臣不煩一卒，持空拳，以斬弓福以獻。」王從之。閻長佯叛國，投淸海。弓福愛壯士，無所猜疑，引爲上客，與之飮極歡。及其醉，奪弓福劒斬訖，召其衆說之，伏不敢動。",
      "claim": "阎长为武州人，刺杀张保皐",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷11.wiki"
    },
    {
      "id": "tang-088f54a460",
      "title": "《三國史記》卷十·新羅本紀（元聖王至神武王）",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷10",
      "quote": "四年，春二月，以唐恩郡爲唐城鎭，以沙飡極正往守之。",
      "claim": "唐城镇（829）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷10.wiki"
    },
    {
      "id": "tang-c9ec418726",
      "title": "《三國史記》卷九·新羅本紀（景德王至宣德王）",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷09",
      "quote": "二月，王巡幸漢山州，移民戸於浿江鎭。",
      "claim": "浿江镇（782）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷09.wiki"
    },
    {
      "id": "tang-45105f2ec9",
      "title": "《三國史記》卷三五·雜志·地理二",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷35",
      "quote": "取城郡，本高句麗冬忽，憲德王改名，今黃州，領縣三，土山縣，本高句麗息達，憲德王改名，今因之，唐嶽縣，本高句麗加火押，憲德王置縣改名，今中和縣，松峴縣，本高句麗夫斯波衣縣，憲德王改名，今屬中和縣",
      "claim": "宪德王置取城郡、唐岳县",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷35.wiki"
    },
    {
      "id": "tang-24566c2a89",
      "title": "《三國史記》卷三五·雜志·地理二",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷35",
      "quote": "井泉郡，本高句麗泉井郡，文武王二十一年取之，景德王改名，築炭項闕門，今湧州",
      "claim": "井泉郡（泉井郡）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷35.wiki"
    },
    {
      "id": "tang-2de2b390b4",
      "title": "《三國史記》卷三七·雜志·地理四",
      "url": "https://zh.wikisource.org/wiki/三國史記/卷37",
      "quote": "賈耽古今郡國志云，渤海國南海鴨淥扶餘柵城四府，並是高句麗舊地也，自新羅泉井郡至柵城府，凡三十九驛",
      "claim": "贾耽：自泉井郡至栅城府三十九驿",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/三國史記_卷37.wiki"
    },
    {
      "id": "tang-2c1e587837",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "天寶末，欽茂徙上京，直舊國三百里忽汗河之東。訖帝世，朝獻者二十九。寶應元年，詔以渤海爲國，欽茂王之，進檢校太尉。大曆中，二十五來，以日本舞女十一獻諸朝。貞元時，東南徙東京。欽茂死，私諡文王。子宏臨早死，族弟元義立一歲，猜虐，國人殺之。推宏臨子華璵爲王，復還上京，改年中興。",
      "claim": "钦茂徙上京，华屿复还上京",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-d464867796",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "自都護府東北經古蓋牟、新城，又經渤海長嶺府，千五百里至渤海王城，城臨忽汗海，其西南三十里有古肅慎城，其北經德理鎮，至南黑水靺鞨千里。",
      "claim": "渤海王城临忽汗海",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-7f7ac7c2fa",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "五年，大仁秀卒，以權知國務大彝震爲銀青光祿大夫、檢校秘書監、都督、渤海國王。六年，遣王子大明俊等來朝。七年正月，遣同中書右平章事高寶英來謝冊命，仍遣學生三人，隨寶英請赴上都學問。先遣學生三人，事業稍成，請歸本國，許之。二月，王子大先晟等六人來朝。開成後，亦修職貢不絕。",
      "claim": "大和五年册为渤海国王",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-12d4f2ff3d",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "從父仁秀立，改年建興，其四世祖野勃，祚榮弟也。仁秀頗能討伐海北諸部，開大境宇，有功，詔檢校司空、襲王。元和中，凡十六朝獻，長慶四，寶曆凡再。大和四年，仁秀死，諡宣王。子新德蚤死，孫彝震立，改年鹹和。明年，詔襲爵。終文宗世來朝十二，會昌凡四。彝震死，弟虔晃立。",
      "claim": "仁秀孙彝震立，改年咸和",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-f68296e20b",
      "title": "《續日本後紀》卷十一（承和九年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第十一",
      "quote": "即此彜震蒙恩。",
      "claim": "承和九年渤海国书自称彝震",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第十一.wiki"
    },
    {
      "id": "tang-f7e93cfbd5",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "祚榮即並比羽之衆，恃荒遠，乃建國，自號震國王，遣使交突厥，地方五千里，戶十余萬，勝兵數萬。",
      "claim": "建国初户十余万",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-3482e3b9b0",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "越熹靺鞨東北至黑水靺鞨，地方二千里，編戶十余萬，勝兵數萬人。",
      "claim": "旧唐书同",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-1f642bf69f",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "今我衆比高麗三之一",
      "claim": "大门艺语",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-c447a31c86",
      "title": "《舊唐書》卷一九九上·東夷傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199上",
      "quote": "高麗國舊分爲五部，有城百七十六，戶六十九萬七千",
      "claim": "高丽亡时户数",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199上.wiki"
    },
    {
      "id": "tang-5d7353ce7d",
      "title": "《冊府元龜》卷九七二·外臣部·朝貢五（四庫全書本）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜_(四庫全書本)/卷0972",
      "quote": "十二月戊辰渤海王子大延廣契丹首領薩葛奚大首領温訥骨室韋大都督秩䖝等朝貢",
      "claim": "开成四年十二月渤海王子大延广朝贡",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜 (四庫全書本)_卷0972.wiki"
    },
    {
      "id": "tang-8abb70cf5d",
      "title": "《冊府元龜》卷九七六·外臣部·褒異三（四庫全書本）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜_(四庫全書本)/卷0976",
      "quote": "二年正月癸巳上御麟徳殿對賀正南詔洪龍軍三十人渤海王子大明俊等一十九人宴賜有差",
      "claim": "开成二年正月渤海王子大明俊",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜 (四庫全書本)_卷0976.wiki"
    },
    {
      "id": "tang-f8176a3298",
      "title": "《續日本後紀》卷十一（承和九年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第十一",
      "quote": "渤海國中臺省牒日本國太政官。應差入覲貴國使政堂省左允賀福延并行從一百五人。",
      "claim": "承和九年渤海国中台省牒：政堂省左允贺福延",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第十一.wiki"
    },
    {
      "id": "tang-c9b87597ef",
      "title": "《續日本後紀》卷十一（承和九年）",
      "url": "https://zh.wikisource.org/wiki/續日本後紀/卷第十一",
      "quote": "詔授大使賀福延正三位。副使王寳璋正四位下。判官高文暄。烏孝愼二人並正五位下。録事高文宣。高平信。安歡喜三人並從五位下。",
      "claim": "承和九年渤海使团名单",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/續日本後紀_卷第十一.wiki"
    },
    {
      "id": "tang-df7ebe26c9",
      "title": "《遼史》卷三八·地理志二（東京道）",
      "url": "https://zh.wikisource.org/wiki/遼史/卷38",
      "quote": "十有二世至彝震，僭號改元，擬建宮闕，有五京、十五府、六十二州，爲遼東盛國。",
      "claim": "辽史：彝震时五京十五府六十二州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/遼史_卷38.wiki"
    },
    {
      "id": "tang-061998b629",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "唯黑水完強，分十六落，以南北稱",
      "claim": "分十六落，以南北称",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-0c75e93b27",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "後渤海盛，靺鞨皆役屬之，不復與王會矣。",
      "claim": "渤海盛，靺鞨皆役属之",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-6333e56a0d",
      "title": "《唐會要》卷九六",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷096",
      "quote": "及渤海浸強，黑水亦爲其所屬。",
      "claim": "唐会要：渤海浸强，黑水亦为其所属",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷096.wiki"
    },
    {
      "id": "tang-10b710d89c",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "大曆世凡七，貞元一來，元和中再。",
      "claim": "最后入唐记录在元和",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-80034f6604",
      "title": "《唐會要》卷九六",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷096",
      "quote": "十年二月，黑水酋長十一人朝貢。",
      "claim": "元和十年黑水酋长十一人朝贡（无名）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷096.wiki"
    },
    {
      "id": "tang-c14fe59077",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "初，黑水西北又有思慕部，益北行十日得郡利部，東北行十日得窟說部，亦號屈設，稍東南行十日得莫曳皆部，又有拂涅、虞婁、越喜、鐵利等部。其地南距渤海，北、東際於海，西抵室韋，南北袤二千里，東西千里。拂涅、鐵利、虞婁、越喜時時通中國，而郡利，屈設、莫曳皆不能自通。",
      "claim": "思慕、郡利、窟说（屈设）、莫曳皆诸部",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-20b672efb1",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "其北大山之北有大室韋部落，其部落傍望建河居。其河源出突厥東北界俱輪泊，屈曲東流，經西室韋界，又東經大室韋界，又東經蒙兀室韋之北，落俎室韋之南，又東流與那河、忽汗河合，又東經南黑水靺鞨之北，北黑水靺鞨之南，東流注於海。",
      "claim": "南、北黑水",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-914db0c885",
      "title": "《新唐書》卷二二〇·東夷傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷220",
      "quote": "開元十一年，又有達末婁、達妒二部首領朝貢。達末婁自言北扶餘之裔，高麗滅其國，遺人度那河，因居之，或曰他漏河，東北流入黑水。達姤，室韋種也，在那河陰，凍末河之東，西接黃頭室韋，東北距達末婁云。",
      "claim": "达姤为室韦种，在那河阴",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷220.wiki"
    },
    {
      "id": "tang-2bea18dd8b",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "其國無君長，惟大酋，皆號「莫賀咄」，攝筦其部而附於突厥。小或千戶，大數千戶，濱散川穀，逐水草而處，不稅斂。每弋獵即相嘯聚，事畢去，不相臣制，故雖猛悍喜戰，而卒不能爲強國。",
      "claim": "其国无君长",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-4781c5a984",
      "title": "《唐會要》卷九六",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷096",
      "quote": "大和五年至八年，凡三遣使來朝貢。九年十二月，室韋大都督阿朱等三十人來朝貢。 開成元年十二月，室韋大都督阿朱等來朝，進馬五十匹。四年正月，上御麟德殿，對入朝賀正室韋阿朱等十五人。其年十二月，室韋大都督祑虫等三十人來朝貢。",
      "claim": "唐会要：阿朱（835—839年正月）、祑虫（839年十二月）为室韦大都督",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷096.wiki"
    },
    {
      "id": "tang-f17e6f59e8",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "九年十二月，室韋大都督阿成等三十人來朝。",
      "claim": "旧唐书作“阿成”",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-9652a52c4b",
      "title": "《唐會要》卷九六",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷096",
      "quote": "會昌二年十二月，上御麟德殿，引見室韋大首領都督熱論等十五人",
      "claim": "会昌二年室韦大首领都督热论",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷096.wiki"
    },
    {
      "id": "tang-a32bca192f",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "分部凡二十餘：曰嶺西部、山北部、黃頭部，強部也；大如者部、小如者部、婆萵部、訥北部、駱丹部，悉處柳城東北，近者三千，遠六千里而贏；最西有烏素固部，與回紇接，當俱倫泊之西南；自泊而東有移塞沒部；稍東有塞曷支部，最強部也，居啜河之陰，亦曰燕支河；益東有和解部、烏羅護部、那禮部、嶺西部；直北曰訥比支部，北有大山，山外曰大室韋，瀕於室建河，河出俱倫，迆而東；河南有蒙瓦部，其北落坦部；水東合那河、忽汗河，又東貫黑水靺鞨，故靺鞨跨水有南北部，而東注於海。峱越河東南亦與那河合，其北有東室韋，蓋烏丸東南鄙餘人也。",
      "claim": "二十余部",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-d7877a4d8d",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "其國西抵大洛泊，距回紇牙三千里，多依土護真水。其馬善登，其羊黑。盛夏必徙保冷陘山，山直媯州西北。",
      "claim": "牙帐与夏徙",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-951343616c",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "大和四年，復盜邊，廬龍李載義破之，執大將二百余人，縛其帥茹羯來獻，文宗賜冠帶，授右驍衛將軍。後五年，大首領匿舍朗來朝。",
      "claim": "大和九年大首领匿舍朗来朝；大和四年其帅茹羯被擒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-fa6fcdf48c",
      "title": "《冊府元龜》卷九七二·外臣部·朝貢五（四庫全書本）",
      "url": "https://zh.wikisource.org/wiki/冊府元龜_(四庫全書本)/卷0972",
      "quote": "九年十二月契丹大首領介落等一十九人室韋大勝督阿成等三十人奚大首領匿舍朗等並三十人來朝",
      "claim": "冊府元龟：大和九年十二月奚大首领匿舍朗等三十人来朝",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜 (四庫全書本)_卷0972.wiki"
    },
    {
      "id": "tang-728645753f",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "以阿會部爲弱水州，處和部爲祁黎州，奧失部爲洛瑰州，度稽部爲太魯州，元俟折部爲渴野州，各以酋領辱紇主爲刺史，隸饒樂府。",
      "claim": "五部名",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-7311a4d641",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "勝兵三萬餘人，分爲五部，每部置俟斤一人。",
      "claim": "胜兵三万余，五部",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-cbd2ac2e05",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "後七年，幽州殘其衆六萬。",
      "claim": "贞元七年幽州残其众六万",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-c4e92953f3",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "十一年，遣使獻名馬。爾後每歲朝貢不絕，或歲中二三至。",
      "claim": "元和后每岁朝贡",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-b815f177ac",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "天寶十年，安祿山誣其酋長欲叛，請舉兵討之。八月，以幽州、雲中、平盧之衆數萬人，就潢水南契丹衙與之戰，祿山大敗而還，死者數千人。",
      "claim": "天宝十年唐军“就潢水南契丹衙”",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-c1ed55b70e",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "契丹，居潢水之南，黃龍之北，鮮卑之故地，在京城東北五千三百里。東與高麗鄰，西與奚國接，南至營州，北至室韋。冷陘山在其國南，與奚西山相崎，地方二千里。",
      "claim": "契丹居潢水之南，黄龙之北",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-e43c5f40df",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "營州西北百里曰松陘嶺，其西奚，其東契丹。距營州北四百里至湟水。",
      "claim": "营州北四百里至湟水，松陉岭东为契丹",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-9979ea9b63",
      "title": "《唐會要》卷九六",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷096",
      "quote": "會昌二年九月，制︰「契丹新立王屈戍可雲麾將軍、守右武衞將軍員外置同正員。」幽州節度使張仲武奏︰「契丹新立王屈戍等云︰『契丹舊用迴鶻印，今懇請當道聞奏，乞國家賜印。』伏望聖慈允許。」勅旨︰「宜依，仍以『奉國契丹之印』爲文。」",
      "claim": "会昌二年（842）九月“契丹新立王屈戍”——“新立”表明屈戍在位始于开局之后或前不久，开局日在位者无记载",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷096.wiki"
    },
    {
      "id": "tang-ca80b64054",
      "title": "《遼史》卷六三·世表",
      "url": "https://zh.wikisource.org/wiki/遼史/卷63",
      "quote": "契丹王屈戍，武宗會昌二年授雲麾將軍，是為耶瀾可汗。",
      "claim": "辽史以屈戍为耶澜可汗",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/遼史_卷63.wiki"
    },
    {
      "id": "tang-030c1bdebe",
      "title": "《遼史》卷六三·世表",
      "url": "https://zh.wikisource.org/wiki/遼史/卷63",
      "quote": "自祿山反，河北割據，道隔不通，世次不可悉考。",
      "claim": "辽史：安史乱后世次不可悉考",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/遼史_卷63.wiki"
    },
    {
      "id": "tang-2a7c7c6666",
      "title": "《唐會要》卷九六",
      "url": "https://zh.wikisource.org/wiki/唐會要/卷096",
      "quote": "大和九年十一月，契丹大首領二十九人來朝，賜物各有差。 開成元年十一月，契丹大首領涅列壞等三十一人來朝。四年十二月，契丹大首領薛葛等三十人來朝。",
      "claim": "开成间入朝大首领：涅列坏（836）、薛葛（839年十二月）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷096.wiki"
    },
    {
      "id": "tang-89b5476516",
      "title": "《遼史》卷三二·營衛志中·部族上",
      "url": "https://zh.wikisource.org/wiki/遼史/卷32",
      "quote": "遙輦氏八部：旦利皆部。乙室活部。實活部。納尾部。頻沒部。納會雞部。集解部。奚嗢部。",
      "claim": "遥辇氏八部",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/遼史_卷32.wiki"
    },
    {
      "id": "tang-175a0b608b",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "契丹，本東胡種，其先爲匈奴所破，保鮮卑山。魏青龍中，部酋比能稍桀驁，爲幽州刺史王雄所殺，衆遂微，逃潢水之南，黃龍之北。至元魏，自號曰契丹。地直京師東北五千里而贏，東距高麗，西奚，南營州，北靺鞨、室韋，阻冷陘山以自固。",
      "claim": "契丹居潢水之南",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-48431c34a4",
      "title": "《舊唐書》卷一九九下·北狄傳",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷199下",
      "quote": "其君長姓大賀氏。勝兵四萬三千人，分爲八部",
      "claim": "胜兵四万三千，八部",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷199下.wiki"
    },
    {
      "id": "tang-4ebffaa8f0",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "其君大賀氏，有勝兵四萬，析八部",
      "claim": "新唐书作胜兵四万",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-2d8d588381",
      "title": "《新唐書》卷二一九·北狄傳",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "至德、寶應時再朝獻，大曆中十三，貞元間三，元和中七，大和、開成間凡四。然天子惡其外附回鶻，不復官爵渠長。會昌二年，回鶻破，契丹酋屈戍始復內附，拜雲麾將軍、守右武衛將軍。於是幽州節度使張仲武爲易回鶻所與舊印，賜唐新印，曰「奉國契丹之印」。",
      "claim": "大和、开成间凡四朝献；天子恶其外附回鹘",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-e80776e604",
      "title": "《資治通鑑》卷二四六（開成五年）",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "回鶻別將句録莫賀引黠戛斯十萬騎攻回鶻，大破之，殺馺及掘羅勿，焚其牙帳蕩盡，回鶻諸部逃散。",
      "claim": "开成五年黠戛斯大破回鹘，回鹘诸部逃散",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-d39ec04fa7",
      "title": "《舊唐書》卷一九六上·吐蕃上",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷196上",
      "quote": "其國都城號為邏些城",
      "claim": "国都号逻些城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷196上.wiki"
    },
    {
      "id": "tang-9f43ed6756",
      "title": "《新唐書》卷二一六上·吐蕃上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216上",
      "quote": "其贊普居跋布川，或邏娑川，有城郭廬舍不肯處，聯毳帳以居，號大拂廬",
      "claim": "赞普居跋布川或逻娑川，以大拂庐为帐",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216上.wiki"
    },
    {
      "id": "tang-da1bf17419",
      "title": "《舊唐書》卷一九六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷196下",
      "quote": "元鼎初見贊普於悶懼盧川，蓋贊普夏衙之所，其川在邏娑川南百里",
      "claim": "赞普夏衙在逻娑川南百里",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷196下.wiki"
    },
    {
      "id": "tang-4ea65412f8",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "是歳，吐蕃彝泰贊普卒，弟達磨立。彝泰多病，委政大臣，由是僅能自守，久不爲邊患。達磨荒淫殘虐，國人不附，災異相繼，吐蕃益衰。",
      "claim": "开成三年彝泰赞普卒，弟达磨立",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-4771c5b70c",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "開成四年，遣太子詹事李景儒往使，吐蕃以論集熱來朝，獻玉器羊馬",
      "claim": "开成四年唐使至吐蕃，吐蕃遣论集热来朝",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-799acd0e3a",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "丁卯，吐蕃遣其臣論普熱來告達磨贊普之喪",
      "claim": "会昌二年吐蕃告达磨赞普之丧",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-514ed32130",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "字面意思是“中翼之如”，治所在逻些小昭寺",
      "claim": "伍如治逻些",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-024c34f1c8",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "字面意思是“左翼之如”，治所在雅隆昌珠",
      "claim": "约如治雅隆昌珠",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-7d52425e34",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "治所在雅隆昌珠",
      "claim": "约如治雅隆昌珠",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-6294083da8",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "辖区包括今山南市、林芝市的大部分地区和拉萨市的小部分地区",
      "claim": "约如辖今山南、林芝大部",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-ee461636b4",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "字面意思是“右翼之如”，治所在香之雄巴园",
      "claim": "叶如治香之雄巴园",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-10fe03e1a3",
      "title": "《新唐書》卷二一六上·吐蕃上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216上",
      "quote": "盡臣羊同、党項諸羌",
      "claim": "羊同为吐蕃所臣",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216上.wiki"
    },
    {
      "id": "tang-d397539b04",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "字面意思是“支翼之如”，又名藏如拉",
      "claim": "如拉又称藏如拉",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-2453f84ec8",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "字面意思是“右翼之如”",
      "claim": "叶如",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-3b0135a799",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "直大羊同國",
      "claim": "紫山直大羊同国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-75baf88a39",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "與青海節度使同盟舉兵",
      "claim": "会昌二年论恐热与青海节度使同盟举兵",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-8f63c7ebb4",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "蘇毗，本西羌族，為吐蕃所並，號孫波，在諸部最大。東與多彌接，西距鶻莽硤，戶三萬",
      "claim": "苏毗号孙波，户三万",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-ae6a18d0df",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "多彌，亦西羌族，役屬吐蕃，號難磨。濱犁牛河，土多黃金",
      "claim": "多弥号难磨，濒犁牛河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-043a01e397",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "又称难磨、多弥，位于牦牛河（今通天河）流域",
      "claim": "南如即难磨、多弥，位于通天河流域",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-b9b8350ad0",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "其種散居西山、弱水，雖自謂王，蓋小小部落耳。自失河、隴，悉為吐蕃羈屬",
      "claim": "西山诸部失河陇后为吐蕃羁属",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-1e125f0f27",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "然陰附吐蕃，故謂「兩面羌」",
      "claim": "号称两面羌",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-c1fb6078a7",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "合蘇毗、吐渾、羊同兵八萬保洮河自守",
      "claim": "会昌二年尚思罗调发吐浑兵",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-ba2cd8074b",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "號孫波，在諸部最大",
      "claim": "苏毗号孙波",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-d675022bd4",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "而贊磨代之，為東面節度使，專河、隴",
      "claim": "吐蕃东面节度使专河陇",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-b8a8dc58bb",
      "title": "《舊唐書》卷一九六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷196下",
      "quote": "宰相尚恐熱殺東道節度使，以秦、原、安樂等三州並石門、木硤等七關款塞",
      "claim": "大中三年尚恐热杀东道节度使，以秦原安乐三州款塞",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷196下.wiki"
    },
    {
      "id": "tang-4bb426efad",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "別將尚恐熱為落門川討擊使",
      "claim": "论恐热为落门川讨击使（会昌二年的记载）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-dbea707f8d",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "議還悉怛謀，歸其城。吐蕃夷誅無遺種，以怖諸戎",
      "claim": "维州降唐后又交还吐蕃",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-ab69bcaddc",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "虜號無憂城，為西南要捍",
      "claim": "吐蕃号维州为无忧城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-1a9dfb4c51",
      "title": "《舊唐書》卷四一·地理志四（劍南道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷41",
      "quote": "至大中末，杜忭鎮蜀，維州首領內附，方復隸西川",
      "claim": "大中末维州复隶西川",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷41.wiki"
    },
    {
      "id": "tang-2d4bf11cd7",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "鳳翔收秦州",
      "claim": "大中三年凤翔收秦州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-eaeeec9547",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "恐熱遂屠渭州",
      "claim": "论恐热屠渭州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-7ea2760bbf",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "蘭州地皆杭稻，桃、李、榆柳岑蔚，戶皆唐人",
      "claim": "刘元鼎见兰州户皆唐人",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-f56affef1a",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "擊鄯州節度使尚婢婢",
      "claim": "鄯州节度使尚婢婢",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-e8b403a3a7",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "涇原節度使康季榮復原州",
      "claim": "大中三年原州复",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-796be55b4f",
      "title": "《冊府元龜》（四庫全書本）卷九八〇·外臣部·通好",
      "url": "https://zh.wikisource.org/wiki/冊府元龜_(四庫全書本)/卷0980",
      "quote": "天徳奏吐蕃東北道元帥論夷加羌使信物乃木夾到本道以其書信上聞",
      "claim": "开成二年天德奏吐蕃东北道元帅论夷加羌",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜 (四庫全書本)_卷0980.wiki"
    },
    {
      "id": "tang-f0331a2282",
      "title": "《新唐書》卷八·宣宗紀",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷008",
      "quote": "沙州人張義潮以瓜、沙、伊、肅、鄯、甘、河、西、蘭、岷、廓十一州歸于有司",
      "claim": "大中五年张议潮以十一州归唐",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷008.wiki"
    },
    {
      "id": "tang-408b66ef88",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "義潮奉涼州來歸",
      "claim": "咸通二年义潮奉凉州来归",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-ad676cd7c1",
      "title": "《新唐書》卷二一六下·吐蕃下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216下",
      "quote": "州人皆胡服臣虜，每歲時祀父祖，衣中國之服，號慟而藏之",
      "claim": "沙州降吐蕃后，州人胡服臣虏",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216下.wiki"
    },
    {
      "id": "tang-7b3e3b441e",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "王姓尉遲氏",
      "claim": "于阗王姓尉迟",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-8279c23c36",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "五百里至播仙鎮，故且末城也，高宗上元中更名",
      "claim": "播仙镇即且末故城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-a77bb620cb",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "石城鎮，漢樓蘭國也，亦名鄯善",
      "claim": "石城镇即鄯善",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-a1911a3809",
      "title": "《新唐書》卷四〇·地理志四（隴右道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷040",
      "quote": "本隸庭州，後來屬。西有七屯城",
      "claim": "西州蒲昌县",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷040.wiki"
    },
    {
      "id": "tang-658812a15e",
      "title": "《資治通鑑》卷二五〇·唐紀六十六",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷250",
      "quote": "北庭回鶻固俊克西州",
      "claim": "咸通七年仆固俊克西州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷250.wiki"
    },
    {
      "id": "tang-d3a561b28a",
      "title": "《舊唐書》卷三八·地理志一",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷38",
      "quote": "永泰之後，河朔、隴西，淪於寇盜。元和掌計之臣，嘗為版簿，二方不進戶口，莫可詳知",
      "claim": "永泰以后陇西不进户口，元和版簿缺",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷38.wiki"
    },
    {
      "id": "tang-0a4402ad7d",
      "title": "《舊唐書》卷四〇·地理志三（隴右道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷40",
      "quote": "天寶領縣五，戶二萬四千八百二十七，口十萬九千七百",
      "claim": "秦州天宝户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷40.wiki"
    },
    {
      "id": "tang-91e41b954b",
      "title": "《舊唐書》卷四〇·地理志三（隴右道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷40",
      "quote": "天寶領縣二，戶二千八百八十九，口一萬四千二百二十六",
      "claim": "兰州天宝户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷40.wiki"
    },
    {
      "id": "tang-d983f2bec6",
      "title": "《舊唐書》卷四〇·地理志三（隴右道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷40",
      "quote": "天寶領縣五，戶二萬二千四百六十二，口十二萬二百八十一",
      "claim": "凉州天宝户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷40.wiki"
    },
    {
      "id": "tang-d75f3ecf37",
      "title": "《舊唐書》卷四〇·地理志三（隴右道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷40",
      "quote": "舊領縣二，戶四千二百六十五，口一萬六千二百五十",
      "claim": "沙州户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷40.wiki"
    },
    {
      "id": "tang-d487bb9004",
      "title": "《舊唐書》卷四一·地理志四（劍南道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷41",
      "quote": "天寶領縣二。戶二千一百七十九，口三千一百九十八",
      "claim": "维州天宝户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷41.wiki"
    },
    {
      "id": "tang-85ad24c658",
      "title": "《新唐書》卷二一六上·吐蕃上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷216上",
      "quote": "勝兵數十萬",
      "claim": "吐蕃胜兵数十万",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷216上.wiki"
    },
    {
      "id": "tang-0e063cbafd",
      "title": "中文維基百科「如（吐蕃行政區）」（二手，所據為《賢者喜宴》等藏文史料及今人研究）",
      "url": "https://zh.wikipedia.org/wiki/如",
      "quote": "总人口74万",
      "claim": "伍如人口（贤者喜宴，二手）",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/wp-如.wiki"
    },
    {
      "id": "tang-e58fe930aa",
      "title": "《新唐書》卷二一七上·回鶻上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217上",
      "quote": "南居突厥故地，徙牙烏德山、昆河之間",
      "claim": "回鹘牙帐在乌德鞬山与昆（嗢昆）河之间",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217上.wiki"
    },
    {
      "id": "tang-b975b48984",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "東有平野，西據烏德鞬山，南依嗢昆水，北六七百里至仙娥河，河北岸有富貴城",
      "claim": "唐人道里记牙帐四至：西据乌德鞬山，南依嗢昆水，北六七百里至仙娥河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-6c4617136e",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "將徙就合羅川，居回鶻故國",
      "claim": "会昌二年黠戛斯称将移居合罗川，即回鹘故国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-08a479f3e6",
      "title": "《新唐書》卷二一七上·回鶻上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217上",
      "quote": "又請易回紇曰回鶻，言捷鷙猶鶻然",
      "claim": "回鹘之名出自贞元年间回纥自请改称",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217上.wiki"
    },
    {
      "id": "tang-8ed618b5f5",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "回鶻相安允合、特勒柴革謀作亂，彰信可汗殺之。相掘羅勿將兵在外，以馬三百賂沙陀朱邪赤心，借其兵共攻可汗。可汗兵敗，自殺，國人立馺特勒爲可汗。",
      "claim": "开成四年彰信可汗兵败自杀，国人立𠸄馺特勒（维基文库本《通鉴》此处脱去首字）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-b92373218e",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "開成四年，其相掘羅勿作難，引沙陀共攻可汗，可汗自殺，國人立{廠盍}馺特勒為可汗。方歲饑，遂疫，又大雪，羊、馬多死，未及命。",
      "claim": "《新唐书》记同事，并言唐“未及命”，首字录作{廠盍}",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-9ae5374e51",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "回鶻別將句録莫賀引黠戛斯十萬騎攻回鶻，大破之，殺馺及掘羅勿，焚其牙帳蕩盡，回鶻諸部逃散",
      "claim": "开成五年（开局之后）句录莫贺引黠戛斯破牙帐，杀𠸄馺与掘罗勿",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-63f29f7420",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "東有平野，西據烏德鞬山，南依嗢昆水",
      "claim": "牙帐四至",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-dca2be1bd0",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "七百里至回鶻衙帳",
      "claim": "中受降城至回鹘衙帐道里",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-c62936b088",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "烏德鞬山左右嗢昆河、獨邏河皆屈曲東北流，至衙帳東北五百里合流",
      "claim": "嗢昆河、独逻河于牙帐东北合流",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-e93b8de884",
      "title": "《新唐書》卷二一七上·回鶻上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217上",
      "quote": "樹牙獨樂水上",
      "claim": "回纥早期树牙独乐水上",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217上.wiki"
    },
    {
      "id": "tang-820dc5eee5",
      "title": "《新唐書》卷四〇·地理志四（隴右道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷040",
      "quote": "軍東北有居延海，又北三百里有花門山堡，又東北千里至迴鶻衙帳",
      "claim": "甘州删丹县条：宁寇军东北有居延海，再北三百里花门山堡，再东北千里至回鹘衙帐",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷040.wiki"
    },
    {
      "id": "tang-ef2fdbdca4",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又五百里至鷿鵜泉，又十里入磧，經麚鹿山、鹿耳山、錯甲山，八百里至山鷰子井",
      "claim": "中受降城北入碛，经八百里碛路才到山燕子井，说明这一带是大碛",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-6c7f57c176",
      "title": "《新唐書》卷二一九·北狄（契丹、室韋、黑水靺鞨、渤海）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "最西有烏素固部，與回紇接，當俱倫泊之西南",
      "claim": "室韦最西的乌素固部与回纥相接",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-449079e8c1",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "西據烏德鞬山",
      "claim": "唐代道里写作乌德鞬山",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-6b819caebc",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "回紇、拔野古、阿跌、同羅、仆骨、白霫在郁督軍山者",
      "claim": "另一译名郁督军山",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-06fd71fc33",
      "title": "《舊唐書》卷四〇·地理志三（隴右道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷40",
      "quote": "北庭都護府。自永徽至天寶，北庭節度使管鎮兵二萬人",
      "claim": "北庭都护府（庭州）为唐北庭节度所在",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷40.wiki"
    },
    {
      "id": "tang-5fe95551f8",
      "title": "《舊唐書》卷一九五·回紇",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷195",
      "quote": "以一萬騎出北庭，一萬騎出安西，拓吐蕃以迎太和公主歸國",
      "claim": "长庆元年回鹘自北庭、安西出兵迎公主",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷195.wiki"
    },
    {
      "id": "tang-3c6f22811a",
      "title": "《資治通鑑》卷二五〇·唐紀六十六",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷250",
      "quote": "歸義節度使張義潮奏北庭回鶻固俊克西州、北庭、輪台、清鎮等城",
      "claim": "咸通七年北庭回鹘仆固俊克西州、北庭、轮台",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷250.wiki"
    },
    {
      "id": "tang-5a0d8095cc",
      "title": "《舊唐書》卷四〇·地理志三（隴右道）",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷40",
      "quote": "天寶領縣三，戶二千二百二十六，口九千九百六十四",
      "claim": "庭州／北庭户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷40.wiki"
    },
    {
      "id": "tang-0ef74413e7",
      "title": "《新唐書》卷四〇·地理志四（隴右道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷040",
      "quote": "又百里至輪臺縣",
      "claim": "北庭西路经轮台县",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷040.wiki"
    },
    {
      "id": "tang-39127e2e7e",
      "title": "《新唐書》卷四〇·地理志四（隴右道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷040",
      "quote": "西北三百里甘露川有伊吾軍",
      "claim": "伊州西北甘露川有伊吾军，经蒲类至北庭",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷040.wiki"
    },
    {
      "id": "tang-9ff4accf8d",
      "title": "《新唐書》卷二一七上·回鶻上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217上",
      "quote": "居薛延陀北娑陵水上",
      "claim": "回纥居娑陵水上",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217上.wiki"
    },
    {
      "id": "tang-82ad466ad0",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "回鶻牙北六百里得仙娥河",
      "claim": "牙帐北六百里仙娥河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-8ba4089d9f",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "河北岸有富貴城",
      "claim": "仙娥河北岸有富贵城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-bbd1cf2b2d",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "南依嗢昆水",
      "claim": "牙帐南依嗢昆水",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-ce759ce2fb",
      "title": "《舊唐書》卷一九五·回紇",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷195",
      "quote": "隨逐水草，勝兵五萬，人口十萬人",
      "claim": "唐初回纥户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷195.wiki"
    },
    {
      "id": "tang-13a0875a41",
      "title": "《舊唐書》卷一九五·回紇",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷195",
      "quote": "全收七千帳，殺戮收擒老小近九萬人",
      "claim": "赤心部七千帐被张仲武所破，老小近九万",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷195.wiki"
    },
    {
      "id": "tang-d97bad3327",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "時烏介眾雖衰減，尚號十萬，駐牙於大同軍北閭門山",
      "claim": "会昌二年乌介可汗部众尚号十万",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-43e827b3fa",
      "title": "英文維基百科 Mlechchha dynasty（二手，據 Hayunthal、Tezpur 銅板研究）",
      "url": "https://en.wikipedia.org/wiki/Mlechchha_dynasty",
      "quote": "capital = Harruppesvar (present-day Tezpur)",
      "claim": "二手：该王朝都诃鲁佩湿伐罗（今提斯浦尔）",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Mlechchha dynasty.wiki"
    },
    {
      "id": "tang-cf26bc555c",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又自驃國西度黑山，至東天竺迦摩波國千六百里",
      "claim": "唐道里：骠国西度黑山至东天竺迦摩波国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-28777fd588",
      "title": "英文維基百科 Mlechchha dynasty（二手，據 Hayunthal、Tezpur 銅板研究）",
      "url": "https://en.wikipedia.org/wiki/Mlechchha_dynasty",
      "quote": "* Harjjaravarman (815–832) * Vanamalavarmadeva (832–855)",
      "claim": "二手：王表",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Mlechchha dynasty.wiki"
    },
    {
      "id": "tang-0707de05a9",
      "title": "英文維基百科 Mlechchha dynasty（二手，據 Hayunthal、Tezpur 銅板研究）",
      "url": "https://en.wikipedia.org/wiki/Mlechchha_dynasty",
      "quote": "The Tejpur Copper Plates (since lost), roughly dated to the same spans, primarily chronicles Vanamala",
      "claim": "二手：提斯浦尔铜板以婆那摩罗为主",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Mlechchha dynasty.wiki"
    },
    {
      "id": "tang-8f3a1ecdd6",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "迦摩縷波國周萬餘里，國大都城周三十餘里",
      "claim": "迦摩缕波幅员",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-77016801be",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "此國東山阜連接，無大國都，境接西南夷，故其人類蠻獠矣",
      "claim": "迦摩缕波以东山阜连接，没有大国，境接西南夷",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-2cfa7fd223",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "其羅城構以塼甃，周一百六十里，濠岸亦構塼，相傳本是舍利佛城。城內有居人數萬家，佛寺百餘區",
      "claim": "骠国罗城周一百六十里，相传本是舍利佛城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷197.wiki"
    },
    {
      "id": "tang-75961bb9e6",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "從此東北大海濱山谷中，有室利差呾羅國",
      "claim": "玄奘所闻东南诸国有室利差呾罗",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-4c092c7fa9",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "驃王姓困沒長，名摩羅惹。其相名曰摩訶思那",
      "claim": "《新唐书》所记骠王名（贞元时代）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-ed11160304",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "貞元中，王雍羌聞南詔歸唐，有內附心",
      "claim": "贞元中骠王雍羌",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-9aa8ed7c68",
      "title": "樊綽《蠻書》卷十·南蠻疆界接連諸番夷國名",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷10",
      "quote": "蠻賊大和六年劫掠驃國，虜其眾三千餘人，隸配柘東，令之自給",
      "claim": "太和六年南诏劫掠骠国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷10.wiki"
    },
    {
      "id": "tang-e25a38357d",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "凡鎮城九：曰道林王，曰悉利移，曰三陀，曰彌諾道立，曰突旻，曰帝偈，曰達梨謀，曰乾唐，曰末浦",
      "claim": "骠国镇城九",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-c8fe03176a",
      "title": "英文維基百科 Pyu city-states（二手）",
      "url": "https://en.wikipedia.org/wiki/Pyu_city-states",
      "quote": "Finally, according to the Chinese, in 832, the Nanzhao warriors overran the Pyu country, and took away 3000 Pyu prisoners from Halin.",
      "claim": "二手：832 年南诏从汉林掳走三千骠人",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Pyu city-states.wiki"
    },
    {
      "id": "tang-f88473fd23",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "有室利差呾羅國",
      "claim": "室利差呾罗国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-37425f8374",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又南至樂城二百里。又入驃國境，經萬公等八部落，至悉利城七百里。又經突旻城至驃國千里",
      "claim": "入骠道里",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-60c25c56cd",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "北通南詔些樂城界",
      "claim": "骠国北通南诏些乐城界",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷100.wiki"
    },
    {
      "id": "tang-74ac5be023",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "城內有居人數萬家",
      "claim": "王城居人数万家",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷197.wiki"
    },
    {
      "id": "tang-93896a89f9",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "凡部落二百九十八，以名見者三十二",
      "claim": "骠国所属",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-6e0929617d",
      "title": "英文維基百科 Pyu city-states（二手）",
      "url": "https://en.wikipedia.org/wiki/Pyu_city-states",
      "quote": "The size of population of the Pyu realm was probably a few hundred thousand",
      "claim": "二手：骠国人口大约数十万（该句在维基上标有“需要引用”）",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Pyu city-states.wiki"
    },
    {
      "id": "tang-b04bbdbbe3",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "乃西渡彌諾江水，千里至大秦婆羅門國。又西渡大嶺，三百里至東天竺北界箇沒盧國",
      "claim": "渡弥诺江千里至大秦婆罗门国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-8aaca146c3",
      "title": "樊綽《蠻書》卷十·南蠻疆界接連諸番夷國名",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷10",
      "quote": "大秦婆羅門國，界永昌北",
      "claim": "《蛮书》大秦婆罗门国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷10.wiki"
    },
    {
      "id": "tang-9886819390",
      "title": "樊綽《蠻書》卷十·南蠻疆界接連諸番夷國名",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷10",
      "quote": "彌臣王以木柵居海際水中，以石獅子為屋四足，仍以板蓋，悉用香木",
      "claim": "弥臣王居",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷10.wiki"
    },
    {
      "id": "tang-66d96f7dbf",
      "title": "樊綽《蠻書》卷十·南蠻疆界接連諸番夷國名",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷10",
      "quote": "彌諾國、彌臣國，皆邊海國也。呼其君長為壽",
      "claim": "弥诺、弥臣称君长为“寿”；大和九年被南诏攻破",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷10.wiki"
    },
    {
      "id": "tang-bbeff8a9ca",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "繇坤朗至祿羽，有大昆侖王國，王名思利泊婆難多珊那。川原大於彌臣",
      "claim": "大昆仑王国大于弥臣",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-398e426223",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "曰彌臣",
      "claim": "弥臣为骠属国之一",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-bc944d4d5b",
      "title": "英文維基百科 Thaton kingdom（二手）",
      "url": "https://en.wikipedia.org/wiki/Thaton_kingdom",
      "quote": "gives the year of founding of Pegu as 825; but even that date remains unattested.",
      "claim": "二手：勃固建于 825 年之说未经证实",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Thaton kingdom.wiki"
    },
    {
      "id": "tang-bfb4c74cf4",
      "title": "英文維基百科 Thaton kingdom（二手）",
      "url": "https://en.wikipedia.org/wiki/Thaton_kingdom",
      "quote": "But the historical kingdom probably came into existence some time in the 9th century, following the entry Mon people into Lower Burma from modern northern Thailand.",
      "claim": "二手：直通王国约成于 9 世纪",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Thaton kingdom.wiki"
    },
    {
      "id": "tang-f9ceaacb68",
      "title": "樊綽《蠻書》卷十·南蠻疆界接連諸番夷國名",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷10",
      "quote": "彌諾國、彌臣國，皆邊海國也",
      "claim": "弥臣为边海国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷10.wiki"
    },
    {
      "id": "tang-aa8baf4cf9",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "水路下彌臣國三十日程",
      "claim": "开南水路下弥臣",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-af93209420",
      "title": "樊綽《蠻書》卷十·南蠻疆界接連諸番夷國名",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷10",
      "quote": "大和九年曾破其國，劫金銀，擄其族三二千人，配麗水淘金",
      "claim": "大和九年南诏破弥臣",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷10.wiki"
    },
    {
      "id": "tang-2d37f77002",
      "title": "樊綽《蠻書》卷四·名類",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷04",
      "quote": "茫蠻部落，並是開南雜種也。「茫」是其君之號，蠻呼茫詔",
      "claim": "“茫”是其君之号",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷04.wiki"
    },
    {
      "id": "tang-611f7f29d9",
      "title": "樊綽《蠻書》卷四·名類",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷04",
      "quote": "又有大賧、茫昌、茫盛、恐茫、蘚茫",
      "claim": "茫蛮诸部名",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷04.wiki"
    },
    {
      "id": "tang-72f76247f8",
      "title": "樊綽《蠻書》卷四·名類",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷04",
      "quote": "貞元十年，南詔異牟尋攻其族類",
      "claim": "贞元十年南诏攻茫蛮",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷04.wiki"
    },
    {
      "id": "tang-5af57bbee7",
      "title": "《新唐書》卷二二二上·南蠻上（南詔上）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222上",
      "quote": "王都羊苴咩城，別都曰善闡府",
      "claim": "王都羊苴咩城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222上.wiki"
    },
    {
      "id": "tang-133464ff2d",
      "title": "樊綽《蠻書》卷五·六賧",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷05",
      "quote": "大和城，北去陽苴咩城一十五里",
      "claim": "大和城在阳苴咩城南十五里",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷05.wiki"
    },
    {
      "id": "tang-5ba072e7a5",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又八十里至龍尾城，又十里至大和城，又二十五里至羊苴咩城",
      "claim": "道里：龙尾城—大和城—羊苴咩城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-12a452c2ad",
      "title": "《新唐書》卷二二二中·南蠻中（南詔下）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222中",
      "quote": "長慶三年，始賜印。是歲死，弟豐祐立。豐祐趫敢，善用其下，慕中國，不肯連父名",
      "claim": "长庆三年劝利死，弟丰祐立",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222中.wiki"
    },
    {
      "id": "tang-69caea7bde",
      "title": "《新唐書》卷二二二中·南蠻中（南詔下）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222中",
      "quote": "比年使者來朝，開成、會昌間再至",
      "claim": "开成、会昌间两度遣使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222中.wiki"
    },
    {
      "id": "tang-2feb4bf3fa",
      "title": "《冊府元龜》（四庫全書本）卷九七六·外臣部·褒異三",
      "url": "https://zh.wikisource.org/wiki/冊府元龜_(四庫全書本)/卷0976",
      "quote": "四年正月御麟徳殿對入朝賀正南詔趙酋莫等三十七人",
      "claim": "开成四年正月南诏贺正使赵酋莫等入见",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/冊府元龜 (四庫全書本)_卷0976.wiki"
    },
    {
      "id": "tang-2425979e02",
      "title": "《新唐書》卷二二二上·南蠻上（南詔上）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222上",
      "quote": "外則有六節度，曰：弄棟、永昌、銀生、劍川、柘東、麗水。有二都督：會川、通海。有十瞼，夷語瞼若州",
      "claim": "六节度、二都督、十睑",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222上.wiki"
    },
    {
      "id": "tang-b5275d6062",
      "title": "樊綽《蠻書》卷五·六賧",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷05",
      "quote": "雲南、柘東、永昌、寧北、鎮西及開南、銀生等七城則有大軍將領之，亦稱節度",
      "claim": "《蛮书》所记诸节度",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷05.wiki"
    },
    {
      "id": "tang-18575bc89b",
      "title": "《新唐書》卷二二二上·南蠻上（南詔上）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222上",
      "quote": "蒙秦瞼、矣和瞼、趙川瞼",
      "claim": "十睑中有矣和睑、赵川睑",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222上.wiki"
    },
    {
      "id": "tang-580486a4e2",
      "title": "樊綽《蠻書》卷五·六賧",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷05",
      "quote": "白崖城在勃弄川",
      "claim": "白崖城在勃弄川",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷05.wiki"
    },
    {
      "id": "tang-7ac8013d00",
      "title": "樊綽《蠻書》卷五·六賧",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷05",
      "quote": "邆川城，舊邆川也，南去龍口城十五里",
      "claim": "邆川城为名邑",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷05.wiki"
    },
    {
      "id": "tang-2980f1e386",
      "title": "《新唐書》卷二二二上·南蠻上（南詔上）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222上",
      "quote": "邆川瞼",
      "claim": "十睑有邆川睑",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222上.wiki"
    },
    {
      "id": "tang-43708258a8",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "寧北城，在漢碟榆縣之東境也。本無城池，今以浪人詔矣羅君舊宅為理所",
      "claim": "《蛮书》宁北城，以浪人诏旧宅为治所（浪穹诏战败后退保剑川，一般认为宁北即剑川）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-936d5011f4",
      "title": "《新唐書》卷二二二中·南蠻中（南詔下）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222中",
      "quote": "與南詔戰，不勝，挈其部保劍川",
      "claim": "浪穹诏退保剑川",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222中.wiki"
    },
    {
      "id": "tang-4b0ae1e0bf",
      "title": "樊綽《蠻書》卷十·南蠻疆界接連諸番夷國名",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷10",
      "quote": "吐蕃鐵橋節度本屬吐蕃，貞元十年，蒙異牟尋攻破，今並屬蠻管",
      "claim": "铁桥节度原属吐蕃，贞元十年并入南诏",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷10.wiki"
    },
    {
      "id": "tang-a3b30349ec",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "弄棟城在故姚州川中",
      "claim": "弄栋城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-0cd8c76ef7",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "永昌城，古哀牢地，在玷蒼山西六日程",
      "claim": "永昌城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-e9a8f30395",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "銀生城在撲賧之南，去龍尾城十日程",
      "claim": "银生城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-8b40a3c908",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "柘東城，廣德二年鳳伽異所置也",
      "claim": "柘东城广德二年置",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-bed5bf608b",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又八十里至柘東城",
      "claim": "道里：至柘东城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-e40dca3382",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "石城川，味縣故地也",
      "claim": "石城川即味县故地",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-cb2b02ce59",
      "title": "《新唐書》卷二二二上·南蠻上（南詔上）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222上",
      "quote": "有二都督：會川、通海",
      "claim": "二都督有通海",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222上.wiki"
    },
    {
      "id": "tang-24356cb4dd",
      "title": "樊綽《蠻書》卷四·名類",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷04",
      "quote": "穿鼻蠻、長鬃蠻、棟峰蠻，其蠻並在柘東南，生雜類也",
      "claim": "穿鼻、长鬃、栋峰诸蛮在柘东南，为南诏所总",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷04.wiki"
    },
    {
      "id": "tang-d582a84d89",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "茫乃道並黑齒等類十部落，皆屬焉",
      "claim": "茫乃道并黑齿等十部落属开南",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-ae734e28d0",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "通計南詔兵數三萬，而永西居其一",
      "claim": "南诏兵数",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-90b1ca742b",
      "title": "樊綽《蠻書》卷九·南蠻條教",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷09",
      "quote": "百家已上有總佐一，千人已上有理人官一，人約萬家以來，即制都督",
      "claim": "编户层级",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷09.wiki"
    },
    {
      "id": "tang-57f2f33de9",
      "title": "樊綽《蠻書》卷四·名類",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷04",
      "quote": "徙二十餘萬戶於永昌城",
      "claim": "徙西爨二十余万户于永昌",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷04.wiki"
    },
    {
      "id": "tang-91ed7f3338",
      "title": "樊綽《蠻書》卷六·雲南城鎮",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷06",
      "quote": "遷施、順、磨些諸種數萬戶以實其地",
      "claim": "柘东迁入数万户",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷06.wiki"
    },
    {
      "id": "tang-44de2a1e8a",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "王所居曰占城，別居曰齊國、曰蓬皮勢",
      "claim": "王所居曰占城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-d8532d768e",
      "title": "英文維基百科 Vikrantavarman III（二手）",
      "url": "https://en.wikipedia.org/wiki/Vikrantavarman_III",
      "quote": "succession = Prince of Pāṇḍuraṅga",
      "claim": "二手：毗建多跋摩三世出身宾童龙",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Vikrantavarman III.wiki"
    },
    {
      "id": "tang-d9651e02de",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又經單補鎮，二日至環王國城，故漢日南郡地也",
      "claim": "唐道里：环王国城在故汉日南郡地",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-33b539fb7f",
      "title": "英文維基百科 Vikrantavarman III（二手）",
      "url": "https://en.wikipedia.org/wiki/Vikrantavarman_III",
      "quote": "Vikrāntavarman III was a king of Champa, reigning from 817 to around 854.",
      "claim": "二手：在位 817—约 854",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Vikrantavarman III.wiki"
    },
    {
      "id": "tang-9621544942",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "至德後，更號環王。元和初不朝獻，安南都護張舟執其偽、愛州都統，斬三萬級，虜王子五十九",
      "claim": "元和初环王与安南交战",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-cd51c47917",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "一路自驩州東二日行，至唐林州安遠縣，南行經古羅江，二日行至環王國之檀洞江。又四日至朱崖",
      "claim": "驩州至环王国城道里",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-24b6f5bdb2",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "二日行至環王國之檀洞江",
      "claim": "环王国之檀洞江",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-b2d7a1e2c8",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "南抵奔浪陀州",
      "claim": "环王南抵奔浪陀州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-0656988a84",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又半日行，至奔陀浪洲",
      "claim": "贾耽：奔陀浪洲",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-cc2e13d0cb",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又一日行，至古笪國",
      "claim": "古笪国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-7fbec7ab33",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "至占不勞山，山在環王國東二百里海中",
      "claim": "占不劳山在环王国东二百里海中",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-3631d7bcbf",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又一日行，至門毒國",
      "claim": "门毒国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-813ede0bb7",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "王衛兵五千，戰乘象，藤為鎧，竹為弓矢，率象千、馬四百，分前後",
      "claim": "王卫兵",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-8d3a46ef58",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又三日行至文單外城，又一日行至內城，一曰陸真臘，其南水真臘",
      "claim": "文单外城、内城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-b1884ad2c2",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "陸真臘或曰文單，曰婆鏤，地七百里，王號「屈」",
      "claim": "陆真腊王号“屈”",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-fb0a3c772d",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "自驩州西南三日行，度霧溫嶺，又二日行至棠州日落縣",
      "claim": "驩州至文单道里",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-c977bbc79a",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "陸真臘或曰文單，曰婆鏤，地七百里",
      "claim": "文单即陆真腊",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-f3a57a57f3",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "一路自驩州東二日行，至唐林州安遠縣",
      "claim": "唐林州在驩州东",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-e7d8873e7e",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又二日行至棠州日落縣，又經羅倫江及古朗洞之石蜜山，三日行至棠州文陽縣",
      "claim": "驩州西南至棠州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-1b6f59c140",
      "title": "英文維基百科 Hariphunchai（二手）",
      "url": "https://en.wikipedia.org/wiki/Hariphunchai",
      "quote": "Its capital was at Lamphun, which at the time was also called Haripuñjaya.",
      "claim": "二手：哈里奔猜都于南奔",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Hariphunchai.wiki"
    },
    {
      "id": "tang-56d11bb146",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "太和五年至會昌二年，凡七遣使來",
      "claim": "牂牁太和至会昌凡七遣使",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷197.wiki"
    },
    {
      "id": "tang-abde9b12d6",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "有戶萬餘。貞觀三年，遣使入朝",
      "claim": "西赵蛮户万余",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷197.wiki"
    },
    {
      "id": "tang-347b827ca1",
      "title": "《新唐書》卷二一九·北狄（契丹、室韋、黑水靺鞨、渤海）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "水東合那河、忽汗河，又東貫黑水靺鞨",
      "claim": "室韦境内诸水合那河、忽汗河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-f58cceacd6",
      "title": "《新唐書》卷二一九·北狄（契丹、室韋、黑水靺鞨、渤海）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "扶餘故地爲扶餘府，常屯勁兵扞契丹",
      "claim": "渤海扶余府",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-e1d32b07a6",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "可汗收所餘往依黑車子",
      "claim": "乌介可汗往依黑车子（开局后）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-5b41127b50",
      "title": "《新唐書》卷四〇·地理志四（隴右道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷040",
      "quote": "有寧寇軍，故同城守捉也，天寶二載為軍。軍東北有居延海",
      "claim": "甘州删丹北千里有宁寇军，军东北有居延海",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷040.wiki"
    },
    {
      "id": "tang-ecabc9c57c",
      "title": "樊綽《蠻書》卷四·名類",
      "url": "https://zh.wikisource.org/wiki/蠻書/卷04",
      "quote": "從永昌城南，先過唐封，以至鳳藍茸，以次茫天連，以次茫吐薅",
      "claim": "茫蛮诸部自永昌城南依次为唐封、凤蓝茸、茫天连",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/蠻書_卷04.wiki"
    },
    {
      "id": "tang-ec2e4a7cb8",
      "title": "《新唐書》卷二一九·北狄（契丹、室韋、黑水靺鞨、渤海）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "越喜故地爲懷遠府",
      "claim": "越喜故地为怀远府，又有安远府",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-e4b47f81d1",
      "title": "《新唐書》卷二一九·北狄（契丹、室韋、黑水靺鞨、渤海）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "後渤海盛，靺鞨皆役屬之，不復與王會矣",
      "claim": "渤海盛，靺鞨皆役属之",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-7b85e506e5",
      "title": "《新唐書》卷二一九·北狄（契丹、室韋、黑水靺鞨、渤海）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "南比新羅，以泥河爲境",
      "claim": "渤海南比新罗，以泥河为境",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-4bba9c81c2",
      "title": "《新唐書》卷二一九·北狄（契丹、室韋、黑水靺鞨、渤海）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷219",
      "quote": "拂涅故地爲東平府，領伊、蒙、沱、黑、比五州。鐵利故地爲鐵利府",
      "claim": "拂涅故地为东平府，铁利故地为铁利府",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷219.wiki"
    },
    {
      "id": "tang-2a9f632811",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "阿熱駐牙青山，周柵代垣，聯氈為帳，號「密的支」，它首領居小帳",
      "claim": "阿热驻牙青山，号密的支",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-3c63a849b3",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "其君長曰阿熱，建牙青山，去回鶻牙，橐駝行四十日",
      "claim": "《通鉴》：建牙青山，距回鹘牙帐驼行四十日",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-42da911914",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "其君曰「阿熱」，遂姓阿熱氏",
      "claim": "君长号阿热",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-fb437301be",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "回鶻稍衰，阿熱即自稱可汗。其母，突騎施女也，為母可敦；妻葛祿葉護女，為可敦",
      "claim": "回鹘衰后阿热自称可汗；母为突骑施女，妻为葛逻禄叶护之女",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-eafc36c04e",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "而回鶻授其君長阿熱官為「毗伽頓頡斤」",
      "claim": "回鹘曾授阿热官号“毗伽顿颉斤”",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-4db57636b3",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "青山之東，有水曰劍河",
      "claim": "剑河经其国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-889a974f8d",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "南依貪漫山",
      "claim": "南依贪漫山",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-d07ab9d436",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "阿熱駐牙青山",
      "claim": "阿热驻牙青山",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-a6674d8841",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "東至木馬突厥三部落，曰都播、彌列、哥餓支",
      "claim": "黠戛斯东有木马突厥三部，受其役属",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-22bab8fec2",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "其地北瀕小海，西堅昆，南回紇",
      "claim": "都播西接坚昆，南接回纥",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-12d68c4def",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "青山之東，有水曰劍河，偶艇以度，水悉東北流，經其國，合而北入於海",
      "claim": "唐籍所载黠戛斯水系只有剑河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-c034e7b4f6",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "遂徙牙牢山之南。牢山亦曰賭滿",
      "claim": "破回鹘后迁牙",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-2f6b891999",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "眾數十萬，勝兵八萬，直回紇西北三千里，南依貪漫山",
      "claim": "黠戛斯众数与兵数",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-a7b5f0b38b",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "居伊邏廬城，北倚河羯田山，亦曰白山",
      "claim": "龟兹王居伊逻卢城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-a45956f7ad",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "始徙安西都護於其都，統于闐、碎葉、疏勒，號「四鎮」",
      "claim": "安西都护府移治龟兹，统四镇",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-0048406132",
      "title": "《舊唐書》卷一九五·回紇",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷195",
      "quote": "以一萬騎出北庭，一萬騎出安西",
      "claim": "长庆元年回鹘称可出兵安西，可见当时回鹘势力已及安西",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷195.wiki"
    },
    {
      "id": "tang-36f91ca410",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "一支奔吐蕃，一支奔安西",
      "claim": "开成五年回鹘溃散时有一支奔安西",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-46eda2d825",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "兼已得安西、北庭達靼等五部落",
      "claim": "会昌二年黠戛斯自称已得安西、北庭达靼等五部落（事在开局后）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-56876d3ab5",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "四鎮都督府，州三十四",
      "claim": "四镇都督府",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-2502c12638",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "疏勒，一曰佉沙，環五千里",
      "claim": "疏勒一曰佉沙",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-ebc5a23069",
      "title": "玄奘、辯機《大唐西域記》卷十二",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/12",
      "quote": "烏鎩國周千餘里，國大都城周十餘里，南臨徙多河",
      "claim": "乌铩国役属朅盘陀",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_12.wiki"
    },
    {
      "id": "tang-41373091ab",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "北九百里屬疏勒",
      "claim": "朱俱波北九百里属疏勒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-46e91cdf51",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "至撥換城，一曰威戎城，曰姑墨州，南臨思渾河",
      "claim": "拨换城一曰威戎城，曰姑墨州",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-ee40a7351e",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "有跋祿迦，小國也，一曰亟墨，即漢姑墨國",
      "claim": "跋禄迦即汉姑墨国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-e4079464d1",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "龜茲，一曰丘茲，一曰屈茲",
      "claim": "龟兹",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-c3f13eb8af",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "焉耆國直京師西七千里而贏",
      "claim": "焉耆",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-cd79135c35",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "自焉耆西五十里過鐵門關，又二十里至于術守捉城",
      "claim": "焉耆西五十里过铁门关，又二十里至于术守捉",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-910a90cac7",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "東高昌，西龜茲，南尉犁，北烏孫",
      "claim": "焉耆南为尉犁（方位用语）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-dc24d397a3",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "戶四千，勝兵二千，常役屬西突厥",
      "claim": "焉耆户口",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-bac002abdb",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "居迦師城，突厥以女妻之。勝兵二千人",
      "claim": "疏勒胜兵",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-978843c943",
      "title": "玄奘、辯機《大唐西域記》卷一",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/01",
      "quote": "伽藍百餘所。僧徒五千餘人習學小乘教說一切有部",
      "claim": "屈支（龟兹）僧徒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_01.wiki"
    },
    {
      "id": "tang-715730eac1",
      "title": "玄奘、辯機《大唐西域記》卷十二",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/12",
      "quote": "伽藍數百所，僧徒萬餘人",
      "claim": "佉沙（疏勒）僧徒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_12.wiki"
    },
    {
      "id": "tang-aa4f70fc5a",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "至德後，葛邏祿浸盛，與回紇爭強，徙十姓可汗故地，盡有碎葉、怛邏斯諸城",
      "claim": "至德以后葛逻禄尽有碎叶、怛逻斯诸城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-466a842a8d",
      "title": "英文維基百科 Karluk Yabghu（二手）",
      "url": "https://en.wikipedia.org/wiki/Karluk_Yabghu",
      "quote": "capital = Suyab later Balasagun",
      "claim": "二手：叶护国都城在碎叶，后迁八剌沙衮",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Karluk Yabgu State.wiki"
    },
    {
      "id": "tang-6a56e55e3f",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "後稍南徙，自號「三姓葉護」，兵強，甘於鬥，廷州以西諸突厥皆畏之",
      "claim": "葛逻禄自号三姓叶护",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-8ccdfe67a7",
      "title": "英文維基百科 Karluk Yabghu（二手）",
      "url": "https://en.wikipedia.org/wiki/Karluk_Yabghu",
      "quote": "When the Yenisei Kyrgyz destroyed the Uyghur Khaganate in 840, Karluk yabghu declared himself khagan with title Bilge Kul Qadir Khan, forming the Kara-Khanid Khanate.",
      "claim": "二手：840 年葛逻禄叶护称可汗",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Karluk Yabgu State.wiki"
    },
    {
      "id": "tang-2cecf409d1",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "徙十姓可汗故地，盡有碎葉、怛邏斯諸城",
      "claim": "徙十姓可汗故地",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-d118814f88",
      "title": "《新唐書》卷四〇·地理志四（隴右道）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷040",
      "quote": "至弓月城。過思渾川、蟄失蜜城，渡伊麗河",
      "claim": "北庭西路至弓月城，渡伊丽河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷040.wiki"
    },
    {
      "id": "tang-632802e6bc",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又西二十里至碎葉城",
      "claim": "碎叶城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-db56bbb026",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "至怛羅斯城",
      "claim": "怛逻斯城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/唐會要_卷099.wiki"
    },
    {
      "id": "tang-45b061dd50",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "葛邏祿本突厥諸族，在北庭西北、金山之西，跨仆固振水，包多怛嶺",
      "claim": "葛逻禄原居地",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-e874944652",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "在焉耆西北鷹娑川",
      "claim": "鹰娑川实在焉耆西北",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-4f14b1da56",
      "title": "《資治通鑑》卷二四六·唐紀六十二",
      "url": "https://zh.wikisource.org/wiki/資治通鑑/卷246",
      "quote": "其相馺職、特勒厖等址五部西奔葛邏祿",
      "claim": "回鹘相馺职、特勒厖等十五部西奔葛逻禄（开局后）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/資治通鑑_卷246.wiki"
    },
    {
      "id": "tang-de710624ac",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "治蔥嶺中，都城負徙多河。勝兵千人",
      "claim": "喝盘陀治葱岭中",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-58ee1e4c91",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "王居孽多城，臨娑夷水",
      "claim": "小勃律王居孽多城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-a5eeea3e3a",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "大勃律，或曰布露。直吐蕃西，與小勃律接，西鄰北天竺、烏萇。地宜郁金。役屬吐蕃",
      "claim": "大勃律役属吐蕃",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-38d1a52571",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "開元中破平其國，置蔥嶺守捉，安西極邊戍也",
      "claim": "开元中破喝盘陀，置葱岭守捉",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-4be6a7ca2c",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "至葱嶺守捉，故羯盤陀國，開元中置守捉，安西極邊之戍",
      "claim": "葱岭守捉即故羯盘陀国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-a4cd4c93ca",
      "title": "玄奘、辯機《大唐西域記》卷十二",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/12",
      "quote": "朅盤陁國周二千餘里，國大都城基大石嶺，背徒多河，周二十餘里",
      "claim": "朅盘陀国情",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_12.wiki"
    },
    {
      "id": "tang-944e8bd161",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "個失蜜，或曰迦濕彌邏。北距勃律五百里，環地四千里，山回繚之，它國無能攻伐。王治撥邏勿邏布邏城，西瀕彌那悉多大河",
      "claim": "王治拨逻勿逻布逻城，西濒弥那悉多大河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-3985c33940",
      "title": "玄奘、辯機《大唐西域記》卷三",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/03",
      "quote": "國大都城西臨大河，南北十二三里，東西四五里",
      "claim": "国大都城西临大河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_03.wiki"
    },
    {
      "id": "tang-f7b98e008d",
      "title": "英文維基百科 Karkota dynasty（二手，終據迦爾訶納《王河》）",
      "url": "https://en.wikipedia.org/wiki/Karkota_dynasty",
      "quote": "After Cippatajayapida was murdered in around 840, having ruled for twelve years, the brothers gained considerable power but fought each other to retain complete control of the empire, whilst installing puppet kings belonging to the Karkota lineage.",
      "claim": "二手：约 840 年奇帕塔·阇耶毗荼被杀，诸兄弟立傀儡",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Karkota dynasty.wiki"
    },
    {
      "id": "tang-498e51820e",
      "title": "英文維基百科 Karkota dynasty（二手，終據迦爾訶納《王河》）",
      "url": "https://en.wikipedia.org/wiki/Karkota_dynasty",
      "quote": "Tribhuvanapida's son, Ajitapida was nominated by Utpala immediately after Cippatajayapida's death.",
      "claim": "二手：乌帕拉立阿耆多毗荼",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Karkota dynasty.wiki"
    },
    {
      "id": "tang-0e32de46e5",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "其役屬五種，亦名國",
      "claim": "迦湿弥罗役属诸国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-c9a194e5b4",
      "title": "玄奘、辯機《大唐西域記》卷三",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/03",
      "quote": "迦濕彌羅國周七千餘里，四境負山",
      "claim": "迦湿弥罗国幅员与僧徒",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_03.wiki"
    },
    {
      "id": "tang-dcaa3c126a",
      "title": "《新唐書》卷二二一下·西域下",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221下",
      "quote": "有如天可汗兵至勃律者，雖眾二十萬，能輸糧以助",
      "claim": "开元时自称可为唐军二十万输粮",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221下.wiki"
    },
    {
      "id": "tang-a722d15a6d",
      "title": "玄奘、辯機《大唐西域記》卷七",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/07",
      "quote": "尼波羅國周四千餘里，在雪山中。國大都城周二十餘里",
      "claim": "尼波罗国都",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_07.wiki"
    },
    {
      "id": "tang-f70dc3f9df",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "宮中有七重樓，覆銅瓦",
      "claim": "王宫有七重楼",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-dfee875da4",
      "title": "英文維基百科 Licchavis of Nepal（二手）",
      "url": "https://en.wikipedia.org/wiki/Licchavis_of_Nepal",
      "quote": "*826 Balirāja *847 Baladeva",
      "claim": "二手：李查维王表 826 年见 Balirāja，847 年见 Baladeva，840 年在位者不能确定",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Licchavis of Nepal.wiki"
    },
    {
      "id": "tang-9e2e11aebd",
      "title": "玄奘、辯機《大唐西域記》卷七",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/07",
      "quote": "王，剎帝利栗呫婆種也",
      "claim": "玄奘时王为栗呫婆（李查维）种",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_07.wiki"
    },
    {
      "id": "tang-434aeb6d69",
      "title": "《新唐書》卷二二一上·西域上",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷221上",
      "quote": "泥婆羅，直吐蕃之西樂陵川",
      "claim": "泥婆罗在吐蕃之西乐陵川",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷221上.wiki"
    },
    {
      "id": "tang-3dc2952263",
      "title": "玄奘、辯機《大唐西域記》卷七",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/07",
      "quote": "尼波羅國周四千餘里",
      "claim": "尼波罗幅员",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_07.wiki"
    },
    {
      "id": "tang-11d01926ac",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "其大酋俟斤因使者獻馬",
      "claim": "骨利干大酋俟斤（贞观时）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-5469124e82",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "骨利幹、都播二部落北有小海，冰堅時馬行八日可度",
      "claim": "骨利干、都播之北有小海",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-18a4728b53",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "骨利幹處瀚海北，勝兵五千",
      "claim": "骨利干处瀚海北",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-fb6aae08a4",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "骨利幹之東，室韋之西有鞠部落，亦曰祴部落",
      "claim": "骨利干之东有鞠部落",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-eba1c1a148",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "又有鞠，或曰祴，居拔野古東北，有木無草，地多苔。無羊馬，人豢鹿若牛馬",
      "claim": "鞠人以鹿代马",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-8c4a437793",
      "title": "《新唐書》卷二一七下·回鶻下（附薛延陀、葛邏祿、都播、骨利幹、黠戛斯等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷217下",
      "quote": "大漢者，處鞠之北，饒羊馬，人物頎大，故以自名",
      "claim": "大汉处鞠之北",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷217下.wiki"
    },
    {
      "id": "tang-6a64516a3e",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "又正北十日行有大漢國，又北有骨師國",
      "claim": "道里：正北十日行有大汉国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-f00634cd16",
      "title": "英文維基百科 Jayavarman II（二手）",
      "url": "https://en.wikipedia.org/wiki/Jayavarman_II",
      "quote": "Jayavarman II founded Hariharalaya near present-day Roluos, the first settlement in what would later become the Khmer Empire.",
      "claim": "二手：阇耶跋摩二世建诃里诃罗阿赖耶",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Jayavarman II.wiki"
    },
    {
      "id": "tang-1568e243b2",
      "title": "英文維基百科 Jayavarman II（二手）",
      "url": "https://en.wikipedia.org/wiki/Jayavarman_II",
      "quote": "| reign = 802 – 850",
      "claim": "二手：阇耶跋摩二世在位年代（信息框）",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Jayavarman II.wiki"
    },
    {
      "id": "tang-737162c0d0",
      "title": "英文維基百科 Jayavarman II（二手）",
      "url": "https://en.wikipedia.org/wiki/Jayavarman_II",
      "quote": "title=Khmer Empire|years=802–835|after=Jayavarman III",
      "claim": "二手：同页另一处又记其下限为 835 年",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Jayavarman II.wiki"
    },
    {
      "id": "tang-e1253e8882",
      "title": "英文維基百科 Jayavarman III（二手）",
      "url": "https://en.wikipedia.org/wiki/Jayavarman_III",
      "quote": "title=King of the Khmers|years=835&ndash;877|after=Indravarman I",
      "claim": "二手：阇耶跋摩三世 835（或 850）—877 年",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Jayavarman III.wiki"
    },
    {
      "id": "tang-8dc7fc8ed0",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "真臘，一曰吉蔑，本扶南屬國",
      "claim": "真腊一曰吉蔑",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-38998bd7ce",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "有大城三十餘所，王都伊奢那城",
      "claim": "真腊王都伊奢那城（7 世纪）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷197.wiki"
    },
    {
      "id": "tang-f37216f427",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "次東有伊賞那補羅國",
      "claim": "伊赏那补罗国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-927763a0e2",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "水真臘，地八百里，王居婆羅提拔城",
      "claim": "水真腊王居婆罗提拔城",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-bd9349581a",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "有大城三十餘所",
      "claim": "真腊大城三十余所",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷197.wiki"
    },
    {
      "id": "tang-f6758087af",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "墮和羅，亦曰獨和羅，南距盤盤，北迦羅舍弗，西屬海，東真臘",
      "claim": "堕和罗四至",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-440d1e5b15",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "次東有墮羅缽底國",
      "claim": "玄奘所闻有堕罗钵底国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-58f79b658a",
      "title": "《舊唐書》卷一九七·南蠻西南蠻",
      "url": "https://zh.wikisource.org/wiki/舊唐書/卷197",
      "quote": "西至墮羅缽底國",
      "claim": "水真腊西至堕罗钵底",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/舊唐書_卷197.wiki"
    },
    {
      "id": "tang-d17bf12293",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "有二屬國，曰曇陵、陀洹",
      "claim": "堕和罗有二属国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-ad93211cc2",
      "title": "DHARMA 銘文庫：那爛陀提婆波羅銅板（在位第35年），DHARMA_INSBengalCharters00104（梵文轉寫及英譯；原始銘文依據）",
      "url": "https://dharmalekha.info/texts/INSBengalCharters00104",
      "quote": "We were requested by the ruler of Suvarṇadvīpa mahārāja illustrious Bālaputradeva through the mouth of the messenger",
      "claim": "二手（铭文英译）：那烂陀铜板记“金洲”之王巴拉普特拉提婆（铜板年代为提婆波罗在位第35年，不能确定 840 年是否已在位）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/dharma-INSBengalCharters00104.txt"
    },
    {
      "id": "tang-2f8a434075",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "與狼牙脩接",
      "claim": "盘盘与狼牙脩接",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-c307ee1bbb",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "其北岸則箇羅國。箇羅西則哥谷羅國",
      "claim": "贾耽：海峡北岸为箇罗",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-977a008d53",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "其東南有哥羅，一曰個羅，亦曰哥羅富沙羅",
      "claim": "哥罗一曰个罗",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-e113ebc1cf",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "盤盤，在南海曲，北距環王，限少海，與狼牙脩接",
      "claim": "盘盘",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-f44a1532a9",
      "title": "《新唐書》卷四三下·地理志七下（羈縻州、賈耽入四夷道里）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷043下",
      "quote": "北岸則羅越國，南岸則佛逝國",
      "claim": "海峡北岸罗越、南岸佛逝",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷043下.wiki"
    },
    {
      "id": "tang-b87fd9cb9e",
      "title": "《新唐書》卷二二二下·南蠻下（環王、真臘、驃等）",
      "url": "https://zh.wikisource.org/wiki/新唐書/卷222下",
      "quote": "羅越者，北距海五千里，西南哥谷羅。商賈往來所湊集",
      "claim": "罗越为商贾所凑",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/新唐書_卷222下.wiki"
    },
    {
      "id": "tang-650cbe3b93",
      "title": "英文維基百科 Mihira Bhoja（二手）",
      "url": "https://en.wikipedia.org/wiki/Mihira_Bhoja",
      "quote": "During his reign, the capital was Kannauj (present-day Uttar Pradesh).",
      "claim": "二手：弥醯罗·博阇时都曲女城",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Mihira Bhoja.wiki"
    },
    {
      "id": "tang-d84d2372bd",
      "title": "玄奘、辯機《大唐西域記》卷五",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/05",
      "quote": "羯若鞠阇國周四千餘里。國大都城西臨殑伽河，其長二十餘里，廣四五里",
      "claim": "羯若鞠阇国都城西临殑伽河",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_05.wiki"
    },
    {
      "id": "tang-ec4d5a43b4",
      "title": "英文維基百科 Mihira Bhoja（二手）",
      "url": "https://en.wikipedia.org/wiki/Mihira_Bhoja",
      "quote": "was the Pratihara emperor from 836 to 885 CE",
      "claim": "二手：836—885 年在位",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Mihira Bhoja.wiki"
    },
    {
      "id": "tang-9498344553",
      "title": "英文維基百科 Mihira Bhoja（二手）",
      "url": "https://en.wikipedia.org/wiki/Mihira_Bhoja",
      "quote": "Bhoja's Daulatpura-Dausa Inscription (AD 843), confirms his rule in Dausa region.",
      "claim": "二手：843 年道拉特布尔铭文证其统治",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Gurjara-Pratihara dynasty.wiki"
    },
    {
      "id": "tang-7ee47a0965",
      "title": "玄奘、辯機《大唐西域記》卷四",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/04",
      "quote": "薩他泥濕伐羅國周七千餘里",
      "claim": "萨他泥湿伐罗国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_04.wiki"
    },
    {
      "id": "tang-a74b4e16ac",
      "title": "玄奘、辯機《大唐西域記》卷四",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/04",
      "quote": "堊醯掣呾邏國周三千餘里",
      "claim": "垩醯掣呾逻国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_04.wiki"
    },
    {
      "id": "tang-90519ed3b4",
      "title": "玄奘、辯機《大唐西域記》卷四",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/04",
      "quote": "秣菟羅國周五千餘里",
      "claim": "秣菟罗国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_04.wiki"
    },
    {
      "id": "tang-2de904cd16",
      "title": "玄奘、辯機《大唐西域記》卷五",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/05",
      "quote": "居人豐樂，家室富饒",
      "claim": "羯若鞠阇国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_05.wiki"
    },
    {
      "id": "tang-a15136347f",
      "title": "玄奘、辯機《大唐西域記》卷六",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/06",
      "quote": "室羅伐悉底國周六千餘里。都城荒頹，疆埸無紀",
      "claim": "室罗伐悉底都城荒颓",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_06.wiki"
    },
    {
      "id": "tang-02faa7f577",
      "title": "玄奘、辯機《大唐西域記》卷五",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/05",
      "quote": "阿逾陁國周五千餘里",
      "claim": "阿逾陁国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_05.wiki"
    },
    {
      "id": "tang-4f8bb41c34",
      "title": "玄奘、辯機《大唐西域記》卷五",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/05",
      "quote": "缽邏耶伽國周五千餘里",
      "claim": "钵逻耶伽国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_05.wiki"
    },
    {
      "id": "tang-0c777e9993",
      "title": "玄奘、辯機《大唐西域記》卷七",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/07",
      "quote": "閭閻櫛比，居人殷盛",
      "claim": "婆罗痆斯国居人殷盛",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_07.wiki"
    },
    {
      "id": "tang-d056b93ac6",
      "title": "英文維基百科 Devapala of Bengal（二手）",
      "url": "https://en.wikipedia.org/wiki/Devapala_of_Bengal",
      "quote": "He was known to be the Overlord of Aryavarta.",
      "claim": "二手：提婆波罗号称雅利安伐尔多之主",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Devapala of Bengal.wiki"
    },
    {
      "id": "tang-9544a79209",
      "title": "玄奘、辯機《大唐西域記》卷四",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/04",
      "quote": "薩他泥濕伐羅國周七千餘里。國大都城周二十餘里",
      "claim": "萨他泥湿伐罗幅员",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_04.wiki"
    },
    {
      "id": "tang-41d32f23c1",
      "title": "玄奘、辯機《大唐西域記》卷七",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/07",
      "quote": "婆羅痆斯國周四千餘里",
      "claim": "婆罗痆斯幅员",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_07.wiki"
    },
    {
      "id": "tang-dab281ad82",
      "title": "DHARMA 銘文庫：那爛陀提婆波羅銅板（在位第35年），DHARMA_INSBengalCharters00104（梵文轉寫及英譯；原始銘文依據）",
      "url": "https://dharmalekha.info/texts/INSBengalCharters00104",
      "quote": "śrī-mudgagiri-samāvāsita-śrīmaj-jaya-skandhāvārāT",
      "claim": "铭文：自蒙吉尔胜利军营颁发（梵文转写）",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/dharma-INSBengalCharters00104.txt"
    },
    {
      "id": "tang-77b6fc14c4",
      "title": "DHARMA 銘文庫：那爛陀提婆波羅銅板（在位第35年），DHARMA_INSBengalCharters00104（梵文轉寫及英譯；原始銘文依據）",
      "url": "https://dharmalekha.info/texts/INSBengalCharters00104",
      "quote": "From the illustrious military camp of victory pitched at illustrious Mudgagiri",
      "claim": "铭文英译",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/dharma-INSBengalCharters00104.txt"
    },
    {
      "id": "tang-875187885c",
      "title": "英文維基百科 Pala Empire（二手）",
      "url": "https://en.wikipedia.org/wiki/Pala_Empire",
      "quote": "Though the Khalimpur copper plate of Dharmapala mentions Pataliputra as 'skandhavara' only yet it might have been the capital under the early Pala rulers.",
      "claim": "二手：达磨波罗铜板称波吒厘子为军营",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Pala Empire.wiki"
    },
    {
      "id": "tang-07ed983b39",
      "title": "DHARMA 銘文庫：那爛陀提婆波羅銅板（在位第35年），DHARMA_INSBengalCharters00104（梵文轉寫及英譯；原始銘文依據）",
      "url": "https://dharmalekha.info/texts/INSBengalCharters00104",
      "quote": "In this undertaking of dharma, illustrious Balavarman, the lord of Vyāghrataṭī maṇḍala, performed the duty of messenger of illustrious Devapāladeva.",
      "claim": "铭文英译：提婆波罗之使者",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/dharma-INSBengalCharters00104.txt"
    },
    {
      "id": "tang-8918ebc0c5",
      "title": "英文維基百科 Devapala of Bengal（二手）",
      "url": "https://en.wikipedia.org/wiki/Devapala_of_Bengal",
      "quote": "| RC Majumdar (1971) | 810-850 |- | AM Chowdhury (1967) | 821–861 |- | BP Sinha (1977) | 820–860 |- | DC Sircar (1975–76) | 812–850",
      "claim": "二手：各家对在位年代的推定",
      "confidence": "L",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/enwp-Devapala of Bengal.wiki"
    },
    {
      "id": "tang-7889270347",
      "title": "玄奘、辯機《大唐西域記》卷七",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/07",
      "quote": "吠舍厘城已甚傾頹，其故基趾周六七十里，宮城周四五里，少有居人",
      "claim": "吠舍厘城已倾颓",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_07.wiki"
    },
    {
      "id": "tang-6e12ae19eb",
      "title": "玄奘、辯機《大唐西域記》卷八",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/08",
      "quote": "殑伽河南有故城，周七十餘里，荒蕪雖久，基址尚在",
      "claim": "故城荒芜",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_08.wiki"
    },
    {
      "id": "tang-1ed5331136",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "瞻波國周四千餘里，國大都城北背殑伽河，周四十餘里",
      "claim": "瞻波国",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-7805e1b610",
      "title": "玄奘、辯機《大唐西域記》卷十",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/10",
      "quote": "奔那伐彈那國周四千餘里，國大都城周三十餘里。居人殷盛",
      "claim": "奔那伐弹那居人殷盛",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_10.wiki"
    },
    {
      "id": "tang-d513f893f5",
      "title": "玄奘、辯機《大唐西域記》卷八",
      "url": "https://zh.wikisource.org/wiki/大唐西域記/08",
      "quote": "摩揭陁國周五千餘里，城少居人，邑多編戶",
      "claim": "摩揭陀城少居人，邑多编户",
      "confidence": "H",
      "file": "sources/tang-research/governors-excerpts.txt",
      "rawSource": "E:/tianming-tmp/tang/research/raw/大唐西域記_08.wiki"
    }
  ],
  "peopleNotes": [],
  "uncertain": [
    "天德、灵盐、泾原、凤翔、兖海、同州、湖南、容管沿用前轮最后已知任命推延（L），不声称新考定。",
    "金商出缺；夏绥银宥的高霞寓身份与生卒冲突未解，出缺。",
    "外藩分区不等于统一行政区；诸部枚举表示没有已确认的全区单一主官，不表示没有国王或地方首领。",
    "迦摩缕波、瞿折罗及波罗王庭连接既有君主，任期沿用前轮二手铭文研究（L），不提升可信度。环王、迦湿弥罗、泥婆罗、真腊、骠国、哈里奔猜保留可解析的君位空席。"
  ]
};
