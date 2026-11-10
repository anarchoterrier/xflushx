// SPDX-License-Identifier: GPL-3.0-only
(() => {
 const openGroups=new Set();
 const make=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
 globalThis.renderCacheGroups=data=>{
  const container=document.getElementById('cacheGroups');if(!container)return;
  const picker=document.getElementById('muteViewer');
  const viewers=new Set(Object.keys(data).map(k=>k.match(/^mute:(\d+):/ )?.[1]).filter(Boolean));
  const viewer=picker?.value||data.lastMuteViewer||(viewers.size===1?[...viewers][0]:'');
  const snapshot=data['muteSnapshot:'+viewer],listed=new Set((snapshot?.users||[]).map(u=>u.userId));
  function isMuted(r){
   const log=data[`mute:${viewer}:${r.userId}`];
   if(snapshot&&snapshot.completedAt>=(log?.time||0))return listed.has(r.userId);
   return log?.status==='muted'&&!(log.lastSeenUnmutedAt>log.time);
  }
  const query=document.getElementById('cacheSearch')?.value||'';
  const search=globalThis.searchCachedAccounts?.(data,query),allowed=search?new Set(search.matches.map(r=>r.userId)):null;
  const groups=new Map();
  for(const [key,r]of Object.entries(data)){
   if(!key.startsWith('accountId:')||(allowed&&!allowed.has(r.userId)))continue;
   const label=r.label||(['failed','interrupted'].includes(r.status)?'Lookup failed / incomplete':'No location returned');
   if(!groups.has(label))groups.set(label,[]);groups.get(label).push(r);
  }
  document.getElementById('cacheScope').textContent='Account based in → Connected via → Accounts · red, struck-through handles are muted per the latest record or sync'+(viewer?' for account '+viewer:'. No signed-in-account mute records selected.')+(viewer?'.':'');
  container.replaceChildren();
  for(const [label,records]of [...groups].sort(([a],[b])=>a.localeCompare(b))){
   const details=make('details',undefined,'cache-group');details.open=!!query||openGroups.has(label);
   details.ontoggle=()=>{if(query)return;details.open?openGroups.add(label):openGroups.delete(label);};
   const count=records.filter(isMuted).length,summary=make('summary');summary.append(make('span',label),make('span',`${records.length} account${records.length===1?'':'s'}${count?' · '+count+' muted':''}`,'cache-count'));details.append(summary);
   const connections=new Map();
   for(const r of records){const via=r.connectedVia||(r.locationDataVersion===2?'Not provided by X':'Not yet checked');if(!connections.has(via))connections.set(via,[]);connections.get(via).push(r);}
   for(const [connection,users]of [...connections].sort(([a],[b])=>a.localeCompare(b))){
    const key=JSON.stringify([label,connection]),branch=make('details',undefined,'cache-connection');branch.open=!!query||openGroups.has(key);
    branch.ontoggle=()=>{if(query)return;branch.open?openGroups.add(key):openGroups.delete(key);};
    const mutedCount=users.filter(isMuted).length,heading=make('summary');heading.append(make('span','Connected via: '+connection),make('span',users.length+' accounts'+(mutedCount?' · '+mutedCount+' muted':''),'cache-count'));branch.append(heading);
   const list=make('div',undefined,'cache-users');
   for(const r of users.sort((a,b)=>(a.handle||a.userId).localeCompare(b.handle||b.userId))){
    const muted=isMuted(r),log=data[`mute:${viewer}:${r.userId}`],row=make('div',undefined,'cache-row'+(muted?' cache-muted':''));
    const name=make('button',r.handle?'@'+r.handle:r.userId,'cache-handle');name.setAttribute('aria-label','Inspect '+(r.handle||r.userId));name.onclick=()=>{const search=document.getElementById('cacheSearch');search.value=r.userId;search.oninput?.();};
    const exception=data[`allow:${viewer}:${r.userId}`],unmuted=log?.status==='unmuted'||log?.lastSeenUnmutedAt>log?.time;
    const status=muted?'Muted':exception?.status==='unmuted'?'Unmuted · always allowed':exception?'Always allowed · unmute not confirmed':unmuted?'Unmuted':log?.status==='failed'?'Mute failed':log?.status==='interrupted'?'Mute interrupted':r.status==='failed'?'Lookup failed':r.status==='interrupted'?'Lookup interrupted':'No confirmed mute';
    row.append(name,make('span',status,'cache-state'));
    const error=exception?(exception.status==='failed'?exception.error:''):unmuted?r.error:log?.error||r.error;
    if(!muted&&error)row.append(make('small',error,'cache-error'));
    list.append(row);
   }
   branch.append(list);details.append(branch);
   }
   container.append(details);
  }
  if(!groups.size)container.append(make('p',query?'No cached accounts match this search.':'No accounts cached yet.'));
 };
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>k.startsWith('allow:')||k.startsWith('mute:')||k.startsWith('muteSnapshot:')||k==='lastMuteViewer'))chrome.storage.local.get(null).then(renderCacheGroups);});
 document.getElementById('muteViewer')?.addEventListener('change',()=>chrome.storage.local.get(null).then(renderCacheGroups));
})();
