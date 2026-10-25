import test from 'node:test';import assert from 'node:assert/strict';import {assertPublicFile} from '../scripts/release-privacy.mjs';
test('公开包拒绝本地数据和凭据文件',()=>{for(const path of ['reports/result.json','artifacts/case.txt','.env.local','.character-studio/install.yml','screenshot.png','secrets.pem'])assert.throws(()=>assertPublicFile(path,Buffer.from('text')));});
test('公开包拒绝个人目录和真实形态凭据',()=>{for(const text of [['C:', 'Users', 'example-person', 'file.txt'].join('\\'),'sk-'+'a'.repeat(30),'ghp_'+'b'.repeat(30),'-----BEGIN '+'PRIVATE KEY-----'])assert.throws(()=>assertPublicFile('docs/example.md',Buffer.from(text)));});
test('公开包允许配置变量名称与合成资料',()=>{assert.doesNotThrow(()=>assertPublicFile('docs/setup.md',Buffer.from('Set DEEPSEEK_API_KEY in your environment. https://example.org/')));});
