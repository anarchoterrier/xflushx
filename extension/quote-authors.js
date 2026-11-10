// SPDX-License-Identifier: GPL-3.0-only
// Compact quote cards may expose an author as plain text, not a profile link.
globalThis.xflushxQuoteAuthors=()=>{
 const found=[];
 for(const node of document.querySelectorAll('[data-testid="quoteTweet"],[data-testid="quotedTweet"],article [role="link"]')){
  if(!node.querySelector('img[src*="/profile_images/"],img[src*="/default_profile_images/"]'))continue;
  // Require a dedicated @handle span in the avatar/header area. Never derive
  // account identity from a display name, body mention, or quoted status ID.
  const spans=[...node.querySelectorAll('span')];
  const handleSpan=spans.find(span=>/^@[A-Za-z0-9_]{1,15}$/.test(span.textContent.trim())&&span.closest('[data-testid="tweetText"]')===null);
  if(!handleSpan)continue;
  const handle=handleSpan.textContent.trim().slice(1).toLowerCase();
  const before=spans.slice(0,spans.indexOf(handleSpan));
  const name=before.find(span=>span.textContent.trim()&&!span.hasAttribute('data-xflushx-location'));
  found.push({node,handle,name});
 }
 return found;
};
