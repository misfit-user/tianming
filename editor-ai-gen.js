// ============================================================
// 剧本编辑器 — AI 生成功能 (AI Generation)
// 依赖: editor-core.js (scriptData, escHtml, autoSave, etc.)
// ============================================================
  function openGenericModal(title, bodyHTML, onSave) {
    document.getElementById(
      'genericModalTitle'
    ).textContent = title;
    document.getElementById(
      'genericModalBody'
    ).innerHTML = bodyHTML;
    document.getElementById(
      'genericModalSave'
    ).onclick = onSave;
    document.getElementById(
      'genericModal'
    ).classList.add('show');
  }

  function closeGenericModal() {
    document.getElementById(
      'genericModal'
    ).classList.remove('show');
  }

  function gv(id) {
    return document.getElementById(id).value.trim();
  }

  /**
   * 智能 AI 调用包装器 - 支持自动重试和内容不足时自动追加
   * @param {string} prompt - AI 提示词
   * @param {number} maxTokens - 最大 token 数
   * @param {object} options - 配置选项
   * @param {number} options.minItems - 期望的最小条目数（用于数组返回）
   * @param {number} options.maxRetries - 最大重试次数（默认 3）
   * @param {function} options.validator - 自定义验证函数，返回 {valid: boolean, reason: string}
   * @returns {Promise<string>} - AI 返回的内容
   */
  // 3.3: 生成后轻量检验——仅检查新生成内容与已有数据的一致性
  function _postGenValidate(target) {
    var warnings = [];
    if (target === 'characters' && scriptData.characters) {
      var facNames = (scriptData.factions||[]).map(function(f){return f.name;});
      scriptData.characters.forEach(function(c) {
        if (c.faction && facNames.length > 0 && facNames.indexOf(c.faction) < 0) {
          warnings.push(c.name + '\u7684\u52BF\u529B"' + c.faction + '"\u4E0D\u5728\u5DF2\u6709\u52BF\u529B\u5217\u8868\u4E2D');
        }
        // 重名检查
        var dupes = scriptData.characters.filter(function(c2){return c2.name===c.name;});
        if (dupes.length > 1 && warnings.indexOf(c.name+'\u91CD\u540D') < 0) warnings.push(c.name+'\u91CD\u540D');
      });
    }
    if (target === 'factions' && scriptData.factions) {
      var dupes = {};
      scriptData.factions.forEach(function(f) {
        if (dupes[f.name]) warnings.push('\u52BF\u529B"' + f.name + '"\u91CD\u590D');
        dupes[f.name] = true;
      });
    }
    if (warnings.length > 0) {
      setTimeout(function() {
        showToast('\u26A0 \u68C0\u6D4B\u5230' + warnings.length + '\u4E2A\u95EE\u9898: ' + warnings.slice(0,3).join('; '));
      }, 500);
    }
  }

  async function callAIEditorSmart(prompt, maxTokens, options) {
    options = options || {};
    var minItems = options.minItems || 0;
    var maxRetries = options.maxRetries || 3;
    var validator = options.validator;
    var allResults = [];
    var attemptCount = 0;

    async function attemptCall() {
      attemptCount++;
      var currentPrompt = prompt;

      // If we already have some results, tell AI to continue
      if (allResults.length > 0) {
        currentPrompt += '\n\n【已生成内容】\n' + JSON.stringify(allResults, null, 2).substring(0, 500) + '...\n\n';
        currentPrompt += '以上内容已生成，请继续生成更多内容（不要重复已有内容）。';
      }

      try {
        var result = await callAIEditor(currentPrompt, maxTokens);

        // Try to parse as JSON array
        if (minItems > 0) {
          try {
            var match = result.match(/\[\s*\{[\s\S]*\]/);
            var parsed = JSON.parse(match ? match[0] : result);
            if (Array.isArray(parsed)) {
              // Merge with existing results (avoid duplicates by name)
              parsed.forEach(function(item) {
                var isDuplicate = allResults.some(function(existing) {
                  return existing.name && item.name && existing.name === item.name;
                });
                if (!isDuplicate) {
                  allResults.push(item);
                }
              });

              // Check if we have enough items
              if (allResults.length >= minItems) {
                return JSON.stringify(allResults);
              } else if (attemptCount < maxRetries) {
                console.log('[AI Smart] 生成数量不足 (' + allResults.length + '/' + minItems + ')，继续调用 AI...');
                return await attemptCall();
              } else {
                console.warn('[AI Smart] 达到最大重试次数，返回已有结果 (' + allResults.length + '条)');
                return JSON.stringify(allResults);
              }
            }
          } catch(e) {
            // Not a valid JSON array, return as-is
            return result;
          }
        }

        // Custom validator
        if (validator) {
          var validation = validator(result);
          if (!validation.valid && attemptCount < maxRetries) {
            console.log('[AI Smart] 验证失败: ' + validation.reason + '，重试中...');
            return await attemptCall();
          }
        }

        return result;
      } catch(e) {
        if (attemptCount < maxRetries) {
          console.warn('[AI Smart] 调用失败，重试中... (' + attemptCount + '/' + maxRetries + ')');
          await new Promise(function(resolve) { setTimeout(resolve, 1000); }); // Wait 1s before retry
          return await attemptCall();
        } else {
          throw e;
        }
      }
    }

    return await attemptCall();
  }

  function openAIGenModal(target) {
    currentAIGenTarget = target;
    var names = {
      characters: '人物',
      factions: '势力',
      parties: '党派',
      classes: '阶层',
      items: '物品',
      military: '军事',
      techTree: '科技树',
      civicTree: '民政树',
      variables_base: '基础变量',
      variables_other: '其他变量',
      variables_formulas: '关联公式',
      rules: '规则',
      events: '事件',
      timeline: '时间线',
      map: '地图',
      worldSettings: '世界设定',
      government: '官制',
      adminHierarchy: '\u884C\u653F\u533A\u5212',
      playerOverview: '\u73A9\u5BB6\u52BF\u529B',
      relations: '\u5173\u7CFB',
      haremConfig: '\u540E\u5BAB\u4F4D\u4EFD'
    };
    document.getElementById(
      'aiGenModalTitle'
    ).textContent = 'AI 生成 · ' + names[target];
    document.getElementById('aiGenRef').value = '';
    document.getElementById('aiGenPrompt').value = '';

    // 如果是生成玩家势力，显示玩家指定字段
    var playerFields = document.getElementById('aiGenPlayerFields');
    if (playerFields) {
      if (target === 'playerOverview') {
        playerFields.style.display = 'block';
        document.getElementById('aiGenPlayerFaction').value = '';
        document.getElementById('aiGenPlayerCharacter').value = '';
      } else {
        playerFields.style.display = 'none';
      }
    }

    document.getElementById(
      'aiGenModal'
    ).classList.add('show');
  }

  function closeAIGenModal() {
    document.getElementById(
      'aiGenModal'
    ).classList.remove('show');
  }

  function doAIGenerate() {
    var ref = document.getElementById('aiGenRef').value.trim();
    var extra = document.getElementById('aiGenPrompt').value.trim();
    var target = currentAIGenTarget;
    var names = {
      characters: '人物', factions: '势力', parties: '党派',
      classes: '阶层', items: '物品', military: '军事',
      techTree: '科技树', civicTree: '民政树',
      variables_base: '基础变量', variables_other: '其他变量', variables_formulas: '关联公式',
      rules: '规则', events: '事件', timeline: '时间线',
      map: '\u5730\u56FE', worldSettings: '\u4E16\u754C\u8BBE\u5B9A', government: '\u5B98\u5236',
      externalForces: '\u5916\u90E8\u52BF\u529B', relations: '\u5173\u7CFB', haremConfig: '\u540E\u5BAB\u4F4D\u4EFD',
      adminHierarchy: '行政区划'
    };
    var label = names[target] || target;
    var _aiDate = (document.getElementById('aiGenDate') && document.getElementById('aiGenDate').value.trim()) ? document.getElementById('aiGenDate').value.trim() : '';
    var _eraDisp = _computeEraDisplay(scriptData.gameSettings, parseInt(_aiDate) || (scriptData.gameSettings && scriptData.gameSettings.startYear) || 1);
    // 构建完整上下文，包含eraState以适配不同朝代体制
    var _es = scriptData.eraState || {};
    var eraCtx = '';
    if (_es.landSystemType) eraCtx += ' 制度:' + _es.landSystemType;
    if (_es.legitimacySource) eraCtx += ' 正统来源:' + _es.legitimacySource;
    if (_es.dynastyPhase) eraCtx += ' 阶段:' + _es.dynastyPhase;
    if (_es.centralControl) eraCtx += ' 集权度:' + Math.round((_es.centralControl||0.5)*100) + '%';
    var ctx = '副本名称:' + scriptData.name
      + ' 朝代:' + scriptData.dynasty
      + ' 皇帝:' + scriptData.emperor
      + (_aiDate ? ' 当前日期:' + _aiDate : '')
      + (_eraDisp ? ' 年号:' + _eraDisp : '')
      + eraCtx;
    // Build target-specific prompt
    var schemaHint = '';
    if (target === 'characters') {
      var _playerName = (scriptData.playerInfo && scriptData.playerInfo.characterName) || scriptData.emperor || '';
      schemaHint = '每个人物必须包含以下全部字段：\n'
        + '- name(姓名), title(官职/封号), type("historical"或"fictional"), role(角色定位如"文臣""武将""谋士""后妃")\n'
        + '- faction(所属势力), party(党派或"无党派"), partyRank(党内地位如"核心""骨干""外围")\n'
        + '- officialTitle(具体官职名如"兵部侍郎""左金吾卫大将军")\n'
        + '- age(具体数字), gender(男/女), ethnicity(民族), birthplace(籍贯), occupation(身份如"文臣""武将""宦官""僧侣")\n'
        + '- stance(政治立场如"保守""改革""中立""投机")\n'
        + '- faith(信仰), culture(文化), learning(学识专长如"经学""兵法""天文""医术")\n'
        + '- appearance(\u5916\u8C8C\u63CF\u5199,50-80\u5B57\u3002\u8981\u6C42\uFF1A\u2460\u53F2\u5B9E\u4EBA\u7269\u5148\u67E5\u627E\u53F2\u6599\u5BF9\u5176\u5BB9\u8C8C\u7684\u8BB0\u8F7D\u539F\u6587\u4F5C\u4E3A\u57FA\u7840 \u2461\u7ED3\u5408\u5176\u5728\u5267\u672C\u5F00\u59CB\u5E74\u4EFD\u65F6\u7684\u5B9E\u9645\u5E74\u9F84 \u2462\u5305\u542B\u9762\u90E8\u7279\u5F81/\u4F53\u578B/\u6C14\u8D28/\u670D\u9970\uFF08\u670D\u9970\u5FC5\u987B\u7B26\u5408' + (scriptData.dynasty||'') + '\u671D\u4EE3\u6C49\u670D\u5F62\u5236\uFF09)\n'
        + '- personality(性格关键词,如"刚毅果断、忠心耿耿、喜怒不形于色")\n'
        + '- personalGoal(个人目标,20字,如"匡扶社稷""独揽朝纲""建功立业")\n'
        + '- bio(人物简介,100-150字。史实人物必须引用史料来源)\n'
        + '- family(郡望家族), familyStatus:{门第:"imperial/noble/scholar/commoner/peasant/outcast",郡望:"陇西李氏",声望:0-100}\n'
        + '- father(父亲角色名,可选), mother(母亲角色名,可选), spouse(配偶角色名,可选)\n'
        + '- traits:["brave","diligent"] 数组——史实人物按史料记载配对应特质(如诸葛亮:[diligent,just,humble,cynical]；岳飞:[brave,just,honest,zealous]；曹操:[ambitious,deceitful,paranoid,calm]；司马懿:[patient,deceitful,paranoid,ambitious])；虚构人物随机选3-5个不冲突特质。可选特质ID：\n'
        + '  个性: brave/craven, calm/wrathful, chaste/lustful, content/ambitious, diligent/lazy, honest/deceitful, humble/arrogant, just/arbitrary, patient/impatient, temperate/gluttonous, trusting/paranoid, zealous/cynical, forgiving/vengeful, generous/greedy, gregarious/shy, stubborn/fickle, eccentric, compassionate/callous/sadistic\n'
        + '  教育: edu_diplomacy_4/edu_intrigue_4/edu_stewardship_4/edu_martial_4/edu_learning_4 (只选一个)\n'
        + '  将领(武将才可选1-2): logistician/military_engineer/aggressive_attacker/unyielding_defender/flexible_leader/reaver/reckless/cautious_leader/organizer/holy_warrior\n'
        + '  生活方式: strategist/schemer/scholar/theologian/hunter_3/blademaster_3/seducer/torturer/avaricious/architect/administrator_ls 等\n'
        + '  禁忌：对立特质不得同时出现(如brave+craven、honest+deceitful不可共存)\n'
        + '- wuchangOverride:{仁:0-100,义:0-100,礼:0-100,智:0-100,信:0-100} (历史名人的五常手动定位)\n'
        + '- location(当前所在地——京官留空或填京城,地方官填任职地,武将填驻地)\n'
        + '- 【十维能力,每人不同】 loyalty(忠0-100), ambition(野0-100), benevolence(仁0-100), intelligence(智0-100), valor(武勇0-100,个人武力/胆识), military(军事0-100,统兵/战略指挥), administration(治政0-100,治国理政/政令推行), management(管理0-100,理财/税务/开源节流——区别于administration的政治治理), charisma(魅力0-100), diplomacy(外交0-100,邦交谈判)\n'
        + '- valor=个人武力(吕布99),military=统兵能力(诸葛亮95但valor低)。administration=治理,management=理财(桑弘羊95,王安石92,张居正98 都擅理财)\n'
        + '\n【十维能力数值生成规则——必须严格遵守】\n'
        + '═════════ A. 史实人物（type="historical"）的数值参照 ═════════\n'
        + '须查正史记载定位，分四档：顶级(92-98)/优秀(80-91)/中等(60-79)/平庸(40-59)/拙劣(<40)\n'
        + '\n【武勇 valor】个人武力/胆识（独当一面）\n'
        + '  ≥95 顶级：吕布98、项羽98、霍去病96、李存孝95、常遇春95、冉闵95\n'
        + '  85-94：关羽92、张飞90、赵云90、薛仁贵90、尉迟恭88、徐达85\n'
        + '  70-84：李靖80、郭子仪78、戚继光75、李世民72（武勇/统兵平衡）\n'
        + '  45-69：文臣领兵如裴度55、范仲淹50、韩琦50\n'
        + '  <40：纯文臣如诸葛亮25、司马懿30、王安石20、张居正25\n'
        + '\n【军事 military】统兵/战略（与 valor 可分）\n'
        + '  ≥95：孙武98、吴起97、白起97、韩信97、李靖96、卫青95、岳飞95、徐达95、王守仁94、戚继光92\n'
        + '  85-94：诸葛亮90（统兵强但战役胜少）、司马懿92、周瑜90、陆逊88、李世民95（帝王之军）\n'
        + '  70-84：郭子仪82、李光弼80、曹操85（也算军事家）\n'
        + '  45-69：张良65（谋略非统兵）、苏秦张仪55\n'
        + '  <40：纯文臣不涉军\n'
        + '\n【治政 administration】政令推行/行政治理\n'
        + '  ≥95：萧何98、诸葛亮95、王猛95、房玄龄94、魏征90、张居正95\n'
        + '  85-94：长孙无忌88、姚崇92、张说85、司马光90、王安石88、范仲淹90\n'
        + '  70-84：狄仁杰88、寇准80、欧阳修78\n'
        + '  45-69：文学之士如李白50、杜甫60\n'
        + '\n【管理 management】理财/税务/开源节流（区别于 administration）\n'
        + '  ≥95：桑弘羊98、刘晏95、王安石92、张居正98、耶律楚材90\n'
        + '  85-94：管仲95（春秋先贤）、杨炎85、刘瑾/严嵩（善敛财但臭名）\n'
        + '  70-84：范仲淹70（文人对理财只通大略）\n'
        + '  <60：纯学者型不擅此\n'
        + '\n【智 intelligence】谋略/智谋\n'
        + '  ≥95：张良98、诸葛亮97、贾诩96、司马懿95、刘基95、陈平95\n'
        + '  85-94：郭嘉92、荀彧90、鲁肃88、姚广孝90\n'
        + '  70-84：多数名臣\n'
        + '\n【魅力 charisma】人格感染力/号召力\n'
        + '  ≥95：刘备96、李世民95、曹操92（争议）、朱元璋90\n'
        + '  85-94：诸葛亮90、关羽88、岳飞92、周瑜88\n'
        + '  史实美人/名妓：杨贵妃98、王昭君95、西施95、貂蝉90、董小宛92、李师师88、赵飞燕95\n'
        + '  70-84：名士如李白85、苏轼88\n'
        + '\n【外交 diplomacy】邦交谈判\n'
        + '  ≥95：苏秦98、张仪97、郑和95（航海/怀柔）、班超94（西域）、张骞92\n'
        + '  85-94：诸葛亮85（联吴抗曹）、鲁肃88、寇准85（澶渊之盟）\n'
        + '  <70：内政型文臣\n'
        + '\n【忠 loyalty】对君主忠诚（历史评价）\n'
        + '  95-100：诸葛亮100、魏征98、岳飞99、史可法98、文天祥100、于谦98、海瑞95\n'
        + '  80-94：多数正统名臣\n'
        + '  50-79：有疑心/投机心但未叛；如徐阶、严嵩（复杂）\n'
        + '  20-49：权臣野心或首鼠两端；霍光40、董卓30、李林甫40\n'
        + '  <20：叛臣；吕布15、司马懿20（终身演忠直至夺权）、曹操30（挟天子）\n'
        + '\n【野心 ambition】进取欲（与 loyalty 常反相关但不绝对）\n'
        + '  ≥90：曹操95、司马懿95、刘裕90、朱温92、王莽98、武则天98、安禄山90\n'
        + '  70-89：权臣霍光75、鳌拜85、多尔衮85、年羹尧80\n'
        + '  40-69：多数士大夫\n'
        + '  <30：陶渊明15、谢安30（东山再起前）\n'
        + '\n【仁 benevolence】对民悲悯\n'
        + '  ≥95：文天祥98、包拯95、范仲淹95、于谦95、海瑞95\n'
        + '  85-94：诸葛亮92、岳飞92、韩愈88\n'
        + '  40-69：中性\n'
        + '  <30：董卓10、朱温15、张献忠15、石敬瑭30\n'
        + '\n═════════ B. 非史实人物（type="fictional"/AI 虚构 type）的数值生成 ═════════\n'
        + '【原型分布法】按 role 选 archetype，围绕基准值 ±15 波动：\n'
        + '  文臣 civic：智/政/管理 70±10，武勇/军事 30±15，仁 55±15\n'
        + '  武将 martial：武勇/军事 75±10，智 50±15，政 40±15，魅 55±15\n'
        + '  谋士 tactician：智 80±8，政 55±15，武勇 35±20，外交 60±15\n'
        + '  外交使 diplomat：外交 78±8，智 70±10，魅 65±15\n'
        + '  宦官 eunuch：智 60±15，管理 50±15，武勇 25±15，仁 35±20，野心 70±15\n'
        + '  后妃 consort：魅 75±15（若明载美貌则 90+），智 50±20，仁 55±20\n'
        + '  僧道 religious：智 60±15，魅 55±15，仁 65±20\n'
        + '  商贾 merchant：管理 70±10，外交 55±15，政 40±15\n'
        + '【品级-能力关系——关键！不得强绑定】\n'
        + '  ★ 品级与能力不是正相关——史上最具戏剧张力的恰是「能力与品级错位」！\n'
        + '  下面 6 种历史典型场景 AI 必须主动识别并生成（任一类型都合情）：\n'
        + '  1) 潜龙未用：身怀大才但尚未显达。诸葛亮南阳隐居时 adm95 mil95 int97 但无官；韩信治粟都尉时 mil97；范蠡陶朱之前\n'
        + '  2) 贬谪名臣：曾任高位因党争/直谏被贬。苏轼儋州时仍 int95 cha90 adm85；王安石罢相江宁 adm88；范仲淹多次贬官 adm92 ben95\n'
        + '  3) 寒门新进：刚中进士任八九品。欧阳修、王安石、范仲淹进身时已显潜质 int80+ adm70+\n'
        + '  4) 恩荫庸才：公卿子弟一步登天。严世蕃尚书 adm50 int60 mng75（狡黠）；和珅之子丰绅殷德一品驸马 adm40；王敦之侄被荫 mil30\n'
        + '  5) 外戚/宦官权重而才陋：贾南风 int30 amb90；魏忠贤一品 int40 mng55 amb95；汪直司礼监 adm35 int50；安禄山藩镇之主 val75 mil70 但 loyalty5\n'
        + '  6) 隐士避世：能力高但辞官。陶渊明彭泽令挂冠 int80 ben85；范蠡功成身退；谢安东山未出前\n'
        + '  \n'
        + '  【正确原则】能力由"本人禀赋+后天学识+历练"决定，品级由"出身+机遇+党争+君主识人"决定。\n'
        + '  AI 应在 bio 中具体说明此人当前品级与能力的关系——是"韬光养晦""遇明君未得"还是"恩荫坐致"。\n'
        + '  这种"能力-品级差"会在游戏中驱动：荐贤/贬谪/抱屈/越级提拔 等叙事。\n'
        + '【年龄-数值曲线】\n'
        + '  <20：各能力-15~-5（尚未成熟）；loyalty 易激变；ambition 随性格\n'
        + '  20-35：接近本值；武勇/魅力巅峰\n'
        + '  36-55：政/军/管理巅峰；武勇开始下滑\n'
        + '  >55：政/智保持；武勇-10~-20；需要 traits 有 calm/cynical 才合理\n'
        + '\n═════════ C. 五常（wuchangOverride）定位规则 ═════════\n'
        + '五常 = {仁,义,礼,智,信}，0-100。史实人物必须定位；虚构人物由系统按 traits 自动推算。\n'
        + '【史实定位参考】\n'
        + '  诸葛亮：仁85·义95·礼90·智100·信100\n'
        + '  岳飞：  仁90·义100·礼80·智75·信95\n'
        + '  关羽：  仁70·义100·礼80·智70·信95\n'
        + '  包拯：  仁95·义90·礼85·智80·信100\n'
        + '  海瑞：  仁95·义95·礼98·智65·信100\n'
        + '  文天祥：仁95·义100·礼90·智75·信100\n'
        + '  司马懿：仁40·义30·礼85·智98·信30\n'
        + '  曹操：  仁30·义40·礼60·智95·信50\n'
        + '  董卓：  仁10·义15·礼20·智40·信25\n'
        + '  武则天：仁30·义50·礼70·智95·信60\n'
        + '  张居正：仁70·义85·礼75·智95·信85\n'
        + '  王莽：  仁40·义30·礼90·智75·信20\n'
        + '  魏征：  仁80·义95·礼90·智88·信100\n'
        + '  李白：  仁80·义85·礼50·智88·信80\n'
        + '【特质-五常约束】\n'
        + '  wuchang.仁 与 trait "compassionate" 正相关；与 "callous/sadistic" 负相关\n'
        + '  wuchang.义 与 trait "just/honest/zealous" 正相关；与 "deceitful/arbitrary" 负相关\n'
        + '  wuchang.礼 与 trait "humble/temperate" 正相关；与 "arrogant/gluttonous" 负相关\n'
        + '  wuchang.智 与 intelligence 应接近（±10 内）\n'
        + '  wuchang.信 与 trait "honest/just" 正相关；与 "deceitful" 负相关\n'
        + '\n═════════ D. 关键对照示例（每个必做不同） ═════════\n'
        + '  李靖→valor:92,military:95,administration:70,intelligence:85\n'
        + '  诸葛亮→military:95,valor:25,administration:95,intelligence:97,management:75\n'
        + '  魏征→loyalty:95,administration:88,intelligence:80,valor:30,benevolence:80\n'
        + '  杨贵妃→charisma:98,intelligence:65,benevolence:55,ambition:45\n'
        + '  张居正→administration:95,management:98,intelligence:90,loyalty:70,ambition:80\n'
        + '  王安石→administration:88,management:92,intelligence:90,valor:20,loyalty:85\n'
        + '  桑弘羊→management:98,administration:75,intelligence:90,valor:15\n'
        + '  霍去病→valor:96,military:93,charisma:80,ambition:55\n'
        + '  朱元璋→valor:75,military:90,administration:85,ambition:95,charisma:90,benevolence:50\n'
        + '\n【每个人的数值必须不同！】严禁批量生成时多人能力值雷同（如 3 人都 military=80 administration=70）——名人必按史料、虚构按档内随机差异化\n'
        + '- initialRelations:[{to:"另一角色名",labels:["同年","门生","政敌"],affinity:70,trust:60,respect:80,hostility:0,conflictLevel:0}] —— 可选，史实人物应预设明确关系（如诸葛亮与刘备=[君臣·恩遇,affinity:95,trust:95,respect:90]；曹操与刘备=[政敌,affinity:20,trust:10,hostility:60,conflictLevel:2]；苏轼与王安石=[政敌但相重,affinity:30,respect:75,conflictLevel:2]）\n'
        + '- \u540D\u5983\u7684charisma\u5E94\u663E\u8457\u9AD8(\u5386\u53F2\u7F8E\u4EBA\u219285-98)\u3002\u6BCF\u4E2A\u4EBA\u7684\u6570\u503C\u5FC5\u987B\u5404\u4E0D\u76F8\u540C\uFF01\n'
        + '- spouse(boolean), spouseRank(\u82E5true\u5219\u586Bempress/consort\u7B49), motherClan(\u5973\u6027\u586B\u6BCD\u65CF)\n'
        + '\u3010\u53F2\u5B9E\u4EBA\u7269\u89C4\u5219\u3011\n'
        + '- type\u5B57\u6BB5\uFF1A\u51E1\u5728\u4E8C\u5341\u56DB\u53F2\u3001\u300A\u8D44\u6CBB\u901A\u9274\u300B\u7B49\u6B63\u53F2\u4E2D\u6709\u8BB0\u8F7D\u7684\u4EBA\u7269\uFF0Ctype\u5FC5\u987B\u4E3A"historical"\u3002\u53EA\u6709\u5B8C\u5168\u865A\u6784\u7684\u624D\u5199"fictional"\u3002\n'
        + '- bio\u4E2D\u5FC5\u987B\u6CE8\u660E\u53F2\u6599\u6765\u6E90\uFF0C\u5982"\u636E\u300A\u65E7\u5510\u4E66\u00B7\u674E\u9756\u4F20\u300B\u8BB0\u8F7D\uFF0C\u9756\u201C\u5E7C\u800C\u805A\u6562\uFF0C\u597D\u4FA0\u4EFB\u6C14\u201D\u2026"\n'
        + '- \u5E94\u5305\u542B1-3\u540D\u540E\u5BAB\u5983\u5ABE(spouse=true,\u6709\u5177\u4F53\u6BCD\u65CF)\n'
        + (_playerName ? '\u3010\u7981\u6B62\u3011\u4E0D\u5F97\u751F\u6210\u73A9\u5BB6\u89D2\u8272\u201C' + _playerName + '\u201D\u3002' : '');
    }
    else if (target === 'factions') schemaHint = '每个势力必须包含以下全部字段：\n'
      + '- name(势力名称), type(主权国/藩镇/番属小国/名义从属/游牧政权)\n'
      + '- leader(领袖姓名), leaderTitle(领袖头衔如"节度使""可汗""国王")\n'
      + '- territory(占据地盘,具体地名), goal(战略目标,20字)\n'
      + '- strength(综合实力1-100,每个势力必须不同), militaryStrength(兵力数字,如50000)\n'
      + '- attitude(对玩家势力态度:友好/中立/敌对/附属/宗主/名义从属/朝贡)\n'
      + '- resources(主要资源,如"铁矿、战马"), mainstream(主体民族/信仰), culture(文化特征)\n'
      + '- color(势力代表色,CSS颜色值如"#8B0000""#2E8B57")\n'
      + '- description(势力详细描述,100-150字,包含历史背景、政治特点、与玩家的关系)\n'
      + '- leaderInfo:{name:"",age:数字,gender:"男/女",personality:"性格关键词",belief:"信仰",learning:"专长",ethnicity:"民族",bio:"首脑简介80字"}\n'
      + '- heirInfo:{name:"继承人名",age:数字,gender:"",personality:"",belief:"",learning:"",ethnicity:"",bio:"继承人简介50字"} (无继承人可设为null)\n'
      + '【深化必填字段】\n'
      + '- cohesion:{political,military,economic,cultural,ethnic,loyalty} 六维凝聚力(0-100，按该朝代实际)\n'
      + '- militaryBreakdown:{standingArmy,militia,elite,fleet} 军事结构(按兵制真实分解)\n'
      + '- economicStructure:{agriculture,trade,handicraft,tribute} 经济结构百分比(合计~100)\n'
      + '- succession:{rule(primogeniture/seniorityBrother/electiveClan/abdication/strongest),designatedHeir,stability(0-100)} 继承配置\n'
      + '- historicalEvents:[{turn:负数回溯,event,impact}] 势力大事(起始前2-3件)\n'
      + '- internalParties:[...] 该势力内部党派名列表(可空)\n'
      + '\n【势力数值生成规则——按朝代阶段+政权类型】\n'
      + '═════════ A. 史实势力数值参照 ═════════\n'
      + '【综合实力 strength】\n'
      + '  盛世中朝(玄宗天宝/康乾盛世)：strength 85-95\n'
      + '  中兴之朝(光武/贞观/宣和/顺治)：strength 75-85\n'
      + '  守成之朝(仁宗/嘉靖前期)：strength 60-75\n'
      + '  衰世之朝(桓灵/崇祯)：strength 35-55\n'
      + '  亡国之朝：strength 15-35\n'
      + '  藩镇割据：strength 25-55（如河北三镇各 30-40）\n'
      + '  游牧政权盛期(匈奴冒顿/契丹辽圣宗/蒙元)：strength 70-90\n'
      + '  番属小国：strength 15-35\n'
      + '  农民起义初期：strength 10-25\n'
      + '\n【militaryStrength 兵力——按朝代兵制】\n'
      + '  汉盛期：40-60 万（京师南北军 + 郡国兵）\n'
      + '  唐盛期：60 万（府兵改募兵后 70+）\n'
      + '  宋：禁军 80-120 万（兵多冗）\n'
      + '  元：蒙古军+色目军+汉军 40-60 万\n'
      + '  明：卫所兵号 200 万但实有 80-100 万\n'
      + '  清八旗+绿营：65-80 万\n'
      + '  游牧政权：精骑 10-30 万（匈奴 30、契丹 20、女真 15）\n'
      + '  藩镇单镇：2-8 万\n'
      + '\n【六维凝聚力——按朝代阶段映射】\n'
      + '  founding 开国期：政 75 军 85 经 50 文 55 族 70 忠 80\n'
      + '  peak 盛世：   政 85 军 80 经 85 文 85 族 80 忠 85\n'
      + '  stable 守成：  政 70 军 65 经 70 文 75 族 70 忠 70\n'
      + '  declining 衰世：政 50 军 50 经 50 文 60 族 60 忠 55\n'
      + '  crisis 危局：  政 35 军 40 经 35 文 50 族 50 忠 40\n'
      + '  collapse 崩溃：政 20 军 25 经 20 文 40 族 40 忠 25\n'
      + '  藩镇割据：    政 25 军 70 经 55 文 65 族 70 忠 30（高军事低政治忠诚）\n'
      + '  游牧骑射：    政 40 军 85 经 40 文 50 族 90 忠 75（族超高）\n'
      + '  起义军：      政 30 军 60 经 20 文 45（若宗教 75）族 60 忠 80\n'
      + '  宗教政权：    政 45 军 50 经 35 文 90 族 70 忠 90（文化族认同极高）\n'
      + '\n【militaryBreakdown 按兵制分解】\n'
      + '  秦汉征兵制：standingArmy:30% militia:65% elite:5% fleet:<1%（如屯田兵）\n'
      + '  唐府兵制：standingArmy:15% militia:70%（府兵自耕自训）elite:10%（牙军）fleet:5%\n'
      + '  唐后期募兵：standingArmy:60% militia:20% elite:15% fleet:5%\n'
      + '  宋禁军：standingArmy:80%（禁军职业化）militia:10% elite:8%（班直亲军）fleet:2-5%\n'
      + '  元军：standingArmy:50%（蒙古色目核心）militia:40%（汉军）elite:10%（怯薛）fleet:<1%\n'
      + '  明卫所：standingArmy:15%（京营）militia:75%（卫所屯军）elite:8%（京营三大营）fleet:2%（郑和后衰）\n'
      + '  清八旗：standingArmy:30%（八旗） militia:60%（绿营）elite:10%（健锐/虎枪）fleet:<1%\n'
      + '  游牧：standingArmy:30%（常备怯薛）militia:65%（全民皆兵）elite:5% fleet:0\n'
      + '\n【economicStructure 按朝代特色】\n'
      + '  春秋战国：agri 75 trade 10 handi 10 tribute 5\n'
      + '  秦汉：agri 80 trade 10 handi 8 tribute 2\n'
      + '  唐盛期：agri 65 trade 20（丝绸之路）handi 12 tribute 3\n'
      + '  宋：agri 55 trade 30（海贸发达）handi 13 tribute 2\n'
      + '  明中期：agri 65 trade 20（倭患后降）handi 13 tribute 2\n'
      + '  清康乾：agri 70 trade 18 handi 10 tribute 2\n'
      + '  游牧政权：agri 25 trade 40（依赖互市）handi 10 tribute 25\n'
      + '\n【继承稳定性 succession.stability】\n'
      + '  嫡长制稳定(宋、明)：stability 70-85\n'
      + '  兄终弟及(辽、元)：stability 40-60（争位频繁）\n'
      + '  推举制(蒙元前期)：stability 35-55\n'
      + '  禅让(尧舜/曹丕)：stability 30-50\n'
      + '  以强为尊(五代)：stability 15-35\n'
      + '  有明确储君 + 嫡长制 + 稳定朝：+10\n'
      + '  无储君 / 朝政混乱：-15\n'
      + '\n═════════ B. 非史实/虚构势力的数值生成 ═════════\n'
      + '  新建割据势力：strength 20-40，兵力 5000-50000，六维凝聚 政40军60经30文50族60忠50\n'
      + '  叛乱起义军：strength 10-30，兵力 2000-30000，六维 政25军55经15文40族55忠70\n'
      + '  新兴番属：strength 25-45，兵力 10000-80000，六维 政55军65经40文55族75忠65\n'
      + '  商贸城邦：strength 30-55，兵力 1000-8000，六维 政60军40经85文60族55忠55\n'
      + '  宗教政权：strength 35-60，兵力 5000-40000，六维 政50军55经30文95族70忠90\n'
      + '\n【禁止】不得生成玩家势力(' + (scriptData.dynasty || '') + '朝廷)、党派、阶层、商会、宗教组织。';
    else if (target === 'parties') schemaHint = '每个党派必须包含：\n'
      + '- name、ideology(立场)、leader、influence(0-100数字)、members、base、status(活跃/式微/被压制/已解散)、org、shortGoal、longGoal、description(100字)\n'
      + '- currentAgenda、rivalParty、policyStance(数组)\n'
      + '【深化必填字段】\n'
      + '- cohesion(0-100党内凝聚力)\n'
      + '- memberCount(党徒估数)\n'
      + '- crossFaction(是否跨势力，如主和派同时存在于敌对双方时为true)\n'
      + '- splinterFrom/mergedWith(族谱，可空)\n'
      + '- socialBase:[{class:"阶层名",affinity:-1~1}] 社会基础——必须从已有阶层中选，affinity为正则阶层支持该党\n'
      + '- agenda_history:[{turn:负数回溯,agenda,outcome}] 议程演进史(起始前2-3件)\n'
      + '- focal_disputes:[{topic,rival,stakes}] 当前斗争焦点\n'
      + '- officePositions:[...] 党派掌控的官职名列表(与已生成官制呼应)\n'
      + '\n【党派数值生成规则】\n'
      + '═════════ A. 史实党派参照 ═════════\n'
      + '【影响力 influence 分布——须各党总和反映政治格局】\n'
      + '  主导党派(当权)：influence 65-85\n'
      + '  次席对立党：influence 40-60（能有效制衡）\n'
      + '  边缘党派：influence 15-35\n'
      + '  残存党派：influence 5-15\n'
      + '  新崛起：影响力起步低 20-35，议程激进\n'
      + '【具体史实参照】\n'
      + '  北宋新党(王安石)vs 旧党(司马光)：新党鼎盛 influence 75，旧党 60；神宗后易位\n'
      + '  南宋主战派vs 主和派：主战派 influence 35-50（多受压制），主和派 60-75\n'
      + '  唐中期牛党 influence 50-70 vs 李党 60-75（轮流掌权）\n'
      + '  明东林党初期 influence 45，天启受阉党(影响力 75)压制降到 20\n'
      + '  汉党锢之祸士党 influence 从 60 降到 10\n'
      + '\n【凝聚力 cohesion 分布】\n'
      + '  以义理凝聚(东林/理学党)：cohesion 80-95（信念强）\n'
      + '  以利益凝聚(阉党/外戚)：cohesion 50-70（利散则散）\n'
      + '  以师承凝聚(牛李/洛蜀党)：cohesion 65-80\n'
      + '  地域党(南党/北党)：cohesion 70-85\n'
      + '  分裂在即党：cohesion <40（下回合可能 party_splinter）\n'
      + '\n【memberCount 党徒估数】\n'
      + '  核心朋党(宋代新党)：30-60 人\n'
      + '  大党(东林)：100-300 人\n'
      + '  松散派系(清流/浊流)：50-150 人\n'
      + '  小党派：10-30 人\n'
      + '\n【socialBase 社会基础 affinity】\n'
      + '  正相关(社会基础)：affinity 0.6-0.9\n'
      + '  中性：0.1-0.3\n'
      + '  负相关(对立阶层)：-0.4 ~ -0.8\n'
      + '  史例：东林党 vs 士绅 0.8 / 商人 0.7 / 宦官 -0.9；新党 vs 寒门 0.7 / 士绅 -0.5\n'
      + '\n═════════ B. 虚构党派数值 ═════════\n'
      + '  主导党：influence 70±10，cohesion 60±10，memberCount 50-150\n'
      + '  对立党：influence 50±10，cohesion 65±10，memberCount 40-100\n'
      + '  新起党：influence 25±10，cohesion 75±10（起步凝聚力高），memberCount 15-40\n'
      + '  衰微党：influence 15±10，cohesion 40±15\n'
      + '【约束】影响力、凝聚力、党徒数必须互相匹配：影响力 80 但党徒 5 人不合理；cohesion 高的党一般 influence 稳定\n'
      + '【每党数值必须不同——不得雷同】';
    else if (target === 'classes') schemaHint = '每个阶层必须包含：\n'
      + '- name、mobility(低/中/高)、size、privileges、obligations、status、satisfaction(0-100数字)、influence(0-100数字)、description(80字)\n'
      + '- economicRole、unrestThreshold、demands\n'
      + '【深化必填字段】\n'
      + '- representativeNpcs:[...] 从已生成角色中挑选的代表人物(按 title/description 匹配)\n'
      + '- leaders:[...] 阶层领袖(可多人，含地域代表)\n'
      + '- supportingParties:[...] 该阶层倾向支持的党派(与 party.socialBase 对称)\n'
      + '- regionalVariants:[{region,satisfaction,distinguishing}] 地域分化(按剧本地图，2-4 个变体)\n'
      + '- internalFaction:[{name,size,stance}] 内部分化(如士绅→南党/北党；商人→官商/民商)\n'
      + '- unrestLevels:{grievance,petition,strike,revolt} 分级不满(0-100，越低越不满，初始接近满意度)\n'
      + '- economicIndicators:{wealth,taxBurden,landHolding} 经济指标(0-100)\n'
      + '\n【阶层数值生成规则】\n'
      + '═════════ A. 各阶层数值基线（按社会金字塔） ═════════\n'
      + '【影响力 influence——按社会地位递减】\n'
      + '  皇族/宗室：influence 85-95（政治特权）\n'
      + '  士绅/士族：influence 70-85\n'
      + '  军功勋贵：influence 65-80\n'
      + '  文官士大夫：influence 65-80\n'
      + '  武将集团：influence 55-75\n'
      + '  商贾：influence 30-55（传统社会压制，宋代可 55-70）\n'
      + '  农民：influence 15-30（人数多但分散）\n'
      + '  手工业者：influence 15-25\n'
      + '  贱籍/奴仆：influence 5-15\n'
      + '  外戚/宦官：influence 随朝代波动 30-85\n'
      + '\n【满意度 satisfaction——按朝代阶段调整】\n'
      + '  开国founding：农民 75、士绅 60、商人 55（新秩序红利）\n'
      + '  盛世peak：农民 65、士绅 80、商人 75（普遍满足）\n'
      + '  守成stable：农民 55、士绅 75、商人 65\n'
      + '  衰世declining：农民 35、士绅 50、商人 40\n'
      + '  危局crisis：农民 20、士绅 35、商人 25\n'
      + '  崩溃collapse：农民 10、士绅 20、商人 15\n'
      + '\n【经济指标 economicIndicators 分层】\n'
      + '  皇族：wealth 95, taxBurden 5, landHolding 80\n'
      + '  士绅：wealth 80, taxBurden 15（免税田多）, landHolding 70\n'
      + '  勋贵：wealth 75, taxBurden 10, landHolding 60\n'
      + '  商贾：wealth 70, taxBurden 40（商税重）, landHolding 20\n'
      + '  自耕农：wealth 35, taxBurden 75（赋役最重）, landHolding 40\n'
      + '  佃农：wealth 15, taxBurden 65, landHolding 5\n'
      + '  手工业：wealth 35, taxBurden 50, landHolding 10\n'
      + '  贱籍：wealth 10, taxBurden 30, landHolding 0\n'
      + '  宦官：wealth 85（官宦结帮）, taxBurden 0, landHolding 40\n'
      + '\n【unrestLevels 分级不满（值越低越不满）】\n'
      + '  高满意阶层(85+)：grievance 80, petition 85, strike 90, revolt 95\n'
      + '  中等满意(50-75)：grievance 60, petition 75, strike 85, revolt 90\n'
      + '  衰世受压(30-50)：grievance 40, petition 55, strike 70, revolt 80\n'
      + '  危局怨愤(15-30)：grievance 25, petition 40, strike 55, revolt 60\n'
      + '  临起义(<15)：grievance 10, petition 20, strike 30, revolt 15\n'
      + '  ※ revolt < 10 即自动触发起义；5 级依次递减（grievance 最低、revolt 最难突破）\n'
      + '\n【unrestThreshold】满意度低于此值触发动荡\n'
      + '  农民阶层：threshold 25（更易爆发）\n'
      + '  商人：threshold 20\n'
      + '  士绅：threshold 35（有地位不轻举）\n'
      + '  贱籍：threshold 15（组织力弱）\n'
      + '  军人：threshold 30（易哗变）\n'
      + '\n【size 人口规模分层】\n'
      + '  农民 60-75%，士绅 3-8%，商贾 5-10%，手工业 8-15%，贱籍 1-3%，皇族 <0.1%\n'
      + '\n═════════ B. 非史实/虚构阶层数值 ═════════\n'
      + '  新兴阶层初期：size 3-8%，satisfaction 55，influence 20-35（刚起步）\n'
      + '  衰落阶层末期：size 15-30%（曾经大但没落），satisfaction 25，influence 15\n'
      + '\nsatisfaction和influence必须是数字！【每阶层数值必须不同】';
    else if (target === 'items') schemaHint = '每个元素包含：name(名称)、type(weapon/armor/consumable/treasure/document/seal/special)、rarity(普通/精良/珍贵/传说)、owner(持有者姓名或空)、value(价值数字)、effect(效果描述)、description(50字描述)';
    else if (target === 'military') schemaHint = '返回JSON对象{initialTroops:[],militarySystem:[],battleConfig:{}}。\ninitialTroops每项：name(部队名)、soldiers(兵力数字,必须!)、garrison(驻地)、equipment(装备数组)、morale(士气0-100)、training(训练度0-100)、loyalty(忠诚度0-100)、control(掌控度0-100)、commander(统帅)、composition(兵种组成[{type:"infantry/cavalry/archer/spearman/heavy_cavalry/siege",count:数字}])、description(50字)。\nmilitarySystem每项：name、type、description、era、effects。\nbattleConfig(可选)：{unitTypes:[{id,name,attack(1-15),defense(1-15),speed(1-10),siegeValue(0-10),baseCost,description}],terrainModifiers:{plains:{attackMod,defenseMod},hills:{...},...}}。请根据该朝代的实际兵种和地形生成unitTypes，如秦有弩阵、唐有陌刀兵、宋有神臂弓手、蒙古有轻骑兵。soldiers必须是具体数字!';
    else if (target === 'techTree') schemaHint = '每项：name、category(military/civil)、era(初级/中级/高级/顶级)、prereqs(前置科技名数组)、costs(费用数组[{variable:"变量名",amount:数字}])、effect(效果对象{"变量名":增量})、description(50字)。费用和效果的变量名应与剧本定义的变量一致。';
    else if (target === 'civicTree') schemaHint = '每项：name、category(city/policy/resource/corruption)、era(初级/中级/高级)、prereqs(前置数组)、costs(费用数组[{variable:"变量名",amount:数字}])、effect(效果对象{"变量名":增量})、description(50字)。';
    else if (target === 'variables_base') schemaHint = '\u3010\u57FA\u7840\u53D8\u91CF\u3011\u662F\u4EFB\u4F55\u671D\u4EE3\u90FD\u901A\u7528\u7684\u6838\u5FC3\u56FD\u5BB6\u6307\u6807\u3002\u6BCF\u4E2A\u5143\u7D20\u5305\u542B: name(\u4E2D\u6587\u540D),defaultValue(\u521D\u59CB\u6570\u5B57),unit(\u5355\u4F4D),calcMethod(\u8BA1\u7B97\u65B9\u5F0F\u63CF\u8FF0),components(\u6536\u652F\u660E\u7EC6),description,isCore(\u5E03\u5C14\u503C,\u662F\u5426\u4E3A\u6838\u5FC3\u6307\u6807\u5728\u754C\u9762\u9876\u90E8\u663E\u793A\u53D8\u5316\u91CF,\u9ED8\u8BA4false),inversed(\u5E03\u5C14\u503C,\u6570\u503C\u8D8A\u9AD8\u8D8A\u5DEE\u5982\u6C11\u53D8/\u515A\u4E89/\u8150\u8D25,\u9ED8\u8BA4false),displayName(\u663E\u793A\u540D,\u53EF\u9009)\u3002\n\u53EA\u80FD\u662F\u4EE5\u4E0B\u8FD9\u51E0\u7C7B\uFF1A\u56FD\u5E93/\u8D22\u653F(\u91D1\u94B1\u7C7B)\u3001\u7CAE\u98DF\u50A8\u5907\u3001\u603B\u5175\u529B\u3001\u6C11\u5FC3/\u4EBA\u5FC3\u3001\u671D\u5EF7\u5A01\u671B\u3001\u4EBA\u53E3\u3001\u7A0E\u8D4B\u538B\u529B\u7B49\u5B8F\u89C2\u7EFC\u5408\u6307\u6807\u3002\u4E0D\u5F97\u5305\u542B\u65F6\u4EE3\u7279\u6709\u7684\u7EC6\u8282\u53D8\u91CF\u3002\u5EFA\u8BAE\u68073-5\u4E2A\u53D8\u91CF\u6807\u8BB0isCore:true\u3002';
    else if (target === 'variables_other') schemaHint = '\u3010\u5267\u672C\u7279\u6709\u53D8\u91CF\u3011\u662F\u8BE5\u671D\u4EE3/\u5267\u672C\u72EC\u6709\u7684\u65F6\u4EE3\u7279\u8272\u6307\u6807\u3002\u6BCF\u4E2A\u5143\u7D20\u5305\u542B: name(\u4E2D\u6587\u540D),defaultValue(\u521D\u59CB\u6570\u5B57),unit(\u5355\u4F4D),components(\u6536\u652F\u660E\u7EC6),description,isCore(\u5E03\u5C14,\u6838\u5FC3\u6307\u6807),inversed(\u5E03\u5C14,\u8D8A\u9AD8\u8D8A\u5DEE),displayName(\u663E\u793A\u540D)\u3002\n\u4F8B\u5982\uFF1A\u5510\u671D\u2192\u85E9\u9547\u5272\u636E\u5EA6(inversed:true)\u3001\u5B89\u53F2\u4E4B\u4E71\u5A01\u80C1(inversed:true)\uFF1B\u5B8B\u671D\u2192\u5C81\u5E01\u652F\u51FA(inversed:true)\u3001\u79D1\u4E3E\u5165\u4ED5\u7387\u3002\u4E0D\u5F97\u4E0E\u57FA\u7840\u53D8\u91CF\u91CD\u590D\u3002';
    else if (target === 'variables_formulas') schemaHint = '【关联公式系统·五种类型】\n'
      + '每个公式必须包含：name(名称), type(类型), expression(表达式), relatedVars(关联变量数组), chains(链式影响数组,可选), description(说明)\n\n'
      + 'type必须为以下之一：\n'
      + '- "income"(收支公式)：每回合自动计算的收入/支出项。如：\n'
      + '  {name:"岁入·租调钱",type:"income",expression:"在册丁男×租约0.87贯/丁×实收率\\n实收率≈65%（考虑逃户、隐匿、豁免）",relatedVars:["国库","在册丁男"],chains:["均田覆盖↑→在册丁男↑→租调基数↑→岁入↑"],description:"租调制核心税源"}\n'
      + '- "constraint"(约束条件)：变量不可违反的硬限制。如：\n'
      + '  {name:"粮食不可为负",type:"constraint",expression:"粮食储备 >= 0\\n若粮食储备<0 → 触发饥荒",relatedVars:["粮食储备"]}\n'
      + '- "trigger"(触发规则)：阈值触发效果。如：\n'
      + '  {name:"民变触发",type:"trigger",expression:"民心<20 → 民变风险+30，可能爆发起义\\n民心<10 → 必定爆发大规模民变",relatedVars:["民心"],chains:["民心↓→流民↑→治安↓→民变风险↑"]}\n'
      + '- "coupling"(联动关系)：一个变量变化引起连锁反应。如：\n'
      + '  {name:"税赋-民心联动",type:"coupling",expression:"税赋每↑10% → 民心↓5，国库↑\\n税赋每↓10% → 民心↑3，国库↓",relatedVars:["税赋","民心","国库"],chains:["重税→民心↓→流民↑→户口↓→税基↓→恶性循环"]}\n'
      + '- "ratio"(比例/基数)：变量间的定量关系。如：\n'
      + '  {name:"军饷计算",type:"ratio",expression:"军饷(贯/月) = 总兵力 × 2贯/人/月\\n精锐×3贯 + 普通×2贯 + 辅兵×1贯",relatedVars:["国库","总兵力"],description:"军饷是最大支出项"}\n\n'
      + '【要求】\n'
      + '1. 生成8-15条公式，涵盖全部5种类型\n'
      + '2. 必须包含：岁入明细（租税/盐铁/商税）、岁出明细（军饷/官俸/基建）、年度盈余计算\n'
      + '3. 必须包含：至少3条联动关系chains（如均田→税收→国力的正循环，重税→民变的负循环）\n'
      + '4. 数据参考该朝代史实（如唐代租庸调制、宋代两税法、明代一条鞭法）\n'
      + '5. expression中的数字应参考史实规模（如唐代在册户约900万，宋代岁入约6000万贯）\n'
      + '6. chains数组每条格式："A↑→B↑→C↑"或"A↓→B↓"';
    else if (target === 'rules') schemaHint = '返回JSON对象{rules:[],warConfig:{},diplomacyConfig:{},schemeConfig:{},eventConstraints:{},chronicleConfig:{}}。\nrules数组每项含 category(base/combat/economy/diplomacy)、name、content。\nwarConfig(可选)：{casusBelliTypes:[{id,name,prestigeCost(0-25),truceMonths(12-60)}]}，根据该朝代的战争惯例定义宣战理由类型。\ndiplomacyConfig(可选)：{treatyTypes:[{id,name,durationMonths,mutual_defense:bool}]}，根据该朝代外交惯例定义条约类型（如和亲/朝贡/互市/会盟等）。\nschemeConfig(可选)：{enabled:true/false,schemeTypes:[{id,name,baseSuccess(0-1),cooldownMonths}]}，根据该朝代宫廷政治定义阴谋类型。\neventConstraints(可选)：{enabled:true,types:[{id,name,maxPerYear,minIntervalMonths,condition}]}，定义可能发生的重大事件类型及频率限制。\nchronicleConfig(可选)：{yearlyEnabled:true,style:"biannian/shilu/jizhuan/jishi/biji",yearlyMinChars:800,yearlyMaxChars:1500}，根据该朝代选择合适的史书仿写风格。';
    else if (target === 'events') schemaHint = '每个元素包含 name、type（historical/random/conditional/story/chain之一）、trigger、effect、description 字段';
    else if (target === 'timeline') schemaHint = '每项：name(事件名)、year(时间)、type(past/future)、importance(关键/重要/普通)、description(80字)、linkedChars(关联角色)、linkedFactions(关联势力)。未来事件还需triggerCondition(触发条件)。';
    else if (target === 'map') schemaHint = '返回JSON数组，每项必须有type字段（city/strategic/geo之一）和name字段。city类型还需owner、population、resources、defenses、description、terrain(plains/hills/mountains/forest/desert/grassland/swamp)、passLevel(关隘等级0-5,重要关隘如潼关=5,普通城市=0)、passName(关隘名称,如"潼关""函谷关",无关隘留空)、moneyRatio(钱产出比重,默认3)、grainRatio(粮产出比重,默认7)；strategic类型还需controller、significance、description；geo类型还需climate、description。三种类型各生2-3项，共生成6-9项。重要关隘和战略要地请根据该朝代实际地理标注passLevel。';
    else if (target === 'worldSettings') schemaHint = '返回JSON对象(非数组)：{culture(文化风俗80-150字),weather(气候天象80-150字),religion(宗教信仰80-150字),economy(经济形态80-150字),technology(技术水平80-150字),diplomacy(外交格局80-150字)}。每个字段必须有具体历史细节。';
    else if (target === 'government') schemaHint = '返回部门嵌套树JSON数组，代表该朝代完整官制。每个元素为一个部门，包含：name(部门名)、desc(部门简介)、functions(职能数组，字符串列表)、positions(官职数组，每项含 name/rank/holder/desc/headCount/duties/succession/authority + 深化字段)、subs(子部门数组，结构相同可递归嵌套)。顶层应为3-8个主要部门，每个部门下应有若干官职positions[]和子部门subs[]。positions中每个官职的duties字段必须50字以上详述职责。succession字段表示继任方式(appointment流官/hereditary世袭/examination科举/military军功/recommendation举荐)。authority字段表示权限等级(decision决策/execution执行/advisory咨询/supervision监察)。\n\n【深化字段·必填】每个 position 还需：\n· publicTreasuryInit:{money(银两),grain(米石),cloth(布匹),quotaMoney,quotaGrain,quotaCloth} — 公库初值\n· bindingHint: "region|ministry|military|imperial|" — 公库绑定类型\n· privateIncome:{bonusType(恩赏/冰敬/炭敬/养廉银/职田/火耗/漕规/关规/羡余),bonusNote(合法陋规说明),illicitRisk(low/medium/high)} — 私产/俸外收入\n· powers:{appointment(辟署权),yinBu(荫补),impeach(弹劾),supervise(监察),taxCollect(征税),militaryCommand(调兵)} — 专项权限\n· hooks:{triggerOnLowTreasury,triggerOnUnrest,triggerOnHeavenSign,tenureYears} — 行为钩子\n要求：数值符合该朝代该官职史实；地方大员肥缺 illicitRisk=high；翰林清要职 illicitRisk=low；权限按史实勾选。注意：必须严格按照该朝代实际官制生成，不可套用其他朝代。';
    else if (target === 'adminHierarchy') schemaHint = '返回行政区划嵌套树JSON数组，代表该势力的完整行政层级体系。每个元素为一个行政单位，包含：id(唯一标识，如"div_xxx")、name(行政单位名称)、level(行政级别：country国家/王朝、province省州、prefecture郡府、county县城、district乡镇)、description(该行政单位的描述，50字以内)、dejureOwner(法理控制者势力名,即该地名义上应归属谁)、capitalChildId(首府子行政区ID,仅上级节点需要,指定哪个子节点是治所)、population(人口数字)、prosperity(繁荣度0-100)、terrain(地形)、specialResources(特产)、children(下级行政单位数组，结构相同可递归嵌套)。\n\n【顶级单位深化字段·建议填】顶级（level=province 或首级）单位可选包含：\n· regionType: "normal|jimi|tusi|fanbang|imperial_clan" — 区划类型\n· populationDetail:{households,mouths,ding,fugitives,hiddenCount} — 户口三元\n· baojia:{baoCount,jiaCount,paiCount,registerAccuracy} — 保甲/里甲登记\n· byGender:{male,female,sexRatio}\n· byAge:{old:{count,ratio},ding:{count,ratio},young:{count,ratio}}\n· byEthnicity: 按朝代对应比例 {"汉":0.95,"其他":0.05 或其他族群}\n· byFaith: 按朝代 {"儒":0.3,"佛":0.2,"道":0.15,"民间":0.35} 或其他\n· carryingCapacity:{arable,water,climate,historicalCap,currentLoad,carryingRegime("balanced/overload/famine")} — 承载力\n· minxinLocal(0-100), corruptionLocal(0-100)\n· fiscalDetail:{claimedRevenue,actualRevenue,remittedToCenter,retainedBudget,compliance,skimmingRate,autonomyLevel}\n· publicTreasuryInit:{money,grain,cloth} — 公库初值\n顶层应为2-5个主要行政区，每个行政区下应有若干下级单位。注意：不同朝代行政区划制度差异极大，必须严格按照该朝代实际制度生成，层级名称和结构必须符合历史。dejureOwner应反映该时期各地的法理归属。';
    else if (target === 'externalForces') schemaHint = '\u6BCF\u4E2A\u5143\u7D20\u5305\u542B name\u3001type(\u90BB\u56FD/\u6E38\u7267/\u6D77\u5916/\u756A\u5C5E)\u3001relation(-100\u523010)\u3001strength(\u5B9E\u529B\u63CF\u8FF0)\u3001territory\u3001leader\u3001attitude(\u53CB\u597D/\u4E2D\u7ACB/\u654C\u5BF9/\u9644\u5EF8)\u3001description \u5B57\u6BB5';
    else if (target === 'relations') schemaHint = '\u6BCF\u4E2A\u5143\u7D20\u5305\u542B name(\u5173\u7CFB\u540D\u79F0)\u3001value(\u5F53\u524D\u503C -100\u5230100)\u3001min\u3001max\u3001description \u5B57\u6BB5';
    else if (target === 'haremConfig') schemaHint = '\u8FD4\u56DEJSON\u5BF9\u8C61\uFF1A{rankSystem:[{id:"empress",name:"\u7687\u540E",level:0},...],succession:"eldest_legitimate"}\u3002rankSystem\u6309\u5C0A\u5351\u6392\u5E8F\uFF0Clevel=0\u6700\u5C0A\u3002\u6839\u636E\u8BE5\u671D\u4EE3\u5B9E\u9645\u540E\u5BAB\u5236\u5EA6\u751F\u6210\u3002';
    else schemaHint = '\u6BCF\u4E2A\u5143\u7D20\u5305\u542B name \u548C description \u5B57\u6BB5';

    // 人物/势力 schema 极大（50+ 字段每个），需更大预算避免截断；AI 也需要更大空间生成
    var maxTok;
    if (target === 'government' || target === 'adminHierarchy') maxTok = 6000;
    else if (target === 'characters' || target === 'factions') maxTok = 8000;
    else maxTok = 3000;
    // Build existing-content summary to prevent duplicates
    var existingNames = [];
    var _playerChrName = (scriptData.playerChr && scriptData.playerChr.name) ? scriptData.playerChr.name : '';
    try {
      if (target === 'characters' && scriptData.characters) existingNames = scriptData.characters.map(function(x){ return x.name; });
      else if (target === 'factions' && scriptData.factions) existingNames = scriptData.factions.map(function(x){ return x.name; });
      else if (target === 'parties' && scriptData.parties) existingNames = scriptData.parties.map(function(x){ return x.name; });
      else if (target === 'classes' && scriptData.classes) existingNames = scriptData.classes.map(function(x){ return x.name; });
      else if (target === 'items' && scriptData.items) existingNames = scriptData.items.map(function(x){ return x.name; });
      else if (target === 'military' && scriptData.military) {
        var mil = scriptData.military;
        ['troops','facilities','organization','campaigns'].forEach(function(k){
          if (mil[k]) mil[k].forEach(function(x){ existingNames.push(x.name); });
        });
        if (mil.initialTroops) mil.initialTroops.forEach(function(x){ existingNames.push(x.name); });
        if (mil.militarySystem) mil.militarySystem.forEach(function(x){ existingNames.push(x.name); });
      } else if (target === 'techTree' && scriptData.techTree) {
        ['military','civil'].forEach(function(k){
          if (scriptData.techTree[k]) scriptData.techTree[k].forEach(function(x){ existingNames.push(x.name); });
        });
      } else if (target === 'civicTree' && scriptData.civicTree) {
        ['city','policy','resource','corruption'].forEach(function(k){
          if (scriptData.civicTree[k]) scriptData.civicTree[k].forEach(function(x){ existingNames.push(x.name); });
        });
      } else if (target === 'variables_base' && scriptData.variables && scriptData.variables.base) existingNames = scriptData.variables.base.map(function(x){ return x.name; });
      else if (target === 'variables_other' && scriptData.variables && scriptData.variables.other) existingNames = scriptData.variables.other.map(function(x){ return x.name; });
      else if (target === 'variables_formulas' && scriptData.variables && scriptData.variables.formulas) existingNames = scriptData.variables.formulas.map(function(x){ return x.name; });
      else if (target === 'externalForces' && scriptData.externalForces) existingNames = scriptData.externalForces.map(function(x){ return x.name; });
      else if (target === 'relations' && scriptData.relations) existingNames = scriptData.relations.map(function(x){ return x.name; });
      else if (target === 'rules' && scriptData.rules) {
        ['base','combat','economy','diplomacy'].forEach(function(k){
          if (scriptData.rules[k]) {
            // rules[k] 是文本字符串，不是数组
            if (typeof scriptData.rules[k] === 'string' && scriptData.rules[k].trim()) {
              existingNames.push(k);
            } else if (Array.isArray(scriptData.rules[k])) {
              scriptData.rules[k].forEach(function(x){ if (x.name) existingNames.push(x.name); });
            }
          }
        });
      } else if (target === 'events' && scriptData.events) {
        ['historical','random','conditional','story','chain'].forEach(function(k){
          if (scriptData.events[k]) scriptData.events[k].forEach(function(x){ existingNames.push(x.name); });
        });
      } else if (target === 'timeline' && scriptData.timeline) {
        ['past','future'].forEach(function(k){
          if (scriptData.timeline[k]) scriptData.timeline[k].forEach(function(x){ existingNames.push((x.year||'')+''+x.event); });
        });
      } else if (target === 'map' && scriptData.map) {
        ['city','strategic','geo'].forEach(function(k){
          if (scriptData.map[k]) scriptData.map[k].forEach(function(x){ existingNames.push(x.name); });
        });
      } else if (target === 'government' && scriptData.government && scriptData.government.nodes) {
        function collectGovNames(nodes) {
          nodes.forEach(function(n) {
            existingNames.push(n.name);
            if (n.positions) n.positions.forEach(function(p) { existingNames.push(p.name); });
            if (n.subs && n.subs.length) collectGovNames(n.subs);
          });
        }
        collectGovNames(scriptData.government.nodes);
      } else if (target === 'adminHierarchy' && scriptData.adminHierarchy) {
        var factionId = (typeof _currentAdminFactionId !== 'undefined') ? _currentAdminFactionId : 'player';
        if (scriptData.adminHierarchy[factionId] && scriptData.adminHierarchy[factionId].divisions) {
          function collectAdminNames(divs) {
            divs.forEach(function(d) {
              existingNames.push(d.name);
              if (d.children && d.children.length) collectAdminNames(d.children);
            });
          }
          collectAdminNames(scriptData.adminHierarchy[factionId].divisions);
        }
      } else if (target === 'haremConfig' && scriptData.haremConfig && scriptData.haremConfig.rankSystem) {
        scriptData.haremConfig.rankSystem.forEach(function(r) { existingNames.push(r.name || r.id); });
      } else if (target === 'playerOverview' && scriptData.playerInfo) {
        if (scriptData.playerInfo.factionName) existingNames.push(scriptData.playerInfo.factionName);
        if (scriptData.playerInfo.characterName) existingNames.push(scriptData.playerInfo.characterName);
      }
    } catch(ex) { existingNames = []; }

    // Build detailed existing content summary for incremental generation
    var existingNote = '';
    var existingFullContent = '';

    // For text-based content (rules, worldSettings), read full existing text
    if (target === 'rules') {
      var existingRules = [];
      ['base','combat','economy','diplomacy'].forEach(function(k){
        if (scriptData.rules && scriptData.rules[k]) {
          existingRules.push(k + '规则：' + scriptData.rules[k]);
        }
      });
      if (existingRules.length > 0) {
        existingFullContent = '【已有规则内容】\n' + existingRules.join('\n\n') + '\n\n';
        existingNote = '已有规则类型：' + existingRules.map(function(r){ return r.split('规则：')[0]; }).join('、') + '\n';
        existingNote += '请在现有规则基础上补充完善，增加更多细节和具体规则，不要重复已有内容。\n';
      }
    } else if (target === 'worldSettings') {
      var ws = scriptData.worldSettings;
      if (ws && (ws.culture || ws.weather || ws.religion || ws.economy || ws.technology || ws.diplomacy)) {
        existingFullContent = '【已有世界设定】\n' + JSON.stringify(ws, null, 2) + '\n\n';
        existingNote = '已有世界设定内容，请在此基础上补充完善，增加更多细节描述，不要重复已有内容。\n';
      }
    }

    // For list-based content, provide both names and detailed content
    if (existingNames.length) {
      if (!existingNote) {
        existingNote = '已有内容（请在此基础上补充完善，不得重复生成，可以扩展细化）：' + existingNames.join('、') + '\n';
      }

      // For complex objects, include full details to help AI understand existing content
      if (target === 'characters') {
        // 跨数据引用——让AI知道已有势力/党派以正确分配
        var _crossRef = '';
        if (scriptData.factions && scriptData.factions.length > 0) {
          _crossRef += '\u3010\u5DF2\u6709\u52BF\u529B\u3011' + scriptData.factions.map(function(f) { return f.name; }).join('\u3001') + '\n';
        }
        if (scriptData.parties && scriptData.parties.length > 0) {
          _crossRef += '\u3010\u5DF2\u6709\u515A\u6D3E\u3011' + scriptData.parties.map(function(p) { return p.name; }).join('\u3001') + '\n';
        }
        _crossRef += '\u3010\u73A9\u5BB6\u52BF\u529B\u3011' + (scriptData.dynasty || '') + '\u671D\u5EF7\n';
        // 3.3: 势力成员分布（让AI均衡分配）
        if (scriptData.factions && scriptData.factions.length > 0 && scriptData.characters && scriptData.characters.length > 0) {
          _crossRef += '\u3010\u52BF\u529B\u6210\u5458\u5206\u5E03\u3011';
          scriptData.factions.forEach(function(f) {
            var cnt = scriptData.characters.filter(function(c){return c.faction===f.name;}).length;
            _crossRef += f.name + ':' + cnt + '\u4EBA ';
          });
          var noFac = scriptData.characters.filter(function(c){return !c.faction;}).length;
          if (noFac > 0) _crossRef += '\u672A\u5206\u914D:' + noFac + '\u4EBA';
          _crossRef += '\n\u8BF7\u5747\u8861\u5206\u914D\u65B0\u89D2\u8272\u5230\u5404\u52BF\u529B\uFF0C\u4F18\u5148\u8865\u5145\u4EBA\u6570\u5C11\u7684\u52BF\u529B\u3002\n';
        }
        // 3.3: 空缺官职（让AI合理分配officialTitle）
        if (scriptData.government && scriptData.government.nodes && scriptData.characters) {
          var _allPosts = [];
          (function _wp(nodes){nodes.forEach(function(n){if(n.positions)n.positions.forEach(function(p){_allPosts.push({dept:n.name,post:p.name,full:n.name+p.name});});if(n.subs)_wp(n.subs);});})(scriptData.government.nodes);
          var _occupiedPosts = scriptData.characters.map(function(c){return c.officialTitle||'';}).filter(function(t){return t;});
          var _vacantPosts = _allPosts.filter(function(p){return _occupiedPosts.indexOf(p.full)<0;});
          if (_vacantPosts.length > 0) {
            _crossRef += '\u3010\u7A7A\u7F3A\u5B98\u804C\u3011' + _vacantPosts.slice(0,15).map(function(p){return p.full;}).join('\u3001') + '\n\u4F18\u5148\u4E3A\u65B0\u89D2\u8272\u5206\u914D\u7A7A\u7F3A\u804C\u4F4D\u3002\n';
          }
        }
        // 行政区划地名（让AI生成角色时使用正确的location）
        if (scriptData.adminHierarchy) {
          var _ahNames = [];
          Object.keys(scriptData.adminHierarchy).forEach(function(k) {
            var ah = scriptData.adminHierarchy[k];
            if (ah && ah.divisions) (function _w(ds) { ds.forEach(function(d) { if (d.name) _ahNames.push(d.name); if (d.divisions) _w(d.divisions); }); })(ah.divisions);
          });
          if (_ahNames.length > 0) _crossRef += '\u3010\u884C\u653F\u533A\u5212\u5730\u540D\u3011' + _ahNames.slice(0, 20).join('\u3001') + '\n\u751F\u6210\u89D2\u8272\u7684location\u5FC5\u987B\u4ECE\u4EE5\u4E0A\u5730\u540D\u4E2D\u9009\u53D6\u3002\n';
        }
        // 官制信息（让AI生成角色时正确分配officialTitle）
        if (scriptData.government && scriptData.government.nodes && scriptData.government.nodes.length > 0) {
          var _govPosts = [];
          (function _wg(nodes) { nodes.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { _govPosts.push(n.name + p.name); }); if (n.subs) _wg(n.subs); }); })(scriptData.government.nodes);
          if (_govPosts.length > 0) _crossRef += '\u3010\u5B98\u5236\u804C\u4F4D\u3011' + _govPosts.slice(0, 20).join('\u3001') + '\n\u751F\u6210\u89D2\u8272\u7684officialTitle\u5E94\u4ECE\u4EE5\u4E0A\u804C\u4F4D\u4E2D\u9009\u53D6\u6216\u7559\u7A7A\u3002\n';
        }
        // 史实参考
        var _gm2 = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
        var _rt2 = (typeof P !== 'undefined' && P.conf && P.conf.refText) || '';
        if (_gm2 === 'strict_hist' && _rt2) _crossRef += '\u3010\u53C2\u8003\u6570\u636E\u5E93\u3011\n' + _rt2.substring(0, 5000) + '\n\u8BF7\u4E25\u683C\u53C2\u8003\u4EE5\u4E0A\u6570\u636E\u5E93\u3002\n';
        if (_gm2 === 'strict_hist') _crossRef += '\u3010\u5386\u53F2\u9650\u5236\u3011\u4EC5\u751F\u6210\u5267\u672C\u5F00\u59CB\u5E74\u4EFD\u524D\u540E100\u5E74\u5185\u7684\u5386\u53F2\u540D\u81E3\u3002\n';
        else if (_gm2 === 'light_hist') _crossRef += '\u3010\u5386\u53F2\u9650\u5236\u3011\u4EC5\u751F\u6210\u5267\u672C\u5F00\u59CB\u5E74\u4EFD\u524D\u540E200\u5E74\u5185\u7684\u5386\u53F2\u540D\u81E3\u3002\n';
        if (scriptData.characters && scriptData.characters.length > 0) {
          // 详细输出已有角色的字段完整度（让AI知道哪些需要补全）
          var _requiredFields = ['name','title','type','role','faction','party','officialTitle','age','gender','ethnicity','birthplace','occupation','stance','personality','personalGoal','bio','location','loyalty','ambition','intelligence','valor','military','administration','charisma','diplomacy','benevolence'];
          var charDetails = [];
          var _incompleteCount = 0;
          scriptData.characters.slice(0, 15).forEach(function(c) {
            var missing = _requiredFields.filter(function(f) { return !c[f] && c[f] !== 0; });
            var line = c.name + '（' + (c.faction||'?') + ',' + (c.role||'?') + '）';
            if (missing.length > 3) { line += ' ⚠缺:' + missing.slice(0,6).join('/'); _incompleteCount++; }
            charDetails.push(line);
          });
          existingFullContent = _crossRef + '【已有人物' + scriptData.characters.length + '人】\n' + charDetails.join('\n') + '\n\n';
          if (_incompleteCount > 0) {
            existingNote = '已有' + scriptData.characters.length + '人，其中' + _incompleteCount + '人数据不完整。\n'
              + '【任务优先级】1.补全已有角色的缺失字段（直接返回完整对象覆盖） 2.生成3-5个新角色\n'
              + '对于已有角色的补全：返回的JSON中name与已有角色相同即视为更新。\n';
          } else {
            existingNote = '已有' + scriptData.characters.length + '人（数据较完整）。\n请在此基础上生成3-5个新角色，不要重复已有角色名。\n';
          }
        } else {
          existingFullContent = _crossRef;
        }
      } else if (target === 'factions' && scriptData.factions && scriptData.factions.length > 0) {
        var _facRequired = ['name','type','leader','leaderTitle','territory','goal','strength','militaryStrength','attitude','resources','mainstream','culture','description','color','leaderInfo','heirInfo'];
        var facDetails = [];
        var _facIncomplete = 0;
        scriptData.factions.forEach(function(f) {
          var missing = _facRequired.filter(function(k) { return !f[k] && f[k] !== 0; });
          var line = f.name + '（' + (f.type||'?') + '，实力' + (f.strength||'?') + '）';
          if (missing.length > 3) { line += ' ⚠缺:' + missing.slice(0,5).join('/'); _facIncomplete++; }
          facDetails.push(line);
        });
        // 3.3: 注入地图/行政区划信息帮助AI分配领土
        var _facContext = '';
        if (scriptData.adminHierarchy) {
          var _ahRegions = [];
          Object.keys(scriptData.adminHierarchy).forEach(function(k){var ah=scriptData.adminHierarchy[k];if(ah&&ah.divisions)(function _w(ds){ds.forEach(function(d){if(d.name)_ahRegions.push(d.name);if(d.divisions)_w(d.divisions);});})(ah.divisions);});
          if (_ahRegions.length>0) _facContext += '\u3010\u5DF2\u6709\u884C\u653F\u533A\u5212\u3011' + _ahRegions.slice(0,20).join('\u3001') + '\n\u65B0\u52BF\u529B\u7684territory\u5E94\u4ECE\u4EE5\u4E0A\u5730\u540D\u4E2D\u9009\u53D6\u3002\n';
        }
        if (scriptData.characters && scriptData.characters.length > 0) {
          _facContext += '\u3010\u5DF2\u6709\u89D2\u8272\u3011' + scriptData.characters.length + '\u4EBA\uFF0C\u5404\u52BF\u529B\u53EF\u4ECE\u4E2D\u6307\u5B9Aleader\u3002\n';
        }
        existingFullContent = _facContext + '\u3010\u5DF2\u6709\u52BF\u529B' + scriptData.factions.length + '\u4E2A\u3011\n' + facDetails.join('\n') + '\n\n';
        if (_facIncomplete > 0) {
          existingNote = '已有' + scriptData.factions.length + '个势力，其中' + _facIncomplete + '个数据不完整。\n'
            + '【任务优先级】1.补全已有势力的缺失字段（含leaderInfo/heirInfo/color等，直接返回完整对象覆盖） 2.生成2-3个新势力\n'
            + '对于已有势力的补全：返回的JSON中name与已有势力相同即视为更新。\n';
        } else {
          existingNote = '已有' + scriptData.factions.length + '个势力（数据较完整）。\n请在此基础上生成2-3个新势力，不要重复已有势力名。\n';
        }
      } else if (target === 'parties' && scriptData.parties && scriptData.parties.length > 0) {
        existingFullContent = '【已有党派详情】\n' + scriptData.parties.map(function(p) {
          return p.name + (p.leader ? '(领袖:' + p.leader + ')' : '') + ' ' + (p.ideology||'') + '：' + (p.description||'').substring(0, 80);
        }).join('\n') + '\n\n';
      } else if (target === 'classes' && scriptData.classes && scriptData.classes.length > 0) {
        existingFullContent = '【已有阶层详情】\n' + scriptData.classes.map(function(c) {
          return c.name + (c.size ? '(' + c.size + ')' : '') + '：' + (c.description||'').substring(0, 80);
        }).join('\n') + '\n\n';
      } else if (target === 'items' && scriptData.items && scriptData.items.length > 0) {
        existingFullContent = '【已有物品详情】\n' + scriptData.items.map(function(it) {
          return it.name + '(' + (it.type||'') + ')：' + (it.description||'').substring(0, 60);
        }).join('\n') + '\n\n';
      } else if ((target === 'variables_base' || target === 'variables_other' || target === 'variables_formulas') && scriptData.variables) {
        // 详细传递基础变量和其他变量的分类信息
        var _varParts = [];
        if (scriptData.variables.base && scriptData.variables.base.length > 0) {
          _varParts.push('【基础变量（通用国家指标）' + scriptData.variables.base.length + '个】');
          scriptData.variables.base.forEach(function(v) {
            _varParts.push('  [基础] ' + v.name + ' = ' + (v.defaultValue||0) + (v.unit?' '+v.unit:'') + (v.description?' ('+v.description.slice(0,30)+')':''));
          });
        }
        if (scriptData.variables.other && scriptData.variables.other.length > 0) {
          _varParts.push('【其他变量（时代特色指标）' + scriptData.variables.other.length + '个】');
          scriptData.variables.other.forEach(function(v) {
            _varParts.push('  [特色] ' + v.name + ' = ' + (v.defaultValue||0) + (v.unit?' '+v.unit:'') + (v.description?' ('+v.description.slice(0,30)+')':''));
          });
        }
        if (scriptData.variables.formulas && scriptData.variables.formulas.length > 0) {
          _varParts.push('【关联公式' + scriptData.variables.formulas.length + '个】');
          scriptData.variables.formulas.forEach(function(v) {
            _varParts.push('  [公式] ' + v.name + ': ' + (v.expression||''));
          });
        }
        if (_varParts.length > 0) {
          existingFullContent = _varParts.join('\n') + '\n\n';
          if (target === 'variables_base') {
            existingNote = '已有基础变量' + ((scriptData.variables.base||[]).length) + '个。\n'
              + '⚠ 基础变量只能是通用宏观国家指标（国库/粮食/兵力/民心/威望/人口/税赋等），绝不能包含时代特色内容。\n'
              + '已有的其他变量（时代特色）：' + ((scriptData.variables.other||[]).map(function(v){return v.name;}).join('、')||'无') + '——基础变量不得与它们重复。\n';
          } else if (target === 'variables_other') {
            existingNote = '已有其他变量' + ((scriptData.variables.other||[]).length) + '个。\n'
              + '⚠ 其他变量必须是该剧本/朝代特有的指标（如唐→藩镇割据度，宋→岁币支出，明→内阁专权度），绝不能包含国库/兵力/民心等通用指标。\n'
              + '已有的基础变量（通用指标）：' + ((scriptData.variables.base||[]).map(function(v){return v.name;}).join('、')||'无') + '——其他变量不得与它们重复。\n';
          }
        }
      } else if (target === 'events' && scriptData.events) {
        var evtCount = 0;
        var evtSummary = [];
        ['historical','random','conditional','story','chain'].forEach(function(k){
          if (scriptData.events[k] && scriptData.events[k].length > 0) {
            evtCount += scriptData.events[k].length;
            evtSummary.push(k + '事件：' + scriptData.events[k].map(function(e){ return e.name; }).join('、'));
          }
        });
        if (evtCount > 0) {
          existingFullContent = '【已有事件详情】\n' + evtSummary.join('\n') + '\n\n';
        }
      } else if (target === 'timeline' && scriptData.timeline) {
        var tlSummary = [];
        ['past','future'].forEach(function(k) {
          if (scriptData.timeline[k] && scriptData.timeline[k].length > 0) {
            tlSummary.push((k === 'past' ? '过去' : '未来') + '：' + scriptData.timeline[k].map(function(t) { return (t.year||'') + ' ' + (t.name||t.event||''); }).join('、'));
          }
        });
        if (tlSummary.length > 0) existingFullContent = '【已有时间线】\n' + tlSummary.join('\n') + '\n\n';
      } else if (target === 'government' && scriptData.government && scriptData.government.nodes) {
        existingFullContent = '【当前官制结构】\n' + JSON.stringify(scriptData.government.nodes, null, 2).substring(0, 2000) + '...\n\n';
        existingNote += '请在现有基础上补充缺失的部门和官职，或细化现有部门的子部门。\n';
      } else if (target === 'adminHierarchy' && scriptData.adminHierarchy) {
        var factionId = (typeof _currentAdminFactionId !== 'undefined') ? _currentAdminFactionId : 'player';
        if (scriptData.adminHierarchy[factionId] && scriptData.adminHierarchy[factionId].divisions) {
          existingFullContent = '【当前行政区划结构】\n' + JSON.stringify(scriptData.adminHierarchy[factionId].divisions, null, 2).substring(0, 2000) + '...\n\n';
          existingNote += '请在现有基础上补充缺失的行政区划，或细化现有区划的下级单位。\n';
        }
      }
    }

    // 人物/势力 schema 极大，降低批量数避免 JSON 截断；其他保持 5-10 条
    var _batchCount = (target === 'characters' || target === 'factions') ? '3-5' : '5-10';
    var prompt = '你是天命游戏副本设计师。' + ctx + '\n' + existingFullContent + existingNote + '请生成「' + label + '」的新内容，' + _batchCount + '条，不得与已有内容重复。';
    if (target === 'characters' || target === 'factions') {
      prompt += '\n\u3010\u786C\u89C4\u5219\u3011\u5B81\u5C11\u52FF\u5197\u2014\u2014\u5B81\u53EF\u4EC5\u751F\u6210 3 \u6761\u5B8C\u6574 JSON\uFF0C\u4E5F\u4E0D\u8981\u751F\u6210 5 \u6761\u4F46\u4E2D\u9014\u622A\u65AD\u3002\u5FC5\u987B\u8FD4\u56DE\u4E25\u683C JSON \u6570\u7ec4\uFF0C\u4E0D\u5F97\u5305\u542B\u6CE8\u91CA(//)\u3001\u672B\u5C3E\u9017\u53F7\u3001\u6216\u4EFB\u4F55\u89E3\u91CA\u6587\u5B57\u3002';
    }

    // Special handling for government: MULTI-PASS auto-deepening
    if (target === 'government') {
      showToast('\u5B98\u5236\u751F\u6210\u91C7\u7528\u591A\u8F6E\u6DF1\u5316\u6A21\u5F0F\uFF0C\u8BF7\u7A0D\u5019...');
      _multiPassGovernmentGen(ctx, existingFullContent, existingNote, maxTok);
      return;
    }
    // Special handling for adminHierarchy: MULTI-PASS auto-deepening
    if (target === 'adminHierarchy') {
      showToast('\u884C\u653F\u533A\u5212\u751F\u6210\u91C7\u7528\u591A\u8F6E\u6DF1\u5316\u6A21\u5F0F\uFF0C\u8BF7\u7A0D\u5019...');
      _multiPassAdminGen(ctx, existingFullContent, existingNote, maxTok);
      return;
    }
    // Legacy single-pass government (kept as fallback, should not reach here)
    if (false && target === 'government') {
      if (scriptData.government && scriptData.government.nodes && scriptData.government.nodes.length > 0) {
        // Analyze existing structure depth
        function analyzeGovDepth(nodes) {
          var maxDepth = 0;
          var hasEmptySubs = false;
          var topLevelCount = nodes.length;

          function traverse(nodeList, depth) {
            nodeList.forEach(function(node) {
              if (depth > maxDepth) maxDepth = depth;
              if (node.subs && node.subs.length > 0) {
                traverse(node.subs, depth + 1);
              } else if (depth === 1) {
                // Top-level node without subs
                hasEmptySubs = true;
              }
            });
          }
          traverse(nodes, 1);
          return { maxDepth: maxDepth, hasEmptySubs: hasEmptySubs, topLevelCount: topLevelCount };
        }

        var depthInfo = analyzeGovDepth(scriptData.government.nodes);

        // Strategy: complete current level before going deeper
        if (depthInfo.topLevelCount < 6 || depthInfo.hasEmptySubs) {
          // Still need more top-level departments or some top-level nodes lack subs
          prompt = '你是天命游戏副本设计师，精通中国历史官制。' + ctx + '\n' + existingFullContent + existingNote +
            '【分层生成策略】当前处于顶层部门补充阶段。\n' +
            '请按以下优先级生成：\n' +
            '1. 如果顶层部门不足6个，优先补充缺失的重要顶层部门（如三省六部、枢密院、御史台等）\n' +
            '2. 如果某些顶层部门的 subs[] 为空，为这些部门补充二级子部门\n' +
            '3. 暂时不要生成三级及以下的部门，先完善前两层\n' +
            '4. 每个部门的 positions[] 列出该部门的主要官职（3-8个）\n' +
            '5. positions[] 中每个官职的 duties 字段必须50字以上详述职责权力范围\n' +
            '6. 内容客观准确，符合历史实际\n' +
            '7. 返回 JSON 数组格式，每个元素为一个顶层部门或需要补充子部门的完整结构';
        } else {
          // Top levels are complete, now go deeper
          prompt = '你是天命游戏副本设计师，精通中国历史官制。' + ctx + '\n' + existingFullContent + existingNote +
            '【分层生成策略】当前顶层和二级部门已较完善，现在进入深层细化阶段。\n' +
            '请为现有的二级部门补充三级子部门（subs[]），或为三级部门补充四级子部门：\n' +
            '1. 选择现有的二级或三级部门，为其补充更细化的子部门\n' +
            '2. 每个子部门包含 name、description、positions[]、subs[] 字段\n' +
            '3. positions[] 列出该部门的具体官职（2-5个）\n' +
            '4. positions[] 中每个官职的 duties 字段必须50字以上详述职责权力范围\n' +
            '5. 不要重复已有的部门和官职\n' +
            '6. 内容客观准确，符合历史实际';
        }
      } else {
        // First generation: only top-level departments
        var _dynasty = scriptData.dynasty || scriptData.era || '该朝代';
        prompt = '你是天命游戏副本设计师，精通中国历史官制。' + ctx + '\n' +
          '【分层生成策略】这是首次生成，请只生成顶层部门（第一层级）。\n' +
          '请根据' + _dynasty + '的实际官制生成主要顶层部门（6-10个）。\n' +
          '注意：不同朝代官制差异极大，必须严格按照' + _dynasty + '的实际制度生成，不可套用其他朝代。\n' +
          '要求：\n' +
          '1. 只生成顶层部门，暂时不要生成子部门（subs[] 可以为空数组）\n' +
          '2. 每个部门的 positions[] 列出该部门的主要官职（3-8个最高级官职）\n' +
          '3. positions[] 中每个官职包含 name、rank、duties、succession(appointment/hereditary/examination/military/recommendation)、authority(decision/execution/advisory/supervision) 字段\n' +
          '4. duties 字段必须50字以上详述职责权力范围\n' +
          '5. 内容客观准确，符合历史实际\n' +
          '6. 返回 JSON 数组格式';
      }
    }
    // Legacy single-pass adminHierarchy (unreachable, kept for reference)
    if (false && target === 'adminHierarchy') {
      var factionId = (typeof _currentAdminFactionId !== 'undefined') ? _currentAdminFactionId : 'player';
      var factionName = '该势力';
      if (factionId === 'player') {
        factionName = '玩家势力';
      } else {
        var faction = scriptData.factions ? scriptData.factions.find(function(f) { return f.id === factionId; }) : null;
        if (faction) factionName = faction.name;
      }

      if (scriptData.adminHierarchy && scriptData.adminHierarchy[factionId] && scriptData.adminHierarchy[factionId].divisions && scriptData.adminHierarchy[factionId].divisions.length > 0) {
        // Analyze existing structure depth
        function analyzeAdminDepth(divisions) {
          var maxDepth = 0;
          var hasEmptyChildren = false;
          var topLevelCount = divisions.length;
          var levelCounts = {}; // Count nodes at each level

          function traverse(divList, depth) {
            if (!levelCounts[depth]) levelCounts[depth] = 0;
            divList.forEach(function(div) {
              levelCounts[depth]++;
              if (depth > maxDepth) maxDepth = depth;
              if (div.children && div.children.length > 0) {
                traverse(div.children, depth + 1);
              } else if (depth === 1) {
                // Top-level division without children
                hasEmptyChildren = true;
              }
            });
          }
          traverse(divisions, 1);
          return { maxDepth: maxDepth, hasEmptyChildren: hasEmptyChildren, topLevelCount: topLevelCount, levelCounts: levelCounts };
        }

        var depthInfo = analyzeAdminDepth(scriptData.adminHierarchy[factionId].divisions);

        // Strategy: complete current level before going deeper
        if (depthInfo.topLevelCount < 8 || depthInfo.hasEmptyChildren) {
          // Still need more top-level divisions or some top-level nodes lack children
          prompt = '你是天命游戏副本设计师，精通中国历史行政区划。' + ctx + '\n' + existingFullContent + existingNote +
            '【分层生成策略】当前处于顶层行政区补充阶段。\n' +
            '请为' + factionName + '按以下优先级生成：\n' +
            '1. 如果顶层行政区（州/道/路/省等）不足8个，优先补充缺失的重要顶层行政区\n' +
            '2. 如果某些顶层行政区的 children[] 为空，为这些行政区补充二级下属单位（郡/府/州等）\n' +
            '3. 暂时不要生成三级及以下的行政单位（如县），先完善前两层\n' +
            '4. 每个行政单位包含 id、name、level、description、children 字段\n' +
            '5. level 字段标明层级（如"州"、"郡"、"县"）\n' +
            '6. 不要重复已有的行政单位\n' +
            '7. 内容符合历史实际和该势力的地理范围\n' +
            '8. 返回 JSON 数组格式，每个元素为一个顶层行政区或需要补充下级单位的完整结构';
        } else {
          // Top levels are complete, now go deeper
          prompt = '你是天命游戏副本设计师，精通中国历史行政区划。' + ctx + '\n' + existingFullContent + existingNote +
            '【分层生成策略】当前顶层和二级行政区已较完善，现在进入深层细化阶段。\n' +
            '请为' + factionName + '的现有二级行政区补充三级下属单位（如县、镇等）：\n' +
            '1. 选择现有的二级行政区（郡/府等），为其补充三级下属单位（县/镇等）\n' +
            '2. 每个县级单位包含 id、name、level、description、children 字段\n' +
            '3. children 可以为空数组（县通常是最底层）\n' +
            '4. 每个郡/府下辖3-8个县\n' +
            '5. 不要重复已有的行政单位\n' +
            '6. 内容符合历史实际和地理分布';
        }
      } else {
        // First generation: only top-level divisions
        var _dynasty2 = scriptData.dynasty || scriptData.era || '该朝代';
        prompt = '你是天命游戏副本设计师，精通中国历史行政区划。' + ctx + '\n' +
          '【分层生成策略】这是首次生成，请只生成顶层行政区（第一层级）。\n' +
          '请为' + factionName + '生成顶层行政区（8-15个）。\n' +
          '注意：必须根据' + _dynasty2 + '的实际行政区划制度选择合适的层级名称（如郡、州、道、路、省等），不可套用其他朝代的行政区划体系。\n' +
          '要求：\n' +
          '1. 只生成顶层行政区，暂时不要生成下级单位（children[] 可以为空数组）\n' +
          '2. 每个行政区包含 id、name、level、description、children 字段\n' +
          '3. id 格式为 "admin_" + 拼音或简写（如 "admin_jingzhao"）\n' +
          '4. level 字段标明层级（如"州"、"道"、"路"、"省"）\n' +
          '5. description 简要描述该行政区的地理位置、重要性、特点（50-100字）\n' +
          '6. 内容符合历史实际和该势力的实际控制范围\n' +
          '7. 返回 JSON 数组格式';
      }
    }
    if (target === 'rules') {
      if (existingFullContent) {
        prompt = '你是天命游戏副本设计师。' + ctx + '\n' + existingFullContent + existingNote + '请在现有规则基础上补充完善，增加更多细节和具体规则条款，使规则更加完整和可操作。';
      } else {
        prompt = '你是天命游戏副本设计师。' + ctx + '\n请为该剧本生成4-6条核心游戏规则，涵盖基础规则、战斗规则、经济规则和外交规则。';
      }
      prompt += '\n返回JSON对象（注意是对象不是数组）：{\n  "rules":[{name:"规则名",category:"base/combat/economy/diplomacy",content:"规则内容50-100字"}],\n';
      prompt += '  "mechanicsConfig":{可选，按需生成以下子字段：\n';
      prompt += '    "couplingRules":[{if:"条件表达式如vars.民生压力>60",target:"变量名",perMonth:5,reason:"说明"}],\n';
      prompt += '    "npcBehaviorTypes":[{id:"唯一标识",name:"行为名称",weightFactors:{属性名:权重系数},memoryKeywords:["触发关键词"]}],\n';
      prompt += '    "policyTree":[{id:"唯一ID",name:"国策名",category:"分类",prerequisites:["前置国策ID"],description:"说明"}],\n';
      prompt += '    "decisions":[{id:"唯一ID",name:"决策名",canShowExpr:"显示条件",canExecuteExpr:"执行条件",description:"说明"}],\n';
      prompt += '    "executionPipeline":[{name:"层级名",functionKey:"职能键",baseRate:0.4,weights:{ability:0.3,loyalty:0.3},emptyRate:0.3}]\n  },\n';
      prompt += '  "militaryConfig":{可选，"unitTypes":[{id:"兵种ID",name:"兵种名",stats:{charge:N,siege:N,pursuit:N,defense:N}}]}\n}';
      prompt += '\n注意：mechanicsConfig和militaryConfig是可选的，只在剧本需要这些机制时才生成。只输出JSON。';
    }
    if (target === 'worldSettings') {
      if (existingFullContent) {
        prompt = '你是天命游戏副本设计师。' + ctx + '\n' + existingFullContent + existingNote + '请在现有世界设定基础上补充完善，为每个方面增加更多细节描述，使世界设定更加丰富立体。';
      } else {
        prompt = '你是天命游戏副本设计师。' + ctx + '\n请为该剧本生成完整的世界设定。';
      }
      prompt += '\n返回JSON对象：{culture:"文化风俗2-4句",weather:"气候地理2-4句",religion:"宗教信仰2-4句",economy:"经济形态2-4句",technology:"技术水平2-4句",diplomacy:"外交格局2-4句"}。只输出JSON。';
    }
    if (target === 'map') prompt = '\u4f60\u662f\u5929\u547d\u6e38\u620f\u5730\u56fe\u8bbe\u8ba1\u5e08\u3002' + ctx + '\n' + '\u8bf7\u751f\u6210\u8be5\u526f\u672c\u7684\u5730\u56fe\u6570\u636e JSON \u6570\u7ec4\uff0c\u5305\u542b\u57ce\u5e02\u3001\u6218\u7565\u8981\u5730\u3001\u5730\u7406\u73af\u5883\u5404 2-3 \u9879\uff0c\u5171 6-9 \u9879\u3002' + '\u6bcf\u9879\u5fc5\u987b\u6709 type(city/strategic/geo)\u3001name \u5b57\u6bb5\u3002city \u52a0 owner/population/resources/defenses\uff1b' + 'strategic \u52a0 controller/significance\uff1bgeo \u52a0 climate\u3002\u5185\u5bb9\u7b26\u5408\u671d\u4ee3\u5386\u53f2\u3002\u53ea\u8fd4\u56de JSON \u6570\u7ec4\u3002';
    if (ref) prompt += '\n\u53c2\u8003\u8d44\u6599:\n' + ref;
    if (extra) prompt += '\n\u9644\u52a0\u8981\u6c42:' + extra;
    // worldSettings返回对象、rules已指定格式，不追加通用数组格式说明
    if (target !== 'worldSettings' && target !== 'rules') {
      prompt += '\n\u8bf7\u4ee5JSON\u6570\u7ec4\u683c\u5f0f\u8fd4\u56de\uff0c' + schemaHint + '\u3002\u53ea\u8f93\u51faJSON\uff0c\u4e0d\u8981\u5176\u4ed6\u89e3\u91ca\u3002';
    }
    showToast('\u6b63\u5728\u751f\u6210' + label + '\u2026');
    closeAIGenModal();
    callAIEditor(prompt, maxTok).then(function(raw) {
      try {
        // 优先处理返回对象（非数组）的目标
        if (target === 'haremConfig') {
          var hcMatch = raw.match(/\{[\s\S]*\}/);
          if (hcMatch) {
            var hcObj = JSON.parse(hcMatch[0]);
            if (hcObj && hcObj.rankSystem) {
              if (!scriptData.haremConfig) scriptData.haremConfig = {rankSystem:[], succession:'eldest_legitimate'};
              // 增量合并：不覆盖已有位份，只添加新的
              var existingIds = scriptData.haremConfig.rankSystem.map(function(r){return r.id||r.name;});
              hcObj.rankSystem.forEach(function(r) {
                var rid = r.id || r.name;
                if (existingIds.indexOf(rid) === -1) scriptData.haremConfig.rankSystem.push(r);
              });
              scriptData.haremConfig.rankSystem.sort(function(a,b){return (a.level||0)-(b.level||0);});
              if (hcObj.succession && !scriptData.haremConfig.succession) scriptData.haremConfig.succession = hcObj.succession;
            }
            if (typeof renderHaremConfig === 'function') renderHaremConfig();
            showToast(label + '\u751F\u6210\u5B8C\u6210');
            if (typeof autoSave === 'function') autoSave();
            return;
          }
        }
        if (target === 'worldSettings') {
          var wsMatch = raw.match(/\{[\s\S]*\}/);
          if (wsMatch) {
            var wsObj = JSON.parse(wsMatch[0]);
            if (!scriptData.worldSettings) scriptData.worldSettings = {culture:'',weather:'',religion:'',economy:'',technology:'',diplomacy:''};
            var wsKeys = ['culture','weather','religion','economy','technology','diplomacy'];
            if (wsObj && typeof wsObj === 'object' && !Array.isArray(wsObj)) {
              wsKeys.forEach(function(k){ if (wsObj[k]) scriptData.worldSettings[k] = wsObj[k]; });
            }
            renderWorldSettings();
            showToast(label + '生成完成');
            if (typeof autoSave === 'function') autoSave();
            return;
          }
        }

        // 3.4: AI生成前保存撤销点
        if (typeof EditHistory !== 'undefined') EditHistory.push('AI\u751F\u6210 ' + (label || target));
        // 清理AI返回的markdown包装
        var cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        var arr = null;
        var _rawParsed = null; // 保留原始解析结果（可能是包含多个字段的对象）
        // 尝试0：优先用 robustParseJSON（已处理 尾逗号/中文引号/未转义换行符/深度截断恢复）
        if (typeof robustParseJSON === 'function') {
          try {
            var _rp0 = robustParseJSON(cleaned);
            if (Array.isArray(_rp0)) arr = _rp0;
            else if (_rp0 && typeof _rp0 === 'object') {
              _rawParsed = _rp0;
              for (var _rk in _rp0) { if (Array.isArray(_rp0[_rk])) { arr = _rp0[_rk]; break; } }
              if (!arr && _rp0.name) arr = [_rp0];
            }
          } catch(_e0){}
        }
        // 尝试1：直接解析整个响应
        if (!arr) try { var _p = JSON.parse(cleaned); if (Array.isArray(_p)) arr = _p; else if (typeof _p === 'object') { _rawParsed = _p; for (var _wk in _p) { if (Array.isArray(_p[_wk])) { arr = _p[_wk]; break; } } } } catch(e1) {}
        // 尝试2：匹配数组模式 [{...}]
        if (!arr) {
          var m = cleaned.match(/\[\s*\{[\s\S]*\]/);
          if (m) try { arr = JSON.parse(m[0]); } catch(e2) {
            // 尝试修复尾逗号
            try { arr = JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1')); } catch(e2b){}
          }
        }
        // 尝试3：匹配对象模式 {...}（包含子数组）
        if (!arr) {
          var objMatch = cleaned.match(/\{[\s\S]*\}/);
          if (objMatch) {
            try {
              var obj = JSON.parse(objMatch[0]);
              for (var wrapKey in obj) {
                if (Array.isArray(obj[wrapKey])) { arr = obj[wrapKey]; break; }
              }
              // 如果对象本身就是有效数据（非包装），创建单元素数组
              if (!arr && obj.name) arr = [obj];
            } catch(e3) {
              // 尝试修复后再解析
              try {
                var _fx = objMatch[0].replace(/,\s*([}\]])/g, '$1').replace(/\u201c|\u201d/g, '"');
                var obj2 = JSON.parse(_fx);
                for (var wk2 in obj2) { if (Array.isArray(obj2[wk2])) { arr = obj2[wk2]; break; } }
                if (!arr && obj2.name) arr = [obj2];
              } catch(e3b){}
            }
          }
        }
        // 尝试4：截断恢复——从最后一个 "}," 前截，重组为完整数组
        if (!arr) {
          var truncMatch = cleaned.match(/\[\s*\{[\s\S]*?\}(?:\s*,\s*\{[\s\S]*?\})*/);
          if (truncMatch) {
            var truncated = truncMatch[0];
            var lastValid = truncated.lastIndexOf('}');
            if (lastValid > 0) {
              var candidate = truncated.substring(0, lastValid + 1) + ']';
              try { arr = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')); } catch(e4){}
            }
          }
        }
        if (!arr || !Array.isArray(arr)) throw new Error('\u65E0\u6CD5\u89E3\u6790AI\u8FD4\u56DE\u7684JSON\u3002\u539F\u59CB\u54CD\u5E94\uFF1A' + cleaned.substring(0, 300));
        if (target === 'parties') {
          // 确保influence为数字
          arr.forEach(function(p) {
            if (typeof p.influence === 'string') {
              if (/极大|很大|强/.test(p.influence)) p.influence = 80;
              else if (/较大|中等/.test(p.influence)) p.influence = 50;
              else if (/较小|微弱/.test(p.influence)) p.influence = 20;
              else p.influence = parseInt(p.influence) || 50;
            }
            p.influence = parseInt(p.influence) || 50;
          });
          scriptData.parties = (scriptData.parties || []).concat(arr);
          renderParties();
        } else if (target === 'characters') {
          var existingNames = {};
          (scriptData.characters || []).forEach(function(c) { existingNames[c.name] = true; });
          var pi = scriptData.playerInfo || {};
          var added = 0, skipped = 0, updated = 0;
          arr.forEach(function(ch) {
            // 确保数值字段为数字（10维能力+年龄）
            ['loyalty','ambition','intelligence','valor','military','administration','management','charisma','diplomacy','benevolence','age'].forEach(function(f) {
              if (ch[f] !== undefined) ch[f] = parseInt(ch[f]) || (f === 'age' ? 30 : 50);
            });
            if (!ch.loyalty) ch.loyalty = 50;
            if (!ch.ambition) ch.ambition = 50;
            if (!ch.intelligence) ch.intelligence = 50;
            if (!ch.valor) ch.valor = 50;
            if (!ch.military) ch.military = 50;
            if (!ch.administration) ch.administration = 50;
            if (!ch.management) ch.management = 50; // 新增第10维：管理(理财)
            if (!ch.charisma) ch.charisma = 50;
            if (!ch.diplomacy) ch.diplomacy = 50;
            if (!ch.benevolence) ch.benevolence = 50;
            // 特质字段初始化
            if (!Array.isArray(ch.traits)) ch.traits = (typeof ch.traits === 'string' && ch.traits) ? ch.traits.split(/[、，,\/;；]/).map(function(s){return s.trim();}).filter(Boolean) : [];
            // 关系网/作品索引初始化
            if (!ch.relations || typeof ch.relations !== 'object') ch.relations = {};
            if (!Array.isArray(ch.works)) ch.works = [];
            // 将 AI 返回的 initialRelations 转入 presetRelations.npc
            if (Array.isArray(ch.initialRelations) && ch.initialRelations.length > 0) {
              if (!scriptData.presetRelations) scriptData.presetRelations = { npc: [], faction: [] };
              if (!Array.isArray(scriptData.presetRelations.npc)) scriptData.presetRelations.npc = [];
              ch.initialRelations.forEach(function(r) {
                if (!r || !r.to) return;
                scriptData.presetRelations.npc.push({
                  charA: ch.name, charB: r.to,
                  labels: Array.isArray(r.labels) ? r.labels : [],
                  affinity: typeof r.affinity === 'number' ? r.affinity : 50,
                  trust: typeof r.trust === 'number' ? r.trust : 50,
                  respect: typeof r.respect === 'number' ? r.respect : 50,
                  fear: typeof r.fear === 'number' ? r.fear : 0,
                  hostility: typeof r.hostility === 'number' ? r.hostility : 0,
                  conflictLevel: typeof r.conflictLevel === 'number' ? r.conflictLevel : 0
                });
              });
              delete ch.initialRelations;
            }
            if (!ch.familyTier) ch.familyTier = 'common';
            if (!ch.location) ch.location = ''; // 允许空值，开局逻辑审计会补全
            if (ch.spouse === 'true' || ch.spouse === true) ch.spouse = true; else ch.spouse = false;
            // Auto-infer vassalType
            if (ch.officialTitle && !ch.vassalType && typeof inferVassalTypeFromOfficial === 'function') {
              var _ivt = inferVassalTypeFromOfficial(ch.officialTitle);
              ch.vassalType = _ivt ? _ivt.vassalType : '';
            }
            // D2: 势力交叉验证——匹配最接近的已有势力名
            if (ch.faction && scriptData.factions && scriptData.factions.length > 0) {
              var exactMatch = scriptData.factions.some(function(f) { return f.name === ch.faction; });
              if (!exactMatch) {
                // 模糊匹配
                var best = null, bestScore = 0;
                scriptData.factions.forEach(function(f) {
                  if (f.name && ch.faction.indexOf(f.name) >= 0 || f.name.indexOf(ch.faction) >= 0) {
                    var score = Math.min(f.name.length, ch.faction.length);
                    if (score > bestScore) { bestScore = score; best = f.name; }
                  }
                });
                if (best) ch.faction = best;
              }
            }
            // D3: 自动标记玩家角色
            if (pi.characterName && ch.name === pi.characterName) {
              ch.isPlayer = true;
            }
            // D1: 去重——同名角色更新而非重复添加
            if (existingNames[ch.name]) {
              var existIdx = scriptData.characters.findIndex(function(c) { return c.name === ch.name; });
              if (existIdx >= 0) {
                // 保留旧数据中的portrait等用户自定义字段，用AI数据更新其余
                var old = scriptData.characters[existIdx];
                for (var k in ch) { if (ch[k] !== undefined && ch[k] !== '' && k !== 'portrait') old[k] = ch[k]; }
                updated++;
              }
            } else {
              scriptData.characters.push(ch);
              existingNames[ch.name] = true;
              added++;
            }
          });
          renderCharacters();
          showToast('\u89D2\u8272: \u65B0\u589E' + added + ' \u66F4\u65B0' + updated + (skipped ? ' \u8DF3\u8FC7' + skipped : ''));
          // 3.3: 生成后轻量检验
          _postGenValidate('characters');
        } else if (target === 'factions') {
          var existingFacNames = {};
          (scriptData.factions || []).forEach(function(f) { existingFacNames[f.name] = true; });
          var playerFacName = (scriptData.playerInfo || {}).factionName || '';
          var facAdded = 0, facSkipped = 0, facUpdated = 0;
          arr.forEach(function(f) {
            // 确保strength为数字
            if (f.strength && typeof f.strength === 'string') {
              if (f.strength.indexOf('\u5F3A') >= 0) f.strength = 80;
              else if (f.strength.indexOf('\u5F31') >= 0) f.strength = 30;
              else f.strength = parseInt(f.strength) || 50;
            } else {
              f.strength = parseInt(f.strength) || 50;
            }
            if (f.militaryStrength) f.militaryStrength = parseInt(f.militaryStrength) || 10000;
            // 自动分配颜色
            if (!f.color) f.color = '#' + Math.floor((typeof random === 'function' ? random() : Math.random()) * 16777215).toString(16).padStart(6, '0');
            // D4: 过滤掉与玩家势力同名的
            if (playerFacName && f.name === playerFacName) { facSkipped++; return; }
            // 去重——同名势力更新而非跳过
            if (existingFacNames[f.name]) {
              var existFacIdx = scriptData.factions.findIndex(function(ef) { return ef.name === f.name; });
              if (existFacIdx >= 0) {
                var oldFac = scriptData.factions[existFacIdx];
                for (var fk in f) { if (f[fk] !== undefined && f[fk] !== '' && f[fk] !== null) oldFac[fk] = f[fk]; }
                facUpdated++;
              }
              return;
            }
            scriptData.factions.push(f);
            existingFacNames[f.name] = true;
            facAdded++;
          });
          renderFactions();
          showToast('\u52BF\u529B: \u65B0\u589E' + facAdded + ' \u66F4\u65B0' + facUpdated + (facSkipped ? ' \u8DF3\u8FC7' + facSkipped : ''));
          // 3.3: 生成后轻量检验
          _postGenValidate('factions');
        } else if (target === 'classes') {
          // 确保satisfaction和influence为数字
          arr.forEach(function(c) {
            c.satisfaction = parseInt(c.satisfaction) || 50;
            c.influence = parseInt(c.influence || c.classInfluence) || 50;
            delete c.classInfluence; // 统一用influence
          });
          scriptData.classes = scriptData.classes.concat(arr);
          renderClasses();
        } else if (target === 'items') {
          scriptData.items = scriptData.items.concat(arr);
          renderItems();
        } else if (target === 'military') {
          if (!scriptData.military) scriptData.military = {troops:[],facilities:[],organization:[],campaigns:[],initialTroops:[],militarySystem:[]};
          // Try to parse as object with initialTroops/militarySystem
          var parsed = (typeof arr === 'object' && !Array.isArray(arr)) ? arr : null;
          if (parsed && parsed.initialTroops) {
            parsed.initialTroops.forEach(function(a) {
              if (!scriptData.military.initialTroops) scriptData.military.initialTroops = [];
              // Ensure equipment is array
              if (!a.equipment || typeof a.equipment === 'string') a.equipment = [];
              scriptData.military.initialTroops.push(a);
            });
          }
          if (parsed && parsed.militarySystem) {
            parsed.militarySystem.forEach(function(a) {
              if (!scriptData.military.militarySystem) scriptData.military.militarySystem = [];
              scriptData.military.militarySystem.push(a);
            });
          }
          // 合并AI生成的battleConfig（兵种定义、地形修正）
          if (parsed && parsed.battleConfig) {
            if (!scriptData.battleConfig) scriptData.battleConfig = {enabled:true};
            if (parsed.battleConfig.unitTypes && Array.isArray(parsed.battleConfig.unitTypes)) {
              scriptData.battleConfig.unitTypes = parsed.battleConfig.unitTypes;
            }
            if (parsed.battleConfig.terrainModifiers) {
              scriptData.battleConfig.terrainModifiers = parsed.battleConfig.terrainModifiers;
            }
          }
          // Fallback: if arr is array, treat as legacy format
          if (Array.isArray(arr)) {
            arr.forEach(function(a){
              var milCat = (a.category || a.type || '').toLowerCase();
              var milKey = 'troops';
              if (milCat.indexOf('facilit') >= 0 || milCat === '设施' || milCat === '军事设施') milKey = 'facilities';
              else if (milCat.indexOf('org') >= 0 || milCat === '编制' || milCat === '军制' || milCat === '组织') milKey = 'organization';
              else if (milCat.indexOf('campaign') >= 0 || milCat === '战役' || milCat === '战争' || milCat === '军事行动') milKey = 'campaigns';
              else if (milCat === 'initialtroops' || milCat === '初始兵力' || milCat === '部队') {
                if (!a.equipment || typeof a.equipment === 'string') a.equipment = [];
                scriptData.military.initialTroops.push(a); return;
              } else if (milCat === 'militarysystem' || milCat === '兵制' || milCat === '军事制度') {
                scriptData.military.militarySystem.push(a); return;
              }
              scriptData.military[milKey].push(a);
            });
          }
          renderMilitaryNew();
        } else if (target === 'techTree') {
          if (!scriptData.techTree) scriptData.techTree = {military:[],civil:[]};
          arr.forEach(function(a){
            var cat = (a.category === 'civil') ? 'civil' : 'military';
            scriptData.techTree[cat].push(a);
          });
          renderTechTree();
        } else if (target === 'civicTree') {
          if (!scriptData.civicTree) scriptData.civicTree = {city:[],policy:[],resource:[],corruption:[]};
          var validCats = ['city','policy','resource','corruption'];
          arr.forEach(function(a){
            var cat = validCats.indexOf(a.category) >= 0 ? a.category : 'policy';
            scriptData.civicTree[cat].push(a);
          });
          renderCivicTree();
        } else if (target === 'variables_base' || target === 'variables_other' || target === 'variables_formulas') {
          if (!scriptData.variables) scriptData.variables = { base:[], other:[], formulas:[] };
          if (!scriptData.variables.base) scriptData.variables.base = [];
          if (!scriptData.variables.other) scriptData.variables.other = [];
          if (!scriptData.variables.formulas) scriptData.variables.formulas = [];
          var vKey = target === 'variables_base' ? 'base' : target === 'variables_other' ? 'other' : 'formulas';
          arr.forEach(function(a){ scriptData.variables[vKey].push(a); });
          renderVariables();
        } else if (target === 'rules') {
          // 处理rules（可能是对象{rules:[], mechanicsConfig:{}, ...}或纯数组）
          var _rulesObj = _rawParsed || ((typeof arr === 'object' && !Array.isArray(arr)) ? arr : null);
          var _rulesArr = _rulesObj ? (_rulesObj.rules || []) : (Array.isArray(arr) ? arr : []);
          if (!scriptData.rules) scriptData.rules = {base:'',combat:'',economy:'',diplomacy:''};
          _rulesArr.forEach(function(a){
            var cat = ['base','combat','economy','diplomacy'].indexOf(a.category) >= 0 ? a.category : 'base';
            var line = (a.name ? '【' + a.name + '】' : '') + (a.content || a.description || '');
            scriptData.rules[cat] = (scriptData.rules[cat] ? scriptData.rules[cat] + '\n' : '') + line;
          });
          // 合并AI生成的新config
          if (_rulesObj) {
            if (_rulesObj.warConfig) { scriptData.warConfig = _rulesObj.warConfig; }
            if (_rulesObj.diplomacyConfig) { scriptData.diplomacyConfig = _rulesObj.diplomacyConfig; }
            if (_rulesObj.schemeConfig) { scriptData.schemeConfig = _rulesObj.schemeConfig; }
            if (_rulesObj.eventConstraints) { scriptData.eventConstraints = _rulesObj.eventConstraints; }
            if (_rulesObj.chronicleConfig) { scriptData.chronicleConfig = _rulesObj.chronicleConfig; }
            // 阶段1-4新增配置
            if (_rulesObj.mechanicsConfig) {
              if (!scriptData.mechanicsConfig) scriptData.mechanicsConfig = {};
              Object.assign(scriptData.mechanicsConfig, _rulesObj.mechanicsConfig);
            }
            if (_rulesObj.militaryConfig) {
              if (!scriptData.militaryConfig) scriptData.militaryConfig = {};
              Object.assign(scriptData.militaryConfig, _rulesObj.militaryConfig);
            }
          }
          renderRules();
        } else if (target === 'events') {
          if (!scriptData.events) scriptData.events = {historical:[],random:[],conditional:[],story:[],chain:[]};
          var validEvtTypes = ['historical','random','conditional','story','chain'];
          arr.forEach(function(a){
            var t = validEvtTypes.indexOf(a.type) >= 0 ? a.type : 'random';
            scriptData.events[t].push(a);
          });
          renderEvents();
        } else if (target === 'timeline') {
          if (!scriptData.timeline) scriptData.timeline = {past:[],future:[]};
          arr.forEach(function(a){
            var t = a.type === 'future' ? 'future' : 'past';
            scriptData.timeline[t].push(a);
          });
          renderTimeline();
        } else if (target === 'map') {
          if (!scriptData.map) scriptData.map = { items: [] };
          if (!scriptData.map.items) scriptData.map.items = [];
          arr.forEach(function(a){
            if (!a.type || ['city','strategic','geo'].indexOf(a.type) < 0) a.type = 'city';
            scriptData.map.items.push(a);
          });
          renderMap();
        // worldSettings已在上方提前处理，此处跳过
        } else if (target === 'government') {
          if (!scriptData.government) scriptData.government = {name:'',description:'',selectionSystem:'',promotionSystem:'',nodes:[]};
          // AI returns dept tree; each node is a dept with positions[] and subs[]
          function ensureDept(dept) {
            if (!dept.positions) dept.positions = [];
            if (!dept.subs) dept.subs = [];
            if (!dept.functions) dept.functions = [];
            dept.subs.forEach(ensureDept);
          }
          arr.forEach(function(a){ ensureDept(a); scriptData.government.nodes.push(a); });
          renderGovernment();
        } else if (target === 'adminHierarchy') {
          // AI returns admin division tree for current faction
          if (!scriptData.adminHierarchy) scriptData.adminHierarchy = {};
          var factionId = (typeof _currentAdminFactionId !== 'undefined') ? _currentAdminFactionId : 'player';
          if (!scriptData.adminHierarchy[factionId]) {
            var factionName = '未知势力';
            if (factionId === 'player') {
              factionName = '玩家势力';
            } else {
              var faction = scriptData.factions ? scriptData.factions.find(function(f) { return f.id === factionId; }) : null;
              if (faction) factionName = faction.name;
            }
            scriptData.adminHierarchy[factionId] = {
              name: factionName + '行政区划',
              description: factionName + '的行政层级结构',
              divisions: []
            };
          }
          // Ensure each division has required fields
          function ensureDivision(div) {
            if (!div.id) div.id = 'div_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            if (!div.children) div.children = [];
            div.children.forEach(ensureDivision);
          }
          arr.forEach(function(a){ ensureDivision(a); scriptData.adminHierarchy[factionId].divisions.push(a); });
          if (typeof renderAdminTree === 'function') renderAdminTree();
          if (typeof updateAdminStats === 'function') updateAdminStats();
        } else if (target === 'externalForces') {
          if (!scriptData.externalForces) scriptData.externalForces = [];
          arr.forEach(function(a) {
            var exists = scriptData.externalForces.some(function(x) { return x.name === a.name; });
            if (!exists) scriptData.externalForces.push(a);
          });
          if (typeof renderExternalForces === 'function') renderExternalForces();
        } else if (target === 'relations') {
          if (!scriptData.relations) scriptData.relations = [];
          arr.forEach(function(a) {
            var exists = scriptData.relations.some(function(x) { return x.name === a.name; });
            if (!exists) scriptData.relations.push(a);
          });
        } else if (target === 'haremConfig') {
          // haremConfig is an object, not array — handled in the object branch above
          // But if AI returns an array of ranks, handle it here
          if (!scriptData.haremConfig) scriptData.haremConfig = {rankSystem:[], succession:'eldest_legitimate'};
          scriptData.haremConfig.rankSystem = arr;
          if (typeof renderHaremConfig === 'function') renderHaremConfig();
        } else {
          showToast('AI\u8fd4\u56de\u4e86\u6570\u636e\uff0c\u4f46\u8be5\u7c7b\u578b\u6682\u4e0d\u652f\u6301\u81ea\u52a8\u5199\u5165');
          return;
        }
        autoSave();
        showToast('AI\u5df2\u751f\u6210 ' + arr.length + ' \u6761' + label + '\u6761\u76ee');
      } catch(e) {
        showToast('AI\u8fd4\u56de\u5185\u5bb9\u65e0\u6cd5\u89e3\u6790\uff0c\u8bf7\u68c0\u67e5\u63a7\u5236\u53f0');
        console.warn('\u89e3\u6790AI\u8fd4\u56de\u5931\u8d25:', e, raw);
      }
    }).catch(function(e) {
      showToast('\u8c03\u7528AI\u5931\u8d25:' + e.message);
    });
  }

  async function aiGeneratePlayerFaction() {
    // 读取用户指定的玩家势力名称
    var userFactionName = '';
    var aiGenPlayerFactionInput = document.getElementById('aiGenPlayerFaction');
    if (aiGenPlayerFactionInput) {
      userFactionName = aiGenPlayerFactionInput.value.trim();
    }

    var _es = scriptData.eraState || {};
    var context = '剧本名称：' + (scriptData.name || '未命名') + '\n'
      + '剧本概述：' + (scriptData.overview || '无') + '\n'
      + '朝代：' + (scriptData.dynasty || '未知') + '\n'
      + '皇帝：' + (scriptData.emperor || '未知') + '\n'
      + '开始年份：' + (scriptData.gameSettings.startYear || 1) + '\n';
    if (_es.dynastyPhase) context += '朝代阶段：' + _es.dynastyPhase + '\n';
    if (_es.centralControl) context += '集权度：' + Math.round((_es.centralControl||0.5)*100) + '%\n';
    if (_es.legitimacySource) context += '正统来源：' + _es.legitimacySource + '\n';

    var prompt = '你是一个历史剧本设计专家。根据以下剧本背景，为玩家设计一个合适的起始势力：\n\n'
      + context + '\n';

    // 如果用户指定了势力名称，添加到prompt中
    if (userFactionName) {
      prompt += '\n【玩家指定】玩家势力名称必须为：' + userFactionName + '\n\n';
    }

    prompt += '请返回JSON格式，包含以下字段：\n'
      + '{\n'
      + '  "factionName": "势力名称' + (userFactionName ? '（必须是：' + userFactionName + '）' : '') + '",\n'
      + '  "factionType": "势力类型（如：诸侯国、藩镇、起义军等）",\n'
      + '  "factionLeader": "势力领袖姓名",\n'
      + '  "factionLeaderTitle": "领袖头衔",\n'
      + '  "factionTerritory": "控制区域描述",\n'
      + '  "factionStrength": "势力实力评估",\n'
      + '  "factionCulture": "文化特征",\n'
      + '  "factionGoal": "势力目标",\n'
      + '  "factionResources": "资源状况",\n'
      + '  "factionDesc": "势力详细描述（200-300字）"\n'
      + '}\n\n'
      + '注意：\n'
      + '1. 势力设定要符合历史背景和剧本设定\n'
      + '2. 给玩家一个有挑战性但不绝望的起点\n'
      + '3. 描述要具体生动，有代入感';

    // 读取已有玩家势力信息
    var existingContext = '';
    if (scriptData.playerInfo && (scriptData.playerInfo.factionName || scriptData.playerInfo.factionDesc)) {
      var factionInfo = {
        factionName: scriptData.playerInfo.factionName,
        factionType: scriptData.playerInfo.factionType,
        factionLeader: scriptData.playerInfo.factionLeader,
        factionLeaderTitle: scriptData.playerInfo.factionLeaderTitle,
        factionTerritory: scriptData.playerInfo.factionTerritory,
        factionStrength: scriptData.playerInfo.factionStrength,
        factionCulture: scriptData.playerInfo.factionCulture,
        factionGoal: scriptData.playerInfo.factionGoal,
        factionResources: scriptData.playerInfo.factionResources,
        factionDesc: scriptData.playerInfo.factionDesc
      };
      existingContext = '\n\n【已有玩家势力信息】\n' + JSON.stringify(factionInfo, null, 2) + '\n\n请在现有势力信息基础上补充完善，增加更多细节描述。\n';
      prompt += existingContext;
    }

    try {
      showLoading('正在生成玩家势力...');
      var result = await callAIEditor(prompt, 1000);
      var jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');

      var data = JSON.parse(jsonMatch[0]);
      if (!scriptData.playerInfo) scriptData.playerInfo = {};

      scriptData.playerInfo.factionName = data.factionName || '';
      scriptData.playerInfo.factionType = data.factionType || '';
      scriptData.playerInfo.factionLeader = data.factionLeader || '';
      scriptData.playerInfo.factionLeaderTitle = data.factionLeaderTitle || '';
      scriptData.playerInfo.factionTerritory = data.factionTerritory || '';
      scriptData.playerInfo.factionStrength = data.factionStrength || '';
      scriptData.playerInfo.factionCulture = data.factionCulture || '';
      scriptData.playerInfo.factionGoal = data.factionGoal || '';
      scriptData.playerInfo.factionResources = data.factionResources || '';
      scriptData.playerInfo.factionDesc = data.factionDesc || '';

      // 同步到主势力数组（避免孤立数据）
      if (data.factionName && scriptData.factions) {
        var existFac = scriptData.factions.find(function(f) { return f.name === data.factionName; });
        if (!existFac) {
          scriptData.factions.push({
            name: data.factionName, type: data.factionType || 'core',
            leader: data.factionLeader || '', leaderTitle: data.factionLeaderTitle || '',
            territory: data.factionTerritory || '', strength: data.factionStrength || '',
            attitude: '', resources: data.factionResources || '',
            culture: data.factionCulture || '', goal: data.factionGoal || '',
            description: data.factionDesc || '',
            color: '#' + Math.floor((typeof random === 'function' ? random() : Math.random()) * 16777215).toString(16).padStart(6, '0')
          });
        }
      }

      renderPlayerOverview();
      if (typeof renderFactions === 'function') renderFactions();
      hideLoading();
      showToast('玩家势力生成成功！');
    } catch(e) {
      hideLoading();
      alert('生成失败：' + e.message);
    }
  }

  async function aiGeneratePlayerCharacter() {
    // 读取用户指定的玩家角色名称
    var userCharacterName = '';
    var aiGenPlayerCharacterInput = document.getElementById('aiGenPlayerCharacter');
    if (aiGenPlayerCharacterInput) {
      userCharacterName = aiGenPlayerCharacterInput.value.trim();
    }

    var pi = scriptData.playerInfo || {};
    var context = '剧本名称：' + (scriptData.name || '未命名') + '\n'
      + '剧本概述：' + (scriptData.overview || '无') + '\n'
      + '朝代：' + (scriptData.dynasty || '未知') + '\n'
      + '玩家势力：' + (pi.factionName || '未设定') + '\n'
      + '势力类型：' + (pi.factionType || '未设定') + '\n';

    var prompt = '你是一个历史剧本设计专家。根据以下背景，为玩家设计一个合适的起始角色：\n\n'
      + context + '\n';

    // 如果用户指定了角色名称，添加到prompt中
    if (userCharacterName) {
      prompt += '\n【玩家指定】玩家角色姓名必须为：' + userCharacterName + '\n\n';
    }

    prompt += '请返回JSON格式，包含以下字段：\n'
      + '{\n'
      + '  "characterName": "角色姓名' + (userCharacterName ? '（必须是：' + userCharacterName + '）' : '') + '",\n'
      + '  "characterTitle": "角色头衔/官职",\n'
      + '  "characterFaction": "所属势力",\n'
      + '  "characterAge": "具体年龄数字",\n'
      + '  "characterGender": "性别",\n'
      + '  "characterPersonality": "性格特征关键词",\n'
      + '  "characterFaith": "信仰",\n'
      + '  "characterCulture": "文化背景",\n'
      + '  "characterBio": "人物生平简介（150-250字，基于史实）",\n'
      + '  "characterDesc": "身份地位与处境描述（100-150字）",\n'
      + '  "characterAppearance": "纯外貌描写（30-50字，如面如冠玉，剑眉星目）",\n'
      + '  "characterCharisma": "魅力值0-100",\n'
      + '  "loyalty": "忠诚0-100", "ambition": "野心0-100",\n'
      + '  "intelligence": "智谋0-100", "valor": "武勇(个人武力)0-100",\n'
      + '  "military": "军事(统兵指挥)0-100", "benevolence": "仁德0-100", "administration": "治政0-100"\n'
      + '}\n\n'
      + '注意：\n'
      + '1. 角色必须符合历史背景——史实人物的数值必须反映历史评价\n'
      + '2. valor=个人武力, military=统兵能力(两者不同!) 如诸葛亮→military:95,valor:25; 吕布→valor:99,military:55\n'
      + '3. 性格要有特点，有优点也有缺点\n'
      + '4. 外貌描写必须是纯视觉描述，不含性格';

    // 读取已有玩家角色信息
    var existingContext = '';
    if (scriptData.playerInfo && (scriptData.playerInfo.characterName || scriptData.playerInfo.characterDesc)) {
      var characterInfo = {
        characterName: scriptData.playerInfo.characterName,
        characterTitle: scriptData.playerInfo.characterTitle,
        characterFaction: scriptData.playerInfo.characterFaction,
        characterAge: scriptData.playerInfo.characterAge,
        characterGender: scriptData.playerInfo.characterGender,
        characterPersonality: scriptData.playerInfo.characterPersonality,
        characterFaith: scriptData.playerInfo.characterFaith,
        characterCulture: scriptData.playerInfo.characterCulture,
        characterBio: scriptData.playerInfo.characterBio,
        characterDesc: scriptData.playerInfo.characterDesc
      };
      existingContext = '\n\n【已有玩家角色信息】\n' + JSON.stringify(characterInfo, null, 2) + '\n\n请在现有角色信息基础上补充完善，增加更多细节描述。\n';
      prompt += existingContext;
    }

    try {
      showLoading('正在生成玩家角色...');
      var result = await callAIEditor(prompt, 1000);
      var jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('无法解析AI返回的JSON');

      var data = JSON.parse(jsonMatch[0]);
      if (!scriptData.playerInfo) scriptData.playerInfo = {};

      scriptData.playerInfo.characterName = data.characterName || '';
      scriptData.playerInfo.characterTitle = data.characterTitle || '';
      scriptData.playerInfo.characterFaction = data.characterFaction || '';
      scriptData.playerInfo.characterAge = data.characterAge || '';
      scriptData.playerInfo.characterGender = data.characterGender || '';
      scriptData.playerInfo.characterPersonality = data.characterPersonality || '';
      scriptData.playerInfo.characterFaith = data.characterFaith || '';
      scriptData.playerInfo.characterCulture = data.characterCulture || '';
      scriptData.playerInfo.characterBio = data.characterBio || '';
      scriptData.playerInfo.characterDesc = data.characterDesc || '';
      scriptData.playerInfo.characterAppearance = data.characterAppearance || '';
      scriptData.playerInfo.characterCharisma = data.characterCharisma || '';

      // B2: 领袖即玩家时自动同步
      if (scriptData.playerInfo.leaderIsPlayer !== false) {
        scriptData.playerInfo.factionLeader = data.characterName || '';
        scriptData.playerInfo.factionLeaderTitle = data.characterTitle || '';
      }

      // 同步到主角色数组（使用AI返回的六维数值）
      if (data.characterName && scriptData.characters) {
        var existChr = scriptData.characters.find(function(ch) { return ch.name === data.characterName; });
        var chrData = {
          name: data.characterName, type: 'historical', title: data.characterTitle || '',
          faction: data.characterFaction || scriptData.playerInfo.factionName || '',
          role: '玩家角色', bio: data.characterBio || '', desc: data.characterDesc || '',
          age: data.characterAge || '', gender: data.characterGender || '男',
          personality: data.characterPersonality || '',
          faith: data.characterFaith || '', culture: data.characterCulture || '',
          appearance: data.characterAppearance || '',
          charisma: parseInt(data.characterCharisma) || 60,
          diplomacy: parseInt(data.characterDiplomacy) || 50,
          loyalty: parseInt(data.loyalty) || 100,
          ambition: parseInt(data.ambition) || 50,
          benevolence: parseInt(data.benevolence) || 50,
          intelligence: parseInt(data.intelligence) || 70,
          valor: parseInt(data.valor) || 60,
          military: parseInt(data.military) || 50,
          administration: parseInt(data.administration) || 60,
          isPlayer: true
        };
        if (existChr) { for (var k in chrData) { if (chrData[k] !== '' && chrData[k] !== 0) existChr[k] = chrData[k]; } }
        else { scriptData.characters.push(chrData); }
      }

      renderPlayerOverview();
      if (typeof renderCharacters === 'function') renderCharacters();
      hideLoading();
      showToast('玩家角色生成成功！');
    } catch(e) {
      hideLoading();
      alert('生成失败：' + e.message);
    }
  }

  function callAIEditor(prompt, maxTok) {
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) { console.warn('[editor] API配置解析失败:', e.message); }
    var key = cfg.key || '';
    var url = (cfg.url || '').replace(/\/+$/, '');
    var model = cfg.model || 'gpt-4o';
    if (!key) return Promise.reject(new Error('API Key\u672a\u914d\u7f6e\uff0c\u8bf7\u5148\u5728\u8bbe\u7f6e\u9762\u677f\u4e2d\u914d\u7f6eAPI'));
    if (!url) return Promise.reject(new Error('API\u5730\u5740\u672a\u914d\u7f6e'));
    // Auto-detect provider by URL
    var isAnthropic = url.indexOf('anthropic.com') >= 0 || url.indexOf('api.anthropic') >= 0;
    var endpoint, headers, body;
    if (isAnthropic) {
      // Anthropic Messages API
      if (url.indexOf('/messages') < 0) endpoint = url + '/v1/messages';
      else endpoint = url;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      };
      body = JSON.stringify({
        model: model,
        max_tokens: maxTok || 2000,
        messages: [{role: 'user', content: prompt}]
      });
    } else {
      // OpenAI-compatible
      if (url.indexOf('/chat/completions') < 0 && url.indexOf('/messages') < 0) endpoint = url + '/chat/completions';
      else endpoint = url;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      };
      body = JSON.stringify({
        model: model,
        messages: [{role: 'user', content: prompt}],
        temperature: 0.8,
        max_tokens: maxTok || 2000
      });
    }
    return fetch(endpoint, {method: 'POST', headers: headers, body: body})
      .then(function(r) {
        if (!r.ok) return r.text().then(function(t) {
          throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200));
        });
        return r.json();
      }).then(function(data) {
        if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content;
        if (data.content && Array.isArray(data.content)) return data.content.map(function(b){return b.text||'';}).join('');
        return '';
      });
  }

// ============================================================
// 多轮深化生成 — 官制
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
      } catch (e0) { console.warn('[GovGen P0]', e0); }
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
      } catch (e1) { console.warn('[GovGen P1]', e1); }
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
        } catch(e) { console.warn('[GovGen P2]', e); }
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
      } catch(e3) { console.warn('[GovGen P3]', e3); }
    } else if (vacantSecondary.length > 0) {
      showToast('官制生成完成（' + vacantSecondary.length + '次要职位留作占位，运行时按需生成）');
    }

    showToast('官制生成完成！' + nodes.length + '个部门，' + totalPos + '个官职，' + (vacantSecondary.length + Math.max(0,vacantMain.length)) + '个占位');
  } catch(e) { showToast('官制生成失败: ' + e.message); console.error('[GovGen]', e); }
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
        try { var o2 = JSON.parse(r2.match(/\{[\s\S]*\}/)[0]); Object.keys(o2).forEach(function(pn) { var par = divs.find(function(d) { return d.name === pn; }); if (par && Array.isArray(o2[pn])) { o2[pn].forEach(function(ch) { ensD(ch); if (!_allNames[ch.name]) { par.children.push(ch); _allNames[ch.name] = true; } }); } }); } catch(e) { console.warn('[AdminGen P2]', e); }
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
        } catch(e) { console.warn('[AdminGen P3]', e); }
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
        } catch(e4) { console.warn('[AdminGen P4]', e4); }
      }
    }

    if (typeof renderAdminTree === 'function') renderAdminTree();
    if (typeof updateAdminStats === 'function') updateAdminStats();
    autoSave();
    var tc = 0; (function cnt(l) { l.forEach(function(d) { tc++; if (d.children) cnt(d.children); }); })(divs);
    showToast('行政区划多轮生成完成！共' + tc + '个行政单位');
  } catch(e) { showToast('\u884C\u653F\u533A\u5212\u751F\u6210\u5931\u8D25: ' + e.message); console.error('[AdminGen]', e); }
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
  } catch(e) { showToast('失败: ' + e.message); console.error('[aiGenFiscal]', e); }
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
  } catch(e) { showToast('失败: ' + e.message); console.error('[aiGenPop]', e); }
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
  } catch(e) { showToast('失败: ' + e.message); console.error('[aiGenEnv]', e); }
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
  } catch(e) { showToast('失败: ' + e.message); console.error('[aiGenAuth]', e); }
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
  } catch(e) { showToast('润色失败: ' + e.message); console.error('[aiPolish]', e); }
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

