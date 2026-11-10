// Read identities from the user objects attached to rendered X components.
// Never infer a numeric user ID from a tweet ID or a profile URL.
(() => {
 const learned=new Map();
 function userIdentity(item){
  const handle=item.core?.screen_name||item.legacy?.screen_name||item.legacy?.core?.screen_name||item.screen_name;
  const userId=item.rest_id||item.id_str;
  if(typeof handle!=='string'||!/^[A-Za-z0-9_]{1,15}$/.test(handle)||typeof userId!=='string'||!/^\d{1,25}$/.test(userId))return;
  if(item.rest_id&&item.id_str&&item.rest_id!==item.id_str)return;
  return {handle:handle.toLowerCase(),userId};
 }
 function publish(handle,userId){window.postMessage({source:'xlc-identity-v1',handle,userId},location.origin);}
 function learnResponse(data){
  const stack=[data],seen=new Set(),bindings=new Map();let budget=100000;
  while(stack.length&&budget-->0){
   const item=stack.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);
   const identity=userIdentity(item);
   if(identity){const {handle:name,userId}=identity;if(!bindings.has(name))bindings.set(name,new Set());bindings.get(name).add(userId);}
   for(const child of Object.values(item))if(child&&typeof child==='object')stack.push(child);
  }
  for(const [handle,ids]of bindings)if(ids.size===1){const id=[...ids][0];learned.set(handle,id);publish(handle,id);}
 }
 function graphRequest(value){try{const u=new URL(value,location.href);return u.origin===location.origin&&u.pathname.startsWith('/i/api/graphql/');}catch{return false;}}
 // Observe only responses X already requested. No extra identity lookup,
 // request/header modification, credential capture, or stored response bodies.
 if(typeof window.fetch==='function'){
  const original=window.fetch;
  window.fetch=function(...args){
   const pending=Reflect.apply(original,this,args);
   if(graphRequest(typeof args[0]==='string'?args[0]:args[0]?.url))pending.then(response=>{
    if(response.ok)response.clone().json().then(learnResponse).catch(()=>{});
   }).catch(()=>{});
   return pending;
  };
 }
 if(typeof XMLHttpRequest!=='undefined'){
  const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send,urls=new WeakMap();
  XMLHttpRequest.prototype.open=function(method,url,...rest){urls.set(this,url);return Reflect.apply(open,this,[method,url,...rest]);};
  XMLHttpRequest.prototype.send=function(...args){
   if(graphRequest(urls.get(this)))this.addEventListener('load',()=>{try{if(this.status>=200&&this.status<300)learnResponse(this.responseType==='json'?this.response:JSON.parse(this.responseText));}catch{}},{once:true});
   return Reflect.apply(send,this,args);
  };
 }
 function findIds(value,handle){
  const ids=new Set(),seen=new Set(),stack=[value];let budget=1200;
  while(stack.length&&budget-->0){
   const item=stack.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);
   const identity=userIdentity(item);
   if(identity?.handle===handle)ids.add(identity.userId);
   for(const [key,child]of Object.entries(item))if(!['children','_owner','return','child','sibling','stateNode'].includes(key)&&child&&typeof child==='object')stack.push(child);
  }
  return ids;
 }
 function elementIds(element,handle){
  const ids=new Set();
  const key=Object.keys(element).find(k=>k.startsWith('__reactFiber$'));
  let fiber=key&&element[key];
  for(let depth=0;fiber&&depth<30;depth++,fiber=fiber.return)for(const id of findIds(fiber.memoizedProps,handle))ids.add(id);
  for(let node=element,depth=0;node&&depth<12;node=node.parentElement,depth++){
   const props=Object.keys(node).find(k=>k.startsWith('__reactProps$'));
   if(props)for(const id of findIds(node[props],handle))ids.add(id);
   if(node.matches?.('article,[data-testid="UserCell"]'))break;
  }
  return ids;
 }
 function scan(){
  const profile=location.pathname?.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(?:about|with_replies|media|highlights|articles))?\/?$/)?.[1]?.toLowerCase();
  if(profile&&learned.has(profile))publish(profile,learned.get(profile));
  else if(profile){
   const ids=new Set();
   // A profile heading is often plain text. Inspect its already-loaded user
   // props even if no self-profile anchor or observable fetch exists.
   for(const node of document.querySelectorAll('[data-testid="UserName"],[data-testid="User-Name"]')){
    if(node.getClientRects&&!node.getClientRects().length)continue;
    for(const id of elementIds(node,profile))ids.add(id);
   }
   if(ids.size===1){const id=[...ids][0];learned.set(profile,id);publish(profile,id);}
  }
  for(const link of document.querySelectorAll('[data-testid="User-Name"] a[href], [data-testid="UserName"] a[href], [data-testid="UserCell"] a[href], article a[href], [data-testid="UserAvatar-Container"] a[href]')){
   const url=new URL(link.href,location.href),match=url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
   if(url.origin!==location.origin||!match||!link.getClientRects().length)continue;
   const handle=match[1].toLowerCase();let node=link;const ids=new Set();
   if(learned.has(handle)){publish(handle,learned.get(handle));continue;}
   const initialFiberKey=Object.keys(link).find(k=>k.startsWith('__reactFiber$'));
   let fiber=initialFiberKey&&link[initialFiberKey];
   for(let depth=0;fiber&&depth<25;depth++,fiber=fiber.return){
    for(const id of findIds(fiber.memoizedProps,handle))ids.add(id);
   }
   for(let depth=0;node&&depth<12;depth++,node=node.parentElement){
    const propsKey=Object.keys(node).find(k=>k.startsWith('__reactProps$'));
    const fiberKey=Object.keys(node).find(k=>k.startsWith('__reactFiber$'));
    for(const props of [propsKey&&node[propsKey],fiberKey&&node[fiberKey]?.memoizedProps])for(const id of findIds(props,handle))ids.add(id);
    if(node.matches('article,[data-testid="UserCell"]'))break;
   }
   if(ids.size===1)window.postMessage({source:'xlc-identity-v1',handle,userId:[...ids][0]},location.origin);
  }
 }
 setInterval(()=>{try{scan();}catch{}},1500);
})();
