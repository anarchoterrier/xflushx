importScripts('geography.js','regions.js','api.js','mute-history.js');
// One writer across tabs. Persist before I/O: interrupted requests are not retried.
let tail=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.url?.split('#')[0]===chrome.runtime.getURL?.('options.html')&&message.type==='sync-mutes'){
  tail=tail.then(()=>syncMutePage(message)).then(reply,error=>reply({error:error.message}));return true;
 }
 if(sender.url?.split('#')[0]===chrome.runtime.getURL?.('options.html')&&message.type==='start-mute-locations'){
  tail=tail.then(()=>startMuteLocations(message)).then(reply,error=>reply({error:error.message}));return true;
 }
 let origin;try{origin=new URL(sender.url).origin;}catch{return;}
 if(!['https://x.com','https://twitter.com'].includes(origin))return;
 if(['photo-save','photo-bytes'].includes(message.type)){
  photoAction(message).then(reply,error=>reply({error:error.message}));return true;
 }
 if(message.type!=='encounter')return;
 tail=tail.then(()=>processEncounter(message,origin)).then(reply,error=>reply({error:String(error.message)}));
 return true;
});
async function photoAction(message){
 const settings=await chrome.storage.local.get({restoreImageMenu:false});if(!settings.restoreImageMenu)throw Error('Photo menu is disabled.');
 const url=new URL(message.url);
 if(url.protocol!=='https:'||url.hostname!=='pbs.twimg.com'||!url.pathname.startsWith('/media/')||url.username||url.password||url.port)throw Error('Unsupported image URL.');
 const displayed=url.href;url.searchParams.set('name','orig');
 let r,available,failures=[];
 for(const candidate of new Set([url.href,displayed])){
  try{
   const response=await fetch(candidate,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok){failures.push('HTTP '+response.status);await response.body?.cancel();continue;}
   const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
   if(type&&!type.startsWith('image/')&&type!=='application/octet-stream'){failures.push('Unexpected response type '+type);await response.body?.cancel();continue;}
   r=response;available=candidate;break;
  }catch(error){failures.push(error.name==='TimeoutError'?'Request timed out':error.message);}
 }
 if(!r)throw Error('Image download failed: '+failures.join('; ')+'.');
 if(message.type==='photo-save'){await r.body?.cancel();await chrome.downloads.download({url:available,saveAs:true});return {ok:true};}
 const buffer=await r.arrayBuffer();if(buffer.byteLength>25*1024*1024)throw Error('Image is too large to copy. Use Save image.');
 const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {base64:btoa(binary)};
}
async function processEncounter(message,origin){
 const {handle,userId}=message;
 const {csrf,viewer}=await readSession(origin);
 if(!/^[a-zA-Z0-9_]{1,15}$/.test(handle||'')||typeof userId!=='string'||!/^\d{1,25}$/.test(userId)||!/^\d+$/.test(viewer||'')||typeof csrf!=='string'||!csrf)return {skipped:true};
 await migrateCache();
 let settings=await chrome.storage.local.get({enabled:false,rules:[],pauseReason:'',nextRequestAt:0,queryId:X_API.defaultQuery});
 if(!settings.enabled)return {disabled:true};
 const name=handle.toLowerCase(),key='accountId:'+userId;
 let record=(await chrome.storage.local.get(key))[key];
 if(!record){
  if(settings.pauseReason)return {paused:settings.pauseReason};
  if(Date.now()<settings.nextRequestAt)return {retryAfter:settings.nextRequestAt-Date.now()};
  record={userId,handle:name,status:'interrupted',label:'',checkedAt:Date.now(),error:'Lookup did not finish. Clear this entry to retry.'};
  await chrome.storage.local.set({[key]:record,nextRequestAt:Date.now()+10000});
  try{Object.assign(record,await X_API.lookup(origin,name,csrf,settings.queryId,userId),{error:''});}
  catch(error){record.status='failed';record.error=error.message;if(error.pause)await chrome.storage.local.set({pauseReason:error.message});}
  await chrome.storage.local.set({[key]:record});
 }else if(record.handle!==name){record.handle=name;await chrome.storage.local.set({[key]:record});}
 settings=await chrome.storage.local.get({enabled:false,rules:[],pauseReason:'',nextRequestAt:0,locationAliases:{},locationCustom:[],missingLocationAction:'allow'});
 LOCATIONS.configure(settings);
 await catchLocation(record);
 const missingMatch=record.status==='missing'&&settings.missingLocationAction==='mute';
 const locationMatch=record.status==='known'&&settings.rules.some(r=>matchesRule(record.label,r));
 if(!settings.enabled||(!missingMatch&&!locationMatch)||!record.userId||record.userId===viewer)return {cached:true,status:record.status};
 const muteKey=`mute:${viewer}:${record.userId}`;
 if((await chrome.storage.local.get(muteKey))[muteKey])return {cached:true,status:record.status};
 if(settings.pauseReason)return {paused:settings.pauseReason};
 if(Date.now()<settings.nextRequestAt)return {retryAfter:settings.nextRequestAt-Date.now()};
 const current=await readSession(origin);
 if(current.viewer!==viewer||current.csrf!==csrf)return {retryAfter:2000};
 const result={handle:name,label:record.label,status:'interrupted',time:Date.now(),matchedRule:missingMatch?'No location returned':settings.rules.find(r=>matchesRule(record.label,r))?.label||''};
 await chrome.storage.local.set({[muteKey]:result,nextRequestAt:Date.now()+10000});
 try{const response=await X_API.mute(origin,record.userId,csrf);result.status='muted';result.source=response.source;}
 catch(error){result.status='failed';result.error=error.message;if(error.pause)await chrome.storage.local.set({pauseReason:error.message});}
 await chrome.storage.local.set({[muteKey]:result});
 return {cached:true,status:record.status,mute:result.status};
}
async function catchLocation(record){
 if(!['known','missing'].includes(record.status))return;
 if(record.status==='known'&&LOCATIONS.resolve(record.label))return;
 const raw=record.status==='missing'?'':record.label;
 const key='unmapped:'+encodeURIComponent(locationKey(raw)||'(missing)');
 const stored=(await chrome.storage.local.get(key))[key];
 const existing=stored||{label:raw,kind:raw?'unmapped':'missing',firstSeen:Date.now(),accountIds:[],variants:[]};
 let changed=!stored;
 if(!existing.accountIds.includes(record.userId)){existing.accountIds.push(record.userId);existing.lastSeen=Date.now();changed=true;}
 if(raw&&!existing.variants.includes(raw)){existing.variants.push(raw);changed=true;}
 if(changed)await chrome.storage.local.set({[key]:existing});
}
async function readSession(origin){
 const [csrfCookie,viewerCookie]=await Promise.all(['ct0','twid'].map(name=>chrome.cookies.get({url:origin,name})));
 let value='';try{value=decodeURIComponent(viewerCookie?.value||'');}catch{}
 return {csrf:csrfCookie?.value||'',viewer:value.match(/^(?:u=)?(\d+)$/)?.[1]};
}
async function migrateCache(){
 const marker=await chrome.storage.local.get('idCacheVersion');if(marker.idCacheVersion===1)return;
 // Old handle-keyed observations cannot prove which account owned the handle
 // at lookup time. Discard rather than promoting an unverified binding.
 const data=await chrome.storage.local.get(null);
 const legacy=Object.keys(data).filter(k=>k.startsWith('account:')||k==='observations');
 if(legacy.length)await chrome.storage.local.remove(legacy);
 await chrome.storage.local.set({idCacheVersion:1});
}
let badgeUpdate=Promise.resolve();
function scheduleBadge(){
 badgeUpdate=badgeUpdate.catch(()=>{}).then(updateReviewBadge);
}
async function updateReviewBadge(){
 if(!chrome.action?.setBadgeText)return;
 const data=await chrome.storage.local.get(null);
 // Use a separate matching context: never mutate the lookup worker's model
 // while it is applying rules to an in-flight encounter.
 const knownSettings={locationAliases:data.locationAliases||{},locationCustom:data.locationCustom||[]};
 const model=createLocationModel();model.configure(knownSettings);
 const pending=new Map();
 for(const [key,row]of Object.entries(data))if(key.startsWith('unmapped:'))pending.set(key,{...row,accountIds:[...row.accountIds]});
 for(const [key,r]of Object.entries(data)){
  if(!key.startsWith('accountId:')||!['known','missing'].includes(r.status))continue;
  if(r.status==='known'&&model.resolve(r.label))continue;
  const raw=r.status==='missing'?'':r.label,id='unmapped:'+encodeURIComponent(locationKey(raw)||'(missing)');
  const row=pending.get(id)||{label:raw,kind:raw?'unmapped':'missing',accountIds:[]};
  if(!row.accountIds.includes(r.userId))row.accountIds.push(r.userId);pending.set(id,row);
 }
 let count=0;
 for(const row of pending.values())if((row.kind==='missing'||!model.resolve(row.label))&&!row.reviewed&&!(row.reviewedCount>0))count++;
 await chrome.action.setBadgeBackgroundColor({color:'#B65C12'});
 await chrome.action.setBadgeText({text:count?(count>99?'99+':String(count)):''});
 await chrome.action.setTitle({title:count?`xflushx — ${count} location label${count===1?'':'s'} need review`:'xflushx'});
}
chrome.storage.onChanged?.addListener((changes,area)=>{
 if(area==='local'&&Object.keys(changes).some(k=>k.startsWith('unmapped:')||k.startsWith('accountId:')||['locationAliases','locationCustom'].includes(k)))scheduleBadge();
});
scheduleBadge();
