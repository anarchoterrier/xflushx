// Persist cooldowns so reloading the extension cannot bypass X's limit.
async function scheduleRateLimit(response){
 const data=await chrome.storage.local.get(null),now=Date.now();
 const strikes=Math.min((data.rateLimitStrikes||0)+1,8);
 let until=now+Math.min(15*60000*2**(strikes-1),24*60*60000);
 const retry=response.headers?.get('retry-after'),reset=response.headers?.get('x-rate-limit-reset');
 const retryTime=retry?(/^\d+(?:\.\d+)?$/.test(retry)?now+Number(retry)*1000:Date.parse(retry)):NaN;
 const resetTime=reset?Number(reset)*1000:NaN;
 const advertised=[retryTime,resetTime].filter(t=>Number.isFinite(t)&&t>now);
 if(advertised.length)until=Math.max(...advertised)+5000;
 until=Math.max(until,data.rateLimitUntil||0);
 await chrome.storage.local.set({rateLimitUntil:until,rateLimitStrikes:strikes,rateLimitLastAt:now,pauseReason:'X returned HTTP 429',nextRequestAt:until});
 await chrome.alarms?.create('xflushx-rate-limit',{when:until});return until;
}
async function recoverRateLimit(){
 const data=await chrome.storage.local.get(null),now=Date.now();
 // Upgrade the old indefinite 429 pause without discarding successful caches.
 if(data.pauseReason==='X returned HTTP 429'&&!data.rateLimitUntil){
  const until=now+15*60000;await chrome.storage.local.set({rateLimitUntil:until,rateLimitStrikes:1,nextRequestAt:until});await chrome.alarms?.create('xflushx-rate-limit',{when:until});return;
 }
 if(!data.rateLimitUntil)return;
 if(now<data.rateLimitUntil){await chrome.alarms?.create('xflushx-rate-limit',{when:data.rateLimitUntil});return;}
 const keys=Object.entries(data).filter(([k,v])=>k.startsWith('accountId:')&&(v.status==='rate-limited'||v.status==='failed'&&v.error==='X returned HTTP 429')).map(([k])=>k);
 if(keys.length)await chrome.storage.local.remove(keys);
 await chrome.storage.local.set({rateLimitUntil:0,...(data.pauseReason==='X returned HTTP 429'?{pauseReason:''}:{}),cacheResetAt:now});
}
async function checkRateLimit(){
 await recoverRateLimit();const data=await chrome.storage.local.get(null);
 if(data.rateLimitUntil>Date.now()){const error=Error('X returned HTTP 429');error.pause=true;error.rateLimited=true;throw error;}
 if(data.rateLimitLastAt&&Date.now()-data.rateLimitLastAt>24*60*60000&&data.rateLimitStrikes)await chrome.storage.local.set({rateLimitStrikes:0});
}
chrome.alarms?.onAlarm.addListener(alarm=>{if(alarm.name==='xflushx-rate-limit')tail=tail.catch(()=>{}).then(recoverRateLimit).catch(()=>{});});
chrome.runtime.onStartup?.addListener(()=>{tail=tail.catch(()=>{}).then(recoverRateLimit).catch(()=>{});});
Promise.resolve().then(()=>{tail=tail.catch(()=>{}).then(recoverRateLimit).catch(()=>{});});
