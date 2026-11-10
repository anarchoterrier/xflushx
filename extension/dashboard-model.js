// Read-only metrics from local records; no analytics or extra X requests.
globalThis.dashboardMetrics=function(data,viewer,now=Date.now()){
 const model=createLocationModel();model.configure(data);
 const snapshot=data['muteSnapshot:'+viewer],importing=data['muteImport:'+viewer];
 const users=new Map((snapshot?.users||importing?.users||[]).map(u=>[u.userId,u]));
 const logs=new Map();
 for(const [key,log]of Object.entries(data)){const match=key.match(/^mute:(\d+):(\d+)$/);if(match?.[1]!==viewer)continue;logs.set(match[2],log);if(log.status==='muted'&&!(log.lastSeenUnmutedAt>log.time)&&(!snapshot||log.time>snapshot.completedAt))users.set(match[2],{userId:match[2],handle:log.handle});}
 const origins={verified:0,legacy:0,older:0,uncertain:0},countries=new Map(),regions=new Map();let located=0,mismatch=0,comparable=0;
 const days=[];for(let n=13;n>=0;n--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-n);days.push({key:[d.getFullYear(),d.getMonth(),d.getDate()].join('-'),label:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}),count:0});}
 const dayMap=new Map(days.map(d=>[d.key,d]));
 for(const [id]of users){
  const log=logs.get(id),cache=data['accountId:'+id];let source='legacy';
  if(!(log?.lastSeenUnmutedAt>log?.time)){if(log?.status==='muted'&&log.source==='tool')source='verified';else if(log?.status==='muted'&&!log.source)source='older';else if(log?.source==='uncertain'||log&&log.status!=='muted')source='uncertain';}
  origins[source]++;
  const raw=cache?.status==='known'?cache.label:log?.label||'',node=model.resolve(raw),label=node?.label||raw||'Location unavailable';
  if(raw)located++;countries.set(label,(countries.get(label)||0)+1);
  const parent=node?.type==='country'?model.nodes().find(n=>n.id===node.parent):node;
  const region=parent?.label||(raw?'Unmapped location':'Location unavailable');regions.set(region,(regions.get(region)||0)+1);
  const via=model.resolve(connectedLocation(cache?.connectedVia||log?.connectedVia));
  if(node?.type==='country'&&via?.type==='country'&&node.iso2&&via.iso2){comparable++;if(node.iso2!==via.iso2)mismatch++;}
  if(source==='verified'&&Number.isFinite(log.time)){const d=new Date(log.time),day=dayMap.get([d.getFullYear(),d.getMonth(),d.getDate()].join('-'));if(day)day.count++;}
 }
 const records=Object.entries(data).filter(([k])=>k.startsWith('accountId:')).map(([,v])=>v),cache={known:0,missing:0,failed:0,waiting:0};
 for(const r of records){if(r.status==='known')cache.known++;else if(r.status==='missing')cache.missing++;else if(r.status==='failed')cache.failed++;else cache.waiting++;}
 const pending=Object.entries(data).filter(([k])=>k.startsWith('pendingAccount:'+viewer+':')).length;
 const attempted=cache.known+cache.missing+cache.failed;
 const rank=map=>[...map].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
 return {total:users.size,origins,countries:rank(countries),regions:rank(regions),located,mismatch,comparable,cache,cacheTotal:records.length,lookupSuccess:attempted?(cache.known+cache.missing)/attempted:null,pending,days,snapshotAt:snapshot?.completedAt||null,partial:!!importing&&!importing.complete&&!snapshot,exceptions:Object.keys(data).filter(k=>k.startsWith('allow:'+viewer+':')).length};
};
