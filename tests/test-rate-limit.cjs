const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('tests/test-extension.cjs','utf8').split('(async()=>{')[0],harness=new Function('require',source+';return harness;')(require);
(async()=>{
 const h=harness();await vm.runInContext('tail',h.context);let now=1800000000000;h.context.Date=class extends Date{static now(){return now;}};
 const alarms=[];h.context.chrome.alarms={create:async(name,spec)=>alarms.push({name,...spec})};
 const header=(values)=>({headers:{get:name=>values[name]||null}});
 h.context.response=header({'retry-after':'120','x-rate-limit-reset':String((now+180000)/1000)});
 await vm.runInContext('scheduleRateLimit(response)',h.context);assert.equal(h.data.rateLimitUntil,now+185000);assert.equal(alarms[0].when,h.data.rateLimitUntil);
 h.data['accountId:42']={userId:'42',handle:'alice',status:'rate-limited'};h.data['accountId:43']={userId:'43',status:'known',label:'Japan'};
 let fetches=0;h.context.fetch=async()=>{fetches++;throw Error('Should not send');};
 await assert.rejects(h.context.X_API.lookup('https://x.com','alice','test',null,'42'),/429/);assert.equal(fetches,0);
 // Manual resume and extension restart cannot bypass the stored cooldown.
 h.data.pauseReason='';h.data.nextRequestAt=0;await assert.rejects(h.context.X_API.unmute('https://x.com','42','test'),/429/);assert.equal(fetches,0);
 const restarted=harness();await vm.runInContext('tail',restarted.context);Object.assign(restarted.data,structuredClone(h.data));restarted.context.Date=h.context.Date;
 await assert.rejects(restarted.context.X_API.listMutes('https://x.com','test'),/429/);assert.equal(restarted.calls.length,0);
 now=h.data.rateLimitUntil+1;await vm.runInContext('recoverRateLimit()',h.context);assert.equal(h.data.rateLimitUntil,0);assert.equal(h.data['accountId:42'],undefined);assert.equal(h.data['accountId:43'].label,'Japan');assert.equal(h.data.cacheResetAt,now);
 h.context.response=header({});await vm.runInContext('scheduleRateLimit(response)',h.context);assert.equal(h.data.rateLimitUntil,now+30*60000,'second throttle doubles fallback');
 now=h.data.rateLimitUntil+1;await vm.runInContext('recoverRateLimit()',h.context);h.context.response=header({'retry-after':new Date(now+600000).toUTCString()});await vm.runInContext('scheduleRateLimit(response)',h.context);assert.ok(h.data.rateLimitUntil>=now+604000,'HTTP-date Retry-After honored');
 const old=harness();await vm.runInContext('tail',old.context);old.context.Date=h.context.Date;old.data.pauseReason='X returned HTTP 429';old.data['accountId:42']={status:'failed',error:'X returned HTTP 429'};await vm.runInContext('recoverRateLimit()',old.context);assert.equal(old.data.rateLimitUntil,now+900000,'old indefinite pause upgraded');now+=900001;await vm.runInContext('recoverRateLimit()',old.context);assert.equal(old.data.pauseReason,'');assert.equal(old.data['accountId:42'],undefined);
 old.data.pauseReason='X returned HTTP 401';await vm.runInContext('recoverRateLimit()',old.context);assert.equal(old.data.pauseReason,'X returned HTTP 401','auth pauses never auto-cleared');
 // End-to-end lookup retry: actual 429 response, cooldown expiry, successful retry.
 const retry=harness();await vm.runInContext('tail',retry.context);retry.context.Date=h.context.Date;let attempts=0;
 retry.context.fetch=async()=>({ok:++attempts!==1,status:429,headers:{get:()=>null},json:async()=>({data:{user_result_by_screen_name:{result:{rest_id:'42',core:{screen_name:'alice'},about_profile:{account_based_in:'Japan'}}}}})});
 const result=await retry.send();assert.ok(result.paused);assert.equal(retry.data['accountId:42'].status,'rate-limited');now=retry.data.rateLimitUntil+1;await vm.runInContext('recoverRateLimit()',retry.context);await retry.send();assert.equal(retry.data['accountId:42'].status,'known');assert.equal(attempts,2);
 console.log('429 headers, fallback/backoff, persisted cooldown, no bypass, automatic recovery, old-pause migration, cached success retention and real lookup retry passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
