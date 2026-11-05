// Read-only list import and location enrichment. Never mute during enrichment.
async function historySession(){
 for(const origin of ['https://x.com','https://twitter.com']){const s=await readSession(origin);if(s.csrf&&s.viewer)return {...s,origin};}
 throw Error('Sign in to X before syncing muted accounts.');
}
async function syncMutePage(message){
 const session=await historySession(),{viewer,origin,csrf}=session;
 const all=await chrome.storage.local.get({nextRequestAt:0});
 if(Date.now()<all.nextRequestAt)return {retryAfter:all.nextRequestAt-Date.now()};
 const key='muteImport:'+viewer,snapshotKey='muteSnapshot:'+viewer;
 let job=(await chrome.storage.local.get(key))[key];
 if(message.restart||!job)job={viewer,origin,users:[],cursor:'-1',seen:[],startedAt:Date.now()};
 if(job.complete)return {complete:true,viewer,count:job.users.length};
 await chrome.storage.local.set({nextRequestAt:Date.now()+10000});
 try{
  const page=await X_API.listMutes(origin,csrf,job.cursor);
  const current=await readSession(origin);if(current.viewer!==viewer)throw Error('Signed-in account changed. Restart the sync.');
  if(page.cursor!=='0'&&(job.seen.includes(page.cursor)||page.cursor===job.cursor))throw Error('X repeated a pagination cursor; sync stopped.');
  const users=new Map(job.users.map(u=>[u.userId,u]));for(const u of page.users)users.set(u.userId,u);
  job.users=[...users.values()];job.seen.push(job.cursor);job.cursor=page.cursor;job.error='';job.updatedAt=Date.now();job.complete=page.cursor==='0';
  await chrome.storage.local.set({[key]:job,lastMuteViewer:viewer});
  if(job.complete){
   const completedAt=Date.now(),present=new Set(job.users.map(u=>u.userId)),existing=await chrome.storage.local.get(null),updates={};
   // Preserve the historical action, but don't credit a later outside remute
   // if a complete snapshot established that the account had been unmuted.
   for(const [k,v]of Object.entries(existing)){const m=k.match(/^mute:(\d+):(\d+)$/);if(m&&m[1]===viewer&&v.status==='muted'&&!present.has(m[2]))updates[k]={...v,lastSeenUnmutedAt:completedAt};}
   await chrome.storage.local.set({...updates,[snapshotKey]:{viewer,users:job.users,completedAt}});
   await scheduleMuteEnrichment(viewer,origin,job.users);
  }
  return {viewer,count:job.users.length,complete:job.complete};
 }catch(e){job.error=e.message;await chrome.storage.local.set({[key]:job,lastMuteViewer:viewer});return {error:e.message,viewer,count:job.users.length};}
}
async function scheduleMuteEnrichment(viewer,origin,users){
 const data=await chrome.storage.local.get(null);
 const pending=users.filter(u=>u.handle&&!data['accountId:'+u.userId]).map(u=>({userId:u.userId,handle:u.handle}));
 await chrome.storage.local.set({['muteEnrichment:'+viewer]:{viewer,origin,pending}});
 if(pending.length)await chrome.alarms.create('mute-location-enrichment',{periodInMinutes:0.5});
}
async function startMuteLocations(message){
 const session=await historySession();
 if(message.viewer&&message.viewer!==session.viewer)throw Error('Sign in to the X account selected in this table first.');
 const key='muteSnapshot:'+session.viewer;
 const snapshot=(await chrome.storage.local.get(key))[key];
 if(!snapshot)throw Error('Finish Sync from X first, then check locations.');
 await scheduleMuteEnrichment(session.viewer,session.origin,snapshot.users);
 const data=await chrome.storage.local.get({pauseReason:'',nextRequestAt:0});
 if(data.pauseReason)return {paused:data.pauseReason};
 if(Date.now()<data.nextRequestAt)return {waiting:true};
 await enrichOneMute();return {started:true};
}
async function enrichOneMute(){
 const data=await chrome.storage.local.get(null);
 const jobs=Object.entries(data).filter(([k,j])=>k.startsWith('muteEnrichment:')&&j.pending?.length);
 if(!jobs.length){await chrome.alarms.clear('mute-location-enrichment');return;}
 if(data.pauseReason||Date.now()<(data.nextRequestAt||0))return;
 for(const [jobKey,job]of jobs){
  const session=await readSession(job.origin);if(session.viewer!==job.viewer||!session.csrf)continue;
  const item=job.pending[0],key='accountId:'+item.userId;
  if(!data[key]){
   let record={...item,status:'interrupted',label:'',checkedAt:Date.now(),error:'Location import interrupted; clear lookup to retry.'};
   await chrome.storage.local.set({[key]:record,nextRequestAt:Date.now()+10000});
   try{Object.assign(record,await X_API.lookup(job.origin,item.handle,session.csrf,data.queryId||X_API.defaultQuery,item.userId),{error:''});}
   catch(e){record.status='failed';record.error=e.message;if(e.pause)await chrome.storage.local.set({pauseReason:e.message});}
   await chrome.storage.local.set({[key]:record});
   const modelSettings=await chrome.storage.local.get({locationAliases:{},locationCustom:[]});LOCATIONS.configure(modelSettings);await catchLocation(record);
  }
  job.pending.shift();job.lastAttemptAt=Date.now();job.lastError=(await chrome.storage.local.get(key))[key]?.error||'';await chrome.storage.local.set({[jobKey]:job});return;
 }
}
chrome.alarms?.onAlarm.addListener(alarm=>{
 if(alarm.name==='mute-location-enrichment')tail=tail.catch(()=>{}).then(enrichOneMute).catch(()=>{});
});
async function restoreMuteEnrichment(){
 if(!chrome.alarms)return;
 const data=await chrome.storage.local.get(null);
 if(Object.entries(data).some(([key,value])=>key.startsWith('muteEnrichment:')&&value.pending?.length))await chrome.alarms.create('mute-location-enrichment',{periodInMinutes:0.5});
}
chrome.runtime.onStartup?.addListener(restoreMuteEnrichment);
chrome.runtime.onInstalled?.addListener(restoreMuteEnrichment);
