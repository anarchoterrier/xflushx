(() => {
 const identities=new Map(),encountered=new Map(),queue=[],queued=new Set();let running=false,enabled=false;
 function enqueue(userId){if(!queued.has(userId)){queued.add(userId);queue.push(userId);}}
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.source!=='xlc-identity-v1')return;
  const {handle,userId}=event.data;
  if(typeof handle!=='string'||!/^[a-zA-Z0-9_]{1,15}$/.test(handle)||typeof userId!=='string'||!/^\d{1,25}$/.test(userId))return;
  identities.set(handle.toLowerCase(),userId);
  // Profile headings are often plain text, without a self-link to observe.
  const profile=location.pathname?.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(?:about|with_replies|media|highlights|articles))?\/?$/)?.[1]?.toLowerCase();
  if(enabled&&profile===handle.toLowerCase()&&!encountered.has(userId)){
   encountered.set(userId,handle.toLowerCase());enqueue(userId);
  }
  scan();
 });
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){if(!entry.isIntersecting)continue;
   const link=entry.target,handle=link.dataset.xlcHandle,userId=identities.get(handle);
   if(!userId)continue;
   const first=!encountered.has(userId);encountered.set(userId,handle);
   if(enabled&&first)enqueue(userId);observer.unobserve(link);
  }
 });
 const watched=new WeakMap();
 function scan(){
  if(!enabled)return;
  for(const link of document.querySelectorAll('[data-testid="User-Name"] a[href], [data-testid="UserName"] a[href], [data-testid="UserCell"] a[href], article a[href], [data-testid="UserAvatar-Container"] a[href]')){
   let url;try{url=new URL(link.href);}catch{continue;}
   if(url.origin!==location.origin)continue;
   const match=url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);if(!match)continue;
   const handle=match[1].toLowerCase(),identity=handle+':'+(identities.get(handle)||'');
   if(watched.get(link)===identity)continue;
   watched.set(link,identity);link.dataset.xlcHandle=handle;
   // observe() alone does not emit again for an already observed element.
   // Re-arm when its handle/ID binding changes after the first intersection.
   observer.unobserve(link);observer.observe(link);
  }
  // Observe the quote card itself when its author header has no profile anchor.
  for(const {node,handle}of globalThis.xflushxQuoteAuthors?.()||[]){
   const binding=handle+':'+(identities.get(handle)||'');if(watched.get(node)===binding)continue;
   watched.set(node,binding);node.dataset.xlcHandle=handle;
   observer.unobserve(node);observer.observe(node);
  }
 }
 async function pump(){
  if(running||!enabled||!queue.length)return;
  running=true;const userId=queue.shift();queued.delete(userId);
  try{
   const result=await chrome.runtime.sendMessage({type:'encounter',userId,handle:encountered.get(userId)});
   if(result?.retryAfter||result?.paused||result?.skipped)enqueue(userId);
  }catch{enqueue(userId);}finally{running=false;}
 }
 chrome.storage.local.get({enabled:false},s=>{enabled=s.enabled;scan();});
 chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local')return;
  if(changes.enabled)enabled=changes.enabled.newValue===true;
  if(changes.rules||changes.enabled||changes.cacheResetAt||changes.locationAliases||changes.locationCustom||changes.missingLocationAction||changes.matchConnectedVia)for(const userId of encountered.keys())enqueue(userId);
  scan();
 });
 setInterval(scan,1500);setInterval(pump,2000);
})();
