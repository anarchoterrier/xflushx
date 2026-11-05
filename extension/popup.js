const defaults={stripTrackingLinks:true,restoreImageMenu:false,enabled:false};
chrome.storage.local.get(defaults,settings=>{
 for(const key of Object.keys(defaults)){
  const input=document.getElementById(key);input.checked=settings[key];
  input.onchange=async()=>{try{await chrome.storage.local.set({[key]:input.checked});document.getElementById('status').textContent='Saved. Changes apply to open X tabs.';}catch{document.getElementById('status').textContent='Could not save. Please try again.';}};
 }
});
document.getElementById('open').onclick=()=>chrome.runtime.openOptionsPage();
chrome.action.getBadgeText({}).then(text=>{
 const notice=document.getElementById('reviewNotice');notice.hidden=!text;
 notice.textContent=text?`${text} location label${text==='1'?'':'s'} need review. Open Manage mute rules below.`:'';
});
