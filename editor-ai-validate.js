// ============================================================
// 剧本编辑器 — AI 智能核验与完善 (AI Validate & Improve)
// 依赖: editor-core.js (scriptData, escHtml, autoSave, etc.)
// ============================================================
  // ── AI 智能核验 ────────────────────────────────────────────
  function openAIValidateModal() {
    _lastValidateIssues = [];
    var ib = document.getElementById('aiValidateBtnImprove');
    if (ib) ib.style.display = 'none';
    document.getElementById('aiValidateModal').style.display = 'flex';
    document.getElementById('aiValidateResult').innerHTML = '';
    document.getElementById('aiValidateStatus').textContent = '';
  }

  function closeAIValidateModal() {
    document.getElementById('aiValidateModal').style.display = 'none';
  }

  function doAIValidate() {
    var statusEl = document.getElementById('aiValidateStatus');
    var resultEl = document.getElementById('aiValidateResult');
    statusEl.textContent = '正在构建核验信息...';
    resultEl.innerHTML = '';
    document.getElementById('aiValidateBtnRun').disabled = true;

    // Collect summary of all scriptData sections
    var sd = scriptData;
    var lines = [];

    // Script info
    var _eraCtx = '';
    if (sd.gameSettings && sd.gameSettings.enableEraName) {
      var _eras = (sd.gameSettings.eraNames || []).filter(function(e){ return e.name; });
      if (_eras.length) _eraCtx = ' 年号列表:' + _eras.map(function(e){ return e.name+'(起:'+e.startYear+')'; }).join(',');
      else if (sd.gameSettings.eraName) _eraCtx = ' 年号:' + sd.gameSettings.eraName;
    }
    lines.push('【剧本信息】名称:' + (sd.name||sd.title||'无') + ' 朝代:' + (sd.dynasty||'无') + ' 起始年:' + ((sd.gameSettings&&sd.gameSettings.startYear)||sd.year||'无') + _eraCtx);

    // Characters
    var chars = sd.characters || [];
    if (chars.length > 0) {
      lines.push('【人物】共' + chars.length + '个:');
      chars.forEach(function(c) {
        var info = '  - ' + c.name;
        if (c.faction) info += ' [势力:' + c.faction + ']';
        if (c.party) info += ' [党派:' + c.party + ']';
        if (c.className) info += ' [阶层:' + c.className + ']';
        if (c.officialTitle) info += ' [官职:' + c.officialTitle + ']';
        if (c.vassalType) info += ' [封臣类型:' + c.vassalType + ']';
        if (c.role) info += ' [职位:' + c.role + ']';
        if (c.faith) info += ' [信仰:' + c.faith + ']';
        if (c.location) info += ' [所在:' + c.location + ']';
        else info += ' [所在:未设置⚠]';
        lines.push(info);
      });
    } else {
      lines.push('【人物】共0个');
    }

    // Factions
    var facs = sd.factions || [];
    if (facs.length > 0) {
      lines.push('【势力】共' + facs.length + '个:');
      facs.forEach(function(f) {
        var info = '  - ' + f.name;
        if (f.leader) info += ' [首领:' + f.leader + ']';
        if (f.leaderTitle) info += ' [首领头衔:' + f.leaderTitle + ']';
        if (f.territory) info += ' [领土:' + f.territory + ']';
        lines.push(info);
      });
    } else {
      lines.push('【势力】共0个');
    }

    // Parties
    var parts = sd.parties || [];
    if (parts.length > 0) {
      lines.push('【党派】共' + parts.length + '个:');
      parts.forEach(function(p) {
        var info = '  - ' + p.name;
        if (p.leader) info += ' [首领:' + p.leader + ']';
        if (p.members) info += ' [成员:' + p.members + ']';
        lines.push(info);
      });
    }

    // Classes
    var cls = sd.classes || [];
    if (cls.length) lines.push('【阶层】共' + cls.length + '个: ' + cls.map(function(c){return c.name;}).join('、'));

    // Items
    var items = sd.items || [];
    if (items.length) lines.push('【物品】共' + items.length + '个: ' + items.map(function(i){return i.name;}).join('、'));

    // Military
    var mil = sd.military || {};
    var milInitial = mil.initialTroops || [];
    var milSystem = mil.militarySystem || [];
    var milOther = [].concat(mil.troops||[]).concat(mil.facilities||[]).concat(mil.organization||[]).concat(mil.campaigns||[]);
    if (milInitial.length > 0) {
      lines.push('【开局部队】共' + milInitial.length + '支:');
      milInitial.forEach(function(t) {
        var info = '  - ' + t.name;
        if (t.commander) info += ' [统帅:' + t.commander + ']';
        if (t.location || t.garrison) info += ' [驻地:' + (t.location || t.garrison) + ']';
        if (t.size || t.strength) info += ' [兵力:' + (t.size || t.strength) + ']';
        lines.push(info);
      });
    }
    if (milSystem.length > 0) {
      lines.push('【军制系统】共' + milSystem.length + '项: ' + milSystem.map(function(m){return m.name;}).join('、'));
    }
    if (milOther.length > 0) {
      lines.push('【其他军事】共' + milOther.length + '项: ' + milOther.map(function(m){return m.name;}).join('、'));
    }

    // Government
    var gov = sd.government || {};
    if (gov.name) lines.push('【官制】' + gov.name + (gov.description ? ': ' + gov.description.slice(0,60) : ''));
    var govNodes = gov.nodes || [];
    if (govNodes.length > 0) {
      lines.push('【官职节点】共' + govNodes.length + '个:');
      function listGovNodes(nodes, indent) {
        nodes.forEach(function(n) {
          var info = indent + '- ' + n.name;
          if (n.holder) info += ' [任职者:' + n.holder + ']';
          if (n.rank) info += ' [品级:' + n.rank + ']';
          lines.push(info);
          if (n.positions && n.positions.length > 0) {
            n.positions.forEach(function(pos) {
              var posInfo = indent + '  · ' + pos.name;
              if (pos.holder) posInfo += ' [任职者:' + pos.holder + ']';
              if (pos.rank) posInfo += ' [品级:' + pos.rank + ']';
              lines.push(posInfo);
            });
          }
          if (n.subs && n.subs.length > 0) {
            listGovNodes(n.subs, indent + '  ');
          }
        });
      }
      listGovNodes(govNodes, '  ');
    }

    // Tech tree
    var tech = sd.techTree || {};
    var techAll = [].concat(tech.military||[]).concat(tech.civil||[]);
    if (techAll.length) lines.push('【科技】共' + techAll.length + '项: ' + techAll.map(function(t){return t.name;}).join('、'));

    // Civic tree
    var civ = sd.civicTree || {};
    var civAll = [].concat(civ.city||[]).concat(civ.policy||[]).concat(civ.resource||[]).concat(civ.corruption||[]);
    if (civAll.length) lines.push('【民政】共' + civAll.length + '项: ' + civAll.map(function(c){return c.name;}).join('、'));

    // Rules & Events
    var rules = sd.rules || {};
    var rulesAll = [].concat(rules.base||[]).concat(rules.combat||[]).concat(rules.economy||[]).concat(rules.diplomacy||[]);
    if (rulesAll.length) lines.push('【规则】共' + rulesAll.length + '项: ' + rulesAll.map(function(r){return r.name;}).join('、'));

    var evts = sd.events || {};
    var evtsAll = [].concat(evts.historical||[]).concat(evts.random||[]).concat(evts.conditional||[]).concat(evts.story||[]).concat(evts.chain||[]);
    if (evtsAll.length > 0) {
      lines.push('【事件】共' + evtsAll.length + '个:');
      evtsAll.slice(0, 20).forEach(function(e) {
        var info = '  - ' + (e.name || e.title || '未命名');
        if (e.type) info += ' [类型:' + e.type + ']';
        // 尝试提取事件描述中提到的人物和势力
        var desc = e.description || e.content || e.effect || '';
        if (desc.length > 0) {
          info += ' [涉及:' + desc.slice(0, 50) + '...]';
        }
        lines.push(info);
      });
      if (evtsAll.length > 20) {
        lines.push('  ... 等共' + evtsAll.length + '个事件');
      }
    }

    // Map
    var map = sd.map || {};
    var mapAll = [].concat(map.city||[]).concat(map.strategic||[]).concat(map.geo||[]).concat(map.items||[]);
    if (mapAll.length > 0) {
      lines.push('【地图】共' + mapAll.length + '地点:');
      mapAll.forEach(function(m) {
        var info = '  - ' + m.name;
        if (m.type) info += ' [类型:' + m.type + ']';
        if (m.owner) info += ' [归属:' + m.owner + ']';
        if (m.controller) info += ' [控制:' + m.controller + ']';
        if (m.population) info += ' [人口:' + m.population + ']';
        lines.push(info);
      });
    }

    // World settings
    var ws = sd.worldSettings || {};
    var wsKeys = ['culture','weather','religion','economy','technology','diplomacy'];
    var wsLabels = {culture:'文化',weather:'气候',religion:'宗教',economy:'经济',technology:'科技',diplomacy:'外交'};
    wsKeys.forEach(function(k){ if (ws[k]) lines.push('【世界设定-' + wsLabels[k] + '】' + ws[k].slice(0,80)); });

    // Economy Config
    var ec = sd.economyConfig || {};
    if (ec.currency || ec.baseIncome) {
      lines.push('【经济配置】货币:' + (ec.currency||'无') + ' 基础收入:' + (ec.baseIncome||0) + ' 税率:' + (ec.taxRate||0));
    }

    // Post System
    var ps = sd.postSystem || {};
    if (ps.postRules && ps.postRules.length) {
      lines.push('【岗位系统】共' + ps.postRules.length + '个岗位规则: ' + ps.postRules.map(function(p){return p.positionName||p.name;}).join('、'));
    }

    // Vassal System
    var vs = sd.vassalSystem || {};
    if (vs.vassalTypes && vs.vassalTypes.length) {
      lines.push('【封臣系统】共' + vs.vassalTypes.length + '个封臣类型: ' + vs.vassalTypes.map(function(v){return v.name;}).join('、'));
      if (vs.officialVassalMapping) {
        var mappingStr = Object.keys(vs.officialVassalMapping).map(function(k) {
          return k + '→' + vs.officialVassalMapping[k];
        }).join('、');
        lines.push('【官爵对应表】' + mappingStr);
      }
    }

    // Title System
    var ts = sd.titleSystem || {};
    if (ts.titleRanks && ts.titleRanks.length) {
      lines.push('【头衔系统】共' + ts.titleRanks.length + '个头衔等级: ' + ts.titleRanks.map(function(t){return t.name;}).join('、'));
    }

    // Building System
    var bs = sd.buildingSystem || {};
    if (bs.buildingTypes && bs.buildingTypes.length) {
      lines.push('【建筑系统】共' + bs.buildingTypes.length + '个建筑类型: ' + bs.buildingTypes.map(function(b){return b.name;}).join('、'));
    }

    // Admin Hierarchy
    if (sd.adminHierarchy) {
      var totalDivisions = 0;
      var divisionsWithGovernor = 0;
      function countDivisions(divs) {
        for (var i = 0; i < divs.length; i++) {
          totalDivisions++;
          if (divs[i].governor) divisionsWithGovernor++;
          if (divs[i].children && divs[i].children.length > 0) {
            countDivisions(divs[i].children);
          }
        }
      }
      var factionCount = 0;
      for (var fid in sd.adminHierarchy) {
        factionCount++;
        if (sd.adminHierarchy[fid].divisions) {
          countDivisions(sd.adminHierarchy[fid].divisions);
        }
      }
      if (totalDivisions > 0) {
        lines.push('【行政区划】共' + factionCount + '个势力的行政体系，' + totalDivisions + '个行政单位，其中' + divisionsWithGovernor + '个已任命主官');
        // 检查角色location与行政区划匹配度
        var _allDivNames = [];
        function _collectNames(divs) { divs.forEach(function(d) { if (d.name) _allDivNames.push(d.name); if (d.divisions) _collectNames(d.divisions); if (d.children) _collectNames(d.children); }); }
        for (var _fk in sd.adminHierarchy) { if (sd.adminHierarchy[_fk].divisions) _collectNames(sd.adminHierarchy[_fk].divisions); }
        if (_allDivNames.length > 0 && sd.characters) {
          var _locMismatch = sd.characters.filter(function(c) { return c.location && _allDivNames.indexOf(c.location) < 0; });
          if (_locMismatch.length > 0) {
            lines.push('  ⚠ ' + _locMismatch.length + '个角色的所在地不在行政区划中: ' + _locMismatch.slice(0,5).map(function(c){ return c.name+'('+c.location+')'; }).join('、'));
          }
        }
        // 管辖类型(autonomy)合理性——按朝代审视
        var _autStats = { zhixia:0, fanguo:0, fanzhen:0, jimi:0, chaogong:0, missing:0 };
        function _countAut(divs) {
          divs.forEach(function(d) {
            if (d.autonomy && d.autonomy.type) _autStats[d.autonomy.type] = (_autStats[d.autonomy.type]||0) + 1;
            else _autStats.missing++;
            if (d.children) _countAut(d.children);
            if (d.divisions) _countAut(d.divisions);
          });
        }
        for (var _fk2 in sd.adminHierarchy) { if (sd.adminHierarchy[_fk2].divisions) _countAut(sd.adminHierarchy[_fk2].divisions); }
        lines.push('  管辖类型分布：直辖' + _autStats.zhixia + ' 藩国' + _autStats.fanguo + ' 藩镇' + _autStats.fanzhen + ' 羁縻' + _autStats.jimi + ' 朝贡' + _autStats.chaogong + (_autStats.missing?' ⚠'+_autStats.missing+'个未设autonomy':''));
        // 按朝代历史性检查
        var _dyn = (sd.dynasty||'').toLowerCase();
        var _hintKey = '';
        if (/明/.test(_dyn) && _autStats.fanguo === 0 && !_autStats.jimi) _hintKey = '明代应有宗室藩国(亲王)与西南土司，现全为直辖，不符史实';
        else if (/唐/.test(_dyn) && sd.year && sd.year > 755 && _autStats.fanzhen === 0) _hintKey = '唐安史之乱后应有藩镇自治(河朔等)，建议设置fanzhen';
        else if (/清/.test(_dyn) && _autStats.jimi === 0) _hintKey = '清代西南应有土司(雍正前)或改土归流残留，建议设置jimi';
        else if (/汉/.test(_dyn) && sd.year && sd.year < 154 && _autStats.fanguo === 0) _hintKey = '汉初(景帝前)应有实封诸侯王，建议设置fanguo实封';
        else if (/周/.test(_dyn) && _autStats.fanguo === 0) _hintKey = '周代以分封制为主，应大量fanguo实封';
        if (_hintKey) lines.push('  ⚠ ' + _hintKey);
      }
    }

    // 预设关系网检查
    if (sd.presetRelations) {
      var _npcR = Array.isArray(sd.presetRelations.npc) ? sd.presetRelations.npc : [];
      var _facR = Array.isArray(sd.presetRelations.faction) ? sd.presetRelations.faction : [];
      lines.push('【预设关系】角色关系' + _npcR.length + '对，势力关系' + _facR.length + '对');
      // 检查人物是否存在
      var _charNames = (sd.characters || []).map(function(c) { return c.name; });
      var _facNames = (sd.factions || []).map(function(f) { return f.name; });
      var _brokenNpcR = _npcR.filter(function(r) { return _charNames.indexOf(r.charA) < 0 || _charNames.indexOf(r.charB) < 0; });
      if (_brokenNpcR.length > 0) lines.push('  ⚠ ' + _brokenNpcR.length + '对角色关系引用了不存在的角色');
      var _brokenFacR = _facR.filter(function(r) { return _facNames.indexOf(r.facA) < 0 || _facNames.indexOf(r.facB) < 0; });
      if (_brokenFacR.length > 0) lines.push('  ⚠ ' + _brokenFacR.length + '对势力关系引用了不存在的势力');
      // 建议：士大夫社会应预设师徒/同年等关系
      if (_npcR.length === 0 && (sd.characters||[]).length > 5) lines.push('  建议：士大夫社会应预设若干师徒/同年/同党/政敌关系，使开局人物网络更立体');
      if (_facR.length === 0 && (sd.factions||[]).length > 2) lines.push('  建议：多势力剧本应预设势力间历史恩怨/贸易关系');
    }

    // 文事系统配置
    if (sd.culturalConfig && sd.culturalConfig.enabled) {
      var _pw = Array.isArray(sd.culturalConfig.presetWorks) ? sd.culturalConfig.presetWorks : [];
      lines.push('【文事系统】启用 · 朝代文风:' + (sd.culturalConfig.dynastyFocus || 'auto') + ' · 预设名作:' + _pw.length);
      // 按朝代建议
      var _dynW = sd.dynasty || '';
      if (/唐/.test(_dynW) && sd.culturalConfig.dynastyFocus === 'auto') lines.push('  建议：唐代应 dynastyFocus=tang_shi（重诗）');
      if (/宋/.test(_dynW) && sd.culturalConfig.dynastyFocus === 'auto') lines.push('  建议：宋代应 dynastyFocus=song_ci（重词）');
    }

    // 人物10维能力与特质合理性
    if (sd.characters && sd.characters.length > 0) {
      var _missMng = sd.characters.filter(function(c) { return c.management === undefined || c.management === null; }).length;
      var _missTrait = sd.characters.filter(function(c) { return !Array.isArray(c.traits) || c.traits.length === 0; }).length;
      var _conflictTrait = 0;
      if (typeof window !== 'undefined' && window.traitsConflict) {
        sd.characters.forEach(function(c) {
          if (!Array.isArray(c.traits) || c.traits.length < 2) return;
          for (var i = 0; i < c.traits.length; i++) {
            for (var j = i+1; j < c.traits.length; j++) {
              if (window.traitsConflict(c.traits[i], c.traits[j])) { _conflictTrait++; return; }
            }
          }
        });
      }
      if (_missMng > 0) lines.push('  ⚠ ' + _missMng + '/' + sd.characters.length + '个角色缺"管理"能力(第10维理财) — 建议AI重生成或补填');
      if (_missTrait > sd.characters.length * 0.3) lines.push('  ⚠ ' + _missTrait + '个角色缺特质(traits) — 建议AI生成');
      if (_conflictTrait > 0) lines.push('  ⚠ ' + _conflictTrait + '个角色特质互斥冲突(如同时含brave与craven)');
    }

    // 后宫位分合理性
    if (sd.haremConfig && sd.haremConfig.rankSystem && sd.haremConfig.rankSystem.length > 0) {
      var _ranks = sd.haremConfig.rankSystem;
      lines.push('【后宫位分】共' + _ranks.length + '级');
      var _dyn2 = sd.dynasty || '';
      var _hasHH = _ranks.some(function(r) { return r.name && r.name.indexOf('皇后') >= 0; });
      var _hasHuangGui = _ranks.some(function(r) { return r.name && r.name.indexOf('皇贵妃') >= 0; });
      var _hasOfficialGirl = _ranks.some(function(r) { return r.name && r.name.indexOf('官女子') >= 0; });
      var _hasZhaoyi = _ranks.some(function(r) { return r.name && (r.name.indexOf('昭仪') >= 0 || r.name.indexOf('婕妤') >= 0); });
      var _missingFields = _ranks.filter(function(r) { return !r.privileges || (Array.isArray(r.privileges) && r.privileges.length === 0); }).length;
      if (!_hasHH) lines.push('  ⚠ 未设置"皇后"位分');
      if (/明/.test(_dyn2) && !_hasHuangGui) lines.push('  ⚠ 明代应设"皇贵妃"(明代独创)');
      if (/清/.test(_dyn2) && !_hasOfficialGirl) lines.push('  ⚠ 清代后宫应到"官女子"八级');
      if (/汉|唐/.test(_dyn2) && !_hasZhaoyi) lines.push('  ⚠ 汉/唐应使用"昭仪/婕妤"等古称位分');
      if (_missingFields > 0) lines.push('  ⚠ ' + _missingFields + '级位分缺特权描述');
    }

    // 皇城宫殿合理性
    if (sd.palaceSystem && sd.palaceSystem.enabled && sd.palaceSystem.palaces && sd.palaceSystem.palaces.length > 0) {
      var _pals = sd.palaceSystem.palaces;
      lines.push('【皇城】' + (sd.palaceSystem.capitalName || '未命名') + ' 共 ' + _pals.length + ' 处宫殿');
      var _palTypes = {};
      _pals.forEach(function(p) { _palTypes[p.type] = (_palTypes[p.type]||0) + 1; });
      lines.push('  类型分布：外朝' + (_palTypes.main_hall||0) + ' 帝居' + (_palTypes.imperial_residence||0) + ' 后妃居所' + (_palTypes.consort_residence||0) + ' 太后' + (_palTypes.dowager||0) + ' 太子' + (_palTypes.crown_prince||0) + ' 园林' + (_palTypes.garden||0));
      if (!_palTypes.main_hall) lines.push('  ⚠ 缺外朝主殿(朝会场所)');
      if (!_palTypes.imperial_residence) lines.push('  ⚠ 缺帝居宫殿(皇帝寝宫)');
      if (!_palTypes.consort_residence) lines.push('  ⚠ 缺后妃居所');
      // 主殿偏殿细分合理性
      var _withSubHalls = _pals.filter(function(p) { return p.subHalls && p.subHalls.length > 0; }).length;
      if (_withSubHalls < _pals.length * 0.3) lines.push('  ⚠ 多数宫殿未细分主殿/偏殿——妃嫔无法具体居住');
      // 朝代匹配
      var _cap = sd.palaceSystem.capitalName || '';
      var _dyn3 = sd.dynasty || '';
      if (/明|清/.test(_dyn3) && _cap.indexOf('紫禁') < 0 && _cap.indexOf('故宫') < 0) lines.push('  ⚠ 明清皇城应为紫禁城');
      if (/唐/.test(_dyn3) && !/太极|大明|兴庆/.test(_cap)) lines.push('  ⚠ 唐代皇城应含太极/大明/兴庆宫');
      if (/汉/.test(_dyn3) && !/长乐|未央|长安/.test(_cap)) lines.push('  ⚠ 汉代应为长乐/未央宫');
    }

    // Era State
    var es = sd.eraState || {};
    if (es.contextDescription) {
      lines.push('【时代状态】' + es.contextDescription.slice(0,100));
      lines.push('  阶段:' + (es.dynastyPhase||'') + ' 集权:' + Math.round((es.centralControl||0)*100) + '% 正统:' + (es.legitimacySource||'') + ' 制度:' + (es.landSystemType||''));
    }

    // Goals
    if (sd.goals && sd.goals.length > 0) {
      lines.push('【目标条件】共' + sd.goals.length + '个');
      sd.goals.forEach(function(g) { lines.push('  [' + (g.type||'') + '] ' + g.name); });
    }

    // Offend Groups (standalone + party/class embedded)
    var ogCount = 0;
    if (sd.offendGroups && sd.offendGroups.groups) ogCount += sd.offendGroups.groups.length;
    if (sd.parties) sd.parties.forEach(function(p) { if (p.offendThresholds && p.offendThresholds.length > 0) ogCount++; });
    if (sd.classes) sd.classes.forEach(function(c) { if (c.offendThresholds && c.offendThresholds.length > 0) ogCount++; });
    if (ogCount > 0) lines.push('【得罪群体】共' + ogCount + '个可被得罪的集团');

    // Keju
    if (sd.keju && sd.keju.enabled) {
      lines.push('【科举系统】已启用' + (sd.keju.examIntervalNote ? '，' + sd.keju.examIntervalNote : ''));
    }

    // === 新增config摘要 ===
    var _bc = sd.battleConfig || {};
    if (_bc.enabled !== false) {
      var _utCount = (_bc.unitTypes && _bc.unitTypes.length) || 0;
      lines.push('【战斗系统】已启用' + (_utCount > 0 ? '，自定义' + _utCount + '种兵种' : '，使用默认兵种'));
    }
    var _wc = sd.warConfig || {};
    if (_wc.casusBelliTypes && _wc.casusBelliTypes.length) {
      lines.push('【战争法则】' + _wc.casusBelliTypes.length + '种宣战理由: ' + _wc.casusBelliTypes.map(function(c){return c.name;}).join('、'));
    }
    var _dc = sd.diplomacyConfig || {};
    if (_dc.treatyTypes && _dc.treatyTypes.length) {
      lines.push('【外交法则】' + _dc.treatyTypes.length + '种条约类型: ' + _dc.treatyTypes.map(function(t){return t.name;}).join('、'));
    }
    var _sc2 = sd.schemeConfig || {};
    if (_sc2.enabled && _sc2.schemeTypes && _sc2.schemeTypes.length) {
      lines.push('【阴谋系统】已启用，' + _sc2.schemeTypes.length + '种阴谋: ' + _sc2.schemeTypes.map(function(s){return s.name;}).join('、'));
    }
    var _ec = sd.eventConstraints || {};
    if (_ec.enabled && _ec.types && _ec.types.length) {
      lines.push('【事件约束】已启用，' + _ec.types.length + '种受约束事件类型');
    }
    var _cc = sd.chronicleConfig || {};
    if (_cc.yearlyEnabled) {
      var _styleNames2 = {biannian:'编年体',shilu:'实录体',jizhuan:'纪传体',jishi:'纪事本末体',biji:'笔记体',custom:'自定义'};
      lines.push('【编年史】年度汇总已启用，风格: ' + (_styleNames2[_cc.style] || _cc.style || '默认'));
    }
    var _ecfg = sd.economyConfig || {};
    if (_ecfg.dualTreasury) {
      lines.push('【双层国库】已启用，内库比例' + ((_ecfg.privateIncomeRatio||0.15)*100) + '%');
    }

    // Player Info
    var pi = sd.playerInfo || {};
    if (pi.factionName || pi.characterName) {
      lines.push('【玩家信息】');
      if (pi.factionName) lines.push('  势力: ' + pi.factionName + (pi.factionLeader ? ' [领袖:' + pi.factionLeader + ']' : ''));
      if (pi.characterName) lines.push('  角色: ' + pi.characterName + (pi.characterTitle ? ' [头衔:' + pi.characterTitle + ']' : '') + (pi.characterFaction ? ' [所属:' + pi.characterFaction + ']' : ''));
    }

    // Player Character (legacy)
    if (sd.playerChr && sd.playerChr.name) {
      lines.push('【玩家角色(旧)】' + sd.playerChr.name
        + (sd.playerChr.faction ? ' [势力:' + sd.playerChr.faction + ']' : '')
        + (sd.playerChr.party ? ' [党派:' + sd.playerChr.party + ']' : '')
        + (sd.playerChr.className ? ' [阶层:' + sd.playerChr.className + ']' : '')
        + (sd.playerChr.officialTitle ? ' [官职:' + sd.playerChr.officialTitle + ']' : ''));
    }

    // 3.6: 本地即时合理性检验（不依赖AI，立即返回结果）
    var _localWarnings = [];
    (function _localValidate() {
      var chars = sd.characters || [];
      var facs = sd.factions || [];
      var vars = sd.variables || {};
      var baseVars = Array.isArray(vars) ? vars : (vars.base || []).concat(vars.other || []);

      // 1. 变量初始值范围检查
      baseVars.forEach(function(v) {
        if (v.isCore && v.value !== undefined) {
          if (v.max && v.value >= v.max) _localWarnings.push('[\u53D8\u91CF\u6781\u7AEF] ' + v.name + '\u521D\u59CB\u503C=' + v.value + ' \u5DF2\u8FBE\u4E0A\u9650' + v.max);
          if (v.min !== undefined && v.value <= v.min) _localWarnings.push('[\u53D8\u91CF\u6781\u7AEF] ' + v.name + '\u521D\u59CB\u503C=' + v.value + ' \u5DF2\u8FBE\u4E0B\u9650' + v.min);
        }
      });

      // 2. 角色能力值分布检查
      if (chars.length >= 5) {
        var _abilFields = ['loyalty','ambition','intelligence','valor','military','administration','charisma','diplomacy'];
        _abilFields.forEach(function(f) {
          var vals = chars.map(function(c){return c[f];}).filter(function(v){return typeof v==='number';});
          if (vals.length < 3) return;
          var avg = vals.reduce(function(s,v){return s+v;},0) / vals.length;
          var allHigh = vals.every(function(v){return v>=85;});
          var allLow = vals.every(function(v){return v<=20;});
          if (allHigh) _localWarnings.push('[\u80FD\u529B\u5206\u5E03] \u6240\u6709\u89D2\u8272\u7684' + f + '\u90FD>=85\uFF0C\u7F3A\u4E4F\u5DEE\u5F02\u5316');
          if (allLow) _localWarnings.push('[\u80FD\u529B\u5206\u5E03] \u6240\u6709\u89D2\u8272\u7684' + f + '\u90FD<=20\uFF0C\u7F3A\u4E4F\u5DEE\u5F02\u5316');
        });
      }

      // 3. mechanicsConfig完整性
      var mc = sd.mechanicsConfig || {};
      if (sd.keju && sd.keju.enabled && (!sd.keju.ranks || sd.keju.ranks.length === 0)) {
        _localWarnings.push('[\u914D\u7F6E\u7F3A\u5931] \u79D1\u4E3E\u5DF2\u542F\u7528\u4F46\u672A\u914D\u7F6E\u79D1\u4E3E\u7B49\u7EA7(ranks)');
      }

      // 4. 空壳势力检查
      facs.forEach(function(f) {
        var members = chars.filter(function(c){return c.faction===f.name;});
        if (members.length === 0) _localWarnings.push('[\u7A7A\u58F3\u52BF\u529B] ' + f.name + ' \u65E0\u4EFB\u4F55\u6210\u5458');
      });

      // 5. 地图与行政区划对应
      if (sd.adminHierarchy && sd.mapData && sd.mapData.regions) {
        var _ahAllNames = [];
        Object.keys(sd.adminHierarchy).forEach(function(k){var ah=sd.adminHierarchy[k];if(ah&&ah.divisions)(function _w(ds){ds.forEach(function(d){if(d.name)_ahAllNames.push(d.name);if(d.divisions)_w(d.divisions);});})(ah.divisions);});
        var _mapNames = sd.mapData.regions.map(function(r){return r.name;});
        if (_ahAllNames.length > 0 && _mapNames.length > 0 && _ahAllNames.length > _mapNames.length * 3) {
          _localWarnings.push('[\u5730\u56FE\u5339\u914D] \u884C\u653F\u533A\u5212' + _ahAllNames.length + '\u4E2A\u5355\u4F4D\uFF0C\u5730\u56FE\u4EC5' + _mapNames.length + '\u4E2A\u533A\u57DF\uFF0C\u5DEE\u5F02\u8FC7\u5927');
        }
      }
    })();
    // 将本地检查结果加入摘要
    if (_localWarnings.length > 0) {
      lines.push('\n\u3010\u672C\u5730\u5373\u65F6\u68C0\u6D4B\u53D1\u73B0\u3011');
      _localWarnings.forEach(function(w) { lines.push('  ' + w); });
    }

    var summary = lines.join('\n');

    var prompt = '\u4F60\u662F\u4E00\u4E2A\u5267\u672C\u5185\u5BB9\u5BA1\u67E5\u4E13\u5BB6，负责统筹全局，检查各部分之间的一致性。以下是一个历史战略游戏剧本的全部内容摘要：\n\n' + summary + '\n\n请仔细分析上述内容，将所有找到的错误、内部矛盾和不一致问题列出。\n\n【重点检查项目 - 跨系统一致性】：\n\n一、人物与其他系统的一致性：\n1. 人物归属的势力名称是否在势力列表中实际存在\n2. 人物归属的党派名称是否在党派列表中实际存在\n3. 人物归属的阶层名称是否在阶层列表中实际存在\n4. 人物的官职(officialTitle)是否在官制系统中存在\n5. 人物的头衔是否在头衔系统中存在\n6. 人物的faith(信仰)是否与世界设定中的宗教体系一致\n\n二、势力与其他系统的一致性：\n7. 势力首领是否在人物列表中实际存在\n8. 势力首领在人物列表中的faction字段是否指向该势力\n9. 势力控制的地图地点，地点的owner/controller是否指向该势力\n10. 势力的领土描述与地图地点是否一致\n\n三、党派与其他系统的一致性：\n11. 党派首领是否在人物列表中实际存在\n12. 党派首领在人物列表中的party字段是否指向该党派\n13. 党派成员(members)是否都在人物列表中存在\n14. 党派成员在人物列表中的party字段是否指向该党派\n\n四、官制与其他系统的一致性：\n15. 官制中任职者(holder)是否在人物列表中实际存在\n16. 官制任职者在人物列表中的officialTitle是否与官职名称一致\n17. 官制中的官职是否与岗位系统(postSystem)中的岗位规则对应\n18. 官制部门的职能是否与朝代背景相符\n19. 官制任职者的封臣类型(vassalType)是否与其官职匹配（如节度使应为藩镇割据，亲王应为宗室藩王，根据officialVassalMapping检查）\n\n五、地图与其他系统的一致性：\n20. 地图地点的owner/controller势力是否在势力列表中存在\n21. 地图地点的守将/统治者是否在人物列表中存在\n22. 城市的人口、资源是否与经济配置合理匹配\n\n六、军事与其他系统的一致性：\n23. 军队统帅(commander)是否在人物列表中存在\n24. 军队驻地(location/garrison)是否在地图中存在\n25. 军队归属势力是否在势力列表中存在\n26. 军制系统是否与时代状态、朝代背景一致\n\n七、事件与其他系统的一致性：\n27. 事件中提到的人物是否在人物列表中存在\n28. 事件中提到的势力是否在势力列表中存在\n29. 事件中提到的地点是否在地图中存在\n30. 事件触发条件中的变量是否在变量系统中定义\n\n八、玩家信息与其他系统的一致性：\n31. 玩家势力(factionName)是否在势力列表中存在\n32. 玩家角色(characterName)是否在人物列表中存在\n33. 玩家角色在人物列表中的faction是否与玩家势力一致\n34. 玩家势力的领袖是否就是玩家角色\n\n九、经济配置的合理性：\n35. 税率(taxRate)是否在0-1之间\n36. 基础收入(baseIncome)是否大于0\n37. 通货膨胀率(inflationRate)是否在合理范围(0-0.2)\n38. 经济参数是否与时代背景相符（如商业繁荣时代应有较高tradeBonus）\n\n十、系统内部的一致性：\n39. 岗位规则、封臣类型、头衔等级、建筑类型是否有重复名称\n40. 头衔等级的level数值是否有重复或逻辑错误\n41. 封臣类型的继承方式是否与时代背景一致\n42. 建筑类型的分类(category)是否正确\n\n十一、时代背景的一致性：\n43. 时代状态描述是否与朝代、年份相符\n44. 官制体系是否符合该朝代的历史实际\n45. 军制系统是否符合该朝代的历史实际\n46. 封臣系统是否符合该朝代的历史实际（如秦汉郡县制不应有封臣）\n47. 头衔系统是否符合该朝代的爵位制度\n\n十二、行政区划的一致性：\n48. 行政区划的主官(governor)是否在人物列表中存在\n49. 行政区划主官在人物列表中的officialTitle是否与行政单位的officialPosition一致\n50. 行政区划的层级结构是否符合该朝代的历史实际（如秦朝应为郡县制，唐朝应为道州县制）\n51. 行政区划的地理名称是否与地图地点名称对应\n52. 行政区划是否存在"空壳"单位（有行政单位但无主官）\n\n十三、逻辑完整性：\n53. 是否存在"孤立"的人物（不属于任何势力、党派、阶层）\n54. 是否存在"空壳"势力（有势力但无任何成员）\n55. 是否存在"无主"地点（重要城市无归属）\n56. 是否存在"无职"官位（官制中有职位但无人担任）\n\n十四、新增系统配置检查：\n57. 战斗系统启用时，自定义兵种的attack/defense数值是否在合理范围(1-15)\n58. 宣战理由类型是否与朝代相符（如秦汉不应有"天子讨不臣"以外的CB）\n59. 条约类型是否与朝代外交惯例一致（如和亲制度是否在该朝代存在）\n60. 阴谋系统启用但无阴谋类型定义→提示补充\n61. 事件约束启用但types为空→提示补充\n62. 编年史风格是否与朝代匹配（如先秦不应选"实录体"）\n63. 双层国库启用时内库比例是否合理(5-30%)\n64. 自定义兵种是否与军队composition中引用的兵种类型一致\n\n输出格式要求：\n- 如果没有发现任何问题，回复：「未发现问题」（就这一句）\n- 如果有问题，每项一行，格式为：[问题类型] 具体描述\n- 问题类型包括：[人物-势力不一致]、[人物-党派不一致]、[人物-官职不一致]、[势力-首领不一致]、[官制-任职者不一致]、[官制-封臣类型不匹配]、[行政区划-主官不一致]、[行政区划-层级不符]、[地图-势力不一致]、[军事-统帅不一致]、[事件-引用不存在]、[玩家信息不一致]、[经济数值不合理]、[系统内重复]、[时代背景不符]、[逻辑不完整]等\n- 不要返回 json，返回普通文本\n- 每个问题都要指出具体的不一致内容，例如："[官制-任职者不一致] 尚书省-尚书令任职者为\'李世民\'，但人物列表中李世民的officialTitle为\'秦王\'而非\'尚书令\'"';

    statusEl.textContent = 'AI 正在分析中...';

    callAIEditor(prompt, 3000).then(function(resp) {
      document.getElementById('aiValidateBtnRun').disabled = false;
      statusEl.textContent = '';
      var lines = (resp || '').trim().split('\n').filter(function(l){return l.trim();});
      if (!lines.length || (lines.length === 1 && lines[0].indexOf('未发现') >= 0)) {
        resultEl.innerHTML = '<div style="color:#6dbf67;font-size:14px;padding:12px 0">&#10003; 未发现任何内容矛盾，剧本数据一致性良好。</div>';
        _lastValidateIssues = [];
        var ib = document.getElementById('aiValidateBtnImprove');
        if (ib) ib.style.display = 'none';
      } else {
        var html = '<div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">发现 ' + lines.length + ' 项需关注的问题：</div>';
        html += lines.map(function(l) {
          var color = '#e8c86a';
          if (l.indexOf('[人物') >= 0 || l.indexOf('[势力') >= 0 || l.indexOf('[首领') >= 0) color = '#e8a06a';
          if (l.indexOf('[阶层') >= 0 || l.indexOf('[党派') >= 0) color = '#a0c8e8';
          if (l.indexOf('[经济') >= 0 || l.indexOf('[数值') >= 0) color = '#e86aa0';
          if (l.indexOf('[系统') >= 0 || l.indexOf('[重复') >= 0) color = '#a0e86a';
          return '<div style="padding:5px 8px;border-left:3px solid ' + color + ';margin-bottom:4px;background:var(--bg-2);border-radius:0 4px 4px 0;font-size:12px;line-height:1.5">' + escHtml(l) + '</div>';
        }).join('');
        resultEl.innerHTML = html;
        _lastValidateIssues = lines;
        var ib = document.getElementById('aiValidateBtnImprove');
        if (ib) ib.style.display = '';
      }
    }).catch(function(err) {
      document.getElementById('aiValidateBtnRun').disabled = false;
      statusEl.textContent = '';
      resultEl.innerHTML = '<div style="color:#e86a6a;font-size:13px;padding:8px 0">\u6838\u9a8c\u5931\u8d25\uff1a' + escHtml(err && err.message ? err.message : String(err)) + '</div>';
      _lastValidateIssues = [];
      var ib = document.getElementById('aiValidateBtnImprove');
      if (ib) ib.style.display = 'none';
    });
  }

  function doAIImprove() {
    if (!_lastValidateIssues || !_lastValidateIssues.length) {
      showToast('请先运行核验'); return;
    }

    // Close validate modal and show progress overlay
    closeAIValidateModal();
    var fgp = document.getElementById('fullGenProgress');
    var fgpLabel = document.getElementById('fgp-label');
    var fgpBar = document.getElementById('fgp-bar');
    var fgpStep = document.getElementById('fgp-step');
    if (fgp) { fgp.style.display = 'flex'; }

    function setProgress(pct, label) {
      if (fgpBar) fgpBar.style.width = pct + '%';
      if (fgpLabel) fgpLabel.textContent = label || '';
      if (fgpStep) fgpStep.textContent = Math.round(pct) + '%';
    }

    function hideProgress() {
      if (fgp) fgp.style.display = 'none';
    }

    setProgress(0, '正在分析问题...');

    var sd = scriptData;
    var slines = [];
    var _eraParts = [];
    if (sd.gameSettings && sd.gameSettings.enableEraName) {
      var _eraArr = (sd.gameSettings.eraNames || []).filter(function(e){ return e.name; });
      if (_eraArr.length) _eraParts = _eraArr.map(function(e){ return e.name+'(起:'+e.startYear+')'; });
      else if (sd.gameSettings.eraName) _eraParts = [sd.gameSettings.eraName];
    }
    slines.push('副本：' + (sd.name||'') + '  朝代：' + (sd.dynasty||'') + '  帝王：' + (sd.emperor||'') + (_eraParts.length ? '  年号：' + _eraParts.join('，') : ''));
    if (sd.overview) slines.push('概述：' + sd.overview.slice(0,120));

    if (sd.characters && sd.characters.length) {
      slines.push('人物(' + sd.characters.length + ')：');
      sd.characters.forEach(function(c) {
        var info = '  ' + (c.name||'?');
        if (c.faction) info += ' 势力:' + c.faction;
        if (c.party) info += ' 党派:' + c.party;
        if (c.className) info += ' 阶层:' + c.className;
        if (c.officialTitle) info += ' 官职:' + c.officialTitle;
        if (c.role) info += ' 职位:' + c.role;
        slines.push(info);
      });
    }

    if (sd.factions && sd.factions.length) {
      slines.push('势力(' + sd.factions.length + ')：');
      sd.factions.forEach(function(f) {
        var info = '  ' + (f.name||'?');
        if (f.leader) info += ' 首领:' + f.leader;
        if (f.territory) info += ' 领土:' + f.territory;
        slines.push(info);
      });
    }

    if (sd.parties && sd.parties.length) {
      slines.push('党派(' + sd.parties.length + ')：');
      sd.parties.forEach(function(p) {
        var info = '  ' + (p.name||'?');
        if (p.leader) info += ' 首领:' + p.leader;
        if (p.members) info += ' 成员:' + p.members;
        slines.push(info);
      });
    }

    if (sd.classes && sd.classes.length) {
      slines.push('阶层(' + sd.classes.length + ')：');
      sd.classes.forEach(function(c) { slines.push('  ' + (c.name||'?')); });
    }

    if (sd.government && sd.government.nodes && sd.government.nodes.length) {
      slines.push('官制部门(' + sd.government.nodes.length + ')：');
      function listGov(nodes, indent) {
        nodes.forEach(function(n) {
          var info = indent + n.name;
          if (n.holder) info += ' 任职:' + n.holder;
          slines.push(info);
          if (n.positions && n.positions.length) {
            n.positions.forEach(function(pos) {
              var posInfo = indent + '  ' + pos.name;
              if (pos.holder) posInfo += ' 任职:' + pos.holder;
              slines.push(posInfo);
            });
          }
          if (n.subs && n.subs.length) listGov(n.subs, indent + '  ');
        });
      }
      listGov(sd.government.nodes, '  ');
    }
    if (sd.variables && typeof sd.variables === 'object' && !Array.isArray(sd.variables)) {
      var vBase = sd.variables.base || [];
      var vOther = sd.variables.other || [];
      var vFormulas = sd.variables.formulas || [];
      var vTotal = vBase.length + vOther.length + vFormulas.length;
      if (vTotal) {
        slines.push('变量(' + vTotal + ')：基础' + vBase.length + '/其他' + vOther.length + '/公式' + vFormulas.length);
        vBase.forEach(function(v){ slines.push('  [基础]' + (v.name||'?') + (v.defaultValue ? '=' + v.defaultValue : '') + (v.description ? ' ' + v.description.slice(0,40) : '')); });
        vOther.forEach(function(v){ slines.push('  [其他]' + (v.name||'?') + (v.defaultValue ? '=' + v.defaultValue : '') + (v.description ? ' ' + v.description.slice(0,40) : '')); });
        vFormulas.forEach(function(v){ slines.push('  [公式]' + (v.name||'?') + (v.formula ? '=' + v.formula.slice(0,40) : '') + (v.description ? ' ' + v.description.slice(0,40) : '')); });
      }
    }
    if (sd.items && sd.items.length) {
      slines.push('道具/物品(' + sd.items.length + ')：');
      sd.items.forEach(function(it){ slines.push('  ' + (it.name||'?') + (it.type ? '[' + it.type + ']' : '') + (it.description ? ' ' + it.description.slice(0,60) : '')); });
    }
    if (sd.military) {
      if (sd.military.initialTroops && sd.military.initialTroops.length) {
        slines.push('开局部队(' + sd.military.initialTroops.length + ')：');
        sd.military.initialTroops.forEach(function(t) {
          var info = '  ' + (t.name||'?');
          if (t.commander) info += ' 统帅:' + t.commander;
          if (t.location || t.garrison) info += ' 驻地:' + (t.location || t.garrison);
          slines.push(info);
        });
      }
      if (sd.military.militarySystem && sd.military.militarySystem.length) {
        slines.push('军制(' + sd.military.militarySystem.length + ')：' + sd.military.militarySystem.map(function(m){return m.name;}).join('、'));
      }
      var milKeys = ['troops','facilities','organization','campaigns'];
      var milLabels = {'troops':'兵种','facilities':'设施','organization':'组织','campaigns':'战役'};
      milKeys.forEach(function(k){
        var arr = sd.military[k] || [];
        if (arr.length) {
          slines.push('军事-' + (milLabels[k]||k) + '(' + arr.length + ')：');
          arr.forEach(function(m){ slines.push('  ' + (m.name||'?') + (m.type ? '[' + m.type + ']' : '') + (m.description ? ' ' + m.description.slice(0,60) : '')); });
        }
      });
    }

    if (sd.map) {
      var mapItems = [].concat(sd.map.city||[]).concat(sd.map.strategic||[]).concat(sd.map.geo||[]).concat(sd.map.items||[]);
      if (mapItems.length) {
        slines.push('地图地点(' + mapItems.length + ')：');
        mapItems.forEach(function(m) {
          var info = '  ' + (m.name||'?');
          if (m.type) info += ' [' + m.type + ']';
          if (m.owner) info += ' 归属:' + m.owner;
          if (m.controller) info += ' 控制:' + m.controller;
          slines.push(info);
        });
      }
    }
    if (sd.worldSettings && typeof sd.worldSettings === 'object') {
      var wsf = ['culture','weather','religion','economy','technology','diplomacy'];
      var wsl = {'culture':'文化','weather':'气候','religion':'宗教','economy':'经济','technology':'科技','diplomacy':'外交'};
      var wsParts = [];
      wsf.forEach(function(k){ if (sd.worldSettings[k]) wsParts.push(wsl[k] + ':' + sd.worldSettings[k].slice(0,40)); });
      if (wsParts.length) slines.push('世界设定: ' + wsParts.join(' | '));
    }

    // Add new systems
    if (sd.economyConfig && (sd.economyConfig.currency || sd.economyConfig.baseIncome)) {
      slines.push('经济配置: 货币=' + (sd.economyConfig.currency||'无') + ' 基础收入=' + (sd.economyConfig.baseIncome||0) + ' 税率=' + (sd.economyConfig.taxRate||0));
    }
    if (sd.postSystem && sd.postSystem.postRules && sd.postSystem.postRules.length) {
      slines.push('岗位系统(' + sd.postSystem.postRules.length + ')：' + sd.postSystem.postRules.map(function(p){ return p.positionName||p.name; }).join('、'));
    }
    if (sd.vassalSystem && sd.vassalSystem.vassalTypes && sd.vassalSystem.vassalTypes.length) {
      slines.push('封臣系统(' + sd.vassalSystem.vassalTypes.length + ')：' + sd.vassalSystem.vassalTypes.map(function(v){ return v.name; }).join('、'));
    }
    if (sd.titleSystem && sd.titleSystem.titleRanks && sd.titleSystem.titleRanks.length) {
      slines.push('头衔系统(' + sd.titleSystem.titleRanks.length + ')：' + sd.titleSystem.titleRanks.map(function(t){ return t.name; }).join('、'));
    }
    if (sd.buildingSystem && sd.buildingSystem.buildingTypes && sd.buildingSystem.buildingTypes.length) {
      slines.push('建筑系统(' + sd.buildingSystem.buildingTypes.length + ')：' + sd.buildingSystem.buildingTypes.map(function(b){ return b.name; }).join('、'));
    }
    if (sd.eraState && sd.eraState.contextDescription) {
      slines.push('时代状态: ' + sd.eraState.contextDescription.slice(0,100));
    }

    // Player Info
    if (sd.playerInfo && (sd.playerInfo.factionName || sd.playerInfo.characterName)) {
      slines.push('玩家信息:');
      if (sd.playerInfo.factionName) slines.push('  势力=' + sd.playerInfo.factionName + (sd.playerInfo.factionLeader ? ' 领袖:' + sd.playerInfo.factionLeader : ''));
      if (sd.playerInfo.characterName) slines.push('  角色=' + sd.playerInfo.characterName + (sd.playerInfo.characterFaction ? ' 所属:' + sd.playerInfo.characterFaction : ''));
    }

    // 本国状态与玩家角色(旧)
    if (sd.playerChr && sd.playerChr.name) {
      slines.push('玩家角色(旧): ' + sd.playerChr.name
        + (sd.playerChr.faction ? ' 势力:' + sd.playerChr.faction : '')
        + (sd.playerChr.party ? ' 党派:' + sd.playerChr.party : '')
        + (sd.playerChr.className ? ' 阶层:' + sd.playerChr.className : '')
        + (sd.playerChr.officialTitle ? ' 官职:' + sd.playerChr.officialTitle : ''));
    }
    // 目标条件
    if (sd.goals && sd.goals.length > 0) {
      slines.push('目标条件(' + sd.goals.length + '个): ' + sd.goals.map(function(g){return '['+g.type+']'+g.name;}).join(', '));
    }
    // 科举
    if (sd.keju && sd.keju.enabled) {
      slines.push('科举: 已启用' + (sd.keju.examIntervalNote ? ' ' + sd.keju.examIntervalNote : ''));
    }
    if (sd.nationState && typeof sd.nationState === 'object') {
      var nsParts = [];
      var nsKeys = ['politics','economy','military','culture','diplomacy'];
      var nsLabels = {'politics':'政治','economy':'经济','military':'军事','culture':'文化','diplomacy':'外交'};
      nsKeys.forEach(function(k){ if (sd.nationState[k]) nsParts.push(nsLabels[k] + ':' + sd.nationState[k].slice(0,40)); });
      if (nsParts.length) slines.push('本国状态: ' + nsParts.join(' | '));
    }

    setProgress(20, '正在生成修复方案...');

    var summary = slines.join('\n');

    var issueText = _lastValidateIssues.join('\n');
    var prompt = '你是剧本修复专家。以下是剧本摘要：\n\n' + summary +
      '\n\n核验发现的问题：\n' + issueText +
      '\n\n请将问题分为两类后生成修复方案：\n' +
      '类型A "generate"：缺失整块内容（如人物太少、缺少事件等）→ 指定需要调用的模块生成器\n' +
      '类型B "patch"：现有数据有错误 → 生成字段级修补\n\n' +
      '返回JSON对象：{"generates":[{"module":"characters","note":"需补充5个人物"}],"patches":[{"section":"characters","itemName":"李世民","field":"faction","newValue":"唐","reason":"原应属唐"}]}\n' +
      'module可选：characters/factions/parties/classes/items/military/techTree/civicTree/variables/rules/events/worldSettings/government/adminHierarchy/buildingSystem/vassalSystem/titleSystem/economyConfig/eraState/mechanicsConfig/militaryConfig\n' +
      'patches格式同下：\n请生成一个 JSON 补丁数组，每项修复一个字段。' +
      '格式为:\n[{"section":"characters","itemName":"李世民","field":"faction","newValue":"唐","reason":"原应属唐"}]\n' +
      'section 可为 characters/factions/parties/classes/items/worldSettings/variables/map/military/economyConfig/postSystem/vassalSystem/titleSystem/buildingSystem/eraState/playerInfo/goals/keju/mechanicsConfig/militaryConfig。\n' +
      'worldSettings 无 itemName，直接用 field 指定子键(culture/weather/religion/economy/technology/diplomacy)。\n' +
      'economyConfig 无 itemName，直接用 field 指定子键(currency/baseIncome/taxRate/inflationRate等)。\n' +
      'eraState 无 itemName，直接用 field 指定子键(contextDescription/politicalUnity/centralControl等)。\n' +
      'playerInfo 无 itemName，直接用 field 指定子键(factionName/characterName等)。\n' +
      'postSystem 用 subKey="postRules"，用 itemName 按positionName查找，用 field 指定要修改的字段。\n' +
      'vassalSystem 用 subKey="vassalTypes"，用 itemName 按name查找，用 field 指定要修改的字段。\n' +
      'titleSystem 用 subKey="titleRanks"，用 itemName 按name查找，用 field 指定要修改的字段。\n' +
      'buildingSystem 用 subKey="buildingTypes"，用 itemName 按name查找，用 field 指定要修改的字段。\n' +
      'variables 用 subKey 指定子列表(base/other/formulas)，用 itemName 按变量名查找，用 field 指定要修改的字段。\n' +
      'map 用 itemName 按地点名查找，用 field 指定要修改的字段。\n' +
      'military 用 subKey 指定子列表(troops/facilities/organization/campaigns/initialTroops/militarySystem)，用 itemName 按名称查找，用 field 指定要修改的字段。\n' +
      '只返回 JSON 数组，不要其他文字。';

    callAIEditor(prompt, 4000).then(async function(resp) {
      setProgress(60, '正在应用修复...');
      var json = (resp || '').trim();
      json = json.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var m = json.match(/\[\s*\{[\s\S]*\}\s*\]/);
      // 尝试解析为新格式{generates, patches}或旧格式[patches]
      var jObj = json.match(/\{[\s\S]*\}/);
      var jArr = json.match(/\[\s*\{[\s\S]*\}\s*\]/);
      var generates = [];
      var patches = [];
      try {
        if (jObj) {
          var parsed = JSON.parse(jObj[0]);
          generates = parsed.generates || [];
          patches = parsed.patches || [];
          if (!patches.length && Array.isArray(parsed)) patches = parsed; // 兼容旧格式
        } else if (jArr) {
          patches = JSON.parse(jArr[0]); // 旧格式纯patch数组
        }
      } catch(e) {
        hideProgress();
        showToast('JSON解析失败: ' + e.message);
        return;
      }

      // 第一步：执行模块生成器（补充缺失内容）
      if (generates.length > 0) {
        setProgress(50, '调用模块生成器补充内容……');
        var _gMap = {
          characters: function(){if(typeof doAIGenerate==='function'){currentAIGenTarget='characters';return doAIGenerate();}},
          factions: function(){if(typeof doAIGenerate==='function'){currentAIGenTarget='factions';return doAIGenerate();}},
          events: function(){if(typeof doAIGenerate==='function'){currentAIGenTarget='events';return doAIGenerate();}},
          government: function(){if(typeof doAIGenerate==='function'){currentAIGenTarget='government';return doAIGenerate();}},
          adminHierarchy: function(){if(typeof doAIGenerate==='function'){currentAIGenTarget='adminHierarchy';return doAIGenerate();}},
          military: function(){if(typeof doAIGenerate==='function'){currentAIGenTarget='military';return doAIGenerate();}},
          variables: function(){if(typeof doAIGenerate==='function'){currentAIGenTarget='variables_base';return doAIGenerate();}},
          buildingSystem: function(){if(typeof aiGenerateBuildingTypes==='function')return aiGenerateBuildingTypes();},
          vassalSystem: function(){if(typeof aiGenerateVassalTypes==='function')return aiGenerateVassalTypes();},
          eraState: function(){if(typeof aiGenerateEraState==='function')return aiGenerateEraState();}
        };
        for (var gi = 0; gi < generates.length; gi++) {
          var gen = generates[gi];
          if (_gMap[gen.module]) {
            setProgress(50 + gi / generates.length * 20, '生成' + gen.module + '……');
            try { await _gMap[gen.module](); } catch(eg) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(eg, 'Improve gen') : console.warn('[Improve gen]', eg); }
          }
        }
      }

      setProgress(75, '应用 ' + patches.length + ' 项字段修复……');

      var applied = 0, skipped = 0;
      patches.forEach(function(p) {
        if (!p || !p.section || !p.field) { skipped++; return; }

        // Handle flat objects (no itemName)
        if (p.section === 'worldSettings') {
          if (scriptData.worldSettings) { scriptData.worldSettings[p.field] = p.newValue; applied++; }
          else skipped++;
          return;
        }
        if (p.section === 'economyConfig') {
          if (!scriptData.economyConfig) scriptData.economyConfig = {};
          scriptData.economyConfig[p.field] = p.newValue;
          applied++;
          return;
        }
        if (p.section === 'eraState') {
          if (!scriptData.eraState) scriptData.eraState = {};
          scriptData.eraState[p.field] = p.newValue;
          applied++;
          return;
        }
        if (p.section === 'playerInfo') {
          if (!scriptData.playerInfo) scriptData.playerInfo = {};
          scriptData.playerInfo[p.field] = p.newValue;
          applied++;
          return;
        }
        if (p.section === 'keju') {
          if (!scriptData.keju) scriptData.keju = {};
          scriptData.keju[p.field] = p.newValue;
          applied++;
          return;
        }
        if (p.section === 'goals') {
          if (!scriptData.goals) scriptData.goals = [];
          if (p.itemName) {
            var gItem = scriptData.goals.find(function(g) { return g.name === p.itemName; });
            if (gItem) { gItem[p.field] = p.newValue; applied++; }
            else skipped++;
          } else { skipped++; }
          return;
        }

        // Handle nested systems with subKey
        if (p.section === 'postSystem') {
          var psSub = p.subKey || 'postRules';
          if (!scriptData.postSystem || !scriptData.postSystem[psSub]) { skipped++; return; }
          var psArr = scriptData.postSystem[psSub];
          var psItem = null;
          for (var psi = 0; psi < psArr.length; psi++) {
            if (psArr[psi] && (psArr[psi].positionName === p.itemName || psArr[psi].name === p.itemName)) {
              psItem = psArr[psi]; break;
            }
          }
          if (!psItem) { skipped++; return; }
          psItem[p.field] = p.newValue;
          applied++;
          return;
        }
        if (p.section === 'vassalSystem') {
          var vsSub = p.subKey || 'vassalTypes';
          if (!scriptData.vassalSystem || !scriptData.vassalSystem[vsSub]) { skipped++; return; }
          var vsArr = scriptData.vassalSystem[vsSub];
          var vsItem = null;
          for (var vsi = 0; vsi < vsArr.length; vsi++) {
            if (vsArr[vsi] && vsArr[vsi].name === p.itemName) { vsItem = vsArr[vsi]; break; }
          }
          if (!vsItem) { skipped++; return; }
          vsItem[p.field] = p.newValue;
          applied++;
          return;
        }
        if (p.section === 'titleSystem') {
          var tsSub = p.subKey || 'titleRanks';
          if (!scriptData.titleSystem || !scriptData.titleSystem[tsSub]) { skipped++; return; }
          var tsArr = scriptData.titleSystem[tsSub];
          var tsItem = null;
          for (var tsi = 0; tsi < tsArr.length; tsi++) {
            if (tsArr[tsi] && tsArr[tsi].name === p.itemName) { tsItem = tsArr[tsi]; break; }
          }
          if (!tsItem) { skipped++; return; }
          tsItem[p.field] = p.newValue;
          applied++;
          return;
        }
        // 阶段1-4新增：mechanicsConfig/militaryConfig 补丁处理
        if (p.section === 'mechanicsConfig') {
          if (!scriptData.mechanicsConfig) scriptData.mechanicsConfig = {};
          if (p.subKey) {
            if (!scriptData.mechanicsConfig[p.subKey]) scriptData.mechanicsConfig[p.subKey] = (p.newValue && Array.isArray(p.newValue)) ? [] : {};
            scriptData.mechanicsConfig[p.subKey] = p.newValue;
          } else {
            scriptData.mechanicsConfig[p.field] = p.newValue;
          }
          applied++;
          return;
        }
        if (p.section === 'militaryConfig') {
          if (!scriptData.militaryConfig) scriptData.militaryConfig = {};
          if (p.subKey) {
            scriptData.militaryConfig[p.subKey] = p.newValue;
          } else {
            scriptData.militaryConfig[p.field] = p.newValue;
          }
          applied++;
          return;
        }
        if (p.section === 'buildingSystem') {
          var bsSub = p.subKey || 'buildingTypes';
          if (!scriptData.buildingSystem || !scriptData.buildingSystem[bsSub]) { skipped++; return; }
          var bsArr = scriptData.buildingSystem[bsSub];
          var bsItem = null;
          for (var bsi = 0; bsi < bsArr.length; bsi++) {
            if (bsArr[bsi] && bsArr[bsi].name === p.itemName) { bsItem = bsArr[bsi]; break; }
          }
          if (!bsItem) { skipped++; return; }
          bsItem[p.field] = p.newValue;
          applied++;
          return;
        }

        // Handle variables
        if (p.section === 'variables') {
          var vSub = p.subKey || 'base';
          if (!scriptData.variables || !scriptData.variables[vSub]) { skipped++; return; }
          var vArr = scriptData.variables[vSub];
          var vItem = null;
          for (var vi = 0; vi < vArr.length; vi++) {
            if (vArr[vi] && vArr[vi].name === p.itemName) { vItem = vArr[vi]; break; }
          }
          if (!vItem) { skipped++; return; }
          vItem[p.field] = p.newValue;
          applied++;
          return;
        }

        // Handle map
        if (p.section === 'map') {
          if (!scriptData.map || !scriptData.map.items) { skipped++; return; }
          var mItem = null;
          for (var mi = 0; mi < scriptData.map.items.length; mi++) {
            if (scriptData.map.items[mi] && scriptData.map.items[mi].name === p.itemName) { mItem = scriptData.map.items[mi]; break; }
          }
          if (!mItem) { skipped++; return; }
          mItem[p.field] = p.newValue;
          applied++;
          return;
        }

        // Handle military
        if (p.section === 'military') {
          var milSub = p.subKey || 'troops';
          if (!scriptData.military || !scriptData.military[milSub]) { skipped++; return; }
          var milArr = scriptData.military[milSub];
          var milItem = null;
          for (var mili = 0; mili < milArr.length; mili++) {
            if (milArr[mili] && milArr[mili].name === p.itemName) { milItem = milArr[mili]; break; }
          }
          if (!milItem) { skipped++; return; }
          milItem[p.field] = p.newValue;
          applied++;
          return;
        }

        // Handle simple arrays
        var arr = scriptData[p.section];
        if (!Array.isArray(arr)) { skipped++; return; }
        var item = null;
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] && (arr[i].name === p.itemName || arr[i].title === p.itemName)) { item = arr[i]; break; }
        }
        if (!item) { skipped++; return; }
        item[p.field] = p.newValue;
        applied++;
      });

      setProgress(100, '修复完成');

      setTimeout(function() {
        hideProgress();
        renderAll();
        autoSave();
        showToast('已应用 ' + applied + ' 项修复' + (skipped ? '，' + skipped + ' 项跳过' : ''));
      }, 500);

    }).catch(function(err) {
      hideProgress();
      showToast('完善失败：' + (err && err.message ? err.message : String(err)));
    });
  }

  // ============================================================
  // AI 独立润色（不依赖验证结果，主动发现可改进之处）
  // ============================================================
  function doAIPolish() {
    var sd = scriptData;
    if (!sd.name && !sd.dynasty) {
      showToast('请先填写基本剧本信息');
      return;
    }

    var slines = [];
    slines.push('副本：' + (sd.name||'') + '  朝代：' + (sd.dynasty||'') + '  帝王：' + (sd.emperor||''));
    if (sd.overview) slines.push('概述：' + sd.overview.slice(0, 200));

    // 统计各系统数据量
    var stats = [];
    if (sd.characters) stats.push('人物' + sd.characters.length);
    if (sd.factions) stats.push('势力' + sd.factions.length);
    if (sd.parties) stats.push('党派' + (sd.parties||[]).length);
    if (sd.classes) stats.push('阶层' + (sd.classes||[]).length);
    if (sd.variables && sd.variables.base) stats.push('变量' + sd.variables.base.length);
    if (sd.events) {
      var evtCount = 0; ['historical','random','conditional','story','chain'].forEach(function(k) { evtCount += (sd.events[k]||[]).length; });
      stats.push('事件' + evtCount);
    }
    if (sd.goals) stats.push('目标' + sd.goals.length);
    slines.push('数据量：' + stats.join('、'));

    // 关键内容预览
    if (sd.characters && sd.characters.length > 0) {
      slines.push('人物：' + sd.characters.slice(0, 8).map(function(c) { return c.name + (c.faction ? '(' + c.faction + ')' : ''); }).join('、'));
    }
    if (sd.factions && sd.factions.length > 0) {
      slines.push('势力：' + sd.factions.map(function(f) { return f.name; }).join('、'));
    }
    if (sd.eraState && sd.eraState.contextDescription) {
      slines.push('时代：' + sd.eraState.contextDescription.slice(0, 80));
    }
    // 官制/行政区划/系统完整度
    if (sd.government && sd.government.nodes) {
      var _gCount = 0; (function _cg(ns){ ns.forEach(function(n){ if(n.positions)_gCount+=n.positions.length; if(n.subs)_cg(n.subs); }); })(sd.government.nodes);
      slines.push('官制：' + sd.government.nodes.length + '部门，' + _gCount + '职位');
    } else { slines.push('官制：未设置⚠'); }
    if (sd.adminHierarchy) {
      var _aCount = 0; Object.keys(sd.adminHierarchy).forEach(function(k){ if(sd.adminHierarchy[k].divisions)(function _ca(ds){ds.forEach(function(d){_aCount++;if(d.divisions)_ca(d.divisions);});})(sd.adminHierarchy[k].divisions); });
      slines.push('行政区划：' + _aCount + '个区划');
    } else { slines.push('行政区划：未设置⚠'); }
    if (sd.schemeConfig && sd.schemeConfig.enabled) slines.push('阴谋系统：已启用');
    if (sd.keju && sd.keju.enabled) slines.push('科举制度：已启用');
    // 新增机制配置摘要
    if (sd.mechanicsConfig) {
      var _mc = sd.mechanicsConfig;
      if (_mc.couplingRules && _mc.couplingRules.length) slines.push('状态耦合规则：' + _mc.couplingRules.length + '条');
      if (_mc.npcBehaviorTypes && _mc.npcBehaviorTypes.length) slines.push('NPC行为类型：' + _mc.npcBehaviorTypes.length + '种');
      if (_mc.executionPipeline && _mc.executionPipeline.length) slines.push('执行率管线：' + _mc.executionPipeline.length + '阶段');
      if (_mc.policyTree && _mc.policyTree.length) slines.push('政策树：' + _mc.policyTree.length + '项');
      if (_mc.decisions && _mc.decisions.length) slines.push('重大决策：' + _mc.decisions.length + '种');
    }
    if (sd.militaryConfig && sd.militaryConfig.unitTypes && sd.militaryConfig.unitTypes.length) {
      slines.push('兵种类型：' + sd.militaryConfig.unitTypes.length + '种');
    }
    // 角色能力分布
    if (sd.characters && sd.characters.length > 3) {
      var _noLoc = sd.characters.filter(function(c){return !c.location;}).length;
      var _noMil = sd.characters.filter(function(c){return !c.military && c.military !== 0;}).length;
      if (_noLoc > 0) slines.push('⚠ ' + _noLoc + '个角色未设置所在地');
      if (_noMil > 0) slines.push('⚠ ' + _noMil + '个角色缺少军事(military)属性');
    }

    var summary = slines.join('\n');

    var prompt = '你是剧本优化专家。以下是一个历史战略游戏剧本的概要：\n\n' + summary +
      '\n\n请从以下角度分析并提出5-10条具体改进建议：\n' +
      '1. 内容丰富度：各系统数据是否充分（人物、势力、事件等数量是否太少）\n' +
      '2. 历史准确性：人物、官制、行政区划是否符合朝代背景\n' +
      '3. 叙事深度：人物性格、势力关系、政治格局是否有层次\n' +
      '4. 系统完整性：是否有缺失的关键系统（如缺少事件、缺少变量、缺少目标条件等）\n' +
      '5. AI推演友好度：数据是否足够让AI进行高质量的推演\n\n' +
      '返回JSON数组，每项：{category:"内容/历史/叙事/系统/AI",issue:"问题描述",suggestion:"改进建议",priority:"高/中/低"}\n只输出JSON。';

    showLoading('AI\u6B63\u5728\u5206\u6790\u5267\u672C...');
    callAIEditor(prompt, 2000).then(function(raw) {
      hideLoading();
      try {
        // 清理markdown包装
        raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        var m = raw.match(/\[\s*\{[\s\S]*\]/);
        var suggestions = JSON.parse(m ? m[0] : raw);
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
          showToast('AI\u672A\u8FD4\u56DE\u6709\u6548\u5EFA\u8BAE');
          return;
        }
        // 保存建议供执行使用
        window._polishSuggestions = suggestions;
        // 显示带勾选框的建议弹窗
        var html = '<div style="max-height:55vh;overflow-y:auto;">';
        html += '<div style="font-size:13px;color:var(--text-dim);margin-bottom:12px;">AI\u5206\u6790\u4E86\u60A8\u7684\u5267\u672C\u5E76\u63D0\u51FA\u4EE5\u4E0B\u6539\u8FDB\u5EFA\u8BAE\uFF0C\u52FE\u9009\u540E\u70B9\u51FB\u201C\u6267\u884C\u201D\uFF1A</div>';
        var prioColors = { '\u9AD8': '#c0392b', '\u4E2D': '#e67e22', '\u4F4E': '#27ae60' };
        var catIcons = { '\u5185\u5BB9': '\u{1F4E6}', '\u5386\u53F2': '\u{1F4DC}', '\u53D9\u4E8B': '\u270D\uFE0F', '\u7CFB\u7EDF': '\u2699\uFE0F', 'AI': '\u{1F916}' };
        suggestions.forEach(function(s, i) {
          html += '<div style="margin-bottom:8px;padding:8px 10px;background:var(--bg-card,#15151f);border-radius:8px;border-left:3px solid ' + (prioColors[s.priority] || '#888') + ';display:flex;gap:8px;align-items:start;">';
          html += '<input type="checkbox" id="_polishCb' + i + '" checked style="margin-top:3px;flex-shrink:0;">';
          html += '<div style="flex:1;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">';
          html += '<span style="font-weight:700;color:var(--gold,#c9a96e);font-size:12px;">' + (catIcons[s.category] || '\u{1F4CB}') + ' ' + (s.category || '') + '</span>';
          html += '<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:rgba(255,255,255,0.05);color:' + (prioColors[s.priority] || '#888') + ';">' + (s.priority || '\u4E2D') + '</span>';
          html += '</div>';
          html += '<div style="font-size:12px;color:var(--text-secondary,#9a9590);margin-bottom:2px;">' + escHtml(s.issue || '') + '</div>';
          html += '<div style="font-size:12px;color:var(--text-primary,#e0dcd0);">' + escHtml(s.suggestion || '') + '</div>';
          html += '</div></div>';
        });
        html += '</div>';
        html += '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">';
        html += '<button class="btn btn-primary" onclick="_executePolishSuggestions()" style="padding:8px 24px;">\u{1F680} \u6267\u884C\u9009\u4E2D\u5EFA\u8BAE</button>';
        html += '<button class="btn" onclick="closeGenericModal()" style="padding:8px 16px;">\u5173\u95ED</button>';
        html += '</div>';
        openGenericModal('AI \u5267\u672C\u6DA6\u8272\u5EFA\u8BAE\uFF08' + suggestions.length + '\u6761\uFF09', html);
      } catch(e) {
        showToast('\u89E3\u6790\u5931\u8D25\uFF1A' + e.message);
      }
    }).catch(function(e) {
      hideLoading();
      showToast('\u5206\u6790\u5931\u8D25\uFF1A' + e.message);
    });
  }

  // 执行勾选的润色建议
  window._executePolishSuggestions = async function() {
    var suggestions = window._polishSuggestions || [];
    var selected = [];
    suggestions.forEach(function(s, i) {
      var cb = document.getElementById('_polishCb' + i);
      if (cb && cb.checked) selected.push(s);
    });
    if (selected.length === 0) { showToast('请至少勾选1条建议'); return; }
    closeGenericModal();

    // 第1步：让AI分析每条建议应调用哪个模块的生成器
    showToast('分析建议并分派到各模块……');
    var dispatchPrompt = '你是剧本编辑器调度系统。以下是需要执行的优化建议：\n';
    selected.forEach(function(s, i) { dispatchPrompt += (i+1) + '. [' + (s.category||'') + '] ' + s.issue + ' → ' + s.suggestion + '\n'; });
    dispatchPrompt += '\n请为每条建议指定应该调用的模块生成器。可选模块：\n'
      + 'characters（人物）, factions（势力）, parties（党派）, classes（阶层）, items（物品）, '
      + 'military（军事）, techTree（科技树）, civicTree（民政树）, variables（变量）, rules（规则）, '
      + 'events（事件）, worldSettings（世界设定）, government（官制）, adminHierarchy（行政区划）, '
      + 'buildingSystem（建筑）, vassalSystem（封建）, titleSystem（爵位）, economyConfig（经济）, '
      + 'eraState（时代状态）, modify（修改现有数据）\n'
      + '返回JSON数组：[{"index":1,"module":"characters","note":"需要补充5个历史人物"}]\n只返回JSON。';

    try {
      var dispResp = await callAIEditor(dispatchPrompt, 1500);
      dispResp = dispResp.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      var jmD = dispResp.match(/\[[\s\S]*\]/);
      var dispatches = jmD ? JSON.parse(jmD[0]) : [];

      var fgp = document.getElementById('fullGenProgress');
      var fgpLabel = document.getElementById('fgp-label');
      var fgpBar = document.getElementById('fgp-bar');
      var fgpStep = document.getElementById('fgp-step');
      if (fgp) fgp.style.display = 'flex';

      // 模块→生成器映射
      var _genMap = {
        characters: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='characters';return doAIGenerate();}},
        factions: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='factions';return doAIGenerate();}},
        parties: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='parties';return doAIGenerate();}},
        classes: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='classes';return doAIGenerate();}},
        items: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='items';return doAIGenerate();}},
        military: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='military';return doAIGenerate();}},
        techTree: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='techTree';return doAIGenerate();}},
        civicTree: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='civicTree';return doAIGenerate();}},
        variables: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='variables_base';return doAIGenerate();}},
        rules: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='rules';return doAIGenerate();}},
        events: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='events';return doAIGenerate();}},
        worldSettings: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='worldSettings';return doAIGenerate();}},
        government: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='government';return doAIGenerate();}},
        adminHierarchy: function() { if(typeof doAIGenerate==='function'){currentAIGenTarget='adminHierarchy';return doAIGenerate();}},
        buildingSystem: function() { if(typeof aiGenerateBuildingTypes==='function') return aiGenerateBuildingTypes(); },
        vassalSystem: function() { if(typeof aiGenerateVassalTypes==='function') return aiGenerateVassalTypes(); },
        titleSystem: function() { if(typeof aiGenerateTitleRanks==='function') return aiGenerateTitleRanks(); },
        economyConfig: function() { if(typeof aiGenerateEconomyConfig==='function') return aiGenerateEconomyConfig(); },
        eraState: function() { if(typeof aiGenerateEraState==='function') return aiGenerateEraState(); }
      };

      var applied = 0;
      for (var di = 0; di < dispatches.length; di++) {
        var d = dispatches[di];
        var pct = Math.round(((di + 1) / dispatches.length) * 100);
        if (fgpBar) fgpBar.style.width = pct + '%';
        if (fgpLabel) fgpLabel.textContent = '执行 ' + (di + 1) + '/' + dispatches.length + ': ' + (d.module || '') + ' ' + (d.note || '').slice(0, 20);
        if (fgpStep) fgpStep.textContent = pct + '%';

        if (d.module === 'modify') {
          // 修改现有数据：用原来的inline patch方式
          var sg = selected[d.index - 1] || selected[di] || {};
          var fixP = '剧本修改。' + (scriptData.name || '') + ' ' + (scriptData.dynasty || '') + '\n问题: ' + (sg.issue || '') + '\n建议: ' + (sg.suggestion || '') + '\n'
            + '请返回JSON: {"type":"modify","changes":[{"name":"项名","field":"字段","value":"新值"}],"target":"characters或factions等"}。只返回JSON。';
          try {
            var resp = await callAIEditor(fixP, 1500);
            resp = resp.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            var jm = resp.match(/\{[\s\S]*\}/);
            if (jm) {
              var fix = JSON.parse(jm[0]);
              if (fix.changes && Array.isArray(fix.changes)) {
                fix.changes.forEach(function(ch) {
                  if (!ch.name || !ch.field) return;
                  var arr = scriptData[fix.target || 'characters'];
                  if (Array.isArray(arr)) { var item = arr.find(function(x) { return x.name === ch.name; }); if (item) { item[ch.field] = ch.value; applied++; } }
                });
              }
            }
          } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'Polish modify') : console.warn('[Polish modify]', e); }
        } else if (_genMap[d.module]) {
          // 调用模块专用生成器（丰富完整的AI生成）
          try {
            await _genMap[d.module]();
            applied++;
          } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'unknown') : console.warn('[Polish gen ' + d.module + ']', e); }
        }
      }

      if (fgp) fgp.style.display = 'none';
      if (typeof renderAll === 'function') renderAll();
      if (typeof autoSave === 'function') autoSave();
      showToast('已执行 ' + applied + ' 项建议（通过各模块专用生成器）');
    } catch(e) {
      showToast('执行失败: ' + e.message);
      console.error('[Polish dispatch]', e);
    }
  };

