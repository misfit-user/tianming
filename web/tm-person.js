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
    // 文化/信仰/学识/个人语言风格/民族/籍贯（opts.noSpeech：口吻已在人格核里写过，这里不再重复）
    background: function (ch, opts) {
      var p = '';
      if (ch.culture) p += '【文化】' + ch.culture + '\n';
      if (ch.faith) p += '【信仰】' + ch.faith + '\n';
      if (ch.learning) p += '【学识】' + ch.learning + '\n';
      if (ch.learning) p += '说话风格受学识影响（' + ch.learning + '）：用词和引用应体现其学识背景。\n';
      if (ch.faith) p += '说话风格受信仰影响（' + ch.faith + '）：言语中可能体现其信仰理念。\n';
      if (ch.speechStyle && !(opts && opts.noSpeech)) p += '【个人语言风格】' + ch.speechStyle + '\n';
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
    // opts.topic：按议题再回想几条原始记忆（getMemoryContext 自带的 TM.PersonalMemoryRecall）
    memory: function (ch, opts) {
      var memInfo = '';
      if (typeof NpcMemorySystem !== 'undefined') {
        var _mem = (opts && opts.topic) ? NpcMemorySystem.getMemoryContext(ch.name, { topic: opts.topic }) : NpcMemorySystem.getMemoryContext(ch.name);
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
    // 人2：开关开着时读 cognitionText（去掉与人格核重复的几行，见下），规矩里的栏名写中文；关着时逐字不变
    cognition: function (name) {
      var out = '';
      if (on()) {
        var _m = mind(name);
        return _m ? _m + '▲ 如被问及「不知」里的事，如何应对按此人性情、五常、特质与忠诚、野心、清廉定：\n' + _COG_STYLES.join('') : '';
      }
      if (typeof getNpcCognitionSnippet === 'function') {
        var _cogSnip = getNpcCognitionSnippet(name);
        if (_cogSnip) {
          out += _cogSnip;
          out += '▲ 上述认知是此人的真实信息面——不得提及 doesntKnow 中的事，也不得装作不知 knows 中的事。\n';
          out += '▲ 如被问及 doesntKnow 中事，如何处理按人物性格+五常+特质+忠志廉决定：\n';
          out += _COG_STYLES.join('');
        }
      }
      return out;
    }
  };

  // 被问到不知道的事怎么应对（问对、深问、回信这些单人深谈才写）
  var _COG_STYLES = [
    '  · 仁义清廉+信高 → 坦诚——“臣有下情，实不知此事，请陛下恕罪”\n',
    '  · 机巧·权变 → 敷衍转移——“此事容臣详查·且先议他事。”\n',
    '  · 不懂装懂类 → 模糊编造——引一段经史旧文附会，意在搪塞，其实不知所以强作解人\n',
    '  · 心机深沉 → 似是而非——“臣略有所闻，不敢断言，姑陈浅见。”\n',
    '  · 傲慢自大 → 拒答或反问——“此等小事也来问老夫，何其可笑。”\n',
    '  · 自卑惶恐 → 过度解释·结巴，反被看出破绽\n',
    '  · 武人耿直 → 直说“末将不知此事”但简练不赘\n',
    '  · 清高孤傲 → 既不耐烦也不掩饰，只简答为“非臣所掌，不敢妄言”\n'
  ];

  // ── 人2：人格核只有一个来源，各机制、各档一字不差（tuiyan.md 7.2；施工单 E:/tianming-tmp/orders/人2-各机制接人物底子-施工单.md）──
  // 开关 P.conf.personUnifiedEnabled，默认关：关着时各机制照旧各拼各的，提示词逐字不变；开着时都从这里取。
  function on() {
    try { return !!(typeof P !== 'undefined' && P && P.conf && P.conf.personUnifiedEnabled === true); } catch (_) { return false; }
  }
  function _s(v) { return v == null ? '' : String(v).trim(); }
  // 片段收尾补换行（人设长文、识别状态、记忆这几块有的不带结尾换行，后一块会粘在同一行）
  function _nl(s) { return s && s.charAt(s.length - 1) !== '\n' ? s + '\n' : s; }
  function _vals(x) {
    if (Array.isArray(x)) return x;
    return x && typeof x === 'object' ? Object.keys(x).map(function (k) { return x[k]; }) : [];
  }
  function titleOf(ch) { return _s(ch.officialTitle || ch.officialPosition || ch.title); }
  // 特质：traitIds 与 traits 里认得出的定义名，去重，traitIds 在前。认不出的，含汉字的照写，纯英文代号不写
  //   （剧本里的 traits 多是定义外的代号：天启 636 个里 292 个、绍宋 809 个里 705 个认不出）。
  function traitNames(ch) {
    var defs = (typeof P !== 'undefined' && P && Array.isArray(P.traitDefinitions)) ? P.traitDefinitions : [];
    var out = [], seen = {};
    var ids = [].concat(Array.isArray(ch.traitIds) ? ch.traitIds : [], Array.isArray(ch.traits) ? ch.traits : []);
    ids.forEach(function (raw) {
      var id = _s(raw && typeof raw === 'object' ? (raw.id || raw.name) : raw);
      if (!id) return;
      var def = null;
      for (var i = 0; i < defs.length; i++) { if (defs[i] && defs[i].id === id) { def = defs[i]; break; } }
      var name = def && def.name ? _s(def.name) : (/[\u4e00-\u9fff]/.test(id) ? id : '');
      if (name && !seen[name]) { seen[name] = 1; out.push(name); }
    });
    return out;
  }
  // 几段并成一句用「；」隔开，前一段已以句末标点收尾时不再加（免得「破东林。；口吻」）
  var _END_PUNCT = /[。！？；…」』）)]$/;
  function _joinBits(bits) {
    return bits.reduce(function (acc, b) { return acc ? acc + (_END_PUNCT.test(acc) ? '' : '；') + b : b; }, '');
  }

  // ── 认知画像：sc07 过回合时给要紧人物写的（GM._npcCognition），片段由 getNpcCognitionSnippet 拼 ──
  // 开关开着时人格只认人格核（11-09 同志定）：
  //   · 画像里的自识、人格、口吻与人格核重复，不再另写。实验跑的那一回合，22 人的画像人格没有一句照抄剧本，
  //     有的写成了另一个人（杨所修剧本口吻「辞锋尖刻」，画像口吻「语带两可、当面恭顺」）。
  //     剧本没写性情、口吻的，才拿画像那句补进人格核（temperOf、speechText），补进去也是各档一样。
  //   · 史标是模型照史书写的身后评语，会把游戏时间之后的事带进来（温体仁那条是「崇祯朝首辅」），也不写。
  //   · 画像的「所求」是眼下所图，改个名，免得和人格核的【所求】（毕生所求）相混。
  //   · 剩下的（心念、对帝、知与不知、心境……）精简档、完整档读同一段：两档只差资料多少，不差他知道什么。
  var _COG_DROP = /^(自识|人格|口吻|史标)：/;
  var _COG_RULE = '▲ 上面是此人眼下真知道的：「不知」里的事不得提及，「知」里的事也不得装作不知。\n';
  function _cog(name) {
    try { return (typeof GM !== 'undefined' && GM && GM._npcCognition && name && GM._npcCognition[name]) || null; } catch (_) { return null; }
  }
  function cognitionText(name) {
    var s = '';
    try { s = (typeof getNpcCognitionSnippet === 'function' && getNpcCognitionSnippet(name)) || ''; } catch (_) { s = ''; }
    var body = 0;
    var lines = String(s).split('\n').filter(function (ln) { return !_COG_DROP.test(ln); }).map(function (ln) {
      if (ln && ln.charAt(0) !== '【') body++;
      return ln.indexOf('所求：') === 0 ? '眼下所图：' + ln.slice(3) : ln;
    });
    // 知三条、不知两条在片段里用「；」连，条目本以句号收尾时去掉多出的分号
    return body ? lines.join('\n').replace(/([。！？])；/g, '$1') : '';
  }
  // 知与不知两栏（与认知画像同取知三条、不知两条）：名单里由模型替人执笔时用（奏疏）
  function knowing(name) {
    var c = _cog(name);
    if (!c) return '';
    var k = (Array.isArray(c.knows) ? c.knows : []).slice(0, 3).map(_s).filter(Boolean);
    var d = (Array.isArray(c.doesntKnow) ? c.doesntKnow : []).slice(0, 2).map(_s).filter(Boolean);
    return _joinBits([k.length ? '知：' + _joinBits(k) : '', d.length ? '不知：' + _joinBits(d) : ''].filter(Boolean));
  }
  // 眼下所知所想：认知画像（去掉与人格核重复的几行）＋知与不知的规矩。精简档、完整档读的都是这一段；
  //   处境、记忆另按自己结构列出的场合（NPC 自主、势力调度的「本人」）单取这一段（人2-7）
  function mind(name) {
    var cog = cognitionText(name);
    return cog ? cog + _COG_RULE : '';
  }
  // 性情：剧本的 personality；剧本没写，才拿认知画像那句人格补上
  function temperOf(ch) {
    var t = _s(ch.personality);
    if (t) return t;
    var c = _cog(ch.name);
    return c ? _s(c.personalityCore) : '';
  }

  // 口吻：speechStyle 为主；diction 不同、又互不包含时接在后面（晚唐两样全同，天启 132 人里 99 人相同）。
  //   两样都没有，才拿认知画像那句口吻补上
  function speechText(ch) {
    var a = _s(ch.speechStyle), b = _s(ch.diction);
    if (!a && !b) { var c = _cog(ch.name); return c ? _s(c.speechThread) : ''; }
    if (!a) return b;
    if (!b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return a;
    return _joinBits([a, b]);
  }
  // 人格核：他是谁。立场与所求相同只写所求（晚唐 434 人里 433 人两栏相同）。
  function coreText(ch) {
    if (!ch) return '';
    var title = titleOf(ch), stress = Number(ch.stress) || 0;
    // 性情原文里已有的字眼，特质里不再重写（魏忠贤性情有「睚眦必报」，特质 vengeful 的定义名也是它）
    var temper = temperOf(ch), traits = traitNames(ch).filter(function (n) { return temper.indexOf(n) < 0; });
    var stance = _s(ch.stance), goal = _s(ch.personalGoal), speech = speechText(ch);
    var temperLine = _joinBits([temper, traits.length ? '特质：' + traits.join('、') : ''].filter(Boolean));
    return '【人物】' + _s(ch.name) + (title ? '（' + title + '）' : '') + (_s(ch.age) ? '，年' + _s(ch.age) : '')
      + (stress > 30 ? '，当前压力' + stress + '（' + (stress > 60 ? '濒临崩溃' : '焦虑不安') + '）' : '') + '\n'
      + (temperLine ? '【性情】' + temperLine + '\n' : '')
      + (stance && stance !== goal ? '【立场】' + stance + '\n' : '')
      + (goal ? '【所求】' + goal + '\n' : '')
      + (speech ? '【口吻】' + speech + '\n' : '');
  }
  // 处境一行：势力、党派、阶层、家族，忠诚、清廉、野心（官职已在人格核里）
  function situationLine(ch) {
    var bits = [], nums = [];
    if (_s(ch.faction)) bits.push('势力：' + _s(ch.faction));
    if (_s(ch.party)) bits.push('党派：' + _s(ch.party));
    if (_s(ch.class)) bits.push('阶层：' + _s(ch.class));
    if (ch.family) bits.push('家族：' + (typeof ch.family === 'string' ? ch.family : '世家'));
    if (typeof ch.loyalty === 'number') nums.push('忠诚' + ch.loyalty);
    if (typeof ch.integrity === 'number') nums.push('清廉' + ch.integrity);
    if (typeof ch.ambition === 'number') nums.push('野心' + ch.ambition);
    if (nums.length) bits.push(nums.join('·'));
    return bits.length ? '【处境】' + bits.join('｜') + '\n' : '';
  }
  // 完整档另加：阶层诉求、同族
  function situationMore(ch) {
    var out = '';
    if (_s(ch.class) && typeof GM !== 'undefined' && GM) {
      var cls = _vals(GM.classes).filter(function (c) { return c && c.name === ch.class; })[0];
      if (cls && _s(cls.demands)) out += '【阶层诉求】' + _s(cls.demands).slice(0, 40) + '\n';
    }
    if (typeof ch.family === 'string' && ch.family && typeof GM !== 'undefined' && GM) {
      var clan = (GM.chars || []).filter(function (c) { return c && c.alive !== false && c.name !== ch.name && c.family === ch.family; });
      if (clan.length) out += '【同族】' + clan.slice(0, 3).map(function (c) { return c.name; }).join('、') + '\n';
    }
    return out;
  }
  // 名单一行：全知提示词里列一群人时用。opts.noName：名单自己已写了名字官职，只要冒号后面那半句；
  // opts.speech：名单里的人要由模型替他执笔（如奏疏一次写好几份），末尾再带口吻；opts.knows：再带知与不知
  function line(ch, opts) {
    if (!ch) return '';
    var max = (opts && opts.goalMax) || 30;
    var title = titleOf(ch), temper = temperOf(ch), goal = _s(ch.personalGoal);
    var traits = traitNames(ch).filter(function (n) { return temper.indexOf(n) < 0; });
    var bits = [];
    if (temper) bits.push(temper);
    if (traits.length) bits.push('特质' + traits.join('、'));
    if (goal) bits.push('所求' + (goal.length > max ? goal.slice(0, max) + '…' : goal));
    if (opts && opts.speech && speechText(ch)) bits.push('口吻' + speechText(ch));
    if (opts && opts.knows && knowing(ch.name)) bits.push(knowing(ch.name));
    if (opts && opts.noName) return _joinBits(bits);
    return _s(ch.name) + (title ? '（' + title + '）' : '') + (bits.length ? '：' + _joinBits(bits) : '');
  }

  // 他是谁：人格核＋人设长文（含识别状态）。给那些处境、记忆、承诺已经按自己的结构另行列出的场合用
  //   （如 NPC 自主决策的 JSON 上下文），免得完整档把这些再抄一遍。
  function who(ch) {
    if (!ch) return '';
    return _nl(coreText(ch) + _nl(frag.personaText(ch)));
  }

  // 人格核的结构化读法。traits/speech/goal 三项是问对（人1）那版；人2 的统一读法看 temper/traitNames/speechFull/goalFull。
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
      stress: Number(ch.stress) || 0,
      temper: temperOf(ch),
      traitNames: traitNames(ch),
      speechFull: speechText(ch),
      goalFull: _s(ch.personalGoal)
    };
  }

  // brief(人, { occasion, topic, detail, name })
  //   detail:'full'（缺省）且 occasion:'wendui'：就是问对的完整提示词（_wdBuildPrompt）。
  //   detail:'full' 其他场合（书信、御前深问、势力首领）：人格核 + 人设长文 + 处境 + 背景 + 记忆 + 心里有数 + 认知画像与应对规矩。
  //   detail:'brief'（常朝、廷议、御前直陈、朝议插话，一场好几个人、每人一次调用）：人格核 + 人设长文 + 处境一行 + 记忆
  //     + 承诺、野心 + 认知画像（与完整档同一段，只少被问到不知之事怎么应对那几条）。
  //   detail:'line'：名单一行。
  //   都不含场合规矩（怎么说、对谁说、返回格式归各机制）。
  // 片段只有【标题】没有内容时不写（交办凭据的 helper 在 TM.ImperialOrders 在时总带标题，哪怕此人什么交办都没有）。
  // 只用在下面的精简档、完整档；问对原样调 frag，不受影响。
  function _filled(s) { return s && String(s).replace(/【[^】]*】/g, '').trim() ? s : ''; }
  function brief(ch, opts) {
    opts = opts || {};
    if (!ch) return '';
    var name = opts.name || ch.name;
    var memOpts = opts.topic ? { topic: opts.topic } : null;
    if (opts.detail === 'line') return line(ch, opts);
    if (opts.detail === 'brief') {
      return _nl(coreText(ch) + _nl(frag.personaText(ch)) + situationLine(ch)
        + frag.memory(ch, memOpts) + _filled(frag.commitments(ch, name)) + frag.ambition(ch) + mind(name));
    }
    if (opts.occasion === 'wendui' && typeof root._wdBuildPrompt === 'function') return root._wdBuildPrompt(ch, name);
    return _nl(coreText(ch) + _nl(frag.personaText(ch)) + situationLine(ch) + situationMore(ch) + frag.edictRoles(name)
      + frag.background(ch, { noSpeech: true }) + frag.abilities(ch) + frag.appearance(ch)
      + frag.memory(ch, memOpts) + frag.arcs(ch) + frag.affinity(ch) + frag.works(ch)
      + _filled(frag.commitments(ch, name)) + frag.ambition(ch) + frag.burden(ch) + frag.cognition(name));
  }

  TM.Person = { frag: frag, core: core, brief: brief, coreText: coreText, who: who, traitNames: traitNames, speechText: speechText, line: line, on: on,
    cognitionText: cognitionText, knowing: knowing, mind: mind };
})(typeof window !== 'undefined' ? window : globalThis);
