// Queue entries are separate from cached lookup results; identity remains ID-based.
globalThis.pendingAccountRows=function(data,query=''){
 const q=query.trim().replace(/^@/,'').toLowerCase();
 return Object.entries(data).filter(([key])=>key.startsWith('pendingAccount:')).map(([,job])=>{
  const cache=data['accountId:'+job.userId];
  let status=!cache?'Waiting for first lookup':cache.status==='rate-limited'?'Lookup rate-limited; will retry':cache.status==='known'||cache.status==='missing'?'Location cached; waiting for rule evaluation':'Waiting to process';
  if(!data.enabled)status+=' · automatic muting off';
  else if(data.rateLimitUntil>Date.now())status+=' · cooldown';
  else if(data.pauseReason)status+=' · queue paused';
  return {...job,status};
 }).filter(job=>!q||(job.handle||'').toLowerCase().includes(q)||job.userId.includes(q));
};
globalThis.renderPendingAccounts=function(data,query=''){
 const body=document.getElementById('pendingAccounts'),summary=document.getElementById('pendingSummary');if(!body||!summary)return;
 const all=pendingAccountRows(data),rows=pendingAccountRows(data,query);summary.textContent='Queued accounts · '+all.length+(query?' · '+rows.length+' matching':'');body.replaceChildren();
 for(const job of rows){
  const tr=document.createElement('tr'),account=document.createElement('td'),link=document.createElement('a');link.textContent=job.handle?'@'+job.handle:job.userId;link.href='https://x.com/i/user/'+job.userId;link.target='_blank';link.rel='noopener';account.append(link);
  const id=document.createElement('small');id.textContent='ID '+job.userId;account.append(id);
  const state=document.createElement('td');state.textContent=job.status;
  const viewer=document.createElement('td');viewer.textContent='Account ID '+job.viewer;
  tr.append(account,state,viewer);body.append(tr);
 }
 if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent=query?'No queued accounts match this search.':'No accounts waiting.';tr.append(td);body.append(tr);}
};
