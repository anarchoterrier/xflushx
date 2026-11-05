(() => {
  'use strict';
  let stripTrackingLinks=false,restoreImageMenu=false;
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.source!=='xlc-feature-settings')return;
    stripTrackingLinks=event.data.stripTrackingLinks===true;
    restoreImageMenu=event.data.restoreImageMenu===true;
  });
  window.postMessage({source:'xlc-settings-request'},location.origin);
  function clean(text) {
    return text.replace(/https?:\/\/[^\s<>"']+/gi, candidate => {
      try {
        const url = new URL(candidate);
        const host = url.hostname.toLowerCase();
        if (host === 'x.com' || host.endsWith('.x.com') ||
            host === 'twitter.com' || host.endsWith('.twitter.com')) {
          return candidate.split('?')[0];
        }
      } catch { /* Leave malformed URLs alone. */ }
      return candidate;
    });
  }

  // Intercept the clipboard API used by X's Copy link action.
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = text => original(stripTrackingLinks?clean(String(text)):text);
  }

  // Also handle ordinary text copied from the page and legacy copy actions.
  document.addEventListener('copy', event => {
    if(!stripTrackingLinks)return;
    if (!event.clipboardData) return;
    const supplied = event.clipboardData.getData('text/plain');
    const selected = window.getSelection()?.toString() || '';
    const text = supplied || selected;
    const cleaned = clean(text);
    if (cleaned !== text) {
      event.clipboardData.setData('text/plain', cleaned);
      event.preventDefault();
    }
  });
})();
