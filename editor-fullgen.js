// ============================================================
// editor-fullgen.js — 剧本全量生成+杂项 (R140 从 editor.js L2380-end 拆出)
// 姊妹: editor.js (L1-2379·系统 CRUD)
// 包含: openFullGenModal (AI 一键生成全剧本)+Era/Game settings/Party modal/
//       APISettings/ImageAPI/renderAll/renderPlayerOverview/returnToMain/
//       showToast/toggleEditorPreview/updateEditorPreview
// ============================================================

  function openFullGenModal() {
    document.getElementById(
      'fullGenModal'
    ).classList.add('show');
  }

  function closeFullGenModal() {
    document.getElementById(
      'fullGenModal'
    ).classList.remove('show');
  }

  function doFullGenerate() {
    var dynasty = document.getElementById('fullGenDynasty').value.trim();
    var emperor = document.getElementById('fullGenEmperor').value.trim();
    var year = document.getElementById('fullGenYear').value.trim();
    var note = document.getElementById('fullGenNote').value.trim();
    var playerFaction = document.getElementById('fullGenPlayerFaction').value.trim();
    var playerCharacter = document.getElementById('fullGenPlayerCharacter').value.trim();

    if (!dynasty || !emperor) {
      showToast('请至少填写朝代和皇帝');
      return;
    }
    scriptData.dynasty = dynasty;
    scriptData.emperor = emperor;
    document.getElementById('scriptDynasty').value = dynasty;
    document.getElementById('scriptEmperor').value = emperor;
    closeFullGenModal();
    var monthEl = document.getElementById('fullGenMonth');
    var month = monthEl ? (parseInt(monthEl.value) || 0) : 0;
    var dayEl = document.getElementById('fullGenDay');
    var day = dayEl ? (parseInt(dayEl.value) || 0) : 0;
    if (month >= 1 && month <= 12 && scriptData.gameSettings) scriptData.gameSettings.startMonth = month;
    if (day >= 1 && day <= 31 && scriptData.gameSettings) scriptData.gameSettings.startDay = day;
    var ctx;
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      ctx = '公元' + year + '年' + month + '月' + day + '日，朝代:' + dynasty + ' 皇帝:' + emperor;
    } else if (year && month >= 1 && month <= 12) {
      ctx = '公元' + year + '年' + month + '月，朝代:' + dynasty + ' 皇帝:' + emperor;
    } else if (year) {
      ctx = '公元' + year + '年，朝代:' + dynasty + ' 皇帝:' + emperor;
    } else {
      ctx = '朝代:' + dynasty + ' 皇帝:' + emperor;
    }
    if (note) ctx += ' 附加说明:' + note;

    // 构建玩家指定信息
    var playerSpec = '';
    if (playerFaction || playerCharacter) {
      playerSpec = '\n\n【玩家扮演设定】\n';
      if (playerFaction) {
        playerSpec += '玩家势力：' + playerFaction + '\n';
      }
      if (playerCharacter) {
        playerSpec += '玩家角色：' + playerCharacter + '\n';
      }
      playerSpec += '请确保生成的内容中包含这些指定的势力和角色。';
    }

    // 获取游戏模式和参考文本
    var gameMode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
    var refText = (typeof P !== 'undefined' && P.conf && P.conf.refText) || '';

    // 历史名臣年份范围限制
    var historicalCharLimit = '';
    if (gameMode === 'strict_hist') {
      historicalCharLimit = '\n\n【历史名臣限制】仅生成剧本开始年份前后100年内的历史名臣。';
    } else if (gameMode === 'light_hist') {
      historicalCharLimit = '\n\n【历史名臣限制】仅生成剧本开始年份前后200年内的历史名臣。';
    }
    // 演义模式无限制，可以生成中国古代全部历史名臣

    // 构建参考文本上下文（严格史实模式）
    var refContext = '';
    if (gameMode === 'strict_hist' && refText) {
      refContext = '\n\n【参考数据库】\n' + refText.substring(0, 8000) + (refText.length > 8000 ? '\n...(数据库内容过长，已截取前8000字)' : '') + '\n\n请严格参考上述数据库中的历史人物信息，确保生成的人物在数据库中有记载或符合数据库描述的历史背景。';
    }

    var steps = [
      { key:'scriptInfo', label:'剧本基础信息', minItems: 0,
        prompt: '你是天命游戏副本设计师，精通中国古代史。' + ctx
          + '\n根据以上设定生成剧本基础信息，返回JSON对象：'
          + '\n{"name":"剧本名称（8字以内，有意境）",'
          + '\n "dynasty":"朝代名称（如：晚唐、北宋末年、明末）",'
          + '\n "emperor":"当朝统治者姓名",'
          + '\n "overview":"300-500字的剧本总述，描述时代背景、政治局势、主要矛盾",'
          + '\n "openingText":"400-600字的开场白，文学性强，渲染时代氛围，引出玩家处境",'
          + '\n "globalRules":"5-10条AI推演规则，每条一行，反映该朝代特殊制度和约束"}'
          + '\n\n要求：\n- 如果用户已指定朝代/统治者，必须使用\n- overview应准确反映历史\n- openingText应像历史小说开篇\n- globalRules应包含政治/军事/经济方面的时代特色约束\n只输出JSON。' },
      { key:'playerInfo', label:'玩家角色', minItems: 0,
        prompt: '你是天命游戏副本设计师。' + ctx + playerSpec
          + '\n\n【已有角色列表】' + (scriptData.characters.length > 0 ? scriptData.characters.slice(0,5).map(function(c){return c.name+(c.title?'('+c.title+')':'');}).join('、') : '暂无')
          + '\n【已有势力列表】' + (scriptData.factions.length > 0 ? scriptData.factions.slice(0,5).map(function(f){return f.name;}).join('、') : '暂无')
          + '\n\n生成玩家角色信息。如果角色列表或势力列表中有合适的角色/势力，应从中选择而非凭空创造。'
          + '\n返回JSON对象：'
          + '\n{"factionName":"势力名称' + (playerFaction ? '（必须是：' + playerFaction + '）' : '') + '",'
          + '\n "factionType":"势力类型（如：朝廷、诸侯国、藩镇等）",'
          + '\n "factionLeader":"势力领袖姓名",'
          + '\n "factionLeaderTitle":"领袖头衔",'
          + '\n "factionTerritory":"控制区域描述",'
          + '\n "factionStrength":"势力实力评估",'
          + '\n "factionCulture":"文化特征",'
          + '\n "factionGoal":"势力的核心战略目标",'
          + '\n "factionResources":"资源状况描述",'
          + '\n "factionDesc":"势力详细描述（200-300字，含历史渊源、当前处境、优劣势）",'
          + '\n "characterName":"玩家角色姓名' + (playerCharacter ? '（必须是：' + playerCharacter + '）' : '') + '",'
          + '\n "characterTitle":"角色头衔/官职",'
          + '\n "characterFaction":"所属势力（应与factionName一致）",'
          + '\n "characterAge":"具体年龄数字",'
          + '\n "characterGender":"性别",'
          + '\n "characterPersonality":"性格特征关键词",'
          + '\n "characterFaith":"信仰",'
          + '\n "characterCulture":"文化背景",'
          + '\n "characterBio":"基于史实的人物生平简介（150-250字）",'
          + '\n "characterDesc":"外貌与气质描写（80-120字）"}'
          + '\n\n注意：史实人物必须符合历史记载，数值和描述要准确。只输出JSON。' },
      { key:'eraState', label:'本国状态', minItems: 0,
        prompt: '你是历史状态分析专家。' + ctx
          + '\n根据该历史时期的实际情况，精确评估本国状态，返回JSON对象。'
          + '\n{politicalUnity(政治统一度,0-1), centralControl(中央集权度,0-1), socialStability(社会稳定度,0-1), economicProsperity(经济繁荣度,0-1), culturalVibrancy(文化活力,0-1), bureaucracyStrength(官僚体系效率,0-1), militaryProfessionalism(军队职业化,0-1),'
          + '\nlegitimacySource("hereditary"世袭/"military"军功/"merit"贤能/"divine"天命/"declining"衰微),'
          + '\nlandSystemType("state"国有制/"private"私有制/"mixed"混合制),'
          + '\ndynastyPhase("founding"开创/"rising"上升/"peak"鼎盛/"stable"守成/"declining"衰落/"crisis"危机),'
          + '\ncontextDescription(100-200字的时代背景描述，包含政治格局、社会矛盾、经济状况等)}'
          + '\n数值必须基于史实精确评估，如安史之乱后socialStability应<0.3，开元盛世应>0.8。只输出JSON。' },
      { key:'characters', label:'\u4E3B\u8981\u4EBA\u7269', minItems: 12,
        prompt: '\u4F60\u662F\u5929\u547D\u6E38\u620F\u526F\u672C\u8BBE\u8BA1\u5E08\uFF0C\u7CBE\u901A\u4E2D\u56FD\u53E4\u4EE3\u53F2\u3002' + ctx + playerSpec + historicalCharLimit + refContext
          + '\n\u751F\u621012-20\u540D\u91CD\u8981\u4EBA\u7269\uFF0C\u8FD4\u56DEJSON\u6570\u7EC4\u3002'
          + '\n\n\u3010\u6BCF\u4E2A\u4EBA\u7269\u5FC5\u987B\u5305\u542B\u5168\u90E8\u5B57\u6BB5\u3011\uFF1A'
          + '\nname, title(\u5B98\u804C/\u5C01\u53F7), type("historical"\u6216"fictional"), faction, party, role, attitude'
          + '\nage(\u5177\u4F53\u5E74\u9F84\u6570\u5B57), gender, ethnicity, birthplace, faith, culture'
          + '\nappearance(\u7EAF\u5916\u8C8C\u63CF\u5199,30-50\u5B57,\u5982"\u8EAB\u6750\u9AD8\u5927\uFF0C\u9762\u5982\u51A0\u7389\uFF0C\u53CC\u76EE\u70AF\u70AF\u6709\u795E")'
          + '\npersonality(\u6027\u683C\u5173\u952E\u8BCD), personalGoal(\u4E2A\u4EBA\u76EE\u6807)'
          + '\ndescription(\u5916\u8C8C+\u6027\u683C80\u5B57), bio(100-150\u5B57\u7B80\u4ECB)'
          + '\nfamily(\u90E1\u671B\u683C\u5F0F,\u5982"\u9648\u90E1\u8C22\u6C0F"), familyTier(imperial/noble/gentry/common)'
          + '\nloyalty(0-100), ambition(0-100), intelligence(0-100), valor(0-100), administration(0-100), charisma(0-100), diplomacy(0-100,外交社交能力)'
          + '\nspouse(boolean), spouseRank(\u5982empress/consort), motherClan(\u5973\u6027\u6BCD\u65CF)'
          + '\n\n\u3010\u6570\u503C\u89C4\u5219\u2014\u5FC5\u987B\u57FA\u4E8E\u5386\u53F2\u8BB0\u8F7D\u3011\uFF1A'
          + '\n\u53F2\u5B9E\u4EBA\u7269\u7684\u6570\u503C\u5FC5\u987B\u53CD\u6620\u5176\u5386\u53F2\u8BC4\u4EF7\uFF0C\u4E0D\u5F97\u968F\u610F\u7F16\u9020\uFF1A'
          + '\n\u5982\u674E\u9756\u2192valor:92,intelligence:85,administration:70(\u5175\u795E\u2192\u6B66\u529B\u6781\u9AD8+\u667A\u7565\u51FA\u4F17)'
          + '\n\u5982\u9B4F\u5F81\u2192intelligence:60,loyalty:95,administration:88(\u76F4\u8C0F\u4E4B\u81E3\u2192\u5FE0\u8BDA\u6781\u9AD8)'
          + '\n\u5982\u6768\u8D35\u5983\u2192charisma:95,intelligence:65,ambition:45(\u56DB\u5927\u7F8E\u4EBA\u2192\u9B45\u529B\u6781\u9AD8)'
          + '\n\u5982\u5B89\u7984\u5C71\u2192ambition:95,valor:75,loyalty:15(\u91CE\u5FC3\u52C3\u52C3\u2192\u5FE0\u8BDA\u6781\u4F4E)'
          + '\n\u6BCF\u4E2A\u4EBA\u7684\u6570\u503C\u5FC5\u987B\u5404\u4E0D\u76F8\u540C\uFF0C\u7981\u6B62\u590D\u5236\u7C98\u8D34\uFF01'
          + '\n\u540D\u5983\u7684charisma\u5E94\u663E\u8457\u9AD8\u4E8E\u666E\u901A\u4EBA\u7269\uFF08\u5386\u53F2\u7F8E\u4EBA\u2192charisma:85-98\uFF09'
          + '\n\n\u3010\u53F2\u5B9E\u4EBA\u7269\u89C4\u5219\u3011\uFF1A'
          + '\n- \u51E1\u5728\u300A\u4E8C\u5341\u56DB\u53F2\u300B\u300A\u8D44\u6CBB\u901A\u9274\u300B\u7B49\u6B63\u53F2\u4E2D\u6709\u4F20\u8BB0\u7684\u4EBA\u7269\uFF0Ctype\u5FC5\u987B\u5199"historical"'
          + '\n- bio\u4E2D\u5FC5\u987B\u5F15\u7528\u53F2\u6599\u6765\u6E90\uFF0C\u5982"\u636E\u300A\u65E7\u5510\u4E66\u00B7XX\u4F20\u300B\u8BB0\u8F7D\uFF0CXX\u201CXXX\u201D\u2026"'
          + '\n- \u53EA\u6709\u5B8C\u5168\u865A\u6784\u7684\u8D2B\u5BD2\u5C0F\u5352/\u5BB6\u4EC6\u7B49\u624D\u7528"fictional"'
          + '\n\n\u3010\u5176\u4ED6\u89C4\u5219\u3011\uFF1A'
          + '\n- ' + (playerCharacter ? '\u5FC5\u987B\u5305\u542B\u73A9\u5BB6\u89D2\u8272' + playerCharacter : '\u7981\u6B62\u751F\u6210\u73A9\u5BB6\u89D2\u8272(' + emperor + ')')
          + '\n- \u5E94\u5305\u542B1-3\u540D\u540E\u5BAB\u5983\u5ABE(spouse=true,\u6709\u5177\u4F53motherClan)'
          + '\n- faction\u5E94\u5BF9\u5E94\u5DF2\u6709\u52BF\u529B\u6216"' + dynasty + '\u671D\u5EF7"'
          + '\n\u53EA\u8F93\u51FAJSON\u3002' },
      { key:'factions', label:'\u52BF\u529B', minItems: 6,
        prompt: '\u4F60\u662F\u5929\u547D\u6E38\u620F\u526F\u672C\u8BBE\u8BA1\u5E08\u3002' + ctx
          + '\n\u751F\u62106-10\u4E2A\u4E0E\u73A9\u5BB6\u52BF\u529B\u5E76\u5B58\u7684\u72EC\u7ACB\u653F\u6743\u5B9E\u4F53\uFF0C\u8FD4\u56DEJSON\u6570\u7EC4\u3002'
          + '\n\u6BCF\u4E2A\u52BF\u529B\u5FC5\u987B\u5305\u542B\uFF1A'
          + '\n{name,type(\u4E3B\u6743\u56FD/\u85E9\u9547/\u756A\u5C5E\u5C0F\u56FD/\u540D\u4E49\u4ECE\u5C5E),leader,leaderTitle,'
          + '\nterritory(\u5360\u636E\u5730\u76D8),goal(\u6218\u7565\u76EE\u6807),strength(1-100\u6570\u5B57),attitude(\u53CB\u597D/\u4E2D\u7ACB/\u654C\u5BF9/\u9644\u5C5E/\u5B97\u4E3B/\u540D\u4E49\u4ECE\u5C5E/\u671D\u8D21),'
          + '\nresources(\u4E3B\u8981\u8D44\u6E90),mainstream(\u4E3B\u4F53\u6C11\u65CF),culture(\u6587\u5316\u7279\u5F81),'
          + '\nmilitaryStrength(\u5175\u529B\u6982\u4F30,\u6570\u5B57),economy(0-100\u7ECF\u6D4E\u5B9E\u529B),playerRelation(-100~100\u5BF9\u7389\u5173\u7CFB),description(100\u5B57)}'
          + '\n\n\u3010\u91CD\u8981\u3011'
          + '\n- \u4E0D\u8981\u751F\u6210\u73A9\u5BB6\u6240\u5728\u52BF\u529B\uFF08' + dynasty + '\u671D\u5EF7\uFF09'
          + '\n- \u4E0D\u8981\u5C06\u515A\u6D3E\u3001\u9636\u5C42\u3001\u5546\u4F1A\u3001\u5B97\u6559\u7EC4\u7EC7\u5217\u4E3A\u52BF\u529B'
          + '\n- strength\u5FC5\u987B\u662F1-100\u7684\u6570\u5B57\uFF08\u4E0D\u662F\u201C\u5F3A/\u4E2D/\u5F31\u201D\u6587\u5B57\uFF09'
          + '\n- \u5E94\u5305\u542B\u4E0D\u540C\u7C7B\u578B\uFF1A\u81F3\u5C11\u67091\u4E2A\u4E3B\u6743\u56FD\u3001\u82E5\u5E72\u85E9\u9547/\u756A\u5C5E'
          + '\n\u53EA\u8F93\u51FAJSON\u3002' },
      { key:'factionRelations', label:'势力关系', minItems: 3,
        prompt: '你是历史外交关系专家。' + ctx
          + '\n根据已有势力列表，生成所有势力之间的两两关系，返回JSON数组。'
          + '\n已有势力：' + (scriptData.factions||[]).map(function(f){return f.name;}).join('、') + ((scriptData.playerInfo||{}).factionName ? '、' + scriptData.playerInfo.factionName + '(玩家)' : '')
          + '\n每项：{"from":"势力A","to":"势力B","type":"联盟/友好/中立/敌视/交战/朝贡/宗藩/名义从属","value":数值(-100到100),"desc":"一句话原因"}'
          + '\n注意：每对只需一个方向。value正=友好 负=敌对。必须符合历史。只输出JSON。' },
      { key:'parties', label:'党派', minItems: 4,
        prompt: '你是天命游戏副本设计师。' + ctx
          + '\n生成4-6个朝廷内部党派/政治派系，返回JSON数组。'
          + '\n每项必须包含：{name, ideology(派系立场), leader(首领姓名), influence(影响力,数字0-100), members(主要成员,逗号分隔), base(支持群体), status(活跃/式微/被压制/已解散), org(组织程度), shortGoal(短期目标), longGoal(长期追求), currentAgenda(当前最紧迫诉求,如"弹劾宦官"), rivalParty(主要对手党派名), policyStance(政策立场标签数组,如["主战","反宦官"]), description(100字描述)}'
          + '\n注意：influence必须是0-100数字。各党派之间应有明确的对立和议程冲突。只输出JSON。' },
      { key:'classes', label:'阶层', minItems: 5,
        prompt: '你是天命游戏副本设计师。' + ctx
          + '\n生成5-7个社会阶层，返回JSON数组。'
          + '\n每项必须包含：{name, mobility(低/中/高), size(人口规模如"约30%"), privileges(特权), obligations(义务), status(法律地位), satisfaction(满意度,数字0-100), influence(阶层影响力,数字0-100), economicRole(生产/商贸/军事/治理/宗教/手工), demands(当前诉求,如"减轻赋税"), unrestThreshold(不满阈值,数字0-100,低于此满意度→动荡), description(80字描述)}'
          + '\n注意：satisfaction/influence/unrestThreshold必须是数字。只输出JSON。' },
      { key:'items', label:'物品', minItems: 8,
        prompt: '你是天命游戏副本设计师。' + ctx
          + '\n生成8-12件符合时代背景的重要物品，返回JSON数组。'
          + '\n每项：{name, type(weapon/armor/consumable/treasure/document/seal/special), rarity(普通/精良/珍贵/传说), owner(持有者姓名或空), value(价值数字), effect(游戏效果描述), description(50字)}'
          + '\n注意：应包含传国玺/军令状/秘密文书等剧情物品，以及兵器/甲胄等实用物品。owner应从已有角色中选择。只输出JSON。' },
      { key:'military', label:'军事系统', minItems: 6,
        prompt: '你是天命游戏副本设计师。' + ctx
          + '\n生成军事系统数据，返回JSON对象：{initialTroops:[],militarySystem:[]}。'
          + '\n\ninitialTroops为开局部队数组（6-10支），每项必须包含：'
          + '\n- name: 部队名称'
          + '\n- armyType: 部队类型（禁军/边军/藩镇军/地方守备/水师等）'
          + '\n- soldiers: 总兵力（具体数字,3000-50000）'
          + '\n- garrison: 驻地（具体地名+描述,如"洛阳皇城及南郊大营"）'
          + '\n- commander: 统帅姓名'
          + '\n- commanderTitle: 统帅头衔（如"镇西大将军"）'
          + '\n- composition: 兵种组成数组（如[{"type":"重装步卒","count":20000},{"type":"轻骑","count":5000}]），各兵种count之和应≈soldiers'
          + '\n- equipment: 装备数组（如[{"name":"明光铠","count":12000,"condition":"优良"},{"name":"百炼横刀","count":30000,"condition":"优良"}]）'
          + '\n- equipmentCondition: 装备总评（优良/一般/简陋/严重不足）'
          + '\n- salary: 年军饷数组（如[{"resource":"钱","amount":267000,"unit":"贯"},{"resource":"粮食","amount":505000,"unit":"石"}]，单位应符合该剧本的经济体系）'
          + '\n- morale: 士气（60-100整数,禁军95+,普通军70-85）'
          + '\n- training: 训练度（50-100整数）'
          + '\n- loyalty: 忠诚度（50-100整数）'
          + '\n- control: 掌控度（50-100整数,直属90+,藩镇50-70）'
          + '\n- quality: 兵员素质（精锐/普通/新兵）'
          + '\n- description: 部队描述（80字,历史、战斗力、特点）'
          + '\n\n具体兵种和装备应根据剧本朝代、地理位置、科技水平决定。'
          + '\n\nmilitarySystem为军制数组（3-5项），每项：{name,type,era,description,effects}。'
          + '\n\n只输出JSON。',
        validator: function(raw) {
          try {
            var m = raw.match(/\{[\s\S]*\}/);
            if (!m) return {valid: false, reason: '未找到JSON对象'};
            var obj = JSON.parse(m[0]);
            if (!obj.initialTroops || !Array.isArray(obj.initialTroops)) {
              return {valid: false, reason: 'initialTroops字段缺失或格式错误'};
            }
            if (obj.initialTroops.length < 6) {
              return {valid: false, reason: '部队数量不足（需要至少6支）'};
            }
            // 检查每个部队是否有有效的兵力字段
            var invalidTroops = [];
            obj.initialTroops.forEach(function(t, idx) {
              var s = t.soldiers || t.size || t.strength || 0;
              if (!s || s <= 0) {
                invalidTroops.push(t.name || ('部队' + (idx+1)));
              }
              // 统一字段名
              if (t.size && !t.soldiers) t.soldiers = t.size;
              if (t.location && !t.garrison) t.garrison = t.location;
            });
            if (invalidTroops.length > 0) {
              return {valid: false, reason: '以下部队兵力为0或未定义：' + invalidTroops.join('、')};
            }
            return {valid: true};
          } catch(e) {
            return {valid: false, reason: 'JSON解析失败：' + e.message};
          }
        }
      },
      { key:'variables_base', label:'基础变量', minItems: 8,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n生成8-12个通用基础变量，返回JSON数组，每项：{name,type,defaultValue,description}，type为number/string/boolean之一。例如：国库、民心、军心、粮食储备、人口、税率等。\n\n【重要】变量名称(name字段)必须使用简体中文，不得使用英文或拼音。例如："国库"、"民心"、"粮食储备"等。\n\n只输出JSON。' },
      { key:'variables_other', label:'剧本变量', minItems: 5,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n生成5-8个该剧本特有的变量，返回JSON数组，每项：{name,type,defaultValue,description}。这些变量应与剧本背景紧密相关。\n\n【重要】变量名称(name字段)必须使用简体中文，不得使用英文或拼音。例如："宦官势力"、"藩镇割据度"、"科举公正度"等。\n\n只输出JSON。' },
      { key:'adminHierarchy', label:'\u884C\u653F\u533A\u5212', minItems: 8,
        prompt: '\u4F60\u662F\u5929\u547D\u6E38\u620F\u526F\u672C\u8BBE\u8BA1\u5E08\uFF0C\u7CBE\u901A\u4E2D\u56FD\u5386\u53F2\u884C\u653F\u533A\u5212\u3002' + ctx
          + '\n\u4E3A\u73A9\u5BB6\u52BF\u529B\u751F\u6210\u884C\u653F\u533A\u5212\u6811\uFF0C\u5305\u542B2-3\u5C42\u5D4C\u5957\u3002'
          + '\n\u8FD4\u56DEJSON\u6570\u7EC4\uFF0C\u6BCF\u9879\uFF1A{id,name,level,description,children}\u3002'
          + '\n\u7B2C\u4E00\u5C42\uFF1A8-12\u4E2A\u9876\u5C42\u884C\u653F\u533A\uFF08\u5982\u5510\u4EE3\u7684\u201C\u9053\u201D\u3001\u5B8B\u4EE3\u7684\u201C\u8DEF\u201D\u3001\u660E\u4EE3\u7684\u201C\u5E03\u653F\u4F7F\u53F8\u201D\uFF09'
          + '\n\u7B2C\u4E8C\u5C42\uFF1A\u6BCF\u4E2A\u9876\u5C42\u533A\u4E0B3-6\u4E2A\u4E0B\u7EA7\u533A\uFF08\u5982\u201C\u5DDE\u201D\u201C\u5E9C\u201D\u201C\u90E1\u201D\uFF09'
          + '\n\u7B2C\u4E09\u5C42\uFF08\u53EF\u9009\uFF09\uFF1A\u91CD\u8981\u7684\u53BF/\u57CE\u53EF\u52A0\u5165'
          + '\n\u5FC5\u987B\u6839\u636E\u8BE5\u671D\u4EE3\u5B9E\u9645\u884C\u653F\u5236\u5EA6\u9009\u62E9\u5408\u9002\u5C42\u7EA7\u540D\u79F0\u3002'
          + '\nlevel\u53EF\u9009\uFF1Acountry/province/prefecture/county/district\u3002'
          + '\nid\u683C\u5F0F\u4E3A"admin_\u62FC\u97F3"\u3002\u53EA\u8F93\u51FAJSON\u3002' },
      { key:'worldSettings', label:'世界设定', minItems: 0,
        prompt: '你是历史文化专家。' + ctx + '\n生成该历史背景下的详细世界设定，返回JSON对象：{culture,weather,religion,economy,technology,diplomacy}。\n每个字段80-150字，必须有具体细节和历史依据。\nculture=文化风俗+社会风气+礼制；weather=地理气候+四季特征+对农军影响；religion=宗教信仰+僧道势力；economy=经济形态+赋税+贸易；technology=科技水平+关键发明；diplomacy=外交格局+周边关系。\n只输出JSON。' },
      { key:'government', label:'政体信息', minItems: 0,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n生成该朝代的政体信息，返回json对象：{name,description,selectionSystem,promotionSystem}，description 3-5句，其余字段1-2句。只输出json。' },
      { key:'economyConfig', label:'经济配置', minItems: 0,
        prompt: '你是天命游戏副本设计师和历史经济专家。' + ctx + '\n根据该历史时期的经济特征，生成经济配置参数，返回JSON对象：{redistributionRate,baseIncome,taxRate,inflationRate,tradeBonus,agricultureMultiplier,commerceMultiplier}。\n\n参数说明：\n- redistributionRate（0-1）：中央回拨比例，集权度高时0.2-0.3，集权度低时0.4-0.5\n- baseIncome（10-10000）：基础月度收入，繁荣时代可提高到200-500\n- taxRate（0-1）：基础税率，通常0.15-0.25\n- inflationRate（0-0.2）：通货膨胀率，稳定时代0.01-0.03，动荡时代0.05-0.15\n- tradeBonus（0-1）：贸易加成，贸易繁荣时代（如宋代）0.2-0.4，其他0.05-0.15\n- agricultureMultiplier（0.1-5）：农业产出系数，农业时代1.0-1.5\n- commerceMultiplier（0.1-5）：商业产出系数，商业繁荣时代1.5-2.5\n\n只输出JSON。' },
      { key:'buildingSystem', label:'建筑系统', minItems: 10,
        prompt: '你是天命游戏副本设计师和中国古代历史专家。' + ctx + '\n生成该朝代的典型建筑类型列表，返回JSON对象：{buildingTypes:[]}。\n\nbuildingTypes数组每项包含：\n{\n  "name": "农田",  // 建筑名称（简体中文）\n  "category": "economic",  // economic/military/cultural/administrative\n  "description": "开垦农田种植粮食，是农业社会的基础设施，直接影响地方的粮食产量和人口承载力"  // 建筑的历史文化描述，不要写具体数值\n}\n\n要求：\n1. 生成10-15个建筑类型，涵盖四大类别（经济、军事、文化、行政）\n2. 建筑名称必须使用简体中文，符合该朝代的历史背景\n3. 经济类建筑：农田、集市、工坊、矿场、渔场、盐场、茶园等\n4. 军事类建筑：兵营、马厩、军械库、城防、箭楼、烽火台等\n5. 文化类建筑：书院、庙宇、藏书楼、戏台、驿站等\n6. 行政类建筑：官署、仓库、驿站、税务所等\n7. description要详细描述建筑的历史文化意义和作用，不要写具体数值（如"+50金"）\n8. 考虑该朝代特色，生成符合时代背景的特色建筑\n9. 这些建筑是为了让AI推演时有历史背景知识，不是游戏机制\n10. 只返回JSON，不要其他文字' },
      { key:'postSystem', label:'岗位系统', minItems: 5,
        prompt: '你是天命游戏副本设计师和中国古代官制专家。' + ctx + '\n生成该朝代的官职运作规则，返回JSON对象：{postRules:[]}。\n\npostRules数组每项包含：\n{\n  "positionName": "节度使",  // 官职名称（简体中文）\n  "succession": "hereditary",  // hereditary=世袭，bureaucratic=流官\n  "hasAppointmentRight": true,  // 是否拥有辟署权\n  "description": "节度使掌管一方军政大权，唐末以来逐渐形成世袭制度，拥有辖区内的人事任命权"  // 规则的历史背景描述\n}\n\n要求：\n1. 生成5-10个主要官职的运作规则\n2. 官职名称必须使用简体中文，符合该朝代的历史背景\n3. 根据历史实际情况判断继承方式：秦汉郡县为流官，唐末藩镇为世袭，宋明清为流官\n4. 辟署权通常只有节度使、藩镇等地方割据势力拥有\n5. description要详细描述该官职的历史运作方式和特点\n6. 这些规则是为了让AI推演时符合历史逻辑，不是游戏机制\n7. 只返回JSON，不要其他文字' },
      { key:'keju', label:'科举配置', minItems: 0,
        prompt: '你是中国古代科举制度专家。' + ctx
          + '\n判断该朝代是否有科举制度，返回JSON对象。'
          + '\n{enabled(bool,隋唐及之后为true,之前为false), reformed(bool,通过改革启用=true), examIntervalNote(考试间隔说明,如"三年一科"或"不定期"), examNote(科举制度特色描述80字), examSubjects(考试科目,如"进士科/明经科/武举"), quotaPerExam(每科取士人数,数字), specialRules(特殊规则,如"糊名制""避讳规则"等)}'
          + '\n如果该朝代无科举（如先秦、秦汉），enabled=false且其他字段描述替代选才制度（如察举制、九品中正制）。只输出JSON。' },
      { key:'vassalSystem', label:'封臣系统', minItems: 0,
        prompt: '你是天命游戏副本设计师和中国古代封建制度专家。' + ctx + '\n生成该朝代的封臣类型列表，返回JSON对象：{vassalTypes:[]}。\n\nvassalTypes数组每项包含：\n{\n  "name": "藩镇节度使",  // 封臣类型名称（简体中文）\n  "rank": "高级封臣",  // 高级封臣/中级封臣/低级封臣\n  "obligations": "每年向朝廷缴纳贡奉、应征时提供军队、定期朝觐",  // 义务描述\n  "rights": "辖区内军政自主、可自行任命官员、拥有辟署权",  // 权利描述\n  "succession": "世袭",  // 继承方式\n  "era": "唐末五代",  // 适用时代\n  "relatedTo": "官制-节度使、行政区划-藩镇",  // 关联系统\n  "description": "详细描述该封臣类型的历史背景、特点等"  // 详细描述\n}\n\n要求：\n1. 根据历史实际情况判断：\n   - 秦汉：郡县制，无封臣关系，返回空数组[]\n   - 魏晋：门阀世族，半封建半郡县，生成2-3个类型\n   - 唐末五代：藩镇割据，节度使为封臣，生成3-5个类型\n   - 宋代：中央集权，封臣关系弱化，生成1-2个类型\n   - 明清：郡县制，但有藩王体系，生成2-3个类型\n2. 每个类型要包含义务、权利、继承方式等关键信息\n3. 这是为了让AI推演时符合历史逻辑，不是游戏机制\n4. 只返回JSON，不要其他文字' },
      { key:'titleSystem', label:'头衔系统', minItems: 0,
        prompt: '你是天命游戏副本设计师和中国古代爵位制度专家。' + ctx + '\n生成该朝代的头衔等级列表，返回JSON对象：{titleRanks:[]}。\n\ntitleRanks数组每项包含：\n{\n  "name": "镇国公",  // 头衔名称（简体中文）\n  "level": 2,  // 等级（1-20，数字越小等级越高）\n  "category": "公爵",  // 王爵/公爵/侯爵/伯爵/子爵/男爵/其他\n  "succession": "世袭罔替",  // 继承方式\n  "privileges": "享有封地、免除赋税、参与朝政",  // 特权描述\n  "requirements": "皇室宗亲、军功卓著、世代忠臣",  // 授予条件\n  "era": "唐代",  // 适用时代\n  "relatedTo": "封臣系统、官制系统",  // 关联系统\n  "description": "详细描述该头衔的历史背景、特点等"  // 详细描述\n}\n\n要求：\n1. 根据历史实际情况：\n   - 秦汉：二十等军功爵，生成8-12个等级\n   - 魏晋：九品中正制，生成5-8个等级\n   - 唐宋：五等爵制（王、公、侯、伯、子、男），生成5-10个等级\n   - 明清：世袭递降制度，生成6-10个等级\n2. 每个等级要包含特权、授予条件、继承方式等关键信息\n3. level字段要按等级高低排序（1最高，20最低）\n4. 这是为了让AI推演时使用正确的称谓和权力等级，不是游戏机制\n5. 只返回JSON，不要其他文字' },
      { key:'officeTree', label:'官制部门', minItems: 6,
        prompt: '你是天命游戏副本设计师，精通中国历史官制。' + ctx + '\n生成该朝代的顶层官制部门（6-10个），返回json数组，每个部门格式：{name,description,functions,positions,subs}，functions为职能字符串数组，positions为官职数组（每项{name,rank,duties}，duties必须50字以上），subs暂时为空数组[]。只输出json。' },
      { key:'techTree', label:'科技树', minItems: 6,
        prompt: '你是天命游戏副本设计师。' + ctx
          + '\n生成6-10个该朝代的科技/技术条目，返回JSON数组。'
          + '\n每项：{name, category("military"或"civil"), era("初级"/"中级"/"高级"/"顶级"), prereqs(前置科技名数组,如["铸铁术"]), costs(费用数组,如[{"variable":"钱","amount":500}]), effect(效果对象,如{"军事专业度":0.05}), description(50字)}'
          + '\n费用变量名应使用剧本中已定义的变量。效果可用变量名或时代参数名。只输出JSON。' },
      { key:'civicTree', label:'民政树', minItems: 6,
        prompt: '你是天命游戏副本设计师。' + ctx
          + '\n生成6-10个该朝代的民政/政策条目，返回JSON数组。'
          + '\n每项：{name, category("city"/"policy"/"resource"/"corruption"), era("初级"/"中级"/"高级"), prereqs(前置政策名数组), costs(费用数组,如[{"variable":"钱","amount":300}]), effect(效果对象,如{"社会稳定":0.03}), description(50字)}'
          + '\n只输出JSON。' },
      { key:'rules', label:'规则', minItems: 0,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n为该剧本生成4-6条核心游戏规则，返回JSON数组，每项：{name,category,content}，category为base/combat/economy/diplomacy之一，content为规则详细描述（50-100字）。只输出JSON。' },
      { key:'events', label:'事件', minItems: 6,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n为该剧本生成6-10个历史事件，返回JSON数组，每项：{name,type,trigger,description,effect}，type为historical/random/conditional/story之一，trigger为触发条件描述，effect为影响描述。只输出JSON。' },
      { key:'timeline', label:'时间线', minItems: 4,
        prompt: '你是天命游戏副本设计师。' + ctx
          + '\n\n【已有角色】' + (scriptData.characters.length > 0 ? scriptData.characters.map(function(c){return c.name;}).join('、') : '暂无')
          + '\n【已有势力】' + (scriptData.factions.length > 0 ? scriptData.factions.map(function(f){return f.name;}).join('、') : '暂无')
          + '\n\n生成6-10个时间线事件（过去已发生+未来可能发生），返回JSON数组。'
          + '\n每项：{name(事件名), year(时间如"建安四年春"), type("past"或"future"), importance("关键"/"重要"/"普通"), description(80字), linkedChars(关联角色名——必须从已有角色中选取), linkedFactions(关联势力名——必须从已有势力中选取)}'
          + '\n未来事件还需：triggerCondition(触发条件描述,供AI推演时参考)'
          + '\n过去事件应为真实历史/已在剧本中发生的；未来事件应为可能发生的走向。linkedChars和linkedFactions必须引用上面列出的已有名称。只输出JSON。' },
      { key:'goals', label:'目标条件', minItems: 3,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n为该剧本生成3-5个胜负条件和里程碑，返回JSON数组，每项：{name,type,description,conditions}，type为win/lose/milestone之一，conditions为条件数组[{type:"variable_gte",variable:"变量名",value:数值}]。只输出JSON。' },
      { key:'relations', label:'关系', minItems: 3,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n生成3-6个该剧本的核心外交/势力关系，返回JSON数组，每项：{name,value,min,max,description}，name为关系名称（如"与某国关系""藩镇控制度"），value为当前值（-100到100），min/max为范围。只输出JSON。' },
      { key:'variables_formulas', label:'变量关联公式', minItems: 2,
        prompt: '你是天命游戏副本设计师。' + ctx + '\n基于已生成的变量，生成2-5个变量间的关联规则/公式，返回JSON数组，每项：{name,expression,relatedVars,description}。name为规则名（如"军饷支出"），expression为公式文本（如"兵力总数×饷银单价"），relatedVars为相关变量名数组，description为规则说明。这些公式让AI理解变量间的逻辑关系。只输出JSON。' },
      { key:'haremConfig', label:'后宫位份', minItems: 0,
        prompt: '你是天命游戏副本设计师和中国古代后宫制度专家。' + ctx + '\n根据该朝代的后宫制度，生成后宫位份等级列表，返回JSON对象：{rankSystem:[],succession:"eldest_legitimate"}。rankSystem数组每项：{id:"英文id",name:"中文位份名",level:数字（0最尊）}。按尊卑排序。不同朝代后宫制度差异极大——汉代有十四等，唐代有正一品到正八品，明清有皇后-贵妃-妃-嫔-贵人-常在-答应。请严格按照该朝代实际制度。只输出JSON。' },
      { key:'coreContradictions', label:'显著矛盾', minItems: 4,
        prompt: '你是精通' + (scriptData.dynasty||'中国历史') + '和黑格尔辩证法的历史学家。' + ctx + '\n【哲学基础】矛盾是推动事物发展的源泉（黑格尔）。\n请生成玩家势力面临的核心矛盾，覆盖政治、经济、军事、社会四大维度。\n返回JSON数组，每项：{title:"矛盾标题(8字内)",dimension:"political/economic/military/social",severity:"critical/major/minor",parties:"冲突双方(X vs Y)",description:"详细描述(80-150字，含历史根源、当前态势)"}\n要求：4-6个矛盾，至少1个致命+2个重大，基于真实历史，矛盾之间有联动关系。只输出JSON数组。' }
    ];
    // show progress overlay
    var fgp = document.getElementById('fullGenProgress');
    var fgpLabel = document.getElementById('fgp-label');
    var fgpBar = document.getElementById('fgp-bar');
    var fgpStep = document.getElementById('fgp-step');
    if (fgp) { fgp.style.display = 'flex'; }
    function setProgress(idx, label) {
      var pct = Math.round((idx / steps.length) * 100);
      if (fgpBar) fgpBar.style.width = pct + '%';
      if (fgpLabel) fgpLabel.textContent = label || '';
      if (fgpStep) fgpStep.textContent = idx + ' / ' + steps.length;
    }
    function hideProgress() {
      if (fgp) fgp.style.display = 'none';
    }
    setProgress(0, '准备生成…');

    // 严格史实模式：显示数据库检索步骤
    if (gameMode === 'strict_hist') {
      setProgress(0, '检索数据库中…');
      setTimeout(function() {
        // 数据库检索完成，开始生成
        startGeneration();
      }, 800);
    } else {
      // 其他模式直接开始生成
      startGeneration();
    }

    function startGeneration() {
      runStep(0);
    }

    // 提升到 doFullGenerate 作用域——让 performHistoricalCheck 可访问
    function finishGeneration() {
      setProgress(steps.length, '生成完成');
      setTimeout(function() {
        hideProgress();
        renderAll();
        autoSave();
        showToast('一键生成完成！请检查各板块内容');
      }, 600);
      return;
    }
    // 健壮的JSON数组提取——处理markdown包装、对象包装等常见AI响应格式
    function _robustParseArray(raw) {
      var cl = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      try { var p = JSON.parse(cl); if (Array.isArray(p)) return p; if (typeof p === 'object') { for (var k in p) { if (Array.isArray(p[k])) return p[k]; } } } catch(e) {}
      var m = cl.match(/\[\s*\{[\s\S]*\]/); if (m) try { return JSON.parse(m[0]); } catch(e) {}
      var om = cl.match(/\{[\s\S]*\}/); if (om) try { var o = JSON.parse(om[0]); for (var k2 in o) { if (Array.isArray(o[k2])) return o[k2]; } if (o.name) return [o]; } catch(e) {}
      return null;
    }

    function runStep(idx) {
      if (idx >= steps.length) {
        // 生成完成后，轻度史实和严格史实模式需要进行历史检查
        if (gameMode === 'light_hist' || gameMode === 'strict_hist') {
          setProgress(steps.length, '历史检查中…');
          setTimeout(function() {
            try { performHistoricalCheck(); }
            catch (_hcE) { console.error('[HistCheck] 异常', _hcE); finishGeneration(); }
          }, 1000);
        } else {
          // 演义模式直接完成
          finishGeneration();
        }
        return;
      }
      var s = steps[idx];
      setProgress(idx, '正在生成' + s.label + '…');
      var _prompt = s.prompt;

      // Build existing content context for incremental generation
      var existingContext = '';

      // For scriptInfo: include existing overview and openingText
      if (s.key === 'scriptInfo') {
        if (scriptData.name || scriptData.overview || scriptData.openingText) {
          existingContext = '\n\n【已有剧本信息】\n';
          if (scriptData.name) existingContext += '剧本名称：' + scriptData.name + '\n';
          if (scriptData.overview) existingContext += '剧本总述：' + scriptData.overview.substring(0, 500) + (scriptData.overview.length > 500 ? '...' : '') + '\n';
          if (scriptData.openingText) existingContext += '开场白：' + scriptData.openingText.substring(0, 300) + (scriptData.openingText.length > 300 ? '...' : '') + '\n';
          existingContext += '\n请在现有基础上补充完善，增加更多细节，不要完全重写。\n';
        }
      }
      // For playerInfo: include existing player info
      else if (s.key === 'playerInfo') {
        var pi = scriptData.playerInfo;
        if (pi && (pi.factionName || pi.factionDesc || pi.characterName || pi.characterDesc)) {
          existingContext = '\n\n【已有玩家角色信息】\n' + JSON.stringify(pi, null, 2) + '\n\n请在现有基础上补充完善。\n';
        }
      }
      // For eraState: include existing era state
      else if (s.key === 'eraState') {
        var es = scriptData.eraState;
        if (es && es.contextDescription) {
          existingContext = '\n\n【已有本国状态】\n' + JSON.stringify(es, null, 2) + '\n\n请在现有基础上补充完善，调整数值使其更符合历史实际。\n';
        }
      }
      // For worldSettings: include existing settings
      else if (s.key === 'worldSettings') {
        var ws = scriptData.worldSettings;
        if (ws && (ws.culture || ws.weather || ws.religion || ws.economy || ws.technology || ws.diplomacy)) {
          existingContext = '\n\n【已有世界设定】\n' + JSON.stringify(ws, null, 2) + '\n\n请在现有设定基础上补充完善，增加更多细节描述。\n';
        }
      }
      // For government: include existing government info
      else if (s.key === 'government') {
        var gov = scriptData.government;
        if (gov && (gov.name || gov.description || gov.selectionSystem || gov.promotionSystem)) {
          existingContext = '\n\n【已有政体信息】\n' + JSON.stringify(gov, null, 2) + '\n\n请在现有基础上补充完善。\n';
        }
      }
      // For officeTree: include existing office structure
      else if (s.key === 'officeTree') {
        if (scriptData.officeTree && scriptData.officeTree.length > 0) {
          existingContext = '\n\n【已有官制部门】\n' + JSON.stringify(scriptData.officeTree, null, 2).substring(0, 1500) + '...\n\n请在现有官制基础上补充缺失的部门和官职。\n';
        }
      }
      // For adminHierarchy: include existing structure
      else if (s.key === 'adminHierarchy') {
        if (scriptData.adminHierarchy && scriptData.adminHierarchy.player && scriptData.adminHierarchy.player.divisions && scriptData.adminHierarchy.player.divisions.length > 0) {
          existingContext = '\n\n【已有行政区划】\n' + JSON.stringify(scriptData.adminHierarchy.player.divisions, null, 2).substring(0, 1500) + '...\n\n请补充缺失的行政区。\n';
        }
      }
      // For military: include existing military data
      else if (s.key === 'military') {
        if (scriptData.military && (scriptData.military.initialTroops || scriptData.military.militarySystem)) {
          existingContext = '\n\n【已有军事数据】\n';
          if (scriptData.military.initialTroops && scriptData.military.initialTroops.length > 0) {
            existingContext += '开局部队：' + scriptData.military.initialTroops.map(function(t){ return t.name; }).join('、') + '\n';
          }
          if (scriptData.military.militarySystem && scriptData.military.militarySystem.length > 0) {
            existingContext += '军制：' + scriptData.military.militarySystem.map(function(m){ return m.name; }).join('、') + '\n';
          }
          existingContext += '\n请补充更多军事内容。\n';
        }
      }
      // For variables: include existing variables
      else if (s.key === 'variables_base' || s.key === 'variables_other') {
        var varType = s.key === 'variables_base' ? 'base' : 'other';
        if (scriptData.variables && scriptData.variables[varType] && scriptData.variables[varType].length > 0) {
          existingContext = '\n\n【已有变量】\n' + scriptData.variables[varType].map(function(v){ return v.name; }).join('、') + '\n\n请补充更多变量，不要重复。\n';
        }
      }
      // For list-based content: include existing names and details
      else if (Array.isArray(scriptData[s.key]) && scriptData[s.key].length) {
        var _names = scriptData[s.key].map(function(x){return x.name||'';}).filter(Boolean);
        if (_names.length > 0) {
          existingContext = '\n\n【已有' + s.label + '】\n';
          existingContext += _names.join('、') + '\n';

          // Add detailed content for better context (per system type)
          if (s.key === 'characters' && scriptData.characters.length > 0) {
            existingContext += '\n详情：\n' + scriptData.characters.slice(0, 12).map(function(c) {
              return '- ' + c.name + '（' + (c.faction||'') + '，' + (c.role||'') + '）：' + (c.bio||c.description||'').substring(0, 80);
            }).join('\n') + (scriptData.characters.length > 12 ? '\n...等共' + scriptData.characters.length + '人' : '') + '\n';
          } else if (s.key === 'factions' && scriptData.factions.length > 0) {
            existingContext += '\n详情：\n' + scriptData.factions.map(function(f) {
              return '- ' + f.name + (f.leader ? '(领袖:' + f.leader + ')' : '') + '：' + (f.description||'').substring(0, 80);
            }).join('\n') + '\n';
          } else if (s.key === 'parties' && scriptData.parties && scriptData.parties.length > 0) {
            existingContext += '\n详情：\n' + scriptData.parties.map(function(p) {
              return '- ' + p.name + (p.leader ? '(领袖:' + p.leader + ')' : '') + ' ' + (p.ideology||'') + '：' + (p.description||'').substring(0, 60);
            }).join('\n') + '\n';
          } else if (s.key === 'events') {
            var evtSum = [];
            ['historical','random','conditional','story','chain'].forEach(function(k) {
              if (scriptData.events && scriptData.events[k] && scriptData.events[k].length > 0) {
                evtSum.push(k + '(' + scriptData.events[k].length + '): ' + scriptData.events[k].map(function(e) { return e.name; }).join('、'));
              }
            });
            if (evtSum.length) existingContext += '\n详情：\n' + evtSum.join('\n') + '\n';
          } else if (s.key === 'goals' && scriptData.goals && scriptData.goals.length > 0) {
            existingContext += '\n详情：\n' + scriptData.goals.map(function(g) {
              return '- [' + g.type + '] ' + g.name + '：' + (g.description||'').substring(0, 60);
            }).join('\n') + '\n';
          }

          existingContext += '\n请在此基础上补充新的' + s.label + '，不要重复已有内容，丰富完善扩展现有内容。\n';
        }
      }

      _prompt += existingContext;

      // Use smart AI call with auto-retry and min items check
      console.log('[FullGen] 开始生成步骤:', s.label, '(key:', s.key, ')');
      var callOptions = { minItems: s.minItems || 0, maxRetries: 3 };
      if (s.validator) {
        callOptions.validator = s.validator;
      }
      callAIEditorSmart(_prompt, 3000, callOptions).then(function(raw) {
        console.log('[FullGen] \u6B65\u9AA4', s.label, 'AI\u8FD4\u56DE\u6210\u529F\uFF0C\u957F\u5EA6:', raw.length);
        // 统一清理markdown代码块包装
        raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        try {
          if (s.key === 'scriptInfo') {
            var m = raw.match(/\{[\s\S]*\}/);
            var obj = JSON.parse(m ? m[0] : raw);
            if (obj.name) { scriptData.name = obj.name; var _el = document.getElementById('scriptName'); if (_el) _el.value = obj.name; }
            if (obj.dynasty) { scriptData.dynasty = obj.dynasty; var _el2 = document.getElementById('scriptDynasty'); if (_el2) _el2.value = obj.dynasty; }
            if (obj.emperor) { scriptData.emperor = obj.emperor; var _el3 = document.getElementById('scriptEmperor'); if (_el3) _el3.value = obj.emperor; }
            if (obj.overview) { scriptData.overview = obj.overview; var _el4 = document.getElementById('scriptOverview'); if (_el4) _el4.value = obj.overview; }
            if (obj.openingText) { scriptData.openingText = obj.openingText; var _el5 = document.getElementById('scriptOpeningText'); if (_el5) _el5.value = obj.openingText; }
            if (obj.globalRules) { scriptData.globalRules = obj.globalRules; var _el6 = document.getElementById('gs-globalRules'); if (_el6) _el6.value = obj.globalRules; }
          } else if (s.key === 'playerInfo') {
            var mpi = raw.match(/\{[\s\S]*\}/);
            var pi = JSON.parse(mpi ? mpi[0] : raw);
            if (!scriptData.playerInfo) scriptData.playerInfo = {};
            ['factionName','factionType','factionLeader','factionLeaderTitle','factionTerritory','factionStrength','factionCulture','factionGoal','factionResources','factionDesc','characterName','characterTitle','characterFaction','characterAge','characterGender','characterPersonality','characterFaith','characterCulture','characterBio','characterDesc'].forEach(function(k) {
              if (pi[k]) scriptData.playerInfo[k] = pi[k];
            });
          } else if (s.key === 'eraState') {
            var mes = raw.match(/\{[\s\S]*\}/);
            var es = JSON.parse(mes ? mes[0] : raw);
            ['politicalUnity','centralControl','legitimacySource','socialStability','economicProsperity','culturalVibrancy','bureaucracyStrength','militaryProfessionalism','landSystemType','dynastyPhase','contextDescription'].forEach(function(k) {
              if (es[k] !== undefined) scriptData.eraState[k] = es[k];
            });
          } else if (s.key === 'worldSettings') {
            var mws = raw.match(/\{[\s\S]*\}/);
            var ws = JSON.parse(mws ? mws[0] : raw);
            ['culture','weather','religion','economy','technology','diplomacy'].forEach(function(k) {
              if (ws[k]) scriptData.worldSettings[k] = ws[k];
            });
          } else if (s.key === 'government') {
            var mgov = raw.match(/\{[\s\S]*\}/);
            var gov = JSON.parse(mgov ? mgov[0] : raw);
            ['name','description','selectionSystem','promotionSystem'].forEach(function(k) {
              if (gov[k]) scriptData.government[k] = gov[k];
            });
          } else if (s.key === 'economyConfig') {
            var _ecClean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            var mec = _ecClean.match(/\{[\s\S]*\}/);
            var ec = JSON.parse(mec ? mec[0] : _ecClean);
            if (!scriptData.economyConfig) scriptData.economyConfig = {};
            ['redistributionRate','baseIncome','taxRate','inflationRate','tradeBonus','agricultureMultiplier','commerceMultiplier'].forEach(function(k) {
              if (ec[k] !== undefined) scriptData.economyConfig[k] = ec[k];
            });
          } else if (s.key === 'buildingSystem') {
            var _bsClean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            var mbs = _bsClean.match(/\{[\s\S]*\}/);
            var bs = null;
            try { bs = JSON.parse(mbs ? mbs[0] : _bsClean); } catch(e) { var _bsArr = _robustParseArray(raw); if (_bsArr) bs = {buildingTypes: _bsArr}; }
            if (!scriptData.buildingSystem) scriptData.buildingSystem = { enabled: false, buildingTypes: [] };
            if (bs && bs.buildingTypes && Array.isArray(bs.buildingTypes)) {
              scriptData.buildingSystem.buildingTypes = bs.buildingTypes;
              console.log('[FullGen] \u5EFA\u7B51\u7CFB\u7EDF\u751F\u6210\u6210\u529F\uFF0C\u5171', bs.buildingTypes.length, '\u4E2A\u5EFA\u7B51\u7C7B\u578B');
            }
          } else if (s.key === 'postSystem') {
            var _psClean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            var mps = _psClean.match(/\{[\s\S]*\}/);
            var ps = null;
            try { ps = JSON.parse(mps ? mps[0] : _psClean); } catch(e) { var _psArr = _robustParseArray(raw); if (_psArr) ps = {postRules: _psArr}; }
            if (!scriptData.postSystem) scriptData.postSystem = { enabled: false, postRules: [] };
            if (ps && ps.postRules && Array.isArray(ps.postRules)) {
              scriptData.postSystem.postRules = ps.postRules;
              console.log('[FullGen] \u5C97\u4F4D\u7CFB\u7EDF\u751F\u6210\u6210\u529F\uFF0C\u5171', ps.postRules.length, '\u4E2A\u89C4\u5219');
            }
          } else if (s.key === 'vassalSystem') {
            var mvs = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim().match(/\{[\s\S]*\}/);
            var vs = JSON.parse(mvs ? mvs[0] : raw);
            if (!scriptData.vassalSystem) scriptData.vassalSystem = { enabled: false, vassalTypes: [], officialVassalMapping: {} };
            if (!scriptData.vassalSystem.officialVassalMapping) scriptData.vassalSystem.officialVassalMapping = {};
            if (vs.vassalTypes && Array.isArray(vs.vassalTypes)) {
              scriptData.vassalSystem.vassalTypes = vs.vassalTypes;

              // Auto-build officialVassalMapping from relatedOfficials
              vs.vassalTypes.forEach(function(vt) {
                if (vt.relatedOfficials) {
                  var officials = vt.relatedOfficials.split(/[,，、]/);
                  officials.forEach(function(official) {
                    var trimmed = official.trim();
                    if (trimmed) {
                      scriptData.vassalSystem.officialVassalMapping[trimmed] = vt.name;
                    }
                  });
                }
              });

              console.log('[FullGen] 封臣系统生成成功，共', vs.vassalTypes.length, '个封臣类型');
            }
          } else if (s.key === 'titleSystem') {
            var _tsClean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            var mts = _tsClean.match(/\{[\s\S]*\}/);
            var ts = null;
            try { ts = JSON.parse(mts ? mts[0] : _tsClean); } catch(e) { var _tsArr = _robustParseArray(raw); if (_tsArr) ts = {titleRanks: _tsArr}; }
            if (!scriptData.titleSystem) scriptData.titleSystem = { enabled: false, titleRanks: [] };
            if (ts.titleRanks && Array.isArray(ts.titleRanks)) {
              scriptData.titleSystem.titleRanks = ts.titleRanks;
              console.log('[FullGen] 头衔系统生成成功，共', ts.titleRanks.length, '个头衔等级');
            }
          } else if (s.key === 'officeTree') {
            var mot = raw.match(/\[\s*\{[\s\S]*\]/);
            var ot = JSON.parse(mot ? mot[0] : raw);
            if (Array.isArray(ot)) {
              if (!Array.isArray(scriptData.officeTree)) scriptData.officeTree = [];
              ot.forEach(function(item) {
                // Ensure required fields
                if (!item.positions) item.positions = [];
                if (!item.subs) item.subs = [];
                if (!item.functions) item.functions = [];
                var exists = scriptData.officeTree.some(function(x){return x.name===item.name;});
                if (!exists) scriptData.officeTree.push(item);
              });
            }
          } else if (s.key === 'military') {
            var mmil = raw.match(/\{[\s\S]*\}/);
            var mil = JSON.parse(mmil ? mmil[0] : raw);
            if (!scriptData.military) scriptData.military = {troops:[],facilities:[],organization:[],campaigns:[],initialTroops:[],militarySystem:[]};
            var addedTroops = 0, addedSystems = 0;
            if (mil.initialTroops && Array.isArray(mil.initialTroops)) {
              mil.initialTroops.forEach(function(item) {
                // 确保必要字段存在
                if (!item.equipment) item.equipment = [];
                if (!item.size || item.size === 0) {
                  // 如果 size 为 0 或未定义，根据部队类型设置默认值
                  if (item.type && (item.type.includes('禁军') || item.type.includes('精锐'))) {
                    item.size = 10000;
                  } else if (item.type && item.type.includes('主力')) {
                    item.size = 25000;
                  } else {
                    item.size = 5000;
                  }
                  console.warn('[FullGen] 部队', item.name, 'size为0，已设置默认值:', item.size);
                }
                if (!item.morale) item.morale = 70;
                if (!item.commander) item.commander = '待任命';
                if (!item.location) item.location = '待部署';

                var exists = scriptData.military.initialTroops.some(function(x){return x.name===item.name;});
                if (!exists) {
                  scriptData.military.initialTroops.push(item);
                  addedTroops++;
                }
              });
            }
            if (mil.militarySystem && Array.isArray(mil.militarySystem)) {
              mil.militarySystem.forEach(function(item) {
                var exists = scriptData.military.militarySystem.some(function(x){return x.name===item.name;});
                if (!exists) {
                  scriptData.military.militarySystem.push(item);
                  addedSystems++;
                }
              });
            }
            console.log('[FullGen] 军事系统生成成功，新增部队', addedTroops, '个，新增军制', addedSystems, '个');
          } else if (s.key === 'variables_base' || s.key === 'variables_other') {
            var mvar = raw.match(/\[\s*\{[\s\S]*\]/);
            var varArr = JSON.parse(mvar ? mvar[0] : raw);
            if (Array.isArray(varArr)) {
              if (!scriptData.variables) scriptData.variables = {base:[],other:[],formulas:[]};
              var varType = s.key === 'variables_base' ? 'base' : 'other';
              if (!Array.isArray(scriptData.variables[varType])) scriptData.variables[varType] = [];
              varArr.forEach(function(item) {
                var exists = scriptData.variables[varType].some(function(x){return x.name===item.name;});
                if (!exists) scriptData.variables[varType].push(item);
              });
              console.log('[FullGen] 变量生成成功:', varType, '新增', varArr.length, '个，总计', scriptData.variables[varType].length, '个');
            }
          } else if (s.key === 'adminHierarchy') {
            var madmin = raw.match(/\[\s*\{[\s\S]*\]/);
            var adminArr = JSON.parse(madmin ? madmin[0] : raw);
            if (Array.isArray(adminArr)) {
              if (!scriptData.adminHierarchy) scriptData.adminHierarchy = {};
              if (!scriptData.adminHierarchy.player) {
                scriptData.adminHierarchy.player = {
                  name: '玩家势力行政区划',
                  description: '玩家势力的行政层级结构',
                  divisions: []
                };
              }
              // Ensure each division has required fields
              function ensureDivision(div) {
                if (!div.id) div.id = 'admin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                if (!div.children) div.children = [];
                div.children.forEach(ensureDivision);
              }
              adminArr.forEach(function(item) {
                ensureDivision(item);
                var exists = scriptData.adminHierarchy.player.divisions.some(function(x){return x.name===item.name;});
                if (!exists) scriptData.adminHierarchy.player.divisions.push(item);
              });
              console.log('[FullGen] 行政区划生成成功，新增', adminArr.length, '个，总计', scriptData.adminHierarchy.player.divisions.length, '个');
            }
          } else if (s.key === 'techTree') {
            var mtch = raw.match(/\[\s*\{[\s\S]*\]/);
            var techArr = JSON.parse(mtch ? mtch[0] : raw);
            if (Array.isArray(techArr)) {
              if (!scriptData.techTree) scriptData.techTree = {military:[], civil:[]};
              techArr.forEach(function(t) {
                var cat = (t.category === 'civil') ? 'civil' : 'military';
                // 兼容旧格式：cost文本→costs数组
                if (t.cost && !t.costs) t.costs = [{variable:'', amount: parseInt(t.cost)||0}];
                // 兼容旧格式：prereq文本→prereqs数组
                if (t.prereq && !t.prereqs) t.prereqs = t.prereq.split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean);
                if (!t.prereqs) t.prereqs = [];
                if (!t.costs) t.costs = [];
                if (!t.effect) t.effect = {};
                if (!t.era) t.era = '';
                scriptData.techTree[cat].push(t);
              });
            }
          } else if (s.key === 'civicTree') {
            var mciv = raw.match(/\[\s*\{[\s\S]*\]/);
            var civArr = JSON.parse(mciv ? mciv[0] : raw);
            if (Array.isArray(civArr)) {
              if (!scriptData.civicTree) scriptData.civicTree = {city:[], policy:[], resource:[], corruption:[]};
              var validCivCats = ['city','policy','resource','corruption'];
              civArr.forEach(function(c) {
                var cat = validCivCats.indexOf(c.category) >= 0 ? c.category : 'policy';
                if (c.cost && !c.costs) c.costs = [{variable:'', amount: parseInt(c.cost)||0}];
                if (c.prereq && !c.prereqs) c.prereqs = c.prereq.split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean);
                if (!c.prereqs) c.prereqs = [];
                if (!c.costs) c.costs = [];
                if (!c.effect) c.effect = {};
                if (!c.era) c.era = '';
                scriptData.civicTree[cat].push(c);
              });
            }
          } else if (s.key === 'rules') {
            var mrul = raw.match(/\[\s*\{[\s\S]*\]/);
            var rulArr = JSON.parse(mrul ? mrul[0] : raw);
            if (Array.isArray(rulArr)) {
              if (!scriptData.rules) scriptData.rules = {base:'',combat:'',economy:'',diplomacy:''};
              rulArr.forEach(function(r) {
                var cat = ['base','combat','economy','diplomacy'].indexOf(r.category) >= 0 ? r.category : 'base';
                var line = (r.name ? '【' + r.name + '】' : '') + (r.content || r.description || '');
                scriptData.rules[cat] = (scriptData.rules[cat] ? scriptData.rules[cat] + '\n' : '') + line;
              });
            }
          } else if (s.key === 'goals') {
            var mgol = raw.match(/\[\s*\{[\s\S]*\]/);
            var golArr = JSON.parse(mgol ? mgol[0] : raw);
            if (Array.isArray(golArr)) {
              if (!scriptData.goals) scriptData.goals = [];
              scriptData.goals = scriptData.goals.concat(golArr);
            }
          } else if (s.key === 'externalForces') {
            var mef = raw.match(/\[\s*\{[\s\S]*\]/);
            var efArr = JSON.parse(mef ? mef[0] : raw);
            if (Array.isArray(efArr)) {
              if (!scriptData.externalForces) scriptData.externalForces = [];
              efArr.forEach(function(item) {
                var exists = scriptData.externalForces.some(function(x){return x.name===item.name;});
                if (!exists) scriptData.externalForces.push(item);
              });
            }
          } else if (s.key === 'relations') {
            var mrl = raw.match(/\[\s*\{[\s\S]*\]/);
            var rlArr = JSON.parse(mrl ? mrl[0] : raw);
            if (Array.isArray(rlArr)) {
              if (!scriptData.relations) scriptData.relations = [];
              rlArr.forEach(function(item) {
                var exists = scriptData.relations.some(function(x){return x.name===item.name;});
                if (!exists) scriptData.relations.push(item);
              });
            }
          } else if (s.key === 'variables_formulas') {
            var mvf = raw.match(/\[\s*\{[\s\S]*\]/);
            var vfArr = JSON.parse(mvf ? mvf[0] : raw);
            if (Array.isArray(vfArr)) {
              if (!scriptData.variables) scriptData.variables = {base:[],other:[],formulas:[]};
              if (!scriptData.variables.formulas) scriptData.variables.formulas = [];
              vfArr.forEach(function(item) {
                scriptData.variables.formulas.push(item);
              });
            }
          } else if (s.key === 'haremConfig') {
            var mhc = raw.match(/\{[\s\S]*\}/);
            var hcObj = JSON.parse(mhc ? mhc[0] : raw);
            if (hcObj && hcObj.rankSystem) {
              scriptData.haremConfig = hcObj;
            }
          } else if (s.key === 'coreContradictions') {
            // 显著矛盾：数组直接存入playerInfo
            var ctArr = extractJSON(raw);
            if (Array.isArray(ctArr) && ctArr.length > 0) {
              if (!scriptData.playerInfo) scriptData.playerInfo = {};
              if (!scriptData.playerInfo.coreContradictions) scriptData.playerInfo.coreContradictions = [];
              ctArr.forEach(function(c) {
                if (c.title && !scriptData.playerInfo.coreContradictions.some(function(x){return x.title===c.title;})) {
                  scriptData.playerInfo.coreContradictions.push(c);
                }
              });
              if (typeof renderContradictions === 'function') renderContradictions();
            }
          } else if (s.key === 'keju') {
            var mkj = raw.match(/\{[\s\S]*\}/);
            var kjObj = JSON.parse(mkj ? mkj[0] : raw);
            if (kjObj) {
              if (!scriptData.keju) scriptData.keju = {};
              if (kjObj.enabled !== undefined) scriptData.keju.enabled = !!kjObj.enabled;
              if (kjObj.reformed !== undefined) scriptData.keju.reformed = !!kjObj.reformed;
              if (kjObj.examIntervalNote) scriptData.keju.examIntervalNote = kjObj.examIntervalNote;
              if (kjObj.examNote) scriptData.keju.examNote = kjObj.examNote;
              if (kjObj.examSubjects) scriptData.keju.examSubjects = kjObj.examSubjects;
              if (kjObj.quotaPerExam) scriptData.keju.quotaPerExam = parseInt(kjObj.quotaPerExam) || 0;
              if (kjObj.specialRules) scriptData.keju.specialRules = kjObj.specialRules;
            }
          } else if (s.key === 'timeline') {
            // 时间线特殊处理：按type分流到past/future
            var mtl = raw.match(/\[\s*\{[\s\S]*\]/);
            var tlArr = JSON.parse(mtl ? mtl[0] : raw);
            if (Array.isArray(tlArr)) {
              if (!scriptData.timeline) scriptData.timeline = {past:[], future:[]};
              if (!scriptData.timeline.past) scriptData.timeline.past = [];
              if (!scriptData.timeline.future) scriptData.timeline.future = [];
              tlArr.forEach(function(t) {
                var target = (t.type === 'future') ? 'future' : 'past';
                // 兼容旧字段名
                if (t.event && !t.name) t.name = t.event;
                if (t.date && !t.year) t.year = t.date;
                if (!t.importance) t.importance = '普通';
                var dup = scriptData.timeline[target].some(function(x) { return x.name === t.name; });
                if (!dup) scriptData.timeline[target].push(t);
              });
            }
          } else {
            // 通用处理（含characters/factions/parties/factionRelations等）
            // 健壮的JSON解析���—处理markdown包装、对象包装等
            var _cl = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            var arr = null;
            try { var _pp = JSON.parse(_cl); if (Array.isArray(_pp)) arr = _pp; else if (typeof _pp === 'object') { for (var _ww in _pp) { if (Array.isArray(_pp[_ww])) { arr = _pp[_ww]; break; } } } } catch(e0) {}
            if (!arr) { var m2 = _cl.match(/\[\s*\{[\s\S]*\]/); if (m2) try { arr = JSON.parse(m2[0]); } catch(e1) {} }
            if (!arr) { var _om = _cl.match(/\{[\s\S]*\}/); if (_om) try { var _oo = JSON.parse(_om[0]); for (var _kk in _oo) { if (Array.isArray(_oo[_kk])) { arr = _oo[_kk]; break; } } if (!arr && _oo.name) arr = [_oo]; } catch(e2) {} }
            if (Array.isArray(arr)) {
              if (!Array.isArray(scriptData[s.key])) scriptData[s.key] = [];

              // 角色后处理：确保数值字段+新字段
              if (s.key === 'characters') {
                var _pi = scriptData.playerInfo || {};
                arr.forEach(function(ch) {
                  ['loyalty','ambition','intelligence','valor','administration','charisma','diplomacy','benevolence','age'].forEach(function(f) {
                    if (ch[f] !== undefined) ch[f] = parseInt(ch[f]) || (f === 'age' ? 30 : 50);
                  });
                  if (!ch.loyalty) ch.loyalty = 50;
                  if (!ch.ambition) ch.ambition = 50;
                  if (!ch.intelligence) ch.intelligence = 50;
                  if (!ch.valor) ch.valor = 50;
                  if (!ch.administration) ch.administration = 50;
                  if (!ch.charisma) ch.charisma = 50;
                  if (!ch.diplomacy) ch.diplomacy = 50;
                  if (!ch.benevolence) ch.benevolence = 50;
                  if (!ch.familyTier) ch.familyTier = 'common';
                  if (ch.spouse === 'true' || ch.spouse === true) ch.spouse = true; else ch.spouse = false;
                  if (ch.officialTitle && !ch.vassalType && typeof inferVassalTypeFromOfficial === 'function') {
                    var _ivt = inferVassalTypeFromOfficial(ch.officialTitle);
                    ch.vassalType = _ivt ? _ivt.vassalType : '';
                  }
                  // D2: 势力名交叉验证
                  if (ch.faction && scriptData.factions && scriptData.factions.length > 0) {
                    if (!scriptData.factions.some(function(f) { return f.name === ch.faction; })) {
                      var _best = null, _bs = 0;
                      scriptData.factions.forEach(function(f) {
                        if (f.name && (ch.faction.indexOf(f.name) >= 0 || f.name.indexOf(ch.faction) >= 0)) {
                          var sc = Math.min(f.name.length, ch.faction.length);
                          if (sc > _bs) { _bs = sc; _best = f.name; }
                        }
                      });
                      if (_best) ch.faction = _best;
                    }
                  }
                  // D3: 自动标记玩家角色
                  if (_pi.characterName && ch.name === _pi.characterName) ch.isPlayer = true;
                });
              }
              // 势力后处理
              if (s.key === 'factions') {
                var _pfn = (scriptData.playerInfo || {}).factionName || '';
                arr = arr.filter(function(f) {
                  // D4: 过滤与玩家势力同名的
                  if (_pfn && f.name === _pfn) return false;
                  return true;
                });
                arr.forEach(function(f) {
                  if (f.strength && typeof f.strength === 'string') {
                    if (f.strength.indexOf('\u5F3A') >= 0) f.strength = 80;
                    else if (f.strength.indexOf('\u5F31') >= 0) f.strength = 30;
                    else f.strength = parseInt(f.strength) || 50;
                  } else { f.strength = parseInt(f.strength) || 50; }
                  if (f.militaryStrength) f.militaryStrength = parseInt(f.militaryStrength) || 10000;
                  if (!f.color) f.color = '#' + Math.floor((typeof random === 'function' ? random() : Math.random()) * 16777215).toString(16).padStart(6, '0');
                });
              }

              if (s.key === 'factionRelations') {
                // 关系去重用 from+to
                arr.forEach(function(r) {
                  if (!r.from || !r.to) return;
                  r.value = Math.max(-100, Math.min(100, parseInt(r.value) || 0));
                  var dup = scriptData.factionRelations.some(function(x) { return x.from === r.from && x.to === r.to; });
                  if (!dup) scriptData.factionRelations.push(r);
                });
              } else {
                arr.forEach(function(item) {
                  var exists = scriptData[s.key].some(function(x){return x.name===item.name;});
                  if (!exists) scriptData[s.key].push(item);
                });
              }
            }
          }
        } catch(e) {
          console.error('步骤', s.label, '解析失败:', e, '\nAI返回内容:', raw);
          showToast('步骤 ' + s.label + ' 解析失败，已跳过');
        }
        runStep(idx + 1);
      }).catch(function(e) {
        (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '步骤') : console.error('步骤', s.label, '调用失败:', e);
        showToast('步骤 ' + s.label + ' AI调用失败，已跳过');
        runStep(idx + 1);
      });
    }

    // 历史检查函数
    function performHistoricalCheck() {
      var yearLimit = gameMode === 'strict_hist' ? 100 : 200;
      var startYear = parseInt(gv('fullGenYear')) || 0;

      if (!startYear) {
        console.warn('[HistCheck] 未设置剧本年份，跳过历史检查');
        finishGeneration();
        return;
      }

      var minYear = startYear - yearLimit;
      var maxYear = startYear + yearLimit;

      console.log('[HistCheck] 开始历史检查，年份范围:', minYear, '-', maxYear);

      // 检查人物
      var invalidChars = [];
      if (scriptData.characters && Array.isArray(scriptData.characters)) {
        scriptData.characters.forEach(function(char) {
          // 从 bio 中提取年份信息（简单的正则匹配）
          if (char.bio) {
            var yearMatches = char.bio.match(/(\d{1,4})\s*年/g);
            if (yearMatches && yearMatches.length > 0) {
              var charYear = parseInt(yearMatches[0]);
              if (charYear && (charYear < minYear || charYear > maxYear)) {
                invalidChars.push({
                  name: char.name,
                  year: charYear,
                  reason: '超出年份范围（' + minYear + '-' + maxYear + '）'
                });
              }
            }
          }
        });
      }

      if (invalidChars.length > 0) {
        console.warn('[HistCheck] 发现', invalidChars.length, '个不符合历史年份的人物:', invalidChars);
        var warningMsg = '历史检查完成，发现 ' + invalidChars.length + ' 个人物可能超出年份范围：\n';
        invalidChars.slice(0, 5).forEach(function(c) {
          warningMsg += '- ' + c.name + '（' + c.year + '年）\n';
        });
        if (invalidChars.length > 5) {
          warningMsg += '...等共 ' + invalidChars.length + ' 人\n';
        }
        warningMsg += '\n建议手动检查或重新生成。';

        // 显示警告但不阻止完成
        setTimeout(function() {
          alert(warningMsg);
          finishGeneration();
        }, 100);
      } else {
        console.log('[HistCheck] 历史检查通过，所有人物符合年份范围');
        finishGeneration();
      }
    }
  }

  function importFullGenFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,.md';
    input.onchange = function(e) {
      var f = e.target.files[0];
      if (!f) return;
      document.getElementById(
        'fullGenFileName'
      ).textContent = f.name;
    };
    input.click();
  }

  function _getEditorMeta() {
    try {
      var m = localStorage.getItem('tianming_editor_meta');
      return m ? JSON.parse(m) : null;
    } catch(e) { return null; }
  }

  function saveScript() {
    // 确保剧本有唯一ID（持久化，不会每次重新生成）
    if (!scriptData.id) {
      scriptData.id = 'scn_' + Date.now();
    }
    // 同时写入双格式字段名，确保game和editor都能读取
    if (scriptData.dynasty && !scriptData.era) scriptData.era = scriptData.dynasty;
    if (scriptData.emperor && !scriptData.role) scriptData.role = scriptData.emperor;
    if (scriptData.overview && !scriptData.background) scriptData.background = scriptData.overview;
    if (scriptData.overview && !scriptData.desc) scriptData.desc = scriptData.overview;

    console.log('[Save] Saving scriptData, id=' + scriptData.id + ', name=' + scriptData.name);
    // IndexedDB 主存储
    if (typeof TM_SaveDB !== 'undefined') {
      TM_SaveDB.save('current_script', scriptData, {
        name: scriptData.name || 'untitled', type: 'editor', turn: 0, scenarioName: scriptData.name || ''
      });
    }
    try { localStorage.setItem('tianming_script', JSON.stringify(scriptData)); } catch(e) {}
    if (window.tianming && window.tianming.isDesktop) {
      var meta = _getEditorMeta();
      var fname = (meta && meta.scnName) ? meta.scnName : (scriptData.name || 'untitled');
      // 同时更新 meta 中的 scnId 以保持一致
      if (meta && !meta.scnId) {
        meta.scnId = scriptData.id;
        try { localStorage.setItem('tianming_editor_meta', JSON.stringify(meta)); } catch(_){}
      }
      window.tianming.saveScenario(fname, scriptData).then(function(r) {
        if (r && r.success) { showToast('\u5df2\u4fdd\u5b58\u5230\u5267\u672c\u6587\u4ef6\u5939'); }
        else { showToast('\u4fdd\u5b58\u5931\u8d25: ' + (r && r.error ? r.error : '')); }
      });
    } else {
      showToast('\u5267\u672c\u5df2\u4fdd\u5b58\u5230\u672c\u5730');
    }
  }

  function autoSave() {
    // 确保剧本有ID
    if (!scriptData.id) scriptData.id = 'scn_' + Date.now();
    // 双格式字段
    if (scriptData.dynasty && !scriptData.era) scriptData.era = scriptData.dynasty;
    if (scriptData.emperor && !scriptData.role) scriptData.role = scriptData.emperor;
    if (scriptData.overview && !scriptData.background) scriptData.background = scriptData.overview;

    // === 关键：从 gameSettings 同步生成 time 对象 ===
    var gs = scriptData.gameSettings || {};
    if (!scriptData.time || typeof scriptData.time !== 'object') scriptData.time = {};
    var t = scriptData.time;
    // 起始年
    if (gs.startYear !== undefined && gs.startYear !== null && gs.startYear !== '') {
      t.year = Number(gs.startYear);
      // 自动判断公元前/后
      if (t.year < 0) { t.prefix = '公元前'; t.suffix = '年'; }
      else { t.prefix = '公元'; t.suffix = '年'; }
    }
    // 起始月日
    if (gs.startMonth) t.startMonth = Number(gs.startMonth);
    if (gs.startDay) t.startDay = Number(gs.startDay);
    // 农历起始
    if (gs.startLunarMonth) t.startLunarMonth = Number(gs.startLunarMonth);
    if (gs.startLunarDay) t.startLunarDay = Number(gs.startLunarDay);
    // 回合时长：统一用天数
    if (gs.daysPerTurn && gs.daysPerTurn > 0) {
      t.daysPerTurn = Number(gs.daysPerTurn);
    } else if (gs.turnUnit) {
      // 旧格式兼容
      var _dMap = {'日':1,'周':7,'月':30,'季':90,'年':365};
      t.daysPerTurn = (gs.turnDuration || 1) * (_dMap[gs.turnUnit] || 30);
    }
    if (!t.daysPerTurn) t.daysPerTurn = 30;
    // 干支/年号
    if (gs.enableGanzhi !== undefined) t.enableGanzhi = gs.enableGanzhi;
    if (gs.enableGanzhiDay !== undefined) t.enableGanzhiDay = gs.enableGanzhiDay;
    if (gs.enableEraName !== undefined) t.enableEraName = gs.enableEraName;
    if (gs.eraNames && gs.eraNames.length > 0) t.eraNames = gs.eraNames;
    // 保留默认值
    if (!t.seasons) t.seasons = ['春','夏','秋','冬'];
    if (t.startS === undefined) t.startS = 0;
    if (!t.display) t.display = 'year_season';
    if (!t.template) t.template = '{reign}{ry}年 {season}';

    // 1. IndexedDB 主存储（无容量限制）
    if (typeof TM_SaveDB !== 'undefined') {
      TM_SaveDB.save('current_script', scriptData, {
        name: scriptData.name || 'untitled',
        type: 'editor',
        turn: 0,
        scenarioName: scriptData.name || ''
      }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'autoSave] IndexedDB写入失败:') : console.warn('[autoSave] IndexedDB写入失败:', e); });
    }
    // 2. localStorage 兜底（剥离portrait等大数据，只存轻量骨架）
    try {
      var _liteData = JSON.parse(JSON.stringify(scriptData));
      (_liteData.characters || []).forEach(function(c) { if (c.portrait) c.portrait = '[IMG]'; });
      localStorage.setItem('tianming_script', JSON.stringify(_liteData));
    } catch(e) {
      // 即使骨架也超限则静默——完整数据在IndexedDB中
    }
    // 3. 桌面端磁盘
    if (window.tianming && window.tianming.isDesktop) {
      var meta = _getEditorMeta();
      var fname = (meta && meta.scnName) ? meta.scnName : (scriptData.name || 'untitled');
      window.tianming.saveScenario(fname, scriptData).catch(function(){});
    }
  }

  // 统一的字段初始化（确保scriptData所有字段存在）
  function _ensureScriptDataDefaults() {
    if (!scriptData.id) scriptData.id = '';
    // 新增字段默认值
    if (scriptData.startYear === undefined) scriptData.startYear = null;
    if (!scriptData.dynastyPhaseHint) scriptData.dynastyPhaseHint = '';
    if (!scriptData.factionRelations) scriptData.factionRelations = [];
    if (!scriptData.playerInfo) scriptData.playerInfo = {};
    if (scriptData.playerInfo.leaderIsPlayer === undefined) scriptData.playerInfo.leaderIsPlayer = true;
    if (!scriptData.playerInfo.playerRole) scriptData.playerInfo.playerRole = '';
    if (!scriptData.playerInfo.characterAppearance) scriptData.playerInfo.characterAppearance = '';
    if (!scriptData.playerInfo.characterCharisma) scriptData.playerInfo.characterCharisma = '';
    if (!scriptData.goals) scriptData.goals = [];
    if (!scriptData.offendGroups) scriptData.offendGroups = { enabled: false, decayEnabled: true, decayRate: 0.05, groups: [] };
    if (!scriptData.keju) scriptData.keju = { enabled: false, reformed: false, examIntervalNote: '', examNote: '' };
    if (!scriptData.officialVassalMapping) scriptData.officialVassalMapping = { mappings: [] };
    if (!scriptData.externalForces) scriptData.externalForces = [];
    if (!scriptData.relations) scriptData.relations = [];
    if (!scriptData.haremConfig) scriptData.haremConfig = { rankSystem: [], succession: 'eldest_legitimate' };
    if (!scriptData.mapData) scriptData.mapData = {};
    if (!scriptData.cities) scriptData.cities = [];
    if (!scriptData.adminHierarchy) scriptData.adminHierarchy = {};
    if (!scriptData.buildingSystem) scriptData.buildingSystem = { enabled: false, buildingTypes: [] };
    if (!scriptData.postSystem) scriptData.postSystem = { enabled: false, postRules: [] };
    if (!scriptData.vassalSystem) scriptData.vassalSystem = { enabled: false, vassalTypes: [] };
    if (!scriptData.titleSystem) scriptData.titleSystem = { enabled: false, titleRanks: [] };
    if (!scriptData.economyConfig) scriptData.economyConfig = { enabled: false, currency: '\u8D2F', baseIncome: 10000, taxRate: 0.1 };
    if (!scriptData.worldSettings) scriptData.worldSettings = { culture:'', weather:'', religion:'', economy:'', technology:'', diplomacy:'' };
    if (!scriptData.government) scriptData.government = { name:'', description:'', nodes:[] };
    if (!scriptData.eraState) scriptData.eraState = { politicalUnity:0.7, centralControl:0.6, socialStability:0.6, economicProsperity:0.6, dynastyPhase:'peak', contextDescription:'' };
    if (!scriptData.variables) scriptData.variables = { base:[], other:[], formulas:[] };
    // 六大配置系统默认值
    if (!scriptData.warConfig) scriptData.warConfig = { casusBelliTypes: [] };
    if (!scriptData.diplomacyConfig) scriptData.diplomacyConfig = { treatyTypes: [] };
    if (!scriptData.schemeConfig) scriptData.schemeConfig = { enabled: false, schemeTypes: [] };
    if (!scriptData.decisionConfig) scriptData.decisionConfig = { decisions: [] };
    if (!scriptData.chronicleConfig) scriptData.chronicleConfig = { yearlyEnabled: true, style: 'biannian', yearlyMinChars: 300, yearlyMaxChars: 600 };
    if (!scriptData.eventConstraints) scriptData.eventConstraints = { enabled: false, types: [] };
    if (scriptData.military && !scriptData.military.initialTroops) scriptData.military.initialTroops = [];
    if (scriptData.military && !scriptData.military.militarySystem) scriptData.military.militarySystem = [];
    if (scriptData.military && scriptData.military.initialTroops) {
      scriptData.military.initialTroops.forEach(function(t) {
        if (typeof t.equipment === 'string') t.equipment = [];
        if (!t.equipment) t.equipment = [];
      });
    }
    // 兼容game格式字段 → editor格式字段
    if (!scriptData.dynasty && scriptData.era) scriptData.dynasty = scriptData.era;
    if (!scriptData.emperor && scriptData.role) scriptData.emperor = scriptData.role;
    if (!scriptData.overview && scriptData.background) scriptData.overview = scriptData.background;
    if (!scriptData.overview && scriptData.desc) scriptData.overview = scriptData.desc;
  }

  // 将加载的数据合并到scriptData并刷新UI
  function _mergeAndRenderScriptData(d) {
    for (var key in d) {
      if (d.hasOwnProperty(key)) {
        scriptData[key] = d[key];
      }
    }
    _ensureScriptDataDefaults();

    // 刷新UI字段
    var el;
    el = document.getElementById('scriptName'); if (el) el.value = scriptData.name || '';
    el = document.getElementById('scriptDynasty'); if (el) el.value = scriptData.dynasty || '';
    el = document.getElementById('scriptEmperor'); if (el) el.value = scriptData.emperor || '';
    el = document.getElementById('scriptOverview'); if (el) el.value = scriptData.overview || '';
    el = document.getElementById('scriptOpeningText'); if (el) el.value = scriptData.openingText || '';
    if (scriptData.playerInfo) {
      var pi = scriptData.playerInfo;
      el = document.getElementById('playerFactionName'); if (el) el.value = pi.factionName || '';
      el = document.getElementById('playerFactionDesc'); if (el) el.value = pi.factionDesc || '';
      el = document.getElementById('playerCharacterName'); if (el) el.value = pi.characterName || '';
      el = document.getElementById('playerCharacterDesc'); if (el) el.value = pi.characterDesc || '';
    }
    renderGameSettings();
    renderAll();
  }

  function loadScript() {
    // 层1: localStorage（同步，立即渲染） (R153 包 try)
    var saved = null;
    try { saved = localStorage.getItem('tianming_script'); } catch(_){}
    if (saved) {
      try {
        var d = JSON.parse(saved);
        console.log('[Load] 从localStorage加载, id=' + (d.id||'无') + ', name=' + (d.name||''));
        _mergeAndRenderScriptData(d);
      } catch(e) {
        console.error('[Load] localStorage解析失败:', e);
      }
    }
    // 层2: IndexedDB（异步，加载完成后刷新全部面板）
    if (typeof TM_SaveDB !== 'undefined') {
      TM_SaveDB.load('current_script').then(function(record) {
        if (record && record.gameState) {
          var idbData = record.gameState;
          console.log('[Load] 从IndexedDB加载完成, name=' + (idbData.name||'') + ', 刷新全部面板');
          _mergeAndRenderScriptData(idbData);
        }
      }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'Load] IndexedDB加载失败:') : console.warn('[Load] IndexedDB加载失败:', e); });
    }
    if (!saved && window.tianming && window.tianming.isDesktop) {
      // localStorage为空时，尝试从Electron磁盘加载最近编辑的剧本
      var meta = _getEditorMeta();
      if (meta && meta.scnName) {
        console.log('[Load] localStorage为空，从磁盘加载: ' + meta.scnName);
        window.tianming.loadScenario(meta.scnName).then(function(r) {
          if (r && r.success && r.data) {
            _mergeAndRenderScriptData(r.data);
            // 回写到localStorage
            try { localStorage.setItem('tianming_script', JSON.stringify(scriptData)); } catch(_){}
            console.log('[Load] 已从磁盘恢复剧本: ' + scriptData.name);
          }
        }).catch(function(e) {
          (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'Load') : console.warn('[Load] 磁盘加载失败:', e); });
      } else {
        // 没有meta信息，尝试加载最近的剧本文件
        window.tianming.listScenarios().then(function(list) {
          if (list && list.success && list.files && list.files.length > 0) {
            var latest = list.files[0]; // 按修改时间排序，第一个是最新
            console.log('[Load] 自动加载最近剧本: ' + latest.name);
            return window.tianming.loadScenario(latest.name).then(function(r) {
              if (r && r.success && r.data) {
                _mergeAndRenderScriptData(r.data);
                try { localStorage.setItem('tianming_script', JSON.stringify(scriptData)); } catch(_){}
                // 保存meta以便下次使用
                try { localStorage.setItem('tianming_editor_meta', JSON.stringify({ scnName: latest.name, scnId: scriptData.id || '' })); } catch(_){}
              }
            });
          }
        }).catch(function(e) {
          (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'Load') : console.warn('[Load] 剧本列表加载失败:', e); });
      }
    }
    loadAPISettings();
  }

  function exportScript() {
    var json = JSON.stringify(scriptData, null, 2);
    var blob = new Blob(
      [json], {type: 'application/json'}
    );
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var name = scriptData.name || 'tianming_script';
    a.download = name + '.json';
    a.click();
    showToast('剧本已导出');
  }

  function importScript() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function() {
        try {
          var d = JSON.parse(r.result);
          _mergeAndRenderScriptData(d);
          autoSave();
          showToast('剧本已导入');
        } catch(err) {
          console.error('[importScript] 错误:', err);
          showToast('文件格式错误: ' + err.message);
        }
      };
      r.readAsText(f);
    };
    input.click();
  }

  // 5.2: 剧本克隆
  function cloneScript() {
    var cloned = JSON.parse(JSON.stringify(scriptData));
    cloned.name = (cloned.name || '剧本') + '（副本）';
    cloned.id = 'scn_' + Date.now();
    _mergeAndRenderScriptData(cloned);
    autoSave();
    showToast('已克隆为"' + cloned.name + '"');
  }
  window.cloneScript = cloneScript;

  // E12: 快速测试——在编辑器中预览剧本开局效果
  function quickTestScenario() {
    // 检查基本完整性
    if (!scriptData.characters || scriptData.characters.length === 0) {
      showToast('至少需要1个角色才能测试');
      return;
    }
    if (!scriptData.factions || scriptData.factions.length === 0) {
      showToast('至少需要1个势力才能测试');
      return;
    }
    // 弹出预览窗口
    var html = '<div style="padding:1.5rem;max-width:600px;max-height:80vh;overflow-y:auto;">';
    html += '<h3 style="color:var(--gold,#c9a96e);margin-bottom:1rem;">▶ 剧本快速预检</h3>';

    // 基本信息
    html += '<div style="margin-bottom:1rem;padding:0.8rem;background:#1a1a2e;border-radius:8px;border-left:3px solid #c9a96e;">';
    html += '<div style="font-weight:700;margin-bottom:0.3rem;">' + (scriptData.name || '未命名') + '</div>';
    html += '<div style="font-size:0.85rem;color:#888;">朝代：' + (scriptData.dynasty || '?') + ' | 年代：' + (scriptData.era || '?') + '</div>';
    html += '</div>';

    // 角色概览
    html += '<div style="margin-bottom:1rem;"><div style="font-weight:700;color:#c9a96e;margin-bottom:0.3rem;">角色 (' + scriptData.characters.length + ')</div>';
    var playerChar = scriptData.characters.find(function(c) { return c.isPlayer; });
    if (playerChar) {
      html += '<div style="font-size:0.85rem;padding:0.3rem 0;">★ 玩家：' + escHtml(playerChar.name) + (playerChar.title ? '（' + escHtml(playerChar.title) + '）' : '') + '</div>';
    } else {
      html += '<div style="font-size:0.85rem;color:#e74c3c;">⚠ 未指定玩家角色</div>';
    }
    // 能力分布
    var avgInt = 0, avgVal = 0, avgAdm = 0;
    scriptData.characters.forEach(function(c) { avgInt += (c.intelligence || 50); avgVal += (c.valor || 50); avgAdm += (c.administration || 50); });
    var n = scriptData.characters.length;
    html += '<div style="font-size:0.8rem;color:#888;">平均 智' + Math.round(avgInt/n) + ' 武' + Math.round(avgVal/n) + ' 政' + Math.round(avgAdm/n) + '</div>';
    html += '</div>';

    // 势力概览
    html += '<div style="margin-bottom:1rem;"><div style="font-weight:700;color:#c9a96e;margin-bottom:0.3rem;">势力 (' + scriptData.factions.length + ')</div>';
    scriptData.factions.forEach(function(f) {
      var memberCount = scriptData.characters.filter(function(c) { return c.faction === f.name; }).length;
      html += '<div style="font-size:0.85rem;padding:0.2rem 0;">' + (f.isPlayer ? '★ ' : '') + escHtml(f.name) + ' — ' + memberCount + '人' + (f.leader ? '，首领：' + escHtml(f.leader) : '') + '</div>';
    });
    html += '</div>';

    // 潜在问题检测
    var issues = [];
    if (!playerChar) issues.push('未指定玩家角色（isPlayer=true）');
    var playerFac = scriptData.factions.find(function(f) { return f.isPlayer; });
    if (!playerFac) issues.push('未指定玩家势力');
    if (!scriptData.time || !scriptData.time.year) issues.push('未设置起始年份');
    // 无位置的角色
    var noLocChars = scriptData.characters.filter(function(c) { return !c.location; });
    if (noLocChars.length > 0) issues.push(noLocChars.length + '个角色未设置所在地');
    // 孤立角色（无势力）
    var noFacChars = scriptData.characters.filter(function(c) { return !c.faction; });
    if (noFacChars.length > 0) issues.push(noFacChars.length + '个角色未分配势力');
    // 空官制
    if (!scriptData.government || !scriptData.government.nodes || scriptData.government.nodes.length === 0) issues.push('未设置官制体系');

    if (issues.length > 0) {
      html += '<div style="margin-bottom:1rem;padding:0.8rem;background:rgba(231,76,60,0.1);border-radius:8px;border-left:3px solid #e74c3c;">';
      html += '<div style="font-weight:700;color:#e74c3c;margin-bottom:0.3rem;">⚠ 发现 ' + issues.length + ' 个问题</div>';
      issues.forEach(function(iss) { html += '<div style="font-size:0.85rem;color:#e74c3c;padding:0.15rem 0;">· ' + iss + '</div>'; });
      html += '</div>';
    } else {
      html += '<div style="padding:0.5rem;background:rgba(46,204,113,0.1);border-radius:8px;border-left:3px solid #2ecc71;color:#2ecc71;font-size:0.85rem;">✓ 基本检查通过，可以开始游戏</div>';
    }

    // 开始游戏按钮
    html += '<div style="display:flex;gap:0.5rem;margin-top:1rem;">';
    html += '<button onclick="this.closest(\'.modal-bg\').remove();returnToMain();setTimeout(function(){if(typeof showScnSelect===\'function\')showScnSelect();},300);" style="flex:1;padding:0.6rem;background:#c9a96e;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;">进入游戏测试</button>';
    html += '<button onclick="this.closest(\'.modal-bg\').remove();" style="padding:0.6rem 1rem;background:#333;color:#ccc;border:1px solid #555;border-radius:6px;cursor:pointer;">关闭</button>';
    html += '</div>';
    html += '</div>';

    var ov = document.createElement('div');
    ov.className = 'modal-bg';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:#16213e;border:1px solid #c9a96e;border-radius:12px;max-width:620px;width:95%;">' + html + '</div>';
    document.body.appendChild(ov);
  }
  window.quickTestScenario = quickTestScenario;

  function renderGameSettings() {
    var gs = scriptData.gameSettings;
    if (!gs) {
      scriptData.gameSettings = {
        enabledSystems:{ items:true, military:true, techTree:true, civicTree:true, events:true, map:true },
        startYear:1, startMonth:1, startDay:1,
        enableGanzhi:false, enableGanzhiDay:false,
        enableEraName:false, eraNames:[],
        turnDuration:1, turnUnit:'月'
      };
      gs = scriptData.gameSettings;
    }
    var es = gs.enabledSystems || {};
    var systems = ['items','military','techTree','civicTree','events','map','characters','factions','classes','rules','officeTree','parties','goals','keju','vassalSystem','titleSystem','buildingSystem','economyConfig','worldSettings'];
    systems.forEach(function(k) {
      var el = document.getElementById('gs-sys-' + k);
      if (el) el.checked = es[k] !== false;
    });
    // 剧本元数据字段（在scriptInfo面板中，但由此函数统一填充）
    var _sy = document.getElementById('scriptStartYear');
    if (_sy) _sy.value = scriptData.startYear || '';
    var _dp = document.getElementById('scriptDynastyPhase');
    if (_dp) _dp.value = scriptData.dynastyPhaseHint || '';
    var gr = document.getElementById('gs-globalRules');
    if (gr) gr.value = scriptData.globalRules || '';
    // 从 time 对象回填 gameSettings（确保UI显示正确值）
    var _t = scriptData.time;
    if (_t && typeof _t === 'object') {
      if (_t.year !== undefined && (gs.startYear === undefined || gs.startYear === 1)) gs.startYear = _t.year;
      if (_t.startMonth && !gs.startMonth) gs.startMonth = _t.startMonth;
      if (_t.startDay && !gs.startDay) gs.startDay = _t.startDay;
      if (_t.enableGanzhi !== undefined && gs.enableGanzhi === undefined) gs.enableGanzhi = _t.enableGanzhi;
      if (_t.enableGanzhiDay !== undefined && gs.enableGanzhiDay === undefined) gs.enableGanzhiDay = _t.enableGanzhiDay;
      if (_t.enableEraName !== undefined && gs.enableEraName === undefined) gs.enableEraName = _t.enableEraName;
      if (_t.eraNames && _t.eraNames.length > 0 && (!gs.eraNames || !gs.eraNames.length)) gs.eraNames = _t.eraNames;
      // 从time回填daysPerTurn
      if (_t.daysPerTurn && !gs.daysPerTurn) gs.daysPerTurn = _t.daysPerTurn;
      // 旧格式兼容：从perTurn推算daysPerTurn
      if (!gs.daysPerTurn && _t.perTurn) {
        var _dMap2 = {'1d':1,'1w':7,'1m':30,'1s':90,'1y':365};
        gs.daysPerTurn = _dMap2[_t.perTurn] || 30;
      }
    }
    var sy = document.getElementById('gs-startYear');
    var sm = document.getElementById('gs-startMonth');
    var sd = document.getElementById('gs-startDay');
    if (sy) sy.value = (gs.startYear !== undefined && gs.startYear !== null) ? gs.startYear : 1;
    if (sm) sm.value = gs.startMonth || 1;
    if (sd) sd.value = gs.startDay || 1;
    var gz = document.getElementById('gs-enableGanzhi');
    var gzd = document.getElementById('gs-enableGanzhiDay');
    var era = document.getElementById('gs-enableEraName');
    if (gz) gz.checked = !!gs.enableGanzhi;
    if (gzd) gzd.checked = !!gs.enableGanzhiDay;
    if (era) era.checked = !!gs.enableEraName;
    updateEraNameVisibility();
    var dpt = document.getElementById('gs-daysPerTurn');
    if (dpt) dpt.value = gs.daysPerTurn || 30;
    // 农历起始日期
    var slm = document.getElementById('gs-startLunarMonth');
    var sld = document.getElementById('gs-startLunarDay');
    if (slm) slm.value = gs.startLunarMonth || '';
    if (sld) sld.value = gs.startLunarDay || '';
  }

  function updateEraNameVisibility() {
    var era = document.getElementById('gs-enableEraName');
    var box = document.getElementById('gs-eraNameBox');
    if (box) box.style.display = (era && era.checked) ? '' : 'none';
    if (era && era.checked) renderEraNamesList();
  }

  function renderEraNamesList() {
    var gs = scriptData.gameSettings;
    if (!gs) return;
    if (!Array.isArray(gs.eraNames)) gs.eraNames = [];
    var container = document.getElementById('gs-eraNamesList');
    if (!container) return;
    if (!gs.eraNames.length) { container.innerHTML = '<span style="font-size:12px;color:var(--txt-d)">'+'暂无年号'+'</span>'; return; }
    container.innerHTML = gs.eraNames.map(function(e, i) {
      return '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
        '<span style="font-size:12px;">年号：</span>'+
        '<input type="text" value="'+escHtml(e.name||'')+'" style="width:80px;font-size:12px;" '+
          'onchange="updateEraEntry('+i+',\'name\',this.value)">'+
        '<span style="font-size:12px;">起始年：</span>'+
        '<input type="number" value="'+(e.startYear||1)+'" min="1" style="width:60px;font-size:12px;" '+
          'onchange="updateEraEntry('+i+',\'startYear\',parseInt(this.value)||1)">'+
        '<button type="button" style="font-size:11px;padding:1px 6px;" onclick="removeEraEntry('+i+')">删除</button>'+
        '</div>';
    }).join('');
  }

  function addEraNameEntry() {
    var gs = scriptData.gameSettings;
    if (!gs) return;
    if (!Array.isArray(gs.eraNames)) gs.eraNames = [];
    gs.eraNames.push({name:'', startYear:1});
    renderEraNamesList();
    autoSave();
  }

  function removeEraEntry(i) {
    var gs = scriptData.gameSettings;
    if (!gs || !Array.isArray(gs.eraNames)) return;
    gs.eraNames.splice(i, 1);
    renderEraNamesList();
    autoSave();
  }

  function updateEraEntry(i, field, val) {
    var gs = scriptData.gameSettings;
    if (!gs || !Array.isArray(gs.eraNames) || !gs.eraNames[i]) return;
    gs.eraNames[i][field] = val;
    autoSave();
  }

  function _computeEraDisplay(gs, absoluteYear) {
    // absoluteYear: the current game year (same unit as startYear)
    // Wait-until-year-end convention: new era takes effect from year AFTER its startYear
    if (!gs || !gs.enableEraName) return '';
    var eras = (gs.eraNames || []).filter(function(e){ return e.name && e.startYear; });
    if (!eras.length) {
      // legacy single era
      if (gs.eraName) {
        var n = absoluteYear - ((gs.eraStartYear||1) - 1);
        return gs.eraName + '元年'.charAt(0) + (n > 0 ? n + '年' : '元年');
      }
      return '';
    }
    // Sort ascending by startYear
    var sorted = eras.slice().sort(function(a,b){ return a.startYear - b.startYear; });
    var active = null;
    for (var i = 0; i < sorted.length; i++) {
      // Era becomes active from startYear+1 onward (wait-until-year-end)
      if (absoluteYear > sorted[i].startYear) active = sorted[i];
      else if (absoluteYear === sorted[i].startYear) {
        // In the coronation year itself, still use previous era
        // so active stays as the previous one
      }
    }
    if (!active) active = sorted[0]; // before all eras, use earliest
    var yr = absoluteYear - active.startYear + 1;
    return active.name + (yr === 1 ? '元年' : yr + '年');
  }

  function updateGsSystem(k, val) {
    if (!scriptData.gameSettings) scriptData.gameSettings = {};
    if (!scriptData.gameSettings.enabledSystems) scriptData.gameSettings.enabledSystems = {};
    scriptData.gameSettings.enabledSystems[k] = val;
    autoSave();
  }

  function updateGsField(k, val) {
    if (!scriptData.gameSettings) scriptData.gameSettings = {};
    scriptData.gameSettings[k] = val;
    autoSave();
  }

  function updateGlobalRules(val) {
    scriptData.globalRules = val;
    autoSave();
  }
  function updatePlayerInfo(field, value) {
    if (!scriptData.playerInfo) scriptData.playerInfo = {};
    scriptData.playerInfo[field] = value;
    autoSave();
    // 更新一致性警告
    _checkPlayerConsistency();
  }

  // ── 从已有势力选择填充玩家势力 ──
  function pickFactionForPlayer(factionName) {
    if (!factionName) return;
    var fac = (scriptData.factions || []).find(function(f) { return f.name === factionName; });
    if (!fac) return;
    if (!scriptData.playerInfo) scriptData.playerInfo = {};
    var pi = scriptData.playerInfo;
    pi.factionName = fac.name || '';
    pi.factionType = fac.type || fac.factionType || '';
    pi.factionLeader = fac.leader || '';
    pi.factionLeaderTitle = fac.leaderTitle || '';
    pi.factionTerritory = fac.territory || '';
    pi.factionStrength = fac.strength || '';
    pi.factionCulture = fac.culture || '';
    pi.factionGoal = fac.goal || fac.strategy || '';
    pi.factionResources = fac.resources || '';
    pi.factionDesc = fac.desc || '';
    renderPlayerOverview();
    autoSave();
    showToast('已从势力"' + fac.name + '"导入');
  }

  // ── 从已有角色选择填充玩家角色 ──
  function pickCharacterForPlayer(charName) {
    if (!charName) return;
    var ch = (scriptData.characters || []).find(function(c) { return c.name === charName; });
    if (!ch) return;
    if (!scriptData.playerInfo) scriptData.playerInfo = {};
    var pi = scriptData.playerInfo;
    pi.characterName = ch.name || '';
    pi.characterTitle = ch.title || '';
    pi.characterFaction = ch.faction || '';
    pi.characterAge = ch.age || '';
    pi.characterGender = ch.gender || '';
    pi.characterPersonality = ch.personality || '';
    pi.characterFaith = ch.faith || '';
    pi.characterCulture = ch.culture || '';
    pi.characterBio = ch.bio || '';
    pi.characterDesc = ch.desc || '';
    pi.characterAppearance = ch.appearance || '';
    pi.characterCharisma = ch.charisma || '';
    pi.characterDiplomacy = ch.diplomacy || '';
    // B2: 如果领袖即玩家，同步领袖字段
    if (pi.leaderIsPlayer !== false) {
      pi.factionLeader = ch.name || '';
      pi.factionLeaderTitle = ch.title || '';
    }
    renderPlayerOverview();
    autoSave();
    showToast('已从角色"' + ch.name + '"导入');
  }

  // ── A3: 总述结构化引导 ──
  function toggleOverviewGuide() {
    var box = document.getElementById('overviewGuideBox');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  }

  function mergeOverviewGuide() {
    var parts = [];
    var p = document.getElementById('og-politics'); if (p && p.value.trim()) parts.push('政治：' + p.value.trim());
    var m = document.getElementById('og-military'); if (m && m.value.trim()) parts.push('军事：' + m.value.trim());
    var e = document.getElementById('og-economy'); if (e && e.value.trim()) parts.push('经济：' + e.value.trim());
    var c = document.getElementById('og-conflict'); if (c && c.value.trim()) parts.push('核心矛盾：' + c.value.trim());
    if (parts.length === 0) { showToast('请至少填写一项'); return; }
    var existing = (scriptData.overview || '').trim();
    var merged = (existing ? existing + '\n\n' : '') + parts.join('。') + '。';
    scriptData.overview = merged;
    var el = document.getElementById('scriptOverview'); if (el) el.value = merged;
    autoSave();
    showToast('已合成到总述');
  }

  async function aiExpandOverviewGuide() {
    var parts = [];
    var p = document.getElementById('og-politics'); if (p && p.value.trim()) parts.push('政治局势：' + p.value.trim());
    var m = document.getElementById('og-military'); if (m && m.value.trim()) parts.push('军事态势：' + m.value.trim());
    var e = document.getElementById('og-economy'); if (e && e.value.trim()) parts.push('经济现状：' + e.value.trim());
    var c = document.getElementById('og-conflict'); if (c && c.value.trim()) parts.push('核心矛盾：' + c.value.trim());
    if (parts.length === 0) { showToast('请至少填写一项'); return; }
    showLoading('AI 扩写中...', 30);
    try {
      var dynasty = scriptData.dynasty || '';
      var prompt = '你是历史剧本设计师。请将以下要点扩写为一段300-500字的剧本总述。\n\n朝代：' + dynasty + '\n统治者：' + (scriptData.emperor || '') + '\n\n要点：\n' + parts.join('\n') + '\n\n要求：文笔优美，准确反映历史，有代入感。直接输出文本。';
      var result = await callAIEditor(prompt, 2000);
      result = result.replace(/```[\s\S]*?```/g, '').trim();
      if (result.length > 50) {
        scriptData.overview = result;
        var el = document.getElementById('scriptOverview'); if (el) el.value = result;
        autoSave();
        showToast('已生成总述');
      }
    } catch(err) { showToast('生成失败: ' + err.message); }
    hideLoading();
  }

  // ── A5: 游戏设定折叠 ──
  function toggleGameSettings() {
    var body = document.getElementById('gameSettingsBody');
    var icon = document.getElementById('gsToggleIcon');
    if (body) {
      var show = body.style.display === 'none';
      body.style.display = show ? 'block' : 'none';
      if (icon) icon.innerHTML = show ? '&#9660; 收起' : '&#9654; 展开';
    }
  }

  // ── B1: 玩家定位切换 ──
  function onPlayerRoleChange() {
    var sel = document.getElementById('playerRole');
    var custom = document.getElementById('playerRoleCustom');
    if (sel && custom) {
      custom.style.display = sel.value === 'custom' ? 'block' : 'none';
    }
  }

  // ── B2: 领袖即玩家同步 ──
  function syncLeaderFromPlayer() {
    var pi = scriptData.playerInfo || {};
    if (pi.leaderIsPlayer) {
      pi.factionLeader = pi.characterName || '';
      pi.factionLeaderTitle = pi.characterTitle || '';
      var el1 = document.getElementById('playerFactionLeader');
      var el2 = document.getElementById('playerFactionLeaderTitle');
      if (el1) { el1.value = pi.factionLeader; el1.style.opacity = '0.5'; el1.readOnly = true; }
      if (el2) { el2.value = pi.factionLeaderTitle; el2.style.opacity = '0.5'; el2.readOnly = true; }
    } else {
      var el1b = document.getElementById('playerFactionLeader');
      var el2b = document.getElementById('playerFactionLeaderTitle');
      if (el1b) { el1b.style.opacity = '1'; el1b.readOnly = false; }
      if (el2b) { el2b.style.opacity = '1'; el2b.readOnly = false; }
    }
    autoSave();
  }

  // ── B4: 同步到列表 ──
  function syncPlayerFactionToList() {
    var pi = scriptData.playerInfo || {};
    if (!pi.factionName) { showToast('势力名称为空'); return; }
    if (!scriptData.factions) scriptData.factions = [];
    var existing = scriptData.factions.find(function(f) { return f.name === pi.factionName; });
    var facData = {
      name: pi.factionName, type: pi.factionType || '', leader: pi.factionLeader || '',
      leaderTitle: pi.factionLeaderTitle || '', territory: pi.factionTerritory || '',
      strength: pi.factionStrength || '', culture: pi.factionCulture || '',
      goal: pi.factionGoal || '', resources: pi.factionResources || '', desc: pi.factionDesc || '',
      attitude: '', isPlayer: true
    };
    if (existing) { Object.assign(existing, facData); showToast('已更新势力"' + pi.factionName + '"'); }
    else { scriptData.factions.push(facData); showToast('已创建势力"' + pi.factionName + '"'); }
    if (typeof renderFactions === 'function') renderFactions();
    autoSave();
  }

  function syncPlayerCharToList() {
    var pi = scriptData.playerInfo || {};
    if (!pi.characterName) { showToast('角色名称为空'); return; }
    if (!scriptData.characters) scriptData.characters = [];
    var existing = scriptData.characters.find(function(c) { return c.name === pi.characterName; });
    var chrData = {
      name: pi.characterName, title: pi.characterTitle || '', faction: pi.characterFaction || pi.factionName || '',
      age: pi.characterAge || '', gender: pi.characterGender || '男',
      personality: pi.characterPersonality || '', faith: pi.characterFaith || '',
      culture: pi.characterCulture || '', bio: pi.characterBio || '', desc: pi.characterDesc || '',
      appearance: pi.characterAppearance || '', charisma: parseInt(pi.characterCharisma) || 60,
      diplomacy: parseInt(pi.characterDiplomacy) || 50,
      loyalty: 100, ambition: 50, intelligence: 60, valor: 50, benevolence: 50,
      type: 'historical', role: '玩家角色', isPlayer: true
    };
    if (existing) {
      // 只更新有值的字段，保留已有属性
      for (var k in chrData) { if (chrData[k] !== '' && chrData[k] !== 0) existing[k] = chrData[k]; }
      showToast('已更新角色"' + pi.characterName + '"');
    } else {
      scriptData.characters.push(chrData);
      showToast('已创建角色"' + pi.characterName + '"');
    }
    if (typeof renderCharacters === 'function') renderCharacters();
    autoSave();
    _checkPlayerConsistency();
  }

  // ── 一致性检查 ──
  function _checkPlayerConsistency() {
    var el = document.getElementById('playerConsistencyWarnings');
    if (!el) return;
    var warns = [];
    var pi = scriptData.playerInfo || {};

    if (pi.characterName && pi.characterName.trim()) {
      var found = (scriptData.characters || []).some(function(c) { return c.name === pi.characterName.trim(); });
      if (!found) {
        warns.push('角色"' + pi.characterName + '"不在角色列表中，游戏开始时将自动创建');
      }
    } else {
      warns.push('未指定玩家角色名称');
    }

    if (pi.factionName && pi.factionName.trim()) {
      var fFound = (scriptData.factions || []).some(function(f) { return f.name === pi.factionName.trim(); });
      if (!fFound) {
        warns.push('势力"' + pi.factionName + '"不在势力列表中');
      }
    }

    if (pi.characterFaction && pi.factionName && pi.characterFaction !== pi.factionName) {
      warns.push('角色所属势力"' + pi.characterFaction + '"与玩家势力"' + pi.factionName + '"不一致');
    }

    if (warns.length > 0) {
      el.style.display = 'block';
      el.innerHTML = warns.map(function(w) {
        return '<div style="padding:6px 12px;margin-bottom:4px;background:rgba(200,160,40,0.12);border:1px solid rgba(200,160,40,0.3);border-radius:6px;font-size:12px;color:#c9a96e;">⚠ ' + w + '</div>';
      }).join('');
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  }



  function renderParties() {
    var list = document.getElementById('partiesList');
    if (!list) return;
    list.innerHTML = '';
    var arr = scriptData.parties || [];
    arr.forEach(function(p, i) {
      var inf = parseInt(p.influence) || 0;
      var stClr = p.status === '\u6D3B\u8DC3' ? '#4a8a4a' : p.status === '\u5F0F\u5FAE' ? '#b8860b' : p.status === '\u88AB\u538B\u5236' ? '#8a3a3a' : '#666';
      var memberCount = (scriptData.characters || []).filter(function(c) { return c.party === p.name; }).length;
      var h = '<div class="card" onclick="openPartyModal(' + i + ')">';
      h += '<div class="card-title">' + escHtml(p.name || '未命名') + '</div>';
      h += '<div class="card-meta">';
      if (p.status) h += '<span style="display:inline-block;padding:0 5px;border-radius:8px;font-size:10px;background:' + stClr + ';color:#fff;margin-right:4px;">' + escHtml(p.status) + '</span>';
      h += escHtml(p.ideology || '') + (p.leader ? ' · ' + escHtml(p.leader) : '');
      if (memberCount > 0) h += ' <span style="font-size:10px;color:var(--txt-d);">(' + memberCount + '人)</span>';
      h += '</div>';
      // 影响力条
      if (inf > 0) h += '<div style="margin:4px 0;"><div style="height:4px;background:var(--bg-3,#222);border-radius:2px;"><div style="height:100%;width:' + inf + '%;background:var(--purple,#8a5cf5);border-radius:2px;"></div></div><div style="font-size:10px;color:var(--txt-d);margin-top:1px;">影响力 ' + inf + '</div></div>';
      if (p.currentAgenda) h += '<div style="font-size:10px;color:var(--gold);margin:2px 0;">议程: ' + escHtml(p.currentAgenda).substring(0, 40) + '</div>';
      if (p.rivalParty) h += '<div style="font-size:10px;color:var(--red,#a44);margin:1px 0;">对立: ' + escHtml(p.rivalParty) + '</div>';
      // 深化标签
      var _pTags = [];
      if (p.cohesion != null) _pTags.push('凝聚' + p.cohesion);
      if (p.crossFaction) _pTags.push('跨势力');
      if (p.splinterFrom) _pTags.push('裂自' + p.splinterFrom);
      if (Array.isArray(p.socialBase) && p.socialBase.length > 0) _pTags.push('基础:' + p.socialBase.slice(0,2).map(function(s){return s.class;}).join('/'));
      if (Array.isArray(p.agenda_history) && p.agenda_history.length > 0) _pTags.push('议程史' + p.agenda_history.length);
      if (_pTags.length) h += '<div style="font-size:9px;color:var(--txt-d);margin:2px 0;">' + _pTags.map(function(t){return '<span style="background:rgba(138,92,245,0.12);padding:0 4px;border-radius:2px;margin-right:3px;">'+escHtml(t)+'</span>';}).join('') + '</div>';
      h += '<div class="card-desc">' + escHtml((p.description || '暂无描述').substring(0, 80)) + '</div>';
      h += '<div style="position:absolute;top:8px;right:8px;"><button class="btn" style="padding:2px 8px;font-size:11px;" onclick="event.stopPropagation();deleteParty(' + i + ')">删除</button></div>';
      h += '</div>';
      list.innerHTML += h;
    });
    updateBadge('parties', arr.length);
  }

  function openPartyModal(index) {
    var isEdit = index !== undefined;
    var p = isEdit ? (scriptData.parties || [])[index]
      : {name:'', ideology:'', leader:'', influence:50, influenceDesc:'', description:'', members:'', base:'', status:'\u6d3b\u8dc3', org:'', shortGoal:'', longGoal:''};
    if (isEdit && !p) return;
    // 兼容旧数据：文本型influence转数字
    if (typeof p.influence === 'string' && isNaN(parseInt(p.influence))) { p.influenceDesc = p.influence; p.influence = 50; }
    var body = '';
    body += '<div class="form-group"><label>党派名称</label><input type="text" id="gm_name" value="' + escHtml(p.name||'') + '"></div>';
    body += '<div style="display:flex;gap:16px;">';
    body += '<div class="form-group" style="flex:1;"><label>派系立场</label><input type="text" id="gm_ideology" value="' + escHtml(p.ideology||'') + '"></div>';
    body += '<div class="form-group" style="flex:1;"><label>首领</label><input type="text" id="gm_leader" value="' + escHtml(p.leader||'') + '"></div></div>';
    // A1: influence 改为数字滑块
    body += '<div style="display:flex;gap:16px;">';
    body += '<div class="form-group" style="flex:1;"><label>影响力 (0-100)</label><div style="display:flex;align-items:center;gap:8px;"><input type="range" min="0" max="100" value="' + (parseInt(p.influence)||50) + '" id="gm_influence" oninput="document.getElementById(\'gm_inf_val\').textContent=this.value" style="flex:1;"><span id="gm_inf_val" style="min-width:24px;text-align:center;font-size:12px;color:var(--gold);">' + (parseInt(p.influence)||50) + '</span></div></div>';
    body += '<div class="form-group" style="flex:1;"><label>当前状态</label><select id="gm_status">';
    ['\u6D3B\u8DC3','\u5F0F\u5FAE','\u88AB\u538B\u5236','\u5DF2\u89E3\u6563'].forEach(function(s){ body += '<option value="'+s+'"'+(p.status===s?' selected':'')+'>'+s+'</option>'; });
    body += '</select></div></div>';
    body += '<div class="form-group"><label>影响力描述</label><input type="text" id="gm_influenceDesc" value="' + escHtml(p.influenceDesc||'') + '" placeholder="如：朝中有较大影响力"></div>';
    body += '<div class="form-group"><label>描述</label><textarea id="gm_desc" rows="3">' + escHtml(p.description||'') + '</textarea></div>';
    body += '<div style="display:flex;gap:16px;">';
    body += '<div class="form-group" style="flex:1;"><label>主要成员</label><input type="text" id="gm_members" value="' + escHtml(p.members||'') + '"></div>';
    body += '<div class="form-group" style="flex:1;"><label>支持群体</label><input type="text" id="gm_base" value="' + escHtml(p.base||'') + '"></div></div>';
    body += '<div class="form-group"><label>组织程度</label><input type="text" id="gm_org" value="' + escHtml(p.org||'') + '" placeholder="如：高度组织、松散"></div>';
    body += '<div style="display:flex;gap:16px;">';
    body += '<div class="form-group" style="flex:1;"><label>短期目标</label><input type="text" id="gm_shortGoal" value="' + escHtml(p.shortGoal||'') + '"></div>';
    body += '<div class="form-group" style="flex:1;"><label>长期追求</label><input type="text" id="gm_longGoal" value="' + escHtml(p.longGoal||'') + '"></div></div>';
    // A1: 议程/对立/政策立场
    body += '<div class="form-group"><label>当前议程</label><input type="text" id="gm_currentAgenda" value="' + escHtml(p.currentAgenda||'') + '" placeholder="当前最紧迫诉求，如：弹劾宦官、主张北伐、推行科举改革"></div>';
    body += '<div style="display:flex;gap:16px;">';
    body += '<div class="form-group" style="flex:1;"><label>对立党派</label><select id="gm_rivalParty" style="width:100%;"><option value="">无</option>';
    (scriptData.parties || []).forEach(function(rp) {
      if (rp.name && rp.name !== p.name) body += '<option value="' + escHtml(rp.name) + '"' + (p.rivalParty === rp.name ? ' selected' : '') + '>' + escHtml(rp.name) + '</option>';
    });
    body += '</select></div>';
    body += '<div class="form-group" style="flex:1;"><label>政策立场标签</label><input type="text" id="gm_policyStance" value="' + escHtml((p.policyStance||[]).join(',')) + '" placeholder="逗号分隔,如:主战,重文轻武,反宦官"></div></div>';
    // A3: 角色交叉引用
    var partyChars = (scriptData.characters || []).filter(function(c) { return c.party === p.name; });
    if (p.name && partyChars.length > 0) {
      body += '<div style="font-size:11px;color:var(--txt-d);margin:8px 0;background:var(--bg-2,#141425);padding:6px 8px;border-radius:4px;">属于此党派的角色(' + partyChars.length + '): ' + partyChars.map(function(c){return escHtml(c.name);}).join('、') + '</div>';
    }
    // ── 深化配置（社会基础/议程演进/斗争焦点/凝聚力/跨势力） ──
    body += '<details style="margin-top:12px;border:1px solid rgba(138,92,245,0.15);border-radius:6px;padding:8px;background:rgba(138,92,245,0.04);">';
    body += '<summary style="cursor:pointer;color:#8a5cf5;font-weight:700;font-size:12px;">党派深化（社会基础·议程史·斗争焦点）</summary>';
    // 内部凝聚力
    body += '<div style="display:flex;gap:16px;margin-top:10px;">';
    body += '<div class="form-group" style="flex:1;"><label>党内凝聚力 (0-100)</label><div style="display:flex;align-items:center;gap:8px;"><input type="range" min="0" max="100" value="' + (parseInt(p.cohesion)||60) + '" id="gm_cohesion" oninput="document.getElementById(\'gm_coh_val\').textContent=this.value" style="flex:1;"><span id="gm_coh_val" style="min-width:24px;text-align:center;font-size:12px;color:var(--gold);">' + (parseInt(p.cohesion)||60) + '</span></div><div style="font-size:9px;color:var(--txt-d);">低则易分裂</div></div>';
    body += '<div class="form-group" style="flex:1;"><label>党徒估数</label><input type="number" id="gm_memberCount" min="0" value="' + (parseInt(p.memberCount)||0) + '" placeholder="包含非具象成员"></div>';
    body += '<div class="form-group" style="flex:1;"><label>跨势力</label><select id="gm_crossFaction" style="width:100%;"><option value="false"' + (!p.crossFaction?' selected':'') + '>否(仅本势力)</option><option value="true"' + (p.crossFaction?' selected':'') + '>是(如主和派)</option></select></div></div>';
    // 分裂/合流族谱
    body += '<div style="display:flex;gap:16px;">';
    body += '<div class="form-group" style="flex:1;"><label>分裂自</label><select id="gm_splinterFrom" style="width:100%;"><option value="">无</option>';
    (scriptData.parties || []).forEach(function(rp) {
      if (rp.name && rp.name !== p.name) body += '<option value="' + escHtml(rp.name) + '"' + (p.splinterFrom === rp.name ? ' selected' : '') + '>' + escHtml(rp.name) + '</option>';
    });
    body += '</select></div>';
    body += '<div class="form-group" style="flex:1;"><label>合流至</label><select id="gm_mergedWith" style="width:100%;"><option value="">无</option>';
    (scriptData.parties || []).forEach(function(rp) {
      if (rp.name && rp.name !== p.name) body += '<option value="' + escHtml(rp.name) + '"' + (p.mergedWith === rp.name ? ' selected' : '') + '>' + escHtml(rp.name) + '</option>';
    });
    body += '</select></div></div>';
    // 社会基础（socialBase）——每条 {class, affinity}
    body += '<div class="form-group"><label>社会基础（支持该党的阶层及亲和度）</label>';
    body += '<textarea id="gm_socialBase" rows="2" placeholder="JSON 数组，如 [{&quot;class&quot;:&quot;士绅&quot;,&quot;affinity&quot;:0.8},{&quot;class&quot;:&quot;寒门&quot;,&quot;affinity&quot;:0.3}]——affinity 范围 -1~1">' + escHtml(JSON.stringify(p.socialBase||[])) + '</textarea></div>';
    // 议程演进历史
    body += '<div class="form-group"><label>议程演进史（可回溯剧本前若干回合的议程变化）</label>';
    body += '<textarea id="gm_agendaHistory" rows="2" placeholder="JSON 数组，如 [{&quot;turn&quot;:-3,&quot;agenda&quot;:&quot;反对新政&quot;,&quot;outcome&quot;:&quot;失败被压制&quot;}]">' + escHtml(JSON.stringify(p.agenda_history||[])) + '</textarea></div>';
    // 斗争焦点
    body += '<div class="form-group"><label>当前斗争焦点</label>';
    body += '<textarea id="gm_focalDisputes" rows="2" placeholder="JSON 数组，如 [{&quot;topic&quot;:&quot;北伐&quot;,&quot;rival&quot;:&quot;主和派&quot;,&quot;stakes&quot;:&quot;国策方向&quot;}]">' + escHtml(JSON.stringify(p.focal_disputes||[])) + '</textarea></div>';
    // 党派掌控的官位
    body += '<div class="form-group"><label>掌控官位清单</label>';
    body += '<textarea id="gm_officePositions" rows="2" placeholder="逗号分隔，如：吏部尚书,御史大夫,中书令">' + escHtml((p.officePositions||[]).join(',')) + '</textarea></div>';
    body += '</details>';
  // C1: 得罪机制可视化编辑
  body += '<div style="margin-top:12px;padding:10px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.15);border-radius:6px;">';
  body += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
  body += '<div style="font-size:12px;color:#c0392b;font-weight:700;">得罪机制（可选）</div>';
  body += '<button type="button" onclick="addOffendThreshold()" style="font-size:10px;padding:1px 8px;background:none;border:1px solid rgba(192,57,43,0.3);color:#c0392b;border-radius:3px;cursor:pointer;">+ 添加阈值</button></div>';
  body += '<div id="offendThresholdsList">';
  (p.offendThresholds || []).forEach(function(t, ti) {
    body += _renderOffendThresholdRow(t, ti);
  });
  body += '</div>';
  body += '<input type="hidden" id="gm_offendThresholds" value="' + escHtml(JSON.stringify(p.offendThresholds||[])) + '">';
  body += '</div>';
    openGenericModal(isEdit ? '编辑党派' : '添加党派', body, function() {
      var data = {
        name: gv('gm_name'), ideology: gv('gm_ideology'),
        leader: gv('gm_leader'),
        influence: parseInt(gv('gm_influence')) || 50,
        influenceDesc: gv('gm_influenceDesc'),
        description: gv('gm_desc'),
        members: gv('gm_members'), base: gv('gm_base'),
        status: gv('gm_status'),
        org: gv('gm_org'),
        shortGoal: gv('gm_shortGoal'),
        longGoal: gv('gm_longGoal'),
        currentAgenda: gv('gm_currentAgenda'),
        rivalParty: gv('gm_rivalParty'),
        policyStance: gv('gm_policyStance') ? gv('gm_policyStance').split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean) : [],
        cohesion: parseInt(gv('gm_cohesion')) || 60,
        memberCount: parseInt(gv('gm_memberCount')) || 0,
        crossFaction: gv('gm_crossFaction') === 'true',
        splinterFrom: gv('gm_splinterFrom') || null,
        mergedWith: gv('gm_mergedWith') || null,
        officePositions: gv('gm_officePositions') ? gv('gm_officePositions').split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean) : []
      };
      try { var _sb = JSON.parse(gv('gm_socialBase')); if (Array.isArray(_sb)) data.socialBase = _sb; } catch(e) { data.socialBase = []; }
      try { var _ah = JSON.parse(gv('gm_agendaHistory')); if (Array.isArray(_ah)) data.agenda_history = _ah; } catch(e) { data.agenda_history = []; }
      try { var _fd = JSON.parse(gv('gm_focalDisputes')); if (Array.isArray(_fd)) data.focal_disputes = _fd; } catch(e) { data.focal_disputes = []; }
      try { var _ot = JSON.parse(gv('gm_offendThresholds')); if (Array.isArray(_ot) && _ot.length > 0) data.offendThresholds = _ot; } catch(e) {}
      if (!data.name) { showToast('请输入名称'); return; }
      if (!scriptData.parties) scriptData.parties = [];
      if (isEdit) { scriptData.parties[index] = data; } else { scriptData.parties.push(data); }
      closeGenericModal();
      renderParties();
      autoSave();
      showToast(isEdit ? '已更新' : '已添加');
    });
  }

  function deleteParty(i) {
    if (!scriptData.parties) return;
    var deleted = scriptData.parties[i];
    var dName = deleted ? (deleted.name || '') : '';
    scriptData.parties.splice(i, 1);
    // 级联清理：角色party字段
    if (dName && scriptData.characters) {
      scriptData.characters.forEach(function(c) { if (c.party === dName) { c.party = ''; c.partyRank = ''; c.partyInfluence = undefined; } });
    }
    renderParties();
    autoSave();
    showToast('已删除');
  }

  function saveAPISettings() {
    var key = document.getElementById('apiKey') ? document.getElementById('apiKey').value.trim() : '';
    var url = document.getElementById('apiUrl') ? document.getElementById('apiUrl').value.trim() : '';
    var model = document.getElementById('apiModel') ? document.getElementById('apiModel').value.trim() : '';
    try { localStorage.setItem('tm_api', JSON.stringify({key:key, url:url, model:model})); } catch(_){}
    showToast('API设置已保存');
  }

  function loadAPISettings() {
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'editor') : console.warn('[editor] API\u914D\u7F6E\u89E3\u6790\u5931\u8D25:', e.message); }
    if (document.getElementById('apiKey')) document.getElementById('apiKey').value = cfg.key || '';
    if (document.getElementById('apiUrl')) document.getElementById('apiUrl').value = cfg.url || '';
    if (document.getElementById('apiModel')) document.getElementById('apiModel').value = cfg.model || '';
    // 加载生图API配置
    var imgCfg = {};
    try { imgCfg = JSON.parse(localStorage.getItem('tm_api_image') || '{}'); } catch(e) {}
    if (document.getElementById('imgApiKey')) document.getElementById('imgApiKey').value = imgCfg.key || '';
    if (document.getElementById('imgApiUrl')) document.getElementById('imgApiUrl').value = imgCfg.url || '';
    if (document.getElementById('imgApiModel')) document.getElementById('imgApiModel').value = imgCfg.model || '';
  }

  function saveImageAPISettings() {
    var key = (document.getElementById('imgApiKey') || {}).value || '';
    var url = (document.getElementById('imgApiUrl') || {}).value || '';
    var model = (document.getElementById('imgApiModel') || {}).value || '';
    if (key || url) {
      try { localStorage.setItem('tm_api_image', JSON.stringify({key: key.trim(), url: url.trim(), model: model.trim() || 'dall-e-3'})); } catch(_){}
    } else {
      try { localStorage.removeItem('tm_api_image'); } catch(_){}
    }
    showToast('\u751F\u56FEAPI\u8BBE\u7F6E\u5DF2\u4FDD\u5B58');
  }

  function renderAll() {
    renderPlayerOverview();
    renderCharacters();
    renderFactions();
    renderParties();
    renderClasses();
    renderItems();
    renderMilitaryNew();
    renderTechTree();
    renderCivicTree();
    renderVariables();
    renderRules();
    renderEvents();
    renderTimeline();
    renderMap();
    renderWorldSettings();
    renderEraState();
    renderEconomyConfig();
    renderPostSystem();
    renderBuildingSystem();
    renderVassalSystem();
    renderTitleSystem();
    renderMapSystem();
    renderTerrainConfig();
    renderGovernment();
    renderOfficeTree();
    if (typeof renderGoalsList === 'function') renderGoalsList();
    if (typeof renderOffendGroupsList === 'function') renderOffendGroupsList();
  }

  function renderPlayerOverview() {
    var pi = scriptData.playerInfo;
    if (!pi) {
      scriptData.playerInfo = {
        playerRole:'', playerRoleCustom:'', leaderIsPlayer:true,
        factionName:'', factionType:'', factionLeader:'', factionLeaderTitle:'',
        factionTerritory:'', factionStrength:'', factionCulture:'', factionGoal:'',
        factionResources:'', factionDesc:'',
        characterName:'', characterTitle:'', characterFaction:'', characterAge:'',
        characterGender:'', characterPersonality:'', characterFaith:'', characterCulture:'',
        characterBio:'', characterDesc:'', characterAppearance:'', characterCharisma:''
      };
      pi = scriptData.playerInfo;
    }

    // 填充势力选择器
    var facSel = document.getElementById('pickExistingFaction');
    if (facSel) {
      var facHtml = '<option value="">从已有势力选择...</option>';
      (scriptData.factions || []).forEach(function(f) {
        if (f.name) facHtml += '<option value="' + escHtml(f.name) + '">' + escHtml(f.name) + (f.leader ? ' (' + escHtml(f.leader) + ')' : '') + '</option>';
      });
      facSel.innerHTML = facHtml;
    }

    // 填充角色选择器
    var charSel = document.getElementById('pickExistingCharacter');
    if (charSel) {
      var charHtml = '<option value="">从已有角色选择...</option>';
      (scriptData.characters || []).forEach(function(c) {
        if (c.name) charHtml += '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + (c.title ? ' (' + escHtml(c.title) + ')' : '') + '</option>';
      });
      charSel.innerHTML = charHtml;
    }

    // 填充势力字段
    var el;
    if (el = document.getElementById('playerFactionName')) el.value = pi.factionName || '';
    if (el = document.getElementById('playerFactionType')) el.value = pi.factionType || '';
    if (el = document.getElementById('playerFactionLeader')) el.value = pi.factionLeader || '';
    if (el = document.getElementById('playerFactionLeaderTitle')) el.value = pi.factionLeaderTitle || '';
    if (el = document.getElementById('playerFactionTerritory')) el.value = pi.factionTerritory || '';
    if (el = document.getElementById('playerFactionStrength')) el.value = pi.factionStrength || '';
    if (el = document.getElementById('playerFactionCulture')) el.value = pi.factionCulture || '';
    if (el = document.getElementById('playerFactionGoal')) el.value = pi.factionGoal || '';
    if (el = document.getElementById('playerFactionResources')) el.value = pi.factionResources || '';
    if (el = document.getElementById('playerFactionDesc')) el.value = pi.factionDesc || '';

    // 填充角色字段
    if (el = document.getElementById('playerCharacterName')) el.value = pi.characterName || '';
    if (el = document.getElementById('playerCharacterTitle')) el.value = pi.characterTitle || '';
    if (el = document.getElementById('playerCharacterFaction')) el.value = pi.characterFaction || '';
    if (el = document.getElementById('playerCharacterAge')) el.value = pi.characterAge || '';
    if (el = document.getElementById('playerCharacterGender')) el.value = pi.characterGender || '';
    if (el = document.getElementById('playerCharacterPersonality')) el.value = pi.characterPersonality || '';
    if (el = document.getElementById('playerCharacterFaith')) el.value = pi.characterFaith || '';
    if (el = document.getElementById('playerCharacterCulture')) el.value = pi.characterCulture || '';
    if (el = document.getElementById('playerCharacterBio')) el.value = pi.characterBio || '';
    if (el = document.getElementById('playerCharacterDesc')) el.value = pi.characterDesc || '';
    if (el = document.getElementById('playerCharacterAppearance')) el.value = pi.characterAppearance || '';
    if (el = document.getElementById('playerCharacterCharisma')) el.value = pi.characterCharisma || '';

    // 玩家定位
    if (el = document.getElementById('playerRole')) { el.value = pi.playerRole || ''; }
    if (el = document.getElementById('playerRoleCustom')) {
      el.value = pi.playerRoleCustom || '';
      el.style.display = (pi.playerRole === 'custom') ? 'block' : 'none';
    }
    // 领袖即玩家
    if (el = document.getElementById('leaderIsPlayer')) { el.checked = pi.leaderIsPlayer !== false; }
    syncLeaderFromPlayer();

    // 一致性检查
    _checkPlayerConsistency();
  }

  function returnToMain() {
    // 保存到 IndexedDB（主存储）
    if (typeof TM_SaveDB !== 'undefined') {
      TM_SaveDB.save('current_script', scriptData, {
        name: scriptData.name || 'untitled',
        type: 'editor',
        turn: 0,
        scenarioName: scriptData.name || ''
      });
    }
    try { localStorage.setItem('tianming_script', JSON.stringify(scriptData)); } catch(e) {}
    if (window.tianming && window.tianming.isDesktop) {
      var meta = _getEditorMeta();
      var fname = (meta && meta.scnName) ? meta.scnName : (scriptData.name || 'untitled');
      window.tianming.saveScenario(fname, scriptData).then(function() {
        window.location.href = 'index.html';
      }).catch(function() {
        window.location.href = 'index.html';
      });
    } else {
      window.location.href = 'index.html';
    }
  }

  function updateBadge(key, count) {
    var el = document.getElementById('badge-' + key);
    if (el) el.textContent = count;
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() {
      t.classList.remove('show');
    }, 2500);
  }

  // 3.7: 实时预览面板
  var _previewOpen = false;
  function toggleEditorPreview() {
    _previewOpen = !_previewOpen;
    var panel = document.getElementById('editor-preview-panel');
    if (!panel) return;
    panel.style.display = _previewOpen ? 'block' : 'none';
    if (_previewOpen) updateEditorPreview();
  }

  function updateEditorPreview() {
    var panel = document.getElementById('editor-preview-panel');
    if (!panel || !_previewOpen) return;
    var sd = scriptData;
    var html = '<div style="text-align:center;color:var(--gold,#c9a84c);font-size:1rem;font-weight:700;margin-bottom:0.8rem;">\u5B9E\u65F6\u9884\u89C8</div>';

    // 剧本概况
    html += '<div style="margin-bottom:0.8rem;padding:0.5rem;background:var(--bg-tertiary,#1a1a25);border-radius:6px;">';
    html += '<div style="font-weight:700;color:var(--gold,#c9a84c);">' + escHtml(sd.name||'\u672A\u547D\u540D') + '</div>';
    html += '<div style="font-size:0.72rem;color:var(--text-secondary,#888);">' + escHtml(sd.dynasty||'') + ' ' + escHtml(sd.role||'') + '</div>';
    html += '<div style="font-size:0.72rem;color:var(--text-secondary,#888);">\u89D2\u8272:' + (sd.characters||[]).length + ' \u52BF\u529B:' + (sd.factions||[]).length + ' \u515A\u6D3E:' + (sd.parties||[]).length + '</div>';
    html += '</div>';

    // 角色预览（前5个）
    html += '<div style="font-weight:700;color:var(--gold,#c9a84c);margin-bottom:0.3rem;">\u89D2\u8272\u5361\u7247</div>';
    (sd.characters||[]).slice(0, 5).forEach(function(c) {
      var loy = c.loyalty || 50;
      var loyCol = loy > 60 ? '#6dbf67' : loy < 30 ? '#e74c3c' : '#c9a84c';
      html += '<div style="display:flex;gap:6px;padding:4px 6px;background:var(--bg-tertiary,#1a1a25);border-radius:4px;margin-bottom:3px;border-left:3px solid ' + loyCol + ';">';
      html += '<div><div style="font-weight:600;font-size:0.82rem;">' + escHtml(c.name||'?') + '</div>';
      html += '<div style="font-size:0.65rem;color:var(--text-secondary,#888);">' + escHtml(c.faction||'') + ' ' + escHtml(c.officialTitle||'') + '</div></div>';
      html += '<div style="margin-left:auto;font-size:0.68rem;color:' + loyCol + ';">\u5FE0' + Math.round(loy) + '</div>';
      html += '</div>';
    });
    if ((sd.characters||[]).length > 5) html += '<div style="font-size:0.68rem;color:var(--text-secondary,#888);text-align:center;">...\u53CA\u53E6\u5916' + ((sd.characters||[]).length - 5) + '\u4EBA</div>';

    // 变量预览
    var baseVars = sd.variables ? (Array.isArray(sd.variables) ? sd.variables : (sd.variables.base||[]).concat(sd.variables.other||[])) : [];
    if (baseVars.length > 0) {
      html += '<div style="font-weight:700;color:var(--gold,#c9a84c);margin-top:0.6rem;margin-bottom:0.3rem;">\u53D8\u91CF</div>';
      baseVars.filter(function(v){return v.isCore;}).slice(0,8).forEach(function(v) {
        var pct = v.max ? Math.round((v.value||0) / v.max * 100) : 50;
        html += '<div style="display:flex;align-items:center;gap:4px;font-size:0.72rem;margin-bottom:2px;">';
        html += '<span style="width:60px;color:var(--text-secondary,#888);">' + escHtml(v.displayName||v.name) + '</span>';
        html += '<div style="flex:1;height:4px;background:#333;border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--gold,#c9a84c);border-radius:2px;"></div></div>';
        html += '<span style="width:30px;text-align:right;">' + (v.value||0) + '</span></div>';
      });
    }

    // mechanicsConfig概况
    var mc = sd.mechanicsConfig || {};
    html += '<div style="font-weight:700;color:var(--gold,#c9a84c);margin-top:0.6rem;margin-bottom:0.3rem;">\u673A\u5236\u914D\u7F6E</div>';
    html += '<div style="font-size:0.7rem;color:var(--text-secondary,#888);">';
    html += '\u8026\u5408\u89C4\u5219: ' + ((mc.couplingRules||[]).length) + ' | ';
    html += 'NPC\u884C\u4E3A: ' + ((mc.npcBehaviorTypes||[]).length) + ' | ';
    html += '\u8BAE\u7A0B: ' + ((mc.agendaTemplates||[]).length);
    html += '</div>';

    panel.innerHTML = html;
  }

  // 监听scriptData变化——定时刷新预览 (timer-leak-ok·文件顶层一次性·随编辑器页生命周期)
  setInterval(function() { if (_previewOpen) updateEditorPreview(); }, 3000);
