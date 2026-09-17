// The native account view never renders an unrelated dynasty's tax or palace presets.
(function (root) {
  'use strict';
  var active = null;
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) {
    return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
  }
  function render(g, kind) {
    try {
      var q = root.TM.NativeFiscal.quote(g),
        rows = q.accountRows.filter(function (r) {
          return r.kind === kind;
        }),
        label = kind === 'private' ? '私人账册' : '公共账册';
      var h =
        '<section data-tm-native-ledger="' +
        esc(kind) +
        '" style="padding:16px;line-height:1.8;color:var(--fg,var(--color-foreground,#d9c797))"><h3>' +
        label +
        '</h3>';
      if (!rows.length)
        return (
          h +
          '<p>本开局未配置' +
          (kind === 'private' ? '私库，未启用皇产收入或宫廷开销。' : '公共账户，不能推定初始库存。') +
          '</p></section>'
        );
      h +=
        '<p>按明确账户结算 · 本期 ' +
        num(q.turnDays) +
        ' 天；流入、流出为当前契约预期。</p><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th>账户／资源</th><th>库存</th><th>流入</th><th>应付</th><th>累计欠额</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var account = g.nativeWorld.accounts.find(function (a) {
            return a.id === r.id;
          }),
          fac = g.facs.find(function (f) {
            return f.id === account.ownerFactionId;
          }),
          t = kind === 'private' ? fac.privateTreasury : fac.treasury,
          l = t && t.ledgers && t.ledgers[r.resource];
        var name = r.name === r.id ? { money: '钱款', grain: '粮食', cloth: '布帛' }[r.resource] || r.resource : r.name;
        h +=
          '<tr><td>' +
          esc(name) +
          '<br><small>' +
          esc(r.id) +
          '</small></td><td>' +
          num(r.balance) +
          ' ' +
          esc(r.unit) +
          '</td><td>' +
          num(r.income) +
          '</td><td>' +
          num(r.expense) +
          '</td><td>' +
          num((l && l.deficit) || 0) +
          '</td></tr>';
      });
      h += '</tbody></table></div>';
      var taxes = (q.taxReceipts || []).filter(function (p) {
        return rows.some(function (r) {
          return r.id === p.accountId;
        });
      });
      if (taxes.length)
        h +=
          '<h4>按税权收取</h4><ul>' +
          taxes
            .map(function (p) {
              return (
                '<li>' +
                esc(p.regionName) +
                ' → ' +
                esc(p.accountId) +
                '：' +
                num(p.amount) +
                ' ' +
                esc(p.unit) +
                '</li>'
              );
            })
            .join('') +
          '</ul><p>主权与实控变化不会自动转移税权。</p>';
      h += '<h4>本期明确支付</h4>';
      var payments = q.payments.filter(function (p) {
        return rows.some(function (r) {
          return r.id === p.accountId;
        });
      });
      h += payments.length
        ? '<ul>' +
          payments
            .map(function (p) {
              return (
                '<li>' +
                esc(p.category === 'army' ? '军饷' : '官俸') +
                ' · ' +
                esc(p.targetId) +
                ' → ' +
                esc(p.accountId) +
                '：' +
                num(p.amount) +
                '</li>'
              );
            })
            .join('') +
          '</ul>'
        : '<p>无已配置的官俸或军饷；空缺席位不计俸禄。</p>';
      return (
        h +
        '<p style="opacity:.8">当前支持固定流量和显式税基／税权结算；未实现的地方税制、临时财政动作会单独报缺项，不套用旧朝代预设。</p></section>'
      );
    } catch (e) {
      return (
        '<section data-tm-native-ledger-error><p>账目契约待修正：' +
        esc(e.message) +
        '</p><p>未改动库存。</p></section>'
      );
    }
  }
  function close() {
    if (!active) return;
    var old = active;
    active = null;
    root.document.removeEventListener('pointerdown', old.outside, true);
    old.panel.remove();
  }
  function open(kind) {
    if (['public', 'private'].indexOf(kind) < 0 || !root.document || !root.TM.NativeFiscal.enabled(root.GM))
      return false;
    close();
    var panel = root.document.createElement('section');
    panel.id = 'tm-native-fiscal-panel';
    panel.setAttribute('popover', 'manual');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', kind === 'public' ? '公共账册' : '私人账册');
    panel.style.cssText =
      'position:fixed;inset:auto 16px 24px auto;top:92px;margin:0;width:min(700px,90vw);max-width:calc(100vw - 32px);max-height:calc(100vh - 116px);overflow:auto;border:1px solid #a88b4c;border-radius:8px;background:#241e15;color:#e4d1a6;box-shadow:0 12px 40px #0009;z-index:2147483601;font-size:16px;';
    var button = root.document.createElement('button');
    button.type = 'button';
    button.textContent = '关闭账册';
    button.setAttribute('aria-label', '关闭账册');
    button.style.cssText =
      'float:right;margin:12px;padding:8px 16px;background:#e4d1a6;color:#382b1f;border:1px solid #a88b4c;border-radius:4px;cursor:pointer;';
    button.onclick = close;
    panel.append(button);
    var content = root.document.createElement('div');
    content.innerHTML = render(root.GM, kind);
    panel.append(content);
    function outside(e) {
      if (!panel.contains(e.target) && !(e.target.closest && e.target.closest('#topbar'))) {
        close();
      }
    }
    active = { panel: panel, outside: outside };
    root.document.body.append(panel);
    if (typeof panel.showPopover === 'function') panel.showPopover();
    panel.style.setProperty('display', 'block', 'important');
    root.document.addEventListener('pointerdown', outside, true);
    button.focus();
    return true;
  }
  root.TM = root.TM || {};
  root.TM.NativeFiscalUI = { render: render, open: open, close: close };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TM.NativeFiscalUI;
})(typeof window !== 'undefined' ? window : globalThis);
