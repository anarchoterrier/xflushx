(() => {
 const expandedGroups=new Set();
 const get=id=>document.getElementById(id);let syncing=false,selectedViewer='';
 async function act(button,type,user){
  button.disabled=true;
  try{const result=await chrome.runtime.sendMessage({type,viewer:selectedViewer,userId:user.userId,handle:user.handle});if(!result||result.error)throw Error(result?.error||'No response from extension.');await render();}
  catch(error){get('unmuteStatus').textContent=error.message;}
  finally{button.disabled=false;}
 }
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 async function render(){
  const data=await chrome.storage.local.get(null),viewers=new Set();const model=createLocationModel();model.configure(data);
  for(const key of Object.keys(data)){const m=key.match(/^(?:muteSnapshot|muteImport|muteEnrichment):(\d+)$/)||key.match(/^mute:(\d+):\d+$/);if(m)viewers.add(m[1]);}
  selectedViewer=selectedViewer||data.lastMuteViewer||[...viewers][0]||'';
  const picker=get('muteViewer');picker.replaceChildren();for(const id of viewers)picker.append(new Option('Account ID '+id,id));picker.value=selectedViewer;
  const snapshot=data['muteSnapshot:'+selectedViewer],importing=data['muteImport:'+selectedViewer],enrichment=data['muteEnrichment:'+selectedViewer];
  const users=new Map((snapshot?.users||importing?.users||[]).map(u=>[u.userId,{...u,listed:true}]));
  const logs=new Map();for(const [key,value]of Object.entries(data)){const m=key.match(/^mute:(\d+):(\d+)$/);if(m&&m[1]===selectedViewer){logs.set(m[2],value);if(value.status==='muted'&&(!snapshot||value.time>snapshot.completedAt)&&!users.has(m[2]))users.set(m[2],{userId:m[2],handle:value.handle,listed:false});}}
  const body=get('mutedAccounts');body.replaceChildren();const groups=new Map();let tool=0,legacy=0,historical=0,uncertain=0;
  for(const user of [...users.values()].sort((a,b)=>(a.handle||a.userId).localeCompare(b.handle||b.userId))){
   const log=logs.get(user.userId),cache=data['accountId:'+user.userId],tr=make('tr'),account=make('td');
   const link=make('a',user.handle?'@'+user.handle:user.userId);link.href='https://x.com/i/user/'+user.userId;link.target='_blank';link.rel='noopener';account.append(link);account.append(make('small','ID '+user.userId));
   const region=make('td',cache?.status==='known'?cache.label:log?.label||(cache?.status==='missing'?'Not provided by X':cache?.status==='failed'?'Lookup failed':'Pending location lookup'));
   region.append(make('small','Connected via: '+(cache?.connectedVia||log?.connectedVia||(cache?.locationDataVersion===2?'Not provided by X':'Not yet checked'))));
   const location=model.resolve(cache?.label||log?.label||'');if(location?.type==='country'){let n=location;const ancestors=[];while(n.parent){n=model.nodes().find(x=>x.id===n.parent);if(!n)break;ancestors.unshift(n.label);}if(ancestors.length)region.append(make('small',ancestors.join(' › ')));}
   const source=make('td');let type;
   if(log?.lastSeenUnmutedAt>log?.time){type='Legacy / outside tool';legacy++;}
   else if(log?.status==='muted'&&log.source==='tool'){type='Tool — verified';tool++;}
   else if(log?.status==='muted'&&!log.source){type='Tool — older record';historical++;}
   else if(log?.source==='uncertain'){type='Muted — origin uncertain after prior attempt';uncertain++;}
   else if(log&&log.status!=='muted'){type='Uncertain — tool attempt';uncertain++;}
   else{type='Legacy / outside tool';legacy++;}
   source.textContent=type;if(type==='Tool — verified'&&log.matchedRule)source.append(make('small','Rule: '+log.matchedRule+(log.matchedField?' · '+log.matchedField:'')));
   if(log?.attribution==='inferred-after-attempt')source.append(make('small','Tool credit: earlier attempt + confirmed muted state. Date is the attempt date.'));
   const dated=log?.status==='muted'&&!['legacy','uncertain'].includes(log.source)&&!(log.lastSeenUnmutedAt>log.time)&&Number.isFinite(log.time)&&log.time>0;
   const timestamp=dated?new Date(log.time):null;
   const dateKey=timestamp?[timestamp.getFullYear(),String(timestamp.getMonth()+1).padStart(2,'0'),String(timestamp.getDate()).padStart(2,'0')].join('-'):'';
   const date=make('td',timestamp?timestamp.toLocaleDateString():'Mute date unavailable');
   if(!user.listed)date.append(make('small','Confirmed record; sync to verify current state.'));
   const actions=make('td'),button=make('button','Unmute & keep allowed');
   button.onclick=()=>act(button,'protect-unmute',user);
   actions.append(button);tr.append(account,region,source,date,actions);
   const raw=cache?.status==='known'?cache.label:log?.label||'';
   const groupLabel=model.resolve(raw)?.label||raw||(cache?.status==='missing'?'Not provided by X':cache?.status==='failed'?'Lookup failed':'Pending location lookup');
   if(!groups.has(type))groups.set(type,new Map());const locations=groups.get(type);
   if(!locations.has(groupLabel))locations.set(groupLabel,new Map());
   const dates=locations.get(groupLabel);if(!dates.has(dateKey))dates.set(dateKey,[]);dates.get(dateKey).push({tr,timestamp});
  }
  function disclosure(label,key){const details=make('details');details.open=expandedGroups.has(key);details.append(make('summary',label));details.ontoggle=()=>{details.open?expandedGroups.add(key):expandedGroups.delete(key);};return details;}
  const originOrder=['Tool — verified','Legacy / outside tool','Tool — older record','Muted — origin uncertain after prior attempt','Uncertain — tool attempt'];
  for(const [origin,locations]of [...groups].sort(([a],[b])=>originOrder.indexOf(a)-originOrder.indexOf(b))){
   const total=[...locations.values()].reduce((n,dates)=>n+[...dates.values()].reduce((sum,rows)=>sum+rows.length,0),0);
   const originGroup=disclosure(origin+' · '+total+(total===1?' account':' accounts'),JSON.stringify([selectedViewer,origin]));originGroup.className='muted-origin';
  for(const [label,dates]of [...locations].sort(([a],[b])=>a.localeCompare(b))){
   const count=[...dates.values()].reduce((n,rows)=>n+rows.length,0),country=disclosure(label+' · '+count+(count===1?' account':' accounts'),JSON.stringify([selectedViewer,origin,label]));country.className='muted-country';
   for(const [day,rows]of [...dates].sort(([a],[b])=>b.localeCompare(a))){
    const dateLabel=day?rows[0].timestamp.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'Date unavailable';
    const dateGroup=disclosure(dateLabel+' · '+rows.length+(rows.length===1?' account':' accounts'),JSON.stringify([selectedViewer,origin,label,day]));dateGroup.className='muted-date';
    const wrap=make('div');wrap.className='tablewrap';const table=make('table'),head=make('thead'),heading=make('tr'),list=make('tbody');
    for(const title of ['Account','Country / region','Origin','Date','Actions'])heading.append(make('th',title));
    head.append(heading);for(const row of rows)list.append(row.tr);table.append(head,list);wrap.append(table);dateGroup.append(wrap);country.append(dateGroup);
   }
   originGroup.append(country);
  }
   body.append(originGroup);
  }
  if(!users.size)body.append(make('p','Sync from X to load your existing mutes. Confirmed extension mutes also appear here automatically.'));
  const allowed=get('allowedAccounts');allowed.replaceChildren();
  for(const [key,value]of Object.entries(data)){if(!key.startsWith('allow:'+selectedViewer+':'))continue;
   const row=make('p'),retry=make('button','Unmute again'),remove=make('button','Remove exception');
   row.append(make('span',(value.handle?'@'+value.handle:value.userId)+' · '+(value.status==='unmuted'?'Unmuted; protected from automatic muting':value.error||'Unmute pending')+' '));
   retry.onclick=()=>act(retry,'protect-unmute',value);remove.onclick=()=>act(remove,'remove-protection',value);row.append(retry,remove);allowed.append(row);
  }
  if(!allowed.children.length)allowed.textContent='No exceptions saved.';
  get('muteTotals').textContent=`${users.size} accounts shown · ${tool} verified tool mutes · ${legacy} legacy / outside tool · ${historical} older tool records${uncertain?' · '+uncertain+' uncertain':''}`;
  const progress=importing&&!importing.complete?`Sync incomplete: ${importing.users.length} accounts loaded. ${importing.error||'Click Sync from X to continue.'}`:snapshot?`Last complete sync: ${new Date(snapshot.completedAt).toLocaleString()}.`:'No complete list sync yet.';
  get('muteSyncStatus').textContent=progress+(enrichment?.pending?.length?` ${enrichment.pending.length} location checks queued; one account about every 30 seconds.`:'');
  get('locationCheckStatus').textContent=data.rateLimitUntil>Date.now()?'Cooling down until '+new Date(data.rateLimitUntil).toLocaleString()+'. Pending checks resume automatically.':data.pauseReason?'Paused: '+data.pauseReason+'. Open Lookup status & cache → Resume paused queue after fixing the issue.':enrichment?.lastError?'Last lookup: '+enrichment.lastError:enrichment?.pending?.length?'Keep this same X account signed in. Pending checks run in the background.':'No active location-check queue.';
 }
 get('muteViewer').onchange=()=>{selectedViewer=get('muteViewer').value;render();};
 get('checkMuteLocations').onclick=async()=>{
  const button=get('checkMuteLocations');button.disabled=true;
  try{const result=await chrome.runtime.sendMessage({type:'start-mute-locations',viewer:selectedViewer});if(result?.error)throw Error(result.error);await render();if(result?.waiting)get('locationCheckStatus').textContent='Queued. Waiting for the current request interval; checks continue about every 30 seconds.';}
  catch(error){get('locationCheckStatus').textContent=error.message;}
  finally{button.disabled=false;}
 };
 get('syncMutes').onclick=async()=>{
  if(syncing)return;syncing=true;get('syncMutes').disabled=true;
  try{
   const data=await chrome.storage.local.get(null),job=data['muteImport:'+selectedViewer];let restart=!job||job.complete;
   while(true){
    const r=await chrome.runtime.sendMessage({type:'sync-mutes',restart});
    if(r?.error)throw Error(r.error);
    if(r?.retryAfter){get('muteSyncStatus').textContent='Waiting for the request queue…';await new Promise(resolve=>setTimeout(resolve,Math.max(500,r.retryAfter)));continue;}
    if(!r?.viewer)throw Error('No sync response from the extension. Reload it and try again.');
    selectedViewer=r.viewer;restart=false;await render();if(r.complete)break;
    get('muteSyncStatus').textContent=`Syncing: ${r.count} accounts loaded…`;
   }
  }catch(e){get('muteSyncStatus').textContent='Sync stopped: '+e.message+' Existing results are retained.';}
  finally{syncing=false;get('syncMutes').disabled=false;}
 };
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>/^(mute:|muteSnapshot:|muteImport:|muteEnrichment:|allow:|accountId:|lastMuteViewer|pauseReason)/.test(k)))render();});
 render();
})();
