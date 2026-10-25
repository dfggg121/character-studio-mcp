// Public releases contain portable code, synthetic fixtures and documentation only.
const blockedSegments=new Set(['artifacts','reports','node_modules','.character-studio','.git','coverage','dist']);
export function assertPublicFile(path,bytes){
 const parts=path.replaceAll('\\','/').split('/');
 if(parts.some(p=>blockedSegments.has(p)||/^\.env(?:\.|$)/i.test(p))||parts.some(p=>p==='..')||/\.(?:log|pem|pfx|key|sqlite|db|png|jpe?g|webp|zip)$/i.test(path))throw Error('Public release excludes local data: '+path);
 const s=Buffer.from(bytes).toString('utf8');
 const patterns=[
  ['credential',/\b(?:sk|ghp|github_pat)-[A-Za-z0-9_-]{20,}/],
  ['github credential',/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/],
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['personal home path',/(?:[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]|\/(?:home|Users)\/)[^\s<>"']+/i],
  ['machine installation path',/(?<![A-Za-z0-9])[A-Za-z]:[\\/](?:Codex|deepseek harness|Program Files|AppData)[\\/]/i],
  ['tracked share link',/[?&](?:vd_source|share_source)=/i],
  ['assigned credential',/(?:api[_-]?key|access[_-]?token|password)\s*[=:]\s*["'][A-Za-z0-9_+-]{24,}["']/i],
 ];
 for(const [category,pattern] of patterns)if(pattern.test(s))throw Error('Privacy check failed ('+category+'): '+path);
}
