/**
 * 角色自动生成系统 (v5·统一接口)
 *
 * 提供三路入口：
 *   A) 诏令征召 —— edictRecruitCharacter(name, opts)
 *   B) 推演扫描 —— 在 endturn 后由 tm-endturn.js 调用 scanMentionedCharacters
 *   C) 点击具象化 —— crystallizePendingCharacter(name)
 *
 * 统一调用核心：aiGenerateCompleteCharacter(name, opts)
 */

(function(global){
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 核心：统一角色生成接口
  // ═══════════════════════════════════════════════════════════════════

  /**
   * AI 生成完整角色（与科举历史名臣生成规格一致）
   * @param {string} name 角色姓名
   * @param {Object} opts
   * @param {string} opts.reason 生成原因（征召/推演涌现/玩家点击/etc）
   * @param {string} opts.sourceContext 来源上下文（前后文摘要·帮助 AI 推断身份）
   * @param {boolean} opts.isHistoricalHint 是否提示 AI 这是真实历史人物
   * @param {string} opts.assignPost 可选·直接任命此官职
   * @param {number} opts.age 已知年龄（可留空让 AI 推）
   * @param {string} opts.party 已知党派
   * @param {number} opts.loyaltyBonus 额外忠诚加成（征召默认 +10）
   * @param {number} opts.affinityBonus 对玩家好感加成（征召默认 +15）
   * @returns {Promise<Object>} 生成的 char 对象（已 push 到 GM.chars）
   */
  async function aiGenerateCompleteCharacter(name, opts) {
    opts = opts || {};
    if (!name) throw new Error('[角色生成] 需提供姓名');

    // 去重
    if (typeof findCharByName === 'function') {
      var existing = findCharByName(name);
      if (existing) return existing;
    }

    // 并发锁：若同名正在生成中，等待其完成（避免重复 API 调用）
    if (!GM._generatingChars) GM._generatingChars = {};
    if (GM._generatingChars[name]) {
      // 等待最多 30 秒·每 500ms 检查一次
      for (var _w = 0; _w < 60; _w++) {
        await new Promise(function(r){ setTimeout(r, 500); });
        if (typeof findCharByName === 'function') {
          var _done = findCharByName(name);
          if (_done) return _done;
        }
        if (!GM._generatingChars[name]) break;
      }
    }
    GM._generatingChars[name] = true;

    if (!P.ai || !P.ai.key) {
      delete GM._generatingChars[name];
      return _fallbackTemplate(name, opts);
    }

    var era = (P.dynasty || P.era || '');
    var year = GM.year || (P.time && P.time.year) || 1600;
    var reason = opts.reason || '\u63A8\u6F14\u6D8C\u73B0';
    var sourceContext = opts.sourceContext || '';

    // 势力清单+已有代表人物——注入 prompt 供 AI 定位
    var _facList = (GM.factions || GM.facs || []).map(function(f){
      var lead = f.leader || f.leaderName || '';
      var terr = f.territory ? f.territory.slice(0, 20) : '';
      return f.name + (lead ? '(' + lead + ')' : '') + (terr ? '·' + terr : '');
    }).slice(0, 10).join('；');
    var _partyList = (GM.parties || []).map(function(p){ return p.name + '(' + (p.leader || '') + ')'; }).slice(0, 8).join('、');
    var _existingChars = (GM.chars || [])
      .filter(function(c){ return c && c.alive !== false && c.isHistorical; })
      .slice(0, 15)
      .map(function(c){ return c.name + (c.officialTitle ? '(' + c.officialTitle.slice(0, 15) + ')' : '') + (c.faction ? '@' + c.faction : ''); })
      .join('、');
    var _sceneInfo = '';
    if (GM.date) _sceneInfo += '时节：' + GM.date + '；';
    if (GM.eraState && GM.eraState.dynastyPhase) _sceneInfo += '朝代阶段：' + GM.eraState.dynastyPhase + '；';
    if (GM.prestige !== undefined) _sceneInfo += '皇威：' + GM.prestige + '；';

    var prompt = '\u4F60\u662F' + era + '\u5386\u53F2\u8003\u636E\u4E0E\u4EBA\u7269\u6863\u6848 AI\u3002\u4E3A\u4EE5\u4E0B\u4EBA\u7269\u751F\u6210\u5B8C\u6574\u4EBA\u7269\u5361\u3002\n\n' +
      '\u3010\u5F53\u524D\u65F6\u4EE3\u3011' + era + ' ' + year + ' \u5E74\n' +
      (_sceneInfo ? '\u3010\u65F6\u5C40\u3011' + _sceneInfo + '\n' : '') +
      (_facList ? '\u3010\u5F53\u524D\u52BF\u529B\u3011' + _facList + '\n' : '') +
      (_partyList ? '\u3010\u5F53\u524D\u515A\u6D3E\u3011' + _partyList + '\n' : '') +
      (_existingChars ? '\u3010\u5DF2\u6709\u91CD\u8981\u4EBA\u7269\u3011' + _existingChars + '\n' : '') +
      '\u3010\u59D3\u540D\u3011' + name + '\n' +
      '\u3010\u7EB3\u5165\u7F18\u7531\u3011' + reason + '\n' +
      (opts.age ? '\u3010\u5DF2\u77E5\u5E74\u9F84\u3011' + opts.age + '\n' : '') +
      (opts.party ? '\u3010\u5DF2\u77E5\u515A\u6D3E\u3011' + opts.party + '\n' : '') +
      (opts.faction ? '\u3010\u5DF2\u77E5\u52BF\u529B\u3011' + opts.faction + '\n' : '') +
      (opts.assignPost ? '\u3010\u7686\u5C06\u88AB\u4EFB\u547D\u3011' + opts.assignPost + '\n' : '') +
      (sourceContext ? '\u3010\u6765\u6E90\u4E0A\u4E0B\u6587\u3011' + sourceContext.slice(0, 700) + '\n' : '') +
      '\n\u3010\u6838\u5B9E\u8981\u6C42\u3011\n' +
      '1. \u9996\u5148\u5224\u65AD\u6B64\u4EBA\u662F\u5426\u4E3A\u771F\u5B9E\u5386\u53F2\u4EBA\u7269\u3002\u82E5\u662F\u00B7\u4E25\u683C\u6309\u53F2\u6599\u51C6\u786E\u751F\u6210\u3002\n' +
      '2. \u82E5\u6B64\u4EBA\u4E8E ' + year + ' \u5E74\u5DF2\u4EE1\u6216\u5C1A\u672A\u51FA\u751F\u00B7\u8FD4\u56DE {"error":"\u53F2\u5B9E\u4E0D\u53EF\u73B0"}\n' +
      '3. \u5E74\u9F84\u5FC5\u987B\u5408 ' + year + ' \u5E74\u53F2\u5B9E\uFF08\u82E5\u6B64\u4EBA\u751F\u4E8E 1600 \u5E74\u00B7' + year + '=1627 \u5219\u5E74 27\uFF09\n' +
      '4. \u771F\u5B9E\u5386\u53F2\u4EBA\u7269\u5FC5\u9700 shiliao \u5B57\u6BB5\u00B7\u53F2\u4E66\u539F\u6587\u6458\u5F15 80-200 \u5B57\n' +
      '5. \u867A\u6784\u4EBA\u7269\u59D3\u540D/\u7C4D\u8D2F/\u6027\u683C\u987B\u7B26\u5408\u8BE5\u671D\u4EE3\u5730\u57DF\u7279\u5F81\n\n' +
      '\u8FD4\u56DE JSON\u5305\u542B\uFF1A\n{\n' +
      '  "isHistorical": true/false,\n' +
      '  "age": number,\n' +
      '  "gender": "\u7537/\u5973",\n' +
      '  "ethnicity": "\u6C49/\u6EE1/\u8499/\u7B49",\n' +
      '  "origin": "\u7C4D\u8D2F\u5982\u798F\u5EFA\u5357\u5B89",\n' +
      '  "birthplace": "\u51FA\u751F\u5730",\n' +
      '  "location": "\u5F53\u524D\u6240\u5728\u5730(\u5982\u5728\u4EFB\u4EC5\u586B\u4EFB\u6240\uFF1B\u5F85\u5B85\u5219\u586B\u5BB6\u4E61)",\n' +
      '  "faction": "' + (opts.faction || '') + '(\u5FC5\u987B\u4ECE\u4E0A\u8FF0\u3010\u5F53\u524D\u52BF\u529B\u3011\u4E2D\u9009\u4E00\u4E2A\u00B7\u82E5\u6B64\u4EBA\u4E3A\u672C\u671D\u58EB\u5927\u592B\u5219\u9009\u4E3B\u671D\u3001\u82E5\u4E3A\u5916\u85E9\u5219\u9009\u5BF9\u5E94\u52BF\u529B)",\n' +
      '  "class": "\u58EB\u65CF/\u5BD2\u95E8/\u5546\u8D3E/\u5B97\u5BA4/\u7B49",\n' +
      '  "title": "\u5F53\u524D\u5B98\u804C\u6216\u8EAB\u4EFD",\n' +
      '  "appearance": "\u5916\u8C8C 40-80 \u5B57",\n' +
      '  "charisma": 40-90,\n' +
      '  "bio": "\u751F\u5E73 300-600 \u5B57\u00B7\u5305\u542B\u51FA\u8EAB/\u6C0F\u65CF/\u65E9\u5E74/\u5E08\u627F/\u4E60\u4E1A/\u6210\u5C31\u3002\u82E5\u662F\u5386\u53F2\u4EBA\u7269\u00B7\u672B\u6BB5\u5355\u5217 \u3010\u53F2\u6599\u51FA\u5904\u3011+ shiliao \u539F\u6587",\n' +
      '  "shiliao": "\u5386\u53F2\u4EBA\u7269\u586B\u53F2\u4E66\u539F\u6587\u3001\u867A\u6784\u4EBA\u7269\u7A7A\u5B57\u7B26\u4E32",\n' +
      '  "personalGoal": "\u5FD7\u5411 10-30 \u5B57",\n' +
      '  "ambition": 30-85,\n' +
      '  "intelligence": 50-95,\n' +
      '  "administration": 40-90,\n' +
      '  "valor": 20-90,\n' +
      '  "benevolence": 30-90,\n' +
      '  "loyalty": 40-95,\n' +
      '  "integrity": 30-95,\n' +
      '  "wuchang": {"ren":50,"yi":50,"li":50,"zhi":50,"xin":50},\n' +
      '  "family": "\u6C0F\u65CF",\n' +
      '  "familyTier": "gentry|common|royal",\n' +
      '  "familyMembers": [{"name":"","relation":"\u7236/\u6BCD/\u914D\u5076/\u5144","living":true,"officialTitle":""}],\n' +
      '  "familyRelations": {"father":"","mother":"","spouse":"","children":[]},\n' +
      '  "ancestry": "\u5BB6\u8C31 80-150 \u5B57",\n' +
      '  "stance": "\u7ACB\u573A 20-40 \u5B57",\n' +
      '  "personality": "\u6027\u683C 20-60 \u5B57",\n' +
      '  "faith": "\u5112/\u91CA/\u9053/\u7B49",\n' +
      '  "culture": "\u6587\u5316\u80CC\u666F 10-30 \u5B57",\n' +
      '  "hobbies": ["\u68CB","\u4E66"],\n' +
      '  "party": "' + (opts.party || '') + '(\u82E5\u672C\u671D\u58EB\u5927\u592B\u4ECE\u3010\u5F53\u524D\u515A\u6D3E\u3011\u9009\u4E00\u4E2A\u00B7\u6216\u586B\u7A7A)",\n' +
      '  "relations": {"\u5DF2\u6709\u67D0\u4EBA":{"affinity":0-100,"trust":0-100,"respect":0-100,"fear":0-100,"hostility":0-100,"labels":["\u540C\u4E61","\u5E08\u751F"]}},\n' +
      '  "privateWealthHint": "\u6309\u8EAB\u4EFD\u4F30\u8BA1\u6D41\u52A8\u8D22\u4EA7\u00B7\u6570\u5B57\u5355\u4F4D\u4E24(\u767D\u9298\u5B98\u5219\u6570\u5343-\u6570\u4E07\u00B7\u8FB9\u5C06 2-10 \u4E07\u00B7\u8D2A\u5B98 20+ \u4E07\u00B7\u5E73\u6C11 <1000)",\n' +
      '  "timeAnomaly": false\n' +
      '}\n\u53EA\u8F93\u51FA JSON\u3002';

    var attempt = 0;
    var lastErr = null;
    while (attempt < 3) {
      attempt++;
      try {
        var _tokBudget;
        if (P.conf && P.conf.maxOutputTokens > 0) _tokBudget = P.conf.maxOutputTokens;
        else if (P.conf && P.conf._detectedMaxOutput > 0) _tokBudget = P.conf._detectedMaxOutput;
        else _tokBudget = 4000;

        var raw = await callAISmart(prompt, _tokBudget, { maxRetries: 1 });
        var data = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
        if (!data) data = JSON.parse(raw.replace(/```json|```/g, '').trim());

        if (!data || typeof data !== 'object') throw new Error('\u89E3\u6790\u5931\u8D25');
        if (data.error) {
          // AI 拒绝生成（如史实已故）
          throw new Error('\u5386\u53F2\u4E0D\u53EF\u73B0: ' + data.error);
        }

        // 拼装 char 对象
        var bio = data.bio || '';
        if (data.isHistorical && data.shiliao && bio.indexOf('\u3010\u53F2\u6599\u51FA\u5904\u3011') < 0) {
          bio += '\n\n\u3010\u53F2\u6599\u51FA\u5904\u3011\n' + data.shiliao;
        }
        if (data.timeAnomaly) {
          bio += '\n\n\u3010\u5F02\u4E16\u5947\u7F18\u3011\u6B64\u4EBA\u672C\u4E3A\u5176\u672C\u671D\u4E4B\u4EBA\u00B7\u4E0D\u77E5\u56E0\u4F55\u7F18\u4EFD\u5728\u6B64\u4E16\u4E3A\u58EB\u3002';
        }

        // 解析 AI 返回的私产提示：如 "5万"、"3500" 等
        var _parsedCash = 0;
        if (data.privateWealthHint) {
          var _ws = String(data.privateWealthHint);
          var _wm = _ws.match(/(\d+)\s*万/);
          if (_wm) _parsedCash = parseInt(_wm[1], 10) * 10000;
          else {
            var _wn = _ws.match(/(\d{3,})/);
            if (_wn) _parsedCash = parseInt(_wn[1], 10);
          }
        }
        // 按身份估值兜底
        if (!_parsedCash) {
          var _t = (data.title || opts.assignPost || '');
          if (/大学士|首辅|尚书/.test(_t)) _parsedCash = 60000;
          else if (/侍郎|巡抚|总督/.test(_t)) _parsedCash = 35000;
          else if (/总兵|都督/.test(_t)) _parsedCash = 45000;
          else if (/主事|给事中|御史/.test(_t)) _parsedCash = 12000;
          else if (/进士|翰林/.test(_t)) _parsedCash = 8000;
          else _parsedCash = 3000;
        }

        // 势力确定：按 opts → AI → 默认推断
        var _faction = opts.faction || data.faction || '';
        if (!_faction) {
          // 若当前场景是本朝·默认归本朝
          var _mainFac = (GM.factions || GM.facs || [])[0];
          if (_mainFac) _faction = _mainFac.name;
        }

        var newChar = {
          id: 'autogen_' + Date.now() + '_' + name,
          name: name,
          age: data.age || 30,
          gender: data.gender || '\u7537',
          ethnicity: data.ethnicity || '\u6C49',
          origin: data.origin || '',
          birthplace: data.birthplace || data.origin || '',
          location: data.location || opts.location || (opts.assignPost ? '\u4EAC\u5E08' : (data.birthplace || data.origin || '')),
          class: data.class || '\u5BD2\u95E8',
          title: data.title || '',
          officialTitle: opts.assignPost || data.title || '',
          // 外貌
          appearance: data.appearance || '',
          charisma: data.charisma || 60,
          // 生平
          bio: bio,
          historicalSource: data.shiliao || '',
          // 志向
          personalGoal: data.personalGoal || '',
          ambition: data.ambition || 50,
          // 能力
          intelligence: data.intelligence || 70,
          administration: data.administration || 60,
          valor: data.valor || 40,
          benevolence: data.benevolence || 60,
          loyalty: (data.loyalty || 70) + (opts.loyaltyBonus || 0),
          integrity: data.integrity || 65,
          wuchang: data.wuchang || { ren: 60, yi: 60, li: 60, zhi: 60, xin: 60 },
          // 身世
          family: data.family || (name.charAt(0) + '\u6C0F'),
          familyTier: data.familyTier || 'common',
          familyMembers: Array.isArray(data.familyMembers) ? data.familyMembers : [],
          familyRelations: data.familyRelations || {},
          ancestry: data.ancestry || '',
          // 立场
          stance: data.stance || '',
          personality: data.personality || '',
          faith: data.faith || '',
          culture: data.culture || '',
          hobbies: Array.isArray(data.hobbies) ? data.hobbies : [],
          party: opts.party || data.party || '',
          faction: _faction,
          // NPC 关系（AI 给的话）
          relations: (data.relations && typeof data.relations === 'object') ? data.relations : {},
          // 资源（按身份估值初始化 cash）
          resources: {
            fame: 20, virtue: 10, health: 80, stress: 0,
            privateWealth: { cash: _parsedCash, grain: Math.round(_parsedCash / 30), cloth: Math.round(_parsedCash / 150) },
            publicPurse: { money: 0, grain: 0, cloth: 0 }
          },
          // 元数据
          alive: true,
          source: reason,
          recruitTurn: GM.turn,
          isHistorical: !!data.isHistorical,
          _timeAnomaly: !!data.timeAnomaly,
          _memorySeeds: [{
            turn: GM.turn,
            event: reason + '\u00B7\u5165\u671D\u4E3A\u58EB',
            emotion: '\u656C'
          }]
        };

        if (!GM.chars) GM.chars = [];
        GM.chars.push(newChar);

        // 直接注册索引·O(1) 而非 O(N) 重建（previous envoy 场景的同类修）
        if (GM._indices && GM._indices.charByName) {
          GM._indices.charByName.set(name, newChar);
        } else if (typeof buildIndices === 'function') {
          try { buildIndices(); } catch(_){}
        }

        // 好感加成
        if (opts.affinityBonus && typeof AffinityMap !== 'undefined' && AffinityMap.add) {
          var playerName = (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B';
          AffinityMap.add(name, playerName, opts.affinityBonus, reason);
        }

        // NPC 记忆
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          NpcMemorySystem.remember(name, reason + '\u00B7\u8499\u7687\u5E1D\u77E5\u9047', '\u656C', 7, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B');
        }

        // 任命官职（若有）
        if (opts.assignPost && GM.officeTree) {
          _tryAssignPost(name, opts.assignPost);
        }

        // 触发 UI 刷新（诏令征召/接见等场景·否则玩家直到下回合才看到人物）
        if (!opts.skipUiRefresh) {
          if (typeof renderRenwu === 'function') { try { renderRenwu(); } catch(_){} }
          if (typeof renderGameState === 'function') { try { renderGameState(); } catch(_){} }
        }

        delete GM._generatingChars[name];
        _dbg('[\u89D2\u8272\u81EA\u751F\u6210] \u5B8C\u6210\uFF1A' + name + '\u00B7' + (data.isHistorical ? '\u5386\u53F2\u4EBA\u7269' : '\u867A\u6784\u4EBA\u7269') + '\u00B7' + _faction + '\u00B7\u79C1\u4EA7' + _parsedCash);
        return newChar;
      } catch(e) {
        lastErr = e;
        console.warn('[\u89D2\u8272\u81EA\u751F\u6210] \u7B2C' + attempt + '\u6B21\u5931\u8D25', e.message || e);
        if (/\u53F2\u5B9E\u4E0D\u53EF\u73B0/.test(e.message || '')) {
          delete GM._generatingChars[name];
          throw e;  // 史实否决·不重试
        }
      }
    }
    // 3 次失败·模板兜底
    delete GM._generatingChars[name];
    console.warn('[\u89D2\u8272\u81EA\u751F\u6210] \u6700\u7EC8\u5931\u8D25\u00B7\u6A21\u677F\u515C\u5E95', name);
    return _fallbackTemplate(name, opts, lastErr);
  }

  /** 模板兜底·最小字段 */
  function _fallbackTemplate(name, opts, err) {
    var newChar = {
      id: 'autogen_tpl_' + Date.now() + '_' + name,
      name: name,
      age: opts.age || 35,
      gender: '\u7537',
      ethnicity: '\u6C49',
      origin: '',
      class: '\u5BD2\u95E8',
      title: opts.assignPost || '',
      officialTitle: opts.assignPost || '',
      bio: '\u672A\u8BE6\u00B7' + (opts.reason || '\u51FA\u8EAB\u672A\u660E'),
      historicalSource: '',
      intelligence: 70, administration: 65, valor: 40, benevolence: 60,
      loyalty: 70 + (opts.loyaltyBonus || 0),
      integrity: 65,
      charisma: 60,
      ambition: 55,
      wuchang: { ren: 60, yi: 60, li: 60, zhi: 60, xin: 60 },
      family: name.charAt(0) + '\u6C0F',
      familyTier: 'common',
      familyMembers: [],
      party: opts.party || '',
      resources: { fame: 10, virtue: 5, health: 80, stress: 0, privateWealth: { money:0, grain:0, cloth:0 }, publicPurse: { money:0, grain:0, cloth:0 } },
      alive: true,
      source: opts.reason || '\u81EA\u52A8\u751F\u6210\u00B7\u5931\u8D25\u515C\u5E95',
      recruitTurn: GM.turn,
      isHistorical: false,
      _autoTemplateFallback: true,
      _memorySeeds: [{ turn: GM.turn, event: (opts.reason||'\u5165\u671D') + '\u00B7\u6A21\u677F\u751F\u6210', emotion: '\u5E73' }]
    };
    if (!GM.chars) GM.chars = [];
    GM.chars.push(newChar);
    if (opts.assignPost && GM.officeTree) _tryAssignPost(name, opts.assignPost);
    if (typeof buildIndices === 'function') { try { buildIndices(); } catch(_){} }
    return newChar;
  }

  /** 尝试把 name 填入 officeTree 中指定职位 */
  function _tryAssignPost(name, postTitle) {
    if (!GM.officeTree || !postTitle) return false;
    var assigned = false;
    function walk(nodes) {
      nodes.forEach(function(n){
        if (assigned || !n) return;
        if (n.positions) {
          n.positions.forEach(function(p){
            if (assigned) return;
            if (p.name && (p.name === postTitle || p.name.indexOf(postTitle) >= 0 || postTitle.indexOf(p.name) >= 0)) {
              if (!p.holder || p.holder === '' || p.holder === '空缺') {
                p.holder = name;
                assigned = true;
              }
            }
          });
        }
        if (!assigned && n.subs) walk(n.subs);
      });
    }
    walk(GM.officeTree);
    return assigned;
  }

  // ═══════════════════════════════════════════════════════════════════
  // A · 诏令征召
  // ═══════════════════════════════════════════════════════════════════

  /** 征召一位历史人物入朝为官 */
  async function edictRecruitCharacter(name, postTitle, edictContext) {
    if (!name) return null;
    if (typeof findCharByName === 'function' && findCharByName(name)) {
      if (typeof toast === 'function') toast(name + ' \u5DF2\u5728\u4EBA\u7269\u5FD7');
      return findCharByName(name);
    }
    if (typeof showLoading === 'function') showLoading('\u5F81\u8BCF ' + name + ' \u5165\u671D\u00B7\u4E0A\u7B79\u5BB6\u7545\u2026\u2026', 50);
    try {
      var newChar = await aiGenerateCompleteCharacter(name, {
        reason: '\u7687\u5E1D\u5F81\u8BCF\u8BCF',
        sourceContext: edictContext,
        assignPost: postTitle,
        loyaltyBonus: 10,
        affinityBonus: 15
      });
      if (typeof hideLoading === 'function') hideLoading();
      if (newChar && !newChar._autoTemplateFallback) {
        // 征召代价：皇威-1·吏部礼部尚书关系-5
        if (typeof _adjustHuangwei === 'function') _adjustHuangwei(-1, '\u5F81\u8BCF ' + name);
        _affectBureauchiefs(-5, '\u7687\u5E1D\u7ED5\u8FC7\u94E8\u9009\u00B7\u5F81\u8BCF ' + name);
        if (typeof _kejuWriteJishi === 'function') _kejuWriteJishi('\u5F81\u8BCF\u5165\u671D', name + (postTitle ? '\u00B7\u62DC ' + postTitle : ''), '\u8BCF\u5F81' + (newChar.isHistorical ? '\u5386\u53F2\u540D\u81E3' : '\u58EB\u4EBA'));
        if (typeof addEB === 'function') addEB('\u5F81\u8BCF', name + ' \u5949\u8BCF\u5165\u671D' + (postTitle ? '\u00B7\u4EFB ' + postTitle : ''));
        if (typeof toast === 'function') toast('\uD83D\uDCDC ' + name + ' \u5949\u8BCF\u5165\u671D');
      }
      return newChar;
    } catch(e) {
      if (typeof hideLoading === 'function') hideLoading();
      if (/\u53F2\u5B9E\u4E0D\u53EF\u73B0/.test(e.message || '')) {
        if (typeof toast === 'function') toast('\u26A0 ' + name + ' \u5DF2\u85A8\u6216\u672A\u51FA\u4E16\u00B7\u65E0\u6CD5\u5F81\u8BCF');
      } else {
        if (typeof toast === 'function') toast('\u26A0 \u5F81\u8BCF\u751F\u6210\u5931\u8D25');
      }
      throw e;
    }
  }

  /** 吏部/礼部尚书关系调整 */
  function _affectBureauchiefs(delta, reason) {
    var playerName = (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B';
    ['\u5409\u90E8\u5C1A\u4E66', '\u793C\u90E8\u5C1A\u4E66'].forEach(function(titleKey){
      var ch = (GM.chars||[]).find(function(c){
        if (!c || c.alive === false) return false;
        var t = c.officialTitle || c.title || '';
        return t.indexOf(titleKey) >= 0 || t === titleKey;
      });
      if (ch && typeof AffinityMap !== 'undefined' && AffinityMap.add) {
        AffinityMap.add(ch.name, playerName, delta, reason);
      }
    });
  }

  /** 诏令文本中识别征召模式·返回 [{name, postTitle}] */
  function parseEdictRecruitPatterns(edictText) {
    if (!edictText) return [];
    var results = [];
    var patterns = [
      // 征召 徐鸿渐 入朝
      /[\u5F81\u8BCF](?:\s*)([^\uff0c\uff0e\u3002\uff01\uff1f\u3001\s，。]{2,4})(?:\s*)(?:\u5165\u671D|\u5165\u5173|\u5165\u9663|\u4E3A\u58EB|\u5165\u90FD|\u5F92\u5165)/g,
      // 诏 郑成功 为 福建巡抚 / 诏 X 为 Y
      /\u8BCF(?:\s*)([^\uff0c\uff0e\u3002\uff01\uff1f\u3001\s，。]{2,4})(?:\s*)\u4E3A(?:\s*)([^\uff0c\uff0e\u3002\uff01\uff1f\u3001\s，。]{2,8})/g,
      // 起复 袁崇焕
      /\u8D77\u590D(?:\s*)([^\uff0c\uff0e\u3002\uff01\uff1f\u3001\s，。]{2,4})/g,
      // 徵 刘宗周
      /\u5FB5(?:\s*)([^\uff0c\uff0e\u3002\uff01\uff1f\u3001\s，。]{2,4})(?:\s*)(?:\u4E3A\u58EB|\u5165\u671D)/g,
      // 命 X 为 Y（官职）——更宽松
      /(?:\u547D|\u7740)(?:\s*)([^\uff0c\uff0e\u3002\uff01\uff1f\u3001\s，。]{2,4})(?:\s*)\u4E3A(?:\s*)([^\uff0c\uff0e\u3002\uff01\uff1f\u3001\s，。]{2,8})/g
    ];
    patterns.forEach(function(re){
      var m;
      while ((m = re.exec(edictText)) !== null) {
        var name = (m[1] || '').trim();
        var post = (m[2] || '').trim();
        if (!name || name.length < 2) continue;
        // 排除已在 GM.chars 者
        if (typeof findCharByName === 'function' && findCharByName(name)) continue;
        results.push({ name: name, postTitle: post || '' });
      }
    });
    return results;
  }

  /** 处理诏令文本·自动触发征召 */
  async function handleEdictTextForRecruit(edictText) {
    var candidates = parseEdictRecruitPatterns(edictText);
    if (!candidates.length) return [];
    var recruited = [];
    for (var i=0; i<candidates.length; i++) {
      var c = candidates[i];
      try {
        var ch = await edictRecruitCharacter(c.name, c.postTitle, edictText);
        if (ch) recruited.push(ch);
      } catch(e) {
        console.warn('[\u5F81\u8BCF] ' + c.name + ' \u5931\u8D25', e.message);
      }
    }
    return recruited;
  }

  // ═══════════════════════════════════════════════════════════════════
  // C · 点击具象化（pending 清单管理）
  // ═══════════════════════════════════════════════════════════════════

  /** pending 清单：推演提及但未生成的人物 */
  function addPendingCharacter(entry) {
    if (!GM._pendingCharacters) GM._pendingCharacters = [];
    // 去重+累加 mentions
    var existing = GM._pendingCharacters.find(function(p){ return p.name === entry.name; });
    if (existing) {
      existing.mentions = (existing.mentions || 1) + 1;
      if (entry.snippet) existing.snippet = entry.snippet;
      existing.lastSeenTurn = GM.turn;
      return existing;
    }
    var record = {
      name: entry.name,
      firstSeenTurn: GM.turn,
      lastSeenTurn: GM.turn,
      source: entry.source || '\u63A8\u6F14',
      snippet: entry.snippet || '',
      mentions: 1
    };
    GM._pendingCharacters.push(record);
    return record;
  }

  /** 点击具象化入口·玩家手动触发 */
  /** 整理档案中进度弹窗（专为人物纳入而设） */
  function _openCharGenProgress(name, stage) {
    var existing = document.getElementById('chargen-progress-modal');
    if (existing) existing.remove();
    var m = document.createElement('div');
    m.id = 'chargen-progress-modal';
    m.className = 'modal-bg show';
    m.style.zIndex = 2000;
    m.innerHTML =
      '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:460px;padding:1.3rem 1.6rem;">'
      + '<div style="text-align:center;margin-bottom:0.9rem;">'
      +   '<div style="font-size:2rem;margin-bottom:0.2rem;">\uD83D\uDCDA</div>'
      +   '<div style="font-size:1rem;font-weight:700;color:var(--gold);letter-spacing:0.1em;">\u3014 \u6574\u7406\u6863\u6848 \u3015</div>'
      +   '<div style="font-size:0.82rem;color:var(--txt-d);margin-top:0.2rem;">\u94E8\u66F9\u4E3A\u300C' + _esc(name) + '\u300D\u7ACB\u4F20\u4E2D</div>'
      + '</div>'
      + '<div style="background:var(--bg-2);padding:0.8rem 1rem;border-radius:8px;">'
      +   '<div style="background:var(--bg-3);border-radius:10px;height:12px;overflow:hidden;">'
      +     '<div id="chargen-bar" style="width:5%;height:100%;background:linear-gradient(90deg,var(--celadon-400),var(--gold));transition:width 0.5s;"></div>'
      +   '</div>'
      +   '<div id="chargen-status" style="font-size:0.78rem;color:var(--txt-d);margin-top:0.5rem;text-align:center;">' + (stage || '\u68C0\u7D22\u53F2\u6599\u2026') + '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(m);
  }

  function _updateCharGenProgress(status, pct) {
    var bar = document.getElementById('chargen-bar');
    var st = document.getElementById('chargen-status');
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (st) st.textContent = status || '';
  }

  function _closeCharGenProgress() {
    var m = document.getElementById('chargen-progress-modal');
    if (m) m.remove();
  }

  async function crystallizePendingCharacter(name, extraOpts) {
    // 主查·再按别名/字/号二次查（严格查不到→别名）
    var _found = (typeof findCharByName === 'function') ? findCharByName(name) : null;
    if (!_found && Array.isArray(GM.chars)) {
      _found = GM.chars.find(function(c){
        if (!c) return false;
        if (c.name === name) return true;
        if (c.zi === name || c.hao === name || c.milkName === name) return true;
        if (Array.isArray(c.aliases) && c.aliases.indexOf(name) >= 0) return true;
        if (Array.isArray(c.formerNames) && c.formerNames.indexOf(name) >= 0) return true;
        return false;
      });
    }
    if (_found) {
      if (typeof toast === 'function') toast(name + ' \u5DF2\u5728\u4EBA\u7269\u5FD7（' + (_found.name || '') + '）');
      // 从 pending 列表移除（若存在）·避免下次再触发
      if (GM._pendingCharacters) GM._pendingCharacters = GM._pendingCharacters.filter(function(p){ return p.name !== name; });
      return _found;
    }
    var pending = (GM._pendingCharacters||[]).find(function(p){ return p.name === name; });
    _openCharGenProgress(name, '\u68C0\u7D22\u53F2\u6599\u4E0E\u4E0A\u4E0B\u6587\u2026');
    // 视觉推进·不等 AI
    var progTimer = setInterval(function(){
      var bar = document.getElementById('chargen-bar');
      if (!bar) { clearInterval(progTimer); return; }
      var cur = parseInt((bar.style.width || '0').replace('%',''), 10) || 0;
      if (cur < 85) {
        cur = Math.min(85, cur + 5 + Math.random()*3);
        bar.style.width = cur + '%';
        var st = document.getElementById('chargen-status');
        if (st) {
          if (cur < 25) st.textContent = '\u68C0\u7D22\u53F2\u6599\u4E0E\u4E0A\u4E0B\u6587\u2026';
          else if (cur < 50) st.textContent = '\u9274\u522B\u771F\u5047\u00B7\u6838\u5408\u5E74\u9F84\u2026';
          else if (cur < 70) st.textContent = '\u4EE4\u94E8\u66F9\u8BB0\u4E0B\u7C4D\u8D2F\u5BB6\u8C31\u4E0E\u751F\u5E73\u2026';
          else st.textContent = '\u8BB0\u8F7D\u8EAB\u4EFD\u00B7\u54C1\u8BC4\u6027\u60C5\u2026';
        }
      }
    }, 400);
    try {
      var opts = Object.assign({
        reason: '\u73A9\u5BB6\u70B9\u51FB\u7EB3\u5165\u4EBA\u7269\u5FD7',
        sourceContext: pending ? pending.snippet : ''
      }, extraOpts || {});
      var ch = await aiGenerateCompleteCharacter(name, opts);
      clearInterval(progTimer);
      _updateCharGenProgress('\u2705 ' + name + ' \u5DF2\u7EB3\u5165\u4EBA\u7269\u5FD7', 100);
      // 从 pending 移除
      if (GM._pendingCharacters) GM._pendingCharacters = GM._pendingCharacters.filter(function(p){ return p.name !== name; });
      // 强制重建索引+刷新右侧人物列表
      if (typeof buildIndices === 'function') { try { buildIndices(); } catch(_){} }
      if (typeof renderRenwu === 'function') { try { renderRenwu(); } catch(_){} }
      // 短停留后关闭
      setTimeout(_closeCharGenProgress, 600);
      if (typeof toast === 'function') toast('\u2705 ' + name + ' \u5DF2\u7EB3\u5165\u4EBA\u7269\u5FD7');
      if (typeof _kejuWriteJishi === 'function') _kejuWriteJishi('\u7EB3\u5165\u4EBA\u7269\u5FD7', name, pending ? pending.snippet.slice(0,80) : '');
      return ch;
    } catch(e) {
      clearInterval(progTimer);
      _updateCharGenProgress('\u274C \u751F\u6210\u5931\u8D25\uFF1A' + ((e && e.message) || '\u672A\u77E5'), 100);
      setTimeout(_closeCharGenProgress, 1400);
      if (typeof toast === 'function') toast('\u26A0 \u751F\u6210\u5931\u8D25: ' + (e.message || e));
      throw e;
    }
  }

  /** 渲染页面中的人名·把 pending 人物标为可点击 */
  function wrapPendingName(name) {
    if (!name) return '';
    // 已在 GM.chars·不包装（由原系统处理）
    if (typeof findCharByName === 'function' && findCharByName(name)) return _esc(name);
    // 在 pending 列表·加可点击 span
    var isPending = (GM._pendingCharacters||[]).some(function(p){ return p.name === name; });
    if (isPending) {
      return '<span class="tm-pending-char" style="text-decoration:underline dotted;color:var(--amber-400);cursor:pointer;" ' +
             'onclick="_tmClickPendingChar(\'' + _esc(name).replace(/\'/g, "\\'") + '\')" ' +
             'title="\u70B9\u51FB\u7EB3\u5165\u4EBA\u7269\u5FD7">' + _esc(name) + '</span>';
    }
    return _esc(name);
  }

  function _esc(s) {
    return (typeof escHtml === 'function') ? escHtml(s) : String(s||'').replace(/[&<>"']/g, function(c){
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  /** 全局 onclick 处理 */
  global._tmClickPendingChar = function(name) {
    if (!confirm('\u662F\u5426\u5C06 ' + name + ' \u7EB3\u5165\u4EBA\u7269\u5FD7\uFF1F\n(AI \u4F1A\u751F\u6210\u5B8C\u6574\u89D2\u8272\u6863\u6848\u00B7\u7EA6 3-5 \u79D2)')) return;
    crystallizePendingCharacter(name).catch(function(e){ console.warn(e); });
  };

  // ═══════════════════════════════════════════════════════════════════
  // B · 推演后扫描（供 tm-endturn.js 调用）
  // ═══════════════════════════════════════════════════════════════════

  /** 从推演结果中提取候选人名 */
  function extractMentionedCharacterNames(aiResult) {
    if (!aiResult) return [];
    var texts = [];
    if (typeof aiResult === 'string') texts.push(aiResult);
    else if (typeof aiResult === 'object') {
      if (aiResult.zhengwen) texts.push(aiResult.zhengwen);
      if (aiResult.xinglu) texts.push(aiResult.xinglu);
      // 后人戏说（场景叙事）
      if (aiResult.houren_xishuo) texts.push(aiResult.houren_xishuo);
      if (aiResult.hourenXishuo) texts.push(aiResult.hourenXishuo);
      // 实录（正史体）
      if (aiResult.shilu_text) texts.push(aiResult.shilu_text);
      if (aiResult.shiluText) texts.push(aiResult.shiluText);
      // 时政记标题/总结
      if (aiResult.szj_title) texts.push(aiResult.szj_title);
      if (aiResult.szjTitle) texts.push(aiResult.szjTitle);
      if (aiResult.szj_summary) texts.push(aiResult.szj_summary);
      if (aiResult.szjSummary) texts.push(aiResult.szjSummary);
      // 玩家状态/内心（可能提到别的 NPC）
      if (aiResult.player_status) texts.push(aiResult.player_status);
      if (aiResult.playerStatus) texts.push(aiResult.playerStatus);
      if (aiResult.player_inner) texts.push(aiResult.player_inner);
      if (aiResult.playerInner) texts.push(aiResult.playerInner);
      // 数值变化说明 edict_feedback[]
      var _efKey = aiResult.edict_feedback || aiResult.edictFeedback;
      if (Array.isArray(_efKey)) _efKey.forEach(function(ef){
        if (!ef) return;
        if (ef.feedback) texts.push(ef.feedback);
        if (ef.content) texts.push(ef.content);
        if (ef.assignee) texts.push(ef.assignee);
      });
      // 人事变动
      var _pcKey = aiResult.personnel_changes || aiResult.personnelChanges;
      if (Array.isArray(_pcKey)) _pcKey.forEach(function(pc){
        if (!pc) return;
        if (pc.name) texts.push(pc.name);
        if (pc.former) texts.push(pc.former);
        if (pc.change) texts.push(pc.change);
        if (pc.reason) texts.push(pc.reason);
      });
      // 事件
      if (Array.isArray(aiResult.events)) aiResult.events.forEach(function(e){
        if (e && e.text) texts.push(e.text);
        if (e && e.title) texts.push(e.title);
      });
      // NPC 自主行为
      if (Array.isArray(aiResult.npc_actions)) aiResult.npc_actions.forEach(function(a){
        if (a && a.desc) texts.push(a.desc);
        if (a && a.actor) texts.push(a.actor);
      });
      // NPC 互动
      if (Array.isArray(aiResult.npc_interactions)) aiResult.npc_interactions.forEach(function(a){
        if (!a) return;
        if (a.desc) texts.push(a.desc);
        if (a.actor) texts.push(a.actor);
        if (a.target) texts.push(a.target);
        if (a.content) texts.push(a.content);
      });
    }
    var fullText = texts.join('\n');
    return _extractNames(fullText);
  }

  /** 简易人名提取：基于姓氏字典+2-4 字模式 */
  var COMMON_SURNAMES = '\u8D75\u94B1\u5B59\u674E\u5468\u5434\u90D1\u738B\u51AF\u9648\u80CE\u536B\u848B\u6C88\u97E9\u6768\u6731\u79E6\u5C24\u8BB8\u4F55\u5415\u65BD\u5F20\u5B54\u66F9\u4E25\u534E\u91D1\u9B4F\u9676\u59DC\u621A\u8C22\u90B9\u55BB\u67CF\u6C34\u7AC7\u7AE0\u4E91\u82CF\u6F58\u845B\u595A\u8303\u5F6D\u90CE\u9C81\u97E6\u660C\u9A6C\u82D7\u51E4\u82B1\u65B9\u4FDE\u4EFB\u8881\u67F3\u9146\u9C8D\u53F2\u5510\u8D39\u5ED6\u5CD1\u859B\u96F7\u8D3A\u502A\u6C64\u6EE1\u4E8E\u5E24\u6BB7\u7F57\u74D5\u5176\u90DD\u4E4C\u5B89\u5E38\u4E50\u4E8E\u65F6\u5085\u76AE\u535E\u9F50\u5EB7\u4F0D\u4F59\u5143\u535C\u987E\u5B5F\u5E73\u9EC4\u548C\u7A46\u8427\u5C39\u59DA\u90B5\u6E5B\u6C6A\u7941\u6BDB\u79B9\u72C4\u7C73\u8D1D\u660E\u81E7\u8BA1\u4F0F\u6210\u6234\u8C08\u5B8B\u8305\u5E9E\u718A\u7EAA\u8212\u5C48\u9879\u795D\u8463\u6881\u675C\u962E\u84DD\u95F5\u5E2D\u5B63\u9EBB\u5F3A\u8D3E\u8DEF\u5A04\u5371\u6C5F\u7AE5\u989C\u90ED\u6885\u76DB\u6797\u5201\u953A\u5F90\u4E18\u9A86\u9AD8\u590F\u8521\u7530\u6A0A\u80E1\u51CC\u970D\u865E\u4E07\u652F\u67EF\u54B8\u7BA1\u5362\u83AB\u7ECF\u623F\u88D8\u7F2A\u5E72\u89E3\u5E94\u5B97\u4E01\u5BA3\u8D32\u9093\u90C1\u5355\u676D\u6D2A\u5305\u8BF8\u5DE6\u77F3\u5D14\u5409\u94AE\u9F9A\u7A0B\u5D47\u90A2\u6ED1\u88F4\u9646\u8363\u7FC1\u8340\u7F8A\u65BC\u60E0\u7504\u9E92\u5BB6\u5C01\u82EE\u7FF1\u5112\u65E7\u6B27\u67E5\u540E\u8346\u7EA2\u6E38\u7AFA\u6743\u9011\u76D6\u76CA\u6853\u516C\u4E07\u4FDF\u53F8\u9A6C\u4E0A\u5B98\u6B27\u9633\u590F\u4FAF\u8BF8\u845B\u95FB\u4EBA\u4E1C\u65B9\u8D6B\u8FDE\u7687\u7518\u7A7A\u53D4\u5B6B\u6155\u5BB9\u4EE4\u72D0\u949F\u79BB\u5B87\u6587\u4EBA\u957F\u5B59\u6155\u5BB9\u9C9C\u4E8E\u95FE\u4E18\u53F8\u5F92\u53F8\u7A7A\u4E38\u4E0A\u5B98\u6B27\u9633';
  var COMMON_TITLE_KEYWORDS = ['\u5927\u4EBA', '\u5B98', '\u5C06\u519B', '\u4E1E\u76F8', '\u5927\u5B66\u58EB', '\u4F8D\u90CE', '\u5C1A\u4E66', '\u90CE\u4E2D', '\u5F52\u8BDA'];

  // 复姓白名单——只有开头命中复姓时才允许 3-4 字；否则姓只占 1 字
  var COMPOUND_SURNAMES = ['\u53F8\u9A6C','\u6B27\u9633','\u590F\u4FAF','\u8BF8\u845B','\u4E0A\u5B98','\u4EE4\u72D0','\u8D6B\u8FDE','\u6155\u5BB9','\u5B87\u6587','\u4E07\u4FDF','\u7533\u5C60','\u95FB\u4EBA','\u4E1C\u65B9','\u65BC\u94B1','\u516C\u51B6','\u8F69\u8F95','\u7687\u752B','\u957F\u5B59','\u5B97\u653F','\u5BB0\u7236','\u4E1C\u90ED','\u5357\u95E8','\u897F\u95E8','\u4E1C\u95E8','\u516C\u5B59','\u4EF2\u5B59','\u590F\u8C37','\u76D6\u805B','\u6EE1\u5BB9','\u95FE\u4E18','\u6FEE\u9633','\u4E50\u6B63','\u8C37\u6881','\u5DE6\u4E18','\u4E1C\u91CC','\u5357\u5BAB','\u516C\u4E58','\u6E06\u53F0','\u7AEF\u6728','\u5DEB\u9A6C','\u5B50\u8F66','\u9885\u5B59','\u516C\u897F','\u7F8A\u820C','\u5FE0\u541B'];
  // 人名后常接的动词/助词/语气词——若 3-4 字名以此结尾，说明误抓，须截短
  var TRAIL_TRIM_CHARS = '\u63A5\u5165\u51FA\u767B\u5949\u594F\u8BF4\u8A00\u8BF7\u4EE4\u6D3E\u9063\u4F7F\u5E26\u9886\u7387\u547D\u4F20\u544A\u62A5\u53D7\u884C\u53BB\u8FD4\u8D70\u8FDB\u9000\u7559\u5C45\u7ACB\u5750\u6B7B\u6D3B\u751F\u4EA1\u901D\u85A8\u5D29\u9635\u65A9\u6740\u64DE\u4FD8\u8D25\u80DC\u6218\u5F81\u4F10\u653B\u5B88\u5F00\u95ED\u8BFB\u5199\u4E34\u5C65\u62DC\u8C22\u62D2\u7EB3\u8D50\u8D4F\u7F5A\u8D2C\u8FC1\u6388\u53EC\u8F9E\u8BBF\u63A2\u5F80\u5F52\u8FD8\u8DEA\u4E4B\u7684\u4E4E\u4E5F\u77E3\u7109\u54C9\u8033\u800C\u4E14\u6216\u65E2\u5C24\u4E0E\u548C\u540C\u5408\u5171\u8FDE\u504C\u5E76\u4EA6\u53C8\u518D\u590D\u6108\u8D8A\u66F4\u6B64\u662F\u5373\u4E43\u4FBF\u5C31\u5219\u76D6\u975E\u5C82\u4F55\u5974\u66F0\u80E1\u5B89\u59CB\u7EC8\u672B\u521D\u5728\u4ECE\u5411\u4EE5\u4E3A\u7531\u56E0\u4E8E\u6308\u52D1\u5374\u4E26\u53EA\u4EC5\u7686\u5C1A\u53CA\u90A3\u8FD9\u770B\u95EE\u7B54\u8BAE\u79FB\u5EF7\u9047\u5F17\u6302\u79BB\u5EFA\u8D77\u79F0\u964D\u5352\u6B81\u8D74\u8FCE\u643A\u903C\u56F4\u51FB\u7834\u7F1A\u541B\u5F13\u6EE1\u653E\u53D6\u6DF1\u5FE0\u4FE1\u660E\u5FAA\u6307\u62F1\u5F80\u8FD0\u81F3\u5230\u5012\u6258\u5347\u8F6C\u5DE1\u628A\u5EA7\u6B63\u4E1C\u897F\u5357\u5317\u4E2D\u4E0A\u4E0B\u547C\u53F7\u5E9C\u6BD2\u8D23\u8BAD\u7B97';

  // 判定候选是否疑似只是人名+尾部动词/助词：迭代截短直至末字不是动词/助词
  // 例："张惟贤言曰" → "张惟贤言" → "张惟贤"（单次截短不够，需循环）
  function _trimTrailing(cand) {
    if (!cand || cand.length <= 2) return cand;
    while (cand.length > 2 && TRAIL_TRIM_CHARS.indexOf(cand.charAt(cand.length - 1)) >= 0) {
      cand = cand.slice(0, -1);
    }
    return cand;
  }

  // 常见非人名的动宾/并列短语（形式上像"姓+字"但实为动词短语）·黑名单直接过滤
  //   这些第一个字虽在 COMMON_SURNAMES 但多数场景是副词/动词前缀
  var NAME_BLACKLIST = {
    // 查: 多为"查+宾语"
    '查天':1,'查看':1,'查核':1,'查办':1,'查阅':1,'查证':1,'查找':1,'查处':1,'查获':1,'查封':1,'查清':1,'查明':1,'查抄':1,'查问':1,'查禁':1,'查验':1,'查勘':1,'查询':1,'查实':1,'查案':1,'查收':1,'查对':1,'查考':1,
    // 齐: 多为"齐+动词"
    '齐发':1,'齐集':1,'齐备':1,'齐整':1,'齐心':1,'齐声':1,'齐名':1,'齐头':1,'齐全':1,'齐鸣':1,'齐唱':1,'齐飞':1,'齐进':1,
    // 严: 多为"严+动词" (严 is 庄 surname·但严+X 通常严厉之意)
    '严饬':1,'严禁':1,'严查':1,'严办':1,'严令':1,'严正':1,'严厉':1,'严明':1,'严格':1,'严密':1,'严重':1,'严肃':1,'严防':1,'严守':1,'严审':1,'严惩':1,'严斥':1,'严责':1,'严责':1,'严厉':1,'严察':1,'严整':1,'严拿':1,'严追':1,'严催':1,'严限':1,
    // 孟: 多为"孟+时令"
    '孟春':1,'孟夏':1,'孟秋':1,'孟冬':1,
    // 季: 同上
    '季春':1,'季夏':1,'季秋':1,'季冬':1,
    // 仲: 同上
    '仲春':1,'仲夏':1,'仲秋':1,'仲冬':1,
    // 方: 多为"方+动词/副词"
    '方才':1,'方始':1,'方便':1,'方面':1,'方圆':1,'方知':1,'方今':1,
    // 任: "任+动词"
    '任命':1,'任用':1,'任免':1,'任职':1,'任由':1,'任意':1,'任凭':1,'任何':1,'任务':1,
    // 何: 多为疑问词"何+X"
    '何等':1,'何况':1,'何必':1,'何在':1,'何曾':1,'何以':1,'何妨':1,'何时':1,'何地':1,'何人':1,
    // 安: "安+动词"
    '安置':1,'安顿':1,'安排':1,'安宁':1,'安分':1,'安抚':1,'安民':1,'安邦':1,
    // 时: "时+名词"
    '时政':1,'时局':1,'时势':1,'时事':1,'时运':1,
    // 成: "成+动词"
    '成功':1,'成败':1,'成就':1,'成全':1,'成立':1,
    // 关: "关+名词"
    '关心':1,'关注':1,'关切':1,'关门':1,'关口':1,'关隘':1,'关外':1,'关内':1,'关东':1,'关西':1,'关系':1,'关乎':1,
    // 计: "计+动词"
    '计议':1,'计策':1,'计划':1,'计算':1,'计谋':1,
    // 华: "华+名词"
    '华夏':1,'华表':1,
    // 于: "于是"等
    '于是':1,'于此':1,
    // 要: "要+名词"
    '要害':1,'要领':1,'要职':1,'要津':1,'要紧':1,'要略':1,'要道':1,'要义':1,'要点':1,'要事':1,'要员':1,'要地':1,
    // 常: "常+X"
    '常朝':1,'常例':1,'常制':1,'常识':1,'常规':1,'常常':1,
    // 石: "石+名词"
    '石碑':1,'石刻':1,
    // 水: "水+名词"
    '水利':1,'水师':1,'水军':1,'水患':1,
    // 应: "应+动词"
    '应当':1,'应允':1,'应付':1,'应对':1,'应天':1,'应承':1,'应该':1,
    // 易: "易+动词"
    '易主':1,'易帜':1,'易手':1,
    // 万: "万+名词"
    '万分':1,'万千':1,'万方':1,'万民':1,'万物':1,'万世':1,'万代':1,'万象':1,'万岁':1,
    // 平: "平+动词/名词"
    '平定':1,'平息':1,'平叛':1,'平乱':1,'平抑':1,'平反':1,'平日':1,'平时':1,'平常':1,'平安':1,
    // 明: "明+名词"
    '明旨':1,'明白':1,'明示':1,'明朝':1,'明年':1,'明日':1,
    // 白: "白+X"
    '白天':1,'白日':1,'白银':1,
    // 国: "国+名词"
    '国事':1,'国库':1,'国朝':1,'国家':1,
    // 戚: 戚少
    '戚然':1,'戚戚':1,
    // 尚: "尚+名词"
    '尚书':1,'尚有':1,'尚且':1,'尚未':1,
    // 单: "单+名词"
    '单独':1,'单子':1,'单位':1,
    // 上: 一律虚词
    '上官':1,'上旨':1,'上表':1,'上书':1,
    // 景: "景+名词"
    '景色':1,'景象':1,'景况':1,
    // 井: "井+名词"
    '井田':1,'井井':1,
    // 高: "高+X"
    '高升':1,'高兴':1,
    // 武: "武+X"
    '武将':1,'武官':1,'武备':1,'武将':1,
    // 文: 同上
    '文官':1,'文臣':1,'文书':1,'文牍':1,
    // 乐: 多义
    '乐于':1,
    // 左右南北东西
    '左右':1,'上下':1,'南北':1,'东西':1
  };

  // 构建已知姓名字典索引（含别名 zi/hao/milkName/aliases/formerNames）——放入集合供预扫
  function _buildKnownNameSet() {
    var known = {};
    var G = (typeof global !== 'undefined' && global.GM) || (typeof window !== 'undefined' && window.GM);
    if (!G || !Array.isArray(G.chars)) return known;
    G.chars.forEach(function(c) {
      if (!c) return;
      if (c.name && c.name.length >= 2) known[c.name] = c.name;
      // 别名
      ['zi','haoName','milkName'].forEach(function(k) {
        var v = c[k];
        if (v && typeof v === 'string' && v.length >= 2) known[v] = c.name;
      });
      if (Array.isArray(c.aliases)) c.aliases.forEach(function(a) { if (a && a.length >= 2) known[a] = c.name; });
      if (Array.isArray(c.formerNames)) c.formerNames.forEach(function(a) { if (a && a.length >= 2) known[a] = c.name; });
    });
    return known;
  }

  // 语境锚点：姓名后常紧跟这些动词/虚词·是抓非汉姓名(皇太极/努尔哈赤/林丹汗等)的关键
  // 匹配"[2-5字实体] + 动作词"·如"皇太极奏曰/努尔哈赤遣使/林丹汗叛"
  var CONTEXT_VERB_PATTERNS = '\u594F\u66F0|\u594F\u79F0|\u594F\u4E8E|\u8868\u594F|\u4E0A\u8868|\u4E0A\u7591|\u4E0A\u8A00|\u4E0A\u4E66|\u8C0F\u66F0|\u8C0F\u8BF7|\u5F39\u52BE|\u5BC6\u594F|\u6539\u594F|\u884C\u6587|\u8868\u8BF7|\u4EA7\u661F|\u8A00\u4E8E|\u544A\u7262|\u544A\u78AA|\u4E0A\u8FD0|\u7591\u66F0|\u8C0F\u4E91|\u613F\u8FD0|\u76F4\u9648|\u884C\u6587|\u6C42\u89C1|\u6267\u4E8C|\u5165\u66F0|\u5165\u8003|\u4E0A\u79C9|\u8C0F\u79C1|\u4E0A\u4EE3|\u7591\u9648|\u8C0F\u8BDE|\u4EE3\u594F|\u53CC\u594F|\u66F0|\u4E91|\u7ADF|\u91CA|\u590D\u594F|\u793B\u594F';
  var CONTEXT_ACTION_PATTERNS = '\u9063\u4F7F|\u8D77\u5175|\u53CD\u53DB|\u6295\u8BDA|\u964D\u660E|\u53DB\u660E|\u6295\u660E|\u8BE0\u6B7B|\u5F52\u9644|\u7387\u90E8|\u4F39\u5175|\u6311\u8845|\u72EF\u8FB9|\u5BC7\u8FB9|\u5165\u8FB9|\u8FDB\u8D21|\u4F20\u6A9C|\u6253\u5192\u8FEB\u8FD1|\u519B\u4F7F|\u7EB3\u522B|\u8FD4\u4EAC|\u8FDB\u4EAC|\u628A\u8FD4';
  var CONTEXT_APPOINT_PATTERNS = '\u6388|\u62DC|\u8865|\u8C03|\u5347|\u4EFB|\u7F58|\u8FC1|\u51FA\u4EFB|\u89D2|\u8FDB|\u64E2|\u547D|\u5982|\u8D70\u8865|\u5F52\u4E8E|\u6388\u4E88';

  function _extractNames(text) {
    if (!text) return [];
    var names = [];
    var nameSet = {};

    // 已知姓名字典（含别名·字·号）——用于两处：
    // 1. 跳过已在人物志的角色（包括按别名提及的情形，如用字"玄扈"提及徐光启）
    // 2. 避免 findCharByName 因只索引主名而漏过别名
    var known = _buildKnownNameSet();

    // 辅助：验证候选是否可能为人名(非汉姓场景用)·2-5 字·非空·非黑名单·非称谓
    function _validateCandidate(cand) {
      if (!cand || cand.length < 2 || cand.length > 5) return false;
      if (NAME_BLACKLIST[cand]) return false;
      // 过滤明显的称谓/官职/地名/时间短语
      if (/[\u5E1D\u541B\u81E3\u540E\u5983\u5B5F\u7956\u7687\u54C1\u8FB9\u4EAC\u90E1\u53BF\u5E9C\u8857\u5FB7]/.test(cand)) {
        // 含这些字且纯粹为地名/称谓的 reject
        if (/^(皇帝|陛下|圣上|朕躬|本朝|朝廷|朝中|朝野|后宫|太监|东厂|西厂|锦衣|六部|内阁|都察|兵部|吏部|户部|礼部|刑部|工部|鸿胪|大理|翰林)$/.test(cand)) return false;
      }
      // 过滤明显的虚词组合
      if (/^(于是|于此|如此|因此|此后|此前|其时|其实|其中|其间|其后|其上|然而|然则|但是|故而)$/.test(cand)) return false;
      if (/[\u7684\u4E86\u4EE5\u4E3A\u4E5F\u6216|那|这|什|怎]/.test(cand.charAt(0))) return false;
      // 尾字过滤
      if (TRAIL_TRIM_CHARS.indexOf(cand.charAt(cand.length - 1)) >= 0) return false;
      return true;
    }

    // ═══ Pass 1·汉人姓氏模式扫描 ═══
    var re = /[\u4e00-\u9fa5]+/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var block = m[0];
      for (var i = 0; i < block.length; i++) {
        if (COMMON_SURNAMES.indexOf(block.charAt(i)) < 0) continue;
        var two = block.substr(i, 2);
        var isCompound = (i + 1 < block.length) && (COMPOUND_SURNAMES.indexOf(two) >= 0);
        var maxLen = isCompound ? 4 : 3;
        var minLen = isCompound ? 3 : 2;
        var cand = null;
        for (var len = maxLen; len >= minLen; len--) {
          if (i + len > block.length) continue;
          var raw = block.substr(i, len);
          // ★ 先查已知人名字典·完全匹配则直接用 raw 不 trim
          // (修 bug·卢象升末字"升"被 TRAIL_TRIM_CHARS 误剪成"卢象")
          if (known[raw]) {
            cand = raw;
            break;
          }
          var trimmed = _trimTrailing(raw);
          if (trimmed.length < minLen) continue;
          if (COMMON_SURNAMES.indexOf(trimmed.charAt(0)) < 0) continue;
          cand = trimmed;
          break;
        }
        if (!cand || cand.length < 2) continue;
        // 过滤：官职/虚词/称呼
        if (/[\u738B\u8D75\u674E\u5218]\u671D|[\u540E\u5FA1]|[\u4ED6\u6211\u4F60]/.test(cand)) continue;
        if (/^(\u7687\u5E1D|\u9661\u4E0B|\u6211\u5927|\u672C\u671D|\u671D\u5EF7|\u540E\u5BAB|\u592A\u76D1)$/.test(cand)) continue;
        var _hitTitle = false;
        for (var _tk = 0; _tk < COMMON_TITLE_KEYWORDS.length; _tk++) {
          if (cand.indexOf(COMMON_TITLE_KEYWORDS[_tk]) >= 0) { _hitTitle = true; break; }
        }
        if (_hitTitle) continue;
        if (NAME_BLACKLIST[cand]) continue;
        if (known[cand] || (typeof findCharByName === 'function' && findCharByName(cand))) {
          i += cand.length - 1;
          continue;
        }
        if (!nameSet[cand]) {
          nameSet[cand] = true;
          names.push(cand);
        }
        i += cand.length - 1;
      }
    }

    // ═══ Pass 2·语境锚点·捕获非汉姓名(皇太极/努尔哈赤/林丹汗/阿敏 等) ═══
    // 2a·"X奏曰/X疏云/X上疏" → 前置 2-5 字实体
    try {
      var ctxRe = new RegExp('([\\u4e00-\\u9fa5]{2,5})(?:' + CONTEXT_VERB_PATTERNS + ')', 'g');
      var mc;
      while ((mc = ctxRe.exec(text)) !== null) {
        var cand2 = _trimTrailing(mc[1]);
        if (!_validateCandidate(cand2)) continue;
        if (known[cand2] || (typeof findCharByName === 'function' && findCharByName(cand2))) continue;
        if (nameSet[cand2]) continue;
        nameSet[cand2] = true;
        names.push(cand2);
      }
    } catch(e) {}

    // 2b·"X遣使/X起兵/X降明" → 前置 2-5 字军政主体
    try {
      var actRe = new RegExp('([\\u4e00-\\u9fa5]{2,5})(?:' + CONTEXT_ACTION_PATTERNS + ')', 'g');
      var ma;
      while ((ma = actRe.exec(text)) !== null) {
        var cand3 = _trimTrailing(ma[1]);
        if (!_validateCandidate(cand3)) continue;
        if (known[cand3] || (typeof findCharByName === 'function' && findCharByName(cand3))) continue;
        if (nameSet[cand3]) continue;
        // 过滤典型非人名的前置词
        if (/^(本朝|大明|后金|蒙古|鞑靼|满洲|建州|察哈尔|林丹|朝鲜|流寇|流民|饥民|贼寇|海寇|倭寇|白莲|闻香)$/.test(cand3)) continue;
        nameSet[cand3] = true;
        names.push(cand3);
      }
    } catch(e) {}

    // 2c·"授/拜/擢/升X为" → 人名在中间
    try {
      var apRe = new RegExp('(?:' + CONTEXT_APPOINT_PATTERNS + ')([\\u4e00-\\u9fa5]{2,5})\\u4E3A', 'g');
      var map2;
      while ((map2 = apRe.exec(text)) !== null) {
        var cand4 = _trimTrailing(map2[1]);
        if (!_validateCandidate(cand4)) continue;
        if (known[cand4] || (typeof findCharByName === 'function' && findCharByName(cand4))) continue;
        if (nameSet[cand4]) continue;
        nameSet[cand4] = true;
        names.push(cand4);
      }
    } catch(e) {}

    // 2d·"X曰:" "X云:" "X言:" 中文冒号/引号前的短实体(常为对话者)
    try {
      var spRe = /([\u4e00-\u9fa5]{2,4})(?:[\u66F0\u4E91\u8A00\u8BF4\u9053])[\uFF1A:]/g;
      var ms;
      while ((ms = spRe.exec(text)) !== null) {
        var cand5 = _trimTrailing(ms[1]);
        if (!_validateCandidate(cand5)) continue;
        if (known[cand5] || (typeof findCharByName === 'function' && findCharByName(cand5))) continue;
        if (nameSet[cand5]) continue;
        nameSet[cand5] = true;
        names.push(cand5);
      }
    } catch(e) {}

    return names;
  }

  /** 判定重要性：major=自动生成·minor=入 pending */
  function _judgeImportance(name, aiResult) {
    if (!aiResult) return 'minor';
    var texts = [];
    if (typeof aiResult === 'object') {
      if (aiResult.zhengwen) texts.push(aiResult.zhengwen);
      if (Array.isArray(aiResult.events)) aiResult.events.forEach(function(e){ if (e && e.text) texts.push(e.text); });
      if (Array.isArray(aiResult.npc_actions)) aiResult.npc_actions.forEach(function(a){ if (a && a.actor === name) texts.push('[actor]'); });
    }
    var full = texts.join('\n');
    // 出现次数
    var count = (full.match(new RegExp(name, 'g')) || []).length;
    if (count >= 2) return 'major';
    // events 主角 or npc_actions 动作者
    if (full.indexOf('[actor]') >= 0) return 'major';
    if (aiResult && Array.isArray(aiResult.events)) {
      for (var i=0; i<aiResult.events.length; i++) {
        var ev = aiResult.events[i];
        if (ev && Array.isArray(ev.participants) && ev.participants.indexOf(name) >= 0) return 'major';
        if (ev && ev.protagonist === name) return 'major';
      }
    }
    return 'minor';
  }

  /** 主扫描入口·供 endturn 调用 */
  async function scanMentionedCharacters(aiResult) {
    if (!GM._pendingCharacters) GM._pendingCharacters = [];
    var candidates = extractMentionedCharacterNames(aiResult);
    if (!candidates.length) return { generated: [], pending: [] };

    // ═══ 二次防御：剔除已存在于人物志的候选（模糊匹配+别名+字号） ═══
    // _extractNames 已做 findCharByName 严格匹配·但可能漏过别名/字/号/旧名
    // 此处再做一次宽松检查·避免对已存在角色发起无效 AI 调用
    var _aliveMap = {};
    (GM.chars || []).forEach(function(c) {
      if (!c) return;
      _aliveMap[c.name] = c;
      // 别名索引：字 / 号 / 乳名 / 曾用名
      if (c.zi) _aliveMap[c.zi] = c;
      if (c.hao) _aliveMap[c.hao] = c;
      if (c.milkName) _aliveMap[c.milkName] = c;
      if (Array.isArray(c.aliases)) c.aliases.forEach(function(al) { if (al) _aliveMap[al] = c; });
      if (Array.isArray(c.formerNames)) c.formerNames.forEach(function(fn) { if (fn) _aliveMap[fn] = c; });
    });
    candidates = candidates.filter(function(name) {
      if (!name) return false;
      // 严格匹配
      if (_aliveMap[name]) return false;
      // 去除可能的前后空格/全角空格
      var trimmed = name.replace(/[\s\u3000]/g, '');
      if (trimmed !== name && _aliveMap[trimmed]) return false;
      return true;
    });
    if (!candidates.length) return { generated: [], pending: [] };

    var generated = [];
    var pendingAdded = [];
    var fullTexts = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult).slice(0, 2000);

    for (var i=0; i<candidates.length && i<20; i++) {  // 单回合最多 20 名候选
      var name = candidates[i];
      // 循环内再次防御——异步期间可能有其他代码往 GM.chars 添加
      if (typeof findCharByName === 'function' && findCharByName(name)) continue;
      var importance = _judgeImportance(name, aiResult);
      // 检查 pending 累计 mentions
      var existing = GM._pendingCharacters.find(function(p){ return p.name === name; });
      if (existing) {
        existing.mentions++;
        existing.lastSeenTurn = GM.turn;
        if (existing.mentions >= 2) importance = 'major';  // 累计出场升级
      }

      if (importance === 'major') {
        try {
          var snippet = _extractSnippet(fullTexts, name);
          var ch = await aiGenerateCompleteCharacter(name, {
            reason: '\u63A8\u6F14\u6D8C\u73B0',
            sourceContext: snippet
          });
          generated.push(name);
          // 若之前在 pending·移除
          GM._pendingCharacters = GM._pendingCharacters.filter(function(p){ return p.name !== name; });
        } catch(e) {
          console.warn('[扫描生成] ' + name + ' 失败', e.message);
          // 失败·降级为 pending
          addPendingCharacter({ name: name, source: '\u63A8\u6F14', snippet: _extractSnippet(fullTexts, name) });
          pendingAdded.push(name);
        }
      } else {
        addPendingCharacter({ name: name, source: '\u63A8\u6F14', snippet: _extractSnippet(fullTexts, name) });
        pendingAdded.push(name);
      }
    }
    return { generated: generated, pending: pendingAdded };
  }

  /** 提取人名周边文本片段 */
  function _extractSnippet(text, name) {
    if (!text) return '';
    var idx = text.indexOf(name);
    if (idx < 0) return '';
    var start = Math.max(0, idx - 40);
    var end = Math.min(text.length, idx + 80);
    return text.slice(start, end);
  }

  // ═══════════════════════════════════════════════════════════════════
  // C · DOM 装饰器：特定页面把 pending 人名变可点击
  // ═══════════════════════════════════════════════════════════════════

  /** 给 container 内的文本节点添加可点击的 pending 人名装饰 */
  function decoratePendingInDom(container) {
    if (!container) return;
    var pending = GM._pendingCharacters || [];
    if (!pending.length) return;
    // 按长度降序排，避免短名被先匹配
    var names = pending.map(function(p){ return p.name; }).sort(function(a,b){ return b.length - a.length; });
    if (!names.length) return;

    // 转义 regex
    function esc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    var pattern = new RegExp('(' + names.map(esc).join('|') + ')', 'g');

    // 遍历 text nodes（排除 script/style/已装饰）
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT','STYLE'].indexOf(p.nodeName) >= 0) return NodeFilter.FILTER_REJECT;
        if (p.classList && p.classList.contains('tm-pending-char')) return NodeFilter.FILTER_REJECT;
        return pattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodesToReplace = [];
    var node;
    while ((node = walker.nextNode())) nodesToReplace.push(node);

    nodesToReplace.forEach(function(tn){
      var parts = tn.nodeValue.split(pattern);
      if (parts.length <= 1) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function(part){
        if (names.indexOf(part) >= 0) {
          var span = document.createElement('span');
          span.className = 'tm-pending-char';
          span.style.cssText = 'text-decoration:underline dotted;color:var(--amber-400);cursor:pointer;';
          span.title = '\u70B9\u51FB\u7EB3\u5165\u4EBA\u7269\u5FD7';
          span.textContent = part;
          span.addEventListener('click', function(e){
            e.stopPropagation();
            global._tmClickPendingChar(part);
          });
          frag.appendChild(span);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  }

  // 对外导出
  global.aiGenerateCompleteCharacter = aiGenerateCompleteCharacter;
  global.edictRecruitCharacter = edictRecruitCharacter;
  global.parseEdictRecruitPatterns = parseEdictRecruitPatterns;
  global.handleEdictTextForRecruit = handleEdictTextForRecruit;
  global.crystallizePendingCharacter = crystallizePendingCharacter;
  global.addPendingCharacter = addPendingCharacter;
  global.scanMentionedCharacters = scanMentionedCharacters;
  global.wrapPendingName = wrapPendingName;
  global.decoratePendingInDom = decoratePendingInDom;

})(typeof window !== 'undefined' ? window : this);
