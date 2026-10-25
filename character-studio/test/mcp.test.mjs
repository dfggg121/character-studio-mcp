import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSession,invoke,TOOLS} from '../src/server.mjs';
import {fixture,evaluationFixture} from '../examples/fixtures.mjs';
const init={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}};
function session(){const h=createSession();h(init);h({jsonrpc:'2.0',method:'notifications/initialized'});return h;}
test('MCP初始化声明工具与明确版本',()=>{const r=createSession()(init);assert.equal(r.result.protocolVersion,'2025-11-25');assert.ok(r.result.capabilities.tools);});
test('初始化前不允许直接调用工具',()=>assert.ok(createSession()({jsonrpc:'2.0',id:2,method:'tools/list'}).error));
test('客户端未知新版可按legacy协商回已支持版本',()=>{const r=createSession()({...init,params:{...init.params,protocolVersion:'2099-01-01'}});assert.equal(r.result.protocolVersion,'2025-11-25');});
test('工具发现有34个通用工具，无角色专用工具',()=>{const r=session()({jsonrpc:'2.0',id:2,method:'tools/list'});assert.equal(r.result.tools.length,34);assert.deepEqual(r.result.tools.map(t=>t.name),TOOLS.map(t=>t.name));});
test('工具调用返回结构化审计，不执行外部命令',()=>{const r=session()({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'audit_corpus',arguments:{corpus:fixture()}}});assert.equal(r.result.isError,false);assert.ok(r.result.structuredContent.coverage);});
test('无效数据变成工具错误，不结束整个MCP进程',()=>{const h=session();const r=h({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'audit_corpus',arguments:{corpus:{}}}});assert.equal(r.result.isError,true);assert.ok(h({jsonrpc:'2.0',id:4,method:'tools/list'}).result);});
test('参数拼错不被无声忽略',()=>assert.throws(()=>invoke('plan_research',{spce:{}}),/参数/));
test('未知通知不产生响应',()=>assert.equal(session()({jsonrpc:'2.0',method:'notifications/unknown'}),null));
test('真实stdio子进程支持握手、发现、调用和解析错误，stdout纯JSON',()=>{const input=[JSON.stringify(init),JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'}),JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'audit_evaluation_plan',arguments:{plan:evaluationFixture()}}}),'not-json'].join('\n')+'\n';const r=spawnSync(process.execPath,[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],{input,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(r.status,0);const lines=r.stdout.trim().split(/\r?\n/).map(JSON.parse);assert.equal(lines.length,4);assert.equal(lines[2].result.structuredContent.formal_ready,true);assert.equal(lines[3].error.code,-32700);});

