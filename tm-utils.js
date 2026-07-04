// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   工具函数（最早加载层之一·暴露 TM.errors / TM.safeEval / TM.loyalty / findCharByName 等）
//   §1 ErrorMonitor   8.6 · R114 降级为 TM.errors 兼容 shim
//   §2 safeEval       受限表达式求值（替代 new Function 直评）
//   §3 RNG            确定性随机（seedrandom）· 子种子工厂 · 每回合 RNG 检查点（存档重放）
//   §4 时间换算       机械系统统一以「月」为基准·运行时按回合时长缩放
//   §5 其他           NotificationSystem · NpcMemorySystem · loyalty 调整 · _dbg*
// ─────────────────────────────────────────────
// ============================================================
//  工具函数
// ============================================================
var _$=function(id){return document.getElementById(id);};

// ============================================================
//  8.6 ErrorMonitor · R114 (2026-04-24) 降级为 TM.errors 的兼容 shim
//
//  唯一的错误系统现在是 TM.errors (tm-diagnostics-foundation.js)，它已注册
//  window.onerror / unhandledrejection / 资源加载错误 三套监听。
//  ErrorMonitor 保留原 API (capture / getLog / exportText / clear / count)
//  供既有 caller (tm-game-engine.js 错误日志导出按钮) 继续工作。
//  新代码一律使用 TM.errors.capture()/getLog()。
// ============================================================
var ErrorMonitor = (function() {
  function _tm() { return (typeof window !== 'undefined' && window.TM && window.TM.errors) || null; }

  function capture(type, message, stack) {
    var tm = _tm();
    if (tm) {
      // 构造伪 Error 对象喂给 TM.errors.capture
      var err = { message: String(message || ''), stack: String(stack || '') };
      tm.capture(err, 'errmon:' + (type || 'error'));
      // 同步到 GM._errorLog 老字段（既有代码可能读取）
      if (typeof GM !== 'undefined') GM._errorLog = getLog();
    } else {
      console.warn('[ErrorMonitor·no-TM]', type, message);
    }
  }

  // TM.errors 条目 → ErrorMonitor 老格式 {ts, turn, type, message, stack}
  function _toLegacy(e) {
    var mod = String(e.module || '');
    var type = mod.indexOf('errmon:') === 0 ? mod.slice(7) : (mod || 'error');
    return {
      ts: e.t || Date.now(),
      turn: e.turn || 0,
      type: type,
      message: (e.error && e.error.message) || '',
      stack: (e.error && e.error.stack) || ''
    };
  }

  function getLog() {
    var tm = _tm();
    if (!tm) return [];
    return tm.getLog().map(_toLegacy);
  }

  function exportText() {
    var log = getLog();
    if (log.length === 0) return '无错误记录';
    return '天命错误日志 (' + log.length + '条)\n' + log.map(function(e) {
      return '[T' + e.turn + ' ' + new Date(e.ts).toLocaleTimeString() + '] ' + e.type + ': ' + e.message;
    }).join('\n');
  }

  function clear() {
    var tm = _tm();
    if (tm) tm.clear();
    if (typeof GM !== 'undefined') GM._errorLog = [];
  }

  function count() { return getLog().length; }

  return { capture: capture, getLog: getLog, exportText: exportText, clear: clear, count: count };
})();

// ============================================================
//  TM.safeEval · 受限表达式求值（白名单解释器·替代 new Function 直评）
//
//  现有 5 处调用用于评估编辑器规则与 AI 生成的条件表达式
//  （couplingRules.if / collapseRules.condition / restorationRules.condition /
//   legitimacyConfig.rules[].condition / goal custom condition）。
//  内部规则可信，但用户导入第三方剧本时表达式不可信——旧实现用
//  正则黑名单 + new Function，可被字符串拼接绕过：
//    GM['cons'+'tructor']['cons'+'tructor']('alert(1)')()
//    []['fill']['constr'+'uctor']('...')()
//  逃出沙箱执行任意 JS（外发 AI key、调 Electron IPC）。
//
//  本实现彻底放弃 new Function/eval，改为零依赖白名单表达式解释器：
//    tokenizer → Pratt parser → 白名单 AST 解释器。
//  ─ 只支持剧本规则实际用到的语法：比较/逻辑/算术/一元 ! 与负号/三元 ?:/
//    成员访问 a.b 与 a["b"]/字面量(数字 字符串 布尔 null)/括号/
//    白名单函数调用(Math.max 等)。
//  ─ 成员访问经 readMember 守卫：禁 __proto__/constructor/prototype 等危险键、
//    禁原型链(仅读自有属性)、绝不接触 Function/eval/全局对象。
//  ─ 根标识符只能解析自 ctx 白名单键，未知标识符抛错(语义同 ReferenceError)。
//  对外接口 TM.safeEval(expr, ctx) 签名 / 「失败抛 Error 由 caller try/catch」
//  语义保持不变·5 个调用点零改动。
//
//  核心解释器(_TM_safeEvalCore)在 node 下也可被 require/测试；
//  仅在浏览器把它挂到 window.TM.safeEval。见 web/tools/test-safeeval.js。
// ============================================================
(function(global){
  'use strict';

  // ── 词法 token 类型 ──
  var T_NUM = 'num', T_STR = 'str', T_ID = 'id', T_PUNC = 'punc', T_EOF = 'eof';

  // 危险属性键黑名单（成员访问层最后一道闸·与解析无关·防原型逃逸）
  // 注意：不能用对象字面量写 '__proto__':1（那会设原型而非创建自有键）·
  // 用 null 原型 map + 逐个赋值·确保 hasKey('__proto__') 真的命中。
  var DANGEROUS_KEYS = Object.create(null);
  ['__proto__', 'constructor', 'prototype',
   '__defineGetter__', '__defineSetter__',
   '__lookupGetter__', '__lookupSetter__', 'valueOf'].forEach(function (k) {
    DANGEROUS_KEYS[k] = 1;
  });
  function isDangerousKey(keyStr) {
    // 显式判 __proto__·再查 map（map 已是 null 原型·hasOwnProperty 安全）
    return keyStr === '__proto__' || Object.prototype.hasOwnProperty.call(DANGEROUS_KEYS, keyStr);
  }

  // 白名单纯函数：Math.*（这些是无副作用纯函数·剧本算术里偶尔会用）
  var SAFE_MATH = {
    max: Math.max, min: Math.min, abs: Math.abs, floor: Math.floor,
    ceil: Math.ceil, round: Math.round, pow: Math.pow, sqrt: Math.sqrt,
    sign: Math.sign, trunc: Math.trunc
  };
  // 白名单方法名（仅在字符串/数组这类安全宿主上放行·只读不改）
  var SAFE_METHODS = { includes: 1, indexOf: 1, startsWith: 1, endsWith: 1 };

  // ───────────────────────── Tokenizer ─────────────────────────
  function tokenize(src) {
    var toks = [];
    var i = 0, n = src.length;
    function isDigit(c){ return c >= '0' && c <= '9'; }
    // 标识符首字符：字母 / _ / $ / 非 ASCII（含中文变量名 如 民生压力）
    function isIdStart(c){
      return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
             c === '_' || c === '$' || c.charCodeAt(0) > 0x7f;
    }
    function isIdPart(c){ return isIdStart(c) || isDigit(c); }

    while (i < n) {
      var c = src[i];
      // 跳空白
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
      // 数字（含小数 与 .5 形式）
      if (isDigit(c) || (c === '.' && isDigit(src[i+1]))) {
        var startN = i;
        while (i < n && isDigit(src[i])) i++;
        if (src[i] === '.') { i++; while (i < n && isDigit(src[i])) i++; }
        if (src[i] === 'e' || src[i] === 'E') {
          i++; if (src[i] === '+' || src[i] === '-') i++;
          while (i < n && isDigit(src[i])) i++;
        }
        toks.push({ t: T_NUM, v: parseFloat(src.slice(startN, i)) });
        continue;
      }
      // 字符串（单/双引号·支持基本转义）
      if (c === '"' || c === "'") {
        var quote = c; i++; var buf = '';
        while (i < n && src[i] !== quote) {
          if (src[i] === '\\') {
            i++;
            var e = src[i];
            if (e === 'n') buf += '\n';
            else if (e === 't') buf += '\t';
            else if (e === 'r') buf += '\r';
            else if (e === '\\') buf += '\\';
            else if (e === '"') buf += '"';
            else if (e === "'") buf += "'";
            else if (e === '0') buf += '\0';
            else buf += e; // 其余转义按字面字符
            i++;
          } else {
            buf += src[i]; i++;
          }
        }
        if (i >= n) throw new Error('safeEval: unterminated string');
        i++; // 吃掉结束引号
        toks.push({ t: T_STR, v: buf });
        continue;
      }
      // 标识符 / 关键字字面量
      if (isIdStart(c)) {
        var startI = i;
        while (i < n && isIdPart(src[i])) i++;
        toks.push({ t: T_ID, v: src.slice(startI, i) });
        continue;
      }
      // 运算符 / 标点（先匹配三字符·再两字符·再单字符）
      var three = src.substr(i, 3);
      if (three === '===' || three === '!==') { toks.push({ t: T_PUNC, v: three }); i += 3; continue; }
      var two = src.substr(i, 2);
      if (two === '==' || two === '!=' || two === '>=' || two === '<=' ||
          two === '&&' || two === '||') { toks.push({ t: T_PUNC, v: two }); i += 2; continue; }
      if ('+-*/%<>!?:.()[],'.indexOf(c) >= 0) { toks.push({ t: T_PUNC, v: c }); i++; continue; }
      throw new Error('safeEval: unexpected character ' + JSON.stringify(c) + ' at ' + i);
    }
    toks.push({ t: T_EOF, v: null });
    return toks;
  }

  // ───────────────────────── Parser (Pratt) ─────────────────────────
  // AST 节点形态：
  //   {k:'num'|'str', v}            字面量数字/字符串
  //   {k:'lit', v}                  true/false/null（已固化为 JS 值）
  //   {k:'id', name}                根标识符
  //   {k:'member', obj, prop}       a.b（prop 为字符串名）
  //   {k:'index', obj, idx}         a[expr]
  //   {k:'call', callee, args}      f(...)
  //   {k:'unary', op, arg}          ! / - / +
  //   {k:'bin', op, l, r}           二元运算
  //   {k:'logic', op, l, r}         && / ||（短路）
  //   {k:'cond', test, cons, alt}   三元 ?:
  function parse(toks) {
    var pos = 0;
    function peek(){ return toks[pos]; }
    function next(){ return toks[pos++]; }
    function isPunc(v){ var t = peek(); return t.t === T_PUNC && t.v === v; }
    function expectPunc(v){
      if (!isPunc(v)) throw new Error('safeEval: expected ' + JSON.stringify(v) + ' but got ' + JSON.stringify(peek().v));
      return next();
    }

    // 二元运算符优先级（数字越大越先结合）·仅含采样到的运算符
    var BIN_PREC = {
      '||': 1, '&&': 2,
      '==': 3, '!=': 3, '===': 3, '!==': 3,
      '<': 4, '>': 4, '<=': 4, '>=': 4,
      '+': 5, '-': 5,
      '*': 6, '/': 6, '%': 6
    };
    var LOGIC = { '||': 1, '&&': 1 };

    function parseExpression(){ return parseTernary(); }

    function parseTernary(){
      var test = parseBinary(0);
      if (isPunc('?')) {
        next();
        var cons = parseAssignSafe();
        expectPunc(':');
        var alt = parseAssignSafe();
        return { k: 'cond', test: test, cons: cons, alt: alt };
      }
      return test;
    }
    // 三元分支内允许再嵌套三元，但不允许赋值（本语言无赋值）
    function parseAssignSafe(){ return parseTernary(); }

    function parseBinary(minPrec){
      var left = parseUnary();
      while (true) {
        var tk = peek();
        if (tk.t !== T_PUNC) break;
        var prec = BIN_PREC[tk.v];
        if (prec === undefined || prec < minPrec) break;
        next();
        var right = parseBinary(prec + 1); // 全部左结合
        if (LOGIC[tk.v]) left = { k: 'logic', op: tk.v, l: left, r: right };
        else left = { k: 'bin', op: tk.v, l: left, r: right };
      }
      return left;
    }

    function parseUnary(){
      var tk = peek();
      if (tk.t === T_PUNC && (tk.v === '!' || tk.v === '-' || tk.v === '+')) {
        next();
        return { k: 'unary', op: tk.v, arg: parseUnary() };
      }
      return parsePostfix();
    }

    function parsePostfix(){
      var node = parsePrimary();
      while (true) {
        if (isPunc('.')) {
          next();
          var nameTok = next();
          if (nameTok.t !== T_ID) throw new Error('safeEval: expected property name after "."');
          node = { k: 'member', obj: node, prop: nameTok.v };
        } else if (isPunc('[')) {
          next();
          var idx = parseExpression();
          expectPunc(']');
          node = { k: 'index', obj: node, idx: idx };
        } else if (isPunc('(')) {
          next();
          var args = [];
          if (!isPunc(')')) {
            args.push(parseExpression());
            while (isPunc(',')) { next(); args.push(parseExpression()); }
          }
          expectPunc(')');
          node = { k: 'call', callee: node, args: args };
        } else {
          break;
        }
      }
      return node;
    }

    function parsePrimary(){
      var tk = peek();
      if (tk.t === T_NUM) { next(); return { k: 'num', v: tk.v }; }
      if (tk.t === T_STR) { next(); return { k: 'str', v: tk.v }; }
      if (tk.t === T_ID) {
        next();
        if (tk.v === 'true') return { k: 'lit', v: true };
        if (tk.v === 'false') return { k: 'lit', v: false };
        if (tk.v === 'null') return { k: 'lit', v: null };
        if (tk.v === 'undefined') return { k: 'lit', v: undefined };
        // 显式封禁危险根标识符（即使 ctx 没有也不应被当成变量名解析）
        if (tk.v === 'this' || tk.v === 'globalThis' || tk.v === 'window' ||
            tk.v === 'self' || tk.v === 'global' || tk.v === 'Function' ||
            tk.v === 'eval' || tk.v === 'Reflect' || tk.v === 'Proxy' ||
            tk.v === 'Symbol' || tk.v === 'require' || tk.v === 'process' ||
            tk.v === 'import') {
          throw new Error('safeEval: forbidden identifier "' + tk.v + '"');
        }
        return { k: 'id', name: tk.v };
      }
      if (isPunc('(')) {
        next();
        var e = parseExpression();
        expectPunc(')');
        return e;
      }
      throw new Error('safeEval: unexpected token ' + JSON.stringify(tk.v));
    }

    var ast = parseExpression();
    if (peek().t !== T_EOF) throw new Error('safeEval: unexpected trailing token ' + JSON.stringify(peek().v));
    return ast;
  }

  // ───────────────────────── Evaluator ─────────────────────────
  // 成员读取守卫：禁危险键 / 禁原型链 / 禁函数对象属性穿透
  function readMember(obj, key) {
    if (obj === null || obj === undefined) {
      throw new Error('safeEval: cannot read property "' + key + '" of ' + obj);
    }
    var keyStr = String(key);
    if (isDangerousKey(keyStr)) {
      throw new Error('safeEval: access to "' + keyStr + '" is forbidden');
    }
    // 绝不允许把函数当容器穿透其属性（.call/.apply/.bind/.constructor 等）
    if (typeof obj === 'function') {
      throw new Error('safeEval: cannot access properties of a function');
    }
    var t = typeof obj;
    // 字符串：放行只读的 length 与白名单方法
    if (t === 'string') {
      if (keyStr === 'length') return obj.length;
      if (Object.prototype.hasOwnProperty.call(SAFE_METHODS, keyStr)) return obj[keyStr].bind(obj);
      throw new Error('safeEval: forbidden string property "' + keyStr + '"');
    }
    if (t === 'number' || t === 'boolean') {
      throw new Error('safeEval: cannot access property "' + keyStr + '" of ' + t);
    }
    // 数组：length / 数字下标 / 白名单方法
    if (Array.isArray(obj)) {
      if (keyStr === 'length') return obj.length;
      if (Object.prototype.hasOwnProperty.call(SAFE_METHODS, keyStr)) return obj[keyStr].bind(obj);
      if (/^\d+$/.test(keyStr)) return obj[keyStr];
      // 其余（非自有 / 原型方法）一律拒绝
      if (Object.prototype.hasOwnProperty.call(obj, keyStr)) return obj[keyStr];
      throw new Error('safeEval: forbidden array property "' + keyStr + '"');
    }
    // 普通对象：仅读「自有属性」·不走原型链
    if (Object.prototype.hasOwnProperty.call(obj, keyStr)) {
      return obj[keyStr];
    }
    // 自有不存在 → 返回 undefined（与 JS 取不存在属性一致·便于 a.b===undefined 这类判空）
    return undefined;
  }

  function evalNode(node, ctx) {
    switch (node.k) {
      case 'num': return node.v;
      case 'str': return node.v;
      case 'lit': return node.v;
      case 'id': {
        if (ctx && Object.prototype.hasOwnProperty.call(ctx, node.name)) return ctx[node.name];
        // 未在白名单上下文中 → 同 new Function 下的 ReferenceError 语义
        throw new Error('safeEval: ' + node.name + ' is not defined');
      }
      case 'member': {
        var obj = evalNode(node.obj, ctx);
        return readMember(obj, node.prop);
      }
      case 'index': {
        var o = evalNode(node.obj, ctx);
        var idx = evalNode(node.idx, ctx);
        if (typeof idx !== 'string' && typeof idx !== 'number') {
          throw new Error('safeEval: index must be string or number');
        }
        return readMember(o, idx);
      }
      case 'unary': {
        var a = evalNode(node.arg, ctx);
        if (node.op === '!') return !a;
        if (node.op === '-') return -a;
        if (node.op === '+') return +a;
        throw new Error('safeEval: bad unary op');
      }
      case 'logic': {
        if (node.op === '&&') { var lv = evalNode(node.l, ctx); return lv ? evalNode(node.r, ctx) : lv; }
        if (node.op === '||') { var lv2 = evalNode(node.l, ctx); return lv2 ? lv2 : evalNode(node.r, ctx); }
        throw new Error('safeEval: bad logic op');
      }
      case 'cond': {
        return evalNode(node.test, ctx) ? evalNode(node.cons, ctx) : evalNode(node.alt, ctx);
      }
      case 'bin': {
        var l = evalNode(node.l, ctx), r = evalNode(node.r, ctx);
        switch (node.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
          case '%': return l % r;
          case '<': return l < r;
          case '>': return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          case '==': return l == r;   // 宽松比较·与旧 new Function 行为一致
          case '!=': return l != r;
          case '===': return l === r;
          case '!==': return l !== r;
        }
        throw new Error('safeEval: bad binary op ' + node.op);
      }
      case 'call': {
        // 仅放行白名单调用：Math.<fn>(...) 与 安全宿主上的白名单只读方法
        var callee = node.callee;
        var fn, thisArg = undefined;
        if (callee.k === 'member' && callee.obj.k === 'id' && callee.obj.name === 'Math' &&
            !(ctx && Object.prototype.hasOwnProperty.call(ctx, 'Math'))) {
          // Math.* —— 仅当 ctx 未自定义 Math 时才认作内置数学函数
          if (!Object.prototype.hasOwnProperty.call(SAFE_MATH, callee.prop)) {
            throw new Error('safeEval: Math.' + callee.prop + ' is not allowed');
          }
          fn = SAFE_MATH[callee.prop];
        } else if (callee.k === 'member' || callee.k === 'index') {
          // 形如 str.includes(...) / arr.indexOf(...)·经 readMember 守卫取出已 bind 的方法
          var propName = callee.k === 'member' ? callee.prop : evalNode(callee.idx, ctx);
          if (!Object.prototype.hasOwnProperty.call(SAFE_METHODS, String(propName))) {
            throw new Error('safeEval: method "' + propName + '" is not allowed');
          }
          var host = evalNode(callee.obj, ctx);
          fn = readMember(host, propName); // 返回 bind 过的安全方法
        } else {
          throw new Error('safeEval: only whitelisted function calls are allowed');
        }
        if (typeof fn !== 'function') throw new Error('safeEval: callee is not a function');
        var args = node.args.map(function(a){ return evalNode(a, ctx); });
        return fn.apply(thisArg, args);
      }
    }
    throw new Error('safeEval: unknown node ' + (node && node.k));
  }

  // ── 核心入口（node 下亦可调用·供测试）──
  function safeEvalCore(expr, ctx) {
    if (typeof expr !== 'string') throw new Error('safeEval: expr must be string');
    var ast = parse(tokenize(expr));
    return evalNode(ast, ctx || null);
  }

  // node/测试环境：导出核心 + 内部件（便于单元测试 tokenizer/parser）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      safeEval: safeEvalCore,
      _tokenize: tokenize,
      _parse: parse,
      _evalNode: evalNode
    };
  }
  // 同时暴露到全局核心引用（浏览器与 node 都可见·不依赖 window）
  if (global && !global._TM_safeEvalCore) global._TM_safeEvalCore = safeEvalCore;

  // 浏览器：仅在此把核心挂到 window.TM.safeEval（保持原对外接口与语义）
  if (typeof window !== 'undefined') {
    if (!window.TM) window.TM = {};
    if (!window.TM.safeEval) window.TM.safeEval = safeEvalCore;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

// 核心指标显示名映射——动态从剧本 P.variables 读取（标记 isCore=true 的变量）
// 引擎不硬编码任何指标名，全由编辑器定义。以下仅为兜底（无剧本加载时）。
var CORE_METRIC_LABELS = {};
/**
 * 从剧本变量列表构建核心指标映射
 * 编辑器中可为变量标记 isCore:true，引擎据此在 Delta 面板/左面板展示
 * 所有指标标签完全由剧本编辑器的 isCore/displayName 决定
 */
function buildCoreMetricLabels() {
  CORE_METRIC_LABELS = {};
  // 剧本隔离根治：优先用当前局 GM.vars(每局按 sid 建·权威)·不读 set-once/跨剧本不可靠的 P.variables 库。
  var _allVars = (typeof _tmActiveVars === 'function') ? _tmActiveVars() : [];
  if (!_allVars.length) {
    if (typeof P === 'undefined' || !P.variables) return;
    if (Array.isArray(P.variables)) _allVars = P.variables;
    else if (typeof P.variables === 'object') _allVars = (P.variables.base || []).concat(P.variables.other || []);
  }
  // 从变量列表中收集标记为核心的变量
  _allVars.forEach(function(v) {
    if (v && v.isCore && v.name) {
      CORE_METRIC_LABELS[v.name] = v.displayName || v.name;
    }
  });
}
// 剧本编辑参考（核心变量由剧本编辑器配置 isCore 标记）：
//   部落联盟：{ name:'authority', displayName:'威信', isCore:true }
//             { name:'tribalUnity', displayName:'部落凝聚', isCore:true }
// 2.6: 通知分级系统——闪现/驻留/紧急 三级
var NotificationSystem = (function() {
  var _history = [];
  var MAX_HISTORY = 50;

  function _record(level, msg) {
    _history.push({level:level, msg:msg, time:Date.now(), turn:typeof GM!=='undefined'?GM.turn:0});
    if (_history.length > MAX_HISTORY) _history.shift();
  }

  return {
    /** 获取通知历史 */
    getHistory: function() { return _history; },
    /** 清空历史 */
    clearHistory: function() { _history = []; },

    /** 闪现提示(2s自动消失) —— 日常操作反馈 */
    flash: function(msg) {
      _record('flash', msg);
      var t = _$("toast"); if (!t) return;
      t.textContent = msg;
      t.className = 'toast-flash show';
      setTimeout(function(){ t.classList.remove("show"); }, 2200);
    },

    /** 驻留提示(需手动关闭) —— 成就/里程碑/重要NPC事件 */
    persist: function(msg, icon) {
      _record('persist', msg);
      var el = document.createElement('div');
      el.className = 'notify-persist show';
      var _safeIcon = icon ? (typeof escHtml==='function'?escHtml(icon):icon) : '';
      el.innerHTML = '<div class="notify-persist-body">' +
        (_safeIcon ? '<span class="notify-icon">' + _safeIcon + '</span>' : '') +
        '<span class="notify-text">' + (typeof escHtml==='function'?escHtml(msg):msg) + '</span>' +
        '<button class="notify-close" onclick="this.parentElement.parentElement.classList.remove(\'show\');setTimeout(function(){this.parentElement.parentElement.remove()}.bind(this),300);">\u2715</button>' +
        '</div>';
      var container = _$('notify-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'notify-container';
        document.body.appendChild(container);
      }
      container.appendChild(el);
    },

    /** 紧急警告(全屏遮罩，必须确认) —— 战争/死亡/灭亡 */
    urgent: function(title, detail, onConfirm) {
      _record('urgent', title + (detail ? ': ' + detail : ''));
      var overlay = document.createElement('div');
      overlay.className = 'notify-urgent';
      overlay.innerHTML = '<div class="notify-urgent-box">' +
        '<div class="notify-urgent-title">' + (typeof escHtml==='function'?escHtml(title):title) + '</div>' +
        (detail ? '<div class="notify-urgent-detail">' + (typeof escHtml==='function'?escHtml(detail):detail) + '</div>' : '') +
        '<button class="notify-urgent-btn">\u673A\u5DF2\u77E5\u6089</button>' +
        '</div>';
      overlay.querySelector('.notify-urgent-btn').onclick = function() {
        overlay.classList.add('closing');
        setTimeout(function(){ overlay.remove(); }, 300);
        if (typeof onConfirm === 'function') onConfirm();
      };
      document.body.appendChild(overlay);
    }
  };
})();

// 保持向后兼容：toast() = NotificationSystem.flash()
function toast(m) { NotificationSystem.flash(m); }
// 便捷别名
function notifyPersist(msg, icon) { NotificationSystem.persist(msg, icon); }
function notifyUrgent(title, detail, onConfirm) { NotificationSystem.urgent(title, detail, onConfirm); }

/** 显示通知历史面板 */
function showNotificationHistory() {
  var hist = NotificationSystem.getHistory();
  var html = '<div style="max-height:400px;overflow-y:auto;">';
  if (hist.length === 0) {
    html += '<div style="text-align:center;color:var(--color-foreground-muted);padding:2rem;">\u6682\u65E0\u901A\u77E5</div>';
  } else {
    hist.slice().reverse().forEach(function(n) {
      var levelLabel = n.level === 'urgent' ? '\u2757' : n.level === 'persist' ? '\u2139' : '\u00B7';
      var levelColor = n.level === 'urgent' ? 'var(--vermillion-400)' : n.level === 'persist' ? 'var(--gold-400)' : 'var(--color-foreground-muted)';
      var timeStr = new Date(n.time).toLocaleTimeString();
      html += '<div style="padding:0.3rem 0;border-bottom:1px solid var(--color-border-subtle);font-size:0.78rem;">';
      html += '<span style="color:' + levelColor + ';">' + levelLabel + '</span> ';
      html += '<span style="color:var(--color-foreground-muted);font-size:0.71rem;">T' + n.turn + ' ' + timeStr + '</span> ';
      html += (typeof escHtml==='function'?escHtml(n.msg):n.msg);
      html += '</div>';
    });
  }
  html += '</div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('\u901A\u77E5\u5386\u53F2', html);
  } else {
    showTurnResult(html);
  }
}

// 通用输入框（替代 prompt）
function showPrompt(message, defaultValue, callback) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--bg-2);padding:1.5rem;border-radius:8px;min-width:300px;max-width:500px;';

  var msg = document.createElement('div');
  msg.textContent = message;
  msg.style.cssText = 'margin-bottom:1rem;color:var(--txt-p);';

  var input = document.createElement('input');
  input.type = 'text';
  input.value = defaultValue || '';
  input.style.cssText = 'width:100%;padding:0.5rem;border:1px solid var(--bg-4);border-radius:4px;background:var(--bg-1);color:var(--txt-p);margin-bottom:1rem;font-family:inherit;';

  var btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = '取消';
  cancelBtn.className = 'bt';
  cancelBtn.onclick = function() {
    overlay.remove();
    if (callback) callback(null);
  };

  var okBtn = document.createElement('button');
  okBtn.textContent = '确定';
  okBtn.className = 'bt bp';
  okBtn.onclick = function() {
    var val = input.value;
    overlay.remove();
    if (callback) callback(val);
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter') {
      okBtn.click();
    } else if (e.key === 'Escape') {
      cancelBtn.click();
    }
  };

  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(okBtn);
  box.appendChild(msg);
  box.appendChild(input);
  box.appendChild(btnContainer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  setTimeout(function() { input.focus(); }, 100);
}

// ============================================================
// 确定性随机系统（借鉴晚唐风云 seedrandom 思路）
// 同一种子 + 同一调用序列 = 完全相同结果，支持存档重放
// ============================================================
var _rngState = { seed: '', s: 0 };

/** 简单但可重放的伪随机生成器（xorshift32） */
function _xorshift32() {
  var x = _rngState.s;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  _rngState.s = x;
  return (x >>> 0) / 4294967296; // 转为 [0, 1)
}

/** 从字符串种子生成初始状态 */
function _seedToState(seed) {
  var h = 0;
  for (var i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return h === 0 ? 1 : h; // xorshift 不能为 0
}

/** @param {string} [seed] - 随机种子 */
function initRng(seed) {
  _rngState.seed = seed || (Date.now().toString(36) + Date.now().toString(16));
  _rngState.s = _seedToState(_rngState.seed);
  _dbg('[RNG] 初始化种子:', _rngState.seed);
}

/** @returns {{seed:string, s:number}} RNG 状态（存档用） */
function getRngState() { return { seed: _rngState.seed, s: _rngState.s }; }

/** @param {{seed:string, s:number}} state - 保存的 RNG 状态 */
function restoreRng(state) {
  if (state && state.seed) {
    _rngState.seed = state.seed;
    _rngState.s = state.s || _seedToState(state.seed);
  }
}

/**
 * 读取 NPC 认知画像并生成 prompt 就绪片段（由 sc07 在 endturn 生成·随 GM 持久化）
 * 用于回合内 AI 调用（问对/朝议/科议/奏疏回复）为该 NPC 注入"当下信息掌握"。
 * @param {string} name 角色名
 * @param {object} [opts] { short:true 返回 40-60字紧凑版；full 返回 150-200字完整版 }
 * @returns {string} 可直接拼入 prompt 的段落；无数据则返回空字符串
 */
function getNpcCognitionSnippet(name, opts) {
  if (!name || !window.GM || !window.GM._npcCognition) return '';
  var cog = window.GM._npcCognition[name];
  if (!cog) return '';
  var short = opts && opts.short;
  var bits = [];
  // 稳定自我画像（无论 short 都注入——全场景口吻一致之关键）
  if (cog.selfIdentity) bits.push('\u81EA\u8BC6\uFF1A' + cog.selfIdentity);
  if (cog.personalityCore) bits.push('\u4EBA\u683C\uFF1A' + cog.personalityCore);
  if (cog.speechThread) bits.push('\u53E3\u543B\uFF1A' + cog.speechThread);
  if (!short) {
    if (cog.abilityAwareness) bits.push('\u81EA\u77E5\uFF1A' + cog.abilityAwareness);
    if (cog.fiveVirtues) bits.push('\u4E94\u5E38\uFF1A' + cog.fiveVirtues);
    if (cog.historicalVoice) bits.push('\u53F2\u6807\uFF1A' + cog.historicalVoice);
    if (cog.partyClassFeeling) bits.push('\u515A\u9636\uFF1A' + cog.partyClassFeeling);
  }
  // 动态信息
  if (cog.currentFocus) bits.push('\u5FC3\u5FF5\uFF1A' + cog.currentFocus);
  if (cog.attitudeTowardsPlayer) bits.push('\u5BF9\u5E1D\uFF1A' + cog.attitudeTowardsPlayer);
  if (!short) {
    if (Array.isArray(cog.knows) && cog.knows.length) bits.push('\u77E5\uFF1A' + cog.knows.slice(0,3).join('\uFF1B'));
    if (Array.isArray(cog.doesntKnow) && cog.doesntKnow.length) bits.push('\u4E0D\u77E5\uFF1A' + cog.doesntKnow.slice(0,2).join('\uFF1B'));
    if (cog.worldviewShift) bits.push('\u5FC3\u5883\uFF1A' + cog.worldviewShift);
    if (cog.unspokenConcern) bits.push('\u6697\u62C5\uFF1A' + cog.unspokenConcern);
    if (cog.infoAsymmetry) bits.push('\u72EC\u77E5\uFF1A' + cog.infoAsymmetry);
    if (cog.recentMood) bits.push('\u5FC3\u7EEA\uFF1A' + cog.recentMood);
  }
  // 自作文苑作品（文事系统·NPC 对自己的作品应了如指掌）
  // 【sc07 升级·S3 消费】新增认知维度注入(恩怨/诉求/朝局判断/风闻)——让问对·朝议中的他更立体、更像本人
  if (!short) {
    if (cog.gratitudeGrudge) bits.push('恩怨：' + cog.gratitudeGrudge);
    if (cog.agenda) bits.push('所求：' + cog.agenda);
    if (cog.situationRead) bits.push('朝局判断：' + cog.situationRead);
    if (cog.rumorVsFact) bits.push('风闻(未证)：' + cog.rumorVsFact);
  }
  if (!short && window.GM && Array.isArray(window.GM.culturalWorks)) {
    var _myW = window.GM.culturalWorks.filter(function(w){return w && w.author === name;});
    if (_myW.length) {
      var _recent = _myW.slice(-5).map(function(w){
        var s = '\u300A' + (w.title||'\u65E0\u9898') + '\u300B';
        if (w.subtype || w.genre) s += '(' + (w.subtype||w.genre) + ')';
        if (w.mood) s += '\u00B7' + w.mood;
        return s;
      }).join('\u3001');
      bits.push('\u81EA\u4F5C\u00B7\u8FD1 ' + _myW.length + ' \u7BC7\uFF1A' + _recent);
    }
    var _dedTo = window.GM.culturalWorks.filter(function(w){return w && Array.isArray(w.dedicatedTo) && w.dedicatedTo.indexOf(name) >= 0;}).slice(-3);
    if (_dedTo.length) bits.push('\u88AB\u8D60\u4F5C\uFF1A' + _dedTo.map(function(w){return w.author+'\u300A'+w.title+'\u300B';}).join('\u3001'));
    var _satire = window.GM.culturalWorks.filter(function(w){return w && w.satireTarget === name;}).slice(-2);
    if (_satire.length) bits.push('\u8BBD\u6211\uFF1A' + _satire.map(function(w){return w.author+'\u300A'+w.title+'\u300B';}).join('\u3001'));
  }

  if (bits.length === 0) return '';
  return '\n\u3010\u8BE5\u81E3\u8BA4\u77E5\u00B7\u81EA\u6211\u753B\u50CF\u00B7\u6587\u4E8B\u7C4D\u5F71\u3011\n' + bits.join('\n') + '\n';
}
if (typeof window !== 'undefined') window.getNpcCognitionSnippet = getNpcCognitionSnippet;

/** @returns {number} 确定性随机数 [0, 1) */
function random() { return _xorshift32(); }

/** @param {number} min @param {number} max @returns {number} [min, max] 闭区间随机整数 */
function randInt(min, max) { return min + Math.floor(random() * (max - min + 1)); }

/** @template T @param {T[]} arr @returns {T[]} 原地洗牌后的数组 */
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = randInt(0, i);
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// ============================================================
// 子种子RNG工厂 —— 战斗/阴谋等独立模块用独立种子，不消耗主RNG序列
// ============================================================
/**
 * 创建独立的子RNG（xorshift32），不影响全局 _rngState
 * @param {string} seed - 子种子字符串（如 "battle_T5_长安"）
 * @returns {function():number} 返回 [0,1) 的随机数生成函数
 */
function createSubRng(seed) {
  var s = _seedToState(String(seed));
  return function() {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ============================================================
// 每回合RNG检查点 —— 支持存档重放时从特定回合恢复
// ============================================================
/**
 * 保存当前RNG状态到GM检查点（最多保留最近20个）
 * 在endTurn开头调用
 */
function checkpointRng() {
  if (!GM._rngCheckpoints) GM._rngCheckpoints = [];
  GM._rngCheckpoints.push({ turn: GM.turn, state: getRngState() });
  if (GM._rngCheckpoints.length > 20) GM._rngCheckpoints = GM._rngCheckpoints.slice(-20);
}

// ============================================================
// 时间换算工具 —— 所有机械系统的时间参数统一用"月"作基准，运行时按回合时长缩放
// getTimeRatio() 定义在 tm-dynamic-systems.js（日=1/365, 月=1/12, 季=1/4, 年=1）
// ============================================================

/**
 * 获取每回合天数（统一入口，兼容旧格式）
 * 定义在 tm-utils.js 以确保所有后续文件都能访问
 * @returns {number}
 */
// TM_RETENTION_GUARD: early-days-per-turn-provider.
// This early-loaded definition is intentionally kept for scripts loaded before
// tm-edict-lifecycle.js redefines the same helper. Centralize before removing.
function _getDaysPerTurn() {
  if (!P || !P.time) return 30;
  // 新格式：直接读 daysPerTurn
  if (P.time.daysPerTurn && P.time.daysPerTurn > 0) return P.time.daysPerTurn;
  // 旧格式兼容：从 perTurn 代码转换
  var pt = P.time.perTurn || '1m';
  if (pt === '1d') return 1;
  if (pt === '1w') return 7;
  if (pt === '1m') return 30;
  if (pt === '1s') return 90;
  if (pt === '1y') return 365;
  if (pt === 'custom' && P.time.customDays > 0) return P.time.customDays;
  var num = parseInt(pt);
  if (num > 0) return num;
  return 30;
}

/**
 * 标准化剧本时间配置：daysPerTurn 是权威字段，perTurn/customDays 只作旧系统兼容。
 * @param {Object} time
 * @param {Object=} gameSettings
 * @returns {Object}
 */
function normalizeTimeConfigFromGameSettings(time, gameSettings) {
  var t = time || {};
  var gs = gameSettings || {};
  var unitDays = {'日':1,'周':7,'月':30,'季':90,'年':365};
  var days = Number(gs.daysPerTurn);

  if (!(days > 0)) days = Number(t.daysPerTurn);
  if (!(days > 0) && gs.turnUnit) {
    days = (Number(gs.turnDuration) || 1) * (unitDays[gs.turnUnit] || 30);
  }
  if (!(days > 0)) {
    var pt = t.perTurn || '1m';
    if (pt === 'custom' && Number(t.customDays) > 0) days = Number(t.customDays);
    else {
      var legacy = {'1d':1,'1w':7,'1m':30,'1s':90,'1y':365};
      days = legacy[pt] || Number(parseInt(pt, 10)) || 30;
    }
  }

  t.daysPerTurn = days;
  if (days === 1) {
    t.perTurn = '1d';
    delete t.customDays;
  } else if (days === 30) {
    t.perTurn = '1m';
    delete t.customDays;
  } else if (days === 90) {
    t.perTurn = '1s';
    delete t.customDays;
  } else if (days === 365) {
    t.perTurn = '1y';
    delete t.customDays;
  } else {
    t.perTurn = 'custom';
    t.customDays = days;
  }
  return t;
}

/**
 * 将"月数"换算为"回合数"
 * @param {number} months - 月数（如冷却24个月、停战12个月）
 * @returns {number} 对应的回合数（至少1）
 * @example turnsForMonths(24) → 月制:24回合, 日制:730回合, 季制:8回合, 年制:2回合
 */
/**
 * 月→日→回合：将月数转为回合数
 * 公式：months × 30 / daysPerTurn
 * @param {number} months - 月数（如冷却24个月、停战12个月）
 * @returns {number} 对应的回合数（至少1）
 */
function turnsForMonths(months) {
  if (!months || months <= 0) return 0;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return Math.max(1, Math.ceil(months * 30 / dpv));
}

/**
 * 将"年度速率"换算为"每回合速率"
 * 公式：yearRate / 12 / 30 × daysPerTurn = yearRate × daysPerTurn / 360
 * @param {number} ratePerYear - 年度速率
 * @returns {number} 每回合速率
 */
function ratePerTurn(ratePerYear) {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return ratePerYear * dpv / 360;
}

/**
 * 将"月度速率"换算为"每回合速率"
 * 公式：monthRate / 30 × daysPerTurn
 * @param {number} ratePerMonth - 月度速率
 * @returns {number} 每回合速率
 */
function monthlyRatePerTurn(ratePerMonth) {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return ratePerMonth * dpv / 30;
}

/**
 * 检测当前回合是否跨越年末
 * @returns {boolean}
 */
function isYearBoundary(turn) {
  if (!P.time) return false;
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  if (dpv >= 365) return true; // 年制或更长，每回合都跨年
  var currentTurn = (turn !== undefined && turn !== null) ? Number(turn) : (GM && GM.turn);
  if (!isFinite(currentTurn) || currentTurn <= 0) return false;
  var prevDays = (currentTurn - 1) * dpv;
  var curDays = currentTurn * dpv;
  return Math.floor(curDays / 365) > Math.floor(prevDays / 365);
}

/**
 * 将"现实时间描述"转为"当前剧本下的回合数"（至少1）
 * @param {string} duration - 'week'|'month'|'3months'|'season'|'halfyear'|'year'|'3years'|'5years'
 * @returns {number}
 */
function turnsForDuration(duration) {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var daysMap = { 'week':7, 'month':30, '3months':90, 'season':90, 'halfyear':180, 'year':360, '3years':1080, '5years':1800 };
  return Math.max(1, Math.ceil((daysMap[duration] || 30) / dpv));
}

/** 获取当前在位年数（浮点数） */
function getReignYears() {
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return ((GM.turn || 1) * dpv) / 360;
}

/** 获取游戏模式行为参数 */
function _getModeParams() {
  var mode = (P && P.conf && P.conf.gameMode) || 'yanyi';
  return {
    mode: mode,
    loyaltyClamp: mode === 'strict_hist' ? 10 : mode === 'light_hist' ? 15 : 20,
    strengthClamp: mode === 'strict_hist' ? 5 : mode === 'light_hist' ? 8 : 10,
    echoDelay: mode === 'strict_hist' ? 2.0 : mode === 'light_hist' ? 1.0 : 0.5,
    eventIntensity: mode === 'strict_hist' ? 0.7 : mode === 'light_hist' ? 1.0 : 1.5,
    playerDeathProtection: mode === 'yanyi',
    narrativeStyle: mode === 'strict_hist' ? '仿《资治通鉴》纪事体文言' : mode === 'light_hist' ? '半文言半白话' : '仿《三国演义》章回体'
  };
}

/**
 * 获取每回合天数
 * @returns {number}
 */
function getTurnDays() {
  return (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
}

var _uidSeq = 0;
function uid(){
  _uidSeq = (_uidSeq + 1) % 46656;
  return Date.now().toString(36) + _uidSeq.toString(36).padStart(3, '0') + random().toString(36).slice(2,7);
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

// Character loyalty must not change without an attributable gameplay reason.
(function(global){
  if (!global || global.adjustCharacterLoyalty) return;

  function _isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function _clamp100(v) {
    return Math.max(0, Math.min(100, v));
  }

  function _loyaltyValue(ch) {
    return _isFiniteNumber(ch && ch.loyalty) ? ch.loyalty : 50;
  }

  function _findChar(chOrName) {
    if (!chOrName) return null;
    if (typeof chOrName === 'object') return chOrName;
    var name = String(chOrName);
    if (typeof global.findCharByName === 'function') {
      var found = global.findCharByName(name);
      if (found) return found;
    }
    var G = global.GM || {};
    return (G.chars || []).find(function(c){ return c && c.name === name; }) || null;
  }

  function _syncAllCharacters(ch, oldValue, newValue, syncRelationValue) {
    var G = global.GM || {};
    var ac = (G.allCharacters || []).find(function(c){ return c && ch && c.name === ch.name; });
    if (!ac) return;
    ac.loyalty = newValue;
    if (syncRelationValue || ac.relationValue === oldValue) ac.relationValue = newValue;
  }

  function _ensureTurnChanges() {
    var G = global.GM;
    if (!G) return null;
    if (!G.turnChanges || typeof G.turnChanges !== 'object' || Array.isArray(G.turnChanges)) G.turnChanges = {};
    if (!Array.isArray(G.turnChanges.characters)) G.turnChanges.characters = [];
    return G.turnChanges;
  }

  function _manualRecordCharChange(name, oldValue, newValue, reason) {
    var tc = _ensureTurnChanges();
    if (!tc) return;
    var item = tc.characters.find(function(c){ return c && c.name === name; });
    if (!item) {
      item = { name: name, changes: [] };
      tc.characters.push(item);
    }
    item.changes.push({
      field: 'loyalty',
      oldValue: oldValue,
      newValue: newValue,
      reason: reason
    });
  }

  function _recordLoyaltyMemory(ch, oldValue, newValue, reason, source, opts) {
    if (!ch || !ch.name || oldValue === newValue) return;
    var delta = newValue - oldValue;
    var sign = delta > 0 ? '+' + delta : String(delta);
    var event = '\u5FE0\u8BDA\u53D8\u5316\uFF1A' + reason + '\uFF08' + sign + '\uFF1B' + oldValue + '\u2192' + newValue + '\uFF09';
    var emotion = delta > 0 ? '\u559C' : delta < 0 ? '\u5FE7' : '\u5E73';
    var importance = Math.max(2, Math.min(8, Math.ceil(Math.abs(delta) / 5) + 2));
    var who = (opts && (opts.who || opts.actor || opts.relatedPerson)) || '';
    if (global.NpcMemorySystem && typeof global.NpcMemorySystem.remember === 'function') {
      try {
        global.NpcMemorySystem.remember(ch.name, event, emotion, importance, who, {
          type: 'loyalty',
          source: source || 'loyalty',
          credibility: 100,
          _noMirror: true
        });
        return;
      } catch (_e) {}
    }
    if (!Array.isArray(ch._memory)) ch._memory = [];
    var G = global.GM || {};
    var entry = {
      event: event,
      emotion: emotion,
      importance: importance,
      turn: G.turn || 0,
      who: who,
      type: 'loyalty',
      source: source || 'loyalty',
      credibility: 100
    };
    ch._memory.push(entry);
    if (G) {
      if (!Array.isArray(G._memoryArchiveFull)) G._memoryArchiveFull = [];
      G._memoryArchiveFull.push(Object.assign({}, entry, { char: ch.name, archiveTurn: G.turn || 0 }));
    }
  }

  function _recordLoyaltyChange(ch, oldValue, newValue, reason, source, opts) {
    if (!ch || !ch.name || oldValue === newValue) return;
    if (typeof global.recordChange === 'function') {
      try {
        global.recordChange('characters', ch.name, 'loyalty', oldValue, newValue, reason);
      } catch (_e) {
        _manualRecordCharChange(ch.name, oldValue, newValue, reason);
      }
    } else {
      _manualRecordCharChange(ch.name, oldValue, newValue, reason);
    }
    var G = global.GM;
    if (G) {
      if (!Array.isArray(G._loyaltyLog)) G._loyaltyLog = [];
      G._loyaltyLog.push({
        turn: G.turn || 0,
        name: ch.name,
        oldValue: oldValue,
        newValue: newValue,
        delta: newValue - oldValue,
        reason: reason,
        source: source || ''
      });
      if (G._loyaltyLog.length > 200) G._loyaltyLog.splice(0, G._loyaltyLog.length - 200);
    }
    _recordLoyaltyMemory(ch, oldValue, newValue, reason, source, opts);
  }

  function _rememberBlocked(ch, value, reason, source) {
    var G = global.GM;
    if (!G) return;
    if (!Array.isArray(G._loyaltyBlocked)) G._loyaltyBlocked = [];
    G._loyaltyBlocked.push({
      turn: G.turn || 0,
      name: ch && ch.name || '',
      value: value,
      reason: reason || '',
      source: source || ''
    });
    if (G._loyaltyBlocked.length > 100) G._loyaltyBlocked.splice(0, G._loyaltyBlocked.length - 100);
  }

  function _hasReason(reason) {
    return typeof reason === 'string' && reason.trim().length > 0;
  }

  function _loyaltyReason(reason, opts) {
    if (_hasReason(reason)) return String(reason).trim();
    if (opts && opts.ai === true) return opts.defaultReason || 'AI\u63A8\u6F14';
    if (opts && opts.allowUnattributed) return opts.defaultReason || '\u672A\u6807\u6CE8\u6765\u6E90';
    return '';
  }

  function _sourceAlreadyApplied(ch, source, opts) {
    if (!opts || !opts.oncePerTurn || !source || !ch) return false;
    var G = global.GM || {};
    var turn = G.turn || 0;
    if (!ch._loyaltySourceTurn || typeof ch._loyaltySourceTurn !== 'object') ch._loyaltySourceTurn = {};
    var key = String(source);
    if (ch._loyaltySourceTurn[key] === turn) return true;
    ch._loyaltySourceTurn[key] = turn;
    return false;
  }

  function adjustCharacterLoyalty(chOrName, delta, reason, opts) {
    opts = opts || {};
    var ch = _findChar(chOrName);
    var amount = Number(delta);
    if (!ch || !isFinite(amount)) {
      return { ok: false, skipped: true, reason: 'invalid-target-or-delta' };
    }
    if (amount === 0) return { ok: true, skipped: true, reason: 'zero-delta' };
    if (opts.round !== false) amount = Math.round(amount);
    if (opts.maxAbs !== undefined) {
      var maxAbs = Math.abs(Number(opts.maxAbs) || 0);
      if (maxAbs > 0) amount = Math.max(-maxAbs, Math.min(maxAbs, amount));
    }
    if (amount === 0) return { ok: true, skipped: true, reason: 'zero-delta' };
    var cleanReason = _loyaltyReason(reason, opts);
    if (!cleanReason) {
      _rememberBlocked(ch, amount, reason, opts.source);
      return { ok: false, blocked: true, reason: 'missing-reason' };
    }
    if (_sourceAlreadyApplied(ch, opts.source, opts)) {
      return { ok: true, skipped: true, duplicate: true };
    }
    var oldValue = _loyaltyValue(ch);
    var newValue = _clamp100(oldValue + amount);
    if (newValue === oldValue) return { ok: true, skipped: true, oldValue: oldValue, newValue: newValue, delta: 0 };
    ch.loyalty = newValue;
    if (opts.syncAllCharacters !== false) _syncAllCharacters(ch, oldValue, newValue, false);
    _recordLoyaltyChange(ch, oldValue, newValue, cleanReason, opts.source, opts);
    return { ok: true, oldValue: oldValue, newValue: newValue, delta: newValue - oldValue, reason: cleanReason };
  }

  function setCharacterLoyalty(chOrName, value, reason, opts) {
    opts = opts || {};
    var ch = _findChar(chOrName);
    var target = Number(value);
    if (!ch || !isFinite(target)) return { ok: false, skipped: true, reason: 'invalid-target-or-value' };
    var cleanReason = _loyaltyReason(reason, opts);
    if (!cleanReason) {
      _rememberBlocked(ch, target, reason, opts.source);
      return { ok: false, blocked: true, reason: 'missing-reason' };
    }
    var oldValue = _loyaltyValue(ch);
    target = _clamp100(opts.round === false ? target : Math.round(target));
    if (opts.maxJump !== undefined) {
      var maxJump = Math.abs(Number(opts.maxJump) || 0);
      if (maxJump > 0) target = _clamp100(oldValue + Math.max(-maxJump, Math.min(maxJump, target - oldValue)));
    }
    if (target === oldValue) return { ok: true, skipped: true, oldValue: oldValue, newValue: target, delta: 0 };
    ch.loyalty = target;
    if (opts.syncAllCharacters !== false) _syncAllCharacters(ch, oldValue, target, true);
    _recordLoyaltyChange(ch, oldValue, target, cleanReason, opts.source, opts);
    return { ok: true, oldValue: oldValue, newValue: target, delta: target - oldValue, reason: cleanReason };
  }

  global.adjustCharacterLoyalty = adjustCharacterLoyalty;
  global.setCharacterLoyalty = setCharacterLoyalty;
  if (!global.TM) global.TM = {};
  global.TM.loyalty = {
    adjust: adjustCharacterLoyalty,
    set: setCharacterLoyalty
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
/** prompt 内字数指引——每条发言直接按用户设置范围，不做倍率
 *  category: 'wd'=问对, 'cy'=朝议（默认 cy） */
function _aiDialogueWordHint(category) {
  category = category || 'cy';
  var r = (typeof _getCharRange === 'function') ? _getCharRange(category) : [150, 300];
  return '（每条发言约 ' + r[0] + '-' + r[1] + ' 字）';
}

/** 对话 max_tokens——按 speakerCount 预留 token 预算（保证多人场景每人都写足字数，不互相挤占）
 *  category: 'wd'|'cy'  speakerCount: 本次调用需生成几条发言（默认 1） */
function _aiDialogueTok(category, speakerCount) {
  category = category || 'cy';
  var n = parseInt(speakerCount, 10) || 1;
  var r = (typeof _getCharRange === 'function') ? _getCharRange(category) : [150, 300];
  var perMax = r[1];
  var totalChars = perMax * n;
  // 汉字 → token：约 × 2 + 思考 buffer
  var tok = Math.max(500, Math.round(totalChars * 2.5));
  // 2026-06-11·JSON 元数据缓冲（治问对/对话「生成一半就截断」）：
  //   reply 之外，AI 还要写忠诚/情绪/记忆 memoryImpact/欺瞒 deception/施政建议 suggestions 等结构化字段，
  //   这些是「与 reply 长度无关」的近似固定开销。旧公式只按 totalChars 给量 → reply 写满后 JSON 元数据被
  //   finish_reason:length 截断 → extractJSON 失败 / 玩家看到对话半截。按 category 加固定缓冲（wd 单人但 schema 最重）。
  tok += (category === 'wd') ? 600 : 250;
  // 2026-06-11·owner:默认 token 翻三倍·彻底消除问对/朝议截断。
  //   （max_tokens 只是输出上限·模型仍按 prompt 的字数提示生成·不会因上限高就变啰嗦；高上限只是不再半截。）
  tok = tok * 3;
  // 并确保「设置·AI 输出上限(max_tokens 手动值)」对对话生效：
  //   此前对话流式路 callAIMessagesStream→_callAIMessagesStreamDirect 的 max_tokens 只来自本函数·完全不读 P.conf.maxOutputTokens
  //   （只有 endturn 读它），故设置对问对/朝议无效。取 max(翻三倍默认, 设置值)——用户调高即生效；
  //   设置偏低也不回落到截断（翻三倍默认作下限保护，符合「治截断」本意）。
  var _setOutCap = parseInt(P && P.conf && P.conf.maxOutputTokens, 10) || 0;
  if (_setOutCap > 0) tok = Math.max(tok, _setOutCap);
  try { if (window._dbgDialogueWC) console.log('[对话字数]', category, '×' + n + '人', 'range=', r, '→ tok=', tok, '| 设置上限=', _setOutCap || '(auto)'); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-utils');}catch(_){}}
  return tok;
}

/** 开关对话字数 debug 日志——在浏览器控制台执行 _toggleDialogueDebug() 开启 */
function _toggleDialogueDebug() {
  window._dbgDialogueWC = !window._dbgDialogueWC;
  console.log('[对话字数 debug]', window._dbgDialogueWC ? '✅ 已开启' : '❌ 已关闭');
  if (window._dbgDialogueWC) {
    console.log('当前档位 verbosity =', P.conf.verbosity);
    console.log('问对自定义值 wdMin/wdMax =', P.conf.wdMin, '/', P.conf.wdMax);
    console.log('朝议自定义值 cyMin/cyMax =', P.conf.cyMin, '/', P.conf.cyMax);
    console.log('生效范围:');
    console.log('  问对 _getCharRange(wd) =', _getCharRange('wd'));
    console.log('  朝议 _getCharRange(cy) =', _getCharRange('cy'));
  }
  return window._dbgDialogueWC;
}

/** 显示数字——保留 1 位小数，四舍五入；整数不显示小数（AI 读取不变，仅 UI 用） */
function _fmtNum1(v){
  if (v === undefined || v === null || v === '') return '0';
  var n = parseFloat(v);
  if (isNaN(n)) return String(v);
  var r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r | 0) : r.toFixed(1);
}
/** 高效深拷贝：优先 structuredClone，回退 JSON */
function deepClone(obj){
  if(obj===null||typeof obj!=='object')return obj;
  try{return structuredClone(obj);}catch(e){return JSON.parse(JSON.stringify(obj));}
}
/** HTML转义：防止 innerHTML 拼接时的 XSS */
function escHtml(s){
  if(s===null||s===undefined)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/**
 * 所在地别名表：同一城市/宫城的多种叫法。
 * 用于 _isSameLocation 匹配——"紫禁城·乾清宫"/"坤宁宫"/"京师·文渊阁"视为同城。
 * 值为 canonical key，key 方有多个别名。
 */
var _LOC_ALIASES = {
  '京城': '京城', '京师': '京城', '北京': '京城', '燕京': '京城', '顺天府': '京城',
  '紫禁城': '京城', '皇城': '京城', '宫中': '京城', '内廷': '京城', '禁中': '京城',
  '南京': '南京', '应天府': '南京', '建康': '南京', '金陵': '南京', '陪都': '南京',
  '盛京': '盛京', '沈阳': '盛京', '赫图阿拉': '盛京', '辽阳': '盛京',
  '杭州': '杭州', '临安': '杭州', '西湖': '杭州',
  '苏州': '苏州', '姑苏': '苏州', '吴中': '苏州',
  '洛阳': '洛阳', '东都': '洛阳',
  '西安': '西安', '长安': '西安',
  '成都': '成都', '蜀京': '成都',
  '汉城': '汉城', '汉阳': '汉城', '首尔': '汉城'
};
/**
 * 把地点字符串规范化到"主地点"——取首段（按 · , /、空格等分割）后查别名表。
 * 例："紫禁城·乾清宫" → "紫禁城" → 查表得 "京城"
 *     "京师·文渊阁" → "京师" → "京城"
 *     "南京·户部衙门" → "南京" → "南京"
 *     "陕西·西安" → "陕西"（未在表中，返回自身）
 */
function _normalizeLocation(loc) {
  if (!loc || typeof loc !== 'string') return '';
  var s = String(loc).trim();
  if (!s) return '';
  // 取首段——按常见分隔符拆分
  var parts = s.split(/[·・\/\,，、\s\-—>→→]+/);
  for (var i = 0; i < parts.length; i++) {
    var p = (parts[i] || '').trim();
    if (!p) continue;
    if (_LOC_ALIASES[p]) return _LOC_ALIASES[p];
    // 别名表覆盖更长前缀（如 "紫禁城·乾清宫"）
    var keys = Object.keys(_LOC_ALIASES);
    for (var k = 0; k < keys.length; k++) {
      if (p.indexOf(keys[k]) === 0) return _LOC_ALIASES[keys[k]];
    }
    return p; // 首段未匹配即返回
  }
  return s;
}
/**
 * 判定两地是否"视为同地"——同城/同宫室都算。
 * 规则：规范化后首段相等；或一方包含另一方的主键（如两者都含"紫禁城"或"京师"）。
 */
function _isSameLocation(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  var na = _normalizeLocation(a);
  var nb = _normalizeLocation(b);
  if (na === nb) return true;
  // 原串相互包含亦算（兜底宽松匹配）
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
  return false;
}

function _tmCleanIdentityName(value) {
  return String(value || '').replace(/[\s·\-—_、，。,.()（）【】\[\]：:；;\/\\]/g, '').trim();
}

function _tmPushUnique(out, value) {
  value = String(value || '').trim();
  if (value && out.indexOf(value) < 0) out.push(value);
}

function _tmPlayerNames() {
  var out = [];
  try {
    if (typeof P !== 'undefined' && P && P.playerInfo) {
      _tmPushUnique(out, P.playerInfo.characterName);
      _tmPushUnique(out, P.playerInfo.name);
    }
  } catch (_) {}
  try {
    if (typeof GM !== 'undefined' && GM) {
      _tmPushUnique(out, GM.playerName);
      if (Array.isArray(GM.chars)) {
        GM.chars.forEach(function(c) {
          if (c && (c.isPlayer || c.player || c.playerControlled || c.controlledBy === 'player')) _tmPushUnique(out, c.name);
        });
      }
    }
  } catch (_) {}
  return out;
}

function _tmPlayerFactionNames() {
  var out = [];
  function add(value) {
    if (!value) return;
    if (typeof value === 'object') {
      add(value.name || value.factionName || value.id || value.key);
      return;
    }
    _tmPushUnique(out, value);
  }
  try {
    if (typeof P !== 'undefined' && P) {
      var pi = P.playerInfo || {};
      add(pi.factionName);
      add(pi.characterFaction);
      add(P.playerFactionName);
      add(P.playerFaction);
    }
  } catch (_) {}
  try {
    if (typeof GM !== 'undefined' && GM) {
      add(GM.playerFactionName);
      add(GM.playerFaction);
      if (GM.playerInfo) add(GM.playerInfo.factionName);
      if (Array.isArray(GM.chars)) {
        GM.chars.forEach(function(c) {
          if (c && (c.isPlayer || c.player || c.playerControlled || c.controlledBy === 'player')) add(c.faction || c.factionName || c.ownerFaction);
        });
      }
      [GM.facs, GM.factions].forEach(function(list) {
        if (!Array.isArray(list)) return;
        list.forEach(function(f) {
          if (f && (f.isPlayer || f.player || f.isPlayerFaction || f.controlledBy === 'player' || f.controller === 'player' || f.controlType === 'player')) add(f.name || f.id);
        });
      });
    }
  } catch (_) {}
  return out;
}

function _tmCleanFactionName(value) {
  return String(value || '').replace(/[\s·\-—_、，。,.()（）【】\[\]]/g, '').replace(/(朝廷|王朝|政权|汗国|幕府|国)$/g, '').trim();
}

function _tmFactionMatches(value, names) {
  var clean = _tmCleanFactionName(value);
  if (!clean) return false;
  return (names || []).some(function(name) {
    var n = _tmCleanFactionName(name);
    return n && (clean === n || clean.indexOf(n) >= 0 || n.indexOf(clean) >= 0);
  });
}

function _tmIsGenericCourtFaction(value) {
  return /^(朝廷|本朝|官府|内廷|宫廷|皇室|王室|帝室|朝中|中枢|内府|禁中)$/.test(String(value || '').trim());
}

function _tmCharacterFactionValues(ch) {
  if (!ch) return [];
  return [ch.faction, ch.factionName, ch.currentFaction, ch.allegiance, ch.country, ch.polity, ch.realm, ch.kingdom, ch.force, ch.camp]
    .filter(function(x) { return x != null && String(x).trim(); });
}

function _tmIsPlayerFactionCharLoose(ch) {
  if (!ch) return false;
  if (typeof _isPlayerFactionChar === 'function') {
    try { if (_isPlayerFactionChar(ch)) return true; } catch (_) {}
  }
  var explicit = _tmCharacterFactionValues(ch);
  if (explicit.some(_tmIsGenericCourtFaction)) return true;
  var playerFactions = _tmPlayerFactionNames();
  if (playerFactions.length && explicit.some(function(x) { return _tmFactionMatches(x, playerFactions); })) return true;
  return false;
}

/** 阵营硬闸(2026-07-04)：仅拦「明确标了非本朝势力」的角色——faction 类字段全空者视为本朝放行(散官/编辑器剧本常不填势力·loose 守卫对空字段判非本朝会误杀·与 _wdIsPlayerSideChar 空字段兜底语义对齐)。用于宰辅进言/求见队列/转对候选等臣→君产出口·防外邦君主(皇太极/德川氏等·其 faction 必有值)混入喂推演。 */
function _tmIsForeignCourtChar(ch) {
  if (!ch) return false;
  var explicit = _tmCharacterFactionValues(ch);
  if (!explicit.length) return false;
  return !_tmIsPlayerFactionCharLoose(ch);
}

function _tmIsPlayerConsort(ch) {
  if (!ch || ch.alive === false || ch.dead) return false;
  var playerNames = _tmPlayerNames().map(_tmCleanIdentityName).filter(Boolean);
  var spouseFields = [ch.spouse, ch.spouseOf, ch.husband, ch.partner, ch.marriedTo, ch.consortOf, ch.belongsTo];
  for (var i = 0; i < spouseFields.length; i++) {
    var v = spouseFields[i];
    if (typeof v === 'string' && v.trim()) {
      var cv = _tmCleanIdentityName(v);
      if (playerNames.indexOf(cv) >= 0) return true;
      return false;
    }
  }
  var rel = String(ch.playerRelation || ch.relationToPlayer || ch.relationshipToPlayer || '');
  if (/(夫妻|夫妾|妻妾|帝妃|帝后|后妃|妃嫔|皇后|贵妃|爱妃|宠妃)/.test(rel)) return true;
  if (!(ch.spouse === true || ch._isConsort || ch.isConsort || ch.spouseRank)) return false;
  var text = [ch.title, ch.officialTitle, ch.role, ch.position, ch.occupation, ch.rank, ch.spouseRank].join(' ');
  if (/(先朝|遗妃|遗孀|皇嫂|嫂叔|太后|皇太后|太皇太后|太妃|王太妃|乳母|奉圣夫人|国夫人|郡夫人|县君|乡君|公主|郡主|县主|福晋|王妃|王后|可汗|大汗|汗妃)/.test(text)) return false;
  if (_tmCharacterFactionValues(ch).length > 0 && !_tmIsPlayerFactionCharLoose(ch)) return false;
  return /(皇后|贵妃|妃|嫔|才人|选侍|淑人|常在|答应|宫人|侍妾|后宫|中宫|正妻|妻室|consort|empress|queen|concubine|attendant)/i.test(text);
}

function _tmIsAtPlayerLocation(ch) {
  if (!ch || ch.alive === false || ch.dead) return false;
  if (ch._travelTo || ch._enRouteToOffice || ch._imprisoned || ch.imprisoned || ch._exiled || ch.exiled || ch._fled || ch._missing) return false;
  var playerLoc = '';
  try { if (typeof _getPlayerLocation === 'function') playerLoc = _getPlayerLocation(); } catch (_) {}
  if (!playerLoc) playerLoc = (typeof GM !== 'undefined' && GM && (GM._capital || GM.capital)) || '京师';
  var loc = ch.location || ch.place || ch.currentLocation || playerLoc;
  return (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (_tmCleanIdentityName(loc) === _tmCleanIdentityName(playerLoc));
}


/** 模糊查找角色（精确→去空格标点→前2字唯一→别名→null） */
function _fuzzyFindChar(name) {
  if (!name || !GM.chars) return null;
  var n = String(name).trim();
  try {
    if (typeof canonicalizeCharName === 'function') n = canonicalizeCharName(n) || n;
  } catch (_) {}
  // 1. 精确
  var exact = GM.chars.find(function(c) { return c.name === n; });
  if (exact) return exact;
  // 2. 去空格/标点
  var cleaned = n.replace(/[\s·\-—、，。（）()]/g, '');
  var m2 = GM.chars.find(function(c) { return c.name.replace(/[\s·\-—、，。（）()]/g, '') === cleaned; });
  if (m2) { _dbg('[FuzzyMatch] "' + n + '" → "' + m2.name + '"'); return m2; }
  // 3. 前2字唯一匹配
  if (cleaned.length >= 2) {
    var pf = cleaned.substring(0, 2);
    var pms = GM.chars.filter(function(c) { return c.alive !== false && c.name.indexOf(pf) === 0; });
    if (pms.length === 1) { _dbg('[FuzzyMatch] prefix "' + n + '" → "' + pms[0].name + '"'); return pms[0]; }
  }
  // 4. 别名
  var am = GM.chars.find(function(c) { return c._aliases && c._aliases.indexOf(n) >= 0; });
  if (am) { _dbg('[FuzzyMatch] alias "' + n + '" → "' + am.name + '"'); return am; }
  return null;
}
/** 模糊查找势力 */
function _fuzzyFindFac(name) {
  if (!name || !GM.facs) return null;
  var exact = GM.facs.find(function(f) { return f.name === name; });
  if (exact) return exact;
  var cl = (name || '').replace(/[\s·\-—]/g, '');
  return GM.facs.find(function(f) { return f.name.replace(/[\s·\-—]/g, '') === cl; }) || null;
}

/** 从 AI 响应文本中提取 JSON（4级降级解析，借鉴 ChongzhenSim） */
/** extractJSON —— 保留为 robustParseJSON 的别名（向后兼容） */
function extractJSON(text) { return robustParseJSON(text); }
/** 调试日志：仅在 P.conf.debugLog 为 true 时输出（兼容旧调用，新代码用 DebugLog.log） */
function _dbg(){if(P&&P.conf&&P.conf.debugLog)console.log.apply(console,arguments);}
function gSid(s){var el=_$(s);return el?el.value:(P.scenarios[0]?P.scenarios[0].id:"");}
var _aiProgressTimer=null;
var _LOADING_HINTS=['运筹帷幄之中','决胜千里之外','天下大势，分合有时','时来天地皆同力','万事俱备','风云际会','暗潮涌动','大势将至','变局已生','棋局已布'];
var _loadingMaxPct = 0;  // 单调递增的最大值·防止进度条倒退
var _loadingCrawlCeil = 95;  // 自动爬升上界·拍表引擎(tm-endturn-progress.js)在过回合窗口按拍间隙动态收紧
function setLoadingCrawlCeil(v){ _loadingCrawlCeil = (typeof v === 'number' && isFinite(v)) ? Math.max(5, Math.min(99, v)) : 95; }
function showLoading(msg,pct){
  if (typeof GM !== 'undefined' && GM && GM._isPostTurnCourt && (!GM._pendingShijiModal || GM._pendingShijiModal.courtDone === false)) {
    return;
  }
  _$("loading").classList.add("show");
  _$("loading-sub").textContent=msg||_LOADING_HINTS[Math.floor((typeof random==='function'?random():Math.random())*_LOADING_HINTS.length)];
  if(_aiProgressTimer){clearInterval(_aiProgressTimer);_aiProgressTimer=null;}
  var requestedPct = pct || 5;
  // 单调递增：新 pct 不得低于当前 max·避免不同 sub-call 传入乱序 pct 导致回退
  var cur = Math.max(requestedPct, _loadingMaxPct);
  _loadingMaxPct = cur;
  _$("loading-fill").style.width=cur+"%";
  _aiProgressTimer=setInterval(function(){
    cur+=(Date.now()%7)*0.3+0.2;
    if(cur>_loadingCrawlCeil)cur=_loadingCrawlCeil;
    if(cur<_loadingMaxPct)cur=_loadingMaxPct;
    _loadingMaxPct = cur;
    _$("loading-fill").style.width=cur+"%";
  },400);
}
function hideLoading(){
  if(_aiProgressTimer){clearInterval(_aiProgressTimer);_aiProgressTimer=null;}
  _$("loading-fill").style.width="100%";
  _loadingMaxPct = 0;  // 重置·下回合从 0 开始
  _loadingCrawlCeil = 95;
  setTimeout(function(){_$("loading").classList.remove("show");_$("loading-fill").style.width="0%";},250);
}
// ═══ 后朝并发期间·模态排队机制 ═══
// 朝会进行中（_isPostTurnCourt && !courtDone）触发的非史记弹窗（事件/科举/大事记等），
// 先暂存队列；朝会关闭并弹出史记后，按顺序依次 flush
var _postTurnModalQueue = [];
function _isPostTurnActive() {
  return typeof GM !== 'undefined' && GM && GM._isPostTurnCourt === true
      && GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false;
}
function _queuePostTurnModal(fn, label) {
  if (typeof fn !== 'function') return;
  _postTurnModalQueue.push({ fn: fn, label: label || '模态' });
}
function _flushPostTurnModalQueue() {
  if (_postTurnModalQueue.length === 0) return;
  // 依次弹出，每弹一个等待前一个被关闭（简化为 setTimeout 给 UI 时间）
  var q = _postTurnModalQueue.slice();
  _postTurnModalQueue.length = 0;
  var i = 0;
  function _next() {
    if (i >= q.length) return;
    try { q[i].fn(); } catch(_qe) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_qe, 'postTurnModal') : console.warn('[postTurnModal] ' + (q[i].label||'') + ':', _qe); }
    i++;
    // 300ms 后弹下一个·给用户时间看到上一个
    if (i < q.length) setTimeout(_next, 300);
  }
  _next();
}

function showTurnResult(html, idx){
  // 后朝进行中·排队延后（朝会结束后再弹）
  if (typeof _isPostTurnActive === 'function' && _isPostTurnActive()) {
    _queuePostTurnModal(function(){ showTurnResult(html, idx); }, '史记');
    return;
  }
  var body = _$("turn-body"); if (body) body.innerHTML = html;
  // 尝试定位对应 shijiHistory 索引
  if (idx == null && GM.shijiHistory && GM.shijiHistory.length > 0) {
    for (var i = GM.shijiHistory.length - 1; i >= 0; i--) {
      if (GM.shijiHistory[i].html === html) { idx = i; break; }
    }
    if (idx == null) idx = GM.shijiHistory.length - 1; // 新回合
  }
  GM._trCurrentIdx = (typeof idx === 'number') ? idx : null;
  _trPopulateHead();
  _$("turn-modal").classList.add("show");
  // v5·C·装饰 pending 人名为可点击
  try { if (typeof decoratePendingInDom === 'function') decoratePendingInDom(_$("turn-body")); } catch(_){}
}
function closeTurnResult(){_$("turn-modal").classList.remove("show");}

/** 填充弹窗头部（日期/回合/一句话总曰/要闻标签），从 shijiHistory[_trCurrentIdx] 读取 */
function _trPopulateHead(){
  var idx = GM._trCurrentIdx;
  var sj = (idx != null && GM.shijiHistory && GM.shijiHistory[idx]) ? GM.shijiHistory[idx] : null;
  var turnNo = sj ? sj.turn : (GM.turn - 1);
  var dateStr = sj ? (sj.time || '') : (typeof getTSText==='function'?getTSText(GM.turn):'');

  var turnEl = _$("tr-turn-no"); if (turnEl) turnEl.textContent = '\u7B2C ' + turnNo + ' \u56DE \u5408';
  var dateEl = _$("tr-date");
  if (dateEl) {
    var era = (dateStr||'').match(/([\u7532\u4E59\u4E19\u4E01\u620A\u5DF1\u5E9A\u8F9B\u58EC\u7678][\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5])/);
    var eraStr = era ? era[1] : '';
    var main = dateStr.replace(eraStr, '').trim();
    dateEl.innerHTML = escHtml(main || dateStr) + (eraStr ? ' <span class="tr-era-chip">' + escHtml(eraStr) + '</span>' : '');
  }
  // 一句话总曰
  var sumEl = _$("tr-summary");
  if (sumEl) {
    var sum = sj ? (sj.turnSummary || sj.szjSummary || '') : '';
    if (!sum && sj && sj.shizhengji) sum = (sj.shizhengji.split(/[\u3002\uFF01\n]/)[0] || '').slice(0, 80);
    if (sum) { sumEl.textContent = sum; sumEl.style.display = 'block'; }
    else sumEl.style.display = 'none';
  }
  // 要闻标签
  var critEl = _$("tr-critical");
  if (critEl) {
    var tags = _trDetectCritical(sj);
    if (tags.length > 0) {
      var lh = '<span class="tr-critical-lbl">\u672C \u56DE \u8981 \u95FB</span>';
      tags.forEach(function(t){ lh += '<span class="tr-critical-tag ' + t.cls + '">' + escHtml(t.txt) + '</span>'; });
      critEl.innerHTML = lh; critEl.style.display = 'flex';
    } else { critEl.style.display = 'none'; critEl.innerHTML = ''; }
  }
  // 前后翻阅按钮
  var total = (GM.shijiHistory||[]).length;
  var prev = _$("tr-prev"), next = _$("tr-next");
  if (prev) prev.disabled = !(idx != null && idx > 0);
  if (next) next.disabled = !(idx != null && idx < total - 1);
}

/** 侦测关键事件标签 */
function _trDetectCritical(sj){
  var tags = [];
  if (!sj) return tags;
  var t = (sj.shizhengji||'') + ' ' + (sj.shilu||'') + ' ' + (sj.html||'');
  if (/\u6218\u4E8B|\u6218\u5F79|\u653B\u57CE|\u5927\u6377|\u51FA\u5175|\u65CB\u5E08|\u5931\u9677/.test(t)) tags.push({cls:'war', txt:'\u6218 \u4E8B'});
  if (/\u6B81|\u5D29|\u55E1|\u4EBA\u6BBA|\u75C5\u6B7B|\u81EA\u5208/.test(t)) tags.push({cls:'death', txt:'\u4EBA \u6B81'});
  if (/\u5BC6\u8C0B|\u963F\u8C0B|\u9634\u8C0B|\u8C0B\u907F/.test(t)) tags.push({cls:'scheme', txt:'\u5BC6 \u8C0B'});
  if (/\u515A\u4E89|\u515A\u6D3E|\u4E1C\u6797|\u9609\u515A/.test(t)) tags.push({cls:'faction', txt:'\u515A \u4E89'});
  if (/\u65F1\u707E|\u6D2A\u707E|\u96EA\u707E|\u9707\u707E|\u75AB|\u7792|\u5929\u706B|\u5730\u9707|\u5929\u5E1D\u6C44/.test(t)) tags.push({cls:'calamity', txt:'\u707E \u5F02'});
  return tags.slice(0, 4);
}

/** 前后回合翻阅 */
function _trNavTurn(dir){
  if (GM._trCurrentIdx == null || !GM.shijiHistory) return;
  var newIdx = GM._trCurrentIdx + dir;
  if (newIdx < 0 || newIdx >= GM.shijiHistory.length) return;
  showTurnResult(GM.shijiHistory[newIdx].html || '', newIdx);
}

/** 导出本回 */
function _trExportCurrent(){
  var idx = GM._trCurrentIdx;
  var sj = (idx != null && GM.shijiHistory && GM.shijiHistory[idx]) ? GM.shijiHistory[idx] : null;
  if (!sj) { if (typeof toast === 'function') toast('\u65E0\u53EF\u5BFC\u51FA\u6570\u636E'); return; }
  var txt = '[T' + sj.turn + '] ' + (sj.time||'') + '\n';
  if (sj.szjTitle) txt += '\n【' + sj.szjTitle + '】\n';
  if (sj.turnSummary) txt += '\u603B\u66F0\uFF1A' + sj.turnSummary + '\n';
  if (sj.shilu) txt += '\n\u3010\u5B9E\u5F55\u3011\n' + sj.shilu + '\n';
  if (sj.shizhengji) txt += '\n\u3010\u65F6\u653F\u8BB0\u3011\n' + sj.shizhengji + '\n';
  if (sj.zhengwen) txt += '\n\u3010\u653F\u6587\u3011\n' + sj.zhengwen + '\n';
  if (sj.houren) txt += '\n\u3010\u540E\u4EBA\u620F\u8BF4\u3011\n' + sj.houren + '\n';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function(){ if(typeof toast==='function')toast('\u5DF2\u590D\u5236'); }).catch(function(){ _trDownloadTxt(txt, sj.turn); });
  } else _trDownloadTxt(txt, sj.turn);
}
function _trDownloadTxt(txt, turn){
  var a=document.createElement('a');
  a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='shiji_T'+turn+'.txt';a.click();
  if (typeof toast === 'function') toast('\u5DF2\u5BFC\u51FA');
}
function saveP(){
  // P 永不该拥有 gameState——合法附带只发生在 60s autosave 的克隆件上(save-lifecycle:1327)。
  // 存量僵尸(旧 fullLoadGame 格式A遗留·整棵旧局 GM 挂 P 随每次持久化序列化=配额爆炸+启动误恢复已弃旧局)
  // 在写入咽喉一律斩除(2026-07-04 审查定罪)
  try { if (P && P.gameState) delete P.gameState; } catch(_zg) {} // arch-ok 僵尸字段斩除·裁定见上
  // 1. 写入 IndexedDB（主存储，无容量限制）
  if (typeof TM_SaveDB !== 'undefined') {
    TM_SaveDB.saveProject(_tmStripAiKeyInPlace(deepClone(P))).catch(function(e) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveP') : console.warn('[saveP] IndexedDB写入失败:', e); });
  }
  // 2. 写入 localStorage 骨架（轻量，<10KB，用于快速启动）
  try {
    var lite = {
      scenarios: (P.scenarios || []).map(function(s) { return {id:s.id, name:s.name, era:s.era, role:s.role}; }),
      ai: _tmStripAiKeyView(P).ai,
      // conf 镜像入轻量骨架——这是同步存储·随 saveP 一并写·用于在启动同步层即恢复用户设置(生成字数/推演深度/记忆容量等)
      // 修 2026-06-11·剧本 register() 在 DOMContentLoaded 早于异步 IndexedDB restore 跑·会用默认 conf 覆盖玩家保存的设置
      // 让 conf 经同步骨架抢先在 register 之前落到内存·register 的 saveP 便持久化正确 conf·竞态消除
      conf: P.conf,
      _hasFullData: true // 标记：完整数据在IndexedDB
    };
    localStorage.setItem('tm_P_lite', JSON.stringify(lite));
    localStorage.removeItem('tm_P');
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveP] localStorage骨架写入失败:') : console.warn('[saveP] localStorage骨架写入失败:', e); }
  // 3. 桌面端额外保存
  //    GM.running 时不写：此写与 60s 崩溃恢复档同写 __autosave__.json(last-writer-wins)——对局中改一次设置
  //    曾把恢复档降级成纯 P 无 gameState·随后崩溃=本局进度静默丢且无恢复弹窗(2026-07-04 审查定罪)。
  //    对局中 P 已由上方 IDB+lite 即时持久化·桌面档由 60s 周期档(P+gameState 全量)接力·至多 60s 滞后。
  if (window.tianming && window.tianming.isDesktop && !(typeof GM !== 'undefined' && GM && GM.running)) {
    window.tianming.autoSave(_tmStripAiKeyView(P)).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'saveP] desktop failed:') : console.warn('[saveP] desktop failed:', e); });
  }
}

function _tmCountSidRowsInProject(project, key, sid) {
  var arr = project && project[key];
  if (!Array.isArray(arr)) return 0;
  var n = 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] && arr[i].sid === sid) n++;
  }
  return n;
}

function _tmIsIncompleteOfficialProject(project) {
  var sid = 'sc-tianqi7-1627';
  var scenarios = project && project.scenarios;
  if (!Array.isArray(scenarios)) return false;
  var found = false;
  for (var i = 0; i < scenarios.length; i++) {
    if (scenarios[i] && scenarios[i].id === sid) { found = true; break; }
  }
  if (!found) return false;
  return _tmCountSidRowsInProject(project, 'characters', sid) < 30 ||
    _tmCountSidRowsInProject(project, 'factions', sid) < 5 ||
    _tmCountSidRowsInProject(project, 'variables', sid) < 10;
}

function _tmApplyMachinePrefsFromProject(project) {
  if (!project) return;
  if (project.ai) P.ai = project.ai;
  if (project.conf) {
    if (!P.conf) P.conf = {};
    for (var k in project.conf) {
      if (project.conf.hasOwnProperty(k)) P.conf[k] = project.conf[k];
    }
  }
}

// 当缓存被判为「官方剧本不完整」而整体跳过恢复时，会连用户自建剧本一起丢（安卓/网页无桌面 autoSave 兜底）。
// 真因：7MB 官方运行时快照走 requestIdleCallback 延迟注入，而 IndexedDB 恢复毫秒级先跑——若玩家在快照加载前
// 就创建剧本并触发 saveP，存档里官方花名册尚未平铺到顶层（<30），重启即被守卫判为不完整。
// 修：守卫触发时不再整体丢弃，而是「保留刚注册的官方数据 + 仅把用户自建剧本及其按 sid 归属的内容行合并回来」。
// 自建剧本=缓存里有、但当前 P.scenarios（register 脚本刚注册的官方剧本）里没有的那些；官方剧本绝不从陈旧缓存覆盖。
function _tmMergeCustomScenariosFromProject(project) {
  if (!project || !Array.isArray(project.scenarios)) return 0;
  if (!Array.isArray(P.scenarios)) P.scenarios = [];
  var existing = {};
  for (var i = 0; i < P.scenarios.length; i++) {
    var s0 = P.scenarios[i];
    if (s0 && s0.id != null) existing[s0.id] = true;
  }
  var customIds = {};
  var added = 0;
  for (var j = 0; j < project.scenarios.length; j++) {
    var s = project.scenarios[j];
    if (s && s.id != null && !existing[s.id]) {
      P.scenarios.push(s);
      existing[s.id] = true;
      customIds[s.id] = true;
      added++;
    }
  }
  if (!added) return 0;
  // 自建剧本按 sid 归属的内容行一并合并（空白剧本无行·此处自然跳过）
  var COLLS = ['characters', 'factions', 'parties', 'classes', 'variables', 'events', 'relations', 'items', 'rigidHistoryEvents'];
  for (var c = 0; c < COLLS.length; c++) {
    var key = COLLS[c];
    var srcRows = project[key];
    if (!Array.isArray(srcRows)) continue;
    if (!Array.isArray(P[key])) P[key] = [];
    var have = {};
    for (var h = 0; h < P[key].length; h++) {
      var er = P[key][h];
      if (er && er.sid != null && er.id != null) have[er.sid + '\u0001' + er.id] = true;
    }
    for (var r = 0; r < srcRows.length; r++) {
      var row = srcRows[r];
      if (!row || row.sid == null || !customIds[row.sid]) continue;   // 只收自建剧本的行·不碰官方行
      if (row.id != null) {
        var dk = row.sid + '\u0001' + row.id;
        if (have[dk]) continue;
        have[dk] = true;
      }
      P[key].push(row);
    }
  }
  return added;
}

function _tmEmitPRestored(source) {
  try {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    var ev;
    if (typeof CustomEvent === 'function') ev = new CustomEvent('tm:p-restored', { detail: { source: source } });
    else {
      ev = document.createEvent('Event');
      ev.initEvent('tm:p-restored', false, false);
      ev.detail = { source: source };
    }
    window.dispatchEvent(ev);
  } catch(_) {}
}

// 启动时恢复P（三层恢复：localStorage骨架 → IndexedDB完整 → 桌面端autoSave）
(function _restoreP(){
  // 层1: localStorage 骨架（同步，秒级启动）
  try {
    // 尝试旧格式 tm_P
    var s = localStorage.getItem('tm_P');
    if (s) {
      var saved = JSON.parse(s);
      if (_tmIsIncompleteOfficialProject(saved)) {
        _tmApplyMachinePrefsFromProject(saved);
        // 不整体丢弃：保留刚注册的官方剧本，仅把用户自建剧本合并回来
        var _mergedLite = _tmMergeCustomScenariosFromProject(saved);
        try { localStorage.removeItem('tm_P'); } catch(_){}
        console.warn('[restoreP] incomplete official cache from tm_P·保留官方·合并自建剧本 ' + _mergedLite + ' 个');
      } else {
        for (var key in saved) {
          if (saved.hasOwnProperty(key)) P[key] = saved[key];
        }
        console.log('[restoreP] 从localStorage(tm_P)恢复, scenarios:', P.scenarios.length);
        // 迁移：旧格式存在则写入IndexedDB并清理（tm-storage 后载·短轮询等就位·原 typeof 一次性检查恒 false=迁移死代码）
        (function _tmMigrateTmPWhenReady(tries) {
          if (typeof TM_SaveDB === 'undefined') { if (tries < 100 && typeof setTimeout === 'function') setTimeout(function() { _tmMigrateTmPWhenReady(tries + 1); }, 100); return; }
          TM_SaveDB.saveProject(_tmStripAiKeyInPlace(deepClone(P))).then(function() {
            try { localStorage.removeItem('tm_P'); } catch(e) {}
            console.log('[restoreP] 已迁移tm_P到IndexedDB');
          });
        })(0);
      }
    } else {
      // 新格式：从lite骨架恢复API配置 (R153 包内 try·防嵌套被外层 catch 误吞)
      var lite = null;
      try { lite = localStorage.getItem('tm_P_lite'); } catch(_){}
      if (lite) {
        var liteData = JSON.parse(lite);
        if (liteData.ai) P.ai = liteData.ai;
        // 同步恢复用户设置(conf)——必须早于剧本 register() 的 saveP·否则被默认 conf 覆盖(见 saveP 处注释)
        if (liteData.conf && typeof liteData.conf === 'object') {
          if (!P.conf) P.conf = {};
          for (var _ck in liteData.conf) {
            if (liteData.conf.hasOwnProperty(_ck)) P.conf[_ck] = liteData.conf[_ck];
          }
        }
        console.log('[restoreP] 从localStorage骨架恢复AI配置与用户设置');
      }
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'restoreP] localStorage恢复失败:') : console.warn('[restoreP] localStorage恢复失败:', e); }

  // 层2: IndexedDB 完整数据（异步，覆盖骨架）
  // 2026-07-04 审查定罪：tm-utils(index.html:490)先于 tm-storage(:592)加载·原 typeof 一次性检查恒 false——
  // saveP 的主存储(IDB current_project)只写不读·网页/安卓端自建剧本重启即丢(桌面被 autoSave 层3掩盖)。
  // 改为短轮询等 TM_SaveDB 就位(≤10s)·loadProject 本就是异步晚到语义·与原设计一致。
  (function _tmIdbRestoreWhenReady(tries) {
    if (typeof TM_SaveDB === 'undefined') {
      if (tries < 100 && typeof setTimeout === 'function') setTimeout(function() { _tmIdbRestoreWhenReady(tries + 1); }, 100); // vm 沙箱无 timer 则放弃(沙箱本就无 IDB)
      else if (tries >= 100) console.warn('[restoreP] TM_SaveDB 10s 未就位·IndexedDB 恢复层跳过');
      return;
    }
    TM_SaveDB.loadProject().then(function(fullP) {
      if (fullP && fullP.scenarios) {
        if (_tmIsIncompleteOfficialProject(fullP)) {
          _tmApplyMachinePrefsFromProject(fullP);
          // 不整体丢弃：保留刚注册的官方剧本，仅把用户自建剧本合并回来（修安卓/网页重启自建剧本消失）
          var _mergedN = _tmMergeCustomScenariosFromProject(fullP);
          console.warn('[restoreP] incomplete official cache from IndexedDB·保留官方·合并自建剧本 ' + _mergedN + ' 个');
          if (_mergedN && typeof showScnManage === 'function' && document.querySelector('.scn-page.show')) {
            showScnManage();
          }
          _tmEmitPRestored('indexeddb-incomplete-merge-custom');
          return;
        }
        for (var key in fullP) {
          if (fullP.hasOwnProperty(key) && key !== 'gameState' && key !== '_saveMeta') P[key] = fullP[key]; // 跳僵尸键·与层3同口径
        }
        console.log('[restoreP] 从IndexedDB恢复完整P, scenarios:', P.scenarios.length);
        // 如果已在剧本管理页，刷新显示
        if (typeof showScnManage === 'function' && document.querySelector('.scn-page.show')) {
          showScnManage();
        }
        _tmEmitPRestored('indexeddb');
      }
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'restoreP] IndexedDB恢复失败:') : console.warn('[restoreP] IndexedDB恢复失败:', e); });
  })(0);

  // 层3: 桌面端 autoSave
  if (window.tianming && window.tianming.isDesktop) {
    window.tianming.loadAutoSave().then(function(r) {
      if (r && r.success && r.data && r.data.scenarios) {
        for (var key in r.data) {
          if (r.data.hasOwnProperty(key) && key !== 'gameState' && key !== '_saveMeta') {
            P[key] = r.data[key];
          }
        }
        console.log('[restoreP] 从desktop autoSave补充恢复');
        _tmEmitPRestored('desktop-autosave');
      }
    }).catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'restoreP] desktop恢复失败:') : console.warn('[restoreP] desktop恢复失败:', e); });
  }
})();

// 通用AI调用
function _buildAIUrl(base){
  var u=(base||P.ai.url||"").replace(/\/+$/,"");
  if(!u)return u;
  if(u.indexOf("/chat/completions")>=0||u.indexOf("/messages")>=0)return u;
  return u+"/chat/completions";
}

// M3·判断次 API 是否配置完整且已启用·供调用方决定是否走次 tier
function _useSecondaryTier() {
  if (typeof P === 'undefined' || !P.ai || !P.ai.secondary) return false;
  if (!P.ai.secondary.key || !P.ai.secondary.url) return false;
  // 启用开关·默认 true（保持旧行为）·显式 false 则关闭
  if (P.conf && P.conf.secondaryEnabled === false) return false;
  return true;
}

// M3·按 tier 获取 AI 配置·secondary 未配时回退 primary
// tier: 'primary'|'secondary'·默认 primary
function _getAITier(tier) {
  var _s = P.ai && P.ai.secondary;
  if (tier === 'secondary' && _s && _s.key && _s.url) {
    return {
      key: _s.key,
      url: _s.url,
      model: _s.model || P.ai.model || 'gpt-4o-mini',
      tier: 'secondary'
    };
  }
  return {
    key: (P.ai && P.ai.key) || '',
    url: (P.ai && P.ai.url) || '',
    model: (P.ai && P.ai.model) || 'gpt-4o',
    tier: 'primary'
  };
}
function _buildAIUrlForTier(tier) {
  var cfg = _getAITier(tier);
  var u = (cfg.url || '').replace(/\/+$/, '');
  if (!u) return u;
  if (u.indexOf('/chat/completions') >= 0 || u.indexOf('/messages') >= 0) return u;
  return u + '/chat/completions';
}

// 存档脱敏·剥离玩家 AI key（key 真源在 localStorage['tm_api']，load 时 _preservedAi 会重新注入）
function _tmStripAiKeyInPlace(o){ // 用于 deepClone 出的独立副本：原地删 key
  if(o && o.ai && typeof o.ai==='object'){ try{ delete o.ai.key; if(o.ai.secondary&&typeof o.ai.secondary==='object') delete o.ai.secondary.key; }catch(_){} }
  return o;
}
function _tmStripAiKeyView(o){ // 用于直接序列化运行时 P：返回浅拷视图，不改原 o
  if(!o || !o.ai || typeof o.ai!=='object') return o;
  var v={},k; for(k in o) if(Object.prototype.hasOwnProperty.call(o,k)) v[k]=o[k];
  var ai={}; for(k in o.ai) if(Object.prototype.hasOwnProperty.call(o.ai,k)) ai[k]=o.ai[k];
  delete ai.key;
  if(ai.secondary&&typeof ai.secondary==='object'){ var s={},k2; for(k2 in ai.secondary) if(Object.prototype.hasOwnProperty.call(ai.secondary,k2)) s[k2]=ai.secondary[k2]; delete s.key; ai.secondary=s; }
  v.ai=ai; return v;
}
if(typeof window!=='undefined'){ window._tmStripAiKeyInPlace=_tmStripAiKeyInPlace; window._tmStripAiKeyView=_tmStripAiKeyView; }

// ── P.scenario 接线（2026-07-04 审查定罪）────────────────────────────────
// 全库约 40 处读 P.scenario(单数·科举朝代范式/宋特奏名/恩科名额/朝议/策命/称谓语言包)·
// 而运行时从无赋值——朝代特化逻辑整族静默落默认。正源 = P.scenarios.find(id===GM.sid)。
// 做成不可枚举 getter：不入 saveP/JSON 序列化(P 不翻倍)·P 被整体重赋值后须重装(见 fullLoadGame/SaveManager)。
// setter 允许显式赋值顶掉 getter(smoke 沙箱直接喂 P.scenario 的用法保持可用)。
function _tmInstallScenarioGetter(){
  try{
    if(typeof P==='undefined'||!P||typeof Object.defineProperty!=='function') return;
    var d=Object.getOwnPropertyDescriptor(P,'scenario');
    if(d&&d.get) return; // 已装
    Object.defineProperty(P,'scenario',{
      configurable:true,
      enumerable:false,
      get:function(){
        try{
          var g=(typeof GM!=='undefined')?GM:null;
          if(!g||!g.sid||!Array.isArray(P.scenarios)) return null;
          for(var i=0;i<P.scenarios.length;i++){var s=P.scenarios[i];if(s&&s.id===g.sid) return s;}
        }catch(_e){}
        return null;
      },
      set:function(v){ Object.defineProperty(P,'scenario',{value:v,writable:true,configurable:true,enumerable:false}); }
    });
  }catch(_e){}
}
if(typeof window!=='undefined') window._tmInstallScenarioGetter=_tmInstallScenarioGetter;
_tmInstallScenarioGetter();
