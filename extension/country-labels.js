// SPDX-License-Identifier: GPL-3.0-only
// Display cached facts only. This module never requests account information.
(() => {
 const identities=new Map(),records=new Map(),model=createLocationModel();
 let config={locationAliases:{},locationCustom:[]};
 function labelFor(record){
  function code(value){const n=model.resolve(value);return n?.type==='country'&&/^[A-Z]{2}$/.test(n.iso2||'')?n.iso2:'XX';}
  const valid=['known','missing'].includes(record.status);
  const based=valid?code(record.label):'XX',via=valid?code(connectedLocation(record.connectedVia)):'XX';
  return {text:based+' / '+via,red:based==='XX'||via==='XX'||based!==via};
 }
 const hoverSelector='[data-testid="HoverCard"],[data-testid="UserHoverCard"],[data-testid="profile-hover-card"],#layers [role="tooltip"]';
 function renderHoverCards(){
  for(const card of document.querySelectorAll(hoverSelector)){
   const kind=card.getAttribute?.('data-testid');
   if(!['HoverCard','UserHoverCard','profile-hover-card'].includes(kind)&&card.getAttribute?.('role')!=='tooltip')continue;
   let handle;
   for(const link of card.querySelectorAll('a[href]')){
    try{const url=new URL(link.href,location.href),match=url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);if(url.origin===location.origin&&match){handle=match[1].toLowerCase();break;}}catch{}
   }
   const id=handle&&identities.get(handle),record=id&&records.get(id);
   let footer=card.querySelector('[data-xflushx-hover-details]');
   if(!record){footer?.remove();continue;}
   const sample=card.querySelector('[data-testid="UserDescription"]')||[...card.querySelectorAll('span')].find(e=>/^@[A-Za-z0-9_]{1,15}$/.test(e.textContent.trim()))||card.querySelector('a[href]');
   const nativeStyle=sample&&typeof getComputedStyle==='function'?getComputedStyle(sample):null;
   const family=nativeStyle?.fontFamily||'"TwitterChirp",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
   const size=nativeStyle?.fontSize||'15px',lineHeight=nativeStyle?.lineHeight||'1.4';
   const pair=labelFor(record),signature=JSON.stringify([id,record.label,record.connectedVia,record.locationDataVersion,record.status,pair.text,pair.red,family,size,lineHeight]);
   if(footer?.getAttribute('data-xflushx-hover-details')===signature)continue;
   if(!footer){footer=document.createElement('section');card.append(footer);}
   footer.setAttribute('data-xflushx-hover-details',signature);footer.setAttribute('aria-label','Cached account location details');
   footer.style.cssText='padding:12px 16px 14px;border-top:1px solid color-mix(in srgb,currentColor 16%,transparent);color:inherit;font-family:'+family+';font-size:'+size+';line-height:'+lineHeight+';font-weight:400;';
   footer.replaceChildren();
   const heading=document.createElement('div');heading.textContent='Location details · '+pair.text;heading.style.cssText='font-weight:700;margin-bottom:7px;'+(pair.red?'color:light-dark(#a92342,#ff9bab);':'');footer.append(heading);
   for(const [label,value]of [['Account based in',record.label||'Not provided'],['Connected via',record.connectedVia||(record.locationDataVersion===2?'Not provided':'Not yet checked')]]){
    const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,1.6fr);gap:8px;margin-top:4px;';
    const name=document.createElement('span');name.textContent=label;name.style.opacity='.7';
    const text=document.createElement('strong');text.textContent=value;text.style.cssText='overflow-wrap:anywhere;font-weight:500;';row.append(name,text);footer.append(row);
   }
   const note=document.createElement('p');note.textContent='XX means no ISO country code: region, unknown, or unavailable.';note.style.cssText='margin:8px 0 0;opacity:.65;font:inherit;';footer.append(note);
  }
 }
 function placeRepostBadge(link,badge){
  const social=link.closest?.('[data-testid="socialContext"]')||link.querySelector('[data-testid="socialContext"]');
  if(!social||typeof document.createTreeWalker!=='function')return false;
  const walker=document.createTreeWalker(link,4);let text;
  while(text=walker.nextNode()){
   const match=text.nodeValue?.match(/\s+reposted$/i);if(!match)continue;
   // Keep X's name and suffix text; place our badge between them.
   const suffix=match.index===0?text:text.splitText(match.index);
   if(badge.nextSibling!==suffix)suffix.parentNode.insertBefore(badge,suffix);
   suffix.parentElement.style.display='inline';suffix.parentElement.style.whiteSpace='nowrap';
   link.style.display='inline-flex';link.style.flexDirection='row';link.style.alignItems='center';link.style.whiteSpace='nowrap';
   return true;
  }
  return false;
 }
 function render(){
  const quotes=globalThis.xflushxQuoteAuthors?.()||[];
  for(const block of [...document.querySelectorAll('[data-testid="User-Name"],[data-testid="UserName"],[data-testid="UserCell"],article'),...quotes.map(q=>q.node)]){
   const quote=quotes.find(q=>q.node===block);
   let link=quote?.name?.parentElement,handle=quote?.handle;
   for(const candidate of quote?[]:block.querySelectorAll('a[href]')){
    let url;try{url=new URL(candidate.href,location.href);}catch{continue;}
    const match=url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
    if(url.origin===location.origin&&match&&candidate.textContent.trim()){
     link=candidate;handle=match[1].toLowerCase();break;
    }
   }
   if(!link)continue;
   const id=identities.get(handle),record=id&&records.get(id);
   let badge=link.querySelector('[data-xflushx-location]');
   if(!record){badge?.remove();continue;}
   const display=labelFor(record);
   if(!badge){
    badge=document.createElement('span');badge.setAttribute('data-xflushx-location','');
    // First name span contains the display name (including its emoji), while
    // verification and the @handle are later siblings in X's header layout.
    const name=quote?.name||link.querySelector('span');
    if(name)name.after(badge);else link.append(badge);
   }
   placeRepostBadge(link,badge);
   if(badge.textContent!==display.text)badge.textContent=display.text;
   const palette=display.red?'color:light-dark(#a92342,#ff9bab);background:rgba(231,68,85,.12);border:1px solid rgba(231,68,85,.22);':'color:inherit;background:color-mix(in srgb,currentColor 7%,transparent);border:1px solid color-mix(in srgb,currentColor 14%,transparent);';
   badge.style.cssText='display:inline-flex;align-items:center;vertical-align:middle;font-weight:700;font-size:11px;line-height:16px;letter-spacing:.35px;padding:0 6px;border-radius:6px;margin-inline:5px 2px;white-space:nowrap;font-variant-numeric:tabular-nums;'+palette;
   const explanation='Account based in: '+(record.label||'not provided')+'; Connected via: '+(record.connectedVia||(record.locationDataVersion===2?'not provided':'not yet checked'))+'. XX means no ISO country code (region, unknown, or unavailable).';
   badge.removeAttribute?.('title');badge.setAttribute('aria-label',display.text+'. '+explanation);
  }
  renderHoverCards();
 }
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.source!=='xlc-identity-v1')return;
  const {handle,userId}=event.data;if(typeof handle!=='string'||!/^[A-Za-z0-9_]{1,15}$/.test(handle)||typeof userId!=='string'||!/^\d{1,25}$/.test(userId))return;
  const name=handle.toLowerCase();if(identities.get(name)===userId)return;
  identities.set(name,userId);render();
 });
 chrome.storage.local.get(null,data=>{
  config={locationAliases:data.locationAliases||{},locationCustom:data.locationCustom||[]};model.configure(config);
  for(const [key,value]of Object.entries(data))if(key.startsWith('accountId:'))records.set(key.slice(10),value);
  render();
 });
 chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local')return;
  if(!Object.keys(changes).some(key=>key.startsWith('accountId:')||key==='locationAliases'||key==='locationCustom'))return;
  for(const [key,change]of Object.entries(changes)){
   if(key.startsWith('accountId:')){const id=key.slice(10);change.newValue?records.set(id,change.newValue):records.delete(id);}
   else if(key==='locationAliases'||key==='locationCustom')config[key]=change.newValue||(key==='locationCustom'?[]:{});
  }
  model.configure(config);render();
 });
 setInterval(render,1500);
 // Native hover cards are short-lived: update on insertion, not just the poll.
 if(typeof MutationObserver!=='undefined'){
  let scheduled=false;
  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;renderHoverCards();},50);});
  const start=()=>{if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});};
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
 }
})();
