// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-edict.js — 诏令处理子系统
//
// R88 从 tm-endturn.js §B 抽出·2 个 cluster：
//   Cluster 1 (原 L3497-3869): extractEdictActions / _findPositionInOfficeTree /
//                              applyEdictActions / extractCustomPolicies /
//                              applyCustomPolicies / getCustomPolicyContext
//   Cluster 2 (原 L4081-4190): computeExecutionPipeline / processEdictEffects
//
// 所有函数保持 function xxx() 顶级声明·挂在 window 上·调用方无需改
//
// 加载顺序：必须在 tm-endturn.js 之前（index.html 顺序已调整）
// ============================================================

function extractEdictActions(edictText) {
  if (!edictText || edictText.length < 4) return { appointments: [], dismissals: [], deaths: [], rewards: [], armyBuilds: [], payArrears: [], pardons: [] };
  var actions = { appointments: [], dismissals: [], deaths: [], rewards: [], armyBuilds: [], payArrears: [], pardons: [] };
  var text = edictText.replace(/\s+/g, '');

  // 预构建已知姓名集（含字号）——用于扫名优先
  var knownChars = [];
  var knownMap = {};
  (GM.chars || []).forEach(function(c) {
    if (!c || !c.name) return;
    if (!knownMap[c.name]) { knownMap[c.name] = c.name; knownChars.push(c.name); }
    ['zi','haoName','milkName'].forEach(function(k){
      if (c[k] && c[k].length >= 2 && !knownMap[c[k]]) { knownMap[c[k]] = c.name; knownChars.push(c[k]); }
    });
    if (Array.isArray(c.aliases)) c.aliases.forEach(function(a){
      if (a && a.length >= 2 && !knownMap[a]) { knownMap[a] = c.name; knownChars.push(a); }
    });
  });
  // 长名优先避免"张惟" 遮挡 "张惟贤"
  knownChars.sort(function(a,b){ return b.length - a.length; });
  var knownRx = knownChars.length ? new RegExp('(' + knownChars.map(function(n){return n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|') + ')', 'g') : null;

  // 已知职位（从 officeTree 收集）——用于更精确的 position 边界识别
  var knownPosts = [];
  function _collectPosts(nodes) {
    (nodes||[]).forEach(function(n){
      if (!n) return;
      (n.positions||[]).forEach(function(p){ if (p && p.name && knownPosts.indexOf(p.name)<0) knownPosts.push(p.name); });
      if (n.subs) _collectPosts(n.subs);
    });
  }
  _collectPosts(GM.officeTree || []);
  knownPosts.sort(function(a,b){ return b.length - a.length; });

  function _findKnownPosition(raw) {
    if (!raw) return null;
    // 先找含已知职位的最长子串
    for (var i=0; i<knownPosts.length; i++) {
      if (raw.indexOf(knownPosts[i]) >= 0) return knownPosts[i];
    }
    // 否则返回首尾剥掉标点的原串
    return raw.replace(/[，。、的之至]/g, '');
  }

  // ═══ 任命模式（扩展动词表 + 非贪婪 + 已知名字锚定） ═══
  // 动词：任/命/擢/拜/召/授/令/起用/起复/加/封/册/迁/进/升/改任/转/除
  var appointVerbs = '(?:任命|擢升|擢任|擢拜|改任|起用|起复|授任|着任|特命|特授|授|命|令|擢|拜|召|迁|进|升|加|封|册封|册立|加封|除授|除|转)';
  var appointLinks = '(?:为|任|出任|担任|兼任|兼|领|主|掌|督|统|行|权|摄)';
  var appointPatterns = [
    // 兼任/加兼：命 X 以旧职加兼新职 / X 兼任新职
    new RegExp('(?:命|令|着|使|诏)?([\\u4e00-\\u9fa5]{2,6}?)(?:以[\\u4e00-\\u9fa5]{2,14})?(?:加兼|兼任|兼职|兼领|兼署|兼管|兼摄|兼)([\\u4e00-\\u9fa5]{2,14})', 'g'),
    // V + 名 + 连接词 + 职
    new RegExp(appointVerbs + '([\\u4e00-\\u9fa5]{2,6}?)' + appointLinks + '([\\u4e00-\\u9fa5]{2,14})', 'g'),
    // 着/令 + 名 + 职（无连接词·如"着韩爌内阁首辅"）
    new RegExp('(?:着|令|使)([\\u4e00-\\u9fa5]{2,6}?)((?:内阁|翰林|都察|五军|六部|中书|礼部|户部|吏部|兵部|刑部|工部|司礼|锦衣|光禄|太仆|鸿胪|国子)[\\u4e00-\\u9fa5]{2,12})', 'g'),
    // 名 + 连接词 + 职（"韩爌出任首辅"）
    new RegExp('([\\u4e00-\\u9fa5]{2,6}?)(?:出任|担任|兼任|调任|迁任|转任|就任)([\\u4e00-\\u9fa5]{2,14})', 'g')
  ];
  var _appointSet = {};
  appointPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、的]/g, '');
      var rawPos = m[2].replace(/[，。、]/g, '');
      // 已知名字匹配 — 若原 regex 截长了·取最末的已知名
      var char = rawName;
      if (knownChars.length) {
        var best = null;
        for (var i=0; i<knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { best = knownChars[i]; break; }
        }
        if (best) char = knownMap[best]; // 字号→主名
      }
      // 已知职位匹配
      var pos = _findKnownPosition(rawPos);
      if (char.length < 2 || pos.length < 2) continue;
      var key = char + '→' + pos;
      if (_appointSet[key]) continue;
      _appointSet[key] = true;
      actions.appointments.push({
        character: char,
        position: pos,
        concurrent: (typeof _offIsConcurrentAppointment === 'function')
          ? _offIsConcurrentAppointment({ raw: m[0] }, m[0])
          : /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(m[0])
      });
    }
  });

  // ═══ 免职模式 ═══
  var dismissVerbs = '(?:免去|罢免|革去|撤去|免职|撤职|革职|削职|黜|罢|削|贬|黜陟|谪|戍|贬谪|着革|着免)';
  var dismissPatterns = [
    new RegExp(dismissVerbs + '([\\u4e00-\\u9fa5]{2,6}?)(?:的|之)?([\\u4e00-\\u9fa5]{0,14})', 'g'),
    new RegExp('([\\u4e00-\\u9fa5]{2,6}?)(?:免职|去职|撤职|革职|削职|下狱)', 'g')
  ];
  var _dismissSet = {};
  dismissPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、的之]/g, '');
      var char = rawName;
      if (knownChars.length) {
        for (var i=0; i<knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { char = knownMap[knownChars[i]]; break; }
        }
      }
      if (char.length < 2 || _dismissSet[char]) continue;
      _dismissSet[char] = true;
      actions.dismissals.push({ character: char, position: m[2] ? m[2].replace(/[，。、]/g, '') : '' });
    }
  });
  if (actions.appointments.length && actions.dismissals.length) {
    var _appointedNames = {};
    actions.appointments.forEach(function(a){ if (a && a.character) _appointedNames[a.character] = true; });
    actions.dismissals = actions.dismissals.filter(function(d){ return !(d && d.character && _appointedNames[d.character]); });
  }

  // ═══ 赦免/起复/官复原职 模式（治玩家报"下诏放人/官复原职没用"·此前诏令解析无释放类→全靠 LLM）═══
  //   release: 释放/赦免/开释/出狱/昭雪/平反 → 确定性清 _imprisoned/_exiled 等羁束
  //   restore: 官复原职/复职/起复/复用 → 额外从下狱时保存的 _origOfficialTitle 复官并回座 officeTree
  //   只认已知在册人物(避免"大赦天下"把"天下"当人)
  var _pardonReleaseVerbs = '(?:无罪开释|赦免释放|昭雪平反|赦免|大赦|开释|释放|昭雪|平反|雪冤|宽宥|宥免|免罪|出狱|省释|贷罪)';
  var _pardonRestoreVerbs = '(?:官复原职|官复原任|复其原官|复原官|仍任原职|照旧供职|起复任用|起复|复职|复用)';
  var _pardonPatterns = [
    { restore: false, rx: new RegExp(_pardonReleaseVerbs + '([\\u4e00-\\u9fa5]{2,6})', 'g') },
    { restore: false, rx: new RegExp('([\\u4e00-\\u9fa5]{2,6}?)(?:无罪开释|昭雪平反|昭雪|平反|获释|开释|出狱|获赦)', 'g') },
    { restore: true,  rx: new RegExp(_pardonRestoreVerbs + '([\\u4e00-\\u9fa5]{2,6})', 'g') },
    { restore: true,  rx: new RegExp('([\\u4e00-\\u9fa5]{2,6}?)(?:官复原职|官复原任|复其原官|复原官|复职|起复)', 'g') }
  ];
  var _pardonSet = {};
  _pardonPatterns.forEach(function(pp) {
    var m;
    while ((m = pp.rx.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、的之]/g, '');
      var char = rawName;
      if (knownChars.length) {
        for (var i=0; i<knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { char = knownMap[knownChars[i]]; break; }
        }
      }
      if (char.length < 2) continue;
      // 只对在册真实人物记赦免(避免"大赦天下"等误捕)
      if (!(GM.chars || []).some(function(c){ return c && c.name === char; })) continue;
      if (_pardonSet[char]) { if (pp.restore) _pardonSet[char].restore = true; continue; }
      var rec = { character: char, restore: !!pp.restore };
      _pardonSet[char] = rec;
      actions.pardons.push(rec);
    }
  });
  // "赦免X，官复原职"中"官复原职"常不紧跟人名(指代前文)→仅当【全诏只赦免一人】时才整体升级为复职·
  //   多人诏(如"释放魏忠贤，起复卢象升，官复原职")不整体升级·免把只求释放的魏忠贤也误复官·
  //   多人各自的复职由上面 pattern3/4(动词紧邻人名·如"起复卢象升")精确绑定。
  if (actions.pardons.length === 1 && /官复原职|官复原任|复其原官|复原官|复职|起复|复用|仍任原职|照旧供职/.test(text)) {
    actions.pardons[0].restore = true;
  }

  // ═══ 赏赐/犒赏/封赏/加俸 模式（玩家亲自施恩·确定性抬该员 loyalty+affinity·不靠 AI 心情）═══
  //   动词避开"赐死/赐自尽"等致死语(那是 deaths)·只认明确的恩赏词；名靠 knownChars salvage 兜回主名
  var rewardVerbs = '(?:犒赏|犒劳|犒军|赏赐|赐赏|颁赏|封赏|加俸|增俸|厚俸|进秩|进阶|加衔|加官进爵|恩赏|厚赏|优叙|嘉奖|褒奖|嘉勉|赉|赍)';
  var rewardPatterns = [
    new RegExp(rewardVerbs + '([\\u4e00-\\u9fa5]{2,8}?)(?:[，。、！；以银金帛钞田宅爵物功]|$)', 'g'),
    new RegExp('([\\u4e00-\\u9fa5]{2,6}?)(?:受赏|获赏|蒙赏|受犒|获犒|蒙恩赏|加俸|进秩|进阶)', 'g')
  ];
  var _rewardSet = {};
  rewardPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、的之]/g, '');
      var char = rawName;
      if (knownChars.length) {
        for (var i = 0; i < knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { char = knownMap[knownChars[i]]; break; }
        }
      }
      if (char.length < 2 || _rewardSet[char]) continue;
      _rewardSet[char] = true;
      actions.rewards.push({ character: char });
    }
  });

  // ═══ 赐死模式 ═══
  var deathPatterns = [
    /(?:赐死|赐予自尽|处死|处斩|斩首|诛杀|赐鸩|赐自尽|磔死|弃市|斩于市|着自尽|令自裁)([\u4e00-\u9fa5]{2,6}?)(?:[。，、！]|$)/g,
    /(?:赐死|赐予自尽|处死|处斩|斩首|诛杀|赐鸩)([\u4e00-\u9fa5]{2,6})/g
  ];
  var _deathSet = {};
  // P-诛逆·B：诏书写明通敌/资敌/汉奸/卖国/谋逆等罪名 → 标 treasonCited，handler 据此给皇威（诛逆立威）。
  //   质判定：认玩家在诏书里 declared 的罪名（yes/no），不替玩家脑补忠奸；朝代中立（认通用奸佞罪名词，不写死朝代）。
  var _treasonCited = /(通敌|通虏|通虜|资敌|資敵|资虏|汉奸|漢奸|卖国|賣國|谋逆|謀逆|叛国|叛國|里通外|私通后金|私通建|私通敌|私通虏|内奸|奸细|細作|通番|资寇|通寇|卖主求荣|通虏卖国)/.test(text);
  deathPatterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(text)) !== null) {
      var rawName = m[1].replace(/[，。、]/g, '');
      var char = rawName;
      if (knownChars.length) {
        for (var i=0; i<knownChars.length; i++) {
          if (rawName.indexOf(knownChars[i]) >= 0) { char = knownMap[knownChars[i]]; break; }
        }
      }
      if (char.length < 2 || _deathSet[char]) continue;
      _deathSet[char] = true;
      actions.deaths.push({ character: char, treasonCited: _treasonCited });
    }
  });

  // ═══ 建军/组建新军 模式（确定性落名册·宁缺毋滥）═══
  //   只认明确"创建"动词 + 军名后缀，避免把"调某军/提到某军"误判成建军；已在册同名军视作扩编留给 AI。
  //   兵力规模与招募成本不在此定：诏书写明则解析备用、没写交回合内 sc18 军事推演 AI 估（确定性层只保"军必入册"）。
  function _bldCnNum(s) {
    if (!s) return null;
    if (/^[0-9]+$/.test(s)) return parseInt(s, 10);
    var map = { '零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
    var unit = { '十':10,'百':100,'千':1000,'万':10000,'亿':100000000 };
    var total = 0, section = 0, num = 0, ok = false;
    for (var _ci = 0; _ci < s.length; _ci++) {
      var _ch = s.charAt(_ci);
      if (map[_ch] != null) { num = map[_ch]; ok = true; }
      else if (unit[_ch] != null) {
        ok = true; var _u = unit[_ch];
        if (_u >= 10000) { section = (section + (num || 0)) * _u; total += section; section = 0; }
        else { section += (num === 0 ? 1 : num) * _u; }
        num = 0;
      } else if (/[0-9]/.test(_ch)) { num = num * 10 + parseInt(_ch, 10); ok = true; }
      else { return null; }
    }
    var _r = total + section + num;
    return ok && _r > 0 ? _r : null;
  }
  var _buildVerbs = '(?:组建|新建|新设|增设|增置|设立|创设|创立|创建|筹建|编练|编组|编立|建立)';
  var _armySuffix = '(?:军|营|卫|镇|师|标|旅|水师|铁骑|马队|乡勇|团练|新军)';
  var _buildPat = new RegExp(_buildVerbs + '([\\u4e00-\\u9fa5]{2,8}?' + _armySuffix + ')', 'g');
  var _buildSet = {};
  var _bm;
  while ((_bm = _buildPat.exec(text)) !== null) {
    var _aName = _bm[1].replace(/[，。、]/g, '');
    if (_aName.length < 2 || _buildSet[_aName]) continue;
    if (/[以为令着调率充及与并]/.test(_aName)) continue;   // 含跨句标记 → 非军名·弃
    var _existsArmy = (GM.armies || []).some(function(a) {
      if (!a || !a.name) return false;
      return a.name === _aName || a.name.indexOf(_aName) >= 0 || _aName.indexOf(a.name) >= 0;
    });
    if (_existsArmy) continue;                              // 已在册 → 扩编/调动·留给 AI
    _buildSet[_aName] = true;
    var _win = text.slice(_bm.index, _bm.index + 48);
    var _numM = _win.match(/([0-9]{2,8}|[一二两三四五六七八九十百千万亿]{1,7})(?:名|人|兵|众|卒|骑|马步)/);
    var _strength = _numM ? _bldCnNum(_numM[1]) : null;
    var _special = (text.slice(_bm.index).split(/[。；！\n]/)[0] || '').slice(0, 50);
    actions.armyBuilds.push({ name: _aName, strength: _strength, special: _special });
  }

  // ═══ 补饷/发饷 模式（确定性结算欠饷·apply 时走 settleArmyArrears 真扣国库）═══
  //   只认明确"发/补/拨…饷"动宾·避免把"欠饷三月"这种纯陈述误判成补饷指令。target：点名某军 / 全军·九边·边军 等泛指。
  var _payIntentRx = /(?:补发|补给|补|发放|发|拨给|拨发|拨|关给|关|给|清还|清偿|清)[一-龥]{0,4}?(?:欠饷|积欠军饷|积欠饷银|军饷|饷银|月饷|饷)/;
  // 否定门(2026-07-04 审查定罪)：「暂停发放军饷」的"发…饷"曾被裸匹配成给全军结清欠饷
  var _payNeg = /(暂停|停发|缓发|停放|不发|停支|缓支|欠着)[一-龥]{0,4}?(欠饷|军饷|饷银|月饷|饷)/;
  if (_payIntentRx.test(text) && !_payNeg.test(text)) {
    var _payAll = /九边|全军|各军|诸军|三军|各镇|诸镇|边军|各营|众军|诸营/.test(text);
    // 点名军：roster-anchored——只认确实在册、且名字出现在诏书里的军（避免从动词/连词里抠出假军名）
    var _payNames = {};
    (GM.armies || []).forEach(function(a) {
      if (a && a.name && String(a.name).length >= 2 && text.indexOf(a.name) >= 0) _payNames[a.name] = true;
    });
    var _payNameList = Object.keys(_payNames);
    // 有补饷意图但既没点名也没泛指 → 默认补所有欠饷军（"着户部发饷"泛指）
    actions.payArrears.push({ all: _payAll || _payNameList.length === 0, names: _payNameList });
  }

  if (actions.appointments.length || actions.dismissals.length || actions.deaths.length || actions.armyBuilds.length || actions.payArrears.length) {
    _dbg('[Edict] 从诏令提取:', JSON.stringify(actions));
  }
  return actions;
}

/** 在 officeTree 中按职位名（模糊/后缀）找到第一个 position 对象（并返回其父节点路径用于记录）*/
function _findPositionInOfficeTree(posName) {
  if (!posName || !GM.officeTree) return null;
  var found = null;
  function walk(nodes, deptPath) {
    (nodes || []).forEach(function(n) {
      if (found) return;
      if (!n) return;
      var dp = (deptPath ? deptPath + '·' : '') + (n.name || '');
      (n.positions || []).forEach(function(p) {
        if (found || !p || !p.name) return;
        // 精确匹配
        if (p.name === posName) { found = { pos: p, deptPath: dp }; return; }
      });
      // 再做一次模糊匹配（包含关系）
      if (!found) {
        (n.positions || []).forEach(function(p) {
          if (found || !p || !p.name) return;
          if (p.name.indexOf(posName) >= 0 || posName.indexOf(p.name) >= 0) {
            found = { pos: p, deptPath: dp };
          }
        });
      }
      if (!found && n.subs) walk(n.subs, dp);
    });
  }
  walk(GM.officeTree, '');
  return found;
}

/** 执行从诏令中提取的操作（在AI推演前执行，确保状态一致） */
function applyEdictActions(actions) {
  if (!actions) return;
  var appointedThisEdict = {};
  (actions.appointments || []).forEach(function(a){
    if (a && a.character) appointedThisEdict[a.character] = true;
  });
  if (Array.isArray(actions.dismissals) && actions.dismissals.length) {
    actions.dismissals = actions.dismissals.filter(function(a){
      if (!a || !a.character || !appointedThisEdict[a.character]) return true;
      if (typeof addEB === 'function') addEB('人事', a.character + '免旧职并入升迁，不另作罢黜', { credibility: 'high' });
      return false;
    });
  }
  // 任命——双路径查找：postSystem.posts（动态岗位）+ officeTree（静态官制）
  actions.appointments.forEach(function(a) {
    var char = findCharByName(a.character);
    if (!char) {
      addEB('人事', '诏欲任' + a.character + '为' + a.position + '·然朝无此人（待甄进）');
      return;
    }
    var done = false;
    // Path 1: postSystem 动态岗位（地方封疆大员等）
    if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts && GM.postSystem.posts.length) {
      var post = null;
      GM.postSystem.posts.forEach(function(p) { if (!post && p.name === a.position) post = p; });
      if (post) {
        PostTransfer.seat(post.id, a.character, '玩家诏令');
        if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'appointment', '奉诏就任' + a.position);
        if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) {
          if (char) CorruptionEngine.markAsRecentAppointment(char);
        }
        addEB('人事', a.character + '奉诏就任' + a.position, { credibility: 'high' });
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 5, '被委以重任');
        done = true;
      }
    }
    // Path 2: 主路径 — officeTree 中找 position.name 并直接改 holder（这是游戏内官制的真正来源）
    if (!done) {
      var hit = _findPositionInOfficeTree(a.position);
      if (hit) {
        var prevHolder = hit.pos.holder || ((typeof _offAllHolders === 'function' && _offAllHolders(hit.pos)[0]) || '');
        var isConcurrent = !!a.concurrent || (typeof _offIsConcurrentAppointment === 'function' && _offIsConcurrentAppointment(a, a.raw || ''));
        if (!isConcurrent && typeof _offVacateByCharName === 'function') {
          try { _offVacateByCharName(a.character, 'edict-appointment'); } catch(_vacE) {}
        }
        if (typeof _offSeatPersonInPosition === 'function') {
          _offSeatPersonInPosition(hit.pos, a.character, { oldHolder: prevHolder, replace: true });
        } else if (typeof _offAppointPerson === 'function') {
          if (prevHolder && prevHolder !== a.character && typeof _offDismissPerson === 'function') _offDismissPerson(hit.pos, prevHolder);
          _offAppointPerson(hit.pos, a.character);
        } else {
          hit.pos.holder = a.character;
        }
        // 更新 char 元数据
        if (typeof _offAddCharOfficeTitle === 'function') {
          _offAddCharOfficeTitle(char, a.position, { concurrent: isConcurrent });
        } else if (!isConcurrent || !char.officialTitle) {
          char.officialTitle = a.position;
          char.position = a.position;
        }
        if (!char.careerHistory) char.careerHistory = [];
        char.careerHistory.push({ turn: GM.turn, event: (isConcurrent ? '奉诏加兼 ' : '奉诏就任 ') + a.position + '（' + hit.deptPath + '）' });
        // 前任记录
        if (prevHolder && prevHolder !== a.character) {
          var prevCh = findCharByName(prevHolder);
          if (prevCh) {
            prevCh._displaced = { from: a.position, by: a.character, turn: GM.turn };
            // 单一真相源·robust 让位:啰嗦/异写旧衔精确清不掉→派生回座 ghost·按座撤衔(回退精确)
            var _edVac = (typeof _offVacateCharFromSeat === 'function') && _offVacateCharFromSeat(prevCh, (String(hit.deptPath || '').split(/[·\/]/).pop() || ''), (hit.pos && hit.pos.name) || a.position);
            if (!_edVac) {
              if (typeof _offRemoveCharOfficeTitle === 'function') _offRemoveCharOfficeTitle(prevCh, a.position);
              else if (prevCh.officialTitle === a.position) { prevCh.officialTitle = ''; prevCh.title = ''; }
            }
            // ⑤ 确定性夺位党争:被夺位者生怨(loyalty 降·stress 升)·对接替者积怨(AffinityMap)·跨党倾轧更烈
            var _crossParty = !!(prevCh.party && char.party && prevCh.party !== char.party);
            var _dpLoss = _crossParty ? 6 : 4;
            if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(prevCh, -_dpLoss, '被夺去' + a.position + '之位', { source: 'edict-displaced', oncePerTurn: true });
            else prevCh.loyalty = Math.max(0, ((typeof prevCh.loyalty === 'number' && isFinite(prevCh.loyalty)) ? prevCh.loyalty : 50) - _dpLoss);
            prevCh.stress = Math.max(0, Math.min(100, (prevCh.stress || 0) + (_crossParty ? 12 : 8)));
            if (typeof AffinityMap !== 'undefined') AffinityMap.add(prevHolder, a.character, _crossParty ? -20 : -15, '被其取代·夺位之怨');
            if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(prevHolder, '被' + a.character + '夺去' + a.position + '之位' + (_crossParty ? '（党争倾轧）' : ''), '怨', _crossParty ? 7 : 5, a.character);
          }
        }
        // 官职公库 currentHead 跟着换
        if (hit.pos.publicTreasury) hit.pos.publicTreasury.currentHead = a.character;
        if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'appointment', '奉诏就任' + a.position);
        // ★2026-07-04 交互双向性·受任者留一条"奉诏就任"知情记忆(imp7)·此前只进 careerHistory/arc/AffinityMap 不入 _memory→推演看不到这桩定义性擢升。relatedPerson=天子(玩家)
        if (typeof NpcMemorySystem !== 'undefined') { try { NpcMemorySystem.remember(a.character, '奉诏' + (isConcurrent ? '加兼' : '就任') + a.position, '敬', 7, (P.playerInfo && P.playerInfo.characterName) || '天子', { source: 'witnessed', type: 'career', _noMirror: true }); } catch(_apM) {} }
        if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.markAsRecentAppointment) CorruptionEngine.markAsRecentAppointment(char);
        addEB('人事', a.character + (isConcurrent ? '奉诏加兼' : '奉诏就任') + a.position + '（' + hit.deptPath + '）', { credibility: 'high' });
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 5, '被委以重任');
        // ★ 远地角色启动赴任行程
        if (char.location) {
          var _capE = GM._capital || '京师';
          var _destE = _capE;
          var _regE = (hit.deptPath + a.position).match(/([\u4e00-\u9fa5]{2,4})(?:\u5DE1\u629A|\u603B\u5175|\u603B\u7763|\u5E03\u653F\u4F7F|\u6309\u5BDF\u4F7F|\u7ECF\u7565|\u8282\u5EA6)/);
          if (_regE && _regE[1]) _destE = _regE[1];
          if (!_isSameLocation(char.location, _destE) && !char._travelTo) {
            var _daysE = 20;
            try { if (typeof calcLetterDays === 'function') _daysE = calcLetterDays(char.location, _destE, 'normal') || 20; } catch(_){}
            var _dpvE = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
            char._travelFrom = char.location;
            char._travelTo = _destE;
            char._travelStartTurn = GM.turn;
            char._travelRemainingDays = _daysE;
            char._travelArrival = GM.turn + Math.max(1, Math.ceil(_daysE / _dpvE));
            char._travelReason = '奉诏赴任 ' + a.position;
            char._travelAssignPost = (hit.deptPath || '') + '/' + a.position;
            char._travelAssignConcurrent = !!isConcurrent;
            // 编年史走 TM.Chronicle 写口(2026-07-04 收口)·时序 push 归一(原 unshift 混写破序)
            if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
              turn: GM.turn, date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
              type: '赴任启程', title: a.character + ' 赴 ' + _destE,
              content: a.character + ' 自' + char.location + ' 启程赴' + _destE + '·就任 ' + a.position + '·预计 ' + _daysE + ' 日抵任。',
              category: '人事', tags: ['人事', '赴任', '启程', a.character]
            });
            if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
            if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
              turn: GM.turn, date: GM._gameDate || '',
              content: '【启程】' + a.character + ' 自' + char.location + ' 赴 ' + _destE + ' 就任 ' + a.position
            });
          }
        }
        done = true;
      }
    }
    // Path 3: 即使都找不到·也要更新角色字段 + 记录（让 AI 至少知道玩家意图已生效）
    if (!done) {
      var isConcurrentFallback = !!a.concurrent || (typeof _offIsConcurrentAppointment === 'function' && _offIsConcurrentAppointment(a, a.raw || ''));
      if (typeof _offAddCharOfficeTitle === 'function') {
        _offAddCharOfficeTitle(char, a.position, { concurrent: isConcurrentFallback });
      } else if (!isConcurrentFallback || !char.officialTitle) {
        char.officialTitle = a.position;
        char.position = a.position;
      }
      if (!char.careerHistory) char.careerHistory = [];
      char.careerHistory.push({ turn: GM.turn, event: (isConcurrentFallback ? '奉诏加兼 ' : '奉诏就任 ') + a.position + '（官制中暂未立此衙门·视同特设）' });
      addEB('人事', a.character + (isConcurrentFallback ? '奉诏加兼' : '奉诏就任') + a.position + '（特设）', { credibility: 'medium' });
      if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 5, '被委以重任');
    }
  });
  // 1a·奉诏任命/委以重任 → 确定性小幅抬该员 loyalty（被信用则效忠·君恩进"驱动抗命"的那本账·与 affinity 同步累积）
  try {
    if (typeof adjustCharacterLoyalty === 'function') actions.appointments.forEach(function(_ap) {
      var _ac = (_ap && _ap.character) ? findCharByName(_ap.character) : null;
      if (_ac) adjustCharacterLoyalty(_ac, 3, '奉诏委以重任·君恩', { source: 'edict-appointment-loyalty', oncePerTurn: true });
    });
  } catch (_apLoyE) {}
  // 1b·奉诏犒赏/封赏/加俸 → 玩家亲自施恩确定性抬该员 loyalty + affinity（让"发钱真有用"·不再全靠 AI 看心情演 reward）
  try {
    var _pNameRw = (P.playerInfo && P.playerInfo.characterName) || '玩家';
    (actions.rewards || []).forEach(function(_rw) {
      var _rc = (_rw && _rw.character) ? findCharByName(_rw.character) : null;
      if (!_rc) return;
      if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_rc, 4, '奉诏受赏·君恩', { source: 'edict-reward-loyalty', oncePerTurn: true });
      else _rc.loyalty = Math.min(100, ((typeof _rc.loyalty === 'number' && isFinite(_rc.loyalty)) ? _rc.loyalty : 50) + 4);
      if (typeof AffinityMap !== 'undefined') AffinityMap.add(_rw.character, _pNameRw, 8, '奉诏受赏');
      if (typeof recordCharacterArc === 'function') recordCharacterArc(_rw.character, 'reward', '奉诏受赏·君恩');
      addEB('人事', _rw.character + ' 奉诏受赏，感恩戴德', { credibility: 'high' });
    });
  } catch (_rwLoyE) {}
  // 下诏任免主帅·确定性补绑：含军职(督师/总兵/提督…)的任命，额外把 army.commander 绑到对应部队（不取代官制任命·在其上补绑兵权）
  try {
    if (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && typeof TM.AIChange.Army.bindCommanderFromAppointment === 'function') {
      actions.appointments.forEach(function(_ap) {
        if (_ap && _ap.character && _ap.position) {
          try { TM.AIChange.Army.bindCommanderFromAppointment(_ap.character, _ap.position, { source: 'edict.appoint_commander' }); } catch (_bcOneE) {}
        }
      });
    }
  } catch (_bcE) {}
  // 下诏建军·确定性落名册（操作不蒸发；实际兵力规模与招募成本交回合内 sc18 军事推演 AI 估）
  try {
    var _ab = (actions && Array.isArray(actions.armyBuilds)) ? actions.armyBuilds : [];
    var _applyArmy = (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && TM.AIChange.Army.applyAIArmyChange)
      ? TM.AIChange.Army.applyAIArmyChange
      : (typeof applyAIArmyChange === 'function' ? applyAIArmyChange : null);
    if (_ab.length && _applyArmy) {
      _ab.forEach(function(b) {
        if (!b || !b.name) return;
        var _pending = (b.strength == null);
        var _res = null;
        try {
          _res = _applyArmy({
            name: b.name, action: 'create',
            soldiers: _pending ? 0 : b.strength,
            branch: '募兵',
            state: _pending ? 'recruiting' : 'garrison',
            reason: '奉诏组建'
          }, { source: 'edict.build_army', silentEB: true });
        } catch (_aE) {}
        var _army = _res && _res.army;
        if (_army) {
          _army._edictBuilt = true;
          _army._createdTurn = GM.turn;
          _army._pendingMilitarySizing = _pending;
          if (b.special) { _army.special = b.special; if (!_army.description) _army.description = b.special; }
          if (typeof addEB === 'function') {
            addEB('军事', '奉诏组建' + b.name + (_pending ? '·兵额待充实（编练中）' : '·' + b.strength + '兵') + (b.special ? '：' + b.special : ''), { credibility: 'high' });
          }
        }
      });
    }
  } catch (_abErr) {}
  // 下诏补饷·确定性结算欠饷（走 settleArmyArrears 真扣国库·不再免费清欠；与 UI 发饷按钮靠 settleArmyArrears 读当前欠饷月数幂等·不双结算）
  try {
    var _pa = (actions && Array.isArray(actions.payArrears)) ? actions.payArrears : [];
    var _paMS = (typeof MilitarySystems !== 'undefined' && MilitarySystems) || (typeof TM !== 'undefined' && TM.MilitarySystems) || (typeof global !== 'undefined' && global.MilitarySystems) || null;
    if (_pa.length && _paMS && typeof _paMS.settleArmyArrears === 'function' && Array.isArray(GM.armies)) {
      var _pfPay = (P.playerInfo && P.playerInfo.factionName) || '';
      _pa.forEach(function(entry) {
        if (!entry) return;
        var _targets = [];
        if (entry.all) {
          GM.armies.forEach(function(a) {
            if (a && (a.payArrearsMonths || 0) > 0 && (!a.faction || a.faction === _pfPay)) _targets.push(a);
          });
        }
        (entry.names || []).forEach(function(nm) {
          var a = GM.armies.find(function(x) { return x && x.name && (x.name === nm || x.name.indexOf(nm) >= 0 || nm.indexOf(x.name) >= 0); });
          if (a && _targets.indexOf(a) < 0) _targets.push(a);
        });
        _targets.forEach(function(a) {
          if (!a || (a.payArrearsMonths || 0) <= 0) return;
          var _r = _paMS.settleArmyArrears(a, {});
          if (_r && _r.monthsCleared > 0 && typeof addEB === 'function') {
            var _c = _r.cost || {};
            addEB('军务', '奉诏补饷·' + a.name + '·清欠 ' + _r.monthsCleared + ' 月·耗银 ' + (_c.money || 0) + (_r.shortfall > 0 ? '（国库不足·欠 ' + Math.round(_r.shortfall) + '）' : ''), { credibility: 'high' });
          }
        });
      });
    }
  } catch (_paErr) {}
  // 免职——双路径：postSystem + officeTree
  actions.dismissals.forEach(function(a) {
    var char = findCharByName(a.character);
    var didAny = false;
    if (typeof PostTransfer !== 'undefined' && GM.postSystem && GM.postSystem.posts && GM.postSystem.posts.length) {
      try { PostTransfer.cascadeVacate(a.character); didAny = true; } catch(e){ if(window.TM&&TM.errors) TM.errors.capture(e,'endturn.cascadeVacate'); }
    }
    // 同时扫 officeTree 把所有 holder===name 的 position 清空
    if (GM.officeTree) {
      function walkD(nodes) {
        (nodes||[]).forEach(function(n) {
          if (!n) return;
          (n.positions||[]).forEach(function(p) {
            if (!p) return;
            var holderHit = p.holder === a.character;
            var ahHit = Array.isArray(p.actualHolders) && p.actualHolders.some(function(h){ return h && h.name === a.character; });
            if (holderHit || ahHit) {
              if (typeof _offDismissPerson === 'function') _offDismissPerson(p, a.character);
              else p.holder = '';
              didAny = true;
            }
          });
          if (n.subs) walkD(n.subs);
        });
      }
      walkD(GM.officeTree);
    }
    if (char) {
      char.officialTitle = '';
      char.position = '';
      char.title = ''; // 同步·否则免职后廷议等 `officialTitle||title` 回退仍显示原官职
      char.officialTitles = [];
      char.concurrentTitles = [];
      char.concurrentTitle = '';
      // 免职须斩在途赴任链(同 onDismissal)：否则到期自动就任翻案
      delete char._travelAssignPost; delete char._travelTo; delete char._travelRemainingDays;
      if (!char.careerHistory) char.careerHistory = [];
      char.careerHistory.push({ turn: GM.turn, event: '奉诏免职' });
    }
    if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'dismissal', '奉诏免职');
    addEB('人事', a.character + '被免职', { credibility: didAny ? 'high' : 'medium' });
    if (typeof AffinityMap !== 'undefined') AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', -10, '被免职');
    // 免职即解兵权：被免者若正挂某军主帅，确定性摘帅留空缺（角色仍在世·按死活扫的 reconciler 抓不到这条，须显式摘）
    try {
      if (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && typeof TM.AIChange.Army.vacateArmiesByCommander === 'function') {
        TM.AIChange.Army.vacateArmiesByCommander(a.character, { moraleHit: 10, markLost: true, eb: '{army}主帅{name}奉诏去职、兵权交卸，军中暂缺主将，待下诏补任' });
      }
    } catch (_vcE) {}
  });
  // 赦免/起复——清羁押/流放/致仕/逃亡·按需从 _origOfficialTitle 复官回座(治"下诏放人/官复原职没用")
  if (Array.isArray(actions.pardons)) actions.pardons.forEach(function(a) {
    var char = findCharByName(a.character);
    if (!char) return;
    // 清一切羁束状态·并盖 _releasedTurn/_recalledTurn 令叙事校验器 2 回合内不再复述关押
    char._imprisoned = false; char.imprisoned = false; char._inPrison = false;
    char._exiled = false; char.exiled = false; char._banished = false;
    char._fled = false; char.fled = false; char._missing = false;
    char._retired = false; char.retired = false;
    char._releasedTurn = GM.turn;
    char._recalledTurn = GM.turn;
    char._releaseReason = a.restore ? '奉诏起复·官复原职' : '奉诏赦免开释';
    var _restoredTitle = '';
    // 官复原职:从下狱时保存的 _origOfficialTitle 复位并回座 officeTree(仅当前无官职·免覆盖同回合新任命)
    if (a.restore && char._origOfficialTitle && !char.officialTitle) {
      var _orig = char._origOfficialTitle;
      var _hit = (typeof _findPositionInOfficeTree === 'function') ? _findPositionInOfficeTree(_orig) : null;
      if (_hit && _hit.pos && typeof _offSeatPersonInPosition === 'function') {
        try { _offSeatPersonInPosition(_hit.pos, char.name, { replace: false }); } catch(_seatE){}
      }
      if (typeof _offAddCharOfficeTitle === 'function') {
        try { _offAddCharOfficeTitle(char, _orig, {}); } catch(_atE){ char.officialTitle = _orig; char.position = _orig; }
      } else { char.officialTitle = _orig; char.position = _orig; }
      if (!char.officialTitle) { char.officialTitle = _orig; char.position = _orig; }
      char.title = char.officialTitle || _orig;
      _restoredTitle = char.officialTitle || _orig;
    }
    if (!char.careerHistory) char.careerHistory = [];
    char.careerHistory.push({ turn: GM.turn, event: a.restore ? ('奉诏起复' + (_restoredTitle ? '·复任' + _restoredTitle : '·官复原职')) : '奉诏赦免开释' });
    if (typeof recordCharacterArc === 'function') { try { recordCharacterArc(a.character, 'recall', char._releaseReason); } catch(_arcE){} }
    if (typeof addEB === 'function') addEB('人事', a.character + '·' + char._releaseReason + (_restoredTitle ? '（复任' + _restoredTitle + '）' : ''), { credibility: 'high' });
    if (typeof AffinityMap !== 'undefined') { try { AffinityMap.add(a.character, P.playerInfo.characterName || '玩家', 12, a.restore ? '被起复复职·感恩' : '蒙赦释放·感恩'); } catch(_afE){} }
  });
  // 赐死
  actions.deaths.forEach(function(a) {
    var char = findCharByName(a.character);
    if (!char) return;
    char.alive = false;
    char.dead = true;
    char.deathTurn = GM.turn;
    char.deathReason = '赐死';
    if (typeof recordCharacterArc === 'function') recordCharacterArc(a.character, 'death', '被赐死');
    addEB('人事', a.character + '被赐死');
        // P-QAM·诛逆确定性 floor：赐死的若是【系统已定罪的逆党】(char._conspiracyConvicted·镇压谋反时 apply 标记)，确定性给小额皇威——
        //   诛除已坐实奸党正法是立威之举·此为不含糊的质判定(已定罪 yes/no)·小额保底；其余 赐死(可能忠良/未定罪)不在此硬给·忠奸交 AI 经 record_sentiment_changes 判。系统每回合 ±5 净封顶兜住与 AI 的叠加。
        try {
          if (char._conspiracyConvicted || a.treasonCited) {
            var _AEx = (typeof AuthorityEngines !== 'undefined' && AuthorityEngines) || (typeof window !== 'undefined' && window.AuthorityEngines) || null;
            var _zhuniWhy = (char._conspiracyConvicted ? '诛除已定罪逆党 ' : '诛除通敌奸佞 ') + a.character + '·正法立威';
            if (_AEx && typeof _AEx.adjustHuangwei === 'function') _AEx.adjustHuangwei('executeRebelMinister', 3, _zhuniWhy);
          }
        } catch (_exHwE) {}
        // 赐死某人会让其亲近者对玩家产生怨恨
        if (typeof AffinityMap !== 'undefined') {
          var deadRels = AffinityMap.getRelations(a.character);
          deadRels.forEach(function(r) { if (r.value > 20) AffinityMap.add(r.name, P.playerInfo.characterName || '玩家', -15, '赐死' + a.character); });
        }
        // P-DZ·处决官员接降浊度：杀官对其所在部门是震慑 → 降对应 corruption。按 officialTitle 推部门：
        //   非地方官部门(fiscal/military/judicial/central/imperial) 直降 subDepts[dept].true（aggregate 不覆盖这几口·持久）；
        //   地方官(provincial)或推不出 → 降全势力 div.corruption 源头（FE.adjustPlayerDivisionCorruption·cascade + 回合末 aggregate 都吃·持久）。
        //   量 = 保守保底 P_EXEC_CORR_DROP（可调·处决走诏书确定性通道·不走 AI reform_effects）。
        try {
          var _title = String((char.officialTitle || char.position || '')).trim();
          var P_EXEC_CORR_DROP = 5; // 处决一名官员对其部门的震慑降浊度·保守保底·可调
          var _dept = '';
          if (/户部|度支|太仓|钞关|盐运|税课/.test(_title)) _dept = 'fiscal';
          else if (/兵部|都督|总兵|武选|军务/.test(_title)) _dept = 'military';
          else if (/刑部|都察院|御史|大理寺|按察|提刑/.test(_title)) _dept = 'judicial';
          else if (/吏部|内阁|大学士|首辅|次辅|中枢/.test(_title)) _dept = 'central';
          else if (/锦衣卫|东厂|西厂|司礼监|内官监|宦/.test(_title)) _dept = 'imperial';
          else if (/巡抚|总督|知府|知州|知县|布政|参政|道员/.test(_title)) _dept = 'provincial';
          var _CEe = (typeof CorruptionEngine !== 'undefined' && CorruptionEngine) || (typeof window !== 'undefined' && window.CorruptionEngine) || null;
          var _FEe = (typeof FiscalEngine !== 'undefined' && FiscalEngine) || (typeof window !== 'undefined' && window.FiscalEngine) || null;
          var _pFacE = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.factionName) || '';
          if (_dept && _dept !== 'provincial' && GM.corruption && GM.corruption.subDepts && GM.corruption.subDepts[_dept] && typeof GM.corruption.subDepts[_dept].true === 'number') {
            GM.corruption.subDepts[_dept].true = Math.max(0, GM.corruption.subDepts[_dept].true - P_EXEC_CORR_DROP);
            if (_CEe && typeof _CEe.syncIndexFromSubDepts === 'function') _CEe.syncIndexFromSubDepts('处决' + (_title || '官员') + '·' + _dept + '部门震慑（P-DZ）');
          } else if (_FEe && typeof _FEe.adjustPlayerDivisionCorruption === 'function') {
            var _ne = _FEe.adjustPlayerDivisionCorruption(_pFacE, -P_EXEC_CORR_DROP, 0, 100);
            if (_ne === 0) _FEe.adjustPlayerDivisionCorruption('', -P_EXEC_CORR_DROP, 0, 100);
          }
        } catch (_execCorrE) {}
  });
}

// ============================================================
// 玩家移动意图提取（移动对账层 S1·2026-05-28）
// 从诏书自由文本里确定性地捕获"令某人赴/返/召某地"类移动令·只捕获不执行·
// 产出 [{char, to, reason, raw}] 供 reconcile 兜底：AI 漏吐 char_updates.travelTo
// 时引擎自己落地（历代顽疾根因——移动 100% 靠 AI 自愿吐字段·无确定性后手）。
// 镜像 extractEdictActions 的"已知姓名锚定"范式·高精度·宁缺毋滥（错抓会误瞬移）。
// ============================================================
function extractEdictMovements(edictText) {
  if (!edictText || edictText.length < 4) return [];
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return [];
  var text = String(edictText).replace(/\s+/g, '');
  var capital = GM._capital || '京师';

  // 已知姓名集（含字号/别名）——锚定真实人物·避免误抓自由文本
  var knownChars = [];
  var knownMap = {};
  GM.chars.forEach(function(c) {
    if (!c || !c.name) return;
    if (!knownMap[c.name]) { knownMap[c.name] = c.name; knownChars.push(c.name); }
    ['zi','haoName','milkName'].forEach(function(k){
      if (c[k] && c[k].length >= 2 && !knownMap[c[k]]) { knownMap[c[k]] = c.name; knownChars.push(c[k]); }
    });
    if (Array.isArray(c.aliases)) c.aliases.forEach(function(a){
      if (a && a.length >= 2 && !knownMap[a]) { knownMap[a] = c.name; knownChars.push(a); }
    });
  });
  knownChars.sort(function(a,b){ return b.length - a.length; });
  if (!knownChars.length) return [];
  var nameAlt = knownChars.map(function(n){return n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|');

  // 即时抵达识别(玩家口谕本回合即抵)：整诏文含"即刻/瞬间/即时/星夜…" + 移动/抵达类词 → 本回合捕获的移动压成即抵·
  //   供 reconcile honor(mc.instant)·治"挪了也多回合不即到"(与持久规则 _hasInstantArrivalRule 互为兜底·诏文里直说也认)。
  var _instWhole = /(?:即刻|即时|瞬间|立即|星夜|疾驰|急递|即日|限本回合|限即日|无在途|不在途)/.test(text) && /(?:人事|调动|移动|移驻|抵达|到任|赴任|赴|召|迁|走位|所在地)/.test(text);

  var out = [];
  var seen = {};
  function _push(name, to, raw) {
    var canon = knownMap[name] || name;
    to = String(to||'').replace(/[，。、；：的之至于往赴]/g,'').trim();
    if (!canon || !to) return;
    var key = canon + '→' + to;
    if (seen[key]) return;
    seen[key] = 1;
    var inst = _instWhole || /(?:即刻|即时|瞬间|立即|星夜|疾驰|急递|即日|限本回合)/.test(raw||'');
    out.push({ char: canon, to: to, reason: '诏令移动·' + (raw||'').slice(0,24), raw: raw||'', instant: inst });
  }
  // 入朝/召见类目的地归一到都城
  function _toCapitalIfCourt(loc) {
    if (/^(京|京师|京城|都|都城|帝京|畿|阙下)$/.test(loc) || /京师|京城/.test(loc)) return capital;
    return loc;
  }

  var m;
  // A·入朝/召见（目的地=都城）：召/召还/征召/诏/命/令 + 姓名(可顿号列举) + 入朝/延朝/还朝/赴阙/陛见/入觐/入京/还京/进京/来京/赴京
  var courtRx = new RegExp('(?:召还|召回|征召|召|诏|命|令)((?:'+nameAlt+')(?:[、，和及与](?:'+nameAlt+')){0,5})(?:[^。；\n]{0,12}?)(入朝|延朝|还朝|赴阙|陛见|入觐|觐见|入京|还京|进京|来京|赴京)', 'g');
  while ((m = courtRx.exec(text)) !== null) {
    var names = m[1].split(/[、，和及与]/).filter(Boolean);
    names.forEach(function(nm){ if (knownMap[nm]) _push(nm, capital, m[0]); });
  }

  // B·明确目的地移动：(令/命/着/诏/使)? + 姓名 + 移动动词 + 地点(2-8 汉字·遇标点止)
  var moveVerb = '(?:返回|返还|还朝|赴任|赴镇|赴阙|赴|调往|调赴|调任|调防|移驻|移镇|镇守|驻守|出镇|出守|迁往|迁徙|巡幸|驰赴|驰援|前往|起复)';
  var moveRx = new RegExp('(?:令|命|着|诏|使)?('+nameAlt+')'+moveVerb+'([一-龥]{2,8})', 'g');
  while ((m = moveRx.exec(text)) !== null) {
    if (!knownMap[m[1]]) continue;
    _push(m[1], _toCapitalIfCourt(String(m[2]).replace(/[，。、；：].*$/,'')), m[0]);
  }

  // C·所在地/位置移动(玩家口语:"将X、Y所在地移动到Z" / "把X移到Z")·补 B 漏的"移动"类动词 + 姓名与动词间的"所在地"中插
  //   (历代顽疾根因之一:moveVerb 无"移动"·且玩家爱用"所在地移动到"这种口语·两条 regex 全 miss → 移动令静默丢失)
  var relocVerb = '(?:移动|移到|移往|移至|移去|移驻|移居|挪到|挪往|挪移|迁到|迁往|迁至|迁移|调到|调遣|安置|改驻|徙置|搬到|搬往|搬至|遣往|遣去)';  // 显式复合词·不用裸"移/迁"(避免误中 移交/转移/迁安 等)
  var relocRx = new RegExp('(?:将|把|令|命|着|使|遣|令其|命其)?((?:'+nameAlt+')(?:[、，和及与](?:'+nameAlt+')){0,5})(?:[的之]?(?:所在地|位置|驻地|治所|居所|现居|驻所))?'+relocVerb+'(?:到|至|往|去|入|赴|于)?([一-龥]{2,8})', 'g');
  while ((m = relocRx.exec(text)) !== null) {
    var rnames = m[1].split(/[、，和及与]/).filter(Boolean);
    rnames.forEach(function(nm){ if (knownMap[nm]) _push(nm, _toCapitalIfCourt(String(m[2]).replace(/[，。、；：].*$/,'')), m[0]); });
  }

  return out;
}

// ============================================================
// 财政改革识别（P-VWF·2026-05-29）——确定性识别玩家开源/肃贪类改革
// 镜像 extractEdictMovements 范式：纯关键词识别，输出改革列表，供
// prep 存 GM._turnFiscalReforms、applier 的 _reconcilePlayerFiscalReforms 兜底拨开关。
// 本函数只管"质/有没有"（识别出哪类改革），不碰数值、不拨开关。
// ============================================================
function extractEdictFiscalReforms(edictText) {
  if (!edictText || edictText.length < 4) return [];
  if (typeof GM === 'undefined' || !GM) return [];
  var text = String(edictText).replace(/\s+/g, '');

  // 五类开源/肃贪改革·每条 {type, re}·type 决定 applier 拨哪个开关
  var RULES = [
    { type: 'anticorruption',   re: /严惩贪墨|惩治贪官|惩贪|肃贪|查贪|追赃|整饬吏治|澄清吏治|考成法|京察大计/ },
    { type: 'landsurvey',       re: /清丈|丈量田亩|清丈田亩|核田|清查田亩|度田|鱼鳞册/ },
    { type: 'saltreform',       re: /盐法|盐课|整顿盐政|盐政改革|纲盐|开中法/ },
    { type: 'openmaritime',     re: /开海|弛海禁|驰海禁|开市舶|通商舶|开洋|准海商/ },
    { type: 'encouragefarming', re: /劝农|劝课农桑|奖励垦荒|奖励开垦|屯田|垦荒|番薯|甘薯|红薯|地瓜|玉米|苞谷|苞米|马铃薯|洋芋|土豆|高产作物|推广.{0,3}作物/ }
  ];

  var out = [];
  var seen = {};
  RULES.forEach(function(rule) {
    var m = rule.re.exec(text);
    if (!m || seen[rule.type]) return;
    seen[rule.type] = 1;
    out.push({ type: rule.type, raw: String(m[0]).slice(0, 24) });
  });
  return out;
}

// 一次性财政动作（加派/开仓/借贷）——非持久改革·诏令发出当回合落效一次（P-RP3·2026-06-05）
// 国库面板"拟诏"出标准化措辞→此处识别+档位→prep 调 GuokuEngine.Actions 落效。每类去重·一回合一次。
function extractEdictFiscalActions(edictText) {
  if (!edictText || edictText.length < 4) return [];
  if (typeof GM === 'undefined' || !GM) return [];
  var text = String(edictText).replace(/\s+/g, '');
  var out = [];
  var CN = { '一':0.1,'二':0.2,'两':0.2,'三':0.3,'四':0.4,'五':0.5,'六':0.6,'七':0.7,'八':0.8,'九':0.9,'十':1.0 };
  // 加派赋税（一次性临时加征）
  // 否定门(2026-07-04 审查定罪)：「蠲免辽饷/罢三饷/停加派」是减免非开征·裸关键词曾把玩家减税诏反向执行成加征
  var _fisNeg = /(蠲免|蠲除|豁免|减免|免征|罢停|停征|停派|停止|裁撤|裁革|废止|废除|罢|停|免|减)[^。；！\n]{0,8}(加派|三饷|辽饷|剿饷|练饷)|(加派|三饷|辽饷|剿饷|练饷)[^。；！\n]{0,8}(蠲免|蠲除|豁免|减免|免征|停征|停派|裁撤|裁革|废止|废除|尽罢|悉罢|皆罢|俱免|尽免)/;
  if (/加派|三饷|辽饷|剿饷|练饷/.test(text) && !_fisNeg.test(text)) {
    var rate = 0.5;
    var rm = text.match(/([一二两三四五六七八九十])成/);
    if (rm && CN[rm[1]] != null) rate = CN[rm[1]];
    else if (/十成|全饷|尽数加派/.test(text)) rate = 1.0;
    else if (/薄赋|二成|两成/.test(text)) rate = 0.2;
    rate = Math.max(0.05, Math.min(1, rate));
    out.push({ type: 'extraTax', tier: rate, raw: '加派' + Math.round(rate * 100) + '%' });
  }
  // 开仓赈济（一次性花库银济灾）
  if (/开仓|赈济|赈灾|放粮/.test(text)) {
    var scale = 'regional';
    if (/普天|天下|举国|全国/.test(text)) scale = 'national';
    else if (/州县|一州|一县/.test(text)) scale = 'county';
    out.push({ type: 'openGranary', tier: scale, raw: '开仓·' + scale });
  }
  // 借贷（一次性举债·金额带进措辞）
  if (/借银|借贷|举债|商借|告贷|借款/.test(text)) {
    var amount = 200000, term = 12;
    var am = text.match(/(\d+(?:\.\d+)?)\s*万两?/);
    if (am) { var n = parseFloat(am[1]); if (isFinite(n) && n > 0) amount = Math.round(n * 10000); }
    var tmt = text.match(/限(\d+)月/);
    if (tmt) { var tt = parseInt(tmt[1], 10); if (isFinite(tt) && tt > 0) term = tt; }
    out.push({ type: 'takeLoan', tier: amount, term: term, raw: '借' + Math.round(amount / 10000) + '万' });
  }
  return out;
}

// ============================================================
// 自定义国策提取（借鉴 ChongzhenSim coreGameplaySystem）
// 从诏令中识别"定为国策""纳入国策"等语句，创建持久化政策
// 国策跨回合生效，影响 AI 推演上下文
// ============================================================
/** @param {string} edictText @returns {Array<{id:string, name:string, category:string, turn:number}>} */
function extractCustomPolicies(edictText) {
  if (!edictText || edictText.length < 6) return [];
  var policies = [];
  // 匹配模式：将XX定为国策 / 推行XX之策 / 颁布XX令
  var patterns = [
    /(?:将|以|把)?[「「"]?([\u4e00-\u9fa5A-Za-z0-9]{2,20})[」」"]?(?:定为|列为|纳入|确立为)(?:国策|基本国策|长期国策)/g,
    /(?:颁布|推行|施行|实行)[「「"]?([\u4e00-\u9fa5A-Za-z0-9]{2,20})[」」"]?(?:令|法|制|策|之策|之令)/g,
    /(?:永为|永定|定为)(?:祖制|成法|国典)[：:]*[「「"]?([\u4e00-\u9fa5A-Za-z0-9]{2,20})[」」"]?/g
  ];
  patterns.forEach(function(pat) {
    var m;
    while ((m = pat.exec(edictText)) !== null) {
      var name = (m[1] || m[2] || m[3] || '').replace(/[，。、！？]/g, '').trim();
      if (name.length >= 2 && name.length <= 20) {
        // 自动分类
        var category = 'general';
        if (/军|兵|边|防|武|战/.test(name)) category = 'military';
        else if (/农|粮|赈|田|仓|水利/.test(name)) category = 'agriculture';
        else if (/税|财|商|工|海|贸/.test(name)) category = 'fiscal';
        else if (/吏|政|法|察|廉|监|科举/.test(name)) category = 'governance';
        else if (/外|使|盟|朝贡|通商/.test(name)) category = 'diplomacy';
        policies.push({ id: 'custom_' + uid(), name: name, category: category, turn: GM.turn });
      }
    }
  });
  return policies;
}

/** 将提取的国策存入 GM 并注入 AI 上下文 */
function applyCustomPolicies(policies) {
  if (!policies || policies.length === 0) return;
  if (!GM.customPolicies) GM.customPolicies = [];
  policies.forEach(function(p) {
    // 去重（同名国策不重复添加）
    var exists = GM.customPolicies.some(function(ep) { return ep.name === p.name; });
    if (!exists) {
      GM.customPolicies.push(p);
      addEB('国策', '颁布国策：' + p.name + '（' + p.category + '）');
      if (typeof recordPlayerDecision === 'function') recordPlayerDecision('policy', '立' + p.name + '为国策');
      _dbg('[Policy] 新国策:', p.name, p.category);
    }
  });
  // 上限30条
  if (GM.customPolicies.length > 30) GM.customPolicies = GM.customPolicies.slice(-30);
}

/** 获取国策上下文（供 AI prompt） */
function getCustomPolicyContext() {
  if (!GM.customPolicies || GM.customPolicies.length === 0) return '';
  var ctx = '【当前国策】\n';
  var byCat = {};
  GM.customPolicies.forEach(function(p) {
    if (!byCat[p.category]) byCat[p.category] = [];
    byCat[p.category].push(p.name);
  });
  var catNames = { military: '军事', agriculture: '农政', fiscal: '财政', governance: '政务', diplomacy: '外交', general: '其他' };
  Object.keys(byCat).forEach(function(cat) {
    ctx += '  ' + (catNames[cat] || cat) + '：' + byCat[cat].join('、') + '\n';
  });
  ctx += '  ※ 以上为已颁布的长期国策，请在推演中持续体现其影响。\n';
  return ctx;
}

// ─── cluster 1 / 2 分隔 ──────────────────────────────────

function computeExecutionPipeline(edictText, edictCategory) {
  var mc = (typeof P !== 'undefined' && P.mechanicsConfig) ? P.mechanicsConfig : {};
  var pipeline = mc.executionPipeline;
  if (!pipeline || !pipeline.length) return { stages: [], summary: '' };
  var stages = [];

  for (var i = 0; i < pipeline.length; i++) {
    var stage = pipeline[i];
    var officerName = '';
    var ability = 0, loyalty = 0;
    var note = '';

    // 确定functionKey——如果为null，根据诏令类别动态匹配
    var fKey = stage.functionKey;
    if (!fKey && edictCategory) {
      var catMap = { '政令': 'central_admin', '军令': 'military', '外交': 'diplomacy', '经济': 'finance' };
      fKey = catMap[edictCategory] || null;
    }

    // 查找对口官员——仅收集信息，不计算通过率
    if (fKey && typeof findOfficeByFunction === 'function') {
      var officer = findOfficeByFunction(fKey);
      if (officer && officer.holder) {
        var ch = (typeof findCharByName === 'function') ? findCharByName(officer.holder) : null;
        if (ch) {
          officerName = ch.name;
          ability = ch.ability || ch.intelligence || 50;
          loyalty = ch.loyalty || 50;
        }
      } else {
        note = '空缺';
      }
    }

    stages.push({
      name: stage.name,
      officer: officerName,
      ability: ability,
      loyalty: loyalty,
      note: note
    });
  }

  // 生成摘要字符串——纯信息，供AI判断
  var summary = stages.map(function(s) {
    var desc = s.name + '(';
    if (s.officer) desc += s.officer + ' 能力' + s.ability + ' 忠诚' + s.loyalty;
    else if (s.note) desc += s.note;
    else desc += '未配置';
    desc += ')';
    return desc;
  }).join('→');

  return { stages: stages, summary: summary };
}

// ============================================================
// 2.2: 诏令执行情境构建（仅供AI prompt参考，不做机械效果）
// 天命核心理念：诏令效果完全由AI根据剧本背景+官制+角色判断
// 此函数只收集执行环境信息注入AI prompt，帮助AI做出更好的判断
// ============================================================
function processEdictEffects(allEdictText, edictCategory) {
  if (!allEdictText || !allEdictText.trim()) return { summary: '', executionSummary: '' };

  // v5·人物生成 A：诏令征召识别（异步 fire-and-forget）
  try {
    if (typeof handleEdictTextForRecruit === 'function') {
      handleEdictTextForRecruit(allEdictText).catch(function(e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '\u8BCF\u4EE4\u5F81\u8BCF] \u5F02\u5E38') : console.warn('[\u8BCF\u4EE4\u5F81\u8BCF] \u5F02\u5E38', e); });
    }
  } catch(_rE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rE, '\u8BCF\u4EE4\u5F81\u8BCF') : console.warn('[\u8BCF\u4EE4\u5F81\u8BCF]', _rE); }

  // 收集执行管线信息（如果有配置）
  var execResult = computeExecutionPipeline(allEdictText, edictCategory);

  // 保存到 GM 供 AI prompt 注入（纯信息，无机械效果）
  GM._edictMechanicalReport = '';
  GM._edictExecutionReport = execResult.summary;

  // 制度类诏令自动识别 + 分流（货币/税种/户籍/徭役/兵制/官制 + P1）
  try {
    if (typeof EdictParser !== 'undefined' && typeof EdictParser.tryExecute === 'function') {
      var edictResult = EdictParser.tryExecute(allEdictText, {}, { category: edictCategory });
      if (edictResult && edictResult.pathway) {
        GM._lastEdictClassification = edictResult;
        var typeLabel = edictResult.typeKey ? (EdictParser.EDICT_TYPES[edictResult.typeKey] ? EdictParser.EDICT_TYPES[edictResult.typeKey].name : edictResult.typeKey) : '';
        if (edictResult.pathway === 'memorial') {
          var drafter = edictResult.memo && edictResult.memo.drafter || '有司';
          var msg1 = '〔' + typeLabel + '〕旨意已下，' + drafter + ' 下回合具奏';
          if (typeof addEB === 'function') addEB('诏令', msg1);
          if (typeof toast === 'function') toast('诏令识别：' + typeLabel + ' → ' + drafter + ' 复奏');
        } else if (edictResult.pathway === 'ask') {
          var q = (edictResult.clarification && edictResult.clarification.questions && edictResult.clarification.questions[0]) || '圣意具体如何？';
          if (typeof addEB === 'function') addEB('诏令', '侍臣问疑：' + q);
          if (typeof toast === 'function') toast('诏令需细化：' + q);
        } else if (edictResult.ok && edictResult.pathway === 'direct') {
          var msg2 = '〔' + typeLabel + '〕已直断施行' + (edictResult.isP1 ? '（P1 特殊）' : '');
          if (typeof addEB === 'function') addEB('诏令', msg2);
          if (typeof toast === 'function') toast('诏令已施行：' + typeLabel);
        }
      }
    }
    // 技术类诏令识别
    if (typeof EnvRecoveryFill !== 'undefined' && typeof EnvRecoveryFill.parseTechDecree === 'function') {
      var techRes = EnvRecoveryFill.parseTechDecree(allEdictText);
      if (techRes && techRes.ok && typeof toast === 'function') toast('技术诏令：' + techRes.tech + ' 提升');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'edict] 制度分流失败:') : console.error('[edict] 制度分流失败:', e); }

  // 变法诏令识别（人力/徭役/农政层·R6c）——仅对已种子地域生效·未种子(live)零工作早返回·additive 不扰既有分流
  try {
    if (typeof TM !== 'undefined' && TM.Renli && typeof TM.Renli.recognizeEdictReform === 'function') {
      var _rlReform = TM.Renli.recognizeEdictReform(GM, (typeof P !== 'undefined' ? P : null), allEdictText, { category: edictCategory });
      if (_rlReform && _rlReform.applied && _rlReform.applied.length) {
        _rlReform.applied.forEach(function (a) { if (a && a.label && typeof addEB === 'function') addEB('变法', a.label); });
        if (typeof toast === 'function') { var _seen = {}; var _u = _rlReform.applied.map(function (a) { return a.typeCN; }).filter(function (x) { if (_seen[x]) return false; _seen[x] = 1; return true; }); toast('变法施行：' + _u.join('、')); }
      }
    }
  } catch (_rlE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rlE, 'edict] 变法识别失败') : console.error('[edict] 变法识别失败:', _rlE); }

  // F·改革杠杆 typed-incidence（2026-06-16）：玩家诏令的跨阶层政治后果（接 orphaned EDICT_TYPES.affectedClasses）。
  //   仅玩家路径（与 AI class_changes 天然分离）·走 gateSatisfaction 上闸（±14 预算自动 bound 双计·与 huji 硬效果重叠由闸夹）·source 记账。
  try {
    if (typeof applyEdictTypedIncidence === 'function') applyEdictTypedIncidence(GM, allEdictText, { turn: GM.turn });
  } catch (_fE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fE, 'edict] typed-incidence 失败') : console.error('[edict] typed-incidence 失败:', _fE); }

  return { summary: '', executionSummary: execResult.summary };
}
