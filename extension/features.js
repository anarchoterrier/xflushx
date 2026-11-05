(() => {
 let settings={stripTrackingLinks:true,restoreImageMenu:false};
 const style=document.createElement('style');
 // Transparent photo overlays otherwise remain the hit-test target, so Chrome
 // sees a link/div rather than an image and omits its image actions.
 style.textContent="";
 function publish(){
  window.postMessage({source:'xlc-feature-settings',...settings},location.origin);
  if(settings.restoreImageMenu){if(!style.isConnected)(document.head||document.documentElement)?.append(style);}else style.remove();
 }
 window.addEventListener('message',event=>{
  if(event.source===window&&event.origin===location.origin&&event.data?.source==='xlc-settings-request')publish();
 });
 chrome.storage.local.get(settings,value=>{settings=value;publish();});
 chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local')return;
  for(const key of ['stripTrackingLinks','restoreImageMenu'])if(changes[key])settings[key]=changes[key].newValue??(key==='stripTrackingLinks');
  publish();
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',publish,{once:true});
})();
