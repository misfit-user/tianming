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

    if (!P.ai || !P.ai.key) {
      return _fallbackTemplate(name, opts);
    }

    var era = (P.dynasty || P.era || '');
    var year = GM.year || (P.time && P.time.year) || 1600;
    var reason = opts.reason || '\u63A8\u6F14\u6D8C\u73B0';
    var sourceContext = opts.sourceContext || '';

    var prompt = '\u4F60\u662F' + era + '\u5386\u53F2\u8003\u636E\u4E0E\u4EBA\u7269\u6863\u6848 AI\u3002\u4E3A\u4EE5\u4E0B\u4EBA\u7269\u751F\u6210\u5B8C\u6574\u4EBA\u7269\u5361\u3002\n\n' +
      '\u3010\u5F53\u524D\u65F6\u4EE3\u3011' + era + ' ' + year + ' \u5E74\n' +
      '\u3010\u59D3\u540D\u3011' + name + '\n' +
      '\u3010\u7EB3\u5165\u7F18\u7531\u3011' + reason + '\n' +
      (opts.age ? '\u3010\u5DF2\u77E5\u5E74\u9F84\u3011' + opts.age + '\n' : '') +
      (opts.party ? '\u3010\u5DF2\u77E5\u515A\u6D3E\u3011' + opts.party + '\n' : '') +
      (opts.assignPost ? '\u3010\u7686\u5C06\u88AB\u4EFB\u547D\u3011' + opts.assignPost + '\n' : '') +
      (sourceContext ? '\u3010\u6765\u6E90\u4E0A\u4E0B\u6587\u3011' + sourceContext.slice(0, 500) + '\n' : '') +
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
      '  "party": "' + (opts.party || '') + '",\n' +
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

        var newChar = {
          id: 'autogen_' + Date.now() + '_' + name,
          name: name,
          age: data.age || 30,
          gender: data.gender || '\u7537',
          ethnicity: data.ethnicity || '\u6C49',
          origin: data.origin || '',
          birthplace: data.birthplace || data.origin || '',
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
          // 资源
          resources: {
            fame: 20, virtue: 10, health: 80, stress: 0,
            privateWealth: { money: 0, grain: 0, cloth: 0 },
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

        // buildIndices 确保可索引
        if (typeof buildIndices === 'function') { try { buildIndices(); } catch(_){} }

        _dbg('[\u89D2\u8272\u81EA\u751F\u6210] \u5B8C\u6210\uFF1A' + name + '\u00B7' + (data.isHistorical ? '\u5386\u53F2\u4EBA\u7269' : '\u867A\u6784\u4EBA\u7269'));
        return newChar;
      } catch(e) {
        lastErr = e;
        console.warn('[\u89D2\u8272\u81EA\u751F\u6210] \u7B2C' + attempt + '\u6B21\u5931\u8D25', e.message || e);
        if (/\u53F2\u5B9E\u4E0D\u53EF\u73B0/.test(e.message || '')) throw e;  // 史实否决·不重试
      }
    }
    // 3 次失败·模板兜底
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
    if (typeof findCharByName === 'function' && findCharByName(name)) {
      if (typeof toast === 'function') toast(name + ' \u5DF2\u5728\u4EBA\u7269\u5FD7');
      return findCharByName(name);
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
      if (Array.isArray(aiResult.events)) aiResult.events.forEach(function(e){
        if (e && e.text) texts.push(e.text);
        if (e && e.title) texts.push(e.title);
      });
      if (Array.isArray(aiResult.npc_actions)) aiResult.npc_actions.forEach(function(a){
        if (a && a.desc) texts.push(a.desc);
        if (a && a.actor) texts.push(a.actor);
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

  // 判定候选是否疑似只是人名+尾部动词/助词：若截短后前缀（含姓）仍成立则返回截短版
  function _trimTrailing(cand) {
    if (!cand || cand.length <= 2) return cand;
    // 若末字是常见 trailing 动词/助词，尝试截短
    var last = cand.charAt(cand.length - 1);
    if (TRAIL_TRIM_CHARS.indexOf(last) >= 0) {
      return cand.slice(0, -1);
    }
    return cand;
  }

  function _extractNames(text) {
    if (!text) return [];
    var names = [];
    var nameSet = {};
    // 扫所有中文连续块·每块再分拆人名
    var re = /[\u4e00-\u9fa5]+/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var block = m[0];
      // 在 block 中逐位置尝试匹配人名
      for (var i = 0; i < block.length; i++) {
        if (COMMON_SURNAMES.indexOf(block.charAt(i)) < 0) continue;
        // 判定是否复姓开头：看两个字是否在 COMPOUND_SURNAMES
        var two = block.substr(i, 2);
        var isCompound = (i + 1 < block.length) && (COMPOUND_SURNAMES.indexOf(two) >= 0);
        // 候选长度：复姓 3-4 字，单姓 2-3 字（不贪 4）
        var maxLen = isCompound ? 4 : 3;
        var minLen = isCompound ? 3 : 2;
        var cand = null;
        // 从长到短取候选，用 _trimTrailing 清尾
        for (var len = maxLen; len >= minLen; len--) {
          if (i + len > block.length) continue;
          var raw = block.substr(i, len);
          var trimmed = _trimTrailing(raw);
          // trimmed 必须仍满足长度要求并以 surname 开头
          if (trimmed.length < minLen) continue;
          if (COMMON_SURNAMES.indexOf(trimmed.charAt(0)) < 0) continue;
          cand = trimmed;
          break;
        }
        if (!cand || cand.length < 2) continue;
        // 过滤：官职/虚词/称呼
        if (/[\u738B\u8D75\u674E\u5218]\u671D|[\u540E\u5FA1]|[\u4ED6\u6211\u4F60]/.test(cand)) continue;
        if (/^(\u7687\u5E1D|\u9661\u4E0B|\u6211\u5927|\u672C\u671D|\u671D\u5EF7|\u540E\u5BAB|\u592A\u76D1)$/.test(cand)) continue;
        // 已在 GM.chars → 跳过
        if (typeof findCharByName === 'function' && findCharByName(cand)) {
          // 跳过这一候选，但往前挪整段长度避免重复扫描同一 NPC
          i += cand.length - 1;
          continue;
        }
        if (!nameSet[cand]) {
          nameSet[cand] = true;
          names.push(cand);
        }
        // 已成功匹配到名字，跳过占用的字符
        i += cand.length - 1;
      }
    }
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

    var generated = [];
    var pendingAdded = [];
    var fullTexts = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult).slice(0, 2000);

    for (var i=0; i<candidates.length && i<20; i++) {  // 单回合最多 20 名候选
      var name = candidates[i];
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
