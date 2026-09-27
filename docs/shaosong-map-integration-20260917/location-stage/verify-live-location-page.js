(() => {
  const checks=[];
  const check=(name,passed,detail)=>{checks.push({name,passed,detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));};
  const map=GM.mapData,service=window.TMMapLocations;
  const rid=name=>map.regions.find(r=>r.name===name)?.id;
  check('location-service-loaded',service?.enabled(map)===true,{schema:map.locationBindingContract?.schema});
  const ruler=GM.chars.find(c=>c.id===map.locationBindingContract.courtCharacterId);
  check('ruler-at-original-bozhou-start',ruler?.regionId===rid('亳州'),{name:ruler?.name,location:ruler?.location,regionId:ruler?.regionId});
  const jin=GM.armies.find(a=>a.name==='金·东京辽阳镇兵');
  check('jin-liaoyang-army-in-liaoyang',jin?.garrisonRegionId===rid('辽阳府'),{name:jin?.name,garrison:jin?.garrison,regionId:jin?.garrisonRegionId});
  const navy=GM.armies.find(a=>a.name==='建康水军·韩世忠舟师');
  check('multi-city-navy-not-falsely-single-camp',navy?.mapLocationBinding?.status==='ambiguous'&&!navy?.regionId,{garrison:navy?.garrison,status:navy?.mapLocationBinding?.status,candidates:navy?.mapLocationBinding?.candidateRegionIds});
  const a=GM.armies.find(a=>a.name==='御营前军');
  check('real-initial-army-available',!!a);
  const original=structuredClone(a),orders=GM.marchOrders;
  try {
    const from=a.regionId,target=rid('鹿邑县');
    a.destination='鹿邑县';service.sync(a,'army',GM);
    check('live-destination-not-teleport',a.regionId===from&&a.destinationRegionId===target,{from,current:a.regionId,destination:a.destinationRegionId});
    GM.marchOrders=[{status:'marching',armyId:a.id,armyName:a.name,from:a.location||a.garrison,to:'鹿邑县',progress:0,totalTurns:1,totalDays:1}];
    MarchSystem.advanceAll();
    check('native-arrival-updates-three-location-ids',a.regionId===target&&a.mapRegionId===target&&a.garrisonRegionId===target,{current:a.regionId,garrison:a.garrisonRegionId,map:a.mapRegionId,text:a.garrison});
    check('arrival-does-not-change-soldiers-or-faction',a.soldiers===original.soldiers&&a.faction===original.faction,{soldiers:a.soldiers,faction:a.faction});
    syncArmiesToMap();
    const marker=GM.mapData.armies.find(m=>m.id===a.id);
    check('native-marker-at-arrival',marker?.locationNodeId===target,{node:marker?.locationNodeId});
  }finally{
    Object.keys(a).forEach(k=>delete a[k]);Object.assign(a,original);GM.marchOrders=orders;syncArmiesToMap();
  }
  return {passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks};
})()
