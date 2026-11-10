// X's internal web endpoints are undocumented and may change.
globalThis.X_API = (() => {
 // Shared X web-client application token, not a user's login credential.
 const bearer='Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
 const defaultQuery='zUnx-DLN9dkwOkNhTLySjg';
 async function request(origin,path,csrf,body){
  await checkRateLimit();
  const response=await fetch(origin+path,{method:body?'POST':'GET',credentials:'include',redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:bearer,'x-csrf-token':csrf,'x-twitter-auth-type':'OAuth2Session','x-twitter-active-user':'yes',...(body?{'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:body.toString()}:{})});
  if(!response.ok){if(response.status===429){await scheduleRateLimit(response);const error=Error('X returned HTTP 429');error.pause=true;error.rateLimited=true;throw error;}const e=new Error(`X returned HTTP ${response.status}`);e.pause=[429,401,403,404].includes(response.status);throw e;}
  const data=await response.json();
  if(data.errors?.length){const e=new Error('X returned an API error ('+String(data.errors[0].code||'unknown')+').');e.pause=true;throw e;}
  return data;
 }
 async function lookup(origin,handle,csrf,queryId,expectedId){
  const params=new URLSearchParams({variables:JSON.stringify({screenName:handle})});
  const data=await request(origin,`/i/api/graphql/${queryId||defaultQuery}/AboutAccountQuery?${params}`,csrf);
  const user=data?.data?.user_result_by_screen_name?.result;
  if(!user)throw new Error('Unexpected AboutAccount response; no user result.');
  if(typeof user.rest_id!=='string'||user.rest_id!==expectedId)throw new Error('Account ID missing or changed: location rejected.');
  const label=user.about_profile?.account_based_in;
  if(label!=null&&typeof label!=='string')throw Error('Unexpected location value; lookup rejected.');
  const source=user.about_profile?.source;
  if(source!=null&&typeof source!=='string')throw Error('Unexpected Connected via value; lookup rejected.');
  return {status:typeof label==='string'&&label.trim()?'known':'missing',label:typeof label==='string'?label.trim():'',connectedVia:typeof source==='string'?source.trim():'',locationDataVersion:2,userId:/^\d+$/.test(user.rest_id||'')?user.rest_id:null};
 }
 async function mute(origin,userId,csrf){
  const relationship=await request(origin,'/i/api/1.1/friendships/show.json?'+new URLSearchParams({target_id:userId}),csrf);
  const already=relationship?.relationship?.source?.muting;
  if(typeof already!=='boolean')throw new Error('X did not confirm the existing mute state.');
  if(already)return {source:'legacy'};
  const data=await request(origin,'/i/api/1.1/mutes/users/create.json',csrf,new URLSearchParams({user_id:userId}));
  const responseId=typeof data.id_str==='string'?data.id_str:typeof data.id==='string'?data.id:'';
  if(responseId&&responseId!==userId)throw Error('X returned a different account ID in the mute response.');
  if(responseId===userId&&data.muting===true)return {source:'tool',verification:'mute-response'};
  // Some successful write responses omit user fields. Verify the requested
  // target's state independently instead of trusting HTTP 200 or guessing.
  const verified=await request(origin,'/i/api/1.1/friendships/show.json?'+new URLSearchParams({target_id:userId}),csrf);
  const state=verified?.relationship?.source?.muting;
  if(state===true)return {source:'tool',verification:'follow-up-state'};
  throw Error('X accepted the mute request, but follow-up verification reports muting='+String(state)+'. Resume queue to check again; the location lookup is still cached.');
 }
 async function unmute(origin,userId,csrf){
  const data=await request(origin,'/i/api/1.1/mutes/users/destroy.json',csrf,new URLSearchParams({user_id:userId}));
  if(data.id_str&&data.id_str!==userId)throw Error('X returned a different account ID.');
  const verified=await request(origin,'/i/api/1.1/friendships/show.json?'+new URLSearchParams({target_id:userId}),csrf);
  if(verified?.relationship?.source?.muting!==false)throw Error('X did not confirm the unmute. Your local exception is saved; try Unmute again.');
  return {ok:true};
 }
 async function muteState(origin,userId,csrf){
  const data=await request(origin,'/i/api/1.1/friendships/show.json?'+new URLSearchParams({target_id:userId}),csrf);
  const state=data?.relationship?.source?.muting;if(typeof state!=='boolean')throw Error('X did not confirm the current mute state.');return state;
 }
 async function listMutes(origin,csrf,cursor='-1'){
  const data=await request(origin,'/i/api/1.1/mutes/users/list.json?'+new URLSearchParams({cursor,count:'200',skip_status:'true',include_user_entities:'false'}),csrf);
  if(!Array.isArray(data.users)||typeof data.next_cursor_str!=='string')throw Error('Unexpected muted-account list response.');
  const users=data.users.map(u=>{
   if(typeof u.id_str!=='string'||!/^\d+$/.test(u.id_str))throw Error('Muted account has no safe numeric ID.');
   return {userId:u.id_str,handle:typeof u.screen_name==='string'?u.screen_name:'',name:typeof u.name==='string'?u.name:''};
  });
  return {users,cursor:data.next_cursor_str};
 }
 return {lookup,mute,unmute,muteState,listMutes,defaultQuery};
})();
