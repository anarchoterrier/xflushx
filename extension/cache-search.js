// SPDX-License-Identifier: GPL-3.0-only
globalThis.searchCachedAccounts=(data,input)=>{
 const query=String(input||'').trim().replace(/^@+/,'').toLowerCase();
 const records=Object.entries(data).filter(([k])=>k.startsWith('accountId:')).map(([,r])=>r);
 const exact=query?(data['accountId:'+query]||records.find(r=>String(r.handle||'').toLowerCase()===query)):null;
 const matches=records.filter(r=>!query||r===exact||String(r.handle||'').toLowerCase().includes(query)||String(r.userId||'')===query).sort((a,b)=>String(a.handle||a.userId).localeCompare(String(b.handle||b.userId)));
 return {query,exact,matches};
};
