importScripts('geography.js','regions.js','rate-limit.js','api.js','mute-reconcile.js','mute-history.js','video-actions.js');
// One writer across tabs. Persist before I/O: interrupted requests are not retried.
let tail=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.url?.split('#')[0]===chrome.runtime.getURL?.('options.html')&&message.type==='sync-mutes'){
  tail=tail.then(()=>syncMutePage(message)).then(reply,error=>reply({error:error.message}));return true;
 }
 if(sender.url?.split('#')[0]===chrome.runtime.getURL?.('options.html')&&message.type==='start-mute-locations'){
  tail=tail.then(()=>startMuteLocations(message)).then(reply,error=>reply({error:error.message}));return true;
 }
 if(sender.url?.split('#')[0]===chrome.runtime.getURL?.('options.html')&&['protect-unmute','remove-protection'].includes(message.type)){
  tail=tail.then(()=>protectUnmute(message)).then(reply,error=>reply({error:error.message}));return true;
 }
 let origin;try{origin=new URL(sender.url).origin;}catch{return;}
 if(!['https://x.com','https://twitter.com'].includes(origin))return;
 if(['photo-save','photo-bytes'].includes(message.type)){
  photoAction(message).then(reply,error=>reply({error:error.message}));return true;
 }
 if(['gif-source','gif-bytes','gif-save-video','gif-download'].includes(message.type)){
  gifAction(message).then(reply,error=>reply({error:error.message}));return true;
 }
 if(['video-source','video-save'].includes(message.type)){
  videoAction(message).then(reply,error=>reply({error:error.message}));return true;
 }
 if(message.type!=='encounter')return;
 tail=tail.then(()=>queuedEncounter(message,origin)).then(reply,error=>reply({error:String(error.message)}));
 return true;
});
async function gifAction(message){
 const settings=await chrome.storage.local.get({restoreImageMenu:false});if(!settings.restoreImageMenu)throw Error('Photo actions menu is disabled.');
 if(message.type==='gif-source'){
  if(typeof message.postId!=='string'||!/^\d{1,25}$/.test(message.postId))throw Error('Invalid post ID.');
  const response=await fetch('https://cdn.syndication.twimg.com/tweet-result?'+new URLSearchParams({id:message.postId,token:'0'}),{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Could not resolve animation: HTTP '+response.status);
  const data=await response.json();
  const variants=(data.mediaDetails||[]).filter(m=>m.type==='animated_gif').flatMap(m=>m.video_info?.variants||[]);
  const urls=[...new Set(variants.filter(v=>v.content_type==='video/mp4').map(v=>v.url))].filter(value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='video.twimg.com'&&/^\/tweet_video\/[\w-]+\.mp4$/.test(u.pathname)&&!u.username&&!u.password&&!u.port;}catch{return false;}});
  if(urls.length!==1)throw Error('Could not identify a single GIF in this post. Play the animation once and right-click directly on it.');
  return {url:urls[0]};
 }
 if(message.type==='gif-download'){
  const data=message.base64;if(typeof data!=='string'||data.length>35*1024*1024||!/^R0lGODlh[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('Invalid or oversized GIF.');
  await chrome.downloads.download({url:'data:image/gif;base64,'+data,filename:'xflushx-animation.gif',saveAs:true});return {ok:true};
 }
 const url=new URL(message.url);
 if(url.protocol!=='https:'||url.hostname!=='video.twimg.com'||!/^\/tweet_video\/[\w-]+\.mp4$/.test(url.pathname)||url.username||url.password||url.port)throw Error('Unsupported animation source.');
 if(message.type==='gif-save-video'){await chrome.downloads.download({url:url.href,saveAs:true});return {ok:true};}
 const response=await fetch(url.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Animation download failed: HTTP '+response.status);
 const length=Number(response.headers.get('content-length')||0);if(length>25*1024*1024)throw Error('Animation is too large to convert. Save the original video.');
 const raw=new Uint8Array(await response.arrayBuffer());if(raw.length>25*1024*1024)throw Error('Animation is too large to convert.');
 let binary='';for(let i=0;i<raw.length;i+=8192)binary+=String.fromCharCode(...raw.subarray(i,i+8192));return {base64:btoa(binary)};
}
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
 if((await chrome.storage.local.get('allow:'+viewer+':'+userId))['allow:'+viewer+':'+userId])return {protected:true};
 await checkRateLimit().catch(()=>{});
 await migrateCache();
 let settings=await chrome.storage.local.get({enabled:false,rules:[],pauseReason:'',nextRequestAt:0,queryId:X_API.defaultQuery});
 if(!settings.enabled)return {disabled:true};
 const name=handle.toLowerCase(),key='accountId:'+userId;
 let record=(await chrome.storage.local.get(key))[key];
 if(!record){
  if(settings.pauseReason)return {paused:settings.pauseReason};
  if(Date.now()<settings.nextRequestAt)return {retryAfter:settings.nextRequestAt-Date.now()};
  record={userId,handle:name,status:'interrupted',label:'',checkedAt:Date.now(),error:'Lookup did not finish. Clear this entry to retry.'};
  await chrome.storage.local.set({[key]:record,nextRequestAt:Date.now()+30000});
  try{Object.assign(record,await X_API.lookup(origin,name,csrf,settings.queryId,userId),{error:''});}
  catch(error){record.status=error.rateLimited?'rate-limited':'failed';record.error=error.message;if(error.pause)await chrome.storage.local.set({pauseReason:error.message});}
  await chrome.storage.local.set({[key]:record});
 }else if(record.handle!==name){record.handle=name;await chrome.storage.local.set({[key]:record});}
 settings=await chrome.storage.local.get({enabled:false,rules:[],pauseReason:'',nextRequestAt:0,locationAliases:{},locationCustom:[],missingLocationAction:'allow',matchConnectedVia:true,retryFailedMutesAt:0});
 LOCATIONS.configure(settings);
 await catchLocation(record);
 if(record.status==='rate-limited')return {paused:'X returned HTTP 429'};
 const missingMatch=record.status==='missing'&&settings.missingLocationAction==='mute';
 const locationMatch=matchRecord(record,settings.rules,settings.matchConnectedVia);
 if(!settings.enabled||(!missingMatch&&!locationMatch)||!record.userId||record.userId===viewer)return {cached:true,status:record.status};
 const muteKey=`mute:${viewer}:${record.userId}`;
 const previous=(await chrome.storage.local.get(muteKey))[muteKey];
 if(previous?.status==='muted')return {cached:true,status:record.status,mute:'muted'};
 if(previous&&!previous.rateLimited&&!(settings.retryFailedMutesAt>(previous.time||0)))return {cached:true,status:record.status,mute:previous.status,error:previous.error||'Earlier mute attempt interrupted. Resume the queue to retry.'};
 if(settings.pauseReason)return {paused:settings.pauseReason};
 if(Date.now()<settings.nextRequestAt)return {retryAfter:settings.nextRequestAt-Date.now()};
 const current=await readSession(origin);
 if(current.viewer!==viewer||current.csrf!==csrf)return {retryAfter:2000};
 const result={handle:name,label:record.label,status:'interrupted',time:Date.now(),connectedVia:record.connectedVia||'',matchedField:locationMatch?.field||(missingMatch?'Account based in':''),matchedRule:locationMatch?.rule||(missingMatch?'No location returned':'')};
 await chrome.storage.local.set({[muteKey]:result,nextRequestAt:Date.now()+30000});
 try{const response=await X_API.mute(origin,record.userId,csrf);result.status='muted';result.source=response.source==='legacy'&&previous?'tool':response.source;if(response.source==='legacy'&&previous){result.attribution='inferred-after-attempt';result.time=previous.time||result.time;}result.verification=response.verification||(previous?'existing-state-after-prior-attempt':'existing-state');}
 catch(error){result.status='failed';result.rateLimited=error.rateLimited===true;result.error=error.message;if(error.pause)await chrome.storage.local.set({pauseReason:error.message});}
 await chrome.storage.local.set({[muteKey]:result});
 if(record.status==='rate-limited'||result.rateLimited)return {paused:'X returned HTTP 429'};
 return {cached:true,status:record.status,mute:result.status};
}
async function catchLocation(record){
 for(const value of reviewLocations(record)){
  const raw=value.label,key='unmapped:'+encodeURIComponent(locationKey(raw)||'(missing)');
  const stored=(await chrome.storage.local.get(key))[key];
  const row=stored||{label:raw,kind:raw?'unmapped':'missing',firstSeen:Date.now(),accountIds:[],variants:[]};
  let changed=!stored;
  if(!row.accountIds.includes(record.userId)){row.accountIds.push(record.userId);row.lastSeen=Date.now();changed=true;}
  if(value.raw&&!row.variants.includes(value.raw)){row.variants.push(value.raw);changed=true;}
  if(changed)await chrome.storage.local.set({[key]:row});
 }
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
  if(!key.startsWith('accountId:'))continue;
  for(const value of reviewLocations(r,model)){
   const raw=value.label,id='unmapped:'+encodeURIComponent(locationKey(raw)||'(missing)');
   const row=pending.get(id)||{label:raw,kind:raw?'unmapped':'missing',accountIds:[]};
   if(!row.accountIds.includes(r.userId))row.accountIds.push(r.userId);pending.set(id,row);
  }
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

// Explicit exceptions are scoped to the signed-in viewer and immutable target ID.
async function protectUnmute(message){
 const {viewer,origin,csrf}=await historySession(),userId=message.userId;
 if(viewer!==message.viewer)throw Error('Sign in to the X account selected in this list first.');
 if(typeof userId!=='string'||!/^\d{1,25}$/.test(userId))throw Error('Invalid numeric account ID.');
 const key='allow:'+viewer+':'+userId;
 if(message.type==='remove-protection'){await chrome.storage.local.remove(key);const logKey='mute:'+viewer+':'+userId,log=(await chrome.storage.local.get(logKey))[logKey];if(log?.status==='unmuted')await chrome.storage.local.remove(logKey);return {ok:true};}
 const old=(await chrome.storage.local.get(key))[key];
 await chrome.storage.local.set({[key]:{...old,userId,handle:message.handle||'',time:Date.now(),status:'pending'}});
 try{
  await X_API.unmute(origin,userId,csrf);
  const data=await chrome.storage.local.get(null),updates={};
  for(const prefix of ['muteSnapshot:','muteImport:']){const k=prefix+viewer;if(data[k])updates[k]={...data[k],users:data[k].users.filter(u=>u.userId!==userId)};}
  const logKey='mute:'+viewer+':'+userId;
  if(data[logKey])updates[logKey]={...data[logKey],status:'unmuted',lastSeenUnmutedAt:Date.now()};
  updates[key]={userId,handle:message.handle||'',time:Date.now(),status:'unmuted'};
  await chrome.storage.local.set(updates);return {ok:true};
 }catch(error){await chrome.storage.local.set({[key]:{userId,handle:message.handle||'',status:'failed',error:error.message,time:Date.now()}});throw error;}
}

// Persist pending work independently of lookup results and the visible tab.
async function queuedEncounter(message,origin){
 const {viewer}=await readSession(origin),{userId,handle}=message;
 if(!/^\d{1,25}$/.test(userId||'')||typeof userId!=='string'||!/^[A-Za-z0-9_]{1,15}$/.test(handle||'')||!viewer)return {skipped:true};
 if(!(await chrome.storage.local.get({enabled:false})).enabled)return {disabled:true};
 const key='pendingAccount:'+viewer+':'+userId;
 await chrome.storage.local.set({[key]:{viewer,userId,handle,origin}});
 await chrome.alarms?.create('xflushx-account-queue',{periodInMinutes:0.5});
 const result=await processEncounter(message,origin);
 if(!result?.paused&&!result?.retryAfter&&!result?.skipped)await chrome.storage.local.remove(key);
 return result;
}
async function drainAccountQueue(){
 await recoverRateLimit();const data=await chrome.storage.local.get(null);
 const pending=Object.entries(data).filter(([k])=>k.startsWith('pendingAccount:'));
 if(!pending.length){await chrome.alarms?.clear('xflushx-account-queue');return;}
 if(!data.enabled||data.pauseReason||data.rateLimitUntil>Date.now()||data.nextRequestAt>Date.now())return;
 for(const [,job]of pending){
  if(!['https://x.com','https://twitter.com'].includes(job.origin))continue;
  const session=await readSession(job.origin);if(session.viewer!==job.viewer||!session.csrf)continue;
  await queuedEncounter(job,job.origin);return;
 }
}
async function restoreAccountQueue(){
 const data=await chrome.storage.local.get(null);
 if(Object.keys(data).some(k=>k.startsWith('pendingAccount:')))await chrome.alarms?.create('xflushx-account-queue',{periodInMinutes:0.5});
}
chrome.alarms?.onAlarm.addListener(alarm=>{if(alarm.name==='xflushx-account-queue')tail=tail.catch(()=>{}).then(drainAccountQueue).catch(()=>{});});
chrome.runtime.onStartup?.addListener(restoreAccountQueue);
Promise.resolve().then(restoreAccountQueue).catch(()=>{});
