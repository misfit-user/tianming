// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-memorials.js — 奏疏系统 (R124 从 tm-world.js L1564-6549 拆出)
// 姊妹: tm-world.js (AI 上下文) + tm-office-panel.js (官制+编年)
// 包含: generateMemorials/genMemorialsAI/renderMemorials/_approveMemorial/
//       _rejectMemorial/_annotateMemorial/_referMemorial/_courtDebateMemorial 等
// ============================================================


// ⚠️⚠️⚠️ 警告：本函数被 tm-save-lifecycle.js (line 1009) generateMemorials=function... 覆盖
//   要修改本函数行为·请去 tm-save-lifecycle.js 改·此处仅占位·实际运行版在 save-lifecycle
// ⚠️⚠️⚠️ 警告：本函数被 tm-save-lifecycle.js (line 1009) generateMemorials=function... 覆盖
//   要修改本函数行为·请去 tm-save-lifecycle.js 改·此处仅占位·实际运行版在 save-lifecycle
function generateMemorials(){
  // tokens 预算 16000·原 2-4 份奏疏利用不足·按 tokens 量力而为生成更多
  // 默认提高到 6-10 份·玩家在编辑器可通过 memorialMin/memorialMax 覆盖
  var minCount = P.conf.memorialMin || 6;
  var maxCount = P.conf.memorialMax || 10;
  var count = minCount + Math.floor(random() * (maxCount - minCount + 1));
  if(!GM.chars || GM.chars.length === 0){ GM.memorials = []; renderMemorials(); return; }
  if(P.ai.key){ genMemorialsAI(count); return; }
  // 无AI时：按忠诚和野心优先选人（不纯随机）
  var candidates = GM.chars.filter(function(c){ return c.alive !== false; });
  candidates.sort(function(a, b) {
    var sa = (a.ambition || 50) + (100 - (a.loyalty || 50)); // 野心高+忠诚低→更想上奏
    var sb = (b.ambition || 50) + (100 - (b.loyalty || 50));
    return sb - sa;
  });
  count = Math.min(count, candidates.length);
  GM.memorials = candidates.slice(0, count).map(function(ch){
    // 根据特质推断奏疏类型
    var type = '政务';
    if (ch.traitIds) {
      if (ch.traitIds.indexOf('brave') >= 0 || ch.traitIds.indexOf('militant') >= 0) type = '军务';
      else if (ch.traitIds.indexOf('compassionate') >= 0 || ch.traitIds.indexOf('merciful') >= 0) type = '民生';
      else if (ch.traitIds.indexOf('greedy') >= 0 || ch.traitIds.indexOf('diligent') >= 0) type = '经济';
    }
    return { id: uid(), from: ch.name, title: ch.title || '', type: type, content: ch.name + '奏报：臣以为当务之急…', status: 'pending', turn: GM.turn, reply: '' };
  });
  renderMemorials();
}

async function genMemorialsAI(count){
  try{
    // 构建极丰富上下文prompt
    var prompt = getTSText(GM.turn) + '第' + GM.turn + '回合。\n';

    // ★ 首 3 回合·优先从 aiPlanFirstTurnEvents 生成的候选事件池抽取·保证贴剧本开局
    if (GM.turn <= 3 && Array.isArray(GM._candidateEvents) && GM._candidateEvents.length > 0) {
      var _pool = GM._candidateEvents.filter(function(e) {
        return e && !e._fired && (e.type === 'memorial' || e.type === 'urgent_memorial');
      });
      if (_pool.length > 0) {
        prompt += '\n【首回合候选事件池·优先采用，除非玩家已用诏令解决】\n';
        _pool.slice(0, Math.min(count, 6)).forEach(function(ev) {
          prompt += '  · ' + ev.presenter + '·' + ev.title + '·' + String(ev.payload).slice(0, 150) + '\n';
        });
        prompt += '★ 若上述事件与当前局势契合·请以其为基础撰写奏疏·from 字段填 presenter。\n';
      }
    }

    // 完整局势摘要
    if (GM.eraState) {
      prompt += '局势：' + (GM.eraState.dynastyPhase || '') + '，统一' + Math.round((GM.eraState.politicalUnity||0.5)*100) + '% 集权' + Math.round((GM.eraState.centralControl||0.5)*100) + '% 稳定' + Math.round((GM.eraState.socialStability || 0.5) * 100) + '% 经济' + Math.round((GM.eraState.economicProsperity || 0.5) * 100) + '% 文化' + Math.round((GM.eraState.culturalVibrancy||0.5)*100) + '%\n';
    }
    if (GM.taxPressure !== undefined) prompt += '税压' + Math.round(GM.taxPressure||0) + '\n';

    // 全部变量
    var topVars = [];
    Object.entries(GM.vars || {}).forEach(function(e) { topVars.push(e[0] + ':' + Math.round(e[1].value)); });
    if (topVars.length) prompt += '资源：' + topVars.join('，') + '\n';

    // 显著矛盾（让奏疏内容围绕矛盾展开）
    if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
      prompt += '\n【显著矛盾——奏疏内容应围绕这些矛盾】\n';
      P.playerInfo.coreContradictions.forEach(function(c) { prompt += '  [' + c.dimension + '] ' + c.title + (c.parties?'('+c.parties+')':'') + '\n'; });
    }

    // 危机省份（让地方官上疏）
    if (GM.provinceStats) {
      var _critProv2 = Object.entries(GM.provinceStats).filter(function(e){return e[1].unrest>40||e[1].corruption>50;});
      if (_critProv2.length > 0) {
        prompt += '危机省份：' + _critProv2.map(function(e){return e[0]+'(民变'+Math.round(e[1].unrest)+' 腐'+Math.round(e[1].corruption)+')';}).join('、') + '\n';
      }
    }

    // 深度阅读摘要（让奏疏内容更有深度）
    if (GM._aiScenarioDigest) {
      if (GM._aiScenarioDigest.masterDigest) prompt += '\n剧本理解：' + GM._aiScenarioDigest.masterDigest.substring(0, 300) + '\n';
      if (GM._aiScenarioDigest.etiquetteNorms) prompt += '礼仪规范：' + GM._aiScenarioDigest.etiquetteNorms.substring(0, 100) + '\n';
      if (GM._aiScenarioDigest.writtenStyle) prompt += '公文行文：' + GM._aiScenarioDigest.writtenStyle.substring(0, 100) + '\n';
    }

    // 空缺岗位
    var vacantNames = [];
    if (GM.officeTree) {
      (function _vac(nodes) { nodes.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (!p.holder) vacantNames.push(n.name + p.name); }); if (n.subs) _vac(n.subs); }); })(GM.officeTree);
    }
    if (vacantNames.length) prompt += '空缺官职：' + vacantNames.slice(0, 4).join('，') + '\n';

    // 官制职能分工（奏疏必须由对口部门的官员提出）
    if (typeof getOfficeFunctionSummary === 'function') {
      var _ofSummary = getOfficeFunctionSummary();
      if (_ofSummary) prompt += '\n' + _ofSummary + '\n【核心规则】每份奏疏的from(上奏者)必须是对口部门的官员。军务由兵部/卫尉提出，财政由户部/度支提出，人事由吏部/铨曹提出。请根据上述职能分工精确匹配。\n\n';
    }

    // 游戏模式感知——影响奏疏风格
    var _gMode = (P.conf && P.conf.gameMode) || 'yanyi';
    if (_gMode === 'strict_hist') prompt += '【模式：严格史实】奏疏应严谨考据，引用真实典故，格式严格仿古\n';
    else if (_gMode === 'light_hist') prompt += '【模式：轻度史实】奏疏基于史实但可适度发挥\n';
    else prompt += '【模式：演义】奏疏可富于文学性和戏剧性\n';

    // 待铨进士——由官制中负责铨选的部门官员提议授官
    if (GM._kejuPendingAssignment && GM._kejuPendingAssignment.length > 0) {
      var _quanDept = (typeof findOfficeByFunction === 'function') ? (findOfficeByFunction('铨选') || findOfficeByFunction('选官') || findOfficeByFunction('吏') || findOfficeByFunction('人事')) : null;
      prompt += '【待铨进士】' + GM._kejuPendingAssignment.map(function(p){ return p.name + '(第' + p.rank + '名)'; }).join('、') + '\n';
      if (_quanDept && _quanDept.holder) {
        prompt += '  ※按本朝官制，铨选授官由' + _quanDept.dept + '负责，现任主官为' + _quanDept.holder + '——应由此人上疏建议为进士授官\n';
      } else if (_quanDept) {
        prompt += '  ※按本朝官制，铨选授官由' + _quanDept.dept + '负责（目前主官空缺，可由朝臣联名上疏）\n';
      } else {
        prompt += '  ※朝臣可就进士授官提出建议\n';
      }
    }

    // 近期事件
    if (GM.evtLog) {
      var recent = GM.evtLog.slice(-4);
      if (recent.length) prompt += '近事：' + recent.map(function(e) { return e.text; }).join('；').substring(0, 150) + '\n';
    }

    // 角色列表（含特质、目标、忠诚、弧线、亲疏）
    prompt += '\n上奏角色：\n';
    var candidates = GM.chars.filter(function(c) { return c.alive !== false; });
    // 按"上奏动机"排序：野心高、忠诚极端、压力高的优先
    candidates.sort(function(a, b) {
      var sa = Math.abs((a.loyalty || 50) - 50) + (a.ambition || 50) + (a.stress || 0) * 0.5;
      var sb = Math.abs((b.loyalty || 50) - 50) + (b.ambition || 50) + (b.stress || 0) * 0.5;
      return sb - sa;
    });
    candidates.slice(0, Math.min(count + 2, 8)).forEach(function(ch, idx) {
      var traits = '';
      if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
        var names = [], hints = [];
        ch.traitIds.forEach(function(tid) { var d = P.traitDefinitions.find(function(t) { return t.id === tid; }); if (d) { names.push(d.name); if (d.aiHint) hints.push(d.aiHint); } });
        traits = names.join('、') + (hints.length ? '(' + hints.join(';').substring(0, 60) + ')' : '');
      } else { traits = ch.personality || ''; }
      var goal = ch.personalGoal ? '目标:' + ch.personalGoal.substring(0, 25) : '';
      var arc = '';
      if (GM.characterArcs && GM.characterArcs[ch.name]) {
        var recentArc = GM.characterArcs[ch.name].slice(-2);
        if (recentArc.length) arc = '经历:' + recentArc.map(function(a) { return a.desc; }).join(';').substring(0, 40);
      }
      var aff = '';
      if (typeof AffinityMap !== 'undefined') {
        var topRels = AffinityMap.getRelations(ch.name).slice(0, 2);
        if (topRels.length) aff = '亲疏:' + topRels.map(function(r) { return r.name + (r.value > 0 ? '+' : '') + r.value; }).join(',');
      }
      // 后宫身份标注
      var spouseInfo = '';
      if (ch.spouse) {
        var _rkN2 = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u59BE','attendant':'\u4F8D\u59BE'};
        spouseInfo = ' [\u540E\u5BAB:' + (_rkN2[ch.spouseRank] || '\u59BB\u5BA4');
        if (ch.motherClan) spouseInfo += ',\u6BCD\u65CF' + ch.motherClan;
        if (ch.children && ch.children.length > 0) spouseInfo += ',\u5B50' + ch.children.length;
        spouseInfo += ']';
      }
      // NPC记忆（影响奏疏态度）
      var memCtx = '';
      if (typeof NpcMemorySystem !== 'undefined') {
        var _mc = NpcMemorySystem.getMemoryContext(ch.name);
        if (_mc) memCtx = ' 心绪:' + _mc.slice(0, 120);
      }
      // 位置与信息边界
      var _locInfo = '';
      var _capital2 = GM._capital || '京城';
      if (ch.location && !_isSameLocation(ch.location, _capital2)) {
        _locInfo = ' [远方:' + ch.location + ']';
        // 计算此NPC最后收到京城信息的时间
        var _lastInfo = 0;
        (GM.letters||[]).forEach(function(lt) {
          if (lt.to === ch.name && (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying')) {
            _lastInfo = Math.max(_lastInfo, lt.deliveryTurn || lt.sentTurn || 0);
          }
        });
        if (_lastInfo > 0) {
          _locInfo += '(最后知悉京城信息:T' + _lastInfo + ',即' + (GM.turn - _lastInfo) + '回合前)';
        } else {
          _locInfo += '(从未收到京城消息)';
        }
      } else {
        _locInfo = ' [在京]';
      }
      // 完善·官职(officialTitle 优先于 title)
      var _officeStr = ch.officialTitle || ch.title || '';
      if (ch.officialTitle && ch.title && ch.officialTitle !== ch.title) {
        _officeStr = ch.officialTitle + '·' + ch.title;
      }
      // 完善·党派 + 势力
      var _partyStr = '';
      if (ch.party || ch.faction) {
        _partyStr = ' 党:' + (ch.party || '无') + (ch.faction ? '·势:' + ch.faction : '');
      }
      // 完善·学识 + 家族 + 出身
      var _bgStr = '';
      if (ch.learning) _bgStr += ' 学:' + String(ch.learning).slice(0, 30);
      if (ch.family) _bgStr += ' 家:' + String(ch.family).slice(0, 16);
      if (ch.educationBg || ch.background) _bgStr += ' 出身:' + String(ch.educationBg || ch.background).slice(0, 16);
      // 完善·十维补齐(已有 loyalty/intelligence/valor/military/administration)
      var _moreAbi = '';
      if (typeof ch.ambition === 'number') _moreAbi += ' 野' + ch.ambition;
      if (typeof ch.benevolence === 'number') _moreAbi += ' 仁' + ch.benevolence;
      if (typeof ch.management === 'number') _moreAbi += ' 管' + ch.management;
      if (typeof ch.charisma === 'number') _moreAbi += ' 魅' + ch.charisma;
      if (typeof ch.diplomacy === 'number') _moreAbi += ' 外' + ch.diplomacy;
      // 完善·五常(wuchangOverride 仁义礼智信)
      var _wcStr = '';
      var _wc = ch.wuchangOverride || ch.wuchang;
      if (_wc && typeof _wc === 'object') {
        var _wcParts = [];
        ['仁','义','礼','智','信'].forEach(function(k){
          if (typeof _wc[k] === 'number') _wcParts.push(k + _wc[k]);
        });
        if (_wcParts.length > 0) _wcStr = ' 五常[' + _wcParts.join('·') + ']';
      }
      // 完善·名望/恩眷/压力
      var _statStr = '';
      if (typeof ch.prestige === 'number') _statStr += ' 名' + ch.prestige;
      if (typeof ch.favor === 'number') _statStr += ' 恩' + ch.favor;
      if (typeof ch.stress === 'number' && ch.stress > 20) _statStr += ' 压' + ch.stress;
      // 完善·近期记忆(直接列 3 条·补 NpcMemorySystem 心绪)
      var _memList = '';
      if (Array.isArray(ch._memory) && ch._memory.length > 0) {
        var _ms = ch._memory.slice(-3).map(function(m){
          return (m.event || m.text || '').slice(0, 24);
        }).filter(Boolean);
        if (_ms.length > 0) _memList = ' 忆:[' + _ms.join('；') + ']';
      }
      prompt += (idx + 1) + '. ' + ch.name + '(' + _officeStr + ')' + _locInfo + spouseInfo
        + ' 忠' + (ch.loyalty || 50)
        + ' 智' + (ch.intelligence||50)
        + ' 武勇' + (ch.valor||50)
        + ' 军事' + (ch.military||50)
        + ' 政' + (ch.administration||50)
        + _moreAbi + _wcStr + _statStr + _partyStr + _bgStr
        + ' ' + traits + ' ' + goal + ' ' + arc + ' ' + aff + memCtx + _memList + '\n';
    });

    // 帝王荒淫背景（影响奏疏内容——忠臣可能谏阻，佞臣可能献媚）
    if (GM._tyrantDecadence && GM._tyrantDecadence > 15) {
      prompt += '\n帝王荒淫值:' + GM._tyrantDecadence;
      if (GM._tyrantHistory && GM._tyrantHistory.length > 0) {
        var _lastActs = GM._tyrantHistory.slice(-2);
        var _actNames = [];
        _lastActs.forEach(function(th) {
          th.acts.forEach(function(id) {
            var a = typeof TYRANT_ACTIVITIES !== 'undefined' ? TYRANT_ACTIVITIES.find(function(x) { return x.id === id; }) : null;
            if (a && _actNames.indexOf(a.name) < 0) _actNames.push(a.name);
          });
        });
        if (_actNames.length) prompt += '（近期行径：' + _actNames.join('、') + '）';
      }
      prompt += '\n';
      if (GM._tyrantDecadence > 40) {
        prompt += '※ 至少一份奏疏应与帝王的荒淫行为相关——忠臣死谏/委婉劝导，或佞臣进献珍宝美人以迎合帝意。\n';
      }
    }

    prompt += '\n请为其中' + count + '人生成奏疏。\n\n';
    prompt += '【奏疏体裁】根据内容性质选择——\n';
    prompt += '  题本/奏本：正式官方文书，开头"臣某某谨题/谨奏为……事"，结尾"谨题/谨奏请旨"\n';
    prompt += '  上疏/疏奏：言路台谏建议性文书，开头"臣某某诚惶诚恐，稽首顿首，上疏曰"，敬辞密集\n';
    prompt += '  密折/密揭：亲信机密奏报，无固定格式但开头"臣某某密陈/密奏"，可含私心暗示\n';
    prompt += '【密折vs题本的制度区分——重要】\n';
    prompt += '  题本/上疏/表：经通政司正式渠道递交，其他官员知道"某某上了折子"（但不知内容）\n';
    prompt += '  密折/密揭：密封直达御前，不经通政司——其他官员完全不知此人上了折子\n';
    prompt += '  subtype字段必须准确：情报/告密/揭发/私人请求→密折；正式政务→题本；谏言建议→上疏；庆贺感恩→表\n';
    prompt += '【奏疏质量与NPC能力强关联——关键差异化】\n';
    prompt += '  智力高(>70)+政务高(>70)的NPC：奏疏逻辑严密、引经据典、条理清晰、方案可操作\n';
    prompt += '  智力中等(40-70)的NPC：奏疏基本通顺但观点平庸、建议笼统\n';
    prompt += '  智力低(<40)的NPC：奏疏逻辑混乱、抓不住重点、可能文不对题、方案不切实际\n';
    prompt += '  武将(军事高但政务低)写政务折：纸上谈兵或直来直去，措辞粗犷\n';
    prompt += '  文臣(政务高但军事低)写军务折：书生议兵，可能脱离实际\n';
    prompt += '  这种差异是给玩家"看人下折"的关键信号——帮助玩家判断谁可信谁不可信\n';
    prompt += '  表/笺：特别恭敬的上行文书，多用四六骈句，如谢恩表、贺表\n\n';
    prompt += '【正式奏疏的完整结构（必须遵守）】\n';
    prompt += '一、首称：\n';
    prompt += '   "臣某官某某，谨奏为某某事。"（题本格式）\n';
    prompt += '   或"臣某某诚惶诚恐，稽首顿首，谨上疏曰："（上疏格式）\n';
    prompt += '二、缘由：引经据典或追溯前因，说明为何上疏。\n';
    prompt += '   如："窃惟我朝立国以来……""臣闻古之圣王……""近日边报频传……"\n';
    prompt += '三、正论：陈述事实、分析利弊、提出主张。此为奏疏核心，应最为详尽。\n';
    prompt += '   可分条陈述："其一……其二……其三……"\n';
    prompt += '   或层层递进："今者……然则……况乎……"\n';
    prompt += '四、请旨：明确请求皇帝裁决或批准。\n';
    prompt += '   如："伏乞圣裁""伏望陛下俯准施行""请旨定夺"\n';
    prompt += '五、结语套语：\n';
    prompt += '   "臣不胜惶恐悚栗之至，谨具本奏闻。"\n';
    prompt += '   "臣诚惶诚恐，冒昧具陈，伏候圣鉴。"\n';
    prompt += '   "臣无任瞻天仰圣激切屏营之至。"\n\n';
    prompt += '【语气原则——关键叙事设计】\n';
    prompt += '  忠臣奏疏：内容正确但措辞冗长，让玩家感到"又被说教了"。反复劝说，引经据典，\n';
    prompt += '    以古讽今，道德绑架。"臣闻""臣恐""臣窃以为""伏望陛下""陛下不可不察"等出现多次。\n';
    prompt += '    越忠诚越絮叨——这正是帝王厌倦忠言的本质：正确但令人不快。\n';
    prompt += '  佞臣奏疏：让玩家读了心情好。简洁明快，奉承得体，主动替玩家着想分忧。\n';
    prompt += '    "臣已办妥""不劳圣虑""微臣不揣冒昧，略备薄礼"——内容空洞但读起来舒服。\n';
    prompt += '  野心者：表面恭顺，暗含自荐或排挤对手，言辞巧妙。\n';
    prompt += '  怨恨者：形恭实怨，隐晦批评，话中有话。\n\n';
    prompt += '【信息不对称——核心机制】玩家（皇帝）不是全知视角：\n';
    prompt += '  地方官夸大政绩/隐瞒灾情；武将虚报战功/隐瞒损失；\n';
    prompt += '  忠臣直言但视野有限；野心者编造信息陷害对手；\n';
    prompt += '  派系对立者描述同一事件互相矛盾。请自然体现偏差，不要标注。\n\n';
    prompt += '【字数与格式·硬约束】\n';
    prompt += '  ※ 忠臣/谏官奏疏：' + _charRangeText('memLoyal') + '·必须达到下限·越忠诚越长(让玩家体验"又臭又长"的忠言)\n';
    prompt += '  ※ 佞臣/普通奏疏：' + _charRangeText('memNormal') + '·必须达到下限·简洁得体\n';
    prompt += '  ※ 密折：' + _charRangeText('memSecret') + '·必须达到下限·言简意赅但暗含深意\n';
    prompt += '  ※ 全部使用文言(半文言亦可)·善用四六骈句、对偶排比\n';
    prompt += '  ※ 奏疏正文中适当分段(每段一个论点)·便于阅读\n';
    prompt += '  ※※ 字数硬性要求·不可仅以套话凑字·须有实质内容(论点+论据+对策)\n';
    prompt += '  ※※ 字数严重不足者视为废稿·将被驳回重写\n';
    // 完善·按官职/性格的文体差异化
    prompt += '\n【文体随官职/性格差异化——必须体现】\n';
    prompt += '  · 言官(都察院/六科给事中/监察御史)：直言敢谏·"伏请陛下""臣窃以为""此非臣一人之言"·引经据典+道德绑架\n';
    prompt += '  · 阁臣/首辅次辅：婉转老成·先褒后规·"伏惟圣明""陛下虑及""微臣愚见"·绝不直冲圣意\n';
    prompt += '  · 武将/总兵/参将：粗犷直白·军情务实·"末将""战机稍纵即逝""请赐援兵"·少用骈偶\n';
    prompt += '  · 翰林/侍读侍讲/学士：词藻华丽·四六骈句·引经史·文学侍从本色\n';
    prompt += '  · 户部/工部技术官：陈述账目数字·"今岁""米X石""银Y两""请下部计议"\n';
    prompt += '  · 礼部官员：典章礼仪·"祖制""典故""体统"满篇\n';
    prompt += '  · 刑部/大理寺：律例条文·"律有明文""罪应""依律"\n';
    prompt += '  · 宦官/司礼监：低声下气·自称"奴婢"或"臣"·语简而情切\n';
    prompt += '  · 外戚后宫：题表式·谢恩贺·关切家事而不及国是\n';
    prompt += '  · 性格佞媚者：奉承得体·主动替帝分忧·内容空洞但读来舒服\n';
    prompt += '  · 性格刚直者：直言不讳·甚至以死谏·语带激切\n';
    prompt += '  · 性格阴险者：表面恭顺·暗含自荐或排挤·字字有机锋\n';
    prompt += '  · 性格庸懦者：套话堆砌·无实质主张·或顺势附和\n';
    prompt += '  · 智力低者(<40)：用词陈旧·引用错乱·逻辑跳跃·或文不对题\n';
    prompt += '  · 智力高者(>70)：条分缕析·引证精准·方案具体可行\n';
    prompt += '  · 学识"经学"者：引《尚书》《春秋》《孟子》多·学识"兵法"者引《孙子》《六韬》多·学识"律法"者引律例多\n';
    prompt += '\n【奏疏风格层叠差异化——5层依次叠加】\n';
    prompt += '  为每个上奏者，按以下5层依次计算其奏疏风格：\n';
    prompt += '  层1·能力基底：智力+政务决定分析深度和条理性。武勇(个人武力)≠军事(统兵指挥)≠文笔差\n';
    prompt += '  层2·学识修正：学识提供"引用库"——但引用是否切题取决于层1智力\n';
    prompt += '    学经学+智力低→引经据典但牵强附会；学兵法+智力高→军事分析精准\n';
    prompt += '  层3·五常+特质修正：决定"知道自己不擅长时怎么写"：\n';
    prompt += '    信高+坦诚→不写自己不懂的  信低+狡诈→不懂也写得头头是道\n';
    prompt += '    礼高→格式规范措辞谨慎  礼低→格式随意措辞粗犷\n';
    prompt += '  层4·信仰文化门第：影响措辞习惯，但可被高能力覆盖\n';
    prompt += '  层5·近期记忆经历：此人此刻的情绪——刚受赏=热切，刚被贬=冷淡或暗怨\n';
    prompt += '  重点：两个同为"武将"但智力85和35的人，奏疏天差地别\n';
    prompt += '  重点：高智+低武的文臣写军事奏疏→逻辑严密但脱离实际→纸上谈兵\n';
    prompt += '  层5·记忆影响奏疏态度：上奏者的"心绪"数据必须影响其奏疏基调\n';
    prompt += '    刚受赏→热切感恩；刚被贬→冷淡暗怨；丧亲中→悲切；有刻骨仇恨→可能借题发挥\n\n';
    // 续奏/联名/对奏/因果链指令
    prompt += '\u3010\u7EED\u594F\u4E0E\u56E0\u679C\u94FE\u3011\n';
    if (GM._approvedMemorials && GM._approvedMemorials.length > 0) {
      var _lastTurn = GM._approvedMemorials.filter(function(m) { return m.turn === GM.turn - 1; });
      if (_lastTurn.length > 0) {
        prompt += '\u4E0A\u56DE\u5408\u594F\u758F\u5904\u7406\u7ED3\u679C\uFF08\u672C\u56DE\u5408\u594F\u758F\u5FC5\u987B\u4E0E\u4E4B\u56E0\u679C\u5173\u8054\uFF09\uFF1A\n';
        var _aLbl = { approved:'\u51C6\u594F', rejected:'\u9A73\u56DE', annotated:'\u6279\u793A', referred:'\u8F6C\u6709\u53F8', court_debate:'\u53D1\u5EF7\u8BAE' };
        _lastTurn.forEach(function(m) {
          prompt += '  ' + (m.from||'') + '\u594F' + (m.type||'') + '\u2192' + (_aLbl[m.action]||'\u51C6\u594F');
          if (m.reply) prompt += '(\u6731\u6279:' + m.reply + ')';
          prompt += '\n';
        });
        prompt += '\u8981\u6C42\uFF1A\n';
        prompt += '  \u00B7 \u51C6\u594F\u7684\u2192\u5E94\u6709\u6267\u884C\u8FDB\u5C55\u6216\u65B0\u95EE\u9898\u7684\u594F\u62A5\n';
        prompt += '  \u00B7 \u9A73\u56DE\u7684\u2192\u5FE0\u81E3\u53EF\u80FD\u7EED\u594F\u6B7B\u8C0F\uFF08\u5FC5\u987B\u5F15\u7528\u4E0A\u6B21\u88AB\u9A73\u7684\u7406\u7531\u5E76\u52A0\u4EE5\u8FA9\u9A73\uFF09\uFF0C\u4F5E\u81E3\u53EF\u80FD\u8F6C\u800C\u6697\u4E2D\u6D3B\u52A8\n';
        prompt += '  \u00B7 \u6279\u793A\u7684\u2192\u5B98\u5458\u5E94\u6309\u6279\u793A\u6267\u884C\u540E\u56DE\u594F\u7ED3\u679C\n';
        prompt += '  \u00B7 \u8F6C\u6709\u53F8\u7684\u2192\u8BE5\u8861\u95E8\u4E3B\u5B98\u5E94\u4E0A\u594F\u8BAE\u5904\u7ED3\u8BBA\n';
      }
    }
    prompt += '\u3010\u8054\u540D\u4E0E\u5BF9\u594F\u3011\n';
    prompt += '\u00B7 \u591A\u540D\u5B98\u5458\u53EF\u8054\u540D\u4E0A\u4E66\uFF08from\u586B\u201C\u67D0\u67D0\u7B49N\u4EBA\u201D\uFF09\n';
    prompt += '\u00B7 \u5BF9\u540C\u4E00\u4E8B\u4EF6\uFF0C\u4E0D\u540C\u6D3E\u7CFB\u7684\u5B98\u5458\u53EF\u80FD\u4E0A\u5BF9\u7ACB\u7684\u594F\u758F\uFF0C\u7528relatedTo\u5B57\u6BB5\u6807\u6CE8\u5173\u8054\u7684\u53E6\u4E00\u4EFD\u594F\u758F\u7684from\n';

    // 演义模式紧急排序
    var _gameMode = (P.conf && P.conf.gameMode) || '';
    if (_gameMode === 'yanyi') {
      prompt += '\u3010\u6F14\u4E49\u6A21\u5F0F\u3011\u8BF7\u4E3A\u6BCF\u4EFD\u594F\u758F\u6DFB\u52A0priority\u5B57\u6BB5(urgent/normal)\uFF0C\u7D27\u6025\u519B\u60C5\u3001\u5929\u707E\u3001\u53DB\u4E71\u7B49\u4E3Aurgent\n';
    }

    // ── 远方NPC信息边界约束 ──
    prompt += '\n【远方NPC信息边界——绝对规则】\n';
    prompt += '标注[远方]的NPC，其奏疏内容只能基于其"最后知悉京城信息"时间点之前的信息。\n';
    prompt += '  例：某NPC最后知悉京城信息是3回合前→其奏疏不可提及此后发生的朝政变动、新任命、新诏令。\n';
    prompt += '  远方NPC的奏疏更可能涉及：本地军务/民情、边疆形势、请求增援/物资、弹劾同僚、个人陈情。\n';
    prompt += '  从未收到京城消息的NPC→只能写本地情况，不应评论朝政。\n';

    // ── 等回批→自行决断 ──
    var _waitingNpcs = [];
    var _cap3 = GM._capital || '京城';
    (GM._pendingMemorialDeliveries||[]).forEach(function(m) {
      if (m.status === 'intercepted') {
        // 计算合理往返时间：去程 + 批阅缓冲2回合 + 回程 = deliveryTurns*2 + 2
        var _expectedRound = ((m._deliveryTurn||0) - (m._generatedTurn||0)) * 2 + 2;
        var _waited = GM.turn - (m._generatedTurn||GM.turn);
        _waitingNpcs.push({ name: m.from, waited: _waited, expectedRound: _expectedRound, intercepted: true, location: m._remoteFrom||'远方' });
      }
    });
    // 检查已到达但未收到批复回传的奏疏
    (GM.memorials||[]).forEach(function(m) {
      if (m._remoteFrom && m._replyLetterSent && m._replyDeliveryTurn && GM.turn < m._replyDeliveryTurn) {
        _waitingNpcs.push({ name: m.from, waited: 0, awaitingReply: true, location: m._remoteFrom });
      }
      if (m._remoteFrom && !m._replyLetterSent && m.status !== 'pending' && m.status !== 'pending_review') {
        _waitingNpcs.push({ name: m.from, waited: GM.turn - (m._arrivedTurn||m.turn), location: m._remoteFrom });
      }
    });
    if (_waitingNpcs.length > 0) {
      prompt += '\n【等待回批的NPC——焦虑阈值基于实际往返路程】\n';
      _waitingNpcs.forEach(function(w) {
        if (w.intercepted) {
          var _overdue = w.waited > w.expectedRound;
          prompt += '  ' + w.name + '（' + w.location + '）：已等' + w.waited + '回合，合理往返约' + w.expectedRound + '回合';
          if (_overdue) {
            prompt += ' → ⚠ 已超期' + (w.waited - w.expectedRound) + '回合！NPC应体现焦虑或自行决断\n';
          } else {
            prompt += ' → 尚在合理等待期内，NPC不会焦虑\n';
          }
        } else if (w.awaitingReply) {
          prompt += '  ' + w.name + '（' + w.location + '）：朱批回传中→尚不知批复结果\n';
        }
      });
      prompt += '  焦虑/自行决断规则：只有等待时间超过合理往返时间后，NPC才会焦虑。\n';
      prompt += '  超期后→续奏询问"臣奏疏是否送达"；超期显著（超合理时间50%以上）→自行决断并上折禀告\n';
    }

    // ── 三通道使用指导 ──
    prompt += '\n【远方NPC三种通信渠道——选择指导】\n';
    prompt += '远方NPC上奏疏（本系统）：正式公务——军情汇报、弹劾、政策建议、请示裁决、陈情表态\n';
    prompt += '远方NPC写信（npc_letters）：非正式沟通——私人交情、紧急但不便走正式渠道、试探性建议\n';
    prompt += 'NPC间通信（npc_correspondence）：密谋串联、私下交易、情报交换——皇帝看不到但间谍可截获\n';
    prompt += '同一NPC同一话题不要同时走奏疏和来函两个渠道——选最合适的一个。\n';

    prompt += '\u8FD4\u56DEJSON: [{"from":"\u89D2\u8272\u540D","title":"\u5B98\u804C","type":"\u653F\u52A1|\u519B\u52A1|\u6C11\u751F|\u7ECF\u6D4E|\u4EBA\u4E8B|\u5BC6\u594F","subtype":"\u9898\u672C|\u4E0A\u758F|\u5BC6\u6298|\u8868","content":"\u594F\u758F\u5168\u6587","reliability":"high|medium|low","bias":"none|self_serving|factional|ignorance|deception","relatedTo":"\u5173\u8054\u7684\u53E6\u4E00\u4EFD\u594F\u758F\u7684from(\u53EF\u9009)","priority":"urgent|normal(\u6F14\u4E49\u6A21\u5F0F\u65F6\u586B)"}]';

    // 完善·动态 max_tokens·按 count × 最长档位估算·中文 1 字 ≈ 1.5 token
    var _loyalRange = _getCharRange('memLoyal');
    var _normalRange = _getCharRange('memNormal');
    var _secretRange = _getCharRange('memSecret');
    var _maxPerMem = Math.max(_loyalRange[1], _normalRange[1], _secretRange[1]);
    var _dynamicMaxTok = Math.max(8000, Math.min(32000, count * _maxPerMem * 2 + 2000));
    // 完善·下限阈值用 memNormal 而非 memSecret(更严)·容差 0.7
    var _strictMin = Math.round(_normalRange[0] * 0.7);
    var c = await callAISmart(prompt, _dynamicMaxTok, {
      minLength: count * _strictMin,
      maxRetries: 3,
      validator: function(content) {
        var parsed = extractJSON(content);
        if (!Array.isArray(parsed) || parsed.length < Math.min(count, 2)) return { valid: false, reason: '奏疏数量不足' };
        // 完善·按奏疏 subtype 分别检查字数
        var failed = [];
        parsed.forEach(function(m, i) {
          if (!m || !m.content) { failed.push((i+1) + '·空奏疏'); return; }
          var len = m.content.length;
          // subtype 决定字数下限·密折/表 用 memSecret·题本/上疏 用 memNormal 或 memLoyal(若忠臣)
          var subt = m.subtype || '题本';
          var minRequired;
          if (subt === '密折' || subt === '密揭' || subt === '密报') {
            minRequired = Math.round(_secretRange[0] * 0.85);
          } else if (subt === '表' || subt === '笺') {
            minRequired = Math.round(_secretRange[0] * 0.85);
          } else {
            // 题本/上疏：取 memNormal 下限·容差 0.85
            minRequired = Math.round(_normalRange[0] * 0.85);
          }
          if (len < minRequired) {
            failed.push((i+1) + '·' + (m.from||'?') + '·' + len + '/' + minRequired + '字');
          }
        });
        // 容许少数(≤1/3) 偏短·超过则视为废稿
        if (failed.length > Math.ceil(parsed.length / 3)) {
          return { valid: false, reason: '奏疏字数不足·失败列：' + failed.join('；') + '·须达对应 subtype 字数下限·有论点+论据+对策' };
        }
        return true;
      }
    });
    var parsed = extractJSON(c);
    if (Array.isArray(parsed)) {
      var capital = GM._capital || '京城';
      var localMems = [];
      parsed.slice(0, count).forEach(function(m) {
        var mem = { id: uid(), from: m.from || '', title: m.title || '', type: m.type || '\u653F\u52A1', subtype: m.subtype || '\u9898\u672C', content: m.content || '', status: 'pending', turn: GM.turn, reply: '', reliability: m.reliability || 'medium', bias: m.bias || 'none', relatedTo: m.relatedTo || '', priority: m.priority || 'normal' };
        // 检查上奏者是否在京城
        var ch = findCharByName(mem.from);
        var isRemote = ch && ch.alive !== false && ch.location && !_isSameLocation(ch.location, capital);
        if (isRemote) {
          // 远方NPC奏疏——进入驿递队列
          mem._remoteFrom = ch.location;
          mem._generatedTurn = GM.turn;
          var days = (typeof calcLetterDays === 'function') ? calcLetterDays(ch.location, capital, 'normal') : 5;
          var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
          mem._deliveryTurn = GM.turn + Math.max(1, Math.ceil(days / dpv));
          mem.status = 'in_transit';
          // 截获判定
          var _gMode = (P.conf && P.conf.gameMode) || '';
          var _canIntercept = _gMode === 'strict_hist' || _gMode === 'light_hist';
          if (_canIntercept) {
            var _hostileFacs = (GM.facs||[]).filter(function(f){ return !f.isPlayer && (f.playerRelation||0) < -50; });
            var _interceptRate = 0.03; // 奏疏经通政司官方渠道，截获率远低于私信
            if (_hostileFacs.length > 0) _interceptRate += 0.08;
            if (typeof _ltIsRouteBlocked === 'function' && _ltIsRouteBlocked(ch.location, capital)) _interceptRate += 0.25;
            // 敌占区检查
            var _inHostile = (GM.facs||[]).some(function(f) {
              if (f.isPlayer || (f.playerRelation||0) >= -20) return false;
              var _t = f.territories || f.territory || [];
              if (typeof _t === 'string') _t = [_t];
              return _t.indexOf(ch.location) >= 0;
            });
            if (_inHostile) _interceptRate += 0.20;
            if (Math.random() < _interceptRate) {
              mem.status = 'intercepted';
              var _int = _hostileFacs.length > 0 ? _hostileFacs[Math.floor(Math.random()*_hostileFacs.length)].name : '不明势力';
              mem._interceptedBy = _int;
              // 敌方获知情报
              if (!GM._interceptedIntel) GM._interceptedIntel = [];
              GM._interceptedIntel.push({
                turn: GM.turn, interceptor: _int,
                from: mem.from, to: '皇帝',
                content: '截获奏疏：' + (mem.content||'').slice(0,80),
                urgency: 'memorial', letterType: 'report'
              });
              if (typeof addEB === 'function') addEB('传书', mem.from + '的奏疏信使失踪');
            }
          }
          // NPC记住自己上了什么折子
          if (mem.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
            NpcMemorySystem.remember(mem.from, '向天子上奏疏：' + (mem.content||'').slice(0,60), '平', 6);
          }
          if (!GM._pendingMemorialDeliveries) GM._pendingMemorialDeliveries = [];
          GM._pendingMemorialDeliveries.push(mem);
        } else {
          // 在京NPC——立即可批复
          localMems.push(mem);
        }
      });
      GM.memorials = localMems;
    }
  } catch(e) { console.warn('[genMemorialsAI]', e.message || e); }
  renderMemorials();
}
function renderMemorials(){
  var el=_$("zouyi-list");if(!el)return;
  var _isYanyi = P.conf && P.conf.gameMode === 'yanyi';

  // 在途奏疏提示（保留）
  var _transitMems = (GM._pendingMemorialDeliveries||[]).filter(function(m) { return m.status === 'in_transit'; });
  var _transitHtml = '';
  if (_transitMems.length > 0) {
    _transitHtml = '<div class="mem-transit"><div class="mem-transit-icon">\u9A7F</div>'
      + '<div><span class="lbl">\u9A7F \u7AD9 \u6765 \u62A5 \uFF1A</span>\u5C1A\u6709 <strong style="color:var(--amber-400);">' + _transitMems.length + '</strong> \u4EFD\u594F\u758F\u5728\u9014\u3002</div></div>';
  }

  // 渲染本回合全部奏疏
  var visible=GM.memorials.filter(function(m){return m.turn===GM.turn || m.status==="pending" || m.status==="pending_review";});
  if(visible.length===0){
    el.innerHTML=_transitHtml + '<div class="mem-empty">\u6848\u724D\u6E05\u51C0\u3000\u767E\u5B98\u65E0\u4E8B\u542F\u594F</div>';
    return;
  }

  // 按组分类
  var gUrgent = [], gPending = [], gHeld = [], gDone = [];
  visible.forEach(function(m){
    if (m.status === 'pending_review') gHeld.push(m);
    else if (m.status === 'approved' || m.status === 'rejected' || m.status === 'annotated' || m.status === 'referred' || m.status === 'court_debate') gDone.push(m);
    else if (m.priority === 'urgent') gUrgent.push(m);
    else gPending.push(m);
  });

  // 渲染单张卡片
  function _renderCard(m) {
    var idx = GM.memorials.indexOf(m);
    var isHeld = m.status === 'pending_review';
    var isSystem = !m.from || m.from === '\u6709\u53F8';
    var _sender = isSystem ? null : findCharByName(m.from);

    // 卡片色条（按忠诚+可信度+紧急度）
    var _mcCls = 'mem-c-normal';
    if (m.priority === 'urgent') _mcCls = 'mem-c-danger';
    else if (_isYanyi && m.reliability === 'low') _mcCls = 'mem-c-suspect';
    else if (_sender) {
      var _loy = _sender.loyalty || 50;
      if (_loy < 25) _mcCls = 'mem-c-danger';
      else if (_loy < 40) _mcCls = 'mem-c-suspect';
      else if (_loy >= 75) _mcCls = 'mem-c-loyal';
    }

    // 头像
    var _initial = escHtml(String(m.from||'?').charAt(0));
    var _portrait = (_sender && _sender.portrait) ? '<img src="'+escHtml(_sender.portrait)+'">' : _initial;

    // 官衔（从 sender 官职 或 m.title）
    var _subTitle = '';
    if (_sender && _sender.officialTitle) _subTitle = _sender.officialTitle;
    else if (_sender && _sender.title) _subTitle = _sender.title;
    else if (m.title) _subTitle = m.title;

    // 状态徽记
    var _badges = '';
    if (m.priority === 'urgent') _badges += '<span class="mem-badge mem-badge-urgent">\u6025</span>';
    if (_isYanyi && m.reliability === 'low') _badges += '<span class="mem-badge mem-badge-reliab" title="\u6B64\u594F\u758F\u53EF\u4FE1\u5EA6\u53EF\u7591">\u26A0 \u5B58\u7591</span>';
    if (_isYanyi && m.reliability === 'medium') _badges += '<span class="mem-badge" style="color:var(--gold-400);background:rgba(184,154,83,0.08);border-color:var(--gold-400);">? \u5F85\u8BC1</span>';
    if (m.status === 'pending_review') _badges += '<span class="mem-badge mem-badge-held">\u7559\u4E2D</span>';
    if (m.status === 'approved') _badges += '<span class="mem-badge mem-badge-approved">\u2713 \u5DF2\u51C6\u594F</span>';
    if (m.status === 'rejected') _badges += '<span class="mem-badge mem-badge-rejected">\u2717 \u5DF2\u9A73\u56DE</span>';
    if (m.status === 'annotated') _badges += '<span class="mem-badge mem-badge-annotated">\u270E \u5DF2\u6279\u793A</span>';
    if (m.status === 'referred') _badges += '<span class="mem-badge mem-badge-referred">\u2192 \u5DF2\u8F6C</span>';
    if (m.status === 'court_debate') _badges += '<span class="mem-badge mem-badge-court">\u2696 \u5EF7\u8BAE</span>';
    if (m._remoteFrom) {
      _badges += '<span class="mem-badge mem-badge-remote" title="\u6B64\u6298\u7ECF\u9A7F\u7AD9\u81EA' + escHtml(m._remoteFrom) + '\u9012\u8FBE">\u9A7F\u9012\u81EA' + escHtml(m._remoteFrom) + '</span>';
      if (m._replyLetterSent) {
        var _replyArrived = m._replyDeliveryTurn && GM.turn >= m._replyDeliveryTurn;
        _badges += _replyArrived
          ? '<span class="mem-badge" style="color:var(--celadon-400);background:rgba(106,154,127,0.1);border-color:var(--celadon-400);">\u6731\u6279\u5DF2\u9001\u8FBE</span>'
          : '<span class="mem-badge" style="color:var(--ink-300);background:rgba(107,93,71,0.08);border-color:var(--ink-300);">\u6731\u6279\u56DE\u4F20\u4E2D\u2026</span>';
      }
    }

    // 类型 pill
    var _typeLabel = (m.type||'\u594F\u758F') + (m.subtype ? '\u00B7' + m.subtype : '');
    var _typePill = '<span class="mem-type-pill">' + escHtml(_typeLabel) + '</span>';

    // 正文
    var _contentText = m.content || '';
    var _contentHtml;
    if (_contentText.length > 180) {
      var memBodyId = 'mem-body-' + idx;
      _contentHtml = '<div class="mem-body collapsed wd-selectable" id="' + memBodyId + '">' + escHtml(_contentText) + '</div>'
        + '<button class="mem-toggle" onclick="var b=document.getElementById(\''+memBodyId+'\');var col=b.classList.toggle(\'collapsed\');this.textContent=col?\'\u25BC \u5C55\u5F00\u5168\u6587\':\'\u25B2 \u6536\u8D77\';">\u25BC \u5C55\u5F00\u5168\u6587</button>';
    } else {
      _contentHtml = '<div class="mem-body wd-selectable">' + escHtml(_contentText) + '</div>';
    }

    // 侨置决策按钮（特殊场景）
    var _qiaozhi = m._qiaozhiTarget
      ? '<div style="margin-top:10px;"><button class="mem-btn" style="--ab:var(--gold-400);background:linear-gradient(to bottom,var(--gold-400),var(--gold-500));color:var(--bg-1);" onclick="openQiaozhiPanel(\''+escHtml(m._qiaozhiTarget||'').replace(/'/g,'')+'\')">\u4FA8\u7F6E\u51B3\u7B56</button></div>'
      : '';

    // 朱笔批注
    var _reply = '<div class="mem-reply-wrap">'
      + '<div class="mem-reply-label">\u6731 \u7B14 \u6279 \u6CE8</div>'
      + '<textarea id="mem-reply-'+idx+'" class="mem-reply-input" rows="2" placeholder="\u5FA1\u7B14\u6731\u6279\uFF0C\u53EF\u76F4\u63A5\u4E0B\u8BCF\u6216\u9644\u8BED\u2026\u2026">'+escHtml(m.reply||'')+'</textarea>'
      + '</div>';

    // 操作按钮
    var _acts = '<div class="mem-actions">'
      + '<button class="mem-btn approve" onclick="_approveMemorial('+idx+')"><span class="ic">\u2713</span> \u51C6\u3000\u594F</button>'
      + '<button class="mem-btn reject" onclick="_rejectMemorial('+idx+')"><span class="ic">\u2717</span> \u9A73\u3000\u56DE</button>'
      + '<button class="mem-btn annotate" onclick="_annotateMemorial('+idx+')"><span class="ic">\u270E</span> \u6279\u793A\u610F\u89C1</button>'
      + '<button class="mem-btn refer" onclick="_referMemorial('+idx+')"><span class="ic">\u2192</span> \u8F6C\u4EA4\u6709\u53F8</button>'
      + '<button class="mem-btn court" onclick="_courtDebateMemorial('+idx+')"><span class="ic">\u2696</span> \u53D1\u5EF7\u8BAE</button>'
      + (isHeld?'':'<button class="mem-btn hold" onclick="_holdMemorial('+idx+')"><span class="ic">\u23F8</span> \u7559\u3000\u4E2D</button>')
      + '<button class="mem-btn excerpt" onclick="_memExcerptToEdict('+idx+')" title="\u5212\u9009\u594F\u758F\u6587\u5B57\u6458\u5165\u5EFA\u8BAE\u5E93"><span class="ic">\u2398</span> \u6458\u3000\u5165</button>'
      + (isSystem?'':'<button class="mem-btn summon" onclick="_summonForMemorial('+idx+')"><span class="ic">\u2604</span> \u4F20\u53EC\u95EE\u8BAF</button>')
      + '</div>';

    return '<div class="mem-card ' + _mcCls + '"' + (isHeld?' style="opacity:0.82;"':'') + '>'
      + '<div class="mem-card-hdr">'
        + '<div class="mem-portrait">' + _portrait + '</div>'
        + '<div class="mem-from-wrap">'
          + '<div class="mem-from">' + escHtml(m.from||'\u6709\u53F8') + '</div>'
          + '<div class="mem-from-title">' + escHtml(_subTitle) + '</div>'
        + '</div>'
        + '<div class="mem-badges">' + _badges + '</div>'
        + _typePill
      + '</div>'
      + '<div class="mem-body-label">\u672C \u3000 \u594F</div>'
      + _contentHtml
      + _qiaozhi
      + _reply
      + _acts
      + '</div>';
  }

  var html = _transitHtml;
  if (gUrgent.length > 0) {
    html += '<div class="mem-group mem-g-urgent">';
    html += '<div class="mem-group-title"><span class="tag">\u6025 \u594F \u5F85 \u6279</span><span class="desc">\u52A0\u6025\u00B7\u544A\u53D8\u00B7\u8FB9\u4E8B\u6025\u62A5\uFF0C\u5B9C\u901F\u88C1\u51B3</span><span class="count">' + gUrgent.length + ' \u6298</span></div>';
    gUrgent.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }
  if (gPending.length > 0) {
    html += '<div class="mem-group mem-g-pending">';
    html += '<div class="mem-group-title"><span class="tag">\u767E \u5B98 \u542F \u594F</span><span class="desc">\u5F85\u6279\u00B7\u5F85\u6279\u793A\u00B7\u5F85\u8F6C\u4EA4</span><span class="count">' + gPending.length + ' \u6298</span></div>';
    gPending.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }
  if (gHeld.length > 0) {
    html += '<div class="mem-group mem-g-held">';
    html += '<div class="mem-group-title"><span class="tag">\u7559 \u4E2D \u4E4B \u6298</span><span class="desc">\u6682\u641C\u7F6E\u00B7\u5019\u65F6\u673A\u00B7\u6216\u89C2\u671B\u4E8B\u52BF</span><span class="count">' + gHeld.length + ' \u6298</span></div>';
    gHeld.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }
  if (gDone.length > 0) {
    html += '<div class="mem-group mem-g-done">';
    html += '<div class="mem-group-title"><span class="tag">\u5DF2 \u6279 \u6863 \u6848</span><span class="desc">\u672C\u56DE\u5408\u5DF2\u5904\u7406\u00B7\u53EF\u518D\u6B21\u4FEE\u8BA2</span><span class="count">' + gDone.length + ' \u6298</span></div>';
    gDone.forEach(function(m){ html += _renderCard(m); });
    html += '</div>';
  }

  el.innerHTML = html;
}

/** 奏疏划选摘入建议库（同问对流程） */
function _memExcerptToEdict(idx) {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('请先在奏疏中划选要摘录的文字'); return; }
  var m = GM.memorials[idx];
  var from = m ? (m.from || '?') : '?';
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '奏疏', from: from, content: text, turn: GM.turn, used: false });
  toast('已摘入诏书建议库');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
}

// 奏疏批复——不直接改变NPC数值，只写入记忆+记录，数值变化由AI在回合推演中根据累积情况判断
/** 批复远方NPC的奏疏→自动生成回传信件（驿递延迟） */
function _memorialSendReply(m, actionLabel) {
  if (!m || !m._remoteFrom || !m.from) return;
  var ch = findCharByName(m.from);
  if (!ch || !ch.location) return;
  var capital = GM._capital || '京城';
  if (_isSameLocation(ch.location, capital)) return; // 在京无需传书
  var days = (typeof calcLetterDays === 'function') ? calcLetterDays(capital, ch.location, 'urgent') : 3;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
  var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
  var replyContent = '【朱批回传】' + actionLabel + '。' + (m.reply ? '御批：' + m.reply : '');
  var _nowDay = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  var letter = {
    id: (typeof uid === 'function') ? uid() : 'lt_' + Date.now(),
    from: '玩家', to: m.from,
    fromLocation: capital, toLocation: ch.location,
    content: replyContent,
    sentTurn: GM.turn,
    deliveryTurn: GM.turn + deliveryTurns,
    replyTurn: GM.turn + deliveryTurns + 1,
    _sentDay: _nowDay,
    _deliveryDay: _nowDay + days,
    _replyDay: _nowDay + days * 2 + 3,
    _travelDays: days,
    reply: '', status: 'traveling',
    urgency: 'urgent', letterType: 'formal_edict',
    _sendMode: 'multi_courier', _replyExpected: true,
    _memorialReply: true, _memorialId: m.id
  };
  if (!GM.letters) GM.letters = [];
  GM.letters.push(letter);
  m._replyLetterSent = true;
  m._replyDeliveryTurn = GM.turn + deliveryTurns;
  if (typeof toast === 'function') toast('朱批已遣加急驿递回传' + m.from + '，约' + Math.ceil(deliveryTurns * ((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15)) + '日后送达');
}

/** 暂存奏疏决定（允许反复修改，末回合提交才落实 NPC 记忆/回传） */
function _stageMemorialDecision(m, action, reply, extra) {
  if (!m) return;
  m.status = action;
  m.reply = reply || '';
  if (extra && extra._referredTo) m._referredTo = extra._referredTo;
  // 清除已提交标记——玩家回合内改变决定后，commit 时重新处理
  m._commitApplied = false;
  if (!GM._approvedMemorials) GM._approvedMemorials = [];
  GM._approvedMemorials = GM._approvedMemorials.filter(function(a) { return !(a.from === m.from && a.turn === GM.turn && a.content === (m.content || '')); });
  var entry = { from: m.from, type: m.type, content: m.content || '', turn: GM.turn, reply: m.reply, action: action };
  if (extra && extra._referredTo) entry.referredTo = extra._referredTo;
  GM._approvedMemorials.push(entry);
  if (GM._approvedMemorials.length > 30) GM._approvedMemorials.shift();
}

function _approveMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '';
  _stageMemorialDecision(m, 'approved', reply);
  renderMemorials();
  toast('\u51C6\u594F\uFF08\u672A\u63D0\u4EA4\uFF0C\u8FC7\u56DE\u5408\u751F\u6548\uFF09');
}

function _rejectMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '';
  _stageMemorialDecision(m, 'rejected', reply);
  renderMemorials();
  toast('\u9A73\u56DE\uFF08\u672A\u63D0\u4EA4\uFF0C\u8FC7\u56DE\u5408\u751F\u6548\uFF09');
}

// 批示意见——准其部分驳其部分，朱笔批注为核心
function _annotateMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '';
  if (!reply) { toast('\u8BF7\u5148\u5728\u6731\u7B14\u6279\u6CE8\u4E2D\u5199\u660E\u5177\u4F53\u610F\u89C1'); return; }
  _stageMemorialDecision(m, 'annotated', reply);
  renderMemorials();
  toast('\u5DF2\u6279\u793A\uFF08\u672A\u63D0\u4EA4\uFF0C\u8FC7\u56DE\u5408\u751F\u6548\uFF09');
}

// 转交有司——着该部议处
function _referMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  // 弹窗选择批转对象
  var _playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital||'京城');
  var _candidates = (GM.chars||[]).filter(function(c) {
    return c.alive !== false && !c.isPlayer && c.name !== m.from && (!c.location || _isSameLocation(c.location, _playerLoc));
  });
  // 按品级排序
  _candidates.sort(function(a,b) {
    var ra = typeof getRankLevel === 'function' ? getRankLevel(a.officialTitle||'') : 99;
    var rb = typeof getRankLevel === 'function' ? getRankLevel(b.officialTitle||'') : 99;
    return ra - rb;
  });
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:400px;max-height:70vh;overflow-y:auto;">';
  html += '<div style="font-size:var(--text-sm);color:var(--color-primary);margin-bottom:var(--space-2);">批转此折给——</div>';
  _candidates.slice(0, 15).forEach(function(c) {
    html += '<div style="padding:var(--space-1) var(--space-2);background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:var(--radius-sm);margin-bottom:var(--space-1);cursor:pointer;font-size:var(--text-xs);" onclick="_doReferMemorial(' + idx + ',\'' + escHtml(c.name).replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">'
      + '<span style="font-weight:var(--weight-bold);">' + escHtml(c.name) + '</span>'
      + '<span style="color:var(--ink-300);margin-left:4px;">' + escHtml(c.officialTitle||c.title||'') + '</span>'
      + '</div>';
  });
  html += '<div style="text-align:center;margin-top:var(--space-2);"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _doReferMemorial(idx, referTo) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '着' + referTo + '议处';
  _stageMemorialDecision(m, 'referred', reply, { _referredTo: referTo });
  renderMemorials();
  toast('已批转给' + referTo + '（未提交，过回合生效）');
}

// 发廷议——交群臣公议，触发朝议
function _courtDebateMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '\u7740\u5EF7\u8BAE';
  _stageMemorialDecision(m, 'court_debate', reply);
  renderMemorials();

  // 将奏疏内容作为朝议议题——先写入议题输入框再启动
  if (typeof startChaoyiSession === 'function') {
    var _cyInput = _$('cy-topic-input');
    if (_cyInput) _cyInput.value = '\u594F\u758F\u8BAE\u9898\uFF1A' + (m.content || '').slice(0, 200);
    startChaoyiSession();
  } else {
    toast('\u671D\u8BAE\u6A21\u5757\u672A\u52A0\u8F7D');
  }
  toast('\u5DF2\u53D1\u4EA4\u5EF7\u8BAE\uFF08\u8FC7\u56DE\u5408\u65F6\u63D0\u4EA4\uFF09');
}

function _holdMemorial(idx) {
  var m = GM.memorials[idx];
  if (!m) return;
  var reply = (_$('mem-reply-' + idx) || {}).value || '\u518D\u8BAE';
  m.status = 'pending_review';
  m.reply = reply;
  m._commitApplied = false;
  renderMemorials();
  toast('\u7559\u4E2D\u4E0D\u53D1\uFF08\u672A\u63D0\u4EA4\uFF09');
}

/**
 * 末回合前 commit 所有本回合奏疏决定的副作用（NPC 记忆+回传朱批）
 * 被 endTurn 在 AI 推演前调用一次
 */
function _commitMemorialDecisions() {
  if (!Array.isArray(GM.memorials)) return;
  GM.memorials.forEach(function(m) {
    if (!m || m._commitApplied) return;
    // 只 commit 本回合或早期被改决定的
    if (m.turn != null && m.turn > GM.turn) return;
    var status = m.status;
    if (status !== 'approved' && status !== 'rejected' && status !== 'annotated' && status !== 'referred' && status !== 'court_debate') return;
    var actionLbl = status === 'approved' ? '所奏准奏'
                  : status === 'rejected' ? '所奏驳回'
                  : status === 'annotated' ? '朱笔批注'
                  : status === 'referred' ? ('着' + (m._referredTo||'有司') + '议处')
                  : '已发交廷议';
    var memoryLbl = status === 'approved' ? '被准奏'
                  : status === 'rejected' ? '被驳回'
                  : status === 'annotated' ? ('被朱批批示：' + (m.reply||''))
                  : status === 'referred' ? ('被批转给' + (m._referredTo||'有司') + '议处')
                  : '被发交廷议';
    if (m.from && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      var memText = '\u6240\u4E0A\u594F\u758F\u300C' + (m.content || '').slice(0, 30) + '\u300D' + memoryLbl;
      if (status !== 'annotated' && m.reply) memText += '\uFF0C\u6731\u6279\uFF1A' + m.reply;
      try { NpcMemorySystem.remember(m.from, memText, '\u5E73', 5); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
      // referred 也给被转交者留一条记忆
      if (status === 'referred' && m._referredTo) {
        try { NpcMemorySystem.remember(m._referredTo, '\u7687\u5E1D\u5C06' + (m.from||'某人') + '\u7684\u594F\u758F\u6279\u8F6C\u7ED9\u81EA\u5DF1\u8BAE\u5904', '\u5E73', 4); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
      }
    }
    try { if (typeof _memorialSendReply === 'function') _memorialSendReply(m, actionLbl); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
    m._commitApplied = true;
  });
}

// 传召问询——从奏疏直接召唤上奏者对话（远方NPC改为遣使问询）
function _summonForMemorial(memIdx){
  var m=GM.memorials[memIdx];
  if(!m||!m.from)return;
  var ch=findCharByName(m.from);
  if(!ch){toast('找不到此人');return;}
  var capital = GM._capital || '京城';
  if (ch.location && !_isSameLocation(ch.location, capital)) {
    // 远方NPC——无法面询，提供三个选项
    var bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
    bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.5rem 2rem;max-width:380px;text-align:center;">'
      + '<div style="font-size:var(--text-sm);color:var(--color-primary);margin-bottom:var(--space-3);">' + escHtml(m.from) + '远在' + escHtml(ch.location) + '，无法当面问询</div>'
      + '<div style="display:flex;flex-direction:column;gap:var(--space-2);">'
      + '<button class="bt bp" onclick="GM._pendingLetterTo=\'' + m.from.replace(/'/g,"\\'") + '\';switchGTab(null,\'gt-letter\');this.closest(\'div[style*=fixed]\').remove();">鸿雁传书——遣使问询</button>'
      + '<button class="bt bs" onclick="_summonRecall(\'' + m.from.replace(/'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">召回京师——当面奏对</button>'
      + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>'
      + '</div></div>';
    document.body.appendChild(bg);
    return;
  }
  // 在京NPC——直接问对
  openWenduiModal(m.from, 'formal', '朕阅你奏疏，所奏之事须当面详禀。');
}
/** 召回远方NPC回京 */
function _summonRecall(name) {
  var ch = findCharByName(name);
  if (!ch) return;
  var capital = GM._capital || '京城';
  var days = (typeof calcLetterDays === 'function') ? calcLetterDays(capital, ch.location, 'urgent') : 5;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
  var travelTurns = Math.max(1, Math.ceil(days * 2 / dpv)); // 来回=信使到+人赶路
  ch._travelTo = capital;
  ch._travelFrom = ch.location;
  ch._travelArrival = GM.turn + travelTurns;
  // 先派信使通知
  var _nowDay2 = (typeof getCurrentGameDay === 'function') ? getCurrentGameDay() : (GM.turn-1)*dpv;
  var letter = {
    id: (typeof uid === 'function') ? uid() : 'lt_' + Date.now(),
    from: '玩家', to: name,
    fromLocation: capital, toLocation: ch.location,
    content: '着' + name + '即刻回京面圣，所奏之事当面详禀。',
    sentTurn: GM.turn, deliveryTurn: GM.turn + Math.max(1, Math.ceil(days / dpv)),
    replyTurn: GM.turn + travelTurns,
    _sentDay: _nowDay2,
    _deliveryDay: _nowDay2 + days,
    _replyDay: _nowDay2 + travelTurns * dpv,
    _travelDays: days,
    reply: '', status: 'traveling', urgency: 'urgent', letterType: 'formal_edict',
    _sendMode: 'multi_courier', _replyExpected: true,
    _recallOrder: true
  };
  if (!GM.letters) GM.letters = [];
  GM.letters.push(letter);
  // 编年·召回启程
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  GM._chronicle.unshift({
    turn: GM.turn,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: '\u5FB4\u53EC\u56DE\u4EAC',
    title: name + ' \u5956\u65E8\u56DE\u4EAC',
    content: name + ' \u81EA' + ch.location + ' \u5956\u65E8\u8D77\u7A0B\u56DE\u4EAC\u9762\u5723\u00B7\u9884\u8BA1 ' + Math.ceil(travelTurns * dpv) + ' \u65E5\uFF08' + travelTurns + ' \u56DE\u5408\uFF09\u62B5\u4EAC\u3002',
    category: '\u4EBA\u4E8B', tags: ['人事', '召回', '启程', name]
  });
  if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
  GM.qijuHistory.unshift({
    turn: GM.turn, date: GM._gameDate || '',
    content: '\u3010\u5FB4\u53EC\u3011' + name + ' \u5956\u65E8\u81EA' + ch.location + ' \u56DE\u4EAC\u00B7\u9884\u8BA1 ' + Math.ceil(travelTurns * dpv) + ' \u65E5\u62B5\u8FBE\u3002'
  });
  // 也设新字段以便 v10 pos card 显示
  ch._travelTo = capital;
  ch._travelFrom = ch.location;
  ch._travelStartTurn = GM.turn;
  ch._travelRemainingDays = days;
  ch._travelArrival = GM.turn + travelTurns;
  ch._travelReason = '奉诏召回面圣';
  toast(name + '已奉旨启程回京，约' + Math.ceil(travelTurns * dpv) + '日后抵达');
}
