// @ts-check
// ============================================================
// tm-recall-gate.js — SC_RECALL 召回节流门控（2026-04-30 P10.4A）
//
// 设计来源：KokoroMemo retrieval_gate.py
//   "不要每轮都搜向量库——用关键词+置信度+周期混合判断"
//
// 当前问题：每回合 sc05 都跑 5 源 SC_RECALL（NPC/Chronicle/Shiji/Foreshadow/Vector）
//   - NPC/Chronicle/Shiji/Foreshadow 是关键词正则·便宜（毫秒级）
//   - Vector 是 onnx 推理·每查询 ~50-100ms·5 个查询 = 250-500ms
//   - 累积到长游戏 100 回合·CPU 时间是显著开销
//
// 触发条件（OR）：
//   1. 新游戏首回合（GM.turn <= 1）
//   2. AI 思考输出含触发关键词："前朝/旧诏/先帝/上回/卷宗/史载/曾经/此前"等
//   3. 每 6 回合周期刷新（GM.turn % 6 === 0）
//   4. 玩家本回合下了重大诏令（_thisTurnEdicts 非空）·新政可能与旧档冲突
//   5. 上回合发生重要事件（_aiMemory 最新条目 importance >= 7 或含"死亡/政变/即位/退位"）
//
// 不触发时·SC_RECALL 5 源全部跳过·sc05 仅靠 _recentHistory + sc_consolidate 摘要进入 sc1。
// ============================================================

(function(global) {
  'use strict';

  // KokoroMemo 触发关键词中文化为天命语境
  var TRIGGER_PATTERNS = [
    // AI 主动溯源
    '前朝', '旧诏', '先帝', '上回', '上次', '此前', '曾经', '当年', '昔日',
    // 史书检索
    '卷宗', '史载', '记载', '典故', '故例', '旧例', '据载', '据查',
    // 重大事件标记
    '死亡', '政变', '叛乱', '即位', '退位', '驾崩', '禅让', '弑',
    '签订', '废止', '颁布', '改元', '尊号'
  ];

  var STATE = {
    skippedCount: 0,
    triggeredCount: 0,
    lastTriggerReason: ''
  };

  /**
   * 判断本回合是否应跑 SC_RECALL 5 源召回
   * @param {object} ctx - { aiThinking, currentEdicts, lastImportance }
   * @returns {object} { shouldRecall: boolean, reason: string }
   */
  function shouldRecall(ctx) {
    ctx = ctx || {};
    if (typeof GM === 'undefined' || !GM) return { shouldRecall: true, reason: 'GM 未就绪·默认开' };

    // 玩家可禁用（默认开启节流）
    if (typeof P !== 'undefined' && P && P.conf && P.conf.recallGateEnabled === false) {
      return { shouldRecall: true, reason: 'gate disabled by player' };
    }

    // 1. 新游戏首回合
    if ((GM.turn || 0) <= 1) {
      return { shouldRecall: true, reason: '新游戏首回合' };
    }

    // 2. AI 思考触发关键字（aiThinking 文本搜索）
    if (ctx.aiThinking && typeof ctx.aiThinking === 'string') {
      var t = ctx.aiThinking;
      for (var i = 0; i < TRIGGER_PATTERNS.length; i++) {
        if (t.indexOf(TRIGGER_PATTERNS[i]) >= 0) {
          return { shouldRecall: true, reason: 'AI 触发词:' + TRIGGER_PATTERNS[i] };
        }
      }
    }

    // 3. 周期刷新（每 6 回合）
    if ((GM.turn || 0) % 6 === 0) {
      return { shouldRecall: true, reason: '6 回合周期刷新' };
    }

    // 4. 玩家本回合下了重大诏令（数量 >= 3 或某条 > 100 字）
    if (ctx.currentEdicts && typeof ctx.currentEdicts === 'object') {
      var totalLen = 0, hasLong = false;
      Object.keys(ctx.currentEdicts).forEach(function(k) {
        var v = ctx.currentEdicts[k];
        if (typeof v === 'string') {
          totalLen += v.length;
          if (v.length > 100) hasLong = true;
        }
      });
      if (hasLong || totalLen > 200) {
        return { shouldRecall: true, reason: '玩家重大诏令·可能与旧档冲突' };
      }
    }

    // 5. 上回合有 importance>=7 的重要记忆
    if (Array.isArray(GM._aiMemory) && GM._aiMemory.length > 0) {
      var lastMem = GM._aiMemory[GM._aiMemory.length - 1];
      if (lastMem && typeof lastMem.importance === 'number' && lastMem.importance >= 7) {
        return { shouldRecall: true, reason: '上回合 importance≥7' };
      }
      // 文本中含重大事件词
      if (lastMem && typeof lastMem.content === 'string') {
        var heavyWords = ['死亡', '政变', '即位', '退位', '驾崩', '叛乱', '弑', '签订', '废止'];
        for (var j = 0; j < heavyWords.length; j++) {
          if (lastMem.content.indexOf(heavyWords[j]) >= 0) {
            return { shouldRecall: true, reason: '上回合重大事件:' + heavyWords[j] };
          }
        }
      }
    }

    // 6. P13.5 confidence 阈值（KokoroMemo retrieval_gate.py:60-63 范式）
    //   上回合 eventHistory 表存在 weight<0.65 的低置信度事件 → AI 对自己不确定的事·应回看历史确认
    if (typeof MemTables !== 'undefined' && MemTables && MemTables.getSheet) {
      try {
        var ehSheet = MemTables.getSheet('eventHistory');
        if (ehSheet && Array.isArray(ehSheet.rows)) {
          var lastTurnEvts = ehSheet.rows.filter(function(r) {
            var rTurn = parseInt(r[1], 10) || 0;
            return rTurn === (GM.turn || 1) - 1;
          });
          if (lastTurnEvts.length > 0) {
            // 任一事件 weight<0.65 即触发（低置信度·需要历史佐证）
            var hasLowConf = lastTurnEvts.some(function(r) {
              var w = parseFloat(r[3]);
              return !isNaN(w) && w > 0 && w < 0.65;
            });
            if (hasLowConf) {
              return { shouldRecall: true, reason: '上回合存在低置信度(weight<0.65)事件·需历史回看确认' };
            }
          }
        }
      } catch(_ehE){}
    }

    // 默认：跳过
    return { shouldRecall: false, reason: '常规回合·跳过节流·节省 5 源开销' };
  }

  /**
   * 记录决策结果（统计用）
   */
  function record(decision) {
    if (decision && decision.shouldRecall) {
      STATE.triggeredCount++;
      STATE.lastTriggerReason = decision.reason;
    } else {
      STATE.skippedCount++;
    }
  }

  function status() {
    return {
      skipped: STATE.skippedCount,
      triggered: STATE.triggeredCount,
      hitRate: STATE.triggeredCount / Math.max(1, STATE.skippedCount + STATE.triggeredCount),
      lastReason: STATE.lastTriggerReason
    };
  }

  // 暴露
  global.RecallGate = {
    shouldRecall: shouldRecall,
    record: record,
    status: status,
    TRIGGER_PATTERNS: TRIGGER_PATTERNS
  };
})(typeof window !== 'undefined' ? window : this);
