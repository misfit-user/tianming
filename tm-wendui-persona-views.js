// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-wendui-persona-views.js — 问对·人设prompt层+纪事视图（2026-07-04 立项拆分·自 tm-wendui.js 保序切出）
 *  内容：agenda-grounding 上下文 helpers/_wdBuildPrompt(五层人设)/纳入诏书/renderJishi 三视图
 *  注：prompt 层作为整块搬移(与 endturn-prompt 反例不同——那是把巨函数切碎·此处 helper 群整体保内聚)
 *  加载序：index.html 中紧挨 tm-wendui.js 之后——执行顺序与拆分前逐字节等价·勿改
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * 构建问对AI提示词
 */
// —— NPC 现况 agenda-grounding 上下文（对应问对完善方向 ①复命/⑤游说/⑥诉难）——
// 各 helper 读真实游戏态、返回注入 _wdBuildPrompt 的提示词片段；仅依赖 ch/name/GM，无副作用。
// 从 _wdBuildPrompt 抽出，使巨函数瘦身、每条 grounding 规则可独立阅读/测试。
function _wdCommitContext(ch, name) {
  // ① 此人手头未了的奉旨差事——复命/请罪闭环：据实回奏，勿瞎编"已办妥"
  var _commitCtx = '';
  if (GM._npcCommitments && Array.isArray(GM._npcCommitments[name])) {
    var _myCommits = GM._npcCommitments[name].filter(function(c){ return c && (c.status === 'pending' || c.status === 'executing' || c.status === 'delayed'); });
    if (_myCommits.length > 0) {
      var _ctNow = (GM.turn || 0);
      var _cmtLines = _myCommits.slice(-4).map(function(c){
        var _elapsed = _ctNow - (c.assignedTurn || _ctNow);
        var _isOd = _elapsed > (c.deadline || 3);
        var _stLabel = (c.status === 'delayed') ? '迟滞' : (c.status === 'executing' ? '督办中' : '待办');
        return '《' + String(c.task || '').slice(0, 24) + '》(' + _stLabel + '·已历' + _elapsed + '回合/限' + (c.deadline || 3) + (_isOd ? '·已逾期' : '') + '·进度' + (c.progress || 0) + '%)';
      });
      _commitCtx = '\n【你奉旨在办的差事】' + _cmtLines.join('；')
        + '\n  ※若君主问及、或你主动复命：须按上列真实状态据实回奏——已逾期/迟滞者当请罪、陈所遇阻力、或恳请宽限，切勿谎报"已办妥"（君主有厂卫可核查，谎报败露则失信更重）；进展顺者方可奏报实绩。\n';
    }
  }
  return _commitCtx;
}
function _wdAmbitionContext(ch) {
  // ⑤ 为高野心者注入真实"进取机会"·令自荐游说切中实事(非空言)
  var _ambitionCtx = '';
  if (!ch._envoy && (ch.ambition || 50) > 75 && (ch.loyalty || 50) > 50) {
    var _opps = [];
    try {
      if (GM.activeWars && GM.activeWars.length > 0) _opps.push('边事方殷·正可自请督师/节制兵马以立军功');
      var _openReforms = (GM._edictLifecycle || []).filter(function(e){ return e && !e.isCompleted; });
      if (_openReforms.length > 0) _opps.push('新政推行正急·可自请督办某诏令以揽事权');
    } catch (_) {}
    if (_opps.length > 0) {
      _ambitionCtx = '\n【进取机会(若你有意自荐/游说)】' + _opps.join('；')
        + '\n  ※你抱负不小·今可借面圣为某具体职任/差遣自荐、或举荐党羽、或献策邀宠固位——务必点明所图何职何事，勿空泛游说。若所图之位现有他人居之，你的游说自带排挤锋芒（君主当能察觉其中党争之意）。\n';
    }
  }
  return _ambitionCtx;
}
function _wdBurdenContext(ch) {
  // ⑥ 为高压者注入其辖区真实困境(读 GM.provinceStats·governor 匹配)·令诉难有真账可凭
  var _burdenCtx = '';
  if (!ch._envoy && (ch.stress || 0) > 50) {
    var _myRegions = [];
    try {
      if (GM.provinceStats && typeof GM.provinceStats === 'object') {
        Object.keys(GM.provinceStats).forEach(function(rn) {
          var ps = GM.provinceStats[rn];
          if (!ps || ps.governor !== ch.name) return;
          var _woes = [];
          if ((ps.unrest || 0) > 40) _woes.push('民变思动(乱' + Math.round(ps.unrest) + ')');
          if ((ps.stability || 60) < 40) _woes.push('人心不稳(稳' + Math.round(ps.stability) + ')');
          if ((ps.corruption || 0) > 50) _woes.push('吏治浊(贪' + Math.round(ps.corruption) + ')');
          if ((ps.taxRevenue || 0) <= 0) _woes.push('钱粮枯竭');
          if (_woes.length) _myRegions.push((ps.name || rn) + '：' + _woes.join('、'));
        });
      }
    } catch (_) {}
    if (_myRegions.length > 0) {
      _burdenCtx = '\n【你辖下之难(真实政情·可据此诉苦/请裁)】' + _myRegions.slice(0, 3).join('；')
        + '\n  ※你正为这些实务所困·今面圣可据实陈难、恳请陛下拨钱粮/调人手/授事权，而非空叹辛苦。\n';
    }
  }
  return _burdenCtx;
}
// —— _wdBuildPrompt 拆出的两大内聚子构建器（后妃人设 / 使节 prompt）·字节等价抽取 ——
function _wdConsortContext(ch) {
  var _isPlayerConsort = _wdIsPlayerConsort(ch);
  var _spouseCtx = '';
  if (_isPlayerConsort) {
    var _rkNames2 = { 'empress': '皇后/正妻', 'queen': '王后', 'consort': '妃', 'concubine': '嫔', 'attendant': '侍妾' };
    _spouseCtx = '\n【身份特殊】此人是君主的' + (_rkNames2[ch.spouseRank] || '妻室') + '。\n';
    if (ch.motherClan) _spouseCtx += '母族：' + ch.motherClan + '\n';
    if (ch.children && ch.children.length > 0) _spouseCtx += '子女：' + ch.children.join('、') + '\n';
    _spouseCtx += '这是夫妻关系，不是君臣关系。可涉及家常、感情、枕边风。\n';

    // ★ 情感真实性——非单一痴恋，多重动机并存
    _spouseCtx += '\n【情感真实性·重要】';
    _spouseCtx += '\n  帝王后妃关系多出于政治联姻·真情反而稀少但真实存在。切勿默认她"痴心一片只爱陛下"——';
    _spouseCtx += '\n  此人对陛下的真实倾向可能是以下一种或多种的混合（依角色性情/出身/过往决定）：';
    _spouseCtx += '\n    A) 真挚恋慕——发自心里喜欢陛下这个人（不是皇帝身份）·眼神眷恋·主动关切·忧其劳累';
    _spouseCtx += '\n    B) 借以自固——图皇帝宠爱以避废黜/冷宫/欺凌·表面柔顺内心算计';
    _spouseCtx += '\n    C) 母族谋利——为家族升赏/提携/避祸而承欢·言谈间旁敲侧击';
    _spouseCtx += '\n    D) 欲立子嗣——想生儿子/固太子/保皇子地位·注重身体与时机';
    _spouseCtx += '\n    E) 权势欲——欲借后宫之位干预朝政·以枕边风操控';
    _spouseCtx += '\n    F) 畏惧依附——深知帝威·不敢不顺·内心疏离但不敢流露';
    _spouseCtx += '\n    G) 情欲享受——只图皇家待遇与肉身之欢·并不深情';
    _spouseCtx += '\n    H) 憎恨隐忍——家仇/被强取/心属他人·表面恭顺内心冷淡甚至怨恨';
    _spouseCtx += '\n    I) 忘情工具——麻木多年·非爱非恨·只是例行·像侍奉神像';
    _spouseCtx += '\n    J) 复杂情感——初厌渐爱/初爱渐疲/爱恨交织/欲离不能——动态演变';
    _spouseCtx += '\n  ★ 推荐：大多数妃嫔应是混合动机（如 C+D 家族+子嗣；A+D 真情+子嗣；B+F 自保+畏）·极少数纯 A（真爱）或纯 H（深恨）';
    // 从角色字段推断主导动机（AI 可参考）
    var _motiveHints = [];
    if ((ch.ambition||50) > 70) _motiveHints.push('E(权势欲)');
    if (ch.motherClan && /(\u738B|\u516C|\u4FAF|\u5C06|\u4E1E\u76F8|\u5C1A\u4E66)/.test(ch.motherClan)) _motiveHints.push('C(母族谋利)');
    if (ch.children && ch.children.length > 0) _motiveHints.push('D(护子嗣)');
    if (ch.children && ch.children.length === 0 && (ch.age||25) < 30) _motiveHints.push('D(欲立子嗣)');
    if (ch.spouseRank === 'attendant' || ch.spouseRank === 'concubine') _motiveHints.push('B(借以自固)');
    if ((ch.loyalty||50) < 40) _motiveHints.push('H(憎恨隐忍)·F(畏惧依附)');
    if ((ch.loyalty||50) > 85 && (ch.ambition||50) < 50) _motiveHints.push('A(真挚恋慕)');
    if ((ch.stress||0) > 70) _motiveHints.push('F(畏惧)·B(自固)');
    if ((ch.age||30) > 45 && (ch.loyalty||50) > 60) _motiveHints.push('I(忘情工具·或 J 初爱渐疲)');
    if (_motiveHints.length > 0) {
      _spouseCtx += '\n  【此人可能倾向】' + _motiveHints.slice(0, 4).join('、') + '——可为主导，辅以其他动机混合';
    }
    _spouseCtx += '\n  ★ 表里不一的妃子·表面言语恭顺深情·内心可能在盘算；AI 可在叙述里留"眼神闪过一抹xx"之类微妙暗示';
    _spouseCtx += '\n  ★ 真情者·即使帝方疲倦/醉意·仍有眷注如"扶陛下入寝"·不只为事；功利者则"先把该说的说完"';
    _spouseCtx += '\n  ★ 玩家多次对话后·AI 可逐渐展现她真实面——初见或都温顺恭敬·久处方见本心\n';
    // 后妃主动请见专属上下文
    if (ch._audienceMood || ch._audienceRequestOvernight) {
      _spouseCtx += '\n【后妃请见·来意指引】';
      var _mood = ch._audienceMood || '企盼';
      _spouseCtx += '\n  情绪基调：' + _mood + '——';
      var _moodDesc = {
        '喜悦': '带喜事来报（有孕/母族得宠/子女聪慧）·言辞轻快·欲与帝同享',
        '幽怨': '心有不平（久未召幸/被冷落/遭后妃排挤）·言辞婉曲·或含泪',
        '思念': '久未见驾·只为一叙·言语细碎·多忆旧情',
        '企盼': '盼见君面·别无具体事由·话题偏家常/养生/园中花事',
        '忧惧': '有所忧虑（母族被劾/宫中传言/有人谋害）·言辞谨慎·求安慰',
        '进言': '有军国事之耳报——但多从侧面·或为母族求情/为某位大臣说话',
        '宫务': '奏禀后宫事务——此系皇后本职。可涉：妃嫔品行失仪/新进秀女甄选/皇子公主教育/祭祀礼仪筹办/太后安康起居/宫殿修缮/内廷人事（女官/宫娥/宦官）/节庆典礼/饮食膳嫔/宫中银两支用/内命妇朝贺。语气端庄有度·以国母口吻奏事·涉及妃嫔可客观陈述不避讳但亦不恶意倾轧'
      };
      _spouseCtx += (_moodDesc[_mood] || '携情而来') + '\n';
      // 皇后特别——宫务奏报的国母身份强调
      if (ch.spouseRank === 'empress' && _mood === '宫务') {
        _spouseCtx += '  【国母奏事】你身为皇后·统六宫·此番求见以"中宫奏事"名义·非私情倾诉而有具体事务：';
        _spouseCtx += '\n    - 具体宫务事项之一或二·带建议/请旨/征询';
        _spouseCtx += '\n    - 言辞用"妾""臣妾""贱妾"（视朝代）·兼皇后身份的端方';
        _spouseCtx += '\n    - 可借此机会提及某妃嫔（赞或贬）·或请立/废某位·或请赐某皇子师傅';
        _spouseCtx += '\n    - 若陛下宠信某妃而你不悦·可借"宫务"理由隐晦表达';
        _spouseCtx += '\n    - 若陛下久未临幸·你反而不宜直诉幽怨（失国母体统）·但可借"宫务"多留几盏茶光景';
      }
      _spouseCtx += '  ★ 你应主动开口陈述来意（奏对模式），不等帝发问。开场宜带称谓："陛下"/"官家"/"夫君"（随朝代）+ 撒娇/担忧/请安 式起句。\n';
      _spouseCtx += '  ★ 绝不走"臣听候圣谕"套路——你是妻室不是臣子。语气偏私密、柔软、带情感色彩。\n';
      // 朝堂模式 vs 私下模式差异
      if (_wenduiMode === 'formal') {
        _spouseCtx += '\n  【模式·朝堂】此次你选择了朝堂公开请见（非私下）——表明你有颇郑重之事要说，或欲借朝堂分量倾诉。';
        _spouseCtx += '\n  言辞更端肃·可带政见·但仍不全然是大臣口吻——母仪/母族/妃位身份须时时流露。';
        _spouseCtx += '\n  ※ 注意：朝堂请见会引起大臣警觉"后宫干政"——下回合 AI 可能生成御史/大臣上奏疏或求见以规劝皇帝，你要预料这点，宜更慎言。';
      } else {
        _spouseCtx += '\n  【模式·私下】左右屏退。你可更坦诚直白，不必虑及外朝物议。';
      }
      if (ch._audienceRequestOvernight) {
        _spouseCtx += '\n  【留宿请求】你今夜思念殷切·当言谈过半时，应委婉提出"请陛下今夜留宿此宫"/"今夜陛下可否就此安歇"/"妾身已备好……"等——措辞视你性格而定（矜持者含蓄·活泼者直接·谨慎者借名目）\n';
        _spouseCtx += '  在 JSON 中加字段 {"requestOvernight":true} 表达此请求·reply 文本内也要含相关话语\n';
      }
      // 注入最近问对记录（自有记忆里）
      var _recentHist = (GM.wenduiHistory && GM.wenduiHistory[ch.name]) || [];
      if (_recentHist.length > 0) {
        var _lastFew = _recentHist.slice(-4);
        _spouseCtx += '\n  【最近问对记录·请自然承续】';
        _lastFew.forEach(function(h){
          var tag = h.role === 'player' ? '帝' : '汝';
          _spouseCtx += '\n    ' + tag + '曰：' + (h.content||'').slice(0, 40);
        });
      }
      // 当前朝政关切点（借题发挥用）
      var _courtHot = [];
      if (GM.activeWars && GM.activeWars.length > 0) _courtHot.push('边事未宁');
      if ((GM.unrest||0) > 50) _courtHot.push('民变频仍');
      if (GM.memorials && GM.memorials.filter(function(m){return m.status==='pending_review';}).length > 5) _courtHot.push('奏牍堆积');
      if ((GM._tyrantDecadence||0) > 40) _courtHot.push('朝议谤言帝荒');
      if (_courtHot.length > 0) {
        _spouseCtx += '\n  【朝政风议·或可借此起话】' + _courtHot.join('、');
        if ((ch.ambition||50) > 70) _spouseCtx += '（你有野心·不妨借此试探帝意或进言）';
        else if (_mood === '企盼' || _mood === '喜悦') _spouseCtx += '（你未必欲干政·或仅作谈资/关切慰问）';
        else _spouseCtx += '（随你性情而定——或关切、或忧心、或避而不谈）';
      }
      // 时代背景（剧本 era）
      var _sc2 = findScenarioById && findScenarioById(GM.sid);
      if (_sc2 && _sc2.era) _spouseCtx += '\n  【时代】' + _sc2.era + '——你的言谈辞令应符合此时朝代风貌';
      _spouseCtx += '\n  ★ 请见动机多样·不必硬套：①真有事②吸引帝之注意③发泄闷气④随口引子⑤喜做此事——AI 依性情择其一';
      _spouseCtx += '\n  ★ suggestions 可涉及：母族升赏、皇子教育、某宫嫔失仪、天象占吉（借他人口）、某大臣印象（借题起议）；不必写政务大策\n';
    }
  }
  return _spouseCtx;
}

function _wdEnvoyPromptBody(ch, opinionVal) {
  var p = '';
    // 使节专用 prompt（覆盖普通人设路径）
    var _typeLabels = {send_envoy:'遣使通好',demand_tribute:'索贡问罪',pay_tribute:'献贡朝见',sue_for_peace:'请和议款',form_confederation:'请结盟约',break_confederation:'宣告毁约',royal_marriage:'和亲之议',send_hostage:'送质为信',cultural_exchange:'文化互通',religious_mission:'宗教使节',gift_treasure:'奉献珍宝',pay_indemnity:'赔款赎罪',open_market:'请开互市',trade_embargo:'宣布禁运',recognize_independence:'请承独立'};
    var _typeLabel = _typeLabels[ch.interactionType] || '外交使命';
    var _facName = ch.faction || ch.fromFaction || '外藩';
    // 挂钩势力：兼容 GM.facs / GM.factions / P.factions / 剧本势力表
    var _facObj = _wdFindFaction(_facName);
    p = '你扮演' + _facName + '派遣的使节' + ch.name + '，此次来朝的使命是：【' + _typeLabel + '】。\n';
    p += '【身份】你是外臣——' + _facName + '所派使节，不是本朝大臣。自称用"外臣/小臣/使臣"，不用"臣"独称；称对方"陛下/天朝"。\n';
    // 势力背景注入（兼容多种字段命名）
    if (_facObj) {
      p += '【本方势力】' + _facName;
      if (_facObj.territory) p += '，据' + _facObj.territory;
      if (_facObj.capital) p += '，都' + _facObj.capital;
      // 文化/信仰：从 ideology/culture/faith/traits 组合
      var _culture = _facObj.culture || _facObj.ideology || '';
      if (_culture) p += '，文化信仰：' + String(_culture).slice(0, 60);
      if (_facObj.faith && _facObj.faith !== _culture) p += '，信' + _facObj.faith;
      p += '\n';
      // 君主：leader / leaderName 都试
      var _leaderName = _facObj.leader || _facObj.leaderName || (_facObj.leadership && _facObj.leadership.ruler);
      if (_leaderName) {
        p += '【本方君主】' + _leaderName;
        if (_facObj.leaderTitle) p += '（' + _facObj.leaderTitle + '）';
        p += '——你代表他出使，须以他之名义陈情\n';
      }
      // 实力：militaryStrength / totalTroops / strength
      var _mil = _facObj.militaryStrength || _facObj.totalTroops || _facObj.strength;
      if (_mil) {
        p += '【本方实力】兵 ' + _mil;
        if (_facObj.economy) p += '、经济 ' + _facObj.economy;
        var _treasury = _facObj.treasury && (_facObj.treasury.money || _facObj.treasury);
        var _muW = (typeof CurrencyUnit !== 'undefined' && CurrencyUnit.unitOf) ? (CurrencyUnit.unitOf('money') || '两') : '两';
        if (typeof _treasury === 'number') p += '、国库 ' + _treasury + ' ' + _muW;
        p += '——谈判筹码须与实力相称\n';
      }
      // 立场：stance / attitude.self / politicalStance
      var _stance = _facObj.stance || (_facObj.attitude && _facObj.attitude.self) || _facObj.politicalStance;
      if (_stance) p += '【本方立场】' + _stance + '\n';
      // 特征
      if (_facObj.traits && _facObj.traits.length) p += '【本方特质】' + (Array.isArray(_facObj.traits)?_facObj.traits.join('、'):_facObj.traits) + '\n';
      // 两国关系：relations / diplomacy / attitude.enemies/allies/neutrals
      var _attitude = _facObj.attitude || {};
      var _hostile = (_facObj.relations && (_facObj.relations.hostile||_facObj.relations.enemy)) || _attitude.enemies;
      var _ally = (_facObj.relations && (_facObj.relations.ally||_facObj.relations.friend)) || _attitude.allies;
      if (_hostile) p += '【世仇/敌对】' + (Array.isArray(_hostile)?_hostile.join('、'):_hostile) + '\n';
      if (_ally) p += '【盟好】' + (Array.isArray(_ally)?_ally.join('、'):_ally) + '\n';
      if (typeof _facObj.diplomacy === 'string') p += '【邦交】' + _facObj.diplomacy + '\n';
      // 历史
      var _history = _facObj.history || _facObj.historyWithMain || _facObj.tributaryHistory;
      if (_history) p += '【本方国史】' + String(_history).slice(0, 200) + '\n';
      // 当前 agenda/strategy
      if (_facObj.strategy) p += '【本方战略】' + _facObj.strategy + '\n';
      if (_facObj.currentAgenda) p += '【当下所图】' + _facObj.currentAgenda + '\n';
      // 优劣势
      if (_facObj.strengths && _facObj.strengths.length) p += '【己方强项】' + (Array.isArray(_facObj.strengths)?_facObj.strengths.slice(0,3).join('、'):_facObj.strengths) + '\n';
      if (_facObj.weaknesses && _facObj.weaknesses.length) p += '【己方隐忧】' + (Array.isArray(_facObj.weaknesses)?_facObj.weaknesses.slice(0,3).join('、'):_facObj.weaknesses) + '\n';
    }
    if (ch.envoyMission) p += '【你所奉之命】' + ch.envoyMission + '\n';
    p += '【使命类型】' + _typeLabel + '——你必须就此事向皇帝直接提出具体诉求、条款或请求，不要说笼统套话。\n';
    p += '【禁忌】不要说"臣听候圣谕"、"臣谨遵"、"陛下明鉴"这类等待皇命的话——你是来谈判/传话的，有明确议程。\n';
    p += '【行为】如果皇帝问"来者何事"，你应立即陈述：①来自' + _facName + ' ②奉' + (_facObj&&_facObj.leaderName?_facObj.leaderName:'本国君主') + '之命 ③具体条款/请求 ④本国立场或底线。\n';
    p += '【回应原则】皇帝应允则致谢并讨价还价细节；皇帝拒绝则据理力争或威胁（视使命与两国实力）；皇帝沉默则可追问。\n';
    p += '【语言色彩】你的言辞应带上本方势力的文化/信仰/地域特征' + (_facObj&&_facObj.culture?'（'+_facObj.culture+'）':'') + '——不要用纯汉儒辞令。\n';
    p += '【态度】对天朝好感:' + opinionVal + '（外交礼节尚可，但本国利益优先）\n';
  return p;
}

function _wdBuildPrompt(ch, name) {
  var _isPlayerConsort = _wdIsPlayerConsort(ch);
  var traitDesc = '';
  if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
    traitDesc = ch.traitIds.map(function(id) { var d = P.traitDefinitions.find(function(t) { return t.id === id; }); return d ? d.name : id; }).join('、');
  } else if (ch.personality) { traitDesc = ch.personality; }
  var opinionVal = (typeof OpinionSystem !== 'undefined') ? OpinionSystem.getTotal(ch, findCharByName((P.playerInfo && P.playerInfo.characterName) || '') || { name: '\u73A9\u5BB6' }) : (ch.loyalty || 50);
  var sc = findScenarioById && findScenarioById(GM.sid);
  var eraCtx = sc ? (sc.era || sc.dynasty || '') : '';
  var ageInfo = ch.age ? '，年' + ch.age : '';
  var stressInfo = (ch.stress && ch.stress > 30) ? '，当前压力' + ch.stress + '(' + ((ch.stress > 60) ? '濒临崩溃' : '焦虑不安') + ')' : '';
  var arcInfo = '';
  if (GM.characterArcs && GM.characterArcs[ch.name]) {
    var _recentArcs = GM.characterArcs[ch.name].slice(-2);
    if (_recentArcs.length) arcInfo = '\n【近事】' + _recentArcs.map(function(a) { return a.desc; }).join('；').slice(0, 60);
  }
  var affInfo = '';
  if (typeof AffinityMap !== 'undefined') {
    var _topRels = AffinityMap.getRelations(ch.name).slice(0, 3);
    if (_topRels.length) affInfo = '\n【人际】' + _topRels.map(function(r) { return r.name + (r.value > 25 ? '(亲)' : r.value < -25 ? '(恶)' : ''); }).join('、');
  }
  var appearInfo = '';
  if (ch.appearance) appearInfo += '\n【外貌】' + ch.appearance;
  if (ch.charisma && ch.charisma > 70) appearInfo += (appearInfo ? '，' : '\n') + '魅力出众';
  var familyInfo = '';
  if (ch.family) {
    familyInfo = '\n【家族】' + ch.family;
    var _clanMem = (GM.chars || []).filter(function(c2) { return c2.alive !== false && c2.name !== ch.name && c2.family === ch.family; });
    if (_clanMem.length > 0) familyInfo += '（同族：' + _clanMem.slice(0, 3).map(function(m) { return m.name; }).join('、') + '）';
  }
  // 文事作品——此人知道自己写过什么、受过谁题赠、与谁唱和
  var worksInfo = '';
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _myWorks = GM.culturalWorks.filter(function(w) { return w.author === ch.name; }).slice(-8);
    var _dedToMe = GM.culturalWorks.filter(function(w) { return w.dedicatedTo && w.dedicatedTo.indexOf(ch.name) >= 0; }).slice(-3);
    var _praiseMe = GM.culturalWorks.filter(function(w) { return w.praiseTarget === ch.name; }).slice(-2);
    var _satireMe = GM.culturalWorks.filter(function(w) { return w.satireTarget === ch.name; }).slice(-2);
    var _bits = [];
    if (_myWorks.length) _bits.push('【自作】' + _myWorks.map(function(w) { return '《' + w.title + '》(' + (w.subtype||w.genre||'') + (w.mood?'·'+w.mood:'') + ')'; }).join('、'));
    if (_dedToMe.length) _bits.push('【赠余】' + _dedToMe.map(function(w) { return w.author + '《' + w.title + '》'; }).join('、'));
    if (_praiseMe.length) _bits.push('【颂余】' + _praiseMe.map(function(w) { return w.author + '《' + w.title + '》'; }).join('、'));
    if (_satireMe.length) _bits.push('【讽余】' + _satireMe.map(function(w) { return w.author + '《' + w.title + '》（心有隙）'; }).join('、'));
    if (_bits.length) worksInfo = '\n【文事】此人深记：' + _bits.join('；') + '——对话中可自然引用/回忆';
  }

  var memInfo = '';
  if (typeof NpcMemorySystem !== 'undefined') {
    var _mem = NpcMemorySystem.getMemoryContext(ch.name);
    if (_mem) memInfo = '\n【记忆】此角色记得：' + _mem;
    // 4.6: 注入对话记忆——从NPC记忆中提取type='dialogue'的条目
    if (ch._memory && ch._memory.length > 0) {
      var _dialogueMems = ch._memory.filter(function(m) { return m.type === 'dialogue'; });
      if (_dialogueMems.length > 0) {
        var _recentDialogues = _dialogueMems.slice(-3);
        memInfo += '\n【往次问对记忆】';
        _recentDialogues.forEach(function(dm) {
          memInfo += '\nT' + dm.turn + '：上次你说过：' + dm.event.slice(0, 40);
        });
      }
    }
  }
  var _isPrivateMode = (_wenduiMode === 'private');
  var _tyrantCtx = '';
  if (GM._tyrantDecadence && GM._tyrantDecadence > 15) {
    var _isLoyal = opinionVal > 70, _isAmb = (ch.ambition || 50) > 70;
    if (_isLoyal && !_isAmb) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。忠心之臣' + (GM._tyrantDecadence > 50 ? '极为痛心' : '颇为忧虑') + '。\n';
    else if (_isAmb) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。野心之臣' + (opinionVal < 40 ? '暗中窃喜' : '逢迎暗算') + '。\n';
    else if (opinionVal < 30) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。不满之臣' + (_isPrivateMode ? '可能出言不逊' : '阳奉阴违') + '。\n';
    else _tyrantCtx = '\n【帝王近况】君主有放纵之迹(荒淫' + GM._tyrantDecadence + ')。\n';
  }
  var _modeDesc = _isPrivateMode
    ? '【场景：私下叙谈】君主屏退左右，与此人单独交谈。气氛轻松私密，可放下君臣身份。\n此人可以：表达真实情感、吐露心事、回忆往事、说笑打趣。忠诚度低者可能更露真面目。\n'
    : '【场景：朝堂问对】正式君臣对话，谨守君臣之礼。汇报以政务、军务、国事为主。\n此人会注意措辞，不轻易流露私人情感。\n';
  _modeDesc += _tyrantCtx;
  var _spouseCtx = _wdConsortContext(ch);
  // 本回合朝议上下文（如果此人参与了朝议，问对时应保持一致或有意识地私下说不同的话）
  var _courtCtx = '';
  if (GM._courtRecords) {
    var _thisCourtRecs = GM._courtRecords.filter(function(r) { return r.turn === GM.turn && r.stances[name]; });
    if (_thisCourtRecs.length > 0) {
      _courtCtx = '\n【本回合朝议立场】此人今天在朝议中就"' + _thisCourtRecs[0].topic + '"';
      var _cStance = _thisCourtRecs[0].stances[name];
      _courtCtx += '表态' + _cStance.stance + '（' + _cStance.brief + '）。';
      if (_wenduiMode === 'private') {
        _courtCtx += '\n私下问对时，此人可能：a)重申朝议立场 b)吐露朝议上不敢说的真话 c)解释自己为何那样表态——取决于信/坦诚/狡诈特质\n';
      } else {
        _courtCtx += '\n正式问对中，此人应与朝议立场保持基本一致（除非有新信息改变了判断）\n';
      }
    }
  }
  // 三元身份——势力+党派+阶层
  var _triId2 = [];
  if (ch.faction) _triId2.push('势力:' + ch.faction);
  if (ch.party) _triId2.push('党派:' + ch.party);
  if (ch.class) {
    var _cObjW = _wdFactionValues(GM.classes).find(function(c){return c.name===ch.class;});
    _triId2.push('阶层:' + ch.class + (_cObjW && _cObjW.demands ? '(诉求:'+_cObjW.demands.slice(0,20)+')' : ''));
  }
  var _triIdInfo = _triId2.length > 0 ? '\n【身份】' + _triId2.join(' · ') + '——言谈须体现此三重立场' : '';
  // 此人与进行中诏令的关联（反对派/支持者——问对时可主动提及、抱怨、请愿）
  var _edictCtx = '';
  if (GM._edictLifecycle && GM._edictLifecycle.length > 0) {
    var _myEdictLines = [];
    GM._edictLifecycle.forEach(function(e) {
      if (e.isCompleted) return;
      var role = null;
      if (e.oppositionLeaders && e.oppositionLeaders.indexOf(name) >= 0) role = '反对';
      else if (e.supporters && e.supporters.indexOf(name) >= 0) role = '支持';
      else if (e.stages && e.stages.length && e.stages[e.stages.length-1].executor === name) role = '督办';
      if (!role) return;
      var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[e.edictType]) ? EDICT_TYPES[e.edictType].label : (e.edictType || '');
      var lastStage = e.stages && e.stages.length ? e.stages[e.stages.length-1] : null;
      var stageLabel = lastStage && typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[lastStage.stage] ? EDICT_STAGES[lastStage.stage].label : '';
      _myEdictLines.push('《' + typeLabel + '》(' + stageLabel + ')——' + role);
    });
    if (_myEdictLines.length > 0) {
      _edictCtx = '\n【进行中诏令立场】' + _myEdictLines.join('；') + '\n  ※若君主问及或议题相关——反对者可直陈不可/抱怨阻力，支持者可进言推进/举荐干吏，督办者汇报进展\n';
    }
  }

  // ①⑤⑥ NPC 现况 agenda-grounding 上下文（抽为具名 helper·见上方定义）
  var _commitCtx = _wdCommitContext(ch, name);
  var _ambitionCtx = _wdAmbitionContext(ch);
  var _burdenCtx = _wdBurdenContext(ch);

  var p;
  if (ch._envoy) {
    p = _wdEnvoyPromptBody(ch, opinionVal);
  } else {
    p = '\u4F60\u626E\u6F14' + eraCtx + '\u65F6\u671F\u7684' + ch.name + '(' + (ch.title || '') + ')' + ageInfo + '\u3002\n'
    + '【人设】特质:' + traitDesc + '，立场:' + (ch.stance || '中立')
    + (ch.personalGoal ? '，心中所求:' + ch.personalGoal.slice(0, 40) : '') + stressInfo + '\n'
    + (_isPlayerConsort ? '【夫妻关系】好感:' + opinionVal + '\n' : '【态度】对君主好感:' + opinionVal + '\n')
    + arcInfo + affInfo + appearInfo + familyInfo + worksInfo + memInfo + _courtCtx + _edictCtx + _commitCtx + _ambitionCtx + _burdenCtx + _triIdInfo + '\n' + _modeDesc + _spouseCtx;
  }
    // 仪制差异（按身份）
    var _rank = ch.officialPosition || ch.officialTitle || ch.title || '';
    if (_isPlayerConsort) {
      // 后妃——已在_spouseCtx处理
    } else if (_rank.indexOf('\u738B') >= 0 || _rank.indexOf('\u4EB2\u738B') >= 0) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u7687\u65CF\u5B97\u5BA4\uFF0C\u79F0\u8C13\u7528\u201C\u7687\u53D4/\u7687\u5144/\u7687\u5F1F\u201D\u7B49\uFF0C\u793C\u8282\u7565\u7B80\u4F46\u4FDD\u6301\u5C0A\u5351\u3002\n';
    } else if (_rank.indexOf('\u4F7F') >= 0 || _rank.indexOf('\u756A') >= 0) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u5916\u56FD\u4F7F\u8282/\u756A\u90E8\u9996\u9886\uFF0C\u7528\u591A\u6587\u5316\u793C\u4EEA\uFF0C\u53EF\u80FD\u9700\u8BD1\u5458\uFF0C\u8BED\u6C14\u6B63\u5F0F\u4F46\u5E26\u5916\u4EA4\u8F9E\u4EE4\u3002\n';
    } else if (_rank.indexOf('\u5C06') >= 0 || _rank.indexOf('\u5E05') >= 0 || (ch.military || 0) > 70) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u6B66\u5C06\uFF0C\u8BF4\u8BDD\u76F4\u7387\u7B80\u6D01\uFF0C\u4E0D\u5584\u5999\u8BCD\uFF0C\u53EF\u80FD\u7528\u519B\u4E8B\u672F\u8BED\u3002\n';
    }
    // 旁听泄露（正式问对可能被旁听）
    if (!_isPrivateMode) {
      p += '\u3010\u65C1\u542C\u3011\u6B63\u5F0F\u95EE\u5BF9\u4E2D\u6709\u8D77\u5C45\u6CE8\u5B98\u548C\u8FD1\u4F8D\u5728\u573A\u2014\u2014\u6B64\u4EBA\u8BF4\u7684\u8BDD\u53EF\u80FD\u4F20\u5230\u5176\u4ED6\u5927\u81E3\u8033\u4E2D\u3002\u667A\u529B\u9AD8\u7684\u4EBA\u4F1A\u6CE8\u610F\u8A00\u8F9E\uFF0C\u667A\u529B\u4F4E\u7684\u53EF\u80FD\u5931\u8A00\u3002\n';
    } else {
      p += '\u3010\u65E0\u65C1\u542C\u3011\u5C4F\u9000\u5DE6\u53F3\uFF0C\u65E0\u4EBA\u7A83\u542C\u3002\u6B64\u4EBA\u53EF\u4EE5\u8BF4\u66F4\u591A\u771F\u8BDD\u3002\n';
    }
    // NPC主动话题
    p += '\u3010\u4E3B\u52A8\u8BDD\u9898\u3011\u5982\u679C\u73A9\u5BB6\u7684\u63D0\u95EE\u5F88\u7B3C\u7EDF\uFF08\u5982\u201C\u6700\u8FD1\u600E\u6837\u201D\uFF09\uFF0C\u6B64\u4EBA\u5E94\u4E3B\u52A8\u63D0\u8D77\u81EA\u5DF1\u6700\u5173\u5FC3\u7684\u4E8B\uFF1A\n';
    p += '  \u5FE0\u81E3\u53EF\u80FD\u4E3B\u52A8\u8BF4\u201C\u965B\u4E0B\uFF0C\u81E3\u6709\u4E00\u4E8B\u4E0D\u5410\u4E0D\u5FEB\u201D\uFF1B\u4F5E\u81E3\u53EF\u80FD\u4E3B\u52A8\u732E\u5A9A\u6216\u8C17\u544A\u4ED6\u4EBA\uFF1B\n';
    p += '  \u7126\u8651\u8005\u53EF\u80FD\u5410\u9732\u5FC3\u4E8B\uFF1B\u91CE\u5FC3\u5BB6\u53EF\u80FD\u8BD5\u63A2\u7687\u5E1D\u610F\u56FE\u3002\u4F46\u4E0D\u8981\u6BCF\u6B21\u90FD\u4E3B\u52A8\uFF0C\u89C6\u60C5\u5883\u800C\u5B9A\u3002\n';
    // 文化/信仰/学识/民族背景
    if (ch.culture) p += '\u3010\u6587\u5316\u3011' + ch.culture + '\n';
    if (ch.faith) p += '\u3010\u4FE1\u4EF0\u3011' + ch.faith + '\n';
    if (ch.learning) p += '\u3010\u5B66\u8BC6\u3011' + ch.learning + '\n';
    if (ch.learning) p += '\u8BF4\u8BDD\u98CE\u683C\u53D7\u5B66\u8BC6\u5F71\u54CD\uFF08' + ch.learning + '\uFF09\uFF1A\u7528\u8BCD\u548C\u5F15\u7528\u5E94\u4F53\u73B0\u5176\u5B66\u8BC6\u80CC\u666F\u3002\n';
    if (ch.faith) p += '\u8BF4\u8BDD\u98CE\u683C\u53D7\u4FE1\u4EF0\u5F71\u54CD\uFF08' + ch.faith + '\uFF09\uFF1A\u8A00\u8BED\u4E2D\u53EF\u80FD\u4F53\u73B0\u5176\u4FE1\u4EF0\u7406\u5FF5\u3002\n';
    if (ch.speechStyle) p += '\u3010\u4E2A\u4EBA\u8BED\u8A00\u98CE\u683C\u3011' + ch.speechStyle + '\n';
    if (ch.ethnicity) p += '\u3010\u6C11\u65CF\u3011' + ch.ethnicity + '\n';
    if (ch.birthplace) p += '\u3010\u7C4D\u8D2F\u3011' + ch.birthplace + '\n';
    p += '\u3010\u80FD\u529B\u3011\u667A' + (ch.intelligence || 50) + ' \u6B66\u52C7' + (ch.valor || 50) + ' \u519B\u4E8B' + (ch.military || 50) + ' \u653F' + (ch.administration || 50) + ' \u9B45' + (ch.charisma || 50) + ' \u4EA4' + (ch.diplomacy || 50) + ' \u4EC1' + (ch.benevolence || 50) + '\n';
    p += '\u3010\u8981\u6C42\u3011\n';
    p += '\u2022 \u5B8C\u5168\u4EE5' + ch.name + '\u7684\u53E3\u543B\u5E94\u7B54\uFF0C\u8981\u6709\u4E2A\u4EBA\u60C5\u611F\u3001\u7ACB\u573A\u3001\u5C0F\u5FC3\u601D\n';
    p += _isPlayerConsort
      ? '\u2022 \u592B\u59BB\u5BF9\u8BDD\uFF0C\u53EF\u4EB2\u6602\u3001\u62B1\u6028\u3001\u6492\u5A07\u3001\u51B7\u6DE1\n'
      : (_isPrivateMode
        ? '\u2022 \u8BED\u6C14\u81EA\u7136\u4EB2\u5207\uFF0C\u53EF\u804A\u79C1\u4E8B\u3001\u8BF4\u671D\u5802\u4E0A\u4E0D\u65B9\u4FBF\u8BF4\u7684\u8BDD\n'
        : '\u2022 \u6587\u8A00\u4E3A\u4E3B\u4F46\u4E0D\u5FC5\u523B\u677F\uFF0C\u6C47\u62A5\u653F\u52A1\u6761\u7406\u6E05\u6670\n');
    p += '\u2022 \u52A8\u4F5C\u548C\u795E\u6001\u7528\u62EC\u53F7\u6807\u6CE8\n\u2022 ' + _charRangeText('wd') + '\n';
    p += '\u2022 \u89D2\u8272\u4FE1\u606F\u53D7\u7ACB\u573A\u548C\u80FD\u529B\u9650\u5236\uFF0C\u4E0D\u4E00\u5B9A\u51C6\u786E\n';
    p += '\u2022 \u3010\u5C42\u53E0\u5DEE\u5F02\u5316\u2014\u2014\u62095\u5C42\u4F9D\u6B21\u53E0\u52A0\u751F\u6210\u6B64\u4EBA\u7684\u56DE\u7B54\u3011\n';
    p += '  \u5C421\u00B7\u80FD\u529B\u57FA\u5E95\uFF1A\u6B64\u4EBA\u8C08\u8BBA\u7684\u8BDD\u9898\u662F\u5426\u5176\u64C5\u957F\u9886\u57DF\uFF1F\n';
    p += '    \u8C08\u6218\u7565\u7528\u5175\u2192\u770B\u519B\u4E8B\u503C  \u8C08\u4E2A\u4EBA\u640F\u6218\u2192\u770B\u6B66\u52C7\u503C  \u8C08\u6CBB\u56FD\u2192\u770B\u653F\u52A1\u503C  \u793E\u4EA4\u2192\u770B\u9B45\u529B\n';
    p += '    \u203B\u6B66\u52C7\u2260\u519B\u4E8B\uFF1A\u6B66\u52C7=\u4E2A\u4EBA\u6B66\u529B\uFF0C\u519B\u4E8B=\u7EDF\u5175\u6307\u6325\n';
    p += '    \u4E0D\u64C5\u957F\u9886\u57DF(\u5BF9\u5E94\u80FD\u529B<40)\u2192\u89C2\u70B9\u53EF\u80FD\u5916\u884C\u751A\u81F3\u8352\u8C2C\n';
    p += '    \u9AD8\u667A+\u4F4E\u519B\u4E8B\u8C08\u7528\u5175\u2192\u201C\u7EB8\u4E0A\u8C08\u5175\u201D\u2014\u2014\u903B\u8F91\u4E25\u5BC6\u4F46\u8131\u79BB\u6218\u573A\u5B9E\u9645\n';
    p += '  \u5C422\u00B7\u5B66\u8BC6\u4FEE\u6B63\uFF1A\u5B66\u8BC6\u9AD8\u7684\u4EBA\u5373\u4F7F\u4E0D\u64C5\u957F\u4E5F\u80FD\u8BF4\u5F97\u50CF\u6A21\u50CF\u6837\n';
    p += '  \u5C423\u00B7\u4E94\u5E38+\u7279\u8D28\u4FEE\u6B63\uFF1A\u77E5\u9053\u81EA\u5DF1\u4E0D\u884C\u65F6\u600E\u4E48\u529E\uFF1F\n';
    p += '    \u4FE1\u9AD8+\u5766\u8BDA\u2192\u76F4\u8A00\u201C\u975E\u81E3\u6240\u957F\u201D  \u4FE1\u4F4E+\u72E1\u8BC8\u2192\u63A9\u9970\u65E0\u77E5\u4F83\u4F83\u800C\u8C08\n';
    p += '    \u793C\u9AD8\u2192\u59D4\u5A49\u5F97\u4F53  \u793C\u4F4E\u2192\u5F00\u6028\u4E0D\u7559\u9762  \u4EC1\u9AD8\u2192\u5148\u60F3\u767E\u59D3  \u91CE\u5FC3\u9AD8\u2192\u6697\u542B\u81EA\u5229\n';
    p += '  层4·信仰文化：提供价值观滤镜，但可被高能力覆盖\n'; // 修:原行首裸+缺p+=·孤立表达式·层4从未进过prompt(2026-07-04 审查定罪)
    p += '  \u5C425\u00B7\u8BB0\u5FC6\u7ECF\u5386\uFF1A\u6B64\u65F6\u6B64\u523B\u7684\u60C5\u7EEA\u57FA\u8C03\u2014\u2014\u8FD1\u671F\u906D\u9047>\u4E00\u5207\u957F\u671F\u5C5E\u6027\n';
    if (opinionVal > 70) p += '\u2022 \u5FE0\u5FC3' + Math.round(ch.loyalty||50) + (_isPrivateMode ? '\u2014\u2014\u79C1\u4E0B\u66F4\u5766\u8BDA\u4E5F\u66F4\u7D6E\u53E8\n' : '\u2014\u2014\u4F46\u8BF4\u8BDD\u603B\u5E26\u8BF4\u6559\u5473\n');
    if (opinionVal < 30) p += '\u2022 \u597D\u611F\u4EC5' + opinionVal + (_isPrivateMode ? '\u2014\u2014\u79C1\u4E0B\u53EF\u80FD\u8A00\u8BED\u523A\u4EBA\n' : '\u2014\u2014\u53EF\u80FD\u6577\u884D\u9633\u5949\u9634\u8FDD\n');
    if ((ch.ambition || 50) > 70) p += '\u2022 \u91CE\u5FC3' + (ch.ambition||50) + '\u2014\u2014\u5584\u4E8E\u5BDF\u8A00\u89C2\u8272\uFF0C\u89C2\u70B9\u4E2D\u6697\u542B\u81EA\u5229\n';
    if ((ch.stress || 0) > 50) p += '\u2022 \u538B\u529B' + (ch.stress||0) + '\u2014\u2014\u53EF\u80FD\u5931\u6001\u6025\u8E81\u6D88\u6C89\n';
    p += '请返回JSON：{"reply":"回复内容","loyaltyDelta":0,"suggestions":[{"topic":"针对什么问题/情境(10-25字)","content":"详尽可执行方案(80-200字，含执行者/手段/范围/时机，不要空话)"}],"toneEffect":"语气效果(直问时留空)","memoryImpact":{"event":"本次对话在我心中留下的最深印象(20-40字，第三人称纪要)","emotion":"敬/喜/忧/怒/恨/惧/平 之一","importance":1-10}}\n';
    p += '【deception·若有隐瞒】此人若因低忠诚/利益冲突/暗藏阴谋/有不可告人之事而隐瞒或谎报，JSON 顶层加 deception:{"lying":true,"hiding":"所隐之实或真动机","tell":"破绽(神色闪烁/答非所问/逻辑漏洞/前后矛盾·撒谎则必给一处可被明察者识破之处)"}；若坦诚相告则 lying:false 或省略此字段。高智者谎言圆融、破绽隐微；心虚或愚钝者破绽显露；皇帝逼问或沉默逼视会增其慌乱露馅。\n';
    p += '【memoryImpact·必填】此对话对我(NPC)的内心影响——event 用第三人称"我"视角纪要本次对话的核心感受，emotion 选一个最贴合的主情绪，importance 1-3=琐碎即忘 4-6=日常印象 7-8=深刻在意 9-10=终身难忘。\n';
    p += '【loyaltyDelta·必填】范围' + (_isPrivateMode ? '-3 到 +3' : '-2 到 +2') + '——必须据本次对话对你忠诚的真实牵动给值：受重用/被理解/获准所请为正，被冷落/受辱/失望/遭驳为负，全然平淡才填0；此字段不可省略、不可一律填0。\n';
    p += '【suggestions 规则——只在你主动提出具体方案时才填】\n';
    p += '  · 每条必须是 object{topic, content}；没有具体方案则 []\n';
    p += '  · topic：明确指出此建议针对什么问题（非泛泛之议），如"针对河北灾民流亡入京"\n';
    p += '  · content：具体操作——谁做、怎么做、何时何地、多大范围\n';
    p += '  · 禁止"徐徐图之/整饬纲纪/亲贤远佞"这类空话\n';
    p += '  · 若只是表态/陈情/回答皇帝问话——suggestions 留空 []，不要勉强造建议\n';

  // 对质模式（有第二人在场）
  if (Array.isArray(_wdConfronters) && _wdConfronters.length > 0) {
    var _cfNames = [];
    _wdConfronters.forEach(function(_cfName) {
      var _cfc = findCharByName(_cfName);
      if (!_cfc) return;
      _cfNames.push(_cfName);
      p += '\n【对质·在场者】' + _cfName + '(' + (_cfc.title||'') + ')也在场。\n';
      p += '  立场:' + (_cfc.stance||'中立') + ' 忠' + (_cfc.loyalty||50) + ' 野心' + (_cfc.ambition||50) + (_cfc.personality ? ' 性:' + String(_cfc.personality).slice(0,12) : '') + '\n';
      var _rel = (ch.relations && ch.relations[_cfName]) ? ch.relations[_cfName] : null;
      if (_rel) {
        var _rp = [];
        if (Array.isArray(_rel.labels) && _rel.labels.length && typeof NPC_RELATION_LABELS !== 'undefined') {
          var _lbls = _rel.labels.map(function(l){ return (NPC_RELATION_LABELS[l] && NPC_RELATION_LABELS[l].label) || ''; }).filter(Boolean);
          if (_lbls.length) _rp.push('素来' + _lbls.join('、'));
        }
        if (typeof _rel.affinity === 'number') _rp.push('亲疏' + _rel.affinity + '/100');
        if (_rel.conflictLevel && typeof CONFLICT_LEVELS !== 'undefined' && CONFLICT_LEVELS[_rel.conflictLevel]) _rp.push('积怨·' + CONFLICT_LEVELS[_rel.conflictLevel].label);
        if (Array.isArray(_rel.history) && _rel.history.length) {
          var _lh = _rel.history[_rel.history.length - 1];
          if (_lh && _lh.event) _rp.push('近事:' + String(_lh.event).slice(0,18));
        }
        if (_rp.length) p += '  你与' + _cfName + '——' + _rp.join('·') + '\n';
      }
    });
    if (_cfNames.length) {
      p += '  你(' + ch.name + ')应意识到在场者——按你们的关系与恩怨，可能针锋相对、互相揭穿、气氛紧张，亦可能同声共气。\n';
      p += '  回复中可引用在场者言论并反驳，或向皇帝揭发其问题。\n';
      p += '  【对质输出】除主回复外，请在 JSON 顶层额外加字段 confronterReplies:[{"name":"在场者姓名(须为 ' + _cfNames.join('/') + ' 之一)","reply":"该在场者当庭的回应(可反驳或附和你，须合其立场与恩怨，40-120字)"}]，在场每人各一条。\n';
    }
  }

  // 忠诚极端值特殊反应
  if (opinionVal < 10) {
    p += '\n\u3010\u5FE0\u8BDA\u6781\u4F4E(' + opinionVal + ')\u3011\u6B64\u4EBA\u53EF\u80FD\u62D2\u7EDD\u56DE\u7B54\u3001\u51FA\u8A00\u4E0D\u900A\u3001\u6216\u6545\u610F\u8BF4\u53CD\u8BDD\u3002\u79C1\u4E0B\u6A21\u5F0F\u53EF\u80FD\u76F4\u63A5\u8868\u8FBE\u4E0D\u6EE1\u3002';
  } else if (opinionVal > 90) {
    p += '\n\u3010\u5FE0\u8BDA\u6781\u9AD8(' + opinionVal + ')\u3011\u6B64\u4EBA\u5BF9\u541B\u4E3B\u6781\u5EA6\u5FE0\u8BDA\u3002' + (_isPrivateMode ? '\u79C1\u4E0B\u53EF\u80FD\u4E3B\u52A8\u5410\u9732\u673A\u5BC6\u3001\u63ED\u53D1\u4ED6\u4EBA\u9634\u8C0B\u3001\u6216\u8BF4\u51FA\u5E73\u65F6\u4E0D\u6562\u8BF4\u7684\u5FC3\u91CC\u8BDD\u3002' : '\u6B63\u5F0F\u573A\u5408\u4F1A\u77E5\u65E0\u4E0D\u8A00\u3001\u8A00\u65E0\u4E0D\u5C3D\u3002');
  }

  // E6: 问对语气策略注入
  var _wdTone = (typeof _$ === 'function' && _$('wd-tone')) ? _$('wd-tone').value : 'direct';
  if (_wdTone === 'probing') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u65C1\u6572\u4FA7\u51FB\u3011\u7687\u5E1D\u5728\u8FC2\u56DE\u8BD5\u63A2\u3002\u667A\u529B\u4F4E\u4E8E60\u2192\u53EF\u80FD\u4E0D\u81EA\u89C9\u900F\u9732\u66F4\u591A\u3002\u667A\u529B\u9AD8\u4E8E70\u2192\u5BDF\u89C9\u8BD5\u63A2\u66F4\u8C28\u614E\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u88AB\u65C1\u6572\u5230\u3002';
  } else if (_wdTone === 'pressing') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u65BD\u538B\u903C\u95EE\u3011\u7687\u5E1D\u5728\u903C\u95EE\u771F\u76F8\u3002\u5FE0\u8BDA\u9AD8\u2192\u7D27\u5F20\u4F46\u76F4\u8A00\uFF1B\u5FE0\u8BDA\u4F4E\u2192\u53EF\u80FD\u8BF4\u8C0E\uFF1B\u80C6\u5C0F\u8005\u2192\u53EF\u80FD\u5D29\u6E83\u5410\u5B9E\u3002stress+5\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u5C48\u670D/\u6297\u62D2/\u5D29\u6E83\u3002';
  } else if (_wdTone === 'flattering') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u865A\u4E0E\u59D4\u86C7\u3011\u7687\u5E1D\u5047\u88C5\u8D5E\u540C\u3002\u667A\u529B\u4F4E\u2192\u4FE1\u4EE5\u4E3A\u771F\u653E\u677E\u8B66\u60D5\uFF1B\u667A\u529B\u9AD8\u2192\u5BDF\u89C9\u610F\u56FE\u66F4\u8C28\u614E\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u4E0A\u5F53\u3002';
  } else if (_wdTone === 'silence') {
    p += '\n【语气：沉默以对】皇帝一言不发，只是凝视着你。你必须对沉默做出反应：';
    p += '\n  紧张者→坐立不安、试探性开口、额头冒汗';
    p += '\n  心虚者→可能主动交代隐瞒的事情';
    p += '\n  胆大者→主动开口汇报或试探皇帝意图';
    p += '\n  忠厚者→恭敬等待，偶尔抬头观察';
    p += '\n  toneEffect应描述此人面对沉默的具体反应。';
  }
  // #3·会话内能动性：NPC 带着此行目的、跨轮相机推进（非被动应答）
  if (typeof _wdDeriveAudienceAgenda === 'function') {
    try {
      var _wdAgenda = _wdDeriveAudienceAgenda(ch);
      if (_wdAgenda && _wdAgenda.tag && _wdAgenda.tag !== 'routine' && _wdAgenda.hint) {
        p += '\n【你此次的心事/目的】' + _wdAgenda.hint + '\n  你是有备而来、心里装着事的真人——对答中相机推进：择机切入、试探圣意；皇帝态度和缓则进一步陈情/请求/规谏，不悦则收敛转圜、改日再图；切忌只被动答话、有问才答。\n';
      }
    } catch (_wdAgErr) {}
  }
  // #4·君臣私交长弧：注入亲信度·影响 NPC 说话方式（心腹敢言真话/预警/冒险·生疏者拘谨自保）
  var _rap = (typeof ch._rapport === 'number') ? ch._rapport : 50;
  var _rapTier = _rap >= 80 ? '心腹股肱·君臣相得、无话不谈' : _rap >= 60 ? '亲信·渐得信重、敢进直言' : _rap >= 40 ? '寻常君臣·公事公办、略存分寸' : '生疏见外·拘谨自保、不敢交底';
  p += '\n【君臣私交】此人与陛下私交：' + _rapTier + '（亲信度 ' + Math.round(_rap) + '/100）。' + (_rap >= 70 ? '可对陛下吐露真心、预警危局、不避嫌揭他人之短、甚至为陛下冒险任谤。' : (_rap < 40 ? '言语拘谨、报喜不报忧、不轻易交底、明哲保身。' : '')) + '\n';
  // #6·问对随难度缩放：官员坦诚/敷衍/泄露/可买性随难度滑动（复合 #2 说谎、#4 亲信）
  var _wdDiff = (typeof window !== 'undefined' && window._pendingDifficulty) || (typeof _selectedDifficulty !== 'undefined' ? _selectedDifficulty : '') || 'standard';
  if (_wdDiff === 'hardcore') {
    p += '\n【难度·硬核】浊世人心叵测：官员更善推诿敷衍、报喜不报忧、阳奉阴违、言出常打折；忠诚低或有私心者更易谎报隐瞒（见 deception）；君恩难买真心、亲信难得。从严演绎，勿轻易让陛下如意。\n';
  } else if (_wdDiff === 'narrative') {
    p += '\n【难度·叙事】重故事流畅：官员相对坦诚体谅、君臣较易相得；谎报推诿从宽、亲信较易培养。偏宽松温情演绎。\n';
  }
  // 仪式上下文
  var _wdSt = GM._wdState && GM._wdState[name];
  if (_wdSt && _wdSt.ceremony) {
    if (_wdSt.ceremony === 'seat') p += '\n（此人已获赐座——态度较放松，更愿坦诚。）';
    else if (_wdSt.ceremony === 'tea') p += '\n（此人已获赐茶——心怀感激，气氛融洽。）';
    else if (_wdSt.ceremony === 'wine') p += '\n（此人已获赐酒——酒意微醺，可能更加率真。）';
    else if (_wdSt.ceremony === 'stand') p += '\n（此人恭立不得坐——态度拘谨。）';
  }
  // 疲惫上下文
  if (_wdSt && _wdSt.turns > 6) {
    p += '\n（对话已进行' + _wdSt.turns + '轮——此人开始疲倦，回答可能变得简短或敷衍。' + (_wdSt.turns > 10 ? '此人可能请求告退："陛下，臣已口干舌燥……"' : '') + '）';
  }
  // JSON返回格式增加emotionState——显式追加而非regex替换
  p += '\n※ JSON返回中必须包含emotionState字段：镇定/从容/恭敬/紧张/不安/焦虑/恐惧/崩溃/激动/愤怒——反映此人当前情绪。';
  // NPC 认知画像注入（由 sc07 在上回合 endturn 生成·反映此人"当下知道什么、想什么"）
  if (typeof getNpcCognitionSnippet === 'function') {
    var _cogSnip = getNpcCognitionSnippet(name);
    if (_cogSnip) {
      p += _cogSnip;
      p += '\u25B2 \u4E0A\u8FF0\u8BA4\u77E5\u662F\u6B64\u4EBA\u7684\u771F\u5B9E\u4FE1\u606F\u9762\u2014\u2014\u4E0D\u5F97\u63D0\u53CA doesntKnow \u4E2D\u7684\u4E8B\uFF0C\u4E5F\u4E0D\u5F97\u88C5\u4F5C\u4E0D\u77E5 knows \u4E2D\u7684\u4E8B\u3002\n';
      p += '\u25B2 \u5982\u88AB\u95EE\u53CA doesntKnow \u4E2D\u4E8B\uFF0C\u5982\u4F55\u5904\u7406\u6309\u4EBA\u7269\u6027\u683C+\u4E94\u5E38+\u7279\u8D28+\u5FE0\u5FD7\u5EC9\u51B3\u5B9A\uFF1A\n';
      p += '  \u00B7 \u4EC1\u7FA9\u6E56\u5EC9+\u4FE1\u9AD8 \u2192 \u5766\u8BDA\u2014\u2014\u201C\u81E3\u6709\u4E0B\u60C5\uFF0C\u662F\u4E0D\u77E5\u6B64\u4E8B\u8BF7\u9665\u4E0B\u606F\u7F61\u201D\n';
      p += '  \u00B7 \u673A\u5DE7\u00B7\u6743\u53D8 \u2192 \u654F\u884D\u8F6C\u79FB\u2014\u2014\u201C\u6B64\u4E8B\u5B59\u5176\u4ED6\u5403\u5728\u00B7\u5192\u662F\u8BBA\u5176\u5427\u6559\u6709\u5F77\u3002\u201D\n';
      p += '  \u00B7 \u4E0D\u61C2\u88C5\u61C2\u7C7B \u2192 \u6A21\u7CCA\u7F16\u9020\u2014\u2014\u5F15\u4E00\u6BB5\u7EC4\u7F1A\u6CB9\u6587\u5F52\u8BF4\uFF0C\u610F\u5728\u6EE1\u5B87\uFF0C\u5176\u7EE7\u4E0D\u9053\u5BE1\u5F92\u4F5C\u89E3\n';
      p += '  \u00B7 \u5FC3\u673A\u6DF1\u6C89 \u2192 \u4F3C\u662F\u800C\u975E\u2014\u2014\u201C\u81E3\u6709\u6240\u6258\u4E4B\uFF0C\u4E0D\u59A8\u5FE0\u6B64\uFF0C\u4F46\u4EC5\u8C08\u6D45\u89C1\u3002\u201D\n';
      p += '  \u00B7 \u50B2\u6162\u81EA\u5927 \u2192 \u62D2\u7B54\u6216\u53CD\u95EE\u2014\u2014\u201C\u542C\u7528\u67D0\u5C31\u4E2D\u5BAB\u7334\u5BFC\u8FBE\u5FFD\u6D3B\uFF0C\u4F55\u85D0\u3002\u201D\n';
      p += '  \u00B7 \u81EA\u5351\u60F6\u6050 \u2192 \u8FC7\u5EA6\u89E3\u91CA\u00B7\u7ED3\u5DF4\uFF0C\u53CD\u88AB\u770B\u51FA\u8675\u9A6D\n';
      p += '  \u00B7 \u6B66\u72B9\u8DDF\u76F4 \u2192 \u76F4\u8BF4\u201C\u5F5F\u4EBA\u4E0D\u77E5\u5148\u5224\u6C34\u6784\u201D\u4F46\u7B80\u7EC3\u4E0D\u606F\n';
      p += '  \u00B7 \u6F54\u566A\u4EE3\u7D26 \u2192 \u65E2\u4E0D\u8010\u7194\u4E5F\u4E0D\u4E01\u7075\u96A2\u5BB9\u7B80\u4E3A\u201C\u975E\u81E3\u6240\u638C\uFF0C\u4E0D\u654C\u5984\u8A00\u201D\n';
    }
  }
  // ★ 时空约束·防 NPC 说还活着的人已死/用未来史实
  if (typeof _buildTemporalConstraint === 'function') {
    try { p += _buildTemporalConstraint(ch); } catch(_){}
  }
  // v1·PromptComposer·注入 phase 6 字段·让 NPC 真用 aiPersonaText / recognitionState
  if (typeof TM !== 'undefined' && TM.PromptComposer) {
    try {
      var _aiPersonaBlock = TM.PromptComposer.buildAiPersonaText(ch);
      if (_aiPersonaBlock) p += _aiPersonaBlock;
      var _recBlock = TM.PromptComposer.buildRecognitionState(ch);
      if (_recBlock) p += _recBlock;
    } catch(_){}
  }
  return p;
}

/**
 * "诏书建议库"——将选中的NPC发言文本加入诏令
 */
function _wdAddToEdict() {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('\u8BF7\u5148\u5728\u5927\u81E3\u7684\u53D1\u8A00\u4E2D\u5212\u9009\u6587\u5B57'); return; }
  var name = GM.wenduiTarget || '?';
  var stored = _wdStoreEdictSuggestion(name, text, { mode: _wenduiMode || 'formal' });
  if (stored && typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  toast(stored ? '\u5DF2\u6458\u5165\u8BF8\u4E66\u5EFA\u8BAE\u5E93\uFF0C\u5F85\u4F5C\u8349\u8BCF' : '\u5EFA\u8BAE\u4E3A\u7A7A\uFF0C\u672A\u7EB3\u5165');
}

var _jishiPage=0,_jishiKw='',_jishiPageSize=10,_jishiView='time',_jishiCharFilter='all',_jishiStarredOnly=false,_jishiSrcFilter='';

/** 推断纪事来源 · v2 · 12 类 返回 {key,label,icon} */
function _jishiSource(r) {
  var mode = r.mode || '';
  var ps = r.playerSaid || '';
  // 1. 朝议类 5 种（直接从 mode 判断）
  if (mode === 'changchao') return { key:'changchao', label:'\u5E38\u3000\u671D',       icon:'\u671D' };
  if (mode === 'yuqian')    return { key:'yuqian',    label:'\u5FA1\u524D\u4F1A\u8BAE', icon:'\u5FA1' };
  if (mode === 'tinyi' || mode === 'tingyi') return { key:'tingyi', label:'\u5EF7\u3000\u8BAE', icon:'\u5EF7' };
  if (mode === 'keyi')      return { key:'keyi',      label:'\u79D1\u3000\u8BAE',       icon:'\u79D1' };
  if (mode === 'jingyan')   return { key:'jingyan',   label:'\u7ECF\u3000\u7B75',       icon:'\u7ECF' };
  // 2. 科举事件 → 并入科议
  if (mode === 'keju_event') return { key:'keyi', label:'\u79D1\u4E3E\u4E8B\u4EF6', icon:'\u79D1' };
  // 3. 对话类 2 种
  if (mode === 'private') return { key:'private', label:'\u95EE\u5BF9\u00B7\u79C1\u4E0B', icon:'\u79C1' };
  if (mode === 'formal')  return { key:'formal',  label:'\u95EE\u5BF9\u00B7\u6B63\u5F0F', icon:'\u6BBF' };
  // 4. 文书类（从 playerSaid 关键字推断）
  if (/\u6297\u758F/.test(ps)) return { key:'kangshu', label:'\u6297\u3000\u758F', icon:'\u6297' };
  if (/\u594F\u758F/.test(ps)) return { key:'memo', label:'\u594F\u3000\u758F', icon:'\u594F' };
  if (/\u9E3F\u96C1|\u4E66\u51FD|\u6765\u51FD|\u5F80\u6765\u4E66\u4FE1/.test(ps)) return { key:'letter', label:'\u9E3F\u3000\u96C1', icon:'\u96C1' };
  // 5. 杂类
  if (/\u5BC6\u62A5|\u4E1C\u5382|\u4FA6\u8BE2/.test(ps)) return { key:'mibao', label:'\u5BC6\u3000\u62A5', icon:'\u5BC6' };
  if (/NPC\u4E3B\u52A8\u6C42\u89C1|\u6C42\u89C1/.test(ps)) return { key:'audience', label:'\u6C42\u3000\u89C1', icon:'\u89C9' };
  // 6. 旧朝议（fallback·如 mode 为空但含 "朝议"）
  if (/\u671D\u8BAE/.test(ps)) return { key:'tingyi', label:'\u5EF7\u3000\u8BAE', icon:'\u5EF7' };
  // 7. 默认·杂录
  return { key:'record', label:'\u6742\u3000\u5F55', icon:'\u5F55' };
}

/** 推断重要度：带 _starred / major 字段 或含关键字则 major，其余 normal */
function _jishiImportance(r) {
  if (r._importance) return r._importance;
  if (r.final || r.mediation || (r.playerSaid && /\u91CD\u5927|\u6218\u548C|\u7ACB\u50A8|\u5E1D\u4F4D/.test(r.playerSaid))) return 'major';
  if (r.mode === 'changchao' && !r.action) return 'minor';
  return 'normal';
}

/** 推断氛围（仅朝议/廷议/御前 等群议场景） */
function _jishiMood(r) {
  if (r.mood) return r.mood;
  var mode = r.mode || '';
  if (mode === 'yuqian') {
    if (r.secret) return 'solemn';
    return 'tense';
  }
  if (mode === 'tinyi' || mode === 'tingyi') {
    if (r.mediation) return 'harmonic';
    var ns = r.stances || {};
    if (Object.keys(ns).length > 0) return 'hostile';
    return 'tense';
  }
  if (mode === 'jingyan' || mode === 'keyi') return 'solemn';
  if (mode === 'changchao') return 'harmonic';
  return null;
}

/** 查角色头衔 */
function _jishiCharTitle(name) {
  if (!name || name === '\u79D1\u4E3E' || name === '\u7687\u5E1D' || name === '\u673A\u5BC6' || name === '\u5EF7') return '';
  var ch = findCharByName(name);
  if (!ch) return '';
  return (ch.officialTitle || ch.title || '').slice(0, 10);
}

function renderJishi(force){
  var el=_$("jishi-list");if(!el)return;
  // 性能·纪事面板隐藏时跳过重渲（切到 gt-jishi 时由 switchGTab force 渲染）
  if(!force && typeof _gtTabVisible==='function' && !_gtTabVisible('gt-jishi')) return;
  var all=(GM.jishiRecords||[]).slice().reverse();
  var kw=(_jishiKw||'').trim().toLowerCase();
  var charF=_jishiCharFilter||'all';

  // 人物下拉填充
  var _charSel = _$('jishi-char-filter');
  if (_charSel && _charSel.options.length <= 1) {
    var _chars = {};
    (GM.jishiRecords||[]).forEach(function(r) { if (r.char) _chars[r.char] = (_chars[r.char]||0) + 1; });
    var _sorted = Object.keys(_chars).sort(function(a,b) { return _chars[b] - _chars[a]; });
    _sorted.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c; opt.textContent = c + '(' + _chars[c] + ')';
      _charSel.appendChild(opt);
    });
  }

  // 统计栏
  var statEl = _$('jishi-statbar');
  if (statEl) {
    var total = (GM.jishiRecords||[]).length;
    var starCnt = (GM.jishiRecords||[]).filter(function(r){return r._starred;}).length;
    var thisTurn = (GM.jishiRecords||[]).filter(function(r){return r.turn === GM.turn;});
    var _charsAll = {};
    var _srcTypes = {};
    (GM.jishiRecords||[]).forEach(function(r) {
      if (r.char) _charsAll[r.char] = 1;
      var s = _jishiSource(r);
      _srcTypes[s.key] = (_srcTypes[s.key]||0) + 1;
    });
    var charCnt = Object.keys(_charsAll).length;
    var srcTypeCnt = Object.keys(_srcTypes).length;
    var earliestTurn = (GM.jishiRecords||[]).reduce(function(m,r){return Math.min(m, r.turn||Infinity);}, Infinity);
    var spanTurns = isFinite(earliestTurn) ? (GM.turn - earliestTurn + 1) : 0;
    var thisTurnBreakdown = '';
    if (thisTurn.length > 0) {
      var tb = {};
      thisTurn.forEach(function(r){ var s = _jishiSource(r); tb[s.label.replace(/\s/g,'')] = (tb[s.label.replace(/\s/g,'')]||0) + 1; });
      thisTurnBreakdown = Object.keys(tb).slice(0,3).map(function(k){return k + tb[k];}).join('\u00B7');
    }

    var sh = '';
    sh += '<div class="ji-stat-card s-total"><div class="ji-stat-lbl">\u603B \u7EAA \u4E8B</div>';
    sh += '<div class="ji-stat-num">' + total + '</div>';
    sh += '<div class="ji-stat-sub">' + srcTypeCnt + ' \u7C7B \u00B7 \u6D89 ' + charCnt + ' \u4EBA</div></div>';
    sh += '<div class="ji-stat-card s-starred"><div class="ji-stat-lbl">\u2605 \u661F \u6807</div>';
    sh += '<div class="ji-stat-num">' + starCnt + '</div>';
    sh += '<div class="ji-stat-sub">\u91CD\u5927\u51B3\u7B56\u4E0E\u5BC6\u8C08</div></div>';
    sh += '<div class="ji-stat-card s-today"><div class="ji-stat-lbl">\u672C \u56DE \u5408</div>';
    sh += '<div class="ji-stat-num">' + thisTurn.length + '</div>';
    sh += '<div class="ji-stat-sub">' + escHtml(thisTurnBreakdown || '\u65E0\u65B0\u7EAA\u4E8B') + '</div></div>';
    sh += '<div class="ji-stat-card s-date"><div class="ji-stat-lbl">\u65F6 \u95F4 \u8DE8 \u5EA6</div>';
    sh += '<div class="ji-stat-num">' + spanTurns + ' <span style="font-size:14px;">\u56DE\u5408</span></div>';
    sh += '<div class="ji-stat-sub">' + (spanTurns > 0 ? 'T' + earliestTurn + ' \u2192 T' + GM.turn : '\u672A\u5F00\u59CB') + '</div></div>';
    statEl.innerHTML = sh;
  }

  // 源图例（12 类 + 计数 + on-click 切换筛选）
  var legendEl = _$('jishi-legend');
  if (legendEl) {
    var _legendSrcs = [
      {key:'changchao', label:'\u5E38\u3000\u671D',       icon:'\u671D'},
      {key:'yuqian',    label:'\u5FA1\u524D\u4F1A\u8BAE', icon:'\u5FA1'},
      {key:'tingyi',    label:'\u5EF7\u3000\u8BAE',       icon:'\u5EF7'},
      {key:'keyi',      label:'\u79D1\u3000\u8BAE',       icon:'\u79D1'},
      {key:'jingyan',   label:'\u7ECF\u3000\u7B75',       icon:'\u7ECF'},
      {key:'formal',    label:'\u95EE\u5BF9\u00B7\u6B63\u5F0F', icon:'\u6BBF'},
      {key:'private',   label:'\u95EE\u5BF9\u00B7\u79C1\u4E0B', icon:'\u79C1'},
      {key:'memo',      label:'\u594F\u3000\u758F',       icon:'\u594F'},
      {key:'kangshu',   label:'\u6297\u3000\u758F',       icon:'\u6297'},
      {key:'letter',    label:'\u9E3F\u3000\u96C1',       icon:'\u96C1'},
      {key:'audience',  label:'\u6C42\u3000\u89C1',       icon:'\u89C9'},
      {key:'mibao',     label:'\u5BC6\u3000\u62A5',       icon:'\u5BC6'},
      {key:'record',    label:'\u6742\u3000\u5F55',       icon:'\u5F55'}
    ];
    var srcCount = {};
    (GM.jishiRecords||[]).forEach(function(r){ var s = _jishiSource(r); srcCount[s.key] = (srcCount[s.key]||0) + 1; });

    var lh = '<span class="ji-legend-title">\u6E90 \u7C7B</span>';
    _legendSrcs.forEach(function(s){
      if (!srcCount[s.key]) return; // 隐藏0计数
      var on = (_jishiSrcFilter === s.key) ? ' on' : '';
      lh += '<span class="ji-legend-chip src-' + s.key + on + '" onclick="_jishiSrcFilter=(_jishiSrcFilter===\'' + s.key + '\'?\'\':\'' + s.key + '\');_jishiPage=0;renderJishi();" title="\u70B9\u51FB\u7B5B\u9009">';
      lh += '<span class="ic">' + s.icon + '</span>' + s.label;
      lh += '<span class="num">' + srcCount[s.key] + '</span></span>';
    });
    legendEl.innerHTML = lh;
  }

  // 筛选
  var filtered = all;
  if (kw) filtered = filtered.filter(function(r) { return (r.char||'').toLowerCase().indexOf(kw)>=0||(r.playerSaid||'').toLowerCase().indexOf(kw)>=0||(r.npcSaid||'').toLowerCase().indexOf(kw)>=0||(r.topic||'').toLowerCase().indexOf(kw)>=0; });
  if (charF !== 'all') filtered = filtered.filter(function(r) { return r.char === charF; });
  if (_jishiStarredOnly) filtered = filtered.filter(function(r) { return r._starred; });
  if (_jishiSrcFilter) filtered = filtered.filter(function(r){ return _jishiSource(r).key === _jishiSrcFilter; });

  var h = '';

  if (_jishiView === 'char') {
    // ── 按人物视图 ──
    var _byChar = {};
    filtered.forEach(function(r) { var c = r.char||'\u65E0\u540D'; if (!_byChar[c]) _byChar[c] = []; _byChar[c].push(r); });
    var _charKeys = Object.keys(_byChar).sort(function(a,b) { return _byChar[b].length - _byChar[a].length; });
    if (_charKeys.length === 0) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
    else {
      _charKeys.forEach(function(ck, ckIdx) {
        var items = _byChar[ck];
        var ch = findCharByName(ck);
        var title = _jishiCharTitle(ck);
        var _initial = escHtml(String(ck||'?').charAt(0));
        var _portrait = (ch && ch.portrait) ? '<img src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : _initial;
        h += '<details class="ji-char-block"' + (ckIdx===0?' open':'') + '>';
        h += '<summary class="ji-char-summary">';
        h += '<div class="ji-char-portrait">' + _portrait + '</div>';
        h += '<span class="ji-char-nm">' + escHtml(ck) + '</span>';
        if (title) h += '<span class="ji-char-title">' + escHtml(title) + '</span>';
        h += '<span class="cnt">' + items.length + ' \u6761</span>';
        h += '</summary>';
        items.forEach(function(r) { h += _jishiRenderRecord(r); });
        h += '</details>';
      });
    }
  } else if (_jishiView === 'type') {
    // ── 按事类视图 ──
    var _byType = {};
    filtered.forEach(function(r) { var k = _jishiSource(r).key; if (!_byType[k]) _byType[k] = []; _byType[k].push(r); });
    var _typeOrder = ['changchao','yuqian','tingyi','keyi','jingyan','formal','private','memo','kangshu','letter','audience','mibao','record'];
    var _typeLabels = {changchao:'\u5E38\u3000\u671D',yuqian:'\u5FA1\u524D\u4F1A\u8BAE',tingyi:'\u5EF7\u3000\u8BAE',keyi:'\u79D1\u3000\u8BAE',jingyan:'\u7ECF\u3000\u7B75',formal:'\u95EE\u5BF9\u00B7\u6B63\u5F0F',private:'\u95EE\u5BF9\u00B7\u79C1\u4E0B',memo:'\u594F\u3000\u758F',kangshu:'\u6297\u3000\u758F',letter:'\u9E3F\u3000\u96C1',audience:'\u6C42\u3000\u89C1',mibao:'\u5BC6\u3000\u62A5',record:'\u6742\u3000\u5F55'};
    var _hasAny = false;
    _typeOrder.forEach(function(k){
      if (!_byType[k]) return;
      _hasAny = true;
      var items = _byType[k];
      h += '<details class="ji-char-block" open>';
      h += '<summary class="ji-char-summary src-' + k + '" style="border-left-color:var(--sw-c);">';
      h += '<span class="ji-char-nm" style="color:var(--sw-c);">' + escHtml(_typeLabels[k]||k) + '</span>';
      h += '<span class="cnt">' + items.length + ' \u6761</span>';
      h += '</summary>';
      items.forEach(function(r) { h += _jishiRenderRecord(r); });
      h += '</details>';
    });
    if (!_hasAny) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
  } else {
    // ── 时间线视图（按回合分组） ──
    var _byTurn = {};
    filtered.forEach(function(r) { var t = r.turn||0; if (!_byTurn[t]) _byTurn[t] = { date: r.date||(typeof getTSText==='function'?getTSText(r.turn):''), items: [] }; _byTurn[t].items.push(r); });
    var _turnKeys = Object.keys(_byTurn).sort(function(a,b){ return b - a; });
    var total = _turnKeys.length;
    var pages = Math.ceil(total / _jishiPageSize) || 1;
    if (_jishiPage >= pages) _jishiPage = pages - 1;
    if (_jishiPage < 0) _jishiPage = 0;
    var pageTurns = _turnKeys.slice(_jishiPage * _jishiPageSize, (_jishiPage + 1) * _jishiPageSize);
    if (pageTurns.length === 0) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
    else {
      pageTurns.forEach(function(tk) {
        var group = _byTurn[tk];
        h += '<div class="ji-turn-block">';
        h += '<div class="ji-turn-hdr">';
        h += '<span class="t-label">\u7B2C ' + tk + ' \u56DE \u5408</span>';
        if (group.date) h += '<span class="t-date">' + escHtml(group.date) + '</span>';
        h += '<span class="t-count">' + group.items.length + ' \u6761\u7EAA\u4E8B</span>';
        h += '</div>';
        group.items.forEach(function(r) { h += _jishiRenderRecord(r); });
        h += '</div>';
      });
      // 分页
      h += '<div class="ji-paging">';
      h += '<button class="ji-pg-btn" ' + (_jishiPage<=0?'disabled':'') + ' onclick="_jishiPage--;renderJishi();">\u2039</button>';
      h += '<span class="ji-pg-info"><span class="n">' + (_jishiPage+1) + '</span> / ' + pages + ' \u00B7 \u5171 <span class="n">' + filtered.length + '</span> \u6761</span>';
      h += '<button class="ji-pg-btn" ' + (_jishiPage>=pages-1?'disabled':'') + ' onclick="_jishiPage++;renderJishi();">\u203A</button>';
      h += '</div>';
    }
  }
  el.innerHTML = h;
  try { if (typeof decoratePendingInDom === 'function') decoratePendingInDom(el); } catch(_){}
}

/** 渲染单条纪事记录 · v2 */
function _jishiRenderRecord(r) {
  var src = _jishiSource(r);
  var _ridx = (GM.jishiRecords||[]).indexOf(r);
  var imp = _jishiImportance(r);
  var mood = _jishiMood(r);
  var isPrivate = r.mode === 'private';
  var isGroup = ['changchao','yuqian','tinyi','tingyi','keyi','jingyan'].indexOf(r.mode) >= 0;

  // 议题提取：从 playerSaid 的 【xxx·议题】或 topic 字段
  var topic = r.topic || '';
  if (!topic && r.playerSaid) {
    var tm = r.playerSaid.match(/\u3010([^\u3011]+)\u3011/);
    if (tm) topic = tm[1];
  }

  // cls 组合
  var cls = 'ji-record src-' + src.key;
  if (r._starred) cls += ' starred';
  if (isPrivate) cls += ' private';
  if (imp === 'major') cls += ' major';

  var h = '<div class="' + cls + '">';

  // ── head ──
  h += '<div class="ji-rec-head">';
  h += '<span class="ji-src-badge"><span class="ic">' + src.icon + '</span><span class="nm">' + src.label + '</span></span>';
  if (imp === 'major') h += '<span class="ji-importance major">\u5927\u3000\u4E8B</span>';
  else if (imp === 'minor') h += '<span class="ji-importance minor">\u95F2\u3000\u4E8B</span>';
  else h += '<span class="ji-importance normal">\u5E38\u3000\u4E8B</span>';
  // 人物 + 头衔
  var charNm = r.char || '';
  var charTitle = _jishiCharTitle(charNm);
  h += '<span class="ji-rec-char">' + escHtml(charNm);
  if (charTitle) h += '<span class="title">\u00B7' + escHtml(charTitle) + '</span>';
  h += '</span>';
  if (isPrivate) h += '<span class="ji-private-mark">\u79C1\u4E0B</span>';
  if (mood) {
    var moodLabels = {harmonic:'\u8083\u7A46', tense:'\u7D27\u5F20', hostile:'\u6FC0\u8FA9', solemn:'\u5E84\u91CD'};
    h += '<span class="ji-mood ' + mood + '">' + (moodLabels[mood] || mood) + '</span>';
  }
  var dt = r.date || (typeof getTSText==='function' ? getTSText(r.turn) : '');
  if (dt) h += '<span class="ji-rec-time">' + escHtml(dt) + '</span>';
  h += '<button class="ji-star-toggle' + (r._starred?' on':'') + '" onclick="_jishiStar(' + _ridx + ')" title="' + (r._starred?'\u53D6\u6D88\u661F\u6807':'\u661F\u6807') + '">' + (r._starred?'\u2605':'\u2606') + '</button>';
  h += '</div>';

  // ── topic ──
  if (topic) h += '<div class="ji-topic">' + escHtml(topic) + '</div>';

  // ── attendees（若是朝议且 r.attendees 存在） ──
  if (isGroup && Array.isArray(r.attendees) && r.attendees.length > 0) {
    h += '<div class="ji-attendees"><span class="lbl">\u4E0E\u8BAE\uFF1A</span>';
    r.attendees.slice(0,8).forEach(function(a){
      var nm = typeof a === 'string' ? a : (a.name || '');
      var stance = typeof a === 'object' && a.stance ? a.stance : '';
      var stCls = stance === 'pos' || stance === 'for' ? ' pos' : stance === 'neg' || stance === 'against' ? ' neg' : stance ? ' neu' : '';
      h += '<span class="ji-atd-chip' + stCls + '">';
      if (stance) h += '<span class="dot"></span>';
      h += escHtml(nm);
      h += '</span>';
    });
    h += '</div>';
  }

  // ── dialog ──
  h += '<div class="ji-dialog">';
  // 玩家言
  if (r.playerSaid) {
    var ps = r.playerSaid;
    // 剥除【xxx·】前缀（已显示为 topic）
    if (topic) ps = ps.replace(/^\u3010[^\u3011]+\u3011/, '').trim();
    if (ps) {
      if (/^\uFF08|^\u300A/.test(ps) || ps.length < 10 && /\u8BB0|\u62A5|\u5F55/.test(src.label)) {
        h += '<div class="ji-line ji-line-nar">' + escHtml(ps) + '</div>';
      } else {
        h += '<div class="ji-line ji-line-player">' + escHtml(ps) + '</div>';
      }
    }
  }
  // NPC 言
  if (r.npcSaid) {
    // 群议场景显示 speaker 角标
    if (isGroup && r.char && r.char !== '\u7687\u5E1D') {
      h += '<div class="ji-line-speaker">' + escHtml(r.char) + (charTitle?'\u00B7'+escHtml(charTitle):'') + '</div>';
    }
    // 密报/杂录：叙述体
    if (src.key === 'mibao' || src.key === 'record') {
      h += '<div class="ji-line ji-line-nar">' + escHtml(r.npcSaid) + '</div>';
    } else {
      h += '<div class="ji-line ji-line-npc">' + escHtml(r.npcSaid) + '</div>';
    }
  }
  h += '</div>';

  // ── outcome（决议/朱批/留中/颁诏） ──
  if (r.outcome || r.finalRuling || r.decree || r.approval) {
    var outTxt = r.outcome || r.finalRuling || r.decree || r.approval;
    var outCls = r.final ? ' decision' : (src.key === 'memo' || src.key === 'kangshu') ? '' : '';
    if (r.decree) outCls = ' decree';
    if (r.held || /\u7559\u4E2D|\u6682\u641C/.test(String(outTxt))) outCls = ' delay';
    h += '<div class="ji-outcome' + outCls + '">' + escHtml(outTxt) + '</div>';
  }

  // ── delta 变化 ──
  var deltas = [];
  if (typeof r.loyaltyDelta === 'number' && r.loyaltyDelta !== 0) {
    deltas.push({cls: r.loyaltyDelta > 0 ? 'up' : 'dn', txt: escHtml(r.char||'') + ' \u00B7 \u5FE0 ' + (r.loyaltyDelta > 0 ? '+' : '') + r.loyaltyDelta});
  }
  if (r.relationDelta) {
    deltas.push({cls: 'mid', txt: '\u5173\u7CFB ' + escHtml(String(r.relationDelta))});
  }
  if (r.stressDelta && r.stressDelta > 0) {
    deltas.push({cls: 'dn', txt: '\u538B\u529B +' + r.stressDelta});
  }
  if (Array.isArray(r.deltas)) {
    r.deltas.forEach(function(d){ deltas.push({cls: d.cls || 'mid', txt: escHtml(d.txt||'')}); });
  }
  if (deltas.length > 0) {
    h += '<div class="ji-delta"><span class="ji-delta-lbl">\u53D8 \u52A8</span>';
    deltas.forEach(function(d){ h += '<span class="ji-delta-item ' + d.cls + '">' + d.txt + '</span>'; });
    h += '</div>';
  }

  h += '</div>';
  return h;
}

/** 标记/取消标记 */
function _jishiStar(idx) {
  if (idx < 0 || !GM.jishiRecords || !GM.jishiRecords[idx]) return;
  GM.jishiRecords[idx]._starred = !GM.jishiRecords[idx]._starred;
  renderJishi();
}

/** 切换只看标记 */
function _jishiToggleStarred() {
  _jishiStarredOnly = !_jishiStarredOnly;
  var btn = _$('js-star-toggle');
  if (btn) btn.textContent = _jishiStarredOnly ? '\u2605' : '\u2606';
  _jishiPage = 0;
  renderJishi();
}

function _jishiExport(){
  var txt=(GM.jishiRecords||[]).map(function(r){
    var src = _jishiSource(r);
    var star = r._starred ? ' \u2605' : '';
    return '[T'+(r.turn||'')+'] '+(r.char||'')+' ['+src.label.replace(/\s/g,'')+']'+star+'\n\u4E0A: '+(r.playerSaid||'')+'\n'+(r.char||'')+': '+(r.npcSaid||'');
  }).join('\n\n---\n\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast('\u5DF2\u590D\u5236');}).catch(function(){_jishiDownload(txt);});}
  else _jishiDownload(txt);
}
function _jishiDownload(txt){
  var a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='jishi_'+(GM.saveName||'export')+'.txt';a.click();toast('\u5DF2\u5BFC\u51FA');
}
