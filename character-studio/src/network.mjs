import {lookup} from 'node:dns/promises';
import https from 'node:https';
import {isIP} from 'node:net';
export function isPublicAddress(ip){
 if(isIP(ip)===4){const n=ip.split('.').map(Number);return !(n[0]===0||n[0]===10||n[0]===127||n[0]>=224||(n[0]===169&&n[1]===254)||(n[0]===172&&n[1]>=16&&n[1]<=31)||(n[0]===192&&(n[1]===168||n[1]===0||n[1]===2))||(n[0]===100&&n[1]>=64&&n[1]<=127)||(n[0]===198&&(n[1]===18||n[1]===19||n[1]===51))||(n[0]===203&&n[1]===0));}
 // Only globally allocated IPv6 unicast; reject mapped IPv4 and documentation ranges.
 return isIP(ip)===6&&/^[23]/i.test(ip)&&!/^2001:(db8|0:|2:)/i.test(ip);
}
export function publicUrl(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||isIP(u.hostname.replace(/^\[|\]$/g,''))||u.hostname==='localhost'||u.hostname.endsWith('.local'))throw Error('仅允许无凭据的公开HTTPS域名，端口443');return u;}
export async function fetchPublic(raw,{maxBytes=2*1024*1024,redirects=3,headers={},timeoutMs=20000}={}){
 const u=publicUrl(raw);const addresses=await lookup(u.hostname,{all:true});
 if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw Error('来源解析到非公开地址');
 const a=addresses[0];
 const result=await new Promise((resolve,reject)=>{
  const req=https.get(u,{headers:{'user-agent':'CharacterStudio/0.5 (+evidence research)','accept-encoding':'identity',...headers},lookup:(_host,_opts,cb)=>_opts.all?cb(null,[a]):cb(null,a.address,a.family)},res=>{
   const chunks=[];let size=0;res.on('data',c=>{size+=c.length;if(size>maxBytes){req.destroy(Error('响应超过大小限制'));return;}chunks.push(c);});
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));res.on('error',reject);
  });req.setTimeout(timeoutMs,()=>req.destroy(Error('网络请求超时')));req.on('error',reject);
 });
 if([301,302,303,307,308].includes(result.status)){
  if(!redirects||!result.headers.location)throw Error('重定向次数超过限制');
  // Never forward authentication to a redirected origin.
  return fetchPublic(new URL(result.headers.location,u).href,{maxBytes,redirects:redirects-1,timeoutMs});
 }
 if(result.status!==200)throw Error(`来源HTTP ${result.status}`);
 if(result.headers['content-encoding']&&result.headers['content-encoding']!=='identity')throw Error('不支持压缩响应，请使用可访问的原始来源');
 return {...result,url:u.href};
}
export function extractText(html){return html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<\/(p|div|h[1-6]|li|tr)>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}

export function decodeSource(bytes,contentType=''){
 const head=bytes.subarray(0,8192).toString('latin1');
 const declared=/charset\s*=\s*["']?\s*([A-Za-z0-9_-]+)/i.exec(contentType)?.[1]||/<meta[^>]+charset\s*=\s*["']?\s*([A-Za-z0-9_-]+)/i.exec(head)?.[1]||'utf-8';
 let decoder;try{decoder=new TextDecoder(declared,{fatal:true});}catch{throw Error('不支持的正文字符集');}
 try{return{text:decoder.decode(bytes),encoding:decoder.encoding};}catch{throw Error('正文字符解码失败，不能保存乱码为可靠证据');}
}

export function discoverImages(html,base){const images=[];for(const tag of html.match(/<img\b[^>]*>/gi)||[]){const src=/(?:^|\s)(?:src|data-src)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];if(!src)continue;try{const url=new URL(src.replaceAll('&amp;','&'),base);publicUrl(url.href);const alt=/\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]||'';if(!images.some(x=>x.url===url.href))images.push({url:url.href,alt:alt.slice(0,160),verified_character_image:false});}catch{}if(images.length>=24)break;}return images;}
