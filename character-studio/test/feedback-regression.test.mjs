import test from 'node:test';import assert from 'node:assert/strict';import {decodeSource} from '../src/network.mjs';import {auditCorpus} from '../src/core.mjs';import {fixture,review,clone} from '../examples/fixtures.mjs';import {safeError} from '../src/server.mjs';
test('HTTP声明Shift_JIS正确解码而非保存乱码',()=>{const b=Buffer.from([0x93,0xfa,0x96,0x7b,0x8c,0xea]);assert.equal(decodeSource(b,'text/html; charset=Shift_JIS').text,'日本語');});
test('HTML meta可确定旧站编码',()=>{const b=Buffer.concat([Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS"><p>'),Buffer.from([0x93,0xfa,0x96,0x7b,0x8c,0xea]),Buffer.from('</p>')]);assert.match(decodeSource(b).text,/日本語/);});
test('未知字符集和无法解码的字节明确失败',()=>{assert.throws(()=>decodeSource(Buffer.from('x'),'text/html; charset=made-up'));assert.throws(()=>decodeSource(Buffer.from([0xff,0xfe,0xff])));});
test('中文UTF8资料保持可读',()=>assert.equal(decodeSource(Buffer.from('人物画像')).text,'人物画像'));
test('条件倾向不能用空conditions绕过证据门禁',()=>{const f=fixture();f.claims[0].type='conditional_trait';const r=auditCorpus(f);assert.ok(r.claim_results[0].issues.some(x=>x.code==='missing_trait_conditions'));assert.equal(r.claim_results[0].runtime_eligible,false);});
test('网络错误分类不暴露主机或密钥',()=>{const e=Error('secret-key@private-host');e.code='ENOTFOUND';assert.equal(safeError(e),'网络连接失败：ENOTFOUND');});
import {planResearch} from '../src/core.mjs';
test('低预算首轮也优先覆盖身份和认知边界两个硬缺口',()=>{const p=planResearch({spec:fixture().spec,max_queries:2,remaining_queries:2});assert.deepEqual(p.queries.map(q=>q.dimension),['identity','knowledge_limits']);});
