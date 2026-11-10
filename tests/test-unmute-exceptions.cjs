const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('tests/test-extension.cjs','utf8').split('(async()=>{')[0],harness=new Function('require',source+';return harness;')(require);
(async()=>{
 const h=harness();h.data['muteSnapshot:99']={users:[{userId:'42',handle:'alice'}],completedAt:1};h.data['mute:99:42']={status:'muted',time:1};
 await vm.runInContext("protectUnmute({viewer:'99',userId:'42',handle:'alice'})",h.context);
 assert.equal(h.data['allow:99:42'].status,'unmuted');assert.equal(h.data['mute:99:42'].status,'unmuted');assert.equal(h.data['muteSnapshot:99'].users.length,0);
 assert.ok(h.calls[0].url.includes('mutes/users/destroy'));assert.equal(h.calls[0].options.body,'user_id=42');
 h.calls.length=0;await h.send('renamed');assert.equal(h.calls.length,0);
 const persisted=harness();Object.assign(persisted.data,structuredClone(h.data));await persisted.send();assert.equal(persisted.calls.length,0);
 await assert.rejects(vm.runInContext("protectUnmute({viewer:'88',userId:'42'})",h.context),/Sign in/);
 await vm.runInContext("protectUnmute({type:'remove-protection',viewer:'99',userId:'42'})",h.context);assert.equal(h.data['allow:99:42'],undefined);
 const failed=harness();failed.context.fetch=async()=>({ok:false,status:429});await assert.rejects(vm.runInContext("protectUnmute({viewer:'99',userId:'42'})",failed.context),/429/);assert.equal(failed.data['allow:99:42'].status,'failed');await failed.send();assert.equal(failed.calls.length,0);
 const scope=harness();scope.data['allow:88:42']={status:'unmuted'};await scope.send();assert.equal(scope.calls.length,1);
 const unconfirmed=harness();unconfirmed.context.fetch=async()=>({ok:true,json:async()=>({relationship:{source:{muting:true}}})});await assert.rejects(vm.runInContext("protectUnmute({viewer:'99',userId:'42'})",unconfirmed.context),/did not confirm/);assert.equal(unconfirmed.data['allow:99:42'].status,'failed');
 console.log('Verified unmute, durable ID exceptions, viewer scope, removal, persistence and failed/unconfirmed recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
