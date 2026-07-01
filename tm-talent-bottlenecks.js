/* tm-talent-bottlenecks.js — S3b 瓶颈真实接线:把人才渗透的三瓶颈接到真实游戏世界。
 * 详设 institutional-building-talent-penetration-design-2026-06.md
 * buildCtx(GM,P) 返回 ctx 给 TalentCohorts.tick:据全国真实产业/政区规模算各范式的"岗位吸纳上限"。
 *   -> 没对应产业 = 没岗位 = 毕业即失业(防数字游戏的"产业瓶颈"由此变成游戏真约束)。
 * 师资瓶颈用引擎默认(外聘+成熟人才回流自举);institutionalRoom 默认可配(S5 接政治阻力后动态)。
 * 跨朝代:只读通用经济字段(economyBase.*)与政区/人口,无朝代专名。
 */
(function(root){
  "use strict";
  var TM=root.TM||(root.TM={});
  function num(v,d){var n=Number(v);return isFinite(n)?n:(d||0);}
  function conf(P){return (P&&P.conf)||(root.P&&root.P.conf)||{};}
  // 遍历 adminHierarchy 聚合全国 economyBase + 人口 + 政区数 + 驻军(一次·缓存进 ctx)
  function aggregate(GM,P){
    var ah=(P&&P.adminHierarchy)||(root.GM&&root.GM.adminHierarchy)||(GM&&GM.adminHierarchy)||{};
    var t={mineral:0,commerce:0,maritime:0,farmland:0,salt:0,mouths:0,divs:0,recruits:0};
    Object.keys(ah).forEach(function(fk){
      var fh=ah[fk]; var ds=fh&&(fh.divisions||fh.children); if(!ds||!ds.length)return;
      (function walk(list){
        list.forEach(function(d){
          if(!d)return;
          var kids=d.children||d.divisions;
          if(kids&&kids.length){walk(kids);return;}
          t.divs++;
          var eb=d.economyBase||{};
          t.mineral+=num(eb.mineralProduction); t.commerce+=num(eb.commerceVolume);
          t.maritime+=num(eb.maritimeTradeVolume); t.farmland+=num(eb.farmland); t.salt+=num(eb.saltProduction);
          var pd=d.populationDetail||{}; t.mouths+=num(pd.mouths);
          t.recruits+=num(d.troops);
        });
      })(ds);
    });
    return t;
  }
  // 岗位密度:多少产业规模/人口养一个新式人才岗位(每回合)·真机可调
  var DENSITY={industry:0.0008,craft:0.0010,commerce:0.0008,agriculture:0.0003,governance:20,military:0.005,medicine:0.00005,_default:0.0002};
  function demandForKind(kind,t){
    switch(kind){
      case "industry": return (t.mineral+t.commerce)*DENSITY.industry;
      case "craft": return t.commerce*DENSITY.craft;
      case "commerce": return (t.commerce+t.maritime)*DENSITY.commerce;
      case "agriculture": return t.farmland*DENSITY.agriculture;
      case "governance": return t.divs*DENSITY.governance;
      case "military": return t.recruits*DENSITY.military;
      case "medicine": return t.mouths*DENSITY.medicine;
      default: return t.mouths*DENSITY._default;
    }
  }
  // S5b·制度空间动态化（design §2.4 第4层：room = f(旧式当道度, 改革推进度, 政治阻力)）。
  //   conf.talentInstitutionalRoom 显式设 → 当 override（测试/剧本锚·静态）；否则据下式动态派生：
  //   · 旧式当道度 dominance（established 占比·越庞大初始压制越狠→floor 越低）
  //   · 此范式上回合渗透 priorPen（history·渗透越高空间越大→正反馈飞轮）
  //   · 政治阻力 _lastBacklash（旧势力反扑期·S5a 写入·暂时压低空间）
  var ROOM = { crit: 0.4, floorMin: 0.2, floorMax: 0.55, backlashDamp: 0.4 };
  function _ramp(x){ return x<0?0:(x>1?1:x); }
  function _dynamicRoom(GM, p){
    var st = GM && GM._talentCohorts; if(!st||!st.paradigms||!p) return 1;
    var estStock=0, emEff=0;
    Object.keys(st.paradigms).forEach(function(id){ var q=st.paradigms[id]; if(!q)return; if(q.kind==='established') estStock+=num(q.stock); else emEff+=num(q.effectiveStock); });
    var dominance = (estStock+emEff>0) ? estStock/(estStock+emEff) : 1;              // ~1 早期（旧式当道）
    var floor = ROOM.floorMax - (ROOM.floorMax-ROOM.floorMin)*dominance;             // 旧式全占→floorMin·新旧平分→居中
    var priorPen=0, hist=st.history;
    if(hist&&hist.length){ var h=hist[hist.length-1]; priorPen=(h.byParadigm&&h.byParadigm[p.id])||0; }
    var rise = _ramp(priorPen/ROOM.crit);                                            // 渗透→crit 间升到 1（飞轮）
    var room = floor + (1-floor)*rise;
    var bl = num(st._lastBacklash);                                                  // 政治阻力（旧势力反扑·S5a 写入·缺则 0）
    if(bl>0) room *= (1 - Math.min(ROOM.backlashDamp, bl));
    return room<0?0:(room>1?1:room);
  }
  function buildCtx(GM,P){
    var t=aggregate(GM,P);
    var override=conf(P).talentInstitutionalRoom;
    var hasOverride=(override!=null), ov=hasOverride?num(override,1):1;
    return {
      _totals:t,
      absorptionDemandFor:function(p){
        var kinds=(p&&p.absorptionKind&&p.absorptionKind.length)?p.absorptionKind:["_default"];
        var sum=0; kinds.forEach(function(k){sum+=demandForKind(k,t);});
        return sum;
      },
      institutionalRoomFor:function(p){ return hasOverride ? ov : _dynamicRoom(GM, p); }
    };
  }
  TM.TalentBottlenecks={buildCtx:buildCtx,aggregate:aggregate,demandForKind:demandForKind,_dynamicRoom:_dynamicRoom,DENSITY:DENSITY,ROOM:ROOM,version:"0.2.0-S5b-dynroom"};
  if(typeof module!=="undefined"&&module.exports) module.exports=TM.TalentBottlenecks;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:this));
