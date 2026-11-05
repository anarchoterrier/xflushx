(() => {
 let enabled=false,host;
 const refreshMessage='The extension was updated or reloaded. Refresh this X tab, then try again.';
 function connected(){return typeof chrome!=='undefined'&&!!chrome.runtime?.id&&typeof chrome.runtime?.sendMessage==='function';}
 async function photoRequest(message){
  if(!connected())throw Error(refreshMessage);
  try{const response=await chrome.runtime.sendMessage(message);if(!response)throw Error('No response from the extension. Reload the extension and refresh this X tab.');if(response.error)throw Error(response.error);return response;}
  catch(error){if(!connected()||/context invalidated|receiving end does not exist|message port closed/i.test(error.message))throw Error(refreshMessage);throw error;}
 }
 chrome.storage.local.get({restoreImageMenu:false},s=>enabled=s.restoreImageMenu);
 chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.restoreImageMenu){enabled=c.restoreImageMenu.newValue===true;close();}});
 function close(){host?.remove();host=null;}
 function imageAt(event){
  for(const node of event.composedPath()){
   if(!(node instanceof Element))continue;
   const img=node instanceof HTMLImageElement?node:node.closest('[data-testid="tweetPhoto"]')?.querySelector('img');
   if(!img)continue;
   try{const u=new URL(img.currentSrc||img.src);if(u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/media/'))return u.href;}catch{}
  }
 }
 function handle(event){
  if(!connected()){enabled=false;close();return;}
  if(!enabled||event.type!=='contextmenu'&&event.button!==2)return;
  const url=imageAt(event);if(!url)return;
  event.stopImmediatePropagation();event.preventDefault();
  if(event.type!=='contextmenu')return;
  close();host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow=host.attachShadow({mode:'closed'}),menu=document.createElement('div');
  menu.setAttribute('role','menu');menu.style.cssText=`position:absolute;left:${Math.max(8,Math.min(event.clientX,innerWidth-240))}px;top:${Math.max(8,Math.min(event.clientY,innerHeight-220))}px;background:#fff;color:#18212f;border:1px solid #dce3ed;border-radius:12px;padding:6px;box-shadow:0 8px 32px #0003;width:224px;pointer-events:auto;font:13px system-ui;`;
  const status=document.createElement('div');status.style.cssText='padding:6px 10px;font:11px system-ui;color:#556;';status.setAttribute('role','status');
  async function bytes(){const r=await photoRequest({type:'photo-bytes',url});return Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0));}
  function action(text,fn){const b=document.createElement('button');b.textContent=text;b.setAttribute('role','menuitem');b.style.cssText='display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:10px;border-radius:6px;font:inherit;cursor:pointer';b.onmouseenter=()=>b.style.background='#edf4ff';b.onmouseleave=()=>b.style.background='transparent';b.onclick=async()=>{b.disabled=true;try{await fn();close();}catch(e){status.textContent='Could not complete: '+e.message;b.disabled=false;}};menu.append(b);}
  action('Save image…',async()=>{await photoRequest({type:'photo-save',url});});
  action('Copy image',async()=>{
   if(!connected())throw Error(refreshMessage);
   // Supply the promise during the click to preserve clipboard activation.
   const png=(async()=>{const raw=await bytes();const bitmap=await createImageBitmap(new Blob([raw]));try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image conversion failed')),'image/png'));}finally{bitmap.close();}})();
   png.catch(()=>{}); // Clipboard setup can fail before it consumes the promise.
   await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
  });
  action('Copy image link',()=>navigator.clipboard.writeText(url));
  action('Open image in new tab',()=>{window.open(url,'_blank','noopener');});
  menu.append(status);shadow.append(menu);document.documentElement.append(host);menu.querySelector('button').focus();
 }
 for(const type of ['pointerdown','mousedown','mouseup','pointerup','contextmenu','auxclick'])window.addEventListener(type,handle,true);
 window.addEventListener('pointerdown',e=>{if(host&&!e.composedPath().includes(host))close();},true);
 window.addEventListener('keydown',e=>{if(e.key==='Escape')close();},true);
 window.addEventListener('scroll',close,true);
})();
