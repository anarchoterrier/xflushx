// SPDX-License-Identifier: GPL-3.0-only
globalThis.xflushxConvertGif=async function(raw,progress){
 const blobUrl=URL.createObjectURL(new Blob([raw],{type:'video/mp4'})),video=document.createElement('video');video.muted=true;video.preload='auto';video.playsInline=true;
 function event(name,action){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('GIF video decoding timed out.')),15000);function done(error){clearTimeout(timer);video.removeEventListener(name,success);video.removeEventListener('error',failure);error?reject(error):resolve();}function success(){done();}function failure(){done(Error('Could not decode this GIF video.'));}video.addEventListener(name,success,{once:true});video.addEventListener('error',failure,{once:true});try{action?.();}catch(e){done(e);}});}
 try{
  await event('loadeddata',()=>{video.src=blobUrl;video.load();});
  if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth||!video.videoHeight)throw Error('GIF video has no usable duration or dimensions.');
  if(video.duration>15)throw Error('GIF conversion supports animations up to 15 seconds. Use Save original video for this animation.');
  const scale=Math.min(1,320/video.videoWidth,320/video.videoHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Image conversion is unavailable.');
  const writer=new XflushxGifWriter(canvas.width,canvas.height),count=Math.ceil(video.duration*10);
  for(let i=0;i<count;i++){
   const time=Math.min(i/10,Math.max(0,video.duration-.001));if(Math.abs(video.currentTime-time)>.0001)await event('seeked',()=>video.currentTime=time);
   context.drawImage(video,0,0,canvas.width,canvas.height);writer.frame(context.getImageData(0,0,canvas.width,canvas.height).data,Math.max(1,Math.round(Math.min(.1,video.duration-i/10)*100)));
   progress?.(i+1,count);await new Promise(resolve=>setTimeout(resolve,0));
  }
  return writer.finish();
 }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(blobUrl);}
};
