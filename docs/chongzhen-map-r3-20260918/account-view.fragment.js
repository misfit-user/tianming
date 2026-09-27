  // Read-only union of explicit original accounts; a same-name child is not the whole region.
  function combinedMapAccountView(r, node){
    if (!r || !node || !Array.isArray(r.accountingLeafIds) || r.accountingLeafIds.length < 2) return null;
    var wanted=new Set(r.accountingLeafIds.map(String)), records=[], seen=new Set();
    (function walk(n){if(!n||seen.has(n))return;seen.add(n);if(wanted.has(String(n.id))){records.push(n);return;}(n.children||n.divisions||[]).forEach(walk);})(node);
    if(records.length!==wanted.size)return null;
    var weights=records.map(function(n){return Number(n.populationDetail&&n.populationDetail.mouths)||Number(n.population)||0;}),total=weights.reduce(function(a,b){return a+b;},0);
    var rates=new Set(['ratio','sexRatio','climate','currentLoad','compliance','skimmingRate','autonomy','autonomyLevel','commerceCoefficient','roadQuality','taxBurden','minxin','minxinLocal','corruption','corruptionLocal','prosperity','unrest']);
    function combine(values,key){
      if(values.every(function(v){return typeof v==='number'&&isFinite(v);}))return rates.has(key)?values.reduce(function(s,v,i){return s+v*weights[i];},0)/Math.max(total,1):values.reduce(function(a,b){return a+b;},0);
      if(values.every(function(v){return v&&typeof v==='object'&&!Array.isArray(v);})){var out={};new Set([].concat.apply([],values.map(Object.keys))).forEach(function(k){out[k]=combine(values.map(function(v){return v[k];}),k);});return out;}
      var known=values.find(function(v){return v!==undefined&&v!==null;});return Array.isArray(known)?known.slice():known;
    }
    var view=Object.assign({},node);
    ['populationDetail','byGender','byAge','bySettlement','carryingCapacity','publicTreasuryInit','economyBase','fiscalDetail','fiscal'].forEach(function(k){var values=records.map(function(n){return ((k==='byGender'||k==='byAge'||k==='bySettlement')&&n.populationDetail&&n.populationDetail[k])||n[k]||{};});view[k]=combine(values,k);});
    view.population=total;view.populationDetail.mouths=total;view.populationDetail.id=node.id;view.populationDetail.name=node.name;
    view._sourceAccountCount=records.length;
    view.description=String((r.data&&r.data.description)||node.description||'')+' 本图块合并显示'+records.length+'份原账，分项身份与数值分别保留。'+(r.theaterAccountIds?'其中含战区分项，不表示所有人口均居于图示海岛。':'');
    return view;
  }
