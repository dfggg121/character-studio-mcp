import {digest,DIMENSIONS} from '../src/core.mjs';
export const clone=x=>structuredClone(x);
export const review={status:'supported',method:'human',assessor:'synthetic-fixture-author',reason:'仅用于工程回归，不是人物真实性认证'};
export function fixture(){
 const spec={character_id:'fiction:lampkeeper',work:'虚构测试作品',name:'巡灯人甲',continuity:'main',branch:'shared',strict_story:true,stage_order:2,capabilities:['text']};
 const scope={character_id:spec.character_id,continuity:'main',branch:'shared',stage_order:1};
 const sources=[1,2].map(n=>{const body=`虚构场景${n}：巡灯人先核对同行者的灯盏，再出发。情况不同，仍先确认大家能看清道路。`;return{id:'s'+n,url:`https://example.org/script/${n}`,origin_id:'original-scene-'+n,body,sha256:digest(body),access:'body',kind:'official_script',retrieved_at:'2026-10-25'};});
 const evidence=sources.map((s,i)=>({id:'e'+(i+1),source_id:s.id,dimension:'behavior',scene_id:'scene-'+i,scene_mode:'canon',scope:clone(scope),locator:'虚构段落1',start:0,end:s.body.length,quote:s.body,situations:['risk','routine','conflict','benefit'],entailment:clone(review)}));
 const claims=[{id:'c1',type:'stable_trait',statement:'在出行准备中倾向于先确认同行者的照明条件。',scope:clone(scope),evidence_ids:['e1','e2'],conditions:[],counter_evidence_ids:[],entailment:clone(review)}];
 return{spec,sources,evidence,claims,waivers:[]};
}
export function fullFixture(){
 const f=fixture();f.sources=[];f.evidence=[];f.claims=[];
 for(const d of DIMENSIONS.filter(d=>!d.capability))for(let i=0;i<d.min;i++){
  const body=`虚构测试材料：${d.id}情境${i}。这是一段专为检查证据结构编写的内容，不是真实人物资料。`;
  const sid=`s-${d.id}-${i}`,eid=`e-${d.id}-${i}`;
  f.sources.push({id:sid,url:`https://example.org/${d.id}/${i}`,origin_id:`origin-${d.id}-${i}`,body,sha256:digest(body),access:'body',kind:'official_script',retrieved_at:'2026-10-25'});
  f.evidence.push({id:eid,source_id:sid,dimension:d.id,scene_id:`scene-${d.id}-${i}`,scene_mode:'canon',scope:{character_id:f.spec.character_id,continuity:'main',branch:'shared',stage_order:1},locator:'测试段落',start:0,end:body.length,quote:body,situations:d.situations,entailment:clone(review)});
 }
 const bs=f.evidence.filter(e=>e.dimension==='behavior');f.claims=[{id:'c1',type:'stable_trait',statement:'仅用于演示结构检查的行为倾向。',scope:clone(bs[0].scope),evidence_ids:bs.map(e=>e.id),conditions:[],counter_evidence_ids:[],entailment:clone(review)}];return f;
}
export function evaluationFixture(){return{persona_frozen_hash:'fixture-hash',rubric_frozen_hash:'fixture-rubric',coordinator_seen_holdout:false,extraction_scene_ids:['train'],extraction_origin_ids:['train-origin'],previously_exposed_test_scene_ids:[],repetitions:2,memory:false,retrieval:false,actor_model:'actor-A',judge_model:'judge-B',variants:['generic','name_only','persona_named','persona_anonymous','wrong_persona'],calibration:{order_swap_checked:true,same_answer_consistency_checked:true},cases:['fact_recall','personality_transfer','language_style','immersion','multi_turn'].map((track,i)=>({id:'q'+i,scene_id:'test-'+i,origin_id:'test-origin-'+i,track,context_type:'synthetic_scenario',provided_fact_ids:['fact1'],reference_required_fact_ids:['fact1'],reference_verified:true}))};}
