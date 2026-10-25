import {inflateSync} from 'node:zlib';
export function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
export function inspectPng(b){
 if(!Buffer.isBuffer(b)||b.length>20*1024*1024||!b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('无效PNG或超过20MiB');
 let offset=8,width,height,ended=false;const data=[];
 while(offset+12<=b.length){const len=b.readUInt32BE(offset);if(len>b.length-offset-12)throw Error('PNG截断');const name=b.toString('ascii',offset+4,offset+8),payload=b.subarray(offset+8,offset+8+len);if(crc32(b.subarray(offset+4,offset+8+len))!==b.readUInt32BE(offset+8+len))throw Error('PNG CRC错误');
  if(!width&&name!=='IHDR')throw Error('PNG缺少首部');
  if(name==='IHDR'){if(width||len!==13)throw Error('PNG首部错误');width=payload.readUInt32BE(0);height=payload.readUInt32BE(4);if(!width||!height||width>4096||height>4096||payload[8]!==8||payload[9]!==6||payload[10]||payload[11]||payload[12])throw Error('仅支持最多4096x4096、8位RGBA、非交错PNG');}
  else if(name==='IDAT')data.push(payload);
  else if(name==='IEND'){if(len!==0)throw Error('PNG尾部错误');ended=true;offset+=12;break;}
  else if(!/^[a-z]/.test(name))throw Error('不支持的关键PNG块');
  offset+=len+12;
 }
 if(!ended||offset!==b.length||!data.length)throw Error('PNG不完整或有额外数据');
 const stride=width*4,raw=inflateSync(Buffer.concat(data),{maxOutputLength:(stride+1)*height});if(raw.length!==(stride+1)*height)throw Error('PNG像素长度错误');
 let prev=Buffer.alloc(stride),transparent=false;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const f=raw[y*(stride+1)];if(f>4)throw Error('PNG滤波器错误');const row=Buffer.alloc(stride);for(let x=0;x<stride;x++){const a=x>=4?row[x-4]:0,up=prev[x],c=x>=4?prev[x-4]:0;row[x]=(raw[y*(stride+1)+x+1]+[0,a,up,Math.floor((a+up)/2),paeth(a,up,c)][f])&255;if(x%4===3&&row[x]<255)transparent=true;}prev=row;}
 return{format:'png',width,height,color_type:'RGBA8',has_transparent_pixels:transparent,decoded:true};
}
