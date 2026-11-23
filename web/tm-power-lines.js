/* tm-power-lines.js — 职权按线列权能（总纲 3.2、3.15，同志 11-23 定）
 *
 * 一条权力线在线内把这份权责完整分工，拆成几个权能；权能挂在具体职位上，职位的 powers 里记「线.权能」为 true。
 * 先只有外交一条：谈判、署名、定夺。别的线做到时一条一条并进来；还没并进来的旧键（任免、调兵、九权……）照旧按原名问。
 *
 * 旧键照认，旧档、外藩补的职任都不用改：
 *   diplomacy（先前的「谈」）算谈判；treatySign（先前的「签」）算署名加定夺。
 *   反过来按旧名问也认新记法：问 diplomacy 认谈判，问 treatySign 认定夺。
 * 署名分级（国书、部文、边书）记在职位的 authorityScope.signLevel；没写的，握定夺的算国书，其余算边书。
 */
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  var LINES = [
    {
      id: 'diplomacy', name: '外交',
      powers: [
        { id: 'negotiate', name: '谈判', desc: '收对方的书，见对方的使，问来意，递条款，还价；谈出来的是草约，不算本方答应' },
        { id: 'sign', name: '署名', desc: '以自己的名义发外交文书，办已定之约的细节（交割、贡期、互市细则）' },
        { id: 'decide', name: '定夺', desc: '定本方答不答应：准、驳、改、交廷议、留中；和战、结盟、册封、和亲、开互市、岁币、割地' }
      ]
    }
  ];
  var SIGN_LEVELS = [
    { id: 'state', name: '国书' },
    { id: 'ministry', name: '部文' },
    { id: 'border', name: '边书' }
  ];
  // 旧键能算作哪几个权能
  var LEGACY = { diplomacy: ['diplomacy.negotiate'], treatySign: ['diplomacy.sign', 'diplomacy.decide'] };
  // 按旧名问时，新记法里哪一个算数
  var OLD_NAME_ASKS = { diplomacy: 'diplomacy.negotiate', treatySign: 'diplomacy.decide' };

  function keyOf(line, power) { return line + '.' + power; }
  function lineOf(id) {
    for (var i = 0; i < LINES.length; i++) if (LINES[i].id === id) return LINES[i];
    return null;
  }
  function isObject(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  // 职位有没有这项权：name 是「线.权能」，或还没并进线的旧键
  function holds(powers, name) {
    if (!isObject(powers) || !name) return false;
    if (powers[name] === true) return true;
    var olds = Object.keys(LEGACY);
    for (var i = 0; i < olds.length; i++) {
      if (powers[olds[i]] === true && LEGACY[olds[i]].indexOf(name) >= 0) return true;
    }
    var asked = OLD_NAME_ASKS[name];
    return !!asked && powers[asked] === true;
  }

  // 职位在一条线上握哪几项（权能编号，按线里的次序）
  function held(powers, line) {
    var l = lineOf(line);
    if (!l) return [];
    return l.powers.filter(function (p) { return holds(powers, keyOf(line, p.id)); }).map(function (p) { return p.id; });
  }

  // 改一条线上握的几项：只动这条线的键，别的键一个不碰。
  // 握的与原来一样就原样不动；要改时，先把这条线的旧键展开成新记法再改，免得旧键把去掉的那项又算回来。
  function write(powers, line, ids) {
    var l = lineOf(line);
    var out = isObject(powers) ? powers : {};
    if (!l) return out;
    var want = l.powers.map(function (p) { return p.id; }).filter(function (id) { return (ids || []).indexOf(id) >= 0; });
    if (held(out, line).join(',') === want.join(',')) return out;
    Object.keys(LEGACY).forEach(function (old) {
      var mine = LEGACY[old].every(function (k) { return k.indexOf(line + '.') === 0; });
      if (!mine || !(old in out)) return;
      if (out[old] === true) LEGACY[old].forEach(function (k) { out[k] = true; });
      delete out[old];
    });
    l.powers.forEach(function (p) {
      var k = keyOf(line, p.id);
      if (want.indexOf(p.id) >= 0) out[k] = true; else delete out[k];
    });
    return out;
  }

  // 署名的级：写了的照写的；没写的，握定夺的算国书，其余算边书
  function signLevel(position) {
    var scope = position && position.authorityScope;
    var lv = scope && scope.signLevel;
    if (SIGN_LEVELS.some(function (s) { return s.id === lv; })) return lv;
    return holds(position && position.powers, 'diplomacy.decide') ? 'state' : 'border';
  }

  // 「外交·谈判」这样的名字；不是线上的权能就原样返回
  function label(name) {
    var parts = String(name || '').split('.');
    var l = parts.length === 2 ? lineOf(parts[0]) : null;
    var p = l && l.powers.filter(function (x) { return x.id === parts[1]; })[0];
    return p ? l.name + '·' + p.name : String(name || '');
  }

  TM.PowerLines = {
    LINES: LINES, SIGN_LEVELS: SIGN_LEVELS, LEGACY: LEGACY,
    keyOf: keyOf, lineOf: lineOf, holds: holds, held: held, write: write, signLevel: signLevel, label: label
  };
})(typeof window !== 'undefined' ? window : globalThis);
