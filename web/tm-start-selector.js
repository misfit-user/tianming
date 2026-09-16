// Native profile selection: local summaries, one confirmed candidate, no inference calls.
(function (root) {
  'use strict';
  if (root.TM && root.TM.NativeStart) return;
  var active = null;
  function tm() {
    return root.TM || {};
  }
  function busy() {
    return !!(tm().StartCommit && tm().StartCommit.busy());
  }
  function valid(job) {
    return (
      active === job &&
      !job.abort.signal.aborted &&
      Number(root._tmStartRequestEpoch || 0) === job.epoch &&
      root.GM === job.lease.gm &&
      root.P === job.lease.p
    );
  }
  function node(tag, text, cls) {
    var n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function cancel(restore) {
    if (!active) return true;
    if (busy()) return false;
    var job = active;
    active = null;
    job.abort.abort();
    if (job.source) tm().StartCompiler.cancel(job.source);
    if (job.overlay) job.overlay.remove();
    if (restore !== false && typeof root._tmStartRestoreSelectionAfterFailure === 'function')
      root._tmStartRestoreSelectionAfterFailure(job.epoch);
    return true;
  }
  function installStyle() {
    if (document.getElementById('tm-native-start-style')) return;
    var s = node('style');
    s.id = 'tm-native-start-style';
    s.textContent =
      '.tm-ns-overlay{position:fixed;inset:0;z-index:22000;background:rgba(15,12,8,.88);display:grid;place-items:center;padding:3vh 3vw;box-sizing:border-box}.tm-ns-book{width:min(1100px,94vw);height:88vh;background:#f4ecd8;color:#382b1f;border:1px solid #bba778;border-radius:9px;box-shadow:0 16px 80px #000a;display:flex;flex-direction:column;font-family:var(--font),serif;overflow:hidden}.tm-ns-head{display:flex;gap:20px;align-items:center;padding:20px 25px;border-bottom:1px solid #c9b994}.tm-ns-head h2{margin:0;font-weight:normal;letter-spacing:.2em}.tm-ns-head button{margin-left:auto}.tm-ns-body{display:grid;grid-template-columns:minmax(230px,34%) 1fr;flex:1;min-height:0}.tm-ns-nav{padding:18px;border-right:1px solid #c9b994;overflow:auto}.tm-ns-search{box-sizing:border-box;width:100%;padding:10px;background:#fff9;border:1px solid #b7a47d;color:#382b1f;font:inherit}.tm-ns-cards{display:flex;flex-direction:column;gap:8px;margin-top:12px}.tm-ns-card{font:inherit;text-align:left;padding:12px;background:#efe4c7;border:1px solid #c9b994;color:#382b1f;cursor:pointer;border-radius:4px}.tm-ns-card[aria-pressed=true]{border-color:#8b3028;background:#e6d5ad;box-shadow:inset 3px 0 #8b3028}.tm-ns-card small{display:block;opacity:.8;margin-top:4px}.tm-ns-detail{padding:25px;overflow:auto;line-height:1.8}.tm-ns-detail h3{font-size:26px;letter-spacing:.14em;margin:0 0 10px;color:#842e27}.tm-ns-detail dl{display:grid;grid-template-columns:6em 1fr;gap:7px 16px}.tm-ns-detail dt{color:#7b684d}.tm-ns-detail dd{margin:0}.tm-ns-foot{padding:16px 25px;border-top:1px solid #c9b994;display:flex;gap:15px;align-items:center}.tm-ns-status{flex:1;overflow-wrap:anywhere;font-size:14px}.tm-ns-btn{border:1px solid #a98f62;background:#e6d6ad;color:#493422;padding:8px 16px;font:inherit;cursor:pointer;border-radius:4px}.tm-ns-start{background:#89342b;border-color:#6b251f;color:#fff1d0}.tm-ns-btn:disabled{opacity:.5;cursor:default}@media(max-width:650px){.tm-ns-body{grid-template-columns:1fr;grid-template-rows:42% 1fr}.tm-ns-nav{border-right:0;border-bottom:1px solid #c9b994}.tm-ns-detail{padding:15px}.tm-ns-head{padding:12px}.tm-ns-foot{padding:12px}}';
    document.head.appendChild(s);
  }
  function assets(s, ref) {
    var row = (s.nativeStart.assets || []).find(function (x) {
      return x.assetId === ref.assetId;
    });
    if (row && row.encoding === 'utf8' && typeof row.text === 'string')
      return Promise.resolve(new root.TextEncoder().encode(row.text));
    if (tm().WorkbenchAssets && typeof tm().WorkbenchAssets.resolve === 'function')
      return tm().WorkbenchAssets.resolve(ref, s.projectId);
    return Promise.reject(new Error('缺少锁定地图资产，请导入配套资产后重试；不会改用其他版本'));
  }
  async function open(scenario, epoch) {
    cancel(false);
    installStyle();
    var job = {
      epoch: epoch,
      abort: new root.AbortController(),
      lease: {
        gm: root.GM,
        p: root.P,
        epoch: epoch,
        turn: root.GM && root.GM.turn,
        loadGen: Number(root._tmLoadGen || 0),
        sourceScenario: scenario,
      },
      selected: null,
      phase: 'loading',
      unconfigured: [],
    };
    active = job;
    var overlay = node('dialog', null, 'tm-ns-overlay'),
      book = node('section', null, 'tm-ns-book');
    job.overlay = overlay;
    // The top layer isolates selection from an existing world's tutorial/modals without deleting them.
    Object.assign(overlay.style, {
      margin: '0',
      border: '0',
      maxWidth: 'none',
      maxHeight: 'none',
      width: '100vw',
      height: '100vh',
    });
    overlay.id = 'tm-native-start-selector';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '选择开局身份');
    var head = node('header', null, 'tm-ns-head');
    head.append(node('h2', '择势 · 定身'));
    var close = node('button', '返回', 'tm-ns-btn');
    close.type = 'button';
    head.append(close);
    var body = node('div', null, 'tm-ns-body'),
      nav = node('div', null, 'tm-ns-nav'),
      search = node('input', null, 'tm-ns-search');
    search.type = 'search';
    search.placeholder = '搜索势力、人物、别名或 ID';
    search.setAttribute('aria-label', '搜索开局身份');
    var cards = node('div', null, 'tm-ns-cards'),
      detail = node('article', '读取身份目录…', 'tm-ns-detail'),
      foot = node('footer', null, 'tm-ns-foot'),
      status = node('div', '正在校验本地源数据…', 'tm-ns-status'),
      start = node('button', '以此身份开局', 'tm-ns-btn tm-ns-start');
    var playOptions = {},
      optionControls = [];
    foot.style.flexWrap = 'wrap';
    [
      [
        'gameMode',
        '模式',
        [
          ['yanyi', '演义'],
          ['light_hist', '轻度史实'],
          ['strict_hist', '严格史实'],
        ],
      ],
      [
        'difficulty',
        '难度',
        [
          ['narrative', '叙事'],
          ['standard', '标准'],
          ['hardcore', '硬核'],
        ],
      ],
    ].forEach(function (spec) {
      var label = node('label', spec[1] + ' '),
        select = node('select');
      select.dataset.setting = spec[0];
      select.setAttribute('aria-label', spec[1]);
      select.style.cssText =
        'padding:7px;border:1px solid #a98f62;border-radius:4px;background:#efe4c7;color:#382b1f;font:inherit;';
      spec[2].forEach(function (pair) {
        var o = node('option', pair[1]);
        o.value = pair[0];
        select.append(o);
      });
      var prior = root.P && root.P.conf && root.P.conf[spec[0]];
      select.value = spec[2].some(function (p) {
        return p[0] === prior;
      })
        ? prior
        : spec[0] === 'gameMode'
          ? 'yanyi'
          : 'standard';
      playOptions[spec[0]] = select.value;
      select.addEventListener('change', function () {
        playOptions[spec[0]] = select.value;
      });
      label.append(select);
      foot.append(label);
      optionControls.push(select);
    });
    status.setAttribute('role', 'status');
    start.type = 'button';
    start.disabled = true;
    nav.append(search, cards);
    body.append(nav, detail);
    foot.append(status, start);
    book.append(head, body, foot);
    overlay.append(book);
    document.body.append(overlay);
    overlay.showModal();
    overlay.addEventListener('cancel', function (e) {
      e.preventDefault();
      cancel(true);
    });
    if (typeof root.hideLoading === 'function') root.hideLoading();
    close.addEventListener('click', function () {
      cancel(true);
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel(true);
      }
    });
    function show(p) {
      if (job.phase !== 'choosing') return;
      job.selected = p;
      var v = p.summary || {},
        roles = { headOfState: '元首', regent: '摄政', delegatedRepresentative: '受托代表' },
        evidence = { attested: '史料记载', reconstructed: '推定重建', fictional: '作者原创', unknown: '待核' };
      detail.replaceChildren(
        node('h3', v.characterName || '身份缺失'),
        node(
          'p',
          (v.factionName || '势力缺失') +
            ' · ' +
            (roles[v.roleKind] || v.roleKind || '身份待核') +
            ' · ' +
            (evidence[v.evidenceStatus] || '待核'),
        ),
      );
      var dl = node('dl');
      [
        ['身份 ID', v.characterId],
        ['势力 ID', v.factionId],
        ['政体', v.politicalType || '未载'],
        ['驻地', v.regionName || v.regionId],
        ['疆域', v.territoryCount == null ? '未载' : v.territoryCount + ' 地区'],
        ['兵额', v.soldiers == null ? '未载' : v.soldiers + ' 人'],
        [
          '初库',
          (v.accounts || [])
            .map(function (a) {
              return a.balance + ' ' + a.unit + '（' + (a.kind === 'private' ? '私库' : '公库') + '）';
            })
            .join('；') || '未配置',
        ],
        ['开局压力', v.startPressure || '未载'],
      ].forEach(function (pair) {
        dl.append(node('dt', pair[0]), node('dd', pair[1] || '—'));
      });
      detail.append(dl);
      var issues = (job.source.catalog.errors || [])
        .concat(p.errors || [])
        .map(function (x) {
          return x.message;
        })
        .concat(p.disabledReasons || []);
      if (typeof v.openingText === 'string')
        detail.append(node('h4', '开场预览'), node('p', v.openingText || '（此身份未设置开场文字）'));
      if (issues.length) detail.append(node('p', '不可开始：' + issues.join('；')));
      start.disabled = !p.enabled;
      status.textContent = p.enabled
        ? '仅确认后准备一个新世界；不调用 AI 生成身份。'
        : '缺项需作者补齐，当前游戏未改动。';
      cards.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.profile === p.id));
      });
    }
    function render() {
      cards.replaceChildren();
      var query = search.value.trim().toLocaleLowerCase(),
        rows = tm()
          .StartCompiler.previews(job.source, search.value)
          .concat(
            job.unconfigured.filter(function (p) {
              return (
                !query ||
                [p.summary.factionId, p.summary.factionName]
                  .concat(p.summary.aliases || [])
                  .join('\n')
                  .toLocaleLowerCase()
                  .indexOf(query) >= 0
              );
            }),
          );
      rows.forEach(function (p) {
        var v = p.summary || {},
          b = node('button', v.factionName || p.id, 'tm-ns-card');
        b.type = 'button';
        b.dataset.profile = p.id;
        b.setAttribute('aria-pressed', String(job.selected && job.selected.id === p.id));
        b.append(node('small', (v.characterName || '人物缺失') + (p.enabled ? '' : ' · 缺项')));
        b.addEventListener('click', function () {
          show(p);
        });
        cards.append(b);
      });
      if (!rows.length) cards.append(node('p', '没有匹配的身份'));
      status.textContent = '共 ' + rows.length + ' 项；预览不复制完整世界。';
    }
    search.addEventListener('input', function () {
      if (job.phase === 'choosing') render();
    });
    start.addEventListener('click', async function () {
      if (job.phase !== 'choosing' || !job.selected || !job.selected.enabled || !valid(job)) return;
      job.phase = 'preparing';
      start.disabled = true;
      search.disabled = true;
      cards.querySelectorAll('button').forEach(function (b) {
        b.disabled = true;
      });
      optionControls.forEach(function (s) {
        s.disabled = true;
      });
      try {
        var candidate = await tm().StartCompiler.compile(job.source, job.selected.id, {
          sessionId: 'start-' + epoch + '-' + Date.now().toString(36),
          signal: job.abort.signal,
          resolveMapAsset: function (ref) {
            return assets(scenario, ref);
          },
        });
        if (!valid(job)) return;
        var source = tm().NativeWorld.prepareScenario(candidate);
        source.startContext.playOptions = Object.assign({}, playOptions);
        var prepared = await tm().StartPreparation.prepare(source, {
          signal: job.abort.signal,
          expectedIdentity: { scenarioId: source.id, characterId: source.startContext.playerCharacterId },
          onProgress: function (p) {
            if (!valid(job)) return;
            status.textContent =
              p.phase === 'resources'
                ? '正在校验原生资源 ' + (p.completed || 0) + ' / ' + (p.total || '…')
                : p.phase === 'initializing'
                  ? '正在隔离环境初始化新世界…'
                  : p.phase === 'verifying'
                    ? '正在回读新世界快照…'
                    : '正在准备原生运行环境…';
          },
        });
        if (!valid(job)) return;
        job.phase = 'committing';
        close.disabled = true;
        status.textContent = '校验通过，正在提交新局与本地存档…';
        job.receipt = await tm().StartCommit.commit(prepared, job.lease);
        job.phase = 'started';
        overlay.remove();
        active = null;
        if (typeof root.toast === 'function') root.toast('已以 ' + candidate.summary.characterName + ' 开局并保存');
      } catch (e) {
        if (job.abort.signal.aborted || active !== job) return;
        job.phase = 'failed';
        close.disabled = false;
        status.textContent = '未完成：' + e.message + '。原局受事务保护，可返回后重试。';
      }
    });
    try {
      var issues = tm().NativeWorld.inspect(scenario);
      if (issues.length)
        throw new Error(
          issues
            .map(function (x) {
              return x.message;
            })
            .join('；'),
        );
      job.source = await tm().StartCompiler.createSource(scenario, {
        capabilities: tm().NativeWorld.capabilities,
        signal: job.abort.signal,
      });
      job.lease.sourceHash = job.source.hash;
      var configured = new Set(
        job.source.catalog.profiles.map(function (p) {
          return p.summary && p.summary.factionId;
        }),
      );
      job.unconfigured = (scenario.factions || [])
        .filter(function (f) {
          return !configured.has(f.id);
        })
        .map(function (f) {
          return {
            id: 'unconfigured:' + f.id,
            enabled: false,
            summary: { factionId: f.id, factionName: f.name, aliases: f.aliases || [] },
            disabledReasons: ['此势力未配置可用开局人物、政治授权与规则；不会自动生成或套用其他身份。'],
          };
        });
      if (!valid(job)) {
        if (job.source) tm().StartCompiler.cancel(job.source);
        return;
      }
      job.phase = 'choosing';
      render();
      var first = job.source.catalog.profiles[0];
      if (first) show(first);
      else detail.textContent = '未配置任何开局身份。';
      search.focus();
    } catch (e) {
      if (active === job) {
        job.phase = 'failed';
        detail.textContent = e.message;
        status.textContent = '源数据不可用于本次开局；当前世界未改动。';
      }
    }
  }
  root.TM = root.TM || {};
  root.TM.NativeStart = {
    open: open,
    cancel: cancel,
    busy: busy,
    status: function () {
      return active
        ? { phase: active.phase, epoch: active.epoch, profileId: active.selected && active.selected.id }
        : { phase: 'idle' };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
