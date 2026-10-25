import sharp from 'sharp';
const supported=new Set(['png','jpeg','webp']);
export async function decodeReference(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>20*1024*1024)throw Error('参考图片为空或超过20MiB');
 const png=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!png&&!jpg&&!webp)throw Error('仅接受真实PNG/JPEG/WebP文件，不信任扩展名或MIME');
 const image=sharp(bytes,{failOn:'warning',limitInputPixels:4096*4096});
 const meta=await image.metadata();if(!supported.has(meta.format)||!meta.width||!meta.height||meta.width>4096||meta.height>4096||(meta.pages||1)!==1)throw Error('仅支持4096x4096以内的静态PNG/JPEG/WebP');
 // Decode every pixel; metadata alone cannot validate a downloaded image.
 const {data,info}=await image.rotate().toColorspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const normalized=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 let transparent=false;for(let i=3;i<data.length;i+=4)if(data[i]<255){transparent=true;break;}
 return{png:normalized,info:{format:meta.format,original_width:meta.width,original_height:meta.height,width:info.width,height:info.height,decoded:true,normalized_format:'png',has_transparent_pixels:transparent},extension:meta.format==='jpeg'?'jpg':meta.format};
}
