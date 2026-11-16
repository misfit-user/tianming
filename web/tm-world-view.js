// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-world-view.js — 天下大势（时代趋势折线图 + 历史事件时间轴）
 *
 * 来源：2026-04-24 R20 从 tm-patches.js:1896-2090 抽离
 *
 * 导出（挂到 window 全局）：
 *   openWorldSituation()         — 打开天下大势弹窗（含趋势图+事件时间轴）
 *   closeWorldSituation()        — 关闭弹窗
 *   openHistoricalEvents()       — 兼容旧调用 → openWorldSituation
 *   openEraTrends()              — 兼容旧调用 → openWorldSituation
 *   closeHistoricalEvents()      — 兼容旧调用 → closeWorldSituation
 *   closeEraTrends()             — 兼容旧调用 → closeWorldSituation
 *   drawEraTrendsChart(canvas, history, dimensions)  — Canvas 绘制 7 维趋势线
 *
 * 依赖：
 *   - GM.eraStateHistory / GM.historicalEvents
 *   - escHtml（全局工具）
 *   - CSS 类：.generic-modal-overlay / .generic-modal / .bt .bsm
 *
 * 兼容性：原 tm-patches.js:1896-2090 保留相同代码作双保险。
 * 加载顺序：在 tm-patches.js 之后，以新版本覆盖旧函数定义。
 * ============================================================ */

function openWorldSituation(){
  var ov=document.createElement("div");
  ov.className="generic-modal-overlay";
  ov.id="world-situation-overlay";

  var modal=document.createElement("div");
  modal.className="generic-modal";
  modal.style.cssText="background:var(--bg-1);border-radius:12px;padding:1.5rem;width:90%;max-width:900px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);";

  var header=document.createElement("div");
  header.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;";
  header.innerHTML='<h3 style="margin:0;color:var(--txt-l);">天下大势</h3><button class="bt bsm" onclick="closeWorldSituation()">✕</button>';
  modal.appendChild(header);

  // ── 上半部分：时代趋势折线图 ──
  var dimensions=[
    {key:'politicalUnity',label:'政治统一',color:'#4a9eff'},
    {key:'centralControl',label:'中央集权',color:'#ff6b6b'},
    {key:'socialStability',label:'社会稳定',color:'#51cf66'},
    {key:'economicProsperity',label:'经济繁荣',color:'#ffd43b'},
    {key:'culturalVibrancy',label:'文化活力',color:'#a78bfa'},
    {key:'bureaucracyStrength',label:'官僚体系',color:'#ff8787'},
    {key:'militaryProfessionalism',label:'军队职业化',color:'#74c0fc'}
  ];

  if(GM.eraStateHistory && GM.eraStateHistory.length>=2){
    var chartBox=document.createElement("div");
    chartBox.style.cssText="background:var(--bg-2);border-radius:8px;padding:1rem;margin-bottom:0.8rem;";
    var canvas=document.createElement("canvas");
    canvas.id="ws-trends-canvas";
    canvas.width=840;canvas.height=320;
    canvas.style.cssText="width:100%;height:auto;";
    chartBox.appendChild(canvas);
    modal.appendChild(chartBox);

    var legend=document.createElement("div");
    legend.style.cssText="display:flex;flex-wrap:wrap;gap:0.6rem;justify-content:center;margin-bottom:1.2rem;";
    dimensions.forEach(function(dim){
      legend.innerHTML+='<div style="display:flex;align-items:center;gap:4px;font-size:0.78rem;"><div style="width:12px;height:12px;background:'+dim.color+';border-radius:2px;"></div><span>'+dim.label+'</span></div>';
    });
    modal.appendChild(legend);
  }else{
    var noChart=document.createElement("div");
    noChart.style.cssText="text-align:center;padding:1.5rem;color:var(--txt-d);font-size:0.85rem;background:var(--bg-2);border-radius:8px;margin-bottom:1rem;";
    noChart.textContent='趋势图需至少 2 回合数据';
    modal.appendChild(noChart);
  }

  // ── 下半部分：历史事件时间轴 ──
  if(!GM.historicalEvents) GM.historicalEvents=[];
  var events=GM.historicalEvents;

  var evtSection=document.createElement("div");
  if(events.length===0){
    evtSection.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--txt-d);font-size:0.85rem;">暂无历史大事件</div>';
  }else{
    var evtHtml='<div style="font-size:0.9rem;font-weight:700;color:var(--txt-l);margin-bottom:0.6rem;">历史大事件 ('+events.length+')</div>';
    var typeMap={
      economic_crisis:{c:'var(--red)',i:'💸'},civil_unrest:{c:'var(--red)',i:'⚠️'},
      political_fragmentation:{c:'var(--gold)',i:'🗺️'},power_decentralization:{c:'var(--gold)',i:'📉'},
      golden_age:{c:'var(--gold)',i:'✨'},decline_begins:{c:'var(--gold)',i:'📉'},
      dynasty_collapse:{c:'var(--red)',i:'💥'},revival:{c:'var(--green)',i:'🌟'},
      total_crisis:{c:'var(--red)',i:'🔥'}
    };

    var sorted=events.slice().sort(function(a,b){return b.turn-a.turn;});
    sorted.forEach(function(evt){
      var tm=typeMap[evt.type]||{c:'var(--txt-d)',i:'📌'};
      var parts=(evt.description||'').split('：');
      var title=parts[0]||'';
      var desc=parts[1]||'';
      evtHtml+='<div style="display:flex;gap:0.6rem;margin-bottom:0.6rem;padding:0.6rem;background:var(--bg-2);border-left:3px solid '+tm.c+';border-radius:4px;">';
      evtHtml+='<div style="font-size:1.2rem;flex-shrink:0;">'+tm.i+'</div>';
      evtHtml+='<div style="flex:1;min-width:0;">';
      evtHtml+='<div style="display:flex;justify-content:space-between;align-items:center;">';
      evtHtml+='<span style="font-weight:700;color:'+tm.c+';font-size:0.88rem;">'+escHtml(title)+'</span>';
      evtHtml+='<span style="font-size:0.7rem;color:var(--txt-d);flex-shrink:0;">第'+evt.turn+'回合</span>';
      evtHtml+='</div>';
      if(desc) evtHtml+='<div style="font-size:0.8rem;color:var(--txt-s);margin-top:0.2rem;">'+escHtml(desc)+'</div>';
      if(evt.date) evtHtml+='<div style="font-size:0.7rem;color:var(--txt-d);margin-top:0.2rem;">'+escHtml(evt.date)+'</div>';
      if(evt.effects&&evt.effects.length>0){
        evtHtml+='<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.3rem;">';
        evt.effects.forEach(function(ef){
          var ec=ef.indexOf('-')>=0?'var(--red)':ef.indexOf('+')>=0?'var(--green)':'var(--txt-d)';
          evtHtml+='<span style="font-size:0.71rem;background:var(--bg-3);color:'+ec+';padding:1px 5px;border-radius:3px;">'+ef+'</span>';
        });
        evtHtml+='</div>';
      }
      evtHtml+='</div></div>';
    });
    evtSection.innerHTML=evtHtml;
  }
  modal.appendChild(evtSection);

  ov.appendChild(modal);
  document.body.appendChild(ov);

  if(GM.eraStateHistory && GM.eraStateHistory.length>=2){
    var c=document.getElementById("ws-trends-canvas");
    if(c) drawEraTrendsChart(c,GM.eraStateHistory,dimensions);
  }
}

function closeWorldSituation(){
  var ov=document.getElementById("world-situation-overlay");
  if(ov)ov.remove();
}
// 兼容旧调用
function openHistoricalEvents(){ openWorldSituation(); }
function openEraTrends(){ openWorldSituation(); }

// 绘制时代趋势图表
function drawEraTrendsChart(canvas,history,dimensions){
  if(!canvas) return;
  var ctx=canvas.getContext('2d');
  if(!ctx) return;
  var w=canvas.width;
  var h=canvas.height;

  ctx.fillStyle='#1a1a1a';
  ctx.fillRect(0,0,w,h);

  ctx.strokeStyle='#333';
  ctx.lineWidth=1;
  for(var i=0;i<=10;i++){
    var y=h*0.1+i*(h*0.8/10);
    ctx.beginPath();
    ctx.moveTo(w*0.1,y);
    ctx.lineTo(w*0.9,y);
    ctx.stroke();
  }

  ctx.fillStyle='#888';
  ctx.font='12px sans-serif';
  ctx.textAlign='right';
  for(var i=0;i<=10;i++){
    var y=h*0.1+i*(h*0.8/10);
    var value=(1.0-(i/10)).toFixed(1);
    ctx.fillText(value,w*0.08,y+4);
  }

  ctx.textAlign='center';
  var step=Math.max(1,Math.floor(history.length/10));
  for(var i=0;i<history.length;i+=step){
    var x=w*0.1+i*(w*0.8/(history.length-1));
    ctx.fillText('T'+history[i].turn,x,h*0.95);
  }

  dimensions.forEach(function(dim){
    ctx.strokeStyle=dim.color;
    ctx.lineWidth=2;
    ctx.beginPath();

    for(var i=0;i<history.length;i++){
      var x=w*0.1+i*(w*0.8/(history.length-1));
      var value=history[i][dim.key]||0;
      var y=h*0.1+(1-value)*(h*0.8);

      if(i===0){
        ctx.moveTo(x,y);
      }else{
        ctx.lineTo(x,y);
      }
    }

    ctx.stroke();

    for(var i=0;i<history.length;i++){
      var x=w*0.1+i*(w*0.8/(history.length-1));
      var value=history[i][dim.key]||0;
      var y=h*0.1+(1-value)*(h*0.8);

      ctx.fillStyle=dim.color;
      ctx.beginPath();
      ctx.arc(x,y,3,0,Math.PI*2);
      ctx.fill();
    }
  });
}
