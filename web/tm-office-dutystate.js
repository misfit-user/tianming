/* tm-office-dutystate.js — 官制活化 Slice② 履职度(duty state) tick + 对称域效果
 *
 * 用途：每回合更新每个主官/掌权官职的履职度 _dutyState，并算出"失职扣/称职奖"的域效果(delta)。
 * 状态：已接线（tickOfficeDutyState 每回合挂 tm-ai-change-applier.js·失职扣/称职奖映射既有 FE 杠杆 taxCollect/supervise/impeach）。注释此前误标「未接线」·已正。
 * 设计依据：docs/officialdom-activation-design.md §3 Slice② + owner 力度裁示(2026-06-20·对称档)。
 *
 * 政策(§9)：引擎管数(履职度分值)，AI 管料(backlog 内容·此 PoC 暂不含 backlog)。
 * 力度(owner·对称档·均为每回合·持续累积·夹既有引擎量纲)：
 *   出缺/履职<35：掌 taxCollect → compliance -0.025；掌 supervise|impeach → corruption +2.5
 *   履职>70(称职)：掌 taxCollect → compliance +0.01；掌 supervise|impeach → corruption -1
 *   35~70：无（中性·新官起步 fulfillment=50 即此带·先不奖不罚）
 * 跨朝代：按抽象 power 映射杠杆(taxCollect→实征率·supervise/impeach→腐败)，不认官署专名。
 * v1 域覆盖：仅 taxCollect/supervise/impeach 两类已接杠杆；military/personnel/justice/works 待接杠杆再扩。
 */
(function (global) {
  'use strict';

  var POWER_KEYS = ['taxCollect', 'militaryCommand', 'appointment', 'impeach', 'supervise', 'yinBu', 'judicial', 'works', 'drafting'];
  var DOMAIN_ATTR = { militaryCommand: 'military', works: 'management', drafting: 'intelligence' }; // 其余默认 administration
  var HS = (global.TM && global.TM.OfficeHolderState) || (typeof require === 'function' ? require('./tm-office-holder-state.js') : null);
  var Evidence = (global.TM && global.TM.OfficeActionEvidence) || (typeof require === 'function' ? require('./tm-office-action-evidence.js') : null);

  // owner 裁示·对称档（可调）
  var DEFAULT_FORCE = {
    vacancyDecay: 12,   // 出缺·履职度每30日衰减
    driftRate: 0.3,     // 在任·履职度漂向"承载力"的速率
    lowBand: 35, highBand: 70,
    compLow: 0.025, compHigh: 0.01,  // 实征率：失职扣 / 称职奖
    corrLow: 2.5, corrHigh: 1        // 腐败：失职涨 / 称职降
  };

  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function _fn(name) { return (typeof global[name] === 'function') ? global[name] : null; }
  function _powersOf(p) {
    var out = [], pw = p && p.powers;
    if (pw) POWER_KEYS.forEach(function (k) { if (pw[k]) out.push(k); });
    return out;
  }
  function _rankLvl(p) { var g = _fn('getRankLevel'); return g ? g(p.rank) : 99; }
  function _isHead(p) {
    if (_rankLvl(p) <= 6) return true;
    return /尚书|侍郎|都御史|大学士|卿$|总督|巡抚|首辅|长官|令$|尹$|使$/.test(p.name || '');
  }

  // 五常评分(0-100)·履职看德性非忠君(owner 2026-06-20修正)：义.28信.28礼.20仁.16智.08(智已被才覆盖故低)。镜像 tmfRenwuWuchangValue 兜底读法·不依赖UI层
  var _WC_ALIAS = { ren: ['仁', 'ren', 'benevolence'], yi: ['义', 'yi', 'righteousness'], li: ['礼', 'li', 'propriety'], zhi: ['智', 'zhi', 'wisdom'], xin: ['信', 'xin', 'honesty', 'trust'] };
  function _wcVal(ch, k) { var src = (ch && (ch.wuchang || ch.wuchangOverride || ch.fiveConstants || ch.morals)) || {}; var al = _WC_ALIAS[k]; for (var i = 0; i < al.length; i++) { var v = src[al[i]]; if (v != null && !isNaN(Number(v))) return Number(v); } return 50; }
  function _wuchangScore(ch) { return _wcVal(ch, 'yi') * 0.28 + _wcVal(ch, 'xin') * 0.28 + _wcVal(ch, 'li') * 0.20 + _wcVal(ch, 'ren') * 0.16 + _wcVal(ch, 'zhi') * 0.08; }
  // 在任者对该职位的"承载力"(0-100)：域才0.6 + 五常德性0.4（履职=能不能干×愿不愿尽职·不看忠君）
  function _capacity(ch, power) {
    var domainKey = DOMAIN_ATTR[power] || 'administration';
    var dv = (ch[domainKey] != null) ? ch[domainKey] : 50;
    return dv * 0.6 + _wuchangScore(ch) * 0.4;
  }

  // Integrate continuous drift and band effects, splitting exactly at threshold crossings.
  function _advance(prev, target, vacant, days, F) {
    var rate = Math.max(0, F.vacancyDecay) / 30;
    var k = -Math.log(Math.max(1e-12, 1 - _clamp(F.driftRate, 0, 1))) / 30;
    function at(t) { return _clamp(vacant ? prev - rate * t : target + (prev - target) * Math.exp(-k * t), 0, 100); }
    var cuts = [0, days];
    [0, F.lowBand, 50, F.highBand, 100].forEach(function(level) {
      var t = vacant ? (rate ? (prev-level)/rate : -1) : k && prev!==target && (level-target)/(prev-target)>0 ? -Math.log((level-target)/(prev-target))/k : -1;
      if(t>0 && t<days) cuts.push(t);
    });
    cuts.sort(function(a,b){return a-b;});
    var low=0,high=0,exposure=[];
    for(var i=1;i<cuts.length;i++) {
      var a=cuts[i-1],b=cuts[i],mid=at((a+b)/2),len=b-a,area;
      if(mid<F.lowBand)low+=len;else if(mid>F.highBand)high+=len;
      if(mid<=0||mid>=100)area=mid*len;
      else if(vacant)area=prev*len-rate*(b*b-a*a)/2;
      else area=k?target*len+(prev-target)*(Math.exp(-k*a)-Math.exp(-k*b))/k:prev*len;
      exposure.push((area/50-len)/30);
    }
    return {next:at(days),low:low/30,high:high/30,exposure:exposure};
  }
  function _days(G,opts) {
    if(opts.days!=null) return Math.max(0,HS.number(opts.days,0));
    if(opts.elapsedDays!=null) return Math.max(0,HS.number(opts.elapsedDays,0));
    if(opts.monthRatio!=null) return Math.max(0,HS.number(opts.monthRatio,0)*30);
    var get=_fn('_getDaysPerTurn');
    return Math.max(0,HS.number(get ? get() : G.daysPerTurn,30));
  }

  // 省道与全国共享占员、稳定身份和分事务能力；读口不初始化履职态。
  function officeDutyView(GM, position, opts) {
    opts=opts||{};
    var state=HS?HS.read(GM,position):null,ds=position&&position._dutyState;
    var powers=opts.power?[opts.power]:_powersOf(position),actors=state?state.characters:[];
    if(!powers.length)powers=['general'];
    var capacity=actors.length?actors.reduce(function(sum,h){
      var active=HS.availability(GM,h.char,position,HS.number(opts.day,HS.number(ds&&ds.elapsedDays,0)));
      return sum+powers.reduce(function(n,k){return n+_capacity(active.char,k)*active.capacity;},0)/powers.length;
    },0)/actors.length:null;
    var fulfillment=ds&&typeof ds.fulfillment==='number'?ds.fulfillment:null;
    return {capacity:capacity,fulfillment:fulfillment,band:fulfillment===null?null:fulfillment<DEFAULT_FORCE.lowBand?'low':fulfillment>DEFAULT_FORCE.highBand?'high':'mid'};
  }
  function _currentPosition(p,F) {
    var ds=p&&p._dutyState,value=ds&&typeof ds.fulfillment==='number'?ds.fulfillment:50,byPower={};
    Object.keys(ds&&ds.byPower||{}).forEach(function(k){byPower[k]={next:ds.byPower[k]};});
    return {prev:value,next:value,band:value<F.lowBand?'low':value>F.highBand?'high':'mid',ticked:false,byPower:byPower};
  }
  function tickDutyPosition(GM,position,opts) {
    opts=opts||{};
    var F=Object.assign({},DEFAULT_FORCE,opts.force||{}),result=_currentPosition(position,F);
    if(!GM||!position||!HS||opts.frozen===true)return result;
    var selected=Object.assign({},opts,{_position:position,_capture:function(row){result=row;}});
    tickOfficeDutyState(GM,selected);
    return result;
  }

  /**
   * 每回合 tick：更新各主官/掌权官职 _dutyState，返回本回合应施加的对称域效果。
   * @param {object} GM 需 GM.officeTree / GM.chars / GM.turn
   * @param {object} [opts] { force?:object 覆盖力度 }
   * @returns {{compliance:number, corruption:number, details:Array}} 聚合 delta（caller 调 FE 施加）
   */
  function tickOfficeDutyState(GM, opts) {
    opts = opts || {};
    var F = Object.assign({}, DEFAULT_FORCE, opts.force || {});
    var agg = { compliance: 0, corruption: 0, details: [] };
    if (!GM || !HS || ((!GM.officeTree || !GM.officeTree.length) && !opts._position)) return agg;
    var turn = (GM.turn != null) ? GM.turn : 0;
    var days=_days(GM,opts);
    if(!days) return agg;
    // One synchronous province settlement shares holder/leave/workload reads.
    // The caller discards this scope after the batch; no cross-turn cache lives here.
    var frame=opts._scope&&opts._scope.frame;
    if(frame&&(frame.game!==GM||frame.turn!==turn||frame.days!==days||opts._position&&!frame.rows.some(function(r){return r.p===opts._position;})))frame=null;
    var rows=frame?frame.rows:[],start=frame&&frame.start,segments=frame&&frame.segments;
    if(!frame){
    HS.walk(GM.officeTree, function(p,n,path) {
      var powers=_powersOf(p); if(!powers.length && !_isHead(p) && p!==opts._position)return;
      var state=HS.read(GM,p);
      rows.push({p:p,dept:n.name || '',path:path,state:state,powers:powers,regionId:p.jurisdictionId || p.regionId || n.jurisdictionId || n.regionId,regionName:p.jurisdiction || n.jurisdiction,faction:p.factionId || n.factionId});
    });
    if(opts._position&&!rows.some(function(row){return row.p===opts._position;}))rows.push({p:opts._position,dept:'',path:'',state:HS.read(GM,opts._position),powers:_powersOf(opts._position)});
    start=HS.number(opts.startDay,rows.reduce(function(v,row){var state=row.p._dutyState,day=HS.number(state&&state.elapsedDays,0);return Math.max(v,state&&state.lastTurn===turn?Math.max(0,day-days):day);},0));
    var boundaries=[start,start+days];
    rows.forEach(function(row){row.state.characters.forEach(function(h){
      var leave=row.p.officeLeave || row.p.leave || h.char.officeLeave || h.char.leave || {};
      [leave.startDay,leave.endDay].forEach(function(day){if(day!=null && Number(day)>start && Number(day)<start+days && boundaries.indexOf(Number(day))<0)boundaries.push(Number(day));});
    });});
    boundaries.sort(function(a,b){return a-b;});
    function actorsAt(row,day) {return row.state.characters.map(function(h){return HS.availability(GM,h.char,row.p,day);});}
    segments=boundaries.slice(1).map(function(end,i) {
      var day=(end+boundaries[i])/2,loads=new Map(),actors=rows.map(function(row){return actorsAt(row,day);});
      actors.forEach(function(list){list.forEach(function(a){loads.set(a.char,(loads.get(a.char)||0)+1);});});
      return {days:end-boundaries[i],actors:actors,shares:actors.map(function(list){return list.length?list.reduce(function(sum,a){return sum+1/loads.get(a.char);},0)/list.length:1;})};
    });
    if(opts._scope)opts._scope.frame={game:GM,turn:turn,days:days,rows:rows,start:start,segments:segments};
    }
    rows.forEach(function(row,rowIndex) {
      var p=row.p,deptName=row.dept;
      if(opts._position&&p!==opts._position)return;
      if(typeof opts.skip==='function'&&opts.skip(p))return;
      var pwKeys = _powersOf(p);
      if (!pwKeys.length && !_isHead(p) && p!==opts._position) return;     // 同舆图过滤：只主官/掌权
      var ds = p._dutyState || (p._dutyState = { fulfillment: 50, trend: 'stable', lastTurn: null });
      if (ds.lastTurn === turn) {
        if(typeof opts._capture==='function') {
          var current=_currentPosition(p,F),existingKeys=pwKeys.length?pwKeys:['general'];
          existingKeys.forEach(function(k){var value=HS.number(ds.byPower&&ds.byPower[k],current.next);current.byPower[k]={next:value,exposure:segments.map(function(s){return (value-50)/50*s.days/30*s.shares[rowIndex];})};});
          opts._capture(current);
        }
        return; // 本回合已 tick·防重复施加
      }

      var prev = (typeof ds.fulfillment === 'number') ? ds.fulfillment : 50;
      if(!ds.byPower) ds.byPower={};
      var keys=pwKeys.length?pwKeys:['general'], results={};
      keys.forEach(function(power) {
        var current=HS.number(ds.byPower[power],prev), result={next:current,low:0,high:0,exposure:[]};
        for(var bi=0;bi<segments.length;bi++) {
          var segment=segments[bi], actors=segment.actors[rowIndex], target=current;
          if(actors.length) target=actors.reduce(function(sum,a){return sum+_capacity(a.char,power)*a.capacity;},0)/actors.length;
          var step=_advance(current,target,!row.state.occupied,segment.days,F), share=segment.shares[rowIndex];
          result.low+=step.low*share;result.high+=step.high*share;
          step.exposure.forEach(function(value){result.exposure.push(value*share);});current=step.next;
        }
        result.next=current; results[power]=result;
        ds.byPower[power]=results[power].next;
      });
      var next=keys.reduce(function(sum,k){return sum+ds.byPower[k];},0)/keys.length;
      ds.fulfillment = next;
      ds.trend = next > prev + 0.5 ? 'rising' : next < prev - 0.5 ? 'falling' : 'stable';
      ds.lastTurn = turn;
      ds.elapsedDays = start+days;
      if(typeof opts._capture==='function')opts._capture({prev:prev,next:next,band:next<F.lowBand?'low':next>F.highBand?'high':'mid',ticked:true,byPower:results});

      // 域效果（带 × power·仅 v1 已接杠杆）
      var did = {};   // 每杠杆每官最多记一次（防 supervise+impeach 同署双扣腐败）
      pwKeys.forEach(function (k) {
        var r=results[k];
        var band=r.next<F.lowBand?'low':r.next>F.highBand?'high':'mid';
        if (k === 'taxCollect' && !did.compliance) {
          did.compliance = 1;
          var d = -r.low*F.compLow+r.high*F.compHigh;
          if(!d) return;
          agg.compliance += d;
          agg.details.push({ dept: deptName, pos: p.name || '', positionId:p.id, jurisdiction:p.jurisdictionId || row.path, regionId:row.regionId,regionName:row.regionName,faction:row.faction, lever: 'compliance', delta: d, fulfillment: Math.round(r.next), band: band });
        } else if ((k === 'supervise' || k === 'impeach') && !did.corruption) {
          did.corruption = 1;
          var c = r.low*F.corrLow-r.high*F.corrHigh;
          if(!c) return;
          agg.corruption += c;
          agg.details.push({ dept: deptName, pos: p.name || '', positionId:p.id, jurisdiction:p.jurisdictionId || row.path, regionId:row.regionId,regionName:row.regionName,faction:row.faction, lever: 'corruption', delta: c, fulfillment: Math.round(r.next), band: band });
        }
      });
    });
    return agg;
  }

  // ── ④B·npc_action → 履职反哺：官本回合主动行动定性 → 调其履职度（履职活在人物 agency 里·非脱钩公式·与 tick 的才五常漂移叠加=基线+行动）──
  // 把某官本回合行动的履职 delta 落到其在职位的 _dutyState（非在职官/中性行动则不动）
  function applyNpcActionToDuty(GM, act) {
    if (!GM || !GM.officeTree || !act || !HS || !Evidence) return null;
    var ch=HS.identity(GM,act.characterId != null ? act.characterId : act.actorId,act.name).char;
    if(!ch || ch.alive===false || ch.dead===true) return null;
    var hit=HS.select(GM,ch,Object.assign({},act.dutyEvidence || {},act));
    if (!hit) return null;  // 该人物非在职官·不影响履职
    var fact=Evidence.classify(GM,act,ch);
    if(!fact) return null;
    var delta=fact.delta, key=Evidence.actionKey(GM,act,ch,hit);
    if(!Array.isArray(ch._officeDutyActions)) ch._officeDutyActions=[];
    if(ch._officeDutyActions.indexOf(key)>=0) return null;
    if(fact.kind==='leave') {
      var leave=act.dutyEvidence || {};
      hit.pos.officeLeave={characterId:ch.id,approved:fact.approved,capacity:fact.capacity,canPerform:leave.canPerform,delegateId:fact.delegateId,startDay:leave.startDay,endDay:leave.endDay};
      ch._officeDutyActions.push(key);
      return null;
    }
    var ds = hit.pos._dutyState || (hit.pos._dutyState = { fulfillment: 50, trend: 'stable', lastTurn: null });
    var prev = (typeof ds.fulfillment === 'number') ? ds.fulfillment : 50;
    ds.fulfillment = _clamp(prev + delta, 0, 100);
    if(ds.byPower) {
      var power=act.power || (act.dutyEvidence && act.dutyEvidence.power);
      Object.keys(ds.byPower).forEach(function(k){if(!power || k===power) ds.byPower[k]=_clamp(ds.byPower[k]+delta,0,100);});
      var domains=Object.keys(ds.byPower);
      if(domains.length) ds.fulfillment=domains.reduce(function(sum,k){return sum+ds.byPower[k];},0)/domains.length;
    }
    ds.trend = delta > 0 ? 'rising' : 'falling';
    ch._officeDutyActions.push(key);
    return { holder: ch.name, characterId:ch.id, dept: hit.dept, pos: hit.pos.name, positionId:hit.pos.id, delta: ds.fulfillment-prev, fulfillment: Math.round(ds.fulfillment) };
  }

  global.officeDutyView = officeDutyView;
  global.tickDutyPosition = tickDutyPosition;
  global.tickOfficeDutyState = tickOfficeDutyState;
  global.applyNpcActionToDuty = applyNpcActionToDuty;
  if (typeof module !== 'undefined' && module.exports) module.exports = { tickDutyPosition: tickDutyPosition, officeDutyView: officeDutyView, tickOfficeDutyState: tickOfficeDutyState, applyNpcActionToDuty: applyNpcActionToDuty, DEFAULT_FORCE: DEFAULT_FORCE };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
