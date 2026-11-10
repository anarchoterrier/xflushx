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
 function gifAt(event){
  const candidates=new Set();let article;
  for(const node of event.composedPath()){
   if(!(node instanceof Element))continue;
   article=article||node.closest('article,[data-testid="tweet"]');
   const container=node.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]');
   const video=node instanceof HTMLVideoElement?node:container?.querySelector('video');
   const image=node instanceof HTMLImageElement?node:null;
   if(video)candidates.add(video);if(image)candidates.add(image);
   for(const media of node.querySelectorAll?.('video,img[src*="/tweet_video_thumb/"]')||[]){
    const r=media.getBoundingClientRect();
    if(Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom)candidates.add(media);
   }
  }
  for(const media of candidates){
   const video=media instanceof HTMLVideoElement?media:null,image=media instanceof HTMLImageElement?media:null;
   try{const src=new URL(video?.currentSrc||video?.src||'');if(src.hostname==='video.twimg.com'&&/^\/tweet_video\/[\w-]+\.mp4$/.test(src.pathname))return src.href;}catch{}
   try{const poster=new URL(video?.poster||image?.src||'');const m=poster.pathname.match(/^\/tweet_video_thumb\/([\w-]+)(?:\.[\w]+)?$/);if(poster.hostname==='pbs.twimg.com'&&m)return 'https://video.twimg.com/tweet_video/'+m[1]+'.mp4';}catch{}
  }
  if([...candidates].some(m=>m instanceof HTMLVideoElement)){
   const link=article?.querySelector('a[href*="/status/"]:has(time)')||article?.querySelector('a[href*="/status/"]');
   const match=(link?.getAttribute('href')||location.pathname).match(/\/status\/(\d+)/);
   if(match)return 'post:'+match[1];
  }
 }
 function videoAt(event){
  function postSource(node,poster){
   const article=node.closest('article,[data-testid="tweet"]');
   const mediaLink=node.closest('a[href*="/video/"]');
   const link=mediaLink||article?.querySelector('a[href*="/status/"]:has(time)')||article?.querySelector('a[href*="/status/"]');
   const match=(link?.getAttribute('href')||location.pathname).match(/\/status\/(\d+)/);
   return match?{url:'post:'+match[1],poster:poster||''}:null;
  }
  for(const node of event.composedPath()){
   if(!(node instanceof Element))continue;
   const container=node.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"],[data-testid="videoPlayerContainer"]');
   const candidates=node instanceof HTMLVideoElement?[node]:[...(container?.querySelectorAll?.('video,img')||[]),...(node.querySelectorAll?.('video,img[src*="video_thumb/"]')||[])];
   for(const media of candidates){
    const video=media instanceof HTMLVideoElement?media:null;
    const image=media instanceof HTMLImageElement?media:null;
    if(!video&&!image)continue;
    if(!container&&media!==node){const r=media.getBoundingClientRect();if(!Number.isFinite(event.clientX)||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)continue;}
    const source=video?.currentSrc||video?.src||'';
    try{const u=new URL(source);if(u.protocol==='https:'&&u.hostname==='video.twimg.com'&&/^\/(?:ext_tw_video|amplify_video)\/[^?#]+\.mp4$/i.test(u.pathname))return {url:u.href,poster:video.poster||''};}catch{}
    const poster=video?.poster||image?.currentSrc||image?.src||'';
    if(image&&!/pbs\.twimg\.com\/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\//.test(poster))continue;
    const result=postSource(node,poster);if(result)return result;
   }
   // Player controls and letterboxing can be outside the actual video bounds;
   // a lazy player may not have inserted its video element yet at all.
   if(container){const result=postSource(node,'');if(result)return result;}
   if(node instanceof HTMLImageElement&&/pbs\.twimg\.com\/(?:amplify_video_thumb|ext_tw_video_thumb)\//.test(node.currentSrc||node.src||'')){const result=postSource(node,node.currentSrc||node.src);if(result)return result;}
  }
 }
 function handle(event){
  if(!connected()){enabled=false;close();return;}
  if(!enabled||event.type!=='contextmenu'&&event.button!==2)return;
  const gifUrl=gifAt(event),video=videoAt(event);let url=(gifUrl&&!gifUrl.startsWith('post:')?gifUrl:null)||video?.url||gifUrl||imageAt(event);if(!url)return;
  const isVideo=!!video&&(!gifUrl||gifUrl.startsWith('post:'));
  event.stopImmediatePropagation();event.preventDefault();
  if(event.type!=='contextmenu')return;
  close();host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow=host.attachShadow({mode:'closed'}),menu=document.createElement('div');
  menu.setAttribute('role','menu');menu.style.cssText=`position:absolute;left:${Math.max(8,Math.min(event.clientX,innerWidth-240))}px;top:${Math.max(8,Math.min(event.clientY,innerHeight-220))}px;background:#fff;color:#18212f;border:1px solid #dce3ed;border-radius:12px;padding:6px;box-shadow:0 8px 32px #0003;width:224px;pointer-events:auto;font:13px system-ui;`;
  const status=document.createElement('div');status.style.cssText='padding:6px 10px;font:11px system-ui;color:#556;';status.setAttribute('role','status');
  async function bytes(){const r=await photoRequest({type:'photo-bytes',url});return Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0));}
  function action(text,fn){const b=document.createElement('button');b.textContent=text;b.setAttribute('role','menuitem');b.style.cssText='display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:10px;border-radius:6px;font:inherit;cursor:pointer';b.onmouseenter=()=>b.style.background='#edf4ff';b.onmouseleave=()=>b.style.background='transparent';b.onclick=async()=>{b.disabled=true;try{await fn();close();}catch(e){status.textContent='Could not complete: '+e.message;b.disabled=false;}};menu.append(b);}
  if(isVideo){
   let sourcePromise;
   function resolveVideo(){if(!sourcePromise)sourcePromise=url.startsWith('post:')?photoRequest({type:'video-source',postId:url.slice(5),poster:video.poster}):Promise.resolve({url,type:'video'});return sourcePromise.catch(error=>{sourcePromise=null;throw error;});}
   action('Save video…',async()=>{status.textContent='Finding downloadable video…';const result=await resolveVideo();await photoRequest({type:'video-save',url:result.url});});
   action('Copy video address',async()=>navigator.clipboard.writeText((await resolveVideo()).url));
   // Blob-backed GIF players cannot be classified until X metadata resolves.
   if(gifUrl?.startsWith('post:'))action('Save as animated GIF…',async()=>{
    status.textContent='Loading animation…';const result=await resolveVideo();if(result.type!=='animated_gif')throw Error('This is a video. Choose Save video instead.');
    const response=await photoRequest({type:'gif-bytes',url:result.url});const raw=Uint8Array.from(atob(response.base64),c=>c.charCodeAt(0));
    const gif=await xflushxConvertGif(raw,(frame,total)=>status.textContent=`Converting animation: ${Math.round(frame/total*100)}%`);
    let binary='';for(let i=0;i<gif.length;i+=8192)binary+=String.fromCharCode(...gif.subarray(i,i+8192));await photoRequest({type:'gif-download',base64:btoa(binary)});
   });
  }else if(gifUrl){
   async function resolveGif(){if(url.startsWith('post:')){const result=await photoRequest({type:'gif-source',postId:url.slice(5)});url=result.url;}return url;}
   action('Save as animated GIF…',async()=>{
    status.textContent='Loading animation…';await resolveGif();const response=await photoRequest({type:'gif-bytes',url});const raw=Uint8Array.from(atob(response.base64),c=>c.charCodeAt(0));
    const gif=await xflushxConvertGif(raw,(frame,total)=>status.textContent=`Converting animation: ${Math.round(frame/total*100)}%`);
    let binary='';for(let i=0;i<gif.length;i+=8192)binary+=String.fromCharCode(...gif.subarray(i,i+8192));
    await photoRequest({type:'gif-download',base64:btoa(binary)});
   });
   action('Save original video…',async()=>photoRequest({type:'gif-save-video',url:await resolveGif()}));
   action('Copy animation address',async()=>navigator.clipboard.writeText(await resolveGif()));
   status.textContent='Local GIF conversion: up to 15 seconds, 320 px, 10 fps.';
  }else{
  action('Save image (native format)…',async()=>{await photoRequest({type:'photo-save',url});});
  action('Copy image',async()=>{
   if(!connected())throw Error(refreshMessage);
   // Supply the promise during the click to preserve clipboard activation.
   const png=(async()=>{const raw=await bytes();const bitmap=await createImageBitmap(new Blob([raw]));try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image conversion failed')),'image/png'));}finally{bitmap.close();}})();
   png.catch(()=>{}); // Clipboard setup can fail before it consumes the promise.
   await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
  });
  action('Copy image link',()=>navigator.clipboard.writeText(url));
  action('Open image in new tab',()=>{window.open(url,'_blank','noopener');});
  }
  menu.append(status);shadow.append(menu);document.documentElement.append(host);menu.querySelector('button').focus();
 }
 for(const type of ['pointerdown','mousedown','mouseup','pointerup','contextmenu','auxclick'])window.addEventListener(type,handle,true);
 window.addEventListener('pointerdown',e=>{if(host&&!e.composedPath().includes(host))close();},true);
 window.addEventListener('keydown',e=>{if(e.key==='Escape')close();},true);
 window.addEventListener('scroll',close,true);
})();
