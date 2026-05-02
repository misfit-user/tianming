// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-char-full-schema.js — 角色完整字段 Schema
 *
 * 统一管理 UI/编辑器/AI/存档 四方都认识的字段。
 *
 * 三大导出：
 *  - CharFullSchema.ensureFullFields(ch)  幂等补齐所有字段
 *  - CharFullSchema.SCHEMA                字段元数据（供编辑器生成 UI）
 *  - CharFullSchema.toAIContext(ch)       角色自我认识（注入 AI 上下文）
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  字段 SCHEMA — 供编辑器自动生成表单 + 文档化
  // ═══════════════════════════════════════════════════════════════════

  var SCHEMA = [
    // 身份基础
    { key: 'name',            group: '身份', type: 'text',   label: '姓名',       default: '' },
    { key: 'zi',              group: '身份', type: 'text',   label: '字',         default: '', hint: '表字，如"子直""玄德"' },
    { key: 'haoName',         group: '身份', type: 'text',   label: '号',         default: '', hint: '别号，如"东堤居士"' },
    { key: 'gender',          group: '身份', type: 'select', label: '性别',       default: '男', options: [{v:'男',l:'男'},{v:'女',l:'女'}] },
    { key: 'age',             group: '身份', type: 'number', label: '年龄',       default: 30, min: 0, max: 120 },
    { key: 'portrait',        group: '身份', type: 'text',   label: '立绘路径',    default: '' },
    { key: 'appearance',      group: '身份', type: 'textarea', label: '外貌',     default: '' },
    { key: 'role',            group: '身份', type: 'text',   label: '身份',       default: '' },
    { key: 'occupation',      group: '身份', type: 'text',   label: '职业',       default: '' },
    { key: 'birthplace',      group: '身份', type: 'text',   label: '籍贯',       default: '' },
    { key: 'ethnicity',       group: '身份', type: 'text',   label: '民族',       default: '汉' },
    { key: 'faith',           group: '身份', type: 'text',   label: '信仰',       default: '儒' },
    { key: 'culture',         group: '身份', type: 'text',   label: '文化',       default: '' },
    { key: 'learning',        group: '身份', type: 'text',   label: '学识',       default: '', hint: '进士/秀才/生员/白身 等' },
    { key: 'diction',         group: '身份', type: 'text',   label: '辞令',       default: '', hint: '说话风格，如"清隽""凝重""刁钻"' },
    // 官职
    { key: 'title',           group: '官职', type: 'text',   label: '称谓',       default: '' },
    { key: 'officialTitle',   group: '官职', type: 'text',   label: '官职',       default: '' },
    { key: 'rankLevel',       group: '官职', type: 'number', label: '品级(1-18)', default: 9, min: 1, max: 18 },
    { key: 'faction',         group: '官职', type: 'text',   label: '势力',       default: '朝廷' },
    { key: 'party',           group: '官职', type: 'text',   label: '党派',       default: '' },
    { key: 'partyRank',       group: '官职', type: 'text',   label: '党内位阶',   default: '' },
    { key: 'stance',          group: '官职', type: 'text',   label: '政治立场',   default: '', hint: '改革/保守/中立' },
    { key: 'location',        group: '官职', type: 'text',   label: '所在地',     default: '' },
    { key: 'superior',        group: '官职', type: 'text',   label: '上司',       default: '' },
    { key: 'officeDuties',    group: '官职', type: 'textarea', label: '职事描述',default: '' },
    { key: 'concurrentTitle', group: '官职', type: 'text',   label: '兼衔',       default: '' },
    // 心性（核心二维 + 八才）
    { key: 'loyalty',         group: '心性', type: 'number', label: '忠诚',       default: 50, min: 0, max: 100 },
    { key: 'ambition',        group: '心性', type: 'number', label: '野心',       default: 50, min: 0, max: 100 },
    { key: 'intelligence',    group: '八才', type: 'number', label: '智力',       default: 50, min: 0, max: 100 },
    { key: 'valor',           group: '八才', type: 'number', label: '武勇',       default: 50, min: 0, max: 100 },
    { key: 'military',        group: '八才', type: 'number', label: '军事',       default: 50, min: 0, max: 100 },
    { key: 'administration',  group: '八才', type: 'number', label: '政务',       default: 50, min: 0, max: 100 },
    { key: 'management',      group: '八才', type: 'number', label: '管理',       default: 50, min: 0, max: 100 },
    { key: 'charisma',        group: '八才', type: 'number', label: '魅力',       default: 50, min: 0, max: 100 },
    { key: 'diplomacy',       group: '八才', type: 'number', label: '外交',       default: 50, min: 0, max: 100 },
    { key: 'benevolence',     group: '八才', type: 'number', label: '仁厚',       default: 50, min: 0, max: 100 },
    // 人脉
    { key: 'mentor',          group: '人脉', type: 'text',   label: '师承',       default: '' },
    { key: 'friends',         group: '人脉', type: 'textarea', label: '好友',     default: '', hint: '以逗号分隔' },
    { key: 'hobbies',         group: '人脉', type: 'textarea', label: '爱好',     default: '', hint: '以逗号分隔' },
    { key: 'playerRelation',  group: '人脉', type: 'text',   label: '与君主关系', default: '' },
    // 家族
    { key: 'family',          group: '家族', type: 'text',   label: '家族',       default: '' },
    { key: 'familyTier',      group: '家族', type: 'select', label: '门第',       default: 'common', options: [{v:'imperial',l:'皇族'},{v:'noble',l:'世家'},{v:'gentry',l:'士族'},{v:'common',l:'寒门'}] },
    { key: 'familyRole',      group: '家族', type: 'text',   label: '家中身份',   default: '', hint: '如"长子""庶出"' },
    { key: 'clanPrestige',    group: '家族', type: 'number', label: '族望',       default: 50, min: 0, max: 100 },
    { key: 'familyMembers',   group: '家族', type: 'members', label: '家族成员',  default: [] },
    // 心绪
    { key: 'personality',     group: '心绪', type: 'textarea', label: '性格',     default: '' },
    { key: 'innerThought',    group: '心绪', type: 'textarea', label: '内心独白', default: '', hint: '当前最萦绕的心事，推演可改写' },
    { key: 'stressSources',   group: '心绪', type: 'lines',  label: '压力源',     default: [], hint: '每行一条，推演可增删' },
    { key: 'personalGoal',    group: '心绪', type: 'textarea', label: '个人志向',default: '' },
    // 仕途
    { key: 'career',          group: '仕途', type: 'career', label: '仕途履历',   default: [] }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  ensureFullFields — 幂等补齐（绝不覆盖已有值）
  // ═══════════════════════════════════════════════════════════════════

  function ensureFullFields(ch) {
    if (!ch || typeof ch !== 'object') return ch;

    // 1. 标量/字段默认值
    SCHEMA.forEach(function(s) {
      if (ch[s.key] === undefined || ch[s.key] === null) {
        if (Array.isArray(s.default)) ch[s.key] = s.default.slice();
        else if (typeof s.default === 'object' && s.default !== null) ch[s.key] = JSON.parse(JSON.stringify(s.default));
        else ch[s.key] = s.default;
      }
    });

    // 1b. gender 规范化·英文 male/female → 中文 男/女（全库 UI 一致）
    if (ch.gender === 'male') ch.gender = '男';
    else if (ch.gender === 'female') ch.gender = '女';
    // 未设置或无法识别时·据 isFemale/spouse/后宫字段推断
    if (!ch.gender || (ch.gender !== '男' && ch.gender !== '女')) {
      if (ch.isFemale === true || ch.spouseRank || ch._isConsort) ch.gender = '女';
      else ch.gender = '男';
    }

    // 2. 字 courtesyName 兼容（旧字段）
    if (!ch.zi && ch.courtesyName) ch.zi = ch.courtesyName;
    if (!ch.courtesyName && ch.zi) ch.courtesyName = ch.zi;

    // 3. 资源结构——若 CharEconEngine 存在则使用其初始化
    if (typeof global.CharEconEngine !== 'undefined' && typeof global.CharEconEngine.ensureCharResources === 'function') {
      try { global.CharEconEngine.ensureCharResources(ch); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-char-full-schema');}catch(_){}}
    } else {
      if (!ch.resources) ch.resources = {};
      var r = ch.resources;
      if (!r.publicPurse) r.publicPurse = { money: 0, grain: 0, cloth: 0 };
      if (!r.privateWealth) r.privateWealth = { money: 0, grain: 0, cloth: 0 };
      if (r.fame === undefined) r.fame = 0;
      if (r.virtueMerit === undefined) r.virtueMerit = 0;
      if (r.health === undefined) r.health = 80;
      if (r.stress === undefined) r.stress = 20;
    }

    // 4. 数组字段规范
    if (!Array.isArray(ch.familyMembers)) ch.familyMembers = [];
    if (!Array.isArray(ch.career)) ch.career = [];
    if (!Array.isArray(ch.stressSources)) ch.stressSources = [];
    if (!Array.isArray(ch.traitIds)) ch.traitIds = [];
    if (ch.partyRef === undefined || ch.partyRef === null || typeof ch.partyRef !== 'object') ch.partyRef = null;
    if (ch.factionRef === undefined || ch.factionRef === null || typeof ch.factionRef !== 'object') ch.factionRef = null;
    if (ch.officeRef === undefined || ch.officeRef === null || typeof ch.officeRef !== 'object') ch.officeRef = null;
    if (ch.lastInteractionMemory === undefined || ch.lastInteractionMemory === null || typeof ch.lastInteractionMemory !== 'object') {
      ch.lastInteractionMemory = null;
    }
    if (!ch.recognitionState || typeof ch.recognitionState !== 'object') {
      ch.recognitionState = {
        subject: '',
        familiarity: 0,
        level: '陌生',
        lastTurn: 0,
        lastEvent: '',
        lastEmotion: '平',
        lastType: 'general',
        lastSource: '',
        lastWho: '',
        summary: '',
        history: []
      };
    } else {
      if (ch.recognitionState.subject === undefined || ch.recognitionState.subject === null) ch.recognitionState.subject = '';
      if (ch.recognitionState.familiarity === undefined || ch.recognitionState.familiarity === null) ch.recognitionState.familiarity = 0;
      if (!ch.recognitionState.level) ch.recognitionState.level = '陌生';
      if (ch.recognitionState.lastTurn === undefined || ch.recognitionState.lastTurn === null) ch.recognitionState.lastTurn = 0;
      if (ch.recognitionState.lastEvent === undefined || ch.recognitionState.lastEvent === null) ch.recognitionState.lastEvent = '';
      if (ch.recognitionState.lastEmotion === undefined || ch.recognitionState.lastEmotion === null) ch.recognitionState.lastEmotion = '平';
      if (ch.recognitionState.lastType === undefined || ch.recognitionState.lastType === null) ch.recognitionState.lastType = 'general';
      if (ch.recognitionState.lastSource === undefined || ch.recognitionState.lastSource === null) ch.recognitionState.lastSource = '';
      if (ch.recognitionState.lastWho === undefined || ch.recognitionState.lastWho === null) ch.recognitionState.lastWho = '';
      if (ch.recognitionState.summary === undefined || ch.recognitionState.summary === null) ch.recognitionState.summary = '';
      if (!Array.isArray(ch.recognitionState.history)) ch.recognitionState.history = [];
    }

    // 5. 压力/健康字段冗余同步（UI 兼容两处读取）
    if (ch.resources) {
      if (ch.stress === undefined) ch.stress = ch.resources.stress;
      if (ch.health === undefined) ch.health = ch.resources.health;
      if (ch.resources.stress === undefined) ch.resources.stress = ch.stress;
      if (ch.resources.health === undefined) ch.resources.health = ch.health;
    }

    return ch;
  }

  /** 批量补齐（供 enterGame 调用） */
  function ensureAll(chars) {
    if (!Array.isArray(chars)) return 0;
    var n = 0;
    chars.forEach(function(ch) { if (ch) { ensureFullFields(ch); n++; } });
    return n;
  }

  function _recognitionLevelLabel(familiarity) {
    familiarity = Math.max(0, Math.min(100, Math.round(Number(familiarity) || 0)));
    if (familiarity >= 85) return '知己';
    if (familiarity >= 65) return '熟识';
    if (familiarity >= 35) return '眼熟';
    if (familiarity >= 10) return '略识';
    return '陌生';
  }

  function describeLastInteractionMemory(mem) {
    if (!mem || typeof mem !== 'object') return '';
    var parts = [];
    if (mem.turn) parts.push('T' + mem.turn);
    if (mem.subject || mem.who) parts.push('对' + String(mem.subject || mem.who || '').slice(0, 24));
    if (mem.event) parts.push(String(mem.event).slice(0, 42));
    if (mem.emotion) parts.push('[' + String(mem.emotion).slice(0, 8) + ']');
    return parts.join('·');
  }

  function describeRecognitionState(state) {
    if (!state || typeof state !== 'object') return '';
    var parts = [];
    if (state.level) parts.push(String(state.level).slice(0, 8));
    if (state.subject) parts.push('对' + String(state.subject).slice(0, 24));
    if (typeof state.familiarity === 'number') parts.push(Math.round(state.familiarity) + '/100');
    if (state.lastEvent) parts.push(String(state.lastEvent).slice(0, 24));
    return parts.join('·');
  }

  function syncInteractionMemory(ch, memEntry, relatedPerson) {
    if (!ch || typeof ch !== 'object') return null;
    ensureFullFields(ch);
    var src = memEntry || {};
    var subject = String(relatedPerson || src.subject || src.target || src.who || '').trim();
    var snapshot = {
      turn: typeof src.turn === 'number' ? src.turn : (global.GM && typeof global.GM.turn === 'number' ? global.GM.turn : 0),
      event: String(src.event || '').slice(0, 120),
      emotion: String(src.emotion || '平').slice(0, 12) || '平',
      importance: Math.max(0.1, Math.min(10, Number(src.importance || 5))),
      who: String(src.who || relatedPerson || '').slice(0, 60),
      type: String(src.type || 'general').slice(0, 24) || 'general',
      source: String(src.source || 'witnessed').slice(0, 24) || 'witnessed',
      credibility: (src.credibility != null) ? Math.max(0, Math.min(100, Number(src.credibility))) : 95,
      arcId: String(src.arcId || '').slice(0, 60),
      participants: Array.isArray(src.participants) ? src.participants.slice(0, 8) : [],
      location: String(src.location || '').slice(0, 60),
      subject: subject,
      summary: String(src.summary || src.event || '').slice(0, 80)
    };
    ch.lastInteractionMemory = snapshot;

    var rs = ch.recognitionState;
    if (!rs || typeof rs !== 'object') rs = {};
    if (!subject && rs.subject) subject = rs.subject;
    if (subject) {
      if (rs.subject && rs.subject !== subject) {
        rs.familiarity = Math.max(0, Math.round((Number(rs.familiarity) || 0) * 0.55));
      }
      rs.subject = subject;
    } else if (rs.subject === undefined || rs.subject === null) {
      rs.subject = '';
    }
    var familiarity = Number(rs.familiarity) || 0;
    var sameSubject = !!subject && rs.subject === subject;
    var delta = Math.max(1, Math.round(snapshot.importance * 2));
    if (snapshot.type === 'dialogue') delta += 2;
    else if (snapshot.type === 'kindness' || snapshot.type === 'promotion') delta += 3;
    else if (snapshot.type === 'betrayal' || snapshot.type === 'humiliation' || snapshot.type === 'loss' || snapshot.type === 'military') delta += 4;
    if (snapshot.emotion === '喜' || snapshot.emotion === '敬') delta += 2;
    if (snapshot.emotion === '怒' || snapshot.emotion === '恨' || snapshot.emotion === '惧') delta += 2;
    familiarity = sameSubject ? familiarity + delta : Math.max(familiarity, delta);
    rs.familiarity = Math.max(0, Math.min(100, Math.round(familiarity)));
    rs.level = _recognitionLevelLabel(rs.familiarity);
    rs.lastTurn = snapshot.turn || rs.lastTurn || 0;
    rs.lastEvent = snapshot.event || rs.lastEvent || '';
    rs.lastEmotion = snapshot.emotion || rs.lastEmotion || '平';
    rs.lastType = snapshot.type || rs.lastType || 'general';
    rs.lastSource = snapshot.source || rs.lastSource || 'witnessed';
    rs.lastWho = snapshot.who || rs.lastWho || '';
    rs.summary = snapshot.summary || rs.summary || '';
    if (!Array.isArray(rs.history)) rs.history = [];
    rs.history.push({
      turn: snapshot.turn || 0,
      subject: rs.subject || '',
      level: rs.level,
      event: snapshot.summary,
      emotion: snapshot.emotion
    });
    if (rs.history.length > 8) rs.history = rs.history.slice(-8);
    ch.recognitionState = rs;
    return snapshot;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 自我认识——注入到 AI 提示上下文
  // ═══════════════════════════════════════════════════════════════════

  function toAIContext(ch) {
    if (!ch) return '';
    ensureFullFields(ch);
    var lines = [];
    // 名与字
    var nameLine = '【我是' + (ch.name || '') + '】';
    if (ch.zi) nameLine += '，字' + ch.zi;
    if (ch.haoName) nameLine += '，号' + ch.haoName;
    if (ch.gender === 'female' || ch.gender === '女' || ch.isFemale === true) nameLine += '（女）';
    if (ch.age) nameLine += '，今年' + ch.age + '岁';
    lines.push(nameLine);
    // 出身
    var origin = [];
    if (ch.birthplace) origin.push('籍贯' + ch.birthplace);
    if (ch.family) origin.push('出身' + ch.family + (ch.familyTier ? '·' + ({imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'}[ch.familyTier]||'') : ''));
    if (ch.learning) origin.push('学识' + ch.learning);
    if (origin.length) lines.push('出身：' + origin.join('；'));
    // 官位
    var office = [];
    if (ch.officialTitle) office.push(ch.officialTitle);
    if (ch.rankLevel) office.push('品级' + ch.rankLevel);
    if (ch.faction) office.push('隶属' + ch.faction);
    if (ch.party) office.push('党派' + ch.party + (ch.partyRank ? '(' + ch.partyRank + ')' : ''));
    if (ch.stance) office.push('立场' + ch.stance);
    if (office.length) lines.push('我在任：' + office.join('；'));
    if (ch.location) lines.push('现居' + ch.location + (ch._travelTo ? '，正往' + ch._travelTo : ''));
    // 家中
    if (ch.familyMembers && ch.familyMembers.length > 0) {
      var fm = ch.familyMembers.slice(0, 8).map(function(m) {
        return (m.relation || '亲') + (m.name || '') + (m.dead ? '(已故)' : (m.age ? '(' + m.age + '岁)' : ''));
      }).join('；');
      lines.push('家中：' + fm);
    }
    if (ch.mentor) lines.push('师承：' + ch.mentor);
    if (ch.friends) lines.push('旧友：' + (Array.isArray(ch.friends) ? ch.friends.join('、') : ch.friends));
    if (ch.hobbies) lines.push('所好：' + (Array.isArray(ch.hobbies) ? ch.hobbies.join('、') : ch.hobbies));
    // 仕途近事
    if (ch.career && ch.career.length > 0) {
      var recent = ch.career.slice(-3).map(function(c) {
        return (c.date || '某时') + '：' + (c.title || c.event || '');
      }).join('；');
      lines.push('近年仕途：' + recent);
    }
    if (ch.lastInteractionMemory) {
      var lim = describeLastInteractionMemory(ch.lastInteractionMemory);
      if (lim) lines.push('最近一次互动：' + lim + (ch.lastInteractionMemory.location ? '·' + ch.lastInteractionMemory.location : ''));
    }
    if (ch.recognitionState && (ch.recognitionState.level || ch.recognitionState.subject || ch.recognitionState.lastEvent)) {
      var rec = describeRecognitionState(ch.recognitionState);
      if (rec) lines.push('认知状态：' + rec);
    }
    // 心事
    if (ch.personalGoal) lines.push('我所求：' + ch.personalGoal);
    if (ch.innerThought) lines.push('心中所思：' + ch.innerThought);
    if (ch.stressSources && ch.stressSources.length > 0) {
      lines.push('当下困扰：' + ch.stressSources.join('；'));
    }
    if (typeof ch.stress === 'number' && ch.stress > 50) {
      lines.push('压力已' + (ch.stress > 80 ? '将崩' : ch.stress > 60 ? '沉重' : '渐增') + '(' + Math.round(ch.stress) + '/100)');
    }
    // 资源自知
    if (ch.resources) {
      var r = ch.resources;
      var pw = r.privateWealth || {};
      var pub = r.publicPurse || r.publicTreasury || {};
      var purse = [];
      if (pw.money) purse.push('私财钱' + _fmtNum(pw.money) + '贯');
      if (pw.cash) purse.push('私财钱' + _fmtNum(pw.cash) + '贯');
      if (pw.grain) purse.push('粮' + _fmtNum(pw.grain) + '石');
      if (pub.balance || pub.money) purse.push('掌公库' + _fmtNum(pub.balance || pub.money) + '贯');
      if (r.fame > 10) purse.push('有清誉' + Math.round(r.fame));
      else if (r.fame < -10) purse.push('有恶名' + Math.round(r.fame));
      if (purse.length) lines.push('家私：' + purse.join('，'));
    }
    return lines.join('\n');
  }

  function _fmtNum(v) {
    v = Math.abs(v||0);
    if (v >= 10000) return (v/10000).toFixed(1) + '万';
    if (v >= 1000) return (v/1000).toFixed(1) + '千';
    return Math.round(v);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EvolveTick — 每回合推演：生成/更新 innerThought/stressSources/career
  // ═══════════════════════════════════════════════════════════════════

  function evolveTick(ch, mr) {
    if (!ch || ch.alive === false) return;
    ensureFullFields(ch);
    mr = mr || 1;

    // 1. stressSources 随事态动态更新（每回合重扫描）
    var newSources = [];
    // 债务
    if (ch.resources && ch.resources.privateWealth) {
      var money = ch.resources.privateWealth.money || 0;
      if (money < 0) newSources.push('家中负债 ' + _fmtNum(Math.abs(money)) + ' 贯');
    }
    // 公库亏空
    if (ch.resources && ch.resources.publicTreasury && ch.resources.publicTreasury.balance < 0) {
      newSources.push('公库亏空 ' + _fmtNum(Math.abs(ch.resources.publicTreasury.balance)) + ' 贯');
    }
    // 健康低
    if ((ch.health||80) < 40) newSources.push('病痛缠身');
    // 忠诚压力（被怀疑）
    if (typeof global.GM !== 'undefined' && global.GM.player && global.GM.player.suspicionOf && global.GM.player.suspicionOf[ch.name] > 40) {
      newSources.push('恐被君主猜忌');
    }
    // 名望低（丢面子）
    if (ch.resources && ch.resources.fame < -30) newSources.push('名声渐败');
    // 无官无职（志向未达）
    if (!ch.officialTitle && ch.ambition > 60) newSources.push('抱负无处可施');
    // 从记忆里抽取负面事件
    if (ch._memory && ch._memory.length > 0) {
      var recent = ch._memory.slice(-5);
      recent.forEach(function(m) {
        if (m.emotion === '忧' || m.emotion === '怒' || m.emotion === '恨') {
          var key = '〔' + m.emotion + '〕' + (m.event || '').slice(0, 18);
          if (newSources.indexOf(key) < 0 && newSources.length < 6) newSources.push(key);
        }
      });
    }
    ch.stressSources = newSources;

    // 2. innerThought 生成（基于当前最紧迫心事）
    //    若 AI 系统已设置则不覆盖（AI 对话中生成的优先）
    if (!ch._innerThoughtLocked || !ch.innerThought) {
      if (ch.stressSources.length > 0 && ch.personalGoal) {
        ch.innerThought = '志在' + ch.personalGoal.slice(0, 20) + (ch.personalGoal.length > 20 ? '……' : '') +
          '，奈何' + ch.stressSources[0] + '，夜不能寐。';
      } else if (ch.stressSources.length > 0) {
        ch.innerThought = ch.stressSources[0] + '，萦绕心头，难以释怀。';
      } else if (ch.personalGoal) {
        ch.innerThought = '今诸事渐顺，' + ch.personalGoal.slice(0, 24) + '，可期矣。';
      } else {
        ch.innerThought = '';
      }
    }

    // 3. 家族成员年龄推进（按剧本 daysPerTurn，年龄按年 mr 近似）
    if (Array.isArray(ch.familyMembers)) {
      ch.familyMembers.forEach(function(m) {
        if (!m.dead && typeof m.age === 'number') {
          m._ageAccumulator = (m._ageAccumulator || 0) + mr / 12;
          while (m._ageAccumulator >= 1) { m.age += 1; m._ageAccumulator -= 1; }
          // 老死机率
          if (m.age > 70 && Math.random() < 0.002 * mr) {
            m.dead = true;
          }
        }
      });
    }

    // 4. clanPrestige 缓慢联动（fame 高则族望升）
    if (ch.resources && typeof ch.resources.fame === 'number') {
      var target = Math.max(0, Math.min(100, 50 + ch.resources.fame * 0.3 + (ch.rankLevel ? (19 - ch.rankLevel) * 2 : 0)));
      ch.clanPrestige = (ch.clanPrestige * 0.97 + target * 0.03);
    }
  }

  /** 职务变动时追加 career 条目 */
  function recordCareerEvent(ch, date, title, desc, milestone) {
    if (!ch) return;
    ensureFullFields(ch);
    ch.career.push({
      date: date || (typeof global.GM !== 'undefined' ? (global.GM.date || '第' + global.GM.turn + '回') : '某时'),
      title: title || '',
      desc: desc || '',
      milestone: !!milestone,
      turn: typeof global.GM !== 'undefined' ? global.GM.turn : 0
    });
    // 上限 40 条
    if (ch.career.length > 40) ch.career.splice(0, ch.career.length - 40);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.CharFullSchema = {
    SCHEMA: SCHEMA,
    ensureFullFields: ensureFullFields,
    ensureAll: ensureAll,
    syncInteractionMemory: syncInteractionMemory,
    describeLastInteractionMemory: describeLastInteractionMemory,
    describeRecognitionState: describeRecognitionState,
    toAIContext: toAIContext,
    evolveTick: evolveTick,
    recordCareerEvent: recordCareerEvent,
    VERSION: 2
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
