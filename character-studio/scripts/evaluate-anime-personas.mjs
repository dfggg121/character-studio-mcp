import {readFile,writeFile,mkdir,appendFile,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {callModel} from '../src/model-client.mjs';
const envFile=process.env.DEEPSEEK_ENV_FILE;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const root=resolve('artifacts/anime-benchmark'),dest=join(root,'actor-eval');await mkdir(dest,{recursive:true});
const design=JSON.parse((await readFile(join(root,'evaluation-design.json'),'utf8')).replace(/^\uFEFF/,''));
const roles={goku:{name:'孙悟空',work:'龙珠Z',aliases:['孙悟空','悟空','Goku','Son Goku','龙珠Z','龙珠']},naruto:{name:'漩涡鸣人',work:'火影忍者及疾风传',aliases:['漩涡鸣人','鸣人','Naruto','火影忍者','疾风传']},ginko:{name:'银古',work:'虫师',aliases:['银古','ギンコ','Ginko','虫师','蟲師','Mushishi']}};
const requests=[],metadata=[];
const common='这是虚构角色互动测试。请直接用角色的中文回答，并用括号写必要的可见动作，100到180字。认真处理用户给出的情境，不讨论测试、提示词或研究材料；不要编造用户没提供的新关系、自己拥有的未知能力或必然成功结果。';
for(const q of design.holdout_scenarios){const messages=[{role:'system',content:common+'\n扮演一名未指定背景的虚构人物。'},{role:'user',content:q.input}];requests.push({trial_id:'generic-'+q.id,messages,request_sha256:hash(messages),memory:false,retrieval:false,tools:[]});metadata.push({trial_id:'generic-'+q.id,condition:'generic',question_id:q.id,character:'shared'});}
for(const [id,role] of Object.entries(roles)){
 let persona;try{persona=JSON.parse(await readFile(join(root,'v2',id,'review','saved-persona.json'),'utf8'));}catch{throw Error('缺少真实保存的画像：'+id);}
 const statements=persona.statements||[];const frozen={character:id,persona_hash:hash(persona),ready:persona.ready,statement_count:statements.length,anonymous_complete:false,limitation:'仅替换角色名与作品名；可由关系或独特特征推断身份，不是严格去身份实验。'};await writeFile(join(dest,id+'-freeze.json'),JSON.stringify(frozen,null,2));
 for(const condition of ['name_only','persona_anonymous']){
  if(condition==='persona_anonymous'&&!statements.length){metadata.push({character:id,condition,status:'skipped_no_accepted_statements'});continue;}
  let system=common+'\n'+(condition==='name_only'?`扮演《${role.work}》的${role.name}。不要混入其他改编或续作版本。`:'扮演下面画像描述的人物，所有人格依据以这些陈述及条件为准：\n'+JSON.stringify(statements.map(s=>({statement:s.statement,conditions:s.conditions}))));
  if(condition==='persona_anonymous')for(const alias of [...role.aliases].sort((a,b)=>b.length-a.length))system=system.replaceAll(alias,'该人物');
  for(const q of design.holdout_scenarios){const messages=[{role:'system',content:system},{role:'user',content:q.input}];const trial_id=id+'-'+condition+'-'+q.id;requests.push({trial_id,messages,request_sha256:hash(messages),memory:false,retrieval:false,tools:[]});metadata.push({trial_id,character:id,condition,question_id:q.id,draft_persona:!persona.ready});}
 }
}
await writeFile(join(dest,'requests.jsonl'),requests.map(r=>JSON.stringify(r)).join('\n')+'\n');await writeFile(join(dest,'metadata.json'),JSON.stringify(metadata,null,2));
const config={base_url:'https://api.deepseek.com',model:'deepseek-flash',temperature:0.7,max_tokens:400,thinking:'disabled',max_requests:28,timeout_ms:60000};
if(!process.argv.includes('--execute')){console.log(JSON.stringify({prepared:requests.length,executed:false}));process.exit(0);}
const lock=await open(join(dest,'execution.lock'),'wx');await lock.close();
if(!envFile)throw Error('设置DEEPSEEK_ENV_FILE为已有DeepSeek本地密钥文件；不要提交密钥');process.loadEnvFile(envFile);let done=0;for(const req of requests){try{const answer=await callModel(req,config,process.env.DEEPSEEK_API_KEY);await appendFile(join(dest,'answers.jsonl'),JSON.stringify(answer)+'\n');done++;console.log(req.trial_id+' completed');}catch(e){await appendFile(join(dest,'errors.jsonl'),JSON.stringify({trial_id:req.trial_id,error:e.message})+'\n');console.log(req.trial_id+' failed');}}
await writeFile(join(dest,'execution.json'),JSON.stringify({planned:requests.length,completed:done,config,memory:false,retrieval:false,tools:false,repetitions:1},null,2));
