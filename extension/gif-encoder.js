// SPDX-License-Identifier: GPL-3.0-only
// Small GIF89a encoder. RGB332 global palette; bounded 9-bit LZW literal runs.
// Clear codes keep the dictionary below its code-width transition boundary.
globalThis.XflushxGifWriter=class {
 constructor(width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>320||height>320)throw Error('Invalid GIF dimensions.');
  this.width=width;this.height=height;this.parts=[];this.size=0;
  const header=new Uint8Array(13+768);header.set([71,73,70,56,57,97,width&255,width>>8,height&255,height>>8,247,0,0]);
  for(let i=0;i<256;i++){header[13+i*3]=Math.round((i>>5)*255/7);header[14+i*3]=Math.round(((i>>2)&7)*255/7);header[15+i*3]=(i&3)*85;}
  this.add(header);this.add(Uint8Array.from([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]));
 }
 add(bytes){this.size+=bytes.length;if(this.size>25*1024*1024)throw Error('GIF exceeds 25 MB. Save the original video instead.');this.parts.push(bytes);}
 frame(rgba,delay=10){
  const pixels=this.width*this.height;if(rgba.length!==pixels*4)throw Error('Invalid GIF frame.');
  const data=new Uint8Array(Math.ceil((pixels+Math.ceil(pixels/200)+2)*9/8)+2);let pos=0,bits=0,value=0;
  function code(c){value|=c<<bits;bits+=9;while(bits>=8){data[pos++]=value&255;value>>>=8;bits-=8;}}
  code(256);for(let i=0;i<pixels;i++){if(i&&i%200===0)code(256);const p=i*4;code((rgba[p]&224)|((rgba[p+1]&224)>>3)|(rgba[p+2]>>6));}code(257);if(bits)data[pos++]=value&255;
  this.add(Uint8Array.from([33,249,4,4,delay&255,delay>>8,0,0,44,0,0,0,0,this.width&255,this.width>>8,this.height&255,this.height>>8,0,8]));
  for(let i=0;i<pos;i+=255){const block=data.subarray(i,Math.min(i+255,pos));this.add(Uint8Array.from([block.length]));this.add(block);}
  this.add(Uint8Array.from([0]));
 }
 finish(){this.add(Uint8Array.from([59]));const bytes=new Uint8Array(this.size);let at=0;for(const p of this.parts){bytes.set(p,at);at+=p.length;}return bytes;}
};
