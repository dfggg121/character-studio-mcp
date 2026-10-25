import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRuntime} from '../src/runtime.mjs';
import {isPublicAddress,publicUrl,extractText} from '../src/network.mjs';
import {inspectPng} from '../src/png.mjs';
import {png} from './png-fixture.mjs';
import {fullFixture,clone,review} from '../examples/fixtures.mjs';
import {VISUAL_FIELDS} from '../src/visual.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function sandbox(t){const parent=resolve('artifacts');await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'character-studio-test-'));t.after(async()=>{const p=resolve(root);assert.ok(p.startsWith(parent+'\\character-studio-test-')||p.startsWith(parent+'/character-studio-test-'));await rm(p,{recursive:true,force:true});});return root;}
function input(path,bytes){const corpus=fullFixture(),scope=clone(corpus.spec);return{corpus,visual:{scope,references:[{id:'r1',url:'https://example.org/official.png',kind:'official_art',scope:clone(scope),sha256:hash(bytes),local_path:path,locator:'合成测试图',retrieved_at:'2026-10-25',visual_review:clone(review)}],features:VISUAL_FIELDS.map((field,i)=>({id:'v'+i,field,description:'合成特征 '+field,reference_ids:['r1'],entailment:clone(review),conflict_status:'resolved'}))}};}
const pass={status:'pass',method:'human',assessor:'synthetic-fixture',reason:'仅测试结构，非真实角色验收'};
for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.2','192.168.1.2','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1'])test('阻断非公开地址 '+ip,()=>assert.equal(isPublicAddress(ip),false));
for(const url of ['http://example.org','https://user:pass@example.org','https://localhost','https://127.0.0.1','https://example.org:8080','file:///etc/passwd'])test('拒绝不安全来源 '+url,()=>assert.throws(()=>publicUrl(url)));
test('接受公开HTTPS与公网DNS地址',()=>{assert.equal(publicUrl('https://example.org/a').hostname,'example.org');assert.equal(isPublicAddress('8.8.8.8'),true);assert.equal(isPublicAddress('2606:4700::1111'),true);});
test('正文移除脚本但不假装完成语义净化',()=>{assert.equal(extractText('<script>bad()</script><p>人物 &amp; 对白</p>'),'人物 & 对白');});
for(let filter=0;filter<5;filter++)test('实际解码PNG滤波器 '+filter,()=>assert.equal(inspectPng(png({filter})).decoded,true));
test('PNG损坏CRC与截断被拒绝',()=>{const b=png();b[30]^=1;assert.throws(()=>inspectPng(b));assert.throws(()=>inspectPng(png().subarray(0,30)));});
test('PNG无透明像素被识别',()=>assert.equal(inspectPng(png({alpha:255})).has_transparent_pixels,false));
test('默认关闭联网',async t=>{const rt=createRuntime({root:await sandbox(t),network:false});await assert.rejects(rt.capture_source({url:'https://example.org'}),/未启用/);});
test('真实文件闭环：快照、参考图、保存、验收、导出及篡改拦截',async t=>{
 const root=await sandbox(t),rt=createRuntime({root,network:true,fetcher:async url=>({url,headers:{'content-type':url.endsWith('.png')?'image/png':'text/html'},bytes:url.endsWith('.png')?png():Buffer.from('<p>合成对白</p>')})});
 const source=await rt.capture_source({url:'https://example.org/source',kind:'official_script'});assert.equal(source.body,'合成对白');assert.equal(source.sha256,hash(source.body));assert.equal(source.classification_verified,false);
 const ref=await rt.capture_reference({url:'https://example.org/ref.png',id:'ref'});const args=input(ref.local_path,await readFile(ref.local_path));const saved=await rt.save_character_bundle(args);assert.equal(saved.saved,true);
 const image=join(root,'generated.png');await writeFile(image,png());const request={bundle_id:saved.bundle_id,image_path:image,backend:'synthetic-fixture-not-real-generation',feature_reviews:args.visual.features.map(f=>({...pass,feature_id:f.id})),persona_review:pass};
 const bad=await rt.audit_generated_image({...request,feature_reviews:[]});assert.equal(bad.accepted,false);await assert.rejects(rt.export_character({bundle_id:saved.bundle_id}),/未通过/);
 const good=await rt.audit_generated_image(request);assert.equal(good.accepted,true);const exported=await rt.export_character({bundle_id:saved.bundle_id});assert.equal(exported.manifest.runtime_memory_included,false);assert.equal(exported.manifest.desktop_pet_ready,false);const persona=await readFile(join(root,'exports',saved.bundle_id,'persona.json'),'utf8');assert.ok(!persona.includes('private.references'));
 await writeFile(join(root,'results',saved.bundle_id+'.png'),png({alpha:255}));await assert.rejects(rt.export_character({bundle_id:saved.bundle_id}),/修改/);
});
test('参考图被篡改不能保存角色包',async t=>{const root=await sandbox(t),p=join(root,'ref.png');await writeFile(p,png({alpha:255}));await assert.rejects(createRuntime({root}).save_character_bundle(input(p,png())),/哈希/);});
test('数据目录之外的参考图不能读取',async t=>{const root=await sandbox(t),outer=await sandbox(t),p=join(outer,'ref.png');await writeFile(p,png());await assert.rejects(createRuntime({root}).save_character_bundle(input(p,png())),/越出/);});
test('引用目录链接不能越界读图',async t=>{const root=await sandbox(t),outer=await sandbox(t);await writeFile(join(outer,'ref.png'),png());try{await symlink(outer,join(root,'link'),process.platform==='win32'?'junction':'dir');}catch(e){if(e.code==='EPERM'){t.skip('环境禁止创建目录链接；Linux CI覆盖');return;}throw e;}await assert.rejects(createRuntime({root}).save_character_bundle(input(join(root,'link','ref.png'),png())),/越出/);});
test('ID不能用路径遍历创建文件',async t=>{const rt=createRuntime({root:await sandbox(t),network:true});await assert.rejects(rt.capture_reference({url:'https://example.org/ref.png',id:'../secret'}),/ID/);});
