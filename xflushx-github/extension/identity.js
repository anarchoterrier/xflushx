// Read identities from the user objects attached to rendered X components.
// Never infer a numeric user ID from a tweet ID or a profile URL.
(() => {
 function findIds(value,handle){
  const ids=new Set(),seen=new Set(),stack=[value];let budget=1200;
  while(stack.length&&budget-->0){
   const item=stack.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);
   const name=item.core?.screen_name||item.legacy?.screen_name||item.legacy?.core?.screen_name;
   if(typeof name==='string'&&name.toLowerCase()===handle&&typeof item.rest_id==='string'&&/^\d+$/.test(item.rest_id))ids.add(item.rest_id);
   for(const [key,child]of Object.entries(item))if(!['children','_owner','return','child','sibling','stateNode'].includes(key)&&child&&typeof child==='object')stack.push(child);
  }
  return ids;
 }
 function scan(){
  for(const link of document.querySelectorAll('[data-testid="User-Name"] a[href], [data-testid="UserName"] a[href], [data-testid="UserCell"] a[href]')){
   const url=new URL(link.href,location.href),match=url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
   if(url.origin!==location.origin||!match||!link.getClientRects().length)continue;
   const handle=match[1].toLowerCase();let node=link;const ids=new Set();
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
