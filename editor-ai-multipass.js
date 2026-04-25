// ============================================================
// editor-ai-multipass.js — AI 多轮深化+特定字段生成 (R141 从 editor-ai-gen.js L1849-end 拆出)
// 姊妹: editor-ai-gen.js (单次 AI 生成+doAIGenerate+playerGen 基础)
// 包含: _multiPassGovernmentGen (官制多轮)+_multiPassAdminGen (行政区划多轮)+
//       _getEditorAIHints+_buildScriptContext+
//       aiGenOverview/OpeningText/GlobalRules/FactionRelations/
//       FiscalConfig/PopulationConfig/EnvironmentConfig/AuthorityConfig+
//       aiPolishStructuredField+aiPolishCharFamilyMembers
// ============================================================

// ============================================================
async function _multiPassGovernmentGen(ctx, existingContent, existingNote, maxTok) {
  var dynasty = scriptData.dynasty || scriptData.era || '';
  var year = scriptData.gameSettings ? scriptData.gameSettings.startYear : '';
  var emperor = scriptData.emperor || '';
  if (!scriptData.government) scriptData.government = {name:'',description:'',selectionSystem:'',promotionSystem:'',historicalReference:'',nodes:[]};
  var nodes = scriptData.government.nodes;
  var chars = scriptData.characters || [];
  var charNames = chars.map(function(c) {
    return c.name + (c.title?'('+c.title+')':'') + ' 政'+((c.administration||50)) + '/智'+((c.intelligence||50)) + '/武'+((c.valor||50)) + (c.faction?' '+c.faction:'');
  });
  function getGovSummary() {
    var s = '';
    (function w(list, d) { list.forEach(function(n) { s += '  '.repeat(d) + n.name + (n.positions ? '(' + n.positions.length + '官职)' : '') + (n.subs && n.subs.length > 0 ? ' [' + n.subs.length + '子]' : '') + '\n'; if (n.subs && n.subs.length > 0 && d < 2) w(n.subs, d + 1); }); })(nodes, 0);
    return s;
  }

  // 统一：为 AI 返回的 position 补齐新字段
  function _normalizePosition(p) {
    if (!p || typeof p !== 'object') return null;
    var est = parseInt(p.establishedCount != null ? p.establishedCount : (p.headCount || 1), 10) || 1;
    var vac = parseInt(p.vacancyCount != null ? p.vacancyCount : 0, 10) || 0;
    if (vac > est) vac = est;
    var occupied = est - vac;
    // AI 若返回 actualHolders 数组则用；否则按 holder 字段与 occupied 推算
    var ah = [];
    if (Array.isArray(p.actualHolders) && p.actualHolders.length > 0) {
      p.actualHolders.forEach(function(h) {
        if (!h) return;
        if (typeof h === 'string') ah.push({ name: h, generated: true });
        else ah.push({ name: h.name || '', generated: h.generated !== false && !!h.name });
      });
    }
    if (ah.length < occupied) {
      var named = ah.filter(function(h){return h.name;}).length;
      if (p.holder && !ah.some(function(h){return h.name===p.holder;})) {
        ah.push({ name: p.holder, generated: true });
      }
      // 补占位
      while (ah.length < occupied) {
        ah.push({ name: '', generated: false, placeholderId: 'ph_' + Math.random().toString(36).slice(2,8) });
      }
    } else if (ah.length > occupied) {
      ah = ah.slice(0, occupied);
    }
    var firstNamed = ah.filter(function(h){return h.name && h.generated!==false;})[0];
    return {
      name: p.name || '',
      rank: p.rank || '',
      establishedCount: est,
      vacancyCount: vac,
      actualHolders: ah,
      holder: firstNamed ? firstNamed.name : '',
      headCount: est,
      succession: p.succession || 'appointment',
      authority: p.authority || 'execution',
      perPersonSalary: p.perPersonSalary || p.salary || '',
      salary: p.perPersonSalary || p.salary || '',
      historicalRecord: p.historicalRecord || '',
      duties: p.duties || '',
      desc: p.desc || ''
    };
  }

  function _countCoreCoverage() {
    // 检测"宰辅/中央核心"是否已到位
    var nodeNames = nodes.map(function(n){return n.name;}).join('|');
    var hasChief = /丞相|宰相|三公|太师|太傅|太保|首辅|内阁|政事堂|中书|尚书省|门下省|枢密|军机处|三省/.test(nodeNames);
    var posNames = [];
    (function w(ns){ ns.forEach(function(n){(n.positions||[]).forEach(function(p){posNames.push(p.name);}); if (n.subs) w(n.subs);}); })(nodes);
    var hasChiefOfficial = posNames.some(function(n){return /丞相|宰相|三公|太师|首辅|大学士|尚书令|侍中|中书令|枢密使|军机大臣/.test(n);});
    return { hasChief: hasChief, hasChiefOfficial: hasChiefOfficial, totalDepts: nodes.length };
  }

  var histGuide = '\n\n【史实要求——严格按正史记载】\n'
    + '1. 官职名称必须使用' + dynasty + (year ? '(公元' + year + '年前后)' : '') + '实际存在的官职名，参考正史《职官志》《百官志》\n'
    + '2. 品级(rank)必须符合该朝代实际品级制度（如唐代正一品到从九品、汉代万石到百石等）\n'
    + '3. duties必须50字以上，具体描述该官职的实际职责权力范围\n'
    + '4. succession字段：appointment(流官)/hereditary(世袭)/examination(科举)/military(军功)/recommendation(举荐)\n'
    + '5. authority字段：decision(决策)/execution(执行)/advisory(咨询)/supervision(监察)\n'
    + '6. 不同朝代官制差异极大，必须严格按' + dynasty + '实际制度（如秦汉三公九卿、唐宋三省六部、明清内阁六部）\n'
    + '7. 【新字段·严格遵守】\n'
    + '   establishedCount: 史料记载的该职位编制人数（如"员外郎四人"就填4）\n'
    + '   vacancyCount: 该剧本时间点该职位缺员数——按正史列传/本纪里的记载判断，若史无明载默认0；一朝晚期可能多\n'
    + '   actualHolders: 在职者数组（长度应 = establishedCount - vacancyCount）\n'
    + '     [{name:"历史人物实际姓名", generated:true}] —— 有史料记载的任职者填 generated:true\n'
    + '     [{name:"", generated:false}] —— 没有史料明载具体人的在职者填 generated:false（留作占位，运行时 AI 会按需生成）\n'
    + '   perPersonSalary: 该职单人年俸（史料记载，如"月俸七石"、"岁俸三百石"、"正从一品俸"）\n'
    + '   historicalRecord: 史料出处（如"《旧唐书·职官志二》"）\n'
    + '8. 【关键原则】已生成角色的任职者 ≠ 实际在职者\n'
    + '   · 若部门编制15人、缺员3人 → actualHolders 长度应为12\n'
    + '   · 其中有史料明载姓名的写出姓名+generated:true\n'
    + '   · 无史料的写 generated:false 占位——不是空缺，只是暂无角色内容\n';

  try {
    // ═══ 第0轮：本朝代官制史料参考（只在空白时生成） ═══
    if (!scriptData.government.historicalReference || scriptData.government.historicalReference.length < 100) {
      showToast('第0轮：查阅' + dynasty + '职官志……');
      var p0 = '你是精通中国古代职官制度的历史学家。现需生成' + dynasty + (year?'（公元'+year+'年前后，'+emperor+'时期）':'') + '的官制史料参考摘要，用于后续生成剧本官制。\n\n'
        + '请输出本朝代最接近此时间点的【职官志/百官志】要点摘要（600-1200字），必须包括：\n'
        + '  1. 本朝代中央官制体系名称及结构（如三省六部制/内阁制/三公九卿制）\n'
        + '  2. 宰辅机构及其主要官员（如政事堂、内阁、军机处；及具体官衔与编制人数）\n'
        + '  3. 六部或等同执行机构的名称、主官、副官、编制\n'
        + '  4. 监察/军事/宗族/礼仪等关键机构\n'
        + '  5. 此时间点已知的重大官制变更（如新设/废除/改制）\n'
        + '  6. 若剧本背景时期有特殊官制现象（如宦官专权、外戚专政、藩镇割据导致的兼职），一并说明\n'
        + '  7. 该朝代的主要俸禄制度与品级结构\n'
        + '请按朝代真实史料客观叙述，不虚构；若某段时期史料缺失，明确说"《XX志》未详载"。直接输出文字，不用 markdown。';
      try {
        var r0 = await callAIEditor(p0, maxTok);
        if (r0 && r0.length > 100) {
          scriptData.government.historicalReference = r0.trim();
          renderGovernment(); autoSave();
          showToast('史料参考已保存');
        }
      } catch (e0) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e0, 'GovGen P0') : console.warn('[GovGen P0]', e0); }
    }

    var refBlock = scriptData.government.historicalReference ? '\n\n【本朝代职官志参考——必须遵守】\n' + scriptData.government.historicalReference + '\n\n' : '';

    // ═══ 第1轮：关键顶层部门 + 完整职员 + 主官任职（循环补齐直到核心到位） ═══
    var round1Attempt = 0;
    var MAX_ROUND1 = 3;
    while (round1Attempt < MAX_ROUND1) {
      var cov = _countCoreCoverage();
      if (cov.totalDepts >= 6 && cov.hasChief && cov.hasChiefOfficial) break;
      round1Attempt++;
      showToast('第1轮·第' + round1Attempt + '次：生成中央核心部门……');

      var charNote = charNames.length > 0 ? '\n\n【现有角色（可填入 actualHolders.name）】\n' + charNames.join('\n') : '';
      var missingHint = '';
      if (!cov.hasChief) missingHint += '\n ⚠ 宰辅机构缺失——必须补充（如政事堂/内阁/军机处/丞相府/三公府，按朝代选）';
      if (!cov.hasChiefOfficial) missingHint += '\n ⚠ 宰辅官员缺失——必须补充（如丞相/三公/首辅/大学士/尚书令/侍中等）';
      if (cov.totalDepts < 6) missingHint += '\n ⚠ 顶级部门不足 6 个，需继续补充';

      var p1 = '你是精通' + dynasty + '官制的历史专家。' + ctx + refBlock
        + '\n当前已生成：' + (nodes.length > 0 ? getGovSummary() : '空')
        + missingHint
        + histGuide + charNote
        + '\n\n请生成' + dynasty + '【尚未出现的】顶级中央部门（按正史职官志，至少补齐到 6-10 个），按重要性排序。\n'
        + '  ★ 必须包含宰辅机构与六部/等同执行机构与监察机构\n'
        + '  ★ 每个顶级部门的 positions 必须完整（按职官志记载，含主官+副主官+佐官），不得只列一个\n'
        + '  ★ 每个 position 必须包含 establishedCount/vacancyCount/historicalRecord/perPersonSalary\n'
        + '  ★ actualHolders：按史料记载——有明载者填真名+generated:true；无明载者填 generated:false 占位\n'
        + '\n格式：[{name,desc,functions:[],positions:[{name,rank,duties(50+字),succession,authority,establishedCount,vacancyCount,actualHolders:[{name,generated}],perPersonSalary,historicalRecord}],subs:[]}]\n'
        + '只返回 JSON 数组。';
      try {
        var r1 = await callAIEditor(p1, maxTok);
        var arr1 = extractJSON(r1);
        if (Array.isArray(arr1)) {
          arr1.forEach(function(a) {
            if (!a || !a.name) return;
            if (!a.subs) a.subs = [];
            if (!Array.isArray(a.positions)) a.positions = [];
            a.positions = a.positions.map(_normalizePosition).filter(Boolean);
            if (!a.functions) a.functions = [];
            if (!nodes.some(function(n) { return n.name === a.name; })) nodes.push(a);
          });
          renderGovernment(); autoSave();
        }
      } catch (e1) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e1, 'GovGen P1') : console.warn('[GovGen P1]', e1); }
    }

    // ═══ 第2轮：子部门 + 子部门官员 ═══
    var emptyTop = nodes.filter(function(n) { return !n.subs || n.subs.length === 0; });
    if (emptyTop.length > 0) {
      for (var gi = 0; gi < emptyTop.length; gi += 4) {
        var gbatch = emptyTop.slice(gi, gi + 4);
        showToast('第2轮：扩展子部门(' + (gi+1) + '-' + Math.min(gi+4,emptyTop.length) + ')……');
        var names2 = gbatch.map(function(n) { return n.name; });
        var charNote2 = charNames.length > 0 ? '\n【现有角色】' + charNames.slice(0,20).join('；') : '';
        var p2 = '你是精通' + dynasty + '官制的历史专家。' + ctx + refBlock
          + '\n当前官制：' + getGovSummary()
          + histGuide + charNote2
          + '\n以下部门缺少子部门：' + names2.join('、')
          + '\n请为每个生成 2-5 个下属机构，每个子部门含 1-5 个官职（完整 position 字段：establishedCount/vacancyCount/actualHolders/perPersonSalary/historicalRecord）。\n'
          + '★ 史料有记载的任职者填真名 generated:true；无明载者填 generated:false 占位\n'
          + '返回 JSON 对象：{"部门名":[{name,desc,positions:[{name,rank,duties,succession,authority,establishedCount,vacancyCount,actualHolders:[{name,generated}],perPersonSalary,historicalRecord}],subs:[]}]}';
        try {
          var r2 = await callAIEditor(p2, maxTok);
          var o2 = JSON.parse(r2.match(/\{[\s\S]*\}/)[0]);
          Object.keys(o2).forEach(function(dn) {
            var par = nodes.find(function(n) { return n.name === dn; });
            if (par && Array.isArray(o2[dn])) {
              o2[dn].forEach(function(s) {
                if (!s || !s.name) return;
                if (!s.subs) s.subs = [];
                if (!Array.isArray(s.positions)) s.positions = [];
                s.positions = s.positions.map(_normalizePosition).filter(Boolean);
                if (!par.subs.some(function(x) { return x.name === s.name; })) par.subs.push(s);
              });
            }
          });
        } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'GovGen P2') : console.warn('[GovGen P2]', e); }
      }
      renderGovernment(); autoSave();
    }

    // ═══ 第3轮：铨选补缺（只填主官/副主官/关键职，其余留占位） ═══
    var totalPos = 0;
    var vacantMain = [];   // 主要职位（决策/执行权、高品）
    var vacantSecondary = []; // 次要职位
    (function cntP(ns, path) { ns.forEach(function(n) {
      var np = path ? path + '·' + n.name : n.name;
      (n.positions||[]).forEach(function(p) {
        totalPos++;
        var isMain = (p.authority === 'decision') || /尚书|侍郎|丞相|大学士|御史大夫|都御史|宰相|三公|令|卿|少卿/.test(p.name || '');
        var hasSlot = Array.isArray(p.actualHolders) && p.actualHolders.some(function(h){return h && h.generated===false;});
        if (hasSlot) {
          (isMain ? vacantMain : vacantSecondary).push({ dept: np, pos: p });
        }
      });
      if (n.subs) cntP(n.subs, np);
    }); })(nodes, '');

    var usedHolders = {};
    (function collectH(ns) { ns.forEach(function(n) { (n.positions||[]).forEach(function(p) { (p.actualHolders||[]).forEach(function(h){ if (h && h.name && h.generated) usedHolders[h.name] = true; }); if (p.holder) usedHolders[p.holder] = true; }); if (n.subs) collectH(n.subs); }); })(nodes);
    var availChars = chars.filter(function(c) { return !usedHolders[c.name]; });

    if (availChars.length > 0 && vacantMain.length > 0) {
      showToast('第3轮：铨选' + vacantMain.length + '个核心空缺（次要职位留占位）……');
      var availList = availChars.map(function(c) {
        return c.name + ' 政' + (c.administration||50) + '/智' + (c.intelligence||50) + '/武' + (c.valor||50);
      }).join('\n');
      var vacList = vacantMain.slice(0, 30).map(function(vp) {
        return vp.dept + ' - ' + vp.pos.name + '（' + (vp.pos.rank||'') + '）';
      }).join('\n');

      var p3 = '你是' + dynasty + '的吏部尚书。\n' + refBlock
        + '以下角色尚未任官：\n' + availList + '\n\n'
        + '以下【核心官职】尚缺任职者（共' + vacantMain.length + '个；次要职位暂不铨选，留作游戏运行时动态生成）：\n' + vacList + '\n\n'
        + '根据能力铨选：政务高→文官，武勇高→武官，智力高→谋臣/监察。\n'
        + '返回 JSON：[{"position":"官职名","holder":"角色名"}]\n一人一职，不匹配宁缺。只返回 JSON。';

      try {
        var r3 = await callAIEditor(p3, maxTok);
        var jm3 = r3.match(/\[[\s\S]*\]/);
        if (jm3) {
          var appts = JSON.parse(jm3[0]);
          var appointed = 0;
          appts.forEach(function(apt) {
            if (!apt.position || !apt.holder) return;
            (function findSet(ns) { ns.forEach(function(n) {
              (n.positions||[]).forEach(function(p) {
                if (p.name !== apt.position) return;
                // 找第一个 generated:false 占位替换
                if (!Array.isArray(p.actualHolders)) p.actualHolders = [];
                var slot = p.actualHolders.find(function(h){return h && h.generated===false;});
                if (slot) {
                  slot.name = apt.holder;
                  slot.generated = true;
                  if (!p.holder) p.holder = apt.holder;
                  appointed++;
                }
              });
              if (n.subs) findSet(n.subs);
            }); })(nodes);
          });
          if (appointed > 0) { renderGovernment(); autoSave(); }
          showToast('已铨选' + appointed + '核心人员就任（' + vacantSecondary.length + '次要职位留作占位）');
        }
      } catch(e3) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e3, 'GovGen P3') : console.warn('[GovGen P3]', e3); }
    } else if (vacantSecondary.length > 0) {
      showToast('官制生成完成（' + vacantSecondary.length + '次要职位留作占位，运行时按需生成）');
    }

    showToast('官制生成完成！' + nodes.length + '个部门，' + totalPos + '个官职，' + (vacantSecondary.length + Math.max(0,vacantMain.length)) + '个占位');
  } catch(e) { showToast('官制生成失败: ' + e.message); (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'GovGen') : console.error('[GovGen]', e); }
}

// ============================================================
// 多轮深化生成 — 行政区划
// ============================================================
async function _multiPassAdminGen(ctx, existingContent, existingNote, maxTok) {
  var dynasty = scriptData.dynasty || scriptData.era || '';
  var year = scriptData.gameSettings ? scriptData.gameSettings.startYear : '';
  var fid = (typeof _currentAdminFactionId !== 'undefined') ? _currentAdminFactionId : 'player';
  if (!scriptData.adminHierarchy) scriptData.adminHierarchy = {};
  if (!scriptData.adminHierarchy[fid]) scriptData.adminHierarchy[fid] = { name: fid === 'player' ? '\u73A9\u5BB6\u52BF\u529B' : fid, description: '', divisions: [] };
  var divs = scriptData.adminHierarchy[fid].divisions;
  function ensD(d) { if (!d.id) d.id = 'admin_' + Date.now() + '_' + Math.random().toString(36).substr(2,6); if (!d.children) d.children = []; d.children.forEach(ensD); }
  function getAdmSummary() {
    var s = '';
    (function w(list, d) { list.forEach(function(x) { s += '  '.repeat(d) + x.name + (x.level ? '(' + x.level + ')' : '') + (x.population ? ' 人口' + x.population : '') + (x.prosperity ? ' 繁荣' + x.prosperity : '') + (x.children && x.children.length > 0 ? ' [下辖' + x.children.length + ']' : '') + '\n'; if (x.children && x.children.length > 0 && d < 2) w(x.children, d + 1); }); })(divs, 0);
    return s;
  }

  // 史实参照指令——不同级别行政区数据应有差异
  var levelGuide = '\n\n【关键：不同级别行政区的数据差异】\n'
    + '省/道/路级(province)：管辖范围大，人口50万-500万，繁荣度反映整体经济水平，地形为主要地貌，特产为该区域标志性物产，主官为高级地方官(如节度使、转运使、布政使)，description应描述战略地位和区域特征\n'
    + '府/郡/州级(prefecture)：管辖中等范围，人口5万-80万，繁荣度更精确反映城市经济，地形更具体，特产为本地物产，主官为中级地方官(如知府、太守、刺史)，description应描述城市特色和经济功能\n'
    + '县/城级(county)：管辖小范围，人口5千-15万，繁荣度直接反映当地民生，地形为具体地貌，特产为乡土特产，主官为基层官员(如县令、县长)，description应描述民生状况和地方治理\n'
    + '乡/镇级(district)：最基层，人口500-2万，繁荣度反映村镇经济，主官为基层吏员(如里正、保长)，可无特产\n';

  var histGuide = '\n【史实要求】\n'
    + '1. 地名必须使用该朝代' + (year ? '公元' + year + '年前后' : '') + '实际存在的真实历史地名\n'
    + '2. 人口数据应参考该朝代的历史人口记载（如《汉书·地理志》《新唐书·地理志》《宋史·地理志》等正史记载），允许合理推算\n'
    + '3. 繁荣度应反映该地区在该时期的实际经济状况（如唐代扬州繁荣度应高于边远地区）\n'
    + '4. 地形和特产必须符合该地区的实际地理（如蜀地多山地、江南多水乡、河北多平原）\n'
    + '5. 行政层级名称和结构必须严格按照' + dynasty + '的实际制度（如唐朝用道-州-县，宋朝用路-府/州-县，明朝用省-府-县）\n';

  // 收集所有已有地名（全层级递归去重用）
  var _allNames = {};
  (function _collectNames(list) { list.forEach(function(d) { _allNames[d.name] = true; if (d.children) _collectNames(d.children); }); })(divs);

  // 统计现有数据缺陷
  var _noGov = [], _noCapital = [], _noChildren = [], _emptyPref = [];
  (function _audit(list, depth) {
    list.forEach(function(d) {
      if (!d.governor) _noGov.push({name:d.name, level:d.level||'', depth:depth});
      if (!d.capital && depth < 2) _noCapital.push(d.name);
      if ((!d.children || d.children.length === 0) && depth < 2) _noChildren.push({name:d.name, depth:depth});
      if (d.children) {
        d.children.forEach(function(ch) {
          if ((!ch.children || ch.children.length === 0) && depth < 1) _emptyPref.push({parent:d.name, pref:ch});
        });
        _audit(d.children, depth + 1);
      }
    });
  })(divs, 0);

  try {
    var chars = scriptData.characters || [];
    var charNote = chars.length > 0 ? '\n\n【现有角色（可任命为地方主官）】\n' + chars.map(function(c){return c.name+(c.title?'('+c.title+')':'')+' 政'+(c.administration||50)+'/武'+(c.valor||50)+(c.location?' 在'+c.location:'');}).join('\n') : '';

    // ═══ 第1轮：补充顶层行政区（仅缺少时） ═══
    if (divs.length < 6) {
      showToast('第1轮：生成顶层行政区及首府……');
      var p1 = '你是精通' + dynasty + '历史地理的行政区划专家。' + ctx
        + '\n当前区划：' + (divs.length > 0 ? getAdmSummary() : '空')
        + levelGuide + histGuide + charNote
        + '\n请生成6-12个顶层行政区（省/道/路级），按重要性排序。每项包含：\n'
        + '{id:"admin_拼音",name:"真实地名",level:"' + dynasty + '实际层级名称",officialPosition:"主官职位(如节度使/布政使/刺史)",governor:"主官姓名(从现有角色中选合适的，或留空)",capital:"首府城市名",description:"战略地位和区域特征(50字)",population:人口数,prosperity:繁荣度(0-100),terrain:"主要地貌",specialResources:"标志性物产",taxLevel:"轻/中/重",children:[]}\n'
        + '优先级：京畿地区 > 经济重地 > 军事要地 > 边远地区。\n'
        + '不要重复已有区划。只返回JSON数组。';
      var r1 = await callAIEditor(p1, maxTok);
      var a1 = extractJSON(r1);
      if (Array.isArray(a1)) { a1.forEach(function(a) { ensD(a); if (!_allNames[a.name]) { divs.push(a); _allNames[a.name] = true; } }); }
    }

    // 第2轮：为顶层区填充府/郡级下属
    var emptyD = divs.filter(function(d) { return !d.children || d.children.length === 0; });
    if (emptyD.length > 0) {
      for (var bi = 0; bi < emptyD.length; bi += 4) {
        var batch = emptyD.slice(bi, bi + 4);
        showToast('\u7B2C2\u8F6E\uFF1A\u586B\u5145\u5E9C/\u90E1\u7EA7(' + (bi+1) + '-' + Math.min(bi+4,emptyD.length) + ')...');
        var bn = batch.map(function(d) { return d.name + (d.terrain ? '(' + d.terrain + ')' : ''); });
        var p2 = '\u4F60\u662F\u7CBE\u901A' + dynasty + '\u5386\u53F2\u5730\u7406\u7684\u884C\u653F\u533A\u5212\u4E13\u5BB6\u3002' + ctx
          + '\n\u5F53\u524D\u533A\u5212\uFF1A' + getAdmSummary()
          + levelGuide + histGuide
          + '\n以下顶层区缺少下属：' + bn.join('、') + charNote
          + '\n请为每个生成3-6个府/郡/州级下属。府级人口应小于省级，繁荣度更具体，主官为中级官员。\n'
          + '每个需含governor(主官姓名，从现有角色选或留空)、capital(首府名)。\n'
          + '返回JSON对象：{"顶层区名":[{id,name,level,officialPosition,governor,capital,description,population,prosperity,terrain,specialResources,taxLevel,children:[]}]}';
        var r2 = await callAIEditor(p2, maxTok);
        try { var o2 = JSON.parse(r2.match(/\{[\s\S]*\}/)[0]); Object.keys(o2).forEach(function(pn) { var par = divs.find(function(d) { return d.name === pn; }); if (par && Array.isArray(o2[pn])) { o2[pn].forEach(function(ch) { ensD(ch); if (!_allNames[ch.name]) { par.children.push(ch); _allNames[ch.name] = true; } }); } }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'AdminGen P2') : console.warn('[AdminGen P2]', e); }
      }
    }

    // 第3轮：为府/郡级填充县级下属（可选，如果已有府级但无县级）
    var emptyPref = [];
    divs.forEach(function(prov) {
      if (prov.children) prov.children.forEach(function(pref) {
        if (!pref.children || pref.children.length === 0) emptyPref.push({ parent: prov.name, pref: pref });
      });
    });
    if (emptyPref.length > 0 && emptyPref.length <= 20) {
      for (var ci = 0; ci < emptyPref.length; ci += 6) {
        var cbatch = emptyPref.slice(ci, ci + 6);
        showToast('\u7B2C3\u8F6E\uFF1A\u586B\u5145\u53BF\u7EA7(' + (ci+1) + '-' + Math.min(ci+6,emptyPref.length) + ')...');
        var cnames = cbatch.map(function(x) { return x.parent + '/' + x.pref.name; });
        var p3 = '\u4F60\u662F\u7CBE\u901A' + dynasty + '\u5386\u53F2\u5730\u7406\u7684\u884C\u653F\u533A\u5212\u4E13\u5BB6\u3002' + ctx
          + levelGuide + histGuide
          + '\n\u4EE5\u4E0B\u5E9C/\u90E1\u7F3A\u5C11\u53BF\u7EA7\u4E0B\u5C5E\uFF1A' + cnames.join('\u3001')
          + '\n\u8BF7\u4E3A\u6BCF\u4E2A\u751F\u62102-4\u4E2A\u53BF\u7EA7\u4E0B\u5C5E\u3002\u6CE8\u610F\uFF1A\u53BF\u7EA7\u4EBA\u53E3\u901A\u5E38\u51E0\u5343\u5230\u5341\u51E0\u4E07\uFF0C\u7E41\u8363\u5EA6\u76F4\u63A5\u53CD\u6620\u6C11\u751F\uFF0C\u4E3B\u5B98\u4E3A\u53BF\u4EE4/\u53BF\u957F\u3002\n'
          + '\u8FD4\u56DEJSON\u5BF9\u8C61\uFF1A{"\u7236\u7EA7\u533A\u540D/\u5E9C\u540D":[{id,name,level,officialPosition,description,population,prosperity,terrain,specialResources,taxLevel,children:[]}]}';
        var r3 = await callAIEditor(p3, maxTok);
        try {
          var o3 = JSON.parse(r3.match(/\{[\s\S]*\}/)[0]);
          Object.keys(o3).forEach(function(key) {
            var parts = key.split('/');
            var prefName = parts.length > 1 ? parts[1] : parts[0];
            // 在所有层级中查找匹配的府
            divs.forEach(function(prov) {
              if (prov.children) prov.children.forEach(function(pref) {
                if (pref.name === prefName && Array.isArray(o3[key])) {
                  o3[key].forEach(function(ch) { ensD(ch); if (!_allNames[ch.name]) { pref.children.push(ch); _allNames[ch.name] = true; } });
                }
              });
            });
          });
        } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'AdminGen P3') : console.warn('[AdminGen P3]', e); }
      }
    }

    if (typeof renderAdminTree === 'function') renderAdminTree();
    autoSave();

    // ═══ 第4轮：为缺主官的行政区配置主官+职位 ═══
    var _noGovNow = [];
    (function _findNoGov(list, depth) {
      list.forEach(function(d) {
        if (!d.governor && depth < 2) _noGovNow.push(d);
        if (d.children) _findNoGov(d.children, depth + 1);
      });
    })(divs, 0);

    if (_noGovNow.length > 0 && chars.length > 0) {
      showToast('第4轮：为' + _noGovNow.length + '个行政区配置主官……');
      var govList = _noGovNow.slice(0, 20).map(function(d) {
        return d.name + '（' + (d.level||'') + '，' + (d.officialPosition||'主官') + '）';
      }).join('\n');
      var usedGovs = {};
      (function _cg(list) { list.forEach(function(d) { if (d.governor) usedGovs[d.governor] = true; if (d.children) _cg(d.children); }); })(divs);
      var availChars = chars.filter(function(c) { return !usedGovs[c.name]; });
      if (availChars.length > 0) {
        var availList = availChars.map(function(c) {
          return c.name + ' 政' + (c.administration||50) + '/武' + (c.valor||50) + (c.location?' 在'+c.location:'');
        }).join('\n');
        var p4 = '你是' + dynasty + '的吏部尚书，负责地方官铨选。\n'
          + '以下行政区缺主官：\n' + govList + '\n\n'
          + '以下角色可任命（尚未任职）：\n' + availList + '\n\n'
          + '根据史实和角色能力铨选：文政能力高者任富庶之地，武勇高者任边疆军镇。\n'
          + '同时确认该行政区的officialPosition（主官职位名称）符合' + dynasty + '史实。\n'
          + '返回JSON：[{"division":"行政区名","governor":"角色名","officialPosition":"职位名(如节度使/知府/刺史)"}]\n一人一地。只返回JSON。';
        try {
          var r4 = await callAIEditor(p4, maxTok);
          var jm4 = r4.match(/\[[\s\S]*\]/);
          if (jm4) {
            var govAppts = JSON.parse(jm4[0]);
            var appointed = 0;
            govAppts.forEach(function(ga) {
              if (!ga.division || !ga.governor) return;
              (function _setGov(list) { list.forEach(function(d) {
                if (d.name === ga.division && !d.governor) {
                  d.governor = ga.governor;
                  if (ga.officialPosition) d.officialPosition = ga.officialPosition;
                  // 同步更新角色的location和officialTitle
                  var ch = chars.find(function(c) { return c.name === ga.governor; });
                  if (ch) {
                    ch.location = d.capital || d.name;
                    ch.officialTitle = ga.officialPosition || d.officialPosition || '';
                  }
                  appointed++;
                }
                if (d.children) _setGov(d.children);
              }); })(divs);
            });
            if (appointed > 0) showToast('已为' + appointed + '个行政区配置主官');
          }
        } catch(e4) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e4, 'AdminGen P4') : console.warn('[AdminGen P4]', e4); }
      }
    }

    if (typeof renderAdminTree === 'function') renderAdminTree();
    if (typeof updateAdminStats === 'function') updateAdminStats();
    autoSave();
    var tc = 0; (function cnt(l) { l.forEach(function(d) { tc++; if (d.children) cnt(d.children); }); })(divs);
    showToast('行政区划多轮生成完成！共' + tc + '个行政单位');
  } catch(e) { showToast('\u884C\u653F\u533A\u5212\u751F\u6210\u5931\u8D25: ' + e.message); (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'AdminGen') : console.error('[AdminGen]', e); }
}

// ============================================================
// 剧本信息单项AI生成
// ============================================================

/**
 * 读取 AI 生成模态框中已填入的参考信息/附加指令/当前日期。
 * 模态关闭后 DOM 值仍保留，故快捷生成按钮也能吃到这些 hint。
 * 用户每次重开模态会被清空（openAIGenModal 会 reset）。
 * @returns {{ref:string, extra:string, date:string, suffix:string}}
 */
function _getEditorAIHints() {
  var refEl = document.getElementById('aiGenRef');
  var extraEl = document.getElementById('aiGenPrompt');
  var dateEl = document.getElementById('aiGenDate');
  var ref = refEl ? refEl.value.trim() : '';
  var extra = extraEl ? extraEl.value.trim() : '';
  var date = dateEl ? dateEl.value.trim() : '';
  var suffix = '';
  if (date) suffix += '\n\u5F53\u524D\u65E5\u671F:' + date;
  if (ref) suffix += '\n\u53C2\u8003\u8D44\u6599:\n' + ref;
  if (extra) suffix += '\n\u9644\u52A0\u8981\u6C42:' + extra;
  return { ref: ref, extra: extra, date: date, suffix: suffix };
}
if (typeof window !== 'undefined') window._getEditorAIHints = _getEditorAIHints;

function _buildScriptContext() {
  var parts = [];
  if (scriptData.name) parts.push('剧本:' + scriptData.name);
  if (scriptData.dynasty) parts.push('朝代:' + scriptData.dynasty);
  if (scriptData.startYear) parts.push('起始年份:公元' + scriptData.startYear + '年');
  if (scriptData.dynastyPhaseHint) {
    var phaseMap = {founding:'初创开国',rising:'上升扩张',peak:'鼎盛全盛',stable:'守成平稳',declining:'衰落中兴',crisis:'危机末世'};
    parts.push('时代阶段:' + (phaseMap[scriptData.dynastyPhaseHint] || scriptData.dynastyPhaseHint));
  }
  if (scriptData.emperor) parts.push('当朝统治者:' + scriptData.emperor);
  if (scriptData.overview) parts.push('概述:' + scriptData.overview.substring(0, 500));
  if (scriptData.globalRules) parts.push('全局规则:' + scriptData.globalRules.substring(0, 200));
  var pi = scriptData.playerInfo || {};
  if (pi.playerRole) {
    var roleMap = {emperor:'皇帝/国君',regent:'摄政/权臣',general:'将军/武将',minister:'文臣/谋士',prince:'诸侯/藩王',merchant:'商人/平民',custom:pi.playerRoleCustom||'自定义'};
    parts.push('玩家定位:' + (roleMap[pi.playerRole] || pi.playerRole));
  }
  if (pi.characterName) parts.push('玩家角色:' + pi.characterName + (pi.characterTitle ? '(' + pi.characterTitle + ')' : ''));
  if (pi.factionName) parts.push('玩家势力:' + pi.factionName + (pi.factionType ? '(' + pi.factionType + ')' : ''));
  if (pi.factionDesc) parts.push('势力简况:' + pi.factionDesc.substring(0, 150));
  var chars = scriptData.characters || [];
  if (chars.length > 0) parts.push('角色(' + chars.length + '人):' + chars.slice(0, 10).map(function(c) { return c.name + (c.title ? '(' + c.title + ')' : ''); }).join('、'));
  var facs = scriptData.factions || [];
  if (facs.length > 0) parts.push('势力(' + facs.length + '个):' + facs.slice(0, 6).map(function(f) { return f.name + (f.leader ? '(' + f.leader + ')' : ''); }).join('、'));
  if (scriptData.worldSettings) {
    var ws = scriptData.worldSettings;
    var wsParts = [];
    if (ws.culture) wsParts.push('文化:' + ws.culture);
    if (ws.religion) wsParts.push('宗教:' + ws.religion);
    if (wsParts.length) parts.push(wsParts.join(' '));
  }
  // 财政/货币/央地/角色经济 配置摘要（供 AI 理解配置）
  var gk = scriptData.guoku, nt = scriptData.neitang, fc = scriptData.fiscalConfig;
  if (gk && (gk.balance || gk.monthlyIncome)) parts.push('帑廪:起始' + (gk.balance||0) + '/月入' + (gk.monthlyIncome||0) + '/月支' + (gk.monthlyExpense||0));
  if (nt && nt.balance) parts.push('内帑:起始' + nt.balance + (nt.huangzhuangAcres ? '/皇庄' + nt.huangzhuangAcres + '亩' : ''));
  if (fc) {
    if (fc.centralLocalRules && fc.centralLocalRules.preset) parts.push('央地分账预设:' + fc.centralLocalRules.preset);
    if (fc.currencyRules) {
      var cr = fc.currencyRules;
      var curInfo = [];
      if (cr.enabledCoins) curInfo.push('启用币:' + Object.keys(cr.enabledCoins).filter(function(k){return cr.enabledCoins[k];}).join('/'));
      if (cr.initialStandard) curInfo.push('本位:' + cr.initialStandard);
      if (cr.defaultPresets && cr.defaultPresets.paper) curInfo.push('纸币:' + cr.defaultPresets.paper);
      if (curInfo.length) parts.push('货币政策:' + curInfo.join(' '));
    }
    if (fc.taxesEnabled) {
      var disabled = Object.keys(fc.taxesEnabled).filter(function(k){return !fc.taxesEnabled[k];});
      if (disabled.length) parts.push('禁用税种:' + disabled.join('/'));
    }
    if (fc.customTaxes && fc.customTaxes.length) parts.push('自定义税种:' + fc.customTaxes.length + '条');
  }
  // 户口系统摘要
  var pop = scriptData.populationConfig;
  if (pop) {
    var popInfo = [];
    if (pop.initial) {
      if (pop.initial.nationalHouseholds) popInfo.push('户 ' + pop.initial.nationalHouseholds);
      if (pop.initial.nationalMouths) popInfo.push('口 ' + pop.initial.nationalMouths);
    }
    if (pop.dingAgeRange) popInfo.push('丁龄 ' + pop.dingAgeRange.join('-'));
    if (pop.categoryEnabled) popInfo.push('色目:' + pop.categoryEnabled.join('/'));
    if (pop.gradeSystem) popInfo.push('户等:' + pop.gradeSystem);
    if (popInfo.length) parts.push('户口配置:' + popInfo.join(' '));
  }
  // 环境承载力摘要
  var env = scriptData.environmentConfig;
  if (env) {
    if (env.climatePhase) parts.push('气候:' + env.climatePhase);
    if (env.initialCarrying && env.initialCarrying.byRegion) parts.push('区域承载力已配 ' + Object.keys(env.initialCarrying.byRegion).length + ' 处');
  }
  // 角色经济字段摘要（统计有多少角色填写了新字段）
  if (chars.length > 0) {
    var stat = { zi:0, familyMembers:0, career:0, innerThought:0, stressSources:0 };
    chars.forEach(function(c) {
      if (c.zi || c.courtesyName) stat.zi++;
      if (Array.isArray(c.familyMembers) && c.familyMembers.length) stat.familyMembers++;
      if (Array.isArray(c.career) && c.career.length) stat.career++;
      if (c.innerThought) stat.innerThought++;
      if (Array.isArray(c.stressSources) && c.stressSources.length) stat.stressSources++;
    });
    var statParts = [];
    Object.keys(stat).forEach(function(k) { if (stat[k] > 0) statParts.push(k + ':' + stat[k]); });
    if (statParts.length) parts.push('角色完整字段:' + statParts.join(' '));
  }
  return parts.join('\n');
}

// AI生成剧本总述
async function aiGenOverview() {
  var dynasty = scriptData.dynasty || '';
  var emperor = scriptData.emperor || '';
  if (!dynasty && !emperor) { showToast('请先填写朝代或统治者'); return; }
  showLoading('AI生成总述...', 30);
  try {
    var ctx = _buildScriptContext();
    var prompt = '你是历史剧本设计师。请根据以下信息生成一段300-600字的剧本总述，描述时代背景、政治局势、主要矛盾和玩家面临的挑战。\n\n' + ctx + '\n\n要求：\n- 文笔优美，有代入感\n- 准确反映该历史时期的实际状况\n- 突出戏剧性冲突和玩家的处境\n- 直接输出文本，不要JSON格式';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 2000);
    result = result.replace(/```[\s\S]*?```/g, '').trim();
    if (result.length > 50) {
      scriptData.overview = result;
      var el = document.getElementById('scriptOverview');
      if (el) el.value = result;
      autoSave();
      showToast('总述已生成');
    } else {
      showToast('生成内容过短，请重试');
    }
  } catch(e) { showToast('生成失败: ' + e.message); }
  hideLoading();
}

// AI生成开场白
async function aiGenOpeningText() {
  var dynasty = scriptData.dynasty || '';
  var overview = scriptData.overview || '';
  if (!dynasty && !overview) { showToast('请先填写朝代或剧本总述'); return; }
  showLoading('AI生成开场白...', 30);
  try {
    var ctx = _buildScriptContext();
    var prompt = '你是历史小说家。请根据以下剧本信息生成一段400-800字的游戏开场白。\n\n' + ctx + '\n\n要求：\n- 文学性强，像历史小说的开篇\n- 渲染时代氛围，营造紧张感或史诗感\n- 自然引出玩家角色的处境\n- 可以描写环境、气氛、人物内心\n- 直接输出文本，不要JSON格式，不要标题';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 2500);
    result = result.replace(/```[\s\S]*?```/g, '').trim();
    if (result.length > 80) {
      scriptData.openingText = result;
      var el = document.getElementById('scriptOpeningText');
      if (el) el.value = result;
      autoSave();
      showToast('开场白已生成');
    } else {
      showToast('生成内容过短，请重试');
    }
  } catch(e) { showToast('生成失败: ' + e.message); }
  hideLoading();
}

// AI生成全局规则
async function aiGenGlobalRules() {
  var dynasty = scriptData.dynasty || '';
  if (!dynasty && !scriptData.overview) { showToast('请先填写朝代或剧本总述'); return; }
  showLoading('AI生成全局规则...', 30);
  try {
    var ctx = _buildScriptContext();
    var prompt = '你是历史模拟游戏规则设计师。请根据以下剧本信息生成AI推演必须遵守的全局规则（5-15条）。\n\n' + ctx + '\n\n要求：\n- 每条规则一行，简洁明确\n- 反映该朝代/时期的特殊制度和约束（如唐代的藩镇体制、宋代的重文轻武、明代的内阁/宦官等）\n- 包含政治、军事、经济、文化方面的核心规则\n- 规定AI不应逾越的历史底线（如不应出现该朝代不存在的事物）\n- 直接输出规则文本，每条规则一行，不要JSON格式，不要编号';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 1500);
    result = result.replace(/```[\s\S]*?```/g, '').trim();
    // 去掉可能的编号前缀
    result = result.replace(/^\d+[\.\)、]\s*/gm, '');
    if (result.length > 30) {
      scriptData.globalRules = result;
      var el = document.getElementById('gs-globalRules');
      if (el) el.value = result;
      autoSave();
      showToast('全局规则已生成');
    } else {
      showToast('生成内容过短，请重试');
    }
  } catch(e) { showToast('生成失败: ' + e.message); }
  hideLoading();
}

// ============================================================
// AI生成势力关系矩阵
// ============================================================
async function aiGenFactionRelations() {
  var facs = scriptData.factions || [];
  var pi = scriptData.playerInfo || {};
  var allNames = facs.map(function(f) { return f.name; });
  if (pi.factionName && allNames.indexOf(pi.factionName) < 0) allNames.unshift(pi.factionName);
  if (allNames.length < 2) { showToast('至少需要2个势力才能生成关系'); return; }

  showLoading('AI生成势力关系...', 30);
  try {
    var ctx = _buildScriptContext();
    var facDesc = facs.map(function(f) {
      return f.name + (f.type ? '(' + f.type + ')' : '') + (f.leader ? ' 首领:' + f.leader : '') + (f.strength ? ' 实力:' + f.strength : '') + (f.attitude ? ' 态度:' + f.attitude : '');
    }).join('\n');

    var prompt = '你是历史外交关系专家。根据以下剧本和势力信息，生成所有势力之间的两两关系。\n\n'
      + ctx + '\n\n【势力列表】\n' + facDesc
      + '\n\n请生成势力间的关系矩阵，返回JSON数组：\n'
      + '[{"from":"势力A","to":"势力B","type":"关系类型","value":数值(-100到100),"desc":"一句话描述"}]\n'
      + '\n关系类型：联盟/友好/中立/敌视/交战/朝贡/宗藩/名义从属'
      + '\n注意：\n- 每对势力只需一个方向（A→B）\n- value正=友好 负=敌对\n- 必须符合历史\n- 玩家势力(' + (pi.factionName || '未知') + ')与各势力关系也要包含\n只输出JSON。';
    prompt += _getEditorAIHints().suffix;

    var result = await callAIEditor(prompt, 3000);
    var cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('无法解析JSON');
    var arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('返回为空');

    if (!scriptData.factionRelations) scriptData.factionRelations = [];
    var existing = {};
    scriptData.factionRelations.forEach(function(r) { existing[r.from + '→' + r.to] = true; });
    var added = 0;
    arr.forEach(function(r) {
      if (!r.from || !r.to) return;
      r.value = Math.max(-100, Math.min(100, parseInt(r.value) || 0));
      if (!existing[r.from + '→' + r.to]) {
        scriptData.factionRelations.push(r);
        existing[r.from + '→' + r.to] = true;
        added++;
      }
    });

    if (typeof renderFactionRelationsMatrix === 'function') renderFactionRelationsMatrix();
    autoSave();
    showToast('已生成 ' + added + ' 条势力关系');
  } catch(e) {
    showToast('生成失败: ' + e.message);
    console.error('[aiGenFactionRelations]', e);
  }
  hideLoading();
}

// ============================================================
// AI 一键生成财政配置（帑廪 + 内帑 + 央地 + 货币）
// ============================================================
async function aiGenFiscalConfig() {
  var dynasty = scriptData.dynasty || '';
  if (!dynasty && !scriptData.overview) { showToast('请先填写朝代或剧本总述'); return; }
  showLoading('AI生成财政配置...', 30);
  try {
    var ctx = _buildScriptContext();
    var prompt = '你是古代财政制度专家。根据剧本朝代与局势，生成合理的财政配置 JSON。\n\n' + ctx + '\n\n要求返回 JSON：\n'
      + '{\n'
      + '  "guoku": {"balance": 起始帑廪两数, "monthlyIncome": 月入, "monthlyExpense": 月支, "grainStock": 起始粮石, "clothStock": 起始布匹},\n'
      + '  "neitang": {"balance": 起始内帑两数, "monthlyIncome": 月入, "huangzhuangAcres": 皇庄亩数},\n'
      + '  "centralLocalRules": {"preset": "qin_junxian|han_tuien|tang_liushi|song_zhuanyun|ming_qiyun_cunliu|qing_dingliu"},\n'
      + '  "currencyRules": {"enabledCoins": {"gold":bool,"silver":bool,"copper":bool,"iron":bool,"shell":bool,"paper":bool}, "initialStandard": "copper|silver|copper_paper|silver_copper_paper"}\n'
      + '}\n\n按朝代按史实：秦汉铜金、唐铜银金、宋铜银铁纸、元明清银铜纸。\n'
      + '帑廪规模按朝代常额：唐初 500 万、盛唐 1500 万、宋 4000 万、明盛 2000 万、清康乾 6000 万两。\n只输出 JSON。';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 1500);
    var cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('无法解析');
    var parsed = JSON.parse(match[0]);
    if (parsed.guoku) scriptData.guoku = Object.assign(scriptData.guoku || {}, parsed.guoku);
    if (parsed.neitang) scriptData.neitang = Object.assign(scriptData.neitang || {}, parsed.neitang);
    if (!scriptData.fiscalConfig) scriptData.fiscalConfig = {};
    if (parsed.centralLocalRules) scriptData.fiscalConfig.centralLocalRules = parsed.centralLocalRules;
    if (parsed.currencyRules) scriptData.fiscalConfig.currencyRules = parsed.currencyRules;
    autoSave();
    showToast('财政配置已生成');
  } catch(e) { showToast('失败: ' + e.message); (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiGenFiscal') : console.error('[aiGenFiscal]', e); }
  hideLoading();
}

// ============================================================
// AI 一键生成户口配置
// ============================================================
async function aiGenPopulationConfig() {
  var dynasty = scriptData.dynasty || '';
  if (!dynasty) { showToast('请先填写朝代'); return; }
  showLoading('AI生成户口配置...', 30);
  try {
    var ctx = _buildScriptContext();
    var prompt = '你是古代户籍制度专家。根据剧本朝代与人口规模，生成合理户口配置 JSON。\n\n' + ctx + '\n\n'
      + '要求返回：\n'
      + '{\n'
      + '  "initial": {"nationalHouseholds": 户数, "nationalMouths": 口数, "nationalDing": 丁数},\n'
      + '  "dingAgeRange": [丁始龄, 丁终龄],\n'
      + '  "categoryEnabled": ["bianhu","junhu","jianghu",...],\n'
      + '  "gradeSystem": "tang_9|song_5|ming_10|none"\n'
      + '}\n\n按朝代史实：\n'
      + '- 汉：户 1200万 口 6000万 丁 1800万，丁龄 15-56\n'
      + '- 唐盛：户 900万 口 5300万 丁 1600万，丁龄 21-59，户等 tang_9\n'
      + '- 宋：户 2000万 口 1亿 丁 3000万，户等 song_5\n'
      + '- 明：户 1000万 口 6000万 丁 1800万，丁龄 16-60，户等 ming_10\n'
      + '- 清康乾：户 4000万 口 3亿 丁 9000万，无户等\n'
      + '色目户：编户必有，军户/匠户/僧道常见，乐户/疍户仅特殊朝代。\n只输出 JSON。';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 1500);
    var cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('无法解析');
    var parsed = JSON.parse(match[0]);
    if (!scriptData.populationConfig) scriptData.populationConfig = {};
    Object.assign(scriptData.populationConfig, parsed);
    autoSave();
    showToast('户口配置已生成');
  } catch(e) { showToast('失败: ' + e.message); (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiGenPop') : console.error('[aiGenPop]', e); }
  hideLoading();
}

// ============================================================
// AI 一键生成环境承载力配置
// ============================================================
async function aiGenEnvironmentConfig() {
  var dynasty = scriptData.dynasty || '';
  if (!dynasty) { showToast('请先填写朝代'); return; }
  showLoading('AI生成环境配置...', 30);
  try {
    var ctx = _buildScriptContext();
    var regionList = (scriptData.regions || []).slice(0, 12).map(function(r){return r.id||r.name;}).join('、');
    var prompt = '你是古代环境学专家。根据剧本朝代与区域，生成环境承载力配置 JSON。\n\n' + ctx + '\n\n区域：' + (regionList || '（无区域配置）') + '\n\n'
      + '要求返回：\n'
      + '{\n'
      + '  "climatePhase": "normal|little_ice_age|medieval_warm",\n'
      + '  "initialCarrying": {"byRegion": {"区域名": {"arableArea": 耕地亩, "forestArea": 森林亩, "aquiferLevel": 0-1, "soilFertility": 0-1}}},\n'
      + '  "initialScars": {"byRegion": {"区域名": {"deforestation": 0-1, "soilErosion": 0-1, "waterTableDrop": 0-1}}}\n'
      + '}\n\n气候按朝代史实：\n'
      + '- 唐/宋前：medieval_warm（暖）\n'
      + '- 明末/清初：little_ice_age（小冰期）\n'
      + '- 其他：normal\n'
      + '初始疤痕按朝代末期渐重：开国低、末世高。\n只输出 JSON。';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 2500);
    var cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('无法解析');
    var parsed = JSON.parse(match[0]);
    if (!scriptData.environmentConfig) scriptData.environmentConfig = {};
    Object.assign(scriptData.environmentConfig, parsed);
    autoSave();
    showToast('环境配置已生成');
  } catch(e) { showToast('失败: ' + e.message); (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiGenEnv') : console.error('[aiGenEnv]', e); }
  hideLoading();
}

// ============================================================
// AI 一键生成权力系统初值（皇威/皇权/民心/腐败/党争）
// ============================================================
async function aiGenAuthorityConfig() {
  var dynasty = scriptData.dynasty || '';
  if (!dynasty) { showToast('请先填写朝代'); return; }
  showLoading('AI生成权力初值...', 30);
  try {
    var ctx = _buildScriptContext();
    var prompt = '你是古代政治史专家。根据剧本朝代/阶段/国势，生成合理的权力系统初值 JSON。\n\n' + ctx + '\n\n'
      + '要求返回：\n'
      + '{\n'
      + '  "huangwei": 0-100,    // 皇威（帝王威望）\n'
      + '  "huangquan": 0-100,   // 皇权（集权程度）\n'
      + '  "minxin": 0-100,      // 民心\n'
      + '  "corruption": 0-100,  // 腐败度\n'
      + '  "partyStrife": 0-100  // 党争度\n'
      + '}\n\n'
      + '参考：\n'
      + '- 开国盛世（贞观/永乐/康熙中）：huangwei 70-85, huangquan 65-75, minxin 75-85, corruption 15-30, partyStrife 10-25\n'
      + '- 鼎盛中叶（开元/万历早）：huangwei 75-85, huangquan 50-65, minxin 65-75, corruption 30-45, partyStrife 25-40\n'
      + '- 衰颓末期（晚唐/崇祯）：huangwei 20-40, huangquan 25-40, minxin 20-40, corruption 60-80, partyStrife 60-85\n'
      + '- 暴君时期（秦始皇末/隋炀帝末）：huangwei 90-95, huangquan 80-90, minxin 20-35, corruption 50-70\n'
      + '- 权臣时期（汉献帝/曹魏末/唐后期）：huangwei 25-40, huangquan 10-25, minxin 30-45, corruption 60-75\n'
      + '只输出 JSON。';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 800);
    var cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('无法解析');
    var parsed = JSON.parse(match[0]);
    if (!scriptData.authorityConfig) scriptData.authorityConfig = {};
    if (!scriptData.authorityConfig.initial) scriptData.authorityConfig.initial = {};
    ['huangwei','huangquan','minxin','corruption','partyStrife'].forEach(function(k) {
      if (typeof parsed[k] === 'number') scriptData.authorityConfig.initial[k] = Math.max(0, Math.min(100, parsed[k]));
    });
    autoSave();
    showToast('权力初值已生成');
  } catch(e) { showToast('失败: ' + e.message); (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiGenAuth') : console.error('[aiGenAuth]', e); }
  hideLoading();
}

// ============================================================
// AI 润色结构化字段（familyMembers / regionOverrides / customTaxes / familyStatus 等）
// ============================================================
async function aiPolishStructuredField(fieldPath, description, context) {
  // fieldPath 例如 'characters.0.familyMembers' 或 'fiscalConfig.centralLocalRules.regionOverrides'
  var parts = fieldPath.split('.');
  var obj = scriptData;
  for (var i = 0; i < parts.length; i++) {
    if (obj === undefined || obj === null) {
      showToast('字段路径不存在：' + fieldPath);
      return;
    }
    obj = obj[parts[i]];
  }
  if (obj === undefined) { showToast('字段为空'); return; }
  showLoading('AI润色' + (description || fieldPath) + '...', 30);
  try {
    var ctx = _buildScriptContext();
    var current = JSON.stringify(obj, null, 2);
    var prompt = '你是古代历史剧本设计师。请润色以下结构化字段的内容，使其更具历史感、戏剧性、内在一致性，但**保持 JSON 结构完全不变**。\n\n'
      + ctx + '\n\n'
      + '字段说明：' + (description || fieldPath) + '\n'
      + (context ? '上下文：' + context + '\n' : '')
      + '\n当前内容：\n' + current + '\n\n'
      + '润色要求：\n- 结构完全保持（字段名、嵌套层次、数组顺序不变）\n'
      + '- 文本类字段（name/desc/reason/title/event 等）丰富化，符合朝代风格\n'
      + '- 数值字段只在明显不合理时微调\n'
      + '- 历史名词规范化（官职/地名/称谓符合朝代）\n'
      + '只输出 JSON，不要说明，不要 markdown。';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 4000);
    var cleaned = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    var match = cleaned.match(/^[\[{][\s\S]*[\]}]$/);
    if (!match) { match = cleaned.match(/[\[{][\s\S]*[\]}]/); if (match) cleaned = match[0]; }
    var parsed = JSON.parse(cleaned);
    // 回写
    var target = scriptData;
    for (var j = 0; j < parts.length - 1; j++) target = target[parts[j]];
    target[parts[parts.length - 1]] = parsed;
    autoSave();
    showToast('已润色 ' + (description || fieldPath));
  } catch(e) { showToast('润色失败: ' + e.message); (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'aiPolish') : console.error('[aiPolish]', e); }
  hideLoading();
}

// 快捷入口 —— 单角色 familyMembers 润色
async function aiPolishCharFamilyMembers(charIndex) {
  if (!scriptData.characters || !scriptData.characters[charIndex]) { showToast('角色不存在'); return; }
  var c = scriptData.characters[charIndex];
  if (!c.familyMembers || c.familyMembers.length === 0) { showToast('该角色暂无家族成员'); return; }
  var ctx = c.name + '（' + (c.title || '') + '，' + (c.age || '?') + '岁' + (c.family ? '，出身 ' + c.family : '') + '）';
  await aiPolishStructuredField('characters.' + charIndex + '.familyMembers', '角色家族成员表', ctx);
}

// 快捷入口 —— 央地区域特例
async function aiPolishRegionOverrides() {
  if (!scriptData.fiscalConfig || !scriptData.fiscalConfig.centralLocalRules || !scriptData.fiscalConfig.centralLocalRules.regionOverrides) {
    showToast('尚无 regionOverrides 可润色'); return;
  }
  await aiPolishStructuredField('fiscalConfig.centralLocalRules.regionOverrides', '央地分账区域特例');
}

// 快捷入口 —— 自定义税种
async function aiPolishCustomTaxes() {
  if (!scriptData.fiscalConfig || !scriptData.fiscalConfig.customTaxes || scriptData.fiscalConfig.customTaxes.length === 0) {
    showToast('尚无 customTaxes 可润色'); return;
  }
  await aiPolishStructuredField('fiscalConfig.customTaxes', '自定义税种');
}

// 暴露到 window
if (typeof window !== 'undefined') {
  window.aiGenFiscalConfig = aiGenFiscalConfig;
  window.aiGenPopulationConfig = aiGenPopulationConfig;
  window.aiGenEnvironmentConfig = aiGenEnvironmentConfig;
  window.aiGenAuthorityConfig = aiGenAuthorityConfig;
  window.aiPolishStructuredField = aiPolishStructuredField;
  window.aiPolishCharFamilyMembers = aiPolishCharFamilyMembers;
  window.aiPolishRegionOverrides = aiPolishRegionOverrides;
  window.aiPolishCustomTaxes = aiPolishCustomTaxes;
}

// ============================================================
// 世界设定单项AI生成
// ============================================================
async function aiGenWorldSettingField(fieldKey, fieldLabel) {
  var dynasty = scriptData.dynasty || '';
  if (!dynasty && !scriptData.overview) { showToast('请先填写朝代或剧本总述'); return; }
  showLoading('AI生成' + fieldLabel + '...', 30);
  try {
    var ctx = _buildScriptContext();
    var fieldMap = {
      culture: '文化风俗（社会风气、礼仪制度、文学艺术、教育体系、民间习俗等）',
      weather: '气候天象（地理环境、四季特征、自然灾害、对农业军事的影响等）',
      religion: '宗教信仰（官方信仰、民间信仰、僧道势力、宗教对政治的影响等）',
      economy: '经济形态（农业/商业/手工业状况、货币制度、赋税体系、贸易路线等）',
      technology: '技术水平（军事科技、农业技术、建筑水平、航海/印刷/火药等关键技术）',
      diplomacy: '外交格局（周边势力关系、朝贡体系、和亲互市、战争与和平等）'
    };
    var prompt = '你是历史文化专家。请根据以下剧本信息，详细描述该时代的' + fieldLabel + '。\n\n' + ctx + '\n\n请描述：' + (fieldMap[fieldKey]||fieldLabel) + '\n\n要求：100-200字，准确反映历史实际，有细节和具体例子。直接输出文本。';
    prompt += _getEditorAIHints().suffix;
    var result = await callAIEditor(prompt, 1500);
    result = result.replace(/```[\s\S]*?```/g, '').trim();
    if (result.length > 30) {
      scriptData.worldSettings[fieldKey] = result;
      var elMap = {culture:'wsCultureText',weather:'wsWeatherText',religion:'wsReligionText',economy:'wsEconomyText',technology:'wsTechText',diplomacy:'wsDiplomacyText'};
      var el = document.getElementById(elMap[fieldKey]);
      if (el) el.value = result;
      autoSave();
      showToast(fieldLabel + '已生成');
    } else { showToast('生成内容过短'); }
  } catch(e) { showToast('生成失败: ' + e.message); }
  hideLoading();
}

