import {createHash} from 'node:crypto';
export const VERSION='0.6.0';
export const digest=s=>createHash('sha256').update(s).digest('hex');
const ok=(v,m)=>{if(!v)throw new Error(m);};
const arr=(v,n)=>{ok(Array.isArray(v)&&v.length<=5000,`${n}须为数组且不超过5000项`);return v;};
const text=(v,n)=>{ok(typeof v==='string'&&v.trim(),`${n}须为非空字符串`);return v;};
export const DIMENSIONS=[
 {id:'identity',name:'身份与版本',min:1,situations:[],priority:0},
 {id:'motivation',name:'动机与内在矛盾',min:2,situations:['routine','pressure'],priority:1},
 {id:'values',name:'价值观与底线',min:2,situations:['conflict','refusal'],priority:1},
 {id:'history',name:'经历与变化',min:1,situations:[],priority:1},
 {id:'relationships',name:'关系差异',min:2,situations:['stranger','familiar'],priority:1},
 {id:'language',name:'情境化语言',min:2,situations:['routine','pressure','serious'],priority:1},
 {id:'behavior',name:'行为选择与代价',min:2,situations:['benefit','risk','conflict'],priority:1},
 {id:'knowledge_limits',name:'认知边界',min:1,situations:[],priority:0},
 {id:'daily',name:'日常生活',min:1,situations:['routine'],priority:2},
 {id:'counterexamples',name:'反例与矛盾',min:1,situations:[],priority:1},
 {id:'visual',name:'外观与动作',min:1,situations:[],priority:2,capability:'visual'},
 {id:'voice',name:'声音与节奏',min:1,situations:[],priority:2,capability:'voice'}
];
export const SITUATIONS=['routine','pressure','conflict','refusal','stranger','familiar','serious','benefit','risk'];
const substantive=new Set(['official_script','game_transcript','wiki_transcript']);
const factKinds=new Set(['official_script','game_transcript','wiki_transcript','official_profile','official_canon_excerpt']);
const claimTypes=new Set(['fact','observation','stable_trait','conditional_trait','hypothesis','synthetic']);
const issue=(code,detail,severity='blocker')=>({code,detail,severity});
export function canonicalUrl(raw){try{const u=new URL(raw);ok(['https:','http:'].includes(u.protocol),'URL协议无效');u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(share_source|vd_source|spm_id_from)$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{throw new Error('无效的公开来源URL');}}
function unique(items,key){const seen=new Set();for(const x of items){text(x?.[key],key);ok(!seen.has(x[key]),`重复${key}：${x[key]}`);seen.add(x[key]);}}
function scopeIssue(scope,spec){
 if(!scope||scope.character_id!==spec.character_id)return 'wrong_character';
 if(scope.continuity!==spec.continuity)return 'wrong_continuity';
 if(scope.branch&&scope.branch!=='shared'&&scope.branch!==spec.branch)return 'wrong_branch';
 if(spec.strict_story&&( !Number.isInteger(scope.stage_order)||scope.stage_order>spec.stage_order))return 'outside_story_stage';
 return null;
}
function reviewValid(r){return r&&r.status==='supported'&&['human','model'].includes(r.method)&&typeof r.assessor==='string'&&r.assessor.trim()&&typeof r.reason==='string'&&r.reason.trim();}
export function validateSpec(spec){
 ok(spec&&typeof spec==='object','缺少spec');text(spec.character_id,'character_id');text(spec.work,'work');text(spec.name,'name');text(spec.continuity,'continuity');
 if(spec.review_policy!==undefined)ok(['independent','legacy'].includes(spec.review_policy),'未知review_policy');
 ok(typeof spec.strict_story==='boolean','必须声明strict_story');if(spec.strict_story)ok(Number.isInteger(spec.stage_order)&&spec.stage_order>=0,'严格剧情需要非负stage_order');
 ok(Array.isArray(spec.capabilities)&&spec.capabilities.every(c=>['text','visual','voice'].includes(c))&&spec.capabilities.includes('text'),'能力必须包含text，可选visual/voice');
 return spec;
}
export function auditCorpus({spec,sources,evidence,claims=[],waivers=[]}){
 validateSpec(spec);arr(sources,'sources');arr(evidence,'evidence');arr(claims,'claims');arr(waivers,'waivers');unique(sources,'id');unique(evidence,'id');unique(claims,'id');unique(waivers,'dimension');
 const sourceMap=new Map(sources.map(s=>[s.id,s])), evidenceMap=new Map(evidence.map(e=>[e.id,e]));
 // 并查集归并转载链、规范URL和相同正文；不以页面数量充当独立来源。
 const parent=new Map(sources.map(s=>[s.id,s.id]));const root=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;};const union=(a,b)=>parent.set(root(a),root(b));
 for(let i=0;i<sources.length;i++)for(let j=i+1;j<sources.length;j++){
  const a=sources[i],b=sources[j];let same=false;
  try{same=canonicalUrl(a.url)===canonicalUrl(b.url);}catch{}
  if(a.origin_id&&a.origin_id===b.origin_id)same=true;
  if(a.body?.trim()&&b.body?.trim()&&digest(a.body)===digest(b.body))same=true;
  if(a.repost_of===b.id||b.repost_of===a.id)same=true;
  if(same)union(a.id,b.id);
 }
 const sourceResults=sources.map(s=>{const issues=[];try{canonicalUrl(s.url);}catch{issues.push(issue('invalid_url',s.id));}
  if(s.access!=='body')issues.push(issue('not_body_access','搜索摘要/标题或不可达页面仅可发现来源'));
  if(typeof s.body!=='string'||!s.body.trim())issues.push(issue('empty_body','无可定位正文'));
  else if(s.sha256!==digest(s.body))issues.push(issue('snapshot_hash_mismatch','正文指纹缺失或不匹配'));
  if(s.kind==='official_canon_excerpt'){
   const parentSource=sourceMap.get(s.parent_source_id);
   if(!parentSource||!['official_profile','official_script','official_promotion'].includes(parentSource.kind)||digest(parentSource.body||'')!==s.parent_sha256||parentSource.sha256!==s.parent_sha256||!Number.isInteger(s.parent_start)||s.parent_start<0||s.parent_end!==s.parent_start+s.body?.length||parentSource.body.slice(s.parent_start,s.parent_end)!==s.body)issues.push(issue('unverified_parent_excerpt','需要原始快照、哈希和精确片段定位'));
   if(!reviewValid(s.excerpt_review)||!s.canonical_unit_id||!['dialogue','scene_summary'].includes(s.excerpt_type))issues.push(issue('unreviewed_canon_excerpt','宣传页片段必须单独核实为原作对白/场景，不能整体洗成原作'));
  }
  if(['fanon','generated'].includes(s.kind))issues.push(issue('noncanonical_material','同人/生成内容不能证明原作事实'));
  if(typeof s.origin_id!=='string'||!s.origin_id.trim())issues.push(issue('missing_origin_identity','缺少原始内容来源标识，无法核对转载'));
  if(!s.retrieved_at)issues.push(issue('missing_retrieval_time','缺少获取时间'));
  return{id:s.id,family:root(s.id),usable:issues.length===0,kind:s.kind,issues};});
 const sr=new Map(sourceResults.map(s=>[s.id,s]));
 const evidenceResults=evidence.map(e=>{const s=sourceMap.get(e.source_id),issues=[];
  if(!s||!sr.get(e.source_id)?.usable)issues.push(issue('unusable_source','来源缺失或正文不可用'));
  if(!DIMENSIONS.some(d=>d.id===e.dimension))issues.push(issue('unknown_dimension',String(e.dimension)));
  if(typeof e.scene_id!=='string'||!e.scene_id.trim())issues.push(issue('missing_scene','没有场景ID，不能计入独立场景'));
  if(typeof e.locator!=='string'||!e.locator.trim())issues.push(issue('missing_locator','缺少章节/时间戳/段落定位'));
  const badScope=scopeIssue(e.scope,spec);if(badScope)issues.push(issue(badScope,'角色、世界线、分支或时间点不适用'));
  if(!['canon','dream','promotion','fanon'].includes(e.scene_mode))issues.push(issue('missing_scene_mode','必须区分现实剧情、梦境、宣传和同人'));
  if(!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end<=e.start||!s?.body||e.end>s.body.length||s.body.slice(e.start,e.end)!==e.quote)issues.push(issue('invalid_anchor','引文与正文偏移不匹配'));
  if(!reviewValid(e.entailment))issues.push(issue('semantic_review_required','需记录该证据实际支持什么的语义评审；定位匹配不等于支持结论'));
  if(!Array.isArray(e.situations)||e.situations.some(x=>!SITUATIONS.includes(x)))issues.push(issue('invalid_situations','情境标签无效'));
  const anchored=issues.length===0;
  const canonical=anchored&&e.scene_mode==='canon'&&factKinds.has(s.kind);
  return{id:e.id,anchor_key:s?root(s.id)+':'+((s.parent_start||0)+e.start)+':'+((s.parent_start||0)+e.end):null,source_id:e.source_id,family:s?root(s.id):null,scene_id:s?.canonical_unit_id||e.canonical_unit_id||e.scene_id,dimension:e.dimension,scene_mode:e.scene_mode,situations:e.situations||[],usable:anchored,canonical,primary:canonical&&['official_script','game_transcript','official_profile','official_canon_excerpt'].includes(s.kind),issues};
 });
 const er=new Map(evidenceResults.map(e=>[e.id,e]));
 const independentScenes=es=>Math.min(new Set(es.map(e=>e.scene_id)).size,new Set(es.map(e=>e.anchor_key)).size);
 const claimResults=claims.map(c=>{const issues=[];if(!claimTypes.has(c.type))issues.push(issue('invalid_claim_type','事实、观察、稳定倾向、条件倾向、假设和合成必须分开'));
  const badScope=scopeIssue(c.scope,spec);if(badScope)issues.push(issue(badScope,'结论范围不适用'));
  if(typeof c.statement!=='string'||!c.statement.trim())issues.push(issue('empty_claim','结论为空'));
  if(!Array.isArray(c.evidence_ids)||!c.evidence_ids.length)issues.push(issue('no_evidence','没有证据链'));
  const es=(c.evidence_ids||[]).map(id=>er.get(id));if(es.some(e=>!e||!e.usable))issues.push(issue('broken_evidence_chain','引用缺失或被拦截的证据'));
  if(['fact','stable_trait','conditional_trait'].includes(c.type)&&es.some(e=>!e?.canonical))issues.push(issue('noncanonical_support','梦境、宣传或同人不足以作为全局事实/稳定人格的依据'));
  if(c.type==='fact'&&(c.perspective!=='character_known'||!Array.isArray(c.knowledge_evidence_ids)||!c.knowledge_evidence_ids.length||c.knowledge_evidence_ids.some(id=>!c.evidence_ids?.includes(id)||!er.get(id)?.canonical)))issues.push(issue('character_knowledge_unproven','玩家或旁观者知道的事实不能自动成为角色知识；需单列角色获知证据'));
  if(c.type==='stable_trait'&&independentScenes(es.filter(e=>e?.canonical&&(substantive.has(sourceMap.get(e.source_id)?.kind)||sourceMap.get(e.source_id)?.kind==='official_canon_excerpt')))<2)issues.push(issue('single_scene_generalization','稳定人格至少需要两个独立剧情场景；这是可调整的工程门槛'));
  if(spec.review_policy==='independent'&&!['hypothesis','synthetic'].includes(c.type)){const r=c.semantic_review;if(!reviewValid(r)||r.assessor===c.entailment?.assessor||r.reviewed_sha256!==claimReviewDigest(c,{spec,sources,evidence})||['attribution','causality','chronology','quantifiers','conditions'].some(k=>r.facets?.[k]!==true))issues.push(issue('independent_semantic_review_required','需要与提炼者分开的逐项语义复核，并绑定结论和证据哈希'));}
  if(['fact','observation','stable_trait','conditional_trait'].includes(c.type)&&!reviewValid(c.entailment))issues.push(issue('claim_semantic_review_required','引文到结论需单独语义评审'));
  if(c.type==='conditional_trait'&&(!Array.isArray(c.conditions)||!c.conditions.length))issues.push(issue('missing_trait_conditions','条件倾向必须单列至少一个有证据的适用条件，不能只在陈述中夹带当/如果'));
  if(!Array.isArray(c.conditions))issues.push(issue('conditions_not_explicit','需显式列出条件，无条件填空数组'));
  else for(const condition of c.conditions){const ids=condition.evidence_ids||[];if(!ids.length||ids.some(id=>!c.evidence_ids?.includes(id)||!er.get(id)?.usable)||!reviewValid(condition.entailment))issues.push(issue('unsupported_condition','条件本身没有可追溯的语义支持'));}
  if(!Array.isArray(c.counter_evidence_ids))issues.push(issue('counterexample_search_unrecorded','必须记录反例检索，不能省略字段'));
  else for(const id of c.counter_evidence_ids)if(!er.get(id)?.usable)issues.push(issue('invalid_counterevidence',id));
  if((c.counter_evidence_ids||[]).length&&!['qualified','unresolved'].includes(c.conflict_resolution))issues.push(issue('contradiction_suppressed','有反例却没有解释条件或标记争议'));
  if(c.conflict_resolution==='qualified'&&!reviewValid(c.conflict_review))issues.push(issue('conflict_review_required','不能仅写qualified绕过矛盾评审'));
  if(c.conflict_resolution==='unresolved')issues.push(issue('unresolved_conflict','争议保留，不能进入正式运行画像'));
  if(es.some(e=>e?.usable&&!e.canonical))issues.push(issue('research_layer_only','非现实原作证据只进入研究层，不能变成全局运行事实','note'));
  if(['hypothesis','synthetic'].includes(c.type))issues.push(issue('not_runtime_fact','假设与合成保留在研究层','note'));
  const reviewed=es.length&&es.every(e=>e?.usable);
  return{id:c.id,type:c.type,accepted:!issues.some(i=>i.severity==='blocker'),runtime_eligible:!issues.length&&reviewed&&!['hypothesis','synthetic'].includes(c.type),issues};
 });
 const coverage=DIMENSIONS.map(d=>{
  if(d.capability&&!spec.capabilities.includes(d.capability))return{dimension:d.id,name:d.name,status:'not_requested',reason:'本次未请求此能力，未放入覆盖分母'};
  const waiver=waivers.find(w=>w.dimension===d.id);
  if(waiver){if(waiver.status==='not_applicable'&&waiver.reason?.trim()&&waiver.approved_by?.trim()&&d.priority!==0)return{dimension:d.id,name:d.name,status:'not_applicable',reason:waiver.reason};}
  const es=evidenceResults.filter(e=>e.dimension===d.id&&e.canonical),scenes=new Set(es.map(e=>e.scene_id)),ss=new Set(es.flatMap(e=>e.situations)),missingSituations=d.situations.filter(x=>!ss.has(x));
  const supplementary=evidenceResults.filter(e=>e.dimension===d.id&&e.usable&&!e.canonical).length;
  let status=es.length?(independentScenes(es)>=d.min&&!missingSituations.length?'covered':'partial'):'missing';
  if(waiver?.status==='unavailable'&&!es.length)status='unavailable';
  return{dimension:d.id,name:d.name,priority:d.priority,status,independent_scenes:independentScenes(es),source_families:new Set(es.map(e=>e.family)).size,primary_evidence:es.filter(e=>e.primary).length,secondary_evidence:es.filter(e=>!e.primary).length,supplementary_evidence:supplementary,missing_situations:missingSituations,requested_min_scenes:d.min,acquisition_failure:waiver?.status==='unavailable'?waiver.reason||'未说明失败原因':null,invalid_waiver:!!waiver&&waiver.status!=='unavailable'};
 });
 const importantGaps=coverage.filter(c=>c.priority===1&&!['covered','not_applicable','not_requested'].includes(c.status));
 const hardGaps=coverage.filter(c=>c.priority===0&&!['covered','not_applicable','not_requested'].includes(c.status));
 return{version:VERSION,source_results:sourceResults,evidence_results:evidenceResults,claim_results:claimResults,coverage,independent_source_families:new Set(sourceResults.map(s=>s.family)).size,hard_gaps:hardGaps.map(x=>x.dimension),runtime_claims:claimResults.filter(x=>x.runtime_eligible).map(x=>x.id),important_gaps:importantGaps.map(c=>c.dimension),coverage_template_ready:coverage.every(c=>['covered','not_applicable','not_requested'].includes(c.status)),ready_for_runtime:hardGaps.length===0&&importantGaps.length===0&&claimResults.some(c=>c.runtime_eligible),web_exhaustiveness_proven:false,overall_completeness_percentage:null,notes:['覆盖率只对应模板，不证明网上材料已找全；本工具不输出伪精确全面度百分比。','语义评审由调用方提供，工具检查记录和引用一致性，不能独自证明材料真实或结论正确。','covered不等于可稳定扮演；仍需多轮、跨场景和独立评审。']};
}
export function planResearch({spec,corpus,remaining_queries=24,max_queries=12}){
 validateSpec(spec);ok(Number.isInteger(remaining_queries)&&remaining_queries>=0&&Number.isInteger(max_queries)&&max_queries>0&&max_queries<=100,'查询预算无效');
 const report=corpus?auditCorpus({...corpus,spec}):null;
 const active=DIMENSIONS.filter(d=>!d.capability||spec.capabilities.includes(d.capability));
 const gaps=report?report.coverage.filter(c=>['missing','partial','unavailable'].includes(c.status)).sort((a,b)=>a.priority-b.priority):[...active].sort((a,b)=>a.priority-b.priority);
 const rootQuery=`"${spec.work.replaceAll('"','')}" "${spec.name.replaceAll('"','')}"`;
 const queries=[];
 for(const g of gaps){const d=DIMENSIONS.find(d=>d.id===(g.id||g.dimension));queries.push({dimension:d.id,priority:d.priority,query:rootQuery+' '+d.name+' '+(g.missing_situations?.join(' ')||''),purpose:`补充${d.name}的有上下文证据；保留来源和定位`,preferred_sources:['official_script','official_profile','game_transcript','wiki_transcript'],avoid:['fanon_as_canon','generated_biography','search_snippet_as_body'],required_output:['canonical_url','body_snapshot_hash','scene_id','scene_mode','story_scope','speaker','addressee','locator','evidence_anchor','entailment_review']});}
 const cap=Math.min(remaining_queries,max_queries);return{version:VERSION,queries:queries.slice(0,cap),remaining_unplanned_gaps:Math.max(0,queries.length-cap),stop_reason:remaining_queries===0?'budget_exhausted':queries.length===0?'template_gaps_resolved':'continue_targeted_acquisition',rules:['先消歧身份、世界线、分支与阶段，再执行查询。','返回摘要只能用于发现；必须阅读全文或明确记录不可达。','实际搜索与抓取由宿主agent的联网工具执行；本服务器不绕过访问限制。','每轮按新增独立场景和关键缺口缩小判断收益；不要按页面数填满模板。']};
}
export function claimReviewDigest(claim,corpus){return digest(JSON.stringify({statement:claim.statement,type:claim.type,scope:claim.scope,conditions:claim.conditions,evidence:(claim.evidence_ids||[]).map(id=>{const e=corpus.evidence.find(e=>e.id===id),src=corpus.sources.find(s=>s.id===e?.source_id);return e?{id:e.id,quote:e.quote,scope:e.scope,source_sha256:src?.sha256,source_kind:src?.kind,scene_mode:e.scene_mode,canonical_unit_id:src?.canonical_unit_id||e.canonical_unit_id||e.scene_id,parent_sha256:src?.parent_sha256}:null;})}));}
export function prepareClaimReview({corpus,claim_id}){const c=corpus.claims.find(c=>c.id===claim_id);if(!c)throw Error('未知claim_id');return{claim:c,reviewed_sha256:claimReviewDigest(c,corpus),evidence:(c.evidence_ids||[]).map(id=>{const e=corpus.evidence.find(e=>e.id===id),s=corpus.sources.find(s=>s.id===e?.source_id);const parent=corpus.sources.find(p=>p.id===s?.parent_source_id);return{evidence:e,source_metadata:s?{url:s.url,kind:s.kind,canonical_unit_id:s.canonical_unit_id,excerpt_review:s.excerpt_review}:null,source_context:s?.body.slice(Math.max(0,e.start-240),e.end+240),parent_context:parent?.body.slice(Math.max(0,s.parent_start-400),s.parent_end+400)};}),instruction:'另开独立评审上下文，只判断这些证据是否支持结论；逐项核对说话人、因果、先后顺序、程度词和条件，并阅读父上下文判断是否是梦境、宣传、其他世界线或读者视角。不存在证据时判不支持，不用角色常识补齐。status=supported只用于全部核实后，assessor不可与提炼者相同。'};}
export function compilePortrait({corpus}){
 const report=auditCorpus(corpus),accepted=new Set(report.runtime_claims);
 const claims=corpus.claims.filter(c=>accepted.has(c.id));
 return{version:VERSION,ready:report.ready_for_runtime,deployment_eligible:report.ready_for_runtime&&corpus.spec.review_policy==='independent',semantic_review_policy:corpus.spec.review_policy||'legacy',character_id:corpus.spec.character_id,layers:{traits:claims.filter(c=>['stable_trait','conditional_trait'].includes(c.type)).map(c=>c.id),character_knowledge:claims.filter(c=>c.type==='fact').map(c=>c.id),scene_observations:claims.filter(c=>c.type==='observation').map(c=>c.id)},statements:claims.map(c=>({id:c.id,type:c.type,statement:c.statement,conditions:c.conditions,source_evidence_ids:c.evidence_ids})),rejected:report.claim_results.filter(c=>!c.runtime_eligible),hard_gaps:report.hard_gaps,freeform_semantic_rewrite_allowed:false,instruction:'只使用通过检查的陈述编译运行画像；不要另写未经审计的新性格。保持现实/梦境/分支差别，不能将研究者场景标签写成角色自觉。'};
}
export function auditEvaluation({plan}){
 ok(plan&&typeof plan==='object','缺少plan');const issues=[];const cases=arr(plan.cases,'cases');unique(cases,'id');
 const train=new Set(plan.extraction_scene_ids||[]),exposed=new Set(plan.previously_exposed_test_scene_ids||[]),sceneSet=new Set();
 const refGroups=new Set(plan.extraction_origin_ids||[]);
 if(!plan.persona_frozen_hash)issues.push(issue('persona_not_frozen','出题运行前必须冻结画像'));
 if(plan.coordinator_seen_holdout!==false)issues.push(issue('coordinator_exposure','编排者接触参考，不能宣称完全双盲','warning'));
 for(const c of cases){
  text(c.scene_id,'scene_id');sceneSet.add(c.scene_id);
  if([...train].some(s=>c.scene_id===s||c.scene_id.startsWith(s+':'))||(c.origin_id&&refGroups.has(c.origin_id)))issues.push(issue('heldout_leak',c.id));
  if(exposed.has(c.scene_id))issues.push(issue('exposed_regression_not_new_holdout',c.id));
  if(!['fact_recall','personality_transfer','language_style','immersion','multi_turn'].includes(c.track))issues.push(issue('missing_evaluation_track',c.id));
  const provided=new Set(c.provided_fact_ids||[]),required=c.reference_required_fact_ids||[];
  if(c.track!=='fact_recall'&&required.some(id=>!provided.has(id)))issues.push(issue('hidden_fact_as_personality_target',c.id));
  if(!['original_context','paraphrased_context','synthetic_scenario'].includes(c.context_type))issues.push(issue('context_type_undisclosed',c.id));
  if(c.reference_verified!==true)issues.push(issue('unverified_reference',c.id,'warning'));
 }
 if(plan.memory!==false||plan.retrieval!==false)issues.push(issue('generation_isolation_undeclared','须显式关闭记忆和检索，或单独标记实验轨道'));
 const variants=new Set(plan.variants||[]);if(['generic','name_only','persona_named','persona_anonymous'].some(v=>!variants.has(v)))issues.push(issue('missing_baselines','缺少通用、角色名、画像或匿名对照','warning'));
 if(!variants.has('wrong_persona'))issues.push(issue('no_negative_control','建议加入错误画像组，检查评审是否只奖励泛化措辞','warning'));
 const tracks=new Set(cases.map(c=>c.track));if(!tracks.has('multi_turn'))issues.push(issue('no_multi_turn','单轮续写不能证明长期互动能力','warning'));
 if(sceneSet.size<5)issues.push(issue('few_independent_scenes','独立场景少于首版工程目标5个','warning'));
 if(!Number.isInteger(plan.repetitions)||plan.repetitions<2)issues.push(issue('single_sample_only','每题每组少于2次，不评估采样变化','warning'));
 if(!plan.rubric_frozen_hash)issues.push(issue('rubric_not_frozen','评审规则必须在读模型结果前冻结'));
 if(plan.judge_model===plan.actor_model)issues.push(issue('same_model_judge','自评偏差，需独立模型或人工复核','warning'));
 if(plan.calibration?.order_swap_checked!==true||plan.calibration?.same_answer_consistency_checked!==true)issues.push(issue('judge_not_calibrated','先检查换序和同答案一致性，未校准分只作探索','warning'));
 if(plan.originality_claim==='verbatim_original'&&cases.some(c=>c.context_type!=='original_context'))issues.push(issue('mislabelled_original_dialogue','改写场景不能标作原对话逐字测试'));
 return{version:VERSION,issues,independent_scene_clusters:sceneSet.size,tracks:[...tracks],formal_ready:!issues.length,allowed_report:issues.some(i=>i.severity==='blocker')?'diagnostic_only':issues.length?'exploratory':'scoped_benchmark',character_fidelity_probability:null,notes:['人物符合度量表分不等于客观概率。','事实复现、人格迁移、语言、沉浸、多轮连续性分别报告，不折成一个万能分。','已经用来修改通用规则的旧题应转为回归集，新版效果需要新留出集。']};
}
export function template(){return{version:VERSION,dimensions:DIMENSIONS,situations:SITUATIONS,claim_types:[...claimTypes],intended_loop:['plan_research','宿主搜索并获取正文','audit_corpus','语义复核与反例补采','compile_portrait','audit_evaluation_plan','宿主模型执行与独立评审'],scope:'通用证据审计与角色制作流程；正文下载使用capture_source，搜索可用Brave或宿主工具；绘图模型由宿主提供。',example_spec:{character_id:'work:character',name:'角色名',work:'作品名',continuity:'main',branch:'shared',strict_story:true,stage_order:1,capabilities:['text','visual']},visual_loop:['plan_visual_research','capture_reference及实际看图','audit_visual_identity','save_character_bundle','宿主绘图工具','audit_generated_image','export_character']};}






