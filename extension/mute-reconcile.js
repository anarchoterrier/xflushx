// Read-only follow-up. Tool credit after an earlier attempt is user-requested
// attribution, not proof that the earlier write caused the current mute.
function needsMuteReconciliation(log){return !!log&&!log.rateLimited&&(!log.reconciledAt||log.reconciledAt<=(log.time||0))&&(log.source==='uncertain'||['failed','interrupted'].includes(log.status));}
async function reconcileMuteState(viewer,userId,log,muted,updateSnapshot=true){
 const now=Date.now(),key='mute:'+viewer+':'+userId;
 const clean={...log,reconciledAt:now,stateCheckedAt:now};
 if(clean.error){clean.lastAttemptError=clean.error;delete clean.error;}
 delete clean.reconcileError;delete clean.reconcileRetryAt;
 if(muted){clean.status='muted';clean.source='tool';clean.attribution='inferred-after-attempt';clean.verification='confirmed-state-after-attempt';delete clean.lastSeenUnmutedAt;}
 else{clean.status='unmuted';clean.lastSeenUnmutedAt=now;}
 const updates={[key]:clean};
 if(updateSnapshot){const snapshotKey='muteSnapshot:'+viewer,snapshot=(await chrome.storage.local.get(snapshotKey))[snapshotKey];if(snapshot){const users=snapshot.users.filter(u=>u.userId!==userId);if(muted)users.push({userId,handle:log.handle||''});updates[snapshotKey]={...snapshot,users};}}
 await chrome.storage.local.set(updates);
}
async function reconcileOneMute(){
 await recoverRateLimit();const data=await chrome.storage.local.get(null),now=Date.now();
 const jobs=Object.entries(data).filter(([key,log])=>/^mute:\d+:\d+$/.test(key)&&needsMuteReconciliation(log));
 if(!jobs.length){await chrome.alarms?.clear('xflushx-mute-reconcile');return;}
 if(data.pauseReason||data.rateLimitUntil>now||data.nextRequestAt>now)return;
 for(const [key,log]of jobs){
  if(log.reconcileRetryAt>now||now-(log.time||0)<60000)continue;
  const [,viewer,userId]=key.split(':');
  for(const origin of ['https://x.com','https://twitter.com']){
   const session=await readSession(origin);if(session.viewer!==viewer||!session.csrf)continue;
   await chrome.storage.local.set({nextRequestAt:Date.now()+30000});
   try{const muted=await X_API.muteState(origin,userId,session.csrf);const current=await readSession(origin);if(current.viewer!==viewer)throw Error('Signed-in account changed during mute check.');await reconcileMuteState(viewer,userId,log,muted);}
   catch(error){await chrome.storage.local.set({[key]:{...log,reconcileError:error.message,reconcileRetryAt:Date.now()+15*60000},...(error.pause?{pauseReason:error.message}:{})});}
   return;
  }
 }
}
async function restoreMuteReconciliation(){
 const data=await chrome.storage.local.get(null);
 if(Object.entries(data).some(([key,log])=>/^mute:\d+:\d+$/.test(key)&&needsMuteReconciliation(log))){if(chrome.alarms?.get&&await chrome.alarms.get('xflushx-mute-reconcile'))return;await chrome.alarms?.create('xflushx-mute-reconcile',{periodInMinutes:1});}
}
chrome.alarms?.onAlarm.addListener(alarm=>{if(alarm.name==='xflushx-mute-reconcile')tail=tail.catch(()=>{}).then(reconcileOneMute).catch(()=>{});});
chrome.storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>k.startsWith('mute:')))restoreMuteReconciliation().catch(()=>{});});
chrome.runtime.onStartup?.addListener(restoreMuteReconciliation);
Promise.resolve().then(restoreMuteReconciliation).catch(()=>{});
