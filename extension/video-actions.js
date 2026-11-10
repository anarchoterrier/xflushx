// SPDX-License-Identifier: GPL-3.0-only
function validVideoUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='video.twimg.com'&&!u.username&&!u.password&&!u.port&&/^\/(?:ext_tw_video|amplify_video|tweet_video)\/[^?#]+\.mp4$/i.test(u.pathname);}catch{return false;}
}
function collectPostVideos(data){
 const pending=[data],visited=new Set(),unique=new Map();let budget=12;
 while(pending.length&&budget-->0){
  const post=pending.shift();if(!post||typeof post!=='object'||visited.has(post))continue;visited.add(post);
  for(const media of post.mediaDetails||[]){
   if(!['video','animated_gif'].includes(media.type))continue;
   const urls=(media.video_info?.variants||[]).filter(v=>v.content_type==='video/mp4'&&validVideoUrl(v.url)).map(v=>v.url).sort();
   const key=urls.join('|')||media.media_url_https||media;if(!unique.has(key))unique.set(key,media);
  }
  // A reply's parent is unrelated to the clicked player. Only descend quotes.
  if(post.quoted_tweet)pending.push(post.quoted_tweet);
 }
 return [...unique.values()];
}
async function videoAction(message){
 const settings=await chrome.storage.local.get({restoreImageMenu:false});if(!settings.restoreImageMenu)throw Error('Photo actions menu is disabled.');
 if(message.type==='video-save'){
  if(!validVideoUrl(message.url))throw Error('No downloadable MP4 source is available for this video.');
  await chrome.downloads.download({url:message.url,filename:'xflushx-video.mp4',saveAs:true});return {ok:true};
 }
 if(typeof message.postId!=='string'||!/^\d{1,25}$/.test(message.postId))throw Error('Invalid post ID.');
 const response=await fetch('https://cdn.syndication.twimg.com/tweet-result?'+new URLSearchParams({id:message.postId,token:'0'}),{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Video source lookup failed: HTTP '+response.status);
 const data=await response.json();
 let media=collectPostVideos(data);
 // Match a specific poster for posts containing multiple media items.
 if(typeof message.poster==='string'&&message.poster){try{const path=new URL(message.poster).pathname;const matching=media.filter(m=>{try{return new URL(m.media_url_https).pathname===path;}catch{return false;}});if(matching.length)media=matching;}catch{}}
 if(!media.length)throw Error('No video metadata is available for this post or its quoted posts.');
 if(media.length!==1)throw Error('This post contains multiple videos and the player thumbnail did not identify one. Play it first, then right-click directly on the player.');
 const variants=(media[0].video_info?.variants||[]).filter(v=>v.content_type==='video/mp4'&&validVideoUrl(v.url)).sort((a,b)=>(Number(b.bitrate)||0)-(Number(a.bitrate)||0));
 if(!variants.length)throw Error('X did not expose a downloadable MP4 for this video. Live or stream-only videos are not supported.');
 return {url:variants[0].url,type:media[0].type};
}
