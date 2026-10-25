import test from 'node:test';
import assert from 'node:assert/strict';
import {fullFixture,clone,review} from '../examples/fixtures.mjs';
import {VISUAL_FIELDS,buildCharacterBundle} from '../src/visual.mjs';
import {invoke} from '../src/server.mjs';
function sample(){const corpus=fullFixture();const scope=clone(corpus.spec);return{corpus,visual:{scope,references:[{id:'r1',url:'https://example.org/art',kind:'official_art',scope:clone(scope),sha256:'a'.repeat(64),local_path:'C:/fixture/reference.png',locator:'正面',retrieved_at:'2026-10-25',visual_review:clone(review)}],features:VISUAL_FIELDS.map((field,i)=>({id:'v'+i,field,description:'合成特征 '+field,reference_ids:['r1'],entailment:clone(review),conflict_status:'resolved'}))}};}
test('绑定同一bundle且不伪装已生成',()=>{const r=invoke('build_character_bundle',sample());assert.equal(r.ready_for_generation,true);assert.equal(r.output_status,'not_generated');assert.equal(r.desktop_pet_ready,false);assert.equal(r.generation_task.result_contract.bundle_id,r.bundle_id);});
for(const [name,mutate] of Object.entries({错角色:x=>x.visual.references[0].scope.character_id='wrong',错阶段:x=>x.visual.scope.stage_order=100,同人:x=>x.visual.references[0].kind='fanart',未看图:x=>delete x.visual.references[0].visual_review,缺特征:x=>x.visual.features.pop(),断证据:x=>x.visual.features[0].reference_ids=['missing'],争议:x=>x.visual.features[0].conflict_status='unresolved',人格缺失:x=>{x.corpus.evidence=[];x.corpus.claims=[];}}))test(name+'阻断生成',()=>{const x=sample();mutate(x);assert.equal(buildCharacterBundle(x).ready_for_generation,false);assert.equal(buildCharacterBundle(x).generation_task,null);});
test('风格变更改变指纹不改变人格',()=>{const x=sample(),a=buildCharacterBundle(x),b=buildCharacterBundle({...x,design:{style:'水彩Q版'}});assert.notEqual(a.bundle_id,b.bundle_id);assert.deepEqual(a.persona,b.persona);});
test('拒绝未经证实的设计字段',()=>assert.throws(()=>buildCharacterBundle({...sample(),design:{scar:'伤疤'}})));
