// ============================================================
// tm-shell-extras.js — preview-shell v7.1 shell 面板注入
// 为左右抽屉补充预览中独有的面板（边患/学派/物价/典藏/宫殿/祭祀/监察/宫廷日程/朝代主题等）
// 依赖 GM / P 但提供 fallback 静态内容（数据缺失时仍有样式）
// ============================================================

(function(){
  function $(id){ return document.getElementById(id); }
  function esc(s){
    if (s == null) return '';
    // 对象 → 尝试取常见文本字段·否则返空（避免"[object Object]"）
    if (typeof s === 'object') {
      if (s.name) s = s.name;
      else if (s.label) s = s.label;
      else if (s.value) s = s.value;
      else if (s.text) s = s.text;
      else if (s.type) s = s.type;
      else return '';
    }
    return String(s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
  }
  function num(n){ n=Number(n)||0; if(Math.abs(n)>=10000) return (n/10000).toFixed(1).replace(/\.0$/,'')+'万'; if(Math.abs(n)>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'千'; return String(Math.round(n)); }

  // ─────────────────────── 左抽屉 shell extras ───────────────────────
  window._renderShellExtrasLeft = function(gl){
    if (!gl || typeof GM === 'undefined' || !GM.running) return;

    // 1. 朝代主题
    var dyn = document.createElement('div');
    dyn.className = 'gs-panel p-dyn';
    dyn.setAttribute('data-panel-key','dyn');
    var _phase='衰 期', _phaseTxt='魏阉初除·党争未息·外虏压境·天象示警';
    if (GM.eraState) {
      var _dp = GM.eraState.dynastyPhase || 'peak';
      var _phaseMap = { founding:'草创·', rising:'兴 期', peak:'盛 世', stable:'守 成', decline:'衰 期', collapse:'末 路' };
      _phase = _phaseMap[_dp] || '守 成';
      if (GM.eraState.contextDescription) _phaseTxt = GM.eraState.contextDescription;
    }
    dyn.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">朝 代 主 题</div><span class="gs-panel-cnt">'+esc(_phase.replace(/\s+/g,''))+'</span></div>'
      + '<div class="gs-dyn-arc"><span class="phase">'+esc(_phase)+'</span>'+esc(_phaseTxt)+'</div>';
    gl.appendChild(dyn);

    // 2. 四时物候
    var wp = document.createElement('div');
    wp.className = 'gs-panel p-weather';
    wp.setAttribute('data-panel-key','weather');
    var _mon = (((GM.turn||1)-1)%12)+1;
    var _seas='秋',_seasTxt='秋分',_seasDesc='鸿雁南飞';
    if(_mon>=3&&_mon<=5){_seas='春';_seasTxt=['孟春','仲春','季春'][_mon-3];_seasDesc=['东风解冻','雷乃发声','萍始生'][_mon-3];}
    else if(_mon>=6&&_mon<=8){_seas='夏';_seasTxt=['孟夏','仲夏','季夏'][_mon-6];_seasDesc=['蝼蝈鸣','蜩始鸣','腐草为萤'][_mon-6];}
    else if(_mon>=9&&_mon<=11){_seas='秋';_seasTxt=['孟秋','仲秋','季秋'][_mon-9];_seasDesc=['凉风至','鸿雁来','草木黄落'][_mon-9];}
    else{_seas='冬';var _wi=(_mon===12?0:_mon+1);_seasTxt=['孟冬','仲冬','季冬'][_wi];_seasDesc=['水始冰','蚯蚓结','鸡始乳'][_wi];}
    var _disasterTxt = '风调雨顺';
    if (GM.activeDisasters && GM.activeDisasters.length) _disasterTxt = (GM.activeDisasters[0].name || GM.activeDisasters[0].type || '异常');
    wp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">四 时 物 候</div><span class="gs-panel-cnt">'+_seasTxt+'</span></div>'
      + '<div class="gs-weather-panel"><div class="gs-season-disc" data-season="'+_seas+'"></div>'
      + '<div class="gs-season-info">'
      + '<div class="gs-season-row"><span class="k">天象</span><span class="v">'+esc(_disasterTxt)+'</span></div>'
      + '<div class="gs-season-row"><span class="k">物候</span><span class="v">'+_seasDesc+'</span></div>'
      + '<div class="gs-season-row"><span class="k">月</span><span class="v">第'+_mon+'月</span></div>'
      + '</div></div>';
    gl.appendChild(wp);

    // 2.5 势力格局
    if (GM.facs && GM.facs.length){
      var fp2 = document.createElement('div');
      fp2.className='gs-panel p-fac';
      fp2.setAttribute('data-panel-key','fac');
      var _fHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">势 力 格 局</div><span class="gs-panel-cnt">'+GM.facs.length+'</span></div>';
      GM.facs.slice(0,8).forEach(function(f){
        var att = f.attitude || '中立';
        var attCls='neutral', fCls='f-neutral';
        if (/友好|联盟/.test(att)){ attCls='friend'; fCls='f-friend'; }
        else if (/敌对|交战|敌视/.test(att)){ attCls='hostile'; fCls='f-hostile'; }
        else if (/附属|宗主|朝贡/.test(att)){ attCls='vassal'; fCls='f-vassal'; }
        if (f.isPlayer) fCls='f-self';
        _fHtml += '<div class="gs-fac-row '+fCls+'" onclick="if(typeof viewFac===\'function\')viewFac(\''+esc(f.name)+'\');else if(typeof openFacPanel===\'function\')openFacPanel();">'
          + '<span class="gs-fac-color"></span>'
          + '<div class="gs-fac-info"><div class="gs-fac-name">'+esc(f.name)+'</div>'
          + '<div class="gs-fac-leader">'+esc((f.leader||'')+(f.territory?' · '+f.territory:''))+'</div></div>'
          + '<span class="gs-fac-att '+attCls+'">'+esc(att)+'</span>'
          + '<span class="gs-fac-str">'+(f.strength||50)+'</span></div>';
      });
      fp2.innerHTML=_fHtml;
      gl.appendChild(fp2);
    }

    // 2.6 党派纷争
    if (GM.parties && GM.parties.length){
      var pp2 = document.createElement('div');
      pp2.className='gs-panel p-party';
      pp2.setAttribute('data-panel-key','party');
      var _pHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">党 派 纷 争</div><span class="gs-panel-cnt">'+GM.parties.length+'</span></div>';
      var _partyColors = ['var(--celadon-400,#7eb8a7)','var(--purple-400,#8e6aa8)','var(--indigo-400,#5a6fa8)','var(--amber-400,#c9a045)','var(--gold-400)'];
      GM.parties.slice(0,6).forEach(function(p, pi){
        var inf = p.influence||0;
        _pHtml += '<div class="gs-party-row" onclick="if(typeof openPartyDetailPanel===\'function\')openPartyDetailPanel();">'
          + '<span class="gs-party-name">'+esc(p.name)+'</span>'
          + '<span class="gs-party-infl"><span class="gs-party-bar"><span class="gs-party-fill" style="width:'+Math.min(100,inf)+'%;background:'+_partyColors[pi%5]+';"></span></span>'
          + '<span class="gs-party-val">'+Math.round(inf)+'</span></span></div>';
      });
      pp2.innerHTML=_pHtml;
      gl.appendChild(pp2);
    }

    // 2.7 阶层动静
    if (GM.classes && GM.classes.length){
      var cp3 = document.createElement('div');
      cp3.className='gs-panel p-class';
      cp3.setAttribute('data-panel-key','class');
      var _cHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">阶 层 动 静</div><span class="gs-panel-cnt">'+GM.classes.length+'</span></div>';
      var _classColors = {'士':'var(--gold-400)','农':'var(--celadon-400,#7eb8a7)','工':'var(--amber-400,#c9a045)','商':'var(--indigo-400,#5a6fa8)','军':'var(--vermillion-400)','宗':'var(--purple-400,#8e6aa8)'};
      GM.classes.forEach(function(c){
        var _mood = (c.loyalty||c.mood||50)>65 ? 'stable' : (c.loyalty||c.mood||50)>40 ? 'unrest' : 'angry';
        var _moodTxt = _mood === 'stable' ? '安' : _mood === 'unrest' ? '躁' : '怨';
        var _icon = c.name ? c.name.charAt(0) : '?';
        var _col = _classColors[_icon] || 'var(--gold-400)';
        _cHtml += '<div class="gs-class-row" onclick="if(typeof openClassDetailPanel===\'function\')openClassDetailPanel();">'
          + '<span class="gs-class-icon" style="--c-c:'+_col+';">'+esc(_icon)+'</span>'
          + '<span class="gs-class-name">'+esc(c.name)+'</span>'
          + '<span class="gs-class-pop">'+(c.populationPct||c.percent||'?')+'%</span>'
          + '<span class="gs-class-mood '+_mood+'">'+_moodTxt+'</span></div>';
      });
      cp3.innerHTML=_cHtml;
      gl.appendChild(cp3);
    }

    // 2.8 军事要务
    if (GM.armies && GM.armies.length){
      var mp2 = document.createElement('div');
      mp2.className='gs-panel p-army';
      mp2.setAttribute('data-panel-key','army');
      var _mHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">军 事 要 务</div><span class="gs-panel-cnt">'+GM.armies.length+'</span></div>';
      // 找出玩家势力名（用于 chip 着色）
      var _myFac = '';
      try {
        var _pc = (GM.chars||[]).find(function(c){return c&&c.isPlayer;});
        if (_pc) _myFac = _pc.faction || '';
      } catch(_){}
      GM.armies.slice(0,6).forEach(function(a){
        var size = a.size || a.troops || a.soldiers || a.strength || a.initialTroops || 0;
        var morale = a.morale || 70;
        var mColor = morale>75 ? 'var(--celadon-400,#7eb8a7)' : morale>55 ? 'var(--amber-400,#c9a045)' : 'var(--vermillion-400)';
        // 势力 chip·本朝 / 敌对 / 中立 三色
        var _fac = a.faction || '';
        var _facChip = '';
        if (_fac) {
          var _isOurs = _myFac && _fac === _myFac;
          var _chipColor = _isOurs ? 'rgba(184,154,83,0.25);color:#e8d49a' : 'rgba(184,71,56,0.25);color:#e8b8a8';
          _facChip = '<span style="background:'+_chipColor+';padding:0 5px;border-radius:3px;font-size:0.72rem;margin-left:4px;">'+esc(_fac)+(_isOurs?'·我':'·外')+'</span>';
        }
        _mHtml += '<div class="gs-army-row" onclick="if(typeof openMilitaryDetailPanel===\'function\')openMilitaryDetailPanel();">'
          + '<span class="gs-army-icon">⚔</span>'
          + '<div class="gs-army-info"><div class="gs-army-name">'+esc(a.name||'军')+_facChip+'</div>'
          + '<div class="gs-army-loc">'+esc((a.location||a.stationed||'')+(a.commander?' · '+a.commander:''))+'</div></div>'
          + '<div style="text-align:right;"><div class="gs-army-size">'+num(size)+'</div>'
          + '<div class="gs-army-morale"><div class="gs-army-morale-fill" style="width:'+Math.min(100,morale)+'%;background:'+mColor+';"></div></div></div></div>';
      });
      mp2.innerHTML=_mHtml;
      gl.appendChild(mp2);
    }

    // 2.9 行政区划
    if (P && P.adminHierarchy){
      var ap2 = document.createElement('div');
      ap2.className='gs-panel p-admin';
      ap2.setAttribute('data-panel-key','admin');
      var _divs = [];
      Object.keys(P.adminHierarchy).forEach(function(fk){
        var fh = P.adminHierarchy[fk]; if (!fh || !fh.divisions) return;
        fh.divisions.forEach(function(d){ _divs.push(d); });
      });
      var _aHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">行 政 区 划</div><span class="gs-panel-cnt">'+_divs.length+' 省</span></div>';
      _divs.sort(function(a,b){return (b.unrest||0)-(a.unrest||0);});
      _divs.slice(0,10).forEach(function(d){
        var unrest = d.unrest || 0;
        var cls = unrest>70 ? 'crisis' : unrest>50 ? 'war' : unrest<25 ? 'stable' : '';
        var type = d.autonomy || d.autonomyType || '直辖';
        _aHtml += '<div class="gs-admin-row '+cls+'" onclick="if(typeof openProvinceEconomy===\'function\')openProvinceEconomy();">'
          + '<span class="gs-admin-dot"></span>'
          + '<span class="gs-admin-name">'+esc(d.name)+'</span>'
          + '<span class="gs-admin-type">'+esc(type)+'</span>'
          + '<span class="gs-admin-unrest">'+Math.round(unrest)+'</span></div>';
      });
      ap2.innerHTML=_aHtml;
      gl.appendChild(ap2);
    }

    // 2.91 科举进程
    if (P && P.keju){
      var kp = document.createElement('div');
      kp.className='gs-panel p-keju';
      kp.setAttribute('data-panel-key','keju');
      var stages = ['童试','乡试','会试','殿试','授官'];
      var curIdx = 2; // default 会试
      if (P.keju.currentExam && P.keju.currentExam.stage){
        var _stgMap = {'tongshi':0,'xiangshi':1,'huishi':2,'dianshi':3,'shouguan':4};
        curIdx = _stgMap[P.keju.currentExam.stage] != null ? _stgMap[P.keju.currentExam.stage] : 2;
      }
      var doneW = Math.round((curIdx/(stages.length-1))*100);
      var _kHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">科 举 进 程</div><span class="gs-panel-cnt">'+stages[curIdx]+'期</span></div>';
      _kHtml += '<div class="gs-keju-time"><div class="gs-keju-track"><div class="gs-keju-track-done" style="width:'+doneW+'%;"></div></div>';
      _kHtml += '<div class="gs-keju-nodes">';
      for (var _si=0;_si<5;_si++){
        var nc = _si < curIdx ? 'done' : _si === curIdx ? 'current' : '';
        _kHtml += '<div class="gs-keju-node '+nc+'"></div>';
      }
      _kHtml += '</div></div>';
      _kHtml += '<div class="gs-keju-labels">';
      for (_si=0;_si<5;_si++){
        _kHtml += '<span class="'+(_si<curIdx?'done':_si===curIdx?'current':'')+'">'+stages[_si]+'</span>';
      }
      _kHtml += '</div>';
      if (P.keju.currentExam) {
        var _zkg = P.keju.currentExam.chiefExaminer || P.keju.chiefExaminer || '?';
        var _cands = (P.keju.currentExam.candidates||[]).length || P.keju.candidateCount || 0;
        _kHtml += '<div class="gs-keju-sub"><span class="h">主考官</span> '+esc(_zkg)+' · <span class="h">应试</span> '+_cands+' 人</div>';
      }
      kp.innerHTML=_kHtml;
      gl.appendChild(kp);
    }

    // 2.92 家族门第
    if (GM.families && Object.keys(GM.families).length){
      var famp = document.createElement('div');
      famp.className='gs-panel p-family';
      famp.setAttribute('data-panel-key','family');
      var _fNames = Object.keys(GM.families);
      var _fArr = _fNames.map(function(k){return Object.assign({_k:k},GM.families[k]);});
      _fArr.sort(function(a,b){return (b.renown||0)-(a.renown||0);});
      var _famHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">家 族 门 第</div><span class="gs-panel-cnt">'+_fArr.length+'</span></div>';
      _fArr.slice(0,6).forEach(function(f){
        var tier = f.tier==='gaomen'?'甲':f.tier==='shizu'?'乙':'丙';
        var tierCls = f.tier==='gaomen'?'gaomen':f.tier==='shizu'?'shizu':'hanmen';
        _famHtml += '<div class="gs-fam-row"><span class="gs-fam-name">'+esc(f._k||f.name)+'</span>'
          + '<span class="gs-fam-tier '+tierCls+'">'+tier+'</span>'
          + '<span class="gs-fam-renown">'+Math.round(f.renown||0)+'</span></div>';
      });
      famp.innerHTML=_famHtml;
      gl.appendChild(famp);
    }

    // 2.93 制度演进
    if (GM.civicTree && GM.civicTree.length){
      var tp = document.createElement('div');
      tp.className='gs-panel p-tech';
      tp.setAttribute('data-panel-key','tech');
      var _tHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">制 度 演 进</div><span class="gs-panel-cnt">'+GM.civicTree.length+'</span></div>';
      GM.civicTree.slice(0,5).forEach(function(t){
        var prog = t.progress || 0;
        _tHtml += '<div class="gs-tech-row"><span class="gs-tech-icon">⚙</span>'
          + '<span class="gs-tech-name">'+esc(t.name||t.title||'')+'</span>'
          + '<span class="gs-tech-prog"><span class="gs-tech-prog-fill" style="width:'+Math.min(100,prog)+'%;"></span></span>'
          + '<span class="gs-tech-val">'+Math.round(prog)+'</span></div>';
      });
      tp.innerHTML=_tHtml;
      gl.appendChild(tp);
    }

    // 2.94 文物奇珍
    if (GM.items && GM.items.length){
      var _items = GM.items.slice(0,8);
      var ip = document.createElement('div');
      ip.className='gs-panel p-item';
      ip.setAttribute('data-panel-key','item');
      var _iHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">文 物 奇 珍</div><span class="gs-panel-cnt">'+GM.items.length+'</span></div><div class="gs-item-grid">';
      for (var _ii=0;_ii<8;_ii++){
        var it = _items[_ii];
        if (!it){ _iHtml += '<div class="gs-item-slot empty">—</div>'; continue; }
        var _rarity = it.rarity || 'chang';
        var _rCls = {legendary:'r-jing',epic:'r-gui',rare:'r-bi',uncommon:'r-chang',common:'r-chang'}[_rarity] || 'r-chang';
        _iHtml += '<div class="gs-item-slot '+_rCls+'" title="'+esc(it.name||'')+'">'+esc((it.name||'?').charAt(0))+'</div>';
      }
      _iHtml += '</div>';
      ip.innerHTML=_iHtml;
      gl.appendChild(ip);
    }

    // 2.95 后宫嫔御
    var _consorts = (GM.chars||[]).filter(function(c){return c && c.alive!==false && c.spouse;}).slice(0,6);
    if (_consorts.length){
      var hp2 = document.createElement('div');
      hp2.className='gs-panel p-harem';
      hp2.setAttribute('data-panel-key','harem');
      var _hHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">后 宫 嫔 御</div><span class="gs-panel-cnt">'+_consorts.length+'</span></div><div class="gs-harem-row">';
      _consorts.forEach(function(co){
        var rCls = /皇后/.test(co.rank||co.title||'')?'empress':/贵妃/.test(co.rank||co.title||'')?'guifei':/妃/.test(co.rank||co.title||'')?'fei':'pin';
        _hHtml += '<div class="gs-consort '+rCls+'"><div class="gs-consort-port">'+esc(co.name.charAt(0))+'</div>'
          + '<div class="gs-consort-name">'+esc(co.name.charAt(0))+'</div>'
          + '<div class="gs-consort-rank">'+esc(co.rank||co.title||'嫔')+'</div></div>';
      });
      _hHtml += '</div>';
      hp2.innerHTML=_hHtml;
      gl.appendChild(hp2);
    }

    // 2.96 天下之图
    var mpp = document.createElement('div');
    mpp.className='gs-panel p-map';
    mpp.setAttribute('data-panel-key','map');
    var _pins='';
    if (P && P.adminHierarchy){
      var _all=[];
      Object.keys(P.adminHierarchy).forEach(function(fk){ var fh=P.adminHierarchy[fk]; if(fh&&fh.divisions) fh.divisions.forEach(function(d){ _all.push(d); }); });
      _all.slice(0,6).forEach(function(d,idx){
        var top = (20 + (idx%3)*30) + '%', left = (20 + Math.floor(idx/3)*40 + (idx%2)*10) + '%';
        var cls = (d.unrest||0)>60?'crisis':(d.unrest||0)>40?'war':(d.unrest||0)<20?'stable':'';
        _pins += '<span class="gs-map-pin '+cls+'" style="top:'+top+';left:'+left+';"></span>';
        _pins += '<span class="gs-map-label" style="top:calc('+top+' + 12px);left:'+left+';">'+esc(d.name)+'</span>';
      });
    }
    mpp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">天 下 之 图</div><span class="gs-panel-cnt">舆图</span></div>'
      + '<div class="gs-mini-map">'+_pins+'</div>';
    gl.appendChild(mpp);

    // 3. 边患外族
    var threats = [];
    (GM.facs||[]).forEach(function(f){
      if (!f || f.attitude == null) return;
      var hostile = (f.attitude === '敌对' || f.attitude === '交战' || f.attitude === '敌视');
      if (!hostile) return;
      var lv = (f.strength||50) > 60 ? 'hi' : (f.strength||50) > 40 ? 'mid' : 'lo';
      threats.push({ name: f.name, desc: (f.leader||'') + (f.territory?' · '+f.territory:''), force: num(f.militaryStrength||f.strength||0), level: lv });
    });
    if (!threats.length) threats = [{name:'暂无外患',desc:'四方晏然',force:'—',level:'lo'}];
    var bp = document.createElement('div');
    bp.className = 'gs-panel p-bian';
    bp.setAttribute('data-panel-key','bian');
    var _bianHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">边 患 外 族</div><span class="gs-panel-cnt">'+threats.length+'</span></div>';
    threats.slice(0,4).forEach(function(t){
      var lvTxt = t.level==='hi'?'急':t.level==='mid'?'中':'缓';
      _bianHtml += '<div class="gs-bian-row"><span class="gs-bian-threat '+t.level+'">'+lvTxt+'</span>'
        + '<div class="gs-bian-info"><div class="gs-bian-name">'+esc(t.name)+'</div><div class="gs-bian-desc">'+esc(t.desc)+'</div></div>'
        + '<span class="gs-bian-force">'+esc(t.force)+'</span></div>';
    });
    bp.innerHTML = _bianHtml;
    gl.appendChild(bp);

    // 4. 学派流变
    var sp = document.createElement('div');
    sp.className = 'gs-panel p-school';
    sp.setAttribute('data-panel-key','school');
    var schools = (P && P.schools) || [
      {k:'程',name:'程朱理学',level:'主流',infl:72,color:'var(--gold-400)'},
      {k:'阳',name:'陆王心学',level:'方兴',infl:48,color:'var(--celadon-400)'},
      {k:'考',name:'考据朴学',level:'渐盛',infl:35,color:'var(--indigo-400,#5a6fa8)'},
      {k:'西',name:'西学东渐',level:'新潮',infl:18,color:'var(--amber-400,#c9a045)'},
      {k:'佛',name:'禅净儒释',level:'民间',infl:26,color:'var(--purple-400,#8e6aa8)'}
    ];
    var _sHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">学 派 流 变</div><span class="gs-panel-cnt">'+schools.length+'</span></div>';
    schools.forEach(function(s){
      _sHtml += '<div class="gs-school-row"><span class="gs-school-icon" style="--s-c:'+s.color+';">'+esc(s.k)+'</span>'
        + '<span class="gs-school-name">'+esc(s.name)+'</span>'
        + '<span class="gs-school-level" style="--s-c:'+s.color+';">'+esc(s.level)+'</span>'
        + '<span class="gs-school-infl">'+(s.infl||0)+'</span></div>';
    });
    sp.innerHTML = _sHtml;
    gl.appendChild(sp);

    // 5. 物价行情（防御·sparkPct 可能缺失）
    try {
      var pp = document.createElement('div');
      pp.className = 'gs-panel p-price';
      pp.setAttribute('data-panel-key','price');
      var prices = (GM.prices || P.prices) || {};
      var _makePrice = function(name,val,unit,trend,sparkPct){
        var s = Array.isArray(sparkPct) ? sparkPct : [30,45,40,55,70,85];
        var spark=''; for (var i=0;i<6;i++){ spark += '<span style="height:'+(s[i]||50)+'%;"></span>'; }
        var tr = Number(trend) || 0;
        var tCls = tr>5?'up':tr<-5?'down':'stable', tTxt = (tr>0?'↑':tr<0?'↓':'· ')+Math.abs(tr)+'%';
        return '<div class="gs-price-row"><span class="gs-price-name">'+name+'</span>'
          + '<span class="gs-price-val">'+esc(val)+'</span><span class="gs-price-unit">'+esc(unit)+'</span>'
          + '<span class="gs-price-spark">'+spark+'</span>'
          + '<span class="gs-price-trend '+tCls+'">'+tTxt+'</span></div>';
      };
      var _defM = {val:'1.8', unit:'两/石', trend:42, spark:[30,45,40,55,70,85]};
      var _defB = {val:'0.8', unit:'两/匹', trend:8, spark:[50,52,55,54,58,60]};
      var _defS = {val:'3.2', unit:'两/引', trend:6, spark:[70,65,68,72,75,78]};
      var _defY = {val:'650', unit:'/两金', trend:-14, spark:[75,70,68,65,60,58]};
      var _mi = Object.assign({}, _defM, (typeof prices.rice==='object'?prices.rice:{}));
      var _bu = Object.assign({}, _defB, (typeof prices.cloth==='object'?prices.cloth:{}));
      var _ya = Object.assign({}, _defS, (typeof prices.salt==='object'?prices.salt:{}));
      var _yi = Object.assign({}, _defY, (typeof prices.silver==='object'?prices.silver:{}));
      pp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">物 价 行 情</div><span class="gs-panel-cnt">京师</span></div>'
        + _makePrice('米',_mi.val,_mi.unit,_mi.trend,_mi.spark)
        + _makePrice('布',_bu.val,_bu.unit,_bu.trend,_bu.spark)
        + _makePrice('盐',_ya.val,_ya.unit,_ya.trend,_ya.spark)
        + _makePrice('银',_yi.val,_yi.unit,_yi.trend,_yi.spark);
      gl.appendChild(pp);
    } catch(e) { console.warn('[shell-extras] price panel:', e); }

    // 6. 典藏书阁
    try {
    var bk = document.createElement('div');
    bk.className = 'gs-panel p-book';
    bk.setAttribute('data-panel-key','book');
    var libs = (GM.library||P.library) || { jing:2418, shi:3862, zi:5273, ji:8146 };
    bk.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">典 藏 书 阁</div><span class="gs-panel-cnt">文渊阁</span></div>'
      + '<div class="gs-book-grid">'
      + '<div class="gs-book-card b-jing"><div class="gs-book-name">经</div><div class="gs-book-num">'+num(libs.jing)+'</div><div class="gs-book-sub">十三经·注疏</div></div>'
      + '<div class="gs-book-card b-shi"><div class="gs-book-name">史</div><div class="gs-book-num">'+num(libs.shi)+'</div><div class="gs-book-sub">二十二史·实录</div></div>'
      + '<div class="gs-book-card b-zi"><div class="gs-book-name">子</div><div class="gs-book-num">'+num(libs.zi)+'</div><div class="gs-book-sub">百家·兵农医</div></div>'
      + '<div class="gs-book-card b-ji"><div class="gs-book-name">集</div><div class="gs-book-num">'+num(libs.ji)+'</div><div class="gs-book-sub">诗文·笔记</div></div>'
      + '</div>';
    gl.appendChild(bk);
    } catch(e) { console.warn('[shell-extras] book panel:', e); }

    // 7. 宫殿之序
    try {
    var pal = document.createElement('div');
    pal.className = 'gs-panel p-palace';
    pal.setAttribute('data-panel-key','palace');
    pal.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">宫 殿 之 序</div><span class="gs-panel-cnt">'+esc((P.palaceSystem&&P.palaceSystem.capitalName)||'紫禁城')+'</span></div>'
      + '<div class="gs-palace-diag">'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block gold">乾清宫</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block">保和殿</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block">中和殿</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block gold">太和殿</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block small">文华殿</div><div class="gs-palace-block small">武英殿</div></div>'
      + '<div class="gs-palace-gate">午 门 · 端 门 · 承 天 门</div>'
      + '</div>';
    gl.appendChild(pal);
    } catch(e) { console.warn('[shell-extras] palace panel:', e); }

    // 8. 界面主题（实装：主题/字号/字体）
    try {
    var tm = document.createElement('div');
    tm.className = 'gs-panel p-theme';
    tm.setAttribute('data-panel-key','theme');
    // 读取已保存的设置
    var _savedTheme = localStorage.getItem('tm.theme') || 'plain';
    var _savedSize = localStorage.getItem('tm.fontSize') || 'md';
    var _savedBody = localStorage.getItem('tm.fontBody') || 'STKaiti';
    var _savedTitle = localStorage.getItem('tm.fontTitle') || 'STKaiti';
    var _actCls = function(k, cur){ return k===cur?' active':''; };
    tm.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">界 面 主 题</div><span class="gs-panel-cnt">4 色</span></div>'
      + '<div class="gs-theme-grid">'
      + '<div class="gs-theme-card' + _actCls('plain', _savedTheme) + '" data-theme="plain" onclick="_tmApplyTheme(\'plain\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#b89a53;"></span><span class="c" style="background:#c9a85f;"></span><span class="c" style="background:#6a9a7f;"></span><span class="c" style="background:#b84738;"></span></div><div class="gs-theme-name">素 纸</div><div class="desc">宣纸金线·朱砂</div></div>'
      + '<div class="gs-theme-card' + _actCls('ink', _savedTheme) + '" data-theme="ink" onclick="_tmApplyTheme(\'ink\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#3d342a;"></span><span class="c" style="background:#6b5d47;"></span><span class="c" style="background:#a69470;"></span><span class="c" style="background:#d9c9a9;"></span></div><div class="gs-theme-name">水 墨</div><div class="desc">墨分五色·冷调</div></div>'
      + '<div class="gs-theme-card' + _actCls('vermillion', _savedTheme) + '" data-theme="vermillion" onclick="_tmApplyTheme(\'vermillion\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#8f3428;"></span><span class="c" style="background:#b84738;"></span><span class="c" style="background:#d15c47;"></span><span class="c" style="background:#c9a85f;"></span></div><div class="gs-theme-name">朱 砂</div><div class="desc">浓朱重赤·烈</div></div>'
      + '<div class="gs-theme-card' + _actCls('celadon', _savedTheme) + '" data-theme="celadon" onclick="_tmApplyTheme(\'celadon\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#4a7a5f;"></span><span class="c" style="background:#6a9a7f;"></span><span class="c" style="background:#b89a53;"></span><span class="c" style="background:#d9c9a9;"></span></div><div class="gs-theme-name">青 绿</div><div class="desc">青绿山水·雅</div></div>'
      + '</div>'
      + '<div class="gs-font-row"><span class="lbl">字 号</span>'
      + '<div class="gs-font-sizes">'
      +   '<button class="gs-sz-btn sm' + _actCls('sm', _savedSize) + '" onclick="_tmApplySize(\'sm\', this)">小</button>'
      +   '<button class="gs-sz-btn md' + _actCls('md', _savedSize) + '" onclick="_tmApplySize(\'md\', this)">中</button>'
      +   '<button class="gs-sz-btn lg' + _actCls('lg', _savedSize) + '" onclick="_tmApplySize(\'lg\', this)">大</button>'
      +   '<button class="gs-sz-btn xl' + _actCls('xl', _savedSize) + '" onclick="_tmApplySize(\'xl\', this)">特大</button>'
      + '</div>'
      + '</div>'
      + '<div class="gs-font-row"><span class="lbl">正 文</span><select class="gs-font-select" onchange="_tmApplyBodyFont(this.value)">'
      +   '<option value="STKaiti"' + (_savedBody==='STKaiti'?' selected':'') + '>楷体 STKaiti</option>'
      +   '<option value="SimSun"' + (_savedBody==='SimSun'?' selected':'') + '>宋体 SimSun</option>'
      +   '<option value="FangSong"' + (_savedBody==='FangSong'?' selected':'') + '>仿宋 FangSong</option>'
      +   '<option value="FZQiTi"' + (_savedBody==='FZQiTi'?' selected':'') + '>方正启体</option>'
      +   '<option value="Noto Serif SC"' + (_savedBody==='Noto Serif SC'?' selected':'') + '>思源宋体</option>'
      +   '<option value="LXGW WenKai"' + (_savedBody==='LXGW WenKai'?' selected':'') + '>霞鹜文楷</option>'
      + '</select></div>'
      + '<div class="gs-font-row"><span class="lbl">标 题</span><select class="gs-font-select" onchange="_tmApplyTitleFont(this.value)">'
      +   '<option value="STKaiti"' + (_savedTitle==='STKaiti'?' selected':'') + '>楷体 STKaiti</option>'
      +   '<option value="STXingkai"' + (_savedTitle==='STXingkai'?' selected':'') + '>行楷</option>'
      +   '<option value="STLiti"' + (_savedTitle==='STLiti'?' selected':'') + '>隶书</option>'
      +   '<option value="STXinghkaiti"' + (_savedTitle==='STXinghkaiti'?' selected':'') + '>华文行楷</option>'
      + '</select></div>';
    gl.appendChild(tm);
    } catch(e) { console.warn('[shell-extras] theme panel:', e); }

    // 9. 帮助·典范
    try {
    var hp = document.createElement('div');
    hp.className = 'gs-panel p-help';
    hp.setAttribute('data-panel-key','help');
    hp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">帮 助 · 典 范</div><span class="gs-panel-cnt">4</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpNewbie===\'function\')openHelpNewbie();else toast(\'新手入门\')"><span class="ic">?</span><span class="t">新 手 入 门</span><span class="arr">›</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpPresets===\'function\')openHelpPresets();else toast(\'历代典范\')"><span class="ic">典</span><span class="t">历 代 典 范</span><span class="arr">›</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpAI===\'function\')openHelpAI();else toast(\'AI 推演原理\')"><span class="ic">AI</span><span class="t">AI 推 演 原 理</span><span class="arr">›</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpHotkey===\'function\')openHelpHotkey();else toast(\'[ ] = 开关抽屉·Ctrl+1..9 切 tab·F1 帮助\')"><span class="ic">键</span><span class="t">键 位 速 查</span><span class="arr">›</span></div>';
    gl.appendChild(hp);
    } catch(e) { console.warn('[shell-extras] help panel:', e); }

    // 10. 音声调度
    try {
    var au = document.createElement('div');
    au.className = 'gs-panel p-audio';
    au.setAttribute('data-panel-key','audio');
    au.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">音 声 调 度</div><span class="gs-panel-cnt">开</span></div>'
      + '<div class="gs-audio-row"><span class="gs-audio-name">殿 乐</span><div class="gs-audio-ctrl"><div class="gs-audio-slider" style="--p:70%;"></div><span class="gs-audio-val">70</span></div></div>'
      + '<div class="gs-audio-row"><span class="gs-audio-name">朝 钟</span><div class="gs-audio-ctrl"><div class="gs-audio-slider" style="--p:45%;"></div><span class="gs-audio-val">45</span></div></div>'
      + '<div class="gs-audio-row"><span class="gs-audio-name">笔 墨</span><div class="gs-audio-ctrl"><div class="gs-audio-slider" style="--p:60%;"></div><span class="gs-audio-val">60</span></div></div>'
      + '<div class="gs-audio-now">正 奏：<span class="h">《秋声赋》</span>·古琴独奏</div>'
      + '<div class="gs-audio-custom">'
      + '<button class="gs-audio-import" onclick="var f=document.getElementById(\'shellAudioIn\');if(f)f.click();">导 入 曲 谱</button>'
      + '<input type="file" id="shellAudioIn" accept="audio/*" multiple style="display:none;">'
      + '<div class="gs-audio-lib">'
      + '<div class="gs-audio-song playing"><span class="title">秋声赋</span><span class="meta">古琴</span><button class="del">×</button></div>'
      + '<div class="gs-audio-song paused"><span class="title">流水</span><span class="meta">古琴</span><button class="del">×</button></div>'
      + '<div class="gs-audio-song paused"><span class="title">阳关三叠</span><span class="meta">琵琶</span><button class="del">×</button></div>'
      + '</div>'
      + '<div class="gs-audio-loop"><button class="gs-audio-loop-btn active">顺 序</button><button class="gs-audio-loop-btn">单 曲</button><button class="gs-audio-loop-btn">随 机</button></div>'
      + '</div>';
    gl.appendChild(au);
    } catch(e) { console.warn('[shell-extras] audio panel:', e); }
  };

  // ─────────────────────── 右抽屉 shell extras ───────────────────────
  window._renderShellExtrasRight = function(){
    var gr = $('gr'); if (!gr || typeof GM === 'undefined' || !GM.running) return;

    // 清除上次注入的 shell extras（防止重复）
    var _ex = gr.querySelector('#_shell_extras_right'); if (_ex) _ex.remove();
    var wrap = document.createElement('div');
    wrap.id = '_shell_extras_right';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    var pc = (typeof findPlayerChar === 'function' ? findPlayerChar() : null) || (GM.chars||[]).find(function(c){return c.isPlayer;}) || {};
    var pName = pc.name || (P.playerInfo && P.playerInfo.name) || '朕';
    var pAge = pc.age || (P.playerInfo && P.playerInfo.age) || 0;
    var pZi = pc.zi || pc.courtesy || '';
    var pGender = pc.gender || 'male';
    var pTitle = pc.officialTitle || pc.title || '皇帝';

    // 1. 朕亲卡
    var self = document.createElement('div');
    self.className = 'gs-self-card';
    self.setAttribute('data-panel-key','self');
    var _wc = pc.wuchang || {};
    var _wcDot = function(k){ var v=_wc[k]; var lv=v==null?'none':v>=60?'hi':v>=30?'mid':'lo'; return '<span class="gs-wc-dot '+lv+'">'+k+'</span>'; };
    var _statBar = function(cls, k, v){ v=Math.max(0,Math.min(100,v||0)); return '<div class="gs-stat '+cls+'"><span class="gs-stat-k">'+k+'</span><span class="gs-stat-bar"><span class="gs-stat-fill" style="width:'+v+'%"></span></span><span class="gs-stat-v">'+Math.round(v)+'</span></div>'; };
    var traits = (pc.traits||[]).slice(0,4);
    var _traitHtml = '';
    traits.forEach(function(t){ _traitHtml += '<span class="gs-self-tag trait-neu">'+esc(t)+'</span>'; });
    self.innerHTML = '<div class="gs-self-row">'
      + '<div class="gs-self-portrait">'+(pc.portrait?'<img src="'+esc(pc.portrait)+'" style="width:100%;height:100%;object-fit:cover;border-radius:1px;">':esc(pName.charAt(0)))+'</div>'
      + '<div class="gs-self-info">'
      + '<div class="gs-self-name">'+esc(pName)+'</div>'
      + '<div class="gs-self-title">'+esc(pTitle)+(pZi?'　字 '+esc(pZi):'')+'</div>'
      + '<div class="gs-self-meta">'+(pAge?'<span class="gs-self-tag">'+pAge+'岁</span>':'')+_traitHtml+'</div>'
      + '</div></div>'
      + '<div class="gs-self-stats">'
      + _statBar('zhi','智',pc.intelligence)
      + _statBar('zheng','政',pc.administration)
      + _statBar('jun','军',pc.military)
      + _statBar('jiao','交',pc.diplomacy||pc.charisma)
      + _statBar('ren','仁',pc.benevolence)
      + _statBar('wei','威',GM.huangwei||GM.authority||60)
      + '</div>'
      + '<div class="gs-self-wuchang"><span class="lbl">五常</span>'
      + _wcDot('仁')+_wcDot('义')+_wcDot('礼')+_wcDot('智')+_wcDot('信')
      + '</div>';
    wrap.appendChild(self);

    // 2. 十二时辰
    var tm = document.createElement('div');
    tm.className = 'gs-panel p-time';
    tm.setAttribute('data-panel-key','time');
    var _shi = Math.floor(((GM.currentDay||0)%1)*12) || 8;
    var _shiMap=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    var _shiName = _shiMap[_shi%12];
    var _deg = (_shi*30) - 90;
    tm.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">十 二 时 辰</div><span class="gs-panel-cnt">'+_shiName+'时</span></div>'
      + '<div class="gs-time-dial">'
      + '<div class="gs-time-mark" style="top:10%;left:50%;">子</div>'
      + '<div class="gs-time-mark" style="top:23%;left:82%;">卯</div>'
      + '<div class="gs-time-mark" style="top:50%;left:90%;">午</div>'
      + '<div class="gs-time-mark cur" style="top:77%;left:82%;">申</div>'
      + '<div class="gs-time-mark" style="top:90%;left:50%;">酉</div>'
      + '<div class="gs-time-mark" style="top:77%;left:18%;">戌</div>'
      + '<div class="gs-time-mark" style="top:50%;left:10%;">卯</div>'
      + '<div class="gs-time-mark" style="top:23%;left:18%;">丑</div>'
      + '<div class="gs-time-hand" style="transform:translate(-50%,-100%) rotate('+_deg+'deg);"></div>'
      + '<div class="gs-time-center"></div>'
      + '</div>'
      + '<div class="gs-time-text"><div class="main">'+_shiName+' 时</div><div class="sub">日 昳 · 未 至 酉</div></div>';
    wrap.appendChild(tm);

    // 3. 紧要之臣 (gs-char2 v2)·全部非玩家可显示角色·滚动展示
    var chars = (GM.chars||[]).filter(function(c){ return c && c.alive !== false && !c.isPlayer; });
    chars.sort(function(a,b){ var ia=(a.importance||0)+(a.loyalty||0)*0.3; var ib=(b.importance||0)+(b.loyalty||0)*0.3; return ib-ia; });
    // 不再 slice(0,6)·全部展示·列表容器滚动
    var cp = document.createElement('div');
    cp.className = 'gs-panel p-quick';
    cp.setAttribute('data-panel-key','char');
    var _cHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">紧 要 之 臣</div><span class="gs-panel-cnt">'+chars.length+'</span></div>'
      // 内部滚动容器·480px 高·外层 panel 不被撑开
      + '<div class="gs-char2-scroll" style="max-height:480px;overflow-y:auto;overflow-x:hidden;padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
    chars.forEach(function(c){
      var fac = c.faction || '';
      var fClass = 'f-dongin';
      if (/武|军|将|兵|总兵/.test((c.officialTitle||c.title||'')+fac)) fClass='f-mili';
      else if (/宦|阉|太监|内廷/.test((c.officialTitle||c.title||'')+fac)) fClass='f-eunuch';
      else if (c.spouse||c.gender==='女') fClass='f-consort';
      else if (/温|昆/.test(fac)) fClass='f-kun';
      var loy = c.loyalty || 50;
      var loyCls = loy>=70?'hi':loy>=40?'mid':'lo';
      var amb = c.ambition || 40;
      var ambCls = amb>=70?'hi':amb>=40?'mid':'lo';
      var loyVerd = loy>=80?'忠贞可托':loy>=60?'堪用':loy>=40?'存观望心':'疑心';
      var ambVerd = amb>=70?'有所图':amb>=45?'知进退':'恬淡';
      var overall = (loy>=70&&amb<=65) ? {cls:'',t:'综合：良臣之选'} : (loy<40||amb>=80?{cls:'danger',t:'综合：恐成变数'}: {cls:'warn',t:'综合：须加察看'});
      _cHtml += '<div class="gs-char2 '+fClass+'"><div class="gs-char2-row">'
        + '<div class="gs-char2-port">'+esc(c.name.charAt(0))+'</div>'
        + '<div class="gs-char2-body">'
        + '<div class="gs-char2-name-row"><span class="gs-char2-name">'+esc(c.name)+'</span>'
        + (c.zi||c.courtesy?'<span class="gs-char2-zi">'+esc(c.zi||c.courtesy)+'</span>':'')
        + '<span class="gs-char2-gender '+(c.gender==='女'?'female':'male')+'">'+(c.gender==='女'?'女':'男')+'·'+(c.age||'?')+'</span>'
        + '</div>'
        + '<div class="gs-char2-title"><b>'+esc(c.officialTitle||c.title||'布衣')+'</b>'+(c.rank?' · '+esc(c.rank):'')+'</div>'
        + '<div class="gs-char2-tags">'
        + (c.location?'<span class="gs-char2-tag loc">'+esc(c.location)+'</span>':'')
        + (fac?'<span class="gs-char2-tag fac">'+esc(fac)+'</span>':'')
        + '</div>'
        + '<div class="gs-char2-hearts">'
        + '<div class="gs-char2-heart loyalty"><span class="lbl">忠诚</span><div class="bar"><div class="fill '+loyCls+'" style="width:'+Math.min(100,loy)+'%;"></div></div><span class="val">'+Math.round(loy)+'</span><span class="verd">'+loyVerd+'</span></div>'
        + '<div class="gs-char2-heart ambition"><span class="lbl">野心</span><div class="bar"><div class="fill '+ambCls+'" style="width:'+Math.min(100,amb)+'%;"></div></div><span class="val">'+Math.round(amb)+'</span><span class="verd">'+ambVerd+'</span></div>'
        + '</div>'
        + '<div class="gs-char2-verdict '+overall.cls+'">'+overall.t+'</div>'
        + '</div></div></div>';
    });
    _cHtml += '</div>';  // close .gs-char2-scroll
    cp.innerHTML = _cHtml;
    wrap.appendChild(cp);

    // 4. 当前议题 — 复用 GM.currentIssues / pendingConsequences
    var issues = (GM.currentIssues||[]).slice(0,5);
    if (issues.length) {
      var ip = document.createElement('div');
      ip.className = 'gs-panel p-issue';
      ip.setAttribute('data-panel-key','issue');
      var _nums=['一','二','三','四','五','六','七','八'];
      var _iHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">当 前 议 题</div><span class="gs-panel-cnt">'+issues.length+' 要</span></div>';
      issues.forEach(function(iss,i){
        var sev = iss.severity || iss.level || 'warn';
        var cls = sev === 'urgent' || sev === 'high' ? 'urgent' : sev === 'info' ? 'info' : 'warn';
        var txt = iss.text || iss.title || iss.description || iss.name || '(未详)';
        var tm = iss.time || (iss.urgent?'即刻':'本回');
        _iHtml += '<div class="gs-issue-item '+cls+'"><span class="gs-issue-num">'+_nums[i]+'</span><span class="gs-issue-text">'+esc(txt)+'</span><span class="gs-issue-time">'+esc(tm)+'</span></div>';
      });
      ip.innerHTML = _iHtml;
      wrap.appendChild(ip);
    }

    // 5. 朕之大志
    if (pc.goals && pc.goals.length) {
      var gp = document.createElement('div');
      gp.className = 'gs-panel p-goal';
      gp.setAttribute('data-panel-key','goal');
      var _gHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">朕 之 大 志</div><span class="gs-panel-cnt">'+pc.goals.length+' 纲</span></div>';
      pc.goals.slice(0,3).forEach(function(g){
        var prog = g.progress || 0;
        var prio = g.priority || '甲';
        _gHtml += '<div class="gs-goal-item"><div class="gs-goal-hdr"><span class="gs-goal-title">'+esc(g.title||g.name||'')+'</span><span class="gs-goal-prio">'+esc(prio)+'</span></div>'
          + '<div class="gs-goal-desc">'+esc(g.longTerm||g.shortTerm||g.description||'')+'</div>'
          + '<div class="gs-goal-prog"><div class="gs-goal-prog-fill" style="width:'+Math.min(100,prog)+'%;"></div></div></div>';
      });
      gp.innerHTML = _gHtml;
      wrap.appendChild(gp);
    }

    // 6. 岁入岁出（近6回合 mini 图）
    var fp = document.createElement('div');
    fp.className = 'gs-panel p-finance';
    fp.setAttribute('data-panel-key','fin');
    var hist = (GM.guoku && GM.guoku.history) || [];
    var pairs=[];
    for (var i=0; i<6; i++) {
      var h = hist[hist.length-6+i] || {};
      var inP = Math.max(10, Math.min(100, (h.income||50)/Math.max(1,(GM.guoku&&GM.guoku.annualIncome)||100)*100));
      var outP = Math.max(10, Math.min(100, (h.expense||60)/Math.max(1,(GM.guoku&&GM.guoku.annualIncome)||100)*100));
      pairs.push({in:inP||70, out:outP||75, m:((GM.turn||1)-6+i)});
    }
    var _finHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">岁 入 岁 出</div><span class="gs-panel-cnt">近 6 回</span></div>'
      + '<div class="gs-fin-chart"><div class="gs-fin-bars">';
    pairs.forEach(function(p){
      _finHtml += '<div class="gs-fin-group"><div class="gs-fin-bar-stack"><div class="gs-fin-bar income" style="height:'+p.in+'%;"></div></div><div class="gs-fin-lbl">'+Math.max(0,p.m)+'</div></div>';
      _finHtml += '<div class="gs-fin-group"><div class="gs-fin-bar-stack"><div class="gs-fin-bar expense" style="height:'+p.out+'%;"></div></div><div class="gs-fin-lbl">·</div></div>';
    });
    _finHtml += '</div><div class="gs-fin-legend"><span class="in">岁 入</span><span class="out">岁 出</span></div></div>';
    fp.innerHTML = _finHtml;
    wrap.appendChild(fp);

    // 7. 近事快报
    var news = (GM.qijuHistory||[]).slice(0,6).reverse();
    if (news.length) {
      var np = document.createElement('div');
      np.className = 'gs-panel p-news';
      np.setAttribute('data-panel-key','news');
      var _nHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">近 事 快 报</div><span class="gs-panel-cnt">本回 '+news.length+'</span></div>';
      news.forEach(function(q){
        var cat = q.category || q.cat || '事';
        var clsMap = {'\u8BCF\u4EE4':'edict','\u594F\u758F':'memo','\u671D\u8BAE':'chaoyi','\u9E3F\u96C1':'letter','\u4EBA\u4E8B':'person'};
        var ccls = clsMap[cat] || 'person';
        var txt = q.content || q.text || q.zhengwen || '';
        if (txt.length > 60) txt = txt.slice(0, 60) + '…';
        var tm = q.time || q.date || '';
        _nHtml += '<div class="gs-news-item '+ccls+'"><span class="t">'+esc((tm+'').slice(0,3))+'</span><span class="body">'+esc(txt)+'</span></div>';
      });
      np.innerHTML = _nHtml;
      wrap.appendChild(np);
    }

    // 8. 风闻坊录
    var rumors = (GM.rumors||GM._rumors||[]).slice(0,4);
    if (rumors.length) {
      var rp = document.createElement('div');
      rp.className = 'gs-panel p-rumor';
      rp.setAttribute('data-panel-key','rumor');
      var _rHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">风 闻 坊 录</div><span class="gs-panel-cnt">'+rumors.length+'</span></div>';
      rumors.forEach(function(r){
        var cred = r.credibility || r.confidence || '中';
        _rHtml += '<div class="gs-rumor-item">'+esc(r.text||r.content||r.name||'')+'<span class="cred">·'+esc(cred)+'</span></div>';
      });
      rp.innerHTML = _rHtml;
      wrap.appendChild(rp);
    }

    // 7.5 人脉关系网（朕中心 + 6 近臣放射）
    var _relChars = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;})
      .sort(function(a,b){ return (b.importance||0)+(b.loyalty||0)*0.3 - ((a.importance||0)+(a.loyalty||0)*0.3); })
      .slice(0, 6);
    if (_relChars.length) {
      var relP = document.createElement('div');
      relP.className = 'gs-panel p-rel';
      relP.setAttribute('data-panel-key','rel');
      var _rHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">人 脉 关 系</div><span class="gs-panel-cnt">'+_relChars.length+'</span></div>';
      _rHtml += '<div class="gs-rel-net">';
      var _positions = [ // 6 方位（相对中心）
        {top:'20%',left:'76%',deg:-55},
        {top:'82%',left:'72%',deg:42},
        {top:'38%',left:'6%',deg:170},
        {top:'72%',left:'14%',deg:130},
        {top:'12%',left:'28%',deg:-130},
        {top:'82%',left:'40%',deg:90}
      ];
      _relChars.forEach(function(c,i){
        var pos = _positions[i] || {top:'50%',left:'50%',deg:0};
        var loy = c.loyalty || 50, amb = c.ambition || 40;
        var cls = loy >= 65 ? 'friend' : loy < 35 || amb > 75 ? 'foe' : 'neutral';
        var edgeCls = cls === 'friend' ? 'friend' : cls === 'foe' ? 'foe' : 'dashed';
        var edgeLen = 44 + Math.round(Math.random()*20);
        _rHtml += '<div class="gs-rel-edge '+edgeCls+'" style="top:50%;left:50%;width:'+edgeLen+'px;transform:rotate('+pos.deg+'deg);"></div>';
        _rHtml += '<div class="gs-rel-node '+cls+'" style="top:calc('+pos.top+' - 11px);left:calc('+pos.left+' - 11px);" title="'+esc(c.name)+'(忠'+Math.round(loy)+')">'+esc(c.name.charAt(0))+'</div>';
      });
      _rHtml += '<div class="gs-rel-node center" style="top:calc(50% - 14px);left:calc(50% - 14px);">朕</div>';
      _rHtml += '</div>';
      relP.innerHTML = _rHtml;
      wrap.appendChild(relP);
    }

    // 7.6 祭祀礼仪（月历 + 待办清单）
    var jp = document.createElement('div');
    jp.className = 'gs-panel p-jifa';
    jp.setAttribute('data-panel-key','jifa');
    var _today = ((GM.turn||1) % 12) + 1;
    var _jifaHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">祭 祀 礼 仪</div><span class="gs-panel-cnt">本月</span></div>';
    _jifaHtml += '<div class="gs-jifa-calendar">';
    var _dayLabels = ['朔','初二','祭太庙','初四','吉日','初六','初七','初八','初九','祀天','十一','望'];
    var _jifaCls = [ '', '', 'jisi', '', 'auspicious', '', '', '', '', 'jisi', '', '' ];
    for (var _di=0; _di<12; _di++){
      var c = _jifaCls[_di], isToday = (_di+1 === _today);
      _jifaHtml += '<div class="gs-jifa-cell'+(c?' '+c:'')+(isToday?' today auspicious':'')+'">'+(isToday?'今 日':_dayLabels[_di])+'</div>';
    }
    _jifaHtml += '</div>';
    _jifaHtml += '<div class="gs-jifa-row"><span class="gs-jifa-type">【祀天】</span><span class="gs-jifa-name">秋分大祀·圜丘</span><span class="gs-jifa-due">2日后</span></div>';
    _jifaHtml += '<div class="gs-jifa-row"><span class="gs-jifa-type">【祭祖】</span><span class="gs-jifa-name">太庙告庙·升祔</span><span class="gs-jifa-due">已备</span></div>';
    _jifaHtml += '<div class="gs-jifa-row"><span class="gs-jifa-type">【朝贺】</span><span class="gs-jifa-name">万寿节·百官朝贺</span><span class="gs-jifa-due">下月</span></div>';
    jp.innerHTML = _jifaHtml;
    wrap.appendChild(jp);

    // 7.7 监察百司
    var cp2 = document.createElement('div');
    cp2.className = 'gs-panel p-censor';
    cp2.setAttribute('data-panel-key','censor');
    // 尝试从 GM.memorials 统计
    var _mems = GM.memorials || [];
    var _tanhe = _mems.filter(function(m){return (m.type||m.subtype||'').indexOf('弹')>=0 || (m.content||'').indexOf('弹劾')>=0;}).length;
    var _mizou = _mems.filter(function(m){return m.subtype === '密折' || m.subtype === '密揭';}).length;
    var _censorHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">监 察 百 司</div><span class="gs-panel-cnt">4 司</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--indigo-400,#5a6fa8);">都</span><span class="gs-censor-name">都察院</span><span class="gs-censor-alert '+(_tanhe>3?'hi':_tanhe>0?'mid':'lo')+'">弹劾 '+_tanhe+'</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--purple-400,#8e6aa8);">厂</span><span class="gs-censor-name">东厂</span><span class="gs-censor-alert '+(_mizou>0?'hi':'lo')+'">密奏 '+_mizou+'</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--vermillion-400);">锦</span><span class="gs-censor-name">锦衣卫</span><span class="gs-censor-alert lo">巡视</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--celadon-400,#7eb8a7);">理</span><span class="gs-censor-name">大理寺</span><span class="gs-censor-alert mid">刑案 '+((GM.pendingCases||[]).length||0)+'</span></div>';
    cp2.innerHTML = _censorHtml;
    wrap.appendChild(cp2);

    // 7.8 宫廷日程（明日安排）
    var ap = document.createElement('div');
    ap.className = 'gs-panel p-agenda';
    ap.setAttribute('data-panel-key','agenda');
    var _aHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">宫 廷 日 程</div><span class="gs-panel-cnt">明日</span></div>';
    _aHtml += '<div class="gs-agenda-row chaoyi"><span class="gs-agenda-time">卯时</span><span class="gs-agenda-name">常 朝</span><span class="gs-agenda-with">群臣</span></div>';
    if (_relChars && _relChars[0]) _aHtml += '<div class="gs-agenda-row zhaojian"><span class="gs-agenda-time">辰时</span><span class="gs-agenda-name">召 见</span><span class="gs-agenda-with">'+esc(_relChars[0].name)+'</span></div>';
    var _memoCt = (GM.memorials||[]).filter(function(m){return !m.reviewed;}).length;
    _aHtml += '<div class="gs-agenda-row"><span class="gs-agenda-time">巳时</span><span class="gs-agenda-name">批 阅 奏 疏</span><span class="gs-agenda-with">'+_memoCt+' 封</span></div>';
    if ((GM.currentIssues||[]).length) _aHtml += '<div class="gs-agenda-row chaoyi"><span class="gs-agenda-time">午时</span><span class="gs-agenda-name">廷 议</span><span class="gs-agenda-with">'+esc((GM.currentIssues[0].title||GM.currentIssues[0].text||'要务').slice(0,6))+'</span></div>';
    _aHtml += '<div class="gs-agenda-row jisi"><span class="gs-agenda-time">申时</span><span class="gs-agenda-name">祀 节 气</span><span class="gs-agenda-with">圜丘</span></div>';
    ap.innerHTML = _aHtml;
    wrap.appendChild(ap);

    // 9. 精力气血
    var en = document.createElement('div');
    en.className = 'gs-energy';
    en.setAttribute('data-panel-key','energy');
    var energy = GM._energy != null ? GM._energy : 80;
    var energyMax = GM._energyMax || 100;
    var pct = Math.round((energy/energyMax)*100);
    en.innerHTML = '<div class="gs-energy-hdr"><span class="gs-energy-lbl">精 力 气 血</span><span class="gs-energy-val">'+Math.round(energy)+' <span class="max">/ '+energyMax+'</span></span></div>'
      + '<div class="gs-energy-bar"><div class="gs-energy-fill" style="width:'+pct+'%;"></div></div>'
      + '<div class="gs-energy-tick"><span>疲</span><span>可议</span><span>充</span></div>';
    wrap.appendChild(en);

    gr.appendChild(wrap);
  };

  // 四时物候圆盘颜色（通过 data-season 属性）
  try {
    var _style = document.createElement('style');
    _style.textContent = '.gs-season-disc[data-season="春"]::after{content:"春";color:var(--celadon-400,#7eb8a7);}'
      + '.gs-season-disc[data-season="夏"]::after{content:"夏";color:var(--amber-400,#c9a045);}'
      + '.gs-season-disc[data-season="秋"]::after{content:"秋";color:var(--amber-400,#c9a045);}'
      + '.gs-season-disc[data-season="冬"]::after{content:"冬";color:var(--indigo-400,#5a6fa8);}';
    document.head.appendChild(_style);
  } catch(e){}

  // ═══════════════════════════════════════════════════════════════════
  //  界面主题 · 字号 · 字体 实装（暴露为 window 全局·给 onclick 调用）
  // ═══════════════════════════════════════════════════════════════════

  // 主题 → 覆盖 :root CSS 变量（通过 <style id="_tmThemeOverride">）
  var THEME_PALETTES = {
    plain: { // 素纸·默认金-朱
      bg:'#1a1510', surface:'#2a2218', fg:'#f4eadd',
      primary:'#c9a85f', accent:'#b84738', info:'#7eb8a7', warn:'#c9a045',
      gold1:'#b89a53', gold2:'#c9a85f', gold3:'#d4be7a',
      verm1:'#8f3428', verm2:'#b84738', verm3:'#d15c47',
      cela:'#6a9a7f'
    },
    ink: { // 水墨·冷调
      bg:'#1a1a22', surface:'#282834', fg:'#d9c9a9',
      primary:'#a69470', accent:'#6b5d47', info:'#b0b8c4', warn:'#c9c4a8',
      gold1:'#6b5d47', gold2:'#a69470', gold3:'#c2b596',
      verm1:'#5a4038', verm2:'#7a5548', verm3:'#a07058',
      cela:'#607080'
    },
    vermillion: { // 朱砂·浓朱
      bg:'#1e0f0c', surface:'#2e1a14', fg:'#fce6d8',
      primary:'#d15c47', accent:'#8f3428', info:'#c9a045', warn:'#e89078',
      gold1:'#b89a53', gold2:'#c9a85f', gold3:'#e8c888',
      verm1:'#8f3428', verm2:'#b84738', verm3:'#d15c47',
      cela:'#8a7050'
    },
    celadon: { // 青绿·山水
      bg:'#0f1814', surface:'#1a2420', fg:'#e8f0e0',
      primary:'#6a9a7f', accent:'#4a7a5f', info:'#b89a53', warn:'#d9c9a9',
      gold1:'#8a9060', gold2:'#b89a53', gold3:'#d9c9a9',
      verm1:'#7a5548', verm2:'#a07058', verm3:'#c08878',
      cela:'#6a9a7f'
    }
  };
  window._tmApplyTheme = function(name, el) {
    var pal = THEME_PALETTES[name] || THEME_PALETTES.plain;
    var css = ':root{'
      + '--color-background:' + pal.bg + ';'
      + '--color-surface:' + pal.surface + ';'
      + '--color-foreground:' + pal.fg + ';'
      + '--color-primary:' + pal.primary + ';'
      + '--color-accent:' + pal.accent + ';'
      + '--color-info:' + pal.info + ';'
      + '--color-warning:' + pal.warn + ';'
      + '--gold-400:' + pal.gold2 + ';'
      + '--gold-500:' + pal.gold1 + ';'
      + '--gold-300:' + pal.gold3 + ';'
      + '--vermillion-400:' + pal.verm2 + ';'
      + '--vermillion-500:' + pal.verm1 + ';'
      + '--vermillion-300:' + pal.verm3 + ';'
      + '--celadon-400:' + pal.cela + ';'
      + '--bg-2:' + pal.bg + ';'
      + '--bg-3:' + pal.surface + ';'
      + '}';
    var st = document.getElementById('_tmThemeOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmThemeOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.theme', name); } catch(_){}
    // UI: 高亮当前卡
    if (el) {
      var parent = el.parentElement;
      if (parent) {
        parent.querySelectorAll('.gs-theme-card').forEach(function(c){ c.classList.remove('active'); });
        el.classList.add('active');
      }
    }
    if (typeof toast === 'function') toast('主题·' + (name==='plain'?'素纸':name==='ink'?'水墨':name==='vermillion'?'朱砂':'青绿'));
  };

  // 字号 → 覆盖 --text-* 比例
  var SIZE_SCALES = { sm: 0.85, md: 1.0, lg: 1.15, xl: 1.32 };
  var SIZE_BASE = { xs:0.95, sm:1.05, base:1.18, md:1.28, lg:1.42, xl:1.60, xl2:1.90, xl3:2.45 };
  window._tmApplySize = function(size, el) {
    var s = SIZE_SCALES[size] || 1.0;
    var css = ':root{'
      + '--text-xs:' + (SIZE_BASE.xs*s).toFixed(2) + 'rem;'
      + '--text-sm:' + (SIZE_BASE.sm*s).toFixed(2) + 'rem;'
      + '--text-base:' + (SIZE_BASE.base*s).toFixed(2) + 'rem;'
      + '--text-md:' + (SIZE_BASE.md*s).toFixed(2) + 'rem;'
      + '--text-lg:' + (SIZE_BASE.lg*s).toFixed(2) + 'rem;'
      + '--text-xl:' + (SIZE_BASE.xl*s).toFixed(2) + 'rem;'
      + '--text-2xl:' + (SIZE_BASE.xl2*s).toFixed(2) + 'rem;'
      + '--text-3xl:' + (SIZE_BASE.xl3*s).toFixed(2) + 'rem;'
      + '}';
    var st = document.getElementById('_tmSizeOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmSizeOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.fontSize', size); } catch(_){}
    if (el) {
      var parent = el.parentElement;
      if (parent) {
        parent.querySelectorAll('.gs-sz-btn').forEach(function(b){ b.classList.remove('active'); });
        el.classList.add('active');
      }
    }
    if (typeof toast === 'function') toast('字号·' + (size==='sm'?'小':size==='md'?'中':size==='lg'?'大':'特大'));
  };

  window._tmApplyBodyFont = function(font) {
    var css = ':root{--font-serif:"' + font + '","STKaiti","KaiTi","楷体","Noto Serif SC","SimSun",serif;}';
    var st = document.getElementById('_tmBodyFontOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmBodyFontOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.fontBody', font); } catch(_){}
    if (typeof toast === 'function') toast('正文字体·' + font);
  };

  window._tmApplyTitleFont = function(font) {
    var css = '.home-title,.turn-summary-bar,.gs-panel-title,.gs-drawer-title,.mem-title,.wdp-title,.hy-title,.bn-title,h1,h2,h3,h4{font-family:"' + font + '","STKaiti","KaiTi","楷体",serif !important;}';
    var st = document.getElementById('_tmTitleFontOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmTitleFontOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.fontTitle', font); } catch(_){}
    if (typeof toast === 'function') toast('标题字体·' + font);
  };

  // 启动时恢复已保存的设置
  try {
    var _sv = localStorage.getItem('tm.theme'); if (_sv && _sv !== 'plain') window._tmApplyTheme(_sv);
    var _sz = localStorage.getItem('tm.fontSize'); if (_sz && _sz !== 'md') window._tmApplySize(_sz);
    var _bf = localStorage.getItem('tm.fontBody'); if (_bf && _bf !== 'STKaiti') window._tmApplyBodyFont(_bf);
    var _tf = localStorage.getItem('tm.fontTitle'); if (_tf && _tf !== 'STKaiti') window._tmApplyTitleFont(_tf);
  } catch(_){}
})();
