// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-chaoyi-misc.js — 朝议附带杂务 (R125 从 tm-chaoyi.js L1664-2781 拆出)
//
// ⚠ 此文件是前置状态债务的集中体·应进一步分配到各自领域:
//   - 官员表任命覆盖         → tm-office-panel.js?
//   - 继续游戏按钮           → tm-launch.js?
//   - 奏议批复扩展           → tm-memorials.js?
//   - Electron 桌面端存档    → tm-storage.js?
//   - 游戏内小地图/交互地图   → tm-map-system.js?
//   - 音效和音乐             → tm-audio-theme.js
// 保留本文件作为中转·后续 R126+ 逐个迁移到正确归属
// ============================================================

// ============================================================
//  官员表任命（覆盖简版）
// ============================================================
// renderOfficeTree 已在 tm-index-world.js 中定义（SVG树状图版本）
// renderOfficeDeptV2 仍保留作为SVG不可用时的回退

function renderOfficeDeptV2(dept,path){
  var ps=JSON.stringify(path);
  var posH=(dept.positions||[]).map(function(pos,pi){
    var pp=path.concat(["p",pi]);var ppS=JSON.stringify(pp);var ppId="od-"+pp.join("-");
    // ── 三层统计：编制 / 缺员 / 已具名 ──
    var _est = pos.establishedCount != null ? pos.establishedCount : (parseInt(pos.headCount,10) || 1);
    var _vac = pos.vacancyCount != null ? pos.vacancyCount : 0;
    var _occ = Math.max(0, _est - _vac);
    var _ah = Array.isArray(pos.actualHolders) ? pos.actualHolders : (pos.holder ? [{name:pos.holder,generated:true}] : []);
    var _namedArr = _ah.filter(function(h){return h && h.name && h.generated!==false;});
    var _placeholderCount = _ah.filter(function(h){return h && h.generated===false;}).length;
    // 三栏标签
    var _triBar = '<div style="display:inline-flex;gap:4px;font-size:0.6rem;margin-left:4px;">'
      + '<span style="background:rgba(107,93,79,0.2);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="编制">\u7F16'+_est+'</span>'
      + (_vac>0 ? '<span style="background:rgba(192,64,48,0.15);color:var(--vermillion-400);padding:0 4px;border-radius:2px;" title="缺员(史料记载)">\u7F3A'+_vac+'</span>' : '')
      + '<span style="background:rgba(87,142,126,0.15);color:var(--celadon-400);padding:0 4px;border-radius:2px;" title="实际在职">\u5728'+_occ+'</span>'
      + '<span style="background:rgba(184,154,83,0.15);color:var(--gold-400);padding:0 4px;border-radius:2px;" title="已具名(有角色)">\u540D'+_namedArr.length+'</span>'
      + (_placeholderCount>0 ? '<span style="background:rgba(184,154,83,0.08);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="在职但无角色内容——运行时 AI 按需生成">\u203B'+_placeholderCount+'</span>' : '')
      + '</div>';
    // ── 俸禄理论/实际 ──
    var _perSalary = pos.perPersonSalary || pos.salary || '';
    var _salaryBar = '';
    if (_perSalary) {
      var _n = parseFloat(String(_perSalary).replace(/[^\d.]/g,'')) || 0;
      var _unit = String(_perSalary).replace(/[\d.]/g,'').trim();
      if (_n > 0) {
        _salaryBar = '<span style="font-size:0.6rem;color:var(--ink-300);margin-left:6px;" title="理论总俸=单俸×编制；实际支出=单俸×(编制-缺员)">俸'+_perSalary+'/人 · 理论'+(_n*_est)+_unit+' · 实支'+(_n*_occ)+_unit+'</span>';
      } else {
        _salaryBar = '<span style="font-size:0.6rem;color:var(--ink-300);margin-left:6px;">俸'+_perSalary+'/人</span>';
      }
    }
    // ── 在任者信息（按 actualHolders 显示所有具名任职者） ──
    var holderInfo = '', holderDetail = '';
    if (_namedArr.length > 0) {
      var _nameLine = _namedArr.slice(0,3).map(function(h) {
        var _hch = findCharByName(h.name);
        if (_hch) {
          var _loy = _hch.loyalty || 50;
          var _loyC = _loy > 70 ? 'var(--celadon-400)' : _loy < 30 ? 'var(--vermillion-400)' : 'var(--color-foreground-secondary)';
          var _portraitImg = _hch.portrait?'<img src="'+escHtml(_hch.portrait)+'" style="width:14px;height:14px;object-fit:cover;border-radius:50%;vertical-align:middle;margin-right:2px;">':'';
          return _portraitImg + '<span style="color:var(--celadon-400);">' + escHtml(h.name) + '</span>'
            + '<span style="font-size:0.6rem;color:' + _loyC + ';margin-left:2px;">\u5FE0' + _loy + '</span>'
            + (h.spawnedTurn ? '<span style="font-size:0.55rem;color:var(--amber-400);margin-left:2px;" title="由 AI 推演实体化">\u2605</span>' : '');
        }
        return '<span style="color:var(--gold-400);">' + escHtml(h.name) + '</span>';
      }).join('、');
      holderInfo = _nameLine + (_namedArr.length > 3 ? '<span style="font-size:0.6rem;color:var(--ink-300);">…等'+_namedArr.length+'人</span>' : '');
      // 主任职者详情（第一个）
      var _hch0 = findCharByName(_namedArr[0].name);
      if (_hch0) {
        // 考评（由吏部NPC给出，存在pos._evaluations中）
        var _lastEval = (pos._evaluations && pos._evaluations.length > 0) ? pos._evaluations[pos._evaluations.length-1] : null;
        if (_lastEval) {
          var _evalColors = {'\u5353\u8D8A':'var(--gold-400)','\u79F0\u804C':'var(--celadon-400)','\u5E73\u5EB8':'var(--ink-300)','\u5931\u804C':'var(--vermillion-400)'};
          holderInfo += '<span style="font-size:0.6rem;color:' + (_evalColors[_lastEval.grade]||'var(--ink-300)') + ';margin-left:3px;">' + escHtml(_lastEval.grade||'') + '</span>';
        }
        holderDetail = '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-top:var(--space-1);padding:var(--space-1) 0;">';
        holderDetail += '\u80FD\u529B\uFF1A\u667A' + (_hch0.intelligence||50) + ' \u653F' + (_hch0.administration||50) + ' \u519B' + (_hch0.military||50);
        if (_hch0.location && !_isSameLocation(_hch0.location, GM._capital||'\u4EAC\u57CE')) holderDetail += ' <span style="color:var(--amber-400);">[\u8FDC\u65B9:' + escHtml(_hch0.location) + ']</span>';
        holderDetail += '</div>';
        if (_lastEval) {
          holderDetail += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);padding:2px 0;border-top:1px solid var(--color-border-subtle);">';
          holderDetail += '\u8003\u8BC4\uFF08' + escHtml(_lastEval.evaluator||'\u5417\u90E8') + '\uFF09\uFF1A' + escHtml(_lastEval.comment||'');
          holderDetail += '</div>';
        }
      }
    } else if (_placeholderCount >= _occ && _occ > 0) {
      holderInfo = '<span style="color:var(--ink-300);font-style:italic;">\u5728\u804C'+_occ+'\u4EBA(\u672A\u5177\u540D\u2014\u2014\u63A8\u6F14\u6D89\u53CA\u65F6\u81EA\u52A8\u5B9E\u4F53\u5316)</span>';
    } else if (_occ === 0) {
      holderInfo = '<span style="color:var(--vermillion-400);">\u5168\u90E8\u7F3A\u5458</span>';
    } else {
      holderInfo = '<span style="color:var(--vermillion-400);">\u7A7A\u7F3A</span>';
    }
    var rankTag = pos.rank ? '<span style="font-size:0.6rem;color:var(--ink-300);margin-left:3px;">(' + escHtml(pos.rank) + ')</span>' : '';
    var dutyLine = (pos.desc || pos.duties) ? '<div style="font-size:0.68rem;color:var(--color-foreground-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:350px;">' + escHtml((pos.desc || pos.duties || '').slice(0, 60)) + '</div>' : '';
    // 操作按钮——不再直接任命，改为荐贤/免职→写入诏令
    var actionBtns = '';
    if (!pos.holder) {
      actionBtns = '<button class="bt bp bsm" onclick="_offRecommend('+ppS+',\'' + escHtml(dept.name).replace(/'/g,"\\'") + '\',\'' + escHtml(pos.name).replace(/'/g,"\\'") + '\')" style="font-size:0.65rem;">\u8350\u8D24</button>';
    } else {
      actionBtns = '<button class="bt bsm" onclick="_offDismissToEdict(\'' + escHtml(pos.holder).replace(/'/g,"\\'") + '\',\'' + escHtml(dept.name).replace(/'/g,"\\'") + '\',\'' + escHtml(pos.name).replace(/'/g,"\\'") + '\')" style="font-size:0.65rem;color:var(--vermillion-400);">\u514D\u804C</button>';
    }
    // 历任记录
    var histLine = '';
    if (pos._history && pos._history.length > 0) {
      histLine = '<div style="font-size:0.6rem;color:var(--ink-300);margin-top:2px;">\u5386\u4EFB\uFF1A' + pos._history.map(function(h){ return escHtml(h.holder||'?'); }).join(' → ') + '</div>';
    }
    return '<div class="office-node"><div class="office-header" onclick="var d=_$(\''+ppId+'\');if(d)d.style.display=d.style.display===\'block\'?\'none\':\'block\';">'
      +'<div style="flex:1;"><span>'+escHtml(pos.name)+'</span>'+rankTag+_triBar+_salaryBar+'<div style="margin-top:2px;">'+holderInfo+'</div></div>'
      +'<div style="display:flex;gap:2px;align-items:center;">'+actionBtns+'<span class="office-expand">\u25BC</span></div></div>'
      +dutyLine+histLine
      +'<div class="office-detail" id="'+ppId+'">'
      +holderDetail
      +'</div></div>';
  }).join("");
  // 部门头——职能标签+编制/缺员/在职/已名聚合统计
  var fnTags = (dept.functions||[]).map(function(f){ return '<span style="font-size:0.6rem;background:rgba(184,154,83,0.15);color:var(--gold-400);padding:1px 4px;border-radius:3px;">' + escHtml(f) + '</span>'; }).join(' ');
  var deptDesc = dept.desc || dept.description || '';
  var _deptEst = 0, _deptVac = 0, _deptOcc = 0, _deptNamed = 0, _deptPH = 0;
  (dept.positions||[]).forEach(function(p) {
    var est = p.establishedCount != null ? p.establishedCount : (parseInt(p.headCount,10) || 1);
    var vac = p.vacancyCount != null ? p.vacancyCount : 0;
    var ah = Array.isArray(p.actualHolders) ? p.actualHolders : (p.holder ? [{name:p.holder,generated:true}] : []);
    _deptEst += est;
    _deptVac += vac;
    _deptOcc += Math.max(0, est - vac);
    _deptNamed += ah.filter(function(h){return h && h.name && h.generated!==false;}).length;
    _deptPH += ah.filter(function(h){return h && h.generated===false;}).length;
  });
  var vacantTag = '<span style="display:inline-flex;gap:3px;font-size:0.6rem;margin-left:4px;">'
    + '<span style="background:rgba(107,93,79,0.2);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="部门编制总额">\u7F16'+_deptEst+'</span>'
    + (_deptVac>0?'<span style="background:rgba(192,64,48,0.15);color:var(--vermillion-400);padding:0 4px;border-radius:2px;" title="缺员总数">\u7F3A'+_deptVac+'</span>':'')
    + '<span style="background:rgba(87,142,126,0.15);color:var(--celadon-400);padding:0 4px;border-radius:2px;" title="实际在职总数">\u5728'+_deptOcc+'</span>'
    + '<span style="background:rgba(184,154,83,0.15);color:var(--gold-400);padding:0 4px;border-radius:2px;" title="已具名角色总数">\u540D'+_deptNamed+'</span>'
    + (_deptPH>0?'<span style="background:rgba(184,154,83,0.08);color:var(--ink-300);padding:0 4px;border-radius:2px;" title="在职但无角色——运行时按需生成">\u203B'+_deptPH+'</span>':'')
    + '</span>';
  var totalCount = (dept.positions||[]).length;
  var subH=(dept.subs||[]).map(function(s,si){return renderOfficeDeptV2(s,path.concat(["s",si]));}).join("");
  return '<div class="office-node"><div class="office-header"><div style="flex:1;"><span style="font-weight:700;">'+escHtml(dept.name)+'</span>'+vacantTag
    +(fnTags?' <span style="margin-left:4px;">'+fnTags+'</span>':'')
    +'</div><div><button class="office-expand" onclick="addOffPos('+ps+')">+\u5B98</button><button class="office-expand" onclick="addOffSub('+ps+')">+\u5C40</button></div></div>'
    +(deptDesc?'<div style="font-size:0.68rem;color:var(--color-foreground-muted);padding:0 0.5rem;margin-bottom:2px;">'+escHtml(deptDesc).slice(0,100)+'</div>':'')
    +'<div class="office-children">'+posH+subH+'</div></div>';
}

// ============================================================
//  继续游戏按钮
// ============================================================
(function(){
  var menu=_$("lt-menu");if(!menu)return;
  if(_$("lt-continue"))return;
  var btn=document.createElement("button");btn.className="lt-btn";btn.id="lt-continue";btn.style.display="none";
  btn.innerHTML="\u25B6 <div><div style=\"font-weight:700;\">\u7EE7\u7EED\u6E38\u620F</div><div id=\"lt-cont-desc\" style=\"font-size:0.75rem;color:var(--txt-d);\"></div></div>";
  btn.onclick=function(){
    if(GM.running){_$("launch").style.display="none";_$("bar").style.display="flex";_$("bar-btns").innerHTML="";_$("G").style.display="grid";_$("shiji-btn").classList.add("show");_$("save-btn").classList.add("show");}
  };
  menu.insertBefore(btn,menu.firstChild);
})();

// 返回主菜单时显示继续按钮
GameHooks.on('backToLaunch:after', function() {
  var cb=_$("lt-continue");
  if(cb&&GM.running){
    cb.style.display="flex";
    var desc=_$("lt-cont-desc");
    if(desc){var sc=findScenarioById(GM.sid);desc.textContent=(sc?sc.name:"")+" T"+GM.turn+" "+getTSText(GM.turn);}
  }
});

// ============================================================
//  奏议批复按钮增加"批复"
// ============================================================
// renderMemorials 不再覆盖，使用 tm-index-world.js 中的完整版本


// ============================================================
//  Electron 桌面端存档支持 已移至 tm-electron.js (R126)
// ============================================================

// ============================================================
//  游戏内小地图
// ============================================================
// renderGameState 小地图装饰已合并到上方（约17787行），此处不再重复

function drawMinimap(){
  var c=_$("g-minimap");if(!c)return;
  if(!P.mapData || !P.mapData.regions || P.mapData.regions.length === 0) return;
  var ctx=c.getContext("2d");
  ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,c.width,c.height);
  var scale=c.width/(P.mapData.width||800);
  P.mapData.regions.forEach(function(r){
    ctx.save();ctx.globalAlpha=0.35;ctx.fillStyle=r.color||"#c9a84c";
    if(r.type==="rect"&&r.rect){
      ctx.fillRect(r.rect.x*scale,r.rect.y*scale,r.rect.w*scale,r.rect.h*scale);
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font=Math.max(7,9*scale)+"px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,(r.rect.x+r.rect.w/2)*scale,(r.rect.y+r.rect.h/2)*scale+3);
    }else if(r.type==="point"&&r.point){
      ctx.globalAlpha=0.8;ctx.beginPath();ctx.arc(r.point.x*scale,r.point.y*scale,4,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font="7px sans-serif";ctx.textAlign="center";
      ctx.fillText(r.name,r.point.x*scale,r.point.y*scale-7);
    }else if(r.type==="poly"&&r.points&&r.points.length>2){
      ctx.beginPath();ctx.moveTo(r.points[0][0]*scale,r.points[0][1]*scale);
      r.points.forEach(function(p){ctx.lineTo(p[0]*scale,p[1]*scale);});
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  });
}

// ============================================================
//  交互式地图系统
// ============================================================

var InteractiveMap = {
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  selectedRegion: null,
  hoveredRegion: null,

  // 初始化
  init: function(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 绑定事件
    this.bindEvents();

    // 绘制地图
    this.draw();
  },

  // 绑定事件
  bindEvents: function() {
    var self = this;

    // 鼠标滚轮缩放
    this.canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? 0.9 : 1.1;
      var newScale = self.scale * delta;

      // 限制缩放范围
      if (newScale < 0.5) newScale = 0.5;
      if (newScale > 3) newScale = 3;

      // 计算缩放中心
      var rect = self.canvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;

      // 调整偏移以保持鼠标位置不变
      self.offsetX = mouseX - (mouseX - self.offsetX) * (newScale / self.scale);
      self.offsetY = mouseY - (mouseY - self.offsetY) * (newScale / self.scale);

      self.scale = newScale;
      self.draw();
    });

    // 鼠标拖拽平移
    this.canvas.addEventListener('mousedown', function(e) {
      self.isDragging = true;
      self.dragStartX = e.clientX - self.offsetX;
      self.dragStartY = e.clientY - self.offsetY;
    });

    this.canvas.addEventListener('mousemove', function(e) {
      if (self.isDragging) {
        self.offsetX = e.clientX - self.dragStartX;
        self.offsetY = e.clientY - self.dragStartY;
        self.draw();
      } else {
        // 检测悬停区域
        var rect = self.canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left - self.offsetX) / self.scale;
        var mouseY = (e.clientY - rect.top - self.offsetY) / self.scale;

        self.hoveredRegion = self.getRegionAt(mouseX, mouseY);
        self.draw();
      }
    });

    this.canvas.addEventListener('mouseup', function(e) {
      if (self.isDragging) {
        self.isDragging = false;
      } else {
        // 点击选择区域
        var rect = self.canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left - self.offsetX) / self.scale;
        var mouseY = (e.clientY - rect.top - self.offsetY) / self.scale;

        var region = self.getRegionAt(mouseX, mouseY);
        if (region) {
          self.selectedRegion = region;
          self.showRegionInfo(region);
          self.draw();
        }
      }
    });

    this.canvas.addEventListener('mouseleave', function() {
      self.isDragging = false;
      self.hoveredRegion = null;
      self.draw();
    });
  },

  // 获取指定坐标的区域
  getRegionAt: function(x, y) {
    if (!P.mapData || !P.mapData.regions) return null;

    for (var i = P.mapData.regions.length - 1; i >= 0; i--) {
      var r = P.mapData.regions[i];

      if (r.type === 'rect' && r.rect) {
        if (x >= r.rect.x && x <= r.rect.x + r.rect.w &&
            y >= r.rect.y && y <= r.rect.y + r.rect.h) {
          return r;
        }
      } else if (r.type === 'point' && r.point) {
        var dist = Math.sqrt(Math.pow(x - r.point.x, 2) + Math.pow(y - r.point.y, 2));
        if (dist <= 10) return r;
      } else if (r.type === 'poly' && r.points && r.points.length > 2) {
        if (this.isPointInPolygon(x, y, r.points)) return r;
      }
    }

    return null;
  },

  // 判断点是否在多边形内
  isPointInPolygon: function(x, y, points) {
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i][0], yi = points[i][1];
      var xj = points[j][0], yj = points[j][1];

      var intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  // 绘制地图
  draw: function() {
    if (!this.ctx || !P.mapData || !P.mapData.regions) return;

    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;

    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // 应用变换
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 绘制所有区域
    P.mapData.regions.forEach(function(r) {
      var isSelected = this.selectedRegion && this.selectedRegion.name === r.name;
      var isHovered = this.hoveredRegion && this.hoveredRegion.name === r.name;

      ctx.save();

      // 设置透明度和颜色
      ctx.globalAlpha = isSelected ? 0.7 : (isHovered ? 0.5 : 0.35);
      ctx.fillStyle = r.color || '#c9a84c';

      // 绘制区域形状
      if (r.type === 'rect' && r.rect) {
        ctx.fillRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);

        // 绘制边框
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#ffd700' : '#fff';
          ctx.lineWidth = 2 / this.scale;
          ctx.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
        }

        // 绘制文字
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (14 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, r.rect.x + r.rect.w / 2, r.rect.y + r.rect.h / 2 + 5);
      } else if (r.type === 'point' && r.point) {
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(r.point.x, r.point.y, 6 / this.scale, 0, Math.PI * 2);
        ctx.fill();

        // 绘制文字
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (12 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, r.point.x, r.point.y - 10 / this.scale);
      } else if (r.type === 'poly' && r.points && r.points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(r.points[0][0], r.points[0][1]);
        r.points.forEach(function(p) {
          ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        ctx.fill();

        // 绘制边框
        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#ffd700' : '#fff';
          ctx.lineWidth = 2 / this.scale;
          ctx.stroke();
        }

        // 计算中心点绘制文字
        var centerX = r.points.reduce(function(sum, p) { return sum + p[0]; }, 0) / r.points.length;
        var centerY = r.points.reduce(function(sum, p) { return sum + p[1]; }, 0) / r.points.length;

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = (14 / this.scale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, centerX, centerY + 5);
      }

      ctx.restore();
    }.bind(this));

    ctx.restore();

    // 绘制控制提示
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 10, 200, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('滚轮缩放 | 拖拽平移', 20, 30);
    ctx.fillText('点击区域查看详情', 20, 50);
    ctx.fillText('缩放: ' + (this.scale * 100).toFixed(0) + '%', 20, 65);
  },

  // 显示区域信息
  showRegionInfo: function(region) {
    var infoDiv = document.getElementById('map-region-info');
    if (!infoDiv) return;

    var html = '<h4 style="color:var(--gold);margin-bottom:0.5rem;">' + region.name + '</h4>';

    // 显示控制者
    if (region.controller) {
      html += '<div style="margin-bottom:0.3rem;"><strong>控制者:</strong> ' + region.controller + '</div>';
    }

    // 显示人口
    if (region.population) {
      html += '<div style="margin-bottom:0.3rem;"><strong>人口:</strong> ' + region.population + '</div>';
    }

    // 显示收入
    if (region.income) {
      html += '<div style="margin-bottom:0.3rem;"><strong>收入:</strong> ' + region.income + '</div>';
    }

    // 显示描述
    if (region.desc) {
      html += '<div style="margin-top:0.5rem;color:var(--txt-d);font-size:0.85rem;">' + region.desc + '</div>';
    }

    infoDiv.innerHTML = html;
  }
};

// 打开交互式地图
function openInteractiveMap() {
  if (!P.mapData || !P.mapData.regions || P.mapData.regions.length === 0) {
    toast('❌ 当前剧本没有地图数据');
    return;
  }

  var ov = document.createElement('div');
  ov.className = 'generic-modal-overlay';
  ov.id = 'interactive-map-overlay';

  var html = '<div class="generic-modal" style="max-width:90vw;max-height:90vh;width:1200px;display:flex;flex-direction:column;">';
  html += '<div class="generic-modal-header">';
  html += '<h3>🗺️ 交互式地图</h3>';
  html += '<button onclick="closeInteractiveMap()">✕</button>';
  html += '</div>';

  html += '<div style="flex:1;display:flex;overflow:hidden;">';

  // 左侧地图画布
  html += '<div style="flex:1;position:relative;">';
  html += '<canvas id="interactive-map-canvas" width="900" height="600" style="width:100%;height:100%;cursor:grab;"></canvas>';
  html += '</div>';

  // 右侧信息面板
  html += '<div style="width:280px;border-left:1px solid var(--bg-3);padding:1rem;overflow-y:auto;">';
  html += '<div id="map-region-info" style="color:var(--txt-d);font-size:0.9rem;">点击地图区域查看详情</div>';
  html += '</div>';

  html += '</div>';
  html += '</div>';

  ov.innerHTML = html;
  document.body.appendChild(ov);

  // 初始化交互式地图
  var canvas = document.getElementById('interactive-map-canvas');
  if (canvas) {
    InteractiveMap.init(canvas);
  }
}

function closeInteractiveMap() {
  var ov = document.getElementById('interactive-map-overlay');
  if (ov) ov.remove();
}

// ============================================================
//  音效和音乐系统
// ============================================================


