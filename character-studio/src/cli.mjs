import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditCorpus,planResearch,compilePortrait,auditEvaluation,template} from './core.mjs';
import {fixture,fullFixture,evaluationFixture,clone} from '../examples/fixtures.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [command='help',input,output]=process.argv.slice(2);
const load=async p=>JSON.parse((await readFile(resolve(p),'utf8')).replace(/^\uFEFF/,''));
if(command==='demo'){
 const data=fixture();data.sources[0].access='search_snippet';data.claims[0].conditions=[{statement:'无证据的额外条件',evidence_ids:[]}];
 const corpus=auditCorpus(data),plan=planResearch({spec:data.spec,corpus:data,remaining_queries:12,max_queries:12}),good=auditCorpus(fullFixture());
 const badEval=evaluationFixture();badEval.cases[1].reference_required_fact_ids=['heldout-secret'];badEval.previously_exposed_test_scene_ids=[badEval.cases[0].scene_id];badEval.repetitions=1;badEval.judge_model=badEval.actor_model;badEval.calibration={};
 const checks={corpus,plan,well_formed_synthetic_control:good,evaluation:auditEvaluation({plan:badEval}),warning:'所有示例为虚构工程夹具，不是实抓角色资料，也不证明真实抓取精度提升。'};
 await mkdir(resolve(ROOT,'examples/output'),{recursive:true});
 await writeFile(resolve(ROOT,'examples/corpus.example.json'),JSON.stringify(fullFixture(),null,2));
 await writeFile(resolve(ROOT,'examples/evaluation.example.json'),JSON.stringify(evaluationFixture(),null,2));
 await writeFile(resolve(ROOT,'examples/output/audit-demo.json'),JSON.stringify(checks,null,2));
 const md='# 通用采集审计示例（全部为虚构夹具）\n\n本示例用于展示诊断，不代表真实人物的完整度，也没有调用模型。\n\n## 材料缺口\n\n|维度|状态|独立场景|缺少的情境|\n|---|---|---:|---|\n'+corpus.coverage.map(c=>`|${c.name}|${c.status}|${c.independent_scenes??'—'}|${c.missing_situations?.join(', ')||'—'}|`).join('\n')+'\n\n## 被阻止进入运行画像的结论\n\n'+corpus.claim_results.map(c=>`- ${c.id}：${c.issues.map(i=>i.code+'：'+i.detail).join('；')}`).join('\n')+'\n\n## 评测计划的问题\n\n'+checks.evaluation.issues.map(i=>`- ${i.code}：${i.detail}`).join('\n')+'\n\n## 下一轮定向采集\n\n'+plan.queries.map(q=>`- ${q.dimension}：${q.query}`).join('\n')+'\n\n没有输出总体“全面度百分比”。未找到资料不等于角色没有该特征。\n';
 await writeFile(resolve(ROOT,'examples/output/通用审计示例.md'),md,'utf8');
 console.log(JSON.stringify({mode:'synthetic_demo',blocked_claims:corpus.claim_results.filter(c=>!c.runtime_eligible).length,evaluation_issues:checks.evaluation.issues.length,network_calls:0,output:resolve(ROOT,'examples/output')}));
}else if(['audit','plan','compile','evaluation'].includes(command)){
 if(!input)throw Error('缺少输入JSON路径');const x=await load(input);let result;
 if(command==='audit')result=auditCorpus(x);if(command==='plan')result=planResearch(x);if(command==='compile')result=compilePortrait({corpus:x});if(command==='evaluation')result=auditEvaluation({plan:x});
 if(output)await writeFile(resolve(output),JSON.stringify(result,null,2),'utf8');else console.log(JSON.stringify(result,null,2));
}else if(command==='template')console.log(JSON.stringify(template(),null,2));
else console.log('node src/cli.mjs demo | template | audit <corpus.json> [report.json] | plan <plan-input.json> [report.json] | compile <corpus.json> | evaluation <plan.json>');
