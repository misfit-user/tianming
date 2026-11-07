// 人物实体（人1）：一个人只有一份「他是谁」。凡是 AI 要以某人说话、行事，都从这里取。
// 设计：docs/guanben-roleplay-20260930/tuiyan.md 7.2 节（同志 11-05：每个人是一个实体，不能做成分裂的人）。
//
// 本片以问对的版本为底（它最成熟）：
//   · frag 里每个片段函数都是从问对 _wdBuildPrompt（tm-wendui-persona-views.js）原样搬出来的代码，
//     问对改为在原位置逐个调用、按原顺序拼，提示词逐字不变，各函数的求值次序也不变。
//   · brief(人, { 场合, 话题, 详略 }) 给出完整档与精简档（朝议一场十几个人用精简档）；
//     core(人) 是人格核的结构化读法：多个来源按固定优先级合成，后续各机制接入（人2）时都读它。
//   · 不新建存储：东西还在人物身上和现有的账里；这里只是唯一的读法。
// 片段按 7.2 节归五块：人格核、处境、记忆、心里有数；问对场合的规矩留在问对自己那里。
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  if (TM.Person) return;

  var frag = {
    // ── 人格核 ──
    traitDesc: function (ch) {
      var traitDesc = '';
      if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
        traitDesc = ch.traitIds.map(function(id) { var d = P.traitDefinitions.find(function(t) { return t.id === id; }); return d ? d.name : id; }).join('、');
      } else if (ch.personality) { traitDesc = ch.personality; }
      return traitDesc;
    },
    // 对君主（玩家）的好感：各场合都要
    opinion: function (ch) {
      var _wdPlayer = (typeof TM !== 'undefined' && TM.Player && typeof TM.Player.getCharacter === 'function')
        ? TM.Player.getCharacter(GM)
        : (GM.chars || []).find(function(c) { return c && c.isPlayer === true; });
      return (typeof OpinionSystem !== 'undefined') ? OpinionSystem.getTotal(ch, _wdPlayer || { name: '玩家' }) : (ch.loyalty || 50);
    },
    eraCtx: function () {
      var sc = findScenarioById && findScenarioById(GM.sid);
      return sc ? (sc.era || sc.dynasty || '') : '';
    },
    ageInfo: function (ch) {
      return (ch.age !== undefined && ch.age !== null) ? '，年' + ch.age : '';
    },
    stressInfo: function (ch) {
      return (ch.stress && ch.stress > 30) ? '，当前压力' + ch.stress + '(' + ((ch.stress > 60) ? '濒临崩溃' : '焦虑不安') + ')' : '';
    },
    appearance: function (ch) {
      var appearInfo = '';
      if (ch.appearance) appearInfo += '\n【外貌】' + ch.appearance;
      if (ch.charisma && ch.charisma > 70) appearInfo += (appearInfo ? '，' : '\n') + '魅力出众';
      return appearInfo;
    },
    // 文化/信仰/学识/个人语言风格/民族/籍贯
    background: function (ch) {
      var p = '';
      if (ch.culture) p += '【文化】' + ch.culture + '\n';
      if (ch.faith) p += '【信仰】' + ch.faith + '\n';
      if (ch.learning) p += '【学识】' + ch.learning + '\n';
      if (ch.learning) p += '说话风格受学识影响（' + ch.learning + '）：用词和引用应体现其学识背景。\n';
      if (ch.faith) p += '说话风格受信仰影响（' + ch.faith + '）：言语中可能体现其信仰理念。\n';
      if (ch.speechStyle) p += '【个人语言风格】' + ch.speechStyle + '\n';
      if (ch.ethnicity) p += '【民族】' + ch.ethnicity + '\n';
      if (ch.birthplace) p += '【籍贯】' + ch.birthplace + '\n';
      return p;
    },
    abilities: function (ch) {
      return '【能力】智' + (ch.intelligence || 50) + ' 武勇' + (ch.valor || 50) + ' 军事' + (ch.military || 50) + ' 政' + (ch.administration || 50) + ' 魅' + (ch.charisma || 50) + ' 交' + (ch.diplomacy || 50) + ' 仁' + (ch.benevolence || 50) + '\n';
    },
    // AI 人设文本与认知状态（PromptComposer）
    personaText: function (ch) {
      var out = '';
      if (typeof TM !== 'undefined' && TM.PromptComposer) {
        try {
          var _aiPersonaBlock = TM.PromptComposer.buildAiPersonaText(ch);
          if (_aiPersonaBlock) out += _aiPersonaBlock;
          var _recBlock = TM.PromptComposer.buildRecognitionState(ch);
          if (_recBlock) out += _recBlock;
        } catch(_){}
      }
      return out;
    },

    // ── 处境 ──
    family: function (ch) {
      var familyInfo = '';
      if (ch.family) {
        familyInfo = '\n【家族】' + ch.family;
        var _clanMem = (GM.chars || []).filter(function(c2) { return c2.alive !== false && c2.name !== ch.name && c2.family === ch.family; });
        if (_clanMem.length > 0) familyInfo += '（同族：' + _clanMem.slice(0, 3).map(function(m) { return m.name; }).join('、') + '）';
      }
      return familyInfo;
    },
    // 本回合朝议上下文（如果此人参与了朝议，问对时应保持一致或有意识地私下说不同的话）
    courtStance: function (ch, name, privateMode) {
      var _courtCtx = '';
      if (GM._courtRecords) {
        var _thisCourtRecs = GM._courtRecords.filter(function(r) { return r.turn === GM.turn && r.stances[name]; });
        if (_thisCourtRecs.length > 0) {
          _courtCtx = '\n【本回合朝议立场】此人今天在朝议中就"' + _thisCourtRecs[0].topic + '"';
          var _cStance = _thisCourtRecs[0].stances[name];
          _courtCtx += '表态' + _cStance.stance + '（' + _cStance.brief + '）。';
          if (privateMode) {
            _courtCtx += '\n私下问对时，此人可能：a)重申朝议立场 b)吐露朝议上不敢说的真话 c)解释自己为何那样表态——取决于信/坦诚/狡诈特质\n';
          } else {
            _courtCtx += '\n正式问对中，此人应与朝议立场保持基本一致（除非有新信息改变了判断）\n';
          }
        }
      }
      return _courtCtx;
    },
    // 三元身份——势力+党派+阶层
    identity: function (ch) {
      var _triId2 = [];
      if (ch.faction) _triId2.push('势力:' + ch.faction);
      if (ch.party) _triId2.push('党派:' + ch.party);
      if (ch.class) {
        var _cObjW = _wdFactionValues(GM.classes).find(function(c){return c.name===ch.class;});
        _triId2.push('阶层:' + ch.class + (_cObjW && _cObjW.demands ? '(诉求:'+_cObjW.demands.slice(0,20)+')' : ''));
      }
      return _triId2.length > 0 ? '\n【身份】' + _triId2.join(' · ') + '——言谈须体现此三重立场' : '';
    },
    // 此人与进行中诏令的关联（反对派/支持者——问对时可主动提及、抱怨、请愿）
    edictRoles: function (name) {
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
      return _edictCtx;
    },

    // ── 记忆 ──
    arcs: function (ch) {
      var arcInfo = '';
      if (GM.characterArcs && GM.characterArcs[ch.name]) {
        var _recentArcs = GM.characterArcs[ch.name].slice(-2);
        if (_recentArcs.length) arcInfo = '\n【近事】' + _recentArcs.map(function(a) { return a.desc; }).join('；').slice(0, 60);
      }
      return arcInfo;
    },
    affinity: function (ch) {
      var affInfo = '';
      if (typeof AffinityMap !== 'undefined') {
        var _topRels = AffinityMap.getRelations(ch.name).slice(0, 3);
        if (_topRels.length) affInfo = '\n【人际】' + _topRels.map(function(r) { return r.name + (r.value > 25 ? '(亲)' : r.value < -25 ? '(恶)' : ''); }).join('、');
      }
      return affInfo;
    },
    // 文事作品——此人知道自己写过什么、受过谁题赠、与谁唱和
    works: function (ch) {
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
      return worksInfo;
    },
    memory: function (ch) {
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
      return memInfo;
    },

    // ── 心里有数 ──（承诺、野心、重负三段的现成 helper 在 tm-wendui-persona-views.js，这里是它们的统一入口）
    commitments: function (ch, name) { return _wdCommitContext(ch, name); },
    ambition: function (ch) { return _wdAmbitionContext(ch); },
    burden: function (ch) { return _wdBurdenContext(ch); },
    // 此行的心事/目的（会话内能动性）
    agenda: function (ch) {
      var out = '';
      if (typeof _wdDeriveAudienceAgenda === 'function') {
        try {
          var _wdAgenda = _wdDeriveAudienceAgenda(ch);
          if (_wdAgenda && _wdAgenda.tag && _wdAgenda.tag !== 'routine' && _wdAgenda.hint) {
            out += '\n【你此次的心事/目的】' + _wdAgenda.hint + '\n  你是有备而来、心里装着事的真人——对答中相机推进：择机切入、试探圣意；皇帝态度和缓则进一步陈情/请求/规谏，不悦则收敛转圜、改日再图；切忌只被动答话、有问才答。\n';
          }
        } catch (_wdAgErr) {}
      }
      return out;
    },
    // NPC 认知画像（由 sc07 在上回合 endturn 生成·反映此人"当下知道什么、想什么"）
    cognition: function (name) {
      var out = '';
      if (typeof getNpcCognitionSnippet === 'function') {
        var _cogSnip = getNpcCognitionSnippet(name);
        if (_cogSnip) {
          out += _cogSnip;
          out += '▲ 上述认知是此人的真实信息面——不得提及 doesntKnow 中的事，也不得装作不知 knows 中的事。\n';
          out += '▲ 如被问及 doesntKnow 中事，如何处理按人物性格+五常+特质+忠志廉决定：\n';
          out += '  · 仁义清廉+信高 → 坦诚——“臣有下情，实不知此事，请陛下恕罪”\n';
          out += '  · 机巧·权变 → 敷衍转移——“此事容臣详查·且先议他事。”\n';
          out += '  · 不懂装懂类 → 模糊编造——引一段经史旧文附会，意在搪塞，其实不知所以强作解人\n';
          out += '  · 心机深沉 → 似是而非——“臣略有所闻，不敢断言，姑陈浅见。”\n';
          out += '  · 傲慢自大 → 拒答或反问——“此等小事也来问老夫，何其可笑。”\n';
          out += '  · 自卑惶恐 → 过度解释·结巴，反被看出破绽\n';
          out += '  · 武人耿直 → 直说“末将不知此事”但简练不赘\n';
          out += '  · 清高孤傲 → 既不耐烦也不掩饰，只简答为“非臣所掌，不敢妄言”\n';
        }
      }
      return out;
    }
  };

  // 人格核的结构化读法：多个来源按固定优先级合成一份（tuiyan.md 7.2「人格核只有一个来源」）。
  //   性情：traitIds 定义名 → personality；说话：speechStyle → diction；人设长文：aiPersonaText。
  //   问对照旧逐字拼它自己那版；其余机制接入（人2）时读这里，不再各拼各的。
  function core(ch) {
    if (!ch) return null;
    var str = function (v) { return v == null ? '' : String(v); };
    return {
      name: str(ch.name),
      title: str(ch.officialTitle || ch.officialPosition || ch.title),
      traits: frag.traitDesc(ch),
      stance: str(ch.stance) || '中立',
      goal: str(ch.personalGoal).slice(0, 40),
      speech: str(ch.speechStyle || ch.diction),
      personaText: str(ch.aiPersonaText),
      age: ch.age == null ? null : ch.age,
      stress: Number(ch.stress) || 0
    };
  }

  // brief(人, { occasion, topic, detail })
  //   detail:'full'（缺省）且 occasion:'wendui'：就是问对的完整提示词（_wdBuildPrompt）。
  //   detail:'full' 其他场合：人格核 + 处境 + 记忆 + 心里有数（不含任何场合规矩）。
  //   detail:'brief'：精简档——一行身份与人格核，加个人语言风格，加最要紧的心事（未了的差事、野心）。
  function brief(ch, opts) {
    opts = opts || {};
    if (!ch) return '';
    var name = opts.name || ch.name;
    if (opts.detail === 'brief') {
      var c = core(ch);
      var line = c.name + (c.title ? '(' + c.title + ')' : '') + frag.ageInfo(ch) + '：特质' + (c.traits || '未详') + '，立场' + c.stance
        + (c.goal ? '，心中所求' + c.goal : '') + frag.stressInfo(ch);
      return line + (c.speech ? '\n【个人语言风格】' + c.speech : '') + frag.commitments(ch, name) + frag.ambition(ch);
    }
    if (opts.occasion === 'wendui' && typeof root._wdBuildPrompt === 'function') return root._wdBuildPrompt(ch, name);
    var c2 = core(ch);
    var head = c2.name + (c2.title ? '(' + c2.title + ')' : '') + frag.ageInfo(ch) + '\n【人设】特质:' + c2.traits + '，立场:' + c2.stance
      + (c2.goal ? '，心中所求:' + c2.goal : '') + frag.stressInfo(ch) + '\n';
    return head
      + frag.background(ch) + frag.abilities(ch) + frag.appearance(ch)
      + frag.family(ch) + frag.identity(ch) + frag.edictRoles(name)
      + frag.arcs(ch) + frag.affinity(ch) + frag.works(ch) + frag.memory(ch)
      + frag.commitments(ch, name) + frag.ambition(ch) + frag.burden(ch) + frag.cognition(name)
      + frag.personaText(ch);
  }

  TM.Person = { frag: frag, core: core, brief: brief };
})(typeof window !== 'undefined' ? window : globalThis);
